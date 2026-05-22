---
title: "ASO Creative Testing: +%32 IPM in 6 Settimane con PPE"
description: "Testa i tuoi visual iOS/Android con Custom Product Pages e Play Experiments. Significatività statistica, calcolo del lift e metodologia di iterazione creativa."
publishedAt: 2026-05-22
modifiedAt: 2026-05-22
category: gaming
i18nKey: gaming-001-2026-05
tags: [aso, creative-testing, custom-product-pages, play-experiments, mobile-growth]
readingTime: 9
author: Roibase
---

L'area più trascurata della crescita dei giochi mobile sono i visual dello store. La maggior parte dei developer carica icon e screenshot una sola volta e se ne dimentica. Tuttavia, con Apple Custom Product Pages (CPP) e Google Play Experiments (PPE), ogni settimana senza test A/B significa lasciare potenziale install per impression (IPM) sul tavolo. Dal 2025, i giochi nei mercati tier-1 che utilizzano CPP vedono un lift IPM medio di +%22. Ma se il metodo di test è sbagliato, il numero è privo di significato. Questo articolo riguarda la metodologia.

## Cosa Sono le Custom Product Pages e Perché Adesso

Apple ha lanciato le CPP nel 2021, Google Play nel 2022 con controllo sperimentale completo. Prima era l'era del "singolo set visuale + piccoli test". Oggi puoi presentare un set creativo diverso a ogni segmento di campagna: se usi stile anime nella creativa UA, usala anche nello store; se il focus è sulla meccanica di combattimento, fai lo stesso negli screenshot.

La differenza è semplice: **coerenza di messaggio**. Un utente vede un personaggio hero su TikTok e clicca, ma vede uno screenshot di farming nell'App Store — la conversione crolla. Le CPP chiudono questo gap. Ma il vero potere sta nel ciclo di test: metti 3 diverse direzioni visive in produzione, e dopo 2 settimane prendi una decisione data-driven.

Dettaglio tecnico: le CPP sono indipendenti dalla tua pagina prodotto predefinita, puoi creare fino a 35 versioni (limite Apple). Su Google, la quota di esperimenti è dinamica, ma 10-12 test attivi sono sufficienti nella pratica. Ciascuno si collega a un ID campagna diverso — misuri tramite SKAdNetwork (SKAN) o Firebase attribution.

## Play Experiments e l'Equivalente iOS: Architettura dei Test

Google Play Experiments ti permette di testare il conversion funnel a livello di store: puoi mostrare al 50% controllo e 50% variant quando un utente arriva al negozio. Su Apple questa funzione non esiste, quindi usi CPP con routing a livello di campagna. In altre parole, lo split di test avviene a livello di mediazione, non di store.

Struttura di test tipica:

**Google (split a livello di store):**
- Baseline (set di visual attuali)
- Variant A (nuovo ordine screenshot)
- Variant B (personaggio hero diverso)

Il traffico si distribuisce automaticamente, Play Console fornisce il rapporto di significatività statistica in 14 giorni.

**Apple (split a livello di campagna):**
- Campaign 1 → Pagina prodotto predefinita
- Campaign 2 → CPP Variant A
- Campaign 3 → CPP Variant B

Lo split è manuale su Apple Search Ads o paid social. Per ogni campagna estrai i dati install + IPM dai postback SKAN. Calcoli la significatività tu stesso (Apple non ha un'interfaccia per i test).

La maggior parte dei developer commette un errore qui: decide prima di aver raccolto dati sufficienti. Vede 500 install e dichiara "la variant ha vinto". In realtà, il power statistico non è nemmeno del 60%. Minimo: 2000 impression per variant + intervallo di confidenza del 95%.

## Significatività Statistica e Calcolo del Lift

Play Console fornisce il rapporto sulla significatività, ma la matematica dietro è semplice: **test z per proporzioni**. Misura se la differenza di conversion rate tra due gruppi è frutto del caso.

Formula:

```
z = (p1 - p2) / sqrt(p * (1-p) * (1/n1 + 1/n2))
p = (x1 + x2) / (n1 + n2)
```

- `p1`, `p2`: conversion rate variant e controllo
- `n1`, `n2`: numero di impression
- `x1`, `x2`: numero di install

Se z-score > 1.96, hai una differenza significativa al 95% di confidenza.

**Esempio:**
- Controllo: 10.000 impression, 800 install → %8.0 CVR
- Variant: 10.000 impression, 1120 install → %11.2 CVR
- Lift: +40% (relativo), +3.2pp (assoluto)
- Z-score: 8.4 → p < 0.001 (definitivamente significativo)

Ma attenzione: se il sample è piccolo, il lift alto non basta. Con 500 impression, potresti vedere +15% di lift ma l'intervallo di confidenza al 95% potrebbe andare da -5% a +35%.

**Calcolo del sample minimo** (power analysis):
Baseline CVR %8, MDE (minimum detectable effect) %20 di lift (cioè %9.6 CVR) e power dell'80%, hai bisogno di circa 4500 impression per gruppo. Non decidere con meno.

### Bayesian vs Frequentist

Play Console usa l'approccio frequentist. L'alternativa Bayesian: aggiornamento continuo della posterior, output del tipo "la variant è migliore con probabilità dell'87%". Con sample piccolo, Bayesian può aiutarti a decidere prima, ma in produzione frequentist è generalmente più sicuro. Perché il controllo del type-I error viene prima della minimizzazione del rimpianto.

## Metodologia di Iterazione Creativa: Dal Primo Test allo Scale

La maggior parte dei developer usa le CPP così: il team marketing prepara 3 visual, li mette in produzione, guarda dopo 1 settimana, dice "il centrale è migliore" e passa oltre. Sbagliato.

Il ciclo corretto di iterazione:

1. **Formazione dell'ipotesi (Settimana 0):**
   - Prendi il top-performer della tua creativa UA. Quale angle ha ITR alto? (personaggio vs meccanica vs reward)
   - Crea 2-3 variant che portano quell'angle ai visual dello store. Control = visual attuale.

2. **Lancio del test (Settimana 1-2):**
   - Metti le CPP in produzione con routing a livello di campagna. Dai traffico uguale a ogni variant (regolazione manuale dei bid o creative rotation).
   - Estrai dati di impression + install quotidiani. Non annunciare il vincitore ancora.

3. **Verifica della significatività (Settimana 3):**
   - Esegui z-test per ogni variant. Se nessuno raggiunge la significatività, aumenta il traffico (tira su le impression del 50%) o aspetta 1 settimana di più.
   - Se 1 variant ha p < 0.05 e lift > %15, passa all'iterazione.

4. **Iterazione del vincitore (Settimana 4-5):**
   - Rendi il variant vincitore il nuovo baseline. Crea 2 nuovi variant: uno con cambiamento radicale (color scheme diverso), uno incrementale (riordina gli screenshot).
   - Avvia il test del 2º round.

5. **Scale (Settimana 6+):**
   - Se il 2º round produce un altro vincitore, applicalo a tutte le campagne. Archivia il control vecchio.
   - Rifai i test dopo 3 mesi — il meta cambia, la creativa degrada.

Se esegui questo ciclo in 6 settimane, fai 8 giri di test all'anno. Se ogni test porta +%10-15 di lift: (1.1)^8 = 2.14x → +%114 di improvement IPM a fine anno. Nella pratica vediamo %30-50 (perché non tutti i test vincono).

## Multivariate Testing e Segmentazione

Quello sopra è un A/B a due gruppi. Livello avanzato: **multivariate testing** (MVT). Testi 3+ elementi simultaneamente: icon, primo screenshot, anteprima video. Ma il numero di combinazioni esplode (3 icon × 4 screenshot × 2 video = 24 variant). Il sample requirement moltiplicato per 24.

Soluzione: **factorial design**. Misuri l'effetto principale di ogni elemento separatamente. Perdi gli effetti di interazione (es. se icon A + screenshot B hanno una sinergia speciale, non la vedrai). Tradeoff: velocità vs profondità.

Alternativa: **sequential testing**. Prima icon, poi screenshot, poi video. Ogni fase trova il vincitore, poi passi all'elemento successivo. Tempo totale più lungo (12-18 settimane) ma ogni decisione è su basi solide.

**Segmentazione:** Puoi anche segmentare le CPP per audience. Es.: utenti iOS 17+ vedono UI moderna, iOS 15- vedono visuale classica. O geo-based: USA tema superhero, MENA tema fantasy. Qui hai bisogno di test separati per segment — il fabbisogno totale di sample si moltiplica. Segmentazione sensata: gruppi con differenza LTV > %30.

## Con Roibase: Infrastruttura di Test per ASO

Il servizio [App Store Optimization](/it/aso) di Roibase costruisce l'infrastruttura di test per CPP/PPE: mapping del conversion value per SKAdNetwork, integrazione Firebase/Adjust, dashboard custom con tracking della significatività in tempo reale. Inoltre, il [Premium Publisher Program](/it/premiumyayunci) allinea la tua creativa UA alla creativa dello store — la creativa TikTok SparkAds e il visual CPP devono parlare lo stesso linguaggio visivo.

Engagement tipico: prime 2 settimane baseline measurement, settimane 3-6 primo ciclo di test, settimane 7-12 iterazione + scale. Dopo 3 mesi vediamo +%20-35 IPM lift (segment casual/hyper-casual tier-1). Per midcore/strategy il lift è più basso (%10-15) perché il cycle decisionale è più lungo, il dettaglio dello screenshot è critico.

## Chiusura: Creative Testing = Processo Continuo

Il creative testing per ASO non è una campagna, è un processo. Se testi una volta e usi il vincitore per 6 mesi, perdi metà del lift per degradation creativa. Refresh ogni 3 mesi. Il meta cambia, i competitor provano nuovi stili, le tendenze editoriali di Apple/Google evolvono.

Quello che devi fare adesso: analizza i tuoi visual di store attuali. L'angle top-performer della tua creativa UA (personaggio, meccanica, reward) corrisponde al messaggio dello screenshot? Se no, crea il tuo primo variant CPP da quell'angle. Raccogli 5000+ impression in 2 settimane. Esegui lo z-test. Se lift > %15 e p < 0.05, itera. Dopo 6 settimane avrai +%20-30 IPM lift.