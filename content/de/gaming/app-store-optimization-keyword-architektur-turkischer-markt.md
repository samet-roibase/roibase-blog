---
title: "App Store Optimization: Keyword-Architektur für den türkischen Markt"
description: "ASO-Keyword-Strategie für Türkisches Mobile-Gaming. Lokalisierung, Voice-Search-Spezifikationen und App Store-Algorithmus-Dynamiken erklärt."
publishedAt: 2026-06-14
modifiedAt: 2026-06-14
category: gaming
i18nKey: gaming-004-2026-06
tags: [app-store-optimization, turkischer-markt, keyword-recherche, mobile-gaming, aso-strategie]
readingTime: 9
author: Roibase
---

Der türkische Mobil-Gaming-Markt erreichte 2026 eine Größe von 1,2 Milliarden Dollar. Im App Store Türkei-Kategorien werden täglich durchschnittlich 47 neue Spiele veröffentlicht. In diesem chaotischen Ökosystem stammen 83 % der organischen Entdeckbarkeit aus Suchergebnissen. Ohne türkischsprachige Keyword-Architektur bleibt Ihr Spiel — abgesehen vom Category-Browsing-Traffic — unsichtbar. Dieser Artikel erklärt die Mechanik des ASO-Keyword-Aufbaus speziell für den türkischen Markt.

## Türkische Wort-Dynamik in der iOS-Suche

Apple Search Ads ist seit 2024 in der Türkei aktiv, aber der Algorithmus befindet sich noch in der Phase der Anpassung englischer Stemming-Regeln an das Türkische. Resultat: „savaş" (Krieg) und „savaşmak" (kämpfen) werden als unterschiedliche Keywords behandelt, aber „oyun" (Spiel) und „oyunu" (das Spiel) verschmelzen oft. Der „search terms"-Datenfluss in App Store Connect zeigt eine Zuverlässigkeitsrate von nur 31 % in den letzten 12 Monaten. Mit anderen Worten: Bei einer von drei Suchen meldet das System nicht, welche exakte Query zu einer Konversion führte.

Türkische Zeichen (ü, ş, ğ) versus ASCII-Suchanfragen (z.B. „savas" statt „savaş") werden in separaten Clustern verfolgt. Nach Daten von Q4 2025 verwenden 18 % der türkischen iOS-Nutzer die Tastatur im Englisch-Modus und schreiben türkische Spieleanfragen mit ASCII-Zeichensätzen. Das bedeutet: Wenn Sie auf das Keyword „macera oyunu" (Abenteuer-Spiel) abzielen, müssen Sie „macera oyunu" + „maceraoyu" + „macera oyun" + potenzielle Tippfehler wie „macera oyn" überwachen.

Apples türkisches NLP-System führt noch keine vollständige Morphem-Analyse durch. Root-Word-Extraktion funktioniert nicht wie im Englischen. Beispiel: „koşmak" (laufen) und „koşucu" (Läufer) sind zwei unterschiedliche Begriffe. Daher müssen Sie das Keyword-Feld mit sowohl Infinitiv als auch Nominalformen füllen. Mit der 100-Zeichen-Begrenzung können Sie dies optimieren, indem Sie leerzeichen­lose Strings verwenden: etwa „savaşsavaşmakmaceramaceracı". Das System parst auch ohne Space-Delimiter.

## Jenseits von Lokalisierung

Die meisten Entwickler verstehen unter „Lokalisierung" nur die Übersetzung von App-Texten. Aus ASO-Sicht ist das 40 % der Arbeit. Die restlichen 60 % bestehen aus marktspezifischer Keyword-Nachfrage-Kartierung. In der Türkei wird nach „bulmaca" (Rätsel) gesucht, nicht „puzzle". Der Begriff „match-3" wird direkt verwendet. „Casual game" wird als „eğlence oyunu" oder „basit oyun" gesucht. Diese Begriffe müssen Sie mit bezahlten ASO-Tools (AppTweak, Sensor Tower, data.ai) validieren — nicht mit Google Trends oder App Store Suggest, da Apple Autocomplete auf Türkisch irreführend ist.

Die [App Store Optimization](/de/aso)-Methodik von Roibase folgt diesen Schritten: Zunächst Reverse-Engineering der Konkurrenz-Keywords (APIs verwenden, um zu sehen, in welchen Begriffen ähnliche Spiele ranken), dann monatliches Suchvolumen und Schwierigkeitsscore berechnen, danach die aktuelle Rank-Position als Baseline festlegen. Wenn Sie ein Keyword mit monatlich 5000+ Suchvorgängen nicht in den Top 10 finden, machen Sie es nicht zu Ihrem primären Ziel. Treten Sie zunächst in Long-Tail-Keywords mit 50–100 Suchvorgängen in die Top 5 ein, senden Sie Signale an den Algorithmus, und wechseln Sie dann zu stärker umkämpften Head Terms.

Türkei-spezifisches Verhalten: Category-Browse-Traffic ist niedrig, Such-Traffic ist hoch. Wenn Nutzer den App Store öffnen, klicken sie nicht auf den Tab „Featured", sondern auf „Search" (laut 2025er Analytics: 64 % der ersten Klicks gehen zur Suche). Das bedeutet, dass auch Ihr Untertitel und Text-Overlays in Screenshots Such-Keywords enthalten sollten. Apples OCR-System indexiert Text in Screenshots, aber das Gewicht ist niedrig. Die echte Kraft liegt im Trio App-Name + Untertitel + Keyword-Feld.

### Voice-Search-Effekt

Die Siri-Nutzungsrate in der Türkei ist niedrig (7 %), steigt aber. Bei Voice-Search verwenden Nutzer unterschiedliche Satzstrukturen: „bana savaş oyunu öner" (empfehle mir ein Kriegsspiel) statt schriftlich „savaş oyunu". Apple entfernt Stoppwörter („bana", „öner") und konzentriert sich auf Kernbegriffe („savaş", „oyunu"). Für Conversational Queries brauchen Sie keine separate Keyword-Strategie, aber wenn Sie in der App-Beschreibung natürlichsprachliche Sätze verwenden, signalisieren Sie dem Such-Algorithmus zusätzliche Relevanz. Schreiben Sie eher „Strategie-Spiel für Spieler, die Taktik lieben" als „Dieses Spiel spricht Strategie-Liebhaber an".

## Metadaten-Schicht-Optimierung

App-Name und Untertitel zusammen: 55 Zeichen (30 + 25). Türkische Wörter sind durchschnittlich 6,2 Zeichen lang (Englisch: 5,1), was Platzprobleme schafft. In den ersten 30 Zeichen sollten Marke + Kern-Mechanik + Genre stehen. „Savaş Klanları: Strateji Savaş Oyunu" (Kriegs-Clans: Strategie-Kriegsspiel) ist ein gutes Format. Im Untertitel: Sekundär-Keyword + Unique Value Prop: „Echtzeit-PvP-Taktik".

Keyword-Feld: 100 Zeichen. Apples Empfehlung ist, Kommas als Trennzeichen zu verwenden, aber für Türkisch ist eine leerzeichen­lose Zeichenkette effizienter. Testen Sie dieses Format: „strategiesavaşpvpmmotaktikorduklankalefehrlpgaktion". Das System kann dies parsen und behandelt jedes Wort als separates Keyword. Das Hack hat aber Grenzen: Wenn zwei Wörter kombiniert ein anderes türkisches Wort ergeben (z.B. „kale" + „savaş" = „kalesavaş", das potenziell verwirrend ist), kann das System verwirrt werden. Manuelle Tests erforderlich.

Wird der Promotional Text (170 Zeichen) indexiert? Apples offizielle Dokumentation sagt „nein", aber Tests von 2025 zeigten schwache Auswirkungen von Keywords im Promotional Text auf Such-Impressionen. Nicht eindeutig, aber harmlos. Streuen Sie dort auch sekundäre Keywords ein.

| Metadaten-Feld | Zeichen-Limit | Indexierungs-Gewicht | Türkei-spezifische Notiz |
|---|---|---|---|
| App-Name | 30 | %100 | Erste 20 Zeichen kritisch |
| Untertitel | 25 | %90 | Sekundär-Keyword + USP |
| Keyword-Feld | 100 | %80 | Leerzeichen­lose Strings testen |
| Beschreibung | 4000 | %20 | Erste 250 Zeichen wichtig |
| Promotional Text | 170 | ~%5 | Unklar, aber versuchswert |

## Validierung durch A/B-Testing

Die Custom Product Page (CPP) ist seit Mitte 2025 in der Türkei verfügbar. Diese Funktion ermöglicht es, verschiedene Screenshot-Sets und App-Preview-Videos anzuzeigen, aber nicht die Metadaten (App-Name, Untertitel, Keywords) zu ändern. Mit CPP können Sie also nicht direkt ASO-Keywords testen, nur die Conversion-Rate optimieren.

Für Keyword-Tests nutzen Sie den „Version Release"-Mechanismus von App Store Connect. Ändern Sie die Metadaten in einer neuen Version, warten Sie 2–3 Wochen, und überwachen Sie die Rank-Veränderungen. Das ist ein langsamer und riskanter Prozess (falsche Keywords können Rankings senken). Alternative: Öffnen Sie eine Apple Search Ads-Kampagne mit „Search Match", lassen Sie Apple automatisch Keywords auswählen, und identifizieren Sie High-Impression-Begriffe. Dies ist bezahlter Traffic für organische Keyword-Discovery.

2026 führten wir für ein Spiel im Rahmen des [Premium-Verlags-Programms](/de/premiumyaynici) diesen Test durch: „strateji oyunu" (monatlich ~8000 Suchvorgänge) versus „savaş stratejisi" (monatlich ~3200). Der zweite ist nischiger, aber weniger Wettbewerb. Durch Fokus auf den zweiten Begriff erreichten wir in 4 Wochen Top 5, dann wechselten wir zum ersten und landeten dank aufgebauten Momentum in den Top 15. Das ist die „Leiter-Strategie": Gewinne erst die Kämpfe, die du gewinnen kannst, baue Momentum auf, dann gehe in die großen Kämpfe.

## Algorithmus-Update-Dynamiken

Der Apple App Store-Algorithmus erhält 3–4 Major Updates pro Jahr. Das letzte Update (Q1 2026) brachte diese Änderungen: Keyword-Dichte-Penalty erhöht (das 5-fache Verwenden desselben Wortes in der Beschreibung wird gekennzeichnet), Einfluss der Nutzer-Bewertungen auf Keyword-Relevanz gesenkt (von 12 % auf 7 %), Einfluss der Retention-Metriken erhöht (über 40 % D7-Retention = Rank-Boost).

Das bedeutet: Keyword-Optimierung allein genügt nicht — Post-Install-Retention wirkt auch auf ASO zurück. Wenn die Erfahrung in den ersten 7 Tagen schlecht ist, hilft kein Keyword noch so sehr. Apples verborgener „Quality Score": Install-zu-First-Open-Rate, D1-Retention, Crash-Rate, Uninstall-Rate, Re-Download-Rate. Dies alles wirkt indirekt auf Keyword-Rank.

Türkei-spezifik: Apple nutzt in regionalem Ranking „Local Engagement"-Signale. Türkische Bewertungen/Reviews wirken stärker auf das Türkei-Ranking als deutsche Kommentare. Aktivieren Sie den In-App-Review-Prompt und triggern Sie ihn speziell für türkische Nutzer (z.B. nach Level-5-Abschluss). Timing ist wichtig: Fragen Sie in positiven emotionalen Momenten (nach Erfolg), nicht in Frustrationsmomenten.

## Konkurrenz-Entdeckbarkeits-Analyse

Konkurrenz-Keyword-Analyse kann nicht manuell durchgeführt werden — Sie brauchen Tools. Mit AppTweak API können Sie folgende Daten abrufen: In welchen Keywords rankiert ein Konkurrenz-Spiel, monatliches Suchvolumen, Rank-Position, geschätzter Traffic-Anteil. Mit diesen Daten erstellen Sie eine „Keyword-Gap"-Analyse: Listen Sie Keywords auf, in denen Konkurrenten ranken, Sie aber nicht.

Beispiel: „klan savaşı" (Clan-Krieg) hat monatlich 4.200 Suchvorgänge, die Top-3-Spiele generieren geschätzt 1.200, 800 und 600 Installs pro Tag. Wenn Sie dort nicht mal in den Top 20 sind, lohnt sich das Ziel nicht. Stattdessen „klan strateji oyunu" (Clan-Strategie-Spiel) mit 620 monatlich und nur 2 Spielen in Top 10 ist zugänglicher. In 3 Monaten könnten Sie Top 5 erreichen und von dort Brücken zu Head Terms wie „klan savaşı" bauen.

Hinweis für türkischen Markt: Manche Spiele verwenden englische Keywords. „Strategy game" hat 1.800 monatliche Suchvorgänge, „strateji oyunu" 8.000. Ein Teil der Nutzer sucht auf Englisch. Wenn Ihre Metadaten englische Keywords enthalten (z.B. im Untertitel „Real-Time Strategy"), erfassen Sie beide Sprachen. Apples Language-Matching-System priorisiert aber die primäre Sprache — im TR Store hat Türkisch immer Vorrang vor Englisch.

---

ASO-Keyword-Architektur im türkischen Mobile-Gaming-Markt ist keine einmalige Aufgabe, sondern ein laufender Prozess. Der Algorithmus ändert sich, Nutzer-Verhalten ändert sich, Konkurrenten entdecken neue Keywords. Ohne monatliches Keyword-Rank-Tracking und vierteljährliche Metadaten-Überprüfung können organische Sichtbarkeit in 6 Monaten um 40+ % sinken. Was Sie jetzt tun sollten: Laden Sie die „search terms"-Daten Ihres aktuellen Spiels aus App Store Connect herunter, identifizieren Sie die 20 Keywords mit den meisten Impressionen, überprüfen Sie, wie viele davon in Ihren Top 10 sind. Keywords mit hohen Impressionen, in denen Sie nicht in den Top 10 sind, sind Ihre größten Chancen. Beginnen Sie dort.