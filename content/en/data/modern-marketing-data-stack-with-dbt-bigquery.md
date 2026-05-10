---
title: "Modern Marketing Data Stack with dbt + BigQuery"
description: "Four-layer architecture connecting marketing data to decision-making: source mapping, modeling layer, semantic layer, and exposures that transform raw events into trusted metrics."
publishedAt: 2026-05-10
modifiedAt: 2026-05-10
category: data
i18nKey: data-002-2026-05
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 7
author: Roibase
---

Marketing teams have access to more data than ever, yet decisions remain forecast-driven. Reports scattered across spreadsheets, metrics that differ between dashboards, three different answers to "what's our real CAC?" The problem isn't data scarcity—it's loss of signal between source and insight. The dbt + BigQuery combination builds the architecture that eliminates this loss: source mapping collects raw data, modeling layer transforms it into business logic, semantic layer establishes a single shared language, and exposures put it into production use.

## Source Mapping: From Raw Data to Trusted Source

Source mapping is dbt's first layer—the initial transformation after you've ingested marketing data into BigQuery. Raw events from Google Ads API, Meta Ads, Shopify get standardized in the staging layer. Your `stg_google_ads__campaign_performance` model has 127 columns but you use 12. Source mapping selects those 12, converts timestamps to UTC, casts campaign_id to string, handles nulls, and produces a clean table.

In BigQuery, source definition lives in `sources.yml`. You define freshness checks here—if Google Ads data hasn't arrived in the last 2 hours, dbt run fails. This enforced contract makes your data pipeline reliable. Instead of selecting directly from source, you use the `{{ source('google_ads', 'campaign_stats') }}` macro—dbt's lineage graph shows which raw table feeds which model.

```yaml
sources:
  - name: google_ads
    database: production
    schema: raw_google_ads
    tables:
      - name: campaign_stats
        freshness:
          warn_after: {count: 2, period: hour}
          error_after: {count: 6, period: hour}
        columns:
          - name: campaign_id
            tests:
              - not_null
              - unique
```

## Modeling Layer: Turning Business Logic into Code

After staging come intermediate and mart layers—where business logic applies to marketing data. In your `int_campaign_attribution` model, you calculate first-touch and last-touch attribution. The `fct_customer_lifetime_value` table handles cohort-based LTV analysis. These models use dbt's incremental materialization—each run processes only the last 3 days, older records untouched. Your 40-million-row customer_event table in BigQuery runs in 2 minutes per dbt run with incremental strategy instead of full-table refreshes.

Mart layer creates business-unit-specific tables: `mart_paid_media__daily_performance`, `mart_crm__email_engagement`, `mart_finance__revenue_attribution`. These feed directly into Looker Studio, Tableau, Amplitude—everyone pulls their metric from the same source. CAC calculation stops being a debate because the `paid_media_spend / new_customers` formula lives in dbt code. It passes code review, gets tested, stays under version control.

```sql
-- models/marts/paid_media/mart_paid_media__daily_performance.sql
{{ config(materialized='incremental', unique_key='date_campaign_id') }}

with campaign_spend as (
  select
    date,
    campaign_id,
    sum(cost_micros) / 1e6 as spend
  from {{ ref('stg_google_ads__campaign_performance') }}
  {% if is_incremental() %}
    where date >= date_sub(current_date(), interval 3 day)
  {% endif %}
  group by 1, 2
),

conversions as (
  select
    date(timestamp) as date,
    campaign_id,
    count(distinct user_id) as conversions
  from {{ ref('stg_ga4__conversions') }}
  {% if is_incremental() %}
    where date(timestamp) >= date_sub(current_date(), interval 3 day)
  {% endif %}
  group by 1, 2
)

select
  c.date,
  c.campaign_id,
  c.spend,
  coalesce(cv.conversions, 0) as conversions,
  safe_divide(c.spend, nullif(cv.conversions, 0)) as cpa
from campaign_spend c
left join conversions cv using (date, campaign_id)
```

## Semantic Layer: Creating a Single Source of Truth

The semantic layer—introduced in dbt 1.6—lets you define metrics as code that every tool consumes. `revenue` isn't just `sum(order_total)`, it's `sum(case when payment_status = 'completed' then order_total end)`. The question "are refunded orders included?" disappears because the metric definition sits on GitHub. Marketing, finance, and product teams use the same `revenue` metric—they just slice it by different dimensions.

In Roibase's [first-party data and measurement architecture](https://www.roibase.com.tr/en/firstparty) work, semantic layer is a mandatory step. When merging customer events from different touchpoints without pinned metric definitions, every analysis produces different results. In dbt, metrics defined in `metrics.yml` get exposed to BI tools via API—Looker, Hex, Mode fetch metrics from the semantic layer, the same number appears everywhere.

```yaml
# models/metrics/metrics.yml
metrics:
  - name: marketing_qualified_leads
    label: Marketing Qualified Leads
    model: ref('fct_leads')
    calculation_method: count_distinct
    expression: lead_id
    timestamp: created_at
    time_grains: [day, week, month]
    dimensions:
      - utm_source
      - utm_campaign
      - landing_page
    filters:
      - field: lead_status
        operator: '='
        value: "'MQL'"
```

## Exposures: Moving to Production

Exposures are dbt's downstream dependency tracking—you define which dashboard consumes which dbt model. Your "Weekly Campaign Performance" dashboard in Looker pulls from `mart_paid_media__daily_performance`. Document this dependency in `exposures.yml`. Now when you make a breaking change to `mart_paid_media__daily_performance`, dbt warns you: "This model powers 3 dashboards—run impact analysis first."

Exposures also appear in documentation—click a model in dbt docs and see "Used in 5 dashboards, 2 reverse ETL jobs, 1 ML pipeline." Data lineage extends to the BI layer. You know which SQL powers which dashboard in production. Debug time shrinks because you find the broken dashboard, trace it to the source model in seconds.

| Exposure Type | Use Case | Tracking Method |
|---|---|---|
| Dashboard | Looker, Tableau, Metabase | URL + model ref |
| Reverse ETL | Census, Hightouch | Job ID + source table |
| ML Pipeline | Vertex AI, SageMaker | Model name + feature table |
| Operational Tool | Braze, Iterable campaign segment | Segment ID + dbt model |

## Pipeline Orchestration: Orchestrating Each Layer

Use dbt Cloud Scheduler or Airflow to orchestrate your pipeline. Raw data loads to BigQuery at 6:00 AM (via Fivetran, Stitch, Airbyte). dbt run starts at 6:30. Staging models finish in 5 minutes, intermediate in 10, marts in 15. Semantic layer exposes at 7:00, Looker dashboards refresh by 7:15. Your team arrives at 9:00 AM to yesterday's data—no 3-hour pipeline lag.

Test suite runs on every execution: `not_null`, `unique`, `accepted_values`, `relationships`. If `campaign_id` isn't unique in `stg_google_ads__campaign_performance`, dbt run fails. Slack alerts fire. Data quality gate enforces at code level. Broken data never reaches production.

```yaml
# dbt_project.yml on-run-end hooks
on-run-end:
  - "{{ log_dbt_results() }}"
  - "{{ send_slack_notification() }}"
  - "{{ update_looker_cache() }}"
```

## Tradeoff: Complexity vs Governance

dbt + BigQuery stack introduces complexity. SQL fluency becomes non-negotiable in the analyst team—"let me pivot this in Excel" no longer cuts it. Git workflows, code review, CI/CD pipelines are now required knowledge. Small teams may find this overhead costly. But the tradeoff is clear: you gain governance. Instead of formulas lost in spreadsheets, you have version-controlled code. "Where does this number come from?" gets answered in 10 seconds via Git blame.

BigQuery costs are another tradeoff. Full table scans are expensive—partition and cluster strategy becomes mandatory. In dbt incremental models, `partition_by` and `cluster_by` configs are critical. A pipeline processing 100 GB monthly in BigQuery costs roughly $50 for reserved slots plus $5 for storage. As a managed service there's no infrastructure overhead, but unoptimized queries balloon the bill.

Connecting marketing data to decision-making can't be solved with spreadsheets and BI tools anymore. The dbt + BigQuery stack codifies every layer from source to exposure. Source mapping makes raw data trustworthy, modeling layer applies business logic, semantic layer establishes shared language, exposures move it to production. Code review, testing, version control—data pipelines now follow software engineering discipline.