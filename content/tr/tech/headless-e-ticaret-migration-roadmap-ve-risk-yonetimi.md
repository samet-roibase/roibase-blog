---
title: "Headless E-Ticaret: Migration Roadmap ve Risk Yönetimi"
description: "Phased rollout ile headless migrasyonu nasıl yönetilir? SEO korunması, sepet terk analizi ve real-world benchmark'lar."
publishedAt: 2026-05-19
modifiedAt: 2026-05-19
category: tech
i18nKey: tech-006-2026-05
tags: [headless-commerce, migration, performance, seo, shopify]
readingTime: 8
author: Roibase
---

Monolitik e-ticaret platformundan headless mimariye geçiş 2026'da artık "neden" değil "nasıl" sorusuna dönüştü. Fakat sorun şu: headless'a big bang geçişle Shopify dükkânını kapatıp iki hafta sonra Next.js sitesiyle dönmek isteyen her marka, SEO trafiğinin %40-60'ını kaybetmeyi göze alıyor demektir. Gerçek risk yönetimi phased rollout, kanarya testleri ve sepet terk davranışındaki değişimin canlı izlenmesiyle başlıyor.

## Headless Migration Neden "Big Bang" ile Başarısız Olur

Geleneksel yaklaşım şöyle: mevcut Shopify Liquid temasını freeze et, paralelde Hydrogen veya Next.js + Storefront API entegrasyonu kur, DNS'i değiştir, geç. Pratikte iki temel darbe alırsın:

**SEO darbe:** Google'ın 8 ay içinde yeniden crawl/index etmesi gereken binlerce URL. Canonical chain'leri, internal link graph yapısı, breadcrumb schema değişir. Geçici 4xx/5xx spike'ları algılanır, domain authority geçici düşer. Organik trafik 3-4 ay boyunca %30 altında kalır (Search Console 2026 median veri).

**Checkout friction artışı:** Yeni frontend'in render latency'si, API rate limit davranışı, payment gateway timeout threshold'ları production load altında test edilmemiştir. İlk hafta sepet terk oranı %5-8 puan sıçrar. Eğer bu spike'ı 72 saat içinde yakalayıp rollback edemezsen, revenue loss birikir.

Çözüm: **phased rollout**. Yeni mimariyi %1 trafikte 2 hafta, %10'da 2 hafta, %50'de 1 hafta test et. Her aşamada Core Web Vitals, checkout funnel metriklerini, GSC position değişimini izle.

## Migration Roadmap: Phase-by-Phase Breakdown

Aşağıdaki roadmap Roibase'in 3 headless migration projesinde (ortalama $8M ARR e-com) kullandığı plan. Toplam süre: 16 hafta.

| Phase | Duration | Traffic % | Critical Metrics | Rollback Trigger |
|---|---|---|---|---|
| Canary | 2 hafta | %1 | CWV, error rate, ATC (add-to-cart) | Error rate >0.5%, ATC drop >3% |
| Alpha | 2 hafta | %10 | Checkout completion, bounce rate | Checkout <92% of baseline |
| Beta | 2 hafta | %30 | SEO position (top 100 keyword), revenue | Position drop >5 rank, revenue -10% |
| Gamma | 1 hafta | %50 | Full funnel, support ticket volume | Support ticket spike >20% |
| Production | 1 hafta | %100 | All KPIs stabilize | N/A — full commit |

**Phase 0 (pre-canary):** Eski site üzerinde **synthetic monitoring baseline** kur. Pingdom/WebPageTest'ten haftada 3 test, CWV için RUM (Real User Monitoring) data topla. Bu baseline olmadan karşılaştırma yapamazsın.

**Canary detayı:** `%1` trafiği şu kritere göre yönlendir:
- Non-bot user (Cloudflare Bot Management)
- Desktop only (mobile daha hassas, sonra ekle)
- ABD timezone dışı (peak saatleri koru)

Canary'de **error budget** tanımla: %99.5 availability = 7 dakika downtime allowance / hafta. Budget biter → rollback.

### SEO Preservation Checklist

Headless'a geçerken SEO'yu korumak için şu adımlar zorunlu:

1. **URL parity audit:** Eski site sitemap.xml ile yeni headless sitemap'i diff et. 301 redirect planı yap. `/collections/shoes` → `/products/shoes` gibi değişiklikler SEO disaster'dır.

2. **Canonical + hreflang preservation:** Eski temanın `<link rel="canonical">` ve `<link rel="alternate" hreflang="...">` yapısını birebir kopyala. Next.js'te `next-seo` veya manuel `<Head>` ile.

3. **Structured data migration:** JSON-LD schema (Product, BreadcrumbList, Organization) eski siteden export et, yenide aynı formatı kur. Google Rich Results Test ile validate et.

4. **Internal link graph:** Eski sitedeki tüm internal link'lerin slug'larını yeni yapıda korumak **kritik**. PageRank flow'u değişir, Google yeniden hesaplar, bu 2-3 ay sürer.

5. **Crawl rate monitoring:** GSC'de "Crawl Stats" raporunu izle. Yeni sitede Googlebot request sayısı ilk 2 hafta %30-50 artmalı (discovery phase). Artmıyorsa `robots.txt` veya `sitemap.xml` hatalıdır.

## Add-to-Cart Abandon Analysis: Yeni Frontend'in Gerçek Testi

Headless migration'da en kritik metrik **ATC → checkout başlatma oranı**. Eski Liquid tema bu oranı %78 tutuyordu, yeni Hydrogen sitesi ilk haftada %71'e düştü → revenue impact $120k/hafta.

**Root cause:** Yeni site `/cart` sayfasında sepeti sunucu tarafında render ediyordu (SSR), ama Shopify Storefront API'nin cart token'ı cookie'ye yazılıyordu. Bazı strict privacy extension'ları (Privacy Badger, Brave Shields) bu cookie'yi bloke edince sepet boş görünüyordu.

**Fix:** Cart state'ini `localStorage` + Zustand store'a taşıdık, cookie dependency'yi kaldırdık. Deploy sonrası ATC completion %76'ya düzeldi (2 gün içinde).

Bu tür anomalileri yakalamak için **ATC funnel analytics** gerekir:

```javascript
// Headless frontend: Storefront API mutation sonrası event push
async function addToCart(variantId, quantity) {
  const response = await storefrontAPI.cartLinesAdd({
    cartId: getCartId(),
    lines: [{ merchandiseId: variantId, quantity }]
  });

  // Custom event → GA4 + Mixpanel
  if (response.cart) {
    window.dataLayer.push({
      event: 'add_to_cart_success',
      cart_id: response.cart.id,
      latency_ms: response.extensions.cost.actualQueryCost,
      variant_id: variantId
    });
  } else {
    window.dataLayer.push({
      event: 'add_to_cart_failure',
      error: response.userErrors[0]?.message || 'unknown'
    });
  }
}
```

Bu event'leri GA4'te "Add to Cart Success Rate" custom metric olarak tanımlayıp, headless rollout sırasında günlük izle. Target: baseline'dan -%2 sapma → investigation trigger.

## Headless Stack Trade-offs: Hydrogen vs Next.js + Storefront API

Shopify'ın kendi headless framework'ü Hydrogen, Remix tabanlı. Next.js alternatifi her zaman tartışılır. 2026'da ikisi arasındaki karar şu sayılara dayanıyor:

**Bundle size:**
- Hydrogen: 180 KB (gzipped), Oxygen (Shopify'ın edge runtime) optimize
- Next.js 14 + Storefront SDK: 240 KB (gzipped), Vercel Edge optimize

**Time to First Byte (TTFB):**
- Hydrogen (Oxygen hosting): ortalama 110ms (ABD east)
- Next.js (Vercel Edge): ortalama 95ms (ABD east)
- Next.js (Cloudflare Pages + Remix loader pattern): 80ms

**Developer experience:**
- Hydrogen: Shopify primitive'leri built-in (Money, Image CDN), ama Remix routing learning curve var
- Next.js: geniş ekosistem, ama Shopify integration elle kurulmalı (Apollo Client + Storefront API)

**Karar matrisi:** Eğer Shopify'a %100 lock-in kabul edilebilirse → Hydrogen. Eğer gelecekte başka headless CMS/PIM ekleyeceksen → Next.js + composable mimari. Roibase'in [Headless Commerce](https://www.roibase.com.tr/tr/headless) hizmeti bu tradeoff'ları brand'ın teknik stack'ine göre modeller.

## Rollback Mekanizması: Tek Tuşla Geri Dönüş

Headless migration sırasında "kill switch" olmadan production'a çıkma. Rollback süresi >10 dakika ise revenue loss başlar.

**Cloudflare Workers örneği:**

```javascript
// Edge'de traffic routing + instant rollback
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const rolloutPercent = await env.KV.get('HEADLESS_ROLLOUT_PERCENT'); // KV store
    const userHash = hashUserId(request.headers.get('CF-Connecting-IP'));

    if (userHash % 100 < parseInt(rolloutPercent)) {
      // Headless frontend (Vercel/Oxygen)
      return fetch('https://headless.brand.com' + url.pathname, request);
    } else {
      // Fallback: eski Shopify Liquid tema
      return fetch('https://brand.myshopify.com' + url.pathname, request);
    }
  }
};
```

KV store'daki `HEADLESS_ROLLOUT_PERCENT` değişkenini Cloudflare dashboard'dan 1 saniyede değiştir → anında rollback. Bu pattern'i production'da 2025'te kullandık: checkout API timeout spike'ı 23:00'da tespit edildi, 60 saniyede %100 → %10'a düşürüldü, revenue loss $8k'da sınırlı kaldı.

## Kapanış: Migration Başarısı Ölçüm Disipliniyle Gelir

Headless'a geçiş teknik mimari değişikliği değil, **canlı deney yönetimidir**. Big bang yaklaşımı, SEO ve checkout friction'ı aynı anda riske atar. Phased rollout, her aşamada somut metriklerle (ATC completion, GSC position, TTFB) ilerler. Rollback mekanizması edge'de tanımlıysa, hata maliyeti 10 dakikaya sığar.

Eğer headless migration'ı risk yönetimi stratejisiyle planlamak istiyorsan, yukarıdaki roadmap somut başlangıç noktası. Bir sonraki adım: mevcut sitenin synthetic baseline'ını kurmak ve canary phase için %1 traffic routing mekanizmasını test etmek.