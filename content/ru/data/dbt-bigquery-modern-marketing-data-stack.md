---
title: "dbt + BigQuery для современного маркетингового хранилища данных"
description: "Source mapping, modeling layer, semantic layer, exposures: архитектура production-ready для преобразования маркетинговых данных в инструмент принятия решений."
publishedAt: 2026-06-30
modifiedAt: 2026-06-30
category: data
i18nKey: data-002-2026-06
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Маркетинговые команды по-прежнему генерируют отчёты через сводные таблицы Excel, data-инженеры переписывают SQL для каждого нового вопроса, KPI'ы расходятся между отделами. В 2026 году такой сценарий — инженерная ошибка. Современный маркетинговый data stack работает на трёх уровнях: интеграция исходных источников, слой трансформации, семантический слой. dbt + BigQuery предоставляют эти три уровня в production-grade качестве — с контролем версий, покрытием тестами и tracking'ом lineage.

## Source Mapping: транспортировка сырых данных в защищённое хранилище

Доставка маркетинговых данных в BigQuery выглядит простой: инструменты ETL (Fivetran, Stitch, Airbyte) загружают GA4, Meta Ads, Google Ads напрямую в схему `raw_`. Но через 6 месяцев upstream система меняет schema — downstream модели ломаются. **Source-определения dbt** помещают этот риск под контроль.

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

Source-определение выполняет три функции: **(1)** срабатывает alarm при upstream изменениях (метрика `freshness` отправляет уведомление в Slack), **(2)** устанавливает schema-контракт (список columns служит документацией), **(3)** отслеживает lineage (dbt docs показывает, какие модели зависят от GA4). Когда Fivetran меняет schema, dbt compile выдаёт ошибку — проблема выявляется до production.

На этапе source mapping пометь identity-сигналы: `user_id`, `client_id`, `fbclid`, `gclid`, `email_sha256`. На уровне modeling layer эти сигналы будут объединены в единый `customer_id`. Потеря сигналов в raw слое делает downstream преобразования невозможными.

### Стратегия секционированных таблиц

GA4-таблица `events_*` имеет суточное партиционирование (`events_20260630`). В dbt используй wildcard-источник с фильтром `_TABLE_SUFFIX`:

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

Эта конфигурация создаёт таблицу `stg_ga4_events` с суточным партиционированием и кластеризацией по `event_name` + `user_pseudo_id` — это снижает стоимость запросов. Incremental materialization сокращает скан 90-дневной истории до 3 дней — экономия 30× на вычислениях.

## Modeling Layer: кодирование бизнес-логики

Слой staging очищает сырые данные, intermediate объединяет join-логику, marts отвечают на бизнес-вопросы. dbt разделяет эти три слоя папочной структурой: `staging/`, `intermediate/`, `marts/`.

**Пример staging** — стандартизация колонок Meta Ads:

```sql
-- models/staging/stg_meta_ads.sql
select
  date_start as report_date,
  campaign_id,
  campaign_name,
  spend as cost_usd,
  impressions,
  clicks,
  actions.value as conversions -- извлечение из nested JSON
from {{ source('meta_ads', 'ads_insights') }}
where date_start >= date_sub(current_date(), interval 90 day)
```

**Пример intermediate** — объединение всех paid-источников:

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

**Пример marts** — ежедневный dashboard производительности:

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

Функция `ref()` строит dependency graph в dbt. Команда `dbt run` выполняет модели в порядке зависимостей. Если `int_paid_media_unified` изменяется, все downstream mart-таблицы автоматически пересчитываются.

### Покрытие тестами

В production ошибочный KPI-отчёт означает шестизначные убытки в e-commerce. Встроенные dbt-тесты добавляют контракты к каждой модели:

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

Команда `dbt test` проверяет эти контракты. В CI/CD pipeline сбой теста блокирует merge — некорректные данные не попадают в production. В работах Roibase целевое покрытие тестами — 85% (метрика: количество строк × критичные поля).

## Semantic Layer: определение метрики в одном месте

В конце 2025 года dbt Labs интегрировала MetricFlow semantic layer в dbt Cloud. Когда маркетинговая команда просит "conversion rate", data-инженер не должен переписывать SQL — определение метрики должно быть централизованным. Файл `metrics.yml` в dbt предоставляет эту абстракцию:

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

Semantic layer выполняет две функции: **(1)** при выборе метрики в BI-инструменте SQL генерируется автоматически (интеграция с Looker, Tableau, Power BI), **(2)** изменение метрики сохраняет согласованность во всех dashboard'ах. Решение "добавить стоимость доставки в расчёт CPA" меняет одну строку — все 40 dashboard'ов обновляются синхронно.

MetricFlow всё ещё в beta-версии (июнь 2026), но применяется в production. Альтернатива — пользовательские макро-функции в dbt:

```sql
-- macros/calculate_cpa.sql
{% macro calculate_cpa(cost_column, conversion_column) %}
  safe_divide({{ cost_column }}, nullif({{ conversion_column }}, 0))
{% endmacro %}
```

Во всех marts-моделях вызываешь `{{ calculate_cpa('total_cost', 'total_conversions') }}` — изменение метрики распространяется из одного места.

## Exposures: привязка модели к BI-dashboard

Файл `exposures.yml` в dbt отслеживает, какая модель используется в каком dashboard. Такой tracking критичен для операций — при изменении модели ты знаешь, какие dashboard'ы нуждаются в тестировании:

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

Exposure-lineage отображается в графе: после `dbt docs generate` веб-интерфейс показывает, какие dashboard'ы зависят от `fct_daily_performance`. Перед breaking change'ом модели можно автоматически уведомить владельцев exposure'ов через Slack webhook.

### Production Deployment Pattern

dbt Cloud production-job'ы выполняются в следующей последовательности:

1. **Source freshness check** — `dbt source freshness` (если upstream данные отстают, job fail)
2. **Model run** — `dbt run --select tag:daily` (ежедневные модели build'ятся в 07:00)
3. **Test execution** — `dbt test` (при нарушении контракта — rollback)
4. **Documentation update** — `dbt docs generate` (lineage graph обновляется)

Использование dbt job вместо BigQuery scheduled query даёт преимущества: version control (каждый deploy привязан к git-коммиту), rollback capability (ошибочная модель восстанавливается за 5 минут), Slack alert (fail теста + freshness warning).

## Компромисс: ELT или reverse ETL

Stack dbt + BigQuery реализует ELT-паттерн (extract-load-transform) — сырые данные сначала загружаются в warehouse, трансформация происходит в BigQuery. Альтернатива: reverse ETL (Hightouch, Census) — данные из warehouse отправляются в SaaS-системы. Эти подходы дополняют друг друга: dbt очищает warehouse, reverse ETL пушит сегменты в Braze/Iterable.

Компромисс: стоимость BigQuery compute. 1 TB скана = $5 — сложная mart-модель, запущенная 10 раз в день, стоит $50/день = $1500/месяц. Оптимизация: incremental materialization + partition pruning + clustering. В проектах Roibase целевая стоимость BigQuery: $0.02 на активного пользователя в месяц — 1M MAU = $20K/год (приемлемо).

Маркетинговый data stack — не одноразовый проект, а развивающаяся архитектура. После постройки foundation из dbt + BigQuery добавляются слои: MMM (marketing mix modeling), incremental testing, identity resolution. Правильная постройка foundation занимает 6-8 недель, но экономит 18 месяцев downstream — каждый новый KPI-вопрос отвечается за 2 часа, ручная очистка данных исчезает, смена attribution-модели — не дневная работа, а часовая. Stack, постороенный правильно, преобразует маркетинговые данные в инструмент принятия решений.