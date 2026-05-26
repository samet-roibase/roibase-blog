---
title: "Mobile F2P'de Bayesian Price Optimization"
description: "IAP fiyat testlerinde posterior estimation ile segmentli optimizasyon: conversion, revenue, LTV dengesi için olasılıksal model yaklaşımı."
publishedAt: 2026-05-26
modifiedAt: 2026-05-26
category: gaming
i18nKey: gaming-002-2026-05
tags: [f2p-monetization, bayesian-testing, iap-optimization, price-ladder, mobile-gaming]
readingTime: 8
author: Roibase
---

F2P mobile oyunlarda IAP fiyatlandırması hâlâ sezgiyle yürüyor: $0.99, $4.99, $9.99 ladder'ı kopyalanır, conversion düşükse fiyat indirilir, yüksekse "daha fazla value ekleyelim" denir. Ama aynı $4.99 paketi organik kullanıcıda %2.1, UA cohort'unda %1.4, D30+ whale segment'inde %8.7 conversion gösterebilir. Klasik A/B test burada yetersiz kalır: ya sample size patlar ya bekleme süresi 6 haftayı bulur ya da revenue/conversion tradeoff'unda hangi metriğe optimize edeceğiniz net olmaz. Bayesian price optimization bu üç sorunu aynı anda çözer: posterior distribution ile erken sinyal toplar, segment-level LTV etkisini modeller, revenue-conversion dengesini probabilistic çerçevede yönetir.

## Frequentist A/B'nin IAP Fiyatlandırmasındaki Tıkanması

Standart A/B test iki fiyat arasında p<0.05 farkı görmek için conversion rate'e göre sample size hesaplar. %2 baseline conversion, %10 relative lift hedefi, 80% power için ~15.000 exposure gerekir. Orta-katman IAP için bu 4-6 hafta demektir. Test süresi uzayınca:

- Meta kampanyalarında CPI artar (creative fatigue)
- Organik cohort mix kayar (holiday effect, ASO rank değişimi)
- Rakip oyun yeni event başlatır, demand elasticity bozulur

Daha kritik sorun revenue-conversion split: $2.99'dan $4.99'a geçince conversion %2.1'den %1.7'ye düşer ama revenue per mille %42 artar. p-value hangi metrikte hesaplanacak? Çoğu stüdyo burada "revenue kazandık" deyip geçer ama D7 LTV modellemesi yapıldığında whale segment'inin %31 churn ettiği, yeni fiyatın retention'ı vurduğu görülür.

Bayesian yaklaşım bu ikilemde conversion ve revenue'yu aynı posterior model içinde tutar: prior belief (önceki testlerden gelen beta dağılımı) + gözlem (yeni data) → posterior (güncellenen inanç). Test 3. günden itibaren "şu ana kadar %73 olasılıkla $4.99 daha iyi" diyebilir, 7. günde %89'a çıkar, 10. günde regret 1%'in altına düşünce test kesilir.

## Prior Distribution Kurma: Benchmark Yerine Historik IAP Data

Bayesian test'in kalitesi prior'ı doğru kurmaya bağlı. Çoğu dokümantasyon "uniform prior al, data konuşsun" der ama mobile F2P'de 6 ay IAP historiniz varsa bu kaynağı yakmak mantıksız. Örnek prior kurma süreci:

**Adım 1:** Son 6 ay tüm IAP tier'larının conversion rate dağılımını çek. $0.99-$2.99 arası conversion %1.8-3.2 aralığında dağılıyor, median %2.4. Beta dağılımı için alpha=24, beta=976 parametreleri bu dağılımı yansıtır (mean=alpha/(alpha+beta)≈0.024).

**Adım 2:** Segment-level variance ekle. Organik cohort prior'ı UA cohort'undan %18 daha yüksek conversion gösterir (alpha=28, beta=972). Whale segment için ayrı prior: D30+ paying user'da conversion %6.8, alpha=68, beta=932.

**Adım 3:** Price elasticity curve fit'i. Historik datada $1.99 → $2.99 geçişi conversion'ı ortalama %14 düşürmüş. Yeni test $2.99 → $3.99 olacaksa bu slope'u prior'a kod:

```python
def price_elasticity_prior(base_price, new_price, base_conversion):
    slope = -0.14 / 1.00  # $1 artışta %14 düşüş
    delta = new_price - base_price
    expected_drop = slope * delta
    adjusted_conversion = base_conversion * (1 + expected_drop)
    alpha = adjusted_conversion * 1000
    beta = 1000 - alpha
    return alpha, beta
```

Bu yaklaşım "industry benchmark %2.5" gibi dış kaynaktan çok oyunun kendi cohort davranışını yansıtır.

## Posterior Estimation ile Segmentli Fiyat Ladder

Test setup: starter pack $2.99 vs $3.99, 7 gün boyunca UA traffic'e %50/%50 dağıtılacak. Ama segment split zorunlu:

| Segment | Prior α | Prior β | Sample size hedef |
|---------|---------|---------|-------------------|
| D0-D7 organik | 28 | 972 | 4000 |
| D0-D7 UA | 22 | 978 | 6000 |
| D7+ non-payer | 18 | 982 | 3000 |
| D7+ past buyer | 68 | 932 | 2000 |

Her segment'te posterior ayrı güncellenir. 3. gün sonuçları:

**Organik segment:** $2.99 → 87 conversion / 2100 exposure, $3.99 → 71 / 2050. Posterior: α₁=28+87=115, β₁=972+2013=2985 vs α₂=28+71=99, β₂=972+1979=2951. Monte Carlo 10.000 sample ile P($2.99 daha iyi) = %78. Revenue açısından: $2.99 × 87 = $260, $3.99 × 71 = $283. Revenue posterior'u gamma dağılımı ile modellenirse P($3.99 revenue üstün) = %61.

Bu noktada karar: organik segment'te conversion öncelikli ise $2.99 devam, revenue öncelikli ise 2 gün daha bekle. UA segment'te ise $3.99 açık üstün (%83 posterior probability), test erken kesilip o segment $3.99'a yönlendirilir.

**Segment bazlı price ladder dinamik kurma:** Test bittiğinde IAP inventory şöyle olur:

- Organik D0-D3: $2.99 starter
- UA D0-D3: $3.99 starter
- D7+ past buyer: $7.99 booster (ayrı test posterior'undan)
- Whale (D30+ $50+ LTV): $14.99 premium bundle

Bu yapı tek global fiyat yerine 4 farklı elasticity curve'ü optimize eder. [App Store Optimization](https://www.roibase.com.tr/tr/aso) çalışmasında bu segmentasyon custom product page stratejisi ile birleştirilirse IAP funnel daha da kişiselleşir: creative'de gösterilen value proposition ile IAP tier eşleşir.

## Thompson Sampling ile Multi-Armed Bandit Extension

7 günlük fixed test yerine Thompson sampling extension: her impression geldiğinde segment posterior'undan sample çek, en yüksek expected value veren fiyatı göster. Böylece test süresi boyunca exploration/exploitation dengesi dinamik kurulur.

Pseudo-code:

```python
def thompson_sampling_price(segment, price_variants):
    posteriors = {p: get_posterior(segment, p) for p in price_variants}
    samples = {p: np.random.beta(post['alpha'], post['beta']) 
               for p, post in posteriors.items()}
    revenue_samples = {p: s * p for p, s in samples.items()}
    return max(revenue_samples, key=revenue_samples.get)
```

Bu yaklaşım özellikle 3+ fiyat variant'ı test edilirken regret minimize eder. Klasik A/B'de 3 fiyat testi 3× sample size ister, Thompson sampling posterior güncelleme ile kötü variant'ı otomatik sıfırlar. 10. günde $2.99 posterior'u %9'a düşmüşse exposure oranı %5'e iner, sample waste olmaz.

Dikkat: Thompson sampling UA kaynağı unlimited değilse budget tükenme riski taşır. Meta kampanyasında günlük $5000 budget varsa, Thompson'ın seçtiği fiyat conversion'ı düşürür, CPA patlar, bütçe öğlen tükenir. Güvenli kurulum: ilk 3 gün %50/%50 split, posterior credibility %80'i geçince Thompson aç.

## Revenue vs LTV: Posterior'u Retention Modeliyle Birleştirme

IAP fiyat optimizasyonunun final katmanı LTV projeksiyon. $3.99 conversion düşük ama D7 retention %8 yüksek gösteriyorsa, o cohort'un 90 günlük LTV'si $2.99 cohortunu geçebilir. Klasik A/B bunu görmez çünkü LTV 90 gün sonra kesinleşir. Bayesian posterior'u survival model ile birleştirince erken sinyal yakalanır.

Setup: Her fiyat variant'ının ilk 7 gününde retention curve fit'i Cox proportional hazard model ile:

```python
from lifelines import CoxPHFitter

df['price_variant'] = df['variant'].map({'2.99': 0, '3.99': 1})
cph = CoxPHFitter()
cph.fit(df, duration_col='days_retained', event_col='churned', 
        formula='price_variant + segment + paid_d3')
```

Model output: $3.99 variant hazard ratio 0.88 (churn %12 düşük, p=0.03). Bunu posterior ile birleştir:

**LTV posterior hesabı:**
- $2.99: E[conversion]=0.024, E[D90_retention]=0.34, ARPDAU=$0.12 → LTV=$2.99 × 0.024 + 90 × 0.34 × 0.12 = $3.74
- $3.99: E[conversion]=0.019, E[D90_retention]=0.38, ARPDAU=$0.15 → LTV=$3.99 × 0.019 + 90 × 0.38 × 0.15 = $5.21

Monte Carlo 10.000 iteration ile LTV posterior dağılımı: P($3.99 LTV üstün) = %91. Bu posterior credibility revenue-only bakıştan çok daha güçlü sinyal. Karar: $3.99 seç, IAP stack'i yeniden dengele.

## Tradeoff: Model Complexity vs Execution Speed

Bayesian IAP optimizasyonu üç operasyonel maliyet taşır:

**1. Prior maintenance:** Her yeni event, meta değişimi, competitor launch prior distribution'ı değiştirir. 6 ayda bir re-calibration şart. Küçük stüdyolarda data scientist yoksa bu sürdürülemez.

**2. Segment granularity:** 8 segment × 3 fiyat = 24 posterior tracking. Sample size küçük segmentlerde (örn. whale) posterior variance yüksek kalır, güven aralığı geniş olur. Pratik çözüm: whale segment'i ayrı çıkar, A/B test koru, diğerlerinde Bayesian.

**3. Platform fragmentation:** iOS vs Android price sensitivity farklı. Apple App Store'da $2.99 conversion Android'den %23 yüksek (App Annie 2025). İki platform ayrı posterior mu yoksa pooled mı? Ayrı tutarsan sample split olur, pooled tutarsan platform bias girer. Çözüm: hierarchical Bayesian model — platform random effect olarak eklenir.

Yine de Bayesian, 4+ hafta A/B beklemekten hızlıdır. Test 10 günde kesilir, revenue impact 2. haftada görülür, LTV projeksiyon 30. günde güncellenir. Frequentist'te bu timeline 8-12 haftadır.

## Sonuç: Probabilistic Pricing Mindset

Mobile F2P'de fiyat testi artık binary değil, continuous posterior updating süreci. Conversion ve revenue metriklerini ayrı p-value'larla çözmek yerine, her ikisini de probabilistic çerçevede modellemek regret minimize eder, test süresini kısaltır, segment-level optimizasyona imkan verir. Bayesian yaklaşım prior kurma disiplini ister ama karşılığında erken karar hakkı, LTV projection entegrasyonu, Thompson sampling ile dynamic allocation sağlar. IAP stack'iniz 5+ tier'sa ve UA bütçeniz ayda $100K+'yı geçiyorsa, Bayesian test altyapısı artık isteğe bağlı değil, zorunludur.