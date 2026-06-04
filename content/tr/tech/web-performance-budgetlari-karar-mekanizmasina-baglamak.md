---
title: "Web Performance Budget'ları: Karar Mekanizmasına Bağlamak"
description: "Lighthouse CI, RUM ve perf regression alarmlarını iş süreçlerine entegre ederek sayılarla yönetilen performans kültürü nasıl kurulur?"
publishedAt: 2026-06-04
modifiedAt: 2026-06-04
category: tech
i18nKey: tech-004-2026-06
tags: [web-performance, lighthouse-ci, rum, core-web-vitals, performance-budget]
readingTime: 8
author: Roibase
---

E-ticaret sitelerinin %53'ü 3 saniyeden uzun yüklendiğinde kullanıcıyı kaybediyor (Google 2025 verisi). Performance budget — "LCP 2.5s'yi geçemez" gibi sayısal tavan kararları — bu kayıpları önlemek için zorunlu disiplin haline geldi. Ama çoğu ekip bu budget'ları önerge kağıdında bırakıyor. Regression'lar deploy pipeline'ını otomatik kesmeli, RUM dashboard'ları haftalık sprint review'a dahil olmalı. Web performance artık "frontend ekibinin işi" değil, ürün kararlarını şekillendiren veri katmanı.

## Performance Budget Nedir, Ne Değildir

Performance budget, kabul edilebilir yavaşlama eşiklerini sayısal taahhüt haline getirir. "Sayfa hızlı olmalı" soyut hedefi yerine "LCP < 2.5s, FID < 100ms, CLS < 0.1" bağlayıcı sözleşme olur. Budget'ı aşan PR merge edilemez — CI'da build fail verir.

**Budget türleri:**

| Metrik Tipi | Örnek Budget | Ölçüm Yöntemi |
|---|---|---|
| Core Web Vitals | LCP < 2.5s | Lighthouse CI, RUM (CrUX) |
| Timing | TTI < 3.5s, TBT < 200ms | Lighthouse, WebPageTest |
| Resource | JS bundle < 200KB (gzip), Total size < 1MB | Webpack Bundle Analyzer |
| Count | HTTP request < 50, Third-party script < 5 | Network panel |

Bir budget "performansı bloke et" araç değil, "performansı maliyet hanesine koy" araçtır. Developer yeni bir analytics kütüphanesi eklerken "bu bize 15KB + 200ms main thread maliyeti" diye hesap yapar. PM yeni bir carousel widget isterken "CLS'i 0.08 artırır, budget'tan kalan 0.02" diye geri bildirim alır.

Budget olmazsa ekip "hissettiği" performans üzerine çalışır. Hissiyat subjektif, budget objektif.

## Lighthouse CI ile Regression Kapısı Kurmak

Lighthouse CI, her commit'te Lighthouse skorlarını otomatik çalıştırıp budget aşımlarında CI'ı fail eder. GitHub Actions, GitLab CI, Jenkins ile entegre olur. Kurulumu 10 dakika — dönen değer 10 yıllık performans kültürü.

**Örnek GitHub Actions workflow:**

```yaml
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci && npm run build
      - run: npm install -g @lhci/cli
      - run: lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_TOKEN }}
```

**`.lighthouserc.json` budget tanımı:**

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/", "http://localhost:3000/product/123"],
      "numberOfRuns": 3
    },
    "assert": {
      "preset": "lighthouse:no-pwa",
      "assertions": {
        "first-contentful-paint": ["error", {"maxNumericValue": 2000}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "total-blocking-time": ["error", {"maxNumericValue": 200}],
        "interactive": ["error", {"maxNumericValue": 3500}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

Bu config 3 run ortalama alır (Lighthouse tek run'da +%15 varyans gösterir), LCP 2.5s'yi aşarsa PR'yi kırmızıya boyar. Developer merge edemez. Slack'e düşen alert: "PR #432 LCP 2.8s — budget 2.5s — optimize edin veya PM'den budget exception alın."

Roibase'de ürün kararlarının teknik maliyet boyutunu [Headless Commerce](https://www.roibase.com.tr/tr/headless) altyapısına entegre ederek, her feature'ın performans footprint'ini görünür kılıyoruz. Lighthouse CI bu sayıları karar noktasına taşır.

## RUM ile Gerçek Kullanıcı Datasını Karar Hattına Almak

Lighthouse lab verisi — kontrollü ortamda ölçüm — koşul koyar ama gerçek dünyayı tam göstermez. RUM (Real User Monitoring) prodüksiyon trafiğinden Web Vitals toplar. %10'luk yavaş bağlantılı segment'in LCP'si 5s olabilir. Lab'da bunu göremezsin.

**RUM stack örneği:**

```javascript
// web-vitals library ile tüm Core Web Vitals toplanır
import {onCLS, onFID, onLCP} from 'web-vitals';

function sendToAnalytics({name, value, id}) {
  fetch('/api/vitals', {
    method: 'POST',
    body: JSON.stringify({name, value, id, url: location.href}),
    keepalive: true
  });
}

onCLS(sendToAnalytics);
onFID(sendToAnalytics);
onLCP(sendToAnalytics);
```

Backend `/api/vitals` endpoint'i bu dataları BigQuery'ye yazar. Haftalık dashboard Sprint Review'a dahil olur:

| Metrik | p50 | p75 | p90 | Budget | Durum |
|---|---|---|---|---|---|
| LCP | 2.1s | 2.8s | 4.2s | 2.5s (p75) | ⚠️ 0.3s aşım |
| FID | 12ms | 45ms | 120ms | 100ms (p75) | ✅ |
| CLS | 0.05 | 0.09 | 0.18 | 0.1 (p75) | ✅ |

p75'te LCP budget aşımı var — PM şöyle karar verir: "Bu sprint homepage slider optimizasyonu stack'in tepesine çıkıyor. LCP'yi 2.8s → 2.3s'ye çekmeden yeni feature freeze."

RUM datasını sprint velocity ile birleştirdiğinde "1 sprint'te 200ms LCP iyileşmesi" gibi performans throughput metrikleri üretirsin. Ekip velocity'sini feature count yerine "shipped value + performance improvement" ile ölçer.

## Regression Alarm Sistemi: Performans Bozulmasını Anında Yakalamak

Deploy sonrası performance regression'ı 2 saat içinde yakalamak kritik. Örnek: yeni A/B test aracı LCP'yi 1.2s artırmış, trafik segmentinde %8 conversion drop var. Erken alarm 1 rollback ile sorunu çözer. Geç fark ederseniz 1 hafta revenue kaybı.

**Alarm kuralları (BigQuery + Cloud Monitoring):**

```sql
-- p75 LCP son 1 saat vs önceki 24 saat ortalaması
WITH current AS (
  SELECT APPROX_QUANTILES(lcp, 100)[OFFSET(75)] AS lcp_p75
  FROM vitals_table
  WHERE timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
),
baseline AS (
  SELECT APPROX_QUANTILES(lcp, 100)[OFFSET(75)] AS lcp_p75
  FROM vitals_table
  WHERE timestamp BETWEEN TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 25 HOUR)
    AND TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
)
SELECT 
  c.lcp_p75 AS current_lcp,
  b.lcp_p75 AS baseline_lcp,
  (c.lcp_p75 - b.lcp_p75) / b.lcp_p75 * 100 AS pct_change
FROM current c, baseline b
WHERE (c.lcp_p75 - b.lcp_p75) / b.lcp_p75 > 0.15; -- %15 artış alarmı
```

Bu query Cloud Scheduler'dan her 10 dakikada çalışır. Eşiği geçerse Slack #perf-alerts kanalına düşer. Developer on-call ekibi 30 dakika içinde root cause analizine başlar.

**Tipik regression senaryoları:**

1. **Third-party script eklendi:** Analytics vendor'ı main thread'de 180ms bloke ediyor → TBT budget aşıldı
2. **Image lazy-load bozuldu:** LCP candidate görseli lazy-load edilmiş → LCP 1.2s → 3.1s
3. **JS bundle split kötü yapıldı:** Critical CSS defer oldu → FCP 900ms → 2.4s

Alarm sisteminin amacı attribution — "hangi deploy hangi metriği bozdu" sorusunu 10 dakikada cevaplayabilmek.

## Budget'ı Ürün Backlog'una Bağlamak

Performance budget'ı sadece developer constraint'i yapmak yerine ürün kararı haline getirmek gerekiyor. PM şöyle düşünmeye başlıyor: "Bu feature'ın 40KB JS maliyeti var, kalan budget 25KB — hangi eski feature'ı kaldıracağız?"

**Tradeoff template:**

```
Feature: Homepage product carousel (8 slot)
Performance Impact:
  - JS: +32KB (gzip)
  - LCP: +180ms (slider animasyon)
  - CLS: +0.04 (lazy image shift)

Budget Status BEFORE:
  - JS: 168KB / 200KB (kalan 32KB)
  - LCP: 2.3s / 2.5s (kalan 200ms)
  - CLS: 0.06 / 0.1 (kalan 0.04)

Budget Status AFTER:
  - JS: 200KB / 200KB ⚠️ TAM
  - LCP: 2.48s / 2.5s ⚠️ 20ms kalan
  - CLS: 0.10 / 0.1 ⚠️ TAM

Decision: Approve (carousel A/B test gösterdi ki +%3 CTR kazanıyoruz). 
Condition: Homepage'den eski banner rotator'ı kaldır (-28KB).
```

PM bu tradeoff'u data-driven yapıyor: "+%3 CTR kazanımı 180ms LCP maliyetine değer mi?" sorusu conversion funnel datasıyla cevaplanır. Eğer değerse approve, değmezse backlog'da "performance neutral iyileştirme" bekler.

Ekip her 2 haftada backlog'u performance audit'ten geçirir: "Hangi feature performance ROI'sı en düşük?" Örnek: eski social share button'ları 12KB ama %0.2 kullanılıyor → kaldır, budget boşalt.

## Performance Culture: Sayılarla Yönetilen Hız Kültürü

Web performance'ı "best practice" olarak görmek yerine KPI haline getirmek gerekiyor. Ekiplerin quarterly OKR'ına "p75 LCP 2.5s'den 2.0s'ye düşürmek" eklendiğinde, performans iyileştirme sprint velocity'den ayrı takip edilen iş kalemlerine dönüşüyor.

Performance budget'ları bu kültürün temel taşı. Developer yeni kod yazarken "budget kaldı mı?" diye sorar. PM yeni feature planlarken "performance footprint nedir?" diye hesaplar. CTO quarterly review'da "deploy başına ortalama LCP değişimi" grafiğini incelenir.

Lighthouse CI kapıyı tutar, RUM gerçeği söyler, alarm sistemi sapmayı yakalar, backlog tradeoff'ları dengeyi kurar. Bu döngü kapandığında performans artık "teknik ekibin derdi" olmaktan çıkar — ürün başarısının ölçülebilir boyutuna dönüşür. 2026'da Web Vitals Google ranking faktörü olduktan sonra bu döngüyü kurmamış ekipler organik trafiğin %40'ını kaybetti (Search Console 2025 benchmark). Budget koymak artık lüks değil, hayatta kalma taktiği.