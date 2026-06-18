---
title: "Bayesian A/B Test ile Hızlı Karar Verme"
description: "Frequentist testlerin katı sample size kuralları yerine, Bayesian yaklaşımla sequential test yapın. Gerçek zamanlı olasılık dağılımları, daha erken stop kararı."
publishedAt: 2026-06-18
modifiedAt: 2026-06-18
category: marketing
i18nKey: marketing-002-2026-06
tags: [ab-testing, bayesian-statistics, conversion-optimization, sequential-testing, performance-marketing]
readingTime: 8
author: Roibase
---

Klasik A/B test yöntemi sabit sample size şartına bağlı kalır. N kişiye ulaşana kadar beklersin, t-test yapar, p-value kontrol edersin. Ama pazar gerçeği şu: Her gün varyant B açıkça kaybediyorsa, 2 hafta daha test trafiğini yakmak savurganlık. Bayesian yaklaşım bu sorunu çözer — test sırasında her gün posterior dağılımını güncelleyip "şu an varyant A'nın kazanma olasılığı %94" diyebilirsin. Karar verme eşiğini kendin tanımlarsın, frequentist p<0.05 katılığına mahkum kalmazsın.

## Frequentist Testin Yapısal Limitleri

Geleneksel A/B test Neyman-Pearson çerçevesine dayanır. Null hipotezi tanımlarsın (H₀: varyantlar arasında fark yok), alpha seviyesi belirlersin (genelde 0.05), minimum detectable effect (MDE) kararlaştırırsın, power analizi yaparsın (%80), çıkan sample size'a ulaşana kadar test edersin. Test bitmeden peek yapıp durdurmak Type I error'u şişirir — bu yüzden "peeking" yasaktır.

Sorun: Dijital kampanyalarda trafik maliyeti her gün para demek. Sample size hesabı 12.000 kullanıcı diyorsa ve günde 800 kişi geliyorsa 15 gün beklersin. Ama 5. günde varyant B conversion rate'i %2.1'den %1.3'e düştüyse hala 10 gün daha yakacaksın. Frequentist metodoloji bunu meşru kılar çünkü "erken durdurma = bias". Gerçekte test senaryonu sabit değil — kampanya bütçesi sonlu, mevsimsellik var, rakip hamle yapabilir. Katı sample size şartı esneklik tanımaz.

Bir de şu var: P-value sadece "H₀ doğruysa bu veriyi görme olasılığı" verir. Varyant A'nın gerçekten daha iyi olma olasılığını söylemez. p=0.03 çıktı, H₀'ı reddedersin, ama "A'nın B'yi yenme şansı %97" diyemezsin. Frequentist dil sana sadece "istatistiksel anlamlılık" verir, karar için yeterli değildir.

## Bayesian Yaklaşımın Mantığı

Bayesian framework prior bilgiyi posterior dağılıma dönüştürür. Prior: "test başlamadan önce conversion rate hakkında inancım". Veri geldikçe Bayes teoremi üzerinden prior güncellenir. Posterior: "şu ana kadarki veriye göre conversion rate'in olası dağılımı".

Formül:  
**P(θ | data) ∝ P(data | θ) × P(θ)**

θ = conversion rate, data = gözlemlenen başarı/başarısızlık sayısı. Likelihood (veri olasılığı) × prior → posterior. Beta dağılımı conjugate prior olduğu için hesaplama kolay: varyant A için α başarı, β başarısızlık görüldüyse posterior = Beta(α+1, β+1).

Her gün yeni veri geldiğinde posterior'u güncelle. Sequential test'in kritik avantajı bu: posterior dağılımlarını karşılaştırıp "A'nın conversion rate'i B'den yüksek olma olasılığı" Monte Carlo simulasyonuyla hesaplarsın. %95'i geçtiyse karar verirsin. Frequentist'teki gibi "N'e ulaş, sonra bak" değil, "her gün bak, eşik geçtiyse dur".

### Posterior Hesaplama Örneği

```python
import numpy as np
from scipy.stats import beta

# Varyant A: 120 conversion, 1200 görüntüleme
alpha_A = 120 + 1  # +1 uniform prior için
beta_A = (1200 - 120) + 1

# Varyant B: 95 conversion, 1150 görüntüleme
alpha_B = 95 + 1
beta_B = (1150 - 95) + 1

# Monte Carlo: 10,000 sample çek
samples_A = beta.rvs(alpha_A, beta_A, size=10000)
samples_B = beta.rvs(alpha_B, beta_B, size=10000)

# A > B olasılığı
prob_A_wins = (samples_A > samples_B).mean()
print(f"P(A > B) = {prob_A_wins:.3f}")
```

Çıktı örneği: `P(A > B) = 0.983` — %98.3 güvenle A kazanıyor. Frequentist t-test aynı veriyle p=0.06 çıkarabilir (anlamlı değil der), ama Bayesian %98 diyor. Hangisi iş kararı için daha anlamlı?

## Sequential Testing ve Early Stopping

Bayesian test sequential olarak tasarlanmıştır. Her gün posterior'u güncelle, karar eşiğini kontrol et. "Probability to be best" metriği %95'i geçtiyse dur, kazananı deploy et. Bu early stopping frequentist'teki gibi Type I error'u şişirmez çünkü karar kriteri posterior probability — p-value değil.

Pratik uygulama:  
1. Prior tanımla (genelde uninformative Beta(1,1) kullanılır — uniform dağılım)  
2. Her gün conversion verisini topla  
3. Posterior hesapla  
4. P(A > B) ve P(B > A) hesapla  
5. Herhangi biri %95'i geçerse testi durdur  
6. 14 gün geçmesine rağmen %95'e ulaşmadıysa "inconclusive" olarak sonlandır (sample size yetersiz demektir)

Bu yaklaşım [dönüşüm oranı optimizasyonu](https://www.roibase.com.tr/tr/cro) süreçlerinde çok kritik. Landing page testinde varyant B ilk 3 günde %30 daha düşük CTA click gösteriyorsa, Bayesian posterior %96 "B kötü" diyor. Frequentist sample size kuralı 10 gün daha bekletirdi, ama sen 3. günde durdur, trafiği A'ya yönlendir. Fırsat maliyeti düşer.

### Sample Size Dinamiği

Bayesian'da sabit sample size yok, ama "expected sample size" tahmin edebilirsin. Prior'un ne kadar informative olduğuna bağlı. Eğer conversion rate tarihsel veriden %10 civarı biliyorsan prior'ı Beta(10,90) gibi informative yaparsın, daha az veri yeter. Uninformative prior kullanırsan daha uzun sürer ama yine de frequentist'ten daha erken kesme şansı var.

Simülasyon tablosu (örnek):

| True Δ | Frequentist N | Bayesian Expected N | Bayesian 90th percentile N |
|---|---|---|---|
| +10% | 4,800 | 3,200 | 5,100 |
| +20% | 1,200 | 800 | 1,400 |
| +5% | 19,200 | 14,000 | 22,000 |

Küçük lift'lerde Bayesian'da gene uzun sürer ama frequentist kadar katı değil. Büyük lift'lerde %30-40 daha hızlı sonuç verme olasılığı var.

## Karşı Argümanlar ve Tradeoff'lar

**1. Prior seçimi subjektif:** Evet, prior bilgi getiriyorsun. Ama uninformative prior kullanırsan (Beta(1,1)) bu sorun minimize olur. Ayrıca çok fazla veri toplandığında prior etkisi kaybolur — likelihood dominant hale gelir. Frequentist "objektif" görünüyor ama alpha, power, MDE seçimleri de subjektiftir.

**2. Computational cost:** Bayesian test her gün posterior update + Monte Carlo sampling gerektirir. Frequentist t-test tek seferlik hesap. Ama modern araçlar (pymc, Stan, Google Optimize'ın Bayesian modu) bunu otomatize ediyor. 10.000 sample çekmek millisaniye seviyesinde, büyük sorun değil.

**3. Regulator uyumluluk:** İlaç testleri gibi FDA onayı gereken alanlarda frequentist yöntem standart. Dijital pazarlamada böyle bir kısıt yok. AB testing araçları (Optimizely, VWO, AB Tasty) Bayesian option sunuyor.

**4. Multi-armed bandit karışıklığı:** Bayesian test ile bandit algoritmaları (Thompson sampling) karıştırılıyor. Bandit exploration-exploitation dengesi kurar, test boyunca kazanan varyanta daha fazla trafik verir. Bayesian A/B test ise sabit split'le test eder, posterior'u karar için kullanır. İkisi farklı use case'ler — bandit high-velocity campaign'lerde mantıklı, Bayesian test uzun lifecycle product change'lerinde.

## Gerçek Senaryo: Meta Ads Creative Test

Meta Ads'de 3 creative varyant test ediyorsun (A, B, C). Budget günlük $500, CPA target $25. Frequentist yöntem her creative için 1,000 conversion görmek istiyor (power %80, MDE %15 için). Günlük 60 conversion geliyorsa 50 gün beklemen gerekir. Ama 10. günde varyant C'nin CPA'sı $40'a çıktı, açıkça kötü.

Bayesian yaklaşım şöyle çalışır:  
- Her gün her creative için spend, conversion topla  
- CPA posterior dağılımını hesapla (Gamma likelihood kullanılır çünkü CPA continuous positive)  
- P(CPA_C > $30) hesapla — %92 çıktı  
- 10. günde C'yi pause et, budget'i A ve B'ye yönlendir  

20. günde P(CPA_A < CPA_B) = %96 çıkıyor. A'yı kazanan ilan et, 30 gün yerine 20 günde karar verdin. $5,000 budget tasarrufu + 10 gün daha iyi CPA ile kampanya devam etti.

Bu tip dinamik karar verme post-iOS14 döneminde kritik. Signal loss nedeniyle test güvenilirliği düştü — Bayesian posterior uncertainty'yi açıkça gösterir. "Veri yeterli değil, posterior çok geniş" diyebilirsin, frequentist p-value bunu anlatmaz.

---

Bayesian A/B test, frequentist metodolojinin katı sample size ve "peeking" yasağı sorunlarını çözer. Sequential testing ile her gün karar gücünü ölçebilir, yeterli güven seviyesine ulaştığında erkenden durdurabilirsin. Prior seçimi subjektivite getirir ama uninformative prior + çok veri bu sorunu azaltır. Performans pazarlamasında kampanya esnekliği, bütçe verimliliği ve hız istiyorsan Bayesian framework doğru yaklaşım. Test altyapını buna göre kurmalısın — statik N hesabı değil, dinamik posterior update pipeline.