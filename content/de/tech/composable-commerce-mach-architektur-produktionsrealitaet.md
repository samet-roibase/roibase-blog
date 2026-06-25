---
title: "Composable Commerce: MACH-Architektur und Produktionsrealität"
description: "BigCommerce, commercetools, Shopify Plus — Wir dekodieren Trade-offs der Composable-Commerce-Architektur anhand von Produktionsszenarien und Benchmarks."
publishedAt: 2026-06-25
modifiedAt: 2026-06-25
category: tech
i18nKey: tech-005-2026-06
tags: [composable-commerce, mach-architektur, headless-commerce, shopify-hydrogen, commercetools]
readingTime: 9
author: Roibase
---

2024 hat "Composable Commerce" den Status einer PowerPoint-Buzzword-Sammlung verlassen und ist in die Produktionsrealität eingezogen. Die Stack Overflow Developer Survey 2025 zeigt: 43 % der Enterprise-E-Commerce-Projekte sind vom monolithischen Ansatz zur MACH-Architektur (Microservices, API-first, Cloud-native, Headless) migriert. Doch bei der Wahl zwischen BigCommerce, commercetools und Shopify Plus wird nicht datengestützt entschieden — Entscheidungen fallen oft basierend auf Buzzwords wie "Headless ist moderner". Dieser Artikel vergleicht drei Anbieter in Produktionsszenarien: API-Response-Zeiten, Developer Ergonomics, Laufzeitkosten, Multi-Region-Latenz. Treffen Sie Ihre Wahl nicht anhand von Verkaufsdemos, sondern auf Basis von Stack Tracing.

## Das echte Verständnis der MACH-Architektur

Die MACH-Abkürzung wurde 2020 von der MACH Alliance definiert, aber die tägliche Verwendung des Begriffs ist chaotisch. In der Praxis bedeutet MACH folgendes: Commerce-Logik (Pricing, Inventory, Orders) wird über APIs bereitgestellt, das Frontend wird komplett getrennt deployed (Vercel, Netlify, Cloudflare Pages). Durch diese Auftrennung können A/B-Tests im Frontend durchgeführt werden, ohne Backend-Releases zu blockieren.

Aber diese Fragmentierung bringt auch Probleme mit sich. In monolithischem Magento ist `$product->getPrice()` ein Funktionsaufruf. Im Headless-Szenario wird daraus eine REST- oder GraphQL-Request. Network-Latenz entsteht. Beispiel: Die Shopify Storefront API (GraphQL) liefert durchschnittlich 120 ms Response Time (bei Cache Miss, von Europa zu einer North-America-Instanz). Laut commercetools-Dokumentation liegt die P95-Latenz bei 180 ms (im Global Deployment). Wenn man diese Zahlen in Server-Side Rendering (SSR) einbaut, trägt jeder Seiten-Render 120–180 ms Network-Overhead mit sich.

Der zweite Trade-off: Orchestrierung. In einer MACH-Architektur sind Stripe-Zahlungen, Algolia-Suche, Contentful CMS und Klaviyo-Retention separate Services. Diese zu koordinieren ist Ihre Aufgabe. Im monolithischen System hat der Anbieter diese Integration bereits gelöst. Beispiel: Shopify Plus bietet Shopify Flow als Built-in-Automation an — wenn eine Bestellung ankommt, wird das Event an Klaviyo gesendet, ohne dass Code geschrieben werden muss. Bei commercetools schreiben Sie selbst diese Orchestrierung (z.B. AWS EventBridge + Lambda).

## BigCommerce: Trade-offs des Hybrid-Ansatzes

BigCommerce bietet eine "sanfte Einstiegsvariante" in die Composable-Welt. Die Plattform unterstützt Headless, ermöglicht aber parallel auch die monolithische Entwicklung mit dem Stencil Theme Engine (Handlebars-basiert). Diese Flexibilität ist gleichzeitig ein Vorteil und eine Falle.

Vorteil: Sie können mit einer Headless-Frontend (Next.js) starten, ohne direkt komplett zu migrieren. Die Shopify Stencil lässt sich parallel maintenance, und Sie können einen graduellen Übergang durchführen. Beispiel: Den Checkout in Stencil belassen, Product Listing und Homepage zu Next.js migrieren. Die GraphQL Storefront API von BigCommerce bietet Zugriff auf alle Entities (Product, Category, Cart, Customer). Wenn Sie richtig anchored sind, überrascht das Frontend Sie nicht.

Falle: Diese Flexibilität erzeugt komplexe Deployment-Pipelines. Wenn Sie beide Systeme (Stencil Theme und Next.js Frontend) parallel maintains, braucht jede Feature-Änderung zwei Deployments. Beispiel-Szenario: Hinzufügen von Inventory-Schwellenwert-Anzeige erfordert die Aktualisierung des Stencil-Templates UND der Next.js API Route. Sie müssen zwei Artifacts im CI/CD bauen.

API-Performance: BigCommerce GraphQL API P50-Latenz 95 ms (US-East), P99 250 ms (BigCommerce Status Page 2025). REST API ist schneller (P50 60 ms), aber nicht so flexibel wie GraphQL. Wenn Sie in einer Product Listing Variant-Informationen benötigen, führt REST zu N+1-Query-Problemen (für jedes Produkt ein separater Variant-Request). Mit GraphQL erhalten Sie alle verschachtelten Felder in einer Query:

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

Diese Query kehrt in 140 ms zurück (Cache Miss, Single-Region). Mit REST brauchen Sie 20 Product Requests + 20 Variant Requests = 1,2 s.

Multi-Region Deployment: BigCommerce ist SaaS; Sie können die Instanz nicht selbst wählen. Wenn Ihr Shop im US Datacenter läuft, bedeutet Asien-Traffic +220 ms Latenz. Edge Caching (Cloudflare) maskiert das teilweise, aber Cart Mutations (POST /cart/items) können nicht cached werden — sie gehen jedes Mal zum Origin.

## commercetools: Operational Overhead der Full-Composable-Architektur

commercetools ist die "reine Form" der MACH-Architektur — kein Frontend, kein Built-in Theme. Nur APIs. Sogar die Merchant Center (Admin UI) ist eine SPA, die über REST API läuft. Dieser Ansatz bietet maximale Flexibilität, bringt aber maximalen Operational Overhead mit sich.

API-Design: commercetools REST API ist auf HTTP/2 basiert, resource-orientiert. Jede Entity (Product, Cart, Order, Customer) hat ihren separaten Endpoint. GraphQL-Unterstützung ist noch Beta (ab Q4 2025 nicht Production-ready). Beispiel: Artikel zum Shopping Cart hinzufügen:

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

Diese Request kehrt P50 85 ms, P95 180 ms zurück (von GCP europe-west1). Aber Achtung: Das Feld `version` ist für optimistic locking erforderlich. Sie müssen bei jedem Request die aktuelle Cart-Version senden, sonst erhalten Sie einen 409 Conflict. Das erfordert Retry-Logik in concurrent Checkout-Szenarien.

Operational Cost: commercetools kalkuliert nach API Calls. Nach den ersten 50 Millionen API Calls/Jahr beginnt die Abrechnung ($0,0003/Call). Beispiel-Kalkulation: Ein Site mit 1 Million Session/Monat, durchschnittlich 15 API Calls pro Session (Product Listing, Product Detail, Cart Mutations, Checkout), bedeutet 180 Millionen Calls/Jahr = 130 Millionen abrechenbare Calls = $39.000 API Cost. Das ist zusätzlicher Cost zur Infrastruktur. Bei BigCommerce ist das in der SaaS-Pricing eingebunden.

Multi-Region: commercetools bietet Multi-Region Deployment auf GCP und AWS. Sie wählen für Ihr Projekt `europe-west1` oder `us-central1`. Es gibt keine Cross-Region-Replikation — Sie treffen eine einzelne Region-Wahl. Das bedeutet Global E-Commerce mit Latenz-Problemen. Lösung: In einer [Headless-Commerce](https://www.roibase.com.tr/de/headless)-Architektur das Frontend am Edge rendern (Cloudflare Workers, Vercel Edge Functions) und die commercetools API hinter einer Cache-Layer verstecken. Beispiel-Architektur: Produkt-Katalog in Cloudflare KV cachen (TTL 60s), Cart Mutations immer zum Origin senden. So liefert die Product Listing in 40 ms (vom Edge), Cart-Operationen dauern 180 ms (zum Origin).

## Shopify Plus: Headless-Layer auf monolithischer Basis

Shopify Plus verwendet den Begriff "Composable" nicht — stattdessen "Headless". Intern läuft es aber auf einer monolithischen Plattform. Mit Hydrogen (React-basiertes Framework) und der Storefront API können Sie ein Headless-Frontend bauen, aber Checkout und Admin sind komplett unter Shopify-Kontrolle. Dieses Hybrid-Modell beschleunigt kleine Teams, setzt aber größeren Teams Grenzen.

Storefront API: GraphQL-only, Rate-Limits basierend auf Query Complexity. Beispiel: Jede GraphQL Query hat einen "Cost"-Wert (einfache Product Query 5 Punkte, verschachtelte Variant + Metafield Query 15 Punkte). Pro Store sind 1000 Punkte pro Sekunde verfügbar (Shopify Plus). Wenn eine Homepage 50 Produkte listet und die Query 250 Punkte kostet, können Sie pro Sekunde nur 4 Homepages rendern. Bei Traffic-Spitzen erhalten Sie Rate-Limit-Fehler (429).

Hydrogen Framework: Das offizielle React-Framework von Shopify, gebaut auf Remix. Die alte Version (Hydrogen v1) war Vite-basiert, die neue (Hydrogen v2) nutzt Remix File-based Routing. Built-in Shopify API Client, Cart Management, i18n Routing. Im Kontext von [Shopify Partner Services](https://www.roibase.com.tr/de/shopify) verwenden wir Hydrogen, weil es Boilerplate reduziert: Cart State Management, Checkout Redirect, API Authentication — alles in Hydrogen vorbereitet.

Beispiel Hydrogen Route:

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

Wenn diese Route auf Oxygen (Shopify's Edge-Plattform) deployed wird, liegt die globale durchschnittliche Latenz bei 90 ms (Shopify Performance Dashboard 2025). Allerdings ist Oxygen-Deployment nur für Shopify Plus Kunden verfügbar, nicht für Standard-Pläne (Sie können zu Vercel deployen, aber das API-Quota bleibt das gleiche).

Trade-off: Checkout ist nicht customizierbar. Die Shopify Checkout-Seite wird auf Shopify-Servern gerendert, getrennt von Ihrem Headless-Frontend. Wenn Sie im Checkout Punkte eines Custom Loyalty-Systems anzeigen möchten, verwenden Sie Shopify Scripts (Liquid-basiert) oder Checkout UI Extensions (React Component, aber begrenzte API). Bei commercetools bauen Sie den Checkout komplett selbst.

## Entscheidungsmatrix: Welcher Anbieter wann?

Vergleich der drei Anbieter anhand konkreter Metriken:

| Metrik | BigCommerce | commercetools | Shopify Plus |
|--------|-------------|---------------|--------------|
| API P50 Latenz | 95ms (GraphQL) | 85ms (REST) | 120ms (GraphQL) |
| Multi-Region | Vendor-controlled (US/EU) | GCP/AWS regional | Global Edge (Oxygen) |
| Developer Onboarding | Mittel (Stencil + Next.js) | Hoch (pure API) | Niedrig (Hydrogen) |
| Checkout-Kontrolle | Volle Kontrolle | Volle Kontrolle | Eingeschränkt (Shopify Checkout) |
| Monthly API Cost (1M Session) | In SaaS enthalten | ~$3.250 | In SaaS enthalten |
| Built-in Features | Mittel (POS, B2B) | Niedrig (API-only) | Hoch (Flow, Scripts) |

Empfehlungen nach Szenario:

**Wählen Sie BigCommerce, wenn:** B2B-Komplexität vorhanden ist (Quote Management, Customer Groups), Sie keine schnelle Headless-Migration brauchen, aber die Option für später offen halten möchten. Multi-Storefront (verschiedene Marken, gleicher Backend) benötigt.

**Wählen Sie commercetools, wenn:** Sie volle Ownership wollen (Checkout eingeschlossen, alles Custom Built), API-first-Infrastruktur haben (z.B. Mobile App + Web + POS aus gleicher API), 100M+ Session/Jahr Traffic haben (hier kann API-Cost durch Caching optimiert werden).

**Wählen Sie Shopify Plus, wenn:** Ein kleines Development Team haben (2–4 Developer), Checkout nicht customizen müssen, von Shopify App Store Integrationen profitieren (Klaviyo, Yotpo, Gorgias haben Built-in Connectoren).

## Das versteckte Orchestrierungs-Problem bei Composable

Die Vendor-Wahl verschleiert ein Problem, das nach dem Deployment startet: Orchestrierung. In der MACH-Architektur verläuft ein Checkout-Flow wie eine Kette:

1. Frontend (Next.js) → Storefront API (Product/Cart)
2. Payment Gateway (Stripe/Adyen) → Backend Orchestrator
3. OMS (Order Management) → commercetools/BigCommerce
4. Email (Klaviyo/SendGrid) → Customer Data
5. Inventory Sync (ERP) → Stock Update

Wenn ein Link in dieser Kette ausfällt (z.B. Stripe Webhook 5 Sekunden verspätet ankommt), leidet die Customer Experience. Im monolithischen System (z.B. Magento) ist dieser Flow vom Vendor gelöst. Bei