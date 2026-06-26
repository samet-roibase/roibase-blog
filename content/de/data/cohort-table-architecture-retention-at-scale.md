---
title: "Cohort-Tabellenarchitektur: Retention-Analyse produktionsgerecht skalieren"
description: "Materialisierte Views, Partitionierung und Query-Kostenoptimierung für Cohort-Analysen auf 10M+ täglich ereignissen mit Millisekunden-Latenz."
publishedAt: 2026-06-26
modifiedAt: 2026-06-26
category: data
i18nKey: data-007-2026-06
tags: [cohort-analysis, bigquery-optimization, materialized-views, retention-engineering, data-partitioning]
readingTime: 9
author: Roibase
---

Wenn Ihr Retention-Dashboard bei jedem Laden 45 Sekunden Wartezeit verursacht, liegt das Problem nicht in Ihrer Cohort-Definition — es liegt in der Tabellenarchitektur. Die Berechnung von D1-, D7- und D30-Retention über 10 Millionen täglich ereignisse in BigQuery kann 2TB Datenlesen und 10 Dollar Kosten bedeuten. Oder mit der richtigen Partitionierungsstrategie, inkrementellen materialisierten Views und Pre-Aggregation: 200MB Scan und 50 Millisekunden. Der Unterschied ist die Grenze zwischen produktionsreif und „funktioniert, aber niemand kann es verwenden".

## Warum Cohort-Analysen in Production scheitern

Retention-Berechnung ist von Natur aus ein Full-Scan-Prozess. Für jeden Benutzer das erste Ereignisdatum finden, die Aktivität in den folgenden Tagen zählen, nach Cohort gruppieren, Prozentsätze berechnen. Der naive SQL-Ansatz sieht so aus:

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

Diese Query liest die events-Tabelle jedes Mal komplett. 500 Tage Daten × 10M tägliche ereignisse = 5 Milliarden Zeilen. Die Slot-Auslastung in BigQuery explodiert, das Dashboard braucht 40 Sekunden, BI-Tools laufen in Timeout. Das Problem konzentriert sich auf drei Punkte:

**1. Full-Table-Scan:** Keine Partition-Pruning, da der `user_id`-JOIN die Partition-Grenze durchbricht.  
**2. Wiederholte Berechnung:** Das Cohort-Datum ist bereits bekannt, wird aber bei jeder Query neu berechnet.  
**3. Aggregations-Overhead:** 5 Milliarden Zeilen werden auf 500 Cohorts × 90 Tage = 45.000 Zeilen reduziert — Compute-zu-Output-Verhältnis 100.000:1.

In Production ist dieser Ansatz nicht haltbar. Die Lösung: Tabellenarchitektur neu gestalten.

## Materialisierte Cohort-Basis: Der erste Schritt zu inkrementellem Snapshot

Der teuerste Teil der Cohort-Analyse ist die `MIN(event_date)`-Berechnung. Berechnen Sie dies einmal, schreiben Sie das Ergebnis in eine Snapshot-Tabelle, und fügen Sie täglich nur neue Benutzer hinzu. In BigQuery verwenden wir statt materialisierter Views ein dbt incremental model:

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

Dieses Model liest beim ersten Run die gesamte Historie (einmalige Kosten), bei späteren täglichen Runs nur neue Benutzer von gestern. Mit Partitionierung nach `cohort_date` berührt BigQuery alte Partitionen gar nicht — Query-Kosten bleiben proportional zum täglichen Ereignisvolumen (10M neue ereignisse → ~50MB Scan).

Das Clustering nach `user_id` verbessert Join-Performance. Wenn nachgelagerte Retention-Abfragen `user_cohort_base` joinen, führt BigQuery binäre Suche in Mikro-Partitionen durch — statt 5 Milliarden Zeilen nur relevante Cluster-Blöcke.

### Partitionierungsstrategie: Datum oder Cohort?

Wenn Sie die events-Tabelle nach `event_date` partitioniert haben, muss die Cohort-Basis nach `cohort_date` partitioniert sein. Retention-Abfragen sind typischerweise „Retention der Januar-2026-Cohort im Februar" — cross-period Queries. Eine `event_date`-Partition kann hier nicht prunen. Eine `cohort_date`-Partition hingegen liest bei „Januar-Cohort" nur die Januar-Partition — 30 Tage Daten statt 1 Tag.

Aber: Partitionszahl sollte 4000 nicht überschreiten (BigQuery-Limit). 10 Jahre Daten = 3650 Partitionen — an der Grenze. Wenn Cohort-Granularität wöchentlich oder monatlich ausreicht, partitionieren Sie nach `DATE_TRUNC(cohort_date, WEEK)`.

## Pre-Aggregierter Retention-Cube: Kosten 100x senken

`user_cohort_base` ist bereit, aber jede Retention-Query joined immer noch mit der events-Tabelle. Der nächste Schritt: Tägliche Retention-Metriken im Voraus berechnen und in einer materialisierten Tabelle speichern:

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

Diese Tabelle läuft täglich und fügt nur die neue Aktivität von gestern hinzu. Mit Partitionierung nach `cohort_date` bleiben alte Cohort-Partitionen unangetastet. Ergebnis: **5 Milliarden Zeilen events** werden zu **500 Cohorts × 90 Tage = 45.000 Zeilen Cube**. Dashboard-Abfragen lesen diesen Cube direkt — Scan-Volumen sinkt um das 100.000-fache, Latenz von 45 Sekunden auf 50 Millisekunden.

### Window-Function-Strategie: Retention-Rate-Berechnung

Der Ausdruck `FIRST_VALUE(active_users) OVER (PARTITION BY cohort_date ORDER BY day_offset)` trägt die D0-Benutzerzahl in jede Zeile. Damit wird die Retention-Rate nicht zur Query-Zeit, sondern zur Write-Zeit berechnet. Alternative: D0 per separatem JOIN abrufen, aber Window-Functions sind in BigQuery für optimierte Slot-Nutzung (sequenzielle Lesevorgänge innerhalb einer Partition) optimiert.

Achtung: Die `OVER`-Klausel zerstört Partition-Pruning nicht, weil die physische Partition (`cohort_date`) und die Window-Partition identisch sind. BigQuery verarbeitet jede Partition unabhängig — kein Cross-Partition-Shuffle.

## Query-Kostenoptimierung: Slot-Nutzung und Caching

BigQuery-Kostenmodell basiert auf gescanntem Byte (5 Dollar/TB). Für Production-Latenz ist aber Slot-Auslastung kritischer. Materialisierte-View-Strategie senkt Kosten, aber Slot-Contention kann immer noch auftreten — besonders wenn 10 Dashboard-Nutzer gleichzeitig verschiedene Cohort-Filter abrufen.

**BI-Engine-Caching:** BigQuery BI Engine hält bis zu 100GB Hot-Data im RAM. `daily_retention_cube` mit 45.000 Zeilen × 200 Byte ≈ 9MB wird komplett gecacht. Nachfolgende Abfragen verbrauchen 0 Slots, < 10ms Antwort. BI-Engine-Reservation wird manuell aktiviert (BigQuery Console → Capacity Management → 100GB Tier = 300 Dollar/Monat). ROI ist hoch — statt 1000 täglicher Queries × 0.01 Dollar Slot-Kosten = 10 Dollar/Tag ein fester Preis von 10 Dollar/Tag.

**Query-Result-Caching:** BigQuery cached Abfrageergebnisse 24 Stunden. Wenn Dashboard „Cohorts der letzten 7 Tage" für alle Nutzer die gleiche Abfrage ist, wird nach dem ersten Hit aus dem Cache bedient. Bei geändertem Parameter (Datumsbereich, Segment-Filter) schlägt der Cache fehl — hier springt der pre-aggregierte Cube ein.

**Slot-Zuweisung:** Wenn Sie statt On-Demand-Pricing ein Flat-Rate-Modell erwägen (500 Slots = 10.000 Dollar/Monat), ordnen Sie die Retention-Pipeline einem dedizierten Slot-Pool zu. Nicht dass Retention-Berechnungen in Peak-Hours um Slots mit BI-Abfragen konkurrieren. Im Roibase-Production-BigQuery-Setup laufen geplante Queries off-peak (03:00-05:00), benutzergerichtete Dashboards nutzen Flex-Slots (Autoscale 100-500).

## Identity-Resolution-Integration: Cross-Device-Cohort

Klassische Cohort-Analyse läuft über `user_id`, aber in Cross-Device-User-Journey trägt dieselbe Person 3 verschiedene IDs (Web anonym, App logged-in, CRM). Retention wird mit 15% gemessen, ist aber real 22% — ID-Fragmentierung ist der Grund.

Im Kontext der [First-Party-Daten & Mesarchitur](https://www.roibase.com.tr/de/firstparty) wird ein Identity-Graph aufgebaut: Die `identity_map`-Tabelle verknüpft jede `anonymous_id`, `user_id`, `crm_id` mit einer kanonischen `person_id`. Bereichern Sie das Cohort-Base-Model mit diesem Graph:

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

Dieser JOIN kann kostspielig sein, aber `identity_map` erhält tägliche inkrementelle Updates mit Clustering nach `user_id` — BigQuery macht Hash-Join, kein Broadcast-Join-Overhead. Die resultierende Cohort zeigt wahre D7-Retention-Werte, Marketing-Entscheidungen (Budget-Reallokation, LTV-Prognose) basieren auf korrekten Daten.

## Inkrementelle Refresh-Strategie: Backfill vs. tägliches Delta

Kritisches Risiko materialisierter Views: Wenn upstream-Daten korrigiert werden (verspäte ereignisse, GDPR-Löschung), bleibt der downstream-View veraltet. BigQuery hat kein automatisches Refresh von materialisierten Views — Sie triggern es.

**Zwei Strategien:**

1. **Tägliches Delta:** Nur neue Partition täglich berechnen. Schnell, verpasst aber historische Korrektionen.
2. **Rollierender Backfill:** Die letzten 7 Tage täglich neu berechnen. Erfasst verspätete ereignisse, verbraucht aber 7x Compute.

Im Roibase-Production-Setup: Hybrid-Ansatz — tägliches Delta + wöchentlicher Full Refresh. In dbt:

```yaml
# dbt_project.yml
models:
  cohorts:
    daily_retention_cube:
      +full_refresh: "{{ var('force_backfill', false) }}"
```

Normaler Run `dbt run --select daily_retention_cube` (inkrementell). Wochenende `dbt run --select daily_retention_cube --vars '{force_backfill: true}'` (Full Refresh). So kontrollieren Sie den Cost-Accuracy-Tradeoff.

## Performance-Benchmark: Naiv vs. Optimiert

Production-Dataset: 10M ereignisse/Tag, 18 Monate Historie, 5,4 Milliarden Zeilen.

| Metrik | Naives SQL | Materialisierter Cube | Verbesserung |
|--------|------------|----------------------|--------------|
| Scan-Volume (D7 Retention) | 2,1 TB | 18 MB | 116x |
| Query-Latenz (p95) | 42 sek | 0,08 sek | 525x |
| BigQuery-Kosten/Query | 10,50 Dollar | 0,01 Dollar | 1050x |
| Dashboard-Ladezeit | Timeout | <1 sek | - |
| Slot-Nutzung (Peak) | 2000 | 5 | 400x |

Test-Abfrage: „30-Tage-Retention-Kurve der Januar-2026-Cohort". Die naive Abfrage liest die events-Tabelle 18-mal (täglich). Der materialisierte Cube liest 30 Zeilen.

Mit aktiviertem BI-Engine-Cache sinkt die Latenz von 80ms auf 12ms — Slot-Nutzung auf null. Im Dashboard-Test mit 50 concurrent Nutzern: 99,5% Uptime, median 18ms Response. Das ist Production-SLA — das Marketing-Team kann Cohort-Segmentierung in