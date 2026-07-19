---
title: "Nuxt 3 SSG: Estrategias de Prerender y Optimización de Build"
description: "Guía técnica profunda sobre las capacidades de generación estática en Nuxt 3. Route rules, prerender de Nitro, regeneración estática incremental."
publishedAt: 2026-07-19
modifiedAt: 2026-07-19
category: tech
i18nKey: tech-007-2026-07
tags: [nuxt3, ssg, static-generation, prerender, web-performance]
readingTime: 9
author: Roibase
---

El motor de generación de sitios estáticos (SSG) de Nuxt 3 basado en Nitro representa la primera solución de grado productivo en el ecosistema Vue que combina ISR (Incremental Static Regeneration) y control de prerender a nivel de ruta. En 2026, la narrativa dominante sostiene que SSG está obsoleto gracias a la proliferación de plataformas edge — pero en realidad, las estrategias híbridas de rendering (SSG + ISR bajo demanda) se han consolidado como el enfoque más rentable para optimizar Core Web Vitals. La API `routeRules` de Nuxt 3 permite orquestar este comportamiento híbrido desde un único archivo de configuración.

## Estrategia de Rendering a Nivel de Ruta

En Nuxt 3, el modo de renderizado ya no se define a nivel de aplicación, sino por ruta individual. Dentro de `nuxt.config.ts` puedes especificar una estrategia diferente para cada ruta:

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
    '/blog/**': { swr: 3600 },
    '/api/**': { cors: true, headers: { 'cache-control': 's-maxage=0' } },
    '/admin/**': { ssr: false },
    '/product/**': { isr: 60 }
  }
})
```

Esta configuración proporciona ventajas significativas: las páginas estáticas (landing, archivos de blog) se generan en tiempo de build, mientras que el contenido dinámico (páginas de productos) se prerenderiza bajo demanda. Para la ruta `/blog/**`, la directiva `swr: 3600` garantiza que la página se sirva desde el CDN durante 1 hora usando la estrategia stale-while-revalidate — el usuario ve la versión cacheada mientras que en segundo plano ocurre la revalidación.

### Decisión entre ISR y SWR

ISR (Incremental Static Regeneration) y SWR (Stale-While-Revalidate) frecuentemente se confunden. ISR prerenderiza páginas bajo demanda después del build y las mantiene en caché durante un período específico antes de revalidar. SWR, por su parte, es una directiva de caché HTTP — sirve la versión antigua mientras regenera en segundo plano.

**Elige ISR:** Para catálogos de productos, contenido de CMS y páginas que se actualizan con poca frecuencia pero reciben alto tráfico. `isr: 60` = revalidación cada 60 segundos.

**Elige SWR:** Para posts de blog, documentación y contenido donde la inmediatez de actualización no es crítica. `swr: 3600` = caché CDN de 1 hora + revalidación en segundo plano.

En proyectos de Roibase, ISR redujo el tiempo de build en un 73% (de 12 min a 3.2 min). En un sitio de e-commerce con 15,000 páginas de productos, prerenderizamos los primeros 500 productos en tiempo de build y generamos el resto bajo demanda con ISR.

## Crawler de Prerender de Nitro

El motor de prerender de Nuxt 3 basado en Nitro rastrea automáticamente enlaces internos para generar páginas relacionadas en tiempo de build. Sin embargo, controlar el comportamiento de este crawler es crítico para el rendimiento:

```typescript
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true,
      ignore: ['/admin', '/api'],
      routes: ['/sitemap.xml', '/rss.xml']
    }
  }
})
```

La directiva `crawlLinks: true` presenta un riesgo: visita cada etiqueta `<a>` en la página, lo que puede causar que se prerenderizen rutas no deseadas. Por ejemplo, los enlaces de redes sociales en el pie de página, aunque sean externos, podrían ser procesados por el crawler.

### Whitelist de Rutas de Prerender

Para prerenderizar solo rutas específicas en producción, usa el array `routes`:

```typescript
nitro: {
  prerender: {
    crawlLinks: false,
    routes: async () => {
      const { data: posts } = await $fetch('/api/posts')
      return posts.map(p => `/blog/${p.slug}`)
    }
  }
}
```

Este patrón proporciona control basado en fetch para el prerender. Extraes la lista de rutas desde tu CMS y construyes el build solo con esas páginas. En un proyecto de e-commerce headless con 8,000 páginas, este enfoque redujo el tiempo de build de 18 min a 4.5 min.

## Separación de Bundles y Eliminación de Código

Incluso cuando se usa SSG en Nuxt 3, el bundle de JavaScript contiene todos los componentes. La separación de código a nivel de ruta optimiza esta carga:

```typescript
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true
  },
  router: {
    options: {
      hashMode: false,
      scrollBehaviorType: 'smooth'
    }
  }
})
```

La opción `payloadExtraction: true` extrae el payload de datos de las páginas prerenderizadas en archivos JSON separados. Esto significa que en transiciones de página, solo se carga el diff, reduciendo el bundle inicial en aproximadamente un 40%.

### Tree Shaking y Limpieza de Código No Utilizado

Nuxt 3 usa importación automática, pero esto puede resultar en componentes no utilizados incluidos en el bundle. Desactiva el escaneo automático con `components: { dirs: [] }` e importa manualmente solo los componentes que necesitas:

```typescript
export default defineNuxtConfig({
  components: false,
  imports: {
    dirs: ['composables']
  }
})
```

Este enfoque radical redujo el tamaño del bundle en un 28% (de 340KB a 245KB comprimido). El tradeoff: la experiencia del desarrollador disminuye, ya que cada componente requiere importación manual. Alternativa híbrida: importa automáticamente componentes en `/components/global`, pero maneja manualmente los demás.

## Estrategias de Hidratación

El mayor costo de SSG es la hidratación — crear la instancia de Vue en el lado del cliente añade entre 200 y 400ms de TBT (Total Blocking Time). La directiva `ssr: false` de Nuxt 3 la desactiva completamente, pero a costa de perder SEO.

```vue
<template>
  <div>
    <ClientOnly>
      <HeavyInteractiveWidget />
    </ClientOnly>
    <StaticContent />
  </div>
</template>
```

El componente `<ClientOnly>` renderiza solo el contenido envuelto en el lado del cliente. En el HTML generado por SSG, esta sección permanece como placeholder, y Vue la salta durante la hidratación. Con este patrón, en una landing page que incluía un dashboard de analytics, redujimos TBT de 420ms a 180ms.

### Hidratación Selectiva

Con `nuxt-island` en Nuxt 3.8+, obtienes hidratación parcial:

```vue
<template>
  <NuxtIsland name="ProductCard" :props="{ id: 123 }" />
</template>
```

`NuxtIsland` se renderiza en el servidor y se envía como HTML al cliente — la hidratación ocurre únicamente para este componente. El resto de la página permanece estática. En un sitio de e-commerce, movimos las tarjetas de producto a islands y redujimos el costo de hidratación en un 64% (TBT de 380ms a 135ms).

## Optimización del Rendimiento de Build

Cuando los builds de SSG superan los 15,000+ páginas y tardan 20 minutos, el pipeline de CI/CD se queda en estado obsoleto. Existen tres formas de mejorar el rendimiento de build de Nuxt 3:

**1. Prerender Paralelo:**
```typescript
nitro: {
  prerender: {
    concurrency: 20,
    interval: 0
  }
}
```
`concurrency: 20` renderiza 20 rutas simultáneamente. Sin embargo, existe riesgo de memory leak — funciona sin problemas con 32GB de RAM, pero en 8GB podrías experimentar errores OOM (Out of Memory). Prueba en tu servidor de CI/CD de producción.

**2. Build Incremental (Experimental):**
```typescript
experimental: {
  buildCache: true
}
```
Lee rutas sin cambios desde caché. Sin embargo, hasta Nuxt 3.12, esta funcionalidad está en beta — la invalidación de caché puede funcionar incorrectamente.

**3. Chunking de Rutas:**
Divide las rutas en lotes y construye en paralelo con jobs:

```bash
# Pipeline de CI/CD
nuxt build --prerender-routes="/,/about"
nuxt build --prerender-routes="/blog/**" --append
nuxt build --prerender-routes="/product/**" --append
```

Con este enfoque, dividimos un build de 18 min en 3 jobs paralelos, reduciendo el tiempo total a 6.5 min.

## Consideraciones para Edge Deployment

Al desplegar SSG en Cloudflare Pages, Vercel Edge o Netlify, ten en cuenta:

**Cloudflare Pages:** Requiere `nitro.preset: 'cloudflare-pages'`. No hay soporte nativo para ISR, solo SWR funciona. El caché-control se configura manualmente mediante archivos `_headers`.

**Vercel:** Soporta ISR nativamente, pero `vercel.json` puede sobrescribir route-rules — riesgo de conflicto de configuración. Usa la configuración de Nuxt como fuente única de verdad.

**Netlify:** Los archivos `_redirects` y `_headers` se generan automáticamente, pero SWR requiere configuración manual en `netlify.toml`.

En los proyectos de [Headless Commerce](https://www.roibase.com.tr/es/headless) de Roibase, desplegamos storefronts construidos con Nuxt 3 SSG en Cloudflare Pages. La combinación de caché edge + ISR logra TTFB (Time to First Byte) por debajo de 40ms y LCP (Largest Contentful Paint) alrededor de 1.2s.

---

Usar Nuxt 3 SSG estratégicamente significa elegir el modo de renderizado correcto para cada ruta. Combinando prerender en tiempo de build, ISR bajo demanda y SWR, puedes tanto optimizar Core Web Vitals como reducir costos de build. Revisa tus estrategias de hidratación — minimizar la carga de JavaScript del lado del cliente representa aproximadamente el 60% de la ganancia de rendimiento total.