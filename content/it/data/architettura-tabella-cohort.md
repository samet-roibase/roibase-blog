---
title: "Architettura della Tabella Cohort: Scalare l'Analisi della Retention in Production"
description: "Design architetturale che elabora 100M+ eventi al giorno in tabelle cohort con query in 5 secondi, usando materialized views, partitioning e ottimizzazione dei costi."
publishedAt: 2026-06-09
modifiedAt: 2026-06-09
category: data
i18nKey: data-007-2026-06
tags: [cohort-analysis, bigquery, materialized-views, query-optimization, retention-engineering]
readingTime: 8
author: Roibase
---

Quando trasferite le metriche di retention su un dashboard real-time, il primo shock arriva dal costo delle query. Una query cohort di base — "quanti utenti registrati il 1° gennaio erano ancora attivi il 7° giorno?" — scritta ingenuamente taragli 200GB di dati, impiega 18 secondi e genera 4 dollari di costi. Un team che visita il dashboard 500 volte al giorno porta il conto a 60.000 dollari al mese. Il problema non è nella vostra capacità analitica, ma nell'architettura della tabella. Per trasferire l'analisi cohort in production, non dovreste memorizzare i dati grezzi degli eventi, ma snapshot pre-aggregati dei cohort.

## Query Cohort Ingenua: Perché Non Scala

Una query cohort classica unisce tre tabelle: `users`, `events`, `cohort_definitions`. Ogni query scansiona la tabella `events` senza filtri di partizione. Con 100M di eventi giornalieri, questo approccio non è sostenibile.

```sql
-- ❌ Anti-pattern: Scansiona tutti gli events ogni volta
SELECT 
  DATE_TRUNC(u.created_at, DAY) AS cohort_date,
  DATE_DIFF(e.event_date, u.created_at, DAY) AS day_n,
  COUNT(DISTINCT u.user_id) AS retained_users
FROM users u
JOIN events e ON u.user_id = e.user_id
WHERE u.created_at >= '2026-01-01'
  AND e.event_name = 'session_start'
GROUP BY 1, 2
ORDER BY 1, 2;
```

Questa query scannerà 480GB per 6 mesi di dati. In BigQuery, il consumo di slot la rallenterà a 12 secondi, con un costo di 2,40 dollari (pricing on-demand: 5$/TB). Se moltiplicate lo stesso cohort per 20 metriche diverse (revenue, session count, conversion rate), il costo sale a 48 dollari. Se il dashboard viene aggiornato 100 volte al giorno, il costo mensile raggiunge 144.000 dollari. Per rendere il problema adatto a una production scalabile, ci sono due strategie: **materializzazione incrementale** e **snapshot cohort pre-aggregati**.

### Materializzazione Incrementale: Pipeline Event-to-Cohort con dbt

Invece di calcolare i cohort ogni volta, aggiornateli giornalmente tramite batch incrementali. La strategia `incremental` di dbt consente di aggiungere gli eventi del nuovo giorno alla tabella cohort esistente.

```sql
-- models/cohort_retention_daily.sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'cohort_date', 'data_type': 'date'},
    cluster_by=['day_n', 'metric_name'],
    unique_key='cohort_date || day_n || metric_name'
  )
}}

WITH new_events AS (
  SELECT 
    u.user_id,
    DATE_TRUNC(u.created_at, DAY) AS cohort_date,
    DATE_DIFF(e.event_date, u.created_at, DAY) AS day_n,
    e.event_name,
    e.revenue_usd
  FROM {{ ref('events') }} e
  JOIN {{ ref('users') }} u ON e.user_id = u.user_id
  {% if is_incremental() %}
  WHERE e.event_date = CURRENT_DATE() - 1  -- Solo i dati di ieri
  {% endif %}
)
SELECT
  cohort_date,
  day_n,
  'active_users' AS metric_name,
  COUNT(DISTINCT user_id) AS metric_value
FROM new_events
WHERE event_name = 'session_start'
GROUP BY 1, 2, 3

UNION ALL

SELECT
  cohort_date,
  day_n,
  'revenue_per_cohort' AS metric_name,
  SUM(revenue_usd) AS metric_value
FROM new_events
GROUP BY 1, 2, 3;
```

Alla prima esecuzione (full refresh), vengono elaborati tutti i dati storici. Ogni giorno successivo, vengono aggiunti solo i nuovi event di 1 giorno. Un giorno con 100M di event scannerà 3,2GB di dati (grazie a partitioning + clustering), la query impiegherà 4 secondi, con un costo di 0,016 dollari. Costo incrementale mensile totale: 0,48 dollari — un trecentomillesimo del metodo ingenuo.

## Materialized Views: Il Layer Cache Automatico di BigQuery

Il modello incrementale viene aggiornato in batch (una volta al giorno). Se volete aggiungere i dati dell'ultima ora a un dashboard real-time, entra in gioco la feature **materialized view** di BigQuery. Una materialized view memorizza fisicamente il risultato della query base e si aggiorna automaticamente quando la tabella sorgente cambia.

```sql
CREATE MATERIALIZED VIEW `project.dataset.cohort_retention_mv`
PARTITION BY cohort_date
CLUSTER BY day_n, metric_name
AS
SELECT
  DATE_TRUNC(u.created_at, DAY) AS cohort_date,
  DATE_DIFF(e.event_date, u.created_at, DAY) AS day_n,
  'active_users' AS metric_name,
  COUNT(DISTINCT u.user_id) AS metric_value
FROM `project.dataset.events` e
JOIN `project.dataset.users` u ON e.user_id = u.user_id
WHERE e.event_date >= CURRENT_DATE() - 90  -- Solo finestra di 90 giorni
  AND e.event_name = 'session_start'
GROUP BY 1, 2, 3;
```

Quando interrogate una materialized view, BigQuery restituisce prima il risultato in cache. Se la tabella sorgente cambia (vengono aggiunti nuovi event), il delta viene calcolato in background. La query del dashboard ora impiega 0,2 secondi, con un costo di 0 dollari (cache hit). Tuttavia, attenzione: la materialized view stessa genera costi di storage (BigQuery storage: 0,02$/GB/mese) e se la tabella cohort di 90 giorni è 12GB, il costo di storage mensile aggiuntivo è di 0,24 dollari.

**Tabella dei tradeoff:**

| Metodo | Tempo First Query | Tempo Query Dashboard | Costo Compute Mensile | Costo Storage Mensile |
|--------|------------------|------------------------|------------------------|------------------------|
| Naive JOIN | 12s | 12s | 144.000$ | 0$ |
| dbt Incremental | 4s (primo batch) | 2s (lettura snapshot) | 0,48$ | 0,18$ (tabella snapshot) |
| Materialized View | 8s (primo build) | 0,2s (cache hit) | 0$ (refresh automatico) | 0,24$ |

In production, la combinazione di entrambe è ideale: il **modello dbt incremental** aggiorna quotidianamente i cohort storici tramite batch, mentre la **materialized view** mantiene gli ultimi 7 giorni in tempo reale.

## Partitioning e Clustering: Ridurre il Costo delle Query del 97%

Se non partizionate e non clusterizzate le tabelle cohort, BigQuery scannerà l'intera tabella a ogni query. Su una tabella cohort di 1TB (dati di 2 anni), una singola query "mostrami il cohort di gennaio 2026" scannerà 1TB e sarà addebitata a 5 dollari. Con partitioning + clustering, la stessa query scannerà 8GB, pagherete 0,04 dollari.

**Strategia di partitioning:** partizionare per `cohort_date` in base ai giorni. Se BigQuery vede il filtro di partizione nella query, scannerà solo le partizioni rilevanti.

```sql
CREATE OR REPLACE TABLE `project.dataset.cohort_retention`
PARTITION BY cohort_date
CLUSTER BY day_n, metric_name
AS
SELECT * FROM `project.dataset.cohort_retention_temp`;
```

**Clustering:** all'interno di ogni partizione, se specificate campi frequentemente filtrati (ad es. `day_n`, `metric_name`) come cluster, BigQuery esegue block-level pruning. Una query come "mostrami retention day_7 + metrica active_users" scannerà solo i block rilevanti.

Esempio concreto: 365 partizioni (giornaliere), ogni partizione 3GB. Senza clustering, un filtro "day_7" scannerà 365 partizioni × 3GB = 1TB. Con clustering, scannerà solo i block dove `day_n=7`, totale 12GB. Differenza di costo: 5$ → 0,06$.

**Anti-pattern:** non clusterizzate per `user_id`. L'analisi cohort non è a livello di utente, ma di aggregazione a livello cohort. Clusterizzare per `user_id` non aiuta il query planner, anzi riduce l'efficienza della cache.

## Identity Resolution per la Precisione dei Cohort

L'accuratezza dell'analisi cohort dipende dalla precisione dell'`user_id`. Quando una sessione anonima seguita da login viene attribuita a due `user_id` diversi, un JOIN ingenuo crea due record cohort separati. Risolvete questo problema con [First-Party Data & Architettura di Misurazione](https://www.roibase.com.tr/it/firstparty): costruite un identity graph tra `client_id` anonimo e `user_id` autenticato.

```sql
-- Tabella di identity resolution
CREATE TABLE `project.dataset.identity_graph` (
  canonical_user_id STRING,
  client_id STRING,
  user_id STRING,
  merged_at TIMESTAMP
)
PARTITION BY DATE(merged_at)
CLUSTER BY canonical_user_id;

-- Combinate con la query cohort
WITH resolved_users AS (
  SELECT 
    COALESCE(ig.canonical_user_id, e.user_id) AS user_id,
    e.event_date,
    e.event_name
  FROM events e
  LEFT JOIN identity_graph ig 
    ON e.client_id = ig.client_id OR e.user_id = ig.user_id
)
SELECT 
  DATE_TRUNC(u.created_at, DAY) AS cohort_date,
  DATE_DIFF(r.event_date, u.created_at, DAY) AS day_n,
  COUNT(DISTINCT r.user_id) AS retained_users
FROM resolved_users r
JOIN users u ON r.user_id = u.user_id
GROUP BY 1, 2;
```

Senza identity resolution, i cohort si gonfiano del 12-18% (un utente viene registrato con due ID diversi). Questo errore mostra le metriche di retention basse, perché il numeratore del cohort cresce ma l'attività a day_n rimane la stessa.

## Monitoraggio del Costo delle Query: Production Monitoring con INFORMATION_SCHEMA

Dopo aver costruito l'architettura cohort, dovete continuare a ottimizzare il costo delle query. La tabella `INFORMATION_SCHEMA.JOBS` di BigQuery vi mostra quanti byte scannerà ogni query, l'utilizzo degli slot e il costo totale.

```sql
SELECT
  user_email,
  query,
  total_bytes_processed / POW(10, 12) AS tb_processed,
  (total_bytes_processed / POW(10, 12)) * 5 AS cost_usd,
  total_slot_ms / 1000 / 60 AS slot_minutes
FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
  AND statement_type = 'SELECT'
  AND query LIKE '%cohort_retention%'
ORDER BY total_bytes_processed DESC
LIMIT 20;
```

Questa query elenca le query sulle tabelle cohort degli ultimi 7 giorni ordinate per costo. Se un pannello dashboard viene attivato 500 volte al giorno e scannerà 80GB ogni volta (segno di filtro di partizione mancante), il costo è 500 × 80GB × 5$/TB = 200$ al giorno. In questo caso, aggiungere un filtro `WHERE cohort_date >= CURRENT_DATE() - 30` alla query del pannello ridurrà il costo a 6$ al giorno.

**Checklist Production:**
- [ ] Tutte le tabelle cohort sono partizionate per `cohort_date`?
- [ ] `day_n` e `metric_name` sono clusterizzati?
- [ ] Il job dbt incremental viene eseguito quotidianamente?
- [ ] La materialized view è limitata a una finestra di 90 giorni?
- [ ] Le query del dashboard hanno il filtro `WHERE cohort_date >= ...`?
- [ ] Raccogliete un report settimanale dei costi con `INFORMATION_SCHEMA`?

Quando l'architettura cohort è costruita correttamente, l'analisi della retention diventa production-ready: 100M di eventi al giorno, tempo di query di 5 secondi, costo di compute mensile di 10 dollari. Tuttavia, questa architettura richiede identity resolution first-party, standardizzazione dello schema degli event e disciplina nella pipeline dbt — per questo motivo, l'ingegneria della retention è una piattaforma, non un SQL una tantum.