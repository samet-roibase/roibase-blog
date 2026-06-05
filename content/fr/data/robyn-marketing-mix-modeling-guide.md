---
title: "Marketing Mix Modeling : Configuration pratique avec Robyn"
description: "Framework MMM open-source de Meta, Robyn, pour modéliser saturation, adstock et validation holdout avec code R et structure de données éprouvée."
publishedAt: 2026-06-05
modifiedAt: 2026-06-05
category: data
i18nKey: data-005-2026-06
tags: [marketing-mix-modeling, robyn, adstock, saturation-curve, incrementality]
readingTime: 9
author: Roibase
---

Dans un monde de mesure post-cookies, l'attribution perd chaque jour davantage de signal. Avec iOS 17.4 et même SKAdNetwork qui peine à restituer le véritable ROAS, les responsables de budget marketing se tournent vers des modèles économétriques pour mesurer la contribution réelle des canaux. Le Marketing Mix Modeling (MMM), méthode statistique développée dans les années 1960 pour la publicité télévisée, reprend une place centrale en 2026 aux côtés de la mesure server-side et des data lakes propriétaires. **Robyn**, publié en open-source par Meta en 2021, accélère l'application de cette méthodologie basée sur la régression en y ajoutant l'apprentissage automatique moderne et l'optimisation bayésienne.

## Pourquoi MMM est critique aujourd'hui

Le modèle last-click s'effondre avec la perte de cookies, tandis que l'attribution multi-touch (MTA) devient impraticable à cause de la nécessité de données au niveau événement — impossible après le RGPD et l'ATT. L'*attribution data-driven* de Google Analytics 4 s'appuie sur le machine learning mais fonctionne seulement dans l'écosystème Google. Or, 60 % du budget marketing se situe en dehors de Google : Meta, TikTok, display programmatique, TV hors ligne, sponsorships.

MMM repose sur des données **agrégées** par semaine ou par jour, non sur le suivi au niveau utilisateur. Le modèle de régression extrait la relation entre les dépenses de chaque canal et les ventes (ou conversions). Deux hypothèses fondamentales soutiennent le modèle : la **saturation** (les dépenses croissantes génèrent un rendement marginal décroissant) et l'**adstock** (la publicité d'aujourd'hui impacte les semaines futures). Ces hypothèses sont statistiques mais reflètent la réalité commerciale. Robyn vise à trouver automatiquement ces deux paramètres via optimisation bayésienne des hyperparamètres. Depuis fin 2024 (v3.11+), l'ajout de **ridge regression** et de **décomposition de série temporelle Prophet** a amélioré la précision saisonnière du modèle.

Une autre caractéristique critique de Robyn est la **validation holdout** : le modèle s'entraîne sur 12 semaines passées et prédit les 4 semaines suivantes pour mesurer l'erreur hors échantillon. Cela prévient l'overfitting et démontre que le modèle apprend réellement les canaux. Les solutions MMM de Google (Meridian) et de Facebook utilisent des approches similaires mais sont à source fermée et coûteuses. Robyn offre accès gratuit à la même méthodologie.

## Structure des données et préparation

Pour exécuter Robyn, les données doivent être au format suivant : chaque ligne représente une unité de temps (jour ou semaine), chaque colonne une dépense de canal ou une métrique de conversion. Un minimum de 104 semaines (2 ans) est recommandé, car la signification statistique des coefficients de régression dépend de la taille de l'échantillon. Avec moins de 52 semaines, tu rencontres des problèmes de convergence du modèle.

```r
# Exemple de structure — données agrégées hebdomadaires extraites de BigQuery
df <- data.frame(
  DATE = seq.Date(from = as.Date("2024-01-01"), by = "week", length.out = 104),
  revenue = runif(104, 80000, 150000),
  google_search_spend = runif(104, 5000, 15000),
  meta_spend = runif(104, 8000, 20000),
  tiktok_spend = runif(104, 2000, 8000),
  tv_grp = runif(104, 50, 200),
  organic_sessions = runif(104, 10000, 30000),
  competitor_index = runif(104, 0.8, 1.2)
)
```

**Détails importants :**
- La colonne `DATE` doit être au format Date, pas en chaîne de caractères
- La revenue ou la conversion entre comme variable cible dans le modèle (variable dépendante)
- Les canaux (`google_search_spend`, `meta_spend`) sont des colonnes **paid media** — l'adstock et la saturation s'y appliquent
- Les variables comme `organic_sessions` et `competitor_index` sont des variables **organiques / contrôle** — aucune transformation ne leur est appliquée, elles servent à l'extraction de baseline
- Pour les canaux hors ligne comme la TV, normalise les données en GRP, reach ou minutes regardées

Robyn ne fonctionne pas avec des étiquettes prédéfinies comme `facebook_spend` ; tu définis toi-même les noms de colonnes, mais tu dois spécifier dans la fonction `InputCollect()` quelles colonnes sont paid et lesquelles sont organiques.

Si tu n'as pas construit une [architecture de données propriétaires](https://www.roibase.com.tr/fr/firstparty), la collecte de ces données est difficile. GTM server-side, export brut de GA4, APIs Meta / Google Ads, données de ventes du CRM — tu dois tout fusionner dans BigQuery et faire un rollup hebdomadaire. Lorsque nous construisons ce pipeline ETL avec dbt, nous produisons un tableau `fact_marketing_weekly` prêt pour MMM.

## Configuration de saturation et adstock

La force de Robyn réside dans sa capacité à optimiser **séparément** la courbe de saturation et les paramètres d'adstock pour chaque canal. La saturation est modélisée par la fonction Hill :

```
effect = spend^alpha / (spend^alpha + half_saturation^alpha)
```

Le paramètre `alpha` détermine la concavité de la courbe, et `half_saturation` le niveau de dépense auquel l'effet atteint son point médian. Les canaux basés sur l'intention comme Google Search saturent rapidement (`alpha` bas, `half_saturation` bas). Les canaux de sensibilisation de marque (TV, YouTube) saturent tard.

L'adstock modélise l'impact des dépenses passées sur l'effet actuel. L'adstock géométrique est la forme la plus courante :

```
adstocked_spend[t] = spend[t] + theta * adstocked_spend[t-1]
```

Le paramètre `theta` (entre 0 et 1) représente la vitesse de décroissance. Pour la TV, theta est élevé (0,7 à 0,9 — l'effet perdure pendant des semaines), pour la search c'est bas (0,1 à 0,3 — l'effet s'éteint rapidement). Robyn trouve ces paramètres via optimisation Nevergrad, mais tu dois fournir une **plage préalable** :

```r
hyperparameters <- list(
  google_search_spend_alphas = c(0.5, 1.5),
  google_search_spend_gammas = c(0.1, 0.4), # adstock decay
  google_search_spend_thetas = c(0, 0.3),   # adstock theta
  meta_spend_alphas = c(0.5, 2.0),
  meta_spend_gammas = c(0.3, 0.8),
  meta_spend_thetas = c(0.2, 0.6),
  tv_grp_alphas = c(1.0, 3.0),
  tv_grp_gammas = c(0.5, 0.9),
  tv_grp_thetas = c(0.6, 0.9)
)
```

Tu dois déterminer ces plages en utilisant ton expertise métier. Si tu les définis entièrement au hasard, le modèle diverge ou trouve des coefficients absurdes (par exemple, un impact négatif de la TV). La documentation de Robyn propose des plages par défaut, mais teste-les sur tes données avant de les appliquer.

## Entraînement du modèle et validation holdout

Pour exécuter Robyn, tu utilises la fonction `robyn_run()`. À l'intérieur, la bibliothèque **Nevergrad** recherche la meilleure combinaison d'hyperparamètres via optimisation bayésienne. Une exécution typique représente 2 000 itérations x 10 essais = 20 000 entraînements de modèle. Sur un MacBook M1 avec 8 cœurs, cela prend environ 15 minutes.

```r
library(Robyn)

InputCollect <- robyn_inputs(
  dt_input = df,
  date_var = "DATE",
  dep_var = "revenue",
  dep_var_type = "revenue",
  paid_media_vars = c("google_search_spend", "meta_spend", "tiktok_spend"),
  paid_media_spends = c("google_search_spend", "meta_spend", "tiktok_spend"),
  organic_vars = c("organic_sessions"),
  prophet_vars = c("trend", "season", "holiday"),
  window_start = "2024-01-01",
  window_end = "2025-12-31",
  adstock = "geometric",
  hyperparameters = hyperparameters
)

OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 10,
  outputs = FALSE
)
```

Une fois le modèle entraîné, il affiche les solutions **Pareto-optimales**. Robyn optimise deux métriques : NRMSE (*normalized root mean square error*) et decomposition RSSD (*residual sum of squared differences*). Chaque modèle sur la frontière de Pareto représente un compromis : l'un ajuste bien mais a une mauvaise décomposition, l'autre l'inverse. Tu dois sélectionner manuellement le modèle le plus raisonnable.

Pour la validation holdout, tu réserves les 4 à 8 dernières semaines. Robyn le fait automatiquement :

```r
robyn_refresh(
  robyn_object = OutputModels,
  dt_input = df_new, # Actualiser avec nouvelles données
  refresh_steps = 4,
  refresh_mode = "manual"
)
```

Si le MAPE (*mean absolute percentage error*) holdout est inférieur à 10 %, le modèle est considéré comme fiable. Au-delà de 20 %, c'est dangereux — signe d'overfitting ou de variables manquantes.

## Interprétation des résultats et optimisation budgétaire

Le résultat le plus critique de Robyn est le tableau de **contribution par canal**. Il affiche le pourcentage de contribution au chiffre d'affaires et le **ROAS** de chaque canal. Mais attention : ces valeurs de ROAS historiques ne sont pas le ROAS **marginal**. Le ROAS marginal indique le revenu supplémentaire généré par les 1 000 € suivants dépensés et se calcule par la dérivée de la courbe de saturation.

La fonction `budget_allocator()` de Robyn redistribue le budget courant en fonction des courbes de saturation. Si Google Search est saturé, elle transfère le budget excédentaire vers Meta ou TikTok. Cette optimisation trouve le point sur la **courbe de réponse** où le rendement marginal s'équilibre (économie 101 : MR₁ = MR₂).

```r
AllocatorCollect <- robyn_allocator(
  robyn_object = OutputModels,
  select_model = "1_100_2", # ID du modèle sélectionné depuis Pareto
  scenario = "max_response_expected_spend",
  channel_constr_low = c(0.7, 0.7, 0.5), # Au moins 70 % Google, 70 % Meta, 50 % TikTok
  channel_constr_up = c(1.5, 2.0, 3.0),  # Limites d'augmentation maximale
  expected_spend = 100000
)
```

Le résultat montre comment distribuer ton budget de 100 000 € pour maximiser le revenu. Mais c'est une recommandation statique — en réalité, le renouvellement créatif, l'activité concurrentielle et la saisonnalité changent. C'est pourquoi tu dois **rafraîchir MMM chaque mois**.

## Compromis et limites

Contrairement à l'attribution, MMM fonctionne au niveau **agrégé**. Il ne peut pas être utilisé pour la personnalisation. Dans Google Search, Robyn ne peut pas te dire quel mot-clé performe mieux — il mesure seulement la contribution totale de Search. De plus, le modèle est exposé au problème **corrélation ≠ causalité** : si les ventes augmentent en été et que tu augmentes aussi les dépenses TV en été, le modèle peut surévaluer la contribution de la TV.

Pour résoudre ce problème, tu dois **valider MMM avec un test d'incrémentalité**. Un test geo-lift ou holdout mesure le véritable impact causal et le compare aux résultats de MMM. Robyn peut intégrer les résultats d'incrémentalité en tant que paramètre `calibration` — cela fonctionne comme un *prior* bayésien et rapproche le modèle de la réalité.

Un autre défi : **ajouter de nouveaux canaux** au modèle. Si tu ouvres un nouveau canal (par exemple Snapchat) avec seulement 8 semaines de données, Robyn ne peut pas apprendre sa courbe de saturation. Tu devras soit définir un *prior* manuel, soit exclure ce canal pendant les 12 premières semaines avant de l'ajouter.

Enfin, MMM est **le plus puissant quand il combine l'hors ligne et l'en ligne**. Si tu n'inclus pas dans le modèle les dépenses de canaux hors ligne (TV, affichage, sponsorships), le modèle surattribue aux canaux en ligne (*omitted variable bias*). Robyn est flexible : il accepte des variables proxy comme GRP, reach, ou même le volume de recherche de marque.

Un pipeline MMM correctement conçu transforme la planification budgétaire du marketing — de la devinette à l'ingénierie basée sur la preuve. Robyn rend cette transformation accessible en open-source — mais la structure des données, le tuning des hyperparamètres et la validation d'incrémentalité requièrent une expertise humaine. Les équipes marketing qui investissent dans la régression économétrique plutôt que dans l'attribution au lieu des cookies auront un avantage de 12 mois sur leurs concurrents en 2027.