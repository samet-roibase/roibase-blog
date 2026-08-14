---
title: "Cohort Tablo Mimarisi: Retention Analizinin Production'da Ölçeklenmesi"
description: "Materialized views, partition stratejisi ve query cost optimization ile retention cohort analizlerini production'da nasıl ölçeklendirir, maliyeti düşürür ve karar hızı kazandırırsınız."
publishedAt: 2026-08-14
modifiedAt: 2026-08-14
category: data
i18nKey: data-007-2026-08
tags: [cohort-analysis, bigquery, materialized-views, data-engineering, retention]
readingTime: 8
author: Roibase
---

Retention analizi e-ticaret ve SaaS modellerinde karar mekanizmasının merkezindedir. Ancak klasik cohort sorguları production ortamında çalıştırıldığında her analiz için terabaytlık event tablolarını full-scan eder, dakikalarca sürer ve query maliyetini günde yüzlerce dolara taşır. Cohort hesaplaması on-demand yapıldığında karar döngüsü yavaşlar, analyst ekip query optimizasyonuyla uğraşır, dashboard'lar güncellenmez. Çözüm: cohort tablolarını pre-compute edilmiş, partitioned ve incremental refresh'lenmiş bir data asset olarak saklamak. Bu yazıda materialized view, partitioning ve incremental build stratejilerini BigQuery üzerinde nasıl kuracağınızı, query maliyetini %90 düşürürken analiz hızını saniyeye indirip retention kararlarını real-time'a yakın hale getireceğinizi gösteriyoruz.

## Klasik Cohort Sorgusu Neden Ölçeklenmiyor

Standart cohort analizi şu yapıda çalışır: kullanıcıyı ilk işlem tarihine göre grupla, sonraki günlerde hangi oranda geri döndüğünü hesapla. SQL sorgusu `events` tablosunu iki kez join eder — bir kez cohort tarihini bulmak için, bir kez retention davranışını saymak için. BigQuery'de 500 milyon satırlık bir event tablosunda bu sorgu 10-15 saniye sürer ve ~$0.50 maliyete gelir. Sorgu her dashboard refresh'te, her analyst iterasyonunda, her A/B test raporunda tekrarlanır.

Sorun maliyetten çok hız ve esneklikten kaynaklanır. Analyst ekip cohort tanımını değiştirmek istediğinde (örneğin "ilk satın alma" yerine "ikinci sepete ekleme" cohort'u denemek) sorguyu yeniden yazmak, test etmek ve validate etmek saatler sürer. Dashboard'lar stale kalır. Pazarlama ekibi "geçen haftaki cohort'un retention'ı neydi" diye sorduğunda canlı veri yoktur, analyst sorguyu manuel çalıştırır. Bu döngü karar sürecini günlerce yavaşlatır.

Cohort hesaplamaları ayrıca aggregation katmanı gerektiren bir data asset'tir. Retention metriği sadece "kullanıcı sayısı" değil, "aktif kullanıcı/cohort büyüklüğü" oranıdır. Bu oran her gün güncellenmeli, geçmiş cohort'ların yeni günlerdeki davranışı eklenmelidir. Klasik sorgu bu incremental logic'i desteklemez, her seferinde baştan hesaplar.

## Materialized View ile Cohort'u Tablo Haline Getirmek

Çözümün ilk adımı cohort tanımını bir materialized view olarak sabitlemektir. BigQuery'de materialized view sorgu sonucunu fiziksel olarak saklar, base tabloda değişiklik olduğunda incremental refresh yapar. Ancak cohort analizi için standart MV yeterli değildir çünkü cohort tanımı ve retention penceresi dinamik parametrelerdir. Bu yüzden hybrid bir yapı kuruyoruz: cohort assignment tablosu + retention event aggregation tablosu.

İlk tablo `cohort_assignments`, kullanıcının cohort'a ilk girdiği tarihi saklar:

```sql
CREATE TABLE `project.dataset.cohort_assignments`
PARTITION BY DATE(cohort_date)
CLUSTER BY user_id
AS
SELECT
  user_id,
  MIN(DATE(event_timestamp)) AS cohort_date,
  COUNTIF(event_name = 'purchase') AS total_purchases
FROM `project.dataset.events`
WHERE event_name IN ('first_visit', 'purchase', 'signup')
GROUP BY user_id;
```

Bu tablo her kullanıcıyı bir kez içerir, `cohort_date` partition key'dir. Yeni kullanıcı geldiğinde sadece ilgili partition'a ekleme yapılır. Tablo büyüklüğü kullanıcı sayısıyla scale eder (event sayısıyla değil), 10 milyon kullanıcı için ~500 MB'dir.

İkinci tablo `daily_user_activity`, her kullanıcının her gün aktif olup olmadığını boolean flag olarak saklar:

```sql
CREATE TABLE `project.dataset.daily_user_activity`
PARTITION BY activity_date
CLUSTER BY user_id
AS
SELECT
  user_id,
  DATE(event_timestamp) AS activity_date,
  TRUE AS is_active
FROM `project.dataset.events`
WHERE event_name IN ('pageview', 'purchase', 'session_start')
GROUP BY user_id, activity_date;
```

Retention sorgusunu bu iki tabloya join ederek yapıyoruz:

```sql
SELECT
  c.cohort_date,
  DATE_DIFF(a.activity_date, c.cohort_date, DAY) AS days_since_cohort,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT a.user_id) AS active_users,
  SAFE_DIVIDE(COUNT(DISTINCT a.user_id), COUNT(DISTINCT c.user_id)) AS retention_rate
FROM `project.dataset.cohort_assignments` c
LEFT JOIN `project.dataset.daily_user_activity` a
  ON c.user_id = a.user_id
  AND a.activity_date >= c.cohort_date
WHERE c.cohort_date >= '2026-01-01'
GROUP BY c.cohort_date, days_since_cohort
ORDER BY c.cohort_date, days_since_cohort;
```

Bu sorgu artık terabaytlık event tablosunu taramaz, sadece iki küçük join yapar. BigQuery'de 10 milyon kullanıcı için ~2 saniye sürer, maliyet $0.02'dir — %96 maliyet düşüşü.

## Partitioning Stratejisi: Hangi Tarih Hangi Partition'a

Cohort tablolarında partitioning stratejisi kritiktir çünkü iki zaman boyutu vardır: cohort tarihi ve activity tarihi. `cohort_assignments` tablosu `cohort_date` ile partition'lanır çünkü bu tablo kullanıcının ilk işlemini saklar ve cohort tanımı sabittir. Yeni kullanıcı geldiğinde sadece bugünün partition'ına ekleme yapılır, geçmiş partition'lar immutable kalır.

`daily_user_activity` tablosu `activity_date` ile partition'lanır çünkü her gün yeni activity verisi gelir ve geçmiş günler değişmez. Bu yapı incremental refresh'e uygundur: dbt veya Airflow job'u her gün sadece bugünün partition'ını yazar, geçmiş partition'lara dokunmaz.

Ancak retention analizi iki tarih arasında join gerektirir: cohort_date ile activity_date. Join performansını optimize etmek için cluster key kullanıyoruz. BigQuery'de `CLUSTER BY user_id` ifadesi aynı user_id'ye sahip satırları fiziksel olarak yan yana saklar, join işlemi block-level pruning yapar ve disk I/O'yu azaltır. 10 milyon kullanıcı için cluster key olmadan join ~8 saniye sürerken, cluster key ile ~2 saniyeye düşer.

Partition pruning de önemlidir. Retention sorgusu genelde son 90 günlük cohort'ları analiz eder. `WHERE c.cohort_date >= '2026-05-01'` filtresi partition pruning tetikler, BigQuery sadece ilgili partition'ları okur. 2 yıllık veri için partition pruning olmadan query cost ~$0.50'dir, partition pruning ile $0.02'dir — çünkü scan edilen veri 24 kat azalır.

Partitioning strategy'de bir trade-off vardır: günlük partition'lar incremental refresh'i kolaylaştırır ama çok fazla partition BigQuery'de query planning overhead'ini artırır. 1000+ partition'lı bir tablo query planner'ın metadata load süresini artırır. Bu yüzden 2 yıldan eski cohort verisi archive edilmeli veya monthly partition'a consolidate edilmelidir.

## Incremental Refresh: Sadece Yeni Veriyi Hesapla

Cohort tablolarının günlük güncellenmesi gerekir çünkü yeni kullanıcılar cohort'a eklenir ve mevcut cohort'ların retention davranışı güncellenir. Ancak full refresh yapmak — tüm tabloyu baştan hesaplamak — gereksiz maliyettir. Çözüm: incremental build pattern.

dbt'de incremental model şu şekilde tanımlanır:

```sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'cohort_date', 'data_type': 'date'},
    cluster_by=['user_id'],
    incremental_strategy='insert_overwrite'
  )
}}

SELECT
  user_id,
  MIN(DATE(event_timestamp)) AS cohort_date,
  COUNTIF(event_name = 'purchase') AS total_purchases
FROM {{ source('raw', 'events') }}
WHERE DATE(event_timestamp) = CURRENT_DATE() - 1
{% if is_incremental() %}
  AND DATE(event_timestamp) > (SELECT MAX(cohort_date) FROM {{ this }})
{% endif %}
GROUP BY user_id
```

Bu model her gün sadece dünün partition'ını hesaplar. `insert_overwrite` stratejisi mevcut partition'ı siler ve yenisini yazar. BigQuery'de partition-level replace atomic bir işlemdir, downstream query'ler asla incomplete veri okumaz.

`daily_user_activity` tablosu için incremental logic daha basittir çünkü her gün yeni bir partition eklenir, geçmiş partition'lar değişmez:

```sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'activity_date', 'data_type': 'date'},
    cluster_by=['user_id']
  )
}}

SELECT
  user_id,
  DATE(event_timestamp) AS activity_date,
  TRUE AS is_active
FROM {{ source('raw', 'events') }}
WHERE DATE(event_timestamp) = CURRENT_DATE() - 1
{% if is_incremental() %}
  AND DATE(event_timestamp) NOT IN (SELECT DISTINCT activity_date FROM {{ this }})
{% endif %}
GROUP BY user_id, activity_date
```

Incremental refresh ile günlük job süresi 5 dakikadan 30 saniyeye düşer. BigQuery slot kullanımı %80 azalır, query queue'da bekleme ortadan kalkar. Analyst ekip sabah 9'da dashboard'ı açtığında dünün retention verisi hazırdır.

Ancak incremental build'de bir risk vardır: late-arriving data. Eğer event pipeline'ında 2-3 saatlik gecikme varsa, dünün partition'ı eksik veri içerir. Bu sorunu çözmek için iki yaklaşım kullanılır: (1) dbt'de `lookback_window` parametresi — son 3 günü her seferinde yeniden hesapla; (2) BigQuery'de `_PARTITIONTIME` metadata kullanarak partition insert time'ına göre filtreleme. İkinci yöntem daha efektif çünkü sadece geç gelen event'leri re-process eder.

## Query Cost Optimization: Tablo Boyutu ve Scan Stratejisi

Cohort tablolarının maliyeti iki faktöre bağlıdır: tablo büyüklüğü (GB) ve query scan pattern'i. `cohort_assignments` tablosu 10 milyon kullanıcı için ~500 MB'dir, `daily_user_activity` tablosu 90 günlük pencerede ~5 GB'dir. Bu iki tablo join edildiğinde BigQuery ~6 GB scan eder, maliyet ~$0.03'tür. Ancak aynı analiz raw event tablosunda yapılsaydı 500 GB scan edilir, maliyet ~$2.50 olurdu — 80x fark.

Maliyeti daha da düşürmek için pre-aggregated cohort summary tablosu kullanılır:

```sql
CREATE TABLE `project.dataset.cohort_retention_summary`
PARTITION BY cohort_date
CLUSTER BY days_since_cohort
AS
SELECT
  c.cohort_date,
  DATE_DIFF(a.activity_date, c.cohort_date, DAY) AS days_since_cohort,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT a.user_id) AS active_users,
  SAFE_DIVIDE(COUNT(DISTINCT a.user_id), COUNT(DISTINCT c.user_id)) AS retention_rate
FROM `project.dataset.cohort_assignments` c
LEFT JOIN `project.dataset.daily_user_activity` a
  ON c.user_id = a.user_id
  AND a.activity_date >= c.cohort_date
GROUP BY c.cohort_date, days_since_cohort;
```

Bu tablo her cohort-day kombinasyonu için pre-compute edilmiş retention oranını saklar. Tablo boyutu ~100 MB'dir (10 milyon kullanıcı × 90 gün = 900 milyon satır → aggregation sonrası ~50,000 satır). Dashboard bu tabloyu okur, join yapmaz, query süresi <1 saniye, maliyet ~$0.001'dir.

Query cost optimization'da dikkat edilmesi gereken bir diğer nokta `SELECT *` kullanmamaktır. Cohort analizinde sadece `user_id`, `cohort_date`, `activity_date` kolonları gerekir. Eğer `daily_user_activity` tablosu event_name, session_id gibi extra kolonlar içeriyorsa ve query `SELECT *` kullanıyorsa, gereksiz veri scan edilir. BigQuery columnar storage kullanır, sadece gerekli kolonları seçmek disk I/O'yu %40-50 azaltır.

Son optimizasyon BigQuery BI Engine kullanmaktır. BI Engine cohort summary tablosunu in-memory cache'ler, dashboard query'leri sub-second latency ile döner. 100 MB'lık bir tablo için BI Engine reservation ~$10/month'tur, ancak günde 1000 query çalıştırıldığında query cost tasarrufu ~$30/month olur — net kazanç.

## Retention Engineering Pipeline: dbt + Airflow + Alerting

Production ortamında cohort mimarisi sadece SQL değildir, orchestration ve monitoring gerektirir. Retention pipeline şu bileşenlerden oluşur:

1. **Airflow DAG:** Her sabah 06:00'da tetiklenir, event tablosunu partition-level validate eder (late-arriving data kontrolü).
2. **dbt incremental models:** `cohort_assignments`, `daily_user_activity`, `cohort_retention_summary` tablolarını sırayla yeniler.
3. **Data quality tests:** dbt test'leri cohort_size > 0, retention_rate BETWEEN 0 AND 1 gibi constraint'leri check eder.
4. **Alerting:** Eğer bugünkü retention Day 1 oranı geçen haftanın ortalamasının %20 altındaysa Slack alert gönderir.

Bu pipeline'ı kurmak için [CDP & Retention Engineering](https://www.roibase.com.tr/tr/retention-engineering-cdp) altyapısı gerekir — event collection'dan cohort tanımına, BigQuery optimization'dan dashboard entegrasyonuna kadar end-to-end mimari.

dbt modellerinde macro kullanarak cohort tanımını parametrik hale getirebilirsiniz:

```sql
{% macro cohort_definition(event_name) %}
  SELECT user_id, MIN(DATE(event_timestamp)) AS cohort_date
  FROM {{ source('raw', 'events') }}
  WHERE event_name = '{{ event_name }}'
  GROUP BY user_id
{% endmacro %}
```

Bu macro ile aynı pipeline'da "ilk satın alma cohort'u", "ilk login cohort'u", "ikinci sepete ekleme cohort'u" gibi farklı cohort tanımlarını parallel çalıştırabilirsiniz. Analyst ekip yeni cohort tipi denemek istediğinde kod yazmaz, config dosyasında parametre değiştirir.

Monitoring katmanında BigQuery Audit Log'ları kullanarak query maliyetini job-level track edin. Eğer cohort refresh job'u aniden 10x maliyet artışı gösteriyorsa (örneğin partition pruning bozulmuş olabilir), otomatik alert ile müdahale edin. Production ortamında cost anomaly detection retention pipeline'ının reliability'sinin parçasıdır.

## Cohort Mimarisinin Karar Sürecine Etkisi

Cohort tablolarını pre-compute etmek sadece maliyet optimizasyonu değildir, karar hızını ve analiz esnekliğini değiştirir. Pazarlama ekibi "geçen haftaki iOS cohort'unun Day 7 retention'ı Android'den iyi mi" sorusuna 10 dakika değil 10 saniyede cevap alır. A/B test sonuçları her gün otomatik güncellenir, manuel export-import döngüsü ortadan kalkar.

Retention metriği artık sadece aylık rapor değil, günlük operasyonel karardır. Eğer bugünkü cohort'un Day 1 retention'ı %5 düşükse, campaign optimization hemen tetiklenir. Eğer bir özellik release'i sonrası Day 3 retention artıyorsa, özelliği hızla scale edebilirsiniz. Bu hız ancak cohort verisi real-time'a yakın fresh olduğunda mümkündür.

Cohort mimarisi ayrıca cross-functional collaboration'ı kolaylaştırır. Product ekibi cohort tablolarını kullanarak feature adoption metriklerini hesaplar, finance ekibi LTV projeksiyonu için aynı retention curve'ü kullanır, customer success ekibi churn risk skorunu aynı cohort assignment'tan türetir. Tek bir data asset birden fazla use case'e hizmet eder, data duplication ortadan kalkar.

Son olarak, cohort mimarisi incrementality measurement'ın temelidir. Retention analizi sadece "ne kadar kullanıcı geri döndü" değil, "hangi marketing channel'ın cohort'u daha iyi retention gösteriyor" sorusunu yanıtlar. Bu analiz [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) ile entegre edildiğinde, attribution modeli sadece ilk tıklama değil, lifetime value'ya katkıyı ölçer. Cohort tablolarında `utm_source`, `campaign_id` gibi acquisition dimension'ları saklayarak channel-level retention comparison yapabilirsiniz — bu karşılaştırma pazarlama bütçesi allocation'ının temel metriğidir.