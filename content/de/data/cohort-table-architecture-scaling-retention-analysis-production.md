---
title: "Cohort-Tabellenarchitektur: Skalierung der Retention-Analyse in der Produktion"
description: "Erfahren Sie, wie Sie Cohort-Analysetabellen in der Produktionsumgebung mit materialisierten Views, Partitionierung und Query-Kostenoptimierung skalieren."
publishedAt: 2026-07-28
modifiedAt: 2026-07-28
category: data
i18nKey: data-007-2026-07
tags: [cohort-analysis, bigquery, materialized-views, data-engineering, retention]
readingTime: 9
author: Roibase
---

Jede Organisation, die Retention-Analysen durchführt, stößt auf das gleiche Problem: Cohort-Abfragen dauern in der Produktion entweder 30 Sekunden oder die BigQuery-Rechnung nähert sich monatlich 8.000 Dollar. Eine `GROUP BY user_id, cohort_week`-Abfrage, die mit 100.000 Nutzern in der Test-Umgebung reibungslos funktioniert, bricht zusammen, wenn sie mit 50 Millionen Nutzern und zwei Jahren Event-Logs konfrontiert wird. Die Lösung ist nicht einfach — es genügt nicht, einen Index hinzuzufügen oder Caching zu aktivieren. Die Tabellenarchitektur muss von Grund auf für Retention-Workloads neu gestaltet werden.

## Warum Cohort-Analyse eine andere Architektur erfordert

Eine klassische Event-Log-Tabelle basiert auf `user_id`, `event_time` und `event_name`. Jede Cohort-Abfrage durchsucht diese Tabelle rückwirkend nach Milliarden von Zeilen und gruppiert Nutzer nach ihrem ersten Event-Datum. In BigQuery sieht diese Abfrage folgendermaßen aus:

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

Diese Abfrage liest jedes Mal die gesamte `events`-Tabelle. 500 Millionen Zeilen × 16 Byte durchschnittlich = 8 GB Scan. In BigQuery kosten 1 TB Scan $6,25, also 1.000 Abfragen = $50. Wenn das Dashboard alle 5 Minuten aktualisiert wird, sind das 8.640 Abfragen monatlich = $432 nur für das Cohort-Widget. Füge dem Team 10 weitere Analysten hinzu, lass Slack-Bots Queries auslösen, und die Kosten verdoppeln sich.

Das eigentliche Problem ist nicht einmal die Kosteneffizienz — es ist die Latenz. Der JOIN mit 500 Millionen Zeilen dauert 15–30 Sekunden. Der Nutzer ändert einen Filter auf dem Dashboard, wartet 20 Sekunden auf neue Cohort-Daten. Retention-Analyse kann nicht iterativ sein, wenn die Latenz so hoch ist.

### Materialisierte Views sind ein erster Schritt, aber nicht ausreichend

BigQuery-Materialisierte Views pre-computet die Cohort-Abfrage:

```sql
CREATE MATERIALIZED VIEW cohort_retention AS
SELECT 
  cohort_week,
  weeks_since_cohort,
  active_users
FROM retention; -- Ergebnis der obigen CTE-Abfrage
```

Das Dashboard liest nun die `cohort_retention`-Tabelle statt die `events`-Tabelle. Der Scan sinkt von 8 GB auf 80 MB. Die Latenz fällt von 20 Sekunden auf 800 ms. Aber es gibt zwei Einschränkungen:

1. **Refresh-Kosten:** Jedes Mal, wenn die materialisierte View aktualisiert wird, führt sie die Basis-Abfrage erneut aus. Das bedeutet, es findet wieder ein 8-GB-Scan statt. Wenn die View stündlich aktualisiert wird, sind das 24 × 8 GB = 192 GB/Tag = monatlich 5,8 TB Scan. Die Kosten sind nicht gesunken, nur die Latenz.
2. **Flexibilität:** Die materialisierte View ist statisch. Wenn der Nutzer "iOS-Cohort-Retention" filtert, muss die View neu berechnet werden. Man kann keinen Pre-Filter hinzufügen, weil `WHERE platform = 'iOS'` eine andere View erfordert.

Deshalb muss die Cohort-Architektur dreischichtig aufgebaut werden: Raw Events → Cohort-Zuordnungstabelle → Aggregierte Retention-Tabelle.

## Die Cohort-Zuordnungstabelle separieren

Der erste Schritt besteht darin, eine separate Tabelle zu erstellen, die jeden Nutzer seiner Cohort zuordnet. Diese Tabelle enthält nur `user_id` und `cohort_week`, wird aus dem Event-Log abgeleitet, aber nur einmal täglich berechnet:

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

Diese Tabelle:
- **Partition nach cohort_week:** BigQuery erstellt für jede Woche separate Dateiblöcke. Der Filter `WHERE cohort_week = '2026-01-05'` liest nur 1 Partition.
- **Clustering nach user_id:** Innerhalb der Partition sortierte Speicherung nach user_id. JOINs werden schneller.
- **Größe:** 50 Millionen Nutzer × 3 Spalten × 16 Byte = ~2,4 GB. Wenn das Event-Log 500 GB groß ist, ist die Cohort-Tabelle 200× kleiner.

Nun verwendet die Retention-Abfrage diese Tabelle:

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

Mit `cohort_assignments` werden durch Partition Pruning nur 4 Wochen Daten gelesen = 200 MB Scan. Der JOIN mit `events` ist immer noch vorhanden, aber er beginnt mit gefilterten Cohort-Daten — keine überflüssigen Nutzer.

### Inkrementelle Aktualisierung

Die `cohort_assignments`-Tabelle wird täglich aktualisiert, aber nicht jedes Mal von Grund auf neu berechnet. Verwende ein dbt-Incremental-Modell:

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

Dieses Modell verarbeitet beim ersten Durchlauf alle Daten, bei nachfolgenden Durchläufen nur neue Nutzer. Der Scan sinkt von 500 GB auf täglich 2 GB.

## Aggregierte Retention-Tabelle: Pre-Compute von Metriken auf Wochenebene

Die Cohort-Zuordnungstabelle beschleunigte die Retention-Abfrage, aber das Dashboard führt immer noch einen JOIN mit der `events`-Tabelle durch, wenn es eine Abfrage erhält. Ein weiterer Schritt: Pre-compute die Retention-Metriken auf Wochenbasis und speichere sie in einer separaten Tabelle.

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

Diese Tabelle:
- **Größe:** 52 Wochen × 52 weeks_since × 3 Metriken = ~8.100 Zeilen (für Daten eines Jahres). Im Kilobyte-Bereich.
- **Scan:** Das Dashboard liest `cohort_retention_weekly`, nicht `events`. Scan < 1 MB.
- **Latenz:** BigQuery liest 1 MB Daten in 80 ms. Das Dashboard ist nun sub-second.

Trade-off: Diese Tabelle muss täglich aktualisiert werden. Wenn veraltete Daten nicht akzeptabel sind, alle Stunde aktualisieren (dbt Schedule `0 * * * *`). Refresh-Kosten: cohort_assignments JOIN events, ~10 GB Scan. 24× täglich = 240 GB, monatlich 7,2 TB. Zum Vergleich: Hätte das Dashboard 1.000× die Cohort-Abfrage ausgeführt, wären es 8 TB Scan gewesen. Die aggregierte Tabelle reduzierte den Scan um ~10%, reduzierte aber die Latenz von 20 Sekunden auf 80 ms.

### Partitionierungsstrategie: cohort_week vs event_week

Sollte die Cohort-Retention-Tabelle nach `cohort_week` oder `event_week` partitioniert werden? Es gibt zwei Ansätze:

**Partition nach cohort_week:**
- Anwendungsfall: "Was ist die Retention-Kurve von Cohort 2026-W03?"
- Pruning: `WHERE cohort_week = '2026-01-13'` → 1 Partition wird gelesen
- Schwachstelle: Wenn das Dashboard "gesamte Retention der letzten 4 Wochen" abfragt, werden 4 Partitions gelesen. Aber da die meisten Retention-Analysen cohort-basiert sind, ist dies optimal.

**Partition nach event_week:**
- Anwendungsfall: "Welche Cohorts waren diese Woche aktiv?"
- Pruning: `WHERE event_week = '2026-07-21'` → 1 Partition wird gelesen
- Schwachstelle: Wenn ein Cohort-Filter hinzugefügt wird, funktioniert die Partition Pruning nicht, alle Partitions werden gelesen.

Bei Roibase-[Datenanalytik](https://www.roibase.com.tr/de/verianalizi)-Projekten werden Retention-Tabellen nach cohort_week partitioniert, weil 80% der Retention-Abfragen das Format "Cohort X in Woche N" haben.

## Query-Kostenoptimierung: Clustering und BI Engine

Partitionierung pruned von oben nach unten (welche Dateiveblöcke werden gelesen), Clustering sortiert von links nach rechts (welche Zeilen im Block werden gelesen). Zusammen minimiert dies den Scan.

```sql
CREATE TABLE cohort_retention_weekly
PARTITION BY cohort_week
CLUSTER BY weeks_since_cohort, platform, country;
```

Wenn die Abfrage `WHERE weeks_since_cohort = 4 AND platform = 'iOS'` ist:
1. Partition Pruning → nur relevante cohort_week Partitions
2. Clustering → innerhalb der Partition zuerst `weeks_since_cohort = 4` Zeilen, dann `platform = 'iOS'` Zeilen

BigQuery akzeptiert maximal 4 Clustering-Spalten. Die Reihenfolge ist wichtig: die am häufigsten gefilterte Spalte zuerst.

**BI Engine:** BigQuery's In-Memory-Cache-Layer. Wenn man 100 GB BI Engine reserviert, werden häufig verwendete Tabellen im RAM gespeichert. Wenn die `cohort_retention_weekly`-Tabelle 50 MB groß ist, bleibt sie komplett im BI Engine, Scan = 0 (Cache Hit). Kosten: 100 GB BI Engine = $100/Monat. Gegenwert: monatlich 10 TB Scan-Einsparungen = $62,50. ROI ist positiv.

### Approximationsfunktionen: Metriken, die keine exakte Genauigkeit erfordern

Bei der Cohort-Retention-Berechnung müssen einige Metriken exakt sein (`COUNT(DISTINCT user_id)`), andere können Approximationen sein (Median Session Duration, Perzentile).

BigQuery Approximationsfunktionen:
- `APPROX_COUNT_DISTINCT(user_id)` → Fehlertoleranz 2%, 10× schneller
- `APPROX_QUANTILES(value, 100)[OFFSET(50)]` → Median, Fehlertoleranz 1%
- `APPROX_TOP_COUNT(event_name, 10)` → Top 10 Events, Fehlertoleranz gering

Beispiel: Für 50 Millionen Nutzer dauert exaktes `COUNT(DISTINCT ...)` 8 Sekunden, `APPROX_COUNT_DISTINCT` 800 ms. Für Live-Filter im Dashboard Approximationen verwenden, für finale Berichte exakt.

## Inkrementelle Update-Strategie: Event-Time vs Processing-Time

Während die Cohort-Tabelle täglich aktualisiert wird, welche Events sollten verarbeitet werden? Es gibt zwei Timestamps:

1. **event_time:** Zeitstempel, wann der Nutzer das Event durchgeführt hat (Client-seitig)
2. **_PARTITIONTIME:** Zeitstempel, wann BigQuery das Event gespeichert hat (Server-seitig)

Wenn inkrementelle Aktualisierung `event_time` nutzt:
```sql
WHERE event_time > (SELECT MAX(event_time) FROM cohort_assignments)
```
**Problem:** Late-arriving Events. Der Nutzer ist 3 Tage offline, Event kommt als Batch-Upload. Wenn `event_time` 3 Tage zurückliegt, verpasst die inkrementelle Abfrage es.

Wenn inkrementelle Aktualisierung `_PARTITIONTIME` nutzt