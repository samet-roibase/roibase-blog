---
title: "dbt + BigQuery с современным маркетинг-стеком данных"
description: "Source mapping, modeling layer, semantic layer, exposures: production-ready архитектура, связывающая маркетинг-данные с системой принятия решений через dbt и BigQuery."
publishedAt: 2026-05-29
modifiedAt: 2026-05-29
category: data
i18nKey: data-002-2026-05
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Маркетинг-команды всё ещё говорят: "Не смотрев на дашборд, я не знаю результаты кампании." Аналитик пишет новый SQL на каждый запрос. CFO не понимает, почему расчёт CAC отличается в каждом отчёте. Проблема не в технологии — pipeline есть, источники подключены, данные текут. Проблема в архитектуре: между исходными таблицами и дашбордом отсутствует слой определений. Комбинация dbt + BigQuery решает эту проблему: source mapping, modeling layer, semantic layer и exposures стандартизируют данные на уровне логики, а не визуализации.

## Source Mapping: привязываем сырые данные к контракту

В BigQuery стекают данные из CRM, GA4, Meta Ads, Klaviyo. Каждый источник использует разную схему, разные соглашения об именовании, разные форматы временных меток. dbt source mapping позволяет декларировать эти источники как код и тестировать их. В файле `sources.yml` вы объявляете каждую таблицу, добавляете проверки свежести данных, тестируете уникальность.

Пример определения source:

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

Это определение устанавливает контракт: "Если событие GA4 не поступило за 6 часов — выдать предупреждение, за 12 часов — остановить pipeline." В production этот тест привязывается к CI/CD — проблемы с источником обнаруживаются мгновенно. dbt docs автоматически генерирует граф lineage — вы видите, какой дашборд зависит от какого источника.

Без source mapping аналитик начинает с `SELECT * FROM analytics_lake.raw_ga4_events.events` — он не знает, что означает каждая колонка, нет тестов, нет документации. С dbt вы ссылаетесь на источник: `{{ source('raw_ga4', 'events') }}`. Если название таблицы изменится, вы обновляете его в одном месте, все нижестоящие модели автоматически адаптируются.

## Modeling Layer: Staging, Intermediate, Mart

Мощь dbt проявляется в слоях моделирования. Вы разделяете процесс на три уровня: staging (нормализуете формат из источника), intermediate (применяете бизнес-логику), mart (создаёте финальные таблицы метрик).

**Staging layer:** для каждого источника одна модель. Только преобразование типов данных, переименование колонок, приведение временных меток к UTC. Никакой бизнес-логики.

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

**Intermediate layer:** здесь применяется бизнес-логика. Определяете сессии, маппируете категории продуктов, применяете окно атрибуции. Эти модели не идут конечному пользователю — они служат входом для нижестоящих моделей.

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

**Mart layer:** финальные таблицы метрик. Это то, что подключается к дашбордам, BI-инструментам, Looker. Используйте префиксы `fct_` (fact) или `dim_` (dimension).

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

С этой структурой аналитик работает с таблицей `fct_daily_channel_performance`, не трогая логику в staging/intermediate. Если определение метрики изменится, обновление произойдёт в одном месте, все дашборды останутся согласованными.

## Semantic Layer: кодируем определения метрик

В комбинации BigQuery + dbt концепция "semantic layer" реализуется двумя способами: dbt metrics (deprecated в 2023) или dbt semantic models (новый подход). Semantic model отделяет метрику от SQL и определяет её в YAML. Looker, Tableau, Mode читают это определение и вычисляют CAC, LTV, ROAS согласованно.

Пример semantic model:

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

С этим определением метрика "revenue per user" вычисляется одинаково везде. Аналитик в Looker выбирает "RPU", backend берёт определение из semantic layer dbt, SQL не пишется вручную. Если логика изменится (например, исключить отменённые заказы), вы обновляете одно место.

Без semantic layer каждый дашборд переписывает `revenue / users`. В одном отчёте возврат исключен, в другом включен. CMO видит два разных числа — доверие к данным падает. С применением [Архитектуры первосторонних данных и измерений](https://www.roibase.com.tr/ru/firstparty) этот слой становится critical: вы кодируете атрибуцию, согласие, сигналы TCF по одной логике.

## Exposures: отслеживаем финальное применение данных

dbt exposure отвечает на вопрос: "эта модель питает какой дашборд, какой ML-pipeline, какую операционную систему?" Вы определяете это в `exposures.yml`:

```yaml
exposures:
  - name: marketing_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: "Ежедневный дашборд перформанса каналов для CMO"
    depends_on:
      - ref('fct_daily_channel_performance')
    owner:
      name: Marketing Analytics Team
      email: analytics@company.com
```

Определение exposure даёт два преимущества: **impact analysis** (если я изменю эту модель, какие дашборды сломаются?) и **stakeholder mapping** (кто владеет дашбордом, на кого эскалировать проблему?).

В production exposures работают так: dbt build → тест падает → граф lineage показывает затронутые exposure'ы → автоматическое уведомление в Slack → владелец дашборда предупреждён рано. Вопрос "почему дашборд пуст?" поступит от системы CI/CD, а не от пользователя.

Без exposures data team deployит модель вслепую, не зная, кого затрагивает. С exposures каждая модель имеет метку "эта таблица в production, трогать опасно".

## Incremental Models и Partitioning: стоимость + производительность

В BigQuery полное сканирование таблицы дорого. За 1 TB данных query стоит $5, 10 queries в день = $50, месяц = $1500. dbt incremental model обрабатывает только новые строки, исторические данные остаются неизменяемыми.

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

Эта конфигурация делает следующее: в каждом run обрабатываются только последние 2 дня, старые данные не трогаются. `partition_by` включает partition pruning в BigQuery, `cluster_by` улучшает selectivity query. На том же наборе данных вы снижаете стоимость на 90%.

В production incremental model + dbt snapshot реализуют SCD Type 2: вы отслеживаете исторические изменения в dimension-таблицах (изменение сегмента пользователя, переклассификация категории продукта). Когда аналитик спрашивает "в какой сегмент пользователь X входил в прошлом месяце?", вы берёте данные из snapshot, и они совпадают.

## Production Pipeline: CI/CD, Tests, Alerts

dbt-проект хранится в GitHub, каждый commit запускает CI pipeline:

1. **Lint:** `sqlfluff` проверяет формат SQL
2. **Test:** `dbt test` запускает schema-тесты (not_null, unique, foreign_key) и data-тесты (revenue > 0, session_duration < 24h)
3. **Build:** `dbt build --select state:modified+` перестраивает только изменённые модели
4. **Deploy:** при merge в production обновляются таблицы в BigQuery

Если тест падает, merge блокируется. Пример data-теста:

```sql
-- tests/assert_no_negative_revenue.sql
SELECT * FROM {{ ref('fct_daily_channel_performance') }}
WHERE revenue < 0
```

Если тест вернёт 0 строк — он пройден. Если вернёт хотя бы одну строку — падает. В production отрицательный доход считается аномалией, pipeline останавливается.

Сценарий с алертами: в dbt Cloud вы schedule'ите job (каждый день 06:00), hook `on-run-end` отправляет уведомление в Slack:

```yaml
on-run-end:
  - "{{ post_to_slack_on_failure() }}"
```

Внедрение этого pipeline с [Инженерией сохранения и аналитикой данных](https://www.roibase.com.tr/ru/verianalizi) занимает 4–6 недель: source mapping + staging layer + intermediate layer + mart + semantic model + exposure + тесты + CI/CD.

## Компромиссы: сложность против контроля

Stack dbt + BigQuery имеет крутую кривую обучения. Знания SQL недостаточно — нужны Jinja-шаблоны, YAML-конфигурация, Git-workflow, CI/CD. Для маленьких команд (1–2 человека) этот overhead может быть избыточным — быстрее начать с прямых view'ов в BigQuery + Looker Studio.

Но когда масштаб растёт (10+ дашбордов, 50+ источников, 5+ аналитиков), без dbt теряется контроль. Каждый аналитик пишет свой SQL, определения метрик конфликтуют, нет тестов, нет документации. dbt в этот момент предотвращает накопление технического долга вместо его погашения.

Альтернативный подход: LookML в Looker для semantic layer. LookML похож на dbt (определение метрик через код), но есть vendor lock-in, интеграция с non-BigQuery источниками сложнее. dbt — open source, переносим, работает с BigQuery/Snowflake/Redshift.

Современный маркетинг-стек данных начинается с source mapping, масштабируется semantic layer, мониторится через exposure'ы. dbt + BigQuery кодируют эти три слоя, делая их тестируемыми, версионируемыми, воспроизводимыми. Вы гарантируете согласованность метрик без необходимости смотреть на дашборд.