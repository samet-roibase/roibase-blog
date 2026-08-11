---
title: "Nuxt 3 + Cloudflare Pages : 10s LCP vers 2s"
description: "Self-hosted font, lazy hydration, content-visibility et edge caching : -80% LCP en production. Code et analyse des tradeoffs."
publishedAt: 2026-08-11
modifiedAt: 2026-08-11
category: tech
i18nKey: tech-001-2026-08
tags: [nuxt3, web-performance, cloudflare-pages, core-web-vitals, edge-caching]
readingTime: 8
author: Roibase
---

En 2024, Core Web Vitals a basculé vers INP mais LCP reste la métrique la plus visible de l'expérience utilisateur. Lors du déploiement en production d'une stack Nuxt 3 + Cloudflare Pages pour un projet e-commerce, le LCP s'est stabilisé à 10.2 secondes — 3G throttlé mobile. Après 6 semaines d'optimisation, sur le même scénario, ce chiffre a chuté à 2.1 secondes. Cet article décortique les 4 techniques critiques appliquées durant cette période : stratégie de font auto-hébergée, pattern de lazy hydration, `content-visibility` CSS et architecture de caching edge.

## Self-Hosted Font : 1.8s Requête Externe → 120ms Serve Local

Récupérer Google Fonts via CDN paraît intuitif mais engendre 3 coûts de round-trip : DNS, TLS handshake, téléchargement du fichier font. Cela générait en moyenne 1.8 seconde de latence. Nous avons migré la font vers un asset statique.

**Étapes :**

```bash
# 1. Télécharger la font et la placer dans /public/fonts
# Inter variable : ~400KB WOFF2

# 2. nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      link: [
        {
          rel: 'preload',
          href: '/fonts/inter-var.woff2',
          as: 'font',
          type: 'font/woff2',
          crossorigin: 'anonymous'
        }
      ]
    }
  }
})
```

**CSS :**

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-display: swap;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}
```

**Tradeoff :** La taille initiale du bundle augmente de 400KB mais une dépendance externe disparaît du chemin critique. Le CDN de Cloudflare sert ce fichier depuis 300+ PoP, le TTFB médian atteint 80ms. Avec `font-display: swap`, nous acceptons le FOUT (Flash of Unstyled Text) — un layout shift de 0.3% en est le prix.

**Benchmark :** Contribution au LCP -1.6s (10.2s → 8.6s).

## Lazy Hydration : 3.2s TBT → 420ms

Le comportement SSR par défaut de Nuxt hydrate tout l'arbre de composants côté client. Pour les composants lourds comme une grille de produits non interactifs dans le viewport initial, le coût d'hydration est du gaspillage.

**Pattern :** Intersection tracking + import dynamique.

```vue
<template>
  <div ref="target">
    <ClientOnly v-if="isVisible">
      <HeavyProductGrid :products="products" />
    </ClientOnly>
    <div v-else class="skeleton-grid" />
  </div>
</template>

<script setup lang="ts">
const target = ref<HTMLElement | null>(null)
const isVisible = ref(false)

onMounted(() => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        isVisible.value = true
        observer.disconnect()
      }
    },
    { rootMargin: '50px' }
  )
  
  if (target.value) observer.observe(target.value)
})
</script>
```

**Résultat :** La grille de produits faisait 28KB de JS et l'hydration prenait 680ms. En rendant 3 grilles lazy (hors viewport initial), le TBT (Total Blocking Time) passe de 3.2s à 420ms. Le score de performance Lighthouse saute de 42 à 78.

**Tradeoff :** Lorsque l'utilisateur scroll et que le contenu se charge, un délai de 150-200ms est visible. Le risque de CLS (Cumulative Layout Shift) augmente — la hauteur du skeleton doit correspondre exactement au contenu réel.

### H3: Pattern d'Import Lazy Component dans Nuxt

```ts
// composables/useLazyComponent.ts
export const useLazyComponent = (componentPath: string) => {
  return defineAsyncComponent({
    loader: () => import(`~/components/${componentPath}.vue`),
    loadingComponent: SkeletonLoader,
    delay: 200,
    timeout: 10000
  })
}

// Utilisation :
const ProductGrid = useLazyComponent('ProductGrid')
```

## CSS content-visibility : Coût de Rendering -60%

Depuis Chrome 85, `content-visibility: auto` signale au navigateur « ne pas effectuer le rendu de cet élément hors viewport ». Cela reporte les opérations de layout, paint et composite.

**Application :**

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 400px; /* hauteur estimée */
}
```

**Trace Lighthouse :**
- Avant : Construction de l'arbre de rendu 1240ms (312 nœuds)
- Après : 520ms (88 nœuds pour le viewport initial)

**Détail important :** `contain-intrinsic-size` est indispensable pour le calcul des barres de scroll. Une valeur incorrecte déclenche du CLS. Dans notre cas, la hauteur réelle des cartes variait entre 380-420px, nous avons utilisé 400px en moyenne.

**Attention :** Safari 17.4 et antérieures ne supportent pas cette propriété — considérez-la comme une amélioration progressive. Aucun fallback n'est nécessaire, seulement le gain de performance disparaît.

## Edge Caching : Charge Origine -85%

Cloudflare Pages met en cache les assets statiques par défaut mais envoie les routes dynamiques vers l'origin. L'API `routeRules` de Nuxt permet de définir des règles de cache au niveau des pages.

**nuxt.config.ts :**

```ts
export default defineNuxtConfig({
  routeRules: {
    '/': { 
      isr: 3600, // 1 heure stale-while-revalidate
      headers: { 'cache-control': 's-maxage=3600' }
    },
    '/products/**': { 
      isr: 1800,
      headers: { 'cache-control': 's-maxage=1800, stale-while-revalidate=86400' }
    },
    '/api/**': { cache: false } // Routes API contournées
  },
  nitro: {
    preset: 'cloudflare-pages',
    cloudflare: {
      pages: {
        routes: {
          exclude: ['/admin/*']
        }
      }
    }
  }
})
```

**Logique ISR (Incremental Static Regeneration) :**
1. Première requête → SSR depuis l'origin, réponse en cache
2. Requêtes dans les 3600s → Servies depuis l'edge (TTFB ~40ms)
3. Première requête après 3600s → Réponse stale retournée MAIS l'origin régénère en arrière-plan
4. Requêtes suivantes → Réponse fraîche

**Analytics Cloudflare :**
- Taux de requêtes origin : 92% → 7% (moyenne sur 3 semaines)
- TTFB médian : 680ms → 52ms
- TTFB 99p : 2.1s → 180ms

**Tradeoff :** Une mise à jour de stock produit peut s'afficher avec jusqu'à 1 heure de délai. Sur les pages critiques (checkout), nous avons utilisé `cache: false`. Dans une architecture [Headless Commerce](https://www.roibase.com.tr/fr/headless), cette stratégie de caching edge génère un gain de performance indépendant du backend.

## Analyse du Bundle : Chasse aux Dépendances Inutiles

Durant l'optimisation, nous avons inspecté la composition du bundle avec `nuxt analyze`. Deux gains majeurs :

**1. Lodash remplacé par ES6 natif :**

```js
// Avant : 72KB gzippé
import { debounce, throttle } from 'lodash'

// Après : 0KB (utilitaires natifs)
const debounce = (fn, ms) => {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
```

**2. day.js remplacé par Intl API :**

```js
// Avant : day.js 11KB
import dayjs from 'dayjs'
dayjs(date).format('DD MMM YYYY')

// Après : natif 0KB
new Intl.DateTimeFormat('fr-FR', { 
  day: '2-digit', 
  month: 'short', 
  year: 'numeric' 
}).format(new Date(date))
```

**Réduction totale du bundle :** 83KB gzippé → amélioration du FCP (First Contentful Paint) de 240ms.

## Tableau Comparatif : Avant/Après

| Métrique | Avant | Après | Changement |
|----------|-------|-------|------------|
| LCP (3G) | 10.2s | 2.1s | -79% |
| TBT | 3.2s | 420ms | -87% |
| CLS | 0.18 | 0.04 | -78% |
| FCP | 2.8s | 1.4s | -50% |
| Bundle JS | 312KB | 229KB | -27% |
| TTFB (edge hit) | 680ms | 52ms | -92% |

**Environnement de test :** Chrome 120, Lighthouse 11, throttle 3G (1.6Mbps down, 750Kbps up, 300ms RTT). Moyenne sur 10 exécutions.

## Conclusion : Ingénierie de Performance, Pas Optimisation Ponctuelle

Ces 4 techniques ne suffisent pas isolément — une mesure et itération continues sont requises. En production, nous suivons le LCP 95p via RUM (Real User Monitoring). Lors de l'ajout de nouvelles features, des tests de régression sur la taille du bundle sont appliqués. Le ratio de caching edge est révisé chaque semaine depuis les Analytics Cloudflare. Le gain de performance web n'est pas une tâche unique à accomplir puis oublier, c'est une discipline ancrée dans le cycle de développement produit.