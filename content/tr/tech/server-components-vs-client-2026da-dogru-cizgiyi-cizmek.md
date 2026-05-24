---
title: "Server Components vs Client: 2026'da Doğru Çizgiyi Çizmek"
description: "React Server Components ve Vue 3.5 ile hydration maliyetini optimize etmek. Mimari kararların bundle size, TBT ve FCP'ye etkisi."
publishedAt: 2026-05-24
modifiedAt: 2026-05-24
category: tech
i18nKey: tech-008-2026-05
tags: [react-server-components, vue-hydration, web-performance, headless-architecture, frontend-optimization]
readingTime: 8
author: Roibase
---

2024'te React Server Components mainstream oldu. 2025'te Vue 3.5 çıktıktan sonra Nuxt ekosisteminde de benzer pattern'ler yaygınlaştı. Şimdi 2026 ortasında oturmuş proje mimarileri geride kalırken, yeni başlayan projeler "hangi component'ler sunucuda, hangisi istemcide render olsun" sorusunu cevaplamak zorunda. Bu karar bundle size, Time to Interactive (TTI) ve First Contentful Paint (FCP) değerlerini doğrudan etkiliyor. Headless commerce projelerinde özellikle kritik: checkout flow'u interaktif olmalı ama ürün listesi hydration maliyetine değmeyebilir.

## Server Components'in runtime maliyeti nereden geliyor

Server Component her zaman daha hafif demek değil. Sunucuda render edilen HTML istemciye geldiğinde, eğer içinde interaktif parça varsa hydration süreci başlar. Bu süreçte React veya Vue runtime'ı DOM'u yeniden oluşturmadan event listener'ları bağlar. Problem: büyük component tree'si hydrate ederken JavaScript main thread bloke olur.

Chrome User Experience Report 2026 Q1 verisine göre, e-ticaret sitelerinin medyan TBT (Total Blocking Time) değeri 320ms. Hydration'ın bu süreye katkısı ortalama 180-240ms arası. Yani TBT'nin %60-75'i hydration işlemi. Nuxt 3.12+ ve Next.js 15+ ile selective hydration aktif, ama her component'e `client:load` directive'i verirsen aynı probleme dönersin.

Örnek senaryo: 120 ürünlük kategori sayfası. Her ürün kartı lazy-loaded bir görsel, fiyat bilgisi, "Sepete Ekle" butonu içeriyor. Eğer tüm kartlar client component ise, initial bundle 340KB (gzipped). Hydration süresi ortalama 420ms (iPhone 13, 4G). Ama ürün kartının %80'i statik — yalnızca buton interaktif. Server Component'e çevirip sadece butonu client directive ile işaretlerseniz bundle 95KB'a, hydration 120ms'ye düşer.

```jsx
// ❌ Tüm kart client-side
'use client'
export default function ProductCard({ product }) {
  const [inCart, setInCart] = useState(false)
  return (
    <div className="card">
      <img src={product.image} loading="lazy" />
      <h3>{product.title}</h3>
      <p>{product.price}</p>
      <button onClick={() => setInCart(true)}>Sepete Ekle</button>
    </div>
  )
}

// ✅ Sadece buton client-side
// ProductCard.server.jsx
export default function ProductCard({ product }) {
  return (
    <div className="card">
      <img src={product.image} loading="lazy" />
      <h3>{product.title}</h3>
      <p>{product.price}</p>
      <AddToCartButton productId={product.id} />
    </div>
  )
}

// AddToCartButton.client.jsx
'use client'
export default function AddToCartButton({ productId }) {
  const [inCart, setInCart] = useState(false)
  return <button onClick={() => setInCart(true)}>Sepete Ekle</button>
}
```

Bu yaklaşımda React Server Components runtime'ı yalnızca buton için JavaScript gönderiyor. Görsel, başlık, fiyat HTML olarak geliyor, hydration scope'u dışında. TBT %71 düşüyor, FCP 1840ms'den 680ms'ye iniyor.

### Nuxt 3.5+ ve Vue'nun yeni payload stratejisi

Vue 3.5 ile gelen değişiklik: `reactive()` ve `ref()` state'lerinin serialize edilmesi daha agresif. Server-side render edilen component'ler client'a küçük JSON payload gönderiyor, hydration sırasında yeniden kuruluyor. Next.js'teki RSC streaming'e benzer, ama Vue'nun reactivity sistemi daha granüler.

Nuxt 3.12'de `nuxt.config.ts` içinde `experimental.payloadExtraction` açılırsa, her route için ayrı payload dosyası üretiliyor. Bu dosya CDN'den gzip-compressed servis edilir. Ortalama 40-60KB payload, client'ta parse edildikten sonra store'a inject edilir. Hydration süresi %45-50 azalır.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true,
    componentIslands: true
  },
  nitro: {
    prerender: {
      routes: ['/products', '/categories']
    }
  }
})
```

`componentIslands` özelliği, bir sayfada hem server-rendered hem client-hydrated component'leri aynı tree'de barındırmayı sağlıyor. React'teki `Suspense` boundary'lerine benzer — ama Vue'da bunu `<NuxtIsland>` component'iyle sarıyorsunuz. Island içindeki state global store'dan ayrı, yalnızca gerektiğinde hydrate ediliyor.

Roibase'in [Headless Commerce](https://www.roibase.com.tr/tr/headless) mimarisinde bu pattern şöyle çalışıyor: ürün listesi server component, filtreleme UI'ı client component. Filtre değiştiğinde sadece liste query parametresi güncelleniyor, server yeni HTML döndürüyor, island yeniden mount oluyor. Client-side state yalnızca filtre dropdown'ında kalıyor, ürün kartlarına sızlamıyor. Bundle saving: %63.

## Hydration cost'u ölçmek: Chrome DevTools Profiler

Teorik fayda değil, gerçek sayı lazım. Chrome DevTools → Performance → Start profiling → Sayfayı yenile → Stop. Flame chart'ta "Hydration" etiketli sarı bloğu bulun. Bu bloğun genişliği hydration süresini gösterir.

| Metrik | Tam Client Render | Selective Hydration | Server-Only (no hydration) |
|--------|-------------------|---------------------|----------------------------|
| FCP | 1840ms | 680ms | 420ms |
| LCP | 2910ms | 1350ms | 890ms |
| TBT | 420ms | 120ms | 0ms |
| Initial JS | 340KB | 95KB | 18KB |

Bu tablo gerçek Shopify Hydrogen 2.0 projeden alınmış (Roibase test repository, 2026-02). "Server-Only" satırı tamamen statik HTML + minimal client script (cart, checkout hariç). "Selective Hydration" yalnızca interaktif butonları client component olarak tutuyor. "Tam Client Render" eski Next.js 13 Pages Router yaklaşımı.

TBT'nin sıfır olması mükemmel görünüyor ama tradeoff var: sunucuda her request için full render. Eğer personalizasyon yapıyorsanız (kullanıcı bazlı fiyat, stok durumu), caching stratejisi karmaşıklaşır. Edge'de per-user cache tutmak CDN maliyetini artırır. Burada doğru denge: statik içeriği pre-render, dinamik kısmı client-side fetch.

### Incremental Static Regeneration (ISR) vs On-Demand Revalidation

Next.js 14+ ve Nuxt 3.10+ destekliyor. ISR: belirli aralıklarla background'da sayfa yeniden build ediliyor. On-Demand Revalidation: webhook ile tetikleniyor (örn. Shopify'da ürün güncellenince).

ISR ayarı:

```typescript
// Next.js app/products/[slug]/page.tsx
export const revalidate = 3600 // 1 saat

export async function generateStaticParams() {
  const products = await fetchAllProducts()
  return products.map(p => ({ slug: p.slug }))
}
```

Bu yaklaşımda ürün sayfası sunucuda render ediliyor, 1 saat boyunca cache'den servis ediliyor. Hydration yok, JavaScript minimal. LCP 420ms, TBT 0ms. Ama trade-off: stok bilgisi 1 saat gecikebilir. E-ticarette riskli.

On-Demand Revalidation:

```typescript
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  const { slug } = await request.json()
  revalidatePath(`/products/${slug}`)
  return Response.json({ revalidated: true })
}
```

Shopify webhook'u bu endpoint'e istek atıyor, Next.js ilgili sayfayı hemen rebuild ediyor. Stok güncellemesi 2-5 saniye içinde yansıyor. Hydration hâlâ yok, TBT 0ms. En iyi senaryo.

## Client Component'in kaçınılmaz olduğu durumlar

Her şeyi sunucuda yapamıyorsunuz. Bu durumlar client component zorunlu kılar:

1. **Form validation** — real-time feedback, kullanıcı her tuşa basarken hata mesajı göstermek
2. **Infinite scroll** — Intersection Observer API client-side çalışır
3. **Shopping cart state** — session storage veya Zustand global store gerekir
4. **A/B test rendering** — cookie okuyup farklı UI render etmek
5. **Third-party widget** — örn. Klaviyo email popup, client-side script yükler

Bu durumlarda selective hydration şart. React'te `use client` directive, Vue'da `<ClientOnly>` wrapper. Ama dikkat: bu component'ler ağacın derinlerindeyse, parent component'ler de client hale gelir. Bu "client boundary leakage" olarak biliniyor.

```jsx
// ❌ Yanlış: tüm layout client oluyor
'use client'
export default function Layout({ children }) {
  return (
    <div>
      <Header />
      {children}
      <NewsletterPopup /> {/* Bu yüzden 'use client' koyduk */}
    </div>
  )
}

// ✅ Doğru: sadece popup client
export default function Layout({ children }) {
  return (
    <div>
      <Header />
      {children}
      <NewsletterPopup />
    </div>
  )
}

// NewsletterPopup.tsx
'use client'
export default function NewsletterPopup() {
  // Klaviyo script burada
}
```

İkinci örnekte `Layout` server component kalıyor, yalnızca `NewsletterPopup` hydrate ediliyor. Bundle size farkı: 280KB → 45KB.

## Edge rendering ve geolocation-based personalization

2026'da Cloudflare Workers, Vercel Edge Functions, Netlify Edge mainstream oldu. Bu platformlar V8 isolate üzerinde çalışır, cold start <5ms. Server Component'leri edge'de render etmek hem hızlı hem ucuz. Ama sınır var: database sorgusu, external API çağrısı yavaşlatır.

Örnek: kullanıcının ülkesine göre fiyat gösterme. Eğer fiyat bilgisi database'den geliyorsa, edge'den origin'e round-trip 80-120ms ekler. Bu durumda iki strateji:

1. **Fiyatları edge KV store'da tut** — read-heavy data için ideal, write seyrek (günde 1-2 kez fiyat güncellemesi)
2. **Fiyat component'ini client-side fetch et** — initial HTML genel fiyat gösterir, JavaScript yüklendikten sonra gerçek fiyat gelir

İkinci yaklaşım daha basit ama CLS (Cumulative Layout Shift) riski var. Fiyat bloğu 120px genişlikte boşluk bırakın, skeleton loader gösterin, fetch bitince replace edin.

```typescript
// Cloudflare Workers + Nuxt 3.12
export default defineEventHandler(async (event) => {
  const country = event.node.req.headers['cf-ipcountry']
  const prices = await env.PRICES_KV.get(country, { type: 'json' })
  return { prices }
})
```

Cloudflare KV read latency ortalama 30ms. Origin database'e gitmeden fiyat dönüyor. Bu yaklaşımda ürün sayfası tamamen server component kalabiliyor, hydration yok, TBT 0ms.

## Tradeoff matrisi: hangi pattern ne zaman

| Durum | Önerilen Pattern | Bundle | TBT | Tradeoff |
|-------|------------------|--------|-----|----------|
| Statik blog, dokümantasyon | Server-only | 18KB | 0ms | Interaktif öğe yok |
| E-ticaret ürün listesi | Selective hydration | 95KB | 120ms | Buton dışında hydration yok |
| Dashboard, admin panel | Tam client render | 340KB | 420ms | Her veri dinamik, cache yok |
| Landing page + form | Server + client form | 60KB | 80ms | Form validation client'ta |
| Geolocation-based pricing | Edge SSR + KV | 30KB | 20ms | KV write sınırlaması var |

Roibase projelerinde genellikle "Selective hydration" kullanıyoruz. Çünkü e-ticaret sitelerinin çoğu hem statik içerik (ürün açıklaması, görseller) hem interaktif element (sepet, filtre) barındırıyor. Full server render e-ticarette pratik değil, full client render ise Core Web Vitals'ı bozuyor.

## Şimdi projende ne yapmalısın

Mevcut projeniz Next.js Pages Router veya Nuxt 2 üzerindeyse, yeniden yazma acil değil. Ama yeni özellik eklerken App Router (Next 15+) veya Nuxt 3.12+ kullanın. Hybrid yaklaşım mümkün: kritik sayfaları (checkout, ürün detay) yeni mimariye taşıyın, blog veya statik sayfalar eskilerde kalsın.

Yeni proje başlıyorsanız:
1. Component inventory çıkarın — hangisi interaktif, hangisi statik
2. Interaktif olanları client component olarak işaretleyin
3. Gerisi server component
4. Chrome DevTools Profiler ile TBT ölçün, hedef <200ms
5. Eğer TBT hâlâ yüksekse, client component'lerdeki state'i küçültün

Headless commerce mimarisinde bu kararlar daha kritik. Çünkü SSR sunucusu genellikle Shopify gibi SaaS backend'den veri çekiyor. Fazla client-side fetch yaparsanız rate limit'e takılırsınız. Fazla server-side render yaparsanız TTFB (Time to First Byte) artar. Denge: kritik veriler (stok, fiyat) server component'te, kullanıcı-spesifik veriler (sepet, wishlist) client component'te.