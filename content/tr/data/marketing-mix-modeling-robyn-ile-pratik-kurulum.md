---
title: "Marketing Mix Modeling: Robyn ile Pratik Kurulum"
description: "Meta'nın Robyn framework'ünde saturasyon eğrisi, adstock decay ve holdout validation ile attribution modeli kurmak. SQL, R ve production pipeline."
publishedAt: 2026-06-21
modifiedAt: 2026-06-21
category: data
i18nKey: data-005-2026-06
tags: [marketing-mix-modeling, robyn, adstock, attribution, mmm]
readingTime: 8
author: Roibase
---

Cookie deprecation ve privacy regülasyonları attribution'ı deterministik yöntemden olasılıksal modellemeye kaydırıyor. Marketing Mix Modeling (MMM) — 1960'ların istatistik aracı — tekrar merkezde. Meta'nın açık kaynak Robyn framework'ü bu dönüşümün pratik ayağını sağlıyor: Bayesian çıkarım, saturasyon eğrisi ve adstock decay ile haftalık pazarlama harcamasını satışa bağlayan regresyon modelini production'a taşıyorsun. Bu yazı Robyn'i kurarak gerçek veriye model oturtmayı, hyperparameter grid search'ünü ve holdout validation ile overfitting'i nasıl engellediğini gösteriyor.

## Robyn nedir ve klasik regresyondan farkı

Robyn, R üzerine yazılmış açık kaynak bir MMM framework'ü. Meta, kendi pazarlama ekibi için 2020'de geliştirmiş ve 2021'de release etmiş. Klasik lineer regresyon ile farkları:

**Adstock transformasyonu**: Pazarlama etkisi anlık değil — TV reklamı haftalarca zihin payı taşır. Adstock, geçmiş harcamanın bugünkü satışa katkısını exponential decay ile modelliyor. Robyn, geometric ve Weibull adstock fonksiyonunu destekliyor. Geometric basit: `adstock_t = spend_t + θ × adstock_(t-1)`, θ decay parametresi. Weibull daha esnek — peak effect'i gecikmeli konumlandırabiliyorsun.

**Saturasyon (diminishing returns)**: Harcama-satış ilişkisi lineer değil. İlk 100 bin TL %80 ROI getirirken ikinci 100 bin %40 getirebilir. Robyn, Hill ve S-curve saturasyon fonksiyonlarını uygular. Hill denklemi: `y = V_max × x^n / (K^n + x^n)`, K yarı-maksimum noktası, n eğim. Bu non-linearity, channel bazlı budget optimizasyonu için kritik.

**Hyperparameter tuning**: Adstock decay, saturasyon K ve n değerleri bilinmiyor — grid search ile bulunuyor. Robyn, genetic algorithm (NSGAII) kullanarak binlerce model kombinasyonunu deniyor, pareto frontier'dan en iyi trade-off'u seçiyorsun.

## Veri hazırlığı: SQL'den haftalık granülarite'ye

Robyn haftalık granülarite'de çalışır. Günlük transaction log'dan haftalık media spend ve revenue'yu aggregate ediyorsun. Örnek BigQuery sorgusu:

```sql
WITH weekly_revenue AS (
  SELECT
    DATE_TRUNC(order_date, WEEK) AS week_start,
    SUM(revenue) AS revenue
  FROM `project.dataset.orders`
  WHERE order_date >= '2024-01-01'
  GROUP BY 1
),
weekly_spend AS (
  SELECT
    DATE_TRUNC(date, WEEK) AS week_start,
    channel,
    SUM(cost) AS spend
  FROM `project.dataset.marketing_costs`
  WHERE date >= '2024-01-01'
  GROUP BY 1, 2
)
SELECT
  r.week_start,
  r.revenue,
  COALESCE(s_google.spend, 0) AS google_search_spend,
  COALESCE(s_meta.spend, 0) AS meta_paid_social_spend,
  COALESCE(s_tv.spend, 0) AS tv_spend
FROM weekly_revenue r
LEFT JOIN weekly_spend s_google
  ON r.week_start = s_google.week_start AND s_google.channel = 'google_search'
LEFT JOIN weekly_spend s_meta
  ON r.week_start = s_meta.week_start AND s_meta.channel = 'meta'
LEFT JOIN weekly_spend s_tv
  ON r.week_start = s_tv.week_start AND s_tv.channel = 'tv'
ORDER BY 1;
```

Bu sorgu her satırda 1 hafta, 1 revenue ve N channel spend kolonu üretiyor. Robyn'e CSV olarak verilebilir ama production'da BigQuery'den doğrudan R'ye çekmek daha temiz. `bigrquery` paketi ile:

```r
library(bigrquery)
library(Robyn)

bq_auth()
df_input <- bq_project_query(
  "project-id",
  "SELECT week_start, revenue, google_search_spend, meta_paid_social_spend, tv_spend FROM `project.dataset.mmm_input`"
) %>% bq_table_download()
```

Minimum veri gereksinimi: 104 hafta (2 yıl). Daha az veri overfitting riski taşır. Robyn'in Bayesian prior'ları 52 hafta ile çalışır ama 104+ hafta seasonality'yi daha iyi yakalar.

## Model kurulumu: robyn_inputs ve hyperparameter grid

Robyn, `robyn_inputs()` fonksiyonuyla config objesi oluşturur:

```r
InputCollect <- robyn_inputs(
  dt_input = df_input,
  date_var = "week_start",
  dep_var = "revenue",
  dep_var_type = "revenue",
  paid_media_spends = c("google_search_spend", "meta_paid_social_spend", "tv_spend"),
  paid_media_vars = c("google_search_spend", "meta_paid_social_spend", "tv_spend"),
  context_vars = c("competitor_index", "seasonality"),
  window_start = "2024-01-01",
  window_end = "2026-06-14",
  adstock = "geometric",
  hyperparameters = list(
    google_search_spend_alphas = c(0.5, 3),
    google_search_spend_gammas = c(0.3, 1),
    google_search_spend_thetas = c(0, 0.3),
    meta_paid_social_spend_alphas = c(0.5, 3),
    meta_paid_social_spend_gammas = c(0.3, 1),
    meta_paid_social_spend_thetas = c(0, 0.5),
    tv_spend_alphas = c(0.5, 3),
    tv_spend_gammas = c(0.3, 1),
    tv_spend_thetas = c(0.1, 0.7)
  )
)
```

**Hyperparameter açıklamaları:**

- **alpha**: Hill saturasyon fonksiyonunun slope parametresi (n). Yüksek alpha = geç saturasyon.
- **gamma**: Hill K parametresi — yarı-maksimum noktası. Düşük gamma = erken saturasyon.
- **theta**: Geometric adstock decay. 0 = efekt anında biter, 0.7 = %70'i sonraki haftaya taşınır.

Her channel için min-max aralığı veriyorsun. Robyn bu aralıkta grid search yapıyor. TV için theta üst sınırı 0.7 — zihin payı uzun sürer. Paid search için 0.3 — conversion kısa dönemli.

## Model çalıştırma: robyn_run ve pareto optimizasyonu

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  cores = 8,
  iterations = 2000,
  trials = 5,
  outputs = FALSE
)
```

`robyn_run()`, genetic algorithm ile 2000 iterasyon boyunca hyperparameter kombinasyonlarını test ediyor. Her iterasyonda NRMSE (normalized root mean squared error) ve DECOMP.RSSD (decomposition residual sum of squares difference) minimize ediliyor. Pareto frontier'dan 5 model seçiliyor — trade-off: fit quality vs. business logic (örn. TV'nin ROI'si search'ten yüksek olamaz).

Output objesinde `df_allpareto` tablosu var — her modelin channel-level ROI, ROAS ve CPA değerleri. Satır sayısı = iterations × trials. Şu kolonları içerir:

| Kolon | Açıklama |
|-------|----------|
| `solID` | Model ID |
| `nrmse` | Normalized RMSE — düşük = iyi fit |
| `decomp.rssd` | Decomposition RSSD — düşük = channel katkıları stabil |
| `mape` | Mean absolute percentage error |
| `rsq_train` | Training R² |
| `google_search_spend_roi` | Google Search ROI (revenue/spend) |
| `meta_paid_social_spend_roi` | Meta ROI |
| `tv_spend_roi` | TV ROI |

En iyi modeli NRMSE + DECOMP.RSSD + business logic ile seçiyorsun. Robyn arayüzü Shiny dashboard sunuyor ama production'da programmatic seçim daha kontrollü:

```r
best_model_id <- OutputModels$allPareto %>%
  filter(nrmse < 0.1, decomp.rssd < 0.05) %>%
  arrange(nrmse) %>%
  slice(1) %>%
  pull(solID)
```

## Holdout validation: overfitting'i engellemek

Training veriyle fit edilen model, görünmeyen veriye genelleme yapmıyor olabilir. Robyn'de holdout validation: son 8-12 haftayı training'den çıkarıp test set olarak kullanıyorsun. Model training veriye fit ediliyor, test setinde prediction yapılıyor. MAPE (mean absolute percentage error) test setinde %15'in altındaysa model production'a taşınabilir.

```r
InputCollect_train <- robyn_inputs(
  dt_input = df_input,
  date_var = "week_start",
  dep_var = "revenue",
  window_start = "2024-01-01",
  window_end = "2026-04-12",  # Son 10 hafta holdout
  # ... diğer parametreler aynı
)

OutputModels_train <- robyn_run(InputCollect_train, iterations = 2000)

# Holdout sette prediction
df_test <- df_input %>% filter(week_start > "2026-04-12")
predictions <- predict(OutputModels_train, newdata = df_test)
mape_test <- mean(abs((df_test$revenue - predictions) / df_test$revenue)) * 100
```

MAPE > %20 ise model overfit. Hyperparameter aralıklarını daraltmak veya context variable eklemek (örn. ekonomik indeks, hava durumu) gerekebilir. Robyn'in Bayesian regularization'ı (ridge penalty) overfitting'i azaltıyor ama holdout validation nihai güvence.

## Adstock decay ve saturasyon eğrilerini görselleştirme

Robyn, `robyn_outputs()` ile adstock ve saturasyon eğrilerini plot ediyor. Production'da bu grafikleri PNG olarak export edip BI dashboard'a gömebilirsin:

```r
robyn_outputs(
  InputCollect = InputCollect,
  OutputModels = OutputModels,
  select_model = best_model_id,
  export = TRUE,
  export_location = "/data/mmm_output/"
)
```

Export edilen dosyalar:

- `saturate_curves.png` — Her channel için spend vs. response eğrisi. X ekseninde harcama, Y ekseninde predicted revenue. Eğri saturation noktasında yataylaşıyor.
- `adstock_curves.png` — Decay profili. X ekseninde hafta, Y ekseninde adstock multiplier. TV için 6-8 hafta decay görülebilir.
- `waterfall.png` — Revenue decomposition: base + seasonality + channel contribution.

Bu görsellerle CMO'ya "TV harcamasını %30 artır" yerine "TV saturasyon noktasında, search'e %20 kaydırırsan toplam ROI %12 artar" diyebiliyorsun.

## Production pipeline: dbt + Robyn + Looker Studio

MMM tek seferlik analiz değil — haftalık refresh gerekiyor. Roibase'in [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) yaklaşımıyla pipeline şöyle kuruluyor:

1. **dbt**: BigQuery'deki raw event'lerden `mmm_input` tablosu oluşturuluyor (yukarıdaki SQL). Her Pazartesi 00:00'da dbt Cloud scheduled run.
2. **Robyn R script**: Cloud Run container'ında çalışıyor. `bigrquery` ile `mmm_input` çekiliyor, `robyn_run()` çağrılıyor, output BigQuery'ye yazılıyor (`mmm_output` tablosu: `week_start`, `channel`, `roi`, `predicted_revenue`).
3. **Looker Studio**: `mmm_output` tablosundan channel ROI trend'i, saturasyon eğrileri ve budget recommendation dashboard'u besleniyor.

Container'ı Dockerfile ile paketliyorsun:

```dockerfile
FROM rocker/tidyverse:4.2.0
RUN R -e "install.packages('Robyn', repos='https://cloud.r-project.org')"
RUN R -e "install.packages('bigrquery')"
COPY run_mmm.R /app/run_mmm.R
CMD ["Rscript", "/app/run_mmm.R"]
```

Cloud Scheduler ile her Pazartesi 06:00'da trigger ediyorsun. Robyn 2000 iteration ~20 dakika sürüyor (8 core makine ile).

## Budget reallocation: pareto frontier'dan karar çıkarmak

Robyn'in en güçlü çıktısı budget optimizer. `robyn_allocator()` fonksiyonu, mevcut bütçeyi channel'lar arasında yeniden dağıtarak toplam revenue'yu maksimize ediyor:

```r
AllocatorCollect <- robyn_allocator(
  InputCollect = InputCollect,
  OutputCollect = OutputModels,
  select_model = best_model_id,
  scenario = "max_response",
  channel_constr_low = c(0.7, 0.7, 0.5),  # Google, Meta, TV için min %70, %70, %50 korunsun
  channel_constr_up = c(1.5, 1.5, 2),     # Max %150, %150, %200
  expected_spend = 500000,                # Toplam bütçe
  expected_spend_days = 90
)
```

Output tablosu:

| Channel | Current Spend | Optimized Spend | Delta | Expected Revenue Lift |
|---------|---------------|-----------------|-------|----------------------|
| Google Search | 200,000 | 180,000 | -10% | -2% |
| Meta Paid Social | 200,000 | 220,000 | +10% | +8% |
| TV | 100,000 | 100,000 | 0% | 0% |

Bu tablo ile "Meta'ya %10 kaydırarak toplam revenue %6 artabilir" diyorsun. Constraint'ler (0.7-1.5 çarpanları) business limit'leri yansıtıyor — örneğin TV contract 3 ay sabit, sadece digital esnek.

## Robyn'in sınırları ve incrementality testlerle kombinasyon

MMM correlation-based — causation değil. TV harcaması ile satış aynı anda artıyorsa Robyn pozitif ROI gösterir ama belki satış artışı başka sebepten (ekonomik iyileşme). Incrementality test — geo-experiment, holdout group — causality kanıtı verir. Robyn + incrementality kombinasyonu: Robyn haftalık allocation guidance, incrementality testi yılda 2-3 kez validation.

Bir diğer sınır: yeni channel. Robyn'e hiç data girmemiş bir channel (örn. podcast) için saturasyon eğrisi çizemezsin. İlk 8-12 hafta test budget ile veri biriktirip modele ekliyorsun.

Son kısıt: granülarite. Robyn haftalık çalışır — günlük veya saat-bazlı kararlar alamazsın. Bunun için [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) kapsamında real-time bidding model'i devreye giriyor (XGBoost, LightGBM ile).

Marketing Mix Modeling 2026'da attribution'ın omurgası. Robyn framework'ü bu omurgayı production pipeline'a taşıyor: BigQuery'den haftalık veri, genetic algorithm ile hyperparameter tuning, holdout validation ile overfitting kontrolü, budget allocator ile karar mekanizması. Saturasyon eğrisi ve adstock decay, pazarlama harcamasını mühendislik disiplinine bağlıyor — tahmin yerine regresyon, iletişim yerine data pipeline, vaat yerine confidence interval. Şimdi yapman gereken: son 2 yılın haftalık spend ve revenue verisini BigQuery'ye toplamak, Robyn container'ını Cloud Run'a deploy etmek ve ilk pareto frontier'ı CMO'ya sunmak.