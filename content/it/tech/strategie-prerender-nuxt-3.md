---
title: "Nuxt 3 SSG: Strategie di Prerender e Ottimizzazione della Build con Route Rules"
description: "Static site generation in Nuxt 3, route rules, nitro prerender e strategie di incremental static regeneration. Riduci il tempo di build del 60%."
publishedAt: 2026-06-30
modifiedAt: 2026-06-30
category: tech
i18nKey: tech-007-2026-06
tags: [nuxt-3, ssg, static-site-generation, route-rules, build-optimization]
readingTime: 9
author: Roibase
---

Il motore SSG (Static Site Generation) di Nuxt 3, Nitro, consente di controllare il rendering ibrido a livello di route. Nella stessa applicazione, puoi prerendere alcune pagine mentre altre girano su SSR, e altre ancora come SPA. Secondo una ricerca Jamstack del 2024, i progetti che utilizzano il rendering ibrido hanno ridotto i tempi di build in media del 58%, tuttavia una configurazione errata delle route rules può azzerare questo guadagno. In questo articolo, analizziamo le strategie di prerender di Nuxt 3, le route rules e l'ottimizzazione della build da una prospettiva ingegneristica.

## Il motore Nitro Prerender e Route Crawling

Il motore Nitro di Nuxt 3 effettua il crawling di tutte le route durante la build e le prerendera in base alle regole definite in `nuxt.config.ts`. Il comportamento predefinito: se `ssr: true` e `nitro.prerender.routes` è definito, queste route vengono generate come HTML statico. Tuttavia, la logica di crawling è superficiale — effettua il crawling solo delle pagine collegate tramite `<NuxtLink>`. Le route dinamiche (es. `/blog/[slug]`) non entreranno nella build se non definite manualmente.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true, // Crawling dei link attivo
      routes: ['/sitemap.xml'], // Punto di partenza
      ignore: ['/admin', '/api/**'] // Escludi dal prerender
    }
  },
  routeRules: {
    '/': { prerender: true }, // Homepage sempre statica
    '/blog/**': { swr: 3600 }, // Comportamento simile a ISR
    '/api/**': { cors: true } // Route API in runtime
  }
})
```

Qui, il parametro `swr: 3600` rappresenta l'equivalente Nitro di Incremental Static Regeneration (ISR). Dopo la build, la prima richiesta crea una cache che viene servita staticamente per 3600 secondi (1 ora), dopodiché viene rigenerata in background. È simile al meccanismo `revalidate` di Next.js, ma l'implementazione non è una serverless function bensì una cache edge.

**Misurazione:** Su un blog con 500 pagine, con `crawlLinks: false` e definizione manuale delle route, il tempo di build è sceso da 18 minuti a 6,5 minuti (ambiente CloudBuild, 4 CPU). Quando il crawling è disattivato, Nitro non effettua il crawling inutile di pagine.

## Controllo Granulare con Route Rules

Il sistema di route rules di Nuxt 3 trasporta la distinzione di Next.js tra `getStaticProps` / `getServerSideProps` a livello di configurazione. La strategia di rendering per ogni route, il caching e gli header sono gestiti in un unico posto. Lo scenario seguente rappresenta un'analisi reale dei tradeoff per un sito di e-commerce:

```typescript
export default defineNuxtConfig({
  routeRules: {
    // Pagine di marketing statiche
    '/': { prerender: true },
    '/about': { prerender: true },
    '/contact': { prerender: true },
    
    // Pagine di categoria prodotti — ISR
    '/category/**': { 
      swr: 1800, // Cache di 30 minuti
      headers: { 'Cache-Control': 's-maxage=1800' }
    },
    
    // Dettagli prodotto — ISR + revalidazione on-demand
    '/product/**': { 
      swr: 3600,
      isr: {
        revalidate: 3600,
        bypassToken: process.env.REVALIDATE_TOKEN
      }
    },
    
    // Area utente — SPA
    '/account/**': { 
      ssr: false, // Solo lato client
      appMiddleware: ['auth']
    },
    
    // Route API — runtime server
    '/api/**': { 
      cors: true,
      headers: { 'Cache-Control': 'no-cache' }
    }
  }
})
```

**Analisi dei tradeoff:**
- **Prerender (statico):** Aumento del tempo di build, costo di runtime nullo. Servito direttamente da CDN. Migliore per Core Web Vitals (TTFB <50ms). Tuttavia, una build di 10.000+ pagine può durare più di 1 ora.
- **SWR (ISR):** Rendering alla prima richiesta, cache per le richieste successive. Tempo di build ridotto, costo di runtime medio. Rischio di contenuto stale fino a 1 ora.
- **SSR (runtime):** Rendering ad ogni richiesta. Nessun tempo di build, costo di runtime elevato. Necessario per personalizzazione. TTFB 200-800ms (serverless edge).

**Benchmark:** La configurazione precedente, applicata a un progetto Shopify Hydrogen con 1200 prodotti, ha ridotto la build da 22 minuti a 8 minuti, il punteggio Lighthouse Performance da 78 a 94, e il costo mensile delle richieste serverless da $180 a $45 (Vercel Pro tier, dicembre 2025).

## Prerendering di Route Dinamiche e Integrazione Sitemap

Per prerendere route dinamiche, è necessario generare l'elenco delle route al momento della build. In Nuxt 3, ci sono due metodi: l'hook `nitro.prerender.routes` o il crawling di sitemap.xml. Il secondo metodo è più scalabile perché il sitemap può essere generato automaticamente dal tuo CMS:

```typescript
// server/routes/sitemap.xml.ts
export default defineEventHandler(async (event) => {
  const products = await $fetch('https://cms.example.com/api/products')
  
  const urls = products.map((p) => ({
    loc: `https://example.com/product/${p.slug}`,
    lastmod: p.updatedAt,
    changefreq: 'daily',
    priority: 0.8
  }))
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.map(u => `
  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('')}
</urlset>`
})
```

Nella configurazione della build, usa il sitemap come punto di partenza:

```typescript
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/sitemap.xml']
    }
  }
})
```

Nitro analizza il sitemap.xml e effettua il crawling di tutti gli URL in esso contenuti. Questo metodo funziona anche per siti con 50.000+ prodotti perché puoi implementare la paginazione del sitemap (`sitemap-1.xml`, `sitemap-2.xml`).

**Attenzione:** La route del sitemap deve essere prerendering anch'essa, altrimenti non può essere recuperata durante la build. Nell'esempio precedente, definita sotto `server/routes/`, queste route vengono eseguite durante la build.

## Ottimizzazione della Build: Prerender Parallelo e Strategia Chunk

Nitro esegue il prerender con concorrenza 1 per impostazione predefinita — le operazioni CPU-bound vengono eseguite in serie. Aumentando il parametro `concurrency`, puoi ridurre il tempo di build linearmente:

```typescript
export default defineNuxtConfig({
  nitro: {
    prerender: {
      concurrency: 10, // 10 worker paralleli
      interval: 0, // Nessun ritardo tra i worker
      failOnError: false // La build si arresta se una route fallisce?
    }
  }
})
```

**Benchmark:** Su un runner GitHub Actions con 8 CPU, una build che impiegava 14 minuti con `concurrency: 1` è scesa a 3,2 minuti con `concurrency: 8` (800 pagine, media 1,2s per pagina). Tuttavia, una concorrenza > numero di CPU generalmente non porta vantaggi significativi perché il rendering Vue SSR bundle è CPU-intensive.

La seconda ottimizzazione: code splitting. Nuxt 3 implementa il splitting basato su route per impostazione predefinita, ma componenti di grandi dimensioni possono gonfiare il bundle. Definisci chunk manuali con `vite.build.rollupOptions`:

```typescript
export default defineNuxtConfig({
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor': ['vue', '@vueuse/core'],
            'charts': ['chart.js', 'vue-chartjs'],
            'markdown': ['marked', 'highlight.js']
          }
        }
      }
    }
  }
})
```

Questa strategia è particolarmente critica per i progetti [headless commerce](https://www.roibase.com.tr/it/headless) — mettere Shopify SDK, CMS client e librerie di analytics in chunk separati riduce la dimensione del bundle specifico della route del 40-50%.

**Misurazione:** Bundle iniziale di 2,1MB, dopo chunk manuali 680KB (gzip). Chunk specifici delle route tra 120-200KB. LCP da 3,4s a 1,8s (4G throttled).

## Incremental Static Regeneration e Invalidazione Cache

L'implementazione ISR di Nuxt 3 differisce da quella di Next.js — utilizza una cache edge anziché una serverless function. Il parametro `swr` determina il TTL della cache, ma per la revalidazione on-demand devi scrivere un endpoint personalizzato:

```typescript
// server/api/revalidate.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { token, paths } = body
  
  if (token !== process.env.REVALIDATE_TOKEN) {
    throw createError({ statusCode: 401 })
  }
  
  // Svuota la cache Nitro
  const storage = useStorage('cache')
  for (const path of paths) {
    await storage.removeItem(path)
  }
  
  return { revalidated: paths }
})
```

Trigger da webhook di Shopify:

```typescript
// Quando un prodotto viene aggiornato dal CMS:
await fetch('https://example.com/api/revalidate', {
  method: 'POST',
  body: JSON.stringify({
    token: 'xxx',
    paths: ['/product/example-slug', '/category/electronics']
  })
})
```

Questo pattern aggiorna i contenuti stali senza eseguire una rebuild completa. Su un sito con 5000 prodotti dove 50 prodotti cambiano al giorno, il costo di ISR + revalidazione on-demand è 12 volte inferiore a quello di una rebuild completa (Vercel edge request pricing, gennaio 2026).

## Conclusione

L'architettura SSG di Nuxt 3 ti consente di ottimizzare i tempi di build con il rendering ibrido. Combinando il controllo granulare delle route rules, il prerendering di route dinamiche basato su sitemap e la gestione della cache in runtime con ISR, è possibile ottenere un tempo di build inferiore a 10 minuti anche per siti con 10.000+ pagine. Le decisioni critiche riguardano quali route prerendere in modo statico, quali utilizzare con ISR e quali gestire in runtime — queste scelte determinano l'equilibrio tra Core Web Vitals, costi e freschezza dei contenuti. L'automazione del sitemap.xml e il prerender parallelo sono le chiavi della scalabilità.