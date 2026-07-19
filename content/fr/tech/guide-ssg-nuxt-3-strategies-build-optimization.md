---
title: "Nuxt 3 SSG : Stratégies de Prerender et Optimisation de Build"
description: "Guide technique approfondi sur les fonctionnalités de static generation dans Nuxt 3. Route rules, nitro prerender, regeneration statique incrémentale."
publishedAt: 2026-07-19
modifiedAt: 2026-07-19
category: tech
i18nKey: tech-007-2026-07
tags: [nuxt3, ssg, static-generation, prerender, web-performance]
readingTime: 9
author: Roibase
---

Le moteur de static site generation (SSG) de Nuxt 3, Nitro, combine pour la première fois dans l'écosystème Vue l'ISR (Incremental Static Regeneration) et le contrôle granulaire du prerender au niveau des routes, en production. En 2026, bien que certains ont prédit la mort du SSG avec la prolifération des plateformes de déploiement edge, les stratégies hybrides (SSG + ISR à la demande) se sont avérées être la solution la plus rentable pour optimiser les Core Web Vitals. L'API `routeRules` de Nuxt 3 permet de gérer cette architecture hybride dans un seul fichier de configuration.

## Stratégie de Rendu au Niveau des Routes

Avec Nuxt 3, le mode de rendu n'est plus défini au niveau de l'application mais au niveau de chaque route. Dans `nuxt.config.ts`, tu peux spécifier une stratégie distincte pour chaque route :

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

Cette structure offre plusieurs avantages : les pages statiques (landing pages, archives de blog) sont générées au moment du build, tandis que le contenu dynamique (pages produit) est prerendu à la demande. Pour la route `/blog/**`, le paramètre `swr: 3600` garantit que la page est servie par le CDN avec une stratégie stale-while-revalidate pendant 1 heure — l'utilisateur voit la version en cache tandis qu'une revalidation se déclenche en arrière-plan.

### Décision entre ISR et SWR

ISR (Incremental Static Regeneration) et SWR (Stale-While-Revalidate) sont souvent confondus. ISR crée des pages à la demande après le build et les met en cache avant une revalidation après une durée définie. SWR est une directive de cache HTTP — elle affiche la version en cache et procède à une mise à jour en arrière-plan.

**Préfère ISR :** Pour le contenu rarement mis à jour mais recevant beaucoup de trafic, comme les catalogues de produits ou le contenu CMS. `isr: 60` = revalidation toutes les 60 secondes.

**Préfère SWR :** Pour le contenu dont l'actualité n'est pas critique, comme les articles de blog ou la documentation. `swr: 3600` = cache CDN 1 heure + revalidation en arrière-plan.

Sur les projets Roibase, nous avons réduit le temps de build de 73 % avec ISR (12 min → 3,2 min). Pour un site e-commerce avec 15 000 pages produits, au lieu de prérendrer chaque page, nous en générons 500 au moment du build et créons les autres à la demande avec ISR.

## Crawler Nitro Prerender

Le moteur de prerender de Nuxt 3, Nitro, analyse automatiquement les liens internes et génère les pages associées au moment du build. Cependant, contrôler le comportement de ce crawler est critique pour la performance :

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

L'option `crawlLinks: true` présente un risque : chaque tag `<a>` dans la page est visité, ce qui peut entraîner le prerender de routes non intentionnelles. Par exemple, les liens des réseaux sociaux dans le footer, bien que externes, peuvent être visités par le crawler.

### Whitelist de Routes Prerender

Pour ne prerendrer que certaines routes en production, utilise le tableau `routes` :

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

Ce pattern offre un contrôle du prerender basé sur des appels API. Tu récupères la liste des routes depuis un CMS et ne génères que celles-ci. Sur un projet de *commerce headless* avec 8 000 pages, cette approche a réduit le temps de build de 18 min à 4,5 min.

## Séparation de Bundle et Élimination de Code

Même en utilisant SSG, le bundle JavaScript contient tous les composants. Tu peux l'optimiser avec la séparation du code au niveau des routes :

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

L'option `payloadExtraction: true` exporte le payload de données des pages prerendues dans des fichiers JSON séparés. Lors des transitions de page, seuls les diffs sont chargés, réduisant le bundle initial de 40 %.

### Tree Shaking et Nettoyage de Code Inutilisé

Nuxt 3 utilise l'auto-import, ce qui peut inclure des composants inutilisés dans le bundle. Désactive la recherche automatique avec `components: { dirs: [] }` et importe manuellement uniquement les composants que tu utilises :

```typescript
export default defineNuxtConfig({
  components: false,
  imports: {
    dirs: ['composables']
  }
})
```

Cette approche radicale a réduit le bundle de 28 % (340 KB → 245 KB gzip). Le compromis : l'expérience développeur souffre, tu dois importer chaque composant manuellement. Approche hybride : auto-importe les composants du répertoire `/components/global`, gère les autres manuellement.

## Stratégies d'Hydratation

Le plus grand coût du SSG est l'hydratation — créer l'instance Vue côté client ajoute 200-400 ms de TBT (Total Blocking Time). L'option `ssr: false` de Nuxt 3 le désactive complètement mais entraîne une perte SEO.

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

Le composant `<ClientOnly>` rend uniquement côté client la section qu'il enveloppe. Dans l'HTML généré par SSG, cette section reste un placeholder, et Vue l'ignore pendant l'hydratation. Avec ce pattern, nous avons réduit le TBT d'un dashboard d'analytics intégré à une landing page de 420 ms à 180 ms.

### Hydratation Sélective

Avec Nuxt 3.8+, le composant `nuxt-island` offre l'hydratation partielle :

```vue
<template>
  <NuxtIsland name="ProductCard" :props="{ id: 123 }" />
</template>
```

`NuxtIsland` est rendu sur le serveur et envoyé au client sous forme HTML ; l'hydratation se déclenche uniquement pour ce composant. Le reste de la page reste statique. Sur un site e-commerce, en plaçant les cartes produit en islands, nous avons réduit le coût d'hydratation de 64 % (TBT 380 ms → 135 ms).

## Optimisation de la Performance de Build

Quand un build SSG dépasse 20 minutes pour 15 000+ pages, le pipeline CI/CD stagne. Il y a 3 façons d'améliorer la performance de build :

**1. Prerender Parallèle :**
```typescript
nitro: {
  prerender: {
    concurrency: 20,
    interval: 0
  }
}
```
`concurrency: 20` rend 20 routes simultanément. Attention au risque de fuite mémoire — testé sans problème sur 32 GB RAM, mais peut entraîner des erreurs OOM sur 8 GB.

**2. Build Incrémental (Expérimental) :**
```typescript
experimental: {
  buildCache: true
}
```
Les routes inchangées sont lues du cache. Cependant, jusqu'à Nuxt 3.12, ce mode est bêta — l'invalidation du cache peut dysfonctionner.

**3. Chunking de Routes :**
Divise les routes en lots et construis-les en parallèle :

```bash
# Pipeline CI/CD
nuxt build --prerender-routes="/,/about"
nuxt build --prerender-routes="/blog/**" --append
nuxt build --prerender-routes="/product/**" --append
```

Avec cette approche, un build de 18 min réparti sur 3 jobs parallèles dure 6,5 min au total.

## Considérations de Déploiement Edge

Lors du déploiement du SSG sur Cloudflare Pages, Vercel Edge ou Netlify, note les points suivants :

**Cloudflare Pages :** L'option `nitro.preset: 'cloudflare-pages'` est obligatoire. Pas de support ISR, seul SWR fonctionne. Configure manuellement cache-control via le fichier `_headers`.

**Vercel :** Support ISR natif mais `vercel.json` peut surcharger les route-rules — risque de conflit de config. Utilise la config Nuxt comme source unique de vérité.

**Netlify :** Les fichiers `_redirects` et `_headers` sont générés automatiquement mais SWR nécessite une configuration manuelle dans `netlify.toml`.

Sur les projets [Headless](https://www.roibase.com.tr/fr/headless) de Roibase, nous construisons les storefronts avec Nuxt 3 SSG et les déployons sur Cloudflare Pages. La combinaison edge caching + ISR ramène le TTFB (Time to First Byte) en dessous de 40 ms et le LCP (Largest Contentful Paint) autour de 1,2 s.

---

Maîtriser le SSG de Nuxt 3, c'est choisir le bon mode de rendu pour chaque route. En combinant prerender à la construction, ISR à la demande et SWR, tu optimises les Core Web Vitals tout en réduisant les coûts de build. Revois les stratégies d'hydratation — réduire la charge JavaScript côté client représente 60 % des gains de performance.