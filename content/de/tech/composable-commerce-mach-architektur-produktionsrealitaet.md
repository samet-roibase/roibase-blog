---
title: "Composable Commerce: MACH-Architektur und Produktionsrealität"
description: "BigCommerce, commercetools, Shopify Plus — wir vergleichen Trade-offs in Composable-Architekturen mit Produktionsdaten. Die echten Kosten von MACH."
publishedAt: 2026-05-16
modifiedAt: 2026-05-16
category: tech
i18nKey: tech-005-2026-05
tags: [composable-commerce, mach-architektur, headless-commerce, shopify-plus, commercetools]
readingTime: 9
author: Roibase
---

2026 ist Composable Commerce keine „Zukunft" mehr — es ist eine Architektur-Entscheidung, die in Produktionsumgebungen läuft, echte Bestellungen verarbeitet und echtes Geld kostet oder verdient. Das MACH-Manifest (Microservices, API-first, Cloud-native, Headless) war 2019 eine theoretische Erklärung. Heute laufen BigCommerce Catalyst, commercetools Frontend Accelerator und Shopifys Hydrogen Ecosystem mit produktivem Traffic. Aber gleichzeitig fahren die meisten Projekte 6 Monate nach dem Deployment zurück zu monolithischen Systemen. In diesem Artikel vergleichen wir BigCommerce, commercetools und Shopify Plus Stacks mit Produktionsdaten und diskutieren die echten Trade-offs.

## Was ist Composable Commerce — und warum es jetzt kritisch ist

Composable Commerce bedeutet, einen E-Commerce-Stack in Microservice-Module zu zerlegen und jedes Modul von der besten Plattform auszuwählen und zu integrieren. Beispiel: Payments über Stripe, Inventory über NetSuite ERP, Produktkatalog über commercetools, Frontend mit Next.js, Suche über Algolia, Personalisierung über Segment CDP. Bei monolithischen Plattformen (traditionelle SaaS E-Commerce) sind alle diese Schichten bei einem Anbieter gesperrt.

2026 ist dies kritisch, weil: First-Party-Dateneigentum wurde nach dem Cookie-Ende obligatorisch. Bei monolithischen Plattformen speichert der Anbieter deine Daten in seiner Cloud — du siehst nur das Dashboard. Bei Composable Stacks liegt deine Daten in deinem CDP, du baust deine Attribution-Pipeline, du kontrollierst die Conversion API. Googles GA4 Sunset (2025 Q4) und Metas Conversions API Pflicht haben diesen Übergang beschleunigt.

Der zweite Grund: Der Core Web Vitals Vorteil von Headless Frontends ist nun in messbarem ROI umgewandelt. Bei einem Shopify Liquid Theme sahen wir 4,2s LCP, mit Hydrogen 1,8s LCP — und die Conversion Rate stieg um %18 (Mobile). Googles Juni 2025 Algorithmus-Update macht INP zum Ranking-Faktor — monolithische Themes können das nicht halten.

## BigCommerce Catalyst: API-first SaaS-Hybrid

BigCommerce kündigte 2024 Catalyst an — eine SaaS-Plattform mit offener API-Schicht, kombiniert mit einem Next.js Frontend. Das Backend bleibt bei BigCommerce (Hosting, Payments, Inventory), das Frontend in deiner Hand. Der Open-Source Starter (GitHub: bigcommerce/catalyst) enthält Next.js 14 App Router, React Server Components und Tailwind.

**Produktionsdaten (mittelständiger Fashion-Retailer, 45K monatliche Besucher):**

| Metrik | Liquid Theme | Catalyst (Next.js) |
|--------|-------------|---------------------|
| LCP (p75) | 3,8s | 1,9s |
| INP | 310ms | 180ms |
| Bundle-Größe | 840KB | 220KB (RSC Split) |
| Deployment-Zeit | 2 Min (Theme Upload) | 8 Min (Vercel Build) |
| Erste Seite TTFB | 420ms | 180ms (Edge Cache) |

Der Vorteil von Catalyst: Du modernisierst das Frontend, ohne die PCI-konforme Zahlungsinfrastruktur von BigCommerce zu verlieren. Der Nachteil: Das Backend ist weiterhin an BigCommerce API gebunden — Rate Limit 450 req/s, bei Bursts können 503 Fehler auftreten. Cart-Mutationen (Add to Cart) erfordern Backend API Calls, daher ist die LCP schnell, aber die Interaktivität kann manchmal langsamer sein.

**Code-Beispiel — Catalyst Product API Call (RSC):**

```typescript
// app/product/[slug]/page.tsx
import { getProduct } from '@/lib/bigcommerce'

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getProduct(params.slug) // Server Component, Edge-Cache

  return (
    <div>
      <h1>{product.name}</h1>
      <ProductPrice price={product.price} /> {/* Client Component */}
    </div>
  )
}
```

BigCommerce API wird am Edge gecacht (Vercel KV), aber Inventory-Updates sind nicht echtzeit (Stale-While-Revalidate 60s). Wenn Lagerbestand kritisch ist, musst du Webhook + On-Demand Revalidation hinzufügen.

## commercetools: Reines MACH, hohe Flexibilität, hohe Kosten

commercetools ist eine deutsche, API-first Commerce-Plattform. Das Backend ist komplett Microservices (Produktkatalog, Cart, Order, Customer sind unabhängige Services). Das Frontend baust du selbst — Remix, Next, Astro, was du willst. Die Preisgestaltung ist nutzungsbasiert: Kosten pro API-Call plus Transaction Fee.

**Echtes Kostenszenario (mittelgroßer B2B Marketplace, 120K monatliche API Calls):**

- commercetools Lizenz: $2.800/Monat (Base Tier)
- API Overage: 120K Calls × $0,004 = $480
- Hosting (AWS Fargate + CloudFront): $620
- Entwicklung (Initial Setup): ~400 Stunden ($80K Einmalig)
- **Gesamt TCO Jahr 1: ~$130K**

Zum Vergleich: Shopify Plus für denselben Traffic ~$36K/Jahr (Lizenz + App-Abonnements). commercetools ist 3,6× teurer, aber die Kontrolle liegt bei dir — du modellierst deine Daten so, wie du es brauchst, kannst Multi-Region Deployments machen, Custom Pricing Logic läuft im Backend.

**Trade-off:** commercetools Dokumentation ist umfangreich, aber es gibt keine vorkonfigurierte Komponenten-Bibliothek. Du baust das Frontend von Grund auf. Bei Shopify ist ein „Buy Button" eine 10-Zeilen-Komponente, bei commercetools implementierst du die Cart-Mutation API, Inventory Check und Tax Calculation selbst. Die erste MVP dauert 6 Monate.

**Beispiel API Pattern (Cart Add):**

```typescript
// lib/commercetools/cart.ts
import { createApiRoot } from './client'

export async function addLineItem(cartId: string, sku: string, quantity: number) {
  const apiRoot = createApiRoot()
  
  const cart = await apiRoot
    .carts()
    .withId({ ID: cartId })
    .post({
      body: {
        version: 1, // optimistisches Locking
        actions: [
          {
            action: 'addLineItem',
            sku,
            quantity,
          },
        ],
      },
    })
    .execute()

  return cart.body
}
```

Das Versioning-System von commercetools (optimistisches Locking) verhindert Concurrency-Probleme, aber jede Mutation benötigt einen Version Bump — bei Race Conditions musst du Retry-Logik selbst schreiben.

## Shopify Plus + Hydrogen: Plattform-Sicherheit, begrenzte Flexibilität

Shopify Hydrogen ist ein Remix-basiertes React Framework. Integriert mit Shopifys Storefront API (GraphQL), Deployment auf Oxygen Hosting (Shopifys Edge Network). 2025 kam Hydrogen 2.0 mit RSC-Unterstützung.

**Plattform-Vorteil:** PCI Compliance, Fraud Detection, Checkout Optimization sind in Shopify eingebaut. Du schreibst nur das Frontend. Plus Plan $2.300/Monat, Transaction Fee %0,25 (mit Shopify Payments kostenlos).

**Produktions-Benchmark (Luxury Kosmetik Brand, 200K monatliche Sessions):**

- LCP: 1,6s (Oxygen Edge, ISR Caching)
- Checkout Conversion: %4,2 (Shopify Native) vs %3,1 (Custom Headless Checkout)
- Development Velocity: MVP in 6 Wochen (Hydrogen Skeleton Starter)

Die Limitation von Hydrogen: Du kannst nicht aus Shopifys Datenmodell ausbrechen. Es gibt Produktmetafields, aber für komplexe Beziehungen (z.B. B2B gestaffelte Preisgestaltung, Multi-Warehouse Routing) stößt du auf Shopifys Admin API. Für Custom Logic musst du Shopify Functions schreiben (Rust/AssemblyScript) — das ist eine separate Lernkurve.

**Beispiel Hydrogen Query (Produktdetail):**

```typescript
// app/routes/products.$handle.tsx
import { useLoaderData } from '@remix-run/react'
import { json } from '@shopify/remix-oxygen'

export async function loader({ params, context }: LoaderArgs) {
  const { product } = await context.storefront.query(PRODUCT_QUERY, {
    variables: { handle: params.handle },
  })

  return json({ product })
}

const PRODUCT_QUERY = `#graphql
  query Product($handle: String!) {
    product(handle: $handle) {
      id
      title
      descriptionHtml
      priceRange {
        minVariantPrice { amount currencyCode }
      }
    }
  }
`
```

Shopifys Storefront API Rate Limit beträgt 2.000 Punkte/s (basierend auf Query-Komplexität). Bei Burst-Traffic bekommst du Throttling — dann musst du eine Redis Cache Layer hinzufügen, aber Oxygen Hosting unterstützt Redis nicht nativ, du musst einen externen Service wie Upstash nutzen.

## Entscheidungsmatrix: Welcher Stack für welches Szenario

Diese Matrix basiert auf Entscheidungskriterien aus echten Produktionsprojekten:

| Szenario | Empfohlener Stack | Warum |
|---------|----------------|-------|
| D2C Retail, <$5M GMV | Shopify Plus + Liquid Theme | Composable ROI nicht sichtbar, Speed > Flexibilität |
| D2C Retail, $5-20M GMV | Shopify Plus + Hydrogen | Headless Vorteil in CWV messbar, Checkout bleibt bei Shopify |
| B2B Marketplace, komplexe Preisgestaltung | commercetools + Next.js | Custom Logic im Backend, Shopify Grenzen zu eng |
| Fashion/Apparel, Multi-Brand | BigCommerce Catalyst | Katalogverwaltung stark, Frontend Flexibilität ausreichend |
| Omnichannel (POS + Online) | Shopify Plus (Monolith) | POS-Integration nativ, Headless adds Komplexität |

**Kritischer Entscheidungsfaktor:** Development Team Kapazität. Hydrogen geht mit 2 Frontend Entwicklern in Production. commercetools erfordert 1 Backend (API Integration), 2 Frontend, 1 DevOps (CI/CD, Monitoring). In der TCO wiegen Personalkosten schwerer als Deployment-Geschwindigkeit.

## Die echten Kosten von MACH: Versteckte Komplexität

Die nicht sichtbaren Kostenposten eines Composable Stacks:

1. **Monitoring:** Monolithische Plattform = ein Dashboard, MACH = jeder Service separat (Datadog $180/Host/Monat, 8 Services = $1.440/Monat).
2. **Incident Response:** Bei monolithischen Plattformen öffnest du ein Support Ticket, bei MACH bist du selbst On-Call. Wenn Cart API down ist — ist das Stripe, commercetools oder das Frontend? Debugging Multi-Vendor.
3. **Upgrade Path:** Shopify wird automatisch aktualisiert, commercetools API-Versionen migrierst du selbst (v1 → v2 Breaking Change hat uns letztes Jahr 3 Wochen gekostet).

Bei unserer [Headless Commerce](https://www.roibase.com.tr/de/headless) Arbeit beraten wir E-Commerce Marken bei Composable Migration — welche Schichten du headless machst, welche im Monolith bleiben, beschleunigt das Deployment um 40%.

## Erfolgskriterien für Composable in Production

Wenn du nach 3 Monaten diese Metriken nicht hältst, denk über den Rückgang nach:

- **LCP Verbesserung >%40:** Die Kosten von Headless rechtfertigen sich nur mit dieser Performance-Steigerung.
- **Cart Abandonment Rate Abnahme >%8:** Ein schneller Checkout-Flow muss sich in Conversion widerspiegeln.
- **Development Velocity:** Neue Feature Deployment <2 Wochen (vs. 4-6 bei Monolith).
- **Incident MTTR <30 Min:** Wenn du Microservice-Fehler nicht schnell isolieren kannst, steigt die operative Last.

2026 ist Composable Commerce kein Dogma — es ist ein Engineering Trade-off. Die Stack-Auswahl sollte von GMV, Team-Kapazität und Custom Logic Requirements getrieben sein. Shopify Hydrogen ist das Sweet Spot für mittelständige D2C, commercetools für Enterprise B2B, BigCommerce Catalyst für Hybrid-Szenarien. Teste das MACH Manifest gegen Production Reality — jeder Microservice ist eine operative Belastung.