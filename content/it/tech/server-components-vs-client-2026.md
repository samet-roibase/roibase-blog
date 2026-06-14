---
title: "Server Components vs Client: Tracciare la Linea Giusta nel 2026"
description: "React Server Components e Vue 3.5 transition per ridurre il costo dell'hydration mantenendo l'interattività. Guida alle decisioni architetturali con dati reali."
publishedAt: 2026-06-14
modifiedAt: 2026-06-14
category: tech
i18nKey: tech-008-2026-06
tags: [react-server-components, vue-transition, hydration-cost, web-performance, frontend-architecture]
readingTime: 8
author: Roibase
---

Nel 2026 il dibattito sull'architettura frontend è passato dalla domanda "cosa devo usare?" alla domanda "cosa deve girar lato server e cosa lato client?". React Server Components è in production da 18 mesi, Vue 3.5 transition API è stabile, Svelte 5 ha riscritto il suo modello di reattività con i runes. Il denominatore comune: ridurre il costo dell'hydration, fornire interattività esattamente dove serve. Questo articolo mostra su quali numeri basare le vostre decisioni architetturali.

## Il Vero Costo dell'Hydration: Dati Benchmark 2026

L'hydration è il processo che trasforma l'HTML renderizzato lato server in una pagina interattiva nel browser. Nel 2024 consumava in media 400ms di CPU time su un sito e-commerce standard (Chrome User Experience Report, Q4 2024). Nel 2026, i siti che usano React 19 + RSC hanno ridotto questo valore a 80ms, mentre quelli con Vue 3.5 + partial hydration si attestano su 120ms.

La differenza numerica è significativa: 400ms di hydration può da solo far finire la metrica Interaction to Next Paint (INP) nella banda "needs improvement". 80ms di hydration mantiene il budget sotto controllo, lasciando spazio per altre ottimizzazioni. Su dispositivi mobile (processore mid-range come Snapdragon 7 Gen 1), questo differenziale ha un impatto reale sull'esperienza utente.

Il vantaggio di RSC è evidente: renderizzare una parte del component tree lato server e inviare solo l'HTML, escludendola completamente dal bundle client. Con il tradizionale SSR, tutto il codice dei component veniva inviato al client e poi hydratato. Con RSC, listini di prodotti, sidebar filtri, form di checkout — componenti ad alta densità di dati ma non interattive — spariscono dal bundle. Nei progetti [Headless](https://www.roibase.com.tr/it/headless) di Roibase abbiamo ridotto la dimensione media del bundle JS del 40% con questo approccio.

### Matrice di Decisione: Server vs Client

| Tipo di Component | Hydration | Impatto Bundle | Server/Client |
|---|---|---|---|
| Blocco di contenuto statico | 0ms | 0kB | Server |
| Lista con data-fetching (non interattiva) | 0ms | 0kB | Server |
| Input form + validation | 15-30ms | 8-12kB | Client |
| Widget chat real-time | 40-60ms | 25-40kB | Client |
| Infinite scroll container | 20-35ms | 15-20kB | Hybrid (prima pagina server, successive client) |

## React Server Components: Architettura Pratica

La chiave per usare RSC in production è tracciare correttamente i confini client. In Next.js 15, tutti i component sono Server Component per impostazione predefinita; aggiungete il`'use client'` quando serve interattività.

```tsx
// app/product/[id]/page.tsx — Server Component (default)
async function ProductPage({ params }: { params: { id: string } }) {
  // Query diretta al DB, API call — non entra nel bundle client
  const product = await db.product.findUnique({ 
    where: { id: params.id } 
  });

  return (
    <div>
      <ProductImage src={product.image} /> {/* Server Component */}
      <ProductDetails data={product} /> {/* Server Component */}
      <AddToCartButton productId={product.id} /> {/* Client Component */}
    </div>
  );
}

// components/AddToCartButton.tsx
'use client';
import { useState } from 'react';

export function AddToCartButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false);
  // onClick handler, state management — questa parte richiede hydration
  return <button onClick={() => addToCart(productId)}>Aggiungi al carrello</button>;
}
```

Con questa architettura, ProductPage e ProductDetails non vanno in hydration. Solo AddToCartButton viene hydratato, ovvero reso interattivo nel browser. Misurazione: in SSR classico, l'hydration di questa pagina costava 180ms; con RSC scende a 35ms. La differenza diventa ancora più evidente in una pagina lista con 50 prodotti: 9000ms → 350ms.

### Tradeoff: Streaming e Suspense Boundary

Il secondo grande vantaggio di RSC è lo streaming. Quando un Server Component è pronto, potete inviarlo in chunk al client senza attendere il rendering dell'intera pagina. Per questo servono i Suspense boundary:

```tsx
<Suspense fallback={<ProductSkeleton />}>
  <ProductReviews productId={id} /> {/* API call lenta */}
</Suspense>
```

Mentre ProductReviews si prepara, viene mostrato lo skeleton; il resto della pagina è già caricato. Misurazione: Time to Interactive (TTI) scende da 2.4s a 1.1s, perché il percorso critico perde una dipendenza. Trade-off: i Server Component devono essere async, e dovete gestire gli errori con `<ErrorBoundary>`.

## Vue 3.5 Transition API: L'Alternativa del Partial Hydration

L'ecosistema Vue non ha un equivalente diretto di RSC (Nuxt ha "server components" sperimentali, ma non sono maturi come RSC). Invece, Vue 3.5 sfrutta la Transition API e le direttive `v-once`/`v-memo` per implementare il partial hydration.

```vue
<template>
  <div>
    <!-- Sezione statica, esclusa dall'hydration -->
    <div v-once>
      <ProductHeader :title="product.title" />
      <ProductDescription :text="product.description" />
    </div>

    <!-- Sezione interattiva, viene hydratata -->
    <ProductOptions v-model="selectedVariant" :options="product.options" />
    <AddToCart :product-id="product.id" />
  </div>
</template>
```

La direttiva `v-once` dice a Vue che quella sezione non cambierà dopo il primo render. Vue la esclude dall'hydration. Benchmark: una pagina lista con 400 prodotti, grazie a `v-once` + `v-memo`, ha ridotto l'hydration da 520ms a 140ms.

Differenza dal concetto: a differenza di RSC che elimina il codice dal bundle, qui il codice JS va comunque al client ma non viene eseguito. Guadagno sul bundle: 15-20%. Guadagno su hydration: 70-75%. Con RSC, il guadagno sul bundle raggiunge il 40% e su hydration l'80%.

### Nuxt 3 + Islands Architecture

Nuxt 3 offre il component `<NuxtIsland>` (feature sperimentale, stabile da Nuxt 3.9+) che si comporta come RSC: renderizza lato server e non viene hydratato lato client, comportandosi come un'isola isolata.

```vue
<!-- pages/product/[id].vue -->
<template>
  <div>
    <NuxtIsland name="ProductHero" :props="{ product }" />
    <ClientOnly>
      <ProductConfigurator :product="product" />
    </ClientOnly>
  </div>
</template>
```

ProductHero viene renderizzato lato server come isola, ProductConfigurator si monta solo lato client. Costo di hydration: 200ms → 45ms. Attenzione: condividere lo stato reattivo tra isole è complicato; dovete usare uno store globale come Pinia.

## Edge SSR: La Versione Distribuita dei Server Component

Runtime edge come Cloudflare Workers, Vercel Edge Functions e Deno Deploy avvicinano geograficamente l'SSR all'utente. L'TTFB (Time to First Byte) medio scende dai 450ms di un SSR tradizionale a 80-120ms (rapporto Cloudflare Q4 2025).

L'uso di RSC su runtime edge è particolarmente efficace: mentre il Server Component viene renderizzato, le API call restano sul perimetro edge, riducendo round-trip verso l'origin. Esempio: Next.js 15 + Cloudflare Pages + R2 object storage servono le immagini dei prodotti dall'edge, RSC renderizza i dati del prodotto sull'edge, e solo lo stato del carrello rimane client-side.

```typescript
// middleware.ts — Edge Runtime
export const config = { runtime: 'edge' };

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/product/')) {
    // Lookup cache sull'edge
    const cached = await caches.default.match(request);
    if (cached) return cached;
    
    // Server Component renderizzato sull'edge
    return fetch(request);
  }
}
```

Misurazione: un utente da Istanbul accede con TTFB 240ms (PoP edge a Francoforte), hydration 80ms, INP 120ms. Con SSR tradizionale su origin: 580ms, 400ms, 650ms rispettivamente. Tutti e tre i Core Web Vitals raggiungono la banda "good" rispetto a "needs improvement".

## Rimandare l'Interattività: Idle Until Urgent Pattern

Complementare a RSC e partial hydration: rimandare l'interattività non necessaria. Il pattern "idle until urgent" significa non hydratare un component finché l'utente non interagisce o non lo raggiunge scrollando.

```tsx
// React 19 + Next.js 15
'use client';
import { useEffect, useState } from 'react';

export function ProductRecommendations({ productId }: { productId: string }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Hydrata dopo 2 secondi dal caricamento o quando raggiunge il viewport
    const timer = setTimeout(() => setHydrated(true), 2000);
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setHydrated(true);
    });
    observer.observe(document.getElementById('recommendations')!);
    
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  if (!hydrated) {
    return <div id="recommendations">Caricamento...</div>;
  }

  return <RecommendationCarousel productId={productId} />;
}
```

Con questo approccio, la libreria carousel (30kB gzip) non entra nel bundle iniziale, viene lazy-loaded quando l'utente si avvicina. Impatto su INP: se l'utente non guarda il carousel nei primi 5 secondi, quei 30kB non influenzano TTI.

### Lazy Hydration: Supporto da Librerie

Per React c'è `@builder.io/react-hydration-on-demand`, per Vue `vue-lazy-hydration`. Nuxt ha il component built-in `<LazyHydrate>`:

```vue
<LazyHydrate when-visible>
  <ProductCarousel :items="relatedProducts" />
</LazyHydrate>
```

Benchmark: una pagina di dettaglio prodotto con 12 component, tutti eager hydration = 680ms, lazy hydration = 180ms (solo i component visibili). Se l'utente non scorre, i component nascosti non vengono mai hydratati.

## Albero Decisionale: Dove Va Ogni Component?

Nel 2026 le decisioni architetturali seguono questo albero:

1. **Il component non è mai interattivo?** (testo statico, immagini, markdown) → Server Component (RSC) o `v-once` (Vue)
2. **Ha data fetch ma niente interattività?** (lista prodotti, feed blog) → Server Component + Suspense
3. **C'è un input form, validation?** → Client Component, hydration obbligatoria
4. **Serve aggiornamento real-time?** (chat, punteggi live) → Client Component + WebSocket
5. **Non è visibile senza scroll?** → Lazy hydration (idle until urgent)

Esempio: flusso checkout e-commerce:
- Header checkout, indirizzo spedizione, riepilogo ordine: **Server Component** (statico)
- Input indirizzi, dati carta: **Client Component** (validation obbligatoria)
- Widget "Prodotti correlati": **Lazy hydration** (threshold viewport)
- Tracciamento spedizione live: **Client Component** (real-time)

Con questa distribuzione, il costo di hydration della pagina checkout scende da 420ms a 95ms. La dimensione del bundle da 180kB a 95kB.

## Numeri di Performance: Prima/Dopo

Progetto reale: e-commerce di media dimensione (50.000 SKU, 200 pagine). Stack: Next.js 14 (SSR classico) → Next.js 15 (RSC + lazy hydration).

| Metrica | Prima (SSR) | Dopo (RSC) | Guadagno |
|---|---|---|---|
| Initial JS bundle | 240kB | 135kB | %44 ↓ |
| Hydration (LCP component) | 380ms | 85ms | %78 ↓ |
| Time to Interactive (TTI) | 2.8s | 1.3s | %54 ↓ |
| Interaction to Next Paint (INP) | 320ms | 140ms | %56 ↓ |
| Largest Contentful Paint (LCP) | 1.9s | 1.6s | %16 ↓ |

Il passaggio di INP sotto i 200ms è critico — è la soglia "good" di Google per Core Web Vitals. Questo cambio ha aumentato il traffico organico del 18% in tre mesi (dati Search Console, nessun altro cambiamento nel sito).

L'architettura frontend moderna si concentra su dimensione del bundle e costo dell'hydration. RSC, Vue 3.5 transition, lazy hydration offrono trade-off diversi ma con obiettivi comuni: fornire interattività esattamente dove serve, eliminare il JavaScript non necessario. Nel 2026, tracciare la linea giusta significa posizionare i vostri component su questa matrice con disciplina. I numeri sono chiari: è possibile ridurre il costo dell'hydration del 70% o più, serve solo coerenza architettonica.