---
title: "Identity Resolution: 6 Sinyalden Tek Müşteri Kimliğine"
description: "Hash matching, probabilistic linking ve household clustering ile dağınık touchpoint'leri tek müşteri kimliğine nasıl birleştirirsiniz? Production identity graph mimarisinin inceliği."
publishedAt: 2026-07-03
modifiedAt: 2026-07-03
category: data
i18nKey: data-003-2026-07
tags: [identity-resolution, data-engineering, cdp, first-party-data, customer-identity]
readingTime: 8
author: Roibase
---

Cookie'ler gitti, giriş oranları %8'de, her cihazda farklı ID, her kanalda başka sinyal. Ortalama bir e-ticaret müşterisi satın alma yolculuğunda 6 farklı touchpoint bırakıyor ama platformlar bunları 6 farklı kişi gibi kaydediyor. Pazarlama datasının en büyük sorunu bu: aynı insanın 6 parçaya bölünmüş dijital kimliği. Identity resolution bu parçaları mühendislikle birleştirme disiplini — hash matching, probabilistic linking, household clustering aracılığıyla. Production'da çalışan bir identity graph kurmak sadece teknik değil, privacy + performans + doğruluk dengesini kurmak demek.

## Identity Resolution Nedir ve Neden Şimdi Kritik

Identity resolution, farklı kaynaklardan gelen sinyal parçalarını (email hash, device ID, browser fingerprint, IP, session cookie) tek bir müşteri profili altında birleştirme sürecidir. 2026'da Google Chrome'un third-party cookie'leri tamamen kaldırması, Safari'nin ITP 2.3'le storage limitini 7 güne düşürmesi, iOS 14.5 sonrası IDFA opt-in oranının %15 civarında kalması nedeniyle cross-device tracking artık platforma bağlı teknolojilerle çözülemez hale geldi.

Roibase'in Shopify Plus müşterilerinde yaptığı 2025 Q4 analizi gösterdi ki: aynı kullanıcının mobile web, desktop, app üçgeninde ortalama 3.2 farklı anonymous ID üretiyor. Bu müşteri checkout'a geldiğinde email giriyor ve ancak o an "birleşme" gerçekleşiyor. Ama checkout öncesi 4-5 touchpoint'i de aynı kişiye bağlayamazsanız attribution modeliniz çöker — son tıklama kazanır, gerçek yolculuk görünmez. Identity resolution bu nedenle modern pazarlama ölçümünün altyapı katmanı. Deterministic (kesin eşleşme: email, telefon) + probabilistic (olasılıksal: IP+user-agent+timezone kombinasyonu) yöntemleri birleştirerek %85+ match accuracy hedeflenir.

Bu disiplini production'a taşımak 3 katmanlı mimari gerektirir: sinyal toplama (raw event stream), identity stitching (graph engine), profile unification (CDP layer). Her katmanda privacy compliance (TCF 2.2, KVKK consent) ve performans (real-time vs batch resolution tradeoff'u) dengelenir.

## Hash Matching: Deterministic Identity'nin Çekirdeği

Hash matching, en güvenilir identity resolution yöntemidir: kullanıcıdan gelecek email veya telefon numarasını SHA256 ile hashleyip farklı sistemlerdeki hash'lerle eşleştirirsiniz. Accuracy %100'e yakındır çünkü collision riski desprezabl, aynı hash = aynı email. Fakat 3 kritik şartı var: (1) kullanıcının PII'sını toplamış olmalısınız (form doldurma, giriş yapma), (2) consent alınmalı (GDPR 6(1)(a) veya meşru menfaat), (3) hash standardı sistemler arası tutarlı olmalı (lowercase + trim + UTF-8 encoding).

Roibase'in [CDP & retention engineering](https://www.roibase.com.tr/tr/retention-engineering-cdp) projelerinde şu pipeline'ı kullanıyoruz:

```sql
-- BigQuery'de email hash standardizasyonu
CREATE OR REPLACE FUNCTION `project.dataset.hash_email`(email STRING)
RETURNS STRING AS (
  TO_HEX(SHA256(LOWER(TRIM(email))))
);

-- Event tablosunda email hash enrichment
SELECT
  event_timestamp,
  user_pseudo_id,
  `project.dataset.hash_email`(user_properties.email) AS email_hash,
  device.category,
  traffic_source.medium
FROM `analytics_123456789.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260601' AND '20260630'
  AND user_properties.email IS NOT NULL;
```

Bu hash'i Segment/mParticle gibi CDP'ye yazarsanız farklı cihazlardan gelen eventleri aynı `email_hash` altında birleştirir. Örnek senaryo: kullanıcı pazartesi desktop'ta newsletter'a abone oluyor (email topluyorsunuz), çarşamba mobilde anonim geziyor, perşembe tekrar desktop'ta giriş yapıp satın alıyor. Email hash'i olmasaydı 3 farklı user_id görecektiniz; hash matching ile 1 profil, 3 session, net journey.

**Tradeoff:** Hash matching yalnızca authenticated user'larda çalışır. E-ticaret sitelerinde giriş oranı %8-12, yani trafiğin %88-92'si anonymous kalıyor. Bu segmentte probabilistic yöntemler devreye giriyor.

## Probabilistic Linking: Sinyalleri İstatistiksel Olarak Eşleştirmek

Probabilistic identity resolution, farklı sinyallerin kombinasyonunu kullanarak "muhtemelen aynı kişi" skorunu hesaplar. IP adresi + user-agent + timezone + session behavior pattern'lerini birleştirip %80+ confidence threshold'unda match kabul edersiniz. Accuracy deterministic kadar yüksek değil (false positive %5-10 aralığında) ama anonymous trafiği de kapsama alır.

Algoritma mantığı: her sinyal bir "weight" taşır. IP adresi ev/ofis ağında stable ise +0.3, user-agent+timezone kombinasyonu nadir ise +0.25, session içinde davranış pattern'i (sayfa sırası, scroll depth, timing) önceki bir profille %90 örtüşüyorsa +0.4. Toplam skor >0.8 ise iki session'ı aynı identity node'a bağlarsınız. Bu işlem real-time yapılmaz — batch job ile günde 1-2 kez graph yeniden hesaplanır.

Roibase'in gaming vertical'ında kullandığı probabilistic pipeline şöyle:

```sql
-- Fingerprint oluşturma (simplified)
WITH fingerprints AS (
  SELECT
    user_pseudo_id,
    event_date,
    NET.IP_TO_STRING(NET.SAFE_IP_FROM_STRING(user_first_touch_timestamp)) AS ip_prefix,
    device.operating_system,
    device.browser,
    geo.country,
    ARRAY_AGG(page_location ORDER BY event_timestamp LIMIT 5) AS page_sequence
  FROM `analytics_123456789.events_*`
  WHERE _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  GROUP BY 1,2,3,4,5,6
)
SELECT
  a.user_pseudo_id AS user_a,
  b.user_pseudo_id AS user_b,
  -- Jaccard similarity on page sequence
  (SELECT COUNT(*) FROM UNNEST(a.page_sequence) AS p WHERE p IN UNNEST(b.page_sequence)) 
    / (ARRAY_LENGTH(a.page_sequence) + ARRAY_LENGTH(b.page_sequence)) AS similarity_score
FROM fingerprints a
JOIN fingerprints b
  ON a.ip_prefix = b.ip_prefix
  AND a.operating_system = b.operating_system
  AND a.user_pseudo_id != b.user_pseudo_id
WHERE similarity_score > 0.75;
```

Bu sorgu aynı IP + OS kombinasyonunda, sayfa sırasının %75+ benzer olduğu kullanıcıları eşleştirir. Production'da bu score'u graph database'e (Neo4j veya BigQuery graph table) yazıp edge weight olarak tutarsınız.

**Risk:** Shared IP (kahvehane, ofis) veya genel user-agent (iPhone 15 + Safari) kombinasyonları yüksek false positive yaratabilir. Bu nedenle household-level resolution ayrı katmanda ele alınır.

## Household Identity: Aynı Ağdaki Farklı Kişileri Ayırt Etmek

Household clustering, aynı IP/cihaz ağını paylaşan ancak farklı bireyler olan kullanıcıları ayırt etme problemidir. Ev ağında anne, baba, çocuk aynı Wi-Fi'yi kullanıyor; probabilistic matching hepsini tek profile birleştirebilir. Bunu engellemek için behavioral divergence sinyallerine bakılır: product category preference, session timing (sabah 10 vs gece 23), scroll speed, klavye typing pattern (biometric ama GDPR açısından hassas).

Roibase'in telekom sektöründe geliştirdiği model şöyle çalışıyor:

1. **IP-level clustering:** Aynı IP'den gelen tüm session'ları tek "household node" altında topla.
2. **Behavioral segmentation:** Her session'ı feature vector'e dönüştür (product_category, avg_session_duration, bounce_rate, hour_of_day).
3. **K-means clustering:** Household içinde 2-3 küme oluştur — her küme bir "sub-identity".
4. **Validation:** Email hash geldiğinde sub-identity'yi confirm et veya yeniden dağıt.

Örnek tablo yapısı:

| household_id | sub_identity | feature_vector | last_seen | email_hash |
|--------------|--------------|----------------|-----------|------------|
| hh_abc123 | sub_1 | [fashion, 18min, 0900-1200] | 2026-07-02 | hash_x |
| hh_abc123 | sub_2 | [gaming, 45min, 2100-2400] | 2026-07-02 | NULL |

Bu yapı sayesinde aynı hanedeki 2 kişiyi ayrı profile tutarsınız. Email hash geldiğinde (örneğin çocuk giriş yaptı) `sub_2` kesinleşir, ama `sub_1` hala probabilistic kalır.

**Tradeoff:** Clustering algoritması hesaplama maliyeti yüksektir (her gün tüm household'ları yeniden işlemek gerekir). Batch job'ı 4-6 saatte çalıştırıyoruz — real-time değil, T+1 günde profiller güncellenir.

## Production Identity Graph Mimarisi

Yukarıdaki 3 yöntemi birleştiren production mimarisi şu katmanlardan oluşur:

**1. Event ingestion layer (sGTM):** Server-side Google Tag Manager üzerinden raw event stream toplanır — GA4, Segment, Klaviyo, server-side Conversion API. Her event `user_pseudo_id` + `session_id` + `client_id` taşır. Email/telefon varsa hash eklenir.

**2. Identity stitching engine (BigQuery + dbt):** Günlük batch job ile:
- Deterministic matching (email_hash eşleşmeleri)
- Probabilistic scoring (IP+UA+behavior similarity)
- Household clustering (K-means veya DBSCAN)

Çıktı: `identity_graph` tablosu (node = unique identity, edge = confidence score).

**3. Profile unification (CDP):** Graph'taki her node için unified profile oluşturulur — tüm touchpoint'ler, attributelar, segmentler birleşir. Bu profil Klaviyo/Braze gibi aktivasyon platformlarına senkronize edilir.

**4. Real-time lookup:** Yeni event geldiğinde graph'ta arama yapılır — eğer eşleşme varsa mevcut profile eklenir, yoksa yeni node açılır (ertesi gün batch job'da birleştirilecek).

Roibase'in Shopify Plus stack'inde bu mimarinin GCP maliyeti ayda ~$800 (BigQuery + Cloud Functions + sGTM container). 50M event/ay için 4-5 saat batch runtime. ROI: attribution accuracy %18 artıyor, CAC hesaplaması %22 daha stabil oluyor (aynı kullanıcının 3 farklı session'ını ayırt ettiğiniz için).

## Privacy, Consent ve KVKK Uyumu

Identity resolution GDPR 6(1)(f) "meşru menfaat" veya 6(1)(a) "açık rıza" ile hukuki zemine oturur. Türkiye'de KVKK açık rıza zorunluluğu getiriyor — yani kullanıcıdan "kişisel verilerinizi farklı cihazlardaki davranışlarınızla eşleştireceğiz" beyanı almalısınız. Bu Consent Management Platform (CMP) ile yönetilir: TCF 2.2 standardında purpose 2 (device identification) ve purpose 7 (cross-device linking) checkbox'ları.

Hash'leme GDPR açısından "pseudonymization"dur, tam anonimleştirme değil — GDPR 4(5) tanımına göre hala kişisel veri kategorisindedir. Bu nedenle hash'li tablolar da encryption at rest + access control gerektirir. Roibase projelerinde BigQuery dataset'leri customer-managed encryption key (CMEK) ile şifreliyoruz, erişim IAM policy + VPC Service Controls ile kısıtlanıyor.

**Retention policy:** Identity graph'ı KVKK 7. madde uyarınca işlenme amacı sona erdiğinde silmelisiniz. E-ticarette tipik retention 2 yıl — son satın almadan 24 ay sonra profile inaktif flag'i konuyor, 30 gün içinde kullanıcı dönmezse profile silinir (right to erasure).

## Şimdi Ne Yapmalı

Identity resolution sıfırdan kurmak 8-12 haftalık bir data engineering projesi. Eğer CDP'niz yoksa önce [first-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) kurulmalı — server-side event collection, BigQuery data warehouse, dbt transformation pipeline. Bu altyapı üzerine identity stitching motoru eklenir. Mevcut stack'iniz varsa probabilistic matching modülünü pilot olarak 1-2 segment üzerinde test edin (örneğin yüksek-değer müşteriler), accuracy ve false positive oranını ölçün, confidence threshold'u kalibre edin. Production'a açmadan önce consent flow'u ve retention policy'yi hukuk ekibiyle onayla. Identity resolution pazarlama datasının diğer katmanlarına (attribution, segmentation, LTV modeling) temel oluşturur — burası sağlam değilse üstteki tüm metrikler yanlış zemine kurulur.