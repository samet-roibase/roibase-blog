---
title: "Архитектура таблицы когорты: масштабирование анализа удержания в production"
description: "Materialized views, стратегия partitioning и оптимизация стоимости запросов для масштабирования анализа когорт удержания в production, снижения расходов на 90% и ускорения принятия решений."
publishedAt: 2026-08-14
modifiedAt: 2026-08-14
category: data
i18nKey: data-007-2026-08
tags: [cohort-analysis, bigquery, materialized-views, data-engineering, retention]
readingTime: 8
author: Roibase
---

Анализ удержания находится в центре механизма принятия решений в e-commerce и SaaS-моделях. Однако классические запросы когорты при запуске в production полностью сканируют таблицы событий объёмом в терабайты, выполняются минутами и доводят стоимость запросов до сотен долларов в день. Когда когорты вычисляются по требованию, цикл принятия решений замедляется, аналитический отдел тратит время на оптимизацию запросов, дашборды остаются устаревшими. Решение: хранить таблицы когорт как предварительно вычисленный, партиционированный и инкрементально обновляемый data asset. В этой статье показываем, как настроить materialized views, partitioning и incremental build стратегии на BigQuery, снизить стоимость запросов на 90%, ускорить анализ до миллисекунд и привести решения по удержанию к near real-time.

## Почему классический запрос когорты не масштабируется

Стандартный анализ когорты работает так: сгруппировать пользователей по дате первого события, рассчитать, какой процент вернулся в следующие дни. SQL-запрос делает двойное join таблицы `events` — один раз для поиска даты когорты, один раз для подсчёта поведения удержания. На таблице событий объёмом 500 миллионов строк BigQuery выполняет этот запрос за 10-15 секунд и генерирует стоимость ~$0.50. Запрос повторяется при каждом обновлении дашборда, каждой итерации аналитика, каждом A/B тестовом отчёте.

Проблема не столько в стоимости, сколько в скорости и гибкости. Когда аналитический отдел хочет изменить определение когорты (например, попробовать "второе добавление в корзину" вместо "первой покупки"), переписание, тестирование и валидация запроса занимает часы. Дашборды становятся неактуальными. Когда маркетинг спрашивает "какова была удержанность когорты на прошлой неделе", свежих данных нет — аналитик запускает запрос вручную. Этот цикл замедляет процесс принятия решений на дни.

Расчёты когорт также требуют слоя агрегирования как data asset. Метрика удержания — это не просто "количество пользователей", а "количество активных пользователей/размер когорты" — соотношение. Это соотношение должно обновляться каждый день, новые дни поведения существующих когорт должны добавляться. Классический запрос не поддерживает эту логику с инкрементом, он пересчитывает всё с нуля.

## Превращение когорты в таблицу с помощью Materialized View

Первый шаг решения — зафиксировать определение когорты как materialized view. BigQuery физически хранит результат запроса и инкрементально обновляет при изменениях базовой таблицы. Однако для анализа когорты стандартного MV недостаточно, потому что определение когорты и окно удержания — динамические параметры. Поэтому строим гибридную архитектуру: таблица присвоения когорты + таблица агрегирования событий удержания.

Первая таблица `cohort_assignments` хранит дату, когда пользователь впервые вошёл в когорту:

```sql
CREATE TABLE `project.dataset.cohort_assignments`
PARTITION BY DATE(cohort_date)
CLUSTER BY user_id
AS
SELECT
  user_id,
  MIN(DATE(event_timestamp)) AS cohort_date,
  COUNTIF(event_name = 'purchase') AS total_purchases
FROM `project.dataset.events`
WHERE event_name IN ('first_visit', 'purchase', 'signup')
GROUP BY user_id;
```

Эта таблица содержит каждого пользователя один раз, `cohort_date` — partition key. При появлении нового пользователя добавление происходит только в соответствующий partition. Размер таблицы масштабируется по числу пользователей (не по количеству событий); для 10 миллионов пользователей это ~500 МБ.

Вторая таблица `daily_user_activity` хранит флаг, был ли активен каждый пользователь в каждый день:

```sql
CREATE TABLE `project.dataset.daily_user_activity`
PARTITION BY activity_date
CLUSTER BY user_id
AS
SELECT
  user_id,
  DATE(event_timestamp) AS activity_date,
  TRUE AS is_active
FROM `project.dataset.events`
WHERE event_name IN ('pageview', 'purchase', 'session_start')
GROUP BY user_id, activity_date;
```

Запрос удержания выполняется через join этих двух таблиц:

```sql
SELECT
  c.cohort_date,
  DATE_DIFF(a.activity_date, c.cohort_date, DAY) AS days_since_cohort,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT a.user_id) AS active_users,
  SAFE_DIVIDE(COUNT(DISTINCT a.user_id), COUNT(DISTINCT c.user_id)) AS retention_rate
FROM `project.dataset.cohort_assignments` c
LEFT JOIN `project.dataset.daily_user_activity` a
  ON c.user_id = a.user_id
  AND a.activity_date >= c.cohort_date
WHERE c.cohort_date >= '2026-01-01'
GROUP BY c.cohort_date, days_since_cohort
ORDER BY c.cohort_date, days_since_cohort;
```

Этот запрос больше не сканирует таблицу событий объёмом в терабайты, а выполняет простой join двух малых таблиц. На BigQuery для 10 миллионов пользователей это займёт ~2 секунды, стоимость $0.02 — 96% снижение затрат.

## Стратегия partitioning: какая дата в какой раздел

Стратегия partitioning для таблиц когорт критична, потому что существуют два временных измерения: дата когорты и дата активности. Таблица `cohort_assignments` партиционируется по `cohort_date`, потому что она хранит первое событие пользователя и определение когорты неизменно. При появлении нового пользователя добавление происходит только в partition текущего дня, прошлые partitions остаются неизменяемыми.

Таблица `daily_user_activity` партиционируется по `activity_date`, потому что новые данные активности поступают каждый день и прошлые дни не меняются. Эта структура подходит для incremental refresh: job (dbt или Airflow) каждый день записывает только partition сегодня, не трогая прошлые partitions.

Однако анализ удержания требует join между двумя датами: cohort_date и activity_date. Для оптимизации производительности join используется cluster key. BigQuery с `CLUSTER BY user_id` физически размещает строки с одинаковым user_id рядом, join использует блочное pruning и снижает дисковый ввод-вывод. Для 10 миллионов пользователей join без cluster key занимает ~8 секунд, с cluster key — ~2 секунды.

Partition pruning также важна. Анализ удержания обычно рассматривает когорты за последние 90 дней. Фильтр `WHERE c.cohort_date >= '2026-05-01'` срабатывает partition pruning — BigQuery читает только релевантные partitions. Для 2 лет данных без partition pruning стоимость запроса ~$0.50, с pruning $0.02 — данные, которые сканируются, уменьшаются в 24 раза.

В стратегии partitioning есть компромисс: дневные partitions упрощают incremental refresh, но слишком много partitions (более 1000) увеличивает overhead планирования запросов в BigQuery. Поэтому данные когорт старше 2 лет должны быть заархивированы или консолидированы в месячные partitions.

## Incremental Refresh: вычисляй только новые данные

Таблицы когорт должны обновляться ежедневно, потому что новые пользователи добавляются в когорты и поведение удержания существующих когорт обновляется. Однако полный refresh — пересчёт всей таблицы с нуля — избыточен. Решение: паттерн incremental build.

В dbt incremental модель выглядит так:

```sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'cohort_date', 'data_type': 'date'},
    cluster_by=['user_id'],
    incremental_strategy='insert_overwrite'
  )
}}

SELECT
  user_id,
  MIN(DATE(event_timestamp)) AS cohort_date,
  COUNTIF(event_name = 'purchase') AS total_purchases
FROM {{ source('raw', 'events') }}
WHERE DATE(event_timestamp) = CURRENT_DATE() - 1
{% if is_incremental() %}
  AND DATE(event_timestamp) > (SELECT MAX(cohort_date) FROM {{ this }})
{% endif %}
GROUP BY user_id
```

Эта модель каждый день вычисляет только partition вчерашнего дня. Стратегия `insert_overwrite` удаляет существующий partition и записывает новый. В BigQuery замена на уровне partition — атомарная операция, downstream запросы никогда не читают неполные данные.

Для таблицы `daily_user_activity` логика incremental проще, потому что каждый день добавляется новый partition, прошлые partitions не меняются:

```sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'activity_date', 'data_type': 'date'},
    cluster_by=['user_id']
  )
}}

SELECT
  user_id,
  DATE(event_timestamp) AS activity_date,
  TRUE AS is_active
FROM {{ source('raw', 'events') }}
WHERE DATE(event_timestamp) = CURRENT_DATE() - 1
{% if is_incremental() %}
  AND DATE(event_timestamp) NOT IN (SELECT DISTINCT activity_date FROM {{ this }})
{% endif %}
GROUP BY user_id, activity_date
```

С incremental refresh время дневного job сокращается с 5 минут до 30 секунд. Использование BigQuery slots снижается на 80%, ожидание в очереди запросов исчезает. Когда аналитический отдел открывает дашборд утром в 9:00, вчерашние данные удержания уже готовы.

Однако в incremental build есть риск: поздно прибывающие данные. Если event pipeline имеет задержку в 2-3 часа, partition вчерашнего дня содержит неполные данные. Два подхода решают эту проблему: (1) параметр `lookback_window` в dbt — пересчитывать последние 3 дня каждый раз; (2) использование метаданных `_PARTITIONTIME` в BigQuery для фильтрации по времени вставки partition. Второй способ более эффективен, потому что пересчитывает только поздно прибывшие события.

## Оптимизация стоимости запросов: размер таблицы и паттерны сканирования

Стоимость таблиц когорт зависит от двух факторов: размера таблицы (ГБ) и паттерна сканирования запроса. Таблица `cohort_assignments` для 10 миллионов пользователей занимает ~500 МБ, `daily_user_activity` за 90-дневное окно — ~5 ГБ. При join этих двух таблиц BigQuery сканирует ~6 ГБ, стоимость ~$0.03. Если бы тот же анализ выполнялся на таблице raw events, сканировалось бы 500 ГБ, стоимость была бы ~$2.50 — 80-кратная разница.

Для дальнейшего снижения стоимости используется таблица pre-aggregated cohort summary:

```sql
CREATE TABLE `project.dataset.cohort_retention_summary`
PARTITION BY cohort_date
CLUSTER BY days_since_cohort
AS
SELECT
  c.cohort_date,
  DATE_DIFF(a.activity_date, c.cohort_date, DAY) AS days_since_cohort,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT a.user_id) AS active_users,
  SAFE_DIVIDE(COUNT(DISTINCT a.user_id), COUNT(DISTINCT c.user_id)) AS retention_rate
FROM `project.dataset.cohort_assignments` c
LEFT JOIN `project.dataset.daily_user_activity` a
  ON c.user_id = a.user_id
  AND a.activity_date >= c.cohort_date
GROUP BY c.cohort_date, days_since_cohort;
```

Эта таблица хранит предварительно вычисленный коэффициент удержания для каждой комбинации когорты-дня. Размер таблицы ~100 МБ (10 миллионов пользователей × 90 дней = 900 миллионов строк → после агрегирования ~50,000 строк). Дашборд читает эту таблицу, не выполняя join, время запроса <1 секунда, стоимость ~$0.001.

При оптимизации сто