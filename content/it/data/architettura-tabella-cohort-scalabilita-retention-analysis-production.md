---
title: "Architettura Tabella Cohort: Scalare l'Analisi di Retention in Production"
description: "Come scalate l'analisi cohort in production con materialized view, partitioning e ottimizzazione dei costi? Architettura concreta su BigQuery e dbt."
publishedAt: 2026-07-12
modifiedAt: 2026-07-12
category: data
i18nKey: data-007-2026-07
tags: [cohort-analysis, bigquery, materialized-views, query-optimization, retention]
readingTime: 8
author: Roibase
---

L'analisi di retention è tra le metriche più critiche nei dati di marketing. Capire quale gruppo di utenti rimane attivo nel tempo, quale campagna genera valore duraturo, richiede tabelle cohort ben costruite. Il problema: le query classiche di cohort ricalcolano tutto da zero su decine di milioni di righe event, raggiungendo costi astronomici. In production serve un'architettura che si aggiorni ogni mattina, restituisca risultati in 3 secondi all'analista, ma con una strategia di partitioning che minimizza i costi. Questo articolo spiega step-by-step un'architettura concreta di tabella cohort su BigQuery e dbt, con strategie di materialized view e ottimizzazione dei costi di query.

## Perché la tabella cohort deve essere separata

Non potete calcolare la retention dal raw event table ogni volta. Se un'azienda di e-commerce genera 50 milioni di eventi al giorno, rispondere a "Qual è il tasso di attività al 30° giorno degli utenti registrati a gennaio 2026?" richiede a BigQuery di scansionare 1.5 miliardi di righe. Questa query impiega 10-15 secondi e processa 200-300 GB. Se un analista estrae 20 segmenti cohort diversi al giorno, il costo mensile query supera i $500.

La tabella cohort risolve il problema: aggregate i dati event per gruppo in anticipo, calcolate in advance le metriche di ogni cohort per ogni giorno, e memorizzatele. Quando l'analista interroga, BigQuery scansiona solo la tabella cohort, non i dati grezzi. 1000 cohort × 90 giorni × 5 metriche = 450.000 righe. Una query su questa tabella impiega 200 ms e processa 5 MB.

Ma questo approccio crea un nuovo problema: come si aggiorna la tabella cohort? Ricalcolate la storia intera ogni giorno? Usate un approccio incremental? Quale strategia di partitioning ottimizza sia le performance di query che il costo di aggiornamento? Le risposte si trovano nel design dei modelli dbt incrementali e delle materialized view.

## Strategia di partitioning: `cohort_date` o `observation_date`?

La scelta della chiave di partitioning della tabella cohort è critica. Avete due opzioni: data di creazione del cohort (`cohort_date`) e data di osservazione (`observation_date`).

**Partizione `cohort_date`:** Partizionate per data del primo evento dell'utente. Il cohort di gennaio 2026 in una partition, febbraio in un'altra. Vantaggio: i nuovi cohort generano nuove partition senza toccare le vecchie. Svantaggio: estrarre 90 giorni di retention per un cohort richiede a BigQuery di scansionare 90 partition diverse. Performance ridotte.

**Partizione `observation_date`:** Una partition per ogni giorno. Il 12 luglio contiene le metriche di tutti i cohort per quel giorno. Vantaggio: query tipo "trend di retention negli ultimi 7 giorni" scansionano solo 7 partition. Svantaggio: dovete aggiornare tutti i cohort ogni giorno, il costo incremental update è alto.

La risposta corretta è un'**architettura ibrida a due tabelle:** una "snapshot table" (partizionata per `observation_date`) e una "aggregated table" (partizionata per `cohort_date`). La snapshot table si aggiorna ogni giorno, alimenta i dashboard degli analisti. La aggregated table si aggiorna settimanalmente, per analisi cohort approfondite. Questo design segue le best practice di BigQuery: separazione tra narrow e wide table.

```sql
-- Schema della snapshot table (partizionata per observation_date)
CREATE TABLE `analytics.cohort_retention_snapshot`
PARTITION BY observation_date
CLUSTER BY cohort_date, channel, device_category
AS
SELECT
  observation_date,
  cohort_date,
  channel,
  device_category,
  cohort_size,
  day_n,
  active_users,
  retention_rate
FROM ...
```

## Materialized view vs modello incremental: il trade-off

Su BigQuery, le materialized view (MV) refreshano in modo incremental automatico — quando arrivano nuovi event, riesegue la query di base e cachea il risultato. Ma le MV hanno 3 vincoli: limite al numero di join (max 5), nessuna window function, nessuna gestione manuale della partizione.

Il calcolo di cohort richiede tipicamente 3+ join (users, events, subscriptions) e window function come `LAG()` e `FIRST_VALUE()`. In questo caso, le MV non sono utilizzabili. Alternativa: modello incremental di dbt.

Un modello incremental di dbt vi permette di definire una strategia di merge personalizzata. Ogni giorno, aggiornate solo le partition degli ultimi 7 giorni (`WHERE observation_date >= CURRENT_DATE() - 7`). Questo approccio riduce il costo della query dell'85%. Esempio di modello dbt:

```sql
{{ config(
    materialized='incremental',
    partition_by={
      "field": "observation_date",
      "data_type": "date"
    },
    cluster_by=['cohort_date', 'channel'],
    incremental_strategy='insert_overwrite'
) }}

WITH daily_cohorts AS (
  SELECT
    DATE(first_seen_at) AS cohort_date,
    user_id,
    acquisition_channel AS channel
  FROM {{ ref('users') }}
  WHERE first_seen_at IS NOT NULL
),

daily_activity AS (
  SELECT
    DATE(event_timestamp) AS activity_date,
    user_id,
    COUNT(*) AS event_count
  FROM {{ ref('events') }}
  WHERE event_name IN ('page_view', 'purchase')
  {% if is_incremental() %}
    AND DATE(event_timestamp) >= CURRENT_DATE() - 7
  {% endif %}
  GROUP BY 1, 2
)

SELECT
  a.activity_date AS observation_date,
  c.cohort_date,
  c.channel,
  DATE_DIFF(a.activity_date, c.cohort_date, DAY) AS day_n,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT a.user_id) AS active_users,
  SAFE_DIVIDE(COUNT(DISTINCT a.user_id), COUNT(DISTINCT c.user_id)) AS retention_rate
FROM daily_cohorts c
LEFT JOIN daily_activity a
  ON c.user_id = a.user_id
WHERE a.activity_date >= c.cohort_date
{% if is_incremental() %}
  AND a.activity_date >= CURRENT_DATE() - 7
{% endif %}
GROUP BY 1, 2, 3, 4
```

Ogni giorno, questo modello riscrive solo le partition degli ultimi 7 giorni. Il costo di elaborazione di BigQuery scende da 20 GB al giorno a 2 GB. Risparmio di costi query annuale: ~$2.400.

### Scelta della chiave di clustering

La partizione non è sufficiente, serve anche il clustering. La tabella cohort può essere filtrata su 3 dimensioni: cohort_date (tempo), channel (fonte), device_category (dispositivo). Su BigQuery, l'ordine della chiave di clustering è importante: il campo con cardinalità più alta deve essere primo.

Analisi della cardinalità:
- `cohort_date`: 365 valori (1 anno)
- `channel`: 15-20 valori (organic, paid_search, social, email...)
- `device_category`: 3-4 valori (desktop, mobile, tablet)

Ordine corretto: `CLUSTER BY cohort_date, channel, device_category`. Questo ordine accelera query come "retention al 30° giorno dei mobile user da Instagram nel Q4 2025" di 10x.

## Ottimizzazione dei costi di query: profondità di pre-aggregazione

La granularità della tabella cohort determina anche il trade-off tra costo e performance. Memorizzate una riga per ogni combinazione di cohort × channel × device × day_n, oppure solo i totali generali?

**Option 1: Tabella granulare** — ogni combinazione di cohort × channel × device × day_n è una riga separata. Righe totali: 365 cohort × 20 channel × 4 device × 90 giorni = 2,6 milioni di righe. Vantaggio: l'analista può fare pivot su qualunque segmento. Svantaggio: costo storage elevato ($50/TB → ~$0.15 mensili).

**Option 2: Tabella aggregata** — solo cohort × day_n, senza breakdown di channel e device. Righe totali: 365 × 90 = 32.850 righe. Vantaggio: storage e costi di query minimi. Svantaggio: nessun breakdown per channel.

L'approccio corretto è un'**architettura a due livelli:** metriche core granulari (con breakdown di channel e device), metriche extended aggregate (solo cohort_date × day_n). La tabella core metrics alimenta i dashboard, la tabella extended metrics serve per analisi ad-hoc. Questo design ottimizza storage mantenendo flessibilità analitica.

Inoltre, definite una BigQuery partition expiration policy: le partition più vecchie di 90 giorni vengono eliminate automaticamente. L'analisi di retention raramente guarda oltre 90 giorni, questa policy riduce il costo annuale di storage del 60%.

## Risolvere l'identity resolution a livello di cohort

Il punto più delicato dell'analisi di cohort è la risoluzione delle identità: deduplica degli utenti. Se un utente si registra su desktop e effettua una transazione su mobile, si creano due user_id diversi. Se la tabella cohort non riconcilia questi ID, la retention risulta sottostimata del 20%.

Soluzione: prima di creare la tabella cohort, riconciliate usando il canonical_user_id. Nel processo di [Dati First-Party & Architettura di Misurazione](https://www.roibase.com.tr/it/firstparty) che avete già implementato, questa colonna canonica esiste. Nel modello dbt, usate la vista `users_unified` invece di `users`.

```sql
WITH unified_users AS (
  SELECT
    canonical_user_id,
    MIN(first_seen_at) AS cohort_date,
    ARRAY_AGG(DISTINCT acquisition_channel IGNORE NULLS ORDER BY first_seen_at LIMIT 1)[OFFSET(0)] AS channel
  FROM {{ ref('users_unified') }}
  GROUP BY 1
)
```

Questo approccio calcola correttamente la retention cross-device. In production genera un delta di retention del 15-25%. Quando la tabella di identity resolution si aggiorna, la tabella cohort deve essere rimaterializzata — definite la dipendenza nel DAG di dbt:

```yaml
models:
  - name: cohort_retention_snapshot
    config:
      materialized: incremental
    depends_on:
      - ref('users_unified')
```

## Checklist production: monitoring e alerting

Quando la tabella cohort entra in production, monitorate continuamente 3 metriche:

1. **Freshness:** Quando è stata aggiornata l'ultima partition? Definite un test `freshness` in dbt-core, inviate un alert Slack se una partition è più vecchia di 24 ore.
2. **Row count drift:** Se il cohort_size di oggi differisce del 30% da quello di ieri, c'è un problema nella pipeline. Usate una scheduled query su BigQuery per controllare `STDDEV()`.
3. **Query cost spike:** Se il costo medio di query sulla tabella cohort sale da $0.01 a $0.10, il partition pruning non funziona. Controllate la tabella INFORMATION_SCHEMA.JOBS.

Costruite un dashboard su Google Cloud Monitoring per queste 3 metriche. Se le soglie vengono superate, triggerate integrazione con PagerDuty. L'architettura di cohort in production non è "build and forget", richiede monitoring continuo.

Quando l'architettura della tabella cohort è costruita correttamente, l'analisi di retention diventa un prodotto engineering: si aggiorna ogni mattina, l'analista estrae insight in 3 secondi, i costi sono prevedibili. La strategia di partitioning di BigQuery, il modello incremental di dbt e l'integrazione della risoluzione di identità sono i 3 pilastri di questa architettura. Scalare l'analisi di cohort in production richiede profondità tecnica — ma il ritorno è misurabile: ~$5.000 di risparmio annuale nei costi di query e metriche di retention il 20% più accurate.