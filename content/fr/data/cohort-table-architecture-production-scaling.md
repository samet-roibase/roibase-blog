---
title: "Architecture des Tables de Cohortes : Mise à l'Échelle de l'Analyse de Rétention en Production"
description: "Architecture avec materialized views, partitioning et query cost optimization pour requêtes de cohortes sur 100M+ events en 5 secondes."
publishedAt: 2026-06-09
modifiedAt: 2026-06-09
category: verianalizi
i18nKey: data-007-2026-06
tags: [cohort-analysis, bigquery, materialized-views, query-optimization, retention-engineering]
readingTime: 9
author: Roibase
---

Quand vous migrez les métriques de rétention vers un dashboard temps réel, le premier choc arrive sur le coût des requêtes. Une requête de cohorte basique — « combien d'utilisateurs enregistrés le 1er janvier sont actifs au jour 7 ? » — écrite naïvement scan 200GB de données, s'exécute en 18 secondes et coûte 4 dollars. Pour une équipe avec 500 consultations de dashboard par jour, ce calcul atteint 60 000 dollars par mois. Le problème ne vient pas de votre capacité analytique, mais de l'architecture de vos tables. Pour amener l'analyse de cohorte en production, vous devez stocker des snapshots de cohortes, non les données brutes d'événements.

## Requête de Cohorte Naïve : Pourquoi Cela N'Évolue Pas

Une requête de cohorte classique joint trois tables : `users`, `events`, `cohort_definitions`. À chaque exécution, la table `events` est scannée sans filtre de partition. Avec 100M d'événements quotidiens, cette approche devient intenable.

```sql
-- ❌ Anti-pattern : Scanner tous les events à chaque fois
SELECT 
  DATE_TRUNC(u.created_at, DAY) AS cohort_date,
  DATE_DIFF(e.event_date, u.created_at, DAY) AS day_n,
  COUNT(DISTINCT u.user_id) AS retained_users
FROM users u
JOIN events e ON u.user_id = e.user_id
WHERE u.created_at >= '2026-01-01'
  AND e.event_name = 'session_start'
GROUP BY 1, 2
ORDER BY 1, 2;
```

Cette requête scan 480GB pour 6 mois de données. Sur BigQuery, l'utilisation des slots prend 12 secondes et coûte 2,40 dollars (tarification à la demande : 5$/TB). Si vous multipliez la même cohorte par 20 métriques différentes (revenu, nombre de sessions, taux de conversion), le coût monte à 48 dollars. Si le dashboard se rafraîchit 100 fois par jour, le coût mensuel atteint 144 000 dollars. Pour adapter le problème à la production, deux stratégies existent : **materialization incrémentale** et **snapshots de cohortes pré-agrégés**.

### Materialization Incrémentale : Pipeline Event-to-Cohorte avec dbt

Au lieu de recalculer les cohortes à chaque fois, mettez à jour quotidiennement une table cumulée via des batches. La stratégie `incremental` de dbt vous permet d'ajouter les événements du nouveau jour à votre table de cohorte existante.

```sql
-- models/cohort_retention_daily.sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'cohort_date', 'data_type': 'date'},
    cluster_by=['day_n', 'metric_name'],
    unique_key='cohort_date || day_n || metric_name'
  )
}}

WITH new_events AS (
  SELECT 
    u.user_id,
    DATE_TRUNC(u.created_at, DAY) AS cohort_date,
    DATE_DIFF(e.event_date, u.created_at, DAY) AS day_n,
    e.event_name,
    e.revenue_usd
  FROM {{ ref('events') }} e
  JOIN {{ ref('users') }} u ON e.user_id = u.user_id
  {% if is_incremental() %}
  WHERE e.event_date = CURRENT_DATE() - 1  -- Uniquement les données d'hier
  {% endif %}
)
SELECT
  cohort_date,
  day_n,
  'active_users' AS metric_name,
  COUNT(DISTINCT user_id) AS metric_value
FROM new_events
WHERE event_name = 'session_start'
GROUP BY 1, 2, 3

UNION ALL

SELECT
  cohort_date,
  day_n,
  'revenue_per_cohort' AS metric_name,
  SUM(revenue_usd) AS metric_value
FROM new_events
GROUP BY 1, 2, 3;
```

À la première exécution (full refresh), toutes les données historiques sont traitées. Ensuite, seul 1 jour de nouveaux événements est ajouté quotidiennement. Un jour représentant 100M événements scan 3,2GB de données (grâce au partitioning et clustering), la requête prend 4 secondes, le coût est 0,016 dollar. Coût incrémental mensuel total : 0,48 dollar — un 300 000ème du coût de la méthode naïve.

## Materialized Views : Couche de Cache Automatique de BigQuery

Le modèle incrémental se rafraîchit par batch (une fois par jour). Si vous voulez ajouter les données de la dernière heure à un dashboard temps réel, la fonctionnalité **materialized view** de BigQuery entre en jeu. Une materialized view stocke physiquement le résultat de la requête de base et se rafraîchit automatiquement quand les tables source changent.

```sql
CREATE MATERIALIZED VIEW `project.dataset.cohort_retention_mv`
PARTITION BY cohort_date
CLUSTER BY day_n, metric_name
AS
SELECT
  DATE_TRUNC(u.created_at, DAY) AS cohort_date,
  DATE_DIFF(e.event_date, u.created_at, DAY) AS day_n,
  'active_users' AS metric_name,
  COUNT(DISTINCT u.user_id) AS metric_value
FROM `project.dataset.events` e
JOIN `project.dataset.users` u ON e.user_id = u.user_id
WHERE e.event_date >= CURRENT_DATE() - 90  -- Fenêtre de 90 jours seulement
  AND e.event_name = 'session_start'
GROUP BY 1, 2, 3;
```

Quand vous interrogez une materialized view, BigQuery retourne d'abord le résultat en cache. Si une table source change (un nouvel événement est ajouté), le delta est calculé en arrière-plan. La requête du dashboard prend maintenant 0,2 secondes, le coût est de 0 dollar (cache hit). Cependant, attention : la materialized view elle-même crée un coût de stockage (BigQuery storage : 0,02$/GB/mois) et si votre table de cohorte 90 jours fait 12GB, le coût de stockage mensuel supplémentaire est 0,24 dollar.

**Tableau comparatif :**

| Approche | Durée 1ère Requête | Durée Requête Dashboard | Coût Compute Mensuel | Coût Storage Mensuel |
|----------|-------------------|------------------------|----------------------|----------------------|
| Naive JOIN | 12s | 12s | 144 000$ | 0$ |
| dbt Incremental | 4s (1er batch) | 2s (lecture snapshot) | 0,48$ | 0,18$ (table snapshot) |
| Materialized View | 8s (1ère build) | 0,2s (cache hit) | 0$ (rafraîchissement auto) | 0,24$ |

En production, la combinaison des deux est idéale : le **modèle incrémental dbt** met à jour les cohortes historiques par batch quotidien, tandis que la **materialized view** maintient les 7 derniers jours en temps réel.

## Partitioning et Clustering : Réduire le Coût des Requêtes de 97%

Si vous ne partitionnez et clustérisez pas vos tables de cohortes, BigQuery scanne toute la table à chaque requête. Sur une table de cohorte de 1TB (2 ans de données), une simple requête « affiche la cohorte de janvier 2026 » scanne 1TB, coûte 5 dollars. Avec partitioning + clustering, la même requête scanne 8GB, paie 0,04 dollar.

**Stratégie de partitioning :** Partitionnez par `cohort_date` au jour. Si BigQuery voit un filtre de partition dans la requête, il scanne uniquement les partitions concernées.

```sql
CREATE OR REPLACE TABLE `project.dataset.cohort_retention`
PARTITION BY cohort_date
CLUSTER BY day_n, metric_name
AS
SELECT * FROM `project.dataset.cohort_retention_temp`;
```

**Clustering :** Au sein d'une partition, si vous spécifiez les champs fréquemment filtrés (par exemple `day_n`, `metric_name`) comme colonnes de clustering, BigQuery effectue un pruning au niveau des blocs. Une requête « affiche la rétention jour 7 + métrique active_users » scanne uniquement les blocs pertinents.

Exemple concret : 365 partitions (quotidiennes), chaque partition 3GB. Sans clustering, un filtre « day_7 » scanne 365 partitions × 3GB = 1TB. Avec clustering, seuls les blocs `day_n=7` sont scannés, soit 12GB au total. Différence de coût : 5$ → 0,06$.

**Anti-pattern :** Ne clustérisez pas par `user_id`. L'analyse de cohorte n'est pas agrégation au niveau utilisateur mais au niveau cohorte. Un ordre de clustering par `user_id` n'aide pas le query planner et réduit même l'efficacité du cache.

## Identity Resolution pour la Précision des Cohortes

La précision de l'analyse de cohorte dépend de la précision de `user_id`. Quand une session anonyme (cookie) devient une session authentifiée (login), une requête naïve crée deux enregistrements de cohorte distincts. Vous résolvez ce problème via [First-Party Data & Architecture de Mesure](https://www.roibase.com.tr/fr/firstparty) : construisez un graphe d'identités entre `client_id` anonyme et `user_id` authentifié.

```sql
-- Table de résolution d'identités
CREATE TABLE `project.dataset.identity_graph` (
  canonical_user_id STRING,
  client_id STRING,
  user_id STRING,
  merged_at TIMESTAMP
)
PARTITION BY DATE(merged_at)
CLUSTER BY canonical_user_id;

-- Joindre avec la requête de cohorte
WITH resolved_users AS (
  SELECT 
    COALESCE(ig.canonical_user_id, e.user_id) AS user_id,
    e.event_date,
    e.event_name
  FROM events e
  LEFT JOIN identity_graph ig 
    ON e.client_id = ig.client_id OR e.user_id = ig.user_id
)
SELECT 
  DATE_TRUNC(u.created_at, DAY) AS cohort_date,
  DATE_DIFF(r.event_date, u.created_at, DAY) AS day_n,
  COUNT(DISTINCT r.user_id) AS retained_users
FROM resolved_users r
JOIN users u ON r.user_id = u.user_id
GROUP BY 1, 2;
```

Sans identity resolution, les cohortes se gonflent de 12-18% (un utilisateur est enregistré sous deux ID différents). Cette erreur fait paraître les métriques de rétention basses, car le dénominateur (taille de la cohorte) s'agrandit mais l'activité au jour n reste identique.

## Suivi du Coût des Requêtes : Monitoring Production via INFORMATION_SCHEMA

Une fois votre architecture de cohortes mise en place, vous devez continuellement optimiser le coût des requêtes. La table `INFORMATION_SCHEMA.JOBS` de BigQuery affiche le nombre de bytes scanné par chaque requête, l'utilisation des slots et le coût total.

```sql
SELECT
  user_email,
  query,
  total_bytes_processed / POW(10, 12) AS tb_processed,
  (total_bytes_processed / POW(10, 12)) * 5 AS cost_usd,
  total_slot_ms / 1000 / 60 AS slot_minutes
FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
  AND statement_type = 'SELECT'
  AND query LIKE '%cohort_retention%'
ORDER BY total_bytes_processed DESC
LIMIT 20;
```

Cette requête liste les 7 derniers jours de requêtes sur vos tables de cohortes, triées par coût. Si un panneau de dashboard s'exécute 500 fois par jour et scanne 80GB à chaque fois (filtre de partition manquant), vous avez 500 × 80GB × 5$/TB = 200$ de coût quotidien. Dans ce cas, ajouter un filtre `WHERE cohort_date >= CURRENT_DATE() - 30` au query du panneau réduit le coût à 6$.

**Checklist de production :**
- [ ] Toutes les tables de cohortes sont-elles partitionnées par `cohort_date` ?
- [ ] `day_n` et `metric_name` sont-ils clustérisés ?
- [ ] Le job dbt incremental s'exécute-t-il quotidiennement ?
- [ ] La materialized view est-elle limitée à une fenêtre de 90 jours ?
- [ ] Les requêtes du dashboard contiennent-elles un filtre `WHERE cohort_date >= ...` ?
- [ ] Générez-vous un rapport de coût hebdomadaire via `INFORMATION_SCHEMA` ?

Quand l'architecture de cohortes est correctement construite, l'analyse de rétention devient production-ready : 100M d'événements quotidiens, requêtes en 5 secondes, coût compute mensuel de 10 dollars. Cependant, cette architecture requiert identity resolution first-party, standardisation de schéma d'événements et discipline du pipeline dbt — c'est pourquoi l'engineering de rétention est une plateforme, pas du SQL ponctuel.