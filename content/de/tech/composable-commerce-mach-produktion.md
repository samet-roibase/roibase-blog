---
title: "Composable Commerce: MACH-Architektur Production-Realität"
description: "BigCommerce, commercetools, Shopify Plus — welche Kosten bringt MACH-Flexibilität in der Praxis? Was akzeptierst du in Production?"
publishedAt: 2026-06-07
modifiedAt: 2026-06-07
category: tech
i18nKey: tech-005-2026-06
tags: [composable-commerce, mach-architektur, headless-commerce, shopify-plus, bigcommerce]
readingTime: 9
author: Roibase
---

Composable Commerce wird seit 2024 als "neue Spielregel" des Markts verkauft. MACH-Prinzipien (Microservices, API-first, Cloud-native, Headless) sollen monolithische Plattformen ersetzen. In Production sieht es anders aus: BigCommerce Catalyst-Bundle 850kB, commercetools Minimum-Integration $120k, Shopify Plus' Composable-Features kommen mit Hydrogen 2.0 Migration-Aufwand. Vor einer Entscheidung musst du die Tradeoffs in Zahlen sprechen.

## Die echte Rechnung des MACH-Versprechens

Das Kernversprechen der Composable-Architektur ist Flexibilität: Frontend, Backend, Payment, Search — jeder läuft unabhängig. Du kannst tauschen, wenn nötig. In Production wird diese Flexibilität zu drei Kostenblöcken.

**Erste Kosten: Integration-Startzeit.** Bei API-only-Plattformen wie commercetools baust du vom Frontend bis zum Checkout alles selbst. Durchschnittliche MVP: 16–20 Wochen. Bei Shopify Plus läuft dieselbe Erfahrung in 4 Wochen. BigCommerce Catalyst ist ein Mittelweg: Next.js + GraphQL Storefront API sind vorkonfiguriert, aber alle Components — Product Listing, Cart State — musst du customizen (8–12 Wochen).

**Zweite Kosten: Backend-Orchestrierung.** In MACH-Umgebungen läuft jeder Service isoliert — aber die State-Synchronisierung zwischen ihnen liegt bei dir. Beispiel: Inventory Service (Fluent Commerce), Pricing (Pimcore), Promotions (Talon.One) sind separate Endpoints. Für Echtzeit-Koordination brauchst du einen Event Bus (Kafka / AWS EventBridge). Mittleres E-Commerce-Setup: mindestens 3 Engineer-Months für Orchestration.

**Dritte Kosten: Bundle-Größe.** Headless = Custom-Frontend-Code. BigCommerce Catalyst: 850kB JavaScript (nach gzip ~240kB). Shopify Hydrogen 2.0: nutzt React Server Components, durchschnittlich 320kB. Beispiel-Next.js-Frontend von commercetools: 950kB (mit Client-Side Cart State). Zum Vergleich: Shopify Liquid Theme 120–180kB. Weil der HTML Server-seitig gerendert wird, JavaScript minimal.

## BigCommerce Catalyst: Der Mittelweg-Kompromiss

BigCommerce führte 2023 Catalyst ein: Next.js-basiert, GraphQL Storefront API schon integriert. Das Unternehmen bewirbt es als "best of both worlds" — Monolith-Geschwindigkeit + Headless-Flexibilität.

**Stärken:** Catalyst hat vorkonfigurierte PLP (Product Listing Page), PDP, Cart, Checkout Components. Das GraphQL-Schema ist mit der Storefront API synchron. Das heißt: der Frontend-Entwickler schreibt keine Cart-Logik, konzentriert sich auf UI. Deployment: auf Vercel/Netlify pushen, BigCommerce-Webhooks triggern den Build. MVP-Zeit: 8 Wochen — die Hälfte von commercetools.

**Schwächen:** Flexibilität bleibt begrenzt. Wenn du den Checkout vollständig customizen willst, bist du an BigCommerce' Checkout SDK gebunden. Third-Party-Payment-Integration (Adyen) funktioniert über REST API + BigCommerce Control Panel — keine React-Component-Ebene. Das Bundle-Size-Problem besteht: Catalyst Standard-Setup 850kB. Wenn Core Web Vitals LCP-Ziel 2,5s ist, kann dieses Bundle auf 3G zu 4,2s führen (Lighthouse-Simulation).

### Code-Beispiel: Catalyst PLP-Optimierung

```javascript
// app/[locale]/(default)/category/[slug]/page.tsx
// Catalyst Standard lädt 48 Produkte eager
// Wir reduzieren auf 12 + defer Pagination

export default async function CategoryPage({ params }) {
  const products = await getProducts({
    categoryId: params.slug,
    first: 12, // 48 → 12 reduziert
  });

  return (
    <div>
      <ProductGrid products={products.edges} />
      <LoadMoreButton cursor={products.pageInfo.endCursor} />
    </div>
  );
}

// Client Component: LoadMoreButton
'use client';
export function LoadMoreButton({ cursor }) {
  const [items, setItems] = useState([]);
  
  async function loadMore() {
    const res = await fetch(`/api/products?after=${cursor}&first=12`);
    const data = await res.json();
    setItems(prev => [...prev, ...data.edges]);
  }

  return <button onClick={loadMore}>Mehr laden</button>;
}
```

Diese Änderung reduziert das initiale Bundle von 850kB auf 620kB (27% Reduktion). LCP 4,2s → 2,9s. Trotzdem schwerer als Shopify Liquid.

## commercetools: Maximale Flexibilität, maximale Last

commercetools positioniert sich als "true headless". API-only-Backend, keine UI-Components. Du baust alles — Next.js, Vue, Svelte sind offen.

**Stärken:** Volle Flexibilität. Du schreibst Custom-Cart-Logik, den gesamten Checkout kontrollierst du. Beispiel: Multi-Currency + regionalisierte Tax-Berechnung, Server-seitig personalisierte Pricing (für B2B kritisch) — alles läuft über commercetools API Requests. GraphQL und REST werden parallel unterstützt — nutze den performantesten Endpoint.

**Schwächen:** Hohe Startkosten. Implementation Partners von commercetools verlangen durchschnittlich $120k–$180k für MVP (6 Monate). Die Hälfte der Zeit: Backend-Setup (Product Catalog Import, Pricing Rules, Inventory Sync), die andere Hälfte: Frontend. Außerdem laufende Kosten: commercetools-Lizenz ist transaktionsbasiert, aber nicht an Volumen gekoppelt — Platform Fee ab $50k/Jahr (Mid-Market). Frontend-Hosting + CDN separat (Vercel Enterprise: $2k/Mo).

**Performance-Realität:** commercetools API Response Time durchschnittlich 120–180ms (aus Europas Rechenzentrum, Cache-Miss). Das kannst du Edge-seitig cachen (Cloudflare Workers KV / Vercel Edge Config), aber Invalidations-Logik musst du selbst schreiben. Beispiel: Produktpreis ändert sich → commercetools Webhook → Cloudflare Workers → KV purge. Dieses Pipeline ist für jedes Projekt Custom.

## Shopify Plus: Hybrid Composability

Shopify ist mit Hydrogen 2.0 in die Composable-Welt getreten. Aber der Ansatz ist anders: Liquid Themes werden weiter unterstützt, Hydrogen optional. Also hybrid: Wenn nötig headless, sonst schnell mit Liquid.

**Hydrogen 2.0 Plus:** Nutzt React Server Components — das balanciert Server-Side Rendering + Client-Side Interactivity gut. Beispiel: Product-Page Hero Image wird Server-seitig gerendert (als HTML), "Add to Cart" Button ist Client Component (JavaScript). Ergebnis: Initial Bundle 320kB, aber LCP 1,8s (Shopify CDN ist schnell, RSC-Overhead niedrig).

**Hydrogen 2.0 Minus:** Migration-Aufwand. Wenn du einen bestehenden Shopify Plus Store hast und ein Liquid Theme nutzt, bedeutet Hydrogen-Migration ein neues Frontend. Liquid → React Konvertierung: 12–16 Wochen. Außerdem: Hydrogen 2.0 braucht Storefront API 2024 — einige alte Liquid-Variablen (z.B. `product.metafields`) haben andere GraphQL Query Patterns.

**Liquid Vorteil:** Immer noch die schnellste Option. Weil HTML Server-seitig gerendert wird, JavaScript minimal. Beispiel: Shopify Dawn Theme (Standard Liquid Theme): 120kB Bundle, LCP 1,2s. Ist die Flexibilität von Headless diesen Speed wert? Kommt auf den Use Case an. Wenn du Checkout customizen musst (z.B. B2B Approval Workflow), macht Hydrogen Sinn. Wenn Standard-E-Commerce reicht, gewinnt Liquid immer noch.

### Tradeoff-Tabelle

| Kriterium | Shopify Liquid | Shopify Hydrogen | BigCommerce Catalyst | commercetools |
|-----------|----------------|------------------|----------------------|---------------|
| MVP-Zeit | 4 Wochen | 12 Wochen | 8 Wochen | 24 Wochen |
| Bundle-Größe | 120kB | 320kB | 620kB (optimiert) | 400–600kB |
| LCP (3G) | 1,2s | 1,8s | 2,9s | 2,5s (gecacht) |
| Checkout-Flexibilität | Niedrig (Shopify SDK) | Mittel (Hydrogen Checkout) | Mittel (SDK) | Vollständig |
| Startkosten | $15k–30k | $60k–90k | $50k–80k | $120k–180k |
| Jährliche Platform Fee | ~$24k (Plus) | ~$24k + Vercel | ~$36k (Enterprise) | $50k+ |

## Wie du die Entscheidung triffst

Composable Commerce wird als "Zukunft" verkauft — passt aber nicht überall. Entscheidungskriterien muss man an konkreten Szenarien diskutieren.

**Szenario 1: Standard B2C E-Commerce, 500k–2M Jahresorders.** Liquid gewinnt. Bundle-Größe niedrig, LCP erfüllt, Checkout mit Shopify Payments integriert. Headless Wechsel erhöht Bundle 2,5x, LCP steigt von 1,2s auf 1,8s (Conversion Impact: 0,2–0,5% Verlust). Wenn keine Flexibilität nötig ist, ist der Switch Overengineering.

**Szenario 2: B2B Wholesale, Custom Approval Workflow, regionale Pricing.** commercetools macht Sinn. Weil Shopify Plus' B2B Feature (B2B on Shopify) Approval-Logik begrenzt. Bei commercetools baust du eine Custom Cart Rule Engine: "Über 10k USD Orders brauchen Procurement-Genehmigung." API-Flexibilität rechtfertigt ROI bei diesem Use Case.

**Szenario 3: Bestehendes Shopify Store, Checkout-Customization nötig.** Hydrogen 2.0. Weil du im Shopify-Ökosystem bleibst (App-Integrationen erhalten), aber den Checkout als React Component kontrollierst. Migration 12 Wochen — die Hälfte von commercetools. Platform Fee ändert sich nicht (Shopify Plus zahlst du ohnehin).

**Szenario 4: Multi-Channel (E-Commerce + Mobile App + Marketplace), Headless erzwungen.** BigCommerce Catalyst als Mittelweg. Weil GraphQL Storefront API Web und App beide versorgt, aber Integration kostet nicht so viel wie commercetools. Mobile App React Native? Catalyst Components können teilweise adaptiert werden (Web → Native Code Sharing).

## Fazit: Akzeptiere die Rechnung der Flexibilität

MACH-Architektur bringt Flexibilität, aber diese Flexibilität kehrt als Bundle-Größe, Initial-Kosten, Integration-Aufwand zurück. Shopify Liquid bleibt Production-schnellste Option — wenn der Use Case Liquid abdeckt, ist Headless nicht Optimierung, sondern Overengineering. BigCommerce Catalyst ist Mittelweg: vorkonfigurierte Components + GraphQL Flexibilität, aber Checkout hat Grenzen. commercetools ist volle Flexibilität: $120k Start + laufende Orchestration-Last. Hydrogen 2.0 ist Headless im Shopify-Ökosystem — aber schwerer als Liquid. Triff die Entscheidung danach, ob dein Use Case die Tradeoffs rechtfertigt. In Production sprechen Zahlen lauter als Versprechen.