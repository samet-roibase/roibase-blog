---
title: "dbt + BigQuery: Building a Modern Marketing Data Stack"
description: "Four-layer architecture connecting marketing data from source to exposure: source mapping, modeling layer, semantic layer, and exposures for repeatable decision-making."
publishedAt: 2026-07-17
modifiedAt: 2026-07-17
category: data
i18nKey: data-002-2026-07
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Google Analytics 4 reports show channel performance, Klaviyo tracks email volume, Meta Ads dashboard displays CPA — but can these three metrics sit side-by-side in a single SQL query? Without a unified stack, decision-making relies on guesswork. A dbt + BigQuery pipeline delivers one promise: model marketing data across four layers from source to exposure, turning "which channel drove value to which customer" into a repeatable SQL pipeline. As cookies disappear and multi-touch attribution becomes mandatory, this architecture shifts from optional tooling to operational necessity for any data-driven marketing team.

## Source mapping: Organizing raw data clusters into logical table groups

BigQuery hosts each platform in its own dataset: `ga4_export`, `facebook_ads`, `klaviyo_events`, `shopify_orders`. Their raw schemas are incompatible — GA4 returns nested JSON, Facebook API exports flat CSV, Klaviyo webhooks arrive unnormalized. dbt source mapping forms the first layer: create a YAML manifest declaring each table as a `source`, annotating data types, freshness expectations, and update frequency.

```yaml
# models/sources/marketing_sources.yml
version: 2

sources:
  - name: ga4_export
    database: roibase-analytics
    schema: analytics_123456789
    tables:
      - name: events_*
        identifier: 'events_*'
        meta:
          contains_pii: true
        freshness:
          warn_after: {count: 25, period: hour}
          error_after: {count: 49, period: hour}

  - name: facebook_ads
    schema: facebook_raw
    tables:
      - name: ads_insights
        loaded_at_field: date_start
        freshness:
          warn_after: {count: 2, period: day}
```

This manifest gives dbt two capabilities: (1) type-safe references to raw tables via the `source()` macro instead of raw table names, and (2) the `dbt source freshness` command to detect pipeline stalls. If a GA4 event hasn't updated in 49 hours, BigQuery stays silent — dbt alerts you.

During source mapping, PII annotation is mandatory. KVKK and GDPR compliance requires flagging which columns contain user identifiers, emails, or IPs. Every table holding `user_pseudo_id` or similar gets `meta.contains_pii: true`. This tag propagates through model lineage and integrates with field-level masking rules downstream in the semantic layer.

## Modeling layer: Staging → intermediate → mart progression

Staging models rename raw source columns, apply type conversions, and drop unnecessary fields, providing downstream models a standardized schema. GA4's `event_params` array needs unpacking — convert `page_location`, `session_id`, `transaction_id` from nested structure into scalar columns:

```sql
-- models/staging/ga4/stg_ga4__events.sql
with source as (
    select * from {{ source('ga4_export', 'events_*') }}
    where _table_suffix between format_date('%Y%m%d', date_sub(current_date(), interval 90 day))
                             and format_date('%Y%m%d', current_date())
),

unnested as (
    select
        event_date,
        event_timestamp,
        user_pseudo_id,
        (select value.string_value from unnest(event_params) where key = 'page_location') as page_location,
        (select value.int_value from unnest(event_params) where key = 'ga_session_id') as session_id,
        ecommerce.transaction_id,
        ecommerce.purchase_revenue_in_usd
    from source
    where event_name in ('page_view', 'purchase')
)

select * from unnested
```

Staging models carry the `stg_` prefix — downstream consumers never touch the source, everyone reads staging. Staging models can run incrementally: process only yesterday's partition, not the full 90-day history. Running `dbt build --select stg_ga4__events` completes in 30 seconds instead of minutes.

Intermediate models combine staging layers and create analytic concepts: `int_sessions`, `int_customer_cohorts`, `int_channel_attribution`. They hide implementation details. For instance, multi-touch attribution logic lives here:

```sql
-- models/intermediate/marketing/int_channel_attribution.sql
with touchpoints as (
    select
        user_id,
        session_start_timestamp,
        source_medium,
        row_number() over (partition by user_id order by session_start_timestamp) as touch_position,
        count(*) over (partition by user_id) as total_touches
    from {{ ref('stg_sessions') }}
    where user_id is not null
),

attributed as (
    select
        user_id,
        source_medium,
        case
            when touch_position = 1 then 0.4
            when touch_position = total_touches then 0.4
            else 0.2 / (total_touches - 2)
        end as attribution_weight
    from touchpoints
)

select * from attributed
```

U-shaped model — first and last touch receive 40% each, middle touches split the remaining 20%. This SQL logic lives in the intermediate model; data scientists update the file, dashboards never change. To make it parametric, define `vars.attribution_model: u_shaped` in dbt_project.yml and call `{{ var('attribution_model') }}` within the SQL.

Mart models form the final layer: the tables dashboards, BI tools, or ML pipelines query directly. They use `fct_` (fact) or `dim_` (dimension) prefixes. `fct_orders`, `dim_customers`, `fct_ad_performance`. Marts can be denormalized — absorb join overhead at build time, not query time. Instead of telling Looker "join orders to customers," `fct_orders` already contains `customer_lifetime_value` and `customer_cohort` columns.

## Semantic layer: Centralizing metric definitions and business logic

dbt 1.6+ introduced the semantic layer, translating SQL into "metrics." Previously, every dashboard wrote its own `sum(revenue)` query. Now define `revenue` once in YAML and dashboards call that metric. Metric definitions live in `metrics/` as YAML:

```yaml
# models/metrics/marketing_metrics.yml
version: 2

metrics:
  - name: total_revenue
    label: Total Revenue
    model: ref('fct_orders')
    calculation_method: sum
    expression: order_total
    timestamp: order_date
    time_grains: [day, week, month, quarter, year]
    dimensions:
      - channel
      - customer_cohort
      - product_category

  - name: customer_acquisition_cost
    label: Customer Acquisition Cost (CAC)
    calculation_method: derived
    expression: "{{ metric('total_ad_spend') }} / {{ metric('new_customers') }}"
    timestamp: order_date
    time_grains: [month, quarter]
```

With this definition, Looker queries resolve via the dbt Semantic Layer API. Instead of writing SQL, you invoke the metric. `customer_acquisition_cost` is derived — computed from two other metrics. Change the formula once; 12 dashboards update automatically.

The semantic layer's second benefit: it enforces [first-party data architecture](https://www.roibase.com.tr/en/firstparty) because metric definitions depend on customer IDs. If GA4's `user_pseudo_id` and Shopify's `customer_id` refer to the same person, identity resolution must happen in an intermediate model. A `dim_unified_customers` table merges all signals and returns a `canonical_customer_id`. That ID becomes a semantic layer dimension. Without it, CAC metrics break — the same customer gets counted twice.

## Exposures: Documenting downstream consumption points

Exposures are dbt's final concept: recording which dashboards, Airflow tasks, or machine learning models consume your pipeline. Document them as YAML:

```yaml
# models/exposures/marketing_exposures.yml
version: 2

exposures:
  - name: executive_marketing_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: "CMO dashboard: revenue, CAC, LTV by channel"
    depends_on:
      - ref('fct_orders')
      - ref('fct_ad_performance')
      - metric('total_revenue')
      - metric('customer_acquisition_cost')
    owner:
      name: Marketing Operations Team
      email: ops@roibase.com.tr

  - name: klaviyo_segment_sync
    type: application
    maturity: medium
    description: "BigQuery to Klaviyo segment sync via Hightouch"
    depends_on:
      - ref('dim_unified_customers')
    owner:
      name: CRM Automation
      email: crm@roibase.com.tr
```

With this manifest, `dbt docs generate` renders exposures as terminal nodes in your DAG. When you modify `fct_orders`, the lineage graph immediately shows which dashboard gets impacted. Exposures also enable alerting: send Slack notifications like "executive_marketing_dashboard has upstream model failures."

The maturity field tracks technical debt: `low` maturity exposures might be temporary analyses, `high` maturity ones are production-critical. The command `dbt list --select exposure:executive_marketing_dashboard+` enumerates the entire dependency tree — essential for impact analysis during model deprecation.

## Test coverage and data quality contracts

dbt's power extends beyond transformation to validation. Define tests for each model in `schema.yml`:

```yaml
# models/marts/marketing/fct_orders.yml
version: 2

models:
  - name: fct_orders
    description: "Denormalized order fact table for BI consumption"
    columns:
      - name: order_id
        description: "Primary key"
        tests:
          - unique
          - not_null

      - name: customer_id
        description: "Foreign key to dim_customers"
        tests:
          - not_null
          - relationships:
              to: ref('dim_customers')
              field: customer_id

      - name: order_total
        description: "Order total in USD"
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"

      - name: order_date
        tests:
          - not_null
          - dbt_utils.accepted_range:
              min_value: "'2020-01-01'"
              max_value: "current_date()"
```

Running `dbt test` executes these checks. If `order_total < 0` appears, the build fails and Slack gets an alert. Downstream exposures trust this contract — data quality is enforced in the pipeline, not deferred to the BI tool.

Custom tests are straightforward: drop a SQL file in `tests/`:

```sql
-- tests/assert_single_active_subscription.sql
with duplicate_subscriptions as (
    select
        customer_id,
        count(*) as active_count
    from {{ ref('fct_subscriptions') }}
    where status = 'active'
    group by 1
    having count(*) > 1
)

select * from duplicate_subscriptions
```

If this query returns rows, the test fails. Once test coverage exceeds 80%, data incident alerts drop noticeably — Roibase observed a 60% reduction in false dashboard alerts after crossing 85% test coverage.

## Pipeline orchestration and production deployment

Using dbt Cloud, define scheduled jobs: run `dbt build --select +fct_orders` daily at 04:00. Self-hosting? Add a `BashOperator` to your Airflow DAG pointing to the dbt command. dbt's incremental strategy means 90 days of data processes in 5 minutes; full refreshes become unnecessary.

CI/CD works like this: open a pull request, GitHub Actions runs `dbt build --select state:modified+` — only changed models and their downstream dependencies get tested. After merge, the build deploys to production BigQuery. Slim CI reduces PR build time to 3 minutes on a 200-model project (full build takes 40).

In production, `dbt docs generate` publishes to a static site on S3 or GCS. Version control markdown — model schema changes appear in git history. New team members read dbt docs to learn how metrics are calculated; knowledge isn't tribal.

---

dbt + BigQuery isn't the only way to connect marketing data to decision-making — but it's the most repeatable, testable, and versioned. Source mapping brings raw data under control, the modeling layer converts analytic concepts into SQL, the semantic layer centralizes metric definitions, and exposures make downstream consumption visible. With these four layers in place, "how much budget should channel X receive" becomes a query result, not a guess.