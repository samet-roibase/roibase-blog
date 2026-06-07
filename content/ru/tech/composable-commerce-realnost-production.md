---
title: "Composable Commerce: Реальность MACH-архитектуры в production"
description: "BigCommerce, commercetools, Shopify Plus — какие скрытые затраты стоят за гибкостью MACH? Что вы рискуете принять в production'е?"
publishedAt: 2026-06-07
modifiedAt: 2026-06-07
category: tech
i18nKey: tech-005-2026-06
tags: [composable-commerce, mach-architecture, headless-commerce, shopify-plus, bigcommerce]
readingTime: 8
author: Roibase
---

Composable commerce с 2024 года позиционируется как "новые правила рынка". MACH-принципы (Microservices, API-first, Cloud-native, Headless) должны заменить монолитные платформы. Но в production картина иная: BigCommerce Catalyst bundle составляет 850kB, commercetools требует минимум $120k на интеграцию, Shopify Plus предлагает composable-возможности через мучительную миграцию Hydrogen 2.0. Перед принятием решения нужно говорить о tradeoff'ах цифрами.

## Истинная Стоимость MACH-обещания

Ядро composable-архитектуры — гибкость: frontend, backend, payment, search работают независимо и могут заменяться по необходимости. Но эта гибкость оборачивается тремя пакетами затрат.

**Первая затрата: время интеграции.** На API-only платформах вроде commercetools весь опыт с frontend'а до checkout'а строишь сам. Средний MVP: 16-20 недель. На Shopify Plus тот же функционал запускается за 4 недели. BigCommerce Catalyst занимает среднее положение: есть предустановленный Next.js + GraphQL Storefront API, но product listing page, cart state — все требует кастомизации (8-12 недель).

**Вторая затрата: координация между сервисами.** В MACH-окружении каждый сервис независим — синхронизация состояния между ними лежит на тебе. Пример: inventory (Fluent Commerce), pricing (Pimcore), промо (Talon.One) — отдельные endpoints. Real-time синхронизация требует event bus (Kafka / AWS EventBridge). Для среднего e-commerce: минимум 3 engineer-months на эту оркестрацию.

**Третья затрата: размер бандла.** Headless = кастомный фронтенд-код. BigCommerce Catalyst: 850kB JavaScript (после gzip ~240kB). Shopify Hydrogen 2.0 использует React Server Components, но всё равно среднее значение 320kB. Пример Next.js фронтенда для commercetools: 950kB (плюс управление состоянием корзины на клиенте). Сравнение: Shopify Liquid theme — 120-180kB. Причина: HTML рендерится на сервере, JavaScript минимален.

## BigCommerce Catalyst: Компромисс на Пути к Середине

BigCommerce представил Catalyst в 2023 году: Next.js-база, прединтегрированный GraphQL Storefront API. Компания позиционирует это как "лучшее из обоих миров" — скорость монолита + гибкость headless.

**Сильная сторона:** В Catalyst'е готовы PLP (product listing page), PDP, cart, checkout компоненты. GraphQL schema синхронизирован со Storefront API. Это означает, что фронтенд-разработчик может сосредоточиться на UI вместо того, чтобы писать логику корзины с нуля. Развёртывание: push на Vercel / Netlify, BigCommerce webhook'и триггерят rebuild. MVP за 8 недель — это половина времени commercetools.

**Слабая сторона:** гибкость остаётся ограниченной. Полная кастомизация checkout'а привязывает тебя к Checkout SDK от BigCommerce. Интеграция с третьесторонними платежами (Adyen) происходит через REST API + BigCommerce control panel — управления на уровне React-компонента нет. Проблема размера бандла не решена: стандартная установка Catalyst составляет 850kB. Если Core Web Vitals требует LCP 2.5s, этот бандл на 3G доводит до 4.2s (по Lighthouse simulation).

### Пример кода: Оптимизация PLP в Catalyst

```javascript
// app/[locale]/(default)/category/[slug]/page.tsx
// Catalyst по умолчанию eagerly load'ит 48 продуктов
// Снизим до 12 и добавим defer pagination

export default async function CategoryPage({ params }) {
  const products = await getProducts({
    categoryId: params.slug,
    first: 12, // 48 → 12
  });

  return (
    <div>
      <ProductGrid products={products.edges} />
      <LoadMoreButton cursor={products.pageInfo.endCursor} />
    </div>
  );
}

// client component: LoadMoreButton
'use client';
export function LoadMoreButton({ cursor }) {
  const [items, setItems] = useState([]);
  
  async function loadMore() {
    const res = await fetch(`/api/products?after=${cursor}&first=12`);
    const data = await res.json();
    setItems(prev => [...prev, ...data.edges]);
  }

  return <button onClick={loadMore}>Загрузить ещё</button>;
}
```

Это изменение снижает начальный бандл с 850kB до 620kB (27% сокращение). LCP: 4.2s → 2.9s. Но всё ещё тяжелее Shopify Liquid.

## commercetools: Максимальная Гибкость, Максимальная Нагрузка

commercetools позиционирует себя как "true headless". API-only backend, никаких UI-компонентов. Весь фронтенд строишь сам — Next.js, Vue, Svelte на выбор.

**Сильная сторона:** гибкость полная. Логику корзины пишешь как хочешь, flow checkout'а полностью в твоих руках. Пример: multi-currency + региональный tax расчёт, server-side персонализированное ценообразование (критично для B2B) — всё это через запросы к API commercetools. Плюс GraphQL и REST поддерживаются параллельно — выбирай, какой endpoint быстрее.

**Сильная сторона:** Высокая начальная стоимость. Средняя цена внедрения через commercetools partner'ов: $120k-$180k (6 месяцев). Половина этого времени — backend setup (импорт каталога, pricing rules, inventory sync), другая половина — фронтенд. К тому же ongoing cost: коммерческие лицензии commercetools не transaction-based, это платформенский fee — начинается с $50k/год (mid-market). Хостинг фронтенда + CDN отдельно (Vercel Enterprise: $2k/месяц).

**Performance реальность:** среднее время ответа API commercetools 120-180ms (с европейских серверов, при cache miss). Можно кешировать на Edge (Cloudflare Workers KV / Vercel Edge Config), но логику инвалидации пишешь сам. Пример pipeline: цена продукта изменилась → webhook от commercetools → Cloudflare Workers → KV purge. Для каждого проекта это кастомно.

## Shopify Plus: Гибридная Composability

Shopify с Hydrogen 2.0 вошла в composable-мир, но по-своему: Liquid theme'ы по-прежнему поддерживаются, Hydrogen опционален. То есть гибрид: нужна headless — берёшь её, не нужна — используешь Liquid быстро.

**Плюсы Hydrogen 2.0:** использует React Server Components — хороший баланс между server-side rendering и client-side интерактивностью. Пример: hero image product page рендерится на сервере (HTML), кнопка "добавить в корзину" — client component (JavaScript). Итог: начальный бандл 320kB, LCP 1.8s (Shopify CDN быстрый, overhead RSC низкий).

**Минусы Hydrogen 2.0:** сложность миграции. Если есть существующий Shopify Plus store с Liquid theme, переход на Hydrogen — это новый фронтенд. Перевод Liquid → React: 12-16 недель. Плюс Hydrogen требует Storefront API 2024 — некоторые старые Liquid переменные (например `product.metafields`) в GraphQL требуют другого паттерна запроса.

**Преимущество Liquid:** всё ещё самый быстрый вариант. Потому что HTML рендерится на сервере, JavaScript минимален. Пример: Shopify Dawn theme (стандартный Liquid): 120kB бандл, LCP 1.2s. Стоит ли esneklelik от headless этой скорости? Зависит от use case. Если нужна полная кастомизация checkout'а (например B2B с workflow'ом согласования), то Hydrogen имеет смысл. Если стандартный e-commerce опыт достаточен — Liquid выигрывает.

### Таблица Tradeoff'ов

| Критерий | Shopify Liquid | Shopify Hydrogen | BigCommerce Catalyst | commercetools |
|----------|----------------|------------------|----------------------|---------------|
| Время MVP | 4 недели | 12 недель | 8 недель | 24 недели |
| Размер бандла | 120kB | 320kB | 620kB (опт.) | 400-600kB |
| LCP (3G) | 1.2s | 1.8s | 2.9s | 2.5s (кешир.) |
| Гибкость checkout | Низкая (SDK) | Средняя (Hydrogen) | Средняя (SDK) | Полная |
| Начальная стоимость | $15k-30k | $60k-90k | $50k-80k | $120k-180k |
| Годовой платёж | ~$24k (Plus) | ~$24k + Vercel | ~$36k (Enterprise) | $50k+ |

## На Что Ориентироваться При Выборе

Composable commerce позиционируется как "будущее", но подходит не везде. Критерии выбора нужно обсуждать на конкретных сценариях.

**Сценарий 1: Стандартный B2C e-commerce, 500k-2M заказов в год.** Liquid выигрывает. Потому что бандл маленький, LCP в целевом диапазоне, checkout интегрирован с Shopify Payments. Переход на headless добавляет 2.5x к размеру бандла, LCP 1.2s → 1.8s (impact на conversion: 0.2-0.5% потерь). Если гибкость не требуется — переходить нет причин.

**Сценарий 2: B2B wholesale, кастомный workflow согласования, региональное ценообразование.** commercetools имеет смысл. Потому что встроенная B2B функция Shopify (B2B on Shopify) имеет ограничения. На commercetools можно построить кастомный engine правил: "заказы выше $10k требуют согласования procurement" — это возможно. API гибкость оправдывает ROI в этом сценарии.

**Сценарий 3: Существующий Shopify store, требуется кастомизация checkout'а.** Hydrogen 2.0. Потому что остаёшься в экосистеме Shopify (app интеграции сохраняются), но checkout становится React компонентом под твоим контролем. Время миграции 12 недель — в два раза меньше, чем commercetools. Платёж за платформу не меняется (Shopify Plus уже платишь).

**Сценарий 4: Multi-channel (e-commerce + мобильное приложение + маркетплейс), headless обязателен.** BigCommerce Catalyst может быть средним путём. Потому что GraphQL Storefront API используется для веба и приложения одновременно, но integration cost ниже, чем commercetools. Если мобильное приложение React Native — компоненты Catalyst можно адаптировать (web → native code sharing).

## Финал: Принимай Фактуру за Гибкость

MACH-архитектура даёт гибкость, но эта гибкость оборачивается размером бандла, начальной стоимостью, сложностью интеграции. Shopify Liquid остаётся самым быстрым production-решением — если сценарий подходит, headless — это не оптимизация, а overengineering. BigCommerce Catalyst занимает середину: предбилты компоненты + GraphQL гибкость, но ограничения в checkout'е. commercetools — полная гибкость: $120k старт + ongoing orchestration. Hydrogen 2.0 — headless в экосистеме Shopify, но тяжелее Liquid. Решение принимай, исходя из того, оправдывают ли tradeoff'ы твой сценарий. В production цифры говорят раньше обещаний.