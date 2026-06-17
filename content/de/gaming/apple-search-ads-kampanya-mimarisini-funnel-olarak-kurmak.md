---
title: "Apple Search Ads: Kampagnien als Funnel-Architektur aufbauen"
description: "Von Discovery bis Brand: Budgetfluss durch Broad Match, Competitor und Exact Kampagnen – wie Sie ASA-Kampagnen hierarchisch als Funnel strukturieren."
publishedAt: 2026-06-17
modifiedAt: 2026-06-17
category: gaming
i18nKey: gaming-005-2026-06
tags: [apple-search-ads, asa-kampagnenarchitektur, mobile-user-acquisition, app-funnel-strategie, brand-defense]
readingTime: 9
author: Roibase
---

Apple Search Ads als isolierte Silos zu führen statt als miteinander verbundene Funnel-Schichten mit durchfliessendem Budget und Signalen – das senkt die CPP (Cost Per Purchase) im Mobile-Game-Growth um 20–40 %. Das Discovery-Signal aus Broad Match fliesst in Competitor Exact, von dort in Brand Defense – jede Schicht fungiert als Filter für die nächste. Nach iOS 18.2 ist Custom Product Page Attribution im Jahr 2026 zur Pflicht geworden: Ein Single-Campaign-Ansatz verdeckt Churn, Budget-Verteilung bleibt manuell und fehleranfällig.

## Discovery-Schicht: Warum Broad Match oben stehen muss

Broad-Match-Kampagnen sind die Discovery-Ebene der Apple Search Ads Hierarchie – dazu da, neue Keyword-Cluster zu finden und unerwartete Intent-Signale zu erfassen. Viele Studios lassen diesen Modus nach dem Prinzip «einfach alles testen, dann filtern» laufen und verbrennen täglich 500–1000 Dollar bei einer TTR (Tap-Through Rate) unter 2,5 %. Die richtige Herangehensweise: Broad Match ganz nach oben ins Funnel, aber mit einem **3-Tage-Rolling-Window** und kontrolliertem CPP-Ceiling.

Das Ziel bei Broad ist nicht CPP, sondern **LTV/CPI-Ratio** – im ersten 3-Tage-Fenster ist 0,4x akzeptabel, weil die Keyword-Daten ins Data Warehouse fliessen. Dieser Datenwert liegt hier: Der Search-Match-Algorithmus zeigt Ihnen Competitive Set aus Apples Perspektive. Wenn Sie mit Broad Match «puzzle game» starten, surfaçoniert der Algorithmus Intent-Cluster wie «merge», «match-3», «interior design» – das sind Migration-Kandidaten für Ihre Competitor-Exact-Kampagne.

Kritisch: In der Broad-Kampagne **keine exakten Negatives eingeben**. Negative Keywords gehören nur zu irrelevanten Kategorien (z. B. «poker», «casino», wenn das eine andere Game-Gattung ist). Exakte Negatives unterbrechen den Learning Loop, töten die Discovery-Funktion.

### Budget-Ceiling-Formel für Broad Match

```python
daily_budget_broad = (target_monthly_installs * 0.15) * target_CPI * 1.8
# 0.15 → Discovery-Anteil (%15)
# 1.8 → Broad-CPI-Multiplikator (akzeptabel: 1.8x von Exact)
```

Beispiel: 10K Installs/Monat angestrebt, $2,50 Target-CPI → $6.750/Monat Broad-Budget → ~$225/Tag. Wird dieses Ceiling überschritten, ist es Verschwendung statt Discovery.

## Competitor Exact: Intent-Hijacking-Schicht

Wenn Keywords aus Broad Match **Konkurrenzspiel-Namen** und **Konkurrenz-Brand-Terms** enthalten, migrieren Sie sie in die zweite Schicht – Competitor Exact. Der Zweck ist einfach: die Brand-Awareness Ihres Konkurrenten abfangen. Der Nutzer sucht nach «Candy Crush», Sie zeigen Ihr Puzzle-Game – der Intent ist bereits educiert, Sie bieten nur eine Alternative.

Die TTR von Competitor Exact ist 30–50 % niedriger als Brand Exact (Apples eigene Daten), aber CPP ist meist 15–25 % günstiger, weil Bidding-Konkurrenz auf dem Konkurrenz-Keyword klein ist. Entscheidend: In der Competitor-Kampagne muss die **Custom Product Page Strategie unterschiedlich sein**. Wenn der Konkurrent ein «Time-Management»-Spiel ist, sollte Ihre CPP-Creative die Botschaft «weniger Wartezeit» transportieren – ohne diesen Differential Positioning bleibt Competitor Exact ROI negativ.

Bei der Auswahl der Konkurrenz-Keywords wird oft falsch vorgegangen: Top-20 aus den Charts nehmen. Richtig: **Audience-Overlap-Analyse** – via Sensor Tower oder data.ai das User-Demographic des Konkurrenz-Games ziehen, nur die mit 60%+ Overlap auswählen. Beispiel: Haben Sie ein Hyper-Casual-Game, ist das Keyword eines Match-3-Legend-Spiels Verschwendung – unterschiedliche Core Motivation.

| Konkurrenz-Typ | TTR-Benchmark | CPP vs Brand Delta | CPP-Einsatz |
|---|---|---|---|
| Direkter Konkurrent (gleiches Subgenre) | 3,5–5 % | +15–20 % | Ja, hohe Priorität |
| Benachbartes Genre (ähnliche Core Loop) | 2,8–4 % | +25–35 % | Ja, testen |
| Kategorie-Leader (andere Mechanik) | 1,5–2,5 % | +50%+ | Nein, Verschwendungsrisiko |

## Brand Defense: Warum der eigene Name eine separate Kampagne braucht

Die Brand-Exact-Kampagne – Ihr Spiel-Name, Studio-Name – ist die unterste Funnel-Schicht und die **günstigste Conversion-Ebene**. Bei Apple Search Ads liegt der CPT (Cost Per Tap) für Brand Keywords meist bei $0,10–0,30, während Broad Match $1,50–3,00 kostet. Viele Studios denken «Nutzer, die uns suchen, laden ohnehin organisch herunter» – das ist ein Install-Verlust von 12–18 %.

Warum? Weil Konkurrenten auf Ihrem Brand-Keyword bieten. Sie besitzen das Spiel «Puzzle Master», aber Konkurrenz «Match Kingdom» bietet $2 auf Ihren Brand-Keyword. Apples Auktions-Algorithmus wählt nach Relevanz + Bid – wenn Sie nicht bieten, gewinnt manchmal der Konkurrent. Brand Defense Kampagnen verhindern diesen Hijack.

In der Brand-Kampagne liegt TTR bei 18–35 % – sehr hoch, weil Intent sicher ist. Hier: **Nur Exact Match**, Bid $0,50–$1,00 (reicht, um Konkurrenten auszustechen), Creative mit «neue Season» oder «Update»-Botschaft – wer das Spiel kennt, braucht einen Fresh Reason.

### Brand-Kampagne Bid-Strategie

```python
if competitor_bid_on_brand:
    brand_bid = competitor_avg_bid * 1.3  # Konkurrenz outbidden
else:
    brand_bid = 0.3  # Minimales Bid, Blend aus organisch + paid
```

In der Brand-Kampagne sollte **Search Match ausgeschaltet** sein – der Algorithmus dehnt manchmal Brand-ähnliche Begriffe auf irrelevante Keywords aus, erzeugt Budget-Leak.

## Budget-Fluss zwischen Funnel-Schichten: Waterfall-Architektur

Statt die drei Schichten mit isolierten Budgets zu führen, erzeugt **Waterfall-Budget-Allocation** einen ROAS-Anstieg von 25–40 %. Die Logik: Jede Schicht, die einen Performance-Threshold überschreitet, leitet Overflow-Budget nicht nach oben, sondern reinvestiert in die nächste Test-Runde – Discovery und Conversion Efficiency bleiben ausbalanciert.

Waterfall-Regeln:
1. **Brand Exact ist immer vollfinanziert** – wenn diese Schicht ROI positiv ist, kein Budget-Limit
2. **Competitor Exact → Brand Feed** – wenn Competitor LTV/CPI > 1,2 erreicht, fliesst Overflow-Budget nicht zu Brand, sondern zu neuen Competitor-Keyword-Tests
3. **Broad Match → 15%-Budget-Cap** – nicht mehr als 15 % des Total-ASA-Budget in Broad, sonst wird Funnel Top-Heavy

Mit Apple Search Ads API lässt sich das automatisieren (2026 Campaign Management API v5.0 hat Budget-Adjustment-Endpoints):

```json
{
  "campaignId": 123456,
  "budgetAdjustment": {
    "type": "waterfall",
    "source": "competitor_exact",
    "condition": "LTV_CPI > 1.5",
    "action": "reallocate_to_brand",
    "amount": "overflow"
  }
}
```

Diesen Endpoint täglich mit BigQuery + Airflow laufen zu lassen – Roibase nutzt das in [App Store Optimization](https://www.roibase.com.tr/de/aso) Projekten als Standard – manuelle Anpassung alle 3 Tage bedeutet zu späte Reaktion, Opportunity Loss von 8–12 %.

## Negative-Keyword-Strategie: Sickerverlust zwischen Funnel-Schichten

Wenn Sie Broad, Competitor und Brand separat laufen lassen, besteht **Keyword-Overlap-Risiko** – dasselbe Search Term triggert alle drei Kampagnen, Sie bieten gegen sich selbst. Apples Auktion zeigt nicht mehrere Ads desselben Advertisers, erzeugt aber Bid-Waste: Das höchste Bid gewinnt, die anderen budgetieren reserviert, ohne Impressions zu bekommen.

Lösung: **Cross-Campaign Negative Sync**. So:
- Jedes Keyword in Brand Exact → Negative Exact in Competitor Exact
- Jedes Keyword in Competitor Exact → Negative Phrase in Broad Match
- Keyword aus Broad Match, das konvertiert → nach 14 Tagen zu Competitor oder Brand, Negative aus Broad

Diese Synchronisation kann nicht manuell stattfinden (bei 2000+ Keywords sind das 40 Stunden/Woche). Python-Script oder ASA-Automation-Tool ist obligatorisch:

```python
# Pseudo-Code
brand_kws = get_keywords(campaign_type="brand_exact")
comp_kws = get_keywords(campaign_type="competitor_exact")

for kw in brand_kws:
    add_negative(campaign="competitor_exact", keyword=kw, match="exact")

for kw in comp_kws:
    add_negative(campaign="broad_match", keyword=kw, match="phrase")
```

Ohne Negative Sync klettert durchschnittlicher CPI um 18–25 % – nicht Verschwendung, sondern Ineffizienz. Der Aufwand, dieselbe Nutzer über drei verschiedene Kampagnen zu erreichen.

## Attribution-Falle der Funnel-Architektur

Apple Search Ads Attribution Window: 30 Tage – tippt Nutzer auf Ad und installiert innerhalb 30 Tagen, bekommt Kampagne den Credit. Aber **Multi-Touch-Realität**: Nutzer sieht Ad in Broad Match, installiert nicht, sucht 5 Tage später mit Brand Exact, installiert – Attribution geht an Brand, Broad-Beitrag ist unsichtbar. Das erzeugt Druck, Broad Budget zu kürzen, Discovery-Funktion stirbt.

Lösung: **Assisted Conversion Modeling**. Impression- + Tap-Daten aus Apple Search Ads API ziehen, Multi-Touch-Attribution in BigQuery modellieren. Markov Chain oder Shapley Value können jedem Kampagnenbeitrag seinen Anteil zuweisen. Beispiel-Befund: Broad Match Kampagne lieferte 120 Direct Installs in 30 Tagen, aber 840 Assisted Conversions – echter Wert ist 7x.

```sql
-- BigQuery Multi-Touch-Beispiel
WITH touch_chain AS (
  SELECT user_id, campaign_type, timestamp,
    LEAD(campaign_type) OVER (PARTITION BY user_id ORDER BY timestamp) as next_touch
  FROM asa_events
)
SELECT campaign_type, COUNT(*) as assisted_conversions
FROM touch_chain
WHERE next_touch = 'brand_exact'
GROUP BY campaign_type;
```

Diese Query zeigt, wie oft Broad und Competitor Kampagnen Brand Installs mithelfen – ohne diese Data sieht Broad «teuer, ineffizient» aus, wird gekürzt, Funnel kollabiert.

## Die Funnel-Architektur lebendig halten

Apple Search Ads Funnel ist nicht statisch – jede Woche neuer Keyword-Discovery, jeden Monat Competitive-Landscape-Shift, jedes Quarter Genre-Trend-Veränderung. Um die Funnel lebendig zu halten, braucht es einen **3-Wochen-Review-Cycle**:

1. **Woche 1–2:** Broad-Match Search-Match-Report → neue Keyword-Cluster Discovery
2. **Woche 3:** Keyword-Performance-Data → Migration-Kandidaten zu Competitor Exact
3. **Woche 4:** Brand-Keyword-Hijack-Check → Konkurrenz-Bid-Activity Monitoring

Apple Search Ads Console Manual-Reports reichen nicht – API Daily Pull + Looker Studio Dashboard sind Pflicht. In Roibases Mobile-Game-Clients zeigt dieses Dashboard Real-Time: Funnel-Stage TTR, Cross-Campaign-Keyword-Overlap %, Assisted Conversion Rate, LTV/CPI pro Schicht.

Wenn Sie diesen Rigor anwenden, wird Apple Search Ads zum grössten UA-Channel – CPP kontrolliert, LTV sichtbar, Scale vorhersagbar. Discovery, Competitor, Brand – jede Schicht speist die nächste mit Signal und Budget, statt isolierte Kampagnen läuft ein Ökosystem. 2026, während iOS Privacy weiter verschärft wird, ist diese Architektur keine Luxus – sie ist Notwendigkeit. Auf Apples eigenem Platform, mit Apples Attribution, in Apples Auktion spielen: das ist der stabilste Growth-Channel post-IDFA.