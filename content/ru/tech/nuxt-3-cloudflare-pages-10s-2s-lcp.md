---
title: "Nuxt 3 + Cloudflare Pages: от 10 сек LCP к 2 сек"
description: "Техническая анатомия снижения LCP на 80% через self-hosted шрифты, ленивую гидрацию, content-visibility и edge кеширование."
publishedAt: 2026-07-05
modifiedAt: 2026-07-05
category: tech
i18nKey: tech-001-2026-07
tags: [nuxt-3, web-performance, cloudflare-pages, core-web-vitals, lcp]
readingTime: 8
author: Roibase
---

Когда LCP (Largest Contentful Paint) в проекте Nuxt 3 превышает 10 секунд, пользователи закрывают страницу, конверсия падает, PageSpeed Google показывает красный. Это был наш сценарий — e-commerce клиент, Nuxt 3 + Vue 3, развернут на Cloudflare Pages. Первые замеры: LCP 10.2s, TBT 2190ms, CLS 0.18. Спустя четыре недели: LCP 1.9s, TBT 220ms, CLS 0.02. В этой статье показываем, какие конкретные изменения дали какие результаты.

## Диагностика: Три вещи, убивающие LCP

Первый шаг — Chrome DevTools Performance tab + Coverage analysis. Результат:

| Категория | Размер | Время блокировки |
|---|---|---|
| Google Fonts (Poppins, 6 weight) | 142 KB | 1.8s сеть + рендер |
| Гидрация hero section | 89 KB JS | 2.4s блокировка потока |
| Изображения выше сгиба (WebP) | 320 KB | 1.2s декодирование |

LCP элемент — H1 + изображение в hero section. Шрифт грузится долго → текст невидим (FOIT), гидрация тормозит → нет интерактивности, декодирование изображения → сдвиг макета. Три уровня, все три питают LCP напрямую.

Второе открытие: на Cloudflare Pages статические активы кешируются 2 часа по умолчанию, но HTML — нет. Каждый запрос идет на origin, SSR запускается заново. Без edge-кеша baseline LCP начинается выше 400ms.

## Self-hosted шрифты: Убираем 1.8s сетевой задержки

Избавиться от Google Fonts = убрать 1 DNS lookup + 1 handshake + 1 round-trip. Poppins (6 weight) загрузили из пакета `fontsource`:

```bash
npm install @fontsource/poppins
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  css: [
    '@fontsource/poppins/400.css',
    '@fontsource/poppins/500.css',
    '@fontsource/poppins/600.css',
    '@fontsource/poppins/700.css'
  ]
})
```

Файлы шрифтов теперь в бандле под `/_nuxt/`. Проблема в размере: 142 KB → 168 KB (не хватает subset'а). Вытащили вручную:

```bash
pyftsubset Poppins-Regular.ttf \
  --output-file=Poppins-Regular-Latin.woff2 \
  --flavor=woff2 \
  --unicodes=U+0020-007F,U+00A0-00FF
```

Финальный размер: 168 KB → 52 KB. Эффект на LCP: **10.2s → 8.1s** (экономия 2.1s).

Компромисс: время build +18s, размер бандла +52 KB. Приемлемо — задержка пользователя > время разработчика.

## Ленивая гидрация: Освобождаем main thread

В Nuxt 3 гидрация по умолчанию eager — все компоненты становятся interactive при монтировании. В hero section четыре компонента:

- `HeroHeadline.vue` (H1 + подзаголовок)
- `HeroImage.vue` (адаптивное изображение + ленивая загрузка)
- `HeroButton.vue` (CTA с трекингом)
- `HeroStats.vue` (три числовых показателя с анимацией)

При гидрации всех четырех main thread блокируется 2.4s. Но пользователь в первые 800ms видит только заголовок + изображение. С пакетом `nuxt-lazy-hydrate` делаем selective hydration:

```bash
npm install nuxt-lazy-hydrate
```

```vue
<!-- pages/index.vue -->
<template>
  <LazyHydrate when-idle>
    <HeroStats />
  </LazyHydrate>
  
  <LazyHydrate when-visible>
    <HeroButton @click="trackCTA" />
  </LazyHydrate>

  <HeroHeadline /> <!-- eager, критичный контент -->
  <HeroImage />    <!-- eager, LCP элемент -->
</template>
```

`when-idle`: requestIdleCallback, гидрирует когда браузер свободен. `when-visible`: IntersectionObserver, гидрирует при входе в viewport.

Результат: TBT 2190ms → 680ms. Косвенный эффект на LCP: **8.1s → 5.4s** (освобожденный main thread ускоряет весь конвейер рендера).

Компромисс: первое взаимодействие с CTA может иметь задержку 120ms (если гидрация еще не завершена). В A/B тесте влияние на bounce %0.2 — приемлемо.

## content-visibility: CSS против сдвига макета

Ниже hero section еще 6 компонентов (слайдер отзывов, сетка фич, аккордеон FAQ). Они ниже сгиба, но в DOM, и браузер считает их layout. CSS `content-visibility: auto` откладывает рендер:

```css
.below-fold-section {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* предполагаемая высота, для CLS */
}
```

`content-visibility: auto`: браузер не рендирует элементы вне viewport. `contain-intrinsic-size`: задает предполагаемый размер, чтобы позиция скролла оставалась корректной (иначе CLS скачет).

На уровне компонентов через directive:

```typescript
// plugins/content-visibility.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('lazy-render', {
    mounted(el) {
      el.style.contentVisibility = 'auto'
      el.style.containIntrinsicSize = '0 500px'
    }
  })
})
```

```vue
<template>
  <section v-lazy-render class="testimonials">
    <!-- ... -->
  </section>
</template>
```

CLS: 0.18 → 0.04. Косвенный эффект на LCP: **5.4s → 3.8s** (меньше layout thrash, main thread освобождается раньше).

Компромисс: если `contain-intrinsic-size` предсказан неправильно, возможен jump при скролле. Мы измерили реальную высоту каждой секции и hardcode'или её.

## Edge кеширование: Убираем latency origin'а

На Cloudflare Pages SSR запускается на каждый запрос. Average origin latency: 420ms (Европейский edge → origin в США). Стратегия кеширования:

```typescript
// server/middleware/cache.ts
export default defineEventHandler((event) => {
  const url = event.node.req.url
  if (url === '/' || url.startsWith('/kategori/')) {
    event.node.res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
  }
})
```

`s-maxage=300`: на edge кешируется 5 минут. `stale-while-revalidate=600`: после истечения 10 минут старая версия серватся, а в фоне идет переvalidation.

Дополнительная логика в Cloudflare Workers:

```javascript
// functions/[[path]].js
export async function onRequest(context) {
  const cache = caches.default
  const cacheKey = new Request(context.request.url, context.request)
  let response = await cache.match(cacheKey)

  if (!response) {
    response = await context.next()
    context.waitUntil(cache.put(cacheKey, response.clone()))
  }

  return response
}
```

За три дня hit rate вырос до 89%. Origin запросы упали до 11%. Эффект на LCP: **3.8s → 1.9s** (edge latency 12ms вместо origin 420ms).

Компромисс: свежий контент отстает на 5 минут. Для e-commerce приемлемо (изменение цены не критично). Остатки товара подтягиваем клиент-сайд запросом в реальном времени.

## Headless архитектура и дизайн UI/UX

Эти оптимизации возможны были благодаря гибкости [headless commerce](https://www.roibase.com.tr/ru/headless) архитектуры — Shopify Storefront API + Nuxt SSR позволили оптимизировать каждый слой независимо. В монолитных системах даже смена шрифта требует переdeployment, мы обновили только `nuxt.config.ts`.

На фронте [UI/UX дизайн](https://www.roibase.com.tr/ru/ui-ux) сыграл роль в выборе LCP элемента — hero изображение vs заголовок. Заголовок выбрали как LCP, так что оптимизация шрифта дала прямой результат.

## Итоговые числа

| Метрика | Начало | Итог | Изменение |
|---|---|---|---|
| LCP | 10.2s | 1.9s | -81% |
| TBT | 2190ms | 220ms | -90% |
| CLS | 0.18 | 0.02 | -89% |
| FCP | 3.4s | 0.8s | -76% |
| Размер бандла (шрифты) | 142 KB | 52 KB | -63% |
| Cache hit rate | 0% | 89% | — |

PageSpeed Mobile score: 34 → 92. Desktop: 68 → 98.

Влияние на конверсию (4-недельный A/B тест): baseline 2.1% → optimized 2.8% (+33%). Bounce rate: 58% → 41%.

## Решения и компромиссы

Четыре оптимизации, четыре разных компромисса:

1. **Self-hosted шрифты:** build time +18s, поддержка (обновление subset'ов). Выигрыш (2.1s LCP) > затраты.
2. **Ленивая гидрация:** риск задержки первого взаимодействия 120ms. Влияние на bounce минимально (%0.2), приемлемо.
3. **content-visibility:** риск jump при скролле, но `contain-intrinsic-size` держит под контролем. Выигрыш CLS критичен.
4. **Edge кеширование:** свежий контент отстает на 5 минут. Для e-commerce приемлемо, стоки live через client-side.

Бесплатных оптимизаций не бывает. Измеряй, тестируй, принимай компромисс или отклоняй.

Комбинация Nuxt 3 + Cloudflare Pages — идеальная платформа для перформанса: SSR, edge кеширование, модульная архитектура. Но default config дает LCP 10s+. Четыре шага выше — повторяемый рецепт для любого проекта Nuxt. Числа не врут: self-hosted шрифты + ленивая гидрация + content-visibility + edge кеширование = 81% снижение LCP. Откройте Chrome DevTools, найдите LCP элемент, применяйте recipe выше.