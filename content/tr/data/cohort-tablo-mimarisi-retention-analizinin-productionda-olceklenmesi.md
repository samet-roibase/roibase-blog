---
title: "Cohort Tablo Mimarisi: Retention Analizinin Production'da Ölçeklenmesi"
description: "Materialized views, partitioning ve query cost optimization ile cohort analizi tablolarını production ortamında nasıl ölçeklendirebileceğinizi öğrenin."
publishedAt: 2026-07-28
modifiedAt: 2026-07-28
category: data
i18nKey: data-007-2026-07
tags: [cohort-analysis, bigquery, materialized-views, data-engineering, retention]
readingTime: 8
author: Roibase
---

Retention analizi yapan her organizasyon aynı yere takılıyor: cohort sorguları production'da ya 30 saniye sürüyor ya da BigQuery faturası ayda $8.000'e yaklaşıyor. Test ortamında 100K kullanıcıyla güzel çalışan `GROUP BY user_id, cohort_week` sorgusu, 50M kullanıcı ve 2 yıllık event log'uyla karşılaşınca çöküyor. Çözüm basit değil — sadece index eklemek veya cache açmak değil, tablo mimarisini baştan retention workload'una göre tasarlamak gerekiyor.

## Cohort Analizi Neden Farklı Bir Mimari İster

Klasik event log tablosu `user_id`, `event_time`, `event_name` üzerine kurulu. Her cohort sorgusu bu tabloda milyarlarca satırı tarihsel olarak tarayıp, kullanıcıyı ilk olay tarihine göre grupluyor. BigQuery'de bu sorgu şöyle:

```sql
WITH cohorts AS (
  SELECT user_id, DATE_TRUNC(MIN(event_time), WEEK) AS cohort_week
  FROM events
  GROUP BY user_id
),
retention AS (
  SELECT 
    c.cohort_week,
    DATE_DIFF(DATE_TRUNC(e.event_time, WEEK), c.cohort_week, WEEK) AS weeks_since_cohort,
    COUNT(DISTINCT e.user_id) AS active_users
  FROM cohorts c
  JOIN events e ON c.user_id = e.user_id
  GROUP BY 1, 2
)
SELECT * FROM retention ORDER BY 1, 2;
```

Bu sorgu her çalıştığında `events` tablosunun tamamını okur. 500M satır × 16 byte ortalama = 8 GB scan. BigQuery'de 1 TB scan $6.25 ise, 1.000 sorgu = $50. Dashboard her 5 dakikada refresh ise, ayda 8.640 sorgu = $432 sadece cohort widget'ı için. Ekibe 10 analist daha ekle, Slack botları query tetiklesin, maliyet katlanır.

Asıl sorun maliyet bile değil — latency. JOIN 500M satırla çalışınca 15-30 saniye sürer. Kullanıcı dashboard'da filter değiştirdi, yeni cohort datası için 20 saniye bekliyor. Retention analizi bu gecikmede iteratif olamaz.

### Materialized View İlk Adım Ama Yetmez

BigQuery materialized view cohort sorgusunu pre-compute eder:

```sql
CREATE MATERIALIZED VIEW cohort_retention AS
SELECT 
  cohort_week,
  weeks_since_cohort,
  active_users
FROM retention; -- yukarıdaki CTE sorgusunun sonucu
```

Artık dashboard `cohort_retention` tablosunu okur, `events` tablosunu değil. Scan 8 GB yerine 80 MB. Latency 20 saniye yerine 800 ms. Fakat iki sınır var:

1. **Refresh maliyet:** Materialized view her refresh'te base sorguyu çalıştırır. Yani yine 8 GB scan. Eğer view'ı saatte 1 refresh edersen, 24 × 8 GB = 192 GB/gün = ayda 5,8 TB scan. Maliyet düşmedi, latency düştü.
2. **Flexibility:** Materialized view statik. Kullanıcı "Android cohort retention" diye filtre ekler, view yeniden hesaplanmalı. Pre-filter ekleyemezsin, çünkü `WHERE platform = 'Android'` ekleyince farklı view gerekir.

Bu yüzden cohort mimarisi üç katmanlı kurulmalı: raw events → cohort assignment table → aggregated retention table.

## Cohort Assignment Tablosunu Ayırmak

İlk adım: her kullanıcıyı cohort'una atayan ayrı bir tablo oluştur. Bu tablo sadece `user_id` ve `cohort_week` içerir, event log'dan türetilir ama günde 1 kere hesaplanır:

```sql
CREATE OR REPLACE TABLE cohort_assignments
PARTITION BY cohort_week
CLUSTER BY user_id
AS
SELECT 
  user_id,
  DATE_TRUNC(MIN(event_time), WEEK) AS cohort_week,
  MIN(event_time) AS first_seen_at
FROM events
WHERE event_time >= '2024-01-01'
GROUP BY user_id;
```

Bu tablo:
- **Partition by cohort_week:** BigQuery her hafta için ayrı dosya blok yaratır. Filtre `WHERE cohort_week = '2026-01-05'` olunca sadece 1 partition okunur.
- **Cluster by user_id:** Partition içinde user_id bazlı sıralı depolama. JOIN hızlanır.
- **Boyut:** 50M kullanıcı × 3 kolon × 16 byte = ~2.4 GB. Event log 500 GB ise, cohort tablosu 200× küçük.

Şimdi retention sorgusu bu tabloyu kullanır:

```sql
SELECT 
  c.cohort_week,
  DATE_DIFF(DATE_TRUNC(e.event_time, WEEK), c.cohort_week, WEEK) AS weeks_since,
  COUNT(DISTINCT e.user_id) AS active_users
FROM cohort_assignments c
JOIN events e ON c.user_id = e.user_id
WHERE c.cohort_week >= '2026-01-01'
GROUP BY 1, 2;
```

`cohort_assignments` partition pruning ile 4 haftalık veri okursa 200 MB scan. JOIN hâlâ `events` tablosunu full scan yapıyor ama artık cohort filter uygulanmış state'ten başlıyor, gereksiz kullanıcı yok.

### Incremental Güncelleme

`cohort_assignments` tablosu günde 1 kere yenilenir ama her seferinde sıfırdan hesaplanmaz. dbt incremental model kullan:

```sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'cohort_week', 'data_type': 'date'},
    cluster_by=['user_id']
  )
}}

SELECT 
  user_id,
  DATE_TRUNC(MIN(event_time), WEEK) AS cohort_week,
  MIN(event_time) AS first_seen_at
FROM {{ ref('events') }}
{% if is_incremental() %}
  WHERE event_time > (SELECT MAX(first_seen_at) FROM {{ this }})
{% endif %}
GROUP BY user_id
```

Bu model ilk run'da tüm datayı işler, sonraki run'larda sadece yeni kullanıcıları ekler. Scan 500 GB yerine günde 2 GB.

## Aggregated Retention Tablosu: Pre-Compute Week-Level Metrics

Cohort assignment tablosu retention sorgusunu hızlandırdı ama dashboard hâlâ her istekte `events` tablosunu JOIN ediyor. Bir adım daha: retention metriklerini haftalık bazda pre-compute et, ayrı bir tabloda sakla.

```sql
CREATE TABLE cohort_retention_weekly
PARTITION BY cohort_week
CLUSTER BY weeks_since_cohort
AS
SELECT 
  c.cohort_week,
  DATE_DIFF(DATE_TRUNC(e.event_time, WEEK), c.cohort_week, WEEK) AS weeks_since_cohort,
  COUNT(DISTINCT e.user_id) AS active_users,
  COUNT(*) AS total_events,
  APPROX_QUANTILES(session_duration, 100)[OFFSET(50)] AS median_session_duration
FROM cohort_assignments c
JOIN events e ON c.user_id = e.user_id
GROUP BY 1, 2;
```

Bu tablo:
- **Boyut:** 52 hafta × 52 weeks_since × 3 metrik = ~8.100 satır (1 yıllık veri için). KB seviyesinde.
- **Scan:** Dashboard `cohort_retention_weekly` okur, `events` okuması yok. Scan < 1 MB.
- **Latency:** BigQuery 1 MB veriyi 80 ms'de okur. Dashboard artık sub-second.

Tradeoff: Bu tablo günde 1 kere yenilenmelidir. Güncel olmayan data kabul edilemezse, 1 saatte 1 refresh (dbt schedule `0 * * * *`). Refresh maliyeti: cohort_assignments JOIN events, ~10 GB scan. Günde 24× = 240 GB, ayda 7.2 TB. Karşılaştırma: dashboard 1.000 kere cohort sorgusu çalıştırsaydı, 8 TB scan olurdu. Yani aggregated tablo scan'i %10 düşürdü, latency'yi 20 saniyeden 80 ms'ye çekti.

### Partitioning Stratejisi: Cohort Week vs Event Week

Cohort retention tablosunu `cohort_week` ile partition'lamak doğru mu yoksa `event_week` ile mi? İki yaklaşım var:

**Partition by cohort_week:**
- Kullanım: "2026-W03 cohort'unun retention curve'ü nedir?"
- Pruning: `WHERE cohort_week = '2026-01-13'` → 1 partition okunur
- Zorluk: Dashboard "son 4 haftanın toplam retention'ı" diye sorduysa, 4 partition okunur. Fakat çoğu retention analizi cohort bazlı olduğu için optimal.

**Partition by event_week:**
- Kullanım: "Bu hafta aktif olan cohort'lar hangileri?"
- Pruning: `WHERE event_week = '2026-07-21'` → 1 partition
- Zorluk: Cohort filter eklersen partition pruning çalışmaz, tüm partitions okunur.

Roibase [veri analizi mimarisi](https://www.roibase.com.tr/tr/verianalizi) projelerde retention tablosunu cohort_week ile partition'lar, çünkü retention sorgularının %80'i "cohort X'in N. haftası" formatında.

## Query Cost Optimization: Clustering ve BI Engine

Partition yukarıdan aşağıya pruning yapar (hangi dosya bloklarını okuma), clustering soldan sağa sıralar (blok içinde hangi satırları okuma). İkisi birleşince scan minimize olur.

```sql
CREATE TABLE cohort_retention_weekly
PARTITION BY cohort_week
CLUSTER BY weeks_since_cohort, platform, country;
```

Sorgu `WHERE weeks_since_cohort = 4 AND platform = 'iOS'` ise:
1. Partition pruning → sadece ilgili cohort_week partition'ları
2. Clustering → partition içinde önce `weeks_since_cohort = 4` satırları, sonra `platform = 'iOS'` satırları

BigQuery clustering max 4 kolon alır. Sıralama önemli: en çok filter edilen kolonu en başa koy.

**BI Engine:** BigQuery'nin in-memory cache katmanı. 100 GB BI Engine reserve edersen, sık kullanılan tablolar RAM'de tutulur. `cohort_retention_weekly` tablosu 50 MB ise, tamamen BI Engine'de kalır, scan 0 olur (cache hit). Maliyet: 100 GB $100/ay. Karşılığı: ayda 10 TB scan tasarrufu = $62.50. ROI pozitif.

### Approximation Functions: Tam Accuracy Gerekmeyen Metrikler

Cohort retention hesabında bazı metrikler exact olmalı (`COUNT(DISTINCT user_id)`), bazıları yaklaşık olabilir (median session duration, percentile).

BigQuery approximate fonksiyonlar:
- `APPROX_COUNT_DISTINCT(user_id)` → %2 hata payı, 10× hızlı
- `APPROX_QUANTILES(value, 100)[OFFSET(50)]` → median, %1 hata
- `APPROX_TOP_COUNT(event_name, 10)` → en çok yapılan 10 event

Örnek: 50M kullanıcı için exact `COUNT(DISTINCT ...)` 8 saniye sürer, `APPROX_COUNT_DISTINCT` 800 ms. Dashboard real-time filter için approx kullan, final rapor için exact.

## Incremental Update Strategy: Event-Time vs Processing-Time

Cohort tablosu günde 1 kere güncellenirken hangi event'leri işlemeli? İki timestamp var:

1. **event_time:** Kullanıcının eventi gerçekleştirdiği zaman (client-side)
2. **_PARTITIONTIME:** BigQuery'nin event'i depoladığı zaman (server-side)

Incremental update `event_time` kullanırsa:
```sql
WHERE event_time > (SELECT MAX(event_time) FROM cohort_assignments)
```
**Sorun:** Late-arriving events. Kullanıcı 3 gün offline, event batch upload ile gelir. `event_time` 3 gün önceyse, incremental sorgu onu kaçırır.

Incremental update `_PARTITIONTIME` kullanırsa:
```sql
WHERE _PARTITIONTIME > CURRENT_DATE() - 7
```
**Avantaj:** Son 7 günü her seferinde yeniden işler, late events yakalanır.
**Maliyet:** 7 gün event data = günde ~14 GB scan (2 GB yerine).

Tradeoff: Late events %1'in altındaysa `event_time` kullan, scan düşük. Mobile app'te late events %5 civarıysa `_PARTITIONTIME` ile 3 gün lookback yap.

## Cohort Segmentation: Dynamic Filters vs Static Dimensions

Kullanıcı dashboard'da "iOS cohort retention" diye filtre ekler. İki yöntem:

**Yöntem 1: Query-time filter**
```sql
SELECT cohort_week, weeks_since, active_users
FROM cohort_retention_weekly
WHERE user_id IN (SELECT user_id FROM users WHERE platform = 'iOS');
```
**Sorun:** Subquery her seferinde `users` tablosunu okur. 50M kullanıcı = 1 GB scan. Dashboard 100 kere refresh = 100 GB.

**Yöntem 2: Pre-compute dimensions**
```sql
CREATE TABLE cohort_retention_weekly
AS
SELECT 
  c.cohort_week,
  weeks_since_cohort,
  u.platform,
  u.country,
  COUNT(DISTINCT e.user_id) AS active_users
FROM cohort_assignments c
JOIN events e ON c.user_id = e.user_id
JOIN users u ON e.user_id = u.user_id
GROUP BY 1, 2, 3, 4;
```
Artık `WHERE platform = 'iOS'` filtresi retention tablosunda doğrudan çalışır. Scan artışı: 2 kolon × 10 segment = 20× büyük tablo. Fakat query-time JOIN yok, latency düşük.

**Öneri:** En çok kullanılan 3-4 segmenti (platform, country, acquisition_channel) pre-compute et, geri kalanı query-time filter.

---

Cohort retention mimarisi production'da ölçeklenmek için üç katmanlı kurulmalı: assignment, aggregation, caching. BigQuery partitioning ve clustering doğru planlanırsa, 50M kullanıcıda bile sub-second latency ve ayda $200 scan budget tutturulabilir. Asıl kazanç maliyet değil — retention analizi iteratif hale gelir, ekip günde 50 cohort denemesi yapabilir.