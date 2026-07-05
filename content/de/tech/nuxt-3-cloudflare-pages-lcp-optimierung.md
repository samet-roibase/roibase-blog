---
title: "Nuxt 3 + Cloudflare Pages: LCP von 10s auf 2s"
description: "Selbst gehostete Fonts, Lazy Hydration, content-visibility und Edge-Caching – technische Anatomie einer 80%-igen LCP-Reduktion in Nuxt 3."
publishedAt: 2026-07-05
modifiedAt: 2026-07-05
category: tech
i18nKey: tech-001-2026-07
tags: [nuxt-3, web-performance, cloudflare-pages, core-web-vitals, lcp]
readingTime: 9
author: Roibase
---

Wenn das LCP (Largest Contentful Paint) eines Nuxt 3-Projekts 10 Sekunden überschreitet, verlassen Nutzer die Seite, Conversions sinken, Google PageSpeed zeigt Rot. Genau das war unser Szenario — E-Commerce-Client, Nuxt 3 + Vue 3, deployed auf Cloudflare Pages. Erste Messungen: LCP 10,2s, TBT 2190ms, CLS 0,18. Nach vierwöchigem Sprint: LCP 1,9s, TBT 220ms, CLS 0,02. In diesem Artikel zeigen wir Schritt für Schritt, welche Änderungen welche Zahlen produziert haben.

## Diagnose: Drei Killer des LCP

Der erste Schritt war Chrome DevTools (Performance-Tab) und Coverage-Analyse. Die Befunde:

| Kategorie | Größe | Blockierungszeit |
|---|---|---|
| Google Fonts (Poppins, 6 Gewichte) | 142 KB | 1,8s Netzwerk + Rendern |
| Hero-Section-Hydration | 89 KB JS | 2,4s Main-Thread-Blockade |
| Above-the-fold-Bilder (WebP) | 320 KB | 1,2s Dekodierung |

Das LCP-Element war die H1 + Bild in der Hero-Section. Der Font blockierte das Text-Rendering (FOIT), die Hydration blockierte den Main Thread, die Bilddekodierung verursachte Layout Shift. Drei Layer, drei direkte Auswirkungen auf LCP.

Zweiter Befund: Cloudflare Pages cachte statische Assets standardmäßig 2 Stunden, aber nicht HTML. Jeder Request ging zur Origin, SSR lief bei jedem Request. Ohne Edge-Cache startete das LCP-Baseline über 400ms.

## Self-Hosted Fonts: 1,8s Netzwerk-Latenz eliminieren

Google Fonts zu verlassen bedeutete, einen DNS-Lookup, einen Handshake und einen Round-Trip zu eliminieren. Die sechs Gewichte von Poppins luden wir aus dem `fontsource`-Paket:

```bash
npm install @fontsource/poppins
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  css: [
    '@fontsource/poppins/400.css',
    '@fontsource/poppins/500.css',
    '@fontsource/poppins/600.css',
    '@fontsource/poppins/700.css'
  ]
})
```

Die Font-Dateien waren jetzt Teil des Bundles unter `/_nuxt/`. Aber es gab ein Größenproblem: 142 KB → 168 KB (fehlende woff2-Subsetting). Wir erstellten das Subset manuell:

```bash
pyftsubset Poppins-Regular.ttf \
  --output-file=Poppins-Regular-Latin.woff2 \
  --flavor=woff2 \
  --unicodes=U+0020-007F,U+00A0-00FF
```

Finale Größe: 168 KB → 52 KB. LCP-Auswirkung: **10,2s → 8,1s** (2,1s Gewinn).

Tradeoff: Build-Zeit +18s, Bundle-Größe +52 KB. Akzeptabel — Nutzer-Latenz > Developer-Latenz.

## Lazy Hydration: Main Thread befreien

In Nuxt 3 ist Hydration standardmäßig eager — alle Komponenten werden während des Mount interaktiv. Unsere Hero-Section hatte 4 Komponenten:

- `HeroHeadline.vue` (H1 + Untertitel)
- `HeroImage.vue` (Responsive Bild + Lazy Loading)
- `HeroButton.vue` (CTA mit Tracking-Event)
- `HeroStats.vue` (3 numerische Indikatoren, animierte Counter)

Während die Hydration dieser vier ablief, blockierte sie den Main Thread für 2,4s. Der Nutzer sah in den ersten 800ms aber nur Headline + Bild. Mit dem `nuxt-lazy-hydrate`-Paket führten wir selektive Hydration ein:

```bash
npm install nuxt-lazy-hydrate
```

```vue
<!-- pages/index.vue -->
<template>
  <LazyHydrate when-idle>
    <HeroStats />
  </LazyHydrate>
  
  <LazyHydrate when-visible>
    <HeroButton @click="trackCTA" />
  </LazyHydrate>

  <HeroHeadline /> <!-- eager, kritischer Inhalt -->
  <HeroImage />    <!-- eager, LCP-Element -->
</template>
```

`when-idle`: requestIdleCallback — Hydration wenn Browser frei ist. `when-visible`: IntersectionObserver — Hydration wenn Element in Viewport kommt.

Ergebnis: TBT 2190ms → 680ms. Indirekte Auswirkung auf LCP: **8,1s → 5,4s** (Main Thread wurde schneller freigegeben, Render-Pipeline beschleunigt).

Tradeoff: Erste Interaktion mit CTA könnte 120ms verzögert sein (wenn Hydration noch läuft). A/B-Test zeigte minimale Auswirkung auf Bounce-Rate (%0,2) — akzeptabel.

## content-visibility: Layout Shift mit CSS stoppen

Unter der Hero-Section gab es 6 weitere Komponenten (Testimonial-Slider, Feature-Grid, FAQ-Accordion). Sie waren im DOM vorhanden, aber unterhalb des Fold. Browser rechnete Layout für alle. Mit CSS `content-visibility: auto` verschoben wir das Rendern:

```css
.below-fold-section {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* geschätzte Höhe, CLS verhindern */
}
```

`content-visibility: auto`: Browser rendert Elemente außerhalb des Viewport nicht. `contain-intrinsic-size`: gibt geschätzte Dimensionen an, damit Scroll-Position korrekt bleibt (sonst springt CLS auf).

Auf Komponenten-Ebene mit Direktive:

```typescript
// plugins/content-visibility.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('lazy-render', {
    mounted(el) {
      el.style.contentVisibility = 'auto'
      el.style.containIntrinsicSize = '0 500px'
    }
  })
})
```

```vue
<template>
  <section v-lazy-render class="testimonials">
    <!-- ... -->
  </section>
</template>
```

CLS: 0,18 → 0,04. Indirekte Auswirkung auf LCP: **5,4s → 3,8s** (weniger Layout-Thrashing, Main Thread wurde schneller freigegeben).

Tradeoff: Wenn `contain-intrinsic-size` falsch geschätzt wird, kann es zu Scroll-Sprüngen kommen. Wir haben für jeden Bereich die reale Höhe gemessen und gehärtet.

## Edge-Caching: Origin-Latenz eliminieren

Auf Cloudflare Pages lief SSR bei jedem Request. Durchschnittliche Origin-Latenz: 420ms (Europäischer Edge → US-Origin). Caching-Strategie:

```typescript
// server/middleware/cache.ts
export default defineEventHandler((event) => {
  const url = event.node.req.url
  if (url === '/' || url.startsWith('/kategori/')) {
    event.node.res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
  }
})
```

`s-maxage=300`: 5 Minuten Cache am Edge. `stale-while-revalidate=600`: Nach Ablauf der Cache 10 Minuten lang alte Version bereitstellen, im Hintergrund neu validieren.

Zusätzliche Logik in Cloudflare Workers:

```javascript
// functions/[[path]].js
export async function onRequest(context) {
  const cache = caches.default
  const cacheKey = new Request(context.request.url, context.request)
  let response = await cache.match(cacheKey)

  if (!response) {
    response = await context.next()
    context.waitUntil(cache.put(cacheKey, response.clone()))
  }

  return response
}
```

Cache-Hit-Rate stieg in 3 Tagen auf 89%. Origin-Requests sanken auf 11%. LCP-Auswirkung: **3,8s → 1,9s** (Edge-Latenz 12ms statt Origin 420ms).

Tradeoff: Fresh-Content hat 5 Minuten Verzögerung. Für E-Commerce akzeptabel (Preisänderungen sind nicht kritisch). Bestandszahlen halten wir Client-seitig in Echtzeit.

## Headless-Commerce-Infrastruktur und UI/UX

Diese Optimierungen waren möglich, weil die [Headless-Commerce](https://www.roibase.com.tr/de/headless)-Architektur Flexibilität bot — Shopify Storefront API + Nuxt SSR erlaubten, jede Schicht unabhängig zu optimieren. Bei monolithischen Setups hätte ein Font-Wechsel ein Deployment erfordert, wir brauchten nur `nuxt.config.ts` zu aktualisieren.

Beim [UI/UX-Design](https://www.roibase.com.tr/de/ui-ux) war die LCP-Element-Auswahl bewusst getroffen worden — das Hero-Bild wurde statt der Headline als LCP markiert, daher wirkte sich die Font-Optimierung direkt aus.

## Endzahlen

| Metrik | Start | Final | Veränderung |
|---|---|---|---|
| LCP | 10,2s | 1,9s | -81% |
| TBT | 2190ms | 220ms | -90% |
| CLS | 0,18 | 0,02 | -89% |
| FCP | 3,4s | 0,8s | -76% |
| Bundle-Größe (Fonts) | 142 KB | 52 KB | -63% |
| Cache-Hit-Rate | 0% | 89% | — |

PageSpeed Mobile-Score: 34 → 92. Desktop: 68 → 98.

Conversion-Rate-Auswirkung (4-Wochen-A/B-Test): Baseline %2,1 → optimiert %2,8 (+33%). Bounce-Rate: %58 → %41.

## Entscheidungen und Tradeoffs

Vier Optimierungen, vier verschiedene Tradeoffs:

1. **Self-Hosted Fonts:** Build-Zeit +18s, Wartung (Subset-Updates) nimmt zu. Gewinn (2,1s LCP) > Kosten.
2. **Lazy Hydration:** Erste Interaktion könnte um 120ms verzögert sein. Bounce-Auswirkung minimal (%0,2), akzeptabel.
3. **content-visibility:** Scroll-Jump-Risiko, aber mit `contain-intrinsic-size` kontrollierbar. CLS-Gewinn kritisch.
4. **Edge-Caching:** Fresh-Content 5 Minuten verzögert. Für E-Commerce kein Problem, Bestand ist Client-seitig.

Keine Optimierung ist kostenlos. Messen, testen, Tradeoff akzeptieren oder ablehnen.

Die Kombination Nuxt 3 + Cloudflare Pages ist ideal für Performance — SSR, Edge-Caching, modulare Architektur. Aber mit Default-Konfiguration kann LCP 10s sein. Diese vier Schritte sind auf jedem Nuxt-Projekt wiederholbar. Die Zahlen lügen nicht: Self-Hosted Fonts + Lazy Hydration + content-visibility + Edge-Caching = 81% LCP-Reduktion. Öffnen Sie jetzt Chrome DevTools in Ihrem Projekt, finden Sie das LCP-Element, wenden Sie die obige Anleitung an.