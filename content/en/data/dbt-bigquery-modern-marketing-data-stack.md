---
title: "Modern Marketing Data Stack with dbt + BigQuery"
description: "From source mapping to semantic layer: how to turn marketing data into a decision engine. dbt modeling layers, exposure definitions, and production pipeline architecture."
publishedAt: 2026-06-14
modifiedAt: 2026-06-14
category: data
i18nKey: data-002-2026-06
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

In 2026, marketing teams don't wrestle with data—they make decisions from it. GA4, Meta Ads, Google Ads, CRM, CDP, server-side GTM—each dumps into its own table. The team manually stitches data in spreadsheets, numbers shift every week, nobody trusts the source. This chaos vanishes with a modern data stack: BigQuery as the warehouse, dbt as the transformation layer, semantic layer as the metric graph. You version control your code, test every change, and metrics flow from a single source of truth. This article shows how dbt + BigQuery turns a marketing data pipeline into production-grade infrastructure.

## Source mapping: Standardizing raw data paths

dbt's first job is source mapping—fitting raw data from different systems into the same schema. In BigQuery, `analytics_123456.events_*` comes from GA4, `facebook_ads.ads_insights` from the Meta API, `crm.transactions` from Shopify. Each has a different timestamp format, different user identifier, different currency column. You define these raw tables in dbt's `sources.yml`:

```yaml
version: 2
sources:
  - name: ga4
    database: analytics_123456
    tables:
      - name: events_
        identifier: "events_*"
        loaded_at_field: event_timestamp
  - name: meta_ads
    database: facebook_ads
    schema: public
    tables:
      - name: ads_insights
        loaded_at_field: date_start
```

This definition tells dbt: "These are upstream sources, I don't own them, but I'll test their freshness." Running `dbt source freshness` checks when the last data arrived—if Meta API is delayed, an alert fires. Without source mapping, every model writes `SELECT * FROM analytics_123456.events_20260614` directly; when the table name changes, 40 models break. With mapping, the reference becomes `{{ source('ga4', 'events_') }}`, and changes propagate from a single point.

GA4 event_timestamp is Unix microseconds, Meta ads date_start is an ISO string, CRM created_at is UTC datetime—all different formats. In source mapping, you extract a standard timestamp column: `TIMESTAMP_MICROS(event_timestamp) AS event_time` for GA4, `PARSE_TIMESTAMP('%Y-%m-%d', date_start) AS event_time` for Meta. This normalization feeds clean input downstream.

## Modeling layer: Staging, intermediate, mart

dbt's power lies in layered modeling—staging, intermediate, and mart tiers. Staging models pull 1:1 from sources, only renaming and casting types. `stg_ga4_events.sql`:

```sql
SELECT
  TIMESTAMP_MICROS(event_timestamp) AS event_time,
  user_pseudo_id AS anonymous_id,
  event_name,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'session_id') AS session_id,
  geo.country,
  device.category AS device_category
FROM {{ source('ga4', 'events_') }}
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY))
  AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
```

Staging delivers clean data with no business logic. Intermediate models layer in business logic: sessionization, attribution, funnel steps. `int_sessions.sql` aggregates GA4 events to session grain:

```sql
WITH session_events AS (
  SELECT
    session_id,
    MIN(event_time) AS session_start,
    MAX(event_time) AS session_end,
    COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN event_time END) AS pageviews,
    MAX(CASE WHEN event_name = 'purchase' THEN 1 ELSE 0 END) AS converted
  FROM {{ ref('stg_ga4_events') }}
  GROUP BY session_id
)
SELECT
  *,
  TIMESTAMP_DIFF(session_end, session_start, SECOND) AS duration_seconds
FROM session_events
```

Mart models are the final consumption layer—BI tools, Looker, internal dashboards query here. `fct_marketing_performance.sql` unifies all channels, calculates spend + revenue + ROAS. Each mart focuses on one business entity: `dim_customers`, `fct_orders`, `fct_sessions`. Mart naming convention is critical—`dim_` for dimensions (customer, product), `fct_` for facts (transaction, event), `rpt_` for report aggregates.

## Semantic layer: KPI definitions as code

The semantic layer pulls metric definitions into dbt—"what is revenue," "how is CAC calculated"—no longer a spreadsheet, now YAML in your codebase. With dbt v1.6+, you build your metric graph in `metrics.yml`:

```yaml
version: 2
metrics:
  - name: revenue
    label: Revenue
    model: ref('fct_orders')
    calculation_method: sum
    expression: order_amount
    timestamp: order_date
    time_grains: [day, week, month, quarter]
    dimensions:
      - channel
      - country
      - device_category

  - name: cac
    label: Customer Acquisition Cost
    calculation_method: derived
    expression: "{{ metric('ad_spend') }} / {{ metric('new_customers') }}"
    timestamp: acquisition_date
    time_grains: [month, quarter]
```

With a semantic layer, your BI tool doesn't calculate CAC—dbt does. When Looker asks for CAC, dbt returns compiled SQL that joins spend and new customer tables, then divides. The definition is code, tracked in git history—"who changed the CAC formula and why" has an answer. The spreadsheet formula doesn't vanish; it has version control.

At Roibase, semantic layer setup is part of [data analytics & insights engineering](https://www.roibase.com.tr/en/verianalizi) scope—not just metric definitions, but KPI tree mapping, dimension hierarchy, and grain standardization. For example, "revenue" is the sum of `fct_orders.order_amount`, but "recognized_revenue" filters the same table by `recognized_at` timestamp (SaaS subscription model). One table, two metrics, different business logic.

## Exposures: Making downstream dependencies visible

An exposure answers dbt's "who uses this model" question. If a Looker dashboard queries `fct_marketing_performance`, you define it in `exposures.yml`:

```yaml
version: 2
exposures:
  - name: marketing_dashboard
    type: dashboard
    maturity: high
    owner:
      name: Growth Team
      email: growth@company.com
    depends_on:
      - ref('fct_marketing_performance')
      - ref('dim_customers')
    description: "Executive marketing dashboard — daily refresh, 90-day rolling window"
    url: https://looker.company.com/dashboards/123
```

Without exposure definitions, when you change `fct_marketing_performance`, you don't know which dashboard breaks. Looker shows zero metrics, you debug for 2 hours. With exposures, running `dbt compile --select +exposure:marketing_dashboard` shows all upstream models—impact analysis before you change anything.

Exposures aren't just BI tools—they include reverse ETL (Hightouch, Census):

```yaml
exposures:
  - name: meta_capi_sync
    type: application
    maturity: high
    depends_on:
      - ref('dim_customers')
    description: "Meta Conversion API — incremental customer events, 5-minute delay"
```

This signals: "If you change dim_customers, you'll break the schema sent to Meta CAPI." In production, model update → CAPI sync error → attribution data loss is prevented by early warning.

## Production pipeline: Incremental builds and test coverage

dbt in production doesn't run full refresh every day—it uses incremental models. `fct_orders.sql` reprocesses only the last 3 days:

```sql
{{ config(
    materialized='incremental',
    unique_key='order_id',
    partition_by={'field': 'order_date', 'data_type': 'date'},
    cluster_by=['customer_id', 'channel']
) }}

SELECT
  order_id,
  customer_id,
  order_date,
  order_amount,
  channel
FROM {{ ref('stg_shopify_orders') }}

{% if is_incremental() %}
WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY)
{% endif %}
```

Incremental builds cut BigQuery costs by 90%—scanning 50GB instead of 2TB. Partition + cluster boosts query performance: a `WHERE customer_id = 'X'` query hits only the relevant cluster, no full scan.

Test coverage is critical. In dbt's `schema.yml`, you write tests for every model:

```yaml
models:
  - name: fct_orders
    columns:
      - name: order_id
        tests:
          - unique
          - not_null
      - name: order_amount
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"
      - name: order_date
        tests:
          - dbt_utils.recency:
              datepart: day
              interval: 7
```

`dbt test` asserts these conditions in BigQuery—if order_amount goes negative, the build fails. In production, every commit runs through CI/CD: `dbt run --select state:modified+ → dbt test --select state:modified+`. Modified models and downstream dependencies run and test; if all passes, merge is allowed.

## Orchestration: Airflow, Prefect, dbt Cloud

dbt itself isn't an orchestrator—Airflow or Prefect schedules it. Example Airflow DAG:

```python
from airflow.providers.google.cloud.operators.bigquery import BigQueryInsertJobOperator
from airflow.operators.bash import BashOperator

dbt_run = BashOperator(
    task_id='dbt_run',
    bash_command='cd /opt/dbt && dbt run --profiles-dir .',
    dag=dag
)

dbt_test = BashOperator(
    task_id='dbt_test',
    bash_command='cd /opt/dbt && dbt test',
    dag=dag
)

dbt_run >> dbt_test
```

dbt Cloud is the alternative—managed orchestration, Web IDE, Slack alerts. Most enterprises prefer Airflow because there are tasks beyond dbt: upstream API pulls, downstream reverse ETL, snapshot tables.

Schedule strategy ties to data freshness. GA4 events have 24-hour processing lag (processing_date ≠ event_date); Meta Ads Insights API isn't real-time. Staging models trigger on source freshness—when GA4 sends a new partition, `stg_ga4_events` refreshes, cascading through intermediate → mart. An Airflow sensor checks BigQuery's `_TABLE_SUFFIX`:

```python
wait_for_ga4 = BigQueryTableExistenceSensor(
    task_id='wait_for_ga4_partition',
    project_id='analytics_123456',
    dataset_id='events_',
    table_id=f"events_{yesterday.strftime('%Y%m%d')}",
    poke_interval=300
)
```

Once the partition is ready, the dbt chain triggers. This pattern solves late-arriving data—instead of blocking on API delays, the pipeline waits.

## Tradeoffs: What dbt doesn't solve

dbt is a transformation engine, not a data loader. Who pulls data into BigQuery? Fivetran, Airbyte, custom Python scripts. dbt assumes raw data is already there in its source definitions. The pattern is ELT: Extract-Load-Transform. Different from ETL—the Transform happens inside the warehouse. dbt handles the T; EL is a separate toolchain.

dbt doesn't support real-time streaming. Kafka → BigQuery streaming insert → dbt incremental model chain introduces minute-level latency. Sub-second use cases (fraud detection, dynamic pricing) need stream processors—Flink, Spark Structured Streaming, or Materialize. dbt isn't the tool.

dbt's Python model support (v1.3+) is limited. You can do pandas dataframe manipulation:

```python
def model(dbt, session):
    df = dbt.ref('stg_orders').to_pandas()
    df['log_amount'] = np.log1p(df['order_amount'])
    return df
```

But you're not training scikit-learn models here. BigQuery compute is expensive, Python runtime overhead is high. Complex transformations run faster in SQL. Feature engineering lives in dbt; model training happens in Vertex AI; inference in BigQuery ML. That's the pattern.

## What to do now

If your marketing data still lives in manually stitched spreadsheets, the first move is setting up raw data flow to BigQuery. GA4 export, Meta/Google Ads API connectors (Fivetran, Supermetrics), CRM webhooks → BigQuery streaming insert. Once raw data is there, you create a dbt repository: staging models for source mapping, intermediate models for sessionization and attribution, mart models for final KPIs. In the first two weeks, `fct_sessions` and `fct_orders` are enough—dashboards point here, metrics stabilize. The semantic layer lands in week three, exposure mapping in week four. By week six, your production pipeline is git-controlled, test-covered, and incremental-optimized. Spreadsheets become read-only archives.