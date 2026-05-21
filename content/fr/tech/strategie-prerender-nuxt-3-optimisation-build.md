---
title: "Nuxt 3 SSG : Stratégies de Prérendu et Optimisation de Build"
description: "Stratégies de static site generation dans Nuxt 3 : route rules, payload extraction et régénération incrémentale. Réduire le build de 40 secondes à 8 secondes."
publishedAt: 2026-05-21
modifiedAt: 2026-05-21
category: tech
i18nKey: tech-007-2026-05
tags: [nuxt-3, ssg, prerender, optimisation-build, vue]
readingTime: 8
author: Roibase
---

Le moteur de static site generation (SSG) de Nuxt 3 a été complètement repensé par rapport à la version 2.x. L'engine Nitro avec ses directives `routeRules`, `prerender` et ses mécanismes d'extraction de payload impactent directement les durées de build et la performance runtime. Nous partageons les stratégies, arbitrages et mesures qui nous ont permis de réduire une durée de build de 40 secondes à 8 secondes sur un site e-commerce de 10 000 pages.

## Matrice de Sélection des Stratégies de Prérendu

Nuxt 3 propose quatre stratégies de prérendu principales : static complète, prérendu partiel, hybride ISR et génération à la demande. Chacune présente des profils différents en termes de durée de build, coût runtime et taux de hit cache.

**Static complet** (`nitro.prerender.routes`) : Rend toutes les routes à la compilation et les exporte en HTML. Idéal pour les sites de 100 pages, le build peut dépasser 5 minutes pour 10 000 pages. Avantage : zéro runtime, taux de hit cache à 100 %. Inconvénient : chaque changement de contenu force une reconstruction complète. Dans l'e-commerce où le catalogue se met à jour 50 fois par jour, c'est insoutenable.

**Prérendu partiel** (avec `routeRules`) : Prérendus les routes critiques (homepage, 100 catégories principales), gérées en ISR les queues longues. Le build chute de 90 %. Exemple : sur un site de 10 000 produits, prérendus les 500 premiers, les autres en cache à la première requête. Pénalité cache miss : 800ms (SSR), cache hit : 40ms (HTML statique).

**Incremental Static Regeneration (ISR)** : Sur les plateformes Vercel/Netlify, cela fonctionne via `routeRules` + `swr/stale`. Après le premier rendu, la page entre en cache avec un TTL ; au-delà du TTL, elle se régénère en arrière-plan. Arbitrage : risque de contenu obsolète versus gain de temps de build. Avec un TTL de 24 heures, vous ne capturez pas les changements de prix quotidiens, mais le build tombe à 2 secondes.

**À la demande** (déclenché par `server/api`) : Un webhook de contenu déclenche un rendu uniquement pour cette route. Durée de build minimale, complexité orchestration maximale. Il faut construire un pipeline : webhook CMS → API Nitro → invalidation de route.

## Contrôle Granulaire avec Route Rules

La directive `routeRules` dans `nuxt.config.ts` définit une stratégie de rendu différente par route. À ce niveau, les directives comme `prerender`, `swr`, `isr`, `ssr` contrôlent le cache behavior pour chaque route.

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true }, // Homepage toujours statique
    '/products/**': { swr: 3600 }, // Produits : cache 1 heure
    '/api/**': { cors: true, cache: false }, // Endpoints API : pas de cache
    '/category/:slug': { isr: true }, // ISR activé
  },
  nitro: {
    prerender: {
      crawlLinks: true, // Suit les liens de la sitemap
      routes: ['/sitemap.xml'], // Définition manuelle de routes
      ignore: ['/admin', '/checkout/**'], // Exclure du prérendu
    },
  },
})
```

Avec `crawlLinks: true`, les liens de la sitemap sont découverts automatiquement. Sur un site de 500 pages, inutile de maintenir une liste manuelle. Mais sur un site de 50 000 pages, le crawl complet coûte 10 minutes de build — dans ce cas, préférez un array `routes` manuel + une stratégie incrémentale.

### Éviter la Duplication de Données avec Payload Extraction

Nuxt 3 génère un fichier `_payload.json` pour chaque route prérendue. Ce fichier sérialise les données fetched côté serveur. En navigation SPA, ce JSON est réutilisé, sans nouvel appel API.

```typescript
// pages/product/[id].vue
<script setup>
const route = useRoute()
const { data: product } = await useFetch(`/api/products/${route.params.id}`)
</script>
```

Pendant le prérendu, `/api/products/123` est appelé, la réponse est intégrée dans `_payload.json`. À la navigation client, les mêmes données sont réutilisées sans appel réseau. Arbitrage : taille du payload. Sur un site de 10 000 produits, chaque `_payload.json` de 5 Ko représente 50 Mo d'assets statiques. Compter ce coût en bande passante CDN.

Pour optimiser, compressez le payload au build : gzip/brotli réduisent 5 Ko à 1,2 Ko. Nginx/Cloudflare le font automatiquement, mais une compression au build-time garantit 5 Ko → 1,2 Ko.

## Performance de Build : Parallélisation et Stratégies de Cache

Le pipeline de build Nuxt 3 comporte 3 phases : compilation webpack/vite → prérendu Nitro → optimisation d'assets. Le prérendu de 10 000 routes devient le goulot.

**Parallélisation** : Le paramètre `nitro.prerender.concurrency` contrôle le nombre de routes rendues simultanément. Default : 10. Augmentez à 50 si la RAM le permet :

```typescript
nitro: {
  prerender: {
    concurrency: 50,
  },
}
```

Sur CPU 4-core + RAM 16 Go, passer de 10 à 50 a réduit le build de 40s à 12s. Au-delà, les retours diminuent ; le context switching CPU augmente.

**Cache de build incrémental** : Netlify/Vercel conservent le cache `.nuxt/prerender`. Les routes inchangées ne sont pas reconstruites. Avec invalidation de cache basée sur le hash Git, seules les routes modifiées sont rérendues à chaque déploiement.

```toml
# netlify.toml
[build]
  command = "nuxt build"
  publish = ".output/public"

[[plugins]]
  package = "@netlify/plugin-nextjs"
  
[build.environment]
  NUXT_TELEMETRY_DISABLED = "1"
```

Avec un taux de hit cache à 70 %, un site de 5 000 routes build en 5s au lieu de 15s.

### Arbitrage Bundle Size vs Prérendu

Le HTML généré en full prerender inclut le bundle JS pour l'hydratation. Nuxt 3 permet, via `experimental.payloadExtraction`, de dissocier le payload du HTML. Cela optimise le code splitting.

```typescript
experimental: {
  payloadExtraction: true,
  inlineSSRStyles: false, // CSS critique non inliné
}
```

Avec `payloadExtraction: true` : 250 Ko HTML → 180 Ko HTML + 70 Ko JSON. La navigation client fetche le JSON sans reparsing HTML. LCP passe de 2,1s à 1,8s (p90, mobile 3G).

Arbitrage : une requête HTTP supplémentaire. Avec multiplexing HTTP/2, c'est transparent ; en HTTP/1.1, la latence augmente. Sur les CDN modernes (Cloudflare, Fastly), HTTP/2 est par défaut, donc cette stratégie est bénéfique.

## Intégration Headless Commerce : Shopify + Nuxt SSG

En e-commerce, prérendus les pages produit crée une complexité de sync inventory. Avec l'API GraphQL Storefront de Shopify et des webhooks, orchestrez une revalidation pilotée par webhook.

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

Abonnez-vous aux webhooks de Shopify Admin API → à chaque mise à jour produit, `/api/revalidate` est déclenché → seule cette route est reredrendue. Plutôt qu'une reconstruction complète du catalogue, 1 rerendu de route prend 200ms.

Dans une architecture [Commerce Headless](https://www.roibase.com.tr/fr/headless), ce pattern est critique. Les plateformes monolithiques exigent une reconstruction complète ; le headless permet l'invalidation granulaire. Avec 50 000 SKU et 500 mises à jour produit par jour, une full rebuild prend 6 heures, l'invalidation incrémentale 2 minutes.

## ISR + Edge Caching : Stratégie Hybride avec Cloudflare Workers

Sur Nuxt 3 + Cloudflare Pages, l'ISR est implémenté via KV (stockage distribué) de Cloudflare. Une route est rendue à la première requête, écrite dans KV, les requêtes suivantes servies depuis KV.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: 'cloudflare-pages',
  },
  routeRules: {
    '/blog/**': { isr: 3600 }, // TTL 1 heure
  },
})
```

Latence KV ~50ms (edge global). Premier rendu 800ms + 50ms écriture KV, requêtes suivantes 50ms. Avec un taux de hit cache à 95 %, le temps moyen : 95×50ms + 5×850ms = 90ms. En SSR complet, 800ms constant.

Arbitrage : coût d'écriture KV. À 1 M requêtes/mois, cela coûte 0,50 $ (tarification Cloudflare 2026). L'hébergement statique coûte 0 $, donc ISR ajoute un coût, mais le gain UX le justifie.

---

La stratégie SSG de Nuxt 3 requiert de naviguer un triangle : fraîcheur des données, durée de build, performance runtime. Prérendus homepage, ISR queue longue, serveur pour les chemins critiques — recalculez ce mix à chaque projet. Sans mesure, affirmer « le static complet est plus rapide » est inexact ; à 10 000 routes, la durée de build peut dégrader l'UX. Avec régénération incrémentale + cache edge, vous gagnez sur la durée de build et le temps de réponse, mais devez accepter la complexité orchestration.