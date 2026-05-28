---
title: "Nuxt 3 + Cloudflare Pages: LCP de 10s a 2s"
description: "Fuentes auto-alojadas, hidratación lazy, content-visibility y caché edge reducen LCP un 80%. Códigos reales y benchmarks."
publishedAt: 2026-05-28
modifiedAt: 2026-05-28
category: tech
i18nKey: tech-001-2026-05
tags: [nuxt3, web-performance, cloudflare-pages, core-web-vitals, edge-computing]
readingTime: 8
author: Roibase
---

Cloudflare Pages + Nuxt 3 prometen caché edge y deployment sin configuración, pero los Core Web Vitals requieren más. En un proyecto e-commerce en producción, LCP alcanzaba 10.2 segundos y TBT 2190 milisegundos. Google Fonts, hidratación client-side, CSS global y JavaScript síncrono bloqueaban el renderizado. Con fuentes auto-alojadas, hidratación lazy, la propiedad CSS `content-visibility` y una estrategia de caché edge, redujimos LCP a 2.1 segundos y TBT a 180 milisegundos. Aquí compartimos la implementación paso a paso y los compromisos involucrados.

## Google Fonts Bloqueando Render: 3.8s Perdidos

Las fuentes servidas desde CDN de Google Fonts mediante `@import` o `<link>` bloquean el renderizado. El riesgo de FOIT (Flash of Invisible Text) y las latencias de 3+ round-trips impactan directamente el LCP. En Chrome DevTools Lighthouse, la recomendación "Eliminate render-blocking resources" mostraba 3.8 segundos de pérdida.

Solución: auto-alojar las fuentes. Usamos el paquete npm `@fontsource/inter` para copiar archivos Woff2 al directorio `public/fonts`. En la configuración de Nuxt, agregamos `preload`:

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

En CSS, definimos `@font-face` solo para los pesos utilizados:

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

Con `font-display: swap`, aceptamos el compromiso de FOUT (Flash of Unstyled Text) — se muestra la fuente del sistema mientras la personalizada carga, y se intercambian una vez disponibles. LCP bajó a 6.4 segundos. El aumento en tamaño (72 KB en Woff2 comprimido) valió la pena por los 3.8 segundos ganados.

## Hidratación Client-Side: TBT 2190ms

Nuxt 3, por defecto, hidrata todos los componentes client-side. Dentro de `app.vue` había 40+ componentes, estado global (Pinia), composables y librerías terceras (Swiper, vue-gtag) bloqueando el hilo principal. En Performance de Chrome DevTools, "Long Tasks" sumaban 8, la más larga duraba 1240 milisegundos.

### Hidratación Lazy con Priorización

Componentes fuera del viewport inicial fueron hidratados de manera lazy. Después de agregar `@nuxtjs/web-vitals` y medir INP y TBT, identificamos la ruta crítica:

```vue
<!-- pages/index.vue -->
<template>
  <div>
    <!-- Above-the-fold: hidratación inmediata -->
    <HeroSection />
    <ProductGrid :products="products" />

    <!-- Below-the-fold: hidratación lazy -->
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

Con `<client-only>`, eliminamos librerías dependientes del DOM (como Swiper) del SSR. `requestIdleCallback` retrasa la hidratación hasta que el hilo principal está inactivo. TBT se redujo a 840 milisegundos en este paso.

### Code Splitting y Bundle Splitting

Analizamos el bundle con `vite-plugin-inspect`. Swiper ocupaba 168 KB minificados, pero solo se usaba en un carrusel de reseñas. En lugar de dividir dinámicamente, optimizamos el uso — eliminamos módulos innecesarios (Virtual, Autoplay), dejando solo Navigation:

```typescript
// composables/useSwiper.ts
import { Navigation } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'

export const useSwiperModules = () => [Navigation]
```

El bundle bajó de 168 KB a 42 KB. Como `<LazyReviewCarousel>` ya era lazy, el tamaño del bundle inicial no se vio afectado.

## Content-Visibility: Reducción del Período de Renderizado

El grid de productos mostraba 48 tarjetas (imagen + título + precio + botón). El navegador calculaba el layout de todas simultáneamente, alargando el LCP. Con CSS `content-visibility: auto`, eliminamos del renderizado inicial las tarjetas fuera del viewport:

```css
/* components/ProductCard.vue */
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 320px 420px;
}
```

`contain-intrinsic-size` le dice al navegador el tamaño del placeholder, evitando saltos de layout. LCP bajó de 6.4 a 3.9 segundos. El compromiso: las tarjetas fuera del viewport se renderizan al desplazarse, pero el impacto en INP es de 12 milisegundos (aceptable).

## Caché Edge: TTFB 1.2s → 40ms

Cloudflare Pages no cachea HTML por defecto — cada solicitud va al origen. SSR de Nuxt 3 tarda ~1200 milisegundos (llamadas a API + renderizado). Activamos caché edge con un archivo `_headers`:

```
# public/_headers
/*
  Cache-Control: public, max-age=0, s-maxage=600, stale-while-revalidate=86400
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
```

Con `s-maxage=600`, Cloudflare cachea en su edge durante 10 minutos. `stale-while-revalidate=86400` sirve la versión antigua mientras se regenera en background. TTFB bajó a 40 milisegundos (en edge hits). Las solicitudes al origen solo ocurren en cache misses o revalidación stale.

### ISR con Renderizado Híbrido

Para páginas de productos, usamos Incremental Static Regeneration. En Nuxt, se configura con `routeRules`:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/products/**': { 
      swr: 600,  // 10 minutos
      prerender: false
    },
    '/': { 
      swr: 300   // 5 minutos
    }
  }
})
```

La primera solicitud usa SSR, las siguientes se cachean. Para actualizaciones de inventario, usamos un webhook de purga manual:

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

## Comparación de Benchmarks

| Métrica | Antes | Después | Cambio |
|---------|-------|---------|--------|
| LCP | 10.2s | 2.1s | -79% |
| TBT | 2190ms | 180ms | -92% |
| TTFB | 1200ms | 40ms | -97% |
| FCP | 4.8s | 1.2s | -75% |
| CLS | 0.18 | 0.02 | -89% |
| Bundle (inicial) | 284 KB | 186 KB | -34% |

Entorno: Chrome 121, throttling 4G, Lighthouse CI. Promedio de 10 ejecuciones. LCP está por debajo del umbral de "Good" de Google (2.5s) — objetivo alcanzado.

## Compromisos y Consideraciones

Las fuentes auto-alojadas pierden la red global de CDN de Google, pero Cloudflare Pages las sirve desde el edge. La compresión Woff2 minimiza latencia adicional. La hidratación lazy reduce la interactividad inicial — componentes below-the-fold se activan después del hook `mounted`. Las métricas analíticas deben incluir "time to interactive below fold".

`content-visibility` no es soportado en Safari anterior a 17.4 — usar guardias `@supports`. El caché edge genera conflictos con personalización (carrito, login) — proteger con `Cache-Control: private` o renderizar client-side.

La purga de caché con webhook es manual — debe integrarse con sistemas de gestión de inventario. Contenido stale es riesgoso en checkout o pagos — ISR desactivado en esas rutas.

## Escalabilidad con Arquitectura Composable

Estas optimizaciones fueron probadas en [Headless Commerce](https://www.roibase.com.tr/es/headless) — frontend Nuxt 3, backend Storefront API de Shopify. El patrón funciona en Next.js + Hydrogen o Remix. La estrategia de caché edge es agnóstica del framework, extensible con Cloudflare Workers KV o Vercel Edge Config. Monitoreo con `@nuxtjs/web-vitals` debe complementarse con RUM — Cloudflare Web Analytics o Sentry Performance.

LCP de 2.1s es "Good" en desktop, pero requiere testing en 4G mobile. Progressive enhancement — JavaScript fallido — requiere HTML SSR funcional. Contenido crítico debe renderizarse sin JavaScript, usando el componente `<NoScript>` de Nuxt.