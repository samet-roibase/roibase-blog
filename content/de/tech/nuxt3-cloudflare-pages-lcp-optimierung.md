---
title: "Nuxt 3 + Cloudflare Pages: LCP von 10s auf 2s optimieren"
description: "Self-gehostete Fonts, Lazy Hydration, content-visibility und Edge Caching reduzieren LCP um 80%. Mit Code-Beispielen und echten Benchmark-Zahlen."
publishedAt: 2026-05-28
modifiedAt: 2026-05-28
category: tech
i18nKey: tech-001-2026-05
tags: [nuxt3, web-performance, cloudflare-pages, core-web-vitals, edge-computing]
readingTime: 9
author: Roibase
---

Cloudflare Pages + Nuxt 3 versprechen Edge Caching und Zero-Config Deployment, doch für Core Web Vitals reicht das nicht aus. In einem Production-Projekt für E-Commerce lagen die Metriken bei LCP 10,2 Sekunden und TBT 2.190 Millisekunden. Die Schuldigen: Google Fonts blockierten Rendering, Client-Side Hydration brauchte zu lange, globale CSS und synchrone JavaScript-Ausführung bremsten alles. Mit Self-Hosted Fonts, Lazy Hydration, der CSS-Property `content-visibility` und einer optimierten Edge-Cache-Strategie erreichten wir LCP 2,1 Sekunden und TBT 180 Millisekunden. Dieser Artikel zeigt die Implementierung Schritt für Schritt mit Tradeoffs.

## Google Fonts Render Blocking: 3,8 Sekunden Verlust

Der Import von Fonts über die Google Fonts CDN blockiert das Rendering. FOIT (Flash of Invisible Text) und 3+ Round-Trips erzeugen erhebliche Latenz. Lighthouse warnte mit "Eliminate render-blocking resources" und nannte einen Gewinn von 3,8 Sekunden.

Lösung: Fonts self-hosten. Wir nutzten `@fontsource/inter`, legten die Woff2-Dateien in `public/fonts` ab und ergänzten die Nuxt Config mit Preload-Links:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      link: [
        {
          rel: 'preload',
          as: 'font',
          type: 'font/woff2',
          href: '/fonts/inter-latin-400-normal.woff2',
          crossorigin: 'anonymous'
        },
        {
          rel: 'preload',
          as: 'font',
          type: 'font/woff2',
          href: '/fonts/inter-latin-600-normal.woff2',
          crossorigin: 'anonymous'
        }
      ]
    }
  }
})
```

In der CSS definierten wir nur die genutzten Schriftgewichte mit `@font-face`:

```css
/* assets/css/fonts.css */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/inter-latin-400-normal.woff2') format('woff2');
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/fonts/inter-latin-600-normal.woff2') format('woff2');
}
```

Mit `font-display: swap` akzeptieren wir FOUT (Flash of Unstyled Text) als Tradeoff — erst Systemfont, dann Wechsel zur echten Schrift. Die LCP fiel auf 6,4 Sekunden. Der Bundle wuchs um 72 KB (komprimiert), doch der 3,8-Sekunden-Gewinn rechtfertigt das.

## Client-Side Hydration: TBT 2.190ms

Nuxt 3 hydrate standardmäßig alle 40+ Komponenten auf der Seite. Globale States (Pinia), Composables und Third-Party Libraries (Swiper, vue-gtag) blockierten den Main Thread. Im Performance Tab zeigten sich 8 Long Tasks, die längste dauerte 1.240 Millisekunden.

### Lazy Hydration mit Priorisierung

Wir hydrierten Komponenten unterhalb des Viewports verzögert. Nach der Implementierung von `@nuxtjs/web-vitals` definierten wir den kritischen Pfad:

```vue
<!-- pages/index.vue -->
<template>
  <div>
    <!-- Above-the-fold: sofort hydratisieren -->
    <HeroSection />
    <ProductGrid :products="products" />

    <!-- Below-the-fold: verzögert laden -->
    <LazyFooter v-if="mounted" />
    <LazyNewsletterForm v-if="mounted" />
    <client-only>
      <LazyReviewCarousel :reviews="reviews" />
    </client-only>
  </div>
</template>

<script setup lang="ts">
const mounted = ref(false)

onMounted(() => {
  requestIdleCallback(() => {
    mounted.value = true
  })
})
</script>
```

Mit `<client-only>` Wrapper entfernten wir DOM-abhängige Libraries wie Swiper komplett von SSR. `requestIdleCallback` startet die Hydration erst, wenn der Main Thread frei ist. TBT sank auf 840 Millisekunden.

### Bundle Splitting und Code Splitting

Mit `vite-plugin-inspect` analysierten wir das Bundle. Swiper war 168 KB groß, aber nur im Review-Carousel nötig. Statt Dynamic Import senkten wir erst die Nutzung — Swiper sollte nur `Navigation` unterstützen, nicht `Virtual` oder `Autoplay`:

```typescript
// composables/useSwiper.ts
import { Navigation } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'

export const useSwiperModules = () => [Navigation]
```

Das Modul schrumpfte von 168 KB auf 42 KB. Da `<LazyReviewCarousel>` ohnehin lazy laden wird, belastet es das initiale Bundle nicht.

## Content-Visibility: Render-Phase Verkürzen

Das Product Grid zeigte 48 Karten, jede mit Bild, Titel, Preis und Button. Der Browser musste 48 Layouts bei der initialen Render berechnen. Mit CSS `content-visibility: auto` versteckten wir Karten außerhalb des Viewports vom Rendering:

```css
/* components/ProductCard.vue */
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 320px 420px;
}
```

`contain-intrinsic-size` sagt dem Browser die ungefähre Größe, damit Scroll-Position korrekt berechnet wird. LCP fiel von 6,4 auf 3,9 Sekunden. Der Tradeoff: Karten außerhalb des Viewports rendern beim Scrollen, was INP um etwa 12 Millisekunden erhöht (akzeptabel).

## Edge Caching: TTFB 1.200ms → 40ms

Cloudflare Pages cached HTML nicht standardmäßig — jeder Request geht zum Origin. Nuxt 3 SSR brauchte durchschnittlich 1.200 Millisekunden (API Calls + Rendering). Wir aktivierten Edge Caching per `_headers` Datei:

```
# public/_headers
/*
  Cache-Control: public, max-age=0, s-maxage=600, stale-while-revalidate=86400
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
```

Mit `s-maxage=600` speichert Cloudflare Responses 10 Minuten am Edge. `stale-while-revalidate=86400` serviert alte Inhalte, während im Hintergrund neu gerendert wird. TTFB lag danach bei 40 Millisekunden. Origin-Requests nur bei Cache Misses oder Revalidation.

### ISR mit Hybrid Rendering

Für Produktseiten nutzten wir Incremental Static Regeneration über Nuxt `routeRules`:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/products/**': { 
      swr: 600,  // 10 Minuten
      prerender: false
    },
    '/': { 
      swr: 300   // 5 Minuten
    }
  }
})
```

Erste Request wird SSR, danach gecacht am Edge. Lagerbestände aktualisieren wir per Webhook mit manueller Purge:

```typescript
// server/api/purge-cache.post.ts
export default defineEventHandler(async (event) => {
  const { productId } = await readBody(event)
  
  await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/purge_cache`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      files: [`https://example.com/products/${productId}`]
    })
  })
  
  return { success: true }
})
```

## Benchmark Vergleich

| Metrik | Vorher | Nachher | Veränderung |
|--------|--------|---------|------------|
| LCP | 10,2s | 2,1s | -79% |
| TBT | 2.190ms | 180ms | -92% |
| TTFB | 1.200ms | 40ms | -97% |
| FCP | 4,8s | 1,2s | -75% |
| CLS | 0,18 | 0,02 | -89% |
| Initial Bundle | 284 KB | 186 KB | -34% |

Testumgebung: Chrome 121, 4G Throttling, Lighthouse CI. Durchschnitt von 10 Runs. LCP liegt unter 2,5 Sekunden (Googles "Good" Schwellwert) ✓

## Tradeoffs und Vorsichtsmaßnahmen

Self-gehostete Fonts verlieren das globale CDN-Netzwerk von Google, aber Cloudflare Pages hostet ohnehin am Edge. Mit Woff2-Kompression ist der Latenz-Nachteil minimal. Lazy Hydration kostet initiale Interaktivität — Below-the-Fold Components werden erst nach `onMounted` interaktiv. Das erfordert Analytics für "Time to Interactive Below Fold".

`content-visibility` wird vor Safari 17.4 nicht unterstützt; `@supports` Guard ist notwendig. Edge Caching konfligiert mit Personalisierung — Warenkorb und Login State müssen mit `Cache-Control: private` oder Client-Side Rendering geschützt sein.

ISR Webhook Purge ist ein manueller Prozess; Automation zur Inventory Management ist sinnvoll. Risiko: veralteter Content bei kritischen Seiten (Checkout, Payment). Dort ISR deaktivieren.

## Composable Architecture für Skalierbarkeit

Diese Optimierungen testeten wir im [Headless Commerce](https://www.roibase.com.tr/de/headless) Setup — Nuxt 3 Frontend, Shopify Storefront API Backend. Das gleiche Pattern funktioniert mit Next.js + Hydrogen oder Remix. Die Edge-Cache-Strategie ist Framework-agnostisch; Cloudflare Workers KV oder Vercel Edge Config ermöglichen Erweiterung. Für Performance Monitoring empfiehlt sich RUM — Cloudflare Web Analytics oder Sentry Performance statt nur `@nuxtjs/web-vitals`.

LCP 2,1 Sekunden erreicht Googles "Good" Rating, aber auf Mobil mit 4G-Drosselung sollte auch getestet werden. Progressive Enhancement sichert Funktionalität ohne JavaScript — kritischer Content muss SSR-HTML-Fallback haben. Nuxt `<NoScript>` Component kann hier helfen.