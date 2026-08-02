---
title: "dbt + BigQuery pour une Modern Marketing Data Stack"
description: "Source mapping, modeling layer, semantic layer, exposures — architecture reliant les données marketing au mécanisme décisionnel avec implémentation pratique dbt."
publishedAt: 2026-08-02
modifiedAt: 2026-08-02
category: data
i18nKey: data-002-2026-08
tags: [dbt, bigquery, data-stack, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

Les équipes marketing n'utilisent plus les rapports prêts à l'emploi de Google Analytics, mais les data pipelines où elles écrivent leurs propres règles. En 2026, la modern marketing data stack se compose de trois couches : raw sources, modeling layer, semantic layer. Cet article explique comment construire ces trois couches avec dbt + BigQuery, quels types d'erreurs sont commises à chaque étape, et comment mettre en place une structure durable en production.

## Source mapping : importer des données vers BigQuery ne suffit pas

Vous avez chargé GA4, Meta Ads, sGTM events dans BigQuery — mais ce n'est que le début. Le source mapping transforme les tables brutes en contrats significatifs. Dans dbt, les définitions de sources vivent dans des fichiers `.yml` :

```yaml
sources:
  - name: raw_ga4
    database: roibase-prod
    schema: analytics_123456789
    tables:
      - name: events_*
        identifier: events_*
        loaded_at_field: event_timestamp
        freshness:
          warn_after: {count: 12, period: hour}
```

Cette définition fait trois choses : (1) Data lineage — quel modèle utilise quelle table brute, (2) Freshness check — alerte si le dernier event a plus de 12 heures, (3) Contract — le build échoue si la colonne `event_timestamp` est absente.

**Erreur la plus courante :** utiliser le schéma brut tel quel. Écrire du SQL sans aplatir le tableau nested `event_params` de GA4, ce qui rend chaque requête de 200+ lignes. Au stade du source mapping, la logique d'`unnest` doit vivre en un seul endroit :

```sql
-- models/staging/stg_ga4_events.sql
with source as (
  select * from {{ source('raw_ga4', 'events_*') }}
),

flattened as (
  select
    event_date,
    event_timestamp,
    user_pseudo_id,
    (select value.string_value from unnest(event_params) where key = 'session_id') as session_id,
    (select value.int_value from unnest(event_params) where key = 'ga_session_number') as session_number
  from source
)

select * from flattened
```

Ce modèle peut maintenant être appelé en aval via `ref('stg_ga4_events')` — la syntaxe brute event_params est isolée en amont. Le freshness check s'exécute chaque jour, et signale automatiquement les modifications de schéma.

## Modeling layer : définir une métrique une fois, l'utiliser cent fois

Après la couche staging vient la modeling layer. Ici, les modèles intermédiaires (business logic) et les modèles mart (agrégation) sont séparés. Dans une marketing data stack, le modèle **session → transaction** join est le plus critique :

```sql
-- models/marts/mrt_session_metrics.sql
with sessions as (
  select * from {{ ref('int_sessions') }}
),

transactions as (
  select * from {{ ref('int_transactions') }}
),

joined as (
  select
    s.session_id,
    s.session_date,
    s.traffic_source,
    s.medium,
    s.campaign,
    t.transaction_id,
    t.revenue,
    t.transaction_timestamp
  from sessions s
  left join transactions t
    on s.session_id = t.session_id
)

select
  session_date,
  traffic_source,
  medium,
  campaign,
  count(distinct session_id) as sessions,
  count(distinct transaction_id) as transactions,
  sum(revenue) as total_revenue,
  safe_divide(count(distinct transaction_id), count(distinct session_id)) as conversion_rate
from joined
group by 1, 2, 3, 4
```

Ce modèle s'exécute chaque jour à 03:00 (dbt Cloud scheduler), et Looker Studio se connecte directement à cette table. Quand une modification est nécessaire, vous changez le SQL une seule fois, et tous les tableaux de bord se mettent à jour automatiquement.

**Détail important :** utilisation de `safe_divide` — si sessions = 0, il ne lève pas une division par zéro, il retourne null. La gestion des exceptions dans un pipeline production se fait à ce niveau.

### dbt tests : vérifier automatiquement la qualité des données

Lorsque vous définissez des métriques dans la modeling layer, vous écrivez également des tests :

```yaml
# models/marts/schema.yml
models:
  - name: mrt_session_metrics
    columns:
      - name: session_date
        tests:
          - not_null
      - name: sessions
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"
      - name: conversion_rate
        tests:
          - dbt_utils.expression_is_true:
              expression: "<= 1"
```

La commande `dbt test` exécute ces règles. Si le conversion rate sort > 1 (il y a une erreur SQL), le build échoue et une alerte est envoyée à Slack. Au lieu d'un QA manuel, vous avez une qualité des données automatisée — le reste de la data stack repose sur cette base.

## Semantic layer : définir la métrique, pas la requête

Avec dbt v1.6+, la semantic layer est sortie du beta. Vous définissez maintenant les métriques dans un fichier `.yml`, pas en SQL :

```yaml
# models/semantic/metrics.yml
metrics:
  - name: total_revenue
    label: Total Revenue
    model: ref('mrt_session_metrics')
    type: sum
    sql: total_revenue
    timestamp: session_date
    time_grains: [day, week, month]

  - name: roas
    label: Return on Ad Spend
    type: ratio
    numerator: total_revenue
    denominator: total_ad_spend
```

Cette définition est consommée à trois endroits : (1) Looker Studio, (2) un bot Slack via l'API de découverte dbt Cloud, (3) une DAG Airflow pour un pipeline ML en aval.

**Avantage :** les métriques peuvent être consommées sans écrire de SQL. L'analyste marketing écrit maintenant "Show me ROAS by campaign, last 7 days", et dbt semantic layer compile automatiquement la requête. La logique SQL vit dans la couche model, la définition de la métrique dans la semantic layer — les deux sont séparées, les changements sont isolés.

**Attention :** la semantic layer est encore nouvelle — pas d'intégration native complète avec tous les outils BI. Dans la stack production de Roibase, nous utilisons une approche hybride : les métriques critiques en semantic layer, les analyses personnalisées via des exposures SQL.

### Exposures : documenter les dépendances en aval

Les exposures montrent où les modèles dbt sont utilisés en dehors de dbt :

```yaml
# models/exposures.yml
exposures:
  - name: looker_studio_performance_dashboard
    type: dashboard
    url: https://lookerstudio.google.com/...
    depends_on:
      - ref('mrt_session_metrics')
      - ref('mrt_campaign_performance')
    owner:
      name: Marketing Analytics Team
      email: analytics@roibase.com.tr
```

Cette définition est visualisée dans la documentation dbt — quel tableau de bord dépend de quel modèle, qui doit être notifié si un modèle change. En production, quand vous faites un breaking schema change, vous lancez `dbt run --select +mrt_session_metrics+` pour voir les impacts en aval.

**Scénario réel :** GA4 a renommé la clé `page_location` en `page_url` dans event_params. Grâce aux exposures, nous avons trouvé 3 tableaux de bord et 1 DAG Airflow affectés, la migration s'est faite en 2 heures. Sans exposures, les tableaux de bord se seraient silencieusement cassés, nous l'aurions appris par une plainte utilisateur.

## Incremental models : ne pas reconstruire 2TB de données chaque jour

Pour les données marketing, les partitions quotidiennes atteignent rapidement des térabytes. Vous ne pouvez pas relancer un full refresh à chaque commande `dbt run` — le coût et le temps BigQuery ne sont pas viables. Utilisez des modèles incrementals :

```sql
-- models/marts/mrt_user_journey.sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'event_date', 'data_type': 'date'},
    cluster_by=['user_pseudo_id', 'traffic_source'],
    incremental_strategy='insert_overwrite'
  )
}}

select
  event_date,
  user_pseudo_id,
  traffic_source,
  -- ...
from {{ ref('stg_ga4_events') }}

{% if is_incremental() %}
  where event_date >= date_sub(current_date(), interval 3 day)
{% endif %}
```

Cette configuration fait trois choses : (1) crée des partitions BigQuery — ajoute le nouveau jour sans toucher les anciens, (2) `cluster_by` améliore les performances des requêtes, (3) la stratégie `insert_overwrite` — supprime et réécrit les 3 derniers jours (pour les données en retard).

**Différence de coût :** 365 jours de données, full refresh = 2,5 TB scannés ($12,50), incremental = 3 GB scannés ($0,015). Pour un pipeline quotidien, la différence annuelle est ~$4500 vs ~$5. C'est pourquoi le modèle incremental est la fondation d'une production stack.

## Relier la data stack au mécanisme décisionnel

dbt + BigQuery construisent l'infrastructure, mais la vraie valeur réside dans l'impact sur les décisions marketing. Un flux courant : sémantique layer → bot Slack avec métriques :

1. Le responsable marketing tape sur Slack : `/metric roas last_30_days campaign=brand`
2. L'app Slack appelle l'API semantic layer de dbt Cloud
3. L'API interroge la table `mrt_session_metrics`, calcule le ROAS
4. Le résultat est renvoyé à Slack : "Campagne brand ROAS : 4,2x"

Ce flux nécessite dbt semantic layer + middleware Python personnalisé. Dans la stack production de Roibase, une DAG Airflow capture quotidiennement un snapshot de la semantic layer, et Looker Studio + les apps internes utilisent ce snapshot — pas de problèmes de rate limit API.

**Approche alternative :** le stack hybride utilisé dans notre service [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/fr/firstparty) — dbt semantic layer + Cube.js. Cube.js ajoute une couche de cache, améliore les performances BI. Le choix dépend du volume de données et des patterns de requête.

## Production checklist : avant de déployer la stack dbt

dbt fonctionne localement — avant de passer en production, vérifiez :

- **CI/CD :** chaque commit doit exécuter `dbt build --select state:modified+` via dbt Cloud ou GitHub Actions
- **Freshness monitoring :** les sources critiques doivent avoir `warn_after` et `error_after` définis
- **Alerting :** intégrez dbt Cloud webhooks à Slack — si le build échoue, l'équipe est notifiée en 5 minutes
- **Documentation :** `dbt docs generate` doit s'exécuter automatiquement, les artefacts pushés vers S3/GCS
- **Cost monitoring :** slot reservation BigQuery ou alerte on-demand — fixez un seuil pour les pics inattendus ($500/jour par exemple)
- **Backup strategy :** conservez un snapshot de la table critique data warehouse — si une mise à jour échoue, vous pouvez rollback

**Règle la plus critique :** pas de `dbt run` manuel en production. Toute exécution doit passer par un scheduler (dbt Cloud, Airflow, Prefect). Les runs manuels cassent la data lineage, l'analyse de root cause devient impossible en cas d'erreur.

dbt + BigQuery forment l'épine dorsale d'une modern marketing data stack — le source mapping lie les données brutes aux contrats, la modeling layer définit les métriques une seule fois, la semantic layer permet aux utilisateurs sans SQL de consommer les métriques. En production, les incremental models et la couverture de tests rendent le pipeline durable. L'étape suivante : relier ces données à l'activation en temps réel — CDP, audience sync, incrementality measurement. Mais c'est un sujet de data stack différent.