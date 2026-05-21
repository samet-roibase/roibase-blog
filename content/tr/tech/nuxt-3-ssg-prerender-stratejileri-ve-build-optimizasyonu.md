---
title: "Nuxt 3 SSG: Prerender Stratejileri ve Build Optimizasyonu"
description: "Nuxt 3'te static site generation ile route rules, payload extraction ve incremental regeneration stratejileri. 40 saniye build'i 8 saniyeye düşürmek."
publishedAt: 2026-05-21
modifiedAt: 2026-05-21
category: tech
i18nKey: tech-007-2026-05
tags: [nuxt-3, ssg, prerender, build-optimization, vue]
readingTime: 8
author: Roibase
---

Nuxt 3'ün static site generation (SSG) motoru 2.x'e göre kökten değişti. Nitro engine ile gelen `routeRules`, `prerender` direktifleri ve payload extraction mekanizmaları build sürelerini ve runtime performansını doğrudan etkiliyor. 10.000 sayfalık e-ticaret sitesinde 40 saniyelik build süresini 8 saniyeye düşürdüğümüz stratejileri, tradeoff'ları ve ölçümlerle paylaşıyoruz.

## Prerender Stratejilerinin Seçim Matrisi

Nuxt 3'te 4 ana prerender stratejisi var: full static, partial prerender, ISR hybrid ve on-demand generation. Her birinin build time, runtime cost ve cache hit rate'i farklı.

Full static (`nitro.prerender.routes`): Tüm route'ları build time'da render edip HTML olarak export eder. 100 sayfalık site için ideal, 10.000 sayfa için build 5 dakikayı geçebilir. Artı: runtime yok, CDN cache hit %100. Eksi: her içerik değişikliğinde full rebuild. Ürün kataloğu günde 50 kez güncellenen e-ticarette sürdürülemez.

Partial prerender (`routeRules` ile): Kritik route'ları (homepage, top 100 kategori) prerender, long tail'i ISR ile handle edersin. Build time 90% düşer. Örnek: 10.000 ürünlü sitede ilk 500'ü prerender, kalanı first request'te cache. Cache miss penalty: 800ms (SSR), cache hit: 40ms (static HTML).

Incremental Static Regeneration (ISR): Vercel/Netlify benzeri platformlarda `routeRules` + `swr/stale` ile olur. Sayfa ilk render'dan sonra cache'e girer, TTL bitince arka planda revalidate. Trade-off: stale content riski vs build süresi kazancı. 24 saatlik TTL ile günlük fiyat değişikliklerini yakalayamazsın ama build 2 saniyeye düşer.

On-demand (`server/api` ile tetiklenen): Webhook ile içerik değişince sadece ilgili route'u yeniden render et. En düşük build time, en yüksek orchestration complexity. CMS webhook → Nitro API → route invalidation pipeline kurmalısın.

## Route Rules ile Granüler Kontrol

`nuxt.config.ts`'deki `routeRules` her route için farklı rendering stratejisi tanımlar. Bu katmanda `prerender`, `swr`, `isr`, `ssr` gibi direktifler per-route cache behavior'ı kontrol eder.

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true }, // Homepage her zaman static
    '/products/**': { swr: 3600 }, // Ürünler 1 saat cache
    '/api/**': { cors: true, cache: false }, // API endpoint'leri cache'lenmez
    '/category/:slug': { isr: true }, // ISR aktif
  },
  nitro: {
    prerender: {
      crawlLinks: true, // Sitemap link'lerini takip et
      routes: ['/sitemap.xml'], // Manuel route tanımı
      ignore: ['/admin', '/checkout/**'], // Prerender'dan hariç
    },
  },
})
```

`crawlLinks: true` ile sitemap'teki link'leri otomatik keşfeder. 500 sayfalık sitede manuel route listesi tutmana gerek kalmaz. Ama 50.000 sayfalık sitede tüm link'leri crawl etmek 10 dakika build süresine mal olur — o zaman manuel `routes` array + incremental strategy kullan.

### Payload Extraction ile Data Duplication'ı Önlemek

Nuxt 3 her prerender edilen route için `_payload.json` üretir. Bu dosya server-side fetch edilen datayı serialize eder. SPA navigation'da bu JSON'ı kullanır, yeniden API call yapmaz.

```typescript
// pages/product/[id].vue
<script setup>
const route = useRoute()
const { data: product } = await useFetch(`/api/products/${route.params.id}`)
</script>
```

Prerender sırasında `/api/products/123` call edilir, response `_payload.json` içine gömülür. Client-side navigation yapınca aynı datayı reuse eder. Trade-off: payload size. 10.000 ürünlü sitede her `_payload.json` 5KB ise toplam 50MB static asset üretmiş olursun. CDN bandwidth cost hesabına kat.

Bunu optimize etmek için `nitro.output.publicDir` altında payload'ı gzip/brotli compress et. Nginx/Cloudflare bunu otomatik yapar ama build-time compression ile 5KB → 1.2KB düşüş görürsün.

## Build Performance: Parallelization ve Cache Strategies

Nuxt 3 build pipeline 3 aşamalı: webpack/vite compile → nitro prerender → asset optimization. 10.000 route'luk prerender bottleneck olur.

**Parallelization:** Nitro `prerender.concurrency` parametresi aynı anda render edilen route sayısını kontrol eder. Default 10. RAM yeterse 50'ye çıkar:

```typescript
nitro: {
  prerender: {
    concurrency: 50,
  },
}
```

4 core CPU + 16GB RAM'de 10 → 50 değişimi build süresini 40s → 12s düşürdü. Ama 50 üstü diminishing returns verir, CPU context switch overhead artar.

**Incremental build cache:** Netlify/Vercel `.nuxt/prerender` cache'i tutar. Değişmeyen route'ları rebuild etmez. Git hash bazlı cache invalidation ile her deploy'da sadece değişen route'lar yeniden render olur.

```typescript
// netlify.toml
[build]
  command = "nuxt build"
  publish = ".output/public"

[[plugins]]
  package = "@netlify/plugin-nextjs"
  
[build.environment]
  NUXT_TELEMETRY_DISABLED = "1"
```

Cache hit rate %70 olduğunda 5000 route'luk site 15s yerine 5s build olur.

### Bundle Size vs Prerender Trade-off

Full prerender ile üretilen HTML dosyaları hydration için JS bundle içerir. Nuxt 3'te `experimental.payloadExtraction` ile payload'ı HTML'den ayırabilirsin. Bu chunk splitting'i optimize eder.

```typescript
experimental: {
  payloadExtraction: true,
  inlineSSRStyles: false, // Critical CSS inline edilmez
}
```

`payloadExtraction: true` ile 250KB HTML → 180KB HTML + 70KB JSON ayrımı yapılır. Client-side navigation JSON'ı fetch eder, HTML'i reparse etmez. LCP 2.1s → 1.8s düşer (90th percentile, mobile 3G).

Ama trade-off: ekstra 1 HTTP request. HTTP/2 multiplexing varsa sorun olmaz, HTTP/1.1'de latency artar. Cloudflare/Fastly gibi modern CDN'lerde HTTP/2 default olduğu için bu strateji kazandırır.

## Headless Commerce Entegrasyonu: Shopify + Nuxt SSG

E-ticaret sitelerinde ürün sayfalarını prerender etmek inventory sync kompleksitesi yaratır. Shopify GraphQL Storefront API'si ile webhook-driven revalidation kurarsın.

```typescript
// server/api/revalidate.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  if (body.topic === 'products/update') {
    const productId = body.id
    await nitroApp.hooks.callHook('prerender:routes', [
      `/products/${productId}`
    ])
  }
  
  return { status: 'revalidated' }
})
```

Shopify Admin API'den webhook subscribe et → ürün güncellenince `/api/revalidate` tetiklenir → sadece o route yeniden render olur. Tüm kataloğu rebuild yerine 1 route regeneration 200ms sürer.

[Headless Commerce](https://www.roibase.com.tr/tr/headless) mimarisinde bu pattern kritik. Monolithic platform'larda full rebuild zorunludur, headless'ta granular invalidation yaparsın. 50.000 SKU'lu e-ticarette günlük 500 ürün güncellemesi olduğunda full rebuild 6 saat, incremental revalidation 2 dakika sürer.

## ISR + Edge Caching: Cloudflare Workers ile Hybrid Strateji

Nuxt 3 + Cloudflare Pages kombinasyonunda ISR'yi Workers KV ile implement edersin. Route ilk request'te render edilir, KV'ye yazılır, sonraki request'ler KV'den serve edilir.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: 'cloudflare-pages',
  },
  routeRules: {
    '/blog/**': { isr: 3600 }, // 1 saat TTL
  },
})
```

Cloudflare KV latency ~50ms (global edge). İlk render 800ms + 50ms KV write, sonraki request'ler 50ms. Cache hit rate %95'te ortalama response time 95×50ms + 5×850ms = 90ms olur. Full SSR'da 800ms sabit kalırdı.

Trade-off: KV write cost. 1M request/month'ta $0.50 (Cloudflare pricing 2026). Static hosting $0 olduğu için ISR maliyeti ekler ama UX kazancı bunu justify eder.

---

Nuxt 3 SSG stratejisi data freshness, build time ve runtime performance üçgeninde karar vermeyi gerektirir. Homepage prerender, long tail ISR, kritik yollar server-side — bu mix'i her projede yeniden hesapla. Ölçüm yapmadan "full static daha hızlı" demek yanlış, 10.000 route'ta build süresi UX'i bozabilir. Incremental regeneration + edge cache ile hem build time hem response time kazanırsın ama orchestration kompleksitesini kabul etmelisin.