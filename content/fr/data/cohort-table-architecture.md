---
title: "Architecture de Table Cohort : Dimensionner l'Analyse de Rétention en Production"
description: "Materialized views, partitioning et optimisation des coûts de requête pour réaliser des analyses de cohort sur des millions d'utilisateurs : architecture BigQuery prête pour la production."
publishedAt: 2026-05-22
modifiedAt: 2026-05-22
category: data
i18nKey: data-007-2026-05
tags: [cohort-analysis, bigquery, materialized-views, retention-engineering, query-optimization]
readingTime: 9
author: Roibase
---

L'analyse de rétention est l'une des méthodes les plus puissantes pour comprendre le comportement des utilisateurs. Cependant, à grande échelle — des millions d'événements par jour, des centaines de milliers d'utilisateurs — les requêtes SQL naïves s'écroulentde timeout après 30 secondes ou épuisent la capacité des slots. Une analyse de cohort durable en production exige d'optimiser l'architecture des tables pour le moteur de requête. Cet article montre comment dimensionner les tables de cohort sur BigQuery en utilisant des materialized views, du partitioning et des stratégies de refresh incrémentiel.

## Pourquoi la Requête Cohort Naïve Échoue

L'analyse classique de cohort fonctionne selon cette logique : trouvez la date de première activité de l'utilisateur (cohort_date), calculez toutes les activités suivantes comme « jour N » relativement à cette date, agrégez les taux de rétention par groupe. La requête SQL suivante est logiquement correcte, mais ne fonctionne pas en production :

```sql
WITH first_event AS (
  SELECT user_id, MIN(DATE(event_timestamp)) AS cohort_date
  FROM `project.dataset.events`
  GROUP BY user_id
),
daily_activity AS (
  SELECT e.user_id, DATE(e.event_timestamp) AS activity_date
  FROM `project.dataset.events` e
  GROUP BY 1,2
)
SELECT 
  f.cohort_date,
  DATE_DIFF(d.activity_date, f.cohort_date, DAY) AS day_n,
  COUNT(DISTINCT d.user_id) AS retained_users
FROM first_event f
JOIN daily_activity d USING(user_id)
GROUP BY 1,2
ORDER BY 1,2;
```

Deux problèmes majeurs surgissent : (1) la table `events` est entièrement scannée à chaque fois — pas de partition pruning, (2) pour chaque cohort_date, toutes les activités de tous les utilisateurs sont jointes — risque d'explosion cartésienne. Avec 100M d'événements, cette requête traite 400GB de données et s'exécute en 2 minutes, mais ce n'est pas soutenable pour un refresh quotidien. La facture BigQuery explose d'un facteur 10 en fin de mois.

## Réduire la Charge de Filtrage avec le Partitioning de Base

La première étape consiste à partitionner la table `events` par `DATE(event_timestamp)`. Cela garantit que lorsque la requête inclut une condition `WHERE DATE(event_timestamp) BETWEEN X AND Y`, seules les partitions concernées sont scannées :

```sql
CREATE TABLE `project.dataset.events`
PARTITION BY DATE(event_timestamp)
CLUSTER BY user_id, event_name
AS SELECT * FROM ...;
```

L'ajout du clustering (user_id, event_name) fait en sorte que les événements d'un même utilisateur soient stockés physiquement dans des blocs proches — la performance des jointures augmente de 30 à 50 %. Cependant, cela seul ne suffit pas ; la logique de calcul du cohort s'exécute à chaque requête. C'est le moment où la materialized view entre en jeu.

## Materialized View : Table Cohort Incrémentale

Les materialized views de BigQuery stockent physiquement le résultat d'une requête et la rafraîchissent automatiquement lorsque la table de base change. Dans l'analyse de cohort, nous utilisons la structure suivante :

```sql
CREATE MATERIALIZED VIEW `project.dataset.user_cohorts`
PARTITION BY cohort_date
CLUSTER BY user_id
AS
SELECT 
  user_id,
  MIN(DATE(event_timestamp)) AS cohort_date,
  COUNT(*) AS first_day_events
FROM `project.dataset.events`
GROUP BY user_id;
```

Cette view calcule une seule fois la date de première apparition de chaque utilisateur (cohort_date) et la conserve. Lorsqu'un nouvel événement arrive, BigQuery ne traite que le delta — pas de scan complet. Le partitioning par cohort_date permet le pruning lorsque des filtres comme `WHERE cohort_date = '2026-05-01'` sont appliqués.

La requête de calcul de la rétention se réduit alors à :

```sql
SELECT 
  c.cohort_date,
  DATE_DIFF(DATE(e.event_timestamp), c.cohort_date, DAY) AS day_n,
  COUNT(DISTINCT e.user_id) AS retained_users
FROM `project.dataset.user_cohorts` c
JOIN `project.dataset.events` e 
  ON c.user_id = e.user_id 
  AND DATE(e.event_timestamp) >= c.cohort_date
WHERE c.cohort_date BETWEEN '2026-05-01' AND '2026-05-15'
GROUP BY 1,2;
```

Cette requête se joint à la materialized view au lieu de la table de base — le nombre de lignes à scanner passe de millions à milliers. Néanmoins, elle scanne toujours la table d'événements quotidienne. L'étape suivante consiste à créer une table de rétention pré-agrégée.

## Table de Rétention Pré-Agrégée : Couche Finale

L'analyse de cohort examine généralement des intervalles fixes — « Jour 0, Jour 1, Jour 7, Jour 30 » — il n'est pas nécessaire de recalculer pour chaque jour. Avec dbt, nous appliquons cette logique :

1. Chaque jour, récupérez les nouveaux cohort'es de la view `user_cohorts`
2. Pour chaque cohort, calculez la rétention des 30 derniers jours (ne change plus après les 30 premiers jours)
3. Écrivez le résultat de manière **incrémentale** dans `cohort_retention_summary`

Modèle dbt :

```sql
{{
  config(
    materialized='incremental',
    unique_key=['cohort_date','day_n'],
    partition_by={'field':'cohort_date','data_type':'date'},
    cluster_by=['day_n']
  )
}}

WITH cohorts_to_update AS (
  SELECT DISTINCT cohort_date 
  FROM {{ ref('user_cohorts') }}
  WHERE cohort_date >= CURRENT_DATE() - 31
  {% if is_incremental() %}
    AND cohort_date > (SELECT MAX(cohort_date) FROM {{ this }})
  {% endif %}
),
retention_calc AS (
  SELECT 
    c.cohort_date,
    DATE_DIFF(DATE(e.event_timestamp), c.cohort_date, DAY) AS day_n,
    COUNT(DISTINCT e.user_id) AS retained_users,
    MAX(c.first_day_events) AS cohort_size
  FROM {{ ref('user_cohorts') }} c
  JOIN {{ source('raw','events') }} e 
    ON c.user_id = e.user_id
  WHERE c.cohort_date IN (SELECT cohort_date FROM cohorts_to_update)
    AND DATE(e.event_timestamp) >= c.cohort_date
    AND DATE_DIFF(DATE(e.event_timestamp), c.cohort_date, DAY) <= 30
  GROUP BY 1,2
)
SELECT 
  cohort_date,
  day_n,
  retained_users,
  cohort_size,
  SAFE_DIVIDE(retained_users, cohort_size) AS retention_rate
FROM retention_calc;
```

Ce modèle met à jour uniquement les cohort'es des 31 derniers jours chaque jour. Pour les cohort'es plus anciens que 31 jours, la rétention est fixe — aucun recalcul nécessaire. L'utilisation des slots baisse de 95 %. Dans le processus [CDP & Retention Engineering](https://www.roibase.com.tr/fr/retention-engineering-cdp), cette table est directement liée au tableau de bord — les outils BI (Looker, Metabase) retournent la requête en 100ms.

## Stratégie de Coût de Requête et d'Expiration de Partition

Dans BigQuery, le stockage est peu onéreux ($0,02/Go/mois), le compute est cher ($5/To de données traitées). Puisque l'analyse de rétention est rétrospective, les anciennes partitions sont fréquemment scannées. Deux optimisations :

1. **Expiration de partition :** Supprimez automatiquement les partitions de plus de 90 jours dans la table `events` — après l'achèvement du calcul du cohort, les événements bruts ne sont plus nécessaires.
2. **Mettez à jour régulièrement les statistiques de clustering :** `ANALYZE TABLE ... UPDATE STATISTICS` — l'optimiseur de requêtes choisit un meilleur plan d'exécution.

Exemple de comparaison des coûts (100M d'événements/jour, 1M d'utilisateurs) :

| Approche | Données traitées/jour | Coût compute mensuel |
|---|---|---|
| Requête naïve (scan complet) | 12To | $600 |
| Partitioning + materialized view | 800Go | $40 |
| Table pré-agrégée (incrémentale) | 50Go | $2,50 |

L'ajout de la couche pré-agrégée réduit le coût du compute par un facteur de 240. Cette différence est critique en production — surtout si l'analyse de rétention est rafraîchie chaque heure.

## Compromis de l'Analyse Cohort en Temps Réel

La materialized view et la structure pré-agrégée introduisent un compromis de latence : les données ont un délai de 1 à 5 minutes. Si une analyse de cohort véritablement temps réel est requise (par exemple pour les 24 premières heures), vous pouvez appliquer une approche hybride :

- Pour les 24 dernières heures : insertion en streaming + requête temps réel (cache désactivé)
- Pour les données plus anciennes que 24 heures : table pré-agrégée

Dans ce cas, la requête BI fusionne les deux sources avec UNION ALL :

```sql
SELECT * FROM cohort_retention_summary WHERE cohort_date < CURRENT_DATE()
UNION ALL
SELECT * FROM realtime_cohort_view WHERE cohort_date = CURRENT_DATE();
```

Bien que la view temps réel soit coûteuse, puisqu'elle n'exécute que pour le dernier cohort, l'impact global sur le compute reste limité.

## Segmentation des Cohort'es et Explosion de Cardinalité

Ventiler l'analyse de rétention par segments d'utilisateurs (plateforme, pays, canal d'acquisition) peut déclencher des problèmes de cardinalité. Par exemple, 5 segments × 30 jours × 365 cohort'es = 54 750 lignes uniques. Dans ce cas :

1. **Limitez le nombre de segments :** Analysez sur les 3 à 5 segments les plus importants, créez une table séparée pour les autres.
2. **Segmentation dynamique :** Au lieu d'ajouter les informations de segment à la table pré-agrégée, utilisez un filtrage au moment de la jointure — cela préserve la flexibilité des requêtes mais augmente l'utilisation des slots.
3. **Table rollup :** Créez une table distincte pour les cohort'es hebdomadaires (weekly_cohort_retention) — la cardinalité baisse de 85 %.

Dans le processus [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/fr/verianalizi) de Roibase, la stratégie de segmentation est intégrée à l'attribution de source d'acquisition — l'analyse de cohort est directement liée à la performance des canaux.

## Monitoring et Détection de Régression

Pour surveiller le pipeline de cohort en production, suivez ces métriques :

- **Slot time de requête :** Utilisation des slots BigQuery du refresh quotidien — une augmentation soudaine indique une explosion de cardinalité ou une perte de partition pruning.
- **Row count delta :** Nombre de lignes ajoutées à chaque refresh — s'il dépasse les attentes, il y a un risque d'événements dupliqués.
- **Stddev du taux de rétention :** Un changement soudain > 10 % dans la rétention du Jour 1 est un signal de problème de qualité des données.

Vous pouvez ajouter ces vérifications sous forme de tests dans dbt :

```yaml
tests:
  - dbt_utils.expression_is_true:
      expression: "retention_rate BETWEEN 0 AND 1"
  - dbt_utils.recency:
      datepart: day
      field: cohort_date
      interval: 1
```

Si un test échoue, une alerte Slack/PagerDuty est déclenchée — aucune vérification manuelle n'est attendue.

L'architecture des tables de cohort élève l'analyse de rétention du niveau « requête ad-hoc » au niveau « data product en production ». Avec la materialized view et le refresh incrémentiel, le partitioning et le pruning de requête, l'agrégation préalable et l'optimisation des slots — chaque couche réduit le coût par un facteur de 10. Réaliser une analyse de rétention sur des millions d'utilisateurs et des milliards d'événements se réduit maintenant à une requête dashboard en 100ms. Décider quel pattern de rétention surveiller reste votre responsabilité — mais traiter les données à cette vitesse n'est plus un problème d'ingénierie.