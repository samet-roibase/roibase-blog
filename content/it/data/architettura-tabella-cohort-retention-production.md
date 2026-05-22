---
title: "Architettura Tabella Cohort: Scalare l'Analisi di Retention in Production"
description: "Materialized views, partitioning e query cost optimization per cohort analysis su milioni di utenti: architettura BigQuery pronta per la produzione."
publishedAt: 2026-05-22
modifiedAt: 2026-05-22
category: data
i18nKey: data-007-2026-05
tags: [cohort-analysis, bigquery, materialized-views, retention-engineering, query-optimization]
readingTime: 8
author: Roibase
---

L'analisi di retention è uno dei metodi più potenti per comprendere il comportamento degli utenti. Ma a scala reale — milioni di eventi al giorno, centinaia di migliaia di utenti — le query SQL ingenue scadono in 30 secondi o consumano la capacità di slot. La retention analysis sostenibile in produzione richiede di ottimizzare l'architettura delle tabelle per il motore di query. In questo articolo ti mostriamo come scalare le tabelle cohort su BigQuery utilizzando materialized view, partitioning e strategie di refresh incrementale.

## Perché la Query Cohort Ingenua Fallisce

L'analisi cohort classica funziona così: trova la data della prima attività dell'utente (cohort_date), calcola tutte le attività successive come "giorno N" rispetto a quella data, aggrega il tasso di retention per gruppo. La seguente query SQL è logicamente corretta ma non funziona in produzione:

```sql
WITH first_event AS (
  SELECT user_id, MIN(DATE(event_timestamp)) AS cohort_date
  FROM `project.dataset.events`
  GROUP BY user_id
),
daily_activity AS (
  SELECT e.user_id, DATE(e.event_timestamp) AS activity_date
  FROM `project.dataset.events` e
  GROUP BY 1,2
)
SELECT 
  f.cohort_date,
  DATE_DIFF(d.activity_date, f.cohort_date, DAY) AS day_n,
  COUNT(DISTINCT d.user_id) AS retained_users
FROM first_event f
JOIN daily_activity d USING(user_id)
GROUP BY 1,2
ORDER BY 1,2;
```

Questa query ha due grandi problemi: (1) la tabella `events` viene scansionata completamente ogni volta — nessun partition pruning, (2) per ogni cohort_date tutti gli utenti e tutte le loro attività vengono joinati — rischio di esplosione cartesiana. Su 100M eventi questa query elabora 400GB di dati e termina in 2 minuti, ma per un refresh giornaliero questo non è sostenibile. La fattura di BigQuery triplica o quadruplica entro fine mese.

## Ridurre il Carico di Filtro con Partitioned Base Table

Il primo passo è partizionare la tabella `events` per `DATE(event_timestamp)`. In questo modo, quando aggiungi una clausola `WHERE DATE(event_timestamp) BETWEEN X AND Y` alla query, solo le partition rilevanti vengono scansionate:

```sql
CREATE TABLE `project.dataset.events`
PARTITION BY DATE(event_timestamp)
CLUSTER BY user_id, event_name
AS SELECT * FROM ...;
```

L'aggiunta del clustering su (user_id, event_name) garantisce che gli eventi dello stesso utente siano memorizzati fisicamente in blocchi vicini — la performance del join aumenta del 30-50%. Tuttavia, ciò da solo non è sufficiente; la logica di calcolo cohort viene rieseguita in ogni query. È qui che entra in gioco la materialized view.

## Materialized View: Tabella Cohort Incrementale

Le materialized view di BigQuery memorizzano il risultato della query fisicamente e si aggiornano automaticamente quando la tabella base cambia. Per l'analisi cohort usiamo questa struttura:

```sql
CREATE MATERIALIZED VIEW `project.dataset.user_cohorts`
PARTITION BY cohort_date
CLUSTER BY user_id
AS
SELECT 
  user_id,
  MIN(DATE(event_timestamp)) AS cohort_date,
  COUNT(*) AS first_day_events
FROM `project.dataset.events`
GROUP BY user_id;
```

Questa view calcola e memorizza una sola volta la data in cui ogni utente è stato visto per la prima volta (cohort_date). Quando arrivano nuovi eventi, BigQuery elabora solo il delta — nessuna scansione completa. La partizione per cohort_date consente il pruning nelle query di retention quando filtri con `WHERE cohort_date = '2026-05-01'`.

Ora la query di calcolo retention si riduce a:

```sql
SELECT 
  c.cohort_date,
  DATE_DIFF(DATE(e.event_timestamp), c.cohort_date, DAY) AS day_n,
  COUNT(DISTINCT e.user_id) AS retained_users
FROM `project.dataset.user_cohorts` c
JOIN `project.dataset.events` e 
  ON c.user_id = e.user_id 
  AND DATE(e.event_timestamp) >= c.cohort_date
WHERE c.cohort_date BETWEEN '2026-05-01' AND '2026-05-15'
GROUP BY 1,2;
```

Questa query esegue il join verso la materialized view invece della tabella base — il numero di righe da scansionare scende da milioni a migliaia. Tuttavia continua a scansionare la tabella degli eventi ogni giorno. Nel passaggio successivo creiamo una tabella retention pre-aggregata.

## Tabella Retention Pre-Aggregata: Strato Finale

L'analisi cohort generalmente esamina intervalli fissi come "Day 0, Day 1, Day 7, Day 30" — non è necessario ricalcolare ogni giorno per ogni intervallo. Con dbt implementiamo questa logica:

1. Ogni giorno, estrai i nuovi cohort dalla view `user_cohorts`
2. Calcola la retention degli ultimi 30 giorni per ogni cohort (dopo i primi 30 giorni non cambierà più)
3. Scrivi il risultato nella tabella `cohort_retention_summary` in modo **incrementale**

Modello dbt:

```sql
{{
  config(
    materialized='incremental',
    unique_key=['cohort_date','day_n'],
    partition_by={'field':'cohort_date','data_type':'date'},
    cluster_by=['day_n']
  )
}}

WITH cohorts_to_update AS (
  SELECT DISTINCT cohort_date 
  FROM {{ ref('user_cohorts') }}
  WHERE cohort_date >= CURRENT_DATE() - 31
  {% if is_incremental() %}
    AND cohort_date > (SELECT MAX(cohort_date) FROM {{ this }})
  {% endif %}
),
retention_calc AS (
  SELECT 
    c.cohort_date,
    DATE_DIFF(DATE(e.event_timestamp), c.cohort_date, DAY) AS day_n,
    COUNT(DISTINCT e.user_id) AS retained_users,
    MAX(c.first_day_events) AS cohort_size
  FROM {{ ref('user_cohorts') }} c
  JOIN {{ source('raw','events') }} e 
    ON c.user_id = e.user_id
  WHERE c.cohort_date IN (SELECT cohort_date FROM cohorts_to_update)
    AND DATE(e.event_timestamp) >= c.cohort_date
    AND DATE_DIFF(DATE(e.event_timestamp), c.cohort_date, DAY) <= 30
  GROUP BY 1,2
)
SELECT 
  cohort_date,
  day_n,
  retained_users,
  cohort_size,
  SAFE_DIVIDE(retained_users, cohort_size) AS retention_rate
FROM retention_calc;
```

Questo modello aggiorna ogni giorno solo i cohort degli ultimi 31 giorni. I cohort più vecchi di 31 giorni hanno una retention stabile — non vengono ricalcolati. L'utilizzo di slot scende del 95%. [Nel processo di CDP & Retention Engineering](https://www.roibase.com.tr/it/retention-engineering-cdp) questa tabella viene collegata direttamente al dashboard — gli strumenti BI (Looker, Metabase) restituiscono query in 100ms.

## Strategia di Query Cost e Partition Expiration

Su BigQuery lo storage è economico ($0,02/GB/mese), il compute è costoso ($5/TB di dati elaborati). Poiché l'analisi di retention è retrospettiva, le partition più vecchie vengono scansionate frequentemente. Due ottimizzazioni:

1. **Partition expiration:** Cancella automaticamente le partition della tabella `events` più vecchie di 90 giorni — dopo che il calcolo cohort è completato, non hai più bisogno degli eventi raw.
2. **Aggiorna le statistiche di clustering periodicamente:** `ANALYZE TABLE ... UPDATE STATISTICS` — l'optimizer di query sceglie un piano di esecuzione migliore.

Esempio di confronto dei costi (100M eventi/giorno, 1M utenti):

| Metodo | Dati elaborati/giorno | Costo compute mensile |
|---|---|---|
| Query ingenua (full scan) | 12TB | $600 |
| Partitioned + materialized view | 800GB | $40 |
| Tabella pre-aggregata (incrementale) | 50GB | $2,50 |

Aggiungere lo strato pre-aggregato riduce il costo di compute di 240 volte. Questa differenza è critica in produzione — soprattutto se l'analisi di retention viene aggiornata ogni ora.

## Trade-off della Retention Analysis in Tempo Reale

La struttura con materialized view e pre-aggregate introduce un trade-off di latenza: i dati ritardano di 1-5 minuti. Se hai bisogno di retention analysis in tempo reale (ad esempio per le prime 24 ore), puoi implementare un approccio ibrido:

- Per i dati delle ultime 24 ore: streaming insert + real-time query (cache disabilitato)
- Per i dati più vecchi di 24 ore: tabella pre-aggregata

In questo caso la query BI unisce le due fonti con UNION ALL:

```sql
SELECT * FROM cohort_retention_summary WHERE cohort_date < CURRENT_DATE()
UNION ALL
SELECT * FROM realtime_cohort_view WHERE cohort_date = CURRENT_DATE();
```

Anche se la real-time view è costosa, poiché viene eseguita solo per il cohort più recente, l'impatto complessivo sul compute rimane contenuto.

## Segmentazione Cohort e Esplosione di Cardinalità

Disaggregare l'analisi di retention per segmento utente (piattaforma, paese, canale di acquisizione) può innescare problemi di cardinalità. Ad esempio 5 segmenti × 30 giorni × 365 cohort = 54.750 righe univoche. In questo caso:

1. **Limita il numero di segmenti:** Esegui l'analisi su 3-5 segmenti più importanti, crea tabelle separate per gli altri.
2. **Segmentazione dinamica:** Anziché aggiungere informazioni di segmento alla tabella pre-aggregata, usa il filtering al momento del join — mantiene la flessibilità della query ma aumenta l'utilizzo di slot.
3. **Tabella di rollup:** Crea una tabella separata per cohort settimanali (weekly_cohort_retention) — la cardinalità scende dell'85%.

Nel processo di [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/it/verianalizi) di Roibase, integriamo la strategia di segmentazione con l'attribution della fonte di acquisizione — l'analisi cohort viene collegata direttamente alla performance del canale.

## Monitoraggio e Rilevamento di Regressioni

Per monitorare la retention pipeline in produzione, traccia queste metriche:

- **Query slot time:** Utilizzo di slot BigQuery del refresh giornaliero — un aumento improvviso indica esplosione di cardinalità o perdita di partition pruning.
- **Row count delta:** Numero di righe aggiunte ad ogni refresh — se superiore al previsto, segnala rischio di eventi duplicati.
- **Retention rate stddev:** Una variazione improvvisa di Day 1 retention del 10%+ è un segnale di problemi di data quality.

Puoi aggiungere questi check come test all'interno di dbt:

```yaml
tests:
  - dbt_utils.expression_is_true:
      expression: "retention_rate BETWEEN 0 AND 1"
  - dbt_utils.recency:
      datepart: day
      field: cohort_date
      interval: 1
```

Se un test fallisce viene attivato un alert su Slack o PagerDuty — non è necessario controllare manualmente.

L'architettura della tabella cohort trasforma l'analisi di retention da "query ad-hoc" a "data product pronto per la produzione". Il refresh incrementale con materialized view, il pruning delle query con partitioning, l'ottimizzazione degli slot con pre-aggregazione — ogni strato riduce i costi di 10 volte. Eseguire analisi di retention su milioni di utenti e miliardi di eventi ora si riduce a una query dashboard di 100ms. Decidere quali pattern di retention monitorare rimane compito tuo — ma elaborare i dati a questa velocità non è più un problema di engineering.