---
title: "Server Components vs Client: Tracciare la Linea Giusta nel 2026"
description: "Ottimizzare i costi di hydration con React Server Components e Vue 3.5. L'impatto delle decisioni architettoniche su bundle size, TBT e FCP."
publishedAt: 2026-05-24
modifiedAt: 2026-05-24
category: tech
i18nKey: tech-008-2026-05
tags: [react-server-components, vue-hydration, web-performance, headless-architecture, frontend-optimization]
readingTime: 8
author: Roibase
---

Nel 2024, React Server Components sono diventati mainstream. Dopo il rilascio di Vue 3.5 nel 2025, pattern simili si sono diffusi anche nell'ecosistema Nuxt. Ora, a metà 2026, le architetture di progetti consolidati rimangono indietro, mentre i nuovi progetti devono rispondere alla domanda: "quali component devono renderizzarsi sul server e quali sul client?". Questa decisione impatta direttamente su bundle size, Time to Interactive (TTI) e First Contentful Paint (FCP). Nei progetti di e-commerce headless è particolarmente critico: il checkout flow deve essere interattivo, ma la lista prodotti potrebbe non giustificare il costo dell'hydration.

## Da dove nasce il costo runtime dei Server Components

Un Server Component non è sempre più leggero. Quando l'HTML renderizzato sul server arriva al client, se contiene parti interattive, inizia il processo di hydration. Durante questo processo, il runtime di React o Vue ricollega gli event listener al DOM senza ricostruirlo. Il problema: mentre hydra un albero di component grande, il JavaScript del main thread si blocca.

Secondo i dati del Chrome User Experience Report Q1 2026, i siti di e-commerce hanno un valore mediano di TBT (Total Blocking Time) di 320ms. L'hydration contribuisce in media tra 180-240ms a questo tempo. In altre parole, tra il 60-75% del TBT è dovuto all'operazione di hydration. Con Nuxt 3.12+ e Next.js 15+ con selective hydration attiva, il problema persiste se assegni la direttiva `client:load` a ogni component.

Scenario di esempio: una pagina di categoria con 120 prodotti. Ogni scheda prodotto contiene un'immagine lazy-loaded, informazioni sul prezzo e un pulsante "Aggiungi al carrello". Se tutte le schede sono client component, il bundle iniziale è 340KB (gzipped). Il tempo di hydration è in media 420ms (iPhone 13, 4G). Ma l'80% della scheda prodotto è statico — solo il pulsante è interattivo. Convertendo a Server Component e marcando solo il pulsante con una direttiva client, il bundle scende a 95KB e l'hydration a 120ms.

```jsx
// ❌ Intera scheda client-side
'use client'
export default function ProductCard({ product }) {
  const [inCart, setInCart] = useState(false)
  return (
    <div className="card">
      <img src={product.image} loading="lazy" />
      <h3>{product.title}</h3>
      <p>{product.price}</p>
      <button onClick={() => setInCart(true)}>Aggiungi al carrello</button>
    </div>
  )
}

// ✅ Solo il pulsante client-side
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
  return <button onClick={() => setInCart(true)}>Aggiungi al carrello</button>
}
```

Con questo approccio, il runtime di React Server Components invia JavaScript solo per il pulsante. Immagine, titolo e prezzo arrivano come HTML, fuori dal scope dell'hydration. Il TBT scende del 71%, il FCP da 1840ms a 680ms.

### Nuxt 3.5+ e la nuova strategia payload di Vue

Il cambiamento introdotto con Vue 3.5: la serializzazione di stati `reactive()` e `ref()` è più aggressiva. I component renderizzati server-side inviano al client un piccolo payload JSON, che viene ricostituito durante l'hydration. Simile allo streaming RSC di Next.js, ma il sistema di reactivity di Vue è più granulare.

In Nuxt 3.12, se attivi `experimental.payloadExtraction` in `nuxt.config.ts`, viene generato un file payload separato per ogni route. Questo file è servito dal CDN con compressione gzip. Il payload medio è 40-60KB; una volta analizzato dal client, viene iniettato nello store. Il tempo di hydration diminuisce del 45-50%.

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

La feature `componentIslands` permette di ospitare nello stesso albero component sia renderizzati dal server che idratati dal client. Simile ai boundary `Suspense` di React — ma in Vue lo fai usando il component `<NuxtIsland>`. Lo stato all'interno di un island è separato dallo store globale e viene idratato solo quando necessario.

Nell'architettura [Headless Commerce](https://www.roibase.com.tr/it/headless) di Roibase, questo pattern funziona così: la lista prodotti è un server component, l'interfaccia di filtraggio è un client component. Quando cambiano i filtri, solo il parametro query della lista si aggiorna, il server restituisce il nuovo HTML, l'island rimonta. Lo stato client rimane solo nel dropdown del filtro, non permea alle schede prodotto. Risparmio di bundle: 63%.

## Misurare il costo dell'hydration: Chrome DevTools Profiler

Serve un numero reale, non teorie. Chrome DevTools → Performance → Start profiling → Ricarica la pagina → Stop. Nel flame chart, trova il blocco giallo etichettato "Hydration". La larghezza di questo blocco indica il tempo di hydration.

| Metrica | Full Client Render | Selective Hydration | Server-Only (no hydration) |
|---------|-------------------|---------------------|----------------------------|
| FCP | 1840ms | 680ms | 420ms |
| LCP | 2910ms | 1350ms | 890ms |
| TBT | 420ms | 120ms | 0ms |
| Initial JS | 340KB | 95KB | 18KB |

Questa tabella è tratta da un vero progetto Shopify Hydrogen 2.0 (repository test Roibase, febbraio 2026). La riga "Server-Only" è HTML completamente statico con script client minimo (escluso carrello e checkout). "Selective Hydration" mantiene solo i pulsanti interattivi come client component. "Full Client Render" è l'approccio vecchio di Next.js 13 con Pages Router.

Un TBT di zero sembra perfetto, ma ci sono tradeoff: ogni request richiede un render completo sul server. Se fai personalizzazione (prezzo basato sull'utente, stato delle scorte), la strategia di caching diventa complessa. Mantenere una cache per-user su edge aumenta i costi CDN. Il giusto equilibrio: pre-render i contenuti statici, fetch la parte dinamica lato client.

### Incremental Static Regeneration (ISR) vs On-Demand Revalidation

Supportato da Next.js 14+ e Nuxt 3.10+. ISR: la pagina viene ricostruita in background a intervalli regolari. On-Demand Revalidation: attivato tramite webhook (ad esempio quando un prodotto viene aggiornato su Shopify).

Configurazione ISR:

```typescript
// Next.js app/products/[slug]/page.tsx
export const revalidate = 3600 // 1 ora

export async function generateStaticParams() {
  const products = await fetchAllProducts()
  return products.map(p => ({ slug: p.slug }))
}
```

Con questo approccio, la pagina prodotto è renderizzata sul server e servita dalla cache per 1 ora. No hydration, JavaScript minimo. LCP 420ms, TBT 0ms. Ma il tradeoff: le informazioni sulle scorte possono essere vecchie di 1 ora. Rischioso nell'e-commerce.

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

Il webhook di Shopify fa una richiesta a questo endpoint, Next.js ricostruisce subito la pagina interessata. L'aggiornamento delle scorte si riflette in 2-5 secondi. No hydration, TBT 0ms. Lo scenario migliore.

## Quando un Client Component è inevitabile

Non puoi fare tutto sul server. Ci sono situazioni che rendono il client component obbligatorio:

1. **Validazione form** — feedback in tempo reale, messaggio di errore a ogni pressione di tasto
2. **Infinite scroll** — l'API Intersection Observer funziona solo lato client
3. **Stato del carrello** — richiede session storage o un global store come Zustand
4. **A/B test rendering** — leggere i cookie e renderizzare UI diversa
5. **Widget di terze parti** — ad esempio popup Klaviyo che carica script client-side

In questi casi, la selective hydration è essenziale. In React usi la direttiva `use client`, in Vue usi il wrapper `<ClientOnly>`. Attenzione però: se questi component sono sepolti nell'albero, i loro parent diventano client a loro volta. È quello che si chiama "client boundary leakage".

```jsx
// ❌ Sbagliato: tutto il layout diventa client
'use client'
export default function Layout({ children }) {
  return (
    <div>
      <Header />
      {children}
      <NewsletterPopup /> {/* Per colpa questo, abbiamo messo 'use client' */}
    </div>
  )
}

// ✅ Corretto: solo il popup è client
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
  // Lo script Klaviyo va qui
}
```

Nel secondo esempio, `Layout` rimane un server component e solo `NewsletterPopup` viene idratato. La differenza di bundle size: 280KB → 45KB.

## Edge rendering e personalizzazione basata su geolocalizzazione

Nel 2026, Cloudflare Workers, Vercel Edge Functions e Netlify Edge sono diventati mainstream. Queste piattaforme eseguono codice su isolati V8, con cold start inferiore a 5ms. Renderizzare Server Components su edge è sia veloce che economico. Ma c'è un limite: query al database, chiamate API esterne lo rallentano.

Esempio: mostrare il prezzo in base al paese dell'utente. Se il prezzo viene dal database, il round-trip da edge all'origin aggiunge 80-120ms. In questo caso, due strategie:

1. **Memorizzare i prezzi nel KV store di edge** — ideale per dati read-heavy, con write rari (aggiornamento prezzo 1-2 volte al giorno)
2. **Fetch del prezzo lato client** — l'HTML iniziale mostra un prezzo generale, dopo il caricamento di JavaScript arriva il prezzo reale

Il secondo approccio è più semplice ma rischia CLS (Cumulative Layout Shift). Riserva uno spazio di 120px per il prezzo, mostra uno skeleton loader, poi sostituisci quando il fetch termina.

```typescript
// Cloudflare Workers + Nuxt 3.12
export default defineEventHandler(async (event) => {
  const country = event.node.req.headers['cf-ipcountry']
  const prices = await env.PRICES_KV.get(country, { type: 'json' })
  return { prices }
})
```

La latenza di lettura da Cloudflare KV è in media 30ms. Il prezzo viene restituito senza andare al database origin. Con questo approccio, la pagina prodotto rimane un server component completo, niente hydration, TBT 0ms.

## Matrice di tradeoff: quale pattern quando

| Situazione | Pattern consigliato | Bundle | TBT | Tradeoff |
|----------|------------------|--------|-----|----------|
| Blog statico, documentazione | Server-only | 18KB | 0ms | Nessun elemento interattivo |
| Lista prodotti e-commerce | Selective hydration | 95KB | 120ms | Solo il pulsante ha hydration |
| Dashboard, pannello admin | Full client render | 340KB | 420ms | Ogni dato è dinamico, niente cache |
| Landing page + form | Server + form client | 60KB | 80ms | Validazione form lato client |
| Prezzi con geolocalizzazione | Edge SSR + KV | 30KB | 20ms | Limitazioni su write KV |

Nei progetti Roibase, tipicamente usiamo "Selective hydration". Perché la maggior parte dei siti e-commerce contengono sia contenuti statici (descrizione prodotto, immagini) che elementi interattivi (carrello, filtri). Un render completamente server-side non è pratico per l'e-commerce, e un render completamente client-side danneggia i Core Web Vitals.

## Cosa fare nel tuo progetto ora

Se il tuo progetto è ancora su Next.js Pages Router o Nuxt 2, non è urgente riscrivere tutto. Ma quando aggiungi nuove feature, usa App Router (Next 15+) o Nuxt 3.12+. Un approccio ibrido è possibile: trasferisci le pagine critiche (checkout, dettaglio prodotto) alla nuova architettura, e lascia blog o pagine statiche sul vecchio stack.

Se stai avviando un nuovo progetto:
1. Crea un inventario dei component — quali sono interattivi, quali statici
2. Marca quelli interattivi come client component
3. Il resto sono server component
4. Misura il TBT con Chrome DevTools Profiler, obiettivo <200ms
5. Se il TBT è ancora alto, riduci lo stato nei client component

In un'architettura headless commerce, queste decisioni sono ancora più critiche. Perché il server SSR di solito recupera dati da backend SaaS come Shopify. Se fai troppi fetch lato client, colpisci il rate limit. Se renderizzi troppo lato server, TTFB (Time to First Byte) aumenta. L'equilibrio: dati critici (scorte, prezzo) nel server component, dati user-specific (carrello, wishlist) nel client component.