---
title: "iOS 17 und danach: Der Ad Attribution Stack"
description: "ATT, SKAdNetwork 4 und modeled conversions haben die iOS-Messung neu definiert. So funktioniert der Stack 2026."
publishedAt: 2026-05-11
modifiedAt: 2026-05-11
category: marketing
i18nKey: marketing-003-2026-05
tags: [ios-attribution, skadnetwork, att, modeled-conversions, mobile-measurement]
readingTime: 9
author: Roibase
---

Die Attribution-Fragilität, die mit iOS 14 begann, hat 2026 einen Reifegrad erreicht. ATT (App Tracking Transparency) Opt-in-Raten liegen unter 25 %, SKAdNetwork 4 hat die Conversion Value auf 128 Bit erhöht, Meta und Google machen modeled conversions zur Standardmethode. Das Spiel hat sich grundlegend geändert: deterministische Attribution ist tot, die Ära der probabilistischen + Post-Lookback-Analyse hat begonnen. Wer iOS-Werbebudgets ohne korrekten Stack aufbaut, sieht das Geld in einem schwarzen Loch verschwinden.

## Die Realität nach ATT: Mit 25 % Opt-In leben

Die ATT Opt-in-Rate in der iOS 17-Nutzerbasis ist global auf 23–27 % stabilisiert (Singular, Q1 2026). Das bedeutet: 75 % der Nutzer teilen die IDFA nicht. Kampagnen, die auf IDFA-basierte Attribution setzen, sehen nur eine Minderheit – der Rest wird als „modeled" gekennzeichnet.

Was sind modeled conversions? Meta und Google setzen Machine Learning ein, um das Nutzerverhalten für ATT-Ablehner vorherzusagen und Konversionswahrscheinlichkeiten zu berechnen. Diese Methode ist aggregiert – nicht individuell, sondern auf Kohorten-Ebene. Der ROAS stammt zu 70–80 % aus modeled Daten. Wer die Kampagnenoptimierung noch auf „deterministischem ROAS" aufbaut, ignoriert den Großteil der Daten.

Die neue Realität ist einfach: iOS hat ohnehin keine 100%-ige Genauigkeit. Akzeptiere das und baue den Stack danach auf. Deterministische Signale reichen nicht aus – du musst verstehen, wie modeled Daten entstehen, ihre Zuverlässigkeit prüfen und mit Incrementality Tests validieren.

## SKAdNetwork 4: 128-Bit Conversion Value und Hierarchical Source ID

SKAdNetwork 4 (Standard ab iOS 16.1, ausgereift in iOS 17) ist Apples einzige „offizielle" Aggregate-Attribution-Methode. Der Mechanismus: Nutzer klickt auf Anzeige, App wird installiert, nach der ersten Nutzung wird ein Conversion Value erfasst, nach 24–72 Stunden sendet Apple das aggregierte Signal. Keine IDFA, keine Device-Identifier.

Was ist neu? Die Conversion Value ist jetzt 128 Bit – du kannst mehr Details kodieren. Beispiel einer Encoding-Strategie: Die ersten 6 Bit für die Install-Quelle (Meta, Google, TikTok, organisch), die nächsten 7 Bit für den Event-Typ (First Purchase, Tutorial abgeschlossen, Level 3), die restlichen 115 Bit für Revenue-Bucketing + Kohorten-Segment. Du entwirfst dieses Encoding selbst, jede App nach ihren Anforderungen.

Die Hierarchical Source ID ist neu: Statt einer einzigen Campaign ID kannst du jetzt eine vierschichtige Hierarchie nutzen (Campaign → Ad Set → Creative → Keyword). Das ist kritisch für Multi-Touch-Modellierung – vorher gab es nur Campaign-Level-Daten, jetzt kannst du Performance auf Creative-Ebene auflösen. Aber mit mehr Detail kommt auch mehr Rauschen: Wegen Apples Privacy Threshold sendet Apple bei niedriger Volumen kein Postback. Strategischer Trade-off: Zu granular sein oder mehr Postbacks bekommen?

### Conversion Value Design

| Bit-Bereich | Anwendung | Beispiel-Encoding |
|---|---|---|
| 0–5 (6 Bit) | Install-Quelle | 0=organisch, 1=Meta, 2=Google, 3=TikTok |
| 6–12 (7 Bit) | Event-Typ | 0=install, 1=registration, 2=first_purchase, 3=D7_retention |
| 13–127 (115 Bit) | Revenue-Bucket + Segment | LTV-Vorhersage + Geo + Device-Tier |

MMPs (Adjust, AppsFlyer) betten dieses Encoding in ihr SDK ein. Aber die Encoding-Logik definierst du – MMPs bieten nur Standard-Encoding, das oft zu oberflächlich ist.

## Modeled Conversions: Meta CAPI + Google Enhanced

Die Qualität von modeled conversions ist direkt proportional zur Menge der First-Party-Signale, die du an Plattformen sendest. Meta CAPI (Conversions API) und Google Enhanced Conversions sind hier entscheidend. Ohne IDFA auf iOS kannst du dennoch E-Mail-Hash, Telefon-Hash und user_data-Parameter serverseitig senden – das verbessert Apples Modellierungsgenauigkeit.

Meta CAPI hat auf iOS zu 15–20 % ROAS-Verbesserung geführt (Meta Business Partner-Daten, Q4 2025). Warum? Weil Konversionen, die den Pixel nicht erreichen, serverseitig erfasst und Meta diese Signale nutzt, um Nutzer-Kohorten zu modellieren. Entscheidend: Die event_id muss zwischen Pixel und CAPI identisch sein (Deduplizierung), user_data-Parameter müssen SHA-256-normalisiert sein, event_time muss mit dem Server-Timestamp synchron laufen.

Google Enhanced Conversions funktioniert ähnlich – aber der Mechanismus ist anders. Wenn Enhanced Conversions in Google Ads aktiviert ist, können Konversionen vom GTM Server Container mit user_data ergänzt werden. Google cross-referenced diese Daten mit seinem eigenen Logged-In-User-Graph und modelliert. Achtung: Enhanced Conversions funktionieren nicht nur im Web, auch in Apps – aber die serverseitige Einrichtung ist komplexer. Du brauchst Firebase SDK + Cloud Functions für eine [first-party-Datenarchitektur](https://www.roibase.com.tr/de/firstparty).

## Post-Lookback Maturity: 7 Tage Attribution Window ist nicht mehr ausreichend

Das iOS-Stack Attribution Lookback Window liegt typischerweise bei 1–7 Tagen. SKAdNetwork: 24–72 Stunden, Meta: 7 Tage iOS-Attribution, Google Ads: konfigurierbar, aber Standard 7 Tage. Das Problem: Nutzerverhalten endet nicht nach 7 Tagen – besonders bei hoher Consideration (Subscription, E-Commerce) kann der First Purchase 14–30 Tage später kommen.

Post-Lookback Maturity bedeutet: Konversionen, die nach dem kurzen Window stattfinden, retrospektiv berechnen. Beispiel: Nutzer klickt auf Tag 3, kauft auf Tag 12 – diese Konversion entgeht Metas 7-Tage-Window, ist aber real. Mit Kohorten-basierter LTV-Analyse musst du diese Konversion manuell der Kampagne zuordnen.

Methode: Verfolge Install-Kohorten, miss D7 → D14 → D30 Revenue-Anstieg, verteile die Differenz auf Kampagnen. Das ist ein manueller Prozess, aber mit BI + Data Warehouse lässt sich das automatisieren. Mit BigQuery und `FIRST_VALUE()` Window Function kannst du nach install_date Kampagnen matchen, dann den LTV-Increment mit gewichteter Attribution auf Kampagnen verteilen. Im [Performance-Marketing](https://www.roibase.com.tr/de/ppc)-Stack von Roibase ist diese Pipeline Standard.

## Incrementality Testing: Können wir modeled Data vertrauen?

Wie akkurat sind modeled conversions? Ohne Test bleibst du ahnungslos. Incrementality Testing – sprich Holdout/Geo-basierte Experimente – ist für iOS-Kampagnen jetzt obligatorisch. Meta Conversion Lift, Google Campaign Experiments, TikTok Split Testing verfolgen das gleiche Ziel: Du misst die Konversionsdifferenz zwischen Gruppen mit und ohne Kampagne und siehst den echten Lift.

Beispiel: 10 % der Nutzer landen in der Holdout-Gruppe (keine Kampagne), 90 % in der Treatment-Gruppe (Kampagne sichtbar). Nach 30 Tagen: Treatment-Konversionsrate 5 %, Holdout 3,5 % – der echte Lift ist 1,5 Prozentpunkte (absolut). Wenn die Plattform ROAS von 3,0 zeigt, aber der Incrementality Test sagt 1,2, überschätzt modeled data. Diese Lücke wendest du als Adjustment Factor auf den Kampagnen-ROAS an.

Geo-basierte Tests sind robuster, aber langsamer. Du teilst Länder/Bundesländer nach iOS-Nutzerdichte, schaltest die Kampagne in einer Gruppe aus, in der anderen an. Nach 4–8 Wochen vergleichst du die Konversionsdifferenz. Metas Conversion Lift Tool automatisiert das, bei Google Ads brauchst du manuelle Einrichtung (Campaign Draft + Experiment).

## Die iOS Stack-Architektur 2026

Der moderne iOS Attribution Stack sieht so aus:

1. **SKAdNetwork 4 Integration** – MMP-seitig: Conversion Value Encoding + Hierarchical Source ID
2. **Meta CAPI + Google Enhanced** – Serverseitige Event-Sendung, user_data Enrichment
3. **Modeled Conversions lesen** – Platform Dashboards: Achte auf das „modeled"-Flag, berechne aggregierte ROAS
4. **Kohorten-basiertes LTV Tracking** – BigQuery/Snowflake: Install-Kohorten → Revenue Match, Post-Lookback Attribution
5. **Incrementality Testing** – Mindestens 1 Holdout-Experiment pro Quartal, Lift-Faktor berechnen
6. **Creative Testing Velocity** – SKAdNetwork Creative-Level Granularität für schnelle Iterationen nutzen

Dieser Stack braucht 6–8 Wochen zum Aufbau: MMP Onboarding, serverseitige CAPI/Enhanced-Einrichtung, Data Warehouse Pipeline, BI Dashboard. Danach ist der iOS ROAS 20–30 % zuverlässiger – weil du modeled Data korrekt liest, mit Incrementality validierst und Post-Lookback LTV vollständig siehst.

Nach iOS 17 ist Attribution nicht dunkel – nur anders. Deterministische Signale sind seltener geworden, aber probabilistische + aggregate Methoden sind gereift. Mit richtigem Stack sind Kampagnen immer noch messbar und optimierbar. Der Schlüssel: modeled Data akzeptieren, in Incrementality investieren und Kohorten-Analyse diszipliniert betreiben. Jeder, der 2026 auf iOS wachsen will, muss diese drei Dinge beherrschen.