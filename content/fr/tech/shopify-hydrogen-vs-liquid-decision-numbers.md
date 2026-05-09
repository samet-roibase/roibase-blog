---
title: "Shopify Hydrogen vs Liquid : Les Chiffres Derrière Notre Décision"
description: "TTFB 840ms → 180ms, temps de compilation 12min → 90s. Les données, compromis et calcul de coût de migration derrière la transition Hydrogen."
publishedAt: 2026-05-09
modifiedAt: 2026-05-09
category: tech
i18nKey: tech-002-2026-05
tags: [shopify-hydrogen, headless-commerce, web-performance, remix, ttfb]
readingTime: 8
author: Roibase
---

Nous utilisions les thèmes Shopify Liquid depuis 7 ans. Quand les limites de personnalisation des thèmes, les temps de réponse serveur figés et les cycles de déploiement monolithiques ont commencé à nous freiner, le mot « headless » est arrivé sur la table. Mais une question bloquait la décision : comment mesurer le ROI de la migration vers Hydrogen ? Cet article détaille notre réponse numérique — TTFB, temps de compilation, vélocité développeur, coût de migration. Nous avons choisi Hydrogen parce que ce n'est pas juste un framework : c'est un gain de performance mesurable.

## Le Plafond de Performance de Liquid

Le moteur de thème Shopify Liquid rend du HTML côté serveur. La syntaxe Liquid est parsée côté serveur, les appels Storefront API sont faits, le HTML est assemblé et envoyé au client. Cette architecture est simple et stable — mais elle a un plafond.

Sur notre store en production, le TTFB médian était de 840ms (données RUM, Cloudflare Analytics). Le percentile 95 montait à 1,4 secondes. Nous ne pouvons pas contrôler le temps de réponse Shopify — infrastructure partagée. Même en optimisant le fichier de thème Liquid (lazy load de sections inutilisées, réduction du nombre de snippets), la latence serveur restait figée.

Le temps de compilation est un autre problème. Quand vous modifiez un fichier de thème, vous le poussez via Shopify CLI. Le déploiement moyen prenait 12 minutes. Dans un pipeline CI/CD, cette durée signifie attendre entre les stages. La vélocité d'itération pour les tests A/B baisse. La vélocité développeur est contrainte.

```bash
# Déploiement de thème Liquid (moyenne)
shopify theme push --store=production
⏱ Upload: 4m 20s
⏱ Processing: 7m 40s
✅ Total: 12m 00s
```

Le compromis de Liquid : configuration simple, zéro gestion d'infrastructure — mais aucun contrôle de performance, itération lente.

## La Promesse Technique de Hydrogen

Hydrogen est le framework headless de Shopify, construit sur Remix. React Server Components, streaming SSR, déploiement en edge. La différence architecturale est celle-ci : avec Liquid, le serveur Shopify rend le HTML. Avec Hydrogen, tu déploies ton propre serveur en edge (Oxygen, Cloudflare, Vercel). Tu appelles directement l'API Storefront, tu streams la réponse dans ton arbre de composants.

La promesse de TTFB : en rendant depuis un nœud edge, la latence serveur Shopify disparaît. Déployé sur Cloudflare Workers, le TTFB médian baisse à 100-200ms (latence POP Cloudflare + RTT API Storefront). La promesse du temps de compilation : build basé sur Vite, déploiement incrémental, sous 2 minutes.

Mais la promesse a un coût : effort de migration, courbe d'apprentissage développeur, propriété de l'infrastructure. Nous avons avancé en modélisant ces compromis numériquement.

### Méthodologie de Benchmark

Nous avons mis en place deux environnements :
1. **Baseline Liquid :** store en production, fork du thème Dawn, 80+ sections, proxy Cloudflare (bypass cache)
2. **Prototype Hydrogen :** même arbre de composants homepage, déploiement Cloudflare Workers, API Storefront 2024-01

Configuration du test :
- WebPageTest (localisation Dulles, Moto G4, 3G Fast)
- Valeurs médianes sur 3 exécutions
- État de cache vide (flush avant chaque test)

Métriques :
- TTFB (Time to First Byte)
- LCP (Largest Contentful Paint)
- TBT (Total Blocking Time)
- Temps de compilation (mesuré dans CI/CD)

## Comparaison de Performance

Les résultats (médiane sur 3 exécutions) :

| Métrique | Liquid | Hydrogen | Différence |
|---|---|---|---|
| **TTFB** | 840ms | 180ms | **-79%** |
| **LCP** | 2.4s | 1.1s | **-54%** |
| **TBT** | 680ms | 220ms | **-68%** |
| **Temps de compilation** | 12m 00s | 1m 30s | **-88%** |

La baisse du TTFB correspondait à nos attentes. Avec Hydrogen, le nœud edge Cloudflare Workers atteint l'API Storefront avec un RTT de 40-60ms (le CDN Shopify est déjà sur Cloudflare). Avec Liquid, le serveur Shopify fait parsing Liquid + appel API + assemblage HTML — minimum 600ms de surcharge.

Le gain en LCP vient du streaming SSR. Hydrogen envoie le premier byte tôt et stream le HTML. Le contenu critique (image hero, grille de produits ATF) se rend en premier, le contenu below-the-fold se charge paresseusement. Avec Liquid, le rendu HTML est bloquant — la page entière attend d'être prête avant envoi.

La baisse du TBT vient de l'optimisation du bundle et de l'hydratation. Avec Hydrogen, nous utilisons React Server Components — le bundle JS côté client est de 120KB (gzip). Le thème Liquid avait jQuery + scripts personnalisés : 340KB. Le temps d'hydratation a baissé.

La différence de temps de compilation impacte directement la vélocité développeur. 12 minutes au lieu de 90 secondes, 10 déploiements par jour = 115 minutes d'économie. Le pipeline CI/CD s'accélère, le cycle d'itération des tests A/B raccourcit.

```typescript
// Exemple de streaming SSR Hydrogen (loader Remix)
export async function loader({ context }: LoaderFunctionArgs) {
  const { storefront } = context;
  
  const productsPromise = storefront.query(PRODUCTS_QUERY);
  const collectionsPromise = storefront.query(COLLECTIONS_QUERY);
  
  // Stream : la réponse initiale revient immédiatement
  return defer({
    products: productsPromise,
    collections: collectionsPromise,
  });
}
```

L'API `defer` stream les promises. Le client reçoit le HTML initial, et la page se rend progressivement à mesure que les données arrivent. Le TTFB reste bas.

## Calcul du Coût de Migration

Le gain de performance est net — mais quel est le coût de migration ? Nous avons établi ce détail :

**Effort de Développement :**
- Migration composant Thème → Hydrogen : 160 heures (2 développeurs seniors, 4 semaines)
- Intégration API Storefront (réécriture requête GraphQL) : 40 heures
- Configuration pipeline CI/CD (Cloudflare Workers) : 16 heures
- QA + correction des cas limites : 24 heures
- **Total :** 240 heures

**Coût d'Infrastructure :**
- Cloudflare Workers : $5/mois (gratuit jusqu'à 100K requêtes — notre trafic : 80K/mois)
- Oxygen (plateforme edge Shopify) : $20/mois tier de départ
- Nous avons choisi Cloudflare — nous utilisons déjà le proxy Cloudflare

**Surcharge de Maintenance :**
- Hydrogen doit être mis à jour tous les 6 mois (suivi Remix)
- Courbe d'apprentissage développeur : l'équipe doit maîtriser React + Remix
- Avec Liquid, nous utilisions un template du Theme Store — Hydrogen demande du développement personnalisé

Coût total one-time de migration : **240 heures × $80/heure = $19,200**. Coût infrastructure annuel : **$60**.

Face à cela, comment avons-nous modélisé les gains ? Deux axes :

1. **Impact sur le Taux de Conversion :** La corrélation entre Core Web Vitals et taux de conversion est établie (étude Google/Deloitte : baisse de 0.1s de LCP = +1-2% de conversion). Notre LCP a baissé de 1.3s — estimation conservatrice +1.5% de lift. Sur un revenu mensuel de $200K = $3K/mois de lift. Annuel : **$36K**.

2. **Vélocité Développeur :** Le temps de compilation a baissé de 88%. L'équipe fait 40 déploiements par mois (CI/CD). Chaque déploiement = 10,5 minutes d'économie = 420 minutes par mois = 7 heures. À $80/heure développeur senior, $560/mois d'économie. Annuel : **$6,7K**.

Période de rentabilité : $19,200 / ($36K + $6,7K) = **5,4 mois**.

Ce calcul justifiait la migration. Le gain de performance + la vélocité développeur remboursent le coût de migration en 6 mois.

## Compromis et Limites

Hydrogen n'est pas le bon choix pour chaque store. Voici quand Liquid reste plus logique :

**Liquid doit rester :**
- Trafic bas (<10K/mois de visiteurs) — la différence de TTFB n'impacte pas la conversion
- L'équipe ne maîtrise pas React/TypeScript — la courbe d'apprentissage double le coût de migration
- Le template du Theme Store suffit — pas besoin de personnalisation
- Tu ne veux pas gérer l'infrastructure — le serveur partagé Shopify est simple

**Migrer vers Hydrogen :**
- Trafic élevé (>50K/mois) — chaque 100ms de TTFB impacte la conversion
- UI/UX personnalisée requise — l'architecture [Headless Commerce](https://www.roibase.com.tr/fr/headless) offre la flexibilité
- La vélocité d'itération des tests A/B est critique — le pipeline CI/CD doit être sous 2 minutes
- L'équipe développeur travaille déjà avec une stack frontend moderne (React/Remix)

Le coût de maintenance de Hydrogen existe aussi. Remix sort une major version tous les 6 mois. Hydrogen le suit. Liquid garantit la rétrocompatibilité Shopify — un ancien thème marche après 5 ans. Avec Hydrogen, la discipline de mise à jour des dépendances est requise.

Le déploiement en edge a aussi ses limites. Le runtime Cloudflare Workers a des contraintes (CPU time 50ms, mémoire 128MB). La logique backend complexe (par exemple, un moteur de recommandation) ne marche pas en edge — tu dois l'offload vers un serveur d'origine. Avec Liquid, ce problème n'existe pas, le serveur est sans limites.

## Et Maintenant ?

Nous avons choisi Hydrogen — parce que le TTFB a baissé de 79%, le temps de compilation de 88%, et la période de rentabilité est de 5,4 mois. Mais nous avons modélisé le coût de migration et listé les compromis.

Si tu envisages aussi une migration vers Hydrogen, réponds d'abord à ces questions : Combien de visiteurs mensuels ? L'équipe maîtrise React ? As-tu besoin d'une UI/UX personnalisée ? Tu as un pipeline CI/CD ? Si tu réponds « oui » à ces questions, construis un modèle numérique — convertis la différence de TTFB en lift de conversion, calcule l'économie de vélocité développeur en heures. Si ces chiffres justifient le coût de migration, avance.

Si tu évalues une migration headless similaire, nous pouvons [structurer une feuille de route Hydrogen](https://www.roibase.com.tr/fr/shopify) dans le cadre des [Services Partenaires Shopify](https://www.roibase.com.tr/fr/shopify) — benchmark, modèle de coûts, plan de déploiement progressif compris.