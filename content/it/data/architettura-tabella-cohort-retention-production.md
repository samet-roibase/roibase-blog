---
title: "Architettura della Tabella Cohort: Scalare l'Analisi di Retention in Production"
description: "Come scalare le tabelle di analisi cohort in ambienti production usando materialized views, partitioning e ottimizzazione dei costi di query."
publishedAt: 2026-07-28
modifiedAt: 2026-07-28
category: data
i18nKey: data-007-2026-07
tags: [cohort-analysis, bigquery, materialized-views, data-engineering, retention]
readingTime: 8
author: Roibase
---

Ogni organizzazione che esegue analisi di retention si imbatte nello stesso problema: le query dei cohort in production impiegano 30 secondi oppure la fattura di BigQuery raggiunge gli $8.000 al mese. La query `GROUP BY user_id, cohort_week` che funziona perfettamente in test con 100K utenti crolla quando incontra 50M utenti e 2 anni di event log. La soluzione non è banale — non basta aggiungere un indice o abilitare il caching, occorre riprogettare l'architettura della tabella da zero per il carico di lavoro della retention.

## Perché l'Analisi di Cohort Richiede un'Architettura Diversa

Una tabella di event log classica si basa su `user_id`, `event_time`, `event_name`. Ogni query di cohort scansiona miliardi di righe storicamente, raggruppando gli utenti per data del primo evento. In BigQuery, la query si presenta così:

```sql
WITH cohorts AS (
  SELECT user_id, DATE_TRUNC(MIN(event_time), WEEK) AS cohort_week
  FROM events
  GROUP BY user_id
),
retention AS (
  SELECT 
    c.cohort_week,
    DATE_DIFF(DATE_TRUNC(e.event_time, WEEK), c.cohort_week, WEEK) AS weeks_since_cohort,
    COUNT(DISTINCT e.user_id) AS active_users
  FROM cohorts c
  JOIN events e ON c.user_id = e.user_id
  GROUP BY 1, 2
)
SELECT * FROM retention ORDER BY 1, 2;
```

Ogni esecuzione legge l'intera tabella `events`. 500M di righe × 16 byte in media = 8 GB di scansione. In BigQuery, se 1 TB di scansione costa $6,25, allora 1.000 query = $50. Se il dashboard si aggiorna ogni 5 minuti, al mese sono 8.640 query = $432 soltanto per il widget di cohort. Aggiungi 10 analisti al team, lascia che i bot di Slack attivino le query, e il costo si moltiplica.

Il vero problema non è nemmeno il costo — è la latenza. Un JOIN su 500M righe richiede 15-30 secondi. L'utente cambia un filtro nel dashboard, aspetta 20 secondi i nuovi dati di cohort. L'analisi di retention non può essere iterativa con questi ritardi.

### Materialized View È un Primo Passo, ma Non Basta

Una BigQuery materialized view pre-elabora la query di cohort:

```sql
CREATE MATERIALIZED VIEW cohort_retention AS
SELECT 
  cohort_week,
  weeks_since_cohort,
  active_users
FROM retention; -- risultato della CTE precedente
```

Ora il dashboard legge `cohort_retention` invece di `events`. La scansione scende da 8 GB a 80 MB. La latenza passa da 20 secondi a 800 ms. Tuttavia, due limiti restano:

1. **Costo di refresh:** Ogni refresh della materialized view esegue la query di base, cioè scannerà ancora 8 GB. Se aggiorni la view ogni ora, 24 × 8 GB = 192 GB/giorno = 5,8 TB al mese. Il costo non è diminuito, solo la latenza.
2. **Flessibilità:** La materialized view è statica. Se l'utente aggiunge un filtro "retention del cohort Android", la view deve essere ricalcolata. Non puoi pre-filtrare, perché aggiungere `WHERE platform = 'Android'` richiede una view diversa.

Per questo motivo, l'architettura di cohort deve essere progettata a tre livelli: raw events → cohort assignment table → aggregated retention table.

## Separare la Tabella di Cohort Assignment

Il primo passo: creare una tabella separata che assegna ogni utente al suo cohort. Contiene solo `user_id` e `cohort_week`, derivata dall'event log ma calcolata una volta al giorno:

```sql
CREATE OR REPLACE TABLE cohort_assignments
PARTITION BY cohort_week
CLUSTER BY user_id
AS
SELECT 
  user_id,
  DATE_TRUNC(MIN(event_time), WEEK) AS cohort_week,
  MIN(event_time) AS first_seen_at
FROM events
WHERE event_time >= '2024-01-01'
GROUP BY user_id;
```

Questa tabella:
- **Partition by cohort_week:** BigQuery crea blocchi di file separati per ogni settimana. Un filtro `WHERE cohort_week = '2026-01-05'` legge solo 1 partition.
- **Cluster by user_id:** All'interno della partition, memorizzazione ordinata per user_id. I JOIN accelerano.
- **Dimensione:** 50M utenti × 3 colonne × 16 byte = ~2,4 GB. Se l'event log è 500 GB, la tabella di cohort è 200× più piccola.

Ora la query di retention usa questa tabella:

```sql
SELECT 
  c.cohort_week,
  DATE_DIFF(DATE_TRUNC(e.event_time, WEEK), c.cohort_week, WEEK) AS weeks_since,
  COUNT(DISTINCT e.user_id) AS active_users
FROM cohort_assignments c
JOIN events e ON c.user_id = e.user_id
WHERE c.cohort_week >= '2026-01-01'
GROUP BY 1, 2;
```

Con partition pruning, `cohort_assignments` legge 200 MB per 4 settimane di dati. Il JOIN ancora scansiona la tabella `events`, ma ora inizia da uno stato con il filtro di cohort applicato, senza utenti inutili.

### Aggiornamento Incrementale

La tabella `cohort_assignments` si rinnova ogni giorno ma non viene ricalcolata da zero. Usa un modello incrementale dbt:

```sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'cohort_week', 'data_type': 'date'},
    cluster_by=['user_id']
  )
}}

SELECT 
  user_id,
  DATE_TRUNC(MIN(event_time), WEEK) AS cohort_week,
  MIN(event_time) AS first_seen_at
FROM {{ ref('events') }}
{% if is_incremental() %}
  WHERE event_time > (SELECT MAX(first_seen_at) FROM {{ this }})
{% endif %}
GROUP BY user_id
```

Questo modello elabora tutti i dati al primo run, poi nei run successivi aggiunge solo i nuovi utenti. La scansione scende da 500 GB a 2 GB al giorno.

## Tabella di Retention Aggregata: Pre-Compute Metriche a Livello Settimanale

La tabella di cohort assignment ha accelerato la query di retention, ma il dashboard ancora esegue il JOIN con `events` a ogni richiesta. Un passo ulteriore: pre-elabora i metriche di retention a livello settimanale, memorizzandoli in una tabella separata.

```sql
CREATE TABLE cohort_retention_weekly
PARTITION BY cohort_week
CLUSTER BY weeks_since_cohort
AS
SELECT 
  c.cohort_week,
  DATE_DIFF(DATE_TRUNC(e.event_time, WEEK), c.cohort_week, WEEK) AS weeks_since_cohort,
  COUNT(DISTINCT e.user_id) AS active_users,
  COUNT(*) AS total_events,
  APPROX_QUANTILES(session_duration, 100)[OFFSET(50)] AS median_session_duration
FROM cohort_assignments c
JOIN events e ON c.user_id = e.user_id
GROUP BY 1, 2;
```

Questa tabella:
- **Dimensione:** 52 settimane × 52 weeks_since × 3 metriche = ~8.100 righe (per 1 anno di dati). A livello di KB.
- **Scansione:** Il dashboard legge `cohort_retention_weekly`, nessuna lettura di `events`. Scansione < 1 MB.
- **Latenza:** BigQuery legge 1 MB in 80 ms. Il dashboard è ora sub-secondo.

Trade-off: Questa tabella deve essere rinnovata una volta al giorno. Se i dati non aggiornati non sono accettabili, refresh ogni ora (schedule dbt `0 * * * *`). Costo del refresh: cohort_assignments JOIN events, ~10 GB scansione. 24 volte al giorno = 240 GB, 7,2 TB al mese. Confronto: se il dashboard eseguisse 1.000 query di cohort, sarebbero 8 TB scansione. Quindi la tabella aggregata ha ridotto la scansione del %10 e la latenza da 20 secondi a 80 ms.

### Strategia di Partitioning: Cohort Week vs Event Week

Partizionare la tabella di retention per `cohort_week` o per `event_week`? Ci sono due approcci:

**Partition by cohort_week:**
- Utilizzo: "Qual è la curva di retention del cohort 2026-W03?"
- Pruning: `WHERE cohort_week = '2026-01-13'` → legge 1 partition
- Difficoltà: Se il dashboard chiede "retention totale degli ultimi 4 settimane?", legge 4 partition. Tuttavia, poiché la maggior parte dell'analisi di retention è per cohort, è ottimale.

**Partition by event_week:**
- Utilizzo: "Quali cohort sono stati attivi questa settimana?"
- Pruning: `WHERE event_week = '2026-07-21'` → legge 1 partition
- Difficoltà: Se aggiungi un filtro di cohort, il pruning non funziona, legge tutte le partition.

Roibase nei progetti di [analisi dei dati](https://www.roibase.com.tr/it/verianalizi) partiziona la tabella di retention per cohort_week, perché l'80% delle query di retention segue il formato "cohort X, settimana N".

## Ottimizzazione del Costo delle Query: Clustering e BI Engine

Il partitioning esegue pruning dall'alto verso il basso (quali blocchi di file saltare), il clustering ordina da sinistra a destra (quali righe leggere all'interno del blocco). Insieme riducono al minimo la scansione.

```sql
CREATE TABLE cohort_retention_weekly
PARTITION BY cohort_week
CLUSTER BY weeks_since_cohort, platform, country;
```

Se la query è `WHERE weeks_since_cohort = 4 AND platform = 'iOS'`:
1. Partition pruning → legge solo le partition di cohort_week rilevanti
2. Clustering → all'interno della partition, prima le righe `weeks_since_cohort = 4`, poi quelle `platform = 'iOS'`

BigQuery accetta al massimo 4 colonne di clustering. L'ordine è importante: metti per primo la colonna filtrata più spesso.

**BI Engine:** Strato di cache in-memory di BigQuery. Se riservi 100 GB di BI Engine, le tabelle usate frequentemente restano in RAM. Se la tabella `cohort_retention_weekly` è 50 MB, rimane completamente in BI Engine, la scansione è 0 (cache hit). Costo: 100 GB a $100/mese. Beneficio: tassi di risparmio su 10 TB scansione al mese = $62,50. ROI positivo.

### Approximation Functions: Metriche che Non Richiedono Accuratezza Totale

Nel calcolo della retention di cohort, alcuni metriche devono essere esatte (`COUNT(DISTINCT user_id)`), altre possono essere approssimate (median session duration, percentili).

Le funzioni approssimate di BigQuery:
- `APPROX_COUNT_DISTINCT(user_id)` → margine di errore del 2%, 10× più veloce
- `APPROX_QUANTILES(value, 100)[OFFSET(50)]` → mediana, errore dell'1%
- `APPROX_TOP_COUNT(event_name, 10)` → i 10 event più comuni

Esempio: Per 50M utenti, `COUNT(DISTINCT ...)` esatto richiede 8 secondi, `APPROX_COUNT_DISTINCT` impiega 800 ms. Per i filtri real-time del dashboard usa l'approssimato, per i rapporti finali usa l'esatto.

## Strategia di Aggiornamento Incrementale: Event-Time vs Processing-Time

Mentre la tabella di cohort si aggiorna una volta al giorno, quali event devono essere elaborati? Ci sono due timestamp:

1. **event_time:** Quando l'utente ha effettivamente realizzato l'evento (lato client)
2. **_PARTITIONTIME:** Quando BigQuery ha memorizzato l'evento (lato server)

Se l'aggiornamento incrementale usa `event_time`:
```sql
WHERE event_time > (SELECT MAX(event_time) FROM cohort_assignments)
```
**Problema:** Late-arriving events. L'utente rimane offline per 3 giorni, l'evento arriva tramite upload in batch. Se `event_time` è di 3 giorni fa, la query incrementale lo ignora.

Se l'aggiornamento incrementale usa `_PARTITIONTIME`:
```sql
WHERE _PARTITIONTIME > CURRENT_DATE() - 7
```
**Vantaggio:** Rielabora gli ultimi 7 giorni ogni volta, cattura gli event in ritardo.
**Costo:** 7 giorni di event data = ~14 GB scansione al giorno (invece di 2 GB).

Trade-off: Se gli event in ritardo sono sotto l'1%, usa `event_time` con scansione bassa. Se sono intorno al 5% (come negli app mobile), usa `_PARTITIONTIME` con lookback di 3 giorni.

## Segmentazione di Cohort: Filtri Dinamici vs Dimensioni Statiche

L'utente aggiunge un filtro nel dashboard: "retention del cohort iOS". Due metodi:

**Metodo 1: Query-time filter**
```sql
SELECT cohort_week, weeks_since, active_users
FROM cohort_retention_weekly
WHERE user_id IN (SELECT user_id FROM users WHERE platform = 'iOS');
```
**Problema:** La subquery legge la tabella `users` ogni volta. 50M utenti = 1 GB scansione. Se il dashboard si aggiorna 100 volte = 100 GB.

**Metodo 2: Pre-compute dimensions**
```sql
CREATE TABLE cohort_retention_weekly
AS
SELECT 
  c.cohort_week,
  weeks_since_cohort,
  u.platform,
  u.country,
  COUNT(DISTINCT e.user_id) AS active_users
FROM cohort_assignments c
JOIN events e ON c.user_id = e.user_id
JOIN users u ON e