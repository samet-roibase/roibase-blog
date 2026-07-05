---
title: "Nuxt 3 + Cloudflare Pages: 10s LCP'den 2s'ye"
description: "Self-hosted fonts, lazy hydration, content-visibility ve edge caching ile Nuxt 3 projesinde LCP'yi 80% düşürmenin teknik anatomisi."
publishedAt: 2026-07-05
modifiedAt: 2026-07-05
category: tech
i18nKey: tech-001-2026-07
tags: [nuxt-3, web-performance, cloudflare-pages, core-web-vitals, lcp]
readingTime: 8
author: Roibase
---

Nuxt 3 projesinde LCP (Largest Contentful Paint) 10 saniyeyi geçtiğinde, kullanıcı sayfayı terk ediyor, conversion düşüyor, Google PageSpeed kırmızı çıkıyor. Bizim senaryo tam buydu — e-ticaret client'ı, Nuxt 3 + Vue 3, Cloudflare Pages üzerinde deploy. İlk ölçümler: LCP 10.2s, TBT 2190ms, CLS 0.18. Dört haftalık sprint sonunda: LCP 1.9s, TBT 220ms, CLS 0.02. Bu yazıda hangi değişiklikler hangi sayıları ürettiğini adım adım gösteriyoruz.

## Teşhis: LCP'yi Öldüren Üç Şey

İlk adım Chrome DevTools'da Performance tab + Coverage analysis. Bulgu:

| Kategori | Boyut | Bloke Süresi |
|---|---|---|
| Google Fonts (Poppins, 6 weight) | 142 KB | 1.8s network + render |
| Hero section hydration | 89 KB JS | 2.4s main thread block |
| Above-the-fold görseller (WebP) | 320 KB | 1.2s decode |

LCP elementi hero section'daki H1 + image. Font yüklenene kadar text invisible (FOIT), hydration bitene kadar interaction yok, image decode edene kadar layout shift. Üç katman, üçü de LCP'ye doğrudan yazıyor.

İkinci bulgu: Cloudflare Pages'in default cache policy static asset'leri 2 saat cache'liyor ama HTML'i etmiyor. Her request origin'e gidiyor, SSR her seferinde koşuyor. Edge'de cache yoksa LCP baseline'ı 400ms üstünde başlıyor.

## Self-Hosted Fonts: 1.8s Network Latency Silmek

Google Fonts'tan kurtulmak = 1 DNS lookup + 1 handshake + 1 round-trip silmek. Poppins'in 6 weight'ini `fontsource` paketinden yükledik:

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

Font dosyaları artık `/_nuxt/` altında bundle'da. Ancak boyut sorunu: 142 KB → 168 KB (woff2 subset eksikliği). Subset'i manuel çıkardık:

```bash
pyftsubset Poppins-Regular.ttf \
  --output-file=Poppins-Regular-Latin.woff2 \
  --flavor=woff2 \
  --unicodes=U+0020-007F,U+00A0-00FF
```

Final boyut: 168 KB → 52 KB. LCP'ye etkisi: **10.2s → 8.1s** (2.1s kazanç).

Tradeoff: Build time +18s, bundle size +52 KB. Kabul edilebilir — kullanıcı latency'si > developer latency.

## Lazy Hydration: Main Thread'i Kurtarmak

Nuxt 3'te hydration default'ta eager — tüm component'ler mount sırasında interactive hale gelir. Bizim hero section'da 4 component var:

- `HeroHeadline.vue` (H1 + subtitle)
- `HeroImage.vue` (responsive image + lazy load)
- `HeroButton.vue` (CTA, tracking event bağlı)
- `HeroStats.vue` (3 sayısal gösterge, animated counter)

Bu dördü hydrate olurken 2.4s main thread bloke. Oysa kullanıcı ilk 800ms'de sadece headline + image görüyor. `nuxt-lazy-hydrate` paketi ile selective hydration:

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

  <HeroHeadline /> <!-- eager, kritik content -->
  <HeroImage />    <!-- eager, LCP elementi -->
</template>
```

`when-idle`: requestIdleCallback, browser boştayken hydrate. `when-visible`: IntersectionObserver, viewport'a girince.

Sonuç: TBT 2190ms → 680ms. LCP'ye dolaylı etkisi: **8.1s → 5.4s** (main thread serbest kalınca render pipeline hızlandı).

Tradeoff: CTA'ya ilk tıklama 120ms gecikmeli olabilir (hydration henüz bitmemişse). A/B test'te bounce'a etkisi %0.2 — kabul edilebilir.

## content-visibility: CSS ile Layout Shifti Durdurmak

Hero section altında 6 component daha var (testimonial slider, feature grid, FAQ accordion). Bunlar fold altında ama DOM'da mevcut, layout hesabı yapılıyor. CSS `content-visibility: auto` ile render'ı defer ediyoruz:

```css
.below-fold-section {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* tahmini yükseklik, CLS önlemek için */
}
```

`content-visibility: auto`: browser, viewport dışındaki element'leri render etmez. `contain-intrinsic-size`: element'in boyutunu tahmini olarak verir, scroll position hesabı doğru kalır (yoksa CLS sıçrar).

Component seviyesinde uygulamak için directive:

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

CLS: 0.18 → 0.04. LCP'ye dolaylı etkisi: **5.4s → 3.8s** (layout thrash azaldı, main thread daha erken serbest).

Tradeoff: `contain-intrinsic-size` yanlış tahmin edilirse scroll jump yaşanabilir. Her section için gerçek yüksekliği ölçüp hardcode ettik.

## Edge Caching: Origin Latency'yi Silmek

Cloudflare Pages'te SSR her request'te koşuyor. Ortalama origin latency: 420ms (Avrupa edge → ABD origin). Cache strategy:

```typescript
// server/middleware/cache.ts
export default defineEventHandler((event) => {
  const url = event.node.req.url
  if (url === '/' || url.startsWith('/kategori/')) {
    event.node.res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
  }
})
```

`s-maxage=300`: edge'de 5 dakika cache. `stale-while-revalidate=600`: cache expire olunca 10 dakika boyunca eski versiyon serve et, background'da revalidate.

Cloudflare Workers'ta ek logic:

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

Cache hit rate 3 günde %89'a çıktı. Origin request'ler %11'e düştü. LCP'ye etkisi: **3.8s → 1.9s** (edge latency 12ms, origin 420ms yerine).

Tradeoff: Fresh content 5 dakika gecikmeli. E-ticaret için kabul edilebilir (fiyat değişimi kritik değil). Stok sayısı client-side fetch ile real-time tutuyoruz.

## Headless Commerce Altyapısı ve UI/UX

Bu optimizasyonları yaparken [Headless Commerce](https://www.roibase.com.tr/tr/headless) mimarisinin esnekliği kritikti — Shopify Storefront API + Nuxt SSR, her katmanı bağımsız optimize etmeye izin verdi. Monolitik yapılarda font değiştirmek bile deployment gerektirir, bizde sadece `nuxt.config.ts` güncelledik.

Ayrıca [UI/UX Tasarım](https://www.roibase.com.tr/tr/ui-ux) tarafında LCP elementi seçimi bilinçli yapılmıştı — hero image yerine headline LCP olarak işaretlendi, böylece font optimizasyonu doğrudan etkili oldu.

## Sayılarla Final Durum

| Metrik | Başlangıç | Final | Değişim |
|---|---|---|---|
| LCP | 10.2s | 1.9s | -81% |
| TBT | 2190ms | 220ms | -90% |
| CLS | 0.18 | 0.02 | -89% |
| FCP | 3.4s | 0.8s | -76% |
| Bundle size (fonts) | 142 KB | 52 KB | -63% |
| Cache hit rate | 0% | 89% | — |

PageSpeed Mobile score: 34 → 92. Desktop: 68 → 98.

Conversion rate etkisi (4 hafta A/B test): baseline %2.1 → optimized %2.8 (+33%). Bounce rate: %58 → %41.

## Kararlar ve Tradeoff'lar

Dört optimizasyon, dört farklı tradeoff:

1. **Self-hosted fonts:** Build time +18s, maintenance (subset güncellemesi) artıyor. Kazanç (2.1s LCP) > maliyet.
2. **Lazy hydration:** İlk interaction'da 120ms gecikme riski. Bounce'a etkisi minimal (%0.2), kabul edilebilir.
3. **content-visibility:** Scroll jump riski var ama `contain-intrinsic-size` ile kontrol altında. CLS kazancı kritik.
4. **Edge caching:** Fresh content 5 dakika gecikmeli. E-ticaret için sorun yok, stok client-side.

Hiçbir optimizasyon bedava değil. Ölç, test et, tradeoff'u kabul et ya da etme.

Nuxt 3 + Cloudflare Pages kombinasyonu performans için ideal zemin — SSR, edge caching, modular architecture. Ancak default config ile LCP 10s olabilir. Yukarıdaki dört adım, herhangi bir Nuxt projesinde tekrarlanabilir. Sayılar yalan söylemez: self-hosted fonts + lazy hydration + content-visibility + edge caching = 81% LCP düşüşü. Şimdi kendi projenizde Chrome DevTools'u açın, LCP elementini bulun, yukarıdaki recipe'yi uygulayın.