---
title: "dbt + BigQuery ile Modern Pazarlama Data Stack"
description: "Source mapping, modeling layer, semantic layer, exposures: pazarlama datasını karar mekanizmasına dönüştüren production-ready mimari."
publishedAt: 2026-06-30
modifiedAt: 2026-06-30
category: data
i18nKey: data-002-2026-06
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Pazarlama ekipleri hâlâ Excel pivot'larla rapor üretiyor, data ekipleri her yeni soru için yeniden SQL yazıyor, KPI'lar departmanlar arasında uyuşmuyor. 2026'da bu senaryoya tahammül etmek mühendislik hatası. Modern pazarlama data stack'i üç katmanda çalışır: raw kaynak entegrasyonu, dönüştürme katmanı, anlam katmanı. dbt + BigQuery bu üç katmanı production-grade olarak sunar — version control, test coverage, lineage tracking dahil.

## Source Mapping: Raw Veriyi Güvenli Alana Taşımak

BigQuery'de pazarlama datasını merkezi warehouse'a çekmek kolay görünür: Fivetran, Stitch, Airbyte gibi ETL araçları GA4, Meta Ads, Google Ads'i doğrudan `raw_` şemasına yazar. Ama raw tablo 6 ay sonra schema değişikliği yapılınca downstream modeller patlıyor. dbt'nin **source tanımları** bu riski kontrol altına alır.

```yaml
# models/sources.yml
version: 2

sources:
  - name: ga4
    database: analytics_prod
    schema: raw_ga4
    tables:
      - name: events_*
        freshness:
          warn_after: {count: 6, period: hour}
          error_after: {count: 12, period: hour}
        loaded_at_field: event_timestamp
        columns:
          - name: event_name
            tests:
              - not_null
          - name: user_pseudo_id
            tests:
              - not_null
```

Source tanımı üç işlev görür: **(1)** Upstream değişikliklerde alarm (`freshness` metriği Slack'e düşer), **(2)** schema sözleşmesi (columns listesi documentation olarak görünür), **(3)** lineage tracking (dbt docs hangi modellerin GA4'e bağlı olduğunu gösterir). Fivetran şeması değiştiğinde dbt compile ederken hata alırsın — production'da patlamadan.

Source mapping aşamasında identity sinyallerini de etiketle: `user_id`, `client_id`, `fbclid`, `gclid`, `email_sha256`. İleriki modeling layer'da bu sinyalleri birleştirip tek `customer_id`'ye map edeceksin. Raw tabloda sinyalleri kaybetmek downstream'de imkansız hale gelir.

### Partitioned Table Stratejisi

GA4'ün `events_*` wildcard tablosu günlük partition'lıdır (`events_20260630`). dbt'de wildcard source tanımlayıp `_TABLE_SUFFIX` ile filter ekle:

```sql
-- models/staging/stg_ga4_events.sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'event_date', 'data_type': 'date'},
    cluster_by=['event_name', 'user_pseudo_id']
  )
}}

select
  parse_date('%Y%m%d', _table_suffix) as event_date,
  event_timestamp,
  event_name,
  user_pseudo_id,
  ...
from {{ source('ga4', 'events_*') }}
where _table_suffix >= format_date('%Y%m%d', date_sub(current_date(), interval 3 day))
{% if is_incremental() %}
  and parse_date('%Y%m%d', _table_suffix) > (select max(event_date) from {{ this }})
{% endif %}
```

Bu config BigQuery'de `stg_ga4_events` tablosunu günlük partition'larla yazar, `event_name` + `user_pseudo_id` cluster'ı query cost'u düşürür. Incremental materialization 90 günlük history scan'i 3 güne indirir — 30× maliyet düşüşü.

## Modeling Layer: İş Mantığını Kodla

Staging katmanı raw veriyi temizler, intermediate katmanı join mantığını kurar, mart katmanı iş sorularına cevap verir. dbt bu üç katmanı klasör yapısıyla ayrıştırır: `staging/`, `intermediate/`, `marts/`.

**Staging örneği** — Meta Ads sütunlarını standartlaştır:

```sql
-- models/staging/stg_meta_ads.sql
select
  date_start as report_date,
  campaign_id,
  campaign_name,
  spend as cost_usd,
  impressions,
  clicks,
  actions.value as conversions -- nested JSON'dan çek
from {{ source('meta_ads', 'ads_insights') }}
where date_start >= date_sub(current_date(), interval 90 day)
```

**Intermediate örneği** — Tüm paid media kaynaklarını birleştir:

```sql
-- models/intermediate/int_paid_media_unified.sql
with meta as (
  select report_date, campaign_id, 'meta' as source, cost_usd, impressions, clicks, conversions
  from {{ ref('stg_meta_ads') }}
),
google as (
  select report_date, campaign_id, 'google' as source, cost_usd, impressions, clicks, conversions
  from {{ ref('stg_google_ads') }}
)

select * from meta
union all
select * from google
```

**Mart örneği** — Günlük performance dashboard:

```sql
-- models/marts/fct_daily_performance.sql
select
  report_date,
  source,
  sum(cost_usd) as total_cost,
  sum(impressions) as total_impressions,
  sum(clicks) as total_clicks,
  sum(conversions) as total_conversions,
  safe_divide(sum(clicks), sum(impressions)) as ctr,
  safe_divide(sum(cost_usd), sum(conversions)) as cpa
from {{ ref('int_paid_media_unified') }}
group by 1, 2
```

`ref()` fonksiyonu dbt'nin dependency graph'ını kurar. `dbt run` komutu dependency order'a göre modelleri çalıştırır. `int_paid_media_unified` değişirse downstream'deki tüm mart tabloları otomatik yeniden build edilir.

### Test Coverage

Production'da hatalı KPI raporu vermek e-commerce'de 6 haneli hata demektir. dbt'nin generic testleri her model'e sözleşme ekler:

```yaml
# models/marts/schema.yml
version: 2

models:
  - name: fct_daily_performance
    columns:
      - name: report_date
        tests:
          - not_null
          - unique
      - name: total_cost
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"
      - name: cpa
        tests:
          - dbt_utils.expression_is_true:
              expression: "is null or cpa >= 0"
```

`dbt test` komutu bu kontratları doğrular. CI/CD pipeline'da test fail ederse merge block'lanır — hatalı data production'a çıkmaz. Roibase'in [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) çalışmasında test coverage %85 hedefliyoruz (satır sayısı × kritik field'ler metriğiyle).

## Semantic Layer: Metriği Tek Yerde Tanımla

2025 sonunda dbt Labs "MetricFlow" semantic layer'ını dbt Cloud'a entegre etti. Pazarlama ekibi "conversion rate" metriğini istediğinde data ekibi yeniden SQL yazmamalı — metrik tanımı tek yerde olmalı. dbt'nin `metrics.yml` dosyası bu abstraction'ı sunar:

```yaml
# models/metrics.yml
version: 2

metrics:
  - name: conversion_rate
    label: Conversion Rate
    model: ref('fct_daily_performance')
    calculation_method: derived
    expression: "safe_divide(total_conversions, total_clicks)"
    timestamp: report_date
    time_grains: [day, week, month]
    dimensions:
      - source

  - name: cpa
    label: Cost Per Acquisition
    model: ref('fct_daily_performance')
    calculation_method: derived
    expression: "safe_divide(total_cost, total_conversions)"
    timestamp: report_date
    time_grains: [day, week, month]
    dimensions:
      - source
```

Semantic layer iki işlev görür: **(1)** BI tool'da metrik seçildiğinde SQL otomatik generate edilir (Looker, Tableau, Power BI entegrasyonu), **(2)** metrik değiştiğinde tüm dashboard'lar tutarlı kalır. "CPA hesaplamasına shipping cost eklenmeli" kararı alındığında tek satır değişir — 40 dashboard tek seferde güncellenir.

MetricFlow henüz beta'da (Haziran 2026 itibariyle) ama production'da kullanılabilir. Alternatif: dbt'de makro ile custom metric function'ları yaz:

```sql
-- macros/calculate_cpa.sql
{% macro calculate_cpa(cost_column, conversion_column) %}
  safe_divide({{ cost_column }}, nullif({{ conversion_column }}, 0))
{% endmacro %}
```

Tüm mart modellerinde `{{ calculate_cpa('total_cost', 'total_conversions') }}` çağrısı yaparsın — metrik değişikliği tek yerden yayılır.

## Exposures: Modeli BI Dashboard'a Bağla

dbt'nin `exposures.yml` dosyası hangi modelin hangi dashboard'da kullanıldığını takip eder. Bu tracking operasyonel — model değiştiğinde hangi dashboard'ların test edilmesi gerektiğini bilirsin:

```yaml
# models/exposures.yml
version: 2

exposures:
  - name: executive_performance_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: "Daily paid media performance for C-level"
    depends_on:
      - ref('fct_daily_performance')
      - ref('fct_campaign_performance')
    owner:
      name: Growth Team
      email: growth@company.com

  - name: weekly_marketing_review
    type: analysis
    maturity: medium
    url: https://docs.google.com/spreadsheets/d/xyz789
    description: "Weekly deep-dive into channel mix"
    depends_on:
      - ref('fct_daily_performance')
    owner:
      name: Marketing Ops
      email: mops@company.com
```

Exposure lineage graph'da görünür: `dbt docs generate` sonrası web UI'de `fct_daily_performance` node'una tıklayınca hangi dashboard'ların ona bağlı olduğunu görürsün. Model'e breaking change yapacaksan exposure owner'larına otomatik notify gönderebilirsin (Slack webhook ile).

### Production Deployment Pattern

dbt Cloud production job'ları şu sırada çalışır:

1. **Source freshness check** — `dbt source freshness` (upstream data gecikirse fail)
2. **Model run** — `dbt run --select tag:daily` (günlük modeller 07:00'de build edilir)
3. **Test execution** — `dbt test` (kontrat ihlali varsa rollback)
4. **Documentation update** — `dbt docs generate` (lineage graph güncellenir)

BigQuery scheduled query yerine dbt job kullanmanın avantajı: version control (her deploy git commit'e bağlı), rollback capability (hatalı model 5 dakikada eski versiyona döner), Slack alert (test fail + freshness warning).

## Tradeoff: ELT mi, Reverse ETL mi

dbt + BigQuery stack'i ELT (extract-load-transform) pattern'ıdır — raw data önce warehouse'a çekilir, dönüştürme BigQuery'de olur. Alternatif: reverse ETL (Hightouch, Census) — warehouse'dan SaaS tool'a data push'lanır. İkisi birbirini tamamlar: dbt warehouse'ı temizler, reverse ETL Braze/Iterable'a segment gönderir.

Tradeoff: BigQuery compute cost. 1 TB scan $5 — kompleks mart modeli günde 10 kez çalışırsa $50/gün = $1500/ay. Optimizasyon: incremental materialization + partition pruning + clustering. Roibase projelerinde BigQuery cost hedefi: monthly active user başına $0.02 — 1M MAU = $20K/yıl (kabul edilebilir).

Pazarlama data stack'i tek seferlik proje değil — evolving architecture. dbt + BigQuery foundation'ı kurduktan sonra MMM (marketing mix modeling), incrementality test, identity resolution katmanları eklenebilir. Bu temeli production-grade kurmak 6-8 hafta sürer ama downstream'de 18 ay kazandırır — her yeni KPI sorusu 2 saatte cevaplanır, manuel veri cleaning ortadan kalkar, attribution model değişikliği 1 gün değil 1 saat sürer. Stack'i doğru kurman pazarlama datasını karar mekanizmasına dönüştürür.