---
title: "Cohort Tablo Mimarisi: Retention Analizinin Production'da Ölçeklenmesi"
description: "Materialized views, partitioning ve query cost optimization ile cohort analizini production ortamında nasıl ölçeklendirirsiniz? BigQuery ve dbt üzerinde somut tablo mimarisi."
publishedAt: 2026-07-12
modifiedAt: 2026-07-12
category: data
i18nKey: data-007-2026-07
tags: [cohort-analysis, bigquery, materialized-views, query-optimization, retention]
readingTime: 8
author: Roibase
---

Retention analizi pazarlama datası içinde en kritik metriklerden biri. Hangi kullanıcı grubunun ne kadar süre kaldığını, hangi kampanyanın kalıcı değer yarattığını anlamak için cohort tablolarına ihtiyacınız var. Sorun şu: klasik cohort sorguları on milyonlarca satır event datasında her defasında yeniden çalıştığında query cost astronomik boyutlara ulaşıyor. Production'da her sabah güncellenen, analistin sorgu atınca 3 saniyede dönen, ama aynı zamanda doğru partition stratejisiyle maliyeti minimize eden bir cohort mimarisi kurmak ayrı bir mühendislik problemi. Bu yazıda BigQuery ve dbt üzerinde somut bir cohort tablo mimarisini, materialized view stratejisini ve query cost optimizasyonunu adım adım açıklıyoruz.

## Cohort tablosu neden ayrı bir tablo olmalı

Retention hesabı her seferinde raw event tablosundan yapılamaz. Bir e-ticaret firmasının günlük 50 milyon eventi varsa, "Ocak 2026'da kayıt olan kullanıcıların 30. gün aktivite oranı nedir?" sorusunu cevaplamak için BigQuery'nin 1.5 milyar satır taraması yapması gerekir. Bu sorgu 10-15 saniye sürer ve 200-300 GB işler. Analist günde 20 farklı cohort segmenti çekerse aylık query cost $500'ü geçer.

Cohort tablosu bu problemi çözer: event datasını önceden grup bazında toplayıp, her cohort'un her gündeki metriklerini önceden hesaplayıp saklarsınız. Böylece analist sorgu attığında BigQuery sadece cohort tablosunu tarar, ham event datasına dokunmaz. 1000 cohort × 90 gün × 5 metrik = 450.000 satır. Bu tabloya sorgu atmak 200 ms sürer ve 5 MB işler.

Fakat bu yaklaşımın kendisi yeni bir problem yaratır: cohort tablosu nasıl güncellenir? Her gün yeni event geldiğinde tüm tarihi yeniden mi hesaplarsınız? Incremental mı işlersiniz? Hangi partition stratejisi hem query performansını hem de güncelleme maliyetini optimize eder? Bu soruların cevabı materialized view ve incremental dbt model tasarımında gizli.

## Partition stratejisi: cohort_date mi, observation_date mi?

Cohort tablosunun partition anahtarı seçimi kritik. İki adayınız var: cohort oluşturulma tarihi (`cohort_date`) ve gözlem tarihi (`observation_date`).

**`cohort_date` partition:** Kullanıcıların ilk aktivite tarihine göre partition. Ocak 2026 cohort'u bir partition'da, Şubat başka bir partition'da. Avantaj: yeni cohort oluştuğunda sadece o partition'a yazarsınız, eski partition'lara dokunmazsınız. Dezavantaj: aynı cohort'un 90 günlük retention verisini çekmek için BigQuery 90 farklı partition'ı taramak zorunda kalır. Query performansı düşer.

**`observation_date` partition:** Her gün için bir partition. Bugün 12 Temmuz ise, 12 Temmuz partition'ına tüm cohort'ların bugünkü metrikleri yazılır. Avantaj: "Son 7 gündeki retention trendi" gibi sorguları cevaplarken sadece 7 partition taranır. Dezavantaj: her gün tüm cohort'ları güncellemek zorunda kalırsınız, incremental update maliyeti yüksek.

Doğru cevap **iki tabloyla hybrid mimari:** bir "snapshot table" (`observation_date` partitioned) ve bir "aggregated table" (`cohort_date` partitioned). Snapshot tablo her gün güncellenir, analistin dashboard'u buradan beslenir. Aggregated tablo haftalık güncellenir, derin cohort karşılaştırmaları burada yapılır. Bu yapı BigQuery best practice'lerine uyar: narrow ve wide table separation.

```sql
-- Snapshot tablo şeması (observation_date partitioned)
CREATE TABLE `analytics.cohort_retention_snapshot`
PARTITION BY observation_date
CLUSTER BY cohort_date, channel, device_category
AS
SELECT
  observation_date,
  cohort_date,
  channel,
  device_category,
  cohort_size,
  day_n,
  active_users,
  retention_rate
FROM ...
```

## Materialized view vs incremental model tradeoff'u

BigQuery'de materialized view (MV) otomatik incremental refresh yapar — yeni event geldiğinde base query'yi yeniden çalıştırır ve sonucu cache'ler. Ama MV'nin 3 kısıtı var: join sayısı (max 5), window function kullanımı (yok), ve partition yönetimi (manuel değil).

Cohort hesabı genellikle 3+ join içerir (users, events, subscriptions tabloları) ve `LAG()`, `FIRST_VALUE()` gibi window function'lara ihtiyaç duyar. Bu durumda MV kullanılamaz. Alternatif: dbt incremental model.

dbt incremental model, custom merge stratejisi tanımlamanıza izin verir. Her gün sadece son 7 günün partition'larını güncellersiniz (`WHERE observation_date >= CURRENT_DATE() - 7`). Bu yaklaşım query cost'u %85 düşürür. Örnek dbt model:

```sql
{{ config(
    materialized='incremental',
    partition_by={
      "field": "observation_date",
      "data_type": "date"
    },
    cluster_by=['cohort_date', 'channel'],
    incremental_strategy='insert_overwrite'
) }}

WITH daily_cohorts AS (
  SELECT
    DATE(first_seen_at) AS cohort_date,
    user_id,
    acquisition_channel AS channel
  FROM {{ ref('users') }}
  WHERE first_seen_at IS NOT NULL
),

daily_activity AS (
  SELECT
    DATE(event_timestamp) AS activity_date,
    user_id,
    COUNT(*) AS event_count
  FROM {{ ref('events') }}
  WHERE event_name IN ('page_view', 'purchase')
  {% if is_incremental() %}
    AND DATE(event_timestamp) >= CURRENT_DATE() - 7
  {% endif %}
  GROUP BY 1, 2
)

SELECT
  a.activity_date AS observation_date,
  c.cohort_date,
  c.channel,
  DATE_DIFF(a.activity_date, c.cohort_date, DAY) AS day_n,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT a.user_id) AS active_users,
  SAFE_DIVIDE(COUNT(DISTINCT a.user_id), COUNT(DISTINCT c.user_id)) AS retention_rate
FROM daily_cohorts c
LEFT JOIN daily_activity a
  ON c.user_id = a.user_id
WHERE a.activity_date >= c.cohort_date
{% if is_incremental() %}
  AND a.activity_date >= CURRENT_DATE() - 7
{% endif %}
GROUP BY 1, 2, 3, 4
```

Bu model her gün çalıştığında sadece son 7 günün partition'larını overwrite eder. BigQuery işleme maliyeti günlük 20 GB'dan 2 GB'a düşer. Yıllık $2400 query cost tasarrufu.

### Clustering anahtar seçimi

Partition yeterli değil, clustering de gerekli. Cohort tablosu 3 boyutta filtrelenebilir: cohort_date (zaman), channel (kaynak), device_category (cihaz). BigQuery'de clustering anahtarı sırası önemli: en yüksek kardinaliteye sahip alan en başta olmalı.

Kardinalite analizi:
- `cohort_date`: 365 değer (1 yıl)
- `channel`: 15-20 değer (organic, paid_search, social, email...)
- `device_category`: 3-4 değer (desktop, mobile, tablet)

Doğru sıralama: `CLUSTER BY cohort_date, channel, device_category`. Bu sıralama "2025 Q4'te Instagram'dan gelen mobile kullanıcıların 30. gün retention'ı" gibi sorguları 10x hızlandırır.

## Query cost optimizasyonu: pre-aggregation depth seviyesi

Cohort tablosunun granularity seviyesi de maliyet-performans dengesini belirler. Her gün, her channel, her cihaz için ayrı satır mı saklarsınız, yoksa sadece genel toplam mı?

**Option 1: Granular tablo** — her cohort × channel × device × day_n kombinasyonu ayrı satır. Toplam satır sayısı: 365 cohort × 20 channel × 4 device × 90 gün = 2.6 milyon satır. Avantaj: analist istediği segmentte pivot yapabilir. Dezavantaj: yüksek storage cost ($50/TB → aylık $0.15).

**Option 2: Aggregated tablo** — sadece cohort × day_n, channel ve device ayrıştırması yok. Toplam satır sayısı: 365 × 90 = 32.850 satır. Avantaj: minimal storage ve query cost. Dezavantaj: channel breakdown yapılamaz.

Doğru yaklaşım **iki seviye tablo:** core metrics granular (channel, device ayrıştırması ile), extended metrics aggregated (sadece cohort_date × day_n). Bu yapı storage'ı optimize ederken analitik esneklik sağlar. Core metrics tablosu dashboard'ları besler, extended metrics ad-hoc analiz için kullanılır.

Ayrıca BigQuery partition expiration policy tanımlayın: 90 günden eski partition'lar otomatik silinir. Retention analizi genellikle 90 gün ötesine bakmaz, bu policy yıllık storage cost'u %60 düşürür.

## Identity resolution sorununu cohort seviyesinde çözmek

Cohort analizinin en karanlık noktası: user_id çakışmaları ve identity resolution. Bir kullanıcı masaüstünde kayıt olup mobilde işlem yaparsa, iki ayrı user_id oluşur. Cohort tablosu bu iki kimliği birleştirmezse retention %20 düşük hesaplanır.

Çözüm: cohort tablosu oluşturmadan önce identity graph tablosunu birleştirin. [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) sürecinde kurduğunuz canonical_user_id sütunu burada devreye girer. dbt model'da `users` tablosu yerine `users_unified` view'ını kullanın.

```sql
WITH unified_users AS (
  SELECT
    canonical_user_id,
    MIN(first_seen_at) AS cohort_date,
    ARRAY_AGG(DISTINCT acquisition_channel IGNORE NULLS ORDER BY first_seen_at LIMIT 1)[OFFSET(0)] AS channel
  FROM {{ ref('users_unified') }}
  GROUP BY 1
)
```

Bu yaklaşım cross-device retention'ı doğru hesaplar. Production'da %15-25 retention farkı yaratır. Identity resolution tablosu güncellendiğinde cohort tablosu da yeniden materialize edilmeli — bu nedenle dbt DAG'da dependency tanımlayın:

```yaml
models:
  - name: cohort_retention_snapshot
    config:
      materialized: incremental
    depends_on:
      - ref('users_unified')
```

## Production checklist: monitoring ve alerting

Cohort tablosu production'a alındığında 3 metriği sürekli izleyin:

1. **Freshness:** Son partition ne zaman güncellenmiş? dbt-core'da `freshness` testi tanımlayın, 24 saatten eski partition varsa Slack alert gönderin.
2. **Row count drift:** Bugünkü cohort_size dünkü cohort_size'dan %30 farklıysa data pipeline'da sorun var. BigQuery scheduled query ile `STDDEV()` kontrolü yapın.
3. **Query cost spike:** Cohort tablosuna atılan sorguların ortalama maliyeti $0.01'den $0.10'a çıktıysa partition pruning çalışmıyor demektir. INFORMATION_SCHEMA.JOBS tablosunu kontrol edin.

Bu 3 metrik için Google Cloud Monitoring dashboard'u kurun. Threshold aşıldığında PagerDuty entegrasyonu tetikleyin. Production cohort mimarisi "build and forget" değil, sürekli monitoring gerektiren bir sistemdir.

Cohort tablo mimarisi doğru kurulduğunda retention analizi mühendislik ürününe dönüşür: her sabah güncellenir, analist 3 saniyede insight çeker, query cost öngörülebilir. BigQuery partition stratejisi, dbt incremental model ve identity resolution entegrasyonu bu mimarinin 3 direği. Production'da ölçeklenebilir cohort analizi için teknik derinliğe inmek zorunda kalırsınız — ama karşılığı ölçülebilir: yıllık $5000+ query cost tasarrufu ve %20 daha doğru retention metrikleri.