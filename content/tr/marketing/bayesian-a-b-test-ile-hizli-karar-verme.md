---
title: "Bayesian A/B Test ile Hızlı Karar Verme"
description: "Frequentist testlerin katı sample size gereklilikleri yerine Bayesian yaklaşımla sequential olarak karar vermeyi ve test süreçlerini hızlandırmayı öğrenin."
publishedAt: 2026-07-07
modifiedAt: 2026-07-07
category: marketing
i18nKey: marketing-002-2026-07
tags: [ab-testing, bayesian-statistics, conversion-optimization, sequential-testing, data-driven-marketing]
readingTime: 8
author: Roibase
---

Klasik A/B test metodolojisi sabit sample size'a dayanır: önceden hesaplanan ziyaretçi sayısına ulaşana kadar bekler, ardından istatistiksel anlamlılık hesaplar, sonra karar verir. Bu yaklaşım 2010'larda işledi çünkü trafik pahalıydı ve testler aylar sürebilirdi. 2026'da ise performans pazarlaması haftalık döngülerde çalışıyor, creative refresh cycle 14 gün, kampanya stratejisi aylık değişiyor. Bir landing page varyanını 6 hafta test etmek artık lüks değil — kayıp. Bayesian A/B test bu sorunu sequential karar mekanizmasıyla çözüyor: her gün posterior distribution güncelleniyor, confidence threshold'a ulaştığın anda testi durdurup kazananı yayınlıyorsun.

## Frequentist Testin Sample Size Tuzağı

Klasik frequentist A/B test p-value < 0.05 şartına dayanır. Bu eşiğe ulaşmak için önceden power analysis yaparsın: %5 baseline conversion, %10 relative lift, %80 statistical power hedeflersen minimum 3100 kullanıcı/varyant gerekiyor. Günde 500 unique visitor geliyorsa test 12 gün sürüyor. Sorun şu: 5. gün varyant B açık ara kazanıyor ama istatistiksel anlamlılık yok — beklemen lazım. 12. günde anlamlılık geliyor ama rakip landing page yayınlamış, mesaj eskimiş. Frequentist testin iki katı hasar var: erken karar verirsen Type I error (yanlış pozitif), geç kalırsan opportunity cost.

Sequential testing frequentist framework'te de var (Bonferroni düzeltmesi, alpha spending functions) ama karmaşık. Her ara analiz için alpha bütçesi ayırman lazım — erken durdurmak istersen critical value sertleşiyor. Sonuç: test uzuyor veya güven azalıyor.

Bayesian yaklaşım bu ikilemden kurtarıyor çünkü her observation yeni bilgi — önceki posterior şimdiki prior oluyor. Sample size fixed değil, sequential. Her gün posterior distribution güncelleniyor, "B'nin A'dan iyi olma olasılığı %95'i geçti" dediğinde durdurup yayınlıyorsun. Erken durma penaltı değil, özellik.

## Posterior Distribution ve Sequential Güncelleme

Bayesian testte prior distribution ile başlarsın: conversion rate hakkında önceki inancın. E-commerce landing page test ediyorsan baseline %3 conversion, standart sapma %0.5 olabilir (geçmiş verilere dayanır). Bu Beta(30, 970) prior'u olur. İlk 100 visitor geldiğinde B varyantta 4 conversion görüyorsun. Posterior şöyle güncellenir:

```
Prior: Beta(α=30, β=970)
Likelihood: 4 success, 96 failure
Posterior: Beta(α=30+4, β=970+96) = Beta(34, 1066)
```

Posterior mean = 34/(34+1066) = 0.0309 (%3.09). Ertesi gün 200 visitor daha gelir, 7 conversion. Dünün posterior'u bugünün prior'u olur:

```
Prior: Beta(34, 1066)
Likelihood: 7 success, 193 failure
Posterior: Beta(41, 1259)
```

Posterior mean = 0.0316 (%3.16). A varyantta ise aynı sürede 500 visitor, 14 conversion. A posterior = Beta(44, 1456), mean = 0.0293. Bu noktada iki posterior distribution'ı karşılaştırırsın: P(B > A) hesaplanır — Monte Carlo simulation ile 10000 sample çekip B'nin kaç kez daha büyük olduğunu sayarsın. Çıkan olasılık %73 ise henüz emin değilsin. 5. günde P(B > A) = %96 olduğunda testi durdurursun çünkü decision threshold'una (%95) ulaştın.

Frequentist testte bu mümkün değil. Her ara bakışta alpha inflation riski var, multiple comparison sorunu oluşuyor. Bayesian'da ise her gün posterior güncellenir, ama karar kriteri sabit: confidence level. Erken durma bias yaratmıyor çünkü Bayesian inference likelihood'a conditioned — sample size sabitleme zorunluluğu yok.

## Praktik Uygulama: Stopping Rule ve Threshold Seçimi

Bayesian A/B test kolay kurulur ama stopping rule disiplini gerektirir. Üç threshold tanımlanmalı:

**1. Minimum sample size (safety net):** Çok erken durmanın önüne geçer. 100 kullanıcı/varyant görmeden karar verme — posterior variance çok geniş, false positive riski var. Google Optimize 2019 whitepaper'ında minimum 250 conversion öneriyordu, pratikta 50-100 conversion yeterli (prior strength'e bağlı).

**2. Confidence threshold:** P(B > A) > 0.95 klasik seçim. Agresif karar istiyorsan 0.90, konservatif test için 0.97 kullanabilirsin. Financial impact yüksekse (checkout flow değişikliği) 0.99 al.

**3. Practical significance (lift threshold):** İstatistiksel fark %0.5 relative lift bile anlamlı çıkabilir ama iş etkisi yok. Lift > %5 gibi pratik eşik koy. Posterior'da sadece P(B > A) değil, P(B > A * 1.05) hesapla.

**Kod örneği (Python + PyMC):**

```python
import pymc as pm
import numpy as np

# Prior: Beta(30, 970) — %3 baseline
with pm.Model() as model:
    p_A = pm.Beta("p_A", alpha=30, beta=970)
    p_B = pm.Beta("p_B", alpha=30, beta=970)
    
    # Observed data
    obs_A = pm.Binomial("obs_A", n=500, p=p_A, observed=14)
    obs_B = pm.Binomial("obs_B", n=500, p=p_B, observed=18)
    
    trace = pm.sample(5000, return_inferencedata=True)

# Posterior karşılaştırma
p_B_samples = trace.posterior["p_B"].values.flatten()
p_A_samples = trace.posterior["p_A"].values.flatten()
prob_B_better = np.mean(p_B_samples > p_A_samples)
prob_lift_5pct = np.mean(p_B_samples > p_A_samples * 1.05)

print(f"P(B > A) = {prob_B_better:.2%}")
print(f"P(B > A*1.05) = {prob_lift_5pct:.2%}")
```

Bu kod her gün çalıştırılır, prob_B_better > 0.95 ve prob_lift_5pct > 0.80 olduğunda test durur. 5. günde bu koşul sağlanırsa frequentist 12 gün beklerken sen 7 gün kazanırsın.

## Tradeoff: Prior Seçimi ve Sensitivity

Bayesian testin eleştirilen noktası: prior seçimi subjektif. Zayıf prior (Beta(1, 1) — uniform) kullanırsan posterior tamamen veriye dayanır ama convergence yavaş. Güçlü prior (Beta(300, 9700)) kullanırsan önceki bilgi posterior'u domine eder — yeni veri etkisi azalır. Denge lazım.

**Prior seçim stratejisi:**

| Senaryo | Prior | Neden |
|---------|-------|-------|
| Yeni ürün, veri yok | Beta(1, 1) | Uniform, veri konuşsun |
| Benzer sayfa var | Beta(α=30, β=970) | Geçmiş %3 conversion bilgisi |
| Agresif launch | Beta(3, 97) | Zayıf prior, hızlı convergence |
| Kritik checkout | Beta(300, 9700) | Güçlü prior, konservatif güncelleme |

Prior'ın etkisini test etmek için sensitivity analysis yapılmalı: aynı veriyi Beta(1,1), Beta(10,990), Beta(30,970) ile çalıştır. Posterior'lar %5'ten fazla fark ederse prior baskın — daha zayıf prior seç veya daha fazla veri topla.

Diğer tradeoff: Bayesian test frequentist kadar "publication-ready" değil. Akademik paper yazıyorsan p-value gerekir, C-suite'e sunum yapıyorsan posterior plot yeterli. [Dönüşüm Oranı Optimizasyonu](https://www.roibase.com.tr/tr/cro) süreçlerinde hız kritik — haftalık sprint döngüsünde Bayesian sequential test %40 daha hızlı sonuç verir (VWO 2023 benchmark'ına göre median 8 gün yerine 5 gün).

## Test Hızının İş Etkisi

Bayesian sequential testing'in asıl kazancı velocity. Performans pazarlamasında creative fatigue 10-14 gün, kampanya cycle 30 gün. Landing page testini 12 günde kapatıyorsan ayda 2 iteration yaparsın. Bayesian ile 5 günde kapatıyorsan 6 iteration. Her iterasyonda %5 lift varsayarsan yılsonu compound etkisi frequentist yaklaşımda %12, Bayesian'da %34 oluyor (1.05^12 vs 1.05^6).

Sequential testing ayrıca çoklu varyant testlerde (A/B/C/D) kazanç katlar. Frequentist çoklu karşılaştırmada Bonferroni düzeltmesi sample size'ı 3-4 kat artırır. Bayesian'da ise her varyant için ayrı posterior, pairwise karşılaştırmalar alpha spending olmadan yapılır. 4 varyantta frequentist 15 gün isterken Bayesian 6 günde bitirir.

Son nokta: erken durma sadece kazanan testte değil, kaybeden testte de önemli. B varyantta %20 conversion düşüşü görüyorsan 3. günde P(A > B) = %99 oluyor — testi durdurursun, traffic waste önlenmiş olur. Frequentist'te 12 gün beklemen lazım, 9 gün boyunca düşük conversion'lı sayfaya trafik gönderiyorsun. Bayesian sequential testing bu downside protection sağlar.

Sequential Bayesian A/B test artık lüks değil — zorunluluk. Cookie deprecation sonrası attribution zor, kampanya cycle kısa, creative refresh hızlı. Klasik frequentist testler bu hızı tutamıyor. Bayesian posterior güncelleme mantığıyla her gün yeni bilgi toplanıyor, confidence threshold'a ulaştığında karar veriliyor. Erken durma bias değil, özellik. Prior seçiminde disiplin, stopping rule netliği ve practical significance filtresi olduğu sürece Bayesian test hem hızlı hem güvenilir sonuç veriyor.