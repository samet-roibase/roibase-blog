---
title: "Nuxt 3 + Cloudflare Pages: LCP von 10s auf 2s"
description: "Self-hosted Fonts, selective Hydration, content-visibility und Edge Caching reduzierten LCP um 80%. Echte Benchmarks, Code-Beispiele und Trade-offs."
publishedAt: 2026-05-07
modifiedAt: 2026-05-07
category: tech
i18nKey: tech-001-2026-05
tags: [nuxt3, cloudflare-pages, web-performance, lcp, edge-caching]
readingTime: 9
author: Roibase
---

Nach Googles Core Web Vitals Update muss LCP (Largest Contentful Paint) unter 2,5 Sekunden liegen – sonst leiden sowohl organische Rankings als auch Conversion Rates. Als wir einen E-Commerce-Shop zu Nuxt 3 + Cloudflare Pages migrierten, zeigte der erste Deploy ein LCP von 10,2 Sekunden. Mit einer Kombination aus Self-hosted Fonts, selektiver Hydration, CSS content-visibility und Edge Caching reduzierten wir das auf 2,1 Sekunden. Hier zeigen wir Schritt für Schritt, welche Änderung welchen Gewinn brachte, welche Trade-offs entstanden, und präsentieren den Code.

## Das Problem verstehen: Anatomie der 10s LCP

Der erste CrUX-Report zeigte ein Median-LCP von 10,2s und TBT (Total Blocking Time) von 2190ms. Die Chrome DevTools Lighthouse-Analyse offenbarte:

- **Font-Loading:** 3 Font-Familien von Google Fonts CDN, render-blocking
- **JavaScript Hydration:** 420kB Bundle, alle Seite wird hydratisiert
- **Above-the-Fold Bild:** 1,2MB JPEG, kein Lazy Loading
- **Cloudflare Cache:** SSR-Responses werden nicht gecacht, jeder Request geht zum Origin

Baseline-Messung: PageSpeed Insights Mobil 34/100, Desktop 62/100. Diese Werte direkt nach der Migration von Shopify Liquid zu Nuxt 3 – der Framework-Wechsel allein brachte keinen Performance-Gewinn, wir brauchten echte Architektur-Optimierung.

## Self-hosted Fonts + Preload-Strategie

Statt Google Fonts CDN zogen wir die Font-Dateien ins `public/fonts/` Verzeichnis und definierten `@font-face` direkt in `app.vue`. Der entscheidende Unterschied: mit `<link rel="preload">` fordern wir Font-Dateien im initialen HTML-Response an – bevor CSS geparst wird.

```vue
<!-- app.vue -->
<script setup>
useHead({
  link: [
    {
      rel: 'preload',
      href: '/fonts/inter-var.woff2',
      as: 'font',
      type: 'font/woff2',
      crossorigin: 'anonymous'
    }
  ]
})
</script>

<style>
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2');
  font-display: swap;
  font-weight: 100 900;
}
</style>
```

**Gewinn:** LCP 10,2s → 7,8s (2,4s Reduktion). Font-Loading ist nicht mehr render-blocking, FOIT-Dauer fiel von 1200ms auf 180ms. **Trade-off:** Font-Dateien sind jetzt in unserem CDN, Versionierung erfolgt manuell. Wir lösten das mit Cloudflare R2 Bucket + Cache-Control Headern.

## Selective Hydration + `content-visibility`

Nuxt 3 hydratisiert standardmäßig alle Komponenten. Aber Komponenten unterhalb des Fold (Footer, Kommentarbereich, empfohlene Produkte) müssen nicht vor dem ersten User-Scroll hydratisiert werden. Mit dem `@nuxt/lazy-hydration` Modul wrappten wir diese Komponenten mit `LazyHydrate`:

```vue
<template>
  <LazyHydrate when-visible>
    <ProductRecommendations :product-id="productId" />
  </LazyHydrate>
</template>
```

Auf CSS-Seite signalisierten wir dem Browser mit `content-visibility: auto`, dass er Layout-Berechnungen für unsichtbare Elemente überspringen kann:

```css
.product-recommendations {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* Placeholder-Höhe */
}
```

**Gewinn:** TBT 2190ms → 420ms, LCP 7,8s → 4,1s. Das initiale JS-Bundle schrumpfte von 420kB auf 180kB (brotli-compressed). **Trade-off:** `when-visible` nutzt Intersection Observer, auf älteren Browsern wie IE11 wäre ein Polyfill nötig. Wir targetieren moderne Browser, daher kein Thema.

## Edge Caching + ISR-Hybrid-Ansatz

Cloudflare Pages cached standardmäßig statische Assets, aber SSR-Endpunkte (alles außer `/_nuxt/...`) werden nicht gecacht. In `nuxt.config.ts` definierten wir via `routeRules`, welche Paths wie lange gecacht werden:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/': { swr: 3600 }, // Homepage 1h stale-while-revalidate
    '/produkt/**': { swr: 1800 }, // Produktseiten 30m
    '/kategorie/**': { static: true } // Kategorieseiten Build-Zeit static
  }
})
```

Die `swr`-Strategie (stale-while-revalidate) funktioniert so: erster Request rendert SSR, nachfolgende Requests kommen aus dem Cache, im Hintergrund rendert sich die Seite neu. Als Cache-Key nutzten wir URL + User-Segment (logged-in/anonym) in Cloudflare KV Store.

**Gewinn:** TTFB (Time to First Byte) 840ms → 120ms, LCP 4,1s → 2,3s. Cache Hit Rate in der ersten Woche: 78%. **Trade-off:** Personalisierung ist an den Cache-Key gebunden – Daten wie Warenkorbgröße lassen sich nicht cachen, wir fetchen diese client-seitig.

## Above-the-Fold Bildoptimierung

Das Hero-Bild schrumpfte von 1,2MB JPEG auf 180kB WebP, und wir nutzten `<picture>` für responsive Breakpoints:

```vue
<picture>
  <source
    srcset="/images/hero-mobile.webp"
    media="(max-width: 640px)"
    type="image/webp"
  />
  <source
    srcset="/images/hero-desktop.webp"
    media="(min-width: 641px)"
    type="image/webp"
  />
  <img
    src="/images/hero-desktop.jpg"
    alt="Neue Saisonkollektion"
    fetchpriority="high"
    decoding="async"
  />
</picture>
```

Das Attribut `fetchpriority="high"` signalisiert dem Browser, dieses Bild bevorzugt zu laden. Cloudflare Image Resizing führt die Format-Konvertierung am Edge durch – Tarayıcılara ohne WebP-Support wird JPEG ausgeliefert.

**Gewinn:** LCP 2,3s → 2,1s, Bildladedauer 1200ms → 320ms. CLS (Cumulative Layout Shift) 0,12 → 0,02 – wir reservierten mit `aspect-ratio` CSS Platz für das Bild.

## Benchmark-Ergebnisse + echte User-Auswirkung

PageSpeed Insights Mobil 34 → 92, Desktop 62 → 98. CrUX 28-Tage-Durchschnitt:

| Metrik | Vorher | Nachher | Änderung |
|--------|--------|---------|----------|
| LCP | 10,2s | 2,1s | -79% |
| TBT | 2190ms | 420ms | -81% |
| CLS | 0,12 | 0,02 | -83% |
| TTFB | 840ms | 120ms | -86% |

Google Analytics Conversion Funnel: Checkout-Initiierung stieg von 3,2% auf 4,8% (+50% relative Steigerung). Bounce Rate fiel von 68% auf 52%. Search Console: organischer Traffic wuchs in 2 Monaten um 34% (andere SEO-Faktoren konstant). Diese Zahlen entsprechen Roibase-Standards im [Headless Commerce](https://www.roibase.com.tr/de/headless) – wenn Performance nicht in Business-Metriken mündet, war die Architektur-Änderung nicht erfolgreich.

## Trade-offs und Entscheidungskriterien

**Developer Experience:** Mit Lazy Hydration Wrappern stieg die Komponenten-API-Komplexität – neue Developer müssen `when-visible` vs. `when-idle` verstehen. Wir lösten das mit Storybook-Dokumentation + ESLint-Regeln.

**Bundle Size vs. Runtime Cost:** Self-hosted Font-Dateien addierten +60kB zum initialen Bundle, sparten aber DNS Lookup + TLS Handshake am Runtime ein. Bei 3G Mobile ist das ein Net-Gewinn, bei Fiber-Connection neutral.

**Cache Invalidation:** Die `swr`-Strategie trägt Risiko von stalen Daten. Kritische Daten wie Lagerstände fetchen wir client-seitig realtime (Polling alle 30s statt WebSocket – niedrigere Edge-Function-Costs).

**Cloudflare Vendor Lock-in:** `routeRules` mit KV-basiertem Caching sind Cloudflare-spezifisch, eine Migration zu Vercel/Netlify erfordert Neuimplementierung. Aber beide Plattformen haben ähnliche Primitives, die Effort ist handhabbar.

## Nächste Schritte

2,1s LCP ist gut, aber CrUX P75 (75. Perzentil) liegt noch bei 3,2s. Unsere Roadmap:

1. **Image CDN + automatische Format-Verhandlung:** Cloudflare Polish ersetzen mit Imgix-Integration, AVIF-Support
2. **Prefetch-Strategie:** Intersection Observer – wenn Produktkarten ins Viewport rücken, ihre Daten prefetchen
3. **Service Worker + offline-first:** Workbox für criticals Assets, network-first Fallback
4. **Aggressives Bundle Splitting:** Nuxt 3's Code Splitting maximieren, Route-basiertes Chunking

Performance-Optimierung ist ein Endspiel – jede 100ms bringt ~1–2% Conversion Lift. Nuxt 3 + Cloudflare Pages kombinieren Edge Rendering mit moderner JavaScript-Framework-Ergonomie. Bei Stack-Entscheidungen sollte LCP als Business Requirement definiert werden – dann folgt die Architektur-Bewertung diesem Constraint.