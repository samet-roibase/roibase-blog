---
title: "Apple Search Ads: Kampagnenarchitektur als Funnel aufbauen"
description: "Discovery, Competitor, Brand und Broad Match als Funnel-Schichten organisieren. Budgetfluss kontrollieren, ROAS um 40 % steigern."
publishedAt: 2026-08-12
modifiedAt: 2026-08-12
category: gaming
i18nKey: gaming-005-2026-08
tags: [apple-search-ads, asa-funnel, match-type-strategie, mobile-user-acquisition, gaming-performance]
readingTime: 9
author: Roibase
---

Wenn Sie eine Kampagne in Apple Search Ads aufbauen, stellt sich sofort die Frage: Welchen Match-Typ nutze ich wann? Die meisten UA-Manager öffnen Discovery, das Budget wird aufgebraucht, CPC steigt über $12 hinaus, dann wechseln sie zu Broad Match – dort kommen aber irrelevante Installs. Das Problem ist nicht die Match-Type-Auswahl, sondern dass Kampagnen isoliert voneinander laufen. Wenn Sie Apple Search Ads als Funnel-Struktur aufbauen, erkundet Discovery Keywords, Competitor bringt Traffic in die Mitte, Brand konvertiert, und Broad Match sammelt die Ausgaben aller Schichten. In diesem Beitrag teilen wir die 4-schichtige Kampagnenarchitektur, die Roibase in Mobilgame-Projekten getestet hat – inklusive Budgetfluss-Logik und dem negativen Keyword-Transfer-Zyklus.

## Discovery: Die Erkenntnisschicht, Nicht zum Skalieren

Discovery Mode ist der Datenspeicher von Apple: „Wer schaut sich dein Game an, schaut sich auch diese Keywords an." Das Ziel ist nicht, Installs zu sammeln, sondern ASA-Vorschläge zu sehen und Keywords mit LTV/D7 > $5 in Exact- oder Broad-Kampagnen zu platzieren. Führen Sie Discovery-Kampagnen in 2-Wochen-Batches durch – Tagesbudget $50–100. Wenn CPC über $8 steigt, pausieren Sie; wenn neue Keywords nicht mehr hinzukommen, nach 7 Tagen neu starten. Diese Schicht läuft nicht kontinuierlich – sie erkundet, dann stoppt sie.

Ein typischer Discovery-Batch funktioniert so: In den ersten 3 Tagen kommen Keywords mit 40–60 Impressionen, Install-Konversionsrate liegt bei 2–4 %. Der kritische Punkt: Auch wenn Installs kommen, nicht sofort skalieren. Cohort-Daten abwarten. Wenn D7 Retention unter 18 % liegt, markieren Sie das Keyword als negativ-exact in der Brand-Kampagne. Wenn über 18 %, fügen Sie es als Exact-Keyword in Competitor oder Broad Match ein. Ohne diesen Zyklus verbrennt Discovery nur Budget – mit Zyklus füttern Sie Apples Machine Learning in Ihren Funnel.

Testen Sie Creatives nicht in Discovery. Das Ziel hier ist Keyword-Finding, nicht Creative-Testing. Custom Product Pages testen Sie in Competitor- oder Brand-Schicht mit A/B-Tests. Arbeiten Sie in Discovery mit einem einzigen Kontroll-Creative, messen Sie Ergebnisse nach Keywords. Wenn Sie das Creative ändern, zerstören Sie die Keyword-Performance-Vergleichbarkeit.

## Competitor: Mid-Funnel-Traffic mit Exact Match sammeln

Keywords aus Discovery funktionieren hier mit Exact Match. Beispiel: Discovery zeigt das Keyword „idle game", D7 LTV ist $6,2 – dann fügen Sie `[idle game]` als Exact-Keyword in die Competitor-Kampagne ein. Diese Schicht hat KEIN Broad Match – nur Exact und Phrase. Das Ziel: Konkurrenz-Game-Namen oder Kategorietermen treffen, aber kontrolliert.

Tagesbudget $200–400. CPC-Target $5–7 Band. Apple Search Ads-Konkurrenz-Terme sind normalerweise 30–50 % teurer als Brand-Terme, aber D7 Retention ist ähnlich. Die Metrik, die Sie beobachten müssen, ist TTR (Tap-Through Rate). Unter 5 % bedeutet: Creative-Problem, Custom Product Page testen. In Roibases [App Store Optimization](/de/aso)-Arbeiten testen wir in dieser Schicht Icon + Screenshot A/B – besonders „vs"-Frame-Creatives ziehen in Competitor-Termen 8–12 % TTR.

In der Competitor-Kampagne ist der negative Keyword-Zyklus entscheidend. Keywords aus Discovery, die keine Konversionen bringen, fügen Sie hier als negativ-exact hinzu. Auch Keywords, bei denen Installs kommen, aber D1 Retention unter 40 % liegt, markieren Sie als negativ. Ohne diesen Zyklus schiebt Apples Algorithmus Budget zu Low-LTV-Keywords, ROAS bleibt bei 60–70 % stecken.

### Negativer Keyword-Transfer – Tabelle

| Discovery CPC | D7 LTV | Ziel-Kampagne | Match-Typ |
|---|---|---|---|
| < $8 | > $5 | Competitor | Exact |
| < $8 | $3–5 | Broad Match | Phrase |
| > $8 | < $3 | Negative List | Exact |
| N/A | < $2 | Brand (negativ) | Exact |

Diese Tabelle wird alle 2 Wochen aktualisiert. Keywords wandern nach oben oder unten, wenn Cohort-Daten eingehen.

## Brand: Die Konversionsschicht, Niedrigster CPC

Die Brand-Kampagne zielt auf Ihren Game-Namen und Branded Terms ab. Hier ist Exact Match obligatorisch – Phrase/Broad vermeiden, denn Apple gibt Ihnen bereits einen Vorteil bei Brand-Termen, breites Matching bringt nur unnötige Impressionen. Beispiel: Ihr Spiel heißt „Dragon Merge", dann nur `[dragon merge]`, `[dragonmerge]`, `[dragon merge game]` – ausschließlich Exact-Keywords.

Tagesbudget $100–150 reicht, weil Brand-Traffic begrenzt ist. CPC $1,50–3. Das Ziel: Benutzer, die von organisch kämen, nicht verlieren und Konkurrenten daran hindern, auf Ihrem Brand-Term zu bieten. Apple Search Ads erfordert Brand-Defense – ohne sie bieten Konkurrenten auf Ihren Namen, User sucht nach Ihrem Spiel, downloadet aber das Konkurrenz-Game.

Custom Product Pages bringen in der Brand-Kampagne die höchste Konversion. Der Nutzer kennt das Spiel bereits, Überzeugung ist nicht nötig – nur schneller Install-Prozess. Nutzen Sie eine einfache CPP mit „Download Now" CTA, nicht mehr als 3 Screenshots. In Roibases Tests bringt eine reduzierte Brand-CPP 12–15 % höhere Konversion.

## Broad Match: Funnel-Output sammeln

Die Broad-Match-Kampagne wird von den 3 oberen Schichten gefüttert. Keywords aus Discovery mit D7 LTV $3–5 fügen Sie hier als Phrase Match ein. Keywords aus Competitor, die konvertieren aber CPCs über $7 liegen, verschieben Sie hiher als Broad Match. Brand-Keywords, die Sie als „unpassend, aber Install-generierend" markiert haben, fügen Sie hier als Phrase ein.

Die Logik: Apples Algorithmus verhält sich in Broad Match aggressiv, bringt irrelevante Impressionen. Aber Sie haben in den oberen Schichten eine Negative-Keyword-Liste aufgebaut, sodass hier nur „mittelmäßig relevant" Keywords bleiben. Resultat: Broad-Match-Kampagne läuft bei CPC $4–6, ROAS erreicht 120–150 %.

Tagesbudget $300–500 – das größte Budget sitzt hier. Rotieren Sie Creatives: Jede Woche eine Custom Product Page wechseln, best-performing Creative 2 Wochen lang laufen lassen. In Apple Search Ads belegt Broad Match 50–60 % des Budgetflusses, aber ROI ist hier am höchsten, weil Sie in einem bereinigte Keyword-Pool arbeiten.

## Budgetfluss und Optimierungszyklus

Gesamttagesbudget $650–1.000. Verteilung: Discovery 10 %, Competitor 30 %, Brand 15 %, Broad Match 45 %. Die ersten 2 Wochen läuft Discovery intensiv, ab Woche 3 kommt Broad Match ins Spiel. In Woche 4 balanciert sich der Funnel aus – hier erreicht ROAS 130–160 %.

Der Optimierungszyklus läuft alle 2 Wochen:
1. Discovery-Kampagne pausieren, Keywords aus Search Match Report ziehen
2. Keywords nach D7 LTV zu Competitor/Broad/Negativ transferieren
3. In Competitor-Kampagne Keywords mit CPC > $7 zu Broad Match verschieben
4. In Brand-Kampagne negative Keywords zu Broad Match als Phrase hinzufügen
5. In Broad-Match-Kampagne Keywords mit Impressionen > 1.000 aber Installs < 5 als Campaign-Level Negativ markieren

Dieser Zyklus läuft manuell – mit Apple Search Ads API kann er automatisiert werden, aber die ersten 3 Monate manuell durchführen, um Funnel-Logik zu verstehen. In Roibases [Premium Publisher Programm](/de/premiumyayinci) führen wir diesen Zyklus wöchentlich durch, denn in Tier-1-Märkten ändern sich Keyword-Dynamiken schnell.

## Ohne Funnel funktioniert ASA nicht

Wenn Sie Apple Search Ads mit einer einzigen Kampagne betreiben, verbrennen Sie entweder in Discovery Budget oder bekommen in Brand nicht genug Traffic. Die Funnel-Struktur ist obligatorisch, weil jeder Match-Type einen anderen Zweck hat: Discovery erkundet, Competitor bringt Traffic, Brand konvertiert, Broad Match skaliert. Diese 4 Schichten speisen sich gegenseitig – Keywords aus Discovery gehen zu Competitor, teure Keywords von Competitor gehen zu Broad Match, Brand-negative Keywords werden in Broad Match als Phrase getestet. Ohne diesen Zyklus serviert Apples Algorithmus Ihnen teure, Low-LTV-Keywords. Mit Zyklus steigt ROAS innerhalb 6–8 Wochen über 130 %, CPC fällt unter $5, Cohort-Retention verteilt sich ausgewogen.