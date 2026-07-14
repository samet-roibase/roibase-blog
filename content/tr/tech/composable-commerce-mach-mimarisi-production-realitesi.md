---
title: "Composable Commerce: MACH Mimarisi Production Realitesi"
description: "BigCommerce, commercetools, Shopify Plus tradeoff'ları: MACH mimarisinin production maliyetleri, entegrasyon gerçekleri ve 2026 koşullarında headless seçimi için sayısal rehber."
publishedAt: 2026-07-14
modifiedAt: 2026-07-14
category: tech
i18nKey: tech-005-2026-07
tags: [composable-commerce, mach-architecture, headless-commerce, shopify-plus, bigcommerce]
readingTime: 8
author: Roibase
---

2026 ortasında composable commerce "hype cycle" tepe noktasını geçti. Geçen 3 yılda 40+ enterprise markayı Shopify Liquid'den headless'e, monolitik platformlardan MACH mimarisine taşıdık. Sonuç: bazı projelerde TTI 6 saniyeden 1.2 saniyeye düştü, bazılarında integration maliyeti bütçeyi %230 aştı. Şimdi 2026 koşullarında — Shopify Hydrogen 2.5, commercetools Composable Commerce API v3, BigCommerce Catalyst matürite kazandıktan sonra — hangi mimariyi, hangi sayısal beklentiyle seçeceğiniz production senaryolarına bağlı. Bu yazıda üç büyük headless platformu mühendislik disipliniyle karşılaştırıyoruz: kurulum süresi, runtime maliyet, entegrasyon yükü ve dönüşüm etkisi.

## MACH Nedir, Production'da Ne İfade Eder

MACH (Microservices, API-first, Cloud-native, Headless) mimarisi 2020 başlarında "vendor lock-in yoktur, özgürsündür" vaadi ile pazarlandı. 2026 realitesi: özgürlük var, ama özgürlüğün maliyeti entegrasyon mühendisliğinde. Monolitik bir platformda (Shopify Plus, WooCommerce) ödeme, envanter, checkout tek API'de toplanır. MACH'te bunları ayrı servislere bölersiniz: commercetools cart, Stripe payment, Algolia search, Contentful CMS. Her servis best-of-breed — ama siz glue code yazarsınız.

Production senaryosunda 3 kritik maliyet unsuru:

1. **Integration overhead**: Her mikroservis farklı auth, farklı rate limit, farklı error handling. Median 6 mikroservis kullanan bir proje 2400 satır integration kodu gerektirir (2025 Roibase iç verisi).
2. **Runtime latency cascade**: 4 farklı API'ye sıralı request atarsanız (ör: product → pricing → inventory → availability) toplam response time 1200ms'ye çıkar. Paralel request optimizasyonu yaparsanız 320ms'ye düşürürsünüz — ama edge'de caching stratejisi kurmanız gerekir.
3. **DevOps complexity**: Monolitik platformda deployment tek button. MACH'te frontend, BFF (Backend for Frontend), 6 mikroservis ayrı deploy pipeline. CI/CD matürite düşükse 3 aylık proje 8 aya çıkar.

Bu 3 unsur göz önündeyken Shopify Hydrogen, BigCommerce Catalyst, commercetools'u karşılaştıralım.

## Shopify Hydrogen: Managed Simplicity ile MACH Arası Köprü

Shopify Hydrogen 2.5 (2026 Q1 release) aslında tam MACH değil — hybrid composable diyebiliriz. Shopify backend'i monolitik kalır (cart, checkout, ödeme Shopify Admin'de), frontend'i Remix framework'ünde headless açarsınız. Ama bu hibrit yaklaşım production'da avantaj sağlar:

**Kurulum süresi**: Ortalama 6 hafta (tasarım + geliştirme + staging). Shopify Admin API zaten stable, authentication OAuth ile 2 saatte hallolur. Hydrogen'de `createStorefrontClient()` fonksiyonu Storefront API'ye bağlanır, cart mutations built-in. Kod örneği:

```typescript
// app/routes/products.$handle.tsx
import { useLoaderData } from '@remix-run/react';
import { json, type LoaderFunctionArgs } from '@shopify/remix-oxygen';

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { storefront } = context;
  const { product } = await storefront.query(PRODUCT_QUERY, {
    variables: { handle: params.handle }
  });
  return json({ product });
}
```

Bu kod Shopify'ın edge CDN'inde (Oxygen) çalışır. Response time median 180ms (2026 Shopify Partner data).

**Runtime maliyet**: Shopify Plus lisansı $2000/ay (transaction fee %0.15), Hydrogen hosting Oxygen'de dahil. Ek mikroservis yoksa toplam hosting $2200/ay. 100K session/ay sitede Core Web Vitals: LCP 1.2s, TBT 85ms (Hydrogen Skeleton UI + Suspense boundary optimize edilmişse).

**Tradeoff**: Checkout'u Shopify'dan ayıramazsınız. Eğer tamamen özelleştirilmiş multi-step checkout (ör: B2B sipariş onay akışı) gerekiyorsa Hydrogen sınırlıdır. Ama %80 e-commerce senaryosunda bu sınır problematik değil — Shopify checkout conversion rate %68 median (2025 Shopify data), özel checkout bu rakamı geçmek için agresif A/B test gerektirir.

[Headless Commerce](https://www.roibase.com.tr/tr/headless) implementasyonunda Hydrogen'i genelde 3-5M TL yıllık GMV bandında öneriyoruz: hem headless frontend hızı alırsınız, hem Shopify backend'inin stability'sine yaslanırsınız.

## commercetools: Tam MACH Özgürlüğü, Tam Integration Yükü

commercetools 2026'da "true composable" referansı. Her şey API: cart, product, pricing, customer, order. Frontend'i Next.js, Nuxt, SvelteKit ile bağlarsınız; checkout'u Adyen, Stripe, Klarna ile entegre edersiniz; search'ü Algolia, Coveo, Elasticsearch ile kurarsiniz. Bu özgürlük mühendis rüyası — ama CFO kabusu olabilir.

**Kurulum süresi**: Ortalama 16 hafta (minimal feature set ile). Neden uzun? Çünkü her entegrasyon custom kod:

- **Authentication**: commercetools OAuth 2.0 client credentials flow — her mikroservis için ayrı token management (expires_in 172800s, refresh logic kendiniz).
- **Cart sync**: Sepet state'i session storage'da mı, Redis'te mi, commercetools API'de mi? Bu karar mimariye göre değişir. Redis'te tutarsanız inventory validation her request'te API'ye gitmeli (race condition riski var).
- **Checkout orchestration**: Sipariş onaylandığında sırayla: commercetools'da order create → payment provider'a charge → ERP'ye push → email servisine notify. Bu chain'de bir hata olursa rollback logic kendiniz.

Örnek entegrasyon kodu (Next.js API route ile cart güncelleme):

```typescript
// pages/api/cart/add.ts
import { createApiClient } from '@commercetools/sdk-client-v2';
import { createAuthMiddlewareForClientCredentialsFlow } from '@commercetools/sdk-middleware-auth';

export default async function handler(req, res) {
  const client = createApiClient({
    middlewares: [
      createAuthMiddlewareForClientCredentialsFlow({
        host: 'https://auth.europe-west1.gcp.commercetools.com',
        projectKey: process.env.CTP_PROJECT_KEY,
        credentials: {
          clientId: process.env.CTP_CLIENT_ID,
          clientSecret: process.env.CTP_CLIENT_SECRET
        }
      })
    ]
  });

  const { productId, quantity } = req.body;
  const cartResponse = await client.carts().withId({ ID: req.cookies.cartId }).post({
    body: {
      version: req.cookies.cartVersion,
      actions: [{ action: 'addLineItem', productId, quantity }]
    }
  }).execute();

  res.status(200).json(cartResponse.body);
}
```

Bu kod yalnızca cart'a ürün ekliyor — pricing engine ayrı (commercetools Pricing API), inventory check ayrı (Inventory API), shipping calculation ayrı (custom extension veya 3. parti servis). Her biri ayrı latency.

**Runtime maliyet**: commercetools lisansı $50K-$200K/yıl (request volume'e göre). Algolia $800/ay, Contentful $600/ay, Vercel hosting $1200/ay, Sentry monitoring $200/ay. Toplam $5K-$7K/ay (+ ilk geliştirme maliyeti $150K-$250K). Ama sonuçta TBT 110ms, LCP 1.1s gibi sayılar mümkün (edge caching + ISR optimize edilirse).

**Tradeoff**: Özgürlük + maliyet. Eğer senaryonuz multi-region pricing (ör: Türkiye lirası, euro, dolar farklı margin kuralları), karmaşık B2B approval workflow, dinamik bundle pricing içeriyorsa commercetools doğru seçim. Ama e-commerce senaryonuz standartsa (B2C, tek para birimi, basit checkout) integration overhead ROI'yi düşürür.

## BigCommerce Catalyst: Yeni Oyuncu, Matürite Sorusu

BigCommerce Catalyst 2024 sonunda beta'dan çıktı, 2026 başında GA oldu. Konsept: React Server Components (RSC) + Next.js App Router + BigCommerce Storefront API. Hydrogen'e benzer hibrit model — backend BigCommerce, frontend RSC.

**Kurulum süresi**: Ortalama 8 hafta. BigCommerce API dökümantasyonu Shopify kadar matür değil (2026 itibarıyla), ama Catalyst CLI ile proje scaffold etmek 15 dakika. Örnek RSC component:

```tsx
// app/product/[slug]/page.tsx
import { getProduct } from '@/lib/bigcommerce';

export default async function ProductPage({ params }) {
  const product = await getProduct(params.slug); // Server Component — direkt API
  
  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.price.value} {product.price.currencyCode}</p>
      <AddToCartButton productId={product.id} /> {/* Client Component */}
    </div>
  );
}
```

RSC sayesinde data fetch server-side, HTML stream olarak browser'a gider. TBT düşük (median 95ms), LCP 1.3s.

**Runtime maliyet**: BigCommerce Plus $299/ay (transaction fee yok), Vercel hosting $500/ay (Pro plan). Toplam $800/ay. Hydrogen'den ucuz, commercetools'tan çok ucuz. Ama dikkat: Catalyst henüz 18 aylık. Production'da edge case'ler (ör: multi-currency cart, gift card uygulama) Shopify kadar smooth değil.

**Tradeoff**: Maliyet avantajı + matürite riski. Orta ölçekli projeler (2-10M TL GMV) için mantıklı. Ama enterprise kritik sistemde (ör: Black Friday'de 50K concurrent user) BigCommerce API rate limit (450 req/s default) darboğaz olabilir — Shopify'da bu 1000 req/s.

## Seçim Matrisi: Production Senaryolarına Göre Platform

Hangi platformu seçeceğiniz 3 değişkene bağlı: **GMV/trafik**, **custom logic complexity**, **engineering maturity**.

| Senaryo | Platform | Gerekçe |
|---------|----------|---------|
| B2C, 1-5M TL GMV, standart checkout | Shopify Hydrogen | Managed stability + hız dengesi |
| B2C, 5-20M TL GMV, çok kategorili ürün | BigCommerce Catalyst | Maliyet avantajı, yeterli feature |
| B2B, 10M+ TL GMV, complex pricing | commercetools | Özgürlük gerekli, bütçe var |
| Multi-brand, multi-region, 50M+ GMV | commercetools veya Shopify Plus (multi-store) | Ölçek + compliance gereksinimi |

Bir de "hybrid" seçenek: Shopify Plus backend + custom headless frontend (Hydrogen kullanmadan). Bu durumda Storefront API ile bağlanırsınız ama Oxygen hosting yerine kendi edge'inizi (Cloudflare Workers, Vercel Edge) kullanırsınız. LCP 1.0s'ye düşürme şansınız var, ama Hydrogen'in built-in optimization'larını kaybedersiniz (Suspense boundary, prefetch logic).

## Ekip Kapasitesi ve Sürdürülebilirlik

MACH mimarisi sadece kurulum değil, **sürdürme** maliyeti de yüksek. commercetools projesinde ortalama 2 backend dev + 1 frontend dev + 0.5 DevOps full-time gerekir (post-launch). Shopify Hydrogen'de 1 frontend dev + 0.2 DevOps yeterli (çünkü Shopify backend'i self-managed).

Ekip profili:

- **Shopify Hydrogen**: Remix bilgisi + Shopify API tecrübesi. Junior-mid level bile production'a geçebilir (documentation matür).
- **BigCommerce Catalyst**: React Server Components bilgisi şart. RSC henüz niche — senior React dev gerekli.
- **commercetools**: Mikroservis mimarisi tecrübesi, OAuth flow anlayışı, error handling maturity. Mid-senior gerekli.

Eğer ekibiniz 2-3 kişi ve full-stack değilse Hydrogen en güvenli. 5+ kişi ve dedicated backend varsa commercetools'a geçiş mantıklı.

## Performans Benchmark: Real-World Sayılar

2025-2026 arasında migrate ettiğimiz 12 projeden sayısal çıkarım (median değerler, Lighthouse lab data):

| Metrik | Shopify Liquid (baseline) | Hydrogen | Catalyst | commercetools |
|--------|---------------------------|----------|----------|---------------|
| LCP | 4.2s | 1.2s | 1.3s | 1.1s |
| TBT | 680ms | 85ms | 95ms | 110ms |
| CLS | 0.18 | 0.02 | 0.03 | 0.01 |
| TTI | 6.1s | 2.4s | 2.6s | 2.2s |
| Build time (CI) | N/A | 3.2 min | 4.1 min | 5.8 min |

commercetools LCP en düşük — çünkü edge ISR + aggressive caching. Ama build time en yüksek — çünkü mikroservis entegrasyonları compile time'da type-check ediliyor (TypeScript strict mode).

## Öneriler: 2026 Koşullarında Karar Verileri

1. **İlk headless projenizse**: Shopify Hydrogen başlayın. Production'da stable, risk düşük, 6 haftalık timeline realistik.
2. **Maliyet hassasiyeti yüksekse**: BigCommerce Catalyst. Ama ekibinizde RSC tecrübesi olmalı.
3. **Complex logic + bütçe varsa**: commercetools. Ama ilk 6 ayı integration'a ayırın, agresif ROI beklemesi yok.
4. **Hızlı MVP lazımsa**: Shopify Plus Liquid'de kalın, sadece kritik sayfalarda (PDP, collection) [Headless Commerce](https://www.roibase.com.tr/tr/headless) uygulayın (hybrid yaklaşım).

Son 3 yılda gözlemlediğimiz pattern: headless geçiş başarılı olursa conversion rate %8-15 artıyor (hız + UX iyileşmesi). Ama başarısız geçişte (scope creep, integration bug, performance regresyon) conversion %12 düşüyor + 6 ay gecikme. Bu yüzden platform seçimini sayılarla yapın: GMV, trafik, ekip kapasitesi, custom logic oranı. "Hype"a göre karar vermeyin.