---
title: "MMM + Incrementality: Configuration d'Attribution 2026"
description: "Robyn, Meta Lift, expériences géographiques — quand utiliser quoi? Les nouvelles couches de mesure d'impact marketing à l'ère post-cookie."
publishedAt: 2026-07-30
modifiedAt: 2026-07-30
category: marketing
i18nKey: marketing-004-2026-07
tags: [mmm, incrementality, attribution, robyn, meta-lift]
readingTime: 8
author: Roibase
---

À l'ère post-cookie, l'attribution last-click s'est évaporée comme un fantôme. En 2026, les équipes marketing ne se posent plus la question « quel canal a généré cette conversion » mais plutôt « sans quel canal cette conversion ne serait pas arrivée ». Ce changement de paradigme s'appelle : l'incrémentalité. Mais mesurer l'incrémentalité seule n'est pas suffisant — vous ne voyez pas l'impact de marque à long terme. C'est là que le *Marketing Mix Modeling* (MMM) entre en jeu. La stack d'attribution saine de 2026 repose sur deux couches : MMM et tests d'incrémentalité. Robyn de Meta, Meta Lift, l'infrastructure d'expériences géographiques de Google — les trois répondent à des questions différentes. Dans cet article, vous découvrirez quand utiliser quel outil, comment ils fonctionnent ensemble et les pièges à éviter lors de la configuration.

## MMM : Cartographie d'Impact Long Terme

Le *Marketing Mix Modeling* est une méthode basée sur la régression qui combine données historiques de dépenses, exposition médias et ventes pour calculer la contribution de chaque canal aux ventes. Le framework open-source Robyn de Meta est sorti en 2022 mais a atteint la maturité production en 2025-2026. Robyn modélise l'adstock (décroissance de l'effet publicitaire dans le temps) et les courbes de saturation (rendement décroissant des dépenses croissantes) pour optimiser l'allocation de budget entre canaux.

La force du MMM : il capture l'impact de marque. Un sponsoring podcast peut ne pas générer de conversion cette semaine mais augmenter les recherches organiques pendant 6 semaines. L'attribution last-click ne le voit pas, MMM si. Son faiblesse : manque de granularité. MMM vous dit « augmentez les dépenses Meta de 50 000 TL par mois » mais ne dit pas « quelle campagne, quel créatif ». De plus, MMM regarde le passé — il n'optimise pas en temps réel.

Pour configurer Robyn correctement, vous avez besoin d'un minimum de 2 ans de données hebdomadaires (104 points). Votre dataset doit inclure : dépenses par canal (Google Ads, Meta, TikTok, podcast, TV séparément), ventes totales (revenu ou unités), variations de prix, effets saisonniers. Robyn utilise Nevergrad pour le tuning hyperparamètres — il exécute 100 000+ modèles et trouve le meilleur fit. Le résultat : mROAS (ROAS marginal) et point de saturation pour chaque canal. Exemple : Meta a un mROAS de 3.2 mais si les dépenses dépassent 100 000 TL, il chute à 1.8. Ce tradeoff guide l'allocation de budget [marketing de performance](https://www.roibase.com.tr/fr/ppc) en production.

## Tests d'Incrémentalité : Causalité Court Terme

MMM montre la corrélation, l'incrémentalité prouve la causalité. Un test d'incrémentalité pose une question simple : que perdrais-je si j'arrêtais cette campagne ? La méthode la plus courante : holdout géographique. Vous divisez 50 États aux USA en 25 treatment (campagne active) et 25 control (campagne fermée) et mesurez la différence de ventes. L'infrastructure GeoX de Google Ads automatise cela — vous sélectionnez une campagne, faites un split géographique, et après 2-4 semaines, vous obtenez un rapport de lift.

Le test Conversion Lift de Meta fait un holdout au niveau utilisateur. Vous ouvrez une étude de lift depuis Meta Ads Manager sur une campagne, Meta isole 10% du trafic au groupe control (pas d'annonce) et 90% au groupe treatment. À la fin, Meta vous dit : taux de conversion group treatment 2.3%, control 1.9% — lift 21%. Cela signifie que la contribution incrémentale réelle de la campagne est 21%, les 79% restants sont des conversions qui auraient eu lieu de toute façon (organique, retargeting, search).

La faiblesse du test d'incrémentalité : c'est coûteux et lent. Un test géo demande minimum 2 semaines, un test au niveau utilisateur 4-6 semaines. Pendant le test, vous ne dépensez rien pour le groupe control — perte de revenu potentielle. De plus, vous ne pouvez pas tester chaque campagne, seulement les canaux stratégiques (nouveau format créatif, nouvelle plateforme, campagne upper-funnel). Mais sans incrémentalité, vous ne pouvez pas valider les résultats MMM — MMM peut dire « ROAS Meta est 4.2 » mais un test de lift peut dire « non, le lift réel est 18%, ROAS est 1.6 ». Les deux ensemble donnent la vérité.

### Stratégie Holdout et Taille d'Échantillon

Le succès d'un test géo commence par le calcul de sample size. Google GeoX recommande minimum 40 geos (villes/États) — 20 treatment, 20 control. Avec moins de geos (par exemple seulement Istanbul, Ankara, Izmir), la puissance statistique est insuffisante, aucune significativité. Pour Meta Lift : minimum 50+ conversions par jour. Avec moins, l'intervalle de confiance est trop large — le lift pourrait être entre 10% et 40%, impossible de décider.

Quand vous fixez la durée du test, tenez compte de la saisonnalité. Si le trafic vendredi-dimanche est 30% supérieur à lundi-jeudi, ajustez le test en semaines complètes (2 semaines ou 4 semaines). Il y a aussi l'effet *spillover* : un utilisateur dans la géo treatment peut voyager et convertir ailleurs. Cela crée du bruit dans le groupe control, le lift sort plus bas que réel. Pour compenser, définissez des frontières géographiques strictes (zone métro plutôt qu'État) ou testez dans des catégories où la mobilité cross-géo est basse (services locaux, QSR).

## Comment MMM + Incrémentalité Fonctionnent Ensemble

Pensez-les comme des couches qui se valident mutuellement. MMM donne l'allocation de budget long terme, les tests d'incrémentalité la valident. Le flux :

1. **Exécuter MMM** — construire le modèle Robyn avec 2 ans de données, calculer mROAS par canal.
2. **Ajuster le budget selon MMM** — si MMM dit « doubler le spend podcast », augmentez le budget podcast.
3. **Ouvrir un test d'incrémentalité sur le canal critique** — tester podcast pendant 4 semaines avec split géo.
4. **Comparer le lift aux résultats MMM** — MMM disait « ROAS podcast 5.2 », le test de lift dit « lift réel 25%, ROAS 3.1 » → recalibrez MMM.
5. **Fermer la boucle** — donner la donnée de lift comme prior à Robyn, affiner le modèle.

Cette boucle se répète tous les 3 mois. MMM redéfinit chaque trimestre (ajouter 13 semaines de nouvelles données), les tests d'incrémentalité tournent par rotation 1-2 canaux par mois. Résultat : mix de budget macroscopiquement correct et preuve causale microscopique.

Un exemple : une marque e-commerce, MMM donne ROAS Google Search 8.2 — canal le plus rentable. Mais quand ils lancent Meta Lift, ils découvrent que 60% du trafic Search cherche déjà la marque par terme, ces utilisateurs viendraient au site même sans pub. Le vrai lift incrémental : 15%, ROAS 2.4. Armés de cette info, ils réduisent Search et réallouent à upper-funnel (YouTube, podcast). Deux trimestres après, quand MMM redéfinit, le trafic organique search de marque a augmenté de 18% — l'effet delayed du podcast est visible dans le modèle.

## Quel Outil Utiliser Quand

**Utilisez Robyn (MMM) :**
- Vous entrez sur un nouveau marché et ne savez pas sur quels canaux investir.
- Vous avez des dépenses sur plusieurs canaux (5+) et voulez réallouer le budget.
- Vous voulez mesurer l'impact long terme des campagnes de marque (TV, podcast, influenceurs).
- Vous avez au minimum 2 ans de données hebdomadaires de ventes + dépenses.

**Utilisez Meta Lift :**
- Vous testez un nouveau format créatif sur Meta (Reels, Advantage+ catalog).
- Vous avez lancé une campagne upper-funnel et voulez prouver sa contribution.
- Vous avez 50+ conversions/jour et pouvez accepter 4-6 semaines de test.
- Vous pouvez vous permettre de ne pas dépenser sur le groupe control.

**Utilisez Google GeoX :**
- Vous testez un split marque vs. non-marque dans Google Ads.
- Vous dépensez sur plusieurs plateformes (Google + Meta + TikTok) et voulez voir l'incrémentalité cross-channel.
- Vous avez assez de trafic en Turquie pour des tests par ville (Istanbul, Ankara, Izmir, Bursa, Antalya séparément).

Si votre budget est serré et vous ne pouvez choisir qu'un outil : **commencez par un test d'incrémentalité** (Meta Lift ou GeoX). Car l'incrémentalité donne des insights immédiatement actionnables — « ferme cette campagne, économise 30% ». MMM est plus stratégique mais demande plus d'interprétation pour agir. Idéalement : lancez les deux et laissez-les s'alimenter.

## Pièges Setup et Calibration

**Pièges MMM :**
- **Données insuffisantes :** Ne lancez pas Robyn avec moins de 52 semaines — le modèle overfitte.
- **Variables manquantes :** Si vous n'ajoutez pas les promotions de prix, les dépenses concurrentes au modèle, l'effet canal s'amplifie.
- **Adstock mal configuré :** N'utilisez pas le même decay adstock pour tous les canaux. TV montre 8 semaines de decay, Meta 2 semaines — donnez des priors à Robyn.
- **Saturation ignorée :** Robyn utilise default une courbe de saturation logarithmique mais certains canaux (brand search) sont linéaires. Vérifiez le fit du modèle et ajustez le type de courbe.

**Pièges incrémentalité :**
- **Test trop court :** Un test de lift d'1 semaine manque de puissance statistique. Minimum 2 semaines (géo), 4 semaines (au niveau utilisateur).
- **Contamination :** Si treatment et control sont à la même localité (deux arrondissements d'Istanbul), il y a spillover. Les frontières géographiques doivent être nettes.
- **Bruit saisonnalité :** Lancer un test pendant Black Friday fait monter le lift 2x par rapport à normal. Choisissez des semaines ordinaires.
- **Attribution window fausse :** Meta Lift utilise default 7-day click, 1-day view. Si votre cycle de vente est long (B2B, prix élevé), ouvrez une fenêtre 28-day.

Pour la calibration : comparez le ROAS de canal que MMM prédit avec le ROAS réel du test de lift. Si l'écart > 20%, révisez les priors MMM (adstock, saturation). Dans Robyn, vous pouvez resserrer l'espace de recherche via `hyperparameter_bounds` — au lieu de [0.3, 0.8] pour adstock decay, donnez [0.4, 0.6]. Cette itération prend 2-3 trimestres mais à la fin MMM et incrémentalité deviennent cohérents.

## Où Va 2026 Finissant ?

Fin 2026, 40% des tests d'incrémentalité basculent aux méthodes Bayésiennes. Un test fréquentiste classique attend « p < 0.05 », un test Bayésien permet l'arrêt précoce — si après 10 jours la probabilité posterior dépasse 95%, vous pouvez arrêter. Meta a déjà lancé Conversion Lift Bayésien en bêta. Google GeoX ne l'a pas encore mais attendez 2027.

Côté MMM, l'intégration de *causal inference* (notation Pearl, DAG) arrive dans Robyn. Actuellement Robyn est basé sur corrélation — si deux canaux montent la même semaine (parce que tous deux se préparent pour Black Friday) il a du mal à séparer leurs effets. MMM causale (hybrid Econometric + Causal Impact) résout ce problème. Attendez production-ready en 2027.

Un dernier point : la stack incrémentalité + MMM ne sert plus seulement le paid media, mais aussi la retention et le lifecycle marketing. On teste maintenant l'effet incrémental des campagnes email (Braze + GeoX). On mesure le lift des push notifications via holdout au niveau utilisateur. L'attribution n'est plus juste acquisition, c'est le full customer journey. En 2026, les équipes sans cette stack dépensent à l'aveugle — celles qui l'ont optimisent chaque euro avec discipline d'ingénierie.