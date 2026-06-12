---
title: "Travel Tech 2026: Booking Funnel'i Headless'a Geçirmek"
description: "Composable hospitality mimarisi, edge personalization ve conversion impact — booking funnel'ini monolitten headless stack'e taşımanın operasyonel anatomisi."
publishedAt: 2026-06-12
modifiedAt: 2026-06-12
category: travel
i18nKey: travel-005-2026-06
tags: [headless-commerce, travel-tech, edge-personalization, conversion-optimization, composable-architecture]
readingTime: 8
author: Roibase
---

2026'da hospitality sektöründe booking funnel'i hâlâ 2015 teknolojisi üzerinde koşuyorsa, conversion optimizasyon çalışmaları viewport hızı yerine backend render süresinde boğuluyor demektir. Monolitik rezervasyon sistemleri — Sabre, Amadeus, custom PHP stack'leri — inventory management ile frontend experience'ı aynı binary'de taşıdığı için A/B test deployment'ı 3 hafta sürüyor, personalization edge'de değil server'da gerçekleşiyor ve her sayfa yüklemesi 1.8 saniye average TTFB ile kullanıcıyı kaybettiriyor. Headless mimari bu problemi çözmüyor — composable architecture çözüyor: inventory API'sini değiştirmeden frontend stack'ini değiştirme, farklı pazarlarda farklı checkout flow deployment yapabilme, edge function'larla kullanıcıya 50ms'den yakın personalization sunabilme.

## Monolitten Composable'a Geçiş: Neden Şimdi

Klasik booking stack'i şöyle görünüyor: PostgreSQL inventory + Ruby on Rails monolith + template engine (ERB/Haml) + jQuery frontend. Tüm business logic backend'de, rendering server-side, cache CloudFlare'de ama query logic sunucuda koştuğu için cache bypass sık. Yeni checkout step eklemek deployment pipeline'ını tetikliyor, staging ortamda test 2 gün sürüyor, production'a alma window haftada bir. Bu mimari 2015'te mantıklıydı — SSR SEO için gerekliydi, JavaScript bundle size önemliydi. 2026'da bu varsayımlar geçersiz: Googlebot JS render ediyor, edge computing framework'leri sub-100ms response veriyor, React Server Components partial hydration sağlıyor.

Headless geçiş şu ayrışmayı getiriyor: **Backend API layer** (inventory, pricing, availability) + **Frontend stack** (Next.js, Remix, Astro) + **Edge layer** (Cloudflare Workers, Vercel Edge). Bu üç katman birbirinden bağımsız deploy ediliyor. Inventory API'sini değiştirmeden checkout flow'u 4 farklı varyasyonda A/B test edebiliyorsun, çünkü frontend sadece API consumer. SEO critical sayfalar (otel detay, şehir landing) ISR (Incremental Static Regeneration) ile build time'da generate ediliyor, 2 saatte bir revalidate, TTFB 40ms. Checkout flow client-side render, ama form validation edge function'da koşuyor — kullanıcı form submit etmeden geçersiz input'u catch ediyorsun, round-trip server'a gitmiyor.

Operasyonel kazanç sayısal: deployment frequency 1/hafta'dan 15/gün'e çıkıyor, çünkü frontend değişikliği backend re-deploy gerektirmiyor. TTFB ortalaması 1.8 saniyeden 120ms'ye düşüyor (ISR sayesinde). Conversion rate 2.4 puan artıyor — bu %12 cart abandonment azalması demek, booking volume sabitken revenue artışı.

## Edge Personalization: Kullanıcıya 50ms Mesafede Karar Vermek

Geleneksel personalization server-side koşuyor: kullanıcı cookie'si backend'e gidiyor, user segment query ediliyor (Segment API veya kendi DB'niz), segment-based content template render ediliyor, HTML kullanıcıya dönüyor. Bu flow 600-900ms sürüyor, çünkü her request backend'e gitmek zorunda. Headless mimari ile personalization edge'e taşınıyor: Cloudflare Workers veya Vercel Edge Middleware kullanıcının request header'ını (geolocation, device type, referrer) parse ediyor, KV store'dan segment tanımını çekiyor (sub-10ms latency), content variation'ı inject ediyor, HTML kullanıcıya 50ms'de dönüyor.

### Edge Personalization Stack Örneği

```typescript
// Cloudflare Workers — Edge Middleware
export async function onRequest(context) {
  const { request, env } = context;
  const geo = request.cf?.country || 'US';
  const deviceType = /Mobile/i.test(request.headers.get('User-Agent')) ? 'mobile' : 'desktop';
  
  // KV store'dan segment rule'ları çek (cache TTL 60s)
  const segmentKey = `segment:${geo}:${deviceType}`;
  let segment = await env.SEGMENTS.get(segmentKey, { type: 'json' });
  
  if (!segment) {
    // Fallback segment
    segment = { currency: 'USD', language: 'en', promoCode: null };
  }
  
  // Response header'a segment bilgisini ekle (SSR'da kullanılacak)
  const response = await fetch(request);
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('X-User-Segment', JSON.stringify(segment));
  
  return newResponse;
}
```

Bu kod her request'te koşuyor ama 8ms sürüyor — geo lookup Workers runtime'da built-in, KV read 3ms, JSON parse 2ms, header injection 1ms. Kullanıcı aynı session içinde 10 sayfa gezse bile toplam personalization overhead 80ms, oysa geleneksel backend query 6 saniye olurdu.

Pratik kullanım senaryosu: Almanya'dan gelen kullanıcı EUR fiyat görüyor, İngiltere'den gelen GBP görüyor — ama bu currency switch backend'de koşmuyor, edge layer header'dan segment okuyup frontend'e `{ currency: 'EUR' }` prop pass ediyor, React component render anında doğru sembolü gösteriyor. Backend API hâlâ USD dönüyor (tek source of truth), conversion edge'de yapılıyor.

## Composable Stack: Inventory, Payment, CRM'i Birbirinden Ayırmak

Monolitik sistemde inventory management, payment processing, CRM (müşteri veritabanı) aynı codebase'de yaşıyor. Yeni ödeme gateway eklemek için inventory logic'e dokunmak zorunda kalıyorsun, çünkü transaction aynı database transaction'ında koşuyor. Headless geçiş composable architecture'ı mümkün kılıyor: her servis kendi bounded context'inde, API contract ile konuşuyor.

**Örnek stack:**
- **Inventory:** Mews (hospitality PMS) veya custom Rails API
- **Payment:** Stripe Connect (multi-currency, SCA compliance)
- **CRM:** Segment CDP (customer events) + Braze (retention messaging)
- **Search:** Algolia (instant search, typo tolerance)
- **Frontend:** Next.js 15 (App Router, RSC)
- **Edge:** Cloudflare Workers (personalization, A/B test routing)

Bu stack'te ödeme gateway'i Stripe'dan Adyen'e geçirmek 2 günlük iş — sadece payment adapter değişiyor, inventory API hiç dokunulmuyor. Search provider'ı Algolia'dan Elasticsearch'e almak frontend'de 1 component değişikliği, backend hiç değişmiyor. CRM'de müşteri segment tanımı güncelleniyor, bu bilgi Segment'ten Braze'e gidiyor, ama inventory API bundan habersiz — loosely coupled.

**Tradeoff:** Composable mimari operasyonel complexity artırıyor. 6 servis ayrı deploy ediliyor, her birinin health check'i var, incident response playbook'u ayrı, monitoring dashboard'u ayrı. Monolitik sistemde 1 Rails app restart ediyordun, şimdi 6 servis orchestrate etmen gerekiyor. Bu yük küçük ekipler için anlamlı — ekip 3 kişiyse composable'a geçme, monoliti refactor et. Ekip 15+ kişiyse her servis farklı ekip sahibi olabilir, o zaman composable kazandırır.

## Conversion Impact: Sayılarla Headless ROI

Headless geçişin conversion üzerindeki etkisi 3 mekanizmadan geliyor:

1. **Performance:** TTFB 1800ms → 120ms, LCP (Largest Contentful Paint) 3.2s → 1.1s. Google'ın Core Web Vitals sıralamasında yukarı çıkıyorsun, organic traffic %18 artıyor (Search Console verisi, 6 aylık median). Performance iyileşmesi bounce rate azaltıyor — 1 saniye hızlanma %7 bounce rate düşüşü (industry benchmark).

2. **Experimentation velocity:** A/B test deployment 3 haftadan 2 saate düşüyor. Haftada 1 test yerine haftada 7 test koşturabiliyorsun. Bayesian optimization ile kazanan varyant 3 gün içinde %95 confidence level'a ulaşıyor, losers kill ediliyor. 12 ayda 350 test koşturuyorsun, her testin ortalama uplift %0.8, compound effect %22 conversion artışı.

3. **Personalization depth:** Edge personalization ile segment count 4'ten 24'e çıkıyor (geo × device × referrer source). Her segment için optimize edilmiş CTA, başlık, görsel gösteriyorsun. Segment-specific conversion rate farkı %4-9 arasında — aggregate ettiğinde %5.2 uplift (weighted average).

**ROI hesabı (12 ay):**
- Headless migration maliyet: $120k (developer time, infrastructure setup)
- Traffic sabit (monthly 500k visitors), baseline conversion 2.8%
- Performance + experimentation + personalization compound uplift: %31
- Yeni conversion rate: 3.67%
- Ek bookings: 500k × (3.67% - 2.8%) = 4,350/ay
- Average booking value: $180
- Ek revenue: $783k/yıl
- Net ROI: ($783k - $120k) / $120k = 552% birinci yılda

Bu rakamlar ideal senaryo — gerçekte deployment sorunları, edge caching logic hataları, ISR revalidation timing yanlışları var. Ortalama olarak %20-25 net conversion uplift gerçekçi (industry median, Composable Commerce Alliance 2025 raporu).

## Deployment Stratejı: Monolitten Headless'a Geçiş Yolu

Big bang migration yapma — monolitik sistemi bir anda kapatıp headless açmak risk taşıyor. Gradual strangler pattern kullan: yeni özellikler headless stack'te deploy et, eski özellikler monolitik sistemde kalsın, zamanla monolit küçülsün.

**Aşamalı geçiş planı:**

| Hafta | Deliverable | Monolit Yükü |
|-------|-------------|--------------|
| 1-4   | Static sayfa migration (şehir landing, otel detay) — Next.js ISR | %80 |
| 5-8   | Search flow headless'a geçiş — Algolia integration | %65 |
| 9-12  | Checkout flow ilk 2 step headless — payment hâlâ monolitten | %50 |
| 13-16 | Payment integration headless stack'te — Stripe Connect | %30 |
| 17-20 | User dashboard migration — auth hâlâ monolitte | %15 |
| 21-24 | Auth headless'a taşı — JWT token transition | %5 |

Bu süreçte monolitik sistem sadece inventory API ve legacy auth sağlıyor. 24. haftada monolit tamamen kill edilebilir, sadece API katmanı kalır.

**Kritik geçiş detayı:** Session management. Monolitik sistemde session server-side cookie'de tutuluyor, headless'ta JWT token client-side. Geçiş sırasında hem cookie hem JWT desteklemen gerekiyor — middleware dual-mode authentication yapıyor, kullanıcı logout/login olmadan geçiyor.

---

Headless booking funnel migration agresif bir karar ama 2026 hospitality pazarında gerekli. Composable mimari deployment velocity'yi 15x artırıyor, edge personalization latency'yi 90% düşürüyor, conversion uplift %20-30 bandında. Tradeoff operasyonel complexity — 6 servis orchestrate etmek kolay değil ama ekip 15+ kişiyse bu yük dağıtılabilir. Gradual migration 6 ayda tamamlanıyor, ROI birinci yılda %500+. Monolit killing point 24. hafta — oradan sonra sadece API layer kalıyor, frontend tamamen bağımsız. Teknoloji stack seçimi önemli değil (Next.js vs Remix tartışması noise), mimari prensip önemli: inventory API'den frontend'i ayırmak, personalization'ı edge'e taşımak, deployment pipeline'ını parçalara bölmek. Bu üç ilke tutarsa [markalaşma stratejisi](https://www.roibase.com.tr/tr/branding) farklı pazarlarda tutarlı kalırken teknik stack market-specific optimize edilebilir.