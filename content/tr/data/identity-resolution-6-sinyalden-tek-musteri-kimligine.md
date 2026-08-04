---
title: "Identity Resolution: 6 Sinyalden Tek Müşteri Kimliğine"
description: "Hash matching, probabilistic linking ve household identity ile parçalı sinyalleri birleştirip pazarlama datasını karar mekanizmasına bağlamak."
publishedAt: 2026-08-04
modifiedAt: 2026-08-04
category: data
i18nKey: data-003-2026-08
tags: [identity-resolution, hash-matching, probabilistic-linking, cdp, first-party-data]
readingTime: 8
author: Roibase
---

Bir kullanıcı web'de anonim gezinir, mobil uygulamada giriş yapar, newsletter'a farklı bir e-postayla kaydolur, mağazada kredi kartıyla ödeme alır. Her temas noktası ayrı bir sinyal — ama pazarlama bütçesini optimize etmek için bunları tek bir müşteri kimliğine bağlamak zorundasın. 2026'da cookie ortadan kalktı, cihaz sayısı artıyor, consent rate %40-60 bandında — identity resolution artık nice-to-have değil, ölçüm mimarisinin temel taşı.

## Hash Matching: E-posta ve Telefon Numarasını Veri Grafiğine Çevirmek

Hash matching, kullanıcı PII'sını (e-posta, telefon) SHA-256 ile özetleyip platform grafiklerine (Google PAIR, Meta Advanced Matching, LiveRamp) gönderdiğin yöntem. Raw PII asla browser'a düşmez — server-side GTM veya CDP'de hash'lenip Measurement Protocol'a iletilir.

Örnek akış: kullanıcı checkout formunda `[email protected]` girer. Server-side konteynerinde JavaScript `sha256('jane.doe@example.com')` → `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` hash'ini üretir, Google Analytics 4 `user_id` parametresine ekler. Google bu hash'i kendi kimlik grafiğiyle karşılaştırır — kullanıcı daha önce Google Ads'e giriş yapmışsa match olur, cross-device attribution zincirine girer.

SHA-256 tek yönlü, ama salt eklemezsen rainbow table ile kırılabilir. Production'da `sha256(email + pepper)` kullan (pepper: global gizli anahtar, çevre değişkeninde tut). Meta Advanced Matching'de hash + country code kombinasyonu match rate'i %12-18 artırıyor (Meta 2025 benchmark). Hash matching'in sınırı consent — GDPR altında kullanıcı "rıza gösterdim" kutusunu işaretlemediyse hash bile gönderemezsin.

### Hash Matching BigQuery Pipeline Örneği

```sql
-- dbt model: hash_user_pii.sql
WITH raw_signups AS (
  SELECT
    user_id,
    LOWER(TRIM(email)) AS email_normalized,
    REGEXP_REPLACE(phone, r'[^\d]', '') AS phone_normalized,
    created_at
  FROM {{ ref('raw_user_signups') }}
)
SELECT
  user_id,
  TO_HEX(SHA256(CONCAT(email_normalized, '{{env_var("HASH_PEPPER")}}'))) AS email_hash,
  TO_HEX(SHA256(CONCAT(phone_normalized, '{{env_var("HASH_PEPPER")}}'))) AS phone_hash,
  created_at
FROM raw_signups
WHERE email_normalized IS NOT NULL
  AND LENGTH(phone_normalized) >= 10
```

Bu model dbt'de parametrize ediliyor, pepper çevre değişkeninde saklanıyor, downstream'de sGTM event'lerine `user_data` nesnesine ekleniyor. Salt eklemezsen PII hash'i reversibl — production'da pepper zorunlu.

## Probabilistic Linking: Fingerprint ve Davranış Grafiği

Deterministic match (e-posta/telefon) olmadığında probabilistic linking devreye girer. Cihaz fingerprint (User-Agent, IP, screen resolution, timezone), event sequence pattern ve session süresi gibi davranışsal sinyallerle kullanıcıları kümeleme yaparsın. Confidence score'u %60'ın altına düştüğünde link yapmayı kes — false positive rate pazarlama bütçesine direkt yansır.

Örnek senaryo: aynı IP'den 30 dakika arayla iki farklı cihaz (iPhone Safari, MacBook Chrome) e-ticaret sitene giriş yapıyor, ikisi de aynı ürün kategorisine bakıyor, checkout adımında session kesiyor. Probabilistic motor bu iki session'ı "household same user" olarak %78 confidence ile etiketler. Eğer daha sonra iPhone'dan giriş yapıp siparişi tamamlarsa confidence %95'e çıkar, identity graph'ta birleştirilir.

LiveRamp IdentityLink, The Trade Desk Unified ID 2.0 gibi çözümler probabilistic + deterministic hibridi kullanıyor. UID2 framework'ünde e-posta hash'i + bidstream sinyalleri birleştirilip skor çıkarılıyor (UID2 spec 2025). Kendi pipeline'ında probabilistic yapacaksan DBscan veya hierarchical clustering algoritmalarını dene — ama production'da interpretability kritik, blackbox ML modeli yerine rule-based skorlama tercih edilir.

| Sinyal Tipi | Match Confidence | Privacy Risk | Kullanım Alanı |
|---|---|---|---|
| E-posta hash (SHA-256 + pepper) | %92-98 | Düşük (consent gerekli) | Cross-device GA4, Meta CAPI |
| Telefon hash (SHA-256 + pepper) | %88-94 | Orta (KVKK açık rıza) | CRM → Ad platform sync |
| IP + User-Agent | %55-70 | Yüksek (fingerprinting) | Fraud detection, bot filtreleme |
| Behavioral sequence (event pattern) | %60-80 | Düşük (anonimleştirilmiş) | Session stitching, journey analizi |

Probabilistic linking'i [CDP & Retention Engineering](https://www.roibase.com.tr/tr/retention-engineering-cdp) katmanında yaparsan data lake'te anonimleştirilmiş kimlik grafiği tutabilirsin — KVKK compliance'ı da bu mimariyle kolay.

## Household Identity: Cihaz Değil Konum Bazlı Kimlik

Bir evin içindeki tüm cihazları (smart TV, tablet, telefon, laptop) tek bir household ID altında toplamak, özellikle FMCG, telekom ve finans sektörlerinde kritik. Tek bir kullanıcıyı değil, ödeme gücüne sahip "ev halkı" birimini tanımlarsın.

Google'ın PAIR (Publisher Advertiser Identity Reconciliation) protokolü household graph'ı destekliyor — aynı Wi-Fi ağına bağlı cihazlar (IP + location + timezone match) aggregate edilip reklam sinyaline dönüştürülür. Ancak PAIR consent-based: kullanıcı Consent Mode v2'de "ad_storage=granted" vermediyse household ID oluşmaz.

Household identity pratik örnek: bir aile Netflix'e abonedir, anne ve baba farklı profillerde izliyor, TV'de çocuk çizgi film seyrediyor. OTT reklamcılık platformu (Roku, Samsung Ads) bu üç profile tek household ID atar, reklam frequency capping'i cihaz değil household seviyesinde yapar. Aynı 30 saniyelik reklam 1 haftada household'a en fazla 5 kez gösterilir — cihaz bazında 15 impression olsa bile.

### Household ID Kuralı Pipeline Örneği

```sql
-- dbt model: household_identity_graph.sql
WITH device_sessions AS (
  SELECT
    device_id,
    ip_address,
    timezone,
    CAST(TIMESTAMP_TRUNC(session_start, HOUR) AS STRING) AS session_hour,
    user_agent
  FROM {{ ref('raw_sessions') }}
  WHERE session_start >= CURRENT_DATE() - 7
),
household_candidates AS (
  SELECT
    ip_address,
    timezone,
    session_hour,
    ARRAY_AGG(DISTINCT device_id) AS devices
  FROM device_sessions
  GROUP BY ip_address, timezone, session_hour
  HAVING COUNT(DISTINCT device_id) > 1
)
SELECT
  FARM_FINGERPRINT(CONCAT(ip_address, timezone)) AS household_id,
  devices,
  ARRAY_LENGTH(devices) AS device_count
FROM household_candidates
```

Bu model aynı IP + timezone kombinasyonundan gelen cihazları 1 saatlik zaman penceresinde grupluyor. Production'da `session_hour` yerine 4 saatlik window kullan (ev içi cihazların aynı anda aktif olma ihtimali artar). Fraud riski için device_count > 10 olan household'ları filtrele.

## Identity Graph Senkronizasyonu: Data Lake'ten Reklam Platformuna

Hash matching ve probabilistic linking'den çıkan kimlik grafiğini BigQuery'de tutuyorsun, ama Google Ads, Meta, klaviyo gibi platformlar kendi kimlik sistemlerini kullanıyor. Senkronizasyon katmanı olmadan identity resolution ölü veri kalır.

Orchestration akışı: her gece 02:00'de Airflow DAG'ı çalışır, BigQuery'deki `identity_graph` tablosundan son 7 günde güncellenmiş kayıtları çeker, e-posta hash'lerini Google Ads Customer Match API'sine, telefon hash'lerini Meta Conversions API'ye POST eder. API rate limit kontrolü zorunlu — Google Customer Match günlük 500K satır, Meta CAPI 1M event limiti var (2025 standart tier).

Google Ads Customer Match için en az 1.000 matched user gerekiyor (audience threshold). E-posta hash'lerini upload ettiğinde Google kendi grafiğiyle karşılaştırır, match rate %40-70 arasında gelir (verilen e-posta kalitesine bağlı). Match olmayan hash'ler sisteme girmez — bu yüzden [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) katmanında veri kalitesini baştan garantilemen lazım.

Meta Conversions API'de hash matching'e ek olarak `fbc` (Facebook Click ID) ve `fbp` (Facebook Browser ID) cookie'lerini de gönderebilirsin. Kullanıcı Meta reklamına tıklayıp siteye geldiyse `fbc` parametresi URL'de (`fbclid=`), bu parametreyi server-side yakalayıp CAPI event'ine ekle — attribution window 28 güne çıkar, match rate %18-25 artar (Meta 2025 internal benchmark).

## Privacy + Compliance: Identity Resolution'ın Sınırları

Identity resolution'ı KVKK, GDPR ve CCPA ile uyumlu yapmazsan data pipeline legal riski taşır. Temel kural: kullanıcı açık rıza vermeden hash bile üretemezsin (KVKK madde 5). Consent Management Platform (OneTrust, Cookiebot) ile entegrasyonu şart.

Consent Mode v2'de kullanıcı "ad_storage=denied" verirse Google sana PII gönderme, hashing yapma izni yok. Server-side GTM'de `consent` event'ini dinle, consent granted olmadan `sha256()` fonksiyonunu çalıştırma. Aynı kural Meta CAPI için de geçerli — `data_processing_options` parametresini "LDU" (Limited Data Use) moduna al.

CCPA altında "Do Not Sell" sinyali gelirse identity graph'tan kullanıcıyı çıkar, hash'lenmiş PII'yı platform API'lerinden sil. Google Customer Match ve Meta Custom Audience'lar için silme API'si var — 48 saat içinde hash'i sistemlerinden remove ederler (CCPA compliance SLA). BigQuery'de `user_deletion_requests` tablosu tut, her gece bu tabloya göre identity graph'ı clean et.

## İzlenebilirlik: Identity Resolution'ı Debug Etmek

Identity graph production'a alındıktan sonra en büyük sorun "neden bu iki cihaz birleşmedi?" sorusuna cevap vermek. Monitoring tablosu olmadan debug edemezsin.

BigQuery'de `identity_resolution_log` tablosu kur, her merge operasyonunun metadata'sını kaydet: hangi sinyaller kullanıldı (email_hash, phone_hash, ip_fingerprint), confidence score kaç, hangi tarihte merge edildi, hangi downstream platform'a sync edildi. dbt test'leriyle data quality'yi kontrol et — örneğin aynı `household_id` altında 50'den fazla cihaz varsa alert bas (bot trafiği veya proxy server olabilir).

Google Analytics 4'te User-ID raporu açıp cross-device kullanıcı sayısını izle. Eğer identity resolution pipeline'ı çalışıyorsa "users (cross-device)" metriği "total users"tan %15-30 düşük çıkmalı (gerçek kullanıcı sayısı device count'tan az). Bu fark kapanmıyorsa hash matching veya probabilistic linking katmanında data leak var — consent event'lerini veya hash pepper'ı kontrol et.

---

Identity resolution'ı tek seferlik proje olarak değil, sürekli optimize edilmesi gereken data pipeline olarak kur. Hash matching + probabilistic linking + household identity kombinasyonuyla parçalı sinyalleri birleştir, ama compliance kurallarını baştan tasarla — yoksa data lake yasal risk deposuna döner. İlk adım: BigQuery'de `identity_graph` tablosu oluştur, dbt ile hash pipeline'ı kur, Airflow ile Google Ads Customer Match'e sync et. Sonraki adım: confidence score threshold'unu %70'e çekip false positive rate'i ölç, ardından Meta ve Klaviyo'ya genişlet. Identity resolution yapmazsan pazarlama bütçesinin %22-35'i yanlış attribution'a gidiyor (Forrester 2025) — bu rakamı düşürmek için graph'ı şimdi kur.