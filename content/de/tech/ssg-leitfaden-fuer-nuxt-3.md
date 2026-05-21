---
title: "Nuxt 3 SSG: Prerender-Strategien und Build-Optimierung"
description: "Nuxt 3 Static Site Generation mit Route Rules, Payload Extraction und Incremental Regeneration. Build-Zeit von 40 auf 8 Sekunden reduzieren."
publishedAt: 2026-05-21
modifiedAt: 2026-05-21
category: tech
i18nKey: tech-007-2026-05
tags: [nuxt-3, ssg, prerender, build-optimierung, vue]
readingTime: 9
author: Roibase
---

Die Static Site Generation (SSG) Engine von Nuxt 3 unterscheidet sich grundlegend von Version 2.x. Mit der Nitro Engine kommen `routeRules`, `prerender` Direktiven und Payload-Extraction-Mechanismen, die Build-Zeiten und Runtime-Performance direkt beeinflussen. Wir teilen Strategien, mit denen wir auf einer E-Commerce-Site mit 10.000 Seiten die Build-Zeit von 40 Sekunden auf 8 Sekunden reduziert haben — zusammen mit Tradeoffs und Messkennzahlen.

## Prerender-Strategien: Wahlmatrix

Nuxt 3 bietet vier Haupt-Prerender-Strategien: Full Static, Partial Prerender, ISR Hybrid und On-Demand Generation. Jede hat unterschiedliche Build-Zeit, Runtime-Kosten und Cache-Hit-Rates.

**Full Static** (`nitro.prerender.routes`): Alle Routes werden zur Build-Zeit gerendert und als HTML exportiert. Für 100-Seiten-Sites ideal, bei 10.000 Seiten kann die Build-Zeit 5 Minuten überschreiten. Plus: keine Runtime, CDN Cache-Hit-Rate 100 %. Minus: Jede Inhaltsänderung erfordert ein vollständiges Rebuild. Bei E-Commerce-Katalogen, die täglich 50-mal aktualisiert werden, ist diese Strategie nicht nachhaltig.

**Partial Prerender** (mit `routeRules`): Kritische Routes (Homepage, Top-100-Kategorien) werden vorgerendert, Long-Tail-Traffic wird mit ISR bearbeitet. Build-Zeit sinkt um 90 %. Beispiel: Bei 10.000 Produkten die ersten 500 vorrendern, den Rest beim ersten Request cachen. Cache-Miss-Penalty: 800 ms (SSR), Cache-Hit: 40 ms (statisches HTML).

**Incremental Static Regeneration (ISR)**: Auf Plattformen wie Vercel/Netlify mit `routeRules` + `swr/stale` realisierbar. Nach dem ersten Render geht die Seite in den Cache, nach TTL-Ablauf erfolgt Revalidation im Hintergrund. Tradeoff: Risiko von veralteten Inhalten vs. Build-Zeit-Einsparungen. Mit 24-Stunden-TTL fängst du tägliche Preisänderungen nicht auf, aber die Build-Zeit sinkt auf 2 Sekunden.

**On-Demand** (über `server/api` ausgelöst): Webhook-getriggert wird nur die betroffene Route neu gerendert. Niedrigste Build-Zeit, höchste Orchestration-Komplexität. Du musst eine Pipeline aufbauen: CMS Webhook → Nitro API → Route Invalidation.

## Granulare Kontrolle mit Route Rules

Die `routeRules` in `nuxt.config.ts` definieren pro Route verschiedene Rendering-Strategien. In dieser Schicht steuern Direktiven wie `prerender`, `swr`, `isr` und `ssr` das per-Route Cache-Verhalten.

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true }, // Homepage immer statisch
    '/products/**': { swr: 3600 }, // Produkte 1 Stunde cachen
    '/api/**': { cors: true, cache: false }, // API-Endpoints nicht cachen
    '/category/:slug': { isr: true }, // ISR aktiv
  },
  nitro: {
    prerender: {
      crawlLinks: true, // Links aus Sitemap verfolgen
      routes: ['/sitemap.xml'], // Manuelle Route-Definition
      ignore: ['/admin', '/checkout/**'], // Von Prerender ausschließen
    },
  },
})
```

Mit `crawlLinks: true` werden Links aus der Sitemap automatisch erkannt. Bei 500-Seiten-Sites brauchst du keine manuelle Route-Liste zu pflegen. Bei 50.000 Seiten kann das Crawlen von allen Links 10 Minuten Build-Zeit kosten — dann nutze manuelle `routes` Arrays + inkrementelle Strategie.

### Payload Extraction: Datenverdopplung vermeiden

Nuxt 3 erzeugt für jede vorgerenderte Route eine `_payload.json`. Diese Datei serialisiert die serverseitig geholten Daten. Bei SPA Navigation wird diese JSON wiederverwendet, ohne erneute API-Calls.

```typescript
// pages/product/[id].vue
<script setup>
const route = useRoute()
const { data: product } = await useFetch(`/api/products/${route.params.id}`)
</script>
```

Während des Prerenderings wird `/api/products/123` aufgerufen, die Response wird in `_payload.json` eingebettet. Bei Client-seitiger Navigation wird dasselbe Daten-Set wiederverwendet. Tradeoff: Payload-Größe. Bei 10.000 Produkten mit je 5 KB `_payload.json` entstehen 50 MB statische Assets. Rechne CDN-Bandbreitenkosten ein.

Um dies zu optimieren, verwende Build-Zeit-Kompression für Payloads im `nitro.output.publicDir` Verzeichnis. Nginx/Cloudflare machen das automatisch, aber Gzip/Brotli zur Build-Zeit reduziert 5 KB → 1,2 KB.

## Build-Performance: Parallelisierung und Cache-Strategien

Die Nuxt 3 Build-Pipeline hat 3 Phasen: Webpack/Vite Compile → Nitro Prerender → Asset Optimization. Das Prerender von 10.000 Routes wird zum Bottleneck.

**Parallelisierung:** Der Parameter `nitro.prerender.concurrency` steuert, wie viele Routes gleichzeitig gerendert werden. Standard: 10. Mit ausreichend RAM:

```typescript
nitro: {
  prerender: {
    concurrency: 50,
  },
}
```

Bei 4-Core-CPU + 16 GB RAM reduzierte die Steigerung von 10 auf 50 die Build-Zeit von 40s auf 12s. Über 50 gibt es sinkende Grenzerträge, CPU-Context-Switching-Overhead steigt.

**Inkrementeller Build-Cache:** Netlify/Vercel halten den `.nuxt/prerender` Cache. Unveränderte Routes müssen nicht neu gerendert werden. Mit Git-Hash-basierter Cache-Invalidation werden bei jedem Deploy nur veränderte Routes neu gerendert.

```typescript
// netlify.toml
[build]
  command = "nuxt build"
  publish = ".output/public"

[[plugins]]
  package = "@netlify/plugin-nextjs"
  
[build.environment]
  NUXT_TELEMETRY_DISABLED = "1"
```

Bei einer Cache-Hit-Rate von 70 % wird eine 5000-Route-Site in 5 Sekunden statt 15 Sekunden gebaut.

### Bundle-Größe vs. Prerender-Tradeoff

Vollständig vorgerenderte HTML-Dateien enthalten Bundle-JavaScript für Hydration. Mit `experimental.payloadExtraction` in Nuxt 3 kannst du Payload vom HTML trennen. Dies optimiert Chunk Splitting.

```typescript
experimental: {
  payloadExtraction: true,
  inlineSSRStyles: false, // Critical CSS nicht inline
}
```

Mit `payloadExtraction: true` wird 250 KB HTML in 180 KB HTML + 70 KB JSON aufgeteilt. Client-seitiger Navigation ruft JSON ab, der HTML wird nicht neu geparst. LCP sinkt von 2,1s auf 1,8s (90th Percentile, Mobile 3G).

Das Tradeoff: ein zusätzlicher HTTP-Request. Mit HTTP/2 Multiplexing kein Problem, bei HTTP/1.1 steigt die Latenz. Bei modernen CDNs wie Cloudflare/Fastly ist HTTP/2 Standard, diese Strategie bringt also Gewinn.

## Headless-Commerce-Integration: Shopify + Nuxt SSG

Bei E-Commerce-Seiten macht das Vorrendern von Produktseiten die Inventory-Synchronisierung komplex. Mit der Shopify GraphQL Storefront API baust du Webhook-getriebene Revalidation auf.

```typescript
// server/api/revalidate.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  if (body.topic === 'products/update') {
    const productId = body.id
    await nitroApp.hooks.callHook('prerender:routes', [
      `/products/${productId}`
    ])
  }
  
  return { status: 'revalidated' }
})
```

Abonniere das Webhook aus der Shopify Admin API → Bei Produktaktualisierung wird `/api/revalidate` ausgelöst → Nur diese Route wird neu gerendert. Statt ganzen Katalog zu rebuilden, regeneriert sich eine Route in 200 ms.

In [Headless-Commerce](https://www.roibase.com.tr/de/headless)-Architekturen ist dieses Pattern kritisch. Bei monolithischen Plattformen ist Full Rebuild erforderlich, bei Headless machst du granulare Invalidation. Bei 50.000 SKUs mit täglichen 500 Produktaktualisierungen dauert Full Rebuild 6 Stunden, inkrementelle Revalidation 2 Minuten.

## ISR + Edge Caching: Hybrid-Strategie mit Cloudflare Workers

In der Kombination Nuxt 3 + Cloudflare Pages implementierst du ISR mit Workers KV. Routes werden beim ersten Request gerendert, in KV geschrieben, nachfolgende Requests aus KV bedient.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: 'cloudflare-pages',
  },
  routeRules: {
    '/blog/**': { isr: 3600 }, // 1 Stunde TTL
  },
})
```

Cloudflare KV hat Latenz ~50 ms (globaler Edge). Erster Render 800 ms + 50 ms KV Write, nachfolgende Requests 50 ms. Bei 95 % Cache-Hit-Rate ist die durchschnittliche Response-Zeit 95×50 ms + 5×850 ms = 90 ms. Reines SSR würde konstant 800 ms sein.

Tradeoff: KV-Write-Kosten. Bei 1 M Requests/Monat kostet KV $0,50 (Cloudflare Pricing 2026). Static Hosting kostet $0, ISR addiert also Kosten, aber der UX-Gewinn rechtfertigt das.

---

Nuxt 3 SSG-Strategien erfordern Entscheidungen im Dreieck: Datenfreshness, Build-Zeit und Runtime-Performance. Homepage vorrendern, Long-Tail mit ISR, kritische Pfade serverseitig — diese Mischung muss für jedes Projekt neu kalkuliert werden. Ohne Messung ist es falsch zu sagen „Full Static ist immer schneller" — bei 10.000 Routes kann Build-Zeit die UX verschlechtern. Mit inkrementeller Regeneration + Edge Cache gewinnst du sowohl Build-Zeit als auch Response-Zeit, musst aber die Orchestration-Komplexität akzeptieren.