---
title: "Cohort Table Architecture: Scaling Retention Analysis in Production"
description: "Architecture design using materialized views, partitioning, and query cost optimization to query 100M+ daily events in cohort tables in 5 seconds."
publishedAt: 2026-06-09
modifiedAt: 2026-06-09
category: data
i18nKey: data-007-2026-06
tags: [cohort-analysis, bigquery, materialized-views, query-optimization, retention-engineering]
readingTime: 8
author: Roibase
---

When moving retention metrics to a real-time dashboard, the first shock comes in query costs. A basic cohort query — "Of users who signed up on January 1st, how many were active on day 7?" — scans 200GB of data when written naively, takes 18 seconds to execute, and costs $4. For a team with 500 daily dashboard visits, this math becomes $60,000 per month. The problem isn't your analytical capability—it's table architecture. Moving cohort analysis to production requires storing cohort snapshots, not raw event data.

## Naive Cohort Query: Why It Doesn't Scale

A classic cohort query joins three tables: `users`, `events`, and `cohort_definitions`. With each query, the `events` table gets a full scan without partition filtering. At 100M daily events, this approach is unsustainable.

```sql
-- ❌ Anti-pattern: Scanning all events every time
SELECT 
  DATE_TRUNC(u.created_at, DAY) AS cohort_date,
  DATE_DIFF(e.event_date, u.created_at, DAY) AS day_n,
  COUNT(DISTINCT u.user_id) AS retained_users
FROM users u
JOIN events e ON u.user_id = e.user_id
WHERE u.created_at >= '2026-01-01'
  AND e.event_name = 'session_start'
GROUP BY 1, 2
ORDER BY 1, 2;
```

This query scans 480GB for 6 months of data, takes 12 seconds due to BigQuery slot consumption, and costs $2.40 (on-demand pricing: $5/TB). When you multiply the same cohort across 20 different metrics (revenue, session count, conversion rate), costs reach $48. If the dashboard refreshes 100 times daily, monthly cost hits $144,000. To scale this for production, two strategies emerge: **incremental materialization** and **pre-aggregated cohort snapshots**.

### Incremental Materialization: Event-to-Cohort Pipeline with dbt

Instead of calculating cohorts on every query, update an accumulated table with daily batches. dbt's `incremental` strategy lets you add only the new day's events to the existing cohort table.

```sql
-- models/cohort_retention_daily.sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'cohort_date', 'data_type': 'date'},
    cluster_by=['day_n', 'metric_name'],
    unique_key='cohort_date || day_n || metric_name'
  )
}}

WITH new_events AS (
  SELECT 
    u.user_id,
    DATE_TRUNC(u.created_at, DAY) AS cohort_date,
    DATE_DIFF(e.event_date, u.created_at, DAY) AS day_n,
    e.event_name,
    e.revenue_usd
  FROM {{ ref('events') }} e
  JOIN {{ ref('users') }} u ON e.user_id = u.user_id
  {% if is_incremental() %}
  WHERE e.event_date = CURRENT_DATE() - 1  -- Only yesterday's data
  {% endif %}
)
SELECT
  cohort_date,
  day_n,
  'active_users' AS metric_name,
  COUNT(DISTINCT user_id) AS metric_value
FROM new_events
WHERE event_name = 'session_start'
GROUP BY 1, 2, 3

UNION ALL

SELECT
  cohort_date,
  day_n,
  'revenue_per_cohort' AS metric_name,
  SUM(revenue_usd) AS metric_value
FROM new_events
GROUP BY 1, 2, 3;
```

The first run (full refresh) processes all historical data. Each subsequent day adds only new 1-day events. A single day of 100M events scans 3.2GB (thanks to partitioning + clustering), completes in 4 seconds, costs $0.016. Monthly incremental cost: $0.48 — one-three-hundredth of the naive approach.

## Materialized Views: BigQuery's Automatic Caching Layer

The incremental model updates on a batch basis (once daily). If you want to add the last hour's data to a real-time dashboard, BigQuery's **materialized view** feature becomes your tool. A materialized view stores a base query physically and auto-refreshes when the source table changes.

```sql
CREATE MATERIALIZED VIEW `project.dataset.cohort_retention_mv`
PARTITION BY cohort_date
CLUSTER BY day_n, metric_name
AS
SELECT
  DATE_TRUNC(u.created_at, DAY) AS cohort_date,
  DATE_DIFF(e.event_date, u.created_at, DAY) AS day_n,
  'active_users' AS metric_name,
  COUNT(DISTINCT u.user_id) AS metric_value
FROM `project.dataset.events` e
JOIN `project.dataset.users` u ON e.user_id = u.user_id
WHERE e.event_date >= CURRENT_DATE() - 90  -- Only 90-day window
  AND e.event_name = 'session_start'
GROUP BY 1, 2, 3;
```

When querying the materialized view, BigQuery returns the cached result first. If the base table changes (new events arrive), a delta is calculated in the background. Dashboard query now runs in 0.2 seconds at zero cost (cache hit). Note: the materialized view itself incurs storage costs (BigQuery storage: $0.02/GB/month), so a 90-day cohort table of 12GB costs $0.24 monthly.

**Tradeoff table:**

| Method | First Query Time | Dashboard Query Time | Monthly Compute Cost | Monthly Storage Cost |
|--------|------------------|----------------------|----------------------|----------------------|
| Naive JOIN | 12s | 12s | $144,000 | $0 |
| dbt Incremental | 4s (first batch) | 2s (snapshot read) | $0.48 | $0.18 (snapshot table) |
| Materialized View | 8s (first build) | 0.2s (cache hit) | $0 (auto-refresh) | $0.24 |

In production, combining both works best: **dbt incremental model** updates historical cohorts with daily batches, while **materialized view** keeps the last 7 days real-time.

## Partitioning and Clustering: Cutting Query Cost by 97%

Without partitioning and clustering your cohort tables, BigQuery scans the entire table on every query. On a 1TB cohort table (2 years of data), a single "show me January 2026 cohort" query scans 1TB and costs $5. With partitioning + clustering, the same query scans 8GB and costs $0.04.

**Partitioning strategy:** Daily partition by `cohort_date`. When BigQuery sees a partition filter in the query, it scans only relevant partitions.

```sql
CREATE OR REPLACE TABLE `project.dataset.cohort_retention`
PARTITION BY cohort_date
CLUSTER BY day_n, metric_name
AS
SELECT * FROM `project.dataset.cohort_retention_temp`;
```

**Clustering:** When you cluster frequently filtered fields (like `day_n`, `metric_name`) within partitions, BigQuery performs block-level pruning. A "show day_7 retention + active_users metric" query reads only relevant blocks.

Concrete example: 365 partitions (daily), 3GB each, without clustering a "day_7" filter scans 365 partitions × 3GB = 1TB. With clustering, only `day_n=7` blocks are scanned, totaling 12GB. Cost difference: $5 → $0.06.

**Anti-pattern:** Don't cluster by `user_id`. Cohort analysis is cohort-level aggregation, not user-level. Clustering by `user_id` doesn't help the query planner and actually reduces cache efficiency.

## Identity Resolution for Cohort Accuracy

Cohort analysis accuracy depends on `user_id` precision. When cookie-based sessions and post-login sessions belong to the same user, a naive JOIN creates two separate cohort records. This is solved with [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/de/firstparty): an identity graph connects anonymous `client_id` to authenticated `user_id`.

```sql
-- Identity resolution table
CREATE TABLE `project.dataset.identity_graph` (
  canonical_user_id STRING,
  client_id STRING,
  user_id STRING,
  merged_at TIMESTAMP
)
PARTITION BY DATE(merged_at)
CLUSTER BY canonical_user_id;

-- Join with cohort query
WITH resolved_users AS (
  SELECT 
    COALESCE(ig.canonical_user_id, e.user_id) AS user_id,
    e.event_date,
    e.event_name
  FROM events e
  LEFT JOIN identity_graph ig 
    ON e.client_id = ig.client_id OR e.user_id = ig.user_id
)
SELECT 
  DATE_TRUNC(u.created_at, DAY) AS cohort_date,
  DATE_DIFF(r.event_date, u.created_at, DAY) AS day_n,
  COUNT(DISTINCT r.user_id) AS retained_users
FROM resolved_users r
JOIN users u ON r.user_id = u.user_id
GROUP BY 1, 2;
```

Without identity resolution, cohorts inflate by 12-18% (one user recorded under two IDs). This error makes retention metrics look artificially low because the denominator (cohort size) inflates while numerator (day_n activity) stays the same.

## Query Cost Monitoring: Production Monitoring with INFORMATION_SCHEMA

Once cohort architecture is in place, continuous query cost optimization is needed. BigQuery's `INFORMATION_SCHEMA.JOBS` table shows bytes scanned, slot usage, and total cost for every query.

```sql
SELECT
  user_email,
  query,
  total_bytes_processed / POW(10, 12) AS tb_processed,
  (total_bytes_processed / POW(10, 12)) * 5 AS cost_usd,
  total_slot_ms / 1000 / 60 AS slot_minutes
FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
  AND statement_type = 'SELECT'
  AND query LIKE '%cohort_retention%'
ORDER BY total_bytes_processed DESC
LIMIT 20;
```

This query lists cohort table queries from the past 7 days ranked by cost. If a dashboard panel triggers 500 times daily and scans 80GB each time (missing partition filter), it generates 500 × 80GB × $5/TB = $200 daily cost. Adding `WHERE cohort_date >= CURRENT_DATE() - 30` to the panel query drops cost to $6.

**Production checklist:**
- [ ] All cohort tables partitioned by `cohort_date`?
- [ ] `day_n` and `metric_name` clustered?
- [ ] dbt incremental job running daily?
- [ ] Materialized view constrained to 90-day window?
- [ ] Dashboard queries include `WHERE cohort_date >= ...` filter?
- [ ] Weekly cost report pulled from `INFORMATION_SCHEMA`?

When cohort architecture is built correctly, retention analysis reaches production readiness: 100M daily events, 5-second query time, $10 monthly compute cost. But this architecture requires first-party identity resolution, event schema standardization, and dbt pipeline discipline — which is why retention engineering is platform work, not one-off SQL.