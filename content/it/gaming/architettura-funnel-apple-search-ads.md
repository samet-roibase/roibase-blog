---
title: "Apple Search Ads: Costruire l'Architettura della Campagna Come Funnel"
description: "Guida strutturale per organizzare le campagne discovery, competitor, brand e broad match secondo la logica del funnel, ottimizzando il flusso di budget e i segnali tra livelli."
publishedAt: 2026-07-15
modifiedAt: 2026-07-15
category: gaming
i18nKey: gaming-005-2026-07
tags: [apple-search-ads, aso, mobile-growth, funnel-architecture, campaign-structure]
readingTime: 9
author: Roibase
---

Gestire Apple Search Ads come tipologie di campagne separate invece di un'architettura funnel interconnessa cambia le regole del gioco nella crescita mobile. Discovery, competitor, brand e broad match, se considerati singolarmente, lasciano la distribuzione del budget al caso — ma quando li organizzi come livelli del funnel, ogni tipo di campagna alimenta il livello superiore con segnali e attrae qualità da quello inferiore. A metà 2026, la maggior parte dei team di crescita per giochi mobili gestisce ancora le campagne in isolamento, causando perdite di efficienza del 30-40% nei loro CPI. Questo articolo spiega come strutturare l'architettura della campagna con una logica funnel, come orientare il flusso di budget verso i segnali giusti e perché l'integrazione con l'[ASO](https://www.roibase.com.tr/it/aso) è critica.

## Logica del Funnel: Ogni Tipo di Campagna Occupa un Livello Diverso

Apple Search Ads ha quattro tipi di campagna fondamentali: discovery (Search tab), competitor (ricerche di brand rivali), brand (ricerche del tuo brand) e broad match (termini di categoria ampia). Invece di vederli come entità separate, pensali così: discovery si trova in alto, catturando utenti senza consapevolezza. Broad match al centro, con segnali di intent ma competizione elevata. Competitor più ristretto, utenti che cercano il brand del rivale e altamente qualificati. Brand in fondo, utenti che già ti conoscono. Se inverti questa gerarchia, la distribuzione del budget collassa — assegnare il 60% a brand genera vendite, ma non espande il pool di utenti. Al contrario, destinare il 70% a discovery abbassa il CPI ma distrugge la retention, perché il traffico freddo entra nel funnel di conversione senza essere preparato.

Nella logica funnel, ogni livello invia segnali al precedente. Se un utente da discovery raggiunge un D7 retention superiore al 12%, catturi il profilo del suo segmento e lo usi come lista di negative keyword in broad match — così broad targeting diventa più ristretto. Se il CPM in competitor campagna scende sotto l'8%, quel profilo utente del rivale non si allinea al tuo, disattiva la campagna. Se il CPA di brand improvvisamente sale del 40%, significa che il tuo ranking in [App Store Optimization](https://www.roibase.com.tr/it/aso) è calato, il problema non è la campagna ma i metadati — prima correggi l'ASO. Gestendo le campagne in isolamento, questi segnali vanno persi.

Il flusso di budget segue la stessa logica. Discovery parte con il 40-50% perché popola il pool di utenti. Dopo 3-4 settimane, quando il profilo di retention si stabilizza, sposti il 30% a broad match e riduci discovery al 30%. Brand rimane sempre al 15-20% perché gli utenti che già ti conoscono costano poco ma il volume è limitato. Competitor è opzionale — nei mercati tier-1 (USA, UK) puoi allocare il 10-15%, nei mercati emergenti (LATAM, SEA) è inutile perché la brand awareness è bassa.

## Campagna Discovery: Il Laboratorio dell'Esperienza del Traffico Freddo

Le campagne discovery appaiono nel Search tab. L'utente apre il gioco, in basso vede suggerimenti "Potrebbe piacerti anche questo". Il segnale di intent è debole — l'utente potrebbe non stare nemmeno cercando la categoria del tuo gioco. Per questo motivo, l'obiettivo qui non è volume di install ma profilo di segmento utente. Usa discovery come arena di A/B test: piazza 4-5 set di creative diversi (con custom product page), esponi ciascuno a 5.000 impression per una settimana, cross-check IPM + D1 retention. IPM sotto il 4% viene scartato direttamente. IPM tra il 6-8% ma D1 retention sotto il 35% significa che la creative è fuorviante — cambia la scena finale.

La logica di budget per discovery funziona così: spendi aggressivamente le prime 2 settimane (50% del budget totale), quando i dati iniziano a stabilizzarsi riducila al 30%. Ma non fermarla mai, perché una volta interrotta perdi la fonte di input di segmento per broad match e competitor. Nel 2026, il machine learning di Apple Search Ads si stabilizza entro 72 ore, il che significa che il tuo CPI raggiunge il plateau in 3 giorni. Se il 5º giorno vedi ancora volatilità, il targeting è troppo ampio — aggiungi filtri per età, genere o geografia.

In discovery non usi keyword, Apple li abbina automaticamente. Ma puoi applicare liste di negative keyword — specialmente per termini relativi a generi di giochi rivali (se il tuo è match-3, rendi "battle royale" negativo). Una trappola: Apple suggerisce anche per categoria. Se il tuo gioco è pubblicato in categoria "Casual" ma la meccanica è più simile a "Puzzle", hai sbagliato la categoria nei metadati. In questo caso il problema non è la campagna ma l'ASO — correggi la categoria e l'ottimizzazione del subtitle. Se la performance di discovery è bassa, il primo passo è un audit ASO, non un aumento di budget.

## Competitor e Broad Match: Filtri di Qualità e Dinamiche di Budget

Le campagne competitor hanno senso solo nei mercati tier-1. In mercati come Turchia, Brasile, Indonesia, la brand awareness è bassa e gli utenti non cercano il nome del rivale, cercano il termine di categoria generico. Negli USA, 1 milione di utenti cercano "Candy Crush", in Turchia solo 50.000 — per questo allocare budget a competitor in Turchia porta ROI negativo. Se sei in un mercato tier-1, mantieni competitor ristretto: target solo i 3-5 giochi con cui competi direttamente. Per ogni keyword, il TTR (tap-through rate) deve essere minimo 5%, altrimenti la tua creative non attrae gli utenti del rivale — cambia icon e screenshot set.

In competitor, la strategia di bid è aggressiva: puoi salire fino al 120% del tuo CPA massimo, perché l'utente del rivale è qualificato, ha già giocato a un gioco simile. Ma dopo 2 settimane misura LTV/D30 — se l'utente da competitor mostra retention del 15% più bassa, quel segmento non è compatibile con la meccanica del tuo gioco, chiudi la campagna. Errore comune: se il rivale è grande, anche i suoi utenti funzioneranno per me. No — un utente di "PUBG Mobile" è completamente diverso da uno di "Among Us", anche se entrambi sono "battle royale".

Le campagne broad match servono per termini di categoria: "puzzle game", "strategy rpg", "idle game". Qui il matching esatto vs. broad è controllabile. All'inizio tienilo aperto (broad), dopo 1 settimana scarica il rapporto dei termini di ricerca, rendi negative i termini non pertinenti. Esempio: il tuo gioco si basa su meccanica "merge", ma broad match sta portando anche ricerche "match-3" — rendi "match-3" negativo. Il budget per broad match deve essere tra il 25-35% — oltre e stai distribuendo senza usare i dati di segmento da discovery, sotto e non cattturi abbastanza volume.

## Campagna Brand: Difesa e Indicatore di Salute ASO

La campagna brand target il nome del tuo gioco. "Ma siamo già primo nella ranking organica, serve pagare?" è la domanda sbagliata. Anche se sei primo nell'organic, i competitor possono targetare il tuo brand name negli ads — quando qualcuno cerca "Il Tuo Gioco", il rivale può apparire. La campagna brand protegge quel traffico perché rimanga su di te. Inoltre, il CPA più basso emerge qui (solitamente 1/5 di discovery), quindi allocare il 15-20% del budget ha ROI positivo.

La seconda funzione della campagna brand è essere un indicatore di salute ASO. Se il tuo CPA brand sale improvvisamente (ad esempio, +30% in 2 settimane), significa che il tuo ranking organico è calato. Perché: quando il ranking scende, la visibilità organica diminuisce, gli utenti cliccano di più sulla tua campagna ads di brand, Apple applica una tariffa più alta. Non puoi risolvere questo problema ottimizzando la campagna — lo risolvi con ASO (density di keyword, subtitle, naming dell'IAP) e gestione di rating/review. Usa la campagna brand come "sistema di allarme precoce".

Il bid per brand keyword deve essere aggressivo: fino al 150% del tuo CPA massimo. Perché se il rivale fa un bid war per il tuo brand, se perdi il traffico si disperde. Alcuni team dicono "comunque arriverò organico" e usano bid bassi in brand — questa strategia funziona solo senza competizione. Nei mercati tier-1 la competizione esiste sempre, quindi brand è difesa attiva, non passiva.

## Flusso di Budget: Scenario Pilota di 4 Settimane

Supponiamo che tu abbia $15.000 di budget per 30 giorni, stai lanciando un nuovo gioco RPG "idle", mercato USA. Settimana 1: discovery 50% ($1.875), broad 25% ($937), brand 20% ($750), competitor 5% ($187). Competitor basso perché ancora non hai profilo di segmento. Nei primi 7 giorni discovery genera 2.500 install, misuri il D1 retention — risultato 32%. Aspetti 1 settimana per misurare D7.

Giorno 14: D7 retention è 18% (accettabile per un RPG idle). Gli utenti da discovery sono 60% uomini 25-34, 30% donne 18-24. Aggiungi questo profilo come filtri età/genere alla campagna broad match. Revisionali il budget così: discovery 35%, broad 35%, brand 20%, competitor 10%. Perché ora hai il profilo di segmento, broad match lavorerà più qualificato.

Giorno 21: competitor campagna ha generato 150 install, ma D1 retention è 22% — 10% più basso di discovery. Quel segmento non è compatibile con il tuo gioco. Chiudi competitor, sposta quel 10% a broad match. Ultima settimana: discovery 30%, broad 45%, brand 25%. Questa distribuzione ora diventa stabile, il funnel ha raggiunto l'equilibrio. Alla fine dei 30 giorni: 7.200 install totali, CPI blended $2.08, D30 retention 9.5% — baseline solida per un RPG idle tier-1.

## Misurazione e Iterazione: Su Quali Segnali Guardare

Dopo aver costruito l'architettura di campagna, la misurazione avviene su 3 livelli: livello campagna (CPI, IPM, TTR), livello funnel (D1/D7/D30 retention), livello economico (LTV/CAC). Ogni tipo di campagna ha propri criteri. Per discovery bastano IPM e D1 retention, non aspetti LTV perché il traffico è freddo. Per broad match, la D7 retention è critica — sotto il 15% è inaccettabile. Per competitor, il TTR è primario — sotto il 5% la creative è debole. Per brand, l'aumento di CPA attiva l'allarme ASO.

Il ciclo di iterazione settimanale: lunedì mattina scarica i metricdi campagna (Apple Search Ads Console), ottieni i dati di retention dal tuo MMP (Adjust, AppsFlyer), leggi la proiezione LTV dal tuo BI dashboard. Entro venerdì prendi queste decisioni: quale set di creative chiudere, quale keyword rendere negativo, quale campagna aumentare di budget. Ogni due settimane fai cambiamenti di strategia più ampi: allocazione budget funnel, test nuovo mercato, aggiornamento metadati ASO.

Una trappola: Apple Search Ads ti chiederà costantemente di aumentare il budget. Non farlo ogni volta che lo vedi. Controlla prima se stai spendendo l'intero budget attuale — se sei sotto l'80%, già non ricevi abbastanza impression, il problema è il targeting. Se sopra il 95% e il CPI è entro target, aumenta, ma massimo +20% — gli aumenti improvvisi disturbano il machine learning.

## Integrazione ASO: I Metadati della Campagna si Alimentano Reciprocamente

Le campagne Apple Search Ads non possono essere gestite indipendentemente dall'ASO. I metadati che la campagna mostra (icon, screenshot, subtitle, testo promozionale) vengono direttamente dalla pagina App Store. Se l'IPM è basso in discovery ma alto in competitor, significa che il tuo icon sembra generico — perché chi cerca il brand del rivale ha già alto intent, clicca anche se l'icon non è accattivante. Ma il traffico freddo (discovery) guarda l'icon, se non attrae scorre oltre.

Le custom product page (CPP) entrano qui. Apple ora ti permette di assegnare una CPP diversa a ogni campagna. Per discovery usi screenshot set più boldly, animati. Per brand design più minimale, focalizzato su logo. Per competitor, confronto con il rivale (se permesso dalle linee guida). Se non fai questa distinzione e usi metadati unici per tutte, l'imbuto di conversione non è ottimizzato. Nel processo di [ASO](https://www.roibase.com.tr/it/aso), devi costruire la strategia di CPP in parallelo con l'architettura di campagna.

I metadati ASO si aggiornano ogni 4-6 settimane — la keyword density cambia mentre l'algoritmo di Apple si evolve, la gestione di rating/review prevenuto i segnali di churn, il pricing dell'IAP viene testato. Questi cambiamenti impattano direttamente la performance della campagna. Ad esempio: cambi il subtitle da "merge" a "build", una settimana dopo in broad match la ricerca "build game" aumenta — devi aggiungerlo manualmente come keyword. ASO e Search Ads devono essere gestiti dallo stesso team, nello stesso sprint.

## Conclusione: L'Architettura Non È un Setup Unico, È un Sistema Dinamico

Costruire l'architettura di campagna come funnel non finisce in una volta. I primi 30 giorni sono pilota, i successivi 60 stabilizzazione, poi iterazione continua. Il flusso di budget cambia di 10-15% al mese perché il calendario di live ops del gioco (event, season, IAP sale) influenza la dinamica della campagna. Quando discovery è aggressiva, broad match due settimane dopo mostra migliore performance, perché il