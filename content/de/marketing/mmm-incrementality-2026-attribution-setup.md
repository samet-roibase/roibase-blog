---
title: "MMM + Incrementality: Das Attribution-Setup von 2026"
description: "Robyn, Meta Lift, Geo-Experimente — wann nutzt man welches Tool? Neue Schichten der Marketingeffektmessung im Post-Cookie-Zeitalter."
publishedAt: 2026-07-30
modifiedAt: 2026-07-30
category: marketing
i18nKey: marketing-004-2026-07
tags: [mmm, incrementality, attribution, robyn, meta-lift]
readingTime: 9
author: Roibase
---

Im Post-Cookie-Zeitalter ist Last-Click Attribution wie ein Phantom verschwunden. 2026 stellen sich Marketing-Teams nicht mehr die Frage "welcher Kanal hat die Conversion gebracht", sondern "ohne welchen Kanal hätte die Conversion nicht stattgefunden". Diese Paradigmaverlagerung heißt: Incrementality. Aber Incrementality allein zu messen reicht nicht — man sieht die langfristigen Markeneffekte nicht. Hier kommt Marketing Mix Modeling (MMM) ins Spiel. Das gesunde Attribution-Stack 2026 besteht aus zwei Schichten: MMM und Incrementality-Tests. Robyns Open-Source-Framework von Meta, Meta Lift, Googles Geo-Experimente-Infrastruktur — alle drei beantworten unterschiedliche Fragen. In diesem Artikel zeigen wir, wann welches Tool zum Einsatz kommt, wie sie zusammenwirken und welche Fallstricke beim Setup lauern.

## MMM: Die Langzeit-Effekt-Karte

Marketing Mix Modeling ist eine regressionsbasierte Methode — sie kombiniert historische Ausgabedaten, Media Exposure und Verkaufsdaten, um den Beitrag jedes Kanals zum Umsatz zu berechnen. Metas Open-Source-Framework Robyn wurde 2022 veröffentlicht, erreichte aber erst 2025–2026 Production-Ready-Status. Robyn modelliert Adstock (die zeitliche Abnahme von Werbeeffekten) und Saturation Curves (der sinkende Return auf steigende Ausgaben) und optimiert so die Budgetverteilung über Kanäle hinweg.

Die Stärke von MMM: Es erfasst Markeneffekte. Eine Podcast-Sponsorship bringt diese Woche keine Conversions, könnte aber organische Suches über 6 Wochen um 18 % steigern. Last-Click sieht das nicht, MMM schon. Die Schwäche: keine Granularität. MMM sagt "geben Sie Meta monatlich 50.000 EUR mehr aus", nicht "in welche Kampagne oder welches Creative". Außerdem blickt MMM zurück — keine Echtzeit-Optimierung.

Um Robyn richtig zu kalibrieren, braucht man minimum 2 Jahre wöchentliche Daten (104 Zeilen). Der Datensatz sollte enthalten: Ausgaben pro Kanal (Google Ads, Meta, TikTok, Podcast, TV separat), Gesamtumsatz (Revenue oder Units), Preisänderungen, Feiertagseffekte und Saisonalität. Robyn nutzt Nevergrad für Hyperparameter-Tuning — es führt 100.000+ Modelle aus und findet den besten Fit. Das Ergebnis: mROAS (marginale ROAS) und Saturation-Punkt pro Kanal. Beispiel: Meta hat mROAS 3,2, aber über 100.000 EUR Spend sinkt es auf 1,8. Dieses Trade-off steuert die [Performance-Marketing](https://www.roibase.com.tr/de/ppc)-Budgetverteilung in der Produktion.

## Incrementality Testing: Kurzzeit-Kausalität

MMM zeigt Korrelation, Incrementality beweist Kausalität. Ein Incrementality-Test stellt eine simple Frage: Was verliere ich, wenn ich diese Kampagne ausschalte? Die häufigste Methode: Geo-basierte Holdouts. Sie teilen 50 US-Bundesstaaten in 25 Treatment (Kampagne läuft) und 25 Control (Kampagne aus) auf, messen die Verkaufsdifferenz. Googles GeoX-Infrastruktur automatisiert das — Kampagne wählen, Geo-Split durchführen, nach 2–4 Wochen ist der Lift-Report da.

Metas Conversion Lift Test macht User-Level-Holdouts. Sie öffnen in Meta Ads Manager einen Kampagne und starten eine "Lift Study" — Meta reserviert 10 % des Traffics für die Control-Gruppe (sehen keine Anzeigen), 90 % sind Treatment. Nach dem Test sagt Meta: Treatment-Conversion 2,3 %, Control 1,9 % — Lift 21 %. Das bedeutet: Der echte inkrementale Beitrag ist 21 %, die restlichen 79 % wären ohnehin Conversions geworden (organisch, Retargeting, Search).

Die Schwäche des Incrementality-Tests: teuer und langsam. Geo-Tests dauern minimum 2 Wochen, User-Level 4–6 Wochen. Während des Tests geben Sie Geld für die Control-Gruppe aus — potenzieller Verlust. Sie können nicht jede Kampagne testen, nur strategische Kanäle (neues Creative-Format, neue Plattform, Upper-Funnel-Kampagne). Aber ohne Incrementality können Sie MMM nicht validieren — MMM sagt "Metas ROAS ist 4,2", der Lift-Test sagt "nein, echter Lift 18 %, ROAS 1,6". Beide zusammen geben die Wahrheit.

### Holdout-Strategie und Sample Size

Der Erfolg eines Geo-Tests beginnt bei der Sample-Size-Berechnung. Google GeoX empfiehlt minimum 40 Geos (Städte/Bundesstaaten) — 20 Treatment, 20 Control. Mit weniger Geos (z.B. nur Istanbul, Ankara, Izmir) ist die statistische Power unzureichend, Signifikanz kommt nicht. Für Meta Lift: minimum 50 Conversions pro Tag. Mit weniger ist das Konfidenzintervall zu breit — der Lift könnte zwischen 10 % und 40 % liegen, Sie können keine Entscheidung treffen.

Bei der Testdauer: Saisonalität berücksichtigen. Wenn Freitag–Sonntag 30 % mehr Traffic als Montag–Donnerstag bringt, kalkulieren Sie volle Wochen (2 oder 4 Wochen). Es gibt auch Spillover-Effekte: Ein User in einer Treatment-Geo reist in eine andere Stadt und konvertiert dort. Das erzeugt Noise in der Control-Gruppe, der Lift wirkt niedriger als real. Zur Kompensation: Geo-Grenzen eng halten (Metro-Area statt Bundesland) oder in Kategorien testen, wo Geo-Mobilität niedrig ist (lokale Services, Quick Service Restaurant).

## MMM + Incrementality: Wie sie zusammenwirken

Denken Sie an sie als sich gegenseitig validierende Schichten. MMM gibt die Langzeit-Budgetverteilung vor, Incrementality-Tests validieren diese Allocation. Der Ablauf:

1. **MMM ausführen** — Robyn-Modell mit 2 Jahren Daten aufbauen, mROAS pro Kanal berechnen.
2. **Budgets nach MMM anpassen** — beispielsweise "Podcast-Spend verdoppeln".
3. **Kritischen Kanal in Incrementality-Test nehmen** — Podcast 4 Wochen mit Geo-Split testen.
4. **Lift-Ergebnis gegen MMM abgleichen** — MMM sagte "Podcast-ROAS 5,2", Lift-Test sagt "echter Lift 25 %, ROAS 3,1" → MMM kalibrieren.
5. **Loop schließen** — neue Lift-Daten als Prior in Robyn einfügen, Modell verfeinern.

Dieser Zyklus läuft vierteljährlich. MMM wird alle 3 Monate neu ausgeführt (13 neue Wochen Daten), Incrementality-Tests rotieren monatlich über 1–2 Kanäle. Ergebnis: sowohl Macro-Level-Budget-Mix korrekt, als auch Micro-Level-kausale Evidenz.

Ein Beispiel: E-Commerce-Brand, MMM zeigt Google Search ROAS 8,2 — profitabelster Kanal. Aber Meta Lift-Test zeigt: 60 % des Search-Traffics besteht aus Brand-Suchanfragen — diese User kämen auch ohne Anzeige. Echter inkrementaler Lift 15 %, ROAS 2,4. Mit diesem Wissen verschieben sie Budget weg von Search hin zu Upper-Funnel (YouTube, Podcast). 2 Quartale später, nach MMM-Rerun: organischer Brand-Search ist um 18 % gewachsen — Podcasts verzögerter Effekt wird im Modell sichtbar.

## Welches Tool wann nutzen?

**Robyn (MMM) nutzen:**
- Sie betreten einen neuen Markt, wissen nicht in welche Kanäle investieren.
- Sie geben über 5+ Kanäle aus und wollen Budget neu verteilen.
- Sie wollen Langzeit-Effekt von Brand-Kampagnen messen (TV, Podcast, Influencer).
- Sie haben minimum 2 Jahre wöchentliche Sales + Spend-Daten.

**Meta Lift nutzen:**
- Sie testen ein neues Creative-Format auf Meta (Reels, Advantage+ Catalog).
- Sie haben Upper-Funnel-Kampagne gelauncht, wollen Conversion-Beitrag beweisen.
- Sie haben 50+ Conversions/Tag, können 4–6 Wochen Testdauer akzeptieren.
- Sie tolerieren, dass Control-Gruppe kein Budget bekommt (Kostenseite).

**Google GeoX (Geo Experiment) nutzen:**
- Sie testen Brand vs. Non-Brand Split in Google Ads.
- Sie geben über mehrere Plattformen (Google + Meta + TikTok) aus, wollen Cross-Channel-Incrementality sehen.
- In der Türkei haben Sie Traffics-Volumen für City-Level-Splits (Istanbul, Ankara, Izmir, Bursa, Antalya separat testbar).

Budget-Constraint und nur ein Tool wählbar: **Starten Sie mit Incrementality-Test** (Meta Lift oder GeoX). Incrementality liefert sofort handlungsfähige Insights — "diese Kampagne ausschalten, 30 % Kostenersparnis". MMM ist strategischer, braucht aber extra Interpretation. Ideal: beides parallel, gegenseitig füttern.

## Setup-Fallstricke und Kalibrierung

**MMM-Fallstricke:**
- **Unzureichende Daten:** Robyn unter 52 Wochen laufen lassen — Modell overfittet.
- **Fehlende Variablen:** Preisförderung, Competitor-Ausgaben nicht im Modell — Kanal-Effekt wird aufgebläht.
- **Adstock falsch:** Gleicher Adstock Decay für alle Kanäle nutzen — TV sollte 8 Wochen, Meta 2 Wochen sein. Geben Sie Robyn das als Prior.
- **Saturation ignorieren:** Robyn nutzt default logarithmische Saturation, aber Brand-Search kann linear sein. Fit-Qualität prüfen, Curve anpassen.

**Incrementality-Fallstricke:**
- **Kurze Testdauer:** 1-Wochen-Lift-Test hat keine statistische Power. Minimum 2 Wochen (Geo), 4 Wochen (User-Level).
- **Kontamination:** Treatment und Control in gleicher Lokation (z.B. zwei Istanbul-Bezirke) — Spillover. Geo-Grenzen müssen clear sein.
- **Saisonalität-Rauschen:** Test in Black-Friday-Woche = Lift könnte 2x höher ausfallen. Normal-Wochen wählen.
- **Attribution Window falsch:** Meta Lift nutzt default 7-day Click, 1-day View. Lange Sales Cycle (B2B, High Ticket)? 28-day Window öffnen.

Kalibrierung: Vergleichen Sie MMM-Kanal-ROAS mit Lift-Test-realem ROAS. Differenz über 20 %? MMM-Prior (Adstock, Saturation) neu justieren. In Robyn können Sie `hyperparameter_bounds` für Adstock Decay von [0,3, 0,8] auf [0,4, 0,6] setzen, Suchraum enger machen. Diese Iteration dauert 2–3 Quartale, dann sind MMM und Incrementality aligned.

## Wohin 2026 und darüber hinaus?

Mitte 2026 switchen 40 % der Incrementality-Tests zu Bayesian-Methoden. Klassische Frequentist A/B-Tests warten auf "p < 0,05", Bayesian erlaubt Early Stopping — nach 10 Tagen, wenn Posterior Probability 95 % überschreitet, testen stoppen. Meta hat Bayesian Conversion Lift in Beta gestartet. Google GeoX nicht, aber 2027 erwartet.

Robyn-Seite: Causal Inference-Integration (Pearl Notation, DAG-Modelle) kommt. Aktuell ist Robyn korrelativ — zwei Kanäle steigen gleichzeitig (beide Black Friday vorbereitung), Robyn trennt Effekte schlecht. Causal MMM (Econometric + Causal Impact Hybrid) löst das. 2027 Production-Ready erwartet.

Ein letzter Punkt: Das Incrementality + MMM-Stack gilt nicht nur Paid Media, sondern auch Retention und Lifecycle Marketing. Inkrementale E-Mail-Effekte mit Braze + GeoX wird getestet. Push-Notification-Lift User-Level-Holdout. Attribution ist nicht mehr nur Acquisition, sondern Full Customer Journey. 2026: Teams ohne diesen Stack geben blind aus — Teams mit haben engineering-gesteuerte Optimierung pro Euro.