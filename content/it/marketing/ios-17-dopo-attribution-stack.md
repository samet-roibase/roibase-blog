---
title: "Lo Stack di Attribution di iOS 17 e Oltre"
description: "ATT, SKAdNetwork 4 e modeled conversions hanno ricostruito completamente la misurazione degli annunci su iOS. Ecco lo stack che funziona nel 2026."
publishedAt: 2026-05-11
modifiedAt: 2026-05-11
category: marketing
i18nKey: marketing-003-2026-05
tags: [ios-attribution, skadnetwork, att, modeled-conversions, mobile-measurement]
readingTime: 8
author: Roibase
---

La fragilità dell'attribution che ha iniziato con iOS 14 ha raggiunto la maturità nel 2026. I tassi di opt-in ATT (App Tracking Transparency) si sono stabilizzati sotto il 25%, SKAdNetwork 4 ha portato il conversion value a 128 bit, Meta e Google hanno reso le modeled conversions il default. Il gioco non è più lo stesso: l'attribution deterministica è morta, è iniziata l'era del probabilistico + della post-lookback maturity. Chiunque investa in iOS senza costruire correttamente il nuovo stack vedrà il budget svanire nel nulla.

## La Realtà Dopo ATT: Convivere con il 25% di Opt-In

Su iOS 17, il tasso globale di opt-in ATT si è stabilizzato tra il 23-27% (dato Singular, Q1 2026). Questo significa che il 75% degli utenti non condivide l'IDFA. Le campagne ancora dipendenti dall'attribution basata su IDFA vedono solo un segmento di minoranza, il resto viene contrassegnato come "modeled".

Che cosa sono le modeled conversions? Meta e Google usano il machine learning per regressione del comportamento degli utenti che hanno rifiutato ATT e assegnano una probabilità di conversione. Questo metodo è aggregato — non a livello di persona, ma di coorte. Il calcolo del ROAS arriva ora per il 70-80% da dati modeled. Se stai ancora ottimizzando le campagne basandoti sul "ROAS deterministico", stai ignorando la maggior parte dei dati.

La nuova realtà è semplice: su iOS non esiste una precisione del 100%. Accettalo e costruisci lo stack di conseguenza. Il segnale deterministico è troppo piccolo per decidere — comprendere come vengono generati i dati modeled, verificarne l'affidabilità e convalidarli con test di incrementalità è diventato obbligatorio.

## SKAdNetwork 4: Conversion Value a 128 Bit e Source ID Gerarchico

SKAdNetwork 4 (default su iOS 16.1+, maturo su iOS 17) è l'unico metodo di attribution "ufficiale" offerto da Apple. Il meccanismo di base: l'utente clicca su un annuncio, l'app viene installata e aperta per la prima volta, il valore di conversione viene registrato, la finestra di postback si chiude in 24-72 ore e Apple invia il segnale aggregato. Niente IDFA, niente identificatori di dispositivo.

Qual è la novità? Il conversion value è ora a 128 bit — puoi codificare più dettagli. Esempio di strategia di encoding: i primi 6 bit per la fonte di install (Meta, Google, TikTok, organic), i 7 successivi per il tipo di evento (first purchase, tutorial complete, level 3), gli ultimi 115 bit per il bucketing del fatturato + segmento di coorte. Questo encoding lo progetti tu, ogni app lo personalizza in base alle sue necessità.

È arrivato anche l'Source ID gerarchico: invece di un singolo campaign ID, puoi usare una gerarchia a 4 livelli (campaign → ad set → creative → keyword). È critico per la modellazione multi-touch — lo SKAdNetwork precedente offriva solo dati a livello di campagna, ora puoi disaggregare la performance a livello di creative. Ma con più dettagli arriva più rumore: a causa della privacy threshold di Apple, non invia postback per segmenti a basso volume. Trade-off strategico: essere molto granulare o ricevere più postback?

### Progettazione del Conversion Value

| Intervallo di Bit | Utilizzo | Esempio di Encoding |
|---|---|---|
| 0-5 (6 bit) | Fonte di install | 0=organic, 1=Meta, 2=Google, 3=TikTok |
| 6-12 (7 bit) | Tipo di evento | 0=install, 1=registration, 2=first_purchase, 3=D7_retention |
| 13-127 (115 bit) | Bucket di fatturato + segmento | Predizione LTV + geo + tier di dispositivo |

Gli MMP (Adjust, AppsFlyer) incorporano questo encoding nell'SDK. Ma devi definire tu la logica di encoding — l'encoding di default degli MMP è troppo superficiale.

## Modeled Conversions: Come Amplificarle con Meta CAPI e Google Enhanced

La qualità delle modeled conversions è direttamente proporzionale alla quantità di segnali first-party inviati alla piattaforma. Qui entrano in gioco Meta CAPI (Conversions API) e Google Enhanced Conversions. Su iOS, anche senza IDFA, i parametri inviati lato server come email hash, phone hash e user_data amplificano l'accuratezza della modellazione della piattaforma.

Con Meta CAPI è stato riportato un miglioramento del ROAS del 15-20% su iOS (dati Meta Business Partner, fine 2025 Q4). Perché? Perché le conversioni che non raggiungono il pixel vengono completate lato server e Meta usa questi segnali per abbinare gli utenti a coorti e eseguire la modellazione. La chiave: l'event_id inviato a CAPI deve corrispondere a quello del pixel (deduplicazione), i parametri user_data devono essere normalizzati con hash SHA-256, l'event_time deve allinearsi con il timestamp lato server.

Google Enhanced Conversions funziona in modo simile — ma il meccanismo è diverso. Se le enhanced conversions sono abilitate in Google Ads, i dati utente possono essere aggiunti alle conversioni inviate dal server GTM. Google cross-referenzia questi dati con il suo grafo di utenti loggati e esegue la modellazione. Attenzione: le enhanced conversions non funzionano solo sul web, ma anche nelle app — tuttavia la configurazione lato server in un'app è più complessa. È necessaria un'architettura di dati first-party via Firebase SDK + Cloud Functions.

## Post-Lookback Maturity: Una Finestra di Attribution di 7 Giorni Non è Più Sufficiente

Nello stack iOS, la finestra di lookback è generalmente di 1-7 giorni. In SKAdNetwork è 24-72 ore, in Meta per iOS è 7 giorni, in Google Ads è configurabile ma di default 7 giorni. Il problema è questo: il comportamento dell'utente non finisce in 7 giorni — specialmente per categorie con ciclo di consideration alto come subscription ed e-commerce, il primo acquisto può avvenire 14-30 giorni dopo.

Che cosa significa post-lookback maturity? Contabilizzare retroattivamente le conversioni che si verificano dopo la breve finestra. Esempio: un utente clicca su un annuncio il giorno 3, effettua un acquisto il giorno 12 — questa conversione non viene catturata dalla finestra di 7 giorni di Meta, ma è reale. Se stai facendo analisi LTV a livello di coorte, devi attribuire manualmente questa conversione alla campagna.

Metodo: monitora la coorte di install, misura l'incremento di fatturato da D7 → D14 → D30, ridistribuisci il delta alle campagne. È un processo manuale, ma può essere automatizzato con BI + data warehouse. In BigQuery puoi usare la finestra di funzione `FIRST_VALUE()` per abbinare l'install_date alle campagne, quindi distribuire l'incremento di LTV alle campagne tramite attribution pesata. Nell'infrastruttura di [performance marketing](https://www.roibase.com.tr/it/ppc) di Roibase, questa pipeline è standard.

## Test di Incrementalità: Possiamo Fidarci dei Dati Modeled?

Quanto sono accurati i dati modeled? Non puoi saperlo senza testare. I test di incrementalità — cioè esperimenti holdout/geo-based — sono diventati obbligatori nelle campagne iOS. Meta Conversion Lift, Google Campaign Experiments e TikTok Split Testing servono tutti a questo scopo: misuri la differenza di conversione tra i gruppi in cui la campagna è accesa e spenta, vedi il vero lift.

Esempio: metti il 10% degli utenti in un gruppo holdout (non vedono la campagna), il 90% nel group treatment (vedono la campagna). Dopo 30 giorni, il conversion rate del treatment è il 5%, quello dell'holdout è il 3.5% — quindi il lift reale è dell'1.5% (assoluto). Se la piattaforma mostra un ROAS di 3.0 ma il test di incrementalità dice 1.2, i dati modeled sono sopravvalutati. Devi applicare questo gap come fattore di aggiustamento al ROAS della campagna.

I test geo-based sono più robusti ma più lenti. Dividi paesi/stati in base alla densità degli utenti iOS, in uno la campagna è accesa, nell'altro spenta. Dopo 4-8 settimane, guardi la differenza di conversione. Lo strumento Conversion Lift di Meta lo automatizza, in Google Ads devi configurarlo manualmente (campaign draft + experiment).

## L'Architettura dello Stack iOS nel 2026

Lo stack di attribution iOS moderno si presenta così:

1. **Integrazione SKAdNetwork 4** — codifica del conversion value tramite MMP + source ID gerarchico
2. **Meta CAPI + Google Enhanced** — invio di eventi lato server, arricchimento user_data
3. **Lettura delle modeled conversions** — attenzione al flag "modeled" nei dashboard delle piattaforme, calcolo del ROAS aggregato
4. **Tracciamento LTV basato su coorte** — abbinamento install cohort → revenue in BigQuery/Snowflake, attribution post-lookback
5. **Test di incrementalità** — almeno 1 esperimento holdout a trimestre, calcolo del fattore di lift
6. **Velocità di test creativo** — granularità a livello di creative di SKAdNetwork 4 per iterazione veloce

Costruire questo stack richiede 6-8 settimane: onboarding MMP, configurazione lato server di CAPI/Enhanced, pipeline del data warehouse, dashboard BI. Ma una volta configurato, il ROAS iOS diventa il 20-30% più affidabile — perché stai leggendo correttamente i dati modeled, li convalidi con incrementalità e vedi l'LTV completo post-lookback.

Dopo iOS 17, l'attribution non è buia — è solo diversa. Il segnale deterministico si è ridotto, ma i metodi probabilistici e aggregati si sono maturati. Quando costruisci lo stack correttamente, puoi ancora eseguire campagne misurabili e ottimizzabili. La chiave è: accettare i dati modeled, investire in incrementalità e disciplinare l'analisi basata su coorte. Nel 2026, chiunque voglia crescere su iOS deve padroneggiare questi tre elementi.