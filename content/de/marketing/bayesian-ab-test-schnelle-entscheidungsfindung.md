---
title: "Bayesian A/B-Test für schnellere Entscheidungsfindung"
description: "Statt starrer Sample-Size-Regeln der Frequentist-Tests: Sequentielle Tests mit Bayesian-Methoden. Echtzeit-Posterior-Updates, frühere Stoppentscheidungen, optimierte Budgetnutzung."
publishedAt: 2026-06-18
modifiedAt: 2026-06-18
category: marketing
i18nKey: marketing-002-2026-06
tags: [ab-testing, bayesian-statistik, conversion-optimierung, sequentielle-tests, performance-marketing]
readingTime: 9
author: Roibase
---

Der klassische A/B-Test folgt einer starren Sample-Size-Regel: Du wartest, bis N Nutzer erreicht sind, führst einen t-Test durch, kontrollierst den p-Wert. Aber die Marktreaität ist anders: Wenn Variante B täglich deutlich schlechter performt, ist es Ressourcenverschwendung, noch zwei Wochen Traffic zu verbrennen. Der Bayesian-Ansatz löst dieses Problem — während des Tests aktualisierst du täglich die Posterior-Verteilung und kannst sagen: „Variante A gewinnt mit 94 % Wahrscheinlichkeit." Du definierst die Entscheidungsschwelle selbst, statt dich an die Frequentist-Starre (p < 0,05) gebunden zu fühlen.

## Strukturelle Grenzen des Frequentist-Tests

Der traditionelle A/B-Test basiert auf dem Neyman-Pearson-Framework. Du definierst eine Nullhypothese (H₀: kein Unterschied zwischen Varianten), setzt ein Alpha-Niveau fest (meist 0,05), bestimmst den Minimum Detectable Effect (MDE), führst eine Power-Analyse durch (üblicherweise 80 %), berechnest die erforderliche Sample Size und wartest, bis diese erreicht ist. Ein vorzeitiger Blick auf die Daten (Peeking) erhöht den Type-I-Error — daher ist es tabu, den Test vorzeitig zu beenden.

Das Problem: Im digitalen Marketing kostet Traffic täglich Geld. Eine Sample-Size-Berechnung sagt dir vielleicht: 12.000 Nutzer nötig. Bei 800 Besuchern täglich sind das 15 Tage Wartezeit. Aber am 5. Tag sinkt die Conversion Rate von Variante B von 2,1 % auf 1,3 % — du läufst trotzdem weitere 10 Tage weiter. Die Frequentist-Methodologie erlaubt das, weil „frühes Stoppen = Verzerrung". In der Realität ist das Testszenario nicht statisch — das Budget ist endlich, Saisonalität existiert, Konkurrenten handeln. Die starre Sample-Size-Regel bietet keine Flexibilität.

Hinzu kommt: Der p-Wert sagt dir nur „Wie wahrscheinlich ist diese Beobachtung, wenn H₀ wahr ist?" Er sagt nicht, wie wahrscheinlich es ist, dass Variante A wirklich besser ist. Wenn p = 0,03 herauskommt, lehnst du H₀ ab — aber du kannst nicht sagen: „A schlägt B mit 97 % Wahrscheinlichkeit." Der Frequentist-Rahmen bietet dir nur „statistische Signifikanz", nicht die Entscheidungsgrundlage, die du brauchst.

## Die Logik des Bayesian-Ansatzes

Das Bayesian-Framework transformiert vorherige Erkenntnisse in eine Posterior-Verteilung. Prior: „Meine Annahme zur Conversion Rate vor Testbeginn." Mit einlaufenden Daten wird der Prior über den Satz von Bayes aktualisiert. Posterior: „Die wahrscheinliche Verteilung der Conversion Rate basierend auf bisherigen Daten."

Formel:  
**P(θ | Daten) ∝ P(Daten | θ) × P(θ)**

θ = Conversion Rate, Daten = beobachtete Erfolge/Misserfolge. Likelihood (Datenwahrscheinlichkeit) × Prior → Posterior. Die Beta-Verteilung ist ein conjugate Prior, weshalb die Berechnung einfach bleibt: Hat Variante A α Erfolge und β Misserfolge, ist die Posterior = Beta(α+1, β+1).

Täglich aktualisierst du die Posterior-Verteilungen mit neuen Daten. Der kritische Vorteil des sequentiellen Tests liegt hier: Du vergleichst die Posterior-Verteilungen und berechnest via Monte-Carlo-Simulation „Wahrscheinlichkeit, dass Conversion Rate A > Conversion Rate B". Überschreitet diese 95 %, stoppst du. Nicht „N erreichen, dann gucken", sondern „täglich gucken, Schwelle überschritten → stopp".

### Posterior-Berechnung — Beispiel

```python
import numpy as np
from scipy.stats import beta

# Variante A: 120 Conversions, 1200 Impressionen
alpha_A = 120 + 1  # +1 für uniformen Prior
beta_A = (1200 - 120) + 1

# Variante B: 95 Conversions, 1150 Impressionen
alpha_B = 95 + 1
beta_B = (1150 - 95) + 1

# Monte Carlo: 10.000 Samples ziehen
samples_A = beta.rvs(alpha_A, beta_A, size=10000)
samples_B = beta.rvs(alpha_B, beta_B, size=10000)

# Wahrscheinlichkeit A > B
prob_A_wins = (samples_A > samples_B).mean()
print(f"P(A > B) = {prob_A_wins:.3f}")
```

Beispielausgabe: `P(A > B) = 0.983` — Mit 98,3 % Sicherheit gewinnt A. Ein Frequentist-t-Test könnte bei denselben Daten p = 0,06 liefern (nicht signifikant), aber der Bayesian sagt 98 %. Was ist aussagekräftiger für eine Geschäftsentscheidung?

## Sequential Testing und Early Stopping

Der Bayesian-Test ist von Grund auf sequentiell konzipiert. Täglich aktualisierst du die Posterior, kontrollierst die Entscheidungsschwelle. Das Kriterium „Probability to be best" überschreitet 95 % → stopp, deploye den Gewinner. Dieses Early Stopping erzeugt keinen aufgeblähten Type-I-Error wie im Frequentist-Modell, weil die Entscheidungsbasis die Posterior-Wahrscheinlichkeit ist, nicht der p-Wert.

Praktische Implementierung:  
1. Prior definieren (üblicherweise uninformativ: Beta(1,1) — gleichmäßige Verteilung)  
2. Täglich Conversionsdaten sammeln  
3. Posterior berechnen  
4. P(A > B) und P(B > A) berechnen  
5. Wenn einer der Werte 95 % übersteigt → Test stoppen  
6. Wenn nach 14 Tagen 95 % nicht erreicht → als „inconclusive" beenden (unzureichende Sample Size)

Dieser Ansatz ist entscheidend für die [Conversion-Rate-Optimierung](https://www.roibase.com.tr/de/cro). Testet man eine Landing Page und Variante B zeigt in den ersten 3 Tagen 30 % weniger CTA-Klicks, sagt die Bayesian-Posterior mit 96 % „B ist schlecht". Die Frequentist-Sample-Size-Regel hätte 10 weitere Tage verlangt — aber du stoppst am Tag 3, leitest Traffic zu A um. Die Opportunitätskosten sinken dramatisch.

### Sample-Size-Dynamik

Im Bayesian-Modell gibt es keine feste Sample Size, aber man kann „expected sample size" abschätzen. Das hängt davon ab, wie informativ der Prior ist. Kennst du aus historischen Daten, dass die Conversion Rate um 10 % liegt, machst du den Prior informativ (Beta(10,90)) — weniger Daten reichen. Ein uninformativ Prior erfordert längere Laufzeiten, aber immer noch schneller als Frequentist.

Simulationstabelle (Beispiel):

| Wahre Δ | Frequentist N | Bayesian Erwartet N | Bayesian 90. Perzentil N |
|---|---|---|---|
| +10% | 4.800 | 3.200 | 5.100 |
| +20% | 1.200 | 800 | 1.400 |
| +5% | 19.200 | 14.000 | 22.000 |

Bei kleinen Effekten dauert Bayesian auch länger, aber nicht so starr wie Frequentist. Bei großen Effekten ist 30–40 % schnellere Ergebnisse realistisch.

## Gegenargumente und Tradeoffs

**1. Prior-Wahl ist subjektiv:** Stimmt, du bringst Vorwissen ein. Mit einem uninformativ Prior (Beta(1,1)) minimierst du dieses Problem. Mit viel Datenmaterial wird der Prior ohnehin irrelevant — die Likelihood dominiert. Der Frequentist-Ansatz wirkt „objektiv", aber Alpha-, Power- und MDE-Festlegungen sind ebenfalls subjektive Entscheidungen.

**2. Rechenkomplexität:** Bayesian erfordert täglich Posterior-Updates und Monte-Carlo-Sampling. Ein Frequentist-t-Test ist eine einmalige Berechnung. Moderne Tools (PyMC, Stan, Google Optimize mit Bayesian-Modus) automatisieren das. 10.000 Samples zu ziehen kostet Millisekunden — kein großes Problem.

**3. Regulatorische Compliance:** In Bereichen wie Pharmazie, wo FDA-Zulassung nötig ist, ist der Frequentist-Ansatz Standard. Im digitalen Marketing gibt es solche Auflagen nicht. A/B-Testing-Plattformen (Optimizely, VWO, AB Tasty) bieten Bayesian-Optionen an.

**4. Verwechslung mit Multi-Armed Bandits:** Bayesian Tests werden oft mit Bandit-Algorithmen (Thompson Sampling) vermischt. Bandits balancieren Exploration und Exploitation — während des Tests bekommt die beste Variante progressiv mehr Traffic. Bayesian A/B Tests nutzen einen festen Split und verwenden die Posterior für Entscheidungen. Unterschiedliche Use Cases — Bandits für High-Velocity-Kampagnen, Bayesian Tests für längerfristige Product Changes.

## Reales Szenario: Meta Ads Creative-Test

Du testest 3 Creative-Varianten auf Meta Ads (A, B, C). Tagesbudget $500, CPA-Ziel $25. Ein Frequentist-Ansatz verlangt 1.000 Conversions pro Creative (80 % Power, 15 % MDE). Bei 60 täglichen Conversions warten Sie 50 Tage. Am 10. Tag steigt der CPA von Variante C auf $40 — offensichtlich schlecht.

Bayesian-Arbeitsweise:  
- Täglich für jedes Creative: Spend, Conversions sammeln  
- CPA-Posterior berechnen (Gamma-Likelihood für kontinuierliche positive Werte)  
- P(CPA_C > $30) berechnen — ergibt 92 %  
- Am Tag 10: C pausieren, Budget auf A und B umleiten  

Am Tag 20: P(CPA_A < CPA_B) = 96 %. A als Gewinner deployen. Statt 30 Tage nur 20 gebraucht. $5.000 Budget gespart + 10 Tage bessere CPA mit laufender Kampagne.

Diese dynamische Entscheidungsfindung ist post-iOS14 kritisch. Signal Loss hat die Test-Zuverlässigkeit gemindert — Bayesian-Posterior zeigt Unsicherheit explizit. Du kannst sagen: „Daten reichen nicht, Posterior zu breit." Frequentist-p-Werte erzählen das nicht.

---

Der Bayesian A/B-Test überwindet Frequentist-Probleme — starre Sample Size, Peeking-Verbot. Sequential Testing ermöglicht tägliche Entscheidungskraft; sobald Konfidenz ausreicht, kannst du stoppen. Prior-Wahl bringt Subjektivität, aber uninformativ Prior + genug Daten reduziert das Problem. Im Performance Marketing brauchst du Kampagnen-Flexibilität, Budget-Effizienz und Geschwindigkeit — der Bayesian Framework ist der richtige Weg. Baue deine Test-Infrastruktur entsprechend auf: dynamisches Posterior-Update-Pipeline, nicht statische N-Berechnung.