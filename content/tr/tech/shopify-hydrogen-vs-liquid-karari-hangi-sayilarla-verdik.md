---
title: "Shopify Hydrogen vs Liquid: Kararı Hangi Sayılarla Verdik"
description: "TTFB 680ms vs 120ms, build time 8dk vs 45sn, migration cost $12K. Hydrogen'e geçiş kararını veri üzerinden analiz ediyoruz."
publishedAt: 2026-07-07
modifiedAt: 2026-07-07
category: tech
i18nKey: tech-002-2026-07
tags: [shopify-hydrogen, liquid, web-performance, headless-commerce, ttfb]
readingTime: 8
author: Roibase
---

Shopify Hydrogen 2024 sonunda stable olduğunda müşterimizin mevcut Liquid temasını Hydrogen'e taşımayı değerlendirdik. Karar süreci tamamen sayısal: TTFB, build time, dev velocity, migration cost. Sonuç: taşıma gerçekleşti, production'a 3 ay sonra geçtik. Bu yazıda hangi sayıların kararı verdiğini göstereceğiz.

## TTFB: Server-Side Rendering'in Maliyeti

Liquid tema production'da ortalama 680ms TTFB veriyordu (Shopify Analytics, 30 gün ortalaması). Sayfa tiplerine göre dağılım:

| Sayfa Tipi | Liquid TTFB | Hydrogen TTFB | Delta |
|---|---|---|---|
| Home | 520ms | 95ms | -425ms |
| Collection | 780ms | 140ms | -640ms |
| Product | 650ms | 110ms | -540ms |
| Cart | 890ms | 150ms | -740ms |

Hydrogen'in edge'de çalışan SSR motoru sayfa türüne bakmadan 120ms civarında yanıt verdi. Shopify'ın origin'e giden her istek Liquid'de server-side rendering tetikliyor, Hydrogen'de ise Remix loader'ları Oxygen'in edge node'larında çalışıyor.

```typescript
// Hydrogen loader örneği — Oxygen edge'de çalışır
export async function loader({context, params}: LoaderFunctionArgs) {
  const {storefront} = context;
  const {handle} = params;
  
  const {product} = await storefront.query(PRODUCT_QUERY, {
    variables: {handle},
  });
  
  return json({product});
}
```

Cache hit durumunda TTFB 40ms'ye düşüyor (Cloudflare Workers KV ile cache layer eklendiğinde). Liquid'de benzer optimizasyon için Shopify CDN'ine güvenmek gerekiyor, ama dynamic content (cart, personalization) için bu yeterli olmuyor.

## Build Time: Development Velocity'nin Şişmesi

Liquid tema production build'i (CI/CD pipeline'da) ortalama **8 dakika 15 saniye** sürüyordu. Theme Kit ile asset upload, minification, Shopify'a deploy. Hydrogen production build **45 saniye** — Vite build + Oxygen deploy.

**Dev ortamında:**
- Liquid: hot reload yok, her değişiklik için tema yeniden yükleniyor (~12sn)
- Hydrogen: HMR ile değişiklik anında tarayıcıya yansıyor (<200ms)

Geliştirici geri bildirimi: bir feature branch'te 20 değişiklik yapıldığında Liquid'de toplam bekleme süresi 4 dakika, Hydrogen'de 4 saniye. Dev velocity artışı %98.

```bash
# Hydrogen dev server başlatma
npm run dev
# Vite server 200ms'de hazır, HMR aktif

# Liquid tema geliştirme
shopify theme serve
# Tema yüklenene kadar 8-12sn bekleme
```

[Headless Commerce](https://www.roibase.com.tr/tr/headless) mimarisi bu tür optimizasyonları mümkün kılıyor — frontend Shopify Storefront API üzerinden veri çekiyor, build process bağımsız.

## Migration Cost: Teknik Borç Hesabı

Taşıma maliyetini şu kalemlere ayırdık:

| Kalem | Saat | Maliyet ($) |
|---|---|---|
| Liquid tema analizi | 16 | 1,600 |
| Component mapping (35 Liquid snippet → React) | 80 | 8,000 |
| Shopify API migration (REST → Storefront API) | 24 | 2,400 |
| Testing + QA | 12 | 1,200 |
| **Toplam** | **132** | **$13,200** |

Ek maliyet: Oxygen hosting (Shopify Plus dahil), Cloudflare Workers cache layer (opsiyonel, $5/ay).

**Tradeoff:** Liquid'de kalan alternatif maliyeti: yıllık 120 saat dev inefficiency (yukarıdaki build time farkından) × $100/saat = $12,000. İlk yılın sonunda migration cost amortize oluyor.

## Runtime Performance: Core Web Vitals Etkisi

Field data (Chrome User Experience Report, 28 gün):

| Metrik | Liquid (p75) | Hydrogen (p75) | Delta |
|---|---|---|---|
| LCP | 2,840ms | 1,620ms | -43% |
| FID | 180ms | 80ms | -56% |
| CLS | 0.18 | 0.04 | -78% |
| TTFB | 680ms | 120ms | -82% |

Hydrogen'in React Suspense + streaming SSR kombinasyonu LCP'yi düşürüyor. Lazy loading component'leri initial bundle'dan çıkartıyor, critical path küçülüyor.

```typescript
// React Suspense ile lazy product recommendations
import {Suspense} from 'react';
const ProductRecommendations = lazy(() => import('./ProductRecommendations'));

<Suspense fallback={<RecommendationSkeleton />}>
  <ProductRecommendations productId={product.id} />
</Suspense>
```

CLS düşüşü: Liquid'de dinamik content shift yaratıyordu (cart drawer, promo banner), Hydrogen'de layout shift elimine edildi (skeleton component'lerle).

## Developer Experience: Ekip Geri Bildirimi

Taşımadan 60 gün sonra dev ekibine anket (5 developer):

**Liquid'de en büyük zorluk:**
- 80% "Debug sürecinin uzunluğu"
- 60% "Modern tooling eksikliği (TypeScript, hot reload)"
- 40% "Component reusability yokluğu"

**Hydrogen'de en büyük fayda:**
- 100% "TypeScript + IDE autocomplete"
- 80% "HMR ile dev hızı"
- 60% "React ecosystem'e erişim"

Negatif feedback: Hydrogen dokümantasyonunun eksikliği (%40), Shopify Remix router'ın öğrenme eğrisi (%20).

## Hangi Durumlarda Liquid Kalmak Mantıklı

Hydrogen'e geçmeme kararı şu koşullarda anlamlı:

1. **Site trafiği <10K session/ay:** TTFB farkı kullanıcı deneyiminde hissedilir değil, migration ROI yok.
2. **Tema çok custom değil:** Off-the-shelf tema kullanıyorsanız, taşıma çabası fayda sağlamıyor.
3. **Dev team React bilmiyor:** Öğrenme maliyeti + onboarding süresi migration süresini 2-3x artırır.
4. **Shopify Plus değil:** Oxygen hosting Shopify Plus ile geliyor, Basic/Advanced plan'da ek maliyet var.

## Karar Sonrası: Production'a Geçiş Stratejisi

3 aşamalı rollout:

1. **Beta ortamı:** Hydrogen site Vercel'de deploy edildi, internal test 2 hafta (QA + stakeholder).
2. **Canary release:** Trafiğin %10'u Hydrogen'e yönlendirildi (Cloudflare Workers ile A/B split), conversion rate delta %+2.3.
3. **Full rollout:** 14 gün sonra %100 trafik Hydrogen'e geçti, Liquid tema backup olarak kaldı.

Post-launch metrik: checkout conversion rate %3.8 → %4.1 (TTFB azalması + CLS iyileşmesi etkisi). Yıllık revenue etkisi: $180K (ortalama AOV $120, 15K order/ay).

Hydrogen kararı sayısal olarak doğru çıktı: TTFB %82 düştü, dev velocity %98 arttı, migration cost ilk yılda amorti edildi. Liquid'den kaçış nedeni performance değil — modern developer experience + composable mimari esnekliği. Shopify ekosisteminde kalarak headless'a geçiş istiyorsanız, Hydrogen tek mantıklı seçenek.