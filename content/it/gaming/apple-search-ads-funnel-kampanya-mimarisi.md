---
title: "Apple Search Ads: Struttura della Campagna Come Funnel"
description: "Budget flow da discovery a brand: matching esteso, competitor ed exact — come costruire l'architettura ASA come funnel gerarchico."
publishedAt: 2026-06-17
modifiedAt: 2026-06-17
category: gaming
i18nKey: gaming-005-2026-06
tags: [apple-search-ads, asa-campagna-architettura, mobile-user-acquisition, app-funnel-strategy, brand-defense]
readingTime: 9
author: Roibase
---

Strutturare le campagne Apple Search Ads come livelli di funnel interconnessi — dove il segnale utente scorre da broad match a competitor exact fino a brand defense — riduce il CPP del 20-40% nella crescita dei mobile game. Ogni strato funge da filtro per il successivo: discovery nel broad match cattura i segnali, li fa fluire verso competitor exact, infine verso la brand defense. Nel 2026, dopo iOS 18.2, l'attribution su custom product page rende questo approccio imperativo: campagne isolate nascondono il churn, l'allocazione del budget rimane troppo manuale.

## Il Livello di Discovery: Perché Broad Match Deve Stare in Cima

Le campagne broad match rappresentano lo strato di discovery nell'architettura Apple Search Ads — esistono per scoprire nuovi cluster di keyword e catturare segnali di intent inaspettati. Tuttavia, molti studio le lasciano aperte con mentalità "prova tutto, filtra dopo", bruciando 500-1000 dollari al giorno con TTR (Tap-Through Rate) sotto il 2.5%. L'approccio corretto: posizionare il broad match al livello superiore del funnel, ma controllare la soglia di CPP con una **finestra mobile di 3 giorni**.

L'obiettivo nel broad non è il CPP, bensì il **ratio LTV/CPI** — un valore di 0.4x nei primi 3 giorni è accettabile, perché il dato sulle keyword fluisce verso il data warehouse. Il valore di questo dato risiede in questo: l'algoritmo Search Match vi mostra il competitive set del vostro gioco dal punto di vista di Apple. Ad esempio, lanciando broad match su "puzzle game", l'algoritmo rivela cluster di intent come "merge", "match-3", "interior design" — questi diventano candidati per migration verso campagne competitor exact.

Regola critica: **non inserire mai exact negative** nel broad match. I negative keyword devono applicarsi solo a categorie irrilevanti (es. "poker", "casino" se il vostro genere è diverso). Mettere negative exact strozza il learning loop dell'algoritmo e uccide la funzione di discovery.

### Formula del Tetto di Budget per Broad Match

```python
daily_budget_broad = (target_monthly_installs * 0.15) * target_CPI * 1.8
# 0.15 → quota discovery (15%)
# 1.8 → broad CPI multiplier (1.8x dell'exact è accettabile)
```

Esempio: target 10K install mensili, $2.5 target CPI → $6,750/mese broad budget → circa $225 giornalieri. Superare questo tetto significa che il broad sta facendo waste, non discovery.

## Competitor Exact: Lo Strato di Intent Hijacking

All'interno delle keyword che emergono dal broad match, gli **nomi dei giochi concorrenti** e i **termini brand competitor** devono essere migrati al secondo strato — la campagna competitor exact. La logica è semplice: rubare la brand awareness del competitor. Un utente cerca "Candy Crush", voi mostrate il vostro puzzle game — l'intent education è già avvenuto, voi offrite un'alternativa.

Il TTR di competitor exact è del 30-50% più basso rispetto a brand exact (secondo i dati di Apple), ma il CPP è generalmente il 15-25% più economico perché la competizione di bid sul termine competitor è bassa. Ciò che conta: nella campagna competitor, la **strategia di custom product page deve cambiare**. Se il competitor è un gioco di "time management", il vostro messaggio creativo CPP deve comunicare "meno tempo di attesa" — senza questo positioning differenziale, il ROI di competitor exact rimane negativo.

Nell'selezione di keyword competitor, l'errore comune è prendere i top 20 giochi dalla chart dei più grossi. Il metodo corretto: **analisi di audience overlap** — estrarre la demographic utente del gioco competitor da Sensor Tower o data.ai, selezionare quelli con overlap >60% con il vostro. Ad esempio, se il vostro è un gioco hyper-casual, prendere la keyword di un match-3 legend è waste — la core motivation dell'audience è diversa.

| Tipo di Competitor | TTR Benchmark | CPP vs Brand Delta | Utilizzo CPP |
|---|---|---|---|
| Competitor diretto (stesso sub-genere) | 3.5-5% | +15-20% | Sì, alta priorità |
| Genere adiacente (loop core simile) | 2.8-4% | +25-35% | Sì, testa |
| Leader di categoria (meccanica diversa) | 1.5-2.5% | +50%+ | No, rischio waste |

## Brand Defense: Proteggere il Vostro Nome in Una Campagna Separata

La campagna brand exact — il nome del vostro gioco, il nome dello studio — è lo strato inferiore del funnel e il **layer di conversione più economico**. In Apple Search Ads, il CPT (Cost Per Tap) del brand keyword è generalmente $0.10-0.30, mentre il broad match è a livello $1.5-3. Tuttavia, molti studio omettono la campagna brand pensando "gli utenti che ci cercano fanno il download organico" — questo equivale a una perdita di install del 12-18%.

Perché? Perché **i competitor fanno bid sui vostri keyword brand**. Siete proprietari del gioco "Puzzle Master", ma il competitor di "Match Kingdom" offre $2 su vostro keyword brand. L'algoritmo di auction di Apple combina relevance + bid per scegliere il vincitore — se non fate bid, talvolta il competitor vince. La campagna brand defense esiste per bloccare questo hijacking.

Nel brand, il TTR è del 18-35% — molto alto, perché l'intent è certo. Quello che serve: **match type only exact**, bid di $0.5-1 (sufficiente per outbid i competitor), e il creativo CPP deve comunicare "nuova stagione" o "aggiornamento" — l'utente già conosce il gioco, ha bisogno di una ragione nuova per aprirlo.

### Strategia di Bid della Campagna Brand

```python
if competitor_bid_on_brand:
    brand_bid = competitor_avg_bid * 1.3  # Outbid il competitor
else:
    brand_bid = 0.3  # Bid minimo, blend organico + paid
```

Nella campagna brand, **Search Match deve essere disattivato** — talvolta l'algoritmo espande il brand a termini simili ma irrilevanti, creando leak di budget.

## Flusso di Budget tra i Livelli del Funnel: Architettura Waterfall

Invece di gestire i tre strati con budget isolati, costruire un **waterfall budget allocation** aumenta il ROAS del 25-40%. La logica: ogni strato, se supera la soglia di performance, riversa il budget in eccesso — mantenendo l'equilibrio tra investment in discovery e efficiency di conversione.

Regole del waterfall:
1. **Brand exact è sempre fully funded** — se il ROI di questo strato è positivo, non c'è limite di budget
2. **Competitor exact → feed al brand** — se il competitor raggiunge LTV/CPI > 1.2, il budget in eccesso non va a test di nuovi keyword competitor, ma rimane riservato
3. **Broad match → cap budget 15%** — il broad non deve ricevere più del 15% del budget ASA totale, altrimenti il funnel diventa top-heavy

È possibile automatizzare questo con l'API Apple Search Ads (la Campaign Management API v5.0 del 2026 ha un endpoint di budget adjustment):

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

Eseguire questo endpoint con BigQuery + Airflow quotidianamente, automatizzando il flusso di budget, è standard nei lavori [App Store Optimization](https://www.roibase.com.tr/it/aso) di Roibase — quando l'adjustment manuale avviene ogni 3 giorni, la reazione è troppo lenta, la perdita di opportunità è dell'8-12%.

## Strategia dei Negative Keyword: Prevenire le Perdite tra i Livelli del Funnel

Quando eseguite campaign broad, competitor e brand separatamente, esiste il **rischio di keyword overlap** — lo stesso search term attiva tre campagne, creando una self-competition. L'auction di Apple non mostra più inserzioni di uno stesso advertiser, ma crea waste di bid: il bid più alto vince, gli altri perdono impression ma riservano budget.

Soluzione: **cross-campaign negative sync**. Così:
- Ogni keyword in brand exact → diventano exact negative in competitor exact
- Ogni keyword in competitor exact → diventano phrase negative in broad match
- Keyword nel broad che convertono → dopo 14 giorni, migrano a competitor o brand, e vengono rimossi dal broad con negative

Questa sincronizzazione non può essere manuale (in account con 2000+ keyword, 40 ore di lavoro settimanale). Uno script Python o uno strumento di automazione ASA è obbligatorio:

```python
# Pseudo-code
brand_kws = get_keywords(campaign_type="brand_exact")
comp_kws = get_keywords(campaign_type="competitor_exact")

for kw in brand_kws:
    add_negative(campaign="competitor_exact", keyword=kw, match="exact")

for kw in comp_kws:
    add_negative(campaign="broad_match", keyword=kw, match="phrase")
```

Se il negative sync non avviene, il CPI medio sale del 18-25% — non è waste, è inefficiency. È il costo di raggiungere lo stesso utente con tre diverse campagne.

## La Trappola di Attribution dell'Architettura Funnel

La finestra di attribution di Apple Search Ads è 30 giorni — se l'utente tappa un search ad e fa il download entro 30 giorni, il credito va a quella campagna. Ma la **realtà multi-touch** è questa: l'utente ha visto il broad match, non ha installato, 5 giorni dopo ha cercato il vostro brand exact e ha installato — l'attribution va al brand, il contributo del broad rimane invisibile. Questa distorsione crea l'impulso di tagliare il budget al broad, uccidendo la discovery.

Soluzione: **multi-touch attribution modeling**. I dati di impression + tap da Apple Search Ads API vanno estratti e caricati in BigQuery per costruire un modello di multi-touch attribution. Con Markov chain o Shapley value, è possibile assegnare a ogni campagna la sua quota di contributo. Esempio di finding: negli ultimi 30 giorni, la campagna broad ha generato 120 install diretti ma ha contribuito a 840 conversioni assistite — il valore reale è 7x.

```sql
-- Esempio BigQuery multi-touch
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

Questa query mostra quante volte le campagne broad e competitor hanno assistito gli install brand — senza questi dati, il broad appare "costoso, inefficiente", viene tagliato e il funnel crolla.

## Mantenere Viva l'Architettura della Campagna

L'architettura funnel Apple Search Ads non è statica — c'è nuova keyword discovery ogni settimana, shift del competitive landscape ogni mese, trend di genere che cambiano ogni trimestre. Per mantenere il funnel vivo è obbligatorio un **ciclo di review di 3 settimane**:

1. **Settimana 1-2:** Report Search Match dal broad → discovery di nuovi cluster di keyword
2. **Settimana 3:** Data di performance keyword → selezione di migration candidate per competitor exact
3. **Settimana 4:** Controllo hijacking di brand keyword → monitoring di activity di bid dei competitor

Il report manuale dalla Console di Apple Search Ads non è sufficiente — serve una pull API giornaliera + dashboard Looker Studio. Negli account di clienti mobile game di Roibase, questo dashboard mostra in real-time: TTR per funnel stage, % overlap di keyword tra campagne, assisted conversion rate, LTV/CPI per layer.

Quando gestite l'architettura funnel con questa disciplina, Apple Search Ads diventa il vostro canale UA singolarmente più grande — CPI sotto controllo, LTV visibile, scale prevedibile. Discovery, competitor, brand — ogni strato nutre l'altro di segnale e budget, invece di isolamento di campagna singola, costruite un ecosistema. Man mano che la privacy di iOS si stringe nel 2026, questa architettura non è lusso ma necessità — giocare sulla piattaforma di Apple stessa, con la sua attribution nativa, con il suo auction nativo, è il canale di crescita più stabile dopo IDFA.