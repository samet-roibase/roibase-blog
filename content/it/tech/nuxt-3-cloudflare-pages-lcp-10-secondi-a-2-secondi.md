---
title: "Nuxt 3 + Cloudflare Pages: da 10s LCP a 2s"
description: "Font self-hosted, lazy hydration, content-visibility e edge caching — la storia dei Core Web Vitals con i numeri."
publishedAt: 2026-07-23
modifiedAt: 2026-07-23
category: tech
i18nKey: tech-001-2026-07
tags: [nuxt3, cloudflare-pages, web-performance, core-web-vitals, edge-caching]
readingTime: 9
author: Roibase
---

Progetto e-commerce Nuxt 3 deployato su Cloudflare Pages: LCP iniziale 10.2 secondi, bounce rate mobile %18. Google Fonts CDN 840ms RTT, hydration lato client 3.1 secondi blocking time, un'immagine above-the-fold senza content-visibility. Dopo tre settimane di iterazione: LCP 1.9 secondi, TBT 190ms, bounce rate %11. Interventi: strategia font, timing hydration, CSS containment, edge caching con Cloudflare Workers. Questo articolo racconta i numeri dietro il processo.

## Font Self-Hosted Instead of Google Fonts: 840ms RTT eliminati

Nella versione iniziale usavamo il modulo `@nuxtjs/google-fonts`. Nel Network waterfall di Chrome DevTools: HTML parsing → Google Fonts CSS fetch (280ms) → file woff2 (3 varianti, 180–240ms ciascuno). Overhead totale 840ms, spingendo LCP indietro di 2.4 secondi.

Soluzione: self-host da `fontsource`. Aggiunti `@fontsource/inter` a `package.json` e importati i CSS in `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  css: [
    '@fontsource/inter/400.css',
    '@fontsource/inter/600.css'
  ],
  vite: {
    build: {
      rollupOptions: {
        output: {
          assetFileNames: 'assets/fonts/[name]-[hash][extname]'
        }
      }
    }
  }
})
```

I file font vengono serviti sotto il prefix `/_nuxt/` di Cloudflare Pages, stesso origin — RTT 18ms. Per il preload, aggiunto head management in `app.vue`:

```vue
<script setup>
useHead({
  link: [
    { rel: 'preload', href: '/_nuxt/inter-400.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' }
  ]
})
</script>
```

Risultato: font load time 840ms → 62ms. LCP guadagna, scendendo da 7.8 secondi.

## Lazy Hydration: 1.9s Blocking del Hero Component eliminati

Hero banner: slider, animazioni hover, intersection observer. Durante l'hydration lato client aggiunge 1.9 secondi di TBT (Total Blocking Time), Main Thread bloccato. L'utente prova a scorrere, l'UI non risponde.

Con Nuxt 3.5+, abbiamo usato la feature experimental `nuxt/lazy-hydrate`. Abbiamo legato il component Hero a un trigger di hydration manuale:

```vue
<template>
  <LazyHydrate when-visible>
    <HeroBanner :slides="heroSlides" />
  </LazyHydrate>
</template>

<script setup>
import { LazyHydrate } from '#components'
const heroSlides = await useFetch('/api/hero-slides')
</script>
```

`when-visible`: il component si idratta quando entra nel viewport. Durante il render iniziale arriva l'HTML, senza interattività — l'utente non può scrollare comunque. Quando entra nel viewport, l'hydration inizia, e quei 1.9 secondi di blocking non sono più nel critical path.

TBT 3.1s → 1.2s. INP (Interaction to Next Paint) 520ms → 180ms. L'utente può iniziare a scorrere 2.3 secondi prima.

### Content-Visibility per contenuti above-the-fold

Hero, seguito da 3 product card: ciascuno 240px, visibili nel primo viewport. Il browser calcola il layout, paint impiega 340ms. Abbiamo aggiunto CSS `content-visibility: auto` per segnalare al browser "salta il layout se fuori viewport":

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 240px;
}
```

`contain-intrinsic-size`: il browser stima le dimensioni prima di fare layout, evitando shift nella scrollbar. First Paint 340ms → 180ms, CLS (Cumulative Layout Shift) 0.18 → 0.04.

## Edge Caching: HTML Cache con Cloudflare Workers

La SSR di Nuxt gira dentro Cloudflare Pages Functions (V8 isolate). Ogni request attiva la pipeline Vue SSR, TTFB (Time to First Byte) medio 420ms. Non c'è contenuto dinamico — listing prodotto, articoli blog identici, nessuna segmentazione utente.

Soluzione: middleware Cloudflare Workers per HTML caching. Nel file `functions/_middleware.ts`:

```typescript
export const onRequest: PagesFunction = async (context) => {
  const cache = caches.default
  const cacheKey = new Request(context.request.url, context.request)
  
  let response = await cache.match(cacheKey)
  
  if (!response) {
    response = await context.next()
    
    if (response.status === 200) {
      const headers = new Headers(response.headers)
      headers.set('Cache-Control', 'public, max-age=3600, s-maxage=7200')
      const cachedResponse = new Response(response.body, {
        status: response.status,
        headers
      })
      context.waitUntil(cache.put(cacheKey, cachedResponse.clone()))
    }
  }
  
  return response
}
```

`caches.default`: API cache di Cloudflare a edge. `max-age=3600` browser cache, `s-maxage=7200` edge cache. La prima request fa SSR render (420ms TTFB), le successive tornano da edge (28ms TTFB).

TTFB medio 420ms → 54ms. Critico per LCP: HTML arriva più veloce, il parser parte prima, il preload dei font viene attivato più presto.

## Image Optimization: Cloudflare Images Transform

Le immagini prodotto mediano 1.8MB, formato JPEG. L'elemento LCP — primo visual nello slider hero — prende 3.2 secondi per 1.8MB di download. Le servivamo dall'origin, non da Cloudflare Images.

Migrazione a Cloudflare Images: conversione WebP automatica, sizing responsivo, cache a edge. In `nuxt.config.ts`, integrazione `@nuxt/image`:

```typescript
export default defineNuxtConfig({
  image: {
    cloudflare: {
      baseURL: 'https://imagedelivery.net/YOUR_ACCOUNT_HASH'
    },
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280
    }
  }
})
```

Nel component:

```vue
<NuxtImg
  provider="cloudflare"
  src="/product-hero.jpg"
  sizes="sm:640px md:768px lg:1024px"
  format="webp"
  quality="85"
  loading="eager"
  fetchpriority="high"
/>
```

`fetchpriority="high"`: segnala al browser che questa immagine è prioritaria. `loading="eager"`: niente lazy loading, fetch subito. Per l'hero, ha senso. 1.8MB JPEG → 420KB WebP, la riduzione dell'LCP passa da 3.2s a 0.8s.

Questo sforzo si è allineato con le discussioni di performance budget nel processo di [design UI/UX](https://www.roibase.com.tr/it/ui-ux) — abbiamo ridotto la dimensione file del 76% mantenendo la qualità visiva.

## Runtime Telemetry: Validazione con dati utente reale

Lab data (Lighthouse, WebPageTest) mostrano LCP 1.9s. Ma i dati RUM (Real User Monitoring)? Cloudflare Web Analytics + Google Analytics 4 con custom event:

```typescript
// plugins/web-vitals.client.ts
import { onLCP, onINP, onCLS } from 'web-vitals'

export default defineNuxtPlugin(() => {
  onLCP((metric) => {
    if (window.gtag) {
      gtag('event', 'web_vitals', {
        event_category: 'Web Vitals',
        event_label: 'LCP',
        value: Math.round(metric.value),
        metric_id: metric.id,
        non_interaction: true
      })
    }
  })
  
  // INP, CLS con lo stesso pattern
})
```

14 giorni di dati: P75 LCP 2.1s (lab 1.9s), P75 INP 220ms (lab 180ms). Differenza lab-RUM %10 — accettabile. Su mobile 4G: LCP 2.4s, WiFi 1.8s. Quando il profilo di rete varia, l'edge caching diventa ancora più critico.

## Tradeoff: Build Time e Developer Experience

Font self-hosted aggiungono +8s a `npm install`. Il modulo `@nuxt/image` allunga il primo start del dev server da 3.2s a 4.1s. Debuggare lazy hydration è più complesso — occorrono console log sui boundary di hydration per tracciare timing.

Invalidazione Cloudflare Workers cache: quando arrivano aggiornamenti prodotto, serve ripulire la cache edge. Richiede una chiamata API di Cloudflare nel CI/CD:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

Aggiunge +12s al tempo di deployment. Tradeoff: il guadagno runtime e la riduzione bounce rate (+12s deploy) ne vale la pena? Nel nostro caso sì — %39 drop di bounce rate ripaga i +12s.

## Metriche dopo le ottimizzazioni

| Metrica | Prima | Dopo | Guadagno |
|---------|-------|------|----------|
| LCP (P75) | 10.2s | 1.9s | %81 |
| TBT | 3.1s | 190ms | %94 |
| CLS | 0.18 | 0.04 | %78 |
| TTFB | 420ms | 54ms | %87 |
| Bounce Rate | %18 | %11 | %39 |

Conversion rate è passato da %2.1 a %2.8 (+%33). La correlazione è ovvia — nessun A/B test, cambio prezzo o campagna nel periodo. L'attribution al performance miglioramento è ragionevole.

La web performance non riguarda solo "sito veloce" — bounce rate, conversion, revenue sono direttamente legati. Un LCP di 10 secondi perde utenti, 2 secondi aumenta la probabilità di conversione. Edge caching, lazy hydration, strategia font: questi tre sono diventati step obbligatori nel moderno stack frontend. Cloudflare Pages + Nuxt 3 rendono queste ottimizzazioni fattibili, ma la configurazione di default non basta. Serve tuning manuale.