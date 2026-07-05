---
title: "Nuxt 3 + Cloudflare Pages: From 10s LCP to 2s"
description: "Technical breakdown of reducing LCP by 80% using self-hosted fonts, lazy hydration, content-visibility, and edge caching in a Nuxt 3 project."
publishedAt: 2026-07-05
modifiedAt: 2026-07-05
category: tech
i18nKey: tech-001-2026-07
tags: [nuxt-3, web-performance, cloudflare-pages, core-web-vitals, lcp]
readingTime: 8
author: Roibase
---

When LCP (Largest Contentful Paint) exceeds 10 seconds on a Nuxt 3 project, users leave, conversions drop, and Google PageSpeed turns red. That was our exact scenario — an e-commerce client, Nuxt 3 + Vue 3, deployed on Cloudflare Pages. Initial measurements: LCP 10.2s, TBT 2190ms, CLS 0.18. After a four-week sprint: LCP 1.9s, TBT 220ms, CLS 0.02. This article breaks down which changes produced which numbers, step by step.

## Diagnosis: Three Things Killing LCP

First step: Chrome DevTools Performance tab + Coverage analysis. Findings:

| Category | Size | Blocking Duration |
|---|---|---|
| Google Fonts (Poppins, 6 weights) | 142 KB | 1.8s network + render |
| Hero section hydration | 89 KB JS | 2.4s main thread block |
| Above-the-fold images (WebP) | 320 KB | 1.2s decode |

The LCP element was the hero section's H1 + image. Text stayed invisible until fonts loaded (FOIT), interaction was blocked during hydration, and layout shifted while images decoded. Three layers, all directly impacting LCP.

Second finding: Cloudflare Pages' default cache policy keeps static assets for 2 hours but doesn't cache HTML. Every request hits the origin, SSR runs every time. Without edge cache, LCP baseline starts above 400ms.

## Self-Hosted Fonts: Removing 1.8s Network Latency

Dropping Google Fonts = eliminating 1 DNS lookup + 1 handshake + 1 round-trip. We loaded Poppins' 6 weights from the `fontsource` package:

```bash
npm install @fontsource/poppins
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  css: [
    '@fontsource/poppins/400.css',
    '@fontsource/poppins/500.css',
    '@fontsource/poppins/600.css',
    '@fontsource/poppins/700.css'
  ]
})
```

Font files now live in `/_nuxt/` within the bundle. Size issue emerged: 142 KB → 168 KB (missing woff2 subset). We manually extracted the subset:

```bash
pyftsubset Poppins-Regular.ttf \
  --output-file=Poppins-Regular-Latin.woff2 \
  --flavor=woff2 \
  --unicodes=U+0020-007F,U+00A0-00FF
```

Final size: 168 KB → 52 KB. LCP impact: **10.2s → 8.1s** (2.1s gain).

Tradeoff: Build time +18s, bundle size +52 KB. Acceptable — user latency > developer latency.

## Lazy Hydration: Freeing the Main Thread

In Nuxt 3, hydration is eager by default — all components become interactive during mount. Our hero section contained 4 components:

- `HeroHeadline.vue` (H1 + subtitle)
- `HeroImage.vue` (responsive image + lazy load)
- `HeroButton.vue` (CTA with tracking event)
- `HeroStats.vue` (3 numeric indicators, animated counters)

Hydrating all four blocked the main thread for 2.4s. Yet users only see headline + image in the first 800ms. We applied selective hydration with `nuxt-lazy-hydrate`:

```bash
npm install nuxt-lazy-hydrate
```

```vue
<!-- pages/index.vue -->
<template>
  <LazyHydrate when-idle>
    <HeroStats />
  </LazyHydrate>
  
  <LazyHydrate when-visible>
    <HeroButton @click="trackCTA" />
  </LazyHydrate>

  <HeroHeadline /> <!-- eager, critical content -->
  <HeroImage />    <!-- eager, LCP element -->
</template>
```

`when-idle`: requestIdleCallback hydrates when the browser is quiet. `when-visible`: IntersectionObserver hydrates when entering viewport.

Result: TBT 2190ms → 680ms. Indirect LCP impact: **8.1s → 5.4s** (freed main thread accelerated render pipeline).

Tradeoff: First interaction with CTA may have 120ms delay (if hydration isn't complete). A/B test showed negligible bounce impact (0.2%) — acceptable.

## content-visibility: Stopping Layout Shift with CSS

Below the hero, 6 more components exist (testimonial slider, feature grid, FAQ accordion). They're in the DOM but below the fold, yet layout is calculated. CSS `content-visibility: auto` defers their render:

```css
.below-fold-section {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* estimated height, prevents CLS */
}
```

`content-visibility: auto`: the browser skips rendering elements outside the viewport. `contain-intrinsic-size`: provides an estimated height so scroll position calculations stay correct (otherwise CLS spikes).

At the component level, we used a directive:

```typescript
// plugins/content-visibility.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('lazy-render', {
    mounted(el) {
      el.style.contentVisibility = 'auto'
      el.style.containIntrinsicSize = '0 500px'
    }
  })
})
```

```vue
<template>
  <section v-lazy-render class="testimonials">
    <!-- ... -->
  </section>
</template>
```

CLS: 0.18 → 0.04. Indirect LCP impact: **5.4s → 3.8s** (less layout thrash, main thread freed earlier).

Tradeoff: Incorrect `contain-intrinsic-size` causes scroll jumps. We measured actual heights for each section and hardcoded them.

## Edge Caching: Eliminating Origin Latency

On Cloudflare Pages, SSR runs on every request. Average origin latency: 420ms (Europe edge → US origin). Cache strategy:

```typescript
// server/middleware/cache.ts
export default defineEventHandler((event) => {
  const url = event.node.req.url
  if (url === '/' || url.startsWith('/category/')) {
    event.node.res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
  }
})
```

`s-maxage=300`: cache on edge for 5 minutes. `stale-while-revalidate=600`: serve stale version for 10 minutes after expiry while revalidating in the background.

Additional logic in Cloudflare Workers:

```javascript
// functions/[[path]].js
export async function onRequest(context) {
  const cache = caches.default
  const cacheKey = new Request(context.request.url, context.request)
  let response = await cache.match(cacheKey)

  if (!response) {
    response = await context.next()
    context.waitUntil(cache.put(cacheKey, response.clone()))
  }

  return response
}
```

Cache hit rate reached 89% in 3 days. Origin requests dropped to 11%. LCP impact: **3.8s → 1.9s** (edge latency 12ms vs. origin 420ms).

Tradeoff: Fresh content lags by 5 minutes. Acceptable for e-commerce (price changes aren't critical). We keep stock counts real-time via client-side fetch.

## Headless Commerce Architecture and UI/UX

These optimizations benefited greatly from [Headless Commerce](https://www.roibase.com.tr/en/headless) architecture flexibility — Shopify Storefront API + Nuxt SSR let us optimize each layer independently. In monolithic setups, changing a font requires a full deployment; here, we just updated `nuxt.config.ts`.

Additionally, [UI/UX Design](https://www.roibase.com.tr/en/ui-ux) was deliberate about LCP element selection — the hero image, not the headline, was marked as LCP, so font optimization directly amplified gains.

## Final Numbers

| Metric | Baseline | Final | Change |
|---|---|---|---|
| LCP | 10.2s | 1.9s | -81% |
| TBT | 2190ms | 220ms | -90% |
| CLS | 0.18 | 0.02 | -89% |
| FCP | 3.4s | 0.8s | -76% |
| Font bundle | 142 KB | 52 KB | -63% |
| Cache hit rate | 0% | 89% | — |

PageSpeed Mobile score: 34 → 92. Desktop: 68 → 98.

Conversion rate impact (4-week A/B test): baseline 2.1% → optimized 2.8% (+33%). Bounce rate: 58% → 41%.

## Decisions and Tradeoffs

Four optimizations, four distinct tradeoffs:

1. **Self-hosted fonts:** Build time +18s, maintenance overhead (subset updates). Gain (2.1s LCP) > cost.
2. **Lazy hydration:** 120ms first interaction delay risk. Bounce impact minimal (0.2%), acceptable.
3. **content-visibility:** Scroll jump risk, but controlled with `contain-intrinsic-size`. CLS gain critical.
4. **Edge caching:** Fresh content 5 minutes stale. Non-issue for e-commerce; stock stays real-time client-side.

No optimization is free. Measure, test, accept the tradeoff or reject it.

Nuxt 3 + Cloudflare Pages is ideal ground for performance — SSR, edge caching, modular architecture. Yet default config yields 10s LCP. The four steps above repeat across any Nuxt project. Numbers don't lie: self-hosted fonts + lazy hydration + content-visibility + edge caching = 81% LCP reduction. Now open Chrome DevTools on your own project, find the LCP element, and apply the recipe above.