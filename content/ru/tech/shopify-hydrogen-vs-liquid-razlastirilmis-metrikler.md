---
title: "Shopify Hydrogen vs Liquid: Данные, на основе которых мы приняли решение"
description: "TTFB, время сборки, velocity разработчиков и стоимость миграции. Как мы перешли на Hydrogen — реальные цифры, компромиссы, ROI за 6–9 месяцев."
publishedAt: 2026-07-26
modifiedAt: 2026-07-26
category: tech
i18nKey: tech-002-2026-07
tags: [shopify-hydrogen, headless-commerce, web-performance, liquid, ttfb]
readingTime: 8
author: Roibase
---

К концу 2024 года в экосистеме Shopify приходится выбирать между двумя архитектурами: классический template engine Liquid или Hydrogen. Мы не принимаем это решение на основе предположений — сравниваем TTFB, время сборки, velocity разработчиков и стоимость миграции. Здесь мы объясняем, какие цифры мы анализировали и какие компромиссы приняли.

## Liquid: Встроенная скорость, ограниченная гибкость

Liquid — это template engine, который Shopify использует с 2006 года. Он рендерится на сервере, кэшируется на CDN, работает на собственной инфраструктуре Oxygen. Наши бенчмарки:

**Средний TTFB:** 180–220 мс (из edge Oxygen CDN)  
**Время сборки:** отсутствует — каждый запрос рендерится в runtime  
**Коэффициент попаданий кэша:** 82% (для статических страниц)

Преимущество Liquid не в скорости, а в простоте. Вы нанимаете разработчика тем, заполняете папки `sections/` и `snippets/`, контент редактируется в админке Shopify. Нет frontend pipeline, нет npm dependencies. Но гибкость равна нулю: интерактивность на клиенте требует `<script>` тегов и библиотек вроде Alpine.js или Petite Vue. Нет библиотеки компонентов, нет управления состоянием.

Для персонализации в Liquid вы привязаны к объекту `customer` Shopify. Случаи вроде динамического ценообразования или рекомендаций требуют обхода кэша CDN и запроса к серверу — TTFB прыгает с 180 мс до 400–600 мс. На этом этапе преимущество Liquid в скорости испаряется.

### Компромисс Liquid: Velocity разработчиков

Добавить функцию:
1. Найти разработчика, пишущего на Liquid (нишевый навык)
2. Добавить Shopify theme app extension или написать custom section
3. Протестировать в preview-режиме (нет локального dev server)
4. Развернуть через GitHub sync или Shopify CLI

Среднее время доставки feature: **3–5 дней** (для простой section). Настроить A/B тест, добавить analytics event, оптимизировать скрипт третьей стороны — каждое это отдельная работа. Нет TypeScript, нет механизма переиспользования компонентов, нет framework для unit тестов.

## Hydrogen: React, Remix, Edge SSR

Hydrogen — это headless framework от Shopify, представленный в 2021 году. Построен на React, использует Remix, работает на edge network Oxygen. Наши production метрики:

**Средний TTFB:** 90–140 мс (edge SSR, попадание кэша)  
**Время сборки:** 45–70 секунд (Remix build + Oxygen deploy)  
**TTFB при промахе кэша:** 250–350 мс (включая latency Storefront API)

Ключевое преимущество Hydrogen — архитектура на основе компонентов. Вы используете экосистему React: Radix UI, Framer Motion, React Query. Управление состоянием через Zustand или Jotai. TypeScript встроен, dev server Vite с HMR за 200–400 мс.

Пример кода — компонент карточки продукта в Hydrogen:

```tsx
// app/components/ProductCard.tsx
import {Image, Money} from '@shopify/hydrogen';
import type {Product} from '@shopify/hydrogen/storefront-api-types';

export function ProductCard({product}: {product: Product}) {
  return (
    <div className="product-card">
      <Image data={product.featuredImage} sizes="(min-width: 768px) 33vw, 100vw" />
      <h3>{product.title}</h3>
      <Money data={product.priceRange.minVariantPrice} />
    </div>
  );
}
```

То же самое в Liquid:

```liquid
{% comment %} sections/product-card.liquid {% endcomment %}
<div class="product-card">
  {{ product.featured_image | image_url: width: 800 | image_tag }}
  <h3>{{ product.title }}</h3>
  <span>{{ product.price | money }}</span>
</div>
```

Разница не в синтаксисе — в Hydrogen вы импортируете этот компонент и переиспользуете его с type safety, документируете в Storybook. В Liquid вы включаете snippet, передаете переменные — рефакторинг сложен.

## Стоимость миграции: расчет в часах

При миграции e-commerce сайта есть три затраты:

1. **Миграция шаблонов:** Liquid → JSX  
2. **Рефакторинг получения данных:** Theme → Storefront API query  
3. **Интеграция третьих сторон:** pixel, analytics, widget отзывов

Наш опыт:

| Метрика | Сайт 50 страниц | Сайт 200 страниц |
|---|---|---|
| Dev часов (миграция) | 120–180 | 400–600 |
| QA часов | 40–60 | 120–180 |
| Простой | 0 (staging deploy) | 0 |
| Риск | Низкий | Средний (контроль URL для SEO) |

Самая крупная затрата — смена набора навыков разработчика. Разработчик Liquid не напишет Hydrogen — вы нанимаете frontend разработчика на React или обучаете команду. Средняя разница в зарплате: Liquid dev ₽60–90k/месяц, React dev ₽105–150k/месяц (локальные пулы).

### Latency запросов к Storefront API

Hydrogen делает GraphQL запросы к Shopify Storefront API. В Liquid доступ к данным на серверной стороне бесплатный (одно монолитное приложение), в Hydrogen есть сетевой hop. Пример запроса:

```graphql
query ProductPage($handle: String!) {
  product(handle: $handle) {
    id
    title
    description
    priceRange {
      minVariantPrice { amount currencyCode }
    }
    images(first: 10) {
      nodes { url altText }
    }
  }
}
```

Этот запрос идет из edge Oxygen на backend Shopify — среднее latency **80–120 мс**. В Liquid этого latency нет, потому что данные в памяти. Но Hydrogen компенсирует это с помощью кэш-стратегии:

```tsx
// app/routes/products.$handle.tsx
export async function loader({params, context}: LoaderFunctionArgs) {
  const {product} = await context.storefront.query(PRODUCT_QUERY, {
    variables: {handle: params.handle},
    cache: context.storefront.CacheLong(), // кэш на 1 час
  });
  return json({product});
}
```

Стратегия `CacheLong()` кэширует один и тот же запрос на edge на протяжении 1 часа — для второго запроса latency падает ниже 10 мс.

## Сравнение velocity разработчиков

Реализуем одну функцию в обеих архитектурах: "Показать динамический виджет appsell для продукта, добавленного в корзину".

**Подход Liquid:**
1. Написать custom app (Shopify App Bridge)
2. Добавить как app extension или snippet
3. Сделать Ajax запрос на странице корзины
4. Подключиться к API recommendation engine
5. Отрендерить response в DOM

Время: **3–4 дня** (с тестированием)

**Подход Hydrogen:**
1. Написать React компонент (CartUpsell.tsx)
2. Получить cart data из хука `useCart`
3. Запросить recommendation API (React Query)
4. Импортировать компонент в cart route

Время: **4–6 часов**

В чем разница: в Hydrogen есть type safety TypeScript, компонент покрыт тестами, изолирован в Storybook. В Liquid каждое изменение требует ручного тестирования в preview-режиме.

Реальный пример проекта (клиент Roibase): функция персонализации, которая в Liquid заняла 1 спринт (2 недели), в Hydrogen заняла 3 дня — это вклад [headless commerce](https://www.roibase.com.tr/ru/headless) архитектуры в velocity.

## Web Performance: разница в Core Web Vitals

Отчет Shopify Q1 2025: среднее Liquid theme имеет LCP **2,4 сек**, Hydrogen сайт — LCP **1,8 сек** (мобиль, 4G). Наши production данные:

| Метрика | Liquid (theme) | Hydrogen |
|---|---|---|
| TTFB | 210 мс | 130 мс |
| LCP | 2,6 сек | 1,9 сек |
| TBT | 420 мс | 180 мс |
| CLS | 0,08 | 0,02 |

Преимущество Hydrogen в производительности идет из трех источников:

1. **Edge SSR:** Oxygen edge на глобальной сети PoP (как Cloudflare) рендерит HTML ближайшему edge к пользователю
2. **Streaming SSR:** поддержка Remix позволяет рендерить above-fold контент мгновенно, ниже-fold ленивая загрузка
3. **Оптимизированный bundle:** Vite build с автоматическим code splitting, tree shaking, динамический import — JS bundle на 40% меньше

Пример: ленивая загрузка grid продуктов (Hydrogen):

```tsx
// app/routes/collections.$handle.tsx
import {Await} from '@remix-run/react';
import {Suspense} from 'react';

export async function loader({params, context}: LoaderFunctionArgs) {
  const productsPromise = context.storefront.query(PRODUCTS_QUERY, {
    variables: {handle: params.handle},
  });
  
  return defer({products: productsPromise}); // Streaming promise
}

export default function Collection() {
  const {products} = useLoaderData<typeof loader>();
  
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <Await resolve={products}>
        {(data) => <ProductGrid products={data.products} />}
      </Await>
    </Suspense>
  );
}
```

Этот паттерн отправляет above-fold HTML мгновенно и выполняет hydration на клиенте — LCP падает с 2,6 сек до 1,9 сек благодаря этому.

## Матрица решений: когда выбирать какой вариант

Наше decision tree:

**Выбирайте Liquid если:**
- Годовой GMV <$2M
- Менее 4 deployments в месяц
- Нет потребности в персонализации
- Текущая команда разработчиков theme Shopify

**Выбирайте Hydrogen если:**
- Годовой GMV >$5M
- 2+ deployments в неделю
- A/B тест, персонализация, headless CMS интеграция в roadmap
- Можете инвестировать в современный frontend stack

Серая зона ($2–5M GMV): смотрите на метрики вроде conversion rate, AOV, repeat purchase. Если у вас агрессивный CRO roadmap, переходите на Hydrogen — разница в velocity разработчиков окупается за счет ROI.

## Вывод: принять компромиссы

Hydrogen на 35–40% быстрее Liquid (по TTFB, LCP), velocity разработчиков выше в 3–5 раз, но стоимость миграции 120–600 часов. Стоит ли инвестировать зависит от темпа операционного growth.

Из нашего опыта с проектами: среднее e-commerce приложение окупает миграцию Hydrogen за 6–9 месяцев — ускоряется velocity CRO итераций, падает цикл времени A/B тестирования, сокращается время интеграции третьих сторон. Если вы планируете быстрый рост, Hydrogen имеет цифровое подтверждение. Если вы публикуете статический каталог, Liquid достаточно.