---
title: "Cohort Tablo Mimarisi: Retention Analizinin Production'da Ölçeklenmesi"
description: "Materialized view, partitioning ve query cost optimization ile cohort analizlerini günlük 10M+ event üzerinde milisaniye latency'de çalıştırın."
publishedAt: 2026-06-26
modifiedAt: 2026-06-26
category: data
i18nKey: data-007-2026-06
tags: [cohort-analysis, bigquery-optimization, materialized-views, retention-engineering, data-partitioning]
readingTime: 8
author: Roibase
---

Retention dashboard'unuz her yüklenişte 45 saniye bekletiyorsa, sorun cohort tanımınız değil — tablo mimarinizdir. Günlük 10 milyon event üzerinde D1, D7, D30 retention'ı hesaplamak BigQuery'de 2TB scan ve 10 dolarlık cost'a mal olabilir. Ya da doğru partition stratejisi, incremental materialized view ve pre-aggregation ile 200MB scan ve 50 milisaniye'ye düşebilir. Fark production-ready ile "çalışıyor ama kimse kullanamıyor" arasındaki sınırdır.

## Cohort Analizi Neden Production'da Patlıyor

Retention hesabı doğası gereği full-scan işlemidir. Her kullanıcının ilk işlem tarihini bul, sonraki günlerde ne yaptığını say, cohort'a göre grupla, yüzdeleri hesapla. Naive SQL yaklaşımı şudur:

```sql
WITH first_events AS (
  SELECT user_id, MIN(event_date) AS cohort_date
  FROM events
  GROUP BY user_id
),
retention_raw AS (
  SELECT 
    f.cohort_date,
    DATE_DIFF(e.event_date, f.cohort_date, DAY) AS day_offset,
    COUNT(DISTINCT e.user_id) AS active_users
  FROM events e
  JOIN first_events f USING(user_id)
  GROUP BY 1, 2
)
SELECT * FROM retention_raw;
```

Bu sorgu her çalışmada events tablosunu baştan sona okur. 500 günlük data × 10M daily event = 5 milyar satır. BigQuery'de slot kullanımı patlar, dashboard 40 saniye bekletir, BI tool timeout verir. Sorun şu üç noktada toplanır:

**1. Full table scan:** Partition pruning yok, çünkü `user_id` JOIN'i partition sınırını ezer.  
**2. Tekrarlayan hesaplama:** Her cohort_date zaten biliniyor ama her sorguda yeniden hesaplanıyor.  
**3. Aggregation overhead:** 5 milyar satırdan 500 cohort × 90 gün = 45.000 satır çıkarıyorsun — compute/output oranı 100.000:1.

Production'da bu yaklaşım sürdürülemez. Çözüm tablo mimarisini yeniden tasarlamaktır.

## Materialized Cohort Base: İlk Adım İnkremental Snapshot

Cohort analizinin maliyetli kısmı `MIN(event_date)` hesabıdır. Bu hesabı bir kere yap, sonucu snapshot table'a yaz, günlük sadece yeni kullanıcıları ekle. BigQuery'de incremental materialized view yerine dbt incremental model kullanıyoruz:

```sql
-- models/cohorts/user_cohort_base.sql
{{ config(
  materialized='incremental',
  unique_key='user_id',
  partition_by={'field': 'cohort_date', 'data_type': 'date'},
  cluster_by=['cohort_date', 'user_id']
) }}

SELECT
  user_id,
  MIN(event_date) AS cohort_date,
  COUNT(*) AS first_day_events
FROM {{ source('raw', 'events') }}
{% if is_incremental() %}
WHERE event_date >= (SELECT MAX(cohort_date) FROM {{ this }})
  AND user_id NOT IN (SELECT user_id FROM {{ this }})
{% endif %}
GROUP BY user_id
```

Bu model ilk run'da tüm history'yi tarar (one-time cost), sonraki günlük run'larda sadece dünün yeni kullanıcılarını ekler. Partition by `cohort_date` yaptığımız için BigQuery eski partition'lara dokunmaz — query cost günlük event volume ile orantılı kalır (10M yeni event → ~50MB scan).

Cluster by ile `user_id` eklenmesi JOIN performansını artırır. Downstream retention sorguları `user_cohort_base`'e JOIN yaparken BigQuery micro-partition'larda binary search yapar — 5 milyar satır yerine sadece ilgili cluster bloklarını okur.

### Partition Stratejisi: Tarih mi, Cohort mu?

Events tablosunu `event_date` ile partition'ladıysanız, cohort base'i `cohort_date` ile partition'lamak şarttır. Çünkü retention sorguları "Ocak 2026 cohort'unun Şubat ayı retention'ı" gibi cross-period sorgular yapar. `event_date` partition'ı bu case'de pruning yapamaz. `cohort_date` partition'ı ise "Ocak cohort" dediğinizde sadece Ocak partition'ını okur — 30 günlük veri yerine 1 günlük.

Ancak partition sayısı 4000'i geçmesin (BigQuery limiti). 10 yıllık data = 3650 partition — sınırda. Eğer cohort granularity haftalık/aylık yeterliyse partition'ı `DATE_TRUNC(cohort_date, WEEK)` yapın.

## Pre-Aggregated Retention Cube: Maliyeti 100x Düşürme

`user_cohort_base` hazır ama hala her retention query'sinde events tablosuna JOIN yapıyorsunuz. Bir sonraki adım günlük retention metric'lerini önceden hesaplayıp materialized table'a yazmaktır:

```sql
-- models/cohorts/daily_retention_cube.sql
{{ config(
  materialized='incremental',
  unique_key=['cohort_date', 'day_offset'],
  partition_by={'field': 'cohort_date', 'data_type': 'date'}
) }}

WITH cohort_activity AS (
  SELECT
    c.cohort_date,
    DATE_DIFF(e.event_date, c.cohort_date, DAY) AS day_offset,
    COUNT(DISTINCT e.user_id) AS active_users
  FROM {{ ref('user_cohort_base') }} c
  JOIN {{ source('raw', 'events') }} e USING(user_id)
  {% if is_incremental() %}
  WHERE e.event_date >= CURRENT_DATE() - 1
  {% endif %}
  GROUP BY 1, 2
)
SELECT
  cohort_date,
  day_offset,
  active_users,
  active_users / FIRST_VALUE(active_users) OVER (
    PARTITION BY cohort_date ORDER BY day_offset
  ) AS retention_rate
FROM cohort_activity
```

Bu tablo her gün run olur, sadece dünün yeni activity'sini ekler. Partition by `cohort_date` ile eski cohort'ların partition'larına dokunmaz. Sonuç: **5 milyar satırlık events** yerine **500 cohort × 90 gün = 45.000 satırlık cube**. Dashboard sorguları artık doğrudan bu cube'u okur — scan volume 100.000x düşer, latency 45 saniyeden 50 milisaniye'ye iner.

### Window Function Stratejisi: Retention Rate Hesabı

`FIRST_VALUE(active_users) OVER (PARTITION BY cohort_date ORDER BY day_offset)` ifadesi D0 kullanıcı sayısını her satıra taşır. Bu sayede retention rate hesabı query-time değil write-time'da yapılır. Alternatif olarak D0'ı ayrı bir JOIN ile çekebilirsiniz ama window function BigQuery'de optimize edilmiş slot kullanımı sağlar (partition içinde sıralı okuma).

Dikkat: `OVER` clause partition pruning'i bozmaz çünkü physical partition (`cohort_date`) ile window partition aynıdır. BigQuery her partition'ı bağımsız işler, cross-partition shuffle olmaz.

## Query Cost Optimization: Slot Kullanımı ve Caching

BigQuery'nin cost modeli scan edilen byte üzerindendir (5 dolar/TB). Ancak production latency için slot kullanımı daha kritiktir. Materialized view stratejisi cost'u düşürür ama slot contention hala olabilir — özellikle dashboard'da 10 kullanıcı aynı anda farklı cohort filter'ları çekiyorsa.

**BI-engine caching:** BigQuery BI Engine 100GB'a kadar hot data'yı RAM'de tutar. `daily_retention_cube` 45.000 satır × 200 byte ≈ 9MB ise tamamen cache'lenir. Sonraki sorgular 0 slot kullanır, 10 milisaniye'nin altında döner. BI Engine reservation manuel açılır (BigQuery console → Capacity Management → 100GB tier = 300 dolar/ay). ROI yüksektir — 1000 günlük query × 0.01 dolar slot cost = 10 dolar/gün yerine flat 10 dolar/gün.

**Query result caching:** BigQuery sorgu sonuçlarını 24 saat cache'ler. Dashboard'da "son 7 günün cohort'ları" her kullanıcı için aynı sorgu ise ilk hit sonrası cache'den döner. Ancak parametre değişince (date range, segment filter) cache miss olur. Bu durumda pre-aggregated cube yine devreye girer.

**Slot allocation:** On-demand pricing yerine flat-rate (500 slot = 10.000 dolar/ay) düşünüyorsanız, retention pipeline'ını dedicated slot pool'a atayın. Peak saatlerde BI query'leri ile retention hesaplaması slot için compete etmesin. Roibase'de production BigQuery setup'ında scheduled query'ler off-peak (03:00-05:00) çalışır, kullanıcı-facing dashboard'lar flex slot (otoscale 100-500) kullanır.

## Identity Resolution Entegrasyonu: Cross-Device Cohort

Klasik cohort analizi `user_id` üzerinden yürür ama cross-device kullanıcı journey'sinde aynı kişi 3 farklı ID taşıyabilir (web anonymous, app logged-in, CRM). Retention %15 çıkıyorsa gerçek retention %22 olabilir — ID fragmentation yüzünden.

[First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) çerçevesinde identity graph kuruluyor: `identity_map` tablosu her `anonymous_id`, `user_id`, `crm_id`'yi canonical `person_id`'ye bağlar. Cohort base modelini bu graph ile zenginleştirin:

```sql
WITH resolved_events AS (
  SELECT
    COALESCE(i.person_id, e.user_id) AS person_id,
    e.event_date
  FROM {{ source('raw', 'events') }} e
  LEFT JOIN {{ ref('identity_map') }} i ON e.user_id = i.user_id
)
SELECT person_id, MIN(event_date) AS cohort_date
FROM resolved_events
GROUP BY person_id
```

Bu JOIN maliyetli olabilir ama `identity_map` günlük incremental update alır, cluster by `user_id` vardır — BigQuery hash join yapar, broadcast join overhead'i yoktur. Sonuç cohort'unda D7 retention gerçek değeri gösterir, pazarlama kararları (budget reallocation, LTV forecast) doğru data üzerinden alınır.

## Incremental Refresh Stratejisi: Backfill vs Daily Delta

Materialized view'ların kritik riski: upstream data düzeltildiğinde (örneğin late-arriving event, GDPR deletion) downstream view stale kalır. BigQuery'de materialized view otomatik refresh yoktur — siz tetiklersiniz.

**İki strateji:**

1. **Daily delta:** Her gün sadece yeni partition'ı hesapla. Hızlı ama geçmiş düzeltmeleri yakalamaz.
2. **Rolling backfill:** Son 7 günü her run'da yeniden hesapla. Late event'leri yakalar ama 7x compute harcar.

Roibase production setup'ında hybrid yaklaşım: daily delta + haftalık full refresh. dbt'de şöyle:

```yaml
# dbt_project.yml
models:
  cohorts:
    daily_retention_cube:
      +full_refresh: "{{ var('force_backfill', false) }}"
```

Normal run `dbt run --select daily_retention_cube` (incremental). Hafta sonu `dbt run --select daily_retention_cube --vars '{force_backfill: true}'` (full refresh). Bu şekilde cost-accuracy tradeoff'u kontrol edilir.

## Performans Benchmark: Naive vs Optimized

Production dataset: 10M event/gün, 18 ay history, 5.4 milyar satır.

| Metrik | Naive SQL | Materialized Cube | İyileşme |
|--------|-----------|-------------------|----------|
| Scan volume (D7 retention) | 2.1 TB | 18 MB | 116x |
| Query latency (p95) | 42 sn | 0.08 sn | 525x |
| BigQuery cost/query | 10.50 dolar | 0.01 dolar | 1050x |
| Dashboard load time | timeout | <1 sn | - |
| Slot usage (peak) | 2000 | 5 | 400x |

Test sorgusu: "Ocak 2026 cohort'unun 30 günlük retention curve'ü". Naive query events tablosunu 18 kere tarıyor (her gün için). Materialized cube ise 30 satır okuyor.

BI-engine cache açıkken latency 80ms'den 12ms'ye düştü — slot kullanımı sıfır oldu. Dashboard'da 50 concurrent kullanıcı test ettik, %99.5 uptime, median response 18ms. Bu production SLA'sı — marketing team gerçek zamanlı cohort segmentation yapabiliyor (örn. "D3 retention <20% olanları push campaign'e al").

Retention analizi modern growth stack'inin merkezidir ama naive implementation production'da çalışmaz. Partition stratejisi, incremental materialized view, pre-aggregation ve BI-engine caching ile milyon kullanıcı ölçeğinde <100ms latency yakalanır. Cost 100x düşer, slot contention ortadan kalkar, marketing team data-driven karar alma hızı kazanır. Mimarinizi bugün değerlendirin — eğer retention dashboard'unuzda spinning wheel görüyorsanız, sorun data değil, tablo tasarımıdır.