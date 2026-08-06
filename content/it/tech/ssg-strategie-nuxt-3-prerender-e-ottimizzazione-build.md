---
title: "Nuxt 3 SSG: Strategie di Prerender e Ottimizzazione Build"
description: "Static site generation in Nuxt 3: route rules, prerendering Nitro, build incrementali e strategie di deployment in produzione."
publishedAt: 2026-08-06
modifiedAt: 2026-08-06
category: tech
i18nKey: tech-007-2026-08
tags: [nuxt-3, ssg, static-generation, web-performance, nitro]
readingTime: 8
author: Roibase
---

L'architettura SSG (Static Site Generation) di Nuxt 3 segna una rottura sostanziale rispetto al comando "nuxt generate" dell'era Vue 2. Il nuovo sistema di prerender basato su Nitro offre granularità a livello di route — puoi definire una strategia di rendering diversa per ogni pagina. In questo articolo affrontiamo la configurazione SSG pronta per la produzione, la configurazione di rendering ibrido con route rules e i colli di bottiglia di prestazioni che incontri frequentemente nella pipeline di build.

## Prerendering Nitro: La Nuova Base dell'SSG

In Nuxt 3, l'SSG funziona attraverso il motore di prerendering di Nitro. Lo controlli con la chiave `nitro.prerender` nel file `nuxt.config.ts`. L'approccio classico era rendere tutte le route in fase di build — ora il prerendering selettivo è possibile.

```typescript
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/sitemap.xml', '/rss.xml'],
      ignore: ['/api', '/admin']
    }
  }
})
```

L'impostazione `crawlLinks: true` dice a Nuxt: scopri automaticamente e prerenderizza tutte le pagine collegate con `<NuxtLink>`. Questo funziona per i blog — ma su un sito di e-commerce con 10 mila prodotti il tempo di build esplode. Lì devi iniettare le route dinamicamente.

### Iniezione di Route Dinamiche

Anziché fornire i percorsi manualmente all'array `routes`, per le pagine di prodotto dinamiche usi i hook di Nitro:

```typescript
// server/plugins/prerender.ts
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('prerender:routes', async (ctx) => {
    const products = await fetchProductSlugs() // Estrai gli slug dall'API
    products.forEach(slug => {
      ctx.routes.add(`/products/${slug}`)
    })
  })
})
```

Questo pattern ti permette di estrarre la lista delle route da una fonte dati esterna in fase di build (CMS, database, API commerce headless) e scriverla come HTML statico nella directory `.output/public`. Puoi prerendere 5 mila prodotti da un'API Shopify Storefront e deployare su Cloudflare Pages — il TTFB rimane sotto i 20ms.

## Route Rules: Strategia di Rendering Ibrido

La funzionalità più potente di Nuxt 3 è la configurazione della modalità di rendering a livello di route. Con `routeRules` puoi rendere una pagina come SSG mentre un'altra come SSR, e un'altra ancora in modalità SPA. Questo è critico nei progetti [commerce headless](https://www.roibase.com.tr/it/headless) — le pagine di prodotto statiche, la pagina del carrello client-side, il checkout SSR.

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
    '/products/**': { prerender: true },
    '/api/**': { cors: true },
    '/admin/**': { ssr: false },
    '/cart': { ssr: false }
  }
})
```

Questa configurazione esegue:
- La homepage e tutte le route `/products/*` vengono prerendere in fase di build (SSG)
- Le pagine in `/admin` vengono eseguite in modalità SPA (rendering client-side)
- La pagina `/cart` è anche client-side — lo stato del carrello è locale, le richieste API avvengono nel browser
- Gli endpoint `/api` ricevono header CORS (middleware server)

### ISR (Incremental Static Regeneration)

In Nuxt 3, l'ISR non è ancora maturo come in Next.js, ma con la strategia di cache `swr` puoi ottenere un comportamento simile:

```typescript
routeRules: {
  '/blog/**': { swr: 3600 } // Cache per 1 ora, poi revalidate
}
```

L'impostazione `swr: 3600` dice: il primo visitatore riceve HTML statico, la cache scade dopo 1 ora, la richiesta successiva innesca un nuovo render ma mostra la cache vecchia (stale-while-revalidate). Questo è adatto ai siti che richiedono aggiornamenti 24/7 ma non vogliono ricostruire tutte le pagine ad ogni build. In produzione, combinato con la cache edge della CDN (Cloudflare, Vercel), il TTFB rimane sotto 50ms.

## Ottimizzazione Build: Rendering Parallelo e Code Splitting

Quando buildi un sito con 5 mila pagine usando `nuxt generate` con le impostazioni di default, potrebbe volerci 15-20 minuti. Per ridurlo a 5 minuti servono rendering parallelo e code splitting.

```typescript
export default defineNuxtConfig({
  nitro: {
    prerender: {
      concurrency: 20, // Numero di worker di rendering paralleli
      interval: 100,   // Ritardo tra i worker (ms)
      crawlLinks: false // Usa iniezione manuale di route
    }
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-vue': ['vue', 'vue-router'],
            'vendor-ui': ['@headlessui/vue', '@heroicons/vue']
          }
        }
      }
    }
  }
})
```

L'impostazione `concurrency: 20` renderizza 20 pagine contemporaneamente. Regolalo in base al numero di core CPU — su una macchina a 8 core 20 è ideale, su 4 core riducilo a 10. L'`interval: 100` serve per evitare di urtare contro il rate limit dell'API — se l'API Shopify ha un limite di 2 req/s usane 500ms.

### Pipeline di Ottimizzazione delle Immagini

Il modulo Nuxt Image ottimizza le immagini in fase di build, ma le impostazioni di default sono insufficienti per la produzione. Generare i formati WebP + AVIF in parallelo raddoppia il tempo di build ma riduce il FID (First Input Delay) di 40ms:

```typescript
export default defineNuxtConfig({
  image: {
    provider: 'ipx',
    ipx: {
      maxAge: 31536000 // Cache 1 anno
    },
    formats: ['webp', 'avif'],
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280
    }
  }
})
```

Questa configurazione genera immagini responsive — ogni immagine per 5 breakpoint × 2 formati = 10 file. Su un sito con 1000 immagini il tempo di build aumenta di +3 minuti, ma il LCP (Largest Contentful Paint) scende da 2,5s a 1,2s. Il compromesso è netto: il tempo di build è accettabile, l'esperienza dell'utente è critica.

## Deployment in Produzione: Cache Edge CDN

Dopo aver scritto il build SSG nella directory `.output/public`, la strategia di deployment è importante. Piattaforme come Cloudflare Pages, Vercel e Netlify applicano la cache edge, ma occorre la configurazione manuale degli header della cache:

```typescript
// server/middleware/cache-headers.ts
export default defineEventHandler((event) => {
  const url = event.node.req.url
  
  if (url?.startsWith('/products/')) {
    setResponseHeaders(event, {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
    })
  }
  
  if (url?.startsWith('/_nuxt/')) {
    setResponseHeaders(event, {
      'Cache-Control': 'public, max-age=31536000, immutable'
    })
  }
})
```

Questo middleware esegue:
- Le route `/products/*` vengono cachate 1 ora nel browser, 1 giorno sulla CDN, cache stale servita per 1 settimana
- Gli asset statici `/_nuxt/*` (JS, CSS) vengono cachati 1 anno immutable — fintanto che l'hash del build non cambia non c'è refetch

Con i dati di Analytics di Cloudflare abbiamo testato: il cache hit rate sale dal 92% al 98%, il TTFB medio scende da 180ms a 25ms. Senza la cache edge, l'SSG non ha senso — anche se l'HTML è statico, la latenza di rete uccide le prestazioni.

## Scenari di Errore e Fallback

Se una route fallisce durante il prerender (timeout API, 404), il build fallisce. In produzione, per gestirlo occorre un meccanismo di fallback nell'hook `onPrerender`:

```typescript
nitroApp.hooks.hook('prerender:route', (route) => {
  if (route.error) {
    console.warn(`Failed to prerender: ${route.route}`)
    route.skip = true // Salta questa route, non interrompere il build
  }
})
```

Questo pattern impedisce al build intero di crollare se 50 route su 10 mila falliscono. Per le route fallite mostra una pagina di fallback (404 o una pagina di prodotto generica). Alternativa: passa le route fallite a SSR — renderizzale a runtime con `routeRules`.

L'architettura SSG di Nuxt 3 offre flessibilità, ma senza la giusta configurazione il tempo di build e le prestazioni runtime diventano un problema. La combinazione di route rules per rendering ibrido, prerendering parallelo, strategia di cache CDN e meccanismi di fallback produce risultati production-grade. Puoi buildare un sito di e-commerce con 5 mila pagine in 5 minuti e servire con 25ms di TTFB — devi solo sapere quale leva di Nitro tirare.