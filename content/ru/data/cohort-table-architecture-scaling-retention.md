---
title: "Архитектура таблиц когорт: масштабирование анализа удержания в production"
description: "Узнайте, как масштабировать таблицы когортного анализа в production с помощью materialized views, partitioning и оптимизации затрат запросов."
publishedAt: 2026-07-28
modifiedAt: 2026-07-28
category: data
i18nKey: data-007-2026-07
tags: [когортный-анализ, bigquery, materialized-views, data-engineering, retention]
readingTime: 9
author: Roibase
---

Каждая организация, занимающаяся анализом удержания пользователей, сталкивается с одной и той же проблемой: запросы когорт либо выполняются 30 секунд в production, либо счет BigQuery приближается к $8.000 в месяц. Запрос `GROUP BY user_id, cohort_week`, который хорошо работает на 100K пользователей в тестовом окружении, падает, когда встречает 50M пользователей и 2 года логов событий. Решение не простое — недостаточно добавить индекс или включить кеш. Нужно с нуля спроектировать архитектуру таблицы под workload анализа удержания.

## Почему когортный анализ требует отдельной архитектуры

Стандартная таблица event log построена на `user_id`, `event_time`, `event_name`. Каждый когортный запрос сканирует миллиарды строк в этой таблице исторически, группируя пользователя по дате первого события. В BigQuery запрос выглядит так:

```sql
WITH cohorts AS (
  SELECT user_id, DATE_TRUNC(MIN(event_time), WEEK) AS cohort_week
  FROM events
  GROUP BY user_id
),
retention AS (
  SELECT 
    c.cohort_week,
    DATE_DIFF(DATE_TRUNC(e.event_time, WEEK), c.cohort_week, WEEK) AS weeks_since_cohort,
    COUNT(DISTINCT e.user_id) AS active_users
  FROM cohorts c
  JOIN events e ON c.user_id = e.user_id
  GROUP BY 1, 2
)
SELECT * FROM retention ORDER BY 1, 2;
```

Каждый раз при выполнении этот запрос читает всю таблицу `events`. 500M строк × 16 байт в среднем = 8 GB сканирования. В BigQuery 1 TB сканирования стоит $6.25, значит 1.000 запросов = $50. Если дашборд обновляется каждые 5 минут, то в месяц 8.640 запросов = $432 только на виджет когорт. Добавь еще 10 аналитиков, боты в Slack, и стоимость удваивается.

Но проблема не только в стоимости — это задержка. JOIN с 500M строк занимает 15–30 секунд. Аналитик поменял фильтр на дашборде, ждет 20 секунд новых данных когорты. Анализ удержания на таких задержках не может быть итеративным.

### Materialized View — первый шаг, но недостаточно

Materialized view в BigQuery предварительно вычисляет когортный запрос:

```sql
CREATE MATERIALIZED VIEW cohort_retention AS
SELECT 
  cohort_week,
  weeks_since_cohort,
  active_users
FROM retention; -- результат CTE-запроса выше
```

Теперь дашборд читает `cohort_retention`, а не `events`. Сканирование 8 GB вместо 80 MB. Задержка 20 секунд вместо 800 ms. Но есть два ограничения:

1. **Стоимость обновления:** Materialized view при каждом refresh'е выполняет базовый запрос. То есть снова 8 GB сканирования. Если обновлять view каждый час, получится 24 × 8 GB = 192 GB/день = 5,8 TB/месяц сканирования. Стоимость не снизилась, только задержка.
2. **Гибкость:** Materialized view статичен. Если аналитик добавит фильтр "retention Android-когорты", view нужно пересчитать. Нельзя добавить pre-filter, потому что `WHERE platform = 'Android'` потребует другого view.

Поэтому архитектура когорт должна быть трёхслойной: raw events → таблица назначения когорт → таблица агрегированного удержания.

## Отдельная таблица назначения когорт

Первый шаг: создай отдельную таблицу, которая присваивает каждого пользователя его когорте. Эта таблица содержит только `user_id` и `cohort_week`, вычисляется из event log, но обновляется один раз в день:

```sql
CREATE OR REPLACE TABLE cohort_assignments
PARTITION BY cohort_week
CLUSTER BY user_id
AS
SELECT 
  user_id,
  DATE_TRUNC(MIN(event_time), WEEK) AS cohort_week,
  MIN(event_time) AS first_seen_at
FROM events
WHERE event_time >= '2024-01-01'
GROUP BY user_id;
```

Эта таблица:
- **Partitioned by cohort_week:** BigQuery создает отдельный блок файла для каждой недели. Фильтр `WHERE cohort_week = '2026-01-05'` читает только одну партицию.
- **Clustered by user_id:** Внутри партиции данные отсортированы по user_id. JOIN ускоряется.
- **Размер:** 50M пользователей × 3 колонки × 16 байт = ~2.4 GB. Если event log 500 GB, эта таблица в 200× меньше.

Теперь запрос удержания использует эту таблицу:

```sql
SELECT 
  c.cohort_week,
  DATE_DIFF(DATE_TRUNC(e.event_time, WEEK), c.cohort_week, WEEK) AS weeks_since,
  COUNT(DISTINCT e.user_id) AS active_users
FROM cohort_assignments c
JOIN events e ON c.user_id = e.user_id
WHERE c.cohort_week >= '2026-01-01'
GROUP BY 1, 2;
```

С partition pruning, если фильтруешь 4 недели когорт, сканирование составит 200 MB. JOIN все еще читает полную `events`, но уже отфильтрованную до когорт, без лишних пользователей.

### Инкрементальное обновление

Таблица `cohort_assignments` обновляется каждый день, но не пересчитывается с нуля. Используй dbt incremental модель:

```sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'cohort_week', 'data_type': 'date'},
    cluster_by=['user_id']
  )
}}

SELECT 
  user_id,
  DATE_TRUNC(MIN(event_time), WEEK) AS cohort_week,
  MIN(event_time) AS first_seen_at
FROM {{ ref('events') }}
{% if is_incremental() %}
  WHERE event_time > (SELECT MAX(first_seen_at) FROM {{ this }})
{% endif %}
GROUP BY user_id
```

Первый запуск обрабатывает все данные, последующие добавляют только новых пользователей. Сканирование 500 GB вместо 2 GB в день.

## Агрегированная таблица удержания: Pre-compute метрик на уровне недели

Таблица назначения когорт ускорила запрос удержания, но дашборд все еще JOIN'ит `events` при каждом запросе. Один шаг дальше: pre-compute метрики удержания на недельной основе, храни в отдельной таблице.

```sql
CREATE TABLE cohort_retention_weekly
PARTITION BY cohort_week
CLUSTER BY weeks_since_cohort
AS
SELECT 
  c.cohort_week,
  DATE_DIFF(DATE_TRUNC(e.event_time, WEEK), c.cohort_week, WEEK) AS weeks_since_cohort,
  COUNT(DISTINCT e.user_id) AS active_users,
  COUNT(*) AS total_events,
  APPROX_QUANTILES(session_duration, 100)[OFFSET(50)] AS median_session_duration
FROM cohort_assignments c
JOIN events e ON c.user_id = e.user_id
GROUP BY 1, 2;
```

Эта таблица:
- **Размер:** 52 недели × 52 недели_с_начала_когорты × 3 метрики = ~8.100 строк (для года данных). Килобайты.
- **Сканирование:** Дашборд читает `cohort_retention_weekly`, `events` не трогает. Сканирование < 1 MB.
- **Задержка:** BigQuery читает 1 MB за 80 ms. Дашборд теперь sub-second.

Компромисс: эту таблицу нужно обновлять один раз в день. Если требуются свежие данные, refresh раз в час (dbt schedule `0 * * * *`). Стоимость refresh'а: JOIN cohort_assignments + events, ~10 GB сканирования. 24× в день = 240 GB, месяц = 7.2 TB. Сравнение: если бы дашборд запускал 1.000 когортных запросов без агрегирования, было бы 8 TB сканирования. Агрегированная таблица снизила сканирование на 10%, задержку с 20 секунд до 80 ms.

### Стратегия Partitioning: cohort_week vs event_week

Таблицу `cohort_retention` партиционировать по `cohort_week` или по `event_week`? Есть два подхода:

**Partition by cohort_week:**
- Использование: "Какая кривая удержания у когорты 2026-W03?"
- Pruning: `WHERE cohort_week = '2026-01-13'` → одна партиция читается
- Сложность: Если дашборд спрашивает "общее удержание последних 4 недель", читаются 4 партиции. Но большинство запросов удержания — когортные, этот подход оптимален.

**Partition by event_week:**
- Использование: "Какие когорты активны на этой неделе?"
- Pruning: `WHERE event_week = '2026-07-21'` → одна партиция
- Сложность: Добавь фильтр когорты, partition pruning не работает, читаются все партиции.

В проектах Roibase по [анализу данных](https://www.roibase.com.tr/ru/verianalizi) таблица удержания партиционируется по cohort_week, потому что 80% запросов удержания — в формате "когорта X, неделя N".

## Оптимизация стоимости запросов: Clustering и BI Engine

Partition pruning сверху вниз (какие блоки файлов читать), clustering слева направо (какие строки в блоке читать). Вместе они минимизируют сканирование.

```sql
CREATE TABLE cohort_retention_weekly
PARTITION BY cohort_week
CLUSTER BY weeks_since_cohort, platform, country;
```

Запрос `WHERE weeks_since_cohort = 4 AND platform = 'iOS'`:
1. Partition pruning → только релевантные cohort_week партиции
2. Clustering → в партиции сначала строки `weeks_since_cohort = 4`, потом `platform = 'iOS'`

BigQuery принимает максимум 4 колонки для clustering. Порядок важен: самую часто фильтруемую колонку поставь первой.

**BI Engine:** In-memory кеш BigQuery. Если зарезервировать 100 GB BI Engine, часто используемые таблицы хранятся в RAM. Таблица `cohort_retention_weekly` весит 50 MB, полностью уместится в BI Engine, сканирование = 0 (cache hit). Стоимость: 100 GB × $100/месяц = $100. Окупаемость: 10 TB экономии сканирования/месяц = $62.50 сэкономлено. ROI положителен.

### Approximation Functions: метрики без точности до 100%

В расчете удержания когорт некоторые метрики должны быть точные (`COUNT(DISTINCT user_id)`), некоторые могут быть приблизительные (медиана длительности сеанса, перцентили).

Approximate функции BigQuery:
- `APPROX_COUNT_DISTINCT(user_id)` → погрешность 2%, в 10× быстрее
- `APPROX_QUANTILES(value, 100)[OFFSET(50)]` → медиана, погрешность 1%
- `APPROX_TOP_COUNT(event_name, 10)` → топ-10 событий

Пример: для 50M пользователей exact `COUNT(DISTINCT ...)` занимает 8 секунд, `APPROX_COUNT_DISTINCT` — 800 ms. На дашборде с real-time фильтрами используй approximate, в финальном отчете — exact.

## Incremental Update Strategy: event-time vs processing-time

Таблица когорт обновляется раз в день, но какие события обрабатывать? Есть два timestamp'а:

1. **event_time:** время события пользователя (client-side)
2. **_PARTITIONTIME:** время, когда BigQuery сохранил событие (server-side)

Incremental update по `event_time`:
```sql
WHERE event_time > (SELECT MAX(event_time) FROM cohort_assignments)
```
**Проблема:** Late-arriving events. Пользователь был offline 3 дня, событие пришло batch'ом. Если `event_time` 3 дня назад, incremental запрос его пропустит.

Incremental update по `_PARTITIONTIME`:
```sql
WHERE _PARTITIONTIME > CURRENT_DATE() - 7
```
**Преимущество:** Переобрабатываешь последние 7 дней, late events ловятся.
**Стоимость:** 7 дней events = ~14 GB сканирования в день (вместо 2 GB).

Компромисс: если late events < 1%, используй `event_time`, сканирование ниже.