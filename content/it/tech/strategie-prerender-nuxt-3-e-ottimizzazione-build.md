---
title: "Nuxt 3 SSG: Strategie di Prerender e Ottimizzazione Build"
description: "Guida tecnica approfondita sulle capacità di static generation di Nuxt 3. Route rules, nitro prerender, incremental static regeneration."
publishedAt: 2026-07-19
modifiedAt: 2026-07-19
category: tech
i18nKey: tech-007-2026-07
tags: [nuxt3, ssg, static-generation, prerender, web-performance]
readingTime: 8
author: Roibase
---

Il motore di static site generation (SSG) di Nuxt 3, Nitro, rappresenta la prima soluzione production-grade nell'ecosistema Vue che combina ISR (Incremental Static Regeneration) e controllo del prerender a livello di route. Nel 2026, sebbene alcuni affermassero che l'SSG fosse obsoleto con la diffusione delle piattaforme edge, in realtà le strategie di rendering ibride (SSG + ISR on-demand) si sono rivelate il modo più cost-effective per ottimizzare i Core Web Vitals. L'API `routeRules` di Nuxt 3 consente di gestire questa architettura ibrida in un unico file di configurazione.

## Strategia di Rendering a Livello di Route

In Nuxt 3, la modalità di rendering non viene più determinata a livello di applicazione, bensì a livello di singola route. All'interno di `nuxt.config.ts` è possibile definire una strategia distinta per ogni route:

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
    '/blog/**': { swr: 3600 },
    '/api/**': { cors: true, headers: { 'cache-control': 's-maxage=0' } },
    '/admin/**': { ssr: false },
    '/product/**': { isr: 60 }
  }
})
```

Questa struttura offre i seguenti vantaggi: le pagine statiche (landing page, archivi blog) vengono generate al momento della build, mentre il contenuto dinamico (pagine prodotto) viene prerenderizzato on-demand. Per la route `/blog/**`, l'impostazione `swr: 3600` garantisce che la pagina venga servita dalla CDN per 1 ora con strategia stale-while-revalidate — l'utente visualizza la versione in cache mentre la revalidazione viene attivata in background.

### Decisione tra ISR e SWR

ISR (Incremental Static Regeneration) e SWR (Stale-While-Revalidate) vengono spesso confusi. L'ISR genera pagine on-demand dopo la build, le memorizza in cache e le rinfresca dopo un periodo specificato. SWR è invece un header di cache HTTP — mostra la versione precedente mentre esegue l'aggiornamento in background.

**Scegli ISR:** Per pagine ad alto traffico che si aggiornano raramente, come cataloghi prodotti o contenuti CMS. `isr: 60` = revalidazione ogni 60 secondi.

**Scegli SWR:** Per contenuti dove l'aggiornamento immediato non è critico, come articoli blog o documentazione. `swr: 3600` = cache CDN di 1 ora + revalidazione in background.

Nei progetti Roibase, abbiamo ridotto il tempo di build del 73% con ISR (da 12 minuti a 3.2 minuti). Su un sito di e-commerce con 15.000 pagine prodotto, abbiamo prerenderizzato le prime 500 pagine al momento della build e generato le rimanenti on-demand con ISR.

## Crawler Prerender di Nitro

Il motore di prerender di Nuxt 3, Nitro, scansiona automaticamente i link interni generando le pagine correlate al momento della build. Tuttavia, controllare il comportamento di questo crawler è critico per le prestazioni:

```typescript
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true,
      ignore: ['/admin', '/api'],
      routes: ['/sitemap.xml', '/rss.xml']
    }
  }
})
```

L'impostazione `crawlLinks: true` presenta un rischio: ogni tag `<a>` nella pagina viene visitato, potendo causare il prerender di route indesiderate. Ad esempio, i link ai social media nel footer potrebbero essere visitati dal crawler anche se esterni.

### Whitelist di Route per Prerender

Per prerenderizzare solo route specifiche in production, utilizza l'array `routes`:

```typescript
nitro: {
  prerender: {
    crawlLinks: false,
    routes: async () => {
      const { data: posts } = await $fetch('/api/posts')
      return posts.map(p => `/blog/${p.slug}`)
    }
  }
}
```

Questo pattern consente il controllo del prerender basato su fetch. Estrai l'elenco delle route dal tuo CMS e genera solo quelle. Su un progetto di e-commerce headless con 8.000 pagine, questo approccio ha ridotto il tempo di build da 18 minuti a 4.5 minuti.

## Bundle Splitting e Code Elimination

Anche quando non si utilizza la modalità SSG, il bundle JavaScript contiene tutti i component. Con il code splitting a livello di route è possibile ottimizzare:

```typescript
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true
  },
  router: {
    options: {
      hashMode: false,
      scrollBehaviorType: 'smooth'
    }
  }
})
```

L'impostazione `payloadExtraction: true` estrae il payload dei dati delle pagine prerenderizzate in file JSON separati. In questo modo, durante le transizioni di pagina viene caricato solo il diff, riducendo il bundle di caricamento iniziale del 40%.

### Tree Shaking per Pulizia del Codice Non Utilizzato

Nuxt 3 utilizza auto-import, ma questo può causare l'inclusione di component non utilizzati nel bundle. Con `components: { dirs: [] }` disattiva la scansione automatica e importa manualmente solo i component necessari:

```typescript
export default defineNuxtConfig({
  components: false,
  imports: {
    dirs: ['composables']
  }
})
```

Questo approccio radicale ha ridotto le dimensioni del bundle del 28% (da 340KB a 245KB gzip). Il compromesso: l'esperienza dello sviluppatore diminuisce poiché ogni component deve essere importato manualmente. Approccio ibrido: auto-importa i component nella cartella `/components/global`, gestisci manualmente gli altri.

## Strategie di Hydration

Il costo maggiore dell'SSG è l'hydration — la creazione dell'istanza Vue lato client aggiunge 200-400ms di TBT (Total Blocking Time). L'impostazione `ssr: false` di Nuxt 3 la disattiva completamente, ma comporta perdita di SEO.

```vue
<template>
  <div>
    <ClientOnly>
      <HeavyInteractiveWidget />
    </ClientOnly>
    <StaticContent />
  </div>
</template>
```

Il component `<ClientOnly>` renderizza solo lato client la sezione che lo racchiude. Nell'HTML generato con SSG, questa sezione rimane come placeholder, e Vue la ignora durante l'hydration. Con questo pattern, su una landing page con dashboard analytics, abbiamo ridotto il TBT da 420ms a 180ms.

### Selective Hydration

Con Nuxt 3.8+, il component `nuxt-island` fornisce partial hydration:

```vue
<template>
  <NuxtIsland name="ProductCard" :props="{ id: 123 }" />
</template>
```

`NuxtIsland` viene renderizzato lato server e inviato al client come HTML, con l'hydration che avviene solo per questo component. Il resto della pagina rimane statico. Su un sito di e-commerce, abbiamo spostato le schede prodotto come island, riducendo il costo di hydration del 64% (TBT da 380ms a 135ms).

## Ottimizzazione delle Prestazioni di Build

Quando la build SSG supera le 15.000+ pagine e i 20 minuti, la pipeline CI/CD rimane in stato stale. Ci sono 3 modi per aumentare le prestazioni di build di Nuxt 3:

**1. Prerender Parallelo:**
```typescript
nitro: {
  prerender: {
    concurrency: 20,
    interval: 0
  }
}
```
`concurrency: 20` renderizza 20 route contemporaneamente. Tuttavia, esiste il rischio di memory leak — funziona senza problemi con 32GB di RAM, ma su server CI/CD con 8GB potresti ricevere errori OOM (Out of Memory); esegui test sul tuo server production.

**2. Incremental Build (Sperimentale):**
```typescript
experimental: {
  buildCache: true
}
```
Legge le route non modificate dalla cache. Tuttavia, a partire da Nuxt 3.12 è ancora in beta — l'invalidazione della cache potrebbe funzionare in modo errato.

**3. Route Chunking:**
Dividi le route in batch ed esegui la build con job paralleli:

```bash
# Pipeline CI/CD
nuxt build --prerender-routes="/,/about"
nuxt build --prerender-routes="/blog/**" --append
nuxt build --prerender-routes="/product/**" --append
```

Con questo approccio, abbiamo suddiviso la build di 18 minuti in 3 job paralleli, riducendo il tempo totale a 6.5 minuti.

## Considerazioni per Edge Deployment

Quando distribuisci l'SSG su Cloudflare Pages, Vercel Edge o Netlify, presta attenzione ai seguenti punti:

**Cloudflare Pages:** L'impostazione `nitro.preset: 'cloudflare-pages'` è obbligatoria. ISR non è supportato, solo SWR funziona. Il file `_headers` consente di configurare manualmente cache-control.

**Vercel:** ISR è supportato nativamente, ma `vercel.json` può sovrascrivere le route-rule — rischio di conflitto di config. Utilizza la config di Nuxt come single source of truth.

**Netlify:** I file `_redirects` e `_headers` vengono generati automaticamente, ma SWR richiede configurazione manuale in `netlify.toml`.

Nei progetti [Headless Commerce](https://www.roibase.com.tr/it/headless) di Roibase, distribuiamo i storefront generati con Nuxt 3 SSG su Cloudflare Pages. Combinando edge caching + ISR, il TTFB (Time to First Byte) scende sotto i 40ms, con LCP (Largest Contentful Paint) intorno a 1.2s.

---

Utilizzare strategicamente Nuxt 3 SSG significa selezionare la giusta modalità di rendering per ogni route. Combinando prerender in fase di build, ISR on-demand e SWR è possibile ottimizzare sia i Core Web Vitals che ridurre i costi di build. Rivedi le tue strategie di hydration — ridurre il carico di JavaScript lato client rappresenta il 60% dei guadagni di prestazione.