---
title: "Apple Search Ads: Kampagnenbau mit Funnel-Logik"
description: "Discovery, Competitor, Brand und Broad Match — Strukturieren Sie Ihre Apple Search Ads Architektur nach Funnel-Prinzipien und optimieren Sie den Budgetfluss mit Engineering-Ansätze."
publishedAt: 2026-07-29
modifiedAt: 2026-07-29
category: gaming
i18nKey: gaming-005-2026-07
tags: [apple-search-ads, asa-funnel, mobile-growth, app-kampagnen, aso]
readingTime: 9
author: Roibase
---

Eine einzige Kampagnenart bei Apple Search Ads führt dazu, dass unterschiedliche Phasen der Nutzer­reise in einem Budgetpool zusammenfließen. Ein Nutzer im Discovery-Modus und ein Nutzer mit etablierter Brand-Recherche haben völlig unterschiedliche Kosten, Intent und Konversions­dynamiken. Wenn Sie die Kampagnen­architektur nach Funnel-Prinzipien strukturieren, erhalten Sie für jede Phase eigene Budget-Disziplin und können post-install Metriken (D7 Retention, LTV) pro Kampagnen­typ auslesen. In diesem Artikel zeigen wir, wie Sie Apple Search Ads in Discovery-, Competitor-, Brand- und Broad-Match-Schichten unterteilen und den Budget­fluss steuern.

## Welche Frage stellt der Nutzer im Discovery-Modus?

Discovery-Kampagnen sind Apples automatischer Expansions­mechanismus — Apples Algorithmus exponiert Ihre App über hunderte Suchanfragen hinweg, basierend auf Kategorie, Nutzer­verhalten und semantischen Matches. In diesem Modus sucht der Nutzer keine spezifische App; er hat ein breiteres Bedürfnis wie „tower defense game". Impressionen sind hoch, TTR niedrig, CPA verhältnismäßig günstig — aber D7 Retention kann bei 15–20 % landen. Discovery ist kein Brand Awareness Play, sondern ein Test des breiten Pools potenzieller Intent-Träger.

Sie können Search Match nicht einfach deaktivieren und ein vollständig kontrolliertes Discovery-Becken erzeugen — Apple hält das standardmäßig offen. Ihre Strategie sollte sein: Discovery-Traffic in eine separate Kampagne isolieren und die Bid-Strategie von einem CPA-Ziel auf ein Impression-Share-Ziel verlagern. Wenn Sie 60 % Impression Share bei 500 täglichen Installs und 18 % D7 Retention erreichen, müssen Sie diese Nutzer in den ersten 7 Tagen durch Push Notifications und In-App-Onboarding-Sequenzen verdichten. Discovery ist die oberste Ebene des Funnels — hier betreiben Sie Hypothesis Testing, nicht User Acquisition.

Budget-Disziplin: Weisen Sie Discovery 25–30 % Ihres Gesamt-ASA-Budgets zu, aber setzen Sie den CPA-Cap auf das 2x des Brand-Kampagnen-Ziels. Discovery-Installs können 2x teurer sein als Brand-Traffic, aber mit niedrigerem LTV ist dieser Unterschied nicht akzeptabel — wenn Discovery-CPA das 2,5x von Brand übersteigt, sollten Sie die Kampagne pausieren oder das Bid aggressiv senken.

### Search-Match-Keyword-Report mit Cohort-Analyse fusionieren

Exportieren Sie die Search-Match-Keyword-Liste aus Ihrer Discovery-Kampagne wöchentlich und lesen Sie für jeden Keyword-Cluster (z. B. „strategy game", „idle game") D7 Retention und ARPU separat in Ihrem MMP (Adjust, AppsFlyer) aus. Wenn ein Cluster 25+ % Retention liefert, verschieben Sie diese Keywords zu einer Exact-Match-Kampagne. Apples Search Term Report bietet nicht genug Granularität — Sie müssen das Keyword → Install → D7 Mapping selbst mit Custom Event Tracking durchführen. Das ist manuell, aber 1–2 Stunden monatliche Analyse kann 40 % des Discovery-Budgets zu effizienteren Kanälen verschieben.

## Competitor-Kampagnen: Bid-Verhalten und Legal Risk

Bei Competitor-Kampagnen zielen Sie auf branded Keywords konkurrierender Apps ab (z. B. „clash of clans", „candy crush"). Apple erlaubt diesen Traffic, aber Creative mit Marken­verletzungen blockiert es. Competitor-TTR liegt bei 5–8 % — wenn ein Nutzer eine Konkurrenz­app sucht und Ihre App sieht, klickt er zu 5–10 %. Die Strategie ist nicht aggressive Bidding, sondern smarte Creative-Rotation — wenn Ihre Creative die Kern­funktion der Konkurrenz-App besser darstellt (z. B. „schnellere Progression", „keine Paywall"), kann TTR auf 12 % steigen.

Der Grund für eine separate Competitor-Kampagne ist das unterschiedliche LTV-Profil. Nutzer aus Competitor-Traffic sind oft aus der Konkurrenz-App abgewandert oder suchen Alternativen — ihre D30 Retention kann 8–10 % höher sein als Discovery-Traffic, weil die Kategorie­affinität gesichert ist. Aber Early-Game IAP-Conversion ist niedrig — der Nutzer vergleicht. Budget Allocation: 20–25 % des Gesamt-ASA-Budgets, CPA-Cap das 1,5x von Brand. Wenn Competitor-CPA niedriger als Brand ausfällt, ist Ihr Konkurrent schwächer in Brand Equity — erhöhen Sie Competitor-Budget auf 35 %.

Legal Risk Management: Nach Apples Trademark Policy können Sie ein fremdes Trademark als Keyword nutzen, aber den Marken­namen nicht in der Creative nennen. Falls Ihr Konkurrent sich bei Apple beschwert, kann Ihre Kampagne suspendiert werden. Minimieren Sie dieses Risiko, indem Sie Competitor-Traffic auf 10–15 Keywords verteilen — enge Fokussierung erhöht Suspend-Risiko. Für jedes Competitor-Keyword ein separates Ad-Group. Checken Sie wöchentlich den Search Term Report und fügen Sie automatisch von Apple hinzugefügte Broad-Match-Varianten zu Negative Keywords hinzu.

## Brand-Kampagne: Verteidigungs­mechanismus als CPA-Arbitrage

Ihre Brand-Kampagne zielt auf Ihren App-Namen und Varianten ab (z. B. „roibase game", „roi base"). Hier ist das organische Listing bereits oben, aber Konkurrenten können auf Ihrem branded Keyword bieten — Sie müssen also auch auf Ihrer eigenen Marke bieten, sonst erscheint ein Konkurrent oben und stiehlt Ihren Install. Brand-TTR liegt bei 25–40 % — der Nutzer sucht Sie bewusst, der Click ist sicher. CPA ist die niedrigste hier, typischerweise ein Drittel des Discovery-CPA.

Budget Allocation: 30–35 % des Gesamt-Budgets für Brand, aber das Ziel ist nicht CPA minimieren, sondern Impression Share maximieren. Wenn Ihr Branded Keyword unter 85 % Impression Share liegt, schneiden Konkurrenten Ihren Traffic ab. Erhöhen Sie das Bid bis 95+ % Impression Share. Selbst wenn Brand-CPA 0,50 Dollar beträgt — das ist akzeptabel, weil dieser Nutzer Sie ohnehin organisch gefunden hätte; das Geld ist eine Versicherungsprämie gegen Konkurrenz-Blockade.

Deaktivieren Sie Search Match in der Brand-Kampagne. Apples automatische Erweiterung verwandelt branded Queries in generische und erhöht CPA. Verwenden Sie nur Exact Match und Close Variants. Bauen Sie die Ad Group auf ein einzelnes Keyword auf: Ihren App-Namen. Alle anderen generischen Keywords gehen in Discovery oder Broad Match. Der Custom Product Page der Brand-Kampagne sollte auf den Onboarding Flow fokussiert sein — dieser Nutzer kennt Sie bereits, Sie müssen keine kreative Geschichte erzählen.

## Broad-Match-Kampagne: Kontrollierte Expansion im Sandbox-Modus

Broad Match ist eine Schicht zwischen Discovery und Brand — Sie wählen spezifische Keywords, aber Apple darf sie über Broad-Match-Varianten erweitern. Das Keyword „tower defense" wird zu „best tower defense", „tower defense offline", „td games" etc. Der Vorteil: kontrollierte Expansion — nicht komplett autopilot wie Discovery, aber Sie setzen die Grenzen.

Der Grund für separate Broad-Match von Discovery ist Budget-Kontrolle. Discovery kann überall hingehen, Broad Match hat Grenzen, die Sie ziehen. Budget Allocation: 15–20 %. Strategie: Nehmen Sie Keywords, die in Discovery und Competitor gut performen, und verschieben Sie sie zu Broad Match. Testen Sie 2 Wochen. Wenn Broad-Match-CPA 20+ % unter Discovery liegt, verschieben Sie das Keyword zu Exact Match. Broad Match ist hier ein „Staging"-Layer — Keywords werden getestet, bevor sie vollständige Kontrolle erhalten.

Bei Broad Match ist Negative Keyword Disziplin kritisch. Apples Erweiterungen können völlig irrelevante Queries enthalten (z. B. „tower defense" → „tower building game"). Gehen Sie wöchentlich den Search Term Report durch, und fügen Sie Keywords mit CTR unter 1 % oder CPA über 2x Ihrem Ziel zu Negative Keywords hinzu. Das ist manuell, aber 15 Minuten wöchentliches Housekeeping kann 30 % des Broad-Match-Budgets freigeben.

### Funnel-Fluss mit Bid-Multiplier-Strategie straffen

Apple Search Ads hat kein Demographic Targeting, aber Device und Location Targeting. Erstellen Sie für jeden Kampagnen­typ eine separate Bid-Multiplier-Tabelle. Beispiel: In Discovery senken Sie das Bid in Tier-2-Geos (Brasilien, Indien) um 40 %, weil diese Nutzer die Hälfte des LTV von Tier-1 haben. In Brand halten Sie das Bid auch in Tier-2 voll — dieser Nutzer sucht Sie bereits, er ist qualifiziert. Für Broad Match erhöhen Sie das Bid für iPad-Nutzer um 20 % — Tablet-Session-Time ist 35 % länger, IAP-Conversion 18 % höher (App Annie 2025 Daten).

Wenden Sie Dayparting pro Kampagnen­typ an. Discovery und Broad Match laufen 09:00–23:00, nachts aus. Brand läuft 24/7 — wenn Konkurrenten nachts auf Ihrem branded Keyword bieten, müssen Sie auch verteidigen. Wenn Sie Ihre Metadata mit [App Store Optimization](https://www.roibase.com.tr/de/aso) straffen und Ihr organisches Ranking stärken, sinkt die Brand-Kampagnen-Kosten — ASO funktioniert hier als Verteidigungs­mauer.

## Budget-Fluss mit Closed-Loop Attribution steuern

Nachdem Sie die Funnel-Architektur aufgebaut haben, lesen Sie jeden Kampagnen­typ's post-install Events separat in Ihrem MMP aus. Wenn Discovery D7 Retention von 18 %, Competitor 26 %, Brand 42 % hat, muss Ihre Budget-Verteilung überarbeitet werden. Einfaches Modell: Verteilen Sie Ihr Gesamt-Budget nach LTV/CPA-Ratio. Wenn Brand-Kampagne 4,2 LTV/CPA und Discovery 1,8 hat, weisen Sie Brand 2,3x mehr Budget zu.

Warten Sie nicht 90 Tage auf LTV — nutzen Sie D7 Retention und D1 ARPU als Leading Indicators. Wenn ein Kampagnen­typ 30+ % D7 Retention hat, erhöhen Sie die LTV-Schätzung um das 3x. Automatisieren Sie dies, indem Sie Ihr MMP zu BigQuery verbinden und tägliche Cohort-Analysen laufen lassen. Ein einfaches Linear Regression Model in Python — 15 Zeilen Code — prognostiziert D90 LTV aus D1 und D7 mit 82 % Accuracy (in unseren Tests).

Creative-Rotation-Disziplin pro Kampagnen­typ: Discovery und Broad Match alle 10 Tage wechseln, Brand 30 Tage gleich halten. Discovery-Nutzer kennen Sie nicht, Creative-Tests sind sinnvoll. Brand-Nutzer haben entschieden, Creative-Wechsel wirkt sich nur 2–3 % auf TTR aus. Competitor-Kampagne: Benchmarken Sie gegen die letzte Konkurrenz-Kampagne und aktualisieren Sie Ihre Creative wöchentlich — das ist ein agiler Prozess.

Apple Search Ads nach Funnel-Prinzipien architek­turieren gibt Ihnen Isolierung und Optimierung jeder Phase. Discovery-Feinrausch-Test, Keywords nach Performance zu Broad Match und Exact Match schieben, Competitor-Traffic separat mit Budget-Disziplin managen, Ihre Marke gegen Konkurrenten verteidigen. Budget-Fluss mit post-install Metriken (D7, LTV) schließen und jeden Kampagnen­typ's echten ROI in Echtzeit auslesen. Eine ungebohrte ASA-Struktur erodiert unterschiedliche Intent-Level in den gleichen Pool und verschleudert Budget zu schwachen LTV-Segmenten — mit dieser Architektur reduzieren Sie diese Verluste um 30–40 %.