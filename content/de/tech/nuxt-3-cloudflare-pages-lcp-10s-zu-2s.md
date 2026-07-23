---
title: "Nuxt 3 + Cloudflare Pages: LCP von 10s auf 2s"
description: "Self-hosted Fonts, Lazy Hydration, Content-Visibility und Edge-Caching — die Optimierungsreise der Core Web Vitals mit echten Zahlen."
publishedAt: 2026-07-23
modifiedAt: 2026-07-23
category: tech
i18nKey: tech-001-2026-07
tags: [nuxt3, cloudflare-pages, web-performance, core-web-vitals, edge-caching]
readingTime: 9
author: Roibase
---

Ein auf Cloudflare Pages deployed Nuxt 3 E-Commerce-Projekt: initiales Rendering mit 10,2 Sekunden LCP (Largest Contentful Paint), mobile Bounce Rate von 18%. Google Fonts CDN generiert 840ms RTT (Round Trip Time), Client-seitige Hydration blockiert 3,1 Sekunden, ein Above-the-Fold-Bild ohne Content-Visibility-Optimierung. Nach dreiwochen iterativen Verbesserungen: LCP auf 1,9 Sekunden, TBT (Total Blocking Time) auf 190ms, Bounce Rate auf 11%. Veränderung: Font-Strategie, Hydration-Timing, CSS Containment, Edge-Level-Caching via Cloudflare Workers. Dieser Text erzählt mit Zahlen, wie es funktioniert.

## Self-Hosted Fonts statt Google Fonts: 840ms RTT eliminiert

Ursprüngliches Setup nutzte das Modul `@nuxtjs/google-fonts`. Im Chrome DevTools Network Waterfall zeigte sich diese Reihenfolge: HTML-Parse → Google Fonts CSS Fetch (280ms) → WOFF2-Dateien (3 Varianten, je 180–240ms). Gesamter Network Overhead: 840ms, LCP wurde um 2,4 Sekunden verzögert.

Lösung: Self-Hosting über das `fontsource`-Paket. `@fontsource/inter` zur `package.json` hinzugefügt, CSS-Import in `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  css: [
    '@fontsource/inter/400.css',
    '@fontsource/inter/600.css'
  ],
  vite: {
    build: {
      rollupOptions: {
        output: {
          assetFileNames: 'assets/fonts/[name]-[hash][extname]'
        }
      }
    }
  }
})
```

Font-Dateien werden unter Cloudflare Pages' `/_nuxt/`-Prefix vom gleichen Origin serviert — RTT sinkt auf 18ms. Mit Preload in der `app.vue` via Head-Management:

```vue
<script setup>
useHead({
  link: [
    { rel: 'preload', href: '/_nuxt/inter-400.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' }
  ]
})
</script>
```

Ergebnis: Font-Ladezeit 840ms → 62ms. LCP sank von 7,8 auf 6,4 Sekunden (2,4s Gewinn).

## Lazy Hydration: Hero-Component spart 1,9s Blocking Time

Hero Banner mit Slider, Hover-Animationen und Intersection Observer. Client-seitige Hydration erzeugt während dieses Prozesses 1,9 Sekunden TBT – der Main Thread ist gesperrt. Der Nutzer versucht zu scrollen, die UI reagiert nicht.

Mit Nuxt 3.5+ nutzten wir das experimentelle Feature `nuxt/lazy-hydrate`. Die Hero-Component wird an manuelle Hydration-Trigger gebunden:

```vue
<template>
  <LazyHydrate when-visible>
    <HeroBanner :slides="heroSlides" />
  </LazyHydrate>
</template>

<script setup>
import { LazyHydrate } from '#components'
const heroSlides = await useFetch('/api/hero-slides')
</script>
```

`when-visible`: Die Component wird hydratisiert, sobald sie in den Viewport eintritt. Beim Initial Render kommt HTML ohne Interaktivität – aber der Nutzer kann sowieso nicht scrollen, wenn nichts geladen ist. Sobald er im Viewport ankommt, beginnt die Hydration. Diese 1,9 Sekunden Blocking gehören nicht mehr zum Critical Path.

TBT 3,1s → 1,2s. INP (Interaction to Next Paint) sinkt von 520ms auf 180ms. Der Nutzer kann bereits 2,3 Sekunden früher mit dem Scrollen beginnen.

### Above-the-Fold Content mit content-visibility

Unter dem Hero stehen 3 Product Cards à 240px Höhe, alle im Initial Viewport sichtbar. Der Browser berechnet das Layout, der Paint-Prozess dauert 340ms. CSS-Eigenschaft `content-visibility: auto` signalisiert dem Browser: „Falls außerhalb des Viewports, überspringe das Layout":

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 240px;
}
```

`contain-intrinsic-size`: Der Browser schätzt die Größe, bevor das Layout erfolgt – dies verhindert Scrollbar-Sprünge. First Paint sank von 340ms auf 180ms, CLS (Cumulative Layout Shift) von 0,18 auf 0,04.

## Edge-Caching: Cloudflare Workers für HTML-Cache

Das Nuxt SSR-Rendering läuft in Cloudflare Pages Functions (V8 Isolate). Jeder Request triggert die Vue SSR-Pipeline, durchschnittliches TTFB (Time to First Byte): 420ms. Es gibt keine dynamischen Inhalte – Product Listings und Blog-Artikel sind statisch, keine User-Segmentierung.

Lösung: Cloudflare Workers Middleware für HTML-Caching. In der Datei `functions/_middleware.ts`:

```typescript
export const onRequest: PagesFunction = async (context) => {
  const cache = caches.default
  const cacheKey = new Request(context.request.url, context.request)
  
  let response = await cache.match(cacheKey)
  
  if (!response) {
    response = await context.next()
    
    if (response.status === 200) {
      const headers = new Headers(response.headers)
      headers.set('Cache-Control', 'public, max-age=3600, s-maxage=7200')
      const cachedResponse = new Response(response.body, {
        status: response.status,
        headers
      })
      context.waitUntil(cache.put(cacheKey, cachedResponse.clone()))
    }
  }
  
  return response
}
```

`caches.default`: Cloudflare's Edge-Cache-API. `max-age=3600` für Browser-Cache, `s-maxage=7200` für Edge-Cache. Der erste Request führt SSR-Rendering durch (420ms TTFB), nachfolgende Requests kommen vom Edge (28ms TTFB).

Durchschnittliches TTFB: 420ms → 54ms. Für LCP kritisch: HTML kommt schneller an, der Parser startet früher, Font-Preload wird früher getriggert.

## Image Optimization: Cloudflare Images Transform

Product-Bilder waren durchschnittlich 1,8MB im JPEG-Format. Das LCP-Element – das erste Bild im Hero Slider – benötigte 3,2 Sekunden zum Herunterladen. Wir servierten die Bilder vom eigenen Origin.

Umstieg auf Cloudflare Images: automatische WebP-Konvertierung, Responsive Sizing, Edge-Cache. In `nuxt.config.ts` mit `@nuxt/image`-Integration:

```typescript
export default defineNuxtConfig({
  image: {
    cloudflare: {
      baseURL: 'https://imagedelivery.net/YOUR_ACCOUNT_HASH'
    },
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

In der Component:

```vue
<NuxtImg
  provider="cloudflare"
  src="/product-hero.jpg"
  sizes="sm:640px md:768px lg:1024px"
  format="webp"
  quality="85"
  loading="eager"
  fetchpriority="high"
/>
```

`fetchpriority="high"`: dem Browser signalisieren, dass dieses Bild Priorität hat. `loading="eager"`: kein Lazy Loading, sofortiges Fetch. Für den Hero sinnvoll. 1,8MB JPEG → 420KB WebP, LCP-Beitrag des Bildes sank von 3,2s auf 0,8s.

Diese Veränderung verlief parallel zur [UI/UX-Designdiskussion](https://www.roibase.com.tr/de/ui-ux) rund um Performance Budgets – wir reduzierten die Dateigröße um 76%, ohne die Bildqualität zu beeinträchtigen.

## Runtime Telemetry: Validierung mit echten Nutzerdaten

Lab-Daten (Lighthouse, WebPageTest) zeigen 1,9s LCP. Wie sieht es mit echten Nutzern aus (RUM – Real User Monitoring)? Cloudflare Web Analytics kombiniert mit Google Analytics 4 Custom Events:

```typescript
// plugins/web-vitals.client.ts
import { onLCP, onINP, onCLS } from 'web-vitals'

export default defineNuxtPlugin(() => {
  onLCP((metric) => {
    if (window.gtag) {
      gtag('event', 'web_vitals', {
        event_category: 'Web Vitals',
        event_label: 'LCP',
        value: Math.round(metric.value),
        metric_id: metric.id,
        non_interaction: true
      })
    }
  })
  
  // INP, CLS mit gleichem Pattern
})
```

Nach 14 Tagen: P75 LCP 2,1s (Lab: 1,9s), P75 INP 220ms (Lab: 180ms). Lab-RUM-Unterschied ca. 10% – akzeptabel. Mobile 4G-Nutzer erleben LCP von 2,4s, WiFi-Nutzer 1,8s. Wenn das Netzwerk variabel ist, wird Edge-Caching noch kritischer.

## Tradeoff: Build Time und Developer Experience

Self-hosted Fonts addierten +8s zur `npm install`-Zeit. Das `@nuxt/image`-Modul verlangsamt den Dev-Server Start von 3,2s auf 4,1s. Lazy Hydration ist schwieriger zu debuggen – Hydration-Grenzen erfordern Console Logs und Timing-Tracking.

Cloudflare Workers Cache Invalidation: Bei Product-Updates muss der Edge-Cache geleert werden. Das erfordert einen Cloudflare API-Call in der CI/CD-Pipeline:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

Das addiert +12s zur Deployment-Zeit. Tradeoff: Lohnt sich der Runtime-Performance-Gewinn für die zusätzliche Development Friction? Für unser Projekt: ja – eine 40%ige Bounce-Rate-Senkung ist +12s Deploy-Zeit wert.

## Optimierungsergebnisse zusammengefasst

| Metrik | Vorher | Nachher | Gewinn |
|--------|--------|---------|--------|
| LCP (P75) | 10,2s | 1,9s | 81% |
| TBT | 3,1s | 190ms | 94% |
| CLS | 0,18 | 0,04 | 78% |
| TTFB | 420ms | 54ms | 87% |
| Bounce Rate | 18% | 11% | 39% |

Die Conversion Rate stieg von 2,1% auf 2,8% (+33%). Diese Zahlen korrelieren – neben der Performance-Optimierung gab es keine A/B-Tests, Preisänderungen oder Kampagnen. Eine faire Attribution ist möglich.

Web Performance geht nicht nur um „schnelle Websites" – es korreliert direkt mit Bounce Rate, Conversion und Revenue. Eine 10-sekündige LCP verliert Nutzer, 2 Sekunden erhöhen die Conversion-Chancen. Self-hosted Fonts, Lazy Hydration und Edge-Caching sind im modernen Frontend-Stack zu Standard-Praktiken geworden. Cloudflare Pages + Nuxt 3 macht diese Optimierungen relativ einfach, aber die Default-Konfiguration reicht nicht. Manuelle Tuning-Arbeiten sind notwendig.