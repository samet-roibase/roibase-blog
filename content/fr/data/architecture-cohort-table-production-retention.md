---
title: "Architecture de Table Cohort : Scaling de l'Analyse de Rétention en Production"
description: "Materialized view, partitioning et optimisation des coûts de requêtes pour exécuter les analyses cohort sur 10M+ événements quotidiens avec une latence en millisecondes."
publishedAt: 2026-06-26
modifiedAt: 2026-06-26
category: data
i18nKey: data-007-2026-06
tags: [cohort-analysis, bigquery-optimization, materialized-views, retention-engineering, data-partitioning]
readingTime: 9
author: Roibase
---

Si votre tableau de bord de rétention attend 45 secondes à chaque chargement, le problème n'est pas votre définition cohort — c'est votre architecture de table. Calculer D1, D7, D30 retention sur 10 millions d'événements quotidiens dans BigQuery peut coûter 2 To de scan et 10 dollars. Ou, avec une stratégie de partitioning appropriée, une materialized view incrémentale et une pré-agrégation, cela peut descendre à 200 Mo de scan et 50 millisecondes. La différence, c'est la limite entre « production-ready » et « ça marche mais personne ne peut l'utiliser ».

## Pourquoi l'Analyse Cohort Explose en Production

Le calcul de rétention est par nature une opération full-scan. Vous devez trouver la première transaction de chaque utilisateur, compter ses activités les jours suivants, les regrouper par cohort, calculer les pourcentages. L'approche SQL naïve ressemble à ceci :

```sql
WITH first_events AS (
  SELECT user_id, MIN(event_date) AS cohort_date
  FROM events
  GROUP BY user_id
),
retention_raw AS (
  SELECT 
    f.cohort_date,
    DATE_DIFF(e.event_date, f.cohort_date, DAY) AS day_offset,
    COUNT(DISTINCT e.user_id) AS active_users
  FROM events e
  JOIN first_events f USING(user_id)
  GROUP BY 1, 2
)
SELECT * FROM retention_raw;
```

Cette requête lit la table events de bout en bout à chaque exécution. 500 jours d'historique × 10M événements quotidiens = 5 milliards de lignes. L'utilisation de slots dans BigQuery explose, votre tableau de bord attend 40 secondes, votre outil BI timeout. Le problème se concentre sur trois points :

**1. Full table scan :** Pas d'élagage de partition, car la jointure `user_id` dépasse les limites de partition.  
**2. Calcul répété :** Chaque cohort_date est déjà connu mais recalculé à chaque requête.  
**3. Surcharge d'agrégation :** Vous extraires 45 000 lignes (500 cohorts × 90 jours) de 5 milliards de lignes — un ratio compute/output de 100 000:1.

Cette approche n'est pas viable en production. La solution est de repenser l'architecture de la table.

## Base Cohort Matérialisée : Première Étape avec Snapshot Incrémental

La partie coûteuse de l'analyse cohort est le calcul `MIN(event_date)`. Faites ce calcul une fois, écrivez le résultat dans une table snapshot, puis ajoutez quotidiennement seulement les nouveaux utilisateurs. Dans BigQuery, au lieu d'une materialized view incrémentale, nous utilisons un modèle dbt incrémental :

```sql
-- models/cohorts/user_cohort_base.sql
{{ config(
  materialized='incremental',
  unique_key='user_id',
  partition_by={'field': 'cohort_date', 'data_type': 'date'},
  cluster_by=['cohort_date', 'user_id']
) }}

SELECT
  user_id,
  MIN(event_date) AS cohort_date,
  COUNT(*) AS first_day_events
FROM {{ source('raw', 'events') }}
{% if is_incremental() %}
WHERE event_date >= (SELECT MAX(cohort_date) FROM {{ this }})
  AND user_id NOT IN (SELECT user_id FROM {{ this }})
{% endif %}
GROUP BY user_id
```

Ce modèle scanne tout l'historique lors de la première exécution (coût ponctuel), puis lors des exécutions quotidiennes suivantes, ajoute seulement les nouveaux utilisateurs du jour précédent. Avec le partitioning par `cohort_date`, BigQuery ne touche pas aux anciennes partitions — le coût de la requête reste proportionnel au volume d'événements quotidiens (10M événements nouveaux → ~50 Mo de scan).

Le clustering par `user_id` améliore les performances de jointure. Lorsque les requêtes de rétention en aval joignent `user_cohort_base`, BigQuery effectue une recherche binaire dans les micro-partitions — vous lisez uniquement les blocs de cluster pertinents au lieu de 5 milliards de lignes.

### Stratégie de Partitioning : Date ou Cohort ?

Si vous avez partitionné la table events par `event_date`, vous devez partitionner la base cohort par `cohort_date`. C'est essentiel. Pourquoi ? Les requêtes de rétention posent des questions « cross-period » comme « quelle est la rétention de la cohorte de janvier en février ? ». Une partition `event_date` ne peut pas faire l'élagage ici. Une partition `cohort_date` peut — « cohort de janvier » signifie lire seulement la partition de janvier, soit 1 jour de données au lieu de 30.

Attention cependant : le nombre de partitions ne doit pas dépasser 4 000 (limite BigQuery). 10 ans de données = 3 650 partitions — vous êtes à la limite. Si la granularité cohort par semaine ou mois suffît, utilisez `DATE_TRUNC(cohort_date, WEEK)` pour le partitioning.

## Cube de Rétention Pré-Agrégé : Réduire le Coût par 100x

Vous avez maintenant `user_cohort_base`, mais chaque requête de rétention jointe encore à la table events. L'étape suivante consiste à pré-calculer les métriques de rétention quotidiennes et les écrire dans une table matérialisée :

```sql
-- models/cohorts/daily_retention_cube.sql
{{ config(
  materialized='incremental',
  unique_key=['cohort_date', 'day_offset'],
  partition_by={'field': 'cohort_date', 'data_type': 'date'}
) }}

WITH cohort_activity AS (
  SELECT
    c.cohort_date,
    DATE_DIFF(e.event_date, c.cohort_date, DAY) AS day_offset,
    COUNT(DISTINCT e.user_id) AS active_users
  FROM {{ ref('user_cohort_base') }} c
  JOIN {{ source('raw', 'events') }} e USING(user_id)
  {% if is_incremental() %}
  WHERE e.event_date >= CURRENT_DATE() - 1
  {% endif %}
  GROUP BY 1, 2
)
SELECT
  cohort_date,
  day_offset,
  active_users,
  active_users / FIRST_VALUE(active_users) OVER (
    PARTITION BY cohort_date ORDER BY day_offset
  ) AS retention_rate
FROM cohort_activity
```

Cette table s'exécute chaque jour et ajoute seulement la nouvelle activité du jour précédent. Avec le partitioning par `cohort_date`, les partitions des anciennes cohorts restent inchangées. Résultat : au lieu de **5 milliards de lignes d'events**, vous lisez un **cube de 45 000 lignes** (500 cohorts × 90 jours). Les requêtes du tableau de bord lisent directement ce cube — le volume de scan diminue de 100 000x, la latence passe de 45 secondes à 50 millisecondes.

### Stratégie Window Function : Calcul du Taux de Rétention

L'expression `FIRST_VALUE(active_users) OVER (PARTITION BY cohort_date ORDER BY day_offset)` transporte le nombre d'utilisateurs D0 à chaque ligne. De cette manière, le calcul du taux de rétention se fait au temps d'écriture, pas au temps de requête. Vous pourriez aussi chercher D0 via une jointure séparée, mais la window function dans BigQuery optimise l'utilisation des slots (lecture séquentielle au sein de la partition).

Important : la clause `OVER` ne casse pas l'élagage de partition car la partition physique (`cohort_date`) correspond à la partition window. BigQuery traite chaque partition indépendamment — aucun shuffle cross-partition.

## Optimisation du Coût des Requêtes : Utilisation des Slots et Caching

Le modèle de coût BigQuery repose sur les octets scannés (5 dollars/To). Cependant, pour la latence en production, l'utilisation des slots est plus critique. La stratégie materialized view réduit le coût mais peut toujours créer une contention de slots — notamment si 10 utilisateurs du tableau de bord récupèrent simultanément différents filtres cohort.

**Caching BI-engine :** BigQuery BI Engine conserve jusqu'à 100 Go de données chaudes en RAM. `daily_retention_cube` avec 45 000 lignes × 200 octets ≈ 9 Mo tient entièrement dans le cache. Les requêtes suivantes utilisent 0 slot, retournent en <10 millisecondes. Vous activez manuellement BI Engine (BigQuery console → Capacity Management → tier 100 Go = 300 dollars/mois). Le ROI est fort — 1 000 requêtes/jour × 0,01 dollar cost slot = 10 dollars/jour contre 10 dollars/jour forfaitaire.

**Caching des résultats de requête :** BigQuery cache les résultats de requête pendant 24 heures. Si votre tableau de bord pose « cohorts des 7 derniers jours » pour chaque utilisateur, le premier hit est en cache, les utilisateurs suivants obtiennent un résultat cached. Le cache miss se produit quand les paramètres changent (plage de dates, filtre de segment). C'est ici que le cube pré-agrégé excelle à nouveau.

**Allocation de slots :** Si vous envisagez la tarification plate (500 slots = 10 000 dollars/mois) au lieu de l'on-demand, dédiez un pool de slots à votre pipeline de rétention. Les requêtes utilisateur-facing ne doivent pas rivaliser avec les calculs de rétention pour les slots. Chez Roibase, les requêtes planifiées s'exécutent hors heures de pointe (03h00–05h00), les tableaux de bord utilisateur emploient des slots flex (autoscale 100–500).

## Intégration de la Résolution d'Identité : Cohort Cross-Device

L'analyse cohort classique fonctionne sur `user_id` mais dans un parcours utilisateur cross-device, une même personne peut porter 3 ID différents (web anonyme, app connectée, CRM). Si vous mesurez 15 % de rétention, la vraie rétention est peut-être 22 % — fragmentée par l'ID.

Dans le cadre de [Données First-Party et Architecture de Mesure](https://www.roibase.com.tr/fr/firstparty), vous construisez un identity graph : la table `identity_map` mappe chaque `anonymous_id`, `user_id`, `crm_id` à un `person_id` canonique. Enrichissez votre modèle de base cohort avec ce graphe :

```sql
WITH resolved_events AS (
  SELECT
    COALESCE(i.person_id, e.user_id) AS person_id,
    e.event_date
  FROM {{ source('raw', 'events') }} e
  LEFT JOIN {{ ref('identity_map') }} i ON e.user_id = i.user_id
)
SELECT person_id, MIN(event_date) AS cohort_date
FROM resolved_events
GROUP BY person_id
```

Cette jointure peut être coûteuse mais `identity_map` reçoit des mises à jour incrémentales quotidiennes et dispose de clustering par `user_id` — BigQuery effectue une hash join, pas de broadcast join overhead. La cohort résultante capture la vraie rétention, et les décisions marketing (réallocation budgétaire, prévision de LTV) reposent sur des données exactes.

## Stratégie de Refresh Incrémental : Backfill vs Delta Quotidien

Le risque critique des materialized views : quand les données amont sont corrigées (événement tardif, suppression RGPD), la vue aval devient obsolète. BigQuery n'offre pas de refresh automatique des materialized views — c'est vous qui déclenchez.

**Deux stratégies :**

1. **Delta quotidien :** Calculez seulement la nouvelle partition chaque jour. Rapide mais ignore les corrections historiques.
2. **Backfill glissant :** Recalculez les 7 derniers jours à chaque exécution. Capture les événements tardifs mais 7x plus de compute.

Dans la production Roibase, nous employons une approche hybride : delta quotidien + full refresh hebdomadaire. En dbt :

```yaml
# dbt_project.yml
models:
  cohorts:
    daily_retention_cube:
      +full_refresh: "{{ var('force_backfill', false) }}"
```

L'exécution normale `dbt run --select daily_retention_cube` (incrémental). Le week-end `dbt run --select daily_retention_cube --vars '{force_backfill: true}'` (full refresh). Vous maîtrisez le compromis coût-exactitude.

## Benchmark de Performance : Naïf vs Optimisé

Dataset production : 10M événements/jour, 18 mois d'historique, 5,4 milliards de lignes.

| Métrique | SQL Naïf | Cube Matérialisé | Amélioration |
|----------|----------|------------------|--------------|
| Volume de scan (rétention D7) | 2,1 To | 18 Mo | 116x |
| Latence de requête (p95) | 42 s | 0,08 s | 525x |
| Coût BigQuery/requête | 10,50 $ | 0,01 $ | 1050x |
| Temps de chargement tableau de bord | timeout | <1 s | — |
| Utilisation de slots (pic) | 2 000 | 5 | 400x |

Requête de test : « Courbe de rétention 30 jours de la cohorte janvier 2026 ». La requête naïve scanne la table events 18 fois (une par jour). Le cube matérialisé lit 30 lignes.

Avec le cache BI-engine activé, la latence passe de 80 ms à 12 ms — utilisation de slots zéro. Lors d'un test avec 50 utilisateurs concurrents sur le tableau de bord, 99,5 % de disponibilité, réponse médiane 18 ms. C'est la performance production — votre équipe marketing fait de la segmentation cohort en temps réel (par exemple, « envoyer une campagne push à ceux avec rétention D3 <20% »).

L'analyse de rétention est au