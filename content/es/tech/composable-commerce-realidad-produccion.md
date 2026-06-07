---
title: "Composable Commerce: La Realidad de la Arquitectura MACH en Producción"
description: "BigCommerce, commercetools, Shopify Plus — ¿a qué costos reales llega la flexibilidad que promete MACH? Qué compromisos aceptarás en producción."
publishedAt: 2026-06-07
modifiedAt: 2026-06-07
category: tech
i18nKey: tech-005-2026-06
tags: [composable-commerce, arquitectura-mach, headless-commerce, shopify-plus, bigcommerce]
readingTime: 8
author: Roibase
---

El comercio composable se vende desde 2024 como la "nueva regla del mercado". Los principios MACH (Microservicios, API-first, Cloud-native, Headless) desplazarían las plataformas monolíticas centrales. Pero en producción, la realidad es distinta: el bundle de BigCommerce Catalyst suma 850kB, el costo mínimo de integración en commercetools es $120k, y las características composables de Shopify Plus llegan con la curva de migración de Hydrogen 2.0. Antes de decidir, necesitas hablar de los tradeoffs en números.

## La Factura Real de la Promesa MACH

El núcleo de la promesa de arquitectura composable es la flexibilidad: frontend, backend, payment, search — cada uno independiente. Cuando lo necesites, puedes cambiar componentes. Pero esa flexibilidad se convierte en tres rubros de costo.

**El primer costo: tiempo de integración inicial.** En plataformas API-only como commercetools, construyes desde cero toda la experiencia — desde el frontend hasta el checkout. MVP promedio: 16-20 semanas. En Shopify Plus, la misma experiencia se levanta en 4 semanas. El starter de Catalyst de BigCommerce es un término medio: tiene Next.js + GraphQL Storefront API preconfigurados, pero necesitas personalizar cada componente, desde el listing de productos hasta el estado del carrito (8-12 semanas).

**El segundo costo: coordinación backend.** En un entorno MACH, cada servicio es independiente — pero la sincronización de estado entre ellos cae sobre ti. Ejemplo: servicio de inventario (Fluent Commerce), precios (Pimcore), promociones (Talon.One) — endpoints separados. Para que estos servicios trabajen en tiempo real, necesitas un bus de eventos (Kafka / AWS EventBridge). Para e-commerce de mediano volumen: mínimo 3 meses-ingeniero dedicados a esta orquestación.

**El tercer costo: tamaño del bundle.** Headless = código frontend personalizado. BigCommerce Catalyst: 850kB de JavaScript (240kB después de gzip). Shopify Hydrogen 2.0: usa React Server Components, pero aun así promedian 320kB. El frontend Next.js de ejemplo de commercetools: 950kB (cuando añades gestión de estado del carrito del lado del cliente). Comparación: un tema Liquid de Shopify suma 120-180kB. Porque el HTML se renderiza en el servidor, JavaScript es mínimo.

## BigCommerce Catalyst: El Compromiso del Término Medio

BigCommerce lanzó Catalyst en 2023: basado en Next.js, con API Storefront GraphQL integrada. La empresa lo presenta como "lo mejor de ambos mundos" — velocidad monolítica + flexibilidad headless.

**Sus fortalezas:** En Catalyst, los componentes PLP (página de listado de productos), PDP, carrito, checkout están listos. El esquema GraphQL está sincronizado con Storefront API. Eso significa que el frontend developer se enfoca en UI en lugar de escribir lógica de carrito desde cero. Deployment: push a Vercel / Netlify, los webhooks de BigCommerce triggerean la build. Tiempo de MVP: 8 semanas — la mitad de commercetools.

**Sus debilidades:** La flexibilidad sigue siendo limitada. Si quieres personalizar completamente el checkout, estás atado al Checkout SDK de BigCommerce. La integración de proveedores de pago de terceros (como Adyen) ocurre vía REST API + panel de control de BigCommerce — no hay control a nivel de componente React. Y el problema de tamaño de bundle persiste: la instalación por defecto de Catalyst suma 850kB. Si tu objetivo en Core Web Vitals es LCP de 2.5s, este bundle puede crecer a 4.2s en conexión 3G (según simulación en Lighthouse).

### Ejemplo de Código: Optimización de PLP en Catalyst

```javascript
// app/[locale]/(default)/category/[slug]/page.tsx
// El PLP por defecto de Catalyst carga 48 productos de forma eager
// Reducimos a 12 y añadimos paginación diferida

export default async function CategoryPage({ params }) {
  const products = await getProducts({
    categoryId: params.slug,
    first: 12, // 48 → 12
  });

  return (
    <div>
      <ProductGrid products={products.edges} />
      <LoadMoreButton cursor={products.pageInfo.endCursor} />
    </div>
  );
}

// client component: LoadMoreButton
'use client';
export function LoadMoreButton({ cursor }) {
  const [items, setItems] = useState([]);
  
  async function loadMore() {
    const res = await fetch(`/api/products?after=${cursor}&first=12`);
    const data = await res.json();
    setItems(prev => [...prev, ...data.edges]);
  }

  return <button onClick={loadMore}>Cargar más</button>;
}
```

Este cambio reduce el bundle inicial de 850kB a 620kB (reducción del 27%). LCP: de 4.2s a 2.9s. Pero aún más pesado que Liquid de Shopify.

## commercetools: Flexibilidad Máxima, Carga Máxima

commercetools se posiciona como "verdaderamente headless". Backend solo API, sin componentes UI. Todo el frontend lo construyes tú — opciones: Next.js, Vue, Svelte, abiertas.

**Sus fortalezas:** Flexibilidad total. Puedes escribir lógica de carrito personalizada, el flujo del checkout está completamente bajo tu control. Ejemplo: multi-moneda + cálculo de impuestos regional, precios personalizados del lado del servidor (crítico para B2B) — todo ocurre mediante requests a la API de commercetools. Además, soporta GraphQL + REST en paralelo — elige el endpoint que sea más performante.

**Sus debilidades:** El costo inicial es alto. Los partners de implementation de commercetools cobran MVP promedio de $120k-$180k (6 meses). La mitad es setup backend (importación de catálogo de productos, reglas de precios, sincronización de inventario), la otra mitad es frontend. Además, el costo continuo: la licencia de commercetools no es por transacciones sino por tarifa de plataforma — desde $50k anuales (mid-market). Frontend hosting + CDN aparte (Vercel Enterprise: $2k/mes).

**Realidad de performance:** El tiempo de respuesta promedio de API en commercetools es 120-180ms (desde servidores europeos, en caso de cache miss). Puedes cachear esto en Edge (Cloudflare Workers KV / Vercel Edge Config), pero tienes que escribir la lógica de invalidación tú mismo. Ejemplo: precio de producto cambia → webhook de commercetools → Cloudflare Workers → purga KV. Este pipeline es custom para cada proyecto.

## Shopify Plus: Composabilidad Híbrida

Shopify entró en el mundo composable con Hydrogen 2.0. Pero su enfoque es distinto: sigue soportando temas Liquid, Hydrogen es opcional. Es decir, híbrido: si lo necesitas, headless; si no, rápido con Liquid.

**Ventajas de Hydrogen 2.0:** Utiliza React Server Components — equilibra bien renderizado del lado del servidor + interactividad del lado del cliente. Ejemplo: la imagen hero de un producto se renderiza en el servidor (como HTML), el botón "añadir al carrito" es un client component (JavaScript). Resultado: bundle inicial 320kB, pero LCP 1.8s (CDN de Shopify es rápido, overhead de RSC bajo).

**Desventajas de Hydrogen 2.0:** El esfuerzo de migración. Si tienes una tienda Shopify Plus existente con tema Liquid, moverte a Hydrogen es un frontend nuevo. La conversión Liquid → React: 12-16 semanas. Además, Hydrogen necesita Storefront API 2024 — algunas variables Liquid antiguas (como `product.metafields`) requieren un patrón de query GraphQL diferente.

**Ventaja de Liquid:** Sigue siendo la opción más rápida. Porque el HTML se renderiza en el servidor, JavaScript es mínimo. Ejemplo: el tema Dawn de Shopify (tema Liquid por defecto): 120kB de bundle, LCP 1.2s. ¿Vale la pena la flexibilidad de headless con este costo? La respuesta depende del caso de uso. Si necesitas personalizar el checkout (por ejemplo, flujo de aprobación B2B), Hydrogen tiene sentido. Si una experiencia e-commerce estándar te funciona, Liquid sigue ganando.

### Tabla de Tradeoffs

| Criterio | Shopify Liquid | Shopify Hydrogen | BigCommerce Catalyst | commercetools |
|----------|----------------|------------------|----------------------|---------------|
| Tiempo MVP | 4 semanas | 12 semanas | 8 semanas | 24 semanas |
| Tamaño bundle | 120kB | 320kB | 620kB (optimizado) | 400-600kB |
| LCP (3G) | 1.2s | 1.8s | 2.9s | 2.5s (cacheado) |
| Flexibilidad checkout | Baja (SDK Shopify) | Media (checkout Hydrogen) | Media (SDK) | Total |
| Costo inicial | $15k-30k | $60k-90k | $50k-80k | $120k-180k |
| Tarifa plataforma anual | ~$24k (Plus) | ~$24k + Vercel | ~$36k (Enterprise) | $50k+ |

## A Qué Criterios Responderás

El comercio composable se vende como el "futuro", pero no se ajusta a todos los proyectos. Necesitas hablar de los criterios de decisión en escenarios concretos.

**Escenario 1: E-commerce B2C estándar, 500k-2M pedidos anuales.** Liquid gana. Porque el bundle es pequeño, LCP cumple objetivos, checkout integrado con Shopify Payments. Cambiar a headless aumenta el bundle 2.5x, eleva LCP de 1.2s a 1.8s (impacto en tasa de conversión: pérdida de 0.2-0.5%). Si no tienes necesidad de flexibilidad que justifique esto, cambiar no vale la pena.

**Escenario 2: B2B wholesale, flujo de aprobación personalizado, precios regionales.** commercetools tiene sentido. Porque la función B2B de Shopify Plus (B2B on Shopify) es limitada en lógica de aprobación. En commercetools, construyes un motor de reglas de carrito personalizado: "las órdenes superiores a 10k USD requieren aprobación de procurement". La flexibilidad API justifica el ROI en este escenario.

**Escenario 3: Tienda Shopify existente, personalización de checkout necesaria.** Hydrogen 2.0. Porque permaneces en el ecosistema Shopify (las integraciones de apps se conservan), pero controlas el checkout como componentes React. Tiempo de migración: 12 semanas — la mitad de commercetools. La tarifa de plataforma no cambia (ya pagas Shopify Plus).

**Escenario 4: Multi-canal (e-commerce + app móvil + marketplace), headless obligatorio.** BigCommerce Catalyst puede ser el término medio. Porque la API Storefront GraphQL se usa tanto para web como para app, pero sin el costo de integración de commercetools. Si la app móvil es React Native, los componentes de Catalyst se pueden adaptar (reutilización web → nativo).

## Cierre: Acepta la Factura de la Flexibilidad

La arquitectura MACH ofrece flexibilidad, pero esa flexibilidad vuelve como tamaño de bundle, costo inicial, esfuerzo de integración. Shopify Liquid sigue siendo la opción más rápida en producción — si tu escenario se ajusta a Liquid, cambiar a headless es overengineering, no optimización. BigCommerce Catalyst es el término medio: componentes preconfigurados + GraphQL flexible, pero con límites en checkout. commercetools es flexibilidad total: $120k iniciales + orquestación continua. Hydrogen 2.0 es headless en el ecosistema Shopify — pero más pesado que Liquid. Toma la decisión basada en si los tradeoffs de tu caso de uso justifican el cambio. En producción, los números van delante de las promesas.