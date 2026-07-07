---
title: "Bayesian A/B-Test für schnelle Entscheidungsfindung"
description: "Ersetzen Sie starre Sample-Size-Anforderungen frequentistischer Tests durch Bayesian Sequential Testing und beschleunigen Sie Optimierungszyklen mit täglichen Posterior-Updates."
publishedAt: 2026-07-07
modifiedAt: 2026-07-07
category: marketing
i18nKey: marketing-002-2026-07
tags: [ab-testing, bayesian-statistics, conversion-optimization, sequential-testing, data-driven-marketing]
readingTime: 9
author: Roibase
---

Die klassische A/B-Test-Methodologie basiert auf einer vordefinierten Sample-Größe: Sie warten, bis eine vorberechnete Besucherzahl erreicht ist, berechnen dann statistische Signifikanz und treffen eine Entscheidung. Dieser Ansatz funktionierte in den 2010er Jahren, weil Traffic teuer war und Tests Monate dauerten. Im Jahr 2026 arbeitet Performance-Marketing in wöchentlichen Zyklen: Creative Refresh erfolgt alle 14 Tage, Kampagnenstrategien ändern sich monatlich. Eine Landing-Page-Variante 6 Wochen zu testen ist keine Option mehr — es ist ein Verlust. Bayesian A/B-Testing löst dieses Problem durch sequenzielle Entscheidungsfindung: Die Posterior-Verteilung wird täglich aktualisiert, und sobald der Konfidenz-Schwellenwert erreicht ist, beenden Sie den Test und aktivieren den Gewinner.

## Der Sample-Size-Fallstrick frequentistischer Tests

Der klassische frequentistische A/B-Test basiert auf dem p-Wert < 0,05 Kriterium. Um diese Schwelle zu erreichen, führen Sie vorab eine Power-Analyse durch: Bei 5% Baseline-Konversion, 10% angestrebtem relativem Lift und 80% statistischer Power benötigen Sie mindestens 3.100 Nutzer pro Variante. Bei 500 eindeutigen Besuchern pro Tag dauert der Test 12 Tage. Das Problem: Am 5. Tag gewinnt Variante B deutlich, aber es gibt keine statistische Signifikanz — Sie müssen warten. Am 12. Tag ist die Signifikanz da, aber Ihr Wettbewerber hat bereits eine neue Landing Page veröffentlicht, die Botschaft ist veraltet. Frequentistische Tests haben doppelten Schaden: Frühe Entscheidungen führen zu Typ-I-Fehlern (falsch positiv), zu späte Entscheidungen bedeuten verpasste Chancen.

Sequenzielles Testing existiert auch im frequentistischen Framework (Bonferroni-Korrektur, Alpha-Spending-Funktionen), ist aber komplex. Für jede Zwischenanalyse müssen Sie Alpha-Budget einplanen — wenn Sie früh stoppen möchten, wird der kritische Wert strenger. Das Resultat: Der Test verlängert sich oder die Zuverlässigkeit sinkt.

Der Bayesian-Ansatz behebt dieses Dilemma, weil jede Beobachtung neue Information darstellt — die vorherige Posterior wird zur neuen Prior. Die Sample-Größe ist nicht festgelegt, sondern sequenziell. Die Posterior-Verteilung wird täglich aktualisiert, und wenn "Die Wahrscheinlichkeit, dass B besser ist als A, übersteigt 95%", beenden Sie den Test und aktivieren den Gewinner. Frühes Stoppen ist keine Strafe — es ist ein Feature.

## Posterior-Verteilung und sequenzielle Aktualisierung

Im Bayesian-Test beginnen Sie mit einer Prior-Verteilung: Ihre bisherige Überzeugung über die Konversionsrate. Wenn Sie eine E-Commerce-Landing-Page testen, könnte die Baseline 3% Konversion sein, mit einer Standardabweichung von 0,5% (basierend auf historischen Daten). Dies entspricht einer Beta(30, 970) Prior. An Tag 1 erhalten Sie 100 Besucher für Variante B mit 4 Konversionen. Die Posterior aktualisiert sich so:

```
Prior: Beta(α=30, β=970)
Likelihood: 4 Erfolge, 96 Misserfolge
Posterior: Beta(α=30+4, β=970+96) = Beta(34, 1066)
```

Posterior-Mittelwert = 34/(34+1066) = 0,0309 (3,09%). Am nächsten Tag kommen 200 weitere Besucher mit 7 Konversionen. Die gestrige Posterior wird zur heutigen Prior:

```
Prior: Beta(34, 1066)
Likelihood: 7 Erfolge, 193 Misserfolge
Posterior: Beta(41, 1259)
```

Posterior-Mittelwert = 0,0316 (3,16%). Für Variante A kommen über denselben Zeitraum 500 Besucher mit 14 Konversionen. A's Posterior = Beta(44, 1456), Mittelwert = 0,0293. Jetzt vergleichen Sie die beiden Posterior-Verteilungen: P(B > A) wird berechnet — Sie ziehen 10.000 Samples mit Monte-Carlo-Simulation und zählen, wie oft B größer ist. Wenn das Ergebnis 73% ist, sind Sie noch nicht sicher. Am 5. Tag erreicht P(B > A) = 96% — Sie überschreiten Ihren Entscheidungs-Schwellenwert von 95% und beenden den Test.

Im frequentistischen Test ist dies nicht möglich. Bei jedem Zwischenblick besteht Alpharisiko durch mehrfache Vergleiche. Im Bayesian-Ansatz wird die Posterior täglich aktualisiert, aber das Entscheidungskriterium bleibt konstant: Konfidenzniveau. Frühes Stoppen erzeugt keinen Bias, weil die Bayesian-Inferenz auf der Likelihood konditioniert ist — die Notwendigkeit, die Sample-Größe festzulegen, entfällt.

## Praktische Anwendung: Stopping Rule und Threshold-Auswahl

Bayesian A/B-Tests sind einfach zu implementieren, erfordern aber Disziplin bei der Stopping-Regel. Drei Schwellenwerte sollten definiert werden:

**1. Minimale Sample-Größe (Sicherheitsnetz):** Verhindert vorzeitiges Stoppen. Vor 100 Besuchern pro Variante nicht entscheiden — die Posterior-Varianz ist zu groß, das Risiko falsch positiver Ergebnisse ist hoch. Das Google-Optimize-Whitepaper von 2019 empfahl mindestens 250 Konversionen; in der Praxis reichen 50–100 Konversionen (abhängig von Prior-Stärke).

**2. Konfidenz-Schwellenwert:** P(B > A) > 0,95 ist die klassische Wahl. Für aggressive Entscheidungen: 0,90, für konservative Tests: 0,97. Bei hohem finanziellen Impact (Checkout-Änderungen): 0,99.

**3. Praktische Signifikanz (Lift-Schwellenwert):** Ein statistischer Unterschied von 0,5% relativem Lift kann signifikant sein, hat aber keine geschäftliche Auswirkung. Legen Sie einen praktischen Schwellenwert fest wie Lift > 5%. Berechnen Sie nicht nur P(B > A), sondern auch P(B > A × 1,05).

**Code-Beispiel (Python + PyMC):**

```python
import pymc as pm
import numpy as np

# Prior: Beta(30, 970) — 3% Baseline
with pm.Model() as model:
    p_A = pm.Beta("p_A", alpha=30, beta=970)
    p_B = pm.Beta("p_B", alpha=30, beta=970)
    
    # Beobachtete Daten
    obs_A = pm.Binomial("obs_A", n=500, p=p_A, observed=14)
    obs_B = pm.Binomial("obs_B", n=500, p=p_B, observed=18)
    
    trace = pm.sample(5000, return_inferencedata=True)

# Posterior-Vergleich
p_B_samples = trace.posterior["p_B"].values.flatten()
p_A_samples = trace.posterior["p_A"].values.flatten()
prob_B_better = np.mean(p_B_samples > p_A_samples)
prob_lift_5pct = np.mean(p_B_samples > p_A_samples * 1.05)

print(f"P(B > A) = {prob_B_better:.2%}")
print(f"P(B > A*1,05) = {prob_lift_5pct:.2%}")
```

Dieser Code läuft täglich; wenn prob_B_better > 0,95 und prob_lift_5pct > 0,80, endet der Test. Wenn diese Bedingungen am 5. Tag erfüllt sind, während der frequentistische Test 12 Tage braucht, gewinnen Sie 7 Tage.

## Tradeoff: Prior-Auswahl und Sensitivitätsanalyse

Der kritisierte Punkt an Bayesian-Tests ist die subjektive Prior-Auswahl. Bei Verwendung einer schwachen Prior (Beta(1, 1) — uniform) basiert die Posterior vollständig auf den Daten, die Konvergenz ist aber langsam. Mit starker Prior (Beta(300, 9700)) dominiert das Vorwissen die Posterior — der Einfluss neuer Daten sinkt. Balance ist notwendig.

**Prior-Auswahl-Strategie:**

| Szenario | Prior | Grund |
|----------|-------|-------|
| Neues Produkt, keine Daten | Beta(1, 1) | Uniform, Daten sprechen |
| Ähnliche Seite existiert | Beta(α=30, β=970) | Historische 3%-Konversion |
| Aggressiver Launch | Beta(3, 97) | Schwache Prior, schnelle Konvergenz |
| Kritischer Checkout | Beta(300, 9700) | Starke Prior, konservative Aktualisierung |

Um den Prior-Effekt zu testen, führen Sie eine Sensitivitätsanalyse durch: Dieselben Daten mit Beta(1,1), Beta(10,990) und Beta(30,970) verarbeiten. Wenn die Posteriors um mehr als 5% abweichen, dominiert der Prior — verwenden Sie eine schwächere Prior oder sammeln Sie mehr Daten.

Ein weiterer Tradeoff: Bayesian-Tests sind nicht so "publikationsreif" wie frequentistische. Für akademische Paper brauchen Sie p-Werte; für C-Suite-Präsentationen ist ein Posterior-Plot ausreichend. Bei [Konversionsrate-Optimierung](https://www.roibase.com.tr/de/cro) ist Geschwindigkeit kritisch — in wöchentlichen Sprint-Zyklen liefert Bayesian Sequential Testing 40% schneller Ergebnisse (laut VWO 2023 Benchmark: Median 8 Tage statt 5 Tage).

## Test-Geschwindigkeit und geschäftlicher Impact

Der eigentliche Gewinn von Bayesian Sequential Testing ist Velocity. Im Performance-Marketing beträgt Creative Fatigue 10–14 Tage, der Kampagnen-Zyklus 30 Tage. Wenn Sie einen Landing-Page-Test in 12 Tagen abschließen, schaffen Sie 2 Iterationen pro Monat. Mit Bayesian in 5 Tagen sind es 6 Iterationen. Bei angenommenen 5% Lift pro Iteration beträgt die zusammengesetzte Auswirkung am Jahresende mit frequentistischen Tests 12%, mit Bayesian 34% (1,05^12 vs. 1,05^6).

Sequential Testing zeigt sich auch bei Multi-Varianten-Tests (A/B/C/D) als Vorteil. Im frequentistischen Test mit mehrfachen Vergleichen vergrößert die Bonferroni-Korrektur die Sample-Größe um das 3–4-fache. Im Bayesian-Ansatz hat jede Variante eine separate Posterior, paarweise Vergleiche erfolgen ohne Alpha-Spending. Bei 4 Varianten braucht frequentistisch 15 Tage, Bayesian 6 Tage.

Ein letzter Punkt: Frühes Stoppen ist nicht nur bei Gewinner-Tests wichtig, sondern auch bei Verlierer-Tests. Wenn Variante B einen 20%-Konversionsrückgang zeigt, erreichen Sie P(A > B) = 99% am 3. Tag — Sie beenden den Test, Verkehrsverschwendung wird verhindert. Im frequentistischen Fall müssten Sie 12 Tage warten und würden 9 Tage lang Traffic an die schlechtere Seite senden. Bayesian Sequential Testing bietet diesen Downside-Schutz.

Sequenzielles Bayesian A/B-Testing ist kein Luxus mehr — es ist eine Notwendigkeit. Nach Cookie-Deprecation ist Attribution schwierig, Kampagnen-Zyklen sind kurz, Creative Refresh ist schnell. Klassische frequentistische Tests können dieses Tempo nicht halten. Mit Bayesian Posterior-Aktualisierungen wird täglich neue Information gesammelt, und bei Erreichen des Konfidenz-Schwellenwerts wird entschieden. Frühes Stoppen ist kein Bias — es ist ein Feature. Mit Disziplin bei der Prior-Auswahl, Klarheit der Stopping-Regel und praktischem Significance-Filter liefert Bayesian-Testing schnelle und zuverlässige Ergebnisse.