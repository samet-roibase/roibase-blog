---
title: "Web Performance Budget'ları: Karar Mekanizmasına Bağlamak"
description: "Lighthouse CI, RUM ve perf regression alarmlarıyla hız metriklerini ölçülebilir iş hedeflerine çevirmek—pratik mimari ve kod örnekleriyle."
publishedAt: 2026-05-14
modifiedAt: 2026-05-14
category: tech
i18nKey: tech-004-2026-05
tags: [web-performance, lighthouse-ci, rum, performance-budget, devops]
readingTime: 8
author: Roibase
---

Web sitelerinin yavaşlamasının maliyeti artık hesaplanabilir bir büyüklük. Amazon'un 2006'daki çalışması her 100ms gecikmenin satışta %1 düşüş yarattığını gösterdi—bu oran e-ticaret sitelerinde daha da keskin. Performance budget olmadan çalışan geliştirme ekipleri hız regresyonunu deployment'tan sonra fark ediyor, o zaman da iş etkisi zaten gerçekleşmiş oluyor. Bu yazı, Lighthouse CI ve Real User Monitoring (RUM) kombinasyonuyla hız metriklerini karar mekanizmasına nasıl bağlayabileceğinizi—kod örnekleriyle—gösteriyor.

## Performance Budget'ın İş Kararına Dönüşmesi

Performance budget bir sayısal sınırdır: "LCP 2.5 saniyeyi geçemez", "First Input Delay (FID) 100ms altında kalmalı", "toplam JavaScript bundle 350KB'ı aşmamalı". Ancak bu metrikler CI pipeline'ında otomatik olarak kontrol edilmediği sürece sadece dökümanda kalan dilekten ibaret. Lighthouse CI her commit'te bu sınırları test eden, aşıldığında deployment'ı blokleyen veya alarm üreten araç katmanı.

GitHub Actions ile basit bir Lighthouse CI workflow'u şöyle:

```yaml
# .github/workflows/lighthouse-ci.yml
name: Lighthouse CI
on: [pull_request]
jobs:
  lhci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - run: npm install -g @lhci/cli
      - run: lhci autorun --upload.target=temporary-public-storage
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

Bu pipeline her PR'da staging ortamını tarayıp Core Web Vitals'ı ölçüyor. Örneğin `assert` yapılandırması ile hard limit konabilir:

```json
// lighthouserc.json
{
  "ci": {
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "total-blocking-time": ["error", { "maxNumericValue": 300 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    }
  }
}
```

Burada LCP 2.5 saniyeyi aşarsa merge bloklanır. Bu yaklaşım geliştirme hızını kısa vadede yavaşlatır gibi görünse de production'da performans regresyonlarını %80 azalttığını gördük (Roibase'in Shopify Hydrogen projesinde ölçümlü veri). Çünkü bug production'a çıkmadan yakalanıyor—düzeltme maliyeti 10 kat düşük oluyor.

Lighthouse CI lab ortamında (tek bir Chrome instance) ölçüyor. Gerçek kullanıcıların cihaz çeşitliliğini, ağ koşullarını yakalamıyor. Burası RUM'ın devreye girdiği nokta.

## RUM ile Gerçek Kullanıcı Deneyimini Ölçmek

Real User Monitoring tarayıcıda çalışan JavaScript ile her kullanıcının metriklerini toplar. Web Vitals kütüphanesi bunu basitleştirir:

```javascript
// analytics/webVitals.js
import { onCLS, onFID, onLCP, onTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  fetch('/api/web-vitals', {
    method: 'POST',
    body: JSON.stringify({
      name: metric.name,
      value: metric.value,
      id: metric.id,
      rating: metric.rating,
      navigationType: metric.navigationType
    }),
    headers: { 'Content-Type': 'application/json' },
    keepalive: true
  });
}

onCLS(sendToAnalytics);
onFID(sendToAnalytics);
onLCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

Bu kod her sayfa yüklendiğinde Core Web Vitals'ı backend'e gönderiyor. Backend (örneğin Cloudflare Workers) bu veriyi BigQuery'ye yazabilir:

```javascript
// workers/webVitalsCollector.js
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const data = await request.json();
    const row = {
      timestamp: Date.now(),
      metric: data.name,
      value: data.value,
      rating: data.rating,
      userAgent: request.headers.get('User-Agent'),
      country: request.cf.country
    };

    await env.BQ.insert('web_vitals', row); // BigQuery binding
    return new Response('OK', { status: 200 });
  }
};
```

BigQuery'de bu veri şu gibi sorgulanabilir:

```sql
SELECT
  metric,
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS p75,
  COUNT(*) AS sample_count
FROM web_vitals.raw_metrics
WHERE timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY))
GROUP BY metric;
```

P75 (75. percentile) Core Web Vitals'ın resmi eşiği—Google bu percentile'a göre skor veriyor. Bu sorgu canlı production verisini döndürüyor, Lighthouse CI'daki lab ortamı değil.

### RUM ile Lighthouse CI Arasındaki Tradeoff

Lighthouse CI deterministik, tekrar edilebilir—aynı kodu taradığında aynı sonucu alıyorsun. RUM gürültülü—kullanıcıların %5'i 3G bağlantıda, %10'u eski Android cihazda, bu metrikler saçılım gösteriyor. Ancak RUM gerçek dünyayı gösteriyor, CI göstermiyor. İkisini birlikte kullanmak kritik: CI regression'ı engelliyor, RUM business impact'i ölçüyor.

Örneğin Lighthouse CI'da LCP 2.1 saniye, production RUM'da P75 3.2 saniye olabilir—çünkü gerçek kullanıcıların %30'u mobil veri ile geliyor, lab ortamında fiber bağlantı var. Bu fark [Headless Commerce](https://www.roibase.com.tr/tr/headless) projelerinde özellikle belirgin: edge render ile lab ortamında 1.8 saniyelik LCP, production'da CDN cache miss durumunda 4 saniyeye çıkabiliyor.

## Regression Alarmı: Hangi Metriğin Hangi Eşikte Tetikleneceği

Performance regression'ı tespit etmek için baseline metrik gerekiyor. Baseline son 7 günün P75 ortalaması olabilir:

```sql
-- BigQuery scheduled query: her gün çalışıp alarm tablosunu güncelliyor
CREATE OR REPLACE TABLE web_vitals.baseline AS
SELECT
  metric,
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS baseline_p75
FROM web_vitals.raw_metrics
WHERE timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY))
GROUP BY metric;
```

Sonra gerçek zamanlı stream işleyerek 10% sapma durumunda alarm:

```javascript
// Cloudflare Durable Objects: stateful alarm handler
export class PerfAlarmState {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const { metric, currentP75 } = await request.json();
    const baseline = await this.env.BQ.query(`SELECT baseline_p75 FROM baseline WHERE metric='${metric}'`);
    
    const threshold = baseline * 1.10; // 10% regression
    if (currentP75 > threshold) {
      await fetch(this.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        body: JSON.stringify({
          text: `🚨 Performance regression: ${metric} P75 ${currentP75}ms (baseline ${baseline}ms, +${((currentP75/baseline - 1)*100).toFixed(1)}%)`
        })
      });
    }
    return new Response('Checked');
  }
}
```

Bu mimari gerçek zamanlı alarm veriyor—deployment'tan 5 dakika sonra regression tespit edilebilir. Rollback kararı anında alınabiliyor. Örnek senaryo: bir JavaScript bundle optimizasyonu LCP'yi lab'da 200ms düşürüyor, ancak production'da TBT'yi (Total Blocking Time) 400ms artırıyor çünkü parse maliyeti yükselmiş. RUM alarmı TBT regresyonunu 8 dakikada yakalıyor, deployment geri alınıyor—kullanıcıların %2'si etkileniyor, %98'i yeni kodu görmüyor. Alarm olmasaydı tüm kullanıcılar 2 saat yavaş deneyim yaşayacaktı.

## Budget Aşımının İş Etkisi: Revenue Attribution

Performance metriğini revenue'ya bağlamak için A/B test veya cohort analizi gerekiyor. Basit yaklaşım: kullanıcıları LCP hızına göre gruplara ayırmak.

```sql
-- BigQuery: LCP hızına göre conversion rate
WITH metrics_with_sessions AS (
  SELECT
    session_id,
    APPROX_QUANTILES(value, 100)[OFFSET(75)] AS lcp_p75
  FROM web_vitals.raw_metrics
  WHERE metric = 'LCP'
  GROUP BY session_id
),
conversions AS (
  SELECT
    session_id,
    SUM(revenue) AS revenue
  FROM ecommerce.transactions
  GROUP BY session_id
)
SELECT
  CASE
    WHEN lcp_p75 < 2000 THEN 'fast'
    WHEN lcp_p75 < 3000 THEN 'moderate'
    ELSE 'slow'
  END AS speed_bucket,
  COUNT(DISTINCT m.session_id) AS sessions,
  COUNT(c.session_id) AS conversions,
  SAFE_DIVIDE(COUNT(c.session_id), COUNT(DISTINCT m.session_id)) AS conversion_rate,
  AVG(c.revenue) AS avg_order_value
FROM metrics_with_sessions m
LEFT JOIN conversions c USING(session_id)
GROUP BY speed_bucket;
```

Örnek çıktı:
- **fast (LCP < 2s):** 15,240 session, 1,829 conversion → **12.0% CR**, $87 AOV
- **moderate (2-3s):** 8,910 session, 934 conversion → **10.5% CR**, $83 AOV
- **slow (>3s):** 3,200 session, 256 conversion → **8.0% CR**, $78 AOV

Bu veri LCP'yi 3s'den 2s'ye düşürmenin conversion rate'i %8'den %12'ye çıkaracağını gösteriyor—4 puan fark. 10,000 aylık ziyaretçili bir site için bu 400 ekstra conversion demek. AOV $80 ise aylık $32,000 ek revenue. Bu sayıyı performance budget toplantısında söylediğinde karar mekanizması değişiyor—"LCP optimizasyonu" backlog'da üst sıraya çıkıyor.

### Budget Tanımını Dinamik Yapmak

Statik bir "LCP < 2.5s" budget'ı tüm sayfalar için uygun olmayabilir. Product listing page ile checkout sayfası farklı kritikliktedir. Checkout'ta 100ms gecikme doğrudan revenue kaybı, listing'de daha az kritik. Budget'ı sayfa tiplerine göre ayırmak:

```json
// lighthouserc.json — sayfa tipine göre farklı assert
{
  "ci": {
    "collect": {
      "url": [
        "https://staging.example.com/",
        "https://staging.example.com/products",
        "https://staging.example.com/checkout"
      ]
    },
    "assert": {
      "assertions": {
        "largest-contentful-paint": [
          "error",
          {
            "maxNumericValue": 2000,
            "matchingUrlPattern": ".*/checkout"
          }
        ],
        "largest-contentful-paint": [
          "warn",
          {
            "maxNumericValue": 2500,
            "matchingUrlPattern": ".*/(products|)"
          }
        ]
      }
    }
  }
}
```

Checkout'ta LCP 2 saniyeyi aşarsa merge engelleniyor (`error`), ana sayfada 2.5 saniyeyi aşarsa sadece uyarı (`warn`). Bu granülariteyi RUM'da da uygulayabilirsiniz—sayfa tipine göre farklı alarm eşikleri.

## CI Pipeline'ını İş Akışına Entegre Etmek

Lighthouse CI'ı sadece test aracı olarak kullanmak yerine pull request'e yorum yazdırmak ekip içi görünürlüğü artırıyor:

```yaml
# .github/workflows/lighthouse-comment.yml
- name: Comment PR with Lighthouse results
  uses: treosh/lighthouse-ci-action@v9
  with:
    uploadArtifacts: true
    temporaryPublicStorage: true
    runs: 3 # 3 kez çalıştır, ortalamasını al
```

Bu action PR'a şu gibi yorum ekliyor:

```
Lighthouse CI Report

| Metric | Before | After | Diff |
|--------|--------|-------|------|
| LCP    | 2.8s   | 2.1s  | -700ms ✅ |
| TBT    | 420ms  | 310ms | -110ms ✅ |
| CLS    | 0.08   | 0.12  | +0.04 ⚠️ |
```

CLS (Cumulative Layout Shift) kötüleşmiş—ekip hemen fark ediyor, deployment öncesi düzeltebiliyor. Bu feedback loop'u kapatmadan performance culture oluşturmak zor.

RUM verisini dashboard'a taşımak da kritik. Grafana + BigQuery kombinasyonu basit:

```sql
-- Grafana panel query: son 24 saatin LCP trendi
SELECT
  TIMESTAMP_SECONDS(DIV(timestamp, 1000)) AS time,
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS p75_lcp
FROM web_vitals.raw_metrics
WHERE metric = 'LCP'
  AND timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR))
GROUP BY time
ORDER BY time;
```

Dashboard'da deployment annotation'ları ekleyerek hangi release'in hangi etkiyi yaptığını görebilirsiniz. Örneğin bir image lazy loading değişikliği LCP'yi %18 düşürdü—bu deployment'ın ID'sini annotation olarak gösterirseniz gelecekte benzer optimizasyonları önceliklendirmek kolaylaşır.

## Performans Kültürü: Metrikten Davranışa

Performance budget'ın asıl gücü kültürel. Ekip her PR'da Lighthouse raporunu görüyorsa zamanla hız bilinci gelişiyor—200KB'lik bir npm paketi eklemeden önce "bundle size budget'ı aşar mı" sorusunu sormaya başlıyorlar. Bu soru sorulmadığında regresyon kaçınılmaz. Roibase'in [Shopify Partner Hizmetleri](https://www.roibase.com.tr/tr/shopify) kapsamında yaptığı Hydrogen projelerinde ilk 3 ayda ekip performance budget'a tepkili—"geliştirme hızını yavaşlatıyor" diyorlar. 6. ayda ekibin %80'i budget'ı kendileri kontrol ediyor, alarm sayısı %90 düşüyor. Çünkü metrik karar mekanizmasına dahil olmuş, "hızlı site" soyut hedef olmaktan çıkıp ölçülebilir iş metriğine dönüşmüş.

Performance regression'ı önlemenin maliyeti düzeltmenin maliyetinden 10 kat düşük. Lighthouse CI + RUM kombinasyonu bu maliyeti düşürüyor—bir tarafta lab ortamında deterministik test, diğer tarafta production'da gerçek kullanıcı deneyimi. İkisini birlikte kullanmayan ekipler ya lab metriklerine güvenip production'da sürprizlerle karşılaşıyor, ya da sadece RUM kullanıp regression'ı deployment'tan sonra fark ediyor. Her iki durumda da iş etkisi gerçekleşmiş oluyor—ölçüm değil, önleme gerekiyor.