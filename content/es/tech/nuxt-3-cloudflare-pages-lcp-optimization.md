---
title: "Nuxt 3 + Cloudflare Pages: De 10s a 2s en LCP"
description: "Font auto-hospedado, lazy hydration, content-visibility y edge caching: 80% de reducción de LCP en proyecto real. Ejemplos de código y análisis de tradeoffs."
publishedAt: 2026-08-11
modifiedAt: 2026-08-11
category: tech
i18nKey: tech-001-2026-08
tags: [nuxt3, web-performance, cloudflare-pages, core-web-vitals, edge-caching]
readingTime: 9
author: Roibase
---

En 2024, Core Web Vitals migró a INP, pero LCP sigue siendo la métrica más visible de la experiencia del usuario. Cuando deployamos un stack Nuxt 3 + Cloudflare Pages en producción para un proyecto de e-commerce, LCP llegó a 10.2 segundos —en móvil con throttle de 3G. Tras 6 semanas de optimización, el mismo escenario bajó a 2.1 segundos. Este artículo disecciona las 4 técnicas críticas aplicadas: estrategia de fonts auto-hospedados, patrón de lazy hydration, CSS content-visibility y arquitectura de edge caching.

## Fonts Auto-Hospedados: 1.8s de Request Externo → 120ms Local

Servir Google Fonts desde CDN parece intuitivo, pero conlleva 3 costos de round-trip: DNS, TLS handshake y descarga del archivo. En nuestro caso, producía 1.8 segundos de latencia promedio. Migramos el font a un asset estático.

**Pasos:**

```bash
# 1. Descarga el font y colócalo en /public/fonts
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

**Tradeoff:** El tamaño del bundle inicial aumentó 400KB, pero eliminamos 1 dependencia externa de la ruta crítica. Cloudflare CDN sirve esto desde 300+ PoP, con TTFB mediano de 80ms. Con `font-display: swap`, aceptamos FOUT (Flash of Unstyled Text) —un layout shift de 0.3% es el costo.

**Benchmark:** Contribución de LCP -1.6s (10.2s → 8.6s).

## Lazy Hydration: 3.2s TBT → 420ms

El comportamiento por defecto de Nuxt en SSR hidrata todo el árbol de componentes en el cliente. Componentes pesados como un grid de productos, si no están interactivos en el viewport inicial, gastan hydration innecesariamente.

**Patrón:** Viewport tracking + dynamic import.

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

**Resultado:** El grid de productos requería 28KB de JS y 680ms de hydration. Al hacer lazy los 3 componentes de grid no presentes above-the-fold, el TBT (Total Blocking Time) bajó de 3.2s a 420ms. La puntuación de rendimiento en Lighthouse pasó de 42 a 78.

**Tradeoff:** Cuando el usuario hace scroll y llega al skeleton, hay 150-200ms de latencia de carga. El riesgo de CLS es real —la altura del skeleton debe coincidir exactamente con el contenido real.

### H3: Patrón de Importación Lazy de Componentes en Nuxt

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

// Uso:
const ProductGrid = useLazyComponent('ProductGrid')
```

## CSS content-visibility: Reducción de Costo de Render -60%

Desde Chrome 85, `content-visibility: auto` señala al navegador "no renderices este elemento fuera del viewport". Pospone operaciones de layout, paint y composite.

**Aplicación:**

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 400px; /* altura estimada */
}
```

**Trace de Lighthouse:**
- Antes: Construcción del render tree 1240ms (312 nodos)
- Después: 520ms (88 nodos para viewport inicial)

**Detalle importante:** `contain-intrinsic-size` es obligatorio para cálculos correctos de scrollbar. Valores incorrectos disparan CLS. En nuestro caso, la altura real de cada card estaba entre 380-420px, así que usamos 400px como promedio.

**Cuidado:** Safari no soporta esto hasta versión 17.4 —piénsalo como mejora progresiva. No necesitas fallback, solo pierdes el ganancia de rendimiento.

## Edge Caching: Carga de Origin -85%

Cloudflare Pages cachea assets estáticos por defecto, pero envía routes dinámicas al origin. La API `routeRules` de Nuxt permite definir reglas de caché a nivel de página.

**nuxt.config.ts:**

```ts
export default defineNuxtConfig({
  routeRules: {
    '/': { 
      isr: 3600, // 1 hora de stale-while-revalidate
      headers: { 'cache-control': 's-maxage=3600' }
    },
    '/products/**': { 
      isr: 1800,
      headers: { 'cache-control': 's-maxage=1800, stale-while-revalidate=86400' }
    },
    '/api/**': { cache: false } // Routes API sin cache
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

**Lógica de ISR (Incremental Static Regeneration):**
1. Primera request → SSR desde origin, response se cachea
2. Requests dentro de 3600s → Servidas desde edge (TTFB ~40ms)
3. Request después de 3600s → Devuelve respuesta stale PERO regenera en background
4. Requests siguientes → Respuesta fresca

**Analytics de Cloudflare:**
- Tasa de requests al origin: 92% → 7% (promedio de 3 semanas)
- TTFB mediano: 680ms → 52ms
- TTFB percentil 99: 2.1s → 180ms

**Tradeoff:** Las actualizaciones de stock de productos se muestran con hasta 1 hora de retraso. En páginas críticas (checkout) usamos `cache: false`. En arquitecturas [Headless Commerce](https://www.roibase.com.tr/es/headless), este tipo de estrategia de edge caching proporciona ganancia de rendimiento independiente del backend.

## Análisis de Bundle: Caza de Dependencias Innecesarias

Durante la optimización, inspeccionamos la composición del bundle con `nuxt analyze`. 2 grandes victorias:

**1. Lodash reemplazado con ES6 nativo:**

```js
// Antes: 72KB gzipped
import { debounce, throttle } from 'lodash'

// Después: 0KB (utilidad nativa)
const debounce = (fn, ms) => {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
```

**2. Day.js reemplazado con Intl API:**

```js
// Antes: day.js 11KB
import dayjs from 'dayjs'
dayjs(date).format('DD MMM YYYY')

// Después: nativa 0KB
new Intl.DateTimeFormat('es-ES', { 
  day: '2-digit', 
  month: 'short', 
  year: 'numeric' 
}).format(new Date(date))
```

**Reducción total de bundle:** 83KB gzipped → mejora de FCP (First Contentful Paint) de 240ms.

## Tabla Comparativa: Antes/Después

| Métrica | Antes | Después | Cambio |
|---------|-------|---------|--------|
| LCP (3G) | 10.2s | 2.1s | -79% |
| TBT | 3.2s | 420ms | -87% |
| CLS | 0.18 | 0.04 | -78% |
| FCP | 2.8s | 1.4s | -50% |
| JS Bundle | 312KB | 229KB | -27% |
| TTFB (edge hit) | 680ms | 52ms | -92% |

**Entorno de prueba:** Chrome 120, Lighthouse 11, throttle 3G (1.6Mbps down, 750Kbps up, 300ms RTT). Promedio de 10 runs.

## Conclusión: No es Ingeniería de Rendimiento, es Ingeniería de Experiencia

Estas 4 técnicas no son suficientes por sí solas —requieren medición e iteración continua. En producción, monitoreamos el LCP del percentil 95 con RUM (Real User Monitoring). Cuando agregamos features nuevos, ejecutamos regresion tests de tamaño de bundle. Revisamos semanalmente la tasa de caching en Cloudflare Analytics. La ganancia en web performance no es un trabajo de una sola vez y olvido; es disciplina integrada en el ciclo de desarrollo de producto.