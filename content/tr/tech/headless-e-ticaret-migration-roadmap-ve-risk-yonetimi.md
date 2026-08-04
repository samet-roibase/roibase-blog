---
title: "Headless E-Ticaret: Migration Roadmap ve Risk Yönetimi"
description: "Phased rollout stratejisi, SEO koruma teknikleri ve ATC abandon analizi ile headless e-ticaret geçişini güvenli hale getirin."
publishedAt: 2026-08-04
modifiedAt: 2026-08-04
category: tech
i18nKey: tech-006-2026-08
tags: [headless-commerce, migration-strategy, seo-preservation, risk-management, composable-architecture]
readingTime: 8
author: Roibase
---

Headless e-ticaret geçişi, 2026'da artık "yapılacak mı" değil "nasıl yapılacak" sorusu haline geldi. Ancak her büyük mimari dönüşümde olduğu gibi, bu geçiş sürecinde yanlış bir adım revenue'yu %12-18 oranında düşürebiliyor (Forrester 2025 verisi). Sepete ekleme davranışlarındaki gizli sinyaller kaybolur, SEO otoriteleri sıfırlanır, conversion funnel'daki mikro-optimizasyonlar buharlaşır. Bu yazıda, headless geçişini fazlı bir mühendislik projesi olarak ele alıp riski nasıl yöneteceğinizi göstereceğiz.

## Monolitik Kaosa Karşı Fazlı Rollout

Headless geçişin klasik hatası: "büyük patlama" yaklaşımı. Tüm siteyi bir gecede yeni stack'e taşımak, revenue'nun riske atılması demektir. Fazlı rollout, trafiğin kontrollü dilimlerini yeni mimariye yönlendirerek gerçek kullanıcı davranışı üzerinden öğrenme fırsatı sunar.

**Route-based phasing:** İlk faz kategori sayfaları veya PDP'ler olabilir — homepage ve checkout sonraya kalır. Örnek bir 6 haftalık plan:

| Hafta | Scope | Trafik | Risk Metriği |
|---|---|---|---|
| 1-2 | `/collections/{slug}` | %5 | ATC rate, exit rate |
| 3-4 | `/products/{slug}` | %10 | Conversion rate, scroll depth |
| 5 | Homepage | %25 | Bounce rate, session duration |
| 6 | Full rollout | %100 | Revenue impact |

Bu yaklaşımla, kritik hata çıktığında rollback maliyeti minimum kalır — %5 trafik kaybı yerine %100'ü kurtarırsınız.

**Feature flag mimarisi:** LaunchDarkly, Statsig veya Unleash ile yeni frontend'i feature flag arkasında çalıştırın. Örnek Node.js snippet (Unleash):

```javascript
const unleash = require('unleash-client');

unleash.on('ready', () => {
  const isHeadlessEnabled = unleash.isEnabled('headless-pdp', {
    userId: user.id,
    sessionId: req.sessionID
  });

  if (isHeadlessEnabled) {
    res.render('pdp-headless'); // Next.js, Nuxt veya Remix
  } else {
    res.render('pdp-legacy'); // Liquid, Blade vb
  }
});
```

Bu kod, kullanıcı bazında frontend'i değiştirmenize olanak tanır. Aynı session'da eski/yeni deneyimi A/B test edip conversion delta'sını gerçek zamanlı okuyabilirsiniz.

## SEO Otoritesini Korumak: URL Parity ve Redirect Disiplini

Headless geçişte en büyük gizli maliyet SEO erozyonudur. Yeni stack URL yapısını değiştiriyorsa, Google'ın o URL için biriktirdiği backlink gücü, crawl budget'ı ve tarihsel trafik verisini kaybedersiniz.

**URL parity zorunluluğu:** Eski ve yeni sistem aynı slug yapısını korumalı. Örneğin, Shopify'dan Hydrogen'a geçerken:

```
Eski: /products/erkek-sneaker-beyaz
Yeni: /products/erkek-sneaker-beyaz
```

Slug üretim logic'i değişse bile, output aynı olmalı. Bunu garanti altına almak için migration öncesi:

1. Eski sistemden tüm URL'leri dump edin (CSV, 30 gün traffic verisi ile birleştirin)
2. Yeni sistemde aynı URL'leri canary route ile test edin
3. Diff'i sıfırlayın — tek fark bile SEO kayıp demektir

**301 vs 302 tradeoffu:** Geçici redirectler (302) Google'a "bu URL geçici olarak başka yerde" sinyali verir, kalıcı redirectler (301) "bu URL artık burada" der. Fazlı rollout sırasında 302 kullanmak mantıklıdır — tam rollout'ta 301'e geçersiniz. Ancak 302'yi 4 haftadan uzun kullanırsanız, Google yine de kalıcı kabul edebilir (John Mueller, 2024).

**Canonical tag disiplini:** Yeni frontend server-side render ediyorsa, `<link rel="canonical">` tag'ini eski URL'yi işaret eder şekilde ayarlayın. Bu, Google'a "asıl otorite hâlâ eski domain" mesajını verir. Örnek Next.js:

```jsx
// pages/products/[slug].jsx
export async function generateMetadata({ params }) {
  return {
    alternates: {
      canonical: `https://legacy.site.com/products/${params.slug}`
    }
  };
}
```

Full rollout'ta bu tag'i kaldırıp yeni domain'e çekersiniz.

## Add-to-Cart Abandon Analizi: Gizli Sürtünme Noktalarını Yakalamak

Headless geçişte conversion rate düşüşü genelde checkout'ta değil, sepete ekleme öncesinde başlar. Kullanıcı eski sistemde 3 tıkla sepete ekliyorsa, yeni sistemde 4 tık veya 1 saniye daha uzun load time yeterli sebeptir.

**Kritik metrikler:**
- **ATC rate:** Ürün sayfası ziyaret / sepete ekleme oranı
- **Click-to-ATC latency:** Butona tıklama ile confirmation arasındaki süre (hedef <600ms)
- **Exit rate on PDP:** ATC öncesi çıkış (yeni frontend'te %12'den yüksekse alarm)

Bu metrikleri hem eski hem yeni sistemde paralel toplayın. BigQuery + GA4 ile:

```sql
SELECT
  page_location,
  event_name,
  COUNTIF(event_name = 'add_to_cart') / COUNT(*) AS atc_rate,
  AVG(TIMESTAMP_DIFF(atc_timestamp, page_view_timestamp, MILLISECOND)) AS click_latency_ms
FROM `project.dataset.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260701' AND '20260731'
  AND event_name IN ('page_view', 'add_to_cart')
GROUP BY page_location
HAVING atc_rate < 0.08 -- %8'in altı kritik
ORDER BY click_latency_ms DESC;
```

Bu sorgu, hangi ürün kategorilerinde ATC rate'in düştüğünü ve latency'nin arttığını gösterir. Örneğin, "beyaz ayakkabı" kategorisinde yeni frontend'te latency 1200ms ise, bundle size veya API call overhead'ini inceleyin.

**Session replay tradeoffu:** Hotjar, LogRocket gibi araçlar her pixel'i kaydeder ancak kullanıcı gizliliği riski taşır. Alternatif: FullStory'nin "frustration signal" API'si — sadece hızlı tıklama, hata mesajı, boş alan tıklama gibi anomalileri yakalar, tüm session'u kaydetmez.

## Composable Mimaride Rollback Stratejisi

Headless stack genellikle birden fazla bileşenden oluşur: frontend (Next.js, Nuxt), CMS (Contentful, Sanity), commerce engine (Shopify, commercetools), search (Algolia, Typesense). Bu parçalardan biri çökerse, rollback planı net olmalı.

**Circuit breaker pattern:** Her third-party servise timeout + retry limiti koyun. Örnek, Shopify Storefront API için:

```javascript
const fetchProduct = async (handle) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout

  try {
    const response = await fetch(`https://shop.myshopify.com/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Storefront-Access-Token': token },
      body: JSON.stringify({ query: productQuery, variables: { handle } }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      // Timeout: fallback to cached data or legacy API
      return fetchFromLegacySystem(handle);
    }
    throw err;
  }
};
```

Bu kod, Shopify API 3 saniyede yanıt vermezse eski sisteme fallback eder. Kullanıcı deneyimi kesintisiz kalır.

**Automated rollback tetikleyicisi:** Prometheus + Alertmanager ile error rate %2'yi geçerse otomatik rollback:

```yaml
groups:
  - name: headless_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{job="headless-frontend",status=~"5.."}[5m]) > 0.02
        for: 2m
        actions:
          - trigger_rollback: true
            target_version: "legacy-stable"
```

Bu YAML, error rate 2 dakika boyunca %2'nin üstündeyse feature flag'i kapatıp trafiği eski sisteme yönlendirir.

## Kapanış: Risk Yönetimi Bir Süreç, Tek Seferlik Proje Değil

Headless geçiş, migration sonrası 90 gün boyunca aktif izleme gerektirir. Core Web Vitals (LCP, CLS, FID), conversion funnel metrikleri ve server-side error rate'leri haftalık dashboard'larda takip edilmeli. İlk 30 günde sorun çıkmazsa bile, trafik seasonality'si (örneğin Black Friday) yeni yük patternleri ortaya çıkarabilir.

[Headless Commerce](https://www.roibase.com.tr/tr/headless) yaklaşımı, doğru fazlı rollout ve metrik disiplini ile e-ticaret altyapınızı güvenli şekilde dönüştürmenize olanak tanır. Süreç boyunca sürtünme noktalarını yakalamak, SEO otoritesini korumak ve rollback planını hazır tutmak, headless'in vaat ettiği hız ve esnekliği gerçek revenue artışına çevirir.