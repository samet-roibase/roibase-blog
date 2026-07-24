---
title: "Marketing Mix Modeling: практическая настройка с Robyn"
description: "Настройка MMM с помощью фреймворка Robyn от Meta: кривые насыщения, затухание адстока, валидация holdout. Код на R и интеграция с BigQuery включены."
publishedAt: 2026-07-24
modifiedAt: 2026-07-24
category: data
i18nKey: data-005-2026-07
tags: [marketing-mix-modeling, robyn, attribution, data-science, bigquery]
readingTime: 8
author: Roibase
---

Атрибуция ломается последние три года. iOS 14.5, Consent Mode v2, отказ от сторонних cookies — всё это оставляет маркетолога с одним вопросом: какой канал действительно работает? Marketing Mix Modeling (MMM) — это статистический ответ, который разрывает зависимость от cookies и пикселей, работая с агрегированными данными на уровне портфеля. Фреймворк Robyn от Meta превращает MMM из академического упражнения в production-ready pipeline. Эта статья даёт конкретные шаги для настройки Robyn с нуля, интерпретации кривых насыщения, калибровки параметров адстока и валидации модели через holdout-тестирование.

## Что такое MMM и почему это критично сейчас

Marketing Mix Modeling объясняет связь между расходами на медиа и продажами или конверсиями через регрессионную статистику. Он не требует данных на уровне пользователей — работает с агрегированными метриками: недельные или суточные расходы, показы, продажи. Модель рассчитывает маржинальный вклад каждого канала (incrementality) и показывает, когда канал входит в насыщение.

Классическая last-click атрибуция основана на пиксельном отслеживании — весь кредит за конверсию получает последний нажатый канал. MMM наблюдает все каналы в одном временном окне и изолирует корреляцию. Например, если между ТВ-рекламой и продажами есть трёхнедельная задержка (carryover effect), модель захватывает её через параметр «адсток». Кривая насыщения показывает убывающую отдачу: первые 100.000 рублей расходов приносят 50 конверсий, а следующие 100.000 — только 20.

Robyn — это R-пакет Meta, обученный на собственных данных кампаний. Он включает байесовскую гребневую регрессию, многоцелевой эволюционный алгоритм (MOEA) для настройки гиперпараметров и оптимизацию через Nevergrad. После подготовки данных 50 строк кода R производят модель.

## Подготовка данных: из BigQuery в Robyn

Robyn ожидает на входе один CSV/data.frame. Каждая строка — это временной период (неделя или день), каждый столбец — расходы канала, показы или продажи. Пропущенные данные не допускаются — если ячейка пуста, нужна imputation. Минимальная схема:

| date       | tv_spend | fb_spend | google_spend | revenue | control_var |
|------------|----------|----------|--------------|---------|-------------|
| 2024-01-01 | 50000    | 12000    | 8000         | 120000  | 0.8         |
| 2024-01-08 | 55000    | 13000    | 9000         | 135000  | 0.9         |

Запрос для извлечения данных из BigQuery с еженедельной агрегацией:

```sql
SELECT
  DATE_TRUNC(event_date, WEEK) AS date,
  SUM(IF(channel = 'tv', spend, 0)) AS tv_spend,
  SUM(IF(channel = 'facebook', spend, 0)) AS fb_spend,
  SUM(IF(channel = 'google', spend, 0)) AS google_spend,
  SUM(revenue) AS revenue,
  AVG(seasonality_index) AS control_var
FROM `project.dataset.marketing_events`
WHERE event_date BETWEEN '2022-01-01' AND '2024-12-31'
GROUP BY 1
ORDER BY 1
```

Контрольная переменная (тренд, сезонность, макроэкономический индекс) не обязательна, но повышает объяснительную силу модели. Например, в розничной торговле январь — месяц скидок, поэтому добавьте dummy-переменную. Robyn включает эти переменные как «органическую» базовую линию в регрессию.

Для загрузки данных в R используйте пакет `bigrquery`:

```r
library(bigrquery)
bq_auth(path = "service-account-key.json")
sql <- "SELECT date, tv_spend, fb_spend, google_spend, revenue FROM ..."
df <- bq_project_query("your-project-id", sql) %>% bq_table_download()
```

Функция `robyn_inputs()` валидирует схему для совместимости с Robyn. Столбец даты должен быть класса Date, метрики — numeric.

## Конфигурация модели Robyn: адсток и насыщение

Ядро Robyn — функции `robyn_inputs()` и `robyn_run()`. Первый шаг — определить входные параметры модели:

```r
library(Robyn)

InputCollect <- robyn_inputs(
  dt_input = df,
  date_var = "date",
  dep_var = "revenue",
  dep_var_type = "revenue",
  prophet_vars = c("trend", "season", "holiday"),
  prophet_country = "RU",
  paid_media_spends = c("tv_spend", "fb_spend", "google_spend"),
  paid_media_vars = c("tv_spend", "fb_spend", "google_spend"),
  context_vars = c("control_var"),
  adstock = "geometric",
  window_start = "2022-01-01",
  window_end = "2024-10-31"
)
```

**Выбор типа адстока:**
- `geometric`: Наиболее распространённый. Постоянная скорость затухания (например, каждую неделю остаётся 80%). Подходит для ТВ и display.
- `weibull`: Асимметричное затухание — быстрое падение вначале, затем замедление. Логично для видео и кампаний инфлюэнсеров.

Формула геометрического адстока:

```
transformed_value[t] = spend[t] + theta * transformed_value[t-1]
```

`theta` — это скорость затухания (0-1). Robyn автоматически оптимизирует этот параметр, но вы можете установить диапазон вручную:

```r
hyperparameters <- list(
  tv_spend_alphas = c(0.5, 3),       # коэффициент кривой насыщения
  tv_spend_gammas = c(0.3, 1),       # точка перегиба насыщения
  tv_spend_thetas = c(0, 0.5),       # скорость затухания адстока
  fb_spend_alphas = c(0.5, 3),
  fb_spend_gammas = c(0.3, 1),
  fb_spend_thetas = c(0, 0.3)
)

InputCollect <- robyn_inputs(
  InputCollect = InputCollect,
  hyperparameters = hyperparameters
)
```

**Параметры насыщения:**
- `alpha`: форма кривой. Высокий alpha → позднее насыщение.
- `gamma`: точка перегиба — 0.5 означает излом в середине.

Насыщение моделируется через уравнение Хилла:

```
response = spend^alpha / (gamma^alpha + spend^alpha)
```

Robyn оптимизирует эти параметры через эволюционный алгоритм. Он создаёт 2000 моделей и выбирает лучшие на основе Pareto frontier (баланс между R² и NRMSE).

## Запуск модели и интерпретация результатов

Запуск модели Robyn:

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  cores = 8
)
```

Выход — список, где каждая итерация представляет разный набор гиперпараметров. Robyn автоматически выбирает 3 лучшие модели (Pareto-оптимальные). Результаты:

```r
OutputModels$resultHypParam    # параметры для всех моделей
OutputModels$xDecompAgg        # декомпозиция по каналам
OutputModels$resultCalibration # оценка валидации holdout
```

**Пример таблицы декомпозиции:**

| channel      | total_spend | total_response | roi   | mean_response |
|--------------|-------------|----------------|-------|---------------|
| tv_spend     | 2400000     | 1800000        | 0.75  | 15000         |
| fb_spend     | 600000      | 720000         | 1.20  | 6000          |
| google_spend | 400000      | 560000         | 1.40  | 4667          |

**Интерпретация ROI:** Facebook 1.20 — каждый рубль расходов приносит 1.20 рублей дохода. ТВ 0.75 — это не отрицательный ROI, а 0.75 рублей инкрементального вклада сверх базовой линии. Robyn измеряет incrementality, а не last-click кредит.

**Обнаружение насыщения:** Robyn строит график кривой насыщения:

```r
robyn_onepagers(InputCollect, OutputModels, select_model = "2_100_3")
```

На графике видна точка, где кривая начинает выравниваться. Например, если расходы ТВ превышают 80.000 рублей, маржинальный доход падает на 50% — это критический сигнал для оптимизации бюджета.

## Валидация holdout и надёжность модели

Чтобы использовать MMM-модель в production, разделите исторические данные: training set (например, январь 2022 — октябрь 2024) + holdout set (ноябрь-декабрь 2024). Модель обучается на training set и тестируется на holdout. Если MAPE (средняя абсолютная ошибка в процентах) ниже 10%, модель надёжна.

Robyn автоматически выполняет валидацию holdout:

```r
InputCollect <- robyn_inputs(
  InputCollect = InputCollect,
  window_start = "2022-01-01",
  window_end = "2024-10-31",
  rollingWindowStartWhich = 52,  # последние 52 недели — holdout
  rollingWindowEndWhich = 4
)
```

Результаты в таблице `resultCalibration`:

| model_id  | nrmse_train | nrmse_val | decomp.rssd |
|-----------|-------------|-----------|-------------|
| 2_100_3   | 0.08        | 0.12      | 0.05        |

**NRMSE (нормализованная среднеквадратичная ошибка):** Ниже — лучше. 0.12 приемлемо (production-ready — ниже 0.15).
**decomp.rssd:** Согласованность декомпозиции между training и validation. 0.05 → 5% отклонение → стабильная модель.

Если валидация holdout не удалась, возможны две проблемы: (1) Недостаточно данных — нужно минимум 2 года еженедельных данных. (2) Пропущены переменные — добавьте сезонность, расходы конкурентов, изменения цены.

## Связь выходов Robyn с механизмом принятия решений

Экспортируйте таблицу декомпозиции в CSV:

```r
write.csv(OutputModels$xDecompAgg, "robyn_output.csv")
```

Загрузите в BigQuery:

```sql
LOAD DATA OVERWRITE `project.dataset.mmm_results`
FROM FILES (
  format = 'CSV',
  uris = ['gs://bucket/robyn_output.csv']
);
```

Эта таблица подключается к dashboard'ам (Looker, Tableau) или оптимизаторам бюджета. Например, dbt-модель рассчитает оптимальные расходы:

```sql
WITH saturation AS (
  SELECT
    channel,
    total_spend,
    roi,
    total_spend / NULLIF(roi, 0) AS optimal_spend
  FROM `project.dataset.mmm_results`
)
SELECT * FROM saturation WHERE roi > 1.0 ORDER BY roi DESC;
```

Этот запрос ранжирует каналы с ROI > 1 — это приоритеты для увеличения бюджета. Robyn также имеет встроенную функцию оптимизатора бюджета:

```r
AllocatorCollect <- robyn_allocator(
  InputCollect = InputCollect,
  OutputCollect = OutputModels,
  select_model = "2_100_3",
  scenario = "max_response",
  channel_constr_low = c(0.7, 0.7, 0.7),
  channel_constr_up = c(1.5, 1.5, 1.5)
)
```

Выход — рекомендуемый новый бюджет для каждого канала. Ограничения удерживают изменения в диапазоне 70-150% текущих расходов (для снижения операционного риска).

[First-Party Data & Measurement Architecture](https://www.roibase.com.tr/ru/firstparty) критична для Robyn — качество данных, скармливаемых модели, прямо влияет на надёжность. Без server-side event tracking, разрешения identity и интеграции consent mode агрегирование вводит bias.

## Распространённые ловушки и их смягчение

**Мультиколлинеарность:** Если два канала всегда работают одновременно (например, ТВ + Facebook запускаются вместе), модель не может раз