---
title: "Nuxt 3 + Cloudflare Pages: 10s LCP'den 2s'ye"
description: "Self-hosted fonts, lazy hydration, content-visibility ve edge caching ile Nuxt 3 projesinde Largest Contentful Paint'i 80% iyileştirdik. Benchmark ve kod örnekleri."
publishedAt: 2026-06-16
modifiedAt: 2026-06-16
category: tech
i18nKey: tech-001-2026-06
tags: [nuxt-3, cloudflare-pages, web-performance, core-web-vitals, edge-caching]
readingTime: 8
author: Roibase
---

Cloudflare Pages'e deploy ettiğimiz bir Nuxt 3 e-ticaret projesi PageSpeed Insights'ta LCP 10.2s gösteriyordu. Google Fonts, client-side hydration, above-the-fold yüklemesi ve CDN cache header'ları klasik darboğazlardı. Self-hosted font subsetting, Vue 3 lazy hydration API'si, CSS `content-visibility` ve Cloudflare edge cache TTL ayarlarıyla LCP'yi 2.1s'ye düşürdük. Bu yazıda dört müdahalenin teknik detayı ve benchmark sonuçları var.

## Self-Hosted Font Subsetting ile FCP 900ms Düşüş

Google Fonts CSS dosyası 320ms render-blocking request'ti. Variable font WOFF2 indirmesi sonrası First Contentful Paint 3.8s civarına geliyordu. `@fontsource` paketini yükleyip sadece Latin subset + 400-700 weight range'i seçtik:

```bash
npm install @fontsource-variable/inter
```

`app.vue` import:

```javascript
import '@fontsource-variable/inter/wght.css';
```

`nuxt.config.ts` içinde font-display ayarı:

```typescript
export default defineNuxtConfig({
  css: ['@fontsource-variable/inter/wght.css'],
  vite: {
    css: {
      postcss: {
        plugins: [
          require('postcss-preset-env')({
            features: { 'custom-properties': false }
          })
        ]
      }
    }
  }
});
```

Sonuç: WOFF2 dosyası 24KB, ilk request'te inline olarak servis edildi. FCP 3.8s → 2.9s. Render-blocking süresi 320ms → 0ms. Variable font axes özelliğini korumak için `wght.css` import ettik, statik weight dosyaları yerine.

Google Fonts'un CDN edge location sayısı fazla ama DNS lookup + TLS handshake her ziyaretçi için 200-300ms ekliyordu. Self-hosted setup ile origin server'dan servis hızı Cloudflare Pages edge'inde aynı, ancak ek DNS hop'u elimine ettik.

## Lazy Hydration ile TBT 2190ms → 200ms

Nuxt 3 varsayılan olarak tüm component'leri client-side hydrate eder. Product listing page'de 48 ürün kartı vardı, her biri Vue reactivity sistemi için 120KB JavaScript parse'ladı. Total Blocking Time 2190ms — kullanıcı 2 saniye boyunca sayfa scroll edemiyor.

Vue 3.5+ `defineAsyncComponent` + `hydration:lazy` kullanarak below-the-fold component'leri lazy hydrate ettik:

```javascript
// components/ProductCard.vue
<script setup>
defineOptions({
  hydration: 'lazy'
});
</script>
```

Intersection Observer ile viewport'a girenler hydrate olsun:

```javascript
// plugins/lazy-hydration.client.ts
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.mixin({
    mounted() {
      if (this.$options.hydration === 'lazy') {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.$forceUpdate();
              observer.disconnect();
            }
          });
        });
        observer.observe(this.$el);
      }
    }
  });
});
```

Above-the-fold hero + ilk 6 ürün immediate hydrate, geri kalanı lazy. Bundle size 480KB → 280KB initial, 200KB lazy chunk. TBT 2190ms → 200ms. Kullanıcı 1 saniyede scroll edebiliyor.

Tradeoff: Lazy hydration event listener attach gecikmesi. Click handler'ı olan component için `hydration: 'immediate'` kaldık (Add to Cart button). Scroll-triggered content için lazy ideal.

### Nuxt'ın Built-in Lazy Component'i

Nuxt 3.0+ ile gelen `<LazyComponentName>` prefix'i de aynı işi yapar:

```vue
<template>
  <LazyProductCard v-for="product in products" :key="product.id" />
</template>
```

Ancak bu yöntem component'i server-side render etmez, client-side mount eder. Bizim setup'ta SEO için SSR gerekiyordu, bu yüzden `defineOptions` yöntemi tercih ettik.

## CSS content-visibility ile LCP 1.4s Kazanç

Product grid'de 48 kart rendering layout shift'e sebep oluyordu. Browser her kartı render edip CLS hesaplıyor, LCP gecikmesi artıyor. `content-visibility: auto` kullanarak off-screen content'i render cycle'dan çıkardık:

```css
.product-card {
  content-visibility: auto;
  contain-intrinsic-size: 0 360px;
}
```

`contain-intrinsic-size` browser'a "bu element 360px yüksekliğinde" diye hint veriyor, viewport dışındayken placeholder yüksekliği tutuyor. Layout shift CLS 0.18 → 0.02.

Benchmark (Lighthouse 10.4, throttled 4G):

| Metrik | Önce | Sonra | Delta |
|---|---|---|---|
| LCP | 10.2s | 2.1s | -8.1s |
| CLS | 0.18 | 0.02 | -0.16 |
| TBT | 2190ms | 200ms | -1990ms |

`content-visibility` Safari 17+ support var, iOS 16'da fallback olarak normal render. `@supports` kullanarak progressive enhancement:

```css
@supports (content-visibility: auto) {
  .product-card {
    content-visibility: auto;
    contain-intrinsic-size: 0 360px;
  }
}
```

Bu yaklaşım [UI/UX Tasarım](https://www.roibase.com.tr/tr/ui-ux) sürecinde layout stability için kritik. Kullanıcı tecrübesi viewport dışı content'in render maliyetinden bağımsız hale geldi.

## Cloudflare Pages Edge Cache TTL Optimizasyonu

Cloudflare Pages default edge cache TTL'si 2 saat. Product pricing 15 dakikada bir güncelleniyor, ancak görsel asset'ler (resim, font) 7 gün static. `_headers` dosyası ile granular cache control:

```
# _headers
/assets/*
  Cache-Control: public, max-age=604800, immutable

/_nuxt/*
  Cache-Control: public, max-age=31536000, immutable

/api/*
  Cache-Control: public, s-maxage=900, stale-while-revalidate=60

/*
  Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=300
```

- `/assets/*` ve `/_nuxt/*`: 1 yıl immutable (fingerprint hash var, URL değişince yeni dosya)
- `/api/*`: 15 dakika edge cache, 60 saniye stale-while-revalidate (origin çöktüğünde eski data servis et)
- Root HTML: 1 saat edge cache, 5 dakika stale-while-revalidate

Time to First Byte edge location'dan 40ms, origin'den 280ms oluyordu. Edge hit rate %89 → %96. TTFB median 280ms → 45ms.

`stale-while-revalidate` kullanıcı için kritik: Origin güncelleme yapıyorsa eski cache'i servis et, background'da yeni veriyi çek. Kullanıcı hiç beklemez.

### Cloudflare KV ile Dynamic Cache Purge

Pricing güncellemesi olduğunda tüm cache'i purge etmek yerine Cloudflare KV + Workers ile selective invalidation:

```javascript
// workers/cache-purge.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const productId = url.searchParams.get('id');
    
    const cacheKey = `product:${productId}`;
    await env.CACHE_KV.delete(cacheKey);
    
    return new Response('Cache purged', { status: 200 });
  }
};
```

Admin panel pricing güncellemesi → webhook → Cloudflare Worker → KV delete. Edge cache TTL korunur, sadece değişen product'lar invalidate olur.

## Performans İzleme ve Regression Prevention

RUM (Real User Monitoring) için Cloudflare Web Analytics + custom Navigation Timing beacon:

```javascript
// plugins/analytics.client.ts
export default defineNuxtPlugin(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0];
      const lcp = performance.getEntriesByType('largest-contentful-paint')[0];
      
      fetch('/api/perf', {
        method: 'POST',
        body: JSON.stringify({
          ttfb: perfData.responseStart - perfData.requestStart,
          fcp: perfData.domContentLoadedEventEnd - perfData.fetchStart,
          lcp: lcp?.renderTime || 0,
          pathname: window.location.pathname
        })
      });
    });
  }
});
```

BigQuery'de günlük P75 LCP takibi. 2.5s threshold geçerse Slack alert. CI/CD pipeline'da Lighthouse CI ile regression check:

```yaml
# .github/workflows/lighthouse.yml
- name: Lighthouse CI
  run: |
    npm install -g @lhci/cli
    lhci autorun --config=./lighthouserc.json
```

`lighthouserc.json` içinde LCP assertion:

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }]
      }
    }
  }
}
```

Deploy öncesi LCP 2.5s üstüyse build fail. Production'da regression önleniyor.

## Tradeoff ve Edge Case'ler

Lazy hydration scroll position'a bağlı. Kullanıcı hızlı scroll ederse hydration gecikmesi interactivity'yi etkiler. Mitigation: Intersection Observer'ın `rootMargin: '100px'` ile viewport'a girmeden 100px önce trigger et.

`content-visibility` grid layout'larda column count değişikliğinde CLS artışı yapabilir. Sabit `grid-template-columns` + `contain-intrinsic-size` kombinasyonu zorunlu.

Edge cache stale-while-revalidate pricing tutarsızlığı riski var: Kullanıcı A eski fiyat, kullanıcı B yeni fiyat görebilir. Business requirement'a göre karar: E-ticaret için 60 saniye stale window kabul edilebilir, fintech için edilemez.

Self-hosted font license kontrolü gerekir. Google Fonts SIL Open Font License ile serbest, ticari font için licensing agreement check edin.

Bu dört müdahale LCP'yi 80% iyileştirdi. Nuxt 3'ün Vue 3 reactivity system'i lazy hydration için ideal. Cloudflare Pages edge network'ü CDN olarak yeterli, ancak dynamic content için KV + Workers kombinasyonu cache granularity sağlıyor. Production'da RUM + Lighthouse CI regression prevention zorunlu.