---
title: "Ottimizzazione Bayesiana dei Prezzi nel Mobile F2P"
description: "IAP pricing con posterior estimation e ottimizzazione segmentata: modello probabilistico per bilanciare conversion, revenue e LTV."
publishedAt: 2026-05-26
modifiedAt: 2026-05-26
category: gaming
i18nKey: gaming-002-2026-05
tags: [f2p-monetization, bayesian-testing, iap-optimization, price-ladder, mobile-gaming]
readingTime: 9
author: Roibase
---

Nei giochi mobile F2P la determinazione dei prezzi IAP funziona ancora per intuizione: la ladder $0.99, $4.99, $9.99 viene copiata, se la conversion cala il prezzo scende, se sale si aggiunge più valore. Eppure lo stesso pacchetto da $4.99 può mostrare una conversion del 2.1% negli utenti organici, dell'1.4% nei cohort UA e dell'8.7% nei whale D30+. Un A/B test classico qui fallisce: o le dimensioni campionarie esplodono, o l'attesa arriva a 6 settimane, oppure il trade-off revenue/conversion resta irrisolto. L'ottimizzazione bayesiana dei prezzi risolve tutti e tre i problemi simultaneamente: raccoglie segnali precoci via posterior distribution, modella l'impatto LTV a livello di segmento, gestisce l'equilibrio revenue-conversion in un framework probabilistico.

## Il Collo di Bottiglia dell'A/B Test Frequentista nel Pricing IAP

Un test A/B standard calcola la dimensione campionaria per rilevare una differenza p<0.05 tra due prezzi sulla base della conversion rate. Con una baseline del 2%, un lift relativo del 10% e una potenza dell'80%, servono circa 15.000 esposizioni. Per un IAP di fascia media significa 4-6 settimane di test. Man mano che il test si allunga:

- I CPI delle campagne Meta aumentano (creative fatigue)
- Il mix dei cohort organici si modifica (effetti stagionali, cambiamenti di ranking su ASO)
- I competitor lanciano nuovi eventi, l'elasticità della domanda si rompe

Il problema ancora più critico è lo split revenue-conversion: passare da $2.99 a $4.99 fa scendere la conversion dal 2.1% all'1.7%, ma il revenue per mille sale del 42%. Su quale metrica calcolare il p-value? La maggior parte degli studio dice "abbiamo guadagnato revenue" e passa oltre, ma se si modella la LTV a D7 emerge che il segmento whale ha un churn del 31% in più e il nuovo prezzo danneggia la retention.

L'approccio bayesiano mantiene conversion e revenue nello stesso modello posterior: prior belief (distribuzione beta dai test precedenti) + osservazioni (nuovi dati) → posterior (credenza aggiornata). Dal giorno 3 il test può già dire "con probabilità del 73%, $4.99 è migliore", al giorno 7 sale all'89%, al giorno 10 il regret scende sotto l'1% e il test si arresta.

## Costruire la Prior Distribution: Dati Storici IAP Anziché Benchmark

La qualità del test bayesiano dipende da come si costruisce la prior. La maggior parte della documentazione dice "usa una prior uniforme, lascia che parlino i dati", ma se avete 6 mesi di storico IAP è irrazionale sprecare questa risorsa. Un processo di costruzione della prior:

**Passo 1:** Estrarre la distribuzione delle conversion rate di tutti i tier IAP degli ultimi 6 mesi. Tra $0.99 e $2.99 le conversion variano dal 1.8% al 3.2%, con mediana al 2.4%. I parametri della distribuzione beta che riflettono questa distribuzione sono alpha=24, beta=976 (media = alpha/(alpha+beta) ≈ 0.024).

**Passo 2:** Aggiungere la varianza a livello di segmento. Il cohort organico ha una prior di conversion superiore di circa il 18% rispetto al cohort UA (alpha=28, beta=972). Per il segmento whale, i D30+ paying user mostrano una conversion dell'6.8%, quindi alpha=68, beta=932.

**Passo 3:** Codificare nella prior la curva di elasticità del prezzo. Nei dati storici, il passaggio da $1.99 a $2.99 ha ridotto la conversion in media del 14%. Se il nuovo test riguarda $2.99 → $3.99, si incorpora questo slope nella prior:

```python
def price_elasticity_prior(base_price, new_price, base_conversion):
    slope = -0.14 / 1.00  # riduzione del 14% per $1 di aumento
    delta = new_price - base_price
    expected_drop = slope * delta
    adjusted_conversion = base_conversion * (1 + expected_drop)
    alpha = adjusted_conversion * 1000
    beta = 1000 - alpha
    return alpha, beta
```

Questo approccio riflette il comportamento specifico del vostro gioco e cohort, non un "benchmark di industria del 2.5%".

## Stima Posterior e Ladder di Prezzo Segmentato

Setup del test: starter pack $2.99 vs $3.99, 7 giorni, distribuito al 50/50 sul traffico UA. Ma la segmentazione è obbligatoria:

| Segmento | Prior α | Prior β | Dimensione campionaria target |
|----------|---------|---------|-------------------------------|
| D0-D7 organico | 28 | 972 | 4000 |
| D0-D7 UA | 22 | 978 | 6000 |
| D7+ non-pagatore | 18 | 982 | 3000 |
| D7+ acquirente precedente | 68 | 932 | 2000 |

Ogni segmento aggiorna il suo posterior indipendentemente. Al giorno 3 i risultati sono:

**Segmento organico:** $2.99 → 87 conversion / 2100 esposizioni, $3.99 → 71 / 2050. Posterior: α₁=28+87=115, β₁=972+2013=2985 vs α₂=28+71=99, β₂=972+1979=2951. Con Monte Carlo su 10.000 campioni: P($2.99 migliore) = 78%. Dal lato revenue: $2.99 × 87 = $260, $3.99 × 71 = $283. Se il posterior del revenue è modellato con una distribuzione gamma, P($3.99 revenue superiore) = 61%.

A questo punto la decisione: se la priorità nel segmento organico è la conversion, mantieni $2.99; se è il revenue, aspetta 2 giorni. Nel segmento UA invece $3.99 è chiaramente superiore (83% posterior probability), quindi il test si arresta per quel segmento e il traffico passa a $3.99.

**Costruzione dinamica della ladder di prezzo per segmento:** Alla fine del test l'inventario IAP diventa:

- Organico D0-D3: starter $2.99
- UA D0-D3: starter $3.99
- D7+ acquirente precedente: booster $7.99 (da posterior di test separato)
- Whale (D30+ LTV $50+): premium bundle $14.99

Questa struttura ottimizza 4 curve di elasticità diverse invece di un singolo prezzo globale. Quando questa segmentazione si combina con la strategia [App Store Optimization](https://www.roibase.com.tr/it/aso), il funnel IAP diventa ancora più personalizzato: la value proposition mostrata nel creative si allinea con il tier IAP.

## Thompson Sampling come Estensione Multi-Armed Bandit

Anziché un test fisso di 7 giorni, usare Thompson sampling: a ogni impression, campionare il posterior di ogni segmento, mostrare il prezzo con il valore atteso più alto. Così durante il test l'equilibrio exploration/exploitation si regola dinamicamente.

Pseudo-codice:

```python
def thompson_sampling_price(segment, price_variants):
    posteriors = {p: get_posterior(segment, p) for p in price_variants}
    samples = {p: np.random.beta(post['alpha'], post['beta']) 
               for p, post in posteriors.items()}
    revenue_samples = {p: s * p for p, s in samples.items()}
    return max(revenue_samples, key=revenue_samples.get)
```

Questo metodo è particolarmente efficace quando si testano 3+ varianti di prezzo: un test A/B classico su 3 prezzi richiede 3× la dimensione campionaria, mentre Thompson sampling con aggiornamento posterior azzera automaticamente le varianti peggiori. Al giorno 10, se il posterior di $2.99 è sceso al 9%, la percentuale di esposizioni a quel prezzo crolla al 5%, senza spreco di campioni.

Attenzione: se il traffico UA è limitato, Thompson sampling comporta rischio di esaurimento budget. Se una campagna Meta ha $5000 di budget giornaliero e Thompson sceglie un prezzo con conversion bassa, il CPA esplode e il budget finisce a mezzogiorno. Setup sicuro: primi 3 giorni split 50/50, quando la credibilità posterior supera l'80%, attivare Thompson.

## Revenue vs LTV: Integrare il Posterior con Modelli di Retention

L'ultimo livello dell'ottimizzazione dei prezzi IAP è la proiezione LTV. Se $3.99 ha una conversion inferiore ma una retention a D7 superiore dell'8%, l'LTV a 90 giorni di quel cohort potrebbe superare quello a $2.99. Un A/B classico non lo vede perché l'LTV si consolida in 90 giorni. Integrando il posterior bayesiano con un modello di sopravvivenza il segnale precoce emerge.

Setup: per ogni variante di prezzo, durante i primi 7 giorni, fit della curva di retention con un modello Cox proportional hazard:

```python
from lifelines import CoxPHFitter

df['price_variant'] = df['variant'].map({'2.99': 0, '3.99': 1})
cph = CoxPHFitter()
cph.fit(df, duration_col='days_retained', event_col='churned', 
        formula='price_variant + segment + paid_d3')
```

Output del modello: la variante $3.99 ha un hazard ratio di 0.88 (churn inferiore del 12%, p=0.03). Si integra questo nel posterior:

**Calcolo posterior LTV:**
- $2.99: E[conversion]=0.024, E[D90_retention]=0.34, ARPDAU=$0.12 → LTV=$2.99 × 0.024 + 90 × 0.34 × 0.12 = $3.74
- $3.99: E[conversion]=0.019, E[D90_retention]=0.38, ARPDAU=$0.15 → LTV=$3.99 × 0.019 + 90 × 0.38 × 0.15 = $5.21

Con Monte Carlo su 10.000 iterazioni la distribuzione posterior dell'LTV: P(LTV $3.99 superiore) = 91%. Questa credibilità posterior è un segnale molto più forte rispetto a una valutazione basata solo su revenue. Decisione: scegli $3.99 e ribilancia lo stack IAP.

## Trade-off: Complessità del Modello vs Velocità di Esecuzione

L'ottimizzazione bayesiana dei prezzi IAP comporta tre costi operazionali:

**1. Manutenzione della prior:** Ogni nuovo evento, cambiamento meta, lancio di competitor modifica le distribuzioni della prior. La ricalibratura ogni 6 mesi è obbligatoria. In studi piccoli senza data scientist questo diventa insostenibile.

**2. Granularità del segmento:** 8 segmenti × 3 prezzi = 24 posterior da tracciare. In segmenti piccoli (ad es. whale) la varianza posterior rimane alta e gli intervalli di confidenza ampi. Soluzione pratica: estrapolate il segmento whale, mantenetevi un A/B test classico, applicate il bayesiano agli altri.

**3. Frammentazione di piattaforma:** iOS vs Android hanno sensibilità al prezzo diverse. Su Apple App Store la conversion a $2.99 è il 23% più alta che su Android (App Annie 2025). Due posterior separate per piattaforma o una pooled? Separate e il campione si riduce, pooled e entra il bias di piattaforma. Soluzione: modello bayesiano gerarchico — platform come random effect.

Comunque il bayesiano è più veloce del fermo attesa in A/B. Il test finisce in 10 giorni, l'impatto revenue è visibile in 2 settimane, la proiezione LTV si aggiorna a giorno 30. In frequentista questa timeline è 8-12 settimane.

## Conclusione: Mentalità Probabilistica del Pricing

Nel F2P mobile il pricing non è più binario, è un processo continuo di aggiornamento posterior. Anziché risolvere conversion e revenue con p-value separati, modellarli insieme in un framework probabilistico minimizza il regret, accorcia i tempi di test, consente l'ottimizzazione a livello di segmento. L'approccio bayesiano richiede disciplina nel costruire la prior, ma in cambio offre il diritto a decisioni precoci, integrazione della proiezione LTV e allocazione dinamica con Thompson sampling. Se lo stack IAP ha 5+ tier e il budget UA mensile supera i $100K, l'infrastruttura di test bayesiano non è più opzionale.