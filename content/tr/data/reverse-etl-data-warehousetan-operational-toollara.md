---
title: "Reverse ETL: Data Warehouse'tan Operational Tool'lara"
description: "Hightouch, Census, Segment Reverse ETL — production use case'leri, mimari tradeoff'lar ve CDP entegrasyonu karşılaştırması."
publishedAt: 2026-06-19
modifiedAt: 2026-06-19
category: data
i18nKey: data-004-2026-06
tags: [reverse-etl, data-activation, cdp, warehouse-native, data-pipeline]
readingTime: 8
author: Roibase
---

Data warehouse'unuzda müşteri segmentleri, churn skorları, LTV tahminleri var — ama bunlar Salesforce'ta, Braze'de veya Meta Ads'te yok. Klasik ETL data'yı warehouse'a taşır, Reverse ETL ters yöne çalışır: warehouse'taki transformation output'unu operational tool'lara sync eder. 2026'da bu pattern data activation stack'inin omurgası. Hightouch, Census, Segment Reverse ETL üç farklı mimari felsefe sunar — hangisi production'da hangi senaryoya uyar, bu yazı o farkları net eder.

## Reverse ETL'in Doğuş Nedeni: Modern Data Stack'te Activation Eksikliği

2018-2020 arası "modern data stack" dalgası şunu kurdu: event pipeline (Segment/RudderStack), warehouse (BigQuery/Snowflake), transformation layer (dbt). Pazarlama ve analiz ekipleri customer_lifetime_value, propensity_to_convert, segment_high_intent gibi tablolar üretiyor — SQL ile, Python ile, ML pipeline'ıyla. Sorun: bu tablolar warehouse'ta duruyor, kampanya execution'ı için Klaviyo'ya, Iterable'a, Google Ads'e manuel CSV export gerekiyor.

Reverse ETL bu boşluğu doldurdu. Warehouse'tan downstream tool'a programatik sync yapar: her gün 04:00'te `high_intent_users` tablosundan Braze'e segment gönder, her saat LTV > $500 olan kullanıcıları Meta Custom Audience'a push et. Bu sayede transformation logic warehouse'ta kalır (dbt ile version-controlled, testable), activation operational tool'da gerçekleşir (pazarlamacı kendi arayüzünde segment görebilir).

2023 Gartner raporuna göre Fortune 500'ün %42'si bir Reverse ETL aracı kullanıyor. Neden? Çünkü CDP'ler transformation layer sunamıyor — warehouse'ta zaten yapılmış segmentasyonu CDP'ye taşımak double work. Reverse ETL, "warehouse = single source of truth" prensibini bozmuyor, aksine güçlendiriyor.

## Hightouch: Warehouse-Native, No-Code Öncelikli

Hightouch 2020'de "data activation platform" olarak başladı. Çekirdek felsefesi: warehouse'taki her tablo bir sync source'u olabilir, kullanıcı SQL yazmadan UI'dan mapping yapar. Örnek akış: BigQuery'de `SELECT user_id, email, ltv_score FROM analytics.user_segments WHERE ltv_score > 0.7` diye bir view oluşturursun, Hightouch UI'ında bu view'ı Salesforce Lead object'ine map edersin, ltv_score → Lead.Custom_Field__c. Sync frequency: hourly, daily, real-time (change data capture ile).

**Güçlü yönleri:**
- **No-code mapping:** Pazarlama operasyonları ekibi SQL bilmeden sync kurabilir. dbt modeli analiz yapar, Hightouch onu Iterable'a taşır.
- **Geniş destination kütüphanesi:** 200+ integration — Salesforce, HubSpot, Braze, Klaviyo, Google Ads, Meta, TikTok, Attentive, Zendesk. Her biri için pre-built field mapping template'leri var.
- **Audience builder:** SQL yazmadan UI'da segment oluştur — "ltv > 500 AND last_purchase_date < 30 days ago", Hightouch bunu SQL'e çevirir.
- **Identity resolution:** Warehouse'taki user_id, email, phone gibi kolonları downstream tool'un ID sistemiyle match eder. Örneğin BigQuery'deki `anonymous_id` Braze'deki `external_id` ile eşleşir.

**Tradeoff'lar:**
- **SQL escape hatch sınırlı:** Karmaşık join'ler veya window function'lar için pre-computed view gerekir. Hightouch runtime'da SQL transformation yapmaz, sadece okur.
- **Fiyatlandırma:** Row-based pricing — aylık sync edilen toplam satır sayısı. 100K row ücretsiz, sonrası tier'lara göre artar. Production'da milyonlarca row sync'te maliyet hızla büyür.
- **Real-time sınırı:** Change data capture (CDC) Snowflake/BigQuery için beta — her tool için stable değil. Gerçek zamanlı sync HubSpot/Salesforce gibi CRM'lerde çalışır, ad platform'larda hourly batch'e düşer.

**Production use case:** E-ticaret firması dbt ile `high_propensity_churners` tablosu üretiyor (son 14 günde sepet terk eden + LTV > $300). Bu tablo her gün 06:00'da Hightouch ile Klaviyo'ya sync ediliyor, pazarlama ekibi otomatik retention kampanyası tetikliyor. SQL analiz ekibinde, execution pazarlamada — net sorumluluk ayrımı.

## Census: Developer-First, Transformation İçinde

Census Hightouch'la aynı döneme çıktı ama mimari felsefeyi ters kurdu: warehouse'taki data model'i transformation layer ile birleştir. Census'ın "Segmentation Studio" özelliği SQL + no-code hibrit — analiz ekibi dbt'de base model yazar, pazarlama ekibi Census UI'ında filter ekler, Census runtime'da SQL compose eder. Örnek: dbt'de `SELECT * FROM fct_customers` view'ı, Census'ta `WHERE lifetime_orders > 5 AND last_order_date > CURRENT_DATE - 30` filtresi, Census bunu tek sorguda birleştirir.

**Güçlü yönleri:**
- **Dynamic segmentation:** Downstream sync anında segment kriterleri değişebilir — warehouse'a geri dönüp yeni view yazmaya gerek yok. Pazarlamacı "son 7 gün yerine son 14 gün" diyebilir, Census SQL'i yeniden derler.
- **Observability:** Sync job'ların detaylı log'ları — hangi row sync oldu, hangisi reject edildi, neden. Slack/email alert: "Salesforce sync 12 row reject etti, email format hatası".
- **API-first:** Census API ile programmatic sync kurabilirsin — Airflow DAG'ından Census job tetikle, dbt run tamamlandıktan 10 dakika sonra sync başlat.
- **Reverse ETL + Operational Analytics:** Sadece sync değil, warehouse'taki data'yı embeddable dashboard olarak sunabilirsin — iç tooling için kullanışlı.

**Tradeoff'lar:**
- **Kurulum karmaşıklığı:** Dynamic SQL composition güçlü ama debug zor. Segment UI'da 5 filter var, Census runtime'da 200 satır SQL üretiyor — hata aldığında neyin yanlış gittiğini anlamak zaman alır.
- **Destination sayısı:** Hightouch'tan az (150 civarı) — TikTok Ads, Pinterest Ads gibi long-tail platformlar yok. Ama core CRM/marketing automation hepsi var.
- **Fiyatlandırma:** Row + compute hybrid — hem sync edilen row, hem Census'ın warehouse'ta çalıştırdığı query maliyeti. Snowflake cluster'ında Census'ın sorguları diğer workload'larla karışır, resource contention olabilir.

**Production use case:** SaaS firması churn prediction model BigQuery'de çalıştırıyor (Python + BigQuery ML), output `churn_risk_score` tablosu. Census bu tabloya daily sync yapıyor ama pazarlama ekibi "sadece score > 0.8 olanlar" diye filter ekliyor — Census runtime'da `WHERE churn_risk_score > 0.8` ekliyor. Pazarlama risk threshold'unu UI'dan değiştiriyor, dbt model'e dokunmuyor.

## Segment Reverse ETL: CDP ile Entegre Activation

Segment'in 2022'de eklediği Reverse ETL, Twilio'nun (Segment'i 2020'de satın aldı) CDP stratejisine oturur. Klasik Segment event collection + warehouse destination yanına "Profiles" (identity resolution) + "Reverse ETL" eklendi. Mantık: event data warehouse'a gider, dbt ile transform olur, Reverse ETL ile Segment'e geri döner, Segment downstream tool'lara dağıtır. Yani Segment hem upstream (event toplayıcı), hem downstream (activation hub).

**Güçlü yönleri:**
- **Single vendor:** Event pipeline, identity resolution, destination management tek yerde. Engineering ekibi tek contract, tek billing, tek support.
- **Privacy + compliance:** Segment Privacy Portal Reverse ETL'e entegre — GDPR deletion request warehouse'taki data'yı siler, Reverse ETL downstream sync'i de siler.
- **Identity stitching:** Segment Profiles warehouse'taki `user_id`, `anonymous_id`, `email` kolonlarını otomatik match eder — cross-device, cross-platform kimlik birleştirme built-in.
- **Event + trait sync:** Sadece bulk segment değil, user-level trait update — "user_123'ün LTV'si $450 oldu" event'i Braze'e trait olarak gider.

**Tradeoff'lar:**
- **Vendor lock-in:** Segment dışında data activation yapamıyorsun — Hightouch/Census gibi tool'lar warehouse'tan herhangi bir tool'a direkt gider, Segment zorunlu hop.
- **Transformation capability:** Segment Reverse ETL SQL view okur ama transformation yapmaz — Census gibi dynamic segmentation yok. dbt model warehouse'ta hazır olmalı.
- **Maliyet:** Segment MTU (monthly tracked users) pricing + Reverse ETL row pricing ayrı — double billing. Büyük ölçekte Hightouch/Census'tan pahalı olabilir.
- **Destination sınırı:** Segment'in normal destination'ları (300+) Reverse ETL'de desteklenmez — sadece 50 civarı. Örneğin Google Ads Customer Match Reverse ETL ile sync edilemez, normal Segment event flow kullanmalısın.

**Production use case:** Fintech firması Segment'le event toplayıp BigQuery'e yazıyor. dbt ile `high_value_customers` (son 90 günde 10+ işlem + toplam hacim > $5K) tablosu üretiyor. Segment Reverse ETL bu tabloyu Segment Profiles'a çekiyor, oradan Braze + Salesforce'a sync ediyor. Aynı pipeline GDPR deletion request'i de işliyor — warehouse'tan silince downstream'e otomatik yayılıyor.

## Hangi Tool Hangi Senaryo İçin

**Hightouch seç eğer:**
- Pazarlama ekibi SQL bilmiyor, no-code UI'dan mapping yapacak
- 200+ destination'a sync gerekiyor (long-tail ad platform'lar dahil)
- dbt model'ler hazır, sadece activation mekanizması lazım
- Real-time sync kritik değil, hourly/daily batch yeterli

**Census seç eğer:**
- Developer ekibi güçlü, API-first orchestration yapacak
- Dynamic segmentation gerekiyor — pazarlama filter'ları sık değişiyor
- Observability + debugging öncelikli — sync reject'leri detaylı loglayacaksın
- Warehouse compute maliyeti kontrol altında (Census query overhead'ini karşılayabiliyorsun)

**Segment Reverse ETL seç eğer:**
- Segment'i zaten event pipeline olarak kullanıyorsun
- Single vendor, unified identity management istiyorsun
- Privacy compliance (GDPR/CCPA) otomasyonu kritik
- Destination sayısı sınırlı ama CRM/email marketing yeterli

## Mimari Entegrasyon: CDP ile Birlikte mi, Yerine mi

Reverse ETL "CDP killer" değil — farklı katmanda durur. CDP (Segment, mParticle, Treasure Data) event collection + identity resolution + real-time orchestration yapar. Reverse ETL batch sync yapar, transformation warehouse'ta olur. İdeal stack: Segment event'leri toplar → BigQuery'e yazar → dbt transform eder → Reverse ETL downstream'e sync eder. Bu pattern [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty)'nin omurgası — raw event warehouse'ta, transformation dbt'de, activation Reverse ETL + CDP kombinasyonuyla.

Alternatif: CDP'siz, pure Reverse ETL. Örnek: server-side event tracking (Snowplow) → BigQuery → dbt → Hightouch → Braze. Bu senaryoda identity resolution dbt'de yapılıyor (SQL join'lerle), CDP overhead'i yok. Tradeoff: real-time personalization kayıp — CDP event anında karar verir (web'de iken popup göster), Reverse ETL batch sync yapar (ertesi gün email gönder).

Production'da genelde hybrid: real-time use case'ler (cart abandonment 5 dakika içinde) CDP ile, batch ML skorları (churn prediction weekly) Reverse ETL ile. İki sistem aynı warehouse'tan okur, farklı downstream kanal'lara yazar.

---

Reverse ETL data activation'ın yeni standardı — warehouse'taki transformation logic'i operational tool'lara taşıyan köprü. Hightouch no-code mapping + geniş destination sunar, Census developer-first dynamic segmentation sağlar, Segment CDP entegrasyonu + compliance otomasyonu getirir. Hangisi? Ekibinin SQL yetkinliğine, destination ihtiyacına ve mevcut stack'e bağlı. Kritik nokta: warehouse = single source of truth prensibi — transformation dbt'de, activation downstream'de, iki katman birbirini bozmuyor.