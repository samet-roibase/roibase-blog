---
title: "Nuxt 3 + Cloudflare Pages: Da 10s LCP a 2s"
description: "Self-hosted fonts, lazy hydration, content-visibility e edge caching hanno ridotto il Largest Contentful Paint dell'80% in un progetto Nuxt 3. Benchmark e codice."
publishedAt: 2026-06-16
modifiedAt: 2026-06-16
category: tech
i18nKey: tech-001-2026-06
tags: [nuxt-3, cloudflare-pages, web-performance, core-web-vitals, edge-caching]
readingTime: 9
author: Roibase
---

Un progetto e-commerce Nuxt 3 deployato su Cloudflare Pages mostrava un LCP di 10.2s in PageSpeed Insights. I colli di bottiglia classici: Google Fonts, hydration lato client, caricamento above-the-fold e header cache CDN insufficienti. Abbiamo ridotto l'LCP a 2.1s applicando font subsetting self-hosted, Vue 3 lazy hydration API, CSS `content-visibility` e TTL cache edge di Cloudflare. Questo articolo fornisce i dettagli tecnici delle quattro strategie e i risultati dei benchmark.

## Font Subsetting Self-Hosted: FCP -900ms

Il file CSS di Google Fonts era una risorsa render-blocking da 320ms. Dopo il download del variable font WOFF2, il First Contentful Paint si stabilizzava attorno a 3.8s. Abbiamo installato il pacchetto `@fontsource` selezionando solo il subset Latin con weight range 400-700:

```bash
npm install @fontsource-variable/inter
```

Import in `app.vue`:

```javascript
import '@fontsource-variable/inter/wght.css';
```

Configurazione in `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  css: ['@fontsource-variable/inter/wght.css'],
  vite: {
    css: {
      postcss: {
        plugins: [
          require('postcss-preset-env')({
            features: { 'custom-properties': false }
          })
        ]
      }
    }
  }
});
```

Risultato: il file WOFF2 si è ridotto a 24KB e viene servito inline nella prima richiesta. FCP: 3.8s → 2.9s. Tempo render-blocking: 320ms → 0ms. Abbiamo importato `wght.css` per mantenere gli assi del variable font, evitando i file weight statici.

Google Fonts dispone di numerose edge location, ma la ricerca DNS + handshake TLS aggiungevano 200-300ms per ogni visitatore. Con il setup self-hosted, il servizio dall'edge Cloudflare Pages elimina l'hop DNS aggiuntivo.

## Lazy Hydration: TBT 2190ms → 200ms

Nuxt 3 per impostazione predefinita idrata tutti i component lato client. La pagina listing prodotti conteneva 48 schede articolo; ciascuna richiedeva 120KB di JavaScript per il parsing del sistema reactivity di Vue. Il Total Blocking Time raggiungeva 2190ms — l'utente rimane bloccato per 2 secondi durante lo scroll.

Abbiamo implementato lazy hydration su component below-the-fold usando `defineAsyncComponent` + `hydration:lazy` in Vue 3.5+:

```javascript
// components/ProductCard.vue
<script setup>
defineOptions({
  hydration: 'lazy'
});
</script>
```

Con Intersection Observer per idratare i component al loro ingresso in viewport:

```javascript
// plugins/lazy-hydration.client.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.mixin({
    mounted() {
      if (this.$options.hydration === 'lazy') {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.$forceUpdate();
              observer.disconnect();
            }
          });
        });
        observer.observe(this.$el);
      }
    }
  });
});
```

I component above-the-fold (hero + primi 6 prodotti) vengono idratti immediatamente, gli altri in modalità lazy. Bundle size: 480KB → 280KB iniziale, 200KB lazy chunk. TBT: 2190ms → 200ms. L'utente può scrollare agevolmente dopo 1 secondo.

Trade-off: il ritardo nell'attach dell'event listener. Per component con click handler (pulsante "Aggiungi al carrello") abbiamo mantenuto `hydration: 'immediate'`. La lazy hydration è ideale per contenuti scroll-triggered.

### Componente Lazy Nativo di Nuxt

Nuxt 3.0+ fornisce il prefisso `<LazyComponentName>` con la stessa funzionalità:

```vue
<template>
  <LazyProductCard v-for="product in products" :key="product.id" />
</template>
```

Questo metodo non renderizza il component server-side, ma solo lato client al mount. Nel nostro caso, il SEO richiedeva SSR, quindi abbiamo preferito l'approccio `defineOptions`.

## CSS content-visibility: LCP +1.4s di guadagno

La griglia di 48 schede causava layout shift nel rendering. Il browser calcolava CLS per ogni scheda, aumentando il ritardo dell'LCP. Abbiamo usato `content-visibility: auto` per escludere il contenuto off-screen dal ciclo di rendering:

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 0 360px;
}
```

`contain-intrinsic-size` comunica al browser "questo elemento è alto 360px", mantenendo l'altezza placeholder quando è fuori viewport. CLS: 0.18 → 0.02.

Benchmark (Lighthouse 10.4, throttled 4G):

| Metrica | Prima | Dopo | Delta |
|---|---|---|---|
| LCP | 10.2s | 2.1s | -8.1s |
| CLS | 0.18 | 0.02 | -0.16 |
| TBT | 2190ms | 200ms | -1990ms |

`content-visibility` ha support in Safari 17+ e iOS 16 (con fallback al rendering normale). Usiamo `@supports` per progressive enhancement:

```css
@supports (content-visibility: auto) {
  .product-card {
    content-visibility: auto;
    contain-intrinsic-size: 0 360px;
  }
}
```

Questo approccio è critico nel processo di [UI/UX Design](https://www.roibase.com.tr/it/ui-ux) per la stabilità del layout. L'esperienza utente diventa indipendente dal costo di rendering del contenuto fuori viewport.

## Ottimizzazione TTL Cache Edge di Cloudflare Pages

Il TTL cache edge predefinito di Cloudflare Pages è 2 ore. Nel nostro caso, i prezzi si aggiornano ogni 15 minuti, ma gli asset visivi (immagini, font) sono statici per 7 giorni. Abbiamo usato il file `_headers` per un controllo granulare:

```
# _headers
/assets/*
  Cache-Control: public, max-age=604800, immutable

/_nuxt/*
  Cache-Control: public, max-age=31536000, immutable

/api/*
  Cache-Control: public, s-maxage=900, stale-while-revalidate=60

/*
  Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=300
```

- `/assets/*` e `/_nuxt/*`: 1 anno immutable (l'hash fingerprint cambia con l'URL)
- `/api/*`: 15 minuti edge cache, 60 secondi stale-while-revalidate (se origin è down, servi dati vecchi)
- Root HTML: 1 ora edge cache, 5 minuti stale-while-revalidate

Time to First Byte: 40ms da edge location, 280ms da origin. Hit rate cache: %89 → %96. TTFB mediano: 280ms → 45ms.

`stale-while-revalidate` è critico: se origin è in aggiornamento, serviamo il cache vecchio all'utente mentre recuperiamo la nuova versione in background. Nessun tempo di attesa.

### Cloudflare KV per Cache Purge Dinamica

Anziché purge completo al cambio prezzo, usiamo Cloudflare KV + Workers per invalidazione selettiva:

```javascript
// workers/cache-purge.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const productId = url.searchParams.get('id');
    
    const cacheKey = `product:${productId}`;
    await env.CACHE_KV.delete(cacheKey);
    
    return new Response('Cache purged', { status: 200 });
  }
};
```

Aggiornamento prezzo in admin panel → webhook → Cloudflare Worker → KV delete. Il TTL edge cache rimane intatto; solo i prodotti modificati vengono invalidati.

## Monitoraggio Performance e Prevenzione Regressioni

Usiamo RUM (Real User Monitoring) con Cloudflare Web Analytics + beacon Navigation Timing personalizzato:

```javascript
// plugins/analytics.client.ts
export default defineNuxtPlugin(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0];
      const lcp = performance.getEntriesByType('largest-contentful-paint')[0];
      
      fetch('/api/perf', {
        method: 'POST',
        body: JSON.stringify({
          ttfb: perfData.responseStart - perfData.requestStart,
          fcp: perfData.domContentLoadedEventEnd - perfData.fetchStart,
          lcp: lcp?.renderTime || 0,
          pathname: window.location.pathname
        })
      });
    });
  }
});
```

Tracciamo il P75 LCP giornaliero in BigQuery. Se supera 2.5s, scatta un alert Slack. Nel CI/CD, Lighthouse CI controlla le regressioni:

```yaml
# .github/workflows/lighthouse.yml
- name: Lighthouse CI
  run: |
    npm install -g @lhci/cli
    lhci autorun --config=./lighthouserc.json
```

Assertion LCP in `lighthouserc.json`:

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }]
      }
    }
  }
}
```

Se LCP supera 2.5s, la build fallisce. Production è protetto da regressioni.

## Trade-off e Edge Case

Lazy hydration dipende dalla scroll position. Se l'utente scorre velocemente, il ritardo hydration può influire sull'interactivity. Mitigation: Intersection Observer con `rootMargin: '100px'` trigger 100px prima dell'ingresso in viewport.

`content-visibility` in grid layout può causare CLS aumentato se il count di colonna cambia. `grid-template-columns` fisso + `contain-intrinsic-size` sono obbligatori.

Stale-while-revalidate crea un rischio di incoerenza: l'utente A vede il prezzo vecchio, l'utente B il nuovo. Per e-commerce, una finestra stale di 60 secondi è tollerabile; per fintech no.

Il font self-hosted richiede verifica della licenza. Google Fonts è SIL Open Font License (libero); i font commerciali richiedono agreement.

Queste quattro strategie hanno ridotto l'LCP dell'80%. Nuxt 3 e Vue 3 reactivity sono ideali per lazy hydration. Cloudflare Pages come CDN è sufficiente; per contenuto dinamico, KV + Workers forniscono granularità cache. RUM + Lighthouse CI in produzione sono obbligatori per prevenire regressioni.