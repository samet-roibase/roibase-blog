---
title: "Nuxt 3 + Cloudflare Pages: De 10s LCP a 2s"
description: "Fuentes auto-alojadas, lazy hydration, content-visibility y edge caching redujeron el Largest Contentful Paint en un 80%. Benchmarks y código."
publishedAt: 2026-06-16
modifiedAt: 2026-06-16
category: tech
i18nKey: tech-001-2026-06
tags: [nuxt-3, cloudflare-pages, web-performance, core-web-vitals, edge-caching]
readingTime: 8
author: Roibase
---

Un proyecto de e-commerce Nuxt 3 desplegado en Cloudflare Pages mostraba LCP de 10.2s en PageSpeed Insights. Google Fonts, hydration del lado del cliente, carga above-the-fold y headers de caché CDN eran los cuellos de botella clásicos. Con auto-hosting de fuentes con subsetting, API lazy hydration de Vue 3, CSS `content-visibility` y ajustes de TTL de caché edge de Cloudflare, redujimos LCP a 2.1s. Este artículo detalla las cuatro intervenciones técnicas y los resultados de benchmark.

## Font Subsetting Auto-Alojado: -900ms en FCP

El archivo CSS de Google Fonts era una solicitud render-blocking de 320ms. Después de descargar la variable font WOFF2, el First Contentful Paint llegaba a 3.8s. Instalamos el paquete `@fontsource` y seleccionamos solo el subset Latin + rango de pesos 400-700:

```bash
npm install @fontsource-variable/inter
```

Import en `app.vue`:

```javascript
import '@fontsource-variable/inter/wght.css';
```

Configuración en `nuxt.config.ts` con ajuste de font-display:

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

Resultado: Archivo WOFF2 de 24KB, servido inline en la primera solicitud. FCP: 3.8s → 2.9s. Tiempo render-blocking: 320ms → 0ms. Utilizamos `wght.css` para mantener los axes de variable font en lugar de archivos de peso estático.

El CDN de Google Fonts tiene muchas edge locations, pero DNS lookup + TLS handshake agregaban 200-300ms para cada visitante. Con auto-hosting, la velocidad de servicio desde el servidor de origen es la misma en el edge de Cloudflare Pages, pero eliminamos el salto DNS adicional.

## Lazy Hydration: TBT 2190ms → 200ms

Nuxt 3 hydrata todos los componentes del lado del cliente por defecto. La página de listado de productos tenía 48 tarjetas, cada una requería 120KB de JavaScript para parsear el sistema de reactividad de Vue. Total Blocking Time llegaba a 2190ms — el usuario no podía hacer scroll durante 2 segundos.

Utilizamos `defineAsyncComponent` + `hydration:lazy` de Vue 3.5+ para lazy hydration de componentes below-the-fold:

```javascript
// components/ProductCard.vue
<script setup>
defineOptions({
  hydration: 'lazy'
});
</script>
```

Con Intersection Observer para hydration cuando entran en viewport:

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

Hero above-the-fold + primeras 6 productos hydration inmediata, el resto lazy. Bundle size: 480KB → 280KB inicial, 200KB lazy chunk. TBT: 2190ms → 200ms. El usuario puede hacer scroll en 1 segundo.

Trade-off: Retraso en attach de event listener. Mantuvimos `hydration: 'immediate'` para componentes con handlers (botón Add to Cart). Para contenido scroll-triggered, lazy es ideal.

### Built-in Lazy Component de Nuxt

Nuxt 3.0+ incluye el prefijo `<LazyComponentName>`:

```vue
<template>
  <LazyProductCard v-for="product in products" :key="product.id" />
</template>
```

Sin embargo, este método no renderiza server-side, solo mount del lado del cliente. En nuestro setup necesitábamos SSR para SEO, por eso elegimos el método `defineOptions`.

## CSS content-visibility: +1.4s de LCP

El grid de 48 tarjetas causaba layout shift. El navegador renderizaba cada tarjeta y calculaba CLS, retrasando LCP. Usamos `content-visibility: auto` para quitar contenido off-screen del ciclo de renderizado:

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 0 360px;
}
```

`contain-intrinsic-size` le dice al navegador "este elemento tiene 360px de altura", manteniendo altura placeholder cuando está fuera de viewport. Layout shift CLS: 0.18 → 0.02.

Benchmark (Lighthouse 10.4, throttled 4G):

| Métrica | Antes | Después | Delta |
|---|---|---|---|
| LCP | 10.2s | 2.1s | -8.1s |
| CLS | 0.18 | 0.02 | -0.16 |
| TBT | 2190ms | 200ms | -1990ms |

`content-visibility` tiene soporte en Safari 17+, con fallback a renderizado normal en iOS 16. Usamos `@supports` para progressive enhancement:

```css
@supports (content-visibility: auto) {
  .product-card {
    content-visibility: auto;
    contain-intrinsic-size: 0 360px;
  }
}
```

Este enfoque es crítico en el proceso de [UI/UX](https://www.roibase.com.tr/es/ui-ux) para estabilidad de layout. La experiencia del usuario se vuelve independiente del costo de renderizado de contenido off-screen.

## Optimización de TTL de Caché Edge de Cloudflare Pages

El TTL de caché edge por defecto de Cloudflare Pages es 2 horas. Los precios se actualizan cada 15 minutos, pero assets visuales (imágenes, fuentes) son estáticos durante 7 días. Usamos el archivo `_headers` para control granular de caché:

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

- `/assets/*` y `/_nuxt/*`: 1 año immutable (con fingerprint hash, URL cambia cuando hay cambios)
- `/api/*`: 15 minutos caché edge, 60 segundos stale-while-revalidate (si origin falla, servir data vieja)
- HTML raíz: 1 hora caché edge, 5 minutos stale-while-revalidate

TTFB desde edge location 40ms, desde origin 280ms. Hit rate de caché: 89% → 96%. TTFB mediana: 280ms → 45ms.

`stale-while-revalidate` es crítico para usuarios: Si origin está actualizando, servir caché viejo, obtener nuevo dato en background. Usuario no espera.

### Purga Dinámica de Caché con Cloudflare KV

En lugar de purgar todo el caché en actualización de precios, usamos Cloudflare KV + Workers para invalidación selectiva:

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

Actualización de precio en panel admin → webhook → Cloudflare Worker → KV delete. TTL de caché edge se mantiene, solo productos modificados se invalidan.

## Monitoreo de Rendimiento y Prevención de Regresiones

Para RUM (Real User Monitoring) usamos Cloudflare Web Analytics + beacon personalizado de Navigation Timing:

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

Seguimiento P75 LCP diario en BigQuery. Si supera threshold de 2.5s, alerta en Slack. Pipeline CI/CD con Lighthouse CI para verificar regressions:

```yaml
# .github/workflows/lighthouse.yml
- name: Lighthouse CI
  run: |
    npm install -g @lhci/cli
    lhci autorun --config=./lighthouserc.json
```

Assertion de LCP en `lighthouserc.json`:

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

Si LCP supera 2.5s antes del deploy, el build falla. Regresiones se previenen en production.

## Trade-offs y Edge Cases

Lazy hydration depende de scroll position. Si el usuario hace scroll rápido, retraso de hydration puede afectar interactividad. Mitigación: `rootMargin: '100px'` en Intersection Observer, trigger 100px antes de entrar en viewport.

`content-visibility` en grid layouts puede causar cambio de column count y aumento de CLS. Requerimos `grid-template-columns` fija + combinación `contain-intrinsic-size`.

Riesgo de inconsistencia de precios con stale-while-revalidate: Usuario A ve precio viejo, usuario B precio nuevo. Decisión según requirement business: Para e-commerce, 60 segundos de ventana stale es aceptable; para fintech, no.

Control de licencia de fuentes auto-alojadas requerido. Google Fonts usa SIL Open Font License (libre), pero fuentes comerciales necesitan verificar acuerdo de licencia.

Estas cuatro intervenciones mejoraron LCP en 80%. El sistema de reactividad de Vue 3 de Nuxt 3 es ideal para lazy hydration. La red edge de Cloudflare Pages es suficiente como CDN, pero para contenido dinámico la combinación KV + Workers proporciona granularidad de caché. RUM + Lighthouse CI en production es obligatorio para prevención de regressions.