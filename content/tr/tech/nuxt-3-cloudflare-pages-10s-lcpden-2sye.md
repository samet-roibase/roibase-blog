---
title: "Nuxt 3 + Cloudflare Pages: 10s LCP'den 2s'ye"
description: "Self-hosted font, lazy hydration, content-visibility ve edge caching ile gerçek projede 80% LCP düşüşü. Kod örnekleri ve tradeoff analizi."
publishedAt: 2026-08-11
modifiedAt: 2026-08-11
category: tech
i18nKey: tech-001-2026-08
tags: [nuxt3, web-performance, cloudflare-pages, core-web-vitals, edge-caching]
readingTime: 8
author: Roibase
---

2024'te Core Web Vitals INP'ye geçti ama LCP hâlâ kullanıcı deneyiminin en görünür metriği. Bir e-ticaret projesinde Nuxt 3 + Cloudflare Pages stack'ini production'a aldığımızda LCP 10.2 saniye geldi — mobil 3G throttle'da. 6 haftalık optimizasyon sonrası aynı senaryoda 2.1 saniyeye düştü. Bu yazı o süreçte uygulanan 4 kritik tekniğin anatomisi: self-hosted font stratejisi, lazy hydration pattern'i, CSS content-visibility ve edge caching mimarisi.

## Self-Hosted Font: 1.8s External Request → 120ms Local Serve

Google Fonts'u CDN'den çekmek sezgisel görünür ama 3 round-trip maliyeti var: DNS, TLS handshake, font file. 1.8 saniye ortalama latency getirdi. Fontu statik asset'e taşıdık.

**Adımlar:**

```bash
# 1. Fontu indirip /public/fonts'a koy
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

**Tradeoff:** Initial bundle size 400KB arttı ama critical path'ten 1 external dependency çıktı. Cloudflare CDN bunu 300+ PoP'tan serve ediyor, median TTFB 80ms. `font-display: swap` ile FOUT (Flash of Unstyled Text) kabul ettik — %0.3'lük layout shift bunun bedeli.

**Benchmark:** LCP contribution -1.6s (10.2s → 8.6s).

## Lazy Hydration: 3.2s TBT → 420ms

Nuxt'ın default SSR davranışı tüm component tree'yi client'ta hydrate eder. Product listing grid gibi ağır component'ler ilk viewport'ta interaktif değilse hydration maliyeti boşa gider.

**Pattern:** Viewport tracking + dynamic import.

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

**Sonuç:** Product grid 28KB JS bundle, hydration 680ms alıyordu. Above-the-fold'da olmayan 3 grid component lazy yüklenerek TBT (Total Blocking Time) 3.2s → 420ms düştü. Google Lighthouse performans skoru 42 → 78.

**Tradeoff:** Skeleton UI devreye girdiğinde kullanıcı kaydırırsa 150-200ms yükleme gecikmesi görür. CLS (Cumulative Layout Shift) riski var — skeleton height'ı real content ile match etmek zorunlu.

### H3: Nuxt'ta Lazy Component Import Pattern

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

// Kullanım:
const ProductGrid = useLazyComponent('ProductGrid')
```

## CSS content-visibility: Rendering Cost -60%

Chrome 85'ten beri `content-visibility: auto` browser'a "bu element viewport dışındayken render'lama" sinyali verir. Layout, paint ve composite işlemlerini erteler.

**Uygulama:**

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 400px; /* tahmini height */
}
```

**Lighthouse trace:**
- Before: Render tree oluşumu 1240ms (312 node)
- After: 520ms (88 node ilk viewport için)

**Önemli detay:** `contain-intrinsic-size` scroll bar hesaplama için zorunlu. Yanlış değer CLS tetikler. Bizim case'de gerçek card height 380-420px range'inde, 400px ortalaması aldık.

**Dikkat:** Safari 17.4'e kadar destek yok — progresif enhancement olarak düşün. Fallback'e ihtiyaç yok, sadece performans kazancı kaybedersin.

## Edge Caching: Origin Load -85%

Cloudflare Pages default'ta static asset'leri cache'ler ama dynamic route'ları origin'e gönderir. Nuxt'ın `routeRules` API'si ile page-level cache kuralı tanımlayabilirsin.

**nuxt.config.ts:**

```ts
export default defineNuxtConfig({
  routeRules: {
    '/': { 
      isr: 3600, // 1 saat stale-while-revalidate
      headers: { 'cache-control': 's-maxage=3600' }
    },
    '/products/**': { 
      isr: 1800,
      headers: { 'cache-control': 's-maxage=1800, stale-while-revalidate=86400' }
    },
    '/api/**': { cache: false } // API route'ları bypass
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

**ISR (Incremental Static Regeneration) mantığı:**
1. İlk request → Origin'den SSR, response cache'lenir
2. 3600s içinde gelen request'ler → Edge'den serve (TTFB ~40ms)
3. 3600s sonra gelen ilk request → Stale response döner AMA background'da origin yeniler
4. Sonraki request'ler → Fresh response

**Cloudflare Analytics:**
- Origin request rate: %92 → %7 (3 haftalık ortalama)
- Median TTFB: 680ms → 52ms
- 99p TTFB: 2.1s → 180ms

**Tradeoff:** Product stok güncellemesi 1 saate kadar gecikmeli gösterilir. Kritik sayfalarda (checkout) `cache: false` kullandık. [Headless Commerce](https://www.roibase.com.tr/tr/headless) mimarisinde bu tür edge caching stratejisi backend'den bağımsız performans kazancı sağlar.

## Bundle Analizi: Gereksiz Dependency Avı

Optimizasyon sürecinde `nuxt analyze` ile bundle composition'ı inceledik. 2 büyük kazanç:

**1. Lodash yerine native ES6:**

```js
// Before: 72KB gzipped
import { debounce, throttle } from 'lodash'

// After: 0KB (native utility)
const debounce = (fn, ms) => {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
```

**2. Day.js yerine Intl API:**

```js
// Before: day.js 11KB
import dayjs from 'dayjs'
dayjs(date).format('DD MMM YYYY')

// After: native 0KB
new Intl.DateTimeFormat('tr-TR', { 
  day: '2-digit', 
  month: 'short', 
  year: 'numeric' 
}).format(new Date(date))
```

**Toplam bundle reduction:** 83KB gzipped → FCP (First Contentful Paint) 240ms iyileşti.

## Karşılaştırmalı Tablo: Before/After

| Metrik | Before | After | Değişim |
|--------|--------|-------|---------|
| LCP (3G) | 10.2s | 2.1s | -79% |
| TBT | 3.2s | 420ms | -87% |
| CLS | 0.18 | 0.04 | -78% |
| FCP | 2.8s | 1.4s | -50% |
| JS Bundle | 312KB | 229KB | -27% |
| TTFB (edge hit) | 680ms | 52ms | -92% |

**Test ortamı:** Chrome 120, Lighthouse 11, 3G throttle (1.6Mbps down, 750Kbps up, 300ms RTT). 10 run ortalaması.

## Sonuç: Performans Mühendisliği Değil, Kullanıcı Deneyimi Mühendisliği

Bu 4 teknik tek başına yeterli değil — sürekli ölçüm ve iteration gerekiyor. Production'da RUM (Real User Monitoring) ile 95p LCP'yi takip ediyoruz. Yeni feature eklendiğinde bundle size regression test yapıyoruz. Edge caching oranını Cloudflare Analytics'ten weekly review ediyoruz. Web performance kazancı bir kere alınıp unutulan iş değil, ürün geliştirme döngüsüne gömülü disiplin.