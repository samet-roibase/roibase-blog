---
title: "dbt + BigQuery ile Modern Pazarlama Data Stack"
description: "Source mapping, modeling layer, semantic layer, exposures — pazarlama datasını karar mekanizmasına bağlayan mimari ve pratik dbt implementasyonu."
publishedAt: 2026-08-02
modifiedAt: 2026-08-02
category: data
i18nKey: data-002-2026-08
tags: [dbt, bigquery, data-stack, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Pazarlama ekipleri artık Google Analytics'teki hazır raporları değil, kendi kurallarını yazdıkları data pipeline'larını kullanıyor. 2026'da modern pazarlama data stack'i üç katmandan oluşur: raw source'lar, modeling layer, semantic layer. Bu yazı dbt + BigQuery ile bu üç katmanı nasıl kuracağını, hangi adımda ne tür hata yapıldığını ve production'da nasıl sürdürülebilir bir yapı kurulacağını anlatıyor.

## Source mapping: Raw datayı BigQuery'ye taşımak yetmez

BigQuery'ye GA4, Meta Ads, sGTM event'lerini yükledin — ama bu sadece başlangıç. Source mapping, raw tabloları anlamlı birer contract'a çevirmek demek. dbt'de source tanımları `.yml` dosyasında yaşar:

```yaml
sources:
  - name: raw_ga4
    database: roibase-prod
    schema: analytics_123456789
    tables:
      - name: events_*
        identifier: events_*
        loaded_at_field: event_timestamp
        freshness:
          warn_after: {count: 12, period: hour}
```

Bu tanım üç şeyi yapar: (1) Data lineage — hangi model hangi raw tabloyu kullanıyor, (2) Freshness check — son event 12 saatten eski olursa uyarı, (3) Contract — `event_timestamp` sütunu yoksa build patlar.

**En yaygın hata:** Raw schema'yı olduğu gibi kullanmak. GA4'ün `event_params` nested array'ini flatten etmeden SQL yazmak, her sorgu 200+ satır olur. Source mapping adımında `unnest` logic'i tek yerde yaşamalı:

```sql
-- models/staging/stg_ga4_events.sql
with source as (
  select * from {{ source('raw_ga4', 'events_*') }}
),

flattened as (
  select
    event_date,
    event_timestamp,
    user_pseudo_id,
    (select value.string_value from unnest(event_params) where key = 'session_id') as session_id,
    (select value.int_value from unnest(event_params) where key = 'ga_session_number') as session_number
  from source
)

select * from flattened
```

Bu model artık downstream'de `ref('stg_ga4_events')` ile çağrılır — raw event_params syntax'ı upstream'de tecrit edildi. Freshness check her gün çalışır, schema değişikliğinde otomatik hata verir.

## Modeling layer: Metriği bir kere tanımla, yüz kere kullan

Staging katmanından sonra modeling layer gelir. Burada intermediate models (business logic), mart models (aggregation) ayrılır. Pazarlama data stack'inde en kritik model **session → transaction** join'i:

```sql
-- models/marts/mrt_session_metrics.sql
with sessions as (
  select * from {{ ref('int_sessions') }}
),

transactions as (
  select * from {{ ref('int_transactions') }}
),

joined as (
  select
    s.session_id,
    s.session_date,
    s.traffic_source,
    s.medium,
    s.campaign,
    t.transaction_id,
    t.revenue,
    t.transaction_timestamp
  from sessions s
  left join transactions t
    on s.session_id = t.session_id
)

select
  session_date,
  traffic_source,
  medium,
  campaign,
  count(distinct session_id) as sessions,
  count(distinct transaction_id) as transactions,
  sum(revenue) as total_revenue,
  safe_divide(count(distinct transaction_id), count(distinct session_id)) as conversion_rate
from joined
group by 1, 2, 3, 4
```

Bu model her gün 03:00'te çalışır (dbt Cloud scheduler), Looker Studio doğrudan bu tabloya bağlanır. Değişiklik gerektiğinde SQL'i bir yerde değiştirirsin, tüm dashboard'lar otomatik güncellenir.

**Önemli detay:** `safe_divide` kullanımı — sessions = 0 olursa sıfıra bölme hatası vermez, null döner. Production pipeline'ında exception handling bu seviyede yapılır.

### dbt tests: Veri kalitesi otomatik check

Modeling layer'da metrik tanımlarken aynı zamanda test de yazarsın:

```yaml
# models/marts/schema.yml
models:
  - name: mrt_session_metrics
    columns:
      - name: session_date
        tests:
          - not_null
      - name: sessions
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"
      - name: conversion_rate
        tests:
          - dbt_utils.expression_is_true:
              expression: "<= 1"
```

`dbt test` komutu bu kuralları çalıştırır. Conversion rate > 1 çıkarsa (SQL'de hata var demektir), build başarısız olur, Slack'e alert gider. Manuel QA yerine automated data quality — data stack'in geri kalanı bu temelin üzerine kurulur.

## Semantic layer: Metriği tanımla, sorguyu değil

dbt v1.6+ ile semantic layer beta'dan çıktı. Artık metriği SQL'de değil, `.yml` dosyasında tanımlıyorsun:

```yaml
# models/semantic/metrics.yml
metrics:
  - name: total_revenue
    label: Total Revenue
    model: ref('mrt_session_metrics')
    type: sum
    sql: total_revenue
    timestamp: session_date
    time_grains: [day, week, month]

  - name: roas
    label: Return on Ad Spend
    type: ratio
    numerator: total_revenue
    denominator: total_ad_spend
```

Bu tanım üç yerde kullanılır: (1) Looker Studio, (2) dbt Cloud discovery API'den Slack bot'a metric sorgusu, (3) Airflow DAG'inde downstream ML pipeline'a input.

**Avantaj:** SQL yazmadan metrik tüketilebilir. Marketing analyst artık "Show me ROAS by campaign, last 7 days" yazıyor, dbt semantic layer sorguyu otomatik compile ediyor. SQL logic model katmanında, metrik tanımı semantic layer'da — ikisi birbirinden ayrı, değişiklik izole.

**Dikkat:** Semantic layer hâlâ yeni — tüm BI araçlarıyla native entegrasyonu yok. Roibase production stack'inde hybrid yaklaşım kullanıyoruz: kritik metrikler semantic layer'da, custom analiz için SQL exposure'lar.

### Exposures: Downstream bağımlılıkları dokümante et

Exposures, dbt model'inin dışarıda nerede kullanıldığını gösterir:

```yaml
# models/exposures.yml
exposures:
  - name: looker_studio_performance_dashboard
    type: dashboard
    url: https://lookerstudio.google.com/...
    depends_on:
      - ref('mrt_session_metrics')
      - ref('mrt_campaign_performance')
    owner:
      name: Marketing Analytics Team
      email: analytics@roibase.com.tr
```

Bu tanım dbt docs'ta visualize edilir — hangi dashboard hangi model'e bağlı, model değiştiğinde kimin bilgilendirilmesi gerektiği net. Production'da schema breaking change yaptığında `dbt run --select +mrt_session_metrics+` ile downstream etkileri görürsün.

**Gerçek senaryo:** GA4 event_params'ta `page_location` key'i `page_url` olarak değişti. Exposure tanımı sayesinde etkilenen 3 dashboard ve 1 Airflow DAG'i bulduk, migration 2 saatte tamamlandı. Exposure olmasaydı, dashboardlar sessizce kırılırdı, user complaint ile öğrenirdik.

## Incremental models: 2TB veriyi her gün rebuild etme

Pazarlama datasında daily partition'lar terabayt seviyesine ulaşır. Her `dbt run` komutunda full refresh yapamazsın — BigQuery maliyeti ve süre kabul edilemez. Incremental model kullanırsın:

```sql
-- models/marts/mrt_user_journey.sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'event_date', 'data_type': 'date'},
    cluster_by=['user_pseudo_id', 'traffic_source'],
    incremental_strategy='insert_overwrite'
  )
}}

select
  event_date,
  user_pseudo_id,
  traffic_source,
  -- ...
from {{ ref('stg_ga4_events') }}

{% if is_incremental() %}
  where event_date >= date_sub(current_date(), interval 3 day)
{% endif %}
```

Bu config üç şey yapar: (1) BigQuery'de partition oluşturur — eski günlere dokunmadan yeni günü ekler, (2) `cluster_by` ile sorgu performansı artırır, (3) `insert_overwrite` stratejisi — son 3 günü siler, yeniden yazar (late arriving data için).

**Maliyet farkı:** 365 günlük veri, full refresh = 2.5 TB scan ($12.5), incremental = 3 GB scan ($0.015). Günlük çalışan pipeline'da yıllık fark ~$4500 vs ~$5. Bu yüzden incremental model production stack'in temelidir.

## Data stack'i karar mekanizmasına bağlamak

dbt + BigQuery altyapıyı kurar, ama asıl değer pazarlama kararlarına etkisinde. Semantic layer'dan Slack bot'a metric akışı tipik senaryodur:

1. Marketing manager Slack'te `/metric roas last_30_days campaign=brand` yazar
2. Slack app dbt Cloud semantic layer API'yi çağırır
3. API `mrt_session_metrics` tablosunu sorgular, ROAS hesaplar
4. Sonuç Slack'e döner: "Brand kampanyası ROAS: 4.2x"

Bu akış için dbt semantic layer + custom Python middleware gerekir. Roibase production stack'inde Airflow DAG'i günlük semantic layer snapshot'ı alır, Looker Studio ve internal app'ler bu snapshot'ı kullanır — API rate limit problemi olmaz.

**Alternatif yaklaşım:** [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) hizmetinde kullandığımız hybrid stack — dbt semantic layer + Cube.js. Cube.js caching layer ekler, BI performansı artırır. Seçim data volume ve query pattern'e bağlı.

## Production checklist: dbt stack'i deploy etmeden önce

dbt local'de çalıştı — production'a geçmeden önce şu kontroller yapılmalı:

- **CI/CD:** dbt Cloud veya GitHub Actions ile her commit'te `dbt build --select state:modified+` çalışmalı
- **Freshness monitoring:** Kritik source'lar için `warn_after` ve `error_after` tanımla
- **Alerting:** dbt Cloud webhooks ile Slack entegrasyonu kur — build fail olursa 5 dakikada ekip bilgilendirilsin
- **Documentation:** `dbt docs generate` otomatik çalışmalı, artifact S3/GCS'ye push edilmeli
- **Cost monitoring:** BigQuery slot reservation veya on-demand cost alert — unexpected spike için $500/day threshold koy
- **Backup strategy:** Production data warehouse'da snapshot table tut — kritik model yanlış güncelleme olursa rollback edebilmelisin

**En kritik kural:** Production'da manual `dbt run` yok. Tüm execution scheduler üzerinden (dbt Cloud, Airflow, Prefect). Manuel run data lineage'ı kırar, hata durumunda root cause analysis yapılamaz.

dbt + BigQuery modern pazarlama data stack'inin omurgası — source mapping ile raw datayı contract'a bağladın, modeling layer ile metriği tek noktada tanımladın, semantic layer ile SQL bilmeyen kullanıcı bile metrik tüketebildi. Production'da incremental model ve test coverage ile pipeline sürdürülebilir hale geldi. Şimdi bir sonraki katman: bu datayı real-time activation'a bağlamak — CDP, audience sync, incrementality measurement. Ama o başka bir data stack tartışması.