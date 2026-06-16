---
title: "Nuxt 3 + Cloudflare Pages : LCP de 10s à 2s"
description: "Fonts auto-hébergées, hydration lazy, content-visibility et edge caching pour réduire le Largest Contentful Paint de 80%. Benchmarks et code inclus."
publishedAt: 2026-06-16
modifiedAt: 2026-06-16
category: tech
i18nKey: tech-001-2026-06
tags: [nuxt-3, cloudflare-pages, web-performance, core-web-vitals, edge-caching]
readingTime: 9
author: Roibase
---

Un projet e-commerce Nuxt 3 déployé sur Cloudflare Pages affichait un LCP de 10,2s sur PageSpeed Insights. Google Fonts, hydration côté client, chargement above-the-fold et headers cache CDN étaient les goulots classiques. En utilisant le subsetting de fonts auto-hébergées, l'API lazy hydration de Vue 3, la propriété CSS `content-visibility` et les réglages de TTL edge cache Cloudflare, nous avons ramené le LCP à 2,1s. Voici les détails techniques des quatre interventions et les résultats mesurés.

## Subsetting de fonts auto-hébergées : réduction FCP de 900ms

Le fichier CSS Google Fonts était une requête de 320ms bloquant le rendu. Après le téléchargement de la variable font WOFF2, le First Contentful Paint se situait autour de 3,8s. Nous avons installé le paquet `@fontsource` et sélectionné uniquement le subset Latin + plage de weights 400-700 :

```bash
npm install @fontsource-variable/inter
```

Import dans `app.vue` :

```javascript
import '@fontsource-variable/inter/wght.css';
```

Réglage dans `nuxt.config.ts` :

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

Résultat : fichier WOFF2 de 24KB, servi en ligne lors de la première requête. FCP 3,8s → 2,9s. Durée bloquant le rendu 320ms → 0ms. Nous avons conservé les axes de variable font en important `wght.css` plutôt que des fichiers de poids statiques.

Bien que le CDN de Google Fonts dispose de nombreux points de présence, le lookup DNS + poignée de main TLS ajoute 200-300ms pour chaque visiteur. Avec le serveur auto-hébergé, le temps de servir depuis l'edge de Cloudflare Pages est identique, mais nous éliminons le hop DNS supplémentaire.

## Hydration lazy : TBT 2190ms → 200ms

Nuxt 3 hydrate tous les composants côté client par défaut. Sur une page de liste de produits avec 48 cartes, chacune a généré 120KB de JavaScript à parser pour le système de réactivité Vue. Le Total Blocking Time s'élevait à 2190ms — l'utilisateur ne pouvait pas faire défiler la page pendant 2 secondes.

Nous avons utilisé `defineAsyncComponent` + `hydration:lazy` de Vue 3.5+ pour hydrater les composants below-the-fold au besoin :

```javascript
// components/ProductCard.vue
<script setup>
defineOptions({
  hydration: 'lazy'
});
</script>
```

Avec Intersection Observer pour hydrater lorsqu'ils entrent dans le viewport :

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

Le héros above-the-fold + les 6 premiers produits sont hydratés immédiatement, les autres en mode lazy. Taille du bundle 480KB → 280KB initial, 200KB lazy chunk. TBT 2190ms → 200ms. L'utilisateur peut faire défiler après 1 seconde.

Compromis : délai d'attachement du listener d'événement lazy hydration. Pour les composants avec des gestionnaires de clics, nous avons gardé `hydration: 'immediate'` (bouton Ajouter au panier). Pour le contenu déclenché au scroll, lazy est idéal.

### Composant Lazy intégré de Nuxt

Nuxt 3.0+ inclut le préfixe `<LazyComponentName>` qui fait la même chose :

```vue
<template>
  <LazyProductCard v-for="product in products" :key="product.id" />
</template>
```

Cependant, cette méthode ne rend pas le composant côté serveur, seulement côté client. Dans notre configuration, SSR était requis pour le SEO, donc nous avons préféré l'approche `defineOptions`.

## CSS content-visibility : gain LCP de 1,4s

Dans la grille de produits avec 48 cartes, le rendu provoquait un layout shift. Le navigateur rendait chaque carte et calculait CLS, retardant le LCP. Nous avons utilisé `content-visibility: auto` pour retirer le contenu off-screen du cycle de rendu :

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 0 360px;
}
```

`contain-intrinsic-size` dit au navigateur « cet élément mesure 360px de haut », conservant une hauteur de placeholder en dehors du viewport. Layout shift CLS 0,18 → 0,02.

Benchmark (Lighthouse 10.4, réseau throttlé 4G) :

| Métrique | Avant | Après | Delta |
|---|---|---|---|
| LCP | 10,2s | 2,1s | -8,1s |
| CLS | 0,18 | 0,02 | -0,16 |
| TBT | 2190ms | 200ms | -1990ms |

`content-visibility` est supporté Safari 17+, iOS 16 se replie sur le rendu normal. Nous utilisons `@supports` pour l'amélioration progressive :

```css
@supports (content-visibility: auto) {
  .product-card {
    content-visibility: auto;
    contain-intrinsic-size: 0 360px;
  }
}
```

Cette approche est critique dans le processus [UI/UX Design](https://www.roibase.com.tr/fr/ui-ux) pour la stabilité du layout. L'expérience utilisateur devient indépendante du coût de rendu du contenu en dehors du viewport.

## Optimisation TTL Edge Cache Cloudflare Pages

Le TTL edge cache par défaut de Cloudflare Pages est de 2 heures. Les prix des produits se mettent à jour toutes les 15 minutes, mais les assets visuels (images, fonts) restent statiques pendant 7 jours. Nous avons utilisé le fichier `_headers` pour un contrôle granulaire du cache :

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

- `/assets/*` et `/_nuxt/*` : 1 an immutable (hash d'empreinte digitale, URL change = nouveau fichier)
- `/api/*` : 15 minutes edge cache, 60 secondes stale-while-revalidate (en cas de défaillance origin, servir les anciennes données)
- HTML racine : 1 heure edge cache, 5 minutes stale-while-revalidate

Time to First Byte depuis l'edge 40ms, depuis l'origin 280ms. Taux de hit edge %89 → %96. TTFB médian 280ms → 45ms.

`stale-while-revalidate` est critique pour l'utilisateur : si l'origin se met à jour, servir le cache ancien et récupérer les nouvelles données en arrière-plan. L'utilisateur n'attend jamais.

### Purge dynamique avec Cloudflare KV

Au lieu de purger tout le cache lors d'une mise à jour des prix, nous utilisons Cloudflare KV + Workers pour invalider de manière sélective :

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

Mise à jour prix panel admin → webhook → Cloudflare Worker → suppression KV. Le TTL edge cache est préservé, seuls les produits modifiés sont invalidés.

## Suivi de la performance et prévention des régressions

Pour RUM (Real User Monitoring), nous utilisons Cloudflare Web Analytics + beacon Navigation Timing personnalisé :

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

Suivi P75 LCP quotidien dans BigQuery. Alerte Slack si le seuil de 2,5s est dépassé. Pipeline CI/CD avec Lighthouse CI pour vérifier les régressions :

```yaml
# .github/workflows/lighthouse.yml
- name: Lighthouse CI
  run: |
    npm install -g @lhci/cli
    lhci autorun --config=./lighthouserc.json
```

Assertions LCP dans `lighthouserc.json` :

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

Si le LCP dépasse 2,5s avant le déploiement, la build échoue. Regréssion en production évitée.

## Compromis et cas limites

Lazy hydration dépend de la position du scroll. Si l'utilisateur fait défiler rapidement, le délai d'hydration peut affecter l'interactivité. Atténuation : déclencher Intersection Observer avec `rootMargin: '100px'` avant que l'élément n'entre dans le viewport.

`content-visibility` sur les grilles peut augmenter CLS lors d'un changement de compte de colonnes. Combinaison obligatoire : `grid-template-columns` fixe + `contain-intrinsic-size`.

Risque d'incohérence prix avec edge cache stale-while-revalidate : utilisateur A voit l'ancien prix, utilisateur B le nouveau. Décision selon exigence métier : e-commerce accepte 60 secondes de fenêtre stale, fintech non.

Vérification de la licence de la font auto-hébergée requise. Google Fonts sous licence SIL Open Font libre d'utilisation, les fonts commerciales nécessitent vérification d'accord de licence.

Ces quatre interventions ont amélioré le LCP de 80%. Le système de réactivité Vue 3 de Nuxt 3 est idéal pour lazy hydration. Le réseau edge de Cloudflare Pages est suffisant comme CDN, mais pour le contenu dynamique, la combinaison KV + Workers fournit la granularité de cache. En production, RUM + Lighthouse CI sont obligatoires pour prévenir les régressions.