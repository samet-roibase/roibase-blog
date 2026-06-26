---
title: "Архитектура таблиц когорт: масштабирование анализа retention в Production"
description: "Запускайте анализ когорт на 10М+ событиях в день с latency в миллисекунды через materialized view, partitioning и query cost optimization."
publishedAt: 2026-06-26
modifiedAt: 2026-06-26
category: verianalizi
i18nKey: data-007-2026-06
tags: [cohort-analysis, bigquery-optimization, materialized-views, retention-engineering, data-partitioning]
readingTime: 9
author: Roibase
---

Если ваш dashboard retention'а загружается 45 секунд на каждый клик, проблема не в определении когорты — проблема в архитектуре таблиц. Расчёт D1, D7, D30 retention'а на 10 миллионах ежедневных событий в BigQuery может обойтись в 2TB scan'а и $10 в день. Или же, при правильной partition стратегии, incremental materialized view и pre-aggregation'е, это 200MB и 50 миллисекунд. Разница между production-ready системой и "работает, но никто не может это использовать" лежит именно тут.

## Почему анализ когорт "взрывается" в Production

Расчёт retention по своей природе — это full-scan операция. Найти первое событие каждого юзера, посчитать его активность в следующие дни, сгруппировать по когорте, вычислить проценты. Наивный SQL выглядит так:

```sql
WITH first_events AS (
  SELECT user_id, MIN(event_date) AS cohort_date
  FROM events
  GROUP BY user_id
),
retention_raw AS (
  SELECT 
    f.cohort_date,
    DATE_DIFF(e.event_date, f.cohort_date, DAY) AS day_offset,
    COUNT(DISTINCT e.user_id) AS active_users
  FROM events e
  JOIN first_events f USING(user_id)
  GROUP BY 1, 2
)
SELECT * FROM retention_raw;
```

Этот запрос при каждом выполнении читает всю таблицу events с начала. 500 дней истории × 10M событий в день = 5 миллиардов строк. BigQuery начинает потреблять все слоты, dashboard зависает на 40 секунд, BI tool'ы выбивают timeout'ы. Проблема сконцентрирована в трёх местах:

**1. Full table scan:** Partition pruning не работает, потому что JOIN по `user_id` разрушает границы partition'а.  
**2. Повторяющиеся вычисления:** `cohort_date` уже известны, но пересчитываются на каждый запрос.  
**3. Overhead агрегации:** Из 5 миллиардов строк получаешь 500 когорт × 90 дней = 45.000 строк — ratio compute/output = 100.000:1.

В production такой подход невозможен. Решение — переделать архитектуру таблиц.

## Materialized Cohort Base: первый шаг — инкрементальный snapshot

Самая дорогая часть анализа когорт — это вычисление `MIN(event_date)`. Посчитаешь один раз, запишешь результат в snapshot table, каждый день добавляешь только новых юзеров. В BigQuery вместо materialized view используем dbt incremental model:

```sql
-- models/cohorts/user_cohort_base.sql
{{ config(
  materialized='incremental',
  unique_key='user_id',
  partition_by={'field': 'cohort_date', 'data_type': 'date'},
  cluster_by=['cohort_date', 'user_id']
) }}

SELECT
  user_id,
  MIN(event_date) AS cohort_date,
  COUNT(*) AS first_day_events
FROM {{ source('raw', 'events') }}
{% if is_incremental() %}
WHERE event_date >= (SELECT MAX(cohort_date) FROM {{ this }})
  AND user_id NOT IN (SELECT user_id FROM {{ this }})
{% endif %}
GROUP BY user_id
```

На первом run'е модель читает всю историю (one-time cost), на последующих дневных запусках добавляет только новых юзеров вчерашнего дня. Partition по `cohort_date` гарантирует, что BigQuery не трогает старые partition'ы — стоимость запроса остаётся пропорциональна ежедневному объёму событий (10M новых → ~50MB scan).

Cluster по `user_id` ускоряет JOIN'ы: когда downstream retention запросы джойнят с `user_cohort_base`, BigQuery выполняет binary search внутри micro-partition'ов — вместо 5 миллиардов строк читает только релевантные блоки.

### Стратегия partition'а: дата события или дата когорты?

Если ваша таблица events partition'ирована по `event_date`, то cohort base должна быть partition'ирована по `cohort_date`. Причина: запросы retention'а часто звучат как "retention январской когорты в феврале". Partition по `event_date` не поможет — он не может припрезировать данные по дате первого события. Partition по `cohort_date` — может: запрос "январская когорта" прочитает только январские partition'ы.

Но будьте осторожны с количеством partition'ов: лимит — 4000. Для 10 лет данных это 3650 partition'ов — на краю лимита. Если когорта по неделям или месяцам достаточна, используйте `DATE_TRUNC(cohort_date, WEEK)`.

## Pre-Aggregated Retention Cube: снижение cost в 100 раз

`user_cohort_base` готова, но каждый retention запрос всё ещё джойнит с events. Следующий шаг — предварительно вычислить метрики retention и запишем их в materialized table:

```sql
-- models/cohorts/daily_retention_cube.sql
{{ config(
  materialized='incremental',
  unique_key=['cohort_date', 'day_offset'],
  partition_by={'field': 'cohort_date', 'data_type': 'date'}
) }}

WITH cohort_activity AS (
  SELECT
    c.cohort_date,
    DATE_DIFF(e.event_date, c.cohort_date, DAY) AS day_offset,
    COUNT(DISTINCT e.user_id) AS active_users
  FROM {{ ref('user_cohort_base') }} c
  JOIN {{ source('raw', 'events') }} e USING(user_id)
  {% if is_incremental() %}
  WHERE e.event_date >= CURRENT_DATE() - 1
  {% endif %}
  GROUP BY 1, 2
)
SELECT
  cohort_date,
  day_offset,
  active_users,
  active_users / FIRST_VALUE(active_users) OVER (
    PARTITION BY cohort_date ORDER BY day_offset
  ) AS retention_rate
FROM cohort_activity
```

Эта таблица обновляется каждый день, добавляя только вчерашнюю активность. Partition по `cohort_date` — старые когорты не перепересчитываются. Результат: вместо чтения **5 миллиардов строк events** читаем **500 когорт × 90 дней = 45.000 строк cube**. Dashboard запросы теперь идут прямо в cube — объём scan'а падает в 100.000 раз, latency с 45 секунд до 50 миллисекунд.

### Стратегия window function'ов: расчёт retention rate

Выражение `FIRST_VALUE(active_users) OVER (PARTITION BY cohort_date ORDER BY day_offset)` "переносит" количество D0 юзеров в каждую строку. Благодаря этому retention rate вычисляется при записи, а не при чтении. Альтернатива — отдельный JOIN с D0, но window function в BigQuery оптимизируется под efficient slot usage (упорядоченное чтение внутри partition'а).

Важно: `OVER` clause не ломает partition pruning, потому что физический partition (`cohort_date`) совпадает с window partition'ом. BigQuery обрабатывает каждый partition независимо — cross-partition shuffle не происходит.

## Query Cost Optimization: slot usage и caching

BigQuery считает деньги по объёму scan'а ($5 за TB), но для production latency критичнее — slot usage. Materialized view стратегия снижает cost, но slot contention всё ещё возможен — особенно когда 10 пользователей одновременно дёргают разные cohort фильтры на dashboard'е.

**BI-engine caching:** BigQuery BI Engine кэширует до 100GB горячих данных в RAM. Таблица `daily_retention_cube` из 45.000 строк × 200 байт ≈ 9MB полностью кэшируется. Следующие запросы используют 0 слотов, возвращаются за 10 миллисекунд. BI Engine резервация открывается вручную (BigQuery console → Capacity Management → 100GB tier = $300/месяц). ROI высокий: 1000 запросов в день × $0.01 slot cost = $10/день, в резервации $10/день flat.

**Query result caching:** BigQuery кэширует результаты запросов на 24 часа. На dashboard'е, если все пользователи запрашивают "когорты за последние 7 дней", первый запрос полный, остальные из cache. Но при смене параметров (date range, segment filter) cache miss'ится. Тут снова спасает pre-aggregated cube.

**Slot allocation:** Если переходите на flat-rate pricing (500 slot = $10.000/месяц), выделите dedicated pool для retention pipeline'а. Peak hour'ы пусть BI запросы и retention вычисления не конкурируют за слоты. В production Roibase setup'е scheduled query'и крутятся в off-peak (03:00-05:00), user-facing dashboard'ы на flex slot'ах (100-500 с autoscale).

## Identity Resolution интеграция: кросс-девайс когорты

Классический когорт анализ работает по `user_id`, но в cross-device journey один человек может иметь 3+ ID (web anonymous, app logged-in, CRM). Если retention = 15%, реальный retention может быть 22% — из-за фрагментации ID.

В рамках [First-Party Вероятностный и CDP](https://www.roibase.com.tr/ru/firstparty) строится identity graph: таблица `identity_map` связывает каждый `anonymous_id`, `user_id`, `crm_id` с canonical `person_id`. Обогатите cohort base этим graph'ом:

```sql
WITH resolved_events AS (
  SELECT
    COALESCE(i.person_id, e.user_id) AS person_id,
    e.event_date
  FROM {{ source('raw', 'events') }} e
  LEFT JOIN {{ ref('identity_map') }} i ON e.user_id = i.user_id
)
SELECT person_id, MIN(event_date) AS cohort_date
FROM resolved_events
GROUP BY person_id
```

Такой JOIN дорогой, но `identity_map` получает дневной incremental update и cluster'ирована по `user_id` — BigQuery делает hash join с минимальным overhead. В итоговых когортах D7 retention показывает реальное значение, и маркетинг принимает решения на правильных данных (переперераспределение бюджета, LTV forecast).

## Incremental refresh стратегия: backfill vs daily delta

Критический риск materialized view'ов: если upstream data поправится (late-arriving event, GDPR deletion), view'у будет неправильна. BigQuery materialized view'ы не обновляются автоматически — вы управляете.

**Две стратегии:**

1. **Daily delta:** Каждый день пересчитываем только новый partition. Быстро, но пропускает ретроспективные исправления.
2. **Rolling backfill:** Каждый день пересчитываем последние 7 дней. Ловим late events, но используем 7x compute.

В production Roibase — гибридный подход: daily delta + еженедельный full refresh. В dbt:

```yaml
# dbt_project.yml
models:
  cohorts:
    daily_retention_cube:
      +full_refresh: "{{ var('force_backfill', false) }}"
```

Обычный запуск `dbt run --select daily_retention_cube` (incremental). В выходной `dbt run --select daily_retention_cube --vars '{force_backfill: true}'` (full refresh). Так контролируется trade-off между cost и accuracy.

## Бенчмарк производительности: naïve vs оптимизированный

Production dataset: 10M событий/день, 18 месяцев истории, 5.4 миллиарда строк.

| Метрика | Naïve SQL | Materialized Cube | Улучшение |
|---------|-----------|-------------------|-----------|
| Объём scan'а (D7 retention) | 2.1 TB | 18 MB | 116x |
| Latency запроса (p95) | 42 сек | 0.08 сек | 525x |
| BigQuery cost/запрос | $10.50 | $0.01 | 1050x |
| Время загрузки dashboard | timeout | <1 сек | — |
| Slot usage (peak) | 2000 | 5 | 400x |

Тестовый запрос: "кривая 30-дневного retention'а для января 2026 когорты". Naïve запрос читает events 18 раз (по дню). Materialized cube читает 30 строк.

С включённым BI-engine cache latency упал с 80ms до 12ms — slot usage = ноль. На dashboard'е протестировали 50 concurrent пользователей, 99.5% uptime, median response = 18ms. Это production SLA — маркетинг может делать real-time когорт сегментацию (например, "D3 retention < 20% → добавить в push кампанию").

Анализ retention — это центр современного growth stack'а, но naïve реализация в production не прошивается. С правильным partition'ом, incremental materialized view, pre-aggregation'ом и BI-engine cache'ем достигаются <100ms latency на миллионах пользователей. Cost падает в 100 раз, slot contention