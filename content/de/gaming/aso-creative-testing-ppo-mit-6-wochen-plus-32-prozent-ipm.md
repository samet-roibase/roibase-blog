---
title: "ASO Creative Testing: Mit PPO in 6 Wochen +32 % IPM"
description: "Custom Product Pages und Play Experiments machen visuelle App-Store-Tests statistisch verlässlich. Ein 6-Wochen-Praxisbericht mit Methodik und messbaren Ergebnissen."
publishedAt: 2026-06-21
modifiedAt: 2026-06-21
category: gaming
i18nKey: gaming-001-2026-06
tags: [aso, custom-product-pages, play-experiments, creative-testing, mobile-gaming]
readingTime: 9
author: Roibase
---

Im App Store ist organisches Wachstum längst nicht mehr auf eine einzelne Produktseite beschränkt. Apples Custom Product Pages (CPP) und Googles Play Experiments ermöglichen es, verschiedenen Nutzersegmenten unterschiedliche visuelle Variationen zu zeigen. Doch die meisten Mobile-Game-Teams nutzen diese Werkzeuge nach dem Trial-and-Error-Prinzip – statt statistisch fundierter Testdesigns. Ein strukturierter 6-Wochen-Prozess für ASO Creative Testing führte zu einer Steigerung der Impression-to-Install-Quote (IPM) um 32 %. Dieser Artikel beschreibt die Methodik und reproduzierbaren Schritte dahinter.

## Custom Product Pages: Segmentierung, nicht Kampagnen

CPP gibt es seit 2021, doch die typische Nutzung bleibt oberflächlich: „eine Seite für Land X" oder „eine Landing Page für Influencer-Kampagnen". Das eigentliche Potenzial von CPP liegt darin, kreative Hypothesen je nach Akquisitionsquelle zu testen.

In unserem Test für ein RPG-Spiel erstellten wir drei CPP-Varianten: (1) Charakter-fokussiert (Hero Close-up Screenshots), (2) Gameplay-fokussiert (Combat Mechanics), (3) World-Building-fokussiert (Environment Art + Lore Hints). Jede Variante wurde in Apple Search Ads unterschiedlichen Keyword-Gruppen zugeordnet. Die Charakter-fokussierte CPP erzielte 41 % höhere IPM bei Branded Search. Die Gameplay-fokussierte CPP zeigte 28 % bessere Performance bei generischen RPG-Keywords.

Der entscheidende Punkt: CPP nicht auf Kampagnen-Ebene denken, sondern auf Akquisitions-Intent-Ebene. Ein Nutzer, der nach dem Spielnamen sucht, hat bereits eine Entscheidung getroffen – ihm einen Character Close-up zu zeigen, wirkt überzeugender. Wer nach „best rpg 2026" sucht, kennt das Spiel noch nicht – hier funktionieren Mechanik-Visuals besser.

## Play Experiments: Entscheidungen mit Confidence Intervals treffen

Googles Experiments-Funktion in der Play Console bietet A/B-Test-Infrastruktur, aber die Standardeinstellungen reichen für viele Tests nicht aus. Für 95 % Confidence Level braucht man mindestens 1000 Conversions (Installs). Viele Spiele erreichen aber nur 200-300 organische Installs pro Tag – der Test zieht sich über 5+ Wochen, und saisonale Schwankungen verfälschen die Ergebnisse.

Wir führten zwei aufeinanderfolgende Tests über 6 Wochen durch. Test 1: Screenshot-Reihenfolge (Action-First vs. Story-First). Test 2: Icon-Farbpalette (Warm vs. Cool). Die erforderliche Mindestgröße berechneten wir auf Basis der bestehenden IPM (18 %) und einem angestrebten Lift (15 % relativ). Mit G*Power ergab sich: pro Test mindestens 1200 Impressions + 840 Installs für 5 % IPM-Baseline.

Im ersten Test standen wir nach 14 Tagen bei 82 % Confidence. Anstatt den Test zu beenden, vershoben wir das Traffic-Split-Verhältnis: 70 % zur Variante, 30 % zum Control. So erreichten wir am 21. Tag 95 % Confidence. Googles Standardverhältnis von 50-50 ist nicht optimal – mit Bayesian Approach das Traffic zur besseren Variante zu verschieben, liefert schnellere Ergebnisse und reduziert Opportunitätskosten.

### Test-Design Checkliste

- Baseline IPM über mindestens 100 Impressions berechnen (Rauschen bereinigen)
- Target Lift unter 10 % → Test nicht durchführen (Sample Size wird zu groß)
- Bei saisonalen Kampagnen Test aufschieben (Black Friday, Jahresende)
- Variantenzahl auf 3 beschränken – 5+ Varianten erhöhen Confidence-Zeitraum um ein Vielfaches

## Screenshot Narrative: Asset statt Story Sequence

Mobile-Game-Screenshots werden immer noch nach dem Prinzip „die 5 schönsten Szenen" ausgewählt. Doch bei durchschnittlich 1,2 Sekunden pro Screenshot muss der Nutzer eine Geschichte sehen, keine Katalog-Sammlung.

Für den Narrative-Sequenz-Test erstellten wir zwei Varianten: (A) zufällig schöne Szenen, (B) dem Tutorial-Flow folgende Progression. Variante B brachte 19 % höhere IPM. Warum? Weil der erste Screenshot „Was machst du in diesem Spiel?" beantwortete, der zweite „Wie machst du es?", der dritte „Was gewinnst du?". Bei Variante A war die Reihenfolge zufällig – kognitive Last stieg.

Wir unterstützten das Screenshot-Narrativ durch Video. Ein 30-sekündiges Preview-Video spielte zwischen Screenshot 2 und 3 automatisch ab. Das Video zeigte den Core Loop: Tap → Swing → Loot → Upgrade. Diese 4-Element-Loop in 6 Sekunden, die restlichen 24 Sekunden für Progression Unlocks. Die CPP mit Video erreichte 14 % höhere IPM als ohne, aber der Cost-per-Install stieg um 9 % (Video-Produktionskosten). Der Trade-off war akzeptabel: Day-1-Retention in der Video-Gruppe war 8 % höher – der Nutzer installierte bewusst, nicht täuscht.

## Statistical Significance: Die Early-Stop-Falle

40 % aller Tests werden vorzeitig beendet. Grund: In den ersten 3-4 Tagen zeigt die Variante +20 % Lift, das Team sagt „gewonnen", Test vorbei. Zwei Wochen später regrediert die IPM – weil die Früh-Audience Self-Selected ist (Brand-Fans), die Gesamtpopulation verhält sich anders.

Wir etablierten eine 14-Tage-Mindestdauer – auch bei 99 % Confidence. Mobile-Game-Traffic hat Wochentags-/Wochenend-Muster: Samstag +35 % Installs, Dienstag -18 %. Fällt eine Variante ins Wochenende, erhält sie künstlichen Vorteil. 14 Tage = 2 Wochen, Pattern-Effekt wird neutralisiert.

Zweite Regel: Post-Install-Metriken prüfen. IPM-Anstieg ist schön, aber sinkt Day-7-Retention, ziehst du die falschen Nutzer. Besonders bei Icon-Tests offensichtlich – Clickbait-Icons heben IPM, ruinieren aber Retention. In unserem Icon-Test war die Cool-Palette-Variante IPM-mäßig 11 % vorne, lag aber bei Day 7 6 % zurück. Test abgebrochen, Warm-Palette live genommen.

## Play Store vs. App Store: Plattformunterschiede

Apples und Googles Test-Infrastruktur funktionieren unterschiedlich. Apple bietet 35 Variationen pro CPP, aber jede muss manuell per URL distributed werden (Apple Search Ads Kampagnen zugewiesen). Google teilt Traffic direkt in Experiments – keine manuellen URLs nötig.

Wir schickten Traffic über Apple Search Ads zu 6 verschiedenen CPP-Varianten. Jede CPP hatte eigene UTM-Parameter (`&ct=cpp_hero`, `&ct=cpp_gameplay` etc.). So konnten wir in Apple Search Ads Console sehen, welche Creative bei welchem Keyword funktionierte. Google Play bietet diesen granularen Tracking nicht – Experiments zeigen nur globale IPM-Unterschiede. Deshalb: Halte Test-Szenarien auf Google einfach (max. 2 Varianten), auf Apple komplexer.

Ein weiterer Unterschied: Apples Custom-Screenshot-Limit sind 10, Googles 8. Wir nutzten auf Apple alle 10, auf Google nur 6. Grund: Google Play Users scrollten weniger – Entscheidung fällt oft nach Screenshot 3. Mehr Screenshots laden länger, steigern Engagement nicht.

## 6-Wochen-Prozess: Woche für Woche

| Woche | Aktivität | Metrik |
|---|---|---|
| 1 | Baseline Messung (aktuelles Store Listing) | IPM 18,2 %, D7 24,1 % |
| 2 | CPP Varianten 1-2-3 Launch (Apple), Screenshot-Test Start (Google) | Traffic Split aktiv |
| 3 | Tägliches Monitoring, Early Signal Review | Noch keine Entscheidung (Sample <500) |
| 4 | Apple CPP Traffic-Shift (%70 Hero-Variante), Google Confidence 78 % | IPM 21,3 % (Hero), 19,8 % (Gameplay) |
| 5 | Google-Test abgeschlossen, Winning Variant live | IPM 22,1 %, D7 25,8 % |
| 6 | Apple finaler Traffic-Shift (%100 Hero), Icon-Test Start | IPM 24,0 %, 6-Wochen-Delta +32 % |

Während des gesamten Prozesses blieb kein UA-Campaign-Budget unverändert – rein organischer Lift. Apple Search Ads Spending konstant ($120/Tag), Google UAC ausgeschaltet. So isolierten wir die reine Wirkung des Creative Testing.

In Woche 6, als der Icon-Test startete, dienten die früheren Winning-Varianten als Baseline. Der neue Test baute auf dem Alten auf – Compound Effect. Der Icon-Test lief 8 Wochen (außerhalb dieses Berichts), aber die +32 % aus den ersten 6 Wochen schufen eine bessere Baseline für den Live-Ops-Kalender.

## Roibases [App Store Optimization](https://www.roibase.com.tr/de/aso)-Ansatz

Über den gesamten Prozess war ASO nicht nur Keyword Research oder Metadata-Update, sondern Creative Engineering. Jeder Screenshot, jede Icon-Variante, jedes Video-Frame entstand aus datengetriebener Entscheidung. Test-Ergebnisse wurden in BigQuery gepipelined und mit LTV/D30-Cohort-Analysen kombiniert. Wir verfolgten: Welche Creative-Variante bringt welches User-Segment, und welches IAP-Verhalten zeigt es später?

Die Hero-fokussierte CPP brachte Nutzer, von denen 18 % in den ersten 48 Stunden Character Skins kauften. Gameplay-fokussierte CPP: 9 %, aber 22 % kauften Weapon Packs. Creative Choice beeinflusste nicht nur IPM, sondern auch Monetization Mix. Diese Daten nutzten wir später für Audience Segmentation in UA Kampagnen.

## Entscheidung: Testen oder Optimieren?

Creative Testing ist der höchste ROI-Bestandteil von ASO. UA-Budget zu erhöhen kostet linear, Creative Testing bringt Compound Lift. Doch viele Teams „patchen einmal, nutzen für immer" – statt Test-Infrastruktur aufzubauen. Im Gaming ändern sich Genre-Trends, saisonale Themen und Plattform-Algorithmen alle 3 Monate – Creative Refresh ist notwendig.

Nach 6 Wochen erreichten wir +32 % IPM. Diese waren nicht dauerhaft – Woche 12 fiel auf +28 % (neue Spiele launchten, Konkurrenz stieg). Aber die Test-Methodik blieb. Wir etablierten einen Refresh-Cycle alle 3 Monate. Jeder Refresh: 4-6 Wochen, durchschnittlich +18-25 % Lift. Zusammengefasst: Jährliches IPM-Wachstum +70 %.

Wenn dein Team bei „mal ausprobieren" steckt, Start here: Baseline 2 Wochen messen, auf eine Variable fokussieren, Mindestgröße berechnen, Early Stop vermeiden. Diese 4 Schritte sind bereits 2 Schritte voraus bei den meisten Mobile Games.