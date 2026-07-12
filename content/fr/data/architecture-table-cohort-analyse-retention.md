---
title: "Architecture de Table Cohort : Mise à l'Échelle de l'Analyse de Rétention en Production"
description: "Materialized views, partitionnement et optimisation des coûts de requête pour dimensionner l'analyse cohort en production. Architecture de table concrète sur BigQuery et dbt."
publishedAt: 2026-07-12
modifiedAt: 2026-07-12
category: data
i18nKey: data-007-2026-07
tags: [cohort-analysis, bigquery, materialized-views, query-optimization, retention]
readingTime: 9
author: Roibase
---

L'analyse de rétention est l'une des métriques les plus critiques des données marketing. Comprendre quel groupe d'utilisateurs reste actif pendant combien de temps, quelle campagne crée une valeur durable — cela exige des tables de cohort robustes. Le problème : les requêtes cohort classiques re-exécutées chaque fois sur des dizaines de millions de lignes de données d'événements font exploser les coûts de requête en production. Construire une architecture cohort qui se met à jour chaque matin, qui retourne les résultats en 3 secondes lorsqu'un analyste lance une requête, tout en minimisant les coûts grâce à une stratégie de partitionnement adéquate — c'est un problème d'ingénierie distinct. Cet article explique pas à pas une architecture de table cohort concrète sur BigQuery et dbt, une stratégie de materialized view et une optimisation des coûts de requête.

## Pourquoi une table cohort doit être séparée

Le calcul de la rétention ne peut pas être effectué à chaque fois à partir de la table d'événements bruts. Si une entreprise e-commerce génère 50 millions d'événements par jour, répondre à la question « Quel est le taux d'activité au jour 30 pour les utilisateurs inscrits en janvier 2026 ? » exige que BigQuery scanne 1,5 milliard de lignes. Cette requête prend 10-15 secondes et traite 200-300 GB. Si l'analyste extrait 20 segments de cohort différents par jour, le coût mensuel des requêtes dépasse $500.

Une table cohort résout ce problème : vous pré-agrégez les données d'événements par groupe et pré-calculez les métriques de chaque cohort pour chaque jour. Ainsi, lorsque l'analyste lance une requête, BigQuery ne scanne que la table cohort, jamais les données d'événements brutes. 1000 cohorts × 90 jours × 5 métriques = 450 000 lignes. Une requête sur cette table prend 200 ms et traite 5 MB.

Mais cette approche elle-même crée un nouveau problème : comment la table cohort est-elle mise à jour ? Chaque jour, lorsque de nouveaux événements arrivent, recalculez-vous toute l'historique ? Travaillez-vous de façon incrémentale ? Quelle stratégie de partitionnement optimise à la fois la performance des requêtes et le coût de mise à jour ? Les réponses à ces questions se trouvent dans la conception de materialized views et de modèles dbt incrémentiels.

## Stratégie de partitionnement : `cohort_date` ou `observation_date` ?

Le choix de la clé de partitionnement de la table cohort est critique. Vous avez deux options : la date de création de la cohort (`cohort_date`) et la date d'observation (`observation_date`).

**Partition `cohort_date` :** Partitionne selon la date de la première activité de l'utilisateur. La cohort de janvier 2026 en une partition, février en une autre. Avantage : lorsqu'une nouvelle cohort est créée, vous n'écrivez que dans cette partition, sans toucher aux anciennes. Inconvénient : récupérer 90 jours de données de rétention pour une même cohort oblige BigQuery à scanner 90 partitions différentes. La performance des requêtes diminue.

**Partition `observation_date` :** Une partition par jour. Pour le 12 juillet, la partition du 12 juillet contient toutes les métriques d'aujourd'hui pour tous les cohorts. Avantage : répondre à des requêtes comme « Tendance de rétention sur les 7 derniers jours » ne scanne que 7 partitions. Inconvénient : vous êtes obligé de mettre à jour tous les cohorts chaque jour, le coût de mise à jour incrémentale est élevé.

La bonne réponse est une **architecture hybride avec deux tables** : une « snapshot table » (partitionnée par `observation_date`) et une « aggregated table » (partitionnée par `cohort_date`). La table snapshot est mise à jour quotidiennement, elle alimente les dashboards de l'analyste. La table agrégée est mise à jour hebdomadairement, elle est utilisée pour des comparaisons de cohorts approfondies. Cette structure suit les bonnes pratiques BigQuery : séparation des tables narrow et wide.

```sql
-- Schéma de la table snapshot (partitionnée par observation_date)
CREATE TABLE `analytics.cohort_retention_snapshot`
PARTITION BY observation_date
CLUSTER BY cohort_date, channel, device_category
AS
SELECT
  observation_date,
  cohort_date,
  channel,
  device_category,
  cohort_size,
  day_n,
  active_users,
  retention_rate
FROM ...
```

## Trade-off entre materialized view et modèle incrémental

Dans BigQuery, une materialized view (MV) effectue un refresh incrémental automatique — lorsque de nouveaux événements arrivent, elle re-exécute la requête de base et cache le résultat. Mais une MV a 3 limitations : nombre de jointures (max 5), utilisation de window functions (non supportée), et gestion des partitions (pas manuelle).

Le calcul cohort implique généralement 3+ jointures (tables users, events, subscriptions) et nécessite des window functions comme `LAG()` ou `FIRST_VALUE()`. Dans ce cas, une MV ne peut pas être utilisée. Alternativement : modèle dbt incrémental.

Un modèle dbt incrémental vous permet de définir une stratégie de fusion personnalisée. Chaque jour, vous ne mettez à jour que les partitions des 7 derniers jours (`WHERE observation_date >= CURRENT_DATE() - 7`). Cette approche réduit le coût des requêtes de 85 %. Exemple de modèle dbt :

```sql
{{ config(
    materialized='incremental',
    partition_by={
      "field": "observation_date",
      "data_type": "date"
    },
    cluster_by=['cohort_date', 'channel'],
    incremental_strategy='insert_overwrite'
) }}

WITH daily_cohorts AS (
  SELECT
    DATE(first_seen_at) AS cohort_date,
    user_id,
    acquisition_channel AS channel
  FROM {{ ref('users') }}
  WHERE first_seen_at IS NOT NULL
),

daily_activity AS (
  SELECT
    DATE(event_timestamp) AS activity_date,
    user_id,
    COUNT(*) AS event_count
  FROM {{ ref('events') }}
  WHERE event_name IN ('page_view', 'purchase')
  {% if is_incremental() %}
    AND DATE(event_timestamp) >= CURRENT_DATE() - 7
  {% endif %}
  GROUP BY 1, 2
)

SELECT
  a.activity_date AS observation_date,
  c.cohort_date,
  c.channel,
  DATE_DIFF(a.activity_date, c.cohort_date, DAY) AS day_n,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT a.user_id) AS active_users,
  SAFE_DIVIDE(COUNT(DISTINCT a.user_id), COUNT(DISTINCT c.user_id)) AS retention_rate
FROM daily_cohorts c
LEFT JOIN daily_activity a
  ON c.user_id = a.user_id
WHERE a.activity_date >= c.cohort_date
{% if is_incremental() %}
  AND a.activity_date >= CURRENT_DATE() - 7
{% endif %}
GROUP BY 1, 2, 3, 4
```

Lorsque ce modèle s'exécute chaque jour, il écrase seulement les partitions des 7 derniers jours. Le coût de traitement BigQuery diminue de 20 GB par jour à 2 GB. Économie annuelle : $2400+ en coûts de requête.

### Sélection de la clé de clustering

Le partitionnement seul ne suffit pas, le clustering est également nécessaire. Une table cohort peut être filtrée sur 3 dimensions : cohort_date (temps), channel (source), device_category (appareil). Dans BigQuery, l'ordre de la clé de clustering est important : le champ avec la cardinalité la plus élevée doit être en premier.

Analyse de cardinalité :
- `cohort_date` : 365 valeurs (1 an)
- `channel` : 15-20 valeurs (organic, paid_search, social, email...)
- `device_category` : 3-4 valeurs (desktop, mobile, tablet)

Ordre correct : `CLUSTER BY cohort_date, channel, device_category`. Cet ordre accélère 10x les requêtes comme « Taux de rétention au jour 30 pour les utilisateurs mobiles d'Instagram du Q4 2025 ».

## Optimisation des coûts de requête : profondeur de pré-agrégation

Le niveau de granularité de la table cohort détermine également l'équilibre coût-performance. Stockez-vous une ligne séparée pour chaque combinaison cohort × channel × device × day_n, ou seulement un total général ?

**Option 1 : Table granulaire** — chaque combinaison cohort × channel × device × day_n en ligne séparée. Nombre total de lignes : 365 cohorts × 20 channels × 4 devices × 90 jours = 2,6 millions de lignes. Avantage : l'analyste peut effectuer un pivot sur le segment souhaité. Inconvénient : coût de stockage plus élevé ($50/TB → ~$0,15 par mois).

**Option 2 : Table agrégée** — seulement cohort × day_n, sans ventilation par channel ou device. Nombre total de lignes : 365 × 90 = 32 850 lignes. Avantage : stockage et coûts de requête minimaux. Inconvénient : impossible de ventiler par channel.

La bonne approche est une **architecture à deux niveaux** : métriques core granulaires (avec ventilation par channel et device), métriques extended agrégées (seulement cohort_date × day_n). Cette structure optimise le stockage tout en maintenant la flexibilité analytique. La table core metrics alimente les dashboards, la table extended metrics est utilisée pour l'analyse ad-hoc.

Définissez également une politique d'expiration de partition BigQuery : les partitions de plus de 90 jours sont automatiquement supprimées. L'analyse de rétention ne regarde généralement pas au-delà de 90 jours, cette politique réduit le coût annuel de stockage de 60 %.

## Résoudre le problème de résolution d'identité au niveau cohort

Le point le plus obscur de l'analyse cohort : les collisions d'user_id et la résolution d'identité. Si un utilisateur s'inscrit sur desktop et effectue des transactions sur mobile, deux user_id différents sont créés. Si la table cohort ne fusionne pas ces deux identités, la rétention est calculée 20 % plus basse.

La solution : avant de créer la table cohort, fusionnez avec la table de graphe d'identité. Le sélecteur `canonical_user_id` que vous avez configuré dans votre processus [Données First-Party & Architecture de Mesure](https://www.roibase.com.tr/fr/firstparty) entre en jeu ici. Dans le modèle dbt, utilisez la vue `users_unified` plutôt que la table `users`.

```sql
WITH unified_users AS (
  SELECT
    canonical_user_id,
    MIN(first_seen_at) AS cohort_date,
    ARRAY_AGG(DISTINCT acquisition_channel IGNORE NULLS ORDER BY first_seen_at LIMIT 1)[OFFSET(0)] AS channel
  FROM {{ ref('users_unified') }}
  GROUP BY 1
)
```

Cette approche calcule correctement la rétention cross-device. En production, elle génère une différence de 15-25 % sur la rétention. Lorsque la table de résolution d'identité est mise à jour, la table cohort doit également être rématérialisée — c'est pourquoi vous devez définir une dépendance dans le DAG dbt :

```yaml
models:
  - name: cohort_retention_snapshot
    config:
      materialized: incremental
    depends_on:
      - ref('users_unified')
```

## Checklist de production : monitoring et alerting

Lorsque la table cohort est déployée en production, surveillez continuellement 3 métriques :

1. **Fraîcheur (Freshness) :** Quand la dernière partition a-t-elle été mise à jour ? Définissez un test `freshness` dans dbt-core, envoyez une alerte Slack si une partition est plus ancienne que 24 heures.
2. **Dérive du nombre de lignes :** Si la cohort_size d'aujourd'hui diffère de celle d'hier de plus de 30 %, il y a un problème dans le pipeline de données. Utilisez une requête BigQuery programmée pour vérifier `STDDEV()`.
3. **Pic de coûts de requête :** Si le coût moyen des requêtes sur la table cohort passe de $0,01 à $0,10, c'est que le partition pruning ne fonctionne pas. Vérifiez la table INFORMATION_SCHEMA.JOBS.

Créez un dashboard Google Cloud Monitoring pour ces 3 métriques. Déclenchez une intégration PagerDuty si un seuil est dépassé. L'architecture cohort de production n'est pas un système « build and forget », il demande une surveillance continue.

Lorsqu'une architecture de table cohort est correctement configurée, l'analyse de rétention devient un produit d'ingénierie : elle se met à jour chaque matin, l'analyste extrait des insights en 3 secondes, les coûts de requête sont prévisibles. La stratégie de partition BigQuery, le modèle dbt incrémental et l'intégration de résolution d'identité sont les 3 piliers de cette architecture. Pour une analyse cohort scalable en production, il faut creuser profondément la technique — mais en retour, vous obtenez des économies mesurables : $5000+ d'économie annuelle en coûts de requête et des métriques de rétention 20 % plus précises.