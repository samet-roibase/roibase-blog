---
title: "Comercio Componible: La Realidad de Producción de la Arquitectura MACH"
description: "BigCommerce, commercetools, Shopify Plus — resolvemos los trade-offs del comercio componible en escenarios de producción con benchmarks."
publishedAt: 2026-06-25
modifiedAt: 2026-06-25
category: tech
i18nKey: tech-005-2026-06
tags: [comercio-componible, arquitectura-mach, comercio-headless, shopify-hydrogen, commercetools]
readingTime: 9
author: Roibase
---

En 2024, el "comercio componible" dejó de ser un término de PowerPoint para convertirse en realidad de producción. Según Stack Overflow Developer Survey 2025, el 43% de los desarrollos de e-commerce empresarial ha realizado la transición de plataformas monolíticas a arquitectura MACH (Microservicios, API-first, Cloud-native, Headless). Sin embargo, las decisiones entre BigCommerce, commercetools y Shopify Plus siguen basándose en trade-offs no medibles — argumentos como "headless es más moderno" en lugar de datos reales. En este artículo comparamos tres proveedores principales en escenarios de producción: tiempos de respuesta de API, ergonomía del desarrollador, costo de runtime, latencia multi-región. Toma tu decisión basándote en stack tracing, no en demos de ventas.

## Qué Significa Realmente la Arquitectura MACH

El acrónimo MACH fue definido en 2020 por MACH Alliance, pero su uso cotidiano es confuso. En la práctica, MACH significa que la lógica de comercio backend (precios, inventario, pedidos) se expone a través de APIs, y el frontend se despliega completamente por separado (Vercel, Netlify, Cloudflare Pages). Esta separación permite cambios en el frontend para A/B testing sin vincularlos a un release del backend.

Pero esta fragmentación arquitectónica tiene costos. En un Magento monolítico, `$product->getPrice()` es una llamada a función; en headless, se convierte en una solicitud REST o GraphQL. Agrega latencia de red. Ejemplo: la API Storefront de Shopify (GraphQL) promedia 120ms de tiempo de respuesta (miss de cache en CDN, desde Europa a instancia de América del Norte). Según la documentación de commercetools, la latencia P95 es de 180ms (en deployment global). Si colocas estos números en server-side rendering (SSR) frontend, cada render de página lleva 120-180ms de overhead de red.

El segundo trade-off es la orquestación. En MACH, si Stripe payments, Algolia search, Contentful CMS y Klaviyo retention son servicios separados, coordinarlos en el checkout flow es tu responsabilidad. En plataformas monolíticas, el proveedor ha resuelto estas integraciones. Ejemplo: Shopify Plus ofrece Shopify Flow con automatización incorporada — enviar un evento a Klaviyo cuando llega un pedido no requiere código. En commercetools, escribes esta orquestación tú mismo (por ejemplo, AWS EventBridge + Lambda).

## BigCommerce: Los Trade-offs del Enfoque Híbrido

BigCommerce ofrece una versión de "aterrizaje suave" del comercio componible. La plataforma admite uso headless pero también permite desarrollo monolítico con su motor de temas Stencil (basado en Handlebars). Esta flexibilidad es tanto ventaja como trampa.

Ventaja: en la fase inicial, puedes comenzar customizando solo Stencil sin desplegar un frontend headless, haciendo una transición gradual después. Ejemplo: mantener el checkout en Stencil mientras trasladas la homepage y el listado de productos a Next.js. La API GraphQL Storefront de BigCommerce proporciona acceso a todas las entidades (product, category, cart, customer). Si definiste anchors, el frontend no tendrá sorpresas.

Trampa: esta flexibilidad crea un pipeline de deployment complejo. Si mantienes tanto un tema Stencil como un frontend Next.js, cualquier cambio de feature requiere dos deployments. Ejemplo de escenario: quieres añadir un indicador de umbral de inventario — actualizas tanto el template Stencil como tu API route de Next.js. Tu CI/CD debe construir dos artefactos.

Performance de API: la API GraphQL de BigCommerce tiene latencia P50 de 95ms (US-East), P99 de 250ms (datos de BigCommerce Status Page 2025). La API REST es más rápida (P50 60ms) pero menos flexible que GraphQL. Si necesitas recuperar información de variantes en un listado de productos, REST sufre del problema N+1 (una solicitud por producto por variante). Con GraphQL, obtienes campos anidados en una sola query:

```graphql
query ProductsWithVariants {
  site {
    products(first: 20) {
      edges {
        node {
          name
          prices {
            price {
              value
            }
          }
          variants {
            edges {
              node {
                sku
                inventory {
                  isInStock
                }
              }
            }
          }
        }
      }
    }
  }
}
```

Esta query tarda 140ms (miss de cache, single-region). Con REST, los mismos datos requieren 20 requests de productos + 20 requests de variantes = 1.2s.

Deployment multi-región: BigCommerce es SaaS; no seleccionas la instancia. Si tu tienda está en un datacenter US, el tráfico de Asia tiene 220ms+ de latencia. El caching en edge (Cloudflare) lo enmascara parcialmente, pero las mutaciones de carrito (POST /cart/items) no se pueden cachear — siempre van al origen.

## commercetools: El Costo Operacional del Composable Puro

commercetools es la forma "pura" de la arquitectura MACH — sin frontend, sin tema incorporado. Solo APIs. Incluso el Merchant Center (UI admin) es un SPA que funciona sobre la API REST. Este enfoque proporciona flexibilidad máxima pero conlleva overhead operacional máximo.

Diseño de API: la API REST de commercetools se basa en HTTP/2, resource-oriented. Cada entidad (product, cart, order, customer) tiene su propio endpoint. El soporte GraphQL está en beta (a partir de Q4 2025, no es production-ready). Ejemplo: añadir un artículo al carrito:

```bash
POST https://api.europe-west1.gcp.commercetools.com/{project-key}/carts/{cart-id}
Authorization: Bearer {token}

{
  "version": 3,
  "actions": [
    {
      "action": "addLineItem",
      "productId": "abc123",
      "variantId": 1,
      "quantity": 2
    }
  ]
}
```

Esta solicitud retorna P50 85ms, P95 180ms (desde GCP europe-west1). Pero atención: el field `version` es obligatorio para el locking optimista. Debes enviar la versión actual del carrito en cada solicitud; de lo contrario, obtendrás un 409 Conflict. Esto requiere lógica de reintentos en escenarios de checkout concurrente.

Costo operacional: el pricing de commercetools se basa en llamadas API. Después de los primeros 50 millones de llamadas/año, comienza el cobro ($0.0003/llamada). Cálculo de ejemplo: un sitio con 1 millón de sesiones mensuales que realiza un promedio de 15 llamadas API por sesión (listado de productos, detalle del producto, mutaciones del carrito, checkout), 180 millones de llamadas anuales = 130 millones de llamadas facturables = $39,000 en costo de API. Este es un costo adicional además de la infraestructura. Con BigCommerce, este costo está integrado en el pricing SaaS.

Multi-región: commercetools ofrece deployment multi-región en GCP y AWS. Seleccionas una región para tu proyecto: `europe-west1` o `us-central1`. No hay replicación cross-region — eliges una única región. En e-commerce global, esto significa latencia. Solución: en una [arquitectura de Comercio Headless](https://www.roibase.com.tr/es/headless), renderizar el frontend en edge (Cloudflare Workers, Vercel Edge Functions) y poner la API de commercetools detrás de una capa de cache. Ejemplo de arquitectura: cachear el catálogo de productos en Cloudflare KV (TTL 60s), enviar mutaciones de carrito siempre al origen. El listado de productos se retorna desde edge en 40ms, la operación del carrito tarda 180ms (viaje al origen).

## Shopify Plus: Capa Headless sobre Raíz Monolítica

Shopify Plus usa el término "headless" en lugar de "componible", pero debajo hay una plataforma monolítica. Con Hydrogen (framework basado en React) y Storefront API, puedes crear un frontend headless, pero el checkout y admin están completamente bajo el control de Shopify. Este modelo híbrido acelera a equipos pequeños pero limita a equipos grandes.

Storefront API: solo GraphQL, con límite de velocidad basado en costo (complejidad de query). Ejemplo: cada GraphQL query tiene un valor de "costo" (una query simple de producto = 5 puntos, query anidada con variantes + metafields = 15 puntos). Cuota por tienda: 1000 puntos por segundo (Shopify Plus). Si una homepage que lista 50 productos usa una query de 250 puntos, puedes renderizar 4 homepages por segundo. En picos de tráfico, alcanzarás el límite de velocidad (error 429).

Framework Hydrogen: es el framework oficial de React de Shopify, construido sobre Remix. La versión anterior (Hydrogen v1) usaba Vite; la nueva (Hydrogen v2) utiliza el file-based routing de Remix. Cliente API Shopify incorporado, gestión de carrito, routing i18n. Dentro de [Servicios para Socios Shopify](https://www.roibase.com.tr/es/shopify), usamos Hydrogen en proyectos porque reduce el boilerplate: la gestión del estado del carrito, el redirect al checkout, la autenticación de API vienen listos en Hydrogen.

Ejemplo de ruta Hydrogen:

```typescript
// app/routes/products.$handle.tsx
import {useLoaderData} from '@remix-run/react';
import {json} from '@shopify/remix-oxygen';

export async function loader({params, context}) {
  const {product} = await context.storefront.query(PRODUCT_QUERY, {
    variables: {handle: params.handle},
  });
  return json({product});
}

export default function Product() {
  const {product} = useLoaderData<typeof loader>();
  return <div>{product.title}</div>;
}

const PRODUCT_QUERY = `#graphql
  query Product($handle: String!) {
    product(handle: $handle) {
      id
      title
      priceRange {
        minVariantPrice {
          amount
        }
      }
    }
  }
`;
```

Cuando esta ruta se despliega en Oxygen (plataforma edge de Shopify), la latencia global promedio es de 90ms (Shopify Performance Dashboard 2025). Sin embargo, el deployment en Oxygen solo está abierto a clientes Shopify Plus; en planes estándar, debes desplegar en Vercel, pero la cuota de Storefront API sigue siendo la misma.

Trade-off: el checkout no se puede personalizar. La página de checkout de Shopify se renderiza en servidores de Shopify, separada del frontend headless. Si necesitas mostrar un sistema de puntos de lealtad personalizado en checkout, usas Shopify Scripts (basado en Liquid) o Checkout UI Extensions (componentes React con API limitada). En commercetools, construyes el checkout completamente.

## Matriz de Decisión: Qué Usar en Cada Escenario

Comparemos los tres proveedores en métricas concretas:

| Métrica | BigCommerce | commercetools | Shopify Plus |
|---------|-------------|---------------|--------------|
| Latencia P50 de API | 95ms (GraphQL) | 85ms (REST) | 120ms (GraphQL) |
| Multi-región | Controlado por proveedor (US/EU) | Regional GCP/AWS | Edge global (Oxygen) |
| Onboarding de desarrollador | Medio (Stencil + Next.js) | Alto (API pura) | Bajo (Hydrogen) |
| Control del checkout | Control total | Control total | Limitado (checkout Shopify) |
| Costo mensual de API (1M sesiones) | Incluido en SaaS | ~$3,250 | Incluido en SaaS |
| Características incorporadas | Medio (POS, B2B) | Bajo (solo API) | Alto (Flow, Scripts) |

Recomendación por escenario:

**Elige BigCommerce si:** tienes complejidad B2B (gestión de quotes, grupos de clientes), no necesitas una transición rápida a headless pero quieres mantener la opción abierta en el futuro. Si usas multi-tienda (diferentes marcas en un backend).

**Elige commercetools si:** quieres propiedad total (checkout incluido, todo custom), tienes una infraestructura API-first (app móvil + web + POS alimentados desde la misma API), o si tienes 100M+ sesiones/año (donde la estrategia de cache puede optimizar costos API).

**Elige Shopify Plus si:** tu equipo de desarrollo es pequeño (2-4 desarrolladores), no necesitas personalizar el checkout, y quieres aprovechar las integraciones del App Store de Shopify (Klaviyo, Yotpo, Gorgias tienen conectores incorporados).

## El Costo Oculto del Comercio Componible: Orquestación

La elección de proveedor oculta la dificultad que comienza después del deployment: orquestación. En MACH, un checkout flow requiere una cadena como esta:

1. Frontend (Next.js) → Storefront API (producto/carrito)
2. Gateway de pago (Stripe/Adyen) → Backend orchestrator
3. OMS (Order Management) → commercetools/BigCommerce
4. Email (Klaviyo/SendGrid) → Datos del cliente
5. Sincronización de inventario (ERP) → Actualización de stock

Si un eslabón falla (por ejemplo, Stripe webhook llega 5 segundos tarde), la experiencia del cliente se ve afectada. En una plataforma monolítica (como Magento), este flow se resuelve dentro del proveedor. En componible, escribes el código de orquestación tú mismo.

Ejemplo de orquestación (pseudo-código):

```javascript
async function handleCheckout(cartId, paymentToken) {
  const cart = await commercetools.getCart(cartId);
  const paymentResult = await stripe.capturePayment(paymentToken, cart.total);
  
  if (paymentResult.status === 'succeeded') {
    const order = await commercetools.createOrder(cartId);
    await klaviyo.trackEvent('Order Placed', { orderId: order.id });
    await oms.syncOrder(order);
    return { success: true, orderId: order.id };
  } else {
    // Lógica de reintentos, manejo de errores, idempotencia
    throw new CheckoutError('Payment failed');
  }
}
```

Este código parece simple, pero en production debes manejar estos edge cases:

- Stripe exitoso pero commercetools falla