---
title: "Architecture de table de cohorte : Mise à l'échelle de l'analyse de rétention en production"
description: "Materialized views, stratégie de partitioning et optimisation des coûts de requête pour mettre à l'échelle les analyses de cohorte de rétention en production, réduire les coûts et accélérer les décisions."
publishedAt: 2026-08-14
modifiedAt: 2026-08-14
category: data
i18nKey: data-007-2026-08
tags: [cohort-analysis, bigquery, materialized-views, data-engineering, retention]
readingTime: 8
author: Roibase
---

L'analyse de rétention est au cœur du moteur décisionnel dans l'e-commerce et les modèles SaaS. Cependant, lorsque les requêtes de cohorte classiques s'exécutent en production, elles effectuent un full-scan de tables d'événements de plusieurs téraoctets, prennent des minutes et font monter le coût des requêtes à plusieurs centaines de dollars par jour. Lorsque le calcul des cohortes se fait à la demande, le cycle décisionnel ralentit, l'équipe d'analystes passe son temps à optimiser les requêtes, les tableaux de bord ne se mettent pas à jour. La solution : stocker les tables de cohorte comme des actifs de données pré-calculées, partitionnées et rafraîchies de manière incrémentale. Dans cet article, nous vous montrons comment configurer materialized views, partitioning et stratégies de build incrémental sur BigQuery, réduire les coûts de requête de 90 % tout en ramenant la vitesse d'analyse à la seconde et rendant les décisions de rétention quasi-temps réel.

## Pourquoi la requête de cohorte classique ne s'adapte pas

L'analyse de cohorte standard fonctionne comme suit : regrouper les utilisateurs par date de leur première interaction, puis calculer le pourcentage qui revient les jours suivants. La requête SQL joint la table `events` deux fois — une fois pour trouver la date de cohort, une fois pour compter le comportement de rétention. Sur BigQuery, avec une table d'événements de 500 millions de lignes, cette requête prend 10-15 secondes et coûte environ 0,50 $. La requête est répétée à chaque rafraîchissement du tableau de bord, à chaque itération de l'analyste, à chaque rapport de test A/B.

Le problème ne vient pas tant du coût que de la vitesse et de la flexibilité. Lorsque l'équipe d'analystes veut changer la définition de la cohorte (par exemple, passer du "premier achat" à "ajout au panier pour la deuxième fois"), réécrire, tester et valider la requête prend des heures. Les tableaux de bord restent obsolètes. Quand l'équipe marketing demande "quelle était la rétention de la cohorte de la semaine dernière", il n'y a pas de données en direct ; l'analyste exécute la requête manuellement. Cette boucle ralentit le processus décisionnel de plusieurs jours.

Les calculs de cohorte nécessitent également une couche d'agrégation. La métrique de rétention n'est pas juste le "nombre d'utilisateurs", mais le ratio "utilisateurs actifs / taille de la cohorte". Ce ratio doit être mis à jour chaque jour, les nouveaux comportements de jours précédents des cohortes existantes doivent être ajoutés. La requête classique ne supporte pas cette logique incrémentale, elle recalcule tout à chaque fois.

## Transformer la cohorte en table avec Materialized View

La première étape de la solution est de fixer la définition de la cohorte dans une materialized view. Sur BigQuery, une materialized view stocke physiquement le résultat de la requête et la rafraîchit de manière incrémentale lorsque la table de base change. Cependant, pour l'analyse de cohorte, une MV standard n'est pas suffisante car la définition de la cohorte et la fenêtre de rétention sont des paramètres dynamiques. C'est pourquoi nous construisons une architecture hybride : table d'assignation de cohorte + table d'agrégation des événements de rétention.

La première table `cohort_assignments` stocke la date à laquelle l'utilisateur entre dans la cohorte pour la première fois :

```sql
CREATE TABLE `project.dataset.cohort_assignments`
PARTITION BY DATE(cohort_date)
CLUSTER BY user_id
AS
SELECT
  user_id,
  MIN(DATE(event_timestamp)) AS cohort_date,
  COUNTIF(event_name = 'purchase') AS total_purchases
FROM `project.dataset.events`
WHERE event_name IN ('first_visit', 'purchase', 'signup')
GROUP BY user_id;
```

Cette table contient chaque utilisateur une seule fois, `cohort_date` est la clé de partitioning. Quand un nouvel utilisateur arrive, seule la partition du jour concerné est ajoutée. La taille de la table met à l'échelle avec le nombre d'utilisateurs (pas le nombre d'événements) — pour 10 millions d'utilisateurs, environ 500 MB.

La deuxième table `daily_user_activity` stocke pour chaque utilisateur et chaque jour s'il a été actif (drapeau booléen) :

```sql
CREATE TABLE `project.dataset.daily_user_activity`
PARTITION BY activity_date
CLUSTER BY user_id
AS
SELECT
  user_id,
  DATE(event_timestamp) AS activity_date,
  TRUE AS is_active
FROM `project.dataset.events`
WHERE event_name IN ('pageview', 'purchase', 'session_start')
GROUP BY user_id, activity_date;
```

Nous exécutons la requête de rétention en joignant ces deux tables :

```sql
SELECT
  c.cohort_date,
  DATE_DIFF(a.activity_date, c.cohort_date, DAY) AS days_since_cohort,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT a.user_id) AS active_users,
  SAFE_DIVIDE(COUNT(DISTINCT a.user_id), COUNT(DISTINCT c.user_id)) AS retention_rate
FROM `project.dataset.cohort_assignments` c
LEFT JOIN `project.dataset.daily_user_activity` a
  ON c.user_id = a.user_id
  AND a.activity_date >= c.cohort_date
WHERE c.cohort_date >= '2026-01-01'
GROUP BY c.cohort_date, days_since_cohort
ORDER BY c.cohort_date, days_since_cohort;
```

Cette requête ne scanne plus la table d'événements de plusieurs téraoctets, elle effectue juste deux petits joins. Sur BigQuery, pour 10 millions d'utilisateurs, cela prend ~2 secondes et coûte 0,02 $ — une réduction de coûts de 96 %.

## Stratégie de partitioning : quelle date dans quelle partition

La stratégie de partitioning est critique pour les tables de cohorte car il y a deux dimensions temporelles : la date de cohorte et la date d'activité. La table `cohort_assignments` est partitionnée par `cohort_date` car cette table stocke la première interaction de l'utilisateur et la définition de la cohorte est fixe. Quand un nouvel utilisateur arrive, seule la partition d'aujourd'hui reçoit l'ajout, les partitions passées restent immutables.

La table `daily_user_activity` est partitionnée par `activity_date` car de nouvelles données d'activité arrivent chaque jour et les jours passés ne changent pas. Cette structure convient au rafraîchissement incrémental : le job dbt ou Airflow écrit chaque jour seulement la partition du jour, sans toucher aux partitions passées.

Cependant, l'analyse de rétention nécessite un join entre deux dates : cohort_date et activity_date. Pour optimiser les performances du join, nous utilisons une clé de clustering. Sur BigQuery, `CLUSTER BY user_id` stocke physiquement les lignes avec le même user_id côte à côte, le join effectue une pruning au niveau des blocs et réduit les E/S disque. Avec 10 millions d'utilisateurs, sans clé de clustering le join prend ~8 secondes, avec clustering ~2 secondes.

La pruning de partition est aussi importante. L'analyse de rétention porte généralement sur les cohortes des 90 derniers jours. Le filtre `WHERE c.cohort_date >= '2026-05-01'` déclenche la pruning de partition, BigQuery lit uniquement les partitions pertinentes. Pour 2 ans de données, sans pruning de partition le coût de la requête est ~0,50 $, avec pruning ~0,02 $ — car les données scannées sont 24 fois moins importantes.

Il y a un compromis en stratégie de partitioning : les partitions quotidiennes facilitent le rafraîchissement incrémental mais trop de partitions augmentent le overhead du query planner sur BigQuery. Une table avec 1000+ partitions ralentit le temps de chargement des métadonnées du planner. C'est pourquoi les données de cohorte de plus de 2 ans doivent être archivées ou consolidées en partitions mensuelles.

## Rafraîchissement incrémental : calculer uniquement les nouvelles données

Les tables de cohorte doivent être mises à jour quotidiennement car de nouveaux utilisateurs arrivent dans les cohortes et le comportement de rétention des cohortes existantes se met à jour. Cependant, faire un rafraîchissement complet — recalculer l'intégralité de la table — serait un gaspillage. La solution : le pattern de build incrémental.

Dans dbt, un modèle incrémental se définit comme suit :

```sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'cohort_date', 'data_type': 'date'},
    cluster_by=['user_id'],
    incremental_strategy='insert_overwrite'
  )
}}

SELECT
  user_id,
  MIN(DATE(event_timestamp)) AS cohort_date,
  COUNTIF(event_name = 'purchase') AS total_purchases
FROM {{ source('raw', 'events') }}
WHERE DATE(event_timestamp) = CURRENT_DATE() - 1
{% if is_incremental() %}
  AND DATE(event_timestamp) > (SELECT MAX(cohort_date) FROM {{ this }})
{% endif %}
GROUP BY user_id
```

Ce modèle calcule chaque jour uniquement la partition d'hier. La stratégie `insert_overwrite` supprime la partition existante et en écrit une nouvelle. Sur BigQuery, remplacer une partition est une opération atomique, les requêtes en aval ne lisent jamais de données incomplètes.

Pour la table `daily_user_activity`, la logique incrémentale est plus simple car chaque jour une nouvelle partition est ajoutée, les partitions passées ne changent pas :

```sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'activity_date', 'data_type': 'date'},
    cluster_by=['user_id']
  )
}}

SELECT
  user_id,
  DATE(event_timestamp) AS activity_date,
  TRUE AS is_active
FROM {{ source('raw', 'events') }}
WHERE DATE(event_timestamp) = CURRENT_DATE() - 1
{% if is_incremental() %}
  AND DATE(event_timestamp) NOT IN (SELECT DISTINCT activity_date FROM {{ this }})
{% endif %}
GROUP BY user_id, activity_date
```

Avec un rafraîchissement incrémental, le job quotidien passe de 5 minutes à 30 secondes. L'utilisation des slots BigQuery baisse de 80 %, l'attente en file d'attente des requêtes disparaît. Quand l'équipe d'analystes ouvre le tableau de bord à 9h du matin, les données de rétention d'hier sont prêtes.

Cependant, le build incrémental comporte un risque : les données arrivant tardivement (late-arriving data). Si le pipeline d'événements a un délai de 2-3 heures, la partition d'hier contient des données incomplètes. Pour résoudre ce problème, deux approches sont utilisées : (1) paramètre `lookback_window` dans dbt — recalculer les 3 derniers jours à chaque fois ; (2) sur BigQuery, utiliser les métadonnées `_PARTITIONTIME` pour filtrer en fonction de l'heure d'insertion de la partition. La deuxième approche est plus efficace car elle ne re-traite que les événements arrivés tard.

## Optimisation des coûts de requête : taille de la table et pattern de scan

Le coût des tables de cohorte dépend de deux facteurs : la taille de la table (GB) et le pattern de scan de la requête. La table `cohort_assignments` pour 10 millions d'utilisateurs fait ~500 MB, la table `daily_user_activity` sur une fenêtre de 90 jours fait ~5 GB. Quand ces deux tables sont jointes, BigQuery scanne ~6 GB, le coût est ~0,03 $. Cependant, la même analyse sur la table brute des événements scannerait 500 GB, le coût serait ~2,50 $ — une différence de 80x.

Pour réduire davantage le coût, nous utilisons une table de résumé de cohorte pré-agrégée :

```sql
CREATE TABLE `project.dataset.cohort_retention_summary`
PARTITION BY cohort_date
CLUSTER BY days_since_cohort
AS
SELECT
  c.cohort_date,
  DATE_DIFF(a.activity_date, c.cohort_date, DAY) AS days_since_cohort,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT a.user_id) AS active_users,
  SAFE_DIVIDE(COUNT(DISTINCT a.user_id), COUNT(DISTINCT c.user_id)) AS retention_rate
FROM `project.dataset.cohort_assignments` c
LEFT JOIN `project.dataset.daily_user_activity` a
  ON c.user_id = a.user_id
  AND a.activity_date >= c.cohort_date
GROUP BY c.cohort_date, days_since_cohort;
```

Cette table stocke le taux de rétention pré-calculé pour chaque combinaison cohort-day. La taille de la table est ~100 MB (10 millions d'utilisateurs × 90 jours = 900 millions de lignes → après agrégation ~50 000 lignes). Le tableau de bord lit cette table, sans join, la requête prend <1 seconde, le coût est ~0,001 $.

Un autre point à considérer dans l'optimisation des coûts de requête est de ne pas utiliser `SELECT *`. Pour l'analyse de cohorte, seules les colonnes `user_id`, `cohort_date`, `activity_date` sont nécessaires. Si la table `daily_user_activity` contient des colonnes supplémentaires comme event_name, session_id et que la requête utilise `SELECT *`, des données inutiles sont scannées. BigQuery utilise le stockage en colonnes, sélectionner uniquement les colonnes nécessaires réduit les E/S disque de 40-50 %.

La dernière optimisation est d'utiliser BigQuery BI Engine. BI Engine met en cache la table de résumé des cohortes en mémoire, les requêtes du tableau de bord