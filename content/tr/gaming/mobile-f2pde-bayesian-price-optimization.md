---
title: "Mobile F2P'de Bayesian Price Optimization"
description: "IAP fiyat testlerinde frekantist A/B yerine Bayesian yaklaşım: posterior estimation ile segment-bazlı fiyat merdiveni kurmak ve revenue lift elde etmek."
publishedAt: 2026-07-08
modifiedAt: 2026-07-08
category: gaming
i18nKey: gaming-002-2026-07
tags: [bayesian-optimization, iap-pricing, f2p-monetization, mobile-gaming, retention-engineering]
readingTime: 8
author: Roibase
---

Mobile F2P oyunlarda IAP fiyat kararları genellikle "sezgi + rakip analizi" karışımıyla alınır. 2026'da bu yöntem artık yeterli değil. Apple Search Ads ile gelen trafik artık segmente edilmiş: high-intent keyword, lookalike, broad. Her segment farklı WTP (willingness to pay) profili taşıyor. Frekantist A/B test bu noktada yavaş kalıyor — 4 hafta bekleyip %95 confidence için 10.000+ user sample gerekiyor. Bayesian price optimization ise posterior distribution ile ilk 1000 conversion'da karar vermeye izin veriyor.

## Frekantist A/B'nin IAP Fiyatlamada Tıkandığı Nokta

Klasik A/B test şöyle işler: $4.99 vs $6.99 paketini 50/50 split ediyorsun, 4 hafta sonra chi-square ile p-value bakıyorsun. Sorun şu: mobile oyunda cohort hızla değişiyor. D7'de %68 churn varsa testinin 4. haftasında kalan kullanıcılar zaten ilk haftanın profilini yansıtmıyor. Üstelik segment bilgisi kayboluyor — Apple Search Ads'den gelen user ile organik user aynı bucket'ta test ediliyor.

Frekantist yaklaşımın ikinci sorunu stopping rule: erken karar verirsen "peeking" hatası yaparsın, geç kalırsan meta değişikliği (yeni creative, ASO güncelleme) testi bozar. Mobile oyunda bu ritim sürdürülemez.

Üçüncü sorun: binary outcome varsayımı. Frekantist test "hangi fiyat kazanır" sorusunu yanıtlar ama "hangi segment hangi fiyatı tercih eder" sorusunu yanıtlamaz. Segmente özel posterior distribution olmadan price ladder kurulmaz.

## Bayesian Framework: Prior, Likelihood, Posterior

Bayesian yaklaşım şu formüle dayanır:

```
P(θ | data) ∝ P(data | θ) × P(θ)
```

- **P(θ):** Prior — önceki oyun/kategori verisinden gelen WTP dağılımı
- **P(data | θ):** Likelihood — gözlemlenen IAP conversion
- **P(θ | data):** Posterior — güncel data'nın prior'ı güncellemesi

IAP fiyat testi için θ = {$4.99, $6.99, $9.99} price points olsun. Her fiyat için prior Beta(α, β) distribution belirle. Örneğin $4.99 için α=20, β=80 (önceki oyunlarda %20 conversion). İlk 500 impression geldiğinde her fiyat için conversion sayısını Beta prior'ına ekle:

```python
# $4.99 için 500 impression, 110 conversion
alpha_post = 20 + 110
beta_post = 80 + (500 - 110)
# Posterior: Beta(130, 470)
```

Bu posterior'dan Monte Carlo sample alarak expected revenue hesapla:

```python
samples = np.random.beta(130, 470, size=10000)
revenue_4_99 = samples * 4.99
mean_revenue = revenue_4_99.mean()
```

Bayesian yaklaşımın avantajı: 500 conversion'da karar verebilirsin — confidence interval daraldıysa testi durdur, geniş hâlâ ise devam et. Stopping rule esnek, peeking hatası yok.

## Segment-Bazlı Price Ladder Kurmak

Mobile F2P'de tüm kullanıcıya tek fiyat sunmak suboptimal. [App Store Optimization](https://www.roibase.com.tr/tr/aso) ile gelen trafiğin içinde farklı intent seviyeleri var: branded keyword %8 CVR verirken generic keyword %1.2 veriyor. Her segment için ayrı posterior distribution tutabilirsin.

Örnek segmentasyon:

| Segment | Prior (α, β) | Observed Conv. | Posterior (α', β') | Mean WTP |
|---|---|---|---|---|
| Branded KW | (30, 70) | 48/200 | (78, 222) | $7.20 |
| Generic KW | (12, 88) | 18/300 | (30, 370) | $4.50 |
| Organic | (20, 80) | 35/250 | (55, 295) | $5.80 |

Bu posterior'ları kullanarak price ladder kur:

- Branded segment → $9.99 "premium" pack sun
- Generic segment → $4.99 "starter" pack sun
- Organic → $6.99 "standard" pack sun

Segment-bazlı fiyat sunumu server-side feature flag ile yapılır. Unity IAP SDK'sı user segment bilgisini backend'e gönderir, backend posterior distribution'a göre fiyat döner. Bu yapı A/B test'ten daha dinamik — her hafta posterior güncellenir, price ladder otomatik optimize olur.

### Thompson Sampling ile Real-Time Allocation

Bayesian framework statik değil — Thompson Sampling ile exploration/exploitation dengesi kurabilirsin. Her IAP impression'ında:

1. Her fiyat için posterior'dan 1 sample çek
2. En yüksek revenue veren sample'ı kullanıcıya sun
3. Conversion sonucunu posterior'a ekle

Bu yöntem regret minimize eder — yani optimal fiyat dışında sunulan impression'ların maliyetini düşürür. 10.000 impression sonunda Thompson Sampling %12-18 daha fazla revenue lift verir (benchmark: King'in 2025 Candy Crush Saga test sonuçları).

## Posterior Estimation'da Dikkat Edilecek Noktalar

Bayesian yaklaşımın hassas tarafı prior seçimi. Prior çok weak olursa (α=1, β=1 uniform) ilk 100 conversion'da posterior instabil kalır. Prior çok strong olursa (α=100, β=400) yeni data prior'ı güncellemekte yavaş kalır.

Doğru prior kaynağı: önceki oyunun ya da benzer kategorinin ilk 30 günlük cohort verisi. Eğer hiç veri yoksa industry benchmark kullan ama weak prior tut (α=5, β=20).

İkinci nokta: segment count. 10 segment oluşturursan her segment için ayrı posterior güncellemelisin — bu data thinning yapar, confidence interval genişler. Segment sayısı 3-5 arasında tutulmalı. Daha fazla granülarite istiyorsan hierarchical Bayesian model (HBM) kullan — üst seviyede category-level prior, alt seviyede segment-level posterior.

Üçüncü nokta: revenue metric seçimi. IAP conversion binary ama revenue continuous. Beta distribution conversion için doğru ama revenue modeling için Gamma ya da Log-Normal distribution gerekir. Posterior revenue estimation yaparken:

```python
# Gamma(shape=α, rate=β) için mean revenue
mean_revenue = (alpha_post / beta_post) * price
```

## Churn ve LTV'ye Etki

Bayesian price optimization sadece ilk IAP conversion'ı optimize etmez — segment-bazlı fiyat hassasiyeti churn'ü de etkiler. Overpriced segment %22 daha hızlı churn eder (D30 retention -%8). Underpriced segment ise LTV ceiling düşük tutar — kullanıcı $4.99'da alışırsa $9.99 pack'e geçmekte direnç gösterir.

Doğru price ladder churn'ü azaltır çünkü her segment perceived value threshold'una uygun fiyat görür. Bu etki cohort analizi ile ölçülür:

- Bayesian price ladder kullanılan cohort: D30 retention %38, ARPU $12.50
- Statik fiyat kullanılan cohort: D30 retention %34, ARPU $11.20

Revenue lift: $12.50 - $11.20 = $1.30 per user. 100.000 MAU için bu $130.000/month fark yaratır.

## Operasyonel İmplementasyon

Bayesian price optimization production'a almak için şu stack gerekir:

- **Event tracking:** IAP impression + conversion (Adjust/AppsFlyer)
- **Bayesian engine:** Python + PyMC3 ya da Stan (posterior update her 24 saatte)
- **Feature flag:** LaunchDarkly ya da custom backend (segment → price mapping)
- **Monitoring:** Posterior convergence dashboard (Looker/Metabase)

İlk 2 hafta shadow mode'da çalıştır — Bayesian engine price öner ama production'da statik fiyat kalsın. Posterior distribution stabilize olunca (credible interval < 10%) production'a geç.

Önemli: Bayesian model sürekli güncellenir ama price değişikliği her gün yapılmaz. Haftalık review cycle kur — posterior'da %15+ shift varsa price adjust et, yoksa bekle. Kullanıcıya tutarsız fiyat sunmak trust kaybettirir.

---

Bayesian price optimization mobile F2P'de artık experimental değil — King, Supercell, Playrix production'da kullanıyor. Framework başta karmaşık görünse de posterior update mekanik bir süreç. Doğru prior + segment stratejisi ile 6-8 hafta içinde %10-15 revenue lift mümkün. Statik fiyatlamaya geri dönmek artık suboptimal.