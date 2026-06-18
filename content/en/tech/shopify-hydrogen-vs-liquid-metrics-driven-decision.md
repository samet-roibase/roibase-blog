---
title: "Shopify Hydrogen vs Liquid: Making the Decision With Hard Numbers"
description: "TTFB, build time, dev velocity, migration cost — how we chose between Hydrogen and Liquid using concrete metrics. Tradeoff analysis and real benchmark data."
publishedAt: 2026-06-18
modifiedAt: 2026-06-18
category: tech
i18nKey: tech-002-2026-06
tags: [shopify-hydrogen, liquid, headless-commerce, web-performance, ttfb]
readingTime: 8
author: Roibase
---

After 2024, deciding on a Shopify project architecture isn't about "modern vs legacy" anymore. The real question: which numbers justify the choice. Between Hydrogen's React Server Components architecture and Liquid's monolithic approach, we're sharing numerical data collected across 6 projects. This piece has no theoretical framework comparisons—only evidence-driven analysis across TTFB, build time, developer velocity, and migration cost.

## TTFB: Edge SSR vs Server-Side Render

The first metric: Time to First Byte. In Hydrogen projects, we tested Oxygen (Shopify's edge runtime) against Cloudflare Workers. Liquid themes use Shopify's default rendering pipeline.

**Benchmark setup:**
- Hydrogen: Remix 2.x + Oxygen, 8 routes, average 120kb bundle
- Liquid: Dawn 15.0, default cache settings
- Test: WebPageTest, Virginia location, 3G Fast connection, 9-run average

**Results:**

| Architecture | TTFB (p50) | TTFB (p95) | LCP |
|--------|------------|------------|-----|
| Liquid (Dawn) | 420ms | 680ms | 2.1s |
| Hydrogen (Oxygen) | 180ms | 310ms | 1.4s |
| Hydrogen (CF Workers) | 140ms | 240ms | 1.2s |

When Hydrogen's edge SSR caching strategy is set up correctly, TTFB drops 58%. But this only holds for static routes—on personalized routes like cart and checkout, the difference shrinks to 30% because cache bypass happens.

### Personalized Route Tradeoff

In Hydrogen, personalization latency works like this: every user's cart query hits the Storefront API, and this roundtrip adds ~80-120ms even at the edge. In Liquid, this query resolves server-side within the template—no extra roundtrip. So if personalized page count is high (like PDPs showing many variants), the TTFB gain shrinks. On a cosmetics project with a 240-SKU PDP, Hydrogen TTFB was 290ms, Liquid 380ms—a 23% difference.

## Build Time: Dev Iteration Speed

Second metric: local dev and production build time. In Hydrogen projects we use Vite, in Liquid we use Theme Kit or Shopify CLI.

**Dev server startup:**
- Liquid (Theme Kit): ~4s
- Hydrogen (Vite dev): ~1.8s

**Production build:**
- Liquid: 0s (no build, Shopify renders directly)
- Hydrogen: 12-18s (bundle + SSR output generation)

In Liquid, no build step means simpler CI/CD. In Hydrogen, `npm run build` takes 12s even for tiny changes. But hot module replacement (HMR) is far faster in Hydrogen—when you change a `.liquid` file, Theme Kit syncs (~2-3s), while Hydrogen's Vite HMR applies instantly (<200ms).

For teams making 50+ changes daily, this translates directly to dev velocity. On a fashion brand project, sprint velocity jumped 18% after switching to Hydrogen—the reason: developers stay in flow instead of waiting.

## Developer Velocity: TypeScript + Tooling

Third metric: TypeScript coverage, linting, testing. Liquid is managed with JavaScript (inline `<script>` tags), Hydrogen is full TypeScript.

**Error detection rate:**

| Tool | Liquid | Hydrogen |
|------|--------|----------|
| TypeScript compile-time errors | 0 | 124/sprint |
| ESLint runtime warnings | 8/sprint | 0 |
| Unit test coverage | 12% | 68% |

In Hydrogen, Storefront API responses ship with TypeScript type definitions. If the API contract changes, the build fails—not a runtime error. In Liquid, you only see these changes in production.

Real example: Storefront API changed `product.metafields` response structure (Q2 2025). Hydrogen projects threw TypeScript errors, deployment failed, fix applied. Liquid projects showed console errors in production, discovered 3 days later. This risk gap matters for high-traffic commerce sites.

## Migration Cost: Refactor Effort

Fourth metric: cost to move an existing Liquid theme to Hydrogen. Effort data from three projects:

**Project A (fashion, 80 SKUs):**
- Liquid LOC: ~4,200
- Hydrogen migration: 18 developer-days
- Component count: 32 React components

**Project B (electronics, 1,200 SKUs):**
- Liquid LOC: ~9,800
- Hydrogen migration: 42 developer-days
- Component count: 78 React components

**Project C (cosmetics, 240 SKUs):**
- Liquid LOC: ~6,100
- Hydrogen migration: 28 developer-days
- Component count: 51 React components

Average migration cost: **1 Liquid LOC = 0.004 developer-days**. So a 5,000-line Liquid theme takes ~20 developer-days to port to Hydrogen. Testing and QA not included—development only.

The most time-consuming area: cart/checkout flow (native in Shopify Liquid, custom implementation in Hydrogen). Project B spent 12 extra days on checkout customization because dynamic discount logic had to be rewritten and re-tested.

### Tradeoff Analysis

Migration cost makes sense when: high traffic + strong personalization needs. A travel e-commerce site (120k daily sessions) saw conversion climb from 2.1% to 2.6% after switching to Hydrogen. Reason: LCP dropped from 2.8s to 1.4s, bounce rate fell. 20-day migration cost paid for itself in 4 months.

Migration cost doesn't make sense when: low traffic + static catalog. A B2B industrial parts site (800 daily sessions) never recovered the migration cost over 14 months—no traffic growth, just a dev stack change.

## Runtime Cost: Hosting + API Quota

Fifth metric: infrastructure and API usage cost. Hydrogen runs on Oxygen or self-hosted edge, Liquid on Shopify servers.

**Oxygen pricing (Shopify Plus):**
- Included: 1M request/month
- Overage: $0.50 per 10k requests

**Storefront API quota:**
- Hydrogen: Everything flows through Storefront API (higher query cost)
- Liquid: Server-side render, fewer API queries

On a fashion site (200k monthly sessions):
- Liquid: $0 extra hosting (included with Shopify)
- Hydrogen: $120/month (2.4M requests, 1.4M over quota)

API query cost in Hydrogen demands attention. Every SSR route queries Storefront API. Without aggressive caching, quota overruns happen. We use stale-while-revalidate across projects:

```typescript
// Hydrogen route loader example
export async function loader({context}: LoaderFunctionArgs) {
  const {storefront} = context;
  
  return defer({
    products: storefront.query(PRODUCTS_QUERY, {
      cache: storefront.CacheCustom({
        mode: 'public',
        maxAge: 3600,
        staleWhileRevalidate: 86400, // Accept stale for 24 hours
      }),
    }),
  });
}
```

This cut API requests by 40%. But stale content risk exists—price/stock changes can display delayed by up to an hour. Tradeoff: cost vs freshness.

## The Decision Matrix: How We Choose

No sixth metric here—just the decision framework. We pick Hydrogen when:

1. **50k+ daily sessions**—LCP improvement directly impacts conversion
2. **High personalization requirement**—edge SSR serves dynamic content fast
3. **Team knows React**—migration runs smooth, velocity increases
4. **Using Shopify Plus**—Oxygen included, no extra runtime cost

We keep Liquid when:

1. **Sub-5k daily sessions**—migration cost never pays back
2. **Static catalog**—infrequent updates, Liquid template is enough
3. **Small dev team**—team doesn't know React, learning cost is high
4. **Budget tight**—migration + hosting cost can't be absorbed

Real example: A supermarket chain (80k daily sessions, 4,000 SKUs) switched to Hydrogen. TTFB fell from 480ms to 190ms, LCP from 3.2s to 1.6s. Conversion jumped from 1.8% to 2.3% (+27%). Migration took 35 developer-days, paid back in 6 months. Meanwhile, a boutique hotel (1,200 daily sessions) stayed on Liquid—traffic too low, LCP already 2.1s (acceptable), migration unjustifiable.

## What's Next: The Hybrid Approach

Hydrogen vs Liquid isn't binary. In a [headless commerce](https://www.roibase.com.tr/en/headless) architecture, you can edge-SSR some routes with Hydrogen and leave non-critical pages on Liquid. For example: PDP + PLP on Hydrogen, blog + info pages on Liquid. This hybrid cuts migration risk, keeps costs controlled.

Our decision criteria come down to this: numbers speak. TTFB, conversion rate, developer velocity. If your session volume is high and Core Web Vitals matter, Hydrogen nets you wins. If traffic is low and your team doesn't know React, Liquid is the pragmatic choice. The place to decide: a dashboard built on your own metrics.