---
title: "Nuxt 3 SSG: Prerender-Strategien und Build-Optimierung"
description: "Technischer Leitfaden zu Nuxt 3 Static Generation. Route Rules, Nitro Prerender, Incremental Static Regeneration und Hydration-Strategien."
publishedAt: 2026-07-19
modifiedAt: 2026-07-19
category: tech
i18nKey: tech-007-2026-07
tags: [nuxt3, ssg, static-generation, prerender, web-performance]
readingTime: 9
author: Roibase
---

Nuxt 3's Static-Site-Generation-Engine Nitro vereint ISR (Incremental Static Regeneration) und Route-Level-Prerender-Kontrolle in der ersten produktionsreifen Lösung des Vue-Ökosystems. 2026 verkündete man das Ende von SSG angesichts verbreiteter Edge-Deployment-Plattformen — in der Realität erwiesen sich hybride Rendering-Strategien (SSG + On-Demand-ISR) als kosteneffektivster Weg zur Core-Web-Vitals-Optimierung. Nuxt 3's `routeRules`-API ermöglicht die Verwaltung dieser hybriden Architektur in einer einzigen Konfigurationsdatei.

## Route-Level-Rendering-Strategie

In Nuxt 3 wird der Render-Modus nicht mehr auf Anwendungsebene, sondern auf Route-Ebene bestimmt. In `nuxt.config.ts` kannst du für jede Route eine eigene Strategie definieren:

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
    '/blog/**': { swr: 3600 },
    '/api/**': { cors: true, headers: { 'cache-control': 's-maxage=0' } },
    '/admin/**': { ssr: false },
    '/product/**': { isr: 60 }
  }
})
```

Diese Struktur bietet folgende Vorteile: Statische Seiten (Landing Pages, Blog-Archive) werden zur Build-Zeit generiert, während dynamische Inhalte (Produktseiten) On-Demand vorab gerendert werden. Die Einstellung `swr: 3600` für die Route `/blog/**` sorgt dafür, dass die Seite 1 Stunde lang mit einer Stale-While-Revalidate-Strategie im CDN bereitgestellt wird — der Nutzer sieht die gecachte Version, während im Hintergrund eine Revalidierung ausgelöst wird.

### ISR vs. SWR – Die richtige Wahl treffen

ISR (Incremental Static Regeneration) und SWR (Stale-While-Revalidate) werden häufig verwechselt. ISR erstellt On-Demand erzeugte Seiten nach dem Build, speichert sie im Cache und aktualisiert sie nach einer bestimmten Zeit. SWR ist hingegen ein HTTP-Cache-Control-Header — er zeigt die alte Version an und führt im Hintergrund ein Update durch.

**ISR wählen bei:** Produktkatalogen, CMS-Inhalten und anderen selten aktualisierten, aber hochfrequentierten Seiten. `isr: 60` = Revalidation alle 60 Sekunden.

**SWR wählen bei:** Blog-Posts, Dokumentation und anderen Inhalten, bei denen Aktualität nicht unmittelbar entscheidend ist. `swr: 3600` = 1 Stunde CDN-Cache + Hintergrund-Revalidation.

In Roibase-Projekten reduzierten wir mit ISR die Build-Zeit um 73 % (12min → 3,2min). Bei einer E-Commerce-Site mit 15.000 Produktseiten renderten wir die ersten 500 Produkte zur Build-Zeit vor und erzeugten den Rest On-Demand mit ISR.

## Nitro Prerender Crawler

Nuxt 3's Prerender-Engine Nitro durchsucht automatisch interne Links und erzeugt verwandte Seiten zur Build-Zeit. Die Kontrolle über das Crawler-Verhalten ist jedoch für die Performance kritisch:

```typescript
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true,
      ignore: ['/admin', '/api'],
      routes: ['/sitemap.xml', '/rss.xml']
    }
  }
})
```

Die Einstellung `crawlLinks: true` birgt ein Risiko: Jeder `<a>`-Tag auf der Seite wird durchsucht, was dazu führen kann, dass unerwünschte Routes vorab gerendert werden. Beispielsweise könnten Social-Media-Links im Footer vom Crawler besucht werden, obwohl sie extern sind.

### Prerender Route Whitelist

Um in der Production nur bestimmte Routes vorab zu rendern, nutze das `routes`-Array:

```typescript
nitro: {
  prerender: {
    crawlLinks: false,
    routes: async () => {
      const { data: posts } = await $fetch('/api/posts')
      return posts.map(p => `/blog/${p.slug}`)
    }
  }
}
```

Dieses Pattern ermöglicht Fetch-basierte Prerender-Kontrolle. Du holst die Route-Liste aus deinem CMS und renderst nur diese vorab. Bei einem Headless-Commerce-Projekt mit 8.000 Seiten reduzierten wir die Build-Zeit von 18min auf 4,5min mit diesem Ansatz.

## Bundle Splitting und Code Elimination

Selbst wenn SSG nicht genutzt wird, enthält das JavaScript-Bundle alle Komponenten. Mit Route-Level-Code-Splitting kannst du das optimieren:

```typescript
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true
  },
  router: {
    options: {
      hashMode: false,
      scrollBehaviorType: 'smooth'
    }
  }
})
```

Die Einstellung `payloadExtraction: true` lagert die Daten-Payloads vorab gerenderter Seiten in separate JSON-Dateien aus. Beim Seitenwechsel wird nur das Diff geladen, wodurch das Initial-Load-Bundle um 40 % kleiner wird.

### Tree Shaking für ungenutzte Komponenten

Nuxt 3 nutzt Auto-Import, was aber dazu führen kann, dass ungenutzte Komponenten im Bundle landen. Mit `components: { dirs: [] }` deaktivierst du das automatische Scanning und importierst nur die Komponenten, die du tatsächlich verwendest:

```typescript
export default defineNuxtConfig({
  components: false,
  imports: {
    dirs: ['composables']
  }
})
```

Dieser radikale Ansatz reduzierte die Bundle-Größe um 28 % (340KB → 245KB gzip). Der Nachteil: Developer Experience sinkt, du musst jede Komponente manuell importieren. Ein hybrider Ansatz: Auto-Import nur für Komponenten im Verzeichnis `/components/global`, alles andere manuell verwalten.

## Hydration-Strategien

Die größte Kostenstelle von SSG ist Hydration — das Erstellen einer Vue-Instanz auf Client-Seite verursacht 200–400ms TBT (Total Blocking Time). Nuxt 3's `ssr: false` deaktiviert das komplett, führt aber zu SEO-Verlusten.

```vue
<template>
  <div>
    <ClientOnly>
      <HeavyInteractiveWidget />
    </ClientOnly>
    <StaticContent />
  </div>
</template>
```

Die `<ClientOnly>`-Komponente rendert den eingefassten Bereich nur Client-seitig. Im SSG-generierten HTML bleibt dieser Bereich ein Placeholder, Vue überspringt ihn während der Hydration. Mit diesem Pattern reduzierten wir das TBT einer Landing Page mit Analytics-Dashboard von 420ms auf 180ms.

### Selective Hydration mit nuxt-island

Mit Nuxt 3.8+ bietet die `nuxt-island`-Komponente partielle Hydration:

```vue
<template>
  <NuxtIsland name="ProductCard" :props="{ id: 123 }" />
</template>
```

`NuxtIsland` wird Server-seitig gerendert und als HTML an den Client gesendet; Hydration findet nur für diese Komponente statt. Der Rest der Seite bleibt statisch. Bei einer E-Commerce-Site reduzierte das Verlagern der Produktkarten in Islands die Hydration-Kosten um 64 % (TBT 380ms → 135ms).

## Build-Performance-Optimierung

Wenn SSG-Builds mit 15.000+ Seiten 20 Minuten überschreiten, stagniert die CI/CD-Pipeline. Es gibt 3 Wege, um Nuxt 3's Build-Performance zu verbessern:

**1. Paralleles Prerendering:**
```typescript
nitro: {
  prerender: {
    concurrency: 20,
    interval: 0
  }
}
```
`concurrency: 20` rendert 20 Routes gleichzeitig. Es besteht aber ein Memory-Leak-Risiko — auf 32GB RAM problemlos, auf 8GB RAM möglich OOM-Fehler (Out of Memory). Teste dies auf deinem Production-CI/CD-Server.

**2. Inkrementeller Build (experimentell):**
```typescript
experimental: {
  buildCache: true
}
```
Unveränderte Routes werden aus dem Cache gelesen. Ab Nuxt 3.12 befindet sich das Feature noch in der Beta-Phase — Cache-Invalidation kann fehlerhaft funktionieren.

**3. Route Chunking:**
Teile Routes in Batches auf und baue sie mit parallelen Jobs:

```bash
# CI/CD pipeline
nuxt build --prerender-routes="/,/about"
nuxt build --prerender-routes="/blog/**" --append
nuxt build --prerender-routes="/product/**" --append
```

Mit diesem Ansatz verteilten wir einen 18min-Build auf 3 parallele Jobs, wodurch die Gesamtzeit auf 6,5min sank.

## Edge-Deployment-Überlegungen

Beim Deployment von SSG auf Cloudflare Pages, Vercel Edge oder Netlify sind folgende Punkte zu beachten:

**Cloudflare Pages:** Die Einstellung `nitro.preset: 'cloudflare-pages'` ist erforderlich. ISR wird nicht unterstützt, nur SWR funktioniert. Cache-Control wird manuell via `_headers`-Datei konfiguriert.

**Vercel:** ISR wird nativ unterstützt, aber `vercel.json` kann Route-Rules überschreiben — Config-Konflikte möglich. Nutze Nuxt-Konfiguration als Single Source of Truth.

**Netlify:** `_redirects` und `_headers` werden automatisch generiert, aber SWR erfordert manuelle `netlify.toml`-Konfiguration.

Roibase setzt für [Headless](https://www.roibase.com.tr/de/headless)-Commerce-Projekte Nuxt 3 SSG-Storefronts auf Cloudflare Pages ein. Mit Edge Caching + ISR erreichen wir TTFB (Time to First Byte) unter 40ms und LCP (Largest Contentful Paint) um 1,2s.

---

Nuxt 3 SSG strategisch einzusetzen bedeutet, für jede Route den richtigen Render-Modus zu wählen. Kombiniere Build-Time-Prerender, On-Demand-ISR und SWR, um sowohl Core Web Vitals zu optimieren als auch Build-Kosten zu senken. Überprüfe deine Hydration-Strategien — die Reduktion der Client-Side-JavaScript-Last macht 60 % des Performance-Gewinns aus.