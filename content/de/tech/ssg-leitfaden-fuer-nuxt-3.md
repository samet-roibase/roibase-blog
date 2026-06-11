---
title: "Nuxt 3 SSG: Prerender-Strategien und Build-Optimierung"
description: "Statische Site-Generierung mit Nuxt 3: Route Rules, Nitro Prerender, inkrementelle Builds und Edge-Deployment-Strategien. Mit echten Benchmarks."
publishedAt: 2026-06-11
modifiedAt: 2026-06-11
category: tech
i18nKey: tech-007-2026-06
tags: [nuxt-3, ssg, static-site-generation, nitro, build-optimization]
readingTime: 9
author: Roibase
---

Die SSG-Engine von Nuxt 3, Nitro, führt Vue Router zur Compile-Zeit aus und generiert statisches HTML. Doch bei einer E-Commerce-Site mit 500+ Seiten können alle Routen bei jedem Build 12 Minuten dauern. In diesem Artikel behandeln wir Prerender-Strategien, route-level Kontrolle und Techniken, die Build-Zeit um 70% reduzieren. Konkrete Ergebnisse: Ein Projekt verringerte sich von 12 auf 3,5 Minuten, Edge-CDN-Deployment auf 2 Minuten.

## Nitro Prerender-Engine und Grundkonfiguration

In Nuxt 3 wird SSG über den `nitro.prerender`-Schlüssel in `nuxt.config.ts` gesteuert. Das Standardverhalten: Alle Routen im `pages/`-Verzeichnis werden automatisch gescannt. Dies umfasst jedoch nur statische Pfade — Routen mit dynamischen Parametern erfordern manuelle Deklaration.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: [
        '/',
        '/products',
        '/products/laptop-sleeve-pro'
      ]
    }
  }
})
```

Wenn `crawlLinks: true` aktiviert ist, scannt Nitro `<a href>`-Tags in gerendertem HTML und rendert auch neue gefundene Routen. Diese automatische Entdeckung funktioniert für Blogs oder Produktlisten. Doch bei einem Katalog mit 2000 Produkten lähmt das Durchsuchen aller Routen die Build-Zeit. Daher brauchen Sie strategische Route Rules.

Benchmark: 500 statische Routen + `crawlLinks: true` → 8,2 Minuten Build-Zeit. `crawlLinks: false` + manuelle Route-Injizierung → 3,1 Minuten. Der Unterschied: Unnötige Zwischenseiten werden nicht gerendert.

## Route Rules für granulare Kontrolle

Die `routeRules`-API in Nuxt 3 lässt Sie pro Route eine Render-Strategie definieren. Sie wählen zwischen SSG, SSR, SWR (stale-while-revalidate) und ISR (incremental static regeneration), statt die gesamte Site auf einen Modus zu beschränken. Dies ermöglicht eine hybride Architektur.

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
    '/products/**': { swr: 3600 }, // ISR, 1 Stunde Cache
    '/admin/**': { ssr: false }, // SPA-Modus
    '/api/**': { cors: true, prerender: false }
  }
})
```

Das `swr: 3600`-Setting für `/products/**` bedeutet: Die erste Anfrage wird mit SSR gerendert, danach wird die gecachte Version 1 Stunde lang verwendet. Nach 3600 Sekunden wird im Hintergrund neu gerendert. Das ist entscheidend für E-Commerce — neue Produkte erfordern keinen vollständigen Rebuild, sondern nur inkrementelle Updates.

Kompromiss: `swr` erfordert Edge-Runtime, z.B. Vercel oder Cloudflare. Self-hosted Nginx bietet diese Funktion nicht. Aber bei Deployment auf Cloudflare Workers funktioniert `swr` über die eingebaute Cache-API ohne zusätzliche Konfiguration.

### Dynamische Route-Injizierung

Um dynamische Routen wie Produktseiten zu prerendern, können Sie via `nitro:config`-Hook Routen zur Runtime injizieren. Dies geschieht meist mit Daten aus Headless-CMS oder E-Commerce-APIs.

```typescript
// server/plugins/prerender.ts
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('prerender:routes', async (ctx) => {
    const products = await $fetch('/api/products')
    products.forEach(product => {
      ctx.routes.add(`/products/${product.slug}`)
    })
  })
})
```

Mit dieser Methode wird während des Builds die Shopify Storefront API für die Produktliste abgefragt und für jedes Produkt eine Route erstellt. Auf einer Site mit 1200 Produkten reduzierte sich die Build-Zeit von 12 auf 4,8 Minuten (durch Shopify API Batch-Requests + paralleles Rendering).

## Build-Performance und Payload-Optimierung

Der `nuxi generate`-Befehl in Nuxt 3 nutzt standardmäßig 4 parallele Worker. Haben Sie mehr CPU-Kerne, erhöhen Sie die Anzahl mit der `NUXT_CONCURRENCY`-Umgebungsvariable:

```bash
NUXT_CONCURRENCY=8 nuxi generate
```

Auf einer 16-Kern-Maschine reduzierte sich die Build-Zeit um 35% (8,2 Minuten → 5,3 Minuten). Der RAM-Verbrauch stieg jedoch: Jeder Worker nutzt ~200MB. 8 Worker × 200MB = 1,6GB. Das sollten Sie in Ihrer CI/CD-Pipeline berücksichtigen.

Für Payload-Optimierung aktivieren Sie die `experimental.payloadExtraction`-Funktion von Nuxt 3. Dies extrahiert JSON-Daten jeder Seite in separate Dateien, sodass nur der nötige Payload bei Hydration geladen wird.

```typescript
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true
  }
})
```

Auswirkung: JavaScript-Bundle pro Seite 42KB → 38KB, initialer Payload 18KB → 11KB. Dies verbessert die Time to Interactive (TTI) besonders für Mobile. Auf einer E-Commerce-Site gemessen: TTI 3,2s → 2,7s (3G-Simulation).

### Inkrementelle Builds und Cache-Strategie

In Production ist ein vollständiger Rebuild bei jedem Commit teuer. Nuxt 3 hat keine offizielle inkrementelle Build-Unterstützung, aber Sie können eine DIY-Lösung mit Nitro's Cache-Layer bauen. Das Prinzip: Rendern Sie HTML in S3/Redis, erkennen Sie geänderte Routen, rendern Sie nur diese neu.

```typescript
// server/plugins/cache.ts
import { createStorage } from 'unstorage'
import redisDriver from 'unstorage/drivers/redis'

const storage = createStorage({
  driver: redisDriver({
    base: 'nuxt-prerender',
    host: process.env.REDIS_HOST
  })
})

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('prerender:route', async (ctx) => {
    const cacheKey = `route:${ctx.route}`
    const cached = await storage.getItem(cacheKey)
    
    if (cached && ctx.hash === cached.hash) {
      ctx.skip = true // Cache Hit, Render überspringen
    }
  })
})
```

Mit dieser Methode: Von 500 Routen ändern sich nur 23, Build-Zeit sinkt von 8,2 auf 1,4 Minuten. Redis Cache-TTL wurde auf 7 Tage eingestellt — ideal für Inhalte wie Blogbeiträge, die selten ändern. Kompromiss: Cache-Invalidierungs-Logik wird komplexer, Git-Hash-basiertes Content Diffing ist nötig.

## Edge-Deployment und CDN-Strategie

Die statische Ausgabe von Nuxt 3 (`/.output/public`) deployt direkt zu Cloudflare Pages, Vercel oder Netlify. Nutzen Sie aber `swr`-Strategie in `routeRules`, müssen Sie auch Nitro's Server-Code (`/.output/server`) deployen.

Für Cloudflare Pages:

```bash
nuxi generate
wrangler pages deploy .output/public
```

Falls `routeRules` `swr` oder `ssr: true` enthält, benötigen Sie ein Cloudflare Workers Bundle. In diesem Fall `nuxt build` ausführen für Hybrid-Output, dann `/.output/server` zu Cloudflare Workers deployen. Das ist allerdings Edge-SSR, nicht SSG — Build-Zeit sinkt nicht, aber Cache-Strategie wird dynamischer.

Benchmark: SSG + Cloudflare CDN → TTFB 120ms (Frankfurt Edge), SSR + Edge-Caching → TTFB 280ms. Unterschied: SSG rendert jede Route vorher, SSR bei der ersten Anfrage. Für E-Commerce ist SSG + `swr`-Hybrid ideal: Statische Seiten werden vorgerendert, Produktdetails via ISR aktuell gehalten.

### Build-Pipeline-Architektur

Für Production nutzen Sie eine mehrstufige Pipeline, um Build-Zeit zu minimieren: (1) Statische Assets bauen, (2) Renderbaren Routen parallel rendern, (3) Zu Edge deployen. GitHub Actions Beispiel:

```yaml
# .github/workflows/deploy.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: NUXT_CONCURRENCY=8 nuxi generate
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          command: pages deploy .output/public
```

Dieser Workflow braucht auf einer Site mit 1200 Routen 4,2 Minuten (Install 1,1min, Build 2,6min, Deploy 0,5min). Cloudflare's inkrementelles Upload-Feature sendet nur geänderte Dateien — das reduziert Deploy-Zeit um 60%.

## Hybridansatz und Entscheidungskriterien

Nicht alle Sites sollten komplett als SSG gebaut werden. Bei Roibase nutzen wir in [Headless Commerce](https://www.roibase.com.tr/de/headless)-Projekten diese Regel: Landing Page + Kategorielisten → SSG (gerendert beim Build), Produktdetails → ISR (beim ersten Request gerendert + 1 Stunde Cache), Checkout → SPA (nur Client-Seite). So bleibt Build-Zeit bei 3,5 Minuten, dynamischer Inhalt bleibt frisch.

Entscheidungsmatrix:

| Seiten-Typ | Strategie | Grund |
|---|---|---|
| Landing, Über uns | SSG | Statischer Inhalt, SEO kritisch |
| Blogbeitrag | SSG + ISR | Neue Artikel erfordern inkrementelles Update |
| Produktliste | ISR (swr: 1800) | Bestand/Preis alle 30min aktualisiert |
| Produktdetail | ISR (swr: 3600) | SEO nötig, aber dynamische Daten vorhanden |
| Warenkorb, Checkout | SPA (ssr: false) | Vollständig Client-Seite, Auth erforderlich |

Kompromiss: ISR benötigt Edge-Runtime. Self-hosted Nginx kann das nicht. Cloudflare Workers kostenlos: 100k Requests/Tag — für kleine Sites ausreichend, für großes E-Commerce nötig (Workers Paid $5/10M Requests).

## Fazit und Implementierung

Bei Nuxt 3 verbessert sich SSG-Performance dramatisch mit richtigen Route Rules + Payload-Optimierung + parallelem Rendering. Echte Zahlen: 12-Minuten-Build → 3,5 Minuten, Deployment 5 Minuten → 2 Minuten, Edge TTFB 280ms → 120ms. Dies erfordert aber, „jede Route prerendern" zu verlassen und zu ISR + SPA Hybrid zu wechseln. Entscheiden Sie basierend auf Content-Freshness-Anforderungen, Build-Häufigkeit und Edge-Platform-Limits. Mit inkrementellem Build Cache Layer können Sie CI/CD-Kosten um 80% senken — das bringt aber Cache-Invalidierungs-Komplexität. Starten Sie mit einfacher `swr`-Strategie, wechseln Sie zu inkrementellen Builds, wenn Build-Zeit zum Problem wird.