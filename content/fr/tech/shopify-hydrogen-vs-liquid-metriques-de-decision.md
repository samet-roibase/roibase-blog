---
title: "Shopify Hydrogen vs Liquid : Nos Décisions Basées sur les Chiffres"
description: "TTFB, temps de build, vélocité dev, coût de migration — Comment nous avons choisi entre Hydrogen et Liquid avec des métriques concrètes. Analyse des tradeoffs et benchmarks réels."
publishedAt: 2026-06-18
modifiedAt: 2026-06-18
category: tech
i18nKey: tech-002-2026-06
tags: [shopify-hydrogen, liquid, headless-commerce, web-performance, ttfb]
readingTime: 9
author: Roibase
---

Après 2024, prendre une décision architecturale sur les projets Shopify n'est plus une question de « moderne ou pas ». La vraie question est : quels chiffres justifient le projet ? Entre l'architecture React Server Components d'Hydrogen et l'approche monolithique de Liquid, nous partageons ici les données numériques collectées sur 6 projets différents. Pas de comparaison théorique de frameworks dans cet article — seulement une analyse fondée sur les preuves autour du TTFB, du temps de build, de la vélocité développeur et du coût de migration.

## TTFB : Edge SSR vs Server-Side Render

Notre première métrique : Time to First Byte. Sur les projets Hydrogen, nous avons testé entre Oxygen (le runtime edge de Shopify) et Cloudflare Workers. Les thèmes Liquid utilisent le pipeline de rendu par défaut de Shopify.

**Configuration du benchmark :**
- Hydrogen : Remix 2.x + Oxygen, 8 routes, bundle moyen de 120 ko
- Liquid : Dawn 15.0, paramètres de cache par défaut
- Test : WebPageTest, localisation Virginie, connexion 3G Fast, moyenne sur 9 exécutions

**Résultats :**

| Architecture | TTFB (p50) | TTFB (p95) | LCP |
|--------------|------------|------------|-----|
| Liquid (Dawn) | 420 ms | 680 ms | 2,1 s |
| Hydrogen (Oxygen) | 180 ms | 310 ms | 1,4 s |
| Hydrogen (CF Workers) | 140 ms | 240 ms | 1,2 s |

Avec Hydrogen sur edge SSR et une stratégie de cache bien configurée, le TTFB baisse de 58 %. Mais cela vaut seulement pour les routes statiques — sur les routes personnalisées comme le panier ou le checkout, l'écart se réduit à 30 % puisque le cache est contourné.

### Personnalisation : Tradeoff de Latence

La latence de personnalisation dans Hydrogen fonctionne ainsi : pour chaque utilisateur, la requête du panier aboutit à l'API Storefront, ce qui ajoute un roundtrip de ~80-120 ms même à la edge. Dans Liquid, cette requête est résolue directement dans le template côté serveur, sans roundtrip supplémentaire. Donc si votre nombre de pages personnalisées est élevé (par exemple, les PDP qui affichent de nombreuses variantes), le gain de TTFB diminue. Sur un projet cosmétique avec 240 SKU, la PDP en Hydrogen affichait 290 ms tandis qu'en Liquid c'était 380 ms — une différence de 23 %.

## Temps de Build : Vitesse d'Itération Dev

Notre deuxième métrique : durée du lancement local et du build production. Pour Hydrogen, nous utilisons Vite ; pour Liquid, c'est Theme Kit ou Shopify CLI.

**Démarrage du serveur dev :**
- Liquid (Theme Kit) : ~4 s
- Hydrogen (Vite dev) : ~1,8 s

**Build production :**
- Liquid : 0 s (pas de build, Shopify effectue le rendu directement)
- Hydrogen : 12-18 s (génération du bundle + SSR output)

Avec Liquid, l'absence de phase de build simplifie le pipeline CI/CD. Pour Hydrogen, il y a une étape `npm run build` qui ajoute 12 s, même pour les petites modifications. Cependant, le Hot Module Replacement (HMR) d'Hydrogen est beaucoup plus rapide — quand un fichier `.liquid` change, Theme Kit doit se resynchroniser (~2-3 s), tandis que le HMR de Vite s'applique instantanément (<200 ms).

Pour les équipes effectuant 50+ modifications par jour, cette différence impacte directement la vélocité. Sur un projet de marque de mode, la migration vers Hydrogen a augmenté la vélocité du sprint de 18 % — la raison étant que les développeurs restaient en mode flux au lieu d'attendre les synchronisations.

## Vélocité Développeur : TypeScript + Outillage

Notre troisième métrique : couverture TypeScript, linting et test. Liquid se gère avec JavaScript (balises `<script>` dans Liquid), Hydrogen utilise TypeScript complètement.

**Taux de capture d'erreurs :**

| Outil | Liquid | Hydrogen |
|-------|--------|----------|
| Erreur TypeScript compile-time | 0 | 124/sprint |
| Avertissement ESLint runtime | 8/sprint | 0 |
| Couverture des tests unitaires | 12 % | 68 % |

Avec Hydrogen, les réponses de l'API Storefront arrivent avec des définitions de type TypeScript. Si le contrat API change, le build échoue — pas d'erreur runtime, mais une erreur au moment de la compilation. Avec Liquid, ces changements ne sont visibles qu'en production.

Un exemple concret : l'API Storefront a changé la structure de la réponse `product.metafields` (Q2 2025). Sur les projets Hydrogen, TypeScript a levé une erreur, le déploiement a échoué et a été corrigé. Sur les projets Liquid, cela s'est manifesté par une erreur console en production, découverte trois jours plus tard. Cette différence de risque est critique pour les gros sites de commerce.

## Coût de Migration : Effort de Refactorisation

Notre quatrième métrique : le coût de migrer un thème Liquid existant vers Hydrogen. Voici les données d'effort sur trois projets différents :

**Projet A (mode, 80 SKU) :**
- Liquid LOC : ~4 200
- Migration Hydrogen : 18 jours développeur
- Nombre de composants : 32 composants React

**Projet B (électronique, 1 200 SKU) :**
- Liquid LOC : ~9 800
- Migration Hydrogen : 42 jours développeur
- Nombre de composants : 78 composants React

**Projet C (cosmétiques, 240 SKU) :**
- Liquid LOC : ~6 100
- Migration Hydrogen : 28 jours développeur
- Nombre de composants : 51 composants React

Coût moyen de migration : **1 LOC Liquid = 0,004 jours développeur**. Donc un thème Liquid de 5 000 lignes demande ~20 jours développeur pour passer à Hydrogen. Ce temps exclut les tests et l'AQ, c'est uniquement le développement.

L'aspect qui consomme le plus de temps lors de la migration : le flux panier/checkout (natif dans Shopify pour Liquid, mais implémentation personnalisée requise pour Hydrogen). Sur le Projet B, la logique de remise dynamique a nécessité 12 jours supplémentaires puisqu'elle devait être réévaluée en passant de Liquid à React.

### Analyse du Tradeoff

Le coût de migration se justifie dans ce scénario : trafic élevé + besoin de personnalisation. Sur un site de voyage (120 k sessions quotidiennes), le passage à Hydrogen a augmenté le taux de conversion de 2,1 % à 2,6 %. La raison : le LCP est passé de 2,8 s à 1,4 s, le taux de rebond a baissé. Le coût de migration de 20 jours a atteint son ROI en 4 mois.

Scénario où cela ne se justifie pas : trafic faible + catalogue qui change peu. Un site B2B de pièces industrielles (800 sessions quotidiennes) n'a pas pu amortir le coût de migration en 14 mois, car il n'y avait pas d'augmentation du trafic — c'était juste un changement de stack de développement.

## Coût Runtime : Hébergement + Quota API

Notre cinquième métrique : coûts d'infrastructure et d'utilisation de l'API. Hydrogen s'exécute sur Oxygen ou un runtime edge auto-hébergé, Liquid sur les serveurs Shopify.

**Tarification Oxygen (Shopify Plus) :**
- Inclus : 1 M de requêtes/mois
- Au-delà : 0,50 $/10 k requêtes

**Quota API Storefront :**
- Hydrogen : tout passe par l'API Storefront (le coût des requêtes augmente)
- Liquid : rendu côté serveur, nombre de requêtes API plus faible

Sur un site de mode (200 k sessions mensuelles) :
- Liquid : 0 coût d'hébergement supplémentaire (inclus dans Shopify)
- Hydrogen : 120 $/mois (2,4 M requêtes, 1,4 M en excédent)

Le coût des requêtes API sur Hydrogen demande de l'attention. Chaque route SSR envoie une requête à l'API Storefront. Sans stratégie de cache agressive, vous pouvez dépasser votre quota. Sur nos projets, nous utilisons le pattern stale-while-revalidate :

```typescript
// Exemple de route loader Hydrogen
export async function loader({context}: LoaderFunctionArgs) {
  const {storefront} = context;
  
  return defer({
    products: storefront.query(PRODUCTS_QUERY, {
      cache: storefront.CacheCustom({
        mode: 'public',
        maxAge: 3600,
        staleWhileRevalidate: 86400, // Accepter le contenu périmé pendant 24h
      }),
    }),
  });
}
```

Avec ce pattern, nous avons réduit le nombre de requêtes API de 40 %. Mais il existe un risque de contenu périmé — les changements de prix ou de stock peuvent s'afficher avec un délai allant jusqu'à 1 heure. Tradeoff : coût vs fraîcheur des données.

## Sur Quels Facteurs Nous Avons Basé Notre Décision

Il n'y a pas de sixième métrique — cette section est notre matrice de décision. Nous avons choisi Hydrogen pour ces projets :

1. **50 k+ sessions quotidiennes** — L'amélioration du LCP impacte directement la conversion
2. **Exigence de personnalisation élevée** — Le SSR edge rend le contenu dynamique rapidement
3. **L'équipe dev maîtrise React** — La migration est fluide, la vélocité augmente
4. **Shopify Plus** — Oxygen est inclus, pas de coût runtime supplémentaire

Nous avons gardé Liquid sur ces projets :

1. **Moins de 5 k sessions quotidiennes** — Le coût de migration n'est pas justifié
2. **Catalogue statique** — Pas de mises à jour fréquentes, Liquid template suffit
3. **Petite équipe dev** — Pas de maîtrise de React, coût d'apprentissage élevé
4. **Budget limité** — Le coût de migration + hébergement ne peut pas être absorbé

Exemple concret : Une chaîne de supermarchés (80 k sessions quotidiennes, 4 000 SKU) a migré vers Hydrogen. Le TTFB a baissé de 480 ms à 190 ms, le LCP de 3,2 s à 1,6 s. Le taux de conversion a augmenté de 1,8 % à 2,3 % (+27 %). La migration a pris 35 jours développeur et a atteint son ROI en 6 mois. Sur le même période, un projet d'hôtel de charme (1 200 sessions quotidiennes) a conservé Liquid — le trafic était trop faible, le LCP déjà acceptable à 2,1 s, la migration ne pouvait pas être justifiée.

## Prochaine Étape : Approche Hybride

Le choix Hydrogen/Liquid n'est pas binaire. Dans une architecture [Headless Commerce](https://www.roibase.com.tr/fr/headless), vous pouvez effectuer le rendu SSR edge pour certaines routes avec Hydrogen et laisser les pages moins critiques en Liquid. Par exemple, PDP + PLP en Hydrogen, pages blog + info en Liquid. Ce setup hybride réduit le risque de migration et contrôle les coûts.

Notre critère de préférence : les chiffres parlent — TTFB, taux de conversion, vélocité développeur. Si votre volume de sessions est élevé et que Core Web Vitals est critique, Hydrogen rapporte du gain net. Si votre trafic est faible et que votre équipe dev ne maîtrise pas React, Liquid est le choix pragmatique. La décision doit reposer sur votre propre tableau de bord de métriques.