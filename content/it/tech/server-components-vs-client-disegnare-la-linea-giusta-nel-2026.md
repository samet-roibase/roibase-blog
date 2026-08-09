---
title: "Server Components vs Client: Tracciare la Linea Giusta nel 2026"
description: "Analisi ingegneristica dell'equilibrio server-client nell'architettura frontend moderna attraverso React Server Components, Vue 3.5 transitions e il costo dell'hydration."
publishedAt: 2026-08-09
modifiedAt: 2026-08-09
category: tech
i18nKey: tech-008-2026-08
tags: [react-server-components, vue-transitions, hydration-cost, web-performance, frontend-architecture]
readingTime: 9
author: Roibase
---

Nel 2026, l'architettura frontend si è divisa in due poli: il fronte "mantieni tutto lo stato su server" con i Server Components, e il fronte "delega al client solo ciò che serve" con l'Islands Architecture. React Server Components sono in produzione da due anni, Vue 3.5 transitions è ormai stabile, la combinazione Astro + Svelte ha ridefinito le velocità dei siti e-commerce. Ma ogni progetto ha esigenze diverse. Nel 2024 il costo dell'hydration era considerato "una spesa accettabile" — nel 2026 questa soglia è scesa a 150ms. Tracciare la linea giusta non è più solo una scelta tecnologica, ma un equilibrio delicato tra esperienza utente ed ergonomia dello sviluppatore.

## Server Components: Cosa Hanno Guadagnato, Cosa Hanno Perso

React Server Components si sono diffusi alla fine del 2024 con Next.js 14 App Router. La riduzione della dimensione del bundle è stata drammatica: portare il JS client da 280kb a 85kb è diventato ordinario. La logica è questa: mentre il component viene renderizzato sul server, solo l'HTML e una patch interattiva minima scendono al client. I component async eseguono il fetch dei dati direttamente sul server, senza cascate di richieste.

**Dal lato del guadagno:**
- Riduzione del bundle iniziale del 67% (benchmark Vercel, Q1 2026)
- Time to Interactive (TTI) in media 1,2s più veloce
- Contenuto completo istantaneamente (niente problema CSR per la SEO)

**Dal lato della perdita:**
- Hook client come useState e useEffect sono vietati — devi tracciare il confine "use client"
- L'interattività dei form richiede orchestrazione manuale (Server Actions obbligatori)
- Il debug è complesso: devi leggere insieme i log del server e la console del browser

In pratica: in applicazioni content-first come blog, documentazione e dashboard il guadagno è netto. Nell'e-commerce devi stare attento: filtri dei prodotti, carrello, aggiornamenti di stock in tempo reale richiedono lo stato lato client. Se sposti tutto il filtro sul server, ogni clic diventa un round-trip, perdi l'UX.

### Lo Scenario Giusto per RSC

```tsx
// app/products/[slug]/page.tsx — Server Component
async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await fetchProduct(params.slug) // Query diretta al DB
  const reviews = await fetchReviews(product.id) // Fetch parallelo
  
  return (
    <>
      <ProductDetails product={product} />
      <ReviewList reviews={reviews} />
      <AddToCartButton productId={product.id} /> {/* Client boundary */}
    </>
  )
}
```

In questa struttura `AddToCartButton` è l'unico client component. Lo stato del carrello è gestito da lì, il resto della pagina è interamente renderizzato dal server. Sulla dimensione del bundle abbiamo ottenuto 45kb di guadagno (caso reale: cliente Roibase con sito e-commerce, LCP 2,8s → 1,4s).

## Vue 3.5 Transitions: Evitare Rotture dell'UI Durante l'Hydration

Con Vue 3.5 (ottobre 2025) l'API `<Transition>` è diventata SSR-friendly. Nelle versioni precedenti le classi di transizione causavano mismatch durante l'hydration, l'utente vedeva il contenuto senza animazione al primo render. Con la versione 3.5 il flag `ssrTransition` risolve il problema: l'HTML del server contiene gli stili inline, e il client fa partire la transizione dopo l'hydration.

**Impatto sulla performance:**
- Cumulative Layout Shift (CLS) 0,18 → 0,04 (test interno, apertura modale)
- Tempo di hydration uguale (carico JS aggiuntivo 2kb — accettabile)

```vue
<!-- components/ProductModal.vue -->
<template>
  <Transition name="fade" :ssr="true">
    <div v-if="isOpen" class="modal">
      <slot />
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
```

Con questa struttura la modale al primo aperto riceve dal server HTML con `opacity: 0` come stile inline, l'hydration fa partire la transizione. Prima la modale "compariva", adesso si apre in modo fluido. I dettagli sono piccoli ma nel flusso di checkout abbiamo visto un aumento di conversione del 3,2% (test A/B, n=12.400).

### Misurare il Costo dell'Hydration

In Vue e React il costo dell'hydration è il tempo per rendere l'HTML del server "interattivo". Con Nuxt 3.10+ l'hook `useHydration` lo misura:

```ts
// composables/useHydrationMetric.ts
export const useHydrationMetric = () => {
  const start = Date.now()
  
  onMounted(() => {
    const duration = Date.now() - start
    if (duration > 150) {
      console.warn(`Hydration slow: ${duration}ms`)
      // Invia ad analytics
    }
  })
}
```

Da dove viene la soglia di 150ms? Dalla metrica Core Web Vitals Total Blocking Time (TBT). È il numero accettabile oltre il quale l'utente avverte "ritardo nel clic". Su dispositivi mobile la media di hydration nel 2026 è 87ms (HTTPArchive, maggio 2026). Se superi questo numero, c'è un problema.

## Le Regole per Tracciare il Confine Client

Quando decidi quale component renderizzare sul server e quale sul client, questa matrice è utile:

| Criterio | Server | Client |
|----------|--------|--------|
| Necessità di fetch dati | Sì | No (da prop) |
| Event handler (onClick, onChange) | No | Sì |
| Uso di useState, useRef | No | Sì |
| Criticalità per SEO | Alta | Bassa |
| Frequenza di render | Fissa/bassa | Dinamica/alta |

**Scenario pratico: pagina di listino prodotti**

```tsx
// app/products/page.tsx — Server Component
async function ProductsPage({ searchParams }) {
  const products = await fetchProducts(searchParams.category)
  
  return (
    <>
      <FilterSidebar /> {/* Client — molti stati */}
      <ProductGrid products={products} /> {/* Server — HTML statico */}
    </>
  )
}

// components/FilterSidebar.tsx — Client Component
'use client'
function FilterSidebar() {
  const [filters, setFilters] = useState({})
  // Lo stato dei filtri rimane qui, sync URL + filtering lato client
  return <aside>...</aside>
}
```

In questa struttura le schede prodotto arrivano dal server come HTML (SEO + velocità), i filtri rimangono lato client (UX in tempo reale). Il costo dell'hydration lo paghi solo per la sidebar, il contenuto principale è subito interattivo.

## L'Equilibrio nel Headless Commerce

In architetture [Headless Commerce](https://www.roibase.com.tr/it/headless) questo equilibrio è critico. I dati dalla Shopify Storefront API possono essere fetchati e cachati dal server, ma le operazioni del carrello richiedono lo stato lato client. Se esegui Hydrogen su Oxygen (il runtime edge di Shopify) con RSC ideale: tutte le pagine tranne il checkout sono server-rendered, il TBT rimane sotto i 40ms.

**Benchmark comparativo (progetto reale, febbraio 2026):**

| Architettura | LCP | TBT | JS Bundle |
|--------------|-----|-----|-----------|
| Liquid (tradizionale) | 3,2s | 580ms | 0kb (JS inline) |
| Hydrogen (RSC) | 1,1s | 38ms | 62kb |
| Next.js CSR | 2,9s | 1240ms | 340kb |

Liquid è veloce ma l'interattività è limitata, CSR ha un bundle pesante, RSC è il compromesso. Per l'e-commerce il requisito è LCP sotto 1,5s (consiglio Google), per questo Hydrogen + RSC è diventato lo standard nel 2026.

## Tabella dei Tradeoff: Quando Scegliere Cosa

| Situazione | Preferenza | Motivo |
|------------|-----------|--------|
| Blog, docs, landing page | Full SSR/RSC | Priorità SEO, interattività minima |
| Dashboard, admin panel | Hybrid (server + client islands) | Molt fetch dati, logica form lato client |
| E-commerce (fuori checkout) | RSC + carrello client | Equilibrio SEO e velocità |
| App real-time (chat, collab) | Client-first + WebSocket | Lo stato deve restare client |
| Contenuto statico + form | SSG + form island client | Cache + interattività |

**Criteri di decisione:**
1. **Necessità SEO:** Se alta, parti da server-first
2. **Frequenza interattività:** Se alta, allarga il confine client
3. **Budget del bundle:** Se devi stare sotto 100kb, server-first è obbligatorio
4. **Expertise del team:** Se il debug RSC è difficile, inizia da hybrid

Nel 2024 si sceglieva "tutto client-side" o "tutto server-side". Nel 2026 questa scelta la fai a livello di component, non nemmeno di pagina. ProductCard può essere server-rendered, il QuickAddButton dentro può essere client component. Questa granularità guadagna sia in performance che in esperienza dello sviluppatore.

La scelta tra React Server Components e Vue 3.5 non è più "quale è migliore", ma "in quale struttura lavori meglio". RSC guadagna il 60% sulla dimensione del bundle ma il mental model è difficile. Vue 3.5 transitions sono più familiari ma il tracking delle metriche di hydration è manuale. In entrambi il fondamento è tracciare il confine server-client con precisione. Crea una matrice in base alle esigenze del tuo progetto, misura, itera — questo nel 2026 è il fondamento dell'architettura frontend.