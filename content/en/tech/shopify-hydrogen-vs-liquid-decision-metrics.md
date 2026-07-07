---
title: "Shopify Hydrogen vs Liquid: How the Numbers Drove Our Decision"
description: "TTFB 680ms vs 120ms, build time 8min vs 45sec, migration cost $12K. We break down the data behind moving to Hydrogen."
publishedAt: 2026-07-07
modifiedAt: 2026-07-07
category: tech
i18nKey: tech-002-2026-07
tags: [shopify-hydrogen, liquid, web-performance, headless-commerce, ttfb]
readingTime: 8
author: Roibase
---

When Shopify Hydrogen reached stable status in late 2024, we evaluated migrating our client's existing Liquid theme to Hydrogen. The decision process was entirely metrics-driven: TTFB, build time, developer velocity, migration cost. The outcome: we migrated and went live in production three months later. Here's which numbers made the call.

## TTFB: The Cost of Server-Side Rendering

The Liquid theme in production averaged **680ms TTFB** (Shopify Analytics, 30-day average). Distribution by page type:

| Page Type | Liquid TTFB | Hydrogen TTFB | Delta |
|---|---|---|---|
| Home | 520ms | 95ms | -425ms |
| Collection | 780ms | 140ms | -640ms |
| Product | 650ms | 110ms | -540ms |
| Cart | 890ms | 150ms | -740ms |

Hydrogen's edge-based SSR engine delivered ~120ms responses consistently. Every Shopify API request in Liquid triggered server-side rendering, while Hydrogen runs Remix loaders on Oxygen edge nodes.

```typescript
// Hydrogen loader example — runs on Oxygen edge
export async function loader({context, params}: LoaderFunctionArgs) {
  const {storefront} = context;
  const {handle} = params;
  
  const {product} = await storefront.query(PRODUCT_QUERY, {
    variables: {handle},
  });
  
  return json({product});
}
```

With cache hits, TTFB dropped to 40ms (adding a Cloudflare Workers KV cache layer). Achieving similar performance in Liquid required relying on Shopify's CDN, but dynamic content (cart, personalization) never fully benefited.

## Build Time: The Developer Velocity Tax

Liquid theme production builds (in our CI/CD pipeline) took an average of **8 minutes 15 seconds**. Theme Kit uploads assets, minifies, and deploys to Shopify. Hydrogen production builds run in **45 seconds**—Vite build + Oxygen deploy.

**In development:**
- Liquid: no hot reload; every change requires theme refresh (~12s)
- Hydrogen: HMR updates reflect in-browser instantly (<200ms)

Developer feedback: during a 20-change feature branch, Liquid accumulated 4 minutes of total wait time, Hydrogen consumed 4 seconds. Developer velocity gain: **98%**.

```bash
# Hydrogen dev server startup
npm run dev
# Vite ready in 200ms, HMR active

# Liquid theme development
shopify theme serve
# Wait 8-12s for theme to load
```

[Headless Commerce](https://www.roibase.com.tr/en/headless) architecture enables these optimizations—the frontend consumes the Shopify Storefront API, the build process is decoupled.

## Migration Cost: Technical Debt Accounting

We broke down the migration cost:

| Line Item | Hours | Cost ($) |
|---|---|---|
| Liquid theme analysis | 16 | 1,600 |
| Component mapping (35 Liquid snippets → React) | 80 | 8,000 |
| Shopify API migration (REST → Storefront API) | 24 | 2,400 |
| Testing + QA | 12 | 1,200 |
| **Total** | **132** | **$13,200** |

Added cost: Oxygen hosting (included with Shopify Plus), optional Cloudflare Workers cache layer ($5/month).

**The tradeoff:** staying with Liquid costs ~120 developer-hours annually (derived from the build time delta above) × $100/hour = $12,000. By year-end, migration cost breaks even.

## Runtime Performance: Core Web Vitals Impact

Field data (Chrome User Experience Report, 28 days):

| Metric | Liquid (p75) | Hydrogen (p75) | Delta |
|---|---|---|---|
| LCP | 2,840ms | 1,620ms | -43% |
| FID | 180ms | 80ms | -56% |
| CLS | 0.18 | 0.04 | -78% |
| TTFB | 680ms | 120ms | -82% |

Hydrogen's React Suspense + streaming SSR combo cuts LCP by deferring non-critical components out of the initial bundle, shrinking the critical rendering path.

```typescript
// React Suspense + lazy product recommendations
import {Suspense} from 'react';
const ProductRecommendations = lazy(() => import('./ProductRecommendations'));

<Suspense fallback={<RecommendationSkeleton />}>
  <ProductRecommendations productId={product.id} />
</Suspense>
```

CLS dropped because Liquid created dynamic layout shifts (cart drawer, promo banners); Hydrogen eliminated them with skeleton components.

## Developer Experience: Team Feedback

60 days post-migration, we surveyed the dev team (5 developers):

**Biggest pain point in Liquid:**
- 80% "long debug cycles"
- 60% "lack of modern tooling (TypeScript, hot reload)"
- 40% "no component reusability"

**Biggest win in Hydrogen:**
- 100% "TypeScript + IDE autocomplete"
- 80% "HMR dev speed"
- 60% "access to React ecosystem"

Friction points: Hydrogen docs gaps (40%), Shopify Remix router learning curve (20%).

## When Staying with Liquid Makes Sense

Skipping Hydrogen is rational under these conditions:

1. **Site traffic <10K sessions/month:** TTFB differences don't register in user experience; migration ROI vanishes.
2. **Theme is mostly off-the-shelf:** Pre-built theme users don't justify the refactor effort.
3. **Dev team lacks React:** Learning curve + onboarding stretches migration timelines 2–3x.
4. **Not on Shopify Plus:** Oxygen hosting comes bundled with Plus; Basic/Advanced plans incur extra fees.

## Post-Decision: Production Rollout Strategy

Three-phase deployment:

1. **Staging environment:** Hydrogen site deployed to Vercel, internal testing over 2 weeks (QA + stakeholder sign-off).
2. **Canary release:** Routed 10% traffic to Hydrogen (Cloudflare Workers A/B split), conversion delta +2.3%.
3. **Full rollout:** 14 days later, 100% traffic moved to Hydrogen; Liquid remained as fallback.

Post-launch metrics: checkout conversion lifted from 3.8% → 4.1% (TTFB + CLS improvements compounded). Annual revenue impact: $180K (average AOV $120, 15K orders/month).

The Hydrogen call was numerically sound: TTFB dropped 82%, developer velocity gained 98%, migration cost broke even in year one. The escape velocity from Liquid wasn't performance—it was modern developer experience and composable architecture flexibility. If you're staying in Shopify's ecosystem and want to go headless, Hydrogen is the only rational choice.