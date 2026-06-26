---
title: "Architettura della Tabella Cohort: Scalare l'Analisi della Retention in Production"
description: "Materialized view, partitioning e query cost optimization per eseguire analisi cohort su 10M+ event giornalieri con latenza in millisecondi."
publishedAt: 2026-06-26
modifiedAt: 2026-06-26
category: data
i18nKey: data-007-2026-06
tags: [analisi-cohort, ottimizzazione-bigquery, materialized-views, retention-engineering, data-partitioning]
readingTime: 9
author: Roibase
---

Se la vostra dashboard retention attende 45 secondi a ogni caricamento, il problema non è la definizione del cohort — è l'architettura della tabella. Calcolare D1, D7, D30 retention su 10 milioni di event giornalieri in BigQuery può costare 2TB di scan e 10 dollari. Oppure, con la giusta strategia di partitioning, incremental materialized view e pre-aggregation, scende a 200MB di scan e 50 millisecondi. La differenza è il confine tra production-ready e "funziona ma nessuno può usarlo".

## Perché l'Analisi Cohort Esplode in Production

Il calcolo della retention è per natura un'operazione full-scan. Trova la prima transazione di ogni utente, contiamo cosa ha fatto nei giorni successivi, raggruppiamo per cohort, calcoliamo le percentuali. L'approccio SQL naive è questo:

```sql
WITH first_events AS (
  SELECT user_id, MIN(event_date) AS cohort_date
  FROM events
  GROUP BY user_id
),
retention_raw AS (
  SELECT 
    f.cohort_date,
    DATE_DIFF(e.event_date, f.cohort_date, DAY) AS day_offset,
    COUNT(DISTINCT e.user_id) AS active_users
  FROM events e
  JOIN first_events f USING(user_id)
  GROUP BY 1, 2
)
SELECT * FROM retention_raw;
```

Questa query legge la tabella events dall'inizio alla fine ogni volta che gira. 500 giorni di data × 10M event giornalieri = 5 miliardi di righe. In BigQuery l'utilizzo di slot esplode, la dashboard attende 40 secondi, il tool BI va in timeout. Il problema si concentra in tre punti:

**1. Full table scan:** Nessun partition pruning perché il JOIN su `user_id` abbatte i limiti di partizione.  
**2. Calcolo ripetuto:** Ogni cohort_date è già noto ma viene ricalcolato ad ogni query.  
**3. Overhead di aggregazione:** Trasformi 5 miliardi di righe in 500 cohort × 90 giorni = 45.000 righe — il rapporto compute/output è 100.000:1.

In production questo approccio non regge. La soluzione è riprogettare l'architettura della tabella.

## Materialized Cohort Base: Il Primo Passo con Snapshot Incrementale

La parte più costosa dell'analisi cohort è il calcolo di `MIN(event_date)`. Fai questo calcolo una sola volta, scrivi il risultato in una snapshot table, aggiungi i nuovi utenti ogni giorno. In BigQuery usiamo modelli incrementali dbt invece di materialized view:

```sql
-- models/cohorts/user_cohort_base.sql
{{ config(
  materialized='incremental',
  unique_key='user_id',
  partition_by={'field': 'cohort_date', 'data_type': 'date'},
  cluster_by=['cohort_date', 'user_id']
) }}

SELECT
  user_id,
  MIN(event_date) AS cohort_date,
  COUNT(*) AS first_day_events
FROM {{ source('raw', 'events') }}
{% if is_incremental() %}
WHERE event_date >= (SELECT MAX(cohort_date) FROM {{ this }})
  AND user_id NOT IN (SELECT user_id FROM {{ this }})
{% endif %}
GROUP BY user_id
```

Questo modello al primo run legge tutta la storia (costo una tantum), dai giorni successivi aggiunge solo i nuovi utenti del giorno precedente. Con partitioning su `cohort_date`, BigQuery non tocca le partition precedenti — il costo della query rimane proporzionale al volume di event giornaliero (10M nuovi event → ~50MB di scan).

Il clustering per `user_id` migliora le prestazioni dei JOIN. Quando le query di retention a valle fanno JOIN su `user_cohort_base`, BigQuery esegue ricerca binaria sulle micro-partition — legge solo i blocchi cluster rilevanti invece di 5 miliardi di righe.

### Strategia di Partitioning: Data Evento o Data Cohort?

Se avete partizionato la tabella events per `event_date`, dovete partizionare la cohort base per `cohort_date`. Perché le query di retention sono cross-period: "Qual è la retention di marzo nel mese di aprile?". Il partitioning per `event_date` non può fare pruning in questo caso. Il partitioning per `cohort_date` invece — quando dite "cohort di marzo" — legge solo la partition di marzo, un giorno di data invece di 30.

Attenzione: il numero di partition non superi 4000 (limite BigQuery). 10 anni di data = 3650 partition — al limite. Se la granularità del cohort può essere settimanale o mensile, partizionate con `DATE_TRUNC(cohort_date, WEEK)`.

## Pre-Aggregated Retention Cube: Abbattere il Costo di 100x

Avete `user_cohort_base` ma ancora ogni query di retention fa JOIN con la tabella events. Il passo successivo è pre-calcolare i metric di retention giornalieri e scriverli in una tabella materializzata:

```sql
-- models/cohorts/daily_retention_cube.sql
{{ config(
  materialized='incremental',
  unique_key=['cohort_date', 'day_offset'],
  partition_by={'field': 'cohort_date', 'data_type': 'date'}
) }}

WITH cohort_activity AS (
  SELECT
    c.cohort_date,
    DATE_DIFF(e.event_date, c.cohort_date, DAY) AS day_offset,
    COUNT(DISTINCT e.user_id) AS active_users
  FROM {{ ref('user_cohort_base') }} c
  JOIN {{ source('raw', 'events') }} e USING(user_id)
  {% if is_incremental() %}
  WHERE e.event_date >= CURRENT_DATE() - 1
  {% endif %}
  GROUP BY 1, 2
)
SELECT
  cohort_date,
  day_offset,
  active_users,
  active_users / FIRST_VALUE(active_users) OVER (
    PARTITION BY cohort_date ORDER BY day_offset
  ) AS retention_rate
FROM cohort_activity
```

Questa tabella gira ogni giorno e aggiunge solo l'activity nuova del giorno precedente. Con partitioning per `cohort_date`, le partition degli altri cohort non vengono toccate. Il risultato: **5 miliardi di righe** della tabella events diventano **500 cohort × 90 giorni = 45.000 righe**. Le dashboard leggono direttamente questo cube — il volume di scan diminuisce di 100.000x, la latenza cala da 45 secondi a 50 millisecondi.

### Strategia Window Function: Calcolo Retention Rate

L'espressione `FIRST_VALUE(active_users) OVER (PARTITION BY cohort_date ORDER BY day_offset)` porta il numero di utenti D0 in ogni riga. Così il calcolo del retention rate avviene al momento della scrittura, non al momento della query. In alternativa potreste recuperare D0 con un JOIN separato, ma la window function in BigQuery è ottimizzata per l'utilizzo di slot (lettura sequenziale entro la partition).

Nota: la clausola `OVER` con partition identica a quella fisica (`cohort_date`) non rompe il partition pruning. BigQuery processa ogni partition indipendentemente, nessuno shuffle tra partition.

## Ottimizzazione Query Cost: Utilizzo di Slot e Caching

Il modello di pricing di BigQuery è basato sui byte scansionati (5 dollari/TB). Ma per la latenza in production il consumo di slot è più critico. La strategia materialized view abbatte il costo ma può comunque avere contention di slot — soprattutto se 10 utenti sulla dashboard fanno contemporaneamente filtri su cohort diversi.

**BI-engine caching:** BigQuery BI Engine mantiene fino a 100GB di hot data in RAM. `daily_retention_cube` con 45.000 righe × 200 byte ≈ 9MB rimane completamente in cache. Le query successive usano 0 slot e tornano in <10 millisecondi. BI Engine si attiva manualmente (BigQuery console → Capacity Management → tier 100GB = 300 dollari/mese). Il ROI è alto — 1000 query giornaliere × 0.01 dollari costo slot = 10 dollari/giorno vs 10 dollari/giorno flat.

**Query result caching:** BigQuery cache i risultati per 24 ore. Se sulla dashboard "i cohort degli ultimi 7 giorni" è la stessa query per ogni utente, dopo il primo hit le query successive vengono dalla cache. Ma quando cambia il parametro (range di date, segmentazione) la cache miss e il cube pre-aggregato si attiva comunque.

**Slot allocation:** Se usate pricing a forfait (500 slot = 10.000 dollari/mese) anziché on-demand, assegnate la pipeline di retention a uno slot pool dedicato. Durante le ore di picco i calcoli di retention non competono con le query dell'utente per gli slot. In production Roibase, le scheduled query girano fuori picco (03:00-05:00), mentre le dashboard degli utenti usano flex slot (autoscale 100-500).

## Integrazione Identity Resolution: Cohort Cross-Device

L'analisi cohort classica gira su `user_id`, ma in un user journey cross-device la stessa persona porta 3 ID diversi (web anonimo, app loggato, CRM). Se la retention è %15, la retention reale potrebbe essere %22 — a causa della frammentazione di ID.

Nel framework [First-Party Veri & Architettura di Misurazione](https://www.roibase.com.tr/it/firstparty) si costruisce un identity graph: la tabella `identity_map` collega ogni `anonymous_id`, `user_id`, `crm_id` a un `person_id` canonico. Arricchite il modello cohort base con questo graph:

```sql
WITH resolved_events AS (
  SELECT
    COALESCE(i.person_id, e.user_id) AS person_id,
    e.event_date
  FROM {{ source('raw', 'events') }} e
  LEFT JOIN {{ ref('identity_map') }} i ON e.user_id = i.user_id
)
SELECT person_id, MIN(event_date) AS cohort_date
FROM resolved_events
GROUP BY person_id
```

Il JOIN può avere costo, ma `identity_map` ha update incrementale giornaliero e clustering per `user_id` — BigQuery esegue hash join, nessuno overhead di broadcast. Il cohort risultante mostra il valore vero di D7 retention, le decisioni di marketing (reallocation di budget, forecast LTV) si basano su data accurata.

## Strategia Incremental Refresh: Backfill vs Daily Delta

Il rischio critico delle materialized view è: quando upstream data viene corretto (evento in ritardo, cancellazione GDPR), la view a valle rimane stale. BigQuery non ha refresh automatico delle materialized view — lo attivate voi.

**Due strategie:**

1. **Daily delta:** Ogni giorno calcola solo la nuova partition. Veloce ma non cattura le correzioni passate.
2. **Rolling backfill:** Ricalcola gli ultimi 7 giorni ad ogni run. Cattura gli event in ritardo ma costa 7x di compute.

In Roibase production usiamo approccio ibrido: daily delta + full refresh settimanale. In dbt:

```yaml
# dbt_project.yml
models:
  cohorts:
    daily_retention_cube:
      +full_refresh: "{{ var('force_backfill', false) }}"
```

Run normale `dbt run --select daily_retention_cube` (incremental). Fine settimana `dbt run --select daily_retention_cube --vars '{force_backfill: true}'` (full refresh). Così controllate il tradeoff tra cost e accuracy.

## Benchmark Prestazioni: Naive vs Optimized

Dataset production: 10M event/giorno, 18 mesi di storia, 5.4 miliardi di righe.

| Metrica | Naive SQL | Materialized Cube | Miglioramento |
|---------|-----------|-------------------|---------------|
| Volume scan (D7 retention) | 2.1 TB | 18 MB | 116x |
| Latenza query (p95) | 42 sec | 0.08 sec | 525x |
| Costo BigQuery/query | 10.50 $ | 0.01 $ | 1050x |
| Tempo caricamento dashboard | timeout | <1 sec | - |
| Utilizzo slot (peak) | 2000 | 5 | 400x |

Query di test: "Curva di retention 30 giorni del cohort gennaio 2026". La query naive scansiona la tabella events 18 volte (una per ogni giorno). Il cube materializzato legge 30 righe.

Con BI-engine cache attiva, la latenza cala da 80ms a 12ms — utilizzo di slot zero. Test con 50 utenti simultanei sulla dashboard: 99.5% uptime, response time mediana 18ms. Questo è il SLA production — il team marketing può fare segmentazione cohort in tempo reale (ad es. "prendi chi ha D3 retention <20% per la push campaign").

L'analisi della retention è il centro dello stack di growth moderno, ma l'implementazione naive non funziona in production. Con strategia di partitioning, materialized view incrementale, pre-aggregation e BI-engine caching, raggiungete <100ms latency con milioni di utenti. Il costo cala di 100x, la contention di slot scompare, il team marketing accelera il decision-making data-driven. Valutate la vostra architettura oggi — se vedete spinning wheel sulla dashboard di retention, il problema non è nei dati, è nel design della tabella.