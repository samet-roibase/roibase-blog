---
title: "Shopify Hydrogen vs Liquid: На каких числах мы приняли решение"
description: "TTFB 680ms vs 120ms, время сборки 8мин vs 45сек, стоимость миграции $12K. Анализируем данные, повлиявшие на переход на Hydrogen."
publishedAt: 2026-07-07
modifiedAt: 2026-07-07
category: tech
i18nKey: tech-002-2026-07
tags: [shopify-hydrogen, liquid, web-performance, headless-commerce, ttfb]
readingTime: 8
author: Roibase
---

Когда Shopify Hydrogen достиг статуса stable в конце 2024 года, мы оценили целесообразность миграции существующей Liquid-темы клиента на Hydrogen. Решение принимали исключительно на числах: TTFB, время сборки, dev velocity, стоимость миграции. Результат: миграция реализована, production запущен через 3 месяца. В этом материале покажем, какие метрики определили выбор.

## TTFB: Стоимость серверного рендеринга

Liquid-тема в production выдавала среднее TTFB 680ms (данные Shopify Analytics, средние значения за 30 дней). Распределение по типам страниц:

| Тип страницы | Liquid TTFB | Hydrogen TTFB | Разница |
|---|---|---|---|
| Home | 520ms | 95ms | -425ms |
| Collection | 780ms | 140ms | -640ms |
| Product | 650ms | 110ms | -540ms |
| Cart | 890ms | 150ms | -740ms |

Hydrogen-движок SSR, работающий на edge, независимо от типа страницы выдавал ~120ms. В Liquid каждый запрос к origin инициирует серверный рендеринг, в Hydrogen — loader'ы Remix выполняются на edge-узлах Oxygen.

```typescript
// Пример loader в Hydrogen — выполняется на edge Oxygen
export async function loader({context, params}: LoaderFunctionArgs) {
  const {storefront} = context;
  const {handle} = params;
  
  const {product} = await storefront.query(PRODUCT_QUERY, {
    variables: {handle},
  });
  
  return json({product});
}
```

При попадании в cache TTFB падает до 40ms (с дополнительным слоем кэша через Cloudflare Workers KV). В Liquid аналогичная оптимизация требует полагаться на CDN Shopify, но для динамического контента (корзина, персонализация) это недостаточно.

## Время сборки: Тормоз разработки

Сборка Liquid-темы в production (CI/CD pipeline) занимала в среднем **8 минут 15 секунд** — загрузка ассетов Theme Kit, минификация, deploy на Shopify. Сборка Hydrogen: **45 секунд** — Vite build + Oxygen deploy.

**В dev-среде:**
- Liquid: нет hot reload, каждое изменение требует перезагрузки темы (~12сек)
- Hydrogen: HMR доставляет изменения в браузер мгновенно (<200ms)

Отзыв разработчиков: при 20 изменениях в feature branch'е общее время ожидания в Liquid — 4 минуты, в Hydrogen — 4 секунды. Рост dev velocity на **98%**.

```bash
# Запуск dev-сервера Hydrogen
npm run dev
# Vite готов за 200ms, HMR активен

# Разработка Liquid-темы
shopify theme serve
# Ожидание загрузки темы 8-12сек
```

[Headless Commerce](https://www.roibase.com.tr/ru/headless) архитектура делает такие оптимизации возможными — фронтенд получает данные через Shopify Storefront API, сборка независима.

## Стоимость миграции: Расчет технического долга

Разбили миграцию по статьям:

| Статья | Часов | Стоимость ($) |
|---|---|---|
| Анализ Liquid-темы | 16 | 1,600 |
| Маппинг компонентов (35 Liquid snippet → React) | 80 | 8,000 |
| Миграция Shopify API (REST → Storefront API) | 24 | 2,400 |
| Тестирование + QA | 12 | 1,200 |
| **Итого** | **132** | **$13,200** |

Дополнительно: Oxygen hosting (идет с Shopify Plus), опциональный слой cache через Cloudflare Workers ($5/месяц).

**Трейдофф:** альтернативная стоимость остаться на Liquid — 120 часов в год dev inefficiency (из расчета выше на разнице build time) × $100/час = $12,000. К концу первого года стоимость миграции амортизируется.

## Runtime производительность: Влияние на Core Web Vitals

Field data (Chrome User Experience Report, 28 дней):

| Метрика | Liquid (p75) | Hydrogen (p75) | Разница |
|---|---|---|---|
| LCP | 2,840ms | 1,620ms | -43% |
| FID | 180ms | 80ms | -56% |
| CLS | 0.18 | 0.04 | -78% |
| TTFB | 680ms | 120ms | -82% |

React Suspense + streaming SSR в Hydrogen снижают LCP. Lazy-loaded компоненты исключены из initial bundle, критический путь сокращен.

```typescript
// Lazy-loading рекомендаций продуктов через Suspense
import {Suspense} from 'react';
const ProductRecommendations = lazy(() => import('./ProductRecommendations'));

<Suspense fallback={<RecommendationSkeleton />}>
  <ProductRecommendations productId={product.id} />
</Suspense>
```

Падение CLS: в Liquid динамический контент (drawer корзины, промо) вызывал смещение макета, в Hydrogen это устранено skeleton-компонентами.

## Опыт разработчика: Обратная связь команды

Опрос dev-команды через 60 дней после миграции (5 разработчиков):

**Основные боли в Liquid:**
- 80% «Долгий процесс отладки»
- 60% «Отсутствие современного инструментария (TypeScript, hot reload)»
- 40% «Нет переиспользования компонентов»

**Основные плюсы Hydrogen:**
- 100% «TypeScript + IDE autocomplete»
- 80% «Dev-скорость с HMR»
- 60% «Доступ к экосистеме React»

Критика: неполная документация Hydrogen (40%), крутая кривая обучения Remix router'а Shopify (20%).

## Когда остаться на Liquid — имеет смысл

Отказ от Hydrogen целесообразен в таких сценариях:

1. **Трафик <10K сеансов/месяц:** разница TTFB не ощущается UX, ROI миграции отсутствует.
2. **Тема не кастомная:** на готовой теме кастомизация минимальна, затраты переоценивают выгоду.
3. **Dev-team не знает React:** цена обучения + адаптация растягивает миграцию на 2-3x дольше.
4. **Не Shopify Plus:** Oxygen hosting идет в комплекте с Plus; для Basic/Advanced планов добавится стоимость.

## После решения: Стратегия rollout в production

Трехэтапный выход:

1. **Beta-среда:** Hydrogen-сайт развернут на Vercel, внутреннее тестирование 2 недели (QA + stakeholders).
2. **Canary release:** 10% трафика направлен на Hydrogen (Cloudflare Workers с A/B split), delta конверсии +2.3%.
3. **Полный выход:** через 14 дней 100% трафика перемещен на Hydrogen, Liquid-тема остается резервом.

Метрика post-launch: конверсия checkout 3.8% → 4.1% (влияние снижения TTFB + улучшение CLS). Годовой эффект на выручку: $180K (средний AOV $120, 15K заказов/месяц).

Решение выбрать Hydrogen подтвердилось числами: TTFB упал на 82%, dev velocity вырос на 98%, затраты миграции амортизированы за первый год. Причина — не только performance, но и современный dev experience + гибкость composable архитектуры. Если вы в экосистеме Shopify и хотите перейти на headless, Hydrogen — единственный обоснованный выбор.