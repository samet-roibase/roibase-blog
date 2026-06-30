---
title: "dbt + BigQuery: Moderner Marketing Data Stack"
description: "Source Mapping, Modeling Layer, Semantic Layer und Exposures: Production-ready Architektur für Marketing Data als Entscheidungsgrundlage."
publishedAt: 2026-06-30
modifiedAt: 2026-06-30
category: data
i18nKey: data-002-2026-06
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

Marketing-Teams erstellen Berichte immer noch mit Excel-Pivot-Tabellen, Data Engineers schreiben für jede neue Frage SQL neu, KPIs stimmen zwischen Abteilungen nicht überein. 2026 Toleranz für dieses Szenario ist ein Engineering-Fehler. Der moderne Marketing Data Stack arbeitet in drei Schichten: Raw-Source-Integration, Transformations-Layer, Semantic Layer. dbt + BigQuery liefern diese drei Schichten in Production-Grade — mit Version Control, Test Coverage und Lineage Tracking.

## Source Mapping: Raw Data Sicher in die Warehouse Übertragen

BigQuery für Marketing Data zu nutzen wirkt einfach: ETL-Tools wie Fivetran, Stitch oder Airbyte schreiben GA4, Meta Ads, Google Ads direkt in das `raw_`-Schema. Doch nach 6 Monaten Schema-Änderung brechen Downstream-Modelle. dbt **Source-Definitionen** halten dieses Risiko unter Kontrolle.

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

Source-Definitionen erfüllen drei Funktionen: **(1)** Alarm bei Upstream-Änderungen (`freshness`-Metrik sendet Slack-Alert), **(2)** Schema-Vertrag (Columns-Liste wird zur Dokumentation), **(3)** Lineage Tracking (dbt Docs zeigt, welche Modelle von GA4 abhängen). Ändert sich Fivetran-Schema, schlägt dbt compile fehl — nicht in Production.

In der Source-Mapping-Phase Identity-Signale kennzeichnen: `user_id`, `client_id`, `fbclid`, `gclid`, `email_sha256`. Im Modeling Layer werden diese Signale zusammengeführt und auf eine einzige `customer_id` gemappt. Identity-Signale in der Raw Table zu verlieren macht Downstream unmöglich.

### Partitioned Table Strategie

GA4s `events_*` Wildcard-Tabelle ist täglich partitioniert (`events_20260630`). In dbt das Wildcard-Source definieren und mit `_TABLE_SUFFIX` filtern:

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

Diese Config schreibt `stg_ga4_events` mit täglichen Partitionen, das `event_name` + `user_pseudo_id` Clustering reduziert Query-Kosten. Incremental Materialization senkt 90-Tage-History-Scans auf 3 Tage — 30× Kostenersparnis.

## Modeling Layer: Business Logic als Code

Staging-Schicht bereinigt Raw Data, Intermediate-Schicht kuratiert Join-Logik, Mart-Schicht antwortet auf Business-Fragen. dbt trennt diese drei Schichten durch Ordnerstruktur: `staging/`, `intermediate/`, `marts/`.

**Staging-Beispiel** — Meta Ads Spalten standardisieren:

```sql
-- models/staging/stg_meta_ads.sql
select
  date_start as report_date,
  campaign_id,
  campaign_name,
  spend as cost_usd,
  impressions,
  clicks,
  actions.value as conversions -- nested JSON extrahieren
from {{ source('meta_ads', 'ads_insights') }}
where date_start >= date_sub(current_date(), interval 90 day)
```

**Intermediate-Beispiel** — Alle Paid-Media-Quellen vereinigen:

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

**Mart-Beispiel** — Tägliches Performance-Dashboard:

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

Die `ref()`-Funktion baut dbt's Dependency Graph auf. Der `dbt run`-Befehl führt Modelle in Dependency-Reihenfolge aus. Ändert sich `int_paid_media_unified`, werden alle Downstream-Mart-Tabellen automatisch neu gebaut.

### Test Coverage

In Production Fehler bei KPI-Reports zu liefern bedeutet E-Commerce-Verluste im sechsstelligen Bereich. dbt's generische Tests vergeben jedem Modell einen Vertrag:

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

Der `dbt test`-Befehl validiert diese Verträge. Im CI/CD Pipeline wird ein Test-Fehler einen Merge blockieren — fehlerhafte Data erreicht Production nicht. In Roibase's [First-Party Daten & Measurement Architektur](https://www.roibase.com.tr/de/firstparty) Engagement streben wir 85% Test Coverage an (Zeilen × kritische Felder Metrik).

## Semantic Layer: Metrik an Einer Stelle Definieren

Ende 2025 integrierte dbt Labs die "MetricFlow" Semantic Layer in dbt Cloud. Wenn das Marketing Team "Conversion Rate" anfordert, sollte der Data Engineer keine neue SQL schreiben — die Metrik-Definition gehört an eine Stelle. dbt's `metrics.yml` Datei bietet diese Abstraktion:

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

Die Semantic Layer erfüllt zwei Funktionen: **(1)** Bei Metrik-Auswahl im BI-Tool wird SQL automatisch generiert (Looker, Tableau, Power BI Integration), **(2)** bei Metrik-Änderung bleiben alle Dashboards konsistent. Die Entscheidung "CPA-Berechnung muss Versandkosten einschließen" ändert eine Zeile — 40 Dashboards aktualisieren sich auf einmal.

MetricFlow ist noch Beta-Status (Juni 2026), aber production-einsatzbereit. Alternative: Custom Metric Functions mit dbt Makros:

```sql
-- macros/calculate_cpa.sql
{% macro calculate_cpa(cost_column, conversion_column) %}
  safe_divide({{ cost_column }}, nullif({{ conversion_column }}, 0))
{% endmacro %}
```

In allen Mart-Modellen aufrufen mit `{{ calculate_cpa('total_cost', 'total_conversions') }}` — Metrik-Änderungen verbreiten sich von einer Stelle aus.

## Exposures: Modell mit BI-Dashboard Verbinden

dbt's `exposures.yml` Datei verfolgt, welches Modell welches Dashboard nutzt. Diese Verfolgung ist operativ — bei Modell-Änderung weißt du, welche Dashboards getestet werden müssen:

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

Exposure Lineage erscheint im Graph: Nach `dbt docs generate` kannst du im Web-UI auf den `fct_daily_performance` Node klicken und siehst, welche Dashboards davon abhängen. Wenn du ein Breaking Change vorhast, kannst du Exposure Owner automatisch via Slack Webhook benachrichtigen.

### Production Deployment Pattern

dbt Cloud Production Jobs laufen in dieser Reihenfolge:

1. **Source Freshness Check** — `dbt source freshness` (schlägt fehl, wenn Upstream Data verspätet ist)
2. **Model Run** — `dbt run --select tag:daily` (tägliche Modelle starten 07:00 Uhr)
3. **Test Execution** — `dbt test` (Vertragsbruch = Rollback)
4. **Documentation Update** — `dbt docs generate` (Lineage Graph wird aktualisiert)

dbt Job statt BigQuery Scheduled Query zu verwenden hat Vorteile: Version Control (jede Deployment ist git Commit), Rollback-Fähigkeit (fehlerhaftes Modell kehrt in 5 Minuten zur alten Version zurück), Slack Alerts (Test-Fehler + Freshness-Warnung).

## Tradeoff: ELT oder Reverse ETL

dbt + BigQuery Stack folgt ELT-Pattern (extract-load-transform) — Raw Data wird erst in Warehouse gezogen, Transformation läuft in BigQuery. Alternative: Reverse ETL (Hightouch, Census) — Data aus Warehouse wird in SaaS Tools gepusht. Beide ergänzen sich: dbt bereinigt die Warehouse, Reverse ETL sendet Segmente an Braze/Iterable.

Tradeoff: BigQuery Compute-Kosten. 1 TB Scan kostet $5 — komplexes Mart-Modell läuft 10× täglich = $50/Tag = $1.500/Monat. Optimierung: Incremental Materialization + Partition Pruning + Clustering. In Roibase-Projekten liegt das BigQuery-Ziel bei: monatlich aktive User pro $0,02 — 1M MAU = $20K/Jahr (akzeptabel).

Marketing Data Stack ist kein Einzelprojekt — eine evolvierende Architektur. Nach dbt + BigQuery Foundation kommen MMM (Marketing Mix Modeling), Incrementality Tests und Identity Resolution Layer hinzu. Diese Foundation production-grade aufzubauen dauert 6–8 Wochen, aber spart 18 Monate Downstream — jede neue KPI-Frage wird in 2 Stunden beantwortet, manuelle Data Cleaning entfällt, Attribution Model Änderungen dauern 1 Stunde statt 1 Tag. Den Stack richtig bauen verwandelt Marketing Data in Entscheidungsgrundlage.