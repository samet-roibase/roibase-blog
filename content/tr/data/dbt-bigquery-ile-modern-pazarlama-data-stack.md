---
title: "dbt + BigQuery ile Modern Pazarlama Data Stack"
description: "Source mapping'den semantic layer'a: pazarlama datasını nasıl karar mekanizmasına çeviriyorsunuz? dbt modeling katmanı, exposure tanımları ve production pipeline mimarisi."
publishedAt: 2026-06-14
modifiedAt: 2026-06-14
category: data
i18nKey: data-002-2026-06
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Pazarlama ekipleri 2026'da veriyle boğuşmak yerine veriyle karar alıyor. GA4, Meta Ads, Google Ads, CRM, CDP, server-side GTM — hepsi ayrı tabloya düşüyor. Ekip spreadsheet'te manuel birleştirme yapıyor, her hafta rakamlar değişiyor, kimse güvenmiyor. Bu kaos modern data stack'le ortadan kalkıyor: BigQuery kaynak, dbt transformation katmanı, semantic layer gösterge ağacı. Kodu repository'de versiyonluyorsunuz, her değişiklik test ediliyor, metrikler tek source of truth'tan geliyor. Bu yazı dbt + BigQuery kombinasyonunun pazarlama data pipeline'ını nasıl production-grade hale getirdiğini gösteriyor.

## Source mapping: Ham veri patikalarını standartlaştırmak

dbt'nin ilk görevi source mapping — farklı sistemlerden gelen raw data'yı aynı şemaya oturtmak. BigQuery'de `analytics_123456.events_*` tablosu GA4'ten geliyor, `facebook_ads.ads_insights` Meta API'den, `crm.transactions` Shopify'dan. Her birinin farklı timestamp formatı, farklı user identifier'ı, farklı currency column'u var. dbt `sources.yml` dosyasında bu ham tabloları tanımlıyorsunuz:

```yaml
version: 2
sources:
  - name: ga4
    database: analytics_123456
    tables:
      - name: events_
        identifier: "events_*"
        loaded_at_field: event_timestamp
  - name: meta_ads
    database: facebook_ads
    schema: public
    tables:
      - name: ads_insights
        loaded_at_field: date_start
```

Bu tanım dbt'ye "bu tablolar upstream source, ben bunlara dokunmuyorum ama freshness test ediyorum" diyor. `dbt source freshness` komutu son veri ne zaman gelmiş kontrol ediyor — Meta API delay'de kalırsa alert atıyor. Source mapping olmadan her model doğrudan `SELECT * FROM analytics_123456.events_20260614` yazıyor, tablo ismi değişince 40 model kırılıyor. Mapping ile referans `{{ source('ga4', 'events_') }}` oluyor, değişiklik tek noktadan yayılıyor.

GA4 event_timestamp Unix microsecond, Meta ads date_start ISO string, CRM created_at UTC datetime — hepsi ayrı format. Source mapping'de standart timestamp sütunu çıkarıyorsunuz: `TIMESTAMP_MICROS(event_timestamp) AS event_time` GA4'te, `PARSE_TIMESTAMP('%Y-%m-%d', date_start) AS event_time` Meta'da. Bu normalizasyon downstream modellere temiz input veriyor.

## Modeling layer: Staging, intermediate, mart

dbt'nin gücü layered modeling — staging, intermediate, mart katmanları. Staging modelleri source'tan 1:1 çekiyor, sadece renaming + type casting yapıyor. `stg_ga4_events.sql`:

```sql
SELECT
  TIMESTAMP_MICROS(event_timestamp) AS event_time,
  user_pseudo_id AS anonymous_id,
  event_name,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'session_id') AS session_id,
  geo.country,
  device.category AS device_category
FROM {{ source('ga4', 'events_') }}
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY))
  AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
```

Staging clean data veriyor ama iş mantığı yok. Intermediate modeller business logic ekliyor: sessionization, attribution, funnel steps. `int_sessions.sql` GA4 event'lerini session bazına topluyorsunuz:

```sql
WITH session_events AS (
  SELECT
    session_id,
    MIN(event_time) AS session_start,
    MAX(event_time) AS session_end,
    COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN event_time END) AS pageviews,
    MAX(CASE WHEN event_name = 'purchase' THEN 1 ELSE 0 END) AS converted
  FROM {{ ref('stg_ga4_events') }}
  GROUP BY session_id
)
SELECT
  *,
  TIMESTAMP_DIFF(session_end, session_start, SECOND) AS duration_seconds
FROM session_events
```

Mart modelleri son tüketim katmanı — BI tool, Looker, internal dashboard buraya bakıyor. `fct_marketing_performance.sql` tüm kanalları birleştiriyor, spend + revenue + ROAS hesaplıyor. Her mart modeli tek bir business entity'ye odaklanıyor: `dim_customers`, `fct_orders`, `fct_sessions`. Mart naming convention critical — `dim_` dimension (müşteri, ürün), `fct_` fact (transaction, event), `rpt_` report aggregate.

## Semantic layer: KPI tanımları kod olarak

Semantic layer metrik tanımlarını dbt içine çekiyor — "revenue nedir", "CAC nasıl hesaplanır" artık spreadsheet'te değil YAML'da. dbt v1.6+ `metrics.yml` dosyasında gösterge ağacını kuruyorsunuz:

```yaml
version: 2
metrics:
  - name: revenue
    label: Revenue
    model: ref('fct_orders')
    calculation_method: sum
    expression: order_amount
    timestamp: order_date
    time_grains: [day, week, month, quarter]
    dimensions:
      - channel
      - country
      - device_category

  - name: cac
    label: Customer Acquisition Cost
    calculation_method: derived
    expression: "{{ metric('ad_spend') }} / {{ metric('new_customers') }}"
    timestamp: acquisition_date
    time_grains: [month, quarter]
```

Semantic layer ile BI tool CAC hesaplamıyor, dbt hesaplıyor. Looker "bana CAC ver" dediğinde dbt compiled SQL döndürüyor, spend ve new customer tablosunu join edip bölüyor. Tanım kod olduğu için git history'de — "CAC hesaplamasını kim değiştirdi, neden değiştirdi" cevaplı. Spreadsheet'teki formül kaybolmuyor, versiyon kontrolü var.

Roibase projelerinde semantic layer [veri analizi & içgörü mühendisliği](https://www.roibase.com.tr/tr/verianalizi) kapsamında kuruluyor — sadece metric tanımı değil, KPI tree mapping, dimension hierarchy, grain standardization da dahil. Örnek: "revenue" metriği `fct_orders.order_amount` toplamı, ama "recognized_revenue" aynı tabloda `recognized_at` timestamp'e göre filtreleniyor (SaaS subscription modeli için). Tek tablo, iki metrik, farklı business logic.

## Exposures: Downstream bağımlılıkları görünür kılmak

Exposure dbt'nin "bu modeli kim kullanıyor" sorusuna cevabı. Looker dashboard'u `fct_marketing_performance` tablosuna bakıyorsa, bunu `exposures.yml`'de tanımlıyorsunuz:

```yaml
version: 2
exposures:
  - name: marketing_dashboard
    type: dashboard
    maturity: high
    owner:
      name: Growth Team
      email: growth@company.com
    depends_on:
      - ref('fct_marketing_performance')
      - ref('dim_customers')
    description: "Executive marketing dashboard — daily refresh, 90-day rolling window"
    url: https://looker.company.com/dashboards/123
```

Exposure tanımı olmadan `fct_marketing_performance` tablosunu değiştirdiğinizde hangi dashboard'un kırıldığını bilmiyorsunuz. dbt `run` sonrası Looker'da metrik sıfır çıkıyor, 2 saat debug ediyorsunuz. Exposure ile `dbt compile --select +exposure:marketing_dashboard` komutu upstream tüm modelleri gösteriyor, değişiklik öncesi impact analizi yapıyorsunuz.

Exposure sadece BI tool değil — reverse ETL (Hightouch, Census) da exposure. `customers` tablosunu Meta CAPI'ye gönderiyorsanız:

```yaml
exposures:
  - name: meta_capi_sync
    type: application
    maturity: high
    depends_on:
      - ref('dim_customers')
    description: "Meta Conversion API — incremental customer events, 5-minute delay"
```

Bu tanım "dim_customers tablosunu değiştirirsen Meta'ya giden event şeması kırılır" uyarısı veriyor. Production'da model update → CAPI sync error → attribution data kaybı zincirine karşı erken alarm.

## Production pipeline: Incremental builds ve test coverage

dbt production'da full refresh her gün çalıştırmıyor — incremental model kullanıyor. `fct_orders.sql` sadece son 3 günü reprocess ediyor:

```sql
{{ config(
    materialized='incremental',
    unique_key='order_id',
    partition_by={'field': 'order_date', 'data_type': 'date'},
    cluster_by=['customer_id', 'channel']
) }}

SELECT
  order_id,
  customer_id,
  order_date,
  order_amount,
  channel
FROM {{ ref('stg_shopify_orders') }}

{% if is_incremental() %}
WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY)
{% endif %}
```

Incremental build BigQuery maliyetini %90 düşürüyor — 2TB tablo yerine 50GB scan. Partition + cluster ile query performance artıyor: `WHERE customer_id = 'X'` sorgusu sadece ilgili cluster'a gidiyor, full scan yok.

Test coverage critical. dbt `schema.yml`'de her model için test yazıyorsunuz:

```yaml
models:
  - name: fct_orders
    columns:
      - name: order_id
        tests:
          - unique
          - not_null
      - name: order_amount
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"
      - name: order_date
        tests:
          - dbt_utils.recency:
              datepart: day
              interval: 7
```

`dbt test` komutu bu şartları BigQuery'de assert ediyor — order_amount negatif çıkarsa build fail oluyor. Production'da her commit CI/CD pipeline'da test ediliyor: `dbt run --select state:modified+ → dbt test --select state:modified+`. Modified model + downstream bağımlılıkları çalıştırıp test ediyor, sorun yoksa merge allowed.

## Orchestration: Airflow, Prefect, dbt Cloud

dbt kendi başına orchestrator değil — Airflow veya Prefect ile schedule ediliyor. Örnek Airflow DAG:

```python
from airflow.providers.google.cloud.operators.bigquery import BigQueryInsertJobOperator
from airflow.operators.bash import BashOperator

dbt_run = BashOperator(
    task_id='dbt_run',
    bash_command='cd /opt/dbt && dbt run --profiles-dir .',
    dag=dag
)

dbt_test = BashOperator(
    task_id='dbt_test',
    bash_command='cd /opt/dbt && dbt test',
    dag=dag
)

dbt_run >> dbt_test
```

dbt Cloud alternatif — managed orchestration, Web IDE, Slack alert. Ama çoğu enterprise Airflow tercih ediyor çünkü dbt dışında başka task'lar var: upstream API pull, downstream reverse ETL, snapshot tabloları.

Schedule stratejisi data freshness ile bağlı. GA4 event 24 saat gecikmeli (processing_date ≠ event_date), Meta Ads insight API real-time değil. Staging modelleri source freshness'a göre tetikleniyor — GA4 yeni partition gelince `stg_ga4_events` refresh oluyor, intermediate → mart zincirine yayılıyor. Airflow sensor operatörü BigQuery `_TABLE_SUFFIX` kontrol ediyor:

```python
wait_for_ga4 = BigQueryTableExistenceSensor(
    task_id='wait_for_ga4_partition',
    project_id='analytics_123456',
    dataset_id='events_',
    table_id=f"events_{yesterday.strftime('%Y%m%d')}",
    poke_interval=300
)
```

Partition hazır olunca dbt chain başlıyor. Bu pattern late-arriving data sorununu çözüyor — API gecikmesi pipeline'ı durdurmak yerine bekletiyor.

## Tradeoffs: dbt neyi çözmüyor

dbt transformation engine, data loader değil. BigQuery'e veriyi kim çekiyor? Fivetran, Airbyte, custom Python script. dbt source tanımında raw data'nın orada olduğunu varsayıyor. ELT pattern: Extract-Load-Transform. ETL'den farkı transform'un warehouse içinde olması. dbt bu T katmanı, EL ayrı toolchain.

dbt real-time streaming desteklemiyor. Kafka → BigQuery streaming insert → dbt incremental model chain dakikalık gecikme veriyor. Sub-second latency gereken use case'ler (fraud detection, dynamic pricing) için dbt yeterli değil — Flink, Spark Structured Streaming, Materialize gibi stream processor gerekiyor.

dbt Python model desteği (v1.3+) sınırlı. Pandas dataframe manipülasyonu yapabiliyorsunuz ama heavy ML training dbt'de yapılmıyor. Feature engineering dbt'de, model training Vertex AI'da, inference BigQuery ML'de pattern yaygın. dbt Python modeli şöyle:

```python
def model(dbt, session):
    df = dbt.ref('stg_orders').to_pandas()
    df['log_amount'] = np.log1p(df['order_amount'])
    return df
```

Ama bu sadece feature generation — scikit-learn model fit etmiyorsunuz. BigQuery compute pahalı, Python runtime overhead yüksek. Complex transformation SQL'de yazmak daha hızlı.

## Şimdi ne yapmalı

Eğer pazarlama datanız hala spreadsheet'lerde manual birleştiriliyorsa, ilk adım BigQuery'e raw data akışını kurmak. GA4 export, Meta/Google Ads API connector (Fivetran/Supermetrics), CRM webhook → BigQuery streaming insert. Raw data hazır olunca dbt repository açıyorsunuz: staging modelleri source mapping, intermediate modelleri sessionization/attribution, mart modelleri final KPI. İlk 2 hafta sadece `fct_sessions` ve `fct_orders` tablosu yeterli — dashboard'lar buraya bakıyor, metrikler stabilize oluyor. Semantic layer 3. haftada geliyor, exposure mapping 4. haftada. 6 hafta sonra production pipeline git-controlled, test-covered, incremental-optimized halde çalışıyor. Spreadsheet artık read-only archive.