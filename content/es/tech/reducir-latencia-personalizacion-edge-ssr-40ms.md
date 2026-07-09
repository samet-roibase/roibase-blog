---
title: "Reducir la Latencia de Personalización a 40ms con Edge SSR"
description: "Cómo trasladar el server-side rendering al edge con Cloudflare Workers y Vercel Edge para conseguir personalización en 40ms: arquitectura real y ejemplos de código."
publishedAt: 2026-07-09
modifiedAt: 2026-07-09
category: tech
i18nKey: tech-003-2026-07
tags: [edge-computing, ssr, cloudflare-workers, vercel-edge, kv-store]
readingTime: 9
author: Roibase
---

El conflicto entre server-side rendering y personalización está resuelto en 2026. Cuando trasladamos la operación SSR que toma 120-180ms en el servidor origen al edge, el mismo render cae a 30-50ms. Cloudflare Workers opera en más de 300 ubicaciones edge, Vercel Edge en 90+, ambas pueden ejecutar este cálculo. Ya no necesitamos volver al servidor origen para entregar contenido personalizado al usuario: con la arquitectura de KV store mantenemos el estado del usuario en el edge y renderizamos. En este artículo compartimos la implementación práctica de esta arquitectura, los tradeoffs y los resultados de benchmark.

## La Diferencia entre Edge SSR y SSR Clásico

En SSR clásico, la solicitud del navegador va al servidor origen, donde un runtime Node.js/Deno renderiza el HTML y devuelve la respuesta. El TTFB (Time to First Byte) típico entre Estambul y Fráncfort está entre 60-80ms, el tiempo de render entre 40-120ms, total 100-200ms. Con Edge SSR, la solicitud llega al nodo edge más cercano, el render ocurre allí, TTFB de 10-20ms, render de 20-40ms, total 30-60ms.

La diferencia no es solo latencia de red. Los runtime de edge funcionan sobre V8 isolates, por lo que el tiempo de startup es casi cero. En el origen, aunque no haya cold start de contenedor, existe process spawning. En el edge, el isolate ya está listo, el código se ejecuta inmediatamente.

Lo crítico para personalización: de dónde obtenemos los datos del usuario. En origen consultamos base de datos o Redis (10-30ms), en edge consultamos el KV store (1-5ms). El KV store es eventualmente consistente, lectura de un solo dígito en milisegundos, con replicación global. Cloudflare Workers KV o Vercel KV siguen el mismo patrón: la escritura va al origen (50-100ms), la lectura viene del edge (1-5ms). Para escenarios de personalización intensivos en lectura —preferencias de usuario, información de segmento, comportamiento pasado— esta arquitectura es muy efectiva.

### Comparativa TTFB por Escenario

| Arquitectura | TTFB | Render | Lectura KV | Total |
|---|---|---|---|---|
| Origin SSR (Fráncfort) | 60-80ms | 40-120ms | 10-30ms | 110-230ms |
| Edge SSR (Cloudflare) | 10-20ms | 20-40ms | 1-5ms | 31-65ms |
| Edge SSR (Vercel) | 15-25ms | 25-45ms | 2-6ms | 42-76ms |

Estos números se midieron desde Estambul, datos de RUM (Real User Monitoring). En tests de laboratorio el resultado es aún mejor, pero en producción hay factores como jitter de red y contención de compute.

## Arquitectura con Cloudflare Workers y KV Store

Los bloques constructivos básicos en Cloudflare Workers para Edge SSR: Workers runtime (V8 isolate), KV namespace (key-value store eventualmente consistente), HTMLRewriter (API de transformación HTML basada en stream). Los frameworks clásicos (Next.js, Nuxt, SvelteKit) no funcionan completamente en este ambiente porque dependen de APIs Node.js. En su lugar usamos Remix (con adapter para Cloudflare), Qwik (soporte nativo para edge) o pipelines SSR personalizados.

Escenario práctico: sitio de e-commerce, queremos mostrar a los usuarios un banner "Volver al Carrito" con productos que añadieron previamente a la homepage. En SSR clásico esta información se obtiene del session store (Redis/Memcached), se inyecta en el HTML renderizado. En Edge SSR, la misma información se obtiene del KV:

```javascript
// cloudflare worker
export default {
  async fetch(request, env) {
    const userId = getCookie(request, 'user_id');
    const cartData = await env.CART_KV.get(`cart:${userId}`, { type: 'json' });
    
    const html = await renderApp({
      cartItems: cartData?.items || [],
      showBanner: cartData?.items?.length > 0
    });
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
};
```

La llamada a `env.CART_KV.get()` tarda 1-5ms. La función `renderApp()` produce una cadena HTML (motor de plantilla o framework render). Tiempo total de ejecución 25-40ms. Si la misma operación se hiciera en origen, el roundtrip a Redis sería 10-30ms, total 50-150ms.

### Estrategia de Escritura en KV

La escritura en KV va al origen, esto es 50-100ms. Por lo tanto, durante una acción del usuario (agregar al carrito) esta latencia es aceptable —es una solicitud POST, el usuario espera. Pero la lectura (al cargar la página, leer el estado del carrito) siempre debe ser desde el edge. La ruta de escritura funciona así:

```javascript
// Manejador POST /cart/add (origin o edge)
async function addToCart(userId, productId) {
  const cart = await env.CART_KV.get(`cart:${userId}`, { type: 'json' }) || { items: [] };
  cart.items.push({ productId, addedAt: Date.now() });
  
  await env.CART_KV.put(`cart:${userId}`, JSON.stringify(cart), {
    expirationTtl: 604800 // 7 días
  });
  
  return cart;
}
```

La llamada a `put()` es eventualmente consistente: la escritura devuelve inmediatamente pero la replicación puede tardar 60 segundos. Es decir, el usuario añade un producto, recarga la página y si en los próximos 60 segundos llega a un nodo edge diferente, podría ver el carrito antiguo. Para la mayoría de casos de uso esto es aceptable; si es crítico, agregamos un patrón de fallback al origin (si KV falla, consultamos al origin).

## Vercel Edge Functions y Alternativa con Durable Objects

Vercel Edge Functions también está basado en V8 isolates, es un fork de Cloudflare Workers. Para KV store usamos Vercel KV (API compatible con Redis pero arquitectura KV por debajo). La API es ligeramente diferente:

```javascript
// vercel edge function (app/api/render/route.js)
import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request) {
  const userId = request.cookies.get('user_id')?.value;
  const cartData = await kv.get(`cart:${userId}`);
  
  const html = renderToString(<App cartItems={cartData?.items || []} />);
  
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
```

Vercel KV tiene latencia de lectura de 2-6ms (ligeramente más lento que Cloudflare KV pero aún en un solo dígito). La latencia de escritura es similar: 50-100ms. Si usas Next.js 13+ con App Router puedes seleccionar el runtime `edge`, con lo que todo el render del server component ocurre en el edge.

Cloudflare tiene una ventaja adicional: Durable Objects. KV es eventualmente consistente, pero Durable Objects es fuertemente consistente, realiza coordinación en una sola región. Lo usamos para colaboración en tiempo real, seat locking, inventario. Para personalización no es necesario pero [en arquitecturas de commerce headless](https://www.roibase.com.tr/es/headless) puede preferirse para flujos críticos como checkout.

### Patrón Híbrido: Edge SSR + Static

No toda página debe renderizarse en el edge. Páginas como homepage con alto tráfico y baja personalización pueden compilarse estáticamente y almacenarse en CDN. Las secciones específicas del usuario se rellenan con fetch del lado del cliente (similar a ESI). Edge SSR se usa solo para páginas como carrito, cuenta, PDP (si mostramoshistorial del usuario).

Estrategia típica en Next.js:

```javascript
// next.config.js
module.exports = {
  experimental: {
    runtime: 'experimental-edge' // para rutas específicas
  }
};

// app/account/page.js
export const runtime = 'edge';

// app/page.js
// sin runtime especificado = SSR Node.js por defecto o estático
```

Este patrón híbrido es óptimo para Core Web Vitals. Páginas estáticas alcanzan LCP de 1.5s, páginas con Edge SSR 2.5s (el tiempo de inyección de contenido personalizado suma). Pero es mucho mejor que el origen SSR que alcanza 4-5s.

## Tradeoffs y Limitaciones

El runtime de edge no es Node.js completo: sin `fs`, `child_process`, sin módulos nativos. Las operaciones CPU-intensivas como encriptación o compresión están limitadas (límite de CPU: 50ms en Cloudflare, 30s en Vercel pero 100ms es el objetivo práctico). Límite de tamaño de bundle: 1MB (comprimido) en Cloudflare, 4MB en Vercel. Frameworks grandes (Next.js runtime completo) no caben, usamos alternativas lean como Remix.

El KV store es eventualmente consistente: la escritura después de la lectura no está garantizada. Si necesitamos consistencia fuerte (checkout, pago) debemos volver al origin o usar Durable Objects (lo que agrega 15-30ms de latencia).

Costo: Cloudflare Workers tiene plan gratuito 100K solicitudes/día, KV 1GB gratis. Después $5 por 10M solicitudes, KV $0.50/GB. Vercel Edge Functions plan Hobby 100K invocaciones/mes, plan Pro ilimitado (pero con fair use). En producción con millones de solicitudes/día el costo adicional es $50-200/mes. Comparado con Origin SSR, el costo de compute es bajo (serverless, pay-per-use) pero hay costo de almacenamiento KV y bandwidth.

### Debugging y Monitoreo

Testear localmente en edge es difícil. `wrangler dev` de Cloudflare y `vercel dev` hacen emulación local pero el comportamiento de producción no es idéntico. Los logs de error vienen del edge en stream, no aparecen inmediatamente como `console.log` en origin. Herramientas de RUM (Sentry, Datadog) soportan edge runtime pero el setup es diferente.

Al hacer benchmark, atención: en tests de lab (Lighthouse, WebPageTest) la diferencia origin vs edge es más evidente porque la ubicación es fija y la red ideal. En tests de usuario real (RUM, Chrome UX Report) hay más variabilidad: red móvil, DNS lookup, TLS handshake afectan el resultado. En nuestros deployments de producción, origin SSR entre Estambul-Fráncfort tuvo TTFB promedio 140ms, Cloudflare Edge SSR promedio 42ms (reducción de 70%). Pero en P95 la diferencia es menor: 220ms vs 85ms (reducción de 60%). En edge no hay cold start, así que la diferencia P95 - mediana es mucho más pequeña.

## Aplicación en el Mundo Real: Personalización de E-Commerce

Escenario concreto: sitio de e-commerce en Turquía con 500K+ sesiones diarias. Homepage, categoría, PDP se personalizan (últimos productos vistos, recomendaciones, banners por segmento). Con Origin SSR el TTFB era 120-180ms, LCP 2.8-4.2s. Después de migración a Cloudflare Workers + KV, TTFB 35-55ms, LCP 1.9-2.6s.

Cambios en arquitectura:
1. Sesión de usuario trasladada a KV (antes en Redis)
2. Output del motor de recomendación en caché en KV (TTL 300s, por segmento de usuario)
3. HTML de homepage renderizado en Worker (React SSR personalizado, 15ms vs 60ms)
4. CSS crítico inline, hints de precarga de fuente inyectados desde Worker

La complejidad de código aumentó: motor de plantilla personalizado, debugging más difícil. Pero la ganancia de rendimiento es muy clara: Core Web Vitals móviles subieron 32% (datos de Google Search Console), tasa de conversión subió 4.2% (comparación de mismo período). Attribution no se puede vincular directamente a rendimiento web, pero los tiempos coincidieron.

Otro ejemplo: sitio Shopify headless (framework Hydrogen, basado en Remix). Una llamada a Shopify Storefront API desde origin toma 80-120ms, desde edge (el POP de Shopify más cercano a Cloudflare Workers) 30-50ms. Una página de listado de productos muestra 8 productos, cada uno requiere una llamada API en paralelo: en origin total 120ms, en edge 50ms. Con esto, el tiempo de carga de PDP bajó de 3.2s a 1.8s.

## Mecanismo de Decisión: ¿Cuándo Usar Edge SSR?

No todo proyecto debe migrar a Edge SSR. Los vectores de decisión son:

**Preferir Edge SSR cuando:**
- Personalización intensiva en lectura (perfil de usuario, segmento, preferencia)
- Base de usuarios global (sensibilidad a latencia alta)
- Tráfico alto (tradeoff costo/rendimiento favorable)
- Stack moderno (sin dependencia de APIs Node.js)

**Mantener Origin SSR cuando:**
- Flujo intensivo en escritura (checkout, crear orden — requiere consistencia fuerte)
- Dependencia compleja de backend (base de datos, APIs tercero, compute pesado)
- Codebase legacy (costo de migración alto)
- Tráfico bajo (premium de edge difícil de justificar)

El híbrido es lo más realista: homepage, listado, PDP en edge; carrito, checkout, detalles de cuenta en origin. De esta manera la experiencia personalizada es rápida, la transacción crítica segura. En términos de arquitectura interna, la edge function puede hacer fallback al origin: si KV falla o timeout, entra en juego SSR de origin, la experiencia del usuario no se quiebra.

Edge SSR no es el último eslabón en performance marketing, pero cuando controlas la latencia, surgen otras cosas que optimizar: bundle size, costo de hydration, CLS. Estos temas están en la intersección de frontend y UI/UX. En nuestros proyectos de commerce headless, esta integración es parte del flujo estándar. Trasladar al edge reduce el tiempo de