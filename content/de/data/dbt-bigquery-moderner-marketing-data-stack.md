---
title: "dbt + BigQuery für modernen Marketing Data Stack"
description: "Source Mapping, Modeling Layer, Semantic Layer, Exposures: Production-ready Architektur, die Marketing-Daten mit dbt und BigQuery in Entscheidungsmechanismen integriert."
publishedAt: 2026-05-29
modifiedAt: 2026-05-29
category: data
i18nKey: data-002-2026-05
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

Marketing-Teams sagen immer noch: "Kampagnenperformance ohne Dashboard-Abfrage ist unklar." Der Analyst schreibt für jede Frage ein neues SQL-Statement. Der CFO versteht nicht, warum die CAC-Berechnung in jedem Bericht anders ist. Das Problem ist nicht technisch — der Data Pipeline existiert, Quellen sind verbunden, Daten fließen. Das Problem liegt in der Architektur: Zwischen Raw Tables und Dashboard fehlt eine Definition Layer. Die Kombination dbt + BigQuery löst dies: Source Mapping, Modeling Layer, Semantic Layer und Exposures standardisieren Daten auf Logik-Ebene, nicht nur visuell.

## Source Mapping: Raw Data an Kontrakte binden

Daten fließen in BigQuery aus CRM, GA4, Meta Ads, Klaviyo. Jede Quelle nutzt anderes Schema, andere Naming Conventions, andere Timestamp-Formate. dbt Source Mapping erlaubt, diese Quellen als Code zu deklarieren und zu testen. In `sources.yml` definierst du jede Tabelle, stellst Freshness-Kontrollen ein, testest Unique Constraints.

Beispiel Source Definition:

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

Dieser Kontrakt sagt: "GA4 Events müssen alle 6 Stunden eintreffen (Warnung), spätestens nach 12 Stunden (Fehler)." In Production wird dieser Test an CI/CD gebunden — Quellenprobleme werden sofort erkannt. dbt docs generieren automatisch Lineage Graphs — du siehst, welches Dashboard von welcher Quelle abhängt.

Ohne Source Mapping startet der Analyst mit `SELECT * FROM analytics_lake.raw_ga4_events.events`. Keine Spalten-Bedeutung, keine Tests, keine Dokumentation. Mit dbt referenzierst du die Quelle: `{{ source('raw_ga4', 'events') }}`. Tabellennamen ändern sich, du aktualisierst nur eine Stelle — alle Downstream Models folgen automatisch.

## Modeling Layer: Staging, Intermediate, Mart

Die Kraft von dbt liegt in Modeling Layers. Du teilst auf: Staging (Quellformat normalisieren), Intermediate (Geschäftslogik anwenden), Mart (finale Metrik-Tabellen).

**Staging Layer:** Eine 1:1 Model pro Quelle. Nur Datentyp-Konvertierung, Spalten-Benennung, Timestamps zu UTC. Keine Geschäftslogik.

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

**Intermediate Layer:** Geschäftslogik anwenden. Sessions definieren, Produktkategorien mappen, Attribution Window anwenden. Diese Models gehen nicht an Endbenutzer — sie füttern nur Downstream Models.

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

**Mart Layer:** Finale Metrik-Tabellen. Dashboard, BI Tool, Looker Connect. Nutze `fct_` (Fact) oder `dim_` (Dimension) Präfix.

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

Mit dieser Struktur nutzt der Analyst `fct_daily_channel_performance`, berührt Staging/Intermediate nicht. Metrik-Definitionen ändern sich an einer Stelle — alle Dashboards bleiben konsistent.

## Semantic Layer: Metrik-Definitionen als Code

In BigQuery + dbt Kombination gibt es zwei Ansätze: dbt Metrics (deprecated 2023) oder dbt Semantic Models (neuer Standard). Semantic Model abstrahiert Metrik von SQL zu YAML. Tools wie Looker, Tableau, Mode lesen diese Definition — CAC, LTV, ROAS werden überall gleich berechnet.

Beispiel Semantic Model:

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

Mit dieser Definition wird "Revenue per User" überall identisch berechnet. Der Analyst wählt in Looker "RPU", das Backend holt von dbt Semantic Layer — SQL wird nicht manuell geschrieben. Definition ändert sich (z.B. stornierte Orders ausschließen) — eine Stelle, eine Änderung.

Ohne Semantic Layer schreibt jedes Dashboard "revenue / users" neu. Ein Report ohne Rückgaben, ein anderer inklusive. Der CMO sieht zwei Zahlen, Vertrauen geht verloren. Mit [First-Party Daten & Metriken-Architektur](https://www.roibase.com.tr/de/firstparty) wird diese Layer in Production kritisch — Attribution, Consent, TCF Signale werden mit derselben Logik definiert.

## Exposures: Datenlaufbahn bis zur finalen Nutzung tracken

dbt Exposure beantwortet: "Welches Dashboard, welche ML Pipeline, welches Operationssystem nutzt dieses Modell?" In `exposures.yml` definierst du:

```yaml
exposures:
  - name: marketing_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: "CMO tägliches Channel-Performance Dashboard"
    depends_on:
      - ref('fct_daily_channel_performance')
    owner:
      name: Marketing Analytics Team
      email: analytics@company.com
```

Exposure Definition liefert zwei Dinge: **Impact Analysis** (Wenn ich dieses Modell ändere, welche Dashboards brechen?) und **Stakeholder Mapping** (Wer ist Dashboard-Besitzer, wem melde ich das Problem?).

In Production läuft Exposures so: dbt build → Test fail → Lineage Graph zeigt betroffene Exposures → Slack Notifikation an Dashboard-Owner. So erfährt der Nutzer das Problem von CI/CD, nicht von Beschwerden.

Ohne Exposures deployed das Data Team blind — wer wird betroffen, bleibt unklar. Mit Exposures trägt jedes Modell: "Diese Tabelle läuft produktiv, nicht anfassen."

## Incremental Models und Partitioning: Kosten + Performance

In BigQuery ist Full Table Scan teuer. 1 TB Daten = $5/Query, 10 Queries/Tag = $50, Monat = $1500. dbt Incremental Models verarbeiten nur neue Zeilen, historische Daten bleiben unveränderbar.

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

Diese Config macht: Jeden Run nur letzte 2 Tage verarbeiten, alte Daten unberührt. `partition_by` aktiviert BigQuery Partition Pruning, `cluster_by` erhöht Query Selectivity. Bei gleicher Datenmenge: 90% Kostenreduktion.

In Production nutzen Incremental Models + dbt Snapshots SCD Type 2: Historische Dimensionen-Änderungen tracken (User Segment Wechsel, Product Category Mapping Update). Analyst fragt "Im letzten Monat — welches Segment war User X?", holt aus Snapshot — Daten konsistent.

## Production Pipeline: CI/CD, Tests, Alerts

dbt Projekt liegt auf GitHub, jeder Commit triggert CI Pipeline:

1. **Lint:** `sqlfluff` checkt SQL-Format
2. **Test:** `dbt test` führt Schema Tests (not_null, unique, foreign_key) und Data Tests (revenue > 0, session_duration < 24h) aus
3. **Build:** `dbt build --select state:modified+` baut nur veränderte Models
4. **Deploy:** Nach Merge in Production wird BigQuery Table aktualisiert

Test Fail blockt Merge. Beispiel Data Test:

```sql
-- tests/assert_no_negative_revenue.sql
SELECT * FROM {{ ref('fct_daily_channel_performance') }}
WHERE revenue < 0
```

Gibt 0 Zeilen zurück = Pass; 1+ Zeilen = Fail. Negatives Revenue wird als Anomalie erkannt, Pipeline stoppt.

Alert-Szenario: dbt Cloud Job täglich um 06:00 schedulen, `on-run-end` Hook sendet Slack Notifikation:

```yaml
on-run-end:
  - "{{ post_to_slack_on_failure() }}"
```

Mit [Daten-Analyse & Insight Engineering](https://www.roibase.com.tr/de/verianalizi) wird diese Pipeline produktiv aufgebaut: 4–6 Wochen für Source Mapping + Staging + Intermediate + Mart + Semantic Model + Exposure + Tests + CI/CD.

## Tradeoff: Komplexität vs. Kontrolle

dbt + BigQuery Stack hat steile Lernkurve. SQL alleine reicht nicht — Jinja Templating, YAML Config, Git Workflow, CI/CD notwendig. Bei kleinen Teams (1–2 Personen) ist dieser Overhead hoch — direkten BigQuery Views + Looker Studio schneller starten.

Aber bei Skalierung (10+ Dashboards, 50+ Quellen, 5+ Analysten) geht ohne dbt die Kontrolle verloren. Jeder Analyst schreibt eigne SQL, Metrik-Definitionen widersprechen sich, Tests fehlen, Dokumentation weg. dbt verhindert hier, dass Schulden entstehen, statt sie später zu zahlen.

Alternative: Looker LookML für Semantic Layer. LookML ähnelt dbt (Metriken als Code) aber Vendor Lock-in, schwer BigQuery-extern. dbt ist Open Source, portierbar — BigQuery/Snowflake/Redshift austauschbar.

Moderner Marketing Data Stack beginnt mit Source Mapping, skaliert mit Semantic Layer, wird in Production mit Exposures überwacht. dbt + BigQuery definiert alle drei Layer als Code: testbar, versionierbar, reproduzierbar. Metrik-Konsistenz wird garantiert — ohne Dashboard-Abfrage.