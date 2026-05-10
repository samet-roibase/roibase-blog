---
title: "dbt + BigQuery: Moderner Marketing Data Stack"
description: "Source Mapping, Modeling Layer, Semantic Layer und Exposures — vier Architekturschichten, die Marketing-Daten mit Entscheidungsfindung verbinden."
publishedAt: 2026-05-10
modifiedAt: 2026-05-10
category: data
i18nKey: data-002-2026-05
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

Marketing-Teams haben Zugriff auf mehr Daten als je zuvor, aber ihre Entscheidungen basieren immer noch auf Vermutungen. In Tabellenkalkulationen zusammengeführte Berichte, unterschiedliche Metriken in jedem Dashboard, drei verschiedene Antworten auf die Frage „Was war der echte CAC?" Das Problem ist nicht Datenmangel — sondern fehlende Struktur vom Source bis zum Insight. Die Kombination dbt + BigQuery schafft eine Architektur, die diese Lücke schliesst: Sie erfassen Rohdaten durch Source Mapping, transformieren sie durch die Modeling Layer in geschäftslogische Konzepte, schaffen eine gemeinsame Sprache durch die Semantic Layer und öffnen die Pipeline für produktive Nutzung über Exposures.

## Source Mapping: Von Rohdaten zur vertrauenswürdigen Quelle

Source Mapping ist die erste Schicht von dbt — unmittelbar nachdem Sie Marketing-Daten in BigQuery geladen haben. Raw Events von Google Ads API, Meta Ads, Shopify werden in der Staging-Schicht standardisiert. Das Modell `stg_google_ads__campaign_performance` hat 127 Spalten, Sie nutzen aber nur 12. Source Mapping wählt diese 12 aus, konvertiert Timestamps in UTC, castet campaign_id zu String, behandelt NULL-Werte und erstellt eine saubere Tabelle.

Die Source-Definition erfolgt in BigQuery über die `sources.yml` Datei. Hier definieren Sie Freshness Checks — wenn Daten von Google Ads nicht innerhalb von 2 Stunden ankommen, schlägt der dbt run fehl. Das ist ein durchgesetzter Vertrag: Ihre Data Pipeline wird zuverlässig. Statt direktes SELECT aus Raw Tables nutzen Sie das Macro `{{ source('google_ads', 'campaign_stats') }}` — im dbt Lineage Graph sehen Sie sofort, welche Raw Table welches Modell speist.

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

## Modeling Layer: Geschäftslogik als Code

Nach Staging folgen Intermediate und Mart Layer — hier wird Marketing-Logik auf die Daten angewendet. Im `int_campaign_attribution` Modell berechnen Sie First-Touch und Last-Touch Attribution. In `fct_customer_lifetime_value` analysieren Sie LTV nach Cohort. Diese Modelle nutzen dbt's Incremental Materialization — bei jedem Run wird nur das Daten der letzten 3 Tage verarbeitet, alte Einträge bleiben unangetastet. Mit 40 Millionen Zeilen in der customer_event Tabelle läuft jeder dbt Run in 2 Minuten statt Stunden.

In der Mart Layer erstellen Sie geschäftseinheit-spezifische Tabellen: `mart_paid_media__daily_performance`, `mart_crm__email_engagement`, `mart_finance__revenue_attribution`. Diese Tabellen verbinden sich direkt mit Looker Studio, Tableau, Amplitude — jedes Team zieht die Metrik aus derselben Source. CAC-Berechnung ist nicht mehr diskussionswürdig, weil die Formel `paid_media_spend / new_customers` im dbt Modell codiert ist. Sie durchläuft Code Review, wird getestet, liegt unter Version Control.

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

## Semantic Layer: Eine gemeinsame Sprache aufbauen

Die Semantic Layer kam mit dbt 1.6 — Sie definieren Metriken als Code, jedes Tool nutzt dieselbe Definition. `revenue` ist nicht `sum(order_total)`, sondern `sum(case when payment_status = 'completed' then order_total end)`. Die Frage „Sind rückerstattete Bestellungen inbegriffen?" verschwindet, weil die Metrik-Definition auf GitHub liegt. Marketing, Finance und Product nutzen dieselbe `revenue` Metrik — nur mit unterschiedlichen Dimensionen segmentiert.

Bei Roibase's Arbeiten zur [First-Party Datenarchitektur](https://www.roibase.com.tr/de/firstparty) ist die Semantic Layer ein Muss. Wenn Sie Customer Events von verschiedenen Touchpoints zusammenführen ohne standardisierte Metriken, liefert jede Analyse unterschiedliche Ergebnisse. In dbt's `metrics.yml` definierte Metriken werden BI Tools über API bereitgestellt — Looker, Hex, Mode ziehen Metriken aus der Semantic Layer, überall sehen Sie die gleiche Zahl.

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

## Exposures: In die Produktion gehen

Exposures sind dbt's Downstream-Dependency-Tracking — Sie definieren, welches Dashboard welches dbt Modell nutzt. Ihr Looker Dashboard „Weekly Campaign Performance" speist sich aus `mart_paid_media__daily_performance`. In dbt's `exposures.yml` dokumentieren Sie diese Abhängigkeit. Jetzt warnt Sie dbt: Wenn Sie Breaking Changes in `mart_paid_media__daily_performance` vornehmen, sind 3 Dashboards betroffen — Impact-Analyse erforderlich.

Exposures erscheinen auch in der dbt Documentation — klicken Sie auf ein Modell im dbt Docs und sehen „Used in 5 dashboards, 2 reverse ETL jobs, 1 ML pipeline". Die Data Lineage reicht bis zur BI-Schicht. Sie wissen, welches Dashboard von welchem SQL abhängt. Debugging wird schneller, weil Sie das problematische Dashboard finden und zum Source-Modell zurückverfolgen können.

| Exposure-Typ | Verwendung | Tracking-Methode |
|---|---|---|
| Dashboard | Looker, Tableau, Metabase | URL + Model Ref |
| Reverse ETL | Census, Hightouch | Job ID + Source Table |
| ML Pipeline | Vertex AI, SageMaker | Modellname + Feature Table |
| Operatives Tool | Braze, Iterable Kampagnen-Segment | Segment ID + dbt Modell |

## Pipeline Orchestration: Die Ausführungsreihenfolge

Sie orchestrieren die Pipeline mit dbt Cloud Scheduler oder Airflow. 6:00 Uhr morgens laden Raw Data in BigQuery (Fivetran, Stitch, Airbyte). 6:30 Uhr startet dbt run. Staging-Modelle dauern 5 Minuten, Intermediate 10 Minuten, Mart 15 Minuten. 7:00 Uhr wird die Semantic Layer exposed, 7:15 Uhr refreshen sich Looker Dashboards. Wenn das Team um 9:00 Uhr ins Büro kommt, sieht es Daten von gestern — nicht 3 Stunden alt.

Eine Test Suite läuft bei jedem Run: `not_null`, `unique`, `accepted_values`, `relationships`. Wenn `campaign_id` in `stg_google_ads__campaign_performance` nicht unique ist, schlägt der dbt run fehl. Ein Alert landet in Slack. Das Data Quality Gate wird auf Code-Ebene enforced. Broken Data erreicht Production nicht.

```yaml
# dbt_project.yml on-run-end hooks
on-run-end:
  - "{{ log_dbt_results() }}"
  - "{{ send_slack_notification() }}"
  - "{{ update_looker_cache() }}"
```

## Tradeoff: Komplexität versus Governance

Der dbt + BigQuery Stack bringt Komplexität. SQL-Kenntnisse im Analyst-Team werden zur Voraussetzung — „Pivot-Tabelle in Excel machen" reicht nicht mehr aus. Git Workflows, Code Reviews, CI/CD Pipelines müssen gelernt werden. Für kleine Teams kann dieser Overhead kostspielig sein. Aber der Tradeoff ist eindeutig: Sie gewinnen Governance. Verlorene Formeln in Tabellenkalkulationen werden zur versionskontrollierten Logik. Die Frage „Woher kommt diese Zahl?" ist mit `git blame` in 10 Sekunden beantwortet.

BigQuery-Kosten sind ein anderer Tradeoff. Full Table Scans sind teuer — Partitionierungs- und Clustering-Strategie sind Pflicht. In dbt Incremental Models sind `partition_by` und `cluster_by` Config kritisch. Eine Pipeline, die monatlich 100 GB verarbeitet, kostet auf BigQuery etwa $50 Slot-Kosten + $5 Storage. Weil es ein Managed Service ist, gibt es keinen Infra-Overhead, aber ohne Query-Optimierung wird die Rechnung schnell höher.

Marketing-Daten mit Entscheidungsfindung zu verbinden ist nicht mehr mit Spreadsheets und BI Tools machbar. Der dbt + BigQuery Stack codifiziert jede Schicht vom Source zur Exposure. Source Mapping macht Rohdaten zuverlässig, die Modeling Layer wendet Geschäftslogik an, die Semantic Layer schafft eine gemeinsame Sprache, Exposures öffnen die Pipeline für Production. Code Review, Tests, Version Control — die Data Pipeline wird mit Software-Engineering-Disziplin betrieben.