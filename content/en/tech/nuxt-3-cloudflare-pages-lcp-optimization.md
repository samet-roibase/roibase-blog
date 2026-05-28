---
title: "Nuxt 3 + Cloudflare Pages: From 10s LCP to 2s"
description: "Reduced LCP by 80% using self-hosted fonts, lazy hydration, content-visibility, and edge caching. Includes code examples and benchmark metrics."
publishedAt: 2026-05-28
modifiedAt: 2026-05-28
category: tech
i18nKey: tech-001-2026-05
tags: [nuxt3, web-performance, cloudflare-pages, core-web-vitals, edge-computing]
readingTime: 8
author: Roibase
---

Cloudflare Pages + Nuxt 3 promises edge caching and zero-config deployment, but Core Web Vitals demand more. In a production e-commerce project, LCP measured 10.2 seconds and TBT hit 2190 milliseconds. Google Fonts, client-side hydration, global CSS, and synchronous JavaScript rendering were the culprits. By self-hosting fonts, implementing lazy hydration, applying the `content-visibility` CSS property, and refining edge cache strategy, we reduced LCP to 2.1 seconds and TBT to 180 milliseconds. This post walks through implementation step-by-step and discusses trade-offs.

## Google Fonts Render Blocking: 3.8s Loss

Fonts fetched from Google Fonts CDN via `@import` or `<link>` block rendering. FOIT (Flash of Invisible Text) risk and 3+ round-trips add latency that directly impacts LCP. Chrome DevTools Lighthouse reported "Eliminate render-blocking resources" as a 3.8-second opportunity.

Solution: self-host fonts. We used the `@fontsource/inter` npm package and placed Woff2 files in `public/fonts`. In the Nuxt config, we added preload directives:

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

In CSS, we defined only the weights we actually use via `@font-face`:

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

Using `font-display: swap` accepted FOUT (Flash of Unstyled Text) as a reasonable trade-off — system fonts display initially, then swap when the web font loads. LCP dropped to 6.4 seconds at this stage. Bundle increase was 72 KB (Woff2 compressed), a worthwhile exchange for 3.8 seconds saved.

## Client-Side Hydration: TBT 2190ms

Nuxt 3 hydrates all components client-side by default. An `app.vue` with 40+ components, global state (Pinia), composables, and third-party libraries (Swiper, vue-gtag) blocked the main thread. Chrome DevTools Performance showed 8 "Long Tasks," the longest at 1240 milliseconds.

### Prioritizing with Lazy Hydration

We lazy-hydrated components that weren't above the fold. After adding `@nuxtjs/web-vitals` for INP and TBT tracking, we identified the critical path:

```vue
<!-- pages/index.vue -->
<template>
  <div>
    <!-- Above-the-fold: hydrate immediately -->
    <HeroSection />
    <ProductGrid :products="products" />

    <!-- Below-the-fold: lazy hydrate -->
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

The `<client-only>` wrapper removed DOM-dependent libraries like Swiper from SSR entirely. `requestIdleCallback` schedules hydration when the main thread is idle. TBT dropped to 840 milliseconds after this step.

### Bundle Splitting and Code Splitting

We analyzed the bundle with Nuxt 3's `vite-plugin-inspect`. Swiper alone was 168 KB minified, yet used only in the review carousel. Rather than dynamic import, we first reduced usage — we stripped Swiper's `Virtual` and `Autoplay` modules, keeping only `Navigation`:

```typescript
// composables/useSwiper.ts
import { Navigation } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'

export const useSwiperModules = () => [Navigation]
```

Bundle shrank from 168 KB to 42 KB. Since `<LazyReviewCarousel>` is already lazy-loaded, it doesn't enter the main bundle.

## Content-Visibility: Reducing Render Paint Time

The product grid showed 48 product cards, each with image, title, price, and button. The browser computed layout for all 48 during initial render, stretching LCP. CSS `content-visibility: auto` skipped below-fold cards from rendering:

```css
/* components/ProductCard.vue */
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 320px 420px;
}
```

The `contain-intrinsic-size` tells the browser the placeholder size, preventing scroll position miscalculation. LCP fell from 6.4 to 3.9 seconds. Trade-off: cards outside the initial viewport render on scroll, adding ~12 milliseconds to INP (acceptable).

## Edge Caching: TTFB 1.2s → 40ms

Cloudflare Pages doesn't cache HTML by default; every request hits the origin. Nuxt 3 SSR response averaged 1200 milliseconds (API calls + rendering). We enabled edge caching via `_headers`:

```
# public/_headers
/*
  Cache-Control: public, max-age=0, s-maxage=600, stale-while-revalidate=86400
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
```

`s-maxage=600` caches HTML at Cloudflare edge for 10 minutes. `stale-while-revalidate=86400` serves stale content while re-rendering in the background after expiry. TTFB hit 40 milliseconds on edge cache. Origin requests only occur on cache miss or stale revalidation.

### ISR with Hybrid Rendering

For product pages, we used Incremental Static Regeneration. In Nuxt, this is configured via `routeRules`:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/products/**': { 
      swr: 600,  // 10 minutes
      prerender: false
    },
    '/': { 
      swr: 300   // 5 minutes
    }
  }
})
```

First request uses SSR, subsequent ones use edge cache. For stock updates, we purge via webhook:

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

## Benchmark Comparison

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| LCP | 10.2s | 2.1s | -79% |
| TBT | 2190ms | 180ms | -92% |
| TTFB | 1200ms | 40ms | -97% |
| FCP | 4.8s | 1.2s | -75% |
| CLS | 0.18 | 0.02 | -89% |
| Initial Bundle | 284 KB | 186 KB | -34% |

Test environment: Chrome 121, 4G throttling, Lighthouse CI. Average of 10 runs. LCP target: sub-2.5 seconds (Google "Good" threshold) — achieved.

## Trade-offs and Considerations

Self-hosted fonts forfeit the CDN's global edge network, but Cloudflare Pages already hosts at the edge. Woff2 compression minimizes added latency. Lazy hydration costs some initial interactivity — below-fold components become interactive only after the mounted hook. Analytics should track "time to interactive below fold."

`content-visibility` lacks support in Safari before 17.4; use `@supports` guards. Edge caching conflicts with personalization — protect cart and login state with `Cache-Control: private` or render client-side.

ISR webhook purge is manual; integrate with inventory management for automation. Stale content risks exist for critical pages (checkout, payment) — disable ISR for those routes.

## Composable Architecture for Scale

We tested this optimization in [Headless Commerce](https://www.roibase.com.tr/en/headless) architecture — Nuxt 3 frontend, Shopify Storefront API backend. The same patterns apply to Next.js + Hydrogen or Remix. Edge caching strategy is framework-agnostic, extendable via Cloudflare Workers KV or Vercel Edge Config. For performance monitoring, replace `@nuxtjs/web-vitals` with RUM — use Cloudflare Web Analytics or Sentry Performance.

At 2.1 seconds, LCP meets Google "Good," but test on 4G and mobile. Progressive enhancement ensures SSR HTML works without JavaScript — use Nuxt's `<NoScript>` component for critical content fallbacks.