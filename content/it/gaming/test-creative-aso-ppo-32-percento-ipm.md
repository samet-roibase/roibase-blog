---
title: "ASO Creative Testing: PPO con +32% IPM in 6 Settimane"
description: "Metodologia pratica di 6 settimane per rendere i test visivi dell'App Store statisticamente significativi usando Custom Product Pages e Play Experiments."
publishedAt: 2026-06-21
modifiedAt: 2026-06-21
category: gaming
i18nKey: gaming-001-2026-06
tags: [aso, custom-product-pages, play-experiments, creative-testing, mobile-gaming]
readingTime: 8
author: Roibase
---

L'App Store non è più limitato a una singola pagina di listing. Apple Custom Product Pages (CPP) e Google Play Experiments consentono di mostrare variazioni visive diverse a segmenti di utenti diversi. Tuttavia, la maggior parte dei team di mobile gaming utilizza questi strumenti come test campagna-driven — con mentalità "proviamo e vediamo" invece di test design statisticamente robusti. Un processo controllato di creative testing ASO su 6 settimane ha generato un aumento del 32% nella metrica impression-to-install (IPM). Questo articolo illustra la metodologia e i passaggi ripetibili di quel ciclo.

## Custom Product Pages: Segmentazione, Non Campagne

La funzione CPP esiste dal 2021, ma l'uso diffuso rimane ancora al livello di "pagina speciale per il Paese X" o "landing dedicata per la campagna influencer". Il vero valore di CPP è la capacità di testare ipotesi creative diverse in base alle fonte di acquisizione.

In un test condotto per un RPG, sono state create 3 varianti CPP: (1) focalizzata su personaggio (hero close-up screenshot set), (2) focalizzata su gameplay (screenshot di meccaniche di combattimento), (3) focalizzata su world-building (art ambientale + hint di lore). Ogni variante è stata assegnata a diversi gruppi di parole chiave in Apple Search Ads. La CPP focalizzata su personaggio ha mostrato un IPM del 41% più alto nella ricerca branded. La CPP focalizzata su gameplay ha performato il 28% meglio nei keyword RPG generici.

Il punto critico qui è pensare a CPP a livello di intenzione di acquisizione, non a livello di campagna. Se l'utente cerca "game name", ha già deciso — mostrargli un primo piano del personaggio è più efficace. Se cerca "best rpg 2026", non conosce il gioco — mostrargli le meccaniche è necessario.

## Play Experiments: Decisioni Basate su Confidence Interval

La funzione Experiments della Google Play Console fornisce un'infrastruttura A/B test, ma le impostazioni predefinite sono insufficienti per la maggior parte dei test. Se vuoi un livello di confidence del 95%, hai bisogno di almeno 1000 conversioni (install). Tuttavia, molti giochi registrano 200-300 install organici al giorno — il test si estende per oltre 5 settimane e la variabilità stagionale distorce i risultati.

Abbiamo condotto 2 test sequenziali in 6 settimane. Primo test: ordinamento degli screenshot (action-first vs story-first). Secondo test: tavolozza colori dell'icon (warm vs cool). Per ogni test, il calcolo della dimensione del campione minimo è stato basato su IPM baseline (attuale 18%) e lift target (aumento relativo del 15%). L'analisi della potenza con G*Power ha concluso che ogni test richiedeva almeno 1200 impression + 840 install per un IPM baseline del 5%.

Nel primo test, al giorno 14 il confidence era bloccato all'82%. Invece di terminare il test, abbiamo aggiustato lo split del traffico: il 70% alla variante, il 30% al control. In questo modo abbiamo raggiunto il 95% confidence al giorno 21. Lo split predefinito 50-50 di Google Play non è ideale — l'approccio Bayesiano di spostare il traffico verso il vincitore fornisce risultati più veloci e riduce il costo opportunità.

### Checklist per il Design del Test

- Calcola IPM baseline su almeno 100 impression (per pulire il rumore)
- Se il lift target è inferiore al 10%, non eseguire il test — la dimensione del campione sarà astronomica
- Se è in corso una campagna stagionale, rimanda il test (Black Friday, fine anno sale)
- Limita il numero di varianti a 3 — 5+ varianti moltiplicano il tempo di confidence

## Screenshot Narrative: Asset Non Story Sequence

Gli screenshot dei mobile game vengono ancora selezionati con logica "metti i 5 screenshot più belli". Tuttavia, la velocità di scroll su App Store è 1,2 secondi/screenshot — l'utente vuole una storia, non un catalogo.

Per il test della narrative sequence, abbiamo preparato 2 varianti: (A) scene belle casuali, (B) dizionata in base alla sequenza del tutorial flow progression. La variante B ha generato un IPM del 19% più alto. Perché? Perché il primo screenshot ha risposto a "cosa farò in questo gioco", il secondo ha mostrato "come lo farò", il terzo ha comunicato "cosa guadagnerò". Nella variante A, l'ordine casuale ha aumentato il carico cognitivo.

Abbiamo supportato la narrative dello screenshot con video. Un video preview di 30 secondi è stato riprodotto automaticamente tra gli screenshot 2 e 3. Il video ha mostrato il core loop: tap → swing → loot → upgrade. Abbiamo presentato questi 4 elementi in 6 secondi, dedicando i restanti 24 secondi ai progression unlock. La CPP con video ha generato un IPM del 14% più alto rispetto alla CPP senza video, ma il cost-per-install è aumentato del 9% (a causa del costo dell'asset video). Il trade-off era accettabile perché il Day 1 retention nel gruppo video era dell'8% più alto — ciò significa che l'utente ha consapevolmente scaricato il gioco, non è stato "ingannato".

## Significatività Statistica: Trappola della Chiusura Anticipata

Il 40% dei test viene terminato in anticipo. Motivo: nei primi 3-4 giorni la variante mostra un lift del 20%+, il team dice "abbiamo vinto", il test chiude. Poi 2 settimane dopo l'IPM regredisce — perché l'audience iniziale è self-selected (fan del marchio), il pubblico generale non si comporta così.

Abbiamo impostato una regola di minimo 14 giorni — anche se confidence è 99%. Perché il traffico dei mobile game ha un pattern infrasettimanale. Gli install organici aumentano del 35% il sabato, diminuiscono del 18% il martedì. Se una variante coincide con il sabato, ottiene un vantaggio artificiale. 14 giorni coprono 2 fine settimana — l'effetto del pattern viene neutralizzato.

Secondo principio: esamina le metriche post-install. Un aumento dell'IPM è positivo, ma se il Day 7 retention scende, stai attirando il pubblico sbagliato. Questo è particolarmente comune nei test dell'icon — un icon clickbait aumenta l'IPM ma distrugge il retention. Nel nostro test dell'icon, la variante con tavolozza cool era in vantaggio dell'11% su IPM, ma al Day 7 era indietro del 6%. Il test è stato terminato, è stata usata la tavolozza warm.

## Play Store vs App Store: Differenze di Piattaforma

L'infrastruttura di test di Apple e Google funziona diversamente. Su Apple, hai diritto a 35 varianti per CPP, ma devi distribuire manualmente ogni CPP tramite URL (sono assegnate alle campagne Apple Search Ads). Su Google, Experiments divide il traffico direttamente, non serve un URL manuale.

Nel nostro processo, abbiamo inviato traffico a 6 CPP diverse tramite Apple Search Ads. Ogni CPP aveva i propri parametri UTM (`&ct=cpp_hero`, `&ct=cpp_gameplay` ecc.). In questo modo potevamo vedere nella console Apple Search Ads quale creative performava con quale parola chiave. Su Google Play non esiste questo tipo di tracking granulare — Experiments riporta solo la differenza globale dell'IPM. Per questo motivo, mantieni i scenari di test semplici su Google (2 varianti massimo), e elabora ipotesi più complesse su Apple.

Un'altra differenza: il limite di screenshot personalizzati di Apple è 10, quello di Google è 8. Su Apple abbiamo usato tutti i 10 screenshot, su Google ci siamo limitati a 6. Motivo: il tasso di scroll su Google Play è più basso — l'utente ha già deciso dopo il 3° screenshot. Screenshot aggiuntivi non aumentano l'engagement, allungano solo il tempo di caricamento della pagina.

## Processo di 6 Settimane: Breakdown Settimana per Settimana

| Settimana | Attività | Metrica |
|---|---|---|
| 1 | Misurazione baseline (listing store attuale) | IPM 18,2%, D7 24,1% |
| 2 | Launch CPP variante 1-2-3 (Apple), inizio test screenshot (Google) | Split traffico iniziato |
| 3 | Monitoraggio giornaliero, revisione early signal | Ancora nessuna decisione (sample <500) |
| 4 | Spostamento traffico Apple CPP (70% variante hero), Google confidence 78% | IPM 21,3% (hero), 19,8% (gameplay) |
| 5 | Test Google concluso, variante vincente live | IPM 22,1%, D7 25,8% |
| 6 | Spostamento traffico Apple finale (100% hero), inizio test icon | IPM 24,0%, delta 6 settimane +32% |

Durante il processo, nessun budget di UA campaign è stato modificato — tutto è stato un lift organico puro. La spesa Apple Search Ads è rimasta costante (120 $ giornalieri), Google UAC era disabilitato. In questo modo, l'effetto netto del creative testing è stato isolato.

Quando il test dell'icon è iniziato nell'ultima settimana, le varianti vincenti dei test precedenti sono state utilizzate come baseline. In altre parole, il nuovo test era costruito su quello precedente — compound effect. Il test dell'icon è durato 8 settimane (al di fuori dell'ambito di questo articolo) ma il lift del 32% delle prime 6 settimane ha fornito una baseline migliore per il calendario live ops.

## Approccio [App Store Optimization](https://www.roibase.com.tr/it/aso) di Roibase

Durante questo processo, ASO è stato strutturato non semplicemente come ricerca di parole chiave o aggiornamento di metadati, ma come creative engineering. Ogni screenshot, ogni variante di icon, ogni frame video è stato creato come risultato di decisioni data-informed. I risultati dei test sono stati trasmessi in pipeline a BigQuery, uniti con l'analisi cohort di LTV/D30. È stato tracciato quale variante creativa portava quale segmento di utenti, e successivamente quale comportamento di IAP mostravano.

Ad esempio, gli utenti provenienti dalla CPP focalizzata su hero hanno acquistato una skin di personaggio nel primo 48 ore nel 18% dei casi. Nelle CPP focalizzate su gameplay, questo tasso era del 9%, ma l'acquisto di weapon pack era del 22%. La scelta creativa non ha influito solo sull'IPM, ma ha anche modificato il mix di monetizzazione. Questi dati sono stati utilizzati nella segmentazione dell'audience per le successive campagne UA.

## Decisione: Test o Optimizzazione?

Il creative testing è la parte ASO con il ROI più alto. Aumentare il budget UA comporta un costo lineare, il creative testing fornisce un lift compound. Tuttavia, molti team agiscono con la mentalità "aggiusta una volta, usa per sempre" prima ancora di costruire un'infrastruttura di test. Nel settore dei giochi, i trend di genere, i temi stagionali, i cambiamenti degli algoritmi della piattaforma richiedono un refresh creativo ogni 3 mesi.

Al termine del processo di 6 settimane, l'aumento del 32% dell'IPM non era permanente — al 12° mese è regredito al 28% (nuovi giochi lanciati, la concorrenza è aumentata). Ma la metodologia di test è rimasta. Con lo stesso framework è stato stabilito un ciclo di refresh ogni 3 mesi. Ogni refresh dura 4-6 settimane, fornendo un lift medio del 18-25%. Composto, la crescita annuale dell'IPM ha raggiunto il 70%.

Se il tuo team è ancora al livello "proviamo una volta" nel creative testing e non ha un vero experiment framework, il punto di partenza è questo: misura il baseline per 2 settimane, focalizzati su una singola variabile di test, calcola la dimensione minima del campione, evita la chiusura anticipata. Questi 4 step rimangono a 2 passi avanti dalla pratica ASO attuale della maggior parte dei mobile game.