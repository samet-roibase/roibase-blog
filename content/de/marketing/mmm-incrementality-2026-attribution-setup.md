---
title: "MMM + Incrementality: Das Attribution-Setup von 2026"
description: "Robyn, Meta Lift und Geo-Experimente: Welches Tool wann nutzen, Test-Setups und Entscheidungsbaum für die cookielose Marketing-Messung."
publishedAt: 2026-07-11
modifiedAt: 2026-07-11
category: marketing
i18nKey: marketing-004-2026-07
tags: [mmm, incrementality, attribution, robyn, meta-lift]
readingTime: 9
author: Roibase
---

Die Messung im Cookielosen Marketing hat die Bedeutung von „Attribution" neu definiert. 2026 geht es nicht mehr darum, welcher Nutzer welche Anzeige gesehen hat, sondern darum, welcher Kanal tatsächlich zu echtem Umsatzwachstum führt. Marketing Mix Modeling (MMM) und Incrementality Tests sind die Kernwerkzeuge dieses neuen Spiels – doch beide beantworten die gleiche Frage in unterschiedlichen Zeithorizonten und mit unterschiedlichen Sicherheitsstufen. Robyn von Meta, Conversion Lift Tests und geografiebasierte Experimente unterscheiden sich je nach Campaign Timing, Budget Flexibilität und Datenreife. Die richtige Wahl entscheidet über strategische Genauigkeit und operative Geschwindigkeit.

## MMM: Die Vergangenheit lesen, die Zukunft vorhersagen

Marketing Mix Modeling ist eine Regressions-Familie. Es nimmt 2–3 Jahre historischer Ausgaben-, Impressions-, makroökonomischer und Umsatzdaten und isoliert jeden Kanal's Beitrag zum Gesamtumsatz. Open-Source-Frameworks wie Robyn legen Bayesian Optimization obendrauf und kalibrieren die Modellhyperparameter (Adstock, Saturation Curves) automatisch.

Robyn's Output ist eine Serie von „Response Curves": Für jeden Kanal zeigt sie den marginalen ROAS bei zusätzlichen Ausgaben. Beispiel: Wenn Sie Meta um 100.000 TL mehr investieren, erzielen Sie einen ROAS von 3,2; bei Google Search sind es 4,1. Diese Entscheidungen erfordern das historische Fundament von MMM. 2026 verarbeitet Robyn v4.1 automatisch Saisonalität via Prophet-basierte Decomposition und Holiday-Effekte; manuelle Calendar-Event-Dummies sind deprecated.

MMM's Schwäche ist die Latenz: Das Modell braucht 4–6 Wochen Setup, da mindestens 100–120 Wochen Daten (2+ Jahre) erforderlich sind. Haben Sie einen neuen Kanal gestartet (z. B. TikTok), sind die ersten 12 Wochen Daten extrem verrauscht; MMM weist ihm keinen zuverlässigen Koeffizient zu. Hier greift der kurzfristige Incrementality Test ein.

## Meta Conversion Lift: Schnell, eng, teuer

Meta Conversion Lift arbeitet wie ein Randomized Controlled Trial: Die Plattform teilt Nutzer in Test- (sehen Anzeigen) und Control-Gruppen (sehen PSAs) auf und berechnet die Konversionsdifferenz. Sie erhalten Ergebnisse in 2–4 Wochen – real-time Entscheidungen, im Gegensatz zu MMM.

Die Voraussetzung für Lift Tests: Mindestens 200.000 Nutzer Reichweite und Sie „verschwenden" 5–10 % des normalen Kampagnen-Budgets für die Control-Gruppe. Das heißt praktisch 50.000–100.000 TL Impression Waste, weil die Control-Gruppe PSAs sieht, deren Conversions nicht in das Event-Tracking aufgenommen werden. Meta erstattet diesen Betrag nicht – es ist eine Testgebühr.

2026 integrierte Meta Conversion Lift mit Server-Side Events: Events, die über CAPI gesendet werden, fließen direkt in die Lift-Berechnung ein. Auch iOS 17+ Nutzer liefern zuverlässige Ergebnisse, da die Test-/Control-Zuweisung Server-seitig erfolgt. Eine Einschränkung bleibt: Lift misst nur Meta – Cross-Channel Halo-Effekte sind unsichtbar. Wenn Ihre Instagram-Kampagne organische Google Search verstärkt, sieht Lift das nicht.

## Geo Experiments: Halo-Effekte über Kanäle hinweg erfassen

Geografische Incrementality Tests vergleichen Treatment vs. Control auf Stadt-/Regionalebene. Beispiel: Sie erhöhen Meta-Ausgaben in Istanbul und Ankara um 30 %, halten sie in Izmir und Bursa gleich. Nach 4–6 Wochen messen Sie den Delta im Gesamtumsatz – diese Methode erfasst auch Spillover zwischen Kanälen.

Google's GeoX Tool automatisiert dies mittels Synthetic Control Method: Für jede Test-Region wird eine „kontrafaktische" Umsatzkurve konstruiert. Praktisch wird Istanbuls Umsatz anhand einer gewichteten Mischung aus 5–6 demografisch und saisonal ähnlichen Städten geschätzt. Der Unterschied zwischen tatsächlichem und prognostiziertem Umsatz nach Treatment ist die Incrementality.

Geo Tests Vorteil: Sie erfassen alle Online- und Offline-Kanäle. Nachteil: geografische Spillover (Istanbul-Werbung wirkt auch in Kocaeli) und Marktgrößenunterschiede. Best für Brands mit 10–12+ Geo-Clustern; kleinere Operationen haben zu wenig Power.

2026: GeoX ist nativ in Google Cloud BigQuery integriert – Sie laden GA4 + Transaktionsdaten direkt in die Test-Pipeline. Setup dauert 2 Wochen, Test 4–6 Wochen, gesamter Cycle 6–8 Wochen.

## Welches Tool wann

Folgen Sie diesem Entscheidungsbaum:

| Situation | Werkzeug | Begründung |
|---|---|---|
| 2+ Jahre Daten, strategische Budget-Allokation | Robyn (MMM) | Langfrist Response Curves + Saturation Mapping |
| Neues Creative Format (z. B. Reels vs. Feed) | Meta Conversion Lift | Schnell, Format-spezifisch, 2–4 Wochen |
| Cross-Channel Halo-Verdacht (YouTube + Search) | Geo Experiment | Erfasst Spillover zwischen Kanälen |
| Nullstart | Erst Lift, dann MMM | Erste 6 Monate taktische Optimierung via Lift, dann strategische Planung mit MMM |

Für Robyn: Minimum ist Python/R Environment, 120+ Wochen Ausgabe- + Verkaufsdaten, und ein Node mit Prophet Support (2–4 Cores ausreichend). Output kann wöchentlich refreshed werden; Model Rebuild sollte monatlich erfolgen.

Meta Lift: Aktive Kampagne im Business Manager, 200k+ wöchentliche Reichweite, Conversion Events via CAPI. Lift-Approval dauert 3–5 Werktage.

GeoX: 10+ Geo-Cluster, BigQuery Integration, GA4 + Transaction Data. Google startete Beta 2025 Q4; 2026 ist es produktiv.

## Robyn's praktische Fallstricke

Nach der Robyn-Installation stoßen Sie auf Hyperparameter Tuning. Das Framework testet default 100.000 Modellkombinationen – auf einem 8-Core-Rechner dauert das 6–8 Stunden. Weekly läuft das, Compute-Kosten sind tolerabel; tägliche Refreshes brauchen einen Spark-Cluster.

Zweiter Fallstrick: Das Adstock-Fenster. Robyn default nutzt 13 Wochen – eine Woche Ausgaben beeinflussen 13 Wochen den Umsatz. Aber bei Fast-Fashion ist der Produktlebenszyklus 4–6 Wochen; 13 Wochen sind unsinnig. Sie müssen diesen Parameter nach Category anpassen, sonst überschätzt das Modell langzeitige Kanäle wie TV.

Dritter Fallstrick: Saisonalität. Prophet macht automatische Fourier-Decomposition, aber in der Türkei gibt es Ramadan, Kurban und Black Friday. Diese müssen Sie manuell ins `holidays` Dataframe eintragen. 2026 unterstützt Robyn v4.1 iCal Import – Sie können direkt aus Google Calendar ziehen.

## Welches Vertrauen für welche Entscheidung

MMM's Output ist probabilistisch – jeder Kanal bekommt Mean Coefficient und 95 % Confidence Interval. Beispiel: Metas ROAS ist 3,2 ± 0,7, der wahre Wert liegt mit 95 % Wahrscheinlichkeit zwischen 2,5 und 3,9. Ist dieses Intervall breit (±1,2), ist der Koeffizient instabil – Sie brauchen mehr Daten.

Lift Tests nutzen feste Confidence: Meta setzt 90 % Threshold. Ist das Ergebnis „statistically insignificant", ist entweder die Sample Size zu klein oder es gibt wirklich keinen Lift. Mit 200k Reichweite können Sie 10 % Lift detektieren; unter 5 % brauchen Sie 500k+.

Geo Experiments: Confidence hängt von der Synthetic-Control-Fit-Qualität ab. Pre-Treatment MAPE (Mean Absolute Percentage Error) unter 5 % = zuverlässig; über 10 % = Geo-Cluster überarbeiten.

## Abschlussnote: Decision Tree in den Workflow einbetten

Erfolgreiche [Performance-Marketing](https://www.roibase.com.tr/de/ppc) Teams 2026 nutzen MMM + Incrementality im gleichen Pipeline: Robyn läuft erste Woche des Monats, updated monatlich Budget-Allokation. Lift Tests starten bei neuen Formats, liefern in 2–4 Wochen taktische Pivots. Geo Experiments 2–3x jährlich bei Major Channel Mix Changes (z. B. TikTok +50 % vor dem Launch).

Dieses Setup braucht drei separate Datenflows: (1) Tägliche Transaktions- + Spend-Daten in BigQuery, (2) Robyn konsumiert diese Daten für wöchentliche Refreshs, (3) Lift und GeoX Ergebnisse werden manuell ins BI-Dashboard importiert. Alles in einem Looker Dashboard für CMO: „Meta war letzten Monat ROAS 3,4 (MMM), neues Reels Format +12 % Lift (Lift), TikTok Geo Test fehlgeschlagen (GeoX)."