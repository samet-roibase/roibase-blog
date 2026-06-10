---
title: "Mobile F2P'de Bayesian Price Optimization"
description: "IAP fiyat testlerini posterior estimation ile yönetmek: segmentasyon, price ladder A/B, false positive filtreleme ve posterior güven aralığı."
publishedAt: 2026-06-10
modifiedAt: 2026-06-10
category: gaming
i18nKey: gaming-002-2026-06
tags: [bayesian-optimization, iap-pricing, f2p-monetization, price-testing, posterior-estimation]
readingTime: 8
author: Roibase
---

Mobile F2P oyunlarda IAP fiyat optimizasyonu hâlâ frequentist A/B mantığıyla yürütülüyor: iki fiyat paketi, 14 gün, p<0.05 bekle. Bu yaklaşım küçük segmentlerde (VIP kullanıcı, yeni giren whale) statistical power kaybına neden oluyor, erken karar alma şansını öldürüyor. Bayesian price optimization posterior dağılımı güncellediği için hem daha hızlı karar vermeye hem küçük örneklemde güven oluşturmaya olanak tanıyor. Bu yazı IAP price ladder testlerini posterior estimation ile nasıl yöneteceğini, segmentasyon sınırlarını, false positive filtrelemeyi ve revenue uplift modelini açıklıyor.

## Frequentist A/B'nin IAP Testlerinde Kırıldığı Nokta

Klasik A/B testi sabit sample size gerektirir. IAP satın alan kullanıcı oranı %2–5 bandında olduğu için bir fiyat testinde yeterli conversion hacmi toplamak 3–4 hafta sürer. Whale segmentinde (top %1 spender) oran daha da düşer, bu yüzden test süresi 6 haftaya uzar. Sorun şu: oyunun meta değişiyor, yeni event geliyor, seasonal dönemler bitiyor — 6 hafta sonra elde ettiğin data artık representative değil.

Frequentist mantık ayrıca binary karar üretiyor: kazandı/kaybetti. Oysa IAP testinde fiyat değişkeninin etkisi monoton değildir. $4.99'dan $6.99'a çıkarken conversion %8 düşebilir ama average revenue per paying user (ARPPU) %22 artar, net revenue uplift +%12 olur. Bu tradeoff frequentist p-value'da görünmez, post-hoc hesaplaman gerekir.

Bayesian yaklaşım prior belief'i (örneğin "bu segment genelde $5–7 bandında en iyi monetize olur") data ile birleştirip posterior dağılım üretir. Test başladığı anda posterior güncellemeye başlar, 500 impression'da da ara sonuç verir. Erken durdurabileceğin için test süresini yarı yarıya düşürürsün, aynı zamanda posterior güven aralığı ile risk ölçebildiğin için agresif/conserve karar stratejisi kurabilirsin.

## Price Ladder Testinde Prior ve Likelihood Kurgusu

IAP price ladder testi şu yapıda: mevcut fiyat $4.99, test edeceğin varyantlar $5.99, $6.99. Her bir price point için ayrı posterior dağılım tutacaksın: `P(θ | data)` — burada θ = true conversion rate veya expected revenue per user (ERPU).

**Prior seçimi:**
Beta(α, β) dağılımı conversion rate için kullanışlıdır. Eğer segment için tarihsel data varsa (örneğin son 90 günde %3.2 conversion, 1200 impression) onu `α = conversions`, `β = non-conversions` olarak prior'a çevirirsin. Veri yoksa uninformative prior Beta(1,1) — uniform dağılım. Whale segment için genelde informative prior tercih edilir çünkü sample size küçük olacak, prior data'yı stabilize eder.

**Likelihood:**
Her fiyat varyantı için Bernoulli trial. Kullanıcı IAP görür, satın alır/almaz. Gözlemlenen data: n impression, k conversion. Posterior güncellemesi:

```
Posterior = Beta(α + k, β + n - k)
```

Bu formül her gün yeni impression geldiğinde update edilir. Örnek senaryo:

| Day | Price | Impressions | Conversions | Posterior |
|-----|-------|-------------|-------------|-----------|
| 1   | $5.99 | 120         | 4           | Beta(5, 117) |
| 3   | $5.99 | 380         | 13          | Beta(14, 368) |
| 7   | $5.99 | 820         | 28          | Beta(29, 793) |

7. günde posterior mean = 29/(29+793) = %3.53. Credible interval: [%2.4, %4.9] (%95 HPD).

## Segmentasyon ve Multi-Armed Bandit Entegrasyonu

Price ladder testini tüm user base'e aynı anda koşmak verimsizdir. En yüksek revenue potansiyeli olan segmentleri hedefle: yeni whale (D7'de ilk IAP yapan, $20+ harcama), returning spender (son 14 günde 2+ purchase), event-triggered spender (yeni season pass çıkınca tetiklenen). Her segment için ayrı posterior tutmak model complexity artırır ama sample efficiency kazandırır.

Multi-armed bandit (MAB) ile Bayesian optimization birleştirilirse dinamik allocation yapabilirsin: posterior mean en yüksek price point'e daha fazla trafik ver (exploit), ama posterior variance yüksek olanlara da minimum trafik ayır (explore). Thompson Sampling algoritması posterior'dan sample alıp en yüksek değeri seçerek bu dengeyi otomatik kurar:

```python
def thompson_sampling(posteriors):
    samples = [beta.rvs(p['alpha'], p['beta']) for p in posteriors]
    return np.argmax(samples)
```

Her impression allocation kararında yukarıdaki fonksiyon çalışır. 10.000 impression sonunda en iyi price point doğal olarak trafik çoğunluğunu toplar ama diğerleri tamamen ölmez, yeni data gelirse posterior güncellenip önce geçebilir.

## False Positive Filtreleme ve Posterior Güven Aralığı

Bayesian testlerde "istatistiksel anlamlılık" kavramı yoktur, yerine posterior probability kullanılır: `P(θ_A > θ_B | data)`. Eğer bu olasılık >%95 ise fiyat A, fiyat B'den üstündür deriz. Ama dikkat: posterior probability yüksek olsa bile effect size küçükse operasyonel kazanç olmaz.

**Minimum Detectable Effect (MDE) threshold:**
Revenue uplift <%5 ise implementation maliyeti kazancı geçer (app store compliance, yeni SKU ekleme, localization). Bu yüzden karar kuralı şöyle olmalı:

```
IF P(uplift > 5%) > 0.95 AND posterior_mean_uplift > 5%:
    DEPLOY
ELSE:
    CONTINUE or STOP
```

Bu çift filter false positive'i kontrol eder. Örneğin $5.99 fiyatının posterior mean uplift'i +%3.2 ama credible interval [-%1.2, +%7.8] ise henüz karara varmak erken. 2 hafta daha data toplayarak interval daralır, %95 HPD [+%2.1, +%5.6] haline gelirse ve mean >%5 koşulu tutarsa deploy edilir.

**Posterior predictive check:**
Test sonrası deploy edilen fiyatın gerçek performansını posterior predictive distribution ile simüle et. Eğer gözlemlenen revenue bu dağılımın dışında kalıyorsa (örneğin dağılımın %99'unun altında) segment composition değişmiş veya external factor devreye girmiş demektir (yeni competitor oyun çıkmış, Apple fiyat politikası değişmiş). Bu durumda posterior'u invalidate et, yeni prior ile retest başlat.

## Revenue Uplift Modellemesi ve Operasyonel Karar Ağacı

IAP fiyat testinin nihai metriği conversion rate değil, segment-level ERPU (expected revenue per user) artışıdır. Bayesian framework içinde ERPU'yu şöyle modelle:

```
ERPU = P(conversion) × Price
Posterior ERPU = E[θ] × Price
```

Her price point için posterior ERPU hesapla, en yüksek olanı seç. Ama tradeoff var: yüksek fiyat conversion düşürür, düşük fiyat ARPPU düşürür. Optimal noktayı bulmak için tüm price ladder'ı aynı anda test et (3–4 varyant), posterior ERPU dağılımlarını karşılaştır.

**Operasyonel karar ağacı:**

1. **Day 3:** Posterior variance hâlâ yüksek mi? Evet → traffic allocation ayarla (MAB). Hayır → erken winner signal var mı kontrol et.
2. **Day 7:** En iyi price point'in posterior probability >%90 mı? Evet → soft launch (whale segment %10). Hayır → 7 gün daha devam.
3. **Day 14:** Posterior credible interval dar mı (<%3 range) ve uplift >%5 mi? Evet → full deploy. Hayır → test inconclusive, meta analiz yap.

Bu ağaç sayesinde test median 10 günde sonuçlanır (frequentist'te 21 gün). Whale segment gibi dar popülasyonlarda bile 14. günde karar verilebilir çünkü prior informative olduğunda posterior hızla daralır.

Meta analiz: eğer test sonuçsuz kalıyorsa segment içinde mikro-segmentasyon yap (iOS vs Android, tier-1 vs tier-2 geo, D7 vs D30 age). Her birinde posterior ayrı hesapla, hangisinde signal güçlü bul, o segmente özel fiyat uygula. Bu [App Store Optimization](https://www.roibase.com.tr/tr/aso) sürecinde custom product page mantığıyla paraleldir: her segment farklı creative görür, burada farklı fiyat görür.

## Posterior Estimation ile Uzun Dönem Price Calibration

Bayesian price optimization tek seferlik test değil, sürekli kalibrasyon sistemidir. Her ay yeni cohort gelir, meta değişir, seasonal event etkisi posterior'u değiştirir. Bunun için rolling posterior mantığı uygula: son 60 günlük data ile posterior'u her hafta güncelle, eski prior'u fade out et (exponential decay).

```python
def update_rolling_posterior(current_posterior, new_data, decay=0.95):
    alpha_new = current_posterior['alpha'] * decay + new_data['conversions']
    beta_new = current_posterior['beta'] * decay + new_data['non_conversions']
    return {'alpha': alpha_new, 'beta': beta_new}
```

Bu sistem fiyat değişikliği sonrası da posterior'u sıfırlamaz, yeni fiyatın data'sını eski posterior'a ekler. Böylece geçmiş bilgi tamamen kaybolmaz ama güncel pattern ağır basar.

Uzun dönemde price elasticity curve çıkarabilirsin: her price point için posterior mean ERPU'yu plot et, fitted curve ile $1 artışın marjinal etkisini gör. Eğer curve $6.99'da plateau yapıyorsa daha yüksek fiyat test etme, bunun yerine bundle/package stratejisi dene (2 IAP birlikte %15 indirim gibi). Bu strateji de Bayesian ile test edilir, prior bundle conversion rate'i single IAP'nin %70'i olarak alınır (industry heuristic), posterior data ile güncellenir.

Bayesian price optimization IAP testlerini statik A/B'den dinamik learning sistemine dönüştürür. Posterior estimation sayesinde küçük segmentlerde erken karar verebilir, false positive'i kontrol ederken revenue uplift'i maksimize edebilirsin. Whale segment, event-triggered spender gibi dar popülasyonlarda frequentist yaklaşım çalışmaz, Bayesian prior + likelihood yapısı bu sorunu çözer. Rolling posterior ile price calibration sürekli güncellenir, seasonal değişim veya meta shift posterior'a otomatik yansır. Sonuç: test süresi yarıya iner, karar kalitesi artar, operasyonel maliyet düşer.