---
title: "Bayesian Price Optimization im Mobile F2P"
description: "IAP-Preistests mit Posterior-Schätzung und segmentierter Optimierung: probabilistisches Modell für Conversion, Revenue und LTV Balance."
publishedAt: 2026-05-26
modifiedAt: 2026-05-26
category: gaming
i18nKey: gaming-002-2026-05
tags: [f2p-monetization, bayesian-testing, iap-optimization, price-ladder, mobile-gaming]
readingTime: 9
author: Roibase
---

Im Mobile F2P funktioniert IAP-Preisgestaltung immer noch intuitiv: $0.99, $4.99, $9.99 Ladder wird kopiert, bei niedriger Conversion wird der Preis gesenkt, bei hoher heißt es „mehr Value hinzufügen". Doch das gleiche $4.99-Paket zeigt bei organischen Nutzern 2,1 %, bei UA-Kohorten 1,4 % und im D30+-Whale-Segment 8,7 % Conversion. Klassische A/B-Tests scheitern hier: Entweder platzt die Sample Size, die Wartedauer erreicht 6 Wochen, oder es ist unklar, welche Metrik – Revenue oder Conversion – zu optimieren ist. Bayesian Price Optimization löst alle drei Probleme gleichzeitig: Mit Posterior Distributions werden frühe Signale erfasst, Segment-Level-LTV-Effekte modelliert und Revenue-Conversion-Abwägungen im probabilistischen Rahmen gemanagt.

## Die Engpässe von Frequentist A/B bei IAP-Preisgestaltung

Standardisierte A/B-Tests rechnen die Sample Size basierend auf Conversion Rate: Um p<0,05 Unterschied zwischen zwei Preisen zu detektieren, ist bei 2 % Baseline-Conversion und 10 % relativem Lift-Ziel mit 80 % Power ~15.000 Impressionen erforderlich. Bei mittleren IAP-Paketen bedeutet das 4–6 Wochen Testdauer. Diese lange Laufzeit verursacht:

- CPI-Anstieg in Meta-Kampagnen (Creative Fatigue)
- Drift der organischen Kohortenmix (Holiday-Effekte, ASO-Rank-Änderungen)
- Konkurrenzkampagnen starten neue Events, Nachfrageelastizität wird verzerrt

Ein noch kritischeres Problem ist die Revenue-Conversion-Dichotomie: Bei Preissteigerung von $2.99 auf $4.99 fällt Conversion von 2,1 % auf 1,7 %, doch Revenue pro Mille steigt um 42 %. Auf welche Metrik wird p-value angewendet? Die meisten Studios sagen „Revenue gestiegen" und gehen weiter – doch wenn D7-LTV-Modellierung durchgeführt wird, zeigt sich, dass das Whale-Segment zu 31 % abgewandert ist und der neue Preis die Retention schadet.

Der Bayesian-Ansatz hält Conversion und Revenue im gleichen Posterior-Modell: Prior-Belief (Beta-Verteilung aus vorherigen Tests) + Beobachtung (neue Daten) → Posterior (aktualisierter Glaube). Der Test kann ab Tag 3 sagen „mit 73 % Wahrscheinlichkeit ist $4.99 besser", am Tag 7 steigt das auf 89 %, am Tag 10 sinkt das Bedauern unter 1 % und der Test wird gestoppt.

## Prior-Verteilung aufbauen: Historische IAP-Daten statt Benchmarks

Die Qualität eines Bayesian Tests hängt davon ab, den Prior korrekt zu konstruieren. Viele Dokumentationen sagen „wähle einen uniformen Prior, lass die Daten sprechen" – doch im Mobile F2P mit 6 Monaten IAP-Historie würde man diese Quelle verschleudern. Beispielhafter Prior-Aufbauprozess:

**Schritt 1:** Alle IAP-Tiers der letzten 6 Monate extrahieren und deren Conversion-Verteilung analysieren. $0.99–$2.99 liegen in der 1,8–3,2 %-Spanne, Median 2,4 %. Beta-Parameter α=24, β=976 reflektieren diese Verteilung (Mittelwert=α/(α+β)≈0,024).

**Schritt 2:** Segment-Level-Varianz hinzufügen. Organische Kohorten zeigen durchschnittlich 18 % höhere Conversion als UA-Kohorten (α=28, β=972). Whale-Segment separat: D30+-Paying-User bei 6,8 % Conversion, α=68, β=932.

**Schritt 3:** Price-Elasticity-Kurve fitten. Historisch hat der $1.99→$2.99-Übergang Conversion um durchschnittlich 14 % reduziert. Neuer Test $2.99→$3.99: Diese Steigung in den Prior kodieren:

```python
def price_elasticity_prior(base_price, new_price, base_conversion):
    slope = -0.14 / 1.00  # $1 Anstieg = 14 % Rückgang
    delta = new_price - base_price
    expected_drop = slope * delta
    adjusted_conversion = base_conversion * (1 + expected_drop)
    alpha = adjusted_conversion * 1000
    beta = 1000 - alpha
    return alpha, beta
```

Dieser Ansatz reflektiert das Verhalten des eigenen Spiels statt vager „Industry-Benchmarks von 2,5 %".

## Posterior-Schätzung mit segmentierter Preis-Leiter

Test-Setup: Starter Pack $2.99 vs. $3.99, 7 Tage, 50/50-Split auf UA-Traffic. Segmentierung ist zwingend:

| Segment | Prior α | Prior β | Sample-Ziel |
|---------|---------|---------|-------------|
| D0–D7 organisch | 28 | 972 | 4000 |
| D0–D7 UA | 22 | 978 | 6000 |
| D7+ Non-Payer | 18 | 982 | 3000 |
| D7+ Past Buyer | 68 | 932 | 2000 |

Der Posterior wird pro Segment separat aktualisiert. Nach 3 Tagen:

**Organisches Segment:** $2.99 → 87 Conversions / 2100 Impressionen, $3.99 → 71 / 2050. Posterior: α₁=28+87=115, β₁=972+2013=2985 vs. α₂=28+71=99, β₂=972+1979=2951. Per Monte-Carlo mit 10.000 Samples: P($2.99 besser) = 78 %. Revenue-Perspektive: $2.99 × 87 = $260, $3.99 × 71 = $283. Revenue-Posterior mit Gamma-Verteilung: P($3.99 revenue-Vorteil) = 61 %.

Entscheidung an diesem Punkt: Liegt Priorität auf Conversion → $2.99 weitermachen; auf Revenue → 2 Tage warten. UA-Segment zeigt $3.99 klar überlegen (83 % Posterior-Wahrscheinlichkeit), Test wird gestoppt, Segment auf $3.99 gelenkt.

**Dynamische Preis-Leiter auf Segment-Basis:** Nach Test-Ende sieht das IAP-Inventar so aus:

- Organisch D0–D3: $2.99 Starter
- UA D0–D3: $3.99 Starter
- D7+ Past Buyer: $7.99 Booster (aus separatem Test-Posterior)
- Whale (D30+ $50+ LTV): $14.99 Premium Bundle

Diese Struktur optimiert 4 verschiedene Elasticity-Kurven statt eines globalen Preises. Mit [ASO](https://www.roibase.com.tr/de/aso)-Arbeiten kombiniert, wo Custom Product Pages nach Segment gestaltet werden, kann die IAP-Funnel weiter personalisiert werden: Das Value Proposition im Creative matcht den IAP-Tier.

## Thompson Sampling als Multi-Armed Bandit Extension

Statt 7 Tage fester Test: Thompson Sampling – bei jeder Impression wird aus dem Segment-Posterior gesampelt, der höchste Expected-Value-Preis wird gezeigt. Dadurch wird Exploration/Exploitation während der Testlaufzeit dynamisch balanciert.

Pseudo-Code:

```python
def thompson_sampling_price(segment, price_variants):
    posteriors = {p: get_posterior(segment, p) for p in price_variants}
    samples = {p: np.random.beta(post['alpha'], post['beta']) 
               for p, post in posteriors.items()}
    revenue_samples = {p: s * p for p, s in samples.items()}
    return max(revenue_samples, key=revenue_samples.get)
```

Dieser Ansatz minimiert Bedauern, besonders wenn 3+ Preis-Varianten getestet werden. Klassisches A/B mit 3 Preisen braucht 3× Sample Size, Thompson Sampling nullt automatisch schlechte Varianten durch Posterior-Updates. Am Tag 10, wenn $2.99-Posterior auf 9 % gefallen ist, sinkt die Expositions-Quote auf 5 % – kein Sample Waste.

Achtung: Unlimited Traffic vorausgesetzt. Ist das UA-Budget auf $5000/Tag begrenzt, riskiert Thompson Sampling, dass die vom Algorithmus gewählte schlechtere Conversion den CPA hochfährt und das Budget mittags aufgebraucht ist. Sichere Konfiguration: Erste 3 Tage 50/50-Split, Posterior-Credibility >80 %, dann Thompson freigeben.

## Revenue vs. LTV: Posterior mit Retention-Modell verknüpfen

Die finale Ebene der IAP-Preisoptimierung ist LTV-Projektion. $3.99 zeigt niedrigere Conversion, aber D7-Retention 8 % höher – die 90-Tage-LTV dieser Kohorte könnte die $2.99-Kohorte übertreffen. Klassisches A/B sieht das nicht, weil LTV nach 90 Tagen endgültig ist. Verbindet man Bayesian Posterior mit Survival Model, werden frühe Signale erkannt.

Setup: Für jede Preis-Variante wird die Retention-Kurve der ersten 7 Tage mit Cox Proportional Hazards gefittet:

```python
from lifelines import CoxPHFitter

df['price_variant'] = df['variant'].map({'2.99': 0, '3.99': 1})
cph = CoxPHFitter()
cph.fit(df, duration_col='days_retained', event_col='churned', 
        formula='price_variant + segment + paid_d3')
```

Model-Output: $3.99-Variante mit Hazard Ratio 0,88 (Churn 12 % niedriger, p=0,03). Mit Posterior kombiniert:

**LTV-Posterior-Berechnung:**
- $2.99: E[Conversion]=0,024, E[D90_Retention]=0,34, ARPDAU=$0,12 → LTV=$2.99 × 0,024 + 90 × 0,34 × 0,12 = $3,74
- $3.99: E[Conversion]=0,019, E[D90_Retention]=0,38, ARPDAU=$0,15 → LTV=$3.99 × 0,019 + 90 × 0,38 × 0,15 = $5,21

Per Monte-Carlo über 10.000 Iterationen: P($3.99 LTV überlegen) = 91 %. Diese Posterior-Credibility ist ein viel stärkeres Signal als nur Revenue-Sicht. Entscheidung: $3.99 wählen, IAP-Stack neu balancieren.

## Trade-off: Modell-Komplexität vs. Execution Speed

Bayesian IAP-Optimierung trägt drei operative Kosten:

**1. Prior-Wartung:** Jeder neue Event, Meta-Shift, Konkurrenz-Launch ändert Prior-Verteilung. Re-Kalibrierung alle 6 Monate obligatorisch. Kleine Studios ohne Data Scientist können das nicht halten.

**2. Segment-Granularität:** 8 Segmente × 3 Preise = 24 Posteriors tracken. Bei kleinen Segmenten (z. B. Whale) bleibt Posterior-Varianz hoch, Konfidenzintervalle breit. Praxis-Lösung: Whale-Segment extra ausmachen, klassischen A/B halten, andere mit Bayesian.

**3. Platform-Fragmentierung:** iOS vs. Android haben unterschiedliche Price Sensitivity. Im Apple App Store ist $2.99-Conversion 23 % höher als Android (App Annie 2025). Zwei Plattformen mit separaten Posteriors oder gepooltem? Separate = Sample Split, Pooled = Platform Bias. Lösung: Hierarchisches Bayesian-Modell – Platform als Random Effect.

Dennoch ist Bayesian schneller als 4+-Wochen A/B-Warten. Test stoppt nach 10 Tagen, Revenue-Impact ist in Woche 2 sichtbar, LTV-Projektion aktualisiert sich Tag 30. Frequentist-Timeline: 8–12 Wochen.

## Fazit: Probabilistic Pricing Mindset

Im Mobile F2P ist Preis-Testing kein binäres Ereignis mehr, sondern ein kontinuierlicher Posterior-Update-Prozess. Statt Conversion und Revenue mit separaten p-Values zu lösen, beide probabilistisch zu modellieren minimiert Bedauern, verkürzt Test-Dauer, ermöglicht Segment-Level-Optimierung. Bayesian fordert Prior-Konstruktions-Disziplin, liefert aber dafür Frühentscheidungsrecht, LTV-Projektion-Integration und Thompson Sampling für dynamische Allokation. Mit 5+ IAP-Tiers und UA-Budget >$100K/Monat ist Bayesian-Test-Infrastruktur nicht optional – es ist notwendig.