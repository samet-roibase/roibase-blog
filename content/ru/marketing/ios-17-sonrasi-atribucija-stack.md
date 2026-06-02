---
title: "iOS 17 после SKAdNetwork 4: переосмысление атрибуции"
description: "ATT, SKAdNetwork 4 и modeled conversions: практическое руководство по восстановлению атрибуции в iOS для периода post-lookback maturity и эффективного бюджетирования."
publishedAt: 2026-06-02
modifiedAt: 2026-06-02
category: marketing
i18nKey: marketing-003-2026-06
tags: [ios-attribution, skadnetwork, att, modeled-conversions, mobile-measurement]
readingTime: 8
author: Roibase
---

Прошло пять лет с момента внедрения Apple App Tracking Transparency в iOS 14.5. С тех пор фундаментальные предположения мобильного performance-маркетинга переписаны. Детерминированная пользовательская атрибуция мертва, вероятностные и агрегированные модели стали обязательны. SKAdNetwork 4 и iOS 17 вводят новую схему значений конверсий, окно post-lookback maturity и modeled conversions — фундаментально переосмысляют игру. В этой статье мы разберем, как строить атрибуцию в iOS в 2026 году: какие сигналы использовать, в каком порядке их приоритизировать и как интегрировать MMP с incrementality-тестами.

## Атомарная структура атрибуции после ATT

До iOS 14.5 MMP-платформы (Adjust, AppsFlyer, Kochava) читали IDFA на уровне устройства и привязывали каждую конверсию прямо к кампании. С ATT этот механизм закрыт для 95% пользователей (данные Statista 2025: opt-in всего на уровне 7%). Сегодня у нас три слоя:

**1. Детерминированный (пользователи с opt-in IDFA):** Для оставшихся 7%, дающих разрешение, классический поток MMP всё ещё работает. Timestamp клика/impression, инсталл, in-app event — всё на уровне пользователя. Но этот сегмент больше не репрезентативен.

**2. SKAdNetwork (агрегированные postback'и):** Собственная privacy-first рамка Apple. Окно атрибуции 0–72 часа; значение конверсии кодируется 6 битами (0–63). В SKAdNetwork 4 добавлены второй и третий postback (8–35 дней), благодаря чему D7–D30 retention теперь измеримы.

**3. Modeled conversions:** Машинное обучение от MMP для предсказания конверсий. Объединяет агрегированные данные кликов/impressions + счётчики инсталлов + сигналы SKAN. Надёжность ниже детерминированного, но обеспечивает масштаб.

Эти три слоя нужно использовать вместе. Ни один не достаточен сам по себе: IDFA слишком узкий, SKAN агрегирован и задержан, modeled основан на прогнозе. Архитектура, которая уравновешивает все три — стала core competency.

## Что привнёс SKAdNetwork 4

SKAdNetwork 4 (появился в iOS 16.1, стал зрелым в iOS 17) — три крупных инновации:

### Иерархия значений конверсий и цепь postback'ов

Вместо одного 6-битного значения появилось три postback'а: первый 0–2 дня, второй 3–7 дней, третий 8–35 дней. Каждый несёт собственное 6-битное значение. Это позволяет отделить ранний сигнал IAP (инсталл-покупка <48ч) от сигнала retention (count сессий D3–D7). Раньше приходилось втискивать все сигналы в 64 слота; теперь комбинаций 64×3=192 (практически 64+64+64 последовательный encoding).

**Пример маппинга:**
- **Postback 1 (0–2 дня):** Статус D0 IAP (0=нет события, 1–10=bracket дохода, 11–20=конкретный SKU, 21–63=custom blend)
- **Postback 2 (3–7 дней):** Tier retention D3–D7 (0=churn, 1–20=band count сессий, 21–40=глубина engagement)
- **Postback 3 (8–35 дней):** D30 LTV прокси (0–63=bracket совокупного дохода)

Правильное выстраивание этой структуры требует еженедельного пересмотра маппинга значений конверсий. По мере изменения поведения пользователей самый информативный сигнал может переместиться в другой слот.

### Source Identifier и иерархический Source ID

SKAdNetwork 4 отображает ID приложений издателей и субсетей в четырёхуровневой иерархии. Теперь это не просто "пришло из Meta", а "Meta → Audience Network → App издателя X" (если ad network это раскрывает). Вы можете сравнивать performance субиздателей.

На практике Facebook, TikTok, Google не полностью раскрывают это поле, но для programmatic и rewarded video сетей это создаёт критическую разницу.

### Поддержка Web-to-App атрибуции

С iOS 17.4 SKAdNetwork начал поддерживать web-клики. Если пользователь нажал на Safari-баннер, перешёл в App Store и инсталлировал приложение, это попадает в SKAN postback. Для брендов, работающих с web + app UA-стратегией, это позволяет объединить web-сигналы с [Performance Marketing (PPC)](https://www.roibase.com.tr/ru/ppc) кампаниями и вычислить cross-channel incrementality.

## Modeled Conversions: механизм, условия надежности

Modeled conversions — это механизм, при котором MMP объединяет SKAN postback'и, агрегированные числа impression/click'ов и счётчики инсталлов, применяя машинное обучение для вероятностной атрибуции. AppsFlyer называет это "predictive analytics", Adjust — "statistical modeling" — технически одно и то же: регрессия + Bayesian вывод.

**Условия надежности:**
1. **Достаточный объём данных:** Минимум 500+ инсталлов/день, 50+ конверсий на кампанию (SKAN или IDFA). Меньше — модель переобучается.
2. **Консистентность SKAN-сигналов:** Маппинг значений конверсий должен быть стабилен. Если менять маппинг ежедневно, модель не уловит исторический паттерн.
3. **Калибровка через incrementality-тест:** Каждый квартал минимум один geo-holdout или time-based holdout. Вы сравниваете modeled цифры с фактическим lift'ом и применяете bias correction.

**Плохой пример использования:** Запустили новую кампанию, за 3 дня 20 инсталлов, MMP выдал "modeled 15 IAP". Это чистый шум — sample слишком мал. Подождите минимум 2 недели.

**Хороший пример использования:** За 30 дней Meta + TikTok + Google UAC в сумме 50K инсталлов, SKAN принес 3K postback'ов конверсий. MMP смоделировал 8K. За тот же период geo-тест holdout (Франция vs Германия) показал +12% lift. Вы ревизировали modeled до 8K × 1.12 = 8.96K. Это надежно.

## Post-Lookback Maturity: сигналы после 35 дней

Третий postback SKAdNetwork 4 охватывает события в окне 8–35 дней. После 35-го дня никаких SKAN postback'ов не приходит. Но реальное поведение пользователя не заканчивается на 35 день: D60 retention, D90 LTV, годовое возобновление подписки.

**Подходы к решению:**

1. **Cohort-based LTV projection:** Используя SKAN + modeled conversion data за первые 35 дней, вы fit'ите cohort LTV curve (обычно power law или exponential decay). Экстраполируете на 90–180 дней. Это прогноз, но при достаточном размере cohort variance низкая.

2. **Cross-channel holdout и incrementality:** Паузируете канал на 2 недели, измеряете изменение organic install'ов и in-app revenue. Считаете net incrementality, backfill'ируете post-35-day сигнал этим тестом. Запускайте quarterly.

3. **Server-side event enrichment:** Отправляете поздние события (subscription renewal, high-ticket IAP), которых нет в SKAN postback'е, в MMP через server-to-server. Не детерминированный уровень пользователя, но на агрегированном уровне создаёт паттерны. MMP использует это как input для модели.

**Внимание:** Apple не запрещает отправлять server-side user-level сигналы вне SKAN, но если MMP позиционирует это как user-level attribution claim, это может нарушить политику. Использование как input для агрегированного моделирования — в порядке.

## Практический сценарий построения stack'а

Предположим, у вас subscription-based fitness app. iOS составляет 60% install base, цель 100K новых инсталлов в месяц. Ваш attribution stack:

| Слой | Инструмент | Роль | Доверие |
|------|-----------|------|--------|
| SKAN Postback | AppsFlyer | Conversion value + source ID за первые 35 дней | 95% (Apple верифицирует) |
| Modeled Conversions | AppsFlyer Predictive | Вероятностная атрибуция через SKAN + aggregate | 70–80% (с geo-test калибровкой) |
| IDFA Opt-in | AppsFlyer raw data | Детерминированный сегмент 7% | 100% (но низкая репрезентативность) |
| Incrementality | GeoLift (Meta) + Custom holdout | Измерение lift на уровне канала | 90% (статистический, но expensive) |
| LTV Projection | Internal dbt + BigQuery | Cohort curve fit, 90–180 день прогноз | 60–70% (точность модели) |

**Поток:**
1. Ежедневно вытягиваете SKAN postback'и для каждой кампании.
2. Берёте modeled conversions от AppsFlyer, но оставляете 20% доверительный интервал при расчёте campaign-level CPA.
3. Месячно запускаете geo-holdout (например, Meta pause в Испании, продолжение в Португалии). Считаете net lift.
4. Quarterly обновляете cohort LTV curve. Регрессируете корреляцию 35-день SKAN сигнала с 90-день revenue.
5. Budget allocation делаете на основе weighted average SKAN + modeled + incrementality.

Дорого ли это? Да. Но если iOS трафик — 60% и CAC $30+/пользователя, стоимость ошибки атрибуции намного выше.

## Tradeoff'ы и контрргументы

**"Modeled conversions ненадёжны — почему мы их используем?"**

Потому что альтернативы нет. SKAN агрегирован, IDFA охватывает 7%, без сигналов это полный вслепую полёт. Modeled conversions imperfect, но calibrated. С holdout-тестами вы добиваетесь 75–80% accuracy — это намного лучше, чем никакие данные.

**"SKAdNetwork 4 достаточен или ждать 5?"**

SKAdNetwork 5 (iOS 18, announced летом 2024) обещает более гранулярный source ID и более длинное lookback window, но full adoption ещё не наступил. iOS 17 user base 70%+, iOS 18 примерно 30%. Pragmatic подход: строите stack на SKAdNetwork 4 и инкрементально добавляете функции 5.

**"Incrementality-тест для каждой кампании?"**

Нет. Incrementality expensive и slow. Quarterly один тест на канал достаточно (Meta Q1, TikTok Q2, Google Q3). Для малых кампаний полагайтесь на modeled + SKAN blend, для крупных budget moves — тестируйте.

---

iOS атрибуция — это больше не детерминированное дело, а вероятностная, агрегированная и test-driven дисциплина. Правильный маппинг трёхслойной структуры postback'ов SKAdNetwork 4, калибровка modeled conversions через holdout-тесты и прогнозирование post-35-day LTV через cohort projection — вот новый операционный стандарт 2026 года. Если вы построите stack на этих трёх слоях — SKAN + modeled + incrementality — вы выйдите из вслепую и сможете принимать data-informed решения по бюджету на iOS.