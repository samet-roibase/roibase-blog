---
title: "dbt + BigQuery: Современный маркетинговый data stack"
description: "От source mapping к semantic layer: как превратить маркетинговые данные в основу решений? Слой моделирования dbt, определение exposures и production-grade архитектура pipeline."
publishedAt: 2026-06-14
modifiedAt: 2026-06-14
category: data
i18nKey: data-002-2026-06
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Маркетинговые команды в 2026 году принимают решения на основе данных, а не борются с ними. GA4, Meta Ads, Google Ads, CRM, CDP, server-side GTM — всё это падает в разные таблицы. Команда вручную объединяет информацию в электронных таблицах, цифры меняются каждую неделю, никто не доверяет результатам. Этот хаос исчезает с современным data stack'ом: BigQuery как источник, слой трансформации dbt, семантический слой как граф метрик. Вы версионируете код в репозитории, каждое изменение проходит тесты, метрики берутся из единого источника истины. Эта статья показывает, как комбинация dbt + BigQuery превращает маркетинговый pipeline в production-grade систему.

## Source mapping: стандартизация сырых данных

Первая задача dbt — source mapping, приведение сырых данных из разных систем к единой схеме. В BigQuery таблица `analytics_123456.events_*` приходит из GA4, `facebook_ads.ads_insights` из Meta API, `crm.transactions` из Shopify. Каждый источник имеет свой формат timestamp'а, разные идентификаторы пользователей, разные названия колонок валюты. Вы определяете эти сырые таблицы в `sources.yml`:

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

Это определение говорит dbt: "эти таблицы — upstream источник, я их не трогаю, но проверяю свежесть". Команда `dbt source freshness` контролирует, когда последний раз пришли данные — если Meta API опаздывает, система отправляет алерт. Без source mapping вы пишете в каждой модели прямое обращение `SELECT * FROM analytics_123456.events_20260614`, и при изменении названия таблицы ломаются 40 моделей. С mapping'ом ссылка становится `{{ source('ga4', 'events_') }}`, изменение распространяется из одного места.

GA4 использует Unix microsecond для event_timestamp, Meta Ads — ISO строки для date_start, CRM — UTC datetime для created_at. Source mapping нормализует это: в GA4 `TIMESTAMP_MICROS(event_timestamp) AS event_time`, в Meta `PARSE_TIMESTAMP('%Y-%m-%d', date_start) AS event_time`. Эта нормализация обеспечивает чистый входной сигнал для downstream моделей.

## Слой моделирования: staging, intermediate, mart

Мощь dbt заключается в слоистом моделировании — staging, intermediate, mart слои. Staging модели берут данные 1:1 из источника, делают только переименование и приведение типов. `stg_ga4_events.sql`:

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

Staging обеспечивает чистые данные, но без бизнес-логики. Intermediate модели добавляют логику: сессионизация, атрибуция, воронка событий. `int_sessions.sql` группирует GA4 события по сеансам:

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

Mart модели — финальный слой потребления, на них смотрят BI инструменты, Looker, внутренние дашборды. `fct_marketing_performance.sql` объединяет все каналы, считает расходы, доход, ROAS. Каждая mart модель сосредоточена на одной бизнес-сущности: `dim_customers`, `fct_orders`, `fct_sessions`. Naming convention в mart критичен — `dim_` для dimension (клиент, товар), `fct_` для fact (транзакция, событие), `rpt_` для report агрегатов.

## Семантический слой: KPI как код

Семантический слой переносит определения метрик из таблиц в dbt YAML — "что такое доход", "как считается CAC" теперь не в электронной таблице, а в версионируемом коде. В dbt v1.6+ вы определяете граф метрик в `metrics.yml`:

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

С семантическим слоем BI инструмент не считает CAC, это делает dbt. Когда Looker запрашивает CAC, dbt возвращает скомпилированный SQL, который join'ит таблицы расходов и новых клиентов, затем делит. Определение — это код, у него есть история в git: "кто изменил формулу CAC, когда и почему". Формула в электронной таблице теряется, здесь — версионируется.

В проектах Roibase семантический слой входит в [анализ данных и инженерию внутренних метрик](https://www.roibase.com.tr/ru/verianalizi) — не только дефиниция метрики, но иерархия KPI, mapping размерностей, стандартизация гранулярности. Пример: метрика "revenue" — это сумма `fct_orders.order_amount`, но "recognized_revenue" из той же таблицы фильтруется по `recognized_at` timestamp (для SaaS с подписками). Одна таблица, две метрики, разная бизнес-логика.

## Exposures: видимость downstream зависимостей

Exposure — способ dbt ответить на вопрос "кто использует эту модель". Если дашборд Looker смотрит на `fct_marketing_performance`, вы определяете это в `exposures.yml`:

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

Без exposure вы меняете `fct_marketing_performance`, дашборд в Looker показывает нули, 2 часа отлаживаете проблему. С exposure `dbt compile --select +exposure:marketing_dashboard` показывает все upstream модели, вы оцениваете влияние изменения до merging.

Exposure не только для BI инструментов — reverse ETL (Hightouch, Census) тоже exposure. Если вы отправляете таблицу `customers` в Meta CAPI:

```yaml
exposures:
  - name: meta_capi_sync
    type: application
    maturity: high
    depends_on:
      - ref('dim_customers')
    description: "Meta Conversion API — incremental customer events, 5-minute delay"
```

Это говорит: "если изменишь схему dim_customers, сломаешь CAPI sync". Production: обновление модели → ошибка CAPI → потеря данных атрибуции. Exposure дает ранний сигнал.

## Production pipeline: incremental builds и покрытие тестами

В production dbt не делает full refresh каждый день — использует incremental модели. `fct_orders.sql` переобрабатывает только последние 3 дня:

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

Incremental build снижает стоимость BigQuery на 90% — вместо сканирования 2TB сканируете 50GB. Partition + cluster улучшает performance: запрос `WHERE customer_id = 'X'` идет только в нужный cluster, full scan не нужен.

Покрытие тестами критично. Вы пишете тесты в `schema.yml` для каждой модели:

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

`dbt test` выполняет эти условия в BigQuery — если order_amount отрицательный, build падает. В production каждый commit проходит CI/CD: `dbt run --select state:modified+ → dbt test --select state:modified+`. Запускаются измененные модели + их зависимости downstream, затем тесты, только потом merge allowed.

## Оркестрация: Airflow, Prefect, dbt Cloud

dbt сам по себе не оркестратор — вы schedule'ируете его через Airflow или Prefect. Пример Airflow DAG:

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

Альтернатива — dbt Cloud (managed оркестрация, Web IDE, Slack алерты). Но большинство enterprise выбирают Airflow, потому что параллельно с dbt есть другие task'и: upstream API pull, downstream reverse ETL, snapshot таблицы.

Стратегия schedule'ирования зависит от свежести данных. GA4 задерживается на 24 часа (processing_date ≠ event_date), Meta Ads API не real-time. Staging модели триггерятся свежестью источника — когда GA4 выгружает новую partition, `stg_ga4_events` refreshes, это распространяется на intermediate → mart цепь. Airflow sensor проверяет наличие новой partition BigQuery:

```python
wait_for_ga4 = BigQueryTableExistenceSensor(
    task_id='wait_for_ga4_partition',
    project_id='analytics_123456',
    dataset_id='events_',
    table_id=f"events_{yesterday.strftime('%Y%m%d')}",
    poke_interval=300
)
```

Когда partition готова, dbt chain стартует. Этот паттерн решает проблему late-arriving data — API задержка не блокирует pipeline, она его ждет.

## Tradeoffs: что dbt не решает

dbt — это transformation engine, не data loader. Кто загружает данные в BigQuery? Fivetran, Airbyte, custom Python скрипт. dbt предполагает, что сырые данные уже там. Паттерн ELT: Extract-Load-Transform. Отличие от ETL в том, что Transform происходит внутри warehouse'а. dbt отвечает за T, EL — это отдельный toolchain.

dbt не поддерживает real-time streaming. Kafka → BigQuery streaming insert → dbt incremental model chain дает минутную задержку. Для sub-second latency (fraud detection, dynamic pricing) нужны stream processors — Flink, Spark Structured Streaming, Materialize. dbt для этого не подходит.

Поддержка Python моделей в dbt (v1.3+) ограничена. Вы можете манипулировать pandas dataframe'ами, но тяжелый ML training dbt'де не делается. Типичный паттерн: feature engineering в dbt, model training в Vertex AI, inference в BigQuery ML. Python модель dbt:

```python
def model(dbt, session):
    df = dbt.ref('stg_orders').to_pandas()
    df['log_amount'] = np.log1p(df['order_amount'])
    return df