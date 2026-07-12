---
title: "Web Performance Budget'ları: Karar Mekanizmasına Bağlamak"
description: "Lighthouse CI, RUM ve perf regression alarmlarıyla web performansını ölçülebilir KPI'ya dönüştürün. Kararı sayıya bağlayın."
publishedAt: 2026-07-12
modifiedAt: 2026-07-12
category: tech
i18nKey: tech-004-2026-07
tags: [web-performance, lighthouse-ci, rum, core-web-vitals, devops]
readingTime: 8
author: Roibase
---

Web performansı "iyi olsun" değil, kararı etkileyen sayıdır. 2026'da FID'in yerini aldığı INP metriği, 200ms'nin altında kalmazsa mobile dönüşüm %15-20 düşer (Google Chrome UX Report 2025 cohort). Bu seviyeyi tutturmak için tahmin değil, CI pipeline'ında otomatik kontrol gerekiyor. Lighthouse CI, RUM ve regression alarm sistemi kurarken hangi eşikleri nereye bağlamalısınız, hangi metrik kararın neresinde durur? Bu yazıda performans budget'ını testten karar mekanizmasına bağlama mimarisini somut sayılarla açıyoruz.

## Performance Budget Nedir, Sprint Planına Nasıl Bağlanır

Performance budget, bir sayfanın yüklenme süresi, bundle size ve runtime metriklerinin üst sınırıdır. Total bundle 250KB'ı geçmeyecek, FCP 1.2s'den uzun sürmeyecek, INP 200ms'yi aşmayacak — bunlar budget. Sprint başında belirlenir, PR merge kriteri olur. Eğer yeni feature bu eşikleri patlatırsa ya kodu refactor edersiniz ya feature'ı ertelenir ya da budget'ı güncelersiniz (ama dönüşüm kaybını kabul ederek).

Budget'ı belirlerken üç kaynak kullanılır: (1) Google'ın Core Web Vitals eşikleri (LCP <2.5s, INP <200ms, CLS <0.1), (2) RUM datasından p75 benchmark (trafiğinizin %75'i bu seviyeyi geçmiyorsa "iyi"), (3) dönüşüm korelasyon raporu (LCP her 100ms artışında conversion -2% düşüyorsa, 2.5s eşiği 3s'ye çıkarırsanız %10 kayıp anlamına gelir). Budget tek bir sayı değil, metrik bazında ayırılır:

| Metrik | Eşik | Kaynak |
|--------|------|--------|
| LCP | <2.5s | CWV resmi |
| INP | <200ms | CWV 2024+ |
| CLS | <0.1 | CWV resmi |
| Total JS | <300KB gzip | HTTP Archive p75 |
| FCP | <1.8s | Internal RUM |

Bu tabloyu `performance.config.json` dosyasına yazarsınız, Lighthouse CI bu dosyayı okur, PR'da eşik ihlali varsa fail eder.

## Lighthouse CI: PR Merge Kriteri Olarak Perf

Lighthouse CI, her PR'da Lighthouse audit çalıştırıp sonuçları CI log'una yazan araçtır (Google tarafından açık kaynak). GitHub Actions, GitLab CI, CircleCI ile entegre edilir. Temel akış: (1) PR açılır, (2) CI build yapar, (3) `lhci autorun` komutu test ortamında sayfayı ziyaret eder, (4) Lighthouse skorlarını performance.config.json'daki budget'la karşılaştırır, (5) eşik ihlali varsa PR fail olur, merge bloklenir.

Örnek konfigürasyon (`.lighthouserc.json`):

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/", "http://localhost:3000/product/sample"],
      "numberOfRuns": 3
    },
    "assert": {
      "preset": "lighthouse:no-pwa",
      "assertions": {
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "interactive": ["error", {"maxNumericValue": 3500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "total-byte-weight": ["warn", {"maxNumericValue": 307200}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

Bu config LCP >2.5s olursa PR'ı fail eder, total byte 300KB'ı geçerse warning (merge'i bloklamaz ama log'da görünür). 3 run ortalama alınır çünkü tek run'da network variance yüksek. Lighthouse CI'ın tradeoff'u: local dev sunucusunda çalışır, production CDN'i simüle edemez. Sonuçlar "worst case scenario" sayılır, production'da daha iyi olur ama eşikleri yine de geçmemelisiniz.

### Lighthouse CI + Vercel Preview: Gerçek Staging Test

Vercel/Netlify gibi platformlarda PR preview URL'i otomatik oluşur. Lighthouse CI'ı preview URL'e bağlarsanız production-like ortamda test edersiniz. GitHub Actions örneği:

```yaml
- name: Run Lighthouse CI
  env:
    LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_TOKEN }}
  run: |
    npm install -g @lhci/cli
    lhci autorun --collect.url=${{ steps.vercel.outputs.preview-url }}
```

`steps.vercel.outputs.preview-url` Vercel action'ından alınır. Bu kurulumla CDN caching, edge SSR, image optimization testi yapabilirsiniz. Eşik ihlali olursa PR'da comment düşer, team notification gönderilir (Slack webhook ekleyerek).

## RUM: Gerçek Kullanıcı Datasından Budget Kalibrasyonu

Lighthouse CI sentetik test — kontrollü ortam, her zaman aynı network koşulu. RUM (Real User Monitoring) gerçek ziyaretçilerden toplanan metrik. Fark kritik: Lighthouse 3G throttling simüle eder, RUM 4G/5G/fiber karışımını gösterir; Lighthouse cold cache test eder, RUM repeat visitor cache etkisini yakalar. Budget'ı sadece Lighthouse'a göre ayarlarsanız gerçek kullanıcı deneyimini kaçırırsınız.

RUM toplayıcı olarak Web Vitals JS library (Google'ın resmi kütüphanesi) kullanılır. Her sayfa yüklenmesinde CWV metriklerini ölçer, beacon endpoint'e gönderir. Örnek implementasyon:

```javascript
import {onCLS, onINP, onLCP} from 'web-vitals';

function sendToAnalytics(metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    rating: metric.rating
  });
  navigator.sendBeacon('/analytics', body);
}

onCLS(sendToAnalytics);
onINP(sendToAnalytics);
onLCP(sendToAnalytics);
```

Backend `/analytics` endpoint'i bu dataları BigQuery'ye yazıyor (Google Analytics 4 yerine first-party veri tercih ediyorsanız, GA4 sampling yapar). BigQuery'de p75 hesaplarsınız:

```sql
SELECT
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS p75_lcp
FROM metrics
WHERE name = 'LCP' AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY);
```

Çıkan sayı 2.8s ise budget'ınız (2.5s) gerçek trafiğin altında — ya budget'ı 2.8s'ye yükseltirsiniz ya kodu optimize edersiniz. P75 tercih edilir çünkü %75 kullanıcı bu seviyenin altında kalıyor anlamına gelir, Google da CWV skorunu p75 üzerinden hesaplıyor.

### RUM + Segment: Cihaz/Bölge Bazlı Budget

Tüm trafik tek budget'la yönetilmez. Mobile LCP desktop'tan %40 daha yüksek (Chrome UX Report 2025), Hindistan trafiği ABD trafiğinden %60 daha yavaş. RUM datasını segment ederek budget farklılaştırabilirsiniz:

| Segment | LCP Budget | INP Budget |
|---------|------------|------------|
| Desktop | 2.2s | 180ms |
| Mobile | 3.0s | 220ms |
| India | 3.5s | 250ms |

Bu ayrımı yapmak için RUM beacon'a `deviceType` ve `country` alanı ekleyin (GeoIP lookup backend'de), BigQuery'de `GROUP BY device` ile analiz edin. Lighthouse CI multi-config desteklemiyor ama farklı workflow'lar kurabilirsiniz (örn. `lhci-mobile.json` + `lhci-desktop.json`).

## Regression Alarm: Performans Düşünce Slack'e Düşsün

Budget belirlendi, CI kontrol ediyor, RUM toplanıyor — ama production'da regression olursa ne yapacaksınız? Yeni deploy sonrası LCP 2.3s'den 2.9s'ye fırladıysa bunu 3 saat sonra farketmek yerine 5 dakikada alarm almalısınız. Bu için RUM datasını 5dk interval'de analiz eden job kurulur (Cloudflare Workers Cron, AWS Lambda EventBridge, GCP Cloud Scheduler).

Örnek alarm mantığı (pseudo-code):

```javascript
// Her 5dk çalışan worker
async function checkRegression() {
  const current = await query('SELECT AVG(value) FROM metrics WHERE name="LCP" AND timestamp > NOW() - INTERVAL 5 MINUTE');
  const baseline = await query('SELECT AVG(value) FROM metrics WHERE name="LCP" AND timestamp BETWEEN NOW() - INTERVAL 1 DAY AND NOW() - INTERVAL 1 HOUR');
  
  if (current > baseline * 1.15) { // %15 artış
    await sendSlack({
      text: `🚨 LCP regression: ${current}ms (baseline ${baseline}ms)`,
      channel: '#performance-alerts'
    });
  }
}
```

Baseline 1 saat öncesine kadar gider çünkü son 5dk deploy olmuş olabilir. %15 eşiği kalibre edilir — %10 ise çok hassas (false positive), %25 ise çok geç. Slack yerine PagerDuty, Opsgenie gibi on-call sistemi entegre edebilirsiniz. Alarm gidince team rollback kararı verir ya da hotfix açar.

### Regression Root Cause: Lighthouse Diff

Alarm geldi, LCP patladı — neden? Lighthouse CI sadece eşik kontrolü yapar, root cause analizi vermez. Lighthouse Diff aracıyla iki build arasındaki audit farkını görebilirsiniz. `lhci compare` komutu iki Lighthouse raporu alır, delta hesaplar:

```bash
lhci compare --base=build-1234 --head=build-1235 --preset=lighthouse:all
```

Output: "unused-javascript increased by 45KB", "server-response-time +120ms". Bu sayılar root cause'u daraltır. Bundle analyzer (webpack-bundle-analyzer, Next.js analyze) ile 45KB nereden geldi bulunur, server trace log'u ile 120ms delay'in kaynağı bulunur.

## Performansı Dönüşüme Bağlamak: Attribution Model

Budget'lar teknik sayıdır ama karar mekanizmasına bağlamak için business metriğe çevrilmeli. "LCP 2.5s'den 3s'ye çıkarsa conversion rate %4 düşer" gibi korelasyon raporu gerekir. Bu rapor A/B test veya cohort analizi ile üretilir. A/B test: trafiğin %50'sine yavaş build sunulur (Lighthouse'dan 500ms gecikme ekleyerek), conversion karşılaştırılır. Cohort analizi: RUM datasında LCP <2s olan ziyaretçilerin conversion rate'i vs LCP >3s olanların rate'i hesaplanır.

Google Analytics 4 + BigQuery export ile korelasyon SQL'i:

```sql
SELECT
  CASE 
    WHEN lcp < 2000 THEN 'fast'
    WHEN lcp BETWEEN 2000 AND 4000 THEN 'medium'
    ELSE 'slow'
  END AS lcp_bucket,
  COUNT(DISTINCT user_pseudo_id) AS users,
  COUNTIF(event_name = 'purchase') / COUNT(DISTINCT session_id) AS conversion_rate
FROM analytics_events
LEFT JOIN rum_metrics ON analytics_events.session_id = rum_metrics.session_id
GROUP BY lcp_bucket;
```

Çıkan tablo:

| LCP Bucket | Conversion Rate |
|------------|-----------------|
| fast | 4.2% |
| medium | 3.6% |
| slow | 2.9% |

Bu sayılarla budget'ın ROI'si hesaplanır: LCP'yi 3s'den 2.5s'ye düşürürseniz conversion %3.6'dan %4.2'ye çıkar, +%16.7 lift. Aylık 100K ziyaretçi varsa +1670 conversion, AOV $50 ise +$83K revenue. Bu rapor CTO'ya değil CFO'ya sunulur, performans optimizasyon sprint'inin önceliği böyle belirlenir.

### Budget İhlali: Tradeoff Kararı

Sprint'te yeni feature geldi, bundle 50KB şişti, budget patladı. Ne yapmalı? Üç seçenek: (1) Feature'ı refactor et (code-split, lazy load), (2) budget'ı güncelleyip dönüşüm kaybını kabul et, (3) feature'ı ertele. Karar sayıya bağlı: 50KB şişme LCP'ye +200ms ekliyor (Lighthouse trace), +200ms conversion'ı %2 düşürüyor (RUM korelasyon), feature'ın getireceği lift %5 ise net kazanç %3 — devam et. Eğer lift %1 ise net %1 kayıp — ertele.

Bu hesabı yapmak için "performance cost estimator" oluştururuz (internal tool). Input: bundle size delta, output: tahmini LCP delta + conversion impact. Model basit regresyon: her 10KB bundle +30ms LCP, her 100ms LCP -%0.8 conversion (kendi RUM datasından çıkarmışsınız). Tool PM'e gösterilir, feature roadmap'inde priority ayarlanır.

## Headless Commerce: Perf Budget'ı Ürün Hızına Bağlamak

E-ticaret platformunda performans = revenue. [Headless commerce](https://www.roibase.com.tr/tr/headless) mimarisi (Shopify Hydrogen, Remix, Next.js) ile frontend bundle kontrolü sizde ama backend API latency'si de budget'a dahil. Shopify Storefront API ortalama 150ms response verir, bunu budget'a eklersiniz: LCP = TTFB (150ms) + FCP (800ms) + LCP delta (600ms) = 1550ms. Budget 2500ms ise 950ms marjiniz var.

Headless'ta regression kaynağı genelde (1) API query complexity artışı (GraphQL depth +2 level = +50ms), (2) SSR component count artışı (20 component = +100ms hydration), (3) third-party script eklenmesi (analytics tag = +200ms). Lighthouse CI bu üçünü ayırt edemez, RUM trace log gerekir. Next.js Middleware'de `Server-Timing` header ekleyerek API latency'yi breakdown edebilirsiniz:

```javascript
export function middleware(req) {
  const start = Date.now();
  const res = NextResponse.next();
  res.headers.set('Server-Timing', `api;dur=${Date.now() - start}`);
  return res;
}
```

Chrome DevTools Network tab'da Server-Timing görünür, RUM beacon'a eklersiniz, regression alarm kurarsınız.

Web performance budget'ı karar mekanizmasına bağlamak için üç katman gerekiyor: (1) Lighthouse CI ile CI/CD'de eşik kontrolü, (2) RUM ile gerçek kullanıcı datasından budget kalibrasyonu, (3) regression alarm + dönüşüm korelasyonu ile business impact attribution. Budget tek sayı değil segment bazlı farklılaştırılır (mobile/desktop, bölge). Eşik ihlali olunca tradeoff analizi yapılır — feature liftini perf kaybıyla karşılaştırırsınız. Headless commerce gibi API-heavy mimarilerde TTFB breakdown budget'a dahil edilir. Performans "iyi olsun" değil, conversion lift'in girdisidir.