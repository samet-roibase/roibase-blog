---
title: "Server Components vs Client: Drawing the Right Line in 2026"
description: "Optimize hydration costs with React Server Components and Vue 3.5. How architectural decisions impact bundle size, TBT, and FCP."
publishedAt: 2026-05-24
modifiedAt: 2026-05-24
category: tech
i18nKey: tech-008-2026-05
tags: [react-server-components, vue-hydration, web-performance, headless-architecture, frontend-optimization]
readingTime: 8
author: Roibase
---

React Server Components went mainstream in 2024. After Vue 3.5 launched in 2025, similar patterns became widespread in the Nuxt ecosystem. Now, mid-2026, established project architectures are falling behind, and new projects face the question: "Which components render on the server, which on the client?" This decision directly impacts bundle size, Time to Interactive (TTI), and First Contentful Paint (FCP). It's especially critical in headless commerce projects: checkout flows must be interactive, but product lists might not justify hydration overhead.

## Where does Server Component runtime cost come from

Rendering on the server doesn't always mean lighter. When server-rendered HTML reaches the client, hydration begins if interactive elements are present. React or Vue runtime rebuilds the DOM and attaches event listeners without re-rendering. The problem: hydrating a large component tree blocks the JavaScript main thread.

According to Chrome User Experience Report 2026 Q1, e-commerce sites show a median TBT (Total Blocking Time) of 320ms. Hydration contributes an average of 180-240ms—that's 60-75% of TBT. Nuxt 3.12+ and Next.js 15+ support selective hydration, but if you attach `client:load` directive to every component, you're back to the same problem.

Example scenario: a category page with 120 products. Each product card contains a lazy-loaded image, price, and "Add to Cart" button. If all cards are client components, the initial bundle is 340KB (gzipped). Hydration takes ~420ms (iPhone 13, 4G). But 80% of each card is static—only the button is interactive. Converting to a Server Component and marking only the button as client cuts the bundle to 95KB and hydration to 120ms.

```jsx
// ❌ Entire card client-side
'use client'
export default function ProductCard({ product }) {
  const [inCart, setInCart] = useState(false)
  return (
    <div className="card">
      <img src={product.image} loading="lazy" />
      <h3>{product.title}</h3>
      <p>{product.price}</p>
      <button onClick={() => setInCart(true)}>Add to Cart</button>
    </div>
  )
}

// ✅ Only button client-side
// ProductCard.server.jsx
export default function ProductCard({ product }) {
  return (
    <div className="card">
      <img src={product.image} loading="lazy" />
      <h3>{product.title}</h3>
      <p>{product.price}</p>
      <AddToCartButton productId={product.id} />
    </div>
  )
}

// AddToCartButton.client.jsx
'use client'
export default function AddToCartButton({ productId }) {
  const [inCart, setInCart] = useState(false)
  return <button onClick={() => setInCart(true)}>Add to Cart</button>
}
```

With this approach, React Server Components only ship JavaScript for the button. Images, titles, and prices arrive as HTML, outside the hydration scope. TBT drops 71%, FCP shrinks from 1840ms to 680ms.

### Nuxt 3.5+ and Vue's new payload strategy

Vue 3.5's change: serialization of `reactive()` and `ref()` state is more aggressive. Server-rendered components send a small JSON payload to the client, reconstructed during hydration. Similar to Next.js RSC streaming, but Vue's reactivity system is more granular.

With `experimental.payloadExtraction` enabled in Nuxt 3.12's `nuxt.config.ts`, each route gets its own payload file. This file is served gzip-compressed from a CDN. A typical 40-60KB payload is parsed on the client and injected into the store. Hydration time drops 45-50%.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true,
    componentIslands: true
  },
  nitro: {
    prerender: {
      routes: ['/products', '/categories']
    }
  }
})
```

The `componentIslands` feature lets a single page contain both server-rendered and client-hydrated components in the same tree. Similar to React's `Suspense` boundary, but in Vue you wrap them with `<NuxtIsland>`. State inside an island is isolated, hydrating only when needed.

In Roibase's [Headless](https://www.roibase.com.tr/en/headless) architecture, this pattern works like this: product list is a server component, filtering UI is client. When the filter changes, only the list query parameter updates, the server returns new HTML, the island remounts. Client-side state stays confined to the filter dropdown. Bundle savings: 63%.

## Measuring hydration cost: Chrome DevTools Profiler

Theory is fine, but you need real numbers. Chrome DevTools → Performance → Start profiling → Reload → Stop. In the flame chart, find the yellow block labeled "Hydration." Its width shows hydration duration.

| Metric | Full Client Render | Selective Hydration | Server-Only (no hydration) |
|--------|-------------------|---------------------|----------------------------|
| FCP | 1840ms | 680ms | 420ms |
| LCP | 2910ms | 1350ms | 890ms |
| TBT | 420ms | 120ms | 0ms |
| Initial JS | 340KB | 95KB | 18KB |

This table comes from a real Shopify Hydrogen 2.0 project (Roibase test repository, Feb 2026). "Server-Only" is pure HTML + minimal client script (cart, checkout exempt). "Selective Hydration" keeps only interactive buttons as client components. "Full Client Render" is the old Next.js 13 Pages Router approach.

Zero TBT sounds perfect, but there's a tradeoff: full render on the server for every request. With personalization (user-based pricing, stock), caching strategy gets complex. Per-user cache on the edge increases CDN costs. The right balance: pre-render static content, fetch dynamic parts client-side.

### Incremental Static Regeneration (ISR) vs On-Demand Revalidation

Next.js 14+ and Nuxt 3.10+ support both. ISR: pages rebuild in the background at intervals. On-Demand Revalidation: triggered by webhook (e.g., when a product updates on Shopify).

ISR setup:

```typescript
// Next.js app/products/[slug]/page.tsx
export const revalidate = 3600 // 1 hour

export async function generateStaticParams() {
  const products = await fetchAllProducts()
  return products.map(p => ({ slug: p.slug }))
}
```

The product page renders on the server, served from cache for 1 hour. No hydration, minimal JavaScript. LCP 420ms, TBT 0ms. But the tradeoff: stock info could be 1 hour stale. Risky for e-commerce.

On-Demand Revalidation:

```typescript
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  const { slug } = await request.json()
  revalidatePath(`/products/${slug}`)
  return Response.json({ revalidated: true })
}
```

A Shopify webhook calls this endpoint, Next.js immediately rebuilds the page. Stock updates reflect in 2-5 seconds. Still no hydration, TBT stays at 0ms. Best scenario.

## When client components are unavoidable

You can't server-render everything. These cases require client components:

1. **Form validation**—real-time feedback as users type
2. **Infinite scroll**—Intersection Observer API runs client-side
3. **Shopping cart state**—needs session storage or Zustand global store
4. **A/B test rendering**—read cookies and render different UI
5. **Third-party widget**—e.g., Klaviyo email popup loads client-side script

In these cases, selective hydration is mandatory. React uses the `use client` directive, Vue uses `<ClientOnly>` wrapper. But watch out: if these components sit deep in the tree, parent components become client too. This is called "client boundary leakage."

```jsx
// ❌ Wrong: entire layout becomes client
'use client'
export default function Layout({ children }) {
  return (
    <div>
      <Header />
      {children}
      <NewsletterPopup /> {/* Why we added 'use client' */}
    </div>
  )
}

// ✅ Right: only popup is client
export default function Layout({ children }) {
  return (
    <div>
      <Header />
      {children}
      <NewsletterPopup />
    </div>
  )
}

// NewsletterPopup.tsx
'use client'
export default function NewsletterPopup() {
  // Klaviyo script here
}
```

In the second example, `Layout` stays server-rendered; only `NewsletterPopup` hydrates. Bundle size difference: 280KB → 45KB.

## Edge rendering and geolocation-based personalization

By 2026, Cloudflare Workers, Vercel Edge Functions, and Netlify Edge are mainstream. They run on V8 isolates with cold starts under 5ms. Rendering Server Components on the edge is both fast and cheap. But there are limits: database queries and external API calls slow it down.

Example: show prices based on the user's country. If price data comes from a database, the edge-to-origin round-trip adds 80-120ms. Two strategies here:

1. **Keep prices in edge KV store**—ideal for read-heavy data, write infrequent (price updates 1-2 times daily)
2. **Fetch price component client-side**—initial HTML shows generic price, JavaScript loads, real price arrives later

The second approach is simpler but risks CLS (Cumulative Layout Shift). Reserve 120px for the price block, show a skeleton loader, replace when fetch completes.

```typescript
// Cloudflare Workers + Nuxt 3.12
export default defineEventHandler(async (event) => {
  const country = event.node.req.headers['cf-ipcountry']
  const prices = await env.PRICES_KV.get(country, { type: 'json' })
  return { prices }
})
```

Cloudflare KV read latency averages 30ms. Prices return without hitting origin database. With this approach, product pages stay fully server-rendered, no hydration, TBT at 0ms.

## Tradeoff matrix: when to use which pattern

| Scenario | Recommended Pattern | Bundle | TBT | Tradeoff |
|----------|----------------------|--------|-----|----------|
| Static blog, docs | Server-only | 18KB | 0ms | No interactive elements |
| E-commerce product list | Selective hydration | 95KB | 120ms | Only buttons hydrate |
| Dashboard, admin panel | Full client render | 340KB | 420ms | All data dynamic, no caching |
| Landing page + form | Server + client form | 60KB | 80ms | Form validation client-side |
| Geolocation-based pricing | Edge SSR + KV | 30KB | 20ms | KV write limitations |

At Roibase, we typically use "Selective hydration." E-commerce sites usually have both static content (product descriptions, images) and interactive elements (cart, filters). Full server render doesn't work for e-commerce, and full client render damages Core Web Vitals.

## What to do in your project now

If your current project runs on Next.js Pages Router or Nuxt 2, there's no urgent need to rewrite. But when adding new features, use App Router (Next 15+) or Nuxt 3.12+. A hybrid approach works: migrate critical pages (checkout, product detail) to the new architecture, leave blogs and static pages on the old stack.

Starting a new project:
1. Create a component inventory—what's interactive, what's static
2. Mark interactive ones as client components
3. Everything else becomes server components
4. Measure TBT with Chrome DevTools Profiler, aim for <200ms
5. If TBT is still high, shrink state in client components

In headless commerce, these decisions matter even more. Your SSR server typically fetches data from a SaaS backend like Shopify. Too much client-side fetching hits rate limits. Too much server-side rendering inflates TTFB (Time to First Byte). The balance: critical data (stock, price) in server components, user-specific data (cart, wishlist) in client components.