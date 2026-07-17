---
title: "dbt + BigQuery для современного маркетингового хранилища данных"
description: "Source mapping, modeling layer, semantic layer, exposures: четырёхслойная архитектура, связывающая маркетинговые данные с механизмом принятия решений."
publishedAt: 2026-07-17
modifiedAt: 2026-07-17
category: data
i18nKey: data-002-2026-07
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

Отчёт Google Analytics 4 показывает производительность по каналам, Klaviyo регистрирует отправленные письма, панель Meta Ads выводит CPA — но могут ли эти три показателя находиться рядом в одном SQL-запросе? Если нет, механизм принятия решений опирается на предположения. Обещание stack'а dbt + BigQuery просто: смоделировать маркетинговые данные через четыре слоя — от источника к exposure'ам — превратив вопрос "какой канал, какому клиенту, какую ценность создал" в повторяемый SQL pipeline. По мере того как world post-cookie, multi-touch attribution и incrementality становятся обязательными, эта архитектура для boutique-агентства уже не опция, а необходимость.

## Source mapping: разбиение сырых кластеров данных на группы таблиц

В BigQuery каждая платформа создаёт собственный dataset: `ga4_export`, `facebook_ads`, `klaviyo_events`, `shopify_orders`. Их сырые схемы несовместимы — GA4 возвращает вложенный JSON, Facebook API плоский CSV, Klaviyo webhook вообще без нормализации. dbt source mapping — первый слой: написать YAML manifest поверх этого хаоса, зарегистрировать каждую таблицу в блоке `sources`, объявить типы данных, свежесть и частоту загрузки.

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

Этот manifest даёт dbt две вещи: 1) type-safe ссылку на сырую таблицу через macro `source()` вместо `ref()`, 2) команда `dbt source freshness` для определения точки отказа pipeline'а. Если GA4 event не обновлялся 49 часов — BigQuery ошибку не выдаст, но dbt выдаст.

Во время source mapping обязательна PII-аннотация: в рамках GDPR и локальных регуляций должна быть отмечена информация о том, где находятся ID пользователя, email, IP. Каждая таблица с `user_pseudo_id` получает `meta.contains_pii: true`. Этот тег переносится в downstream lineage и связывается с field-level маскированием в semantic layer.

## Modeling layer: три этапа staging → intermediate → mart

Staging models переименовывают сырой source, выполняют type casting, удаляют лишние столбцы, предоставляя downstream стандартную схему. Распаковка `event_params` array'я из GA4 и преобразование в скалярные поля (`page_location`, `session_id`, `transaction_id`) — это работа staging:

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

Эта модель получает префикс `stg_` — downstream никто не трогает source, все берут из staging. Staging models могут быть incremental: каждый день обрабатываются только новые партиции. Команда `dbt build --select stg_ga4__events` выполняется за 30 секунд, не требует переобработки 90 дней истории.

Intermediate models объединяют staging и создают аналитические концепции: `int_sessions`, `int_customer_cohorts`, `int_channel_attribution`. Скрывают логику промежуточных таблиц. Например, расчёт multi-touch attribution является intermediate:

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

U-образная модель — первый и последний контакт получают 40%, промежуточные делят оставшиеся 20%. Эта SQL остаётся в intermediate model, data scientist'ы редактируют файл модели, frontend dashboard не трогает. Если нужна параметризация, в `dbt_project.yml` определяешь `vars.attribution_model: u_shaped` и читаешь через `{{ var('attribution_model') }}`.

Mart models — финальный слой: таблицы, которые dashboard, BI tool или ML pipeline потребляют напрямую. Получают префиксы `fct_` (fact) или `dim_` (dimension). `fct_orders`, `dim_customers`, `fct_ad_performance`. Mart models могут быть денормализованы — overhead join'а остаётся в dbt, не в BI tool. Вместо того чтобы в Looker писать "join order table к customer", в `fct_orders` уже есть столбцы `customer_lifetime_value`, `customer_cohort`.

## Semantic layer: централизованное определение метрик и бизнес-логики

dbt 1.6+ преобразует SQL в концепцию метрик через semantic layer. Раньше каждый dashboard писал свой `sum(revenue)` — теперь определяешь одну метрику `revenue` и все dashboard'ы её потребляют. Определение метрики в YAML в папке `metrics/`:

```yaml
# models/metrics/marketing_metrics.yml
version: 2

metrics:
  - name: total_revenue
    label: Общий доход
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
    label: Стоимость привлечения клиента (CAC)
    calculation_method: derived
    expression: "{{ metric('total_ad_spend') }} / {{ metric('new_customers') }}"
    timestamp: order_date
    time_grains: [month, quarter]
```

С этим определением запрос в Looker "Show me `total_revenue` by `channel` for last quarter" автоматически разворачивается через dbt Semantic Layer API. Не пишешь SQL — вызываешь метрику. `customer_acquisition_cost` — это derived метрика, вычисляется из двух других метрик. Если формула меняется, редактируешь в одном месте, не обновляешь 12 dashboard'ов вручную.

Второе преимущество semantic layer: он требует [архитектуру first-party данных](https://www.roibase.com.tr/ru/firstparty), потому что определение метрики опирается на customer ID. Если `user_pseudo_id` из GA4 и `customer_id` из Shopify ссылаются на одного человека, identity resolution должна быть решена в intermediate model. Таблица `dim_unified_customers` мерджит все сигналы и возвращает `canonical_customer_id`. Этот ID используется как dimension в semantic layer. Без canonical ID метрика CAC будет неправильной — одного клиента посчитаешь дважды.

## Exposures: точки нижележащего потребления

Exposures — последняя концепция dbt: регистрация того, какой dashboard, какой Airflow task, какая модель машинного обучения потребляет данные из этого pipeline. В формате YAML:

```yaml
# models/exposures/marketing_exposures.yml
version: 2

exposures:
  - name: executive_marketing_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: "Dashboard CMO: доход, CAC, LTV по каналам"
    depends_on:
      - ref('fct_orders')
      - ref('fct_ad_performance')
      - metric('total_revenue')
      - metric('customer_acquisition_cost')
    owner:
      name: Marketing Ops Team
      email: ops@roibase.com.tr

  - name: klaviyo_segment_sync
    type: application
    maturity: medium
    description: "BigQuery → Klaviyo segment sync через Hightouch"
    depends_on:
      - ref('dim_unified_customers')
    owner:
      name: CRM Automation
      email: crm@roibase.com.tr
```

С этим manifest'ом после `dbt docs generate` exposures видны как конечные точки в DAG. Если ты меняешь модель `fct_orders`, в графе lineage становится видно, какой dashboard будет затронут. Exposure также служит правилом alerting'а: в Slack можно послать "executive_marketing_dashboard upstream failed".

Поле maturity exposure'а отслеживает технический долг: exposure с `low` maturity может быть создан для временного анализа, `high` maturity — production-critical. Команда `dbt list --select exposure:executive_marketing_dashboard+` выводит дерево зависимостей этого dashboard'а — при deprecation model'и проводишь анализ влияния.

## Test coverage и контракт качества данных

Мощь dbt не только в трансформации, но и в test suite. Для каждой модели определяешь тесты в файле `schema.yml`:

```yaml
# models/marts/marketing/fct_orders.yml
version: 2

models:
  - name: fct_orders
    description: "Денормализованная таблица фактов заказов для BI"
    columns:
      - name: order_id
        description: "Primary key"
        tests:
          - unique
          - not_null

      - name: customer_id
        description: "Foreign key to dim_customers"
        tests:
          - not_null
          - relationships:
              to: ref('dim_customers')
              field: customer_id

      - name: order_total
        description: "Сумма заказа в USD"
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

Команда `dbt test` выполняет эти проверки. Если есть `order_total < 0` — build падает, в Slack идёт alert. Downstream exposures могут спокойно использовать этот контракт — качество данных обеспечивается в pipeline, не в BI tool.

Custom тест добавляется просто: положить SQL файл в папку `tests/`. Пример: "Каждый клиент должен иметь максимум одну активную подписку":

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

Если этот запрос вернёт строки — тест падает. Когда test coverage переходит за 80%, количество data incident'ов падает — метрика Roibase за 2023: после 85% test coverage количество dashboard alert'ов от ошибок в данных снизилось на 60%.

## Pipeline orchestration и production deployment

Если используешь dbt Cloud, настраиваешь scheduled job: каждый день в 04:00 запускается `dbt build --select +fct_orders`. Для self-hosted в Airflow DAG добавляешь `BashOperator` с dbt команду. Благодаря incremental стратегии dbt 90 дней данных обрабатываются за 5 минут, full-refresh становится ненужным.

CI/CD процесс: открыл Pull Request — GitHub Actions запускает `dbt build --select state:modified+` — только изменённые модели и их downstream зависимости. Merge — deploy в production BigQuery dataset. dbt Slim CI сокращает build в PR с 40 минут (full build) до 3 минут для проекта с 200 моделями.

В production `dbt docs generate` output загружается в S3/GCS как статический сайт. Документация версионируется — изменения в схеме модели видны в git history. Новый член команды читает на dbt docs сайте, как вычисляется метрика, нет tribal knowledge.

---

dbt + BigQuery — не единственный способ связать маркетинговые данные с механизмом принятия решений, но самый повторяемый, тестируемый, версионируем