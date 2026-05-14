---
title: "Reverse ETL: Data Warehouse'tan Operational Tool'lara Veri Akışı"
description: "Hightouch, Census, Segment Reverse ETL araçlarıyla BigQuery/Snowflake'teki datayı CRM, ad platform ve CDP'ye taşımanın mimarisi, use case'leri ve trade-off'ları."
publishedAt: 2026-05-14
modifiedAt: 2026-05-14
category: data
i18nKey: data-004-2026-05
tags: [reverse-etl, data-warehouse, operational-analytics, customer-data, activation]
readingTime: 8
author: Roibase
---

Modern pazarlama organizasyonları datayı BigQuery veya Snowflake gibi warehouse'larda topluyor ama bu veri CRM'de, Meta Ads'de veya müşteri destek platformunda kullanılamıyorsa sadece analiz için duruyor. Reverse ETL bu sorunu çözüyor: warehouse'taki transformation'dan geçmiş datayı downstream operational tool'lara geri taşıyor. 2026'da Hightouch, Census ve Segment Reverse ETL üç ana oyuncu. Bu yazıda her birinin mimari farkını, kullanım senaryolarını ve production'da karşılaştığımız trade-off'ları inceliyoruz.

## Reverse ETL Nedir ve Neden Gereklidir

Klasik ETL (Extract-Transform-Load) datayı kaynaklardan warehouse'a taşır. Reverse ETL tersi yönde çalışır: warehouse'taki temiz, enriched datayı Salesforce, HubSpot, Google Ads, Braze gibi operasyonel sistemlere gönderir. Bu akış olmadan marketing takımı SQL query'si yazıp manuel CSV export yapıyor veya engineering her yeni entegrasyon için custom script yazıyor.

Reverse ETL'in değer kattığı üç ana alan var. İlki **audience activation**: warehouse'ta tanımladığın segmenti Meta Custom Audience'a veya Google Customer Match'e otomatik senkronize ediyorsun. İkincisi **lead enrichment**: BigQuery'deki product engagement dataları CRM'e düşüyor, sales temsilcisi hangi feature'ı kullandığını görüyor. Üçüncüsü **personalization sync**: CDP veya e-posta platformuna real-time'a yakın lifecycle stage, RFM score veya LTV prediction gönderiyorsun.

Pipeline olmadan bu operasyonları manuel yapmak 2-3 gün sürüyor ve her güncelleme için tekrar ediliyor. Reverse ETL bunu scheduled (saatlik, günlük) veya event-driven yapıya çeviriyor. Production'da gördüğümüz en tipik kullanım BigQuery → Salesforce lead score sync ve Snowflake → Meta Ads CLTV-based lookalike.

## Hightouch: SQL-Based Sync ve Visual Mapper

Hightouch 2020'de çıktı ve SQL-first yaklaşımı benimsedi. Warehouse'ınızda bir query yazıyorsunuz (veya dbt model'ına referans veriyorsunuz), Hightouch bu query sonucunu destination'a mapping yapıyor. UI'da visual field mapper var: `user_id` → Salesforce `Contact.Email`, `clv_score` → custom field gibi.

Platform 150+ destination destekliyor (Salesforce, HubSpot, Meta, Google, Braze, Iterable, Zendesk…). Sync mode'lar upsert, insert, update, mirror (warehouse'taki değişiklik destination'da da silinir). Schedule saatlik veya cron expression ile ayarlanabiliyor. Realtime sync için event stream entegrasyonu var ama bu preview stage'de.

**Mimari detay:** Hightouch kendi compute layer'ı yok, doğrudan warehouse'ınızın query engine'ini kullanıyor. Bu maliyet verimliliği sağlıyor çünkü BigQuery slot veya Snowflake compute credit'inizi kullanıyorsunuz, ayrı bir processing instance'ı yok. Ama warehouse'ınız busy ise sync query'si kuyrukta bekleyebilir.

Hightouch'ın güçlü tarafı **dbt Cloud entegrasyonu**. dbt model'larınızı doğrudan source olarak seçebiliyorsunuz, model lineage takip ediliyor. Örnek: `marts/marketing/user_ltv.sql` dbt model'ınız her gün 08:00'de run alıyor, Hightouch bu modeli 09:00'da çekip Braze'e gönderiyor. Model değişirse lineage bozulmadan devam ediyor.

**Use case:** E-ticaret brand'i BigQuery'de günlük RFM segmentasyonu yapıyor (dbt ile). Her sabah Hightouch bu segmenti Klaviyo'ya sync ediyor, Klaviyo'daki kampanyalar otomatik tetikleniyor. Manual CSV export kaldırıldı, operasyon hatasız.

## Census: Identity Resolution ve Segment Hub

Census 2018'de kuruldu, Hightouch'tan biraz daha erken piyasaya girdi. Temel fark **Segment Hub** özelliği: Census kendi içinde minimal bir identity graph tutuyor ve farklı tool'lardaki ID'leri match ediyor. Örneğin warehouse'ta `email`, Meta'da `hashed_email`, Salesforce'ta `Contact.Id` — Census bunları ortak bir entity'ye bağlıyor.

Census de SQL-based ama **Audience Hub** diye bir UI katmanı var. Marketing takımı SQL yazmadan UI'da filter yapabiliyor ("son 30 gün içinde 3+ sipariş vermiş, LTV > $500"). Bu audience'ı seçip destination'a gönderebiliyor. SQL bilmeyen kullanıcılar için pratik ama karmaşık logic için yine warehouse'ta dbt model tercih ediliyor.

Census 100+ destination destekliyor, sync mode'lar benzer (upsert, mirror, append). Realtime streaming desteği var (Kafka connector) ama çoğu kurulum batch sync ile çalışıyor. **Operational Analytics** özelliği: Census warehouse'taki tabloya lookup yapan bir REST API sağlıyor. Yani CRM'den gelen `user_id` ile warehouse'taki LTV'yi API call ile çekebiliyorsun (bu Hightouch'ta yok).

**Mimari trade-off:** Census kendi compute instance'larını kullanıyor (warehouse'tan data çekip kendi pipeline'ında transform ediyor). Bu warehouse load'unu azaltıyor ama Census'ın infrastructure maliyetini fiyatlamaya yansıtıyor. Fiyatlama genellikle sync row count bazlı.

**Use case:** SaaS şirketi Snowflake'te product usage event'larını session'lara aggregate ediyor. Census bu session datasını Intercom'a sync ediyor, support ekibi user'ın hangi feature'ı ne zaman kullandığını görüyor. Aynı datayı Salesforce'a da gönderiyor, sales ekibi product qualified lead (PQL) tanımlıyor.

## Segment Reverse ETL: CDP Entegrasyonu ve Event Stream

Segment 2011'den beri tag management ve CDP tarafında liderdi, 2021'de Reverse ETL özelliğini ekledi. Segment'in farkı **unified profile**: Segment zaten customer data platform olarak çalışıyordu, Reverse ETL ile warehouse'taki profile attributes'ları Segment profile'ına merge edip tüm downstream destination'lara (200+) gönderebiliyorsun.

Segment Reverse ETL iki modda çalışıyor: **Model Sync** (warehouse'tan scheduled query çek) ve **Profiles Sync** (Segment Profile'ına warehouse'taki attribute'ları merge et, sonra downstream'e yolla). İkinci mod daha güçlü çünkü Segment'in identity resolution engine'i devreye giriyor. Örneğin warehouse'ta `user_id`, Segment'te `anonymous_id` + `user_id` merge oluyor, bu enriched profile tüm tool'lara gidiyor.

**Event-driven sync:** Segment zaten event stream olduğu için Reverse ETL'den gönderilen attribute'lar event property olarak da eklenebiliyor. Yani warehouse'tan gelen `ltv_tier` attribute'u Braze'e user property olarak gittiği gibi, sonraki `Order Completed` event'ının içine de eklenebiliyor. Bu downstream attribution için kritik.

**Mimari:** Segment kendi infra'sını kullanıyor, warehouse'tan veri Segment cloud'una çekiliyor. Fiyatlama MTU (Monthly Tracked Users) bazlı ama Reverse ETL için ayrı SKU var (contact for pricing). Eğer zaten Segment kullanıyorsan ek maliyet makul, yoksa sadece Reverse ETL için Segment almak pahalı.

**Use case:** Mobil oyun şirketi BigQuery'de daily session count, ARPU, churn probability hesaplıyor. Bu datayı Segment Profiles'a sync ediyor, Segment bu profile'ları Braze, Leanplum, AppsFlyer'a gönderiyor. Aynı datayı Amplitude'ye de yolluyor, cohort analizi yapılıyor. Tek pipeline, dört destination.

### Karşılaştırma Tablosu

| Özellik | Hightouch | Census | Segment Reverse ETL |
|---|---|---|---|
| Compute Layer | Warehouse'ın engine'i | Census infra'sı | Segment infra'sı |
| Destination Sayısı | 150+ | 100+ | 200+ (Segment ecosystem) |
| dbt Entegrasyonu | Native, lineage tracking | Var ama daha basit | Model sync var |
| Identity Resolution | Yok (downstream'de çözülür) | Census Hub (minimal graph) | Segment Profiles (güçlü) |
| Realtime Streaming | Preview | Kafka connector var | Event stream native |
| Fiyatlama | Row count + plan tier | Row count | MTU + Reverse ETL SKU |

## Hangisi Ne Zaman Kullanılmalı

**Hightouch tercih edilmeli** şu durumlarda: dbt altyapınız sağlam, data transformasyon warehouse'ta oluyor, downstream tool'lara sadece sync yapacaksınız, maliyeti düşük tutmak istiyorsunuz (çünkü warehouse compute kullanıyor). Örnek: E-ticaret, BigQuery + dbt, günlük segment sync Meta/Google Ads.

**Census tercih edilmeli** eğer: marketing takımı SQL bilmiyor ve UI'dan audience oluşturacak, identity resolution warehouse'ta değil de Census'ta olsun istiyorsunuz, operational analytics API kullanacaksanız (CRM'den warehouse'a lookup). Örnek: B2B SaaS, sales-marketing alignment, CRM-centric operasyon.

**Segment Reverse ETL tercih edilmeli** eğer: Zaten Segment kullanıyorsanız ve CDP profile'ları merkezde tutuyorsanız, event stream + profile sync birlikte gerekiyorsa, 200+ destination'a tek noktadan gönderim yapacaksanız. Örnek: Mobil uygulama, Segment zaten mevcut, warehouse dataları Segment Profiles'a merge edilecek.

Hiçbiri mükemmel değil. Hightouch'ın realtime streaming'i henüz beta, Census biraz pahalı, Segment sadece Reverse ETL için abonelik mantıklı değil. Çoğu kurulumda hibrit yaklaşım görüyoruz: Hightouch batch sync + custom Pub/Sub pipeline realtime kritik event'lar için.

## Production'da Karşılaşılan Sorunlar

**Schema drift:** Warehouse'taki tablo schema'sı değişince (yeni column eklendi veya type değişti) Reverse ETL sync hata veriyor. Census ve Hightouch schema detection yapıyor ama manual mapping güncelleme gerekiyor. Çözüm: dbt model'larında schema test yazın, breaking change CI/CD'de yakalansın.

**Rate limiting:** Destination API'leri rate limit koyuyor (Salesforce 15k request/day, Meta Ads 200 request/hour). Büyük segment sync'i bu limitleri aşabiliyor. Census ve Hightouch otomatik retry ve batching yapıyor ama yine de sync delay oluyor. Çözüm: sync frequency'yi düşürün (saatlik yerine günlük), incremental sync kullanın (tüm tablo yerine changed rows).

**Identity mismatch:** Warehouse'taki `user_id` ile destination'daki identifier aynı değilse upsert başarısız oluyor. Örneğin Meta Ads hash'lenmiş email istiyor, warehouse'ta plain email var. Hightouch field transformation yapabiliyor (SHA256 hash) ama bu warehouse query'sinde yapılmalı. Çözüm: dbt model'ında destination-specific transform columnları hazırlayın.

**Cost:** BigQuery slot kullanımı %40 arttı diye görüyoruz bazı kurulumda çünkü Hightouch her saat query çalıştırıyor. Snowflake'te compute credit tüketimine dikkat. Census'ın kendi infra'sı bu sorunu çözdü ama fiyatlamaya yansıyor. Çözüm: sync frequency optimize edin, incremental query yazın (full table scan yerine `WHERE updated_at > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)`).

## Roibase Yaklaşımı: First-Party Data Pipeline ile Entegrasyon

Roibase'de Reverse ETL'i [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) kurulumunda varsayılan olarak öneriyoruz. BigQuery'de event stream → dbt transformation → enriched user table → Hightouch/Census sync Meta Ads pipeline'ı 3 hafta içinde production'a alıyoruz. Identity resolution kısmını BigQuery'de `user_stitching` dbt package ile yapıyoruz (Census Hub'a ihtiyaç kalmıyor).

Tipik setup: Google Analytics 4, server-side GTM, Shopify event'ları BigQuery'de birleşiyor. dbt ile customer lifecycle, RFM, LTV hesaplanıyor. Hightouch bu tabloyu günlük Meta'ya sync ediyor (value-based lookalike için), HubSpot'a lead score gönderiyor. Aynı datayı [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) kapsamında Looker dashboard'larına da bağlıyoruz.

Retention-critical kullanım senaryolarında (mobil app, subscription) Census + [CDP & Retention Engineering](https://www.roibase.com.tr/tr/retention-engineering-cdp) kombinasyonu tercih ediyoruz çünkü identity graph ve operational API Braze/Iterable entegrasyonlarını kolaylaştırıyor.

## Gelecek: Realtime ve Semantic Layer Entegrasyonu

2026 sonu 2027 başı için Hightouch ve Census realtime streaming kapasitelerini genişletiyor. Kafka/Pub/Sub connector'lar stable'a geçerse event-driven sync warehouse batch'inden daha pratik olacak. Örneğin kullanıcı checkout yapınca 5 dakika içinde CRM'de lead score güncellenebilir (şu an 1 saat batch delay var).

İkinci trend **semantic layer entegrasyonu**. dbt Semantic Layer veya Cube.js gibi araçlar metric definition'ları merkezileştiriyor. Reverse ETL bu semantic layer'dan okursa downstream'e tutarlı metric gönderilir. Örneğin "Active User" tanımı hem Reverse ETL'de hem dashboard'da aynı olur. Hightouch dbt Semantic Layer entegrasyonunu beta'da test ediyor.

Üçüncü gelişme **AI-powered field mapping**. Şu an warehouse column'unu destination field'ına manuel map ediyorsun. GPT-4 tabanlı öneri motorları "bu `customer_lifetime_value` column'u muhtemelen Salesforce'taki `CLV__c` custom field'ına gitmeli" diye önerebilir. Census bu tür özellikler üzerinde çalışıyor.

Reverse ETL artık "nice to have" değil, modern data stack'in zorunlu katmanı. Warehouse'taki datayı operasyonel sisteme taşımak manuel değil, otomatik ve güvenilir olmalı. Hightouch SQL-first ve maliyet avantajı, Census identity resolution ve UI kolaylığı, Segment mevcut CDP ekosistemi entegrasyonu sunuyor. Hangisini seçeceğiniz mevcut altyapınıza ve organizasyonunuzun data maturity seviyesine bağlı. Production'a alırken schema drift, rate limit ve identity mismatch'e hazır olun. İyi kurulmuş bir Reverse ETL pipeline pazarlama takımının velocity'sini 3-5 kat artırıyor çünkü engineering bottleneck kalkıyor.