---
title: "Nuxt 3 + Cloudflare Pages: From 10s LCP to 2s"
description: "Self-hosted fonts, lazy hydration, content-visibility, and edge caching deliver 80% LCP reduction in production. Code examples and tradeoff analysis."
publishedAt: 2026-08-11
modifiedAt: 2026-08-11
category: tech
i18nKey: tech-001-2026-08
tags: [nuxt3, web-performance, cloudflare-pages, core-web-vitals, edge-caching]
readingTime: 8
author: Roibase
---

Core Web Vitals shifted to INP in 2024, but LCP remains the most visible metric of user experience. When we moved a Nuxt 3 + Cloudflare Pages stack to production for an e-commerce project, LCP hit 10.2 seconds on mobile 3G throttle. After six weeks of optimization, the same scenario dropped to 2.1 seconds. This post dissects the four critical techniques applied: self-hosted font strategy, lazy hydration pattern, CSS content-visibility, and edge caching architecture.

## Self-Hosted Font: 1.8s External Request → 120ms Local Serve

Pulling fonts from Google Fonts' CDN seems intuitive but carries three round-trip costs: DNS, TLS handshake, font file. The average latency was 1.8 seconds. We moved the font to a static asset.

**Steps:**

```bash
# 1. Download font and place in /public/fonts
# Inter variable: ~400KB WOFF2

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

**Tradeoff:** Initial bundle size increased 400KB, but we removed one external dependency from the critical path. Cloudflare's CDN serves this from 300+ PoPs, with median TTFB of 80ms. `font-display: swap` accepted FOUT (Flash of Unstyled Text)—a 0.3% layout shift is the price.

**Benchmark:** LCP contribution -1.6s (10.2s → 8.6s).

## Lazy Hydration: 3.2s TBT → 420ms

Nuxt's default SSR behavior hydrates the entire component tree on the client. Heavy components like product listing grids don't need interactivity in the initial viewport, so hydration cost is wasted.

**Pattern:** Viewport tracking + dynamic import.

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

**Result:** The product grid consumed 28KB of JS bundle with 680ms hydration time. Deferring three grid components that weren't above-the-fold reduced TBT from 3.2s to 420ms. Google Lighthouse performance score improved from 42 to 78.

**Tradeoff:** When users scroll while the skeleton loads, they see a 150–200ms loading delay. CLS (Cumulative Layout Shift) risk exists—skeleton height must match real content exactly.

### H3: Lazy Component Import Pattern in Nuxt

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

// Usage:
const ProductGrid = useLazyComponent('ProductGrid')
```

## CSS content-visibility: Rendering Cost -60%

Since Chrome 85, `content-visibility: auto` signals the browser: "don't render this element when it's off-viewport." Layout, paint, and composite operations defer.

**Implementation:**

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 400px; /* estimated height */
}
```

**Lighthouse trace:**
- Before: Render tree creation 1240ms (312 nodes)
- After: 520ms (88 nodes for initial viewport)

**Critical detail:** `contain-intrinsic-size` is required for scroll bar calculation. Wrong values trigger CLS. In our case, actual card height ranged 380–420px, so we used 400px as the average.

**Note:** Safari didn't support this until 17.4—think of it as progressive enhancement. No fallback needed; you just lose the performance gain.

## Edge Caching: Origin Load -85%

Cloudflare Pages caches static assets by default but sends dynamic routes to the origin. Nuxt's `routeRules` API lets you define page-level cache rules.

**nuxt.config.ts:**

```ts
export default defineNuxtConfig({
  routeRules: {
    '/': { 
      isr: 3600, // 1 hour stale-while-revalidate
      headers: { 'cache-control': 's-maxage=3600' }
    },
    '/products/**': { 
      isr: 1800,
      headers: { 'cache-control': 's-maxage=1800, stale-while-revalidate=86400' }
    },
    '/api/**': { cache: false } // bypass API routes
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

**ISR (Incremental Static Regeneration) logic:**
1. First request → SSR from origin, response cached
2. Requests within 3600s → Served from edge (TTFB ~40ms)
3. First request after 3600s → Stale response returned BUT origin revalidates in background
4. Subsequent requests → Fresh response

**Cloudflare Analytics:**
- Origin request rate: 92% → 7% (3-week average)
- Median TTFB: 680ms → 52ms
- 99p TTFB: 2.1s → 180ms

**Tradeoff:** Product stock updates show stale for up to one hour. On critical pages (checkout), we used `cache: false`. In [headless](https://www.roibase.com.tr/en/headless) commerce architectures, this edge caching strategy decouples backend performance from delivery.

## Bundle Analysis: Hunting Unnecessary Dependencies

During optimization, we inspected bundle composition with `nuxt analyze`. Two major wins:

**1. Replace Lodash with native ES6:**

```js
// Before: 72KB gzipped
import { debounce, throttle } from 'lodash'

// After: 0KB (native utility)
const debounce = (fn, ms) => {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
```

**2. Replace Day.js with Intl API:**

```js
// Before: day.js 11KB
import dayjs from 'dayjs'
dayjs(date).format('DD MMM YYYY')

// After: native 0KB
new Intl.DateTimeFormat('en-US', { 
  day: '2-digit', 
  month: 'short', 
  year: 'numeric' 
}).format(new Date(date))
```

**Total bundle reduction:** 83KB gzipped → FCP (First Contentful Paint) improved by 240ms.

## Comparative Table: Before/After

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| LCP (3G) | 10.2s | 2.1s | -79% |
| TBT | 3.2s | 420ms | -87% |
| CLS | 0.18 | 0.04 | -78% |
| FCP | 2.8s | 1.4s | -50% |
| JS Bundle | 312KB | 229KB | -27% |
| TTFB (edge hit) | 680ms | 52ms | -92% |

**Test environment:** Chrome 120, Lighthouse 11, 3G throttle (1.6Mbps down, 750Kbps up, 300ms RTT). 10-run average.

## Conclusion: Performance Engineering, Not Performance Optimization

These four techniques alone are insufficient—continuous measurement and iteration are mandatory. In production, we track 95p LCP via RUM (Real User Monitoring). New features trigger bundle size regression tests. We review edge cache hit ratios weekly from Cloudflare Analytics. Web performance gains are not a one-time win to forget; they're a discipline embedded in the product development cycle.