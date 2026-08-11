---
title: "Nuxt 3 + Cloudflare Pages: От 10с LCP к 2с"
description: "Self-hosted шрифты, ленивая гидрация, content-visibility и edge-кеширование: снижение LCP на 80% в production. Код и анализ компромиссов."
publishedAt: 2026-08-11
modifiedAt: 2026-08-11
category: tech
i18nKey: tech-001-2026-08
tags: [nuxt3, web-performance, cloudflare-pages, core-web-vitals, edge-caching]
readingTime: 9
author: Roibase
---

В 2024 году Core Web Vitals перешли на INP, но LCP остаётся наиболее видимой пользователю метрикой. Когда мы запустили e-commerce проект на стеке Nuxt 3 + Cloudflare Pages в production, LCP составил 10,2 секунды — на мобильных сетях 3G с throttle. После 6 недель оптимизации в той же сценарии показатель упал до 2,1 секунды. Этот материал разбирает анатомию 4 критических техник: стратегия self-hosted шрифтов, паттерн ленивой гидрации, CSS content-visibility и архитектура edge-кеширования.

## Self-Hosted Шрифты: 1,8с внешний запрос → 120мс локальная доставка

Загрузка шрифтов из Google Fonts через CDN выглядит логичной, но несёт 3 издержки round-trip: DNS, TLS handshake, файл шрифта. Это добавляло в среднем 1,8 секунды latency. Мы перенесли шрифт в статические ассеты.

**Шаги:**

```bash
# 1. Скачайте шрифт и положите в /public/fonts
# Inter variable: ~400KB WOFF2

# 2. nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      link: [
        {
          rel: 'preload',
          href: '/fonts/inter-var.woff2',
          as: 'font',
          type: 'font/woff2',
          crossorigin: 'anonymous'
        }
      ]
    }
  }
})
```

**CSS:**

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-display: swap;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}
```

**Компромисс:** Размер initial bundle вырос на 400KB, но из critical path исчезла 1 внешняя зависимость. Cloudflare CDN доставляет это из 300+ PoP, медианный TTFB 80мс. `font-display: swap` означает принятие FOUT (Flash of Unstyled Text) — стоимость %0,3 layout shift.

**Бенчмарк:** Вклад в LCP -1,6с (10,2с → 8,6с).

## Ленивая гидрация: 3,2с TBT → 420мс

Default поведение Nuxt SSR гидрирует всё дерево компонентов на клиенте. Тяжёлые компоненты, вроде сетки товаров, которые не видны в первом viewport, получают издержку гидрации впустую.

**Паттерн:** отслеживание viewport + динамический импорт.

```vue
<template>
  <div ref="target">
    <ClientOnly v-if="isVisible">
      <HeavyProductGrid :products="products" />
    </ClientOnly>
    <div v-else class="skeleton-grid" />
  </div>
</template>

<script setup lang="ts">
const target = ref<HTMLElement | null>(null)
const isVisible = ref(false)

onMounted(() => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        isVisible.value = true
        observer.disconnect()
      }
    },
    { rootMargin: '50px' }
  )
  
  if (target.value) observer.observe(target.value)
})
</script>
```

**Результат:** Сетка товаров весила 28KB JS, гидрация занимала 680мс. Три компонента сетки ниже fold'а ленивой загружались так, что TBT сократился с 3,2с до 420мс. Lighthouse Performance Score: 42 → 78.

**Компромисс:** Когда пользователь скролл до skeleton UI и тот загружается, возможна задержка 150-200мс. Есть риск CLS — высота skeleton должна точно совпадать с реальным контентом.

### H3: Паттерн ленивого импорта компонента в Nuxt

```ts
// composables/useLazyComponent.ts
export const useLazyComponent = (componentPath: string) => {
  return defineAsyncComponent({
    loader: () => import(`~/components/${componentPath}.vue`),
    loadingComponent: SkeletonLoader,
    delay: 200,
    timeout: 10000
  })
}

// Использование:
const ProductGrid = useLazyComponent('ProductGrid')
```

## CSS content-visibility: Стоимость рендеринга -60%

С Chrome 85 `content-visibility: auto` даёт браузеру сигнал "не рендерь этот элемент вне viewport". Отсрочиваются операции layout, paint и composite.

**Применение:**

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 400px; /* предполагаемая высота */
}
```

**Lighthouse trace:**
- До: создание render tree 1240мс (312 узлов)
- После: 520мс (88 узлов для первого viewport)

**Критичная деталь:** `contain-intrinsic-size` необходим для расчёта scrollbar. Неверное значение запустит CLS. В нашем случае карточки высотой 380-420px, взяли среднее 400px.

**Внимание:** Safari 17.4 и ранее не поддерживают — думайте как прогрессивное улучшение. Fallback не требуется, просто теряется прирост производительности.

## Edge-кеширование: Origin load -85%

Cloudflare Pages по умолчанию кеширует статические ассеты, но отправляет dynamic routes на origin. API `routeRules` Nuxt позволяет определять правила кеша на уровне страниц.

**nuxt.config.ts:**

```ts
export default defineNuxtConfig({
  routeRules: {
    '/': { 
      isr: 3600, // 1 час stale-while-revalidate
      headers: { 'cache-control': 's-maxage=3600' }
    },
    '/products/**': { 
      isr: 1800,
      headers: { 'cache-control': 's-maxage=1800, stale-while-revalidate=86400' }
    },
    '/api/**': { cache: false } // API routes bypass
  },
  nitro: {
    preset: 'cloudflare-pages',
    cloudflare: {
      pages: {
        routes: {
          exclude: ['/admin/*']
        }
      }
    }
  }
})
```

**Логика ISR (Incremental Static Regeneration):**
1. Первый запрос → SSR с origin, ответ кешируется
2. Запросы в течение 3600с → доставляются с edge (TTFB ~40мс)
3. После 3600с первый запрос → возвращает стареющий ответ, БУТ фон обновляет origin
4. Следующие запросы → свежий ответ

**Аналитика Cloudflare:**
- Origin request rate: %92 → %7 (среднее за 3 недели)
- Медианный TTFB: 680мс → 52мс
- 99p TTFB: 2,1с → 180мс

**Компромисс:** Обновления стока товаров показываются с задержкой до 1 часа. На критических страницах (checkout) использовали `cache: false`. В [архитектурах headless commerce](https://www.roibase.com.tr/ru/headless) такая стратегия edge-кеширования дает прирост производительности независимо от backend.

## Анализ bundle: охота на ненужные зависимости

На этапе оптимизации запускали `nuxt analyze` чтобы изучить состав bundle. Два крупных выигрыша:

**1. Lodash → native ES6:**

```js
// До: 72KB gzipped
import { debounce, throttle } from 'lodash'

// После: 0KB (встроенные утилиты)
const debounce = (fn, ms) => {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
```

**2. Day.js → Intl API:**

```js
// До: day.js 11KB
import dayjs from 'dayjs'
dayjs(date).format('DD MMM YYYY')

// После: встроенное 0KB
new Intl.DateTimeFormat('ru-RU', { 
  day: '2-digit', 
  month: 'short', 
  year: 'numeric' 
}).format(new Date(date))
```

**Общий результат:** Сокращение bundle 83KB gzipped → FCP (First Contentful Paint) улучшился на 240мс.

## Сравнительная таблица: До/После

| Метрика | До | После | Изменение |
|---------|-----|-------|-----------|
| LCP (3G) | 10,2с | 2,1с | -79% |
| TBT | 3,2с | 420мс | -87% |
| CLS | 0,18 | 0,04 | -78% |
| FCP | 2,8с | 1,4с | -50% |
| JS Bundle | 312KB | 229KB | -27% |
| TTFB (edge hit) | 680мс | 52мс | -92% |

**Окружение тестирования:** Chrome 120, Lighthouse 11, 3G throttle (1,6Mbps down, 750Kbps up, 300мс RTT). Среднее за 10 прогонов.

## Заключение: Инженерия производительности — это инженерия опыта пользователя

Эти 4 техники недостаточны по отдельности — требуется непрерывное измерение и итерация. В production отслеживаем 95p LCP через RUM (Real User Monitoring). При добавлении новых feature запускаем тесты регрессии размера bundle. Еженедельно ревьюим коэффициент edge-кеширования в Cloudflare Analytics. Прирост в web performance — это не одноразовое событие, это встроенная в цикл разработки дисциплина.