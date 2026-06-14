---
title: "dbt + BigQuery con il Modern Marketing Data Stack"
description: "Dal source mapping al semantic layer: come trasformate i dati di marketing in meccanismi decisionali? L'architettura di modeling dbt, le definizioni di exposure e la pipeline di produzione."
publishedAt: 2026-06-14
modifiedAt: 2026-06-14
category: data
i18nKey: data-002-2026-06
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

I team di marketing nel 2026 non lottano con i dati, ma prendono decisioni con i dati. GA4, Meta Ads, Google Ads, CRM, CDP, server-side GTM — tutti scaricano in tabelle separate. Il team fa merge manuale in spreadsheet, i numeri cambiano ogni settimana, nessuno si fida. Questo caos scompare con il modern data stack: BigQuery come fonte, il layer di trasformazione dbt, il semantic layer come albero degli indicatori. Versionizzate il codice nel repository, ogni modifica viene testata, le metriche provengono da un'unica source of truth. Questo articolo mostra come la combinazione dbt + BigQuery trasforma la pipeline di marketing in production-grade.

## Source mapping: standardizzare i percorsi dei dati grezzi

Il primo compito di dbt è il source mapping — normalizzare i dati grezzi da sistemi diversi nello stesso schema. In BigQuery la tabella `analytics_123456.events_*` arriva da GA4, `facebook_ads.ads_insights` dall'API Meta, `crm.transactions` da Shopify. Ognuno ha formati timestamp diversi, identificatori utente diversi, colonne currency diverse. Nel file `sources.yml` di dbt definite le tabelle grezze:

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

Questa definizione dice a dbt "queste sono fonti upstream, non le tocco ma ne testo la freschezza". Il comando `dbt source freshness` controlla quando sono arrivati gli ultimi dati — se l'API Meta ritarda, genera un avviso. Senza source mapping ogni modello scrive direttamente `SELECT * FROM analytics_123456.events_20260614`, e se il nome della tabella cambia, 40 modelli si rompono. Con il mapping il riferimento diventa `{{ source('ga4', 'events_') }}`, il cambiamento si propaga da un solo punto.

Il `event_timestamp` di GA4 è in microsecondi Unix, il `date_start` di Meta è una stringa ISO, il `created_at` del CRM è datetime UTC — formati diversi. Nel source mapping estraete una colonna timestamp standard: `TIMESTAMP_MICROS(event_timestamp) AS event_time` per GA4, `PARSE_TIMESTAMP('%Y-%m-%d', date_start) AS event_time` per Meta. Questa normalizzazione fornisce input pulito ai modelli downstream.

## Modeling layer: staging, intermediate, mart

La potenza di dbt risiede nel modeling in strati — staging, intermediate, mart. I modelli staging estraggono dai source in rapporto 1:1, facendo solo rename e type casting. `stg_ga4_events.sql`:

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

Lo staging fornisce dati puliti ma senza logica di business. I modelli intermediate aggiungono la logica di business: sessionization, attribution, funnel steps. `int_sessions.sql` aggrega gli eventi GA4 a livello di sessione:

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

I modelli mart sono il layer di consumo finale — il tool BI, Looker, i dashboard interni guardano qui. `fct_marketing_performance.sql` unisce tutti i canali, calcola spend + revenue + ROAS. Ogni modello mart si concentra su una singola entità di business: `dim_customers`, `fct_orders`, `fct_sessions`. La convenzione di naming è critica — `dim_` per le dimensioni (cliente, prodotto), `fct_` per i fatti (transazione, evento), `rpt_` per gli aggregati di report.

## Semantic layer: le definizioni KPI come codice

Il semantic layer porta le definizioni delle metriche dentro dbt — "cos'è il revenue", "come si calcola il CAC" non sono più in uno spreadsheet ma in YAML. Con dbt v1.6+ costruite l'albero degli indicatori nel file `metrics.yml`:

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

Con il semantic layer il tool BI non calcola il CAC, lo fa dbt. Quando Looker chiede "dammi il CAC", dbt restituisce SQL compilato che join la tabella spend e quella dei nuovi clienti e divide. La definizione è codice, quindi ha cronologia git — "chi ha cambiato il calcolo del CAC e perché" è tracciato. La formula nel foglio di calcolo non scompare, ha il version control.

Nei progetti Roibase il semantic layer rientra nell'ambito di [analisi dati e ingegneria delle insights](https://www.roibase.com.tr/it/verianalizi) — non solo la definizione della metrica ma anche il mapping dell'albero KPI, la gerarchia delle dimensioni, la standardizzazione dei grain. Esempio: la metrica "revenue" è la somma di `fct_orders.order_amount`, ma "recognized_revenue" è la stessa tabella filtrata per `recognized_at` timestamp (per il modello di subscription SaaS). Una sola tabella, due metriche, logica di business diversa.

## Exposures: rendere visibili le dipendenze downstream

L'exposure di dbt risponde alla domanda "chi usa questo modello". Se il dashboard Looker guarda la tabella `fct_marketing_performance`, lo definite in `exposures.yml`:

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
    description: "Dashboard di marketing per i dirigenti — refresh giornaliero, finestra mobile di 90 giorni"
    url: https://looker.company.com/dashboards/123
```

Senza la definizione di exposure, quando modificate `fct_marketing_performance` non sapete quale dashboard si è rotto. Looker mostra metrica zero, passate 2 ore a debuggare. Con exposure il comando `dbt compile --select +exposure:marketing_dashboard` mostra tutti i modelli upstream, fate l'analisi di impatto prima di cambiare.

L'exposure non è solo per i tool BI — anche per reverse ETL (Hightouch, Census). Se sincronizzate la tabella `customers` in Meta CAPI:

```yaml
exposures:
  - name: meta_capi_sync
    type: application
    maturity: high
    depends_on:
      - ref('dim_customers')
    description: "Meta Conversion API — eventi cliente incrementali, delay di 5 minuti"
```

Questa definizione avverte "se modifichi dim_customers, lo schema dell'evento verso Meta si rompe". In production: aggiornamento modello → errore di sincronizzazione CAPI → perdita di dati di attribution — questo avviso precoce previene la catena.

## Production pipeline: incremental builds e copertura di test

dbt in production non esegue full refresh ogni giorno — usa i modelli incrementali. `fct_orders.sql` rielabora solo gli ultimi 3 giorni:

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

La build incrementale riduce i costi di BigQuery del 90% — al posto di scansionare 2TB della tabella, ne scansionate 50GB. Partizione + clustering migliora le performance delle query: una query `WHERE customer_id = 'X'` colpisce solo il cluster rilevante, niente full scan.

La copertura di test è critica. In `schema.yml` di dbt scrivete test per ogni modello:

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

Il comando `dbt test` afferma queste condizioni in BigQuery — se order_amount diventa negativo, la build fallisce. In production ogni commit è testato da una pipeline CI/CD: `dbt run --select state:modified+ → dbt test --select state:modified+`. Esegue il modello modificato + le dipendenze downstream e li testa, se non ci sono problemi il merge è consentito.

## Orchestration: Airflow, Prefect, dbt Cloud

dbt non è un orchestrator autonomo — è schedulato con Airflow o Prefect. Esempio di DAG Airflow:

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

dbt Cloud è l'alternativa — orchestrazione gestita, Web IDE, avvisi Slack. Ma molte enterprise preferiscono Airflow perché ci sono altri task oltre a dbt: pull API upstream, reverse ETL downstream, snapshot di tabelle.

La strategia di schedule è legata alla freschezza dei dati. GA4 ha un delay di 24 ore (processing_date ≠ event_date), l'API Meta Ads Insights non è real-time. I modelli staging sono attivati dalla freschezza della fonte — quando GA4 ha una nuova partition, `stg_ga4_events` si refresh, e la catena intermediate → mart si propaga. Un operatore sensor di Airflow controlla il suffisso della tabella di BigQuery:

```python
wait_for_ga4 = BigQueryTableExistenceSensor(
    task_id='wait_for_ga4_partition',
    project_id='analytics_123456',
    dataset_id='events_',
    table_id=f"events_{yesterday.strftime('%Y%m%d')}",
    poke_interval=300
)
```

Quando la partition è pronta, la catena dbt inizia. Questo pattern risolve il problema dei dati che arrivano in ritardo — il ritardo dell'API non blocca la pipeline, la mette in pausa.

## Tradeoffs: cosa dbt non risolve

dbt è un transformation engine, non un data loader. Chi carica i dati in BigQuery? Fivetran, Airbyte, uno script Python personalizzato. dbt assume nel source mapping che i dati grezzi siano già lì. Pattern ELT: Extract-Load-Transform. Diverso da ETL perché il transform è dentro il warehouse. dbt è questo strato T, EL è un toolchain separato.

dbt non supporta streaming real-time. Kafka → BigQuery streaming insert → la catena di modelli incrementali dbt produce un delay di minuti. Se avete bisogno di latenza sub-secondo (rilevamento frodi, pricing dinamico), dbt non è sufficiente — servono processori di stream come Flink, Spark Structured Streaming, Materialize.

Il supporto di dbt per i modelli Python (v1.3+) è limitato. Potete fare manipolazione di dataframe Pandas ma non addestrate modelli ML pesanti in dbt. Pattern comune: feature engineering in dbt, addestramento del modello in Vertex AI, inferenza in BigQuery ML. Il modello Python di dbt assomiglia a questo:

```python
def model(dbt, session):
    df = dbt.ref('stg_orders').to_pandas()
    df['log_amount'] = np.log1p(df['order_amount'])
    return df
```

Ma è solo feature generation — non adattate scikit-learn. BigQuery è compute costoso, il runtime Python ha overhead elevato. Le trasformazioni complesse sono più veloci in SQL.

## Cosa fare adesso

Se i vostri dati di marketing sono ancora in spreadsheet con merge manuale, il primo passo è stabilire il flusso di dati grezzi verso BigQuery. Export GA4, connettore API per Meta/Google Ads (Fivetran/Supermetrics), webhook CRM → BigQuery streaming insert. Con i dati grezzi pronti, aprite il repository dbt: modelli staging per il source mapping, modelli intermediate per sessionization/attribution, modelli mart per i KPI finali. Le prime 2 settimane bastano per la tabella `fct_sessions` e `fct_orders` — i dashboard guardano qui, le metriche si stabilizzano. Il semantic layer arriva nella settimana 3, il mapping di exposure nella settimana 4. Dopo 6 settimane la pipeline di produzione gira git-controlled