---
title: "Marketing Mix Modeling: Praktische Einrichtung mit Robyn"
description: "Metas Open-Source-MMM-Bibliothek Robyn: Sättigungskurven, Adstock-Decay und Holdout-Validierung auf Produktionsdaten durchlaufen."
publishedAt: 2026-07-07
modifiedAt: 2026-07-07
category: verianalizi
i18nKey: data-005-2026-07
tags: [marketing-mix-modeling, robyn, adstock, saturation-curve, media-attribution]
readingTime: 9
author: Roibase
---

Multi-Touch-Attribution-Modelle verlieren in der Post-Cookie-Ära an Zuverlässigkeit, während Marketing Mix Modeling wieder an Bedeutung gewinnt. Googles und Metas Open-Source-MMM-Tools (LightweightMMM, Robyn) ermöglichen es Marketern, Kanaleffektivität auf aggregierter Ebene zu messen. Mit der Robyn-Version 3.11 von Anfang 2025 wurde das Framework durch Bayesian-Optimierung und parallele Hyperparameter-Suche produktionsreif. Dieser Artikel behandelt die Robyn-Einrichtung anhand von drei Kernkonzepten: Sättigungskurve (Diminishing Returns), Adstock-Decay (verzögerte Wirkung) und Holdout-Validierung (Modellzuverlässigkeit).

## Was ist Robyn und warum ist es jetzt wichtig

Robyn ist ein R-Paket, das Meta 2021 als Open Source veröffentlichte. Das auf Ridge-Regression basierende Modell akzeptiert Kanal-Ausgaben und Konversionsdaten in wöchentlicher oder täglicher Aggregation und berechnet den inkrementellen Konversionsbeitrag (incremental conversions) jedes Kanals. Mit dem großen Update 2024 integrierte das Framework die Zeitreihenkomponenten von Prophet und unterstützt JSON-basierte Modell-Exporte — wodurch es sich auch in Python-Workflows einbinden lässt.

Drei Merkmale unterscheiden Robyn von anderen MMM-Ansätzen: Erstens modelliert es die Ausgaben-Konversions-Beziehung nicht linear, sondern mit Hill-Adstock-Transformation (realistische Sättigung). Zweitens löst es die Hyperparameter-Optimierung mit genetischen Algorithmen und dem Gradient-Free-Optimizer Nevergrad (manuelle Anpassung entfällt). Drittens meldet es automatisch Modellqualitätsmetriken (NRMSE, DECOMP.RSSD, MAPE). In der Produktion ist die integrierte Holdout-Validierungsfunktion entscheidend für die Modellzuverlässigkeit — die zeigen wir später.

Der Vorteil von Marketing Mix Modeling gegenüber Attribution liegt darin, dass es mit aggregierten Daten arbeitet — GDPR/CCPA-Beschränkungen wirken sich nicht aus und die Komplexität von Cross-Device-Journeys entfällt. Der Nachteil ist die Beschränkung auf wöchentliche Granularität — nicht für Intraday-Kampagnen-Optimierung geeignet, sondern für quartalsweise Budget-Allokation. Bei Roibase positionieren wir MMM innerhalb einer [First-Party-Datenarchitektur](https://www.roibase.com.tr/de/firstparty) zusammen mit Incrementality-Test-Ergebnissen: Ein hoher MMM-ROAS eines Kanals reicht nicht aus — er muss durch Geo-Split-Tests oder Synthetic-Control validiert werden.

## Datenvorbereitung: Kanalausgaben + Makrovariablen

Sie übergeben Robyn minimal folgende Spalten in einer wöchentlichen Zeitreihe:

```r
# Beispiel-Datenstruktur (2 Jahre wöchentlich)
data <- data.frame(
  date = seq(as.Date("2024-01-01"), by = "week", length.out = 104),
  revenue = rnorm(104, 50000, 8000),
  facebook_spend = rnorm(104, 5000, 1000),
  google_search_spend = rnorm(104, 7000, 1500),
  display_spend = rnorm(104, 3000, 800),
  competitor_index = rnorm(104, 100, 15),  # Makrovariable
  holiday_flag = sample(0:1, 104, replace = TRUE)
)
```

**Anzahl der Kanalspalten:** Minimum 2, Maximum 15 Kanäle empfohlen. Bei 20+ Kanälen steigt das Overfitting-Risiko und die Koeffizient-Stabilität sinkt. Falls Sie Long-Tail-Kanäle haben (Affiliate, Influencer, Podcast), fassen Sie diese unter `other_digital` zusammen — das ist robuster.

**Makrovariablen:** Saisonalität, Feiertage, Konkurrenzindex, wirtschaftliche Indikatoren sollten als Kontrollvariablen enthalten sein — sonst könnte das Modell alle Konversionsgewinne den Medienkanälen zuordnen. Prophets Zeitreihenkomponenten in Robyn erfassen Trend und Holidays automatisch, aber für sektorspezifische Schocks (Black Friday, Ramadan) sollten Sie `holiday_flag` hinzufügen.

**Datenqualitätsprüfungen:**
- Keine Spalte darf Varianz null haben (konstante Ausgaben sind nutzlos)
- Missing Values bis 5% akzeptabel — Robyn führt keine automatische Imputation durch
- Wöchentliche Granularität wird bevorzugt — täglich erhöht das Rauschen, monatlich reduziert die Beobachtungszahl

Falls Ausgabendaten aus verschiedenen Quellen stammen (Google Ads API, Meta Marketing API, internes Finance-System), sollten Sie eine ETL-Pipeline mit einem strukturierten [Datenanalyseprozess](https://www.roibase.com.tr/de/verianalizi) einrichten. In unserem Production-Workflow haben wir eine `marketing_spend_weekly`-Tabelle in BigQuery; jede Montagmorgen aktualisiert ein dbt-Modell diese Tabelle, und ein R-Skript liest von dort und triggert Robyn.

## Sättigung und Adstock: Hill-Adstock-Transformation

Robyn leitet jede Kanalausgabe durch zwei Transformationsstufen: zuerst Adstock (verzögerte Wirkung), dann Sättigung (Diminishing Returns).

### Adstock-Decay (geometrisch oder Weibull)

Die Wirkung einer TV-Werbung endet nicht sofort — sie bleibt mehrere Wochen in der Zuschauer-Erinnerung. Adstock modelliert dies. Robyn unterstützt zwei Adstock-Typen: `geometric` (einfach, exponentieller Verfall) und `weibull` (flexibel, S-Kurve).

**Geometrischer Adstock:**

```
adstocked_spend[t] = spend[t] + θ × adstocked_spend[t-1]
```

Hier ist `θ` (Theta) die Decay-Rate — 0,5 bedeutet, dass 50% der vorherigen Wochenwirkung in diese Woche überträgt. Robyn sucht diesen Parameter zwischen 0 und 0,9 automatisch.

**Weibull-Adstock:** Komplexer — mit Shape- und Scale-Parametern. Für "Awareness"-Kanäle wie TV, Outdoor und Influencer passt Weibull besser, da die Wirkung langsam beginnen, kulminieren und schnell abfallen kann.

**Praktischer Rat:** Starten Sie im ersten Modell-Durchlauf mit geometrischem Adstock — die Konvergenz ist schneller. Wenn die Modellleistung schlecht ist (NRMSE > 0,15) und Sie Awareness-fokussierte Ausgaben haben, versuchen Sie Weibull.

### Sättigung: Hill-Funktion

Wenn Sie die Ausgaben 2x erhöhen, verdoppelt sich die Konversion nicht — es gibt Diminishing Returns. Robyn modelliert dies mit der Hill-Gleichung:

```
effect = spend^α / (K^α + spend^α)
```

- `α` (Alpha): Kurvensteilheit — klein = langsame Sättigung, groß = schnelle
- `K`: Half-Saturation-Point — bei dieser Ausgabe wird die halbe maximale Wirkung erreicht

Robyn findet diese zwei Parameter für jeden Kanal während der Hyperparameter-Suche. Das Ergebnis ist die "Response Curve" jedes Kanals — zum Beispiel, dass Facebook Ads nach 10K€ flach wird, Google Search aber bis 20K€ linear bleibt.

**Warum Sättigungskurven wichtig sind:** Sie verwenden sie für Budget-Neuallokation. Wenn ein Kanal bereits im flachen Bereich ist (niedriger Slope), sollten Sie von dort Mittel nehmen und zu einem steiler ansteigenden Kanal verschieben — das erhöht den Gesamt-ROAS.

## Modell-Lauf und Hyperparameter-Tuning

Die Robyn-Einrichtung ist einfach:

```r
install.packages("Robyn")
library(Robyn)
```

Mit der Funktion `robyn_inputs()` definieren Sie die Datenstruktur:

```r
InputCollect <- robyn_inputs(
  dt_input = data,
  date_var = "date",
  dep_var = "revenue",
  paid_media_spends = c("facebook_spend", "google_search_spend", "display_spend"),
  context_vars = c("competitor_index", "holiday_flag"),
  window_start = "2024-01-01",
  window_end = "2025-12-31",
  adstock = "geometric"  # oder "weibull"
)
```

**Hyperparameter-Ranges:**
Robyn durchsucht für jeden Kanal Adstock-Theta und Sättigungs-Alpha/K-Werte innerhalb Ihrer angegebenen Range. Standard-Ranges sind meist ausreichend, aber mit Domain-Knowledge können Sie Constraints setzen:

```r
hyperparameters <- list(
  facebook_spend_alphas = c(0.5, 3),   # Sättigungsneigung
  facebook_spend_gammas = c(0.3, 1),   # Sättigungs-Inflection
  facebook_spend_thetas = c(0, 0.5)    # Adstock-Decay (geometrisch)
)
```

Modell ausführen:

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,     # Genetik-Algorithmus-Iterationen
  trials = 5,            # Wie viele Random Seeds
  cores = 4
)
```

Dies dauert 10–30 Minuten (je nach Datengröße). Danach zeigt es Ihnen ein Pareto-optimales Modellset — Tradeoff zwischen NRMSE (Fit-Qualität) und DECOMP.RSSD (Smoothness der Kanalbeitrag-Verteilung).

**Modellauswahl:** Robyn schlägt 10–20 Pareto-Modelle vor. Das niedrigste NRMSE zu wählen ist nicht immer richtig — einige Modelle overfittern möglicherweise. Mit der Funktion `robyn_outputs()` und dem Argument `robyn_clusters` können Sie Modelle gruppieren und das stabilste Cluster-Zentrum wählen.

## Holdout-Validierung: Modellzuverlässigkeit messen

Eines der kritischsten Robyn-Features ist die integrierte Holdout-Validierung. Sie halten während des Trainings die letzten N Wochen zurück, lassen das Modell dann für diesen Zeitraum vorhersagen und vergleichen mit den tatsächlichen Werten.

```r
# Letzte 8 Wochen zurückhalten
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  cores = 4,
  calibration_input = NULL,
  holdout_periods = 8  # Letzte 8 Wochen als Testsatz
)
```

Holdout-Ergebnisse sind in `OutputModels$resultHypParam`:

| Modell-ID | Train NRMSE | Holdout MAPE | Holdout NRMSE |
|---|---|---|---|
| 1_123_4 | 0,08 | 12,3% | 0,14 |
| 2_456_1 | 0,07 | 18,5% | 0,21 |

**Holdout MAPE < 15%** wird normalerweise als produktionsreif betrachtet. > 20% deutet darauf hin, dass die zukünftige Vorhersagekraft schwach ist — entweder Datenqualitätsprobleme oder zu breite Hyperparameter-Ranges.

**Praktische Falle:** Wenn die Holdout-Periode einen großen Ausreißer-Event enthält (Plattform-Ausfall, virale Kampagne), kann das Modell das nicht vorhersagen und MAPE explodiert. Verschieben Sie die Holdout-Periode und testen Sie erneut, oder markieren Sie diese Woche als Anomalie.

Ein Nebeneffekt der Holdout-Validierung: Sie können mit Incrementality-Test-Ergebnissen cross-checken. Wenn MMM für Facebook 30% ROAS zeigt, aber ein früherer Geo-Split-Test nur 15% fand, ordnet MMM wahrscheinlich eine korrelierende Makroeffekt (Saisonalität, Organic-Trend) Facebook zu. Um solche Inkonsistenzen zu erkennen, binden wir MMM-Output in unser Experiment-Dashboard innerhalb unseres [CDP- & Retention-Engineering-Prozesses](https://www.roibase.com.tr/de/retention-engineering-cdp) ein.

## Budget-Optimierung und Szenario-Planung

Nach dem Robyn-Modell haben Sie zwei Hauptanwendungsfälle: **Budget-Reallokation** (optimale Kanalverteilung) und **What-If-Szenarios** (Was passiert bei +20% Budget).

**Budget Allocator:**

```r
AllocatorCollect <- robyn_allocator(
  InputCollect = InputCollect,
  OutputCollect = OutputModels,
  select_model = "1_123_4",  # Gewähltes Pareto-Modell
  scenario = "max_response",  # oder "target_efficiency"
  channel_constr_low = 0.7,   # Jeder Kanal min. 70% aktuelles Budget
  channel_constr_up = 1.5     # Max. 150%
)
```

Die Ausgabe zeigt empfohlene neue Ausgaben und erwartete inkrementelle Umsätze für jeden Kanal:

| Kanal | Aktuell | Empfohlen | Delta | Inkrementelle Revenue |
|---|---|---|---|---|
| Facebook | 5K€ | 4,2K€ | -16% | -800