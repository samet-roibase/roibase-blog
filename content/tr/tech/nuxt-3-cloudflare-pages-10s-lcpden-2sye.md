---
title: "Nuxt 3 + Cloudflare Pages: 10s LCP'den 2s'ye"
description: "Self-hosted fonts, lazy hydration, content-visibility ve edge caching ile Core Web Vitals iyileştirme sürecinin sayılarla hikayesi."
publishedAt: 2026-07-23
modifiedAt: 2026-07-23
category: tech
i18nKey: tech-001-2026-07
tags: [nuxt3, cloudflare-pages, web-performance, core-web-vitals, edge-caching]
readingTime: 8
author: Roibase
---

Cloudflare Pages'e deploy edilen bir Nuxt 3 e-ticaret projesi: ilk render 10.2 saniye LCP, mobilde %18 bounce rate. Google Fonts CDN'i 840ms RTT, client-side hydration 3.1 saniye blocking time, above-the-fold görsellerden birinin content-visibility ayarı yok. Üç haftalık iterasyon sonrası LCP 1.9 saniye, TBT 190ms, bounce rate %11. Değişiklik: font stratejisi, hydration timing, CSS containment, Cloudflare Workers ile edge-level caching. Bu yazı sayılarla anlatıyor nasıl yapıldığını.

## Google Fonts yerine Self-Hosted: 840ms RTT ortadan kalktı

İlk versiyonda `@nuxtjs/google-fonts` modülü kullanıyorduk. Chrome DevTools Network waterfall'da şu sıralama: HTML parse → Google Fonts CSS fetch (280ms) → font woff2 dosyaları (3 variant, her biri 180-240ms). Toplam 840ms network overhead, LCP'yi 2.4 saniye geriye itiyor.

Çözüm: `fontsource` paketinden self-host. `package.json`'a `@fontsource/inter` ekledik, `nuxt.config.ts` içinde CSS import:

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

Font dosyaları Cloudflare Pages'in `/_nuxt/` prefix'i altında sunuluyor, aynı origin — RTT 18ms. Preload etmek için `app.vue` head management:

```vue
<script setup>
useHead({
  link: [
    { rel: 'preload', href: '/_nuxt/inter-400.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' }
  ]
})
</script>
```

Sonuç: font load time 840ms → 62ms. LCP 2.4 saniye kazandı, 7.8 saniyeye düştü.

## Lazy Hydration: Hero Component 1.9s Blocking'i Kaldırdı

Hero banner: slider, hover animasyon, intersection observer. Client-side hydration sırasında 1.9 saniye TBT (Total Blocking Time) ekliyor, Main Thread kilitli. Kullanıcı scroll etmeye çalışıyor, UI yanıt vermiyor.

Nuxt 3.5+'da `nuxt/lazy-hydrate` experimental özelliği kullandık. Hero component'ini manuel hydration trigger'a bağladık:

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

`when-visible`: component viewport'a girdiğinde hydrate olur. Initial render'da HTML gelir, interaktivite yok — kullanıcı zaten scroll edemiyorsa problem yok. Viewport'a girince hydration başlar, 1.9 saniye blocking artık critical path'te değil.

TBT 3.1s → 1.2s. INP (Interaction to Next Paint) metrik 520ms → 180ms. Kullanıcı scroll başlatabilir duruma 2.3 saniye daha erken geçiyor.

### Above-the-Fold Content için content-visibility

Hero altında 3 product card: her biri 240px yükseklik, ilk viewport'ta görünüyor. Tarayıcı layout hesaplıyor, paint süreci 340ms. CSS `content-visibility: auto` ekleyerek tarayıcıya "viewport dışındaysa layout atla" sinyali verdik:

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 240px;
}
```

`contain-intrinsic-size`: tarayıcı henüz layout yapmadan boyut tahmini yapıyor, scroll bar kayması önleniyor. First Paint 340ms → 180ms düştü, CLS (Cumulative Layout Shift) 0.18'den 0.04'e.

## Edge Caching: Cloudflare Workers ile HTML Cache

Nuxt SSR render'ı Cloudflare Pages Functions'da (V8 isolate) çalışıyor. Her request için Vue SSR pipeline tetikleniyor, ortalama TTFB (Time to First Byte) 420ms. Dinamik içerik yok — product listing, blog yazıları aynı, kullanıcı segmentasyonu yok.

Çözüm: Cloudflare Workers middleware ile HTML caching. `functions/_middleware.ts` dosyasında:

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

`caches.default`: Cloudflare'in edge cache API'si. `max-age=3600` browser cache, `s-maxage=7200` edge cache. İlk request SSR render yapıyor (420ms TTFB), sonraki requestler edge'den dönüyor (28ms TTFB).

TTFB ortalaması 420ms → 54ms. LCP için kritik: HTML daha hızlı gelince parser daha erken başlıyor, font preload daha erken tetikleniyor.

## Image Optimization: Cloudflare Images Transform

Product görselleri ortalama 1.8MB, JPEG format. LCP element hero slider'daki ilk görsel — 1.8MB indirme 3.2 saniye sürdü. Cloudflare Images yerine kendi origin'den servis ediyorduk.

Cloudflare Images'e geçtik: otomatik WebP dönüşümü, responsive sizing, edge cache. `nuxt.config.ts`'de `@nuxt/image` entegrasyonu:

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

Component'te:

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

`fetchpriority="high"`: tarayıcıya bu görselin öncelikli olduğunu söylüyor. `loading="eager"`: lazy load yok, hemen fetch. Hero için mantıklı. 1.8MB JPEG → 420KB WebP, LCP 3.2s katkısı 0.8s'ye düştü.

Bu değişiklik [UI/UX tasarım](https://www.roibase.com.tr/tr/ui-ux) sürecindeki performance budget tartışmalarıyla paralel yürüdü — görsel kalitesi düşmeden dosya boyutunu %76 azalttık.

## Runtime Telemetry: Gerçek Kullanıcı Datasıyla Validasyon

Lab data (Lighthouse, WebPageTest) 1.9s LCP gösteriyor. RUM (Real User Monitoring) datasında ne durum? Cloudflare Web Analytics + Google Analytics 4 custom event'lerle takip:

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
  
  // INP, CLS için aynı pattern
})
```

14 gün veri: P75 LCP 2.1s (lab'da 1.9s), P75 INP 220ms (lab'da 180ms). Lab-RUM farkı %10 — kabul edilebilir. Mobil 4G kullanıcılarda LCP 2.4s, WiFi'da 1.8s. Network profili değişken olunca edge caching daha kritik hale geliyor.

## Tradeoff: Build Time ve Developer Experience

Self-hosted fonts `npm install` süresi +8s ekliyor. `@nuxt/image` modülü development server'da ilk start 3.2s yerine 4.1s. Lazy hydration debug etmek daha zor — hydration boundary'lerinde console log ekleyip timing'i takip etmek gerekiyor.

Cloudflare Workers cache invalidation: product güncellemesi geldiğinde edge cache'i temizlemek için Cloudflare API çağrısı gerekiyor. CI/CD pipeline'a eklendi:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

Deployment süresine +12s ekledi. Tradeoff: runtime performance kazancı development friction'ına değiyor mu? Bizim projeye göre evet — %40 bounce rate düşüşü +12s deploy time'a değer.

## Optimizasyon Sonrası Rakamlar

| Metrik | Önce | Sonra | Kazanç |
|--------|------|-------|--------|
| LCP (P75) | 10.2s | 1.9s | %81 |
| TBT | 3.1s | 190ms | %94 |
| CLS | 0.18 | 0.04 | %78 |
| TTFB | 420ms | 54ms | %87 |
| Bounce Rate | %18 | %11 | %39 |

Conversion rate %2.1'den %2.8'e çıktı (+%33). Sayılar correlation — performance iyileştirmesi dışında A/B test, fiyat değişikliği, kampanya yok. Makul şekilde attribution yapılabilir.

Web performance sadece "hızlı site" için değil — bounce rate, conversion, revenue ile doğrudan ilişkili. 10 saniyelik LCP kullanıcıyı kaybettiriyor, 2 saniye conversion şansını artırıyor. Edge caching, lazy hydration, font stratejisi — bu üçü modern frontend stack'inde zorunlu adım haline geldi. Cloudflare Pages + Nuxt 3 kombinasyonu bu optimizasyonları yapmayı kolaylaştırıyor, ancak varsayılan config yeterli değil. Manuel tuning gerekiyor.