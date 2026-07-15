---
title: "Apple Search Ads: Campagna in Architettura a Imbuto"
description: "Guida strutturale per costruire campagne Discovery, Competitor, Brand e Broad Match secondo la logica a imbuto e ottimizzare il flusso di budget attraverso segnali di retention."
publishedAt: 2026-07-15
modifiedAt: 2026-07-15
category: aso
i18nKey: gaming-005-2026-07
tags: [apple-search-ads, aso, mobile-growth, architettura-imbuto, struttura-campagna]
readingTime: 9
author: Roibase
---

Gestire Apple Search Ads come tipologie di campagna separate anziché come un'architettura a imbuto interconnessa cambia le regole del gioco della crescita. Discovery, Competitor, Brand e Broad Match, se considerati singolarmente, mantengono l'allocazione del budget arbitraria — ma quando li organizzi come livelli di imbuto, ogni tipologia di campagna alimenta segnali al livello superiore e riceve qualità da quello inferiore. A metà 2026, la maggior parte dei team di growth mobile gestisce ancora le campagne in isolamento, perdendo il 30-40% di efficienza nel CPT. Questo articolo spiega come strutturare l'architettura delle campagne secondo la logica a imbuto, come indirizzare il flusso di budget in base ai segnali e perché l'integrazione con [App Store Optimization](https://www.roibase.com.tr/ru/aso) è critica.

## La Logica dell'Imbuto: Ogni Tipologia di Campagna Occupa un Livello Diverso

Su Apple Search Ads ci sono quattro tipologie di campagna fondamentali: Discovery (Search tab), Competitor (query di marchi rivali), Brand (query del tuo marchio) e Broad Match (termini di categoria generici). Invece di vederli come entità separate, pensali così: Discovery è in cima, cattura utenti senza consapevolezza del marchio. Broad Match è nel mezzo, c'è un segnale di intent ma la concorrenza è alta. Competitor è più ristretto, cattura utenti che cercano il marchio del rivale — audience qualificata. Brand è in fondo: l'utente già ti conosce. Se inverti questa gerarchia il budget si sbilancia — allocare il 60% a Brand ti farà vendere, ma non crescerai il pool di utenti. Al contrario, dare il 70% a Discovery abbassa il CPT ma la retention crolla perché il traffico freddo entra nell'imbuto di conversione senza filtro.

Nella logica dell'imbuto ogni livello invia segnali al precedente. Se gli utenti da Discovery raggiungono D7 retention oltre il 12%, prendi il profilo del segmento e lo trascrivi come negative keyword list per Broad Match — così Broad diventa più ristretto negli obiettivi. Se la campagna Competitor ha IPM (install per mille) sotto l'8%, quel profilo di utente non converge con il tuo, spegni la campagna. Se il CPA di Brand sale improvvisamente del 40%, il tuo App Store rank è sceso — il problema non è la campagna ma i metadata. Gestendo le campagne in isolamento questi segnali si perdono.

Strutturi il flusso di budget sulla stessa logica. Discovery parte con il 40-50% perché riempie il pool di utenti. Dopo 3-4 settimane, quando il profilo di retention si stabilizza, sposti il 30% a Broad Match e Discovery scende al 30%. Brand rimane fisso al 15-20% perché gli utenti che ti conoscono già costano poco ma il volume è limitato. Competitor è opzionale — in mercati tier-1 (USA, UK) allochi il 10-15%, in mercati emergenti (LATAM, SEA) è inutile perché la brand awareness è bassa.

## Campagna Discovery: Il Laboratorio dell'Esperienza Traffico Freddo

Le campagne Discovery appaiono nella Search tab. L'utente apre il gioco, sotto vede "Potrebbe piacerti anche questo". Il segnale di intent è debole — potrebbe non stare nemmeno cercando la categoria del tuo gioco. Il tuo obiettivo qui non è il volume di install, ma estrarre il profilo del segmento di utente. Usi Discovery come arena di A/B test: metti 4-5 creative set diversi (con custom product page), ogni set a 5000 impression per una settimana, poi cross-check IPM + D1 retention. IPM sotto il 4% è scartato direttamente. IPM tra il 6-8% ma D1 retention sotto il 35%? La creative è ingannevole — cambia la scena di chiusura.

La logica di budget per Discovery è: primo mese spendi aggressivamente (50% del budget totale), dopo che i dati si stabilizzano scendi al 30%. Mai fermare completamente, perché il test del traffico freddo è il tuo input di segmenti per Broad Match e Competitor. A metà 2026 il machine learning di Apple converge in 72 ore, quindi il tuo CPA raggiunge il plateau in 3 giorni. Se al giorno 5 c'è ancora volatilità, il targeting è troppo ampio — aggiungi filtri per età, genere, geografia.

In Discovery non usi keyword — Apple fa il match automaticamente. Ma puoi mettere negative keywords — specialmente termini legati a generi di gioco rivali (se il tuo è match-3, fai negative "battle royale"). Una trappola: Apple suggerisce anche per categoria. Se il tuo gioco è in "Casual" ma la meccanica è più "Puzzle", hai sbagliato la categoria nei metadata — non è un problema di campagna, ma di ASO. La performance bassa di Discovery richiede prima un audit ASO (cambio categoria + ottimizzazione subtitle), non più spesa in budget.

## Competitor e Broad Match: Filtro di Qualità e Dinamica di Budget

Le campagne Competitor hanno senso solo in mercati tier-1. In mercati come Turchia, Brasile, Indonesia la brand awareness è bassa — gli utenti non cercano il nome del rivale, cercano il termine generico di categoria. Negli USA c'è 1 milione di utenti che cercano "Candy Crush", in Turchia sono 50mila — allocare budget a Competitor non regge l'analisi ROI. Se sei in tier-1, mantieni Competitor stretto: target solo 3-5 giochi in concorrenza diretta. Per ogni keyword TTR (tap-through rate) deve essere minimo il 5%, altrimenti la tua creative non attira l'utente del rivale — cambia icon + screenshot set.

In Competitor il bid è aggressivo: fino al 120% del tuo CPA massimo, perché l'utente del rivale è qualificato — ha giocato un gioco simile. Ma dopo 2 settimane misura LTV/D30 — se l'utente da Competitor ha retention il 15% più bassa in assoluto, il segmento non converge con la tua meccanica, chiudi la campagna. L'errore comune: il rivale è grande, quindi i suoi utenti funzioneranno anche per noi. No — un utente "PUBG Mobile" è completamente diverso da uno "Among Us", anche se la categoria è lo stesso "battle royale".

Le campagne Broad Match sono per termini di categoria: "puzzle game", "strategy rpg", "idle game". Qui controlli exact vs broad matching. All'inizio apri su broad, dopo 1 settimana scarica il report search terms, fai negative i termini non rilevanti. Esempio: il tuo gioco è "merge", ma Broad match cattura anche "match-3", quindi fai negative "match-3". Il budget di Broad deve essere il 25-35% — più ti disperde senza usare il segnale dati da Discovery, meno non catturi volume sufficiente.

## Campagna Brand: Difesa e Indicatore di Salute ASO

La campagna Brand target il nome del tuo gioco. "Ma siamo già primo, perché pagare?" è la domanda sbagliata. Anche se sei primo in ranking organico, i rivali possono target il tuo marchio in Search Ads — quindi quando cercano il tuo nome, appare un rivale. Brand campaign protegge quel traffico. Inoltre il CPA è più basso qui (tipicamente 1/5 di Discovery), quindi allocare il 15-20% del budget ha ROI positivo.

La seconda funzione di Brand è essere indicatore di salute ASO. Se il tuo Brand CPA sale improvvisamente (es. +30% in 2 settimane), il tuo ranking organico è sceso. Perché: ranking basso = meno visibilità organica, l'utente clicca di più su Brand Search Ads, Apple carica più fee. Non risolvi con ottimizzazione campagna — risolvi con ASO (keyword density, subtitle, IAP naming) e review management. Usi Brand come "early warning system".

Il bid su brand keyword deve essere aggressivo: fino al 150% del tuo CPA massimo. Perché se il rivale bida più di te su brand, perdi il traffico. Molti team dicono "tanto arrivano da organic" e bidano basso — funziona solo se non c'è concorrenza. In tier-1 c'è sempre concorrenza, Brand è difesa attiva non passiva.

## Flusso di Budget: Scenario Pilota di 4 Settimane

Supponi di avere $15.000 di budget in 30 giorni, lancio nuovo idle RPG, mercato USA. Prima settimana: Discovery 50% ($1.875), Broad 25% ($937), Brand 20% ($750), Competitor 5% ($187). Competitor basso perché non hai ancora profilo segmento. Nei primi 7 giorni Discovery porta 2.500 install, misuri D1 retention — risultato 32%. Aspetti 1 settimana per D7.

Giorno 14: D7 retention è 18% (accettabile per idle RPG). Gli utenti da Discovery sono 60% maschi 25-34 anni, 30% femmine 18-24. Trascrivi questo profilo come filtri età/genere in Broad Match. Revidi il budget così: Discovery 35%, Broad 35%, Brand 20%, Competitor 10%. Ora hai il profilo segmento, Broad funziona più qualificato.

Giorno 21: Competitor porta 150 install, ma D1 retention è 22% — 10% più basso di Discovery. Questo segmento non converge. Spegni Competitor, il 10% va a Broad. Ultima settimana: Discovery 30%, Broad 45%, Brand 25%. Questa allocazione è stabile — l'imbuto è in equilibrio. Dopo 30 giorni: 7.200 install totali, blended CPA $2.08, D30 retention 9.5% — baseline solido per idle RPG tier-1.

## Misurazione e Iterazione: Su Quali Segnali Guardi

Dopo aver costruito l'architettura, la misurazione avviene su 3 layer: livello campagna (CPA, IPM, TTR), livello imbuto (D1/D7/D30 retention), livello economico (LTV/CAC). Ogni tipo di campagna ha i suoi criteri. Per Discovery IPM + D1 retention bastano, non aspetti LTV perché traffico freddo. Per Broad Match è critico D7 retention — sotto il 15% è inaccettabile. Per Competitor è prioritario TTR — sotto il 5% la creative è debole. Per Brand l'aumento di CPA è campanello d'allarme ASO.

Il ciclo settimanale è: lunedì mattina estrai le metriche di campagna (Apple Search Ads Console), retention data da MMP (Adjust, AppsFlyer), proiezione LTV da BI dashboard. Venerdì decidi: quale creative set chiudere, quale keyword fare negative, quale campagna aumentare di budget. Due volte al mese una strategia più larga: ribalancia budget dell'imbuto, testa nuovo mercato, aggiorna ASO metadata.

Una trappola: Apple Search Ads ti avverte costantemente "aumenta il budget". Non farlo automaticamente. Prima controlla se stai spendendo il 100% del budget attuale — se sotto l'80% non prendi impression sufficienti, il problema è il targeting. Se sopra il 95% e il CPA è in target, allora aumenta, ma massimo del 20% — salti bruti rompono il machine learning.

## Integrazione ASO: La Campagna Alimenta i Metadata

Le campagne Apple Search Ads non si gestiscono indipendentemente da ASO. I metadata che la campagna mostra (icon, screenshot, subtitle, promotional text) vengono direttamente dalla tua pagina App Store. Se Discovery ha basso IPM ma Competitor alto, il tuo icon sembra generico — chi cerca il marchio rivale ha già intent alto, clicca anche se l'icon non attrae. Ma il traffico freddo (Discovery) guarda l'icon, se non attrae scrolls via.

Qui entrano le Custom Product Pages (CPP). Apple ora ti permette di assegnare una CPP diversa per ogni campagna. Per Discovery usi screenshot bold e animati. Per Brand minimal, logo-forward. Per Competitor confronto con il rivale (se guideline lo permettono). Gestire tutte le campagne con un'unica metadata non ottimizza la conversione. La strategia CPP deve essere parallela all'architettura campagna, non dopo. L'[App Store Optimization](https://www.roibase.com.tr/ru/aso) è inseparabile da questa struttura.

I metadata ASO si rivedo ogni 4-6 settimane — la densità keyword cambia con l'algoritmo Apple, review management previene churn, il naming IAP testa prezzi. Questi cambiamenti impattano direttamente performance campagna. Esempio: cambi subtitle da "merge" a "build", dopo 1 settimana Broad Match cattura più query "build game" — la aggiungi manualmente come keyword. ASO e Search Ads devono essere gestiti dallo stesso team, stesso sprint.

## Conclusione: L'Architettura non è Setup Unico, ma Sistema Dinamico

Costruire l'architettura a imbuto non finisce in un giorno. Primi 30 giorni pilota, successivi 60 stabilizzazione, poi iterazione continua. L'allocazione di budget cambia il 10-15% al mese perché il calendar live ops del gioco (event, season, IAP sale) influisce sulla dinamica campagna. Se Discovery è aggressivo, Broad Match migliora 2 settimane dopo perché il pool utente è saturo. Se il CPA di Brand sale, correggi ASO, non il budget della campagna.

Prima di costruire questo setup, devi rispondere: il profilo segmento è chiaro? Hai baseline di retention? I metadata ASO sono testabili? L'integrazione MMP è sana? Senza questi quattro componenti l'architettura delude. Con loro, l'efficienza di budget sale il 30-40% nei primi 90 giorni — perché ogni campagna lavora al livello giusto, con il segnale giusto. Guarda l'allocazione corrente — se non è a imbuto, il pilot di questo mese dovrebbe seguire il modello di 4 settimane sopra.