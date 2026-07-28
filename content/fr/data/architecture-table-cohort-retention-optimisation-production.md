---
title: "Architecture de Table Cohort : Mise à l'Échelle de l'Analyse de Rétention en Production"
description: "Découvrez comment dimensionner les tables d'analyse de cohort en production avec materialized views, partitioning et optimisation des coûts de requête."
publishedAt: 2026-07-28
modifiedAt: 2026-07-28
category: data
i18nKey: data-007-2026-07
tags: [analyse-cohort, bigquery, materialized-views, data-engineering, retention]
readingTime: 9
author: Roibase
---

Chaque organisation qui pratique l'analyse de rétention bute sur le même mur : les requêtes de cohort s'exécutent en 30 secondes en production, ou la facture BigQuery atteint 8 000 $ par mois. La requête `GROUP BY user_id, cohort_week` qui fonctionnait proprement avec 100K utilisateurs en test s'effondre face à 50M d'utilisateurs et 2 ans de logs d'événements. La solution n'est pas simple — ajouter un index ou activer un cache ne suffira pas. Il faut redesigner l'architecture de la table entièrement pour la charge de travail retention.

## Pourquoi l'Analyse de Cohort Exige une Architecture Différente

Une table d'événements classique est construite sur `user_id`, `event_time`, `event_name`. Chaque requête de cohort scanne des milliards de lignes historiques, groupant les utilisateurs par la date du premier événement. Dans BigQuery, la requête ressemble à :

```sql
WITH cohorts AS (
  SELECT user_id, DATE_TRUNC(MIN(event_time), WEEK) AS cohort_week
  FROM events
  GROUP BY user_id
),
retention AS (
  SELECT 
    c.cohort_week,
    DATE_DIFF(DATE_TRUNC(e.event_time, WEEK), c.cohort_week, WEEK) AS weeks_since_cohort,
    COUNT(DISTINCT e.user_id) AS active_users
  FROM cohorts c
  JOIN events e ON c.user_id = e.user_id
  GROUP BY 1, 2
)
SELECT * FROM retention ORDER BY 1, 2;
```

À chaque exécution, cette requête lit la table `events` entièrement. 500M lignes × 16 octets en moyenne = 8 GB scanné. À $6,25 par TB chez BigQuery, 1 000 requêtes = 50 $. Si votre dashboard rafraîchit tous les 5 minutes, 8 640 requêtes par mois = 432 $ pour le seul widget cohort. Ajoutez dix analystes supplémentaires, des bots Slack qui déclenchent des requêtes, et les coûts s'envolent.

Le vrai problème n'est même pas le coût — c'est la latence. Un JOIN sur 500M lignes prend 15 à 30 secondes. L'utilisateur modifie un filtre dans le dashboard, puis attend 20 secondes pour les nouvelles données cohort. L'analyse de rétention ne peut pas être itérative avec ces délais.

### Materialized View : un Premier Pas Insuffisant

Une materialized view BigQuery pré-calcule la requête de cohort :

```sql
CREATE MATERIALIZED VIEW cohort_retention AS
SELECT 
  cohort_week,
  weeks_since_cohort,
  active_users
FROM retention; -- le résultat de la CTE ci-dessus
```

Maintenant, le dashboard lit `cohort_retention` au lieu de `events`. Le scan : 8 GB → 80 MB. La latence : 20 secondes → 800 ms. Mais deux limites émergent :

1. **Coût du rafraîchissement :** À chaque refresh, la materialized view réexécute la requête de base. Soit 8 GB scannés. Si vous rafraîchissez la view une fois par heure, 24 × 8 GB = 192 GB/jour = 5,8 TB/mois scannés. Le coût n'a pas baissé, seulement la latence.
2. **Manque de flexibilité :** La materialized view est statique. L'utilisateur ajoute un filtre « Rétention cohort Android », la view doit être recalculée. Vous ne pouvez pas ajouter `WHERE platform = 'Android'` à l'avance — chaque filtre demande une view différente.

C'est pourquoi l'architecture cohort doit être tricouche : événements bruts → table d'affectation de cohort → table de rétention agrégée.

## Isoler la Table d'Affectation de Cohort

Commencez par créer une table séparée qui assigne chaque utilisateur à son cohort. Cette table contient seulement `user_id` et `cohort_week`, dérivée du log d'événements mais calculée une fois par jour :

```sql
CREATE OR REPLACE TABLE cohort_assignments
PARTITION BY cohort_week
CLUSTER BY user_id
AS
SELECT 
  user_id,
  DATE_TRUNC(MIN(event_time), WEEK) AS cohort_week,
  MIN(event_time) AS first_seen_at
FROM events
WHERE event_time >= '2024-01-01'
GROUP BY user_id;
```

Cette table :
- **Partition par cohort_week :** BigQuery crée des blocs de fichiers séparés par semaine. Un filtre `WHERE cohort_week = '2026-01-05'` ne lit qu'une partition.
- **Cluster par user_id :** Au sein de chaque partition, le stockage est trié par user_id. Les JOIN s'accélèrent.
- **Taille :** 50M utilisateurs × 3 colonnes × 16 octets = ~2,4 GB. Comparé aux 500 GB du log d'événements, c'est 200× plus petit.

Maintenant, la requête de rétention utilise cette table :

```sql
SELECT 
  c.cohort_week,
  DATE_DIFF(DATE_TRUNC(e.event_time, WEEK), c.cohort_week, WEEK) AS weeks_since,
  COUNT(DISTINCT e.user_id) AS active_users
FROM cohort_assignments c
JOIN events e ON c.user_id = e.user_id
WHERE c.cohort_week >= '2026-01-01'
GROUP BY 1, 2;
```

Avec le partition pruning, la lecture de 4 semaines de `cohort_assignments` = 200 MB scannés. Le JOIN traite toujours `events`, mais commence à partir d'utilisateurs filtrés par cohort — pas de surcharge inutile.

### Mise à Jour Incrémentale

`cohort_assignments` se renouvelle quotidiennement, mais pas de zéro. Utilisez un modèle incrémental dbt :

```sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'cohort_week', 'data_type': 'date'},
    cluster_by=['user_id']
  )
}}

SELECT 
  user_id,
  DATE_TRUNC(MIN(event_time), WEEK) AS cohort_week,
  MIN(event_time) AS first_seen_at
FROM {{ ref('events') }}
{% if is_incremental() %}
  WHERE event_time > (SELECT MAX(first_seen_at) FROM {{ this }})
{% endif %}
GROUP BY user_id
```

Ce modèle traite tous les historiques à la première exécution, puis ajoute seulement les nouveaux utilisateurs. Scan : 500 GB → 2 GB par jour.

## Table de Rétention Agrégée : Pré-Calcul au Niveau Hebdomadaire

`cohort_assignments` accélère les requêtes de rétention, mais le dashboard JOIN'e toujours `events` à la demande. Un pas supplémentaire : pré-calculez les métriques de rétention au niveau hebdomadaire, stockées dans une table séparée.

```sql
CREATE TABLE cohort_retention_weekly
PARTITION BY cohort_week
CLUSTER BY weeks_since_cohort
AS
SELECT 
  c.cohort_week,
  DATE_DIFF(DATE_TRUNC(e.event_time, WEEK), c.cohort_week, WEEK) AS weeks_since_cohort,
  COUNT(DISTINCT e.user_id) AS active_users,
  COUNT(*) AS total_events,
  APPROX_QUANTILES(session_duration, 100)[OFFSET(50)] AS median_session_duration
FROM cohort_assignments c
JOIN events e ON c.user_id = e.user_id
GROUP BY 1, 2;
```

Cette table :
- **Taille :** 52 semaines × 52 weeks_since × 3 métriques = ~8 100 lignes (pour 1 an de données). À l'échelle de quelques KB.
- **Scan :** Le dashboard lit `cohort_retention_weekly`, zéro lecture de `events`. Scan < 1 MB.
- **Latence :** BigQuery lit 1 MB en ~80 ms. Le dashboard atteint le sub-seconde.

Tradeoff : cette table doit être renouvelée quotidiennement. Si les données doivent être à jour, rafraîchissez chaque heure (schedule dbt `0 * * * *`). Le coût du refresh : JOIN cohort_assignments avec events, ~10 GB scannés. 24× par jour = 240 GB, ~7,2 TB/mois. Comparaison : si le dashboard exécutait 1 000 requêtes cohort sans pré-agrégation, 8 TB scannés. La table agrégée réduit le scan de %10, mais la latence passe de 20 secondes à 80 ms.

### Stratégie de Partitioning : Cohort Week vs Event Week

Faut-il partitionner la table de rétention cohort par `cohort_week` ou `event_week` ? Deux approches :

**Partition par cohort_week :**
- Cas d'usage : « Quelle est la courbe de rétention de la cohort 2026-W03 ? »
- Pruning : `WHERE cohort_week = '2026-01-13'` → 1 partition lue
- Défi : Si le dashboard demande « rétention totale des 4 dernières semaines », 4 partitions sont lues. Mais comme 80 % des requêtes de rétention se font par cohort, c'est optimal.

**Partition par event_week :**
- Cas d'usage : « Quelles cohorts étaient actives cette semaine ? »
- Pruning : `WHERE event_week = '2026-07-21'` → 1 partition
- Défi : Ajouter un filtre cohort désactive le pruning ; toutes les partitions sont lues.

Roibase partitionne par cohort_week dans les [architectures d'analyse de données](https://www.roibase.com.tr/fr/verianalizi), car 80 % des requêtes suivent le motif « Cohort X, semaine N ».

## Optimisation des Coûts de Requête : Clustering et BI Engine

Le partitioning élimine les blocs de fichiers (pruning de haut en bas), le clustering ordonne les lignes (pruning de gauche à droite). Ensemble, ils minimisent les scans.

```sql
CREATE TABLE cohort_retention_weekly
PARTITION BY cohort_week
CLUSTER BY weeks_since_cohort, platform, country;
```

Une requête `WHERE weeks_since_cohort = 4 AND platform = 'iOS'` :
1. Partition pruning → lit seulement les partitions cohort_week pertinentes
2. Clustering → au sein de la partition, localise d'abord `weeks_since_cohort = 4`, puis `platform = 'iOS'`

BigQuery accepte maximum 4 colonnes de clustering. L'ordre compte : placez la colonne la plus filtrée en premier.

**BI Engine :** La couche cache in-memory de BigQuery. Si vous réservez 100 GB BI Engine, les tables fréquemment consultées restent en RAM. `cohort_retention_weekly` fait 50 MB, reste entièrement dans BI Engine. Un scan cache = zéro scan facturé. Coût : 100 GB = $100/mois. Bénéfice : économies sur 10 TB de scan = $62,50. ROI positif.

### Fonctions d'Approximation : Métriques Non-Critiques

Certaines métriques cohort exigent de l'exactitude (`COUNT(DISTINCT user_id)`), d'autres tolèrent l'approximation (durée médiane de session, percentiles).

Les fonctions approximatives BigQuery :
- `APPROX_COUNT_DISTINCT(user_id)` → marge d'erreur 2 %, 10× plus rapide
- `APPROX_QUANTILES(value, 100)[OFFSET(50)]` → médiane, ~1 % d'erreur
- `APPROX_TOP_COUNT(event_name, 10)` → les 10 événements les plus fréquents

Exemple : pour 50M utilisateurs, `COUNT(DISTINCT ...)` exact prend 8 secondes, `APPROX_COUNT_DISTINCT` prend 800 ms. Pour un dashboard avec filtres temps réel, utilisez l'approximation ; pour les rapports finaux, l'exact.

## Stratégie de Mise à Jour Incrémentale : Event-Time vs Processing-Time

Quand `cohort_assignments` se renouvelle quotidiennement, quels événements traiter ? Il y a deux timestamps :

1. **event_time :** Moment où l'utilisateur a déclenché l'événement (côté client)
2. **_PARTITIONTIME :** Moment où BigQuery a stocké l'événement (côté serveur)

Une mise à jour incrémentale avec `event_time` :
```sql
WHERE event_time > (SELECT MAX(event_time) FROM cohort_assignments)
```
**Problème :** Événements en retard. L'utilisateur reste offline 3 jours, l'événement arrive par batch upload. Si `event_time` remonte à 3 jours, la requête incrémentale le rate.

Une mise à jour incrémentale avec `_PARTITIONTIME` :
```sql
WHERE _PARTITIONTIME > CURRENT_DATE() - 7
```
**Avantage :** Retraite les 7 derniers jours à chaque cycle, capture les événements tardifs.
**Coût :** 7 jours de données d'événements = ~14 GB scannés par jour (vs 2 GB).

Tradeoff : Si les événements tardifs < 1 %, utilisez `event_time`, scan bas. Pour une app mobile où les événements tardifs ~5 %, appliquez `_PARTITIONTIME` avec un lookback de 3 jours.

## Segmentation de Cohort : Filtres Dynamiques vs Dimensions Statiques

L'utilisateur demande un filtre au dashboard : « Rétention cohort iOS ». Deux méthodes :

**Méthode 1 : Filtre au moment de la requête**
```sql
SELECT cohort_week, weeks_since, active_users
FROM cohort_retention_weekly
WHERE user_id IN (SELECT user_id FROM users WHERE platform = 'iOS');
```
**Problème :** La subquery scanne `users` à chaque fois. 50M utilisateurs = 1 GB scannés. Dashboard rafraîchit 100 fois = 100 GB.

**Méthode 2 : Pré-calcul des dimensions**
```sql