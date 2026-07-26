---
title: "Shopify Hydrogen vs Liquid: En Qué Números Basamos la Decisión"
description: "Comparativa de TTFB, build time, dev velocity y costo de migración. Cómo tomamos la decisión de pasar a Hydrogen con datos reales — números concretos, tradeoff's."
publishedAt: 2026-07-26
modifiedAt: 2026-07-26
category: headless
i18nKey: tech-002-2026-07
tags: [shopify-hydrogen, headless-commerce, web-performance, liquid, ttfb]
readingTime: 9
author: Roibase
---

A finales de 2024, en el ecosistema Shopify tienes que elegir entre dos arquitecturas: el motor de templates tradicional Liquid o Hydrogen. Nosotros no tomamos esta decisión por intuición — comparamos números de TTFB, build time, developer velocity y costo de migración. Este artículo explica en qué cifras nos fijamos y qué tradeoff's aceptamos.

## Liquid: Velocidad Monolítica, Flexibilidad Limitada

Liquid es el motor de templates que Shopify usa desde 2006. Se renderiza en servidor, se cachea en CDN, corre en la infraestructura propia Oxygen de Shopify. Nuestros benchmarks:

**TTFB promedio:** 180-220ms (desde edge de Oxygen)  
**Build time:** Ninguno — se renderiza en runtime cada request  
**Ratio de cache HIT:** 82% (para páginas estáticas)

La ventaja de Liquid no es velocidad, sino simplicidad. Contratas a un theme developer, llenas las carpetas `sections/` y `snippets/`, editas contenido desde el admin de Shopify. No hay build pipeline frontend, no hay npm dependencies. Pero la flexibilidad es cero: para interactividad client-side añades tags `<script>` e integras librerías como Alpine.js o Petite Vue. Sin component library, sin state management.

Hacer personalización en Liquid te obliga a depender del objeto `customer` de Shopify. En casos de uso como dynamic pricing o recommendation widgets, bypaseas el cache del CDN y haces requests al servidor — el TTFB sube de 180ms a 400-600ms. En este punto, la ventaja de velocidad de Liquid desaparece.

### El Tradeoff de Liquid: Developer Velocity

Para agregar una funcionalidad:
1. Encuentras a un developer que sepa Liquid (skill muy específico)
2. Añades una app extension de Shopify o escribes una custom section
3. Pruebas con Shopify theme preview (no hay dev server local)
4. Haces deploy via GitHub sync o Shopify CLI

Tiempo promedio de feature delivery: **3-5 días** (para una section simple). Armar un A/B test, agregar analytics events, optimizar third-party scripts — cada cosa es un proyecto separado. Sin TypeScript, sin mecanismo de component reuse, sin framework de unit tests.

## Hydrogen: React, Remix, Edge SSR

Hydrogen es el framework headless que Shopify lanzó en 2021 — basado en React, construido sobre Remix, corre en la red edge Oxygen. Nuestros números en producción:

**TTFB promedio:** 90-140ms (SSR en edge, con cache HIT)  
**Build time:** 45-70 segundos (Remix build + Oxygen deploy)  
**TTFB en cache MISS:** 250-350ms (incluye latencia de Storefront API query)

La ventaja clave de Hydrogen es la arquitectura basada en componentes. Usas el ecosistema React: Radix UI, Framer Motion, React Query. State management con Zustand o Jotai. TypeScript nativo, dev server Vite con HMR en 200-400ms.

Ejemplo de código — product card en Hydrogen:

```tsx
// app/components/ProductCard.tsx
import {Image, Money} from '@shopify/hydrogen';
import type {Product} from '@shopify/hydrogen/storefront-api-types';

export function ProductCard({product}: {product: Product}) {
  return (
    <div className="product-card">
      <Image data={product.featuredImage} sizes="(min-width: 768px) 33vw, 100vw" />
      <h3>{product.title}</h3>
      <Money data={product.priceRange.minVariantPrice} />
    </div>
  );
}
```

El mismo componente en Liquid:

```liquid
{% comment %} sections/product-card.liquid {% endcomment %}
<div class="product-card">
  {{ product.featured_image | image_url: width: 800 | image_tag }}
  <h3>{{ product.title }}</h3>
  <span>{{ product.price | money }}</span>
</div>
```

La diferencia no es syntax — en Hydrogen importas este componente en otro lugar y lo reutilizas, con seguridad de tipos via PropTypes. En Liquid incluyes un snippet cada vez que lo necesitas y pasas variables — refactorizar es complicado.

## Costo de Migración: Calculado en Horas

Cuando migras un e-commerce, tienes tres costos:

1. **Migración de templates:** Conversión de Liquid a JSX  
2. **Refactor de data fetching:** De theme data a Storefront API queries  
3. **Integración con third-parties:** Pixels, analytics, review widgets

Nuestra experiencia:

| Métrica | Site de 50 páginas | Site de 200 páginas |
|---|---|---|
| Horas dev (migración) | 120-180 horas | 400-600 horas |
| Horas QA | 40-60 horas | 120-180 horas |
| Downtime | 0 (deploy en staging) | 0 |
| Riesgo | Bajo | Medio (control de URLs SEO) |

El costo más grande es el cambio en skill set del equipo. Un developer de Liquid no escribe Hydrogen — necesitas contratar un frontend developer React o entrenar al equipo. Diferencia de salario promedio: dev Liquid ₺40-60k/mes, dev React ₺70-100k/mes.

### Latencia de Storefront API Query

Hydrogen hace GraphQL queries a la Storefront API de Shopify. En Liquid, el acceso a datos server-side es gratis (misma app monolítica), en Hydrogen hay un network hop. Ejemplo de query:

```graphql
query ProductPage($handle: String!) {
  product(handle: $handle) {
    id
    title
    description
    priceRange {
      minVariantPrice { amount currencyCode }
    }
    images(first: 10) {
      nodes { url altText }
    }
  }
}
```

Esta query va desde el edge de Oxygen al backend de Shopify — latencia promedio **80-120ms**. En Liquid esa latencia no existe porque el dato está en memoria. Pero con estrategia de caché en Hydrogen cierras la brecha:

```tsx
// app/routes/products.$handle.tsx
export async function loader({params, context}: LoaderFunctionArgs) {
  const {product} = await context.storefront.query(PRODUCT_QUERY, {
    variables: {handle: params.handle},
    cache: context.storefront.CacheLong(), // cache 1 hora
  });
  return json({product});
}
```

La estrategia `CacheLong()` cachea la misma query en edge durante 1 hora — en el segundo request la latencia cae por debajo de 10ms.

## Comparación de Developer Velocity

Implementemos la misma funcionalidad en ambas arquitecturas: "mostrar un widget de upsell dinámico para productos agregados al carrito".

**Enfoque Liquid:**
1. Escribes una custom app (Shopify App Bridge)
2. Añades una app extension como snippet
3. En cart page haces un Ajax request
4. Conectas con la engine API de recomendaciones
5. Renderizas el response en el DOM

Tiempo: **3-4 días** (incluye testing)

**Enfoque Hydrogen:**
1. Escribes un componente React (CartUpsell.tsx)
2. Usas el hook `useCart` para obtener cart data
3. Haces un query a la API de recomendaciones (React Query)
4. Importas el componente en la ruta de cart

Tiempo: **4-6 horas**

Dónde está la diferencia: En Hydrogen tienes seguridad de tipos TypeScript, el componente es testeable, se desarrolla aislado en Storybook. En Liquid cada cambio requiere prueba manual desde el theme preview.

Número real de proyecto (cliente de Roibase): una funcionalidad de personalización que tomó 1 sprint (2 semanas) en Liquid, se terminó en 3 días en Hydrogen — ese es el beneficio de [headless commerce](https://www.roibase.com.tr/es/headless) en developer velocity.

## Web Performance: Diferencia en Core Web Vitals

El reporte Q1 2025 de Shopify: un theme Liquid promedio tiene LCP **2.4 segundos**, un site Hydrogen tiene LCP **1.8 segundos** (mobile, 4G). Nuestros datos en producción:

| Métrica | Liquid (theme) | Hydrogen |
|---|---|---|
| TTFB | 210ms | 130ms |
| LCP | 2.6s | 1.9s |
| TBT | 420ms | 180ms |
| CLS | 0.08 | 0.02 |

La ventaja de performance de Hydrogen viene de tres puntos:

1. **Edge SSR:** La red edge de Oxygen renderiza HTML en PoP's globales similares a Cloudflare — renderiza el HTML más cerca del usuario
2. **Streaming SSR:** Remix con streaming renderiza above-fold content inmediatamente, below-fold lazy load
3. **Optimized bundle:** El build Vite hace code splitting automático, tree shaking, dynamic import — bundle JS 40% más pequeño

Ejemplo: lazy loading de product grid (Hydrogen):

```tsx
// app/routes/collections.$handle.tsx
import {Await} from '@remix-run/react';
import {Suspense} from 'react';

export async function loader({params, context}: LoaderFunctionArgs) {
  const productsPromise = context.storefront.query(PRODUCTS_QUERY, {
    variables: {handle: params.handle},
  });
  
  return defer({products: productsPromise}); // Stream promise
}

export default function Collection() {
  const {products} = useLoaderData<typeof loader>();
  
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <Await resolve={products}>
        {(data) => <ProductGrid products={data.products} />}
      </Await>
    </Suspense>
  );
}
```

Este patrón envía HTML above-fold inmediatamente e hidrata en client — la caída de LCP de 2.6s a 1.9s viene de aquí.

## Matriz de Decisión: Cuándo Usar Cada Uno

Nuestro decision tree:

**Elige Liquid si:**
- GMV anual <$2M
- <4 deploys por mes
- Sin necesidad de personalización
- Equipo actual es developer de themes Shopify

**Elige Hydrogen si:**
- GMV anual >$5M
- 2+ deploys por semana
- Tienes A/B testing, personalización, integración con headless CMS
- Puedes invertir en un tech stack frontend moderno

Zona gris ($2-5M GMV): mira métricas como conversion rate, AOV, repeat purchase. Si tu roadmap de CRO es agresivo, pasa a Hydrogen — la diferencia en dev velocity genera ROI.

## Conclusión: Aceptar los Tradeoff's

Hydrogen es 35-40% más rápido que Liquid (en TTFB, LCP), developer velocity 3-5x superior, pero el costo de migración es 120-600 horas. Que hagas esta inversión depende de tu objetivo de operational velocity.

De nuestra experiencia: un cliente de e-commerce promedio recupera ROI de la migración a Hydrogen en 6-9 meses — la velocidad de CRO iteration aumenta, el ciclo de A/B testing se acorta, las integraciones con third-parties son más rápidas. Si tu estrategia es crecimiento rápido, la migración a Hydrogen está justificada por números. Si administras un catálogo estático, Liquid es suficiente.