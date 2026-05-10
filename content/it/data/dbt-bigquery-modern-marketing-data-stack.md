---
title: "dbt + BigQuery: il Modern Stack di Analytics per il Marketing"
description: "Source mapping, modeling layer, semantic layer, exposures — un'architettura a quattro livelli che connette i dati di marketing al decision-making."
publishedAt: 2026-05-10
modifiedAt: 2026-05-10
category: data
i18nKey: data-002-2026-05
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

I team di marketing hanno accesso a più dati che mai, eppure le decisioni rimangono basate su ipotesi. Report assemblati su fogli di calcolo, metriche che cambiano da una dashboard all'altra, tre risposte diverse alla domanda "qual è il vero CAC?". Il problema non è la scarsità di dati — è la perdita lungo il percorso dalla fonte all'insight. L'architettura dbt + BigQuery elimina questa perdita: con lo source mapping raccogli i dati grezzi, con il modeling layer li trasformi in logica aziendale, con il semantic layer crei un linguaggio comune per il team, e con gli exposures li rendi disponibili in produzione.

## Source Mapping: dai Dati Grezzi alla Fonte Affidabile

Lo source mapping è il primo strato di dbt — la trasformazione iniziale dopo aver importato i dati di marketing in BigQuery. Gli event grezzi provenienti da Google Ads API, Meta Ads, Shopify vengono standardizzati nel livello staging. Nel modello `stg_google_ads__campaign_performance` ci sono 127 colonne, ma ne usi 12. Lo source mapping seleziona queste 12, converte i timestamp in UTC, trasforma il campaign_id in stringa, gestisce i null e crea una tabella pulita.

In BigQuery, le sorgenti si definiscono nel file `sources.yml`. Qui configuri i freshness check — se i dati da Google Ads non arrivano entro 2 ore, la dbt run fallisce. È un contratto imposto: il data pipeline diventa affidabile. Invece di scrivere select diretto dalla raw table, usi la macro `{{ source('google_ads', 'campaign_stats') }}` — nel grafo di lineage dbt mostri quale raw table alimenta quale modello.

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

## Modeling Layer: Trasformare la Logica Aziendale in Codice

Dopo lo staging arrivano i livelli intermediate e mart — qui applichi la logica aziendale ai dati di marketing. Nel modello `int_campaign_attribution` calcoli l'attribuzione first-touch e last-touch. In `fct_customer_lifetime_value` analizzi l'LTV per cohort. Questi modelli usano la materializzazione incremental di dbt — ogni run elabora solo gli ultimi 3 giorni, i vecchi record rimangono intatti. Se la tabella `customer_event` in BigQuery ha 40 milioni di righe, dbt con la strategia incremental mantiene il tempo di esecuzione sotto i 2 minuti.

Nel livello mart crei tabelle specializzate per ogni business unit: `mart_paid_media__daily_performance`, `mart_crm__email_engagement`, `mart_finance__revenue_attribution`. Questi si collegano direttamente a Looker Studio, Tableau, Amplitude — ognuno estrae la metrica dal suo dominio dalla stessa fonte. Il calcolo del CAC non è più un dibattito: la formula `paid_media_spend / new_customers` è definita nel modello dbt, passa dalla code review, è testata e versionata in Git.

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

## Semantic Layer: Creare un Linguaggio Comune

Il semantic layer è una feature introdotta in dbt 1.6 — le metriche le definisci come codice e ogni strumento le utilizza. La metrica `revenue` non è `sum(order_total)`, ma `sum(case when payment_status = 'completed' then order_total end)`. Scompare la domanda "gli ordini annullati sono inclusi?". La definizione della metrica è su GitHub. Marketing, finance e product usano la stessa metrica `revenue` — solo con dimensioni diverse.

Nel lavoro di Roibase sulla [strategia di dati first-party e misurazione](https://www.roibase.com.tr/it/firstparty) il semantic layer è un passaggio obbligatorio. Quando unisci customer event da diversi touch point, senza definizioni di metriche standardizzate ogni analisi dà risultati diversi. In dbt il file `metrics.yml` definisce le metriche, che vengono esposte ai BI tool via API — Looker, Hex, Mode leggono dal semantic layer, il numero appare uguale ovunque.

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

## Exposures: Mettere in Produzione

Gli exposures traccia il dipendente downstream — definisci quale dashboard alimenta quale modello dbt. Hai una dashboard Looker "Weekly Campaign Performance" che estrae dati da `mart_paid_media__daily_performance`. Nel file `exposures.yml` registri questa dipendenza. Ora, se apportiamo una breaking change a `mart_paid_media__daily_performance`, dbt ti avverte: "Questo modello alimenta 3 dashboard, fai un impact analysis."

Gli exposures appaiono anche nella documentazione — nei dbt docs, quando clicchi su un modello, vedi "Used in 5 dashboards, 2 reverse ETL jobs, 1 ML pipeline". La lineage si estende fino al livello BI. Sai esattamente quale dashboard viene da quale SQL. Il tempo di debug scende perché individuate il dashboard problematico e risalite al modello sorgente.

| Tipo di Exposure | Utilizzo | Metodo di Tracciamento |
|---|---|---|
| Dashboard | Looker, Tableau, Metabase | URL + model ref |
| Reverse ETL | Census, Hightouch | Job ID + source table |
| ML Pipeline | Vertex AI, SageMaker | Model name + feature table |
| Operational Tool | Braze, Iterable segmentation | Segment ID + dbt model |

## Pipeline Orchestration: il Ritmo di Ogni Livello

Orchestri il pipeline con dbt Cloud Scheduler o Airflow. Alle 6:00 del mattino i dati grezzi vengono caricati in BigQuery (Fivetran, Stitch, Airbyte), alle 6:30 parte dbt run. I modelli staging completano in 5 minuti, gli intermediate in 10, i mart in 15. Alle 7:00 il semantic layer è esposto, alle 7:15 le dashboard Looker si aggiornano. Quando il team arriva in ufficio alle 9:00 ha già i dati di ieri — niente delay di 3 ore.

Ogni run esegue la test suite: `not_null`, `unique`, `accepted_values`, `relationships`. Se in `stg_google_ads__campaign_performance` il `campaign_id` non è unico, dbt run fallisce. Un alert arriva su Slack. Il gate di qualità dei dati è enforcement a livello di codice. I dati rotti non raggiungono la produzione.

```yaml
# dbt_project.yml on-run-end hooks
on-run-end:
  - "{{ log_dbt_results() }}"
  - "{{ send_slack_notification() }}"
  - "{{ update_looker_cache() }}"
```

## Trade-off: Complessità vs Governance

Lo stack dbt + BigQuery introduce complessità. Nel team di analyst la competenza SQL diventa obbligatoria — "faccio un pivot in Excel" non basta più. Git workflow, code review, CI/CD pipeline sono concetti da imparare. Su team piccoli questo overhead può essere costoso. Ma il trade-off è netto: guadagni governance. Invece di formula persa in un foglio, hai codice sotto version control. "Da dove viene questo numero?" si risponde con Git blame in 10 secondi.

Il costo di BigQuery è un altro trade-off. I full table scan sono cari — la strategia di partition e cluster è obbligatoria. Nei modelli dbt incremental, i config `partition_by` e `cluster_by` sono critici. Una pipeline che elabora 100 GB al mese su BigQuery genera ~$50 di slot cost + $5 di storage. È un managed service, niente overhead infra, ma se non ottimizzi le query la fattura sale.

Connettere i dati di marketing al decision-making non è più risolvibile con fogli di calcolo e BI tool. Lo stack dbt + BigQuery codifica ogni livello dalla fonte all'exposure. Lo source mapping rende i dati grezzi affidabili, il modeling layer applica la logica aziendale, il semantic layer crea il linguaggio comune, gli exposures li mettono in produzione. Code review, test, version control — il data pipeline è ora gestito con la disciplina dello sviluppo software.