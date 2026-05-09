---
title: "Bayesian A/B-Test für schnelle Entscheidungen"
description: "Überwinde die Grenzen von Frequentist-Tests. Sequential Testing, dynamische Sample-Größe und Bayesian A/B-Test ermöglichen Entscheidungen in der Performance-Marketing innerhalb von Tagen statt Wochen."
publishedAt: 2026-05-09
modifiedAt: 2026-05-09
category: marketing
i18nKey: marketing-002-2026-05
tags: [ab-testing, bayesian-statistik, conversion-optimierung, performance-marketing, sequential-testing]
readingTime: 9
author: Roibase
---

Im Performance-Marketing ist Testgeschwindigkeit ein Wettbewerbsvorteil. Bei klassischem Frequentist A/B-Testing wartest du zwei Wochen auf das Confidence Interval, während dein Kampagnen-Budget täglich sinkt. Der Bayesian-Ansatz liefert dir täglich eine aktualisierte Posterior-Verteilung — schon vor Testende kannst du sagen: „Variante B gewinnt mit 73% Wahrscheinlichkeit." Dieser Artikel erklärt die mechanik von Bayesian A/B-Testing, Sequential Decision Rules und dynamische Sample-Size-Berechnung. Du ersetzt die Fixed-Horizon-Zwangslage des Frequentist-Verfahrens durch kontinuierliche Entscheidungsaktualisierung im täglichen Datenstrom.

## Das Fixed-Horizon-Problem des Frequentist-Tests

Das klassische A/B-Testing basiert auf p-Wert und fester Sample-Größe. Du startest mit dem Plan „n=5.000 Visitor benötigt, dauert 14 Tage" und verpflichtest dich, bis zum 14. Tag nicht zu entscheiden. In dieser Zeit sendest du weiterhin Traffic zur schlechteren Variante — auch wenn die Conversion Rate 2 Punkte niedriger ist, musst du bis zum Test-Abschluss warten. Stoppt man früher, infliert sich der Type-I-Error, Multiple Testing Problem entsteht.

In der Frequentist-Logik liefert p < 0,05 statistische Signifikanz, aber in der Praxis gibt es viele „signifikant, aber praktisch wertlos"-Szenarien. Ein Lift von 0,5% kann statistisch signifikant sein (wegen großer Sample-Größe), aber geschäftlich irrelevant. Man muss Confidence Interval und Effect Size getrennt bewerten — der Frequentist-Rahmen zeigt das nicht automatisch.

Eine weitere Einschränkung: Sequential Monitoring ist unmöglich. Du berechnest die Sample-Größe vor dem Test, wartest dann darauf, die Sample zu erreichen. Auch wenn eine Variante offensichtlich gewinnt, musst du die Testplanung einhalten, um p-Value-Gültigkeit zu bewahren. Sonst machst du „Peeking" und ungültigst den p-Wert.

## Bayesian-Test: Aktuelle Posterior-Verteilung

Der Bayesian-Ansatz funktioniert nach Prior-Belief + Daten = Posterior-Logik. Vor dem Test definierst du für jede Variante eine Prior-Verteilung der Conversion Rate (meist uninformativ Beta(1,1) oder informativ aus historischen Daten). Mit jedem Besucher wird die Posterior durch das Bayes-Theorem aktualisiert. Bei Besucher 100 hat die Posterior eine bestimmte Form, bei 200 eine andere — kontinuierliche Aktualisierung.

Die Posterior-Verteilung zeigt genau „die Wahrscheinlichkeitsdichte der wahren Conversion Rate dieser Variante". Beispiel: Beta(25, 75) bedeutet, dass Conversion Rates zwischen 20% und 30% hohe Wahrscheinlichkeitsdichte haben. Vergleichst du die Posterior beider Varianten, kannst du „Wahrscheinlichkeit, dass B besser als A ist" berechnen — diese P(B > A) Formel ist in der Bayesian-Welt natürlich.

Sequential Testing im Bayesian-Stil: Tägliche Posterior-Aktualisierung, stoppe den Test wenn P(B > A) > 0,95. Dieser Schwellenwert ist deine Risikotoleranz — du könntest auch 0,90 oder 0,99 verwenden. Im Frequentist-Test existiert solch ein Mechanismus nicht; die einzige Entscheidungsregel ist Fixed Horizon. Im Bayesian-Ansatz kannst du jederzeit entscheiden, weil die Posterior-Verteilung vollständige Information liefert.

Im Bayesian-Test gibt es keinen p-Wert. Stattdessen Metriken wie Probability of Superiority (P(B > A)), Expected Loss (erwarteter Lift-Verlust wenn du A wählst), Credible Interval (95%-Bereich der Posterior). Diese sind praktisch interpretierbarer — du sagst: „Variante B gewinnt mit 85% Wahrscheinlichkeit und bringt im Falle des Gewinns durchschnittlich 2,3% Lift."

### Code: Posterior-Aktualisierung

```python
import numpy as np
from scipy.stats import beta

# Prior: Beta(1,1) = uniform
prior_alpha, prior_beta = 1, 1

# Eingehende Daten: Variante A, 50 Conversions, 200 Visits
conversions_A = 50
visits_A = 200
failures_A = visits_A - conversions_A

# Posterior: Beta(alpha + conversions, beta + failures)
post_alpha_A = prior_alpha + conversions_A
post_beta_A = prior_beta + failures_A

# Sample aus Posterior-Verteilung ziehen
samples_A = beta.rvs(post_alpha_A, post_beta_A, size=10000)

# Dasselbe für Variante B
conversions_B = 60
visits_B = 200
failures_B = visits_B - conversions_B
post_alpha_B = prior_alpha + conversions_B
post_beta_B = prior_beta + failures_B
samples_B = beta.rvs(post_alpha_B, post_beta_B, size=10000)

# P(B > A) berechnen
prob_B_wins = (samples_B > samples_A).mean()
print(f"P(B > A): {prob_B_wins:.2%}")  # Beispiel: 0.82 = B gewinnt mit 82% Wahrscheinlichkeit
```

## Dynamische Sample-Größe und Early Stopping

Im Bayesian-Test ist die Sample-Größe nicht festgelegt. Du kannst eine Mindestgrenze setzen (z.B. „mindestens 1.000 Visitor", damit Posterior nicht zu breit wird), aber die Obergrenze ist dynamisch. Erreichst du P(B > A) > 0,95, stoppt der Test — das könnte beim 500. oder beim 5.000. Besucher sein.

Expected Loss ist hervorragend für frühe Entscheidungen. Formel: `E[Loss] = E[max(0, CR_winner - CR_chosen)]`. Das heißt: wenn du A wählst, aber B ist besser, wie viel Lift verlierst du im Erwartungswert. Setze einen Loss-Schwellenwert, z.B. „E[Loss] < 0,5%", dann hast du die Garantie „im schlimmsten Fall verliere ich 0,5% Lift" und kannst testen stoppen. Diese Metrik macht risikoaverse Entscheidung leicht.

Beispiel Sequential Stopping Rule:

| Metrik | Schwellenwert | Aktion |
|---|---|---|
| P(B > A) | > 0,95 | B als Winner deklarieren |
| P(A > B) | > 0,95 | A als Winner deklarieren |
| E[Loss] | < 0,005 | Unterlegene Variante schließen |
| Mindest-Visits | < 1.000 | Noch keine Entscheidung |

Mit diesen Regeln sinkt die Test-Dauer durchschnittlich um 30-40% (laut Google Optimize und VWO Bayesian-Motor-Daten). Bei großem Effect Size kannst du in 3 Tagen mit 95% Confidence entscheiden — frequentist brauchte 14 Tage.

Unterschied zu Multi-Armed Bandits: Bayesian A/B-Test führt noch kein Exploration-Exploitation Tradeoff durch, sondern nur Posterior-Aktualisierung und Stopping Rule. Bandit-Algorithmen (z.B. Thompson Sampling) optimieren die Traffic-Verteilung dynamisch (mehr Traffic zur Gewinner-Variante). Bayesian-Test behält feste Split (50/50) bei, stoppt aber schneller. Bandit aggressiver — jeder Impression ändert die Verteilung, Bayesian konservativer — Split fix, Entscheidung schnell.

## Informative Prior und Incrementality Tests

Prior-Wahl ist der kritischste Punkt im Bayesian-Test. Uninformative Prior (Beta(1,1)) ignoriert Vorwissen, Posterior ist rein datengetrieben. Informative Prior kommt aus historischen Test-Daten oder Segment-Baselines. Beispiel: mobile Segmente hatten in 50 vergangenen Tests durchschnittlich 12% Conversion, also Beta(60, 440) Prior (approximiert 12% Mean, aber mit Streuung). Dieser Prior gibt der neuen Test-Posterior einen „vernünftigen Startpunkt".

Vorteil informativ Prior: Sample-Size-Anforderung sinkt, weil Posterior-Update nicht bei Null startet. Nachteil: Falscher Prior erzeugt Bias. Wenn sich das Segment geändert hat oder Saisonalität wirkt, führt alter Prior zu Fehler. Daher: Prior-Sensitivitätsanalyse — teste mit verschiedenen Priors und prüfe ob Ergebnisse ändern.

Im [Conversion Rate Optimierung](https://www.roibase.com.tr/de/cro)-Prozess vereinfacht Bayesian-Test Incrementality-Messung. Incrementality braucht Holdout-Gruppe oder Geo-Split. Vergleichst du mit Bayesian Holdout-Posterior mit Test-Posterior, erhältst du Lift-Distribution. Statt klassischem t-Test berechnest du P(Lift > 0) — interpretierbarer: „neue Kampagne hat 78% Wahrscheinlichkeit für Incrementality, erwarteter Lift 1,2–2,8%".

### Prior-Wahl Vergleich

```python
# Uninformative Prior
prior_uninf = beta(1, 1)

# Informative Prior: historisch 12% conversion, n=500 sample
# Beta mean = alpha / (alpha + beta) → 60/500 = 0.12
prior_inf = beta(60, 440)

# Posterior mit 20 Conversions, 100 Visits
conversions, visits = 20, 100
post_uninf = beta(1 + conversions, 1 + (visits - conversions))
post_inf = beta(60 + conversions, 440 + (visits - conversions))

# Posterior-Mittelwerte
print(f"Uninformative posterior mean: {post_uninf.mean():.2%}")  # ~20%
print(f"Informative posterior mean: {post_inf.mean():.2%}")      # ~13,3%
```

Uninformative Prior sensibel auf kleine Sample, Informative Prior regularisiert durch Vorwissen.

## Tradeoff: Bayesian vs. Frequentist vs. Bandit

Bayesian-Test ist nicht überall optimal. Frequentist-Tests sind in regulierten Umgebungen (besonders Medizin/Finanzen) bevorzugt, weil p-Wert-Standard existiert, Peer-Review darauf beruht. Bayesian Prior-Wahl wirkt subjektiv. Wenn Regulierung p-Wert verlangt und Test-Dauer fix ist (z.B. 30 Tage Pflicht), ist Frequentist sinnvoll.

Bandit-Algorithmen (Thompson Sampling, UCB) optimieren Exploration-Exploitation automatisch, verteilen Traffic dynamisch neu. Bei langen Tests (3+ Wochen) erzielt Bandit bessere Performance als Bayesian, weil unterlegene Varianten weniger Traffic bekommen. Bei kurzen Tests (1-2 Wochen) reicht Bayesian A/B — Bandits Regret-Minimierung macht kurzzeitig keinen Unterschied.

Ist Sample-Größe sehr klein (100 Besucher/Tag), versagen sowohl Bayesian als auch Frequentist. Posterior wird so breit, dass P(B > A) nie 95% erreicht. Dann: Micro-Conversions testen (Click, Add-to-Cart) oder Geo-aggregierte Tests. Bayesian hat bei kleiner Sample keinen Vorteil, nur bessere Interpretierbarkeit.

Bayesian-Test glänzt in Cross-Channel-Test-Orchestrierung. Paid-Creative-Test + Landing-Page-CRO gleichzeitig? Posterior beider Tests kombinieren (Joint Posterior), Lift-Contribution trennen. Frequentist braucht komplexes ANOVA, Bayesian macht es natürlich via Markov Chain Monte Carlo (MCMC).

## Praktische Implementierung: Plattformen und Tooling

Google Optimize (Dienst eingestellt) nutzte Bayesian-Motor. Heute: Open-Source Python `bayesian-testing` oder R `bayesAB`. In Production brauchst du Stack — SQL UDF in BigQuery für Posterior-Berechnung oder dbt-Modell als Posterior-Pipeline.

Beispiel dbt Macro: täglich neue Test-Daten, Macro aktualisiert Posterior alpha/beta, berechnet P(B > A). Bei Schwelle überschritten, Slack-Notification. Automatisches Stopping statt manuales Monitoring. Dashboard zeigt Credible Interval und Expected Loss — Stakeholder sieht „B gewinnt jetzt mit 82%" statt „wann entscheiden wir?".

AB-Testing-Plattformen (VWO, Optimizely) fügen Bayesian-Motor hinzu, aber nicht als Default, sondern parallel zu Frequentist. Prior-Wahl ist dein Parameter, kann nicht automatisiert. Plattformen nehmen uninformative Prior an; willst du informativ, brauchst du Setup. Deshalb: großskaliges Bayesian Testing nutzt In-House-Tooling.

Multi-Variant-Test (A/B/C/D) ist im Bayesian einfacher. Frequentist braucht Multiple-Comparison-Correction (Bonferroni, Holm), Bayesian berechnet jede Variant-Posterior separat — du siehst P(C > A), P(D > B), alle Kombinationen. Winner: höchster Posterior-Mittelwert oder niedrigster Expected Loss.

---

Bayesian A/B-Test beschleunigt Entscheidungen in Performance-Marketing. Die Fixed-Horizon-Zwangslage des Frequentist wird durch Sequential Monitoring ersetzt. Posterior bleibt immer aktuell, P(B > A) und Expected Loss ermöglichen kontrollierte risikobewusste Entscheidungen. Mit informativem Prior bringst du historische Test-Daten in neuen Test, reduzierst Sample-Size-Bedarf. Tradeoff: Prior-Wahl subjektiv, Regulierung verlangt vielleicht Frequentist, sehr kleine Samples b