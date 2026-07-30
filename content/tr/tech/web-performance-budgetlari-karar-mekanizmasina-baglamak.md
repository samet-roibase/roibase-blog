---
title: "Web Performance Budget'ları: Karar Mekanizmasına Bağlamak"
description: "Lighthouse CI, RUM ve perf regression alarmlarını CI/CD pipeline'ına entegre edip yavaşlamayı deploy anında durdurmak — gerçek uygulama senaryoları."
publishedAt: 2026-07-30
modifiedAt: 2026-07-30
category: tech
i18nKey: tech-004-2026-07
tags: [web-performance, lighthouse-ci, rum, performance-budget, core-web-vitals]
readingTime: 8
author: Roibase
---

Performance regression'ı canlıya çıktıktan sonra keşfetmek döviz bürosu gibi: kurdan önce kurdan sonra. 2026'da Google'ın Commerce Signals raporuna göre, her 100ms ekstra LCP %3.5 bounce artışı getiriyor. Bug'ları deployment öncesinde yakaladığımız gibi, yavaşlamayı da CI/CD pipeline'ında yakalamak gerekiyor. Bu yazıda Lighthouse CI, RUM, synthetic monitoring ve performance budget'ları nasıl entegre eder, deploy'u nasıl durdurursunuz — kod ve sayı ile göstereceğiz.

## Performance Budget Nedir, Neden CI/CD'de Zorunlu

Performance budget, sayfanın performans için tüketebileceği kaynak miktarının üst sınırı. Örnek: "Ana sayfa LCP < 2s, Total Blocking Time < 200ms, JS bundle < 400KB". Bu bir SLA gibi çalışır: sayılardan biri aşılırsa build FAIL olur, canlıya çıkamaz.

Klasik yaklaşım — her sprint sonunda manuel Lighthouse raporu çekip bakmak — regression'ı 2 hafta geç gösterirdi. Modern yaklaşımda budget CI'ya gömülü. Her pull request, Lighthouse CI üzerinden koşuyor, headless Chromium ile sayfayı render ediyor, performans metrikleri ölçüyor. Budget aşılırsa GitHub Action hata veriyor, merge ettiremiyorsun.

Örnek senaryo: Shopify Hydrogen storefront'ında yeni bir product recommendation widget eklendiğinde bundle size 340KB'den 510KB'ye çıktı. CI pipeline'ı bunu anında yakaladı, PR'yi kırmızı yaptı. Widget lazy-load ile optimize edilene kadar deploy engellendi. Eski akışta bu canlıya çıkıp iki gün kayıp olurdu — 510KB bundle, mobil 3G'de 4s ekstra blocking time demekti.

Performance budget kurmak için `lighthouse-ci` kullanacağız. Lighthouse CI, deployment preview URL'ini alıyor, Chromium'da render ediyor, Core Web Vitals + custom metrikleri ölçüyor, budget JSON dosyasıyla karşılaştırıyor.

```json
// lighthouserc.json
{
  "ci": {
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2000 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "speed-index": ["error", { "maxNumericValue": 3000 }],
        "resource-summary:script:size": ["error", { "maxNumericValue": 400000 }]
      }
    },
    "collect": {
      "numberOfRuns": 3,
      "url": ["https://preview-{PR_NUMBER}.vercel.app"],
      "settings": {
        "throttling": {
          "rttMs": 150,
          "throughputKbps": 1638.4,
          "cpuSlowdownMultiplier": 4
        }
      }
    }
  }
}
```

`numberOfRuns: 3` variability'yi azaltır. Medyan değeri alır. `throttling` mobil 3G koşulu simüle eder — gerçek kullanıcının en kötü senaryosu budur.

## Lighthouse CI'yı GitHub Actions ile Otomatikleştirmek

CI pipeline'ında Lighthouse'u koşturmak için Vercel preview deployment + GitHub Actions kullanacağız. Her PR açıldığında Vercel otomatik preview URL yaratıyor, Lighthouse CI bu URL'i tarıyor. Sonuçlar GitHub PR'ına yorum olarak düşüyor. Budget aşılırsa CI fail oluyor.

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - name: Wait for Vercel Preview
        uses: patrickedqvist/wait-for-vercel-preview@v1.3.1
        id: vercel_preview
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          max_timeout: 300
      - name: Run Lighthouse CI
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_TOKEN }}
        run: |
          npm install -g @lhci/cli
          lhci autorun --collect.url=${{ steps.vercel_preview.outputs.url }}
      - name: Comment PR
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: ${{ steps.vercel_preview.outputs.url }}
          uploadArtifacts: true
          temporaryPublicStorage: true
```

`wait-for-vercel-preview` adımı kritik: Vercel deployment bitmeden Lighthouse koşarsa 404 bulur. `max_timeout: 300` ile 5 dakika bekletiyoruz. Deployment tamamlanınca Lighthouse başlıyor.

Sonuç PR'a şöyle düşüyor:

```
Lighthouse CI Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Performance: 92/100 (+2)
❌ LCP: 2.3s (budget: 2.0s) — FAILED
✅ TBT: 180ms (budget: 200ms)
✅ CLS: 0.08 (budget: 0.1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

LCP 2.3s olduğu için CI fail etti. PR merge edilemiyor. Dev gidip hero image lazy-load atladığını görüyor, `loading="eager"` ile düzeltiyor, CI tekrar koşuyor, LCP 1.9s'ye düşüyor, merge açılıyor.

Bu yaklaşım [Headless Commerce](https://www.roibase.com.tr/tr/headless) projelerinde kritik. Hydrogen veya Next.js Commerce storefront'ları her gün yeni component ekliyor. Bir yerde `await fetch()` unwrap edilmezse main thread bloke oluyor. Lighthouse CI bundle size + TBT ile yakalıyor.

## Real User Monitoring ile Canlıdaki Gerçek Sayıları Takip Etmek

Lighthouse CI synthetic monitoring yapar — lab ortamında koşar. Gerçek kullanıcıların cihazı, network'ü, cache durumu farklı. Onun için RUM (Real User Monitoring) gerekiyor. RUM, canlı siteden gelen gerçek metrik akışını toplar.

Web Vitals kütüphanesi ile RUM'u kendi backend'inize gönderebilirsiniz:

```typescript
// analytics/web-vitals.ts
import { onCLS, onFID, onLCP, onTTFB, onINP } from 'web-vitals';

function sendToAnalytics(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: Date.now()
  });

  // Beacon API — sayfa kapansa bile gönderir
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', body);
  } else {
    fetch('/api/vitals', { method: 'POST', body, keepalive: true });
  }
}

onCLS(sendToAnalytics);
onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

Backend `/api/vitals` endpoint'i bu metriği BigQuery veya Cloudflare Analytics'e yazıyor. Günlük aggregate raporu şöyle oluyor:

| Tarih      | LCP p75 | INP p75 | CLS p75 | Sayfa Görüntüleme |
|------------|---------|---------|---------|-------------------|
| 2026-07-28 | 1.8s    | 140ms   | 0.06    | 12,400            |
| 2026-07-29 | 2.1s    | 180ms   | 0.09    | 13,100            |
| 2026-07-30 | 3.2s    | 320ms   | 0.14    | 11,800            |

29 Temmuz'da deploy vardı. LCP 2.1s'den 3.2s'ye çıktı, INP 180ms'den 320ms'ye fırladı. Bounce rate %4.2 arttı. RUM sayıları bunu canlıda 2 saat içinde gösterdi — Lighthouse CI lab ortamında 2.0s'nin altındaydı ama gerçek kullanıcılar daha yavaş cihazlardaydı.

Bu durumda rollback kararı RUM sayısına bakılarak alındı. Deployment geri alındı, LCP tekrar 1.9s'ye düştü.

### RUM Alarm Pipeline'ı

RUM metriklerini sadece dashboard'da göstermek yetmez. Regression anında slack alarm'ı gerekir. BigQuery üzerinde scheduled query kurabilirsiniz:

```sql
-- BigQuery scheduled query (her saat)
WITH current_hour AS (
  SELECT
    APPROX_QUANTILES(lcp_value, 100)[OFFSET(75)] AS lcp_p75,
    APPROX_QUANTILES(inp_value, 100)[OFFSET(75)] AS inp_p75
  FROM `project.dataset.web_vitals`
  WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
),
baseline AS (
  SELECT
    APPROX_QUANTILES(lcp_value, 100)[OFFSET(75)] AS lcp_p75_baseline
  FROM `project.dataset.web_vitals`
  WHERE timestamp BETWEEN TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 8 HOUR)
    AND TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR)
)
SELECT
  c.lcp_p75,
  b.lcp_p75_baseline,
  (c.lcp_p75 - b.lcp_p75_baseline) / b.lcp_p75_baseline * 100 AS lcp_regression_pct
FROM current_hour c, baseline b
WHERE (c.lcp_p75 - b.lcp_p75_baseline) / b.lcp_p75_baseline > 0.15
```

Bu query LCP p75'in baseline'a göre %15'ten fazla kötüleşip kötüleşmediğini kontrol ediyor. Eğer kötüleşmişse Cloud Function tetikleniyor, Slack webhook'una alert gönderiyor:

```
⚠️ Performance Regression Detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LCP p75: 3.2s (+68% vs 6h baseline)
Baseline: 1.9s
URL: /product/xyz
Deploy: #4521 (30 min ago)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Tradeoff: Synthetic vs RUM, Nerede Hangi Sayıyı Kullanmalı

Lighthouse CI ve RUM birbirini tamamlar — ikisinden birini tercih etmek değil, ikisini paralel kullanmak doğru strateji.

**Lighthouse CI (synthetic):**
- **Avantaj:** Kontrollü ortam, tekrarlanabilir, her commit'te koşar
- **Dezavantaj:** Gerçek cihaz varyasyonunu görmez, cached asset durumunu simüle edemez
- **Kullanım:** CI pipeline'ında regression prevention — "bu PR merge olursa yavaşlama riski var mı?"

**RUM (real user):**
- **Avantaj:** Gerçek kullanıcı verisi, edge case'leri yakalar (örn "iPhone 11 Safari'de LCP 5s")
- **Dezavantaj:** Gürültülü veri (outlier çok), deployment öncesinde bilgi vermez
- **Kullanım:** Canlı monitoring — "yeni deployment performansı bozdu mu?"

Kararlı sistem her ikisini de kullanır. CI'da Lighthouse budget aşılırsa deployment duruyor. Deployment geçerse RUM 2 saat içinde gerçek sayıyı doğruluyor. Eğer RUM'da regression görülürse rollback.

Örnek: Shopify storefront'ında yeni variant selector component'i eklendiğinde Lighthouse CI 380ms TBT gösterdi (budget: 200ms). PR reddedildi. Dev component'i code-split ile ayırdı, lazy-load ekledi. Lighthouse CI 150ms TBT gösterdi, merge oldu. Canlıya çıktıktan 4 saat sonra RUM verisinde INP p75 120ms'den 145ms'ye çıktı — kabul edilebilir (budget 200ms). Deployment kaldı.

## Regression Alarmlarını Deployment Pipeline'ına Entegre Etmek

RUM alarm'ı deployment'tan bağımsız koşarsa context kaybı olur. "LCP kötüleşti" bildirimi gelir ama hangi deployment'ın sebebiyet verdiği bilinmez. Bu yüzden deployment metadata'sını RUM event'ine eklememiz gerekiyor.

Vercel veya Netlify deployment'ında `VERCEL_GIT_COMMIT_SHA` environment variable'ı var. Bunu frontend'e inject ederek her RUM event'ine ekliyoruz:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      deploymentId: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
      deploymentTime: Date.now()
    }
  }
});

// analytics/web-vitals.ts
function sendToAnalytics(metric: Metric) {
  const config = useRuntimeConfig();
  const body = JSON.stringify({
    ...metric,
    deploymentId: config.public.deploymentId,
    deploymentTime: config.public.deploymentTime
  });
  navigator.sendBeacon('/api/vitals', body);
}
```

BigQuery'de şöyle sorguluyoruz:

```sql
SELECT
  deployment_id,
  FROM_UNIXTIME(deployment_time / 1000) AS deployed_at,
  APPROX_QUANTILES(lcp_value, 100)[OFFSET(75)] AS lcp_p75,
  COUNT(*) AS sample_size
FROM `project.dataset.web_vitals`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
GROUP BY deployment_id, deployment_time
ORDER BY deployed_at DESC
```

Sonuç:

| deployment_id | deployed_at         | lcp_p75 | sample_size |
|---------------|---------------------|---------|-------------|
| a3f2b19       | 2026-07-30 14:22:00 | 3.1s    | 2,340       |
| c8d4e21       | 2026-07-30 09:15:00 | 1.9s    | 4,120       |

14:22'deki deployment'tan sonra LCP 1.9s'den 3.1s'ye fırlamış. Commit SHA ile GitHub'da PR bulunuyor, kod inceleniyor. Sorun: hero image `srcset` attribute'u kaldırılmış, tarayıcı 4K masaüstü için 3MB resim indirmiş. Rollback yapılıyor, LCP tekrar 1.9s'ye düşüyor.

## Kapanış: Performans Bütçesi Bir SLA, Test Edilmeden Canlıya Çıkmaz

Performance budget'ı SLA gibi ele almalısınız — müşteriye verilen bir garanti. "LCP 2s altında" diyorsanız her deployment'ın bu garantiyi koruduğunu CI/CD pipeline'ında kanıtlamanız gerekiyor. Lighthouse CI deployment öncesi sayıyı veriyor, RUM deployment sonrası doğruluyor. İki katman birlikte çalışmazsa regression ya geç keşfedilir ya hiç keşfedilmez. 2026'da Google'ın ranking algoritmasında Core Web Vitals ağırlığı arttıkça, performance regression'ı SEO regression'ına dönüşüyor. Bütçe kurun, CI'ya bağlayın, alarm kurun, deploy edin.