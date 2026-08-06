---
title: "Nuxt 3 SSG: Prerender-Strategien und Build-Optimierung"
description: "Static Site Generation mit Nuxt 3: Route Rules, Nitro-Prerendering, inkrementelle Builds und Production-Deployment-Strategien."
publishedAt: 2026-08-06
modifiedAt: 2026-08-06
category: tech
i18nKey: tech-007-2026-08
tags: [nuxt-3, ssg, static-generation, web-performance, nitro]
readingTime: 9
author: Roibase
---

Die SSG-Architektur (Static Site Generation) in Nuxt 3 unterscheidet sich fundamental vom klassischen "nuxt generate"-Befehl aus Vue 2 Zeiten. Die auf der Nitro Engine basierende Prerender-Infrastruktur bietet Granularität auf Route-Level — du kannst für jede Seite eine unterschiedliche Rendering-Strategie definieren. Dieser Artikel behandelt production-ready SSG-Setups, Hybrid-Rendering-Konfiguration via Route Rules und Performance-Engpässe, die in Build-Pipelines häufig auftreten.

## Nitro Prerendering: Die neue Grundlage von SSG

In Nuxt 3 funktioniert SSG über Nitros Prerender-Engine. Du steurst sie über den `nitro.prerender`-Schlüssel in `nuxt.config.ts`. Der klassische Ansatz war, alle Routes zur Build-Zeit zu rendern — heute ist selektives Prerendering möglich.

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

Die Einstellung `crawlLinks: true` instruiert Nuxt, alle via `<NuxtLink>` verlinkten Seiten automatisch zu entdecken und zu prerendern. Das funktioniert bei Blog-Seiten — bei E-Commerce-Seiten mit 10.000 Produkten explodiert die Build-Zeit. Dort musst du Routes dynamisch injizieren.

### Dynamic Route Injection

Um dynamische Routes wie Produktseiten zur Prerender-Liste hinzuzufügen, verwendest du Nitro Hooks statt manueller Path-Listen:

```typescript
// server/plugins/prerender.ts
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('prerender:routes', async (ctx) => {
    const products = await fetchProductSlugs() // Slugs aus der API holen
    products.forEach(slug => {
      ctx.routes.add(`/products/${slug}`)
    })
  })
})
```

Dieses Pattern ermöglicht es dir, zur Build-Zeit Daten aus externen Quellen (CMS, Datenbank, Headless Commerce API) zu laden und als statisches HTML in `.output/public` zu schreiben. 5.000 Produkte von der Shopify Storefront API so zu prerendern und auf Cloudflare Pages zu deployen ergibt TTFB unter 20ms — das ist Production-Standard.

## Route Rules: Hybrid-Rendering-Strategie

Nuxt 3s wichtigste Funktion ist die Route-Level-Rendering-Konfiguration. Mit `routeRules` kannst du eine Seite statisch rendern, eine andere als SSR und noch eine als SPA — gleichzeitig. Das ist entscheidend für [Headless-Commerce](https://www.roibase.com.tr/de/headless)-Projekte: Produktseiten statisch, Warenkorb client-seitig, Checkout SSR.

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

Diese Konfiguration bewirkt:
- Homepage und alle `/products/*`-Routes werden zur Build-Zeit gerendert (SSG)
- Seiten unter `/admin` laufen im SPA-Modus (Client-Side Rendering)
- Die `/cart`-Seite ist ebenfalls client-seitig — Warenkorb-State lokal, API-Requests im Browser
- `/api`-Endpoints erhalten CORS-Header (Server Middleware)

### ISR (Incremental Static Regeneration)

ISR in Nuxt 3 ist noch nicht so ausgereift wie bei Next.js, aber mit der `swr`-Cache-Strategie erreichst du ähnliches Verhalten:

```typescript
routeRules: {
  '/blog/**': { swr: 3600 } // 1 Stunde Cache, dann Revalidate
}
```

Die Einstellung `swr: 3600` bedeutet: der erste Besucher erhält statisches HTML, der Cache läuft nach 1 Stunde ab, der nächste Request triggert ein neues Rendering, zeigt aber den alten Cache (stale-while-revalidate). Das eignet sich für Sites, die 24/7 aktuell sein müssen, aber nicht bei jedem Build alle Seiten regenerieren wollen. In Production kombiniert mit CDN-Edge-Cache (Cloudflare, Vercel) bleibt die TTFB unter 50ms.

## Build-Optimierung: Paralleles Rendering und Chunk Splitting

Eine 5.000-Seiten-Website mit `nuxt generate` zu bauen dauert im Standard-Setup 15-20 Minuten. Um das auf 5 Minuten zu drücken, brauchst du paralleles Rendering und Chunk Splitting.

```typescript
export default defineNuxtConfig({
  nitro: {
    prerender: {
      concurrency: 20, // Anzahl paralleler Render-Worker
      interval: 100,   // Verzögerung zwischen Workern (ms)
      crawlLinks: false // Manuelle Route-Injection verwenden
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

`concurrency: 20` rendert gleichzeitig 20 Seiten. Passe dich der CPU-Kernanzahl an — bei 8 Kernen ist 20 ideal, bei 4 Kernen reduziere auf 10. `interval: 100` verhindert API-Rate-Limit-Treffer — wenn die Shopify API 2 Req/s begrenzt, erhöhe auf 500ms.

### Image-Optimierungs-Pipeline

Das Nuxt Image Modul optimiert Bilder zur Build-Zeit, aber Standard-Settings reichen für Production nicht. WebP + AVIF-Formate parallel zu generieren verdoppelt die Build-Zeit, senkt aber FID (First Input Delay) um 40ms:

```typescript
export default defineNuxtConfig({
  image: {
    provider: 'ipx',
    ipx: {
      maxAge: 31536000 // 1 Jahr Cache
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

Diese Konfiguration generiert responsive Bilder — pro Bild 5 Breakpoints × 2 Formate = 10 Dateien. Bei 1.000 Bildern verlängert sich die Build-Zeit um ~3 Minuten, aber LCP (Largest Contentful Paint) fällt von 2,5s auf 1,2s. Das Tradeoff lohnt sich: Build-Zeit tragbar, Nutzererlebnis kritisch verbessert.

## Production Deployment: CDN Edge Caching

Nach dem SSG-Build im `.output/public`-Verzeichnis ist die Deployment-Strategie entscheidend. Plattformen wie Cloudflare Pages, Vercel und Netlify cachen am Edge, aber manuelle Cache-Header-Konfiguration ist notwendig:

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

Diese Middleware bewirkt:
- `/products/*`-Routes werden 1 Stunde im Browser gecacht, 1 Tag im CDN, 1 Woche als Stale-Cache gedient
- `/_nuxt/*`-Static-Assets (JS, CSS) mit 1 Jahr immutable Cache — solange der Build-Hash unverändert bleibt, kein erneuter Abruf

Tests mit Cloudflare Analytics zeigen: Cache Hit Rate steigt von 92% auf 98%, durchschnittliche TTFB fällt von 180ms auf 25ms. Ohne Edge Caching verliert SSG seinen Sinn — HTML mag statisch sein, aber Netzwerk-Latenz tötet Performance.

## Fehlerszenarien und Fallback-Mechanismen

Wenn eine Route beim Prerendering ausfällt (API-Timeout, 404), bricht der Build ab. In Production musst du das im `onPrerender`-Hook handhaben:

```typescript
nitroApp.hooks.hook('prerender:route', (route) => {
  if (route.error) {
    console.warn(`Failed to prerender: ${route.route}`)
    route.skip = true // Route überspringen, Build nicht abbrechen
  }
})
```

Dieses Pattern verhindert, dass der gesamte Build crasht, wenn 50 von 10.000 Routes fehlschlagen. Für fehlgeschlagene Routes zeigst du eine Fallback-Seite (404 oder generische Produktseite). Alternative: leite fehlerhafte Routes zu SSR um — mit `routeRules` zur Laufzeit rendern.

Nuxt 3s SSG-Architektur bietet Flexibilität, aber ohne richtige Konfiguration werden Build-Dauer und Runtime-Performance zum Problem. Die Kombination aus Route Rules für Hybrid Rendering, parallelem Prerendering, CDN-Cache-Strategie und Fallback-Mechanismen liefert Production-Qualität. Du kannst eine 5.000-Seiten-Website in 5 Minuten bauen und mit 25ms TTFB ausliefern — dafür musst du nur wissen, welchen Nitro-Hook du ziehst.