---
title: "iOS 17 Successivamente: Lo Stack di Attribution Mobile"
description: "ATT, SKAdNetwork 4, modeled conversions: come è cambiata l'architettura di attribution mobile post-iOS 17, quali fonti di segnali sono affidabili, perché i test di incrementality sono diventati obbligatori?"
publishedAt: 2026-07-09
modifiedAt: 2026-07-09
category: marketing
i18nKey: marketing-003-2026-07
tags: [ios-attribution, skadnetwork, att, mobile-measurement, incrementality]
readingTime: 8
author: Roibase
---

Dalla versione iOS 14.5, l'attribution mobile è una lotta per la sopravvivenza. iOS 17 e il punto in cui siamo arrivati a metà 2026: i segnali deterministici occupano il 15-20%, le modeled conversions sono la maggioranza, SKAdNetwork 4 è maturo ma non è uno standard universale, ogni piattaforma si affida al proprio modello di stima. I CMO non riescono ancora a rispondere alla domanda "quanto budget assegno a ogni canale" perché lo stack di attribution è frammentato e contraddittorio. In questo articolo esaminiamo l'architettura di misurazione mobile post-iOS 17, la gerarchia di affidabilità delle fonti di segnale e il motivo per cui il test di incrementality è diventato più importante della stessa attribution.

## I segnali deterministici non sono più la maggioranza

Quando iOS 14.5 ha introdotto ATT (App Tracking Transparency), i tassi di opt-in IDFA sono crollati al 5-15%. Con iOS 17, questa fascia si è ampliata al 15-20%, ma rimane una minoranza. L'attribution deterministico — l'abbinamento diretto tra l'annuncio cliccato dall'utente e l'evento realizzato nell'app — è ora a livello di dati campionari. Potete usare questo segmento demografico per l'analisi, ma non potete estrapolare le performance complessive da qui perché gli utenti che accettano l'opt-in hanno un comportamento diverso rispetto al segmento che rifiuta il tracciamento.

Per il restante 80-85%, ci sono tre fonti di segnali: SKAdNetwork (il framework privacy-preserving di Apple), il probabilistic matching (residui di fingerprinting) e i modelli proprietari delle piattaforme (il machine learning di Meta/Google). Nessuno di questi è deterministico. I postback di SKAdNetwork aggregano gli eventi, arrivano con un ritardo di 24-144 ore, e l'encoding del valore di conversione è limitato (un intero di 6 bit da 0-63). Il probabilistic matching è proibito da Apple — le aziende scoperte rischiano di essere rimosse dall'App Store. Rimane il modeling — Aggregated Event Measurement (AEM) di Meta, i meccanismi di noise injection di Google Privacy Sandbox — ma queste stime non possono essere riconciliate tra piattaforme.

Conclusione: il vostro stack di attribution non è più deterministico, è probabilistico, e dovete accettarlo.

## SKAdNetwork 4: maturo ma non ancora uno standard universale

SKAdNetwork ha fatto il passaggio alla versione 4 nel 2023. I principali miglioramenti: i postback ora avvengono in tre fasi (0-2 giorni, 3-7 giorni, 8-35 giorni), è stato aggiunto il supporto per l'attribution web-to-app (gli utenti che vengono reindirizzati dall'app da web view supportate da SKAdNetwork possono ora essere tracciati), e con l'identificatore di source gerarchico potete identificare la fonte dell'annuncio su 4 livelli (campagna / ad group / creative). Lo schema di encryption del valore di conversione non è cambiato, ma Apple ha aggiunto una soglia di anonimato di massa nei postback — per traffico basso, il postback non viene inviato affatto.

A metà 2026, il tasso di adozione è intorno al 60%. Meta e Google supportano SKAdNetwork 4, ma reti come Unity Ads, ironSource e AppLovin sono ancora in transizione tra versioni. Questo significa che la stessa campagna viene misurata da diversi DSP con versioni diverse di SKAdNetwork, creando righe nei dashboard che non possono essere riconciliate.

Un problema aggiuntivo: i postback di SKAdNetwork accreditano solo l'ultimo annuncio cliccato (last-click attribution). Non ci sono view-through o assisted touchpoint. In un customer journey multicanale, la rete che fa il contatto finale ottiene tutto il valore di conversione, i contributi intermedi rimangono invisibili.

### Esempio di mapping del valore di conversione

```
Postback 0 (0-2 giorni):
- conversion_value = 1 → install
- conversion_value = 2 → primo open + onboarding completato

Postback 1 (3-7 giorni):
- conversion_value = 10-20 → codifica gli in-app purchase nei primi 7 giorni in fasce di 10 USD

Postback 2 (8-35 giorni):
- conversion_value = 30-40 → codifica la stima LTV fino a 35 giorni in fasce di 50 USD
```

A causa del limite di 6 bit, non potete inviare il revenue direttamente; decidete voi lo schema di encoding, e questo schema può variare tra campagne. Risultato: avete bisogno di un livello di mapping esterno per confronti coerenti.

## Modeled conversions: non una stima, ma il segnale principale

Aggregated Event Measurement (AEM) di Meta e i modelli Privacy Sandbox di Google sono ormai il fulcro dello stack di attribution mobile. Questi modelli stimano il comportamento degli utenti senza IDFA tramite machine learning: l'utente ha visto la campagna, ha scaricato l'app, ma il collegamento deterministico non può essere stabilito — il modello utilizza il machine learning basato su utenti con campagne, cohort e caratteristiche demografiche simili per stimare statisticamente il comportamento.

Secondo il rapporto Meta del 2025, il 70% delle conversioni install su iOS sono modeled. Su Google Ads, questa percentuale è del 60-65%. Quindi la maggior parte dei numeri ROAS che vedete nel dashboard sono stime. Quanto sono vicine queste stime alla realtà? Meta sostiene un'accuratezza dell'85-90% nei suoi test di validazione interna (confrontati con test di incrementality holdout). Ma questa accuratezza è a livello aggregato — se eseguite un test di incrementality a livello di campagna, potete vedere uno scostamento di ±30% tra il ROAS modeled e il lift reale.

Un secondo problema: le modeled conversions sono specifiche per piattaforma. Il modello di Meta non comunica con quello di Google. Se lo stesso utente viene modellato diversamente su entrambe le piattaforme, la deduplication cross-platform è impossibile. Senza MMM (Marketing Mix Modeling) o test geo-holdout, non potete sapere quale piattaforma ha contribuito quanto.

Un terzo problema: i ritmi di aggiornamento del modello. Se Meta aggiorna il modello settimanalmente e voi spegnete la campagna, l'apprendimento del modello si riflette con 7-14 giorni di ritardo. Questo complica i test del tipo "spegniamo la campagna e vediamo l'effetto" perché il modello ha un'inerzia.

## Il test di incrementality è ora il meccanismo decisionale, non la misurazione

In un mondo dove le modeled conversions rappresentano il 70%, non potete fidarvene per le decisioni. La soluzione: il test di incrementality — esperimenti controllati che misurano il vero aumento causato dalla campagna. I due metodi più comuni sono geo-holdout e audience holdout.

**Geo-holdout:** Spegnete la campagna in determinate aree geografiche e misurate la differenza in install o revenue. Ad esempio, spegnete la campagna Meta iOS in 10 stati, continuate negli altri 40, e dopo 14 giorni vedete quanto è calato l'install rate nelle aree con campagna disattivata. Questo calo è l'effetto causale reale della campagna. Il vantaggio del geo-holdout: non richiede dati a livello di utente ed è indipendente da ATT. Lo svantaggio: le differenze macroeconomiche tra i gruppi di controllo e treatment (festività locali, intensità della concorrenza) possono distorcere i risultati.

**Audience holdout:** Utilizzate campagne PSA (Public Service Announcement) o meccanismi di ghost bid per escludere casualmente un gruppo di utenti dalla visualizzazione degli annunci e lo confrontate con l'altro gruppo. Meta lo presenta come Conversion Lift Tests, Google come Brand Lift Tests. Se mantenete il gruppo holdout al 5-10%, avete bisogno di almeno 100.000 persone nel campione per la potenza statistica — il che significa che le campagne piccole non funzioneranno.

Entrambi i metodi richiedono 14-28 giorni, il che rallenta la velocità di iterazione. Ma post-iOS 17, non avete altra scelta se non fare affidamento sui test di incrementality piuttosto che sul ROAS modeled per la distribuzione del budget. Nel lavoro di [performance marketing](https://www.roibase.com.tr/it/ppc), ripetiamo i test di incrementality ogni trimestre, non solo al lancio della campagna, per monitorare la drift del modello.

## Privacy Sandbox e attribution web-to-app

Con iOS 17, le regole ITP (Intelligent Tracking Prevention) di Safari sono più rigide. Gli utenti reindirizzati dalla web view all'app store entrano ora nel flusso web-to-app di SKAdNetwork 4, ma qui la finestra di conversione è limitata a 24 ore. Se un utente ha visto una campagna su un sito web e ha scaricato l'app 48 ore dopo, questa attribution viene persa.

Google Privacy Sandbox con Topics API e FLEDGE (First Locally-Executed Decision over Groups Experiment) offre alternative sul web a iOS Safari, ma non è ancora uno standard per l'attribution in-app mobile. Nel 2026, si vocifera che Apple pubblicherà un API simile a Topics, ma non c'è comunicazione ufficiale.

Un dettaglio importante: le catene di attribution web-to-app, anche se senza cookie, non possono essere creditate correttamente dai postback di SKAdNetwork perché non potete trasportare l'ID del click web attraverso il reindirizzamento all'app store. Apple sta testando un meccanismo di "web attribution token" in StoreKit 2, ma non è in produzione.

## Lookback period: 35 giorni sono sufficienti?

La finestra di postback più lunga di SKAdNetwork è 35 giorni. Ma per giochi, fintech e app di abbonamento, il valore LTV reale emerge a 90-180 giorni. Al giorno 35, state codificando una stima LTV basata sulla cohort nel valore di conversione, ma questa stima non cattura il churn precoce o la monetizzazione tardiva.

Soluzione: i livelli di post-attribution modeling degli MMP (Mobile Measurement Partner — Adjust, AppsFlyer, Singular). Questi strumenti prendono i postback di SKAdNetwork e, utilizzando il loro pool di dati deterministici (utenti opt-in), producono una stima LTV di 90 giorni su un modello di cui sono stati esempi di training. Ma anche questa stima è un modello — se il dato di training di MMP non riflette completamente il comportamento della vostra app, la stima diverge.

Alternativa: fare analisi di cohort manualmente. Prendete i dati di SKAdNetwork dei primi 35 giorni, tracciate manualmente la stessa cohort fino a 90 giorni sui vostri dashboard BI, e poi aggiornate retroattivamente il ROAS della campagna. È un processo manuale, ma post-iOS 17 è il metodo più vicino alla "ground truth".

## Cosa fare ora

Lo stack di attribution post-iOS 17 è frammentato, ritardato e incentrato sulle stime. Se non vi fidate dei ROAS nel dashboard, state reagendo correttamente. Seguite questi passaggi: esaminate il mapping del valore di conversione di SKAdNetwork 4, assicuratevi di codificare correttamente gli eventi dei primi 7-14 giorni. Estraete le quote di modeled conversions dai dashboard MMP — se superano il 70%, un test di incrementality trimestrale è obbligatorio. Quando scegliete tra geo-holdout e audience holdout, decidete in base alla dimensione del traffico — con meno di 1.000 install giornalieri, l'audience holdout non raggiungerà la significatività statistica. Se avete un flusso web-to-app, considerate la finestra di attribution di 24 ore e testate il passaggio delle campagne di retargeting a canali con finestre più lunghe. Infine: non ignorate l'attribution, ma non fatela essere l'unico input nel vostro processo decisionale — costruite un triangolo con MMM, analisi LTV per cohort e test di incrementality. Il gioco post-iOS 17 non si vince con i segnali deterministici, ma accoppiando stime corrette con decisioni corrette.