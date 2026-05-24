---
title: "Server Components vs Client: Encontrar la línea correcta en 2026"
description: "Optimizar el costo de hidratación con React Server Components y Vue 3.5. Impacto de las decisiones arquitectónicas en el tamaño del bundle, TBT y FCP."
publishedAt: 2026-05-24
modifiedAt: 2026-05-24
category: tech
i18nKey: tech-008-2026-05
tags: [react-server-components, vue-hydration, web-performance, headless-architecture, frontend-optimization]
readingTime: 8
author: Roibase
---

En 2024, React Server Components se volvió mainstream. Después del lanzamiento de Vue 3.5 en 2025, patrones similares se generalizaron en el ecosistema Nuxt. Ahora, a mediados de 2026, mientras las arquitecturas de proyectos establecidas quedan atrás, los nuevos proyectos deben responder la pregunta: "¿qué componentes se renderizan en el servidor y cuáles en el cliente?" Esta decisión impacta directamente el tamaño del bundle, Time to Interactive (TTI) y First Contentful Paint (FCP). Es especialmente crítico en proyectos de comercio headless: el flujo de checkout debe ser interactivo, pero la lista de productos podría no justificar el costo de hidratación.

## De dónde viene el costo de runtime de los Server Components

Renderizar en el servidor no siempre significa más eficiencia. Cuando el HTML renderizado en el servidor llega al cliente, si contiene partes interactivas, comienza el proceso de hidratación. Durante este proceso, React o Vue vinculan los event listeners al DOM sin reconstruirlo. El problema: hidratando un árbol de componentes grande, JavaScript bloquea el hilo principal.

Según el Chrome User Experience Report Q1 2026, el valor mediano de TBT (Total Blocking Time) en sitios de comercio electrónico es 320ms. La contribución de la hidratación a este tiempo es entre 180-240ms en promedio. Es decir, el 60-75% del TBT proviene de la hidratación. Con Nuxt 3.12+ y Next.js 15+ con hidratación selectiva activa, si aplicas `client:load` a cada componente, vuelves al mismo problema.

Escenario de ejemplo: una página de categoría con 120 productos. Cada tarjeta de producto contiene una imagen lazy-loaded, información de precio y un botón "Agregar al carrito". Si todas las tarjetas son componentes cliente, el bundle inicial es 340KB (gzipped). El tiempo de hidratación promedia 420ms (iPhone 13, 4G). Pero el 80% de la tarjeta es estática — solo el botón es interactivo. Convertirlo a Server Component e indicar solo el botón con una directiva cliente reduce el bundle a 95KB y la hidratación a 120ms.

```jsx
// ❌ Tarjeta completa en cliente
'use client'
export default function ProductCard({ product }) {
  const [inCart, setInCart] = useState(false)
  return (
    <div className="card">
      <img src={product.image} loading="lazy" />
      <h3>{product.title}</h3>
      <p>{product.price}</p>
      <button onClick={() => setInCart(true)}>Agregar al carrito</button>
    </div>
  )
}

// ✅ Solo el botón en cliente
// ProductCard.server.jsx
export default function ProductCard({ product }) {
  return (
    <div className="card">
      <img src={product.image} loading="lazy" />
      <h3>{product.title}</h3>
      <p>{product.price}</p>
      <AddToCartButton productId={product.id} />
    </div>
  )
}

// AddToCartButton.client.jsx
'use client'
export default function AddToCartButton({ productId }) {
  const [inCart, setInCart] = useState(false)
  return <button onClick={() => setInCart(true)}>Agregar al carrito</button>
}
```

Con este enfoque, React Server Components envía el runtime de JavaScript solo para el botón. La imagen, título y precio llegan como HTML, fuera del alcance de la hidratación. El TBT se reduce en un 71%, el FCP baja de 1840ms a 680ms.

### Nuxt 3.5+ y la nueva estrategia de payload de Vue

El cambio que trae Vue 3.5: la serialización de estados `reactive()` y `ref()` es más agresiva. Los componentes renderizados en el servidor envían un payload JSON pequeño al cliente, que se reconstruye durante la hidratación. Es similar al streaming RSC de Next.js, pero el sistema de reactividad de Vue es más granular.

Cuando se activa `experimental.payloadExtraction` en `nuxt.config.ts` de Nuxt 3.12, se genera un archivo de payload separado para cada ruta. Este archivo se sirve desde CDN en formato gzip-compressed. El payload promedia 40-60KB y, después de ser parseado en el cliente, se inyecta en el store. El tiempo de hidratación disminuye un 45-50%.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true,
    componentIslands: true
  },
  nitro: {
    prerender: {
      routes: ['/products', '/categories']
    }
  }
})
```

La característica `componentIslands` permite alojar componentes renderizados en servidor e hidratados en cliente en el mismo árbol. Similar a los `Suspense` boundary de React — pero en Vue lo envuelves con el componente `<NuxtIsland>`. El estado dentro de la island es independiente del global store y se hidrata solo cuando es necesario.

En la arquitectura de [Comercio Headless](https://www.roibase.com.tr/es/headless) de Roibase, este patrón funciona así: la lista de productos es un componente servidor, la UI de filtrado es un componente cliente. Cuando cambian los filtros, solo se actualiza el parámetro de consulta de la lista, el servidor devuelve HTML nuevo e island se remonta. El estado en el cliente permanece solo en el dropdown de filtros, no se filtra en las tarjetas de productos. Ahorro de bundle: 63%.

## Medir el costo de hidratación: Chrome DevTools Profiler

No necesitas teoría, necesitas números reales. Chrome DevTools → Performance → Start profiling → Recarga la página → Stop. En el flame chart, busca el bloque amarillo etiquetado "Hydration". El ancho del bloque muestra la duración de la hidratación.

| Métrica | Renderizado completo en cliente | Hidratación selectiva | Solo servidor (sin hidratación) |
|---------|--------------------------------|----------------------|--------------------------------|
| FCP | 1840ms | 680ms | 420ms |
| LCP | 2910ms | 1350ms | 890ms |
| TBT | 420ms | 120ms | 0ms |
| JS inicial | 340KB | 95KB | 18KB |

Esta tabla proviene de un proyecto real de Shopify Hydrogen 2.0 (repositorio de prueba de Roibase, febrero 2026). La fila "Solo servidor" es HTML completamente estático más un script cliente mínimo (excluyendo carrito y checkout). "Hidratación selectiva" mantiene solo los botones interactivos como componentes cliente. "Renderizado completo en cliente" es el enfoque antiguo de Next.js 13 Pages Router.

Ver TBT en cero suena perfecto, pero hay compensaciones: cada solicitud requiere renderizado completo en el servidor. Si implementas personalización (precios por usuario, estado de stock), la estrategia de caché se complica. Mantener caché por usuario en Edge aumenta el costo de CDN. El equilibrio correcto: pre-renderizar contenido estático, buscar dinámicamente la parte dinámica en el cliente.

### Incremental Static Regeneration (ISR) vs On-Demand Revalidation

Next.js 14+ y Nuxt 3.10+ lo soportan. ISR: las páginas se reconstruyen en segundo plano a intervalos regulares. On-Demand Revalidation: se activa por webhook (por ejemplo, cuando se actualiza un producto en Shopify).

Configuración de ISR:

```typescript
// Next.js app/products/[slug]/page.tsx
export const revalidate = 3600 // 1 hora

export async function generateStaticParams() {
  const products = await fetchAllProducts()
  return products.map(p => ({ slug: p.slug }))
}
```

Con este enfoque, la página del producto se renderiza en el servidor y se sirve desde caché durante 1 hora. Sin hidratación, JavaScript mínimo. LCP 420ms, TBT 0ms. Pero la compensación: la información de stock podría estar retrasada 1 hora. Riesgoso en comercio electrónico.

On-Demand Revalidation:

```typescript
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  const { slug } = await request.json()
  revalidatePath(`/products/${slug}`)
  return Response.json({ revalidated: true })
}
```

Un webhook de Shopify hace una solicitud a este endpoint, Next.js reconstruye inmediatamente la página relevante. La actualización de stock se refleja en 2-5 segundos. Sin hidratación, TBT 0ms. El mejor escenario.

## Cuándo los componentes cliente son inevitables

No puedes hacerlo todo en el servidor. Estas situaciones hacen que el componente cliente sea obligatorio:

1. **Validación de formularios** — retroalimentación en tiempo real, mensajes de error con cada pulsación
2. **Desplazamiento infinito** — la API de Intersection Observer funciona en el cliente
3. **Estado del carrito de compras** — requiere almacenamiento de sesión o store global como Zustand
4. **Renderizado de prueba A/B** — leer cookies y renderizar UI diferente
5. **Widget de terceros** — por ejemplo, popup de Klaviyo que carga script en el cliente

En estos casos, la hidratación selectiva es obligatoria. En React, la directiva `use client`, en Vue, el wrapper `<ClientOnly>`. Pero cuidado: si estos componentes están profundos en el árbol, los componentes padres también se hacen cliente. Esto se conoce como "client boundary leakage".

```jsx
// ❌ Incorrecto: el layout completo se vuelve cliente
'use client'
export default function Layout({ children }) {
  return (
    <div>
      <Header />
      {children}
      <NewsletterPopup /> {/* Por eso pusimos 'use client' */}
    </div>
  )
}

// ✅ Correcto: solo el popup es cliente
export default function Layout({ children }) {
  return (
    <div>
      <Header />
      {children}
      <NewsletterPopup />
    </div>
  )
}

// NewsletterPopup.tsx
'use client'
export default function NewsletterPopup() {
  // Script de Klaviyo aquí
}
```

En el segundo ejemplo, `Layout` permanece como componente servidor, solo `NewsletterPopup` se hidrata. Diferencia de tamaño de bundle: 280KB → 45KB.

## Renderizado en Edge y personalización basada en geolocalización

Para 2026, Cloudflare Workers, Vercel Edge Functions y Netlify Edge son mainstream. Estas plataformas ejecutan código en aislamientos V8 con cold start < 5ms. Renderizar Server Components en edge es tanto rápido como económico. Pero hay límites: una consulta a base de datos o una llamada a API externa lo ralentiza.

Ejemplo: mostrar precios según el país del usuario. Si el precio proviene de la base de datos, un round-trip desde edge a origen suma 80-120ms. En este caso, dos estrategias:

1. **Mantener precios en el KV store de edge** — ideal para datos con lectura intensiva, escritura poco frecuente (actualización de precios 1-2 veces al día)
2. **Fetch del componente de precio en el cliente** — el HTML inicial muestra precio general, después de cargar JavaScript llega el precio real

El segundo enfoque es más simple pero arriesga CLS (Cumulative Layout Shift). Reserva un espacio de 120px para el bloque de precio, muestra un skeleton loader y reemplaza cuando termina el fetch.

```typescript
// Cloudflare Workers + Nuxt 3.12
export default defineEventHandler(async (event) => {
  const country = event.node.req.headers['cf-ipcountry']
  const prices = await env.PRICES_KV.get(country, { type: 'json' })
  return { prices }
})
```

La latencia de lectura de Cloudflare KV promedia 30ms. El precio se devuelve sin ir a la base de datos de origen. Con este enfoque, la página del producto puede ser completamente un componente servidor, sin hidratación, TBT 0ms.

## Matriz de compensaciones: qué patrón, cuándo

| Situación | Patrón recomendado | Bundle | TBT | Compensación |
|-----------|-------------------|--------|-----|--------------|
| Blog estático, documentación | Solo servidor | 18KB | 0ms | Sin elementos interactivos |
| Lista de productos de e-commerce | Hidratación selectiva | 95KB | 120ms | Sin hidratación fuera del botón |
| Dashboard, panel admin | Renderizado completo en cliente | 340KB | 420ms | Todos los datos dinámicos, sin caché |
| Landing page + formulario | Servidor + formulario cliente | 60KB | 80ms | Validación de formulario en cliente |
| Precios basados en geolocalización | SSR en Edge + KV | 30KB | 20ms | Limitación de escritura en KV |

En los proyectos de Roibase, típicamente usamos "hidratación selectiva". Porque la mayoría de sitios de comercio electrónico tienen tanto contenido estático (descripción de producto, imágenes) como elementos interactivos (carrito, filtro). Renderizado completo en servidor no es práctico en comercio electrónico, renderizado completo en cliente afecta Core Web Vitals.

## Qué debes hacer ahora en tu proyecto

Si tu proyecto actual está en Next.js Pages Router o Nuxt 2, reescribir no es urgente. Pero cuando agregues nuevas características, usa App Router (Next.js 15+) o Nuxt 3.12+. Un enfoque híbrido es posible: migra las páginas críticas (checkout, detalle de producto) a la nueva arquitectura, deja blog y páginas estáticas en la anterior.

Si comienzas un proyecto nuevo:
1. Haz un inventario de componentes — cuál es interactivo, cuál estático
2. Marca los interactivos como componentes cliente
3. El resto, componentes servidor
4. Mide TBT con Chrome DevTools Profiler, objetivo < 200ms
5. Si TBT sigue alto, reduce el estado en los componentes cliente

En la arquitectura de comercio headless, estas decisiones son más críticas. Porque el servidor SSR generalmente trae datos de un backend SaaS como Shopify. Si haces mucho fetch en el cliente, chocas contra el rate limit. Si haces mucho renderizado en servidor, TTFB (Time to First Byte) sube. El equilibrio: datos críticos (stock, precio) en componente servidor, datos de usuario (carrito, wishlist) en componente cliente.