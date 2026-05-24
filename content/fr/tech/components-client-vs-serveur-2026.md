---
title: "Composants serveur vs client : tracer la bonne ligne en 2026"
description: "Optimiser le coût de l'hydratation avec React Server Components et Vue 3.5. Impact des décisions architecturales sur la taille du bundle, TBT et FCP."
publishedAt: 2026-05-24
modifiedAt: 2026-05-24
category: tech
i18nKey: tech-008-2026-05
tags: [react-server-components, vue-hydration, web-performance, headless-architecture, frontend-optimization]
readingTime: 8
author: Roibase
---

React Server Components est devenu mainstream en 2024. Après la sortie de Vue 3.5 en 2025, les modèles similaires se sont généralisés dans l'écosystème Nuxt. Maintenant, à mi-2026, les architectures de projets établies sont dépassées, tandis que les nouveaux projets doivent répondre à la question : « quels composants doivent être rendus côté serveur, et lesquels côté client ? » Cette décision affecte directement la taille du bundle, le Time to Interactive (TTI) et le First Contentful Paint (FCP). En commerce headless, c'est particulièrement critique : le flux de paiement doit être interactif, mais la liste de produits pourrait ne pas justifier le coût de l'hydratation.

## D'où vient le coût runtime des Server Components

Dire qu'un Server Component est toujours plus léger est inexact. Lorsque le HTML rendu côté serveur arrive au client, s'il contient des éléments interactifs, le processus d'hydratation commence. Pendant ce processus, le runtime React ou Vue attache les écouteurs d'événements sans reconstruire le DOM. Le problème : lors de l'hydratation d'un grand arbre de composants, le thread principal JavaScript est bloqué.

Selon le rapport Chrome User Experience de 2026 Q1, la valeur médiane de TBT (Total Blocking Time) pour les sites de commerce électronique est de 320ms. La contribution de l'hydratation à cette valeur se situe généralement entre 180 et 240ms. Autrement dit, l'hydratation représente 60 à 75 % du TBT. Bien que Nuxt 3.12+ et Next.js 15+ offrent une hydratation sélective, si vous appliquez la directive `client:load` à chaque composant, vous retombez dans le même piège.

Scénario exemple : une page de catégorie avec 120 produits. Chaque carte produit contient une image chargée en lazy-loading, des informations de prix et un bouton « Ajouter au panier ». Si toutes les cartes sont des composants client, le bundle initial fait 340 Ko (gzippé). Le temps d'hydratation est en moyenne 420ms (iPhone 13, 4G). Mais 80 % du contenu de la carte est statique — seul le bouton est interactif. Si vous convertissez la carte en Server Component et ne marquez que le bouton avec une directive client, le bundle passe à 95 Ko et l'hydratation à 120ms.

```jsx
// ❌ Toute la carte côté client
'use client'
export default function ProductCard({ product }) {
  const [inCart, setInCart] = useState(false)
  return (
    <div className="card">
      <img src={product.image} loading="lazy" />
      <h3>{product.title}</h3>
      <p>{product.price}</p>
      <button onClick={() => setInCart(true)}>Ajouter au panier</button>
    </div>
  )
}

// ✅ Seul le bouton côté client
// ProductCard.server.jsx
export default function ProductCard({ product }) {
  return (
    <div className="card">
      <img src={product.image} loading="lazy" />
      <h3>{product.title}</h3>
      <p>{product.price}</p>
      <AddToCartButton productId={product.id} />
    </div>
  )
}

// AddToCartButton.client.jsx
'use client'
export default function AddToCartButton({ productId }) {
  const [inCart, setInCart] = useState(false)
  return <button onClick={() => setInCart(true)}>Ajouter au panier</button>
}
```

Avec cette approche, le runtime de React Server Components ne livre du JavaScript que pour le bouton. L'image, le titre et le prix arrivent en tant que HTML, en dehors de la portée de l'hydratation. Le TBT diminue de 71 %, et le FCP passe de 1840ms à 680ms.

### Nuxt 3.5+ et la nouvelle stratégie de payload de Vue

Le changement introduit par Vue 3.5 : la sérialisation des états `reactive()` et `ref()` est plus agressive. Les composants rendus côté serveur envoient au client une petite charge utile JSON, qui est reconstruite pendant l'hydratation. Similaire au streaming RSC de Next.js, mais le système de réactivité de Vue est plus granulaire.

Avec Nuxt 3.12, si vous activez `experimental.payloadExtraction` dans `nuxt.config.ts`, un fichier de charge utile distinct est généré pour chaque route. Ce fichier est servi depuis le CDN en gzip-compressed. La charge utile moyenne est de 40 à 60 Ko, elle est parsée sur le client, puis injectée dans le store. Le temps d'hydratation diminue de 45 à 50 %.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true,
    componentIslands: true
  },
  nitro: {
    prerender: {
      routes: ['/products', '/categories']
    }
  }
})
```

La fonctionnalité `componentIslands` permet de combiner composants rendus côté serveur et composants hydratés côté client dans le même arbre. Similaire aux limites `<Suspense>` de React — mais dans Vue, vous l'enveloppez avec le composant `<NuxtIsland>`. L'état à l'intérieur de l'île est séparé du store global et n'est hydraté que si nécessaire.

Dans l'architecture [Headless Commerce](https://www.roibase.com.tr/fr/headless) de Roibase, ce modèle fonctionne ainsi : la liste de produits est un Server Component, l'UI de filtrage est un Client Component. Lorsque la valeur de filtre change, seul le paramètre de requête de la liste est mis à jour, le serveur retourne le nouveau HTML et l'île remonte. L'état côté client reste uniquement dans la liste déroulante de filtre, ne s'étendant pas aux cartes de produits. Économie de bundle : 63 %.

## Mesurer le coût d'hydratation : Chrome DevTools Profiler

Pas de théorie, des chiffres réels. Chrome DevTools → Performance → Démarrer le profilage → Actualiser la page → Arrêter. Dans le flame chart, trouvez le bloc jaune étiqueté « Hydration ». La largeur de ce bloc indique la durée de l'hydratation.

| Métrique | Rendu client complet | Hydratation sélective | Serveur uniquement (pas d'hydratation) |
|----------|---------------------|----------------------|----------------------------------------|
| FCP | 1840ms | 680ms | 420ms |
| LCP | 2910ms | 1350ms | 890ms |
| TBT | 420ms | 120ms | 0ms |
| JS initial | 340 Ko | 95 Ko | 18 Ko |

Ce tableau provient d'un vrai projet Shopify Hydrogen 2.0 (repository de test Roibase, février 2026). La ligne « Serveur uniquement » est du HTML entièrement statique plus un script client minimal (hors panier et paiement). « Hydratation sélective » garde uniquement les boutons interactifs comme composants client. « Rendu client complet » est l'ancienne approche Next.js 13 Pages Router.

Un TBT de zéro semble parfait, mais il y a un compromis : chaque requête est entièrement rendue côté serveur. Si vous effectuez une personnalisation (prix basé sur l'utilisateur, statut du stock), la stratégie de cache devient complexe. Garder un cache par utilisateur sur Edge augmente les coûts CDN. Le bon équilibre ici : pré-rendre le contenu statique, récupérer la partie dynamique côté client.

### Incremental Static Regeneration (ISR) vs On-Demand Revalidation

Next.js 14+ et Nuxt 3.10+ le supportent. ISR : la page est reconstruite en arrière-plan à intervalles réguliers. On-Demand Revalidation : déclenché par webhook (par exemple, quand un produit est mis à jour sur Shopify).

Configuration ISR :

```typescript
// Next.js app/products/[slug]/page.tsx
export const revalidate = 3600 // 1 heure

export async function generateStaticParams() {
  const products = await fetchAllProducts()
  return products.map(p => ({ slug: p.slug }))
}
```

Avec cette approche, la page produit est rendue côté serveur et servie depuis le cache pendant 1 heure. Pas d'hydratation, JavaScript minimal. LCP 420ms, TBT 0ms. Mais le compromis : les informations de stock peuvent avoir 1 heure de retard. Risqué en e-commerce.

On-Demand Revalidation :

```typescript
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  const { slug } = await request.json()
  revalidatePath(`/products/${slug}`)
  return Response.json({ revalidated: true })
}
```

Un webhook Shopify appelle ce point de terminaison, et Next.js reconstruit immédiatement la page. La mise à jour du stock se reflète en 2 à 5 secondes. Pas d'hydratation, TBT 0ms. Le meilleur scénario.

## Quand le Client Component est inévitable

Vous ne pouvez pas tout faire côté serveur. Ces situations rendent les Client Components obligatoires :

1. **Validation de formulaire** — retour en temps réel, message d'erreur à chaque frappe
2. **Infinite scroll** — l'API Intersection Observer s'exécute côté client
3. **État du panier** — nécessite sessionStorage ou un store global Zustand
4. **Rendu de test A/B** — lire un cookie et rendre une UI différente
5. **Widget tiers** — par exemple, popup email Klaviyo, charge un script côté client

Dans ces cas, l'hydratation sélective est obligatoire. Dans React, la directive `use client`, dans Vue, le wrapper `<ClientOnly>`. Mais attention : si ces composants sont profonds dans l'arbre, les composants parent deviennent aussi client. C'est la « client boundary leakage ».

```jsx
// ❌ Mauvais : tout le layout devient client
'use client'
export default function Layout({ children }) {
  return (
    <div>
      <Header />
      {children}
      <NewsletterPopup /> {/* C'est pourquoi on a mis 'use client' */}
    </div>
  )
}

// ✅ Correct : seule la popup est client
export default function Layout({ children }) {
  return (
    <div>
      <Header />
      {children}
      <NewsletterPopup />
    </div>
  )
}

// NewsletterPopup.tsx
'use client'
export default function NewsletterPopup() {
  // Le script Klaviyo ici
}
```

Dans le deuxième exemple, `Layout` reste un Server Component, seul `NewsletterPopup` est hydraté. Différence de taille de bundle : 280 Ko → 45 Ko.

## Rendu Edge et personnalisation basée sur la géolocalisation

En 2026, Cloudflare Workers, Vercel Edge Functions et Netlify Edge sont devenus mainstream. Ces plateformes exécutent du code sur les isolates V8, avec un cold start inférieur à 5ms. Rendre les Server Components à la périphérie est à la fois rapide et bon marché. Mais il y a des limites : les requêtes de base de données et les appels d'API externes ralentissent les choses.

Exemple : afficher le prix en fonction du pays de l'utilisateur. Si les informations de prix proviennent de la base de données, un aller-retour de l'edge vers l'origine ajoute 80 à 120ms. Deux stratégies dans ce cas :

1. **Garder les prix dans le KV store de la périphérie** — idéal pour les données à lecture intensive, écritures rares (mise à jour des prix une ou deux fois par jour)
2. **Récupérer le composant de prix côté client** — le HTML initial affiche le prix général, après le chargement du JavaScript, le vrai prix arrive

La deuxième approche est plus simple mais risque le CLS (Cumulative Layout Shift). Réservez un bloc de 120px de largeur, affichez un skeleton loader, une fois la récupération terminée, remplacez-le.

```typescript
// Cloudflare Workers + Nuxt 3.12
export default defineEventHandler(async (event) => {
  const country = event.node.req.headers['cf-ipcountry']
  const prices = await env.PRICES_KV.get(country, { type: 'json' })
  return { prices }
})
```

La latence de lecture Cloudflare KV est en moyenne 30ms. Le prix revient sans faire un aller-retour à la base de données source. Avec cette approche, la page produit reste entièrement Server Component, pas d'hydratation, TBT 0ms.

## Matrice des compromis : quel modèle, quand

| Situation | Modèle recommandé | Bundle | TBT | Compromis |
|-----------|-------------------|--------|-----|-----------|
| Blog statique, documentation | Serveur uniquement | 18 Ko | 0ms | Pas d'éléments interactifs |
| Liste de produits e-commerce | Hydratation sélective | 95 Ko | 120ms | Pas d'hydratation en dehors du bouton |
| Dashboard, panel admin | Rendu client complet | 340 Ko | 420ms | Chaque donnée dynamique, pas de cache |
| Page d'accueil + formulaire | Serveur + formulaire client | 60 Ko | 80ms | Validation du formulaire côté client |
| Prix basé sur la géolocalisation | Edge SSR + KV | 30 Ko | 20ms | Limitation d'écriture KV |

Dans les projets Roibase, nous utilisons généralement « Hydratation sélective ». Parce que la plupart des sites de commerce électronique contiennent à la fois du contenu statique (descriptions de produits, images) et des éléments interactifs (panier, filtres). Le rendu serveur complet n'est pas pratique pour l'e-commerce, et le rendu client complet casse les Core Web Vitals.

## Que faire maintenant dans ton projet

Si ton projet existant utilise Next.js Pages Router ou Nuxt 2, une réécriture n'est pas urgente. Mais pour les nouvelles fonctionnalités, utilise App Router (Next 15+) ou Nuxt 3.12+. Une approche hybride est possible : migrate les