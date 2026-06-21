---
title: "Marketing Mix Modeling: практическая реализация с Robyn"
description: "Строим модель атрибуции с кривыми насыщения, decay адстока и holdout валидацией на фреймворке Robyn от Meta. SQL, R и production pipeline."
publishedAt: 2026-06-21
modifiedAt: 2026-06-21
category: data
i18nKey: data-005-2026-06
tags: [marketing-mix-modeling, robyn, adstock, attribution, mmm]
readingTime: 8
author: Roibase
---

Deprecation cookies и нормативно-правовые требования сдвигают атрибуцию от детерминированных методов к вероятностному моделированию. Marketing Mix Modeling (MMM) — статистический инструмент 1960-х годов — вновь становится центральным звеном. Фреймворк Robyn от Meta обеспечивает практическую реализацию этого перехода: байесовский вывод, кривые насыщения и decay адстока связывают еженедельные маркетинговые расходы с продажами и переносят регрессионную модель в production. Статья показывает, как развернуть Robyn, применить модель к реальным данным, провести grid search гиперпараметров и использовать holdout валидацию для предотвращения переобучения.

## Что такое Robyn и чем он отличается от классической регрессии

Robyn — это фреймворк MMM с открытым исходным кодом, написанный на R. Meta разработала его для собственной маркетинговой команды в 2020 году и выпустила в 2021-м. Основные отличия от классической линейной регрессии:

**Трансформация адстока**: маркетинговый эффект не проявляется мгновенно — ТВ-реклама формирует узнаваемость бренда в течение недель. Адсток моделирует вклад прошлых расходов в текущие продажи через экспоненциальный decay. Robyn поддерживает геометрический и Weibull адсток. Геометрический вариант проще: `adstock_t = spend_t + θ × adstock_(t-1)`, где θ — параметр затухания. Weibull дает большую гибкость — можно смещать пиковый эффект.

**Насыщение (diminishing returns)**: связь расходов и продаж нелинейна. Первые 100 тыс. руб. могут дать 80% ROI, а следующие 100 тыс. — только 40%. Robyn применяет Hill и S-кривые насыщения. Уравнение Hill: `y = V_max × x^n / (K^n + x^n)`, где K — точка полунасыщения, n — крутизна. Эта нелинейность критична для оптимизации бюджета по каналам.

**Настройка гиперпараметров**: значения decay адстока, K и n насыщения неизвестны — их ищут через grid search. Robyn использует генетический алгоритм (NSGAII), проверяя тысячи комбинаций параметров и выбирая лучший компромисс на парето-фронтье.

## Подготовка данных: от SQL к еженедельной гранулярности

Robyn работает с еженедельной гранулярностью. Из логов дневных транзакций агрегируются еженедельные доход и медиа-расходы. Пример запроса в BigQuery:

```sql
WITH weekly_revenue AS (
  SELECT
    DATE_TRUNC(order_date, WEEK) AS week_start,
    SUM(revenue) AS revenue
  FROM `project.dataset.orders`
  WHERE order_date >= '2024-01-01'
  GROUP BY 1
),
weekly_spend AS (
  SELECT
    DATE_TRUNC(date, WEEK) AS week_start,
    channel,
    SUM(cost) AS spend
  FROM `project.dataset.marketing_costs`
  WHERE date >= '2024-01-01'
  GROUP BY 1, 2
)
SELECT
  r.week_start,
  r.revenue,
  COALESCE(s_google.spend, 0) AS google_search_spend,
  COALESCE(s_meta.spend, 0) AS meta_paid_social_spend,
  COALESCE(s_tv.spend, 0) AS tv_spend
FROM weekly_revenue r
LEFT JOIN weekly_spend s_google
  ON r.week_start = s_google.week_start AND s_google.channel = 'google_search'
LEFT JOIN weekly_spend s_meta
  ON r.week_start = s_meta.week_start AND s_meta.channel = 'meta'
LEFT JOIN weekly_spend s_tv
  ON r.week_start = s_tv.week_start AND s_tv.channel = 'tv'
ORDER BY 1;
```

Запрос создает таблицу с одной строкой за неделю, одним доходом и N колонками расходов по каналам. В production лучше читать данные напрямую из BigQuery в R через пакет `bigrquery`:

```r
library(bigrquery)
library(Robyn)

bq_auth()
df_input <- bq_project_query(
  "project-id",
  "SELECT week_start, revenue, google_search_spend, meta_paid_social_spend, tv_spend FROM `project.dataset.mmm_input`"
) %>% bq_table_download()
```

Минимальный объем данных: 104 недели (2 года). Меньший объем создает риск переобучения. Байесовские приоры Robyn рассчитаны на 52+ недели, но 104+ недели лучше захватывают сезонность.

## Настройка модели: robyn_inputs и сетка гиперпараметров

Robyn создает конфигурационный объект функцией `robyn_inputs()`:

```r
InputCollect <- robyn_inputs(
  dt_input = df_input,
  date_var = "week_start",
  dep_var = "revenue",
  dep_var_type = "revenue",
  paid_media_spends = c("google_search_spend", "meta_paid_social_spend", "tv_spend"),
  paid_media_vars = c("google_search_spend", "meta_paid_social_spend", "tv_spend"),
  context_vars = c("competitor_index", "seasonality"),
  window_start = "2024-01-01",
  window_end = "2026-06-14",
  adstock = "geometric",
  hyperparameters = list(
    google_search_spend_alphas = c(0.5, 3),
    google_search_spend_gammas = c(0.3, 1),
    google_search_spend_thetas = c(0, 0.3),
    meta_paid_social_spend_alphas = c(0.5, 3),
    meta_paid_social_spend_gammas = c(0.3, 1),
    meta_paid_social_spend_thetas = c(0, 0.5),
    tv_spend_alphas = c(0.5, 3),
    tv_spend_gammas = c(0.3, 1),
    tv_spend_thetas = c(0.1, 0.7)
  )
)
```

**Расшифровка гиперпараметров:**

- **alpha**: параметр наклона (n) функции насыщения Hill. Высокий alpha = позднее насыщение.
- **gamma**: параметр K Hill — точка полунасыщения. Низкий gamma = раннее насыщение.
- **theta**: геометрический decay адстока. 0 = эффект исчезает мгновенно, 0.7 = 70% эффекта переносится на следующую неделю.

Для каждого канала задаются диапазоны. Robyn выполняет grid search в этих пределах. Для ТВ верхний предел theta — 0.7 (долгоживущий эффект осведомленности), для поиска — 0.3 (быстрая конверсия).

## Запуск модели: robyn_run и парето-оптимизация

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  cores = 8,
  iterations = 2000,
  trials = 5,
  outputs = FALSE
)
```

`robyn_run()` запускает генетический алгоритм на 2000 итераций, тестируя комбинации гиперпараметров. На каждой итерации минимизируются NRMSE (нормированная среднеквадратичная ошибка) и DECOMP.RSSD (остаточная сумма квадратов декомпозиции). Из парето-фронтья выбираются 5 моделей — оптимальный компромисс между качеством подгонки и бизнес-логикой (например, ROI ТВ не должен превышать ROI поиска).

Объект-результат содержит таблицу `df_allpareto` со значениями ROI, ROAS и CPA по каналам для каждой модели. Количество строк = iterations × trials. Ключевые колонки:

| Колона | Описание |
|--------|----------|
| `solID` | ID модели |
| `nrmse` | Нормированная RMSE — ниже = лучше |
| `decomp.rssd` | DECOMP.RSSD — ниже = стабильнее вклады |
| `mape` | Средняя абсолютная процентная ошибка |
| `rsq_train` | R² на тренировочной выборке |
| `google_search_spend_roi` | ROI Google Search |
| `meta_paid_social_spend_roi` | ROI Meta |
| `tv_spend_roi` | ROI ТВ |

Лучшую модель выбираешь по NRMSE + DECOMP.RSSD + бизнес-логике. Хотя Robyn предоставляет Shiny-панель, в production лучше программный выбор:

```r
best_model_id <- OutputModels$allPareto %>%
  filter(nrmse < 0.1, decomp.rssd < 0.05) %>%
  arrange(nrmse) %>%
  slice(1) %>%
  pull(solID)
```

## Holdout валидация: предотвращение переобучения

Модель, подогнанная под тренировочные данные, может не обобщаться на новые. Holdout валидация в Robyn: последние 8–12 недель исключаются из тренировки и используются как тестовый набор. Модель обучается на остальных данных, затем делает прогнозы на тесте. Если MAPE (средняя абсолютная процентная ошибка) на тесте < 15%, модель годна для production.

```r
InputCollect_train <- robyn_inputs(
  dt_input = df_input,
  date_var = "week_start",
  dep_var = "revenue",
  window_start = "2024-01-01",
  window_end = "2026-04-12",  # Последние 10 недель в holdout
  # ... остальные параметры как выше
)

OutputModels_train <- robyn_run(InputCollect_train, iterations = 2000)

# Прогноз на holdout-наборе
df_test <- df_input %>% filter(week_start > "2026-04-12")
predictions <- predict(OutputModels_train, newdata = df_test)
mape_test <- mean(abs((df_test$revenue - predictions) / df_test$revenue)) * 100
```

Если MAPE > 20%, модель переобучена. Нужно сузить диапазоны гиперпараметров или добавить переменные контекста (например, макроэкономические индексы). Байесова регуляризация Robyn (ridge penalty) снижает переобучение, но holdout валидация — финальная гарантия.

## Визуализация кривых адстока и насыщения

Robyn выводит кривые адстока и насыщения через `robyn_outputs()`. В production экспортируешь графики в PNG и встраиваешь в BI-панель:

```r
robyn_outputs(
  InputCollect = InputCollect,
  OutputModels = OutputModels,
  select_model = best_model_id,
  export = TRUE,
  export_location = "/data/mmm_output/"
)
```

Экспортируемые файлы:

- `saturate_curves.png` — для каждого канала зависимость расходов от response. Ось X — расходы, Y — прогнозируемый доход. Кривая выравнивается в точке насыщения.
- `adstock_curves.png` — профиль затухания. X — недели, Y — мультипликатор адстока. Для ТВ видно затухание в течение 6–8 недель.
- `waterfall.png` — декомпозиция дохода: база + сезонность + вклад каждого канала.

На основе этих графиков вместо "увеличь расходы ТВ на 30%" говоришь "ТВ в точке насыщения; перенос 20% в поиск поднимет общий ROI на 12%".

## Production pipeline: dbt + Robyn + Looker Studio

MMM — не одноразовый анализ, а еженедельный refresh. Согласно [подходу Roibase к First-Party Data & Measurement](https://www.roibase.com.tr/ru/firstparty), pipeline выглядит так:

1. **dbt**: из raw event'ов в BigQuery строится таблица `mmm_input` (SQL выше). Запуск каждый понедельник в 00:00 через dbt Cloud.
2. **Robyn R-скрипт**: работает в контейнере Cloud Run. Скрипт читает `mmm_input` через `bigrquery`, вызывает `robyn_run()`, пишет результаты в BigQuery (`mmm_output`: `week_start`, `channel`, `roi`, `predicted_revenue`).
3. **Looker Studio**: питается из `mmm_output`, визуализирует тренд ROI по каналам, кривые насыщения и рекомендации по бюджету.

Контейнер описывается Dockerfile:

```dockerfile
FROM rocker/tidyverse:4.2.0
RUN R -e "install.packages('Robyn', repos='https://cloud.r-project.org')"
RUN R -e "install.packages('bigrquery')"
COPY run_mmm.R /app/run_mmm