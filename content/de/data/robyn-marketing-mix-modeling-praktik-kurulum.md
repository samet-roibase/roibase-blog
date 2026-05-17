---
title: "Marketing Mix Modeling: Praktische Implementierung mit Robyn"
description: "Implementieren Sie Meta's Open-Source-MMM-Bibliothek Robyn mit Sättigungskurven, Adstock-Decay und Holdout-Validierung auf Ihrem BigQuery-Data-Stack."
publishedAt: 2026-05-17
modifiedAt: 2026-05-17
category: data
i18nKey: data-005-2026-05
tags: [marketing-mix-modeling, robyn, meta, adstock, saturation-curve]
readingTime: 9
author: Roibase
---

Das Attribution-Fenster ist auf 7 Tage geschrumpft, Cookie-Consent-Ablehnungen überschreiten 40%, Multi-Touch-Kanalattribution ist unmöglich geworden. 2026 bleibt Performance-Marketern nur ein zuverlässiger Weg: das aggregierte ökonometrische Modell — Marketing Mix Modeling. Meta's Robyn-Bibliothek, 2021 als Open Source freigegeben, machte diesen Prozess erstmals produktionsreif. Wie interpretiert man Sättigungskurven, was bedeutet Adstock-Decay, in welchen Bandbreiten funktioniert Holdout-Validierung — in diesem Artikel werden wir Robyn auf Ihrem BigQuery-Data-Stack einrichten und diese Fragen beantworten.

## Was Robyn ist — und was nicht

Robyn ist eine R-Bibliothek. Das Facebook Marketing Science Team hat sie als Open Source veröffentlicht. Ihr Zweck: wöchentliche oder tägliche aggregierte Kanalausgaben plus externe Makrovariablen (Feiertage, Saisonalität, Preise) mit einer Sales-Metrik regressieren. Output: ROAS pro Kanal, Sättigungsniveau, Verzögerungseffekt (Adstock), optimale Budgetallokation.

Was sie nicht ist: Sie ist nicht Last-Click-Attribution, sie verfolgt keine Konversionspfade auf Benutzerebene. Sie nutzt keine persönlichen Daten, wartet nicht auf Cookie-Signale. Sie verwendet aggregierte Zeitreihen-Regressionsmodelle — keine Ridge oder Lasso, sondern durchsucht mit Nevergrad-Hyperparameter-Optimierung komplexe nicht-lineare Transformationen.

In typischen MMM-Prozessen werden Daten auf Monatsbasis modelliert — etwa 36 Datenpunkte. Robyn funktioniert auch mit täglicher Granularität — empfohlen werden mindestens 104 Wochen (2 Jahre). Bei weniger als 52 Wochen ist die Varianz hoch, Konfidenzintervalle werden unzuverlässig.

## Sättigungskurve: S-Curve und Hill-Funktion

Im Kern von Robyn stecken zwei Saturation-Transformationen: Adbudg (S-Curve) und Hill. Beide codieren die Annahme abnehmender Grenzerträge. Das heißt: Wenn Sie einen Kanal um weitere 1.000 TL erhöhen, erhalten Sie nicht die gleiche Conversion-Steigerung wie bei den ersten 1.000 TL.

**Hill-Transformationsformel:**
```
y = K * (x^alpha) / (S^alpha + x^alpha)
```
- K: maximale Reaktion (Asymptote)
- S: Halbsättigungspunkt (bei diesem Ausgabenniveau erreicht die Reaktion 50% von K)
- alpha: Steilheit der Kurve (alpha > 1 ergibt S-Kurve, alpha < 1 konkave Kurve)

Robyn optimiert für jeden Kanal alpha- und S-Parameter mit Nevergrad. Es versucht über 10.000 Kombinationen, wählt den besten Fit mit niedrigstem NRMSE (normalisierter Wurzelmittlerer Fehler).

**Praktische Interpretation:**
- Wenn für Google Ads S = 50.000 TL ermittelt wird, bedeutet das: Wöchentliche 50.000 TL Ausgaben erreichen die Hälfte Ihres Reaktionspotenzials.
- Wenn alpha = 2,5, ist die Kurve steil S-förmig — unterhalb von 50.000 TL ist der Ertrag sehr niedrig, darüber steigt er sehr langsam.
- Der Budget Optimizer nutzt diese Kurven um die Frage zu beantworten: „Ist es besser, Google Ads von 50.000 auf 60.000 TL zu erhöhen, oder Facebook von 30.000 auf 40.000?"

In der Realität: Search Budget wird meist konkav (alpha < 1), Display/Video S-förmig (alpha > 1). Search-Nachfrage ist begrenzt, Display-Pool unbegrenzt, aber Aufmerksamkeit ist knapp.

## Adstock Decay: Modellierung verzögerter Effekte

Marketingausgaben wirken auf den Umsatz oft nicht am selben Tag, sondern über Wochen hinweg. TV-Werbung schafft noch 3 Wochen später Brand Recall, Paid Social wirkt in 7 Tagen ab. Adstock modelliert mathematisch diese Verzögerung (Carryover) und den Verfall (Decay).

Robyn bietet zwei Adstock-Transformationen:
1. **Geometric Adstock:** Exponentieller Verfall. Parameter Theta (0–1). Theta = 0,5 bedeutet: Die Auswirkung der Vorwoche beträgt 50% dieser Woche.
2. **Weibull Adstock:** Flexibler — Peak-Verzögerung + Long Tail. Parameter: Shape (k) und Scale (Lambda). Für Kanäle wie TV mit verzögertem Peak-Effekt bevorzugt.

**Geometric Adstock Formel:**
```
adstocked_t = spend_t + theta * adstocked_(t-1)
```

Robyn optimiert für jeden Kanal theta (oder k, Lambda) per Grid Search. Der Nutzer definiert in hyperparameters.json eine Range für theta (z.B. 0–0,7), das Modell findet das beste Theta.

**Was praktisch zu tun ist:**

```r
hyperparameters <- list(
  google_ads_S = c(0.3, 3),      # theta Range für Adstock
  google_ads_alphas = c(0.5, 3), # alpha Range für Sättigung
  facebook_ads_S = c(0.1, 2),
  facebook_ads_alphas = c(1, 5)
)
```

Ergebnis: Google Ads Theta = 0,4, Facebook Theta = 0,2 bedeutet: Google Ads' Effekt ist länger anhaltend. Der Budget Planner berücksichtigt das — ein Viertel Ihres Google Ads-Budgets wirkt noch 2 Wochen später, Facebooks wirkt nach 1 Woche ab.

### Code-Block: Einfache Adstock-Transformation (R)

```r
apply_geometric_adstock <- function(spend, theta) {
  adstocked <- numeric(length(spend))
  adstocked[1] <- spend[1]
  for (t in 2:length(spend)) {
    adstocked[t] <- spend[t] + theta * adstocked[t - 1]
  }
  return(adstocked)
}

# Beispiel: Google Ads Ausgaben
google_spend <- c(10000, 15000, 12000, 8000, 20000)
theta_google <- 0.5
adstocked_google <- apply_geometric_adstock(google_spend, theta_google)
print(adstocked_google)
# [1] 10000.0 20000.0 22000.0 19000.0 29500.0
```

Dieser Code läuft in Robyn auf C++-Ebene optimiert, die Logik ist aber identisch.

## Holdout-Validierung: Modellzuverlässigkeitstest

Robyn riskiert beim Modellfit Overfitting. 10 Kanäle + 5 Makrovariablen + jeweils Saturation und Adstock Parameter → 30+ Variablen. Bei 104 Datenpunkten ist das ein sehr hohes Freiheitsgrad-Verhältnis.

Robyn nutzt Holdout-Validierung: Die letzten N Wochen von Daten werden aus dem Training ausgeschlossen. Das Modell lernt aus bisherigen Daten, macht Vorhersagen für die Holdout-Periode, vergleicht mit den echten Werten, berechnet MAPE (mittlerer absoluter prozentualer Fehler).

**Holdout-Definition in Robyn:**

```r
InputCollect <- robyn_inputs(
  dt_input = df_marketing,
  dep_var = "revenue",
  paid_media_spends = c("google_ads", "facebook_ads", "tiktok_ads"),
  window_start = "2024-01-01",
  window_end = "2026-04-30",
  adstock = "geometric",
  prophet_vars = c("trend", "season", "holiday"),
  prophet_country = "TR"
)

# Holdout: letzte 8 Wochen
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  ts_validation = TRUE,
  ts_holdout = 8  # letzte 8 Wochen als Test-Set
)
```

**Interpretation der Ergebnisse:**
- NRMSE Train < 0,10, NRMSE Holdout < 0,15 → Modell ist zuverlässig.
- NRMSE Train = 0,05, Holdout = 0,30 → Overfitting, Hyperparameter-Range muss enger werden.
- Decomp.RSSD (Response Sum of Squared Differences): Wie viel des geschätzten Revenue erklären die Kanäle? 0,6+ ist gut, 0,8+ exzellent.

Robyn führt gleichzeitig 5 Trials aus (verschiedene Nevergrad-Random-Seeds), jeder Trial 2.000 Iterationen, die besten 10 Modelle werden auf der Pareto-Front angezeigt. Der Nutzer wählt ein Modell basierend auf Business-Constraints (z.B. „Google Ads ROAS darf nicht unter 3 fallen").

## Robyn mit BigQuery: Pipeline-Architektur

Robyn läuft in der R-Umgebung, die Datenquelle kann aber BigQuery sein. Typischer Stack:

1. **BigQuery Data Warehouse:** Tägliche Ausgabentabelle (spend_daily), Konversionstabelle (conversions_daily), Makrovariablen (Feiertage, Wetter, Konkurrenzpreise).
2. **dbt Transformation:** Join + Aggregation. In wöchentliche Zeilen transformieren, kanalweise Ausgabenkolumnen erstellen.
3. **R-Script (Cloud Run oder Vertex AI):** Mit bigrquery-Paket Daten aus BigQuery ziehen, in Robyn speisen, Modellergebnisse zurück nach BigQuery schreiben.
4. **Looker Studio Dashboard:** Modelloutput visualisieren — Kanal-ROAS, optimale Budget-Aufteilung, Sättigungskurven.

**dbt-Modell-Beispiel (marketing_mix_weekly.sql):**

```sql
WITH spend_agg AS (
  SELECT
    DATE_TRUNC(spend_date, WEEK) AS week_start,
    SUM(CASE WHEN channel = 'google_ads' THEN spend ELSE 0 END) AS google_ads_spend,
    SUM(CASE WHEN channel = 'facebook_ads' THEN spend ELSE 0 END) AS facebook_ads_spend,
    SUM(CASE WHEN channel = 'tiktok_ads' THEN spend ELSE 0 END) AS tiktok_ads_spend
  FROM `project.dataset.spend_daily`
  WHERE spend_date BETWEEN '2024-01-01' AND '2026-04-30'
  GROUP BY 1
),
revenue_agg AS (
  SELECT
    DATE_TRUNC(conversion_date, WEEK) AS week_start,
    SUM(revenue) AS total_revenue
  FROM `project.dataset.conversions_daily`
  WHERE conversion_date BETWEEN '2024-01-01' AND '2026-04-30'
  GROUP BY 1
)
SELECT
  s.week_start,
  s.google_ads_spend,
  s.facebook_ads_spend,
  s.tiktok_ads_spend,
  r.total_revenue
FROM spend_agg s
LEFT JOIN revenue_agg r USING (week_start)
ORDER BY week_start
```

Diese Tabelle wird in BigQuery materialisiert, das Robyn R-Script zieht sie mit `bigrquery::bq_table_download()`. Der Modelloutput (wöchentlicher Kanalbeitrag) wird zurück nach BigQuery geschrieben — BI-Tools lesen von dort.

## Budget Optimizer: Pareto-optimale Allokation

Nach dem Modellfit führt Robyn ein zweites Modul aus: den Budget Allocator. Eingaben: Gesamtbudget (z.B. 500.000 TL/Woche), Kanalbudget-Constraints (z.B. Google Ads Minimum 50.000 TL). Ausgabe: Optimale Aufteilung zur ROAS-Maximierung.

Algorithmus: Nimmt die Ableitung der Sättigungskurve jedes Kanals (Grenz-ROAS), verschiebt Ausgaben bis die Grenz-ROAS ausgeglichen ist. Das ist Lagrange-Multiplier-Optimierung.

**Beispiel-Ergebnis-Tabelle:**

| Kanal | Aktuelles Budget | Optimales Budget | Delta | Aktueller ROAS | Optimaler ROAS |
|---|---|---|---|---|---|
| Google Ads | 200.000 TL | 180.000 TL | -20.000 | 4,2 | 4,5 |
| Facebook Ads | 150.000 TL | 200.000 TL | +50.000 | 3,8 | 4,1 |
| TikTok Ads | 100.000 TL | 120.000 TL | +20.000 | 3,5 | 3,9 |
| Display | 50.000 TL | 0 TL | -50.000 | 1,2 | — |

Interpretation: Display liefert selbst weit unter dem Sättigungspunkt nur 1,2 ROAS — sollte gestrichen werden. Google Ads ist bereits über dem Sättigungspunkt, eine Reduktion um 20.000 TL erhöht den ROAS. Facebook Ads ist noch in der flachen Kurvenphase, Budget-Erhöhung ist effizient.

Diese Tabelle wird dem CFO vorgelegt, Robyns SQL-Output wird in Looker visualisiert. Die Entscheidungsfindung wird datengesteuert — „Geben Sie Facebook diesen Monat 50.000 TL mehr" ist nun Modelloutput, nicht Vermutung.

---

Um Robyn zu implementieren, benötigen Sie 2 Jahre wöchentliche granulare Daten, eine R-Umgebung, BigQuery-Verbindung und 4–