---
title: "Nuxt 3 + Cloudflare Pages: From 10s LCP to 2s"
description: "Self-hosted fonts, lazy hydration, content-visibility, and edge caching reduced LCP by 80%. Real benchmarks, code examples, and tradeoffs included."
publishedAt: 2026-05-07
modifiedAt: 2026-05-07
category: tech
i18nKey: tech-001-2026-05
tags: [nuxt3, cloudflare-pages, web-performance, lcp, edge-caching]
readingTime: 8
author: Roibase
---

After Google's Core Web Vitals update, LCP (Largest Contentful Paint) must stay below 2.5 seconds—otherwise both organic rankings and conversion rates drop. When we migrated an e-commerce site to the Nuxt 3 + Cloudflare Pages stack, the first deploy landed LCP at 10.2 seconds. By combining self-hosted fonts, selective hydration, CSS content-visibility, and edge caching, we brought it down to 2.1 seconds. Below, we break down which change delivered which gain, explain the tradeoffs, and share the code.

## Diagnosing the problem: anatomy of 10s LCP

The initial CrUX report showed a median LCP of 10.2s and TBT (Total Blocking Time) of 2190ms. Chrome DevTools Lighthouse profiling revealed:

- **Font loading:** Three font families from Google Fonts CDN, render-blocking
- **JavaScript hydration:** 420kB bundle, entire page hydrated
- **Above-the-fold image:** 1.2MB JPEG, no lazy loading
- **Cloudflare cache:** SSR responses not cached; every request hit origin

Baseline: PageSpeed Insights mobile score 34/100. Desktop 62/100. These numbers came right after transitioning from Shopify Liquid to Nuxt 3—a framework change alone doesn't guarantee performance gains; architectural optimization is required.

## Self-hosted fonts + preload strategy

We downloaded the same fonts from Google Fonts into `public/fonts/` and moved the `@font-face` definition into `app.vue`. The critical difference: `<link rel="preload">` requests font files within the initial HTML response, before CSS parsing.

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

**Gain:** LCP 10.2s → 7.8s (2.4s drop). Font loading moved out of the render-blocking path; FOIT (Flash of Invisible Text) dropped from 1200ms to 180ms. **Tradeoff:** Font files now live on our CDN, version management is manual. We solved this via Cloudflare R2 bucket + Cache-Control headers.

## Selective hydration + `content-visibility`

Nuxt 3's default behavior hydrates every component. But components below the fold (footer, comments, related products) don't need hydration before the user scrolls. We wrapped non-critical components with `@nuxt/lazy-hydration`'s `LazyHydrate`.

```vue
<template>
  <LazyHydrate when-visible>
    <ProductRecommendations :product-id="productId" />
  </LazyHydrate>
</template>
```

On the CSS side, `content-visibility: auto` signals the browser: "don't do rendering work for elements outside the viewport."

```css
.product-recommendations {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* placeholder height */
}
```

**Gain:** TBT 2190ms → 420ms, LCP 7.8s → 4.1s. Initial JS bundle 420kB → 180kB (brotli-compressed). **Tradeoff:** `when-visible` relies on intersection observer; older browsers like IE11 need polyfills. We target modern browsers, so no blocker.

## Edge caching + ISR hybrid approach

Cloudflare Pages caches static files by default but not SSR endpoints outside `/_nuxt/...`. In `nuxt.config.ts`, we defined `routeRules` to specify cache duration per path:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/': { swr: 3600 }, // homepage 1h stale-while-revalidate
    '/urun/**': { swr: 1800 }, // product pages 30m
    '/kategori/**': { static: true } // category pages build-time static
  }
})
```

The `swr` (stale-while-revalidate) strategy: the first request triggers SSR rendering, subsequent requests serve from cache, and the page silently re-renders in the background. We used Cloudflare KV store with URL + user segment (logged-in/anonymous) as the cache key.

**Gain:** TTFB 840ms → 120ms, LCP 4.1s → 2.3s. Cache hit rate reached 78% in the first week. **Tradeoff:** Personalization is cache-key bound. User-specific data like cart item count can't be cached; we fetch it client-side instead.

## Above-the-fold image optimization

We converted the hero image from 1.2MB JPEG to 180kB WebP and added responsive breakpoints via `<picture>`:

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

The `fetchpriority="high"` attribute signals the browser: "load this image first." We use Cloudflare Image Resizing at edge to auto-convert formats; older browsers get JPEG fallback.

**Gain:** LCP 2.3s → 2.1s, image load time 1200ms → 320ms. CLS (Cumulative Layout Shift) 0.12 → 0.02 because we reserved space using the `aspect-ratio` CSS property.

## Benchmark results + real user impact

PageSpeed Insights mobile score 34 → 92, desktop 62 → 98. 28-day CrUX average:

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| LCP | 10.2s | 2.1s | -79% |
| TBT | 2190ms | 420ms | -81% |
| CLS | 0.12 | 0.02 | -83% |
| TTFB | 840ms | 120ms | -86% |

Google Analytics funnel: checkout initiation rate 3.2% → 4.8% (+50% relative lift). Bounce rate 68% → 52%. Search Console: organic traffic up 34% over two months (other SEO changes held constant). These numbers align with Roibase's standard targets in [headless commerce](https://www.roibase.com.tr/ru/headless)—if performance doesn't translate to business metrics, the architecture change hasn't succeeded.

## Tradeoffs and decision criteria

**Developer experience:** Wrapping components in `LazyHydrate` expands the API surface; new team members must learn `when-visible` vs. `when-idle`. We handled this with Storybook documentation and ESLint rules.

**Bundle size vs. runtime cost:** Self-hosted fonts added 60kB to the initial bundle but eliminated DNS lookup + TLS handshake overhead. This tradeoff is a net win on mobile 3G, neutral on fiber.

**Cache invalidation:** `swr` strategy carries stale-data risk. Critical data like inventory is kept fresh via client-side polling every 30s (cheaper than WebSocket or edge functions).

**Cloudflare vendor lock-in:** `routeRules` KV-based caching is Cloudflare-specific. Migrating platforms requires re-implementation. That said, Vercel and Netlify have similar primitives; migration effort is manageable.

## Next steps

2.1s LCP is solid, but CrUX P75 (75th percentile) still sits at 3.2s. Our roadmap:

1. **Image CDN + automatic format negotiation:** Imgix integration instead of Cloudflare Polish, AVIF support
2. **Prefetch strategy:** Intersection Observer to prefetch data for product cards as they approach viewport
3. **Service Worker + offline-first:** Workbox to cache critical assets, network-first fallback
4. **Aggressive bundle splitting:** Route-based chunking with Nuxt 3's code splitting

Performance optimization never ends—every 100ms saved lifts conversion by 1–2%. Nuxt 3 + Cloudflare Pages offers a balance between edge rendering and modern JS framework ergonomics. When making stack decisions, define LCP targets as business requirements first, then evaluate architectural options within that constraint.