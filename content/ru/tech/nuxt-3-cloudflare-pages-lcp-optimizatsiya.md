---
title: "Nuxt 3 + Cloudflare Pages: LCP снижение с 10s на 2s"
description: "Self-hosted шрифты, ленивая гидратация, content-visibility и edge кеширование снизили LCP на 80%. Код и бенчмарки внутри."
publishedAt: 2026-05-28
modifiedAt: 2026-05-28
category: tech
i18nKey: tech-001-2026-05
tags: [nuxt3, web-performance, cloudflare-pages, core-web-vitals, edge-computing]
readingTime: 8
author: Roibase
---

Cloudflare Pages + Nuxt 3 обещают edge-кеширование и zero-config деплой, но для Core Web Vitals этого недостаточно. В боевом e-commerce проекте LCP был 10.2 секунды, TBT — 2190 мс. Google Fonts, client-side гидратация, глобальный CSS и синхронный JavaScript блокировали рендеринг. С помощью self-hosted шрифтов, ленивой гидратации, CSS свойства `content-visibility` и edge-кеш стратегии мы снизили LCP до 2.1 сек, TBT — до 180 мс. Рассказываем реализацию и trade-off'ы.

## Google Fonts блокирует рендеринг: потеря 3.8s

Шрифты, подключенные через `@import` или `<link>` с Google Fonts CDN, блокируют рендеринг страницы. FOIT (Flash of Invisible Text) и 3+ round-trip'а добавляют латенси. Lighthouse показал "Eliminate render-blocking resources" с потерей 3.8 сек.

Решение: self-hosted шрифты. Использовали пакет `@fontsource/inter`, поместили Woff2 файлы в `public/fonts`. В Nuxt config добавили `preload`:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      link: [
        {
          rel: 'preload',
          as: 'font',
          type: 'font/woff2',
          href: '/fonts/inter-latin-400-normal.woff2',
          crossorigin: 'anonymous'
        },
        {
          rel: 'preload',
          as: 'font',
          type: 'font/woff2',
          href: '/fonts/inter-latin-600-normal.woff2',
          crossorigin: 'anonymous'
        }
      ]
    }
  }
})
```

В CSS определили только используемые начертания через `@font-face`:

```css
/* assets/css/fonts.css */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/inter-latin-400-normal.woff2') format('woff2');
}

@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/fonts/inter-latin-600-normal.woff2') format('woff2');
}
```

С `font-display: swap` приняли trade-off — вместо невидимого текста показывается системный шрифт, затем происходит замена. LCP упал до 6.4 сек. Прирост бандла — 72 KB (Woff2 compressed), но экономия 3.8 сек оправдана.

## Client-side гидратация: TBT 2190ms

Nuxt 3 по умолчанию гидратирует все компоненты на клиенте. В `app.vue` было 40+ компонентов, Pinia store, composable'ы и третьесторонние библиотеки (Swiper, vue-gtag) блокировали main thread. Performance tab показал 8 "Long Tasks", самая долгая — 1240 мс.

### Ленивая гидратация с приоритизацией

Компоненты below-the-fold гидратируем лениво. После добавления `@nuxtjs/web-vitals` и анализа критического пути приоритизировали компоненты:

```vue
<!-- pages/index.vue -->
<template>
  <div>
    <!-- Above-the-fold: гидратируем сразу -->
    <HeroSection />
    <ProductGrid :products="products" />

    <!-- Below-the-fold: ленивая гидратация -->
    <LazyFooter v-if="mounted" />
    <LazyNewsletterForm v-if="mounted" />
    <client-only>
      <LazyReviewCarousel :reviews="reviews" />
    </client-only>
  </div>
</template>

<script setup lang="ts">
const mounted = ref(false)

onMounted(() => {
  requestIdleCallback(() => {
    mounted.value = true
  })
})
</script>
```

Wrapper `<client-only>` исключил Swiper и другие DOM-dependent библиотеки из SSR. `requestIdleCallback` запускает гидратацию, когда main thread свободен. TBT упал до 840 мс.

### Bundle splitting и code splitting

С помощью `vite-plugin-inspect` анализировали бандл. Swiper занимал 168 KB minified, но использовался только в карусели отзывов. Вместо динамического импорта сначала уменьшили использование — оставили только модуль `Navigation`, убрали `Virtual` и `Autoplay`:

```typescript
// composables/useSwiper.ts
import { Navigation } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'

export const useSwiperModules = () => [Navigation]
```

Бандл сократился с 168 KB до 42 KB. `<LazyReviewCarousel>` уже ленивый, поэтому не попал в основной бандл.

## Content-visibility: сокращение периода рендеринга

Product grid содержит 48 карточек, каждая — image + title + price + button. При инициальном рендере браузер одновременно считает layout для всех 48 карточек. CSS свойство `content-visibility: auto` исключило below-the-fold карточки из рендеринга:

```css
/* components/ProductCard.vue */
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 320px 420px;
}
```

`contain-intrinsic-size` указывает браузеру placeholder размер карточки, избегая проблем со scroll position. LCP упал с 6.4 до 3.9 сек. Trade-off: карточки вне viewport рендерятся при скролле, но добавил лишь 12 мс к INP (приемлемо).

## Edge кеширование: TTFB 1.2s → 40ms

Cloudflare Pages по умолчанию не кеширует HTML, каждый запрос идет на origin. SSR ответ занимает ~1200 мс (API + рендеринг). Через файл `_headers` включили edge кеширование:

```
# public/_headers
/*
  Cache-Control: public, max-age=0, s-maxage=600, stale-while-revalidate=86400
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
```

`s-maxage=600` — Cloudflare edge кеширует на 10 минут. `stale-while-revalidate=86400` — при истечении cache показывает старую версию, в фоне обновляет. TTFB упал до 40 мс (edge hit). Origin request только при cache miss или revalidation.

### ISR с гибридным рендерингом

Для product pages использовали Incremental Static Regeneration. В Nuxt через `routeRules`:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/products/**': { 
      swr: 600,  // 10 минут
      prerender: false
    },
    '/': { 
      swr: 300   // 5 минут
    }
  }
})
```

Первый запрос — SSR, затем edge кеш. Для обновления стока используем webhook для manual purge:

```typescript
// server/api/purge-cache.post.ts
export default defineEventHandler(async (event) => {
  const { productId } = await readBody(event)
  
  await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/purge_cache`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      files: [`https://example.com/products/${productId}`]
    })
  })
  
  return { success: true }
})
```

## Сравнение бенчмарков

| Метрика | До | После | Изменение |
|---------|-------|-------|-----------|
| LCP | 10.2s | 2.1s | -79% |
| TBT | 2190ms | 180ms | -92% |
| TTFB | 1200ms | 40ms | -97% |
| FCP | 4.8s | 1.2s | -75% |
| CLS | 0.18 | 0.02 | -89% |
| Bundle (initial) | 284 KB | 186 KB | -34% |

Тест: Chrome 121, 4G throttling, Lighthouse CI. Среднее 10 прогонов. LCP теперь ниже 2.5 сек — Google "Good" threshold достигнут.

## Trade-off'ы и внимание

Self-hosted шрифты теряют глобальную CDN сеть, но Cloudflare Pages уже edge-hosted. С Woff2 дополнительная латенси минимальна. Ленивая гидратация снижает initial interactivity — below-the-fold компоненты становятся интерактивными после mounted. Добавьте в аналитику метрику "time to interactive below fold".

`content-visibility` не поддерживается в Safari до 17.4, используйте `@supports`. Edge кеширование конфликтует с персонализацией — разделите через `Cache-Control: private` или client-side рендеринг для корзины и авторизации.

ISR webhook purge — ручной процесс, интегрируйте с inventory системой. Для критичных страниц (checkout, payment) отключите ISR.

## Масштабируемость с Composable архитектурой

Эти оптимизации тестировали на [Headless Commerce](https://www.roibase.com.tr/ru/headless) — Nuxt 3 frontend, Shopify Storefront API backend. Паттерн работает в Next.js + Hydrogen и Remix. Edge-кеш стратегия framework-agnostic, расширяется через Cloudflare Workers KV или Vercel Edge Config. Добавьте RUM (Real User Monitoring) — Cloudflare Web Analytics или Sentry Performance.

LCP 2.1 сек — Google "Good", но на мобилях 4G ниже требует тестирования. Progressive enhancement — критичный контент должен рендериться без JavaScript. Используйте Nuxt `<NoScript>` компонент.

```
SLUG: nuxt-3-cloudflare-pages-lcp-optimizatsiya