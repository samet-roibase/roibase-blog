---
title: "Bayesian A/B-Test für schnelle Entscheidungen"
description: "Überwinden Sie die Zeitverschwendung von Frequentist-Tests mit Bayesian-Ansätzen. Sequential Testing, Posterior-Wahrscheinlichkeit und dynamische Sample-Größen beschleunigen A/B-Tests um das 3-Fache."
publishedAt: 2026-07-25
modifiedAt: 2026-07-25
category: marketing
i18nKey: marketing-002-2026-07
tags: [ab-testing, bayesian-statistics, conversion-optimization, statistical-inference, growth-engineering]
readingTime: 8
author: Roibase
---

Wenn Sie in Performance-Marketing schneller werden möchten, führen Sie Ihre A/B-Tests möglicherweise mit der falschen Methodik durch. Klassische Frequentist-Tests arbeiten mit fester Sample-Größe und festem Horizont: Sie starten den Test, warten 2–4 Wochen und verändern nichts, bis der p-Wert den Schwellenwert erreicht. In diesem Zeitraum ist die gewinnende Variante oft bereits offensichtlich, aber Sie können keine Entscheidung treffen. Der Bayesian-Ansatz ändert diesen kritischen Punkt: Mit Posterior-Wahrscheinlichkeit können Sie jederzeit eine Entscheidung bewerten, Sequential Testing durchführen und die Sample-Größe dynamisch gestalten. Dass Google Optimize sein Bayesian-Modul eingestellt hat, hat diese Methode nicht beendet – im Gegenteil, es eröffnet Ihnen die Möglichkeit, sie in Ihren eigenen Stack zu integrieren.

## Die Zeitfalle klassischer Frequentist-Tests

Die klassische A/B-Test-Logik funktioniert nach dieser Annahme: Der Test muss so lange laufen, bis der p-Wert unter 0,05 fällt; führen Sie ein Intermediate Peeking (Zwischenprüfung) durch, steigt das Risiko eines False Positive. Dies ist theoretisch korrekt, verursacht aber in der Praxis zwei Probleme. Erstens: Wenn Sie den Test vorzeitig beenden möchten, fehlt es an statistischen Guardrails und Sie riskieren eine falsche Entscheidung. Zweitens: Auch wenn die gewinnende Variante früh erkannt wird, müssen Sie bis zur abgeschlossenen Sample-Größe warten – dieser Zeitraum liegt durchschnittlich zwischen 14 und 21 Tagen.

Hinter diesem Ansatz steht das Neyman-Pearson-Hypothesentestrahmen: Sie treffen eine Entscheidung, die Nullhypothese abzulehnen oder zu akzeptieren, basierend auf einem einzelnen Schwellenwert (normalerweise α=0,05). Das Problem: Dieser Schwellenwert hängt von der Berechnung der festen Sample-Größe ab und erlaubt Ihnen daher nicht, während des Tests dynamische Entscheidungen zu treffen. Wenn beispielsweise Variante B 18 % Konversion zeigt, während die Kontrolle bei 12 % stagniert und dieser Unterschied nach 500 Nutzern bereits offensichtlich ist, sagt das Frequentist-Framework: „Warte noch, du hast die geplanten 2000 Nutzer noch nicht erreicht."

Bei mobilen App-Tests wird dieses Problem noch deutlicher. Eine App mit 5000 täglich aktiven Nutzern (DAU) benötigt zur Erfassung einer 2%-Uplift einen Sample-Umfang von etwa 8000 Nutzern – das bedeutet 2 Wochen. Wenn das Signal für die gewinnende Variante aber bereits am dritten Tag erkannt wird, senden Sie 11 Tage lang Traffic an die unterlegene Variante. Diese Zeit bedeutet entgangene Gewinnmöglichkeiten (Opportunity Cost).

## Der Bayesian-Ansatz: kontinuierliche Aktualisierung mit Posterior-Wahrscheinlichkeit

Die Bayesian-Statistik stellt eine andere Frage: „Wie wahrscheinlich ist es, dass diese Variante besser ist als die Kontrollgruppe?" Die Antwort ist keine p-Wert, sondern eine Posterior-Wahrscheinlichkeitsverteilung. Sie aktualisieren Ihre vorherige Überzeugung (Prior) kontinuierlich bei jedem neuen Datenpunkt (mit jedem neuen Nutzer) und berechnen die Posterior neu. Dies ermöglicht es Ihnen zu sagen: „Variante B hat mit 95%-iger Wahrscheinlichkeit eine höhere Konversionsrate als die Kontrollgruppe" – und dieser Aussage erlaubt Sequential Testing.

Mathematisch arbeitet Bayes-Theorem mit dieser Formel:

```
P(θ|data) = P(data|θ) × P(θ) / P(data)
```

Hierbei ist `θ` die Konversionsrate, `P(θ)` der Prior (Ihre anfängliche Überzeugung), `P(data|θ)` die Wahrscheinlichkeit (Likelihood der beobachteten Daten unter θ), und `P(θ|data)` die Posterior (Ihre aktuelle Überzeugung). Wenn Sie beispielsweise Beta(1,1) – eine uniforme Verteilung – als Prior verwenden, erhöht jede Konversion Ihren `α`-Parameter um +1 und jeder Bounce erhöht Ihren `β`-Parameter um +1. 100 Besucher mit 18 Konversionen = Beta(19, 83). Diese Posterior-Verteilung vergleichen Sie mit der Posterior der Kontrollgruppe, um die „Wahrscheinlichkeit, dass B > A" zu berechnen.

Chris Stucchio's VWO-Artikel von 2015 war einer der ersten Case Studies, der diese Logik in Production brachte: Wenn Sie denselben Test mit Bayesian-Methoden durchführen, erhalten Sie im Durchschnitt 40 % schneller Ergebnisse, da das Frühbeendigungsrisiko unter Kontrolle ist. Das interne Experimentation-Framework von Google begann 2018, Bayesian-Posterioren als Intermediate Metrics zu nutzen (öffentliche Dokumentation existiert nicht, aber wird in Kohavi et al.'s Buch erwähnt).

### Sequential Testing und Stopping Rules

Der größte Vorteil des Bayesian-Ansatzes ist die Möglichkeit, Sequential Testing durchzuführen. Bei Frequentist-Tests erhöht die Zwischenprüfung und p-Wert-Berechnung den Type-I-Fehler (Multiple-Comparison-Problem). Bei Bayesian ist die Posterior-Wahrscheinlichkeit immer eine gültige Metrik, da sie ein kontinuierlich aktualisierter Belief-Status ist. Dies ermöglicht Ihnen, täglich die „Posterior-Wahrscheinlichkeit von B > A" zu überprüfen und den Test zu beenden, wenn sie 95 % überschreitet.

Die Stopping Rule funktioniert wie folgt:

1. Definieren Sie eine Mindest-Sample-Größe (z. B. 200 Nutzer pro Variante – um frühes Rauschen zu filtern)
2. Aktualisieren Sie täglich die Posterioren
3. Wenn `P(Variante_B > Kontrolle) > 0.95`, beenden Sie den Test
4. Wenn Sie nach 14 Tagen nicht 95 % erreichen, markieren Sie den Test als „inconclusive"

Wir nutzen diesen Ansatz in unseren [Conversion-Rate-Optimierungsprozessen](https://www.roibase.com.tr/de/cro): Prior-Definition am Teststart, automatische tägliche Posterior-Aktualisierung, Abstimmung des Stopping-Rule-Schwellenwerts mit dem Engineering-Team. Beispielsweise verwenden wir bei E-Commerce-Checkout-Flow-Tests nicht 95 %, sondern einen 98 %-Schwellenwert, da die Kosten für False Positives hoch sind – Änderungen an der Zahlungsseite beeinflussen direkt das Transaktionsvolumen.

## Dynamische Sample-Größe und Expected-Loss-Berechnung

Bei Frequentist-Tests wird die Sample-Größe vorher durch Power Analysis berechnet: Sie geben die minimal erkennbare Effektgröße (MDE), statistische Power (80 %) und Signifikanzniveau (α=0,05) an und warten auf die resultierende Zahl. Bei Bayesian ist die Sample-Größe dynamisch, da die Posterior-Verteilung Sie früher zu einer Entscheidung führen kann. Aber das bedeutet nicht „stoppe, wann immer du möchtest" – das Konzept der Expected Loss kommt ins Spiel.

Expected Loss ist die erwartete Kosten einer falschen Entscheidung. Angenommen, Ihre Posterior zeigt, dass Variante B mit 92%-iger Wahrscheinlichkeit gewinnt. Aber in 8 % der Fälle ist A besser und Sie wählen B, was zu einem Uplift-Verlust führt. Expected Loss quantifiziert dieses Szenario:

```
E[Loss_B] = ∫ max(0, θ_A - θ_B) × P(θ_A, θ_B | data) dθ
```

In der Praxis erhalten Sie ein Ergebnis wie: „Wenn ich B wähle und mich irre, ist der erwartete Verlust 0,3 Prozentpunkte Konversionsrate." Dieser Wert kann in Währung umgerechnet werden – beispielsweise 10.000 tägliche Sessions, 0,3 % Verlust = 30 fehlende Konversionen = multipliziert mit durchschnittlichem Bestellwert für tägliche Kosten.

Evan Miller's „Bayesian A/B Testing Calculator" automatisiert diese Berechnung: Sie geben Konversionen und Sample-Größe für Kontrolle und Variante ein, erhalten Posterior + Expected Loss + Wahrscheinlichkeit der besten Variante zurück. Dieses Tool reicht nicht für Production Deployment, aber es ist ideal, um das Konzept zu verstehen. In Production verwenden wir Python `pymc` oder R `rstan` Bibliotheken für Posterior-Sampling und berechnen Expected Loss via Monte Carlo.

### Regret-Minimierung Perspektive

Ein Konzept aus der Multi-Armed-Bandit-Literatur: Regret. Bei A/B-Tests ist Regret der Gesamtverlust, weil Sie die optimale Variante nicht wählen. Bayesian Sequential Testing minimiert dies, da es schnell Entscheidungen treffen kann, wenn die gewinnenden Signale früh kommen. Bei Frequentist-Tests wächst Regret linear über die Testdauer (weil Sie weiterhin Traffic an die unterlegene Variante senden), bei Bayesian ist es sublinear – weil Sie früh stoppen.

Regret-Berechnung ist entscheidend bei E-Commerce-Landing-Page-Tests. Beispielsweise haben Sie in einer Black-Friday-Kampagne ein 48-Stunden-Test-Fenster. Ein Frequentist-Plan erfordert 2000-Nutzer-Sample-Größe, und bei täglich 3000 Besuchern können Sie den Test nicht abschließen. Bei Bayesian können Sie schon nach 12 Stunden mit 97%-iger Posterior eine Entscheidung treffen und die verbleibenden 36 Stunden mit 100%-igem Traffic auf die gewinnende Variante starten und Regret auf Null reduzieren.

## Anwendung: Bayesian A/B-Test-Pipeline mit Python

Vom Konzept zur Praxis: Wie Sie Bayesian-Tests in Production integrieren. Das folgende Code-Snippet zieht Test-Daten aus BigQuery, berechnet die Posterior und überprüft die Stopping Rule:

```python
import numpy as np
from scipy.stats import beta

def calculate_posterior(conversions, trials, prior_alpha=1, prior_beta=1):
    """Posterior mit Beta-Binomial konjugiertem Prior berechnen"""
    return beta(prior_alpha + conversions, prior_beta + trials - conversions)

def prob_b_beats_a(posterior_a, posterior_b, samples=100000):
    """Monte Carlo zur Berechnung von P(B > A)"""
    samples_a = posterior_a.rvs(samples)
    samples_b = posterior_b.rvs(samples)
    return (samples_b > samples_a).mean()

def expected_loss(posterior_a, posterior_b, samples=100000):
    """Erwarteter Verlust, wenn B gewählt wird"""
    samples_a = posterior_a.rvs(samples)
    samples_b = posterior_b.rvs(samples)
    loss = np.maximum(0, samples_a - samples_b)
    return loss.mean()

# Beispieldaten: Kontrolle 1000 Sessions / 120 Konversionen, Variante 1000 / 145
posterior_control = calculate_posterior(120, 1000)
posterior_variant = calculate_posterior(145, 1000)

prob_win = prob_b_beats_a(posterior_control, posterior_variant)
loss_variant = expected_loss(posterior_control, posterior_variant)

print(f"P(Variante > Kontrolle): {prob_win:.3f}")
print(f"Erwarteter Verlust bei Variante: {loss_variant:.4f}")

# Stopping Rule
if prob_win > 0.95 and loss_variant < 0.01:
    print("VARIANTE DEPLOYEN")
elif prob_win < 0.05:
    print("KONTROLLE DEPLOYEN")
else:
    print("TEST FORTSETZEN")
```

Sie können diesen Code in dbt-Modelle integrieren und täglich laufen lassen. Wenn Sie in BigQuery eine Tabelle mit test_id, variant, session_count und conversion_count haben, können Sie Posterior mit einer Python-UDF berechnen und das Ergebnis in eine neue Tabelle schreiben. Verbinden Sie das mit einem Looker- oder Metabase-Dashboard und Ihr Product-Team sieht die Posterior-Grafik in Echtzeit.

## Trade-offs und wann Sie bei Frequentist bleiben sollten

Der Bayesian-Ansatz ist nicht in allen Situationen überlegen. Es gibt drei Szenarien:

**1. Tests, die Compliance erfordern:** Bei klinischen Studien, Finanzsektor und Versicherungspremien-Modellierung werden Frequentist p-Werte von Regulatoren wie FDA/EMA standardmäßig akzeptiert. Wenn Sie Bayesian-Posterioren verwenden, ist zusätzliche Dokumentation erforderlich.

**2. Sehr niedrige Base Rate:** Beispielsweise 0,5 % Konversionsrate in einem Funnel-Schritt – hier wird die Bayesian-Prior-Auswahl kritisch. Mit uninformativen Prioren (Beta(1,1)) wird es schwierig, Signal vom Noise zu unterscheiden, und mit informativen Prioren besteht Verzerrungsrisiko. In solchen Fällen kann Frequentist „sicherer" wirken.

**3. Einmalig große Kampagnen:** Wie ein jährlicher Black-Friday-Landing-Page-Test – keine Wiederholungen, hohe Stakes. Wenn Sie Bayesian früh beenden und sich irren, können Sie nicht zurückgehen, weil die Kamp