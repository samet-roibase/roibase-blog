---
title: "Marketing Mix Modeling : Configuration Pratique avec Robyn"
description: "Nous montrons comment configurer la bibliothèque MMM open-source de Meta, Robyn, en production : courbes de saturation, décroissance adstock et validation holdout sur données réelles."
publishedAt: 2026-07-07
modifiedAt: 2026-07-07
category: data
i18nKey: data-005-2026-07
tags: [marketing-mix-modeling, robyn, adstock, saturation-curve, media-attribution]
readingTime: 9
author: Roibase
---

Les modèles d'attribution multi-touch perdent en fiabilité à l'ère post-cookie, tandis que le marketing mix modeling regagne du terrain. Les outils MMM open-source de Google et Meta (LightweightMMM, Robyn) permettent aux responsables marketing de mesurer l'efficacité des canaux au niveau agrégé. Depuis février 2025, Robyn 3.11 associe optimisation bayésienne et recherche d'hyperparamètres parallélisée, le rendant opérationnel en production. Cet article explore trois concepts fondamentaux : la courbe de saturation (rendements décroissants), la décroissance adstock (effet différé) et la validation holdout (fiabilité du modèle).

## Qu'est-ce que Robyn et pourquoi c'est décisif maintenant

Robyn est un package R lancé par Meta en 2021 sous licence open-source. Le modèle, construit sur la régression Ridge, accepte des données de dépenses par canal et de conversions agrégées hebdomadairement ou quotidiennement, puis calcule la contribution incrémentale en conversions de chaque canal. La mise à jour majeure de 2024 a intégré les composants de séries temporelles de Prophet et ajouté l'export JSON — permettant aux workflows Python de s'y connecter aussi.

Trois caractéristiques différencient Robyn des autres approches MMM : d'abord, il modélise la relation dépense-conversion non linéairement via la transformation Hill-Adstock (saturation réaliste) ; ensuite, il résout l'optimisation d'hyperparamètres par algorithme génétique et optimiseur sans gradient Nevergrad (pas d'ajustement manuel) ; enfin, il génère automatiquement les métriques de qualité du modèle (NRMSE, DECOMP.RSSD, MAPE). En production, la fonction native de validation holdout est critique — nous la démontrerons ci-dessous.

L'avantage du MMM par rapport à l'attribution : il fonctionne sur données agrégées, donc sans impact des contraintes GDPR/CCPA, et contourne la complexité des parcours multi-appareils. L'inconvénient : il reste à granularité hebdomadaire — pas pour l'optimisation intra-jour mais pour l'allocation budgétaire trimestrielle. Chez Roibase, au sein d'une [architecture données first-party](https://www.roibase.com.tr/fr/firstparty), nous positionnons le MMM aux côtés des résultats de tests d'incrémentalité : un ROAS élevé en MMM ne suffit pas ; il doit être validé par test géographique ou contrôle synthétique.

## Préparation des données : dépenses canal + variables macro

Robyn accepte en entrée une série temporelle hebdomadaire avec au minimum ces colonnes :

```r
# Structure données exemple (2 ans de données hebdomadaires)
data <- data.frame(
  date = seq(as.Date("2024-01-01"), by = "week", length.out = 104),
  revenue = rnorm(104, 50000, 8000),
  facebook_spend = rnorm(104, 5000, 1000),
  google_search_spend = rnorm(104, 7000, 1500),
  display_spend = rnorm(104, 3000, 800),
  competitor_index = rnorm(104, 100, 15),  # variable macro
  holiday_flag = sample(0:1, 104, replace = TRUE)
)
```

**Nombre de colonnes canal :** Minimum 2, maximum 15 recommandés. Au-delà de 20 canaux, le risque de surapprentissage augmente et la stabilité des coefficients baisse. Si vous avez des canaux de niches (affiliation, influenceurs, podcasts), mieux vaut les agréger dans une colonne `other_digital`.

**Variable macro :** Ajoutez des variables de contrôle — saisonnalité, jours fériés, indice concurrentiel, indicateur économique — sinon le modèle attribuera toute hausse de conversions aux médias. L'intégration de Prophet dans Robyn capture automatiquement tendance et jours fériés, mais un choc externe sectorialisé (Black Friday, Ramadan) mérite un flag explicite.

**Contrôles qualité données :**
- Aucune colonne ne doit avoir variance nulle (dépense constante = inutile)
- Tolérance valeurs manquantes : max 5% — Robyn n'impute pas automatiquement
- Granularité hebdomadaire préférée — journalière ajoute du bruit, mensuelle appauvrit les observations

Si vos données de dépenses proviennent de sources disparates (Google Ads API, Meta Marketing API, système finance interne), installez un processus ETL. Chez Roibase, une table `marketing_spend_weekly` dans BigQuery se met à jour chaque lundi matin via un modèle dbt, que nos scripts R consultent. L'importance du [processus d'analyse données](https://www.roibase.com.tr/fr/verianalizi) en amont ne peut être surestimée.

## Saturation et adstock : la transformation Hill-Adstock

Robyn applique à chaque dépense canal une transformation à deux étapes : d'abord l'adstock (effet différé), puis la saturation (rendements décroissants).

### Adstock decay (géométrique ou Weibull)

Une pub TV ne disparaît pas instantanément — elle persiste quelques semaines dans la mémoire du spectateur. L'adstock le modélise. Robyn supporte deux types : `geometric` (simple, décroissance exponentielle) et `weibull` (flexible, courbe en S).

**Adstock géométrique :**

```
adstocked_spend[t] = spend[t] + θ × adstocked_spend[t-1]
```

Ici `θ` (thêta) est le taux de décroissance — 0.5 signifie que 50% de l'effet de la semaine précédente se reporte à cette semaine. Robyn cherche automatiquement ce paramètre entre 0 et 0.9.

**Adstock Weibull :** Plus complexe — dispose de paramètres shape et scale. Pour TV, affichage, influenceurs (canaux "awareness"), Weibull s'ajuste mieux car l'effet peut croître lentement puis culminer avant de décliner rapidement.

**Conseil pratique :** Commencez par adstock géométrique — convergence plus rapide. Si performance du modèle faiblit (NRMSE > 0,15) et si le mix inclut beaucoup d'awareness, testez Weibull.

### Saturation : la fonction Hill

Doubler votre dépense ne double pas les conversions — rendements décroissants. Robyn modélise cela par l'équation de Hill :

```
effect = spend^α / (K^α + spend^α)
```

- `α` (alpha) : inclinaison de la courbe — petit = saturation lente, grand = saturation rapide
- `K` : point de demi-saturation — à ce niveau de dépense, vous atteindrez 50% de l'effet maximal

Robyn trouve ces deux paramètres pour chaque canal pendant la recherche d'hyperparamètres. Résultat : vous visualisez la "courbe de réponse" de chaque canal — par exemple Facebook Ads s'aplatit après 10K€, tandis que Google Search reste linéaire jusqu'à 20K€.

**À quoi sert la courbe de saturation :** Aux scénarios de réallocation budgétaire. Si la pente d'un canal est déjà plate (zone saturée), couper son budget et l'allouer à un canal avec pente plus raide améliore le ROAS global.

## Exécution du modèle et tuning d'hyperparamètres

L'installation Robyn est minimale :

```r
install.packages("Robyn")
library(Robyn)
```

Vous définissez la structure données via `robyn_inputs()` :

```r
InputCollect <- robyn_inputs(
  dt_input = data,
  date_var = "date",
  dep_var = "revenue",
  paid_media_spends = c("facebook_spend", "google_search_spend", "display_spend"),
  context_vars = c("competitor_index", "holiday_flag"),
  window_start = "2024-01-01",
  window_end = "2025-12-31",
  adstock = "geometric"  # ou "weibull"
)
```

**Ranges d'hyperparamètres :**
Robyn cherche les valeurs adstock theta et saturation alpha/K pour chaque canal dans une plage que vous spécifiez. Les ranges par défaut suffisent généralement, mais si vous avez du domain knowledge, vous pouvez ajouter des contraintes :

```r
hyperparameters <- list(
  facebook_spend_alphas = c(0.5, 3),   # pente saturation
  facebook_spend_gammas = c(0.3, 1),   # inflexion saturation
  facebook_spend_thetas = c(0, 0.5)    # adstock decay (géométrique)
)
```

Exécution du modèle :

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,     # itérations de l'algorithme génétique
  trials = 5,            # nombre de seeds aléatoires
  cores = 4
)
```

Cette étape prend 10–30 minutes (selon la taille). Elle retourne un ensemble de modèles Pareto-optimaux — compromis entre qualité d'ajustement (NRMSE) et lissitude de la décomposition (DECOMP.RSSD).

**Sélection du modèle :** Robyn propose 10–20 modèles Pareto. Choisir le NRMSE le plus bas ne convient pas toujours — certains modèles surapprendraient. L'argument `robyn_clusters` de `robyn_outputs()` regroupe les modèles et sélectionne le centre du groupe le plus stable.

## Validation holdout : mesurer la fiabilité du modèle

La validation holdout est la fonctionnalité la plus critique de Robyn. Durant l'entraînement, vous réservez les N dernières semaines, puis générez des prédictions pour cette période et les comparez aux valeurs réelles.

```r
# Réserver les 8 dernières semaines en test
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  cores = 4,
  calibration_input = NULL,
  holdout_periods = 8  # 8 dernières semaines en test
)
```

Les résultats holdout se trouvent dans `OutputModels$resultHypParam` :

| Model ID | Train NRMSE | Holdout MAPE | Holdout NRMSE |
|---|---|---|---|
| 1_123_4 | 0.08 | 12.3% | 0.14 |
| 2_456_1 | 0.07 | 18.5% | 0.21 |

**Holdout MAPE < 15%** est généralement considéré production-ready. Au-delà de 20%, le pouvoir de prédiction future du modèle faiblit — soit problème de qualité données, soit hyperparamètres trop larges.

**Piège pratique :** Si la période holdout contient un outlier majeur (panne plateforme, campagne virale), le modèle ne peut pas le prédire et MAPE explose. Décalez alors la période holdout et réévaluez, ou marquez cette semaine comme anomalie.

Un bénéfice collatéral de la validation holdout : cross-check avec résultats d'expériences d'incrémentalité. Si MMM affiche 30% ROAS pour Facebook mais qu'un ancien test géographique montrait 15%, c'est que le MMM attribue probablement à Facebook un effet macro corrélé (saisonnalité, tendance organique). Nous détectons ces incohérences en reliant les outputs MMM aux dashboards d'expériences au sein du processus [CDP & retention engineering](https://www.roibase.com.tr/fr/retention-engineering-cdp).

## Optimisation budgétaire et planification de scénarios

Après construction du modèle Robyn, deux usages principaux : **réallocation budgétaire** (répartition optimale) et **scénarios contrefactuels** (que se passe-t-il si budget +20%).

**Allocateur budgétaire :**

```r
AllocatorCollect <- robyn_allocator(
  InputCollect = InputCollect,
  OutputCollect = OutputModels,
  select_model = "1_123_4",  # modèle Pareto choisi
  scenario = "max_response",  # ou "target_efficiency"
  channel_constr_low = 0.7,   # min 70% du budget actuel par canal
  channel_constr_up = 1.5     # max 150%
)
```

La sortie propose, pour chaque canal, nouveau budget et revenu incrémental attendu :

| Canal | Actuel | Recommandé | Δ | Revenue Incr. |
|---|---|---|---|---|
| Facebook | 5K€ | 4.2K€ | -16% | -800€ |
| Google Search | 7K€ | 9.1K€ | +30% | +3.2K€ |
| Display | 3K€ | 2.7K€ | -10% | -200€ |

Ce tableau dit : "Si vous augmentez Google Search de 30% et réduisez Facebook de 16%, vous gagnerez 2.2K€ de revenu total." Les contraintes (low/up) préviennent les changements radicaux — réduire un canal de 50% du jour au lendemain porte risque opérationnel.

**Planification de scénarios :** Avec le paramètre `expected_spend`, vous variez le budget total et obtenez la répartition optimale pour ce scénario. Par exemple, si Q4 accorde +25% de budget, Robyn vous donne la décomposition par canal pour ce cas.

Chez Roibase, nous exportons les outputs MMM vers Google Sheets ou Looker Studio — le CMO visualise les recommandations du modèle lors de la réunion budgétaire hebdomadaire. Export JSON :

```r
robyn_write(InputCollect, OutputModels, select_model = "1_123_4", export = TRUE)
```

Cela génère un fichier `Robyn_[timestamp].json` contenant tous hyperparamètres, coefficients et données de courbe de réponse. Lisez-le en Python et construisez notifications Slack ou rapports email.

## Rafraîchissement du modèle et versioning

Le MMM n'est pas statique — vous devez le réentraîner chaque trimestre avec les nouvelles données. Rob