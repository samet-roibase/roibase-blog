---
title: "Nuxt 3 + Cloudflare Pages : 10s LCP en 2s"
description: "Polices auto-hébergées, hydratation lazy, content-visibility et cache edge : nous avons réduit le LCP de 80 % sur un projet Nuxt 3. Code concret et chiffres."
publishedAt: 2026-05-28
modifiedAt: 2026-05-28
category: tech
i18nKey: tech-001-2026-05
tags: [nuxt3, web-performance, cloudflare-pages, core-web-vitals, edge-computing]
readingTime: 9
author: Roibase
---

La combinaison Cloudflare Pages + Nuxt 3 promet un cache edge et un déploiement zéro-config, mais elle ne suffit pas pour les Core Web Vitals. Sur un projet e-commerce en production, le LCP atteignait 10,2 secondes et le TBT 2190 millisecondes. Google Fonts, l'hydratation côté client, le CSS global et le rendu JavaScript synchrone bloquaient le rendu critique. Avec des polices auto-hébergées, l'hydratation lazy, la propriété CSS `content-visibility` et une stratégie de cache edge, nous avons réduit le LCP à 2,1 secondes et le TBT à 180 millisecondes. Cet article détaille l'implémentation étape par étape et les compromis acceptés.

## Google Fonts : perte de 3,8s due au blocage du rendu

Les polices importées depuis le CDN Google Fonts via `@import` ou `<link>` bloquent le rendu. Le risque FOIT (Flash of Invisible Text) et les 3+ allers-retours de latence impactent directement le LCP. Chrome DevTools Lighthouse signalait « Éliminer les ressources bloquant le rendu » avec une perte estimée à 3,8 secondes.

Solution : nous avons auto-hébergé les polices. En utilisant le paquet npm `@fontsource/inter`, nous avons placé les fichiers Woff2 dans le répertoire `public/fonts`. Puis nous avons ajouté des directives de préchargement dans la config Nuxt :

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      link: [
        {
          rel: 'preload',
          as: 'font',
          type: 'font/woff2',
          href: '/fonts/inter-latin-400-normal.woff2',
          crossorigin: 'anonymous'
        },
        {
          rel: 'preload',
          as: 'font',
          type: 'font/woff2',
          href: '/fonts/inter-latin-600-normal.woff2',
          crossorigin: 'anonymous'
        }
      ]
    }
  }
})
```

Nous avons défini les polices en CSS en limitant les variantes aux poids réellement utilisés :

```css
/* assets/css/fonts.css */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/inter-latin-400-normal.woff2') format('woff2');
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/fonts/inter-latin-600-normal.woff2') format('woff2');
}
```

Avec `font-display: swap`, nous acceptons le compromis du FOUT (Flash of Unstyled Text) : la police système s'affiche rapidement, puis la police personnalisée la remplace dès qu'elle est disponible. Le LCP a chuté à 6,4 secondes. L'augmentation de la taille du bundle (72 Ko en Woff2 compressé) est largement compensée par le gain de 3,8 secondes.

## Hydratation côté client : TBT à 2190ms

Nuxt 3 hydrate par défaut tous les composants côté client. Avec 40+ composants dans `app.vue`, un état global (Pinia), des composables et des bibliothèques tierces (Swiper, vue-gtag), le thread principal était bloqué. L'onglet Performance de Chrome DevTools montrait 8 « Long Tasks », la plus longue durant 1240 millisecondes.

### Priorisation avec l'hydratation lazy

Nous avons hydraté en différé les composants situés sous la ligne de flottaison. Après avoir activé le suivi avec le module `@nuxtjs/web-vitals`, nous avons identifié le chemin critique :

```vue
<!-- pages/index.vue -->
<template>
  <div>
    <!-- Au-dessus de la ligne de flottaison : hydratation immédiate -->
    <HeroSection />
    <ProductGrid :products="products" />

    <!-- Sous la ligne de flottaison : hydratation différée -->
    <LazyFooter v-if="mounted" />
    <LazyNewsletterForm v-if="mounted" />
    <client-only>
      <LazyReviewCarousel :reviews="reviews" />
    </client-only>
  </div>
</template>

<script setup lang="ts">
const mounted = ref(false)

onMounted(() => {
  requestIdleCallback(() => {
    mounted.value = true
  })
})
</script>
```

Le wrapper `<client-only>` a permis de retirer du SSR les bibliothèques dépendantes du DOM comme Swiper. Avec `requestIdleCallback`, l'hydratation s'effectue dès que le thread principal est libre. Le TBT a chuté à 840 millisecondes.

### Séparation et code splitting

Nous avons analysé le bundle avec `vite-plugin-inspect`. La bibliothèque Swiper représentait 168 Ko minifiés, mais elle n'était utilisée que pour le carousel de commentaires. Plutôt que d'implémenter un import dynamique, nous avons d'abord réduit la dépendance : suppression des modules `Virtual` et `Autoplay` de Swiper, conservation du seul module `Navigation` :

```typescript
// composables/useSwiper.ts
import { Navigation } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'

export const useSwiperModules = () => [Navigation]
```

Le bundle a été réduit de 168 Ko à 42 Ko. Puisque `<LazyReviewCarousel>` était déjà en chargement lazy, le code Swiper n'entrait pas dans le bundle initial.

## Content-Visibility : réduction de la période de rendu

La grille de produits affichait 48 cartes, chacune avec image, titre, prix et bouton. Lors du rendu initial, le navigateur calculait la mise en page de 48 cartes simultanément, allongeant le LCP. Grâce à la propriété CSS `content-visibility: auto`, les cartes situées sous la ligne de flottaison ont été exclues du rendu :

```css
/* components/ProductCard.vue */
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 320px 420px;
}
```

`contain-intrinsic-size` indique au navigateur les dimensions de l'espace réservé, évitant les sauts lors du défilement. Le LCP est passé de 6,4 à 3,9 secondes. Le compromis : les cartes en dehors du viewport initial se renderisent lors du défilement, avec un impact mesuré de 12 millisecondes sur l'INP (acceptable).

## Cache edge : TTFB de 1,2s à 40ms

Cloudflare Pages ne cache pas le HTML par défaut ; chaque requête remonte à l'origine. Le temps de réponse SSR de Nuxt 3 s'élevait en moyenne à 1200 millisecondes (appels API + rendu). Nous avons activé le cache edge via un fichier `_headers` :

```
# public/_headers
/*
  Cache-Control: public, max-age=0, s-maxage=600, stale-while-revalidate=86400
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
```

Avec `s-maxage=600`, Cloudflare cache à la périphérie pendant 10 minutes. `stale-while-revalidate=86400` sert la version en cache lors de l'expiration, pendant qu'un rendu neuf est généré en arrière-plan. Le TTFB a chuté à 40 millisecondes (cache hit). Les requêtes à l'origine ne se font que lors d'un miss ou d'une revalidation périmée.

### Rendu hybride avec ISR

Pour les pages produits, nous avons implémenté la Régénération Statique Incrémentale. Dans Nuxt, cela se configure via `routeRules` :

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/products/**': { 
      swr: 600,  // 10 minutes
      prerender: false
    },
    '/': { 
      swr: 300   // 5 minutes
    }
  }
})
```

La première requête utilise le SSR, les suivantes proviennent du cache edge. Pour les mises à jour de stock, nous déclenchons un purge manuel via webhook :

```typescript
// server/api/purge-cache.post.ts
export default defineEventHandler(async (event) => {
  const { productId } = await readBody(event)
  
  await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/purge_cache`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      files: [`https://example.com/products/${productId}`]
    })
  })
  
  return { success: true }
})
```

## Comparatif des performances

| Métrique | Avant | Après | Variation |
|----------|-------|-------|-----------|
| LCP | 10,2s | 2,1s | -79% |
| TBT | 2190ms | 180ms | -92% |
| TTFB | 1200ms | 40ms | -97% |
| FCP | 4,8s | 1,2s | -75% |
| CLS | 0,18 | 0,02 | -89% |
| Bundle (initial) | 284 Ko | 186 Ko | -34% |

Contexte de test : Chrome 121, throttling 4G, Lighthouse CI. Moyenne de 10 passages. Le LCP cible (sous 2,5 secondes, seuil « Bon » de Google) est atteint.

## Compromis et points d'attention

L'auto-hébergement des polices sacrifie le réseau de périphérie global du CDN, mais Cloudflare Pages étant déjà hébergé en périphérie, la latence additionnelle reste minime. La compression Woff2 limite ce surcoût. L'hydratation lazy entraîne une perte d'interactivité initiale : les composants situés sous la ligne de flottaison ne deviennent interactifs qu'après le hook `mounted`. Il convient d'ajouter une métrique analytique « time to interactive below fold ».

`content-visibility` ne bénéficie pas du support sur Safari antérieur à 17.4 ; une directive `@supports` est recommandée. Le cache edge crée un risque de conflit avec la personnalisation : le contenu dans le panier, l'état de connexion utilisateur doivent être protégés par `Cache-Control: private` ou rendus côté client.

Le purge du webhook ISR est un processus manuel ; l'intégrer à un système de gestion d'inventaire automatiserait mieux les opérations. Pour les pages critiques (paiement, checkout), désactiver ISR en faveur d'une revalidation plus fréquente est prudent.

## Architecture composable et passage à l'échelle

Nous avons testé ces optimisations dans une architecture [Headless Commerce](https://www.roibase.com.tr/fr/headless) : frontend Nuxt 3, backend Shopify Storefront API. Le même pattern fonctionne avec Next.js + Hydrogen ou Remix. La stratégie de cache edge est indépendante du framework : Cloudflare Workers KV ou Vercel Edge Config permettent d'étendre. Pour la surveillance, `@nuxtjs/web-vitals` doit être complétée par du RUM (Real User Monitoring) — Cloudflare Web Analytics ou Sentry Performance.

Avec un LCP de 2,1 secondes, le site atteint la catégorie « Bon » de Google, mais un test en 4G inférieur sur mobile reste essentiel. L'amélioration progressive garantit que le rendu HTML critique fonctionne sans JavaScript. Nuxt propose le composant `<NoScript>` pour les cas de défaillance. Le contenu critique doit rester accessible sans dépendre de JavaScript pour être rendu.
