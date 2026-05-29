---
title: "dbt + BigQuery ile Modern Pazarlama Data Stack"
description: "Source mapping, modeling layer, semantic layer, exposures: dbt ve BigQuery ile pazarlama datasını karar mekanizmasına bağlayan production-ready mimari."
publishedAt: 2026-05-29
modifiedAt: 2026-05-29
category: data
i18nKey: data-002-2026-05
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Pazarlama ekipleri hâlâ "kampanya performansını dashboard'a bakmadan bilemiyorum" cümlesini kuruyor. Analist, her soruda yeni bir SQL yazıyor. CFO, CAC hesabının neden her raporda farklı olduğunu anlayamıyor. Sorun teknik değil — data pipeline'ı var, kaynak bağlı, veri akıyor. Sorun mimaride: kaynak tablolardan dashboard'a giden yolda tanım katmanı yok. dbt + BigQuery kombinasyonu bu sorunu çözüyor: source mapping, modeling layer, semantic layer, exposures ile datayı görsel değil, mantık katmanında standardize ediyorsun.

## Source Mapping: Ham Veriyi Kontrata Bağlamak

BigQuery'ye akan data CRM'den, GA4'ten, Meta Ads'ten, Klaviyo'dan geliyor. Her kaynak farklı şema, farklı naming convention, farklı timestamp formatı kullanıyor. dbt source mapping, bu kaynakları kod olarak tanımlayıp test etmeni sağlıyor. `sources.yml` dosyasında her tabloyu declare ediyorsun, freshness kontrolü koyuyorsun, unique constraint test ediyorsun.

Örnek source tanımı:

```yaml
version: 2

sources:
  - name: raw_ga4
    database: analytics_lake
    schema: raw_ga4_events
    tables:
      - name: events
        freshness:
          warn_after: {count: 6, period: hour}
          error_after: {count: 12, period: hour}
        columns:
          - name: event_timestamp
            tests:
              - not_null
          - name: user_pseudo_id
            tests:
              - not_null
```

Bu tanım şu kontratı kuruyor: "GA4 eventi 6 saatte gelmezse uyar, 12 saatte gelmezse fail yap." Production'da bu test CI/CD'ye bağlanır, kaynak sorununu anında tespit edersin. dbt docs ile otomatik lineage graph üretiliyor — hangi dashboard'un hangi source'a bağlı olduğunu görebiliyorsun.

Source mapping olmadan analyst, `SELECT * FROM analytics_lake.raw_ga4_events.events` diye başlar. Hangi kolonun ne anlama geldiğini bilmez, test yok, belge yok. dbt ile source'u referans alıyorsun: `{{ source('raw_ga4', 'events') }}`. Tablo adı değişirse tek yerde güncelliyorsun, tüm downstream modeller otomatik uyuyor.

## Modeling Layer: Staging, Intermediate, Mart

dbt'nin gücü modelleme katmanlarında. Üç seviyeye ayırıyorsun: staging (kaynak versiyon formatını normalize et), intermediate (iş mantığı uygula), mart (nihai metrik tabloları).

**Staging layer:** Her source için 1:1 model. Sadece veri tipi dönüşümü, kolon isimlendirme, timestamp UTC'ye çekme. İş mantığı YOK.

```sql
-- models/staging/stg_ga4__events.sql
WITH source AS (
    SELECT * FROM {{ source('raw_ga4', 'events') }}
)

SELECT
    TIMESTAMP_MICROS(event_timestamp) AS event_at,
    user_pseudo_id AS user_id,
    event_name,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_url
FROM source
WHERE event_date >= CURRENT_DATE() - 90
```

**Intermediate layer:** İş mantığını uygula. Session tanımla, ürün kategorilerini map et, attribution penceresini uygula. Bu modeller final kullanıcıya gitmez — sadece downstream modellere girdi sağlar.

```sql
-- models/intermediate/int_sessions.sql
WITH events AS (
    SELECT * FROM {{ ref('stg_ga4__events') }}
),

session_windows AS (
    SELECT
        user_id,
        event_at,
        SUM(CASE WHEN TIMESTAMP_DIFF(event_at, LAG(event_at) OVER (PARTITION BY user_id ORDER BY event_at), MINUTE) > 30 THEN 1 ELSE 0 END) 
            OVER (PARTITION BY user_id ORDER BY event_at) AS session_index
    FROM events
)

SELECT
    user_id,
    session_index,
    MIN(event_at) AS session_start_at,
    MAX(event_at) AS session_end_at,
    COUNT(*) AS event_count
FROM session_windows
GROUP BY 1, 2
```

**Mart layer:** Nihai metrik tabloları. Dashboard'a, BI tool'a, Looker'a bağlanacak tablo. `fct_` (fact) veya `dim_` (dimension) prefix kullan.

```sql
-- models/marts/fct_daily_channel_performance.sql
SELECT
    DATE(session_start_at) AS date,
    traffic_source.medium AS channel,
    COUNT(DISTINCT user_id) AS users,
    SUM(revenue) AS revenue,
    SAFE_DIVIDE(SUM(revenue), COUNT(DISTINCT user_id)) AS revenue_per_user
FROM {{ ref('int_sessions') }}
LEFT JOIN {{ ref('int_transactions') }} USING (user_id, session_index)
GROUP BY 1, 2
```

Bu yapı ile analist `fct_daily_channel_performance` tablosunu kullanır, staging/intermediate mantığına dokunmaz. Metrik tanımı değişirse tek yerde güncellenir, tüm dashboard'lar tutarlı kalır.

## Semantic Layer: Metrik Tanımlarını Kodla

BigQuery + dbt kombinasyonunda "semantic layer" kavramı iki şekilde uygulanır: dbt metrics (deprecated 2023'te) veya dbt semantic models (yeni yaklaşım). Semantic model, metriği SQL'den soyutlayıp YAML'da tanımlar. Looker, Tableau, Mode gibi araçlar bu tanımı okur, CAC, LTV, ROAS gibi metrikleri tutarlı hesaplar.

Örnek semantic model:

```yaml
# models/marts/semantic_models.yml
semantic_models:
  - name: channel_performance
    model: ref('fct_daily_channel_performance')
    dimensions:
      - name: date
        type: time
        type_params:
          time_granularity: day
      - name: channel
        type: categorical
    measures:
      - name: total_revenue
        agg: sum
        expr: revenue
      - name: total_users
        agg: count_distinct
        expr: user_id

metrics:
  - name: revenue_per_user
    type: derived
    type_params:
      expr: total_revenue / total_users
      metrics:
        - total_revenue
        - total_users
```

Bu tanım ile "revenue per user" metriki her yerde aynı hesaplanır. Analist Looker'da "RPU" seçer, backend dbt semantic layer'dan çeker, SQL el ile yazılmaz. Tanım değişirse (örneğin canceled orders hariç tutulacak) tek yerde güncellenir.

Semantic layer olmadan her dashboard "revenue / users" hesabını tekrar yazıyor. Bir raporda refund hariç, diğerinde dahil. CMO iki farklı sayı görür, güveni kaybolur. [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) ile bu katmanı production'a kurmak kritik — attribution, consent, TCF sinyallerini de aynı mantıkla tanımlıyorsun.

## Exposures: Datanın Nihai Kullanım Noktalarını İzle

dbt exposure, "bu model hangi dashboard'a, hangi ML pipeline'a, hangi operasyonel sisteme gidiyor" sorusunu cevaplıyor. `exposures.yml` dosyasında tanımlıyorsun:

```yaml
exposures:
  - name: marketing_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: "CMO günlük channel performance dashboard"
    depends_on:
      - ref('fct_daily_channel_performance')
    owner:
      name: Marketing Analytics Team
      email: analytics@company.com
```

Exposure tanımı iki şey sağlar: **impact analysis** (bu modeli değiştirirsem hangi dashboard bozulur?) ve **stakeholder mapping** (dashboard sahibi kim, sorunu kime escalate edeceğim?).

Production'da exposures şu akışta çalışır: dbt build → test fail olursa → lineage graph'tan etkilenen exposure'ları gör → Slack'e otomatik bildirim gönder → dashboard sahibi erken uyarılır. Bu sayede "dashboard neden boş?" sorusu kullanıcıdan değil, CI/CD sisteminden gelir.

Exposures olmadan data team körleme model deploy eder, kimin etkilendiğini bilmez. Exposure ile her model "bu tablo production'da canlı, dokunma" etiketini taşır.

## Incremental Models ve Partitioning: Maliyet + Performans

BigQuery'de tam table scan pahalı. 1 TB veri için query $5, günde 10 query $50, ayda $1500. dbt incremental model ile sadece yeni satırları işliyorsun, geçmiş data immutable kalıyor.

```sql
{{ config(
    materialized='incremental',
    unique_key='event_id',
    partition_by={'field': 'event_at', 'data_type': 'timestamp', 'granularity': 'day'},
    cluster_by=['user_id', 'event_name']
) }}

SELECT * FROM {{ ref('stg_ga4__events') }}
WHERE event_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 DAY)

{% if is_incremental() %}
    AND event_at > (SELECT MAX(event_at) FROM {{ this }})
{% endif %}
```

Bu config şu optimizasyonu yapıyor: Her run'da sadece son 2 günü işle, eski data dokunulmaz. `partition_by` ile BigQuery partition pruning uygular, `cluster_by` ile query selectivity artar. Aynı veri setinde maliyeti %90 düşürür.

Production'da incremental model + dbt snapshot ile SCD Type 2 uygulanır: dimension table'da tarihsel değişimi izlersin (user segment değişimi, product category mapping değişimi). Analist "geçen ay user X hangi segmentte idi" diye sorduğunda snapshot'tan çeker, data tutarlı.

## Production Pipeline: CI/CD, Tests, Alerts

dbt projesi GitHub'da tutuluyor, her commit CI pipeline'ını tetikliyor:

1. **Lint:** `sqlfluff` ile SQL formatını kontrol et
2. **Test:** `dbt test` ile schema test (not_null, unique, foreign_key) ve data test (revenue > 0, session_duration < 24h) çalıştır
3. **Build:** `dbt build --select state:modified+` ile sadece değişen modelleri rebuild et
4. **Deploy:** Production'a merge olursa BigQuery'de tablo güncelle

Test fail olursa merge bloklenir. Örnek data test:

```sql
-- tests/assert_no_negative_revenue.sql
SELECT * FROM {{ ref('fct_daily_channel_performance') }}
WHERE revenue < 0
```

Bu test 0 satır dönerse pass, 1 satır dönerse fail. Production'da negatif revenue anomali olarak algılanır, pipeline durur.

Alert senaryosu: dbt Cloud'da job schedule et (her gün 06:00), `on-run-end` hook ile Slack'e bildirim gönder:

```yaml
on-run-end:
  - "{{ post_to_slack_on_failure() }}"
```

[Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) ile bu pipeline'ı production'a kurmak 4-6 hafta sürüyor: source mapping + staging layer + intermediate layer + mart + semantic model + exposure + test + CI/CD.

## Tradeoff: Complexity vs Control

dbt + BigQuery stack öğrenme eğrisi dik. SQL bilgisi yetmez, Jinja templating, YAML config, Git workflow, CI/CD gerekiyor. Küçük ekiplerde (1-2 kişi) bu overhead fazla gelebilir — doğrudan BigQuery view'ları + Looker Studio daha hızlı başlatır.

Ama ölçek büyüdüğünde (10+ dashboard, 50+ source, 5+ analyst) dbt olmadan kontrol kaybedilir. Her analyst kendi SQL'ini yazıyor, metrik tanımları çelişiyor, test yok, belge yok. dbt bu noktada teknik borç ödemek yerine borç almamayı sağlıyor.

Alternatif yaklaşım: Looker LookML ile semantic layer kurmak. LookML dbt'ye benzer (kod olarak metrik tanımı) ama vendor lock-in var, BigQuery dışı source'lara bağlanmak zor. dbt açık kaynak, portable, BigQuery/Snowflake/Redshift arasında taşınabilir.

Modern pazarlama data stack source mapping ile başlar, semantic layer ile ölçeklendirilir, exposure ile production'da izlenir. dbt + BigQuery bu üç katmanı kod olarak tanımlar, test edilebilir, versiyonlanabilir, tekrarlanabilir hale getirir. Dashboard'a bakmadan metrik tutarlılığını garanti ediyorsun.