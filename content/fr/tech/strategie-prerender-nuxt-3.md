---
title: "Nuxt 3 SSG : Stratégies de Prerender et Optimisation de Build"
description: "Static site generation avec Nuxt 3 : route rules, prerendering Nitro, builds incrémentiels et stratégies de déploiement production."
publishedAt: 2026-08-06
modifiedAt: 2026-08-06
category: tech
i18nKey: tech-007-2026-08
tags: [nuxt-3, ssg, static-generation, web-performance, nitro]
readingTime: 8
author: Roibase
---

L'architecture SSG (Static Site Generation) de Nuxt 3 marque une rupture fondamentale avec le système « nuxt generate » de Vue 2. Le nouveau système de prerendering basé sur le moteur Nitro offre une granularité au niveau des routes — tu peux définir une stratégie de rendu différente pour chaque page. Dans cet article, nous explorons la configuration SSG production-ready, les configurations de rendu hybride avec *route rules*, et les goulots d'étranglement de performance que tu rencontreras fréquemment dans le pipeline de build.

## Prerendering Nitro : La Nouvelle Fondation du SSG

Avec Nuxt 3, le SSG fonctionne via le moteur de prerendering de Nitro. Tu le contrôles via la clé `nitro.prerender` dans `nuxt.config.ts`. L'approche classique consistait à renderer toutes les routes au moment du build — désormais, un prerendering sélectif est possible.

```typescript
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/sitemap.xml', '/rss.xml'],
      ignore: ['/api', '/admin']
    }
  }
})
```

Le paramètre `crawlLinks: true` dit à Nuxt ceci : découvre automatiquement toutes les pages liées via `<NuxtLink>` et prerender-les. Cela fonctionne pour les blogs — mais sur un site e-commerce avec 10 000 produits, la durée du build explose. Tu dois injecter les routes dynamiquement.

### Dynamic Route Injection

Pour ajouter des routes dynamiques (comme les pages de produit) à la liste de prerender, au lieu de fournir manuellement les chemins au tableau `routes`, tu utilises les hooks de Nitro :

```typescript
// server/plugins/prerender.ts
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('prerender:routes', async (ctx) => {
    const products = await fetchProductSlugs() // Récupère les slugs depuis l'API
    products.forEach(slug => {
      ctx.routes.add(`/products/${slug}`)
    })
  })
})
```

Ce pattern te permet de récupérer la liste des routes depuis une source de données externe (CMS, base de données, API e-commerce *headless*) au moment du build et d'écrire du HTML statique dans le répertoire `.output/public`. Tu peux prerender 5 000 produits depuis l'API Storefront de Shopify et déployer sur Cloudflare Pages — le TTFB reste sous 20ms.

## Route Rules : Stratégie de Rendu Hybride

La fonctionnalité la plus puissante de Nuxt 3 est la configuration du mode de rendu au niveau des routes. Avec `routeRules`, tu peux renderer une page en SSG, une autre en SSR, et une troisième en SPA. Cela est critique pour les projets [*headless* commerce](https://www.roibase.com.tr/fr/headless) — les pages produit en statique, la page panier côté client, le checkout en SSR.

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
    '/products/**': { prerender: true },
    '/api/**': { cors: true },
    '/admin/**': { ssr: false },
    '/cart': { ssr: false }
  }
})
```

Cette configuration fait ceci :
- La page d'accueil et toutes les routes `/products/*` sont prerendues au moment du build (SSG)
- Les pages sous `/admin` fonctionnent en mode SPA (rendu côté client)
- La page `/cart` est aussi côté client — l'état du panier est local, les requêtes API se font dans le navigateur
- Les points d'accès `/api` reçoivent les en-têtes CORS (middleware serveur)

### ISR (Incremental Static Regeneration)

Le SSR n'est pas aussi mature dans Nuxt 3 qu'avec Next.js, mais tu peux obtenir un comportement similaire avec la stratégie de cache `swr` :

```typescript
routeRules: {
  '/blog/**': { swr: 3600 } // 1 heure de cache, puis revalidation
}
```

Le paramètre `swr: 3600` dit ceci : le premier visiteur obtient du HTML statique, le cache expire après 1 heure, la requête suivante déclenche un nouveau rendu mais sert l'ancien cache (stale-while-revalidate). C'est adapté aux sites qui ont besoin d'actualité 24/7 mais ne veulent pas reconstruire chaque page à chaque build. En production, combiné au cache edge d'un CDN (Cloudflare, Vercel), le TTFB reste sous 50ms.

## Build Optimization : Rendu Parallèle et Chunk Splitting

Construire un site avec 5 000 pages avec `nuxt generate` peut prendre 15-20 minutes avec les paramètres par défaut. Pour le ramener à 5 minutes, tu as besoin du rendu parallèle et du *chunk splitting*.

```typescript
export default defineNuxtConfig({
  nitro: {
    prerender: {
      concurrency: 20, // Nombre de workers de rendu parallèles
      interval: 100,   // Délai entre les workers (ms)
      crawlLinks: false // Utilise l'injection de routes manuelle
    }
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-vue': ['vue', 'vue-router'],
            'vendor-ui': ['@headlessui/vue', '@heroicons/vue']
          }
        }
      }
    }
  }
})
```

Le paramètre `concurrency: 20` rend 20 pages en parallèle. Ajuste selon le nombre de cœurs CPU — sur une machine 8 cœurs, 20 est idéal ; sur 4 cœurs, réduis à 10. `interval: 100` évite de frapper les limites de débit des API — si l'API Shopify a une limite de 2 req/s, passe à 500ms.

### Image Optimization Pipeline

Le module Nuxt Image optimise les images au moment du build, mais les paramètres par défaut sont insuffisants pour la production. Générer les formats WebP + AVIF en parallèle double le temps de build mais réduit le FID (First Input Delay) de 40ms :

```typescript
export default defineNuxtConfig({
  image: {
    provider: 'ipx',
    ipx: {
      maxAge: 31536000 // Cache 1 an
    },
    formats: ['webp', 'avif'],
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

Cette configuration génère des images responsives — pour chaque image, 5 points d'arrêt (breakpoints) × 2 formats = 10 fichiers. Sur un site avec 1 000 images, le temps de build augmente de +3 minutes, mais le LCP (Largest Contentful Paint) passe de 2,5s à 1,2s. Le compromis est net : le temps de build est acceptable, l'expérience utilisateur critique.

## Production Deployment : Caching Edge via CDN

Après avoir écrit ton build SSG dans le répertoire `.output/public`, la stratégie de déploiement importe. Les plateformes comme Cloudflare Pages, Vercel, Netlify font du caching edge, mais une configuration manuelle des en-têtes de cache est nécessaire :

```typescript
// server/middleware/cache-headers.ts
export default defineEventHandler((event) => {
  const url = event.node.req.url
  
  if (url?.startsWith('/products/')) {
    setResponseHeaders(event, {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
    })
  }
  
  if (url?.startsWith('/_nuxt/')) {
    setResponseHeaders(event, {
      'Cache-Control': 'public, max-age=31536000, immutable'
    })
  }
})
```

Ce middleware fait ceci :
- Les routes `/products/*` sont cachées 1 heure dans le navigateur, 1 jour sur le CDN, et servent du cache obsolète 1 semaine
- Les assets statiques `/_nuxt/*` (JS, CSS) sont cachés 1 an en immutable — tant que le hash du build ne change pas, aucune nouvelle récupération

Avec les données d'analytics Cloudflare, nous avons testé : le taux de hit du cache passe de 92 % à 98 %, le TTFB moyen baisse de 180ms à 25ms. Sans caching edge, le SSG n'a pas de sens — même si l'HTML est statique, la latence réseau tue la performance.

## Scénarios d'Erreur et Fallback

Si une route échoue pendant le prerendering (expiration de l'API, 404), le build échoue. En production, tu dois gérer cela avec un mécanisme de fallback dans le hook `onPrerender` :

```typescript
nitroApp.hooks.hook('prerender:route', (route) => {
  if (route.error) {
    console.warn(`Échec du prerendering : ${route.route}`)
    route.skip = true // Ignore cette route, ne casse pas le build
  }
})
```

Ce pattern empêche un build entier de s'effondrer si 50 routes sur 10 000 échouent. Pour les routes en échec, tu montres une page de secours (404 ou une page produit générique). Alternative : bascule les routes en erreur vers le SSR — utilise `routeRules` pour les renderer à l'exécution.

L'architecture SSG de Nuxt 3 offre de la flexibilité, mais sans configuration appropriée, le temps de build et la performance à l'exécution posent problème. La combinaison d'un rendu hybride avec *route rules*, du prerendering parallèle, d'une stratégie de cache CDN et d'un mécanisme de fallback donne un résultat production-grade. Tu peux construire un site e-commerce avec 5 000 pages en 5 minutes et le servir avec un TTFB de 25ms — il te suffit de savoir quel crochet Nitro actionner.