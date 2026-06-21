---
title: "Marketing Mix Modeling: Praktische Implementierung mit Robyn"
description: "Meta's Robyn Framework mit Sättigungskurven, Adstock-Decay und Holdout-Validierung für Attribution-Modelle. SQL, R und Production-Pipeline."
publishedAt: 2026-06-21
modifiedAt: 2026-06-21
category: data
i18nKey: data-005-2026-06
tags: [marketing-mix-modeling, robyn, adstock, attribution, mmm]
readingTime: 9
author: Roibase
---

Cookie-Deprecation und Datenschutzbestimmungen verschieben Attribution von deterministischen Methoden zur probabilistischen Modellierung. Marketing Mix Modeling (MMM) — ein statistisches Werkzeug aus den 1960er Jahren — steht erneut im Mittelpunkt. Metas Open-Source-Framework Robyn bietet die praktische Umsetzung: Mit Bayesian Inference, Sättigungskurven und Adstock-Decay verbindest du wöchentliche Marketingausgaben mit Umsatzzielen in einem Regressionsmodell und bringst es in die Production. Dieser Beitrag zeigt dir, wie du Robyn aufbaust, echte Daten ins Modell integrierst, Hyperparameter durch Grid Search optimierst und mit Holdout-Validierung Overfitting vermeidest.

## Was ist Robyn und wie unterscheidet es sich von klassischer Regression

Robyn ist ein auf R basierendes Open-Source-MMM-Framework. Meta hat es 2020 für sein eigenes Marketing-Team entwickelt und 2021 veröffentlicht. Die Unterschiede zur klassischen linearen Regression:

**Adstock-Transformation**: Marketing-Effekte sind nicht augenblicklich — eine TV-Anzeige erzeugt Branding-Effekt über Wochen. Adstock modelliert den Beitrag früherer Ausgaben zur aktuellen Umsatzgeneration durch exponentiellen Zerfall. Robyn unterstützt geometrisches und Weibull-Adstock. Geometrisch ist einfach: `adstock_t = spend_t + θ × adstock_(t-1)`, wobei θ der Decay-Parameter ist. Weibull ist flexibler — du kannst verzögerte Peak-Effekte positionieren.

**Sättigungskurve (Diminishing Returns)**: Die Beziehung zwischen Ausgaben und Umsatz ist nicht linear. Die ersten 100.000 € könnten 80 % ROI bringen, die nächsten 100.000 € nur 40 %. Robyn nutzt Hill- und S-Kurven-Sättigungsfunktionen. Die Hill-Gleichung lautet: `y = V_max × x^n / (K^n + x^n)`, wobei K der Halbmaximum-Punkt und n die Steigung ist. Diese Nichtlinearität ist kritisch für Channel-basierte Budget-Optimierung.

**Hyperparameter-Tuning**: Adstock-Decay, Sättigungs-K- und n-Werte sind unbekannt — du findest sie durch Grid Search. Robyn nutzt genetische Algorithmen (NSGAII), um Tausende von Modell-Kombinationen zu testen und dir die beste Pareto-Trade-off auszuwählen.

## Datenvorbereitung: SQL zu wöchentlicher Granularität

Robyn arbeitet mit wöchentlicher Granularität. Du aggregierst aus täglichen Transaction-Logs wöchentlich Media Spend und Revenue. Beispiel BigQuery-Abfrage:

```sql
WITH weekly_revenue AS (
  SELECT
    DATE_TRUNC(order_date, WEEK) AS week_start,
    SUM(revenue) AS revenue
  FROM `project.dataset.orders`
  WHERE order_date >= '2024-01-01'
  GROUP BY 1
),
weekly_spend AS (
  SELECT
    DATE_TRUNC(date, WEEK) AS week_start,
    channel,
    SUM(cost) AS spend
  FROM `project.dataset.marketing_costs`
  WHERE date >= '2024-01-01'
  GROUP BY 1, 2
)
SELECT
  r.week_start,
  r.revenue,
  COALESCE(s_google.spend, 0) AS google_search_spend,
  COALESCE(s_meta.spend, 0) AS meta_paid_social_spend,
  COALESCE(s_tv.spend, 0) AS tv_spend
FROM weekly_revenue r
LEFT JOIN weekly_spend s_google
  ON r.week_start = s_google.week_start AND s_google.channel = 'google_search'
LEFT JOIN weekly_spend s_meta
  ON r.week_start = s_meta.week_start AND s_meta.channel = 'meta'
LEFT JOIN weekly_spend s_tv
  ON r.week_start = s_tv.week_start AND s_tv.channel = 'tv'
ORDER BY 1;
```

Diese Abfrage erzeugt pro Zeile 1 Woche, 1 Umsatz und N Channel-Spend-Spalten. Du kannst Robyn die CSV-Datei übergeben, aber in Production ist das Ziehen direkt von BigQuery nach R sauberer. Mit dem `bigrquery` Paket:

```r
library(bigrquery)
library(Robyn)

bq_auth()
df_input <- bq_project_query(
  "project-id",
  "SELECT week_start, revenue, google_search_spend, meta_paid_social_spend, tv_spend FROM `project.dataset.mmm_input`"
) %>% bq_table_download()
```

Minimale Datenanforderung: 104 Wochen (2 Jahre). Weniger Daten führt zu Overfitting. Robyn's Bayesian Priors funktionieren mit 52 Wochen, aber 104+ Wochen erfassen Saisonalität besser.

## Modell-Setup: robyn_inputs und Hyperparameter-Grid

Robyn erstellt mit `robyn_inputs()` ein Config-Objekt:

```r
InputCollect <- robyn_inputs(
  dt_input = df_input,
  date_var = "week_start",
  dep_var = "revenue",
  dep_var_type = "revenue",
  paid_media_spends = c("google_search_spend", "meta_paid_social_spend", "tv_spend"),
  paid_media_vars = c("google_search_spend", "meta_paid_social_spend", "tv_spend"),
  context_vars = c("competitor_index", "seasonality"),
  window_start = "2024-01-01",
  window_end = "2026-06-14",
  adstock = "geometric",
  hyperparameters = list(
    google_search_spend_alphas = c(0.5, 3),
    google_search_spend_gammas = c(0.3, 1),
    google_search_spend_thetas = c(0, 0.3),
    meta_paid_social_spend_alphas = c(0.5, 3),
    meta_paid_social_spend_gammas = c(0.3, 1),
    meta_paid_social_spend_thetas = c(0, 0.5),
    tv_spend_alphas = c(0.5, 3),
    tv_spend_gammas = c(0.3, 1),
    tv_spend_thetas = c(0.1, 0.7)
  )
)
```

**Hyperparameter-Erklärungen:**

- **alpha**: Slope-Parameter der Hill-Sättigungsfunktion (n). Höheres Alpha = spätere Sättigung.
- **gamma**: K-Parameter der Hill-Funktion — Halbmaximum-Punkt. Niedriges Gamma = frühe Sättigung.
- **theta**: Geometric Adstock Decay. 0 = Effekt endet sofort, 0.7 = 70 % werden in die nächste Woche getragen.

Du definierst Min-Max-Bereiche pro Channel. Robyn führt Grid Search in diesen Bereichen durch. Für TV ist die obere Theta-Grenze 0.7 — der Awareness-Effekt wirkt lange nach. Für Paid Search ist sie 0.3 — Conversions sind kurzfristig.

## Modell-Lauf: robyn_run und Pareto-Optimierung

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  cores = 8,
  iterations = 2000,
  trials = 5,
  outputs = FALSE
)
```

`robyn_run()` testet über 2000 Iterationen Hyperparameter-Kombinationen mit genetischen Algorithmen. In jeder Iteration werden NRMSE (normalized root mean squared error) und DECOMP.RSSD (decomposition residual sum of squares difference) minimiert. Aus der Pareto-Frontier werden 5 Modelle ausgewählt — ein Trade-off zwischen Fit-Qualität und Business-Logik (z.B. TV-ROI sollte nicht höher als Search-ROI sein).

Das Output-Objekt enthält die Tabelle `df_allpareto` — jedes Modell mit Channel-Level-ROI, ROAS und CPA. Zeilenzahl = iterations × trials. Die wichtigsten Spalten:

| Spalte | Bedeutung |
|--------|-----------|
| `solID` | Modell-ID |
| `nrmse` | Normalized RMSE — niedrig = besserer Fit |
| `decomp.rssd` | Decomposition RSSD — niedrig = stabile Channel-Beiträge |
| `mape` | Mean absolute percentage error |
| `rsq_train` | Training R² |
| `google_search_spend_roi` | Google Search ROI (Revenue/Spend) |
| `meta_paid_social_spend_roi` | Meta ROI |
| `tv_spend_roi` | TV ROI |

Du wählst das beste Modell anhand von NRMSE + DECOMP.RSSD + Business-Logik. Robyn bietet ein Shiny-Dashboard, aber in Production ist programmatische Auswahl kontrollierter:

```r
best_model_id <- OutputModels$allPareto %>%
  filter(nrmse < 0.1, decomp.rssd < 0.05) %>%
  arrange(nrmse) %>%
  slice(1) %>%
  pull(solID)
```

## Holdout-Validierung: Overfitting verhindern

Ein Modell, das auf Training-Daten fit ist, generalisiert möglicherweise nicht auf unsichtbare Daten. Bei Robyn nutzt du Holdout-Validierung: Die letzten 8–12 Wochen bleiben außerhalb des Trainings als Test-Set. Das Modell wird auf Training-Daten fit, macht Vorhersagen auf Test-Daten. Wenn MAPE (mean absolute percentage error) im Test unter 15 % liegt, kann das Modell in Production gehen.

```r
InputCollect_train <- robyn_inputs(
  dt_input = df_input,
  date_var = "week_start",
  dep_var = "revenue",
  window_start = "2024-01-01",
  window_end = "2026-04-12",  # Letzte 10 Wochen ausgespart
  # ... andere Parameter identisch
)

OutputModels_train <- robyn_run(InputCollect_train, iterations = 2000)

# Vorhersage auf Holdout-Set
df_test <- df_input %>% filter(week_start > "2026-04-12")
predictions <- predict(OutputModels_train, newdata = df_test)
mape_test <- mean(abs((df_test$revenue - predictions) / df_test$revenue)) * 100
```

Wenn MAPE > 20 %, ist das Modell überangepasst. Du musst Hyperparameter-Bereiche verengen oder Context-Variablen hinzufügen (z.B. Wirtschaftsindex, Wetter). Robyns Bayesian Regularisierung (Ridge Penalty) reduziert Overfitting, aber Holdout-Validierung ist die finale Sicherheit.

## Adstock-Decay und Sättigungskurven visualisieren

Robyn plottet mit `robyn_outputs()` Adstock- und Sättigungskurven. In Production kannst du diese als PNG exportieren und in dein BI-Dashboard einbetten:

```r
robyn_outputs(
  InputCollect = InputCollect,
  OutputModels = OutputModels,
  select_model = best_model_id,
  export = TRUE,
  export_location = "/data/mmm_output/"
)
```

Exportierte Dateien:

- `saturate_curves.png` — Für jeden Channel: Spend vs. Response-Kurve. X-Achse = Ausgaben, Y-Achse = predicted Revenue. Kurve flacht am Sättigungspunkt ab.
- `adstock_curves.png` — Decay-Profil. X-Achse = Wochen, Y-Achse = Adstock-Multiplikator. TV zeigt 6–8 Wochen Decay.
- `waterfall.png` — Revenue-Dekomposition: Basis + Saisonalität + Channel-Beiträge.

Mit diesen Visualisierungen kannst du dem CMO sagen: "TV-Budget um 30 % erhöhen" — oder besser: "Wenn du TV um 30 % erhöhst und Search um 20 % reduzierst, steigt der Gesamt-ROI um 12 %."

## Production-Pipeline: dbt + Robyn + Looker Studio

MMM ist kein einmaliger Report — es braucht wöchentliche Aktualisierung. Mit Roibases Ansatz zur [First-Party Daten & Messung Architektur](https://www.roibase.com.tr/de/firstparty) sieht die Pipeline so aus:

1. **dbt**: Rohe Events in BigQuery werden in die `mmm_input`-Tabelle transformiert (SQL oben). Jeden Montag 00:00 Uhr: dbt Cloud scheduled run.
2. **Robyn R-Skript**: Läuft in einem Cloud Run Container. Zieht `mmm_input` mit `bigrquery`, ruft `robyn_run()` auf, schreibt Output in BigQuery (`mmm_output`-Tabelle: `week_start`, `channel`, `roi`, `predicted_revenue`).
3. **Looker Studio**: Speist sich aus `mmm_output` — Channel-ROI-Trends, Sättigungskurven und Budget-Recommendation-Dashboard.

Den Container packst du mit Dockerfile:

```dockerfile
FROM rocker/tidyverse:4.2.0
RUN R -e "install.packages('Robyn', repos='https://cloud.r-project.org')"
RUN R -e "install.packages('bigrquery')"
COPY run_mmm.R /app/run_mmm.R
CMD ["Rscript", "/app/run_mmm.R"]
```

Cloud Scheduler triggert jeden Montag 06:00 Uhr. Robyn mit 2000 Iterationen dauert ~20 Minuten (8-Core-Maschine).

## Budget-Reallocation: Entscheidungen aus der Pareto-Frontier

Robyns stärkstes Ergebnis ist der Budget Optimizer. Die Funktion `robyn_allocator()` verteilt dein Budget zwischen Channels neu, um den Umsatz zu maximieren:

```r