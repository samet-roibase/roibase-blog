---
title: "dbt + BigQuery con Data Stack Moderno per il Marketing"
description: "Source mapping, modeling layer, semantic layer, exposures — l'architettura che collega i dati di marketing al processo decisionale e l'implementazione pratica di dbt."
publishedAt: 2026-08-02
modifiedAt: 2026-08-02
category: data
i18nKey: data-002-2026-08
tags: [dbt, bigquery, data-stack, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

I team di marketing non utilizzano più i report predefiniti di Google Analytics, ma pipeline dati che scrivono e controllano direttamente. Nel 2026, il data stack moderno per il marketing si compone di tre livelli: sorgenti raw, modeling layer, semantic layer. Questo articolo spiega come costruire questi tre livelli con dbt + BigQuery, quali errori si commettono a ogni stadio e come strutturare un'architettura sostenibile in produzione.

## Source mapping: caricare dati in BigQuery non basta

Hai caricato GA4, Meta Ads, sGTM event in BigQuery — ma è solo l'inizio. Source mapping significa trasformare le tabelle raw in contract significativi. In dbt, le definizioni di source vivono in file `.yml`:

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

Questa definizione realizza tre cose: (1) Data lineage — quale modello utilizza quale tabella raw, (2) Freshness check — se l'ultimo event è più vecchio di 12 ore, un alert viene generato, (3) Contract — se manca la colonna `event_timestamp`, il build fallisce.

**L'errore più comune:** usare lo schema raw così com'è. Scrivere SQL senza flatten l'array `event_params` di GA4, ogni query diventa 200+ righe. La logica di unnest deve vivere in un'unica posizione durante il source mapping:

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

Questo modello viene ora richiamato downstream come `ref('stg_ga4_events')` — la sintassi raw di event_params è isolata upstream. Il freshness check gira ogni giorno, errori di schema modification vengono catturati automaticamente.

## Modeling layer: definisci la metrica una volta, usala cento volte

Dopo il layer di staging, viene il modeling layer. Qui si separano i modelli intermedi (business logic) dai mart models (aggregazione). Nel data stack di marketing, il modello critico è il join **session → transaction**:

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

Questo modello gira ogni giorno alle 03:00 (dbt Cloud scheduler), Looker Studio si connette direttamente a questa tabella. Quando è necessario fare modifiche, cambi l'SQL in un'unica posizione e tutti i dashboard si aggiornano automaticamente.

**Dettaglio importante:** l'uso di `safe_divide` — se sessions = 0, non genera un errore di divisione per zero, ma ritorna null. La gestione delle eccezioni in una production pipeline avviene a questo livello.

### dbt tests: verifica della qualità dati automatica

Mentre definisci le metriche nel modeling layer, scrivi anche i test:

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

Il comando `dbt test` esegue queste regole. Se il conversion rate > 1 (significa che c'è un errore SQL), il build fallisce e un alert viene inviato a Slack. Invece di QA manuale, ottieni controllo di qualità dei dati automatizzato — il resto dello stack dati è costruito su questa base solida.

## Semantic layer: definisci la metrica, non la query

Con dbt v1.6+, il semantic layer è uscito dalla fase beta. Ora definisci la metrica in un file `.yml`, non in SQL:

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

Questa definizione viene utilizzata in tre contesti: (1) Looker Studio, (2) Slack bot che interroga la dbt Cloud discovery API per metriche, (3) DAG Airflow con input a pipeline ML downstream.

**Il vantaggio:** le metriche sono consumabili senza scrivere SQL. L'analyst di marketing non conosce il SQL e scrive "Show me ROAS by campaign, last 7 days" — il semantic layer di dbt compila automaticamente la query. La logica SQL sta nel modeling layer, la definizione della metrica nel semantic layer — sono separate e i cambiamenti sono isolati.

**Attenzione:** il semantic layer è ancora nuovo — non tutti gli strumenti BI hanno integrazione nativa. In Roibase usiamo un approccio ibrido: le metriche critiche nel semantic layer, gli analytics personalizzati tramite SQL exposure.

### Exposures: documenta le dipendenze downstream

Gli exposure mostrano dove un modello dbt viene utilizzato al di fuori:

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

Questa definizione è visualizzata nella documentazione dbt — quale dashboard dipende da quale modello, chi va notificato se il modello cambia. In produzione, quando fai un breaking change nello schema, esegui `dbt run --select +mrt_session_metrics+` e vedi tutti gli impatti downstream.

**Scenario reale:** il parametro GA4 `page_location` è diventato `page_url`. Grazie agli exposure, abbiamo identificato 3 dashboard e 1 DAG Airflow interessati — la migrazione è stata completata in 2 ore. Senza exposure, i dashboard si sarebbero rotti silenziosamente, lo avremmo scoperto dai reclami dei utenti.

## Incremental models: non fare un rebuild completo di 2TB ogni giorno

Nel data di marketing, le partizioni daily raggiungono terabyte. Non puoi fare un refresh completo ad ogni comando `dbt run` — il costo BigQuery e il tempo sono inaccettabili. Usi i modelli incrementali:

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

Questa configurazione fa tre cose: (1) Crea partition in BigQuery — aggiunge il nuovo giorno senza toccare quelli precedenti, (2) La clausola `cluster_by` migliora le performance delle query, (3) La strategia `insert_overwrite` — elimina gli ultimi 3 giorni e li riscrive (per gestire late arriving data).

**Differenza di costo:** 365 giorni di dati, refresh completo = 2,5 TB scan ($12,50), incremental = 3 GB scan ($0,015). Per una pipeline che gira quotidianamente, la differenza annua è ~$4500 vs ~$5. Per questo i modelli incrementali sono la base dello stack dati in produzione.

## Connettere lo stack dati al processo decisionale

dbt + BigQuery costruiscono l'infrastruttura, ma il valore reale è nell'impatto sulle decisioni di marketing. Un flusso tipico dal semantic layer a Slack:

1. Il manager marketing scrive in Slack: `/metric roas last_30_days campaign=brand`
2. L'app Slack chiama l'API del semantic layer di dbt Cloud
3. L'API interroga la tabella `mrt_session_metrics` e calcola il ROAS
4. Il risultato torna a Slack: "Campagna brand ROAS: 4.2x"

Questo flusso richiede il semantic layer dbt + un middleware Python personalizzato. Nello stack di produzione Roibase, un DAG Airflow cattura uno snapshot giornaliero dal semantic layer — Looker Studio e le app interne usano questo snapshot, evitando problemi di API rate limit.

**Approccio alternativo:** nello stack ibrido che utilizziamo nel nostro servizio [Dati First-Party & Architettura di Misurazione](https://www.roibase.com.tr/it/firstparty), usiamo dbt semantic layer + Cube.js. Cube.js aggiunge un layer di caching, migliorando la performance della BI. La scelta dipende dal volume dei dati e dal pattern di query.

## Production checklist: prima di deployare lo stack dbt

dbt funziona in locale — prima di passare in produzione, esegui questi controlli:

- **CI/CD:** con dbt Cloud o GitHub Actions, esegui `dbt build --select state:modified+` ad ogni commit
- **Freshness monitoring:** per le sorgenti critiche, definisci `warn_after` e `error_after`
- **Alerting:** integra dbt Cloud webhook con Slack — se il build fallisce, il team è notificato in 5 minuti
- **Documentazione:** `dbt docs generate` deve girare automaticamente, gli artifact vanno pushed su S3/GCS
- **Cost monitoring:** usa BigQuery slot reservation o attiva alert sui costi on-demand — imposta una soglia di $500/day per spike inaspettati
- **Backup strategy:** mantieni una snapshot table nel data warehouse di produzione — se un modello viene aggiornato male, puoi fare rollback

**Regola critica:** in produzione, nessun `dbt run` manuale. Tutta l'esecuzione deve passare attraverso uno scheduler (dbt Cloud, Airflow, Prefect). L'esecuzione manuale rompe la data lineage — se c'è un errore, il root cause analysis diventa impossibile.

dbt + BigQuery è la spina dorsale dello stack di marketing moderno — con source mapping hai collegato i dati raw a contract significativi, il modeling layer ti permette di definire la metrica una sola volta, il semantic layer consente anche a chi non conosce SQL di consumare metriche. In produzione, i modelli incrementali e il coverage dei test rendono la pipeline sostenibile. Il prossimo passo è collegare questi dati all'attivazione real-time — CDP, audience sync, misurazione dell'incrementalità. Ma questo è un'altra discussione su data stack.