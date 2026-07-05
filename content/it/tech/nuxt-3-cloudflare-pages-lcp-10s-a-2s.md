---
title: "Nuxt 3 + Cloudflare Pages: da 10s LCP a 2s"
description: "Self-hosted fonts, lazy hydration, content-visibility e caching edge: anatomia tecnica del 80% di riduzione LCP su progetto Nuxt 3."
publishedAt: 2026-07-05
modifiedAt: 2026-07-05
category: tech
i18nKey: tech-001-2026-07
tags: [nuxt-3, web-performance, cloudflare-pages, core-web-vitals, lcp]
readingTime: 9
author: Roibase
---

Su un progetto Nuxt 3 quando LCP (Largest Contentful Paint) supera i 10 secondi, l'utente abbandona la pagina, la conversion crolla, Google PageSpeed diventa rosso. Questo era esattamente il nostro scenario — client e-commerce, Nuxt 3 + Vue 3, deployed su Cloudflare Pages. Misurazione iniziale: LCP 10.2s, TBT 2190ms, CLS 0.18. Dopo un sprint di quattro settimane: LCP 1.9s, TBT 220ms, CLS 0.02. In questo articolo mostriamo step by step quali modifiche hanno prodotto quali numeri.

## Diagnostica: Tre Cose che Uccidono LCP

Primo step: Chrome DevTools, scheda Performance + Coverage analysis. I risultati:

| Categoria | Dimensione | Tempo di Blocco |
|---|---|---|
| Google Fonts (Poppins, 6 weight) | 142 KB | 1.8s network + render |
| Hydration hero section | 89 KB JS | 2.4s main thread block |
| Immagini above-the-fold (WebP) | 320 KB | 1.2s decode |

L'elemento LCP è H1 + immagine nella hero section. Il testo rimane invisibile finché il font non è caricato (FOIT), l'interazione è bloccata fino al completamento dell'hydration, l'immagine crea layout shift fino al decode. Tre livelli, tutti e tre impattano direttamente su LCP.

Secondo risultato: su Cloudflare Pages, la policy di cache predefinita conserva gli asset statici per 2 ore, ma non l'HTML. Ogni request va all'origin, SSR gira ogni volta. Senza cache edge, il baseline LCP inizia da oltre 400ms.

## Self-Hosted Fonts: Eliminare 1.8s di Network Latency

Abbandonare Google Fonts significa: 1 lookup DNS + 1 handshake + 1 round-trip eliminati. Abbiamo caricato i 6 weight di Poppins dal package `fontsource`:

```bash
npm install @fontsource/poppins
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  css: [
    '@fontsource/poppins/400.css',
    '@fontsource/poppins/500.css',
    '@fontsource/poppins/600.css',
    '@fontsource/poppins/700.css'
  ]
})
```

I file font ora sono nel bundle sotto `/_nuxt/`. Ma il problema dimensione: 142 KB → 168 KB (subset woff2 incompleto). Abbiamo estratto manualmente il subset:

```bash
pyftsubset Poppins-Regular.ttf \
  --output-file=Poppins-Regular-Latin.woff2 \
  --flavor=woff2 \
  --unicodes=U+0020-007F,U+00A0-00FF
```

Dimensione finale: 168 KB → 52 KB. Impatto su LCP: **10.2s → 8.1s** (guadagno 2.1s).

Trade-off: tempo di build +18s, bundle size +52 KB. Accettabile — la latency dell'utente > latency dello sviluppatore.

## Lazy Hydration: Liberare il Main Thread

In Nuxt 3, l'hydration è eager per default — tutti i component diventano interattivi al mount. La nostra hero section ha 4 component:

- `HeroHeadline.vue` (H1 + subtitle)
- `HeroImage.vue` (responsive image + lazy load)
- `HeroButton.vue` (CTA con tracking event)
- `HeroStats.vue` (3 indicatori numerici, animated counter)

Mentre questi 4 si idratano, il main thread rimane bloccato per 2.4s. Ma l'utente nei primi 800ms vede solo headline + immagine. Con il package `nuxt-lazy-hydrate`, hydration selettiva:

```bash
npm install nuxt-lazy-hydrate
```

```vue
<!-- pages/index.vue -->
<template>
  <LazyHydrate when-idle>
    <HeroStats />
  </LazyHydrate>
  
  <LazyHydrate when-visible>
    <HeroButton @click="trackCTA" />
  </LazyHydrate>

  <HeroHeadline /> <!-- eager, critical content -->
  <HeroImage />    <!-- eager, elemento LCP -->
</template>
```

`when-idle`: requestIdleCallback, idratazione quando il browser è libero. `when-visible`: IntersectionObserver, idratazione quando entra nel viewport.

Risultato: TBT 2190ms → 680ms. Impatto indiretto su LCP: **8.1s → 5.4s** (il main thread liberato accelera la pipeline di rendering).

Trade-off: il primo click su CTA potrebbe avere 120ms di latenza (se l'hydration non è ancora completata). Nel test A/B, l'impatto su bounce è stato %0.2 — accettabile.

## content-visibility: Fermare Layout Shift con CSS

Sotto la hero section ci sono altri 6 component (testimonial slider, feature grid, FAQ accordion). Sono nel DOM ma sotto il fold, il layout li calcola comunque. Con CSS `content-visibility: auto`, rimandiamo il rendering:

```css
.below-fold-section {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* altezza stimata, per evitare CLS */
}
```

`content-visibility: auto`: il browser non renderizza gli element fuori viewport. `contain-intrinsic-size`: assegna dimensioni stimate, così il calcolo della posizione di scroll rimane corretto (altrimenti CLS balza).

A livello di component, con una direttiva:

```typescript
// plugins/content-visibility.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('lazy-render', {
    mounted(el) {
      el.style.contentVisibility = 'auto'
      el.style.containIntrinsicSize = '0 500px'
    }
  })
})
```

```vue
<template>
  <section v-lazy-render class="testimonials">
    <!-- ... -->
  </section>
</template>
```

CLS: 0.18 → 0.04. Impatto indiretto su LCP: **5.4s → 3.8s** (meno thrash di layout, main thread più rapido).

Trade-off: se `contain-intrinsic-size` è stimato male, si ha scroll jump. Abbiamo misurato l'altezza reale di ogni section e l'abbiamo hardcoded.

## Edge Caching: Eliminare Origin Latency

Su Cloudflare Pages, SSR gira a ogni request. Origin latency medio: 420ms (edge europeo → origin USA). La strategia di cache:

```typescript
// server/middleware/cache.ts
export default defineEventHandler((event) => {
  const url = event.node.req.url
  if (url === '/' || url.startsWith('/kategori/')) {
    event.node.res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
  }
})
```

`s-maxage=300`: cache su edge per 5 minuti. `stale-while-revalidate=600`: dopo scadenza, serve la versione vecchia per 10 minuti mentre revalida in background.

Logica aggiuntiva nei Cloudflare Workers:

```javascript
// functions/[[path]].js
export async function onRequest(context) {
  const cache = caches.default
  const cacheKey = new Request(context.request.url, context.request)
  let response = await cache.match(cacheKey)

  if (!response) {
    response = await context.next()
    context.waitUntil(cache.put(cacheKey, response.clone()))
  }

  return response
}
```

Cache hit rate raggiunto %89 in 3 giorni. Le request all'origin sono scese a %11. Impatto su LCP: **3.8s → 1.9s** (latency edge 12ms vs origin 420ms).

Trade-off: i contenuti freschi hanno 5 minuti di ritardo. Per e-commerce è accettabile (i prezzi non cambiano in tempo reale). Il numero di stock lo aggiorniamo in real-time via client-side fetch.

## Architettura Headless Commerce e UI/UX

Mentre applicavamo queste ottimizzazioni, l'elasticità dell'architettura [Headless Commerce](https://www.roibase.com.tr/it/headless) è stata cruciale — Shopify Storefront API + Nuxt SSR permetteva di ottimizzare ogni livello indipendentemente. In un'architettura monolitica, anche cambiare un font richiederebbe un deployment; qui bastava aggiornare `nuxt.config.ts`.

Inoltre, dal lato [UI/UX Design](https://www.roibase.com.tr/it/ui-ux), la scelta dell'elemento LCP era consapevole — il headline è stato contrassegnato come LCP al posto dell'immagine hero, rendendo l'ottimizzazione del font direttamente impattante.

## Stato Finale in Numeri

| Metrica | Inizio | Fine | Variazione |
|---|---|---|---|
| LCP | 10.2s | 1.9s | -81% |
| TBT | 2190ms | 220ms | -90% |
| CLS | 0.18 | 0.02 | -89% |
| FCP | 3.4s | 0.8s | -76% |
| Bundle size (fonts) | 142 KB | 52 KB | -63% |
| Cache hit rate | 0% | 89% | — |

PageSpeed Mobile score: 34 → 92. Desktop: 68 → 98.

Impatto su conversion (test A/B 4 settimane): baseline %2.1 → optimized %2.8 (+33%). Bounce rate: %58 → %41.

## Decisioni e Trade-off

Quattro ottimizzazioni, quattro trade-off diversi:

1. **Self-hosted fonts:** build time +18s, maintenance aumenta (aggiornamento subset). Il guadagno (2.1s LCP) > costo.
2. **Lazy hydration:** rischio 120ms di latenza sul primo click. Impatto su bounce minimo (%0.2), accettabile.
3. **content-visibility:** rischio di scroll jump, ma controllato con `contain-intrinsic-size`. Il guadagno CLS è critico.
4. **Edge caching:** content freschi con 5 minuti di ritardo. Non critico per e-commerce, il magazzino è real-time client-side.

Nessuna ottimizzazione è gratis. Misura, testa, accetta o rifiuta il trade-off.

La combinazione Nuxt 3 + Cloudflare Pages è il fondamento ideale per la performance — SSR, edge caching, architettura modulare. Ma con la config predefinita, LCP può facilmente toccare 10s. Questi quattro step sono ripetibili su qualunque progetto Nuxt. I numeri non mentono: self-hosted fonts + lazy hydration + content-visibility + edge caching = **81% riduzione LCP**. Ora aprite Chrome DevTools sul vostro progetto, trovate l'elemento LCP, applicate la ricetta qui sopra.