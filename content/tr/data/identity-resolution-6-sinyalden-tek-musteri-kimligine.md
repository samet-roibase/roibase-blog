---
title: "Identity Resolution: 6 Sinyalden Tek Müşteri Kimliğine"
description: "Hash matching, probabilistic linking ve household identity ile dağınık müşteri sinyallerini tek kimliğe bağlama mühendisliği. BigQuery + CDP pratiği."
publishedAt: 2026-06-16
modifiedAt: 2026-06-16
category: data
i18nKey: data-003-2026-06
tags: [identity-resolution, customer-data-platform, hash-matching, probabilistic-linking, first-party-data]
readingTime: 8
author: Roibase
---

Cookie ömrü ortalama 28 günden 7 güne düştü. Bir kullanıcı mobil app'te başlıyor, masaüstü web'de ödeme yapıyor, e-posta kampanyasından geri dönüyor — her touch point farklı identifier üretiyor. Pazarlama datasının %40'ı orphan event olarak kalıyor: kullanıcı ID'si yok, session ID yok, conversion attribution yok. Identity resolution bu parçaları mühendislik disipliniyle birleştirme operasyonu. Tahmin yerine hash matching, muhakeme yerine probabilistic graph, varsayım yerine household clustering.

## Deterministic Matching: Hash Tabanlı Birleştirme

Deterministic match, iki datapointin **aynı identifier'ı paylaştığını kesin bildiğin** durumda çalışır. E-posta SHA-256 hash'i, telefon numarası hash'i, CRM ID. BigQuery event tablosunda `user_id` varsa ama web analytics'te `ga_client_id` varsa, ikisini JOIN edemezsin — önce ikisinin de yazıldığı bir köprü event'i bulup mapping tablosu oluşturman gerekir.

```sql
-- Deterministic identity stitching örneği
CREATE OR REPLACE TABLE `project.dataset.identity_graph` AS
WITH email_hashes AS (
  SELECT DISTINCT
    user_pseudo_id,
    TO_HEX(SHA256(LOWER(TRIM(user_properties.email.value)))) AS email_hash
  FROM `project.dataset.events_*`
  WHERE user_properties.email.value IS NOT NULL
),
crm_map AS (
  SELECT
    crm_id,
    TO_HEX(SHA256(LOWER(TRIM(email)))) AS email_hash
  FROM `project.crm.customers`
)
SELECT
  e.user_pseudo_id,
  c.crm_id,
  e.email_hash
FROM email_hashes e
INNER JOIN crm_map c
  ON e.email_hash = c.email_hash;
```

Bu sorgu Firebase Analytics'ten gelen `user_pseudo_id` değerini CRM'deki `crm_id` ile **kesin eşleşme** üzerinden bağlar. E-posta hash'i anchor identifier olarak kullanılır. Önemli detay: `LOWER(TRIM())` — kullanıcı "Ali@X.com" yazsa da CRM'de "ali@x.com" olarak tutuluyorsa hash eşleşmesi kırılır. Bu yüzden normalizasyon pipeline'ın ilk adımı.

Deterministic match'in precision'ı %100, recall'u düşük — yalnızca iki sistemde de aynı identifier olan kayıtları bulur. Bir kullanıcı web'de e-posta vermeden çıkış yaptıysa bu graph'a girmez.

### Hash Collision ve Privacy

SHA-256 collision probability teorik olarak 2^-256 — pratik kullanımda sıfır. Ancak GDPR Article 32 "pseudonymization" kavramını hash'e eşitlemez; hash tek başına anonymization değildir. Email hash + IP + timestamp kombinasyonu ile kullanıcı re-identify edilebilir. Bu yüzden hash tabloları encryption-at-rest + column-level access control ile korunmalı.

## Probabilistic Linking: Graph Tabanlı Olasılıksal Eşleşme

Deterministic join başarısız olduğunda probabilistic matching devreye girer. Farklı identifier'lara sahip iki record'u **davranış benzerliği**, **device fingerprint**, **timezone + user-agent** gibi weak signal'lar üzerinden eşleştirirsin. Makine öğrenmesi modeli değil — weighted scoring + threshold sistemi yeterli.

| Signal | Ağırlık | Örnek |
|--------|---------|-------|
| Aynı IP (24 saat içinde) | 0.3 | 192.168.1.10 |
| Aynı User-Agent | 0.2 | Chrome 120 / Mac |
| Aynı coğrafi konum | 0.15 | Istanbul, Kadıköy |
| Aynı kampanya tıklaması | 0.25 | utm_campaign=spring_sale |
| Aynı ürün görüntüleme sırası | 0.1 | product_123 → product_456 |

Toplam skor ≥ 0.7 ise iki session **muhtemelen** aynı kişi. Bu threshold dataset'e göre ayarlanır — e-ticaret sitelerinde 0.65 yeterli olabilir, fintech'te 0.85 gerekir.

```sql
-- Probabilistic scoring örneği
WITH sessions AS (
  SELECT
    session_id,
    user_pseudo_id,
    device.operating_system,
    device.web_info.browser,
    geo.city,
    traffic_source.medium,
    ARRAY_AGG(ecommerce.items.item_id ORDER BY event_timestamp) AS item_sequence
  FROM `project.dataset.events_*`
  WHERE event_name = 'page_view'
  GROUP BY 1,2,3,4,5,6
)
SELECT
  a.session_id AS session_a,
  b.session_id AS session_b,
  (CASE WHEN a.operating_system = b.operating_system THEN 0.2 ELSE 0 END +
   CASE WHEN a.browser = b.browser THEN 0.2 ELSE 0 END +
   CASE WHEN a.city = b.city THEN 0.15 ELSE 0 END +
   CASE WHEN a.medium = b.medium THEN 0.25 ELSE 0 END +
   CASE WHEN a.item_sequence = b.item_sequence THEN 0.2 ELSE 0 END
  ) AS match_score
FROM sessions a
CROSS JOIN sessions b
WHERE a.session_id < b.session_id  -- self-join optimization
  AND a.user_pseudo_id != b.user_pseudo_id
HAVING match_score >= 0.7;
```

Bu sorgu **tüm session çiftlerini** karşılaştırır — N² complexity. 1M session varsa 500 milyar karşılaştırma. Production'da partitioning gerekir: timestamp window (7 gün), geo filter (aynı şehir), device type (mobile-mobile).

Probabilistic link'in false positive oranı %5-15 arası. Bu yüzden downstream activation'da (CDP segment push, e-posta kampanyası) bu ID'leri "potential duplicate" flag'i ile işaretlemen gerekir.

## Household Identity: Aynı Cihaz, Farklı Kullanıcılar

Tablet veya Smart TV birden fazla kişi tarafından kullanılır. Deterministik veya probabilistic matching burada aile içindeki farklı profilleri tek ID'ye çöker — yanlış personalization'a yol açar. Household identity resolution bu senaryoyu ayırt etmeye çalışır.

**Session-level fingerprint:** Aynı cihazda farklı saatlerde login olan kullanıcılar farklı browsing pattern gösterir. Sabah 08:00'de çocuk kıyafeti arayan kullanıcı ile gece 23:00'te elektronik arayan kullanıcı ayrıştırılabilir.

**Behavioral clustering:** K-means veya hierarchical clustering ile session'ları gruplandırırsın. Cluster centroid'leri farklıysa aynı device_id altında iki ayrı "virtual user" yaratırsın.

```sql
-- Household clustering için feature extraction
CREATE OR REPLACE TABLE `project.dataset.household_features` AS
SELECT
  device_id,
  EXTRACT(HOUR FROM TIMESTAMP_MICROS(event_timestamp)) AS hour_of_day,
  COUNT(DISTINCT CASE WHEN event_name = 'purchase' THEN ecommerce.transaction_id END) AS purchase_count,
  APPROX_TOP_COUNT(ecommerce.items.item_category, 3) AS top_categories,
  AVG(ecommerce.purchase_revenue_in_usd) AS avg_basket_value
FROM `project.dataset.events_*`
WHERE device_id IS NOT NULL
GROUP BY device_id, hour_of_day;
```

Clustering sonrası her device_id için `household_user_1`, `household_user_2` gibi virtual ID'ler üretilir. Bu ID'ler CRM'e sync edilmez — sadece analytics ve personalization layer'da kullanılır.

Household resolution'un hassasiyeti düşük — %30 hata payı normal. Bu yüzden e-ticaret dışında (özellikle SaaS, fintech) kullanılmaz.

## Identity Graph Yapısı ve Güncel Tutma

Tüm matching sonuçları tek bir **identity graph** tablosunda birleşir. Bu tablo her user_id için tüm bilinen alias'ları tutar: email hash, CRM ID, ga_client_id, Firebase ID, advertising ID.

| canonical_id | identifier_type | identifier_value | match_method | confidence | updated_at |
|--------------|-----------------|------------------|--------------|------------|------------|
| user_0001 | email_hash | a1b2c3... | deterministic | 1.0 | 2026-06-15 |
| user_0001 | ga_client_id | GA1.2.123 | deterministic | 1.0 | 2026-06-14 |
| user_0001 | firebase_id | xyz789 | probabilistic | 0.75 | 2026-06-16 |
| user_0002 | crm_id | CRM-456 | deterministic | 1.0 | 2026-06-10 |

Graph incremental olarak güncellenir — her gün yeni event'ler taranır, yeni eşleşmeler eklenir. Eski link'ler confidence decay ile zayıflar: 90 gün eski bir probabilistic link confidence'ı 0.75'ten 0.50'ye düşer.

Graph'ı **directed acyclic graph (DAG)** olarak modellersen loop'ları tespit edebilirsin. User A → User B → User C → User A döngüsü veri hatası işareti — manuel review gerekir.

## CDP Entegrasyonu ve Activation Pipeline

Identity graph tek başına kullanılmaz — CDP'ye beslenir. [CDP & Retention Engineering](https://www.roibase.com.tr/tr/retention-engineering-cdp) mimarisi graph'tan canonical_id'yi alır, tüm touch point'leri bu ID altında birleştirir, segment engine'e gönderir.

Activation süreci şöyle işler:

1. **Segment definition:** "Son 30 günde 3+ session, sepete ekleme var ama satın alma yok" → BigQuery view olarak tanımlanır.
2. **Identity resolution:** View her user_pseudo_id için canonical_id lookup yapar.
3. **Channel sync:** Canonical_id altındaki tüm email hash'leri Meta CAPI'ye, phone hash'leri Google Customer Match'e push edilir.
4. **Attribution:** Conversion event geldiğinde canonical_id ile tüm touch point'ler graph üzerinden trace edilir.

CDP olmadan identity resolution yarım kalır — graph sadece "kim kimle eşleşiyor" bilgisini tutar, "bu kullanıcıya ne aksiyonu almalıyım" kararını vermez.

## Privacy Compliance ve Consent Propagation

Identity resolution GDPR Article 6(1)(f) "legitimate interest" ile meşrulaştırılabilir — ancak kullanıcı açık rıza vermemişse bu graph'tan türetilen ID'ler ile remarketing yapamazsın. Consent Management Platform (CMP) ile graph entegrasyonu şart.

Her canonical_id için consent durumu tutulur: `{ analytics: true, marketing: false, personalization: true }`. Graph'tan türetilen identifier bu flag'i miras alır — yani User A'nın email_hash'i marketing=false ise, User A'nın probabilistic link ile eşleştiği User B'nin ga_client_id'si de marketing segmentlerine girmez.

TCF 2.2 altında vendor consent propagation daha karmaşık: Meta'ya consent verilmiş ama Google'a verilmemiş kullanıcılar için graph selective sync yapılır. Bu mimari [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) sürecinin parçası — consent signal'ları event pipeline'ına en başta enjekte edilir, graph güncelleme job'ları bu signal'ları okur.

---

Identity resolution salt teknik bir JOIN operasyonu değil — pazarlama datasını karar mekanizmasına bağlayan kritik katman. Hash matching ile kesin eşleşmeleri, probabilistic scoring ile zayıf sinyalleri, household clustering ile cihaz paylaşımını çözmek mühendislik detayı gerektirir. Graph'ı güncel tutmak, consent propagation ile uyumlu hale getirmek, CDP activation pipeline'ına beslemek bu disiplinin production tarafı. Cookie'siz çağda müşteri kimliği tahmin edilmez — altı farklı identifier'dan birleştirilerek oluşturulur.