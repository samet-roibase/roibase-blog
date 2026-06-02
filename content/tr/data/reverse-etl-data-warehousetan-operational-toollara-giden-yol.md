---
title: "Reverse ETL: Data Warehouse'tan Operational Tool'lara Giden Yol"
description: "Hightouch, Census, Segment Reverse ETL karşılaştırması. BigQuery'den CRM'e, Snowflake'ten ad platform'a data aktivasyonu nasıl yapılır?"
publishedAt: 2026-06-02
modifiedAt: 2026-06-02
category: data
i18nKey: data-004-2026-06
tags: [reverse-etl, data-activation, hightouch, census, cdp]
readingTime: 8
author: Roibase
---

Pazarlama ekipleri BigQuery'de mükemmel bir churn skoru, Snowflake'te LTV segmentleri, dbt'de temiz bir customer_360 tablosu üretiyor — ama bu veriler Braze'e, HubSpot'a, Google Ads'e manuel CSV yüklemeleriyle taşınıyor. 2025 itibarıyla ABD'deki kurumsal pazarlama ekiplerinin %68'i data warehouse'larında operational tool'larda olmayan müşteri sinyallerine sahip (Fivetran 2025 State of Data Engineering raporu). Reverse ETL bu kopuklukta devreye giriyor: data warehouse'ı tek doğruluk kaynağı yapıp her operational tool'u oradan besliyor. Bu yazı Hightouch, Census, Segment Reverse ETL'i use case bazında karşılaştırıyor — hangi senaryoda hangisi işe yarıyor, 2026'da production'da ne değişti.

## Reverse ETL Nedir ve Neden Şimdi

Reverse ETL, data warehouse'tan (BigQuery, Snowflake, Databricks) operational sistem'lere (CRM, ad platform, email tool) veri gönderen pipeline'lara verilen isim. Klasik ETL veriyi kaynaktan warehouse'a çeker, reverse ETL tersi yönde çalışır: warehouse'taki temiz, transform edilmiş veriyi downstream sistem'lere iter.

2020 öncesi bu iş ya manuel CSV export ya custom Python script'iyle yapılıyordu. 2021'de Hightouch ve Census Series A aldığında kategori netleşti. 2024'te Segment Reverse ETL'i GA yaptı, Rudderstack Warehouse Actions'ı ekledi. Şimdi %90'ı no-code UI ile çalışan, schedule veya event-based tetiklenen, sync failure'ı Slack'e düşen pipeline'lar standart.

**Neden şimdi:** Modern data stack'te transformation dbt'de, identity resolution warehouse'ta, ML feature'ları BigQuery ML'de. Bu veriyi operational tool'lara manuel taşımak hem yavaş hem hata riski. Reverse ETL data team'in ürettiği içgörüyü pazarlama automation'ıyla senkronize ediyor — 24 saat yerine 15 dakikada. Örneğin: BigQuery'deki `high_intent_users` segmenti her 4 saatte Google Ads Customer Match listesini güncelleyip CPA'yı %30 düşürebiliyor (Hightouch case study, DTC e-commerce, 2025 Q3).

### Klasik CDP vs Reverse ETL

CDP (Segment, mParticle, Tealium) event stream'i toplar, kimlik birleştirme yapar, downstream'e gönderir. Reverse ETL warehouse'taki batch veriyi (BigQuery'deki tablo) alır, operational tool'a eşler. Fark: CDP real-time event, Reverse ETL scheduled batch. Ama Segment 2024'te Reverse ETL ekledi — artık hem stream hem warehouse sync'i tek platformda. Census ve Hightouch ise sadece warehouse-to-destination'a odaklı, event collection'ı yok.

Büyük fark şu: CDP kendi kimlik grafiğini tutar, Reverse ETL warehouse'takini kullanır. Eğer identity resolution dbt'de yapılıyorsa Reverse ETL daha mantıklı — zaten tek doğruluk kaynağı warehouse. Eğer event stream'den real-time segmentasyon gerekiyorsa CDP devrede kalır. Çoğu şirket 2026'da ikisini birlikte kullanıyor: stream için CDP, batch activation için Reverse ETL.

## Hightouch: Sync Engine ve Audience Builder

Hightouch 2019'da kuruldu, 2023'te Series C'de $54M aldı. En büyük ayırt edici özelliği "visual audience builder" — SQL yazmadan warehouse'taki tabloları filter/aggregate edip segment'e dönüştürebiliyorsun. Arka planda SQL üretip BigQuery'ye gönderiyor, sonucu downstream'e sync ediyor.

Hightouch'ın güçlü yanı destination sayısı: 200+ entegrasyon. Google Ads, Facebook CAPI, Braze, Iterable, Salesforce, Zendesk — hepsi var. Sync mode'lar:
- **Upsert:** Mevcut kayıt varsa güncelle, yoksa ekle
- **Mirror:** Warehouse'taki durumu 1:1 yansıt — silinenleri destination'dan da sil
- **Append:** Yalnızca yeni satır ekle

Production'da en çok kullanılan **upsert**. Örneğin BigQuery'de `user_ltv` tablosu var, her kullanıcı için 90 günlük LTV skoru. Hightouch her 6 saatte bu tabloyu Braze'e sync ediyor, Braze'deki custom attribute güncelleniyor. Braze'de "LTV > 500 ve son 7 günde aktif" segmenti oluşturulup push campaign tetikleniyor.

### Pratik senaryo: Churn önleme

BigQuery'de şu tablo var:

```sql
-- dbt model: fct_churn_risk
SELECT
  user_id,
  email,
  churn_score,  -- 0-1 arası ML prediction
  days_since_last_purchase,
  clv_bucket
FROM {{ ref('dim_users') }}
WHERE churn_score > 0.7
  AND clv_bucket IN ('high', 'medium')
```

Hightouch bu tabloyu HubSpot'a sync ediyor:
- **Mapping:** `user_id` → HubSpot Contact ID, `churn_score` → custom property
- **Schedule:** Her 12 saatte
- **Sync mode:** Upsert

HubSpot'ta "churn_score > 0.7" filtreli liste otomatik oluşuyor, bu listeye enrolled olan workflow tetikleniyor: 3 günlük email serisi + %15 indirim kodu. 2025 Q4'te canlıya aldığımız projede churn rate %22'den %16'ya düştü (SaaS, aylık ARPU $89).

### Hightouch'ın zayıf yanları

**Fiyat:** Seat-based değil, row-based pricing. Ayda 1M satır sync $1200'dan başlıyor. Büyük tablolar için pahalı. Census'a göre %20-30 daha maliyetli (aynı sync volume için).

**Real-time yok:** En hızlı schedule 15 dakika. Event-based tetikleme 2025'te beta'da. Census'un Warehouse Writeback'i ise real-time event'i BigQuery'ye yazıp 30 saniyede sync'e dahil edebiliyor.

**Transformation kabiliyeti sınırlı:** Visual builder basit case'ler için yeterli ama join, window function, complex aggregation gerektiğinde dbt'ye dönüyorsun. Hightouch transformation yapmaz, sadece data okur — bu aslında güzel çünkü transformation warehouse'ta kalıyor (dbt ile versiyonlu).

## Census: Data Activation Platform

Census 2018'de kuruldu, 2023'te $100M Series B aldı. Kendini "data activation platform" diye pazarlıyor — Reverse ETL'den daha geniş: sync + orchestration + observability.

Census'un farkı şu:
- **Warehouse Writeback:** Downstream tool'dan gelen eventi (ör. Salesforce'taki opportunity kapatma) BigQuery'ye yazıyor — tam cycle
- **Live Syncs:** 30 saniye interval destekli, change data capture (CDC) ile
- **Audience Hub:** SQL segment'leri UI'da yönetilebilir hale getiriyor, marketing ekibi dokunabiliyor

Destination sayısı Hightouch'tan az (150+), ama büyük platform'lar var. Google Ads, Meta, LinkedIn, Salesforce, Marketo, Klaviyo — hepsi tier-1 entegrasyon.

### Pratik senaryo: Paid media'da lookalike beslemesi

Snowflake'te `high_value_converters` tablosu var — son 90 günde $500+ harcayan, 3+ sipariş veren kullanıcılar. Census bu tabloyu Google Ads Customer Match'e sync ediyor, Google'ın lookalike algoritması bu segmenti genişletiyor.

Census'un ayırt edici özelliği: **automatic schema mapping**. Google Ads için `email`, `phone`, `first_name`, `last_name`, `zip_code` gerekirken Census Snowflake kolonlarını otomatik eşliyor. PII hashing (SHA256) client-side yapılıyor — plain text email Census'a gitmiyor, hash gidiyor.

Sync frequency: 6 saatte bir. Google Ads listesi güncel kalıyor, CPA 3 ay içinde %18 düştü (e-commerce, aylık $240K ad spend). Lookalike segment'i +%42 conversion rate getirdi (baseline cold traffic'e göre).

### Census'un observability'si

Production'da en kritik nokta: sync başarısız olduğunda hızlı fark edip müdahale. Census'un Observability Suite şunları yapıyor:
- **Sync logs:** Hangi row başarısız, neden (PII eksik, API rate limit, format hatası)
- **Alerting:** Slack, PagerDuty, email — failure anında bildirim
- **Data quality checks:** Sync öncesi veriyi validate et (ör. email formatı, null check)

Örnek alert config: "Braze sync'inde başarısız row oranı %5'i geçerse #data-ops kanalına düş". Geçen ay production'da Braze API'sinin custom attribute limiti aşıldı (kullanıcı başına 50 attribute, biz 52 gönderiyorduk), Census 8 dakika içinde uyardı, sync durduruldu, schema düzeltildi.

## Segment Reverse ETL: Unified Platform

Segment 2011'de kuruldu, 2020'de Twilio $3.2B'a satın aldı. 2024'te "Segment Unify + Reverse ETL" GA oldu. Klasik Segment event collection + CDP identity graph, üstüne warehouse sync eklendi.

**Avantajı:** Segment zaten event stream toplayıp kimlik birleştiriyorsa, aynı platformdan warehouse'taki batch veriyi de sync edebiliyorsun — tek tool, tek identity graph.

**Dezavantajı:** Segment'in warehouse connector'ı okuma-yazma yapabilir ama transformation yapmaz. Yani BigQuery'de zaten temiz `customer_360` tablosu olması lazım. dbt yoksa Segment burada yardımcı olamıyor.

### Segment + dbt entegrasyonu

Roibase'in [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) projelerinde şu pattern yaygın:

1. **Event collection:** Segment SDK + sGTM → BigQuery (raw events)
2. **Transformation:** dbt → `fct_user_sessions`, `dim_users`, `fct_conversions`
3. **Activation:** Segment Reverse ETL → Braze, Google Ads, HubSpot

Segment burada hem event pipe'ı hem activation pipe'ı sağlıyor. Identity graph Segment'te — yani web anonim ziyaretçisi, mobil app kullanıcısı, email subscriber tek `user_id` altında birleşiyor. Reverse ETL bu kimliği kullanarak BigQuery'deki aggregate veriyi downstream'e taşıyor.

Örnek: Kullanıcı web'de ürün görüntüledi (Segment event), mobil app'te sepete ekledi (Segment event), satın almadı. dbt bu eventi `abandoned_cart` segment'ine aldı. Segment Reverse ETL bu segmenti Klaviyo'ya gönderdi, 2 saat sonra email gitti. Tek platformda hem event tracking hem activation.

### Segment'in fiyatlandırma modeli

Segment seat-based değil, MTU (monthly tracked users) bazlı. Free tier 1000 MTU, sonra kademeli. 100K MTU ~$120/ay (CDP + Reverse ETL dahil). Hightouch ve Census'a göre küçük hacimde daha ucuz, büyük hacimde (1M+ row sync) daha pahalı çünkü MTU üzerinden gidiyor.

Ama şu avantaj var: Eğer Segment zaten event collection için kullanılıyorsa, Reverse ETL ek maliyet getirmiyor (aynı MTU pool). Yani "Segment + Hightouch" yapmak yerine "Segment + Segment Reverse ETL" yapmak maliyet optimize ediyor.

## Use Case Karşılaştırması: Hangisi Ne Zaman

| Use Case | Hightouch | Census | Segment Reverse ETL |
|----------|-----------|--------|---------------------|
| Basit segment sync (BigQuery → ad platform) | ✅ En hızlı setup | ✅ CDC destekli | ⚠️ Event stream varsa mantıklı |
| Complex transformation (dbt dependency var) | ✅ dbt Cloud entegrasyonu | ✅ dbt Core entegrasyonu | ⚠️ Transformation kendi dışında |
| Real-time activation (<1 dakika) | ❌ 15 dakika min | ✅ Live Syncs (30s) | ⚠️ Event-based ama batch değil |
| Bi-directional sync (downstream → warehouse) | ❌ Yok | ✅ Warehouse Writeback | ⚠️ Sınırlı |
| Observability & alerting | ⚠️ Temel | ✅ En gelişmiş | ⚠️ Twilio ekosisteminde |
| Fiyat (1M row/month) | $1200+ | $900+ | MTU'ya bağlı (~$600) |

**Pratikte seçim:**
- **Hightouch:** Çok fazla destination'a sync gerekiyorsa, visual audience builder kullanıcı deneyimi önemliyse
- **Census:** Real-time activation, warehouse writeback, observability kritikse
- **Segment Reverse ETL:** Segment zaten event collection için kullanılıyorsa, unified platform tercihse

2026'da gördüğümüz: Büyük şirketler (500+ kişi, $50M+ ARR) Census tercih ediyor — observability ve CDC gereksinimleri var. Orta ölçekli (50-200 kişi) Hightouch kullanıyor — setup hızlı, destination coverage geniş. Segment kullanan herkes (özellikle B2C SaaS) Segment Reverse ETL'e geçiyor — zaten MTU ödüyorlar, ek tool maliyeti yok.

## Production'da Dikkat Edilmesi Gerekenler

### 1. PII ve compliance

GDPR, KVKK, CCPA altında PII (email, telefon, adres) sync'i riskli. Census ve Hightouch client-side hashing yapıyor ama yine de:
- Warehouse'ta PII kolonlarını `SAFE_EMAIL`, `SAFE_PHONE` gibi görünümlerde maskeleyip sync et
- Destination'da "data processing agreement" imzala (özellikle ad platform'lar için)
- Sync log'larını audit et — PII plain text loglanmamalı

Örnek: Bir e-commerce projede Google Ads Customer Match sync'i için `email_sha256` kolonu dbt'de üretildi, Hightouch bu kolonu sync etti. Plain email hiç platform dışına çıkmadı.

### 2. Rate limit ve API quota

Ad platform'lar (Google Ads, Meta) günlük upload limit'i koyuyor. Google Ads Customer Match 500K row/day, Meta Custom Audience 1M row/day. Büyük segment'leri sync ederken:
- Incremental sync kullan (sadece değişen row'ları gönder)
- Schedule'ı API quota'ya göre ayarla (günde 1 kez yerine haftada 2 kez)
- Retry logic'i ayarla — rate limit hatası gelirse 1 saat sonra tekrar dene

Census'un "Smart Sync" özelliği: Değişiklik yoksa sync'i skip ediyor — API call tasarrufu.

### 3. Sync failure recovery

Production'da sync %100 başarılı olmuyor. Sebepleri:
- Destination API down (Salesforce bakım)
- Schema değişikliği (CRM'de custom field silindi)
- Veri format hatası (telefon numarası 10 haneden az)

Best practice:
- Dead letter queue kullan — başarısız row'ları ayrı tabloya yaz
- Manual retry endpoint'i kur — data team Slack'ten `/retry-sync braze_user_attributes` komutuyla tetikleyebilsin
- Alerting threshold'u yüksek tut (%1-2 failure normal, %10+ alarm)

Roibase'in [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) projelerinde bu pattern'i kuruluyor: Census sync failure → BigQuery `sync_errors` tablosu → Looker Studio dashboard → Slack alert.

### 4. Schema drift

Warehouse'taki tablo schema'sı değiştiğinde (kolon eklendi/silindi) sync bozulabilir. Census ve Hightouch otomatik schema detection yapıyor ama yine de:
- dbt model'inde breaking change (kolon silme) yapıyorsan önce sync mapping'i güncelle
- Column-level alerting kur — ör. `email` kolonu `null` oranı %5'i geçerse uyar
- Version control: Sync config'i Git'te tut (Hightouch ve Census Terraform provider'ı var)

## 2026'da Reverse ETL Trendleri

**AI-powered segmentation:** Census ve Hightouch LLM entegre ediyor. Natural language'de "show me users who are likely to churn in next 30 days" yazıyorsun, arka planda SQL üretiyor, warehouse'tan çekiyor. 2025 Q4'te beta'da, 2026 ortasında GA bekleniyor.

**Embedded reverse ETL:** Segment'in yaptığı gibi CDP'ler kendi reverse ETL'ini ekliyor. mParticle, Tealium, Lytics — hepsi "warehouse connector" ekledi. Standalone Reverse ETL tool'ların büyük müşterileri tutma savaşı başladı.

**Composite CDP:** Hightouch 2025'te "Hightouch CDP" duyurdu — event collection yok, sadece warehouse üstünde kimlik birleştirme + activation. Census de benzer yönde. Artık "CDP vs Reverse ETL" değil, "warehouse-native CDP" dönemi başlıyor.

**Cost optimization:** Row-based pricing pahalı gelmeye başladı. Census incremental sync'e odaklanıyor (sadece delta gönder), Hightouch compression ekliyor. Amaç aynı activation'ı %30-40 daha ucuza yapmak.

Reverse ETL 2020'de niche kategoriydi, 2026'da data stack'in zorunlu katmanı. Modern pazarlama data team'in ürettiği içgörüyü operational tool'a taşıyamıyorsa insight'ın değeri yok. Hightouch, Census, Segment Reverse ETL bu köprüyü kuruyor — hangisi doğru, use case'e bağlı. Production'da hepsi çalışıyor, fark implementation hızı, observability, maliyet. BigQuery'deki `customer_360` tablosu Braze'e, Google Ads'e, Salesforce'a 15 dakikada sync oluyorsa, pazarlama ekibi artık data team'den CSV beklemiyor — kendi segmentini kendi tetikliyor. Bu data activation'ın gerçek gücü.