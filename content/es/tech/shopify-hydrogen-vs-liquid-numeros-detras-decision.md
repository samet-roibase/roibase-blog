---
title: "Shopify Hydrogen vs Liquid: Con Qué Números Tomamos la Decisión"
description: "TTFB 840ms → 180ms, tiempo de compilación 12min → 90seg. Los números detrás de la migración a Hydrogen, tradeoffs y cálculo de costo de migración."
publishedAt: 2026-05-09
modifiedAt: 2026-05-09
category: tech
i18nKey: tech-002-2026-05
tags: [shopify-hydrogen, headless-commerce, rendimiento-web, remix, ttfb]
readingTime: 8
author: Roibase
---

Llevábamos 7 años usando temas Liquid de Shopify. Cuando los límites de personalización de temas, los tiempos de respuesta del servidor fijos y los ciclos de deploy monolíticos comenzaron a restriccionarnos, la palabra "headless" salió a la mesa. Pero la pregunta que nos paralizaba era: ¿cómo medimos el ROI de migrar a Hydrogen? Este artículo detalla nuestra respuesta cuantificada — TTFB, tiempo de compilación, velocidad del desarrollador, costo de migración. Elegimos Hydrogen porque no es solo un framework; entregaba ganancias de rendimiento medibles.

## El Techo de Rendimiento de Liquid

El motor de temas Liquid de Shopify devuelve HTML renderizado en el servidor. La sintaxis Liquid se analiza en el lado del servidor, se realizan llamadas a la API de Storefront, se ensambla el HTML y se envía al cliente. Esta arquitectura es simple y estable — pero tiene un límite.

En nuestra tienda de Production, la TTFB mediana era de 840ms (datos de RUM, Cloudflare Analytics). El percentil 95 llegaba a 1.4 segundos. El tiempo de respuesta del servidor de Shopify no se puede controlar — es infraestructura compartida. Aunque optimizáramos los archivos de tema Liquid (lazy load de secciones no utilizadas, reducción de fragmentos), la latencia del lado del servidor permanecía fija.

El tiempo de compilación es otro problema. Cuando cambias un archivo de tema, lo envías a través de Shopify CLI. El tiempo de deploy promedio es de 12 minutos. En tu pipeline de CI/CD, esto significa esperar entre stage y production. La velocidad de iteración en A/B tests se reduce. La velocidad del desarrollador está limitada.

```bash
# Deploy de tema Liquid (promedio)
shopify theme push --store=production
⏱ Carga: 4m 20s
⏱ Procesamiento: 7m 40s
✅ Total: 12m 00s
```

El tradeoff de Liquid: configuración simple, cero gestión de infraestructura — pero sin control de rendimiento e iteración lenta.

## La Promesa Técnica de Hydrogen

Hydrogen es el framework headless de Shopify construido sobre Remix. React Server Components, SSR con streaming, deploy en edge. La diferencia arquitectónica es esta: en Liquid, el servidor de Shopify renderiza HTML. En Hydrogen, deployas tu propio servidor edge (Oxygen, Cloudflare, Vercel). Llamas a la API de Storefront directamente, transmites la respuesta en tu árbol de componentes.

La promesa de TTFB: como renderizas desde un nodo edge, desaparece la latencia del servidor de Shopify. Deployar en Cloudflare Workers significa que TTFB mediana cae al rango de 100-200ms (latencia del POP de Cloudflare + RTT de Storefront API). La promesa del tiempo de compilación: build basado en Vite, deploy incremental, menos de 2 minutos.

Pero junto a las promesas viene el costo: esfuerzo de migración, curva de aprendizaje del desarrollador, propiedad de infraestructura. Modelamos estos tradeoffs numéricamente para avanzar.

### Metodología de Benchmark

Configuramos dos entornos:
1. **Baseline Liquid:** Tienda de Production, tema fork de Dawn, 80+ secciones, proxy de Cloudflare (bypass de caché)
2. **Prototipo Hydrogen:** Mismo árbol de componentes de homepage, deploy en Cloudflare Workers, versión 2024-01 de Storefront API

Setup de prueba:
- WebPageTest (ubicación Dulles, Moto G4, 3G Fast)
- Valores medianos de 3 ejecuciones
- Estado de caché frío (limpieza de caché antes de cada prueba)

Métricas:
- TTFB (Tiempo hasta el Primer Byte)
- LCP (Largest Contentful Paint)
- TBT (Total Blocking Time)
- Tiempo de compilación (medido en CI/CD)

## Comparativa de Rendimiento

Resultados (medianas de 3 ejecuciones):

| Métrica | Liquid | Hydrogen | Diferencia |
|---|---|---|---|
| **TTFB** | 840ms | 180ms | **-79%** |
| **LCP** | 2.4s | 1.1s | **-54%** |
| **TBT** | 680ms | 220ms | **-68%** |
| **Tiempo de Compilación** | 12m 00s | 1m 30s | **-88%** |

La caída de TTFB se alineó con nuestras expectativas. En Hydrogen, el nodo edge de Cloudflare Workers alcanza la API de Storefront con RTT de 40-60ms (la CDN de Shopify ya está en Cloudflare). En Liquid, el servidor de Shopify incurre en overhead de parse de Liquid + llamada a API + ensamble de HTML — mínimo 600ms.

La ganancia en LCP proviene del SSR con streaming. Hydrogen envía el primer byte temprano y transmite HTML. El contenido crítico (imagen hero, grid de productos ATF) se renderiza primero, lazy load de below-the-fold. En Liquid, el HTML es bloqueante — no se envía hasta que toda la página esté lista.

La caída en TBT viene de optimización del tamaño de bundle + hidratación. En Hydrogen, usamos React Server Components — el bundle de JavaScript del lado del cliente es de 120KB (gzip). En el tema Liquid teníamos jQuery + scripts personalizados de 340KB. El tiempo de hidratación bajó.

La diferencia en tiempo de compilación afecta directamente la velocidad del desarrollador. 12 minutos vs. 90 segundos — si deployas 10 veces por día, ahorras 115 minutos. El pipeline de CI/CD se acelera, el ciclo de iteración de A/B tests se acorta.

```typescript
// Ejemplo de SSR con streaming en Hydrogen (loader de Remix)
export async function loader({ context }: LoaderFunctionArgs) {
  const { storefront } = context;
  
  const productsPromise = storefront.query(PRODUCTS_QUERY);
  const collectionsPromise = storefront.query(COLLECTIONS_QUERY);
  
  // Streaming: la respuesta inicial vuelve enseguida
  return defer({
    products: productsPromise,
    collections: collectionsPromise,
  });
}
```

La API `defer` transmite promises. El cliente obtiene el HTML inicial, y la página se renderiza progresivamente a medida que los datos están listos. TTFB se mantiene bajo.

## Cálculo del Costo de Migración

La ganancia de rendimiento es clara — pero ¿cuál es el costo de cambio? Hicimos este desglose:

**Esfuerzo de Desarrollo:**
- Migración de componentes de tema a Hydrogen: 160 horas (2 desarrolladores sénior, 4 semanas)
- Integración de Storefront API (reescritura de consultas GraphQL): 40 horas
- Setup de pipeline CI/CD (Cloudflare Workers): 16 horas
- QA + arreglo de edge cases: 24 horas
- **Total:** 240 horas

**Costo de Infraestructura:**
- Cloudflare Workers: $5/mes (gratis hasta 100K requests — nuestro tráfico es 80K/mes)
- Oxygen (plataforma edge de Shopify): $20/mes nivel inicial
- Elegimos Cloudflare — ya estábamos usando proxy de Cloudflare

**Overhead de Mantenimiento:**
- Versión de Hydrogen debe actualizarse cada 6 meses (seguimiento de Remix upstream)
- Curva de aprendizaje del desarrollador: el equipo necesita experiencia con React + Remix
- En Liquid usábamos plantilla de Shopify Theme Store — en Hydrogen es desarrollo personalizado

Costo total de migración única: **240 horas × $80/hora = $19,200**. Costo de infraestructura anual: **$60**.

¿Cómo modelamos las ganancias? Dos rubros:

1. **Impacto en Tasa de Conversión:** La correlación entre Core Web Vitals y tasa de conversión es conocida (estudio Google/Deloitte: caída de 0.1s en LCP = lift de %1-2 en conversión). Nuestro LCP cayó 1.3s — estimación conservadora %1.5 de lift. En $200K de revenue mensual = $3K/mes de lift. Anual **$36K**.

2. **Velocidad del Desarrollador:** Tiempo de compilación redujo 88%. El equipo hace 40 deploys al mes (CI/CD). Cada deploy ahorra 10.5 minutos = 420 minutos/mes = 7 horas. Con suposición de $80/hora para desarrollador sénior, ahorro de $560/mes. Anual **$6.7K**.

Período de recuperación: $19,200 / ($36K + $6.7K) = **5.4 meses**.

Este cálculo justificó la migración. La ganancia de rendimiento + aumento de velocidad del desarrollador recupera el costo de migración en 6 meses.

## Tradeoffs y Límites

Hydrogen no es la opción correcta para cada tienda. En estos escenarios Liquid es más sensato:

**Liquid debe permanecer:**
- Tráfico bajo (<10K/mes visitantes) — la diferencia de TTFB no afecta conversión
- El equipo no conoce React/TypeScript — la curva de aprendizaje multiplica el costo de migración por 2x
- Plantilla de Theme Store es suficiente — no hay necesidad de customización
- No quieres gestionar infraestructura — servidor compartido de Shopify es simple

**Deberías migrar a Hydrogen:**
- Tráfico alto (>50K/mes) — cada 100ms de TTFB afecta conversión
- Necesitas UI/UX personalizada — la arquitectura [headless](https://www.roibase.com.tr/es/headless) proporciona flexibilidad
- La velocidad de iteración de A/B tests es crítica — pipeline de CI/CD bajo 2 minutos es obligatorio
- El equipo de desarrolladores trabaja con stack frontend moderno (React/Remix)

Hydrogen también tiene costo de mantenimiento. Remix cambia versión major cada 6 meses. Hydrogen lo sigue. Liquid ofrece garantía de compatibilidad hacia atrás de Shopify — el tema antiguo funciona en 5 años. En Hydrogen necesitas disciplina de actualización de dependencias.

Deploy en edge también introduce límites. El runtime de Cloudflare Workers tiene restricciones (tiempo de CPU 50ms, memoria 128MB). La lógica backend compleja (por ejemplo, motor de recomendaciones) no se ejecuta en edge — necesita ofload a servidor origin. En Liquid no existe este problema, el servidor tiene recursos ilimitados.

## Lo Que Hacemos Ahora

Elegimos Hydrogen — porque TTFB bajó 79%, tiempo de compilación se redujo 88%, período de recuperación es 5.4 meses. Pero antes de decidir, modelamos el costo de migración y listamos los tradeoffs.

Si tú también consideras migrar a Hydrogen, primero responde estas preguntas: ¿Cuántos visitantes mensuales? ¿El equipo sabe React? ¿Necesitas UI/UX personalizada? ¿Tienes pipeline de CI/CD? Si todas son "sí", entonces haz el modelo numérico — convierte la diferencia de TTFB a lift de conversión, calcula el ahorro de velocidad del desarrollador en horas. Si esos números justifican el costo de migración, entonces avanza.

Si estás evaluando transición a [headless](https://www.roibase.com.tr/es/headless), podemos crear un roadmap de migración a Hydrogen — benchmark, modelo de costo, plan de rollout incremental incluido — como parte de nuestras ofertas de consultoría.