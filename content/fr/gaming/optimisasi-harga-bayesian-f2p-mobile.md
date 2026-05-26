---
title: "Optimisation des Prix Bayésienne en Mobile F2P"
description: "Optimisation segmentée des tests IAP via estimation postérieure : modèle probabiliste pour équilibrer conversion, revenu et LTV."
publishedAt: 2026-05-26
modifiedAt: 2026-05-26
category: gaming
i18nKey: gaming-002-2026-05
tags: [monetisation-f2p, test-bayesien, optimisation-iap, price-ladder, jeux-mobiles]
readingTime: 9
author: Roibase
---

Dans les jeux mobiles F2P, la tarification des IAP fonctionne encore à l'intuition : on copie la ladder $0.99, $4.99, $9.99, on réduit les prix si la conversion baisse, on ajoute "plus de valeur" si elle monte. Mais le même pack à $4.99 peut afficher 2,1 % de conversion chez l'utilisateur organique, 1,4 % dans la cohorte UA et 8,7 % dans le segment whale D30+. Le test A/B classique montre ses limites : soit l'effectif explose, soit l'attente dépasse six semaines, soit on ne sait pas quelle métrique optimiser entre revenu et conversion. L'optimisation bayésienne des prix résout ces trois problèmes simultanément : elle capture les signaux précoces via la distribution postérieure, modélise l'impact LTV au niveau segment et gère l'équilibre revenu-conversion dans un cadre probabiliste.

## L'Impasse du Test Fréquentiste A/B en Tarification IAP

Un test A/B standard calcule la taille d'échantillon pour observer une différence p<0,05 entre deux prix basée sur le taux de conversion. Pour un taux de base de 2 %, un relèvement relatif de 10 % visé et une puissance de 80 %, il faut environ 15 000 expositions. Pour un IAP de milieu de gamme, cela signifie 4 à 6 semaines. À mesure que le test s'étire :

- Le CPI augmente dans les campagnes Meta (fatigue créative)
- Le mix de cohortes organiques se décale (effet saisonnier, changement de classement ASO)
- Un jeu concurrent lance un nouvel événement, l'élasticité de la demande se brise

Le problème plus critique reste la scission revenu-conversion : passer de $2,99 à $4,99 peut réduire la conversion de 2,1 % à 1,7 % mais augmenter le revenu par mille de 42 %. Sur quelle métrique calculer la p-value ? La plupart des studios déclarent "on a gagné du revenu" et passent à autre chose, mais une modélisation d'LTV D7 révèle que 31 % du segment whale s'est désabonné et que le nouveau prix a endommagé la retention.

L'approche bayésienne conserve conversion et revenu dans le même modèle postérieur : conviction antérieure (distribution bêta issue des tests précédents) + observations (nouvelles données) → conviction mise à jour (distribution postérieure). Dès le jour 3, le test peut dire "il y a 73 % de probabilité que $4,99 soit meilleur", ce pourcentage montant à 89 % le jour 7, et une fois le regret tombé sous 1 % au jour 10, le test s'arrête.

## Construction de la Distribution a Priori : Historique IAP au Lieu de Benchmarks

La qualité d'un test bayésien dépend de la construction correcte de la distribution a priori. La plupart des documentations disent "prends une a priori uniforme, laisse les données parler" mais si tu as six mois d'historique IAP, ignorer cette ressource n'a pas de sens. Exemple de processus de construction d'a priori :

**Étape 1 :** Extrais la distribution des taux de conversion de tous les paliers IAP des six derniers mois. Les conversions $0,99–$2,99 oscillent entre 1,8–3,2 %, médiane 2,4 %. Pour la distribution bêta, les paramètres alpha=24, beta=976 reflètent cette distribution (moyenne=alpha/(alpha+beta)≈0,024).

**Étape 2 :** Ajoute la variance au niveau segment. La cohorte organique affiche une conversion de l'a priori 18 % plus élevée que la cohorte UA (alpha=28, beta=972). Pour le segment whale : parmi les utilisateurs payants D30+, la conversion atteint 6,8 %, alpha=68, beta=932.

**Étape 3 :** Intègre l'ajustement de la courbe d'élasticité prix. Historiquement, la transition $1,99 → $2,99 a réduit la conversion de 14 % en moyenne. Si le nouveau test passe de $2,99 à $3,99, inscris cette pente dans l'a priori :

```python
def price_elasticity_prior(base_price, new_price, base_conversion):
    slope = -0.14 / 1.00  # Baisse de 14% par dollar d'augmentation
    delta = new_price - base_price
    expected_drop = slope * delta
    adjusted_conversion = base_conversion * (1 + expected_drop)
    alpha = adjusted_conversion * 1000
    beta = 1000 - alpha
    return alpha, beta
```

Cette approche reflète le comportement des cohortes du jeu lui-même plutôt qu'un "benchmark de l'industrie 2,5 %".

## Estimation Postérieure et Tarification Segmentée en Ladder

Configuration du test : pack de démarrage $2,99 vs $3,99, distribué 50/50 sur le trafic UA pendant 7 jours. Mais la segmentation reste obligatoire :

| Segment | Prior α | Prior β | Effectif cible |
|---------|---------|---------|-----------------|
| D0-D7 organique | 28 | 972 | 4000 |
| D0-D7 UA | 22 | 978 | 6000 |
| D7+ non-payant | 18 | 982 | 3000 |
| D7+ acheteur antérieur | 68 | 932 | 2000 |

Chaque segment met à jour sa postérieure indépendamment. Au jour 3, les résultats :

**Segment organique :** $2,99 → 87 conversions / 2100 expositions, $3,99 → 71 / 2050. Postérieure : α₁=28+87=115, β₁=972+2013=2985 vs α₂=28+71=99, β₂=972+1979=2951. Via Monte Carlo sur 10 000 simulations, P($2,99 meilleur) = 78 %. Vue revenu : $2,99 × 87 = $260, $3,99 × 71 = $283. En modélisant la postérieure revenu avec une distribution gamma, P($3,99 supérieur en revenu) = 61 %.

À ce point, la décision : si conversion est prioritaire chez l'organique, continue avec $2,99 ; si revenu prime, attends 2 jours de plus. Pour le segment UA, $3,99 domine clairement (83 % de probabilité postérieure), le test s'arrête tôt et ce segment bascule à $3,99.

**Construction dynamique du price ladder par segment :** Une fois le test terminé, l'inventaire IAP se structure ainsi :

- D0-D3 organique : pack de démarrage $2,99
- D0-D3 UA : pack de démarrage $3,99
- D7+ acheteur passé : booster $7,99 (postérieur issu d'un test distinct)
- Whale (D30+ $50+ LTV) : bundle premium $14,99

Cette architecture optimise quatre courbes d'élasticité distinctes au lieu d'un prix global unique. Combinée à la [stratégie d'optimisation pour App Store](https://www.roibase.com.tr/fr/aso), cette segmentation affine l'entonnoir IAP davantage : la valeur affichée dans la créative s'aligne avec le palier IAP.

## Thompson Sampling : Extension Multi-Armed Bandit

Au lieu d'un test fixe sur 7 jours, une extension Thompson sampling : à chaque impression, tire un échantillon de la postérieure du segment, présente le prix avec la plus forte espérance de valeur. Ainsi, pendant le test, l'équilibre exploration/exploitation se construit dynamiquement.

Pseudo-code :

```python
def thompson_sampling_price(segment, price_variants):
    posteriors = {p: get_posterior(segment, p) for p in price_variants}
    samples = {p: np.random.beta(post['alpha'], post['beta']) 
               for p, post in posteriors.items()}
    revenue_samples = {p: s * p for p, s in samples.items()}
    return max(revenue_samples, key=revenue_samples.get)
```

Cette approche minimise particulièrement le regret lors du test de 3+ variantes de prix. Un A/B classique sur 3 prix exige 3× l'effectif, Thompson sampling via mise à jour postérieure élimine automatiquement les mauvaises variantes. Si la postérieure de $2,99 tombe à 9 % au jour 10, son taux d'exposition chute à 5 %, sans gaspillage d'échantillon.

Attention : sans source UA illimitée, Thompson sampling risque d'épuiser le budget. Un budget campagne Meta de $5000/jour signifie que Thompson pourrait choisir un prix baissant la conversion, le CPA explose, le budget s'écoule à midi. La configuration sûre : les 3 premiers jours, 50/50 split, n'active Thompson que si la crédibilité postérieure dépasse 80 %.

## Revenu vs LTV : Fusionner la Postérieure avec la Modélisation de Retention

La couche finale de l'optimisation prix IAP est la projection LTV. Si $3,99 affiche une conversion plus faible mais une retention D7 supérieure de 8 %, le LTV 90 jours de cette cohorte pourrait surpasser celui de $2,99. Un A/B classique ne le voit pas car le LTV se stabilise après 90 jours. Fusionner la postérieure bayésienne avec un modèle de survie capture le signal précoce.

Setup : pour chaque variante de prix, fit la courbe de retention des 7 premiers jours via le modèle Cox à hasards proportionnels :

```python
from lifelines import CoxPHFitter

df['price_variant'] = df['variant'].map({'2.99': 0, '3.99': 1})
cph = CoxPHFitter()
cph.fit(df, duration_col='days_retained', event_col='churned', 
        formula='price_variant + segment + paid_d3')
```

Résultat : la variante $3,99 a un hazard ratio de 0,88 (churn 12 % moins élevé, p=0,03). Fusionne-le avec la postérieure :

**Calcul postérieur de LTV :**
- $2,99 : E[conversion]=0,024, E[D90_retention]=0,34, ARPDAU=$0,12 → LTV=$2,99 × 0,024 + 90 × 0,34 × 0,12 = $3,74
- $3,99 : E[conversion]=0,019, E[D90_retention]=0,38, ARPDAU=$0,15 → LTV=$3,99 × 0,019 + 90 × 0,38 × 0,15 = $5,21

Via Monte Carlo sur 10 000 itérations, la distribution postérieure LTV : P($3,99 LTV supérieur) = 91 %. Cette crédibilité postérieure est un signal bien plus robuste qu'une vision revenu seul. Décision : choisir $3,99, rééquilibrer la stack IAP.

## Compromis : Complexité du Modèle vs Vitesse d'Exécution

L'optimisation bayésienne des prix IAP entraîne trois coûts opérationnels :

**1. Maintenance de l'a priori :** Chaque nouvel événement, changement meta, lancement de concurrent redessine la distribution a priori. Un re-calibrage tous les 6 mois est indispensable. Dans les petits studios sans data scientist, c'est insoutenable.

**2. Granularité des segments :** 8 segments × 3 prix = 24 postérieures à tracker. Pour les petits segments (ex. whale), la variance postérieure reste élevée, l'intervalle de confiance large. Solution pratique : isoler le segment whale, conserver un A/B test classique, appliquer le bayésien ailleurs.

**3. Fragmentation multi-plateforme :** iOS vs Android affichent des sensibilités prix différentes. L'App Annie 2025 montre que la conversion iOS dépasse celle d'Android de 23 %. Faut-il une postérieure par plateforme ou un modèle fusionné ? Deux postérieures = sample split, fusion = biais plateforme. Solution : modèle bayésien hiérarchique — plateforme devient un effet aléatoire.

Néanmoins, le bayésien reste plus rapide qu'attendre 4+ semaines d'A/B. Le test s'arrête à 10 jours, l'impact revenu se voit la semaine 2, la projection LTV se met à jour le jour 30. En fréquentiste, cet agenda s'étire à 8–12 semaines.

## Conclusion : Esprit de Tarification Probabiliste

Dans le F2P mobile, le test de prix n'est plus binaire, c'est un processus de mise à jour postérieure continu. Au lieu de résoudre conversion et revenu avec des p-values distinctes, les modéliser ensemble dans un cadre probabiliste minimize le regret, raccourcit le test, et active l'optimisation par segment. L'approche bayésienne exige la discipline de construire l'a priori, mais en contrepartie offre le droit à une décision précoce, l'intégration LTV et Thompson sampling pour l'allocation dynamique. Si ta stack IAP dépasse 5+ paliers et que le budget UA mensuel franchit $100K+, l'infrastructure de test bayésienne n'est plus optionnelle, elle devient obligatoire.