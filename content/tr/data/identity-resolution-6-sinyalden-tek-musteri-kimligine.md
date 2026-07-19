---
title: "Identity Resolution: 6 Sinyalden Tek Müşteri Kimliğine"
description: "Hash matching, probabilistic linking ve household identity ile dağınık touchpoint'leri tek müşteri kimliğine nasıl birleştirirsiniz? Server-side pipeline ve pratik şema."
publishedAt: 2026-07-19
modifiedAt: 2026-07-19
category: data
i18nKey: data-003-2026-07
tags: [identity-resolution, hash-matching, probabilistic-linking, cdp, first-party-data]
readingTime: 8
author: Roibase
---

Bir kullanıcı cep telefonundan kampanyaya tıklıyor, masaüstünde ürünü sepete ekliyor, mağazadan satın alıyor. Bu üç sinyal üç farklı kimlik: `device_id`, `cookie_hash`, `email_hash`. Identity resolution bu parçaları tek müşteri profili haline getiren data pipeline'ı. Cookie sonrası dönemde — Consent Mode v2, iOS ATT, CCPA — server-side first-party veriye dayanan kimlik çözümleme mimarisi artık öneri değil zorunluluk.

## Neden 6 farklı sinyal var

Modern pazarlama stack'i kimlik sinyallerini altı katmanda toplar: **browser cookie**, **cihaz ID** (IDFA/GAID), **authenticated hash** (email SHA-256), **customer ID** (CRM/CDP internal), **IP+user-agent fingerprint**, **household graph**. Her biri farklı lifecycle'da devreye girer.

Browser cookie ilk touchpoint'te; cihaz ID mobil uygulamada; authenticated hash email veya telefon numarası toplanınca; customer ID checkout sonrası; fingerprint consent olmadan probabilistic eşleme için; household graph aynı routerdan bağlanan cihazları gruplamak için kullanılır. Sorun: bu altı sinyal farklı tablolarda, farklı TTL'lerde (cookie 90 gün, IDFA sonsuz, email hash müşteri silene kadar) tutuluyor. Eğer resolution yapılmazsa her kanal ayrı kullanıcı sayıyor — marketing mix model'de çift sayım, incrementality test'lerinde overestimation, retention cohort'larında düşük retention illüzyonu.

Resolution logic'i iki yöntemle kurulur: **deterministik (hash matching)** ve **probabilistic (graph linking)**. Deterministik: email SHA-256 hash'i browser event'i ile backend transaction'ı eşleştiriyor — %100 kesinlik. Probabilistic: aynı IP+user-agent 24 saat içinde iki farklı event'te görülürse aynı kullanıcı olasılığı %73 (örnek threshold). Hiç resolution yapmazsanız unique user sayısı %40-80 şişiyor (kategori ve cihaz mix'ine göre).

## Hash matching: email ve telefonu identity key'e çevirmek

Hash matching server-side identity resolution'ın omurgası. Kullanıcı email veya telefon verdiği anda client-side ya da sGTM SHA-256 hash üretir, bu hash `identity_map` tablosuna yazılır. Sonraki tüm anonim event'lerde cookie veya device ID lookup yaparak hash'e ulaşırsınız.

Basit `identity_map` şeması:

```sql
CREATE TABLE identity_map (
  canonical_id STRING NOT NULL,      -- UUID, internal ID
  signal_type STRING NOT NULL,       -- 'email_sha256', 'phone_sha256', 'device_id', 'cookie'
  signal_value STRING NOT NULL,      -- hash veya ID
  first_seen TIMESTAMP,
  last_seen TIMESTAMP,
  PRIMARY KEY (signal_type, signal_value)
);
```

Bir kullanıcı kayıt formunda `user@example.com` girdiğinde sGTM bu email'i SHA-256 ile hash'leyip `INSERT` yapıyor: `('uuid-123', 'email_sha256', 'abc123...', NOW(), NOW())`. Aynı oturumda cookie `_ga=GA1.1.xyz` varsa ikinci satır: `('uuid-123', 'cookie', 'GA1.1.xyz', NOW(), NOW())`. Böylece `canonical_id = uuid-123` altında iki sinyal birleşti.

Sonraki session'da kullanıcı email girmeden sadece `_ga=GA1.1.xyz` ile geliyor. BigQuery'de lookup:

```sql
SELECT canonical_id
FROM identity_map
WHERE signal_type = 'cookie' AND signal_value = 'GA1.1.xyz'
LIMIT 1;
```

Dönüş: `uuid-123`. Event'i bu ID'ye bağlıyorsunuz — email hash kullanılmadan da aynı kullanıcı tanınıyor. Hash matching'in kesinliği %100 çünkü hash collision kriptografik olarak imkansız. Ancak kapsama sorunu var: kullanıcı email vermemişse hash yok, o zaman probabilistic'e geçiyorsunuz.

### Collision riski ve salt

SHA-256 collision riski teorik: 2^128 denemede 1. Ama production'da asıl sorun **aynı email farklı canonical_id'lere bağlanmış olabilir** (manuel hata, eski migration artığı). Bu yüzden `UNIQUE INDEX (signal_type, signal_value)` koyuyorsunuz. Salt kullanımı (email + gizli string sonra hash) collision riskini artırmıyor ama [first-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) tasarımında privacy layer ekliyor — salt rotate edince eski hash'ler geçersiz kalıyor, GDPR "right to be forgotten" için kullanışlı.

## Probabilistic linking: IP, user-agent ve device graph

Kullanıcı anonim modda geziniyorsa deterministik sinyal yok. Bu durumda **probabilistic graph** kullanıyorsunuz: IP + user-agent + timestamp proximity ile "muhtemelen aynı kişi" skor üretiyorsunuz. Örnek: aynı IP'den aynı user-agent ile 15 dakika ara ile iki event — %85 olasılıkla aynı kullanıcı.

Basit probabilistic merge logic:

```sql
WITH anon_events AS (
  SELECT
    event_id,
    ip_address,
    user_agent,
    event_timestamp,
    FARM_FINGERPRINT(CONCAT(ip_address, user_agent)) AS fingerprint
  FROM events
  WHERE canonical_id IS NULL
),
clusters AS (
  SELECT
    fingerprint,
    MIN(event_timestamp) AS first_event,
    MAX(event_timestamp) AS last_event,
    COUNT(*) AS event_count
  FROM anon_events
  GROUP BY fingerprint
  HAVING TIMESTAMP_DIFF(MAX(event_timestamp), MIN(event_timestamp), HOUR) < 24
)
SELECT
  a.event_id,
  c.fingerprint AS probable_cluster_id
FROM anon_events a
JOIN clusters c ON a.fingerprint = c.fingerprint;
```

Bu sorgu IP+UA hash'ine göre 24 saat içinde event'leri grupluyor. Cluster ID'yi geçici `canonical_id` gibi kullanabilirsiniz ama confidence score ekleyin: `event_count > 3 AND time_span < 1 HOUR → confidence=0.9`.

**Household graph:** Aynı IP'den farklı user-agent'lar (laptop, tablet, telefon) geliyorsa muhtemelen aynı ev. Burada `household_id` oluşturup individual `canonical_id` altına koyuyorsunuz. Örneğin Amazon Prime household: 1 abonelik, 6 profil — identity resolution household seviyesinde aggregate ediyor.

### False positive oranı

Probabilistic linking'de false positive riski var. Aynı IP + user-agent iki farklı kullanıcıdan gelebilir (ofis WiFi, kütüphane). Threshold çok gevşekse (%50 confidence) %15-25 false positive görürsünüz. Industry best practice: %75+ confidence threshold, 1 saat time window, en az 2 event match. LiveRamp gibi vendor'lar graph database kullanıyor (Neo4j) ve 30+ sinyal kombine ederek %95+ accuracy iddia ediyor — ama kendi first-party pipeline'ınızda 2-3 sinyal ile %80 accuracy yeterli.

## Server-side pipeline: sGTM + BigQuery + dbt

Identity resolution production ortamında şu data flow'da çalışır:

1. **sGTM event ingestion:** Client-side GTM event'i sGTM'e gönderiyor, sGTM email varsa SHA-256 hash ekliyor, BigQuery'e raw event yazıyor (`events_raw`).
2. **dbt staging model:** `stg_events` tablosu `events_raw`'dan temizlenmiş event'leri üretiyor, `signal_type` ve `signal_value` kolonları parse ediliyor.
3. **dbt identity_map merge:** Yeni hash görüldüğünde `identity_map`'e `MERGE` yapılıyor (upsert logic).
4. **dbt canonical_id enrichment:** Her event `identity_map` ile join ediliyor, `canonical_id` lookup yapılıyor.
5. **dbt aggregation:** User-level metrikler (`user_ltv`, `session_count`) `canonical_id` bazında aggregate ediliyor.

Örnek dbt model snippet (`models/staging/stg_events.sql`):

```sql
{{ config(materialized='incremental') }}

WITH events_with_signals AS (
  SELECT
    event_id,
    event_timestamp,
    COALESCE(user_properties.email_sha256, NULL) AS email_hash,
    COALESCE(user_properties.ga_client_id, NULL) AS cookie_id,
    event_params
  FROM {{ source('bigquery', 'events_raw') }}
  {% if is_incremental() %}
  WHERE event_timestamp > (SELECT MAX(event_timestamp) FROM {{ this }})
  {% endif %}
)
SELECT * FROM events_with_signals;
```

Incremental model her saat çalışıyor, son batch'i işliyor. Identity merge logic ayrı bir model (`models/core/fct_identity_resolved.sql`):

```sql
SELECT
  e.event_id,
  COALESCE(im_email.canonical_id, im_cookie.canonical_id) AS canonical_id,
  e.event_timestamp
FROM {{ ref('stg_events') }} e
LEFT JOIN {{ ref('identity_map') }} im_email
  ON e.email_hash IS NOT NULL
  AND im_email.signal_type = 'email_sha256'
  AND im_email.signal_value = e.email_hash
LEFT JOIN {{ ref('identity_map') }} im_cookie
  ON e.cookie_id IS NOT NULL
  AND im_cookie.signal_type = 'cookie'
  AND im_cookie.signal_value = e.cookie_id;
```

Bu join logic deterministik hash matching'i yapıyor. Probabilistic için ayrı bir `fct_probabilistic_clusters` model eklersiniz.

## Consent ve privacy: GDPR, CCPA uyumu

Identity resolution GDPR Article 6 (lawful basis) ve CCPA "do not sell" kurallarına tabi. Email hash'i **personal data** olarak kabul ediliyor (CJEU 2019 kararı), dolayısıyla consent veya legitimate interest gerekiyor.

Consent Mode v2 altında kullanıcı analytics_storage=denied verirse email hash toplanamazsınız. Bu durumda sadece IP+UA fingerprint kullanabilirsiniz (legitimate interest kapsamında — ama CJEU yorumu tartışmalı). Best practice: `consent_status` kolonu `identity_map`'e ekleyip hash'i sadece `analytics_storage=granted` event'lerden yazın.

CCPA "right to delete" için `canonical_id` bazında tüm satırları silme logic gerekiyor:

```sql
DELETE FROM identity_map WHERE canonical_id = 'uuid-123';
DELETE FROM events WHERE canonical_id = 'uuid-123';
```

Cascade silme için foreign key constraint kullanın (BigQuery desteklemiyor ama Postgres/Snowflake'te mümkün). Alternatif: soft delete (`deleted_at TIMESTAMP`) ve sonra batch purge.

### TCF 2.2 vendor mapping

IAB TCF 2.2 altında identity resolution "Purpose 1 — Store and/or access information on a device" kapsamında. Eğer kullanıcı vendor list'inizi onaylamadıysa cross-device linking yapamazsınız. Roibase projelerinde TCF string'i BigQuery'de parse edip `vendor_consent` kolonuna yazıyoruz, sonra identity merge'de consent filter uyguluyoruz:

```sql
WHERE vendor_consent LIKE '%vendor_id=123%'
```

Bu logic consent olmadan identity graph kurmanızı engelliyor — compliance + data quality dengesi.

## CDP entegrasyonu: Segment, mParticle, Rudderstack

Modern CDP'ler kendi identity graph'lerini sunuyor ama genellikle kara kutu. Kendi pipeline'ınızı kurarak graph logic'i kontrol ediyorsunuz — özellikle [CDP & Retention Engineering](https://www.roibase.com.tr/tr/retention-engineering-cdp) projesinde kritik. Segment'in `identify()` çağrısı `userId` ve `anonymousId`'yi merge ediyor ama hangi sinyal öncelikli? Kendi resolution logic'inizde öncelik sırası açık:

1. `customer_id` (CRM) → en güvenilir
2. `email_sha256` → deterministik
3. `device_id` → cross-session ama cross-device değil
4. `cookie` → en kısa TTL
5. `fingerprint` → probabilistic fallback

Bu priority sırasını dbt'de `COALESCE()` chain'i ile kodluyorsunuz. CDP'ye sadece nihai `canonical_id` ve `confidence_score` gönderiyorsunuz, merge logic sizde kalıyor.

Identity resolution modern pazarlama data stack'inin temel katmanı. Hash matching deterministik kesinlik, probabilistic linking coverage sağlıyor, household graph aile bazlı segmentasyon açıyor. Server-side pipeline consent + privacy kurallarına uygun şekilde bu altı sinyali birleştirdiğinizde unique user accuracy %40 artıyor, retention cohort yanılgısı düşüyor, incrementality test'leri güvenilir hale geliyor. BigQuery + dbt + sGTM ile kendi resolution logic'inizi kurduğunuzda vendor kara kutusuna bağımlı kalmadan graph'i istediğiniz şekilde yönetiyorsunuz.