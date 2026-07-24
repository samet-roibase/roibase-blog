---
title: "Marketing Mix Modeling: Praktische Einrichtung mit Robyn"
description: "MMM-Einrichtung mit Metas Robyn-Framework: Sättigungskurven, Adstock-Decay, Holdout-Validierung. R-Code und BigQuery-Integration inklusive."
publishedAt: 2026-07-24
modifiedAt: 2026-07-24
category: data
i18nKey: data-005-2026-07
tags: [marketing-mix-modeling, robyn, attribution, datenwissenschaft, bigquery]
readingTime: 9
author: Roibase
---

Attribution ist zerrüttet. iOS 14.5, Consent Mode v2, der Rückzug von Third-Party-Cookies — alles zwingt digitale Vermarkter zur gleichen Frage: Welcher Kanal wirkt wirklich? Marketing Mix Modeling (MMM) beantwortet sie statistisch, unabhängig von Cookies und Pixeln, auf Aggregat-Ebene. Metas Open-Source-Framework Robyn verwandelt MMM aus einer akademischen Übung in eine produktionsreife Pipeline. Dieser Artikel zeigt konkrete Schritte: Robyn von Grund auf einrichten, Sättigungskurven interpretieren, Adstock-Decay-Parameter anpassen und das Modell mit Holdout-Validierung testen.

## Was ist MMM und warum ist es jetzt kritisch

Marketing Mix Modeling erklärt die Beziehung zwischen Medienausgaben und Umsatz oder Conversions mittels regressionsbasierter Statistik. Es erfordert keine User-Level-Daten — es funktioniert mit aggregierten wöchentlichen oder täglichen Metriken wie Ausgaben, Impressionen und Umsatz. Das Modell berechnet die marginale Beitrag (Incrementality) jedes Kanals und zeigt auf, welcher Kanal in die Sättigung eintritt.

Last-Click-Attribution ist pixelbasiert — sie schreibt dem letzten angeklickten Kanal den ganzen Kredit zu. MMM beobachtet dagegen alle Kanäle über das gleiche Zeitfenster und isoliert Korrelationen. Wenn TV-Werbung zum Beispiel eine 3-Wochen-Verzögerung vor dem Umsatz hat (Carryover-Effekt), erfasst das Modell dies mit dem „Adstock"-Parameter. Die Sättigungskurve zeigt Diminishing Returns: Die erste 100.000 € Ausgaben generieren 50 Conversions, die nächsten 100.000 € möglicherweise nur 20.

Robyn verpackt diesen mathematischen Rahmen in ein R-Paket, trainiert auf Metas eigenem Kampagnendaten. Es enthält Bayesian-Ridge-Regression, Multi-Objective Evolutionary Algorithm (MOEA) zur Hyperparameter-Optimierung und Nevergrad-Optimierung. Nach der Datenvorbereitung erzeugt eine 50-zeilige R-Skript das Modell — keine manuelle Einrichtung.

## Datenvorbereitung: BigQuery zu Robyn

Robyn erwartet eine einzelne CSV oder Data.Frame als Input. Jede Zeile ist ein Zeitraum (Woche oder Tag), jede Spalte sind Kanalausgaben, Impressionen oder Umsatz-Metriken. Fehlende Daten werden nicht akzeptiert — sind leere Zellen vorhanden, musst du Imputation durchführen. Das minimale Schema:

| date       | tv_spend | fb_spend | google_spend | revenue | control_var |
|------------|----------|----------|--------------|---------|-------------|
| 2024-01-01 | 50000    | 12000    | 8000         | 120000  | 0.8         |
| 2024-01-08 | 55000    | 13000    | 9000         | 135000  | 0.9         |

Um diese Daten aus BigQuery zu ziehen, nutze eine wöchentliche Aggregations-Query:

```sql
SELECT
  DATE_TRUNC(event_date, WEEK) AS date,
  SUM(IF(channel = 'tv', spend, 0)) AS tv_spend,
  SUM(IF(channel = 'facebook', spend, 0)) AS fb_spend,
  SUM(IF(channel = 'google', spend, 0)) AS google_spend,
  SUM(revenue) AS revenue,
  AVG(seasonality_index) AS control_var
FROM `project.dataset.marketing_events`
WHERE event_date BETWEEN '2022-01-01' AND '2024-12-31'
GROUP BY 1
ORDER BY 1
```

Kontrollvariablen (Trend, Saisonalität, makroökonomische Indikatoren) sind optional, aber verbessern die Erklärungskraft des Modells. Im Einzelhandel beispielsweise — Januar ist ein Rabatt-Monat — eine Dummy-Variable hinzufügen. Robyn bindet diese Variablen als „organische" Baseline in die Regression ein.

Um Daten in R zu laden, verwende das `bigrquery`-Paket:

```r
library(bigrquery)
bq_auth(path = "service-account-key.json")
sql <- "SELECT date, tv_spend, fb_spend, google_spend, revenue FROM ..."
df <- bq_project_query("your-project-id", sql) %>% bq_table_download()
```

Die `robyn_inputs()`-Funktion validiert das Schema. Die Datumsspalte muss Date-Klasse sein, Metriken numerisch.

## Robyn-Modellkonfiguration: Adstock und Sättigung

Robyns Kern sind die Funktionen `robyn_inputs()` und `robyn_run()`. Der erste Schritt besteht darin, Modell-Inputs zu definieren:

```r
library(Robyn)

InputCollect <- robyn_inputs(
  dt_input = df,
  date_var = "date",
  dep_var = "revenue",
  dep_var_type = "revenue",
  prophet_vars = c("trend", "season", "holiday"),
  prophet_country = "DE",
  paid_media_spends = c("tv_spend", "fb_spend", "google_spend"),
  paid_media_vars = c("tv_spend", "fb_spend", "google_spend"),
  context_vars = c("control_var"),
  adstock = "geometric",
  window_start = "2022-01-01",
  window_end = "2024-10-31"
)
```

**Adstock-Typ-Auswahl:**
- `geometric`: Am häufigsten. Konstante Decay-Rate (z.B. 80 % bleiben jede Woche). Für TV und Display geeignet.
- `weibull`: Asymmetrischer Decay — schneller Abfall am Anfang, dann Verflachung. Sinnvoll für Video und Influencer-Kampagnen.

Geometric-Adstock-Formel:

```
transformed_value[t] = spend[t] + theta * transformed_value[t-1]
```

`theta` ist die Decay-Rate (0–1 Bereich). Robyn optimiert diesen Parameter automatisch, aber du kannst einen manuellen Range angeben:

```r
hyperparameters <- list(
  tv_spend_alphas = c(0.5, 3),       # Sättigungskurven-Koeffizient
  tv_spend_gammas = c(0.3, 1),       # Sättigungs-Inflexionspunkt
  tv_spend_thetas = c(0, 0.5),       # Adstock-Decay-Rate
  fb_spend_alphas = c(0.5, 3),
  fb_spend_gammas = c(0.3, 1),
  fb_spend_thetas = c(0, 0.3)
)

InputCollect <- robyn_inputs(
  InputCollect = InputCollect,
  hyperparameters = hyperparameters
)
```

**Sättigungsparameter:**
- `alpha`: Kurvenform. Hohes Alpha → späte Sättigung.
- `gamma`: Inflexionspunkt — 0.5 bedeutet Biegung in der Mitte.

Hill-Gleichung für Sättigung:

```
response = spend^alpha / (gamma^alpha + spend^alpha)
```

Robyn optimiert diese Parameter mit einem Evolutionary Algorithm. Es erzeugt 2000 Modelle und wählt die besten Trade-Offs vom Pareto-Frontier (R² vs. NRMSE-Ausgleich).

## Modell ausführen und Ergebnisse interpretieren

Robyn-Modell ausführen:

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  cores = 8
)
```

Die Ausgabe ist eine Liste — jede Iteration ein anderer Hyperparameter-Satz. Robyn wählt automatisch die 3 besten Modelle (Pareto-optimal). Ergebnisse:

```r
OutputModels$resultHypParam    # Parameter aller Modelle
OutputModels$xDecompAgg        # Kanal-basierte Contributions-Decomposition
OutputModels$resultCalibration # Holdout-Validierungs-Score
```

**Beispiel-Decompositions-Tabelle:**

| channel      | total_spend | total_response | roi   | mean_response |
|--------------|-------------|----------------|-------|---------------|
| tv_spend     | 2400000     | 1800000        | 0.75  | 15000         |
| fb_spend     | 600000      | 720000         | 1.20  | 6000          |
| google_spend | 400000      | 560000         | 1.40  | 4667          |

**ROI-Interpretation:** Facebook 1.20 — jede 1 € Ausgabe generiert 1.20 € Ertrag. TV 0.75 — nicht negativ, sondern 0.75 € inkrementeller Beitrag über die Baseline. Robyn misst „Incrementality", nicht Last-Click-Credit.

**Sättigungserkennung:** Robyn zeichnet die Sättigungskurve auf:

```r
robyn_onepagers(InputCollect, OutputModels, select_model = "2_100_3")
```

Im Plot siehst du, wo die Kurve flacher wird, wenn Ausgaben steigen. Zum Beispiel: Wenn TV-Ausgaben über 80.000 € steigen, sinkt der marginale Gewinn um 50 % — ein kritisches Signal für Budget-Optimierung.

## Holdout-Validierung und Modellzuverlässigkeit

Damit das MMM-Modell in der Produktion verwendet werden kann, teile die historischen Daten auf: Training-Set (z.B. Jan. 2022 – Okt. 2024) + Holdout-Set (Nov.–Dez. 2024). Das Modell wird auf dem Training-Set trainiert und auf dem Holdout getestet. Ein MAPE (Mean Absolute Percentage Error) unter 10 % deutet auf ein zuverlässiges Modell hin.

Robyn führt die Holdout-Validierung automatisch durch:

```r
InputCollect <- robyn_inputs(
  InputCollect = InputCollect,
  window_start = "2022-01-01",
  window_end = "2024-10-31",
  rollingWindowStartWhich = 52,  # letzte 52 Wochen als Holdout
  rollingWindowEndWhich = 4
)
```

Das Ergebnis steht in der `resultCalibration`-Tabelle:

| model_id  | nrmse_train | nrmse_val | decomp.rssd |
|-----------|-------------|-----------|-------------|
| 2_100_3   | 0.08        | 0.12      | 0.05        |

**NRMSE (normalized root mean squared error):** Niedriger ist besser. 0.12 ist akzeptabel (unter 0.15 ist produktionsreif).
**decomp.rssd:** Konsistenz der Decomposition zwischen Training und Validierung. 0.05 → 5 % Abweichung → stabiles Modell.

Schlägt die Holdout-Validierung fehl, gibt es zwei Möglichkeiten: (1) Daten sind unzureichend — mindestens 2 Jahre wöchentlicher Daten nötig. (2) Fehlende Variablen — Saisonalität, Konkurrenz-Ausgaben, Preisänderungen als konfundierende Variablen hinzufügen.

## Robyn-Output an die Entscheidungslogik anschließen

Exportiere die Decompositions-Tabelle als CSV, um Robyn-Ergebnisse nach BigQuery zu laden:

```r
write.csv(OutputModels$xDecompAgg, "robyn_output.csv")
```

Lade in BigQuery:

```sql
LOAD DATA OVERWRITE `project.dataset.mmm_results`
FROM FILES (
  format = 'CSV',
  uris = ['gs://bucket/robyn_output.csv']
);
```

Diese Tabelle verbindet sich mit Dashboards (Looker, Tableau) oder einem Budget-Optimizer. Zum Beispiel ein dbt-Modell zur Berechnung des Sättigungs-Schwellwerts:

```sql
WITH saturation AS (
  SELECT
    channel,
    total_spend,
    roi,
    total_spend / NULLIF(roi, 0) AS optimal_spend
  FROM `project.dataset.mmm_results`
)
SELECT * FROM saturation WHERE roi > 1.0 ORDER BY roi DESC;
```

Diese Abfrage ordnet Kanäle mit ROI > 1 — eine Prioritätsliste für Budget-Erhöhungen. Robyn verfügt auch über einen Budget-Allocator:

```r
AllocatorCollect <- robyn_allocator(
  InputCollect = InputCollect,
  OutputCollect = OutputModels,
  select_model = "2_100_3",
  scenario = "max_response",
  channel_constr_low = c(0.7, 0.7, 0.7),
  channel_constr_up = c(1.5, 1.5, 1.5)
)
```

Die Ausgabe ist das empfohlene neue Budget für jeden Kanal. Constraints halten Ausgaben zwischen 70–150 % des aktuellen Wertes (Mitigationm operationeller Risiken).

Die [First-Party-Daten- und Messarchitektur](https://www.roibase.com.tr/de/firstparty) ist für MMM kritisch — die Datenqualität, die Robyn einspeist, bestimmt direkt die Modellzuverlässigkeit. Fehlt Server-Side-Event-Tracking, Identity Resolution oder Consent-Mode-Integration, entsteht Bias auf Aggregat-Ebene.

## Häufige Fallstricke und Mitigation

**Multicollinearity:** Wenn zwei Kanäle immer gleichzeitig aktiv sind (z.B. TV + Facebook immer zusammen), kann das Modell ihre Beiträge nicht trennen. Braucht einen Variance Inflation Factor (VIF) Check:

```r
library(car)
vif_model <- lm(revenue ~ tv_spend + fb_spend + google_spend, data = df)
vif(vif_model)
```

VIF > 5 →