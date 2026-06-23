---
title: "Privacy-First Analytics: Plausible + Sunucu Tarafı Aggregation"
description: "Cookieless tracking, KVKK/GDPR uyum, GA4 ile karşılaştırma. Server-side aggregation mimarisiyle gizlilik-odaklı ölçüm altyapısı nasıl kurulur?"
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: data
i18nKey: data-006-2026-06
tags: [privacy-first, plausible, server-side-tracking, gdpr, cookieless]
readingTime: 8
author: Roibase
---

Google Analytics 4'ün varsayılan kurulumunda browser fingerprinting, client-side cookie set etme ve IP loglamadan vazgeçmediği 2026'da kesinleşti. AB Veri Koruma Kurulu'nun Ocak 2026 rehberi GA4'ü "explicit consent olmadan kullanılamaz" kategorisine aldı. Türkiye'de KVKK'nın 2025 sonunda yürürlüğe giren 12. madde değişikliği de aynı yönde: çerez tabanlı analytics için önceden onay zorunlu. Performans pazarlaması agresif attribution stack'ine dayanırken, site analytics katmanını gizlilik-odaklı mimariye taşımak artık operasyonel zorunluluk. Plausible + sunucu tarafı aggregation bu geçişte iki önemli soruyu çözüyor: cookieless nasıl ölçülür, server-side pipeline nasıl compliance-safe kurulur.

## Plausible'ın Mimari Farkı: Event Stream Değil Aggregated Counter

Plausible browser tarafında 1 KB altı JavaScript snippet çalıştırır, cookie yazmaz, localStorage kullanmaz, IP adresini loglamaz. Bir sayfa görüntüleme gerçekleştiğinde `POST /api/event` çağrısı yapar. Backend Elixir servisine düşen raw event, PostgreSQL'de **anında aggregate edilir** — her event unique pageview counter'ında increment olur, oturum ID yerine daily salt ile hash'lenmiş visitor signature tutulur (IP + User-Agent → HMAC-SHA256 → 24 saat TTL). Visitor tanıma mantığı deterministik ama reversible değil: aynı gün aynı cihazdan gelen request'leri aynı visitor hash'ine eşler, ertesi gün salt değiştiğinde link kopar. Bu yöntem KVKK'nın "tanımlanabilir gerçek kişi" tanımının dışında kalır — hash'i bilseniz bile IP'ye dönemezsiniz.

GA4 ile fark: GA4 client-side `_ga` cookie'siyle 2 yıl persistent client ID tutar, her hit'te event stream'e yazar, BigQuery export'unda `user_pseudo_id` = cookie değeri olarak görünür. Consent Mode v2 aktifse redacted data gönderir ama cookie yine yazılır. Plausible'da server'a gelen event'te bile IP'nin ham hali PostgreSQL'e düşmez — Elixir process içinde hash'lenir, raw IP memory'den atılır. Bu mimari GDPR'ın "purpose limitation" prensibine uyar: toplanan veri sadece site trafiğini saymak için kullanılabilir, retargeting veya cross-site tracking için değil.

### Aggregation Counter Yapısı

Plausible dashboard'da görünen metrikler (pageview, visitor, bounce rate, session duration) PostgreSQL'de `events` tablosunda saklanmaz. Tablo yapısı:

```sql
CREATE TABLE stats (
  site_id INT,
  date DATE,
  metric VARCHAR(50),   -- 'pageviews', 'visitors', 'bounce_rate'
  dimension VARCHAR(50),-- 'page', 'source', 'device'
  value BIGINT,
  PRIMARY KEY (site_id, date, metric, dimension)
);
```

Her incoming event'te `INCREMENT` query'si çalışır: eğer o gün, o sayfa, o metric kombinasyonu varsa `+1`, yoksa `INSERT`. Real-time dashboard bu counter'ları okur. Raw event stream saklanmadığı için GDPR'ın "data minimization" maddesine tam uyar — tuttuğunuz veri, yaptığınız işe orantılı.

## Server-Side Proxy: Client-to-Plausible Trafiğini Kendi Domain'inizden Geçirmek

Plausible'ın SaaS endpoint'i `plausible.io/api/event`. Tarayıcı bu URL'e POST yapar. AdBlocker'lar `plausible.io`'yu blocklist'e alırsa event düşer. Çözüm: Plausible event'ini kendi domain'inizden geçen reverse proxy üzerinden göndermek. Nginx config:

```nginx
location /stats/api/event {
  proxy_pass https://plausible.io/api/event;
  proxy_set_header Host plausible.io;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header X-Forwarded-Proto $scheme;
  
  # IP anonymization — son oktet'i maskele
  set $anonymized_ip $remote_addr;
  if ($remote_addr ~* ^(\d+\.\d+\.\d+)\.\d+$) {
    set $anonymized_ip $1.0;
  }
  proxy_set_header X-Forwarded-For $anonymized_ip;
}
```

Frontend script'i değişir:

```html
<script defer data-domain="yourdomain.com" 
  src="/stats/js/script.js"></script>
```

`/stats/js/script.js` de Nginx'ten proxy'lenir. Bu kurulumda event trafiği `yourdomain.com/stats/api/event`'e gider, Plausible SaaS backend'ine oradan iletilir. AdBlocker bypass etkisi %15-20 ölçüm kaybını sıfırlar (Plausible'ın 2025 raporu). Önemli nokta: reverse proxy IP'yi zaten anonymize ederek iletir — Plausible backend'ine giden request'te son oktet `0` olarak görünür.

### Self-Hosted Plausible: Tam Kontrol

Plausible'ı kendi sunucunuzda çalıştırırsanız event data hiç 3rd-party endpoint'e gitmez. Docker Compose setup:

```yaml
version: '3.8'
services:
  plausible:
    image: plausible/analytics:v2.0
    ports:
      - "8000:8000"
    environment:
      BASE_URL: https://analytics.yourdomain.com
      SECRET_KEY_BASE: ${SECRET}
      DATABASE_URL: postgres://plausible:password@db/plausible
      CLICKHOUSE_DATABASE_URL: http://clickhouse:8123/plausible
    depends_on:
      - db
      - clickhouse
  
  db:
    image: postgres:14-alpine
    volumes:
      - postgres-data:/var/lib/postgresql/data
  
  clickhouse:
    image: clickhouse/clickhouse-server:23.3-alpine
    volumes:
      - clickhouse-data:/var/lib/clickhouse
```

Self-hosted kurulumda Plausible PostgreSQL'den ClickHouse'a geçti (v2.0'dan itibaren). Event aggregation hızı 10x arttı: 1M event/gün'de query latency <50 ms. Bu mimaride IP hash'leme, salt rotation tamamen sizin kontrolünüzde — KVKK uyum raporuna "event data sunucularımızın dışına çıkmaz" yazabilirsiniz.

## GA4 ile Karşılaştırma: Trade-off Tablosu

| Kriter | Plausible | GA4 |
|---|---|---|
| **Cookie kullanımı** | Hiç yok | `_ga`, `_ga_*` (2 yıl) |
| **IP loglama** | Hash + 24h TTL | Redacted (Consent Mode v2 ile) ama BigQuery export'unda `user_pseudo_id` = cookie ID |
| **Consent gereksinimi (GDPR)** | Hayır (legitim çıkar yeterli) | Evet (explicit opt-in) |
| **Attribution yeteneği** | Yok — sadece referrer + UTM | Cross-domain, conversion path, data-driven attribution |
| **Custom event tracking** | Manuel API çağrısı (goal event) | Otomatik + ölçüm planı |
| **Maliyet (10M hit/ay)** | Self-hosted: sunucu maliyeti (~$50/ay), SaaS: $19/ay (Business plan) | Ücretsiz ama BigQuery export için GCP maliyet (query başına ~$5/TB) |
| **Veri sahibi** | Siz (self-hosted) / AB sunucusu (SaaS) | Google (US sunucu) |

Plausible'da **attribution yok** — bir conversion'ın hangi kampanyadan geldiğini göremezsiniz, sadece "bu sayfa X kez görüntülendi, Y unique visitor geldi" dersiniz. Eğer pazarlama mix modeling veya incrementality test yürütüyorsanız, bu veri yeterli: aggregated traffic değişimi ile sales korelasyonu kurarsınız. Ama user-level journey, cohort analizi, funnel drop-off yapamazsınız. GA4'ün gücü orada — BigQuery export'unda `user_pseudo_id` join'leyerek multi-touch attribution kurarsınız.

Trade-off şu: compliance riskini sıfıra indirirken, granular insight kaybediyorsunuz. Çözüm: hybrid stack. Site analytics Plausible ile cookieless, conversion tracking [first-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) ile server-side — sGTM + Conversion API kombinasyonu. Plausible'da genel trafik eğilimini görürsünüz, karar verici metrikler (ROAS, LTV, CAC) server-side pipeline'dan gelir.

## Sunucu Tarafı Aggregation Pipeline: Plausible + dbt + BigQuery

Plausible self-hosted kurulumunda ClickHouse veritabanına doğrudan erişebilirsiniz. Event counter'larını BigQuery'ye replicate ederek pazarlama datasıyla join etme senaryosu:

1. **ClickHouse → BigQuery CDC:** Airbyte connector ile `plausible.events` tablosu BigQuery'ye daily incremental sync. ClickHouse'da aggregated counter zaten var, raw event yok.
2. **dbt model:** BigQuery'de `fct_pageviews` tablosu oluşturulur:

```sql
-- models/fct_pageviews.sql
WITH plausible_raw AS (
  SELECT
    toDate(timestamp) AS date,
    domain,
    pathname,
    referrer_source,
    COUNT(*) AS pageviews,
    uniqExact(visitor_hash) AS unique_visitors
  FROM {{ source('plausible', 'events') }}
  WHERE date >= CURRENT_DATE - 30
  GROUP BY 1, 2, 3, 4
),

marketing_spend AS (
  SELECT
    date,
    channel,
    SUM(spend) AS total_spend
  FROM {{ ref('stg_marketing_spend') }}
  GROUP BY 1, 2
)

SELECT
  p.date,
  p.domain,
  p.pathname,
  p.referrer_source,
  p.pageviews,
  p.unique_visitors,
  m.total_spend,
  SAFE_DIVIDE(p.unique_visitors, m.total_spend) AS visitors_per_dollar
FROM plausible_raw p
LEFT JOIN marketing_spend m
  ON p.date = m.date
  AND p.referrer_source = m.channel
```

Bu model'de `visitor_hash` BigQuery'ye gelmiyor — ClickHouse aggregate'i `unique_visitors` sayısı olarak geliyor. Yani data warehouse'da bile individual user tracking yok. Marketing spend tablosuyla join edince "bu landing page'e X dolar harcadık, Y visitor geldi" korelasyonunu görürsünüz. Incrementality test için kontrol/treatment group split yapmak istiyorsanız, cookie-based randomization yapamayacağınız için geo-level split (bölge bazında kampanya on/off) veya time-based holdout kullanırsınız.

### Real-Time Dashboard: Aggregated Metrikler

Plausible'ın dashboard'u real-time counter gösterir (son 30 dakika pageview). BigQuery'de benzer dashboard için Looker Studio + BigQuery Materialized View:

```sql
CREATE MATERIALIZED VIEW analytics.mv_realtime_traffic
AS
SELECT
  FORMAT_TIMESTAMP('%Y-%m-%d %H:%M', timestamp, 'Europe/Istanbul') AS time_bucket,
  pathname,
  COUNT(*) AS hits,
  APPROX_COUNT_DISTINCT(visitor_hash) AS visitors
FROM plausible.events
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 MINUTE)
GROUP BY 1, 2
```

Materialize her 5 dakikada refresh olur (BigQuery MV sınırı). Looker Studio'da line chart: X ekseni `time_bucket`, Y ekseni `hits`. Bu dashboard'da da user-level veri yok — sadece aggregated counter.

## Uyum Dokümantasyonu: KVKK Veri İşleme Sözleşmesi

Plausible SaaS kullanıyorsanız DPA (Data Processing Agreement) imzalarsınız. Plausible'ın 2026 template'i şu maddeleri içeriyor:

- **Veri kategorisi:** "Aggregated website traffic metrics (pageview count, referrer count, device type distribution)". Individual identifier içermez.
- **Veri işleme amacı:** "Website performance analysis and traffic source attribution". Retargeting, profiling, automated decision-making değil.
- **Alt işleyici:** ClickHouse Cloud (AB sunucusu), Hetzner (Almanya).
- **Saklama süresi:** 2 yıl (dashboard'da gösterim için), sonra otomatik silme.
- **Veri öznesi hakları:** Aggregated veri bireysel kişiye bağlanamadığı için silme/düzeltme talebi uygulanamaz. Bu durum DPA'da açıkça belirtilir: "Due to aggregation at ingestion, data subject requests cannot be fulfilled on a per-individual basis."

KVKK uyum raporu için Plausible'ın bu mimarisini kullanmanız artı puan: Kurul'a "kullanıcı verisi saklamıyoruz, aggregated counter tutuyoruz" diyebilirsiniz. GA4'te bu argüman geçersiz — BigQuery export'unda `user_pseudo_id` var, bu "kişisel veri" sayılır.

Self-hosted kurulumda DPA imzalamanıza gerek yok — data controller sizsiniz. Ama KVKK Madde 10 gereği "teknik ve idari tedbirler" almanız gerekir: database encryption (PostgreSQL TDE), access log (pg_audit), automated backup + PITR. Plausible Docker setup'ında bunlar default yok — kendiniz eklersiniz.

## Plausible'ın Limitleri: Ne Zaman Yeterli Değil

Plausible **funnel analizi yapmaz**. "Ürün sayfası → sepet → ödeme" adım adım drop-off göremezsiniz. Custom event gönderip ("Add to Cart" goal event) sayısını görebilirsiniz ama sequential flow yok. Eğer CRO için funnel optimize ediyorsanız, ek tool gerekir: Hotjar (session replay ama cookie kullanır), ya da server-side funnel tracking (sGTM'de event sequence aggregate edip BigQuery'ye yazmak).

Plausible **cohort retention hesaplamaz**. "1 Ocak'ta gelen kullanıcıların %25'i 7. gün döndü" gibi metrik üretemezsiniz — çünkü visitor hash her gün değişir, user continuity takip edilemez. Retention için first-party identity gerekir: login event'i veya hashed email. Bu veriyi Plausible'a göndermek GDPR ihlali olur (explicit consent gerekir), o yüzden retention layer'ı ayrı kurarsınız — CDP pipeline'ında.

Plausible **A/B test raporu sunmaz**. Test variant'ları Plausible'a custom property olarak gönderip pageview'leri segment edebilirsiniz ama istatistiksel anlamlılık hesabı yok. Bayesian A/B test için Statsig, Optimizely veya kendi pipeline'ınızda Python `scipy.stats` ile p-value hesabı yaparsınız.

Özetle: Plausible traffic monitoring için yeterli, conversion optimization ve retention engineering için değil. Hybrid stack şart: cookieless genel analytics Plausible, critical business metric'leri server-side consented tracking.

---

Privacy-first analytics, compliance zorunluluğu olduğu kadar rekabet avantajı. Kullanıcı güveni kazanmak için "çerez kullanmıyoruz" demek yetmiyor — mimarinizin gerçekten cookieless olduğunu teknik olarak kanıtlamanız gerekiyor. Plausible + sunucu tarafı aggregation bu kanıtı sağlıyor: event stream saklamadan, IP loglamadan, deterministic hash ile günlük visitor sayma. GA4'ün sunduğu granular attribution'dan vazgeçiyorsunuz ama KVKK riskini sıfırlıyorsunuz. Performans pazarlamasında critical metric'ler için server-side pipeline kurduğunuzda (sGTM + Conversion API + BigQuery), Plausible tamamlayıcı katman olarak kalıyor — "genel site sağlığı" dashboard'u. Bu iki katmanı ayırmak, hem compliance hem de operasyonel verimlilik açısından 2026'nın standart mimarisi.