---
title: "dbt + BigQuery : La Stack de Data Marketing Moderne"
description: "Source mapping, modeling layer, semantic layer, exposures : une architecture à quatre couches qui relie les données marketing au mécanisme de décision."
publishedAt: 2026-07-17
modifiedAt: 2026-07-17
category: data
i18nKey: data-002-2026-07
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

Le rapport Google Analytics 4 vous montre la performance par canal, Klaviyo enregistre le nombre d'e-mails envoyés à chaque prospect, le tableau de bord Meta Ads affiche le CPA — mais ces trois chiffres peuvent-ils figurer dans une même requête SQL ? S'ils ne le peuvent pas, le mécanisme de décision repose sur des hypothèses. La promesse de la stack dbt + BigQuery est unique : en modelant les données marketing à travers quatre couches — de la source à l'exposition — on transforme la question « quel canal, quel client, quelle valeur créée » en un pipeline SQL reproductible. À mesure que l'ère post-cookies s'installe, que l'attribution multi-touch et l'incrementalité deviennent obligatoires, cette architecture cesse d'être optionnelle pour les agences boutiques : elle devient incontournable.

## Source mapping : organiser les flux de données brutes en groupes de tables

Dans BigQuery, chaque plateforme crée son propre dataset : `ga4_export`, `facebook_ads`, `klaviyo_events`, `shopify_orders`. Leurs schémas bruts sont incompatibles — GA4 retourne du JSON imbriqué, l'API Facebook du CSV plat, les webhooks Klaviyo aucune normalisation. Le *source mapping* de dbt est la première couche : on écrit un manifeste YAML au-dessus de ce chaos, on enregistre chaque table dans un bloc `sources` et on déclare les types de données, leur fraîcheur, leur fréquence de chargement.

```yaml
# models/sources/marketing_sources.yml
version: 2

sources:
  - name: ga4_export
    database: roibase-analytics
    schema: analytics_123456789
    tables:
      - name: events_*
        identifier: 'events_*'
        meta:
          contains_pii: true
        freshness:
          warn_after: {count: 25, period: hour}
          error_after: {count: 49, period: hour}

  - name: facebook_ads
    schema: facebook_raw
    tables:
      - name: ads_insights
        loaded_at_field: date_start
        freshness:
          warn_after: {count: 2, period: day}
```

Ce manifeste offre à dbt deux choses : 1) une référence *type-safe* à la table brute via la macro `source()` au lieu de `ref()`, 2) la capacité à détecter où s'arrête le pipeline grâce à la commande `dbt source freshness`. Si un événement GA4 n'a pas été mis à jour pendant 49 heures, BigQuery ne s'en plaint pas — dbt, si.

Pendant le *source mapping*, l'annotation PII est obligatoire : au titre du RGPD et de la LCEN, il faut déclarer quelles colonnes contiennent l'identité de l'utilisateur, son e-mail, son IP. Cette information se propage dans la lignée des modèles. Chaque table contenant `user_pseudo_id` reçoit le tag `meta.contains_pii: true`. On combine ce tag avec les règles de masquage au niveau des champs dans la couche sémantique.

## Modeling layer : les phases staging → intermediate → mart

Les modèles de *staging* renomment la source brute, convertissent les types, suppriment les colonnes inutiles et offrent un schéma standard en aval. Convertir le tableau `event_params` de GA4 en colonnes scalaires — `page_location`, `session_id`, `transaction_id` — c'est le travail du *staging* :

```sql
-- models/staging/ga4/stg_ga4__events.sql
with source as (
    select * from {{ source('ga4_export', 'events_*') }}
    where _table_suffix between format_date('%Y%m%d', date_sub(current_date(), interval 90 day))
                             and format_date('%Y%m%d', current_date())
),

unnested as (
    select
        event_date,
        event_timestamp,
        user_pseudo_id,
        (select value.string_value from unnest(event_params) where key = 'page_location') as page_location,
        (select value.int_value from unnest(event_params) where key = 'ga_session_id') as session_id,
        ecommerce.transaction_id,
        ecommerce.purchase_revenue_in_usd
    from source
    where event_name in ('page_view', 'purchase')
)

select * from unnested
```

Ce modèle porte le préfixe `stg_` — personne en aval ne touche à la source, tous les modèles consomment le *staging*. Les modèles de *staging* peuvent être *incremental* : chaque jour, seule la nouvelle partition est traitée. La commande `dbt build --select stg_ga4__events` s'exécute en 30 secondes ; les 90 jours d'historique ne sont jamais retraités.

Les modèles *intermediate* fusionnent le *staging* et créent des concepts analytiques : `int_sessions`, `int_customer_cohorts`, `int_channel_attribution`. Ils abstraient la logique des tables intermédiaires. Par exemple, le calcul d'attribution multi-touch est *intermediate* :

```sql
-- models/intermediate/marketing/int_channel_attribution.sql
with touchpoints as (
    select
        user_id,
        session_start_timestamp,
        source_medium,
        row_number() over (partition by user_id order by session_start_timestamp) as touch_position,
        count(*) over (partition by user_id) as total_touches
    from {{ ref('stg_sessions') }}
    where user_id is not null
),

attributed as (
    select
        user_id,
        source_medium,
        case
            when touch_position = 1 then 0.4
            when touch_position = total_touches then 0.4
            else 0.2 / (total_touches - 2)
        end as attribution_weight
    from touchpoints
)

select * from attributed
```

Modèle en U — le premier et le dernier contact comptent pour 40 %, les contacts intermédiaires se partagent les 20 % restants. Cette SQL reste dans le modèle *intermediate* ; les data scientists modifient le fichier de modèle, les tableaux de bord de front-end ne sont jamais touchés. Si on veut le rendre paramétrique, on définit `vars.attribution_model: u_shaped` dans `dbt_project.yml` et on lit avec `{{ var('attribution_model') }}`.

Les modèles *mart* forment la dernière couche : ce que les tableaux de bord, les outils de BI ou les pipelines de machine learning consomment directement. Ils portent les préfixes `fct_` (*fact*) ou `dim_` (*dimension*). `fct_orders`, `dim_customers`, `fct_ad_performance`. Les modèles *mart* peuvent être dénormalisés — on paie le coût des jointures dans dbt, pas dans l'outil de BI. Au lieu de « jointure d'order à customer » dans Looker, `fct_orders` contient déjà `customer_lifetime_value`, `customer_cohort` en colonne.

## Semantic layer : centraliser les métriques et la logique métier

La *semantic layer* de dbt 1.6+ transforme le SQL en concept de « métrique ». Avant, chaque tableau de bord écrivait sa propre requête `sum(revenue)` — maintenant, on définit une seule métrique `revenue` et les tableaux de bord la consomment. La définition des métriques se déclare en YAML dans le répertoire `metrics/` :

```yaml
# models/metrics/marketing_metrics.yml
version: 2

metrics:
  - name: total_revenue
    label: Revenu Total
    model: ref('fct_orders')
    calculation_method: sum
    expression: order_total
    timestamp: order_date
    time_grains: [day, week, month, quarter, year]
    dimensions:
      - channel
      - customer_cohort
      - product_category

  - name: customer_acquisition_cost
    label: Coût d'Acquisition Client (CAC)
    calculation_method: derived
    expression: "{{ metric('total_ad_spend') }} / {{ metric('new_customers') }}"
    timestamp: order_date
    time_grains: [month, quarter]
```

Avec cette déclaration, une requête Looker du type « Affiche-moi `total_revenue` par `channel` pour le dernier trimestre » est résolue automatiquement via l'API dbt Semantic Layer. On n'écrit pas de SQL — on appelle la métrique. `customer_acquisition_cost` est une métrique *derived* : elle se calcule à partir de deux autres métriques. Quand la formule change, on la modifie un seul endroit, pas sur 12 tableaux de bord.

La *semantic layer* impose une deuxième contrainte : elle impose l'architecture de [données first-party](https://www.roibase.com.tr/fr/firstparty), car la définition d'une métrique s'appuie sur l'ID client. Si le `user_pseudo_id` de GA4 et le `customer_id` de Shopify représentent la même personne, cette résolution d'identité doit être résolue dans le modèle *intermediate*. La table `dim_unified_customers` fusionne tous les signaux et retourne un `canonical_customer_id`. Cet ID est utilisé comme dimension dans la *semantic layer*. Sans ID canonique, la métrique CAC est inexacte — le même client est compté deux fois.

## Exposures : les points de consommation en aval

Les *exposures* sont le dernier concept de dbt : déclarer quel tableau de bord, quelle tâche Airflow, quel modèle de machine learning consomme ce pipeline dbt. Format YAML :

```yaml
# models/exposures/marketing_exposures.yml
version: 2

exposures:
  - name: executive_marketing_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: "Tableau de bord CMO : revenue, CAC, LTV par canal"
    depends_on:
      - ref('fct_orders')
      - ref('fct_ad_performance')
      - metric('total_revenue')
      - metric('customer_acquisition_cost')
    owner:
      name: Équipe Ops Marketing
      email: ops@roibase.com.tr

  - name: klaviyo_segment_sync
    type: application
    maturity: medium
    description: "Synchronisation segment BigQuery → Klaviyo via Hightouch"
    depends_on:
      - ref('dim_unified_customers')
    owner:
      name: CRM Automation
      email: crm@roibase.com.tr
```

Ce manifeste signifie que, après avoir exécuté `dbt docs generate`, le DAG visualisé affichera les *exposures* comme points terminaux. Quand on modifie le modèle `fct_orders`, on voit clairement sur le graphe de lignée quel tableau de bord sera impacté. L'*exposure* sert aussi de règle d'alerte : on peut envoyer un message Slack du type « executive_marketing_dashboard a un modèle en amont en erreur ».

Le champ *maturity* de l'*exposure* assure le suivi de la dette technique : une exposition `low` maturity peut être une analyse temporaire, une exposition `high` maturity est critique en production. La commande `dbt list --select exposure:executive_marketing_dashboard+` énumère l'arborescence des dépendances de ce tableau de bord — pendant la dépréciation d'un modèle, on effectue une analyse d'impact.

## Couverture de test et contrat de qualité des données

La puissance de dbt ne se limite pas à la transformation, mais à la suite de test. Pour chaque modèle, on déclare des tests dans le fichier `schema.yml` :

```yaml
# models/marts/marketing/fct_orders.yml
version: 2

models:
  - name: fct_orders
    description: "Table de faits dénormalisée pour la consommation BI"
    columns:
      - name: order_id
        description: "Clé primaire"
        tests:
          - unique
          - not_null

      - name: customer_id
        description: "Clé étrangère vers dim_customers"
        tests:
          - not_null
          - relationships:
              to: ref('dim_customers')
              field: customer_id

      - name: order_total
        description: "Total de commande en USD"
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"

      - name: order_date
        tests:
          - not_null
          - dbt_utils.accepted_range:
              min_value: "'2020-01-01'"
              max_value: "current_date()"
```

La commande `dbt test` exécute ces contrôles. Si une anomalie apparaît — `order_total < 0` — la construction échoue, une alerte Slack est envoyée. Les consommateurs en aval utilisent ce contrat en confiance — la qualité des données est assurée dans le pipeline, pas dans l'outil de BI.

Ajouter un test personnalisé est simple : on place un fichier SQL dans le répertoire `tests/`. Exemple : « Chaque client ne doit avoir qu'un seul abonnement actif » :

```sql
-- tests/assert_single_active_subscription.sql
with duplicate_subscriptions as (
    select
        customer_id,
        count(*) as active_count
    from {{ ref('fct_subscriptions') }}
    where status = 'active'
    group by 1
    having count(*) > 1
)

select * from duplicate_subscriptions
```

Si cette requête retourne des lignes, le test échoue. Quand la couverture de test dépasse 80 %, le nombre d'incidents liés aux données diminue — métrique Roibase 2023 : au-delà de 85 % de couverture de test, les alertes de tableau de bord erroné baissent de 60 %.

## Orchestration de pipeline et déploiement en production

Si vous utilisez dbt Cloud, on définit un job planifié : chaque jour à 04h00, la commande `dbt build --select +fct_orders` s'exécute. En auto-hébergé, on ajoute un opérateur `BashOperator` au DAG Airflow avec la commande dbt. Grâce à la stratégie *incremental* de dbt, 90 jours de données sont traités en 5 minutes — le *full refresh* devient inutile.

Le processus CI/CD : une pull request déclenche `dbt build --select state:modified+` — seuls les modèles modifiés et leurs dépendances en aval sont testés. Après la fusion, le déploiement se fait sur le dataset BigQuery de production. Slim CI de dbt réduit le temps de construction PR sur un projet de 200 modèles à 3 minutes (sinon 40 minutes pour un *full build*).

En production, la sortie