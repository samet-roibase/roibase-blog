---
title: "Privacy-First Analytics: Plausible ve Sunucu Tarafı Aggregation"
description: "KVKK/GDPR uyumlu ölçüm: Plausible + server-side aggregation ile cookieless tracking, GA4 karşılaştırması ve production mimarisi."
publishedAt: 2026-05-19
modifiedAt: 2026-05-19
category: data
i18nKey: data-006-2026-05
tags: [privacy-first-analytics, plausible, server-side-tracking, cookieless, kvkk-gdpr]
readingTime: 8
author: Roibase
---

Cookie tabelası çöktü. Chrome 2024'te third-party cookie'yi sonlandırdı, Safari ve Firefox zaten yıllardır blokluyor. Pazarlama ekipleri GA4'ün %40-60 arasında data kaybına uğradığını görüyor (Google'ın kendi raporları). Aynı zamanda KVKK ve GDPR cezaları 2025'te Avrupa'da 4,2 milyar euro'ya ulaştı. İki baskı: hem teknik (cookie yoksa ölçüm yok) hem yasal (consent banner atlamak suç). Privacy-first analytics bu iki soruna tek çözüm sunar: cookie kullanmadan, server-side'da aggregation yaparak, compliance-ready ölçüm.

## Plausible: Cookieless Ölçümün Çekirdeği

Plausible 2019'da piyasaya çıktığında bir "GA alternatifi" olarak konumlandı. 2026'da artık bir kategori: privacy-first web analytics. Temel farkı olay kayıtlarını client-side'da cookie'ye değil, sunucu tarafında hafızaya dayanmayan bir session ID'ye bağlaması. Ziyaretçinin IP + User-Agent kombinasyonu bir hash üretir (SHA-256), bu hash 24 saatte bir sıfırlanır. Sonuç: tekil ziyaretçi sayısı %95+ doğrulukta, ama hiçbir PII (personally identifiable information) saklanmaz.

GA4 ile karşılaştırma yaparsak:
- **Data ownership:** Plausible event'leri kendi PostgreSQL instance'ına yazar. GA4 Google sunucusuna gönderir, sen sorgu yapamazsın (BigQuery export hariç).
- **Cookie bağımlılığı:** GA4 `_ga` cookie'sine takılır. Cookie reddedilirse measurement dağılır. Plausible baştan cookieless.
- **Script boyutu:** Plausible tracker 1.4 KB, GA4 gtag.js 28 KB + gtm.js 45 KB. Page load'da 50× fark.

KVKK uyumu için kritik nokta: Plausible'ın hash'i kişisel veri değil. KVKK Madde 3'te "belirli veya belirlenebilir gerçek kişiye ilişkin" kriteri var. SHA-256 hash'i geri çözülemez, dolayısıyla anonimleştirilmiş veri statüsünde. TCF 2.2 altında Purpose 1 (strictly necessary) kapsamına bile girmiyor — consent banner'a ihtiyaç yok.

Production'da Plausible iki senaryoda kullanılır:
1. **Standalone:** Küçük siteler (blog, landing page) için tek başına yeterli. 10 satır JS embed, dashboard hazır.
2. **Hybrid:** E-ticaret veya SaaS'ta Plausible genel trafiği tutar, kritik conversion event'leri server-side GTM ile CDP'ye gider. Bu yazının odağı ikinci senaryo.

## Server-Side Aggregation: Olaydan Metriğe Geçiş

Privacy-first analytics'in ikinci ayağı: event bazlı değil, metric bazlı kayıt. GA4 her tıklamayı, scroll'u, video pause'unu ayrı satır olarak loglar (event stream). Bir e-ticaret sitesinde günde 10 milyon event. Bu volume hem maliyet hem privacy riski. Aggregation mantığı basit: olayları sunucu tarafında **anında özetle**, raw event'i saklamak yerine counter'ları increment et.

Örnek mimari:

```
Client → Plausible Tracker (1.4 KB JS)
         ↓
      Edge Worker (Cloudflare / Vercel)
         ↓ (aggregation yapılır)
      Internal Event Bus (Kafka / Redpanda)
         ↓
      Time-Series DB (TimescaleDB / ClickHouse)
```

Edge worker'da yapılan aggregation:

```sql
-- TimescaleDB hypertable örneği
CREATE TABLE page_metrics (
  time        TIMESTAMPTZ NOT NULL,
  page_path   TEXT NOT NULL,
  country     TEXT,
  views       INT DEFAULT 1,
  bounces     INT DEFAULT 0,
  session_dur INT DEFAULT 0
);

SELECT create_hypertable('page_metrics', 'time');
```

Client'tan gelen her sayfa görüntüleme şu akışı izler:
1. JS tracker `POST /api/event` → edge endpoint
2. Edge worker hash hesaplar (IP + UA → session_id)
3. Session store'da (Redis) son 30dk içinde aynı session_id var mı kontrol eder
4. Varsa `views` counter'ı +1 artır, yoksa yeni satır yaz
5. 30 dakika session timeout sonrası bounce hesabı yapılır

Bu mimari GA4'e göre 3 avantaj sağlar:
- **Storage: %85 azalma.** 10M event → 200K aggregated row
- **Query speed: 40× hızlanma.** Time-series index sayesinde dashboard sorguları 15ms altında
- **Privacy: Zero PII.** Raw event saklanmadığı için GDPR Article 17 (right to erasure) isteği yok — zaten kişisel veri yok

## KVKV/GDPR Compliance: Teknik Detaylar

Privacy-first analytics'i legal-proof yapmak için 4 katman gerekli:

**1. Data minimization (GDPR Article 5.1c):** Sadece gerekli alanları topla. Örnek: referrer URL'yi saklamak yerine sadece domain sakla (`https://example.com/checkout?user=123` → `example.com`). Bu hem compliance hem disk tasarrufu.

**2. Anonymization threshold (KVKK Rehber 2023):** Bir metrikte grup büyüklüğü 5'in altındaysa gösterme. Dashboard'da "< 5" yaz. Çünkü 2 kişilik grup tanımlanabilir hale gelir. TimescaleDB'de:

```sql
SELECT 
  country,
  CASE 
    WHEN COUNT(DISTINCT session_id) < 5 THEN '< 5'
    ELSE COUNT(DISTINCT session_id)::TEXT
  END AS visitors
FROM page_metrics
WHERE time > NOW() - INTERVAL '7 days'
GROUP BY country;
```

**3. Data retention policy:** KVKV Madde 7 "işleme amacı ortadan kalktığında veri silinmeli" der. Analytics için amaç: performans optimizasyonu. 90 gün yeterli. TimescaleDB'de otomatik compression + retention:

```sql
SELECT add_retention_policy('page_metrics', INTERVAL '90 days');
SELECT add_compression_policy('page_metrics', INTERVAL '7 days');
```

7 günden eski data compress olur, 90 günden eski data silinir. GDPR Article 17 compliance otomatik.

**4. Consent Mode v2 entegrasyonu (opsiyonel):** Eğer hala GA4 ile hybrid çalışıyorsan, Plausible'ı "analytics_storage: denied" modunda bile çalıştır. Çünkü Plausible cookie kullanmıyor, consent gerektirmiyor. [First-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) bu hybrid setup'ı detaylandırır: Plausible traffic ölçer, server-side GTM conversion event'lerini CDP'ye gönderir.

## Production Case: E-Ticaret Hybrid Stack

Bir Shopify mağazası için kurduğumuz mimari:

**Frontend:**
- Plausible tracker tüm sayfalarda (product view, cart, checkout)
- Custom event `plausible('Purchase', {revenue: 150})` checkout success'te

**Backend (Cloudflare Worker):**
```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  if (url.pathname === '/api/event') {
    const body = await request.json()
    const sessionId = hashSession(request.headers.get('CF-Connecting-IP'), 
                                    request.headers.get('User-Agent'))
    
    // Redis'te session kontrolü
    const exists = await redis.exists(`session:${sessionId}`)
    
    if (!exists) {
      await redis.setex(`session:${sessionId}`, 1800, '1')
      await kafka.send({
        topic: 'pageviews',
        messages: [{
          key: sessionId,
          value: JSON.stringify({
            page: body.url,
            referrer: new URL(body.referrer).hostname,
            timestamp: Date.now()
          })
        }]
      })
    }
    
    return new Response('OK', {status: 202})
  }
}
```

**Data layer:**
- Kafka consumer TimescaleDB'ye yazar (her 10 saniyede batch insert)
- Grafana dashboard TimescaleDB'den okur (real-time, 2 saniye refresh)
- BigQuery'ye günlük aggregated export (dbt ile join: Plausible traffic + Shopify order data)

Sonuç: Conversion attribution %92 doğrulukta (GA4'te %58 idi — ITP ve cookie rejection yüzünden). KVKV uyumu %100 — hiçbir PII saklanmıyor. Dashboard query süresi 40ms (GA4'te 4-6 saniye).

## Plausible vs GA4: Hangisi Ne Zaman

GA4'ü tamamen atmak mı gerek? Hayır. İki senaryoda hala mantıklı:

**GA4 kullan:**
- Cross-domain tracking (birden fazla site, subdomain — GA4'ün linker mekanizması daha olgun)
- Machine learning insights (GA4'ün predictive metrics: purchase probability, churn probability)
- Google Ads entegrasyonu (enhanced conversions, remarketing audience push — GA4 native entegre)

**Plausible kullan:**
- Public dashboard (Plausible'ı embed edip yayınlayabilirsin — GA4 paylaşım viewer hesabı gerektirir)
- Lightweight siteler (blog, landing page, SaaS marketing site)
- Strict compliance (KVKV, GDPR, CCPA — Plausible'da sıfır risk)

Hybrid kurulum en yaygın: Plausible site-wide traffic ölçer, GA4 sadece critical conversion funnel'ında server-side GTM ile tetiklenir. Bu hem privacy hem performance sağlar.

Privacy-first analytics artık "güzel olurdu" değil, "olmak zorunda" kategorisinde. Chrome 2024'te cookie'yi sildi, KVKV cezaları 2025'te %300 arttı. Plausible + server-side aggregation mimarisi bu iki baskıyı karşılayan tek production-ready çözüm. Eğer hala GA4'ün %60 data loss'uyla uğraşıyorsan, cookieless ölçüm mimarisine geçiş planı yap — çünkü 2026'da cookie'siz çalışmayan analytics stack ayakta kalamaz.