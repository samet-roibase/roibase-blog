---
title: "dbt + BigQuery: Architecture moderne de la stack data marketing"
description: "Source mapping, modeling layer, semantic layer, exposures — architecture à quatre couches reliant les données marketing à vos mécanismes décisionnels."
publishedAt: 2026-05-10
modifiedAt: 2026-05-10
category: data
i18nKey: data-002-2026-05
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

Les équipes marketing accèdent à plus de données que jamais, mais les décisions restent fondées sur des estimations. Des rapports fusionnés dans des feuilles de calcul, des métriques divergentes d'un tableau de bord à l'autre, trois réponses différentes à la question « quel est notre vrai CAC ». Le problème n'est pas l'absence de données — c'est la fuite entre la source et l'insight. L'association dbt + BigQuery construit l'architecture qui élimine cette fuite : vous rassemblez les données brutes via le source mapping, les convertissez en logique métier via la couche de modeling, créez un langage commun via la couche sémantique, et exposez le résultat en production.

## Source Mapping : De la donnée brute à la source fiable

Le source mapping est la première couche de dbt — la transformation immédiate après l'ingestion de vos données marketing dans BigQuery. Les événements bruts provenant de l'API Google Ads, de Meta Ads, de Shopify sont standardisés dans la couche staging. Le modèle `stg_google_ads__campaign_performance` contient 127 colonnes, mais vous n'en utilisez que 12. Le source mapping sélectionne ces 12 colonnes, convertit les timestamps en UTC, fait un cast de campaign_id en chaîne, traite les null, et crée une table propre.

La définition des sources dans dbt s'effectue dans le fichier `sources.yml`. C'est là que vous configurez les contrôles de fraîcheur — si Google Ads ne livre pas de données depuis 2 heures, le dbt run échoue. C'est un contrat imposé : vous sécurisez votre pipeline data. Au lieu d'une requête directe sur la table brute, vous utilisez la macro `{{ source('google_ads', 'campaign_stats') }}` — le graphe de lignage dbt montre quelle table brute alimente quel modèle.

```yaml
sources:
  - name: google_ads
    database: production
    schema: raw_google_ads
    tables:
      - name: campaign_stats
        freshness:
          warn_after: {count: 2, period: hour}
          error_after: {count: 6, period: hour}
        columns:
          - name: campaign_id
            tests:
              - not_null
              - unique
```

## Couche de modeling : Transformer la logique métier en code

Après le staging arrivent les couches intermédiaire et mart — c'est ici qu'on applique la logique métier aux données marketing. Dans le modèle `int_campaign_attribution`, vous calculez l'attribution first-touch et last-touch. Dans `fct_customer_lifetime_value`, vous exécutez une analyse LTV par cohorte. Ces modèles fonctionnent avec la matérialisation incrémentale de dbt — à chaque run, seules les 3 derniers jours de données sont traitées, les anciens enregistrements restent inchangés. Sur une table customer_event de 40 millions de lignes, la stratégie incrémentale de dbt réduit le temps à 2 minutes par run.

Dans la couche mart, vous créez des tables spécifiques à chaque business unit : `mart_paid_media__daily_performance`, `mart_crm__email_engagement`, `mart_finance__revenue_attribution`. Ces tables se connectent directement à Looker Studio, Tableau, Amplitude — chaque équipe puise sa métrique de la même source. Le calcul du CAC n'est plus matière à débat : la formule `paid_media_spend / new_customers` est codifiée dans le modèle dbt. Elle passe un code review, est testée, et reste sous contrôle de version.

```sql
-- models/marts/paid_media/mart_paid_media__daily_performance.sql
{{ config(materialized='incremental', unique_key='date_campaign_id') }}

with campaign_spend as (
  select
    date,
    campaign_id,
    sum(cost_micros) / 1e6 as spend
  from {{ ref('stg_google_ads__campaign_performance') }}
  {% if is_incremental() %}
    where date >= date_sub(current_date(), interval 3 day)
  {% endif %}
  group by 1, 2
),

conversions as (
  select
    date(timestamp) as date,
    campaign_id,
    count(distinct user_id) as conversions
  from {{ ref('stg_ga4__conversions') }}
  {% if is_incremental() %}
    where date(timestamp) >= date_sub(current_date(), interval 3 day)
  {% endif %}
  group by 1, 2
)

select
  c.date,
  c.campaign_id,
  c.spend,
  coalesce(cv.conversions, 0) as conversions,
  safe_divide(c.spend, nullif(cv.conversions, 0)) as cpa
from campaign_spend c
left join conversions cv using (date, campaign_id)
```

## Couche sémantique : Créer un langage commun

La couche sémantique est une fonctionnalité de dbt arrivée en version 1.6 — vous définissez les métriques sous forme de code, et chaque outil les utilise. La métrique `revenue` n'est pas `sum(order_total)`, mais `sum(case when payment_status = 'completed' then order_total end)`. La question « les retours sont-ils inclus » disparaît parce que la définition vit sur GitHub. Les équipes marketing, finance et product utilisent le même indicateur `revenue` — elles le découpent simplement selon des dimensions différentes.

Dans les travaux de [first-party data & architecture de mesure](https://www.roibase.com.tr/fr/firstparty) de Roibase, la couche sémantique est une étape obligatoire. Lorsqu'on consolide les événements client provenant de plusieurs touchpoints, sans définitions de métriques stabilisées, chaque analyse produit des résultats différents. Dans dbt, le fichier `metrics.yml` expose les définitions via API aux outils BI — Looker, Hex, Mode utilisent la couche sémantique, le même nombre apparaît partout.

```yaml
# models/metrics/metrics.yml
metrics:
  - name: marketing_qualified_leads
    label: Marketing Qualified Leads
    model: ref('fct_leads')
    calculation_method: count_distinct
    expression: lead_id
    timestamp: created_at
    time_grains: [day, week, month]
    dimensions:
      - utm_source
      - utm_campaign
      - landing_page
    filters:
      - field: lead_status
        operator: '='
        value: "'MQL'"
```

## Exposures : Mise en production

Les exposures sont la fonctionnalité de dbt pour le suivi des dépendances aval — vous documentez quel dashboard utilise quel modèle dbt. Votre dashboard Looker « Weekly Campaign Performance » se nourrit de la table `mart_paid_media__daily_performance`. Vous enregistrez cette dépendance dans `exposures.yml`. Désormais, si vous modifiez `mart_paid_media__daily_performance`, dbt vous prévient : « Ce modèle alimente 3 dashboards, analysez l'impact. »

Les exposures s'affichent aussi dans la documentation — dans dbt docs, en cliquant sur un modèle, vous voyez « Utilisé dans 5 dashboards, 2 jobs de reverse ETL, 1 pipeline ML ». Le lignage data s'étend jusqu'à la couche BI. Vous savez quel dashboard dépend de quel SQL en production. Le débogage accélère : vous identifiez le dashboard en cause, remontez au modèle source, et résolvez le problème.

| Type d'exposition | Utilisation | Suivi |
|---|---|---|
| Dashboard | Looker, Tableau, Metabase | URL + ref modèle |
| Reverse ETL | Census, Hightouch | ID job + table source |
| Pipeline ML | Vertex AI, SageMaker | Nom modèle + table feature |
| Outil opérationnel | Braze, Iterable segments | ID segment + modèle dbt |

## Orchestration du pipeline : Cadence de chaque couche

Vous orchestrez le pipeline avec dbt Cloud Scheduler ou Airflow. À 6h00, les données brutes se chargent dans BigQuery (Fivetran, Stitch, Airbyte) ; à 6h30, dbt run commence. Les modèles staging terminent en 5 minutes, les intermédiaires en 10, les marts en 15. À 7h00, la couche sémantique s'expose, à 7h15 les dashboards Looker se rafraîchissent. À 9h00, votre équipe arrive au bureau avec les données d'hier — zéro délai de 3 heures.

La suite de tests s'exécute à chaque run : `not_null`, `unique`, `accepted_values`, `relationships`. Si `campaign_id` n'est pas unique dans `stg_google_ads__campaign_performance`, le run échoue. Une alerte tombe sur Slack. La barrière de qualité data s'impose au niveau du code. Les données cassées n'atteignent jamais la production.

```yaml
# dbt_project.yml on-run-end hooks
on-run-end:
  - "{{ log_dbt_results() }}"
  - "{{ send_slack_notification() }}"
  - "{{ update_looker_cache() }}"
```

## Tradeoff : Complexité vs gouvernance

La stack dbt + BigQuery ajoute de la complexité. L'équipe analyst doit connaître SQL — « faire un pivot dans Excel » ne suffit plus. Git workflow, code review, CI/CD sont des concepts à maîtriser. Pour les petites équipes, ce surcoût peut être significant. Mais le tradeoff est clair : vous gagnez la gouvernance. Au lieu de formules perdues dans des feuilles, vous avez du code sous contrôle de version. « D'où vient ce chiffre » se résout avec git blame en 10 secondes.

Le coût BigQuery est un autre tradeoff. Les full table scans coûtent cher — la partitionnement et le clustering deviennent obligatoires. Dans vos modèles incrémentaux dbt, les config `partition_by` et `cluster_by` sont critiques. Un pipeline traitant 100 GB par mois génère un coût d'environ $50 de slots + $5 de stockage sur BigQuery. En tant que service managé, vous n'avez pas de surcharge infra, mais sans optimisation des requêtes, la facture s'envole.

Relier vos données marketing à vos mécanismes décisionnels n'est plus une affaire de feuilles de calcul et d'outils BI. La stack dbt + BigQuery encode chaque couche de la source à l'exposition. Le source mapping sécurise vos données brutes, la couche de modeling applique votre logique métier, la couche sémantique crée un langage unifié, les exposures documentent ce qu'on met en production. Code review, tests, contrôle de version — votre pipeline data suit la discipline du développement logiciel.