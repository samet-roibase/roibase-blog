---
title: "ASO Creative Testing: +%32 IPM in 6 Settimane con PPO"
description: "Custom Product Pages e Play Experiments per l'ottimizzazione install-per-mille. Calcolo della significatività statistica, durata del test e ciclo di iterazione creativa."
publishedAt: 2026-07-19
modifiedAt: 2026-07-19
category: gaming
i18nKey: gaming-001-2026-07
tags: [aso, custom-product-pages, play-experiments, ipm-optimization, mobile-gaming]
readingTime: 8
author: Roibase
---

Le Custom Product Pages di Apple e Play Experiments di Google esistono dal 2021, ma nel mobile gaming solo nel 2026 il creative testing può finalmente collegarsi all'attribution reale. Nei mercati Tier-1, il costo organico degli install è aumentato del %400; ogni incremento di IPM guadagnato con CPP impatta direttamente sulla LTV a 6 mesi. Nuove metodologie per accelerare il calcolo della significatività statistica hanno ridotto il tempo di test da 12 a 6 settimane — in questo articolo costruiamo quel ciclo.

## Perché Custom Product Pages sono Prioritarie Adesso

Quando crei una CPP su Apple, ogni variante riceve un deep link univoco. Collegando questo link alle campagne Apple Search Ads, ai contenuti degli influencer o ai network di publisher premium, puoi vedere nell'attribution graph quale creativa converte in quale segmento. Prima del 2025 era impossibile — il default store listing riceveva tutto il traffico, dovevi indovinare la performance creativa.

Ora è diverso: ogni campagna invia traffico a CPP diverse, la metrica IPM (impressions-per-mille) in App Store Connect corrisponde all'ID della campagna. Nei giochi F2P hyper-casual, una differenza di %5 in IPM significa 40.000 dollari di risparmio CPI al mese. Per questo CPP non è più opzionale — è l'ambiente di test obbligatorio.

Su Google Play, Play Experiments funziona con logica simile ma il meccanismo di distribuzione del traffico è diverso: Google esegue automaticamente uno split %50-%50, senza allocation manuale. Questo è limitante in alcuni scenari, ma semplifica il calcolo della significatività statistica — ogni variante riceve exposure uguale.

### Calcolo della Durata del Test

Il ciclo di 6 settimane si basa su questa formula:

```
minimum_sample = (z_score^2 * p * (1-p)) / (margin_of_error^2)
weekly_impressions = average_daily_traffic * 7
weeks_needed = minimum_sample / weekly_impressions
```

Per un gioco che riceve 10.000 impression giornalieri, con livello di confidence %95 e margin of error %2:

| Metrica | Valore |
|---------|--------|
| z_score (95% confidence) | 1.96 |
| p (expected conversion) | 0.05 |
| margin_of_error | 0.02 |
| minimum_sample | 456 install |
| weekly_impressions | 70.000 |
| weeks_needed | 6.5 |

Raggiungi la significatività statistica in 6 settimane. Aspettare 12 settimane è un rischio inutile — quando arrivano i risultati preliminari, devi iterare.

## Prioritizzazione Test: Screenshot vs Video Icon

Due asset creativi impattano maggiormente l'IPM: il primo screenshot e l'app icon. L'anteprima video si riproduce automaticamente ma il %68 degli utenti scorre via entro 3 secondi — lo screenshot statico trasmette il messaggio in modo più controllato.

L'ordine di priorità del test è:

1. **Variante icon** — 3 varianti, ognuna con color scheme diverso. Nei giochi casual il colore caldo fornisce %12 IPM più alto; negli RPG hardcore il tone freddo è preferito.
2. **Messaggio primo screenshot** — feature-focused vs character-focused. Nei giochi match-3 vince il feature (power-up showcase), negli RPG narrativi vince il personaggio.
3. **Durata anteprima video** — 15 secondi vs 30 secondi. In Tier-1, 15 secondi mostra %8 completion rate più alto.

In ogni ciclo di test, isola una sola variabile. Se cambi icon e screenshot simultaneamente, non saprai quale asset è decisivo. Durante il processo di [App Store Optimization](https://www.roibase.com.tr/it/aso), questo isolamento è l'approccio fondamentale di Roibase — ciclo di test a singola variabile, attribution chiara.

### Criterio di Selezione del Vincitore

L'incremento di IPM non è sufficiente — devi verificare la qualità degli install. Cross-check con queste metriche:

- **D1 retention** — tasso di ritorno il giorno successivo degli utenti acquisiti con la nuova creativa
- **Tutorial completion** — completamento della funnel nella prima sessione
- **First IAP conversion** — coerenza tra la promessa creativa e la realtà in-game

Se una variante aumenta l'IPM di %32 ma la D1 retention cala di %15, significa che hai usato creativa ingannevole. Quella variante non è vincitrice — sta attirando traffico spam.

## La Questione dell'Allocation di Traffico su Play Experiments

Su Google Play, l'allocation non è manuale, ma puoi trasformarlo in un vantaggio: indirizza le campagne di pre-registrazione verso una sola variante, il traffico organico verso le altre. In questo modo puoi vedere la performance per segmento.

Gli utenti pre-registrati hanno generalmente higher intent — aspettative di LTV più elevate. Se la variante A fornisce %40 IPM su pre-reg e la variante B %28 IPM su organic, puoi costruire una strategia per segmento: campagne paid verso A, default ASO verso B.

Il threshold di confidence statistica di Google è %90 — inferiore a Apple. Questo ti permette di ottenere risultati più rapidamente, ma il rischio di falsi positivi aumenta. Mantieni il ciclo di 6 settimane, non annunciare vincitori anticipati.

## Ciclo di Iterazione Creativa: 6 Settimane x 4 Periodi

In un trimestre puoi eseguire 4 iterazioni:

| Settimana | Attività | Output |
|-----------|----------|--------|
| 1-6 | Primo test (icon) | Icon vincente |
| 7-12 | Secondo test (screenshot) | Set screenshot vincente |
| 13-18 | Terzo test (video) | Anteprima video vincente |
| 19-24 | Test combinato finale | CPP ottimizzata |

In ogni ciclo, trasformi il vincitore in default e passi all'asset successivo. Dopo 24 settimane, l'incremento di IPM di %32 è cumulativo — non tutto in una volta, ma %8-10 per iterazione.

Per mantenere questo ciclo senza interruzioni, devi costruire una pipeline di produzione creativa: quando il test inizia, il prossimo set di asset deve essere già pronto. Non stare inattivo per 6 settimane — produce in parallelo.

### Rischio del Test A/B/C

Un test a 3 varianti sembra allettante ma la divisione del traffico è problematica: ogni variante riceve %33, raggiungere la significatività statistica richiede 9 settimane. Fai così:

1. Primo turno A vs B (6 settimane)
2. Prendi il vincitore, confrontalo con C (6 settimane)
3. Trasforma il vincitore finale in default

Totale 12 settimane, ma ogni ciclo è valido — eliminazione su due stadi invece di 3 varianti in un colpo.

## Differenziazione Creativa Tier-1 vs Mercati Emergenti

Una creativa che funziona negli USA fornisce %18 IPM inferiore in Brasile — la psicologia del colore e i riferimenti culturali sono diversi. Devi creare CPP geo-specifiche:

- **Tier-1 (US, UK, DE):** Design minimalista, value prop chiara, messaging "no ads"
- **Tier-2 (BR, MX, TR):** Colore vibrante, social proof (download count), angolo competitivo

Su Apple CPP non esiste geo-targeting, ma a livello di campagna orienti il deep link. Su Google Play Experiments esiste il filtro geo — split più facile.

Nel mercato emergente la durata del test è più lunga: volume di traffico inferiore, serve 8-10 settimane. Valida prima in Tier-1, poi passa agli emergenti — non testare in parallelo, disperdi risorse.

## Il Dilemma della Significatività Statistica

Il %95 di confidence non è sempre il threshold corretto. Se ricevi 50.000 impression giornaliere, raggingi il %90 di confidence in 4 settimane; aspettare 6 settimane per %95 è un rischio inutile. Usa questa tabella per scegliere il threshold:

| Daily Impressions | Livello Confidence | Settimane Necessarie |
|-------------------|-------------------|----------------------|
| 5.000 | %90 | 8 |
| 10.000 | %90 | 6 |
| 50.000 | %90 | 4 |
| 10.000 | %95 | 9 |
| 50.000 | %95 | 6 |

Con traffico superiore, un confidence inferiore è sufficiente — la sample size è già grande, il margin of error è basso. Se usi l'approccio Bayesiano, estrai la prior distribution dai dati IPM storici; la durata del test cala del %30.

Il creative testing è un ciclo continuo — non ottimizzi una volta e basta. Almeno un'iterazione per trimestre, ogni iterazione misurata con attribution netta di incremento IPM. Il framework di 6 settimane rende questo ciclo sostenibile — aspettare 12 settimane perde momentum, decidere in 4 settimane significa correre il rischio di falsi positivi. L'equilibrio tra rigore statistico e velocità si trova qui.