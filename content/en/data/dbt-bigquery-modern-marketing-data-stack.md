---
title: "dbt + BigQuery for Modern Marketing Data Stack"
description: "Source mapping, modeling layer, semantic layer, exposures: transforming marketing data into a production-ready architecture that powers decision-making."
publishedAt: 2026-06-30
modifiedAt: 2026-06-30
category: data
i18nKey: data-002-2026-06
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Marketing teams still generate reports from Excel pivots, data engineers rewrite SQL for every new question, KPIs don't reconcile across departments. In 2026, tolerating this scenario is an engineering failure. The modern marketing data stack operates in three layers: raw source integration, transformation layer, semantic layer. dbt + BigQuery delivers all three at production grade — with version control, test coverage, and lineage tracking included.

## Source Mapping: Moving Raw Data to a Trusted Zone

Pulling marketing data into BigQuery's central warehouse seems straightforward: ETL tools like Fivetran, Stitch, and Airbyte write GA4, Meta Ads, and Google Ads directly to `raw_` schemas. But six months in, when the raw table's schema shifts, downstream models break. dbt's **source definitions** put this risk under control.

```yaml
# models/sources.yml
version: 2

sources:
  - name: ga4
    database: analytics_prod
    schema: raw_ga4
    tables:
      - name: events_*
        freshness:
          warn_after: {count: 6, period: hour}
          error_after: {count: 12, period: hour}
        loaded_at_field: event_timestamp
        columns:
          - name: event_name
            tests:
              - not_null
          - name: user_pseudo_id
            tests:
              - not_null
```

Source definitions serve three functions: **(1)** Alerting on upstream changes (the `freshness` metric posts to Slack), **(2)** Schema contracts (the columns list surfaces as documentation), **(3)** Lineage tracking (dbt docs shows which models depend on GA4). When Fivetran's schema changes, you'll catch it at compile time — not in production.

During source mapping, tag identity signals: `user_id`, `client_id`, `fbclid`, `gclid`, `email_sha256`. In the modeling layer, you'll stitch these signals together and map them to a single `customer_id`. Losing signals in the raw table makes that impossible later.

### Partitioned Table Strategy

GA4's `events_*` wildcard tables are daily partitions (`events_20260630`). In dbt, define the wildcard source and filter with `_TABLE_SUFFIX`:

```sql
-- models/staging/stg_ga4_events.sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'event_date', 'data_type': 'date'},
    cluster_by=['event_name', 'user_pseudo_id']
  )
}}

select
  parse_date('%Y%m%d', _table_suffix) as event_date,
  event_timestamp,
  event_name,
  user_pseudo_id,
  ...
from {{ source('ga4', 'events_*') }}
where _table_suffix >= format_date('%Y%m%d', date_sub(current_date(), interval 3 day))
{% if is_incremental() %}
  and parse_date('%Y%m%d', _table_suffix) > (select max(event_date) from {{ this }})
{% endif %}
```

This config writes `stg_ga4_events` with daily partitions in BigQuery and clusters by `event_name` + `user_pseudo_id` to cut query costs. Incremental materialization reduces 90-day history scans to 3 days — a 30× cost savings.

## Modeling Layer: Codify Business Logic

The staging layer cleans raw data, the intermediate layer builds join logic, the mart layer answers business questions. dbt separates these with folder structure: `staging/`, `intermediate/`, `marts/`.

**Staging example** — Standardize Meta Ads columns:

```sql
-- models/staging/stg_meta_ads.sql
select
  date_start as report_date,
  campaign_id,
  campaign_name,
  spend as cost_usd,
  impressions,
  clicks,
  actions.value as conversions -- extract from nested JSON
from {{ source('meta_ads', 'ads_insights') }}
where date_start >= date_sub(current_date(), interval 90 day)
```

**Intermediate example** — Unify all paid media sources:

```sql
-- models/intermediate/int_paid_media_unified.sql
with meta as (
  select report_date, campaign_id, 'meta' as source, cost_usd, impressions, clicks, conversions
  from {{ ref('stg_meta_ads') }}
),
google as (
  select report_date, campaign_id, 'google' as source, cost_usd, impressions, clicks, conversions
  from {{ ref('stg_google_ads') }}
)

select * from meta
union all
select * from google
```

**Mart example** — Daily performance dashboard:

```sql
-- models/marts/fct_daily_performance.sql
select
  report_date,
  source,
  sum(cost_usd) as total_cost,
  sum(impressions) as total_impressions,
  sum(clicks) as total_clicks,
  sum(conversions) as total_conversions,
  safe_divide(sum(clicks), sum(impressions)) as ctr,
  safe_divide(sum(cost_usd), sum(conversions)) as cpa
from {{ ref('int_paid_media_unified') }}
group by 1, 2
```

The `ref()` function builds dbt's dependency graph. The `dbt run` command executes models in dependency order. If `int_paid_media_unified` changes, all downstream marts rebuild automatically.

### Test Coverage

Serving a bad KPI report in production is a six-figure mistake in e-commerce. dbt's generic tests add contracts to every model:

```yaml
# models/marts/schema.yml
version: 2

models:
  - name: fct_daily_performance
    columns:
      - name: report_date
        tests:
          - not_null
          - unique
      - name: total_cost
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"
      - name: cpa
        tests:
          - dbt_utils.expression_is_true:
              expression: "is null or cpa >= 0"
```

The `dbt test` command validates these contracts. In the CI/CD pipeline, a failed test blocks the merge — bad data never reaches production. At Roibase, we target 85% test coverage on critical models (row count × field density metric).

## Semantic Layer: Define Metrics Once

By late 2025, dbt Labs integrated "MetricFlow," its semantic layer, into dbt Cloud. When the marketing team asks for "conversion rate," the data team shouldn't rewrite SQL — the metric definition should live in one place. dbt's `metrics.yml` file provides this abstraction:

```yaml
# models/metrics.yml
version: 2

metrics:
  - name: conversion_rate
    label: Conversion Rate
    model: ref('fct_daily_performance')
    calculation_method: derived
    expression: "safe_divide(total_conversions, total_clicks)"
    timestamp: report_date
    time_grains: [day, week, month]
    dimensions:
      - source

  - name: cpa
    label: Cost Per Acquisition
    model: ref('fct_daily_performance')
    calculation_method: derived
    expression: "safe_divide(total_cost, total_conversions)"
    timestamp: report_date
    time_grains: [day, week, month]
    dimensions:
      - source
```

The semantic layer serves two purposes: **(1)** When a metric is selected in a BI tool, SQL generates automatically (Looker, Tableau, Power BI integrations), **(2)** When a metric changes, all dashboards stay consistent. The decision to add shipping cost to CPA calculation requires one change — 40 dashboards update in one go.

MetricFlow is still beta (as of June 2026) but production-ready. An alternative: write custom metric functions as dbt macros:

```sql
-- macros/calculate_cpa.sql
{% macro calculate_cpa(cost_column, conversion_column) %}
  safe_divide({{ cost_column }}, nullif({{ conversion_column }}, 0))
{% endmacro %}
```

Call `{{ calculate_cpa('total_cost', 'total_conversions') }}` in every mart model — metric changes propagate from a single source.

## Exposures: Link Models to BI Dashboards

dbt's `exposures.yml` tracks which model feeds which dashboard. This tracking is operational — when a model changes, you know which dashboards need testing:

```yaml
# models/exposures.yml
version: 2

exposures:
  - name: executive_performance_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: "Daily paid media performance for C-level"
    depends_on:
      - ref('fct_daily_performance')
      - ref('fct_campaign_performance')
    owner:
      name: Growth Team
      email: growth@company.com

  - name: weekly_marketing_review
    type: analysis
    maturity: medium
    url: https://docs.google.com/spreadsheets/d/xyz789
    description: "Weekly deep-dive into channel mix"
    depends_on:
      - ref('fct_daily_performance')
    owner:
      name: Marketing Ops
      email: mops@company.com
```

Exposure lineage appears in the graph: after `dbt docs generate`, click on `fct_daily_performance` in the web UI to see which dashboards depend on it. Before making a breaking change to a model, you can auto-notify exposure owners via Slack webhook.

### Production Deployment Pattern

dbt Cloud production jobs run in this sequence:

1. **Source freshness check** — `dbt source freshness` (fails if upstream data lags)
2. **Model run** — `dbt run --select tag:daily` (daily models build at 07:00)
3. **Test execution** — `dbt test` (contract violations trigger rollback)
4. **Documentation update** — `dbt docs generate` (lineage graph refreshes)

Using a dbt job instead of BigQuery scheduled queries buys: version control (each deployment ties to a git commit), rollback capability (a bad model reverts in 5 minutes), Slack alerts (test failures + freshness warnings).

## Tradeoff: ELT vs. Reverse ETL

The dbt + BigQuery stack follows the ELT (extract-load-transform) pattern — raw data lands in the warehouse first, transformation happens in BigQuery. Reverse ETL (Hightouch, Census) complements this — data flows from the warehouse into SaaS tools. They're complementary: dbt cleans the warehouse, reverse ETL ships segments to Braze or Iterable.

The tradeoff: BigQuery compute cost. One terabyte scanned costs $5 — a complex mart model running 10 times daily costs $50/day, or $1,500/month. Optimization: incremental materialization + partition pruning + clustering. At Roibase, the BigQuery cost target is $0.02 per monthly active user — 1M MAU = $20K/year (acceptable).

A marketing data stack isn't a one-time project — it's an evolving architecture. After the dbt + BigQuery foundation is built, add layers for MMM (marketing mix modeling), incrementality testing, and identity resolution. Building this foundation correctly takes 6–8 weeks but saves 18 months downstream — every new KPI question gets answered in 2 hours, manual data cleaning disappears, attribution model changes take 1 hour instead of 1 day. Stack it right, and you've transformed marketing data into a decision-making engine.