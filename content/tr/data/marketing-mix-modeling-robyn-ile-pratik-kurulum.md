---
title: "Marketing Mix Modeling: Robyn ile Pratik Kurulum"
description: "Meta'nın açık kaynak MMM kütüphanesi Robyn ile saturasyon eğrisi, adstock decay ve holdout validation pratiğini BigQuery data stack üzerinde kurun."
publishedAt: 2026-05-17
modifiedAt: 2026-05-17
category: data
i18nKey: data-005-2026-05
tags: [marketing-mix-modeling, robyn, meta, adstock, saturation-curve]
readingTime: 8
author: Roibase
---

Attribution penceresi 7 güne düştü, cookie consent reddedilmesi %40'ı geçti, multi-touch kanallar arası kanal katkısı ölçülemez hale geldi. 2026'da performance marketeer'ın elinde güvenilir tek yol aggregate ekonometrik model — Marketing Mix Modeling. Meta'nın 2021'de açtığı Robyn kütüphanesi bu süreci ilk kez production-ready hale getirdi. Saturasyon eğrisi nasıl yorumlanır, adstock decay ne anlama gelir, holdout validasyonu hangi aralıkta çalışır — bu yazıda Robyn'i BigQuery data stack üzerine kurarak yanıtlayacağız.

## Robyn Nedir, Ne Değildir

Robyn bir R kütüphanesidir. Facebook Marketing Science ekibi tarafından açık kaynak olarak yayımlanmıştır. Amacı: haftlık veya günlük seviyede toplu kanal harcama + dışsal makro değişkenler (tatil, mevsim, fiyat) ile satış metriğini regresyona sokmak. Çıktısı: her kanalın ROAS'ı, saturasyon seviyesi, gecikme etkisi (adstock), optimal bütçe dağılımı.

Ne değildir: son tıklama attribution değildir, kullanıcı seviyesinde conversion path takip etmez. Kişisel veri kullanmaz, cookie sinyali beklemez. Aggregate time series regression modelleri kullanır — Ridge, Lasso değil, Nevergrad hyperparameter optimizasyonu ile karmaşık non-linear transformasyonlar tarar.

Tipik MMM süreçlerinde ay bazlı 36 veri noktası modellenir. Robyn günlük granülasyon bile çalışır — minimum 104 hafta (2 yıl) önerilir. 52 haftadan az veri variance'ı yüksek tutar, confidence interval güvenilmez olur.

## Saturasyon Eğrisi: S-Curve ve Hill Function

Robyn'in çekirdeğinde iki saturation transformation var: Adbudg (S-curve) ve Hill. Her ikisi de azalan marjinal getiri (diminishing returns) varsayımını kodlar. Yani bir kanala her ek 1000 TL harcadığınızda ilk 1000 TL kadar conversion artışı alamazsınız.

**Hill transformation formülü:**
```
y = K * (x^alpha) / (S^alpha + x^alpha)
```
- K: maksimum yanıt (asymptote)
- S: yarı-saturasyon noktası (spending bu seviyeye gelince yanıt %50 K'ya ulaşır)
- alpha: eğrinin dikligi (alpha > 1 S-curve, alpha < 1 konkav)

Robyn her kanal için alpha ve S parametrelerini Nevergrad ile optimize eder. 10.000+ kombinasyon dener, en düşük NRMSE (normalized root mean squared error) ile en iyi fit'i seçer.

**Pratik yorumlama:**
- Eğer Google Ads için S = 50.000 TL bulunduysa, haftalık 50.000 TL harcamanız yanıt potansiyelinizin yarısına ulaştığınız anlamına gelir.
- Eğer alpha = 2.5 ise eğri dik S şeklindedir — 50.000 TL'nin altında getiri çok düşük, üstünde çok yavaş artar.
- Budget optimizer bu eğrileri kullanarak "50.000 TL'den 60.000 TL'ye çıkmak mı, yoksa Facebook'u 30.000 TL'den 40.000 TL'ye çıkmak mı daha iyi" sorusunu yanıtlar.

Gerçek dünyada: arama bütçesi genelde konkav (alpha < 1), display/video bütçesi S-curve (alpha > 1) şeklinde çıkar. Arama talebi sınırlıdır, display pool sınırsız ama dikkat sınırlıdır.

## Adstock Decay: Gecikmiş Etki Modelleme

Pazarlama harcaması satışı aynı gün etkileyebilir ama etki birkaç hafta sürebilir. TV reklamı 3 hafta sonra bile brand recall yaratır, paid social'ın etkisi 7 gün içinde düşer. Adstock bu gecikmeyi (carryover) ve azalmayı (decay) matematiksel olarak model.

Robyn iki adstock transformasyonu sunar:
1. **Geometric adstock:** Exponential decay. Theta parametresi (0-1 arası). Theta = 0.5 ise geçen haftanın etkisinin %50'si bu haftaya taşınır.
2. **Weibull adstock:** Daha esnek — peak delay + uzun kuyruk. Parametreler: shape (k) ve scale (lambda). TV gibi gecikmeli peak etkiye sahip kanallar için tercih edilir.

**Geometric adstock formülü:**
```
adstocked_t = spend_t + theta * adstocked_(t-1)
```

Robyn her kanal için theta (veya k, lambda) değerini grid search ile optimize eder. Kullanıcı hyperparameters.json'da theta için aralık belirler (örn. 0-0.7), model en iyi theta'yı bulur.

**Pratikte ne yapmak gerekiyor:**

```r
hyperparameters <- list(
  google_ads_S = c(0.3, 3),    # adstock için theta range
  google_ads_alphas = c(0.5, 3), # saturation alpha range
  facebook_ads_S = c(0.1, 2),
  facebook_ads_alphas = c(1, 5)
)
```

Sonuç: Google Ads'in theta = 0.4, Facebook Ads'in 0.2 çıkması demek Google Ads'in etkisi daha uzun sürer. Budget planner'da bunu dikkate alır — Google Ads'e harcadığınız paranın dörtte biri 2 hafta sonra bile çalışır, Facebook'unki 1 hafta sonra biter.

### Kod Bloğu: Basit Adstock Transformasyonu (R)

```r
apply_geometric_adstock <- function(spend, theta) {
  adstocked <- numeric(length(spend))
  adstocked[1] <- spend[1]
  for (t in 2:length(spend)) {
    adstocked[t] <- spend[t] + theta * adstocked[t - 1]
  }
  return(adstocked)
}

# Örnek: Google Ads harcaması
google_spend <- c(10000, 15000, 12000, 8000, 20000)
theta_google <- 0.5
adstocked_google <- apply_geometric_adstock(google_spend, theta_google)
print(adstocked_google)
# [1] 10000.0 20000.0 22000.0 19000.0 29500.0
```

Bu kod Robyn'in içinde C++ seviyesinde optimize edilmiş şekilde çalışır ama mantık aynıdır.

## Holdout Validation: Model Güvenilirlik Testi

Robyn model fit'ini iyileştirirken overfitting riski vardır. 10 kanal + 5 makro değişken + her birinin saturation ve adstock parametreleri → 30+ değişken. 104 veri noktasında bu çok fazla serbestlik derecesi demektir.

Robyn holdout validation kullanır: son N haftalık veriyi model eğitiminden çıkarır, model geçmiş veriyi öğrenir, holdout periyodunda tahmin yapar, gerçek değerle MAPE (mean absolute percentage error) hesaplar.

**Robyn'de holdout tanımı:**

```r
InputCollect <- robyn_inputs(
  dt_input = df_marketing,
  dep_var = "revenue",
  paid_media_spends = c("google_ads", "facebook_ads", "tiktok_ads"),
  window_start = "2024-01-01",
  window_end = "2026-04-30",
  adstock = "geometric",
  prophet_vars = c("trend", "season", "holiday"),
  prophet_country = "TR"
)

# Holdout: son 8 hafta
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  ts_validation = TRUE,
  ts_holdout = 8  # son 8 hafta test seti
)
```

**Sonuç yorumlama:**
- NRMSE train < 0.10, NRMSE holdout < 0.15 → model güvenilir.
- NRMSE train = 0.05, holdout = 0.30 → overfit, hyperparameter range daraltılmalı.
- Decomp.RSSD (response sum of squared differences): kanalların toplam contribution'ı tahmin edilen revenue'nin ne kadarını açıklıyor. 0.6+ iyi, 0.8+ mükemmel.

Robyn aynı anda 5 trial çalıştırır (Nevergrad'ın farklı random seed'leri), her trial 2000 iterasyon yapar, en iyi 10 modeli Pareto frontunda gösterir. Kullanıcı business constraint'lere göre (örn. "Google Ads ROAS 3'ten düşük olamaz") bir model seçer.

## BigQuery ile Robyn: Pipeline Mimarisi

Robyn R ortamında çalışır ama veri kaynağı BigQuery olabilir. Tipik stack:

1. **BigQuery data warehouse:** Günlük harcama tablosu (spend_daily), conversion tablosu (conversions_daily), makro değişkenler (holidays, weather, competitor_price).
2. **dbt transformation:** Join + aggregation. Haftalık satır haline getir, kanal bazında harcama kolonları oluştur.
3. **R script (Cloud Run veya Vertex AI):** bigrquery paketi ile BigQuery'den çek, Robyn'e besle, model sonuçlarını tekrar BigQuery'ye yaz.
4. **Looker Studio dashboard:** Model output'unu görselleştir — kanal ROAS, optimal budget split, saturation chart.

**dbt model örneği (marketing_mix_weekly.sql):**

```sql
WITH spend_agg AS (
  SELECT
    DATE_TRUNC(spend_date, WEEK) AS week_start,
    SUM(CASE WHEN channel = 'google_ads' THEN spend ELSE 0 END) AS google_ads_spend,
    SUM(CASE WHEN channel = 'facebook_ads' THEN spend ELSE 0 END) AS facebook_ads_spend,
    SUM(CASE WHEN channel = 'tiktok_ads' THEN spend ELSE 0 END) AS tiktok_ads_spend
  FROM `project.dataset.spend_daily`
  WHERE spend_date BETWEEN '2024-01-01' AND '2026-04-30'
  GROUP BY 1
),
revenue_agg AS (
  SELECT
    DATE_TRUNC(conversion_date, WEEK) AS week_start,
    SUM(revenue) AS total_revenue
  FROM `project.dataset.conversions_daily`
  WHERE conversion_date BETWEEN '2024-01-01' AND '2026-04-30'
  GROUP BY 1
)
SELECT
  s.week_start,
  s.google_ads_spend,
  s.facebook_ads_spend,
  s.tiktok_ads_spend,
  r.total_revenue
FROM spend_agg s
LEFT JOIN revenue_agg r USING (week_start)
ORDER BY week_start
```

Bu tablo BigQuery'de materyalize edilir, Robyn R script'i `bigrquery::bq_table_download()` ile çeker. Model output'u (her hafta her kanalın contribution'ı) yine BigQuery'ye yazılır — BI tool'lar buradan okur.

## Budget Optimizer: Pareto Optimal Dağılım

Robyn model fit'inden sonra ikinci bir modül çalıştırır: budget allocator. Girdiler: toplam bütçe (örn. 500.000 TL/hafta), kanal harcama constraint'leri (örn. Google Ads minimum 50.000 TL). Çıktı: ROAS maksimizasyonu için optimal dağılım.

Algoritma: her kanalın saturasyon eğrisinin türevini alır (marginal ROAS), harcamayı marjinal ROAS eşitlenene kadar kaydırır. Bu Lagrange multiplier optimizasyonudur.

**Sonuç tablosu örneği:**

| Kanal | Mevcut Harcama | Optimal Harcama | Delta | Mevcut ROAS | Optimal ROAS |
|---|---|---|---|---|
| Google Ads | 200.000 TL | 180.000 TL | -20.000 | 4.2 | 4.5 |
| Facebook Ads | 150.000 TL | 200.000 TL | +50.000 | 3.8 | 4.1 |
| TikTok Ads | 100.000 TL | 120.000 TL | +20.000 | 3.5 | 3.9 |
| Display | 50.000 TL | 0 TL | -50.000 | 1.2 | — |

Yorum: Display kanalı saturasyon seviyesinin çok altında bile ROAS 1.2 veriyor — kaldırılmalı. Google Ads zaten saturasyon noktasının üzerinde, harcama 20.000 TL azaltılsa ROAS yükselir. Facebook Ads hâlâ düz eğrinin ortasında, bütçe artırımı verimli.

Bu tablo CFO'ya sunulur, Robyn'in SQL output'u Looker'da görselleştirilir. Karar mekanizması data-driven hale gelir — "Bu ay Facebook'a 50.000 TL daha verelim" artık tahmin değil, model çıktısıdır.

---

Robyn'i kurmak için 2 yıllık haftalık granüler data, R ortamı, BigQuery bağlantısı ve 4-6 saatlik hyperparameter tuning süreci yeterli. Model production'a alındıktan sonra ayda 1 kez refresh edilir (yeni 4 haftalık veri eklenir, holdout penceresi kayar). Saturasyon eğrisi ve adstock parametreleri zamanla değişir — bayram ayında Facebook theta'sı düşer, Back Friday'de Google Ads alpha'sı yükselir. Robyn bu dinamikleri otomatik yakalamaz, ama retrain sıklığını artırarak yakalar. BigQuery data stack üzerinde [first-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) sağlam kurulduysa, Robyn o mimarinin üstüne oturur, aggregate MMM'i operasyonel hale getirir. Cookie sonrası dünyada attribution yerine ekonometrik model artık zorunluluktur — Robyn o geçişi üretim ortamında yapılabilir kılan ilk açık kaynak araçtır.