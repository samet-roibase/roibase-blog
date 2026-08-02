---
title: "dbt + BigQuery ile Современный маркетинговый Data Stack"
description: "Source mapping, modeling layer, semantic layer, exposures — маркетинговые данные, соединённые с механизмом принятия решений: архитектура и практическая реализация dbt."
publishedAt: 2026-08-02
modifiedAt: 2026-08-02
category: verianalizi
i18nKey: data-002-2026-08
tags: [dbt, bigquery, data-stack, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

Маркетинговые команды больше не используют готовые отчёты из Google Analytics — они работают с собственными data pipeline'ами, где каждое правило написано ими. В 2026 году современный маркетинговый data stack состоит из трёх слоёв: raw source'ы, modeling layer и semantic layer. Эта статья показывает, как построить эти три слоя с помощью dbt + BigQuery, какие типичные ошибки возникают на каждом этапе и как создать устойчивую архитектуру для production.

## Source mapping: загрузить данные в BigQuery недостаточно

Вы загрузили GA4, Meta Ads и события sGTM в BigQuery — но это только начало. Source mapping означает преобразование raw таблиц в значимые контракты данных. В dbt определения source'ов живут в `.yml` файлах:

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

Это определение выполняет три функции: (1) Data lineage — какая модель использует какую raw таблицу, (2) Freshness check — если последнее событие старше 12 часов, выдаётся предупреждение, (3) Contract — если отсутствует колонка `event_timestamp`, build падает.

**Самая частая ошибка:** использование raw schema'ы как есть. Писать SQL с nested array'ем GA4 `event_params` без flatten'инга означает, что каждый запрос займёт 200+ строк. Logic `unnest` должна жить в одном месте на этапе source mapping:

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

Теперь эта модель вызывается downstream'ом через `ref('stg_ga4_events')` — синтаксис raw event_params изолирован upstream. Freshness check запускается ежедневно, изменения schema автоматически вызывают ошибки.

## Modeling layer: определите метрику один раз, используйте сто раз

После staging layer идёт modeling layer. Здесь разделяются intermediate модели (business logic) и mart модели (aggregation). В маркетинговом data stack самая критичная модель — это **session → transaction** join:

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

Эта модель запускается ежедневно в 03:00 (dbt Cloud scheduler), Looker Studio подключается напрямую к этой таблице. Когда требуется изменение, вы меняете SQL в одном месте — все dashboard'ы обновляются автоматически.

**Важная деталь:** использование `safe_divide` — если sessions = 0, он не вызывает ошибку деления на ноль, а возвращает null. В production pipeline'е обработка исключений происходит на этом уровне.

### dbt tests: автоматическая проверка качества данных

При определении метрик в modeling layer одновременно пишут тесты:

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

Команда `dbt test` запускает эти правила. Если conversion rate > 1 (в SQL ошибка), build падает и в Slack уходит alert. Вместо ручной QA — автоматизированная проверка качества данных. На этом основании строится весь остальной data stack.

## Semantic layer: определите метрику, а не запрос

С dbt v1.6+ semantic layer вышел из beta. Теперь метрика определяется не в SQL, а в `.yml` файле:

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

Это определение используется в трёх местах: (1) Looker Studio, (2) Slack bot через dbt Cloud discovery API для запроса метрик, (3) Airflow DAG в качестве входа для downstream ML pipeline.

**Преимущество:** метрика потребляется без написания SQL. Marketing analyst просто пишет "Show me ROAS by campaign, last 7 days", и semantic layer автоматически компилирует запрос. SQL logic находится в модели, определение метрики — в semantic layer. Они независимы, изменения изолированы.

**Внимание:** semantic layer всё ещё молод — не все BI инструменты имеют native интеграцию. В production stack Roibase используется гибридный подход: критические метрики в semantic layer, custom анализ через SQL exposure'ы.

### Exposures: документируйте downstream зависимости

Exposures показывают, где за пределами dbt используется модель:

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

Это определение визуализируется в dbt docs — видно, какой dashboard зависит от какой модели, на кого нужно подписать изменения schema. В production, когда нужно сделать breaking change, команда `dbt run --select +mrt_session_metrics+` показывает все downstream зависимости.

**Реальный сценарий:** в GA4 key `page_location` в event_params переименован на `page_url`. Благодаря exposure'ам мы нашли 3 затронутых dashboard'а и 1 Airflow DAG, миграция заняла 2 часа. Без exposure'ов dashboard'ы молча сломались бы, об ошибке узнали бы от users.

## Incremental models: не делайте полный rebuild 2TB данных ежедневно

В маркетинговых данных daily partition'ы достигают терабайтов. Каждый `dbt run` с полным refresh неприемлем — стоимость BigQuery и время выполнения будут недопустимы. Используйте incremental модель:

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

Эта конфигурация делает три вещи: (1) создаёт partition в BigQuery — добавляет новые дни, не трогая старые, (2) `cluster_by` улучшает производительность запросов, (3) стратегия `insert_overwrite` удаляет последние 3 дня и пересчитывает (для late arriving data).

**Разница в стоимости:** 365 дней данных, full refresh = 2.5 TB scan ($12.5), incremental = 3 GB scan ($0.015). Для ежедневного pipeline'а годовая разница ~$4500 vs ~$5. Поэтому incremental модель — основа production stack'а.

## Связать data stack с механизмом принятия решений

dbt + BigQuery создают инфраструктуру, но реальная ценность проявляется в маркетинговых решениях. Типичный сценарий — метрики из semantic layer в Slack bot:

1. Marketing manager пишет в Slack `/metric roas last_30_days campaign=brand`
2. Slack app вызывает dbt Cloud semantic layer API
3. API запрашивает таблицу `mrt_session_metrics`, вычисляет ROAS
4. Результат возвращается в Slack: "Brand campaign ROAS: 4.2x"

Для этого потока нужны semantic layer + custom Python middleware. В production stack Roibase Airflow DAG'ей делает ежедневный snapshot semantic layer, Looker Studio и internal app'ы используют этот snapshot — без проблем с API rate limit.

**Альтернативный подход:** в сервисе [First-Party Data & Ölçüm Architecture](https://www.roibase.com.tr/ru/firstparty) используется гибридный stack — dbt semantic layer + Cube.js. Cube.js добавляет слой кеширования, улучшает BI производительность. Выбор зависит от объёма данных и паттерна запросов.

## Production checklist: перед deployment dbt stack'а

dbt работает локально — перед production нужны эти проверки:

- **CI/CD:** dbt Cloud или GitHub Actions должны запускать `dbt build --select state:modified+` на каждый commit
- **Freshness monitoring:** для критичных source'ов определите `warn_after` и `error_after`
- **Alerting:** webhook dbt Cloud → Slack интеграция; при fail build'а команда узнает в течение 5 минут
- **Documentation:** `dbt docs generate` запускается автоматически, artifact'ы push'ятся в S3/GCS
- **Cost monitoring:** BigQuery slot reservation или on-demand alert — установите threshold $500/день на неожиданные spike'ы
- **Backup strategy:** snapshot таблица критичных моделей — если обновление сломало данные, сможете откатиться

**Самое критичное правило:** в production нет manual `dbt run`. Всё выполняется только через scheduler (dbt Cloud, Airflow, Prefect). Manual run нарушает data lineage, при ошибке невозможно найти root cause.

dbt + BigQuery — позвоночник современного маркетингового data stack'а. Source mapping связывает raw данные с контрактом, modeling layer централизует определение метрики, semantic layer позволяет потреблять метрики без SQL. В production incremental модели и test coverage делают pipeline'ы устойчивыми. Следующий слой — связать данные с real-time activation'ом: CDP, audience sync, incrementality measurement. Но это — отдельная история data stack'а.