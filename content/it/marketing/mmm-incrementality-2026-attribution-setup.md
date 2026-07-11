---
title: "MMM + Incrementality: L'attribution setup di 2026"
description: "Robyn, Meta Lift e geo experiments: quale strumento quando nel measurement post-cookie, test setup e decision tree."
publishedAt: 2026-07-11
modifiedAt: 2026-07-11
category: marketing
i18nKey: marketing-004-2026-07
tags: [mmm, incrementality, attribution, robyn, meta-lift]
readingTime: 9
author: Roibase
---

La misurazione del marketing post-cookie ha ridefinito il significato di "attribution". Nel 2026, non si tratta più di tracciare quale utente ha visto quale annuncio, ma di isolare quale canale genera effettivamente un incremento di vendite misurabile. Marketing Mix Modeling (MMM) e incrementality test sono i pilastri di questo nuovo approccio — eppure entrambi rispondono alla stessa domanda in orizzonti temporali diversi e con livelli di confidenza differenti. La scelta tra Robyn di Meta, Conversion Lift test e geo-based experiments dipende dal timing della campagna, dalla flessibilità di budget e dalla data maturity dell'organizzazione.

## MMM: Leggere il Passato per Prevedere il Futuro

Marketing Mix Modeling appartiene alla famiglia delle regressioni. Integra 2-3 anni di dati su spesa, impression, fattori macroeconomici e vendite per isolare il contributo di ogni canale alle vendite totali. Framework open source come Robyn aggiungono Bayesian optimization, calibrando automaticamente gli iperparametri del modello (adstock, curve di saturazione).

L'output di Robyn è una serie di "response curve": per ogni canale, mostra il ROAS marginale dell'incremento di spesa. Ad esempio, investire 100.000 TL ulteriori su Meta potrebbe generare 3,2x ROAS, mentre lo stesso importo su Google Search potrebbe rendere 4,1x — questo tipo di decisioni richiede la base dati cumulativa di MMM. Nel 2026, Robyn v4.1 automatizza la decomposizione della stagionalità basata su Prophet e analizza gli effetti delle festività; i dummy event manuali sono ormai deprecati.

Il limite di MMM è la latenza: la costruzione del modello richiede 4-6 settimane perché necessita di almeno 100-120 settimane di dati (2+ anni). Se avete lanciato un nuovo canale (ad esempio TikTok), i dati delle prime 12 settimane sono incredibilmente rumorosi; MMM non può assegnare coefficienti affidabili. In questo scenario entra in gioco il test di incrementalità a breve termine.

## Meta Conversion Lift: Rapido, Circoscritto, Costoso

Meta Conversion Lift (precedentemente Lift Studies) funziona secondo un design randomized controlled trial: gli utenti sono divisi in gruppi di test (esposti agli annunci) e control (esposti a PSA), calcolando la differenza di conversione. Ottenete risultati in 2-4 settimane — ben più veloce di MMM per decisioni real-time.

Il prerequisito del Lift test è un reach minimo di 200.000 utenti e la disponibilità di allocare il 5-10% del budget di campagna normale al gruppo control come "spesa di test". In pratica, significa 50.000-100.000 TL di impression waste, poiché il gruppo control vede PSA ma le loro conversioni non vengono conteggiate. Meta non rimborsa questo costo — lo dovete considerare come parte della spesa di test.

Nel 2026, Meta ha integrato Conversion Lift con gli event lato server: gli event `Purchase` inviati via CAPI possono essere utilizzati direttamente nel calcolo del lift. Anche per gli utenti iOS 17+, i risultati sono affidabili perché l'assegnazione test/control è legata agli ID lato server. L'unico vincolo: Lift misura esclusivamente Meta — non cattura l'halo effect cross-channel. Se la campagna Instagram aumenta il traffico organico su Google Search, Lift non lo vede.

## Geo Experiments: Catturare l'Halo Cross-Channel

I test di incrementalità geo-based confrontano città/regioni in treatment vs. control. Ad esempio, aumentate la spesa Meta del 30% a Istanbul e Ankara, mantenendo stabile Izmir e Bursa. Dopo 4-6 settimane, osservate il delta nelle vendite totali — questo metodo cattura anche lo spillover tra canali.

Lo strumento GeoX di Google automatizza il processo: utilizza synthetic control method per costruire una curva di vendite "controffattuale" per ogni geo di test. In pratica, stima le vendite di Istanbul combinando il trend di 5-6 città con caratteristiche demografiche e stagionali simili, calcolando il peso. La differenza tra le vendite reali post-treatment e questa stima è l'incrementalità.

Il vantaggio del geo test: copre tutti i canali online e offline. Lo svantaggio: il rischio di spillover geografico (un annuncio a Istanbul potrebbe influenzare Kocaeli) e le disparità di dimensione di mercato. Funziona efficacemente per brand con 10-12+ cluster geografici; operazioni più piccole non hanno power sufficiente.

Nel 2026, GeoX è nativamente integrato con Google Cloud BigQuery — potete estrarre dati da GA4 + dati di prodotto da BigQuery e inviarli direttamente alla pipeline di test. Setup richiede 2 settimane, durata del test 4-6 settimane, cycle time totale 6-8 settimane.

## Quale Strumento Quando

Applicate il seguente decision tree:

| Situazione | Strumento | Perché |
|---|---|---|
| Avete 2+ anni di dati, allocherete il budget strategicamente | Robyn (MMM) | Curve di risposta a lungo termine + identificazione della saturazione |
| Testate un nuovo formato creativo (ad es. Reels vs. Feed) | Meta Conversion Lift | Rapido, specifico del formato, risultati in 2-4 settimane |
| Sospettate effetto halo cross-channel (ad es. YouTube + Search sinergia) | Geo experiment | Cattura lo spillover tra canali |
| Partite da zero | Prima Lift, poi MMM | Primi 6 mesi optimize tatticamente con Lift, poi strategico con MMM |

Per Robyn, il setup minimo: ambiente Python/R, 120+ settimane di dati su spesa + vendite, un nodo in cui Prophet funziona (2-4 core sufficienti). L'output si aggiorna settimanalmente ma il rebuild del modello dovrebbe avvenire una volta al mese.

Per Meta Lift: campagna attiva in Business Manager, reach settimanale 200k+, event di conversione inviato via CAPI. L'approvazione del Lift richiede 3-5 giorni lavorativi, deve superare la revisione interna di Meta.

Per GeoX: minimo 10+ cluster geografici, integrazione BigQuery, GA4 + dati transazionali. Google ha reso pubblico questo tool in closed beta Q4 2025, è in produzione completa nel 2026.

## Pitfall Pratici di Robyn

Quando impostate Robyn, il primo ostacolo è il tuning degli iperparametri. Il framework prova di default 100.000 combinazioni di modelli — su una macchina a 8 core, questo richiede 6-8 ore. In produzione, se lo eseguite una volta a settimana, il costo di compute è tollerabile, ma se volete un refresh quotidiano serve un cluster Spark distribuito.

Il secondo pitfall: la finestra dell'adstock effect. Robyn usa di default una finestra di 13 settimane — l'impatto della spesa di una settimana decade sulle vendite per 13 settimane. Ma per brand di fast fashion con ciclo di vita del prodotto di 4-6 settimane, una finestra di 13 settimane non ha senso. Dovete sovrascrivere manualmente questo parametro per categoria, altrimenti il modello sovrastima i canali long-tail come la TV.

Il terzo pitfall: stagionalità. Prophet automatizza la decomposizione di Fourier ma in Turchia ci sono festività mobili come Ramadan, Eid al-Adha e Black Friday. Dovete aggiungerle manualmente al dataframe `holidays`. Nel 2026, Robyn v4.1 supporta l'import in formato iCal — potete estrarre direttamente da Google Calendar.

## Quale Confidenza per Quale Decisione

L'output di MMM è probabilistico — ogni canale ha un coefficiente medio e un intervallo di confidenza del 95%. Se il ROAS di Meta è 3,2 ± 0,7, il valore reale si trova tra 2,5 e 3,9 con probabilità 95%. Se questo range è ampio (es. ±1,2), il coefficiente del canale è instabile e dovete raccogliere più dati.

La confidenza del Lift test è fissa: Meta usa una soglia di confidenza del 90%. Se il risultato del test è "non statisticamente significativo", significa che il sample size è troppo piccolo o non c'è effettivamente lift. In pratica, con 200k reach potete rilevare un lift del 10%, ma per lift inferiore al 5% servono 500k+ di reach.

La confidenza dell'esperimento geo dipende dalla qualità dell'adattamento del controllo sintetico: se il MAPE (mean absolute percentage error) tra le vendite reali e il controllo sintetico nel periodo pre-treatment è sotto il 5%, è affidabile; sopra il 10%, dovete ricalibrare i cluster geografici.

## Nota Finale: Incorporare il Decision Tree nel Workflow

Nel 2026, i team di [performance marketing](https://www.roibase.com.tr/it/ppc) di successo utilizzano MMM + incrementality nella stessa pipeline decisionale: Robyn gira la prima settimana di ogni mese, aggiornando l'allocation di budget trimestrale. I Lift test girano durante i launch di nuovi creative/format, generando decisioni di pivot tattico in 2-4 settimane. Gli esperimenti geo vengono eseguiti 2-3 volte all'anno, per validare prima di major shift di channel mix (ad esempio, prima di aumentare il budget TikTok del 50%).

Per implementare questo setup, la vostra data pipeline deve eseguire tre flow separati: (1) i dati su transazioni e spesa giornalieri fluiscono in BigQuery, (2) Robyn consuma questi dati per il refresh settimanale, (3) i risultati di Lift e GeoX vengono importati manualmente nel dashboard BI. Tutto converge in un'unica dashboard Looker presentata al CMO — "il mese scorso Meta aveva ROAS 3,4 (MMM), il nuovo formato Reels ha generato 12% lift (Lift), il geo test di TikTok ha fallito (GeoX)".