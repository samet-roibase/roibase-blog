---
title: "dbt + BigQuery : la Modern Marketing Data Stack"
description: "Du source mapping à la semantic layer : comment transformer vos données marketing en moteur de décision ? Architecture dbt, exposures et pipelines production."
publishedAt: 2026-06-14
modifiedAt: 2026-06-14
category: verianalizi
i18nKey: data-002-2026-06
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

Les équipes marketing en 2026 ne luttent plus contre les données — elles décident avec elles. GA4, Meta Ads, Google Ads, CRM, CDP, GTM server-side : tout arrive dans des tables distinctes. L'équipe fusionne manuellement dans des feuilles de calcul, les chiffres changent chaque semaine, personne ne fait confiance. Ce chaos disparaît avec la modern data stack : BigQuery en source, couche transformation dbt, arbre sémantique des indicateurs. Vous versionnez le code en repository, chaque changement est testé, les métriques proviennent d'une unique source de vérité. Cet article montre comment dbt + BigQuery transforme votre pipeline marketing en infrastructure production-grade.

## Source mapping : standardiser les chemins de données brutes

La première mission de dbt : le source mapping — aligner les données brutes de systèmes différents vers un même schéma. BigQuery reçoit `analytics_123456.events_*` de GA4, `facebook_ads.ads_insights` de l'API Meta, `crm.transactions` de Shopify. Chacun a son propre format de timestamp, son identifiant utilisateur distinct, sa colonne de devise. Vous définissez ces tables brutes dans `sources.yml` :

```yaml
version: 2
sources:
  - name: ga4
    database: analytics_123456
    tables:
      - name: events_
        identifier: "events_*"
        loaded_at_field: event_timestamp
  - name: meta_ads
    database: facebook_ads
    schema: public
    tables:
      - name: ads_insights
        loaded_at_field: date_start
```

Cette définition dit à dbt : « ces tables sont des sources upstream, je ne les modifie pas mais je teste leur fraîcheur ». La commande `dbt source freshness` vérifie quand les dernières données sont arrivées — si l'API Meta est en retard, une alerte se déclenche. Sans source mapping, tous les modèles écrivaient `SELECT * FROM analytics_123456.events_20260614`, et changer le nom de table cassait 40 modèles. Avec le mapping, la référence devient `{{ source('ga4', 'events_') }}`, le changement se propage d'un seul endroit.

GA4 utilise event_timestamp en microsecondes Unix, Meta ads en chaîne ISO, le CRM en UTC datetime — formats partout différents. Dans le source mapping, vous normalisez : `TIMESTAMP_MICROS(event_timestamp) AS event_time` pour GA4, `PARSE_TIMESTAMP('%Y-%m-%d', date_start) AS event_time` pour Meta. Cette normalisation livre des données propres aux modèles aval.

## Modeling layer : staging, intermediate, mart

La puissance de dbt réside dans la modélisation en couches — staging, intermediate, mart. Les modèles staging extraient 1:1 des sources, ne font que renommer et caster les types. `stg_ga4_events.sql` :

```sql
SELECT
  TIMESTAMP_MICROS(event_timestamp) AS event_time,
  user_pseudo_id AS anonymous_id,
  event_name,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'session_id') AS session_id,
  geo.country,
  device.category AS device_category
FROM {{ source('ga4', 'events_') }}
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY))
  AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
```

Le staging fournit des données propres mais sans logique métier. Les modèles intermediate ajoutent la logique business : sessionization, attribution, étapes de funnel. `int_sessions.sql` agrège les événements GA4 au niveau session :

```sql
WITH session_events AS (
  SELECT
    session_id,
    MIN(event_time) AS session_start,
    MAX(event_time) AS session_end,
    COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN event_time END) AS pageviews,
    MAX(CASE WHEN event_name = 'purchase' THEN 1 ELSE 0 END) AS converted
  FROM {{ ref('stg_ga4_events') }}
  GROUP BY session_id
)
SELECT
  *,
  TIMESTAMP_DIFF(session_end, session_start, SECOND) AS duration_seconds
FROM session_events
```

Les modèles mart constituent la couche de consommation finale — c'est ici que l'outil BI, Looker, les dashboards regardent. `fct_marketing_performance.sql` fusionne tous les canaux, calcule spend + revenue + ROAS. Chaque mart se concentre sur une entité business unique : `dim_customers`, `fct_orders`, `fct_sessions`. La convention de nommage est critique — `dim_` pour dimension (client, produit), `fct_` pour fact (transaction, événement), `rpt_` pour report agrégé.

## Semantic layer : définir les KPI en code

La semantic layer intègre les définitions de métriques à dbt — « c'est quoi le revenue », « comment calculer CAC » ne vivent plus dans une feuille de calcul mais en YAML. Avec dbt v1.6+, vous construisez l'arbre des indicateurs dans `metrics.yml` :

```yaml
version: 2
metrics:
  - name: revenue
    label: Revenue
    model: ref('fct_orders')
    calculation_method: sum
    expression: order_amount
    timestamp: order_date
    time_grains: [day, week, month, quarter]
    dimensions:
      - channel
      - country
      - device_category

  - name: cac
    label: Customer Acquisition Cost
    calculation_method: derived
    expression: "{{ metric('ad_spend') }} / {{ metric('new_customers') }}"
    timestamp: acquisition_date
    time_grains: [month, quarter]
```

Avec la semantic layer, ce n'est pas l'outil BI qui calcule CAC, c'est dbt. Quand Looker demande « donne-moi CAC », dbt retourne le SQL compilé, jointure spend et new_customers, puis division. La définition est du code — vous avez l'historique git : « qui a changé le calcul CAC, quand, pourquoi ». La formule spreadsheet ne disparaît pas, elle est versionnée.

Chez Roibase, la semantic layer s'inscrit dans le cadre [d'analyse de données et d'ingénierie d'insights](https://www.roibase.com.tr/fr/verianalizi) — non seulement les définitions de métriques mais aussi la cartographie de l'arbre KPI, la hiérarchie des dimensions, la standardisation des granularités. Exemple : la métrique « revenue » est la somme de `fct_orders.order_amount`, mais « recognized_revenue » filtre sur le même tableau selon `recognized_at` (modèle subscription SaaS). Une table, deux métriques, deux logiques métier distinctes.

## Exposures : rendre visibles les dépendances aval

Exposure répond à la question dbt : « qui utilise ce modèle ». Si un dashboard Looker repose sur `fct_marketing_performance`, vous l'inscrivez dans `exposures.yml` :

```yaml
version: 2
exposures:
  - name: marketing_dashboard
    type: dashboard
    maturity: high
    owner:
      name: Growth Team
      email: growth@company.com
    depends_on:
      - ref('fct_marketing_performance')
      - ref('dim_customers')
    description: "Executive marketing dashboard — daily refresh, 90-day rolling window"
    url: https://looker.company.com/dashboards/123
```

Sans exposures, modifier `fct_marketing_performance` vous laisse sans savoir quel dashboard s'est cassé. La métrique affiche zéro dans Looker, vous debuguez 2 heures. Avec exposures, `dbt compile --select +exposure:marketing_dashboard` liste tous les modèles amont, vous faites l'analyse d'impact avant de changer.

Exposure ne se limite pas à l'BI — elle couvre aussi la reverse ETL (Hightouch, Census). Si vous envoyez la table `customers` à l'API Meta CAPI :

```yaml
exposures:
  - name: meta_capi_sync
    type: application
    maturity: high
    depends_on:
      - ref('dim_customers')
    description: "Meta Conversion API — customer events incremental, 5-minute latency"
```

Cette exposition vous avertit : « si tu touches dim_customers, tu casses le schéma d'événements Meta ». En production, c'est un filet de sécurité — model update → CAPI sync error → perte de données d'attribution. L'alerte précoce l'évite.

## Production pipeline : incremental builds et couverture de tests

En production, dbt ne lance pas un full refresh chaque jour — il utilise des modèles incremental. `fct_orders.sql` ne retraite que les 3 derniers jours :

```sql
{{ config(
    materialized='incremental',
    unique_key='order_id',
    partition_by={'field': 'order_date', 'data_type': 'date'},
    cluster_by=['customer_id', 'channel']
) }}

SELECT
  order_id,
  customer_id,
  order_date,
  order_amount,
  channel
FROM {{ ref('stg_shopify_orders') }}

{% if is_incremental() %}
WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY)
{% endif %}
```

L'incremental réduit les coûts BigQuery de 90 % — scan 50 GB au lieu de 2 TB. Partition + clustering améliorent la performance : une requête `WHERE customer_id = 'X'` cible uniquement le cluster pertinent, pas de full scan.

La couverture de tests est critique. Vous écrivez des tests pour chaque modèle dans `schema.yml` :

```yaml
models:
  - name: fct_orders
    columns:
      - name: order_id
        tests:
          - unique
          - not_null
      - name: order_amount
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"
      - name: order_date
        tests:
          - dbt_utils.recency:
              datepart: day
              interval: 7
```

`dbt test` affirme ces conditions dans BigQuery — si order_amount tombe négatif, le build échoue. En production, chaque commit passe par le pipeline CI/CD : `dbt run --select state:modified+ → dbt test --select state:modified+`. Les modèles modifiés + leurs dépendances aval s'exécutent et sont testés, puis merge autorisé si tout passe.

## Orchestration : Airflow, Prefect, dbt Cloud

dbt ne s'orchestre pas seul — Airflow ou Prefect le schedule. Exemple de DAG Airflow :

```python
from airflow.providers.google.cloud.operators.bigquery import BigQueryInsertJobOperator
from airflow.operators.bash import BashOperator

dbt_run = BashOperator(
    task_id='dbt_run',
    bash_command='cd /opt/dbt && dbt run --profiles-dir .',
    dag=dag
)

dbt_test = BashOperator(
    task_id='dbt_test',
    bash_command='cd /opt/dbt && dbt test',
    dag=dag
)

dbt_run >> dbt_test
```

dbt Cloud est une alternative — orchestration gérée, Web IDE, alertes Slack. Mais la plupart des entreprises choisissent Airflow parce que d'autres tâches se rajoutent : pull API amont, reverse ETL aval, tables snapshot.

La stratégie de scheduling s'aligne sur la fraîcheur des données. GA4 événements ont 24 heures de latence (processing_date ≠ event_date), l'API Meta Ads n'est pas real-time. Les modèles staging se déclenchent selon la fraîcheur source — dès qu'une nouvelle partition GA4 arrive, `stg_ga4_events` se rafraîchit, cela cascade intermediate → mart. Un opérateur sensor Airflow scrute la partition BigQuery :

```python
wait_for_ga4 = BigQueryTableExistenceSensor(
    task_id='wait_for_ga4_partition',
    project_id='analytics_123456',
    dataset_id='events_',
    table_id=f"events_{yesterday.strftime('%Y%m%d')}",
    poke_interval=300
)
```

Dès que la partition existe, la chaîne dbt lance. Ce pattern résout le problème des données en retard — le délai API n'arrête pas le pipeline, il l'attend.

## Tradeoffs : ce que dbt ne résout pas

dbt est un moteur de transformation, pas un chargeur de données. Qui extrait les données dans BigQuery ? Fivetran, Airbyte, script Python custom. dbt suppose que les données brutes y sont déjà. Motif ELT : Extract-Load-Transform. Différence avec ETL : la transformation se fait dans le warehouse. dbt c'est cette couche T, EL c'est une autre chaîne d'outils.

dbt ne supporte pas le streaming real-time. Kafka → BigQuery streaming insert → chaîne incremental dbt = latence en minutes. Cas d'usage sub-second (détection fraude, pricing dynamique) ne peuvent pas s'appuyer sur dbt — ils ont besoin d'un stream processor : Flink, Spark Structured Streaming, Materialize.

Support Python dans dbt (v1.3+) est limité. Vous pouvez manipuler dataframes Pandas mais pas d'entraînement ML lourd. Feature engineering se fait en dbt, training du modèle en Vertex AI, inférence en BigQuery ML. Modèle Python dbt ressemble à :

```python
def model(dbt, session):
    df = dbt.ref('stg_orders').to_pandas()
    df['log_amount'] = np.log1p(df['order_amount'])
    return df
```

Mais c'est juste de la feature generation — vous n'entraînez pas scikit-learn. BigQuery coûte cher, l'overhead du runtime Python est élevé. Les transformations complexes s'écrivent mieux en SQL, plus rapide.

## Par où commencer maintenant

Si vos données marketing vivent encore dans des feuilles de calcul fusionnées manuellement, première étape : établir le flux de données brutes dans BigQuery. Export GA4, connecteur API Meta/Google Ads (Fivetran/Supermetrics), webhook CRM → streaming insert BigQuery. Données brutes en place, vous ouvrez un repository dbt : modèles staging pour le source mapping, modèles intermediate pour sessionization/attribution, modèles mart pour les KPI finaux. Les 2 premières semaines, vous ne construisez que `fct_sessions` et `fct_orders` — les dashboards regardent ici, les métriques se stabilisent. La semantic layer arrive semaine 3, le mapping d'exposures sem