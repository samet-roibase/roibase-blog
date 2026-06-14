---
title: "dbt + BigQuery: Moderner Marketing Data Stack"
description: "Von der Source-Zuordnung bis zur Semantic Layer: Wie Sie Marketing-Daten in Entscheidungsintelligenz verwandeln. dbt-Modellierung, Exposure-Definitionen und Production-Pipeline-Architektur."
publishedAt: 2026-06-14
modifiedAt: 2026-06-14
category: data
i18nKey: data-002-2026-06
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

Marketing-Teams treffen 2026 keine Entscheidungen trotz Daten, sondern mit Daten. GA4, Meta Ads, Google Ads, CRM, CDP, Server-Side GTM — jedes System fällt in eine separate Tabelle. Teams kleben Ergebnisse in Spreadsheets zusammen, Zahlen ändern sich jede Woche, niemand vertraut den Metriken. Dieser Chaos verschwindet mit dem modernen Data Stack: BigQuery als Quelle, dbt als Transformationsschicht, Semantic Layer als Metrik-Netzwerk. Sie versionieren Code im Repository, jede Änderung wird getestet, Metriken kommen aus einer Single Source of Truth. Dieser Artikel zeigt, wie dbt + BigQuery Ihre Marketing-Pipeline auf Production-Grade heben.

## Source-Zuordnung: Rohdaten-Pfade standardisieren

dbt's erste Aufgabe ist Source-Zuordnung — Rohdaten aus verschiedenen Systemen in ein einheitliches Schema bringen. In BigQuery kommt `analytics_123456.events_*` aus GA4, `facebook_ads.ads_insights` aus der Meta API, `crm.transactions` aus Shopify. Jede Quelle hat andere Timestamp-Formate, User-Identifier und Currency-Spalten. Sie definieren diese Raw-Tabellen in dbt's `sources.yml`:

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

Diese Definition sagt dbt: "Diese Tabellen sind Upstream-Quellen, ich modifiziere sie nicht, aber ich teste ihre Aktualität." Der Befehl `dbt source freshness` prüft, wann die letzten Daten eingegangen sind — wenn Meta API verzögert ist, bekommen Sie einen Alert. Ohne Source-Zuordnung schreibt jedes Modell direkt `SELECT * FROM analytics_123456.events_20260614`. Ändert sich der Tabellenname, brechen 40 Modelle. Mit Zuordnung erfolgt die Referenzierung über `{{ source('ga4', 'events_') }}` — Änderungen verbreiten sich von einer zentralen Stelle.

GA4 speichert event_timestamp als Unix-Mikrosekunde, Meta Ads date_start als ISO-String, CRM created_at als UTC-Datetime — jedes Format ist unterschiedlich. In der Source-Zuordnung standardisieren Sie einen Timestamp: `TIMESTAMP_MICROS(event_timestamp) AS event_time` für GA4, `PARSE_TIMESTAMP('%Y-%m-%d', date_start) AS event_time` für Meta. Diese Normalisierung liefert saubere Eingaben an nachgelagerte Modelle.

## Modeling Layer: Staging, Intermediate, Mart

dbt's Stärke liegt in geschichteter Modellierung — Staging-, Intermediate- und Mart-Schichten. Staging-Modelle ziehen 1:1 aus der Quelle, führen nur Umbenennung und Typ-Casting durch. `stg_ga4_events.sql`:

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

Staging liefert saubere Daten, aber keine Business-Logik. Intermediate-Modelle fügen geschäftliche Logik hinzu: Sessionization, Attribution, Funnel-Schritte. `int_sessions.sql` aggregiert GA4-Events auf Session-Ebene:

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

Mart-Modelle bilden die finale Konsumschicht — BI-Tools, Looker, interne Dashboards schauen hier rein. `fct_marketing_performance.sql` kombiniert alle Kanäle, berechnet Ausgaben + Umsatz + ROAS. Jedes Mart-Modell konzentriert sich auf eine Business-Entität: `dim_customers`, `fct_orders`, `fct_sessions`. Die Naming-Konvention ist kritisch — `dim_` für Dimensionen (Kunde, Produkt), `fct_` für Fakten (Transaktion, Event), `rpt_` für Report-Aggregate.

## Semantic Layer: KPI-Definitionen als Code

Die Semantic Layer zieht Metrik-Definitionen in dbt — "Was ist Revenue?", "Wie berechnet sich CAC?" stehen nicht mehr in Spreadsheets, sondern in YAML. Mit dbt v1.6+ definieren Sie den Metrik-Graph in `metrics.yml`:

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

Mit der Semantic Layer berechnet nicht das BI-Tool CAC — dbt berechnet es. Wenn Looker "gib mir CAC" fragt, gibt dbt compiled SQL zurück, joined spend- und new-customer-Tabellen und teilt. Da die Definition Code ist, liegt sie in Git-Historie — "Wer hat CAC-Berechnung geändert, warum?" ist beantwortbar. Spreadsheet-Formeln gehen nicht verloren, sondern sind versioniert.

Bei Roibase-Projekten wird die Semantic Layer im Rahmen von [Datenanalyse & Insight-Engineering](https://www.roibase.com.tr/de/verianalizi) aufgebaut — nicht nur Metrik-Definition, sondern auch KPI-Tree-Mapping, Dimension-Hierarchie und Grain-Standardisierung. Beispiel: "revenue"-Metrik ist die Summe von `fct_orders.order_amount`, aber "recognized_revenue" wird nach `recognized_at`-Timestamp gefiltert (für SaaS-Subscription-Modelle). Eine Tabelle, zwei Metriken, unterschiedliche Business-Logik.

## Exposures: Nachgelagerte Abhängigkeiten sichtbar machen

Exposure antwortet dbt auf die Frage "Wer nutzt dieses Modell?". Wenn ein Looker-Dashboard auf `fct_marketing_performance` schaut, definieren Sie das in `exposures.yml`:

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
    description: "Executive Marketing Dashboard — tägliche Aktualisierung, 90-Tage-Fenster"
    url: https://looker.company.com/dashboards/123
```

Ohne Exposure-Definition wissen Sie nicht, welches Dashboard bricht, wenn Sie `fct_marketing_performance` ändern. Sie deployen, Looker zeigt Null an, Sie debuggen 2 Stunden. Mit Exposure sagt der Befehl `dbt compile --select +exposure:marketing_dashboard` welche upstream Modelle betroffen sind — Impact-Analyse vor der Änderung.

Exposure ist nicht nur BI-Tools — auch Reverse-ETL (Hightouch, Census) ist eine Exposure. Wenn Sie `customers`-Tabelle zu Meta CAPI synchen:

```yaml
exposures:
  - name: meta_capi_sync
    type: application
    maturity: high
    depends_on:
      - ref('dim_customers')
    description: "Meta Conversion API — inkrementelle Customer-Events, 5-Minuten-Verzögerung"
```

Diese Definition warnt "Wenn du dim_customers änderst, bricht das Schema, das zu CAPI geht" — frühe Alarmfunktion gegen production incidents.

## Production Pipeline: Incremental Builds und Test Coverage

dbt führt in production nicht täglich Full Refresh durch — inkrementelle Modelle nutzen. `fct_orders.sql` verarbeitet nur die letzten 3 Tage neu:

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

Incremental Builds senken BigQuery-Kosten um 90% — statt 2TB-Scan für die ganze Tabelle nur 50GB für 3 Tage. Partitionierung + Clustering verbessern Query-Performance: `WHERE customer_id = 'X'` scannt nur den relevanten Cluster, kein Full Table Scan.

Test Coverage ist kritisch. Sie schreiben Tests für jedes Modell in `schema.yml`:

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

Der Befehl `dbt test` setzt diese Bedingungen in BigQuery durch — wenn order_amount negativ ist, fällt der Build. In production testet jeder Commit in der CI/CD-Pipeline: `dbt run --select state:modified+ → dbt test --select state:modified+`. Modified Modelle + downstream-Abhängigkeiten laufen, Tests folgen, bei Erfolg ist Merge erlaubt.

## Orchestrierung: Airflow, Prefect, dbt Cloud

dbt ist selbst kein Orchestrator — wird von Airflow oder Prefect gesteuert. Beispiel Airflow DAG:

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

dbt Cloud ist Alternative — managed Orchestration, Web IDE, Slack Alerts. Aber die meisten Enterprise-Teams bevorzugen Airflow, weil neben dbt noch andere Tasks anfallen: upstream API Pull, downstream Reverse-ETL, Snapshot-Tabellen.

Schedule-Strategie hängt von Data Freshness ab. GA4 Event ist 24 Stunden verzögert (processing_date ≠ event_date), Meta Ads Insights API nicht real-time. Staging-Modelle triggern nach Source Freshness — wenn GA4 neue Partition kommt, refresht `stg_ga4_events`, die Welle läuft zu Intermediate → Mart. Airflow Sensor prüft BigQuery `_TABLE_SUFFIX`:

```python
wait_for_ga4 = BigQueryTableExistenceSensor(
    task_id='wait_for_ga4_partition',
    project_id='analytics_123456',
    dataset_id='events_',
    table_id=f"events_{yesterday.strftime('%Y%m%d')}",
    poke_interval=300
)
```

Wenn Partition da ist, startet die dbt-Kette. Dieses Pattern löst das Problem "verspätete Daten stoppen Pipeline" — stattdessen wartet die Pipeline.

## Tradeoffs: Was dbt nicht löst

dbt ist Transformations-Engine, keine Data-Loading-Engine. Wer zieht Daten in BigQuery? Fivetran, Airbyte, Custom-Python-Skript. dbt geht davon aus, dass Raw Data schon da ist. ELT-Pattern: Extract-Load-Transform. Unterschied zu ETL: Transform findet im Warehouse statt. dbt ist diese T-Schicht, EL ist separate Toolchain.

dbt unterstützt kein echtes Real-Time-Streaming. Kafka → BigQuery Streaming Insert → dbt Incremental Model Chain bedeutet Minuten-Latenz. Für Sub-Sekunden-Latenz (Fraud Detection, Dynamic Pricing) reicht dbt nicht — Sie brauchen Flink, Spark Structured Streaming oder Materialize.

dbt Python-Model-Support (v1.3+) ist begrenzt. Sie können Pandas DataFrame manipulieren, aber schweres ML-Training läuft nicht in dbt. Feature Engineering in dbt, Model Training auf Vertex AI, Inference auf BigQuery ML ist das Muster. dbt Python-Modell sieht so aus:

```python
def model(dbt, session):
    df = dbt.ref('stg_orders').to_pandas()
    df['log_amount'] = np.log1p(df['order_amount'])
    return df
```

Aber nur Feature-Generation — Sie trainieren kein scikit-learn Modell. BigQuery Compute ist teuer, Python Runtime hat Overhead. Komplexe Transformationen laufen in SQL schneller.

## Jetzt beginnen

Wenn Marketing-Daten noch in Spreadsheets manu