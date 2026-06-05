---
title: "Marketing Mix Modeling: Robyn ile Pratik Kurulum"
description: "Meta'nın açık kaynak MMM framework'ü Robyn ile saturasyon, adstock ve holdout validation'ı pratik R kodu ve doğru veri yapısıyla kurmak."
publishedAt: 2026-06-05
modifiedAt: 2026-06-05
category: data
i18nKey: data-005-2026-06
tags: [marketing-mix-modeling, robyn, adstock, saturation-curve, incrementality]
readingTime: 8
author: Roibase
---

Cookie sonrası ölçüm dünyasında attribution her gün biraz daha fazla signal kaybediyor. iOS 17.4 ile SKAdNetwork bile gerçek ROAS'ı görmekte zorlanırken, pazarlama bütçesi sahipleri kanalların gerçek katkısını ölçmek için ekonometrik modellere dönüyor. Marketing Mix Modeling (MMM), 1960'larda televizyon reklamcılığı için geliştirilen istatistiksel yöntem, 2026'da server-side measurement ve first-party data lake'lerin yanında yeniden merkeze oturuyor. Meta'nın 2021'de açık kaynak olarak yayımladığı **Robyn**, bu regresyon-tabanlı metodolojiye modern makine öğrenmesi ve bayesian optimizasyon katarak uygulamayı hızlandırdı.

## MMM neden şimdi kritik

Last-click attribution modeli cookie kaybıyla birlikte çökerken, multi-touch attribution (MTA) da event-level data gereksiniminden dolayı GDPR ve ATT sonrası kullanılamaz hale geldi. Google Analytics 4'ün data-driven attribution'ı makine öğrenmesine dayanıyor ama yalnızca Google ekosistemi içinde çalışıyor. Oysa pazarlama bütçesinin yüzde 60'ı hâlâ Google dışında: Meta, TikTok, programmatic display, offline TV, sponsorluk.

MMM, user-level tracking yerine haftalık veya günlük **agrega** veriye dayanır. Regresyon modeli, her kanalın harcaması ile satış (ya da dönüşüm) arasındaki ilişkiyi çıkarır. Model iki temel varsayım üzerine kurulu: **saturasyon** (artan harcama azalan marjinal getiri sağlar) ve **adstock** (bugünün reklamı gelecek haftalara etki eder). Bu varsayımlar istatistiksel ama ticari gerçeği yansıtıyor. Robyn, bu iki parametreyi bayesian hiperparametre optimizasyonu ile otomatik bulmayı hedefliyor. 2024 sonrası versiyonlarda (v3.11+) **ridge regression** ve **prophet time-series decomposition** eklenerek modelin seasonal doğruluğu arttı.

Robyn'in bir diğer kritik özelliği **holdout validation**: modeli geçmiş 12 haftalık veriyle eğitip sonraki 4 haftayı tahmin ederek out-of-sample hatasını ölçüyor. Bu, overfitting'i önleyen ve modelin gerçekten kanalları öğrendiğini gösteren unsur. Google'ın Meridian, Facebook'un eski MMM çözümleri benzer yaklaşımlar kullanıyor ama closed-source ve pahalı. Robyn, aynı metodolojiye ücretsiz erişim sunuyor.

## Veri yapısı ve hazırlık

Robyn'i çalıştırmak için ihtiyacın olan veri formatı şu: her satır bir zaman birimi (gün ya da hafta), her sütun bir kanal harcaması veya dönüşüm metriği. Minimum 104 hafta (2 yıl) önerilir çünkü regresyon katsayılarının istatistiksel anlamlılığı örneklem büyüklüğüne bağlı. 52 haftadan az veriyle model convergence sorunu yaşarsın.

```r
# Örnek veri yapısı — BigQuery'den çekilmiş haftalık agrega
df <- data.frame(
  DATE = seq.Date(from = as.Date("2024-01-01"), by = "week", length.out = 104),
  revenue = runif(104, 80000, 150000),
  google_search_spend = runif(104, 5000, 15000),
  meta_spend = runif(104, 8000, 20000),
  tiktok_spend = runif(104, 2000, 8000),
  tv_grp = runif(104, 50, 200),
  organic_sessions = runif(104, 10000, 30000),
  competitor_index = runif(104, 0.8, 1.2)
)
```

**Önemli detaylar:**
- `DATE` sütunu Date sınıfında olmalı, string değil
- Revenue ya da conversion hedef değişken olarak modele girer (dependent variable)
- Kanallar (google_search_spend, meta_spend) **paid** media sütunları — bunlara adstock ve saturasyon uygulanır
- `organic_sessions` ve `competitor_index` gibi değişkenler **organic / control** değişkenler — bunlara dönüşüm uygulanmaz, baseline çıkarımı için
- TV gibi offline kanal verisi varsa GRP, reach ya da izlenme dakikası olarak normalize et

Robyn, `facebook_spend` gibi manuel etiketlerle çalışmaz; sütun adlarını kendin belirliyorsun ama `InputCollect()` fonksiyonunda hangi sütunların paid, hangilerinin organic olduğunu açıkça belirtmelisin.

[First-Party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) kurmadıysan bu veriyi toplamak zor. Server-side GTM, GA4 raw export, Meta / Google Ads API'leri, CRM sisteminden gelen satış verisi — hepsini BigQuery'de birleştirip haftalık rollup yapman gerekir. dbt ile bu ETL pipeline'ı kurduğumuzda, MMM için hazır `fact_marketing_weekly` tablosu üretiyoruz.

## Saturasyon ve adstock konfigürasyonu

Robyn'in güçlü yanı, her kanal için saturasyon eğrisi ve adstock decay parametrelerini **ayrı ayrı** optimize edebilmesi. Saturasyon, Hill fonksiyonu ile modellenir:

```
effect = spend^alpha / (spend^alpha + half_saturation^alpha)
```

`alpha` parametresi eğrinin konkavlığını, `half_saturation` ise etkinin yarı noktasına ulaştığı harcama seviyesini belirler. Google Search gibi intent-based kanallar erken saturate olur (alpha düşük, half_saturation düşük). Brand awareness kanalları (TV, YouTube) geç saturate olur.

Adstock ise geçmiş harcamanın bugünkü etkisini modeller. Geometric adstock en yaygın biçim:

```
adstocked_spend[t] = spend[t] + theta * adstocked_spend[t-1]
```

`theta` (0 ile 1 arası) decay hızı. TV için theta yüksektir (0.7-0.9 — etki haftalarca sürer), search için düşüktür (0.1-0.3 — etki hemen biter). Robyn bu parametreleri Nevergrad optimizasyonu ile bulur, ama sen **prior range** vermelisin:

```r
hyperparameters <- list(
  google_search_spend_alphas = c(0.5, 1.5),
  google_search_spend_gammas = c(0.1, 0.4), # adstock decay
  google_search_spend_thetas = c(0, 0.3),   # adstock theta
  meta_spend_alphas = c(0.5, 2.0),
  meta_spend_gammas = c(0.3, 0.8),
  meta_spend_thetas = c(0.2, 0.6),
  tv_grp_alphas = c(1.0, 3.0),
  tv_grp_gammas = c(0.5, 0.9),
  tv_grp_thetas = c(0.6, 0.9)
)
```

Bu range'leri domain bilgisiyle belirlemelisin. Eğer tamamen random verirsen model diverge eder ya da mantıksız katsayılar bulur (örneğin TV'nin negatif etkisi gibi). Robyn dokümantasyonu default range önerileri sunuyor ama senin verinde test etmeden kullanma.

## Model eğitimi ve holdout validation

Robyn'i çalıştırmak için `robyn_run()` fonksiyonunu kullanırsın. İçinde **Nevergrad** kütüphanesi, bayesian optimization ile en iyi hiperparametre kombinasyonunu arıyor. Tipik bir run 2000 iterasyon x 10 trial = 20,000 model eğitimi anlamına gelir. MacBook M1'de 8 core ile ~15 dakika sürer.

```r
library(Robyn)

InputCollect <- robyn_inputs(
  dt_input = df,
  date_var = "DATE",
  dep_var = "revenue",
  dep_var_type = "revenue",
  paid_media_vars = c("google_search_spend", "meta_spend", "tiktok_spend"),
  paid_media_spends = c("google_search_spend", "meta_spend", "tiktok_spend"),
  organic_vars = c("organic_sessions"),
  prophet_vars = c("trend", "season", "holiday"),
  window_start = "2024-01-01",
  window_end = "2025-12-31",
  adstock = "geometric",
  hyperparameters = hyperparameters
)

OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 10,
  outputs = FALSE
)
```

Model eğitildikten sonra **Pareto-optimal** çözümleri gösterir. Robyn, NRMSE (normalized root mean square error) ve decomposition RSSD (residual sum of squared differences) olmak üzere iki metriği optimize eder. Pareto frontier'daki her model bir trade-off: biri fit'i iyi ama decomposition'ı kötü, diğeri tam tersi. Sen manuel olarak en makul modeli seçmelisin.

Holdout validation için son 4-8 haftayı ayırırsın. Robyn bunu otomatik yapar:

```r
robyn_refresh(
  robyn_object = OutputModels,
  dt_input = df_new, # Yeni veriyle refresh
  refresh_steps = 4,
  refresh_mode = "manual"
)
```

Holdout MAPE (mean absolute percentage error) yüzde 10'un altındaysa model güvenilir kabul edilir. Yüzde 20'nin üstü tehlikeli — overfitting veya eksik değişken sinyali.

## Çıktıları yorumlama ve bütçe optimizasyonu

Robyn'in en kritik çıktısı **channel contribution** tablosu. Her kanalın revenue'ya katkı yüzdesi ve **ROAS**'ı (return on ad spend) gösterir. Ama dikkat: bu geçmiş ROAS değerleri, **marginal ROAS** değil. Marginal ROAS, bir sonraki 1000 TL harcamanın getireceği ek revenue'yu gösterir ve saturasyon eğrisinin türevi ile hesaplanır.

Robyn'in `budget_allocator()` fonksiyonu, mevcut bütçeyi saturasyon eğrilerine göre yeniden dağıtır. Eğer Google Search saturate olmuşsa, fazla bütçeyi Meta veya TikTok'a kaydırır. Bu optimizasyon, **response curve** üzerinde marginal getirinin eşitlendiği noktayı bulur (mikroekonomi 101: MR₁ = MR₂).

```r
AllocatorCollect <- robyn_allocator(
  robyn_object = OutputModels,
  select_model = "1_100_2", # Pareto'dan seçtiğin model ID
  scenario = "max_response_expected_spend",
  channel_constr_low = c(0.7, 0.7, 0.5), # Minimum yüzde 70 Google, 70 Meta, 50 TikTok
  channel_constr_up = c(1.5, 2.0, 3.0),  # Maksimum artış limitleri
  expected_spend = 100000
)
```

Çıktı, mevcut 100,000 TL bütçeyi nasıl dağıtırsan optimal revenue elde edeceğini gösterir. Ama bu statik bir öneri — gerçek hayatta creative refresh, competitor activity, seasonality değişir. Bu yüzden MMM'i **aylık** refresh etmelisin.

## Tradeoff'lar ve sınırlar

MMM, attribution'ın aksine **agrega level** çalışır. Bu, kişiselleştirme için kullanılamayacağı anlamına gelir. Google Search'te hangi keyword'ün daha iyi çalıştığını MMM gösteremez — yalnızca toplamda Search'ün katkısını ölçer. Ayrıca, model **correlation ≠ causation** sorununa açık: eğer satışlar yaz aylarında artıyorsa ve sen de yaz aylarında TV harcamasını artırmışsan, model TV'ye fazla kredi verebilir.

Bu sorunu çözmek için **incrementality test** ile MMM'i doğrulamak gerekir. Geo-lift ya da holdout test ile gerçek kausal etkiyi ölçüp MMM sonuçlarıyla kıyaslarsın. Robyn, incrementality sonuçlarını `calibration` parametresi olarak modele dahil edebilir — bu, bayesian prior olarak çalışır ve modeli gerçeğe yakınlaştırır.

Bir diğer zorluk, **yeni kanalları** modele dahil etmek. Eğer yeni bir kanal açtıysan (örneğin Snapchat) ve yalnızca 8 haftalık verisi varsa, Robyn o kanalın saturasyon eğrisini öğrenemez. Bu durumda manuel prior belirlemelisin ya da ilk 12 haftayı model dışında tutup daha sonra eklemen gerekir.

Son olarak, MMM **offline ve online'ı birleştirdiğinde** en güçlü hale gelir. TV, outdoor, sponsorluk gibi offline kanalların harcamasını modele dahil etmezsen, model online kanallara fazla kredi verir (omitted variable bias). Robyn bu konuda esnek: GRP, reach, hatta brand search volume gibi proxy değişkenleri kabul ediyor.

Doğru kurulmuş bir MMM pipeline'ı, pazarlama ekibinin bütçe planlamasını tahmin oyunundan kanıta dayalı mühendisliğe dönüştürür. Robyn bu dönüşümü açık kaynak olarak erişilebilir kılıyor — ama veri yapısı, hiperparametre tuning ve incrementality validasyonu insan uzmanlığı gerektiriyor. Cookie'siz dünyada attribution yerine ekonometrik regresyona yatırım yapan ekipler, 2027'de rakiplerinden 12 ay önde olacak.