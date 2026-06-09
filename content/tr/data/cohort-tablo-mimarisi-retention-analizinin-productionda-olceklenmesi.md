---
title: "Cohort Tablo Mimarisi: Retention Analizinin Production'da Ölçeklenmesi"
description: "Materialized views, partitioning ve query cost optimization ile günlük 100M+ event'i cohort tablolarında 5 saniyede sorgulayan mimari tasarım."
publishedAt: 2026-06-09
modifiedAt: 2026-06-09
category: data
i18nKey: data-007-2026-06
tags: [cohort-analysis, bigquery, materialized-views, query-optimization, retention-engineering]
readingTime: 8
author: Roibase
---

Retention metriklerini real-time dashboard'a taşımak istediğinizde ilk şok query maliyetinde gelir. Temel cohort sorgusu — "1 Ocak'ta kayıt olan kullanıcılardan 7. günde kaç tanesi aktif?" — naif JOIN yazıldığında 200GB veri tarar, 18 saniye sürer, 4 dolar ücret oluşturur. Günde 500 dashboard ziyareti yapan bir ekip için bu hesap ayda 60.000 dolara çıkar. Sorun analitik yeteneğinizde değil, tablo mimarisindedir. Cohort analizinin production'a taşınması için event verisi değil, cohort snapshot'ları saklanmalıdır.

## Naive Cohort Query: Neden Ölçeklenmiyor

Klasik cohort sorgusu üç tablo birleştirir: `users`, `events`, `cohort_definitions`. Her query'de `events` tablosu partition filtresi olmadan full scan edilir. 100M günlük event ile bu yaklaşım sürdürülemez.

```sql
-- ❌ Anti-pattern: Her seferinde tüm events'i tara
SELECT 
  DATE_TRUNC(u.created_at, DAY) AS cohort_date,
  DATE_DIFF(e.event_date, u.created_at, DAY) AS day_n,
  COUNT(DISTINCT u.user_id) AS retained_users
FROM users u
JOIN events e ON u.user_id = e.user_id
WHERE u.created_at >= '2026-01-01'
  AND e.event_name = 'session_start'
GROUP BY 1, 2
ORDER BY 1, 2;
```

Bu sorgu 6 aylık veri için 480GB tarar. BigQuery'de slot kullanımı dolayısıyla 12 saniye sürer, 2.40 dolar ücretlendirilir (on-demand pricing: 5$/TB). Aynı cohort'u 20 farklı metric ile çarparsanız (revenue, session count, conversion rate) maliyet 48 dolara çıkar. Dashboard günde 100 kere yenilenirse aylık maliyet 144.000 dolar olur. Sorunu ölçekli production'a uygun hale getirmek için iki strateji vardır: **incremental materialization** ve **pre-aggregated cohort snapshots**.

### Incremental Materialization: dbt ile Event-to-Cohort Pipeline

Cohort'ları her seferinde hesaplamak yerine günlük batch'lerle birikimli tablo güncelleyin. dbt'nin `incremental` stratejisi ile yeni günün event'lerini mevcut cohort tablosuna eklersiniz.

```sql
-- models/cohort_retention_daily.sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'cohort_date', 'data_type': 'date'},
    cluster_by=['day_n', 'metric_name'],
    unique_key='cohort_date || day_n || metric_name'
  )
}}

WITH new_events AS (
  SELECT 
    u.user_id,
    DATE_TRUNC(u.created_at, DAY) AS cohort_date,
    DATE_DIFF(e.event_date, u.created_at, DAY) AS day_n,
    e.event_name,
    e.revenue_usd
  FROM {{ ref('events') }} e
  JOIN {{ ref('users') }} u ON e.user_id = u.user_id
  {% if is_incremental() %}
  WHERE e.event_date = CURRENT_DATE() - 1  -- Sadece dünün datası
  {% endif %}
)
SELECT
  cohort_date,
  day_n,
  'active_users' AS metric_name,
  COUNT(DISTINCT user_id) AS metric_value
FROM new_events
WHERE event_name = 'session_start'
GROUP BY 1, 2, 3

UNION ALL

SELECT
  cohort_date,
  day_n,
  'revenue_per_cohort' AS metric_name,
  SUM(revenue_usd) AS metric_value
FROM new_events
GROUP BY 1, 2, 3;
```

İlk çalıştırmada (full refresh) tüm tarihsel veri işlenir. Sonraki her gün sadece yeni 1 günlük event eklenir. 100M event'lik bir gün 3.2GB veri tarar (partition + cluster sayesinde), query 4 saniye sürer, maliyet 0.016 dolar. Aylık toplam incremental cost: 0.48 dolar — naive yöntemin 300.000'de biri.

## Materialized Views: BigQuery'nin Otomatik Cache Katmanı

Incremental model batch bazlı güncellenir (günde 1 defa). Real-time dashboard için son 1 saatin verisini eklemek istiyorsanız BigQuery'nin **materialized view** özelliği devreye girer. Materialized view, base query'yi fiziksel olarak saklar ve kaynak tablo değiştiğinde otomatik refresh eder.

```sql
CREATE MATERIALIZED VIEW `project.dataset.cohort_retention_mv`
PARTITION BY cohort_date
CLUSTER BY day_n, metric_name
AS
SELECT
  DATE_TRUNC(u.created_at, DAY) AS cohort_date,
  DATE_DIFF(e.event_date, u.created_at, DAY) AS day_n,
  'active_users' AS metric_name,
  COUNT(DISTINCT u.user_id) AS metric_value
FROM `project.dataset.events` e
JOIN `project.dataset.users` u ON e.user_id = u.user_id
WHERE e.event_date >= CURRENT_DATE() - 90  -- Sadece 90 günlük pencere
  AND e.event_name = 'session_start'
GROUP BY 1, 2, 3;
```

Materialized view'i sorgularken BigQuery önce cached sonucu döner. Base tablo değişirse (yeni event eklenirse) arka planda delta hesaplanır. Dashboard sorgusu artık 0.2 saniye sürer, maliyet 0 dolar (cache hit). Ancak dikkat: materialized view'in kendisi storage maliyeti yaratır (BigQuery storage: 0.02$/GB/ay) ve 90 günlük cohort tablosu 12GB ise aylık storage 0.24 dolar ek gelir.

**Tradeoff tablosu:**

| Yöntem | İlk Query Süresi | Dashboard Query Süresi | Aylık Compute Maliyet | Aylık Storage Maliyet |
|--------|------------------|------------------------|------------------------|------------------------|
| Naive JOIN | 12s | 12s | 144.000$ | 0$ |
| dbt Incremental | 4s (ilk batch) | 2s (snapshot okuma) | 0.48$ | 0.18$ (snapshot tablo) |
| Materialized View | 8s (ilk build) | 0.2s (cache hit) | 0$ (otomatik refresh) | 0.24$ |

Production'da ikisinin kombinasyonu idealdir: **dbt incremental model** tarihsel cohort'ları günlük batch'le güncellerken, **materialized view** son 7 günü real-time tutar.

## Partitioning ve Clustering: Query Cost'u %97 Düşürmek

Cohort tablolarını partition ve cluster etmezseniz BigQuery her sorguda tüm tabloyu tarar. 1TB cohort tablosunda (2 yıllık veri) tek bir "Ocak 2026 cohort'unu göster" sorgusu 1TB tarar, 5 dolar ücretlendirilir. Partition + cluster ile aynı sorgu 8GB tarar, 0.04 dolar öder.

**Partition stratejisi:** `cohort_date` alanına göre günlük partition. BigQuery partition filtresini query'de görürse sadece ilgili partition'ları tarar.

```sql
CREATE OR REPLACE TABLE `project.dataset.cohort_retention`
PARTITION BY cohort_date
CLUSTER BY day_n, metric_name
AS
SELECT * FROM `project.dataset.cohort_retention_temp`;
```

**Clustering:** Partition içinde sık filtrelenen alanları (örn. `day_n`, `metric_name`) cluster olarak belirlerseniz BigQuery block-level pruning yapar. "day_7 retention + active_users metriğini göster" sorgusu sadece ilgili block'ları okur.

Somut örnek: 365 partition (günlük), her partition 3GB, cluster olmadan "day_7" filtresi 365 partition × 3GB = 1TB tarar. Cluster ile sadece `day_n=7` block'ları taranır, toplam 12GB. Maliyet farkı: 5$ → 0.06$.

**Anti-pattern:** `user_id` ile cluster etmeyin. Cohort analizi user-level değil cohort-level aggregation'dır. `user_id` cluster sıralaması query planner'a yardımcı olmaz, hatta cache verimliliğini düşürür.

## Identity Resolution ile Cohort Kesinliği

Cohort analizinin doğruluğu `user_id` kesinliğine bağlıdır. Çerezli oturum + login sonrası oturum aynı kullanıcıya ait olduğunda, naive JOIN iki ayrı cohort kaydı yaratır. Bu sorunu [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) ile çözüyoruz: anonim `client_id` ve authenticated `user_id` arasında identity graph kurulur.

```sql
-- Identity resolution tablosu
CREATE TABLE `project.dataset.identity_graph` (
  canonical_user_id STRING,
  client_id STRING,
  user_id STRING,
  merged_at TIMESTAMP
)
PARTITION BY DATE(merged_at)
CLUSTER BY canonical_user_id;

-- Cohort query ile birleştir
WITH resolved_users AS (
  SELECT 
    COALESCE(ig.canonical_user_id, e.user_id) AS user_id,
    e.event_date,
    e.event_name
  FROM events e
  LEFT JOIN identity_graph ig 
    ON e.client_id = ig.client_id OR e.user_id = ig.user_id
)
SELECT 
  DATE_TRUNC(u.created_at, DAY) AS cohort_date,
  DATE_DIFF(r.event_date, u.created_at, DAY) AS day_n,
  COUNT(DISTINCT r.user_id) AS retained_users
FROM resolved_users r
JOIN users u ON r.user_id = u.user_id
GROUP BY 1, 2;
```

Identity resolution olmadan cohort'lar %12-18 inflate olur (bir kullanıcı iki farklı ID ile kaydedilir). Bu hata retention metriklerini düşük gösterir, çünkü paydaki cohort büyüklüğü şişer ama day_n aktivitesi aynı kalır.

## Query Maliyeti İzleme: INFORMATION_SCHEMA ile Production Monitoring

Cohort mimarisi kurulduktan sonra sürekli query maliyet optimizasyonu yapılmalıdır. BigQuery'nin `INFORMATION_SCHEMA.JOBS` tablosu her query'nin taradığı byte sayısını, slot kullanımını ve toplam maliyeti gösterir.

```sql
SELECT
  user_email,
  query,
  total_bytes_processed / POW(10, 12) AS tb_processed,
  (total_bytes_processed / POW(10, 12)) * 5 AS cost_usd,
  total_slot_ms / 1000 / 60 AS slot_minutes
FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
  AND statement_type = 'SELECT'
  AND query LIKE '%cohort_retention%'
ORDER BY total_bytes_processed DESC
LIMIT 20;
```

Bu sorgu son 7 günde cohort tablolarına yapılan query'leri maliyet sırasına göre listeler. Eğer bir dashboard paneli günde 500 defa tetikleniyor ve her seferinde 80GB tarıyorsa (partition filtresi eksik demektir), 500 × 80GB × 5$/TB = 200$ günlük maliyet oluşur. Bu durumda ilgili Looker/Metabase panel query'sine `WHERE cohort_date >= CURRENT_DATE() - 30` filtresi eklemek maliyeti 6$'a düşürür.

**Production checklist:**
- [ ] Tüm cohort tabloları `cohort_date` partition'lı mı?
- [ ] `day_n` ve `metric_name` cluster edilmiş mi?
- [ ] dbt incremental job günlük çalışıyor mu?
- [ ] Materialized view 90 günlük pencereyle sınırlandırılmış mı?
- [ ] Dashboard query'lerinde `WHERE cohort_date >= ...` filtresi var mı?
- [ ] `INFORMATION_SCHEMA` ile haftalık maliyet raporu alınıyor mu?

Cohort mimarisi doğru kurulduğunda retention analizi dashboard'a production-ready hale gelir: 100M günlük event, 5 saniyelik query süresi, aylık 10 dolar compute maliyeti. Ancak bu mimari first-party identity resolution, event şema standardizasyonu ve dbt pipeline disiplini gerektirir — bu yüzden retention engineering bir platform işidir, tek seferlik SQL değil.