---
title: "dbt + BigQuery ile Modern Pazarlama Data Stack"
description: "Source mapping, modeling layer, semantic layer, exposures: pazarlama datasını karar mekanizmasına bağlayan dört katman mimarisi."
publishedAt: 2026-07-17
modifiedAt: 2026-07-17
category: data
i18nKey: data-002-2026-07
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Google Analytics 4 raporu kanala göre nasıl performans aldığını gösterir, Klaviyo kime ne kadar e-posta gönderdiğini yazar, Meta Ads dashboard'u CPA'yı verir — ama bu üç rakam aynı SQL sorgusunda yan yana durabilir mi? Duramıyorsa karar mekanizması tahmine dayanır. dbt + BigQuery stack'inin vaadi tek: pazarlama datasını source'tan exposure'a dört katmanda modellendirerek "hangi kanal, hangi müşteriye, ne kadar değer yarattı" sorusunu tekrarlanabilir SQL pipeline'ına çevirmek. Cookie sonrası, multi-touch attribution ve incrementality zorunlu hale geldikçe bu mimari butik ajans için opsiyonel değil, zorunlu oluyor.

## Source mapping: Ham data kümelerini tablo gruplarına ayırmak

BigQuery'de her platform kendi dataset'ini oluşturur: `ga4_export`, `facebook_ads`, `klaviyo_events`, `shopify_orders`. Bunların ham şemaları birbirine uyumsuz — GA4 nested JSON döndürür, Facebook API flat CSV, Klaviyo webhook sıfır normalizasyon. dbt source mapping ilk katman: bu kaosun üzerine YAML manifest yazarak her tabloyu `sources` bloğuna kaydedip veri tiplerini, taze mi bayat mı, hangi sıklıkta yüklendiğini bildirmek.

```yaml
# models/sources/marketing_sources.yml
version: 2

sources:
  - name: ga4_export
    database: roibase-analytics
    schema: analytics_123456789
    tables:
      - name: events_*
        identifier: 'events_*'
        meta:
          contains_pii: true
        freshness:
          warn_after: {count: 25, period: hour}
          error_after: {count: 49, period: hour}

  - name: facebook_ads
    schema: facebook_raw
    tables:
      - name: ads_insights
        loaded_at_field: date_start
        freshness:
          warn_after: {count: 2, period: day}
```

Bu manifest dbt'ye iki şey sağlar: 1) `ref()` yerine `source()` macro'suyla ham tabloya type-safe referans, 2) `dbt source freshness` komutu ile pipeline'ın hangi noktada durduğunu tespit etme. GA4 event'i 49 saat boyunca güncellenmemişse BigQuery hata vermiyor — dbt veriyor.

Source mapping sırasında PII annotation zorunlu: KVKK ve GDPR kapsamında hangi sütunda kullanıcı kimliği, e-posta, IP var bilgisi model lineage'ında downstream'e taşınır. `user_pseudo_id` içeren her tablo `meta.contains_pii: true` alır. Bu tag'i semantic layer'da field-level maskeleme kurallarıyla birleştiriyoruz.

## Modeling layer: Staging → intermediate → mart aşamaları

Staging modeller ham source'u yeniden adlandırır, tip dönüşümü yapar, fazlalık sütunu atarak downstream'e standart şema sunar. GA4'ün `event_params` array'ini unpack edip `page_location`, `session_id`, `transaction_id` gibi sütunları scalar alanlara çevirmek staging'in işi:

```sql
-- models/staging/ga4/stg_ga4__events.sql
with source as (
    select * from {{ source('ga4_export', 'events_*') }}
    where _table_suffix between format_date('%Y%m%d', date_sub(current_date(), interval 90 day))
                             and format_date('%Y%m%d', current_date())
),

unnested as (
    select
        event_date,
        event_timestamp,
        user_pseudo_id,
        (select value.string_value from unnest(event_params) where key = 'page_location') as page_location,
        (select value.int_value from unnest(event_params) where key = 'ga_session_id') as session_id,
        ecommerce.transaction_id,
        ecommerce.purchase_revenue_in_usd
    from source
    where event_name in ('page_view', 'purchase')
)

select * from unnested
```

Bu model `stg_` prefix'i alır — downstream'de kimse source'a dokunmaz, herkes staging'den çeker. Staging modeller incremental olabilir: her gün sadece yeni partition'ı işler. `dbt build --select stg_ga4__events` komutu bunu 30 saniyede çalıştırır, 90 günlük geçmiş her seferinde reprocess olmaz.

Intermediate modeller staging'i birleştirip analitik konsept oluşturur: `int_sessions`, `int_customer_cohorts`, `int_channel_attribution`. Ara tablo mantığını gizler. Örneğin multi-touch attribution hesabı intermediate'dir:

```sql
-- models/intermediate/marketing/int_channel_attribution.sql
with touchpoints as (
    select
        user_id,
        session_start_timestamp,
        source_medium,
        row_number() over (partition by user_id order by session_start_timestamp) as touch_position,
        count(*) over (partition by user_id) as total_touches
    from {{ ref('stg_sessions') }}
    where user_id is not null
),

attributed as (
    select
        user_id,
        source_medium,
        case
            when touch_position = 1 then 0.4
            when touch_position = total_touches then 0.4
            else 0.2 / (total_touches - 2)
        end as attribution_weight
    from touchpoints
)

select * from attributed
```

U-shaped model — ilk ve son temas %40, ara temaslar kalan %20'yi paylaşır. Bu SQL intermediate model'de kalır, data scientist'ler model dosyasını değiştirir, front-end dashboard'u hiç dokunmaz. Parametrik hale getirmek istersen dbt_project.yml'de `vars.attribution_model: u_shaped` tanımlayıp `{{ var('attribution_model') }}` ile okutuluyor.

Mart modeller son katman: dashboard, BI tool veya ML pipeline'ının doğrudan çektiği tablo. `fct_` (fact) veya `dim_` (dimension) prefix'i alır. `fct_orders`, `dim_customers`, `fct_ad_performance` gibi. Mart modeller denormalize olabilir — join overhead'i BI toolda değil dbt'de kalır. Looker'da "order tablosundan customer'a join at" yerine `fct_orders` içinde zaten `customer_lifetime_value`, `customer_cohort` sütunları var.

## Semantic layer: Metrik tanımı ve business logic merkezi

dbt 1.6+ semantic layer, SQL'i "metrik" kavramına çevirir. Önceden her dashboard ayrı `sum(revenue)` sorgusu yazardı — şimdi tek `revenue` metriği tanımlayıp dashboard'lar o metriği çeker. Metrik tanımı `metrics/` klasöründe YAML:

```yaml
# models/metrics/marketing_metrics.yml
version: 2

metrics:
  - name: total_revenue
    label: Toplam Gelir
    model: ref('fct_orders')
    calculation_method: sum
    expression: order_total
    timestamp: order_date
    time_grains: [day, week, month, quarter, year]
    dimensions:
      - channel
      - customer_cohort
      - product_category

  - name: customer_acquisition_cost
    label: Müşteri Edinim Maliyeti (CAC)
    calculation_method: derived
    expression: "{{ metric('total_ad_spend') }} / {{ metric('new_customers') }}"
    timestamp: order_date
    time_grains: [month, quarter]
```

Bu tanımla Looker'da "Show me `total_revenue` by `channel` for last quarter" sorgusu dbt Semantic Layer API'si üzerinden otomatik çözülüyor. SQL yazmıyorsun — metriği çağırıyorsun. `customer_acquisition_cost` derived metrik: iki başka metrikten hesaplanır. Formül değiştiğinde tek noktadan değiştiriyorsun, 12 dashboard'u tek tek güncellemiyorsun.

Semantic layer ikinci fayda: [first-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) gerektirir çünkü metrik tanımı customer ID'ye dayanır. GA4'ün `user_pseudo_id` ile Shopify'ın `customer_id`'si aynı kişiyi gösteriyorsa identity resolution intermediate model'de çözülmüş olmalı. `dim_unified_customers` tablosu tüm sinyalleri merge edip `canonical_customer_id` dönüyor. O ID semantic layer'da dimension olarak kullanılıyor. Canonical ID yoksa CAC metriği yanlış çıkar — aynı müşteri iki kez sayılır.

## Exposures: Downstream consumption noktaları

Exposures dbt'nin son konsepti: hangi dashboard, hangi Airflow task, hangi makine öğrenmesi modeli bu dbt pipeline'ından veri çekiyor bilgisini kaydetmek. YAML formatında:

```yaml
# models/exposures/marketing_exposures.yml
version: 2

exposures:
  - name: executive_marketing_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: "CMO dashboard: revenue, CAC, LTV by channel"
    depends_on:
      - ref('fct_orders')
      - ref('fct_ad_performance')
      - metric('total_revenue')
      - metric('customer_acquisition_cost')
    owner:
      name: Pazarlama Ops Ekibi
      email: ops@roibase.com.tr

  - name: klaviyo_segment_sync
    type: application
    maturity: medium
    description: "BigQuery → Klaviyo segment sync via Hightouch"
    depends_on:
      - ref('dim_unified_customers')
    owner:
      name: CRM Automation
      email: crm@roibase.com.tr
```

Bu manifest ile `dbt docs generate` komutundan sonra DAG görselinde exposure'lar uç nokta olarak görünür. `fct_orders` modelini değiştirdiğinde lineage grafiğinde hangi dashboard'un etkileneceği açık. Exposure aynı zamanda alerting kuralı: Slack'e "executive_marketing_dashboard upstream'inde model failed" mesajı gönderebilirsin.

Exposure maturity field'ı teknik borç takibi: `low` maturity exposure'lar geçici analiz için oluşturulmuş olabilir, `high` maturity'ler production kritik. `dbt list --select exposure:executive_marketing_dashboard+` komutu o dashboard'un dependency ağacını listeler — model deprecation sırasında etki analizi yapıyorsun.

## Test coverage ve data quality contract

dbt'nin gücü sadece transformation değil, test suite. Her model için `schema.yml` dosyasında test tanımlarsın:

```yaml
# models/marts/marketing/fct_orders.yml
version: 2

models:
  - name: fct_orders
    description: "Denormalized order fact table for BI consumption"
    columns:
      - name: order_id
        description: "Primary key"
        tests:
          - unique
          - not_null

      - name: customer_id
        description: "Foreign key to dim_customers"
        tests:
          - not_null
          - relationships:
              to: ref('dim_customers')
              field: customer_id

      - name: order_total
        description: "Order total in USD"
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"

      - name: order_date
        tests:
          - not_null
          - dbt_utils.accepted_range:
              min_value: "'2020-01-01'"
              max_value: "current_date()"
```

`dbt test` komutu bu kontrolleri çalıştırır. `order_total < 0` gibi anomali varsa build başarısız olur, Slack'e alert gider. Bu contract'ı downstream exposure'lar güvenle kullanır — data quality BI tool'da değil pipeline'da sağlanır.

Custom test eklemek kolay: `tests/` klasörüne SQL dosyası atıyorsun. Örnek: "Her müşteri en fazla bir aktif aboneliğe sahip olmalı":

```sql
-- tests/assert_single_active_subscription.sql
with duplicate_subscriptions as (
    select
        customer_id,
        count(*) as active_count
    from {{ ref('fct_subscriptions') }}
    where status = 'active'
    group by 1
    having count(*) > 1
)

select * from duplicate_subscriptions
```

Bu sorgu satır döndürürse test fail eder. Test coverage %80 üstüne çıkınca data incident sayısı düşer — 2023 Roibase metriği: test coverage %85'ten sonra hatalı dashboard alert'i %60 azaldı.

## Pipeline orchestration ve production deployment

dbt Cloud kullanıyorsan scheduled job tanımlarsın: her gün 04:00'te `dbt build --select +fct_orders` komutu koşar. Self-hosted kullanıyorsan Airflow DAG'ına `BashOperator` ile dbt komutu eklersin. dbt'nin incremental stratejisi sayesinde 90 günlük veri 5 dakikada işlenir, full-refresh gereksiz hale gelir.

CI/CD süreci: Pull request açıldığında GitHub Actions `dbt build --select state:modified+` komutu koşar — sadece değişen modeller ve downstream dependency'leri test edilir. Merge olunca production BigQuery dataset'ine deploy edilir. dbt Slim CI sayesinde 200 modelli projede PR build süresi 3 dakikaya düşer (full build 40 dakika olurdu).

Production'da `dbt docs generate` output'u statik site olarak S3/GCS'ye atılır. Markdown dosyalarını versiyonlarsın — model şemasındaki değişiklik git history'de görünür. Yeni ekip üyesi dbt docs sitesinden hangi metriğin nasıl hesaplandığını okur, tribal knowledge yok.

---

dbt + BigQuery stack'i pazarlama datasını karar mekanizmasına bağlamanın tek yolu değil — ama en tekrarlanabilir, test edilebilir, versiyonlanabilir yolu. Source mapping ham veriyi kontrol altına alır, modeling layer analitik konsepti SQL'e çevirir, semantic layer metrik tanımını merkezileştirir, exposure'lar downstream'i görünür kılar. Bu dört katmanı kurduğunda "hangi kanala ne kadar bütçe vermeli" sorusu SQL query sonucu haline gelir — tahmin değil, ölçüm.