---
title: "Optimisation des Prix Bayésienne pour les IAP en Mobile F2P"
description: "Gérer les tests de tarification IAP avec l'estimation a posteriori : segmentation, échelle de prix A/B, filtrage des faux positifs et intervalles de confiance."
publishedAt: 2026-06-10
modifiedAt: 2026-06-10
category: gaming
i18nKey: gaming-002-2026-06
tags: [optimisation-bayesienne, tarification-iap, monetisation-f2p, test-de-prix, estimation-a-posteriori]
readingTime: 9
author: Roibase
---

Dans les jeux mobiles F2P, l'optimisation des prix IAP fonctionne encore selon la logique fréquentiste : deux variantes de prix, 14 jours, p<0,05. Cette approche entraîne une perte de puissance statistique sur les petits segments (utilisateurs VIP, nouveaux baleine) et tue les opportunités de décision précoce. L'optimisation bayésienne des prix met à jour la distribution a posteriori, ce qui permet à la fois une prise de décision plus rapide et une confiance accrue sur les petits échantillons. Cet article explique comment gérer les tests d'échelle de prix IAP avec l'estimation a posteriori, les limites de segmentation, le filtrage des faux positifs et le modèle d'augmentation des revenus.

## Où le Test A/B Fréquentiste Échoue pour les IAP

Le test A/B classique nécessite une taille d'échantillon fixe. Comme le taux d'achat IAP se situe dans la fourchette 2–5 %, l'accumulation d'un volume de conversion suffisant pour un test de prix prend 3–4 semaines. Sur le segment baleine (top %1 des dépensiers), le taux est encore plus faible, ce qui allonge la durée du test à 6 semaines. Le problème : le métagame change, un nouvel événement arrive, les périodes saisonnières se terminent — après 6 semaines, vos données ne sont plus représentatives.

La logique fréquentiste produit également une décision binaire : victoire/défaite. Or, dans un test IAP, l'effet de la variable prix n'est pas monotone. En passant de 4,99 $ à 6,99 $, le taux de conversion peut chuter de %8, mais le revenu moyen par utilisateur payant (ARPPU) augmente de %22, ce qui représente une augmentation nette de +%12. Ce compromis n'apparaît pas dans la valeur p fréquentiste — vous devez le calculer après coup.

L'approche bayésienne combine la croyance antérieure (par exemple, « ce segment se monétise généralement mieux dans la fourchette 5–7 $ ») avec les données pour produire une distribution a posteriori. Le test commence à mettre à jour la distribution a posteriori dès le départ et fournit des résultats provisoires même avec 500 impressions. Comme vous pouvez arrêter tôt, vous réduisez le temps du test de moitié, et comme l'intervalle de confiance a posteriori vous permet de mesurer le risque, vous pouvez construire une stratégie décisionnelle agressive ou conservatrice.

## Configuration du Prior et de la Vraisemblance dans le Test d'Échelle de Prix

Un test d'échelle de prix IAP fonctionne ainsi : prix actuel 4,99 $, variantes à tester 5,99 $, 6,99 $. Vous maintiendrez une distribution a posteriori distincte pour chaque point de prix : `P(θ | données)` — où θ = taux de conversion réel ou revenu attendu par utilisateur (ERPU).

**Sélection du prior :**
La distribution Beta(α, β) est utile pour le taux de conversion. Si vous disposez de données historiques pour le segment (par exemple, taux de conversion de %3,2 au cours des 90 derniers jours, 1 200 impressions), vous les convertissez en prior avec `α = conversions`, `β = non-conversions`. En l'absence de données, utilisez un prior non informatif Beta(1,1) — distribution uniforme. Pour les segments baleine, un prior informatif est généralement préféré car la taille de l'échantillon sera petite ; le prior stabilise les données.

**Vraisemblance :**
Chaque variante de prix est un essai de Bernoulli. L'utilisateur voit l'IAP, l'achète ou non. Données observées : n impressions, k conversions. Mise à jour a posteriori :

```
A posteriori = Beta(α + k, β + n - k)
```

Cette formule est mise à jour chaque jour avec les nouvelles impressions. Scénario d'exemple :

| Jour | Prix  | Impressions | Conversions | A posteriori |
|------|-------|-------------|-------------|--------------|
| 1    | 5,99 $ | 120        | 4           | Beta(5, 117)  |
| 3    | 5,99 $ | 380        | 13          | Beta(14, 368) |
| 7    | 5,99 $ | 820        | 28          | Beta(29, 793) |

Au jour 7, la moyenne a posteriori = 29/(29+793) = %3,53. Intervalle crédible : [%2,4, %4,9] (%95 HPD).

## Segmentation et Intégration du Bandit Multi-Armé

Exécuter un test d'échelle de prix sur la base d'utilisateurs entière est inefficace. Ciblez les segments avec le plus fort potentiel de revenus : nouvelle baleine (première IAP au D7, dépense >$20), dépensier régulier (2+ achats au cours des 14 derniers jours), dépensier déclenché par événement (déclenché lors du lancement d'un nouveau battle pass). Maintenir une distribution a posteriori distincte pour chaque segment augmente la complexité du modèle, mais améliore l'efficacité de l'échantillon.

Combinée à l'optimisation bayésienne, la stratégie du bandit multi-armé (MAB) permet une allocation dynamique : donnez plus de trafic au point de prix avec la moyenne a posteriori la plus élevée (exploit), mais allouez également du trafic minimum à ceux avec une variance a posteriori élevée (explore). L'algorithme de Thompson Sampling tire des échantillons de la distribution a posteriori et sélectionne la valeur la plus élevée, équilibrant automatiquement ce compromis :

```python
def thompson_sampling(posteriors):
    samples = [beta.rvs(p['alpha'], p['beta']) for p in posteriors]
    return np.argmax(samples)
```

Cette fonction s'exécute pour chaque décision d'allocation d'impression. Après 10 000 impressions, le meilleur point de prix capte naturellement la majorité du trafic, mais les autres ne disparaissent pas complètement — si de nouvelles données émergent, la distribution a posteriori peut être mise à jour et l'ordre peut s'inverser.

## Filtrage des Faux Positifs et Intervalle de Confiance A Posteriori

Dans les tests bayésiens, il n'existe pas de concept de « signification statistique » — on utilise plutôt la probabilité a posteriori : `P(θ_A > θ_B | données)`. Si cette probabilité est >%95, on peut dire que le prix A surpasse le prix B. Cependant, attention : même si la probabilité a posteriori est élevée, si la taille de l'effet est faible, il n'y a pas de gain opérationnel.

**Seuil d'effet minimum détectable (MDE) :**
Si l'augmentation du revenu est <%5, le coût de mise en œuvre dépasse le gain (conformité App Store, ajout de nouvelle SKU, localisation). La règle décisionnelle doit donc être :

```
IF P(augmentation > 5%) > 0.95 AND uplift_moyen_posteriori > 5%:
    DEPLOYER
ELSE:
    CONTINUER ou ARRÊTER
```

Ce double filtre contrôle les faux positifs. Par exemple, si l'augmentation moyenne a posteriori du prix 5,99 $ est de +%3,2 mais que l'intervalle crédible est [-%1,2, +%7,8], il est trop tôt pour décider. Après deux semaines de collecte de données supplémentaires, l'intervalle se rétrécit en [+%2,1, +%5,6] ; si la condition moyenne >%5 est satisfaite, vous pouvez déployer.

**Vérification prédictive a posteriori :**
Après le test, simulez la performance du prix déployé à l'aide de la distribution prédictive a posteriori. Si la performance observée se situe en dehors de cette distribution (par exemple, en dessous du %99 de la distribution), la composition du segment a changé ou un facteur externe intervient (nouveau jeu concurrent, changement de politique tarifaire d'Apple). Dans ce cas, invalidez la distribution a posteriori et relancez le test avec un nouveau prior.

## Modélisation de l'Augmentation des Revenus et Arbre Décisionnel Opérationnel

La métrique finale du test de prix IAP n'est pas le taux de conversion, mais l'augmentation du revenu moyen par utilisateur au niveau du segment (ERPU). Modélisez l'ERPU dans le cadre bayésien comme suit :

```
ERPU = P(conversion) × Prix
ERPU a posteriori = E[θ] × Prix
```

Calculez l'ERPU a posteriori pour chaque point de prix et sélectionnez le plus élevé. Mais il y a un compromis : un prix plus élevé réduit la conversion, un prix plus bas réduit l'ARPPU. Pour trouver le point optimal, testez l'ensemble de l'échelle de prix simultanément (3–4 variantes) et comparez les distributions ERPU a posteriori.

**Arbre décisionnel opérationnel :**

1. **Jour 3 :** La variance a posteriori est-elle toujours élevée ? Oui → ajustez l'allocation du trafic (MAB). Non → vérifiez s'il y a un signal de gagnant précoce.
2. **Jour 7 :** La probabilité a posteriori du meilleur point de prix est-elle >%90 ? Oui → lancement soft (segment baleine %10). Non → continuez 7 jours supplémentaires.
3. **Jour 14 :** L'intervalle crédible a posteriori est-il étroit (<plage %3) et l'augmentation >%5 ? Oui → déployer intégralement. Non → test sans conclusion, effectuez une analyse méta.

Cet arbre permet au test de se terminer en médiane 10 jours (21 jours avec l'approche fréquentiste). Même sur des populations réduites comme les segments baleine, une décision est possible au jour 14 car avec un prior informatif, la distribution a posteriori se rétrécit rapidement.

Analyse méta : si le test reste sans conclusion, affinez la segmentation au sein du segment (iOS vs Android, géo tier-1 vs tier-2, âge D7 vs D30). Calculez la distribution a posteriori pour chacun, identifiez où le signal est fort et appliquez un prix spécifique à ce segment. Ce processus se parallélise avec la [stratégie d'optimisation pour app stores](https://www.roibase.com.tr/fr/aso) : chaque segment voit une créative différente, ici un prix différent.

## Calibration des Prix à Long Terme via Estimation A Posteriori

L'optimisation bayésienne des prix n'est pas un test unique, mais un système de calibrage continu. Chaque mois, une nouvelle cohorte arrive, le métagame change, l'effet d'un événement saisonnier modifie la distribution a posteriori. Pour cela, appliquez la logique de distribution a posteriori roulante : mettez à jour la distribution a posteriori chaque semaine avec les 60 derniers jours de données, et laissez s'estomper l'ancien prior (décroissance exponentielle).

```python
def update_rolling_posterior(current_posterior, new_data, decay=0.95):
    alpha_new = current_posterior['alpha'] * decay + new_data['conversions']
    beta_new = current_posterior['beta'] * decay + new_data['non_conversions']
    return {'alpha': alpha_new, 'beta': beta_new}
```

Ce système ne réinitialise pas la distribution a posteriori après un changement de prix, mais ajoute les données du nouveau prix à la distribution a posteriori existante. De cette façon, les connaissances historiques ne disparaissent pas complètement, mais les modèles actuels pèsent davantage.

À long terme, vous pouvez construire une courbe d'élasticité des prix : tracez l'ERPU moyen a posteriori pour chaque point de prix et avec une courbe ajustée, observez l'effet marginal d'une augmentation de %1. Si la courbe plafonne à 6,99 $, n'essayez pas de prix plus élevés — testez plutôt une stratégie de bundle/paquet (par exemple, deux IAP ensemble avec %15 de réduction). Cette stratégie est également testée avec Bayésienne, en utilisant comme prior que le taux de conversion du bundle est %70 du taux IAP unique (heuristique sectorielle), puis mise à jour avec les données a posteriori.

L'optimisation bayésienne des prix transforme les tests IAP d'une approche A/B statique en un système d'apprentissage dynamique. Grâce à l'estimation a posteriori, vous pouvez prendre des décisions précoces sur les petits segments tout en contrôlant les faux positifs et en maximisant l'augmentation des revenus. Sur les populations réduites comme les segments baleine ou les dépensiers déclenchés par événement, l'approche fréquentiste ne fonctionne pas — la structure prior + vraisemblance bayésienne résout ce problème. Avec une distribution a posteriori roulante, la calibration des prix se met à jour en continu, les changements saisonniers ou les shift du métagame se reflètent automatiquement. Le résultat : le temps de test est réduit de moitié, la qualité des décisions s'améliore, les coûts opérationnels diminuent.