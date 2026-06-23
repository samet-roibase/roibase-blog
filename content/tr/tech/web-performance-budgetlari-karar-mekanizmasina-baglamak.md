---
title: "Web Performance Budget'ları: Karar Mekanizmasına Bağlamak"
description: "Lighthouse CI, RUM ve perf regression alarmlarını sisteme entegre etmek. TBT 2190ms'den 200ms'ye düşürmenin arkasındaki metodoloji."
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: tech
i18nKey: tech-004-2026-06
tags: [web-performance, lighthouse-ci, rum, core-web-vitals, performance-budget]
readingTime: 8
author: Roibase
---

2026'da web performance artık "hızlı sayfa yapma" değil, sürekli kararlar alınan bir mühendislik disiplini. Bir e-ticaret sitesi deploy edersiniz, Lighthouse skoru 92'den 68'e düşer, dönüşüm oranı %3,2'den %2,7'ye iner — ama kimse farketmez çünkü monitoring "server down mu" sorgusuyla sınırlı. Performance budget'ı karar mekanizmasına bağlamak demek, regression'ı deploy öncesi yakalamak, her commit'i LCP/TBT/CLS eşiklerine göre değerlendirmek ve RUM datasını attribution pipeline'ına beslemek demektir. Bu yazıda Lighthouse CI, synthetic monitoring, RUM ve alarm mimarisini entegre bir sisteme nasıl dönüştüreceğimizi göstereceğiz.

## Performance Budget Nedir ve Neden Bir İnsan Değil Sistem Ölçmeli

Performance budget, sayfa başına resource limitlerini tanımlayan sayısal eşiklerdir: maksimum JavaScript bundle size (örn 200 KB gzip), maksimum TBT (Total Blocking Time, 200 ms), maksimum LCP (Largest Contentful Paint, 2,5 saniye). Bu sayılar keyfi değil — Google'ın Core Web Vitals eşikleri "iyi" bandını tanımlar, fakat kendi sektörünüzün conversion funnel datasından daha keskin limitleri türetmeniz gerekir.

Klasik "dev ortamında Lighthouse 95, prod'da 72" senaryosu şu sebeplerden oluşur: synthetic test laboratuvar şartlarında (fast 4G, cache boş, tek sayfa load), RUM gerçek kullanıcının 3G'si, dolu cache'i, navigation pathleriyle test eder. İkisi arasındaki fark normal ama her ikisi de monitör edilmeli. Lighthouse CI, her PR'da bundle size regresyonunu yakalar; RUM ise "mobil kullanıcıların %22'sinde LCP 4 saniyeyi geçiyor" gibi production realitesini gösterir. Budget'ı sadece "75 skoru aşmak" olarak tanımlarsanız, bundle'a 100 KB ekleyip score'u 74'ten 76'ya çıkarabilirsiniz — sayfa ağırlaşır ama skor yeşildir. Bu yüzden budget'ı *metrik bazında* (LCP, TBT, CLS) ve *resource bazında* (JS, CSS, image MB) çift katlı tutmalısınız.

Bir diğer nokta: budget'ı enforcing etmek için insan review'u yetersiz. "Code review'da performance'a bakarız" demek, 20 PR/gün hızında ölçeksizdir. Sistem ölçmeli, sistem fail etmeli, insanlar ancak nedenini araştırmalı.

## Lighthouse CI ile Commit Başına Performance Gating

Lighthouse CI, her commit veya PR'da Lighthouse audit'ini otomatik koşup sonuçları GitHub'a ya da internal dashboard'a raporlar. CI pipeline'ınıza şöyle entegre edilir:

```yaml
# .github/workflows/lighthouse-ci.yml
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci && npm run build
      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

`.lighthouserc.json` config'inde budget'ları tanımlarsınız:

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/"],
      "numberOfRuns": 3
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "total-byte-weight": ["error", { "maxNumericValue": 512000 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "categories:performance": ["error", { "minScore": 0.85 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

Bu kurulumla, bir PR main branch'e 50 KB ekstra JS eklerse ve TBT 200 ms'yi aşarsa, CI fail eder ve merge bloklanır. Roibase'de headless commerce projelerinde bu yaklaşımı kullanarak [Headless Commerce](https://www.roibase.com.tr/tr/headless) mimarisine geçen müşterilerde TBT ortalamasını 2190 ms'den 200 ms'ye düşürdük — çünkü her kütüphane eklenmesi budget'a karşı test edildi.

### Lighthouse CI Limitations ve Yapısal Kararlar

Lighthouse CI synthetic test yapar: sabit bant genişliği (Moto G4, slow 4G emülasyonu), sabit CPU throttle (4x slowdown), tek sayfa. Gerçek kullanıcı farklı cihazdadır, farklı pathler izler (product page → cart → checkout), A/B test varyantları görür. Bu yüzden Lighthouse CI'ı **minimum bar** olarak konumlandırın — geçerse deploy edilebilir, ama geçmesi production'da 100 puan anlamına gelmez. Production reality'yi ölçmek için RUM gerekir.

## RUM (Real User Monitoring) ile Production Reality'yi Karar Datasına Çevirmek

RUM, gerçek kullanıcılardan metrik toplar: Navigation Timing API, PerformanceObserver, CrUX (Chrome User Experience Report). Bunları toplayan bir vendor (Speedcurve, Sentry Performance, Cloudflare Web Analytics) veya kendi logging stack'iniz (web-vitals kütüphanesi + BigQuery) olabilir.

Minimal bir `web-vitals` entegrasyonu:

```javascript
// app.js
import { onCLS, onFID, onLCP, onTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    navigationType: metric.navigationType,
    page: window.location.pathname,
    deviceType: /mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
  });
  
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', body);
  } else {
    fetch('/api/vitals', { method: 'POST', body, keepalive: true });
  }
}

onCLS(sendToAnalytics);
onFID(sendToAnalytics);
onLCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

Bu datayı BigQuery'e yükler, sonra dbt ile pazarlama attribution datasıyla birleştirirsiniz:

```sql
-- models/performance_impact.sql
WITH vitals AS (
  SELECT
    session_id,
    AVG(CASE WHEN metric_name = 'LCP' THEN value END) AS avg_lcp,
    AVG(CASE WHEN metric_name = 'CLS' THEN value END) AS avg_cls
  FROM {{ ref('raw_vitals') }}
  GROUP BY session_id
),
conversions AS (
  SELECT session_id, revenue, converted
  FROM {{ ref('ga4_sessions') }}
)
SELECT
  CASE
    WHEN v.avg_lcp <= 2500 THEN 'good'
    WHEN v.avg_lcp <= 4000 THEN 'needs_improvement'
    ELSE 'poor'
  END AS lcp_band,
  COUNT(*) AS sessions,
  SUM(c.converted) AS conversions,
  SAFE_DIVIDE(SUM(c.converted), COUNT(*)) AS cvr
FROM vitals v
LEFT JOIN conversions c USING(session_id)
GROUP BY lcp_band;
```

Bu tablo size "LCP 2,5 saniyenin altındayken CVR %3,4, üstündeyken %2,1" gibi somut decision data verir. Bu noktayı CMO'ya raporladığınızda, "performance optimize edelim" soyut isteği yerine "LCP'yi 2,5 sn altına çekersek aylık 18K$ ek revenue" somutuna dönüşür.

## Regression Alarmlarını Slack/PagerDuty Entegrasyonuna Bağlamak

RUM datasını topladıktan sonra regresyon tespiti için threshold alarm kurmalısınız. Örneğin, son 7 günlük ortalamanız LCP 2,2 saniye iken bugün 3,1 saniyeye çıkmışsa, bu deploy regresyonudur veya CDN sorunu. Bu alarm'ı manuel dashboard kontrolüyle yakalamak değil, otomatik tetiklemek gerekir.

### DataDog ile Metrik-Based Alerting

DataDog, RUM metriklerini otomatik parse eder ve anomaly detection yapar. Bir monitor tanımı:

```json
{
  "name": "LCP Regression - Desktop",
  "type": "metric alert",
  "query": "avg(last_1h):avg:rum.largest_contentful_paint{device:desktop} > 2500",
  "message": "LCP desktop son 1 saatte 2500ms üstüne çıktı. Son deploy: {{deploy.id}}. @slack-perf-alerts @pagerduty",
  "tags": ["service:ecommerce", "env:production"],
  "thresholds": {
    "critical": 2500,
    "warning": 2200
  }
}
```

Bu alarm tetiklendiğinde Slack kanalına düşer, PagerDuty incident açar ve on-call developer'ı uyandırır. Alarm message'ında deploy ID varsa (CI pipeline tag'inden geliyor), regression'ın hangi commit'ten kaynaklandığını 30 saniyede bulursunuz.

### Lighthouse CI'dan Gelen Threshold Fail'i de Alarm Olarak Yönlendirme

Bazı takımlar Lighthouse CI fail'ini sadece PR block olarak bırakmaz, ayrıca Slack'e bildirim gönderir:

```yaml
# .github/workflows/lighthouse-ci.yml (ek step)
- name: Notify Slack on Failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "Lighthouse CI FAILED on PR #${{ github.event.pull_request.number }}",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Performance budget exceeded*\nPR: <${{ github.event.pull_request.html_url }}|#${{ github.event.pull_request.number }}>\nBranch: `${{ github.head_ref }}`"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_PERF }}
```

Bu sayede mühendis PR açar açmaz, budget aşıldığında hem CI'da kırmızı tick hem Slack notification alır — dikkati hemen çeker.

## Budget'ları Feature Flag Sistemine Entegre Etmek

Bazı feature'lar inherently ağır olabilir: canlı chat widget (80 KB JS), personalization engine (150 KB + runtime cost), video player (200 KB). Bunları tüm kullanıcılara açmak yerine, performance budget'ını aşmayacak bir segmentte (örn desktop + fast connection) test edip kademeli açabilirsiniz.

LaunchDarkly veya kendi feature flag sisteminizde rule tanımlayabilirsiniz:

```javascript
// featureFlags.js
import { getConnectionSpeed } from './utils';

export function shouldEnableChatWidget(user, vitals) {
  const is4G = getConnectionSpeed() === '4g';
  const goodLCP = vitals.lcp < 2000;
  
  return is4G && goodLCP && user.tier === 'premium';
}
```

Bu yaklaşımla, "chat widget ekleyelim" kararı bir "tüm kullanıcı LCP'si 300 ms artar" riski taşımaz — sadece koşulları sağlayan segmentte açılır, RUM datası toplanır, CVR etkisi ölçülür, ardından full rollout yapılır veya geri alınır. Bu trade-off kararını pazarlama ve product ekibiyle paylaşırken sayısal gösterebilirsiniz: "Chat widget CVR'yi %0,4 artırıyor ama LCP 2,8 saniyeye çıkıyor — net gelir +8K$ ama kullanıcı deneyimi düşüyor. Nasıl ilerleyelim?"

## Performans Budget'ını Headless Commerce'te Enforcing Etmek

Headless commerce mimarisi (örn Shopify Hydrogen, Next.js + Shopify API) genelde Liquid theme'den daha hızlıdır çünkü istemci-tarafı JavaScript kontrolü sizde, selective hydration yapabilirsiniz. Ancak kontrol sizde olduğu için regresyon riski de sizde — bir npm package güncellemesi bundle'a 70 KB ekleyebilir.

Roibase'in [Shopify Partner Hizmetleri](https://www.roibase.com.tr/tr/shopify) kapsamında headless geçişlerde şu workflow'u uyguluyoruz:

1. **Baseline belirleme:** Mevcut Liquid theme'de RUM datası topla (30 gün). Median LCP, TBT, CLS değerlerini kaydet.
2. **Headless prototipi Lighthouse CI ile gate'le:** Her commit `.lighthouserc.json` budget'ına uysun. İlk deploy baseline'dan %20 daha iyi olmak zorunda.
3. **Production'da RUM karşılaştırması:** İlk 7 gün eski/yeni versiyonları A/B test et (örn %10 traffic yeni headless'e), RUM metriklerini karşılaştır.
4. **Regression alarmlarını kur:** Yeni mimariye geçtikten sonra LCP 2,5 saniye, TBT 200 ms eşiklerini DataDog monitor'a yaz.
5. **Quarterly review:** Her çeyrekte bundle size audit yap, kullanılmayan dependency'leri temizle.

Bir e-ticaret müşterisinde bu süreç sonunda şu sonuçları aldık: Liquid theme LCP 4,1 saniye → Hydrogen LCP 1,8 saniye, CVR %2,3 → %3,1 (+35%). Fakat 6 ay sonra yeni feature'larla LCP 2,9 saniyeye çıkmış, CVR %2,9'a düşmüş — çünkü budget enforcing gevşetilmiş. Tekrar budget activate edilince 2 hafta içinde 2,1 saniyeye döndü.

## Tradeoff: Hız vs Zengin Deneyim

Bazen pazarlama ekibi "sayfa hızlı ama boş, daha fazla content ekleyelim" der. Bu durum performance ile engagement arasında tradeoff yaratır. Burada karar, sayısal olmalıdır: "Carousel eklemek LCP'yi 300 ms artırıyor, engagement %12 artıyor, CVR değişmiyor — trade net pozitif mi?" sorusuna cevap veren bir framework kurun.

Bir framework örneği:

| Feature | LCP Delta (ms) | Engagement Delta (%) | CVR Delta (%) | Net Revenue Impact |
|---|---|---|---|---|
| Hero carousel | +320 | +12 | 0 | Nötr |
| Product video | +180 | +8 | +0,3 | +12K$/ay |
| Live chat widget | +280 | +4 | +0,4 | +18K$/ay |
| Related products (lazy) | +40 | +6 | +0,2 | +9K$/ay |

Bu tabloyu product ve pazarlama ekibiyle paylaşırken, "video ve chat ekleniyor, carousel iptal" kararı tartışmasız somut hale gelir.

---

Performance budget'ı karar mekanizmasına bağlamak, "hızlı sayfa yapalım" soyutluğundan "her commit LCP'yi 100 ms artırıyorsa CI fail etsin, her regression 10 dakika içinde Slack'e düşsün, her feature kararı CVR ve LCP delta'sıyla alınsın" somutluğuna geçmektir. Lighthouse CI, RUM, alarm sistemi ve feature flag entegrasyonu bu yapının bileşenleridir. Şimdi yapmanız gereken: `.lighthouserc.json` dosyanızı oluşturun, CI pipeline'ına ekleyin ve ilk regression alarmınızı kurun. İlk budget fail ettiğinde ne kadar geç kaldığınızı göreceksiniz.