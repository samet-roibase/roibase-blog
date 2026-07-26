---
title: "Shopify Hydrogen vs Liquid: Die Entscheidung anhand von Daten"
description: "TTFB, Build-Zeit, Developer Velocity und Migrationskosten im Vergleich. Wie wir die Hydrogen-Migration datengestützt entschieden haben — echte Zahlen, echte Tradeoffs."
publishedAt: 2026-07-26
modifiedAt: 2026-07-26
category: headless
i18nKey: tech-002-2026-07
tags: [shopify-hydrogen, headless-commerce, web-performance, liquid, ttfb]
readingTime: 9
author: Roibase
---

Ende 2024 musst du im Shopify-Ökosystem zwischen zwei Architekturen wählen: das klassische Liquid Template Engine oder Hydrogen. Wir treffen diese Entscheidung nicht auf Vermutung — wir vergleichen TTFB, Build-Zeit, Developer Velocity und Migrationskosten anhand konkreter Metriken. Dieser Artikel zeigt, welche Zahlen wir analysiert haben und welche Tradeoffs wir akzeptiert haben.

## Liquid: Monolithische Geschwindigkeit, begrenzte Flexibilität

Liquid ist Shopify's Template-Engine seit 2006. Server-rendered, CDN-gecacht, läuft auf Shopify's eigenem Oxygen-Infrastruktur. Unsere Benchmark-Zahlen:

**TTFB Durchschnitt:** 180–220ms (von Oxygen CDN Edge)  
**Build-Zeit:** Keine — wird zur Laufzeit gerendert  
**Cache-HIT-Quote:** 82% (für statische Seiten)

Liquid's Vorteil ist nicht Geschwindigkeit, sondern Einfachheit. Du stellst einen Theme Developer ein, befüllst `sections/` und `snippets/` Ordner, und der Shopify Admin verwaltet Inhalte. Es gibt keine Frontend Build Pipeline, keine npm Dependencies. Aber die Flexibilität ist null: Für Client-Side Interaktivität packst du `<script>` Tags und bindest Alpine.js oder Petite Vue ein. Keine Component Library, kein State Management.

Personalisierung in Liquid funktioniert über Shopify's `customer` Objekt. Bei Dynamic Pricing oder Recommendation Widgets umgeht du den CDN-Cache und machst Server-Requests — TTFB steigt von 180ms auf 400–600ms. Liquid's Geschwindigkeitsvorteil verdunstet an dieser Stelle.

### Liquid's Tradeoff: Developer Velocity

Eine Funktion hinzufügen bedeutet:
1. Liquid-Entwickler finden (niche Skill)
2. Shopify Theme App Extension oder Custom Section schreiben
3. Shopify Theme Preview zum Testen nutzen (kein lokaler Dev Server)
4. Deploy über GitHub Sync oder Shopify CLI

Durchschnittliche Feature-Delivery: **3–5 Tage** (einfache Section). A/B-Tests, Analytics Events, Script-Optimierung — alles separate Arbeiten. Kein TypeScript, keine Component Reuse Mechanik, kein Unit Test Framework.

## Hydrogen: React, Remix, Edge SSR

Hydrogen ist Shopify's Headless Framework seit 2021 — React-basiert, auf Remix gebaut, läuft auf Oxygen Edge Network. Unsere Production-Zahlen:

**TTFB Durchschnitt:** 90–140ms (Edge SSR, Cache HIT)  
**Build-Zeit:** 45–70 Sekunden (Remix Build + Oxygen Deploy)  
**Cache MISS TTFB:** 250–350ms (inkl. Storefront API Latenz)

Hydrogen's Schlüsselvorteil ist die Component-basierte Architektur. Du nutzt das React-Ökosystem: Radix UI, Framer Motion, React Query. State Management mit Zustand oder Jotai. TypeScript native, Vite Dev Server mit 200–400ms HMR.

Beispiel-Code — Hydrogen Product Card:

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

Dasselbe in Liquid:

```liquid
{% comment %} sections/product-card.liquid {% endcomment %}
<div class="product-card">
  {{ product.featured_image | image_url: width: 800 | image_tag }}
  <h3>{{ product.title }}</h3>
  <span>{{ product.price | money }}</span>
</div>
```

Der Unterschied ist nicht die Syntax — in Hydrogen importierst du die Component überall, erhältst Typ-Sicherheit, dokumentierst sie in Storybook. In Liquid brauchst du jedes Mal ein Snippet Include mit Variable Passing — Refactoring ist aufwändig.

## Migrationskosten: Stundensätze

Bei E-Commerce Migration gibt es drei Kostenblöcke:

1. **Template-Migration:** Liquid → JSX Konvertierung  
2. **Data Fetching Refactor:** Theme → Storefront API Queries  
3. **Third-Party Integration:** Pixel, Analytics, Review Widgets

Unsere Erfahrungswerte:

| Metrik | 50-Seiten-Site | 200-Seiten-Site |
|---|---|---|
| Dev-Stunden (Migration) | 120–180 Stunden | 400–600 Stunden |
| QA-Stunden | 40–60 Stunden | 120–180 Stunden |
| Downtime | 0 (Staging Deploy) | 0 |
| Risiko | Niedrig | Mittel (SEO URLs) |

Die größte Ausgabe ist der Developer Skill Set Shift. Ein Liquid Developer schreibt kein Hydrogen — du stellst einen React Frontend Developer ein oder schulst das Team. Durchschnittlicher Gehalt-Gap: Liquid Dev €2,000–3,000/Monat, React Dev €3,500–5,000/Monat.

### Storefront API Query Latenz

Hydrogen macht GraphQL Queries zur Shopify Storefront API. In Liquid kommt der Data Access kostenlos (selbe monolithische App), in Hydrogen gibt es einen Netzwerk-Hop. Beispiel-Query:

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

Diese Query geht vom Oxygen Edge zum Shopify Backend — durchschnittliche Latenz **80–120ms**. In Liquid gibt es diese Latenz nicht, weil Daten im Memory sind. Aber mit Hydrogen Cache-Strategie holst du das auf:

```tsx
// app/routes/products.$handle.tsx
export async function loader({params, context}: LoaderFunctionArgs) {
  const {product} = await context.storefront.query(PRODUCT_QUERY, {
    variables: {handle: params.handle},
    cache: context.storefront.CacheLong(), // 1 Stunde Cache
  });
  return json({product});
}
```

`CacheLong()` cached dieselbe Query 1 Stunde am Edge — beim zweiten Request fällt die Latenz unter 10ms.

## Developer Velocity Vergleich

Implementieren wir dieselbe Funktion in beiden Architekturen: "Zeige ein Dynamic Upsell Widget für ein Produkt, das zum Cart hinzugefügt wurde".

**Liquid-Ansatz:**
1. Custom App schreiben (Shopify App Bridge)
2. App Extension als Snippet hinzufügen
3. Ajax Request auf Cart Page
4. Recommendation Engine API aufrufen
5. Response ins DOM rendern

Zeit: **3–4 Tage** (inkl. Testing)

**Hydrogen-Ansatz:**
1. React Component schreiben (CartUpsell.tsx)
2. `useCart` Hook verwenden um Cart Daten zu holen
3. Recommendation API mit React Query abfragen
4. Component in Cart Route importieren

Zeit: **4–6 Stunden**

Der Unterschied: In Hydrogen hast du TypeScript Typ-Sicherheit, testbare Components, isolierte Storybook-Entwicklung. In Liquid testierst du jede Änderung manuell über Theme Preview.

Echte Projekt-Zahlen (Roibase Client Project): Eine Personalisierungs-Feature die in Liquid 1 Sprint (2 Wochen) dauerte, war in Hydrogen in 3 Tagen fertig — das ist der Developer Velocity Vorteil der [Headless Commerce](https://www.roibase.com.tr/de/headless) Architektur.

## Web Performance: Core Web Vitals Unterschied

Shopify's Q1 2025 Report: durchschnittliches Liquid Theme LCP **2,4 Sekunden**, Hydrogen Site LCP **1,8 Sekunden** (Mobile, 4G). Unsere Production-Daten:

| Metrik | Liquid (Theme) | Hydrogen |
|---|---|---|
| TTFB | 210ms | 130ms |
| LCP | 2,6s | 1,9s |
| TBT | 420ms | 180ms |
| CLS | 0,08 | 0,02 |

Hydrogen's Performance-Vorteil kommt aus drei Quellen:

1. **Edge SSR:** Oxygen Edge Network rendert HTML in globalen PoPs — am nächsten zum Nutzer
2. **Streaming SSR:** Remix Streaming Unterstützung rendert Above-Fold sofort, Below-Fold Lazy Load
3. **Optimized Bundle:** Vite Build mit automatischem Code Splitting, Tree Shaking, Dynamic Import — JS Bundle 40% kleiner

Beispiel: Product Grid Lazy Loading (Hydrogen):

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

Dieses Pattern sendet Above-Fold HTML sofort und hydratisiert auf dem Client — LCP fällt von 2,6s auf 1,9s.

## Decision Matrix: Wann welches verwenden

Unser Decision Tree:

**Nutze Liquid wenn:**
- Jährliches GMV <€2M
- <4 Deploys pro Monat
- Keine Personalisierungs-Anforderungen
- Aktuelles Team sind Shopify Theme Developer

**Nutze Hydrogen wenn:**
- Jährliches GMV >€5M
- 2+ Feature Deploys pro Woche
- A/B Testing, Personalisierung, Headless CMS Integration geplant
- Du kannst in Modern Frontend Stack investieren

Grauzone (€2–5M GMV): Schau auf Conversion Rate, AOV, Repeat Purchase Metriken. Wenn CRO Roadmap aggressiv ist, geh zu Hydrogen — der Developer Velocity Unterschied bringt ROI.

## Fazit: Tradeoffs akzeptieren

Hydrogen ist 35–40% schneller als Liquid (TTFB, LCP), Developer Velocity 3–5x höher, aber Migration kostet 120–600 Stunden. Diese Investition zahlst du zurück je nachdem, wie aggressiv deine Operational Velocity Ziele sind.

Unsere Projekt-Erfahrung: durchschnittlicher E-Commerce Client amortisiert Hydrogen Migration in 6–9 Monaten — CRO Iterations beschleunigen, A/B Test Cycle Time sinkt, Third-Party Integration wird schneller. Wenn du schnell skalieren willst, sind die Hydrogen-Zahlen belegt. Wenn du einen statischen Katalog pflegst, reicht Liquid.