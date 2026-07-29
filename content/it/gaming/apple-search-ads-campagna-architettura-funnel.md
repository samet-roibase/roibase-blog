---
title: "Apple Search Ads: Costruire l'Architettura Campagna Come Funnel"
description: "Discovery, competitor, brand, broad match — approccio ingegneristico per strutturare le campagne Apple Search Ads con logica funnel e ottimizzare il flusso di budget."
publishedAt: 2026-07-29
modifiedAt: 2026-07-29
category: aso
i18nKey: gaming-005-2026-07
tags: [apple-search-ads, asa-funnel, mobile-growth, app-campaigns, aso]
readingTime: 9
author: Roibase
---

In Apple Search Ads, operare con un unico tipo di campagna erode i diversi stadi del customer journey all'interno dello stesso pool di budget. Un utente in modalità Discovery e uno che esegue una ricerca branded hanno costi, intenzioni e dinamiche di conversione completamente diverse. Strutturare l'architettura campagna come funnel applica disciplina di budget distinta a ogni fase e consente di leggere le metriche post-install (D7 retention, LTV) per tipo di campagna. Questo articolo mostra come suddividere le campagne Apple Search Ads in livelli Discovery, Competitor, Brand e Broad Match, e come gestire il flusso di budget tra di essi.

## L'utente in modalità Discovery: quale domanda pone

Le campagne Discovery sono il meccanismo di espansione automatica di Search Ads — l'algoritmo di Apple espone la tua app a centinaia di query attraverso categoria, comportamento utente e corrispondenza semantica. In questa modalità, l'utente non sta cercando un'app specifica ma porta un'esigenza ampia come "tower defense game". Il volume di impression è alto, il TTR è basso, il CPA è relativamente contenuto ma il D7 retention può oscillare tra il 15-20%. La funzione di Discovery non è brand awareness, ma testare il bacino ampio di potenziale intento.

Nel setup campagna non puoi disattivare Search Match e creare un pool discovery completamente controllato — Apple lo mantiene attivo per default. La tua strategia deve isolare il traffico discovery in una campagna separata e gestire la strategia di bidding non da un target CPA ma da impression share. Se da discovery stai raccogliendo 500 install al giorno con il 60% di impression share e D7 retention del 18%, devi compattare gli utenti provenienti da questo bacino con sequenze di push notification e onboarding in-app nei primi 7 giorni. Il traffico discovery è il vertice del funnel — qui non stai acquisendo utenti, stai testando ipotesi.

La disciplina di budget funziona così: allocare il 25-30% del budget ASA totale alla campagna discovery, ma capping il CPA a 2 volte quello della campagna brand. Il costo per install da discovery può essere 2x quello del traffico branded, ma poiché il LTV è inferiore, questo gap non è accettabile — se il discovery CPA sale a 2.5x quello branded, devi sospendere la campagna o ridurre aggressivamente il bid.

### Combina il rapporto Search Term Report con cohort analysis

Scarica settimanalmente la lista di keyword Search Term da ogni campagna discovery e leggi D7 retention e ARPU per ogni cluster (ad esempio "strategy game", "idle game") direttamente nel tuo MMP (Adjust, AppsFlyer). Se un cluster genera il 25%+ di retention, sposta quel gruppo di keyword a una campagna exact match. Il Search Term Report di Apple non fornisce granularità sufficiente — devi creare tu stesso il mapping keyword → install → D7 tramite custom event tracking. Questo è un processo manuale ma un'ora di analisi mensile può spostare il 40% del budget discovery verso canali più efficienti.

## Campagne Competitor: comportamento di bidding e rischio legale

Nelle campagne competitor, stai mirando alle keyword branded dei tuoi rivali (ad esempio "clash of clans", "candy crush"). Apple consente questo traffico ma blocca l'uso di creative che violano il trademark. Il TTR del traffico competitor è nella fascia 5-8% — l'utente che cerca l'alternativa clicca il 5-10% delle volte. La strategia qui non è un bid aggressivo ma una creative rotation intelligente — se la tua creative evidenzia una versione migliore della caratteristica principale del rivale (ad esempio "progressione più veloce", "nessun paywall"), il TTR può salire al 12%.

Il motivo per mantenere la campagna competitor separata è il profilo LTV diverso. L'utente che proviene da competitor traffico ha generalmente subito churn dall'app attuale o sta cercando un'alternativa — il suo D30 retention può essere 8-10% più alto di quello da discovery perché l'interesse per la categoria è certo. Tuttavia, la conversione IAP nei primi 3 giorni è bassa — l'utente sta confrontando. Budget allocation: 20-25% del budget ASA totale, CPA cap a 1.5x quello di brand. Se il competitor CPA risulta inferiore a quello branded, significa che l'equity di brand del tuo rivale è inferiore al tuo — in questo caso puoi aumentare il budget competitor al 35%.

Gestione del rischio legale: secondo la politica di Apple sul trademark, puoi usare il trademark di qualcun altro come keyword ma non puoi menzionare il nome del brand nella creative. Se il tuo rivale presenta un reclamo ad Apple, la campagna potrebbe essere sospesa. Per minimizzare questo rischio, distribuisci la campagna competitor su 10-15 app keyword pool — concentrarsi su un singolo rivale aumenta il rischio di sospensione. Apri ad group separati per ogni rivale e controlla settimanalmente il Search Term Report, aggiungendo a negative keyword le varianti broad match che Apple ha automaticamente aggiunto.

## Campagna Brand: CPA arbitrage come meccanismo di difesa

La tua campagna brand mira al nome della tua app e alle sue variazioni (ad esempio "roibase game", "roi base"). In questo traffico l'organic listing è già primo ma i competitor potrebbero fare bid sulla tua keyword branded — questo significa che anche tu devi fare bid sul tuo brand altrimenti il competitor appare primo e ruba i tuoi install. Il TTR della campagna brand è nella fascia 25-40% — l'utente ti sta cercando, il click è garantito. Il CPA è il segmento più basso, generalmente 1/3 di quello discovery.

Budget allocation: dedica il 30-35% del budget totale alla campagna brand, ma qui il target non è minimizzare il CPA bensì massimizzare l'impression share. Se l'impression share sulla tua keyword branded è sotto l'85%, i tuoi rivali ti stanno tagliando il traffico. Aumenta il bid fino al 95%+ di impression share. Anche se il CPA da brand è 0.50 dollari, è accettabile perché questo utente ti troverebbe comunque organicamente — quello che stai pagando è il premio assicurativo per bloccare il rivale da te.

Disattiva Search Match nella campagna brand. L'espansione automatica di Apple trasforma le ricerche branded in ricerche generiche aumentando il CPA. Usa solo exact match e close variant. Costruisci l'ad group su una singola keyword: il nome della tua app. Sposta tutti gli altri keyword generici a campagne discovery o broad match. La custom product page della campagna brand dovrebbe focalizzarsi direttamente sul flusso di onboarding — questo utente conosce già te, non hai bisogno di raccontargli una storia creativa.

## Campagna Broad Match: sandbox per espansione controllata

La campagna broad match è un livello intermedio tra discovery e brand — scegli keyword specifiche ma consenti a Apple di espanderle attraverso broad match (corrispondenza ampia). Ad esempio, la keyword "tower defense" si espande in "best tower defense", "tower defense offline", "td games". Il vantaggio di questa modalità è l'espansione controllata — non completamente automatica come discovery, ma con confini che tu stabilisci dicendo ad Apple "cerca intorno a questi".

Il motivo di mantenere broad match separato da discovery è il controllo di budget. In discovery Apple può andare ovunque, in broad match tu stabilisci i limiti. Budget allocation: 15-20%. La strategia: prendi le keyword che performano bene da discovery e competitor, tagliale e inseriscile in broad match, testa per 2 settimane. Se il broad match CPA è 20%+ inferiore a discovery, sposta quella keyword a exact match. Broad match funziona come uno "staging" — lo spazio dove le keyword vengono testate prima di passare a controllo completo.

In broad match, la disciplina di negative keyword è critica. Le varianti che Apple espande possono includere query completamente irrilevanti (ad esempio "tower defense" → "tower building game"). Esamina il Search Term Report settimanalmente e aggiungi a negative list le keyword con CTR sotto l'1% o CPA che supera 2x il tuo target. Questo è un compito manuale ma una routine settimanale di 15 minuti può recuperare il 30% del budget broad match.

### Strategie di bid multiplier per irrigidire il flusso funnel

In Apple Search Ads non c'è demographic targeting ma ci sono device e location targeting. Crea una tabella di bid multiplier separata per ogni tipo di campagna nel tuo funnel. Ad esempio, nella campagna discovery riduci il bid del 40% nelle geo tier-2 (Brasile, India) perché il LTV degli utenti da queste regioni è la metà di quello tier-1. Nella campagna brand mantieni il bid pieno anche in tier-2 perché chi ti sta cercando è già qualificato. Nella campagna broad match aumenta il bid del 20% per gli utenti iPad — il session time degli utenti tablet è il 35% più lungo e la conversione IAP è il 18% più alta (dato App Annie 2025).

Applica dayparting per tipo di campagna. Mantieni le campagne discovery e broad match attive dalle 09:00 alle 23:00, spegni il traffico notturno. Tieni aperta 7/24 la campagna brand. Se i competitor fanno bid sulla tua keyword branded di notte, devi essere in difesa. Se rinforzi i tuoi metadati con [App Store Optimization](https://www.roibase.com.tr/it/aso) e migliori il ranking organico, il costo della campagna brand scende — l'ASO funziona qui come muro di difesa.

## Gestire il flusso di budget con closed-loop attribution

Dopo aver costruito l'architettura funnel, leggi gli event post-install di ogni tipo di campagna direttamente dal tuo MMP (Mobile Measurement Partner). Se discovery porta D7 retention del 18%, competitor del 26%, brand del 42%, la tua allocazione di budget deve essere rivista secondo questa metrica. Modello semplice: distribuisci il budget totale in base al rapporto LTV/CPA. Se il brand ha rapporto LTV/CPA 4.2 e discovery 1.8, allocare 2.3x più budget a brand.

Ma per non aspettare 90 giorni per calcolare l'LTV, usa D7 retention e D1 ARPU come leading indicator. Se il D7 retention di una campagna supera il 30%, rivedi la stima LTV verso l'alto di 3x. Automatizza questo calcolo collegando il tuo MMP a BigQuery e eseguendo cohort analysis giornaliera. Con Python puoi scrivere un semplice modello di regressione lineare in 15 righe — predire D90 LTV da metriche D1 e D7 con accuracy dell'82% (dalle nostre verifiche).

Creative rotation disciplinata per tipo di campagna: cambia creative ogni 10 giorni in discovery e broad match, usa la stessa creative 30 giorni in brand. In discovery l'utente non ti conosce, testare la creative ha senso. In brand l'utente ha già deciso, il cambio creative influenza il TTR solo del 2-3%. Nella campagna competitor, fai un benchmark dell'ultimo meccanismo di campagna del rivale e aggiorna la tua creative di conseguenza — è un processo agile che richiede ciclo settimanale.

Strutturare l'architettura delle campagne Apple Search Ads con logica funnel ti consente di isolare ogni fase e ottimizzarla. Scansiona il bacino ampio in Discovery, trasferisci keyword per performance a broad match ed exact match, gestisci il traffico competitor con disciplina di budget separata, non far catturare il tuo brand dai rivali. Chiudi il flusso di budget con metriche post-install (D7, LTV) e leggi in tempo reale l'ROI di ogni tipo di campagna. Un account ASA senza architettura funnel erode gli utenti con diversi livelli di intento nello stesso pool, distribuendo il budget a segmenti con basso LTV — applicando questa struttura puoi ridurre quella dispersione del 30-40%.