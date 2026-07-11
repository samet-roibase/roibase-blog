---
title: "MMM + Incrementalité : Configuration d'attribution 2026"
description: "Robyn, Meta Lift et expériences géographiques : quand utiliser quoi en mesure post-cookie, configurations de test et arbre décisionnel."
publishedAt: 2026-07-11
modifiedAt: 2026-07-11
category: marketing
i18nKey: marketing-004-2026-07
tags: [mmm, incrementalite, attribution, robyn, meta-lift]
readingTime: 8
author: Roibase
---

La mesure marketing post-cookie a redéfini le sens du mot « attribution ». En 2026, au lieu de tracer quel utilisateur a vu quelle annonce, vous devez isoler quel canal déclenche réellement une augmentation des ventes. Marketing Mix Modeling (MMM) et les tests d'incrémentalité sont les outils fondamentaux de ce nouveau jeu — mais tous deux répondent à la même question sur des horizons temporels différents et avec des niveaux de confiance distincts. Le Robyn de Meta, les tests Conversion Lift et les expériences géographiques requièrent des choix basés sur le timing de vos campagnes, votre flexibilité budgétaire et votre maturité data.

## MMM : Lire le Passé pour Prédire l'Avenir

Le Marketing Mix Modeling est une famille de régressions. On agrège les dépenses, impressions, facteurs macroéconomiques et données de ventes des 2-3 dernières années pour isoler la contribution de chaque canal aux ventes totales. Des frameworks open source comme Robyn appliquent l'optimisation bayésienne pour calibrer automatiquement les hyperparamètres du modèle (adstock, courbes de saturation).

La sortie de Robyn est une série de « courbes de réponse » : pour chaque canal, le ROAS marginal de chaque franc supplémentaire dépensé. Par exemple, ajouter 100 000 francs à Meta devrait générer un ROAS de 3,2, mais 4,1 sur Google Search — ce type de décision requiert les données consolidées du MMM. En 2026, Robyn v4.1 décompose automatiquement la saisonnalité basée sur Prophet et parse les effets de jours fériés ; les dummy variables de calendrier manuel sont désormais obsolètes.

La faiblesse du MMM est la latence : la configuration prend 4-6 semaines car elle nécessite au minimum 100-120 semaines de données (2+ ans). Si vous venez de lancer un nouveau canal (TikTok, par exemple), les 12 premières semaines de données sont extrêmement bruitées ; le MMM ne leur assigne pas de coefficient fiable. C'est là qu'intervient le test d'incrémentalité court terme.

## Meta Conversion Lift : Rapide, Étroit, Coûteux

Meta Conversion Lift (anciennement Lift Studies) fonctionne selon un protocole essai contrôlé randomisé : on segmente les utilisateurs en groupes test (voyant des annonces) et contrôle (voyant des PSA), puis on calcule la différence de conversion. Vous obtenez des résultats en 2-4 semaines — contrairement au MMM, cela convient aux décisions en temps réel.

La condition pour un test Lift est d'avoir au minimum 200 000 utilisateurs atteints et d'« accepter » de dépenser 5-10 % du budget normal de la campagne sur le groupe contrôle. En pratique, cela signifie un gaspillage d'impression de 50 000-100 000 francs, car vous montrez des PSA au groupe contrôle mais n'enregistrez pas leurs conversions dans l'événement de conversion. Meta ne rembourse pas cet argent — c'est un coût d'expérience à accepter.

En 2026, Meta a intégré Conversion Lift avec les événements côté serveur : les événements `Purchase` envoyés via CAPI sont directement utilisés dans le calcul du lift. Même pour les utilisateurs iOS 17+, vous obtenez des résultats fiables car l'assignation test/contrôle s'appuie sur les identifiants côté serveur. Mais une seule limite : le Lift ne mesure que la plateforme Meta — vous manquez les effets de halo cross-canal. Si votre campagne Instagram augmente le trafic organique Google Search, le Lift ne le verra pas.

## Expériences Géographiques : Capturer le Halo Cross-Canal

Les tests d'incrémentalité géographiques comparent le traitement vs contrôle par ville ou région. Par exemple, vous augmentez vos dépenses Meta de 30 % à Istanbul et Ankara, mais les gardez stables à Izmir et Bursa. Après 4-6 semaines, vous examinez le delta dans les ventes totales — cette approche capture aussi le spillover entre canaux.

L'outil GeoX de Google automatise cela : il utilise la méthode du contrôle synthétique pour construire une courbe de ventes « contrefactuelle » pour chaque géographie test. En pratique, il prédit les ventes d'Istanbul en utilisant une moyenne pondérée de 5-6 autres villes ayant des caractéristiques démographiques et de saisonnalité similaires. La différence entre les ventes réelles post-traitement et cette prédiction est l'incrémentalité.

L'avantage du test géographique : il couvre tous les canaux online et offline. L'inconvénient : risque de spillover géographique (une annonce à Istanbul affecte aussi Kocaeli) et hétérogénéité dans les tailles de marché. Cela fonctionne bien pour les marques avec 10-12 clusters géographiques ; les plus petites opérations manquent de puissance statistique.

En 2026, GeoX s'intègre nativement à Google Cloud BigQuery — vous pouvez extraire votre GA4 + données produit directement dans le pipeline de test. Configuration : 2 semaines, durée du test : 4-6 semaines, cycle total : 6-8 semaines.

## Quand Utiliser Quoi

Appliquez cet arbre décisionnel :

| Situation | Outil | Pourquoi |
|---|---|---|
| 2+ ans de données, allocation budgétaire stratégique | Robyn (MMM) | Courbes de réponse long terme + détection de saturation |
| Test d'un nouveau format créatif (ex. Reels vs Feed) | Meta Conversion Lift | Rapide, format-spécifique, 2-4 semaines |
| Suspicion d'effet de halo cross-canal (ex. YouTube + Search) | Expérience géographique | Capture le spillover entre canaux |
| Zéro données, démarrage from scratch | Lift en premier, puis MMM | Optimisez tactiquement par Lift pendant 6 mois, puis stratégiquement par MMM |

Pour Robyn : configuration minimale requise : environnement Python/R, 120+ semaines de données dépenses + ventes, nœud avec Prophet (2-4 cores suffisent). La sortie peut être rafraîchie hebdomadairement, mais la reconstruction du modèle devrait se faire 1 fois par mois.

Pour Meta Lift : configuration minimale : campagne active dans Business Manager, 200k+ impressions hebdomadaires, événement de conversion envoyé via CAPI. L'approbation du Lift prend 3-5 jours ouvrables, avec révision interne par Meta.

Pour GeoX : configuration minimale : 10+ clusters géographiques, intégration BigQuery, GA4 + données de transactions. Google a ouvert cet outil en bêta publique fin 2025 ; il est en production complète en 2026.

## Pièges Pratiques de Robyn

Quand vous configurez Robyn, le premier problème rencontré est le réglage fin des hyperparamètres. Le framework teste par défaut 100 000 combinaisons de modèles — cela prend 6-8 heures sur une machine 8-core. En production, si vous le lancez 1 fois par semaine, le coût de calcul est tolérable ; mais si vous voulez un rafraîchissement quotidien, vous avez besoin d'un cluster Spark distribué.

Le deuxième piège : la fenêtre d'effet d'adstock. Robyn utilise par défaut une fenêtre d'adstock de 13 semaines — la dépense d'une semaine continue d'affecter les ventes pendant 13 semaines avec décroissance. Mais pour une marque de fast fashion avec un cycle de produit de 4-6 semaines, 13 semaines est absurde. Vous devez personnaliser ce paramètre selon votre catégorie ; sinon, le modèle surestime les canaux à longue traîne comme la TV.

Le troisième piège : la saisonnalité. Prophet automatise la décomposition de Fourier, mais en France, il y a Pâques, Noël et le Black Friday qui ne sont pas fixes. Vous devez les ajouter manuellement au dataframe `holidays`. En 2026, Robyn v4.1 supporte l'import de holiday au format iCal — vous pouvez extraire directement depuis Google Calendar.

## Quel Niveau de Confiance pour Quelle Décision

La sortie du MMM est probabiliste — chaque canal a un coefficient moyen et un intervalle de confiance à 95 %. Par exemple, si le ROAS de Meta est 3,2 ± 0,7, la vraie valeur se situe probablement entre 2,5 et 3,9. Si l'intervalle est large (ex. ±1,2), le coefficient de ce canal est instable ; vous devez collecter plus de données.

La confiance du test Lift est fixe : Meta utilise un seuil de confiance de 90 %. Si le résultat est « statistiquement non significatif », soit la taille de l'échantillon est petite, soit il n'y a vraiment pas de lift. En pratique, avec 200k impressions, vous détectez un lift de 10 %, mais détecter moins de 5 % requiert 500k+ impressions.

La confiance de l'expérience géographique dépend de la qualité du fit du contrôle synthétique : si l'erreur MAPE (mean absolute percentage error) entre les ventes réelles et le contrôle synthétique est < 5 % avant le traitement, c'est fiable ; au-delà de 10 %, revisitez vos clusters géographiques.

## Remarque Finale : Intégrer l'Arbre Décisionnel dans Votre Workflow

En 2026, les équipes de [marketing de performance](https://www.roibase.com.tr/fr/ppc) prospères utilisent MMM + incrémentalité dans le même pipeline : Robyn s'exécute la première semaine de chaque mois et met à jour l'allocation budgétaire trimestrielle. Les tests Lift s'exécutent lors de lancements de nouveau créatif/format, avec une décision pivot en 2-4 semaines. Les expériences géographiques s'exécutent 2-3 fois par an, notamment avant les changements majeurs d'allocation par canal (ex. avant d'augmenter le budget TikTok de 50 %).

Pour mettre en place ce système, votre pipeline de données doit exécuter trois flux en parallèle : (1) données de transaction + dépenses quotidiennes s'écoulent dans BigQuery, (2) Robyn consomme ces données pour un rafraîchissement hebdomadaire, (3) les résultats de Lift et GeoX sont importés manuellement dans votre tableau de bord BI. Tout converge dans un tableau de bord Looker unique présenté au CMO — « le ROAS de Meta le mois dernier était 3,4 (MMM), le nouveau format Reels a généré un lift de 12 % (Lift), le test géographique TikTok a échoué (GeoX) ».