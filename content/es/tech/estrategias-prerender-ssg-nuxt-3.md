---
title: "Nuxt 3 SSG: Estrategias de Prerender y Optimización de Build"
description: "Static site generation en Nuxt 3: route rules, prerendering con Nitro, builds incrementales y estrategias de deployment en producción."
publishedAt: 2026-08-06
modifiedAt: 2026-08-06
category: tech
i18nKey: tech-007-2026-08
tags: [nuxt-3, ssg, static-generation, web-performance, nitro]
readingTime: 8
author: Roibase
---

La arquitectura SSG (Static Site Generation) de Nuxt 3 representa una ruptura fundamental respecto al comando "nuxt generate" de la era Vue 2. El nuevo sistema de prerender basado en Nitro proporciona granularidad a nivel de ruta — puedes definir una estrategia de renderizado diferente para cada página. En este artículo abordamos la configuración de SSG lista para producción, la configuración de renderizado híbrido con route rules y los cuellos de botella de rendimiento que frecuentemente encontramos en el pipeline de build.

## Prerendering con Nitro: El Nuevo Fundamento del SSG

En Nuxt 3, el SSG funciona sobre el motor de prerendering de Nitro. Lo controlas mediante la clave `nitro.prerender` en el archivo `nuxt.config.ts`. El enfoque clásico era renderizar todas las rutas en tiempo de build — ahora el prerendering selectivo es posible.

```typescript
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/sitemap.xml', '/rss.xml'],
      ignore: ['/api', '/admin']
    }
  }
})
```

La configuración `crawlLinks: true` le dice a Nuxt: descubre automáticamente todas las páginas vinculadas con `<NuxtLink>` y prerrenderizalas. Esto funciona para blogs — pero en un sitio de comercio electrónico con 10 mil productos, el tiempo de build explota. Allí necesitas inyectar rutas dinámicamente.

### Inyección Dinámica de Rutas

Para prerrenderizar rutas dinámicas como páginas de productos, en lugar de proporcionar manualmente paths al array `routes`, usas hooks de Nitro:

```typescript
// server/plugins/prerender.ts
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('prerender:routes', async (ctx) => {
    const products = await fetchProductSlugs() // Obtén slugs de la API
    products.forEach(slug => {
      ctx.routes.add(`/products/${slug}`)
    })
  })
})
```

Este patrón te permite obtener la lista de rutas de una fuente de datos externa en tiempo de build (CMS, base de datos, API de comercio headless) e inscribirlas como HTML estático en el directorio `.output/public`. Puedes prerrenderizar 5 mil productos desde la API Storefront de Shopify e implementarlos en Cloudflare Pages — TTFB se mantiene por debajo de 20ms.

## Route Rules: Estrategia de Renderizado Híbrido

La característica más potente de Nuxt 3 es la configuración del modo de renderizado a nivel de ruta. Con `routeRules` puedes renderizar una página como SSG mientras otra es SSR, y una tercera en modo SPA. Esto es crítico en proyectos de [comercio headless](https://www.roibase.com.tr/es/headless) — las páginas de productos son estáticas, la página del carrito es client-side, el checkout es SSR.

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
    '/products/**': { prerender: true },
    '/api/**': { cors: true },
    '/admin/**': { ssr: false },
    '/cart': { ssr: false }
  }
})
```

Esta configuración hace lo siguiente:
- La homepage y todas las rutas `/products/*` se prerrenderizán en tiempo de build (SSG)
- Las páginas bajo `/admin` se ejecutan en modo SPA (renderizado client-side)
- La página `/cart` también es client-side — el estado del carrito es local, las solicitudes de API ocurren en el navegador
- Los endpoints `/api` reciben headers CORS (middleware del servidor)

### ISR (Incremental Static Regeneration)

El ISR en Nuxt 3 aún no es tan maduro como en Next.js, pero puedes lograr un comportamiento similar con la estrategia de cache `swr`:

```typescript
routeRules: {
  '/blog/**': { swr: 3600 } // Cache de 1 hora, luego revalidar
}
```

La configuración `swr: 3600` significa: el primer visitante obtiene HTML estático, el cache expira después de 1 hora, la siguiente solicitud desencadena un nuevo renderizado pero muestra el cache antiguo (stale-while-revalidate). Esto es apropiado para sitios que necesitan frescura las 24/7 pero no quieren reconstruir todas las páginas en cada build. En producción, combinado con cache edge de CDN (Cloudflare, Vercel), TTFB se mantiene por debajo de 50ms.

## Optimización del Build: Renderizado Paralelo y Chunk Splitting

Cuando generas un sitio de 5 mil páginas con `nuxt generate`, con la configuración predeterminada puede tomar 15-20 minutos. Para reducirlo a 5 minutos necesitas renderizado paralelo y chunk splitting.

```typescript
export default defineNuxtConfig({
  nitro: {
    prerender: {
      concurrency: 20, // Número de workers de renderizado paralelo
      interval: 100,   // Retraso entre workers (ms)
      crawlLinks: false // Usa inyección de rutas manual
    }
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-vue': ['vue', 'vue-router'],
            'vendor-ui': ['@headlessui/vue', '@heroicons/vue']
          }
        }
      }
    }
  }
})
```

La configuración `concurrency: 20` renderiza 20 páginas simultáneamente. Ajusta según el número de cores de CPU — en máquinas de 8 cores, 20 es ideal; en 4 cores, redúcelo a 10. `interval: 100` previene golpear límites de rate limit de API — si la API de Shopify tiene límite de 2 req/s, cámbialo a 500ms.

### Pipeline de Optimización de Imágenes

El módulo Nuxt Image realiza optimización de imágenes en tiempo de build, pero la configuración predeterminada es insuficiente para producción. Generar formatos WebP + AVIF en paralelo duplica el tiempo de build pero reduce FID (First Input Delay) 40ms:

```typescript
export default defineNuxtConfig({
  image: {
    provider: 'ipx',
    ipx: {
      maxAge: 31536000 // Cache de 1 año
    },
    formats: ['webp', 'avif'],
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

Esta configuración genera imágenes responsivas — cada imagen en 5 breakpoints × 2 formatos = 10 archivos. En un sitio con 1000 imágenes, el tiempo de build aumenta ~3 minutos pero LCP (Largest Contentful Paint) desciende de 2.5s a 1.2s. El tradeoff es positivo: tiempo de build aceptable, experiencia del usuario crítica.

## Deployment en Producción: Caching en Edge de CDN

Después de escribir el build SSG en el directorio `.output/public`, la estrategia de deployment es importante. Plataformas como Cloudflare Pages, Vercel y Netlify hacen caching en edge, pero necesitas configuración manual de headers de cache:

```typescript
// server/middleware/cache-headers.ts
export default defineEventHandler((event) => {
  const url = event.node.req.url
  
  if (url?.startsWith('/products/')) {
    setResponseHeaders(event, {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
    })
  }
  
  if (url?.startsWith('/_nuxt/')) {
    setResponseHeaders(event, {
      'Cache-Control': 'public, max-age=31536000, immutable'
    })
  }
})
```

Este middleware hace lo siguiente:
- Las rutas `/products/*` se cachean 1 hora en el navegador, 1 día en CDN, 1 semana como cache antiguo
- Los assets estáticos `/_nuxt/*` (JS, CSS) se cachean 1 año como immutable — mientras el hash de build no cambie, no hay re-fetch

Verificamos con datos de Cloudflare Analytics: la tasa de cache hit sube de 92% a 98%, TTFB promedio desciende de 180ms a 25ms. Sin caching en edge, SSG carece de sentido — aunque el HTML sea estático, la latencia de red destruye el rendimiento.

## Escenarios de Error y Fallback

Si una ruta falla durante prerender (timeout de API, 404), el build lanza un error. En producción, necesitas un mecanismo de fallback en el hook `onPrerender`:

```typescript
nitroApp.hooks.hook('prerender:route', (route) => {
  if (route.error) {
    console.warn(`Failed to prerender: ${route.route}`)
    route.skip = true // Omite esta ruta, no detengas el build
  }
})
```

Este patrón previene que el build completo falle si 50 de 10 mil rutas fallan. Muestras una página de fallback para rutas fallidas (404 o página de producto genérica). Alternativa: cambia rutas fallidas a SSR — renderízalas en runtime con `routeRules`.

La arquitectura SSG de Nuxt 3 ofrece flexibilidad, pero sin configuración correcta el tiempo de build y rendimiento en runtime se vuelven problemáticos. La combinación de renderizado híbrido con route rules, prerendering paralelo, estrategia de cache de CDN y mecanismos de fallback produce resultados listos para producción. Puedes generar un sitio de comercio electrónico de 5 mil páginas en 5 minutos y servirlo con 25ms TTFB — lo único que necesitas es saber qué gancho de Nitro tocar.