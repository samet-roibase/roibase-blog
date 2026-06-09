---
title: "Cohort Table Architecture: Scaling Retention Analysis in Production"
description: "Materialized views, partitioning, and query cost optimization design for querying 100M+ daily events in cohort tables in 5 seconds."
publishedAt: 2026-06-09
modifiedAt: 2026-06-09
category: verianalizi
i18nKey: data-007-2026-06
tags: [cohort-analysis, bigquery, materialized-views, query-optimization, retention-engineering]
readingTime: 8
author: Roibase
---

Moving retention metrics to a real-time dashboard hits its first shock in query cost. A basic cohort query—"How many users who signed up on January 1st were active on day 7?"—written as a naive JOIN scans 200GB of data, runs for 18 seconds, and generates a $4 charge. For a team with 500 dashboard visits per day, this math compounds to $60,000 per month. The problem isn't your analytics capability—it's table architecture. To move cohort analysis to production, you must store cohort snapshots, not raw event data.

## Naive Cohort Query: Why It Doesn't Scale

The classical cohort query joins three tables: `users`, `events`, `cohort_definitions`. Every query runs a full scan of the `events` table without partition filtering. At 100M daily events, this approach becomes untenable.

```sql
-- ❌ Anti-pattern: Full events scan on every execution
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

This query scans 480GB for six months of data. In BigQuery, due to slot consumption, it runs for 12 seconds and costs $2.40 (on-demand pricing: $5/TB). Multiply that single cohort across 20 different metrics (revenue, session count, conversion rate) and cost jumps to $48. If your dashboard refreshes 100 times daily, monthly cost becomes $144,000. Two strategies make retention analysis production-ready: **incremental materialization** and **pre-aggregated cohort snapshots**.

### Incremental Materialization: Event-to-Cohort Pipeline with dbt

Instead of computing cohorts every query, update a cumulative table with daily batches. dbt's `incremental` strategy lets you append each day's events to your existing cohort table.

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
  WHERE e.event_date = CURRENT_DATE() - 1  -- Yesterday's data only
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

On first run (full refresh), all historical data is processed. Every subsequent day, only the previous day's new events are appended. A 100M-event day scans 3.2GB of data (thanks to partitioning and clustering), runs in 4 seconds, and costs $0.016. Monthly incremental cost: $0.48—one 300,000th of the naive approach.

## Materialized Views: BigQuery's Automatic Cache Layer

Incremental models refresh on batch schedules (once daily). For real-time dashboards where you need the last hour of data, BigQuery's **materialized view** feature applies. A materialized view stores the base query result physically and auto-refreshes when source tables change.

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
WHERE e.event_date >= CURRENT_DATE() - 90  -- 90-day window only
  AND e.event_name = 'session_start'
GROUP BY 1, 2, 3;
```

When querying a materialized view, BigQuery returns the cached result first. If the base table changes (new events arrive), BigQuery calculates the delta in the background. Dashboard queries now run in 0.2 seconds with $0 compute cost (cache hit). However, note: the materialized view itself incurs storage cost (BigQuery storage: $0.02/GB/month), and a 90-day cohort table of 12GB adds $0.24 monthly storage.

**Tradeoff matrix:**

| Method | First Query Latency | Dashboard Query Latency | Monthly Compute Cost | Monthly Storage Cost |
|--------|---------------------|------------------------|----------------------|----------------------|
| Naive JOIN | 12s | 12s | $144,000 | $0 |
| dbt Incremental | 4s (initial batch) | 2s (snapshot read) | $0.48 | $0.18 (snapshot table) |
| Materialized View | 8s (initial build) | 0.2s (cache hit) | $0 (auto-refresh) | $0.24 |

In production, combining both is ideal: **dbt incremental models** update historical cohorts daily, while **materialized views** keep the last 7 days real-time.

## Partitioning and Clustering: Cutting Query Cost by 97%

Without partitioning and clustering your cohort tables, BigQuery scans the entire table per query. On a 1TB cohort table (2 years of data), a single "show me January 2026 cohort" query scans 1TB and charges $5. Partition + cluster on the same query scans 8GB and costs $0.04.

**Partitioning strategy:** Daily partitions by `cohort_date`. When BigQuery detects a partition filter in your query, it scans only relevant partitions.

```sql
CREATE OR REPLACE TABLE `project.dataset.cohort_retention`
PARTITION BY cohort_date
CLUSTER BY day_n, metric_name
AS
SELECT * FROM `project.dataset.cohort_retention_temp`;
```

**Clustering:** Within each partition, specifying frequently-filtered columns (e.g., `day_n`, `metric_name`) as clustering keys enables block-level pruning. A query for "day_7 retention + active_users metric" scans only relevant blocks.

Concrete example: 365 partitions (daily), each 3GB, without clustering a "day_7" filter scans 365 partitions × 3GB = 1TB. With clustering, only `day_n=7` blocks are read, totaling 12GB. Cost difference: $5 → $0.06.

**Anti-pattern:** Don't cluster by `user_id`. Cohort analysis is cohort-level aggregation, not user-level. Clustering by `user_id` doesn't help the query planner and actually reduces cache efficiency.

## Identity Resolution for Cohort Accuracy

Cohort analysis accuracy depends on `user_id` precision. When an anonymous cookie session and a post-login session belong to the same user, a naive JOIN creates two separate cohort records. Solve this with [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/en/firstparty): build an identity graph linking anonymous `client_id` to authenticated `user_id`.

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

Without identity resolution, cohorts inflate by 12–18% (one user recorded under two different IDs). This error distorts retention metrics: cohort size in the denominator inflates while day_n activity stays constant, making retention appear artificially low.

## Query Cost Monitoring: Production Oversight with INFORMATION_SCHEMA

After cohort architecture is in place, continuous query cost optimization must run. BigQuery's `INFORMATION_SCHEMA.JOBS` table exposes every query's scanned bytes, slot consumption, and total cost.

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

This query lists cohort table queries from the last 7 days, ranked by cost. If a dashboard panel fires 500 times daily and scans 80GB each time (missing partition filter), that's 500 × 80GB × $5/TB = $200 daily cost. Adding `WHERE cohort_date >= CURRENT_DATE() - 30` to that panel's query drops cost to $6.

**Production checklist:**
- [ ] All cohort tables partitioned by `cohort_date`?
- [ ] `day_n` and `metric_name` clustered?
- [ ] dbt incremental job running daily?
- [ ] Materialized view constrained to 90-day window?
- [ ] Dashboard queries include `WHERE cohort_date >= ...` filters?
- [ ] Weekly cost reports pulled via `INFORMATION_SCHEMA`?

When cohort architecture is built correctly, retention analysis becomes dashboard-ready: 100M daily events, 5-second query latency, $10 monthly compute cost. But this architecture requires first-party identity resolution, standardized event schema, and dbt pipeline discipline—retention engineering is a platform practice, not a one-off SQL exercise.