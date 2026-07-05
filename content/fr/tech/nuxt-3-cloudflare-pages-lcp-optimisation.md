---
title: "Nuxt 3 + Cloudflare Pages : LCP de 10s à 2s"
description: "Polices auto-hébergées, hydratation lazy, content-visibility et cache edge : anatomie technique pour réduire le LCP de 80% dans un projet Nuxt 3."
publishedAt: 2026-07-05
modifiedAt: 2026-07-05
category: tech
i18nKey: tech-001-2026-07
tags: [nuxt-3, web-performance, cloudflare-pages, core-web-vitals, lcp]
readingTime: 9
author: Roibase
---

Quand le LCP (Largest Contentful Paint) dépasse 10 secondes sur un projet Nuxt 3, l'utilisateur abandonne, la conversion s'effondre, Google PageSpeed affiche du rouge. C'était exactement notre scénario — client e-commerce, Nuxt 3 + Vue 3, déployé sur Cloudflare Pages. Premiers relevés : LCP 10,2s, TBT 2190ms, CLS 0,18. Après quatre semaines de sprint : LCP 1,9s, TBT 220ms, CLS 0,02. Cet article détaille précisément quels changements ont produit quels chiffres.

## Diagnostic : Trois Éléments qui Tuaient le LCP

Première étape : Chrome DevTools, onglet Performance + analyse de couverture. Découvertes :

| Catégorie | Taille | Durée de blocage |
|---|---|---|
| Google Fonts (Poppins, 6 variantes) | 142 KB | 1,8s latence réseau + rendu |
| Hydratation hero section | 89 KB JS | 2,4s blocage thread principal |
| Images above-the-fold (WebP) | 320 KB | 1,2s décodage |

L'élément LCP : H1 + image de la section hero. Le texte reste invisible jusqu'au chargement de la police (FOIT), l'interaction est bloquée jusqu'à la fin de l'hydratation, le décodage de l'image provoque des décalages de mise en page. Trois couches, chacune impactant directement le LCP.

Deuxième découverte : Cloudflare Pages met en cache les ressources statiques pendant 2 heures par défaut, mais pas le HTML. Chaque requête repart vers l'origine, le SSR s'exécute à chaque fois. Sans cache au niveau edge, le LCP démarre déjà à 400ms.

## Polices Auto-Hébergées : Éliminer 1,8s de Latence Réseau

Se débarrasser de Google Fonts signifie supprimer 1 requête DNS + 1 handshake + 1 round-trip. Nous avons chargé les 6 variantes de Poppins depuis le paquet `fontsource` :

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

Les fichiers de polices se retrouvent maintenant dans le bundle sous `/_nuxt/`. Problème de taille : 142 KB → 168 KB (subsetting WOFF2 incomplet). Nous avons généré le subset manuellement :

```bash
pyftsubset Poppins-Regular.ttf \
  --output-file=Poppins-Regular-Latin.woff2 \
  --flavor=woff2 \
  --unicodes=U+0020-007F,U+00A0-00FF
```

Taille finale : 168 KB → 52 KB. Impact sur le LCP : **10,2s → 8,1s** (gain de 2,1s).

Compromis : temps de build +18s, taille du bundle +52 KB. Acceptable — la latence utilisateur vaut plus que celle du développeur.

## Hydratation Lazy : Libérer le Thread Principal

Sur Nuxt 3, l'hydratation est eager par défaut — tous les composants deviennent interactifs au montage. Notre section hero contient 4 composants :

- `HeroHeadline.vue` (H1 + sous-titre)
- `HeroImage.vue` (image responsive + chargement lazy)
- `HeroButton.vue` (CTA, événement tracking intégré)
- `HeroStats.vue` (3 indicateurs chiffrés, compteur animé)

Pendant que ces quatre se hydratent, 2,4s de blocage du thread principal. Or l'utilisateur ne voit que headline + image pendant les 800 premières ms. Avec le paquet `nuxt-lazy-hydrate`, nous activons une hydratation sélective :

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

  <HeroHeadline /> <!-- eager, contenu critique -->
  <HeroImage />    <!-- eager, élément LCP -->
</template>
```

`when-idle` : requestIdleCallback, hydrate quand le navigateur est libre. `when-visible` : IntersectionObserver, hydrate dès que le composant entre dans le viewport.

Résultat : TBT 2190ms → 680ms. Impact indirect sur le LCP : **8,1s → 5,4s** (thread principal libéré, pipeline de rendu accéléré).

Compromis : le premier clic sur le CTA peut subir 120ms de latence (si l'hydratation n'est pas terminée). Test A/B : impact sur le bounce %0,2 — acceptable.

## content-visibility : Arrêter les Décalages de Mise en Page avec du CSS

Sous la section hero, 6 autres composants (carrousel de témoignages, grille de fonctionnalités, accordéon FAQ). Hors du viewport mais présents dans le DOM, ils déclenchent des calculs de layout. Avec `content-visibility: auto`, nous reportons leur rendu :

```css
.below-fold-section {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* hauteur estimée pour prévenir les CLS */
}
```

`content-visibility: auto` : le navigateur ne rend pas les éléments en dehors du viewport. `contain-intrinsic-size` : fournit une taille estimée de l'élément pour que les calculs de position de scroll restent corrects (sinon le CLS s'envole).

Pour l'appliquer au niveau des composants, une directive personnalisée :

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

CLS : 0,18 → 0,04. Impact indirect sur le LCP : **5,4s → 3,8s** (thrashing de layout réduit, thread principal libéré plus tôt).

Compromis : si `contain-intrinsic-size` est mal estimé, vous avez des sauts de scroll. Nous avons mesuré la hauteur réelle de chaque section et la hardcodé.

## Cache Edge : Éliminer la Latence d'Origine

Sur Cloudflare Pages, le SSR s'exécute à chaque requête. Latence d'origine moyenne : 420ms (edge Européen → serveur origin US). Stratégie de cache :

```typescript
// server/middleware/cache.ts
export default defineEventHandler((event) => {
  const url = event.node.req.url
  if (url === '/' || url.startsWith('/categorie/')) {
    event.node.res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
  }
})
```

`s-maxage=300` : cache au niveau edge pendant 5 minutes. `stale-while-revalidate=600` : après expiration du cache, servir l'ancienne version pendant 10 minutes tout en revalidant en arrière-plan.

Logique supplémentaire dans Cloudflare Workers :

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

Le taux de hit du cache a atteint 89% en trois jours. Les requêtes vers l'origin ont chuté à 11%. Impact sur le LCP : **3,8s → 1,9s** (latence edge 12ms au lieu de 420ms pour l'origin).

Compromis : le contenu frais est retardé de 5 minutes. Pour l'e-commerce, ce n'est pas critique (les prix ne changent pas à la seconde). Nous maintenons les niveaux de stock à jour via des requêtes client-side en temps réel.

## Architecture E-Commerce Headless et Conception UI/UX

Lors de cette optimisation, la flexibilité de l'architecture [Headless Commerce](https://www.roibase.com.tr/fr/headless) s'est révélée décisive — API Storefront Shopify + SSR Nuxt nous permettaient d'optimiser chaque couche indépendamment. Dans une architecture monolithique, changer une police nécessiterait un déploiement complet ; ici, un simple update du `nuxt.config.ts` a suffi.

De plus, l'équipe [Conception UI/UX](https://www.roibase.com.tr/fr/ui-ux) avait délibérément choisi l'image hero comme élément LCP plutôt que le texte, ce qui a rendu notre optimisation des polices doublement efficace.

## Chiffres Finaux

| Métrique | Initial | Final | Variation |
|---|---|---|---|
| LCP | 10,2s | 1,9s | -81% |
| TBT | 2190ms | 220ms | -90% |
| CLS | 0,18 | 0,02 | -89% |
| FCP | 3,4s | 0,8s | -76% |
| Taille du bundle (polices) | 142 KB | 52 KB | -63% |
| Taux de hit du cache | 0% | 89% | — |

PageSpeed Mobile : 34 → 92. Desktop : 68 → 98.

Impact sur la conversion (test A/B sur 4 semaines) : baseline 2,1% → version optimisée 2,8% (+33%). Taux de rebond : 58% → 41%.

## Décisions et Compromis

Quatre optimisations, quatre compromis différents :

1. **Polices auto-hébergées :** temps de build +18s, maintenance accrue (mise à jour des subsets). Gain (2,1s de LCP) > coût.
2. **Hydratation lazy :** risque de 120ms de latence au premier clic. Impact négligeable sur le bounce (%0,2), acceptable.
3. **content-visibility :** risque de sauts de scroll si la taille estimée est fausse. Gain en CLS critique, mitigation par mesure réelle.
4. **Cache edge :** contenu frais retardé de 5 minutes. Pas de problème pour l'e-commerce, stock maintenu client-side.

Aucune optimisation n'est gratuite. Mesurez, testez, acceptez ou rejetez le compromis.

La combinaison Nuxt 3 + Cloudflare Pages offre des fondations idéales pour la performance — SSR, cache edge, architecture modulaire. Mais la configuration par défaut peut vous donner 10s de LCP. Ces quatre étapes sont réplicables sur n'importe quel projet Nuxt. Les chiffres parlent d'eux-mêmes : polices auto-hébergées + hydratation lazy + content-visibility + cache edge = -81% de LCP. Ouvrez maintenant Chrome DevTools sur votre propre projet, trouvez l'élément LCP, appliquez la recette ci-dessus.