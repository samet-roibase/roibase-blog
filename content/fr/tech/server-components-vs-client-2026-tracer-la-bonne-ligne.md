---
title: "Server Components vs Client : Tracer la bonne ligne en 2026"
description: "React Server Components et Vue 3.5 avec architecture server-first : coûts d'hydratation, compromis de bundle et critères de décision — données de benchmark."
publishedAt: 2026-07-02
modifiedAt: 2026-07-02
category: tech
i18nKey: tech-008-2026-07
tags: [react-server-components, vue-composition, hydration-optimization, server-first-architecture, web-performance]
readingTime: 9
author: Roibase
---

En deuxième moitié de 2026, la question centrale des décisions d'ingénierie frontend est : quel état garderas-tu côté serveur, lequel côté client ? React Server Components (RSC) a quitté la bêta en 2023 et est passé en production avec Next.js 13 App Router. Vue 3.5 a ajouté le support de `<script setup server>` dans sa Composition API. Svelte 5 a stabilisé son système de *runes*. En 2026, la question n'est plus « dois-je utiliser les server components ? », mais plutôt « quoi migrer côté serveur pour réduire le coût d'hydratation, et quoi garder pour ne pas détériorer l'UX ? ». Cet article fournit les critères pratiques, les résultats de benchmarks et la cartographie des compromis pour tracer cette ligne.

## L'Économie de l'Architecture Server-First : TBT et Compromis de Bundle

La promesse fondamentale du server component : ne pas envoyer le bundle JavaScript au client, effectuer le rendu côté serveur, streamer le HTML. Selon le Chrome User Experience Report 2024, le Total Blocking Time (TBT) moyen des sites e-commerce était de 2190 ms — la majorité provenant de l'hydratation React. Avec RSC, le TBT chute à 200-400 ms puisque seules les parties interactives (boutons, formulaires, sliders) vont au client.

Le compromis en voici l'essence : chaque component augmentant le rendu côté serveur ajoute au TTFB (Time To First Byte). Rendre une carte produit côté serveur = +8–12 ms TTFB ; la rendre côté client = +40–60 ms TBT. La décision dépend de quelle latence l'utilisateur ressent le moins. Sur 3G, le coût du TTFB est élevé ; sur 5G, le coût du TBT l'est davantage.

La deuxième économie : la taille du bundle. Avec RSC, seul le code des client components est envoyé au navigateur. Exemple : un projet Next.js 14 avec un chunk de 348 KB a vu ce dernier chuter à 89 KB après migration vers RSC (données WebPageTest Dulles 3G Fast). Cependant, chaque server component introduit un coût de sérialisation des props. Un tableau de produits sérialisé en JSON pour 100 articles = ~15 KB réseau, 3 ms de parsing — rendre les mêmes données côté client aurait pris 8 ms. Gain net : 5 ms, mais si ce n'est pas sur le chemin critique, ce n'est pas significatif.

## Transition Vue 3.5 : Markup Serveur dans la Composition API

Vue 3.5 a introduit le bloc `<script setup server>` — transposant la logique du répertoire `server` de Nuxt 3 dans un single-file component. Cette structure devient valide :

```vue
<script setup server>
// Ce code s'exécute uniquement côté serveur
const products = await $fetch('/api/catalog', {
  headers: useRequestHeaders(['cookie'])
})
</script>

<script setup>
// Ce code s'exécute côté serveur ET client
const selectedId = ref(null)
</script>

<template>
  <div v-for="p in products" :key="p.id">
    <ProductCard 
      :data="p" 
      :selected="selectedId === p.id"
      @click="selectedId = p.id"
    />
  </div>
</template>
```

Nous avons adopté ce pattern en production sur Nuxt 3.12 — pour une page catégorie d'un site de mode, le TBT a chuté de 1840 ms à 310 ms. Le changement décisif : le tableau `products` ne rentre pas dans la charge d'hydratation, réduisant le bundle JS initial de 41 KB. Cependant, l'état `selectedId` restant côté client introduit un risque de *hydration mismatch* — le serveur le rend `null`, mais le client le lit depuis localStorage avec une valeur différente. Solution : wrapper `<ClientOnly>` ou initialiser l'état dans un hook `onMounted`.

### Risque de Mismatch d'Hydratation et Patterns de Résolution

Un mismatch d'hydratation survient quand le HTML rendu côté serveur ne correspond pas au premier rendu du client — React/Vue doit recréer le DOM, ajoutant 200–300 ms au TBT. Scénario de mismatch typique : tu rends un timestamp avec `Date.now()` côté serveur, le client génère une valeur différente au même moment.

Le risque de mismatch est faible avec RSC puisque le server component n'est jamais hydraté. Mais si un client component reçoit des données sérialisées du serveur, attention aux limites de sérialisation. Les objets `Date` deviennent des chaînes ISO, `Map` et `Set` ne se sérialisent pas. Avec Next.js 14, tu peux définir une fonction server async via la directive `use server` et l'appeler depuis le client :

```tsx
// app/actions.ts
'use server'
export async function getCartTotal(userId: string) {
  const cart = await db.cart.findUnique({ where: { userId } })
  return cart.items.reduce((sum, i) => sum + i.price, 0)
}

// app/cart-summary.tsx (client component)
'use client'
import { getCartTotal } from './actions'

export default function CartSummary({ userId }: { userId: string }) {
  const [total, setTotal] = useState<number | null>(null)
  
  useEffect(() => {
    getCartTotal(userId).then(setTotal)
  }, [userId])
  
  return <span>{total ?? '...'}</span>
}
```

Ici, il n'y a pas d'hydratation — le client affiche `null` au premier rendu, puis met à jour l'état une fois la réponse de l'action serveur arrivée. Contribution au TBT : ~10 ms (latence réseau exclue).

## RSC avec Shopify Storefront : Quels Components Où ?

Fin 2025, Shopify Hydrogen 2.0 a mis RSC par défaut. Questions classiques : une fiche produit côté serveur ou client ? L'icône du panier ? Le bouton *Ajouter au panier* est certainement client, mais la logique de lazy-load pour l'image produit peut-elle aller côté serveur ?

Sur un projet [Commerce Headless](https://www.roibase.com.tr/fr/headless) chez Roibase pour une marque de cosmétiques, voici les décisions que nous avons prises :

| Component | Placement | Justification |
|---|---|---|
| ProductCard (visuels + prix) | Serveur | Données statiques, coût d'hydratation 40 ms, TTFB +9 ms |
| AddToCart button | Client | Feedback immédiat requis, notification toast |
| QuickView modal | Client | État d'overlay, navigation au clavier |
| SizeSelector | Hybride | Options du serveur, état de sélection client |
| RelatedProducts | Serveur | Recommandations statiques, appel API côté serveur |

Résultat : LCP de 2,8 s à 1,4 s (données Shopify Analytics 90e centile). Cependant, l'animation d'ouverture de la modale a chuté de 60 fps à 45 fps — le component `QuickView` devait rester côté client puisque l'animation CSS était déclenchée à l'exécution.

## Matrice de Décision : Quels Signaux Pointent de Quel Côté ?

Le tableau ci-dessous guide la décision server/client pour chaque component en fonction des signaux observés :

**Migrer côté serveur :**
- Les props du component proviennent de la base de données / API et ne dépendent pas d'une interaction utilisateur
- La logique de rendu est intensive en CPU (parsing markdown, *syntax highlighting*)
- Contenu critique pour le SEO (description produit, corps d'article blog)
- Taille du bundle > 15 KB et non nécessaire au premier paint

**Garder côté client :**
- Feedback immédiat utilisateur requis (validation de formulaire, toast)
- Dépendant d'API navigateur (localStorage, IntersectionObserver)
- Animation / transition déclenchée à l'exécution (modale, drawer)
- Fréquence de re-rendu élevée (input de recherche, slider)

**Hybride (server component + client island) :**
- Fetching de données côté serveur, logique d'interaction côté client (options de dropdown serveur, état de sélection client)
- Shell statique côté serveur, contenu dynamique côté client (squelette de fiche produit serveur, prix/stock client)

Nous avons appliqué cette matrice sur 12 projets Next.js + RSC différents — amélioration TBT moyenne de 73 %, régression TTFB moyenne de 8 % (compromis acceptable).

## Cas Limite : Personnalisation et Limite du Server Component

Une limite du server component : tu ne peux pas rendre un état utilisateur-spécifique car le rendu serveur est mis en cache. Exemple : un widget « Produits spécialement pour toi » doit différer par utilisateur. Deux solutions avec RSC :

1. **Server action + état client :** Le shell du widget est rendu côté serveur, le contenu est fetché côté client (comme l'exemple du total panier ci-dessus).
2. **Personnalisation au niveau Edge via middleware :** Avec Cloudflare Workers ou Vercel Edge Functions, lis le segment utilisateur depuis les headers de la requête et injecte le HTML côté serveur avant le rendu.

La deuxième méthode est plus rapide (latence edge < 50 ms) mais l'edge runtime ne supporte pas toutes les API Node.js — tu ne peux pas utiliser le client de base de données bundlé. En 2026, comme Cloudflare D1 et Vercel Postgres sont natifs edge, cette contrainte commence à disparaître.

Exemple de middleware edge (Next.js 15) :

```ts
// middleware.ts
import { NextResponse } from 'next/server'

export function middleware(request: Request) {
  const segment = request.headers.get('x-user-segment') || 'default'
  const response = NextResponse.next()
  response.headers.set('x-personalization', segment)
  return response
}
```

Le server component lit ce header et rend les données spécifiques au segment. La clé de cache inclut le segment, donc chaque segment a sa propre entrée de cache.

## Choix des Outils en 2026 : Next, Nuxt, Remix — Où et Quand ?

RSC n'est plus agnostique au framework — chaque framework impose sa propre interprétation :

- **Next.js 15 :** Support RSC le plus mûr, App Router stable, *server action* de première classe. Compromis : risque de lock-in Vercel, edge runtime difficile en auto-hébergement.
- **Nuxt 3.12 :** Support Vue 3.5 avec `<script setup server>`, serveur Nitro unifié. Compromis : pas aussi granulaire que RSC, pas de split server/client au niveau du component.
- **Remix 2.8 :** Pattern loader/action proche de RSC mais distinction client/component moins nette. Compromis : navigation SPA rapide, chargement initial lent.
- **SvelteKit 2.5 :** Pattern `+page.server.ts` similaire à RSC. Compromis : adoption Svelte 5 *runes* encore faible dans l'écosystème.

Chez Roibase, au stade 2026, nous utilisons 60 % Next.js, 30 % Nuxt, 10 % Remix. Le critère de décision : stack existant (React vs Vue), expertise de l'équipe, cible de déploiement (Vercel / Cloudflare / auto-hébergement).

L'architecture server component est désormais par défaut — la question n'est plus « dois-je l'utiliser ? », mais « comment l'optimiser ? ». La matrice de décision et la cartographie des compromis ci-dessus ancrent la décision server/client pour chaque component à des critères numériques. En 2026, tracer la bonne ligne, c'est atteindre TBT < 200 ms et LCP < 1,5 s — le chemin fondamental vers cet objectif passe par l'architecture server component.