---
title: "Apple Search Ads: Kampagnien als Funnel-Architektur aufbauen"
description: "Strukturierter Leitfaden zum Aufbau von Discovery-, Competitor-, Brand- und Broad-Match-Kampagnen als Funnel-Schichten mit optimiertem Budgetfluss."
publishedAt: 2026-07-15
modifiedAt: 2026-07-15
category: gaming
i18nKey: gaming-005-2026-07
tags: [apple-search-ads, aso, mobile-growth, funnel-architecture, campaign-structure]
readingTime: 9
author: Roibase
---

Apple Search Ads als isolierte Kampagnentypen zu verwalten ist ein fundamentales Fehler in der Mobile-Gaming-Welt. Stattdessen sollten Sie Discovery-, Competitor-, Brand- und Broad-Match-Kampagnen als verflochtene Funnel-Schichten konstruieren, in denen jede Kampagnenstufe der darunter liegenden Signale sendet und von der darüber liegenden Qualität empfängt. Bis Mitte 2026 verwaltet die Mehrzahl der Mobile-Gaming-Teams ihre Kampagnen isoliert — und verliert dadurch 30–40 % Effizienzgewinne bei den CPT-Metriken. Dieser Leitfaden zeigt Ihnen, wie Sie Ihre Kampagnenarchitektur nach Funnel-Logik strukturieren, den Budgetfluss nach verlässlichen Signalen lenken und warum die ASO-Integration kritisch ist.

## Funnel-Logik: Jeder Kampagnentyp sitzt in einer anderen Schicht

Apple Search Ads umfasst vier Basis-Kampagnentypen: Discovery (Search Tab), Competitor (Rivalmarken-Suchanfragen), Brand (eigene Markensuchanfragen) und Broad Match (breite Kategorietermen). Statt diese isoliert zu sehen, denken Sie hierarchisch: Discovery sitzt oben und fängt Nutzer ohne Markenbewusstsein. Broad Match in der Mitte mit vorhandenem Intent-Signal, aber hohem Wettbewerb. Competitor enger, mit qualifiziertem Nutzer, der die Rivale gespielt hat. Brand unten — der Nutzer kennt Sie bereits. Umkehrung dieser Hierarchie zerstört die Budgetverteilung. Beispiel: Wenn Sie 60 % zum Brand-Budget geben, generieren Sie Conversions, aber Sie wachsen nicht. Umgekehrt, wenn Sie 70 % zu Discovery geben, sinkt CPT, aber D7-Retention kollabiert, weil kalter Traffic die Conversion-Funnel ungefiltert passiert.

In der Funnel-Logik sendet jede Schicht Signale nach oben. Wenn Discovery-Nutzer D7-Retention über 12 % erreichen, schreiben Sie ihr Segment-Profil als Negative-Keyword-Liste in Broad Match — dadurch wird Broad Match präziser. Wenn Competitor-Kampagne unter 8 % IPM fällt, paart sich Ihr Nutzer-Profil nicht mit der Rivalen-Basis, schalten Sie ab. Wenn Brand-CPA plötzlich 40 % steigt, ist das ASO-Signal — nicht Kampagnen-Signal. Ihr App-Store-Ranking ist gefallen; beheben Sie [App Store Optimization](https://www.roibase.com.tr/de/aso), nicht Budget. Diese Signale verschwinden, wenn Sie kampagnenweise arbeiten.

Budgetfluss folgt derselben Logik. Discovery startet bei 40–50 %, weil es Ihren Nutzer-Pool füllt. Nach 3–4 Wochen, wenn Retention-Profile stabil sind, verschieben Sie zu: Discovery 30 %, Broad Match 30 %, Brand 15–20 %. Brand bleibt konstant, weil bekannte Marken-Nutzer billig kommen, aber volumenarm sind. Competitor ist optional — in Tier-1-Märkten (USA, UK) 10–15 %, in Emerging Markets (Lateinamerika, SEA) überflüssig, weil Marken-Bewusstsein niedrig ist.

## Discovery-Kampagnen: Kalter Traffic als Testlabor

Discovery-Kampagnen laufen auf dem Search Tab. Der Nutzer öffnet das Game, und im unteren Bereich sieht er „Das könnte dir gefallen"-Vorschläge. Intent ist schwach — der Nutzer sucht vielleicht nicht mal nach Ihrer Kategorie. Daher ist das Ziel hier nicht Install-Volumen, sondern Nutzer-Segment-Profil. Nutzen Sie Discovery als A/B-Test-Arena: setzen Sie 4–5 unterschiedliche Creative-Sets ein (mit Custom Product Pages), exponieren Sie jede 1 Woche lang 5000 Impressions, cross-checken Sie IPM + D1-Retention. IPM unter 4 % ist automatisch Ablehnung. IPM zwischen 6–8 %, aber D1-Retention unter 35 % = misleading Creative — ändern Sie die End-Game-Szene.

Das Budget-Prinzip für Discovery: erste 2 Wochen aggressiv spenden (50 % des Gesamt-Budgets), dann auf 30 % zurückfahren sobald Daten stabil sind. Nie komplett einstellen — Sie brauchen kontinuierlich kalte Segment-Daten für Broad Match und Competitor. Apples Machine Learning in Apple Search Ads stabilisiert sich in 72 Stunden — d.h. nach 3 Tagen ist Ihre CPA-Plateau erreicht. Wenn Sie am Tag 5 noch Volatilität sehen, ist Ihr Targeting zu weit — fügen Sie Age/Gender/Geography-Filter ein.

Bei Discovery verwenden Sie keine Keywords — Apple matched automatisch. Aber Negative-Keywords können Sie setzen, besonders für Rivalen-Game-Typen (wenn Ihr Game Match-3 ist, setzen Sie „Battle Royale" negativ). Ein Fallstrick: Apple macht auch kategorie-basierte Empfehlungen. Wenn Ihr Game in „Casual" kategorisiert ist, aber Mechanik näher an „Puzzle" ist, haben Sie ASO-Metadaten falsch gesetzt. Hier nicht die Kampagne anpassen — ASO auditieren: Kategorie korrigieren + Subtitle optimieren. Wenn Discovery-Performance niedrig ist, erste Aktion ist ASO-Audit, nicht Budget-Erhöhung.

## Competitor und Broad Match: Qualitätsfilter und Budget-Dynamik

Competitor-Kampagnen ergeben Sinn nur in Tier-1-Märkten. In der Türkei, Brasilien, Indonesien haben Nutzer niedriges Marken-Bewusstsein und suchen nach generischen Kategorietermen, nicht Rivalen-Namen. In den USA suchen 1 Million Menschen nach „Candy Crush", in der Türkei 50.000 — daher ist Competitor-Budget in der Türkei ROI-negativ. In Tier-1-Märkten: halten Sie Competitor eng — nur 3–5 direkte Rivalspiele. Jedes Keyword muss TTR (Tap-Through Rate) minimum 5 % haben; darunter kann Ihr Creative die Rivalen-Basis nicht anziehen — Icon + Screenshot-Set wechseln.

Bei Competitor ist die Bid-Strategie aggressiv: bis zu 120 % Ihres maximalen CPA. Weil Rivalen-Nutzer qualifiziert ist (hat ähnliches Game gespielt). Aber nach 2 Wochen: LTV/D30 messen — wenn Nutzer aus Rivale 15 % niedriger Retention hat, paart sich das Segment nicht mit Ihrer Game-Mechanik, schalten Sie ab. Häufiger Fehler: „Wenn die Rivalin groß ist, funktioniert ihre Basis auch bei mir." Falsch — „PUBG Mobile"-Nutzer und „Among Us"-Nutzer sind völlig unterschiedlich, auch wenn beide im selben „Battle Royale"-Genre sind.

Broad Match umfasst Kategorietermen: „puzzle game", „strategy rpg", „idle game". Hier ist Keyword-Matching steuerbar. Start: Broad offen, nach 1 Woche Search-Terms-Report ziehen, irrelevante Terme negativ setzen. Beispiel: Ihr Game nutzt „merge"-Mechanik, aber Broad Match bringt „Match-3"-Anfragen — setzen Sie „Match-3" negativ. Broad Match Budget sollte 25–35 % sein — mehr, und Sie verteilen Discovery-Segment-Intel ungenutzt; weniger, und Sie erreichen nicht genug Volumen.

## Brand-Kampagne: Verteidigung und ASO-Health-Signal

Brand-Kampagne zielt auf Ihren Game-Namen ab. „Aber wir rangieren bereits Platz 1 organisch — brauchen wir bezahlte Kampagne?" Falsche Frage. Selbst wenn Sie organisch Platz 1 sind, können Rivalen Ihre Marke in Search Ads bieten — „[Ihr Game]" wird angesucht, Rivalin erscheint. Brand-Kampagne schützt, dass dieser Traffic Sie behält. Außerdem ist CPA hier niedrigst (oft 1/5 von Discovery), daher ROI von 15–20 % Budget positiv.

Brand-Kampagnen zweiter Zweck: ASO-Health-Signal. Wenn Brand-CPA plötzlich ansteigt (z.B. +30 % in 2 Wochen), ist Ihr organisches Ranking gefallen. Daher sehen Sie weniger organisch, Nutzer klickt Ihre Search-Ads-Brand-Kampagne mehr, Apple rechnet mehr ab. Hier können Sie nicht Kampagnen-Optimierung nutzen — ASO-Metadaten (Keyword-Dichte, Subtitle, IAP-Namen) und Rating/Review-Management beheben das. Brand-Kampagne als „Früh-Warnsystem" verwenden.

Bid für Brand-Keyword sollte aggressiv sein: bis 150 % Ihres maximalen CPA. Weil auch Rivalen auf Ihre Marke bieten, entsteht Bid-Krieg, verlieren Sie Traffic. Viele Teams zahlen Brand-Kampagne niedriges Bid — „Ich komme sowieso organisch" — das funktioniert nur ohne Wettbewerb. In Tier-1-Märkten: Wettbewerb existiert immer, Brand-Kampagne ist aktive Verteidigung, nicht passiv.

## Budget-Flow-Szenario: 4-Wochen-Pilot

Szenario: $15.000 Budget in 30 Tagen, neues Idle RPG, USA-Markt. Woche 1: Discovery 50 % ($1875), Broad Match 25 % ($937), Brand 20 % ($750), Competitor 5 % ($187). Competitor niedrig, da noch kein Segment-Profil. Erste 7 Tage: 2500 Installs aus Discovery, D1-Retention messen — 32 % heraus. D7 wartet 1 Woche.

Tag 14: D7-Retention 18 % (für Idle RPG akzeptabel). Discovery-Nutzer: 60 % Männer 25–34, 30 % Frauen 18–24. Dieses Profil als Age/Gender-Filter zu Broad Match. Budget-Revision: Discovery 35 %, Broad Match 35 %, Brand 20 %, Competitor 10 %. Weil jetzt Segment-Profile vorhanden, Broad Match wird präziser.

Tag 21: Competitor 150 Installs, aber D1-Retention 22 % — 10 % unter Discovery. Segment passt nicht. Competitor ausschalten, 10 % zu Broad Match. Letzte Woche: Discovery 30 %, Broad Match 45 %, Brand 25 %. Diese Verteilung stabilisiert sich. Nach 30 Tagen: 7200 Installs insgesamt, Blended CPA $2,08, D30-Retention 9,5 % — solide Tier-1-Idle-RPG-Baseline.

## Messung und Iteration: Auf welche Signale Sie achten

Nach Architektur-Setup läuft Messung auf 3 Ebenen: Kampagnen-Ebene (CPA, IPM, TTR), Funnel-Ebene (D1/D7/D30-Retention), ökonomisch (LTV/CAC). Jeder Kampagnentyp hat eigene Kriterien. Discovery: IPM + D1-Retention genug, LTV nicht nötig (kalter Traffic). Broad Match: D7-Retention kritisch — unter 15 % nicht akzeptabel. Competitor: TTR Priorität — unter 5 % = schwaches Creative. Brand: CPA-Anstieg = ASO-Alarm.

Wöchentlicher Iterations-Loop: Montag morgens: Kampagnen-Metriken ziehen (Apple Search Ads Console), Retention-Daten von MMP (Adjust, AppsFlyer), LTV-Projektion von BI-Dashboard. Freitag: Entscheidungen — welche Creative-Sets schließen, welche Keywords negativ, welche Kampagne Budget erhöht. Alle zwei Wochen: größere Strategie-Shifts — Funnel-Budget-Allokation, neuer Markt-Test, ASO-Metadata-Update.

Fallstrick: Apple Search Ads varnt Sie ständig „erhöhen Sie Budget". Nicht jedes Mal erhöhen. Erst prüfen: verbrauchen Sie 100 % des aktuellen Budgets? Unter 80 % = unzureichendes Targeting. Über 95 % + CPA im Target = erhöhen, aber maximal 20 % — abrupte Anstiege zerstören Machine Learning.

## ASO-Integration: Kampagnen-Metadaten müssen gefüttert werden

Apple Search Ads läuft nicht isoliert von ASO. Kampagnen-Metadaten (Icon, Screenshot, Subtitle, Promotional Text) stammen direkt aus Ihrer App-Store-Seite. Wenn Discovery-IPM niedrig, aber Competitor hoch ist, ist Ihr Icon generisch — Rivalen-Nutzer hat bereits Intent, kauft trotz schwachem Icon. Kalter Traffic (Discovery) schaut Icon an, wenn nicht interessant, scrollt. Custom Product Pages (CPP) sind Lösung. Apple lässt Sie jetzt jeder Kampagne andere CPP zuordnen. Discovery: kühner, animierter Screenshot-Set. Brand: minimal, Logo-forward. Competitor: Vergleich mit Rivalin (richtlinienkonform). Ohne diese Differenzierung läuft eine Metadata über alle Kampagnen, Conversion-Funnel ist nicht optimiert. [App Store Optimization](https://www.roibase.com.tr/de/aso) muss parallel zu Kampagnen-Architektur strukturiert werden.

ASO-Metadata alle 4–6 Wochen überarbeitet — Keyword-Dichte, Apple-Algorithmus-Änderungen, Rating/Review-Management reduziert Churn, IAP-Namen werden getestet. Diese Änderungen beeinflussen direkt Kampagnen-Performance. Beispiel: Sie ändern Subtitle von „merge" zu „build", 1 Woche später steigt „build game"-Anfrage in Broad Match — Sie müssen dieses Keyword manuell einführen. ASO und Search Ads müssen vom selben Team in derselben Sprint verwaltet werden.

## Fazit: Architektur ist nicht einmalig, sondern dynamisches System

Kampagnen-Architektur als Funnel ist kein einmaliger Setup.