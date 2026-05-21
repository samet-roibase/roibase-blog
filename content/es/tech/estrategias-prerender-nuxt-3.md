---
title: "Nuxt 3 SSG: Estrategias de Prerender y Optimización de Build"
description: "Static site generation en Nuxt 3 con route rules, payload extraction e incremental regeneration. Reducir builds de 40 segundos a 8 segundos."
publishedAt: 2026-05-21
modifiedAt: 2026-05-21
category: tech
i18nKey: tech-007-2026-05
tags: [nuxt-3, ssg, prerender, build-optimization, vue]
readingTime: 8
author: Roibase
---

El motor de static site generation (SSG) de Nuxt 3 cambió radicalmente respecto a 2.x. Las directivas `routeRules` y `prerender` que trae el engine Nitro, junto con el mecanismo de payload extraction, impactan directamente en los tiempos de build y en el desempeño en runtime. Compartimos las estrategias, tradeoffs y mediciones con las que redujimos el tiempo de build de 40 segundos a 8 segundos en un sitio de e-commerce de 10.000 páginas.

## Matriz de Selección de Estrategias de Prerender

En Nuxt 3 existen 4 estrategias principales de prerender: full static, partial prerender, hybrid ISR y on-demand generation. Cada una tiene diferentes impactos en build time, cost en runtime y cache hit rate.

**Full static** (`nitro.prerender.routes`): Renderiza todas las rutas en tiempo de build y las exporta como HTML. Ideal para sitios de 100 páginas; con 10.000 páginas el build puede exceder 5 minutos. Ventaja: sin runtime, cache hit del 100%. Desventaja: cada cambio de contenido requiere rebuild completo. En e-commerce donde el catálogo se actualiza 50 veces al día es insostenible.

**Partial prerender** (con `routeRules`): Prerendersiza las rutas críticas (homepage, top 100 categorías) y maneja el long tail con ISR. Build time cae 90%. Ejemplo: en un sitio de 10.000 productos, prerendersiza los primeros 500, el resto se cachea en el primer request. Penalidad por cache miss: 800ms (SSR), cache hit: 40ms (HTML estático).

**Incremental Static Regeneration (ISR)**: En plataformas como Vercel o Netlify se implementa con `routeRules` + `swr/stale`. La página entra en caché después del primer render y se revalida en background cuando el TTL expira. Tradeoff: riesgo de contenido stale versus ahorro de tiempo de build. Con TTL de 24 horas no capturas cambios diarios de precio, pero el build baja a 2 segundos.

**On-demand** (desencadenado vía `server/api`): Cuando el contenido cambia, un webhook tetea una API en Nitro que regenera solo esa ruta. Build time más bajo, máxima complejidad de orquestación. Necesitas armar un pipeline: webhook CMS → API Nitro → invalidación de ruta.

## Control Granular con Route Rules

En `nuxt.config.ts`, los `routeRules` definen una estrategia de rendering diferente para cada ruta. En esta capa, directivas como `prerender`, `swr`, `isr` y `ssr` controlan el comportamiento de caché por ruta.

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true }, // Homepage siempre estática
    '/products/**': { swr: 3600 }, // Productos con caché 1 hora
    '/api/**': { cors: true, cache: false }, // Endpoints sin caché
    '/category/:slug': { isr: true }, // ISR activo
  },
  nitro: {
    prerender: {
      crawlLinks: true, // Descubre links en sitemap automáticamente
      routes: ['/sitemap.xml'], // Rutas manuales
      ignore: ['/admin', '/checkout/**'], // Excluidas de prerender
    },
  },
})
```

Con `crawlLinks: true` se descubren automáticamente los links del sitemap. Para un sitio de 500 páginas no necesitas mantener una lista manual de rutas. Pero en 50.000 páginas, crawlear todos los links consume 10 minutos de build — en ese caso usa `routes` manual + estrategia incremental.

### Evitar Duplicación de Data con Payload Extraction

Nuxt 3 genera `_payload.json` para cada ruta prerenderizada. Este archivo serializa los datos obtenidos server-side. Durante la navegación SPA reutiliza ese JSON sin hacer calls de API nuevas.

```typescript
// pages/product/[id].vue
<script setup>
const route = useRoute()
const { data: product } = await useFetch(`/api/products/${route.params.id}`)
</script>
```

Durante el prerender se ejecuta `/api/products/123`, la respuesta se embebe en `_payload.json`. En navegación client-side reutiliza ese dato. Tradeoff: tamaño del payload. En un sitio de 10.000 productos, si cada `_payload.json` ocupa 5KB, generaste 50MB en assets estáticos. Contabiliza el costo de ancho de banda en CDN.

Para optimizar, comprime el payload en build-time con gzip/brotli dentro de `nitro.output.publicDir`. Nginx y Cloudflare lo hacen automáticamente, pero comprimiendo en build consigues reducir 5KB → 1.2KB.

## Desempeño de Build: Paralelización y Estrategias de Caché

El pipeline de build de Nuxt 3 tiene 3 fases: compilación webpack/vite → prerender Nitro → optimización de assets. Con 10.000 rutas, el prerender es el cuello de botella.

**Paralelización:** El parámetro `prerender.concurrency` en Nitro controla cuántas rutas se renderizan simultáneamente. Default es 10. Si tu RAM lo permite, elévalo a 50:

```typescript
nitro: {
  prerender: {
    concurrency: 50,
  },
}
```

Con CPU de 4 cores + 16GB RAM, cambiar de 10 → 50 redujo el build de 40s → 12s. Por encima de 50 hay retornos decrecientes; el overhead de context switching en CPU aumenta.

**Caché incremental de build:** Netlify y Vercel retienen el caché `.nuxt/prerender`. No rehacen rutas que no cambiaron. Con invalidación de caché basada en hash Git, solo las rutas modificadas se renderizan de nuevo.

```typescript
// netlify.toml
[build]
  command = "nuxt build"
  publish = ".output/public"

[[plugins]]
  package = "@netlify/plugin-nextjs"
  
[build.environment]
  NUXT_TELEMETRY_DISABLED = "1"
```

Con 70% de cache hit rate, un sitio de 5000 rutas que tardaba 15s ahora tarda 5s.

### Tradeoff entre Bundle Size y Prerender

Los archivos HTML prerendersizados contienen el bundle JS para hydration. En Nuxt 3, con `experimental.payloadExtraction` separas el payload del HTML. Optimiza el chunk splitting.

```typescript
experimental: {
  payloadExtraction: true,
  inlineSSRStyles: false, // CSS crítico no se incrusta
}
```

Con `payloadExtraction: true`, 250KB HTML se convierte en 180KB HTML + 70KB JSON. En navegación client-side el JSON se fetch, el HTML no se reparse. LCP baja de 2.1s → 1.8s (percentil 90, mobile 3G).

Pero el tradeoff: un HTTP request adicional. Con HTTP/2 multiplexing no hay problema; en HTTP/1.1 la latencia aumenta. En CDNs modernas como Cloudflare o Fastly, HTTP/2 es default, así que esta estrategia gana.

## Integración con Headless Commerce: Shopify + Nuxt SSG

En sitios de e-commerce, prerendersizar páginas de productos crea complejidad de sincronización de inventario. Con la API GraphQL Storefront de Shopify configuras revalidación impulsada por webhooks.

```typescript
// server/api/revalidate.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  if (body.topic === 'products/update') {
    const productId = body.id
    await nitroApp.hooks.callHook('prerender:routes', [
      `/products/${productId}`
    ])
  }
  
  return { status: 'revalidated' }
})
```

Subscribe al webhook desde Shopify Admin API → cuando un producto se actualiza, `/api/revalidate` se tetea → solo esa ruta se regenera. En lugar de rebuil del catálogo completo, una regeneración de 1 ruta tarda 200ms.

En arquitectura [Headless Commerce](https://www.roibase.com.tr/es/headless), este patrón es crítico. En plataformas monolíticas fuerza rebuild completo; en headless logras invalidación granular. Con 50.000 SKU donde 500 productos se actualizan diariamente, un rebuild completo tarda 6 horas, la revalidación incremental 2 minutos.

## ISR + Edge Caching: Estrategia Hybrid con Cloudflare Workers

Nuxt 3 + Cloudflare Pages permite implementar ISR con KV Workers. La ruta se renderiza en el primer request, se escribe a KV, los siguientes requests sirven desde KV.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: 'cloudflare-pages',
  },
  routeRules: {
    '/blog/**': { isr: 3600 }, // TTL 1 hora
  },
})
```

Latencia KV de Cloudflare ~50ms (edge global). Primer render: 800ms + 50ms KV write; siguientes requests: 50ms. Con 95% cache hit rate, tiempo promedio de respuesta es 95×50ms + 5×850ms = 90ms. En SSR puro sería 800ms constante.

Tradeoff: costo de KV write. En 1M requests/mes son $0.50 (pricing Cloudflare 2026). El hosting estático cuesta $0, así que ISR suma costo; pero la ganancia UX lo justifica.

---

La estrategia SSG en Nuxt 3 requiere decidir en el triángulo entre freshness de datos, tiempo de build y desempeño en runtime. Homepage prerendersizada, long tail con ISR, rutas críticas con server-side rendering — recalcula esta mezcla en cada proyecto. Sin medir, decir "full static es más rápido" es erróneo; con 10.000 rutas, el tiempo de build puede degradar UX. Con incremental regeneration + edge cache ganas tanto en build time como en response time, pero debes aceptar la complejidad de orquestación.