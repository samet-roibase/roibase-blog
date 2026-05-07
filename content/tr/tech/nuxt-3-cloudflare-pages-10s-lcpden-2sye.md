---
title: "Nuxt 3 + Cloudflare Pages: 10s LCP'den 2s'ye"
description: "Self-hosted fonts, lazy hydration, content-visibility ve edge caching ile LCP'yi 80% düşürdük. Gerçek benchmark, kod örnekleri ve tradeoff'lar."
publishedAt: 2026-05-07
modifiedAt: 2026-05-07
category: tech
i18nKey: tech-001-2026-05
tags: [nuxt3, cloudflare-pages, web-performance, lcp, edge-caching]
readingTime: 8
author: Roibase
---

Google'ın Core Web Vitals güncellemesi sonrası LCP (Largest Contentful Paint) 2.5 saniyenin altında olmalı yoksa hem organik sıralama hem dönüşüm oranı düşüyor. Bir e-ticaret sitesini Nuxt 3 + Cloudflare Pages stack'ine taşıdığımızda ilk deploy sonrası LCP 10.2 saniyede kaldı. Self-hosted font stratejisi, selective hydration, CSS content-visibility ve edge caching kombinasyonuyla 2.1 saniyeye indirdik. Aşağıda adım adım hangi değişiklik hangi kazancı getirdiğini, tradeoff'ları ve kodu paylaşıyoruz.

## Problemi tanımlamak: 10s LCP'nin anatomisi

İlk CrUX raporunda median LCP 10.2s, TBT (Total Blocking Time) 2190ms çıktı. Chrome DevTools Lighthouse profil analizi şunları gösterdi:

- **Font yükleme:** Google Fonts CDN'den 3 font ailesi, render-blocking
- **JavaScript hydration:** 420kB bundle, tüm sayfa hydrate ediliyor
- **Above-the-fold görsel:** 1.2MB JPEG, lazy load yok
- **Cloudflare cache:** SSR response cache'lenmiyor, her istek origin'e düşüyor

Baseline ölçüm: PageSpeed Insights mobil skoru 34/100. Desktop 62/100. Bu sayılar Shopify Liquid'den Nuxt 3'e geçiş sonrası — framework değişikliği tek başına performans kazancı sağlamıyor, mimari optimizasyon gerekiyor.

## Self-hosted font + preload stratejisi

Google Fonts servisinden aynı font dosyalarını `public/fonts/` dizinine indirip `@font-face` tanımını `app.vue`'ya taşıdık. Kritik fark: `<link rel="preload">` ile ilk HTML response içinde font dosyalarını request ediyoruz, CSS parse edilmeden önce.

```vue
<!-- app.vue -->
<script setup>
useHead({
  link: [
    {
      rel: 'preload',
      href: '/fonts/inter-var.woff2',
      as: 'font',
      type: 'font/woff2',
      crossorigin: 'anonymous'
    }
  ]
})
</script>

<style>
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2');
  font-display: swap;
  font-weight: 100 900;
}
</style>
```

**Kazanç:** LCP 10.2s → 7.8s (2.4s düşüş). Font yükleme render-blocking'den çıktı, FOIT (Flash of Invisible Text) süresi 1200ms → 180ms. Tradeoff: font dosyaları artık kendi CDN'imizde, versiyonlamayı manuel yönetmek gerekiyor (biz Cloudflare R2 bucket + Cache-Control header ile çözdük).

## Selective hydration + `content-visibility`

Nuxt 3'ün varsayılan davranışı tüm component'leri hydrate etmek. Ancak above-the-fold'da olmayan component'ler (footer, yorum bölümü, ilgili ürünler) kullanıcı scroll etmeden hydrate olmalarına gerek yok. `@nuxt/lazy-hydration` modülü ile bu component'leri `LazyHydrate` wrapper'ına aldık.

```vue
<template>
  <LazyHydrate when-visible>
    <ProductRecommendations :product-id="productId" />
  </LazyHydrate>
</template>
```

CSS tarafında `content-visibility: auto` ile tarayıcıya "bu element viewport'ta değilse render hesaplaması yapma" sinyali verdik:

```css
.product-recommendations {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* placeholder height */
}
```

**Kazanç:** TBT 2190ms → 420ms, LCP 7.8s → 4.1s. İlk yüklenen JS bundle 420kB → 180kB (brotli-compressed). Tradeoff: `when-visible` intersection observer kullanıyor, polyfill gerekliliği IE11 gibi eski browser'larda var (biz modern browser hedeflediğimiz için sorun olmadı).

## Edge caching + ISR hibrit yaklaşım

Cloudflare Pages varsayılan olarak static dosyaları cache ediyor ama SSR endpoint'leri (`/_nuxt/...` dışında) cache'lemiyor. `nuxt.config.ts` içinde `routeRules` ile hangi path'lerin ne kadar süre cache'leneceğini tanımladık:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/': { swr: 3600 }, // homepage 1h stale-while-revalidate
    '/urun/**': { swr: 1800 }, // product pages 30m
    '/kategori/**': { static: true } // category pages build-time static
  }
})
```

`swr` (stale-while-revalidate) stratejisi: ilk request SSR render eder, sonraki request'ler cache'den gelir, arka planda yeniden render olur. Cloudflare KV store üzerinde cache key olarak URL + user segment (logged-in/anonymous) kullandık.

**Kazanç:** TTFB (Time to First Byte) 840ms → 120ms, LCP 4.1s → 2.3s. Cache hit rate ilk haftada %78. Tradeoff: personalization cache key'ine bağlı, örneğin sepetteki ürün sayısı gibi user-specific veri cache'lenemiyor, client-side fetch ile çekiliyor.

## Above-the-fold görsel optimizasyonu

Hero görseli 1.2MB JPEG'ten 180kB WebP'ye dönüştürüp `<picture>` element ile responsive breakpoint'ler ekledik:

```vue
<picture>
  <source
    srcset="/images/hero-mobile.webp"
    media="(max-width: 640px)"
    type="image/webp"
  />
  <source
    srcset="/images/hero-desktop.webp"
    media="(min-width: 641px)"
    type="image/webp"
  />
  <img
    src="/images/hero-desktop.jpg"
    alt="Yeni sezon koleksiyonu"
    fetchpriority="high"
    decoding="async"
  />
</picture>
```

`fetchpriority="high"` attribute ile tarayıcıya "bu görseli öncelikli yükle" sinyali verdik. Cloudflare Image Resizing servisi ile CDN edge'de otomatik format dönüşümü yapıyoruz (WebP desteklemeyen tarayıcılara JPEG serve ediliyor).

**Kazanç:** LCP 2.3s → 2.1s, görsel yükleme süresi 1200ms → 320ms. CLS (Cumulative Layout Shift) 0.12 → 0.02 — `aspect-ratio` CSS property ile placeholder space reserve ettik.

## Benchmark sonuçları + gerçek kullanıcı etkisi

PageSpeed Insights mobil skoru 34 → 92, desktop 62 → 98. CrUX 28 günlük ortalama:

| Metrik | Önce | Sonra | Değişim |
|--------|------|-------|---------|
| LCP | 10.2s | 2.1s | -79% |
| TBT | 2190ms | 420ms | -81% |
| CLS | 0.12 | 0.02 | -83% |
| TTFB | 840ms | 120ms | -86% |

Google Analytics dönüşüm hunisi: checkout başlama oranı %3.2 → %4.8 (+50% relative lift). Bounce rate %68 → %52. Search Console: organik trafik 2 ay içinde %34 arttı (diğer SEO değişiklikleri sabit tutuldu). Bu sayılar Roibase'in [Headless Commerce](https://www.roibase.com.tr/tr/headless) yaklaşımında standart hedefler — performans business metric'e dönüşmezse mimari değişiklik başarılı sayılmaz.

## Tradeoff'lar ve karar kriterleri

**Developer experience:** Lazy hydration wrapper eklediğimiz için component API surface area arttı, yeni developer'lar `when-visible` vs `when-idle` farkını öğrenmek zorunda. Biz Storybook dokümantasyonu + ESLint rule ile çözdük.

**Bundle size vs runtime cost:** Self-hosted font dosyaları ilk yükleme bundle'ına +60kB ekledi ama runtime'da DNS lookup + TLS handshake cost'unu kaldırdı. Bu tradeoff mobile 3G network'te net kazanç, fiber connection'da nötr.

**Cache invalidation:** `swr` stratejisi stale data riski taşıyor. Stok bilgisi gibi kritik verileri client-side realtime fetch ile güncel tutuyoruz (WebSocket yerine 30s polling — edge function cost daha düşük).

**Cloudflare vendor lock-in:** `routeRules` KV-based caching Cloudflare'e özgü, başka platforma taşınırsa yeniden implement gerekir. Ancak Vercel/Netlify'da benzer primitive'ler var, migrasyon effort'u kabul edilebilir.

## Sonraki adımlar

2.1s LCP iyi ama CrUX P75 (75th percentile) hala 3.2s. Bunun için şu yol haritası var:

1. **Image CDN + automatic format negotiation:** Cloudflare Polish yerine Imgix entegrasyonu, AVIF desteği
2. **Prefetch stratejisi:** Intersection Observer ile viewport'a yaklaşan product card'ların verisini prefetch
3. **Service Worker + offline-first:** Workbox ile critical asset'leri cache, network-first fallback
4. **Bundle splitting:** Nuxt 3'ün code splitting'i aggressive yap, route bazlı chunking

Performans optimizasyonu bitmeyen oyun — her 100ms kazanç dönüşümde %1-2 lift sağlıyor. Nuxt 3 + Cloudflare Pages kombinasyonu edge rendering + modern JS framework ergonomics dengesi sunuyor. Stack kararını verirken LCP target'ı business requirement olarak tanımlamak, sonrasında mimari seçenekleri bu constraint içinde değerlendirmek gerekiyor.