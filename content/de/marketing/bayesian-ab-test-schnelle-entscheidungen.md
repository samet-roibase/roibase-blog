---
title: "Bayesian A/B-Test für schnellere Entscheidungen"
description: "Jenseits von p<0,05: Bayesian-Ansatz mit sequenziellem Sampling, frühem Abbruch und Unsicherheitsmessung. Geschwindigkeitsvorteil im Performance Marketing."
publishedAt: 2026-08-13
modifiedAt: 2026-08-13
category: marketing
i18nKey: marketing-002-2026-08
tags: [bayesian-testing, ab-test, conversion-optimization, frequentist-statistics, sequential-sampling]
readingTime: 9
author: Roibase
---

Im Performance Marketing werden A/B-Tests immer noch nach frequentistischer Methodik aus den 2010er Jahren durchgeführt: feste Stichprobengröße, p<0,05-Schwelle, Warten auf „statistische Signifikanz". Du testest drei Creative-Variationen in Meta Ads, eine verliert deutlich, aber „die Stichprobengröße reicht nicht" — zwei weitere Wochen verbranntes Budget. Der Bayesian A/B-Test durchbricht diesen Zyklus: er gewährt dir das Recht zum frühen Abbruch, misst Unsicherheit kontinuierlich und sagt „Gewinnwahrscheinlichkeit 94 %". Google Optimize wurde abgeschafft; wenn du deinen Test-Stack selbst aufbaust, gibt dir Bayesian-Mathematik echten Geschwindigkeitsvorteil.

## Die starren Spielregeln frequentistischer Tests

Der klassische A/B-Test funktioniert so: Stichprobengröße im Voraus berechnen (Power-Analyse: 80 % Macht, 5 % Alpha, 10 % erwarteter Lift), warten bis diese Größe erreicht ist, p-Wert prüfen, entscheiden. Das Problem: In der Realität liegt der Lift bei 3 %, nicht 10 %; die Stichprobengröße wächst von 2 auf 8 Wochen. In dieser Zeit ermüdet die Creative, die Saisonalität verschiebt sich, CPM steigt um 40 %. Im frequentistischen Ansatz ist frühes Vorabblik verboten — dieses „Peeking" inflationiert den Fehler erster Art. Selbst sequenzielles Testen mit Alpha-Spending-Funktionen (Bonferroni, O'Brien-Fleming) bringt zusätzliche Komplexität ohne echte Flexibilität.

Szenario aus dem E-Commerce: Kontrolle hat 2,1 % Konversionsrate, neuer Checkout-Flow 2,3 %. Nach 1000 Sitzungen: 9,5 % Lift, aber p=0,12. Frequentist sagt: „nicht signifikant, weitermachen". Bei 2000 Sitzungen p=0,08, immer noch nicht. Bei 3500 Sitzungen p=0,047, jetzt signifikant. Aber B läuft bereits 3 Wochen live, die Saison ist vorbei, der Effekt ist verzerrt. Frequentistische Mathematik trifft binäre Entscheidungen: signifikant oder nicht. Ein Konfidenzintervall existiert, wird aber nur als „zur Entscheidung nötige %95-Grenze" genutzt.

## Bayesian: Wahrscheinlichkeitsverteilung statt binäre Entscheidung

Bayesian stellt andere Fragen: „Wie groß ist die Wahrscheinlichkeit, dass Variante B besser als A ist?" Die Antwort ist eine kontinuierlich aktualisierte Posterior-Verteilung. Prior-Glaube (Vorwissen) + Daten = Posterior. Mit jeder neuen Sitzung wird die Posterior neu berechnet. Bei 100 Sitzungen: 72 % Gewinnwahrscheinlichkeit, bei 500: 88 %, bei 1000: 94 %. Es gibt keinen starren Schwellenwert — du entscheidest: Reicht 90 %, oder warte ich auf 95 %?

Die Mathematik: Beta-Binomial-Modell. Prior für Konversionsrate ist Beta(α=1, β=1) (uniform), jede Konversion erhöht α um 1, jeder Nicht-Conversion erhöht β um 1. Posterior ist dann Beta(α + Konversionen, β + Nicht-Konversionen). Für zwei Varianten: zwei Beta-Verteilungen, Monte-Carlo mit 10.000 Samples zieht und zählt, wie oft B > A. Python: `scipy.stats.beta.rvs`. In BigQuery funktioniert es über UDF, aber Sampling läuft in Python schneller.

```python
from scipy.stats import beta

# Variante A: 50 Konversionen, 2000 Impressionen
a_alpha, a_beta = 1 + 50, 1 + (2000 - 50)
# Variante B: 58 Konversionen, 2000 Impressionen
b_alpha, b_beta = 1 + 58, 1 + (2000 - 58)

samples_a = beta.rvs(a_alpha, a_beta, size=10000)
samples_b = beta.rvs(b_alpha, b_beta, size=10000)

prob_b_wins = (samples_b > samples_a).mean()
# Ausgabe: 0.847 → 84,7 % Gewinnwahrscheinlichkeit
```

Dies kommt ins tägliche Dashboard: „Variante B gewinnt mit 84,7 % Wahrscheinlichkeit, erwarteter Lift +15,3 %, 95 % Credible Interval [+2,1 %, +29,8 %]". Gegenüber dem CMO verzichtest du auf das „signifikant/nicht signifikant"-Dilemma und stellst Risiko transparent dar. Wenn 85 % ausreichen, stopp. Sonst weitermachen. Sequenzielle Entscheidung — jeden Tag neubewertbar.

## Sequenzielles Sampling und Abbruchkriterien

Das eigentliche Bayesian-Superpower: Du stoppst den Test, wann du willst. Im frequentistischen Ansatz ist Peeking verboten — jede Betrachtung erhöht Fehler erster Art; im Bayesian-Ansatz wird die Posterior einfach aktualisiert, ohne dass „Fehler erster Art" im klassischen Sinne anfällt (denn wir arbeiten mit Belief-Updates, nicht mit Long-Run-Frequenzen). Abbruchkriterium setzt du selbst: „Stopp, wenn Gewinnwahrscheinlichkeit >95 % oder <5 %". Mit diesem Kriterium sinkt die durchschnittliche Stichprobengröße um 30–50 % (Benchmark von VWO 2024).

Aber Vorsicht: Zu frühes Schauen täuscht trotzdem. Bei nur 50 Sitzungen kann die Posterior dir 98 % Gewinn zeigen — Rauschen. Hier kommt Bayesian Regret-Minimierung ins Spiel: Expected Value of Information (EVOI) berechnen. EVOI = (erwarteter Gewinn) – (Kosten weiteren Testens). Ist EVOI negativ, stopp. Praktisch: Mindest-Sample pro Variante (z. B. 500 Impressionen), dann Bayesian-Stopp-Regel.

Im [Conversion Rate Optimization](https://www.roibase.com.tr/de/cro)-Prozess funktioniert Bayesian-Test bei Meta Ads Creative-Testing so: 3 Creative-Varianten, je 100 $ Tagesbudget. Tag 2: Creative C verliert deutlich (2,1 % CTR vs. A/B's 3,8 %), Bayesian-Posterior sagt zu 97 % „C verliert". Stopp C, Budget zu A/B. Tag 5: A gewinnt mit 91 %, B-Budget zu A. Entscheidung in 7 Tagen; frequentist hätte 14 Tage gebraucht.

## Expected Loss und Risk Management

Gewinnwahrscheinlichkeit ist nicht die ganze Story. B gewinnt zu 60 %, aber Verlust im Negativ-Szenario ist durchschnittlich −8 % Konversionsrate, Gewinn im Positiv-Szenario +3 %. Das Risiko ist asymmetrisch. Hier hilft die Metrik Expected Loss: Der Konversionsrate-Unterschied im Verlust-Szenario. Formel: `E[max(0, A - B)]`. In Python: `numpy.maximum(samples_a - samples_b, 0).mean()`. Wenn Expected Loss <1 % und Gewinnwahrscheinlichkeit >70 %, Umstieg mit gutem Gewissen.

Tabelle: Bayesian-Entscheidungsmatrix

| Gewinnwahrscheinlichkeit | Expected Loss (KR) | Aktion |
|---|---|---|
| 94 % | 0,3 % | Sofort umsteigen |
| 78 % | 1,2 % | Mehr Daten sammeln |
| 51 % | 2,8 % | Stopp, kein Unterschied |

Diese Tabelle läuft im Live-Dashboard. Statt „Sollen wir zu B wechseln?" fragst du: „B gewinnt zu 78 %, Expected Loss 1,2 %, weitere 200 Sitzungen nötig." Klar, messbar, risikomindernd.

## Prior-Wahl und Sensitivitätsanalyse

Bayesian-Mathematik hängt von der Prior-Wahl ab. Uniforme Prior (Beta(1,1)) ist neutral, Daten dominieren. Mit Domain-Wissen kannst du informativ priorisieren: frühere Tests zeigten 2–3 % Konversionsrate, also Beta(20, 980) als Prior (Mean=2 %). Diese Prior stabilisiert die Posterior in den ersten 100 Sitzungen, reduziert Rauschen.

Prior-Empfindlichkeit testen: 3 verschiedene Priors, 3 Posteriors. Wenn Gewinnwahrscheinlichkeit um mehr als 5 % divergiert, ist Datenmenge zu klein. Beispiel: Uniform Prior sagt 82 %, Stark-Informativer 77 %, Diff <5 %, vertrauenswürdig. >10 % Diff = mehr Daten oder Prior kalibrieren.

Code: Prior-Sensitivität

```python
priors = [
    (1, 1),           # uniform
    (10, 490),        # schwach informativer Prior, Mean=2%
    (30, 1470)        # stark informativer Prior, Mean=2%
]

for alpha, beta_prior in priors:
    a_posterior = beta.rvs(alpha + 50, beta_prior + 1950, size=10000)
    b_posterior = beta.rvs(alpha + 58, beta_prior + 1942, size=10000)
    prob = (b_posterior > a_posterior).mean()
    print(f"Prior Beta({alpha},{beta_prior}): P(B>A)={prob:.2f}")
```

Output sollte konsistent sein (±3 %), dann ist Prior-Wahl robust.

## Fazit: Geschwindigkeitsvorteil und organisatorische Anpassung

Bayesian A/B-Test allein genügt nicht — du musst deine Entscheidungskultur anpassen. Weg von „auf Signifikanz warten", hin zu „mit Risiko-Maßstab handeln". CMO bekommt nicht 100 % Gewissheit, sondern 90 % Wahrscheinlichkeit; das ist Kulturwandel. Der Gewinn ist aber greifbar: Durchschnittliche Test-Dauer von 14 auf 7 Tage, Kosten verlorener Varianten −50 %, Creative-Iterations-Tempo 2x. Im Meta Ads-Kontext: mehr Tests, bessere Winner-Creatives, niedrigere CPA. Integriert in deinen DataFlow (BigQuery + dbt + Looker) wird aus manueller Berechnung automatisches Posterior-Update — jeden Morgen frische Entscheidungs-Metriken, ohne manuelle Arbeit.