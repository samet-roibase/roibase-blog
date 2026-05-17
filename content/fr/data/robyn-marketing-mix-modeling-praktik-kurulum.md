---
title: "Marketing Mix Modeling : Configuration pratique avec Robyn"
description: "Configurez la bibliothèque MMM open-source de Meta, Robyn, avec courbes de saturation, décroissance d'adstock et validation holdout sur votre stack BigQuery."
publishedAt: 2026-05-17
modifiedAt: 2026-05-17
category: data
i18nKey: data-005-2026-05
tags: [marketing-mix-modeling, robyn, meta, adstock, saturation-curve]
readingTime: 9
author: Roibase
---

La fenêtre d'attribution s'est réduite à 7 jours, le taux de refus du consentement aux cookies dépasse 40 %, la contribution multi-touch entre canaux est devenue intraçable. En 2026, l'unique voie fiable pour un performance marketer est le modèle économétrique agrégé : le Marketing Mix Modeling. La bibliothèque Robyn, lancée en open-source par Meta en 2021, a enfin rendu ce processus production-ready. Comment interpréter une courbe de saturation, que signifie réellement la décroissance d'adstock, dans quel intervalle la validation holdout fonctionne-t-elle — nous répondrons à ces questions en déployant Robyn sur votre stack BigQuery.

## Robyn : Ce qu'il est, ce qu'il n'est pas

Robyn est une bibliothèque R développée par l'équipe Marketing Science de Facebook et publiée en open-source. Son objectif : régresser les dépenses hebdomadaires ou quotidiennes par canal + variables externes (jours fériés, saisonnalité, prix) contre une métrique de ventes. Output : ROAS par canal, niveau de saturation, effet de décalage temporel (adstock), allocation budgétaire optimale.

Ce qu'il n'est pas : ce n'est pas de l'attribution au dernier clic, il ne suit pas le parcours de conversion au niveau utilisateur. Il n'utilise pas de données personnelles, ne dépend pas de signaux cookie. Il fonctionne avec des modèles de régression économétrique sur séries temporelles agrégées — pas Ridge ni Lasso, mais optimisation d'hyperparamètres via Nevergrad qui balaye des transformations non-linéaires complexes.

Dans les processus MMM classiques, on modélise 36 points de données mensuels. Robyn fonctionne même sur granularité quotidienne — 104 semaines minimum (2 ans) sont recommandées. Moins de 52 semaines maintiennent la variance élevée et rendent les intervalles de confiance peu fiables.

## La courbe de saturation : S-Curve et fonction Hill

Au cœur de Robyn se trouvent deux transformations de saturation : Adbudg (S-curve) et Hill. Toutes deux codent l'hypothèse de rendements marginaux décroissants. Autrement dit, chaque 1000 € supplémentaires dépensés sur un canal ne génère pas autant de conversions que les premiers 1000 €.

**Formule de la transformation Hill :**
```
y = K * (x^alpha) / (S^alpha + x^alpha)
```
- K : réponse maximale (asymptote)
- S : point de demi-saturation (à ce niveau de dépense, la réponse atteint 50 % de K)
- alpha : pente de la courbe (alpha > 1 = S-curve, alpha < 1 = concave)

Robyn optimise les paramètres alpha et S pour chaque canal via Nevergrad. Il teste 10 000+ combinaisons et sélectionne le meilleur ajustement selon le NRMSE le plus bas (normalized root mean squared error).

**Interprétation pratique :**
- Si Google Ads révèle S = 50 000 €, cela signifie qu'à 50 000 € de dépense hebdomadaire, vous atteignez 50 % de votre potentiel de réponse.
- Si alpha = 2,5, la courbe est une S raide — le rendement est très faible sous 50 000 €, puis augmente très lentement au-delà.
- L'optimiseur budgétaire utilise ces courbes pour répondre : « Est-il mieux de passer Google Ads de 50 000 € à 60 000 € ou Facebook de 30 000 € à 40 000 € ? »

En pratique : le budget de recherche s'avère généralement concave (alpha < 1), tandis que display/vidéo suit une S-curve (alpha > 1). La demande de recherche est limitée, le pool display illimité mais l'attention ne l'est pas.

## Adstock Decay : Modéliser l'effet différé

L'impact d'une dépense marketing ne se limite pas au jour même — il s'étend sur plusieurs semaines. Une publicité TV génère encore une mémorisation de marque 3 semaines après, tandis que le social payant perd son effet en 7 jours. L'adstock formalise mathématiquement ce report (carryover) et cette décroissance (decay).

Robyn offre deux transformations d'adstock :
1. **Adstock géométrique :** Décroissance exponentielle. Paramètre theta (entre 0 et 1). Theta = 0,5 signifie que 50 % de l'effet de la semaine précédente transite vers la semaine actuelle.
2. **Adstock Weibull :** Plus flexible — pic décalé + queue longue. Paramètres : forme (k) et échelle (lambda). Préféré pour les canaux comme la TV avec un pic d'effet différé.

**Formule de l'adstock géométrique :**
```
adstocked_t = spend_t + theta * adstocked_(t-1)
```

Robyn optimise theta (ou k, lambda) pour chaque canal via grid search. L'utilisateur définit une plage dans hyperparameters.json (par ex., 0–0,7), et le modèle trouve le theta optimal.

**Ce qu'il faut faire en pratique :**

```r
hyperparameters <- list(
  google_ads_S = c(0.3, 3),    # plage theta pour adstock
  google_ads_alphas = c(0.5, 3), # plage alpha de saturation
  facebook_ads_S = c(0.1, 2),
  facebook_ads_alphas = c(1, 5)
)
```

Si Google Ads ressort avec theta = 0,4 et Facebook Ads avec 0,2, cela signifie que l'impact de Google Ads s'étend plus longtemps. Le planificateur budgétaire en tient compte — un euro dépensé en Google Ads contribue encore 2 semaines plus tard, tandis que pour Facebook ce n'est qu'une semaine.

### Bloc de code : transformation d'adstock simple (R)

```r
apply_geometric_adstock <- function(spend, theta) {
  adstocked <- numeric(length(spend))
  adstocked[1] <- spend[1]
  for (t in 2:length(spend)) {
    adstocked[t] <- spend[t] + theta * adstocked[t - 1]
  }
  return(adstocked)
}

# Exemple : dépense Google Ads
google_spend <- c(10000, 15000, 12000, 8000, 20000)
theta_google <- 0.5
adstocked_google <- apply_geometric_adstock(google_spend, theta_google)
print(adstocked_google)
# [1] 10000.0 20000.0 22000.0 19000.0 29500.0
```

Ce code s'exécute au niveau C++ optimisé dans Robyn, mais la logique reste la même.

## Validation Holdout : test de fiabilité du modèle

Robyn court le risque de surapprentissage lors de l'amélioration de l'ajustement du modèle. 10 canaux + 5 variables macro + paramètres de saturation et adstock pour chacun = 30+ variables. Avec 104 points de données, c'est trop de degrés de liberté.

Robyn utilise la validation holdout : les N dernières semaines de données sont exclues de l'entraînement du modèle, ce dernier apprend sur l'historique, puis prédit sur la période holdout, et le MAPE (mean absolute percentage error) est calculé par rapport aux valeurs réelles.

**Définir holdout dans Robyn :**

```r
InputCollect <- robyn_inputs(
  dt_input = df_marketing,
  dep_var = "revenue",
  paid_media_spends = c("google_ads", "facebook_ads", "tiktok_ads"),
  window_start = "2024-01-01",
  window_end = "2026-04-30",
  adstock = "geometric",
  prophet_vars = c("trend", "season", "holiday"),
  prophet_country = "FR"
)

# Holdout : 8 dernières semaines
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  ts_validation = TRUE,
  ts_holdout = 8  # 8 dernières semaines = ensemble de test
)
```

**Interprétation des résultats :**
- NRMSE train < 0,10, NRMSE holdout < 0,15 → le modèle est fiable.
- NRMSE train = 0,05, holdout = 0,30 → surapprentissage, il faut réduire les plages d'hyperparamètres.
- Decomp.RSSD (response sum of squared differences) : la contribution totale des canaux explique quelle fraction du revenu prédit. 0,6+ c'est bon, 0,8+ c'est excellent.

Robyn exécute 5 trials simultanément (seeds aléatoires différents de Nevergrad), 2000 itérations par trial, et affiche les 10 meilleurs modèles sur la frontière de Pareto. L'utilisateur en sélectionne un en fonction des contraintes métier (par ex., « Google Ads ROAS ne peut pas descendre sous 3 »).

## Robyn avec BigQuery : architecture du pipeline

Robyn s'exécute en environnement R, mais la source de données peut être BigQuery. Stack typique :

1. **Entrepôt de données BigQuery :** table des dépenses quotidiennes (spend_daily), table des conversions (conversions_daily), variables macro (jours fériés, météo, prix concurrent).
2. **Transformation dbt :** jointure + agrégation. Conversion en lignes hebdomadaires, création de colonnes de dépense par canal.
3. **Script R (Cloud Run ou Vertex AI) :** extraction depuis BigQuery via le paquet *bigrquery*, alimentation de Robyn, réécriture des résultats du modèle dans BigQuery.
4. **Tableau de bord Looker Studio :** visualisation de la sortie du modèle — ROAS par canal, allocation budgétaire optimale, graphiques de saturation.

**Exemple de modèle dbt (marketing_mix_weekly.sql) :**

```sql
WITH spend_agg AS (
  SELECT
    DATE_TRUNC(spend_date, WEEK) AS week_start,
    SUM(CASE WHEN channel = 'google_ads' THEN spend ELSE 0 END) AS google_ads_spend,
    SUM(CASE WHEN channel = 'facebook_ads' THEN spend ELSE 0 END) AS facebook_ads_spend,
    SUM(CASE WHEN channel = 'tiktok_ads' THEN spend ELSE 0 END) AS tiktok_ads_spend
  FROM `project.dataset.spend_daily`
  WHERE spend_date BETWEEN '2024-01-01' AND '2026-04-30'
  GROUP BY 1
),
revenue_agg AS (
  SELECT
    DATE_TRUNC(conversion_date, WEEK) AS week_start,
    SUM(revenue) AS total_revenue
  FROM `project.dataset.conversions_daily`
  WHERE conversion_date BETWEEN '2024-01-01' AND '2026-04-30'
  GROUP BY 1
)
SELECT
  s.week_start,
  s.google_ads_spend,
  s.facebook_ads_spend,
  s.tiktok_ads_spend,
  r.total_revenue
FROM spend_agg s
LEFT JOIN revenue_agg r USING (week_start)
ORDER BY week_start
```

Cette table est matérialisée dans BigQuery, le script R de Robyn la télécharge via `bigrquery::bq_table_download()`. La sortie du modèle (contribution de chaque canal chaque semaine) est réécrite dans BigQuery — vos outils BI la lisent de là.

## Budget Optimizer : allocation Pareto-optimale

Après l'ajustement du modèle, Robyn exécute un second module : l'allocateur de budget. Entrées : budget total (par ex., 500 000 €/semaine), contraintes de dépense par canal (par ex., Google Ads minimum 50 000 €). Sortie : allocation optimale pour maximiser le ROAS.

Algorithme : il prend la dérivée de la courbe de saturation de chaque canal (ROAS marginal), puis réalloue le budget jusqu'à égaliser le ROAS marginal entre les canaux. C'est une optimisation Lagrangienne.

**Exemple de tableau de résultats :**

| Canal | Dépense actuelle | Dépense optimale | Delta | ROAS actuel | ROAS optimal |
|---|---|---|---|---|---|
| Google Ads | 200 000 € | 180 000 € | −20 000 € | 4,2 | 4,5 |
| Facebook Ads | 150 000 € | 200 000 € | +50 000 € | 3,8 | 4,1 |
| TikTok Ads | 100 000 € | 120 000 € | +20 000 € | 3,5 | 3,9 |
| Display | 50 000 € | 0 € | −50 000 € | 1,2 | — |

Interprétation : le canal Display génère un ROAS de 1,2 même très loin sous le point de saturation — il doit être supprimé. Google Ads est déjà au-delà du point de saturation ; réduire la dépense de 20 000 € booste le ROAS. Facebook Ads est encore sur la pente douce de la courbe, l'augmentation budgétaire est efficace.

Ce tableau remis au CFO, la sortie Robyn visualisée dans Looker : la prise de décision devient data-driven. « Donnons 50 000 € de plus à Facebook ce mois » n'est plus une intuition, c'est un output du modèle.

---

Déployer Robyn requiert 2 ans de données hebdomadaires granulaires, un environnement R, une connexion BigQuery et 4–6 heures de tuning d'hyperparamètres. Une fois en production, le modèle se refresh mensuellement (4 semaines de nouvelles données, la fenêtre holdout glisse). Les courbes de saturation et paramètres d'adstock évoluent avec le temps — theta de Facebook baisse en périodes festives, alpha de Google Ads monte pendant le Black Friday. Robyn ne capture pas ces dynamiques automatiquement, mais un retrain plus fréquent les détecte. Si votre stack de données [first-party](https://www.roibase.com.tr/fr/firstparty) repose sur des fondations BigQuery sol