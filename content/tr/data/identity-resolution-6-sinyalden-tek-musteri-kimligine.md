---
title: "Identity Resolution: 6 Sinyalden Tek Müşteri Kimliğine"
description: "Hash matching, probabilistic linking ve household identity ile dağınık sinyalleri tek müşteri profiline dönüştürmenin teknik mimarisi."
publishedAt: 2026-05-31
modifiedAt: 2026-05-31
category: data
i18nKey: data-003-2026-05
tags: [identity-resolution, cdp, first-party-data, probabilistic-matching, hash-matching]
readingTime: 8
author: Roibase
---

Bir kullanıcı e-posta ile kayıt oluyor, mobil uygulamadan sipariş veriyor, başka bir gün masaüstü tarayıcıdan destek talebi açıyor. Cookie ID, device ID, hashed email, IP, session ID, kullanıcı kimliği — altı farklı sinyal. Identity resolution olmadan altı farklı "müşteri" gibi görünür. Reklam atfı yanlış hesaplanır, LTV modeli çarpık kalır, retention sinyali kaybedilir. Google Analytics 4'ün User ID merge'ü yalnızca authenticated session'ları birleştirir, anonim davranışı bağlamaz. CDP'ler probabilistic stitching diye satıyor ama tablo yapılarını göstermiyor. Identity graph'ı production'a taşımak için hash matching, probabilistic linking ve household identity'yi birlikte çalıştırmak gerek.

## Hash Matching: Deterministik Birleştirmenin Omurgası

Hash matching, aynı email veya telefon numarasının SHA-256 hash'lerini eşleştirerek iki sinyal arasında "kesin" bağlantı kurar. Kullanıcı web sitesine kayıt olurken `user@example.com` gönderiyorsa, bu değeri SHA-256 ile hash'le ve BigQuery'de `identity_signals` tablosuna `hashed_email` sütunu olarak yaz. Mobil uygulamadan aynı email ile giriş yapıldığında, orada da hash'lenen email aynı değer olacağından iki kaydı birleştir.

```sql
-- BigQuery'de deterministik match örneği
CREATE OR REPLACE TABLE `project.dataset.merged_identities` AS
SELECT
  web.anonymous_id AS web_cookie_id,
  mobile.device_id AS mobile_device_id,
  web.hashed_email,
  MIN(web.first_seen_timestamp) AS first_seen
FROM `project.dataset.web_events` web
INNER JOIN `project.dataset.mobile_events` mobile
  ON web.hashed_email = mobile.hashed_email
WHERE web.hashed_email IS NOT NULL
GROUP BY 1,2,3;
```

Bu sorgu web cookie ID'si ile mobil device ID'sini hashed email üzerinden birleştirir. `INNER JOIN` deterministik — yalnızca kesin eşleşmeler gelir. Eşleşen sinyalleri aynı `canonical_user_id` altında toplamak için `ROW_NUMBER()` veya UUID generation kullan. Hash matching'in sınırı: kullanıcı email değiştirirse (eski hesap + yeni hesap) iki ayrı identity olarak kalır. Burada probabilistic layer devreye girer.

Hash matching, GDPR ve KVKK uyumlu çünkü plaintext email depolamıyorsun — hash tek yönlü, tersine çevrilemez. Ancak rainbow table saldırısına açık olduğu için email hash'lerine ek olarak device fingerprint veya IP range gibi ikincil sinyal eklemek gerek. Tek hash sütunu yeterli değilse `hashed_email`, `hashed_phone`, `hashed_customer_id` ayrı kolonlar halinde tutulmalı. Tablo partitioning `DATE(timestamp)` üzerinden yap — identity çözümü genelde incremental, tüm geçmişi tarayan full scan maliyetli.

## Probabilistic Linking: Belirsizliği Skor ile Yönetmek

Kullanıcı kayıt olmadan geziniyorsa hashed email yok — cookie ID, IP, user agent, session timestamp var. Probabilistic matching bu sinyalleri ağırlıklandırarak "aynı kişi olma olasılığı" skoru üretir. Skor eşiği (örn. 0.85) üzerindeyse iki kaydı bağla, altındaysa ayrı tut. LiveRamp, Merkle, Neustar gibi vendor'lar bu skorları satıyor ama kendi data warehouse'unda kural bazlı model kurabilirsin.

Örnek mantık: Aynı IP + aynı tarayıcı fingerprint (canvas hash) + 5 dakika içinde session → %90 eşleşme skoru. Aynı IP + farklı tarayıcı + 2 saat fark → %40 skor. Eşik 0.7 ise ilk çift birleşir, ikinci çift birleşmez. BigQuery'de bunu `CASE WHEN` bloklarıyla modelleyebilirsin:

```sql
SELECT
  a.session_id AS session_a,
  b.session_id AS session_b,
  CASE
    WHEN a.ip_address = b.ip_address
      AND a.canvas_hash = b.canvas_hash
      AND TIMESTAMP_DIFF(b.timestamp, a.timestamp, MINUTE) <= 5
    THEN 0.90
    WHEN a.ip_address = b.ip_address
      AND TIMESTAMP_DIFF(b.timestamp, a.timestamp, HOUR) <= 2
    THEN 0.40
    ELSE 0.0
  END AS match_score
FROM `project.dataset.anonymous_sessions` a
CROSS JOIN `project.dataset.anonymous_sessions` b
WHERE a.session_id < b.session_id
  AND a.ip_address = b.ip_address
QUALIFY match_score >= 0.70;
```

Bu sorgu `CROSS JOIN` yapıyor — milyonlarca satırda maliyet patlar. Production'da window function veya bucketing gerek: IP range'i prefix'e göre partition'la (örn. `/24` CIDR), `ROW_NUMBER()` ile en son 100 session'la karşılaştır. Probabilistic matching'in riski false positive — farklı iki kullanıcı aynı IP'den (ofis Wi-Fi, shared VPN) aynı saatte girerse yanlış birleşebilir. Bu yüzden skor eşiğini 0.85-0.90 arasında tut ve cross-device sinyallerle doğrula.

Machine learning tabanlı probabilistic model daha karmaşık: logistic regression veya gradient boosting ile "aynı kullanıcı" binary classification. Feature set: IP hamming distance, user agent Levenshtein benzerliği, timezone offset, session count. Training data etiketli — bilinen `user_id` çiftlerinden pozitif örnek, farklı `user_id` çiftlerinden negatif örnek. Model 0-1 arası skor verir, eşik yine manuel ayar. Bu yaklaşımı kurmak için dbt model yerine Vertex AI veya Sagemaker pipeline gerek — veri mühendisliği + ML engineering birlikte çalışır.

## Household Identity: Aynı Ev, Farklı Kullanıcılar

Identity resolution'da "household" katmanı: aynı IP veya fiziksel adresteki farklı kullanıcıları gruplayıp "aile birimi" olarak pazarlama hedefleme yapabilmek. Örneğin e-ticaret sitesinde anne çocuk kıyafeti bakıyor, baba elektronik ürün satın alıyor — iki farklı user ID ama aynı shipping address. Household graph bunu `household_id` altında birleştirir. Reklam platformlarında (Facebook Ads, Google Ads) household targeting diye satılır ama kendi first-party data'nda bu ilişkiyi modellemen gerek.

BigQuery'de shipping address'i normalize et: büyük/küçük harf, boşluk, apartman numarası farklılıklarını temizle. Sonra hash'le ve `household_key` olarak kullan:

```sql
CREATE OR REPLACE TABLE `project.dataset.household_mapping` AS
SELECT
  user_id,
  TO_HEX(SHA256(
    LOWER(REGEXP_REPLACE(CONCAT(street, city, postal_code), r'\s+', ''))
  )) AS household_key
FROM `project.dataset.user_addresses`
WHERE street IS NOT NULL AND postal_code IS NOT NULL;
```

Bu tablo `user_id` → `household_key` mapping'i veriyor. Aynı `household_key` altındaki kullanıcıları gruplayarak "household_id" ata. Household identity, cross-device identity'den farklı — aynı kişinin cihazları değil, aynı ev halkının kişileri. Privacy riski yüksek: iki farklı adult kullanıcıyı aynı household'da birleştirmek veri minimizasyonu ilkesini ihlal edebilir (KVKK m.5). Bu yüzden household graph'ı yalnızca aggregate analiz ve anonymous targeting'de kullan, bireysel profil birleştirmede kullanma.

Household graph'a ek sinyal: Wi-Fi SSID hash (mobil uygulamada izin verirse), Bluetooth beacon (fiziksel mağaza), shared payment method (aynı kredi kartı). Bu sinyaller PII olduğundan hash + encrypted storage gerek. CDP sistemleri (Segment, mParticle, RudderStack) household resolution'ı "relationship graph" olarak sunar ama BigQuery'de manuel model kurarak daha fazla kontrol sağlarsın — hangi sinyalin ne ağırlıkta kullanıldığını görürsün. Roibase'in [CDP & Retention Engineering](https://www.roibase.com.tr/tr/retention-engineering-cdp) çalışması bu katmanı production pipeline'a entegre eder.

## Graph Database vs Relational: Hangisi Daha Hızlı

Identity graph'ı BigQuery gibi relational warehouse'da tutmak mümkün ama "A → B → C" zincirleme bağlantıları (transitive closure) sorgulamak pahalı. Graph database (Neo4j, Amazon Neptune, TigerGraph) bu işi node/edge yapısında yapar — "kullanıcı X'in tüm cihazlarını bul" sorgusu `MATCH (u:User)-[:HAS_DEVICE]->(d:Device)` ile millisaniyelerde döner. BigQuery'de aynı sorgu `RECURSIVE CTE` veya `ARRAY_AGG` ile yazılır ama büyük tablolarda slot kullanımı artar.

Tradeoff: Graph DB çok hızlı ama schema değişikliği zor, node/edge model veri ekibinin alıştığı SQL syntax'ından farklı. Relational warehouse yavaş ama dbt ile version control, test, documentation kolay. Çoğu production ortamında hybrid yaklaşım: BigQuery'de daily batch ile identity mapping table'ı oluştur, Neo4j'ye sync et, real-time lookup Neo4j'den yap. Örnek pipeline: dbt model → BigQuery view → Cloud Function trigger → Neo4j Cypher INSERT.

```sql
-- BigQuery'de recursive CTE ile transitive closure (yavaş)
WITH RECURSIVE identity_chain AS (
  SELECT signal_a, signal_b, 1 AS depth
  FROM `project.dataset.identity_edges`
  UNION ALL
  SELECT ic.signal_a, e.signal_b, ic.depth + 1
  FROM identity_chain ic
  JOIN `project.dataset.identity_edges` e
    ON ic.signal_b = e.signal_a
  WHERE ic.depth < 5
)
SELECT DISTINCT signal_a, signal_b
FROM identity_chain;
```

Bu sorgu maksimum 5 adım (depth) zincirleme takip ediyor. Depth kontrolü olmazsa sonsuz döngü riski var — A → B → A döngüsel bağlantılarda. Graph DB bu döngü kontrolünü built-in yapar, BigQuery'de manuel WHERE condition gerekiyor. Eğer identity graph 10M+ edge'e ulaşırsa Neo4j gibi dedicated sistem daha maintainable. Küçük ölçekte (1M edge altı) BigQuery + dbt yeterli.

## Privacy ve Consent: Identity Graph'ın Yasal Sınırları

Identity resolution, GDPR'ın "profiling" tanımına giriyor (m.4/4). Kullanıcı consent vermeden deterministik + probabilistic linking yapman hukuki risk. Consent Mode v2 (Google) "analytics_storage" ve "ad_storage" izinlerini ayırıyor ama identity stitching için ek "personalization_storage" kategorisi gerekebilir. TCF 2.2'de Purpose 1 (device storage) + Purpose 9 (personalized ads) alman şart — ikisi olmadan hash matching bile yasadışı.

Hash'lenmiş email GDPR'da "pseudonymous data" sayılır (Recital 26) — kişisel veri olmaya devam eder. Rainbow table veya reverse lookup ile plaintext'e dönüştürülebilirse "anonymization" değil, "pseudonymization"dur. Bu yüzden hash'lere ek olarak salt eklemek (email + site-specific secret → SHA-256) ve salt'ı HSM (Hardware Security Module) veya Secret Manager'da saklamak gerek. Kullanıcı "unlink" talep ederse (GDPR m.18 restriction) identity graph'tan edge sil, deterministik bağlantıyı kır.

KVKK m.7'de açık rıza şartı: "Kişisel verilerin işlenmesine ilişkin açık rıza, belirli bir konuya ilişkin, bilgilendirilmeye dayanan ve özgür iradeyle açıklanan rızadır." Identity stitching "belirli konu" olarak consent formunda açıkça yazılmalı — "daha iyi deneyim" gibi generic ifade yetmez. Kullanıcı consent geri çekerse (`consent_revoked_at` timestamp) identity graph'tan o `user_id` için tüm edge'leri sil ve `deleted_at` flag'i set et. BigQuery'de soft delete yapabilirsin — fiziksel silme yerine `WHERE deleted_at IS NULL` filtresi.

## Uygulama: dbt ile Incremental Identity Pipeline

Production'da identity resolution batch değil, incremental çalışmalı — her gün yeni sinyalleri ekle, mevcut graph'ı update et. dbt incremental model ile bunu kurabilirsin:

```sql
{{
  config(
    materialized='incremental',
    unique_key='edge_id',
    partition_by={'field': 'created_date', 'data_type': 'date'},
    cluster_by=['signal_a_type', 'signal_b_type']
  )
}}

WITH new_edges AS (
  SELECT
    GENERATE_UUID() AS edge_id,
    a.signal_id AS signal_a,
    a.signal_type AS signal_a_type,
    b.signal_id AS signal_b,
    b.signal_type AS signal_b_type,
    0.95 AS match_score,
    CURRENT_DATE() AS created_date
  FROM {{ ref('stg_hashed_emails') }} a
  JOIN {{ ref('stg_device_ids') }} b
    ON a.hashed_email = b.hashed_email
  WHERE a.created_at >= CURRENT_DATE() - 1
)

SELECT * FROM new_edges

{% if is_incremental() %}
WHERE edge_id NOT IN (SELECT edge_id FROM {{ this }})
{% endif %}
```

Bu model her run'da son 1 günün yeni email-device eşleşmelerini ekliyor. `unique_key` duplicate önlüyor, `partition_by` eski partitionlara dokunmuyor. Cluster `signal_type` üzerinden çünkü sorgular genelde "tüm email→cookie bağlantıları" şeklinde tip filtreli. dbt test ile edge sayısını kontrol et: `WHERE match_score < 0.70` olan edge varsa test fail, deployment durur.

Identity pipeline'ı veri kalitesi test olmadan production'a alınmamalı — yanlış birleştirme LTV hesabını, attribution modelini, segmentasyonu bozar. Roibase'in [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) bu pipeline'ı consent layer, server-side GTM ve CDP ile entegre ediyor.

Şimdi sırada identity graph'ı downstream'e aktarmak var: segment builder, recommendation engine, LTV prediction, MMM gibi sistemler `canonical_user_id` üzerinden aggregate metric çekiyor. Graph doğru kurulursa 6 sinyali 1 kullanıcıya indirgeyerek LTV precision %30-40 artar, attribution window %25 genişler (Google Analytics 4 benchmark, 2025). Hash matching deterministik temel, probabilistic linking belirsizliği yönetir, household identity aile hedefleme açar — üçü birlikte çalıştığında first-party data'dan maksimum değer çıkartırsın.