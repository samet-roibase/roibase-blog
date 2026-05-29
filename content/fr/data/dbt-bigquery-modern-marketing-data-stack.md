---
title: "dbt + BigQuery pour une Modern Marketing Data Stack"
description: "Source mapping, modeling layer, semantic layer, exposures : une architecture production-ready qui relie vos données marketing aux décisions avec dbt et BigQuery."
publishedAt: 2026-05-29
modifiedAt: 2026-05-29
category: data
i18nKey: data-002-2026-05
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

Les équipes marketing disent encore « je ne peux pas connaître la performance de la campagne sans regarder le dashboard ». L'analyste écrit une nouvelle requête SQL à chaque question. Le CFO ne comprend pas pourquoi le CAC diffère à chaque rapport. Le problème n'est pas technique — le pipeline existe, les sources sont connectées, les données circulent. Le problème est architectural : entre les tables sources et le dashboard, il n'y a pas de couche de définition. La combinaison dbt + BigQuery résout ce problème : avec source mapping, modeling layer, semantic layer et exposures, vous standardisez vos données au niveau logique, pas seulement visuel.

## Source Mapping : Lier les Données Brutes à un Contrat

Les données arrivent dans BigQuery depuis votre CRM, GA4, Meta Ads, Klaviyo. Chaque source utilise un schéma différent, des conventions de nommage différentes, des formats de timestamp différents. Le source mapping de dbt vous permet de déclarer ces sources en code et de les tester. Vous définissez chaque table dans un fichier `sources.yml`, vous mettez en place des contrôles de fraîcheur (freshness), vous testez les contraintes d'unicité.

Exemple de définition de source :

```yaml
version: 2

sources:
  - name: raw_ga4
    database: analytics_lake
    schema: raw_ga4_events
    tables:
      - name: events
        freshness:
          warn_after: {count: 6, period: hour}
          error_after: {count: 12, period: hour}
        columns:
          - name: event_timestamp
            tests:
              - not_null
          - name: user_pseudo_id
            tests:
              - not_null
```

Cette définition établit un contrat : « Si l'événement GA4 n'arrive pas dans les 6 heures, avertissez-moi ; s'il n'arrive pas dans les 12 heures, arrêtez le pipeline. » En production, ce test est intégré à votre CI/CD — vous détectez immédiatement les problèmes de source. dbt docs génère automatiquement un graphe de lignage : vous voyez exactement quel dashboard dépend de quelle source.

Sans source mapping, l'analyste commence par `SELECT * FROM analytics_lake.raw_ga4_events.events`. Il ne sait pas ce que signifient les colonnes, il n'y a pas de test, pas de documentation. Avec dbt, vous référencez la source : `{{ source('raw_ga4', 'events') }}`. Si le nom de la table change, vous ne mettez à jour qu'un seul endroit — tous les modèles en aval s'adaptent automatiquement.

## Modeling Layer : Staging, Intermediate, Mart

La puissance de dbt réside dans les couches de modélisation. Vous en créez trois : staging (normaliser le format des données source), intermediate (appliquer la logique métier), mart (créer les tables de métriques finales).

**Couche staging :** Un modèle par source, rapport 1:1. Uniquement des transformations de type de données, standardisation des noms de colonnes, conversion des timestamps en UTC. Zéro logique métier.

```sql
-- models/staging/stg_ga4__events.sql
WITH source AS (
    SELECT * FROM {{ source('raw_ga4', 'events') }}
)

SELECT
    TIMESTAMP_MICROS(event_timestamp) AS event_at,
    user_pseudo_id AS user_id,
    event_name,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_url
FROM source
WHERE event_date >= CURRENT_DATE() - 90
```

**Couche intermediate :** Vous appliquez la logique métier. Vous définissez les sessions, mappez les catégories de produits, appliquez la fenêtre d'attribution. Ces modèles ne sont pas destinés à l'utilisateur final — ils alimentent uniquement les modèles en aval.

```sql
-- models/intermediate/int_sessions.sql
WITH events AS (
    SELECT * FROM {{ ref('stg_ga4__events') }}
),

session_windows AS (
    SELECT
        user_id,
        event_at,
        SUM(CASE WHEN TIMESTAMP_DIFF(event_at, LAG(event_at) OVER (PARTITION BY user_id ORDER BY event_at), MINUTE) > 30 THEN 1 ELSE 0 END) 
            OVER (PARTITION BY user_id ORDER BY event_at) AS session_index
    FROM events
)

SELECT
    user_id,
    session_index,
    MIN(event_at) AS session_start_at,
    MAX(event_at) AS session_end_at,
    COUNT(*) AS event_count
FROM session_windows
GROUP BY 1, 2
```

**Couche mart :** Les tables de métriques finales. Celles qui se connectent à votre dashboard, à votre outil BI, à Looker. Utilisez le préfixe `fct_` (fact) ou `dim_` (dimension).

```sql
-- models/marts/fct_daily_channel_performance.sql
SELECT
    DATE(session_start_at) AS date,
    traffic_source.medium AS channel,
    COUNT(DISTINCT user_id) AS users,
    SUM(revenue) AS revenue,
    SAFE_DIVIDE(SUM(revenue), COUNT(DISTINCT user_id)) AS revenue_per_user
FROM {{ ref('int_sessions') }}
LEFT JOIN {{ ref('int_transactions') }} USING (user_id, session_index)
GROUP BY 1, 2
```

Avec cette structure, l'analyste utilise `fct_daily_channel_performance` et ne touche jamais à la logique staging/intermediate. Si la définition d'une métrique change, vous ne mettez à jour qu'un seul endroit — tous les dashboards restent cohérents.

## Semantic Layer : Codifier les Définitions de Métriques

Dans la combinaison BigQuery + dbt, la « semantic layer » fonctionne de deux façons : les métriques dbt (dépréciées en 2023) ou les modèles sémantiques dbt (nouvelle approche). Un modèle sémantique retire la métrique du SQL et la définit en YAML. Des outils comme Looker, Tableau et Mode lisent cette définition et calculent le CAC, la LTV et le ROAS de façon cohérente.

Exemple de modèle sémantique :

```yaml
# models/marts/semantic_models.yml
semantic_models:
  - name: channel_performance
    model: ref('fct_daily_channel_performance')
    dimensions:
      - name: date
        type: time
        type_params:
          time_granularity: day
      - name: channel
        type: categorical
    measures:
      - name: total_revenue
        agg: sum
        expr: revenue
      - name: total_users
        agg: count_distinct
        expr: user_id

metrics:
  - name: revenue_per_user
    type: derived
    type_params:
      expr: total_revenue / total_users
      metrics:
        - total_revenue
        - total_users
```

Avec cette définition, la métrique « revenue per user » se calcule exactement de la même façon partout. L'analyste sélectionne « RPU » dans Looker, le backend récupère la définition de la couche sémantique dbt, aucun SQL écrit à la main. Si la définition change (par exemple, exclure les commandes annulées), vous ne mettez à jour qu'un seul endroit.

Sans semantic layer, chaque dashboard recalcule « revenue / users ». Sur un rapport, les remboursements sont exclus ; sur un autre, ils sont inclus. Votre CMO voit deux chiffres différents et perd confiance. Avec [First-Party Data & Architecture de Mesure](https://www.roibase.com.tr/fr/firstparty), établir cette couche en production est critique — vous définissez l'attribution, le consentement et les signaux TCF avec la même logique.

## Exposures : Suivre les Points d'Utilisation Finaux des Données

Une exposure dbt répond à la question « vers quel dashboard, quel pipeline ML, quel système opérationnel ce modèle va-t-il ? ». Vous la définissez dans `exposures.yml` :

```yaml
exposures:
  - name: marketing_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: "Dashboard de performance quotidienne des canaux pour le CMO"
    depends_on:
      - ref('fct_daily_channel_performance')
    owner:
      name: Marketing Analytics Team
      email: analytics@company.com
```

La définition d'une exposure fournit deux choses : **impact analysis** (si je modifie ce modèle, quel dashboard va casser ?) et **stakeholder mapping** (qui possède ce dashboard, à qui escalader ?).

En production, les exposures fonctionnent ainsi : dbt build → un test échoue → vous consultez le graphe de lignage pour voir les exposures affectées → une notification Slack est envoyée automatiquement → le propriétaire du dashboard est alerté tôt. Ainsi, la question « pourquoi le dashboard est-il vide ? » vient du système CI/CD, pas de l'utilisateur.

Sans exposures, l'équipe data déploie des modèles en aveugle, sans savoir qui en dépend. Avec les exposures, chaque modèle porte l'étiquette « ce tableau est en production live, ne le touchez pas ».

## Incremental Models et Partitioning : Coût + Performance

Sur BigQuery, un scan complet de table coûte cher. Pour 1 To de données, une requête coûte 5 $ ; 10 requêtes par jour = 50 $ ; par mois = 1 500 $. Avec un modèle incremental dbt, vous ne traitez que les nouvelles lignes ; les données historiques restent immuables.

```sql
{{ config(
    materialized='incremental',
    unique_key='event_id',
    partition_by={'field': 'event_at', 'data_type': 'timestamp', 'granularity': 'day'},
    cluster_by=['user_id', 'event_name']
) }}

SELECT * FROM {{ ref('stg_ga4__events') }}
WHERE event_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 DAY)

{% if is_incremental() %}
    AND event_at > (SELECT MAX(event_at) FROM {{ this }})
{% endif %}
```

Cette configuration effectue l'optimisation suivante : à chaque exécution, traitez seulement les 2 derniers jours ; les anciennes données ne sont jamais touchées. `partition_by` permet à BigQuery d'appliquer la pruning des partitions, `cluster_by` augmente la sélectivité des requêtes. Sur le même dataset, vous réduisez les coûts de 90 %.

En production, avec incremental models + dbt snapshot, vous implémentez SCD Type 2 : vous suivez les changements historiques dans les tables de dimension (changement de segment utilisateur, modification du mappage de catégorie produit). Quand l'analyste demande « à quel segment appartait l'utilisateur X le mois dernier », vous le récupérez de la snapshot — les données sont cohérentes.

## Production Pipeline : CI/CD, Tests, Alertes

Votre projet dbt est stocké sur GitHub ; chaque commit déclenche un pipeline CI :

1. **Lint :** `sqlfluff` vérifie le format SQL
2. **Test :** `dbt test` exécute les tests de schéma (not_null, unique, foreign_key) et les tests de données (revenue > 0, session_duration < 24h)
3. **Build :** `dbt build --select state:modified+` reconstruit seulement les modèles modifiés
4. **Deploy :** Si la fusion est approuvée, les tables sont mises à jour dans BigQuery

Si un test échoue, la fusion est bloquée. Exemple de test de données :

```sql
-- tests/assert_no_negative_revenue.sql
SELECT * FROM {{ ref('fct_daily_channel_performance') }}
WHERE revenue < 0
```

Ce test réussit si zéro ligne est renvoyée, échoue si une ligne est renvoyée. En production, une anomalie de revenu négatif est détectée et le pipeline s'arrête.

Scénario d'alerte : programmez un job dans dbt Cloud (chaque jour à 06h00), envoyez une notification Slack via un hook `on-run-end` :

```yaml
on-run-end:
  - "{{ post_to_slack_on_failure() }}"
```

Avec [Data Analytics & Engineering d'Insight](https://www.roibase.com.tr/fr/verianalizi), la mise en place de ce pipeline en production prend 4-6 semaines : source mapping + staging layer + intermediate layer + mart + semantic model + exposures + tests + CI/CD.

## Tradeoff : Complexité vs Contrôle

La stack dbt + BigQuery a une courbe d'apprentissage raide. SQL seul ne suffit pas — vous avez besoin de templating Jinja, de configuration YAML, de workflows Git et de CI/CD. Pour les petites équipes (1-2 personnes), cet overhead peut sembler excessif — démarrer directement avec des vues BigQuery + Looker Studio est plus rapide.

Mais quand vous montez en charge (10+ dashboards, 50+ sources, 5+ analystes), sans dbt vous perdez le contrôle. Chaque analyste écrit son propre SQL, les définitions de métriques entrent en conflit, pas de tests, pas de documentation. À ce stade, dbt vous évite de contracter une dette technique plutôt que de l'accumuler.

Approche alternative : construire la semantic layer avec Looker LookML. LookML ressemble à dbt (codifier les métriques), mais il y a un verrouillage auprès du fournisseur, et intégrer des sources en dehors de BigQuery est difficile. dbt est open source, portable, et s'exécute sur BigQuery, Snowflake et Redshift.

Une modern marketing data stack commence par source mapping, s'étend avec semantic layer et se surveille via exposures. dbt + BigQuery codifie ces trois couches — testable, versionnable, reproductible. Vous garantissez la cohérence des métriques sans regarder un seul dashboard.