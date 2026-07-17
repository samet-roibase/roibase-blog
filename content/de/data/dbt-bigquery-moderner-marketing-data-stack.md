---
title: "dbt + BigQuery: Moderner Marketing Data Stack"
description: "Source Mapping, Modeling Layer, Semantic Layer, Exposures: Vier-Schichten-Architektur, die Marketing-Daten in Entscheidungsmechanismen integriert."
publishedAt: 2026-07-17
modifiedAt: 2026-07-17
category: verianalizi
i18nKey: data-002-2026-07
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

Google Analytics 4 zeigt nach Kanal, Klaviyo dokumentiert E-Mail-Volume, Meta Ads meldet CPA — aber stehen diese drei Zahlen in derselben SQL-Query nebeneinander? Falls nicht, basiert die Entscheidungsfindung auf Vermutungen. Das Versprechen des dbt + BigQuery Stacks ist singular: Marketing-Daten in vier Schichten von Source bis Exposure so zu modellieren, dass die Frage „welcher Kanal, welcher Kunde, wieviel Wert" in eine wiederholbare SQL-Pipeline übersetzt wird. Post-Cookie, Multi-Touch Attribution und Incrementality-Tests machen diese Architektur für Boutique-Agenturen nicht optional — sondern obligatorisch.

## Source Mapping: Rohdaten in Tabellengruppen strukturieren

In BigQuery erstellt jede Plattform ein eigenes Dataset: `ga4_export`, `facebook_ads`, `klaviyo_events`, `shopify_orders`. Ihre Raw-Schemas sind inkompatibel — GA4 gibt verschachteltes JSON zurück, Facebook API liefert flache CSVs, Klaviyo-Webhooks keine Normalisierung. dbt Source Mapping ist die erste Schicht: Ein YAML-Manifest über diesem Chaos dokumentiert jede Tabelle im `sources`-Block, erfasst Datentypen, Frische und Ladehäufigkeit.

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

Dieses Manifest gibt dbt zwei Dinge: 1) Über das `source()`-Macro typsichere Referenzen auf Raw-Tabellen statt `ref()`, 2) Der `dbt source freshness`-Befehl zeigt auf, wo die Pipeline steckt. GA4-Events könnten 49 Stunden ohne Update sein — BigQuery merkt das nicht, dbt aber schon.

Während Source Mapping müssen PII-Annotationen erfolgen: DSGVO-konform wird markiert, wo Nutzer-IDs, E-Mails, IPs liegen. Jede Tabelle mit `user_pseudo_id` erhält `meta.contains_pii: true`. Dieses Tag reist in der Lineage mit und ermöglicht später Field-Level-Maskierung in der Semantic Layer.

## Modeling Layer: Staging → Intermediate → Mart

Staging-Modelle benennen Raw-Sources um, konvertieren Datentypen und entfernen Redundanz für standardisierte Downstream-Schemas. GA4s `event_params`-Array wird entpackt — `page_location`, `session_id`, `transaction_id` werden skalare Felder:

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

Dieses Modell erhält das `stg_`-Präfix — Downstream berührt Sources nie, alle greifen auf Staging zu. Staging-Modelle können inkrementell laufen: täglich nur neue Partitionen. `dbt build --select stg_ga4__events` läuft in 30 Sekunden, nicht 90 Tage Reprocessing jeden Tag.

Intermediate-Modelle kombinieren Staging zu analytischen Konzepten: `int_sessions`, `int_customer_cohorts`, `int_channel_attribution`. Sie verbergen Implementierungsdetails. Multi-Touch Attribution etwa ist Intermediate:

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

U-shaped Attribution — erster und letzter Touch 40%, mittlere Berührungen teilen 20%. Dieses SQL bleibt im Intermediate-Modell; Data Scientists ändern die Datei, Dashboards berühren nichts. Zu parametrisch: definiere `vars.attribution_model: u_shaped` in dbt_project.yml, lese mit `{{ var('attribution_model') }}`.

Mart-Modelle sind die letzte Schicht: Dashboards, BI-Tools oder ML-Pipelines konsumieren direkt. Sie erhalten `fct_`- (Fact) oder `dim_`- (Dimension) Präfixe. `fct_orders`, `dim_customers`, `fct_ad_performance`. Marts sind denormalisiert — Join-Overhead liegt in dbt, nicht im BI-Tool. Statt „in Looker von Order zu Customer joinen" hat `fct_orders` bereits `customer_lifetime_value`, `customer_cohort`.

## Semantic Layer: Metrik-Definition und zentrale Business-Logik

dbt 1.6+ konvertiert SQL zu „Metriken". Früher schrieb jedes Dashboard separate `sum(revenue)`-Queries — jetzt definiert man eine `revenue`-Metrik einmal, alle Dashboards ziehen diese. Metriken sind YAML in `metrics/`:

```yaml
# models/metrics/marketing_metrics.yml
version: 2

metrics:
  - name: total_revenue
    label: Gesamtumsatz
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
    label: Kundenakquisitionskosten (CAC)
    calculation_method: derived
    expression: "{{ metric('total_ad_spend') }} / {{ metric('new_customers') }}"
    timestamp: order_date
    time_grains: [month, quarter]
```

Mit dieser Definition erzeugt „Zeige mir `total_revenue` nach `channel` für letztes Quartal" in Looker automatisch die richtige SQL über dbt Semantic Layer API. Keine SQL-Handschrift — nur Metrik-Aufruf. `customer_acquisition_cost` ist abgeleitet: zwei andere Metriken im Verhältnis. Ändert sich die Formel, justierst du einen Punkt nach, nicht 12 Dashboards einzeln.

Semantic Layer erfordert zweiten Punkt: [First-Party-Datenarchitektur](https://www.roibase.com.tr/de/firstparty) weil Metriken auf Customer-IDs basieren. GA4s `user_pseudo_id` muss mit Shopifys `customer_id` derselben Person entsprechen — Identity Resolution ist Intermediate-Modell. `dim_unified_customers` mergt alle Signale, gibt `canonical_customer_id` zurück. Die Semantic Layer nutzt diese ID. Ohne Canonical-ID ist CAC falsch — ein Kunde wird doppelt gezählt.

## Exposures: Downstream-Konsumption sichtbar machen

Exposures sind dbt's finales Konzept: Erfassen, welche Dashboards, Airflow-Tasks, ML-Modelle diese Pipeline consumen. YAML-Format:

```yaml
# models/exposures/marketing_exposures.yml
version: 2

exposures:
  - name: executive_marketing_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: "CMO Dashboard: Umsatz, CAC, LTV nach Kanal"
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
    description: "BigQuery → Klaviyo Segment-Sync via Hightouch"
    depends_on:
      - ref('dim_unified_customers')
    owner:
      name: CRM Automation
      email: crm@roibase.com.tr
```

Nach `dbt docs generate` zeigt der DAG-Graph Exposures als Endpunkte. Änderst du `fct_orders`, sieht die Lineage, welche Dashboards betroffen sind. Exposures sind auch Alerting-Regeln: Slack-Nachricht „executive_marketing_dashboard hat Upstream-Fehler".

Das Maturity-Feld trackt technische Schulden: `low` Exposures sind temporäre Analysen, `high` sind produktionskritisch. `dbt list --select exposure:executive_marketing_dashboard+` listet den Abhängigkeitsbaum auf — bei Model-Deprecation analysierst du hier den Impact.

## Test Coverage und Data Quality Contract

dbt's Kraft liegt nicht nur in Transformation, sondern Test-Suite. Jedes Modell erhält Tests in `schema.yml`:

```yaml
# models/marts/marketing/fct_orders.yml
version: 2

models:
  - name: fct_orders
    description: "Denormalisierte Order-Fact-Tabelle für BI"
    columns:
      - name: order_id
        description: "Primärschlüssel"
        tests:
          - unique
          - not_null

      - name: customer_id
        description: "Fremdschlüssel zu dim_customers"
        tests:
          - not_null
          - relationships:
              to: ref('dim_customers')
              field: customer_id

      - name: order_total
        description: "Bestellwert in USD"
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

`dbt test` führt diese Checks aus. Anomalien wie `order_total < 0` führen zu Build-Fehler, Slack-Alert. Downstream-Exposures nutzen diesen Contract sicher — Data Quality in der Pipeline, nicht im BI-Tool.

Custom-Tests sind einfach: SQL-Datei in `tests/`. Beispiel: „Kein Kunde darf zwei aktive Abos haben":

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

Liefert diese Query Zeilen, fail der Test. Test-Coverage über 80% reduziert fehlerhaft Dashboard-Alerts deutlich — Roibase-Metrik 2023: ab 85% Coverage sanken falsche Alerts um 60%.

## Pipeline-Orchestrierung und Production-Deployment

Mit dbt Cloud definierst du Scheduled Jobs: täglich um 04:00 läuft `dbt build --select +fct_orders`. Self-Hosted? Airflow-DAG mit `BashOperator` führt dbt-Befehle aus. Inkrementale Strategien reduzieren 90-Tage-Daten auf 5-Minuten-Prozessierung, Full-Refresh wird selten.

CI/CD: PR öffnen → GitHub Actions führt `dbt build --select state:modified+` aus — nur geänderte Modelle und Downstream-Dependencies. Merge → Production-BigQuery-Dataset. Slim CI senkt PR-Build von 40 auf 3 Minuten bei 200-Model-Projekten.

Production lädt `dbt docs generate` statisch zu S3/GCS. Markdown-Dateien sind versioniert — Schema-Änderungen in Git-History sichtbar. Neue Teamitglieder lesen in dbt-Docs, wie jede Metrik berechnet wird — kein Stammtischwissen.

---

dbt + BigQuery ist nicht der einzige Weg, Marketing-Daten in Entscheidungsmechanismen zu binden — aber der wiederholbarste, testbarste und versionierbarste. Source Mapping zähmt Rohdaten, Modeling Layer übersetzt Analytik zu SQL, Semantic Layer zentralisiert Metriken, Exposures machen Downstream sichtbar. Sind diese vier Schichten gebaut, wird „wieviel Budget für welchen Kanal" zur SQL-Antwort — nicht Vermutung, sondern Messung.