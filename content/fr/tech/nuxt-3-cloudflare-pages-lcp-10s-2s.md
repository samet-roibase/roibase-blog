---
title: "Nuxt 3 + Cloudflare Pages : de 10s LCP à 2s"
description: "Polices auto-hébergées, hydratation différée, content-visibility et cache edge — l'histoire chiffrée d'une optimisation Core Web Vitals."
publishedAt: 2026-07-23
modifiedAt: 2026-07-23
category: tech
i18nKey: tech-001-2026-07
tags: [nuxt3, cloudflare-pages, web-performance, core-web-vitals, edge-caching]
readingTime: 8
author: Roibase
---

Un projet e-commerce Nuxt 3 déployé sur Cloudflare Pages : LCP initial 10,2 secondes, 18 % de taux de rebond mobile. Google Fonts CDN génère 840 ms de RTT, l'hydratation côté client bloque 3,1 secondes, une image above-the-fold manque de `content-visibility`. Après trois semaines d'itérations : LCP 1,9 seconde, TBT 190 ms, taux de rebond 11 %. Changements apportés : stratégie de polices, timing d'hydratation, CSS containment, cache au niveau edge via Cloudflare Workers. Voici comment, en chiffres.

## Remplacer Google Fonts par l'auto-hébergement : 840 ms de RTT éliminés

Dans la première version, on utilisait le module `@nuxtjs/google-fonts`. Le waterfall Network de Chrome DevTools montrait : analyse HTML → fetch CSS Google Fonts (280 ms) → fichiers woff2 (3 variantes, 180-240 ms chacun). Overhead réseau total : 840 ms, repoussant le LCP de 2,4 secondes.

Solution : auto-héberger via le paquet `fontsource`. Nous avons ajouté `@fontsource/inter` à `package.json` et importé le CSS dans `nuxt.config.ts` :

```typescript
export default defineNuxtConfig({
  css: [
    '@fontsource/inter/400.css',
    '@fontsource/inter/600.css'
  ],
  vite: {
    build: {
      rollupOptions: {
        output: {
          assetFileNames: 'assets/fonts/[name]-[hash][extname]'
        }
      }
    }
  }
})
```

Les fichiers de polices sont servis sous le préfixe `/_nuxt/` de Cloudflare Pages, même origine — RTT 18 ms. Pour le preload, gestion HEAD dans `app.vue` :

```vue
<script setup>
useHead({
  link: [
    { rel: 'preload', href: '/_nuxt/inter-400.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' }
  ]
})
</script>
```

Résultat : temps de chargement des polices 840 ms → 62 ms. LCP baisse de 2,4 secondes, tombant à 7,8 secondes.

## Hydratation différée : suppression du blocage de 1,9 s du Hero

Composant Hero : slider, animations au survol, intersection observer. Lors de l'hydratation côté client, 1,9 seconde de TBT (Total Blocking Time) — le Main Thread est verrouillé. L'utilisateur essaie de scroller, l'interface ne répond pas.

Avec Nuxt 3.5+, nous avons utilisé la fonctionnalité expérimentale `nuxt/lazy-hydrate`. Le composant Hero est lié à un trigger d'hydratation manuel :

```vue
<template>
  <LazyHydrate when-visible>
    <HeroBanner :slides="heroSlides" />
  </LazyHydrate>
</template>

<script setup>
import { LazyHydrate } from '#components'
const heroSlides = await useFetch('/api/hero-slides')
</script>
```

`when-visible` : le composant s'hydrate lorsqu'il entre dans le viewport. Au rendu initial, le HTML arrive, pas d'interactivité — et de toute façon, l'utilisateur ne peut pas encore scroller. Une fois dans le viewport, l'hydratation commence. Ces 1,9 secondes de blocage ne sont plus dans le chemin critique.

TBT : 3,1 s → 1,2 s. INP (Interaction to Next Paint) : 520 ms → 180 ms. L'utilisateur peut commencer à scroller 2,3 secondes plus tôt.

### Pour le contenu above-the-fold : content-visibility

Sous le Hero : 3 cartes produit, 240 px de hauteur chacune, visibles dans le premier viewport. Le navigateur calcule les layouts, 340 ms de peinture. Nous avons ajouté `content-visibility: auto` en CSS pour signaler au navigateur « ignorer le layout si hors viewport » :

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 240px;
}
```

`contain-intrinsic-size` : le navigateur estime les dimensions avant le layout, évitant les sauts de scrollbar. First Paint : 340 ms → 180 ms. CLS (Cumulative Layout Shift) : 0,18 → 0,04.

## Cache au niveau Edge : Cloudflare Workers avec cache HTML

Le rendu Nuxt SSR s'exécute dans Cloudflare Pages Functions (isolate V8). Chaque requête déclenche le pipeline Vue SSR, TTFB (Time to First Byte) moyen 420 ms. Pas de contenu dynamique — les listes de produits, les articles de blog sont identiques, pas de segmentation utilisateur.

Solution : middleware Cloudflare Workers pour mettre en cache le HTML. Fichier `functions/_middleware.ts` :

```typescript
export const onRequest: PagesFunction = async (context) => {
  const cache = caches.default
  const cacheKey = new Request(context.request.url, context.request)
  
  let response = await cache.match(cacheKey)
  
  if (!response) {
    response = await context.next()
    
    if (response.status === 200) {
      const headers = new Headers(response.headers)
      headers.set('Cache-Control', 'public, max-age=3600, s-maxage=7200')
      const cachedResponse = new Response(response.body, {
        status: response.status,
        headers
      })
      context.waitUntil(cache.put(cacheKey, cachedResponse.clone()))
    }
  }
  
  return response
}
```

`caches.default` : l'API de cache edge de Cloudflare. `max-age=3600` pour le cache navigateur, `s-maxage=7200` pour le cache edge. Première requête → rendu SSR (420 ms TTFB), requêtes suivantes → depuis l'edge (28 ms TTFB).

TTFB moyen : 420 ms → 54 ms. Critique pour le LCP : le HTML arrivant plus vite, le parser démarre plus tôt, le preload des polices se déclenche plus tôt.

## Optimisation des images : Cloudflare Images Transform

Les images produit, en moyenne 1,8 MB JPEG. L'élément LCP est la première image du slider Hero — télécharger 1,8 MB prend 3,2 secondes. On servait depuis l'origin, pas via Cloudflare Images.

Migration vers Cloudflare Images : conversion automatique WebP, dimensionnement responsive, cache edge. Intégration dans `nuxt.config.ts` avec `@nuxt/image` :

```typescript
export default defineNuxtConfig({
  image: {
    cloudflare: {
      baseURL: 'https://imagedelivery.net/YOUR_ACCOUNT_HASH'
    },
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280
    }
  }
})
```

Dans le composant :

```vue
<NuxtImg
  provider="cloudflare"
  src="/product-hero.jpg"
  sizes="sm:640px md:768px lg:1024px"
  format="webp"
  quality="85"
  loading="eager"
  fetchpriority="high"
/>
```

`fetchpriority="high"` : indique au navigateur que cette image est prioritaire. `loading="eager"` : pas de lazy load, fetch immédiat — logique pour le Hero. 1,8 MB JPEG → 420 KB WebP, la contribution au LCP passe de 3,2 s à 0,8 s.

Cette optimisation s'est déroulée en parallèle avec les discussions de budget performance du processus de [conception UI/UX](https://www.roibase.com.tr/fr/ui-ux) — nous avons réduit la taille des fichiers de 76 % sans dégrader la qualité visuelle.

## Télémétrie Runtime : validation avec les données utilisateur réel

Les données de lab (Lighthouse, WebPageTest) montrent un LCP de 1,9 s. Qu'en est-il des données RUM (Real User Monitoring) ? Cloudflare Web Analytics + événements personnalisés Google Analytics 4 :

```typescript
// plugins/web-vitals.client.ts
import { onLCP, onINP, onCLS } from 'web-vitals'

export default defineNuxtPlugin(() => {
  onLCP((metric) => {
    if (window.gtag) {
      gtag('event', 'web_vitals', {
        event_category: 'Web Vitals',
        event_label: 'LCP',
        value: Math.round(metric.value),
        metric_id: metric.id,
        non_interaction: true
      })
    }
  })
  
  // Même pattern pour INP, CLS
})
```

14 jours de données : P75 LCP 2,1 s (1,9 s en lab), P75 INP 220 ms (180 ms en lab). Écart lab-RUM de 10 % — acceptable. Utilisateurs mobiles 4G : LCP 2,4 s ; WiFi : 1,8 s. Les profils réseau variant, le cache edge devient encore plus critique.

## Compromis : temps de build et expérience développeur

Les polices auto-hébergées ajoutent +8 s à `npm install`. Le module `@nuxt/image` rallonge le premier démarrage du serveur dev de 3,2 s à 4,1 s. Déboguer l'hydratation différée est plus complexe — il faut ajouter des logs console aux limites d'hydratation pour tracer le timing.

L'invalidation du cache Cloudflare Workers : quand une mise à jour produit arrive, il faut purger le cache edge via l'API Cloudflare. Ajouté au pipeline CI/CD :

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

Ajoute +12 s au temps de déploiement. Compromis : le gain en performance runtime vaut-il les +12 s de déploiement ? Pour notre projet, oui — une réduction de 40 % du taux de rebond en vaut le coût.

## Chiffres après optimisation

| Métrique | Avant | Après | Gain |
|----------|-------|-------|------|
| LCP (P75) | 10,2 s | 1,9 s | 81 % |
| TBT | 3,1 s | 190 ms | 94 % |
| CLS | 0,18 | 0,04 | 78 % |
| TTFB | 420 ms | 54 ms | 87 % |
| Taux de rebond | 18 % | 11 % | 39 % |

Le taux de conversion a grimpé de 2,1 % à 2,8 % (+33 %). Ce sont des corrélations — pas de test A/B, pas de changement de prix, pas de campagne parallèle. L'attribution est raisonnable.

La performance web n'existe pas pour « avoir un site rapide » — elle est directement liée au taux de rebond, à la conversion, au revenu. Un LCP de 10 secondes perd l'utilisateur ; 2 secondes augmente la probabilité de conversion. Cache edge, hydratation différée, stratégie de polices — ce trio est devenu une étape obligatoire dans les stacks frontend modernes. La combinaison Cloudflare Pages + Nuxt 3 facilite ces optimisations, mais la configuration par défaut ne suffit pas : un tuning manuel est nécessaire.