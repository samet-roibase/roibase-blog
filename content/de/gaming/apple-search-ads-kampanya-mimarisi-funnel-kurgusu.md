---
title: "Apple Search Ads: Kampagna als Funnel-Struktur aufbauen"
description: "Discovery-, Competitor-, Brand- und Broad-Match-Modi als Trichter budgetieren. ASA-Kampagnenstruktur mit LTV integrieren und D7 ROAS optimieren."
publishedAt: 2026-06-03
modifiedAt: 2026-06-03
category: gaming
i18nKey: gaming-005-2026-06
tags: [apple-search-ads, asa-funnel, mobile-acquisition, match-type-strategy, gaming-ua]
readingTime: 9
author: Roibase
---

Apple Search Ads als Keyword-basiertes PPC-Tool zu nutzen ist 2021 vorbei. 2026 ist ASA ein Funnel-Betrieb. Kampagnenschichten von Discovery bis Brand werden mit LTV-Prognosen budgetiert und auf D7 ROAS statt Installzahl optimiert. Die meisten Teams verwenden immer noch Broad Match in einer einzigen Kampagne und beschweren sich über mangelnde Skalierbarkeit. Das Problem ist nicht das Budget — es ist die Architektur.

## Discovery-Kampagne: Den kalten Traffic-Pool scannen

Die Discovery-Kampagne wird eingerichtet, um das Suchverhalten von Nutzern zu erfassen, die Ihre App noch nie gehört haben. Mit Broad Match werden 200–500 generische Keywords ausgewählt, das Tagesbudget niedrig angesetzt (Tier-1: 50–100 Dollar), aber die Search Impression Share auf nahe 100 % optimiert. Das Ziel ist nicht Installzahl, sondern Search-Match-Daten zu sammeln.

72 Stunden nach Kampagnenstart wird der Search-Match-Report analysiert. Bei welchen Queries gab es Impressionen, welche Keywords führten zu Installs, welche sind Spam? Diese Daten validieren oder widerlegen Ihre ASO-Strategie. Zum Beispiel: Wenn Ihre Metadaten „Puzzle" hervorheben, aber Search Match zeigt starke TTR bei „Idle Game"-Queries, stimmt etwas zwischen ASO und UA nicht überein.

In der Discovery-Schicht ist CPT (Cost per Tap) 35–50 % niedriger, weil die Konkurrenz bei unbekannten Keywords gering ist. Aber die Conversion Rate (Tap-to-Install) ist schwach. Das ist normal. Discovery soll den Funnel füttern, nicht Installerfolge liefern. 200–300 Installs pro Woche reichen aus; 15 % davon gehen in die negative Keyword-Liste, der Rest sickert in die Competitor- und Brand-Schichten.

### Discovery-Budget-Regel

Das tägliche Budget der Discovery-Kampagne sollte 10–15 % Ihres Gesamt-ASA-Budgets nicht überschreiten. Beispiel: Bei monatlich 30.000 Dollar ASA-Ausgaben werden 100 Dollar/Tag für Discovery reserviert. Das Budget ist fest, kein CPA-Ziel, manuelles Bidding (meist 0,30–0,50 Dollar Tier-1). Nach 14 Tagen werden High-Performer aus Search Match als Exact Match in die Competitor-Kampagne verschoben.

## Competitor-Kampagne: Um Rival-Marken konkurrieren

Die Competitor-Schicht zielt auf Markennamen von Konkurrenzenspielen mit Exact Match ab. „Candy Crush", „Clash of Clans", „Subway Surfers" — diese Brand-Begriffe gehören hier hin. Die Strategie sollte nicht aggressiv, sondern opportunistisch sein. Wenn der Konkurrent seine eigene Marke mit Max Bid bewirbt, halten Sie sich bei 60–70 % und streben nicht den ersten Platz an.

CPT von Competitor-Kampagnen ist 80 % höher als Discovery, aber TTR steigt auf 12–18 % (gegenüber 3–5 % bei Discovery). Die Install-Conversion ist niedrig, weil der Nutzer ein anderes Spiel suchte. D1 Retention liegt bei 25–30 %, während organische Installs 45–50 % erreichen. Aber in manchen Szenarien wächst der Gesamt-LTV-Pool.

Das KPI dieser Schicht ist „Incremental ROAS". Wenn Sie die Competitor-Kampagne pausieren, sinkt die Gesamtinstallzahl um 10 %? Dann schafft sie Incrementality. Sinkt sie nicht, kannibaliert die Kampagne — derselbe Nutzer kam ohnehin über Discovery oder Brand. Ein 14-Tage-Incremental-Test ist obligatorisch.

| Match-Typ | CPT (Tier-1) | TTR | D7 ROAS Ziel | Budget-Anteil |
|---|---|---|---|---|
| Discovery (Broad) | $0,40 | 3–5 % | Test-Modus | 10 % |
| Competitor (Exact) | $1,20 | 12–18 % | 80+ % | 25 % |
| Brand (Exact) | $0,60 | 25–35 % | 200+ % | 50 % |
| Generic (Broad) | $0,70 | 6–9 % | 120+ % | 15 % |

## Brand-Kampagne: Ihre Marke schützen

Die Brand-Kampagne wird eingerichtet, um Nutzer, die Ihr Spiel suchen, vor Konkurrenten zu bewahren. Keywords wie „Roibase Puzzle", „Roibase Game", „Roibase RPG" werden mit Exact Match gezielt. Hier wird Max Bid verwendet, denn auch organische Rankings können von Konkurrenz-Anzeigen übertroffen werden.

CPT von Brand-Kampagnen ist am niedrigsten (Tier-1: 0,40–0,80 Dollar). TTR 25–35 %, Install CR 60–70 %, D7 Retention 50+%. Dieser Nutzer kennt Ihr Spiel bereits und würde es installieren. Die Frage ist: „Würde dieser Nutzer die Installation ohne Brand-Kampagne abschließen?" Die Antwort ist meist „ja" — aber wenn der Konkurrent auf denselben Term bietet, ist die Kampagne notwendig.

Das Budget dieser Schicht macht 40–50 % des Gesamt-ASA-Spend aus. Das wirkt groß, aber es ist eine defensive Position. Wenn ein Konkurrent Ihre Brand-Begriffe zielt, müssen Sie seine zielführen — gegenseitig zugesicherte Zerstörung (MAD). 2026 haben die meisten Tier-1-Spiele Brand-Schutz, wer nicht, verliert 10–15 % organische Installs.

### Brand-Kampagnen-Pause-Test

Wenn kein Konkurrent Ihre Brand-Begriffe zielt, pausieren Sie die Kampagne 7 Tage lang. Sinkt die organische Installzahl? Sinkt sie nicht, werden UA-Mittel verschwendet ohne Incremental-Wert. Sinkt sie (typisch 8–12 %), halten Sie die Kampagne aktiv, aber setzen Sie ein CPA-Cap (15 % des organischen Nutzer-LTV als Obergrenze).

## Broad Match Modus: Discovery ist nicht Scale

Broad Match sollte nicht mit Discovery verwechselt werden. Discovery verwendet Broad Match mit niedrigem Bid + niedrigem Budget. Broad-Match-Scale-Kampagnen laufen mit hohem Bid + hohem Budget, um bei generischen Begriffen Impression Share zu gewinnen. „puzzle game", „idle rpg", „strategy mobile" — Kategorie-Begriffe gehören hier hin.

Das Risiko von Broad Match ist „irrelevante Queries". Sie bieten auf „puzzle", aber Search Match zeigt auch „puzzle solver app", „puzzle table" — Non-Gaming-Queries. Die Negative-Keyword-Liste muss 200+ Einträge haben. In den ersten 7 Tagen ist manuelle Kontrolle obligatorisch — täglich Search-Match-Review.

Das Broad-Match-Budget sollte 15–20 % des Gesamt-ASA-Spend nicht überschreiten. Beispiel: Bei 30.000 Dollar monatlich werden 5.000 Dollar in Broad Match gesteckt. Das CPA-Ziel liegt 20–30 % höher als Exact-Match-Kampagnen (weil oben im Funnel). D7 ROAS Ziel 100–120 %. Unter diesem Wert: nicht pausieren, Bid senken — Kampagne sammelt weiterhin Daten.

## Budget-Fluss: Funnel-Stufen hinunter verschieben

Gesunde ASA-Architektur trägt Nutzer von Discovery zu Brand. Ein Nutzer, der in Discovery zum ersten Mal exponiert wurde, sucht 48–72 Stunden später den App-Namen — die Brand-Kampagne fängt ihn. Um diesen Fluss zu messen, verwenden Sie Apples „Custom Product Page"-Attribution: welche Kampagne First Touch, welche Install?

Die Budget-Verteilung wird so strukturiert: Discovery bleibt fest (100 Dollar/Tag), Competitor und Broad Match werden wöchentlich nach CPA-Performance um 10–20 % erhöht oder reduziert, Brand läuft immer „Always On" mit Maximum Budget. Wenn der Gesamtspend unter dem D7-ROAS-Ziel fällt, wird zunächst Competitor geschlossen, dann Broad Match pausiert, Discovery und Brand laufen weiter.

Beispiel-Fluss: Im Mai kamen 250 Installs aus Discovery, 12 % davon (30 Nutzer) suchten 72 Stunden später den Brand-Begriff und installiert über Brand-Kampagne. Deren durchschnittliches LTV war 40 % höher als die Direct-Install-Gruppe von Discovery. Das beweist, dass Discovery nicht nur direkte Installs, sondern auch indirekten Brand-Lift schafft.

### Funnel-Attribution-Tabelle

```
Kampagne         | Ausgaben | Installs | Direktes LTV | Unterstützte Installs | Blended LTV
-----------------|----------|----------|--------------|----------------------|-------------
Discovery        | $3.000   | 250      | $4,20        | 30 (Brand)           | $5,80
Competitor       | $7.500   | 420      | $6,10        | 15 (Brand)           | $6,50
Brand            | $15.000  | 1.200    | $12,40       | —                    | $12,40
Broad Match      | $4.500   | 310      | $5,30        | 22 (Brand)           | $6,00
```

## Campaign Budget Optimization: Apples neuer Algorithmus

Seit 2025 testet Apple Search Ads „Campaign Budget Optimization" (CBO) — ähnlich wie Portfolio-Bid-Strategien in Google App Campaigns: ein Budget, mehrere Kampagnen, Maschinen-Lernen verteilt automatisch zum besten Performer. CBO in Gaming UA zu verwenden ist riskant. Der Algorithmus berücksichtigt das D7-ROAS-Ziel nicht, nur Installvolumen.

Wenn Sie CBO aktivieren, absorbiert Brand-Kampagne 70–80 % des Budgets, weil der CPA dort am niedrigsten ist. Discovery und Competitor bleiben offen. Folge: Installzahl sinkt nicht sofort, aber Funnel-Oberkante wird nicht gespeist; in 3 Wochen sinkt auch Brand-Volumen. CBO nur verwenden, wenn Sie ähnlich-CPA-Kampagnen zusammenlegen (Brand + Broad Match).

## Welche Schicht wird abgeschaltet, wenn Performance fehlt?

Die Abschaltentscheidung hängt von Incrementality ab, nicht CPA. Competitor-Kampagne liegt 30 % über dem CPA-Ziel, aber pausieren senkt die Gesamtinstalls um 8 %? Sie ist incremental — weitermachen, Bid optimieren. Broad Match liegt im CPA-Ziel, aber pausieren ändert nichts? Sie kannibaliert — abschalten.

Discovery-Kampagne wird nie pausiert. Das Budget kann sinken, aber nicht auf Null. Weil ihr Zweck nicht sofortiger ROAS ist, sondern ASO-Hypothesen zu testen und Search-Match-Daten-Pool zu füttern. Brand-Kampagne auch nie pausieren. Wenn der Konkurrenz Ihre Brand-Begriffe zielt, bleiben Sie im Schutz.

Wenn Sie die ASA-Funnel-Architektur nicht mit [App Store Optimization](https://www.roibase.com.tr/de/aso) integrieren, plateuert Performance in 3–4 Wochen. Keywords in Metadaten und ASA-Kampagnen-Begriffe müssen kohärent sein. Wenn Discovery zeigt unerwartete hohe TTR bei einem Begriff, erhöht dessen Aufnahme in ASO-Metadaten die Install-CR um 10–15 %.