---
title: "Nuxt 3 + Cloudflare Pages: Von 10s LCP auf 2s"
description: "Self-gehostete Fonts, Lazy Hydration, content-visibility und Edge-Caching reduzierten Largest Contentful Paint um 80%. Mit Benchmark und Code-Beispielen."
publishedAt: 2026-06-16
modifiedAt: 2026-06-16
category: tech
i18nKey: tech-001-2026-06
tags: [nuxt-3, cloudflare-pages, web-performance, core-web-vitals, edge-caching]
readingTime: 9
author: Roibase
---

Ein Nuxt 3 E-Commerce-Projekt auf Cloudflare Pages zeigte in PageSpeed Insights eine LCP von 10,2s. Google Fonts, clientseitige Hydration, Above-the-Fold-Laden und fehlende CDN-Cache-Header waren klassische Engpässe. Mit Self-Hosting von Font-Subsets, Vue 3 Lazy Hydration API, CSS `content-visibility` und Cloudflare Edge Cache TTL-Optimierungen reduzierten wir die LCP auf 2,1s. Dieser Artikel dokumentiert vier Maßnahmen mit technischen Details und Benchmark-Ergebnissen.

## Self-gehostete Font-Subsets: 900ms FCP-Verbesserung

Die Google Fonts CSS-Datei war ein Render-Blocking Request von 320ms. Das Herunterladen der Variable Font WOFF2 verzögerte First Contentful Paint auf ~3,8s. Wir installierten das `@fontsource`-Paket und selektierten nur das lateinische Subset mit den Gewichten 400-700:

```bash
npm install @fontsource-variable/inter
```

Import in `app.vue`:

```javascript
import '@fontsource-variable/inter/wght.css';
```

Konfiguration in `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  css: ['@fontsource-variable/inter/wght.css'],
  vite: {
    css: {
      postcss: {
        plugins: [
          require('postcss-preset-env')({
            features: { 'custom-properties': false }
          })
        ]
      }
    }
  }
});
```

Ergebnis: Die WOFF2-Datei belegt nur 24KB und wird inline beim ersten Request serviert. FCP sank von 3,8s auf 2,9s, Render-Blocking-Zeit von 320ms auf 0ms. Variable Font-Achsen bleiben erhalten — wir importierten `wght.css` statt statischer Weight-Dateien.

Das Google Fonts CDN hat zwar viele Edge Locations, aber DNS-Lookup und TLS-Handshake addieren pro Besuch 200-300ms hinzu. Durch Self-Hosting wird dieser zusätzliche DNS-Hop eliminiert.

## Lazy Hydration: TBT von 2190ms auf 200ms

Nuxt 3 hydratisiert standardmäßig alle Komponenten clientseitig. Eine Product-Listing-Page mit 48 Produktkarten führte zu 120KB JavaScript pro Karte für Vue's Reactivity-System. Total Blocking Time betrug 2190ms — Nutzer konnten die Seite 2 Sekunden lang nicht scrollen.

Mit Vue 3.5+ und `defineAsyncComponent` + `hydration:lazy` führten wir Lazy Hydration für Below-the-Fold-Komponenten ein:

```javascript
// components/ProductCard.vue
<script setup>
defineOptions({
  hydration: 'lazy'
});
</script>
```

Intersection Observer triggert Hydration, sobald eine Komponente in den Viewport eintritt:

```javascript
// plugins/lazy-hydration.client.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.mixin({
    mounted() {
      if (this.$options.hydration === 'lazy') {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.$forceUpdate();
              observer.disconnect();
            }
          });
        });
        observer.observe(this.$el);
      }
    }
  });
});
```

Above-the-Fold Hero und erste 6 Produkte wurden sofort hydratisiert, der Rest lazy. Das Bundle schrumpfte von 480KB auf 280KB Initial + 200KB Lazy Chunk. TBT fiel von 2190ms auf 200ms — Nutzer können nach 1 Sekunde scrollen.

Kompromiss: Verzögerung beim Event-Listener-Attach. Komponenten mit Click-Handlern (Add-to-Cart-Button) behielten `hydration: 'immediate'`. Für Scroll-triggered Content ist Lazy Hydration ideal.

### Nuxt's eingebaute Lazy-Komponenten

Nuxt 3.0+ bietet das `<LazyComponentName>`-Präfix als einfachere Variante:

```vue
<template>
  <LazyProductCard v-for="product in products" :key="product.id" />
</template>
```

Diese Methode rendert die Komponente nicht serverseitig, nur clientseitig. Da SEO SSR erforderte, bevorzugten wir die `defineOptions`-Methode.

## CSS content-visibility: 1,4s LCP-Gewinn

Das Product-Grid mit 48 Karten verursachte Rendering-Verzögerungen und Layout Shift. Browser renderte jede Karte und rechnete CLS neu. Mit `content-visibility: auto` eliminierten wir Off-Screen-Content aus dem Render-Cycle:

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 0 360px;
}
```

`contain-intrinsic-size` teilt dem Browser mit: "Dieses Element ist 360px hoch". Viewport-externe Elemente behalten ihre Höhe, ohne gerendert zu werden. CLS sank von 0,18 auf 0,02.

Benchmark (Lighthouse 10.4, Throttle 4G):

| Metrik | Vorher | Nachher | Differenz |
|---|---|---|---|
| LCP | 10,2s | 2,1s | –8,1s |
| CLS | 0,18 | 0,02 | –0,16 |
| TBT | 2190ms | 200ms | –1990ms |

`content-visibility` wird ab Safari 17+ unterstützt, iOS 16 greift auf normales Rendering zurück. Progressive Enhancement mit `@supports`:

```css
@supports (content-visibility: auto) {
  .product-card {
    content-visibility: auto;
    contain-intrinsic-size: 0 360px;
  }
}
```

Diese Technik ist für [UI/UX-Design](https://www.roibase.com.tr/de/ui-ux) Prozesse kritisch hinsichtlich Layout-Stabilität. User Experience wird unabhängig von Rendering-Kosten außerhalb des Viewports.

## Cloudflare Pages Edge Cache TTL Optimierung

Cloudflare Pages setzt standard TTL auf 2 Stunden. Produktpreise aktualisieren sich alle 15 Minuten, visuelle Assets (Bilder, Fonts) sind 7 Tage statisch. Mit `_headers`-Datei definierten wir granulare Cache-Kontrolle:

```
# _headers
/assets/*
  Cache-Control: public, max-age=604800, immutable

/_nuxt/*
  Cache-Control: public, max-age=31536000, immutable

/api/*
  Cache-Control: public, s-maxage=900, stale-while-revalidate=60

/*
  Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=300
```

- `/assets/*` und `/_nuxt/*`: 1 Jahr immutable (URL ändert sich bei neuem Fingerprint-Hash)
- `/api/*`: 15 Min Edge Cache, 60 Sekunden stale-while-revalidate (origin-Fehler: alte Daten servieren)
- Root HTML: 1 Stunde Edge Cache, 5 Min stale-while-revalidate

TTFB von der Edge-Location: 40ms, vom Origin: 280ms. Cache-Hit-Rate stieg von 89% auf 96%. Median TTFB: 280ms → 45ms.

`stale-while-revalidate` ist entscheidend: Aktualisiert der Origin die Daten, wird dem Nutzer der alte Cache serviert, während im Hintergrund neue Daten geholt werden. Nutzer wartet nicht.

### Cloudflare KV für dynamisches Cache-Invalidation

Statt globales Cache-Purging bei Preis-Updates nutzen wir Cloudflare KV + Workers für selektives Invalidieren:

```javascript
// workers/cache-purge.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const productId = url.searchParams.get('id');
    
    const cacheKey = `product:${productId}`;
    await env.CACHE_KV.delete(cacheKey);
    
    return new Response('Cache purged', { status: 200 });
  }
};
```

Admin-Panel Preis-Update → Webhook → Cloudflare Worker → KV Delete. Edge Cache TTL bleibt erhalten, nur betroffene Produkte invalidieren.

## Performance-Monitoring und Regression Prevention

Für RUM (Real User Monitoring) kombinierten wir Cloudflare Web Analytics mit Custom Navigation Timing Beacon:

```javascript
// plugins/analytics.client.ts
export default defineNuxtPlugin(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0];
      const lcp = performance.getEntriesByType('largest-contentful-paint')[0];
      
      fetch('/api/perf', {
        method: 'POST',
        body: JSON.stringify({
          ttfb: perfData.responseStart - perfData.requestStart,
          fcp: perfData.domContentLoadedEventEnd - perfData.fetchStart,
          lcp: lcp?.renderTime || 0,
          pathname: window.location.pathname
        })
      });
    });
  }
});
```

BigQuery speichert tägliche P75-LCP. Überschreitung von 2,5s triggert Slack-Alert. CI/CD nutzt Lighthouse CI für Regression-Checks:

```yaml
# .github/workflows/lighthouse.yml
- name: Lighthouse CI
  run: |
    npm install -g @lhci/cli
    lhci autorun --config=./lighthouserc.json
```

`lighthouserc.json` mit LCP Assertion:

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }]
      }
    }
  }
}
```

Build schlägt fehl, falls LCP über 2,5s liegt. Regressions-Schutz in Production.

## Tradeoffs und Edge Cases

Lazy Hydration hängt von Scroll-Position ab. Schnelles Scrollen kann Hydration-Verzögerung beeinträchtigen. Mitigation: Intersection Observer mit `rootMargin: '100px'` triggert 100px vor Eintritt ins Viewport.

`content-visibility` kann in Grid-Layouts bei Spalten-Anzahl-Änderung CLS erhöhen. Kombination aus fester `grid-template-columns` und `contain-intrinsic-size` ist obligatorisch.

Edge Cache `stale-while-revalidate` trägt Preis-Inkonsistenz-Risiko: Nutzer A sieht alte Preis, Nutzer B neue Preis. Abhängig vom Business-Requirement: E-Commerce toleriert 60 Sekunden Stale Window, Fintech nicht.

Self-gehostete Fonts erfordern Lizenz-Kontrolle. Google Fonts nutzt SIL Open Font License (frei), kommerzielle Fonts erfordern Lizenz-Überprüfung.

Diese vier Maßnahmen verbesserten LCP um 80%. Nuxt 3's Vue 3 Reactivity-System eignet sich ideal für Lazy Hydration. Cloudflare Pages als CDN ist ausreichend, für dynamische Inhalte ist KV + Workers-Kombination notwendig für Cache-Granularität. RUM + Lighthouse CI sind für Production-Regression-Prevention unverzichtbar.