---
title: "Mobile F2P'де Bayesian IAP Price Optimization"
description: "Posterior estimation и segmentная оптимизация для IAP тестирования: probabilistic модель для баланса конверсии, revenue и LTV."
publishedAt: 2026-05-26
modifiedAt: 2026-05-26
category: gaming
i18nKey: gaming-002-2026-05
tags: [f2p-monetization, bayesian-testing, iap-optimization, price-ladder, mobile-gaming]
readingTime: 8
author: Roibase
---

В мобильных F2P играх ценообразование IAP до сих пор работает по интуиции: копируют ladder $0.99, $4.99, $9.99, снижают цену если конверсия упала, повышают если выросла. Но один и тот же пакет за $4.99 может показать 2.1% конверсии на органических пользователях, 1.4% на UA когортах и 8.7% на whale-сегменте D30+. Классический A/B тест здесь недостаточен: либо sample size взрывается, либо ожидание достигает 6 недель, либо остаётся неясно, по какой метрике оптимизировать — по конверсии или доходу. Байесовская оптимизация цены решает все три проблемы одновременно: posterior distribution собирает ранние сигналы, моделирует влияние LTV на уровне сегментов, управляет балансом revenue-конверсия в probabilistic рамках.

## Ограничения Frequentist A/B в IAP ценообразовании

Стандартный A/B тест требует sample size, рассчитанный на достижение p<0.05 между двумя ценовыми точками. При baseline 2% конверсии и целевом росте на 10% с power 80% нужно ~15.000 exposure. Для mid-tier IAP это 4-6 недель. За это время:

- CPI в Meta кампаниях растёт (creative fatigue)
- Меняется состав органических когорт (holiday effect, сдвиги в ASO рейтинге)
- Конкурент запускает новое событие, elasticity рушится

Ещё критичнее проблема revenue-конверсия split: переход $2.99 → $4.99 снижает конверсию с 2.1% до 1.7%, но revenue per mille растёт на 42%. По какой метрике считать p-value? Большинство студий говорят "выиграли в revenue" и идут дальше, но при моделировании D7 LTV оказывается, что whale-сегмент чурнится на 31%, новая цена ударяет по retention.

Байесовский подход держит конверсию и revenue в одной posterior модели: prior belief (beta распределение из предыдущих тестов) + observations (новые данные) → posterior (обновлённое верование). На 3-й день тест может сказать "на данный момент с 73% вероятностью $4.99 лучше", на 7-й день это 89%, на 10-й день regret падает ниже 1% — тест можно остановить.

## Построение Prior Distribution: исторические данные IAP вместо benchmark

Качество байесовского теста зависит от правильно построенного prior. Большинство документации советует "возьми uniform prior, пусть данные говорят", но если у вас есть 6 месяцев истории IAP, сжигать этот источник неразумно. Процесс построения prior на примере:

**Шаг 1:** Извлеки распределение конверсии всех IAP tier'ов за последние 6 месяцев. Для диапазона $0.99–$2.99 конверсия колеблется 1.8–3.2%, median 2.4%. Beta параметры alpha=24, beta=976 отражают это распределение (mean=alpha/(alpha+beta)≈0.024).

**Шаг 2:** Добавь segment-level variance. Органическая когорта показывает конверсию на 18% выше UA когорты (alpha=28, beta=972). Для whale-сегмента отдельный prior: D30+ paying user, конверсия 6.8%, alpha=68, beta=932.

**Шаг 3:** Встрой price elasticity curve. В исторических данных переход $1.99 → $2.99 снижал конверсию в среднем на 14%. Если новый тест будет $2.99 → $3.99, закодируй этот slope в prior:

```python
def price_elasticity_prior(base_price, new_price, base_conversion):
    slope = -0.14 / 1.00  # за $1 рост конверсия падает на 14%
    delta = new_price - base_price
    expected_drop = slope * delta
    adjusted_conversion = base_conversion * (1 + expected_drop)
    alpha = adjusted_conversion * 1000
    beta = 1000 - alpha
    return alpha, beta
```

Этот подход отражает behaviour когорт твоей игры, а не "industry benchmark 2.5%".

## Posterior Estimation и многоуровневая цена

Setup теста: starter pack $2.99 vs $3.99, 7 дней, 50/50 split на UA трафик. Но разделение по сегментам обязательно:

| Сегмент | Prior α | Prior β | Target sample |
|---------|---------|---------|----------------|
| D0–D7 organic | 28 | 972 | 4000 |
| D0–D7 UA | 22 | 978 | 6000 |
| D7+ non-payer | 18 | 982 | 3000 |
| D7+ past buyer | 68 | 932 | 2000 |

Posterior обновляется отдельно в каждом сегменте. После 3-го дня:

**Органический сегмент:** $2.99 → 87 конверсий / 2100 exposure, $3.99 → 71 / 2050. Posterior: α₁=28+87=115, β₁=972+2013=2985 vs α₂=28+71=99, β₂=972+1979=2951. Monte Carlo 10.000 samples даёт P($2.99 лучше) = 78%. По revenue: $2.99 × 87 = $260, $3.99 × 71 = $283. Если моделировать revenue posterior через gamma распределение, то P($3.99 лучше по revenue) = 61%.

На этом этапе решение: если priority конверсия — держи $2.99, если revenue — жди ещё 2 дня. В UA сегменте $3.99 явно лучше (83% posterior probability), тест можно остановить и перенаправить этот сегмент на $3.99.

**Динамическое построение price ladder по сегментам:** После окончания теста IAP инвентарь выглядит так:

- Organic D0–D3: $2.99 starter
- UA D0–D3: $3.99 starter
- D7+ past buyer: $7.99 booster (из отдельного posterior теста)
- Whale (D30+ $50+ LTV): $14.99 premium bundle

Эта структура оптимизирует 4 разные elasticity curve вместо одной глобальной цены. Если интегрировать с работой по [брендированию](https://www.roibase.com.tr/ru/branding), то value proposition в креативе совпадает с IAP tier, и персонализация IAP funnel усиливается.

## Thompson Sampling и Multi-Armed Bandit расширение

Вместо фиксированного 7-дневного теста используй Thompson sampling: при каждом impression сэмплируй из posterior сегмента, покажи цену с максимальным ожидаемым value. Так exploration/exploitation баланс строится динамически во время теста.

Псевдокод:

```python
def thompson_sampling_price(segment, price_variants):
    posteriors = {p: get_posterior(segment, p) for p in price_variants}
    samples = {p: np.random.beta(post['alpha'], post['beta']) 
               for p, post in posteriors.items()}
    revenue_samples = {p: s * p for p, s in samples.items()}
    return max(revenue_samples, key=revenue_samples.get)
```

Этот подход особенно эффективен при тестировании 3+ цен. Классический A/B требует 3× больше sample size для 3 вариантов, Thompson sampling автоматически обнуляет плохие варианты через posterior. К 10-му дню если posterior $2.99 упал до 9%, его exposure сокращается до 5%, sample waste минимален.

Внимание: если источник UA ограничен, Thompson sampling может исчерпать budget. Если суточный бюджет Meta кампании $5000, а Thompson выбрал цену с низкой конверсией, CPA взрывается и бюджет кончается к полудню. Безопасная схема: первые 3 дня 50/50 split, когда posterior credibility перейдёт 80% — открыть Thompson.

## Revenue vs LTV: интеграция Posterior с Retention Model

Финальный уровень IAP оптимизации — LTV проекция. $3.99 может показать низкую конверсию, но D7 retention на 8% выше, и 90-дневный LTV этой когорты превысит LTV $2.99 когорты. Классический A/B это не видит, потому что LTV закрепляется через 90 дней. Когда байесовский posterior интегрируется с survival model, ранние сигналы ловятся.

Setup: для каждого ценового варианта на первых 7 днях построи retention curve с Cox proportional hazard model:

```python
from lifelines import CoxPHFitter

df['price_variant'] = df['variant'].map({'2.99': 0, '3.99': 1})
cph = CoxPHFitter()
cph.fit(df, duration_col='days_retained', event_col='churned', 
        formula='price_variant + segment + paid_d3')
```

Output модели: hazard ratio для $3.99 = 0.88 (churn на 12% ниже, p=0.03). Встрой это в posterior:

**LTV posterior расчёт:**
- $2.99: E[conversion]=0.024, E[D90_retention]=0.34, ARPDAU=$0.12 → LTV=$2.99 × 0.024 + 90 × 0.34 × 0.12 = $3.74
- $3.99: E[conversion]=0.019, E[D90_retention]=0.38, ARPDAU=$0.15 → LTV=$3.99 × 0.019 + 90 × 0.38 × 0.15 = $5.21

Monte Carlo 10.000 итераций LTV posterior distribution: P($3.99 LTV выше) = 91%. Эта posterior credibility даёт намного более сильный сигнал, чем анализ только по revenue. Решение: выбираем $3.99, переуравновешиваем IAP stack.

## Компромисс: сложность модели vs скорость исполнения

Байесовская IAP оптимизация несёт три операционных затраты:

**1. Поддержка Prior:** каждый новый event, изменение мета, запуск у конкурента меняют prior distribution. Пересчёт требуется раз в 6 месяцев. Если в студии нет data scientist, это неустойчиво.

**2. Гранулярность сегментов:** 8 сегментов × 3 цены = 24 posterior'а на отслеживание. На малых сегментах (например, whale) posterior variance высока, confidence interval широкий. Практическое решение: whale сегмент вынести отдельно в A/B, остальное держать в Bayesian.

**3. Фрагментация по платформам:** iOS vs Android цена-sensitivity различается. На App Store конверсия на 23% выше чем на Android (по данным Sensor Tower 2025). Держать posterior отдельно или pooled? Отдельно — sample split, pooled — platform bias. Решение: иерархическая Bayesian модель с platform как random effect.

Всё же Bayesian быстрее, чем ждать 4+ недели A/B. Тест завершается за 10 дней, revenue impact виден на 2-й неделе, LTV проекция обновляется на 30-й день. Frequentist'ом это занял бы 8–12 недель.

## Вывод: Probabilistic Pricing Mindset

В мобильном F2P ценовой тест — больше не бинарное событие, а процесс continuous posterior updating. Вместо разделения конверсии и revenue в отдельные p-value'ы, модель обе метрики в probabilistic рамках, сокращает regret, ускоряет тест, даёт segment-level оптимизацию. Байесовский подход требует дисциплины в построении prior, но взамен даёт право на раннее решение, интеграцию LTV projection, dynamic allocation через Thompson sampling. Если ваш IAP stack более 5 tier и UA бюджет свыше $100K в месяц, байесовская тестовая инфраструктура уже не опция, а необходимость.