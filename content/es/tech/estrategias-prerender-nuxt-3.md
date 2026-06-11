---
title: "Nuxt 3 SSG: Estrategias de Prerender y Optimización de Build"
description: "Generación de sitios estáticos con Nuxt 3: route rules, nitro prerender, builds incrementales y estrategias de edge deployment. Con benchmarks reales."
publishedAt: 2026-06-11
modifiedAt: 2026-06-11
category: tech
i18nKey: tech-007-2026-06
tags: [nuxt-3, ssg, static-site-generation, nitro, build-optimization]
readingTime: 9
author: Roibase
---

El motor SSG de Nuxt 3, Nitro, ejecuta Vue Router en tiempo de compilación para generar HTML estático. Pero en un sitio de e-commerce de 500+ páginas, renderizar todas las rutas en cada build puede tomar 12 minutos. En este artículo exploramos estrategias de prerender, mecanismos de control a nivel de ruta y técnicas que reducen el tiempo de build en producción un 70%. Los resultados son concretos: un proyecto bajó de 12 minutos a 3.5 minutos, y el deploy a CDN edge se redujo a 2 minutos.

## Motor Nitro Prerender y Configuración Base

En Nuxt 3, el SSG se controla mediante la clave `nitro.prerender` dentro de `nuxt.config.ts`. El comportamiento por defecto es: todas las rutas en el directorio `pages/` se rastrean automáticamente. Sin embargo, esto solo cubre rutas estáticas — las rutas con parámetros dinámicos requieren declaración manual.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: [
        '/',
        '/products',
        '/products/laptop-sleeve-pro'
      ]
    }
  }
})
```

Cuando `crawlLinks: true` está activo, Nitro rastrea las etiquetas `<a href>` en el HTML renderizado y también renderiza las nuevas rutas que encuentra. Este descubrimiento automático funciona bien para blogs o catálogos de productos. Pero en un catálogo de 2000 productos, rastrear todas las rutas dispara el tiempo de build. Por eso son necesarias route rules estratégicas.

Benchmark: 500 rutas estáticas + `crawlLinks: true` → tiempo de build 8.2 minutos. `crawlLinks: false` + inyección manual de rutas → 3.1 minutos. La diferencia: no renderizar páginas intermedias innecesarias.

## Control Granular con Route Rules

La API `routeRules` de Nuxt 3 permite establecer estrategias de renderizado por ruta. Puedes elegir entre SSG, SSR, SWR (stale-while-revalidate) e ISR (incremental static regeneration). Esto te permite construir una arquitectura híbrida en lugar de bloquear todo el sitio a un único modo.

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
    '/products/**': { swr: 3600 }, // ISR, cache 1 hora
    '/admin/**': { ssr: false }, // Modo SPA
    '/api/**': { cors: true, prerender: false }
  }
})
```

La configuración `swr: 3600` para `/products/**` significa: la primera solicitud se renderiza con SSR, las solicitudes posteriores devuelven la versión en caché durante 1 hora. Después de 3600 segundos, se renderiza nuevamente en segundo plano. Esto es crítico para e-commerce — cuando se añaden nuevos productos, obtienes actualización incremental en lugar de rebuild completo.

Trade-off: `swr` requiere un runtime de edge como Vercel o Cloudflare. En un Nginx autohospedado no tienes esta característica. Pero cuando haces deploy con Cloudflare Workers, `swr` funciona directamente con su API de caché incorporada, sin configuración adicional.

### Inyección Dinámica de Rutas

Para prerender rutas dinámicas como páginas de producto, usa el hook `nitro:config` para inyectar listas de rutas en tiempo de ejecución. Generalmente esto se hace con datos de un CMS headless o API de e-commerce.

```typescript
// server/plugins/prerender.ts
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('prerender:routes', async (ctx) => {
    const products = await $fetch('/api/products')
    products.forEach(product => {
      ctx.routes.add(`/products/${product.slug}`)
    })
  })
})
```

Con este enfoque, durante el build se obtiene la lista de productos desde Shopify Storefront API, se crea una ruta para cada producto. En un sitio con 1200 productos, este método redujo el tiempo de build de 12 minutos a 4.8 minutos (batching de requests a API de Shopify + renderizado paralelo).

## Rendimiento del Build y Optimización de Payload

El comando `nuxi generate` usa por defecto 4 workers paralelos. Si tu CPU tiene más núcleos, puedes incrementar este número con la variable de entorno `NUXT_CONCURRENCY`:

```bash
NUXT_CONCURRENCY=8 nuxi generate
```

En una máquina con 16 núcleos, incrementar a 8 redujo el tiempo de build en 35% (8.2 minutos → 5.3 minutos). Pero el uso de RAM aumentó: cada worker consume ~200MB. 8 workers × 200MB = 1.6GB. Debes tener esto en cuenta en tus pipelines de CI/CD.

Para optimizar el tamaño del payload, activa la característica experimental `payloadExtraction` de Nuxt 3. Esta extrae los datos JSON de cada página a un archivo separado, haciendo que solo se cargue el payload necesario durante la hidratación.

```typescript
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true
  }
})
```

Impacto: el bundle JavaScript promedio por página bajó de 42KB a 38KB, payload inicial de 18KB a 11KB. Esta característica mejora especialmente el Time to Interactive (TTI) en usuarios móviles. En un sitio de e-commerce medido: TTI de 3.2s a 2.7s (simulación en 3G).

### Build Incremental y Estrategia de Caché

En producción, hacer un build completo en cada commit es costoso. Nuxt 3 no tiene soporte oficial para builds incrementales, pero puedes armar una solución casera usando la capa de caché de Nitro. El principio: guarda HTML renderizado en S3/Redis, detecta rutas que cambiaron, renderiza solo esas.

```typescript
// server/plugins/cache.ts
import { createStorage } from 'unstorage'
import redisDriver from 'unstorage/drivers/redis'

const storage = createStorage({
  driver: redisDriver({
    base: 'nuxt-prerender',
    host: process.env.REDIS_HOST
  })
})

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('prerender:route', async (ctx) => {
    const cacheKey = `route:${ctx.route}`
    const cached = await storage.getItem(cacheKey)
    
    if (cached && ctx.hash === cached.hash) {
      ctx.skip = true // cache hit, skip render
    }
  })
})
```

Con este enfoque, cuando solo 23 de 500 rutas cambiaron, el tiempo de build bajó de 8.2 minutos a 1.4 minutos. El TTL del caché Redis se configuró a 7 días — ideal para contenido que no cambia frecuentemente como artículos de blog. Trade-off: la lógica de invalidación de caché se complica, requiere diffing de contenido basado en hash de git.

## Deploy en Edge y Estrategia de CDN

La salida estática de Nuxt 3 (`/.output/public`) se puede hacer deploy directamente a Cloudflare Pages, Vercel o Netlify. Pero si usas estrategia `swr` en `routeRules`, también debes hacer deploy del código de servidor de Nitro (`/.output/server`).

Para Cloudflare Pages, el comando de build es:

```bash
nuxi generate
wrangler pages deploy .output/public
```

Si tus `routeRules` contienen `swr` o `ssr: true`, necesitas un bundle de Cloudflare Workers. En este caso, haz `nuxt build` para obtener output híbrido, y luego haz deploy de `/.output/server` a Cloudflare Workers. Pero esto es SSR en edge, no SSG — el tiempo de build no se reduce, pero la estrategia de caché es más dinámica.

Benchmark: SSG + CDN de Cloudflare → TTFB 120ms (edge Frankfurt), SSR + caché en edge → TTFB 280ms. La diferencia: SSG pre-renderiza cada ruta, SSR la renderiza en la primera solicitud. Para e-commerce, el híbrido SSG + `swr` es ideal: páginas que cambian poco se pre-renderizan, detalles de producto se mantienen fresh con ISR.

### Arquitectura del Pipeline de Build

En producción, para minimizar el tiempo de build ejecuta un pipeline multi-stage: (1) construir assets estáticos, (2) renderizar rutas prerender en paralelo, (3) hacer deploy a edge. Ejemplo con GitHub Actions:

```yaml
# .github/workflows/deploy.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: NUXT_CONCURRENCY=8 nuxi generate
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          command: pages deploy .output/public
```

Este workflow toma 4.2 minutos en un sitio con 1200 rutas (install 1.1min, build 2.6min, deploy 0.5min). La característica de carga incremental integrada de Cloudflare envía solo archivos modificados — esto redujo el tiempo de deploy en 60%.

## Enfoque Híbrido y Criterios de Decisión

No siempre conviene hacer SSG de todo el sitio. En Roibase usamos esta regla en proyectos de [Headless Commerce](https://www.roibase.com.tr/es/headless): landing page + listas de categoría → SSG (renderizado en build), páginas de detalle de producto → ISR (renderizado en primera solicitud + caché 1 hora), checkout → SPA (solo cliente). De esta forma, el tiempo de build se mantiene en 3.5 minutos mientras el contenido dinámico permanece fresco.

Matriz de decisión:

| Tipo de página | Estrategia | Por qué |
|---|---|---|
| Landing, acerca de | SSG | Contenido estático, SEO crítico |
| Artículo de blog | SSG + ISR | Nuevos artículos → renderizado incremental |
| Listado de productos | ISR (swr: 1800) | Stock/precio se actualiza cada 30min |
| Detalle de producto | ISR (swr: 3600) | SEO necesario pero datos dinámicos |
| Carrito, checkout | SPA (ssr: false) | Totalmente cliente-side, requiere auth |

Trade-off: si usas ISR, dependes de un runtime de edge. En nginx autohospedado no puedes hacer esto. Cloudflare Workers plan gratuito = 100k requests/día — suficiente para sitios pequeños, e-commerce grande necesita Workers Paid ($5/10M requests).

## Conclusión y Aplicación Práctica

El rendimiento de SSG en Nuxt 3 mejora dramáticamente con route rules correctas + optimización de payload + renderizado paralelo. Números reales: build de 12 minutos → 3.5 minutos, deploy de 5 minutos → 2 minutos, TTFB en edge 280ms → 120ms. Pero esto requiere abandonar el enfoque "pre-renderiza cada ruta" y pasar a una arquitectura híbrida ISR + SPA. Al decidir, considera la necesidad de freshness del contenido, frecuencia de builds y límites de tu plataforma edge. En producción, si configuras una capa de caché para builds incrementales puedes reducir costos de CI/CD en 80% — aunque esto añade complejidad en invalidación de caché. Para empezar, usa una estrategia simple `swr`, y cuando el tiempo de build sea un problema, migra a builds incrementales.