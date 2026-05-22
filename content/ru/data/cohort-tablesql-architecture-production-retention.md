---
title: "Cohort Table Architecture: Scaling Retention Analysis in Production"
description: "Production-ready BigQuery architecture for cohort analysis across millions of users using materialized views, partitioning, and query cost optimization."
publishedAt: 2026-05-22
modifiedAt: 2026-05-22
category: data
i18nKey: data-007-2026-05
tags: [cohort-analysis, bigquery, materialized-views, retention-engineering, query-optimization]
readingTime: 8
author: Roibase
---

Retention analysis is one of the most powerful methods for understanding user behavior. But at real scale — millions of events per day, hundreds of thousands of users — naive SQL queries timeout in 30 seconds or exhaust slot capacity. Sustainable cohort analysis in production requires optimizing table architecture for the query engine. In this article, we show how to scale cohort tables on BigQuery using materialized views, partitioning, and incremental refresh strategies.

## Why Naive Cohort Queries Fail

Classical cohort analysis works on this logic: find the user's first activity date (cohort_date), calculate subsequent activities as "Day N" relative to that date, aggregate retention rates by group. The following SQL is logically correct but breaks in production:

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

Two major problems here: (1) the `events` table is fully scanned each time — no partition pruning, (2) for each cohort_date, all user activities are joined — Cartesian explosion risk. At 100M events, this query processes 400GB and completes in 2 minutes, but refreshing daily makes this unsustainable. Your BigQuery bill 10x's by month-end.

## Filtering Load with Partitioned Base Table

First step: partition the `events` table on `DATE(event_timestamp)`. This ensures only relevant partitions are scanned when the query includes `WHERE DATE(event_timestamp) BETWEEN X AND Y`:

```sql
CREATE TABLE `project.dataset.events`
PARTITION BY DATE(event_timestamp)
CLUSTER BY user_id, event_name
AS SELECT * FROM ...;
```

Adding clustering on (user_id, event_name) keeps a single user's events in adjacent physical blocks — join performance gains 30-50%. But this alone isn't enough; cohort logic re-runs in every query. This is where materialized views enter.

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

This view computes each user's first-seen date (cohort_date) once and stores it. When new events arrive, BigQuery processes only the delta — no full scan. Partitioning by cohort_date enables pruning on filters like `WHERE cohort_date = '2026-05-01'`.

Now the retention calculation query shrinks to:

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

This query joins the materialized view instead of the base table — rows scanned drop from millions to thousands. But it still scans the daily event table. The next stage adds a pre-aggregated retention layer.

## Pre-Aggregated Retention Table: The Final Layer

Cohort analysis typically examines fixed intervals — Day 0, Day 1, Day 7, Day 30 — not every single day. Using dbt, apply this logic:

1. Each day, fetch new cohorts from the `user_cohorts` view
2. For each cohort, compute the past 30 days of retention (after 30 days, it doesn't change)
3. Write the result to `cohort_retention_summary` **incrementally**

The dbt model:

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

This model updates only the last 31 days of cohorts daily. Retention for cohorts older than 31 days is frozen — no recalculation. Slot consumption drops 95%. In the [Retention Engineering & CDP](https://www.roibase.com.tr/ru/retention-engineering-cdp) process, this table connects directly to dashboards — BI tools (Looker, Metabase) return results in 100ms.

## Query Cost and Partition Expiration Strategy

On BigQuery, storage is cheap ($0.02/GB/month), compute is expensive ($5/TB of data scanned). Since retention analysis is retrospective, old partitions get queried frequently. Two optimizations:

1. **Partition expiration:** Auto-delete `events` partitions older than 90 days — after cohort calculation completes, raw events aren't needed.
2. **Periodically update clustering statistics:** `ANALYZE TABLE ... UPDATE STATISTICS` — the query optimizer picks better execution plans.

Sample cost comparison (100M events/day, 1M users):

| Method | Data Scanned/Day | Monthly Compute Cost |
|---|---|---|
| Naive query (full scan) | 12TB | $600 |
| Partitioned + materialized view | 800GB | $40 |
| Pre-aggregated table (incremental) | 50GB | $2.50 |

Adding the pre-aggregate layer cuts compute costs 240x. This margin matters in production — especially if retention analysis refreshes hourly.

## Real-Time Cohort Analysis Tradeoff

Materialized views and pre-aggregation introduce latency: data lags 1-5 minutes. If you need real-time cohort analysis (e.g., for the first 24 hours), use a hybrid:

- Stream inserts + real-time query for the last 24 hours (skip cache)
- Pre-aggregate table for older data

The BI query unions both sources:

```sql
SELECT * FROM cohort_retention_summary WHERE cohort_date < CURRENT_DATE()
UNION ALL
SELECT * FROM realtime_cohort_view WHERE cohort_date = CURRENT_DATE();
```

Real-time views are expensive, but since they run only on the latest cohort, total compute impact stays bounded.

## Cohort Segmentation and Cardinality Explosion

Breaking retention down by user segments (platform, country, acquisition channel) can trigger cardinality issues. For instance: 5 segments × 30 days × 365 cohorts = 54,750 unique rows. Solutions:

1. **Limit segment count:** Analyze the top 3-5 segments; create separate tables for others.
2. **Dynamic segmentation:** Add segment data at query time via join, not pre-aggregation — maintains query flexibility at the cost of slot usage.
3. **Rollup table:** Build a separate weekly-cohort retention table — cardinality drops 85%.

In Roibase's [Data Analytics & Insights Engineering](https://www.roibase.com.tr/ru/verianalizi) process, we link segment strategy to acquisition source attribution — cohort analysis connects directly to channel performance.

## Monitoring and Regression Detection

Monitor your production cohort pipeline with these metrics:

- **Query slot time:** Daily refresh's BigQuery slot consumption — sudden spikes signal cardinality explosion or partition pruning loss.
- **Row count delta:** Rows added per refresh — excess indicates duplicate events.
- **Retention rate stddev:** Day 1 retention swinging 10%+ unexpectedly is a data quality red flag.

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

Failed tests trigger Slack/PagerDuty alerts — no manual review needed.

Cohort table architecture elevates retention analysis from "ad-hoc query" to "production data product." Materialized views enable incremental refresh, partitioning enables query pruning, pre-aggregation optimizes slots — each layer cuts costs 10x. Running retention analysis across millions of users and billions of events now reduces to a 100ms dashboard query. Deciding *which* retention patterns to monitor is still your job — but processing the data at this speed is now engineering, not a problem.