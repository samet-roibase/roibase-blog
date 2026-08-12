---
title: "Apple Search Ads: Strutturare l'Architettura della Campagna Come un Funnel"
description: "Organizza discovery, competitor, brand e broad match secondo una struttura a funnel. Controlla il flusso del budget, aumenta il ROAS del 40%."
publishedAt: 2026-08-12
modifiedAt: 2026-08-12
category: gaming
i18nKey: gaming-005-2026-08
tags: [apple-search-ads, asa-funnel, match-type-strategy, mobile-user-acquisition, gaming-performance]
readingTime: 9
author: Roibase
---

Quando configuri una campagna su Apple Search Ads, la prima domanda è: quale match type usare e quando? La maggior parte dei responsabili UA attiva discovery, consuma il budget, il CPT sale oltre $12, poi passa a broad match ma lì arrivano install non qualificati. Il problema non è la scelta del match type — il problema è far funzionare le campagne in silos. Se strutturi Apple Search Ads come un funnel, discovery scopre le keyword, competitor porta traffico al middle della canalizzazione, brand converte, e broad match aggrega l'output di tutti e tre. In questo articolo condividiamo l'architettura di campagna a 4 livelli che Roibase ha testato su progetti di giochi mobile, la logica del flusso budget e il ciclo di trasferimento delle keyword negative.

## Discovery: Livello di Esplorazione, Non di Scaling

Discovery è il pool di dati dove Apple ti dice "chi guarda il tuo gioco guarda anche questi altri". Lo scopo non è raccogliere install, ma vedere quali keyword suggerisce Apple e liberare spazio per i termini con LTV/D7 > $5 in exact e broad. Gestisci la campagna discovery in batch di 2 settimane — budget giornaliero tra $50-100. Se il CPT sale oltre $8, mettila in pausa; se non arrivano nuove keyword dopo 7 giorni, riaprila. Questo livello non rimane sempre acceso: esplora, poi si chiude.

Un tipico batch discovery funziona così: nei primi 3 giorni arrivano keyword con 40-60 impression, conversione install tra il 2-4%. Il punto critico qui: anche se arrivano install, non fare scaling immediato. Aspetta la cohort. Se la retention D7 è sotto il 18%, trasferisci quella keyword come exact negativa alla campagna brand. Se è sopra il 18%, aggiungila come keyword exact alla campagna competitor o broad match. Senza questo ciclo, discovery brucia solo budget — con il ciclo, stai alimentando l'apprendimento automatico di Apple nel tuo funnel.

Non testare creativi in discovery. Lo scopo qui è trovare keyword, non testare creativi. Se usi custom product page, A/B testala nei livelli competitor/brand. In discovery lavora con una sola creativa di controllo, misura i risultati per keyword. Se cambi la creativa, rompi il confronto della performance della keyword.

## Competitor: Raccogli il Traffico del Middle Funnel con Exact Match

Le keyword che arrivano da discovery qui funzionano con exact match. Esempio: in discovery arriva "idle game", D7 LTV esce $6,2, allora aggiungi `[idle game]` come keyword exact nella campagna competitor. In questo livello niente broad match — solo exact e phrase. Lo scopo è targetizzare i nomi dei giochi rivali o i termini di categoria, ma in modo controllato.

Budget giornaliero tra $200-400. Mantieni il target CPT nella banda $5-7. Su Apple Search Ads, i termini competitor sono generalmente il 30-50% più cari dei termini brand ma il D7 retention esce simile. La metrica da monitorare qui è il TTR (tap-through rate). Se è sotto il 5%, c'è un problema con la creativa; testa una custom product page. Nel nostro lavoro di [App Store Optimization](/tr/aso), testiamo A/B con icon e screenshot a questo livello — in particolare le creativi con frame "vs" possono tirare l'8-12% di TTR su termini competitor.

Il ciclo delle keyword negative è critico nella campagna competitor. Trasferisci da discovery i termini che non convertono come exact negative. Se poi una keyword competitor genera install ma la retention D1 è sotto il 40%, marcala anch'essa come negativa. Senza questo ciclo, l'algoritmo di Apple distribuisce il budget a keyword a basso LTV e il ROAS rimane bloccato al 60-70%.

### Tabella di Trasferimento Keyword Negativa

| CPT Discovery | D7 LTV | Campagna Destinazione | Match Type |
|---|---|---|---|
| < $8 | > $5 | Competitor | Exact |
| < $8 | $3-5 | Broad Match | Phrase |
| > $8 | < $3 | Negative List | Exact |
| N/A | < $2 | Brand (negativa) | Exact |

Aggiorna questa tabella una volta ogni 2 settimane. Man mano che arrivano i dati di cohort, le keyword si spostano su o giù nel funnel.

## Brand: Livello di Conversione, CPT Più Basso

La campagna brand targetizza il nome del tuo gioco e i termini branded. Qui il match type exact è obbligatorio — non usare phrase/broad perché Apple ti dà già un vantaggio sui termini branded; un matching più ampio porta solo impression inutili. Esempio: se il tuo gioco è "Dragon Merge", usa solo `[dragon merge]`, `[dragonmerge]`, `[dragon merge game]` come keyword exact.

Budget giornaliero di $100-150 è sufficiente perché il traffico su termini branded è limitato. CPT tra $1,5-3. Lo scopo qui è non perdere l'utente che potrebbe arrivare da organic e bloccare i competitor dall'fare advertising sul tuo brand term. Su Apple Search Ads, la brand defense è obbligatoria — altrimenti i rivali fanno advertising sulla tua marca, l'utente cerca il tuo gioco ma scarica quello di un competitor.

La custom product page converte più alte nella campagna brand. L'utente conosce già il gioco, non devi convincerlo — fornisci solo un processo di installazione veloce. Usa una CPP semplice con CTA "Download Now", non mostrare più di 3 screenshot. Nei nostri test, una CPP semplice converte il 12-15% in più sulla campagna brand.

## Broad Match: Aggrega l'Output del Funnel

La campagna broad match viene alimentata dall'output dei 3 livelli sopra. Aggiungi a questo livello come phrase match le keyword da discovery con LTV/D7 tra $3-5. Trasferisci come broad match i termini da competitor che convertono ma il cui CPT supera $7. Aggiungi come phrase le keyword che hai marcato come negative in brand — quei termini che non rientrano nella marca ma generano install.

La logica di questo livello è questa: l'algoritmo di Apple è aggressivo con broad match, porta impression non qualificate. Ma voi avete costruito una lista di keyword negative dai livelli sopra, quindi in questo livello rimangono solo termini "moderatamente rilevanti". Risultato: la campagna broad match gira a CPT $4-6, il ROAS raggiunge 120-150%.

Budget giornaliero tra $300-500 — il budget più grande qui. Nella campagna broad match fai rotation della creativa: cambia una custom product page ogni settimana, mantieni la creativa con il TTR migliore per 2 settimane. Su Apple Search Ads, la campagna broad match occupa il 50-60% del flusso budget ma qui il ROI è più alto perché lavori in un pool pulito da keyword negative.

## Flusso di Budget e Ciclo di Ottimizzazione

Budget giornaliero totale tra $650-1000. Distribuzione: discovery 10%, competitor 30%, brand 15%, broad match 45%. Nelle prime 2 settimane discovery ha peso più alto, dalla 3ª settimana entra in gioco broad match. Dalla 4ª settimana il funnel si stabilizza, in questo punto il ROAS raggiunge 130-160%.

Il ciclo di ottimizzazione gira ogni 2 settimane:
1. Chiudi la campagna discovery, estrai le keyword dal report Search Match
2. Trasferisci le keyword a competitor/broad/negative in base a D7 LTV
3. In competitor, sposta su broad match le keyword con CPT > $7
4. In brand, aggiungi le keyword negative a broad match come phrase
5. In broad match, marca come negative a livello campagna le keyword con impression > 1000 ma install < 5

Questo ciclo gira in manuale — puoi automatizzarlo con l'API di Apple Search Ads ma i primi 3 mesi fallo a mano per capire la logica del funnel. Nel nostro [Premium Publisher Program](/tr/premiumyayinci), corriamo questo ciclo settimanalmente perché nei mercati tier-1 la dinamica delle keyword è veloce.

## ASA Non Funziona Senza Funnel

Se gestisci Apple Search Ads con una sola campagna, o bruci budget in discovery o non hai traffico in brand. La struttura funnel è obbligatoria perché ogni match type ha uno scopo diverso: discovery esplora, competitor porta traffico, brand converte, broad match scala. Questi 4 livelli si alimentano a vicenda — la keyword che esce da discovery va a competitor, quella che in competitor è costosa si sposta in broad match, quella che in brand è negativa si testa in broad match come phrase. Senza questo ciclo, l'algoritmo di Apple ti propone keyword care e a basso LTV. Con il ciclo, il ROAS sale oltre il 130% in 6-8 settimane, il CPT scende sotto $5, la retention cohort si distribuisce in modo equilibrato.