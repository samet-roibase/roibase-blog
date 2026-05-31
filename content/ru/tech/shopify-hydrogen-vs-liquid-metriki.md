---
title: "Shopify Hydrogen vs Liquid: решение на основе данных"
description: "TTFB 320ms, время сборки 12 минут, стоимость миграции $18K. Как мы приняли решение о переходе на Hydrogen, опираясь на метрики производительности и анализ затрат."
publishedAt: 2026-05-31
modifiedAt: 2026-05-31
category: tech
i18nKey: tech-002-2026-05
tags: [shopify-hydrogen, headless-commerce, web-performance, liquid-templating, react-server-components]
readingTime: 9
author: Roibase
---

Изменение frontend-стека Shopify-магазина — это всегда риск потери клиентов. В 2024 году мы провели проект миграции с Liquid на Hydrogen для бренда в сегменте fashion. Решение приняли на основе конкретных цифр: разница TTFB 320ms, время сборки 12 минут, прирост скорости разработки на 180%, общая стоимость миграции $18.000. В этой статье рассказываем, как мы собирали метрики, какие trade-off'ы принимали, и как реально выглядели цифры спустя два месяца после запуска.

##液идея о том, что Liquid "достаточно быстрый" — это заблуждение

Шаблоны Liquid действительно рендерятся быстро, но это не то же самое, что TTFB. Сервер Shopify обрабатывает файлы темы при каждом запросе, извлекает данные товаров из БД, рендерит секции. Среднее TTFB было на уровне 480ms (по данным RUM из Search Console). С Hydrogen на той же странице получалось 160ms. Разница в 320ms увеличила mobile conversion rate на 2,1% (A/B тест, 14 дней, сегмент).

Источник разницы TTFB: серверные компоненты Hydrogen работают на edge, из Storefront API мы запрашиваем только необходимые поля (GraphQL projection), процент попаданий в CDN кеш достиг 87%. С Liquid кеш только на уровне страницы, компонент-уровневого кеша нет, каждый запрос идет в backend.

Сравнение кода — рендеринг одной сетки товаров:

**Liquid (snippet):**
```liquid
{% for product in collection.products %}
  <div class="product-card">
    <img src="{{ product.featured_image | img_url: '400x' }}" alt="{{ product.title }}">
    <h3>{{ product.title }}</h3>
    <span>{{ product.price | money }}</span>
  </div>
{% endfor %}
```

**Hydrogen (RSC):**
```tsx
export default async function ProductGrid({ collection }) {
  const {products} = await storefront.query(PRODUCTS_QUERY, {
    variables: {handle: collection}
  });
  
  return products.nodes.map(p => (
    <ProductCard key={p.id} product={p} />
  ));
}
```

Версия с Liquid генерирует 18KB статического HTML (для 20 товаров). Hydrogen — 4.2KB JSON + гидратация 12KB. Объем передаваемых данных сократился на 65%. Кроме того, в Hydrogen товар-карточка — отдельный компонент, поэтому при A/B-тестировании нам не нужно пересобирать весь шаблон.

## Trade-off времени сборки: 12 минут vs 4 секунды

Тему Liquid загружаешь через Shopify CLI — развертывается за 4 секунды. Hydrogen production-сборка запускает webpack + vite + prerender, среднее время 12 минут (на Vercel 8 минут, на self-hosted runner 14 минут). Это замедляет цикл обратной связи для разработчика?

На практике нет — потому что режим разработки Hydrogen с hot reload отражает изменения за 180ms. С Liquid-темой нужно загружать в Shopify + обновлять браузер (в среднем 6 секунд на итерацию). Скорость разработки на Hydrogen выросла на 180% (по метрике внутреннего velocity: время от merge PR до развертывания на staging).

Мы согласились с длительной production-сборкой, потому что в CI/CD pipeline мы запускаем тесты и сборку параллельно. Когда push'ишь в staging-ветку, развертывание занимает 12 минут, но это одно развертывание. С Liquid каждое исправление требовало повторной загрузки. На Hydrogen у нас есть атомарное развертывание с откатом за 30 секунд.

| Метрика | Liquid | Hydrogen | Разница |
|---|---|---|---|
| Цикл разработки (hot reload) | 6s | 180ms | -97% |
| Production-сборка | 4s | 12мин | +18000% |
| Время отката | Вручную (15+ мин) | 30s | -97% |
| Настройка A/B-теста | Дублирование темы | Feature flag | +60% в velocity |

Сборка занимает больше времени, но частота развертывания упала. С Liquid мы делали 8-12 minor development'ов в день (изменение CSS, копирования). На Hydrogen — feature-ветка + тест на staging + одно production-развертывание. Еженедельное количество развертываний снизилось с 42 до 6, но количество ошибок упало на 73%.

## Стоимость миграции: $18K и 6 недель

Расходы на переход с Liquid-темы на Hydrogen:

- **Разработка:** 240 часов × $75/час = $18.000
- **Инфраструктура:** Vercel Pro $20/мес + Shopify Plus (уже был)
- **Буфер риска:** 2 недели параллельной работы (двойная стоимость инфраструктуры)

Расписание 240 часов:
- Преобразование компонентов (120 часов): Liquid snippet'ы в React-компоненты
- Интеграция Storefront API (40 часов): оптимизация GraphQL-запросов
- Тестирование + QA (50 часов): тесты на регрессию, кроссбраузерность
- Оптимизация производительности (30 часов): code splitting, ленивая загрузка, стратегия preload

На время миграции Liquid-тема оставалась в production, Hydrogen тестировался на staging. Корзина и checkout остались native Shopify (Hydrogen их оборачивает). В воронке конверсии не было никаких breaking changes.

**Неожиданные расходы:** оптимизация изображений. С Liquid Shopify CDN автоматически передает WebP. На Hydrogen используем компонент изображений из `@shopify/hydrogen`, но нужна ручная настройка `srcset`. Это заняло 12 дополнительных часов.

ROI от миграции: в первые 3 месяца улучшение Core Web Vitals привело к росту органического трафика на 8,4%, increase в conversion rate 2,1%. Простой расчет: 120K посетителей в месяц × 2,1% lift конверсии × $85 AOV = $21.420 дополнительного дохода. Стоимость миграции окупилась за 45 дней.

## Скорость разработки: TypeScript, переиспользование компонентов, feature flags

Liquid — нетипизированный язык шаблонов. Напишешь `product.price` — не знаешь, упадет ли это в runtime. Hydrogen использует TypeScript + GraphQL Codegen, типы ответов API генерируются автоматически. Это одно сократило количество ошибок на 40% (метрика pre-production QA).

Переиспользование компонентов: в Liquid есть include для snippet'ов, но управления состоянием нет. На Hydrogen используем React context + Remix loader. Пример: предпочтение пользователя (язык, валюта). С Liquid нужно читать cookie, парсить в каждом шаблоне. На Hydrogen читаешь один раз в loader, пишешь в context, все компоненты автоматически имеют доступ.

```tsx
// app/root.tsx - Hydrogen loader
export async function loader({context, request}: LoaderArgs) {
  const customerAccessToken = await context.session.get('customerAccessToken');
  const customer = customerAccessToken 
    ? await getCustomer(context.storefront, customerAccessToken)
    : null;
  
  return json({customer});
}

// Любой компонент
import {useLoaderData} from '@remix-run/react';

export default function Header() {
  const {customer} = useLoaderData();
  return <div>Привет, {customer?.firstName}</div>;
}
```

С Liquid логику `{% if customer %}` повторяли в каждом шаблоне. Количество компонентов с 180 сократилось до 52 (за счет переиспользования).

Система feature flags: раньше для A/B-теста создавали дубликат темы и делили трафик. На Hydrogen environment variable + интеграция LaunchDarkly. В одной сборке можем включить-отключить feature. Время настройки A/B-теста упало с 2 дней до 15 минут.

## Headless Commerce и место Hydrogen

Hydrogen — официальный headless фреймворк Shopify, но только часть headless-архитектуры. В нашем подходе [Headless Commerce](https://www.roibase.com.tr/ru/headless) Hydrogen — слой фронтенда, Storefront API — слой данных, Vercel edge network — слой доставки. Вместе они создают composable stack.

Hydrogen выбрали из-за поддержки React Server Components. С RSC fetch данных происходит на сервере, bundle JavaScript с 60KB сократился до 12KB. Это критично для мобильных — на 3G соединении время парсинга упало на 75% (Lighthouse lab data).

Альтернативы: Next.js Commerce, Remix + custom setup, Vue Storefront. Next.js Commerce сильная интеграция Shopify, но не такая opinioned как Hydrogen, кеш-стратегию пришлось бы писать самим. Remix — generic фреймворк, паттернов e-commerce нет. Hydrogen Shopify-first подход, встроенно поддерживает корзину, checkout, metaobject'ы и другое специфичное для Shopify.

Trade-off: Hydrogen привязывает вас к экосистеме Shopify. Если нужна multi-source commerce (Shopify + кастомная система инвентаря), Remix гибче. Нам хватило single-source Shopify.

## Спустя два месяца — реальная производительность

60 дней после миграции метрики:

- **TTFB:** 160ms в среднем (цель 150ms, 93% попадания)
- **LCP:** 1.2s (с Liquid было 2.8s)
- **CLS:** 0.02 (практически нет layout shift — благодаря SSR)
- **TBT:** 90ms (с Liquid было 420ms)
- **Стоимость сервера:** использование Vercel $47/мес (Shopify hosting $0 — включено в Plus plan)

Неожиданный прирост: благодаря edge-кешированию на Black Friday (4x нормального трафика) ноль проблем с масштабированием. На Liquid-теме сервер Shopify при 200+ одновременных запросах начинал throttling. На Hydrogen edge автоматически масштабируется.

Неожиданная сложность: интеграция third-party script'ов. Google Tag Manager, Meta Pixel загружают client-side JS, это снижает преимущество RSC. Перенесли в web worker с помощью Partytown, но setup занял 8 часов.

Влияние на конверсию: +2,1% в целом, +3,8% в мобильном сегменте. Органический трафик +8,4% (из-за улучшения Core Web Vitals и подъема в ранжировании). Цена за клик в paid-трафике не изменилась, но bounce rate на лендинге упал на 12%.

Hydrogen подойдет не всем. Если каталог маленький (<500 товаров), трафик низкий (<10K в месяц), dev-ресурсы ограничены — Liquid достаточна. Но если масштаб средний-большой, мобильная аудитория, агрессивные performance-цели — trade-off времени сборки Hydrogen приемлем. В нашем case разница TTFB и рост velocity разработки окупили стоимость миграции за 45 дней. Спустя два месяца метрики подтвердили, что Hydrogen — не переинженерное решение, а обоснованный выбор.