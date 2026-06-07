---
title: "Composable Commerce: MACH Mimarisi Production Realitesi"
description: "BigCommerce, commercetools, Shopify Plus — MACH'ın vaat ettiği esneklik pratikte hangi maliyetlerle gelir? Production'da neleri göze alacaksınız?"
publishedAt: 2026-06-07
modifiedAt: 2026-06-07
category: tech
i18nKey: tech-005-2026-06
tags: [composable-commerce, mach-architecture, headless-commerce, shopify-plus, bigcommerce]
readingTime: 8
author: Roibase
---

Composable commerce 2024'ten beri pazarın "yeni kuralı" olarak satılıyor. MACH prensipleri (Microservices, API-first, Cloud-native, Headless) merkezi monolit platformların yerini alacak diye sunuluyor. Ancak production'da işler farklı: BigCommerce Catalyst bundle'ı 850kB, commercetools minimum integration cost $120k, Shopify Plus'ın composable özellikleriyse Hydrogen 2.0'ın migration zahmetiyle geliyor. Karar vermeden önce tradeoff'ları rakamlarla konuşmak gerekiyor.

## MACH Vaadinin Gerçek Faturası

Composable mimarinin çekirdek vaadi esneklik: frontend, backend, payment, search her biri bağımsız — ihtiyaç olduğunda swap edebilirsin. Ancak bu esneklik üç maliyet başlığına dönüşüyor.

**İlk maliyet: integration başlangıç süresi.** commercetools gibi API-only platformlarda frontend'den checkout'a kadar tüm deneyimi kendin kuruyorsun. Ortalama MVP: 16-20 hafta. Shopify Plus'ta aynı deneyim 4 haftada ayakta. BigCommerce'in Catalyst starter'ı orta yol: önceden kurulu Next.js + GraphQL Storefront API setup'ı var, ancak product listing page'den cart state'e tüm component'leri customize etmen gerekiyor (8-12 hafta).

**İkinci maliyet: backend coordination.** MACH ortamında her servis bağımsız — ama bunlar arasındaki state senkronizasyonu senin omuzunda. Örnek: inventory servisi (Fluent Commerce), pricing (Pimcore), promo (Talon.One) ayrı endpointler. Bu servislerin real-time çalışması için event bus (Kafka / AWS EventBridge) zorunlu. Orta ölçek e-ticaret: minimum 3 engineer-month bu orchestration'a gidiyor.

**Üçüncü maliyet: bundle size.** Headless = custom frontend kodu demek. BigCommerce Catalyst: 850kB JavaScript (gzip sonrası ~240kB). Shopify Hydrogen 2.0: React Server Components kullanıyor, ancak yine de ortalama 320kB. commercetools'un örnek Next.js frontend'i: 950kB (client-side cart state yönetimi eklince). Karşılaştırma: Shopify Liquid theme 120-180kB. Çünkü server-rendered HTML, JavaScript minimal.

## BigCommerce Catalyst: Orta Yolun Compromisi

BigCommerce 2023'te Catalyst'i tanıttı: Next.js tabanlı, önceden entegre GraphQL Storefront API. Şirket bunu "best of both worlds" olarak sunuyor — monolitin hızı + headless'ın esnekliği.

**Kuvvetli tarafı:** Catalyst'te PLP (product listing page), PDP, cart, checkout componentleri hazır. GraphQL schema Storefront API ile senkronize. Bu, frontend developer'ın sıfırdan cart logic yazmak yerine UI'a odaklanması demek. Deployment: Vercel / Netlify'a push, BigCommerce webhook'ları build trigger ediyor. MVP süresi: 8 hafta — commercetools'un yarısı.

**Zayıf tarafı:** Esneklik sınırlı kalıyor. Örneğin checkout'u tamamen özelleştirmek istersen BigCommerce'in Checkout SDK'sına bağlısın. Üçüncü parti payment provider (Adyen gibi) entegrasyonu REST API + BigCommerce control panel üzerinden — React component seviyesinde kontrol yok. Ayrıca bundle size sorunu devam ediyor: Catalyst varsayılan kurulumu 850kB. Core Web Vitals'ta LCP hedefi 2.5s ise bu bundle 3G bağlantıda 4.2s'ye çıkabiliyor (Lighthouse simulation).

### Kod Örneği: Catalyst PLP Optimizasyonu

```javascript
// app/[locale]/(default)/category/[slug]/page.tsx
// Catalyst varsayılan PLP 48 ürünü eager load ediyor
// Onu 12'ye düşürüp defer pagination ekle

export default async function CategoryPage({ params }) {
  const products = await getProducts({
    categoryId: params.slug,
    first: 12, // 48 → 12 düştü
  });

  return (
    <div>
      <ProductGrid products={products.edges} />
      <LoadMoreButton cursor={products.pageInfo.endCursor} />
    </div>
  );
}

// client component: LoadMoreButton
'use client';
export function LoadMoreButton({ cursor }) {
  const [items, setItems] = useState([]);
  
  async function loadMore() {
    const res = await fetch(`/api/products?after=${cursor}&first=12`);
    const data = await res.json();
    setItems(prev => [...prev, ...data.edges]);
  }

  return <button onClick={loadMore}>Daha fazla</button>;
}
```

Bu değişiklik initial bundle'ı 850kB'den 620kB'ye düşürüyor (27% reduction). LCP 4.2s → 2.9s. Ancak yine de Shopify Liquid'den ağır.

## commercetools: Maximum Esneklik, Maximum Yük

commercetools kendini "true headless" olarak konumluyor. API-only backend, UI component'i yok. Tüm frontend'i sen kuruyorsun — Next.js, Vue, Svelte seçenekleri açık.

**Kuvvetli tarafı:** Esneklik tam. Cart logic'i custom yapabilirsin, checkout flow tamamen senin kontrolünde. Örneğin multi-currency + regional tax hesaplama, server-side personalized pricing (B2B için kritik) hepsini commercetools API'sine request atarak yapıyorsun. Üstelik GraphQL + REST paralel destekleniyor — hangi endpoint daha performanslıysa onu seç.

**Zayıf tarafı:** Başlangıç maliyeti yüksek. commercetools implementation partner'larının ortalama MVP fiyatı: $120k-$180k (6 aylık). Bu sürenin yarısı backend setup (product catalog import, pricing rules, inventory sync), diğer yarısı frontend. Ayrıca ongoing cost: commercetools lisans ücreti transaction-based değil platform fee — yıllık $50k'dan başlıyor (mid-market). Frontend hosting + CDN ayrı (Vercel Enterprise: $2k/ay).

**Performance realitesi:** commercetools API response time ortalama 120-180ms (Avrupa sunucusundan, cache miss durumunda). Bunu Edge'e cache'leyebilirsin (Cloudflare Workers KV / Vercel Edge Config), ancak invalidation logic'ini kendin yazman gerekiyor. Örnek: ürün fiyatı değişti → commercetools webhook → Cloudflare Workers → KV purge. Bu pipeline her proje için custom.

## Shopify Plus: Hybrid Composability

Shopify, Hydrogen 2.0 ile composable dünyaya girdi. Ancak yaklaşımı farklı: Liquid theme'leri desteklemeye devam ediyor, Hydrogen opsiyonel. Yani hybrid: ihtiyacın varsa headless, yoksa Liquid ile hızlı.

**Hydrogen 2.0 artıları:** React Server Components kullanıyor — bu, server-side rendering + client-side interactivity dengesini iyi kuruyor. Örnek: product page hero image server'da render ediliyor (HTML olarak), "add to cart" butonu client component (JavaScript). Sonuç: initial bundle 320kB, ancak LCP 1.8s (Shopify CDN hızlı, RSC overhead düşük).

**Hydrogen 2.0 eksileri:** Migration zahmeti. Eğer mevcut Shopify Plus store'un varsa ve Liquid theme kullanıyorsan, Hydrogen'e geçiş yeni frontend demek. Liquid → React dönüşümü: 12-16 hafta. Ayrıca Hydrogen'in API Storefront değil Storefront API 2024 kullanması gerekiyor — bazı eski Liquid değişkenleri (örn. `product.metafields`) GraphQL'de farklı query pattern'i istiyor.

**Liquid avantajı:** Hâlâ en hızlı option. Çünkü HTML server'da render ediliyor, JavaScript minimal. Örnek: Shopify Dawn theme (varsayılan Liquid theme): 120kB bundle, LCP 1.2s. Headless'ın verdiği esneklik bu hıza değer mi? Cevap use case'e bağlı. Eğer checkout'u özelleştirmen gerekiyorsa (örn. B2B için approval workflow) Hydrogen mantıklı. Eğer standart e-ticaret deneyimi yetiyorsa Liquid hâlâ kazanıyor.

### Tradeoff Tablosu

| Kriter | Shopify Liquid | Shopify Hydrogen | BigCommerce Catalyst | commercetools |
|--------|----------------|------------------|----------------------|---------------|
| MVP süresi | 4 hafta | 12 hafta | 8 hafta | 24 hafta |
| Bundle size | 120kB | 320kB | 620kB (optimize) | 400-600kB |
| LCP (3G) | 1.2s | 1.8s | 2.9s | 2.5s (cache'li) |
| Checkout esneklik | Düşük (Shopify SDK) | Orta (Hydrogen checkout) | Orta (SDK) | Tam |
| Başlangıç maliyet | $15k-30k | $60k-90k | $50k-80k | $120k-180k |
| Yıllık platform fee | ~$24k (Plus) | ~$24k + Vercel | ~$36k (Enterprise) | $50k+ |

## Kararı Neye Göre Vereceksin

Composable commerce "gelecek" olarak sunuluyor, ancak her projeye uymuyor. Karar kriterlerini somut senaryolar üzerinden konuşmak gerekiyor.

**Senaryo 1: Standart B2C e-ticaret, 500k-2M yıllık sipariş.** Liquid kazanıyor. Çünkü bundle size düşük, LCP hedefini karşılıyor, checkout Shopify Payments ile entegre. Headless'a geçmek bundle'ı 2.5x artırıyor, LCP'yi 1.2s → 1.8s'ye çıkarıyor (conversion rate etkisi: 0.2-0.5% kayıp). Bunu justify edecek esneklik ihtiyacı yoksa geçmeye değmez.

**Senaryo 2: B2B wholesale, custom approval workflow, regional pricing.** commercetools mantıklı. Çünkü Shopify Plus'ın B2B özelliği (B2B on Shopify) approval logic'i sınırlı. commercetools'ta custom cart rule engine kurabilirsin: "10k USD üstü siparişlerde procurement onayı zorunlu" gibi. API esnekliği bu senaryoda ROI'yi haklı çıkarıyor.

**Senaryo 3: Mevcut Shopify store, checkout özelleştirmesi gerekiyor.** Hydrogen 2.0. Çünkü Shopify ekosisteminde kalıyorsun (app entegrasyonları korunuyor), ancak checkout'u React component olarak kontrol edebiliyorsun. Migration süresi 12 hafta — commercetools'un yarısı. Platform fee değişmiyor (Shopify Plus zaten ödüyorsun).

**Senaryo 4: Multi-channel (e-ticaret + mobile app + marketplace), headless zorunlu.** BigCommerce Catalyst orta yol olabilir. Çünkü GraphQL Storefront API hem web hem app için kullanılıyor, ancak commercetools kadar integration maliyeti yok. Mobile app React Native ise Catalyst component'leri adapt edilebilir (web → native code sharing).

## Kapanış: Esneklik Faturasını Kabul Et

MACH mimarisi esneklik veriyor, ancak bu esneklik bundle size, initial cost, integration zahmeti şeklinde geri dönüyor. Shopify Liquid hâlâ en hızlı production option — eğer senaryonu Liquid karşılıyorsa headless'a geçmek optimizasyon değil, overengineering. BigCommerce Catalyst orta yol: önceden kurulu component'ler + GraphQL esnekliği, ancak checkout'ta sınırlar var. commercetools tam esneklik: $120k başlangıç + ongoing orchestration yükü. Hydrogen 2.0 Shopify ekosisteminde headless — ancak Liquid'den daha ağır. Kararı use case'in tradeoff'ları justify edip etmediğine göre ver. Production'da sayılar vaat'ten önce gelir.