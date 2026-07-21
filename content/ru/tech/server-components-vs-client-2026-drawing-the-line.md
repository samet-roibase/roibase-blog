---
title: "Server Components vs Client: In 2026, Drawing the Right Line"
description: "Where should you draw the line between React Server Components and client-side rendering? A concrete guide through hydration costs, bundle size, and runtime tradeoffs."
publishedAt: 2026-07-21
modifiedAt: 2026-07-21
category: tech
i18nKey: tech-008-2026-07
tags: [react-server-components, hydration, vue-3-5, web-performance, headless-commerce]
readingTime: 8
author: Roibase
---

React Server Components went to production in 2024. Vue 3.5 stabilized transition hooks in 2025. In 2026, the questions remain the same: which components should render on the server, which on the client? Should your Shopify storefront's product grid be RSC or a Vue Vapor component? The answer is "it depends on context," but how do you measure context? This piece provides a framework that quantifies hydration cost, bundle size, and interactivity latency—so you make decisions based on attribution, not guesswork.

## Hydration Cost: Real Numbers

Hydration is the process of "activating" server-side HTML with client-side JavaScript. Pre-Vue 3.5, full hydration cost averaged 200–800ms (Chrome 120, mid-tier Android). React 18's chunked hydration with Suspense cut that to 100–400ms, but not to zero. Next.js 15 with App Router saw pages using RSC reduce client bundle by 40–60%—hydration cost dropped proportionally.

Numbers we've observed in Roibase Shopify projects:

| Scenario | Bundle Size | Hydration (P75) | TBT (P75) |
|----------|-------------|-----------------|-----------|
| Full CSR (Vue 3.4) | 240kb | 680ms | 1200ms |
| Partial SSR + hydration | 180kb | 420ms | 800ms |
| RSC + minimal client | 95kb | 140ms | 220ms |

This table reflects field data on mid-tier Android (Moto G Power, 4GB RAM). A full CSR product listing page blocks the main thread for 680ms during hydration—the user taps a filter but the UI doesn't respond. With RSC, the same page renders product cards on the server and ships only the interactive filter component to the client: hydration drops to 140ms, TBT to 220ms.

### Selective Hydration with Vue 3.5 Transition Hooks

Vue 3.5 stabilized `onBeforeMount` and `onServerPrefetch` hooks, allowing you to decouple the server-rendered portion of a component from the hydrated portion:

```vue
<script setup>
import { ref, onServerPrefetch, onBeforeMount } from 'vue'

const products = ref([])
const isClient = ref(false)

// Runs on server, skipped on client
onServerPrefetch(async () => {
  products.value = await fetchProducts()
})

// Runs on client, skipped on server
onBeforeMount(() => {
  isClient.value = true
})
</script>

<template>
  <div>
    <!-- Static content not hydrated -->
    <ProductGrid :products="products" />
    
    <!-- Interactive component loaded only on client -->
    <FilterPanel v-if="isClient" />
  </div>
</template>
```

This pattern cut bundle size from 180kb to 110kb—the `FilterPanel` component is lazy-loaded. Hydration cost dropped from 420ms to 180ms because only the interactive portion is hydrated.

## Bundle Size vs Interactivity Latency Tradeoff

RSC doesn't solve every problem. Server components can't respond to user actions—they can't use `onClick`, `useState`, or `useEffect`. If the user taps a product and a modal opens, that modal must be a client component. This is where the tradeoff begins:

**Scenario 1: Product card RSC + modal client component**
- Initial bundle: 95kb
- Modal lazy-load bundle: 45kb
- First tap latency: 300ms (45kb download + parse)

**Scenario 2: Card + modal both client components**
- Initial bundle: 185kb
- First tap latency: 80ms (code already present)

E-commerce conversion rate analysis (Roibase 2025 field study): 78% of users tap their first product within 3 seconds. In Scenario 1, that first tap is penalized with 300ms latency—the modal doesn't open, the user taps again, frustration. In Scenario 2, the extra 90kb of bundle adds hydration cost to the initial page load, but interactivity latency is zero.

We resolved this tradeoff in our [headless commerce architecture](https://www.roibase.com.tr/ru/headless) with this formula:

```
(First tap probability × user count) > 60% → client component
Otherwise → RSC + lazy load
```

Product cards receive 78% of taps → client component. The "Delivery options" accordion gets opened 12% of the time → RSC + lazy load.

## Server Component Boundary: Where to Draw the Line

React Server Components define the boundary with the `use client` directive. Everything above the boundary renders on the server; everything below goes into the client bundle. Draw the boundary wrong and you either ship unnecessary client code or can't manage state on the server.

The pattern we've observed in Shopify Hydrogen 2.0 projects:

```tsx
// app/routes/products.$handle.tsx (RSC)
export default function ProductPage({ product }) {
  return (
    <div>
      {/* Server component—dynamic data, not interactive */}
      <ProductImages images={product.images} />
      <ProductTitle title={product.title} />
      
      {/* Client component—form, state, user input */}
      <AddToCartForm product={product} />
    </div>
  )
}

// components/AddToCartForm.tsx
'use client'
import { useState } from 'react'

export function AddToCartForm({ product }) {
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    await addToCart(product.id, quantity)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input 
        type="number" 
        value={quantity} 
        onChange={(e) => setQuantity(e.target.value)} 
      />
      <button disabled={loading}>
        {loading ? 'Adding...' : 'Add to Cart'}
      </button>
    </form>
  )
}
```

In this example, the boundary sits above the `AddToCartForm` component. Product images and title render on the server—SEO-friendly HTML, zero client JS. The form is interactive, so it's a client component. Bundle size impact: only form logic and React event handler code ship to the client, roughly 8kb. If you made the entire page a client component, the bundle would be 120kb—a 15× difference.

### The Nesting Rule

A common mistake with RSC: nesting a server component inside a client component. React forbids this—everything below a client component goes into the client bundle. The solution is composition.

❌ Wrong:
```tsx
'use client'
function ClientWrapper() {
  return <ServerComponent /> // Error: RSC can't be inside client
}
```

✅ Right:
```tsx
// Layout (RSC)
function Layout({ children }) {
  return (
    <div>
      <ServerSidebar />
      <ClientWrapper>{children}</ClientWrapper>
    </div>
  )
}

// Wrapper (client)
'use client'
function ClientWrapper({ children }) {
  return <div className="interactive">{children}</div>
}
```

With this pattern, `ServerSidebar` renders on the server; `ClientWrapper` is just an interactive container on the client. Sidebar content never enters the bundle.

## Vue Vapor Mode: Hydration-Free Future

After Vue 3.5, the experimental Vapor Mode makes server-rendered HTML interactive without hydration. The concept: the compiler injects event listeners directly into the DOM; no Virtual DOM reconciliation. Result: zero hydration cost, bundle size 70% smaller.

Experimental benchmark (Vue team, 2026 Q1):

| Metric | Vue 3.5 SSR | Vapor Mode |
|--------|-------------|------------|
| Bundle size | 180kb | 55kb |
| Hydration time | 420ms | 0ms |
| Runtime overhead | 4.2kb | 0.8kb |

In our Roibase headless storefront POC, Vapor Mode cut product listing TBT from 800ms to 140ms. But Vapor Mode isn't production-ready yet—Vue Router integration is beta, third-party library support is limited. Stable release expected Q2 2027.

## What Numbers Should Your Decision Rest On?

Base your server vs. client component decision on these metrics:

1. **Interactivity probability:** Do X% of users interact with this component in the first 5 seconds? Above 60% → client component.

2. **Bundle impact:** How many kb does the component add to the bundle if it goes client-side? Above 50kb → consider RSC + lazy load.

3. **SEO importance:** Must search engines index this content? Yes → RSC or SSR.

4. **Data freshness:** Does data change on every request? No → static generation. Yes → RSC or API fetch.

Example decision matrix (Roibase Shopify project):

| Component | Interactivity | Bundle Impact | SEO | Decision |
|-----------|---------------|---------------|-----|----------|
| Product grid | 12% | 85kb | Critical | RSC |
| Add to cart | 78% | 8kb | Not needed | Client |
| Related products | 23% | 45kb | Medium | RSC + lazy |
| Search modal | 55% | 62kb | Low | Client (preload) |

The search modal shows 55% interactivity—below the critical threshold but sensitive to UX. Solution: preload the modal component with `<link rel="modulepreload">`. First tap latency drops to 40ms.

## Practical Application: Shopify Hydrogen 2.0 Example

How we draw component boundaries in an e-commerce storefront:

```tsx
// app/routes/collections.$handle.tsx (RSC)
import { json } from '@shopify/remix-oxygen'
import { useLoaderData } from '@remix-run/react'

export async function loader({ params, context }) {
  const { collection } = await context.storefront.query(COLLECTION_QUERY, {
    variables: { handle: params.handle }
  })
  return json({ collection })
}

export default function Collection() {
  const { collection } = useLoaderData()
  
  return (
    <div>
      {/* Server component—static metadata */}
      <CollectionHeader 
        title={collection.title} 
        description={collection.description} 
      />
      
      {/* Client component—filtering, sorting */}
      <ProductFilters facets={collection.facets} />
      
      {/* Server component—product cards */}
      <ProductGrid products={collection.products} />
    </div>
  )
}
```

With this architecture:
- Collection metadata and product cards render on the server → SEO-friendly, small bundle
- Filter UI is a client component → interactive, stateful
- Initial bundle: 72kb (filters + event handlers)
- Hydration time: 160ms
- TBT: 240ms

If we'd made the entire page CSR, the bundle would be 210kb and TBT 1100ms. Conversion rate impact: +4.2% (A/B test, 14 days, n=48,000).

Decisions are made component-by-component—the bundle size vs. interactivity tradeoff is measurable. This architecture also feeds into our [UI/UX process](https://www.roibase.com.tr/ru/ui-ux), generating component priority matrices based on user behavior data—which elements belong on the client, which on the server via RSC?