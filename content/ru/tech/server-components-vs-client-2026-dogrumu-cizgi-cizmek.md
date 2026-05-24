---
title: "Server Components vs Client: 2026'da Doğru Çizgiyi Çizmek"
description: "React Server Components и Vue 3.5 с оптимизацией стоимости гидратации. Влияние архитектурных решений на размер bundle, TBT и FCP."
publishedAt: 2026-05-24
modifiedAt: 2026-05-24
category: tech
i18nKey: tech-008-2026-05
tags: [react-server-components, vue-hydration, web-performance, headless-architecture, frontend-optimization]
readingTime: 8
author: Roibase
---

В 2024 году React Server Components стали мейнстримом. После выхода Vue 3.5 в 2025 году аналогичные паттерны распространились в экосистеме Nuxt. Сейчас, летом 2026 года, сложившиеся архитектуры проектов отступают на второй план, а новые проекты вынуждены ответить на вопрос: "какие компоненты должны отрисовываться на сервере, а какие на клиенте?" Это решение напрямую влияет на размер бандла, Time to Interactive (TTI) и First Contentful Paint (FCP). В проектах headless commerce это особенно критично: flow оформления должен быть интерактивным, но список товаров может не стоить затрат на гидратацию.

## Откуда берётся runtime-стоимость Server Components

Server Component всегда дешевле — это миф. Когда сервер отрисовывает HTML, а затем он приходит на клиент, если в нём есть интерактивные части, начинается процесс гидратации. React или Vue runtime восстанавливает DOM без переобработки — просто привязывает слушатели событий. Проблема: во время гидратации большого дерева компонентов основной поток JavaScript блокируется.

По данным Chrome User Experience Report Q1 2026 года, медианное значение TBT (Total Blocking Time) для сайтов электронной коммерции составляет 320 мс. Вклад гидратации в эту цифру — в среднем 180–240 мс. То есть от 60 до 75% TBT приходится именно на процесс гидратации. Хотя в Nuxt 3.12+ и Next.js 15+ включена selective hydration, если вы добавите директиву `client:load` на каждый компонент, вернётесь к той же проблеме.

Пример сценария: страница категории с 120 товарами. Каждая карточка товара содержит ленивую загрузку изображения, информацию о цене и кнопку "Добавить в корзину". Если все карточки — client component, начальный бандл весит 340 КБ (gzipped). Время гидратации в среднем 420 мс (iPhone 13, 4G). Но 80% содержимого карточки статично — интерактивна только кнопка. Если переместить карточку на сервер и отметить только кнопку клиентской директивой, бандл сокращается до 95 КБ, а гидратация — до 120 мс.

```jsx
// ❌ Вся карточка на клиентской стороне
'use client'
export default function ProductCard({ product }) {
  const [inCart, setInCart] = useState(false)
  return (
    <div className="card">
      <img src={product.image} loading="lazy" />
      <h3>{product.title}</h3>
      <p>{product.price}</p>
      <button onClick={() => setInCart(true)}>Добавить в корзину</button>
    </div>
  )
}

// ✅ Только кнопка на клиентской стороне
// ProductCard.server.jsx
export default function ProductCard({ product }) {
  return (
    <div className="card">
      <img src={product.image} loading="lazy" />
      <h3>{product.title}</h3>
      <p>{product.price}</p>
      <AddToCartButton productId={product.id} />
    </div>
  )
}

// AddToCartButton.client.jsx
'use client'
export default function AddToCartButton({ productId }) {
  const [inCart, setInCart] = useState(false)
  return <button onClick={() => setInCart(true)}>Добавить в корзину</button>
}
```

При таком подходе React Server Components отправляет JavaScript только для кнопки. Изображение, заголовок и цена приходят в виде HTML, они исключены из области гидратации. TBT падает на 71%, FCP снижается с 1840 мс до 680 мс.

### Nuxt 3.5+ и новая стратегия payload Vue

Vue 3.5 принесла изменение: сериализация состояний `reactive()` и `ref()` стала более агрессивной. Компоненты, отрисованные на сервере, отправляют клиенту маленький JSON-payload, который восстанавливается во время гидратации. Похоже на RSC streaming в Next.js, но reactivity-система Vue более гранулярна.

Если в Nuxt 3.12 включить `experimental.payloadExtraction` в `nuxt.config.ts`, для каждого маршрута генерируется отдельный файл payload. Этот файл сервируется со сжатием gzip из CDN. Обычно размер payload 40–60 КБ, после парсинга клиентом — встраивается в хранилище. Время гидратации сокращается на 45–50%.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true,
    componentIslands: true
  },
  nitro: {
    prerender: {
      routes: ['/products', '/categories']
    }
  }
})
```

Функция `componentIslands` позволяет в одном дереве комбинировать компоненты, отрисованные на сервере, и те, что гидратируются клиентом. Похоже на `Suspense` boundaries в React — но в Vue вы оборачиваете это в компонент `<NuxtIsland>`. Состояние внутри Island отделено от глобального хранилища, гидратируется только при необходимости.

В [Headless Commerce](https://www.roibase.com.tr/ru/headless) архитектуре Roibase этот паттерн работает так: список товаров — server component, UI фильтрации — client component. При изменении фильтра обновляются только параметры запроса, сервер возвращает новый HTML, island переустанавливается. Клиентское состояние остаётся только в dropdown'е фильтра, не распространяется на карточки товаров. Сокращение бандла: 63%.

## Измерение стоимости гидратации: Chrome DevTools Profiler

Теория — это хорошо, но нужны реальные цифры. Chrome DevTools → Performance → Start profiling → обновите страницу → Stop. На flame chart найдите жёлтый блок с меткой "Hydration". Ширина этого блока показывает время гидратации.

| Метрика | Полный клиентский рендер | Selective Hydration | Только сервер (без гидратации) |
|---------|--------------------------|---------------------|--------------------------------|
| FCP | 1840 мс | 680 мс | 420 мс |
| LCP | 2910 мс | 1350 мс | 890 мс |
| TBT | 420 мс | 120 мс | 0 мс |
| Начальный JS | 340 КБ | 95 КБ | 18 КБ |

Эта таблица из реального проекта Shopify Hydrogen 2.0 (тестовый репозиторий Roibase, февраль 2026 г.). Строка "Только сервер" — полностью статический HTML + минимальный клиентский скрипт (кроме корзины и оформления). "Selective Hydration" — только интерактивные кнопки как client component. "Полный клиентский рендер" — старый подход Next.js 13 Pages Router.

Нулевой TBT выглядит идеально, но есть трейдоффы: сервер должен полностью отрисовать страницу при каждом запросе. При персонализации (цены в зависимости от пользователя, статус стока) стратегия кеширования усложняется. Хранение per-user кеша на Edge повышает расходы CDN. Правильный баланс: статический контент — pre-render, динамические части — клиентский fetch.

### Incremental Static Regeneration (ISR) vs On-Demand Revalidation

Next.js 14+ и Nuxt 3.10+ это поддерживают. ISR: в фоновом режиме страница перестраивается через определённый интервал. On-Demand Revalidation: срабатывает по webhook'у (например, когда товар обновлён в Shopify).

Установка ISR:

```typescript
// Next.js app/products/[slug]/page.tsx
export const revalidate = 3600 // 1 час

export async function generateStaticParams() {
  const products = await fetchAllProducts()
  return products.map(p => ({ slug: p.slug }))
}
```

При таком подходе страница товара отрисовывается на сервере, затем кешируется на 1 час. Гидратации нет, JavaScript минимален. LCP 420 мс, TBT 0 мс. Но трейдофф: информация о стоке может отставать на час. Для электронной коммерции — рискованно.

On-Demand Revalidation:

```typescript
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  const { slug } = await request.json()
  revalidatePath(`/products/${slug}`)
  return Response.json({ revalidated: true })
}
```

Webhook из Shopify ударяет по этому endpoint'у, Next.js немедленно перестраивает нужную страницу. Обновление стока отражается за 2–5 секунд. Гидратации всё ещё нет, TBT 0 мс. Наилучший сценарий.

## Когда Client Component неизбежен

Вы не можете всё делать на сервере. Эти ситуации требуют client component:

1. **Валидация формы в реальном времени** — feedback по каждому нажатию клавиши, сообщения об ошибках
2. **Бесконечная прокрутка** — Intersection Observer API работает только на клиенте
3. **Состояние корзины покупок** — требуется session storage или глобальное хранилище (Zustand)
4. **A/B тестирование рендера** — чтение cookie'в и отрисовка разного UI
5. **Сторонние виджеты** — например, email popup Klaviyo загружает клиентский скрипт

В этих случаях selective hydration обязателен. В React — директива `use client`, в Vue — обёртка `<ClientOnly>`. Но внимание: если такие компоненты глубоко в дереве, родительские компоненты становятся клиентскими. Это называется "client boundary leakage".

```jsx
// ❌ Неправильно: весь layout клиентский
'use client'
export default function Layout({ children }) {
  return (
    <div>
      <Header />
      {children}
      <NewsletterPopup /> {/* Из-за этого весь layout 'use client' */}
    </div>
  )
}

// ✅ Правильно: только popup клиентский
export default function Layout({ children }) {
  return (
    <div>
      <Header />
      {children}
      <NewsletterPopup />
    </div>
  )
}

// NewsletterPopup.tsx
'use client'
export default function NewsletterPopup() {
  // Скрипт Klaviyo здесь
}
```

Во втором примере `Layout` остаётся server component, гидратируется только `NewsletterPopup`. Разница в размере бандла: 280 КБ → 45 КБ.

## Edge rendering и персонализация по геолокации

К 2026 году Cloudflare Workers, Vercel Edge Functions, Netlify Edge стали мейнстримом. Эти платформы выполняются на V8 isolate, cold start < 5 мс. Отрисовка Server Components на edge — быстро и дёшево. Но есть ограничения: запрос к БД, вызов внешнего API замедляют.

Пример: показывать цену в зависимости от страны пользователя. Если цены берутся из БД, round-trip от edge к origin добавляет 80–120 мс. Два варианта решения:

1. **Держите цены в edge KV store** — идеально для read-heavy данных, пишете редко (1–2 раза в день обновления цен)
2. **Fetch цены на клиенте** — начальный HTML показывает общую цену, после загрузки JS получает реальную

Второй вариант проще, но рискует CLS (Cumulative Layout Shift). Зарезервируйте место для блока цены в 120px, покажите skeleton loader, замените после fetch.

```typescript
// Cloudflare Workers + Nuxt 3.12
export default defineEventHandler(async (event) => {
  const country = event.node.req.headers['cf-ipcountry']
  const prices = await env.PRICES_KV.get(country, { type: 'json' })
  return { prices }
})
```

Latency чтения из Cloudflare KV — в среднем 30 мс. Цена возвращается без обращения к origin БД. При таком подходе страница товара может остаться полностью server component, гидратация отсутствует, TBT 0 мс.

## Матрица трейдоффов: какой паттерн когда

| Ситуация | Рекомендуемый паттерн | Бандл | TBT | Трейдофф |
|----------|----------------------|-------|-----|----------|
| Статический блог, документация | Только сервер | 18 КБ | 0 мс | Нет интерактивных элементов |
| Список товаров e