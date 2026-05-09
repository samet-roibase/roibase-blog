---
title: "Shopify Hydrogen vs Liquid: The Numbers Behind Our Decision"
description: "TTFB 840ms → 180ms, build time 12m → 90s. The metrics, tradeoffs, and migration cost breakdown behind our Hydrogen transition."
publishedAt: 2026-05-09
modifiedAt: 2026-05-09
category: tech
i18nKey: tech-002-2026-05
tags: [shopify-hydrogen, headless-commerce, web-performance, remix, ttfb]
readingTime: 8
author: Roibase
---

We ran Shopify Liquid themes for 7 years. When theme customization limits, fixed server response times, and monolithic deploy cycles started constraining us, the word "headless" came up. But one question blocked the decision: how would we measure the ROI of moving to Hydrogen? This article details the numerical answer we found — TTFB, build time, developer velocity, migration cost. We chose Hydrogen because it wasn't just a framework; it delivered measurable performance gains.

## Liquid's Performance Ceiling

Shopify's Liquid theme engine returns server-rendered HTML. The server parses Liquid syntax, makes Storefront API calls, assembles HTML, and sends it to the client. The architecture is simple and stable — but it has limits.

Our production store had a median TTFB of 840ms (RUM data, Cloudflare Analytics). The 95th percentile hit 1.4 seconds. Shopify's server response time is beyond our control — shared infrastructure. Even optimizing our Liquid theme files (lazy-loading unused sections, reducing snippet count) couldn't touch the server-side latency floor.

Build time was a separate pain. Changes to theme files got pushed via Shopify CLI. Average deploy time: 12 minutes. In a CI/CD pipeline, that's waiting between staging and production. A/B test iteration speed dropped. Developer velocity suffered.

```bash
# Liquid theme deploy (average)
shopify theme push --store=production
⏱ Upload: 4m 20s
⏱ Processing: 7m 40s
✅ Total: 12m 00s
```

Liquid's tradeoff: simple setup, zero infrastructure management — but no performance control, slow iteration.

## Hydrogen's Technical Promise

Hydrogen is Shopify's headless framework built on Remix. React Server Components, streaming SSR, edge deployment. The architectural shift: Liquid renders HTML on Shopify's servers. Hydrogen lets you deploy your own edge node (Oxygen, Cloudflare, Vercel). You call the Storefront API directly, stream the response through your component tree.

TTFB promise: render from an edge node and Shopify's server latency vanishes. Deploy to Cloudflare Workers and median TTFB drops to 100–200ms (Cloudflare's POP latency + Storefront API RTT). Build time promise: Vite-based build, incremental deploy, under 2 minutes.

But promises come with costs: migration effort, developer learning curve, infrastructure ownership. We modeled these tradeoffs numerically before moving forward.

### Benchmark Methodology

We set up two environments:
1. **Liquid Baseline:** Production store, Dawn theme fork, 80+ sections, Cloudflare proxy (cache bypass)
2. **Hydrogen Prototype:** Same homepage component tree, Cloudflare Workers deploy, Storefront API 2024-01

Test setup:
- WebPageTest (Dulles location, Moto G4, 3G Fast)
- Median values from 3 runs
- Cold cache state (flush before each test)

Metrics:
- TTFB (Time to First Byte)
- LCP (Largest Contentful Paint)
- TBT (Total Blocking Time)
- Build time (measured in CI/CD)

## Performance Comparison

Results (median of 3 runs):

| Metric | Liquid | Hydrogen | Change |
|---|---|---|---|
| **TTFB** | 840ms | 180ms | **-79%** |
| **LCP** | 2.4s | 1.1s | **-54%** |
| **TBT** | 680ms | 220ms | **-68%** |
| **Build Time** | 12m 00s | 1m 30s | **-88%** |

TTFB drop matched our expectations. Hydrogen's Cloudflare Workers edge node reaches the Storefront API with 40–60ms RTT (Shopify's CDN already sits on Cloudflare). Liquid hits a 600ms+ minimum from Shopify's server doing Liquid parse + API call + HTML concatenation.

LCP gains came from streaming SSR. Hydrogen sends the first byte early and streams HTML. Critical content (hero image, above-the-fold product grid) renders first; below-the-fold lazy loads. Liquid blocks: entire page must be ready before it's sent.

TBT drop came from bundle size + hydration optimization. We used React Server Components in Hydrogen — client-side JS bundle is 120KB (gzip). The old Liquid theme had jQuery + custom scripts at 340KB. Hydration time fell.

Build time difference directly impacts developer velocity. 12 minutes becomes 90 seconds. Deploy 10 times a day and you save 115 minutes. CI/CD pipeline accelerates, A/B test iteration cycles shrink.

```typescript
// Hydrogen streaming SSR example (Remix loader)
export async function loader({ context }: LoaderFunctionArgs) {
  const { storefront } = context;
  
  const productsPromise = storefront.query(PRODUCTS_QUERY);
  const collectionsPromise = storefront.query(COLLECTIONS_QUERY);
  
  // Stream: first response returns immediately
  return defer({
    products: productsPromise,
    collections: collectionsPromise,
  });
}
```

The `defer` API streams promises. Client gets initial HTML; page renders progressively as data arrives. TTFB stays low.

## Migration Cost Breakdown

Performance gains are clear — but what about transition costs? Here's our breakdown:

**Development Effort:**
- Theme → Hydrogen component migration: 160 hours (2 senior devs, 4 weeks)
- Storefront API integration (GraphQL query rewrite): 40 hours
- CI/CD pipeline setup (Cloudflare Workers): 16 hours
- QA + edge case fixes: 24 hours
- **Total:** 240 hours

**Infrastructure Cost:**
- Cloudflare Workers: $5/mo (free up to 100K requests — our traffic is 80K/mo)
- Oxygen (Shopify's edge platform): $20/mo starter tier
- We chose Cloudflare — already using their proxy

**Maintenance Overhead:**
- Hydrogen updates every 6 months (Remix upstream tracking)
- Developer learning curve: team needs React + Remix experience
- Liquid used Shopify Theme Store templates — Hydrogen requires custom dev

One-time migration cost total: **240 hours × $80/hour = $19,200**. Annual infrastructure: **$60**.

How did we model the returns? Two buckets:

1. **Conversion Rate Impact:** Core Web Vitals correlate with conversion rate (Google/Deloitte study: 0.1s LCP drop = 1–2% conversion lift). Our LCP dropped 1.3s — conservative estimate 1.5% lift. On $200K monthly revenue = $3K/month lift. Annual: **$36K**.

2. **Developer Velocity:** Build time dropped 88%. Team does ~40 deploys monthly. 10.5 minutes saved per deploy = 420 minutes/month = 7 hours. At $80/hour senior rate = $560/month savings. Annual: **$6.7K**.

Payback period: $19,200 / ($36K + $6.7K) = **5.4 months**.

The numbers justified the migration. Performance gains + developer velocity ROI covers migration cost in half a year.

## Tradeoffs and Limits

Hydrogen isn't right for every store. Liquid makes more sense here:

**Stay with Liquid:**
- Traffic low (<10K/mo visitors) — TTFB difference won't impact conversion
- Team doesn't know React/TypeScript — learning curve doubles migration cost
- Theme Store template covers your needs — minimal customization required
- Don't want infrastructure ownership — Shopify's shared server is simpler

**Move to Hydrogen:**
- Traffic high (>50K/mo) — every 100ms TTFB affects conversion
- Custom UI/UX required — [headless architecture](https://www.roibase.com.tr/en/headless) gives flexibility
- A/B test iteration speed is critical — CI/CD must be sub-2-minute
- Developer team comfortable with modern frontend (React/Remix)

Hydrogen carries maintenance costs too. Remix sees major versions every 6 months. Hydrogen tracks these. Liquid has Shopify's backward-compatibility guarantee — old themes run for years. Hydrogen demands disciplined dependency updates.

Edge deployment has constraints. Cloudflare Workers has runtime limits (50ms CPU, 128MB memory). Complex logic (recommendation engines) won't run on edge — offload to an origin server. Liquid has no such friction; server-side is unlimited.

## Where We Are Now

We chose Hydrogen because TTFB dropped 79%, build time fell 88%, payback period is 5.4 months. But we made that decision with a cost model, tradeoff list, and numbers.

If you're considering Hydrogen, answer these first: How many monthly visitors? Does your team know React? Do you need custom UI/UX? Do you have a CI/CD pipeline? "Yes" to these questions means build a numerical model — convert TTFB gains into conversion lift, quantify developer velocity in hours saved. If those numbers justify migration cost, move forward.

If you're evaluating headless transitions generally, we can help build a Hydrogen migration roadmap under [Shopify Partnership Services](https://www.roibase.com.tr/en/shopify) — benchmarks, cost models, incremental rollout plans included.