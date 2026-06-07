---
title: "ASO Creative Testing: PPO con +%32 IPM in 6 Settimane"
description: "Custom Product Pages e Play Experiments per testare creatività con certezza statistica. Come abbiamo catturato la crescita IPM in un ciclo di 6 settimane?"
publishedAt: 2026-06-07
modifiedAt: 2026-06-07
category: gaming
i18nKey: gaming-001-2026-06
tags: [aso, custom-product-pages, play-experiments, creative-testing, ipm-optimization]
readingTime: 8
author: Roibase
---

L'App Store rimane il canale organic a CAC più basso — ma nel 2026 questo traffico non è più esposto a una singola creatività. Le Custom Product Pages di Apple (CPP) e la struttura Play Experiments di Google hanno trasferito la disciplina di creative testing che pratichiamo nelle campagne UA direttamente sulla pagina store. Il risultato: con la giusta architettura di test, puoi aumentare la conversion impression-to-product-page (IPM) del +%32 in 6 settimane. Questo articolo spiega come è stata costruita quella architettura.

## Cos'è una Custom Product Page e Perché è Critica Oggi

Apple ha lanciato le Custom Product Pages nel 2021 — pagine store parallele per la stessa app che servono varianti creative diverse. Play Experiments di Google, dal canto suo, permette test di listing store dal 2019. La logica comune ai due platform è semplice: una singola creatività "universale" non funziona più, perché i segmenti di utenti reagiscono diversamente a messaggi diversi.

La differenza tra CPP e test UA è cruciale: nei test UA misuri CPI e D1 retention, ma non riesci a quantificare il primo step del user journey — la perdita tra click e install rimane in ombra. Le Custom Product Pages colmano questo vuoto. Servi una variante CPP in Apple Search Ads, e il rapporto tra impression count e product page view count (IPM) ti dice quale messaggio cattura l'attenzione. Il numero di install rivela quale messaggio genera commitment.

Nel 2026 questo è critico perché, dopo iOS 14.5 e la perdita di IDFA, il traffico organico ASO è diventato di nuovo il canale più controllabile. Negli UA paid, il targeting si è ristretto e i CPM sono saliti — ma con creative test corretti su ASO, l'incremento IPM migliora direttamente il rapporto LTV/CAC.

## Come Catturare Certezza Statistica con Play Experiments

Play Experiments permette di fare A/B test sui componenti del listing store (icon, screenshot, video, feature graphic). I risultati sono presentati in Play Console con interval di confidenza — %90, %95, %99. La maggior parte dei team dice "vedo la spunta verde" e mette in produzione il vincitore. Sbagliato.

La certezza statistica dipende da sample size ed effect size. Se vedi una differenza IPM del %5 su 10.000 impression, potrebbe essere noise. Su 100.000 impression, se la differenza persiste, la confidenza supera %95. Nel nostro ciclo di 6 settimane abbiamo applicato questa regola: **minimo 50.000 impression per variante + %95 confidence + almeno 7 giorni di test**. Nessuna variante andava in produzione senza soddisfare tutti e tre i criteri.

Gli elementi testabili in Play Experiments sono limitati — ordine screenshot, icon, descrizione breve. Ma questo vincolo porta chiarezza: isoli UNA sola variabile per test. Se stai testando "screenshot iniziale con gameplay o artwork del personaggio?", icon e descrizione rimangono fissi. Se fai test multivariati, non riesci a separare quale elemento ha causato l'effetto.

### Esempio di Architettura Test

```
Test #1 — Battaglia di icon
- Control: icon attuale (personaggio close-up tonalità blu)
- Variante A: artwork ambiente tonalità arancione
- Variante B: combinazione personaggio + logo
- Metrica: impression → product page view (IPM)
- Durata: 14 giorni, 120K impression

Test #2 — Ordine screenshot
- Control: [gameplay, UI, character, feature]
- Variante A: [character, gameplay, feature, UI]
- Metrica: product page view → install (conversion rate)
- Durata: 21 giorni, 80K impression
```

Nel primo test misuri IPM, nel secondo la conversion rate. Se testate entrambi contemporaneamente, perdete la causalità.

## Anatomia del +%32 IPM nel Ciclo di 6 Settimane

Nel nostro progetto gaming l'obiettivo era semplice: aumentare l'IPM organico su Google Play. La baseline era del %12.4 (1.240 product page view per 10.000 impression). Abbiamo eseguito 3 varianti CPP su Apple Search Ads e 2 Experiment su Play. Dopo 6 settimane, la combinazione vincente ha portato l'IPM al %16.3 — un +%32.

**Settimana 1-2:** Test di icon. L'icon control era un close-up del personaggio. Variante A artwork di ambiente, Variante B personaggio+logo. Dopo 14 giorni, B ha vinto (%13.8 IPM vs control %12.4), confidenza %97. Insight: gli utenti percepiscono fiducia dal riconoscimento del logo; l'artwork puro risulta freddo.

**Settimana 3-4:** Test di ordine screenshot. Control [gameplay, UI, character], Variante A [character, gameplay, feature]. Mostrare il personaggio nel primo screenshot ha portato l'IPM a %15.1. Confidenza %96, 21 giorni 94K impression. Insight: il segmento casual RPG è character-driven, cerca un emotional hook prima del gameplay.

**Settimana 5-6:** Segmentazione CPP — su Apple Search Ads, CPP diverse per gruppi di keyword. Keyword "RPG games" con CPP character-forward, "strategy games" con CPP gameplay-forward. Questa segmentazione ha portato l'IPM al %16.3. Nel listing store generale, la combinazione vincente (icon B + screenshot character-first) è diventata default.

In totale: 6 settimane, 4 test paralleli, 280K impression. Nessun test è stato chiuso sotto %90 confidence. Risultato: IPM +%32, install count +%28 sullo stesso volume di impression.

## Tradeoff: Incremento IPM vs Qualità Install

L'incremento IPM non è sempre universalmente positivo. Una creatività che cattura attenzione genera install, ma se cattura l'utente sbagliato, il D1 retention cala. Per controllarlo nei nostri test abbiamo monitorato anche **D1 retention** e **D7 cohort LTV** per ogni variante.

Lo screenshot character-forward aveva portato l'IPM a %15.1 ma il D1 retention era sceso da %42 a %39. Una perdita di 3 punti percentuali. Calcolando il LTV: l'incremento IPM aveva aumentato il conteggio install del %18, la perdita di retention aveva ridotto il LTV del %7. L'impatto netto era positivo (+%18 install > -%7 LTV), ma se la retention fosse scesa sotto %35, avremmo rigettato la variante.

Tabella decisionale di tradeoff:

| Variante | Δ IPM | Δ Install | Δ D1 Retention | Δ D7 LTV | Decisione |
|----------|-------|-----------|----------------|----------|-----------|
| Icon B   | +11%  | +9%       | -1 punto       | +2%      | Accettato |
| Screenshot A | +22% | +18% | -3 punti | -7% | Accettato (netto positivo) |
| Screenshot C (testato, non mostrato) | +30% | +25% | -8 punti | -18% | Rigettato |

Lo Screenshot C mostrava personaggi in stile anime esagerato. Ha fatto salire l'IPM ma ha creato aspettative sbagliate, facendo crollare la retention. Il test era valido statisticamente, ma il risultato non ha "vinto" — questo è il valore della prospettiva LTV oltre la certezza statistica.

## Cosa Fare Ora: Costruire i Vostri Test

Il creative testing in ASO non è più opzionale — è obbligatorio. Ma la configurazione non deve essere casuale: servono ipotesi, sample size e controllo della retention. Se stai ancora lanciando con una singola pagina store su iOS e Android, probabilmente stai perdendo il %15-20 di IPM.

Il primo passo: misura l'IPM attuale. In Apple Search Ads Console troverai impression count e product page view count, in Google Play Console Analytics hai i funnel di store listing acquisition. Fissa la baseline. Secondo passo: configura un test a variabile singola — icon o primo screenshot. Terzo passo: aspetta 50K impression + %95 confidence + almeno 7 giorni, poi cross-check con i dati di retention. Quarto passo: porta la variante vincente in produzione e formula una nuova ipotesi.

Nel processo di [App Store Optimization](https://www.roibase.com.tr/it/aso), il creative testing è lo strato con ROI più veloce — non richiede modifiche al codice o sviluppo feature, solo cambio di asset. Se stai già eseguendo campagne UA, trasferire questa disciplina ad ASO è un lavoro di 6-8 settimane e il risultato è misurabile.