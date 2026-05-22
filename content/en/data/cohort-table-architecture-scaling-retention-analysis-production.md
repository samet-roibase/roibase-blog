---
title: "Cohort Table Architecture: Scaling Retention Analysis in Production"
description: "Production-ready BigQuery architecture for cohort analysis across millions of users: materialized views, partitioning, and query cost optimization strategies."
publishedAt: 2026-05-22
modifiedAt: 2026-05-22
category: data
i18nKey: data-007-2026-05
tags: [cohort-analysis, bigquery, materialized-views, retention-engineering, query-optimization]
readingTime: 8
author: Roibase
---

Retention analysis is one of the most powerful ways to understand user behavior. But at real scale — millions of events per day, hundreds of thousands of users — naive SQL queries timeout in 30 seconds or exhaust slot capacity. Sustainable cohort analysis in production requires optimizing table architecture to match the query engine. This article shows how to scale cohort tables on BigQuery using materialized views, partitioning, and incremental refresh strategies.

## Why Naive Cohort Queries Fail

Classical cohort analysis works like this: find the user's first activity date (cohort_date), calculate all subsequent activities as "Day N" relative to that date, aggregate retention rates by group. The following SQL is logically correct but fails in production:

```sql
WITH first_event AS (
  SELECT user_id, MIN(DATE(event_timestamp)) AS cohort_date
  FROM `project.dataset.events`
  GROUP BY user_id
),
daily_activity AS (
  SELECT e.user_id, DATE(e.event_timestamp) AS activity_date
  FROM `project.dataset.events` e
  GROUP BY 1,2
)
SELECT 
  f.cohort_date,
  DATE_DIFF(d.activity_date, f.cohort_date, DAY) AS day_n,
  COUNT(DISTINCT d.user_id) AS retained_users
FROM first_event f
JOIN daily_activity d USING(user_id)
GROUP BY 1,2
ORDER BY 1,2;
```

Two critical problems here: (1) the `events` table is fully scanned each time — no partition pruning, (2) for each cohort_date, all user activities are joined — Cartesian explosion risk. On 100M events, this query processes 400GB of data and completes in 2 minutes, but daily refresh at this cost is unsustainable. Your BigQuery bill explodes 10x by month-end.

## Reduce Filter Burden with Partitioned Base Table

First step: partition the `events` table by `DATE(event_timestamp)`. This ensures only relevant partitions are scanned when a `WHERE DATE(event_timestamp) BETWEEN X AND Y` clause is added:

```sql
CREATE TABLE `project.dataset.events`
PARTITION BY DATE(event_timestamp)
CLUSTER BY user_id, event_name
AS SELECT * FROM ...;
```

Clustering on (user_id, event_name) places the same user's events in physically adjacent blocks — join performance improves 30–50%. But this alone isn't enough; cohort calculation logic runs from scratch in every query. This is where materialized views enter.

## Materialized Views: Incremental Cohort Table

BigQuery materialized views store query results physically and auto-refresh when base tables change. For cohort analysis, use this structure:

```sql
CREATE MATERIALIZED VIEW `project.dataset.user_cohorts`
PARTITION BY cohort_date
CLUSTER BY user_id
AS
SELECT 
  user_id,
  MIN(DATE(event_timestamp)) AS cohort_date,
  COUNT(*) AS first_day_events
FROM `project.dataset.events`
GROUP BY user_id;
```

This view calculates each user's first seen date (cohort_date) once and persists it. When new events arrive, BigQuery processes only the delta — no full rescan. Partitioning by cohort_date enables pruning in retention queries with `WHERE cohort_date = '2026-05-01'`.

Now the retention calculation query reduces to:

```sql
SELECT 
  c.cohort_date,
  DATE_DIFF(DATE(e.event_timestamp), c.cohort_date, DAY) AS day_n,
  COUNT(DISTINCT e.user_id) AS retained_users
FROM `project.dataset.user_cohorts` c
JOIN `project.dataset.events` e 
  ON c.user_id = e.user_id 
  AND DATE(e.event_timestamp) >= c.cohort_date
WHERE c.cohort_date BETWEEN '2026-05-01' AND '2026-05-15'
GROUP BY 1,2;
```

This joins against the materialized view instead of the base table — rows scanned drop from millions to thousands. But it still scans the daily event table. The next layer introduces pre-aggregated retention.

## Pre-Aggregated Retention Table: Final Layer

Cohort analysis typically examines fixed intervals — "Day 0, Day 1, Day 7, Day 30" — so you don't need to recalculate every day. Using dbt, apply this logic:

1. Each day, fetch new cohorts from the `user_cohorts` view
2. For each cohort, calculate past 30 days of retention (after the first 30 days complete, the result doesn't change)
3. Write result to `cohort_retention_summary` table **incrementally**

dbt model:

```sql
{{
  config(
    materialized='incremental',
    unique_key=['cohort_date','day_n'],
    partition_by={'field':'cohort_date','data_type':'date'},
    cluster_by=['day_n']
  )
}}

WITH cohorts_to_update AS (
  SELECT DISTINCT cohort_date 
  FROM {{ ref('user_cohorts') }}
  WHERE cohort_date >= CURRENT_DATE() - 31
  {% if is_incremental() %}
    AND cohort_date > (SELECT MAX(cohort_date) FROM {{ this }})
  {% endif %}
),
retention_calc AS (
  SELECT 
    c.cohort_date,
    DATE_DIFF(DATE(e.event_timestamp), c.cohort_date, DAY) AS day_n,
    COUNT(DISTINCT e.user_id) AS retained_users,
    MAX(c.first_day_events) AS cohort_size
  FROM {{ ref('user_cohorts') }} c
  JOIN {{ source('raw','events') }} e 
    ON c.user_id = e.user_id
  WHERE c.cohort_date IN (SELECT cohort_date FROM cohorts_to_update)
    AND DATE(e.event_timestamp) >= c.cohort_date
    AND DATE_DIFF(DATE(e.event_timestamp), c.cohort_date, DAY) <= 30
  GROUP BY 1,2
)
SELECT 
  cohort_date,
  day_n,
  retained_users,
  cohort_size,
  SAFE_DIVIDE(retained_users, cohort_size) AS retention_rate
FROM retention_calc;
```

This model updates only the last 31 days of cohorts each day. For cohorts older than 31 days, retention is stable — no recalculation needed. Slot usage drops 95%. In [CDP & Retention Engineering](https://www.roibase.com.tr/en/retention-engineering-cdp) workflows, this table connects directly to dashboards — BI tools (Looker, Metabase) return results in 100ms.

## Query Cost and Partition Expiration Strategy

In BigQuery, storage is cheap ($0.02/GB/month), compute is expensive ($5/TB scanned). Since retention analysis is retrospective, old partitions get scanned frequently. Two optimizations:

1. **Partition expiration:** Automatically delete partitions older than 90 days from `events` — cohort calculation finishes before raw events are no longer needed.
2. **Periodically refresh clustering statistics:** `ANALYZE TABLE ... UPDATE STATISTICS` — query optimizer chooses better execution plans.

Example cost comparison (100M events/day, 1M users):

| Method | Data scanned/day | Monthly compute cost |
|---|---|---|
| Naive query (full scan) | 12TB | $600 |
| Partitioned + materialized view | 800GB | $40 |
| Pre-aggregated table (incremental) | 50GB | $2.50 |

Adding the pre-aggregate layer reduces compute costs 240x. This difference is critical in production — especially if retention analysis refreshes hourly.

## Real-Time Cohort Analysis Tradeoff

Materialized views and pre-aggregate structures introduce latency: data lags 1–5 minutes. If real-time cohort analysis is required (e.g., for the first 24 hours), use a hybrid approach:

- For last 24 hours: streaming inserts + real-time query (cache disabled)
- For older data: pre-aggregate table

The BI query unions both sources:

```sql
SELECT * FROM cohort_retention_summary WHERE cohort_date < CURRENT_DATE()
UNION ALL
SELECT * FROM realtime_cohort_view WHERE cohort_date = CURRENT_DATE();
```

Real-time views are expensive, but running only for the current cohort keeps total compute impact manageable.

## Cohort Segmentation and Cardinality Explosion

Slicing retention by user segments (platform, country, acquisition channel) can trigger cardinality issues. For example, 5 segments × 30 days × 365 cohorts = 54,750 unique rows. In this case:

1. **Limit segment count:** Analyze the 3–5 most important segments; create separate tables for others.
2. **Dynamic segmentation:** Instead of pre-aggregating segments, use join-time filtering — preserves query flexibility but increases slot usage.
3. **Rollup table:** Create a separate table for weekly cohorts (weekly_cohort_retention) — cardinality drops 85%.

In Roibase's [Data Analytics & Insight Engineering](https://www.roibase.com.tr/en/verianalizi) process, we tie segment strategy to acquisition source attribution — cohort analysis links directly to channel performance.

## Monitoring and Regression Detection

Monitor your production cohort pipeline with these metrics:

- **Query slot time:** BigQuery slot consumption for daily refresh — sudden spikes indicate cardinality explosion or lost partition pruning.
- **Row count delta:** Rows added per refresh — unexpectedly high values signal duplicate events.
- **Retention rate stddev:** Day 1 retention shifts >10% suddenly? Data quality red flag.

Add these checks as dbt tests:

```yaml
tests:
  - dbt_utils.expression_is_true:
      expression: "retention_rate BETWEEN 0 AND 1"
  - dbt_utils.recency:
      datepart: day
      field: cohort_date
      interval: 1
```

Test failures trigger Slack/PagerDuty alerts — no manual monitoring required.

Cohort table architecture elevates retention analysis from "ad-hoc query" to "production data product." Materialized views with incremental refresh, partitioning for query pruning, pre-aggregation for slot optimization — each layer reduces cost 10x. Running retention analysis across millions of users and billions of events now compresses into a 100ms dashboard query. Deciding which retention patterns to monitor remains your responsibility — but processing that data at this speed is now an engineering non-issue.