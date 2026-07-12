---
title: "Cohort Table Architecture: Scaling Retention Analysis in Production"
description: "How do you scale cohort analysis in production with materialized views, partitioning, and query cost optimization? Concrete table architecture on BigQuery and dbt."
publishedAt: 2026-07-12
modifiedAt: 2026-07-12
category: data
i18nKey: data-007-2026-07
tags: [cohort-analysis, bigquery, materialized-views, query-optimization, retention]
readingTime: 8
author: Roibase
---

Retention analysis is one of the most critical metrics in marketing data. Understanding which user cohorts stay longest and which campaigns create lasting value requires cohort tables. The problem: classic cohort queries run against tens of millions of rows of event data from scratch each time, driving query costs astronomical. Building a cohort architecture in production—updated every morning, returning results in 3 seconds when an analyst queries it, yet minimizing costs through proper partitioning strategy—is an engineering problem in its own right. In this article, we walk through a concrete cohort table architecture on BigQuery and dbt, materialized view strategy, and query cost optimization step by step.

## Why cohort deserves its own table

You cannot calculate retention from raw event tables on each query. If an e-commerce company has 50 million daily events, answering "What's the 30-day activity rate for users who signed up in January 2026?" requires BigQuery to scan 1.5 billion rows. That query takes 10–15 seconds and processes 200–300 GB. If an analyst runs 20 different cohort segments per day, monthly query cost exceeds $500.

A cohort table solves this: pre-aggregate event data by group, pre-calculate each cohort's metrics for every day, and store them. Now when an analyst queries, BigQuery only scans the cohort table, never touching raw events. 1,000 cohorts × 90 days × 5 metrics = 450,000 rows. A query against this table takes 200 ms and processes 5 MB.

But this approach creates a new problem: how is the cohort table refreshed? When new events arrive daily, do you recalculate all history? Use incremental updates? What partitioning strategy optimizes both query performance and update cost? The answers lie in materialized view and incremental dbt model design.

## Partition strategy: cohort_date or observation_date?

Choosing the partition key for your cohort table is critical. Two candidates: cohort creation date (`cohort_date`) and observation date (`observation_date`).

**`cohort_date` partition:** Partition by users' first activity date. January 2026 cohort in one partition, February in another. Advantage: when a new cohort forms, you write only to that partition, leaving old partitions untouched. Disadvantage: retrieving 90 days of retention data for the same cohort forces BigQuery to scan 90 partitions. Query performance suffers.

**`observation_date` partition:** One partition per day. On July 12, the July 12 partition holds all cohorts' metrics for that day. Advantage: queries like "7-day retention trend" scan only 7 partitions. Disadvantage: you must update all cohorts daily; incremental update cost is high.

The right answer is **hybrid architecture with two tables:** a "snapshot table" (`observation_date` partitioned) and an "aggregated table" (`cohort_date` partitioned). The snapshot table updates daily and feeds dashboards. The aggregated table updates weekly for deep cohort comparisons. This design aligns with BigQuery best practices: narrow and wide table separation.

```sql
-- Snapshot table schema (observation_date partitioned)
CREATE TABLE `analytics.cohort_retention_snapshot`
PARTITION BY observation_date
CLUSTER BY cohort_date, channel, device_category
AS
SELECT
  observation_date,
  cohort_date,
  channel,
  device_category,
  cohort_size,
  day_n,
  active_users,
  retention_rate
FROM ...
```

## Materialized view vs incremental model tradeoff

BigQuery materialized views (MV) auto-refresh incrementally—when new events arrive, the base query reruns and results cache. But MVs have three constraints: join limit (max 5), no window functions, and no manual partition control.

Cohort calculation usually involves 3+ joins (users, events, subscriptions tables) and needs window functions like `LAG()` and `FIRST_VALUE()`. MVs won't work here. Alternative: dbt incremental model.

A dbt incremental model lets you define custom merge strategy. Each day, you update only the last 7 days' partitions (`WHERE observation_date >= CURRENT_DATE() - 7`). This approach cuts query cost by 85%. Example dbt model:

```sql
{{ config(
    materialized='incremental',
    partition_by={
      "field": "observation_date",
      "data_type": "date"
    },
    cluster_by=['cohort_date', 'channel'],
    incremental_strategy='insert_overwrite'
) }}

WITH daily_cohorts AS (
  SELECT
    DATE(first_seen_at) AS cohort_date,
    user_id,
    acquisition_channel AS channel
  FROM {{ ref('users') }}
  WHERE first_seen_at IS NOT NULL
),

daily_activity AS (
  SELECT
    DATE(event_timestamp) AS activity_date,
    user_id,
    COUNT(*) AS event_count
  FROM {{ ref('events') }}
  WHERE event_name IN ('page_view', 'purchase')
  {% if is_incremental() %}
    AND DATE(event_timestamp) >= CURRENT_DATE() - 7
  {% endif %}
  GROUP BY 1, 2
)

SELECT
  a.activity_date AS observation_date,
  c.cohort_date,
  c.channel,
  DATE_DIFF(a.activity_date, c.cohort_date, DAY) AS day_n,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT a.user_id) AS active_users,
  SAFE_DIVIDE(COUNT(DISTINCT a.user_id), COUNT(DISTINCT c.user_id)) AS retention_rate
FROM daily_cohorts c
LEFT JOIN daily_activity a
  ON c.user_id = a.user_id
WHERE a.activity_date >= c.cohort_date
{% if is_incremental() %}
  AND a.activity_date >= CURRENT_DATE() - 7
{% endif %}
GROUP BY 1, 2, 3, 4
```

When this model runs daily, it overwrites only the last 7 days' partitions. BigQuery processing cost drops from 20 GB daily to 2 GB. Annual query cost savings: $2,400.

### Clustering key selection

Partitioning alone isn't enough; clustering matters too. Your cohort table filters on three dimensions: cohort_date (time), channel (source), device_category (device). In BigQuery, clustering key order matters: put the highest-cardinality field first.

Cardinality analysis:
- `cohort_date`: 365 values (1 year)
- `channel`: 15–20 values (organic, paid_search, social, email…)
- `device_category`: 3–4 values (desktop, mobile, tablet)

Correct order: `CLUSTER BY cohort_date, channel, device_category`. This ordering accelerates queries like "30-day retention for mobile users from Instagram in Q4 2025" by 10x.

## Query cost optimization: pre-aggregation depth level

The granularity level of your cohort table determines the cost–performance balance. Do you store separate rows for each cohort × channel × device combination, or just overall totals?

**Option 1: Granular table**—every cohort × channel × device × day_n combination as a separate row. Total rows: 365 cohorts × 20 channels × 4 devices × 90 days = 2.6 million rows. Advantage: analysts can pivot on any segment. Disadvantage: higher storage cost ($50/TB → ~$0.15/month).

**Option 2: Aggregated table**—only cohort × day_n, no channel or device breakdown. Total rows: 365 × 90 = 32,850. Advantage: minimal storage and query cost. Disadvantage: no channel breakdown possible.

The right approach is **two-level tables:** core metrics granular (with channel and device breakdown) for dashboards, extended metrics aggregated (only cohort_date × day_n) for ad-hoc analysis. This optimizes storage while preserving analytical flexibility.

Also define BigQuery partition expiration policies: automatically delete partitions older than 90 days. Retention analysis rarely looks beyond 90 days; this policy cuts annual storage cost by 60%.

## Solving identity resolution at the cohort level

The darkest corner of cohort analysis: user_id collisions and identity resolution. If a user signs up on desktop but transacts on mobile, two user_ids form. If the cohort table doesn't unify them, retention calculates 20% lower.

Solution: before building the cohort table, merge in your identity graph. The `canonical_user_id` column from your [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/de/firstparty) process enters here. In your dbt model, use a `users_unified` view instead of raw `users`.

```sql
WITH unified_users AS (
  SELECT
    canonical_user_id,
    MIN(first_seen_at) AS cohort_date,
    ARRAY_AGG(DISTINCT acquisition_channel IGNORE NULLS ORDER BY first_seen_at LIMIT 1)[OFFSET(0)] AS channel
  FROM {{ ref('users_unified') }}
  GROUP BY 1
)
```

This approach calculates cross-device retention correctly. In production, it creates a 15–25% retention difference. When your identity resolution table updates, the cohort table must rematerialize—so declare the dependency in your dbt DAG:

```yaml
models:
  - name: cohort_retention_snapshot
    config:
      materialized: incremental
    depends_on:
      - ref('users_unified')
```

## Production checklist: monitoring and alerting

When your cohort table goes to production, continuously monitor three metrics:

1. **Freshness:** When was the last partition updated? Define a `freshness` test in dbt-core; if a partition is older than 24 hours, send a Slack alert.
2. **Row count drift:** If today's cohort_size differs 30% from yesterday's, your data pipeline has a problem. Use a BigQuery scheduled query to check `STDDEV()`.
3. **Query cost spike:** If average cost for queries against the cohort table jumps from $0.01 to $0.10, partition pruning isn't working. Check the INFORMATION_SCHEMA.JOBS table.

Build a Google Cloud Monitoring dashboard for these three metrics. When thresholds breach, trigger PagerDuty integration. Production cohort architecture is not "build and forget"—it requires continuous monitoring.

When cohort table architecture is built correctly, retention analysis becomes an engineering product: it updates every morning, analysts extract insights in 3 seconds, query costs are predictable. BigQuery partition strategy, dbt incremental models, and identity resolution integration are the three pillars of this architecture. Scaling retention analysis in production demands technical depth—but the payoff is measurable: $5,000+ annual query cost savings and 20% more accurate retention metrics.