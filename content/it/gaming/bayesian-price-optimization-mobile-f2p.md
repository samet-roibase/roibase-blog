---
title: "Bayesian Price Optimization su Mobile F2P"
description: "Perché passare da A/B test classici alla stima Bayesiana nei test IAP? Aggiornamento posteriore, ladder specifico per segmento, meccanismo di decisione precoce."
publishedAt: 2026-05-10
modifiedAt: 2026-05-10
category: gaming
i18nKey: gaming-002-2026-05
tags: [f2p-monetization, bayesian-testing, iap-pricing, mobile-gaming, price-optimization]
readingTime: 9
author: Roibase
---

Nell'economia mobile F2P, l'ottimizzazione dei prezzi avviene ancora con logica "aumentiamo il pacchetto più venduto da $4,99 a $5,99". Nel 2026, studio che ottimizzano le offerte di Apple Search Ads con precisione al millisecondo continuano a perdere mesi su test classici per le IAP ladder. La stima Bayesiana, quando applicata non per catturare margini percentuali bensì per prendere decisioni rapide e costruire ladder specifici per segmento, eleva l'LTV di circa il 12-18% per test. Questo articolo spiega la logica dell'aggiornamento posteriore, come integrarla alla segmentazione e perché il framework Bayesiano è indispensabile nel contesto mobile.

## Perché i Test A/B Classici sui Prezzi Rimangono Lenti

Un test A/B frequentista su variazioni di prezzo richiede 5.000-10.000 transazioni per raggiungere significatività statistica (p=0.05, potenza=0.80). In un gioco F2P di medio segmento con 200-300 utenti paganti giornalieri, una singola variante richiede 25-30 giorni di attesa. Nel frattempo il Season Pass si rinnova, il calendario degli eventi cambia, i competitor lanciano aggiornamenti — mantenere il controllo del gruppo diventa impossibile.

Il secondo problema dell'approccio classico è la struttura binaria della decisione: "l'aumento di prezzo non è significativo, ritorna indietro" oppure "è significativo, implementa". Ma su mobile ogni coorte ha elasticità di prezzo diversa. Un utente iOS organico converte a $9,99, mentre un paid install Android potrebbe essere il 40% più sensibile. Un singolo p-value forza tutti i segmenti verso la stessa decisione.

Il terzo ostacolo è l'impossibilità di fermarsi anticipatamente. Nel test frequentista devi proseguire fino a raggiungere la dimensione campionaria — anche se al giorno 14 la fiducia posteriore raggiunge il 92%, devi aspettare altre 4 settimane fino a "avere dati sufficienti". Questo ritardo cancella il guadagno di LTV che avresti potuto catturare nella live ops schedule.

## Come Funziona la Stima Posteriore nel Framework Bayesiano

L'approccio Bayesiano vede il tasso di conversione (o il ricavo medio per utente pagante) non come un numero fisso, bensì come **distribuzione di probabilità**. Prima dell'inizio del test esiste una prior belief: la distribuzione del CVR dal prezzo precedente. Ogni nuova transazione aggiorna la distribuzione posteriore tramite il teorema di Bayes:

```
P(θ | data) ∝ P(data | θ) × P(θ)
```

Qui θ = tasso di conversione reale (o ARPPU), data = eventi di acquisto osservati. Come prior si usa solitamente Beta(α, β), appropriata perché il flusso IAP produce esiti binari. Ogni fine giornata, i parametri α e β si aggiornano con il numero di nuove transazioni.

Nella pratica procede così: stai testando l'aumento dello Starter Pack da $4,99 a $5,99. Prior belief: CVR ~2,8% (Beta(280, 9720) — derivato da 10.000 impression precedenti). Nei primi 3 giorni la variante $5,99 riceve 600 impression, 14 conversioni. La posteriore diventa Beta(294, 10306). L'intervallo di confidenza si restringe, il CVR medio si aggiorna a 2,78%. Al giorno 10, con 2000 impression e 48 conversioni, la posteriore è Beta(328, 11672), CVR 2,74%. Mentre il test frequentist direbbe ancora "campione insufficiente", l'approccio Bayesiano afferma: "La probabilità che il nuovo prezzo riduca il CVR è dell'87% — ma l'aumento dell'ARPPU compensa questo calo?"

### Metrica di Decisione: Expected Revenue Gain

La riduzione del CVR non è un'unica decisione. Nel framework Bayesiano, la vera metrica è il **ricavo atteso per impression** (ERPI):

```
ERPI = E[CVR × Price]
```

Per ogni variante estrai campioni dalla distribuzione posteriore (10.000 iterazioni), in ciascuna iterazione confronti CVR_new × $5,99 con CVR_old × $4,99. Se in oltre l'85% dei casi il nuovo prezzo vince (cioè P(ERPI_new > ERPI_old) > 0,85), la decisione è "scale up". Se sotto il 15%, torna indietro.

Questo metodo consente di prendere decisioni in 10-12 giorni, con 1.500-2.000 transazioni. Rispetto alle 4-5 settimane dell'A/B classico, è il 60% più veloce.

## Costruire una Ladder Specifica per Segmento

Il vero potere della stima Bayesiana emerge quando la combini con un approccio **multi-armed bandit**. Mantieni una posteriore separata per ogni segmento; ogni giorno, il Thompson Sampling decide dinamicamente quale variante di prezzo riceve il traffico.

Scenario concreto: 4 segmenti — (1) iOS organico, (2) iOS paid, (3) Android organico, (4) Android paid. Stai testando 3 prezzi per lo Starter Pack: $4,99, $5,99, $6,99. In totale 12 distribuzioni posteriori (4 segmenti × 3 prezzi).

La prima settimana ogni segmento riceve i 3 variant in pari opportunità (exploration). Dalla 2ª settimana il Thompson Sampling entra in azione: a ogni impression, estrai un campione da 3 posteriori per quel segmento, la variante con l'ERPI più alto riceve il traffico. Se su iOS organico $6,99 parte in vantaggio, gli utenti di quel segmento vedranno $6,99 il 70%+ delle volte. Se su Android paid $5,99 è ottimale, il traffico converge lì.

| Segmento | Prezzo Ottimale (giorno 14) | Fiducia Posteriore | Allocazione Giornaliera |
|---|---|---|---|
| iOS Organico | $6,99 | 91% | 78% |
| iOS Paid | $5,99 | 88% | 74% |
| Android Organico | $5,99 | 85% | 71% |
| Android Paid | $4,99 | 82% | 69% |

Questa struttura cattura l'elasticità di prezzo a livello di segmento, generando il 15-20% di ricavo in più rispetto a un prezzo globale unico. Inoltre, quando aggiungi un nuovo segmento (ad esempio "utente paid di GEO Tier-2"), crei una prior per esso e il multi-armed bandit inizia automaticamente il test su quel ramo.

## Meccanismo di Decisione Precoce e Minimizzazione del Rimpianto

Il vantaggio critico del framework Bayesiano nel contesto mobile è il **sequential decision-making**. Ogni fine giornata la posteriore si aggiorna, si verifica la regola di decisione. Se P(ERPI_new > ERPI_old) > 0,90, dici "siamo abbastanza sicuri, sposta il traffico rimanente verso il variant vincente". Mentre il test frequentist aspetta "non abbiamo ancora raggiunto la dimensione campionaria", l'approccio Bayesiano decide al giorno 7 e scala il prezzo vincente nelle 3 settimane restanti.

Poter decidere anticipatamente minimizza il **cumulative regret**. Regret = "quanto avremmo guadagnato sapendo il prezzo ottimale" − "quanto abbiamo guadagnato durante il test". In un A/B classico, il 50% del traffico va a una variante subottimale per 30 giorni; con Thompson Sampling Bayesiano, dall'80% del traffico (dopo il giorno 10) converge verso il vincente. L'integrale del regret cala del 60-70%.

Concretamente, in un ciclo di test di 2-3 settimane:
- A/B classico: 21 giorni × 50% traffico subottimale = 10,5 giorni di perdita equivalente
- Bandit Bayesiano: 7 giorni exploration + 14 giorni con 15% subottimale = 2,1 giorni di perdita equivalente

Su giochi ad alto DAU, questa differenza si traduce in decine di migliaia di dollari di revenue giornaliera.

## Trade-off e Insidie

L'ottimizzazione Bayesiana non è immune da rischi. La scelta della prior è critica: una prior troppo stretta (ad esempio Beta(5000, 195000) — "il CVR è certamente 2,5%") aggiorna le credenze lentamente anche con nuovi dati. Una prior troppo ampia (Beta(1, 1) — uniforme) prolunga l'exploration. Un buon punto di partenza: convertire gli ultimi 30 giorni di transazioni dal prezzo precedente in parametri Beta (method of moments).

Il secondo ostacolo è la convergenza del multi-armed bandit al crescere dei segmenti. Con 4 segmenti × 3 prezzi = 12 bracci; ogni braccio richiede 200-300 campioni, servono 2.400-3.600 transazioni totali — per un gioco con 300 utenti paganti giornalieri, 10-12 giorni. Se passi a 8 segmenti × 4 prezzi = 32 bracci, la convergenza si estende a 4-5 settimane. Soluzione: usare Bayesian gerarchico per condividere informazioni tra segmenti (ad esempio, "le geo Tier-1 mostrano elasticità simili" come prior).

Il terzo punto di attenzione: la IAP ladder non viene testata in isolamento, è intrecciata con la live ops schedule. L'elasticità del prezzo cambia durante gli eventi (effetto urgenza). Devi aggiornare la posteriore Bayesiana più velocemente nei giorni di evento, ma non resettare la prior quando l'evento finisce. Altrimenti, "il prezzo ottimale durante l'evento è $6,99" contamina i giorni normali, portando a decisioni subottimali.

Infine: l'approccio Bayesiano non fornisce garanzie frequentist. Quando dici "P(θ > x) = 0,95", è un intervallo credibile del 95%, non un intervallo di confidenza al 95%. Se normative o rendicontazione legale richiedono metriche frequentist (ad esempio, vincoli sulle scatole di bottino), dovrai supportare i risultati Bayesiani con bootstrap frequentist.

## Collegare i Test della Ladder Specifica per Segmento alla Misurazione su Roibase

Per gli studi di mobile gaming, l'ottimizzazione dei prezzi non è un test isolato, ma è collegata a tutta la pipeline [App Store Optimization](https://www.roibase.com.tr/it/aso) e attribution. Le posteriori Bayesiane non sono solo per decisioni sui prezzi: puoi usarle anche nei test creativi dell'ASO — quale custom product page genera il più alto IPM per ogni segmento, e quale ladder IAP ottimale per quel segmento — combinando i due flussi di dati, le proiezioni di LTV a livello di coorte diventano il 30% più accurate.

Integrare il framework Bayesiano nell'infrastruttura di misurazione consente sia decisioni rapide che ladder specifici per segmento. Nel 2026, gli studi mobile F2P che vincono sono quelli che hanno trasformato il test dei prezzi da "ottimizzazione mensile" a un sistema che aggiorna ogni giorno la distribuzione posteriore, alloca il traffico via Thompson Sampling e minimizza il rimpianto cumulativo.