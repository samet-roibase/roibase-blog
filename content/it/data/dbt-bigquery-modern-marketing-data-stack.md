---
title: "dbt + BigQuery con Stack Moderno di Marketing Data"
description: "Source mapping, modeling layer, semantic layer, exposures: architettura production-ready che collega i dati di marketing al meccanismo decisionale con dbt e BigQuery."
publishedAt: 2026-05-29
modifiedAt: 2026-05-29
category: data
i18nKey: data-002-2026-05
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

I team di marketing ancora oggi affermano: "Non posso sapere la performance della campagna senza guardare il dashboard". L'analista scrive nuovo SQL per ogni domanda. Il CFO non capisce perché il CAC cambia in ogni report. Il problema non è tecnico — la pipeline c'è, le fonti sono connesse, i dati fluiscono. Il problema è architetturale: non esiste uno strato di definizione tra le tabelle sorgente e il dashboard. La combinazione dbt + BigQuery risolve questo: con source mapping, modeling layer, semantic layer, exposures standardizzi i dati a livello di logica, non visivamente.

## Source Mapping: Legare i Dati Grezzi a un Contratto

In BigQuery confluiscono dati da CRM, GA4, Meta Ads, Klaviyo. Ogni fonte usa schemi diversi, naming convention diversi, formati di timestamp diversi. Il dbt source mapping permette di dichiarare queste fonti come codice e testarle. Nel file `sources.yml` dichiaro ogni tabella, applico controlli di freshness, testo vincoli di unicità.

Esempio di definizione source:

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

Questa definizione stabilisce un contratto: "Se l'evento GA4 non arriva entro 6 ore, avvisa. Se non arriva entro 12 ore, fallisci." In production, questo test si integra nella CI/CD — rivela istantaneamente problemi della fonte. dbt docs genera automaticamente un grafo di lineage — vedi quale dashboard dipende da quale source.

Senza source mapping, l'analista scrive `SELECT * FROM analytics_lake.raw_ga4_events.events`. Non sa cosa significano le colonne, non ci sono test, niente documentazione. Con dbt, fai riferimento alla fonte: `{{ source('raw_ga4', 'events') }}`. Se il nome della tabella cambia, aggiorni un solo posto e tutti i modelli downstream si adattano automaticamente.

## Modeling Layer: Staging, Intermediate, Mart

La potenza di dbt risiede negli strati di modeling. Dividi il lavoro in tre livelli: staging (normalizza il formato dalla fonte), intermediate (applica la logica di business), mart (tabelle di metriche finali).

**Layer staging:** Un modello 1:1 per ogni source. Solo conversione di tipo dato, rinominazione colonne, timestamp in UTC. Nessuna logica di business.

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

**Layer intermediate:** Applica la logica di business. Definisci sessioni, mappa categorie prodotto, applica finestre di attribution. Questi modelli non vanno all'utente finale — forniscono solo input ai modelli downstream.

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

**Layer mart:** Tabelle di metriche finali. Ciò che si connette al dashboard, al BI tool, a Looker. Usa il prefisso `fct_` (fact) o `dim_` (dimension).

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

Con questa struttura, l'analista usa la tabella `fct_daily_channel_performance` senza toccare staging/intermediate. Se la definizione di una metrica cambia, si aggiorna in un solo posto e tutti i dashboard rimangono coerenti.

## Semantic Layer: Codifica le Definizioni di Metrica

Nella combinazione BigQuery + dbt, il "semantic layer" si applica in due modi: dbt metrics (deprecato nel 2023) o dbt semantic models (nuovo approccio). Un semantic model astrae la metrica dall'SQL e la definisce in YAML. Strumenti come Looker, Tableau e Mode leggono questa definizione e calcolano CAC, LTV, ROAS in modo coerente.

Esempio di semantic model:

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

Con questa definizione, la metrica "revenue per user" si calcola ovunque nello stesso modo. L'analista seleziona "RPU" in Looker, il backend estrae dal semantic layer di dbt, niente SQL manuale. Se la definizione cambia (escludere ordini annullati), si aggiorna in un posto solo.

Senza semantic layer, ogni dashboard riscritto il calcolo "revenue / users". Un report esclude i rimborsi, un altro li include. Il CMO vede due numeri diversi e perde fiducia. Integrando [First-Party Veri & Architettura di Misurazione](https://www.roibase.com.tr/it/firstparty), questo layer in production è critico — definisci attribution, consent e segnali TCF con la stessa logica.

## Exposures: Monitora i Punti Finali di Utilizzo dei Dati

Un dbt exposure risponde alla domanda: "Questo modello dove va? A quale dashboard, quale pipeline ML, quale sistema operazionale?" La definisci in `exposures.yml`:

```yaml
exposures:
  - name: marketing_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: "Dashboard giornaliero di performance per canale del CMO"
    depends_on:
      - ref('fct_daily_channel_performance')
    owner:
      name: Marketing Analytics Team
      email: analytics@company.com
```

La definizione di un exposure offre due vantaggi: **impact analysis** (se cambio questo modello, quali dashboard si rompono?) e **stakeholder mapping** (chi è il proprietario del dashboard, a chi escalare il problema?).

In production, gli exposures funzionano così: dbt build → test fallisce → vedi dal grafo di lineage quali exposure sono colpiti → invia notifica automatica su Slack → il proprietario del dashboard viene avvisato subito. Così il problema arriva al team dai sistemi CI/CD, non dall'utente che dice "il dashboard è vuoto".

Senza exposures, il data team deploya modelli al buio, non sa chi viene colpito. Con exposures, ogni modello porta l'etichetta "questa tabella è in production, non toccare".

## Incremental Models e Partitioning: Costo + Prestazioni

Su BigQuery, una scansione completa della tabella è costosa. 1 TB di dati = query da $5, 10 query al giorno = $50, al mese = $1500. Con i modelli incremental di dbt, processi solo le nuove righe — i dati precedenti rimangono immutabili.

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

Questa configurazione applica l'ottimizzazione: ogni esecuzione processa solo gli ultimi 2 giorni, i dati storici rimangono intatti. Con `partition_by`, BigQuery applica partition pruning. Con `cluster_by`, la selectivity della query aumenta. Su lo stesso dataset, il costo scende del 90%.

In production, il modello incremental + dbt snapshot implementa SCD Type 2: registri i cambiamenti storici nella dimension table (quando cambia il segmento utente, il mapping categoria prodotto). Quando l'analista chiede "a quale segmento apparteneva l'utente X il mese scorso", legge dallo snapshot — i dati sono coerenti.

## Production Pipeline: CI/CD, Tests, Alerts

Il progetto dbt vive su GitHub, ogni commit scatena la CI pipeline:

1. **Lint:** Valida il formato SQL con `sqlfluff`
2. **Test:** Esegui `dbt test` per schema test (not_null, unique, foreign_key) e data test (revenue > 0, session_duration < 24h)
3. **Build:** `dbt build --select state:modified+` ricostruisce solo i modelli modificati
4. **Deploy:** Al merge in production, BigQuery aggiorna le tabelle

Se un test fallisce, il merge è bloccato. Esempio di data test:

```sql
-- tests/assert_no_negative_revenue.sql
SELECT * FROM {{ ref('fct_daily_channel_performance') }}
WHERE revenue < 0
```

Se la query restituisce 0 righe, pass. Se ne restituisce anche una, fail. In production, una revenue negativa è anomalia, la pipeline si ferma.

Scenario di alert: Su dbt Cloud, pianifichi il job (ogni giorno alle 06:00), invia notifica Slack tramite `on-run-end` hook:

```yaml
on-run-end:
  - "{{ post_to_slack_on_failure() }}"
```

Integrare [Analisi Dati & Ingegneria dell'Insight](https://www.roibase.com.tr/it/verianalizi) con questa pipeline in production richiede 4-6 settimane: source mapping + staging layer + intermediate layer + mart + semantic model + exposure + test + CI/CD.

## Tradeoff: Complessità vs Controllo

Lo stack dbt + BigQuery ha una curva di apprendimento ripida. Non basta saper scrivere SQL — serve Jinja templating, config YAML, flusso Git, CI/CD. Per team piccoli (1-2 persone), questo overhead può sembrare eccessivo — partire con view BigQuery dirette + Looker Studio è più veloce.

Ma quando la scala cresce (10+ dashboard, 50+ source, 5+ analisti), senza dbt il controllo si perde. Ogni analista scrive il proprio SQL, le definizioni di metrica si contraddicono, niente test, documentazione assente. dbt consente di pagare il debito tecnico ora invece di accumularlo.

Approccio alternativo: definire il semantic layer con LookML su Looker. LookML è simile a dbt (metriche come codice), ma crea vendor lock-in — connettersi a source non-BigQuery è complesso. dbt è open source, portabile tra BigQuery/Snowflake/Redshift.

Lo stack moderno di marketing data inizia con source mapping, scala con semantic layer, monitora con exposure. dbt + BigQuery codificano questi tre strati, li rendono testabili, versionabili, riproducibili. Garantisci la coerenza delle metriche indipendentemente da chi guarda il dashboard.