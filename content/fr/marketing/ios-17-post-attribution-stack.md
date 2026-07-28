---
title: "La Stack d'Attribution Post-iOS 17"
description: "ATT, SKAdNetwork 4 et conversions modélisées redéfinissent l'architecture de mesure mobile. Comment configurer la mesure dans la période post-lookback ?"
publishedAt: 2026-07-28
modifiedAt: 2026-07-28
category: marketing
i18nKey: marketing-003-2026-07
tags: [ios-attribution, skadnetwork, att, mobile-performance, modeled-conversions]
readingTime: 8
author: Roibase
---

Trois ans ont passé depuis iOS 14.5. ATT (App Tracking Transparency) n'est plus une « nouveauté » — c'est une réalité mûre. Mi-2026, la plupart des équipes performance regrettent toujours l'ancienne stack d'attribution, mais il n'y a pas de retour possible. Avec iOS 17, SKAdNetwork 4.0 est fully adopted, Meta et Google ont porté les conversions modélisées à une stabilité production-grade, et TikTok a ouvert son propre pipeline probabiliste. Le problème n'est plus « nous n'avons pas de données » — c'est « en quel signal faire confiance et comment les fusionner ».

Cet article explore les couches techniques de l'attribution mobile post-iOS 17, les vraies limites de SKAdNetwork 4.0 en production, l'intérieur du fonctionnement des conversions modélisées, et l'architecture post-lookback qui fusionne ces trois flux de données. L'objectif : savoir quel signal peser et comment quand on cible un utilisateur iOS en 2026.

## Les Couches de Signaux Post-ATT

Dans l'environnement iOS 17, il existe trois types de signaux distincts : déterministe (SKAdNetwork), probabiliste (conversions modélisées) et first-party (événements server-side). Chacun offre une latence, granularité et niveau de confiance différents.

SKAdNetwork 4.0 fournit une conversion value coarse-grained (0-63) avec un délai de 24-48 heures. Les timers opèrent en trois phases : jours 0-2, puis 3-7, enfin 8-35 jours. Pour l'optimisation de campagne, les deux premières fenêtres sont critiques car les ajustements de bid doivent être quasi-temps réel. Cependant, les données SKAd sont agrégées — pas de breakdown user-level, seulement du volume par campaign ID.

Les conversions modélisées sont des dénouements que la plateforme elle-même (Meta, Google, TikTok) estime via son propre modèle machine learning. Quand un utilisateur iOS refuse ATT, il n'existe pas de signal déterministe mais la plateforme utilise des patterns de comportement utilisateur (engagement rate, cohortes d'install passées, type d'appareil) pour produire une estimation probabiliste. Meta a commencé en 2024 avec un mélange 30 % modélisé / 70 % observé ; en 2026, cette proportion peut atteindre 50-50 pour certaines campagnes. Google UAC (Universal App Campaigns) suit un mécanisme similaire mais maintient une fenêtre de conversion plus courte (7 jours).

Le flux d'événements server-side first-party envoie directement l'activité in-app à un MMP (Mobile Measurement Partner) ou CDP. Ce signal est user-level mais n'a pas d'attribution — tu ne sais pas d'quel ad il provient, tu l'utilises seulement pour le cohort tracking. Par exemple, mesurer D7 retention est possible mais l'attribuer à une campagne est problématique.

## Les Vraies Limites de SKAdNetwork 4.0

SKAdNetwork 4.0 a apporté de nombreuses améliorations : hierarchical source identifier (structure de campagne 4-tier), multiple conversion windows, support web-to-app attribution. Mais en production, deux obstacles majeurs existent : le délai de postback et la complexité d'encoding de la conversion value.

Le délai de postback fait en moyenne 24-72 heures. La première fenêtre (jours 0-2) offre un timer légèrement plus rapide mais toujours l'optimisation temps réel est impossible. Les stratégies de bid regardent généralement des données T-2, ce qui signifie que tu ajustes le bid d'aujourd'hui selon la performance de la cohorte d'il y a deux jours. Cela crée une réaction tardive aux changements de tendance.

Designer le schéma de conversion value est un problème d'ingénierie à part entière. Il faut compresser des données multidimensionnelles — revenue, type d'événement, qualité utilisateur — dans un entier entre 0 et 63. Le pattern le plus courant : les valeurs 0-31 mappent des événements (install, registration, first purchase), les 32-63 mappent des buckets de revenue. Mais cet encoding doit être spécifique à la marque — un schéma générique ne fonctionne pas. Par exemple, pour une app gaming où D1 retention est critique, on pourrait attribuer la plage 0-15 au signal retention, 16-31 aux événements IAP, et 32-63 aux buckets LTV.

Le seuil d'anonymat de foule SKAdNetwork crée aussi des problèmes en production. Apple supprime certaines combinaisons de campagnes à très faible volume pour protéger la vie privée. Donc si ta campagne de test a 50 installs par jour, tu ne recevras peut-être pas de postback SKAd. Cela rend les tests de nouvelle campagne plus difficiles — tu dois soit scale rapidement le volume, soit utiliser un targeting plus large.

## Comment Fonctionnent les Conversions Modélisées

Le système de conversions modélisées de Meta repose sur un modèle d'attribution statistique. Quand un utilisateur refuse ATT, Meta ne peut pas accéder à l'IDFA mais peut exploiter ces signaux : ad engagement (impression, clic), type d'appareil, qualité réseau, overlaps de targeting de campagne. Ces features entrent dans une régression Bayésienne et répondent probabilistiquement à la question « cet utilisateur s'est-il converti ».

L'intervalle de confiance du modèle est généralement entre 80-95 % — donc chaque prédiction porte une marge d'erreur de 5-20 %. Ces conversions apparaissent dans Meta Ads Manager sous l'étiquette « Estimated conversions ». Le Campaign Budget Optimization (CBO) utilise ce signal modélisé mais lui donne un poids inférieur aux conversions observées.

Google UAC recourt plus agressivement à la conversion modeling. Du côté Android, Google Play Instant permet d'accéder au signal déterministe mais côté iOS, c'est entièrement model-based. L'avantage de Google : avec l'intégration Firebase Analytics, le flux in-app event est plus riche, ce qui améliore la précision du modèle. Mais la fenêtre lookback reste limitée — Google modélise sur 7 jours, Meta peut aller jusqu'à 28 jours.

TikTok a quitté la bêta fin 2025 de son pipeline d'attribution probabiliste propriétaire. L'approche hybrid TikTok Pixel + SKAdNetwork fonctionne ainsi : si un utilisateur reste longtemps dans TikTok (forte engagement) puis clique sur un lien app store, ce pattern devient un signal fort pour le modèle. Le désavantage de TikTok : son réseau est moins vaste que celui de Meta/Google, donc les patterns de comportement cross-platform peuvent manquer.

## L'Architecture Maturity Post-Lookback

Pendant la période post-lookback (après que les postbacks SKAdNetwork soient terminés), l'évaluation réelle de la performance a lieu. Ici, il faut fusionner trois flux de données : SKAdNetwork observed, platform modeled et MMP first-party.

L'architecture fonctionne ainsi : les postbacks SKAdNetwork tombent dans le MMP (Adjust, AppsFlyer, Kochava), les conversions modélisées de la plateforme sont pullées via API au même moment, et les événements in-app first-party s'écoulent vers un CDP ou data warehouse (BigQuery, Snowflake). Pour fusionner ces trois flux, la clé commune est : campaign ID + install cohort date.

La logique de fusion doit résoudre ces questions : le signal modélisé overlap-t-il avec le postback SKAd ? Comptes-tu deux fois le même install ? Pour la déduplication, les MMP traitent généralement SKAd comme la ground truth et ajoutent les conversions modélisées comme une estimation supplémentaire en sus. Par exemple, si SKAd dit 100 installs et Meta en modélise 40, le total n'est pas 140 — c'est 100 confirmés + 40 probabilistes rapportés séparément.

Le calcul LTV (Lifetime Value) provient entièrement du flux first-party. SKAdNetwork ne fournit pas de LTV, les conversions modélisées ne prédisent pas la revenue. C'est pourquoi l'analyse LTV par cohorte nécessite le flux d'événement brut du MMP ou CDP. Le flux typique : récupère la cohorte d'install de SKAd, calcule sa revenue D7/D30/D90 depuis le first-party, puis utilise SKAd install count × cohort LTV dans ton calcul ROAS au niveau campagne.

Construire cette architecture requiert de l'ingénierie data pipeline dans ta stack [Performance Marketing (PPC)](https://www.roibase.com.tr/fr/ppc). Ce n'est pas seulement un dashboard — le processus ETL (Extract, Transform, Load), la logique de déduplication et les seuils de confiance du modèle sont critiques.

## Incrementality et Structure de Test Holdout

Les conversions modélisées créent un problème de confiance : cet utilisateur s'est-il vraiment converti ou le modèle a-t-il inventé ? Pour répondre, la mesure d'incrementality est obligatoire. La méthode la plus clean : le test holdout géographique.

Le test geo-holdout fonctionne ainsi : arrête la campagne dans certaines zones (état, ville, DMA) et compare le taux d'install organique dans ces zones avec celui des régions où la campagne roule. La différence = lift incrémental. Mais faire des tests geo sur l'attribution iOS est difficile car SKAdNetwork ne fournit pas de breakdown géo. Le test doit donc être construit côté MMP — l'inférence geo provient de l'IP de l'install mais n'est pas 100 % précise.

Alternative : holdout basé sur le temps. Arrête la campagne certains jours de la semaine, mesure la baisse du volume d'install. Cette méthode est simple mais peut introduire un biais seasonality (par exemple, les installs organiques sont déjà plus hauts le dimanche, donc l'effet de campagne sera sous-estimé).

Meta propose son propre outil Conversion Lift test. Il segmente les utilisateurs en groupes test/control, montre des ads au groupe test, au groupe control il montre des PSA ou ads caritatifs. Puis il compare les taux de conversion des deux groupes. Ce test fonctionne indépendamment de SKAdNetwork car Meta utilise son propre user graph. Mais il faut minimum 200K impressions, donc les petites campagnes ne peuvent pas être testées.

Les résultats du test incrementality peuvent calibrer l'intervalle de confiance des conversions modélisées. Par exemple, si le lift test montre 60 % incrémental mais les conversions modélisées en revendiquent 80 %, le modèle surestime — baisse alors son poids.

## En Quel Signal Faire Confiance pour l'Optimisation de Campagne

Mi-2026, l'optimisation de campagne nécessite une approche de signaux hybrides. Ne compter que sur SKAdNetwork crée de la latence, ne compter que sur les conversions modélisées érode la confiance.

La stratégie recommandée : les deux premiers jours, optimise avec pondération modeled conversions (car SKAd tarde), puis une fois les postbacks SKAd arrivés, recalibre le modèle. Par exemple, dans une campagne Meta CBO, le premier jour les ad sets voient un shift budgétaire selon le signal modélisé, à partir du jour 3 la proportion de conversions observées augmente avec l'arrivée des données SKAd.

Pour la stratégie de bid : préfère tROAS (target ROAS) + volume cap au lieu du simple bidding ROAS. Sur iOS, calculer un ROAS déterministe est difficile, donc fixe un tROAS cible (p.ex. 3.0) mais ajoute un volume minimum d'installs par jour (p.ex. 500 installs/jour minimum). Cela préserve à la fois la rentabilité et l'échelle.

Le test créatif crée aussi des problèmes de signal. Faire un A/B test peut manquer de volume suffisant (à cause du seuil anonymat SKAd). Dans ce cas, lance un test séquentiel : exécute créative A pendant 3 jours, puis créative B pendant 3 jours, puis compare une fois les postbacks SKAd arrivés. Cette méthode n'est pas parfaitement clean (biais facteur externe possible) mais c'est l'option la plus pragmatique sous les contraintes iOS.

## Conclusion

La stack d'attribution post-iOS 17 n'est pas déterministe — elle est probabiliste, retardée et multi-couche. SKAdNetwork 4.0 fournit le signal fondamental mais avec latence, les conversions modélisées gagnent de la vitesse mais créent du doute, le flux first-party fournit le LTV mais pas l'attribution. Fusionner ces trois flux et comprendre l'intervalle de confiance de chacun est maintenant une compétence core du performance marketing. Les équipes qui ratent cette stack soit sous-investissent (refusent le signal modélisé, ratent les opportunités) soit suroptimisent (ignorent la surestimation du modèle, CAC explose). Le gagnant en 2026 : l'équipe qui lie la complexité du signal à la discipline d'ingénierie.