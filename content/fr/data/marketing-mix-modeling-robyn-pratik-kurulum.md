---
title: "Marketing Mix Modeling: Configuration Pratique avec Robyn"
description: "Framework Robyn de Meta pour configurer un modèle d'attribution : courbes de saturation, adstock decay et validation holdout. SQL, R et pipeline production."
publishedAt: 2026-06-21
modifiedAt: 2026-06-21
category: data
i18nKey: data-005-2026-06
tags: [marketing-mix-modeling, robyn, adstock, attribution, mmm]
readingTime: 8
author: Roibase
---

La dépréciation des cookies et les régulations de confidentialité déplacent l'attribution des méthodes déterministes vers la modélisation probabiliste. Le Marketing Mix Modeling (MMM) — outil statistique des années 1960 — retrouve une pertinence centrale. Le framework open-source Robyn de Meta fournit le volet pratique de cette transformation : via l'inférence bayésienne, les courbes de saturation et l'adstock decay, tu lies la dépense marketing hebdomadaire aux ventes par régression, puis tu déploies ce modèle en production. Cet article montre comment installer Robyn, ajuster le modèle à des données réelles, exécuter une recherche grid d'hyperparamètres et prévenir l'overfitting avec une validation holdout.

## Qu'est-ce que Robyn et sa différence avec la régression classique

Robyn est un framework MMM open-source écrit en R. Meta l'a développé pour son équipe marketing en 2020 et l'a publié en 2021. Ses différences avec la régression linéaire classique :

**Transformation d'adstock** : L'effet marketing n'est pas instantané — une publicité TV entretient la notoriété pendant des semaines. L'adstock modélise la contribution des dépenses passées sur les ventes actuelles via une décroissance exponentielle. Robyn supporte les fonctions adstock géométrique et Weibull. La géométrique est simple : `adstock_t = spend_t + θ × adstock_(t-1)`, où θ est le paramètre de décroissance. La Weibull est plus flexible — tu peux positionner l'effet maximal avec un délai.

**Saturation (rendements décroissants)** : La relation dépense-ventes n'est pas linéaire. Les premiers 100k € générent 80 % de ROI, les 100k € suivants seulement 40 %. Robyn applique les fonctions de saturation Hill et S-curve. L'équation de Hill : `y = V_max × x^n / (K^n + x^n)`, où K est le point de demi-maximum et n la pente. Cette non-linéarité est critique pour l'optimisation budgétaire par canal.

**Hyperparameter tuning** : Les paramètres adstock decay, saturation K et n sont inconnus — une recherche grid les découvre. Robyn utilise un algorithme génétique (NSGAII) pour tester des milliers de combinaisons de paramètres et sélectionner les meilleurs compromis sur la frontière de Pareto.

## Préparation des données : de SQL à la granularité hebdomadaire

Robyn fonctionne à granularité hebdomadaire. Tu agrèges les logs transactionnels quotidiens en dépense média et revenu hebdomadaires. Exemple de requête BigQuery :

```sql
WITH weekly_revenue AS (
  SELECT
    DATE_TRUNC(order_date, WEEK) AS week_start,
    SUM(revenue) AS revenue
  FROM `project.dataset.orders`
  WHERE order_date >= '2024-01-01'
  GROUP BY 1
),
weekly_spend AS (
  SELECT
    DATE_TRUNC(date, WEEK) AS week_start,
    channel,
    SUM(cost) AS spend
  FROM `project.dataset.marketing_costs`
  WHERE date >= '2024-01-01'
  GROUP BY 1, 2
)
SELECT
  r.week_start,
  r.revenue,
  COALESCE(s_google.spend, 0) AS google_search_spend,
  COALESCE(s_meta.spend, 0) AS meta_paid_social_spend,
  COALESCE(s_tv.spend, 0) AS tv_spend
FROM weekly_revenue r
LEFT JOIN weekly_spend s_google
  ON r.week_start = s_google.week_start AND s_google.channel = 'google_search'
LEFT JOIN weekly_spend s_meta
  ON r.week_start = s_meta.week_start AND s_meta.channel = 'meta'
LEFT JOIN weekly_spend s_tv
  ON r.week_start = s_tv.week_start AND s_tv.channel = 'tv'
ORDER BY 1;
```

Cette requête produit une ligne par semaine, une colonne revenue et N colonnes de dépense par canal. Robyn peut consommer un CSV, mais extraire directement depuis BigQuery en production est plus propre. Avec le package `bigrquery` :

```r
library(bigrquery)
library(Robyn)

bq_auth()
df_input <- bq_project_query(
  "project-id",
  "SELECT week_start, revenue, google_search_spend, meta_paid_social_spend, tv_spend FROM `project.dataset.mmm_input`"
) %>% bq_table_download()
```

Minimum requis : 104 semaines (2 ans). Moins de données risquent l'overfitting. Les prior bayésiens de Robyn fonctionnent avec 52 semaines, mais 104+ semaines capturent mieux la saisonnalité.

## Configuration du modèle : robyn_inputs et grid d'hyperparamètres

Robyn crée un objet config via `robyn_inputs()` :

```r
InputCollect <- robyn_inputs(
  dt_input = df_input,
  date_var = "week_start",
  dep_var = "revenue",
  dep_var_type = "revenue",
  paid_media_spends = c("google_search_spend", "meta_paid_social_spend", "tv_spend"),
  paid_media_vars = c("google_search_spend", "meta_paid_social_spend", "tv_spend"),
  context_vars = c("competitor_index", "seasonality"),
  window_start = "2024-01-01",
  window_end = "2026-06-14",
  adstock = "geometric",
  hyperparameters = list(
    google_search_spend_alphas = c(0.5, 3),
    google_search_spend_gammas = c(0.3, 1),
    google_search_spend_thetas = c(0, 0.3),
    meta_paid_social_spend_alphas = c(0.5, 3),
    meta_paid_social_spend_gammas = c(0.3, 1),
    meta_paid_social_spend_thetas = c(0, 0.5),
    tv_spend_alphas = c(0.5, 3),
    tv_spend_gammas = c(0.3, 1),
    tv_spend_thetas = c(0.1, 0.7)
  )
)
```

**Explication des hyperparamètres :**

- **alpha** : Paramètre slope (n) de la fonction de saturation Hill. Alpha élevé = saturation tardive.
- **gamma** : Paramètre K de Hill — point de demi-maximum. Gamma bas = saturation précoce.
- **theta** : Adstock decay géométrique. 0 = effet immédiat, 0.7 = 70 % reportés à la semaine suivante.

Tu fournis un intervalle min-max par canal. Robyn effectue une recherche grid dans ces intervalles. Pour TV, le plafond theta est 0.7 — la notoriété persiste longtemps. Pour paid search, 0.3 — la conversion est à court terme.

## Exécution du modèle : robyn_run et optimisation Pareto

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  cores = 8,
  iterations = 2000,
  trials = 5,
  outputs = FALSE
)
```

`robyn_run()` exécute un algorithme génétique sur 2000 itérations testant des combinaisons d'hyperparamètres. À chaque itération, il minimise NRMSE (erreur quadratique moyenne normalisée) et DECOMP.RSSD (différence de somme des résidus carrés de décomposition). Cinq modèles sont sélectionnés à partir de la frontière de Pareto — tu choisis le meilleur compromis : qualité d'ajustement vs. logique métier (p.ex. le ROI TV ne doit pas dépasser le search).

L'objet output contient une table `df_allpareto` — chaque modèle y figure avec ses ROI par canal, ROAS et CPA. Nombre de lignes = itérations × trials. Colonnes clés :

| Colonne | Description |
|---------|-------------|
| `solID` | ID du modèle |
| `nrmse` | NRMSE normalisé — bas = bon ajustement |
| `decomp.rssd` | RSSD de décomposition — bas = contributions stables |
| `mape` | Erreur absolue moyenne en pourcentage |
| `rsq_train` | R² d'entraînement |
| `google_search_spend_roi` | ROI Google Search (revenu/dépense) |
| `meta_paid_social_spend_roi` | ROI Meta |
| `tv_spend_roi` | ROI TV |

Tu sélectionnes le meilleur modèle via NRMSE + DECOMP.RSSD + logique métier. Robyn offre un dashboard Shiny, mais en production la sélection programmatique est plus contrôlée :

```r
best_model_id <- OutputModels$allPareto %>%
  filter(nrmse < 0.1, decomp.rssd < 0.05) %>%
  arrange(nrmse) %>%
  slice(1) %>%
  pull(solID)
```

## Validation holdout : prévenir l'overfitting

Un modèle ajusté sur données d'entraînement ne généralise pas forcément sur données inédites. Avec validation holdout dans Robyn : tu retires les 8-12 dernières semaines des données d'entraînement et les réserves comme test set. Le modèle s'ajuste sur l'entraînement, fait des prédictions sur le test. Si MAPE (erreur absolue moyenne en pourcentage) sur le test reste < 15 %, le modèle peut aller en production.

```r
InputCollect_train <- robyn_inputs(
  dt_input = df_input,
  date_var = "week_start",
  dep_var = "revenue",
  window_start = "2024-01-01",
  window_end = "2026-04-12",  # Dernières 10 semaines en holdout
  # ... autres paramètres identiques
)

OutputModels_train <- robyn_run(InputCollect_train, iterations = 2000)

# Prédiction sur le test set
df_test <- df_input %>% filter(week_start > "2026-04-12")
predictions <- predict(OutputModels_train, newdata = df_test)
mape_test <- mean(abs((df_test$revenue - predictions) / df_test$revenue)) * 100
```

Si MAPE > 20 %, le modèle est overfit. Tu dois réduire les plages d'hyperparamètres ou ajouter des variables contextuelles (indice économique, météo). La régularisation bayésienne de Robyn (pénalité ridge) réduit l'overfitting, mais la validation holdout est la garantie finale.

## Visualiser courbes d'adstock et saturation

Robyn exporte les courbes d'adstock et saturation via `robyn_outputs()`. En production, tu génères ces graphiques en PNG et les intègres dans le dashboard BI :

```r
robyn_outputs(
  InputCollect = InputCollect,
  OutputModels = OutputModels,
  select_model = best_model_id,
  export = TRUE,
  export_location = "/data/mmm_output/"
)
```

Fichiers exportés :

- `saturate_curves.png` — Par canal, courbe dépense vs. réponse. L'axe X : dépense, Y : revenu prédit. La courbe s'aplatit au point de saturation.
- `adstock_curves.png` — Profil decay. X : semaine, Y : multiplicateur adstock. TV décroît sur 6-8 semaines.
- `waterfall.png` — Décomposition revenue : base + saisonnalité + contribution par canal.

Avec ces visualisations, au lieu de dire « augmente la dépense TV de 30 % », tu dis « TV est au point de saturation ; réaffecter 20 % à search augmentera le ROI total de 12 % ».

## Pipeline production : dbt + Robyn + Looker Studio

MMM n'est pas une analyse ponctuelle — il faut un refresh hebdomadaire. Avec l'approche [First-Party Data & Architecture de Mesure](https://www.roibase.com.tr/fr/firstparty) de Roibase, le pipeline se structure ainsi :

1. **dbt** : Produit la table `mmm_input` depuis les événements bruts dans BigQuery (SQL ci-dessus). Exécution dbt Cloud programmée chaque lundi 00:00.
2. **Script Robyn R** : Container Cloud Run exécute le script. Récupère `mmm_input` via `bigrquery`, lance `robyn_run()`, écrit la sortie dans BigQuery (`mmm_output` table : `week_start`, `channel`, `roi`, `predicted_revenue`).
3. **Looker Studio** : Connecté à `mmm_output`, crée un dashboard tendance ROI par canal, courbes de saturation et recommandations budgétaires.

Le container est emballé via Dockerfile :

```dockerfile
FROM rocker/tidyverse:4.2.0
RUN R -e "install.packages('Robyn', repos='https://cloud.r-project.org')"
RUN R -e "install.packages('bigrquery')"
COPY run_mmm.R /app/run_mmm.R
CMD ["Rscript", "/app/run_mmm.R"]
```

Tu schedules chaque lundi 06:00 via Cloud Scheduler. Robyn 2000 itérations prennent ~20 minutes sur 8 cores.

## Réallocation budgétaire : décisions depuis la frontière Pareto

Le résultat le plus puissant de Robyn : l'*allocator*. La fonction `robyn_allocator()` réalloue le budget courant entre canaux pour maximiser le revenu total :

```r
AllocatorCollect <- robyn_allocator(
  InputCollect = InputCollect,
  OutputCollect = OutputModels,
  select_model = best_model_id,
  scenario = "max_response",
  channel_constr_low = c(0.7, 0.7, 0.5),  # Google, Meta, TV : min 70%, 70%, 50%
  channel_constr_up = c(1.5, 1.5, 2),     # Max 150%, 150%, 200%
  expected_spend = 500000,                # Budget total
  expected_spend_days = 90
)
```

Table résultat :

| Canal | Dépense Actuelle | Dépense Optimisée | Delta | Lift Revenu Attendu |
|-------|------------------|-------------------|-------|