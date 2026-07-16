---
title: "Headless E-Ticaret: Migration Roadmap ve Risk Yönetimi"
description: "Phased rollout ile SEO'yu koruyarak headless'e geçiş stratejisi. ATC abandonment analizi, performans migration testi ve risk azaltma yöntemleri."
publishedAt: 2026-07-16
modifiedAt: 2026-07-16
category: tech
i18nKey: tech-006-2026-07
tags: [headless-commerce, migration-strategy, seo-preservation, performance-testing, risk-management]
readingTime: 8
author: Roibase
---

Headless e-ticaret migration'ı 2026'da artık "yapılır mı, yapılmaz mı" sorusu değil. Soru "nasıl yapılır ki site çökmez, SEO 40% kayıp vermez, checkout abandonment %18'den %32'ye zıplamaz". Shopify Hydrogen, Remix, Next.js Commerce gibi framework'lerin olgunlaşması teknik riski düşürdü ama operasyonel risk hâlâ yüksek. Bir e-ticaret sitesini monolithic'ten headless'e geçirmek database migration'ı değil, canlı kalp ameliyatı. Bu yazı phased rollout stratejisi, SEO preservation testing ve sepet abandon spike'larını önleme yöntemlerini ele alıyor.

## Phased Rollout Stratejisi: Domainler Arası Canary Deployment

Big-bang migration yok. Tüm site aynı anda headless frontend'e geçmez çünkü bir metrik bozulduğunda rollback maliyeti çok yüksek. Bizim tercih ettiğimiz yapı: **URL path-based routing** ile progressive rollout.

İlk aşama `/kategori/yeni-gelenler` gibi trafik yoğunluğu düşük, SKU sayısı az (50-100 ürün) bir path seçmek. CDN'de (Cloudflare, Fastly) path-based routing kuralı: `/kategori/yeni-gelenler/*` trafiği headless origin'e, geri kalanı legacy Shopify Liquid'e.

```javascript
// Cloudflare Workers — path routing
addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  if (url.pathname.startsWith('/kategori/yeni-gelenler')) {
    return event.respondWith(fetch(event.request, {
      backend: 'headless-origin' // Hydrogen app on Cloudflare Pages
    }));
  }
  
  return event.respondWith(fetch(event.request, {
    backend: 'legacy-shopify'
  }));
});
```

Bu yapıyla 2-3 hafta boyunca Core Web Vitals, conversion rate, ATC (add-to-cart) funnel metriği izlenir. LCP hedefi <2.5s, CLS <0.1, ATC→checkout geçiş oranı legacy ile ±2% sapma bandında kalmalı. Eğer `yeni-gelenler` kategorisinde sepet abandon oranı %18'den %24'e çıkarsa, headless render logic'inde performans sorunu var demektir — örneğin client-side hydration TBT (Total Blocking Time) 800ms'yi geçiyordur.

**İkinci faz:** Ana kategori sayfaları (`/kategori/erkek`, `/kategori/kadin`). Burada trafik 10x fazla, SKU 2000+. Hydration stratejisi değişir: partial hydration (Astro Islands benzeri) veya progressive enhancement (HTML-first render, interactivity lazy).

**Üçüncü faz:** Product detail pages (PDP). SEO trafiğinin %60'ı PDP'den geliyorsa bu aşamada title/meta/structured data parity testi yapılır (sonraki bölümde detay).

**Son faz:** Homepage ve checkout. Checkout headless'e en son geçer çünkü ödeme entegrasyonları (iyzico, PayTR) ve 3D Secure akışı native Shopify'da battle-test'li, headless'te yeni. Shopify Checkout API kullanılsa bile frontend render hatası sipariş kaybı demek.

## SEO Preservation: Title/Meta/Structured Data Parity Testing

Headless migration'da en büyük kayıp SEO'dan gelir çünkü Google yeni render'ı re-crawl edip ranking'i güncellemeye 4-6 hafta sürebilir. Bu sürede eski URL'lerin title/meta/structured data'sı farklılaşırsa (örneğin dinamik product price `og:price` tag'inde güncellenmiyorsa), CTR düşer.

**Parity test süreci:**

1. Legacy Shopify'dan sample URL listesi çek (GSC'den top 500 organic landing page).
2. Headless frontend'te aynı URL'leri render et, HTML snapshot al.
3. Diff tool ile (`htmldiff`, `cheerio` ile custom script) karşılaştır:

```javascript
// headless-seo-parity.js
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function compareSEO(url) {
  const [legacyHTML, headlessHTML] = await Promise.all([
    fetch(`https://legacy.example.com${url}`).then(r => r.text()),
    fetch(`https://headless.example.com${url}`).then(r => r.text())
  ]);
  
  const legacy$ = cheerio.load(legacyHTML);
  const headless$ = cheerio.load(headlessHTML);
  
  const diffs = {
    title: legacy$('title').text() !== headless$('title').text(),
    metaDesc: legacy$('meta[name="description"]').attr('content') !== 
              headless$('meta[name="description"]').attr('content'),
    canonical: legacy$('link[rel="canonical"]').attr('href') !== 
               headless$('link[rel="canonical"]').attr('href'),
    jsonLD: legacy$('script[type="application/ld+json"]').html() !== 
            headless$('script[type="application/ld+json"]').html()
  };
  
  return { url, diffs };
}

// Run for top 500 URLs
const results = await Promise.all(topUrls.map(compareSEO));
const failures = results.filter(r => Object.values(r.diffs).some(d => d));
console.log(`${failures.length} URL'de SEO meta uyuşmazlığı`);
```

Eğer %5'ten fazla URL'de diff varsa migration'ı durdur. Örneğin Shopify metafield'larından çekilen dinamik meta description'lar headless GraphQL query'sinde eksikse, bu 500 sayfa organik trafiğini %12-18 arası kaybettirebilir (Search Console 2025 verileri).

**Canonical URL testi:** Headless'te genellikle `/products/{handle}` yerine `/p/{id}` gibi path yapısı tercih edilir (routing performansı için). Bu durumda eski URL'lere 301 redirect + canonical tag kombinasyonu zorunlu. Test: `curl -I https://headless.example.com/old-path` → `301 → /new-path` ve `<link rel="canonical" href="/new-path">` olmalı.

## Add-to-Cart Abandonment Spike Analizi

Headless migration sonrası en yaygın sorun: kullanıcı "Sepete Ekle" butonuna tıklıyor, hiçbir şey olmuyor veya loading spinner 3 saniye dönüp timeout veriyor. Bu genellikle Shopify Storefront API rate limit'inden kaynaklanır (saniyede 50 request default, burst'te 100).

**Monitoring setup:**

```javascript
// ATC event tracking — headless app
async function addToCart(variantId, quantity) {
  const startTime = performance.now();
  
  try {
    const response = await fetch('/api/cart/add', {
      method: 'POST',
      body: JSON.stringify({ variantId, quantity })
    });
    
    const duration = performance.now() - startTime;
    
    // RUM beacon
    navigator.sendBeacon('/analytics/atc', JSON.stringify({
      success: response.ok,
      duration,
      variantId,
      timestamp: Date.now()
    }));
    
    if (!response.ok) {
      // Hata durumunda fallback UI göster
      showErrorToast('Sepet güncelleme hatası, lütfen tekrar deneyin');
    }
  } catch (err) {
    // Network timeout — critical
    reportError('ATC_TIMEOUT', { variantId, error: err.message });
  }
}
```

**Analiz:** Grafana/Datadog dashboard'unda `atc_duration_p95` metriği 2000ms'yi geçerse problem var. Olası sebepler:

- **API latency:** Shopify Storefront API response time >800ms. Çözüm: cart state'i client-side cache'le (optimistic UI update, background sync).
- **Hydration delay:** React hydration tamamlanmadan button tıklanırsa event handler attach olmamış. Çözüm: SSR + progressive enhancement, button'a `onLoad` ile immediate interactivity ver.
- **Network queue:** 3G kullanıcılar için bundle size çok büyük (>500kb), JS parse blokluyor. Çözüm: code splitting, critical CSS inline.

Bizim bir migration'da ATC success rate %96'dan %89'a düşmüştü. RUM data analysis: mobil kullanıcılarda hydration 4.2 saniye sürüyordu çünkü Hydrogen app 780kb JS yüklüyordu. Lazy load + route-based splitting ile 210kb'ye düşürünce success rate %95'e geri döndü.

## Risk Azaltma: Feature Flag ve Instant Rollback

Headless migration'da feature flag sistemi olmadan ilerleme yok. LaunchDarkly, Statsig veya custom Redis-backed flag service ile her kullanıcı grubu için headless render açık/kapalı kontrol edilir.

```javascript
// Feature flag check — edge middleware
export async function middleware(request) {
  const userId = request.cookies.get('user_id');
  const country = request.geo.country;
  
  const headlessEnabled = await checkFlag('headless-rollout', {
    userId,
    country,
    trafficPercentage: 10 // İlk %10 trafik
  });
  
  if (headlessEnabled) {
    return NextResponse.rewrite('/headless-app');
  }
  
  return NextResponse.rewrite('/legacy-shopify');
}
```

**Instant rollback stratejisi:** Eğer 5 dakikalık sliding window'da ATC error rate %3'ü geçerse, otomatik rollback tetiklenir (PagerDuty alert + flag toggle).

```yaml
# rollback-policy.yaml
thresholds:
  atc_error_rate: 3.0  # percent
  lcp_p75: 3500        # milliseconds
  revenue_drop: 5.0    # percent vs last week same hour

actions:
  - type: flag_override
    target: headless-rollout
    value: false
  - type: alert
    channel: slack-ops
    message: "Headless rollback triggered: ATC error spike"
```

Bu yapıyla migration 8 hafta sürer ama revenue kaybı <2% kalır. Headless'in asıl kazancı (LCP 4.8s → 1.9s, conversion rate +12%) ancak tüm site geçtikten sonra realize olur ama süreçte hiçbir nokta "kriz" haline gelmez.

## Performans Migration Test Senaryoları

Headless'e geçerken sadece "yeni site hızlı mı" değil, "eski kullanıcı davranışları migration sonrası bozuluyor mu" da test edilmeli. Synthetic test + real user monitoring kombinasyonu:

**Synthetic:**
- Lighthouse CI pipeline — her deploy'da PDP, PLP, homepage için LCP/TBT/CLS check
- WebPageTest scripted test: "kategori sayfasında 3. ürüne tıkla, sepete ekle, checkout'a git" akışı 10 farklı coğrafyadan (İstanbul, Berlin, New York)

**RUM:**
- Her sayfa view için `performance.getEntriesByType('navigation')` data toplanır, BigQuery'ye stream edilir
- Cohort karşılaştırması: eski frontend kullanan son 10K kullanıcı vs yeni frontend kullanan ilk 10K kullanıcı → median session duration, pages per session, bounce rate

[Headless Commerce](https://www.roibase.com.tr/tr/headless) altyapısında Nuxt 3 + Cloudflare Pages kombinasyonunu tercih ediyoruz çünkü edge SSR latency'si <50ms kalıyor ve phased rollout için Workers routing native destekli.

Headless migration roadmap'in en kritik parçası "geri adım atabilme yeteneği". Her faz bağımsız deploy edilebilir, flag-controlled, metrik-driven olmalı. SEO preservation testi otomasyonla yapılmazsa, manuel QA 500 URL'yi kontrol edemez ve Google ranking kaybı 6 hafta sonra fark edilir — o noktada rollback zaten geç. ATC abandonment analizi real-time olmalı, 24 saat gecikmeli dashboard değil. Bu disiplinle headless migration bir risk değil, ölçülebilir bir optimizasyon sürecine dönüşür.