---
title: "Nuxt 3 + Cloudflare Pages: 10s LCP'den 2s'ye"
description: "Self-hosted fontlar, lazy hydration, content-visibility ve edge caching ile Nuxt 3 projesinde LCP süresini %80 düşürdük. Somut kod örnekleri ve benchmark numaraları."
publishedAt: 2026-05-28
modifiedAt: 2026-05-28
category: tech
i18nKey: tech-001-2026-05
tags: [nuxt3, web-performance, cloudflare-pages, core-web-vitals, edge-computing]
readingTime: 8
author: Roibase
---

Cloudflare Pages + Nuxt 3 kombinasyonu edge caching ve zero-config deployment vadediyor, ama Core Web Vitals için yeterli gelmiyor. Production'daki bir e-ticaret projesinde LCP 10.2 saniye, TBT 2190 milisaniyeydi. Google Font, client-side hydration, global CSS ve senkron JavaScript rendering'i bloke ediyordu. Self-hosted fontlar, lazy hydration, `content-visibility` CSS property ve edge cache stratejisiyle LCP'yi 2.1 saniyeye, TBT'yi 180 milisaniyeye düşürdük. Bu yazıda adım adım implementasyon ve tradeoff'ları paylaşıyoruz.

## Google Font Render Blocking: 3.8s Kaybı

Google Fonts CDN'inden `@import` veya `<link>` ile çekilen fontlar render'ı bloke eder. FOIT (Flash of Invisible Text) riski ve 3+ round-trip'lik latency, LCP'yi direkt etkiler. Chrome DevTools Lighthouse'da "Eliminate render-blocking resources" uyarısı 3.8 saniye gösteriyordu.

Çözüm: fontları self-host yaptık. `@fontsource/inter` npm paketini kullanarak Woff2 dosyalarını `public/fonts` dizinine koyduk. Nuxt config'de `preload` ekledik:

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

CSS'de `@font-face` ile sadece kullanılan ağırlıkları tanımladık:

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

`font-display: swap` ile FOUT (Flash of Unstyled Text) kabul edilir tradeoff oldu — invisible text yerine system font gösterilip font hazır olunca swap yapılıyor. LCP bu noktada 6.4 saniyeye düştü. Bundle size artışı 72 KB (Woff2 compressed), ama 3.8 saniye kazanım buna değdi.

## Client-Side Hydration: TBT 2190ms

Nuxt 3 default olarak tüm component'leri client-side hydrate eder. `app.vue` içinde 40+ component, global state (Pinia), composable'lar ve üçüncü parti kütüphaneler (Swiper, vue-gtag) ana thread'i bloke ediyordu. Chrome DevTools Performance tab'ında "Long Tasks" 8 adet, en uzunu 1240 milisaniye.

### Lazy Hydration ile Önceliklendirme

Above-the-fold olmayan component'leri lazy hydrate ettik. `@nuxtjs/web-vitals` modülü ile INP ve TBT tracking ekledikten sonra kritik yolu belirledik:

```vue
<!-- pages/index.vue -->
<template>
  <div>
    <!-- Above-the-fold: hemen hydrate -->
    <HeroSection />
    <ProductGrid :products="products" />

    <!-- Below-the-fold: lazy hydrate -->
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

`<client-only>` wrapper'ı ile Swiper gibi DOM-dependent kütüphaneleri SSR'den tamamen çıkardık. `requestIdleCallback` ile hidrasyon main thread idle olduğunda yapılıyor. TBT bu adımdan sonra 840 milisaniyeye düştü.

### Bundle Splitting ve Code Splitting

Nuxt 3'ün `vite-plugin-inspect` ile bundle analizi yaptık. Swiper kütüphanesi tek başına 168 KB minified, ama sadece review carousel'de kullanılıyordu. Dynamic import ile bölmek yerine önce kullanımı azalttık — Swiper'ın `Virtual` ve `Autoplay` modüllerini çıkardık, sadece `Navigation` kaldı:

```typescript
// composables/useSwiper.ts
import { Navigation } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'

export const useSwiperModules = () => [Navigation]
```

Bundle 168 KB'den 42 KB'ye düştü. `<LazyReviewCarousel>` component'i zaten lazy load olduğu için ana bundle'a dahil olmadı.

## Content-Visibility: Render Periyodu Azaltma

Product grid 48 ürün kartı, her biri image + title + price + button. Browser initial render sırasında 48 card'ı aynı anda layout hesaplıyor, LCP'yi uzatıyor. CSS `content-visibility: auto` ile below-the-fold kartlar render'dan çıkarıldı:

```css
/* components/ProductCard.vue */
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 320px 420px;
}
```

`contain-intrinsic-size` ile kartın placeholder boyutu browser'a söyleniyor, scroll position hesabı bozulmuyor. LCP 6.4'ten 3.9 saniyeye düştü. Tradeoff: ilk viewport dışındaki kartlar scroll'da render ediliyor, ama INP'ye etkisi 12 milisaniye (kabul edilebilir).

## Edge Caching: TTFB 1.2s → 40ms

Cloudflare Pages default olarak HTML'i cache etmiyor, her request origin'e gidiyor. Nuxt 3 SSR response süresi ortalama 1200 milisaniye (API call + rendering). `_headers` dosyasıyla edge caching aktif ettik:

```
# public/_headers
/*
  Cache-Control: public, max-age=0, s-maxage=600, stale-while-revalidate=86400
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
```

`s-maxage=600` ile Cloudflare edge 10 dakika cache yapıyor. `stale-while-revalidate=86400` ile cache expire olduğunda eski versiyon gösterilirken background'da yeni render yapılıyor. TTFB 40 milisaniyeye düştü (edge hit). Origin request sadece cache miss veya stale revalidation'da yapılıyor.

### ISR ile Hybrid Rendering

Product sayfaları için Incremental Static Regeneration kullandık. Nuxt'ta `routeRules` ile yapılıyor:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/products/**': { 
      swr: 600,  // 10 dakika
      prerender: false
    },
    '/': { 
      swr: 300   // 5 dakika
    }
  }
})
```

İlk request SSR, sonrası edge cache. Stok güncellemeleri için webhook ile manuel purge yapıyoruz:

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

## Benchmark Karşılaştırması

| Metrik | Önce | Sonra | Değişim |
|--------|------|-------|---------|
| LCP | 10.2s | 2.1s | -79% |
| TBT | 2190ms | 180ms | -92% |
| TTFB | 1200ms | 40ms | -97% |
| FCP | 4.8s | 1.2s | -75% |
| CLS | 0.18 | 0.02 | -89% |
| Bundle (initial) | 284 KB | 186 KB | -34% |

Test ortamı: Chrome 121, 4G throttling, Lighthouse CI. 10 run ortalaması. LCP hedefi 2.5 saniye altı (Google "Good" threshold), ulaşıldı.

## Tradeoff ve Dikkat Edilecekler

Self-hosted fontlar CDN'nin global edge network'ünü kaybettiriyor, ama Cloudflare Pages zaten edge'de host ediyor. Woff2 compression ile ek latency minimal. Lazy hydration ile initial interactivity kaybı var — below-the-fold component'ler mounted hook'tan sonra interactive oluyor. Analytics'te "time to interactive below fold" metriği eklenmeli.

`content-visibility` Safari 17.4 öncesi desteklenmiyor, `@supports` guard kullanılmalı. Edge caching ile personalization conflict riski var — sepet, user login state gibi dinamik içerik `Cache-Control: private` ile korunmalı veya client-side render edilmeli.

ISR webhook purge'ü manuel süreç, otomasyonla inventory management system'e entegre edilmeli. Stale content riski kritik sayfalar için (checkout, payment) ISR devre dışı bırakılmalı.

## Composable Architecture İle Ölçeklenebilirlik

Bu optimizasyonları [Headless Commerce](https://www.roibase.com.tr/tr/headless) mimarisinde test ettik — Nuxt 3 frontend, Shopify Storefront API backend. Aynı pattern Next.js + Hydrogen veya Remix'te de çalışır. Edge caching stratejisi framework-agnostic, Cloudflare Workers KV veya Vercel Edge Config ile genişletilebilir. Performance monitoring için `@nuxtjs/web-vitals` yerine RUM (Real User Monitoring) eklenmeli — Cloudflare Web Analytics veya Sentry Performance kullanılabilir.

LCP 2.1 saniye ile Google "Good" kategorisinde, ama mobilde 4G altı bağlantılarda test edilmeli. Progressive enhancement stratejisi ile JavaScript fail durumu için SSR HTML çalışır durumda kalmalı. Bu sebeple kritik content JavaScript'siz de render edilmeli, Nuxt'ın `<NoScript>` component'i kullanılabilir.