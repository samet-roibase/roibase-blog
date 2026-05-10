---
title: "Mobile F2P'de Bayesian Price Optimization"
description: "IAP fiyat testlerinde klasik A/B'den Bayesian estimation'a geçmek neden kritik? Posterior güncelleme, segment-specific ladder kurgusu, erken karar mekanizması."
publishedAt: 2026-05-10
modifiedAt: 2026-05-10
category: gaming
i18nKey: gaming-002-2026-05
tags: [f2p-monetization, bayesian-testing, iap-pricing, mobile-gaming, price-optimization]
readingTime: 8
author: Roibase
---

Mobile F2P ekonomisinde fiyat optimizasyonu hâlâ "en çok satan paketi $4.99'dan $5.99'a çıkaralım" kararıyla yapılıyor. 2026'da Apple Search Ads bid'ini milisaniye hassasiyetle optimize eden studio'lar, IAP ladder'ında klasik A/B test'le aylar kaybediyor. Bayesian estimation, fiyat testlerini yüzde birkaçlık marjları yakalamak için değil, erken karar almak ve segment-specific ladder kurmak için kullanıldığında, LTV'yi test başına ortalama %12-18 arasında yukarı çekiyor. Bu yazıda posterior güncelleme mantığını, segmentasyonu nasıl bağlayacağını ve mobile context'te Bayesian framework'ün neden vazgeçilmez olduğunu açıklıyoruz.

## Klasik A/B Price Testing Neden Yavaş Kalıyor

Frekantist A/B test'te bir fiyat değişikliğini istatistiksel anlamlılığa götürmek, 5000-10000 transaction gerektirebiliyor (p=0.05, güç=0.80). Orta segment bir F2P oyununda günlük 200-300 paying user varsa, tek bir variant için 25-30 günlük bekleme demek. Bu sürede Season Pass refresh'i gelir, event calendar değişir, rakip update yapar — test kontrol grubunu korumak imkânsız hale gelir.

Klasik yaklaşımda ikinci sorun binary karar yapısı: ya "fiyat artışı anlamlı değil, geri dön" ya da "anlamlı, uygula". Oysa mobilde her cohort farklı price elasticity taşıyor. Organic iOS kullanıcısı $9.99'a conversion yaparken, Android paid install %40 daha hassas olabiliyor. Tek bir p-value tüm segmentleri aynı karara zorluyor.

Üçüncü sıkıntı erken durdurma imkânsızlığı. Frekantist test sample size'a ulaşana kadar devam etmek zorunda — 2. haftada posterior güven %92'ye ulaşmış olsa bile, "yeterli veri yok" diye 4 hafta daha bekletiliyor. Bu gecikme, fiyat değişikliğinden beklenen LTV gain'i zaten live ops schedule'ına yedirebilecekken kaçırılıyor.

## Bayesian Framework'te Posterior Estimation Nasıl İşliyor

Bayesian yaklaşım, fiyat değişikliği conversion rate'ini (ya da average revenue per paying user'ı) sabit bir rakam değil, **probability distribution** olarak görüyor. Test başlamadan önce prior belief var: eski fiyattan gelen CVR dağılımı. Her yeni transaction geldikçe, posterior distribution Bayes teoremi ile güncelleniyor:

```
P(θ | data) ∝ P(data | θ) × P(θ)
```

Burada θ = gerçek conversion rate (ya da ARPPU), data = gözlemlenen purchase events. Prior olarak genelde Beta(α, β) kullanılıyor (IAP flow'u binary outcome olduğu için uygun). Her gün sonunda α ve β parametreleri yeni transaction sayıları ile update ediliyor.

Pratikte şöyle ilerliyor: $4.99'lık Starter Pack'i $5.99'a çıkarmayı test ediyorsun. Prior belief: CVR ~%2.8 (Beta(280, 9720) — 10000 impression'dan türetilmiş). İlk 3 günde $5.99 variant'ına 600 impression geldi, 14 conversion oldu. Posterior şimdi Beta(294, 10306). Güven aralığı daraldı, ortalama CVR %2.78 olarak güncellendi. 10. günde 2000 impression, 48 conversion — posterior Beta(328, 11672), CVR %2.74. Frekantist test hâlâ "yetersiz sample" derken, Bayesian yaklaşım şunu söylüyor: "Yeni fiyatın CVR'si eskisinden düşük olma olasılığı %87 — ama ARPPU artışı bunu telafi ediyor mu?"

### Karar Metrici: Expected Revenue Gain

CVR düşüşü tek başına karar değil. Bayesian framework'te asıl metrik **expected revenue per impression** (ERPI):

```
ERPI = E[CVR × Price]
```

Her iki variant için posterior distribution'dan Monte Carlo sample alıyorsun (10000 iterasyon), her iterasyonda CVR_new × $5.99 ile CVR_old × $4.99'u karşılaştırıyorsun. %85'inden fazlası yeni fiyat lehine ise (yani P(ERPI_new > ERPI_old) > 0.85), karar "scale up". %15'in altında ise geri dön.

Bu yaklaşım sayesinde 10-12 günde, 1500-2000 transaction ile karar alabiliyorsun. Klasik A/B'nin 4-5 haftasına göre %60 hızlı.

## Segment-Specific Ladder Kurgusu

Bayesian estimation'ın asıl gücü, **multi-armed bandit** formatıyla birleştiğinde ortaya çıkıyor. Her segment için ayrı posterior tutuluyor, her gün Thompson Sampling ile hangi fiyat variant'ına trafik gideceği dinamik olarak belirleniyor.

Somut senaryo: 4 segment var — (1) Organic iOS, (2) Paid iOS, (3) Organic Android, (4) Paid Android. Starter Pack için 3 fiyat test ediyorsun: $4.99, $5.99, $6.99. Toplamda 12 posterior distribution (4 segment × 3 fiyat).

İlk hafta her segment'e 3 variant eşit dağıtılıyor (exploration). 2. haftadan itibaren Thompson Sampling devreye giriyor: her impression geldiğinde, o segment için 3 posterior'dan birer sample çekiliyor, ERPI en yüksek olan variant trafik alıyor. Organic iOS'ta $6.99 hızla önde açılıyorsa, o segment'teki kullanıcılar %70+ oranında $6.99'u görmeye başlıyor. Paid Android'de $5.99 optimal çıkıyorsa, orada trafik ona kayıyor.

| Segment | Optimal Fiyat (14. gün) | Posterior Confidence | Günlük Allocation |
|---|---|---|---|
| Organic iOS | $6.99 | %91 | %78 |
| Paid iOS | $5.99 | %88 | %74 |
| Organic Android | $5.99 | %85 | %71 |
| Paid Android | $4.99 | %82 | %69 |

Bu yapı, segment-level price elasticity'i yakaladığı için, global tek fiyat dayatmaktan %15-20 daha fazla revenue getiriyor. Ayrıca yeni segment eklediğinde (örn. "Tier-2 GEO paid user"), onun için de prior kuruyorsun, multi-armed bandit otomatik olarak o kolda test başlatıyor.

## Erken Karar Mekanizması ve Regret Minimization

Bayesian framework'ün mobile context'te kritik avantajı **sequential decision-making**. Her gün sonunda posterior güncelleniyor, karar kuralına bakılıyor. Eğer P(ERPI_new > ERPI_old) > 0.90 ise, "yeterince emin olduk, geri kalan trafiği kazanan variant'a kaydır" diyorsun. Frekantist test "sample size dolmadı" diye bekletirken, Bayesian yaklaşım 7. günde karar alıp kalan 3 haftada kazanan fiyatı scale ediyor.

Erken karar alabiliyor olmak, **cumulative regret**'i minimize ediyor. Regret = "optimal fiyatı bilseydik ne kadar kazanırdık" − "test sırasında ne kadar kazandık". Klasik A/B'de 30 gün boyunca trafiğin yarısı suboptimal variant'a gidiyor; Bayesian Thompson Sampling'de 10. günden sonra trafiğin %80'i kazanan tarafa kayıyor. Regret integrali %60-70 düşüyor.

Pratikte, 2-3 haftalık bir test döngüsünde:
- Klasik A/B: 21 gün × 50% suboptimal trafik = 10.5 gün eşdeğer kayıp
- Bayesian bandit: 7 gün exploration + 14 gün %15 suboptimal = 2.1 gün eşdeğer kayıp

Bu fark, yüksek DAU'lu oyunlarda günlük onlarca bin dolarlık revenue impact'e dönüşüyor.

## Trade-off ve Pitfall'lar

Bayesian price optimization risklerden muaf değil. Prior seçimi kritik: çok dar prior (örn. Beta(5000, 195000) — "CVR kesinlikle %2.5") yeni veri gelince bile belief'i yavaş güncelliyor. Çok geniş prior (Beta(1, 1) — uniform) ise exploration fazlası uzuyor. Sağlıklı başlangıç: eski fiyattan gelen son 30 günlük transaction verisini Beta parametresine çevirmek (method of moments).

İkinci pitfall, segment sayısı arttıkça multi-armed bandit'in convergence süresi uzuyor. 4 segment × 3 fiyat = 12 kol; her kol için 200-300 sample gerekiyorsa, toplamda 2400-3600 transaction — günlük 300 paying user'lı oyunda 10-12 gün. Eğer 8 segment × 4 fiyat = 32 kola çıkarsan, convergence 4-5 haftaya uzar. Çözüm: hierarchical Bayes kullanarak segment'ler arasında bilgi paylaşımı (örn. "Tier-1 GEO'lar benzer elasticity gösterir" prior'u).

Üçüncü dikkat noktası: IAP ladder'ı izole test edilmiyor, live ops schedule ile iç içe. Event sırasında fiyat elasticity değişiyor (urgency etkisi). Bayesian posterior'u event günlerinde daha hızlı update etmek, ama event bitince prior'u reset etmemek gerekiyor. Aksi halde "event sırasında $6.99 optimal" bilgisi normal günlere taşınıyor, suboptimal karar alınıyor.

Son olarak: Bayesian yaklaşım frequentist garantiler vermiyor. "P(θ > x) = 0.95" diyorsun, ama bu %95 confidence interval değil, %95 credible interval. Regülatör raporlamada veya yasal sınırlamalarda (örn. loot box düzenlemeleri) frekantist metrik istenirse, Bayesian sonuçları bootstrap ile desteklemen gerekebilir.

## Roibase'te Segment-Specific Ladder Testlerini Ölçümlemeye Bağlamak

Mobile gaming studio'ları için price optimization, izole bir test değil, tüm [App Store Optimization](https://www.roibase.com.tr/tr/aso) ve attribution pipeline'ına bağlı. Bayesian posterior'ları sadece fiyat kararında değil, ASO creative testlerinde de kullanabiliyorsun: hangi custom product page hangi segment için daha yüksek IPM getiriyor, o segment'e optimal IAP ladder'ı ne — iki data stream'i birleştirince cohort-level LTV projeksiyonu %30 daha doğru çıkıyor.

Bayesian framework'ü ölçümleme altyapısına entegre etmek, hem erken karar almayı hem segment-specific price ladder'ı mümkün kılıyor. 2026'da mobile F2P'de kazanan studio'lar, fiyat testini "ayda bir yapılan optimizasyon" olmaktan çıkarıp, posterior distribution'ı her gün güncelleyen, Thompson Sampling ile trafik dağıtan, regret minimize eden bir sistem kurmuş olanlar.