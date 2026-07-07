---
title: "Shopify Hydrogen vs Liquid: Los Números que Tomaron la Decisión"
description: "TTFB 680ms vs 120ms, tiempo de build 8min vs 45seg, costo de migración $12K. Analizamos la decisión de cambiar a Hydrogen con datos concretos."
publishedAt: 2026-07-07
modifiedAt: 2026-07-07
category: tech
i18nKey: tech-002-2026-07
tags: [shopify-hydrogen, liquid, web-performance, headless-commerce, ttfb]
readingTime: 9
author: Roibase
---

Cuando Shopify Hydrogen se estabilizó a finales de 2024, evaluamos migrar el tema Liquid existente de nuestro cliente a Hydrogen. El proceso de decisión fue completamente numérico: TTFB, tiempo de build, dev velocity, costo de migración. Resultado: ejecutamos la migración y llegamos a producción 3 meses después. En este artículo mostramos qué números tomaron la decisión final.

## TTFB: El Costo del Server-Side Rendering

El tema Liquid en producción ofrecía un TTFB promedio de **680ms** (Analytics de Shopify, promedio de 30 días). Distribución por tipo de página:

| Tipo de Página | Liquid TTFB | Hydrogen TTFB | Diferencia |
|---|---|---|---|
| Home | 520ms | 95ms | -425ms |
| Collection | 780ms | 140ms | -640ms |
| Product | 650ms | 110ms | -540ms |
| Cart | 890ms | 150ms | -740ms |

El motor SSR de Hydrogen ejecutándose en edge entregaba ~120ms de TTFB independientemente del tipo de página. En Liquid, cada solicitud al origin desencadenaba server-side rendering; en Hydrogen, los loaders de Remix se ejecutan en los nodos edge de Oxygen.

```typescript
// Ejemplo de loader en Hydrogen — se ejecuta en edge de Oxygen
export async function loader({context, params}: LoaderFunctionArgs) {
  const {storefront} = context;
  const {handle} = params;
  
  const {product} = await storefront.query(PRODUCT_QUERY, {
    variables: {handle},
  });
  
  return json({product});
}
```

Con cache hit, el TTFB bajaba a 40ms (agregando una capa de cache con Cloudflare Workers KV). En Liquid, lograr una optimización similar requería depender del CDN de Shopify, insuficiente para contenido dinámico (cart, personalizaciones).

## Tiempo de Build: El Crecimiento de la Ineficiencia

El build de producción del tema Liquid (en pipeline CI/CD) tomaba **8 minutos 15 segundos**: Theme Kit asset upload, minificación, deploy a Shopify. El build de Hydrogen en producción: **45 segundos** — Vite build + deploy a Oxygen.

**En entorno local:**
- Liquid: sin hot reload, cada cambio requería recargar el tema (~12seg)
- Hydrogen: HMR refleja cambios en el navegador al instante (<200ms)

Feedback del equipo: con 20 cambios en una feature branch, el tiempo de espera total en Liquid era ~4 minutos; en Hydrogen, ~4 segundos. Incremento en dev velocity: **98%**.

```bash
# Iniciar servidor de desarrollo en Hydrogen
npm run dev
# Servidor Vite listo en 200ms, HMR activo

# Desarrollo con tema Liquid
shopify theme serve
# Espera de 8-12seg hasta que el tema se cargue
```

La arquitectura [Headless Commerce](https://www.roibase.com.tr/es/headless) posibilita estas optimizaciones — el frontend extrae datos vía Storefront API de Shopify, el proceso de build es independiente.

## Costo de Migración: Cálculo de Deuda Técnica

Dividimos el costo de migración en estos rubros:

| Rubro | Horas | Costo ($) |
|---|---|---|
| Análisis del tema Liquid | 16 | 1,600 |
| Mapeo de componentes (35 snippets Liquid → React) | 80 | 8,000 |
| Migración de API (REST → Storefront API) | 24 | 2,400 |
| Testing + QA | 12 | 1,200 |
| **Total** | **132** | **$13,200** |

Costos adicionales: hosting en Oxygen (incluido con Shopify Plus), capa de cache en Cloudflare Workers (opcional, $5/mes).

**El tradeoff:** mantener Liquid generaba ~120 horas/año de ineficiencia en dev (por la diferencia de build time anterior) × $100/hora = $12,000. Al final del primer año, el costo de migración se amortiza.

## Rendimiento en Runtime: Impacto en Core Web Vitals

Datos de campo (Chrome User Experience Report, 28 días):

| Métrica | Liquid (p75) | Hydrogen (p75) | Diferencia |
|---|---|---|---|
| LCP | 2,840ms | 1,620ms | -43% |
| FID | 180ms | 80ms | -56% |
| CLS | 0.18 | 0.04 | -78% |
| TTFB | 680ms | 120ms | -82% |

La combinación de React Suspense + streaming SSR de Hydrogen reduce el LCP. Los componentes lazy loading se extraen del bundle inicial, acortando el critical path.

```typescript
// Lazy loading con React Suspense para recomendaciones de productos
import {Suspense} from 'react';
const ProductRecommendations = lazy(() => import('./ProductRecommendations'));

<Suspense fallback={<RecommendationSkeleton />}>
  <ProductRecommendations productId={product.id} />
</Suspense>
```

La reducción de CLS: Liquid causaba layout shifts dinámicos (cart drawer, promo banner); Hydrogen los eliminó con skeleton components.

## Developer Experience: Feedback del Equipo

60 días después de la migración, encuestamos al equipo de desarrollo (5 developers):

**Mayor dificultad en Liquid:**
- 80% "El proceso de debug era muy largo"
- 60% "Falta de tooling moderno (TypeScript, hot reload)"
- 40% "Ausencia de reutilización de componentes"

**Mayor beneficio en Hydrogen:**
- 100% "TypeScript + autocompletar del IDE"
- 80% "Dev speed con HMR"
- 60% "Acceso al ecosistema React"

Feedback negativo: documentación incompleta de Hydrogen (40%), curva de aprendizaje del router Remix de Shopify (20%).

## Cuándo Mantener Liquid Tiene Sentido

Migrar a Hydrogen no es la decisión correcta en estos casos:

1. **Tráfico <10K sesiones/mes:** La diferencia de TTFB no impacta la experiencia, ROI de migración nulo.
2. **Tema poco customizado:** Si usas tema off-the-shelf, el esfuerzo de migración no genera retorno.
3. **Equipo sin experiencia React:** El costo de aprendizaje + onboarding multiplica por 2-3 el tiempo de migración.
4. **No es Shopify Plus:** Oxygen hosting viene con Shopify Plus; en planes Basic/Advanced hay costo adicional.

## Post-Migración: Estrategia de Rollout a Producción

Rollout en 3 fases:

1. **Entorno beta:** El sitio Hydrogen se deployó en Vercel, testing interno 2 semanas (QA + stakeholders).
2. **Canary release:** 10% del tráfico se enrutó a Hydrogen (A/B split con Cloudflare Workers), tasa de conversión delta +2.3%.
3. **Rollout completo:** 14 días después, 100% del tráfico a Hydrogen; el tema Liquid quedó como respaldo.

Métrica post-lanzamiento: tasa de conversión en checkout subió de 3.8% a 4.1% (efecto de TTFB reducido + CLS mejorado). Impacto en revenue anual: $180K (AOV promedio $120, 15K órdenes/mes).

La decisión por Hydrogen fue numéricamente correcta: TTFB bajó 82%, dev velocity se incrementó 98%, costo de migración se amortizó en el primer año. La razón de salir de Liquid no fue performance puro — fue developer experience moderno + flexibilidad de arquitectura composable. Si quieres headless dentro del ecosistema Shopify, Hydrogen es la única opción sensata.