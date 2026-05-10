---
title: "dbt + BigQuery ile Modern Pazarlama Data Stack"
description: "Source mapping, modeling layer, semantic layer, exposures — pazarlama datasını karar mekanizmasına bağlayan dört katman mimarisi."
publishedAt: 2026-05-10
modifiedAt: 2026-05-10
category: data
i18nKey: data-002-2026-05
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Pazarlama ekipleri her zamankinden fazla dataya ulaşıyor ama kararları yine tahmine dayalı. Spreadsheet'lerde birleştirilen raporlar, her dashboard'da farklı rakam veren metrikler, "gerçek CAC neydi" sorusuna üç farklı cevap. Sorun data eksikliği değil — source'dan insight'a giden yolda kayıp var. dbt + BigQuery kombinasyonu bu kaybı ortadan kaldıran mimariyi kuruyor: source mapping ile ham veriyi toplayıp, modeling layer ile iş mantığına çevirip, semantic layer ile ekip genelinde ortak dili yaratıp, exposures ile production kullanıma açıyorsunuz.

## Source Mapping: Ham Veriden Güvenilir Kaynağa

Source mapping dbt'nin ilk katmanı — pazarlama datasını BigQuery'ye çektiğiniz andan sonra yapılan ilk dönüşüm. Google Ads API'sinden, Meta Ads'ten, Shopify'dan gelen raw event'ler staging katmanında standartlaştırılıyor. `stg_google_ads__campaign_performance` modelinde 127 sütun var ama siz 12'sini kullanıyorsunuz. Source mapping bu 12'yi seçip, timestamp'leri UTC'ye çevirip, campaign_id'yi string'e cast edip, null'ları işleyip temiz bir tablo yaratıyor.

BigQuery'de source tanımı `sources.yml` dosyasında yapılıyor. Freshness check'leri burada tanımlıyorsunuz — Google Ads'ten veri son 2 saatte gelmemişse dbt run başarısız sayılıyor. Bu enforced contract: data pipeline'ı güvenli hale getiriyorsunuz. Source'tan direkt select yapmak yerine `{{ source('google_ads', 'campaign_stats') }}` macro'su kullanıyorsunuz — dbt lineage graph'ta hangi raw table'ın hangi modele beslendiğini gösteriyor.

```yaml
sources:
  - name: google_ads
    database: production
    schema: raw_google_ads
    tables:
      - name: campaign_stats
        freshness:
          warn_after: {count: 2, period: hour}
          error_after: {count: 6, period: hour}
        columns:
          - name: campaign_id
            tests:
              - not_null
              - unique
```

## Modeling Layer: İş Mantığını Kod Haline Getirmek

Staging'den sonra intermediate ve mart katmanları geliyor — burada pazarlama datasına iş mantığı uygulanıyor. `int_campaign_attribution` modelinde first-touch ve last-touch attribution'ı hesaplıyorsunuz. `fct_customer_lifetime_value` tablosunda cohort bazlı LTV analizi yapıyorsunuz. Bu modeller dbt'nin incremental materialization özelliğiyle çalışıyor — her run'da sadece son 3 günün verisi işleniyor, eski kayıtlar dokunulmuyor. BigQuery'de 40 milyon satır customer_event tablosu var ama dbt incremental stratejisiyle her run 2 dakika sürüyor.

Mart katmanında business unit'lere özel tablolar oluşturuyor: `mart_paid_media__daily_performance`, `mart_crm__email_engagement`, `mart_finance__revenue_attribution`. Bu tablolar Looker Studio, Tableau, Amplitude'e direkt bağlanıyor — herkes kendi alanındaki metriği aynı source'tan çekiyor. CAC hesabı artık tartışma konusu değil çünkü `paid_media_spend / new_customers` formülü dbt modelinde tanımlı. Kod review'dan geçiyor, test ediliyor, version control altında.

```sql
-- models/marts/paid_media/mart_paid_media__daily_performance.sql
{{ config(materialized='incremental', unique_key='date_campaign_id') }}

with campaign_spend as (
  select
    date,
    campaign_id,
    sum(cost_micros) / 1e6 as spend
  from {{ ref('stg_google_ads__campaign_performance') }}
  {% if is_incremental() %}
    where date >= date_sub(current_date(), interval 3 day)
  {% endif %}
  group by 1, 2
),

conversions as (
  select
    date(timestamp) as date,
    campaign_id,
    count(distinct user_id) as conversions
  from {{ ref('stg_ga4__conversions') }}
  {% if is_incremental() %}
    where date(timestamp) >= date_sub(current_date(), interval 3 day)
  {% endif %}
  group by 1, 2
)

select
  c.date,
  c.campaign_id,
  c.spend,
  coalesce(cv.conversions, 0) as conversions,
  safe_divide(c.spend, nullif(cv.conversions, 0)) as cpa
from campaign_spend c
left join conversions cv using (date, campaign_id)
```

## Semantic Layer: Ortak Dil Yaratmak

Semantic layer dbt'nin 1.6 versiyonuyla gelen özellik — metriği kod olarak tanımlıyorsunuz, her araç bu tanımı kullanıyor. `revenue` metriği `sum(order_total)` değil, `sum(case when payment_status = 'completed' then order_total end)` olarak tanımlanıyor. "İade edilen siparişler dahil mi" sorusu ortadan kalkıyor çünkü metrik tanımı GitHub'da duruyor. Marketing, finance, product ekipleri aynı `revenue` metriğini kullanıyor — sadece farklı dimension'larla kesiyor.

Roibase'in [first-party veri & ölçüm mimarisi](https://www.roibase.com.tr/tr/firstparty) çalışmalarında semantic layer zorunlu adım. Farklı touch point'lerden gelen customer event'lerini birleştirirken metrik tanımları sabitlenmezse her analiz farklı sonuç veriyor. dbt'de `metrics.yml` dosyasında tanımlanan metrikler BI tool'lara API üzerinden sunuluyor — Looker, Hex, Mode semantic layer'dan metrik çekiyor, her yerde aynı rakam görünüyor.

```yaml
# models/metrics/metrics.yml
metrics:
  - name: marketing_qualified_leads
    label: Marketing Qualified Leads
    model: ref('fct_leads')
    calculation_method: count_distinct
    expression: lead_id
    timestamp: created_at
    time_grains: [day, week, month]
    dimensions:
      - utm_source
      - utm_campaign
      - landing_page
    filters:
      - field: lead_status
        operator: '='
        value: "'MQL'"
```

## Exposures: Production'a Açmak

Exposures dbt'nin downstream dependency tracking özelliği — hangi dashboard'un hangi dbt modelinden besleneceğini tanımlıyorsunuz. Looker'da "Weekly Campaign Performance" dashboard'u var, `mart_paid_media__daily_performance` tablosundan veri çekiyor. dbt'de bu bağımlılık `exposures.yml` dosyasına yazılıyor. Şimdi `mart_paid_media__daily_performance` modelinde breaking change yaparsanız dbt size uyarı veriyor: "Bu model 3 dashboard tarafından kullanılıyor, impact analizi yap."

Exposure'lar documentation'da da görünüyor — dbt docs'ta bir modele tıkladığınızda "Used in 5 dashboards, 2 reverse ETL jobs, 1 ML pipeline" yazıyor. Data lineage'ı BI katmanına kadar uzanıyor. Production'da hangi dashboard'un hangi SQL'den geldiğini biliyorsunuz. Debug süresi düşüyor çünkü problem olan dashboard'u bulup source modele ulaşıyorsunuz.

| Exposure Tipi | Kullanım | Tracking Yöntemi |
|---|---|---|
| Dashboard | Looker, Tableau, Metabase | URL + model ref |
| Reverse ETL | Census, Hightouch | Job ID + source table |
| ML Pipeline | Vertex AI, SageMaker | Model name + feature table |
| Operational Tool | Braze, Iterable kampanya segmenti | Segment ID + dbt model |

## Pipeline Orchestration: Her Katmanın Çalışma Düzeni

dbt Cloud Scheduler veya Airflow ile pipeline'ı orchestrate ediyorsunuz. Sabah 6:00'da raw data BigQuery'ye yükleniyor (Fivetran, Stitch, Airbyte), 6:30'da dbt run başlıyor. Staging modelleri 5 dakikada, intermediate modelleri 10 dakikada, mart modelleri 15 dakikada tamamlanıyor. 7:00'de semantic layer expose ediliyor, 7:15'te Looker dashboard'ları refresh oluyor. Ekip 9:00'da ofise geldiğinde dünün datasını görüyor — 3 saat pipeline delay yok.

Test suite her run'da çalışıyor: `not_null`, `unique`, `accepted_values`, `relationships`. `stg_google_ads__campaign_performance` tablosunda `campaign_id` unique değilse dbt run başarısız sayılıyor. Slack'e alert düşüyor. Data quality gate'i kod seviyesinde enforce ediliyor. Production'a broken data ulaşmıyor.

```yaml
# dbt_project.yml on-run-end hooks
on-run-end:
  - "{{ log_dbt_results() }}"
  - "{{ send_slack_notification() }}"
  - "{{ update_looker_cache() }}"
```

## Tradeoff: Complexity vs Governance

dbt + BigQuery stack'i complexity getiriyor. Analyst ekibinde SQL bilgisi zorunlu hale geliyor — "Excel'de pivot yapayım" artık yetmiyor. Git workflow, code review, CI/CD pipeline öğrenilmesi gereken kavramlar. Küçük ekiplerde bu overhead maliyetli olabilir. Ama tradeoff net: governance kazanıyorsunuz. Spreadsheet'lerde kaybolmuş formül yerine version control altında kod var. "Bu rakam nereden geldi" sorusu Git blame ile 10 saniyede cevap buluyor.

BigQuery maliyeti başka tradeoff. Full table scan'ler pahalı — partition ve cluster stratejisi zorunlu. dbt incremental modellerde `partition_by` ve `cluster_by` config'leri kritik. Aylık 100 GB data işleyen pipeline BigQuery'de $50 slot cost + $5 storage maliyeti oluşturuyor. Managed service olduğu için infra overhead yok ama query optimization yapılmazsa fatura şişiyor.

Pazarlama datasını karar mekanizmasına bağlamak artık spreadsheet ve BI tool ile çözülemez. dbt + BigQuery stack'i source'dan exposure'a her katmanı kodlaştırıyor. Source mapping ile ham veriyi güvenilir hale getirip, modeling layer ile iş mantığını uygulayıp, semantic layer ile ortak dili yaratıp, exposures ile production kullanıma açıyorsunuz. Code review, test, version control — data pipeline artık yazılım geliştirme disipliniyle yönetiliyor.