---
title: "Nuxt 3 SSG: Prerender Strategies and Build Optimization"
description: "Static site generation with route rules, payload extraction, and incremental regeneration in Nuxt 3. Reduce 40-second builds to 8 seconds."
publishedAt: 2026-05-21
modifiedAt: 2026-05-21
category: tech
i18nKey: tech-007-2026-05
tags: [nuxt-3, ssg, prerender, build-optimization, vue]
readingTime: 8
author: Roibase
---

Nuxt 3's static site generation (SSG) engine is fundamentally different from 2.x. With the Nitro engine come `routeRules`, `prerender` directives, and payload extraction mechanisms that directly impact build times and runtime performance. We share strategies, tradeoffs, and measurements from reducing a 40-second build to 8 seconds on a 10,000-page e-commerce site.

## Prerender Strategy Selection Matrix

Nuxt 3 has four main prerender strategies: full static, partial prerender, ISR hybrid, and on-demand generation. Each carries different build time, runtime cost, and cache hit rate implications.

Full static (`nitro.prerender.routes`): Renders all routes at build time and exports them as HTML. Ideal for 100-page sites; for 10,000 pages, builds can exceed 5 minutes. Plus: zero runtime, 100% CDN cache hit. Minus: every content change requires full rebuild. Unsustainable for e-commerce where product catalogs update 50 times daily.

Partial prerender (via `routeRules`): Prerender critical routes (homepage, top 100 categories), handle long tail with ISR. Build time drops 90%. Example: on a 10,000-product site, prerender the first 500, cache the rest on first request. Cache miss penalty: 800ms (SSR), cache hit: 40ms (static HTML).

Incremental Static Regeneration (ISR): Accomplished via `routeRules` + `swr/stale` on platforms like Vercel/Netlify. Page enters cache after first render; when TTL expires, revalidate in background. Tradeoff: stale content risk versus build-time savings. With 24-hour TTL, you miss daily price changes but build drops to 2 seconds.

On-demand (webhook-triggered via `server/api`): When content changes, regenerate only that route. Lowest build time, highest orchestration complexity. You need a CMS webhook → Nitro API → route invalidation pipeline.

## Granular Control with Route Rules

`routeRules` in `nuxt.config.ts` defines a different rendering strategy per route. At this layer, directives like `prerender`, `swr`, `isr`, and `ssr` control per-route cache behavior.

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true }, // Homepage always static
    '/products/**': { swr: 3600 }, // Products cached 1 hour
    '/api/**': { cors: true, cache: false }, // API endpoints not cached
    '/category/:slug': { isr: true }, // ISR enabled
  },
  nitro: {
    prerender: {
      crawlLinks: true, // Follow sitemap links
      routes: ['/sitemap.xml'], // Manual route definition
      ignore: ['/admin', '/checkout/**'], // Exclude from prerender
    },
  },
})
```

`crawlLinks: true` auto-discovers links in the sitemap. On a 500-page site, you don't maintain a manual route list. But on a 50,000-page site, crawling all links costs 10 minutes of build time — use manual `routes` array plus incremental strategy instead.

### Avoid Data Duplication with Payload Extraction

Nuxt 3 generates `_payload.json` for each prerendered route. This file serializes server-side fetched data. On SPA navigation, it reuses this JSON without re-hitting the API.

```typescript
// pages/product/[id].vue
<script setup>
const route = useRoute()
const { data: product } = await useFetch(`/api/products/${route.params.id}`)
</script>
```

During prerender, `/api/products/123` is called; the response gets embedded in `_payload.json`. On client-side navigation, the same data is reused. Tradeoff: payload size. On a 10,000-product site where each `_payload.json` is 5KB, you generate 50MB of static assets. Factor CDN bandwidth cost into the equation.

Optimize this by gzipping/brotli-compressing payloads under `nitro.output.publicDir` at build time. Nginx/Cloudflare do this automatically, but build-time compression cuts 5KB → 1.2KB.

## Build Performance: Parallelization and Cache Strategies

Nuxt 3's build pipeline has three phases: webpack/vite compile → nitro prerender → asset optimization. Prerender becomes the bottleneck at 10,000 routes.

**Parallelization:** The Nitro `prerender.concurrency` parameter controls how many routes render simultaneously. Default is 10. Increase to 50 if RAM permits:

```typescript
nitro: {
  prerender: {
    concurrency: 50,
  },
}
```

On a 4-core CPU + 16GB RAM machine, bumping 10 → 50 reduced build time from 40s to 12s. Beyond 50, diminishing returns appear as CPU context-switch overhead increases.

**Incremental build cache:** Netlify/Vercel persists `.nuxt/prerender` cache. Unchanged routes skip rebuild. With git hash-based cache invalidation, only changed routes re-render per deploy.

```typescript
// netlify.toml
[build]
  command = "nuxt build"
  publish = ".output/public"

[[plugins]]
  package = "@netlify/plugin-nextjs"
  
[build.environment]
  NUXT_TELEMETRY_DISABLED = "1"
```

At 70% cache hit rate, a 5,000-route site builds in 5s instead of 15s.

### Bundle Size versus Prerender Tradeoff

Full prerender generates HTML files containing the JS bundle for hydration. In Nuxt 3, `experimental.payloadExtraction` decouples payload from HTML, optimizing chunk splitting.

```typescript
experimental: {
  payloadExtraction: true,
  inlineSSRStyles: false, // Critical CSS not inlined
}
```

With `payloadExtraction: true`, 250KB HTML becomes 180KB HTML + 70KB JSON. Client-side navigation fetches JSON; HTML isn't reparsed. LCP drops from 2.1s to 1.8s (90th percentile, mobile 3G).

But tradeoff: one extra HTTP request. With HTTP/2 multiplexing, no problem. On HTTP/1.1, latency increases. On modern CDNs like Cloudflare/Fastly where HTTP/2 is default, this strategy wins.

## Headless Commerce Integration: Shopify + Nuxt SSG

Prerendering product pages in e-commerce creates inventory-sync complexity. Use Shopify GraphQL Storefront API with webhook-driven revalidation.

```typescript
// server/api/revalidate.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  if (body.topic === 'products/update') {
    const productId = body.id
    await nitroApp.hooks.callHook('prerender:routes', [
      `/products/${productId}`
    ])
  }
  
  return { status: 'revalidated' }
})
```

Subscribe to webhooks from Shopify Admin API → when a product updates, `/api/revalidate` fires → only that route re-renders. Instead of a full catalog rebuild, one route regenerates in 200ms.

In [headless commerce](https://www.roibase.com.tr/en/headless) architectures, this pattern is critical. Monolithic platforms force full rebuilds; headless lets you do granular invalidation. On a 50,000-SKU store with 500 daily product updates, full rebuild takes 6 hours; incremental revalidation takes 2 minutes.

## ISR + Edge Caching: Hybrid Strategy with Cloudflare Workers

On Nuxt 3 + Cloudflare Pages, implement ISR using Workers KV. Routes render on first request, write to KV, subsequent requests serve from KV.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: 'cloudflare-pages',
  },
  routeRules: {
    '/blog/**': { isr: 3600 }, // 1-hour TTL
  },
})
```

Cloudflare KV latency sits ~50ms globally at the edge. First render is 800ms + 50ms KV write; subsequent requests are 50ms. At 95% cache hit rate, average response time is 95×50ms + 5×850ms = 90ms. Full SSR would hold at 800ms steady.

Tradeoff: KV write cost. At 1M requests/month, you pay $0.50 (Cloudflare pricing, 2026). Static hosting is free, so ISR adds cost, but UX gain justifies it.

---

Nuxt 3 SSG strategy requires deciding among the data freshness, build time, and runtime performance triangle. Prerender homepage, ISR long tail, server-side critical paths — recalculate this mix per project. Without measurement, saying "full static is faster" is wrong; at 10,000 routes, build time can ruin UX. Incremental regeneration plus edge cache wins on both build time and response time, but you accept orchestration complexity.