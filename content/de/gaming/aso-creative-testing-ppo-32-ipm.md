---
title: "ASO Creative Testing: Mit PPE in 6 Wochen +%32 IPM"
description: "Custom Product Pages und Play Experiments für iOS/Android-Store-Visuals testen. Statistische Signifikanz, Lift-Berechnung, Creative-Iterations-Methodik."
publishedAt: 2026-05-22
modifiedAt: 2026-05-22
category: gaming
i18nKey: gaming-001-2026-05
tags: [aso, creative-testing, custom-product-pages, play-experiments, mobile-growth]
readingTime: 9
author: Roibase
---

Der am meisten vernachlässigte Bereich im Mobile-Game-Growth: Store-Visuals. Die meisten Studios laden Icon und Screenshots einmal hoch und vergessen sie. Dabei verlieren Sie mit jeder Woche, in der Sie Apple Custom Product Pages (CPP) und Google Play Experiments (PPE) nicht A/B-testen, potenziell massive Gewinne bei Install per Impression (IPM). Seit 2025 sehen Spiele in Tier-1-Märkten, die CPP nutzen, durchschnittlich +%22 IPM-Lift. Aber ohne die richtige Testmethodik ist die Zahl bedeutungslos. Dieser Text behandelt die Methodologie.

## Custom Product Pages: Was und Warum Jetzt

Apple führte CPP 2021 ein, Google Play aktualisierte 2022 mit echter experimenteller Kontrolle. Davor war es die Ära „ein Visual-Set + kleine Tests". Jetzt können Sie jedem Campaign-Segment einen anderen Creative-Set präsentieren: Wenn Sie in UA-Creative Anime-Stil verwenden, dann auch im Store. Wenn Kampf-Mechaniken im Fokus stehen, sollten Screenshots Combat zeigen.

Die Kernidee ist einfach: **Nachrichten-Konsistenz**. Nutzer sehen einen Hero-Character auf TikTok, klicken, und sehen dann einen Farming-Mechanic-Screenshot im App Store — Conversion sinkt. CPP schließt diese Lücke. Aber die echte Kraft liegt im Test-Zyklus: Sie bringen 3 verschiedene visuelle Richtungen live und treffen nach 2 Wochen eine datengestützte Entscheidung.

Technisches Detail: CPPs sind vom Standard-Produkt unabhängig; Apple erlaubt bis zu 35 Versionen (Apple-Limit). Google hat dynamische Experiment-Quoten, aber praktisch genügen 10–12 aktive Tests. Jeder wird mit einer eigenen Campaign-ID verknüpft — Sie messen über SKAdNetwork (SKAN) oder Firebase-Attribution.

## Play Experiments und iOS-Äquivalent: Test-Architektur

Google Play Experiments ermöglicht Conversion-Funnel-Tests im Store selbst: 50 % Kontrolle, 50 % Variant können automatisch aufgeteilt werden. Apple hat keine eigene Store-Split-Funktion, daher nutzen Sie CPPs mit Campaign-Level-Routing. Der Test-Split findet auf Mediation-Ebene statt, nicht im Store.

Typische Test-Struktur:

**Google (Store-Level-Split):**
- Baseline (aktueller Visual-Set)
- Variant A (neue Screenshot-Reihenfolge)
- Variant B (anderes Hero-Character)

Traffic wird automatisch verteilt; Play Console liefert nach 14 Tagen einen Statistical-Significance-Report.

**Apple (Campaign-Level-Split):**
- Campaign 1 → Default-Produktseite
- Campaign 2 → CPP Variant A
- Campaign 3 → CPP Variant B

Bei Apple Search Ads oder Paid Social müssen Sie den Split manuell vornehmen. Für jede Campaign extrahieren Sie Install + IPM-Daten aus SKAN-Postbacks. Significance berechnen Sie selbst (Apple bietet keine Test-UI).

Hier machen die meisten Studios Fehler: Sie treffen Entscheidungen mit unzureichender Sample-Größe. 500 Installs = „Variant gewonnen" ist Statistik-Theater. Die echte Anforderung: **minimum 2000 Impressionen pro Variant + 95 % Confidence Interval**. Darunter ist jede Aussage spekulativ.

## Statistische Signifikanz und Lift-Berechnung

Play Console liefert Significance, aber die Mathematik dahinter ist einfach: **Proportion Z-Test**. Er prüft, ob der Unterschied der Conversion-Raten zwischen zwei Gruppen Zufall oder Real ist.

Formel:

```
z = (p1 - p2) / sqrt(p * (1-p) * (1/n1 + 1/n2))
p = (x1 + x2) / (n1 + n2)
```

- `p1`, `p2`: Variant und Kontroll-Conversion-Rate
- `n1`, `n2`: Impressionen-Anzahl
- `x1`, `x2`: Install-Anzahl

Z-Score > 1,96 bedeutet: Mit 95 % Konfidenz existiert ein echter Unterschied.

**Beispiel:**
- Kontrolle: 10.000 Impressionen, 800 Installs → %8,0 CVR
- Variant: 10.000 Impressionen, 1.120 Installs → %11,2 CVR
- Lift: +40 % (relativ), +3,2pp (absolut)
- Z-Score: 8,4 → p < 0,001 (definitiv signifikant)

Aber Achtung: Bei kleinen Sample-Größen kann der Lift groß aussehen, aber die Signifikanz niedrig sein. Mit 500 Impressionen und +15 % Lift zu freuen ist voreilig — das 95 % CI-Band könnte -5 % bis +35 % sein.

**Minimum-Sample-Berechnung** (Power Analysis):
Baseline CVR %8, MDE (Minimum Detectable Effect) %20 Lift (also %9,6 CVR) und %80 Power benötigt etwa 4.500 Impressionen pro Gruppe. Darunter nicht entscheiden.

### Bayesian vs. Frequentist

Play Console nutzt Frequentist-Ansatz. Alternative: **Bayesian A/B Testing** — kontinuierliche Posterior-Updates liefern Aussagen wie „Variant ist mit 87 % Wahrscheinlichkeit besser". Bei kleinen Samples hilft Bayesian früher zur Entscheidung; in der Production ist Frequentist aber sicherer, weil Type-I-Error-Kontrolle Vorrang hat.

## Creative-Iterations-Methodik: Vom ersten Test zur Skalierung

Die meisten Studios nutzen CPPs so: Marketing erstellt 3 Visuals, launcht, schaut nach 1 Woche, sagt „die mittlere ist besser" und zieht weiter. Das ist falsch.

Der richtige Iterations-Zyklus:

1. **Hypothesis Formation (Woche 0):**
   - Nehmen Sie Ihren Top-Performer aus UA-Creatives. Welcher Angle hat höchste ITR? (Character vs. Mechanik vs. Reward)
   - Übertragen Sie diesen Angle auf 2–3 Store-Visual-Varianten. Kontrolle = aktuelles Visual.

2. **Test Launch (Woche 1–2):**
   - Live mit CPPs via Campaign-Level-Routing. Gleicher Traffic pro Variant (manuelle Bid-Anpassung oder Creative Rotation).
   - Tägliche Impressions + Installs exportieren. Kein voreiliger Gewinner-Preis.

3. **Significance Check (Woche 3):**
   - Z-Test für jede Variant laufen lassen. Kein Variant auf Significance? Sample erhöhen (+%50 Traffic) oder 1 Woche warten.
   - Wenn 1 Variant p < 0,05 und Lift >%15: Iterations-Phase.

4. **Winner Iteration (Woche 4–5):**
   - Gewinner-Variant zur neuen Baseline. 2 neue Varianten: eine radikal anders (Color-Scheme), eine incremental (Screenshot-Reihenfolge).
   - 2. Test-Runde starten.

5. **Scale (Woche 6+):**
   - 2. Round auch Gewinner? Anwenden auf alle Kampagnen. Altes Control archivieren.
   - Nach 3 Monaten nochmal testen — Meta ändert sich, Creative Decay setzt ein.

Mit diesem Zyklus machen Sie 8 Runden pro Jahr. Jeder Lift von %10–15 ergibt zusammengesetzt: (1,1)^8 = 2,14x → +%114 IPM-Verbesserung am Jahresende. In der Praxis sehen wir %30–50 (nicht jeder Test gewinnt).

## Multivariate Testing und Segmentation

Das obige ist Two-Group A/B. Advanced Level: **Multivariate Testing** (MVT). Sie testen 3+ Elemente gleichzeitig: Icon, erster Screenshot, Video-Vorschau. Aber Kombinationen explodieren (3 Icons × 4 Screenshots × 2 Videos = 24 Varianten). Sample-Anforderung × 24.

Lösung: **Factorial Design**. Sie messen Haupt-Effekte jedes Elements separat, ignorieren aber Interaktionen (z. B. Icon A + Screenshot B könnte spezielle Synergie haben, sehen Sie nicht). Tradeoff: Geschwindigkeit vs. Tiefe.

Alternative: **Sequential Testing**. Zuerst Icon, dann Screenshot, dann Video. Bei jedem Schritt Gewinner nehmen, nächstes Element dran. Gesamtdauer länger (12–18 Wochen), aber jede Entscheidung solid.

**Segmentation:** Sie können CPPs auch nach Audience-Segment splitten. Beispiel: iOS 17+ modernes UI, iOS 15– klassisch. Oder Geo: USA superhero Theme, MENA fantasy. Dann braucht jedes Segment einen separaten Test — Total-Sample steigt. Sinnvolle Segmentation: LTV-Differenz >%30.

## Roibase und ASO-Test-Infrastruktur

Roibase' [App Store Optimization](/de/aso) Leistung baut die CPP/PPE-Test-Infrastruktur auf: SKAdNetwork Conversion-Value-Mapping, Firebase/Adjust-Integration, Custom-Dashboard für Real-Time-Significance-Tracking. Mit dem [Premium-Publisher-Programm](/de/premiumyayinci) kontrollieren wir auch UA-Creative-zu-Store-Creative-Konsistenz — TikTok SparkAds und CPP-Visuals sprechen die gleiche Sprache.

Typisches Engagement: Wochen 1–2 Baseline-Messung, Wochen 3–6 erster Test-Zyklus, Wochen 7–12 Iteration + Skalierung. Nach 3 Monaten sehen wir +%20–35 IPM-Lift (Tier-1 Casual/Hypercasual). Bei Midcore/Strategy sinkt Lift (%10–15), weil Decision-Cycle länger und Screenshot-Detail kritischer ist.

## Fazit: Creative Testing = Kontinuierlicher Prozess

ASO Creative Testing ist keine Kampagne, es ist ein **Prozess**. Wenn Sie einmal testen und den Gewinner 6 Monate nutzen, verlieren Sie durch Creative Decay die Hälfte des Lifts. **Refresh alle 3 Monate** nötig. Meta ändert sich, Konkurrenten probieren neue Stile, Apple/Google Editorial-Trends evolvieren.

Was Sie sofort tun sollten: Analysieren Sie Ihre aktuellen Store-Visuals. Passt der Angle der Top-Performer-UA-Creative zu Ihren Screenshots? Nein? Erste CPP-Variant von diesem Angle designen. 2 Wochen später: minimum 5.000 Impressionen sammeln. Z-Test. Lift >%15 + p < 0,05? Iterations-Runde starten. Nach 6 Wochen: +%20–30 IPM-Lift ist realistisch.