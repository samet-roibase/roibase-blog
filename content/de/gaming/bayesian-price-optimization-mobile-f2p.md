---
title: "Mobile F2P'de Bayesian Price Optimization"
description: "IAP fiyat testlerini posterior estimation ile optimize edin. Segmentasyon, test süresi, conversion trade-off'ları — F2P gelirini artıran gerçek framework."
publishedAt: 2026-06-24
modifiedAt: 2026-06-24
category: gaming
i18nKey: gaming-002-2026-06
tags: [f2p-monetization, bayesian-optimization, iap-testing, mobile-gaming, pricing-strategy]
readingTime: 8
author: Roibase
---

Mobile F2P oyunlarda fiyat optimizasyonu hâlâ A/B test mantığıyla yapılıyor: iki price point, 7-14 gün, kazanan seçilir. Ancak conversion rate %2.8'den %3.1'e çıktığında bu gerçekten kazanç mı, yoksa whale segmentini kaçırıp genel LTV'yi mi düşürdünüz? Klasik frequentist A/B test size "hangi variant kazandı" der ama "hangi fiyat hangi kullanıcı segmentine ne zaman sunulmalı" sorusuna yanıt vermez. Bayesian price optimization bu boşluğu dolduruyor — IAP ladder'ınızı posterior distribution üzerinden güncelleyerek hem conversion'ı hem segment-spesifik revenue'yu birlikte optimize edebiliyorsunuz.

## Frequentist A/B Testin F2P'de Neden Yetersiz Kaldığı

Klasik A/B test iki varsayımla çalışır: (1) test süresi boyunca kullanıcı davranışı stabil, (2) kazanan variant tüm segment için optimal. F2P'de ikisi de yanlış. Kullanıcı davranışı ilk 72 saatte, 7. günde ve 30. günde farklılaşır — aynı fiyat farklı retention cohort'larında farklı performans gösterir. Bir örnek: $4.99 starter pack conversion'ı %3.5, $9.99 variant %2.8 gösterdi — klassik A/B mantığıyla $4.99 kazandı. Ancak 30 günlük LTV analizi $9.99 variant'ın whale segmentinde (top %5 spender) %42 daha yüksek lifetime spend ürettiğini gösterdi. Frequentist test bu dinamiği görmez çünkü segment-bazlı posterior tahmin yapmaz.

İkinci sorun test süresinin sabit olması. A/B test 14 gün sürer, sonra karar verilir — ama 14. günde yeterli istatistiksel güce ulaşmamış olabilirsiniz. Bayesian yaklaşımda posterior distribution sürekli güncellenir, yeterli confidence geldiğinde erken durdurabilir ya da muğlak sonuç varsa uzatabilirsiniz. Bu F2P'de kritik çünkü live ops calendar'ınız iki hafta beklemez — yeni event gelir, pricing context değişir, test sonucunuz tarihi kalır.

Üçüncü sorun binary karar mantığı. Frequentist test size "A kazandı" der, ama F2P'de kazanan variant yoktur — doğru fiyat doğru segmentte doğru zamanda sunulur. Bayesian optimization posterior estimation sayesinde her segment için optimal price range'i verir, bu da dynamic pricing engine'e girdi olur.

## Bayesian Price Ladder Testi: Posterior Estimation ile İteratif Optimizasyon

Bayesian price optimization üç katmanda çalışır: prior distribution (önceki test verisi + domain bilgisi), likelihood function (güncel conversion data), posterior distribution (ikisinin çarpımı — güncellenmiş inanç). IAP fiyat testinde şöyle uygulanır:

**Prior belirleme:** Önceki price test'lerden conversion rate ve revenue distribution'ınız var. Örneğin $4.99 IAP için conversion prior'ınız Beta(120, 3800) — 120 conversion, 3800 impression. Bu prior oyununuzun baseline'ı. Yeni test'e $6.99 ekleyecekseniz, prior'ı domain bilgisiyle kurun: fiyat %40 artarken conversion genelde %25-35 düşer (elasticity -0.6 ile -0.9 arası). Prior'ınız Beta(80, 3840) olabilir.

**Likelihood güncellemesi:** Test başladı, her gün yeni conversion verisi geliyor. Bayesian framework her gün posterior'u günceller. 3. günde $6.99 variant 45 conversion, 1200 impression gösterdi — likelihood Beta(45, 1155). Posterior = prior × likelihood = Beta(125, 4995). Bu size güncel conversion rate tahminini verir: 125/(125+4995) ≈ %2.44. Önemli olan: bu sadece point estimate değil, distribution — %95 credible interval [%2.1, %2.8]. Yani conversion %2.1 ile %2.8 arasında olma ihtimali %95.

**Thompson Sampling ile dinamik allocation:** Klasik A/B'de traffic %50-%50 split olur. Bayesian optimization'da Thompson Sampling kullanırsınız: her impression'da posterior distribution'dan bir sample çek, en yüksek expected revenue veren variant'ı göster. Bu sayede test ilerledikçe daha iyi performans gösteren variant'a trafik kayar, ama kesin karar için %100 allocation yapmaz — hâlâ explore eder. F2P'de önemli çünkü whale segment küçük ama yüksek value'lu, erken kesilirse kaçırılır.

Kod örneği (Python + PyMC):

```python
import pymc as pm
import numpy as np

# Prior: $4.99 IAP conversion
prior_alpha_499 = 120
prior_beta_499 = 3800

# $6.99 variant — yeni test
conversions_699 = 45
impressions_699 = 1200

with pm.Model() as price_test:
    # Posterior güncelleme
    conv_rate_699 = pm.Beta('conv_rate_699', 
                             alpha=prior_alpha_499*0.7 + conversions_699,
                             beta=prior_beta_499*1.0 + (impressions_699 - conversions_699))
    
    # Revenue beklentisi (IAP price × conversion)
    expected_revenue = conv_rate_699 * 6.99
    
    # Sampling
    trace = pm.sample(2000, return_inferencedata=True)

# %95 credible interval
print(pm.summary(trace, var_names=['conv_rate_699']))
```

Bu yaklaşım size "3. günde $6.99 conversion'ı %2.1-2.8 arası, expected revenue $0.17/user" der — test devam ettikçe interval daralır.

## Segment-Spesifik Price Ladder: Whale, Dolphin, Minnow Optimizasyonu

F2P'de tüm kullanıcılar aynı fiyata aynı tepkiyi vermez. Segment-bazlı posterior estimation yapmazsanız, ortalama conversion'ı optimize eder ama segment-spesifik revenue'yu kaçırırsınız. Üç temel segment:

**Whale (top %5 spender):** LTV $200+, IAP sayısı 8+, retention D30 %85+. Bu segment fiyat hassasiyeti düşük — $9.99 IAP %15 daha az convert olsa bile, lifetime spend %60 daha yüksek olabilir. Posterior estimation burada şu soruyu yanıtlar: "$9.99 whale segment'te optimal mi, yoksa $14.99 daha yüksek LTV getirir mi?" Test süresi boyunca whale cohort conversion'ını ayrı izlersiniz, posterior whale-spesifik güncellenir. Örnek: genel conversion $9.99'da %2.8 ama whale segment %6.2 — bu segment için daha yüksek price point test etmelisiniz.

**Dolphin (orta %25 spender):** LTV $20-50, IAP sayısı 2-4, retention D30 %50-70. Fiyat hassasiyeti orta. Dolphin segment'te Bayesian test genelde optimal price range bulur: $4.99 ile $6.99 arası, hangisi daha yüksek expected revenue veriyor. Posterior distribution burada bi-modal olabilir — bazı dolphin'ler whale davranışı gösterir (weekend spiker), bazıları minnow'a kayar. Segmentasyon refinement gerekir.

**Minnow (geri kalan %70):** LTV <$10, çoğu non-payer. Fiyat hassasiyeti çok yüksek — $2.99 ile $4.99 arası bile conversion %40 değişebilir. Bu segment'te Bayesian test genelde şu sonucu verir: en düşük price point ($0.99-$1.99) maksimum conversion sağlıyor ama total revenue düşük. Strateji: minnow'ları ilk IAP'ye çekmek için $0.99 "impulse buy" sunun, sonra $4.99 ladder'a yönlendirin.

Segment-bazlı posterior estimation için hierarchical Bayesian model kullanılır:

```python
with pm.Model() as hierarchical_price:
    # Global conversion prior
    global_alpha = pm.Gamma('global_alpha', alpha=2, beta=0.1)
    global_beta = pm.Gamma('global_beta', alpha=2, beta=0.1)
    
    # Segment-spesifik conversion
    conv_whale = pm.Beta('conv_whale', alpha=global_alpha, beta=global_beta)
    conv_dolphin = pm.Beta('conv_dolphin', alpha=global_alpha, beta=global_beta)
    conv_minnow = pm.Beta('conv_minnow', alpha=global_alpha, beta=global_beta)
    
    # Likelihood (segment data)
    whale_obs = pm.Binomial('whale_obs', n=200, p=conv_whale, observed=12)
    dolphin_obs = pm.Binomial('dolphin_obs', n=800, p=conv_dolphin, observed=24)
    minnow_obs = pm.Binomial('minnow_obs', n=3000, p=conv_minnow, observed=60)
    
    trace = pm.sample(3000)
```

Bu model whale, dolphin, minnow conversion'larını global prior ile bağlar — küçük sample size'da bile reasonable estimate verir.

## Test Süresi ve Stopping Rule: Posterior Probability ile Karar Mekanizması

Klasik A/B'de test süresi önceden belirlenir (14 gün, minimum 1000 conversion). Bayesian optimization'da stopping rule posterior probability üzerinden kurulur: "Variant A'nın Variant B'den daha iyi olma ihtimali %95'i geçti mi?" Bu dinamik durdurma hem erken kazanç sağlar hem false positive riskini düşürür.

**Stopping rule örneği:** $4.99 vs $6.99 IAP testi. Her gün posterior güncelleniyor. 5. günde posterior probability hesaplanır:

```python
# Posterior samples
samples_499 = trace.posterior['conv_rate_499'].values.flatten()
samples_699 = trace.posterior['conv_rate_699'].values.flatten()

# Revenue comparison (price × conversion)
revenue_499 = samples_499 * 4.99
revenue_699 = samples_699 * 6.99

# Probability $6.99 daha iyi
prob_699_better = (revenue_699 > revenue_499).mean()
print(f"P($6.99 > $4.99) = {prob_699_better:.2%}")
```

5. günde P($6.99 > $4.99) = %73 — henüz karar vermeyin. 9. günde %94 — hâlâ %95 eşiğinin altında. 12. günde %96 — testi durdurun, $6.99 optimal. Bu yaklaşım frequentist'e göre 2-5 gün tasarruf sağlar.

**Minimum test süresi:** Bayesian erken dursa bile F2P'de minimum 7 gün koşun — ilk hafta retention spike, weekend spender davranışı, event effect görülür. 7 günden önce durdurursanız posterior biased olur.

**Regret minimization:** Thompson Sampling kullanıyorsanız, test boyunca suboptimal variant'a trafik verirsiniz (exploration). Regret = optimal revenue - actual revenue. Bayesian framework regret'i minimize eder çünkü posterior günceldikçe exploration azalır, exploitation artar. 14 günlük test'te ilk 5 gün %30 regret, son 5 gün %5 regret — ortalam %15. Klasik A/B'de sürekli %50 traffic split olduğu için average regret %25-30.

## Production'a Geçiş: Dynamic Pricing Engine ve Posterior Refinement

Test bitti, $6.99 kazandı — ama iş bitmedi. Bayesian price optimization'ın asıl gücü production'da sürekli posterior refinement yapması. Test sonucu statik price point değil, dinamik pricing engine'e girdi olur.

**Dynamic pricing engine mimarisi:** Her kullanıcı session'ında segment tahmini yapılır (LTV prediction, retention cohort, spending velocity). Segmente göre posterior distribution'dan optimal price point sample'lanır. Örnek: yeni kullanıcı, D1 retention %80, ilk IAP henüz yok — minnow prior'ı dominant, $0.99-$1.99 range sample'lanır. Aynı kullanıcı D7'de 2 IAP yaptı, total spend $8 — dolphin posterior güçlendi, $4.99-$6.99 range'e geçilir.

**Posterior refinement:** Production'da her conversion posterior'u günceller. 30 gün sonra $6.99 IAP 1200 ek conversion aldı — prior Beta(125, 4995), yeni posterior Beta(1325, 46995). Credible interval daraldı: [%2.7, %2.9]. Artık $6.99 fiyatına %95 confidence ile güveniyorsunuz. Ama market değişebilir — competitor $4.99 kampanya başlattı, conversion düştü — posterior tekrar genişler, yeni test tetiklenir.

**Multi-armed bandit integration:** IAP ladder birden fazla SKU içeriyorsa (starter pack $4.99, mega pack $19.99, ultimate $49.99), Thompson Sampling production'da bandit algoritması olur. Her impression'da her SKU için posterior sample çekilir, maksimum expected revenue veren sunulur. Bu [Oyun Pazarlaması Stratejisi](https://www.roibase.com.tr/de/dijitalpazarlama) çalışmalarıyla birleştirildiğinde güçlü bir monetization engine oluşur — ASO traffic'i doğru segment'e yönlendirir, Bayesian pricing o segment'