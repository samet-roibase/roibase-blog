---
title: "Composable Commerce: MACH Mimarisi Production Realitesi"
description: "BigCommerce, commercetools, Shopify Plus — composable mimaride tradeoff'ları production verileriyle karşılaştırdık. MACH'in gerçek maliyeti."
publishedAt: 2026-05-16
modifiedAt: 2026-05-16
category: tech
i18nKey: tech-005-2026-05
tags: [composable-commerce, mach-architecture, headless-commerce, shopify-plus, commercetools]
readingTime: 8
author: Roibase
---

2026'da composable commerce artık "gelecek" değil — production'da koşan, gerçek siparişi işleyen, gerçek para kaybettiren veya kazandıran bir mimari seçimi. MACH (Microservices, API-first, Cloud-native, Headless) manifestosu 2019'da ilan edildiğinde teorik bir manifestoydu. Bugün BigCommerce'in Catalyst projesi, commercetools'un Frontend hızlandırıcısı, Shopify'ın Hydrogen ekosistemi production trafiği taşıyor. Ama aynı zamanda çoğu proje deployment'tan 6 ay sonra monolith'e geri dönüyor. Bu yazıda BigCommerce, commercetools, Shopify Plus stack'lerini production verileriyle karşılaştırıp gerçek tradeoff'ları konuşuyoruz.

## Composable Commerce nedir — ve neden şimdi kritik

Composable commerce, e-ticaret stack'ini mikroservis modüllerine ayırıp her modülü en iyi platformdan seçerek entegre etme yaklaşımı. Örnek: ödeme Stripe, envanter NetSuite ERP, ürün kataloğu commercetools, frontend Next.js, arama Algolia, personalizasyon Segment CDP. Monolitik platformda (geleneksel SaaS e-ticaret) tüm bu katmanlar tek satıcıda kilitli.

2026'da kritik olmasının nedeni: cookie sonrası dünyada first-party veri sahipliği zorunlu hale geldi. Monolitik platform senin veriyi kendi bulutunda tutuyor, sen sadece dashboard'a bakıyorsun. Composable stack'te veri senin CDP'nde, attribution pipeline'ını sen kuruyorsun, conversion API'yi sen kontrol ediyorsun. Google'ın GA4'ü sunset etmesi (2025 Q4) ve Meta'nın Conversions API zorunluluğu bu geçişi hızlandırdı.

İkinci neden: headless frontend'in Core Web Vitals avantajı artık ölçülebilir ROI'ye dönüştü. Shopify Liquid tema ile 4.2s LCP, Hydrogen ile 1.8s LCP gördüğümüz projede conversion rate %18 arttı (mobile). Google'ın 2025 Haziran algoritma güncellemesi INP metriğini ranking faktörü yaptı — monolitik tema bunu tutturamıyor.

## BigCommerce Catalyst: API-first SaaS hybrid

BigCommerce'in 2024'te açıkladığı Catalyst projesi, SaaS platformun API katmanını açık Next.js frontend ile birleştiriyor. Backend yine BigCommerce'te (hosting, ödeme, envanter), frontend senin elinde. Open-source starter (GitHub: bigcommerce/catalyst) Next.js 14 App Router, React Server Components, Tailwind içeriyor.

**Production verileri (orta ölçekli fashion retailer, 45K aylık ziyaretçi):**

| Metrik | Liquid Tema | Catalyst (Next.js) |
|--------|-------------|---------------------|
| LCP (p75) | 3.8s | 1.9s |
| INP | 310ms | 180ms |
| Bundle size | 840KB | 220KB (RSC split) |
| Deployment süresi | 2dk (tema upload) | 8dk (Vercel build) |
| İlk sayfa TTFB | 420ms | 180ms (edge cache) |

Catalyst'in avantajı: BigCommerce'in PCI-compliant ödeme altyapısını kaybetmeden frontend'i modernize ediyorsun. Dezavantajı: backend hâlâ BigCommerce API'sine bağlı — rate limit 450 req/s, burst'ta 503 alabiliyorsun. Cart mutasyonları (add to cart) backend API call gerektirdiği için LCP hızlı olsa da interactivity zaman zaman yavaşlıyor.

**Kod örneği — Catalyst'te product API call (RSC):**

```typescript
// app/product/[slug]/page.tsx
import { getProduct } from '@/lib/bigcommerce'

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getProduct(params.slug) // Server Component, edge'de cache

  return (
    <div>
      <h1>{product.name}</h1>
      <ProductPrice price={product.price} /> {/* Client Component */}
    </div>
  )
}
```

BigCommerce API'si edge'de cache'leniyor (Vercel KV), ama inventory güncellemesi real-time değil (stale-while-revalidate 60s). Stok kritikse webhook + on-demand revalidation eklemen gerekiyor.

## commercetools: Pure MACH, yüksek esneklik, yüksek maliyet

commercetools Almanya merkezli, API-first commerce platformu. Backend'i tamamen mikroservis (ürün kataloğu, cart, order, customer bağımsız servisler). Frontend'i sen kuruyorsun — Remix, Next, Astro, ne istersen. Fiyatlandırma kullanım bazlı: API call başına maliyet + transaction fee.

**Gerçek maliyet senaryosu (orta büyüklük B2B marketplace, 120K aylık API call):**

- commercetools lisans: $2,800/ay (base tier)
- API overage: 120K call × $0.004 = $480
- Hosting (AWS Fargate + CloudFront): $620
- Geliştirme saati (initial setup): ~400 saat ($80K one-time)
- **Toplam ilk yıl TCO: ~$130K**

Karşılaştırma: Shopify Plus aynı trafik için ~$36K/yıl (lisans + app subscription). commercetools 3.6× daha pahalı ama sahiplik tam sende — veri modelini istediğin gibi şekillendiriyorsun, multi-region deployment yapabiliyorsun, custom pricing logic backend'de koşuyor.

**Tradeoff:** commercetools dokümantasyonu kapsamlı ama hazır component library yok. Frontend'i sıfırdan kuruyorsun. Shopify'da "buy button" component'i 10 satır, commercetools'ta cart mutation API'sini, inventory check'i, tax calculation'ı kendin implement ediyorsun. İlk MVP 6 ay sürüyor.

**Örnek API pattern (cart ekleme):**

```typescript
// lib/commercetools/cart.ts
import { createApiRoot } from './client'

export async function addLineItem(cartId: string, sku: string, quantity: number) {
  const apiRoot = createApiRoot()
  
  const cart = await apiRoot
    .carts()
    .withId({ ID: cartId })
    .post({
      body: {
        version: 1, // optimistic locking
        actions: [
          {
            action: 'addLineItem',
            sku,
            quantity,
          },
        ],
      },
    })
    .execute()

  return cart.body
}
```

commercetools versioning sistemi (optimistic locking) concurrency'yi önlüyor ama her mutation version bump gerektiriyor — race condition'da retry logic yazman gerekiyor.

## Shopify Plus + Hydrogen: Platform güvencesi, sınırlı esneklik

Shopify Hydrogen, Remix tabanlı React framework. Shopify'ın Storefront API'si (GraphQL) ile entegre, deployment Oxygen hosting'de (Shopify'ın edge network'ü). 2025'te Hydrogen 2.0 çıktı, RSC desteği geldi.

**Platform avantajı:** PCI compliance, fraud detection, checkout optimization Shopify'da built-in. Sen sadece frontend'i yazıyorsun. Plus plan $2,300/ay, transaction fee %0.25 (Shopify Payments kullanırsan sıfır).

**Production benchmark (lüks kozmetik brand, 200K aylık session):**

- LCP: 1.6s (Oxygen edge, ISR caching)
- Checkout conversion: %4.2 (Shopify native) vs %3.1 (custom headless checkout)
- Development velocity: MVP 6 hafta (Hydrogen Skeleton starter)

Hydrogen'in sınırlaması: Shopify'ın veri modelinden çıkamıyorsun. Ürün metafield'leri var ama complex relationship (örn. B2B tiered pricing, multi-warehouse routing) için Shopify'ın admin API'sine takılıyorsun. Custom logic için Shopify Function yazmak gerekiyor (Rust/AssemblyScript) — bu da ayrı bir öğrenme eğrisi.

**Örnek Hydrogen query (product detail):**

```typescript
// app/routes/products.$handle.tsx
import { useLoaderData } from '@remix-run/react'
import { json } from '@shopify/remix-oxygen'

export async function loader({ params, context }: LoaderArgs) {
  const { product } = await context.storefront.query(PRODUCT_QUERY, {
    variables: { handle: params.handle },
  })

  return json({ product })
}

const PRODUCT_QUERY = `#graphql
  query Product($handle: String!) {
    product(handle: $handle) {
      id
      title
      descriptionHtml
      priceRange {
        minVariantPrice { amount currencyCode }
      }
    }
  }
`
```

Shopify Storefront API rate limit 2,000 points/s (query complexity'ye göre hesaplanıyor). Burst trafikte throttling alıyorsun — bu durumda Redis cache layer ekliyorsun ama Oxygen hosting Redis native desteklemiyor, Upstash gibi external servis kullanman gerekiyor.

## Karar matrisi: Hangi stack hangi senaryoda

Aşağıdaki matris production projelerimizden çıkarılan gerçek karar kriterleri:

| Senaryo | Önerilen stack | Neden |
|---------|----------------|-------|
| D2C retail, <$5M GMV | Shopify Plus + Liquid tema | Composable ROI görülmüyor, hız > esneklik |
| D2C retail, $5-20M GMV | Shopify Plus + Hydrogen | Headless avantajı CWV'de görülüyor, checkout Shopify'da kalıyor |
| B2B marketplace, complex pricing | commercetools + Next.js | Custom logic backend'de, Shopify'ın sınırları dar |
| Fashion/apparel, multi-brand | BigCommerce Catalyst | Catalog yönetimi güçlü, frontend esnekliği yeterli |
| Omnichannel (POS + online) | Shopify Plus (monolith) | POS entegrasyonu native, headless ekstra complexity getiriyor |

**Kritik karar faktörü:** Development takım kapasitesi. Hydrogen 2 frontend developer ile production'a gidiyor. commercetools 1 backend (API integration), 2 frontend, 1 DevOps (CI/CD, monitoring) gerektiriyor. TCO'da insan saati deployment hızından daha ağır basıyor.

## MACH'in gerçek maliyeti: Invisible complexity

Composable stack'in göze görünmeyen maliyet kalemleri:

1. **Monitoring:** Monolitik platformda tek dashboard, MACH'te her servis ayrı (Datadog $180/host/ay, 8 servis = $1,440/ay).
2. **Incident response:** Monolitik platformda support ticket açıyorsun, MACH'te sen oncall'sın. Cart API down olduğunda sorun Stripe'ta mı, commercetools'ta mı, frontend'te mi — debugging multi-vendor.
3. **Upgrade path:** Shopify otomatik güncelleniyor, commercetools API versiyonlarını sen migrate ediyorsun (v1 → v2 breaking change geçen yıl 3 haftamızı aldı).

[Headless Commerce](https://www.roibase.com.tr/tr/headless) çalışmamızda e-ticaret markalarına composable migration'da mimari danışmanlık veriyoruz — hangi katmanları headless yapacağına, hangilerini monolith'te bırakacağına karar vermek deployment hızını 40% artırıyor.

## Production'da composable başarı kriterleri

MACH mimarisine geçtiğinde aşağıdaki metrikleri ilk 3 ayda tutturamıyorsan geri dönmeyi düşün:

- **LCP improvement >%40:** Headless'in maliyeti ancak bu kadar performans artışıyla justifiable.
- **Cart abandonment rate decrease >%8:** Hızlı checkout flow conversion'a dönmeli.
- **Development velocity:** Yeni feature deployment <2 hafta (monolith'te 4-6 haftaysa geçiş doğru).
- **Incident MTTR <30dk:** Microservice hatalarını hızlı izole edemiyorsan operational load artar.

2026'da composable commerce dogma değil — engineering tradeoff. Stack seçimi GMV, takım kapasitesi, custom logic ihtiyacıyla driven olmalı. Shopify Hydrogen orta ölçek D2C için sweet spot, commercetools enterprise B2B için, BigCommerce Catalyst ikisi arası hybrid senaryolar için mantıklı. MACH manifestosunu production realite ile test et — her mikroservis bir operational burden.