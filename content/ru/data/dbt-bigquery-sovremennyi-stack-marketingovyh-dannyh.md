---
title: "dbt + BigQuery: современный стек маркетинговых данных"
description: "Source mapping, modeling layer, semantic layer, exposures — четырёхуровневая архитектура, связывающая маркетинговые данные с механизмом принятия решений."
publishedAt: 2026-05-10
modifiedAt: 2026-05-10
category: data
i18nKey: data-002-2026-05
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Маркетинговые команды получают больше данных, чем когда-либо, но решения принимают на основе предположений. Отчёты, собранные в таблицах, показывают разные цифры на каждом дашборде, а на вопрос «Какая реальная стоимость привлечения клиента?» звучат три разных ответа. Проблема не в недостатке данных — проблема в потерях на пути от источника к инсайту. Комбинация dbt + BigQuery создаёт архитектуру, которая устраняет эти потери: source mapping собирает сырые данные, modeling layer преобразует их в бизнес-логику, semantic layer создаёт единый язык для команды, exposures открывают данные для production-использования.

## Source Mapping: от сырых данных к надёжному источнику

Source mapping — первый уровень dbt, первая трансформация маркетинговых данных после загрузки в BigQuery. Сырые события из Google Ads API, Meta Ads, Shopify попадают в staging-слой и стандартизируются. Модель `stg_google_ads__campaign_performance` содержит 127 столбцов, но вы используете 12. Source mapping выбирает эти 12, преобразует временные метки в UTC, приводит campaign_id к типу string, обрабатывает NULL-значения и создаёт чистую таблицу.

В BigQuery source-определения хранятся в файле `sources.yml`. Здесь же задаются проверки freshness — если данные из Google Ads не приходили последние 2 часа, dbt run считается ошибкой. Это enforced contract: pipeline становится надёжнее. Вместо прямого select из raw table используется макрос `{{ source('google_ads', 'campaign_stats') }}` — dbt lineage graph показывает, какая raw table питает какую модель.

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

## Modeling Layer: бизнес-логика как код

После staging следуют слои intermediate и mart — здесь к маркетинговым данным применяется бизнес-логика. В модели `int_campaign_attribution` вычисляются first-touch и last-touch attribution. В таблице `fct_customer_lifetime_value` проводится анализ LTV по когортам. Эти модели работают с использованием incremental materialization dbt — каждый run обрабатывает только данные последних 3 дней, старые записи не трогаются. Таблица customer_event содержит 40 миллионов строк, но благодаря incremental стратегии каждый run занимает 2 минуты.

На уровне mart создаются таблицы для отдельных бизнес-подразделений: `mart_paid_media__daily_performance`, `mart_crm__email_engagement`, `mart_finance__revenue_attribution`. Эти таблицы подключаются к Looker Studio, Tableau, Amplitude — каждый берёт свой метрик из одного источника. Стоимость привлечения клиента больше не предмет обсуждения, потому что формула `paid_media_spend / new_customers` определена в dbt-модели. Она прошла code review, протестирована, находится под версионным контролем.

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

## Semantic Layer: создание единого языка

Semantic layer — функция dbt, появившаяся в версии 1.6, позволяет определить метрику как код, который используют все инструменты. Метрика `revenue` — это не просто `sum(order_total)`, а `sum(case when payment_status = 'completed' then order_total end)`. Вопрос «Включаны ли возвраты?» исчезает, потому что определение метрики лежит на GitHub. Маркетинг, финансы, product-команды используют один метрик `revenue`, только разбивают его по разным dimensions.

В работах Roibase по [архитектуре первоточных данных и измерений](https://www.roibase.com.tr/ru/firstparty) semantic layer — обязательный шаг. Когда customer event собираются из разных touch point'ов, без фиксированных определений метрик каждый анализ даёт разный результат. В dbt semantic layer определяется в файле `metrics.yml` и предоставляется инструментам BI через API — Looker, Hex, Mode получают метрики через semantic layer, везде видна одна цифра.

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

## Exposures: открытие в production

Exposures — механизм dbt для отслеживания downstream-зависимостей: вы определяете, какой дашборд питается от какой dbt-модели. На Looker есть дашборд «Weekly Campaign Performance», который берёт данные из `mart_paid_media__daily_performance`. В dbt это пишется в файл `exposures.yml`. Теперь, если вы захотите внести breaking change в модель, dbt предупредит вас: «Эта модель используется в 3 дашбордах, проведите анализ влияния».

Exposures появляются и в документации — на странице модели в dbt docs видно «Used in 5 dashboards, 2 reverse ETL jobs, 1 ML pipeline». Lineage данных протягивается вплоть до слоя BI. Вы знаете, какой дашборд питается от какого SQL. Время отладки снижается, потому что вы находите проблемный дашборд и прослеживаете его до исходной модели.

| Тип Exposure | Использование | Способ отслеживания |
|---|---|---|
| Dashboard | Looker, Tableau, Metabase | URL + model ref |
| Reverse ETL | Census, Hightouch | Job ID + source table |
| ML Pipeline | Vertex AI, SageMaker | Model name + feature table |
| Operational Tool | Braze, Iterable — сегменты кампаний | Segment ID + dbt model |

## Pipeline Orchestration: расписание каждого слоя

Pipeline управляется через dbt Cloud Scheduler или Airflow. В 6:00 утра сырые данные загружаются в BigQuery (Fivetran, Stitch, Airbyte), в 6:30 запускается dbt run. Staging-модели выполняются за 5 минут, intermediate за 10, mart за 15. В 7:00 semantic layer раскрывается, в 7:15 дашборды Looker обновляются. Когда команда приходит в 9:00, вчерашние данные уже видны — никакого 3-часового лага pipeline.

Test suite запускается при каждом run: `not_null`, `unique`, `accepted_values`, `relationships`. Если в таблице `stg_google_ads__campaign_performance` campaign_id не уникален, dbt run считается провалом. Alert падёт в Slack. Data quality gate'ы enforced на уровне кода. Сломанные данные в production не попадают.

```yaml
# dbt_project.yml on-run-end hooks
on-run-end:
  - "{{ log_dbt_results() }}"
  - "{{ send_slack_notification() }}"
  - "{{ update_looker_cache() }}"
```

## Tradeoff: сложность vs управление

dbt + BigQuery stack вносит сложность. SQL-знания становятся обязательными для аналитиков — «сделаю pivot в Excel» больше не работает. Git workflow, code review, CI/CD — всё это нужно изучать. Для маленьких команд этот overhead дорого стоит. Но tradeoff явный: вы получаете governance. Вместо потерянной формулы в spreadsheet — версионируемый код. На вопрос «Откуда эта цифра?» Git blame даст ответ за 10 секунд.

BigQuery создаёт другой tradeoff. Full table scan'ы дорогие — partition и cluster стратегия обязательны. В dbt incremental-моделях конфиг `partition_by` и `cluster_by` критичен. Pipeline, обрабатывающий 100 GB данных в месяц, требует в BigQuery $50 на slot'ы + $5 storage. Managed service исключает infra-overhead, но без query optimization счёт растет.

Связывание маркетинговых данных с механизмом принятия решений — это уже не задача для spreadsheet и BI tool. dbt + BigQuery stack кодифицирует каждый слой — от source до exposure. Source mapping обеспечивает надёжность сырых данных, modeling layer применяет бизнес-логику, semantic layer создаёт общий язык, exposures открывают данные в production. Pipeline управляется с дисциплиной software engineering.