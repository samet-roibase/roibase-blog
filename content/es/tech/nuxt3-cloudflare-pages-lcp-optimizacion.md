---
title: "Nuxt 3 + Cloudflare Pages: de 10s LCP a 2s"
description: "Fonts auto-hospedadas, lazy hydration, content-visibility y edge caching redujeron LCP 80%. Benchmark real, código y trade-offs incluidos."
publishedAt: 2026-05-07
modifiedAt: 2026-05-07
category: tech
i18nKey: tech-001-2026-05
tags: [nuxt3, cloudflare-pages, web-performance, lcp, edge-caching]
readingTime: 8
author: Roibase
---

Tras la actualización de Core Web Vitals de Google, LCP (Largest Contentful Paint) debe estar por debajo de 2.5 segundos, de lo contrario tanto el ranking orgánico como la tasa de conversión caen. Cuando migramos un sitio de e-commerce a la stack Nuxt 3 + Cloudflare Pages, el LCP inicial fue de 10.2 segundos post-deploy. Usando una combinación de estrategia de fuentes auto-hospedadas, selective hydration, CSS content-visibility y edge caching, lo redujimos a 2.1 segundos. A continuación detallamos qué cambio aportó qué ganancia, los trade-offs y el código.

## Diagnosticar el problema: anatomía del LCP de 10s

El reporte inicial de CrUX mostró LCP mediano de 10.2s y TBT (Total Blocking Time) de 2190ms. El análisis de profiling de Chrome DevTools Lighthouse reveló:

- **Carga de fuentes:** 3 familias de fuentes desde CDN de Google Fonts, render-blocking
- **Hydration de JavaScript:** bundle de 420kB, página completa siendo hidratada
- **Imagen above-the-fold:** JPEG de 1.2MB, sin lazy load
- **Caché de Cloudflare:** respuesta SSR no cacheada, cada request llega al origen

Medición inicial: PageSpeed Insights móvil 34/100, desktop 62/100. Estas métricas son posteriores a migración desde Shopify Liquid a Nuxt 3 — el cambio de framework por sí solo no genera ganancia de performance, requiere optimización arquitectónica.

## Estrategia de fuentes auto-hospedadas + preload

Descargamos los mismos archivos de fuente desde Google Fonts al directorio `public/fonts/` y movimos la definición `@font-face` a `app.vue`. La diferencia crítica: usamos `<link rel="preload">` para iniciar la solicitud de fuentes dentro de la respuesta HTML inicial, antes de que se analice el CSS.

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

**Ganancia:** LCP 10.2s → 7.8s (caída de 2.4s). Carga de fuentes dejó de ser render-blocking, FOIT (Flash of Invisible Text) redujo de 1200ms a 180ms. Trade-off: los archivos de fuente ahora están en nuestro propio CDN, requiere gestión manual de versiones (lo resolvimos con bucket de Cloudflare R2 + headers Cache-Control).

## Selective hydration + `content-visibility`

El comportamiento predeterminado de Nuxt 3 es hidratar todos los componentes. Pero componentes no presentes en above-the-fold (footer, sección de comentarios, productos relacionados) no necesitan hidratación antes de que el usuario haga scroll. Envolvimos estos componentes en `LazyHydrate` usando el módulo `@nuxt/lazy-hydration`.

```vue
<template>
  <LazyHydrate when-visible>
    <ProductRecommendations :product-id="productId" />
  </LazyHydrate>
</template>
```

En CSS, aplicamos `content-visibility: auto` para indicar al navegador "si este elemento no está en viewport, no hagas cálculos de renderizado":

```css
.product-recommendations {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* altura placeholder */
}
```

**Ganancia:** TBT 2190ms → 420ms, LCP 7.8s → 4.1s. Bundle de JS inicial cargado: 420kB → 180kB (comprimido con brotli). Trade-off: `when-visible` usa Intersection Observer, requiere polyfill en navegadores antiguos como IE11 (no fue problema en nuestro caso con browser moderno como target).

## Edge caching + enfoque ISR híbrido

Cloudflare Pages cachea archivos estáticos por defecto, pero los endpoints SSR (`/_nuxt/...` excluido) no se cachean. En `nuxt.config.ts` definimos `routeRules` para especificar qué paths se cachean y por cuánto tiempo:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/': { swr: 3600 }, // homepage 1h stale-while-revalidate
    '/producto/**': { swr: 1800 }, // product pages 30m
    '/categoria/**': { static: true } // category pages static en build
  }
})
```

La estrategia `swr` (stale-while-revalidate): el primer request renderiza SSR, los siguientes requests vienen del caché, y en background se re-renderiza. Usamos Cloudflare KV store con URL + segmento de usuario (logged-in/anónimo) como cache key.

**Ganancia:** TTFB (Time to First Byte) 840ms → 120ms, LCP 4.1s → 2.3s. Cache hit rate alcanzó 78% en la primera semana. Trade-off: la personalización depende de la cache key; datos específicos del usuario como cantidad de items en carrito no pueden cachearse, se obtienen con fetch client-side.

## Optimización de imagen above-the-fold

Convertimos la imagen hero de JPEG 1.2MB a WebP 180kB e incluimos breakpoints responsivos con elemento `<picture>`:

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
    alt="Nueva colección de temporada"
    fetchpriority="high"
    decoding="async"
  />
</picture>
```

Con atributo `fetchpriority="high"` indicamos al navegador "prioriza la carga de esta imagen". Cloudflare Image Resizing realiza conversión automática de formato en edge (serve JPEG a navegadores sin soporte WebP).

**Ganancia:** LCP 2.3s → 2.1s, tiempo de carga de imagen 1200ms → 320ms. CLS (Cumulative Layout Shift) 0.12 → 0.02 — reservamos espacio con propiedad CSS `aspect-ratio`.

## Resultados de benchmark + impacto en usuarios reales

PageSpeed Insights móvil 34 → 92, desktop 62 → 98. Promedio de CrUX a 28 días:

| Métrica | Antes | Después | Cambio |
|---------|-------|---------|--------|
| LCP | 10.2s | 2.1s | -79% |
| TBT | 2190ms | 420ms | -81% |
| CLS | 0.12 | 0.02 | -83% |
| TTFB | 840ms | 120ms | -86% |

Google Analytics en embudo de conversión: tasa de inicio checkout pasó de 3.2% a 4.8% (+50% en lift relativo). Bounce rate 68% → 52%. Search Console: tráfico orgánico aumentó 34% en 2 meses (otros cambios SEO controlados). Estas métricas alineadas con los estándares de Roibase en [Headless Commerce](https://www.roibase.com.tr/es/headless) — si la performance no se traduce en métrica de negocio, el cambio arquitectónico no cuenta como exitoso.

## Trade-offs y criterios de decisión

**Developer experience:** Agregar wrapper de lazy hydration incrementó la surface area del API de componentes; nuevos developers necesitaban aprender la diferencia entre `when-visible` vs `when-idle`. Lo resolvimos con documentación en Storybook + reglas ESLint.

**Bundle size vs costo en runtime:** Archivos de fuentes auto-hospedadas sumaron +60kB al bundle inicial, pero eliminaron el costo de DNS lookup + TLS handshake. Este trade-off es ganancia neta en 3G móvil, neutral en fibra.

**Cache invalidation:** La estrategia `swr` conlleva riesgo de datos stale. Datos críticos como disponibilidad de stock se mantienen actualizados con fetch client-side en tiempo real (polling cada 30s en lugar de WebSocket — costo más bajo en edge functions).

**Vendor lock-in de Cloudflare:** El caching basado en KV es específico de Cloudflare; portabilidad a otra plataforma requeriría re-implementación. Pero Vercel/Netlify tienen primitivas equivalentes, el esfuerzo de migración es aceptable.

## Próximos pasos

2.1s LCP es sólido, pero CrUX P75 (percentil 75) aún está en 3.2s. El roadmap es:

1. **Image CDN + negotiación automática de formato:** Integración con Imgix en lugar de Cloudflare Polish, soporte AVIF
2. **Estrategia de prefetch:** Intersection Observer prefetches datos de product cards aproximándose a viewport
3. **Service Worker + offline-first:** Workbox cachea assets críticos, fallback network-first
4. **Bundle splitting agresivo:** Code splitting de Nuxt 3 más agresivo, chunking basado en rutas

La optimización de performance es un juego sin fin — cada 100ms ganado genera +1-2% lift en conversión. La combinación Nuxt 3 + Cloudflare Pages ofrece equilibrio entre edge rendering y ergonomía de framework JS moderno. Al decidir la stack, definir el target LCP como requisito de negocio, luego evaluar opciones arquitectónicas dentro de esa restricción.