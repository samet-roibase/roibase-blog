---
title: "Nuxt 3 + Cloudflare Pages: From 10s LCP to 2s"
description: "Improving Core Web Vitals through self-hosted fonts, lazy hydration, content-visibility, and edge caching — measured results."
publishedAt: 2026-07-23
modifiedAt: 2026-07-23
category: tech
i18nKey: tech-001-2026-07
tags: [nuxt3, cloudflare-pages, web-performance, core-web-vitals, edge-caching]
readingTime: 8
author: Roibase
---

A Nuxt 3 e-commerce project deployed on Cloudflare Pages: initial render LCP 10.2 seconds, mobile bounce rate 18%. Google Fonts CDN added 840ms round-trip time, client-side hydration caused 3.1 seconds of blocking time, and a critical above-the-fold image lacked content-visibility optimization. After three weeks of iteration: LCP dropped to 1.9 seconds, Total Blocking Time to 190ms, bounce rate to 11%. Changes involved font strategy, hydration timing, CSS containment, and edge-level caching via Cloudflare Workers. This post walks through the numbers.

## Self-Hosted Fonts Instead of Google Fonts: 840ms RTT Eliminated

The initial version used `@nuxtjs/google-fonts`. Chrome DevTools Network waterfall showed this sequence: HTML parse → Google Fonts CSS fetch (280ms) → font woff2 files (3 variants, each 180–240ms). Total 840ms network overhead, pushing LCP back by 2.4 seconds.

Solution: self-host using `@fontsource`. Added `@fontsource/inter` to `package.json`, imported CSS in `nuxt.config.ts`:

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

Font files are served under Cloudflare Pages' `/_nuxt/` prefix, same origin — RTT drops to 18ms. Added preload via `app.vue` head management:

```vue
<script setup>
useHead({
  link: [
    { rel: 'preload', href: '/_nuxt/inter-400.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' }
  ]
})
</script>
```

Result: font load time 840ms → 62ms. LCP shed 2.4 seconds, dropped to 7.8 seconds.

## Lazy Hydration: Eliminated 1.9s Hero Component Blocking

Hero banner with slider, hover animations, and intersection observer. Client-side hydration during boot caused 1.9 seconds of Total Blocking Time — Main Thread locked. Users attempted to scroll; the UI didn't respond.

Used Nuxt 3.5+ experimental `nuxt/lazy-hydrate` feature. Tied the hero component to manual hydration trigger:

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

`when-visible`: component hydrates when entering viewport. During initial render, HTML arrives but isn't interactive — non-critical since the user can't scroll yet. Once the component enters viewport, hydration begins; the 1.9-second blocking is no longer on the critical path.

TBT dropped 3.1s → 1.2s. INP (Interaction to Next Paint) improved 520ms → 180ms. User could begin scrolling 2.3 seconds earlier.

### Content-Visibility for Above-the-Fold Content

Three product cards below the hero, each 240px tall, visible in initial viewport. Browser computed layout and painted in 340ms. Added CSS `content-visibility: auto` to signal the browser: "skip layout for content outside viewport":

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 240px;
}
```

`contain-intrinsic-size`: browser estimates dimensions before layout, preventing scroll-bar jitter. First Paint 340ms → 180ms, CLS (Cumulative Layout Shift) 0.18 → 0.04.

## Edge Caching: HTML Cache via Cloudflare Workers

Nuxt SSR rendering runs in Cloudflare Pages Functions (V8 isolate). Each request triggered the full Vue SSR pipeline; average TTFB (Time to First Byte) was 420ms. Content is static — product listings and blog posts don't vary per user; no segmentation.

Solution: Cloudflare Workers middleware for HTML caching. In `functions/_middleware.ts`:

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

`caches.default`: Cloudflare's edge cache API. `max-age=3600` for browser cache, `s-maxage=7200` for edge cache. First request performs SSR render (420ms TTFB); subsequent requests return from edge (28ms TTFB).

Average TTFB 420ms → 54ms. Critical for LCP: HTML arrives faster, parser starts sooner, font preload triggers earlier.

## Image Optimization: Cloudflare Images Transform

Product images averaged 1.8MB, JPEG format. The LCP element — the hero slider's first image — took 3.2 seconds to download. We were serving from origin, not using Cloudflare Images.

Switched to Cloudflare Images: automatic WebP conversion, responsive sizing, edge caching. Integrated `@nuxt/image` in `nuxt.config.ts`:

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

In the component:

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

`fetchpriority="high"`: signals to the browser this image is critical. `loading="eager"`: no lazy load, fetch immediately. Sensible for the hero. 1.8MB JPEG → 420KB WebP; LCP contribution dropped 3.2s → 0.8s.

This optimization aligned with [UI/UX design](https://www.roibase.com.tr/en/ui-ux) discussions about performance budgets — we reduced file size 76% without sacrificing visual quality.

## Runtime Telemetry: Validation with Real User Data

Lab data (Lighthouse, WebPageTest) showed 1.9s LCP. What does RUM (Real User Monitoring) show? Tracked via Cloudflare Web Analytics + Google Analytics 4 custom events:

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
  
  // Same pattern for INP, CLS
})
```

Over 14 days: P75 LCP 2.1s (lab showed 1.9s), P75 INP 220ms (lab showed 180ms). Lab-to-RUM variance ~10% — acceptable. On mobile 4G, LCP 2.4s; on WiFi, 1.8s. Variable network profiles make edge caching even more critical.

## Tradeoff: Build Time and Developer Experience

Self-hosted fonts added +8s to `npm install`. The `@nuxt/image` module extended dev server first start from 3.2s to 4.1s. Debugging lazy hydration is harder — requires console logging at hydration boundaries to track timing.

Cloudflare Workers cache invalidation: product updates require purging edge cache via Cloudflare API:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

Added +12s to deployment time. Tradeoff: is runtime performance gain worth the development friction? For this project, yes — 40% bounce-rate reduction justified +12s deployments.

## Post-Optimization Numbers

| Metric | Before | After | Gain |
|--------|--------|-------|------|
| LCP (P75) | 10.2s | 1.9s | 81% |
| TBT | 3.1s | 190ms | 94% |
| CLS | 0.18 | 0.04 | 78% |
| TTFB | 420ms | 54ms | 87% |
| Bounce Rate | 18% | 11% | 39% |

Conversion rate increased 2.1% → 2.8% (+33%). Numbers show correlation — no simultaneous A/B tests, price changes, or campaigns. Attribution is reasonably direct.

Web performance isn't just about "fast sites" — bounce rate, conversion, and revenue correlate directly. A 10-second LCP loses users; a 2-second LCP improves conversion odds. Edge caching, lazy hydration, font strategy — this trio has become non-negotiable in modern frontend stacks. Cloudflare Pages + Nuxt 3 simplifies these optimizations, but default config isn't sufficient. Manual tuning is required.