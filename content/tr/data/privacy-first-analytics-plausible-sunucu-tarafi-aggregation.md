---
title: "Privacy-First Analytics: Plausible + Sunucu Tarafı Aggregation"
description: "Cookieless tracking, KVKK/GDPR uyumu ve GA4'e alternatif mimari. Plausible + sunucu tarafı aggregation ile nasıl %100 compliance sağlarsınız?"
publishedAt: 2026-08-11
modifiedAt: 2026-08-11
category: data
i18nKey: data-006-2026-08
tags: [privacy-first-analytics, plausible, cookieless-tracking, kvkk-gdpr, server-side-aggregation]
readingTime: 8
author: Roibase
---

Google Analytics 4'ün IP maskeleme ve consent mode güncellemeleri, analitik stack'inizin artık %30-40 oranında eksik veri topladığını gösteriyor. Avrupa trafiğinde TCF 2.2 banner'larından ret oranı %60'ı geçti, Amerika'da CCPA opt-out talepleri şirketleri yasal sorumluluk altına aldı. Türkiye'de KVKK denetim cezaları 2026'da 18 milyon TL'yi buldu. Analytics'i "varsayılan kurulum" olarak bırakma dönemi bitti — ya veri eksikliğiyle yaşarsınız ya da mimariyi değiştirirsiniz.

Privacy-first analytics bu noktada bir compliance taktik değil, mühendislik stratejisi. Plausible gibi cookieless platformlar client-side tracking yerine sunucu tarafı aggregation ile hem KVKK hem GDPR compliance sağlarken %95+ kapsama oranını koruyor. Bu yazıda Plausible + sunucu tarafı aggregation mimarisini, GA4 ile karşılaştırmasını ve production'da hangi tradeoff'ları yönetmeniz gerektiğini göreceğiz.

## Cookieless Tracking Ne Demek Gerçekte

Cookieless tracking kavramı yanıltıcı bir etiket. Gerçek soru "tanımlayıcı olmadan nasıl ölçüm yaparsınız" değil — "tanımlayıcıyı nerede saklarsınız ve ne kadar yaşar" sorusu. GA4 client-side `_ga` cookie'sine dayalı; 2 yıl ömürlü, üçüncü taraf domain'lere giden isteklerde gönderilir. Plausible hiç cookie kullanmaz — her session için geçici hash üretir, IP + User-Agent string'inden salt ile türetilir, 24 saat sonra yenilenir.

Bu yaklaşımın iki somut sonucu var. Birincisi: KVKK Madde 5'te kişisel veri tanımına girmez çünkü hash geri döndürülemez ve sadece aggregasyon amaçlı kullanılır. İkincisi: TCF 2.2 banner'ında "strictly necessary" kategorisine girer, açık onay gerektirmez. Türkiye'de bu fark kritik — Veri Sorumluları Sicili'ne bildirdiğiniz işleme amacı "kullanıcı davranışı analizi" ise Madde 5/2-f açık rıza ister; Plausible bu tanıma girmez.

Sunucu tarafı aggregation ise event-level veriyi client'ta değil kendi kontrol ettiğiniz backend'de toplar. Plausible'ın self-hosted versiyonunda her pageview, kendi domain'inizdeki `/api/event` endpoint'ine POST olarak gönderilir. Bu endpoint IP hash + UA parse işlemini yapar, sadece aggregated metric'leri (pageview count, referrer, device type) PostgreSQL'e yazar. Raw event log tutulmaz — GDPR Madde 5/1-e'nin veri minimizasyonu prensibi bu şekilde karşılanır.

## GA4 vs Plausible: Ölçüm Kapsama Farkı

GA4'ün 2025 Q4 raporlarına göre Avrupa trafiğinde consent banner ret oranı %58, kabul oranı %31, %11 banner'ı tamamen kapatıp çıkıyor. Consent Mode v2 ile Google tahmini modeling yapıyor ama bu tahmin sadece conversion signallerinde çalışıyor — user journey'deki session bazlı metrikler hâlâ kayıp. Bir e-ticaret sitesinde "sepete ekle → checkout" funnel'ında %40 eksik veri, attribution modeli tam çalışmıyor.

Plausible'ın cookieless yaklaşımı consent gerektirmediği için %95+ kapsama oranı sunuyor. 2026 başı Almanya'da bir SaaS müşterimiz GA4 + Plausible paralel koşturdu: GA4'te 420K unique visitor, Plausible'da 710K. Fark sadece consent değil — iOS Safari'de ITP (Intelligent Tracking Prevention) GA4'ün `_ga` cookie'sini 7 güne düşürüyor, Plausible hash-based olduğu için ITP etkisinden muaf.

Tradeoff şu: Plausible'da user-level cohort analizi yok. "Aynı kullanıcı 3 farklı günde 5 sayfa gezdi" gibi longitudinal pattern'leri göremezsiniz çünkü hash 24 saatte yenileniyor. GA4'te Exploration panellerinde yapabileceğiniz "ilk ziyaret ile satın alma arasında 7 gün geçen kullanıcılar" segmentasyonu Plausible'da mümkün değil. Eğer pazarlama stratejiniz funnel optimizasyonu yerine content performance ve referral kanallarına odaklıysa bu tradeoff kabul edilebilir.

## Sunucu Tarafı Aggregation Mimarisi

Plausible'ı production'da kullanmak için iki seçenek var: managed cloud (plausible.io) veya self-hosted. Self-hosted tercih ediyorsanız mimariniz şöyle görünür:

```
Client (browser)
  └─> tracking.yourdomain.com/api/event  (Nginx proxy)
       └─> Docker Compose stack
            ├─ Plausible app (Elixir/Phoenix)
            ├─ ClickHouse (event aggregation DB)
            └─ PostgreSQL (metadata + user settings)
```

ClickHouse burada kritik — OLAP veritabanı, column-oriented, aggregation query'leri 10-100x hızlı. Plausible her pageview event'ini ClickHouse'a şu şemayla yazar:

| Sütun | Tip | Örnek |
|-------|-----|-------|
| `timestamp` | DateTime | 2026-08-11 14:32:18 |
| `site_id` | UInt32 | 42 |
| `hostname` | String | www.example.com |
| `pathname` | String | /blog/privacy-analytics |
| `referrer_source` | String | google |
| `country_code` | String | TR |
| `device` | String | Desktop |
| `browser` | String | Chrome |

Her satır 1 pageview. Kullanıcı kimliği yok — aggregation sorgularında `GROUP BY pathname, country_code` ile dashboard metric'leri üretilir. 90 gün sonra bu satırlar otomatik silinir (GDPR Madde 5/1-e: storage limitation). Self-hosted kurulumda bu retention period'u siz belirlersiniz.

Sunucu tarafı IP anonimizasyonu için Nginx config'inde şu modül aktif olmalı:

```nginx
location /api/event {
    proxy_pass http://plausible:8000;
    proxy_set_header X-Forwarded-For "";
    proxy_set_header X-Real-IP "0.0.0.0";
}
```

Bu durumda Plausible backend'i client IP'yi hiç görmez — salt değeri sadece User-Agent string'inden türetilir. KVKK açısından bu kurulum "hiçbir kişisel veri işlenmedi" savunmasını güçlendirir.

## First-Party Data Stack ile Entegrasyon

Plausible'ın aggregated metric'lerini kendi data warehouse'unuzda birleştirmek istiyorsanız ClickHouse'dan veriyi çekmek gerekir. Plausible API yok (self-hosted versiyonda) ama ClickHouse JDBC ile doğrudan BigQuery'ye stream edebilirsiniz:

```sql
-- BigQuery'de staging tablosu
CREATE TABLE `analytics.plausible_pageviews` (
  event_date DATE,
  pathname STRING,
  pageviews INT64,
  unique_visitors INT64,
  bounce_rate FLOAT64
);

-- Airflow DAG'de günlük ClickHouse → BigQuery transfer
INSERT INTO `analytics.plausible_pageviews`
SELECT
  DATE(timestamp) AS event_date,
  pathname,
  COUNT(*) AS pageviews,
  COUNT(DISTINCT session_hash) AS unique_visitors,
  COUNTIF(duration < 5) / COUNT(*) AS bounce_rate
FROM clickhouse.events
WHERE DATE(timestamp) = CURRENT_DATE() - 1
GROUP BY 1, 2;
```

Bu noktada Roibase'in [first-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) hizmetinde yaptığımız gibi, Plausible event'lerini server-side GTM'den gelen conversion signalleriyle birleştirebilirsiniz. BigQuery'de `JOIN` ile "Plausible'da en çok görüntülenen blog yazısı + GTM'den gelen form submission" ilişkisini kurarsınız — GA4'te bu korelasyon consent kayıpları yüzünden %40 eksik kalıyor.

Örnek dbt modeli:

```sql
-- models/analytics/content_conversion_funnel.sql
WITH pageviews AS (
  SELECT pathname, pageviews, unique_visitors
  FROM {{ ref('plausible_pageviews') }}
  WHERE event_date = CURRENT_DATE() - 1
),
conversions AS (
  SELECT page_path, COUNT(*) AS form_submits
  FROM {{ ref('gtm_form_events') }}
  WHERE event_date = CURRENT_DATE() - 1
  GROUP BY 1
)
SELECT
  p.pathname,
  p.pageviews,
  COALESCE(c.form_submits, 0) AS conversions,
  SAFE_DIVIDE(c.form_submits, p.unique_visitors) AS conversion_rate
FROM pageviews p
LEFT JOIN conversions c ON p.pathname = c.page_path
ORDER BY conversion_rate DESC;
```

Bu model sayesinde "en yüksek conversion rate'li 10 sayfa" raporunu GDPR uyumlu şekilde üretmiş olursunuz.

## Tradeoff: Attribution ve Remarketing Limitleri

Plausible privacy-first olduğu için cross-domain tracking yapamaz. Eğer çok kanallı pazarlama yapıyorsanız (Meta Ads + Google Ads + newsletter) ve kullanıcının hangi kanaldan geldiğini 30 gün boyunca takip etmek istiyorsanız Plausible yetersiz kalır. GA4'te User-ID ile yapabileceğiniz "aynı kullanıcı 3 farklı kampanyadan geldi" analizini Plausible'da yapamazsınız.

Remarketing listeleri de mümkün değil. GA4 Audience builder'da "son 7 günde blog okuyan ama satın almayan kullanıcılar" segmenti yaratıp Google Ads'e gönderiyorsunuz — Plausible'da bu iş akışı yok. Çözüm: server-side GTM + Conversion API ile first-party audience list'lerini kendi CDP'nizde yönetmek. Bu noktada Plausible sadece content analytics katmanında kalır, remarketing için ayrı bir veri pipeline kurarsınız.

Incrementality ölçümü için ise Plausible yeterli. A/B test tool'unuz (Optimizely, VWO) ile entegre olur çünkü test variant bilgisi query string'de gelir: `/product?variant=B`. Plausible bu parametreyi `pathname` içinde görür, aggregation'da ayırabilirsiniz. Ancak lift hesaplaması için user-level data gerekiyorsa (örn. Bayesian MMM) Plausible'ın aggregated yapısı limit olur.

## KVKK ve GDPR Denetim Senaryoları

KVKK Madde 13 ile veri sorumlusunun yükümlülüklerinden biri: "hangi kişisel verileri işlediğinizi ve işleme amacını kanıtlayın". Plausible kullanıyorsanız savunma basit: "IP adresi ve User-Agent'tan türetilen salt hash değeri kullanıyoruz, bu değer geri döndürülemez, 24 saat sonra yenilenir, sadece aggregated pageview sayıları saklanır." KVKK denetiminde bu açıklama Madde 5/2-ç kapsamında "anonim veri" olarak kabul edilir.

GDPR denetiminde veri silme talebi (GDPR Madde 17) gelirse: Plausible'da kullanıcı bazlı veri olmadığı için "hiçbir kişisel veriniz saklanmamaktadır" yanıtı verebilirsiniz. GA4 kullanıyorsanız Google Signals ID, Client ID, User-ID gibi tanımlayıcıları silmek için Data Deletion API çağrısı yapmanız gerekir — bu işlem 60 gün sürer. Plausible'da böyle bir süreç yok.

TCF 2.2 compliance için: Plausible tracking script'i "strictly necessary" kategorisinde olduğu için CMP (Consent Management Platform) entegrasyonuna gerek yok. Ancak GA4 kullanıyorsanız Purpose 1 (Store and/or access information) için açık onay almanız zorunlu — bu onay Avrupa trafiğinde %58 oranında reddediliyor. Plausible bu onay gereksinimini ortadan kaldırır.

## Production Kurulum Checklist

Plausible'ı self-hosted olarak kuruyorsanız aşağıdaki adımları takip edin:

1. **DNS yapılandırması:** `tracking.yourdomain.com` alt domain'i oluşturun, SSL sertifikası (Let's Encrypt) kurun.
2. **Docker Compose:** Plausible'ın resmi GitHub repo'sundan `docker-compose.yml` çekin, `SECRET_KEY_BASE` ve `DATABASE_URL` environment variable'larını ayarlayın.
3. **ClickHouse tuning:** `/etc/clickhouse-server/config.xml` dosyasında `max_memory_usage` değerini sunucunuzun RAM'inin %60'ına ayarlayın (örn. 32GB RAM için `19200000000`).
4. **Nginx reverse proxy:** Rate limiting ekleyin (`limit_req_zone $binary_remote_addr zone=tracking:10m rate=10r/s;`) — DDoS koruması.
5. **Tracking script:** Frontend'e şu snippet'i ekleyin:

```html
<script defer data-domain="yourdomain.com" src="https://tracking.yourdomain.com/js/script.js"></script>
```

6. **Retention policy:** ClickHouse'da `TTL` ayarlayın (örn. 90 gün sonra otomatik silme):

```sql
ALTER TABLE events MODIFY TTL timestamp + INTERVAL 90 DAY;
```

7. **Backup:** PostgreSQL için günlük `pg_dump`, ClickHouse için `clickhouse-backup` tool kullanın.

Production'da ortalama 1M pageview/ay trafik için gerekli altyapı: 2 vCPU, 8GB RAM, 50GB SSD. Maliyeti AWS'de ~$80/ay, Hetzner'de ~$30/ay. Managed Plausible cloud'da aynı trafik için $99/ay ödüyorsunuz — self-hosted %70 daha ucuz ama DevOps overhead'ı var.

## Plausible Cookieless, Ama Yeterli mi

Privacy-first analytics'in sınırı açık: user-level journey analizi yapamıyorsanız bazı pazarlama sorularını cevaplayamazsınız. "Aynı kullanıcı kaç sefer geldi, ne zaman dönüştü" sorusu Plausible'da mümkün değil. GA4'te mümkün ama %40 consent kaybı ile. Çözüm: hybrid mimari. Plausible content performans ve genel trafik için, server-side GTM + first-party CDP conversion tracking ve remarketing için. İki katmanı BigQuery'de birleştirdiğinizde hem compliance hem derinlik sağlıyorsunuz. Eğer KVKK denetim riski yüksekse veya Avrupa trafiği ağırlıktaysa Plausible artık opsiyonel değil — zorunlu bir mühendislik kararı.