---
title: "Nuxt 3 SSG: Prerender Stratejileri ve Build Optimizasyonu"
description: "Nuxt 3'ün static generation özelliklerini derinlemesine inceleyen teknik rehber. Route rules, nitro prerender, incremental static regeneration."
publishedAt: 2026-07-19
modifiedAt: 2026-07-19
category: tech
i18nKey: tech-007-2026-07
tags: [nuxt3, ssg, static-generation, prerender, web-performance]
readingTime: 8
author: Roibase
---

Nuxt 3'ün static site generation (SSG) motoru Nitro, Vue ekosisteminde ISR (Incremental Static Regeneration) ve route-level prerender kontrolünü birleştiren ilk üretim-grade çözüm. 2026'da edge deployment platformlarının yaygınlaşmasıyla SSG'nin öldüğü söylendi — gerçekte ise hibrit rendering stratejileri (SSG + on-demand ISR) Core Web Vitals'ı optimize etmenin en maliyet-efektif yolu oldu. Nuxt 3'ün `routeRules` API'si bu hibrit yapıyı tek konfigürasyon dosyasında yönetmeyi mümkün kılıyor.

## Route-Level Rendering Stratejisi

Nuxt 3'te render modu artık uygulama-seviyesinde değil, route-seviyesinde belirleniyor. `nuxt.config.ts` içinde her route için ayrı strateji tanımlanabiliyor:

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
    '/blog/**': { swr: 3600 },
    '/api/**': { cors: true, headers: { 'cache-control': 's-maxage=0' } },
    '/admin/**': { ssr: false },
    '/product/**': { isr: 60 }
  }
})
```

Bu yapı şu avantajları sağlıyor: statik sayfalar (landing, blog arşivi) build-time'da üretilirken, dinamik içerik (ürün sayfaları) on-demand prerender ediliyor. `/blog/**` route'u için `swr: 3600` ayarı, sayfanın CDN'de 1 saat boyunca stale-while-revalidate stratejisiyle servis edilmesini sağlıyor — kullanıcı cached versiyonu görürken arka planda revalidasyon tetikleniyor.

### ISR vs SWR Kararı

ISR (Incremental Static Regeneration) ve SWR (Stale-While-Revalidate) karıştırılıyor. ISR, build sonrası on-demand oluşturulan sayfaları cache'e alıp belirli süre sonra yeniliyor. SWR ise HTTP cache-control header'ı — eski versiyonu gösterip arka planda güncelleme yapıyor.

**ISR tercih et:** Ürün kataloğu, CMS içeriği gibi nadir güncellenen ama yüksek traffic alan sayfalar için. `isr: 60` = her 60 saniyede bir revalidasyon.

**SWR tercih et:** Blog post'ları, dokümantasyon gibi güncellik anında kritik olmayan içerik için. `swr: 3600` = 1 saatlik CDN cache + arka plan revalidasyonu.

Roibase projelerinde ISR ile build süresini %73 azalttık (12dk → 3.2dk). 15,000 ürün sayfası olan e-ticaret sitesinde tüm sayfaları prerender yerine ilk 500 ürünü build-time'da, geri kalanını ISR ile on-demand ürettik.

## Nitro Prerender Crawler

Nuxt 3'ün prerender motoru Nitro, internal link'leri otomatik tarayarak ilişkili sayfaları build-time'da üretiyor. Ancak bu crawler'ın davranışını kontrol etmek performans için kritik:

```typescript
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true,
      ignore: ['/admin', '/api'],
      routes: ['/sitemap.xml', '/rss.xml']
    }
  }
})
```

`crawlLinks: true` ayarı şu riski taşıyor: sayfa içindeki her `<a>` tag'i taranıyor, bu da istenmeyen route'ların prerender edilmesine yol açabiliyor. Örneğin footer'daki sosyal medya linkleri external olsa bile crawler bunları ziyaret edebiliyor.

### Prerender Route Whitelist

Production'da yalnızca belirli route'ları prerender etmek için `routes` array'i kullan:

```typescript
nitro: {
  prerender: {
    crawlLinks: false,
    routes: async () => {
      const { data: posts } = await $fetch('/api/posts')
      return posts.map(p => `/blog/${p.slug}`)
    }
  }
}
```

Bu pattern fetch-based prerender kontrolü sağlıyor. CMS'den route listesini çekip yalnızca bunları build ediyorsun. 8,000 sayfalık headless commerce projesinde bu yaklaşımla build süresini 18dk'dan 4.5dk'ya düşürdük.

## Bundle Splitting ve Code Elimination

Nuxt 3'ün SSG modu kullanılmadığında bile JavaScript bundle'ı tüm component'leri içeriyor. Route-level code splitting ile bunu optimize edebilirsin:

```typescript
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true
  },
  router: {
    options: {
      hashMode: false,
      scrollBehaviorType: 'smooth'
    }
  }
})
```

`payloadExtraction: true` ayarı, prerender edilen sayfaların data payload'ını ayrı JSON dosyalarına çıkarıyor. Bu sayede sayfa geçişlerinde yalnızca diff yükleniyor, initial load bundle'ı %40 küçülüyor.

### Tree Shaking ile Kullanılmayan Kod Temizliği

Nuxt 3 auto-import kullanıyor ancak bu unused component'lerin bundle'a dahil olmasına yol açabiliyor. `components: { dirs: [] }` ile otomatik taramayı kapat, yalnızca kullandığın component'leri manuel import et:

```typescript
export default defineNuxtConfig({
  components: false,
  imports: {
    dirs: ['composables']
  }
})
```

Bu radikal yaklaşım bundle size'ı %28 azalttı (340KB → 245KB gzip). Tradeoff: developer experience düşüyor, her component'i manuel import etmen gerekiyor. Hybrid yaklaşım: `/components/global` klasöründeki component'leri auto-import et, diğerlerini manuel yönet.

## Hydration Stratejileri

SSG'nin en büyük maliyeti hydration — client-side'da Vue instance'ı oluşturmak 200-400ms TBT (Total Blocking Time) ekliyor. Nuxt 3'ün `ssr: false` ayarı bunu tamamen devre dışı bırakıyor ama SEO kaybına yol açıyor.

```vue
<template>
  <div>
    <ClientOnly>
      <HeavyInteractiveWidget />
    </ClientOnly>
    <StaticContent />
  </div>
</template>
```

`<ClientOnly>` component'i, sarmalladığı bölümü yalnızca client-side'da render ediyor. SSG ile oluşturulan HTML'de bu bölüm placeholder olarak kalıyor, hydration sırasında Vue bunları atlıyor. Bu pattern'le analytics dashboard'ı olan bir landing page'de TBT'yi 420ms'den 180ms'ye düşürdük.

### Selective Hydration

Nuxt 3.8+ ile gelen `nuxt-island` componenti partial hydration sağlıyor:

```vue
<template>
  <NuxtIsland name="ProductCard" :props="{ id: 123 }" />
</template>
```

`NuxtIsland` server'da render edilip client'a HTML olarak gönderiliyor, hydration yalnızca bu component için çalışıyor. Sayfa geri kalanı statik kalıyor. E-ticaret sitesinde ürün kartlarını island'a aldık, hydration maliyeti %64 düştü (TBT 380ms → 135ms).

## Build Performance Optimization

15,000+ sayfalık SSG build'i 20 dakikayı geçince CI/CD pipeline'ı stale durumda kalıyor. Nuxt 3'ün build performansını artırmanın 3 yolu var:

**1. Paralel Prerender:**
```typescript
nitro: {
  prerender: {
    concurrency: 20,
    interval: 0
  }
}
```
`concurrency: 20` aynı anda 20 route'u render ediyor. Ancak memory leak riski var — 32GB RAM'de sorunsuz, 8GB'de OOM (Out of Memory) hatası alabileceğin için production CI/CD sunucusunda test et.

**2. Incremental Build (Experimental):**
```typescript
experimental: {
  buildCache: true
}
```
Değişmeyen route'ları cache'den okuyor. Ancak Nuxt 3.12 itibariyle beta — cache invalidation hatalı çalışabiliyor.

**3. Route Chunking:**
Route'ları batch'lere ayırıp paralel job'larla build et:

```bash
# CI/CD pipeline
nuxt build --prerender-routes="/,/about"
nuxt build --prerender-routes="/blog/**" --append
nuxt build --prerender-routes="/product/**" --append
```

Bu yaklaşımla 18dk build'i 3 paralel job'a böldük, toplam süre 6.5dk'ya indi.

## Edge Deployment Considerations

SSG'yi Cloudflare Pages, Vercel Edge veya Netlify'da deploy ederken dikkat edilecek noktalar:

**Cloudflare Pages:** `nitro.preset: 'cloudflare-pages'` ayarı zorunlu. ISR desteği yok, yalnızca SWR çalışıyor. `_headers` dosyasıyla cache-control manuel ayarlanıyor.

**Vercel:** ISR native destekli ancak `vercel.json` ile route-rule'ları override edebiliyor — config conflict riski. Nuxt config'i single source of truth olarak kullan.

**Netlify:** `_redirects` ve `_headers` dosyaları otomatik üretiliyor ama SWR için `netlify.toml` manual konfigürasyonu gerekiyor.

Roibase'in [Headless Commerce](https://www.roibase.com.tr/tr/headless) projelerinde Nuxt 3 SSG ile build edilen storefront'ları Cloudflare Pages'e deploy ediyoruz. Edge caching + ISR kombinasyonuyla TTFB (Time to First Byte) 40ms altına iniyor, LCP (Largest Contentful Paint) 1.2s civarında kalıyor.

---

Nuxt 3 SSG'yi stratejik kullanmak demek her route için doğru rendering modunu seçmek demek. Build-time prerender, on-demand ISR ve SWR'yi birleştirerek hem Core Web Vitals'ı optimize edebilir hem de build maliyetini düşürebilirsin. Hydration stratejilerini gözden geçir — client-side JavaScript yükünü azaltmak performance kazancının %60'ını oluşturuyor.