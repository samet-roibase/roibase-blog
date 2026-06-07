---
title: "Composable Commerce: MACH Architecture Production Reality"
description: "BigCommerce, commercetools, Shopify Plus — what flexibility does MACH promise? What are the real costs in production and what will you accept?"
publishedAt: 2026-06-07
modifiedAt: 2026-06-07
category: tech
i18nKey: tech-005-2026-06
tags: [composable-commerce, mach-architecture, headless-commerce, shopify-plus, bigcommerce]
readingTime: 8
author: Roibase
---

Composable commerce has been positioned as the market's "new standard" since 2024. MACH principles (Microservices, API-first, Cloud-native, Headless) are being sold as the replacement for centralized monolithic platforms. But in production, reality differs: BigCommerce Catalyst bundle runs 850kB, commercetools requires a minimum integration cost of $120k, and Shopify Plus's composable features come with the migration burden of Hydrogen 2.0. Before deciding, tradeoffs need to be discussed in numbers.

## The Real Cost of MACH's Promise

The core promise of composable architecture is flexibility: frontend, backend, payment, search — each independent, swappable when needed. But this flexibility translates into three cost categories.

**First cost: integration startup time.** On API-only platforms like commercetools, you build the entire experience from frontend to checkout yourself. Average MVP: 16-20 weeks. The same experience on Shopify Plus takes 4 weeks. BigCommerce's Catalyst starter splits the difference: pre-built Next.js + GraphQL Storefront API setup, but you still need to customize every component from product listing to cart state (8-12 weeks).

**Second cost: backend coordination.** In a MACH environment, each service is independent — but data synchronization between them falls on you. Example: inventory service (Fluent Commerce), pricing (Pimcore), promotions (Talon.One) run on separate endpoints. For these services to work in real-time, an event bus (Kafka / AWS EventBridge) is mandatory. Mid-market e-commerce: minimum 3 engineer-months goes into this orchestration.

**Third cost: bundle size.** Headless equals custom frontend code. BigCommerce Catalyst: 850kB JavaScript (240kB after gzip). Shopify Hydrogen 2.0: uses React Server Components, but still averages 320kB. commercetools's example Next.js frontend: 950kB (add client-side cart state management). Comparison: Shopify Liquid theme 120-180kB. Because HTML is server-rendered, JavaScript is minimal.

## BigCommerce Catalyst: The Compromise Middle Ground

BigCommerce launched Catalyst in 2023: Next.js-based, pre-integrated GraphQL Storefront API. The company positions it as "best of both worlds" — monolith speed plus headless flexibility.

**Strengths:** Catalyst comes with PLP (product listing page), PDP, cart, and checkout components pre-built. The GraphQL schema syncs with the Storefront API. This means frontend developers focus on UI rather than writing cart logic from scratch. Deployment: push to Vercel / Netlify, BigCommerce webhooks trigger the build. MVP time: 8 weeks — half of commercetools.

**Weaknesses:** Flexibility remains limited. For example, fully customizing checkout binds you to BigCommerce's Checkout SDK. Third-party payment provider integration (like Adyen) happens via REST API + BigCommerce control panel — no React component-level control. Bundle size issues persist: Catalyst's default setup is 850kB. If your Core Web Vitals LCP target is 2.5s, this bundle can push LCP to 4.2s on 3G connections (Lighthouse simulation).

### Code Example: Catalyst PLP Optimization

```javascript
// app/[locale]/(default)/category/[slug]/page.tsx
// Catalyst default PLP eager loads 48 products
// Reduce to 12 and add deferred pagination

export default async function CategoryPage({ params }) {
  const products = await getProducts({
    categoryId: params.slug,
    first: 12, // 48 → 12 reduced
  });

  return (
    <div>
      <ProductGrid products={products.edges} />
      <LoadMoreButton cursor={products.pageInfo.endCursor} />
    </div>
  );
}

// client component: LoadMoreButton
'use client';
export function LoadMoreButton({ cursor }) {
  const [items, setItems] = useState([]);
  
  async function loadMore() {
    const res = await fetch(`/api/products?after=${cursor}&first=12`);
    const data = await res.json();
    setItems(prev => [...prev, ...data.edges]);
  }

  return <button onClick={loadMore}>Load More</button>;
}
```

This change reduces the initial bundle from 850kB to 620kB (27% reduction). LCP drops from 4.2s to 2.9s. Still heavier than Shopify Liquid, though.

## commercetools: Maximum Flexibility, Maximum Burden

commercetools positions itself as "true headless." API-only backend, no UI components. You build the entire frontend — Next.js, Vue, Svelte, your choice.

**Strengths:** Complete flexibility. You can implement custom cart logic, checkout flow entirely under your control. For example, multi-currency plus regional tax calculation, server-side personalized pricing (critical for B2B) — all via commercetools API requests. Both GraphQL and REST are supported in parallel — use whichever endpoint performs better.

**Weaknesses:** High startup cost. Average MVP from commercetools implementation partners: $120k-$180k (6 months). Half that time goes to backend setup (product catalog import, pricing rules, inventory sync), the other half to frontend. Plus ongoing costs: commercetools licensing isn't transaction-based but a platform fee — starting at $50k annually (mid-market). Frontend hosting and CDN are separate (Vercel Enterprise: $2k/month).

**Performance reality:** commercetools API response time averages 120-180ms (from European servers, cache miss scenario). You can cache this at the edge (Cloudflare Workers KV / Vercel Edge Config), but you write the invalidation logic. Example: product price changes → commercetools webhook → Cloudflare Workers → KV purge. This pipeline is custom per project.

## Shopify Plus: Hybrid Composability

Shopify entered the composable world with Hydrogen 2.0. But the approach differs: Liquid themes remain supported; Hydrogen is optional. Hybrid strategy: use headless if you need it, otherwise Liquid for speed.

**Hydrogen 2.0 advantages:** Uses React Server Components — this balances server-side rendering with client-side interactivity effectively. Example: product page hero image renders on the server (as HTML), "add to cart" button is a client component (JavaScript). Result: initial bundle 320kB, but LCP 1.8s (Shopify CDN is fast, RSC overhead is low).

**Hydrogen 2.0 challenges:** Migration burden. If you have an existing Shopify Plus store using a Liquid theme, moving to Hydrogen means a new frontend. Liquid → React migration: 12-16 weeks. Also, Hydrogen requires Storefront API 2024 — some old Liquid variables (like `product.metafields`) need different GraphQL query patterns.

**Liquid advantage:** Still the fastest option. Because HTML renders on the server, JavaScript is minimal. Example: Shopify Dawn theme (default Liquid theme): 120kB bundle, LCP 1.2s. Is the flexibility headless provides worth this speed? Depends on use case. If you need checkout customization (like B2B approval workflows), Hydrogen makes sense. For standard e-commerce, Liquid still wins.

### Tradeoff Table

| Criterion | Shopify Liquid | Shopify Hydrogen | BigCommerce Catalyst | commercetools |
|-----------|----------------|------------------|----------------------|---------------|
| MVP time | 4 weeks | 12 weeks | 8 weeks | 24 weeks |
| Bundle size | 120kB | 320kB | 620kB (optimized) | 400-600kB |
| LCP (3G) | 1.2s | 1.8s | 2.9s | 2.5s (cached) |
| Checkout flexibility | Low (Shopify SDK) | Medium (Hydrogen checkout) | Medium (SDK) | Full |
| Startup cost | $15k-30k | $60k-90k | $50k-80k | $120k-180k |
| Annual platform fee | ~$24k (Plus) | ~$24k + Vercel | ~$36k (Enterprise) | $50k+ |

## How to Make the Decision

Composable commerce is sold as the "future," but it doesn't fit every project. Decision criteria need to be discussed through concrete scenarios.

**Scenario 1: Standard B2C e-commerce, 500k-2M orders annually.** Liquid wins. Bundle size is low, LCP target is met, checkout integrates with Shopify Payments. Moving to headless triples bundle size, pushes LCP from 1.2s to 1.8s (conversion impact: 0.2-0.5% loss). Without flexibility that justifies this tradeoff, don't move.

**Scenario 2: B2B wholesale, custom approval workflow, regional pricing.** commercetools makes sense. Because Shopify Plus's B2B feature (B2B on Shopify) has limited approval logic. On commercetools, you can build a custom cart rule engine: "Orders over $10k require procurement approval" — that kind of thing. API flexibility justifies the ROI here.

**Scenario 3: Existing Shopify store, checkout customization needed.** Hydrogen 2.0. Because you stay in the Shopify ecosystem (app integrations preserved), but control checkout as a React component. Migration time: 12 weeks — half of commercetools. Platform fee doesn't change (you already pay for Shopify Plus).

**Scenario 4: Multi-channel (e-commerce plus mobile app plus marketplace), headless is mandatory.** BigCommerce Catalyst could be a middle path. Because the GraphQL Storefront API serves both web and app, but integration cost doesn't match commercetools. React Native mobile app? Catalyst components can be adapted (web → native code sharing).

## Closing: Accept Flexibility's Price Tag

MACH architecture delivers flexibility, but that flexibility comes back as bundle size, initial cost, and integration burden. Shopify Liquid remains the fastest production option — if your scenario fits Liquid, moving to headless is overengineering, not optimization. BigCommerce Catalyst is the middle ground: pre-built components plus GraphQL flexibility, but checkout has limits. commercetools is full flexibility: $120k startup plus ongoing orchestration burden. Hydrogen 2.0 is headless within the Shopify ecosystem — but heavier than Liquid. Make your decision based on whether your use case justifies the tradeoffs. In production, numbers speak before promises do.