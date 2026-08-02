---
title: "dbt + BigQuery – Moderner Marketing Data Stack"
description: "Source Mapping, Modeling Layer, Semantic Layer, Exposures – Die Architektur und praktische dbt-Implementierung, die Marketing-Daten mit Entscheidungsmechanismen verbindet."
publishedAt: 2026-08-02
modifiedAt: 2026-08-02
category: verianalizi
i18nKey: data-002-2026-08
tags: [dbt, bigquery, data-stack, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

Marketing-Teams nutzen längst nicht mehr die vordefinierten Reports aus Google Analytics, sondern ihre eigenen, selbst geschriebenen Data Pipelines. 2026 besteht der moderne Marketing Data Stack aus drei Schichten: Raw Sources, Modeling Layer und Semantic Layer. Dieser Artikel erklärt, wie man diese drei Schichten mit dbt + BigQuery aufbaut, welche Fehler in welcher Phase auftreten und wie man eine produktionsreife, wartbare Struktur etabliert.

## Source Mapping: Daten in BigQuery hochladen reicht nicht aus

Du hast GA4, Meta Ads und sGTM Events in BigQuery geladen – aber das ist erst der Anfang. Source Mapping bedeutet, Raw Tables in sinnvolle Contracts zu überführen. In dbt werden Source-Definitionen in `.yml`-Dateien verwaltet:

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

Diese Definition erfüllt drei Funktionen: (1) Data Lineage – welches Modell nutzt welche Raw Table, (2) Freshness Check – wenn das letzte Event älter als 12 Stunden ist, erscheint eine Warnung, (3) Contract – wenn die Spalte `event_timestamp` fehlt, schlägt der Build fehl.

**Der häufigste Fehler:** Raw Schema unverarbeitet verwenden. GA4's `event_params` als verschachteltes Array direkt in SQL benutzen – jede Query wird dann über 200 Zeilen lang. Im Source Mapping sollte die `unnest`-Logik zentral an einer Stelle leben:

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

Dieses Modell wird nun downstream mit `ref('stg_ga4_events')` aufgerufen – die Raw event_params-Syntax ist upstream isoliert. Der Freshness Check läuft täglich, Schema-Änderungen werden automatisch als Fehler gemeldet.

## Modeling Layer: Die Metrik einmal definieren, hundertfach nutzen

Nach der Staging-Schicht kommt die Modeling Layer. Hier werden Intermediate Models (Business Logic) und Mart Models (Aggregation) getrennt. Im Marketing Data Stack ist das kritischste Modell der **Session → Transaction**-Join:

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

Dieses Modell läuft täglich um 03:00 Uhr (dbt Cloud Scheduler), Looker Studio verbindet sich direkt mit dieser Table. Wenn eine Änderung notwendig ist, änderst du das SQL an einer Stelle – alle Dashboards aktualisieren sich automatisch.

**Wichtiges Detail:** `safe_divide` wird verwendet – wenn sessions = 0 ist, wird nicht durch Null dividiert, sondern null zurückgegeben. Exception Handling in der Production Pipeline passiert auf dieser Ebene.

### dbt Tests: Datenqualität automatisch checken

Beim Definieren von Metriken in der Modeling Layer schreibst du gleichzeitig Tests:

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

Der `dbt test` Befehl führt diese Regeln aus. Wenn Conversion Rate > 1 herauskommt (= SQL-Fehler), schlägt der Build fehl und eine Alert geht an Slack. Statt manuellem QA gibt es hier automatisierte Datenqualität – der Rest des Data Stack baut auf diesem Fundament auf.

## Semantic Layer: Definiere die Metrik, nicht die Query

Mit dbt v1.6+ ist die Semantic Layer aus dem Beta-Status heraus. Jetzt definierst du die Metrik nicht in SQL, sondern in einer `.yml`-Datei:

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

Diese Definition wird an drei Orten verwendet: (1) Looker Studio, (2) Slack Bot über dbt Cloud Discovery API für Metrik-Anfragen, (3) Airflow DAG als Input für nachgelagerte ML Pipeline.

**Vorteil:** Metriken sind ohne SQL konsumierbar. Marketing Analyst schreibt jetzt „Show me ROAS by campaign, last 7 days" – dbt Semantic Layer kompiliert die Query automatisch. SQL-Logik sitzt im Model Layer, Metrik-Definition in der Semantic Layer – beide sind voneinander getrennt, Änderungen sind isoliert.

**Achtung:** Semantic Layer ist noch relativ neu – nicht alle BI-Tools haben native Integration. Im Roibase Production Stack nutzen wir einen Hybrid-Ansatz: kritische Metriken in der Semantic Layer, Custom Analysis über SQL Exposures.

### Exposures: Downstream-Abhängigkeiten dokumentieren

Exposures zeigen, wo ein dbt Modell außerhalb von dbt verwendet wird:

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

Diese Definition wird in dbt docs visualisiert – welches Dashboard an welches Modell gekoppelt ist, wer zu informieren ist wenn sich ein Modell ändert. In Production ist klar, wenn man ein Breaking Change im Schema durchführt: Mit `dbt run --select +mrt_session_metrics+` sieht man sofort die downstream-Auswirkungen.

**Echtes Szenario:** GA4 ändert den Key `page_location` zu `page_url`. Dank Exposure-Definition fanden wir sofort 3 betroffene Dashboards und 1 Airflow DAG. Die Migration war in 2 Stunden abgeschlossen. Ohne Exposures wären die Dashboards still kaputtgegangen – man hätte es erst durch User-Beschwerden erfahren.

## Incremental Models: 2TB Daten nicht jeden Tag neu bauen

Bei Marketing Data können Daily Partitions terabytegroß werden. Nicht jeder `dbt run` Befehl kann ein Full Refresh sein – BigQuery Kosten und Laufzeit wären inakzeptabel. Stattdessen nutzt man Incremental Models:

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

Diese Config macht drei Dinge: (1) Erstellt Partitionen in BigQuery – neue Tage werden hinzugefügt, alte Tage bleiben unberührt, (2) `cluster_by` verbessert Query-Performance, (3) `insert_overwrite` Strategie – die letzten 3 Tage werden gelöscht und neu geschrieben (für verspätet ankommende Daten).

**Kostendifferenz:** 365 Tage Daten, Full Refresh = 2,5 TB Scan ($12,50), Incremental = 3 GB Scan ($0,015). Bei einer täglich laufenden Pipeline über ein Jahr: ~$4.500 vs ~$5. Deshalb sind Incremental Models das Fundament eines Production Data Stack.

## Den Data Stack mit Entscheidungsmechanismen verbinden

dbt + BigQuery bauen die Infrastruktur – aber der echte Wert liegt darin, Marketing-Entscheidungen zu beeinflussen. Ein typisches Szenario ist der Metrik-Flow von der Semantic Layer zu einem Slack Bot:

1. Marketing Manager schreibt in Slack: `/metric roas last_30_days campaign=brand`
2. Slack App ruft dbt Cloud Semantic Layer API auf
3. API queried die Tabelle `mrt_session_metrics`, berechnet ROAS
4. Ergebnis geht zurück an Slack: „Brand-Kampagne ROAS: 4,2x"

Für diesen Flow braucht man Semantic Layer + Custom Python Middleware. Im Roibase Production Stack zieht ein Airflow DAG täglich einen Snapshot aus der Semantic Layer – Looker Studio und interne Apps nutzen diesen Snapshot (keine API-Rate-Limit-Probleme).

**Alternative:** Im Service [First-Party Daten & Mesarchitektur](https://www.roibase.com.tr/de/firstparty) nutzen wir einen Hybrid Stack – dbt Semantic Layer + Cube.js. Cube.js fügt eine Caching-Schicht hinzu, verbessert BI-Performance. Die Wahl hängt von Data Volume und Query Pattern ab.

## Production Checklist: Vor dbt Stack Deployment

dbt läuft lokal – vor Production sind folgende Kontrollen notwendig:

- **CI/CD:** Jeder Commit triggert `dbt build --select state:modified+` über dbt Cloud oder GitHub Actions
- **Freshness Monitoring:** Kritische Sources kriegen `warn_after` und `error_after` Schwellwerte
- **Alerting:** dbt Cloud Webhooks → Slack Integration. Bei Build-Fehler: Team informiert in 5 Minuten
- **Documentation:** `dbt docs generate` läuft automatisch, Artifacts gehen an S3/GCS
- **Cost Monitoring:** BigQuery Slot Reservation oder On-Demand Cost Alert – bei unerwartetem Spike (z.B. $500/Tag Threshold) sofort benachrichtigt
- **Backup Strategy:** Production Data Warehouse mit Snapshot Tables – bei fehlerhaiter Update ist Rollback möglich

**Kritischste Regel:** In Production gibt es kein manuelles `dbt run`. Alle Executions laufen über Scheduler (dbt Cloud, Airflow, Prefect). Manuelles Ausführen zerstört Data Lineage – im Fehlerfall lässt sich Root Cause nicht feststellen.

dbt + BigQuery ist das Rückgrat des modernen Marketing Data Stack – Source Mapping bindet Raw Data an Contracts, Modeling Layer definiert Metriken an einer zentralen Stelle, Semantic Layer macht sie SQL-unabhängig konsumierbar. In Production machen Incremental Models und Test Coverage die Pipeline wartbar. Der nächste Layer: diese Daten mit Real-Time Activation verbinden – CDP, Audience Sync, Incrementality Measurement. Aber das ist eine andere Data Stack Diskussion.