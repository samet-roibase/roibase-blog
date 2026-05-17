---
title: "Marketing Mix Modeling: практическая настройка с Robyn"
description: "Настройте экономическую модель Robyn от Meta с кривыми насыщения, decay параметрами adstock и holdout валидацией на stack данных BigQuery."
publishedAt: 2026-05-17
modifiedAt: 2026-05-17
category: data
i18nKey: data-005-2026-05
tags: [marketing-mix-modeling, robyn, meta, adstock, saturation-curve]
readingTime: 8
author: Roibase
---

Окно атрибуции сократилось до 7 дней, отказы от согласия на cookies превысили 40%, многоканальный учёт влияния между каналами стал невозможен. В 2026 году у performance-маркетолога остаётся один надёжный путь — агрегированная эконометрическая модель, Marketing Mix Modeling. Библиотека Robyn, открытая Meta в 2021 году, впервые сделала этот процесс production-ready. Как интерпретировать кривую насыщения, что означает adstock decay, в каких диапазонах работает holdout валидация — в этой статье мы настроим Robyn на data stack BigQuery и ответим на все эти вопросы.

## Что такое Robyn и чем он не является

Robyn — это библиотека на R, выпущенная командой Facebook Marketing Science как открытый исходный код. Его цель: построить регрессионную модель между еженедельными (или ежедневными) расходами по каналам плюс экзогенные макропеременные (праздники, сезонность, цены) и метрику продаж. На выходе: ROAS каждого канала, уровень насыщения, эффект задержки (adstock), оптимальное распределение бюджета.

Чем он не является: это не last-click attribution, не отслеживание customer journey на уровне пользователя. Robyn не использует персональные данные, не ждёт cookie-сигналов. Он работает с aggregate time series регрессией — не Ridge и не Lasso, а с нелинейными трансформациями, сканируемыми оптимизатором Nevergrad.

В типичном MMM процессе моделируется 36 точек данных в месячной гранулярности. Robyn работает даже с ежедневной гранулярностью — минимум рекомендуется 104 недели (2 года). Менее 52 недель — высокая дисперсия, доверительные интервалы ненадёжны.

## Кривая насыщения: S-curve и Hill функция

В ядре Robyn — два преобразования насыщения: Adbudg (S-curve) и Hill. Оба кодируют предположение об убывающем предельном доходе (diminishing returns). То есть каждая дополнительная 1000 руб., потраченная на канал, даёт не столько же конверсий, сколько первая тысяча.

**Формула Hill трансформации:**
```
y = K * (x^alpha) / (S^alpha + x^alpha)
```
- K: максимальный ответ (asymptote)
- S: точка полусытости (при расходах S ответ достигает 50% K)
- alpha: крутизна кривой (alpha > 1 даёт S-curve, alpha < 1 даёт вогнутую)

Robyn оптимизирует параметры alpha и S для каждого канала через Nevergrad. Пробует 10000+ комбинаций, выбирает лучший fit по критерию NRMSE (normalized root mean squared error).

**Практическая интерпретация:**
- Если для Google Ads S = 50000 руб., это значит, что еженедельный расход в 50000 руб. достигает половины потенциального ответа.
- Если alpha = 2.5, то кривая имеет крутую S-форму — ниже 50000 доход низкий, выше 50000 растёт медленно.
- Budget optimizer использует эти кривые для ответа на вопрос: "Лучше ли увеличить Google Ads с 50000 до 60000 руб. или Facebook с 30000 до 40000?"

На практике: поиск обычно вогнутый (alpha < 1), display/video — S-curve (alpha > 1). Спрос на поиск ограничен, пул display безграничен, но внимание пользователя конечно.

## Adstock Decay: моделирование отложенного эффекта

Маркетинговый расход влияет на продажи не только в день траты, но и неделями позже. TV-реклама создаёт brand recall через 3 недели, paid social действует 7 дней. Adstock кодирует эту задержку (carryover) и затухание (decay) математически.

Robyn предлагает две трансформации adstock:
1. **Geometric adstock:** экспоненциальное затухание. Параметр theta (0–1). Theta = 0.5 означает, что 50% эффекта прошлой недели переносится на эту.
2. **Weibull adstock:** более гибкий — отложенный пик + длинный хвост. Параметры: shape (k) и scale (lambda). Предпочтителен для TV-подобных каналов с отложенным пиком эффекта.

**Формула geometric adstock:**
```
adstocked_t = spend_t + theta * adstocked_(t-1)
```

Robyn оптимизирует theta (или k, lambda) для каждого канала через grid search. Пользователь задаёт диапазон в hyperparameters.json (например, theta 0–0.7), модель находит оптимальный theta.

**Что делать в коде:**

```r
hyperparameters <- list(
  google_ads_S = c(0.3, 3),    # диапазон для theta adstock
  google_ads_alphas = c(0.5, 3), # диапазон для saturation alpha
  facebook_ads_S = c(0.1, 2),
  facebook_ads_alphas = c(1, 5)
)
```

Результат: если Google Ads theta = 0.4, а Facebook = 0.2, это означает, что эффект Google дольше — четверть потраты работает ещё неделю спустя, а Facebook умирает за неделю. Budget planner это учитывает.

### Блок кода: простая трансформация geometric adstock (R)

```r
apply_geometric_adstock <- function(spend, theta) {
  adstocked <- numeric(length(spend))
  adstocked[1] <- spend[1]
  for (t in 2:length(spend)) {
    adstocked[t] <- spend[t] + theta * adstocked[t - 1]
  }
  return(adstocked)
}

# Пример: расходы Google Ads
google_spend <- c(10000, 15000, 12000, 8000, 20000)
theta_google <- 0.5
adstocked_google <- apply_geometric_adstock(google_spend, theta_google)
print(adstocked_google)
# [1] 10000.0 20000.0 22000.0 19000.0 29500.0
```

Внутри Robyn этот код оптимизирован на C++, но логика идентична.

## Holdout Validation: тест надёжности модели

При улучшении fit модели существует риск overfitting. 10 каналов + 5 макропеременных + saturation и adstock параметры для каждого → 30+ переменных. На 104 точках данных это слишком много степеней свободы.

Robyn использует holdout validation: исключает последние N недель из обучения, модель учится на историческом периоде, предсказывает на holdout, вычисляет MAPE (mean absolute percentage error) относительно фактических значений.

**Определение holdout в Robyn:**

```r
InputCollect <- robyn_inputs(
  dt_input = df_marketing,
  dep_var = "revenue",
  paid_media_spends = c("google_ads", "facebook_ads", "tiktok_ads"),
  window_start = "2024-01-01",
  window_end = "2026-04-30",
  adstock = "geometric",
  prophet_vars = c("trend", "season", "holiday"),
  prophet_country = "RU"
)

# Holdout: последние 8 недель
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  ts_validation = TRUE,
  ts_holdout = 8  # последние 8 недель — тестовое множество
)
```

**Интерпретация результатов:**
- NRMSE train < 0.10, NRMSE holdout < 0.15 → модель надёжна.
- NRMSE train = 0.05, holdout = 0.30 → overfitting, нужно сузить диапазон гиперпараметров.
- Decomp.RSSD (response sum of squared differences): какую долю объяснённого дохода дают каналы. 0.6+ хорошо, 0.8+ отлично.

Robyn одновременно запускает 5 trials (разные random seeds Nevergrad), каждый — 2000 итераций, показывает лучшие 10 моделей на Pareto фронте. Пользователь выбирает одну, исходя из бизнес-ограничений (например, "ROAS Google не может быть ниже 3").

## BigQuery с Robyn: архитектура pipeline

Robyn работает на R, но источник данных может быть BigQuery. Типичный stack:

1. **BigQuery DW:** таблица ежедневных расходов (spend_daily), таблица конверсий (conversions_daily), макропеременные (holidays, weather, competitor_price).
2. **dbt трансформация:** join + агрегация. Переводит в еженедельные строки, создаёт колонны расходов по каналам.
3. **R скрипт (Cloud Run или Vertex AI):** пакет bigrquery забирает из BigQuery, подаёт в Robyn, пишет результаты обратно в BigQuery.
4. **Looker Studio dashboard:** визуализирует выход модели — ROAS по каналам, оптимальное распределение, графики насыщения.

**Пример dbt модели (marketing_mix_weekly.sql):**

```sql
WITH spend_agg AS (
  SELECT
    DATE_TRUNC(spend_date, WEEK) AS week_start,
    SUM(CASE WHEN channel = 'google_ads' THEN spend ELSE 0 END) AS google_ads_spend,
    SUM(CASE WHEN channel = 'facebook_ads' THEN spend ELSE 0 END) AS facebook_ads_spend,
    SUM(CASE WHEN channel = 'tiktok_ads' THEN spend ELSE 0 END) AS tiktok_ads_spend
  FROM `project.dataset.spend_daily`
  WHERE spend_date BETWEEN '2024-01-01' AND '2026-04-30'
  GROUP BY 1
),
revenue_agg AS (
  SELECT
    DATE_TRUNC(conversion_date, WEEK) AS week_start,
    SUM(revenue) AS total_revenue
  FROM `project.dataset.conversions_daily`
  WHERE conversion_date BETWEEN '2024-01-01' AND '2026-04-30'
  GROUP BY 1
)
SELECT
  s.week_start,
  s.google_ads_spend,
  s.facebook_ads_spend,
  s.tiktok_ads_spend,
  r.total_revenue
FROM spend_agg s
LEFT JOIN revenue_agg r USING (week_start)
ORDER BY week_start
```

Эта таблица материализуется в BigQuery, R скрипт Robyn забирает её через `bigrquery::bq_table_download()`. Выход модели (контрибуция каждого канала по неделям) пишется обратно в BigQuery — BI инструменты читают оттуда.

## Budget Optimizer: оптимальное распределение по Парето

После подгонки модели Robyn запускает второй модуль: budget allocator. Входные данные: общий бюджет (например, 500000 руб./неделю), ограничения по каналам (например, Google Ads не менее 50000 руб.). Выход: оптимальное распределение для максимизации ROAS.

Алгоритм: берёт производную кривой насыщения каждого канала (marginal ROAS), сдвигает расходы до уравнения маржинальных ROAS. Это оптимизация по множителям Лагранжа.

**Пример таблицы результатов:**

| Канал | Текущий расход | Оптимальный расход | Дельта | Текущий ROAS | Оптимальный ROAS |
|---|---|---|---|---|
| Google Ads | 200000 руб. | 180000 руб. | −20000 | 4.2 | 4.5 |
| Facebook Ads | 150000 руб. | 200000 руб. | +50000 | 3.8 | 4.1 |
| TikTok Ads | 100000 руб. | 120000 руб. | +20000 | 3.5 | 3.9 |
| Display | 50000 руб. | 0 руб. | −50000 | 1.2 | — |

Интерпретация: Display даёт ROAS 1.2 даже далеко ниже точки насыщения — его можно убрать. Google Ads уже за точкой насыщения, сокращение бюджета на 20000 поднимет ROAS. Facebook Ads находится на пологой части кривой — увеличение бюджета эффективно.

Эта таблица предоставляется CFO, выход Robyn визуализируется в Looker. Принятие решений становится data-driven: "Дадим Facebook ещё 50000 руб. в месяц" — это уже не предположение, а output модели.

---

Для запуска Robyn нужны: 2 года еженедельных гранулярных данных, R окружение, подключение к BigQuery и 4–6 часов на tuning гиперпараметров. После запуска в production модель refreshится раз в месяц (добавляются 4 новые недели, holdout окно сдвигается). Параметры кривой насыщения и