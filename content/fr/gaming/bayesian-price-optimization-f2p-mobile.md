---
title: "Optimisation tarifaire Bayésienne en F2P Mobile"
description: "Pourquoi passer des tests A/B classiques à l'estimation bayésienne pour les IAP ? Mise à jour postérieure, construction d'échelles segment-spécifiques, mécanismes de décision précoce."
publishedAt: 2026-05-10
modifiedAt: 2026-05-10
category: gaming
i18nKey: gaming-002-2026-05
tags: [f2p-monetization, bayesian-testing, iap-pricing, mobile-gaming, price-optimization]
readingTime: 9
author: Roibase
---

Dans l'économie mobile F2P, l'optimisation tarifaire se fait encore avec « passons le pack le plus vendu de 4,99 $ à 5,99 $ ». En 2026, les studios qui optimisent les enchères Apple Search Ads avec une précision à la milliseconde perdent des mois avec des tests A/B classiques sur l'échelle IAP. L'estimation bayésienne, quand elle est utilisée non pas pour attraper des marges de quelques pourcents, mais pour prendre des décisions précoces et construire des échelles tarifaires segment-spécifiques, tire la LTV à la hausse de 12 à 18 % en moyenne par test. Cet article explique la logique de mise à jour postérieure, comment l'articuler avec la segmentation, et pourquoi le cadre bayésien est indispensable en contexte mobile.

## Pourquoi les tests A/B classiques de prix deviennent trop lents

Un test A/B fréquentiste pour une modification de prix peut nécessiter 5 000 à 10 000 transactions pour atteindre la significativité statistique (p = 0,05, puissance = 0,80). Sur un jeu F2P de segment moyen avec 200-300 utilisateurs payants par jour, c'est 25-30 jours d'attente pour une seule variante. Pendant ce temps, le Season Pass se renouvelle, le calendrier des événements change, le concurrent lance une mise à jour — maintenir un groupe de contrôle devient impossible.

Le deuxième problème avec l'approche classique est sa structure de décision binaire : soit « l'augmentation de prix n'est pas significative, revenir en arrière », soit « significative, déployer ». Or, sur mobile, chaque cohorte porte une élasticité-prix différente. Un utilisateur iOS organique se convertit à 9,99 $, tandis qu'un utilisateur Android payant peut être 40 % plus sensible au prix. Un seul p-value force tous les segments vers la même décision.

Le troisième inconvénient est l'impossibilité d'arrêt précoce. Un test fréquentiste doit durer jusqu'à atteindre la taille d'échantillon — même si la confiance postérieure atteint 92 % à la deuxième semaine, « les données sont insuffisantes », donc quatre semaines d'attente supplémentaires. Ce délai gaspille le gain de LTV que le changement de prix aurait pu générer en live ops.

## Comment fonctionne l'estimation postérieure dans un cadre bayésien

L'approche bayésienne voit la modification de prix du taux de conversion (ou du revenu moyen par utilisateur payant) non pas comme un chiffre fixe, mais comme une **distribution de probabilité**. Avant le test, il existe une croyance antérieure : la distribution CVR de l'ancien prix. À chaque nouvelle transaction, la distribution postérieure se met à jour via le théorème de Bayes :

```
P(θ | données) ∝ P(données | θ) × P(θ)
```

Ici, θ = taux de conversion réel (ou ARPPU), données = événements d'achat observés. On utilise généralement Beta(α, β) comme prior (approprié puisque le flux IAP est un résultat binaire). À la fin de chaque jour, les paramètres α et β sont mis à jour avec le nombre de nouvelles transactions.

Concrètement, cela fonctionne ainsi : vous testez le passage du Starter Pack de 4,99 $ à 5,99 $. Croyance antérieure : CVR ~2,8 % (Beta(280, 9720) — dérivé de 10 000 impressions). Au cours des 3 premiers jours, la variante à 5,99 $ reçoit 600 impressions et 14 conversions. Le postérieur devient maintenant Beta(294, 10306). L'intervalle de confiance s'est resserré, la CVR moyenne s'est mise à jour à 2,78 %. Au 10ème jour : 2 000 impressions, 48 conversions — postérieur Beta(328, 11672), CVR 2,74 %. Tandis que le test fréquentiste dit encore « échantillon insuffisant », l'approche bayésienne énonce : « La probabilité que la CVR au nouveau prix soit inférieure à l'ancien est de 87 % — mais l'augmentation de l'ARPPU compense-t-elle ? »

### Métrique de décision : Expected Revenue Gain

La baisse du CVR n'est pas une décision en soi. Dans un cadre bayésien, la métrique réelle est le **revenu attendu par impression** (ERPI) :

```
ERPI = E[CVR × Price]
```

Pour chaque variante, vous tirez des échantillons de la distribution postérieure via Monte Carlo (10 000 itérations), à chaque itération en comparant CVR_new × 5,99 $ avec CVR_old × 4,99 $. Si plus de 85 % favorisent le nouveau prix (c.-à-d. P(ERPI_new > ERPI_old) > 0,85), la décision est « scale up ». Si moins de 15 %, revenez en arrière.

Cette approche vous permet de prendre une décision en 10-12 jours, avec 1 500-2 000 transactions. Comparé aux 4-5 semaines du test A/B classique, c'est 60 % plus rapide.

## Construction d'une échelle segment-spécifique

La véritable puissance de l'estimation bayésienne émerge quand elle se combine au format **multi-armed bandit**. Chaque segment maintient son propre postérieur, et chaque jour, l'allocation du trafic vers les variantes de prix est déterminée dynamiquement via Thompson Sampling.

Scénario concret : vous avez 4 segments — (1) iOS organique, (2) iOS payant, (3) Android organique, (4) Android payant. Vous testez 3 prix pour le Starter Pack : 4,99 $, 5,99 $, 6,99 $. Au total, 12 distributions postérieures (4 segments × 3 prix).

La première semaine, chaque segment reçoit les 3 variantes à égalité (exploration). À partir de la 2ème semaine, Thompson Sampling entre en jeu : à chaque impression reçue, on tire un échantillon des 3 postérieurs pour ce segment, et la variante avec l'ERPI le plus élevé reçoit le trafic. Si 6,99 $ s'ouvre rapidement en iOS organique, les utilisateurs de ce segment voient 6,99 $ dans ~70 % des cas. Si 5,99 $ est optimal sur Android payant, le trafic s'y oriente.

| Segment | Prix optimal (jour 14) | Confiance postérieure | Allocation quotidienne |
|---|---|---|---|
| iOS organique | 6,99 $ | 91 % | 78 % |
| iOS payant | 5,99 $ | 88 % | 74 % |
| Android organique | 5,99 $ | 85 % | 71 % |
| Android payant | 4,99 $ | 82 % | 69 % |

Cette structure, en capturant l'élasticité-prix au niveau segment, génère 15-20 % de revenu en plus qu'imposer un seul prix global. De plus, quand vous ajoutez un nouveau segment (par ex. « utilisateurs payants de géographie de niveau 2 »), vous créez un prior pour ce segment et le multi-armed bandit commence automatiquement à le tester.

## Mécanisme de décision précoce et minimisation du regret

L'avantage critique du cadre bayésien en contexte mobile est la **prise de décision séquentielle**. Chaque fin de jour, le postérieur se met à jour, et on consulte la règle de décision. Si P(ERPI_new > ERPI_old) > 0,90, on dit « nous sommes assez certains maintenant, redirigeons le trafic restant vers la variante gagnante ». Tandis que le test fréquentist attend « sample size non atteint », l'approche bayésienne décide au jour 7 et scale le prix gagnant les 3 semaines restantes.

Pouvoir décider tôt **minimise le regret cumulatif**. Le regret = « revenu si nous avions connu le prix optimal » − « revenu généré pendant le test ». En A/B classique, 50 % du trafic va à la variante sous-optimale pendant 30 jours ; avec Thompson Sampling bayésien, 80 % du trafic va à la variante gagnante à partir du jour 10. Le regret intégral chute de 60-70 %.

Concrètement, sur un cycle de test de 2-3 semaines :
- A/B classique : 21 jours × 50 % trafic sous-optimal = équivalent 10,5 jours de perte
- Bandit bayésien : 7 jours exploration + 14 jours 15 % sous-optimal = équivalent 2,1 jours de perte

Cette différence se traduit par un impact de revenus quotidiens de plusieurs dizaines de milliers de dollars pour les jeux à fort DAU.

## Compromis et pièges

L'optimisation tarifaire bayésienne n'est pas sans risques. Le choix du prior est critique : un prior trop étroit (ex. Beta(5000, 195000) — « CVR est certainement 2,5 % ») met à jour lentement face à nouvelles données. Un prior trop large (Beta(1, 1) — uniforme) prolonge l'exploration. Un bon point de départ : convertir les données de transaction des 30 derniers jours de l'ancien prix en paramètres Beta (méthode des moments).

Le deuxième piège : quand le nombre de segments augmente, la convergence du multi-armed bandit ralentit. 4 segments × 3 prix = 12 bras ; chacun nécessite 200-300 samples, donc 2 400-3 600 transactions au total — sur 300 utilisateurs payants/jour, 10-12 jours. Passer à 8 segments × 4 prix = 32 bras, et la convergence s'étend à 4-5 semaines. Solution : utiliser la régression bayésienne hiérarchique pour partager l'information entre segments (ex. prior « les GEO de niveau 1 montrent élasticité similaire »).

Un troisième point d'attention : l'échelle IAP ne se teste pas isolément, elle s'imbrique dans le calendrier live ops. L'élasticité-prix change pendant un événement (effet d'urgence). Vous devez mettre à jour le postérieur bayésien plus rapidement les jours d'événement, mais ne pas réinitialiser le prior après — sinon l'information « 6,99 $ est optimal en événement » se propage aux jours normaux, donnant une décision sous-optimale.

Enfin : l'approche bayésienne ne donne pas les mêmes garanties que le test fréquentiste. Vous dites « P(θ > x) = 0,95 », mais ce n'est pas un intervalle de confiance à 95 %, c'est un intervalle crédible à 95 %. Si un régulateur ou une exigence légale demande des métriques fréquentistes (par ex. conformité aux règlementations sur les loot boxes), vous devrez sauvegarder les résultats bayésiens avec bootstrap.

## Intégrer les tests d'échelle segment-spécifique dans la mesure Roibase

Pour les studios mobile F2P, l'optimisation tarifaire n'est pas un test isolé, elle s'articule à tout le pipeline [App Store Optimization](https://www.roibase.com.tr/fr/aso) et attribution. Vous pouvez utiliser les postérieurs bayésiens non seulement pour les décisions de prix, mais aussi pour les tests de creative ASO : quelle custom product page génère le plus haut IPM pour quel segment, et quelle échelle IAP optimale pour ce segment — en fusionnant deux flux de données, vos projections de LTV au niveau cohorte deviennent 30 % plus précises.

Intégrer le cadre bayésien à votre infrastructure de mesure rend possible à la fois la décision précoce et la construction d'une échelle tarifaire segment-spécifique. En 2026, les studios F2P qui gagnent sont ceux qui ont transformé le test tarifaire d'une « optimisation mensuelle » à un système qui met à jour la distribution postérieure chaque jour, alloue le trafic via Thompson Sampling, et minimise le regret cumulatif.