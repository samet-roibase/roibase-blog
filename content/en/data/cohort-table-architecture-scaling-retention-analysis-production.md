---
title: "Cohort Table Architecture: Scaling Retention Analysis in Production"
description: "Learn how to scale cohort analysis tables in production using materialized views, partitioning, and query cost optimization techniques."
publishedAt: 2026-07-28
modifiedAt: 2026-07-28
category: data
i18nKey: data-007-2026-07
tags: [cohort-analysis, bigquery, materialized-views, data-engineering, retention]
readingTime: 8
author: Roibase
---

Every organization running retention analysis hits the same wall: cohort queries either take 30 seconds in production or push BigQuery bills toward $8,000/month. A `GROUP BY user_id, cohort_week` query that runs beautifully in staging with 100K users collapses when it meets 50M users and two years of event logs. The solution isn't simple—adding an index or enabling caching won't cut it. You need to redesign your table architecture from scratch around retention workloads.

## Why Cohort Analysis Demands a Different Architecture

A classical event log table is built on `user_id`, `event_time`, `event_name`. Every cohort query scans billions of rows historically, grouping users by their first event date. In BigQuery, this query looks like:

```sql
WITH cohorts AS (
  SELECT user_id, DATE_TRUNC(MIN(event_time), WEEK) AS cohort_week
  FROM events
  GROUP BY user_id
),
retention AS (
  SELECT 
    c.cohort_week,
    DATE_DIFF(DATE_TRUNC(e.event_time, WEEK), c.cohort_week, WEEK) AS weeks_since_cohort,
    COUNT(DISTINCT e.user_id) AS active_users
  FROM cohorts c
  JOIN events e ON c.user_id = e.user_id
  GROUP BY 1, 2
)
SELECT * FROM retention ORDER BY 1, 2;
```

Every time this runs, it reads the entire `events` table. 500M rows × 16 bytes average = 8 GB scan. At $6.25 per TB in BigQuery, 1,000 queries = $50. If your dashboard refreshes every 5 minutes, that's 8,640 queries per month = $432 just for the cohort widget. Add 10 more analysts to the team, throw in Slack bots triggering queries, and costs multiply.

But cost isn't even the real problem—it's latency. A JOIN across 500M rows takes 15–30 seconds. A user changes a dashboard filter, waits 20 seconds for new cohort data. Retention analysis can't be iterative under that delay.

### Materialized Views: A Start, But Not Enough

BigQuery materialized views pre-compute your cohort query:

```sql
CREATE MATERIALIZED VIEW cohort_retention AS
SELECT 
  cohort_week,
  weeks_since_cohort,
  active_users
FROM retention; -- result of the CTE query above
```

Now your dashboard reads `cohort_retention`, not `events`. Scan drops from 8 GB to 80 MB. Latency drops from 20 seconds to 800 ms. But two limits appear:

1. **Refresh cost:** Every materialized view refresh runs the base query. That's 8 GB scan again. If you refresh hourly, 24 × 8 GB = 192 GB/day = 5.8 TB/month. Cost didn't drop, latency did.
2. **Flexibility:** Materialized views are static. A user filters for "Android cohort retention" and the view needs to recalculate. You can't pre-filter without creating a separate view for each segment.

That's why cohort architecture must be three-layered: raw events → cohort assignment table → aggregated retention table.

## Separating the Cohort Assignment Table

First step: create a dedicated table that assigns every user to their cohort. It holds only `user_id` and `cohort_week`, derived from events but calculated once per day:

```sql
CREATE OR REPLACE TABLE cohort_assignments
PARTITION BY cohort_week
CLUSTER BY user_id
AS
SELECT 
  user_id,
  DATE_TRUNC(MIN(event_time), WEEK) AS cohort_week,
  MIN(event_time) AS first_seen_at
FROM events
WHERE event_time >= '2024-01-01'
GROUP BY user_id;
```

This table:
- **Partition by cohort_week:** BigQuery creates separate file blocks for each week. A filter like `WHERE cohort_week = '2026-01-05'` only reads one partition.
- **Cluster by user_id:** Within each partition, rows are sorted by user_id. JOINs accelerate.
- **Size:** 50M users × 3 columns × 16 bytes = ~2.4 GB. If the event log is 500 GB, this cohort table is 200× smaller.

Now your retention query uses this table:

```sql
SELECT 
  c.cohort_week,
  DATE_DIFF(DATE_TRUNC(e.event_time, WEEK), c.cohort_week, WEEK) AS weeks_since,
  COUNT(DISTINCT e.user_id) AS active_users
FROM cohort_assignments c
JOIN events e ON c.user_id = e.user_id
WHERE c.cohort_week >= '2026-01-01'
GROUP BY 1, 2;
```

With partition pruning, `cohort_assignments` reads 4 weeks of data = 200 MB. The JOIN still scans `events`, but it starts from a filtered state—no unnecessary users.

### Incremental Updates

The `cohort_assignments` table refreshes daily but doesn't recalculate from scratch each time. Use a dbt incremental model:

```sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'cohort_week', 'data_type': 'date'},
    cluster_by=['user_id']
  )
}}

SELECT 
  user_id,
  DATE_TRUNC(MIN(event_time), WEEK) AS cohort_week,
  MIN(event_time) AS first_seen_at
FROM {{ ref('events') }}
{% if is_incremental() %}
  WHERE event_time > (SELECT MAX(first_seen_at) FROM {{ this }})
{% endif %}
GROUP BY user_id
```

On the first run, the model processes all data. On subsequent runs, it only adds new users. Scan drops from 500 GB to ~2 GB per day.

## The Aggregated Retention Table: Pre-Compute Week-Level Metrics

The cohort assignment table speeds up retention queries, but your dashboard still JOINs `events` on every request. One more step: pre-compute retention metrics at the weekly level and store them separately.

```sql
CREATE TABLE cohort_retention_weekly
PARTITION BY cohort_week
CLUSTER BY weeks_since_cohort
AS
SELECT 
  c.cohort_week,
  DATE_DIFF(DATE_TRUNC(e.event_time, WEEK), c.cohort_week, WEEK) AS weeks_since_cohort,
  COUNT(DISTINCT e.user_id) AS active_users,
  COUNT(*) AS total_events,
  APPROX_QUANTILES(session_duration, 100)[OFFSET(50)] AS median_session_duration
FROM cohort_assignments c
JOIN events e ON c.user_id = e.user_id
GROUP BY 1, 2;
```

This table:
- **Size:** 52 weeks × 52 weeks_since × 3 metrics = ~8,100 rows (for 1 year of data). Kilobytes.
- **Scan:** Your dashboard reads `cohort_retention_weekly`, never touches `events`. Scan < 1 MB.
- **Latency:** BigQuery reads 1 MB in ~80 ms. Your dashboard is now sub-second.

The tradeoff: this table must refresh daily. If you need real-time data, refresh hourly (dbt schedule `0 * * * *`). Refresh cost: cohort_assignments JOINs events, ~10 GB scan. 24 times/day = 240 GB, ~7.2 TB/month. Compare: if your dashboard ran 1,000 raw cohort queries, that's 8 TB scan. So the aggregated table cut scan by ~10% while slashing latency from 20 seconds to 80 ms.

### Partitioning Strategy: Cohort Week vs Event Week

Should you partition `cohort_retention_weekly` by `cohort_week` or `event_week`? Two approaches:

**Partition by cohort_week:**
- Use case: "What's the retention curve for the 2026-W03 cohort?"
- Pruning: `WHERE cohort_week = '2026-01-13'` → reads 1 partition
- Tradeoff: Dashboard asking "total retention for the last 4 weeks?" reads 4 partitions. But most retention analysis is cohort-centric, so this is optimal.

**Partition by event_week:**
- Use case: "Which cohorts were active this week?"
- Pruning: `WHERE event_week = '2026-07-21'` → reads 1 partition
- Tradeoff: Adding a cohort filter disables partition pruning; all partitions are scanned.

At Roibase, [data analytics architectures](https://www.roibase.com.tr/en/verianalizi) partition retention tables by cohort_week, because 80% of retention queries follow the "cohort X, week N" pattern.

## Query Cost Optimization: Clustering and BI Engine

Partitioning prunes from top to bottom (which file blocks to skip), clustering sorts left to right (which rows to skip within a block). Together, they minimize scan.

```sql
CREATE TABLE cohort_retention_weekly
PARTITION BY cohort_week
CLUSTER BY weeks_since_cohort, platform, country;
```

For a query `WHERE weeks_since_cohort = 4 AND platform = 'iOS'`:
1. Partition pruning → only the relevant cohort_week partitions
2. Clustering → within each partition, first the `weeks_since_cohort = 4` rows, then `platform = 'iOS'` rows

BigQuery allows max 4 cluster columns. Order matters: put the most-filtered column first.

**BI Engine:** BigQuery's in-memory cache layer. Reserve 100 GB and frequently-accessed tables stay in RAM. If `cohort_retention_weekly` is 50 MB, it lives entirely in BI Engine. On cache hit, scan is zero. Cost: 100 GB = $100/month. Benefit: saves ~10 TB/month scan = $62.50. ROI is positive.

### Approximation Functions: When Exact Accuracy Isn't Required

Some cohort metrics must be exact (`COUNT(DISTINCT user_id)`), others can approximate (median session, percentiles).

BigQuery approximation functions:
- `APPROX_COUNT_DISTINCT(user_id)` → 2% error margin, 10× faster
- `APPROX_QUANTILES(value, 100)[OFFSET(50)]` → median, ~1% error
- `APPROX_TOP_COUNT(event_name, 10)` → top 10 events

Example: exact `COUNT(DISTINCT ...)` for 50M users takes 8 seconds. `APPROX_COUNT_DISTINCT` takes 800 ms. For dashboard real-time filters, use approximate. For final reports, exact.

## Incremental Update Strategy: Event-Time vs Processing-Time

While your cohort table updates daily, which events should it process? Two timestamps exist:

1. **event_time:** When the user actually performed the event (client-side)
2. **_PARTITIONTIME:** When BigQuery ingested it (server-side)

Incremental update using `event_time`:
```sql
WHERE event_time > (SELECT MAX(event_time) FROM cohort_assignments)
```
**Problem:** Late-arriving events. User goes offline for 3 days, event arrives via batch upload. If `event_time` is 3 days old, incremental query misses it.

Incremental update using `_PARTITIONTIME`:
```sql
WHERE _PARTITIONTIME > CURRENT_DATE() - 7
```
**Benefit:** Reprocess the last 7 days on each run; late events are caught.
**Cost:** 7 days of events = ~14 GB scan per run (vs. ~2 GB).

Tradeoff: If late events are <1%, use `event_time` for lower scan. If late events hit 5% (common in mobile), use 3-day `_PARTITIONTIME` lookback.

## Cohort Segmentation: Dynamic Filters vs Static Dimensions

A user filters the dashboard for "iOS cohort retention." Two methods:

**Method 1: Query-time filter**
```sql
SELECT cohort_week, weeks_since, active_users
FROM cohort_retention_weekly
WHERE user_id IN (SELECT user_id FROM users WHERE platform = 'iOS');
```
**Problem:** The subquery scans `users` each time. 50M users = 1 GB scan. 100 dashboard refreshes = 100 GB.

**Method 2: Pre-compute dimensions**
```sql
CREATE TABLE cohort_retention_weekly
AS
SELECT 
  c.cohort_week,
  weeks_since_cohort,
  u.platform,
  u.country,
  COUNT(DISTINCT e.user_id) AS active_users
FROM cohort_assignments c
JOIN events e ON c.user_id = e.user_id
JOIN users u ON e.user_id = u.user_id
GROUP BY 1, 2, 3, 4;
```
Now `WHERE platform = 'iOS'` filters directly on the retention table. No query-time JOIN, low latency. Table size grows: 2 columns × 10 segments = 20× larger. But no query-time penalty.

**Recommendation:** Pre-compute your top 3–4 segments (platform, country, acquisition_channel). Handle the rest with query-time filters.

---

Scaling cohort retention in production requires a three-layer architecture: assignment, aggregation, caching. With proper BigQuery partitioning and clustering, you can achieve sub-second latency on 50M users for under $200/month scan budget. The real win isn't cost—it's velocity. Retention analysis becomes iterative. Your team runs 50 cohort experiments per day.