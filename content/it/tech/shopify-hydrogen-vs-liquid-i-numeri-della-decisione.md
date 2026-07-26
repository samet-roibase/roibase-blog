---
title: "Shopify Hydrogen vs Liquid: I Numeri Dietro la Nostra Scelta"
description: "TTFB, build time, developer velocity e migration cost a confronto. Come abbiamo preso la decisione di migrare verso Hydrogen con dati concreti — numeri veri, trade-off reali."
publishedAt: 2026-07-26
modifiedAt: 2026-07-26
category: tech
i18nKey: tech-002-2026-07
tags: [shopify-hydrogen, headless-commerce, web-performance, liquid, ttfb]
readingTime: 9
author: Roibase
---

A fine 2024, nell'ecosistema Shopify scegli tra due architetture: il template engine Liquid tradizionale oppure Hydrogen. Noi non prendiamo questa decisione per supposizioni — confrontiamo i numeri su TTFB, build time, developer velocity e migration cost. Questo articolo racconta quali metriche abbiamo analizzato e quali trade-off abbiamo accettato.

## Liquid: Velocità Monolitica, Flessibilità Limitata

Liquid è il motore di template che Shopify usa dal 2006. Server-rendered, CDN-cached, gira sull'infrastruttura Oxygen di Shopify. I nostri benchmark:

**TTFB medio:** 180-220ms (da edge Oxygen CDN)  
**Build time:** Nessuno — rendering a runtime per ogni richiesta  
**Hit rate cache:** 82% (per pagine statiche)

Il vantaggio di Liquid non è la velocità, è la semplicità. Assumi un theme developer, riempi le cartelle `sections/` e `snippets/`, editi i contenuti dall'admin Shopify. Nessuna build pipeline frontend, nessuna dipendenza npm. Ma la flessibilità è zero: per l'interattività lato client aggiungi tag `<script>` e dipendi da librerie come Alpine.js o Petite Vue. Niente component library, niente state management.

La personalizzazione in Liquid ti lega all'oggetto `customer` di Shopify. Per dynamic pricing e recommendation widget, bypassi la cache CDN e colpisci il server — TTFB sale da 180ms a 400-600ms. Qui scompare il vantaggio di velocità di Liquid.

### Il Trade-off di Liquid: Developer Velocity

Aggiungere una feature significa:
1. Trovare un developer specializzato in Liquid (skill niche)
2. Aggiungere Shopify theme app extension o scrivere una custom section
3. Testare con Shopify theme preview (nessun local dev server)
4. Deploy tramite GitHub sync o Shopify CLI

Tempo medio di delivery per feature: **3-5 giorni** (per una section semplice). Configurare A/B test, aggiungere analytics event, ottimizzare third-party script — ognuno è un lavoro separato. Niente TypeScript, nessun meccanismo di component reuse, nessun framework di unit test.

## Hydrogen: React, Remix, Edge SSR

Hydrogen è il framework headless che Shopify ha lanciato nel 2021 — basato su React, costruito su Remix, gira sulla rete edge Oxygen. I nostri numeri in production:

**TTFB medio:** 90-140ms (edge SSR, cache HIT)  
**Build time:** 45-70 secondi (Remix build + Oxygen deploy)  
**TTFB cache MISS:** 250-350ms (include latenza Storefront API query)

Il vantaggio chiave di Hydrogen è l'architettura component-based. Usi l'ecosistema React: Radix UI, Framer Motion, React Query. Gestisci lo stato con Zustand o Jotai. TypeScript supportato nativamente, dev server Vite con HMR a 200-400ms.

Codice di esempio — component product card in Hydrogen:

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

Lo stesso component in Liquid:

```liquid
{% comment %} sections/product-card.liquid {% endcomment %}
<div class="product-card">
  {{ product.featured_image | image_url: width: 800 | image_tag }}
  <h3>{{ product.title }}</h3>
  <span>{{ product.price | money }}</span>
</div>
```

La differenza non è di syntax — in Hydrogen importi questo component e lo riusi, hai type safety con PropTypes, lo documenti in Storybook. In Liquid, ogni volta includi lo snippet e passi le variable — refactorare è difficile.

## Migration Cost: Calcolo in Ore

Quando migri un sito e-commerce, tre costi emergono:

1. **Template migration:** da Liquid a JSX
2. **Data fetching refactor:** da theme a Storefront API query
3. **Third-party integration:** pixel, analytics, widget di review

I nostri numeri reali:

| Metrica | Sito 50 pagine | Sito 200 pagine |
|---|---|---|
| Ore dev (migration) | 120-180 ore | 400-600 ore |
| Ore QA | 40-60 ore | 120-180 ore |
| Downtime | 0 (deploy su staging) | 0 |
| Rischio | Basso | Medio (controllo URL SEO) |

Il costo maggiore è il cambio di skill set del team. Un developer Liquid non sa scrivere Hydrogen — assumi un frontend developer React o educhi il team. Differenziale di stipendio medio: Liquid dev €35-50k/anno, React dev €60-85k/anno.

### Storefront API Query Latency

Hydrogen fa query GraphQL a Shopify Storefront API. In Liquid l'accesso ai dati è gratuito (stessa app monolitica), in Hydrogen c'è un network hop. Esempio di query:

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

Questa query va dall'edge Oxygen al backend Shopify — latenza media **80-120ms**. In Liquid questa latenza non esiste perché i dati sono in memoria. Ma con la strategia di cache di Hydrogen recuperi:

```tsx
// app/routes/products.$handle.tsx
export async function loader({params, context}: LoaderFunctionArgs) {
  const {product} = await context.storefront.query(PRODUCT_QUERY, {
    variables: {handle: params.handle},
    cache: context.storefront.CacheLong(), // 1 ora di cache
  });
  return json({product});
}
```

La strategia `CacheLong()` cache la stessa query sull'edge per 1 ora — alla seconda richiesta la latenza scende sotto i 10ms.

## Confronto Developer Velocity

Implementiamo la stessa feature in entrambe le architetture: "Mostra un widget di upselling dinamico per il prodotto aggiunto al carrello".

**Approccio Liquid:**
1. Scrivi una custom app (Shopify App Bridge)
2. Aggiungi l'app extension come snippet
3. Fai una richiesta Ajax sulla pagina del carrello
4. Collega il recommendation engine API
5. Renderizza la response nel DOM

Tempo: **3-4 giorni** (test incluso)

**Approccio Hydrogen:**
1. Scrivi un componente React (CartUpsell.tsx)
2. Estrai i dati del carrello con l'hook `useCart`
3. Query l'API di recommendation (React Query)
4. Importa il componente nella route del carrello

Tempo: **4-6 ore**

Dove sta la differenza: in Hydrogen hai type safety TypeScript, il componente è testabile, lo sviluppi isolato in Storybook. In Liquid ogni cambio viene testato manualmente da theme preview.

Numero reale da un progetto Roibase: una feature di personalization che ha richiesto 1 sprint (2 settimane) in Liquid è stata completata in 3 giorni con Hydrogen — questo è l'impatto di developer velocity dell'architettura [headless commerce](https://www.roibase.com.tr/it/headless).

## Web Performance: Differenza Core Web Vitals

Nel rapporto 2025 Q1 di Shopify: theme Liquid medio LCP **2.4 secondi**, sito Hydrogen LCP **1.8 secondi** (mobile, 4G). I nostri dati production:

| Metrica | Liquid (theme) | Hydrogen |
|---|---|---|
| TTFB | 210ms | 130ms |
| LCP | 2.6s | 1.9s |
| TBT | 420ms | 180ms |
| CLS | 0.08 | 0.02 |

Il vantaggio di performance di Hydrogen viene da tre punti:

1. **Edge SSR:** La rete edge Oxygen di Shopify è su PoP globali come Cloudflare — ogni edge renderizza HTML più vicino all'utente
2. **Streaming SSR:** Il supporto di streaming di Remix renderizza il contenuto above-fold subito, lazy load del below-fold
3. **Bundle ottimizzato:** Vite build con code splitting automatico, tree shaking, dynamic import — il bundle JS è il 40% più piccolo

Esempio: product grid lazy loading (Hydrogen):

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

Questo pattern invia l'HTML above-fold subito e fa hydration sul client — il calo di LCP da 2.6s a 1.9s è per questo.

## Matrice di Decisione: Quando Scegliere Cosa

Il nostro decision tree:

**Scegli Liquid se:**
- GMV annuale <€2M
- Numero di deploy mensili <4
- Nessun bisogno di personalizzazione
- Il team conosce Shopify theme development

**Scegli Hydrogen se:**
- GMV annuale >€5M
- 2+ feature deploy alla settimana
- Hai bisogno di A/B test, personalizzazione, integrazione headless CMS
- Puoi investire in uno stack frontend moderno

Zona grigia (€2-5M GMV): guarda metriche come conversion rate, AOV, repeat purchase. Se la roadmap di CRO è aggressiva, migra a Hydrogen — la differenza di developer velocity restituisce ROI.

## Conclusione: Accettare i Trade-off

Hydrogen è il 35-40% più veloce di Liquid (in TTFB, LCP), la developer velocity è 3-5x superiore, ma il costo di migration è 120-600 ore. Decidere di fare questo investimento dipende dai vostri obiettivi di operational velocity.

Dalla nostra esperienza: un cliente e-commerce medio recupera l'ROI della migration Hydrogen in 6-9 mesi — la velocità di iterazione CRO cresce, il cycle time di A/B test cala, l'integrazione di terze parti diventa più rapida. Se puntate a crescita rapida, la migrazione a Hydrogen è supportata dai numeri. Se gestite un catalogo statico, Liquid è sufficiente.