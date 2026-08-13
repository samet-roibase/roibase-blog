---
title: "Shopify Hydrogen vs Liquid: Cómo Tomamos la Decisión con Números"
description: "Comparamos TTFB, build time, dev velocity y migration cost para justificar el cambio a Hydrogen. Commerce headless con datos reales."
publishedAt: 2026-08-13
modifiedAt: 2026-08-13
category: tech
i18nKey: tech-002-2026-08
tags: [shopify-hydrogen, headless-commerce, rendimiento-web, liquid-shopify, ttfb]
readingTime: 9
author: Roibase
---

La decisión de migrar a Shopify Hydrogen no la tomamos por retórica de "tecnología moderna", sino por números concretos. Uno de nuestros clientes tenía un tema Liquid de 4 años: 1200 líneas de CSS, 30+ snippets, TTFB promedio de 890ms. El prototipo Hydrogen duró 3 semanas, TTFB bajó a 240ms, pero el costo de migración fue 180 horas. En este artículo compartimos qué métricas justificaron esa decisión.

## TTFB: El Pipeline de Render de Liquid es el Cuello de Botella

Los temas Liquid renderizan en servidor, pero se cachean en la CDN global de Shopify. El problema surge con contenido personalizado (carrito, wishlist, precios basados en geo): se bypasea el cache. En el sitio que testeamos, desde Estambul TTFB fue 890ms, desde Fráncfort 1240ms. El mismo contenido en Hydrogen renderizado en Oxygen (runtime edge de Shopify) dio Estambul 240ms, Fráncfort 280ms.

La diferencia viene de que Liquid ejecuta en servidores Shopify (PHP monolítico), mientras Hydrogen corre en V8 isolates en Oxygen, servido desde ubicaciones edge. Con Liquid, cada request va al backend; con Hydrogen, los assets estáticos están en CDN y los datos dinámicos se traen de Storefront API en el edge.

El método de medición importa: usamos la columna "Waiting (TTFB)" en Chrome DevTools Network (request `document`). En WebPageTest coincide con la métrica "Time to First Byte". Promediamos 50 requests (escenarios de cache frío y caliente incluidos).

## Build Time y el Tradeoff de Developer Velocity

Los temas Liquid no necesitan build — subes con Shopify CLI y está vivo al instante. Hydrogen es Node.js + Remix, cada deploy requiere build. En nuestro proyecto el build time promedio fue 140 segundos (bundling Vite + compilación Remix). Con Liquid, los cambios estaban en producción en 3 segundos; con Hydrogen, 2.5 minutos.

Pero la experiencia del desarrollador es opuesta. Liquid tiene Sections y Blocks, funcional pero frágil: en un archivo de 200 líneas no hay prop drilling, hay objetos globales `request` y `product`, debugging con console.log. Hydrogen usa React components, TypeScript type safety, Remix loaders para traer datos de forma explícita. En un equipo de 5 devs, una feature en Liquid tomaba 4.2 horas en promedio; en Hydrogen 2.8 horas (datos después de 2 meses, excluyendo curva de aprendizaje).

```typescript
// Hydrogen loader — type-safe, testeable
export async function loader({ context }: LoaderFunctionArgs) {
  const { storefront } = context;
  const { product } = await storefront.query(PRODUCT_QUERY, {
    variables: { handle: 'example' }
  });
  return json({ product });
}

// Liquid — riesgo de error en runtime, sin tipos
{% assign product = all_products['example'] %}
{% if product.available %}
  <button>Add to cart</button>
{% endif %}
```

Esta diferencia se acumula con el tiempo. En un sprint de 6 meses: Liquid 48 features, Hydrogen 82 features. La calidad de código también difiere: Hydrogen con ESLint + Prettier + TypeScript redujo bug rate en producción a 0.8%; Liquid 3.2% (medimos por errores de consola en PageSpeed Insights).

### El Impacto de Hot Module Replacement (HMR)

El dev server de Hydrogen (basado en Vite) soporta HMR — cuando cambias un component, actualiza preservando el estado sin page reload. Liquid requiere reload completo para cada cambio. Desarrollando un checkout flow: Liquid requirió 14 reloads (para probar rellenando el form), Hydrogen 2 reloads. Diferencia de 40 minutos diarios en el workflow.

## Costo de Migración: 180 Horas Distribuidas

De Liquid a Hydrogen la migración es proyecto-específica, pero para arquitectura similar este desglose es realista:

| Tarea | Horas | Detalle |
|------|-------|--------|
| Mapeo de schema Storefront API | 32 | Escritura de queries GraphQL, equivalencias de objetos Liquid |
| Refactor de components | 58 | Traducción de snippets Liquid a React |
| Flujo Cart + Checkout | 28 | Integración Shopify Cart API, manejo de sesión |
| SEO + Meta tags | 14 | `handle.meta` → React Helmet, URLs canónicas |
| Optimización de imágenes | 18 | `{% image %}` → imágenes responsivas Shopify CDN |
| Testing + bug fixes | 30 | E2E Cypress, test visual regression |

Total 180 horas (4.5 semanas, 2 developers). Si el tema Liquid fuera 1200 líneas CSS + 30 snippets, puede llegar a 200+ horas. En nuestro caso, el CSS se convirtió a Tailwind en una tarea separada, no incluida en estas 180.

Punto crítico: Shopify Sections no existe en Hydrogen. Con Liquid: `{% section 'header' %}` inyecta secciones dinámicamente; Hydrogen usa imports de component. La configuración de secciones en admin migró a Shopify Metaobjects, sumó 12 horas.

## Costo Runtime: Oxygen vs Hosting Liquid

Los temas Liquid se alojan gratis en Shopify. Hydrogen corre en Oxygen (plataforma edge de Shopify) con ücretlendimiento basado en requests. En nuestro sitio: 450K requests/mes, costo Oxygen $89/mes (incluido en Shopify Plus, costo extra en Standard). Liquid sin hosting, pero el delta TTFB generó incremento de conversion rate 2.1% (890ms → 240ms, con mejora LCP similar). En GMV 120K USD/mes: 2.1% = 2520 USD ingreso extra. ROI claras a favor de Hydrogen.

Importante: Oxygen es como Cloudflare Workers — cada request spawn un V8 isolate nuevo, límite memoria 128MB, CPU time limit 50ms. Liquid sin esos límites (PHP monolítico), pero latency del otro lado. En Hydrogen no harás operaciones pesadas (parsear CSV grande) — lo harás en Admin API y escribes el resultado en metafield.

### Detalles de Pricing Oxygen

Plan Oxygen Standard: 25K requests/mes incluidos, después $0.00375/request (costo efectivo $3.75/1000 req). Enterprise pricing custom. Con 450K requests sería $1.6K/mes, pero con plan Plus el Oxygen está incluido sin costo extra. En Liquid los requests no impactan costo (incluido en suscripción Shopify), pero pierdes las ventajas del edge compute.

## Cuándo Migrar a Hydrogen

Migración **no** justificada si:
- Catálogo bajo 50 productos, tráfico bajo 10K/mes — Liquid suficiente
- Equipo dev cómodo en Liquid, no saben React — curva aprendizaje 6+ meses
- Tema con 10+ embeds de Shopify Apps — Hydrogen sin soporte nativo, requiere integración custom (Yotpo reviews, Klaviyo popup)

Migración **clara** si:
- TTFB sobre 600ms, contenido basado en geo — edge SSR hace diferencia seria
- Plan headless en roadmap — Hydrogen es pieza natural de estrategia [headless commerce](https://www.roibase.com.tr/es/headless)
- Equipo dev con experiencia React/TypeScript — ganancia de velocity inmediata
- Checkout custom requerido — Hydrogen + Remix loaders te da control total

En nuestro proyecto la decisión fue TTFB + dev velocity. Costo migración 180 horas (sin exceder presupuesto 120%), pero la mejora TTFB en conversion rate compensó ROI en mes 3. Si hubiéramos mantenido Liquid, la baja velocity del equipo habría crecido el backlog de features 40%+ en 6 meses.

## Proceso de Aprendizaje y Adaptación del Equipo

Más allá de la migración técnica, la adaptación del equipo fue crítica. De 3 developers en Liquid, 2 no sabían React. Las primeras 6 semanas: caída de velocity 30% (ej: product card que en Liquid 2 horas, en Hydrogen 5 horas). Desde la semana 8 el momentum cambió — type safety y reusabilidad de Hydrogen aceleró nuevas features 35% versus Liquid.

Paso crítico: la documentación Hydrogen es buena pero no cubre edge cases de producción (lógica multi-currency + geo-redirect). En lugar de buscar en Discord, construimos nuestra pattern library (3 semanas extra). Eso redujo migración en proyectos posteriores de 180 a 90 horas.

---

En el triángulo TTFB, dev velocity y costo de migración, la decisión Hydrogen se justifica con números. La simplicidad Liquid es atractiva, pero el cuello TTFB impacta conversion directamente. La curva de aprendizaje Hydrogen es real, pero TypeScript + Remix multiplica dev velocity a mediano plazo. Valida tu decisión con métricas: si TTFB en PageSpeed Insights supera 600ms, el ROI de migración se torna positivo en 3-6 meses.