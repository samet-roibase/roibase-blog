---
title: "Nuxt 3 + Cloudflare Pages: da 10s LCP a 2s"
description: "Font self-hosted, lazy hydration, content-visibility e edge caching hanno ridotto l'LCP del 80% su un progetto Nuxt 3. Codice concreto e benchmark."
publishedAt: 2026-05-28
modifiedAt: 2026-05-28
category: tech
i18nKey: tech-001-2026-05
tags: [nuxt3, web-performance, cloudflare-pages, core-web-vitals, edge-computing]
readingTime: 8
author: Roibase
---

La combinazione Cloudflare Pages + Nuxt 3 promette edge caching e deployment zero-config, ma per i Core Web Vitals non è sufficiente. In un progetto e-commerce in produzione, l'LCP era 10.2 secondi e il TBT 2190 millisecondi. Google Font, hidratazione client-side, CSS globale e rendering JavaScript sincrono bloccavano il rendering critico. Con font self-hosted, lazy hydration, la proprietà CSS `content-visibility` e una strategia di edge cache, abbiamo ridotto l'LCP a 2.1 secondi e il TBT a 180 millisecondi. In questo articolo condividiamo l'implementazione passo dopo passo e gli effetti collaterali.

## Google Font Render Blocking: 3.8s Perso

I font scaricati dalla CDN di Google Fonts tramite `@import` o `<link>` bloccano il rendering. Il rischio FOIT (Flash of Invisible Text) e la latenza di 3+ round-trip impattano direttamente l'LCP. In Chrome DevTools, Lighthouse segnalava "Eliminate render-blocking resources" con 3.8 secondi di perdita.

Soluzione: font self-hosted. Abbiamo usato il pacchetto npm `@fontsource/inter` e posizionato i file Woff2 in `public/fonts`. Nella config di Nuxt abbiamo aggiunto `preload`:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      link: [
        {
          rel: 'preload',
          as: 'font',
          type: 'font/woff2',
          href: '/fonts/inter-latin-400-normal.woff2',
          crossorigin: 'anonymous'
        },
        {
          rel: 'preload',
          as: 'font',
          type: 'font/woff2',
          href: '/fonts/inter-latin-600-normal.woff2',
          crossorigin: 'anonymous'
        }
      ]
    }
  }
})
```

Nel CSS abbiamo definito `@font-face` solo per i pesi utilizzati:

```css
/* assets/css/fonts.css */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/inter-latin-400-normal.woff2') format('woff2');
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/fonts/inter-latin-600-normal.woff2') format('woff2');
}
```

Con `font-display: swap`, il FOUT (Flash of Unstyled Text) è un trade-off accettabile — il font di sistema viene mostrato finché il font non è pronto. L'LCP è sceso a 6.4 secondi. L'aumento di bundle size è 72 KB (Woff2 compresso), ma il guadagno di 3.8 secondi ne valeva la pena.

## Hidratazione Client-Side: TBT 2190ms

Nuxt 3 per default idrata tutti i component sul client. Con 40+ component in `app.vue`, stato globale (Pinia), composable e librerie terze (Swiper, vue-gtag), il main thread veniva bloccato. Nel tab Performance di Chrome DevTools vedevamo 8 "Long Tasks", la più lunga 1240 millisecondi.

### Idratazione Lazy con Prioritizzazione

Abbiamo reso lazy i component non above-the-fold. Dopo aver integrato `@nuxtjs/web-vitals` per tracciare INP e TBT, abbiamo identificato il critical path:

```vue
<!-- pages/index.vue -->
<template>
  <div>
    <!-- Above-the-fold: idrata subito -->
    <HeroSection />
    <ProductGrid :products="products" />

    <!-- Below-the-fold: idrata lazy -->
    <LazyFooter v-if="mounted" />
    <LazyNewsletterForm v-if="mounted" />
    <client-only>
      <LazyReviewCarousel :reviews="reviews" />
    </client-only>
  </div>
</template>

<script setup lang="ts">
const mounted = ref(false)

onMounted(() => {
  requestIdleCallback(() => {
    mounted.value = true
  })
})
</script>
```

Con il wrapper `<client-only>` abbiamo escluso dalla SSR le librerie dipendenti dal DOM come Swiper. Con `requestIdleCallback` l'idratazione avviene quando il main thread è libero. Il TBT è sceso a 840 millisecondi.

### Bundle Splitting e Code Splitting

Con `vite-plugin-inspect` abbiamo analizzato il bundle. La libreria Swiper da sola era 168 KB minificata, ma usata solo nel carousel di review. Invece di split dinamici, abbiamo ridotto l'uso — rimossi i moduli `Virtual` e `Autoplay`, lasciato solo `Navigation`:

```typescript
// composables/useSwiper.ts
import { Navigation } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'

export const useSwiperModules = () => [Navigation]
```

Il bundle è sceso da 168 KB a 42 KB. Poiché `<LazyReviewCarousel>` è già lazy loaded, non entra nel bundle iniziale.

## Content-Visibility: Ridurre il Periodo di Render

La product grid ha 48 schede prodotto, ognuna con immagine + titolo + prezzo + bottone. Durante il render iniziale, il browser calcola il layout di 48 schede contemporaneamente, allungando l'LCP. Con la proprietà CSS `content-visibility: auto` abbiamo escluso dal rendering le schede below-the-fold:

```css
/* components/ProductCard.vue */
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 320px 420px;
}
```

`contain-intrinsic-size` comunica al browser le dimensioni del placeholder, evitando errori nel calcolo della posizione dello scroll. L'LCP è sceso da 6.4 a 3.9 secondi. Il trade-off: le schede fuori viewport vengono renderizzate al scroll, ma l'impatto sull'INP è 12 millisecondi (accettabile).

## Edge Caching: TTFB da 1.2s a 40ms

Cloudflare Pages per default non cache l'HTML, ogni richiesta va all'origin. La risposta SSR di Nuxt 3 richiede mediamente 1200 millisecondi (API call + rendering). Con il file `_headers` abbiamo attivato l'edge caching:

```
# public/_headers
/*
  Cache-Control: public, max-age=0, s-maxage=600, stale-while-revalidate=86400
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
```

Con `s-maxage=600`, Cloudflare cache su edge per 10 minuti. Con `stale-while-revalidate=86400`, quando la cache scade, la versione vecchia viene mostrata mentre il nuovo render avviene in background. Il TTFB è sceso a 40 millisecondi (edge hit). Le richieste all'origin avvengono solo su cache miss o revalidazione stale.

### ISR con Rendering Ibrido

Per le pagine prodotto abbiamo usato Incremental Static Regeneration. In Nuxt si configura con `routeRules`:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/products/**': { 
      swr: 600,  // 10 minuti
      prerender: false
    },
    '/': { 
      swr: 300   // 5 minuti
    }
  }
})
```

La prima richiesta è SSR, poi edge cache. Per gli aggiornamenti di stock, facciamo purge manuale tramite webhook:

```typescript
// server/api/purge-cache.post.ts
export default defineEventHandler(async (event) => {
  const { productId } = await readBody(event)
  
  await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/purge_cache`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      files: [`https://example.com/products/${productId}`]
    })
  })
  
  return { success: true }
})
```

## Benchmark Comparativi

| Metrica | Prima | Dopo | Cambiamento |
|---------|-------|------|-------------|
| LCP | 10.2s | 2.1s | -79% |
| TBT | 2190ms | 180ms | -92% |
| TTFB | 1200ms | 40ms | -97% |
| FCP | 4.8s | 1.2s | -75% |
| CLS | 0.18 | 0.02 | -89% |
| Bundle (iniziale) | 284 KB | 186 KB | -34% |

Ambiente di test: Chrome 121, throttling 4G, Lighthouse CI. Media di 10 esecuzioni. L'LCP sotto 2.5 secondi (soglia "Good" di Google) è stato raggiunto.

## Trade-off e Accorgimenti

I font self-hosted perdono la rete edge globale della CDN, ma Cloudflare Pages è già ospitato su edge. Con la compressione Woff2, la latenza aggiuntiva è minima. L'idratazione lazy comporta una perdita di interattività iniziale — i component below-the-fold diventano interattivi dopo il mount hook. Metriche come "time to interactive below fold" vanno aggiunte agli analytics.

`content-visibility` non è supportato su Safari 17.4 precedente; usare `@supports` per proteggere. L'edge caching può conflittare con la personalizzazione — contenuti dinamici come carrello e login state vanno protetti con `Cache-Control: private` o renderizzati lato client.

ISR webhook purge è un processo manuale; va integrato con automazione nel sistema di inventory management. Esiste rischio di contenuti stale — pagine critiche (checkout, pagamento) devono avere ISR disabilitato.

## Architettura Composable e Scalabilità

Abbiamo testato queste ottimizzazioni in architettura [Headless Commerce](https://www.roibase.com.tr/it/headless) — frontend Nuxt 3, backend Shopify Storefront API. Lo stesso pattern funziona su Next.js + Hydrogen o Remix. La strategia di edge caching è framework-agnostic, estendibile con Cloudflare Workers KV o Vercel Edge Config. Per il monitoraggio performance, `@nuxtjs/web-vitals` dovrebbe cedere il passo a RUM (Real User Monitoring) — Cloudflare Web Analytics o Sentry Performance.

L'LCP di 2.1 secondi rientra nella categoria "Good" di Google, ma va testato su 4G lento in mobile. Con progressive enhancement, l'HTML SSR deve funzionare senza JavaScript — usare il component `<NoScript>` di Nuxt. I contenuti critici vanno renderizzati senza JavaScript.