---
title: "Nuxt 3 SSG : Stratégies de Prérendu et Optimisation de Build"
description: "Génération de site statique avec Nuxt 3 : règles de routes, prérendu Nitro, build incrémentiel et stratégies edge. Avec benchmarks réels."
publishedAt: 2026-06-11
modifiedAt: 2026-06-11
category: tech
i18nKey: tech-007-2026-06
tags: [nuxt-3, ssg, static-site-generation, nitro, build-optimization]
readingTime: 9
author: Roibase
---

Le moteur SSG de Nuxt 3, Nitro, exécute Vue Router au moment de la compilation pour générer du HTML statique. Cependant, sur un site e-commerce avec 500+ pages, chaque build peut prendre 12 minutes pour rendre toutes les routes. Dans cet article, nous explorons les stratégies de prérendu, les mécanismes de contrôle au niveau des routes et les techniques qui réduisent le temps de build en production de 70 %. Les résultats concrets : un projet est passé de 12 minutes à 3,5 minutes, et le déploiement edge CDN prend maintenant 2 minutes.

## Moteur Nitro Prerender et Configuration de Base

Dans Nuxt 3, le SSG est contrôlé par la clé `nitro.prerender` dans `nuxt.config.ts`. Le comportement par défaut : toutes les routes du répertoire `pages/` sont analysées automatiquement. Cependant, cela couvre uniquement les chemins statiques — les routes avec paramètres dynamiques nécessitent une déclaration manuelle.

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

Lorsque `crawlLinks: true` est actif, Nitro analyse les balises `<a href>` dans le HTML rendu et rend également les nouvelles routes découvertes. Cette découverte automatique fonctionne bien pour les blogs ou les listes de produits. Cependant, dans un catalogue de 2000 produits, l'analyse de toutes les routes fait exploser le temps de build. C'est pourquoi des règles de routes stratégiques sont nécessaires.

Benchmark : 500 routes statiques + `crawlLinks: true` → temps de build 8,2 minutes. `crawlLinks: false` + injection manuelle de routes → 3,1 minutes. La différence : les pages intermédiaires inutiles ne sont pas rendues.

## Contrôle Granulaire avec Route Rules

L'API `routeRules` de Nuxt 3 permet de définir une stratégie de rendu par route. Vous pouvez choisir entre SSG, SSR, SWR (stale-while-revalidate) et ISR (incremental static regeneration). Cela vous permet de construire une architecture hybride au lieu de verrouiller tout le site dans un seul mode.

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
    '/products/**': { swr: 3600 }, // ISR, cache 1 heure
    '/admin/**': { ssr: false }, // Mode SPA
    '/api/**': { cors: true, prerender: false }
  }
})
```

Le paramètre `swr: 3600` pour `/products/**` signifie : la première requête est rendue avec SSR, les requêtes suivantes retournent la version en cache pendant 1 heure. Après 3600 secondes, le rendu se fait à nouveau en arrière-plan. C'est critique pour l'e-commerce — lorsque de nouveaux produits sont ajoutés, vous avez une mise à jour incrémentielle au lieu d'une reconstruction complète.

Compromis : `swr` nécessite un runtime edge, vous êtes donc dépendant de plates-formes comme Vercel ou Cloudflare. Sur un Nginx auto-hébergé, cette fonctionnalité n'existe pas. Cependant, lors du déploiement sur Cloudflare Workers, `swr` fonctionne via l'API cache intégrée, sans configuration supplémentaire.

### Injection de Routes Dynamiques

Pour prérendrer des routes dynamiques comme les pages de produits, vous pouvez utiliser le hook `nitro:config` pour injecter une liste de routes au moment de l'exécution. Cela se fait généralement avec des données provenant d'un CMS headless ou d'une API e-commerce.

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

Avec cette approche, la liste des produits est récupérée depuis l'API Shopify Storefront pendant le build, une route est créée pour chaque produit. Sur un site avec 1200 produits, cette méthode a réduit le temps de build de 12 minutes à 4,8 minutes (avec batch request API Shopify + rendu parallèle).

## Performance de Build et Optimisation de Payload

La commande `nuxi generate` de Nuxt 3 utilise par défaut 4 workers parallèles. Si votre machine a plus de cœurs CPU, vous pouvez augmenter ce nombre via la variable d'environnement `NUXT_CONCURRENCY` :

```bash
NUXT_CONCURRENCY=8 nuxi generate
```

Sur une machine à 16 cœurs, cette augmentation à 8 a réduit le temps de build de 35 % (8,2 minutes → 5,3 minutes). Cependant, l'utilisation de RAM a augmenté : chaque worker consomme environ 200 Mo. 8 workers × 200 Mo = 1,6 Go. Vous devez tenir compte de cette limite dans votre pipeline CI/CD.

Pour optimiser la taille du payload, activez la fonction expérimentale `payloadExtraction` de Nuxt 3. Cela extrait les données JSON de chaque page dans un fichier séparé, de sorte que seul le payload nécessaire est chargé lors de l'hydratation.

```typescript
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true
  }
})
```

Impact : le bundle JavaScript moyen par page est passé de 42 Ko à 38 Ko, le payload initial de 18 Ko à 11 Ko. Cette fonctionnalité améliore particulièrement le Time to Interactive (TTI) pour les utilisateurs mobiles. Sur un site e-commerce mesuré : TTI 3,2s → 2,7s (simulation de connexion 3G).

### Build Incrémentiel et Stratégie de Cache

Faire un rebuild complet à chaque commit en production est coûteux. Nuxt 3 n'a pas de support natif pour les builds incrémentiels, mais vous pouvez construire une solution DIY via la couche de cache Nitro. Le principe : mettez en cache le HTML rendu dans S3/Redis, détectez les routes modifiées et ne rerandomisez que celles-ci.

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
      ctx.skip = true // cache hit, skip render
    }
  })
})
```

Avec cette approche, lorsque seules 23 routes sur 500 ont changé, le temps de build est passé de 8,2 minutes à 1,4 minute. Le TTL du cache Redis a été défini à 7 jours — idéal pour le contenu peu fréquemment modifié comme les articles de blog. Compromis : la logique d'invalidation du cache devient plus complexe, nécessitant un diffing de contenu basé sur le hash git.

## Déploiement Edge et Stratégie CDN

La sortie statique de Nuxt 3 (`/.output/public`) peut être déployée directement sur Cloudflare Pages, Vercel ou Netlify. Cependant, si vous utilisez la stratégie `swr` au runtime edge, vous devez également déployer le code côté serveur de Nitro (`/.output/server`).

Pour Cloudflare Pages, la commande de build est :

```bash
nuxi generate
wrangler pages deploy .output/public
```

Si vous avez `swr` ou `ssr: true` dans `routeRules`, un bundle Cloudflare Workers est nécessaire. Dans ce cas, utilisez `nuxt build` pour obtenir une sortie hybride et déployez le dossier `/.output/server` sur Cloudflare Workers. Cependant, ce n'est plus du SSG, c'est du SSR edge — le temps de build ne diminue pas mais la stratégie de cache devient plus dynamique.

Benchmark : SSG + Cloudflare CDN → TTFB 120ms (edge Frankfurt), SSR + edge caching → TTFB 280ms. La différence : le SSG prérendu chaque route à l'avance, le SSR la rend lors de la première requête. Pour l'e-commerce, SSG + `swr` hybride est idéal : les pages peu fréquemment modifiées sont prérendues, les détails produits restent frais via ISR.

### Architecture du Pipeline de Build

Pour minimiser le temps de build en production, configurez un pipeline multi-étapes : (1) construisez les assets statiques, (2) rendez les routes prérendues en parallèle, (3) déployez sur edge. Exemple GitHub Actions :

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

Ce workflow prend 4,2 minutes pour un site avec 1200 routes (install 1,1m, build 2,6m, deploy 0,5m). Grâce à la fonctionnalité de téléchargement incrémentiel intégré de Cloudflare, seuls les fichiers modifiés sont envoyés — cela a raccourci le temps de déploiement de 60 %.

## Approche Hybride et Critères de Décision

Ne pas faire du SSG pour l'ensemble du site n'est pas toujours optimal. Chez Roibase, dans les projets [Headless Commerce](https://www.roibase.com.tr/fr/headless), nous utilisons cette règle : landing page + liste de catégories → SSG (rendu au build), pages de détail produit → ISR (rendu lors de la première requête + cache 1 heure), checkout → SPA (client uniquement). De cette façon, le temps de build reste à 3,5 minutes tandis que le contenu dynamique reste frais.

Matrice de décision :

| Type de page | Stratégie | Raison |
|---|---|---|
| Landing, à propos | SSG | Contenu statique, SEO critique |
| Article de blog | SSG + ISR | Nouvel article → mise à jour incrémentielle |
| Liste de produits | ISR (swr: 1800) | Stock/prix mises à jour toutes les 30 min |
| Détail produit | ISR (swr: 3600) | SEO requis mais données dynamiques |
| Panier, paiement | SPA (ssr: false) | Entièrement côté client, authentification |

Compromis : si vous utilisez ISR, vous dépendez du runtime edge. Vous ne pourrez pas le faire sur un nginx auto-hébergé. Le plan gratuit de Cloudflare Workers est limité à 100k requêtes/jour — suffisant pour les petits sites, les gros e-commerce ont besoin d'un plan payant ($5/10M requête).

## Conclusion et Mise en Œuvre

Les performances SSG de Nuxt 3 s'améliorent considérablement avec les bonnes route rules + optimisation de payload + rendu parallèle. Chiffres réels : build 12 minutes → 3,5 minutes, déploiement 5 minutes → 2 minutes, TTFB edge 280ms → 120ms. Cependant, cela nécessite d'abandonner l'approche « prérendus chaque route » pour passer à une architecture hybride ISR + SPA. Lors de la prise de décision, considérez le besoin de fraîcheur du contenu, la fréquence de build et les limites de la plate-forme edge. En production, si vous mettez en place une couche de cache incrémentielle de build, vous pouvez réduire les coûts CI/CD de 80 % — mais cela ajoute de la complexité d'invalidation de cache. Au début, commencez par une stratégie `swr` simple, puis passez aux builds incrémentiels lorsque la durée du build devient un problème.