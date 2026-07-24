---
title: "Marketing Mix Modeling: Robyn ile Pratik Kurulum"
description: "Meta'nın Robyn framework'ü ile MMM kurulumu: saturasyon eğrisi, adstock decay, holdout validation. R kodu ve BigQuery entegrasyonu dahil."
publishedAt: 2026-07-24
modifiedAt: 2026-07-24
category: data
i18nKey: data-005-2026-07
tags: [marketing-mix-modeling, robyn, attribution, data-science, bigquery]
readingTime: 8
author: Roibase
---

Attribution son üç yıldır kırılıyor. iOS 14.5, Consent Mode v2, üçüncü taraf cookie'lerin geri çekilişi — hepsi dijital pazarlamacıyı aynı soruyla baş başa bırakıyor: hangi kanal gerçekten işe yarıyor? Marketing Mix Modeling (MMM), cookie ve pixel bağımlılığını kıran, toplam seviye veride çalışan, istatistiksel bir cevap. Meta'nın açık kaynak Robyn framework'ü, MMM'yi akademik bir egzersizden üretime alınabilir bir pipeline'a dönüştürüyor. Bu yazı Robyn'i sıfırdan kurmak, saturasyon eğrisini yorumlamak, adstock decay parametrelerini ayarlamak ve holdout validation ile modeli test etmek için somut adımları veriyor.

## MMM nedir ve neden şimdi kritik

Marketing Mix Modeling, medya harcaması ile satış veya dönüşüm arasındaki ilişkiyi regresyon temelli istatistikle açıklar. Kullanıcı seviyesi veri gerektirmez — haftalık veya günlük toplam harcama, gösterim, satış gibi aggrege metriklerle çalışır. Model, her kanalın marjinal katkısını (incrementality) hesaplar ve hangi kanalın saturasyona girdiğini gösterir.

Klasik last-click attribution pixel tabanlıdır — kullanıcı tıkladığı son kanala kredi verir. MMM ise tüm kanalları aynı zaman penceresinde gözlemleyerek korelasyonu izole eder. Örneğin TV reklamı ile satış arasında 3 haftalık gecikme varsa (carryover effect), model bu gecikmeyi "adstock" parametresiyle yakalar. Satürasyon eğrisi ise diminishing returns'ü gösterir: ilk 100.000 TL harcama 50 dönüşüm getirirken sonraki 100.000 TL sadece 20 dönüşüm getirebilir.

Robyn bu matematiksel framework'ü Meta'nın kendi kampanya verisiyle eğitmiş bir R paketi olarak sunuyor. Bayesian ridge regresyon, multi-objective evolutionary algorithm (MOEA) ile hyperparameter tuning, ve Nevergrad optimizasyonu içeriyor. Kurulumu manuel değil — veri hazırlandıktan sonra 50 satır R kodu model üretiyor.

## Veri hazırlığı: BigQuery'den Robyn'e

Robyn girdi olarak tek bir CSV/data.frame bekler. Her satır bir zaman dilimi (hafta veya gün), her sütun bir kanal harcaması, gösterim sayısı veya satış metriği. Eksik veri kabul etmiyor — boş hücre varsa imputation yapmalısın. Aşağıdaki tablo minimum şema:

| date       | tv_spend | fb_spend | google_spend | revenue | control_var |
|------------|----------|----------|--------------|---------|-------------|
| 2024-01-01 | 50000    | 12000    | 8000         | 120000  | 0.8         |
| 2024-01-08 | 55000    | 13000    | 9000         | 135000  | 0.9         |

BigQuery'den bu veriyi çekmek için haftalık aggregasyon query'si:

```sql
SELECT
  DATE_TRUNC(event_date, WEEK) AS date,
  SUM(IF(channel = 'tv', spend, 0)) AS tv_spend,
  SUM(IF(channel = 'facebook', spend, 0)) AS fb_spend,
  SUM(IF(channel = 'google', spend, 0)) AS google_spend,
  SUM(revenue) AS revenue,
  AVG(seasonality_index) AS control_var
FROM `project.dataset.marketing_events`
WHERE event_date BETWEEN '2022-01-01' AND '2024-12-31'
GROUP BY 1
ORDER BY 1
```

Control değişkeni (trend, mevsimsellik, makroekonomik indikatör) zorunlu değil ama modelin açıklama gücünü artırır. Örneğin perakende sektöründe Ocak indirim ayıysa dummy variable ekle. Robyn bu değişkenleri "organic" baseline olarak regresyona katar.

Veriyi R'a aktarmak için `bigrquery` paketi kullan:

```r
library(bigrquery)
bq_auth(path = "service-account-key.json")
sql <- "SELECT date, tv_spend, fb_spend, google_spend, revenue FROM ..."
df <- bq_project_query("your-project-id", sql) %>% bq_table_download()
```

Robyn veri formatına uygunluk kontrolü için `robyn_inputs()` fonksiyonu şemayı validate eder. Tarih sütunu Date class olmalı, metrikler numeric.

## Robyn model konfigürasyonu: adstock ve saturasyon

Robyn'in çekirdeği `robyn_inputs()` ve `robyn_run()` fonksiyonları. İlk adım model input'larını tanımlamak:

```r
library(Robyn)

InputCollect <- robyn_inputs(
  dt_input = df,
  date_var = "date",
  dep_var = "revenue",
  dep_var_type = "revenue",
  prophet_vars = c("trend", "season", "holiday"),
  prophet_country = "TR",
  paid_media_spends = c("tv_spend", "fb_spend", "google_spend"),
  paid_media_vars = c("tv_spend", "fb_spend", "google_spend"),
  context_vars = c("control_var"),
  adstock = "geometric",
  window_start = "2022-01-01",
  window_end = "2024-10-31"
)
```

**Adstock türü seçimi:**
- `geometric`: En yaygın. Decay rate sabit (örn. her hafta %80 kalıyor). TV, display için uygun.
- `weibull`: Asimetrik decay — başta hızlı düşüş, sonra yavaşlama. Video, influencer kampanyalarda mantıklı.

Geometric adstock formülü:

```
transformed_value[t] = spend[t] + theta * transformed_value[t-1]
```

`theta` decay rate'i (0-1 arası). Robyn bu parametreyi otomatik optimize eder ama manuel range verebilirsin:

```r
hyperparameters <- list(
  tv_spend_alphas = c(0.5, 3),       # saturasyon eğrisi katsayısı
  tv_spend_gammas = c(0.3, 1),       # saturasyon inflection point
  tv_spend_thetas = c(0, 0.5),       # adstock decay rate
  fb_spend_alphas = c(0.5, 3),
  fb_spend_gammas = c(0.3, 1),
  fb_spend_thetas = c(0, 0.3)
)

InputCollect <- robyn_inputs(
  InputCollect = InputCollect,
  hyperparameters = hyperparameters
)
```

**Saturasyon parametreleri:**
- `alpha`: Eğrinin şekli. Yüksek alpha → geç saturasyon.
- `gamma`: Inflection point — 0.5 orta noktada büküm demek.

Hill equation ile saturasyon:

```
response = spend^alpha / (gamma^alpha + spend^alpha)
```

Robyn bu parametreleri evolutionary algorithm ile optimize eder. 2000 model üretir, Pareto frontier'dan en iyi trade-off'ları seçer (R² vs NRMSE dengesi).

## Model çalıştırma ve sonuçları yorumlamak

Robyn modeli çalıştırmak:

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  cores = 8
)
```

Çıktı bir liste — her iterasyon farklı hyperparameter seti. Robyn otomatik olarak en iyi 3 modeli seçer (Pareto optimal). Sonuçlar:

```r
OutputModels$resultHypParam    # tüm modellerin parametreleri
OutputModels$xDecompAgg        # kanal bazlı katkı decomposition
OutputModels$resultCalibration # holdout validation skoru
```

**Decomposition tablosu örnek:**

| channel      | total_spend | total_response | roi   | mean_response |
|--------------|-------------|----------------|-------|---------------|
| tv_spend     | 2400000     | 1800000        | 0.75  | 15000         |
| fb_spend     | 600000      | 720000         | 1.20  | 6000          |
| google_spend | 400000      | 560000         | 1.40  | 4667          |

**ROI yorumu:** Facebook 1.20 — her 1 TL harcama 1.20 TL getiri. TV 0.75 — negatif ROI değil, baseline'ın üzerinde 0.75 TL incremental katkı. Robyn "incrementality" ölçer, last-click credit değil.

**Saturasyon tespiti:** Robyn satürasyon eğrisini plot eder:

```r
robyn_onepagers(InputCollect, OutputModels, select_model = "2_100_3")
```

Plot'ta harcama arttıkça eğrinin yassılaştığı noktayı gör. Örneğin TV spend 80.000 TL'yi geçince marjinal kazanç %50 düşüyor — bu bütçe optimizasyonu için kritik sinyal.

## Holdout validation ve model güvenilirliği

MMM modelinin üretimde kullanılabilmesi için geçmiş veriyi böl: training set (örn. 2022-2024 Ekim) + holdout set (2024 Kasım-Aralık). Model training set'te eğitilir, holdout'ta test edilir. MAPE (mean absolute percentage error) %10'un altındaysa model güvenilir.

Robyn holdout validation otomatik yapar:

```r
InputCollect <- robyn_inputs(
  InputCollect = InputCollect,
  window_start = "2022-01-01",
  window_end = "2024-10-31",
  rollingWindowStartWhich = 52,  # son 52 hafta holdout
  rollingWindowEndWhich = 4
)
```

Sonuç `resultCalibration` tablosunda:

| model_id  | nrmse_train | nrmse_val | decomp.rssd |
|-----------|-------------|-----------|-------------|
| 2_100_3   | 0.08        | 0.12      | 0.05        |

**NRMSE (normalized root mean squared error):** Düşük → iyi. 0.12 kabul edilebilir (0.15'in altı production-ready).
**decomp.rssd:** Decomposition'ın training vs validation tutarlılığı. 0.05 → %5 sapma → stabil model.

Holdout validation başarısızsa iki olasılık: (1) Veri yetersiz — en az 2 yıl haftalık veri gerek. (2) Eksik değişken — mevsimsellik, competitor harcama, fiyat değişimi gibi confounding variable ekle.

## Robyn çıktısını karar mekanizmasına bağlamak

Robyn sonuçlarını BigQuery'ye tekrar yüklemek için decomposition tablosunu CSV olarak export et:

```r
write.csv(OutputModels$xDecompAgg, "robyn_output.csv")
```

BigQuery'ye yükle:

```sql
LOAD DATA OVERWRITE `project.dataset.mmm_results`
FROM FILES (
  format = 'CSV',
  uris = ['gs://bucket/robyn_output.csv']
);
```

Bu tablo dashboard'a (Looker, Tableau) veya budget optimizer'a bağlanır. Örneğin dbt model ile saturasyon eşiğini hesapla:

```sql
WITH saturation AS (
  SELECT
    channel,
    total_spend,
    roi,
    total_spend / NULLIF(roi, 0) AS optimal_spend
  FROM `project.dataset.mmm_results`
)
SELECT * FROM saturation WHERE roi > 1.0 ORDER BY roi DESC;
```

Bu sorgu ROI > 1 olan kanalları sıralar — bütçe artışı için öncelik listesi. Robyn'in budget allocator fonksiyonu da var:

```r
AllocatorCollect <- robyn_allocator(
  InputCollect = InputCollect,
  OutputCollect = OutputModels,
  select_model = "2_100_3",
  scenario = "max_response",
  channel_constr_low = c(0.7, 0.7, 0.7),
  channel_constr_up = c(1.5, 1.5, 1.5)
)
```

Çıktı her kanal için önerilen yeni bütçe. Constraint'ler mevcut harcamanın %70-150'si arasında tutulmasını sağlar (ani değişim operasyonel risk).

[First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) kurulumu MMM için kritik — Robyn'e beslenen veri kalitesi modelin güvenilirliğini doğrudan etkiler. Server-side event tracking, identity resolution, ve consent mode entegrasyonu eksikse aggregasyon seviyesinde bias oluşur.

## Karşılaşılan tuzaklar ve mitigasyon

**Multicollinearity:** İki kanal hep aynı anda aktifse (örn. TV + Facebook hep birlikte koşuyor), model katkıyı ayıramaz. Variance Inflation Factor (VIF) kontrolü gerek:

```r
library(car)
vif_model <- lm(revenue ~ tv_spend + fb_spend + google_spend, data = df)
vif(vif_model)
```

VIF > 5 → sorun var. Çözüm: (1) Bir kanal geçici durdurularak holdout testi yap. (2) Daha uzun zaman serisi topla.

**Gecikme süresi belirsizliği:** Adstock parametresi yanlış ayarlanırsa (örn. TV için 1 hafta yerine 4 hafta), model yanıltıcı sonuç verir. A/B test veya geo-experiment ile gerçek decay süresini doğrula. Meta'nın GeoLift paketi bunu yapar.

**Sezonalite kontrolü eksikliği:** Prophet component'ları (trend, mevsim, tatil) modele eklenmezse, Ocak'taki satış artışı medyaya atfedilebilir (gerçekte yılbaşı indirimi etkisi). Prophet'i mutlaka etkinleştir:

```r
InputCollect <- robyn_inputs(
  InputCollect = InputCollect,
  prophet_vars = c("trend", "season", "holiday"),
  prophet_country = "TR"
)
```

**Model drift:** Pazar dinamiği değişince (yeni rakip, fiyat değişimi, platform algoritma güncellemesi) model eskir. Çözüm: her çeyrekte refresh — son 2 yıl veriyle yeniden train et. Robyn'de `json_file` parametresi ile önceki modeli versiyon kontrol altında tut:

```r
robyn_write(InputCollect, OutputModels, dir = "./robyn_models/")
```

Git commit ile her model versiyon etiketlenir — A/B test için gerekli.

MMM tek başına yeterli değil. Incrementality test (geo-experiment, PSA holdout) ile doğrulama şart. Robyn çıktısı tahmin — test edilen gerçeklik. İkisini birlikte kullanmak attribution'ı mühendislik disiplinine bağlar.