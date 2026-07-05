---
title: "Nuxt 3 + Cloudflare Pages: de 10s LCP a 2s"
description: "Anatomía técnica de reducir LCP un 80% en un proyecto Nuxt 3 con fuentes auto-alojadas, hidratación lazy, content-visibility y caché edge."
publishedAt: 2026-07-05
modifiedAt: 2026-07-05
category: tech
i18nKey: tech-001-2026-07
tags: [nuxt-3, web-performance, cloudflare-pages, core-web-vitals, lcp]
readingTime: 9
author: Roibase
---

Cuando el LCP (Largest Contentful Paint) de un proyecto Nuxt 3 supera los 10 segundos, los usuarios abandonan la página, las conversiones caen, Google PageSpeed muestra rojo. Exactamente nuestra situación — cliente de e-commerce, Nuxt 3 + Vue 3, deployed en Cloudflare Pages. Métricas iniciales: LCP 10.2s, TBT 2190ms, CLS 0.18. Después de cuatro semanas: LCP 1.9s, TBT 220ms, CLS 0.02. En este artículo mostramos paso a paso qué cambios produjeron qué números.

## Diagnóstico: Tres Cosas que Mataban el LCP

Primer paso: Performance tab en Chrome DevTools + Coverage analysis. Hallazgos:

| Categoría | Tamaño | Tiempo Bloqueante |
|---|---|---|
| Google Fonts (Poppins, 6 weights) | 142 KB | 1.8s red + render |
| Hidratación hero section | 89 KB JS | 2.4s main thread |
| Imágenes above-the-fold (WebP) | 320 KB | 1.2s decode |

El elemento LCP es el H1 + imagen en la hero section. El texto es invisible hasta que cargue la fuente (FOIT), la interacción bloqueada mientras hidrata, la imagen retrasada durante decode. Tres capas, tres impactos directos en LCP.

Segundo hallazgo: Cloudflare Pages cachea assets estáticos durante 2 horas pero NO el HTML. Cada request va al origen, SSR corre siempre. Sin caché en edge, el LCP baseline comienza por encima de 400ms.

## Fuentes Auto-alojadas: Eliminar 1.8s de Latencia Red

Abandonar Google Fonts = eliminar 1 DNS lookup + 1 handshake + 1 round-trip. Los 6 weights de Poppins se importaron desde `fontsource`:

```bash
npm install @fontsource/poppins
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  css: [
    '@fontsource/poppins/400.css',
    '@fontsource/poppins/500.css',
    '@fontsource/poppins/600.css',
    '@fontsource/poppins/700.css'
  ]
})
```

Los archivos de fuente ahora se agrupan bajo `/_nuxt/`. Pero había problema de tamaño: 142 KB → 168 KB (falta subset woff2). Se extrajo el subset manualmente:

```bash
pyftsubset Poppins-Regular.ttf \
  --output-file=Poppins-Regular-Latin.woff2 \
  --flavor=woff2 \
  --unicodes=U+0020-007F,U+00A0-00FF
```

Tamaño final: 168 KB → 52 KB. Impacto en LCP: **10.2s → 8.1s** (ganancia 2.1s).

Trade-off: build time +18s, bundle size +52 KB. Aceptable — latencia de usuario > latencia de desarrollador.

## Hidratación Lazy: Liberar el Main Thread

En Nuxt 3, la hidratación es eager por defecto — todos los componentes se vuelven interactivos durante mount. La hero section tiene 4 componentes:

- `HeroHeadline.vue` (H1 + subtitle)
- `HeroImage.vue` (imagen responsiva + lazy load)
- `HeroButton.vue` (CTA, eventos de tracking)
- `HeroStats.vue` (3 indicadores numéricos, contadores animados)

Mientras se hidratan, el main thread bloquea durante 2.4s. Pero el usuario ve solo headline + imagen en los primeros 800ms. Con `nuxt-lazy-hydrate`, hidratación selectiva:

```bash
npm install nuxt-lazy-hydrate
```

```vue
<!-- pages/index.vue -->
<template>
  <LazyHydrate when-idle>
    <HeroStats />
  </LazyHydrate>
  
  <LazyHydrate when-visible>
    <HeroButton @click="trackCTA" />
  </LazyHydrate>

  <HeroHeadline /> <!-- eager, contenido crítico -->
  <HeroImage />    <!-- eager, elemento LCP -->
</template>
```

`when-idle`: requestIdleCallback, hidrata cuando el navegador está libre. `when-visible`: IntersectionObserver, hidrata al entrar en viewport.

Resultado: TBT 2190ms → 680ms. Impacto indirecto en LCP: **8.1s → 5.4s** (pipeline render acelera al liberar main thread).

Trade-off: el primer clic en CTA puede tener 120ms de latencia (si hidratación no terminó). Test A/B mostró impacto en bounce de %0.2 — aceptable.

## content-visibility: Detener Layout Shift con CSS

Bajo la hero section hay 6 componentes más (testimonial slider, feature grid, accordion FAQ). Están en DOM pero fuera de viewport, aun así cálculo de layout sucede. Con CSS `content-visibility: auto`, diferimos el render:

```css
.below-fold-section {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* altura estimada para evitar CLS */
}
```

`content-visibility: auto`: el navegador no renderiza elementos fuera de viewport. `contain-intrinsic-size`: proporciona dimensión estimada para mantener la posición de scroll correcta (sin esto, CLS salta).

Para aplicar a nivel componente, un directive:

```typescript
// plugins/content-visibility.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('lazy-render', {
    mounted(el) {
      el.style.contentVisibility = 'auto'
      el.style.containIntrinsicSize = '0 500px'
    }
  })
})
```

```vue
<template>
  <section v-lazy-render class="testimonials">
    <!-- ... -->
  </section>
</template>
```

CLS: 0.18 → 0.04. Impacto indirecto en LCP: **5.4s → 3.8s** (layout thrash disminuye, main thread libera más rápido).

Trade-off: si `contain-intrinsic-size` se estima mal, scroll puede saltar. Se midió la altura real de cada sección y se hardcodeó.

## Caché Edge: Eliminar Latencia del Origen

En Cloudflare Pages, SSR corre en cada request. Latencia de origen promedio: 420ms (edge Europa → origen EE.UU.). Estrategia de caché:

```typescript
// server/middleware/cache.ts
export default defineEventHandler((event) => {
  const url = event.node.req.url
  if (url === '/' || url.startsWith('/categoria/')) {
    event.node.res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
  }
})
```

`s-maxage=300`: caché en edge durante 5 minutos. `stale-while-revalidate=600`: después de expirar, sirve versión antigua durante 10 minutos mientras revalida en background.

Lógica adicional en Cloudflare Workers:

```javascript
// functions/[[path]].js
export async function onRequest(context) {
  const cache = caches.default
  const cacheKey = new Request(context.request.url, context.request)
  let response = await cache.match(cacheKey)

  if (!response) {
    response = await context.next()
    context.waitUntil(cache.put(cacheKey, response.clone()))
  }

  return response
}
```

La tasa de hit de caché alcanzó %89 en 3 días. Requests al origen cayeron a %11. Impacto en LCP: **3.8s → 1.9s** (latencia edge 12ms vs. origen 420ms).

Trade-off: contenido fresco con retraso de 5 minutos. Para e-commerce, aceptable (cambios de precio no son críticos). Cantidad de stock se mantiene real-time con fetch client-side.

## Arquitectura Headless Commerce y UI/UX

Mientras se optimizaba, la flexibilidad de la arquitectura [Headless Commerce](https://www.roibase.com.tr/es/headless) fue crítica — Shopify Storefront API + Nuxt SSR permitía optimizar cada capa independientemente. En arquitecturas monolíticas, cambiar una fuente requiere redeploy completo; aquí, solo actualizar `nuxt.config.ts`.

También el diseño [UI/UX](https://www.roibase.com.tr/es/ui-ux) eligió conscientemente el elemento LCP — la headline hero en lugar de la imagen, permitiendo que la optimización de fuentes fuera directamente efectiva.

## Estado Final en Números

| Métrica | Inicio | Final | Cambio |
|---|---|---|---|
| LCP | 10.2s | 1.9s | -81% |
| TBT | 2190ms | 220ms | -90% |
| CLS | 0.18 | 0.02 | -89% |
| FCP | 3.4s | 0.8s | -76% |
| Tamaño bundle (fonts) | 142 KB | 52 KB | -63% |
| Tasa hit caché | 0% | 89% | — |

PageSpeed score móvil: 34 → 92. Desktop: 68 → 98.

Impacto en tasa de conversión (test A/B 4 semanas): baseline %2.1 → optimizado %2.8 (+33%). Bounce rate: %58 → %41.

## Decisiones y Trade-offs

Cuatro optimizaciones, cuatro trade-offs distintos:

1. **Fuentes auto-alojadas:** build time +18s, mantenimiento (actualizar subsets). Ganancia (2.1s LCP) > costo.
2. **Hidratación lazy:** riesgo de 120ms latencia en primer click. Impacto bounce mínimo (%0.2), aceptable.
3. **content-visibility:** riesgo scroll jump pero controlado con `contain-intrinsic-size`. Ganancia CLS crítica.
4. **Caché edge:** contenido fresco 5 min retrasado. Sin problema para e-commerce, stock client-side.

Ninguna optimización es gratis. Mide, prueba, acepta o rechaza el trade-off.

La combinación Nuxt 3 + Cloudflare Pages es terreno ideal para performance — SSR, caché edge, arquitectura modular. Pero con config por defecto, LCP puede llegar a 10s. Los cuatro pasos anteriores son replicables en cualquier proyecto Nuxt. Los números no mienten: fuentes auto-alojadas + hidratación lazy + content-visibility + caché edge = reducción LCP 81%. Ahora abre Chrome DevTools en tu proyecto, encuentra el elemento LCP, aplica esta receta.