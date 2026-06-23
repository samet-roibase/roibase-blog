---
title: "MMM + Incrementalité : Le setup d'attribution de 2026"
description: "Robyn, Meta Lift et expériences géographiques — quelle méthode pour quel moment ? Guide technique pour reconstruire l'attribution à l'ère post-cookie."
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: marketing
i18nKey: marketing-004-2026-06
tags: [mmm, incrementalite, attribution, robyn, meta-lift]
readingTime: 9
author: Roibase
---

L'attribution au dernier clic est morte en 2023, l'attribution multi-touch en 2024. En 2026, la mesure marketing s'est scindée en deux pôles : au niveau macro, le Marketing Mix Modeling (MMM), au niveau micro, les tests d'incrementalité. Entre les deux, les API de conversion côté serveur jettent des ponts. Cet article explique quelle méthode fonctionne dans quelles conditions, quel output alimente quelle décision — pas une philosophie abstraite d'attribution, mais une stack concrètement implémentable en production.

## Marketing Mix Modeling tourne désormais chaque semaine

Le MMM signifiait en 2015 « une présentation par an pour le PDG ». En 2026, des outils open source comme Robyn de Meta, associés à des modèles bayésiens, peuvent tourner chaque semaine et mettre à jour la contribution de chaque canal. La structure est la suivante : on modélise les dépenses historiques, les impressions, les conversions et les facteurs externes (saisonnalité, jours fériés, indice concurrentiel) via une régression de série temporelle, et on en extrait le ROAS marginal de chaque canal. Combien de ventes supplémentaires génère un euro ajouté à ce canal — c'est à cette question que MMM répond.

Le setup n'est pas trivial, mais les exigences techniques sont transparentes : minimum 52 semaines de données quotidiennes (idéalement 104 semaines), des lignes de dépenses assignables par canal, un nombre de conversions (mieux encore, un chiffre d'affaires). Robyn fonctionne en Python et R, ingère les données de BigQuery ou Snowflake, calcule la distribution a posteriori via Prophet ou Stan. L'output : graphiques de contribution par canal, courbes de saturation et courbes de réponse — quel canal est limité par le budget, lequel a déjà atteint les rendements décroissants.

La version 2026 de Robyn intègre la granularité au niveau géographique : si vous divisez la France en 7 régions, chacune aura son propre seuil de saturation. Là où Paris est saturé à 35% de part Media Ads, la Provence peut ne l'être qu'à 10% — voir cette différence change la décision d'allocation de budget. Mais attention : MMM ne prouve pas la causalité, il montre la corrélation. Dire « les dépenses Google Ads ont augmenté et les ventes ont augmenté » n'équivaut pas à « Google Ads a causé ces ventes ». C'est l'incrementalité qui comble ce vide.

## Meta Lift a résolu l'incrementalité sur la plateforme

Le test Conversion Lift de Meta est un véritable essai contrôlé randomisé (RCT). On divise l'audience en deux : le groupe test reçoit les annonces, le groupe contrôle ne les reçoit pas. La différence de conversion entre les deux groupes est la contribution **nette** de cette campagne. En 2026, ce système est passé du niveau campagne au niveau créatif — trois vidéos différentes dans une même campagne peuvent être mesurées pour leur incrementalité respectif.

Le setup technique ressemble à ceci : dans Ads Manager, au lieu de « Create A/B Test », vous sélectionnez « Create Lift Test », avec un minimum de 200 000 visites et une durée de 2 semaines (Meta applique cette limite). Le groupe contrôle doit représenter entre 10% et 20% du total — en deçà, la puissance statistique baisse ; au-delà, la perte de revenu devient trop importante. À la fin du test, Meta vous donne : « 1000 conversions dans le groupe test, 700 dans le groupe contrôle → 30% de lift incrementiel, intervalle de confiance 18-42% ».

Ce chiffre s'accroche directement au budget. Si la campagne a dépensé 100 000 € et affiche un lift de 30%, alors 30 000 € ont vraiment généré des ventes supplémentaires — les 70 000 € restants auraient de toute façon généré ces ventes par des canaux organiques ou autres. On calcule alors le coût marginal par conversion incrementielle (mCPIC) : 100 000 / 300 = 333 €. On compare ce chiffre à l'output du MMM : « les 1000 € supplémentaires dépensés sur Meta ont généré 2,8 ventes », avec un écart attendu de 15-20% (différence méthodologique) ; un écart > 50% signale un problème de données.

La limite de Meta Lift : elle ne fonctionne que dans l'écosystème Meta, elle ne mesure pas les effets cross-canal. Google Ads + Meta ensemble génèrent-ils une synergie ? C'est ce que mesure l'expérience géographique.

## Les expériences géographiques testent la synergie cross-canal

Le framework Geo Experiments de Google fonctionne ainsi : vous divisez la France en 10 régions, vous augmentez les dépenses de 20% dans 5 régions (ou vous les supprimez entièrement), vous laissez les 5 autres inchangées. Après 4 semaines, vous comparez les ventes entre les deux groupes — s'il y a une différence statistiquement significative (p<0,05), la modification des dépenses en est la cause. Cette structure diffère du Lift de Meta : elle ne distingue pas les canaux, elle regarde l'effet total au niveau régional.

En pratique : dans Campaign Manager 360 ou Google Ads, vous trouvez l'option « Experiments » > « Geo experiment » (en 2026, GA4 peut aussi la déclencher). Pour définir les régions, on utilise des codes postaux, des départements, ou des zones géographiques (en France, les régions NUTS2). Il faut minimum 6 semaines de données de base, et le test dure au minimum 3 semaines (idéalement 6 — pour amortir le bruit saisonnier). Le moteur d'inférence bayésienne de Google met à jour les estimations chaque jour ; à la fin : « une augmentation de 20% des dépenses a généré une augmentation de 8,5% des ventes (IC : 4,2 - 12,8%) ».

Cette méthode est particulièrement puissante pour tester les stratégies cross-canal. Exemple : « Google + Meta ensemble génèrent 15% plus de ventes qu'à titre individuel ? » Pour répondre, vous mettez les deux canaux à pleine puissance dans le groupe A, vous réduisez Google de 50% dans le groupe B. Si l'écart de ventes est inférieur à 10%, il n'y a pas de synergie — redistribuez le budget. L'inconvénient des géo-expériences : mise en place coûteuse (6 semaines de baseline + 6 semaines de test = 3 mois), les résultats ne sont pertinents que si vous testez des changements assez grands pour émerger du bruit. Essayer de mesurer un ajustement de 5% du budget aura peu de sens.

## Quelle méthode, quand — l'arbre de décision

Vous pouvez affiner votre choix avec 3 questions :

1. **Quel est le périmètre de la décision ?** Répartition du budget annuel → MMM. Comparaison de créatifs au niveau campagne → Meta Lift. Test de synergie cross-canal → Expérience géographique.

2. **Les données de base sont-elles prêtes ?** MMM exige 52+ semaines de dépenses et conversions propres. Lift a besoin de 200K+ impressions et 2 semaines. Géo requiert 6 semaines de baseline + segmentation géographique.

3. **Quelle doit être la vitesse de décision ?** Optimisation hebdomadaire → Meta Lift en continu. Stratégie trimestrielle → MMM rafraîchi mensuellement. Pivot majeur annuel → Expérience géographique.

Voici le tableau récapitulatif :

| Méthode | Output | Durée | Données min. | Cas d'usage idéal |
|---|---|---|---|---|
| MMM (Robyn) | Contribution par canal, courbes de saturation | 52+ sem. | Dépenses + conversions (quotidien) | Stratégie d'allocation budgétaire |
| Meta Lift | Conversions incrementielles par campagne/créatif | 2-4 sem. | 200K impressions | Test créatif, pruning de campagnes |
| Géo Experiment | Synergie cross-canal, lift régional | 6-12 sem. | 6 sem. baseline + données régionales | Test de synergie, expansion régionale |

Ces trois méthodes ne sont pas des alternatives, ce sont des compléments. MMM dit « quel canal vaut combien », Lift dit « cette campagne a-t-elle vraiment créé de la valeur », Géo dit « deux canaux ensemble font-ils mieux ». L'équipe qui les maîtrise construit la [stratégie de marketing digital](https://www.roibase.com.tr/fr/dijitalpazarlama) sur l'expérimentation, non sur l'intuition.

## Construire la stack en production

Pour transformer ce framework théorique en practice, les couches nécessaires sont :

**Collecte de données :** envoyez les signaux de conversion en parallèle via Server-Side GTM vers Google Ads, Meta CAPI et BigQuery. Si vous ne comptiez que sur les cookies côté client, vous perdez 30-40% des signaux (iOS 17, Firefox, Brave). L'infrastructure [Dijital Pazarlama](https://www.roibase.com.tr/fr/dijitalpazarlama) de Roibase conjugue sGTM + couche de données first-party — c'est de là que vient la granularité de dépenses qu'exige MMM.

**Pipeline de modèles :** alimentez Robyn depuis BigQuery. Modélisez les dépenses + conversions en grain quotidien avec dbt. Lancez un script Python chaque semaine (Cloud Function ou Airflow), versez l'output dans Looker Studio. Déclenchez manuellement les tests Lift dans Ads Manager, mais récupérez-les via l'API (endpoint `insights` de Marketing API remonte les métriques de lift), écrivez-les dans BigQuery et joignez-les aux outputs de Robyn.

**Expériences géographiques :** l'API Google Ads permet une setup programmatique via la ressource `experiments`. À la fin du test, récupérez les résultats avec `experiment_id`, écrivez dans BigQuery et comparez aux conclusions du MMM. Visualiser les trois ensemble (« MMM dit Meta = 22%, Lift teste 28%, Géo affiche variance régionale 12-34% ») affine considérablement les décisions.

**Boucle de décision :** refresher MMM chaque trimestre, faire 1-2 tests Lift mensuels, lancer une géo-expérience tout les 6 mois avant une grande mutation. Pour les petites équipes, commencez par MMM (2 semaines si les données existent), rendez Meta Lift routine (par défaut sur chaque campagne), réservez Géo aux pivots majeurs.

En 2026, l'attribution n'est pas un outil unique, c'est l'orchestration de trois outils. Chacun répond à une question différente ; ensemble, ils rendent la décision possible dans un monde post-cookie. Test plutôt que prévision, causalité plutôt que corrélation, résultats d'expériences plutôt que dashboard — la croissance repose sur ce socle.