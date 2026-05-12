---
title: "Identity Resolution: 6 Sinyalden Tek Müşteri Kimliğine"
description: "Hash matching, probabilistic linking ve household identity ile dağınık sinyalleri tek müşteri kimliğine dönüştüren modern çözüm mimarileri."
publishedAt: 2026-05-12
modifiedAt: 2026-05-12
category: data
i18nKey: data-003-2026-05
tags: [identity-resolution, hash-matching, probabilistic-linking, cdp, first-party-data]
readingTime: 8
author: Roibase
---

Ortalama bir e-ticaret müşterisi satın almaya karar vermeden önce 6 farklı cihazdan 11 touchpoint üzerinden sizi görüyor. GA4 bunları 4 farklı user, CRM 2 farklı lead, e-posta platformu 1 subscriber olarak kaydediyor. Cookie sonrası dünyada bu parçaları birleştirmeden attribution imkansız, segmentasyon anlamsız, müşteri yaşam boyu değeri hesaplanamaz. Identity resolution bu parçaları birleştiren data engineering disiplini — deterministik hash matching'den probabilistic linking'e kadar 3 katmanlı mimari gerektiriyor.

## Hash Matching: Deterministik Kimlik Omurgası

Deterministik eşleşme SHA-256 hash üzerinden çalışır. E-posta adresi "user@example.com" → hash "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8" → her sistemde aynı hash varsa aynı kişi. Server-side GTM event payload'ına kullanıcı login olduğu anda `user_data.email_sha256` parametresi ekliyorsun, BigQuery'de bu hash üzerinden web session + CRM lead + Klaviyo subscriber tek satırda birleşiyor.

İki kritik nokta: hash salt stratejisi ve collision riski. Salt kullanmadan direkt hash alırsan rainbow table attack riski var ama pazarlama data pipeline'ında salt her sistemde tutarlı olmalı yoksa aynı e-posta farklı hash üretir. Collision riski SHA-256'da teorik — 2^256 uzayında pratik çakışma yok ama telefon numarası gibi düşük entropi alanlarında determinizm zayıflıyor. Bu yüzden e-posta + telefon kombinasyonu daha güvenli omurga oluşturuyor.

Klaviyo'dan BigQuery'ye veri çekerken `user_properties.email_sha256` sütunu ekleyip dbt model'inde `LEFT JOIN web_events USING (email_sha256)` yapıyorsun. Böylece anonim web session ile subscriber profili tek satıra düşüyor. Snapshot tablo stratejisi önemli — hash eşleşmeleri günlük snapshot'larda saklanmalı çünkü kullanıcı e-posta değiştirdiğinde geçmiş eşleşmeler kaybolmamalı.

## Probabilistic Linking: Fuzzy Logic ile Sinyal Birleştirme

Deterministik eşleşme cookie'siz mobil web'de yetersiz kalıyor. Kullanıcı login olmadan çıkış yapıyor, e-posta vermiyor ama IP + user agent + timezone + language kombinasyonu %87 ihtimalle aynı kişi. Burada probabilistic identity graph devreye giriyor — Bayesian probability ile sinyal ağırlıklandırması yapıyorsun.

Altı temel sinyal katmanı var: device fingerprint (canvas hash, WebGL renderer), network layer (IP subnet, ASN), behavioral pattern (session duration, path sequence), geolocation (GPS lat/long clustering), temporal signal (active hour pattern) ve contextual metadata (referrer domain, UTM consistency). Her sinyal 0-100 confidence score alıyor, ağırlıklı toplam 70'in üzerindeyse geçici bir `probabilistic_id` atanıyor.

BigQuery'de bunu şöyle modelliyorsun:

```sql
WITH signal_scores AS (
  SELECT
    session_id,
    device_fingerprint,
    ip_subnet,
    SUM(
      CASE WHEN device_fingerprint_match THEN 40 ELSE 0 END +
      CASE WHEN ip_subnet_match AND hour_diff < 4 THEN 25 ELSE 0 END +
      CASE WHEN behavior_vector_similarity > 0.8 THEN 20 ELSE 0 END
    ) AS total_confidence
  FROM event_stream
  WHERE timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
)
SELECT session_id, device_fingerprint, total_confidence,
  CASE WHEN total_confidence >= 70 
    THEN GENERATE_UUID() 
    ELSE NULL 
  END AS probabilistic_id
FROM signal_scores
```

Bu yaklaşımın trade-off'u false positive riski — shared device (ofis bilgisayarı) veya VPN kullanımı farklı kişileri birleştirebiliyor. Bu yüzden probabilistic ID'ler mutlaka deterministic hash ile doğrulanmalı — kullanıcı login olduğu anda hash üzerinden "merge" operasyonu yapılıp geçmiş probabilistic session'lar düzeltiliyor.

## Household Identity: Cihaz Kümesinden Ev Birimi

Karar birimi genellikle birey değil, ev. Aynı IP'den 3 cihaz var: MacBook (sabah kadın kullanıyor), iPhone (gün boyu), iPad (akşam çocuk). Bunları tek "individual" olarak merge etmek yanlış ama "household" olarak gruplamak segmentasyon için kritik — özellikle dayanıklı tüketim ürünlerinde (beyaz eşya, mobilya) satın alma kararı aile seviyesinde alınıyor.

Household graph router/modem MAC adresi + IP subnet + GPS konumu üzerinden kuruluyor. Device fingerprint değil network fingerprint baz alınıyor çünkü WiFi router her cihazda aynı gateway MAC'i veriyor. Burada dikkat edilmesi gereken alan public WiFi filtreleme — Starbucks IP'sinden gelen 200 cihazı "household" diye gruplarsan model çöküyor. Bunu session count threshold (aynı IP 50+ unique device → blacklist) ve dwelling time pattern (aynı IP'den 2+ saat session yok → retailer/cafe) ile filtreliyorsun.

BigQuery'de household ID'yi şöyle atıyorsun:

```sql
CREATE OR REPLACE TABLE households AS
WITH network_clusters AS (
  SELECT ip_subnet, router_mac, GPS_lat, GPS_long,
    APPROX_COUNT_DISTINCT(device_id) AS device_count,
    AVG(session_duration_sec) AS avg_session
  FROM sessions
  WHERE DATE(timestamp) > DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY 1,2,3,4
  HAVING device_count BETWEEN 1 AND 8 AND avg_session > 120
)
SELECT *, GENERATE_UUID() AS household_id
FROM network_clusters
```

Household seviyesinde lifetime value hesaplaması daha anlamlı çünkü beyaz eşya alımı tek kişi yapsın diye değil, ev için yapılıyor. [CDP & Retention Engineering](https://www.roibase.com.tr/tr/retention-engineering-cdp) mimarisinde household segment'ler kampanya hedeflemede bireysel segmentlerden %23 daha yüksek ROAS veriyor — çünkü tek bir telefon numarası farklı cihazlara mesaj göndermek yerine ev birimi stratejik hedefe dönüşüyor.

## Graph Stitching: Zamana Yayılı Kimlik Birleşimi

Identity graph statik değil — kullanıcı bugün anonim, yarın e-posta veriyor, 5 gün sonra login oluyor, 2 ay sonra telefon numarasını güncelliyor. Her yeni sinyal geldiğinde geçmiş fragmentler "stitch" ediliyor — yani eski probabilistic ID'ler yeni deterministic hash'e merge ediliyor.

Bunu event-driven yapıda çözüyorsun: her `user_identified` event'i Pub/Sub'a düşüyor, Cloud Function tetikleniyor, BigQuery'de `MERGE` statement çalışıyor. Örneğin kullanıcı login oldu → e-posta hash geldi → son 90 gün içinde aynı device fingerprint ile oluşturulmuş probabilistic ID'ler bu hash'e bağlanıyor. Bu backfill operasyonu attribution penceresi kadar geriye gitmeli — 30 günlük conversion window varsa 30 gün geriye stitch yapmalısın.

```sql
MERGE INTO unified_identity AS target
USING (
  SELECT probabilistic_id, email_sha256, MAX(timestamp) AS last_seen
  FROM identification_events
  WHERE event_name = 'user_login'
  GROUP BY 1,2
) AS source
ON target.probabilistic_id = source.probabilistic_id
WHEN MATCHED THEN UPDATE SET 
  target.email_sha256 = source.email_sha256,
  target.is_deterministic = TRUE,
  target.stitched_at = CURRENT_TIMESTAMP()
```

Stitching race condition riski taşıyor — aynı kullanıcı 2 cihazdan eşzamanlı login olursa iki farklı hash merge denemesi çakışabiliyor. Bunu transaction lock veya idempotency key ile çözüyorsun. Idempotency key genellikle `device_id + timestamp_truncated_to_second` oluyor — aynı saniye içinde aynı cihazdan gelen iki `user_login` eventi duplicate sayılıp tek merge tetikliyor.

## Privacy + Compliance: Hashed PII ve Veri Minimizasyonu

Identity resolution KVKK ve GDPR bağlamında "automated decision making" ve "profiling" kategorisine düşüyor — yani açık rıza olmadan yapılamaz. Consent Management Platform'dan (OneTrust, Cookiebot) `analytics_storage=granted` sinyali gelmediyse hash bile alamazsın. Consent Mode v2'de basic consent varken `user_data` parametresi boş bırakılıyor, enhanced consent sonrası hash ekleniyor.

Hash PII sayılmaz ama pseudonymization olarak kabul ediliyor — yani GDPR "right to be forgotten" kapsamında hash'lerin de silinmesi gerekiyor. BigQuery'de deletion request geldiğinde `email_sha256` üzerinden `DELETE` statement çalıştırmalısın ve bu silme işlemi downstream sistemlere (CDP, CRM) de yayılmalı. Bu yüzden hash mapping tablosu merkezi olmalı — dağıtık sistemlerde hash scattered halde durmak yerine single source of truth'tan türemeli.

Veri minimizasyonu prensibi identity graph'i 90 günle sınırlamalı. 90 günden eski probabilistic ID'ler archive'e taşınmalı, sadece deterministic hash'ler long-term saklanmalı. Bu hem compliance hem storage cost açısından kritik — BigQuery'de partition pruning ile 90 günlük rolling window uygulanırsa query cost %60 düşüyor.

## Prodüksiyon Pipeline Mimarisi: Batch + Streaming Hibrit

Identity resolution pipeline'ı iki katmanda çalışır: streaming layer (gerçek zamanlı sinyal toplama) ve batch layer (gece stitching). Streaming layer Pub/Sub → Dataflow → BigQuery write streaming insert ile çalışır, latency <10 saniye. Batch layer dbt scheduled run ile sabah 04:00'te tetiklenir, tüm graph stitching ve household clustering bu katmanda yapılır.

Streaming layer'da sadece sinyal toplanır — hash matching ve probabilistic scoring yapılmaz çünkü streaming'de complex JOIN pahalı. Event Firestore'a yazılır, `event_id` unique constraint ile duplicate yazma engellenir. Batch layer bu event'leri okuyup BigQuery'de dimensional model'e dönüştürür. dbt macro'ları ile hash generation, score calculation, graph merge tek pipeline'da zincirlenir.

Monitoring için graph coverage metriği kritik: `identified_users / total_active_users` oranı. %40'ın altındaysa deterministik sinyal eksikliği var demektir — login flow optimize edilmeli, lead form'lar e-posta capture'a odaklanmalı. %75'in üzerindeyse sağlıklı coverage sayılır. Bu metrik dbt test olarak `data_tests/identity_coverage.sql` dosyasında tanımlanır ve CI/CD'de her deployment öncesi çalıştırılır.

Identity resolution modern pazarlama stack'inin omurgası. Cookie'siz dünya deterministic hash'i altın standart yaptı ama tek başına yetersiz — probabilistic linking ve household clustering ile 3 katmanlı kimlik grafiği kurmalısın. BigQuery'de dbt ile modellenen bu pipeline consent-aware, privacy-compliant ve production-ready olduğunda attribution modellerini, segmentasyon stratejisini ve lifetime value tahminini aynı tek müşteri görüntüsü üzerinden kurabilirsin.