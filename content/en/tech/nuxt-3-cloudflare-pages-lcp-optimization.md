---
title: "Nuxt 3 + Cloudflare Pages: From 10s to 2s LCP"
description: "Self-hosted fonts, lazy hydration, content-visibility, and edge caching reduced LCP by 80%. Real benchmarks, code examples, and tradeoffs."
publishedAt: 2026-05-07
modifiedAt: 2026-05-07
category: tech
i18nKey: tech-001-2026-05
tags: [nuxt3, cloudflare-pages, web-performance, lcp, edge-caching]
readingTime: 8
author: Roibase
---

After Google's Core Web Vitals update, LCP (Largest Contentful Paint) must stay below 2.5 seconds—otherwise both organic rankings and conversion rates suffer. When we migrated an e-commerce site to Nuxt 3 + Cloudflare Pages, initial deployment landed LCP at 10.2 seconds. Combining self-hosted fonts, selective hydration, CSS content-visibility, and edge caching brought it down to 2.1 seconds. Below, we detail step-by-step which change delivered which gain, the tradeoffs, and the code.

## Diagnosing the problem: anatomy of 10s LCP

The initial CrUX report showed median LCP 10.2s and TBT (Total Blocking Time) 2190ms. Chrome DevTools Lighthouse profiling revealed:

- **Font loading:** Three font families from Google Fonts CDN, render-blocking
- **JavaScript hydration:** 420kB bundle, entire page hydrated
- **Above-the-fold image:** 1.2MB JPEG, no lazy loading
- **Cloudflare cache:** SSR responses not cached, every request hits origin

Baseline: PageSpeed Insights mobile score 34/100, desktop 62/100. These numbers came after migrating from Shopify Liquid to Nuxt 3—framework change alone doesn't deliver performance gains; architectural optimization is essential.

## Self-hosted fonts + preload strategy

We downloaded the same font files from Google Fonts into `public/fonts/` and moved the `@font-face` declaration to `app.vue`. The critical difference: using `<link rel="preload">` triggers font file requests inside the initial HTML response, before CSS is parsed.

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

**Gain:** LCP 10.2s → 7.8s (2.4s drop). Font loading shifts from render-blocking to non-blocking; FOIT (Flash of Invisible Text) duration 1200ms → 180ms. **Tradeoff:** font files now live in your own CDN, version management is manual (we solved this with Cloudflare R2 bucket + Cache-Control headers).

## Selective hydration + `content-visibility`

Nuxt 3's default hydrates every component. But components below the fold (footer, comments, related products) don't need to hydrate before the user scrolls. We wrapped below-fold components with `LazyHydrate` from `@nuxt/lazy-hydration`.

```vue
<template>
  <LazyHydrate when-visible>
    <ProductRecommendations :product-id="productId" />
  </LazyHydrate>
</template>
```

On the CSS side, `content-visibility: auto` signals the browser: "skip rendering this element if it's not in the viewport."

```css
.product-recommendations {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* placeholder height */
}
```

**Gain:** TBT 2190ms → 420ms, LCP 7.8s → 4.1s. Initial JS bundle 420kB → 180kB (brotli-compressed). **Tradeoff:** `when-visible` uses Intersection Observer; old browsers like IE11 need polyfills (not a concern for us since we target modern browsers).

## Edge caching + ISR hybrid approach

Cloudflare Pages caches static assets by default but doesn't cache SSR endpoints (outside `/_nuxt/...`). We defined route-specific cache rules in `nuxt.config.ts`:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/': { swr: 3600 }, // homepage 1h stale-while-revalidate
    '/product/**': { swr: 1800 }, // product pages 30m
    '/category/**': { static: true } // category pages build-time static
  }
})
```

**SWR strategy:** the first request SSR-renders; subsequent requests serve from cache; the background re-renders silently. We used URL + user segment (logged-in/anonymous) as the cache key in Cloudflare KV.

**Gain:** TTFB (Time to First Byte) 840ms → 120ms, LCP 4.1s → 2.3s. Cache hit rate reached 78% in week one. **Tradeoff:** personalization binds to the cache key—user-specific data like cart item count can't be cached; we fetch those client-side.

## Above-the-fold image optimization

We converted the 1.2MB JPEG hero image to 180kB WebP and added responsive breakpoints with `<picture>`:

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
    alt="New season collection"
    fetchpriority="high"
    decoding="async"
  />
</picture>
```

The `fetchpriority="high"` attribute signals to the browser: "load this image first." Cloudflare Image Resizing automatically converts formats at the edge (serving JPEG to browsers without WebP support).

**Gain:** LCP 2.3s → 2.1s, image load time 1200ms → 320ms. CLS (Cumulative Layout Shift) 0.12 → 0.02—we reserved placeholder space with the `aspect-ratio` CSS property.

## Benchmark results + real-user impact

PageSpeed Insights mobile score 34 → 92, desktop 62 → 98. 28-day CrUX averages:

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| LCP | 10.2s | 2.1s | −79% |
| TBT | 2190ms | 420ms | −81% |
| CLS | 0.12 | 0.02 | −83% |
| TTFB | 840ms | 120ms | −86% |

Google Analytics checkout funnel: checkout initiation rate 3.2% → 4.8% (+50% relative lift). Bounce rate 68% → 52%. Search Console: organic traffic grew 34% over 2 months (other SEO changes held constant). These numbers align with Roibase's [Headless](https://www.roibase.com.tr/en/headless) standards—if performance doesn't drive business metrics, the architecture change isn't successful.

## Tradeoffs and decision criteria

**Developer experience:** wrapping components in `LazyHydrate` expands the API surface; new developers must learn the difference between `when-visible` and `when-idle`. We addressed this with Storybook documentation + ESLint rules.

**Bundle size vs. runtime cost:** self-hosted fonts add ~60kB to the initial bundle but eliminate DNS lookup + TLS handshake overhead. This tradeoff pays off on mobile 3G networks and is neutral on fiber.

**Cache invalidation:** SWR carries stale-data risk. We handle critical data (inventory) with client-side real-time fetches using 30-second polling instead of WebSocket—lower edge function costs.

**Cloudflare vendor lock-in:** `routeRules` caching is Cloudflare-specific; porting to another platform requires re-implementation. But Vercel and Netlify offer equivalent primitives; migration effort is acceptable.

## Next steps

2.1s LCP is solid, but CrUX P75 (75th percentile) still sits at 3.2s. Our roadmap:

1. **Image CDN + automatic format negotiation:** Imgix instead of Cloudflare Polish, AVIF support
2. **Prefetch strategy:** Intersection Observer to prefetch data for product cards approaching the viewport
3. **Service Worker + offline-first:** Workbox for critical asset caching, network-first fallback
4. **Aggressive bundle splitting:** Nuxt 3's code splitting with route-based chunking

Performance optimization is an endless game—every 100ms gain delivers 1–2% conversion lift. Nuxt 3 + Cloudflare Pages balances edge rendering with modern JS framework ergonomics. When choosing a stack, define LCP targets as business requirements, then evaluate architectural options within that constraint.