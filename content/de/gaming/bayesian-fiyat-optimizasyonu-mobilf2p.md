---
title: "Mobile F2P'de Bayesian-Preisoptimierung"
description: "IAP-Preislisten mit Posterior-Estimation und Segment-basierter Modellierung optimieren. Datengesteuerte Preisstrategien für Mobile Games."
publishedAt: 2026-07-22
modifiedAt: 2026-07-22
category: gaming
i18nKey: gaming-002-2026-07
tags: [f2p-monetisierung, bayesian-optimierung, iap-preisgestaltung, mobile-gaming, datengesteuerte-preisgestaltung]
readingTime: 9
author: Roibase
---

In mobilen F2P-Spielen basieren Preisgestaltungsentscheidungen häufig auf Vermutungen oder "am Markt üblichen Referenzpreisen". $0,99 Starter-Paket, $4,99 Mid-Tier, $99,99 Whale-Bundle — diese Preisstaffeln sind in den meisten Spielen statisch. Dabei unterscheiden sich Cohort-Struktur, Geo-Mix und Value Perception jedes Spiels. Bayesian Price Optimization modelliert diese Unterschiede über Posterior-Wahrscheinlichkeitsverteilungen und findet für jedes Segment den optimalen Preispunkt. Statt klassischer A/B-Tests kann ein kontinuierlich lernendes System Ihre IAP-Conversion-Rate um 15–40 % verbessern.

## Warum der Bayesian-Ansatz A/B-Tests überlegen ist

Der klassische A/B-Test arbeitet mit einer fixen Hypothese: $4,99 vs. $5,99 werden verglichen, man wartet auf 95 % Konfidenz und wählt den Gewinner. Dieses Vorgehen hat zwei Probleme: Erstens wird der Traffic während des Tests halbiert, und die schlecht performende Variante wird weiterhin Nutzern gezeigt (Opportunitätskosten). Zweitens erfährt man nach Test-Ende nur "A oder B" — über Zwischenwerte oder Segment-spezifische Unterschiede lernt man nichts.

Bayesian Optimization startet mit einer Prior Distribution (z. B. "Preis zwischen $3–$7, gleichmäßig verteilt"), fügt jedes Conversion-Ereignis zur Posterior hinzu und aktualisiert die Wahrscheinlichkeitsverteilung kontinuierlich. Thompson Sampling und ähnliche Algorithmen lenken Traffic dynamisch zur gewinnenden Variante — während des Tests wird die Gesamtrevenue maximiert. Bei einem 10-tägigen Test produziert der Bayesian-Ansatz 8–12 % mehr Revenue, weil schlechte Preispunkte nur minimalen Traffic erhalten.

Zudem liefert das Bayesian-Modell nicht nur "welcher Preis gewinnt", sondern auch "dieser Preis ist mit 87 % Wahrscheinlichkeit optimal". Diese Konfidenz-Intervalle beschleunigen Iterationen: Bei 60 % Konfidenz können Sie einen Preis bereits live nehmen und einen neuen Test starten, da die Posterior bereits ausreichend Information trägt.

## Segment-basierte Prior-Konstruktion bei IAP-Preisstaffeln

In F2P-Spielen sind nicht alle Nutzer gleich. Die korrekte Definition von Spender-Segmenten verstärkt die Prior des Bayesian-Modells. Typische Segmentierung: **Minnows** (Lifetime Spend <$10), **Dolphins** ($10–$100), **Whales** (>$100). Jedes Segment hat unterschiedliche Preiselastizität — Minnows konvertieren selbst bei $0,99, Whales kaufen $99,99-Bundles ohne Preisbeachtung.

Um die Prior-Distribution segment-basiert aufzubauen, benötigen Sie historische Daten. Wenn in Ihrem Minnow-Segment die durchschnittliche IAP-Conversion zwischen $0,99 und $1,99 bei 3,2 % liegt, verwenden Sie $1,49 als Prior-Mean und $0,50 als Sigma (unter Normalverteilungsannahme). Im Whale-Segment bleibt die Conversion zwischen $49,99–$149,99 nahezu flach — hier ist eine Uniform Prior sinnvoller, um die Hypothese "Whales sind preisunempfindlich" im Modell abzubilden.

Der Vorteil einer segment-basierten Prior ist, dass Cross-Segment-Lernen verhindert wird. Der klassische A/B-Test mischt alle Nutzer in einem Pool, und die hohe Conversion von Whales in der niedrigpreisigen Variante kann den optimalen Minnow-Preis überlagern. Das Bayesian-Modell aktualisiert jedes Segment getrennt, sodass $1,49 für Minnows und $79,99 für Whales als segment-optimale Preise entstehen.

### Geo-spezifische Prior-Anpassung

Tier-1-Länder (US, UK, JP) und Emerging Markets (BR, TR, IN) haben massiv unterschiedliche Kaufkraft. In den USA wirkt $4,99 "günstig", während der gleiche Betrag (₺150 in der Türkei) als Mittelklasse-Preis wahrgenommen wird. Um Prior-Distributionen geo-basiert zu normalisieren, nutzen Sie lokale ARPU-Daten. Wenn US-Durchschnitt $0,42 täglich ist und TR $0,18, skalieren Sie die Prior-Mean (0,18/0,42 = 43 %) entsprechend. Das Modell testet dann dieselbe relative Preisstaffel in jeder Geo, mit Absolutwert-Unterschieden in der Prior.

## Posterior Estimation und Thompson Sampling

Das Runtime-Engine des Bayesian-Modells ist die Posterior Estimation. Bei jedem IAP-Impression wird ein Sample aus der aktuellen Posterior Distribution gezogen (z. B. mit `np.random.beta(alpha, beta)` bei Beta Distribution). Der entsprechende Preis wird dem Nutzer gezeigt. Bei Kauf wird alpha += 1, bei Skip beta += 1 — die Posterior wird aktualisiert.

Thompson Sampling nutzt diesen Mechanismus für Traffic-Verteilung. Für jede Variante wird ein Reward-Expectation aus der Posterior gezogen; die höchste Reward gewinnt. In den ersten Tagen erhalten alle Varianten gleichen Traffic (Exploration), später konzentriert sich Traffic auf die Gewinner-Variante (Exploitation). Das Balance wird nicht durch Epsilon, sondern durch Posterior-Varianz gesteuert — Varianten mit niedriger Varianz (hohe Konfidenz) erhalten mehr Traffic.

Für praktische Implementierung können Sie `scipy.stats.beta` oder `pymc3` nutzen. Ein simpler Code-Block:

```python
import numpy as np
from scipy.stats import beta

# Prior: alpha=1, beta=1 (uniform)
alpha_a, beta_a = 1, 1  # Variante A ($4,99)
alpha_b, beta_b = 1, 1  # Variante B ($5,99)

def select_variant():
    sample_a = np.random.beta(alpha_a, beta_a)
    sample_b = np.random.beta(alpha_b, beta_b)
    return "A" if sample_a > sample_b else "B"

def update_posterior(variant, converted):
    global alpha_a, beta_a, alpha_b, beta_b
    if variant == "A":
        if converted:
            alpha_a += 1
        else:
            beta_a += 1
    else:
        if converted:
            alpha_b += 1
        else:
            beta_b += 1
```

Diese simple Loop konvergiert nach 10.000 Impressionen gegen die echte Conversion-Rate mit einer Fehlerquote von ~2 % (unter korrekter Beta-Prior-Annahme). In Production aktualisieren Sie BigQuery + Airflow täglich die Posterior-Parameter und starten neue Cohorts mit der aktualisierten Distribution.

## Multi-Armed Bandit vs. vollständiges Bayesian-Modell

In der Bayesian-Preisoptimierungs-Literatur gibt es zwei Hauptansätze: **Multi-Armed Bandit (MAB)** und **vollständige Bayesian-Regression**. Der MAB-Ansatz ist das oben beschriebene Thompson Sampling — diskrete Preisvarianten (z. B. 5 Preispunkte) werden als Arms definiert, die Posterior wird für jeden Arm separat geführt. Vorteil: Implementierung ist einfach, Runtime ist leicht, Echtzeitentscheidungen sind möglich.

Vollständige Bayesian-Regression modelliert den Preis als kontinuierliche Variable und bindet die Conversion Probability durch logistische Regression oder Gaussian Processes an den Preis. Dieser Ansatz ist flexibler — z. B. kann er nicht-lineare Beziehungen wie "Conversion fällt exponentiell mit Preis" lernen. Nachteil: Model Training erfordert BigQuery + Python Stack, Echtzeitentscheidungen sind nicht möglich (Batch Prediction).

Für F2P-Spiele reicht MAB normalerweise aus, da die Preisstaffel ohnehin diskret ist ($0,99, $2,99, $4,99, $9,99). Vollständige Bayesian-Regression kommt zum Einsatz, wenn Sie Dynamic Pricing machen möchten (unterschiedliche Preise pro Nutzer) — aber das wird von den meisten App-Store-Richtlinien als Diskriminierung unterbunden. Mittelweg: MAB pro Segment, innerhalb jedes Segments vollständige Bayesian-Regression. So finden Sie für das Whale-Segment kontinuierlich den optimalen Punkt zwischen $79,99–$149,99.

## Revenue-Uplift und Cohort-LTV-Effekt

Der echte ROI der Bayesian-Preisoptimierung zeigt sich im Cohort-LTV. Die Conversion-Rate steigt in der ersten Woche um 8 %, aber das D30-LTV dieser Nutzer ist 15–20 % höher. Warum? Der optimale Preispunkt sitzt exakt auf dem Value Perception des Nutzers — weder zu niedrig (Wertabschwächung) noch zu hoch (Reibung). Diese Nutzer kaufen nach dem ersten IAP mit höherer Wahrscheinlichkeit das zweite Paket.

Beispiel: Ein Mid-Core-RPG ändert seinen $4,99-Starter-Pack durch Bayesian-Modell auf $3,49 (Minnow-Segment, US-Geo). Die Conversion steigt in Woche 1 von 22 % auf 28 % (+27 % relativ). D7-Retention bleibt gleich (42 %), aber D30-ARPU steigt von $2,18 auf $2,51 (+15 %). Warum? Der $3,49-Preis senkt die Hürde "Ich kann in dieses Spiel investieren", Second-Purchase-Friction sinkt. Gesamt-Cohort-LTV steigt von $8,90 auf $10,20 (+15 %).

Zur Messung ist Cohort-Analyse erforderlich. In BigQuery tracken Sie `user_id`, `install_date`, `first_iap_price`, `d7_revenue`, `d30_revenue`. Flag den Bayesian-Test-Variant als `experiment_group`, vergleichen Sie LTV-Kurven mit Kontrollgruppe. Significance-Tests in den ersten 7 Tagen sind früh; D30 gibt Konfidenz.

## Missverständnisse und Tradeoffs

Das Missverständnis "Bayesian Optimization gewinnt sofort" ist verbreitet. Realität: Posterior Convergence benötigt mindestens 5.000–10.000 Impressionen pro Segment. Bei niedrig-Traffic-Spielen (DAU <50k) dauert der Test 4–6 Wochen. Während dieser Zeit muss die Data Pipeline (Impression Logging, Conversion Tracking, Posterior Update) stabil laufen — ein einzelner Bug zerstört die gesamte Posterior.

Zweiter Tradeoff: Segment-Granularität. Zu feine Segmente (z. B. "Level 5–10, US, Android, Whale") führen zu Sample-Size-Mangel pro Segment, die Posterior bleibt hochvariabel. Praktische Regel: Pro Segment mindestens 200 IAP-Impressionen täglich. Darunter: Segmente zusammenfassen (z. B. US+UK+CA als eine "Tier-1 EN"-Region).

Drittes Punkt: Psychologischer Effekt von Preisänderungen. Wenn ein Nutzer gestern $4,99 sah und heute $3,99, wirkt das wie "Rabatt" und die Conversion springt — aber das ist nicht nachhaltig. Halten Sie den Preis-Range während des Tests eng (max ±20 %), keine radikalen Shifts wie $4,99 → $1,99.

## Scale und Automatisierung nach dem Test

Bayesian-Preisoptimierung ist kein einmaliger Test, sondern ein kontinuierliches Lern-System. Nach dem Test deployen Sie den Gewinner-Preis live, speichern aber die Posterior-Distribution und nutzen sie als Prior für neue Cohorts. Im Q4 Holiday Season steigt ARPU um 30 % — die Posterior des vorherigen Quarters startet als neue Prior, das Modell konvergiert schnell zum neuen Optimum (Warm Start statt Cold Start).

Automatisierung mit Airflow + BigQuery + Firebase Remote Config: Täglich liest ein Airflow-DAG Posterior-Parameter aus BigQuery, schreibt neue Preis-Varianten in Firebase Remote Config. Das Client-SDK fetcht Remote Config und zeigt IAP-Offers. Conversion-Events loggen in BigQuery, Posterior aktualisiert — Loop geschlossen. Setup dauert 2–3 Wochen, danach läuft's zero-touch.

Letzer Schritt: Wenn Sie Bayesian-Modelle auf mehrere Spiele skalieren, bauen Sie einen zentralen "Pricing Service". Jedes Spiel sendet Metadata (Genre, Geo-Mix, ARPU), der Service empfiehlt Prior-Distribution basierend auf Spiel-Profil. So leiden neue Spiele nicht unter Cold Start; Sie machen Transfer Learning aus ähnlichen Spielen. [ASO-Services](https://www.roibase.com.tr/de/aso) von Roibase kombinieren solche Cross-Game-Learning-Pipelines mit Creative Testing — dasselbe Bayesian Framework funktioniert auch für App-Store-Page-Varianten.

---

Bayesian-Preisoptimierung ist ein Grundpfeiler von Revenue Engineering in F2P-Spielen. Mit korrekter Segment-Prior, kontinuierlicher Posterior-Update und Thompson Sampling erhöhen Sie IAP-Conversion um 15–40 % und steigern Cohort-LTV deutlich sichtbar. Ein lernendes System statt klassischer A/B-Tests schafft Compounding Effects — jede neue Cohort startet optimierter als die letzte. Um zu beginnen: Teilen Sie Ihre aktuelle Preisstaffel in 3–5 Varianten, konstruieren Sie Prior aus historischen Conversion Rates und beobachten Sie die Posterior über die ersten 10.000 Impressionen.