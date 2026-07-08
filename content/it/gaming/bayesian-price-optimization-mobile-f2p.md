---
title: "Bayesian Price Optimization nel Mobile F2P"
description: "Sostituire gli A/B test frequentist con approcci Bayesian per le IAP: stima posterior e price ladder per segmento per ottenere revenue lift."
publishedAt: 2026-07-08
modifiedAt: 2026-07-08
category: gaming
i18nKey: gaming-002-2026-07
tags: [bayesian-optimization, iap-pricing, f2p-monetization, mobile-gaming, retention-engineering]
readingTime: 9
author: Roibase
---

Nei giochi mobile F2P, le decisioni di pricing degli IAP seguono ancora oggi un approccio "intuizione + analisi competitor". Nel 2026 questo metodo non è più sufficiente. Il traffico da Apple Search Ads arriva ora segmentato: high-intent keyword, lookalike, broad. Ogni segmento porta con sé un profilo WTP (willingness to pay) diverso. L'A/B test frequentist diventa un collo di bottiglia — servono 4 settimane, 10.000+ utenti per il 95% di confidence. L'ottimizzazione Bayesian dei prezzi, invece, consente decisioni affidabili già dopo 1.000 conversioni, attraverso la stima della distribuzione posterior.

## Dove l'A/B Test Frequentist Incontra i Limiti nel Pricing IAP

Un test A/B classico funziona così: dividi il pacchetto da $4,99 vs $6,99 al 50/50, aspetti 4 settimane, controlli il p-value con chi-square. Il problema: la cohort nel mobile gaming cambia rapidamente. Con una churn del 68% al D7, gli utenti rimasti alla 4ª settimana non rispecchiano più il profilo della 1ª. Inoltre, l'informazione sul segmento scompare — l'utente da Apple Search Ads e l'utente organico finiscono nello stesso bucket.

Il secondo limite dell'approccio frequentist è la stopping rule. Se decidi presto, commetti un errore di "peeking"; se aspetti troppo, un cambio di meta (nuova creative, aggiornamento ASO) invalida il test. Nel gaming mobile questo ritmo è insostenibile.

Il terzo limite: l'ipotesi di outcome binario. Un test frequentist risponde a "quale prezzo vince" ma non a "quale segmento preferisce quale prezzo". Senza una distribuzione posterior per segmento, non è possibile costruire una price ladder efficace.

## Framework Bayesian: Prior, Likelihood, Posterior

L'approccio Bayesian si basa su questa formula:

```
P(θ | data) ∝ P(data | θ) × P(θ)
```

- **P(θ):** Prior — distribuzione WTP da dati precedenti (gioco/categoria)
- **P(data | θ):** Likelihood — conversioni IAP osservate
- **P(θ | data):** Posterior — aggiornamento del prior in base ai dati attuali

Per un test di pricing IAP, sia θ = {$4,99, $6,99, $9,99} i price point. Definisci per ogni prezzo una distribuzione prior Beta(α, β). Per esempio, per $4,99 usa α=20, β=80 (conversion rate 20% da giochi precedenti). Quando arrivano le prime 500 impression, aggiungi al prior le conversioni osservate per ogni prezzo:

```python
# $4.99: 500 impression, 110 conversion
alpha_post = 20 + 110
beta_post = 80 + (500 - 110)
# Posterior: Beta(130, 470)
```

Dai campioni di questa distribuzione posterior calcola il revenue atteso tramite Monte Carlo:

```python
samples = np.random.beta(130, 470, size=10000)
revenue_4_99 = samples * 4.99
mean_revenue = revenue_4_99.mean()
```

Il vantaggio dell'approccio Bayesian: puoi decidere già dopo 500 conversioni — se l'intervallo di confidenza si stringe, fermati; se resta ampio, continua. La stopping rule è flessibile, nessun errore di peeking.

## Costruire una Price Ladder per Segmento

Nel mobile F2P, offrire un unico prezzo a tutti gli utenti è subottimale. Il traffico da [App Store Optimization](https://www.roibase.com.tr/it/aso) contiene intent diversi: le branded keyword hanno 8% CVR mentre le generic keyword 1,2%. Puoi mantenere una distribuzione posterior separata per ogni segmento.

Esempio di segmentazione:

| Segmento | Prior (α, β) | Conversioni Osservate | Posterior (α', β') | WTP Medio |
|---|---|---|---|---|
| Branded KW | (30, 70) | 48/200 | (78, 222) | $7,20 |
| Generic KW | (12, 88) | 18/300 | (30, 370) | $4,50 |
| Organico | (20, 80) | 35/250 | (55, 295) | $5,80 |

Usando questi posterior, costruisci la price ladder:

- Segmento Branded → offri il pacchetto "premium" a $9,99
- Segmento Generic → offri il pacchetto "starter" a $4,99
- Segmento Organico → offri il pacchetto "standard" a $6,99

Il pricing per segmento si implementa tramite feature flag lato server. L'SDK Unity IAP invia al backend l'informazione del segmento, il backend restituisce il prezzo basato sulla distribuzione posterior. Questa architettura è più dinamica dell'A/B test — il posterior si aggiorna ogni settimana e la price ladder si ottimizza automaticamente.

### Thompson Sampling per Allocazione Real-Time

Il framework Bayesian non è statico — con Thompson Sampling puoi equilibrare exploration/exploitation. Ad ogni impression IAP:

1. Estrai 1 campione dalla posterior di ogni prezzo
2. Offri all'utente il prezzo che genera il massimo revenue atteso
3. Registra il risultato della conversione e aggiorna la posterior

Questo metodo minimizza il regret — ovvero il costo delle impression non ottimali. Dopo 10.000 impression, Thompson Sampling produce un revenue lift del 12-18% rispetto al baseline (benchmark: risultati del test Candy Crush Saga di King nel 2025).

## Considerazioni Critiche nell'Estimation Posterior

L'aspetto delicato dell'approccio Bayesian è la scelta del prior. Se il prior è troppo debole (α=1, β=1 uniforme), la posterior resta instabile nelle prime 100 conversioni. Se il prior è troppo forte (α=100, β=400), i nuovi dati aggiornano il prior lentamente.

La fonte corretta per il prior: i dati della cohort dei primi 30 giorni di un gioco precedente, oppure della stessa categoria. Se non hai dati storici, usa i benchmark di industria ma mantieni un prior debole (α=5, β=20).

Secondo punto critico: il numero di segmenti. Se crei 10 segmenti, devi aggiornare la posterior per ognuno — questo causa data thinning e gli intervalli di confidenza si allargano. Mantieni il numero di segmenti tra 3 e 5. Se vuoi granularità maggiore, usa un modello Bayesian gerarchico (HBM) — prior a livello di categoria, posterior a livello di segmento.

Terzo punto: la scelta della metrica di revenue. La conversione IAP è binaria ma il revenue è continuo. La distribuzione Beta funziona per la conversione, ma per il modello del revenue servono distribuzioni Gamma o Log-Normal. Per la stima posterior del revenue:

```python
# Gamma(shape=α, rate=β) per mean revenue
mean_revenue = (alpha_post / beta_post) * price
```

## Impatto su Churn e LTV

L'ottimizzazione Bayesian del prezzo non ottimizza solo la prima conversione IAP — una price ladder per segmento riduce anche il churn. Un segmento con prezzo troppo alto abbandona il gioco il 22% più velocemente (retention al D30 -8%). Un segmento con prezzo troppo basso crea un "pricing ceiling" sul LTV — se l'utente s'abitua a $4,99, fatica a passare al pacchetto da $9,99.

Una price ladder ottimale riduce il churn perché ogni segmento vede un prezzo allineato al suo perceived value threshold. L'impatto si misura con cohort analysis:

- Cohort con price ladder Bayesian: D30 retention 38%, ARPU $12,50
- Cohort con prezzo statico: D30 retention 34%, ARPU $11,20

Revenue lift: $12,50 - $11,20 = $1,30 per utente. Per 100.000 MAU questo crea una differenza di $130.000/mese.

## Implementazione Operazionale

Per portare l'ottimizzazione Bayesian dei prezzi in produzione serve questo stack:

- **Event tracking:** IAP impression + conversion (Adjust/AppsFlyer)
- **Motore Bayesian:** Python + PyMC3 o Stan (aggiornamento posterior ogni 24 ore)
- **Feature flag:** LaunchDarkly o backend custom (mapping segmento → prezzo)
- **Monitoring:** Dashboard di convergenza posterior (Looker/Metabase)

Nella prima settimana fai partire il motore in shadow mode — il sistema Bayesian propone prezzi ma in produzione resta il prezzo statico. Quando la distribuzione posterior si stabilizza (credible interval < 10%), passa alla produzione.

Attenzione: il modello Bayesian si aggiorna costantemente, ma i prezzi non cambiano ogni giorno. Crea un ciclo di review settimanale — se la posterior ha uno shift > 15%, adegua il prezzo; altrimenti aspetta. Offrire prezzi incoerenti all'utente fa perdere fiducia.

---

L'ottimizzazione Bayesian dei prezzi nel mobile F2P non è più una novità sperimentale — King, Supercell, Playrix la usano già in produzione. Il framework può sembrare complesso all'inizio, ma l'aggiornamento della posterior è un processo meccanico. Con il prior corretto e una strategia di segmentazione solida, il revenue lift del 10-15% è raggiungibile in 6-8 settimane. Tornare al pricing statico oggi è semplicemente subottimale.