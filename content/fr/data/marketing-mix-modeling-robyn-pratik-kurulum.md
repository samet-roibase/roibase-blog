---
title: "Marketing Mix Modeling : Configuration Pratique avec Robyn"
description: "Mettre en place le framework Robyn de Meta pour le MMM : courbes de saturation, décroissance adstock, validation holdout. Code R et intégration BigQuery inclus."
publishedAt: 2026-07-24
modifiedAt: 2026-07-24
category: data
i18nKey: data-005-2026-07
tags: [marketing-mix-modeling, robyn, attribution, data-science, bigquery]
readingTime: 8
author: Roibase
---

L'attribution s'effondre depuis trois ans. iOS 14.5, Consent Mode v2, retrait des cookies tiers — tous ces changements laissent le spécialiste marketing face à une seule question : quel canal fonctionne vraiment ? Le Marketing Mix Modeling (MMM) est une réponse statistique qui casse la dépendance aux cookies et pixels, travaillant sur les données agrégées au niveau global. Le framework Robyn open-source de Meta transforme le MMM d'un exercice académique en un pipeline exploitable en production. Cet article fournit des étapes concrètes pour configurer Robyn à partir de zéro, interpréter les courbes de saturation, ajuster les paramètres de décroissance adstock et tester le modèle avec la validation holdout.

## Qu'est-ce que le MMM et pourquoi c'est critique maintenant

Le Marketing Mix Modeling explique statistiquement par régression la relation entre dépenses médias et ventes ou conversions. Il ne demande pas de données au niveau utilisateur — il fonctionne avec des métriques agrégées chaque semaine ou jour : dépenses totales, impressions, ventes. Le modèle calcule la contribution marginale (incrementality) de chaque canal et montre lequel entre en saturation.

L'attribution last-click classique est basée sur les pixels — elle crédite le dernier canal cliqué par l'utilisateur. Le MMM, au contraire, observe tous les canaux dans la même fenêtre temporelle et isole la corrélation. Par exemple, s'il existe un délai de 3 semaines entre une publicité TV et une vente (effet de carryover), le modèle capture ce délai avec le paramètre « adstock ». La courbe de saturation montre les rendements décroissants : les premiers 100 000 TL de dépenses génèrent 50 conversions, tandis que les 100 000 TL suivants n'en génèrent que 20.

Robyn présente ce framework mathématique sous forme d'un package R entraîné sur les données de campagne propres à Meta. Il inclut une régression ridge bayésienne, un algorithme évolutionnaire multi-objectifs (MOEA) pour l'ajustement des hyperparamètres, et l'optimisation Nevergrad. Le setup n'est pas manuel — après préparation des données, 50 lignes de code R produisent un modèle.

## Préparation des données : de BigQuery à Robyn

Robyn attend un seul CSV/data.frame en entrée. Chaque ligne est une période (semaine ou jour), chaque colonne est une dépense de canal, un nombre d'impressions ou une métrique de ventes. Il n'accepte pas les données manquantes — s'il y a des cellules vides, il faut faire une imputation. Le schéma minimum est le suivant :

| date       | tv_spend | fb_spend | google_spend | revenue | control_var |
|------------|----------|----------|--------------|---------|-------------|
| 2024-01-01 | 50000    | 12000    | 8000         | 120000  | 0.8         |
| 2024-01-08 | 55000    | 13000    | 9000         | 135000  | 0.9         |

Pour extraire ces données de BigQuery, utilise une requête d'agrégation hebdomadaire :

```sql
SELECT
  DATE_TRUNC(event_date, WEEK) AS date,
  SUM(IF(channel = 'tv', spend, 0)) AS tv_spend,
  SUM(IF(channel = 'facebook', spend, 0)) AS fb_spend,
  SUM(IF(channel = 'google', spend, 0)) AS google_spend,
  SUM(revenue) AS revenue,
  AVG(seasonality_index) AS control_var
FROM `project.dataset.marketing_events`
WHERE event_date BETWEEN '2022-01-01' AND '2024-12-31'
GROUP BY 1
ORDER BY 1
```

La variable de contrôle (tendance, saisonnalité, indicateur macroéconomique) n'est pas obligatoire mais améliore le pouvoir explicatif du modèle. Par exemple, si janvier est un mois de soldes en vente au détail, ajoute une variable muette. Robyn intègre ces variables dans la régression comme baseline « organique ».

Pour importer les données dans R, utilise le package `bigrquery` :

```r
library(bigrquery)
bq_auth(path = "service-account-key.json")
sql <- "SELECT date, tv_spend, fb_spend, google_spend, revenue FROM ..."
df <- bq_project_query("your-project-id", sql) %>% bq_table_download()
```

Pour vérifier la conformité au format de Robyn, la fonction `robyn_inputs()` valide le schéma. La colonne de date doit être de classe Date, les métriques doivent être numériques.

## Configuration du modèle Robyn : adstock et saturation

Le cœur de Robyn réside dans les fonctions `robyn_inputs()` et `robyn_run()`. La première étape est de définir les entrées du modèle :

```r
library(Robyn)

InputCollect <- robyn_inputs(
  dt_input = df,
  date_var = "date",
  dep_var = "revenue",
  dep_var_type = "revenue",
  prophet_vars = c("trend", "season", "holiday"),
  prophet_country = "TR",
  paid_media_spends = c("tv_spend", "fb_spend", "google_spend"),
  paid_media_vars = c("tv_spend", "fb_spend", "google_spend"),
  context_vars = c("control_var"),
  adstock = "geometric",
  window_start = "2022-01-01",
  window_end = "2024-10-31"
)
```

**Choix du type d'adstock :**
- `geometric` : Le plus courant. Taux de décroissance constant (par exemple, 80 % reste chaque semaine). Approprié pour TV, display.
- `weibull` : Décroissance asymétrique — baisse rapide au début, puis ralentissement. Logique pour vidéo, campagnes influenceurs.

La formule de l'adstock géométrique :

```
transformed_value[t] = spend[t] + theta * transformed_value[t-1]
```

`theta` est le taux de décroissance (entre 0 et 1). Robyn optimise automatiquement ce paramètre, mais tu peux définir une plage manuelle :

```r
hyperparameters <- list(
  tv_spend_alphas = c(0.5, 3),       # coefficient de courbe de saturation
  tv_spend_gammas = c(0.3, 1),       # point d'inflexion de saturation
  tv_spend_thetas = c(0, 0.5),       # taux de décroissance adstock
  fb_spend_alphas = c(0.5, 3),
  fb_spend_gammas = c(0.3, 1),
  fb_spend_thetas = c(0, 0.3)
)

InputCollect <- robyn_inputs(
  InputCollect = InputCollect,
  hyperparameters = hyperparameters
)
```

**Paramètres de saturation :**
- `alpha` : Forme de la courbe. Alpha élevé → saturation tardive.
- `gamma` : Point d'inflexion — 0.5 signifie une courbure au point médian.

Saturation via l'équation de Hill :

```
response = spend^alpha / (gamma^alpha + spend^alpha)
```

Robyn optimise ces paramètres avec un algorithme évolutionnaire. Il génère 2000 modèles et sélectionne les meilleurs compromis à partir de la frontière de Pareto (équilibre entre R² et NRMSE).

## Exécution du modèle et interprétation des résultats

Pour lancer le modèle Robyn :

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  cores = 8
)
```

La sortie est une liste — chaque itération a un ensemble d'hyperparamètres différents. Robyn sélectionne automatiquement les 3 meilleurs modèles (Pareto optimal). Les résultats sont :

```r
OutputModels$resultHypParam    # paramètres de tous les modèles
OutputModels$xDecompAgg        # décomposition des contributions par canal
OutputModels$resultCalibration # score de validation holdout
```

**Exemple de tableau de décomposition :**

| channel      | total_spend | total_response | roi   | mean_response |
|--------------|-------------|----------------|-------|---------------|
| tv_spend     | 2400000     | 1800000        | 0.75  | 15000         |
| fb_spend     | 600000      | 720000         | 1.20  | 6000          |
| google_spend | 400000      | 560000         | 1.40  | 4667          |

**Interprétation du ROI :** Facebook 1.20 — chaque 1 TL dépensé génère 1.20 TL de retour. TV 0.75 — ce n'est pas un ROI négatif, mais une contribution supplémentaire de 0.75 TL au-dessus de la baseline. Robyn mesure l'« incrementality », pas le crédit last-click.

**Détection de saturation :** Robyn trace la courbe de saturation :

```r
robyn_onepagers(InputCollect, OutputModels, select_model = "2_100_3")
```

Sur le graphique, observe où la courbe s'aplatit quand les dépenses augmentent. Par exemple, si les dépenses TV dépassent 80 000 TL, le gain marginal baisse de 50 % — c'est un signal critique pour l'optimisation budgétaire.

## Validation holdout et fiabilité du modèle

Pour qu'un modèle MMM soit utilisable en production, divise les données historiques : ensemble d'entraînement (par exemple, janvier 2022 à octobre 2024) + ensemble holdout (novembre-décembre 2024). Le modèle s'entraîne sur l'ensemble d'entraînement et se teste sur l'ensemble holdout. Si le MAPE (erreur absolue moyenne en pourcentage) est inférieur à 10 %, le modèle est fiable.

Robyn effectue automatiquement la validation holdout :

```r
InputCollect <- robyn_inputs(
  InputCollect = InputCollect,
  window_start = "2022-01-01",
  window_end = "2024-10-31",
  rollingWindowStartWhich = 52,  # les 52 dernières semaines en holdout
  rollingWindowEndWhich = 4
)
```

Le résultat se trouve dans le tableau `resultCalibration` :

| model_id  | nrmse_train | nrmse_val | decomp.rssd |
|-----------|-------------|-----------|-------------|
| 2_100_3   | 0.08        | 0.12      | 0.05        |

**NRMSE (erreur quadratique moyenne normalisée) :** Plus bas → mieux. 0.12 est acceptable (inférieur à 0.15 est production-ready).
**decomp.rssd :** Cohérence de la décomposition entre entraînement et validation. 0.05 → 5 % de déviation → modèle stable.

Si la validation holdout échoue, deux possibilités : (1) Données insuffisantes — au minimum 2 ans de données hebdomadaires. (2) Variable manquante — ajoute saisonnalité, dépenses des concurrents, changements de prix, etc.

## Lier la sortie Robyn au mécanisme de décision

Pour réimporter les résultats de Robyn dans BigQuery, exporte le tableau de décomposition en CSV :

```r
write.csv(OutputModels$xDecompAgg, "robyn_output.csv")
```

Charge-le dans BigQuery :

```sql
LOAD DATA OVERWRITE `project.dataset.mmm_results`
FROM FILES (
  format = 'CSV',
  uris = ['gs://bucket/robyn_output.csv']
);
```

Ce tableau se connecte à un tableau de bord (Looker, Tableau) ou à un optimiseur budgétaire. Par exemple, utilise un modèle dbt pour calculer le seuil de saturation :

```sql
WITH saturation AS (
  SELECT
    channel,
    total_spend,
    roi,
    total_spend / NULLIF(roi, 0) AS optimal_spend
  FROM `project.dataset.mmm_results`
)
SELECT * FROM saturation WHERE roi > 1.0 ORDER BY roi DESC;
```

Cette requête classe les canaux avec ROI > 1 — une liste de priorités pour augmenter le budget. Robyn a aussi une fonction d'allocateur budgétaire :

```r
AllocatorCollect <- robyn_allocator(
  InputCollect = InputCollect,
  OutputCollect = OutputModels,
  select_model = "2_100_3",
  scenario = "max_response",
  channel_constr_low = c(0.7, 0.7, 0.7),
  channel_constr_up = c(1.5, 1.5, 1.5)
)
```

La sortie recommande un nouveau budget pour chaque canal. Les contraintes maintiennent chaque canal entre 70 % et 150 % de ses dépenses actuelles (évite les changements soudains qui créent du risque opérationnel).

La mise en place d'une [Stratégie de Contenu Géo](https://www.roibase.com.tr/fr/geo) est critique pour le MMM — la qualité des données alimentant Robyn affecte directement la fiabilité du modèle. Le suivi des événements côté serveur, la résolution d'identité et l'intégration du mode consentement sont essentiels ; sans eux, des biais apparaissent au niveau de l'agrégation.

## Pièges rencontrés et atténuation

**Multicollinearité :** Si deux canaux sont toujours actifs simultanément (par exemple, TV + Facebook toujours ensemble), le modèle ne peut pas séparer les contributions. Utilise le facteur d'inflation de variance (VIF) :

```r
library(car)
vif_model <- lm(revenue ~ tv_spend + fb_spend + google_spend, data = df)
vif(vif_model)
```

VIF > 5 → problème. Solutions : (1) Arrête temporairement un canal et fais un test holdout. (2) Collecte une série temporelle plus longue.

**Incertitude sur le délai de décalage :** Si le paramètre adstock est mal réglé (par exemple, 4 semaines au lieu d'1 pour TV), le modèle donne des résultats trompeurs. Valide la durée de décroissance réelle avec un A/B test