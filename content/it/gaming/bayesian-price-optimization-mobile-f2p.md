---
title: "Bayesian Price Optimization nel Mobile F2P"
description: "Ottimizza i test dei prezzi IAP con la stima posterior. Segmentazione, durata del test, trade-off di conversione — il framework reale per aumentare i ricavi F2P."
publishedAt: 2026-06-24
modifiedAt: 2026-06-24
category: gaming
i18nKey: gaming-002-2026-06
tags: [f2p-monetization, bayesian-optimization, iap-testing, mobile-gaming, pricing-strategy]
readingTime: 9
author: Roibase
---

Nel mobile F2P, l'ottimizzazione dei prezzi avviene ancora con la logica A/B test classica: due price point, 7-14 giorni, si sceglie il vincente. Ma quando il conversion rate sale dal 2,8% al 3,1%, è davvero un guadagno o avete perso il segmento whale e diminuito il valore LTV complessivo? Un test frequentist classico vi dice "quale variante ha vinto" ma non risponde alla domanda "quale prezzo per quale segmento di utenti e in quale momento?". L'ottimizzazione bayesiana dei prezzi colma questo vuoto — aggiornando la vostra ladder IAP sulla distribuzione posterior potete ottimizzare sia la conversione che il revenue specifico per segmento.

## Perché il Test Frequentist A/B è Insufficiente nel F2P

Il test A/B classico funziona su due assunzioni: (1) il comportamento dell'utente rimane stabile durante il test, (2) la variante vincente è ottimale per tutti i segmenti. Nel F2P entrambe sono sbagliate. Il comportamento utente varia dopo 72 ore, al 7° giorno e al 30° — lo stesso prezzo ha performance diverse in cohort di retention differenti. Un esempio: lo starter pack a $4,99 mostra conversione al 3,5%, la variante $9,99 al 2,8% — con logica A/B classica vince $4,99. Ma l'analisi LTV a 30 giorni rivela che $9,99 nel segmento whale (top 5% spender) genera il 42% di lifetime spend più alto. Il test frequentist non vede questa dinamica perché non esegue stima posterior per segmento.

Il secondo problema è la durata fissa del test. Un A/B test dura 14 giorni, poi si decide — ma al 14° giorno potreste non aver raggiunto potenza statistica sufficiente. Con l'approccio bayesiano la distribuzione posterior si aggiorna continuamente, potete fermarvi presto quando raggiungete confidence sufficiente o estendere se il risultato è ambiguo. Nel F2P questo è critico perché il calendario live ops non aspetta due settimane — arriva un nuovo evento, cambia il contesto pricing, il risultato del test diventa storico.

Il terzo problema è la logica di decisione binaria. Il test frequentist vi dice "A ha vinto", ma nel F2P non esiste una variante vincente — il prezzo giusto è quello giusto nel segmento giusto al momento giusto. L'ottimizzazione bayesiana, grazie alla stima posterior, fornisce per ogni segmento l'optimal price range, che diventa input per il vostro dynamic pricing engine.

## Bayesian Price Ladder Test: Aggiornamento Iterativo con Stima Posterior

L'ottimizzazione bayesiana dei prezzi funziona su tre livelli: prior distribution (dati da test precedenti + domain knowledge), likelihood function (dati di conversione attuali), posterior distribution (il loro prodotto — credenza aggiornata). Nel test dei prezzi IAP si applica così:

**Definizione del prior:** Dai test di prezzo precedenti avete conversion rate e revenue distribution. Ad esempio per l'IAP $4,99 il vostro prior di conversione è Beta(120, 3800) — 120 conversioni, 3800 impressioni. Questo è il baseline del vostro gioco. Se aggiungete $6,99 al test, definite il prior con domain knowledge: quando il prezzo sale del 40%, la conversione tipicamente cala del 25-35% (elasticità -0,6 a -0,9). Il vostro prior potrebbe essere Beta(80, 3840).

**Aggiornamento della likelihood:** Il test inizia, ogni giorno arrivano nuovi dati di conversione. Il framework bayesiano aggiorna il posterior ogni giorno. Al 3° giorno la variante $6,99 mostra 45 conversioni, 1200 impressioni — likelihood Beta(45, 1155). Posterior = prior × likelihood = Beta(125, 4995). Questo vi fornisce la stima attuale del conversion rate: 125/(125+4995) ≈ 2,44%. L'importante è che non è solo una point estimate, è una distribuzione — l'intervallo credibile al 95% è [2,1%, 2,8%]. In altre parole la conversione ha il 95% di probabilità di trovarsi tra 2,1% e 2,8%.

**Thompson Sampling per allocazione dinamica:** Nell'A/B classico il traffico si divide 50-50. Nell'ottimizzazione bayesiana usate Thompson Sampling: per ogni impression campionate dalla distribuzione posterior, presentate la variante con expected revenue più alto. Così mentre il test progredisce, il traffico si concentra sulla variante che performa meglio, ma non allocate il 100% — continuate a esplorare. Nel F2P è importante perché il segmento whale è piccolo ma ad altissimo valore, se lo eliminate presto lo perdete.

Esempio di codice (Python + PyMC):

```python
import pymc as pm
import numpy as np

# Prior: conversione IAP $4,99
prior_alpha_499 = 120
prior_beta_499 = 3800

# Variante $6,99 — nuovo test
conversions_699 = 45
impressions_699 = 1200

with pm.Model() as price_test:
    # Aggiornamento posterior
    conv_rate_699 = pm.Beta('conv_rate_699', 
                             alpha=prior_alpha_499*0.7 + conversions_699,
                             beta=prior_beta_499*1.0 + (impressions_699 - conversions_699))
    
    # Expected revenue (prezzo IAP × conversione)
    expected_revenue = conv_rate_699 * 6.99
    
    # Sampling
    trace = pm.sample(2000, return_inferencedata=True)

# Intervallo credibile al 95%
print(pm.summary(trace, var_names=['conv_rate_699']))
```

Questo approccio vi dice "al 3° giorno la conversione $6,99 è 2,1%-2,8%, expected revenue $0,17/user" — mentre il test continua l'intervallo si restringe.

## Price Ladder Specifico per Segmento: Ottimizzazione Whale, Dolphin, Minnow

Nel F2P non tutti gli utenti reagiscono allo stesso prezzo allo stesso modo. Se non fate stima posterior per segmento, ottimizzate la conversione media ma perdete il revenue specifico per segmento. Tre segmenti principali:

**Whale (top 5% spender):** LTV $200+, numero IAP 8+, retention D30 85%+. Questo segmento ha bassa sensibilità al prezzo — se $9,99 converte il 15% meno ma lifetime spend è 60% più alto, è comunque ottimale. La stima posterior qui risponde: "$9,99 è ottimale nel segmento whale, o $14,99 genera LTV più alto?". Durante il test monitorate la conversione whale separatamente, il posterior whale-specifico si aggiorna. Esempio: conversione generale $9,99 è 2,8% ma nel segmento whale è 6,2% — per questo segmento dovete testare un price point più alto.

**Dolphin (mid 25% spender):** LTV $20-50, numero IAP 2-4, retention D30 50-70%. Sensibilità al prezzo media. Nel segmento dolphin il test bayesiano tipicamente trova l'optimal price range: tra $4,99 e $6,99, quale genera più expected revenue. La distribuzione posterior può essere bimodale qui — alcuni dolphin comportarsi come whale (spike nel weekend), altri scivolare verso minnow. Raffinamento della segmentazione necessario.

**Minnow (rimanente 70%):** LTV <$10, la maggior parte non spende. Sensibilità al prezzo molto alta — anche solo tra $2,99 e $4,99 la conversione può variare del 40%. In questo segmento il test bayesiano tipicamente rivela: il price point più basso ($0,99-$1,99) massimizza la conversione ma il revenue totale è basso. La strategia: attirate i minnow con un "impulse buy" $0,99, poi indirizzteli alla ladder $4,99.

Per stima posterior specifica per segmento usate un modello gerarchico bayesiano:

```python
with pm.Model() as hierarchical_price:
    # Prior di conversione globale
    global_alpha = pm.Gamma('global_alpha', alpha=2, beta=0.1)
    global_beta = pm.Gamma('global_beta', alpha=2, beta=0.1)
    
    # Conversione specifica per segmento
    conv_whale = pm.Beta('conv_whale', alpha=global_alpha, beta=global_beta)
    conv_dolphin = pm.Beta('conv_dolphin', alpha=global_alpha, beta=global_beta)
    conv_minnow = pm.Beta('conv_minnow', alpha=global_alpha, beta=global_beta)
    
    # Likelihood (dati per segmento)
    whale_obs = pm.Binomial('whale_obs', n=200, p=conv_whale, observed=12)
    dolphin_obs = pm.Binomial('dolphin_obs', n=800, p=conv_dolphin, observed=24)
    minnow_obs = pm.Binomial('minnow_obs', n=3000, p=conv_minnow, observed=60)
    
    trace = pm.sample(3000)
```

Questo modello collega le conversioni whale, dolphin, minnow con un prior globale — anche con campioni piccoli fornisce stime ragionevoli.

## Durata del Test e Stopping Rule: Decisione tramite Probabilità Posterior

Nell'A/B classico la durata del test è predeterminata (14 giorni, minimo 1000 conversioni). Nell'ottimizzazione bayesiana lo stopping rule si basa sulla probabilità posterior: "Qual è la probabilità che la Variante A sia migliore della Variante B di oltre il 95%?". Questo arresto dinamico fornisce guadagni precoci e riduce il rischio di falsi positivi.

**Esempio di stopping rule:** Test $4,99 vs $6,99 IAP. Ogni giorno il posterior si aggiorna. Al 5° giorno calcolate la probabilità posterior:

```python
# Sample posterior
samples_499 = trace.posterior['conv_rate_499'].values.flatten()
samples_699 = trace.posterior['conv_rate_699'].values.flatten()

# Confronto revenue (prezzo × conversione)
revenue_499 = samples_499 * 4.99
revenue_699 = samples_699 * 6.99

# Probabilità che $6,99 sia migliore
prob_699_better = (revenue_699 > revenue_499).mean()
print(f"P($6,99 > $4,99) = {prob_699_better:.2%}")
```

Al 5° giorno P($6,99 > $4,99) = 73% — non decidete ancora. Al 9° giorno 94% — ancora sotto la soglia 95%. Al 12° giorno 96% — fermate il test, $6,99 è ottimale. Questo approccio risparmia 2-5 giorni rispetto al frequentist.

**Durata minima del test:** Anche se Bayesian si ferma presto, nel F2P mantenete almeno 7 giorni — nella prima settimana vedete spike di retention, comportamento degli spender nel weekend, effetto dell'evento. Se fermate prima il posterior è distorto.

**Minimizzazione del regret:** Con Thompson Sampling, durante il test allocate traffico alla variante subottimale (exploration). Regret = revenue ottimale - revenue effettivo. Il framework bayesiano minimizza il regret perché con l'aggiornamento posterior l'exploration cala e l'exploitation sale. In un test di 14 giorni i primi 5 giorni hanno regret 30%, gli ultimi 5 giorni regret 5% — media 15%. Nell'A/B classico con split 50-50 costante il regret medio è 25-30%.

## Passaggio in Production: Dynamic Pricing Engine e Refinement Posterior Continuo

Il test è finito, $6,99 ha vinto — ma non è finita. La vera forza dell'ottimizzazione bayesiana dei prezzi emerge in production con il refinement posterior continuo. Il risultato del test non è un price point statico ma input per il vostro dynamic pricing engine.

**Architettura del dynamic pricing engine:** In ogni sessione utente fate stima del segmento (LTV prediction, retention cohort, spending velocity). A seconda del segmento, campionate il price point ottimale dalla distribuzione posterior. Esempio: nuovo utente, retention D1 80%, primo IAP ancora da fare — prior minnow dominante, campionate dal range $0,99-$1,99. Lo stesso utente al D7 ha fatto 2 IAP, spend totale $8 — il posterior dolphin si rafforza, passate al range $4,99-$6,99.

**Refinement posterior:** In production ogni conversione aggiorna il posterior. Dopo 30 giorni l'IAP $6,99 ha generato 1200 conversioni aggiuntive — prior Beta(125, 4995), nuovo posterior Beta(1325, 46995). L'intervallo credibile si restringe: [2,7%, 2,9%]. Ora fidate al 95% del prezzo $6,99. Ma il mercato cambia — competitor lancia campagna $4,99, la conversione cala — il posterior si allarga di nuovo, un nuovo test si attiva.

**Integrazione con multi-armed bandit:** Se la vostra IAP ladder ha più SKU (starter pack $4,99, mega pack $19,99, ultimate $49,99), Thompson Sampling diventa algoritmo bandit in production. Per ogni impression campionate il posterior di ogni SKU, presentate quello con expected revenue massima. Integrato con i lavori di [Strategia di contenuti geografici](https://www.roibase.com.tr/it/geo), questo crea un potente motore di monetization — ASO indirizza il traffico al segmento giusto, Bayesian pricing fornisce al segmento l'IAP ottimale.

**Monitoraggio e alert:** Se la distribuzione posterior cambia improvvisamente (intervallo credibile si allarga del 50% in 3 giorni) è segnale di anomalia — bug della piattaforma, campagna competitor, effetto stagionale. Costruite il sistema di alert sulla variance posterior:

```python
# Monitoraggio variance posterior
variance_699 = trace.posterior['conv_rate_699'].var()
if variance_699 > threshold:
    trigger_alert("Variazione test prezzo — investigare")
```

Nel mobile F2P, l'ottimizzazione dei prezzi non è più "test una volta, usa per sempre" — è un sistema che raffina continuamente con stima bayesiana, ottimizzato per segmento, dinamico. Se la vostra IAP ladder è testata con logica frequentist, state lasciando il revenue whale sul tavolo. Il