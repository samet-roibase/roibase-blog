---
title: "dbt + BigQuery for Modern Marketing Data Stack"
description: "Source mapping, modeling layer, semantic layer, exposures — architecture and practical dbt implementation connecting marketing data to decision-making."
publishedAt: 2026-08-02
modifiedAt: 2026-08-02
category: data
i18nKey: data-002-2026-08
tags: [dbt, bigquery, data-stack, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Marketing teams no longer rely on canned reports from Google Analytics — they're building their own data pipelines with custom rules. In 2026, a modern marketing data stack comprises three layers: raw sources, modeling layer, and semantic layer. This article explains how to build these three layers with dbt + BigQuery, what types of errors occur at each stage, and how to establish a sustainable production structure.

## Source mapping: Uploading raw data to BigQuery isn't enough

You've loaded GA4, Meta Ads, and sGTM events into BigQuery — but that's just the beginning. Source mapping means converting raw tables into meaningful contracts. In dbt, source definitions live in `.yml` files:

```yaml
sources:
  - name: raw_ga4
    database: roibase-prod
    schema: analytics_123456789
    tables:
      - name: events_*
        identifier: events_*
        loaded_at_field: event_timestamp
        freshness:
          warn_after: {count: 12, period: hour}
```

This definition accomplishes three things: (1) Data lineage — which models use which raw tables, (2) Freshness checks — alerts if the last event is older than 12 hours, (3) Contracts — build fails if the `event_timestamp` column is missing.

**Most common mistake:** Using the raw schema as-is. Writing SQL without flattening GA4's nested `event_params` array leads to 200+ line queries per analysis. The unnest logic should live in one place during source mapping:

```sql
-- models/staging/stg_ga4_events.sql
with source as (
  select * from {{ source('raw_ga4', 'events_*') }}
),

flattened as (
  select
    event_date,
    event_timestamp,
    user_pseudo_id,
    (select value.string_value from unnest(event_params) where key = 'session_id') as session_id,
    (select value.int_value from unnest(event_params) where key = 'ga_session_number') as session_number
  from source
)

select * from flattened
```

This model is now called downstream via `ref('stg_ga4_events')` — raw event_params syntax is isolated upstream. Freshness checks run daily and throw automatic errors on schema changes.

## Modeling layer: Define a metric once, use it a hundred times

After the staging layer comes the modeling layer. Here, intermediate models (business logic) and mart models (aggregation) are separated. In a marketing data stack, the most critical model is **session → transaction** join:

```sql
-- models/marts/mrt_session_metrics.sql
with sessions as (
  select * from {{ ref('int_sessions') }}
),

transactions as (
  select * from {{ ref('int_transactions') }}
),

joined as (
  select
    s.session_id,
    s.session_date,
    s.traffic_source,
    s.medium,
    s.campaign,
    t.transaction_id,
    t.revenue,
    t.transaction_timestamp
  from sessions s
  left join transactions t
    on s.session_id = t.session_id
)

select
  session_date,
  traffic_source,
  medium,
  campaign,
  count(distinct session_id) as sessions,
  count(distinct transaction_id) as transactions,
  sum(revenue) as total_revenue,
  safe_divide(count(distinct transaction_id), count(distinct session_id)) as conversion_rate
from joined
group by 1, 2, 3, 4
```

This model runs daily at 03:00 (dbt Cloud scheduler); Looker Studio connects directly to this table. When changes are needed, you modify the SQL in one place and all dashboards update automatically.

**Important detail:** Using `safe_divide` — if sessions = 0, it returns null instead of throwing a division-by-zero error. Exception handling in production pipelines happens at this layer.

### dbt tests: Automatic data quality checks

When defining metrics in the modeling layer, you also write tests:

```yaml
# models/marts/schema.yml
models:
  - name: mrt_session_metrics
    columns:
      - name: session_date
        tests:
          - not_null
      - name: sessions
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"
      - name: conversion_rate
        tests:
          - dbt_utils.expression_is_true:
              expression: "<= 1"
```

The `dbt test` command runs these rules. If conversion_rate > 1 (indicating SQL error), the build fails and an alert goes to Slack. Automated data quality instead of manual QA — the rest of the data stack builds on this foundation.

## Semantic layer: Define the metric, not the query

With dbt v1.6+, the semantic layer graduated from beta. Now you define metrics in `.yml` files instead of SQL:

```yaml
# models/semantic/metrics.yml
metrics:
  - name: total_revenue
    label: Total Revenue
    model: ref('mrt_session_metrics')
    type: sum
    sql: total_revenue
    timestamp: session_date
    time_grains: [day, week, month]

  - name: roas
    label: Return on Ad Spend
    type: ratio
    numerator: total_revenue
    denominator: total_ad_spend
```

This definition is consumed in three places: (1) Looker Studio, (2) dbt Cloud discovery API to a Slack bot for metric queries, (3) Airflow DAGs feeding downstream ML pipelines.

**Advantage:** Metrics are consumable without writing SQL. Marketing analysts now write "Show me ROAS by campaign, last 7 days" and dbt's semantic layer compiles the query automatically. SQL logic lives in the modeling layer, metric definitions in the semantic layer — they're separate and changes are isolated.

**Caution:** The semantic layer is still new — not all BI tools have native integration yet. In Roibase's production stack, we use a hybrid approach: critical metrics in the semantic layer, custom analysis through SQL exposures.

### Exposures: Document downstream dependencies

Exposures show where dbt models are used outside of dbt:

```yaml
# models/exposures.yml
exposures:
  - name: looker_studio_performance_dashboard
    type: dashboard
    url: https://lookerstudio.google.com/...
    depends_on:
      - ref('mrt_session_metrics')
      - ref('mrt_campaign_performance')
    owner:
      name: Marketing Analytics Team
      email: analytics@roibase.com.tr
```

This definition is visualized in dbt docs — which dashboards depend on which models, and who needs to be notified when models change. In production, when you make a schema-breaking change, `dbt run --select +mrt_session_metrics+` shows downstream impacts.

**Real scenario:** GA4 changed the `event_params` key from `page_location` to `page_url`. Because of exposure definitions, we found 3 affected dashboards and 1 Airflow DAG and completed the migration in 2 hours. Without exposures, dashboards would have silently broken and we'd only learn about it from user complaints.

## Incremental models: Don't rebuild 2TB of data daily

In marketing data, daily partitions reach terabyte scale. You can't run a full refresh with every `dbt run` command — BigQuery costs and runtime become unacceptable. Use incremental models instead:

```sql
-- models/marts/mrt_user_journey.sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'event_date', 'data_type': 'date'},
    cluster_by=['user_pseudo_id', 'traffic_source'],
    incremental_strategy='insert_overwrite'
  )
}}

select
  event_date,
  user_pseudo_id,
  traffic_source,
  -- ...
from {{ ref('stg_ga4_events') }}

{% if is_incremental() %}
  where event_date >= date_sub(current_date(), interval 3 day)
{% endif %}
```

This config does three things: (1) Creates BigQuery partitions — adds new days without touching historical data, (2) Improves query performance via `cluster_by`, (3) Uses `insert_overwrite` strategy — deletes and rewrites the last 3 days to handle late-arriving data.

**Cost difference:** 365 days of data, full refresh = 2.5 TB scanned ($12.50), incremental = 3 GB scanned ($0.015). For a daily pipeline, the yearly difference is ~$4500 vs ~$5. This is why incremental models form the foundation of production stacks.

## Connecting the data stack to decision-making

dbt + BigQuery builds the infrastructure, but real value lies in impact on marketing decisions. A typical scenario is a metric flow from the semantic layer to a Slack bot:

1. Marketing manager types `/metric roas last_30_days campaign=brand` in Slack
2. Slack app calls dbt Cloud semantic layer API
3. API queries `mrt_session_metrics` table and calculates ROAS
4. Result returns to Slack: "Brand campaign ROAS: 4.2x"

This flow requires dbt semantic layer + custom Python middleware. In Roibase's production stack, an Airflow DAG captures daily semantic layer snapshots and Looker Studio and internal apps consume these snapshots — avoiding API rate limit issues.

**Alternative approach:** The hybrid stack we use in [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/en/firstparty) — dbt semantic layer + Cube.js. Cube.js adds a caching layer and improves BI performance. Choice depends on data volume and query patterns.

## Production checklist: Before deploying your dbt stack

dbt works locally — before moving to production, verify these controls:

- **CI/CD:** Every commit should run `dbt build --select state:modified+` via dbt Cloud or GitHub Actions
- **Freshness monitoring:** Define `warn_after` and `error_after` for critical sources
- **Alerting:** Set up Slack integration via dbt Cloud webhooks — team gets notified within 5 minutes of build failure
- **Documentation:** `dbt docs generate` should run automatically with artifacts pushed to S3/GCS
- **Cost monitoring:** Use BigQuery slot reservation or on-demand cost alerts — set a $500/day threshold for unexpected spikes
- **Backup strategy:** Maintain snapshot tables in production warehouse — enables rollback from incorrect model updates

**Most critical rule:** No manual `dbt run` in production. All execution flows through a scheduler (dbt Cloud, Airflow, Prefect). Manual runs break data lineage and prevent root cause analysis during failures.

dbt + BigQuery forms the backbone of modern marketing data stacks — source mapping binds raw data to contracts, the modeling layer defines metrics in one place, and the semantic layer lets non-SQL users consume metrics. In production, incremental models and test coverage make pipelines sustainable. The next layer is connecting this data to real-time activation — CDPs, audience syncing, incrementality measurement. But that's another data stack conversation.