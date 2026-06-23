---
title: "MMM + Incrementality: Das Attribution-Setup von 2026"
description: "Robyn, Meta Lift und Geo Experiments — welche Methode wann funktioniert? Technischer Leitfaden zum Neuaufbau von Attribution im Post-Cookie-Zeitalter."
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: marketing
i18nKey: marketing-004-2026-06
tags: [mmm, incrementality, attribution, robyn, meta-lift]
readingTime: 9
author: Roibase
---

Last-Click-Attribution starb 2023, Multi-Touch-Attribution 2024. 2026 hat sich die Marketingmessung in zwei Pole aufgeteilt: Marketing Mix Modeling (MMM) auf Makroebene, Incrementality Tests auf Mikroebene. Server-seitige Conversion APIs bilden die Brücke dazwischen. Dieser Artikel erklärt, welche Methode unter welchen Bedingungen funktioniert und welche Outputs welche Entscheidungen treiben — nicht abstrakte „Attribution-Philosophie", sondern ein praktisch umsetzbarer Stack.

## Marketing Mix Modeling läuft jetzt wöchentlich

MMM bedeutete 2015 „einmal im Jahr ein CEO-Präsentation". 2026 können offene Tools wie Robyns Lösung von Meta sowie Bayesian-Modelle wöchentlich laufen und die Kanal-Contribution aktualisieren. Die Struktur sieht folgendermaßen aus: Historische Ausgaben, Impressionen, Conversions und externe Faktoren (Saisonalität, Feiertage, Wettbewerbsindex) werden durch Time-Series-Regression modelliert. Das ergibt die marginale ROAS für jeden Kanal. MMM beantwortet die Frage: Wenn ich 100.000 EUR zusätzlich auf einen Kanal verteile, wieviele zusätzliche Käufe entstehen?

Die Einrichtung ist nicht trivial, aber die technischen Anforderungen sind transparent: mindestens 52 Wochen tägliche Daten (idealerweise 104 Wochen), kanal-zurechenbare Ausgabenzeilen, Konversionszahlen (noch besser mit Umsatz). Robyn läuft in Python und R, liest Daten aus BigQuery oder Snowflake, berechnet die posteriore Verteilung mit Prophet oder Stan. Die Ausgabe: Channel-Contribution-Grafiken, Sättigungskurven und Response-Kurven — welcher Kanal wird von Budget beeinflusst, welcher sitzt bereits im Punkt sinkender Erträge.

Robyns 2026er Version bringt Geo-Level-Granularität: Teilst du die Türkei in 7 Regionen auf, wird für jede Region ein separater Sättigungsschwellenwert berechnet. Istanbul könnte bei 35% Meta-Ads-Sättigung sein, während Anatolien bei 10% sitzt — diesen Unterschied zu sehen verändert die Budget-Shift-Entscheidung. Aber Vorsicht: MMM **beweist keine Kausalität**, es zeigt Korrelation. „Google Ads Ausgaben stiegen, also stiegen auch Verkäufe" ist nicht dasselbe wie „Google Ads verursachte die Verkaufssteigerung". Hier springt Incrementality ein.

## Meta Lift hat Incrementality zur Plattform gemacht

Meta's Conversion Lift ist ein echtes Randomized Controlled Trial (RCT). Die Nutzer-Population wird halbiert: Die Test-Gruppe sieht Anzeigen, die Kontroll-Gruppe nicht. Der Conversion-Unterschied zwischen den beiden Gruppen ist der **netto Beitrag** dieser Kampagne. 2026 ist dieses System von Campaign-Level auf Creative-Level abgestiegen — für 3 unterschiedliche Videos innerhalb einer Kampagne wird separate Incrementality gemessen.

Der technische Setup: In Ads Manager wählst du statt „Create A/B Test" nun „Create Lift Test", mit Minimum 200.000 Reichweite und 2-wöchiger Laufzeit (Meta enforced das). Die Kontroll-Gruppe sollte zwischen 10-20% liegen — darunter sinkt die statistische Power, darüber der Umsatzverlust. Nach dem Test liefert Meta dir: „Test-Gruppe 1000 Conversions, Kontroll-Gruppe 700 Conversions → 30% inkrementeller Lift, Konfidenzintervall 18%-42%".

Diese Zahl geht direkt ins Budget. Hat die Kampagne 100.000 EUR ausgegeben und zeigt 30% Lift, dann haben 30.000 EUR des Budgets wirklich zu zusätzlichen Verkäufen geführt — die restlichen 70.000 EUR hätten diese Verkäufe ohnehin über Organik oder andere Kanäle generiert. Daraus berechnest du die marginalen Kosten pro inkrementeller Conversion (mCPIC): 100.000 / 300 = 333 EUR. Diese Zahl vergleichst du mit MMM's Output „Meta's letzte 1000 EUR Budget brachten 2,8 Käufe" — beide sollten sich bestätigen, 15-20% Unterschied ist normal (methodologische Differenz), 50%+ Differenz signalisiert ein Datenproblem.

Meta Lift's Schwäche: Es funktioniert nur im Meta-Ökosystem, kann Cross-Channel-Effekte nicht messen. Gibt es synergistischen Lift wenn Google Ads + Meta zusammen laufen? Das misst ein Geo Experiment.

## Geo Experiments schauen auf Cross-Channel-Synergie

Google's Geo Experiments Framework funktioniert so: Teile die Türkei in 10 Regionen auf, erhöhe in 5 davon das Budget um 20% (oder fahre es komplett herunter), in 5 lässt du es gleich. Nach 4 Wochen vergleichst du Verkäufe zwischen den beiden Gruppen — wenn Unterschied existiert und statistisch signifikant ist (p<0,05), verursachte die Budget-Änderung diesen Unterschied. Diese Struktur unterscheidet sich von Meta Lift: Sie differenziert nicht nach Kanal, schaut auf totalen Effekt pro Region.

In der Praxis: In Campaign Manager 360 oder Google Ads wählst du „Experiments" > „Geo experiment" (2026 auch aus GA4 triggerbar). Für Regionsdefinition nutzt du Postleitzahlen, Bundesländer oder DMA (in der Türkei NUTS2-Regionen). Minimum 6 Wochen Baseline-Daten erforderlich, Test-Laufzeit mindestens 3 Wochen (idealerweise 6 Wochen — um saisonales Rauschen zu dämpfen). Google's Bayesian Inference Motor aktualisiert täglich die Posterior, Test-Ende liefert: „20% Budget-Steigerung führte zu 8,5% Umsatzsteigerung (KI: 4,2%-12,8%)".

Diese Methode ist besonders stark für Cross-Channel-Strategien. Beispiel: „Bringt Google + Meta zusammen 15% mehr Umsatz als separat?" Gruppe A läuft beide Kanäle full throttle, Gruppe B drosselst du Google auf 50%. Wenn Umsatz-Differenz unter 10% liegt, gibt es keine Synergie — Budget-Umverteilung notwendig. Geo Experiments' Nachteil: Teuer (6 Wochen Baseline + 6 Wochen Test = 3 Monate), Ergebnisse sinnvoll nur bei großen Budget-Änderungen. 5% Budget-Tweaks verschwinden im Rauschen.

## Welche Methode wann — Decision Tree

Du kannst deine Entscheidung auf 3 Fragen runterfahren:

1. **Welcher Entscheidungs-Scope?** Jährliche Budget-Allocation → MMM. Campaign-spezifischer Creative-Vergleich → Meta Lift. Cross-Channel-Sinergie-Test → Geo Experiment.

2. **Ist die Datenbasis ready?** MMM braucht 52+ Wochen saubere Ausgaben- + Conversion-Daten. Lift braucht 200K+ Impressionen und 2 Wochen. Geo braucht 6 Wochen Baseline + geografische Segmentierung.

3. **Wie schnell muss die Entscheidung sein?** Wöchentliche Optimierung → Meta Lift kontinuierlich. Quartals-Strategie → MMM monatlich refresh. 1-2 große Pivots pro Jahr → Geo Experiment.

Tabelle:

| Methode | Output | Dauer | Min. Daten | Ideale Nutzung |
|---|---|---|---|---|
| MMM (Robyn) | Kanal-Contribution, Sättigung | 52+ Wochen | Ausgaben + Conversions (täglich) | Budget-Allocation-Strategie |
| Meta Lift | Inkrementelle Conversions pro Campaign/Creative | 2-4 Wochen | 200K Impressionen | Creative Testing, Campaign Pruning |
| Geo Experiment | Cross-Channel Sinergie, regionale Lifts | 6-12 Wochen | 6 Wochen Baseline + regionale Daten | Kanal-Sinergie-Test, regionale Expansion |

Diese drei Methoden sind nicht Alternativen, sondern Komplemente. MMM sagt „Welcher Kanal ist wieviel wert", Lift sagt „Hat diese Kampagne wirklich Wert hinzugefügt", Geo sagt „Sind zwei Kanäle zusammen besser". Ein Team, das alle drei betreibt, gründet [Performance-Marketing](https://www.roibase.com.tr/de/ppc) Strategie auf Experiment statt Vermutung, auf Kausalität statt Korrelation, auf Test statt Dashboard.

## Den Stack praktisch aufbauen

Um das theoretische Framework praktisch umzusetzen, brauchst du folgende Schichten:

**Datenerfassung:** Server-seitiges GTM, das Conversion-Signale parallel zu Google Ads, Meta CAPI und BigQuery sendet. Wenn du auf Client-seitige Cookies vertraust, verlierst du 30-40% Signale (iOS 17, Firefox, Brave). [Digitales Marketing](https://www.roibase.com.tr/de/dijitalpazarlama) Infrastruktur von Roibase verbindet sGTM + First-Party Data Layer — hier kommt das granulare Budget-Daten für MMM her.

**Model Pipeline:** Robyn aus BigQuery speisen. Mit dbt Ausgaben + Conversion-Daten auf täglicher Granularität modellieren. Python-Script läuft wöchentlich (Cloud Function oder Airflow), Output zu Looker Studio. Lift-Tests startest du manuell aus Meta Ads Manager, aber ziehst Ergebnisse via API (Marketing API `insights` Endpoint mit Lift-Metrik), schreibst zu BigQuery, joinst mit Robyn Output.

**Geo Experiment:** Google Ads API `experiments` Resource ermöglicht programmgesteuerte Einrichtung. Nach Test-Ende holst du Results via `experiment_id`, writest zu BigQuery, vergleichst mit MMM-Outputs. Alles in einem Dashboard sehen ist wertvoll: „MMM sagt Meta-Contribution 22%, Lift-Test sagt Incremental 28%, Geo-Test sagt regionale Variation 12-34% — diese 3 Zahlen zusammen treiben die Strategie-Entscheidung."

**Entscheidungs-Zyklus:** Jeden Quarter MMM refresh, monatlich 1-2 Lift Tests, halbjährlich 1 Geo Experiment. Für kleinere Teams: Erst MMM aufbauen (2 Wochen wenn Daten existieren), dann Meta Lift routinieren (zu jeder Campaign standard), Geo nur vor großen Pivots.

2026 ist Attribution kein Single Tool, sondern Orchestration dreier Tools. Jede beantwortet andere Fragen, zusammen ermöglichen sie Entscheidungen im Post-Cookie-Kontext. Test statt Vermutung, Kausalität statt Korrelation, Experiment statt Dashboard — darauf baut Growth auf.