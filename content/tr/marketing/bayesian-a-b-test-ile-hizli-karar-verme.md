---
title: "Bayesian A/B Test ile Hızlı Karar Verme"
description: "Frequentist test limitlerini aş. Sequential test mantığı, dinamik sample size ve Bayesian A/B test ile performans pazarlamasında günler içinde karar ver."
publishedAt: 2026-05-09
modifiedAt: 2026-05-09
category: marketing
i18nKey: marketing-002-2026-05
tags: [ab-testing, bayesian-statistics, conversion-optimization, performance-marketing, sequential-testing]
readingTime: 8
author: Roibase
---

Performans pazarlamasında test hızı rekabet avantajı. Frequentist A/B test senaryosunda iki hafta bekliyorsun, confidence interval gelene kadar kampanya bütçesi yanıyor. Bayesian yaklaşım sana her gün güncel posterior dağılım verir — test tamamlanmadan bile "varyant B %73 ihtimalle kazanıyor" diyebilirsin. Bu yazı Bayesian A/B test'in mekanik mantığını, sequential decision kurallarını ve sample size dinamiğini açıyor. Frequentist yöntemin fixed horizon zorunluluğunu kaldırıp, günlük veri akışı içinde sürekli karar güncellemesine geçiriyorsun.

## Frequentist Testin Fixed Horizon Sorunu

Klasik A/B test p-value ve fixed sample size üzerine kurulu. Test planında "n=5000 visitor gerekiyor, 14 gün sürer" diye başlıyorsun ve 14. güne kadar hiçbir karara varmıyorsun. Bu süre zarfında kaybeden varyanta trafik göndermeye devam ediyorsun — conversion rate 2 puan düşük bile olsa test planını bozmadan beklemek zorundasın. Erken stop edersen Type I error inflate oluyor, multiple testing problem ortaya çıkıyor.

Frequentist mantıkta p < 0.05 eşiği istatistiksel anlamlılık veriyor ama pratikte "anlamlı ama değersiz" lift durumları çok. Örneğin %0.5 lift istatistiksel olarak anlamlı çıkabilir (büyük sample size sayesinde) ama iş etkisi sıfır. Confidence interval genişliği ve effect size'ı ayırmak gerekiyor — frequentist çerçeve bunu otomatik göstermiyor.

Bir diğer sınırlama: sequential monitoring yapamıyorsun. Test başında sample size hesaplarsın, o sample'a ulaşana kadar beklersin. Bu süreçte varyantlardan biri açık şekilde kazanıyor olsa bile test planını bozmamak için devam etmen gerekir. Aksi takdirde "peeking" yapıyorsun ve p-value geçerliliğini kaybediyor.

## Bayesian Test: Güncel Posterior Dağılımı

Bayesian yaklaşım prior belief + data = posterior mantığında çalışır. Test başında her varyantın conversion rate'i için bir prior dağılım belirlersin (genelde uninformative Beta(1,1) veya geçmiş data'dan gelen informative prior). Her ziyaretçi geldiğinde Bayes teoremi ile posterior güncellenir. 100. ziyaretçide posterior dağılımın bir hali var, 200. ziyaretçide başka bir hali var — sürekli güncelleme.

Posterior dağılım tam olarak "bu varyantın gerçek conversion rate'inin olasılık yoğunluğu" demek. Örneğin Beta(25, 75) posterior'u, %20 ile %30 arası conversion rate'inin yüksek olasılık yoğunluğuna sahip olduğunu söyler. İki varyantın posterior'unu karşılaştırarak "B'nin A'dan iyi olma olasılığı" hesaplayabilirsin — bu P(B > A) formülü Bayesian dünyada doğal çıkar.

Sequential test'in Bayesian versiyonu: her gün posterior'u güncelle, P(B > A) > 0.95 eşiğine ulaştıysan testi durdur. Bu eşik senin risk toleransın — %95 yerine %90 veya %99 kullanabilirsin. Frequentist'te böyle bir mekanizma yok, fixed horizon dışında karar alma kuralın yok. Bayesian'da her an karar alabilirsin çünkü posterior distribution tam bilgi veriyor.

Bayesian test'te p-value yok. Onun yerine probability of superiority (P(B > A)), expected loss (A'yı seçtiğinde B'ye göre kaybettiğin beklenen lift), credible interval (posterior dağılımın %95'lik aralığı) gibi metrikler var. Bunlar pratikte daha yorumlanabilir — "varyant B %85 ihtimalle kazanıyor ve kazanırsa ortalama %2.3 lift veriyor" diyebilirsin.

### Posterior Güncelleme Kodu

```python
import numpy as np
from scipy.stats import beta

# Prior: Beta(1,1) = uniform
prior_alpha, prior_beta = 1, 1

# Gelen veri: A varyantı 50 conversion, 200 visit
conversions_A = 50
visits_A = 200
failures_A = visits_A - conversions_A

# Posterior: Beta(alpha + conversions, beta + failures)
post_alpha_A = prior_alpha + conversions_A
post_beta_A = prior_beta + failures_A

# Posterior dağılımdan sample çek
samples_A = beta.rvs(post_alpha_A, post_beta_A, size=10000)

# B varyantı için aynı işlem
conversions_B = 60
visits_B = 200
failures_B = visits_B - conversions_B
post_alpha_B = prior_alpha + conversions_B
post_beta_B = prior_beta + failures_B
samples_B = beta.rvs(post_alpha_B, post_beta_B, size=10000)

# P(B > A) hesapla
prob_B_wins = (samples_B > samples_A).mean()
print(f"P(B > A): {prob_B_wins:.2%}")  # Örnek: 0.82 = %82 ihtimalle B kazanıyor
```

## Dinamik Sample Size ve Early Stopping

Bayesian test'te sample size sabit değil. Test başında "minimum 1000 ziyaretçi" gibi bir alt sınır koyabilirsin (ki posterior çok geniş olmasın) ama üst sınır dinamik. P(B > A) > 0.95 eşiğine ulaştığın anda testi durdurabilirsin — bu 500. ziyaretçide olabilir, 5000. ziyaretçide olabilir.

Expected loss metric erken karar için çok iyi. Formül: `E[Loss] = E[max(0, CR_winner - CR_chosen)]`. Yani sen A'yı seçtiğinde ama B gerçekte daha iyiyse, kaybettiğin beklenen conversion rate farkı. Loss threshold koyarsın, örneğin "E[Loss] < %0.5" dersen, "en kötü ihtimalle %0.5 lift kaybederim" güvencesiyle testi durdurabilirsin. Bu metrik risk-averse karar vermeyi kolaylaştırır.

Sequential stopping rule örneği:

| Metrik | Eşik | Aksiyon |
|---|---|---|
| P(B > A) | > 0.95 | B'yi winner ilan et |
| P(A > B) | > 0.95 | A'yı winner ilan et |
| E[Loss] | < 0.005 | Kaybeden varyantı kapat |
| Minimum visit | < 1000 | Henüz karar verme |

Bu kurallar sayesinde test süresi ortalamalarda %30-40 kısalır (Google Optimize ve VWO'nun Bayesian motor verilerine göre). Büyük effect size senaryolarında 3 gün içinde %95 confidence ile karar verebilirsin — frequentist'te 14 gün bekliyordun.

Multi-armed bandit ile farkı: Bayesian A/B test hâlâ exploration-exploitation tradeoff yapmıyor, sadece posterior güncelleme ve stopping rule çalıştırıyor. Bandit algoritması trafik dağılımını dinamik optimize eder (Thompson Sampling gibi), Bayesian test sabit split (50/50) ile çalışır ama erken durur. Bandit daha agresif — her impression'da kazanan varyanta daha çok trafik verir. Bayesian test daha muhafazakâr — split sabit, sadece karar hızlı.

## Informative Prior ve Incrementality Test

Prior seçimi Bayesian test'in en kritik noktası. Uninformative prior (Beta(1,1)) geçmiş bilgiyi yok sayar, tamamen data-driven posterior üretir. Informative prior ise geçmiş test verilerinden veya segment bazlı baseline conversion rate'inden gelir. Örneğin mobil segmentinde geçmiş 50 testin ortalaması %12 conversion ise, Beta(60, 440) prior kullanabilirsin (yaklaşık %12 ortalama, ama dağılım var). Bu prior yeni test'e "geçmişe göre makul tahmin" sağlar.

Informative prior kullanmanın avantajı: sample size gereksinimi düşer. Çünkü posterior güncelleme sıfırdan değil, bilgili bir noktadan başlıyor. Dezavantajı: prior yanlış seçilirse bias yaratır. Eğer segment değişti veya sezon etkisi varsa, eski prior yanıltır. Bu yüzden prior sensitivity analizi gerekir — farklı prior'larla test sonuçlarının değişip değişmediğini kontrol et.

[Dönüşüm Oranı Optimizasyonu](https://www.roibase.com.tr/tr/cro) süreçlerinde Bayesian test incrementality ölçümünü kolaylaştırır. Incrementality test için holdout grup veya geo-split gerekir. Bayesian yaklaşımla holdout grubun conversion rate posterior'unu ve test grubun posterior'unu karşılaştırırsın — lift distribution elde edersin. Klasik t-test yerine P(lift > 0) olasılığını hesaplarsın, bu daha yorumlanabilir. Örneğin "yeni kampanya %78 ihtimalle incrementality veriyor, beklenen lift %1.2-2.8 arası" diyebilirsin.

### Prior Seçim Karşılaştırması

```python
# Uninformative prior
prior_uninf = beta(1, 1)

# Informative prior: geçmiş %12 conversion, n=500 sample
# Beta mean = alpha / (alpha + beta) → 60/500 = 0.12
prior_inf = beta(60, 440)

# 20 conversion, 100 visit ile posterior
conversions, visits = 20, 100
post_uninf = beta(1 + conversions, 1 + (visits - conversions))
post_inf = beta(60 + conversions, 440 + (visits - conversions))

# Posterior ortalamaları
print(f"Uninformative posterior mean: {post_uninf.mean():.2%}")  # ~%20
print(f"Informative posterior mean: {post_inf.mean():.2%}")      # ~%13.3
```

Uninformative prior küçük sample'da data'ya çok hassas, informative prior geçmiş bilgiyi regularize eder.

## Tradeoff: Bayesian Test vs Frequentist vs Bandit

Bayesian test her senaryoda optimal değil. Frequentist test regulatory ortamlarda (özellikle medikal/finans) tercih edilir çünkü p-value standardı var, peer-review süreçleri buna göre kurulu. Bayesian prior seçimi subjektif görülebilir. Eğer regülasyon p-value istiyor ve test süresinde esneklik yoksa (örneğin 30 günlük fixed dönem şart), frequentist mantıklı.

Bandit algoritmaları (Thompson Sampling, UCB) exploration-exploitation dengesini otomatik kurar, trafik dağılımını dinamik optimize eder. Uzun süreli test senaryolarında (3+ hafta) bandit Bayesian'dan daha iyi performans verir çünkü kaybeden varyanta az trafik gönderir. Kısa test (1-2 hafta) senaryolarında Bayesian A/B test yeterli — bandit'in regret minimizasyonu kısa sürede fark yaratmaz.

Sample size çok düşükse (örneğin günde 100 ziyaretçi) Bayesian de frequentist de yetersiz kalır. Posterior dağılım o kadar geniş olur ki P(B > A) hiçbir zaman %95'e ulaşmaz. Bu durumda micro-conversion (click, add-to-cart gibi daha frequent event) üzerinden test yapmak veya geo-aggregated test tercih edilir. Bayesian küçük sample'da avantaj sağlamaz, sadece yorumlanabilir output verir.

Bayesian test'in gerçek gücü: cross-channel test orkestrasyon. Örneğin paid channel'da creative test yapıyorsun, aynı anda landing page CRO testi çalışıyor. İki test'in posterior'larını birleştirebilirsin (joint posterior), lift contribution ayırabilirsin. Frequentist'te bunu yapmak için karmaşık ANOVA gerekir, Bayesian'da Markov Chain Monte Carlo (MCMC) ile doğal olarak halledersin.

## Pratikte Uygulama: Platform ve Tooling

Google Optimize (sunucusu kapatıldı) Bayesian motor kullanıyordu. Şu an açık kaynak Bayesian test için Python `bayesian-testing` kütüphanesi veya R `bayesAB` paketi var. Production ortamında kendi stack'ini kurman gerekir — BigQuery'de posterior hesaplamak için SQL UDF yazabilir veya dbt model'i olarak posterior pipeline kurabilirsin.

Örnek dbt macro: her gün test data'sı gelir, macro posterior alpha/beta parametrelerini günceller, P(B > A) hesaplar. Threshold aşıldığında Slack notification gönderir. Bu sayede manuel monitoring yerine otomatik stopping rule çalışır. Ek olarak credible interval ve expected loss metriklerini dashboard'a çekersin — stakeholder "ne zaman karar alacağız" yerine "şu an %82 ihtimalle B kazanıyor" görür.

AB testing platformları (VWO, Optimizely) Bayesian motor ekledi ama Bayesian sonuçları default değil, frequentist ile birlikte gösteriyorlar. Çünkü prior seçimi platformda senin parametren, otomatik kurulamıyor. Platform uninformative prior varsayar, sen informative prior istiyorsan custom setup gerekir. Bu yüzden büyük ölçekte Bayesian test için in-house tooling tercih ediliyor.

Multi-variant test (A/B/C/D gibi) Bayesian'da daha kolay. Frequentist'te multiple comparison correction (Bonferroni, Holm) gerekir, Bayesian'da her varyantın posterior'unu ayrı hesaplarsın ve pairwise P(C > A), P(D > B) gibi tüm kombinasyonları görebilirsin. Winner seçimi: en yüksek posterior mean veya en düşük expected loss olan varyant.

---

Bayesian A/B test performans pazarlamasında karar hızını artırır. Frequentist'in fixed horizon zorunluluğunu kaldırıp sequential monitoring sağlar. Posterior dağılım sürekli güncel kalır, P(B > A) ve expected loss metrikleriyle risk kontrol edilebilir karar verilebilir. Informative prior kullanarak geçmiş test verilerini yeni test'e taşırsın, sample size ihtiyacını düşürürsün. Tradeoff: prior seçimi subjektif, regülasyon frequentist isteyebilir, çok düşük sample'da avantaj sınırlı. Ama orta-büyük ölçekli performance marketing testlerinde Bayesian yaklaşım günler içinde action alınabilir insight verir — klasik 14 günlük bekleme dönemi tarihe karışır.