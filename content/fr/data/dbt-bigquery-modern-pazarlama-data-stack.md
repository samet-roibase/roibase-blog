---
title: "dbt + BigQuery avec une Modern Marketing Data Stack"
description: "Source mapping, modeling layer, semantic layer, exposures : une architecture production-ready qui transforme les données marketing en mécanisme décisionnel."
publishedAt: 2026-06-30
modifiedAt: 2026-06-30
category: data
i18nKey: data-002-2026-06
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Les équipes marketing produisent toujours des rapports à partir de pivot Excel, les data teams réécrivent du SQL pour chaque nouvelle question, les KPI divergent entre départements. En 2026, tolérer ce scénario est une erreur d'ingénierie. La modern marketing data stack fonctionne en trois couches : intégration brute des sources, couche de transformation, couche sémantique. dbt + BigQuery livre ces trois couches en production-grade — version control, test coverage, lineage tracking inclus.

## Source Mapping : Transférer les Données Brutes vers une Zone Sécurisée

Extraire les données marketing dans BigQuery semble simple : des outils ETL comme Fivetran, Stitch, Airbyte injectent GA4, Meta Ads, Google Ads directement dans le schéma `raw_`. Mais six mois plus tard, quand le schéma brut change, les modèles en aval se cassent. Les **définitions de sources** de dbt contrôlent ce risque.

```yaml
# models/sources.yml
version: 2

sources:
  - name: ga4
    database: analytics_prod
    schema: raw_ga4
    tables:
      - name: events_*
        freshness:
          warn_after: {count: 6, period: hour}
          error_after: {count: 12, period: hour}
        loaded_at_field: event_timestamp
        columns:
          - name: event_name
            tests:
              - not_null
          - name: user_pseudo_id
            tests:
              - not_null
```

Une définition de source remplit trois fonctions : **(1)** alerte sur les changements en aval (la métrique `freshness` pousse sur Slack), **(2)** contrat de schéma (la liste des colonnes devient documentation), **(3)** tracking de lineage (dbt docs montre quels modèles dépendent de GA4). Quand Fivetran change de schéma, `dbt compile` échoue — la production n'explose pas.

À ce stade du source mapping, étiquez les signaux d'identité : `user_id`, `client_id`, `fbclid`, `gclid`, `email_sha256`. Dans la couche de modeling à venir, vous fusionnerez ces signaux en un seul `customer_id`. Perdre les signaux dans la table brute rend l'aval impossible.

### Stratégie de Partitionnement

GA4 utilise des tables wildcard quotidiennes (`events_20260630`). Dans dbt, définissez une source wildcard et filtrez avec `_TABLE_SUFFIX` :

```sql
-- models/staging/stg_ga4_events.sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'event_date', 'data_type': 'date'},
    cluster_by=['event_name', 'user_pseudo_id']
  )
}}

select
  parse_date('%Y%m%d', _table_suffix) as event_date,
  event_timestamp,
  event_name,
  user_pseudo_id,
  ...
from {{ source('ga4', 'events_*') }}
where _table_suffix >= format_date('%Y%m%d', date_sub(current_date(), interval 3 day))
{% if is_incremental() %}
  and parse_date('%Y%m%d', _table_suffix) > (select max(event_date) from {{ this }})
{% endif %}
```

Cette config écrit `stg_ga4_events` avec partitionnement quotidien dans BigQuery, le clustering par `event_name` + `user_pseudo_id` réduit les coûts de requête. La matérialisation incrémentale ramène un scan de 90 jours d'history à 3 jours — réduction de coûts de 30×.

## Couche de Modélisation : Codifiez la Logique Métier

La couche staging nettoie les données brutes, la couche intermediate construit la logique de jointure, la couche mart répond aux questions métier. dbt segmente ces trois couches par structure de dossier : `staging/`, `intermediate/`, `marts/`.

**Exemple de staging** — Standardisez les colonnes Meta Ads :

```sql
-- models/staging/stg_meta_ads.sql
select
  date_start as report_date,
  campaign_id,
  campaign_name,
  spend as cost_usd,
  impressions,
  clicks,
  actions.value as conversions -- extraction du JSON imbriqué
from {{ source('meta_ads', 'ads_insights') }}
where date_start >= date_sub(current_date(), interval 90 day)
```

**Exemple d'intermediate** — Unifiez toutes les sources de paid media :

```sql
-- models/intermediate/int_paid_media_unified.sql
with meta as (
  select report_date, campaign_id, 'meta' as source, cost_usd, impressions, clicks, conversions
  from {{ ref('stg_meta_ads') }}
),
google as (
  select report_date, campaign_id, 'google' as source, cost_usd, impressions, clicks, conversions
  from {{ ref('stg_google_ads') }}
)

select * from meta
union all
select * from google
```

**Exemple de mart** — Dashboard de performance quotidienne :

```sql
-- models/marts/fct_daily_performance.sql
select
  report_date,
  source,
  sum(cost_usd) as total_cost,
  sum(impressions) as total_impressions,
  sum(clicks) as total_clicks,
  sum(conversions) as total_conversions,
  safe_divide(sum(clicks), sum(impressions)) as ctr,
  safe_divide(sum(cost_usd), sum(conversions)) as cpa
from {{ ref('int_paid_media_unified') }}
group by 1, 2
```

La fonction `ref()` construit le graphe de dépendances de dbt. La commande `dbt run` exécute les modèles dans l'ordre des dépendances. Si `int_paid_media_unified` change, toutes les tables mart en aval se reconstruisent automatiquement.

### Couverture de Tests

En production, un rapport KPI erroné signifie une erreur de six chiffres en e-commerce. Les tests génériques de dbt ajoutent un contrat à chaque modèle :

```yaml
# models/marts/schema.yml
version: 2

models:
  - name: fct_daily_performance
    columns:
      - name: report_date
        tests:
          - not_null
          - unique
      - name: total_cost
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"
      - name: cpa
        tests:
          - dbt_utils.expression_is_true:
              expression: "is null or cpa >= 0"
```

La commande `dbt test` valide ces contrats. Dans le pipeline CI/CD, un test échoué bloque la fusion — aucune donnée erronée n'atteint la production. Dans les travaux de Roibase sur [First-Party Data & Architecture de Mesure](https://www.roibase.com.tr/fr/firstparty), nous ciblons 85 % de couverture de tests (nombre de lignes × champs critiques).

## Couche Sémantique : Définissez une Métrique, une Seule Fois

Fin 2025, dbt Labs a intégré "MetricFlow", la couche sémantique, dans dbt Cloud. Quand l'équipe marketing demande "taux de conversion", la data team ne devrait pas réécrire du SQL — la définition de métrique devrait être unique. Le fichier `metrics.yml` de dbt offre cette abstraction :

```yaml
# models/metrics.yml
version: 2

metrics:
  - name: conversion_rate
    label: Conversion Rate
    model: ref('fct_daily_performance')
    calculation_method: derived
    expression: "safe_divide(total_conversions, total_clicks)"
    timestamp: report_date
    time_grains: [day, week, month]
    dimensions:
      - source

  - name: cpa
    label: Cost Per Acquisition
    model: ref('fct_daily_performance')
    calculation_method: derived
    expression: "safe_divide(total_cost, total_conversions)"
    timestamp: report_date
    time_grains: [day, week, month]
    dimensions:
      - source
```

La couche sémantique remplit deux fonctions : **(1)** quand une métrique est sélectionnée dans un BI tool, le SQL se génère automatiquement (intégration Looker, Tableau, Power BI), **(2)** quand la métrique change, tous les dashboard restent cohérents. Si vous décidez "le CPA doit inclure les frais d'expédition", une seule ligne change — 40 dashboard se mettent à jour en une seule opération.

MetricFlow est en beta (juin 2026), mais utilisable en production. Alternative : écrivez des fonctions de métrique personnalisées en macros dbt :

```sql
-- macros/calculate_cpa.sql
{% macro calculate_cpa(cost_column, conversion_column) %}
  safe_divide({{ cost_column }}, nullif({{ conversion_column }}, 0))
{% endmacro %}
```

Dans tous les modèles mart, appelez `{{ calculate_cpa('total_cost', 'total_conversions') }}` — les changements de métrique se propagent depuis un seul endroit.

## Exposures : Liez un Modèle à un Dashboard BI

Le fichier `exposures.yml` de dbt enregistre quel modèle est utilisé dans quel dashboard. Ce suivi est opérationnel — vous savez quels dashboard tester quand un modèle change :

```yaml
# models/exposures.yml
version: 2

exposures:
  - name: executive_performance_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: "Daily paid media performance for C-level"
    depends_on:
      - ref('fct_daily_performance')
      - ref('fct_campaign_performance')
    owner:
      name: Growth Team
      email: growth@company.com

  - name: weekly_marketing_review
    type: analysis
    maturity: medium
    url: https://docs.google.com/spreadsheets/d/xyz789
    description: "Weekly deep-dive into channel mix"
    depends_on:
      - ref('fct_daily_performance')
    owner:
      name: Marketing Ops
      email: mops@company.com
```

Le lineage d'exposure est visible dans le graphique : après `dbt docs generate`, cliquez sur le nœud `fct_daily_performance` dans l'interface web pour voir quels dashboard en dépendent. Avant un changement décisif dans un modèle, vous pouvez avertir les propriétaires d'exposure automatiquement (webhook Slack).

### Pattern de Déploiement en Production

Les jobs dbt Cloud en production s'exécutent dans cet ordre :

1. **Source freshness check** — `dbt source freshness` (échoue si les données amont sont retardées)
2. **Model run** — `dbt run --select tag:daily` (les modèles quotidiens se construisent à 07:00)
3. **Test execution** — `dbt test` (l'infraction de contrat déclenche un rollback)
4. **Documentation update** — `dbt docs generate` (le graphique de lineage se met à jour)

Utiliser dbt à la place des requêtes planifiées BigQuery offre : version control (chaque déploiement est un commit git), rollback capability (un modèle erroné revient à la version antérieure en 5 minutes), alerte Slack (test échoué + avertissement freshness).

## Tradeoff : ELT ou Reverse ETL

La stack dbt + BigQuery suit le pattern ELT (extract-load-transform) — les données brutes sont d'abord chargées dans le warehouse, la transformation se fait dans BigQuery. Alternative : reverse ETL (Hightouch, Census) — les données du warehouse sont poussées vers les outils SaaS. Les deux se complètent : dbt nettoie le warehouse, reverse ETL envoie des segments à Braze/Iterable.

Tradeoff : coût du calcul BigQuery. 1 To de scan = 5 $ — si un modèle mart complexe s'exécute 10 fois par jour, cela coûte 50 $/jour = 1500 $/mois. Optimisation : matérialisation incrémentale + élagage de partition + clustering. Chez Roibase, le coût mensuel de BigQuery cible 0,02 $ par utilisateur actif mensuel — 1M MAU = 20 K$/an (acceptable).

La stack marketing data n'est pas un projet unique — c'est une architecture évolutive. Après avoir posé la base dbt + BigQuery, vous ajouterez les couches MMM (marketing mix modeling), test d'incrémentalité, identity resolution. Construire correctement cette base prend 6-8 semaines mais offre 18 mois de gains — chaque nouvelle question KPI obtient une réponse en 2 heures au lieu de 2 jours, le nettoyage manuel des données disparaît, un changement de modèle d'attribution prend 1 heure au lieu de 1 jour. Bien construire la stack transforme les données marketing en mécanisme décisionnel.