---
title: "Marketing Mix Modeling: Robyn ile Pratik Kurulum"
description: "Meta'nın açık kaynak MMM kütüphanesi Robyn üzerinden saturasyon eğrisi, adstock decay ve holdout validation kurulumunu production data üzerinde gösteriyoruz."
publishedAt: 2026-07-07
modifiedAt: 2026-07-07
category: data
i18nKey: data-005-2026-07
tags: [marketing-mix-modeling, robyn, adstock, saturation-curve, media-attribution]
readingTime: 8
author: Roibase
---

Multi-touch attribution modelleri cookie sonrası çağda güvenilirliğini kaybederken, marketing mix modeling tekrar ön plana çıkıyor. Google ve Meta'nın açık kaynak MMM araçları (LightweightMMM, Robyn) pazarlamacıya aggregate seviyede kanal etkinliği ölçme imkanı sunuyor. 2025 başında Meta'nın Robyn 3.11 sürümü Bayesian optimization ve paralel hyperparameter search ile production kullanıma elverişli hale geldi. Bu yazıda Robyn kurulumunu üç temel kavram üzerinden gösteriyoruz: saturasyon eğrisi (diminishing returns), adstock decay (gecikmeli etki) ve holdout validation (model güvenilirliği).

## Robyn nedir ve neden şimdi önemli

Robyn, Meta tarafından 2021'de açık kaynak olarak yayımlanan bir R paketidir. Ridge regression üzerine kurulu model, kanal harcama ve dönüşüm verilerini haftalık/günlük agregasyonda alır ve her kanalın artımlı dönüşüm katkısını (incremental conversions) hesaplar. 2024'teki büyük güncellemeyle birlikte model, Prophet'in zaman serisi bileşenlerini entegre etti ve JSON tabanlı model export desteği kazandı — bu sayede Python workflow'larına da bağlanabilir hale geldi.

Robyn'i diğer MMM yaklaşımlarından ayıran üç özellik var: birincisi, harcama-dönüşüm ilişkisini doğrusal değil Hill-Adstock transformasyonuyla modellemesi (gerçekçi saturasyon); ikincisi, hyperparameter optimizasyonunu genetik algoritma ve gradient-free Nevergrad optimizer'la çözmesi (manuel tuning gerekmez); üçüncüsü, model kalite metriklerini otomatik raporlaması (NRMSE, DECOMP.RSSD, MAPE). Production'da model güvenilirliğini test etmek için built-in holdout validation fonksiyonu kritik — bunu aşağıda göstereceğiz.

Marketing mix modeling'in attribution'a göre avantajı şu: aggregate data ile çalıştığı için GDPR/CCPA sınırlamalarından etkilenmiyor ve cross-device journey karmaşıklığını atlıyor. Dezavantajı ise haftalık granülerlikte kalması — intraday campaign optimizasyonu için değil, quarterly budget allokasyonu için kullanılır. Roibase'te [first-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) içinde MMM'i incrementality test sonuçlarıyla birlikte konumlandırıyoruz: bir kanalın MMM'de yüksek ROAS göstermesi yeterli değil, geo-split test veya synthetic control ile doğrulanması gerekir.

## Veri hazırlığı: kanal harcaması + makro değişken

Robyn'e girdi olarak minimum şu kolonları içeren bir haftalık zaman serisi verirsiniz:

```r
# Örnek veri yapısı (2 yıllık haftalık data)
data <- data.frame(
  date = seq(as.Date("2024-01-01"), by = "week", length.out = 104),
  revenue = rnorm(104, 50000, 8000),
  facebook_spend = rnorm(104, 5000, 1000),
  google_search_spend = rnorm(104, 7000, 1500),
  display_spend = rnorm(104, 3000, 800),
  competitor_index = rnorm(104, 100, 15),  # makro değişken
  holiday_flag = sample(0:1, 104, replace = TRUE)
)
```

**Kanal kolonu sayısı:** Minimum 2, maksimum 15 kanal önerilir. 20+ kanal olduğunda model overfitting riski artar ve coefficient stabilite düşer. Eğer affiliate, influencer, podcast gibi long-tail kanallar varsa, onları `other_digital` gibi tek kolonda toplamak daha sağlıklı.

**Makro değişken:** Seasonality, tatil günleri, rakip indeks, ekonomik gösterge gibi kontrol değişkenleri eklemelisiniz — aksi takdirde model tüm dönüşüm artışını medya kanallarına atfedebilir. Robyn'in Prophet entegrasyonu trend ve holiday'leri otomatik yakalıyor ama sektöre özel bir dış şok varsa (örneğin Black Friday, Ramazan) `holiday_flag` eklemek gerekir.

**Veri kalitesi kontrolleri:**
- Hiçbir kolonun varyansı sıfır olmamalı (sabit harcama = kullanışsız)
- Missing value toleransı %5 — Robyn otomatik imputasyon yapmaz
- Haftalık granülarite tercih edilen — günlük data noise artırır, aylık data insufficient observation sayısı demek

Eğer harcama verisi farklı kaynaklardan geliyorsa (Google Ads API, Meta Marketing API, internal finance system) ETL pipeline'ında bir [veri analizi süreci](https://www.roibase.com.tr/tr/verianalizi) kurmalısınız. Bizim production workflow'umuzda BigQuery'de `marketing_spend_weekly` tablosu var; her Pazartesi sabahı dbt model'ı bu tabloyu güncelliyor ve R script'i oradan okuyup Robyn'i tetikliyor.

## Saturasyon ve adstock: Hill-Adstock transformasyonu

Robyn, her kanal harcamasını iki aşamalı bir transformasyondan geçirir: önce adstock (gecikmeli etki), sonra saturation (azalan getiri).

### Adstock decay (geometric veya Weibull)

Bir TV reklamının etkisi anında bitmez — izleyici hafızasında birkaç hafta kalır. Adstock bunu modelliyor. Robyn iki adstock tipi destekliyor: `geometric` (basit, üstel azalma) ve `weibull` (fleksibl, S-eğrisi).

**Geometric adstock:**

```
adstocked_spend[t] = spend[t] + θ × adstocked_spend[t-1]
```

Burada `θ` (theta) decay rate'i — 0.5 demek, geçen haftanın etkisinin yarısının bu haftaya taşındığı anlamına gelir. Robyn bu parametreyi 0–0.9 arasında otomatik arar.

**Weibull adstock:** Daha complex — shape ve scale parametreleri var. TV, outdoor, influencer gibi "awareness" kanalları için Weibull daha iyi fit ediyor çünkü etki önce yavaş başlayıp sonra pik yapıp hızlı düşebiliyor.

**Pratik öneri:** İlk model iterasyonunda geometric kullan — convergence daha hızlı. Eğer model performance düşükse (NRMSE > 0.15) ve awareness ağırlıklı mix varsa Weibull dene.

### Saturasyon: Hill fonksiyonu

Harcamayı 2x artırdığınızda dönüşüm 2x olmaz — diminishing returns var. Robyn bunu Hill equation ile modelliyor:

```
effect = spend^α / (K^α + spend^α)
```

- `α` (alpha): eğrinin dikligi — küçükse yavaş saturasyon, büyükse hızlı
- `K`: half-saturation point — harcama bu noktaya geldiğinde maksimum etkinin yarısına ulaşılır

Robyn, her kanal için bu iki parametreyi hyperparameter search sırasında bulur. Sonuç olarak her kanalın "response curve"ünü görebilirsiniz — örneğin Facebook Ads'in 10K€ harcamadan sonra flatte girdiğini, Google Search'ün ise 20K€'ya kadar lineer devam ettiğini.

**Saturasyon eğrisi neye yarar:** Budget reallocation senaryolarında kullanılır. Eğer bir kanalın slope'u zaten düzse (flat bölgedeyse), oradan bütçe kesip daha dik slope'lu kanala taşımak toplam ROAS'ı artırır.

## Model çalıştırma ve hyperparameter tuning

Robyn kurulumu iki satır:

```r
install.packages("Robyn")
library(Robyn)
```

InputCollect fonksiyonunda veri yapısını tanımlıyorsunuz:

```r
InputCollect <- robyn_inputs(
  dt_input = data,
  date_var = "date",
  dep_var = "revenue",
  paid_media_spends = c("facebook_spend", "google_search_spend", "display_spend"),
  context_vars = c("competitor_index", "holiday_flag"),
  window_start = "2024-01-01",
  window_end = "2025-12-31",
  adstock = "geometric"  # veya "weibull"
)
```

**Hyperparameter aralıkları:**
Robyn her kanal için adstock theta ve saturation alpha/K değerlerini belirttiğiniz range içinde arar. Default range'ler genellikle yeterli ama eğer domain knowledge varsa constraint koyabilirsiniz:

```r
hyperparameters <- list(
  facebook_spend_alphas = c(0.5, 3),   # saturasyon slope
  facebook_spend_gammas = c(0.3, 1),   # saturation inflection
  facebook_spend_thetas = c(0, 0.5)    # adstock decay (geometric)
)
```

Model çalıştırma:

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,     # genetik algoritma iteration sayısı
  trials = 5,            # kaç farklı random seed
  cores = 4
)
```

Bu adım 10–30 dakika sürer (veri boyutuna bağlı). Sonunda Pareto-optimal model setini gösterir — NRMSE (fit quality) ve DECOMP.RSSD (kanal katkı dağılımı smoothness) arasında tradeoff.

**Model seçimi:** Robyn size 10–20 Pareto model önerir. En düşük NRMSE'yi seçmek her zaman doğru değil — bazı modeller overfitting yapabilir. `robyn_outputs()` fonksiyonundaki `robyn_clusters` argümanı ile modelleri kümeleyip en stabil küme merkezini seçebilirsiniz.

## Holdout validation: model güvenilirliğini ölçmek

Robyn'in en kritik özelliklerinden biri built-in holdout validation. Modeli train ederken son N haftayı holdout olarak saklıyorsunuz, ardından o dönem için tahmin yaptırıp gerçek değerle karşılaştırıyorsunuz.

```r
# Son 8 hafta holdout
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  cores = 4,
  calibration_input = NULL,
  holdout_periods = 8  # son 8 hafta test seti
)
```

Holdout sonuçları `OutputModels$resultHypParam` tablosunda:

| Model ID | Train NRMSE | Holdout MAPE | Holdout NRMSE |
|---|---|---|---|
| 1_123_4 | 0.08 | 12.3% | 0.14 |
| 2_456_1 | 0.07 | 18.5% | 0.21 |

**Holdout MAPE < %15** genellikle production-ready sayılır. %20'nin üzeri modelin future forecast gücünün zayıf olduğunu gösterir — ya veri quality problemi var ya da hyperparameter range'leri çok geniş.

**Pratik tuzak:** Eğer holdout döneminde büyük bir outlier event varsa (örneğin platform outage, viral kampanya) model o dönemi tahmin edemez ve MAPE patlar. Bu durumda holdout dönemini kaydırıp tekrar test edin veya o haftayı anomaly olarak işaretleyin.

Holdout validation'ın bir yan faydası: incrementality test sonuçlarıyla cross-check imkanı. Örneğin Facebook için MMM %30 ROAS gösteriyorsa, ama geçmişte yaptığınız geo-split test %15 bulmuşsa, MMM muhtemelen o kanala correlate olan bir makro etkiyi (seasonality, organic trend) Facebook'a atfediyor demektir. Bu tür tutarsızlıkları tespit etmek için [CDP & retention engineering](https://www.roibase.com.tr/tr/retention-engineering-cdp) sürecinde MMM output'unu experiment dashboard'a bağlıyoruz.

## Budget optimization ve scenario planning

Robyn model kurduktan sonra iki ana kullanım alanı var: **budget reallocation** (optimal kanal dağılımı) ve **what-if scenario** (bütçeyi %20 artırırsak ne olur).

**Budget allocator:**

```r
AllocatorCollect <- robyn_allocator(
  InputCollect = InputCollect,
  OutputCollect = OutputModels,
  select_model = "1_123_4",  # seçilen Pareto model
  scenario = "max_response",  # veya "target_efficiency"
  channel_constr_low = 0.7,   # her kanal min %70 mevcut bütçe
  channel_constr_up = 1.5     # max %150
)
```

Çıktı, her kanal için önerilen yeni harcama ve beklenen incremental revenue:

| Kanal | Mevcut | Önerilen | Delta | Incremental Revenue |
|---|---|---|---|---|
| Facebook | 5K€ | 4.2K€ | -16% | -800€ |
| Google Search | 7K€ | 9.1K€ | +30% | +3.2K€ |
| Display | 3K€ | 2.7K€ | -10% | -200€ |

Bu tablo, "eğer Google Search'e %30 daha fazla bütçe verip Facebook'u %16 azaltırsanız, toplam revenue'yi 2.2K€ artırabilirsiniz" diyor. Constraint parametreleri (low/up) ile radikal değişiklikleri engelleyebilirsiniz — pratikte bir kanalı bir gecede %50 kesmek operasyonel risk taşır.

**Scenario planning:** `expected_spend` parametresiyle total budget'i değiştirebilir ve yeni optimal dağılımı alabilirsiniz. Örneğin Q4'te bütçe %25 artacaksa, Robyn size o senaryonun kanal breakdownunu verir.

Roibase projelerinde MMM output'unu Google Sheets veya Looker Studio dashboard'a otomatik export ediyoruz — CMO weekly budget meeting'inde model recommendation'ları canlı görüyor. JSON export:

```r
robyn_write(InputCollect, OutputModels, select_model = "1_123_4", export = TRUE)
```

Bu `Robyn_[timestamp].json` dosyası üretir; içinde tüm hyperparameter, coefficient, response curve verisi var. Bunu Python script'iyle okuyup Slack notification veya email report haline getirebilirsiniz.

## Model refresh ve versiyonlama

MMM statik değil — her çeyrekte yeni data ekleyip model refresh etmelisiniz. Robyn'de "warm start" özelliği var: önceki model hyperparameter'larını seed olarak kullanıp sadece yeni data ile fine-tune yapıyorsunuz.

```r
# Eski modeli yükle
InputCollectRefresh <- robyn_refresh(
  json_file = "Robyn_2025Q4.json",
  dt_input = new_data,  # son 3 ayın datası
  refresh_steps = 1000
)
```

Bu yaklaşım convergence süresini %60 kısaltıyor ve coefficient drift'i minimize ediyor — yani Facebook'un saturasyon eğrisi bir gecede %50 değişmiyor, smooth transition oluyor.

**Versiyonlama best practice:** Her model refresh'te JSON dosyasını Git'e commit edin veya S3'e timestamp'le yükleyin. Böylece 6 ay sonra "neden o dönem Google'e daha az bütçe verdik" sorusunu model history'den cevaplayabilirsiniz. Bizim workflow'umuzda dbt model runları ile senkronize Robyn refresh schedule'ı var — her Pazartesi sabahı 08:00'de tetikleniyor, BigQuery'den son 104 haftanın verisini çekiyor, modeli refresh ediyor ve Slack'e summary post atıyor.

MMM tek başına karar verme aracı değil — incrementality test, attribution model ve CMO intuition ile birlikte kullanılır. Robyn'in gücü, aggregate seviyede privacy-safe bir "second opinion" vermesi ve long-term trend'leri yakalamakta. Eğer production'da kurulum yapacaksanız, veri pipeline'ınızın sağlam olduğundan emin olun — çöp veri girerse çöp model çıkar, hiçbir Bayesian optimization bunu kurtaramaz.