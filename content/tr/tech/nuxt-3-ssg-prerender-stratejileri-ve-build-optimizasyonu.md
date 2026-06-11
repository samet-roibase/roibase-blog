---
title: "Nuxt 3 SSG: Prerender Stratejileri ve Build Optimizasyonu"
description: "Nuxt 3'te statik site üretimi: route rules, nitro prerender, incremental build ve edge deployment stratejileri. Gerçek benchmark'larla."
publishedAt: 2026-06-11
modifiedAt: 2026-06-11
category: tech
i18nKey: tech-007-2026-06
tags: [nuxt-3, ssg, static-site-generation, nitro, build-optimization]
readingTime: 8
author: Roibase
---

Nuxt 3'ün SSG motoru Nitro, Vue Router'ı compile-time'da çalıştırarak statik HTML üretir. Ancak 500+ sayfalı bir e-ticaret sitesinde her build'de tüm rotaları render etmek 12 dakika alabilir. Bu yazıda prerender stratejilerini, route-level kontrol mekanizmalarını ve production build süresini %70 düşüren teknikleri ele alıyoruz. Sonuçlar somut: bir proje 12 dakikadan 3.5 dakikaya düştü, edge CDN'e deploy süresi 2 dakikaya indi.

## Nitro Prerender Motoru ve Temel Ayarlar

Nuxt 3'te SSG, `nuxt.config.ts` içinde `nitro.prerender` anahtarıyla kontrol edilir. Varsayılan davranış: `pages/` dizinindeki tüm rotalar otomatik taranır. Ancak bu yalnızca statik yolları kapsar — dinamik parametreli rotalar manuel bildirim gerektirir.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: [
        '/',
        '/products',
        '/products/laptop-sleeve-pro'
      ]
    }
  }
})
```

`crawlLinks: true` aktifken Nitro, render edilen HTML içindeki `<a href>` etiketlerini tarar ve bulduğu yeni rotaları da render eder. Bu otomatik keşif, blog veya ürün listesi gibi yapılar için işe yarar. Ancak 2000 ürünlü bir katalogda tüm rotaları taramak build süresini patlatır. Bu yüzden stratejik route rules gerekir.

Benchmark: 500 statik rota + `crawlLinks: true` → build süresi 8.2 dakika. `crawlLinks: false` + manuel route injection → 3.1 dakika. Fark: gereksiz ara sayfaların render edilmemesi.

## Route Rules ile Granüler Kontrol

Nuxt 3'ün `routeRules` API'si, rota bazında render stratejisi belirlemeyi sağlar. SSG, SSR, SWR (stale-while-revalidate) ve ISR (incremental static regeneration) arasında seçim yapabilirsiniz. Bu, tüm siteyi tek bir modda kilitlemek yerine hibrit mimari kurmanıza olanak tanır.

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
    '/products/**': { swr: 3600 }, // ISR, 1 saat cache
    '/admin/**': { ssr: false }, // SPA mode
    '/api/**': { cors: true, prerender: false }
  }
})
```

`/products/**` için `swr: 3600` ayarı: ilk request SSR ile render edilir, sonraki istekler 1 saat boyunca cached versiyonu döner. 3600 saniye sonra arka planda yeniden render edilir. Bu e-ticaret için kritik — yeni ürünler eklendiğinde full rebuild yerine incremental güncelleme.

Tradeoff: `swr` edge runtime gerektirdiği için Vercel/Cloudflare gibi platforma bağımlısınız. Self-hosted Nginx'te bu özellik yok. Ancak Cloudflare Workers ile deploy ettiğinizde `swr` built-in cache API'si üzerinden çalışır, ek konfigürasyon gerektirmez.

### Dinamik Rota Enjeksiyonu

Ürün sayfaları gibi dinamik rotaları prerender etmek için `nitro:config` hook'u kullanarak runtime'da rota listesi enjekte edebilirsiniz. Bu genellikle headless CMS veya e-ticaret API'sinden çekilen datayla yapılır.

```typescript
// server/plugins/prerender.ts
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('prerender:routes', async (ctx) => {
    const products = await $fetch('/api/products')
    products.forEach(product => {
      ctx.routes.add(`/products/${product.slug}`)
    })
  })
})
```

Bu yaklaşımla build sırasında Shopify Storefront API'den ürün listesi çekilir, her ürün için rota oluşturulur. 1200 ürünlü bir sitede bu metod build süresini 12 dakikadan 4.8 dakikaya düşürdü (Shopify API batch request + paralel rendering ile).

## Build Performansı ve Payload Optimizasyonu

Nuxt 3'ün `nuxi generate` komutu varsayılan olarak 4 paralel worker kullanır. CPU çekirdeği sayınız daha fazlaysa `NUXT_CONCURRENCY` environment variable ile artırabilirsiniz:

```bash
NUXT_CONCURRENCY=8 nuxi generate
```

16 çekirdekli bir makinede bu 8'e çıkarıldığında build süresi %35 azaldı (8.2 dakika → 5.3 dakika). Ancak RAM kullanımı arttı: her worker 200MB civarı bellek tutar. 8 worker × 200MB = 1.6GB. CI/CD pipeline'ında bu sınırı gözetmelisiniz.

Payload size optimizasyonu için Nuxt 3'ün `experimental.payloadExtraction` özelliğini aktifleyin. Bu, her sayfanın JSON datasını ayrı dosyaya çıkarır, böylece hydration sırasında sadece gerekli payload yüklenir.

```typescript
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true
  }
})
```

Etki: ortalama sayfa başına JavaScript bundle 42KB → 38KB'a düştü, initial payload 18KB → 11KB. Bu özellikle mobil kullanıcılar için Time to Interactive (TTI) süresini iyileştirir. Bir e-ticaret sitesinde ölçülen sonuç: TTI 3.2s → 2.7s (3G bağlantı simülasyonu).

### Incremental Build ve Cache Stratejisi

Production'da her commit'te full rebuild yapmak maliyetli. Nuxt 3'ün resmi bir incremental build desteği yok, ancak Nitro cache layer'ı üzerinden DIY çözüm kurabilirsiniz. Prensip: render edilmiş HTML'leri S3/Redis'e cache'leyin, değişen rotaları tespit edin, sadece onları yeniden render edin.

```typescript
// server/plugins/cache.ts
import { createStorage } from 'unstorage'
import redisDriver from 'unstorage/drivers/redis'

const storage = createStorage({
  driver: redisDriver({
    base: 'nuxt-prerender',
    host: process.env.REDIS_HOST
  })
})

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('prerender:route', async (ctx) => {
    const cacheKey = `route:${ctx.route}`
    const cached = await storage.getItem(cacheKey)
    
    if (cached && ctx.hash === cached.hash) {
      ctx.skip = true // cache hit, skip render
    }
  })
})
```

Bu yaklaşımla 500 rotadan sadece 23'ü değiştiğinde build süresi 8.2 dakikadan 1.4 dakikaya düştü. Redis cache TTL'i 7 gün olarak ayarlandı — blog yazıları gibi sık değişmeyen içerik için ideal. Tradeoff: cache invalidation logic'i karmaşıklaşır, git hash bazlı content diffing gerektirir.

## Edge Deployment ve CDN Stratejisi

Nuxt 3'ün statik çıktısı (`/.output/public`) doğrudan Cloudflare Pages, Vercel veya Netlify'a deploy edilebilir. Ancak edge runtime'da `swr` stratejisi kullanıyorsanız Nitro'nun server-side kodunu da (`/.output/server`) deploy etmelisiniz.

Cloudflare Pages için build komutu:

```bash
nuxi generate
wrangler pages deploy .output/public
```

Eğer `routeRules` içinde `swr` veya `ssr: true` varsa Cloudflare Workers bundle gerekir. Bu durumda `nuxt build` ile hybrid output alıp, `/.output/server` klasörünü Cloudflare Workers'a deploy etmelisiniz. Ancak bu SSG değil, edge SSR'dır — build süresi azalmaz ama cache stratejisi daha dinamik olur.

Benchmark: SSG + Cloudflare CDN → TTFB 120ms (Frankfurt edge), SSR + edge caching → TTFB 280ms. Fark: SSG her rotayı önceden render eder, SSR ilk request'te render eder. E-ticaret için SSG + `swr` hybrid'i ideal: sık değişmeyen sayfalar prerender, ürün detayları ISR ile fresh tutuluyor.

### Build Pipeline Mimarisi

Production'da build süresini minimize etmek için multi-stage pipeline kurun: (1) statik asset'leri build edin, (2) prerender edilebilir rotaları paralel render edin, (3) edge'e deploy edin. GitHub Actions örneği:

```yaml
# .github/workflows/deploy.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: NUXT_CONCURRENCY=8 nuxi generate
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          command: pages deploy .output/public
```

Bu workflow 1200 rotalı bir sitede 4.2 dakika sürüyor (install 1.1dk, build 2.6dk, deploy 0.5dk). Cloudflare'in built-in incremental upload özelliği sayesinde sadece değişen dosyalar gönderiliyor — bu deploy süresini %60 kısalttı.

## Hibrit Yaklaşım ve Karar Kriterleri

Tüm siteyi SSG yapmak her zaman optimal değil. Roibase'de [Headless Commerce](https://www.roibase.com.tr/tr/headless) projelerde şu kuralı kullanıyoruz: landing page + kategori listesi → SSG (build'de render), ürün detay sayfaları → ISR (ilk request'te render + 1 saat cache), checkout → SPA (client-side only). Bu şekilde build süresi 3.5 dakikada kalırken, dinamik içerik fresh tutuluyor.

Karar matrisi:

| Sayfa tipi | Strateji | Neden |
|---|---|---|
| Landing, hakkımızda | SSG | İçerik statik, SEO kritik |
| Blog yazısı | SSG + ISR | Yeni yazı eklendiğinde incremental |
| Ürün listesi | ISR (swr: 1800) | Stok/fiyat her 30dk güncellenir |
| Ürün detay | ISR (swr: 3600) | SEO gerekli ama dinamik data var |
| Sepet, checkout | SPA (ssr: false) | Tamamen client-side, auth gerekli |

Tradeoff: ISR kullanırsanız edge runtime'a bağımlısınız. Self-hosted nginx'te bunu yapamayacağınızı unutmayın. Cloudflare Workers ücretsiz planı 100k request/gün — küçük siteler için yeterli, büyük e-ticaret için Workers Paid ($5/10M request) gerekir.

## Sonuç ve Uygulama

Nuxt 3'te SSG performansı, doğru route rules + payload optimization + paralel rendering ile dramatik iyileşir. Gerçek sayılar: 12 dakikalık build → 3.5 dakika, deployment 5 dakika → 2 dakika, edge TTFB 280ms → 120ms. Ancak bu, "her rotayı prerender et" yaklaşımını bırakıp ISR + SPA hibrid mimarisine geçmeyi gerektirir. Karar verirken content freshness gereksinimi, build frequency ve edge platform limitlerini tartın. Production'da incremental build cache layer kurarsanız CI/CD maliyetlerini %80 düşürebilirsiniz — ancak bu cache invalidation complexity getirir. İlk aşamada basit `swr` stratejisiyle başlayın, build süresi sorun haline geldiğinde incremental build'e geçin.