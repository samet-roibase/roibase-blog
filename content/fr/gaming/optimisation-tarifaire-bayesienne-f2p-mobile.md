---
title: "Optimisation tarifaire Bayésienne en F2P mobile"
description: "Dépasser les tests A/B fréquentistes pour les IAP : utiliser l'estimation postérieure pour construire une échelle tarifaire par segment et générer de la croissance de revenu."
publishedAt: 2026-07-08
modifiedAt: 2026-07-08
category: gaming
i18nKey: gaming-002-2026-07
tags: [optimisation-bayesienne, tarification-iap, monetisation-f2p, jeux-mobiles, retention-engineering]
readingTime: 9
author: Roibase
---

Dans les jeux F2P mobiles, les décisions tarifaires des IAP reposent généralement sur un mélange « intuition + benchmarking concurrentiel ». En 2026, cette approche n'est plus suffisante. Le trafic provenant des Apple Search Ads est désormais segmenté : mots-clés haute intention, audiences similaires, requêtes larges. Chaque segment porte un profil WTP (willingness to pay) distinct. Les tests A/B fréquentistes sont trop lents — ils exigent 4 semaines d'attente et 10 000+ utilisateurs pour atteindre 95 % de confiance. L'optimisation tarifaire Bayésienne, en revanche, permet de décider sur la base d'une distribution postérieure dès les premiers 1 000 conversions.

## Le point d'arrêt des tests A/B fréquentistes en tarification IAP

Les tests A/B classiques fonctionnent ainsi : vous divisez 50/50 deux paliers de prix ($4,99 vs $6,99), attendez 4 semaines, puis vérifiez la p-value via un test du chi-carré. Le problème : dans un jeu mobile, la cohorte change rapidement. Avec un churn de 68 % à J7, les utilisateurs restants à la 4e semaine du test ne reflètent plus le profil de la 1re semaine. De plus, l'information de segment est perdue — un utilisateur provenant des Apple Search Ads et un utilisateur organique se retrouvent dans le même bucket de test.

Le deuxième problème du test fréquentiste est la règle d'arrêt : si vous décidez trop tôt, vous commettez une erreur de « peeking », si vous attendez trop longtemps, une mise à jour du contexte (nouvelle créative, mise à jour ASO) invalide le test. Ce cycle n'est pas tenable en jeux mobiles.

Le troisième problème : l'hypothèse de résultat binaire. Le test fréquentiste répond à « quel prix gagne ? » mais pas à « quel segment préfère quel prix ? ». Sans une distribution postérieure spécifique à chaque segment, il est impossible de construire une échelle tarifaire graduée.

## Framework Bayésien : Prior, Likelihood, Postérieur

L'approche Bayésienne repose sur cette formule :

```
P(θ | data) ∝ P(data | θ) × P(θ)
```

- **P(θ) :** Prior — distribution WTP issue des données historiques du jeu ou de catégories similaires
- **P(data | θ) :** Likelihood — conversions IAP observées
- **P(θ | data) :** Postérieur — mise à jour du prior par les données actuelles

Pour un test tarifaire IAP, soit θ = {$4,99 ; $6,99 ; $9,99} les points tarifaires. Définissez une distribution Beta(α, β) pour chaque prix. Par exemple, pour $4,99 avec α=20, β=80 (conversion historique de 20 %). Quand arrivent les 500 premières impressions, ajoutez les conversions observées pour chaque prix au prior Beta :

```python
# $4,99 : 500 impressions, 110 conversions
alpha_post = 20 + 110
beta_post = 80 + (500 - 110)
# Postérieur : Beta(130, 470)
```

Échantillonnez cette distribution postérieure par Monte Carlo pour calculer le revenu attendu :

```python
samples = np.random.beta(130, 470, size=10000)
revenue_4_99 = samples * 4.99
mean_revenue = revenue_4_99.mean()
```

L'avantage de l'approche Bayésienne : vous pouvez décider dès 500 conversions — si l'intervalle de confiance s'est resserré, arrêtez le test ; s'il reste large, continuez. La règle d'arrêt est flexible, pas d'erreur de peeking.

## Construire une échelle tarifaire par segment

En F2P mobile, offrir un prix unique à tous les utilisateurs est sous-optimal. Le trafic obtenu via [Optimisation pour l'App Store](https://www.roibase.com.tr/fr/aso) contient des niveaux d'intention distincts : les mots-clés de marque donnent 8 % CVR tandis que les mots-clés génériques n'en donnent que 1,2 %. Vous pouvez maintenir une distribution postérieure distincte pour chaque segment.

Exemple de segmentation :

| Segment | Prior (α, β) | Conversions observées | Postérieur (α', β') | WTP moyen |
|---|---|---|---|---|
| Mots-clés de marque | (30, 70) | 48/200 | (78, 222) | $7,20 |
| Mots-clés génériques | (12, 88) | 18/300 | (30, 370) | $4,50 |
| Organique | (20, 80) | 35/250 | (55, 295) | $5,80 |

En utilisant ces distributions postérieures, construisez une échelle tarifaire :

- Segment mots-clés de marque → proposez le palier « premium » à $9,99
- Segment mots-clés génériques → proposez le palier « débutant » à $4,99
- Segment organique → proposez le palier « standard » à $6,99

La tarification par segment s'implémente via des feature flags côté serveur. Le SDK IAP Unity transmet l'information de segment au backend, qui renvoie le prix selon la distribution postérieure. Cette architecture est plus dynamique qu'un test A/B — la distribution postérieure se met à jour chaque semaine et l'échelle tarifaire s'optimise automatiquement.

### Échantillonnage de Thompson pour allocation temps réel

Le framework Bayésien n'est pas statique — avec l'échantillonnage de Thompson, vous pouvez équilibrer l'exploration et l'exploitation. À chaque impression IAP :

1. Échantillonnez 1 valeur de la distribution postérieure pour chaque prix
2. Présentez à l'utilisateur le prix qui génère le revenu attendu maximal
3. Ajoutez le résultat de la conversion à la distribution postérieure

Cette méthode minimise le regret — c'est-à-dire le coût des impressions servies à un prix non optimal. Après 10 000 impressions, l'échantillonnage de Thompson génère 12-18 % de hausse de revenu supplémentaire (benchmark : résultats des tests King sur Candy Crush Saga en 2025).

## Points critiques en estimation postérieure

Le point sensible de l'approche Bayésienne est le choix du prior. Un prior trop faible (α=1, β=1 uniforme) rend la distribution postérieure instable sur les 100 premières conversions. Un prior trop fort (α=100, β=400) ralentit la mise à jour du prior par les nouvelles données.

La bonne source pour le prior : les 30 premiers jours de données de cohort d'un jeu antérieur ou d'une catégorie similaire. En l'absence de données, utilisez un benchmark secteur mais avec un prior faible (α=5, β=20).

Deuxième point : le nombre de segments. Créer 10 segments vous oblige à mettre à jour chaque distribution postérieure séparément — ce qui cause une raréfaction des données et élargit les intervalles de confiance. Gardez 3-5 segments. Pour plus de granularité, utilisez un modèle Bayésien hiérarchique (HBM) — prior au niveau de la catégorie, postérieur au niveau du segment.

Troisième point : le choix de la métrique de revenu. Les conversions IAP sont binaires, mais le revenu est continu. La distribution Beta convient pour les conversions, mais pour la modélisation du revenu, utilisez une distribution Gamma ou log-normale. Pour l'estimation du revenu postérieur :

```python
# Pour Gamma(shape=α, rate=β), revenu moyen
mean_revenue = (alpha_post / beta_post) * price
```

## Impact sur le churn et la LTV

L'optimisation tarifaire Bayésienne ne se limite pas à la première conversion IAP — la tarification par segment affine la sensibilité au prix et réduit le churn. Un segment surprix souffre d'un churn 22 % plus élevé (retention J30 : -8 %). Un segment sous-prix plafonne la LTV — l'utilisateur habitué à $4,99 résiste à passer au palier $9,99.

Une échelle tarifaire bien calibrée réduit le churn car chaque segment voit un prix aligné sur son seuil de valeur perçue. Cet effet se mesure par analyse de cohorte :

- Cohorte avec échelle tarifaire Bayésienne : retention J30 de 38 %, ARPU de $12,50
- Cohorte avec prix statique : retention J30 de 34 %, ARPU de $11,20

Hausse de revenu : $12,50 - $11,20 = $1,30 par utilisateur. Pour 100 000 MAU, cela crée une différence de $130 000/mois.

## Implémentation opérationnelle

Déployer l'optimisation tarifaire Bayésienne en production nécessite cette pile technique :

- **Tracking d'événements :** impressions IAP + conversions (Adjust/AppsFlyer)
- **Moteur Bayésien :** Python + PyMC3 ou Stan (mise à jour postérieure quotidienne)
- **Feature flag :** LaunchDarkly ou backend personnalisé (mapping segment → prix)
- **Monitoring :** dashboard de convergence postérieure (Looker/Metabase)

Pendant les 2 premières semaines, lancez en mode shadow — le moteur Bayésien propose des prix mais la production conserve la tarification statique. Une fois la distribution postérieure stabilisée (intervalle de confiance < 10 %), bascule à la production.

Important : bien que le modèle Bayésien se mette à jour en continu, les changements de prix ne doivent pas être quotidiens. Établissez un cycle de révision hebdomadaire — ajustez le prix si le postérieur montre un décalage > 15 %, sinon attendez. Présenter un prix incohérent à l'utilisateur détruit la confiance.

---

L'optimisation tarifaire Bayésienne n'est plus expérimentale en F2P mobile — King, Supercell et Playrix l'utilisent en production. Même si le framework semble complexe au départ, la mise à jour postérieure est un processus mécanique. Avec le bon prior et une stratégie de segmentation solide, 6-8 semaines suffisent pour atteindre une hausse de revenu de 10-15 %. Revenir à une tarification statique est désormais sous-optimal.