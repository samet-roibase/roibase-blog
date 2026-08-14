---
title: "Architettura della Tabella Cohort: Scalare l'Analisi della Retention in Produzione"
description: "Materialized views, strategie di partitioning e ottimizzazione dei costi delle query: come scalare le analisi cohort di retention in produzione, ridurre i costi e accelerare le decisioni."
publishedAt: 2026-08-14
modifiedAt: 2026-08-14
category: data
i18nKey: data-007-2026-08
tags: [analisi-cohort, bigquery, materialized-views, data-engineering, retention]
readingTime: 8
author: Roibase
---

L'analisi della retention è il fulcro del processo decisionale negli e-commerce e nei modelli SaaS. Tuttavia, quando le query cohort classiche vengono eseguite in ambienti di produzione, ogni analisi esegue un full-scan delle tabelle di eventi da terabyte, richiede minuti e porta i costi delle query a centinaia di dollari al giorno. Quando il calcolo della cohort avviene on-demand, il ciclo decisionale rallenta, il team di analyst si concentra sull'ottimizzazione delle query, e i dashboard non si aggiornano. La soluzione: salvare le tabelle cohort come un data asset pre-computato, partitionato e aggiornato in modo incrementale. In questo articolo ti mostriamo come implementare materialized view, partitioning e strategie di build incrementali su BigQuery, riducendo i costi delle query del 90% mentre riduci i tempi di analisi a pochi secondi e rendi le decisioni sulla retention quasi real-time.

## Perché la Query Cohort Classica Non Scala

L'analisi cohort standard funziona così: raggruppa gli utenti in base alla data della loro prima transazione, poi calcola quale percentuale ritorna nei giorni successivi. La query SQL effettua un join della tabella `events` due volte — una volta per trovare la data della cohort, una volta per contare il comportamento di retention. Su BigQuery, una tabella di eventi con 500 milioni di righe, questa query richiede 10-15 secondi ed è una spesa di circa $0.50. La query viene ripetuta ad ogni refresh della dashboard, ad ogni iterazione dell'analyst, ad ogni report di test A/B.

Il problema non è tanto il costo quanto la velocità e la flessibilità. Quando il team di analyst vuole cambiare la definizione della cohort (ad esempio, provare "secondo add-to-cart" anziché "primo acquisto"), scrivere di nuovo la query, testarla e validarla richiede ore. I dashboard rimangono stantii. Quando il team di marketing chiede "qual era la retention della cohort della scorsa settimana", non ci sono dati live; l'analyst esegue manualmente la query. Questo ciclo rallenta il processo decisionale di giorni.

I calcoli delle cohort inoltre richiedono uno strato di aggregazione, è un data asset. La metrica di retention non è solo "numero di utenti", ma "utenti attivi / dimensione della cohort". Questo rapporto deve essere aggiornato ogni giorno, il comportamento delle cohort passate nei nuovi giorni deve essere aggiunto. La query classica non supporta questa logica incrementale, ricalcola tutto da zero.

## Da Query a Tabella: Materialized View per Cohort

Il primo passo della soluzione è fissare la definizione della cohort come una materialized view. Su BigQuery, una materialized view salva il risultato della query in forma fisica e esegue un refresh incrementale quando cambiano le tabelle di base. Tuttavia, per l'analisi cohort la MV standard non è sufficiente perché la definizione della cohort e la finestra di retention sono parametri dinamici. Per questo costruiamo una struttura ibrida: una tabella di assegnazione cohort + una tabella di aggregazione degli eventi di retention.

La prima tabella, `cohort_assignments`, salva la data in cui l'utente entra per la prima volta nella cohort:

```sql
CREATE TABLE `project.dataset.cohort_assignments`
PARTITION BY DATE(cohort_date)
CLUSTER BY user_id
AS
SELECT
  user_id,
  MIN(DATE(event_timestamp)) AS cohort_date,
  COUNTIF(event_name = 'purchase') AS total_purchases
FROM `project.dataset.events`
WHERE event_name IN ('first_visit', 'purchase', 'signup')
GROUP BY user_id;
```

Questa tabella contiene ogni utente una sola volta, `cohort_date` è la partition key. Quando arriva un nuovo utente, viene aggiunto solo alla partition pertinente. La dimensione della tabella scala con il numero di utenti (non con il numero di eventi), per 10 milioni di utenti è circa ~500 MB.

La seconda tabella, `daily_user_activity`, salva se ogni utente è attivo in ogni giorno come un boolean flag:

```sql
CREATE TABLE `project.dataset.daily_user_activity`
PARTITION BY activity_date
CLUSTER BY user_id
AS
SELECT
  user_id,
  DATE(event_timestamp) AS activity_date,
  TRUE AS is_active
FROM `project.dataset.events`
WHERE event_name IN ('pageview', 'purchase', 'session_start')
GROUP BY user_id, activity_date;
```

La query di retention la costruiamo facendo il join di queste due tabelle:

```sql
SELECT
  c.cohort_date,
  DATE_DIFF(a.activity_date, c.cohort_date, DAY) AS days_since_cohort,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT a.user_id) AS active_users,
  SAFE_DIVIDE(COUNT(DISTINCT a.user_id), COUNT(DISTINCT c.user_id)) AS retention_rate
FROM `project.dataset.cohort_assignments` c
LEFT JOIN `project.dataset.daily_user_activity` a
  ON c.user_id = a.user_id
  AND a.activity_date >= c.cohort_date
WHERE c.cohort_date >= '2026-01-01'
GROUP BY c.cohort_date, days_since_cohort
ORDER BY c.cohort_date, days_since_cohort;
```

Questa query non effettua più il scan della tabella di eventi da terabyte, fa solo due join piccoli. Su BigQuery, per 10 milioni di utenti richiede ~2 secondi ed è una spesa di $0.02 — una riduzione di costo del 96%.

## Strategia di Partitioning: Quale Data in Quale Partition

Nella tabella cohort, la strategia di partitioning è critica perché ci sono due dimensioni temporali: la data della cohort e la data dell'attività. La tabella `cohort_assignments` è partizionata per `cohort_date` perché salva il primo evento dell'utente e la definizione della cohort è fissa. Quando arriva un nuovo utente, viene aggiunto solo alla partition di oggi, le partition passate rimangono immutabili.

La tabella `daily_user_activity` è partizionata per `activity_date` perché ogni giorno arrivano nuovi dati di attività e i giorni passati non cambiano. Questa struttura è perfetta per il refresh incrementale: un job dbt o Airflow scrive ogni giorno solo la partition di oggi, non tocca le partition passate.

Tuttavia, l'analisi di retention richiede un join tra due date: cohort_date e activity_date. Per ottimizzare le prestazioni del join, usiamo cluster key. Su BigQuery, `CLUSTER BY user_id` salva fisicamente le righe con lo stesso user_id una accanto all'altra, il join fa il pruning a livello di blocco e riduce l'I/O su disco. Per 10 milioni di utenti, il join senza cluster key richiede ~8 secondi, con cluster key scende a ~2 secondi.

Anche il partition pruning è importante. L'analisi di retention di solito analizza le cohort degli ultimi 90 giorni. Il filtro `WHERE c.cohort_date >= '2026-05-01'` attiva il partition pruning, BigQuery legge solo le partition pertinenti. Per 2 anni di dati, senza partition pruning il costo della query è ~$0.50, con partition pruning è $0.02 — perché i dati scansionati si riducono di 24 volte.

Nel partitioning strategy c'è un trade-off: le partition giornaliere rendono facile il refresh incrementale ma troppi partition su BigQuery aumentano l'overhead di planning delle query. Una tabella con oltre 1000 partition aumenta il tempo di caricamento dei metadati del query planner. Per questo, i dati delle cohort più vecchi di 2 anni devono essere archiviati o consolidati in partition mensili.

## Refresh Incrementale: Calcola Solo i Nuovi Dati

Le tabelle cohort devono essere aggiornate quotidianamente perché nuovi utenti entrano nella cohort e il comportamento di retention dei cohort esistenti si aggiorna. Tuttavia, fare un full refresh — ricalcolare l'intera tabella — è uno spreco di risorse. La soluzione: il pattern di build incrementale.

Su dbt, un modello incrementale è definito così:

```sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'cohort_date', 'data_type': 'date'},
    cluster_by=['user_id'],
    incremental_strategy='insert_overwrite'
  )
}}

SELECT
  user_id,
  MIN(DATE(event_timestamp)) AS cohort_date,
  COUNTIF(event_name = 'purchase') AS total_purchases
FROM {{ source('raw', 'events') }}
WHERE DATE(event_timestamp) = CURRENT_DATE() - 1
{% if is_incremental() %}
  AND DATE(event_timestamp) > (SELECT MAX(cohort_date) FROM {{ this }})
{% endif %}
GROUP BY user_id
```

Questo modello ogni giorno calcola solo la partition di ieri. La strategia `insert_overwrite` cancella la partition esistente e scrive la nuova. Su BigQuery, il replace a livello di partition è atomico, le query downstream non leggono mai dati incompleti.

Per la tabella `daily_user_activity` la logica incrementale è ancora più semplice perché ogni giorno si aggiunge una nuova partition, le partition passate non cambiano mai:

```sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'activity_date', 'data_type': 'date'},
    cluster_by=['user_id']
  )
}}

SELECT
  user_id,
  DATE(event_timestamp) AS activity_date,
  TRUE AS is_active
FROM {{ source('raw', 'events') }}
WHERE DATE(event_timestamp) = CURRENT_DATE() - 1
{% if is_incremental() %}
  AND DATE(event_timestamp) NOT IN (SELECT DISTINCT activity_date FROM {{ this }})
{% endif %}
GROUP BY user_id, activity_date
```

Con il refresh incrementale il tempo del job giornaliero scende da 5 minuti a 30 secondi. L'utilizzo di slot BigQuery cala dell'80%, l'attesa in coda delle query scompare. Quando il team di analyst apre la dashboard alle 9 di mattina, i dati di retention di ieri sono pronti.

Tuttavia, nel build incrementale c'è un rischio: late-arriving data. Se la pipeline di eventi ha un ritardo di 2-3 ore, la partition di ieri contiene dati incompleti. Per risolvere questo problema si usano due approcci: (1) su dbt, il parametro `lookback_window` — ricalcola gli ultimi 3 giorni ogni volta; (2) su BigQuery, usare i metadati `_PARTITIONTIME` per filtrare in base all'ora di inserimento della partition. Il secondo metodo è più efficace perché re-processa solo gli eventi che arrivano tardi.

## Ottimizzazione dei Costi delle Query: Dimensione della Tabella e Pattern di Scan

Il costo delle tabelle cohort dipende da due fattori: la dimensione della tabella (GB) e il pattern di scan della query. La tabella `cohort_assignments` per 10 milioni di utenti è ~500 MB, la tabella `daily_user_activity` per una finestra di 90 giorni è ~5 GB. Quando le due tabelle vengono sottoposte a join, BigQuery scansiona ~6 GB, il costo è ~$0.03. Ma la stessa analisi sulla tabella di eventi raw avrebbe scansionato 500 GB, il costo sarebbe ~$2.50 — una differenza di 80 volte.

Per ridurre ulteriormente i costi usiamo una tabella di sintesi delle cohort pre-aggregata:

```sql
CREATE TABLE `project.dataset.cohort_retention_summary`
PARTITION BY cohort_date
CLUSTER BY days_since_cohort
AS
SELECT
  c.cohort_date,
  DATE_DIFF(a.activity_date, c.cohort_date, DAY) AS days_since_cohort,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT a.user_id) AS active_users,
  SAFE_DIVIDE(COUNT(DISTINCT a.user_id), COUNT(DISTINCT c.user_id)) AS retention_rate
FROM `project.dataset.cohort_assignments` c
LEFT JOIN `project.dataset.daily_user_activity` a
  ON c.user_id = a.user_id
  AND a.activity_date >= c.cohort_date
GROUP BY c.cohort_date, days_since_cohort;
```

Questa tabella salva il tasso di retention pre-computato per ogni combinazione di cohort-day. La dimensione della tabella è ~100 MB (10 milioni di utenti × 90 giorni = 900 milioni di righe → dopo aggregazione ~50.000 righe). La dashboard legge questa tabella, non fa join, il tempo della query è <1 secondo, il costo è ~$0.001.

Un altro aspetto dell'ottimizzazione dei costi della query è non usare `SELECT *`. Nell'analisi cohort servono solo le colonne `user_id`, `cohort_date`, `activity_date`. Se la tabella `daily_user_activity` contiene colonne extra come event_name, session_id e la query usa `SELECT *`, vengono scansionati dati non necessari. BigQuery usa storage in colonne, selezionare solo le colonne necessarie riduce l'I/O su disco del 40-50%.

L'ultima ottimizzazione è usare BI Engine di BigQuery. BI Engine mette in cache la tabella di sintesi cohort, le query della dashboard ritornano con latenza sub-secondo. Per una tabella di 100 MB, una prenotazione di BI Engine costa ~$10/mese, ma il risparmio sui costi delle query quando si eseguono 1000 query al giorno è ~$30/mese — un guadagno netto.

## Retention Engineering Pipeline: dbt + Airflow + Alerting

In un ambiente di produzione, l'architettura cohort non è solo SQL, richiede orchestration e monitoring. La pipeline di retention è composta dai seguenti componenti:

1. **DAG Airflow:** Si attiva ogni mattina alle 06:00, valida a livello di partition la tabella di eventi (controllo dei dati che arrivano in ritardo).
2. **Modelli dbt incrementali:** Aggiorna in sequenza le tabelle `cohort_assignments`, `daily_user_activity`, `cohort_retention_summary`.
3. **Test di data quality:** I test dbt verificano constraint come cohort_size > 0, retention_rate BETWEEN 0 AND 1.
4. **Alerting:** Se il tasso di retention Day 1 di oggi è inferiore del 20% alla media