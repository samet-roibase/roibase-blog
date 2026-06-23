---
title: "MMM + Incrementality: L'attribution setup di 2026"
description: "Robyn, Meta Lift e geo experiments — quale metodo funziona quando? Guida tecnica per ricostruire l'attribution nell'era post-cookie."
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: marketing
i18nKey: marketing-004-2026-06
tags: [mmm, incrementality, attribution, robyn, meta-lift]
readingTime: 9
author: Roibase
---

L'attribution su ultimo click è morta nel 2023, l'attribution multi-touch nel 2024. Nel 2026 la misurazione del marketing si è divisa in due poli: Marketing Mix Modeling (MMM) a livello macro, test di incrementality a livello micro. Server-side conversion API costruiscono il ponte tra i due. Questo articolo spiega quale metodo funziona in quale contesto, quale output alimenta quale decisione — non filosofia astratta di attribution, ma uno stack tangibile e costruibile in pratica.

## Marketing Mix Modeling funziona ora su base settimanale

Nel 2015 MMM significava "una presentazione all'anno per il CEO". Nel 2026 strumenti aperti come Robyn di Meta eseguono modelli Bayesiani ogni settimana, aggiornando il contribution dei canali in tempo reale. La struttura è questa: prendi i dati storici di spesa, impression, conversion e fattori esterni (stagionalità, festività, indice competitivo), modellali con regressione time-series, estrai il ROAS marginale di ogni canale. Domanda: se aggiungo 100.000 TL a un canale, quanti acquisti extra ottengo? MMM risponde a questa domanda.

La setup non è semplice ma i requisiti tecnici sono trasparenti: almeno 52 settimane di dati giornalieri (idealmente 104 settimane), righe di spesa allocabili per canale, numero di conversioni (preferibilmente con revenue). Robyn funziona in Python e R, legge da BigQuery o Snowflake, calcola la distribuzione posterior con Prophet o Stan. L'output è un grafico di channel contribution, curve di saturazione e response curve — quale canale risente del budget-cutting, quale è già in diminishing returns.

Nel 2026 Robyn aggiunge granularità geo-level: se dividi l'Italia in 7 regioni, calcola il threshold di saturazione per ogni regione. Milano potrebbe essere al 35% di saturazione Meta mentre il Sud è al 10% — vedere questa differenza cambia la decisione di riallocazione del budget. Ma attenzione: MMM non dimostra causalità, mostra correlazione. "La spesa su Google Ads è aumentata e le vendite sono aumentate" non è la stessa cosa di "Google Ads ha causato le vendite". Questo gap è colmato da incrementality.

## Meta Lift ha risolto incrementality dentro la piattaforma

Il test Conversion Lift di Meta è un vero trial controllato randomizzato (RCT). Divide il tuo pubblico in due: mostra il video al gruppo test, non lo mostra al gruppo di controllo. La differenza di conversion tra i due è il **contribution netto** di quella campagna. Nel 2026 questo sistema è sceso da campaign level a creative level — tre video diversi nella stessa campagna vengono misurati separatamente per incrementality.

La setup tecnica funziona così: in Ads Manager al posto di "Create A/B Test" scegli "Create Lift Test", con minimo 200.000 reach e durata di 2 settimane (Meta lo enforce). Il gruppo di controllo dovrebbe stare tra il 10-20% — meno e la potenza statistica scende, più e la perdita di revenue cresce. Quando il test finisce, Meta ti fornisce: "Gruppo test 1000 conversion, gruppo controllo 700 conversion → 30% incremental lift, confidence interval 18%-42%".

Questo numero si lega direttamente al budget. Se la campagna ha speso 100.000 TL e mostra 30% lift, 30.000 TL di quella spesa hanno generato vendite aggiuntive davvero — i restanti 70.000 TL sarebbero comunque arrivati organicamente o tramite altri canali. Da qui calcoli il costo marginale per conversione incrementale: 100.000 / 300 = 333 TL. Confronta questo numero con l'output di MMM: "Gli ultimi 1000 TL spesi su Meta hanno generato 2,8 acquisti" — i due numeri dovrebbero validarsi, una differenza del 15-20% è normale (gap metodologico), oltre il 50% significa un problema nei dati.

Il limite di Meta Lift: funziona solo nell'ecosistema Meta, non misura gli effetti cross-canale. Se Google Ads + Meta lavorano insieme, c'è un lift sinergico? Lo misura geo experiment.

## Geo experiments guardano sinergia cross-canale

Il framework di Geo Experiments di Google funziona così: dividi l'Italia in 10 regioni, aumenta la spesa del 20% in 5 di esse (o tagliala completamente), lascia le altre invariate. Dopo 4 settimane guarda la differenza di vendite tra i due gruppi — se c'è differenza e statisticamente significativa (p<0.05), il cambio di spesa ne è la causa. Questo è diverso da Meta Lift: non distingue il canale, guarda l'effetto totale regione per regione.

In pratica: in Campaign Manager 360 o Google Ads scegli "Experiments" > "Geo experiment" (nel 2026 può essere lanciato anche da GA4). Per definire le regioni usi codici postali, province o aree DMA (in Italia le regioni NUTS2). Serve minimo 6 settimane di dati baseline, il test dura almeno 3 settimane (idealmente 6 — per attenuare il rumore stagionale). Il motore Bayesian di Google aggiorna il posterior ogni giorno, al termine del test fornisce: "Un aumento di spesa del 20% ha aumentato le vendite dell'8,5% (CI: 4,2% - 12,8%)".

Questo metodo è particolarmente potente per testare strategie cross-canale. Ad esempio: "Google + Meta insieme generano 15% di vendite in più rispetto a usarli separatamente?" — Nel gruppo A accendi entrambi i canali al massimo, nel gruppo B riduci Google del 50%. Se la differenza di vendite è meno del 10%, la sinergia non esiste e riallocare il budget. Il limite di geo experiment: setup è costoso (6 settimane baseline + 6 settimane test = 3 mesi), i risultati sono significativi solo quando testare cambiamenti di budget sufficientemente grandi. Se provi a misurare un tweak del 5% ti perderai nel noise.

## Quale metodo quando — decision tree

Puoi restringere la decisione con 3 domande:

1. **Qual è lo scope della decisione?** Budget annuale per canale → MMM. Confronto creative campaign-specifico → Meta Lift. Test sinergia cross-canale → Geo experiment.

2. **È pronta la base dati?** MMM richiede 52+ settimane di spesa pulita + conversion. Lift richiede 200K+ reach e 2 settimane. Geo richiede 6 settimane baseline + segmentazione geografica.

3. **Che velocità di decisione serve?** Ottimizzazione settimanale → Meta Lift sempre attivo. Strategia trimestrale → MMM refresh mensile. 1-2 grandi pivot all'anno → Geo experiment.

La tabella:

| Metodo | Output | Durata | Dati minimi | Uso ideale |
|---|---|---|---|---|
| MMM (Robyn) | Channel contribution, saturazione | 52+ settimane | Spesa + conversion (giornaliero) | Strategia allocation budget |
| Meta Lift | Conversioni incrementali per campagna/creative | 2-4 settimane | 200K reach | Creative testing, campagna pruning |
| Geo Experiment | Sinergia cross-canale, lift regionale | 6-12 settimane | 6 settimane baseline + dati geografici | Test sinergia canali, expansion regionale |

Questi tre metodi non sono alternativi, sono complementari. MMM dice "quale canale vale quanto", Lift dice "questa campagna ha davvero aggiunto valore", Geo dice "due canali insieme funzionano meglio". Un team che usa tutti e tre ancora la strategia di [Performance Marketing](https://www.roibase.com.tr/it/ppc) all'evidenza sperimentale, non alla previsione.

## Costruire lo stack in pratica

Per tradurre il framework teorico in pratica, hai bisogno di questi layer:

**Raccolta dati:** Manda i segnali di conversion tramite server-side GTM parallelo a Google Ads, Meta CAPI e BigQuery. Se ti affidi solo a cookie client-side perdi 30-40% dei segnali (iOS 17, Firefox, Brave). L'infrastruttura [Dijital Pazarlama](https://www.roibase.com.tr/it/dijitalpazarlama) di Roibase combina sGTM + data layer first-party — da lì viene la granularità di spesa che MMM richiede.

**Pipeline del modello:** Alimenta Robyn da BigQuery. Con dbt modella spesa + conversion al grain giornaliero. Uno script Python gira settimanale (Cloud Function o Airflow), l'output va in Looker Studio. Lancia i test Lift manualmente da Ads Manager ma estrai i risultati via API (l'endpoint `insights` della Marketing API restituisce la metrica lift), scrivi in BigQuery e join con l'output di MMM.

**Geo experiment:** L'API di Google Ads consente setup programmatico tramite la risorsa `experiments`. Quando il test finisce estrai i risultati con `experiment_id`, scrivi in BigQuery e confronta con i risultati di MMM. Visualizzare tutto in un dashboard unico è molto prezioso: "Secondo MMM il contribution Meta è 22%, secondo Lift test è 28% incrementale, secondo il test geo la variance regionale è 12-34%" — questi 3 numeri insieme chiariscono la decisione strategica.

**Ciclo decisionale:** Refresh MMM ogni trimestre, esegui 1-2 test Lift al mese, 1 geo experiment ogni 6 mesi. Per team piccoli questo ritmo può essere troppo — in quel caso inizia con MMM (2 settimane di setup se hai i dati), poi automatizza Meta Lift (aggiungilo di default a ogni campagna), usa Geo solo prima di grandi pivot.

Nel 2026 l'attribution non è uno strumento singolo, è l'orchestrazione di tre. Ognuno risponde a una domanda diversa, insieme fondano la decisione nella realtà post-cookie. Non previsione ma test, non correlazione ma causalità, non dashboard ma risultati di experiment — la crescita si costruisce su questo fondamento.