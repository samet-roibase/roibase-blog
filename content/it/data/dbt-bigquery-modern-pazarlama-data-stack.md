---
title: "dbt + BigQuery per un Modern Marketing Data Stack"
description: "Source mapping, modeling layer, semantic layer, exposures: trasformare i dati di marketing in un meccanismo decisionale pronto per la produzione."
publishedAt: 2026-06-30
modifiedAt: 2026-06-30
category: data
i18nKey: data-002-2026-06
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

I team di marketing continuano a produrre report con pivot Excel, i data engineer scrivono SQL da zero per ogni nuova domanda, i KPI non si allineano tra i dipartimenti. Nel 2026, tollerare questo scenario è un errore d'ingegneria. Il modern marketing data stack lavora in tre strati: integrazione delle fonti raw, transformation layer, semantic layer. dbt + BigQuery forniscono questi tre strati a livello production-grade — version control, test coverage, lineage tracking inclusi.

## Source Mapping: Spostare i Dati Raw in un'Area Sicura

Estrarre i dati di marketing in BigQuery sembra facile: strumenti ETL come Fivetran, Stitch, Airbyte scrivono GA4, Meta Ads, Google Ads direttamente nello schema `raw_`. Ma dopo 6 mesi il raw table subisce un cambio di schema e i model downstream si rompono. Le **source definitions** di dbt controllano questo rischio.

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

Una source definition serve tre funzioni: **(1)** alert in caso di cambiamenti upstream (la metrica `freshness` invia un messaggio su Slack), **(2)** schema contract (la lista columns funge da documentazione), **(3)** lineage tracking (dbt docs mostra quali model dipendono da GA4). Quando lo schema Fivetran cambia, `dbt compile` genera un errore — non scoppi in produzione.

Durante il source mapping, etichetta anche i segnali di identità: `user_id`, `client_id`, `fbclid`, `gclid`, `email_sha256`. Nel transformation layer successivo, unirai questi segnali in un singolo `customer_id`. Perdere questi segnali nel raw layer rende impossible il lavoro successivo.

### Partitioned Table Strategy

Il wildcard `events_*` di GA4 è partizionato giornalmente (`events_20260630`). In dbt, definisci una source wildcard e aggiungi un filter con `_TABLE_SUFFIX`:

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

Questa config scrive la tabella `stg_ga4_events` in BigQuery con partizioni giornaliere, il cluster su `event_name` + `user_pseudo_id` riduce il query cost. La materializzazione incremental riduce lo scan da 90 giorni a 3 giorni — 30× risparmio di costo.

## Modeling Layer: Codificare la Logica di Business

Lo staging layer pulisce i dati raw, l'intermediate layer costruisce la logica di join, il marts layer risponde alle domande di business. dbt separa questi tre strati con la struttura cartelle: `staging/`, `intermediate/`, `marts/`.

**Esempio di staging** — Standardizza le colonne di Meta Ads:

```sql
-- models/staging/stg_meta_ads.sql
select
  date_start as report_date,
  campaign_id,
  campaign_name,
  spend as cost_usd,
  impressions,
  clicks,
  actions.value as conversions -- estrai dal JSON nested
from {{ source('meta_ads', 'ads_insights') }}
where date_start >= date_sub(current_date(), interval 90 day)
```

**Esempio di intermediate** — Unifica tutti i canali paid media:

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

**Esempio di marts** — Dashboard di performance giornaliera:

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

La funzione `ref()` costruisce il dependency graph di dbt. Il comando `dbt run` esegue i model nell'ordine delle dipendenze. Se `int_paid_media_unified` cambia, tutti i marts table downstream si rigenerano automaticamente.

### Test Coverage

In produzione, un KPI report errato significa errore a sei cifre per l'e-commerce. I test generici di dbt aggiungono una contract a ogni model:

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

Il comando `dbt test` valida questi contract. Nella pipeline CI/CD, se un test fallisce il merge si blocca — i dati errati non escono in produzione. Nel lavoro Roibase su [Architettura First-Party Data & Measurement](https://www.roibase.com.tr/it/firstparty), puntiamo a test coverage del 85% (numero di righe × field critici).

## Semantic Layer: Definisci la Metrica una Sola Volta

Alla fine del 2025, dbt Labs ha integrato "MetricFlow" semantic layer in dbt Cloud. Quando il team di marketing chiede "conversion rate", il data engineer non dovrebbe scrivere SQL da zero — la definizione della metrica deve esistere un'unica volta. Il file `metrics.yml` di dbt fornisce questa astrazione:

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

Lo semantic layer serve due funzioni: **(1)** quando una metrica è selezionata in un BI tool, il SQL si genera automaticamente (integrazione Looker, Tableau, Power BI), **(2)** quando una metrica cambia, tutti i dashboard restano coerenti. Se la decisione è "il CPA deve includere i costi di shipping", cambia una riga — 40 dashboard si aggiornano simultaneamente.

MetricFlow è ancora in beta (giugno 2026), ma pronto per la produzione. Alternativa: scrivi custom metric functions come macro in dbt:

```sql
-- macros/calculate_cpa.sql
{% macro calculate_cpa(cost_column, conversion_column) %}
  safe_divide({{ cost_column }}, nullif({{ conversion_column }}, 0))
{% endmacro %}
```

In tutti i marts model, chiami `{{ calculate_cpa('total_cost', 'total_conversions') }}` — la modifica della metrica si propaga da un'unica fonte.

## Exposures: Collega il Model al Dashboard BI

Il file `exposures.yml` di dbt tiene traccia di quale model viene usato in quale dashboard. Questo tracking è operazionale — quando un model cambia, sai quali dashboard devono essere testati:

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

Il lineage exposure appare nel graph: dopo `dbt docs generate`, nell'interfaccia web puoi cliccare sul node `fct_daily_performance` e vedere quali dashboard dipendono da esso. Se devi fare un breaking change, puoi notificare automaticamente ai proprietari dell'exposure tramite webhook Slack.

### Production Deployment Pattern

I job di dbt Cloud in produzione seguono questo ordine:

1. **Source freshness check** — `dbt source freshness` (fail se i dati upstream sono ritardati)
2. **Model run** — `dbt run --select tag:daily` (i model giornalieri build alle 07:00)
3. **Test execution** — `dbt test` (rollback se violazione dei contract)
4. **Documentation update** — `dbt docs generate` (il lineage graph si aggiorna)

Usare dbt job invece di BigQuery scheduled query ha vantaggi: version control (ogni deploy è legato a un commit git), rollback capability (un model errato torna alla versione precedente in 5 minuti), Slack alerts (test failure + freshness warning).

## Tradeoff: ELT vs Reverse ETL

Lo stack dbt + BigQuery segue il pattern ELT (extract-load-transform) — i dati raw vanno prima nel warehouse, la trasformazione avviene in BigQuery. Alternativa: reverse ETL (Hightouch, Census) — i dati dal warehouse vengono push verso SaaS tool. I due si completano: dbt pulisce il warehouse, reverse ETL invia segment a Braze/Iterable.

Tradeoff: compute cost in BigQuery. 1 TB scanned = $5 — un model marts complesso che gira 10 volte al giorno = $50/giorno = $1500/mese. Ottimizzazione: incremental materialization + partition pruning + clustering. Nei progetti Roibase, il target è $0.02 per monthly active user — 1M MAU = $20K/anno (accettabile).

Il marketing data stack non è un progetto una tantum — è un'architettura in evoluzione. Dopo aver fondato dbt + BigQuery, puoi aggiungere MMM (marketing mix modeling), incrementality test, identity resolution layer. Costruire correttamente questa base richiede 6-8 settimane, ma restituisce 18 mesi di guadagno — ogni nuova domanda KPI ha risposta in 2 ore, la data cleaning manuale sparisce, un cambio di attribution model va da 1 giorno a 1 ora. Stack costruito correttamente trasforma i dati di marketing in meccanismo decisionale.