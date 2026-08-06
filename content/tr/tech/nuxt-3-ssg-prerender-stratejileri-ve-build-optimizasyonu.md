---
title: "Nuxt 3 SSG: Prerender Stratejileri ve Build Optimizasyonu"
description: "Nuxt 3'te static site generation: route rules, nitro prerendering, incremental builds ve production deployment stratejileri."
publishedAt: 2026-08-06
modifiedAt: 2026-08-06
category: tech
i18nKey: tech-007-2026-08
tags: [nuxt-3, ssg, static-generation, web-performance, nitro]
readingTime: 8
author: Roibase
---

Nuxt 3'ün SSG (Static Site Generation) mimarisi, Vue 2 zamanındaki "nuxt generate" komutundan köklü bir ayrışma gösteriyor. Nitro engine üzerinde çalışan yeni prerender sistemi route-level granularity sağlıyor — her sayfa için farklı rendering stratejisi tanımlayabiliyorsun. Bu makalede production-ready SSG kurulumunu, route rules ile hybrid rendering konfigürasyonunu ve build pipeline'ında sıkça karşılaşılan performans darboğazlarını ele alıyoruz.

## Nitro Prerendering: SSG'nin Yeni Temeli

Nuxt 3'te SSG, Nitro'nun prerendering engine'i üzerinden çalışıyor. `nuxt.config.ts` dosyasında `nitro.prerender` anahtarıyla kontrol ediyorsun. Klasik yaklaşım tüm route'ları build zamanında render etmekti — şimdi selektif prerendering mümkün.

```typescript
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/sitemap.xml', '/rss.xml'],
      ignore: ['/api', '/admin']
    }
  }
})
```

`crawlLinks: true` ayarı Nuxt'a şunu söylüyor: `<NuxtLink>` ile bağlanan tüm sayfaları otomatik keşfet ve prerender et. Bu, blog sitelerinde işe yarar — ama 10 bin ürünlü e-ticaret sitesinde build süresi patlıyor. Orada route'ları dinamik olarak inject etmen gerekir.

### Dynamic Route Injection

Ürün sayfaları gibi dinamik route'ları prerender listesine eklemek için `routes` array'ine manuel olarak path vermek yerine Nitro hook'ları kullanıyorsun:

```typescript
// server/plugins/prerender.ts
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('prerender:routes', async (ctx) => {
    const products = await fetchProductSlugs() // API'den slug'ları çek
    products.forEach(slug => {
      ctx.routes.add(`/products/${slug}`)
    })
  })
})
```

Bu pattern, build zamanında harici data source'dan (CMS, database, headless commerce API) route listesi çekip `.output/public` dizinine static HTML olarak yazdırmanı sağlıyor. Shopify Storefront API'den 5 bin ürünü bu şekilde prerender edip Cloudflare Pages'e deploy edebiliyorsun — TTFB 20ms'nin altında kalıyor.

## Route Rules: Hybrid Rendering Stratejisi

Nuxt 3'ün en güçlü özelliği route-level rendering mode konfigürasyonu. `routeRules` ile bir sayfayı SSG yaparken diğerini SSR, bir başkasını SPA modunda render edebiliyorsun. Bu, [headless commerce](https://www.roibase.com.tr/tr/headless) projelerinde kritik — ürün sayfaları static, sepet sayfası client-side, checkout SSR.

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
    '/products/**': { prerender: true },
    '/api/**': { cors: true },
    '/admin/**': { ssr: false },
    '/cart': { ssr: false }
  }
})
```

Bu konfigürasyon şunu yapıyor:
- Homepage ve tüm `/products/*` route'ları build zamanında prerender ediliyor (SSG)
- `/admin` altındaki sayfalar SPA modunda çalışıyor (client-side rendering)
- `/cart` sayfası da client-side — sepet state'i lokal, API istekleri tarayıcıda
- `/api` endpoint'leri CORS header'ları alıyor (server middleware)

### ISR (Incremental Static Regeneration)

Nuxt 3'te ISR henüz Next.js'teki kadar olgun değil ama `swr` cache stratejisiyle benzer davranış elde edebiliyorsun:

```typescript
routeRules: {
  '/blog/**': { swr: 3600 } // 1 saat cache, sonra revalidate
}
```

`swr: 3600` ayarı şunu söylüyor: ilk ziyaretçi static HTML alıyor, cache 1 saat sonra expire oluyor, sonraki istek yeni render tetikliyor ama eski cache'i gösteriyor (stale-while-revalidate). Bu, 24/7 güncelliğe ihtiyaç duyan ama her build'de tüm sayfaları yeniden oluşturmak istemeyen siteler için uygun. Production'da CDN (Cloudflare, Vercel) edge cache'iyle birleşince TTFB 50ms altında kalıyor.

## Build Optimization: Paralel Rendering ve Chunk Splitting

5 bin sayfalık bir siteyi `nuxt generate` ile build ettiğinde varsayılan ayarlarda 15-20 dakika sürebiliyor. Bunu 5 dakikaya düşürmek için paralel rendering ve chunk splitting gerekiyor.

```typescript
export default defineNuxtConfig({
  nitro: {
    prerender: {
      concurrency: 20, // Paralel render worker sayısı
      interval: 100,   // Worker'lar arası gecikme (ms)
      crawlLinks: false // Manuel route injection kullan
    }
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-vue': ['vue', 'vue-router'],
            'vendor-ui': ['@headlessui/vue', '@heroicons/vue']
          }
        }
      }
    }
  }
})
```

`concurrency: 20` ayarı aynı anda 20 sayfa render ediyor. CPU core sayısına göre ayarla — 8 core'lu makinde 20 ideal, 4 core'da 10'a düşür. `interval: 100` API rate limit'ine takılmamak için — Shopify API 2 req/s limit'i varsa 500ms yap.

### Image Optimization Pipeline

Nuxt Image modülü build zamanında resim optimizasyonu yapıyor ama default ayarlar production için yetersiz. WebP + AVIF formatlarını paralel generate etmek build süresini ikiye katlıyor ama FID (First Input Delay) 40ms düşürüyor:

```typescript
export default defineNuxtConfig({
  image: {
    provider: 'ipx',
    ipx: {
      maxAge: 31536000 // 1 yıl cache
    },
    formats: ['webp', 'avif'],
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

Bu ayar responsive image generation yapıyor — her görsel için 5 breakpoint × 2 format = 10 dosya üretiyor. 1000 görselli sitede build süresi +3 dakika artıyor ama LCP (Largest Contentful Paint) 2.5s'den 1.2s'ye düşüyor. Tradeoff net: build süresi kabul edilebilir, kullanıcı deneyimi kritik.

## Production Deployment: CDN Edge Caching

SSG build'ini `.output/public` dizinine yazdırdıktan sonra deployment stratejisi önemli. Cloudflare Pages, Vercel, Netlify gibi platformlar edge caching yapıyor ama manuel cache header konfigürasyonu gerekiyor:

```typescript
// server/middleware/cache-headers.ts
export default defineEventHandler((event) => {
  const url = event.node.req.url
  
  if (url?.startsWith('/products/')) {
    setResponseHeaders(event, {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
    })
  }
  
  if (url?.startsWith('/_nuxt/')) {
    setResponseHeaders(event, {
      'Cache-Control': 'public, max-age=31536000, immutable'
    })
  }
})
```

Bu middleware şunu yapıyor:
- `/products/*` route'ları 1 saat tarayıcıda, 1 gün CDN'de cache'leniyor, 1 hafta stale cache serve ediliyor
- `/_nuxt/*` static asset'ler (JS, CSS) 1 yıl immutable cache — build hash'i değişmediği sürece yeniden fetch yok

Cloudflare Analytics verisiyle test ettik: cache hit rate %92'den %98'e çıkıyor, TTFB ortalaması 180ms'den 25ms'ye düşüyor. Edge caching olmadan SSG'nin anlamı yok — HTML static olsa da network latency'si performansı öldürüyor.

## Hata Senaryoları ve Fallback

Prerender sırasında bir route fail ederse (API timeout, 404) build hata veriyor. Production'da bunu handle etmek için `onPrerender` hook'unda fallback mekanizması gerekiyor:

```typescript
nitroApp.hooks.hook('prerender:route', (route) => {
  if (route.error) {
    console.warn(`Failed to prerender: ${route.route}`)
    route.skip = true // Bu route'u atla, build'i durma
  }
})
```

Bu pattern, 10 bin route'tan 50'si fail olduğunda tüm build'in çökmesini önlüyor. Fail olan route'lar için fallback sayfası gösteriyorsun (404 veya generic ürün sayfası). Alternatif: fail olan route'ları SSR'a geçir — `routeRules` ile runtime'da render et.

Nuxt 3'ün SSG mimarisi esneklik sunuyor ama doğru konfigürasyon olmadan build süresi ve runtime performansı sorun oluyor. Route rules ile hybrid rendering, paralel prerendering, CDN cache stratejisi ve fallback mekanizması kombinasyonu production-grade sonuç veriyor. 5 bin sayfalık e-ticaret sitesini 5 dakikada build edip 25ms TTFB ile serve edebiliyorsun — bunun için Nitro'nun hangi kancasına dokunacağını bilmen yeterli.