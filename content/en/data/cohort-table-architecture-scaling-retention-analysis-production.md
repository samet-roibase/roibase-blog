---
title: "Cohort Table Architecture: Scaling Retention Analysis in Production"
description: "Learn how to scale retention cohort analysis in production using materialized views, partition strategy, and query cost optimization to reduce costs by 90% while enabling real-time decisions."
publishedAt: 2026-08-14
modifiedAt: 2026-08-14
category: data
i18nKey: data-007-2026-08
tags: [cohort-analysis, bigquery, materialized-views, data-engineering, retention]
readingTime: 8
author: Roibase
---

Retention analysis sits at the center of decision-making in e-commerce and SaaS models. Yet when classic cohort queries run in production, they full-scan terabytes of event tables, take minutes to complete, and push query costs to hundreds of dollars per day. On-demand cohort computation slows the decision cycle, analyst teams get stuck optimizing queries, and dashboards go stale. The solution: store cohort tables as pre-computed, partitioned data assets with incremental refresh. This article shows you how to build materialized views, partitioning strategies, and incremental load patterns on BigQuery—cutting query costs by 90% while bringing analysis time down to seconds and pushing retention decisions toward real-time.

## Why Classic Cohort Queries Don't Scale

Standard cohort analysis follows this pattern: group users by their first transaction date, then measure what percentage return on subsequent days. The SQL query joins the `events` table twice—once to find the cohort date, once to count retention behavior. On a 500-million-row event table in BigQuery, this query takes 10–15 seconds and costs ~$0.50. The same query runs on every dashboard refresh, every analyst iteration, and every A/B test report.

The problem isn't just cost—it's speed and flexibility. When the analyst team wants to change cohort definition (say, switching from "first purchase" to "second add-to-cart" cohort), rewriting, testing, and validating the query takes hours. Dashboards stay stale. When marketing asks "what was last week's cohort retention," there's no live data; an analyst has to run the query manually. This loop delays decisions by days.

Cohort calculations are also an aggregation-layer data asset. Retention metric isn't just "user count"—it's the ratio of "active users / cohort size." That ratio updates daily, and past cohorts' behavior must be extended with new days. Classic queries don't support this incremental logic; they recalculate from scratch every time.

## From Query to Table: Using Materialized Views for Cohort Storage

The first step: lock cohort definition into a materialized view. BigQuery materialized views physically store query results and refresh incrementally when base tables change. But for cohort analysis, a standard MV isn't enough because cohort definition and retention windows are dynamic parameters. The solution is a hybrid structure: cohort assignment table + retention event aggregation table.

The first table, `cohort_assignments`, stores when a user first entered a cohort:

```sql
CREATE TABLE `project.dataset.cohort_assignments`
PARTITION BY DATE(cohort_date)
CLUSTER BY user_id
AS
SELECT
  user_id,
  MIN(DATE(event_timestamp)) AS cohort_date,
  COUNTIF(event_name = 'purchase') AS total_purchases
FROM `project.dataset.events`
WHERE event_name IN ('first_visit', 'purchase', 'signup')
GROUP BY user_id;
```

This table holds each user once; `cohort_date` is the partition key. New users only add to their date's partition. Table size scales with user count (not event count)—10 million users fit in ~500 MB.

The second table, `daily_user_activity`, stores whether each user was active each day as a boolean flag:

```sql
CREATE TABLE `project.dataset.daily_user_activity`
PARTITION BY activity_date
CLUSTER BY user_id
AS
SELECT
  user_id,
  DATE(event_timestamp) AS activity_date,
  TRUE AS is_active
FROM `project.dataset.events`
WHERE event_name IN ('pageview', 'purchase', 'session_start')
GROUP BY user_id, activity_date;
```

Now join these two tables to compute retention:

```sql
SELECT
  c.cohort_date,
  DATE_DIFF(a.activity_date, c.cohort_date, DAY) AS days_since_cohort,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT a.user_id) AS active_users,
  SAFE_DIVIDE(COUNT(DISTINCT a.user_id), COUNT(DISTINCT c.user_id)) AS retention_rate
FROM `project.dataset.cohort_assignments` c
LEFT JOIN `project.dataset.daily_user_activity` a
  ON c.user_id = a.user_id
  AND a.activity_date >= c.cohort_date
WHERE c.cohort_date >= '2026-01-01'
GROUP BY c.cohort_date, days_since_cohort
ORDER BY c.cohort_date, days_since_cohort;
```

This query no longer scans terabytes of events—it joins two small tables. On BigQuery with 10 million users, it runs in ~2 seconds and costs $0.02—a 96% cost reduction.

## Partitioning Strategy: Which Date, Which Partition

Partitioning strategy in cohort tables is critical because there are two time dimensions: cohort date and activity date. `cohort_assignments` partitions by `cohort_date` because user first-event is fixed; when new users arrive, only today's partition gets new rows, and past partitions remain immutable.

`daily_user_activity` partitions by `activity_date` because fresh activity arrives daily and past days never change. This structure suits incremental refresh: a dbt or Airflow job writes only today's partition daily, leaving past partitions untouched.

But retention analysis requires joining across two dates: cohort_date and activity_date. To optimize join performance, use a cluster key. In BigQuery, `CLUSTER BY user_id` physically stores rows with the same user_id side by side, letting the join leverage block-level pruning and reduce disk I/O. A join on 10 million users takes ~8 seconds without clustering, ~2 seconds with it.

Partition pruning is equally important. Retention analysis usually covers the last 90 days of cohorts. A filter like `WHERE c.cohort_date >= '2026-05-01'` triggers partition pruning; BigQuery reads only relevant partitions. For two years of data, pruning reduces scan from ~$0.50 to ~$0.02—a 24x cost difference—because the volume scanned drops drastically.

Partitioning involves a trade-off: daily partitions ease incremental refresh, but 1000+ partitions increase query planning overhead in BigQuery. Metadata loading slows. Older cohort data (beyond two years) should be archived or consolidated into monthly partitions.

## Incremental Refresh: Compute Only New Data

Cohort tables need daily updates as new users enter cohorts and existing cohorts extend their retention behavior. A full refresh—recalculating the entire table—wastes cost. The answer: incremental build pattern.

In dbt, define an incremental model:

```sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'cohort_date', 'data_type': 'date'},
    cluster_by=['user_id'],
    incremental_strategy='insert_overwrite'
  )
}}

SELECT
  user_id,
  MIN(DATE(event_timestamp)) AS cohort_date,
  COUNTIF(event_name = 'purchase') AS total_purchases
FROM {{ source('raw', 'events') }}
WHERE DATE(event_timestamp) = CURRENT_DATE() - 1
{% if is_incremental() %}
  AND DATE(event_timestamp) > (SELECT MAX(cohort_date) FROM {{ this }})
{% endif %}
GROUP BY user_id
```

This model computes only yesterday's partition daily. The `insert_overwrite` strategy deletes the old partition and writes the new one. In BigQuery, partition-level replace is atomic; downstream queries never read incomplete data.

For `daily_user_activity`, incremental logic is simpler because each day adds a new partition; past ones never change:

```sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'activity_date', 'data_type': 'date'},
    cluster_by=['user_id']
  )
}}

SELECT
  user_id,
  DATE(event_timestamp) AS activity_date,
  TRUE AS is_active
FROM {{ source('raw', 'events') }}
WHERE DATE(event_timestamp) = CURRENT_DATE() - 1
{% if is_incremental() %}
  AND DATE(event_timestamp) NOT IN (SELECT DISTINCT activity_date FROM {{ this }})
{% endif %}
GROUP BY user_id, activity_date
```

Incremental refresh cuts daily job runtime from 5 minutes to 30 seconds. BigQuery slot usage drops 80%; queue wait vanishes. When analysts open the dashboard at 9 AM, yesterday's retention data is ready.

One risk exists: late-arriving data. If the event pipeline has a 2–3 hour lag, yesterday's partition holds incomplete data. Two solutions: (1) dbt's `lookback_window` parameter—recalculate the last three days each run; (2) BigQuery's `_PARTITIONTIME` metadata—filter by partition insert time. The second is more effective because it re-processes only late events.

## Query Cost Optimization: Table Size and Scan Patterns

Cohort table costs depend on two factors: table size (GB) and query scan pattern. `cohort_assignments` for 10 million users is ~500 MB; `daily_user_activity` over 90 days is ~5 GB. Joining them scans ~6 GB in BigQuery, costing ~$0.03. The same analysis on raw events would scan 500 GB and cost ~$2.50—an 80x difference.

Cut costs further with a pre-aggregated cohort summary table:

```sql
CREATE TABLE `project.dataset.cohort_retention_summary`
PARTITION BY cohort_date
CLUSTER BY days_since_cohort
AS
SELECT
  c.cohort_date,
  DATE_DIFF(a.activity_date, c.cohort_date, DAY) AS days_since_cohort,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT a.user_id) AS active_users,
  SAFE_DIVIDE(COUNT(DISTINCT a.user_id), COUNT(DISTINCT c.user_id)) AS retention_rate
FROM `project.dataset.cohort_assignments` c
LEFT JOIN `project.dataset.daily_user_activity` a
  ON c.user_id = a.user_id
  AND a.activity_date >= c.cohort_date
GROUP BY c.cohort_date, days_since_cohort;
```

This table pre-computes retention rates for every cohort-day combo. It's ~100 MB (10 million users × 90 days = 900 million rows → aggregation yields ~50,000 rows). Dashboards read this table without joining; queries run in <1 second at ~$0.001 cost.

In query cost optimization, avoid `SELECT *`. Cohort analysis needs only `user_id`, `cohort_date`, and `activity_date`. If `daily_user_activity` holds extra columns like event_name or session_id and a query uses `SELECT *`, you scan unnecessary data. BigQuery uses columnar storage; selecting only required columns cuts disk I/O by 40–50%.

One more optimization: BigQuery BI Engine. BI Engine in-memory caches the cohort summary table, serving dashboard queries with sub-second latency. A 100 MB table costs ~$10/month in BI Engine reservation; query cost savings are ~$30/month when running 1000 queries daily—a net gain.

## The Retention Engineering Pipeline: dbt + Airflow + Alerting

In production, cohort architecture isn't just SQL—it needs orchestration and monitoring. The retention pipeline has these layers:

1. **Airflow DAG:** Triggers daily at 06:00 AM, validates event table partitions (late-arrival checks).
2. **dbt incremental models:** Updates `cohort_assignments`, `daily_user_activity`, and `cohort_retention_summary` in sequence.
3. **Data quality tests:** dbt tests check constraints like cohort_size > 0 and retention_rate BETWEEN 0 AND 1.
4. **Alerting:** If today's Day 1 retention drops 20% below last week's average, send a Slack alert.

Building this pipeline requires [CDP & Retention Engineering](https://www.roibase.com.tr/en/retention-engineering-cdp) infrastructure—from event collection through cohort definition to BigQuery optimization and dashboard integration.

Use dbt macros to parameterize cohort definition:

```sql
{% macro cohort_definition(event_name) %}
  SELECT user_id, MIN(DATE(event_timestamp)) AS cohort_date
  FROM {{ source('raw', 'events') }}
  WHERE event_name = '{{ event_name }}'
  GROUP BY user_id
{% endmacro %}
```

With this macro, run different cohort types in parallel—"first purchase," "first login," "second add-to-cart." When analysts want to test a new cohort, they change a config parameter instead of writing code.

For monitoring, track BigQuery Audit Logs at the job level. If cohort refresh suddenly costs 10x more (partition pruning broke, perhaps), auto-alert. In production, cost anomaly detection is part of retention pipeline reliability.

## How Cohort Architecture Changes Decision Velocity

Pre-computing cohorts isn't just cost optimization; it transforms decision speed and analytical flexibility. Marketing can ask "did iOS cohorts from last week show better Day 7 retention than Android" and get an answer in 10 seconds, not 10 minutes. A/B test results update daily automatically; manual export-import loops disappear.

Retention is no longer a monthly report—it's daily operational intelligence. If today's cohort shows 5% lower Day 1 retention, campaign optimization triggers immediately. If a feature release boosted Day 3 retention, you can scale fast. This speed requires cohort data to stay near real-time fresh.

Cohort architecture also enables cross-functional collaboration. Product uses cohort tables to calculate feature adoption; Finance uses the same retention curve for LTV projections; Customer Success derives churn risk scores from the same cohort assignments. One data asset serves multiple use cases; data duplication ends.

Finally, cohort architecture underpins incrementality measurement. Retention analysis isn't just "how many users returned"—it's "which marketing channel's cohort shows better retention." Paired with [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/en/firstparty), attribution stops at first-click and measures lifetime value contribution. Store `utm_source` and `campaign_id` in cohort tables to run channel-level retention comparisons—the core metric for marketing budget allocation.