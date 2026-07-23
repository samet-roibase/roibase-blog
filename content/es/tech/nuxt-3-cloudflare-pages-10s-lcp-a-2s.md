---
title: "Nuxt 3 + Cloudflare Pages: de 10s LCP a 2s"
description: "Fonts auto-alojados, lazy hydration, content-visibility y edge caching: la historia de optimización de Core Web Vitals con números reales."
publishedAt: 2026-07-23
modifiedAt: 2026-07-23
category: tech
i18nKey: tech-001-2026-07
tags: [nuxt3, cloudflare-pages, web-performance, core-web-vitals, edge-caching]
readingTime: 8
author: Roibase
---

Un proyecto de e-commerce en Nuxt 3 deployado en Cloudflare Pages: render inicial con LCP de 10.2 segundos, bounce rate del %18 en móvil. Google Fonts CDN con 840ms RTT, hydration client-side bloqueando 3.1 segundos, una imagen above-the-fold sin content-visibility. Tras tres semanas de iteración: LCP de 1.9 segundos, TBT 190ms, bounce rate %11. Los cambios: estrategia de fonts, timing de hydration, CSS containment, edge caching con Cloudflare Workers. Este artículo cuenta cómo se logró con números.

## Self-Hosted Fonts en lugar de Google Fonts: 840ms RTT eliminados

En la versión inicial usábamos el módulo `@nuxtjs/google-fonts`. En el Network waterfall de Chrome DevTools se veía: HTML parse → fetch de CSS de Google Fonts (280ms) → archivos woff2 (3 variantes, cada uno 180-240ms). Overhead de red total 840ms, empujando el LCP 2.4 segundos atrás.

Solución: auto-alojar desde `fontsource`. Agregamos `@fontsource/inter` al `package.json`, importamos en `nuxt.config.ts`:

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

Los archivos de fonts se sirven bajo el prefix `/_nuxt/` de Cloudflare Pages, mismo origen — RTT 18ms. Para preload, usamos head management en `app.vue`:

```vue
<script setup>
useHead({
  link: [
    { rel: 'preload', href: '/_nuxt/inter-400.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' }
  ]
})
</script>
```

Resultado: font load time 840ms → 62ms. LCP ganó 2.4 segundos, cayendo a 7.8 segundos.

## Lazy Hydration: eliminó 1.9s de bloqueo del hero

Hero banner: carrusel, animaciones hover, intersection observer. Durante la hydration client-side suma 1.9 segundos de TBT (Total Blocking Time), Main Thread bloqueado. El usuario intenta scroll, la UI no responde.

Con Nuxt 3.5+ usamos `nuxt/lazy-hydrate`, una feature experimental. Enlazamos el hero component a hydration manual:

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

`when-visible`: el component se hydrata cuando entra al viewport. En el render inicial, llega HTML sin interactividad — el usuario no puede scroll de todas formas. Cuando entra al viewport, comienza la hydration, esos 1.9 segundos de bloqueo ya no están en el critical path.

TBT 3.1s → 1.2s. INP (Interaction to Next Paint) 520ms → 180ms. El usuario puede comenzar a hacer scroll 2.3 segundos antes.

### content-visibility para contenido above-the-fold

Tres product cards debajo del hero: cada una 240px de altura, visibles en el viewport inicial. El navegador calcula layout, el proceso de paint toma 340ms. Agregamos `content-visibility: auto` en CSS para señalar al navegador "salta layout si está fuera del viewport":

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 240px;
}
```

`contain-intrinsic-size`: el navegador estima tamaño antes de hacer layout, previniendo cambios en la scrollbar. First Paint 340ms → 180ms, CLS (Cumulative Layout Shift) de 0.18 a 0.04.

## Edge Caching: HTML cache con Cloudflare Workers

El SSR de Nuxt se ejecuta en Cloudflare Pages Functions (V8 isolate). Cada request dispara el pipeline de SSR de Vue, TTFB (Time to First Byte) promedio 420ms. Sin contenido dinámico — listados de productos, artículos de blog son iguales para todos, sin segmentación de usuario.

Solución: middleware en Cloudflare Workers para HTML caching. En `functions/_middleware.ts`:

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

`caches.default`: API de edge cache de Cloudflare. `max-age=3600` para browser, `s-maxage=7200` para edge. El primer request hace SSR render (420ms TTFB), los siguientes se sirven desde el edge (28ms TTFB).

TTFB promedio 420ms → 54ms. Es crítico para LCP: HTML más rápido significa parser comienza antes, preload de fonts se dispara más temprano.

## Image Optimization: Cloudflare Images Transform

Imágenes de producto promedio 1.8MB, formato JPEG. El elemento LCP es la primera imagen del hero slider — descargar 1.8MB tomaba 3.2 segundos. Las servíamos desde nuestro origin.

Pasamos a Cloudflare Images: transformación automática a WebP, sizing responsivo, cache en edge. En `nuxt.config.ts`, integramos `@nuxt/image`:

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

En el component:

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

`fetchpriority="high"`: señala al navegador que es imagen prioritaria. `loading="eager"`: sin lazy load, fetch inmediato. Sensato para hero. 1.8MB JPEG → 420KB WebP, la contribución de LCP 3.2s se reduce a 0.8s.

Este cambio fue paralelo a las discusiones de performance budget en el proceso de [diseño UI/UX](https://www.roibase.com.tr/es/ui-ux) — redujimos el tamaño de archivo %76 sin sacrificar calidad visual.

## Runtime Telemetry: validación con datos de usuario real

Lab data (Lighthouse, WebPageTest) muestra 1.9s LCP. ¿Qué pasa en RUM (Real User Monitoring)? Con Cloudflare Web Analytics + Google Analytics 4 custom events hacemos seguimiento:

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
  
  // Mismo patrón para INP, CLS
})
```

Datos de 14 días: P75 LCP 2.1s (en lab 1.9s), P75 INP 220ms (en lab 180ms). Diferencia lab-RUM %10 — aceptable. En usuarios móviles 4G, LCP 2.4s; en WiFi, 1.8s. Cuando el perfil de red es variable, el edge caching se vuelve aún más crítico.

## Tradeoff: build time y developer experience

Self-hosted fonts agregan +8s a `npm install`. El módulo `@nuxt/image` hace que el dev server tarde 3.2s en lugar de 4.1s en el first start. Debuggear lazy hydration es más difícil — necesitas console logs en hydration boundaries para rastrear timing.

Cache invalidation en Cloudflare Workers: cuando hay actualizaciones de producto, hay que limpiar el edge cache llamando a la API de Cloudflare. Se agregó al CI/CD:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

+12s al deployment. El tradeoff: ¿vale la ganancia de runtime performance el roce de desarrollo? En nuestro caso sí — %39 reducción de bounce rate justifica +12s en deploy.

## Números después de optimizar

| Métrica | Antes | Después | Ganancia |
|---------|-------|---------|----------|
| LCP (P75) | 10.2s | 1.9s | %81 |
| TBT | 3.1s | 190ms | %94 |
| CLS | 0.18 | 0.04 | %78 |
| TTFB | 420ms | 54ms | %87 |
| Bounce Rate | %18 | %11 | %39 |

Conversion rate subió de %2.1 a %2.8 (+%33). Los números sugieren correlación — sin A/B test, cambios de precio o campañas paralelas, la atribución a las mejoras de performance es razonable.

Web performance no es solo "un sitio rápido" — está directamente ligado a bounce rate, conversion, ingresos. Un LCP de 10 segundos pierde usuarios; 2 segundos aumenta oportunidades de conversión. Self-hosted fonts, lazy hydration, edge caching — estos tres son pasos obligatorios en modern frontend stacks. La combinación Cloudflare Pages + Nuxt 3 facilita estas optimizaciones, pero la config por defecto no es suficiente. Se requiere tuning manual.