---
title: "Modern Marketing Data Stack with dbt + BigQuery"
description: "Source mapping, modeling layers, semantic layer, and exposures: production-ready architecture connecting marketing data to decision-making with dbt and BigQuery."
publishedAt: 2026-05-29
modifiedAt: 2026-05-29
category: data
i18nKey: data-002-2026-05
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Marketing teams still say, "I can't tell how our campaign performed without checking the dashboard." Analysts write new SQL for every question. The CFO can't understand why CAC differs in every report. The problem isn't technical—you have a pipeline, sources are connected, data flows. The problem is architecture: there's no definition layer between raw tables and the dashboard. The dbt + BigQuery combination solves this: through source mapping, modeling layers, semantic layers, and exposures, you standardize data at the logic layer, not the visual layer.

## Source Mapping: Binding Raw Data to Contract

Data flows into BigQuery from CRM, GA4, Meta Ads, Klaviyo. Every source uses different schemas, naming conventions, timestamp formats. dbt source mapping lets you declare these sources as code and test them. In a `sources.yml` file, you declare every table, set freshness controls, and test unique constraints.

Example source definition:

```yaml
version: 2

sources:
  - name: raw_ga4
    database: analytics_lake
    schema: raw_ga4_events
    tables:
      - name: events
        freshness:
          warn_after: {count: 6, period: hour}
          error_after: {count: 12, period: hour}
        columns:
          - name: event_timestamp
            tests:
              - not_null
          - name: user_pseudo_id
            tests:
              - not_null
```

This definition creates a contract: "Warn if GA4 events don't arrive in 6 hours, fail if they don't arrive in 12 hours." In production, this test ties to CI/CD—you catch source issues instantly. dbt docs auto-generate a lineage graph showing which dashboard depends on which source.

Without source mapping, analysts start with `SELECT * FROM analytics_lake.raw_ga4_events.events`. They don't know what each column means, there are no tests, no documentation. With dbt, you reference the source: `{{ source('raw_ga4', 'events') }}`. If the table name changes, you update it in one place—all downstream models adjust automatically.

## Modeling Layer: Staging, Intermediate, Mart

dbt's power lies in modeling layers. You separate into three levels: staging (normalize raw format), intermediate (apply business logic), mart (final metric tables).

**Staging layer:** One 1:1 model per source. Only data type conversion, column naming, timestamp to UTC. No business logic.

```sql
-- models/staging/stg_ga4__events.sql
WITH source AS (
    SELECT * FROM {{ source('raw_ga4', 'events') }}
)

SELECT
    TIMESTAMP_MICROS(event_timestamp) AS event_at,
    user_pseudo_id AS user_id,
    event_name,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_url
FROM source
WHERE event_date >= CURRENT_DATE() - 90
```

**Intermediate layer:** Apply business logic. Define sessions, map product categories, apply attribution windows. These models don't go to end users—they feed downstream models.

```sql
-- models/intermediate/int_sessions.sql
WITH events AS (
    SELECT * FROM {{ ref('stg_ga4__events') }}
),

session_windows AS (
    SELECT
        user_id,
        event_at,
        SUM(CASE WHEN TIMESTAMP_DIFF(event_at, LAG(event_at) OVER (PARTITION BY user_id ORDER BY event_at), MINUTE) > 30 THEN 1 ELSE 0 END) 
            OVER (PARTITION BY user_id ORDER BY event_at) AS session_index
    FROM events
)

SELECT
    user_id,
    session_index,
    MIN(event_at) AS session_start_at,
    MAX(event_at) AS session_end_at,
    COUNT(*) AS event_count
FROM session_windows
GROUP BY 1, 2
```

**Mart layer:** Final metric tables. These connect to dashboards, BI tools, Looker. Use `fct_` (fact) or `dim_` (dimension) prefixes.

```sql
-- models/marts/fct_daily_channel_performance.sql
SELECT
    DATE(session_start_at) AS date,
    traffic_source.medium AS channel,
    COUNT(DISTINCT user_id) AS users,
    SUM(revenue) AS revenue,
    SAFE_DIVIDE(SUM(revenue), COUNT(DISTINCT user_id)) AS revenue_per_user
FROM {{ ref('int_sessions') }}
LEFT JOIN {{ ref('int_transactions') }} USING (user_id, session_index)
GROUP BY 1, 2
```

With this structure, analysts use `fct_daily_channel_performance` without touching staging or intermediate logic. When metric definitions change, you update one place—all dashboards stay consistent.

## Semantic Layer: Code Your Metric Definitions

In BigQuery + dbt, "semantic layer" has two approaches: dbt metrics (deprecated 2023) or dbt semantic models (newer). A semantic model defines metrics in YAML, abstracting them from SQL. Tools like Looker, Tableau, and Mode read these definitions, calculating CAC, LTV, ROAS consistently.

Example semantic model:

```yaml
# models/marts/semantic_models.yml
semantic_models:
  - name: channel_performance
    model: ref('fct_daily_channel_performance')
    dimensions:
      - name: date
        type: time
        type_params:
          time_granularity: day
      - name: channel
        type: categorical
    measures:
      - name: total_revenue
        agg: sum
        expr: revenue
      - name: total_users
        agg: count_distinct
        expr: user_id

metrics:
  - name: revenue_per_user
    type: derived
    type_params:
      expr: total_revenue / total_users
      metrics:
        - total_revenue
        - total_users
```

With this, "revenue per user" calculates the same everywhere. An analyst selects "RPU" in Looker, the backend fetches it from dbt's semantic layer—no manual SQL. If definitions change (say, excluding canceled orders), you update one place.

Without a semantic layer, every dashboard rewrites "revenue / users." One report excludes refunds, another includes them. The CMO sees two numbers, trust erodes. Pairing this with a [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/en/firstparty) is critical for production—you define attribution, consent, and TCF signals using the same framework.

## Exposures: Track Data's Final Destinations

A dbt exposure answers: "which dashboard, ML pipeline, or operational system does this model feed?" You define them in `exposures.yml`:

```yaml
exposures:
  - name: marketing_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: "CMO daily channel performance dashboard"
    depends_on:
      - ref('fct_daily_channel_performance')
    owner:
      name: Marketing Analytics Team
      email: analytics@company.com
```

Exposures provide two things: **impact analysis** (which dashboards break if I change this model?) and **stakeholder mapping** (who owns this dashboard, who do I escalate to?).

In production, exposures flow like this: dbt build → test fails → check lineage graph for affected exposures → auto-post to Slack → dashboard owner gets early warning. Instead of users asking "why is the dashboard empty?", the CI/CD system tells you first.

Without exposures, the data team deploys models blindly, unaware of impact. Exposures tag every model as "live in production, be careful."

## Incremental Models and Partitioning: Cost + Performance

Full table scans in BigQuery are expensive. 1 TB of data = $5 per query, 10 queries daily = $50, monthly = $1,500. dbt incremental models process only new rows—past data stays immutable.

```sql
{{ config(
    materialized='incremental',
    unique_key='event_id',
    partition_by={'field': 'event_at', 'data_type': 'timestamp', 'granularity': 'day'},
    cluster_by=['user_id', 'event_name']
) }}

SELECT * FROM {{ ref('stg_ga4__events') }}
WHERE event_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 DAY)

{% if is_incremental() %}
    AND event_at > (SELECT MAX(event_at) FROM {{ this }})
{% endif %}
```

This config optimizes: process only the last 2 days per run, old data untouched. `partition_by` enables BigQuery partition pruning, `cluster_by` increases query selectivity. Same dataset, 90% lower cost.

In production, incremental models + dbt snapshots implement SCD Type 2: track historical changes in dimension tables (user segment shifts, product category remapping). When an analyst asks "what segment was user X in last month," the snapshot provides consistent answers.

## Production Pipeline: CI/CD, Tests, Alerts

Your dbt project lives on GitHub, every commit triggers a CI pipeline:

1. **Lint:** `sqlfluff` checks SQL formatting
2. **Test:** `dbt test` runs schema tests (not_null, unique, foreign_key) and data tests (revenue > 0, session_duration < 24h)
3. **Build:** `dbt build --select state:modified+` rebuilds only changed models
4. **Deploy:** On merge to production, tables update in BigQuery

Test failures block merges. Example data test:

```sql
-- tests/assert_no_negative_revenue.sql
SELECT * FROM {{ ref('fct_daily_channel_performance') }}
WHERE revenue < 0
```

Passing means 0 rows returned; failing means negative revenue anomaly detected—pipeline halts.

Alert scenario: Schedule a dbt Cloud job (daily 6 AM), use `on-run-end` hooks to notify Slack:

```yaml
on-run-end:
  - "{{ post_to_slack_on_failure() }}"
```

Deploying this pipeline with [Data Analytics & Insights Engineering](https://www.roibase.com.tr/en/verianalizi) takes 4–6 weeks: source mapping + staging + intermediate + mart + semantic model + exposures + tests + CI/CD.

## Tradeoff: Complexity vs Control

The dbt + BigQuery stack has a steep learning curve. SQL knowledge isn't enough—you need Jinja templating, YAML config, Git workflows, CI/CD. For small teams (1–2 people), this overhead feels heavy; direct BigQuery views + Looker Studio starts faster.

But at scale (10+ dashboards, 50+ sources, 5+ analysts), control evaporates without dbt. Every analyst writes their own SQL, metrics contradict, no tests, no docs. dbt lets you pay down technical debt instead of accumulating it.

An alternative: Looker LookML for semantic layers. LookML resembles dbt (code-based metric definitions) but creates vendor lock-in and struggles with non-BigQuery sources. dbt is open-source, portable, and moves between BigQuery, Snowflake, and Redshift.

Modern marketing data stacks begin with source mapping, scale with semantic layers, and monitor with exposures. dbt + BigQuery codifies all three, making data testable, versioned, repeatable. You guarantee metric consistency without glancing at dashboards.