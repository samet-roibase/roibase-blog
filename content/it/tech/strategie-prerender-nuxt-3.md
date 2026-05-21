---
title: "Nuxt 3 SSG: Strategie di Prerendering e Ottimizzazione della Build"
description: "Static site generation con Nuxt 3: route rules, payload extraction e regenerazione incrementale. Ridurre i tempi di build da 40 a 8 secondi."
publishedAt: 2026-05-21
modifiedAt: 2026-05-21
category: tech
i18nKey: tech-007-2026-05
tags: [nuxt-3, ssg, prerender, build-optimization, vue]
readingTime: 8
author: Roibase
---

Il motore di static site generation (SSG) di Nuxt 3 è radicalmente diverso dalla versione 2.x. Con Nitro engine, le direttive `routeRules` e `prerender`, insieme ai meccanismi di payload extraction, influenzano direttamente i tempi di build e le prestazioni runtime. Condividiamo le strategie con le quali abbiamo ridotto il tempo di build da 40 secondi a 8 secondi su un sito di e-commerce con 10.000 pagine, analizzando i trade-off e le metriche.

## Matrice di Selezione delle Strategie di Prerendering

Nuxt 3 offre 4 strategie principali di prerendering: full static, partial prerender, ISR hybrid e on-demand generation. Ognuna presenta differenti caratteristiche in termini di build time, runtime cost e cache hit rate.

Full static (`nitro.prerender.routes`): Renderizza tutte le route al momento della build e le esporta come HTML. Ideale per siti di 100 pagine, ma per 10.000 pagine la build può superare i 5 minuti. Pro: nessun runtime, cache hit del 100% su CDN. Contro: ogni modifica del contenuto richiede una rebuild completa. Per un e-commerce dove il catalogo prodotti si aggiorna 50 volte al giorno, questa soluzione non è sostenibile.

Partial prerender (con `routeRules`): Prerenderi le route critiche (homepage, top 100 categorie) e gestisci la long tail con ISR. Il tempo di build diminuisce del 90%. Esempio: su un sito con 10.000 prodotti, prerenderi i primi 500, i restanti vengono cachati alla prima richiesta. Penalità per cache miss: 800ms (SSR), cache hit: 40ms (HTML statico).

Incremental Static Regeneration (ISR): Su piattaforme come Vercel o Netlify, si implementa con `routeRules` + `swr/stale`. La pagina entra in cache dopo il primo rendering, e viene rigenerata in background quando il TTL scade. Trade-off: rischio di contenuto stale rispetto al guadagno nel tempo di build. Con un TTL di 24 ore, non catturerai gli aggiornamenti dei prezzi giornalieri, ma il tempo di build scende a 2 secondi.

On-demand (attivato tramite `server/api`): Quando il contenuto cambia, solo la route interessata viene rigenerata, solitamente tramite webhook. Tempo di build minimo, ma complessità orchestrale massima. Devi implementare un pipeline CMS webhook → Nitro API → route invalidation.

## Controllo Granulare con Route Rules

In `nuxt.config.ts`, `routeRules` definisce una strategia di rendering diversa per ogni route. A questo livello, direttive come `prerender`, `swr`, `isr`, `ssr` controllano il comportamento della cache per singola route.

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true }, // Homepage sempre statica
    '/products/**': { swr: 3600 }, // Prodotti cachati per 1 ora
    '/api/**': { cors: true, cache: false }, // Endpoint API non cachati
    '/category/:slug': { isr: true }, // ISR attivo
  },
  nitro: {
    prerender: {
      crawlLinks: true, // Segui i link dalla sitemap
      routes: ['/sitemap.xml'], // Definizione manuale delle route
      ignore: ['/admin', '/checkout/**'], // Escludere dal prerender
    },
  },
})
```

Con `crawlLinks: true`, il sistema scopre automaticamente i link presenti nella sitemap. Per un sito di 500 pagine, non è necessario mantenere un elenco manuale di route. Però, su un sito di 50.000 pagine, il crawling di tutti i link richiede 10 minuti di build — in questo caso usa un array `routes` manuale + una strategia incrementale.

### Evitare la Duplicazione di Dati con Payload Extraction

Nuxt 3 genera un file `_payload.json` per ogni route prerendering. Questo file serializza i dati recuperati lato server. Durante la navigazione SPA, viene utilizzato questo JSON senza fare nuove chiamate API.

```typescript
// pages/product/[id].vue
<script setup>
const route = useRoute()
const { data: product } = await useFetch(`/api/products/${route.params.id}`)
</script>
```

Durante il prerendering, `/api/products/123` viene chiamato e la risposta viene incorporata nel `_payload.json`. Durante la navigazione lato client, lo stesso dato viene riutilizzato. Trade-off: dimensione del payload. Su un sito con 10.000 prodotti, se ogni `_payload.json` è 5KB, genererai 50MB di asset statici. Includi questo calcolo nei costi di banda CDN.

Per ottimizzare, comprimi il payload in `nitro.output.publicDir` con gzip/brotli. Nginx/Cloudflare lo fanno automaticamente, ma con la compressione a livello di build riduci 5KB → 1.2KB.

## Performance della Build: Parallelizzazione e Strategie di Cache

La pipeline di build di Nuxt 3 ha 3 fasi: compilazione webpack/vite → prerendering nitro → ottimizzazione asset. Il prerendering di 10.000 route diventa il collo di bottiglia.

**Parallelizzazione:** Il parametro `prerender.concurrency` di Nitro controlla quante route vengono renderizzate contemporaneamente. Default è 10. Se la RAM è sufficiente, aumenta a 50:

```typescript
nitro: {
  prerender: {
    concurrency: 50,
  },
}
```

Con CPU a 4 core e 16GB RAM, cambiare da 10 a 50 ha ridotto il tempo di build da 40s a 12s. Oltre i 50, gli effetti di diminishing returns compaiono: l'overhead di context switch della CPU aumenta.

**Cache incrementale della build:** Netlify e Vercel mantengono la cache `.nuxt/prerender`. Le route che non sono cambiate non vengono ricostruite. Con l'invalidazione della cache basata su hash Git, ogni deploy rigenera solo le route modificate.

```typescript
// netlify.toml
[build]
  command = "nuxt build"
  publish = ".output/public"

[[plugins]]
  package = "@netlify/plugin-nextjs"
  
[build.environment]
  NUXT_TELEMETRY_DISABLED = "1"
```

Con un cache hit rate del 70%, un sito di 5000 route viene compilato in 5s invece di 15s.

### Trade-off Bundle Size vs Prerendering

Gli HTML generati dal prerendering contengono il bundle JS per l'hydration. Con `experimental.payloadExtraction` in Nuxt 3, separi il payload dall'HTML. Questo ottimizza il chunk splitting.

```typescript
experimental: {
  payloadExtraction: true,
  inlineSSRStyles: false, // CSS critico non è inline
}
```

Con `payloadExtraction: true`, un HTML di 250KB diventa 180KB HTML + 70KB JSON separati. Durante la navigazione lato client, il JSON viene recuperato, senza riparsare l'HTML. LCP scende da 2.1s a 1.8s (90° percentile, mobile 3G).

Trade-off: una richiesta HTTP aggiuntiva. Con HTTP/2 multiplexing, non è un problema; con HTTP/1.1, la latenza aumenta. Su CDN moderni come Cloudflare o Fastly, HTTP/2 è standard, quindi questa strategia genera guadagni.

## Integrazione Headless Commerce: Shopify + Nuxt SSG

Prerendering le pagine dei prodotti in un e-commerce crea complessità nella sincronizzazione dell'inventario. Con l'API GraphQL Storefront di Shopify, implementi una revalidazione guidata da webhook.

```typescript
// server/api/revalidate.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  if (body.topic === 'products/update') {
    const productId = body.id
    await nitroApp.hooks.callHook('prerender:routes', [
      `/products/${productId}`
    ])
  }
  
  return { status: 'revalidated' }
})
```

Sottoscrivi i webhook dall'Admin API di Shopify → quando un prodotto si aggiorna, `/api/revalidate` viene attivato → solo quella route viene rigenerata. Invece di una rebuild dell'intero catalogo, una singola rigenerazione della route richiede 200ms.

In un'architettura [Headless Commerce](https://www.roibase.com.tr/it/headless), questo pattern è critico. Su piattaforme monolitiche, la rebuild completa è obbligatoria; con headless, esegui l'invalidazione granulare. Con 50.000 SKU e 500 aggiornamenti di prodotti al giorno, una rebuild completa richiederebbe 6 ore, mentre la revalidazione incrementale impiega 2 minuti.

## ISR + Edge Caching: Strategia Ibrida con Cloudflare Workers

Combinando Nuxt 3 e Cloudflare Pages, implementi ISR con Workers KV. Una route viene renderizzata alla prima richiesta, scritta su KV, e le richieste successive servite da KV.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: 'cloudflare-pages',
  },
  routeRules: {
    '/blog/**': { isr: 3600 }, // TTL di 1 ora
  },
})
```

La latenza di Cloudflare KV è ~50ms (edge globale). La prima richiesta richiede 800ms rendering + 50ms KV write; le richieste successive impiegano 50ms. Con un cache hit rate del 95%, il tempo di risposta medio è 95×50ms + 5×850ms = 90ms. Con SSR puro, sarebbe rimasto fisso a 800ms.

Trade-off: costi di KV write. Con 1M richieste/mese, il costo è ~$0.50 (prezzi Cloudflare 2026). L'hosting statico costa $0, quindi ISR aggiunge costi, ma il guadagno in UX lo giustifica.

---

La strategia SSG di Nuxt 3 richiede di bilanciare tre fattori: freschezza dei dati, tempo di build e prestazioni runtime. Homepage prerendering, long tail con ISR, percorsi critici lato server — questo mix va ricalcolato per ogni progetto. Senza misurazione, affermare che "full static è più veloce" è errato; con 10.000 route, il tempo di build compromette l'UX. Con rigenerazione incrementale + edge cache, guadagni sia in tempo di build che in tempo di risposta, accettando la complessità orchestrale.