---
title: "MMM + Incrementalité : Le Setup d'Attribution de 2026"
description: "Robyn, Meta Lift, expériences géo — lequel utiliser et quand ? Un arbre de décision pratique pour l'attribution post-cookie."
publishedAt: 2026-06-04
modifiedAt: 2026-06-04
category: marketing
i18nKey: marketing-004-2026-06
tags: [mmm, incrementalite, attribution, robyn, test-geo]
readingTime: 9
author: Roibase
---

Le suivi par cookies a disparu à 80 %, l'attribution multi-touch (MTA) n'est plus fiable, et les tableaux de bord des plateformes ne correspondent plus les uns aux autres. En 2026, les marketeurs mesurent la « contribution » en combinant deux méthodes : le Marketing Mix Modeling (MMM) et les tests d'incrémentalité. Le problème : peu savent quand utiliser l'une ou l'autre. Cet article montre où placer Robyn (la librairie MMM open-source de Meta), l'API Meta Lift et les tests de rétention géographique dans le même setup.

## L'attribution last-touch est morte — mais par quoi la remplacer ?

Google Analytics 4 parle « d'attribution basée sur les données », Meta dit « conversions modélisées », TikTok fournit ses propres chiffres. Les trois donnent des résultats différents. En 2025, un e-commerçant qui dépense 100 euros peut voir 8 conversions dans GA4, 12 chez Meta et 6 sur TikTok. Quel canal fonctionne vraiment ? Le modèle last-touch ne peut pas répondre, car l'utilisateur passe par plusieurs points de contact et chaque plateforme s'attribue le crédit de son côté.

Le Marketing Mix Modeling résout ce problème différemment : il traite les canaux comme variables indépendantes, les ventes ou revenus comme variable dépendante, et utilise la régression pour calculer la contribution marginale de chaque canal. Les tests d'incrémentalité sont plus directs : tu exposes un groupe à un canal et tu gardes un groupe de contrôle, puis tu mesures la différence. Les deux cassent l'illusion du dernier contact, mais leurs scénarios d'utilisation ne se chevauchent pas.

La différence réside ici : le MMM est macro (long terme, tous les canaux), l'incrémentalité est micro (court terme, canal ou campagne spécifique). Un setup qui combine les deux est devenu standard en 2026.

## MMM : régression hebdomadaire avec Robyn

La librairie Robyn de Meta est le framework MMM open-source de l'équipe Facebook Marketing Science. Elle fonctionne avec R, utilise la régression Bayésienne, et ajuste automatiquement les courbes d'adstock (effet décalé) et de saturation (rendements décroissants). À granularité hebdomadaire, elle fournit la contribution de chaque canal — TV, display, social payant, SEO, email — au chiffre d'affaires, en pourcentage.

**Les 4 composants du setup Robyn :**

1. **Collecte de données :** Au minimum 1,5 an de données hebdomadaires. Chaque ligne = 1 semaine. Colonnes : dépenses par canal, impressions ou clics ; variables indépendantes (prix, stock, saisonnalité) ; variable dépendante (chiffre d'affaires, commandes, conversions). Pas de trous, sinon le modèle échoue.
2. **Tuning des hyperparamètres :** Robyn cherche les paramètres d'adstock decay (α) et la forme de saturation (γ) pour chaque canal. Il exécute 2000+ combinaisons de modèles et propose les 5-10 meilleurs de la frontière de Pareto. Cette étape prend 10-30 minutes (sur 64 cœurs).
3. **Sélection du modèle :** Tu sélectionnes le modèle avec le plus bas NRMSE (Normalized Root Mean Squared Error) + le plus haut decomp.rssd (stabilité de la décomposition). Le résultat : contribution de chaque canal au chiffre d'affaires total en %, estimation du ROI, allocation de budget optimale.
4. **Allocation de budget :** La fonction « budget allocator » de Robyn redistribue le budget total en égalisant le ROI marginal de chaque canal. Tu utilises ce résultat pour planifier le trimestre suivant.

**Quand utiliser Robyn :**
- Décisions d'allocation de budget intercanaux (par exemple, plan Q3)
- Simulations d'ajout/suppression de canal
- Analyses de tendances long terme (6 mois+)

**Quand NE PAS utiliser Robyn :**
- Optimisation au sein d'une campagne (périodes < 2 semaines)
- Décisions de test créatif spécifiques à la plateforme (le MMM ne voit pas les différences créatives)
- Feedback en temps réel pour l'enchère (il y a un délai hebdomadaire)

Dans le service [Dijital Pazarlama](https://www.roibase.com.tr/fr/dijitalpazarlama) de Roibase, nous mettons en place le modèle Robyn : nous connectons GA4, GTM côté serveur, Meta CAPI et BigQuery, créons un pipeline ETL hebdomadaire et visualisons les résultats du modèle dans Data Studio.

## Tests d'incrémentalité : Meta Lift et rétention géographique

Le MMM répond à la question « combien », l'incrémentalité répond à « est-ce que ça marche vraiment ». Deux questions différentes. Si tu dépenses 100 mille euros sur Meta et obtiens 120 conversions, c'est « bon » ? Le MMM te dit « Meta reçoit 15 % de ton budget et génère 12 % de tes ventes ». Mais combien de ces conversions se seraient produites de toute façon (organic) ? C'est là qu'intervient un test d'incrémentalité.

### Meta Conversion Lift

Meta Lift API mesure l'**impact réel** des publicités Facebook et Instagram. Comment ? Au lieu de montrer la campagne à un petit groupe de rétention et pas aux autres, la plateforme mesure la différence 7-14 jours plus tard. La différence = conversions supplémentaires.

**Setup :**
- Ouvrir l'étude Lift avant le lancement de la campagne (Ads Manager > Measure & Report > Conversion Lift)
- Ratio de rétention : 5-10 % (trop petit = bruit, trop grand = perte d'impressions)
- Durée du test : au minimum 7 jours (moins = puissance statistique faible)
- Résultat : conversions supplémentaires, CPA supplémentaire, intervalle de confiance

**Exemple d'interprétation :**
Groupe témoin : 1 000 personnes, 40 conversions
Groupe test : 9 000 personnes, 450 conversions
Conversion supplémentaire = (450/9000 - 40/1000) × 9000 = 90 conversions
Lift = 90 / (450 - 90) = 25 %

En d'autres termes, sur les 450 conversions observées dans la campagne, seules 90 proviennent réellement de l'annonce. Les autres se seraient produites de toute façon. Le CPA supplémentaire = (dépense) / 90. Ce chiffre est 30-60 % plus élevé que celui du MTA — parce qu'il est réel.

**Quand utiliser Meta Lift :**
- Test de nouvelle campagne ou créatif (A/B)
- Décisions de plateforme (Meta vs. Google vs. TikTok : laquelle est plus supplémentaire ?)
- Mesurer la contribution réelle du remarketing (problème courant : le remarketing a toujours un CPA faible, mais 80 % se serait produit de toute façon)

**Inconvénient :**
- Fonctionne uniquement sur Meta (Google a un équivalent limité dans Display & Video 360)
- Créer un groupe de rétention signifie perdre des impressions (court terme, le revenu baisse)
- Test au minimum 1 semaine — inadapté aux décisions quotidiennes

### Expériences géographiques (rétention géographique)

Pour les canaux en dehors de Meta — Google, TikTok, TV — tu fais un test géographique : tu lances la campagne dans certaines villes et l'arrêtes dans d'autres, puis tu mesures la différence de ventes. Cette méthode est le plus pur moyen de mesurer l'incrémentalité au niveau académique, car il n'y a pas de manipulation au niveau de l'utilisateur.

**Exemple de setup :**
- Choisir 30 villes (population, niveau économique similaires)
- Lancer la campagne Google Ads dans 15 d'entre elles, la laisser fermée dans 15 autres (aléatoire)
- Attendre 4 semaines
- Comparer les conversions par ville dans Google Analytics 4

**Analyse :**
- Villes traitées : moyenne 120 conversions/ville
- Villes témoin : moyenne 95 conversions/ville
- Lift supplémentaire : (120 - 95) / 95 = 26,3 %

Tu généralises ce lift de 26,3 % à tout le pays. Si ta dépense Google Ads est de 200 mille euros, tu calcules le revenu supplémentaire et trouves le ROAS supplémentaire.

**Quand utiliser le test géographique :**
- Mesurer la contribution nette de chaque canal dans un setup multi-canal
- Voir l'impact des canaux non-digitaux — TV, affichage, podcast
- Quand tu n'as pas confiance dans les tableaux de bord des plateformes

**Inconvénient :**
- Peu de villes signifie faible puissance statistique (minimum 20 villes)
- Si l'hétérogénéité géographique est forte, le résultat peut être trompeur (par exemple, Paris vs. Marseille n'entrent pas dans le même panier)
- Ça prend du temps (4-8 semaines)

## Arbre de décision : quelle méthode utiliser et quand ?

Nous organisons les trois méthodes dans le même setup comme suit :

| Scénario | Méthode | Fréquence | Résultat |
|----------|---------|-----------|---------|
| Allocation de budget trimestriel | Robyn MMM | 1 × par trimestre | ROI par canal, dépense optimale |
| Test de nouvelle campagne (Meta/Instagram) | Meta Lift | À chaque grande campagne | CPA supplémentaire |
| Incrémentalité multi-canal | Test géographique | 2 × par an | Lift réel par canal |
| Décision d'actualisation créative | Meta Lift + analyse CRO | 1 × par mois | Quel créatif est supplémentaire |
| Enchère en temps réel | API de plateforme (feedback ROAS) | Quotidien | Optimisation au niveau tactique |

**Flux pratique :**
1. **Hebdomadaire :** Surveille les tableaux de bord des plateformes (similaire au MTA, mais ne lui fais pas confiance)
2. **Mensuel :** Teste les grandes campagnes avec Meta Lift
3. **Trimestriel :** Modélise la contribution à long terme de tous les canaux avec Robyn et réalloue le budget
4. **2 × par an :** Valide le lift réel de chaque canal avec un test géographique

Grâce à ce setup en 3 couches, tu prends des décisions tactiques (quel créatif fonctionne) et stratégiques (combien de budget par canal) basées sur des données.

## Erreurs courantes et arbitrages

**Erreur 1 :** « Si je fais du MMM, je ne dois pas tester l'incrémentalité »
Faux. Le MMM montre la corrélation et suppose la causalité. Le test d'incrémentalité mesure la causalité. Ils se complètent. Exemple : le MMM dit « Instagram contribue 15 % », mais le test de lift montre que 40 % de cela serait organique. La vraie contribution est donc 9 %.

**Erreur 2 :** « On fait un test d'incrémentalité sur chaque campagne »
Faux. Créer un groupe de rétention signifie perdre des impressions. Tu ouvres un test d'incrémentalité seulement pour les grandes décisions (nouveau canal, nouvelle direction créative, stratégie de remarketing). Les petites optimisations suffisent avec un A/B test.

**Erreur 3 :** « Robyn est configuré une fois, puis tourne tout seul »
Faux. Le modèle est réentraîné chaque trimestre. Si tu ajoutes un nouveau canal, si le prix change, si la saisonnalité change, le modèle doit être mis à jour. Un setup Robyn nécessite une maintenance continue.

**Arbitrage 1 : Vitesse vs. précision**
Le MMM demande 1,5 an de données et le résultat est décalé d'1 semaine. Un test géographique dure 4-8 semaines. Si tu veux décider vite, tu dois faire confiance au tableau de bord de la plateforme, mais tu acceptes une marge d'erreur de 30-50 %.

**Arbitrage 2 : Granularité vs. taille d'échantillon**
Un test géographique par ville réduit la taille d'échantillon et élargit l'intervalle de confiance. Par arrondissement, l'hétérogénéité augmente. Un MMM hebdomadaire ne peut pas répondre aux décisions quotidiennes. Chaque méthode a une limite de résolution.

## Comment construire une stack d'attribution en 2026 ?

Le setup technique se compose des éléments suivants :

1. **GTM côté serveur + first-party cookie :** Envoie des signaux propres à GA4 et Meta CAPI (pas de contournement de l'ATT iOS, mais enrichissement de données basé sur le consentement)
2. **Data warehouse BigQuery :** Centralise toutes les données des plateformes (GA4, Meta Ads API, Google Ads API, TikTok Ads API, CRM)
3. **Transformation dbt :** Crée des tables d'agrégation hebdomadaires (chaque ligne = 1 semaine, chaque colonne = dépense du canal 1 + outcome 1)
4. **Pipeline Robyn :** Exécute le script R une fois par semaine sur Cloud Run, écrit les résultats du modèle dans BigQuery
5. **Tableau de bord Looker Studio :** Affiche côte à côte les résultats du MMM + les chiffres du MTA des plateformes + les résultats des tests d'incrémentalité
6. **Alerte Slack :** Si la NRMSE du modèle dépasse 10 %, alerte sur une anomalie dans les données

La mise en place de cette stack prend 4-6 semaines. La maintenance hebdomadaire ensuite : 2-3 heures. ROI : l'allocation de budget devient 15-25 % plus efficace (Robyn rapporte 18 % d'amélioration sur son propre benchmark).

## Qu'est