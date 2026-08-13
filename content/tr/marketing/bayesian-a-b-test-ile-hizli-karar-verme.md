---
title: "Bayesian A/B Test ile Hızlı Karar Verme"
description: "Frequentist testlerin p<0.05 hapsi yerine Bayesian yaklaşım: sequential sampling, erken durma, belirsizlik ölçümü. Performans pazarlamasında hız kazanma rehberi."
publishedAt: 2026-08-13
modifiedAt: 2026-08-13
category: marketing
i18nKey: marketing-002-2026-08
tags: [bayesian-testing, ab-test, conversion-optimization, frequentist-statistics, sequential-sampling]
readingTime: 8
author: Roibase
---

Performans pazarlamasında A/B test hala 2010'ların frequentist metodolojisiyle yapılıyor: sabit sample size hesabı, p<0.05 eşiği, "henüz anlamlı değil" beklemesi. Meta Ads'te üç kreatif varyasyon test ediyorsun, biri açık kaybediyor ama "sample size yetmedi" diye iki hafta daha para yakıyorsun. Bayesian A/B test bu döngüyü kırıyor: erken durma hakkı veriyor, belirsizlik ölçümü sunuyor, "kazanma olasılığı %94" diyor. Google Optimize kaldırıldı, kendi test stack'ini kuruyorsan Bayesian matematik sana hız kazandırır.

## Frequentist Testlerin Sabit Oyun Kuralları

Klasik A/B test şu mantıkla çalışır: önceden sample size hesapla (power analysis: %80 güç, %5 alpha, %10 beklenen lift), o sayıya ulaşana kadar bekle, p-değerine bak, karar ver. Problem: gerçek dünyada lift tahminlerin %10 değil %3 çıkıyor, sample size 2 haftadan 8 haftaya uzuyor. Bu süre içinde creative yoruldu, sezonluk etki değişti, ödediğin CPM %40 arttı. Frequentist'te erken bakma yasak — "peeking" denen bu davranış tip-1 hata şişirir. Sequential testing yapsan bile alpha spending fonksiyonu (Bonferroni, O'Brien-Fleming) ek karmaşıklık getirir, yine katı eşikler ister.

Bir e-ticaret senaryosu: kontrol variant %2.1 CR veriyor, yeni checkout flow %2.3 veriyor. 1000 oturum sonra %9.5 lift var ama p=0.12. Frequentist der: "anlamlı değil, devam". 2000 oturumda p=0.08, hala yetmez. 3500 oturumda p=0.047, anlamlı. Ama o noktada B variantı 3 hafta canlıda, sezon geçti, kazancı tahmin etmek imkansız. Frequentist matematik binary karar verir: anlamlı veya değil. Belirsizlik aralığı (confidence interval) var ama "karar vermek için %95 CI gerekli" dışında kullanılmaz.

## Bayesian Yaklaşımda Olasılık Dağılımı

Bayesian istatistik farklı soru sorar: "B variantının A'dan daha iyi olma olasılığı nedir?" Cevap sürekli güncellenen bir posterior dağılım. Prior belief (ön bilgi) + veri = posterior. Her yeni oturum geldiğinde posterior yeniden hesaplanır. 100 oturumda %72 kazanma olasılığı, 500'de %88, 1000'de %94. Sabit eşik yok, sen karar verirsin: %90 üzerinde durdurmak yeterli mi, %95 bekle mi?

Matematik: beta-binomial model. Conversion rate prior'u Beta(α=1, β=1) (uniform), her conversion α'yı +1 artırır, her non-conversion β'yı +1. Posterior Beta(α + conversions, β + non-conversions). İki variant için iki beta dağılımı var, Monte Carlo ile 10000 sample çekip "B > A" olma frekansını sayıyorsun. Python: `scipy.stats.beta.rvs`. BigQuery'de UDF ile de çözülebilir ama sampling için Python daha hızlı.

```python
from scipy.stats import beta

# Variant A: 50 conversion, 2000 impression
a_alpha, a_beta = 1 + 50, 1 + (2000 - 50)
# Variant B: 58 conversion, 2000 impression
b_alpha, b_beta = 1 + 58, 1 + (2000 - 58)

samples_a = beta.rvs(a_alpha, a_beta, size=10000)
samples_b = beta.rvs(b_alpha, b_beta, size=10000)

prob_b_wins = (samples_b > samples_a).mean()
# Output: 0.847 → %84.7 kazanma olasılığı
```

Bu çıktıyı günlük dashboard'a koy: "B variantı %84.7 olasılıkla kazanıyor, beklenen lift %15.3, %95 credible interval [%2.1, %29.8]". CMO'ya rapor verirken "anlamlı mı değil mi" ikilemine düşmüyorsun, risk ölçüsü sunuyorsun. %85 olasılık yetiyorsa durdur, yetmiyorsa devam. Sequential decision — her gün yeniden değerlendirme hakkın var.

## Sequential Sampling ve Erken Durma Kriteri

Bayesian'ın asıl gücü: istediğin zaman test'i durdurabilirsin. Frequentist'te peeking yasak çünkü her bakışta tip-1 hata şişer, Bayesian'da posterior güncellenir ama tip-1 hata kavramı yok (long-run frekansı yerine belief güncelleme). Erken durma kriteri sen belirlersin: "Kazanma olasılığı %95 üzeri veya %5 altı ise dur". Bu kriter ile ortalama sample size %30-50 düşer (VWO 2024 benchmark verisine göre).

Ama dikkat: çok erken bakma yine yanıltır. İlk 50 oturumda %98 kazanma olasılığı görebilirsin, rastgele dalgalanma yüzünden. Burada Bayesian regret minimizasyonu devreye girer: expected value of information (EVOI) hesaplarsın. EVOI = (beklenen kazanç) - (test devam etmenin maliyeti). Eğer EVOI negatif, dur. Pratik yaklaşım: minimum sample size koru (örn. 500 impression/variant), sonra Bayesian stopping rule uygula.

[Dönüşüm Oranı Optimizasyonu](https://www.roibase.com.tr/tr/cro) sürecinde Bayesian test Meta Ads creative testinde şu şekilde çalışır: 3 creative variant, her birine günlük $100 budget. İlk 2 günde variant C açık kaybeder (%2.1 CTR vs A/B'nin %3.8), Bayesian posterior %97 "C kaybediyor" der. C'yi durdur, kalan budget'i A/B'ye aktar. 5. günde A %91 olasılıkla kazanıyor, B'yi durdur, A'ya full git. Toplam 7 günde karar verdin, frequentist 14 gün beklerdi.

## Expected Loss ve Risk Yönetimi

Kazanma olasılığı tek metrik değil. B variantı %60 olasılıkla kazanıyor ama kaybederse ortalama -%8 CR loss, kazanırsa +%3 CR gain. Bu durumda B'ye geçmek riskli. Expected loss metriği bunu ölçer: kaybettiğin senaryo'daki CR farkının posterior ortalaması. Formül: `E[max(0, A - B)]`. Python'da `numpy.maximum(samples_a - samples_b, 0).mean()`. Eğer expected loss <%1 ve kazanma olasılığı >%70, güvenle geç.

Tablo: Bayesian karar matrisi

| Kazanma olasılığı | Expected loss (CR) | Karar |
|---|---|---|
| %94 | 0.3% | Hemen geç |
| %78 | 1.2% | Daha fazla veri topla |
| %51 | 2.8% | Dur, fark yok |

Bu tablo dashboard'ta canlı kalır. Product manager'a "B'ye geçelim mi?" diye sormuyorsun, "B %78 kazanıyor ama expected loss %1.2, 200 oturum daha toplayalım" diyorsun. Karar net, risk ölçülü, zaman kaybı yok.

## Prior Seçimi ve Sensitivity Analysis

Bayesian matematik prior seçimine bağlı. Uniform prior (Beta(1,1)) en yalın, veri egemen olur. Ama domain bilgin varsa informative prior koy: geçmiş testlerden CR %2-3 arası dağılıyor, o zaman Beta(20, 980) prior kullan (mean=%2 olan beta). Bu prior ilk 100 oturumda posterior'u stabilize eder, rastgele dalgalanmayı azaltır.

Prior hassasiyeti test et: 3 farklı prior ile posterior çalıştır (uniform, weakly informative, strongly informative), kazanma olasılığı %5'ten fazla değişiyorsa veri yetersiz. Örnek: uniform prior %82 veriyor, strongly informative %77 veriyor, fark <%5, güvenle ilerle. Fark >%10 ise daha fazla veri topla veya prior'u yeniden kalibrate et (geçmiş test verisiyle).

Kod: prior sensitivity

```python
priors = [
    (1, 1),           # uniform
    (10, 490),        # weakly informative, mean=2%
    (30, 1470)        # strongly informative, mean=2%
]

for alpha, beta_prior in priors:
    a_posterior = beta.rvs(alpha + 50, beta_prior + 1950, size=10000)
    b_posterior = beta.rvs(alpha + 58, beta_prior + 1942, size=10000)
    prob = (b_posterior > a_posterior).mean()
    print(f"Prior Beta({alpha},{beta_prior}): P(B>A)={prob:.2f}")
```

Çıktı tutarlı ise (±%3), prior seçimi robust.

## Kapanış: Hız Kazanımı ve Organizasyonel Adaptasyon

Bayesian A/B test tek başına yeterli değil, organizasyonel karar sürecini de değiştirmen gerekir. "Anlamlı çıkana kadar bekle" kültüründen "risk ölçerek ilerle" kültürüne geçiş yapmalısın. CMO'ya %100 kesinlik değil %90 olasılık sunuyorsun, bu alışkanlık değişimi ister. Ama kazanç net: ortalama test süresi 14 günden 7 güne düşer, kaybeden variant maliyeti %50 azalır, creative iteration hızı 2x artar. Meta Ads'te bu hız kazanımı direkt ROAS'a yansır — daha çok test, daha iyi winning creative, daha düşük CPA. Bayesian matematiği dataflow'a entegre ettiğinde (BigQuery + dbt + Looker), manuel hesap yok, otomatik posterior update var, her sabah fresh karar metrikleri önünde.