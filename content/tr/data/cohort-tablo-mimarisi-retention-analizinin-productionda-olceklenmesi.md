---
title: "Cohort Tablo Mimarisi: Retention Analizinin Production'da Ölçeklenmesi"
description: "Materialized views, partitioning ve query cost optimization ile milyonlarca kullanıcı üzerinde cohort analizi yapmak: production-ready BigQuery mimarisi."
publishedAt: 2026-05-22
modifiedAt: 2026-05-22
category: data
i18nKey: data-007-2026-05
tags: [cohort-analysis, bigquery, materialized-views, retention-engineering, query-optimization]
readingTime: 8
author: Roibase
---

Retention analizi, kullanıcı davranışını anlamanın en güçlü yöntemlerinden biri. Ancak gerçek ölçekte — günde milyonlarca event, yüzbinlerce kullanıcı — naif SQL sorguları 30 saniyede timeout'a düşer veya slot kapasitesini tüketir. Production'da sürdürülebilir cohort analizi, tablo mimarisini sorgu motoruna göre optimize etmeyi gerektirir. Bu yazıda BigQuery üzerinde materialized view, partitioning ve incremental refresh stratejileriyle cohort tablolarını nasıl ölçeklendireceğinizi gösteriyoruz.

## Naif Cohort Sorgusu Neden Çöker

Klasik cohort analizi şu mantıkla çalışır: kullanıcının ilk aktivite tarihini (cohort_date) bul, sonraki tüm aktiviteleri bu tarihe göre "N. gün" olarak hesapla, retention oranını grup bazında topla. Aşağıdaki SQL, mantık olarak doğru ama production'da çalışmaz:

```sql
WITH first_event AS (
  SELECT user_id, MIN(DATE(event_timestamp)) AS cohort_date
  FROM `project.dataset.events`
  GROUP BY user_id
),
daily_activity AS (
  SELECT e.user_id, DATE(e.event_timestamp) AS activity_date
  FROM `project.dataset.events` e
  GROUP BY 1,2
)
SELECT 
  f.cohort_date,
  DATE_DIFF(d.activity_date, f.cohort_date, DAY) AS day_n,
  COUNT(DISTINCT d.user_id) AS retained_users
FROM first_event f
JOIN daily_activity d USING(user_id)
GROUP BY 1,2
ORDER BY 1,2;
```

Bu sorguda iki büyük sorun var: (1) `events` tablosu her seferinde tam taranır — partition pruning yok, (2) her cohort_date için tüm kullanıcıların tüm aktiviteleri join edilir — kartezyen patlama riski. 100M event'te bu sorgu 400GB veri işler ve 2 dakikada biter, ancak günlük refresh'te bu sürdürülebilir değil. BigQuery faturası ay sonunda 10x'e çıkar.

## Partitioned Base Table ile Filtreleme Yükünü Düşürmek

İlk adım: `events` tablosunu `DATE(event_timestamp)` üzerinden partition etmek. Bu, sorguya `WHERE DATE(event_timestamp) BETWEEN X AND Y` koşulu eklendiğinde sadece ilgili partition'ların taranmasını sağlar:

```sql
CREATE TABLE `project.dataset.events`
PARTITION BY DATE(event_timestamp)
CLUSTER BY user_id, event_name
AS SELECT * FROM ...;
```

Clustering (user_id, event_name) eklenmesi, aynı kullanıcının event'lerinin fiziksel olarak yakın bloklarda saklanmasını sağlar — join performansı %30-50 artar. Ancak bu tek başına yeterli değil; cohort hesaplama mantığı her sorguda tekrar çalışır. Burası materialized view'ın devreye girdiği nokta.

## Materialized View: Incremental Cohort Tablosu

BigQuery'nin materialized view'ları, sorgu sonucunu fiziksel olarak saklar ve base table'da değişiklik oldukça otomatik refresh yapar. Cohort analizinde şu yapıyı kullanıyoruz:

```sql
CREATE MATERIALIZED VIEW `project.dataset.user_cohorts`
PARTITION BY cohort_date
CLUSTER BY user_id
AS
SELECT 
  user_id,
  MIN(DATE(event_timestamp)) AS cohort_date,
  COUNT(*) AS first_day_events
FROM `project.dataset.events`
GROUP BY user_id;
```

Bu view, her kullanıcının ilk görüldüğü tarihi (cohort_date) bir kez hesaplar ve saklar. Yeni event geldiğinde BigQuery sadece delta'yı işler — tam tarama olmaz. Partition by cohort_date, retention sorgularında `WHERE cohort_date = '2026-05-01'` gibi filtrelerde pruning yapılmasını sağlar.

Şimdi retention hesaplama sorgusu şuna indirgenir:

```sql
SELECT 
  c.cohort_date,
  DATE_DIFF(DATE(e.event_timestamp), c.cohort_date, DAY) AS day_n,
  COUNT(DISTINCT e.user_id) AS retained_users
FROM `project.dataset.user_cohorts` c
JOIN `project.dataset.events` e 
  ON c.user_id = e.user_id 
  AND DATE(e.event_timestamp) >= c.cohort_date
WHERE c.cohort_date BETWEEN '2026-05-01' AND '2026-05-15'
GROUP BY 1,2;
```

Bu sorgu, base table yerine materialized view'a join yapar — taranacak satır sayısı milyonlardan binlere iner. Ancak yine de günlük event tablosunu tarar. Bir sonraki aşamada pre-aggregate retention tablosu oluşturuyoruz.

## Pre-Aggregated Retention Table: Son Katman

Cohort analizi genelde "Day 0, Day 1, Day 7, Day 30" gibi sabit aralıklarda bakılır — her gün için ayrı hesaplama yapmaya gerek yok. dbt ile şu mantığı uyguluyoruz:

1. Her gün, yeni cohort'ları `user_cohorts` view'ından çek
2. Her cohort için geçmiş 30 günlük retention'ı hesapla (ilk 30 gün dolduktan sonra değişmez)
3. Sonucu `cohort_retention_summary` tablosuna **incremental** yaz

dbt modeli:

```sql
{{
  config(
    materialized='incremental',
    unique_key=['cohort_date','day_n'],
    partition_by={'field':'cohort_date','data_type':'date'},
    cluster_by=['day_n']
  )
}}

WITH cohorts_to_update AS (
  SELECT DISTINCT cohort_date 
  FROM {{ ref('user_cohorts') }}
  WHERE cohort_date >= CURRENT_DATE() - 31
  {% if is_incremental() %}
    AND cohort_date > (SELECT MAX(cohort_date) FROM {{ this }})
  {% endif %}
),
retention_calc AS (
  SELECT 
    c.cohort_date,
    DATE_DIFF(DATE(e.event_timestamp), c.cohort_date, DAY) AS day_n,
    COUNT(DISTINCT e.user_id) AS retained_users,
    MAX(c.first_day_events) AS cohort_size
  FROM {{ ref('user_cohorts') }} c
  JOIN {{ source('raw','events') }} e 
    ON c.user_id = e.user_id
  WHERE c.cohort_date IN (SELECT cohort_date FROM cohorts_to_update)
    AND DATE(e.event_timestamp) >= c.cohort_date
    AND DATE_DIFF(DATE(e.event_timestamp), c.cohort_date, DAY) <= 30
  GROUP BY 1,2
)
SELECT 
  cohort_date,
  day_n,
  retained_users,
  cohort_size,
  SAFE_DIVIDE(retained_users, cohort_size) AS retention_rate
FROM retention_calc;
```

Bu model her gün sadece son 31 günlük cohort'ları günceller. 31 günden eski cohort'larda retention sabittir — tekrar hesaplanmaz. Slot kullanımı %95 düşer. [CDP & Retention Engineering](https://www.roibase.com.tr/tr/retention-engineering-cdp) sürecinde bu tablo, dashboard'a doğrudan bağlanır — BI aracı (Looker, Metabase) üzerinde sorgu 100ms'de döner.

## Query Cost ve Partition Expiration Stratejisi

BigQuery'de storage ucuz ($0.02/GB/month), compute pahalı ($5/TB işlenen veri). Retention analizi retrospektif olduğu için eski partition'lar sık taranır. İki optimizasyon:

1. **Partition expiration:** `events` tablosunda 90 günden eski partition'ları otomatik sil — cohort hesaplaması tamamlandıktan sonra raw event'e ihtiyaç yok.
2. **Clustering istatistiklerini periyodik olarak güncelle:** `ANALYZE TABLE ... UPDATE STATISTICS` — query optimizer daha iyi execution plan seçer.

Örnek maliyet karşılaştırması (100M event/gün, 1M kullanıcı):

| Yöntem | İşlenen veri/gün | Aylık compute maliyeti |
|---|---|---|
| Naif sorgu (full scan) | 12TB | $600 |
| Partitioned + materialized view | 800GB | $40 |
| Pre-aggregated tablo (incremental) | 50GB | $2.5 |

Pre-aggregate katmanı eklemek, compute maliyetini 240x düşürür. Bu fark production'da kritik — özellikle retention analizi her saat refresh ediliyorsa.

## Gerçek Zamanlı Cohort Analizi Tradeoff'u

Materialized view ve pre-aggregate yapı, latency tradeoff'u getirir: veri 1-5 dakika gecikir. Eğer gerçek zamanlı cohort analizi gerekiyorsa (örn. ilk 24 saat için), hibrit yaklaşım uygulayabilirsiniz:

- Son 24 saatlik veriler için streaming insert + real-time query (cache devre dışı)
- 24 saatten eski veriler için pre-aggregate tablo

Bu durumda BI query'si iki kaynağı UNION ALL ile birleştirir:

```sql
SELECT * FROM cohort_retention_summary WHERE cohort_date < CURRENT_DATE()
UNION ALL
SELECT * FROM realtime_cohort_view WHERE cohort_date = CURRENT_DATE();
```

Real-time view maliyetli olsa da, sadece son cohort için çalıştığından toplam compute etkisi sınırlı kalır.

## Cohort Segmentasyonu ve Kardinalite Patlaması

Retention analizini kullanıcı segmentlerine göre kırmak (platform, ülke, acquisition channel) kardinalite sorununu tetikleyebilir. Örneğin 5 segment × 30 gün × 365 cohort = 54.750 benzersiz satır. Bu durumda:

1. **Segment sayısını sınırlayın:** En önemli 3-5 segment üzerinden analiz yapın, diğerleri için ayrı tablo oluşturun.
2. **Dynamic segmentation:** Pre-aggregate tablosuna segment bilgisi eklemek yerine, join-time filtering kullanın — bu query esnekliğini korur ama slot kullanımını artırır.
3. **Rollup tablosu:** Haftalık cohort'lar için ayrı tablo oluşturun (weekly_cohort_retention) — kardinalite %85 düşer.

Roibase'in [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) sürecinde, segment stratejisini acquisition source attribution ile birleştiriyoruz — cohort analizi, kanal performansıyla doğrudan bağlantılanıyor.

## Monitoring ve Regression Detection

Production'daki cohort pipeline'ı izlemek için şu metrikleri takip edin:

- **Query slot time:** Günlük refresh'in BigQuery slot kullanımı — ani artış, kardinalite patlaması veya partition pruning kaybı gösterir.
- **Row count delta:** Her refresh'te eklenen satır sayısı — beklenenden fazla ise duplicate event riski var.
- **Retention rate stddev:** Day 1 retention'da ani %10+ değişim, data quality sorunu sinyali.

dbt içinde bu check'leri test olarak ekleyebilirsiniz:

```yaml
tests:
  - dbt_utils.expression_is_true:
      expression: "retention_rate BETWEEN 0 AND 1"
  - dbt_utils.recency:
      datepart: day
      field: cohort_date
      interval: 1
```

Test fail olursa Slack/PagerDuty alert'i tetiklenir — manuel kontrol beklenmez.

Cohort tablo mimarisi, retention analizini "ad-hoc sorgu" seviyesinden "production data product" seviyesine taşır. Materialized view ile incremental refresh, partitioning ile query pruning, pre-aggregate ile slot optimizasyonu — her katman maliyeti 10x düşürür. Milyonlarca kullanıcı ve milyarlarca event üzerinde retention analizi yapmak artık 100ms'lik dashboard query'sine indirgenir. Hangi retention pattern'ini izlemeniz gerektiğine karar vermek hâlâ sizin işiniz — ama veriyi bu hızda işlemek artık mühendislik sorunu değil.