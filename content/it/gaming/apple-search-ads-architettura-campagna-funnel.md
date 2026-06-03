---
title: "Apple Search Ads: Strutturare l'Architettura della Campagna come Funnel"
description: "Ottimizzare budget per discovery, competitor, brand e broad match tramite logica funnel. Integrare la struttura ASA con LTV."
publishedAt: 2026-06-03
modifiedAt: 2026-06-03
category: gaming
i18nKey: gaming-005-2026-06
tags: [apple-search-ads, asa-funnel, mobile-acquisition, match-type-strategy, gaming-ua]
readingTime: 8
author: Roibase
---

Usare Apple Search Ads come strumento PPC basato su keyword è finito nel 2021. Nel 2026, ASA è un'operazione di funnel. Strati di campagna che si estendono da discovery a brand, budgetizzati con stime LTV e ottimizzati su D7 ROAS, non su volume di install. La maggior parte dei team ancora utilizza broad match in una singola campagna e si lamenta "non riusciamo a scalare". Il problema non è il budget, è il design architetturale.

## Campagna Discovery: Scansionare il Pool di Traffico Freddo

La campagna discovery è costruita per leggere il comportamento di ricerca degli utenti che non hanno mai sentito parlare della vostra app su App Store. Si selezionano 200-500 keyword generici con broad match, si tiene il budget giornaliero basso (50-100 dollari in tier-1), ma si porta la search impression share vicino al 100%. L'obiettivo non è il volume di install, ma raccogliere dati di Search Match.

Analizzate il rapporto Search Match 72 ore dopo il lancio della campagna. Su quali query avete ottenuto impressioni? Quali parole chiave hanno generato install? Quali sono spam? Questi dati convalidano o smentiscono la vostra strategia ASO. Ad esempio, se mettete in evidenza "puzzle" nei metadata ma Search Match mostra alto TTR su "idle game", c'è una disallineamento tra ASO e UA.

Nel livello discovery, il CPT (cost per tap) è del 35-50% inferiore perché la competizione è scarsa per keyword sconosciute. Ma il conversion rate (tap-to-install) è debole. È normale. Il compito di discovery è alimentare il funnel, non generare volume di install. 200-300 install settimanali sono sufficienti; il 15% viene aggiunto alla lista di keyword negative, il resto filtra nelle campagne competitor e brand.

### Regola Budget Discovery

Il budget giornaliero della campagna discovery non deve superare il 10-15% del vostro spend ASA totale. Esempio: con spend ASA mensile di 30.000 dollari, discovery riceve 100 dollari/giorno. Il budget è fisso, non ci sono target CPA, si usa bid manuale (solitamente 0,30-0,50 dollari in tier-1). Dopo 14 giorni, i keyword ad alta performance da Search Match si trasferiscono come exact match alla campagna competitor.

## Campagna Competitor: Competere per il Brand dei Rivali

Il livello competitor prende di mira i nomi dei brand rivali con exact match. "Candy Crush", "Clash of Clans", "Subway Surfers" e simili operano in questo livello. La strategia dovrebbe essere opportunistica, non aggressiva. Se un concorrente usa max bid sul proprio brand term, il vostro dovrebbe stare al 60-70%, non mirare alla prima posizione.

Il CPT delle campagne competitor è dell'80% più alto di discovery ma il TTR sale al 12-18% (vs 3-5% in discovery). La conversione install non è buona perché l'utente stava cercando un altro gioco. La retention D1 rimane al 25-30%, mentre sui vostri install organici è del 45-50%. Ma in alcuni scenari espande il vostro pool LTV totale.

Il KPI del livello competitor è "incremental ROAS". Se fate pausa il keyword competitor, il vostro volume install totale scende del 10%? Scende? Allora la campagna fornisce incrementalità. Non scende? Lo stesso utente proveniva già da discovery o dal brand, c'è cannibalizzazione. Un test di incrementalità di 14 giorni è obbligatorio.

| Match Type | CPT (tier-1) | TTR | D7 ROAS Target | Budget Share |
|---|---|---|---|---|
| Discovery (broad) | $0,40 | %3-5 | Test mode | %10 |
| Competitor (exact) | $1,20 | %12-18 | %80+ | %25 |
| Brand (exact) | $0,60 | %25-35 | %200+ | %50 |
| Generic (broad) | $0,70 | %6-9 | %120+ | %15 |

## Campagna Brand: Proteggere il Vostro Marchio

La campagna brand prende di mira gli utenti che cercano il nome della vostra app e previene che i competitor la catturino. Termini come "Roibase Puzzle", "Roibase Game", "Roibase RPG" si targettizzano con exact match. In questo livello si usa max bid perché persino il ranking organico può essere sconfitto da annunci competitor.

Il CPT delle campagne brand è il più basso (0,40-0,80 dollari in tier-1). TTR del 25-35%, install CR del 60-70%, retention D7 oltre il 50%. Questo utente conosce già il vostro gioco, lo scaricherebbe. La domanda è: "Questo utente compirebbe lo scaricamento organico senza la campagna brand?" La risposta è generalmente "sì", ma se un competitor fa bid sullo stesso termine, la campagna diventa necessaria.

Il budget del livello brand costituisce il 40-50% dello spend ASA totale. Sembra elevato, ma è una posizione difensiva. Quando un competitor fa bid sul vostro brand term, voi fate lo stesso sui loro — MAD (mutually assured destruction). Nel 2026, quasi ogni gioco in tier-1 fa difesa brand; chi non lo fa perde il 10-15% degli install organici.

### Test di Pausa Campagna Brand

Se nessun competitor prende di mira il vostro brand term, mettete in pausa la campagna per 7 giorni. Il volume install organico scende? Se non scende, la campagna brand sta gonfiando il vostro budget UA ma non crea valore incrementale. Se scende (di solito si vede un calo dell'8-12%), mantenete la campagna attiva ma impostate un CPA cap (massimo il 15% dell'LTV dell'utente organico).

## Broad Match Mode: Non Discovery, ma Strumento di Scale

Il broad match non va confuso con discovery. Discovery usa broad match ma con bid basso e budget basso per raccogliere dati di Search Match. Una campagna broad match di scale usa bid alto e budget alto per guadagnare impression share su termini generici. "puzzle game", "idle rpg", "strategy mobile" operano in questa modalità.

Il rischio delle campagne broad match è la "query non correlata". Fate bid su "puzzle" ma Search Match la mostra anche per "puzzle solver app", "puzzle table" e altri termini non-gaming. La lista di keyword negative deve contenere 200+ termini. Durante i primi 7 giorni è obbligatoria la revisione manuale — analisi quotidiana di Search Match.

Il budget broad match non deve superare il 15-20% dello spend ASA totale. Esempio: con budget mensile di 30.000 dollari, assegnate 5.000 dollari a broad match. Il target CPA deve essere il 20-30% più alto rispetto alle campagne exact match perché opera più in alto nel funnel. Il target D7 ROAS è del 100-120%. Se scende sotto, non fate pausa ma riducete il bid — la campagna continua a raccogliere dati.

## Flusso Budget: Scorrimento da Livello a Livello del Funnel

L'architettura ASA corretta trasporta l'utente da discovery a brand. Un utente esposto per la prima volta in discovery ricerca il nome del vostro gioco su App Store entro 48-72 ore? Questa volta la vostra campagna brand lo cattura. Per misurare questo flusso si usa l'attribution data "Custom Product Page" di Apple — quale campagna ha il first touch, quale genera l'install?

La distribuzione del budget si configura così: discovery rimane fisso (100 dollari/giorno), competitor e broad match aumentano o diminuiscono del 10-20% settimanale in base alla performance CPA, la campagna brand funziona in modalità "always on" con budget massimo. Quando lo spend totale scende sotto l'obiettivo D7 ROAS, si chiude prima competitor, poi si mette in pausa broad match, mentre discovery e brand continuano.

Esempio di flusso: a maggio, la campagna discovery ha generato 250 install, il 12% (30 utenti) ha ricercato il nome del brand entro 72 ore e ha installato dalla campagna brand. L'LTV medio di questi 30 utenti era il 40% più alto di chi ha installato direttamente da discovery. Questi dati provano che discovery non ha solo impatto diretto su install, ma crea un effetto di indirect brand lift.

### Tabella Attribution Funnel

```
Campaign         | Spend    | Installs | Direct LTV | Assisted Installs | Blended LTV
----------------|----------|----------|------------|-------------------|-------------
Discovery       | $3.000   | 250      | $4,20      | 30 (brand)        | $5,80
Competitor      | $7.500   | 420      | $6,10      | 15 (brand)        | $6,50
Brand           | $15.000  | 1.200    | $12,40     | —                 | $12,40
Broad Match     | $4.500   | 310      | $5,30      | 22 (brand)        | $6,00
```

## Campaign Budget Optimization: Il Nuovo Algoritmo di Apple

Dal 2025, Apple Search Ads sta testando "Campaign Budget Optimization" (CBO). Assomiglia alla strategia di bid portfolio di Google App Campaigns: un unico budget, molteplici campagne, il machine learning reindirizza automaticamente verso la campagna con migliore performance. Usare CBO nel gaming UA è rischioso. L'algoritmo non considera il target D7 ROAS, massimizza solo il volume di install.

Se attivate CBO, la campagna brand assorbirà il 70-80% del budget perché il CPA è più basso lì. Discovery e competitor rimangono affamati di budget. Risultato: il volume install non cala, ma l'alimentazione del funnel superiore si arresta, e 3 settimane dopo il volume di install della campagna brand inizia a calare. Usate CBO solo in queste condizioni: state unendo campagne con CPA simile, come brand + broad match.

## Quale Livello Viene Chiuso Quando Non Perfeziona?

La decisione di chiusura si basa su incrementalità, non su CPA. La campagna competitor è il 30% sopra il target CPA ma quando la mettete in pausa il volume install totale cala dell'8%? È incrementale — continuate, ottimizzate il bid. La campagna broad match è allineata al target CPA ma quando la mettete in pausa il volume install non cambia? Sta cannibalizzando — chiudetela.

La campagna discovery non va mai chiusa. Il budget può essere ridotto ma non azzerato. Perché il compito di discovery non è ROAS immediato, ma testare ipotesi ASO e alimentare il pool di dati di Search Match. La campagna brand non si chiude mai. Se nessun competitor prende di mira il vostro brand term siete in posizione difensiva permanente.

L'architettura funnel ASA non si integra con la strategia [App Store Optimization](https://www.roibase.com.tr/it/aso) e la performance della campagna raggiungerà un plateau in 3-4 settimane. Le parole chiave evidenziate nei metadata devono allinearsi con i termini targettizzati nelle campagne ASA. Se una parola chiave inaspettata mostra alto TTR in discovery, aggiungerla ai metadata ASO aumenta il CR di install del 10-15%.