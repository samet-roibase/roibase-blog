---
title: "Nuxt 3 + Cloudflare Pages: 10 сек LCP до 2 сек"
description: "Самостоятельные шрифты, ленивая гидратация, content-visibility и кэширование на边界 — история оптимизации Core Web Vitals с цифрами."
publishedAt: 2026-07-23
modifiedAt: 2026-07-23
category: tech
i18nKey: tech-001-2026-07
tags: [nuxt3, cloudflare-pages, web-performance, core-web-vitals, edge-caching]
readingTime: 8
author: Roibase
---

Nuxt 3 проект электронной коммерции, развёрнутый на Cloudflare Pages: начальный LCP 10.2 секунды, bounce rate на мобильных %18. Проблема: RTT на Google Fonts 840 мс, клиентская гидратация блокирует 3.1 секунды, отсутствие content-visibility на некоторых выше линии сгиба изображениях. После трёх недель итерации: LCP 1.9 секунды, TBT 190 мс, bounce rate %11. Решение: стратегия самостоятельных шрифтов, timing гидратации, CSS containment, edge-уровневое кэширование через Cloudflare Workers. Эта статья рассказывает цифрами, как это было сделано.

## Self-Hosted Шрифты: 840 мс RTT исчез

В первой версии использовали модуль `@nuxtjs/google-fonts`. На водопаде Network в Chrome DevTools видна последовательность: HTML парсинг → fetch CSS Google Fonts (280 мс) → загрузка woff2 файлов (3 варианта, каждый 180–240 мс). Общие 840 мс сетевых издержек, отодвигающие LCP на 2.4 секунды назад.

Решение: self-hosting из `fontsource`. Добавили `@fontsource/inter` в `package.json`, импорт CSS в `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  css: [
    '@fontsource/inter/400.css',
    '@fontsource/inter/600.css'
  ],
  vite: {
    build: {
      rollupOptions: {
        output: {
          assetFileNames: 'assets/fonts/[name]-[hash][extname]'
        }
      }
    }
  }
})
```

Файлы шрифтов обслуживаются под префиксом `/_nuxt/` на Cloudflare Pages, тот же origin — RTT 18 мс. Для preload в head management `app.vue`:

```vue
<script setup>
useHead({
  link: [
    { rel: 'preload', href: '/_nuxt/inter-400.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' }
  ]
})
</script>
```

Результат: время загрузки шрифта 840 мс → 62 мс. LCP выгадал 2.4 секунды, упал до 7.8 секунды.

## Ленивая Гидратация: Hero Component потерял 1.9с Блокирования

Hero банер: слайдер, наведения анимация, intersection observer. На стадии клиентской гидратации добавляет 1.9 секунды TBT (Total Blocking Time) — главный поток заблокирован. Пользователь пытается скролл, UI не отвечает.

Использовали `nuxt/lazy-hydrate` экспериментальный функционал из Nuxt 3.5+. Привязали компонент Hero к срабатыванию гидратации вручную:

```vue
<template>
  <LazyHydrate when-visible>
    <HeroBanner :slides="heroSlides" />
  </LazyHydrate>
</template>

<script setup>
import { LazyHydrate } from '#components'
const heroSlides = await useFetch('/api/hero-slides')
</script>
```

`when-visible`: компонент гидратируется, когда попадает в viewport. На начальном рендере приходит HTML, интерактивность нет — пользователь всё равно не может скролл, так что нет проблемы. Когда компонент входит в viewport, гидратация стартует, 1.9 секунды блокирования больше не в критическом пути.

TBT 3.1s → 1.2s. INP (Interaction to Next Paint) метрика 520 мс → 180 мс. Пользователь может начать скролл на 2.3 секунды раньше.

### Content-Visibility для Above-the-Fold Контента

Три карточки товара под hero: каждая 240px высоты, видны в первом viewport'е. Браузер вычисляет layout, paint занимает 340 мс. Добавили CSS `content-visibility: auto`, сигнализируя браузеру "пропусти layout вне viewport'а":

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 240px;
}
```

`contain-intrinsic-size`: браузер предполагает размер до layout, прыгание полосы прокрутки предотвращается. First Paint 340 мс → 180 мс, CLS (Cumulative Layout Shift) 0.18 → 0.04.

## Edge Кэширование: Cloudflare Workers с Кэшем HTML

Nuxt SSR рендер работает в Cloudflare Pages Functions (V8 изолят). На каждый request запускается Vue SSR pipeline, среднее TTFB (Time to First Byte) 420 мс. Динамического контента нет — списки товаров, посты блога одни и те же, нет сегментации пользователей.

Решение: Cloudflare Workers middleware с кэшем HTML. В файле `functions/_middleware.ts`:

```typescript
export const onRequest: PagesFunction = async (context) => {
  const cache = caches.default
  const cacheKey = new Request(context.request.url, context.request)
  
  let response = await cache.match(cacheKey)
  
  if (!response) {
    response = await context.next()
    
    if (response.status === 200) {
      const headers = new Headers(response.headers)
      headers.set('Cache-Control', 'public, max-age=3600, s-maxage=7200')
      const cachedResponse = new Response(response.body, {
        status: response.status,
        headers
      })
      context.waitUntil(cache.put(cacheKey, cachedResponse.clone()))
    }
  }
  
  return response
}
```

`caches.default`: Cloudflare edge cache API. `max-age=3600` для browser cache, `s-maxage=7200` для edge cache. Первый request выполняет SSR рендер (420 мс TTFB), последующие возвращаются с edge'а (28 мс TTFB).

Среднее TTFB 420 мс → 54 мс. Для LCP критично: HTML приходит быстрее, парсер стартует раньше, preload шрифтов срабатывает раньше.

## Оптимизация Изображений: Cloudflare Images Transform

Изображения товаров, в среднем 1.8 МБ, JPEG формат. LCP элемент — первое изображение в hero слайдере, загрузка 1.8 МБ занимает 3.2 секунды. Раньше сервили с собственного origin вместо Cloudflare Images.

Перешли на Cloudflare Images: автоматическое конвертирование в WebP, responsive sizing, edge cache. Интеграция `@nuxt/image` в `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  image: {
    cloudflare: {
      baseURL: 'https://imagedelivery.net/YOUR_ACCOUNT_HASH'
    },
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280
    }
  }
})
```

В компоненте:

```vue
<NuxtImg
  provider="cloudflare"
  src="/product-hero.jpg"
  sizes="sm:640px md:768px lg:1024px"
  format="webp"
  quality="85"
  loading="eager"
  fetchpriority="high"
/>
```

`fetchpriority="high"`: браузеру, это изображение приоритетно. `loading="eager"`: без ленивой загрузки, fetch сразу. Для hero логично. 1.8 МБ JPEG → 420 КБ WebP, вклад LCP с 3.2s упал до 0.8s.

Эта правка шла параллельно с обсуждениями performance budget в процессе [UI/UX дизайна](https://www.roibase.com.tr/ru/ui-ux) — уменьшили размер файла на %76 без снижения качества визуала.

## Runtime Телеметрия: Валидация на Реальных Данных Пользователей

Lab data (Lighthouse, WebPageTest) показывает LCP 1.9s. А что в RUM (Real User Monitoring)? Cloudflare Web Analytics + Google Analytics 4 с custom event'ами отслеживаем:

```typescript
// plugins/web-vitals.client.ts
import { onLCP, onINP, onCLS } from 'web-vitals'

export default defineNuxtPlugin(() => {
  onLCP((metric) => {
    if (window.gtag) {
      gtag('event', 'web_vitals', {
        event_category: 'Web Vitals',
        event_label: 'LCP',
        value: Math.round(metric.value),
        metric_id: metric.id,
        non_interaction: true
      })
    }
  })
  
  // То же для INP, CLS
})
```

За 14 дней данных: P75 LCP 2.1s (в lab'е 1.9s), P75 INP 220 мс (в lab'е 180 мс). Разница lab-RUM %10 — приемлемо. На мобильном 4G пользователи: LCP 2.4s, на WiFi 1.8s. Когда профиль сети вариативен, edge caching становится ещё критичнее.

## Трейдофф: Время Сборки и Developer Experience

Self-hosted шрифты добавляют +8s к `npm install`. Модуль `@nuxt/image` на dev server'е: первый старт с 3.2s до 4.1s. Ленивая гидратация сложнее отлаживать — нужны console log'и у границ гидратации, отслеживание timing'а вручную.

Invalidation кэша Cloudflare Workers: когда приходит обновление товара, нужно очистить edge cache через Cloudflare API. Добавили в CI/CD pipeline:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

Deployment +12s. Трейдофф: runtime performance выигрыш %40 drop в bounce rate стоит ли +12s deploy? Для нашего проекта — да.

## Итоги Оптимизации

| Метрика | До | После | Выигрыш |
|---------|-------|-------|---------|
| LCP (P75) | 10.2s | 1.9s | %81 |
| TBT | 3.1s | 190 мс | %94 |
| CLS | 0.18 | 0.04 | %78 |
| TTFB | 420 мс | 54 мс | %87 |
| Bounce Rate | %18 | %11 | %39 |

Conversion rate с %2.1 до %2.8 (+%33). Цифры — корреляция; без A/B тестирования, изменения цены, кампаний других нет. Можно разумно атрибутировать улучшениям performance.

Web performance не просто про "быстрый сайт" — напрямую связано с bounce rate, конверсией, выручкой. 10-секундный LCP теряет пользователей, 2 секунды повышает шансы конверсии. Self-hosted шрифты, ленивая гидратация, edge caching — в современных frontend stack'ах это обязательные шаги. Cloudflare Pages + Nuxt 3 облегчают эту работу, но дефолтный конфиг недостаточен. Требуется ручная настройка.