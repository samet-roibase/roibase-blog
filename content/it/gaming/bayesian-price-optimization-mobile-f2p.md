---
title: "Ottimizzazione dei Prezzi Bayesiana nel Mobile F2P"
description: "Ottimizzate i test della price ladder IAP tramite stima posteriore e modellazione per segmenti. Strategia di prezzo basata sui dati."
publishedAt: 2026-07-22
modifiedAt: 2026-07-22
category: gaming
i18nKey: gaming-002-2026-07
tags: [f2p-monetization, bayesian-optimization, iap-pricing, mobile-gaming, data-driven-pricing]
readingTime: 9
author: Roibase
---

Nei giochi mobile F2P, le decisioni di prezzo si basano generalmente su stime o su "prezzi comuni nel mercato". Un starter pack a $0,99, un tier medio a $4,99, un whale bundle a $99,99 — questa price ladder è fissa nella maggior parte dei giochi. Eppure ogni gioco ha una struttura di cohort diversa, un mix geografico differente e una value perception unica. L'ottimizzazione dei prezzi bayesiana ti consente di modellare questa diversità attraverso una distribuzione di probabilità posteriore, trovando il prezzo ottimale in ogni segmento. Invece di un A/B test classico, costruire un sistema di apprendimento continuo può migliorare il conversion rate degli IAP tra il 15-40%.

## Perché l'approccio bayesiano è superiore ai test A/B tradizionali

Un A/B test classico opera su un'ipotesi fissa: confronta due prezzi, ad esempio $4,99 vs $5,99, e attende fino a raggiungere il 95% di confidence, quindi sceglie il vincitore. Questo approccio ha due problemi: in primo luogo, durante il test il traffico viene diviso a metà e la variante con prestazioni inferiori continua a essere presentata agli utenti (costo opportunità). In secondo luogo, una volta terminato il test, ottieni una decisione binaria "A o B" — non apprendi nulla sui valori intermedi o sulle differenze specifiche per segmento.

L'ottimizzazione bayesiana inizia con una distribuzione a priori (ad esempio "il prezzo potrebbe essere uniformemente distribuito tra $3 e $7"), aggiunge ogni dato di conversione al posteriore e aggiorna continuamente la distribuzione di probabilità. In questo modo, algoritmi come Thompson Sampling reindirizzano dinamicamente il traffico verso la variante vincente — il revenue totale viene massimizzato durante l'intero periodo di test. Ad esempio, in un test di 10 giorni, l'approccio bayesiano genera il 8-12% di revenue aggiuntivo, perché il traffico minimo viene inviato ai punti di prezzo scadenti.

Inoltre, il modello bayesiano non ti fornisce solo "quale prezzo ha vinto", ma anche "la probabilità che questo prezzo sia ottimale è dell'87%". Questa informazione accelera l'iterazione: anche con il 60% di confidence, puoi lanciare un prezzo in produzione e avviare un nuovo test, poiché la distribuzione posteriore contiene già informazioni sufficienti.

## Costruzione del prior basata su segmenti nel test della price ladder IAP

Nei giochi F2P, non tutti gli utenti hanno lo stesso valore. Definire correttamente i segmenti di spender consolida il prior del modello bayesiano. Una segmentazione tipica è: **minnows** (lifetime spend <$10), **dolphins** ($10-$100), **whales** (>$100). Ogni segmento ha un'elasticità di prezzo diversa — i minnow convertono anche a $0,99, mentre i whale acquistano un bundle a $99,99 senza guardare il prezzo.

Per costruire il prior per segmento è necessario avere dati storici. Ad esempio, se nel segmento minnow il conversion rate medio degli IAP tra $0,99 e $1,99 è del 3,2%, usa come media a priori $1,49 e sigma $0,50 (sotto l'ipotesi di distribuzione normale). Nel segmento whale, se il conversion rate rimane praticamente piatto tra $49,99 e $149,99, un prior uniforme è più appropriato — riflettendo l'ipotesi che "i whale sono insensibili al prezzo" nel modello.

Il vantaggio di un prior per segmento è che impedisce l'apprendimento cross-segmento. Un A/B test classico mescola tutti gli utenti in un unico pool e il fatto che i whale convertono altamente anche nella variante di prezzo basso può mascherare il prezzo ottimale per i minnow. Il modello bayesiano aggiorna un posteriore separato per ogni segmento, facendo emergere prezzi segment-ottimali come $1,49 per i minnow e $79,99 per i whale.

### Regolazione del prior specifico per geografia

La parità del potere d'acquisto varia enormemente tra Tier-1 (US, UK, JP) e mercati emergenti (BR, TR, IN). Negli USA un pack a $4,99 è percepito come "economico", mentre lo stesso prezzo in TR (circa ₺150) rientra nella fascia media-alta. Per normalizzare la distribuzione a priori per geografia, utilizza i dati dell'ARPU locale. Ad esempio, se l'ARPU giornaliero medio è $0,42 negli USA e $0,18 in TR, scala il mean a priori di questo rapporto (0,18/0,42 = 43%). In questo modo il modello testa la stessa price ladder relativa in ogni geografia, incorporando la differenza di valore assoluto nel prior.

## Stima posteriore e implementazione di Thompson Sampling

Il motore di runtime del modello bayesiano è la stima posteriore. Ad ogni impression IAP (visualizzazione dell'offerta), estrai un campione dalla distribuzione posteriore attuale (ad esempio con Beta distribution tramite `np.random.beta(alpha, beta)`). Il prezzo corrispondente a questo campione viene mostrato all'utente. Se l'utente effettua l'acquisto, alpha += 1; se lo salta, beta += 1 — il posteriore viene aggiornato.

Thompson Sampling utilizza questo meccanismo nella distribuzione del traffico. Per ogni variante, estrae un'aspettativa di reward dal posteriore e seleziona quello con il reward più alto. Nei primi giorni tutte le varianti ricevono traffico uguale (esplorazione), poi il traffico confluisce verso la variante vincente (sfruttamento). L'equilibrio non è controllato da epsilon, ma dalla varianza posteriore — ovvero, una variante con bassa varianza (alta confidence) attrae più traffico.

Per l'implementazione pratica puoi usare `scipy.stats.beta` di Python o `pymc3`. Un semplice blocco di codice:

```python
import numpy as np
from scipy.stats import beta

# Prior: alpha=1, beta=1 (uniforme)
alpha_a, beta_a = 1, 1  # Variante A ($4,99)
alpha_b, beta_b = 1, 1  # Variante B ($5,99)

def select_variant():
    sample_a = np.random.beta(alpha_a, beta_a)
    sample_b = np.random.beta(alpha_b, beta_b)
    return "A" if sample_a > sample_b else "B"

def update_posterior(variant, converted):
    global alpha_a, beta_a, alpha_b, beta_b
    if variant == "A":
        if converted:
            alpha_a += 1
        else:
            beta_a += 1
    else:
        if converted:
            alpha_b += 1
        else:
            beta_b += 1
```

Questo semplice loop converge in 10.000 impression con un margine di errore del 2% sul conversion rate posteriore (se l'ipotesi Beta prior è corretta). In produzione puoi aggiornare i parametri posteriori ogni giorno utilizzando BigQuery + Airflow e iniziare nuove cohort con la distribuzione attualizzata.

## Bandit multi-braccio vs modello bayesiano completo

Nella letteratura sull'ottimizzazione dei prezzi bayesiana esistono due approcci principali: **multi-armed bandit** (MAB) e **regressione bayesiana completa**. L'approccio MAB è Thompson Sampling descritto sopra — definisce punti di prezzo discreti (ad es. 5 punti prezzo) come bracci, mantenendo un posteriore separato per ogni braccio. Vantaggi: implementazione semplice, footprint runtime ridotto, decisioni in tempo reale.

La regressione bayesiana completa modella il prezzo come variabile continua, legando la probabilità di conversione al prezzo tramite regressione logistica o processo gaussiano. Questo approccio è più flessibile — ad esempio, può apprendere relazioni non lineari come "il conversion rate diminuisce esponenzialmente all'aumentare del prezzo". Svantaggio: il training del modello richiede stack BigQuery + Python, non puoi prendere decisioni in tempo reale (prediction batch).

Nei giochi F2P, il MAB è generalmente sufficiente, poiché la price ladder è già discreta ($0,99, $2,99, $4,99, $9,99 ecc.). Il modello bayesiano completo entra in gioco quando vuoi fare dynamic pricing (prezzo diverso per ogni utente) — ma le policy della maggior parte degli app store lo vietano (price discrimination). Una strada intermedia: MAB per segmento, con regressione bayesiana completa all'interno di ogni segmento. Così puoi trovare continuamente il punto ottimale tra $79,99 e $149,99 per il segmento whale.

## Uplift dei ricavi e impatto sulla LTV della cohort

Il vero ROI dell'ottimizzazione bayesiana dei prezzi emerge nella LTV della cohort. Nella prima settimana di test, il conversion rate aumenta dell'8%, ma la LTV a D30 di questi utenti risulta del 15-20% più elevata. Perché? Perché il punto di prezzo ottimale si adatta perfettamente alla value perception dell'utente — né troppo basso (calo di valore percepito), né troppo alto (attrito). Questi utenti hanno una probabilità più alta di acquistare il secondo pacchetto dopo il primo IAP.

Un esempio concreto: in un RPG mid-core, il modello bayesiano ha suggerito $3,49 al posto di uno starter pack a $4,99 (segmento minnow, US). Nella prima settimana il conversion rate è passato dal 22% al 28% (+27% relativo). La retention a D7 è rimasta invariata (42%), ma l'ARPU a D30 è salito da $2,18 a $2,51 (+15%). Perché? Il prezzo di $3,49 ha abbassato la soglia "posso investire in questo gioco", riducendo l'attrito per il secondo acquisto. La LTV totale della cohort è salita da $8,90 a $10,20 (+15%).

Per misurare questo effetto è obbligatorio eseguire un'analisi per cohort. Su BigQuery traccia `user_id`, `install_date`, `first_iap_price`, `d7_revenue`, `d30_revenue`. Contrassegna il variant del test bayesiano con `experiment_group`, confronta le curve di LTV con il gruppo di controllo. Il test di significatività è prematuro nei primi 7 giorni, la confidence aumenta a D30.

## Malintesi e compromessi

È diffuso il malinteso che l'ottimizzazione bayesiana dei prezzi "vinca subito". In realtà, la convergenza posteriore richiede un minimo di 5.000-10.000 impression per segmento. Nei giochi con scarso traffico (DAU <50k) il periodo di test si estende a 4-6 settimane. Durante questo periodo, la pipeline di dati (logging delle impression, tracking delle conversioni, aggiornamento posteriore) deve funzionare stabilmente — un singolo bug corrompe tutto il posteriore.

Il secondo compromesso riguarda la granularità dei segmenti. Se definisci segmenti troppo specifici (ad es. "spesa L5-10, US, Android, whale"), ogni segmento non avrà un sample size sufficiente e il posteriore rimarrà con alta varianza. Una regola pratica: ogni segmento deve ricevere almeno 200 impression IAP al giorno. Se scende sotto questo limite, unisci i segmenti (ad es. US+UK+CA diventa un singolo segmento "Tier-1 EN").

Un terzo punto è l'effetto psicologico dei cambiamenti nella price ladder. Se l'utente ieri ha visto $4,99 e oggi vede $3,99, percepisce uno "sconto" e il conversion sale — ma non è sostenibile. Durante il test bayesiano mantieni lo range di prezzo ristretto (massimo ±20%), non fare cambiamenti radicali (ad es. $4,99 → $1,99).

## Scale e automazione post-test

L'ottimizzazione bayesiana dei prezzi non è un test una tantum, ma un sistema di apprendimento continuo. Una volta terminato il test, lanci il prezzo vincente in produzione, ma conservi la distribuzione posteriore per usarla come prior nelle nuove cohort. Ad esempio, nella stagione holiday di Q4 l'ARPU sale del 30% — il posteriore del trimestre precedente diventa il prior del nuovo, permettendo al modello di convergere rapidamente al nuovo optimum (warm start invece di cold start).

Puoi configurare l'automazione con Airflow + BigQuery + Firebase Remote Config. Ogni giorno, un DAG di Airflow legge i parametri posteriori da BigQuery, scrive i nuovi variant di prezzo su Firebase Remote Config. L'SDK del client recupera Remote Config e mostra l'offerta IAP. L'evento di conversione viene loggato in BigQuery e il posteriore si aggiorna — il ciclo si chiude. La configurazione iniziale richiede 2-3 settimane, dopodiché funziona senza interventi.

L'ultimo step è scalare il modello bayesiano su più giochi. Se vuoi farlo, costruisci un "pricing service" centralizzato. Ogni gioco invia i metadati (genere, mix geografico, ARPU), il servizio suggerisce una distribuzione a priori basata sul profilo del gioco. In questo modo i nuovi giochi evitano il problema del cold start e applicano transfer learning dal posteriore di giochi simili. Il servizio di [Ottimizzazione per App Store](https://www.roibase.com.tr/it/aso) di Roibase integra queste pipeline di apprendimento cross-app con test creativi per ASO — lo stesso framework bayesiano è applicabile anche ai variant delle product page.

---

L'ottimizzazione bayesiana dei prezzi è una delle fondamenta dell'ingegneria dei ricavi nei giochi F2P. Con un prior di segmento corretto, aggiornamento posteriore continuo e Thompson Sampling, puoi aumentare il conversion rate degli IAP del 15-40% e innalzare visibilmente la LTV della cohort. Costruire un sistema di apprendimento invece di un A/B test classico genera un effetto compounding nel lungo termine — ogni nuova cohort inizia più ottimizzata della precedente. Per iniziare, dividi la tua price ladder attuale in 3-5 varianti, costruisci il prior dai conversion rate storici e monitora il posteriore nei primi 10.000 impression.