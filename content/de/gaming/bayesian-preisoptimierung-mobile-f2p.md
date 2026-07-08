---
title: "Bayesian-Preisoptimierung im Mobile F2P"
description: "IAP-Preistests mit Bayesian-Inferenz statt Frequentist A/B: Posterior-Estimation für segmentbasierte Preisleitern und messbare Revenue-Steigerung."
publishedAt: 2026-07-08
modifiedAt: 2026-07-08
category: gaming
i18nKey: gaming-002-2026-07
tags: [bayesian-optimization, iap-pricing, f2p-monetization, mobile-gaming, retention-engineering]
readingTime: 9
author: Roibase
---

Bei mobilen F2P-Spielen werden IAP-Preisent­scheidungen üblicherweise nach dem „Intuition + Konkurrenzanalyse"-Prinzip getroffen. 2026 ist diese Methode nicht mehr ausreichend. Traffic von Apple Search Ads kommt bereits segmentiert an: High-Intent-Keyword, Lookalike, Broad. Jedes Segment hat ein anderes WTP-Profil (Willingness to Pay). Frequentist A/B-Tests werden hier zur Bremse — man wartet 4 Wochen auf 95% Konfidenz und braucht 10.000+ User-Samples. Bayesian Price Optimization ermöglicht dagegen bereits nach 1.000 Conversions eine fundierte Entscheidung via Posterior Distribution.

## Der Engpass von Frequentist A/B bei IAP-Preisgestaltung

Ein klassischer A/B-Test funktioniert so: Man splitet $4,99 vs. $6,99 50/50, wartet 4 Wochen und prüft dann mit Chi-Quadrat den p-Wert. Das Problem: In mobilen Spielen verschiebt sich die Kohorten-Zusammensetzung rapide. Bei 68% D7-Churn entsprechen die verbleibenden Nutzer in Woche 4 nicht mehr dem Profil von Woche 1. Darüber hinaus geht Segment-Information verloren — User von Apple Search Ads und organische User landen im gleichen Bucket.

Ein zweites Problem des Frequentist-Ansatzes ist die Stopping Rule: Entscheidet man zu früh, begeht man einen „Peeking"-Fehler; wartet man zu lange, können Meta-Änderungen (neue Creatives, ASO-Updates) den Test verfälschen. Diesen Rhythmus kann man in mobilen Spielen nicht durchhalten.

Das dritte Problem: Die Annahme binärer Outcomes. Frequentist-Tests beantworten „Welcher Preis gewinnt", nicht aber „Welches Segment bevorzugt welchen Preis". Ohne segment-spezifische Posterior Distributions lässt sich keine Preisleiter aufbauen.

## Bayesian Framework: Prior, Likelihood, Posterior

Der Bayesian-Ansatz basiert auf dieser Formel:

```
P(θ | data) ∝ P(data | θ) × P(θ)
```

- **P(θ):** Prior — WTP-Verteilung aus früheren Spielen/Kategorien
- **P(data | θ):** Likelihood — beobachtete IAP-Conversions
- **P(θ | data):** Posterior — aktuelle Daten aktualisieren den Prior

Für einen IAP-Preistest sei θ = {$4,99, $6,99, $9,99}. Für jeden Preis definiert man eine Beta(α, β)-Distribution als Prior. Beispiel: Für $4,99 sei α=20, β=80 (bisherige Conversion-Rate 20%). Wenn 500 Impressions eintreffen, addiert man die Conversions für jeden Preis zum Beta-Prior:

```python
# $4,99: 500 Impressions, 110 Conversions
alpha_post = 20 + 110
beta_post = 80 + (500 - 110)
# Posterior: Beta(130, 470)
```

Aus dieser Posterior sampelt man via Monte Carlo und berechnet erwarteten Revenue:

```python
samples = np.random.beta(130, 470, size=10000)
revenue_4_99 = samples * 4.99
mean_revenue = revenue_4_99.mean()
```

Der Vorteil des Bayesian-Ansatzes: Nach 500 Conversions kann man entscheiden — ist das Confidence Interval eng genug, stoppt man den Test; ist es noch breit, führt man ihn weiter. Die Stopping Rule ist flexibel, kein Peeking-Fehler.

## Segmentbasierte Preistreppe konstruieren

Im mobilen F2P ist ein Einheitspreis für alle Nutzer suboptimal. [App Store Optimization](https://www.roibase.com.tr/de/aso) bringt Traffic mit unterschiedlichen Intent-Levels: Branded Keywords liefern 8% CVR, generische Keywords nur 1,2%. Man kann für jedes Segment eine separate Posterior Distribution pflegen.

Beispiel einer Segmentierung:

| Segment | Prior (α, β) | Beobachtete Conv. | Posterior (α', β') | Durchschn. WTP |
|---|---|---|---|---|
| Branded KW | (30, 70) | 48/200 | (78, 222) | $7,20 |
| Generic KW | (12, 88) | 18/300 | (30, 370) | $4,50 |
| Organisch | (20, 80) | 35/250 | (55, 295) | $5,80 |

Mit diesen Posteriors konstruiert man eine Preistreppe:

- Branded Segment → $9,99 „Premium"-Pack
- Generic Segment → $4,99 „Starter"-Pack
- Organisch → $6,99 „Standard"-Pack

Die segment-basierte Preisanzeige erfolgt über Server-Side Feature Flags. Das Unity IAP SDK sendet die User-Segment-Information ans Backend, das Backend gibt den Preis gemäß Posterior Distribution zurück. Diese Struktur ist dynamischer als A/B-Tests — die Posterior wird wöchentlich aktualisiert, die Preistreppe optimiert sich selbstständig.

### Thompson Sampling für Real-Time Allocation

Das Bayesian Framework ist nicht statisch — mit Thompson Sampling reguliert man das Verhältnis von Exploration zu Exploitation. Bei jeder IAP-Impression:

1. Aus jeder Preis-Posterior ein Sample ziehen
2. Das Sample mit höchstem erwarteten Revenue dem Nutzer zeigen
3. Das Conversion-Ergebnis zur Posterior addieren

Diese Methode minimiert Regret — also die Kosten von Impressions außerhalb des optimalen Preises. Nach 10.000 Impressions liefert Thompson Sampling 12–18% höheren Revenue-Lift als Baselines (Benchmark: Kings Candy Crush Saga Tests von 2025).

## Kritische Punkte bei Posterior-Estimation

Der heikle Punkt des Bayesian-Ansatzes ist die Prior-Auswahl. Ist der Prior zu schwach (α=1, β=1 uniform), bleibt die Posterior nach 100 Conversions instabil. Ist der Prior zu stark (α=100, β=400), aktualisiert neue Information ihn nur träge.

Die richtige Prior-Quelle: Cohort-Daten aus früheren Spielen oder ähnlichen Kategorien der ersten 30 Tage. Falls keine Daten verfügbar sind, nutzt man Industry-Benchmarks, hält den Prior aber schwach (α=5, β=20).

Zweiter Punkt: Segment-Count. Mit 10 Segmenten muss man 10 separate Posteriors pflegen — das führt zu Data Thinning, Confidence Intervals werden breiter. Die Segment-Zahl sollte zwischen 3 und 5 liegen. Braucht man mehr Granularität, nutzt man Hierarchical Bayesian Models (HBM) — obere Ebene mit Category-Level-Prior, untere Ebene mit Segment-Level-Posterior.

Dritter Punkt: Metrik-Auswahl. IAP-Conversion ist binär, aber Revenue ist kontinuierlich. Beta-Distribution passt zu Conversions, aber für Revenue-Modeling braucht man Gamma- oder Log-Normal-Distribution. Bei Posterior-Revenue-Estimation:

```python
# Für Gamma(shape=α, rate=β) der mittlerer Revenue
mean_revenue = (alpha_post / beta_post) * price
```

## Einfluss auf Churn und LTV

Bayesian Price Optimization optimiert nicht nur die erste IAP-Conversion — segment-basierte Preis-Sensitivität reduziert auch Churn. Ein überteuertes Segment churnt 22% schneller (D30 Retention −8%). Ein unterteuertes Segment hält das LTV-Ceiling niedrig — Nutzer, die $4,99 gewöhnt sind, widersprechen später einem $9,99-Pack.

Eine korrekte Preistreppe senkt Churn, weil jedes Segment seinen Perceived-Value-Threshold entsprechend preierten Offer sieht. Dieser Effekt wird via Cohort-Analyse gemessen:

- Cohort mit Bayesian Preistreppe: D30 Retention 38%, ARPU $12,50
- Cohort mit statischem Preis: D30 Retention 34%, ARPU $11,20

Revenue-Lift: $12,50 − $11,20 = $1,30 pro Nutzer. Bei 100.000 MAU entspricht das $130.000/Monat Differenz.

## Operatives Rollout

Um Bayesian Price Optimization in Production zu nehmen, braucht man diesen Stack:

- **Event Tracking:** IAP-Impression + Conversion (Adjust/AppsFlyer)
- **Bayesian Engine:** Python + PyMC3 oder Stan (Posterior-Update täglich)
- **Feature Flags:** LaunchDarkly oder Custom-Backend (Segment → Preis-Mapping)
- **Monitoring:** Posterior-Convergence-Dashboard (Looker/Metabase)

Die ersten 2 Wochen im Shadow Mode betreiben — das Bayesian Engine schlägt Preise vor, doch Production nutzt noch statische Preise. Wenn die Posterior stabilisiert (Credible Interval < 10%), wechselt man zu Production.

Wichtig: Das Bayesian Modell aktualisiert sich kontinuierlich, aber Preisänderungen erfolgen nicht täglich. Eine wöchentliche Review etablieren — verschiebt sich die Posterior um >15%, passt man den Preis an; sonst wartet man. Inkonsistente Preisangebote erodieren Vertrauen.

---

Bayesian Price Optimization ist im mobilen F2P nicht mehr experimentell — King, Supercell, Playrix nutzen es in Production. Das Framework wirkt anfangs komplex, aber die Posterior-Update ist ein mechanischer Prozess. Mit korrektem Prior + Segment-Strategie sind 10–15% Revenue-Lift in 6–8 Wochen realistisch. Ein Rückfall zu statischen Preisen ist nun suboptimal.