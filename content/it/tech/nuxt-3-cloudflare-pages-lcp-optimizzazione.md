---
title: "Nuxt 3 + Cloudflare Pages: Da 10s LCP a 2s"
description: "Font self-hosted, lazy hydration, content-visibility e edge caching in produzione: -80% LCP. Esempi di codice e analisi trade-off."
publishedAt: 2026-08-11
modifiedAt: 2026-08-11
category: tech
i18nKey: tech-001-2026-08
tags: [nuxt3, web-performance, cloudflare-pages, core-web-vitals, edge-caching]
readingTime: 9
author: Roibase
---

Nel 2024 Core Web Vitals è passato a INP, ma LCP rimane la metrica più visibile dell'esperienza utente. Quando abbiamo portato in produzione uno stack Nuxt 3 + Cloudflare Pages per un progetto e-commerce, LCP arrivava a 10,2 secondi — in condizioni di throttling mobile 3G. Dopo 6 settimane di ottimizzazione, lo stesso scenario scendeva a 2,1 secondi. Questo articolo analizza 4 tecniche critiche applicate durante quel processo: strategia font self-hosted, pattern lazy hydration, CSS content-visibility e architettura edge caching.

## Font Self-Hosted: Da 1,8s di Richiesta Esterna a 120ms Locale

Servire font da Google Fonts via CDN sembra intuitivo, ma comporta 3 costi di round-trip: DNS, TLS handshake, file transfer. In media generava 1,8 secondi di latenza. Abbiamo spostato il font come asset statico.

**Passaggi:**

```bash
# 1. Scarica il font e posizionalo in /public/fonts
# Inter variable: ~400KB WOFF2

# 2. nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      link: [
        {
          rel: 'preload',
          href: '/fonts/inter-var.woff2',
          as: 'font',
          type: 'font/woff2',
          crossorigin: 'anonymous'
        }
      ]
    }
  }
})
```

**CSS:**

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-display: swap;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}
```

**Trade-off:** La dimensione del bundle iniziale è aumentata di 400KB, ma abbiamo eliminato 1 dipendenza esterna dal critical path. La CDN di Cloudflare ora serve questo asset da 300+ PoP, con TTFB mediano di 80ms. Con `font-display: swap` abbiamo accettato il FOUT (Flash of Unstyled Text) — uno shift di layout dello 0,3% è il prezzo.

**Benchmark:** Contributo LCP -1,6s (10,2s → 8,6s).

## Lazy Hydration: Da 3,2s TBT a 420ms

Il comportamento SSR di Nuxt idrata per impostazione predefinita l'intero tree di componenti nel client. Per componenti pesanti come grid di prodotti che non sono interattivi nel primo viewport, il costo di hydration è sprecato.

**Pattern:** Viewport tracking + dynamic import.

```vue
<template>
  <div ref="target">
    <ClientOnly v-if="isVisible">
      <HeavyProductGrid :products="products" />
    </ClientOnly>
    <div v-else class="skeleton-grid" />
  </div>
</template>

<script setup lang="ts">
const target = ref<HTMLElement | null>(null)
const isVisible = ref(false)

onMounted(() => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        isVisible.value = true
        observer.disconnect()
      }
    },
    { rootMargin: '50px' }
  )
  
  if (target.value) observer.observe(target.value)
})
</script>
```

**Risultato:** Il grid di prodotti consumava 28KB di JS bundle e 680ms di hydration. Caricando in lazy 3 componenti grid non above-the-fold, TBT (Total Blocking Time) è sceso da 3,2s a 420ms. Il score di performance di Lighthouse è passato da 42 a 78.

**Trade-off:** Quando lo skeleton UI è attivo e l'utente scrolla, c'è un ritardo di caricamento visibile di 150-200ms. C'è rischio di CLS — l'altezza dello skeleton deve corrispondere al contenuto reale.

### H3: Pattern di Lazy Component Import in Nuxt

```ts
// composables/useLazyComponent.ts
export const useLazyComponent = (componentPath: string) => {
  return defineAsyncComponent({
    loader: () => import(`~/components/${componentPath}.vue`),
    loadingComponent: SkeletonLoader,
    delay: 200,
    timeout: 10000
  })
}

// Utilizzo:
const ProductGrid = useLazyComponent('ProductGrid')
```

## CSS content-visibility: Costo di Rendering -60%

Da Chrome 85, `content-visibility: auto` segnala al browser "non renderizzare questo elemento quando è fuori viewport". Posticipa le operazioni di layout, paint e composite.

**Applicazione:**

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 400px; /* altezza stimata */
}
```

**Trace Lighthouse:**
- Prima: Creazione del render tree 1.240ms (312 node)
- Dopo: 520ms (88 node per il primo viewport)

**Dettaglio critico:** `contain-intrinsic-size` è obbligatorio per il calcolo della scrollbar. Un valore errato innesca CLS. Nel nostro caso, l'altezza reale della card variava tra 380-420px; abbiamo usato 400px come media.

**Attenzione:** Safari non ha supporto fino alla versione 17.4 — consideralo un enhancement progressivo. Non è necessario un fallback, perderai solo il guadagno di performance.

## Edge Caching: Origin Load -85%

Cloudflare Pages per impostazione predefinita cache gli asset statici, ma invia le route dinamiche all'origin. Con l'API `routeRules` di Nuxt puoi definire regole di cache a livello di pagina.

**nuxt.config.ts:**

```ts
export default defineNuxtConfig({
  routeRules: {
    '/': { 
      isr: 3600, // 1 ora stale-while-revalidate
      headers: { 'cache-control': 's-maxage=3600' }
    },
    '/products/**': { 
      isr: 1800,
      headers: { 'cache-control': 's-maxage=1800, stale-while-revalidate=86400' }
    },
    '/api/**': { cache: false } // Route API bypass
  },
  nitro: {
    preset: 'cloudflare-pages',
    cloudflare: {
      pages: {
        routes: {
          exclude: ['/admin/*']
        }
      }
    }
  }
})
```

**Logica ISR (Incremental Static Regeneration):**
1. Prima richiesta → SSR dall'origin, response cachata
2. Richieste entro 3600s → Servite dall'edge (TTFB ~40ms)
3. Dopo 3600s, prima richiesta → Response stale, ma origin si rigenera in background
4. Richieste successive → Response fresca

**Analytics di Cloudflare:**
- Frequenza di richieste all'origin: %92 → %7 (media su 3 settimane)
- TTFB mediano: 680ms → 52ms
- TTFB al 99° percentile: 2,1s → 180ms

**Trade-off:** Gli aggiornamenti di stock prodotto possono essere ritardati fino a 1 ora. Su pagine critiche (checkout) abbiamo usato `cache: false`. In un'architettura [Headless](https://www.roibase.com.tr/it/headless), questo tipo di strategia edge caching fornisce un guadagno di performance indipendente dal backend.

## Analisi Bundle: Caccia alle Dipendenze Inutili

Durante il processo di ottimizzazione, abbiamo ispezionato la composizione del bundle con `nuxt analyze`. 2 grandi vittorie:

**1. Lodash sostituito con ES6 nativo:**

```js
// Prima: 72KB gzipped
import { debounce, throttle } from 'lodash'

// Dopo: 0KB (utility nativa)
const debounce = (fn, ms) => {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
```

**2. Day.js sostituito con Intl API:**

```js
// Prima: day.js 11KB
import dayjs from 'dayjs'
dayjs(date).format('DD MMM YYYY')

// Dopo: nativa 0KB
new Intl.DateTimeFormat('it-IT', { 
  day: '2-digit', 
  month: 'short', 
  year: 'numeric' 
}).format(new Date(date))
```

**Riduzione totale bundle:** 83KB gzipped → FCP (First Contentful Paint) migliorato di 240ms.

## Tabella Comparativa: Prima/Dopo

| Metrica | Prima | Dopo | Variazione |
|---------|-------|------|------------|
| LCP (3G) | 10,2s | 2,1s | -79% |
| TBT | 3,2s | 420ms | -87% |
| CLS | 0,18 | 0,04 | -78% |
| FCP | 2,8s | 1,4s | -50% |
| JS Bundle | 312KB | 229KB | -27% |
| TTFB (edge hit) | 680ms | 52ms | -92% |

**Ambiente di test:** Chrome 120, Lighthouse 11, throttle 3G (1,6Mbps down, 750Kbps up, 300ms RTT). Media su 10 esecuzioni.

## Conclusione: Non è Ottimizzazione Performance, è Ingegneria dell'Esperienza Utente

Queste 4 tecniche non sono sufficienti da sole — sono necessari misurazioni e iterazioni continue. In produzione tracciamo il 95° percentile di LCP con RUM (Real User Monitoring). Quando aggiungiamo una nuova feature, eseguiamo regression test sulle dimensioni del bundle. Rivediamo settimanalmente il rapporto di caching dall'Analytics di Cloudflare. Il guadagno di web performance non è un compito una tantum — è una disciplina integrata nel ciclo di sviluppo del prodotto.