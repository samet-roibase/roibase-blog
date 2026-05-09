---
title: "Shopify Hydrogen vs Liquid: Kararı Hangi Sayılarla Verdik"
description: "TTFB 840ms → 180ms, build time 12dk → 90sn. Hydrogen geçişinin arkasındaki sayılar, tradeoff'lar ve migration cost hesabı."
publishedAt: 2026-05-09
modifiedAt: 2026-05-09
category: tech
i18nKey: tech-002-2026-05
tags: [shopify-hydrogen, headless-commerce, web-performance, remix, ttfb]
readingTime: 8
author: Roibase
---

Shopify'ın Liquid temalarını 7 yıldır kullanıyorduk. Theme customization limitleri, server response time sabitleri ve monolitik deploy cycle'ları bizi sınırlamaya başladığında "headless" kelimesi masaya geldi. Ama karar vermeyi engelleyen soru şuydu: Hydrogen'e geçiş ROI'sini nasıl ölçeceğiz? Bu yazı o soruya verdiğimiz yanıtın sayısal detayı — TTFB, build time, developer velocity, migration cost. Hydrogen seçtik çünkü bir framework değil, ölçülebilir performans kazanımı verdi.

## Liquid'in Performans Tavanı

Shopify'ın Liquid theme engine'i server-rendered HTML döndürür. Sunucu tarafında Liquid syntax parse edilir, Storefront API çağrıları yapılır, HTML birleştirilir ve client'a gönderilir. Bu mimari basit ve stabil — ama ceiling var.

Bizim Production store'da median TTFB 840ms idi (RUM data, Cloudflare Analytics). %95 percentile 1.4 saniyeye çıkıyordu. Shopify'ın server response time'ı kontrol edemiyoruz — shared infrastructure. Liquid theme dosyalarını optimize etsek bile (unused section lazy load, snippet count azaltma) sunucu tarafı latency sabitti.

Build time ayrı bir sorun. Theme dosyasında değişiklik yaptığınızda Shopify CLI üzerinden push ediyorsunuz. Ortalama deploy süresi 12 dakika. CI/CD pipeline'ında bu süre stage→production arasında beklemek demek. A/B test iteration hızı düşük. Developer velocity kısıtlı.

```bash
# Liquid theme deploy (average)
shopify theme push --store=production
⏱ Upload: 4m 20s
⏱ Processing: 7m 40s
✅ Total: 12m 00s
```

Liquid'in tradeoff'u: basit kurulum, sıfır infrastructure yönetimi — ama performans kontrolü yok, iteration yavaş.

## Hydrogen'in Teknik Vaadi

Hydrogen, Shopify'ın Remix üzerine kurulu headless framework'ü. React Server Components, streaming SSR, edge deployment. Mimari fark şu: Liquid'de Shopify sunucusu HTML render eder. Hydrogen'de sen kendi edge sunucunu deploy edersin (Oxygen, Cloudflare, Vercel). Storefront API'yi doğrudan çağırırsın, response'u component tree'de stream edersin.

TTFB vaadi: edge node'dan render ettiğin için Shopify sunucu latency'si ortadan kalkar. Cloudflare Workers'a deploy edersen median TTFB 100-200ms aralığına düşer (Cloudflare'in POP latency'si + Storefront API RTT). Build time vaadi: Vite-based build, incremental deploy, 2 dakikanın altı.

Ama vaatlerin yanında cost var: migration effort, developer learning curve, infrastructure ownership. Biz bu tradeoff'ları sayısal modelleyerek ilerledik.

### Benchmark Metodolojisi

İki ortam kurduk:
1. **Liquid Baseline:** Production store, Dawn theme fork, 80+ section, Cloudflare proxy (cache bypass)
2. **Hydrogen Prototype:** Aynı homepage component tree, Cloudflare Workers deploy, Storefront API 2024-01 version

Test setup:
- WebPageTest (Dulles location, Moto G4, 3G Fast)
- 3 run median değerleri
- Cache cold state (her test öncesi cache flush)

Metrikler:
- TTFB (Time to First Byte)
- LCP (Largest Contentful Paint)
- TBT (Total Blocking Time)
- Build time (CI/CD içinde ölçüldü)

## Performans Karşılaştırması

Sonuçlar (median 3 run):

| Metric | Liquid | Hydrogen | Fark |
|---|---|---|---|
| **TTFB** | 840ms | 180ms | **-79%** |
| **LCP** | 2.4s | 1.1s | **-54%** |
| **TBT** | 680ms | 220ms | **-68%** |
| **Build Time** | 12m 00s | 1m 30s | **-88%** |

TTFB düşüşü beklentimize uydu. Hydrogen'de Cloudflare Workers edge node'u Storefront API'ye 40-60ms RTT ile ulaşıyor (Shopify'ın CDN'i zaten Cloudflare üzerinde). Liquid'de Shopify sunucusu Liquid parse + API çağrı + HTML birleştirme yapıyor — minimum 600ms overhead.

LCP kazanımı streaming SSR'dan geldi. Hydrogen ilk byte'ı erken gönderip HTML'i stream ediyor. Critical content (hero image, ATF product grid) önce render ediliyor, below-the-fold lazy load. Liquid'de HTML blocking render — tüm sayfa hazır olana kadar gönderilmiyor.

TBT düşüşü bundle size + hydration optimizasyonundan. Hydrogen'de React Server Components kullandık — client-side JS bundle 120KB (gzip). Liquid theme'de jQuery + custom scripts 340KB idi. Hydration time azaldı.

Build time farkı development velocity'ye doğrudan etki eder. 12 dakika yerine 90 saniye, günde 10 deploy yapıyorsanız 115 dakika tasarruf. CI/CD pipeline'ı hızlanır, A/B test iteration cycle kısalır.

```typescript
// Hydrogen streaming SSR örneği (Remix loader)
export async function loader({ context }: LoaderFunctionArgs) {
  const { storefront } = context;
  
  const productsPromise = storefront.query(PRODUCTS_QUERY);
  const collectionsPromise = storefront.query(COLLECTIONS_QUERY);
  
  // Stream: ilk response hemen dönüyor
  return defer({
    products: productsPromise,
    collections: collectionsPromise,
  });
}
```

`defer` API'si promise'leri stream eder. Client ilk HTML'i alır, data hazır oldukça sayfa progresif render olur. TTFB düşük kalır.

## Migration Cost Hesabı

Performans kazanımı net — ama geçiş maliyeti? Biz şu breakdownu yaptık:

**Development Effort:**
- Theme → Hydrogen component migration: 160 saat (2 senior developer, 4 hafta)
- Storefront API integration (GraphQL query rewrite): 40 saat
- CI/CD pipeline setup (Cloudflare Workers): 16 saat
- QA + edge case fixing: 24 saat
- **Toplam:** 240 saat

**Infrastructure Cost:**
- Cloudflare Workers: $5/mo (100K request'e kadar ücretsiz — bizim traffic 80K/mo)
- Oxygen (Shopify'ın edge platform'u): $20/mo başlangıç tier
- Biz Cloudflare seçtik — zaten Cloudflare proxy kullanıyorduk

**Maintenance Overhead:**
- Hydrogen versiyonu her 6 ayda güncellenmeli (Remix upstream takibi)
- Developer learning curve: ekipte React + Remix deneyimi gerekli
- Liquid'de Shopify Theme Store şablonu kullanıyorduk — Hydrogen'de custom development

Toplam one-time migration cost: **240 saat × $80/saat = $19,200**. Infrastructure yıllık cost: **$60**.

Buna karşılık kazanımları nasıl modelledik? İki başlık:

1. **Conversion Rate Impact:** Core Web Vitals ile conversion rate korelasyonu bilinen (Google/Deloitte study: 0.1s LCP düşüşü = %1-2 conversion lift). Bizim LCP 1.3s düşmüş — konservatif estimate %1.5 lift. Aylık $200K revenue'de = $3K/ay lift. Yıllık **$36K**.

2. **Developer Velocity:** Build time 88% azaldı. Ekip ayda 40 deploy yapıyor (CI/CD). Her deploy'da 10.5 dakika tasarruf = ayda 420 dakika = 7 saat. Senior developer $80/saat varsayımı ile aylık $560 tasarruf. Yıllık **$6.7K**.

Payback period: $19,200 / ($36K + $6.7K) = **5.4 ay**.

Bu hesap migration'ı justify etti. Performans kazanımı + developer velocity artışı migration costunu 6 ayda geri ödüyor.

## Tradeoff'lar ve Sınırlar

Hydrogen her store için doğru seçim değil. Şu senaryolarda Liquid daha mantıklı:

**Liquid kalmalı:**
- Traffic düşük (<10K/mo visitor) — TTFB farkı conversion'a etki etmez
- Ekip React/TypeScript bilmiyor — learning curve migration cost'unu 2x'ler
- Theme Store şablonu yeterli — customization ihtiyacı yok
- Infrastructure yönetimi istemiyorsan — shared Shopify sunucusu basit

**Hydrogen'e geçmeli:**
- Traffic yüksek (>50K/mo) — TTFB her 100ms conversion'ı etkiler
- Custom UI/UX gerekiyor — [Headless Commerce](https://www.roibase.com.tr/tr/headless) mimarisi esneklik veriyor
- A/B test iteration hızı kritik — CI/CD pipeline 2 dakikanın altı olmalı
- Developer ekip modern frontend stack (React/Remix) ile çalışıyor

Hydrogen'in bakım maliyeti de var. Remix her 6 ayda major version değişiyor. Hydrogen bunları takip ediyor. Liquid'de Shopify backward compatibility garantisi veriyor — eski theme 5 yıl sonra da çalışır. Hydrogen'de dependency update disiplini gerekli.

Edge deployment de sınır getiriyor. Cloudflare Workers runtime kısıtlamaları var (CPU time 50ms, memory 128MB). Complex backend logic (örneğin recommendation engine) edge'de çalışmaz — origin server'a offload etmelisin. Liquid'de bu sorun yok, sunucu tarafı sınırsız.

## İşte Şimdi Ne

Biz Hydrogen'i seçtik — çünkü TTFB 79% düştü, build time 88% azaldı, payback period 5.4 ay. Ama karar verirken migration cost modelini yaptık, tradeoff'ları listeledik.

Eğer sen de Hydrogen'e geçiş düşünüyorsan önce şu soruları cevapla: Monthly visitor sayın kaç? Ekip React biliyor mu? Custom UI/UX ihtiyacın var mı? CI/CD pipeline'ın var mı? Bu sorulara "evet" diyorsan sayısal model yap — TTFB farkını conversion lift'e çevir, developer velocity artışını saat cinsinden hesapla. O sayılar migration cost'unu justify ediyorsa ileri git.

Bizim gibi headless geçişi değerlendiriyorsan [Shopify Partner Hizmetleri](https://www.roibase.com.tr/tr/shopify) kapsamında Hydrogen migration roadmap'i çıkarabiliriz — benchmark, cost model, incremental rollout plan dahil.