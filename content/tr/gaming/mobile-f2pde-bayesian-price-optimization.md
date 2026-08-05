---
title: "Mobile F2P'de Bayesian Price Optimization"
description: "IAP fiyat basamaklarını Bayesian testlerle optimize etmek: posterior estimation, segment-based pricing ve revenue lift hesaplama metodolojisi."
publishedAt: 2026-08-05
modifiedAt: 2026-08-05
category: gaming
i18nKey: gaming-002-2026-08
tags: [f2p-monetization, bayesian-testing, iap-optimization, price-ladder, mobile-gaming]
readingTime: 8
author: Roibase
---

Mobile F2P oyunlarda IAP fiyat optimizasyonu genellikle A/B testine indirgenir: iki fiyatı karşılaştır, yüksek revenue'yu seç. Bu yaklaşım 2018'de işliyordu çünkü UA maliyeti düşüktü ve sample size sorunu yoktu. 2026'da durum farklı: iOS 14.5 sonrası cohort tracking kırık, Apple Search Ads CPI %340 artmış, test süreleri 8 haftadan 14 haftaya çıkmış. Bayesian metodoloji bu koşullarda iki avantaj sağlıyor: posterior distribution ile erken karar verilebiliyor, segmentasyon prior bilgisiyle model güçleniyor. Oyun ekonomisinde price elasticity sabit değil — whale/dolphin/minnow segmentlerinde farklı davranıyor ve bu farkı yakalamak frequentist A/B'nin yeteneği dışında.

## Bayesian Testlerin Ekonomik Mantığı

Mobile F2P'de price test maliyeti sadece dev zamanı değil, opportunity cost. $4.99 yerine $6.99 testi yapıyorsanız ve 14 hafta bekliyorsanız, doğru fiyatı bulana kadar kaybettiğiniz revenue test maliyetinin kendisi. Bayesian yaklaşım posterior olasılık dağılımını her gün güncelliyor — conversion rate %2.3 değil, %1.8-%2.9 arası %95 credible interval. Bu interval daraldıkça karar net oluyor ve testi erken sonlandırabiliyorsunuz.

Frequentist A/B'de p-value <0.05 için minimum sample size hesaplıyorsunuz, o sayıya ulaşana kadar bekliyorsunuz. Oysa mobile gaming'de cohort size günlük dalgalanıyor: yeni feature launch olunca DAU +%40 artıyor, summer seasonality gelince -%25 düşüyor. Bayesian model bu dalgalanmayı prior güncelleme olarak okuyor, fixed sample size planına saplanmıyor.

Pratik örnek: 10,000 DAU oyunda $9.99 starter pack fiyatını test ediyorsunuz. Frequentist hesap 6 hafta +5% revenue lift detect etmek için 42,000 kullanıcı istiyor. Bayesian model 3. haftada posterior mean $11.2 ARPPU gösteriyor, control $10.8, %95 CI overlap etmiyor — karar verildi, test kapandı. 3 hafta kayıp revenue geri kazanıldı.

### Prior Seçimi ve Segmentasyon

Bayesian testlerde prior distribution seçimi subjektif değil, historical data ile şekilleniyor. Eğer geçen yıl benzer bir oyunda $4.99-$9.99 arası 8 price point test ettiyseniz, bu datadan beta distribution prior çıkarıyorsunuz. Prior weak olabilir (variance yüksek) ama bilgisiz uniform prior'dan iyi çünkü whale conversion rate'in %0.5'in altına düşmeyeceğini biliyorsunuz.

Segmentasyon prior'ı güçlendiriyor: yeni kullanıcılar için uninformative prior, 30+ gün retention'lı kullanıcılar için tight prior kullanıyorsunuz. Hierarchical Bayesian model segment-level ve global-level parametreleri aynı anda estimate ediyor — her segment kendi datasını kullanırken, global trend de paylaşılıyor. Bu yaklaşım küçük segmentlerde overfitting engelliyor.

## IAP Price Ladder Mimarisi

F2P oyunlarda price ladder flat değil, logaritmik skalada yayılıyor: $0.99, $2.99, $4.99, $9.99, $19.99, $49.99, $99.99. Bu sıçramaların psikolojik nedeni var (charm pricing) ama ekonomik nedeni daha güçlü: her basamak farklı bir willingness-to-pay segmentini yakalar. Bayesian optimizasyonda her basamağın kendi posterior'u var ve birbirini etkiliyor — $4.99'u artırırsanız $2.99 conversion düşebilir (downgrade), $9.99 artar (upgrade).

Ladder testinde tek bir fiyat değil, tüm merdiven optimize ediliyor. Multi-armed bandit algoritması her price point'i ayrı bir kol olarak görüyor, Thompson Sampling ile güncel posterior'dan sample alıp en yüksek expected revenue'yu seçiyor. İlk 2 haftada tüm kollar eşit explore ediliyor, 3. haftadan itibaren posterior confidence arttıkça exploitation ağırlık kazanıyor.

Örnek senaryo: 7 basamaklı ladder, 21 gün test. İlk 7 günde her fiyat %14 traffic alıyor (uniform). 8. günden itibaren posterior mean × conversion rate çarpımı en yüksek olan fiyat trafiği çekiyor. 21. günde $4.99 %40 traffic, $9.99 %25, diğerleri %5-10 arası. Final kararda $4.99 ve $9.99 birlikte tutuluyor çünkü ikisi de pozitif marginal revenue sağlıyor, birbirini cannibalize etmiyor.

### Segment-Based Pricing

Whale/dolphin/minnow segmentleri için aynı fiyat işlemez çünkü price elasticity farklı. Whale kullanıcılar (top %1 spender) $99.99 paketi alırken fiyat %20 artsa conversion %3 düşer — inelastic. Minnow kullanıcılar (ilk 7 günde $0.99 alan) %10 fiyat artışında %18 drop gösterir — elastic. Bayesian model bu elasticity'yi segment-level prior'da kodluyor.

Segmentasyon için kullanılan feature'lar: install tarihinden itibaren geçen gün sayısı (D1/D7/D30), toplam spend, son IAP'den geçen süre, session frequency, level progression. Bu feature'lardan latent segment prior oluşturuluyor — hierarchical model segment membership'i de estimate ediyor. Böylece yeni bir kullanıcı geldiğinde ilk 24 saatteki davranışından segment tahmini yapılıp ona göre price gösteriliyor.

Roibase'in [App Store Optimization](/tr/aso) çalışmalarında da benzer segmentasyon kullanılıyor: creative test sonuçları kullanıcı segmentine göre farklılaşıyor, same creative iOS 16+ kullanıcıda %8 IPM verirken iOS 15'te %3 veriyor. ASO ile IAP optimizasyonu birleştiğinde funnel bütünlüğü sağlanıyor — doğru fiyatı doğru kullanıcıya göstermek için önce doğru kullanıcıyı çekmek gerekiyor.

## Posterior Estimation ve Karar Mekanizması

Bayesian testte karar metriği posterior probability of superiority: $P(\text{treatment} > \text{control} | \text{data})$. Bu olasılık %95'i geçtiğinde treatment kazanır. Frequentist p-value'dan farkı: p-value null hypothesis altında data'nın ekstremliğini ölçer, posterior probability doğrudan "treatment'ın daha iyi olma olasılığı"nı verir.

Posterior hesabı için conjugate prior kullanılıyorsa analitik çözüm var (beta-binomial), değilse MCMC (Markov Chain Monte Carlo) simülasyonu. Mobile gaming testlerinde binomial conversion + lognormal revenue modeli hybrid — conversion için beta prior, revenue için lognormal prior. PyMC3 veya Stan ile 10,000 iteration MCMC 30 saniyede dönüyor, günlük data update ile posterior refresh ediliyor.

Karar threshold %95 yerine %90 da seçilebilir — agresif growth phase'de %90 yeterli, mature oyunda %95 kullanılıyor. Threshold düşük olursa false positive riski artar ama test süresi kısalır. Expected value of information (EVI) hesabıyla optimal threshold bulunuyor: testin 1 hafta daha sürmesinin maliyeti vs. yanlış karar riskinin maliyeti trade-off ediliyor.

### Multi-Variant Bayesian Test Yapısı

IAP fiyat testi genellikle 3+ variant içeriyor: control ($4.99), treatment A ($5.99), treatment B ($6.99). Frequentist A/B'de multiple comparison sorunu var, Bonferroni correction sample size'ı katlar. Bayesian'da her variant kendi posterior'una sahip, pairwise karşılaştırmalar aynı anda yapılıyor. Posterior mean en yüksek olanı seçmek yerine, expected revenue maksimizasyonu yapılıyor: her variant'ın win olasılığı × expected revenue çarpımı.

Thompson Sampling stratejisi: her günde her variant için posterior'dan 1 sample çek, en yüksek sample'ı seçip o variant'a traffic gönder. Bu strateji explore/exploit dengesini otomatik kurıyor — posterior uncertainty yüksekken (ilk günler) traffic dağılımı uniform'e yakın, sonra winning variant'a doğru kayıyor.

Code snippet (PyMC3 ile basit beta-binomial model):

```python
import pymc3 as pm

with pm.Model() as iap_model:
    # Prior: uniform beta
    p_control = pm.Beta('p_control', alpha=1, beta=1)
    p_treatment = pm.Beta('p_treatment', alpha=1, beta=1)
    
    # Likelihood
    obs_control = pm.Binomial('obs_control', n=n_control, p=p_control, observed=conversions_control)
    obs_treatment = pm.Binomial('obs_treatment', n=n_treatment, p=p_treatment, observed=conversions_treatment)
    
    # Posterior sampling
    trace = pm.sample(10000, return_inferencedata=False)
    
    # Probability of superiority
    prob_superiority = (trace['p_treatment'] > trace['p_control']).mean()
```

Bu model conversion rate'i optimize ediyor. Revenue optimizasyonu için lognormal prior eklenip `p × revenue_mean` joint posterior hesaplanıyor.

## Segment Migrasyonu ve Long-Term Impact

Price optimization tek seferlik test değil, continuous process. Kullanıcılar segment değiştiriyor: bugün minnow olan 30 gün sonra dolphin olabiliyor. Bayesian model bu migrasyonu capture etmiyor çünkü statik prior kullanıyor. Çözüm: dynamic prior update — her 30 günde posterior, yeni data ile birleştirilerek yeni prior oluyor.

Long-term impact ölçümü için cohort retention curve'ü Bayesian survival analysis ile modelleniyor. Price change D7 retention'ı %2 düşürürse ama LTV $12'dan $14'e çıkarıyorsa net pozitif. Survival model Weibull distribution ile shape ve scale parametrelerini estimate ediyor, posterior predictive check ile 90 günlük LTV forecast veriliyor.

Retention impact testi 6-8 hafta sürüyor çünkü D30 retention sinyalini beklemek gerekiyor. Bayesian yaklaşım D7 data ile D30 tahmin yapıyor — prior olarak geçmiş cohort'ların D7→D30 transition rate'i kullanılıyor. Bu sayede 3. haftada erken sinyal alınıyor: posterior mean D30 retention %18 ise ve %95 CI [%16, %20] ise, test devam ediyor; eğer [%14, %16] ise price change retention'ı kırıyor demektir, test durdurulup fiyat geri alınıyor.

## Oyun Ekonomisi ve Platform Dinamikleri

iOS ve Android kullanıcıları aynı price ladder'a farklı tepki veriyor. iOS kullanıcılar ortalama %23 daha yüksek ARPPU gösteriyor, aynı $4.99 fiyat iOS'ta %3.2 conversion, Android'de %2.1. Bayesian model platform'u hierarchical factor olarak ekliyor — her platform kendi segment prior'una sahip ama global trend paylaşılıyor.

Apple'ın App Store pricing tier sistemi (Tier 1 = $0.99, Tier 5 = $4.99...) fiyat esnekliğini kısıtlıyor. Tier arası geçişlerde posterior'ı test etmek yerine grid search yapılıyor: Tier 3/4/5 arasında en yüksek posterior expected revenue. Google Play daha esnek (arbitrary pricing) ama conversion rate daha volatil — Android testlerinde prior variance %30 daha geniş tutuluyor.

Currency fluctuation da posterior'ı etkiliyor: Türkiye'de TRY bazlı fiyat ₺49.99 iken dolar ₺25'ten ₺35'e çıkarsa real price $2'dan $1.43'e düşüyor. Model currency-adjusted revenue kullanıyor, posterior USD bazında hesaplanıyor. Emerging market'lerde PPP-adjusted pricing için ayrı prior — aynı oyunda ABD $4.99, Brezilya R$9.90 (PPP eşdeğeri ~$1.80) olabilir.

[Premium Yayıncı Programı](/tr/premiumyayinci) kapsamında UA campaign'leri de price test sonuçlarını besliyor: yüksek LTV segment için CPM bidding artırılıyor, düşük conversion segment için bid düşürülüyor. Bayesian IAP model ile UA bidding stratejisi entegre edildiğinde portfolio-level ROI optimizasyonu mümkün oluyor — hangi kullanıcı segmentine hangi fiyatı gösterip hangi CPI'a kadar UA yapılacağı tek model output'u.

---

Mobile F2P'de price optimization artık sadece "hangi fiyat daha iyi" sorusuna indirgenemez. Segment-based elasticity, platform farkı, retention impact, currency risk hepsi modele dahil. Bayesian metodoloji bu complexity'i prior/posterior framework'üne sığdırıyor ve erken karar imkanı veriyor. Fakat Bayesian test kurmak frequentist A/B'den daha karmaşık — data pipeline, MCMC infrastructure, prior tuning gerekiyor. ROI hesabı basit: eğer ayda 2+ price testi koşuyorsanız ve her test 4 hafta yerine 2 haftada kapanıyorsa, kazanılan zaman kendi maliyetini karşılıyor. Model kurmak 1 sprint, sürdürmek haftalık 2 saat analytics time — trade-off net pozitif.