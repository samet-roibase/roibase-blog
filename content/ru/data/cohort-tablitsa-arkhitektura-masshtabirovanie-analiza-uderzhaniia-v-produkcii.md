---
title: "Архитектура таблицы когорт: масштабирование анализа удержания в production"
description: "Materialized views, partitioning и оптимизация стоимости запросов: обработка 100M+ событий в день в таблицах когорт за 5 секунд."
publishedAt: 2026-06-09
modifiedAt: 2026-06-09
category: verianalizi
i18nKey: data-007-2026-06
tags: [cohort-analizi, bigquery, materialized-views, query-optimizacija, retention-engineering]
readingTime: 9
author: Roibase
---

Когда вы переносите метрики удержания в real-time dashboard, первый шок приходит в стоимость запросов. Базовый запрос когорты — «сколько пользователей, зарегистрированных 1 января, активны на день 7?» — при наивной написании JOIN сканирует 200GB данных, работает 18 секунд и генерирует счёт в 4 доллара. Для команды с 500 просмотрами dashboard в день это превращается в 60.000 долларов в месяц. Проблема не в вашей аналитической способности, а в архитектуре таблиц. Чтобы перенести когортный анализ в production, нужно хранить не данные событий, а снимки когорт.

## Naive Cohort Query: почему это не масштабируется

Классический запрос когорты объединяет три таблицы: `users`, `events`, `cohort_definitions`. Каждый запрос сканирует таблицу `events` полностью, без фильтра по partition. При 100M событий в день этот подход становится неустойчивым.

```sql
-- ❌ Anti-pattern: сканирование всех events при каждом запросе
SELECT 
  DATE_TRUNC(u.created_at, DAY) AS cohort_date,
  DATE_DIFF(e.event_date, u.created_at, DAY) AS day_n,
  COUNT(DISTINCT u.user_id) AS retained_users
FROM users u
JOIN events e ON u.user_id = e.user_id
WHERE u.created_at >= '2026-01-01'
  AND e.event_name = 'session_start'
GROUP BY 1, 2
ORDER BY 1, 2;
```

Этот запрос сканирует 480GB данных за 6 месяцев. На BigQuery это занимает 12 секунд из-за использования slots, стоит 2,40 доллара (on-demand pricing: 5$/TB). Если вы умножите одну когорту на 20 разных метрик (доход, количество сессий, коэффициент конверсии), стоимость вырастет до 48 долларов. Если dashboard обновляется 100 раз в день, ежемесячная стоимость достигает 144.000 долларов. Чтобы адаптировать решение для масштабируемого production, существуют две стратегии: **incremental materialization** и **pre-aggregated cohort snapshots**.

### Incremental Materialization: pipeline от событий к когортам через dbt

Вместо расчёта когорт каждый раз, обновляйте накопительную таблицу ежедневными batch'ами. Используя `incremental` стратегию dbt, вы добавляете события нового дня в существующую таблицу когорт.

```sql
-- models/cohort_retention_daily.sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'cohort_date', 'data_type': 'date'},
    cluster_by=['day_n', 'metric_name'],
    unique_key='cohort_date || day_n || metric_name'
  )
}}

WITH new_events AS (
  SELECT 
    u.user_id,
    DATE_TRUNC(u.created_at, DAY) AS cohort_date,
    DATE_DIFF(e.event_date, u.created_at, DAY) AS day_n,
    e.event_name,
    e.revenue_usd
  FROM {{ ref('events') }} e
  JOIN {{ ref('users') }} u ON e.user_id = u.user_id
  {% if is_incremental() %}
  WHERE e.event_date = CURRENT_DATE() - 1  -- только вчерашние данные
  {% endif %}
)
SELECT
  cohort_date,
  day_n,
  'active_users' AS metric_name,
  COUNT(DISTINCT user_id) AS metric_value
FROM new_events
WHERE event_name = 'session_start'
GROUP BY 1, 2, 3

UNION ALL

SELECT
  cohort_date,
  day_n,
  'revenue_per_cohort' AS metric_name,
  SUM(revenue_usd) AS metric_value
FROM new_events
GROUP BY 1, 2, 3;
```

Первый запуск (full refresh) обрабатывает все исторические данные. Каждый следующий день добавляются только новые события за 1 день. Один день из 100M событий сканирует 3,2GB данных (благодаря partitioning и clustering), запрос работает 4 секунды, стоит 0,016 доллара. Итоговая ежемесячная стоимость incremental: 0,48 доллара — в 300.000 раз дешевле, чем наивный подход.

## Materialized Views: автоматический слой кэширования BigQuery

Incremental модель обновляется batch'ами (один раз в день). Если для real-time dashboard нужно добавить данные за последний час, в дело вступает **materialized view** BigQuery. Materialized view физически сохраняет результат базового запроса и автоматически обновляется при изменении исходной таблицы.

```sql
CREATE MATERIALIZED VIEW `project.dataset.cohort_retention_mv`
PARTITION BY cohort_date
CLUSTER BY day_n, metric_name
AS
SELECT
  DATE_TRUNC(u.created_at, DAY) AS cohort_date,
  DATE_DIFF(e.event_date, u.created_at, DAY) AS day_n,
  'active_users' AS metric_name,
  COUNT(DISTINCT u.user_id) AS metric_value
FROM `project.dataset.events` e
JOIN `project.dataset.users` u ON e.user_id = u.user_id
WHERE e.event_date >= CURRENT_DATE() - 90  -- только 90-дневное окно
  AND e.event_name = 'session_start'
GROUP BY 1, 2, 3;
```

При запросе к materialized view BigQuery сначала возвращает кэшированный результат. Если исходная таблица изменяется (добавляются новые события), в фоне вычисляется дельта. Запрос dashboard'а теперь работает за 0,2 секунды, стоит 0 долларов (cache hit). Но учтите: сама materialized view создаёт расходы на хранилище (BigQuery storage: 0,02$/GB/месяц), и если 90-дневная таблица когорт занимает 12GB, это добавляет 0,24 доллара ежемесячных расходов.

**Таблица компромиссов:**

| Метод | Время первого запроса | Время запроса dashboard | Ежемесячные расходы вычислений | Ежемесячные расходы хранилища |
|--------|----------------------|------------------------|---------------------------------|-------------------------------|
| Naive JOIN | 12s | 12s | 144.000$ | 0$ |
| dbt Incremental | 4s (первый batch) | 2s (чтение снимка) | 0,48$ | 0,18$ (таблица снимков) |
| Materialized View | 8s (первая сборка) | 0,2s (cache hit) | 0$ (автоматическое обновление) | 0,24$ |

В production идеально сочетание обоих подходов: **dbt incremental модель** обновляет исторические когорты ежедневным batch'ем, а **materialized view** поддерживает последние 7 дней в real-time.

## Partitioning и Clustering: снижение стоимости запросов на 97%

Если ваши таблицы когорт не разбиты на партиции и не имеют кластеризации, BigQuery сканирует всю таблицу для каждого запроса. На таблице когорт из 1TB (2 года данных) один запрос типа «показать когорту января 2026» сканирует 1TB, стоит 5 долларов. С partitioning + clustering тот же запрос сканирует 8GB, стоит 0,04 доллара.

**Стратегия partitioning:** разбить по полю `cohort_date` с дневной детализацией. Когда BigQuery видит фильтр по partition в запросе, она сканирует только релевантные партиции.

```sql
CREATE OR REPLACE TABLE `project.dataset.cohort_retention`
PARTITION BY cohort_date
CLUSTER BY day_n, metric_name
AS
SELECT * FROM `project.dataset.cohort_retention_temp`;
```

**Clustering:** если внутри partition часто фильтруют определённые поля (например `day_n`, `metric_name`), задайте их как кластеры. BigQuery будет выполнять block-level pruning. Запрос «покажи retention на day_7 + метрику active_users» сканирует только релевантные блоки.

Конкретный пример: 365 партиций (по дням), каждая 3GB, без clustering запрос `day_n=7` сканирует 365 партиций × 3GB = 1TB. С clustering сканируются только блоки `day_n=7`, всего 12GB. Разница в стоимости: 5$ → 0,06$.

**Anti-pattern:** не кластеризуйте по `user_id`. Анализ когорт — это не user-level, а cohort-level агрегация. Кластеризация по `user_id` не помогает query planner'у и снижает эффективность кэша.

## Identity Resolution для точности когорт

Точность анализа когорт зависит от точности `user_id`. Когда сессия с cookie и сессия после логина относятся к одному пользователю, но наивный JOIN создаёт два отдельных записи когорт, возникает ошибка. Эту проблему решает подход из [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/ru/firstparty): строится identity graph между анонимным `client_id` и аутентифицированным `user_id`.

```sql
-- Таблица разрешения идентичности
CREATE TABLE `project.dataset.identity_graph` (
  canonical_user_id STRING,
  client_id STRING,
  user_id STRING,
  merged_at TIMESTAMP
)
PARTITION BY DATE(merged_at)
CLUSTER BY canonical_user_id;

-- Объединение с запросом когорты
WITH resolved_users AS (
  SELECT 
    COALESCE(ig.canonical_user_id, e.user_id) AS user_id,
    e.event_date,
    e.event_name
  FROM events e
  LEFT JOIN identity_graph ig 
    ON e.client_id = ig.client_id OR e.user_id = ig.user_id
)
SELECT 
  DATE_TRUNC(u.created_at, DAY) AS cohort_date,
  DATE_DIFF(r.event_date, u.created_at, DAY) AS day_n,
  COUNT(DISTINCT r.user_id) AS retained_users
FROM resolved_users r
JOIN users u ON r.user_id = u.user_id
GROUP BY 1, 2;
```

Без identity resolution когорты завышаются на 12-18% (один пользователь записывается под двумя разными ID). Эта ошибка делает метрики удержания заниженными, потому что размер когорты в знаменателе растёт, а активность на day_n остаётся той же.

## Мониторинг стоимости запросов: production-monitoring через INFORMATION_SCHEMA

После настройки архитектуры когорт нужна постоянная оптимизация стоимости запросов. Таблица `INFORMATION_SCHEMA.JOBS` в BigQuery показывает количество отсканированных байтов, использование slots и общую стоимость каждого запроса.

```sql
SELECT
  user_email,
  query,
  total_bytes_processed / POW(10, 12) AS tb_processed,
  (total_bytes_processed / POW(10, 12)) * 5 AS cost_usd,
  total_slot_ms / 1000 / 60 AS slot_minutes
FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
  AND statement_type = 'SELECT'
  AND query LIKE '%cohort_retention%'
ORDER BY total_bytes_processed DESC
LIMIT 20;
```

Этот запрос выводит top запросы к таблицам когорт за последние 7 дней, отсортированные по стоимости. Если какая-то панель dashboard запускается 500 раз в день и сканирует по 80GB каждый раз (значит, отсутствует partition filter), это генерирует 500 × 80GB × 5$/TB = 200$ расходов в день. Добавив `WHERE cohort_date >= CURRENT_DATE() - 30` в query панели, вы снижаете стоимость до 6$.

**Production checklist:**
- [ ] Все таблицы когорт разбиты по `cohort_date` partition?
- [ ] `day_n` и `metric_name` кластеризованы?
- [ ] dbt incremental job запускается ежедневно?
- [ ] Materialized view ограничена 90-дневным окном?
- [ ] Query'и dashboard содержат фильтр `WHERE cohort_date >= ...`?
- [ ] Еженедельный отчёт о затратах выполняется через `INFORMATION_SCHEMA`?

Когда архитектура когорт построена правильно, анализ удержания становится production-ready: 100M событий в день, 5 секунд времени запроса, 10 долларов ежемесячных расходов на вычисления. Однако эта архитектура требует first-party identity resolution, стандартизированной схемы событий и дисциплины dbt pipeline — именно поэтому retention engineering — это платформная функция, а не