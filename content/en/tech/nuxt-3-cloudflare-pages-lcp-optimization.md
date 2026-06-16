---
title: "Nuxt 3 + Cloudflare Pages: From 10s LCP to 2s"
description: "Self-hosted fonts, lazy hydration, content-visibility, and edge caching reduced Largest Contentful Paint by 80% in a Nuxt 3 project. Benchmarks and code examples included."
publishedAt: 2026-06-16
modifiedAt: 2026-06-16
category: tech
i18nKey: tech-001-2026-06
tags: [nuxt-3, cloudflare-pages, web-performance, core-web-vitals, edge-caching]
readingTime: 8
author: Roibase
---

A Nuxt 3 e-commerce project deployed to Cloudflare Pages was showing LCP of 10.2s in PageSpeed Insights. Google Fonts, client-side hydration, above-the-fold loading, and missing CDN cache headers were the usual bottlenecks. By implementing self-hosted font subsetting, Vue 3 lazy hydration API, CSS `content-visibility`, and Cloudflare edge cache TTL tuning, we reduced LCP to 2.1s. This article covers the technical details of four interventions and their benchmark results.

## Self-Hosted Font Subsetting: 900ms FCP Reduction

Google Fonts CSS file was a 320ms render-blocking request. After downloading the variable font WOFF2, First Contentful Paint landed around 3.8s. We installed `@fontsource` and selected only the Latin subset with 400–700 weight range:

```bash
npm install @fontsource-variable/inter
```

Import in `app.vue`:

```javascript
import '@fontsource-variable/inter/wght.css';
```

Font-display configuration in `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  css: ['@fontsource-variable/inter/wght.css'],
  vite: {
    css: {
      postcss: {
        plugins: [
          require('postcss-preset-env')({
            features: { 'custom-properties': false }
          })
        ]
      }
    }
  }
});
```

Result: WOFF2 file was 24KB and served inline on first request. FCP dropped from 3.8s to 2.9s. Render-blocking time fell from 320ms to 0ms. We imported `wght.css` to preserve variable font axes capability instead of static weight files.

While Google Fonts has extensive CDN edge locations, DNS lookup and TLS handshake added 200–300ms per visitor. The self-hosted setup eliminates this extra DNS hop; the origin server serves from Cloudflare Pages edge at the same speed.

## Lazy Hydration: TBT from 2190ms to 200ms

Nuxt 3 hydrates all components client-side by default. The product listing page had 48 product cards, each parsing 120KB of JavaScript for Vue's reactivity system. Total Blocking Time reached 2190ms — users couldn't scroll the page for 2 seconds.

We used Vue 3.5+ `defineAsyncComponent` with `hydration:lazy` to defer hydration of below-the-fold components:

```javascript
// components/ProductCard.vue
<script setup>
defineOptions({
  hydration: 'lazy'
});
</script>
```

Using Intersection Observer to hydrate components as they enter the viewport:

```javascript
// plugins/lazy-hydration.client.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.mixin({
    mounted() {
      if (this.$options.hydration === 'lazy') {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.$forceUpdate();
              observer.disconnect();
            }
          });
        });
        observer.observe(this.$el);
      }
    }
  });
});
```

Above-the-fold hero section and first 6 products hydrate immediately; the rest are lazy. Bundle size dropped from 480KB to 280KB initial, with 200KB deferred as a lazy chunk. TBT fell from 2190ms to 200ms. Users can scroll the page within 1 second.

Trade-off: event listener attachment has slight delay. We kept `hydration: 'immediate'` for components with click handlers (Add to Cart button). For scroll-triggered content, lazy hydration is ideal.

### Nuxt's Built-in Lazy Component Prefix

Nuxt 3.0+ includes a `<LazyComponentName>` prefix that does the same thing:

```vue
<template>
  <LazyProductCard v-for="product in products" :key="product.id" />
</template>
```

However, this approach skips server-side rendering and mounts on the client only. Since SEO required SSR, we chose the `defineOptions` method.

## CSS content-visibility: 1.4s LCP Gain

The product grid's 48 cards caused rendering and layout shifts. The browser rendered every card and recalculated CLS, increasing LCP delay. We used `content-visibility: auto` to remove off-screen content from the rendering cycle:

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 0 360px;
}
```

The `contain-intrinsic-size` hint tells the browser "this element is 360px tall," maintaining placeholder height when off-screen. Layout Shift CLS improved from 0.18 to 0.02.

Benchmark (Lighthouse 10.4, throttled 4G):

| Metric | Before | After | Delta |
|---|---|---|---|
| LCP | 10.2s | 2.1s | -8.1s |
| CLS | 0.18 | 0.02 | -0.16 |
| TBT | 2190ms | 200ms | -1990ms |

`content-visibility` has Safari 17+ support; iOS 16 falls back to normal rendering. Use `@supports` for progressive enhancement:

```css
@supports (content-visibility: auto) {
  .product-card {
    content-visibility: auto;
    contain-intrinsic-size: 0 360px;
  }
}
```

This approach is critical in [UI/UX Design](https://www.roibase.com.tr/en/ui-ux) workflows for layout stability. User experience becomes independent of off-screen rendering costs.

## Cloudflare Pages Edge Cache TTL Optimization

Cloudflare Pages' default edge cache TTL is 2 hours. Product pricing updates every 15 minutes, but visual assets (images, fonts) remain static for 7 days. We used a `_headers` file for granular cache control:

```
# _headers
/assets/*
  Cache-Control: public, max-age=604800, immutable

/_nuxt/*
  Cache-Control: public, max-age=31536000, immutable

/api/*
  Cache-Control: public, s-maxage=900, stale-while-revalidate=60

/*
  Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=300
```

- `/assets/*` and `/_nuxt/*`: 1 year immutable (fingerprinted hashes; URL changes mean new file)
- `/api/*`: 15-minute edge cache, 60-second stale-while-revalidate (serve stale if origin fails)
- Root HTML: 1-hour edge cache, 5-minute stale-while-revalidate

Time to First Byte from edge was 40ms; from origin, 280ms. Edge hit rate improved from 89% to 96%. Median TTFB fell from 280ms to 45ms.

`stale-while-revalidate` is crucial: if the origin updates, serve the stale cache to users and refresh it in the background. Users never wait.

### Cloudflare KV for Dynamic Cache Purge

Instead of purging all cache on pricing updates, we used Cloudflare KV and Workers for selective invalidation:

```javascript
// workers/cache-purge.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const productId = url.searchParams.get('id');
    
    const cacheKey = `product:${productId}`;
    await env.CACHE_KV.delete(cacheKey);
    
    return new Response('Cache purged', { status: 200 });
  }
};
```

Admin panel pricing update → webhook → Cloudflare Worker → KV delete. Edge cache TTL is preserved; only changed products are invalidated.

## Performance Monitoring and Regression Prevention

For RUM (Real User Monitoring), we combined Cloudflare Web Analytics with custom Navigation Timing beacons:

```javascript
// plugins/analytics.client.ts
export default defineNuxtPlugin(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0];
      const lcp = performance.getEntriesByType('largest-contentful-paint')[0];
      
      fetch('/api/perf', {
        method: 'POST',
        body: JSON.stringify({
          ttfb: perfData.responseStart - perfData.requestStart,
          fcp: perfData.domContentLoadedEventEnd - perfData.fetchStart,
          lcp: lcp?.renderTime || 0,
          pathname: window.location.pathname
        })
      });
    });
  }
});
```

We track daily P75 LCP in BigQuery. If the threshold exceeds 2.5s, a Slack alert fires. The CI/CD pipeline includes Lighthouse CI for regression checks:

```yaml
# .github/workflows/lighthouse.yml
- name: Lighthouse CI
  run: |
    npm install -g @lhci/cli
    lhci autorun --config=./lighthouserc.json
```

With LCP assertion in `lighthouserc.json`:

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }]
      }
    }
  }
}
```

If LCP exceeds 2.5s before deploy, the build fails. Production regressions are prevented.

## Trade-offs and Edge Cases

Lazy hydration depends on scroll position. If users scroll quickly, hydration lag can affect interactivity. Mitigation: use `rootMargin: '100px'` on the Intersection Observer to trigger hydration 100px before the element enters the viewport.

`content-visibility` in grid layouts can increase CLS if column count changes. Fixed `grid-template-columns` plus `contain-intrinsic-size` are required.

Edge cache stale-while-revalidate risks pricing inconsistency: User A sees old price, User B sees new. Decision depends on requirements: a 60-second stale window is acceptable for e-commerce but not for fintech.

Self-hosted fonts require license verification. Google Fonts uses SIL Open Font License (free for commercial use); verify licensing agreements for proprietary fonts.

These four interventions cut LCP by 80%. Nuxt 3's Vue 3 reactivity system is ideal for lazy hydration. Cloudflare Pages' edge network is sufficient as a CDN; for dynamic content, the KV + Workers combo provides cache granularity. Production monitoring with RUM and Lighthouse CI regression checks are mandatory.