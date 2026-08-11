---
title: "Nuxt 3 + Cloudflare Pages: Von 10s LCP zu 2s"
description: "Self-hosted Fonts, Lazy Hydration, CSS content-visibility und Edge Caching für 80% LCP-Reduktion in Produktion. Mit Code-Beispielen und Tradeoff-Analyse."
publishedAt: 2026-08-11
modifiedAt: 2026-08-11
category: tech
i18nKey: tech-001-2026-08
tags: [nuxt3, web-performance, cloudflare-pages, core-web-vitals, edge-caching]
readingTime: 9
author: Roibase
---

2024 verschob sich der Fokus zu INP, aber LCP bleibt die sichtbarste Metrik für User Experience. Als wir einen E-Commerce-Stack mit Nuxt 3 + Cloudflare Pages in Produktion gingen, landeten wir bei LCP 10,2 Sekunden — Mobilgeräte im 3G-Modus. Nach sechswöchiger Optimierung: 2,1 Sekunden bei identischen Bedingungen. Dieser Artikel schlüsselt vier kritische Techniken auf: Self-Hosted-Font-Strategie, Lazy-Hydration-Pattern, CSS `content-visibility` und Edge-Caching-Architektur.

## Self-Hosted Fonts: Von 1,8s externe Request zu 120ms lokalem Serving

Google Fonts von CDN zu laden wirkt intuitiv, kostet aber 3 Round-Trips: DNS, TLS-Handshake, Font-Datei. Durchschnittliche Latenz: 1,8 Sekunden. Wir verschoben die Schrift zu statischen Assets.

**Schritte:**

```bash
# 1. Font herunterladen, in /public/fonts ablegen
# Inter Variable: ~400KB WOFF2

# 2. nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      link: [
        {
          rel: 'preload',
          href: '/fonts/inter-var.woff2',
          as: 'font',
          type: 'font/woff2',
          crossorigin: 'anonymous'
        }
      ]
    }
  }
})
```

**CSS:**

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-display: swap;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}
```

**Tradeoff:** Initial Bundle um 400KB gewachsen, dafür eine externe Abhängigkeit aus dem Critical Path entfernt. Cloudflare CDN serving aus 300+ PoPs, Median TTFB 80ms. `font-display: swap` akzeptiert FOUT (Flash of Unstyled Text) — CLS-Kosten: 0,3%.

**Benchmark:** LCP-Beitrag −1,6s (10,2s → 8,6s).

## Lazy Hydration: 3,2s TBT → 420ms

Nuxt' Standard SSR hydratisiert den gesamten Component Tree im Client. Komponenten wie Product-Listing-Grids, die nicht im initialen Viewport sichtbar sind, verursachen Hydrations-Overhead ohne Nutzen.

**Pattern:** Viewport-Tracking + Dynamic Import.

```vue
<template>
  <div ref="target">
    <ClientOnly v-if="isVisible">
      <HeavyProductGrid :products="products" />
    </ClientOnly>
    <div v-else class="skeleton-grid" />
  </div>
</template>

<script setup lang="ts">
const target = ref<HTMLElement | null>(null)
const isVisible = ref(false)

onMounted(() => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        isVisible.value = true
        observer.disconnect()
      }
    },
    { rootMargin: '50px' }
  )
  
  if (target.value) observer.observe(target.value)
})
</script>
```

**Ergebnis:** Product Grid benötigte 28KB JS Bundle, Hydration 680ms. Drei Grids außerhalb des Above-the-Fold lazy geladen — TBT (Total Blocking Time) 3,2s → 420ms. Lighthouse Performance Score 42 → 78.

**Tradeoff:** Wenn Nutzer scrollt während das Skeleton lädt, 150–200ms Verzögerung sichtbar. CLS-Risiko — Skeleton-Höhe muss mit realem Content übereinstimmen.

### H3: Lazy-Component-Import-Pattern in Nuxt

```ts
// composables/useLazyComponent.ts
export const useLazyComponent = (componentPath: string) => {
  return defineAsyncComponent({
    loader: () => import(`~/components/${componentPath}.vue`),
    loadingComponent: SkeletonLoader,
    delay: 200,
    timeout: 10000
  })
}

// Anwendung:
const ProductGrid = useLazyComponent('ProductGrid')
```

## CSS content-visibility: Rendering-Kosten −60%

Seit Chrome 85 signalisiert `content-visibility: auto` dem Browser: „Dieses Element außerhalb des Viewports nicht rendern". Layout, Paint und Composite verlagern sich auf später.

**Anwendung:**

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 400px; /* geschätzte Höhe */
}
```

**Lighthouse Trace:**
- Before: Render Tree Building 1.240ms (312 Nodes)
- After: 520ms (88 Nodes für initialen Viewport)

**Kritisches Detail:** `contain-intrinsic-size` ist für Scrollbar-Berechnung notwendig. Falscher Wert triggert CLS. Wir kalkulierten Durchschnitt: Card-Höhe 380–420px → 400px gewählt.

**Achtung:** Safari < 17.4 keine Unterstützung — Progressive Enhancement. Kein Fallback nötig, nur Performanz-Gewinn entfällt.

## Edge Caching: Origin Load −85%

Cloudflare Pages cached Static Assets standardmäßig, leitet aber dynamische Routes zum Origin. Nuxts `routeRules` API ermöglicht Page-Level-Cache-Rules.

**nuxt.config.ts:**

```ts
export default defineNuxtConfig({
  routeRules: {
    '/': { 
      isr: 3600, // 1 Stunde stale-while-revalidate
      headers: { 'cache-control': 's-maxage=3600' }
    },
    '/products/**': { 
      isr: 1800,
      headers: { 'cache-control': 's-maxage=1800, stale-while-revalidate=86400' }
    },
    '/api/**': { cache: false } // API-Routes umgehen
  },
  nitro: {
    preset: 'cloudflare-pages',
    cloudflare: {
      pages: {
        routes: {
          exclude: ['/admin/*']
        }
      }
    }
  }
})
```

**ISR (Incremental Static Regeneration) Logik:**
1. Erste Request → SSR vom Origin, Response wird gecacht
2. Requests in den nächsten 3600s → vom Edge serve (TTFB ~40ms)
3. Nach 3600s: Erste Request → Stale Response, Background-Revalidation vom Origin
4. Folgende Requests → Fresh Response

**Cloudflare Analytics:**
- Origin-Request-Rate: 92% → 7% (3 Wochen Durchschnitt)
- Median TTFB: 680ms → 52ms
- 99p TTFB: 2,1s → 180ms

**Tradeoff:** Bestandsaktualisierungen bis zu 1 Stunde verzögert. Kritische Seiten (Checkout) mit `cache: false`. In [Headless](https://www.roibase.com.tr/de/headless)-Architekturen bietet Edge Caching Performance-Gewinn unabhängig vom Backend.

## Bundle-Analyse: Unnötige Abhängigkeiten jagen

Mit `nuxt analyze` inspizierten wir Bundle-Komposition. Zwei größere Gewinne:

**1. Lodash durch natives ES6 ersetzen:**

```js
// Before: 72KB gzipped
import { debounce, throttle } from 'lodash'

// After: 0KB (native)
const debounce = (fn, ms) => {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
```

**2. Day.js durch Intl API ersetzen:**

```js
// Before: day.js 11KB
import dayjs from 'dayjs'
dayjs(date).format('DD MMM YYYY')

// After: native 0KB
new Intl.DateTimeFormat('de-DE', { 
  day: '2-digit', 
  month: 'short', 
  year: 'numeric' 
}).format(new Date(date))
```

**Gesamte Bundle-Reduktion:** 83KB gzipped → FCP (First Contentful Paint) um 240ms verbesert.

## Vergleichstabelle: Before/After

| Metrik | Before | After | Änderung |
|--------|--------|-------|----------|
| LCP (3G) | 10,2s | 2,1s | −79% |
| TBT | 3,2s | 420ms | −87% |
| CLS | 0,18 | 0,04 | −78% |
| FCP | 2,8s | 1,4s | −50% |
| JS Bundle | 312KB | 229KB | −27% |
| TTFB (edge hit) | 680ms | 52ms | −92% |

**Test-Umgebung:** Chrome 120, Lighthouse 11, 3G-Drosselung (1,6Mbps down, 750Kbps up, 300ms RTT). 10 Durchläufe gemittelt.

## Fazit: Performance Engineering ist User-Experience Engineering

Diese vier Techniken sind isoliert nicht ausreichend — kontinuierliche Messung und Iteration erforderlich. In Produktion tracken wir 95p LCP mit RUM (Real User Monitoring). Bei neuen Features Bundle-Size-Regression-Tests. Edge-Cache-Quote wöchentlich über Cloudflare Analytics prüfen. Web-Performance-Gewinn ist keine einmalige Aufgabe — Disziplin im Produktentwicklungs-Zyklus verankert.