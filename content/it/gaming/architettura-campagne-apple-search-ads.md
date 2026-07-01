---
title: "Apple Search Ads: Strutturare l'Architettura delle Campagne come un Funnel"
description: "Discovery, competitor, brand, broad match — gestione del flusso di budget tramite logica funnel. Ottimizzazione install-to-LTV nei mercati Tier-1."
publishedAt: 2026-07-01
modifiedAt: 2026-07-01
category: gaming
i18nKey: gaming-005-2026-07
tags: [apple-search-ads, architettura-campagne-asa, mobile-user-acquisition, funnel-optimization, gaming-growth]
readingTime: 8
author: Roibase
---

Se gestisci le campagne Apple Search Ads con un singolo livello di broad match, stai bruciando il 40% del tuo budget su utenti sbagliati. Nel 2026, la capacità di apprendimento algoritmico di ASA è aumentata, ma senza logica funnel la macchina apprende i segnali sbagliati. Discovery genera install più economici, brand produce D7 LTV più alto — ma se li mescoli perdi entrambi. Strutturare l'architettura delle campagne come strati di funnel non è solo efficienza di budget: significa alimentare correttamente i segnali di attribution.

## Livello Discovery: Usare Broad Match come Motore di Esplorazione

La campagna Discovery esiste per usare la rete ampia di ASA e scoprire nuovi segmenti di utenti. Broad match, keyword generica, categoria — volume di install elevato, IPM basso, ma generi segnali di apprendimento. L'algoritmo non sa ancora quale profilo è adatto al tuo gioco, e nemmeno tu puoi indovinare. Lo scopo del livello Discovery è identificare in 72 ore quali utenti generano engagement.

L'allocazione di budget per Discovery dovrebbe essere il 25-30% della spesa ASA totale. Se superi questa quota, il CPI appare basso ma il LTV non si concretizza. Se rimani sotto, rimani intrappolato nello stesso segmento che i competitor hanno già trovato. Esempio: se la tua spesa ASA mensile è $50K, dedica $12-15K a Discovery. L'obiettivo della campagna non deve essere CPT (cost-per-tap) ma CPin (cost-per-install), perché in questo livello conta il volume, non la qualità del tap.

Strategia di keyword:

- Termini di categoria (es. "puzzle game", "strategy rpg")
- Query di intent ampio ("free games", "offline games")
- Nomi di giochi competitor (broad match attiva anche giochi correlati)

Nelle campagne Discovery, restringere la lista di negative keyword restringe lo spazio di apprendimento. Nei primi 2 settimane lavora senza aggiungere negative, dalla 3ª settimana in poi blocca i search term con D1 retention sotto il 15%.

## Livello Competitor: Exact Match per Acquisire l'Utente del Rivale

La campagna Competitor mira al traffico con intent più elevato su ASA. Se l'utente cerca il nome di un gioco rivale, ha un'intenzione di download consapevole — il tuo compito è offrire un'alternativa. Con broad match catturi ricerche "simili" al nome rivale, ma il livello Competitor deve usare exact match perché il controllo di budget è critico. Un utente che cerca il nome di un gioco rivale può volerlo installare, cercare alternative, o già giocarci e cercarne uno nuovo.

Quota di budget: 20-25%. Con l'aumento dei giochi rivali, questa percentuale può crescere, ma non trattare ogni rivale allo stesso modo. I rivali Tier-1 (leader di mercato, meccaniche simili al tuo gioco) non costano quanto i Tier-2 (meccaniche diverse, stesso profilo utente). Per rivali Tier-1 usa un moltiplicatore bid del 120-150%, per Tier-2 dell'80-100%.

La differenza creativa è decisiva a livello Competitor. L'utente conosce il gioco rivale, la tua custom product page deve fare confronti — ma senza menzionare il nome esplicito. Esempio: se il gioco rivale usa combattimento a turni, la tua CPP dovrebbe mettere in risalto "PvP real-time". Il lavoro di [App Store Optimization](https://www.roibase.com.tr/it/aso) dovrebbe preparare varianti CPP dedicate per questo livello, aumentando l'IPM del 18-25%.

Il segnale negativo è critico: non cercare di riattaccare utenti che hanno precedentemente scaricato e disinstallato un gioco rivale usando il suo keyword. ASA non ha nativamente un segnale "previous downloader", ma se il D1 retention è sotto il 10%, quel segmento utente è già bruciato.

## Livello Brand: Exact Match per Proteggere l'Utente Esistente

La campagna Brand è la linea di difesa su ASA. L'utente che cerca il nome del tuo gioco già ti conosce — ma i competitor stanno facendo bid sui tuoi brand term. Senza una campagna Brand, gli annunci competitor compaiono sopra il tuo gioco e perdi l'8-12% degli utenti. Questo livello genera il CPI più basso ma traffico ridotto; il LTV invece è il più alto perché l'utente arriva consapevolmente.

Quota di budget: 10-15% — piccolo ma ininterrotto. Se metti in pausa la campagna Brand, i competitor se ne accorgono entro 48 ore e aumentano il bid. La strategia di keyword comprende solo il nome del gioco e varianti:

| Tipo di keyword | Esempio | Match type |
|---|---|---|
| Nome gioco | "Your Game Name" | Exact |
| Abbreviazione | "YGN" | Exact |
| Varianti typo | "Your Gam Name" | Broad (solo typo) |

Non testare creative a livello Brand. L'utente conosce già il gioco, la coerenza nella creatività è importante — app icon, logo del gioco, personaggio noto. Se usi varianti CPP, crei confusione.

La strategia di bid può restare bassa perché Apple ti dà un vantaggio naturale sui brand term. Anche se un competitor fa bid al 150%, il tuo bid al 100% appare in alto. Ma non azzerare il bid: serve un bid minimo di $0.50 per impedire ai competitor di spingere la lista organica.

## Modalità Broad Match: Uso Differenziato Secondo il Livello

Broad match su ASA non è un'unica impostazione, ma serve scopi diversi in ogni livello. Nel livello Discovery, broad match è uno strumento di esplorazione — reach massimo, negative minimi. Nel livello Competitor, broad match è rischioso perché attiva query non correlate e disperde il budget. Nel livello Brand, broad match serve solo per varianti typo.

La capacità di apprendimento di broad match è aumentata nel 2026, ma hai ancora bisogno di meccanismi di controllo. L'algoritmo di ASA impara quale search term genera conversioni, ma non quale profilo utente produce D7 LTV. Ecco perché le campagne broad match vanno analizzate in cicli di 14 giorni:

1. **Giorni 1-7:** Lavora senza aggiungere negative, raccogli il search term report
2. **Giorni 8-14:** Aggiungi negative per term con D1 retention <15%, aumenta i bid del 10%
3. **Giorni 15-21:** Verifica i dati D7 LTV, aggiorna la lista negativa

Nelle campagne broad match, il moltiplicatore bid dovrebbe essere 80-90% per Discovery, 100-120% per Competitor. Quando l'algoritmo trova "query simili", usa il segnale bid: un bid basso prolunga il processo di apprendimento.

## Gestire il Flusso di Budget come un Funnel

Una volta strutturati i livelli di campagna, il flusso di budget dovrebbe funzionare come un funnel. Discovery genera volume di install elevato ma LTV incerto, Competitor genera volume medio ma LTV prevedibile, Brand genera volume basso ma LTV elevato. L'allocazione di budget non è statica, ma va aggiustata dinamicamente sulla base dei report LTV settimanali:

**Settimana 1 (fase esplorativa):**
- Discovery 35%
- Competitor 25%
- Brand 15%
- Riserva 25% (mantieni per test)

**Settimane 2-4 (fase di apprendimento):**
- Discovery 30% (diminuisce con l'aumento della lista negativa)
- Competitor 30% (aumenta per competitor vincenti)
- Brand 15%
- Riserva 25%

**Settimana 5+ (fase di ottimizzazione):**
- Discovery 25%
- Competitor 35% (scala per competitor con LTV positivo)
- Brand 15%
- Riserva 25% (eventi stagionali, launch di feature, test)

Non distribuire mai la riserva di budget a campagne fisse. Conservala per opportunità: evento stagionale, lancio di feature nuova, major update di un gioco competitor. Un aumento improvviso di budget su ASA disturba il ciclo di apprendimento dell'algoritmo; distribuire gradualmente dalla riserva è più efficiente.

## Livello di Misurazione dell'Architettura Funnel

Dopo aver strutturato i livelli di campagna, i segnali di attribution non devono distorcersi. ASA funziona nativamente con SKAdNetwork, ma per metriche post-install come D7 LTV ti serve integrazione MMP. Strumenti come AppsFlyer, Adjust, Singular collegano l'ID campagna ASA all'analisi per cohort. Discovery, Competitor, Brand devono avere ognuno un ID campagna separato, in modo che tu possa segmentare i dati di LTV per livello.

Senza infrastruttura di misurazione, la logica funnel rimane solo allocazione di budget — non puoi ottimizzare. Ogni livello ha le sue metriche di successo:

| Livello | Metrica primaria | Metrica secondaria | Segnale negativo |
|---|---|---|---|
| Discovery | IPM (install per mille) | D1 retention | CPI >$3 e D1 <15% |
| Competitor | D7 LTV | CPin | D7 LTV <$2 |
| Brand | CR (conversion rate) | D30 LTV | CPin >$1.5 |

Analizza le metriche in cicli di 14 giorni, non giornalmente, perché l'algoritmo di ASA completa l'apprendimento in 10-14 giorni. L'ottimizzazione giornaliera distorce il segnale.

## Testare e Scalare l'Architettura

Inizia con 3 campagne (Discovery, Competitor, Brand). Se il budget è sotto $10K mensili, usa più ad group in una campagna, ma questa struttura offusca la segmentazione per LTV. Il budget iniziale ideale è $15K al mese — a questo livello ogni livello riceve volume sufficiente e l'apprendimento accelera.

Quando scali, non aggiungere nuovi livelli: approfondisci quelli esistenti. Esempio: dividi Competitor in Tier-1 e Tier-2, o dividi Discovery per geografia (paesi Tier-1 vs mercati emergenti). Ogni nuova suddivisione resetta il ciclo di apprendimento, quindi decidi di scalare solo dopo che i dati di LTV si stabilizzano.

Durante i test, non creare campagne duplicate. Su ASA, la duplicazione causa concorrenza della macchina contro se stessa. Usa invece Creative Set per testare varianti CPP e applica il vincente a tutte le campagne. Nel contesto del [Premium Publisher Program](https://www.roibase.com.tr/it/premiumyayinci), puoi combinare i risultati dei test su ASA con quelli su UAC e Meta per accelerare l'iterazione.

Dopo la strutturazione iniziale, la manutenzione è ridotta ma continua. Report settimanale dei search term, report LTV ogni 14 giorni, analisi per cohort mensile — saltare questi cicli impedisce all'algoritmo di ottimizzarsi. ASA ti invia segnali, tu devi rimandare i segnali corretti: usa i profili scoperti in Discovery per Competitor, trasferisci il LTV guadagnato da Competitor alla protezione Brand. L'architettura funnel non è un elenco statico ma un ciclo dinamico di apprendimento.