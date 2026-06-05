---
title: "Marketing Mix Modeling: Praktische Einrichtung mit Robyn"
description: "Metas Open-Source-MMM-Framework Robyn mit Sättigung, Adstock und Holdout-Validierung mit praktischem R-Code und korrekter Datenstruktur einrichten."
publishedAt: 2026-06-05
modifiedAt: 2026-06-05
category: verianalizi
i18nKey: data-005-2026-06
tags: [marketing-mix-modeling, robyn, adstock, saturation-curve, incrementality]
readingTime: 10
author: Roibase
---

In einer postkontext-Messwelt verliert Attribution jeden Tag etwas mehr Signal. Mit iOS 17.4 und SKAdNetwork kämpft selbst das echte ROAS-Tracking, während Marketingbudget-Eigentümer sich ökonometrischen Modellen zuwenden, um die echte Auswirkung von Kanälen zu messen. Marketing Mix Modeling (MMM), eine statistische Methode aus den 1960ern für Fernsehwerbung, sitzt 2026 neben Server-Side-Messung und First-Party-Data-Lakes wieder im Zentrum. **Robyn**, das Meta 2021 als Open Source veröffentlicht hat, beschleunigt diese regressionsbasierte Methodik durch modernes maschinelles Lernen und Bayesian-Optimierung.

## Warum MMM jetzt kritisch ist

Das Last-Click-Attribution-Modell bricht mit Cookieverlust zusammen, Multi-Touch-Attribution (MTA) wird post-GDPR und ATT aufgrund von Event-Level-Datenanforderungen unbrauchbar. Google Analytics 4s datengesteuerte Attribution basiert auf maschinellem Lernen, funktioniert aber nur innerhalb des Google-Ökosystems. Doch 60 Prozent des Marketingbudgets bleiben außerhalb: Meta, TikTok, programmatisches Display, offline-TV, Sponsorships.

MMM basiert nicht auf User-Level-Tracking, sondern auf wöchentlichen oder täglichen **aggregierten** Daten. Ein Regressionsmodell extrahiert die Beziehung zwischen Kanalausgaben und Umsatz (oder Conversions). Das Modell ruht auf zwei Fundamenten: **Sättigung** (steigende Ausgaben bringen sinkende Grenzrenditen) und **Adstock** (Werbung von heute wirkt in kommende Wochen). Diese Annahmen sind statistisch, spiegeln aber geschäftliche Realität wider. Robyn zielt darauf ab, diese beiden Parameter durch Bayesian-Hyperparameter-Optimierung automatisch zu finden. In Versionen nach 2024 (v3.11+) wurde **Ridge Regression** und **Prophet Time-Series-Dekomposition** hinzugefügt, was die saisonale Genauigkeit des Modells erhöht.

Ein weiteres kritisches Robyn-Merkmal ist **Holdout-Validierung**: Das Modell wird mit 12 Wochen historischer Daten trainiert und prognostiziert die nächsten 4 Wochen, um Out-of-Sample-Fehler zu messen. Dies verhindert Overfitting und zeigt, dass das Modell Kanäle wirklich versteht. Googles Meridian und Facebooks ältere MMM-Lösungen nutzen ähnliche Ansätze, sind aber Closed-Source und teuer. Robyn bietet kostenlosen Zugang zur gleichen Methodik.

## Datenstruktur und Vorbereitung

Um Robyn auszuführen, benötigst du Daten in folgendem Format: Jede Zeile ist eine Zeiteinheit (Tag oder Woche), jede Spalte eine Kanal-Ausgabe oder Conversions-Metrik. Minimum 104 Wochen (2 Jahre) werden empfohlen, da die statistische Signifikanz von Regressionskoeffizienten von der Stichprobengröße abhängt. Mit weniger als 52 Wochen erlebst du Konvergenzprobleme.

```r
# Beispiel-Datenstruktur – aus BigQuery extrahierte wöchentliche Aggregate
df <- data.frame(
  DATE = seq.Date(from = as.Date("2024-01-01"), by = "week", length.out = 104),
  revenue = runif(104, 80000, 150000),
  google_search_spend = runif(104, 5000, 15000),
  meta_spend = runif(104, 8000, 20000),
  tiktok_spend = runif(104, 2000, 8000),
  tv_grp = runif(104, 50, 200),
  organic_sessions = runif(104, 10000, 30000),
  competitor_index = runif(104, 0.8, 1.2)
)
```

**Wichtige Details:**
- `DATE`-Spalte muss Date-Klasse sein, nicht String
- Revenue oder Conversions gehen als Zielvariable in das Modell (abhängige Variable)
- Kanäle (google_search_spend, meta_spend) sind **Paid**-Media-Spalten – Adstock und Sättigung gelten hier
- `organic_sessions` und `competitor_index` sind **organische/Kontroll**-Variablen – keine Transformation, Baseline-Extraktion
- Offline-Kanaldaten wie TV als GRP, Reichweite oder Viewing-Minuten normalisieren

Robyn funktioniert nicht mit manuellen Labels wie `facebook_spend`; du definierst Spaltennamen selbst, musst aber in `InputCollect()` ausdrücklich angeben, welche Spalten Paid und welche organisch sind.

Wenn du keine [First-Party-Datenarchitektur](https://www.roibase.com.tr/de/firstparty) aufgebaut hast, ist das Sammeln dieser Daten schwierig. Server-seitiges GTM, GA4 Raw Export, Meta- und Google Ads APIs, Umsatzdaten aus CRM – alles muss in BigQuery zusammengeführt und zu einem wöchentlichen Rollup aggregiert werden. Mit dbt bauen wir diesen ETL-Pipeline und erzeugen eine einsatzbereite `fact_marketing_weekly`-Tabelle für MMM.

## Sättigung und Adstock-Konfiguration

Robyns Stärke ist, dass es für jeden Kanal **separat** Sättigungskurve und Adstock-Decay-Parameter optimiert. Sättigung wird mit der Hill-Funktion modelliert:

```
effect = spend^alpha / (spend^alpha + half_saturation^alpha)
```

Der Parameter `alpha` bestimmt die Konkavität der Kurve, `half_saturation` ist die Ausgabenhöhe bei halber Wirkung. Intent-basierte Kanäle wie Google Search sättigen früh (niedriges alpha, niedriges half_saturation). Brand-Awareness-Kanäle (TV, YouTube) sättigen spät.

Adstock modelliert die Auswirkung vergangener Ausgaben auf heute. Geometric Adstock ist am verbreitetsten:

```
adstocked_spend[t] = spend[t] + theta * adstocked_spend[t-1]
```

`theta` (zwischen 0 und 1) ist Decay-Geschwindigkeit. Für TV ist theta hoch (0,7–0,9 – Effekte dauern Wochen), für Search niedrig (0,1–0,3 – Effekt endet schnell). Robyn findet diese Parameter durch Nevergrad-Optimierung, aber du musst **Prior-Ranges** vorgeben:

```r
hyperparameters <- list(
  google_search_spend_alphas = c(0.5, 1.5),
  google_search_spend_gammas = c(0.1, 0.4), # adstock decay
  google_search_spend_thetas = c(0, 0.3),   # adstock theta
  meta_spend_alphas = c(0.5, 2.0),
  meta_spend_gammas = c(0.3, 0.8),
  meta_spend_thetas = c(0.2, 0.6),
  tv_grp_alphas = c(1.0, 3.0),
  tv_grp_gammas = c(0.5, 0.9),
  tv_grp_thetas = c(0.6, 0.9)
)
```

Diese Ranges musst du mit Domain-Wissen festlegen. Mit völlig zufälligen Werten divergiert das Modell oder findet unsinnige Koeffizienten (z. B. negative TV-Effekte). Robyns Dokumentation gibt Default-Range-Empfehlungen – nutze diese aber nicht ungetestet auf deinen Daten.

## Modelltraining und Holdout-Validierung

Um Robyn auszuführen, benutzt du die Funktion `robyn_run()`. Innen arbeitet **Nevergrad** mit Bayesian-Optimierung, um die beste Hyperparameter-Kombination zu finden. Ein typischer Run bedeutet 2000 Iterationen × 10 Trials = 20.000 Modellevaluierungen. Auf MacBook M1 mit 8 Cores dauert das etwa 15 Minuten.

```r
library(Robyn)

InputCollect <- robyn_inputs(
  dt_input = df,
  date_var = "DATE",
  dep_var = "revenue",
  dep_var_type = "revenue",
  paid_media_vars = c("google_search_spend", "meta_spend", "tiktok_spend"),
  paid_media_spends = c("google_search_spend", "meta_spend", "tiktok_spend"),
  organic_vars = c("organic_sessions"),
  prophet_vars = c("trend", "season", "holiday"),
  window_start = "2024-01-01",
  window_end = "2025-12-31",
  adstock = "geometric",
  hyperparameters = hyperparameters
)

OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 10,
  outputs = FALSE
)
```

Nach dem Training zeigt das Modell **Pareto-optimale** Lösungen. Robyn optimiert zwei Metriken: NRMSE (normalisierter quadratischer Fehler) und Decomposition RSSD (Quadratsumme residualer Differenzen). Jedes Modell auf der Pareto-Grenze ist ein Trade-off: eines hat guten Fit aber schlechte Decomposition, das andere umgekehrt. Du wählst manuell das vernünftigste.

Für Holdout-Validierung setzt du die letzten 4–8 Wochen beiseite. Robyn macht das automatisch:

```r
robyn_refresh(
  robyn_object = OutputModels,
  dt_input = df_new, # Refresh mit neuen Daten
  refresh_steps = 4,
  refresh_mode = "manual"
)
```

Holdout MAPE (Mean Absolute Percentage Error) unter 10 Prozent bedeutet zuverlässiges Modell. Über 20 Prozent ist gefährlich – Overfitting oder fehlende Variablen.

## Output interpretieren und Budgetoptimierung

Robyns kritischste Output ist die **Channel Contribution**-Tabelle. Sie zeigt jeden Kanals Beitrag zum Umsatz in Prozent und dessen **ROAS**. Aber Vorsicht: Das sind historische ROAS-Werte, nicht **Marginal ROAS**. Marginal ROAS zeigt, welchen zusätzlichen Umsatz die nächste 1000 Euro bringt – berechnet als Ableitung der Sättigungskurve.

Robyns `budget_allocator()`-Funktion verteilt das Budget neu nach Sättigungskurven. Wenn Google Search gesättigt ist, verschiebt es überschüssiges Budget zu Meta oder TikTok. Diese Optimierung findet den Punkt, wo die Grenzrenditen gleich sind (Mikroökonomie 101: MR₁ = MR₂).

```r
AllocatorCollect <- robyn_allocator(
  robyn_object = OutputModels,
  select_model = "1_100_2", # Modell-ID aus Pareto
  scenario = "max_response_expected_spend",
  channel_constr_low = c(0.7, 0.7, 0.5), # Mindestens 70% Google, 70% Meta, 50% TikTok
  channel_constr_up = c(1.5, 2.0, 3.0),  # Maximale Erhöhungslimits
  expected_spend = 100000
)
```

Der Output zeigt, wie du 100.000 Euro Budget verteilst, um optimalen Umsatz zu erzielen. Aber das ist statisch – in der Realität ändern sich Creative Refresh, Competitor-Activity und Seasonality. Darum **muss man MMM monatlich refreshen**.

## Trade-offs und Grenzen

MMM funktioniert, anders als Attribution, auf **Aggregat-Level**. Das heißt, es ist nicht für Personalisierung geeignet. Mit Google Search kann MMM dir nicht zeigen, welches Keyword besser abschneidet – nur, dass Search insgesamt einen Beitrag leistet. Auch ist das Modell anfällig für das Problem **Korrelation ≠ Kausalität**: Wenn Umsätze im Sommer steigen und du gleichzeitig TV-Ausgaben erhöhst, kann das Modell TV zu viel Credit geben.

Um das zu lösen, musst du MMM mit **Incrementality Testing** validieren. Mit Geo-Lift oder Holdout-Tests misst du echte kausale Effekte und vergleichst mit MMM. Robyn kann Incrementality-Ergebnisse als `calibration`-Parameter ins Modell einbeziehen – das wirkt als Bayesian Prior und bringt das Modell der Realität näher.

Eine andere Schwierigkeit: **Neue Kanäle** ins Modell aufnehmen. Hast du gerade Snapchat gestartet mit nur 8 Wochen Daten, kann Robyn Snapchats Sättigungskurve nicht lernen. Dann musst du manuell einen Prior setzen oder die ersten 12 Wochen ausschließen und später hinzufügen.

Zuletzt ist MMM am stärksten, wenn es **Offline und Online verbindet**. Wenn du TV, Außenwerbung und Sponsorships nicht ins Modell nimmst, wird Online überbewertet (Omitted Variable Bias). Robyn ist flexibel: Es akzeptiert Proxy-Variablen wie GRP, Reichweite oder sogar Brand-Search-Volume.

Eine korrekt aufgebaute MMM-Pipeline verwandelt Budgetplanung vom Ratespiel zu evidenzgestützter Ingenieurwissenschaft. Robyn macht diese Transformation als Open Source zugänglich – aber Datenstruktur, Hyperparameter-Tuning und Incrementality-Validierung erfordern menschliches Fachwissen. Teams, die post-Cookie in ökonometrische Regression investieren, werden 2027 ihren Mitbewerbern um 12 Monate voraus sein.