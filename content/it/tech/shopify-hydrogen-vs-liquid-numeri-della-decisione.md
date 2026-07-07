---
title: "Shopify Hydrogen vs Liquid: I Numeri Dietro la Nostra Scelta"
description: "TTFB 680ms vs 120ms, tempo di build 8min vs 45sec, costo migrazione $12K. Analizziamo i dati che hanno guidato il passaggio a Hydrogen."
publishedAt: 2026-07-07
modifiedAt: 2026-07-07
category: tech
i18nKey: tech-002-2026-07
tags: [shopify-hydrogen, liquid, web-performance, headless-commerce, ttfb]
readingTime: 9
author: Roibase
---

Quando Shopify Hydrogen ha raggiunto la versione stable a fine 2024, abbiamo valutato il passaggio del tema Liquid di un nostro cliente a Hydrogen. Il processo decisionale è stato puramente numerico: TTFB, tempo di build, dev velocity, costo della migrazione. Risultato: la migrazione è stata completata e lanciata in produzione dopo tre mesi. In questo articolo mostriamo quali numeri hanno guidato la decisione.

## TTFB: Il Costo del Server-Side Rendering

Il tema Liquid in produzione restituiva un TTFB medio di 680ms (misurato da Shopify Analytics, media su 30 giorni). La distribuzione per tipo di pagina:

| Tipo di Pagina | Liquid TTFB | Hydrogen TTFB | Differenza |
|---|---|---|---|
| Home | 520ms | 95ms | -425ms |
| Collezione | 780ms | 140ms | -640ms |
| Prodotto | 650ms | 110ms | -540ms |
| Carrello | 890ms | 150ms | -740ms |

Il motore SSR di Hydrogen in esecuzione su edge restituiva una risposta di circa 120ms indipendentemente dal tipo di pagina. Ogni richiesta al server di Shopify con Liquid scattava il rendering server-side, mentre Hydrogen eseguiva i loader di Remix sui nodi edge di Oxygen.

```typescript
// Esempio di loader Hydrogen — eseguito su edge di Oxygen
export async function loader({context, params}: LoaderFunctionArgs) {
  const {storefront} = context;
  const {handle} = params;
  
  const {product} = await storefront.query(PRODUCT_QUERY, {
    variables: {handle},
  });
  
  return json({product});
}
```

Con cache hit, l'TTFB scendeva a 40ms (dopo aver aggiunto un livello di cache con Cloudflare Workers KV). Per ottenere un'ottimizzazione simile con Liquid, dovevamo affidarci alla CDN di Shopify, ma questa soluzione non era sufficiente per il contenuto dinamico (carrello, personalizzazione).

## Tempo di Build: L'Espansione della Velocity di Sviluppo

Il build in produzione del tema Liquid (nella pipeline CI/CD) richiedeva mediamente **8 minuti e 15 secondi**. Theme Kit eseguiva l'upload degli asset, la minificazione e il deploy su Shopify. Il build di Hydrogen in produzione richiedeva **45 secondi** — build Vite + deploy su Oxygen.

**Nell'ambiente di sviluppo:**
- Liquid: nessun hot reload, ogni modifica richiede il ricaricamento manuale del tema (~12sec)
- Hydrogen: HMR rende le modifiche visibili nel browser istantaneamente (<200ms)

Feedback del team di sviluppo: durante lo sviluppo di una feature su un branch con 20 modifiche, il tempo di attesa totale era di 4 minuti con Liquid e 4 secondi con Hydrogen. L'incremento di dev velocity è stato del %98.

```bash
# Avvio del server di sviluppo di Hydrogen
npm run dev
# Server Vite pronto in 200ms, HMR attivo

# Sviluppo tema Liquid
shopify theme serve
# Attesa fino a 8-12sec per il caricamento del tema
```

L'architettura [Headless Commerce](https://www.roibase.com.tr/it/headless) rende queste ottimizzazioni possibili — il frontend recupera i dati tramite Shopify Storefront API, il processo di build è indipendente.

## Costo della Migrazione: Calcolo del Debito Tecnico

Abbiamo suddiviso il costo della migrazione in questi capitoli:

| Voce | Ore | Costo ($) |
|---|---|---|
| Analisi tema Liquid | 16 | 1.600 |
| Mapping dei component (35 snippet Liquid → React) | 80 | 8.000 |
| Migrazione API Shopify (REST → Storefront API) | 24 | 2.400 |
| Testing + QA | 12 | 1.200 |
| **Totale** | **132** | **$13.200** |

Costo aggiuntivo: hosting Oxygen (incluso con Shopify Plus), livello di cache Cloudflare Workers (opzionale, $5/mese).

**Tradeoff:** il costo alternativo di rimanere con Liquid: inefficienza di sviluppo annuale di 120 ore (dal divario di tempo di build sopra) × $100/ora = $12.000. Entro la fine del primo anno, il costo della migrazione è ammortizzato.

## Performance in Produzione: Impatto sui Core Web Vitals

Dati reali (Chrome User Experience Report, 28 giorni):

| Metrica | Liquid (p75) | Hydrogen (p75) | Differenza |
|---|---|---|---|
| LCP | 2.840ms | 1.620ms | -43% |
| FID | 180ms | 80ms | -56% |
| CLS | 0,18 | 0,04 | -78% |
| TTFB | 680ms | 120ms | -82% |

La combinazione di React Suspense e streaming SSR di Hydrogen riduce l'LCP. I component di lazy loading vengono estratti dal bundle iniziale, il percorso critico diventa più breve.

```typescript
// Lazy loading delle raccomandazioni di prodotto con React Suspense
import {Suspense} from 'react';
const ProductRecommendations = lazy(() => import('./ProductRecommendations'));

<Suspense fallback={<RecommendationSkeleton />}>
  <ProductRecommendations productId={product.id} />
</Suspense>
```

La riduzione del CLS: Liquid causava layout shift dinamico (cart drawer, banner promozionale), mentre Hydrogen ha eliminato questi shift (grazie ai component skeleton).

## Developer Experience: Il Feedback del Team

60 giorni dopo la migrazione, abbiamo condotto un sondaggio con il team di sviluppo (5 sviluppatori):

**La maggiore difficoltà con Liquid:**
- 80% "Lunghe sessioni di debug"
- 60% "Mancanza di tooling moderno (TypeScript, hot reload)"
- 40% "Assenza di riusabilità dei component"

**Il maggiore vantaggio con Hydrogen:**
- 100% "TypeScript + autocomplete dell'IDE"
- 80% "Dev speed con HMR"
- 60% "Accesso all'ecosistema React"

Feedback negativo: documentazione incompleta di Hydrogen (%40), curva di apprendimento del router Remix di Shopify (%20).

## Quando Liquid è la Scelta Giusta

La permanenza su Liquid ha senso in queste condizioni:

1. **Traffico del sito <10K sessioni/mese:** la differenza di TTFB non è percettibile dall'utente, il ROI della migrazione è assente.
2. **Tema poco customizzato:** se usi un tema standard, lo sforzo della migrazione non produce benefici.
3. **Team di sviluppo non conosce React:** i costi di apprendimento + onboarding moltiplicano la durata della migrazione per 2-3 volte.
4. **Non Shopify Plus:** l'hosting Oxygen è incluso con Shopify Plus; sui piani Basic/Advanced rappresenta un costo aggiuntivo.

## Dopo la Decisione: Strategia di Rollout in Produzione

Rollout in tre fasi:

1. **Ambiente beta:** il sito Hydrogen è stato deployato su Vercel, test interno per 2 settimane (QA + stakeholder).
2. **Canary release:** il 10% del traffico è stato indirizzato a Hydrogen (split con Cloudflare Workers A/B), tasso di conversione +2,3%.
3. **Rollout completo:** dopo 14 giorni, il 100% del traffico è migrato a Hydrogen, il tema Liquid rimasto come backup.

Post-launch: conversion rate checkout da %3,8 a %4,1 (effetto della riduzione TTFB + miglioramento CLS). Impatto su revenue annuale: $180K (AOV medio $120, 15K ordini/mese).

La decisione per Hydrogen è risultata corretta numericamente: TTFB ridotto dell'82%, dev velocity aumentata del 98%, costo della migrazione ammortizzato nel primo anno. La ragione della fuga da Liquid non è stata la performance pura — bensì la developer experience moderna e la flessibilità dell'architettura composable. Se vuoi rimanere nell'ecosistema Shopify mentre passi a headless, Hydrogen è l'unica scelta razionale.