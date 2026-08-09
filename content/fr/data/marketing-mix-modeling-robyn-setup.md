---
title: "Marketing Mix Modeling: Configuration Pratique avec Robyn"
description: "Déployez l'outil MMM open-source de Meta, Robyn, en production : courbes de saturation, adstock decay et validation holdout dans vos pipelines data."
publishedAt: 2026-08-09
modifiedAt: 2026-08-09
category: data
i18nKey: data-005-2026-08
tags: [marketing-mix-modeling, robyn, adstock, attribution, data-science]
readingTime: 9
author: Roibase
---

Le Marketing Mix Modeling (MMM) est revenu au premier plan fin 2020 avec l'effondrement de l'attribution basée sur les cookies. Mais passer des articles académiques à l'environnement production, c'est un autre niveau. Robyn, qu'Meta a rendue open-source en 2021, ancre cette transition dans la discipline d'ingénierie : courbes de saturation, adstock decay et validation holdout — des concepts statistiques que les praticiens doivent transformer d'un script R en pipeline opérationnel. Cet article démontre comment déployer les trois mécanismes qui constituent le cœur de Robyn — l'affaiblissement de l'impact publicitaire dans le temps, la relation dépenses-revenus atteignant la saturation, et le processus holdout qui teste la puissance prédictive du modèle — en setup production.

## Adstock Decay : Étaler l'Impact Publicitaire dans le Temps

Un spot TV diffusé un jour ne génère pas de ventes ce jour-là ; son impact s'étend sur une semaine. Une annonce de recherche cliquée à la seconde peut convertir instantanément, mais le recall de marque déclenche une conversion trois jours plus tard. Le terme « adstock » désigne cette structure mathématique qui modélise ce délai temporel. Robyn propose deux types d'adstock : geometric et Weibull. Geometric implique une décroissance exponentielle simple ; chaque jour, l'effet du jour précédent est multiplié par un paramètre `theta`. Weibull est plus flexible — il permet de contrôler indépendamment les courbes de montée et de descente de l'impact.

En setup pratique, vous calibrez les paramètres d'adstock par type de canal. Paid search généralement `theta=0.3` (décroissance rapide), TV `theta=0.7` (longue traîne), display autour de `theta=0.5`. Ces valeurs ne sont pas arbitraires — elles sont découvertes via recherche d'hyperparamètres sur un ensemble holdout de périodes passées. Dans la fonction `robyn_inputs()` de Robyn, vous définissez l'argument `adstock` par canal :

```r
InputCollect <- robyn_inputs(
  dt_input = dt_simulated_weekly,
  adstock = "geometric",
  adstock_params = list(
    tv_s = c(0.3, 0.8),
    search_clicks_p = c(0.0, 0.3),
    facebook_i = c(0.0, 0.5)
  )
)
```

Ici, `c(min, max)` définit une plage ; l'algorithme d'optimisation Nevergrad explore cette plage pour trouver la meilleure valeur `theta`. Si vous utilisez Weibull au lieu de geometric, les paramètres shape et scale s'ajoutent. L'avantage de Weibull est une meilleure adaptation aux canaux comme display, où l'impact « atteint un pic tard » — l'effet est faible les deux premiers jours, culmine entre les jours 3-5.

Une mauvaise configuration de l'adstock conduit le modèle à maldistribuer les contributions entre canaux. Par exemple, si vous modélisez TV avec geometric `theta=0.1`, seul le jour de diffusion se voit attribuer un impact, et le trafic organique sur une semaine est manqué. Inversement, affecter search `theta=0.9` signifie imputer les ventes d'aujourd'hui à un clic d'il y a une semaine — illogique. C'est pourquoi la configuration d'adstock doit refléter la caractéristique du canal et être bornée par la connaissance métier.

## Courbe de Saturation : Relation Dépenses-Revenus Atteignant le Plateau

La régression linéaire suppose que chaque euro dépensé génère le même rendement. En réalité, sur les premiers 10 000 € le ROAS est 8, à 100 000 € il chute à 3, à 1 million € il s'effondre en dessous de 1 — le rendement marginal décroît. La saturation est la transformation qui modélise cette courbe. Le type de saturation le plus courant dans Robyn est l'équation de Hill (Michaelis-Menten) :

```
y = Vmax * (x^S) / (K^S + x^S)
```

Où `Vmax` est l'effet maximal, `K` le niveau de dépenses auquel la saturation atteint la moitié du maximum (point d'inflexion), et `S` la pente de la courbe (shape). `K` bas signifie saturation rapide du canal ; `K` haut signifie saturation tardive. Quand `S>1`, la courbe prend une forme en S — début lent, milieu rapide, fin lent.

Dans Robyn, vous définissez les paramètres de Hill aussi par canal :

```r
hyperparameters <- list(
  tv_s_alphas = c(0.5, 3),
  tv_s_gammas = c(0.3, 1),
  search_clicks_p_alphas = c(0.5, 3),
  search_clicks_p_gammas = c(0.3, 1)
)
```

`alphas` correspond au paramètre `S` de Hill, `gammas` au paramètre `K` (notation de Robyn). L'optimisation cherche le meilleur fit dans ces plages. Mais ne laissez pas la recherche aveugle — si vous dépensez déjà 80 % de votre budget TV, la saturation doit être >90 %, sinon le modèle génère un ROAS marginal irréaliste.

La configuration de saturation impacte directement votre stratégie d'allocation de budget. Si le modèle trace correctement la courbe de saturation, vous pouvez calculer le ROAS marginal de chaque canal et redéployer le budget. La fonction `robyn_allocator()` de Robyn le fait — avec un budget total fixe, quel canal réduire et quel canal augmenter maximise les ventes ? Mais cette recommandation n'est valable que si les paramètres de saturation sont corrects. Une mauvaise valeur `K` équivaut à des millions d'euros de décision erronée.

## Validation Holdout : Tester la Capacité Prédictive du Modèle

Le plus grand risque du MMM est l'overfitting — le modèle mémorise les données historiques au lieu de généraliser. Pour contrer cela, une validation holdout en série chronologique est nécessaire. En setup Robyn, vous écartez les 4-8 dernières semaines comme ensemble holdout, le modèle est entraîné sur le reste, puis fait des prédictions sur la période holdout. NRMSE (Normalized Root Mean Square Error) et MAPE (Mean Absolute Percentage Error) bas signifient que le modèle généralise bien.

```r
InputCollect <- robyn_inputs(
  dt_input = dt_simulated_weekly,
  window_start = "2022-01-01",
  window_end = "2023-10-31",
  rollingWindowStartWhich = 1,
  rollingWindowEndWhich = 52,
  rollingWindowLength = 4
)
```

`rollingWindowLength = 4` place les 4 dernières semaines en holdout. Le modèle est entraîné sans les voir, puis en produit des prédictions. Dans la sortie de Robyn, chaque modèle affiche son NRMSE holdout — <10 % c'est bon, >20 % c'est suspect. Mais ne décidez pas sur une seule métrique ; vérifiez les anomalies pendant la période holdout (campagne, congés). Par exemple, si Black Friday tombe pendant le holdout, le modèle underestimate, car ce pattern de pic n'existe pas dans la demande normale.

Après validation holdout, ré-entraîner le modèle est pratique courante — vous filez un fit final sur toutes les données, mais choisissez les hyperparamètres selon les résultats holdout. Cette boucle « train-valide-finalize ». Dans Robyn, vous utilisez `robyn_refresh()` :

```r
Robyn1 <- robyn_run(InputCollect = InputCollect, plot_folder = OutputCollect$plot_folder)
OutputCollect <- robyn_outputs(Robyn1, select_model = "1_100_3")
RobynRefresh <- robyn_refresh(Robyn1, dt_input = dt_simulated_weekly, refresh_steps = 4)
```

`refresh_steps = 4` met à jour le modèle avec les 4 dernières semaines de données neuves mais conserve les paramètres de saturation/adstock fixes (calibrage préservé). C'est la base d'un pipeline s'exécutant en continu en production — chaque semaine, vous ajoutez une ligne, le modèle re-fit, le dashboard se met à jour.

## Porter le Pipeline Robyn en Production

Un script R Robyn ne se pose pas et s'oublie ; c'est un composant d'un pipeline data production. Une architecture typique : table des dépenses marketing dans BigQuery + table des conversions GA4 + table de revenu CRM → agrégation hebdomadaire avec dbt → DAG Airflow qui déclenche le script R Robyn → résultat JSON sur un dashboard Looker Studio. Cette stack tourne dans une [architecture data first-party](https://www.roibase.com.tr/fr/firstparty).

Première étape : normaliser le schéma de données. Robyn s'attend à une table `dt_input` : `DATE` (hebdomadaire), `revenue`, `tv_spend`, `search_spend`, `facebook_impressions` — colonnes séparées par canal. Distinction organic/paid requise, sinon le modèle ne peut pas faire d'attribution. Les semaines manquantes doivent être imputées (zéro ou interpolation), les outliers flaggés. Exemple de modèle dbt :

```sql
with base as (
  select
    date_trunc(event_date, week) as week_start,
    sum(case when source = 'google/cpc' then cost else 0 end) as search_spend,
    sum(case when source = 'facebook' then cost else 0 end) as facebook_spend,
    count(distinct case when event_name = 'purchase' then user_pseudo_id end) as conversions
  from `project.analytics_123456789.events_*`
  where _table_suffix between '20220101' and '20231231'
  group by 1
)
select * from base
order by week_start
```

Cette table est exportée de BigQuery en CSV et alimentée au script Robyn, ou directement récupérée via le package R `bigrquery`. Cette dernière est préférable — garantie de fraîcheur des données.

Un étage du DAG Airflow pour Robyn :

```python
from airflow.operators.bash import BashOperator

run_robyn = BashOperator(
    task_id='run_robyn_mmm',
    bash_command='Rscript /path/to/robyn_model.R ',
    dag=dag
)
```

À l'intérieur du script, vous sauvegardez l'objet du modèle au format RDS avec `robyn_save()` et l'écrivez sur GCS. Les semaines suivantes, vous le chargez pour `robyn_refresh()`. Ainsi, au lieu d'un re-entraînement complet chaque semaine, une mise à jour incrémentale — le temps de calcul passe de 2 heures à 15 minutes.

Les métriques holdout sont sauvegardées en JSON, écrites dans BigQuery, et visualisées comme graphique de tendance dans Looker Studio. Un pic dans NRMSE (par exemple de 8 % à 18 %) déclenche une alerte — le modèle s'est dégradé, une recalibration est requise. Sans ce monitoring, MMM échoue silencieusement ; une allocation budgétaire incorrecte passe inaperçue pendant trois mois.

## Relier la Sortie du Modèle au Mécanisme de Décision

La sortie de Robyn n'est pas un camembert de contribution par canal, mais un tableau de ROAS marginal. Le dernier euro dépensé par chaque canal génère quel rendement. Avec cela, vous exécutez un optimiseur de budget : si le ROAS marginal de TV est 2 et celui de search 5, shift vers search. Mais cet optimisation mécanique peut entrer en conflit avec la stratégie de marque — si TV tourne pour la brand awareness, fixer le regard sur le ROAS court terme induit une erreur.

C'est pourquoi les résultats MMM ne doivent pas être un outil isolé de prise de décision, mais synthétisés avec d'autres signaux dans votre couche [d'analyse de données](https://www.roibase.com.tr/fr/verianalizi) : études de brand lift, tests d'incrementalité, lifetime value des clients. Si Robyn dit contribution 30 % mais un test geo-lift trouve 15 %, vous devez réconcilier — il y a une faille dans les hypothèses du modèle (par exemple, adstock decay trop haut).

En production, MMM refresh hebdomadaire, mais les décisions budgétaires se prennent mensuellement ou trimestriellement. Le modèle tourne chaque semaine, les métriques entrent en tendance, mais vous observez la moyenne sur 4 semaines. Basculer des millions sur une seule semaine provoque de la volatilité. De plus, la fenêtre holdout est 4 semaines, donc votre cycle de révision budgétaire doit s'aligner dessus.

Enfin, MMM ne remplace pas l'attribution incrémentale — il la complète. GA4 last-click pour les tactiques court terme, MMM pour la stratégie long terme. Quand vous présentez les deux sur des dashboards séparés au C-level, la question « laquelle est vraie ? » arrive. Réponse : chacune est vraie dans son contexte ; GA4 révèle le parcours utilisateur, MMM l'incrementalité agrégée. Pour les décisions budgétaires, prenez une moyenne pondérée des deux (par exemple 60 % MMM, 40 % GA4). Calibrez cette formule de blend selon la culture de l'entreprise et son niveau de maturité data.

---

Le Marketing Mix Modeling n'est plus un exercice académique, c'est un module intégré dans votre pipeline data production. Robyn rend cette transition possible en paramétrant l'adstock, la saturation et le holdout — concepts statistiques transformés en composants versionnables, itérables et automatisables. Mais exécuter le script Robyn une fois et générer un rapport PDF ne suffit pas — vous devez construire une boucle de refresh hebdomadaire, monitoring holdout et allocation budgétaire. Le faire dans la stack BigQuery + dbt + Airflow est idéal ; les sorties MMM alimentent alors un moteur de décision real-time, et quand la performance des canaux change, l'allocation s'ajuste automatiquement. Vous av