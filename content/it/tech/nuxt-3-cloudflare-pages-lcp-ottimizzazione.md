---
title: "Nuxt 3 + Cloudflare Pages: da 10s a 2s LCP"
description: "Font self-hosted, lazy hydration, content-visibility e edge caching: abbiamo ridotto l'LCP dell'80%. Benchmark reali, codice e trade-off."
publishedAt: 2026-05-07
modifiedAt: 2026-05-07
category: tech
i18nKey: tech-001-2026-05
tags: [nuxt3, cloudflare-pages, web-performance, lcp, edge-caching]
readingTime: 9
author: Roibase
---

Dopo l'aggiornamento Core Web Vitals di Google, l'LCP (Largest Contentful Paint) deve stare sotto i 2,5 secondi — altrimenti il ranking organico e il tasso di conversione crollano. Un sito e-commerce che abbiamo migrato allo stack Nuxt 3 + Cloudflare Pages ha registrato un LCP di 10,2 secondi al primo deploy. Combinando una strategia di font self-hosted, selective hydration, CSS content-visibility e edge caching, lo abbiamo portato a 2,1 secondi. Qui sotto puoi trovare il dettaglio di ogni ottimizzazione, i trade-off reali e il codice.

## Diagnosticare il problema: anatomia di un LCP a 10s

Nel primo report CrUX il mediano LCP era 10,2s, TBT (Total Blocking Time) 2190ms. L'analisi del profilo Lighthouse in Chrome DevTools ha rivelato:

- **Caricamento font:** tre famiglie da Google Fonts CDN, render-blocking
- **Hydration JavaScript:** bundle da 420kB, tutta la pagina viene hydrata
- **Immagine above-the-fold:** JPEG da 1,2MB senza lazy load
- **Cache Cloudflare:** le risposte SSR non erano cachate, ogni request raggiungeva l'origin

Misurazione baseline: PageSpeed Insights mobile score 34/100. Desktop 62/100. Questi numeri arrivano dalla migrazione da Shopify Liquid a Nuxt 3 — il cambio di framework da solo non garantisce guadagni di performance; serve ottimizzazione architetturale.

## Font self-hosted + strategia preload

Abbiamo scaricato gli stessi file font da Google Fonts nella cartella `public/fonts/` e spostato la definizione `@font-face` in `app.vue`. Il dettaglio critico: usiamo `<link rel="preload">` per richiedere i file font direttamente nella risposta HTML iniziale, prima del parse CSS.

```vue
<!-- app.vue -->
<script setup>
useHead({
  link: [
    {
      rel: 'preload',
      href: '/fonts/inter-var.woff2',
      as: 'font',
      type: 'font/woff2',
      crossorigin: 'anonymous'
    }
  ]
})
</script>

<style>
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2');
  font-display: swap;
  font-weight: 100 900;
}
</style>
```

**Guadagno:** LCP 10,2s → 7,8s (riduzione di 2,4s). Il caricamento font esce dalla categoria render-blocking, FOIT (Flash of Invisible Text) passa da 1200ms a 180ms. **Trade-off:** i file font vivono ora nel nostro CDN, la versionatura diventa manuale (noi l'abbiamo risolta con bucket Cloudflare R2 + header Cache-Control).

## Lazy hydration selettiva + `content-visibility`

Il comportamento di default di Nuxt 3 è idratare ogni component. Ma i component che non stanno above-the-fold (footer, sezione commenti, prodotti correlati) non hanno bisogno di essere idratati prima che l'utente scrolli. Con il modulo `@nuxt/lazy-hydration` abbiamo wrappato questi component in `LazyHydrate`.

```vue
<template>
  <LazyHydrate when-visible>
    <ProductRecommendations :product-id="productId" />
  </LazyHydrate>
</template>
```

Dal lato CSS, `content-visibility: auto` comunica al browser: "non fare calcoli di rendering per questo elemento se non è nel viewport".

```css
.product-recommendations {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* placeholder height */
}
```

**Guadagno:** TBT 2190ms → 420ms, LCP 7,8s → 4,1s. Il bundle JS iniziale è sceso da 420kB a 180kB (brotli-compressed). **Trade-off:** `when-visible` si affida all'Intersection Observer API; il polyfill per browser vecchi (IE11) è necessario, anche se nel nostro caso (target browser moderni) non è stato un problema.

## Edge caching + approccio ibrido ISR

Cloudflare Pages per default cachea i file statici ma non gli endpoint SSR (tutto fuori da `/_nuxt/...`). In `nuxt.config.ts` abbiamo definito `routeRules` per specificare quali path cacheare e per quanto tempo:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/': { swr: 3600 }, // homepage 1h stale-while-revalidate
    '/urun/**': { swr: 1800 }, // pagine prodotto 30m
    '/kategori/**': { static: true } // pagine categoria static build-time
  }
})
```

La strategia `swr` (stale-while-revalidate): la prima request fa SSR render, le request successive vengono dalla cache mentre il re-render accade in background. Abbiamo usato Cloudflare KV store con URL + user segment (logged-in/anonimo) come cache key.

**Guadagno:** TTFB (Time to First Byte) 840ms → 120ms, LCP 4,1s → 2,3s. Cache hit rate prima settimana 78%. **Trade-off:** la personalizzazione dipende dalla cache key; dati user-specific (numero di articoli nel carrello) non possono essere cachati, li fetchiamo client-side.

## Ottimizzazione immagine above-the-fold

L'immagine hero è passata da JPEG 1,2MB a WebP 180kB; abbiamo aggiunto breakpoint responsivi con `<picture>`:

```vue
<picture>
  <source
    srcset="/images/hero-mobile.webp"
    media="(max-width: 640px)"
    type="image/webp"
  />
  <source
    srcset="/images/hero-desktop.webp"
    media="(min-width: 641px)"
    type="image/webp"
  />
  <img
    src="/images/hero-desktop.jpg"
    alt="Collezione nuova stagione"
    fetchpriority="high"
    decoding="async"
  />
</picture>
```

L'attributo `fetchpriority="high"` comunica al browser: "carica questa immagine con priorità". Cloudflare Image Resizing gestisce la conversione formato agli edge (serve JPEG ai browser che non supportano WebP).

**Guadagno:** LCP 2,3s → 2,1s, tempo caricamento immagine 1200ms → 320ms. CLS (Cumulative Layout Shift) 0,12 → 0,02 — abbiamo reservato lo spazio con la proprietà CSS `aspect-ratio`.

## Risultati del benchmark + impatto su utenti reali

PageSpeed Insights mobile score 34 → 92, desktop 62 → 98. Media CrUX a 28 giorni:

| Metrica | Prima | Dopo | Variazione |
|---------|-------|------|-----------|
| LCP | 10,2s | 2,1s | -79% |
| TBT | 2190ms | 420ms | -81% |
| CLS | 0,12 | 0,02 | -83% |
| TTFB | 840ms | 120ms | -86% |

Funnel conversione Google Analytics: tasso di inizio checkout sale da 3,2% a 4,8% (+50% relativo). Bounce rate 68% → 52%. Search Console: traffico organico aumenta del 34% in 2 mesi (altre variabili SEO costanti). Questi numeri rispecchiano gli obiettivi standard di Roibase nell'approccio [Headless Commerce](https://www.roibase.com.tr/it/headless) — se la performance non si converte in metriche di business, il cambio architetturale non è considerato vincente.

## Trade-off e criteri decisionali

**Developer experience:** aggiungere il wrapper lazy hydration espande la surface area dell'API dei component; i nuovi developer devono imparare la differenza tra `when-visible` e `when-idle`. L'abbiamo gestito con documentazione Storybook + ESLint rule.

**Bundle size vs cost runtime:** i file font self-hosted aggiungono +60kB al bundle iniziale, ma eliminano il costo di DNS lookup + TLS handshake del CDN esterno. Su reti mobile 3G è un guadagno netto; su fibra è neutrale.

**Invalidazione cache:** la strategia `swr` comporta il rischio di dati stantii. Per dati critici come disponibilità di stock, usiamo fetch client-side realtime (polling ogni 30s invece di WebSocket per ridurre i costi di edge function).

**Vendor lock-in Cloudflare:** il caching basato su KV è specifico di Cloudflare; migrare ad altro provider richiederebbe re-implementation. Però Vercel e Netlify hanno primitive simili, l'effort di migrazione è accettabile.

## Prossimi passi

2,1s di LCP è buono, ma il P75 (75° percentile) in CrUX è ancora 3,2s. La roadmap:

1. **Image CDN + automatic format negotiation:** passare a Imgix da Cloudflare Polish, supporto AVIF
2. **Prefetch strategy:** Intersection Observer per prefetch dati delle product card quando entrano nel viewport
3. **Service Worker + offline-first:** Workbox per cacheare asset critici, network-first fallback
4. **Aggressive bundle splitting:** code splitting di Nuxt 3 più aggressivo, chunking per route

L'ottimizzazione performance è un gioco senza fine — ogni 100ms guadagnati porta 1-2% di lift in conversione. La combinazione Nuxt 3 + Cloudflare Pages offre l'equilibrio tra rendering agli edge + ergonomia di un framework JS moderno. Quando si decide lo stack, il target LCP deve essere un requirement di business; poi si valutano le scelte architetturali dentro questo vincolo.