---
title: "Nuxt 3 + Cloudflare Pages : réduire le LCP de 10s à 2s"
description: "Polices auto-hébergées, hydratation sélective, content-visibility et cache edge : nous avons réduit le LCP de 80%. Benchmarks réels, code et compromis."
publishedAt: 2026-05-07
modifiedAt: 2026-05-07
category: tech
i18nKey: tech-001-2026-05
tags: [nuxt3, cloudflare-pages, web-performance, lcp, edge-caching]
readingTime: 9
author: Roibase
---

Après la mise à jour des Core Web Vitals de Google, le LCP (Largest Contentful Paint) doit rester en dessous de 2,5 secondes, sinon le classement organique et le taux de conversion chutent. Lorsque nous avons migré un site e-commerce vers la pile Nuxt 3 + Cloudflare Pages, le premier déploiement a laissé le LCP à 10,2 secondes. En combinant une stratégie de polices auto-hébergées, une hydratation sélective, la propriété CSS *content-visibility* et le cache edge, nous avons ramené cela à 2,1 secondes. Voici comment chaque modification a contribué au gain, les compromis et le code.

## Diagnostiquer le problème : l'anatomie du LCP de 10s

Le rapport CrUX initial montrait un LCP médian de 10,2s et un TBT (Total Blocking Time) de 2190ms. L'analyse du profil Lighthouse de Chrome DevTools a révélé :

- **Chargement des polices :** trois familles de polices depuis le CDN Google Fonts, bloquant le rendu
- **Hydratation JavaScript :** bundle de 420kB, toute la page s'hydrate
- **Image au-dessus de la ligne de flottaison :** JPEG 1,2MB, pas de chargement différé
- **Cache Cloudflare :** la réponse SSR n'est pas mise en cache, chaque requête atteint l'origine

Mesure de base : score mobile PageSpeed Insights 34/100. Desktop 62/100. Ces chiffres après migration depuis Shopify Liquid vers Nuxt 3 — le changement de framework seul n'apporte aucun gain de performance, une optimisation architecturale est nécessaire.

## Stratégie de polices auto-hébergées + preload

Nous avons téléchargé les mêmes fichiers de polices du service Google Fonts dans le répertoire `public/fonts/` et déplacé la définition `@font-face` dans `app.vue`. La différence clé : avec `<link rel="preload">`, nous demandons les fichiers de polices dans la réponse HTML initiale, avant le parsing CSS.

```vue
<!-- app.vue -->
<script setup>
useHead({
  link: [
    {
      rel: 'preload',
      href: '/fonts/inter-var.woff2',
      as: 'font',
      type: 'font/woff2',
      crossorigin: 'anonymous'
    }
  ]
})
</script>

<style>
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2');
  font-display: swap;
  font-weight: 100 900;
}
</style>
```

**Gain :** LCP 10,2s → 7,8s (baisse de 2,4s). Le chargement des polices n'est plus bloquant, le délai FOIT (Flash of Invisible Text) passe de 1200ms à 180ms. Compromis : les fichiers de polices se trouvent désormais sur notre CDN, la gestion des versions doit être manuelle (nous avons résolu cela avec un bucket Cloudflare R2 + en-têtes Cache-Control).

## Hydratation sélective + `content-visibility`

Le comportement par défaut de Nuxt 3 est d'hydrater tous les composants. Or, les composants en dehors de la zone visible au-dessus de la ligne de flottaison (pied de page, section des commentaires, produits associés) n'ont pas besoin de s'hydrater avant que l'utilisateur ne fasse défiler. Avec le module `@nuxt/lazy-hydration`, nous avons enveloppé ces composants dans un wrapper `LazyHydrate`.

```vue
<template>
  <LazyHydrate when-visible>
    <ProductRecommendations :product-id="productId" />
  </LazyHydrate>
</template>
```

Côté CSS, `content-visibility: auto` envoie au navigateur le signal « ne calcule pas le rendu pour cet élément s'il n'est pas dans le viewport » :

```css
.product-recommendations {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* hauteur placeholder */
}
```

**Gain :** TBT 2190ms → 420ms, LCP 7,8s → 4,1s. Le bundle JS initialement chargé passe de 420kB à 180kB (compressé en brotli). Compromis : `when-visible` utilise l'Intersection Observer API, un polyfill est nécessaire pour les anciens navigateurs comme IE11 (nous ciblions les navigateurs modernes, pas de problème).

## Cache edge + approche hybride ISR

Cloudflare Pages met en cache les fichiers statiques par défaut, mais pas les endpoints SSR (en dehors de `/_nuxt/...`). Nous avons défini dans `nuxt.config.ts` via `routeRules` quels chemins sont mis en cache et pour combien de temps :

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/': { swr: 3600 }, // page d'accueil 1h stale-while-revalidate
    '/produit/**': { swr: 1800 }, // pages produit 30m
    '/categorie/**': { static: true } // pages catégorie statique build-time
  }
})
```

La stratégie `swr` (stale-while-revalidate) : la première requête rend le SSR, les requêtes suivantes viennent du cache, le serveur le re-rend en arrière-plan. Nous avons utilisé le KV store de Cloudflare avec comme clé de cache l'URL + le segment utilisateur (connecté/anonyme).

**Gain :** TTFB (Time to First Byte) 840ms → 120ms, LCP 4,1s → 2,3s. Le taux de hit cache s'est élevé à 78% la première semaine. Compromis : la personnalisation dépend de la clé de cache ; par exemple, le nombre de produits dans le panier ne peut pas être mis en cache, les données utilisateur spécifiques sont récupérées côté client.

## Optimisation des images au-dessus de la ligne de flottaison

Nous avons converti l'image héros d'un JPEG de 1,2MB en WebP de 180kB et ajouté des points de rupture responsifs avec l'élément `<picture>` :

```vue
<picture>
  <source
    srcset="/images/hero-mobile.webp"
    media="(max-width: 640px)"
    type="image/webp"
  />
  <source
    srcset="/images/hero-desktop.webp"
    media="(min-width: 641px)"
    type="image/webp"
  />
  <img
    src="/images/hero-desktop.jpg"
    alt="Nouvelle collection de saison"
    fetchpriority="high"
    decoding="async"
  />
</picture>
```

Avec l'attribut `fetchpriority="high"`, nous signalons au navigateur « charge cette image en priorité ». Le service Cloudflare Image Resizing effectue la conversion de format automatique sur l'edge du CDN (les navigateurs ne supportant pas WebP reçoivent du JPEG).

**Gain :** LCP 2,3s → 2,1s, durée de chargement de l'image 1200ms → 320ms. CLS (Cumulative Layout Shift) 0,12 → 0,02 — nous avons réservé l'espace du placeholder avec la propriété CSS `aspect-ratio`.

## Résultats benchmark + impact sur les utilisateurs réels

Score mobile PageSpeed Insights 34 → 92, desktop 62 → 98. Moyennes CrUX sur 28 jours :

| Métrique | Avant | Après | Changement |
|----------|-------|-------|------------|
| LCP | 10,2s | 2,1s | -79% |
| TBT | 2190ms | 420ms | -81% |
| CLS | 0,12 | 0,02 | -83% |
| TTFB | 840ms | 120ms | -86% |

Google Analytics — entonnoir de conversion : taux de lancement du paiement %3,2 → %4,8 (+50% lift relatif). Taux de rebond %68 → %52. Search Console : le trafic organique a augmenté de 34% en deux mois (autres modifications SEO maintenues constantes). Ces chiffres correspondent aux objectifs standard de [Commerce Headless](https://www.roibase.com.tr/fr/headless) de Roibase — si les améliorations de performance ne se traduisent pas par une métrique commerciale, le changement architectural n'est pas considéré comme réussi.

## Compromis et critères décisionnels

**Expérience développeur :** Nous avons ajouté des wrappers d'hydratation sélective, ce qui augmente la surface de l'API des composants. Les nouveaux développeurs doivent apprendre la différence entre `when-visible` et `when-idle`. Nous avons résolu cela avec la documentation Storybook + des règles ESLint.

**Taille du bundle vs coût runtime :** Les fichiers de polices auto-hébergées ajoutent +60kB au bundle de chargement initial, mais éliminent le coût DNS lookup + TLS handshake. Ce compromis représente un gain net sur réseau 3G mobile, neutre sur connexion fibre.

**Invalidation du cache :** La stratégie `swr` comporte un risque de données obsolètes. Nous gardons les données critiques comme l'inventaire à jour via une récupération realtime côté client (polling toutes les 30 secondes au lieu de WebSocket — le coût des fonctions edge est plus faible).

**Verrouillage fournisseur Cloudflare :** Le cache basé sur KV de `routeRules` est spécifique à Cloudflare. Une migration vers une autre plateforme nécessiterait une réimplémentation. Cependant, Vercel et Netlify offrent des primitives similaires, l'effort de migration est acceptable.

## Étapes suivantes

2,1s c'est bien, mais le P75 (75e percentile) de CrUX est encore à 3,2s. Voici la feuille de route :

1. **Image CDN + négociation de format automatique :** intégration Imgix au lieu de Cloudflare Polish, support AVIF
2. **Stratégie de préchargement :** précharger les données des product cards approchant du viewport via Intersection Observer
3. **Service Worker + mode hors ligne :** utiliser Workbox pour mettre en cache les ressources critiques, fallback network-first
4. **Fractionnement du bundle :** rendre le code splitting de Nuxt 3 agressif, chunking basé sur les routes

L'optimisation de performance est un jeu sans fin — chaque gain de 100ms produit un lift de 1-2% en conversion. La combinaison Nuxt 3 + Cloudflare Pages offre un équilibre entre rendu edge et ergonomie moderne du framework JavaScript. Lors du choix d'une pile, il faut définir l'objectif LCP comme une exigence métier, puis évaluer les options architecturales dans cette contrainte.