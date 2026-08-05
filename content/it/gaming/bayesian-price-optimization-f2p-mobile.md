---
title: "Ottimizzazione dei Prezzi tramite Bayesian Testing nei Mobile F2P"
description: "Ottimizzare i livelli di prezzo IAP con test Bayesiani: metodologia di stima posteriore, pricing basato su segmenti e calcolo del revenue lift."
publishedAt: 2026-08-05
modifiedAt: 2026-08-05
category: gaming
i18nKey: gaming-002-2026-08
tags: [f2p-monetization, bayesian-testing, iap-optimization, price-ladder, mobile-gaming]
readingTime: 9
author: Roibase
---

Nei giochi mobile F2P, l'ottimizzazione dei prezzi IAP viene solitamente ridotta a un test A/B: confronta due prezzi, scegli quello con il revenue più alto. Questo approccio funzionava nel 2018 perché i costi UA erano bassi e non c'erano problemi di dimensione campionaria. Nel 2026 la situazione è diversa: dopo iOS 14.5 il cohort tracking è compromesso, Apple Search Ads ha visto un aumento del CPI del 340%, i tempi di test sono passati da 8 a 14 settimane. La metodologia Bayesiana offre due vantaggi in queste condizioni: con la distribuzione posteriore è possibile prendere decisioni anticipate, e la segmentazione rafforza il modello grazie alla prior knowledge. Nell'economia dei giochi, l'elasticità di prezzo non è costante — si comporta diversamente nei segmenti whale/dolphin/minnow, e catturare questa differenza va oltre le capacità del test A/B frequentista.

## La Logica Economica dei Test Bayesiani

Nei mobile F2P, il costo di un price test non è solo il tempo di sviluppo, ma anche l'opportunità persa. Se state testando $4.99 versus $6.99 e aspettate 14 settimane, il revenue perso mentre cercate il prezzo giusto è il costo del test stesso. L'approccio Bayesiano aggiorna la distribuzione posteriore ogni giorno — il conversion rate non è il 2.3%, ma si colloca tra l'1.8% e il 2.9% con intervallo di credibilità al 95%. Man mano che l'intervallo si restringe, la decisione diventa più netta e potete terminare il test anticipatamente.

Nel test A/B frequentista, calcolate la sample size minima per p-value <0.05 e aspettate di raggiungere quel numero. Nei mobile game, invece, la dimensione della cohort oscilla quotidianamente: un nuovo feature launch aumenta i DAU del 40%, la stagionalità estiva li riduce del 25%. Il modello Bayesiano interpreta queste fluttuazioni come aggiornamenti della prior, non rimane ancorato a un piano con sample size fisso.

Esempio pratico: in un gioco con 10.000 DAU state testando il prezzo dello starter pack a $9.99. Il calcolo frequentista richiede 42.000 utenti per rilevare un lift del +5% in 6 settimane. Il modello Bayesiano alla 3ª settimana mostra una media posteriore di $11.2 ARPPU, contro $10.8 del control, con intervalli di credibilità che non si sovrappongono — la decisione è presa, il test si chiude. Il revenue perso viene recuperato in 3 settimane anziché 6.

### Scelta della Prior e Segmentazione

Nei test Bayesiani, la scelta della distribuzione prior non è soggettiva, ma si basa su dati storici. Se nell'anno precedente avete testato 8 price point tra $4.99 e $9.99 in un gioco simile, da quei dati ricavate una distribuzione beta come prior. La prior può essere debole (varianza alta) ma comunque migliore di una prior uniforme non informativa, perché sapete che il conversion rate dei whale non scenderà sotto lo 0.5%.

La segmentazione rafforza la prior: per i nuovi utenti usate una prior non informativa, per gli utenti con retention >30 giorni usate una prior ristretta. Il modello Bayesiano gerarchico stima simultaneamente i parametri a livello di segmento e a livello globale — ogni segmento utilizza i propri dati mentre il trend globale viene condiviso. Questo approccio previene l'overfitting nei segmenti piccoli.

## Architettura della Price Ladder IAP

Nei giochi F2P, la price ladder non è piatta ma distribuita su scala logaritmica: $0.99, $2.99, $4.99, $9.99, $19.99, $49.99, $99.99. Questi salti hanno una ragione psicologica (charm pricing) ma la ragione economica è più forte: ogni livello cattura un segmento diverso di willingness-to-pay. Nell'ottimizzazione Bayesiana, ogni livello della scala ha la propria distribuzione posteriore e si influenzano reciprocamente — se aumentate $4.99, il conversion a $2.99 può diminuire (downgrade) mentre $9.99 aumenta (upgrade).

Nel test della ladder, non viene ottimizzato un singolo prezzo ma l'intera scala. Un algoritmo multi-armed bandit vede ogni price point come un braccio distinto e usa Thompson Sampling per estrarre da ogni posteriore attuale e selezionare quello con il revenue atteso più alto. Nelle prime 2 settimane tutti i bracci vengono esplorati equamente (14% di traffico ciascuno), dalla 3ª settimana in poi l'exploitation aumenta man mano che la confidenza posteriore cresce.

Scenario di esempio: ladder a 7 livelli, test di 21 giorni. Nei primi 7 giorni ogni prezzo riceve il 14% del traffico (uniforme). Dal giorno 8 in poi il prezzo con il prodotto posteriore mean × conversion rate più alto attira il traffico. Al giorno 21, $4.99 riceve il 40% del traffico, $9.99 il 25%, gli altri il 5-10%. Nella decisione finale, $4.99 e $9.99 vengono mantenuti insieme perché entrambi generano marginal revenue positivo senza cannibalizzarsi reciprocamente.

### Pricing Basato su Segmenti

Lo stesso prezzo non funziona per i segmenti whale/dolphin/minnow perché l'elasticità di prezzo è diversa. Gli utenti whale (top 1% di spender) acquistano il pacchetto a $99.99 e se il prezzo aumenta del 20% il conversion cala solo del 3% — inelastico. Gli utenti minnow (che acquistano $0.99 nei primi 7 giorni) con un aumento del prezzo del 10% vedono un calo del 18% — elastico. Il modello Bayesiano codifica questa elasticità nella prior a livello di segmento.

Le feature utilizzate per la segmentazione sono: giorni trascorsi dall'install, spend totale, tempo trascorso dall'ultimo IAP, session frequency, progressione di livello. Da queste feature viene creata una prior per i segmenti latenti — il modello gerarchico stima anche l'appartenenza al segmento. Quando arriva un nuovo utente, il suo comportamento nelle prime 24 ore consente di prevedere il segmento e di mostrargli il prezzo corrispondente.

Il lavoro di Roibase su [App Store Optimization](/tr/aso) impiega una segmentazione simile: i risultati dei test creativi variano in base al segmento di utenti; lo stesso creative fornisce l'8% di IPM per gli utenti iOS 16+ ma solo il 3% per iOS 15. Quando ASO e ottimizzazione IAP convergono, viene garantita l'integrità del funnel — per mostrare il prezzo giusto all'utente giusto, prima dovete attrarre l'utente giusto.

## Stima Posteriore e Meccanismo Decisionale

Nel test Bayesiano, la metrica di decisione è la probabilità posteriore di superiorità: $P(\text{treatment} > \text{control} | \text{dati})$. Quando questa probabilità supera il 95%, il treatment vince. La differenza dal p-value frequentista è: il p-value misura l'estremità dei dati sotto l'ipotesi nulla, la probabilità posteriore misura direttamente "la probabilità che il treatment sia migliore".

Per il calcolo posteriore, se usate una prior coniugata la soluzione è analitica (beta-binomiale), altrimenti usate MCMC (Markov Chain Monte Carlo). Nei test di mobile gaming con conversion binomiale + modello di revenue lognormale, il sistema è ibrido — prior beta per la conversion, prior lognormale per il revenue. Con PyMC3 o Stan, 10.000 iterazioni di MCMC girano in 30 secondi e il posteriore viene aggiornato quotidianamente.

La soglia di decisione può essere il 95% oppure il 90% — in una fase di crescita aggressiva il 90% è sufficiente, in un gioco maturo si usa il 95%. La soglia inferiore aumenta il rischio di falsi positivi ma accorcia il tempo del test. Tramite il calcolo dell'Expected Value of Information (EVI) trovate la soglia ottimale: il costo di una settimana aggiuntiva di test versus il costo del rischio di una decisione sbagliata.

### Struttura del Test Bayesiano Multi-Variante

Un test di prezzo IAP generalmente include 3+ varianti: control ($4.99), treatment A ($5.99), treatment B ($6.99). Nei test A/B frequentisti c'è il problema dei multiple comparison, la correzione di Bonferroni moltiplicherebbe la sample size. Nel Bayesiano, ogni variante ha la propria distribuzione posteriore e i confronti a coppie si fanno simultaneamente. Invece di selezionare quello con media posteriore più alta, si massimizza il revenue atteso: probabilità di vincita di ogni variante × revenue atteso.

La strategia Thompson Sampling: ogni giorno estraete un campione dalla posteriore di ogni variante, selezionate il campione più alto e inviate il traffico a quella variante. Questa strategia bilancia automaticamente explore/exploit — quando l'incertezza posteriore è alta (primi giorni) la distribuzione del traffico è quasi uniforme, poi converge verso la variante vincente.

Snippet di codice (modello beta-binomiale con PyMC3):

```python
import pymc3 as pm

with pm.Model() as iap_model:
    # Prior: beta uniforme
    p_control = pm.Beta('p_control', alpha=1, beta=1)
    p_treatment = pm.Beta('p_treatment', alpha=1, beta=1)
    
    # Likelihood
    obs_control = pm.Binomial('obs_control', n=n_control, p=p_control, observed=conversions_control)
    obs_treatment = pm.Binomial('obs_treatment', n=n_treatment, p=p_treatment, observed=conversions_treatment)
    
    # Posterior sampling
    trace = pm.sample(10000, return_inferencedata=False)
    
    # Probabilità di superiorità
    prob_superiority = (trace['p_treatment'] > trace['p_control']).mean()
```

Questo modello ottimizza il conversion rate. Per l'ottimizzazione del revenue aggiungete una prior lognormale e calcolate il posteriore congiunto di `p × revenue_mean`.

## Migrazione di Segmento e Impatto a Lungo Termine

L'ottimizzazione dei prezzi non è un test una tantum, ma un processo continuo. Gli utenti cambiano segmento: un minnow oggi può diventare dolphin tra 30 giorni. Il modello Bayesiano non cattura questa migrazione perché usa una prior statica. La soluzione è l'aggiornamento dinamico della prior — ogni 30 giorni il posteriore viene unito ai dati nuovi per diventare la nuova prior.

Per misurare l'impatto a lungo termine, la curva di retention della cohort viene modellata con analisi Bayesiana della sopravvivenza. Se un cambio di prezzo riduce la retention D7 del 2% ma aumenta l'LTV da $12 a $14, il bilancio è positivo. Il modello di sopravvivenza usa una distribuzione Weibull per stimare i parametri di forma e scala, il posterior predictive check fornisce una previsione dell'LTV a 90 giorni.

Il test di impatto sulla retention dura 6-8 settimane perché dovete aspettare il segnale della retention D30. L'approccio Bayesiano fa previsioni sulla retention D30 usando i dati D7 — la prior viene basata sul tasso di transizione D7→D30 delle cohort precedenti. In questo modo ricevete segnali precoci alla 3ª settimana: se la media posteriore della retention D30 è il 18% con intervallo di credibilità [16%, 20%], il test continua; se è [14%, 16%], il cambio di prezzo sta danneggiando la retention e dovete interrompere il test e ripristinare il prezzo.

## Economia del Gioco e Dinamiche di Piattaforma

Gli utenti iOS e Android reagiscono diversamente alla stessa price ladder. Gli utenti iOS mostrano mediamente un ARPPU superiore del 23%, lo stesso prezzo $4.99 raggiunge il 3.2% di conversion su iOS ma solo il 2.1% su Android. Il modello Bayesiano include la piattaforma come fattore gerarchico — ogni piattaforma ha la propria prior di segmento ma il trend globale è condiviso.

Il sistema di pricing tier dell'App Store di Apple (Tier 1 = $0.99, Tier 5 = $4.99...) limita la flessibilità dei prezzi. Tra i tier, invece di testare il posteriore, fate una grid search: quale tra i Tier 3/4/5 genera il maggiore revenue posteriore atteso. Google Play è più flessibile (prezzi arbitrari) ma il conversion rate su Android è più volatile — nei test Android mantenete la varianza della prior del 30% più ampia.

Le fluttuazioni di valuta influenzano il posteriore: quando in Turchia il prezzo è ₺49.99 e il dollaro passa da ₺25 a ₺35, il prezzo reale scende da $2 a $1.43. Il modello usa il revenue aggiustato per la valuta, il posteriore viene calcolato in base USD. Per il pricing nei mercati emergenti usate prior ponderate per la parità di potere d'acquisto — lo stesso gioco può costare $4.99 negli USA e R$9.90 in Brasile (equivalente in PPA ~$1.80).

Nell'ambito del [Premium Publisher Program](/tr/premiumyayinci), le campagne UA alimentano anche i risultati dei test sui prezzi: per i segmenti con LTV alto aumentate il CPM bid, per quelli con conversion bassa lo riducete. Quando il modello Bayesiano IAP si integra con la strategia di bidding UA, diventa possibile l'ottimizzazione del ROI a livello di portfolio — un singolo output del modello comunica quale prezzo mostrare a quale segmento di utenti e fino a quale CPI conviene fare UA.

---

Nei mobile F2P, l'ottimizzazione dei prezzi non può più ridursi alla domanda "quale prezzo è migliore". L'elasticità basata su segmenti, le differenze di piattaforma, l'impatto sulla retention e il rischio di valuta rientrano tutti nel modello. La metodologia Bayesiana incapsula questa complessità nel