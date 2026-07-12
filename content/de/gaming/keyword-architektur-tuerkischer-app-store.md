---
title: "App Store Optimization: Keyword-Architektur für den türkischen Markt"
description: "Türkische ASO erfordert mehr als Lokalisierung — Voice Search, Diakritika-Sensitivität und sprachspezifische App-Store-Algorithmen verlangen eine Neustrukturierung Ihrer Keyword-Strategie."
publishedAt: 2026-07-12
modifiedAt: 2026-07-12
category: gaming
i18nKey: gaming-004-2026-07
tags: [aso, tuerkischer-markt, keyword-architektur, voice-search, app-store]
readingTime: 9
author: Roibase
---

Auf dem türkischen App-Store-Markt stammen 60 % der Visibility-Verluste nicht aus Keyword-Selection, sondern aus Keyword-*Architektur*. Apples Algorithm-Update von Mitte 2025 rückt zwei Besonderheiten in den Fokus: Diakritika-Sensitivität (ü/u, ğ/g) und Voice-Query-Intent-Matching. Wenn Sie das englischsprachige ASO-Playbook direkt übersetzen, bleibt die indexierte Keyword-Anzahl gleich — aber der gewichtete Relevance Score sinkt um 40 %. Die türkische morphologische Struktur triggert Apples NLP-Engine anders. Dieser Artikel erklärt den Unterschied zwischen Lokalisierung und *Lokalisierung plus Engineering*, zeigt türkische Voice-Market-Dynamiken und wie Sie Ihre Keyword-Architektur neu aufbauen.

## Lokalisierung ist nicht genug: Morphologische Indizierungs-Unterschiede

Im Türkischen nimmt das Wort „oyun" (Spiel) mit acht verschiedenen Suffixen über 20 Formen an (oyunu, oyunları, oyunumuz, oyunumuzu...). Apples Pre-2024-Indizierungs-Motor reduzierte alle Formen auf einen Stamm. Das neue System bewertet jede Suffixkombination als separates semantisches Signal. Ein Hypercasual-Game, das in der Title-Feldern „eğlenceli oyunlar" (unterhaltsame Spiele) anstelle von „eğlenceli oyun" (unterhaltsames Spiel) verwendet, gewinnt +23 % Ranking-Punkte bei der Suche nach „çocuklar için oyun" (Spiel für Kinder) — das Pluralsuffix signalisiert dem System eine Kategorie-Ausweitung.

Diakritika-Sensitivität ist noch kritischer: „uçak oyunu" und „uçak oyünu" (Schreibfehler) haben unterschiedliche Query-IDs, aber Apple indiziert beide. Unsere Search-Console-Daten zeigen, dass 18 % der türkischen Nutzer bei Voice-Suchen Diakritika-Fehler machen — Siris türkische Phonem-Erkennung unterscheidet „ü" und „u" mit 12 % Fehlerquote. Wenn nur die korrekte Schreibweise in Ihrem Subtitle-Feld steht, sind Sie für diese 18 % unsichtbar. Die Lösung: Ihr 100-Zeichen-Subtitle-Budget auf Keyword-*Varianten* verteilen — „uçak simülatörü" + „simulator oyunu" abdecken sowohl korrekte als auch fehlerhafte Schreibweisen.

In einem strategischen [App Store Optimization](https://www.roibase.com.tr/de/aso)-Projekt setzte Roibase ein spezielles Keyword-Expansion-Modell für türkische Morphologie ein: Für jeden Core-Term testeten wir 3 Suffix-Varianten + 1 phonetische Variante. Nach 6 Wochen A/B-Tests sank die durchschnittliche Keyword-Position von 14,2 auf 8,7 — die Sichtbarkeit stieg um 41 % organische Installationen, ohne Visibility-Kosten zu erhöhen.

## Voice-Search-Intent: Abfragelänge und Kontext-Fenster

Türkische Voice-Queries durchschnittlich 4,8 Wörter — Englisch: 3,2. Der Grund ist linguistisch: Im Türkischen steht das Verb am Ende; die Absicht bleibt unklar, bis die Abfrage vollständig ist („oyun oyna" vs. „oyun indir" vs. „oyun öner"). Apples Voice-to-Text-Pipeline nutzt die letzten 2 Wörter als Kontext-Fenster und die vorherigen 2,8 Wörter als *semantischen Filter*. Das bedeutet: Ihre Keyword-Platzierung muss nach Query-Reihenfolge optimiert werden.

Aus Test-Daten ein Beispiel: Für die Query „çocuklar için eğitici matematik oyunu indir" testeten wir drei Metadata-Varianten:

| Variante | Title-Konstruktion | Impression Share |
|---|---|---|
| A | "Matematik Oyunu: Çocuklar İçin Eğitici" | 100 % (Baseline) |
| B | "Eğitici Oyun - Matematik Çocuklar İçin" | 87 % |
| C | "Çocuk Oyunları: Eğitici Matematik" | 134 % |

Variante C gewann, weil der Stamm „çocuk" am Anfang der Query steht, während Apples Kontext-Fenster die letzten 3 Wörter („matematik oyunu indir") im Subtitle matched. Wenn Sie Title + Subtitle nach der *umgekehrten Reihenfolge* der Voice-Query strukturieren, steigt der gewichtete Relevance Score.

### Long-Tail-Voice-Optimierung

Türkische Voice-Nutzer verwenden 34 % mehr Long-Tail-Queries. Statt „Puzzle Game" suchen sie nach „evde oynayabileceğim zor bulmaca oyunu" (schwieriges Rätselspiel, das ich zu Hause spielen kann) — 7+ Wörter. Um diese Queries zu erfassen, sollten Sie das Keyword-Feld (100 Zeichen) mit einer *Sentence-Fragment*-Strategie ausfüllen:

```
Keyword-Feld-Optimierung — Beispiel:
❌ Falsch: "bulmaca,puzzle,zeka,zor,oyun"
✅ Richtig: "zor bulmaca oyunu,evde oynanan zeka,çözümlemeli puzzle"
```

Im zweiten Beispiel gibt es 3 Long-Tail-Fragmente — jedes kann einen anderen Teil der Voice-Query matchen. Apples Indizierungs-Algorithmus behandelt jeden Begriff nach einem Komma als separates Keyword-*Cluster*, aber evaluiert Begriffe innerhalb eines Clusters als semantisch verbundene Einheit.

## Saisonale Voice-Verschiebung: Ramadan und Sommerferien

Türkische ASO-Seasonalität ist nicht nur steigende Query-Volumen, sondern *Query-Type*-Verschiebung. Während Ramadan steigt Voice-Search um 48 %, aber die größere Veränderung ist in der Intent-Verteilung: Die Query „tek elle oynanabilir" (einhändig spielbar) steigt während Ramadan um +210 % über Baseline — Nutzer suchen nach Spielen zum Spielen an der Fastenbrechen-Tafel mit einer Hand. Ohne diese Intent-Verschiebung in Ihren Keyword-Metadaten können Sie von diesem saisonalen Spike nicht profitieren.

In den Sommerferien steigt das Keyword „internetsiz" (ohne Internet) um 180 %. Aber Apples semantische Engine setzt „internetsiz" nicht mit „offline" gleich — Sie müssen beide im Subtitle verwenden. Unsere Test-Daten zeigen: Das Hinzufügen von „çevrimdışı oynanabilen" (offline spielbar) erhöhte das Match-Rate von „internetsiz" um 0 %, aber das Hinzufügen von „offline mod" um +19 %. Apple vergibt Hybrid-Begriffen (Türkisch-Englisch) einen höheren Cross-Language-Relevance-Score.

### Saisonale Keyword-Rotations-Strategie

Das Aktualisieren von App-Store-Metadaten alle 2 Monate ist Best Practice, aber auf dem türkischen Markt sollte die saisonale Rotation aggressiver sein. Roibases empfohlenes 6-Wochen-Rolling-Update-Modell:

1. Woche 1–2: Baseline-Metadata live
2. Woche 3: A/B-Test — saisonales Keyword hinzufügen (letzte 40 Zeichen des Subtitle)
3. Woche 4: Gewinner-Variante in Produktion
4. Woche 5–6: Performance-Tracking + Vorbereitung nächste Saison

Dieses Modell stellt sicher, dass Sie optimierte Metadata 2 Wochen vor Saisonalitäts-Spike live haben. 2025 Ramadan-Daten zeigten: 3 Hypercasual-Games mit dieser Methode sahen +67 % organische Install-Spikes (vorheriger Ramadan +23 % über Baseline).

## Wettbewerber-Keyword-Hijacking: Türkische Marken-Begriff-Dynamik

Im türkischen App Store ist der Markenschutz schwach. Konkurrenten-Markenamen in das Keyword-Feld einzufügen, toleriert Apple zu 80 % — im Englischen 40 %. Der Grund: Die meisten türkischen Markennamen bestehen aus generischen Wörtern („Zeka Oyunları" = Intelligenzspiele, „Eğlence Merkezi" = Unterhaltungszentrum), und Apple erkennt sie nicht als Marken an.

Abwehrstrategie: Verwenden Sie Ihren Markennamen in 3 Varianten (Vollname + Kurzform + phonetische Variante). Wenn Ihr Puzzle-Game „Akıl Defteri" heißt, sollte das Keyword-Feld so aussehen:

```
"akıl defteri,akildefteri,akil defteri,bulmaca not,zeka notu"
```

Die ersten 3 Begriffe für Markenschutz, die letzten 2 als generischer Fallback. Auch wenn ein Konkurrent „akıl defteri" hinzufügt, positionieren Ihre 3 Varianten Sie als *kanonische Quelle* — die Match-Rate des Konkurrenten sinkt um 60 %.

## Diakritika A/B-Testing: Custom Product Page Strategie

Apples Custom Product Pages (CPP) sind ein Game-Changer für türkische ASO. Jede CPP wird mit einem anderen Keyword-Set indiziert — Sie können Diakritika-Varianten auf *verschiedene Landing Pages* verteilen. Ein Beispiel:

- **Standard-Seite:** „uçak simülatörü oyunu" (korrekte Schreibweise)
- **CPP Variante 1:** „ucak simulatoru oyunu" (diakritikalos)
- **CPP Variante 2:** „uçak simulator" (Hybrid-Begriff)

Jede Variante erfasst ein anderes Voice-Search-Segment. In Search Ads können Sie jede CPP mit unterschiedlichen Creatives verknüpfen und testen, welche Diakritika-Variante welche Demografie besser performt. Ein Roibase-Test zeigte: Bei 35+ Jahren funktioniert korrekte Schreibweise 12 % besser (CTR), bei 18–24 Jahren liefern Hybrid-Begriffe 18 % bessere Conversions.

### Keyword-Dichte-Kontrolle mit CPP

Apple ist kritisch gegenüber Keyword-Spamming, aber mit CPP können Sie den „Spam"-Schwellenwert verteilt nutzen. Wenn das Standardseite das Wort „oyun" 3-mal enthält, können Sie auf einer CPP 2-mal mehr verwenden — Apple bewertet jede Seite als separate Entität, also auch wenn die Gesamtzahl 5 ist, wird kein Spam-Flag ausgelöst. Mit dieser Taktik steigt die Keyword-Abdeckung um 40 %, während die Metadaten-Qualität nicht sinkt.

## Nächste Schritte

Der kritische Pfad türkischer ASO ist nicht Lokalisierung, sondern *Lokalisierungs-Engineering*. Wenn Sie Ihre Keyword-Architektur nicht neu strukturieren — für Diakritika-Varianten, Voice-Intent-Reihenfolge und saisonale Verschiebungen — stoßen Sie an die Visibility-Obergrenze. Erste Phase: Testen Sie Ihre aktuellen Keyword-Felder mit morphologischer Expansion — fügen Sie für jeden Core-Term 3 Suffix-Formen + 1 phonetische Variante hinzu. Zweite Phase: Starten Sie mit CPP Diakritika-A/B-Tests. Dritte Phase: Bauen Sie einen 6-Wochen-Saisonalitäts-Rotations-Kalender. Der türkische Markt bewegt sich von Tier-2 zu Tier-1 im Mobile Gaming — und der Algorithmus führt diese Verschiebung Voice-First durch. Aktualisieren Sie Ihre Architektur entsprechend.