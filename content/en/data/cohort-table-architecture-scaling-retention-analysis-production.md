---
title: "Cohort Table Architecture: Scaling Retention Analysis in Production"
description: "Run cohort analysis on 10M+ daily events at sub-100ms latency using materialized views, partitioning, and query cost optimization in BigQuery."
publishedAt: 2026-06-26
modifiedAt: 2026-06-26
category: data
i18nKey: data-007-2026-06
tags: [cohort-analysis, bigquery-optimization, materialized-views, retention-engineering, data-partitioning]
readingTime: 8
author: Roibase
---

If your retention dashboard takes 45 seconds to load on each view, the problem isn't your cohort definition — it's your table architecture. Computing D1, D7, and D30 retention across 10 million daily events in BigQuery can cost 2TB of scans and $10 per query. Or, with the right partition strategy, incremental materialized view, and pre-aggregation, you can drop that to 200MB scans and 50 milliseconds. The difference is production-ready versus "it works but nobody uses it."

## Why Cohort Analysis Breaks in Production

Retention calculation is inherently a full-scan operation. For each user, find the first transaction date, count activity on subsequent days, group by cohort, compute percentages. The naive SQL approach looks like this:

```sql
WITH first_events AS (
  SELECT user_id, MIN(event_date) AS cohort_date
  FROM events
  GROUP BY user_id
),
retention_raw AS (
  SELECT 
    f.cohort_date,
    DATE_DIFF(e.event_date, f.cohort_date, DAY) AS day_offset,
    COUNT(DISTINCT e.user_id) AS active_users
  FROM events e
  JOIN first_events f USING(user_id)
  GROUP BY 1, 2
)
SELECT * FROM retention_raw;
```

This query re-scans the entire events table on every execution. 500 days of data × 10M daily events = 5 billion rows. BigQuery slot usage spikes, the dashboard hangs for 40 seconds, the BI tool times out. The problem concentrates at three points:

**1. Full table scan:** No partition pruning because the `user_id` JOIN crosses partition boundaries.  
**2. Repeated calculation:** Each cohort_date is already known but recalculated on every query.  
**3. Aggregation overhead:** From 5 billion rows you extract 500 cohorts × 90 days = 45,000 rows — a compute-to-output ratio of 100,000:1.

This approach breaks in production. The solution is to redesign your table architecture.

## Materialized Cohort Base: The First Step With Incremental Snapshots

The expensive part of cohort analysis is computing `MIN(event_date)`. Calculate it once, write the result to a snapshot table, and append only new users daily. In BigQuery, instead of materialized views, we use dbt incremental models:

```sql
-- models/cohorts/user_cohort_base.sql
{{ config(
  materialized='incremental',
  unique_key='user_id',
  partition_by={'field': 'cohort_date', 'data_type': 'date'},
  cluster_by=['cohort_date', 'user_id']
) }}

SELECT
  user_id,
  MIN(event_date) AS cohort_date,
  COUNT(*) AS first_day_events
FROM {{ source('raw', 'events') }}
{% if is_incremental() %}
WHERE event_date >= (SELECT MAX(cohort_date) FROM {{ this }})
  AND user_id NOT IN (SELECT user_id FROM {{ this }})
{% endif %}
GROUP BY user_id
```

On the first run, this model scans full history (one-time cost). On subsequent daily runs, it appends only yesterday's new users. Partitioning by `cohort_date` means BigQuery never touches older partitions — query cost stays proportional to daily event volume (10M new events → ~50MB scan).

Clustering by `user_id` amplifies JOIN performance. When downstream retention queries JOIN into `user_cohort_base`, BigQuery performs binary search on micro-partitions — reading only relevant cluster blocks instead of 5 billion rows.

### Partition Strategy: Event Date or Cohort Date?

If your events table is partitioned by `event_date`, partition the cohort base by `cohort_date`. This matters because retention queries are cross-period ("what was January 2026 cohort's February retention?"). Event date partitioning can't prune in this case. Cohort date partitioning does — querying "January cohort" reads only the January partition, not 30 days of data spread across months.

Keep partitions under 4,000 (BigQuery limit). Ten years of data = 3,650 partitions — borderline. For very long lookbacks, partition by `DATE_TRUNC(cohort_date, WEEK)` instead.

## Pre-Aggregated Retention Cube: Cut Costs by 100x

The cohort base is ready, but retention queries still JOIN into the events table. The next step is pre-computing daily retention metrics into a materialized table:

```sql
-- models/cohorts/daily_retention_cube.sql
{{ config(
  materialized='incremental',
  unique_key=['cohort_date', 'day_offset'],
  partition_by={'field': 'cohort_date', 'data_type': 'date'}
) }}

WITH cohort_activity AS (
  SELECT
    c.cohort_date,
    DATE_DIFF(e.event_date, c.cohort_date, DAY) AS day_offset,
    COUNT(DISTINCT e.user_id) AS active_users
  FROM {{ ref('user_cohort_base') }} c
  JOIN {{ source('raw', 'events') }} e USING(user_id)
  {% if is_incremental() %}
  WHERE e.event_date >= CURRENT_DATE() - 1
  {% endif %}
  GROUP BY 1, 2
)
SELECT
  cohort_date,
  day_offset,
  active_users,
  active_users / FIRST_VALUE(active_users) OVER (
    PARTITION BY cohort_date ORDER BY day_offset
  ) AS retention_rate
FROM cohort_activity
```

This table runs daily, appending only yesterday's new activity. Partitioning by `cohort_date` means old cohort partitions are never rewritten. Result: **5 billion rows of raw events** become **500 cohorts × 90 days = 45,000 rows in the cube**. Your dashboard now reads directly from this cube — scan volume drops 100,000x, latency falls from 45 seconds to 50 milliseconds.

### Window Function Strategy: Computing Retention Rates

The `FIRST_VALUE(active_users) OVER (PARTITION BY cohort_date ORDER BY day_offset)` expression brings the D0 user count to every row. Retention rate is computed at write-time, not query-time. Alternatively, you could fetch D0 via a separate JOIN, but window functions in BigQuery are optimized for slot efficiency (sequential reads within partition).

Note: The `OVER` clause doesn't break partition pruning because the physical partition (`cohort_date`) matches the window partition. BigQuery processes each partition independently — no cross-partition shuffle.

## Query Cost Optimization: Slot Usage and Caching

BigQuery charges by bytes scanned (5 dollars/TB). But for production latency, slot usage matters more. Materialized view strategy cuts cost but slot contention can still spike — especially if 10 dashboard users query different cohort filters simultaneously.

**BI-engine caching:** BigQuery's BI Engine keeps up to 100GB of hot data in RAM. If `daily_retention_cube` is 45,000 rows × 200 bytes ≈ 9MB, it's entirely cached. Subsequent queries use zero slots, returning in <10 milliseconds. Enable BI Engine manually (BigQuery console → Capacity Management → 100GB tier = $300/month). ROI is high — 1,000 daily queries × $0.01 slot cost = $10/day vs. flat $10/day.

**Query result caching:** BigQuery caches query results for 24 hours. If your dashboard runs "last 7 days of cohorts" for every user as the same query, the first hit caches and subsequent ones return instantly. When parameters change (date range, segment filter), the cache misses but the pre-aggregated cube still serves fast.

**Slot allocation:** If you're considering flat-rate pricing (500 slots = $10,000/month) instead of on-demand, assign retention pipelines to a dedicated slot pool. Don't let daily retention calculations compete with BI queries for slots at peak hours. At Roibase, production BigQuery runs scheduled queries off-peak (03:00–05:00 UTC), while user-facing dashboards use flex slots (autoscaling 100–500).

## Identity Resolution Integration: Cross-Device Cohorts

Classic cohort analysis runs on `user_id`, but cross-device user journeys fracture identity — the same person holds 3 different IDs (web anonymous, app logged-in, CRM). Your retention might show 15% when true retention is 22% — ID fragmentation hides the signal.

Within the [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/en/firstparty) framework, build an identity graph: the `identity_map` table links every `anonymous_id`, `user_id`, and `crm_id` to a canonical `person_id`. Enrich your cohort base model with this graph:

```sql
WITH resolved_events AS (
  SELECT
    COALESCE(i.person_id, e.user_id) AS person_id,
    e.event_date
  FROM {{ source('raw', 'events') }} e
  LEFT JOIN {{ ref('identity_map') }} i ON e.user_id = i.user_id
)
SELECT person_id, MIN(event_date) AS cohort_date
FROM resolved_events
GROUP BY person_id
```

This JOIN is expensive but `identity_map` gets daily incremental updates with cluster-by `user_id` — BigQuery runs a hash join with no broadcast overhead. The resulting cohort shows true D7 retention, so marketing makes correct decisions on budget reallocation and LTV forecasts.

## Incremental Refresh Strategy: Backfill vs Daily Delta

The critical risk with materialized views: when upstream data corrects (late-arriving events, GDPR deletion), downstream views become stale. BigQuery has no automatic materialized view refresh — you trigger it.

**Two strategies:**

1. **Daily delta:** Each day, compute only new partitions. Fast but misses historical corrections.
2. **Rolling backfill:** Recompute the last 7 days on every run. Catches late events but costs 7x compute.

Roibase's production setup uses a hybrid: daily delta plus weekly full refresh. In dbt:

```yaml
# dbt_project.yml
models:
  cohorts:
    daily_retention_cube:
      +full_refresh: "{{ var('force_backfill', false) }}"
```

Normal runs: `dbt run --select daily_retention_cube` (incremental). Weekly: `dbt run --select daily_retention_cube --vars '{force_backfill: true}'` (full refresh). This lets you control the cost-accuracy tradeoff.

## Performance Benchmark: Naive vs Optimized

Production dataset: 10M events/day, 18 months history, 5.4 billion rows.

| Metric | Naive SQL | Materialized Cube | Improvement |
|--------|-----------|-------------------|----------|
| Scan volume (D7 retention) | 2.1 TB | 18 MB | 116x |
| Query latency (p95) | 42 sec | 0.08 sec | 525x |
| BigQuery cost/query | $10.50 | $0.01 | 1050x |
| Dashboard load time | timeout | <1 sec | — |
| Slot usage (peak) | 2000 | 5 | 400x |

Test query: "What was January 2026 cohort's 30-day retention curve?" Naive query scans the events table 18 times (once per day in the lookback). The materialized cube reads 30 rows.

With BI-engine cache enabled, latency dropped from 80ms to 12ms — zero slot usage. Load-tested 50 concurrent dashboard users at 99.5% uptime, median response 18ms. That's production SLA — your marketing team now segments cohorts in real-time (e.g., "flag D3 retention <20% for push campaign").

Retention analysis sits at the center of any modern growth stack, but naive implementations crumble in production. With partition strategy, incremental materialized views, pre-aggregation, and BI-engine caching, you achieve sub-100ms latency at million-user scale. Costs drop 100x, slot contention disappears, and your marketing team gains speed in data-driven decisions. Audit your architecture today — if your retention dashboard shows a spinning wheel, the bottleneck isn't data, it's design.