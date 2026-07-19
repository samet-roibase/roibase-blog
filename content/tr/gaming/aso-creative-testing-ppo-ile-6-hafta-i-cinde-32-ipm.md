---
title: "ASO Creative Testing: PPO ile 6 Hafta İçinde +%32 IPM"
description: "Custom Product Pages ve Play Experiments ile install-per-mille optimizasyonu. Statistical significance hesabı, test süresi ve creative iteration döngüsü."
publishedAt: 2026-07-19
modifiedAt: 2026-07-19
category: gaming
i18nKey: gaming-001-2026-07
tags: [aso, custom-product-pages, play-experiments, ipm-optimization, mobile-gaming]
readingTime: 7
author: Roibase
---

Apple'ın Custom Product Pages ve Google'ın Play Experiments özellikleri 2021'den beri var ama mobile gaming'de creative testing 2026'da ilk kez gerçek attribution'a bağlanabiliyor. Tier-1 pazarlarda organic install maliyeti %400 arttı, CPP ile kazanılan her IPM artışı 6 aylık LTV'ye doğrudan etki ediyor. Statistical significance hesabını hızlandıran yeni metodlar test süresini 12 haftadan 6'ya indirdi — bu yazıda o döngüyü kuruyoruz.

## Custom Product Pages Neden Şimdi Öncelik

Apple'da CPP oluşturduğunuzda her varyant ayrı bir deep link alıyor. Bu linki Apple Search Ads kampanyalarına, influencer content'e veya premium yayıncı network'üne bağlayınca hangi creative'in hangi segmentte dönüştüğünü attribution graph'te görebiliyorsunuz. 2025 öncesi bu mümkün değildi — default store listing tüm traffic'i alıyordu, creative performansını tahmin ediyordunuz.

Şimdi farklı: Her kampanya farklı CPP'ye trafik gönderiyor, App Store Connect'teki IPM (impressions-per-mille) metriği campaign ID ile eşleşiyor. F2P hyper-casual oyunlarda %5 IPM farkı ayda 40.000 dolar CPI tasarrufu anlamına geliyor. Bu yüzden CPP artık opsiyonel değil — zorunlu test ortamı.

Google Play'de Play Experiments benzer mantıkta çalışıyor ama trafik dağıtım mekanizması farklı: Google otomatik olarak %50-%50 split yapıyor, manuel allocation yok. Bu bazı senaryolar için kısıtlayıcı ama statistical significance hesabını kolaylaştırıyor — her varyant eşit exposure alıyor.

### Test Süresi Hesabı

6 haftalık döngü şu formüle dayanıyor:

```
minimum_sample = (z_score^2 * p * (1-p)) / (margin_of_error^2)
weekly_impressions = average_daily_traffic * 7
weeks_needed = minimum_sample / weekly_impressions
```

Günlük 10.000 impression alan bir oyunda %95 confidence level ve %2 margin of error için:

| Metrik | Değer |
|--------|-------|
| z_score (95% confidence) | 1.96 |
| p (expected conversion) | 0.05 |
| margin_of_error | 0.02 |
| minimum_sample | 456 install |
| weekly_impressions | 70.000 |
| weeks_needed | 6.5 |

Statistical significance'a 6 haftada ulaşıyorsunuz. 12 hafta beklemek gereksiz — erken sonuç geldiğinde iteration yapmalısınız.

## Screenshot vs Video Icon Test Prioritization

IPM'yi en çok etkileyen iki creative asset: ilk screenshot ve app icon. Video preview otomatik oynatılıyor ama %68 kullanıcı 3 saniye içinde scroll ediyor — static screenshot daha kontrollü mesaj veriyor.

Test önceliği şu sırayla:

1. **Icon variant** — 3 varyant, her biri farklı color scheme. Casual oyunlarda warm color %12 daha yüksek IPM veriyor, hardcore RPG'de cool tone tercih ediliyor.
2. **First screenshot messaging** — feature odaklı vs character odaklı. Match-3 oyunlarda feature (power-up showcase) kazanıyor, narrative RPG'de character.
3. **Video preview duration** — 15 saniye vs 30 saniye. Tier-1'de 15 saniye %8 daha yüksek completion rate gösteriyor.

Her test döngüsünde tek değişken izole edin. Icon + screenshot'ı aynı anda değiştirirseniz hangi asset'in etkili olduğunu bilemezsiniz. [App Store Optimization](https://www.roibase.com.tr/tr/aso) sürecinde bu isolation Roibase'in temel yaklaşımı — tek değişkenli test döngüsü, clear attribution.

### Winner Selection Kriteri

IPM artışı yeterli değil — install quality'ye bakmalısınız. Şu metriklerle cross-check yapın:

- **D1 retention** — yeni creative ile gelen kullanıcıların ertesi gün dönüş oranı
- **Tutorial completion** — ilk oturumdaki funnel tamamlama
- **First IAP conversion** — creative promise ile in-game reality arasındaki uyum

Bir varyant IPM'yi %32 artırıyor ama D1 retention %15 düşüyorsa misleading creative kullanmışsınız demektir. O varyant kazanan değil — spam traffic çekiyor.

## Play Experiments Trafik Allocation Sorunsalı

Google Play'de allocation manuel değil ama bunu avantaja çevirebilirsiniz: pre-registration kampanyalarını tek varyanta yönlendirin, organic traffic diğer varyantlara gitsin. Bu şekilde segment bazlı performans görebilirsiniz.

Pre-reg kullanıcıları genelde higher intent — daha yüksek LTV beklentisi var. Eğer A varyantı pre-reg'de %40 IPM, B varyantı organic'te %28 IPM veriyorsa segment strategy kurabilirsiniz: paid campaigns A'ya, ASO default B'ye gitsin.

Google'ın statistical confidence threshold'u %90 — Apple'dan daha düşük. Bu erken sonuç almanıza olanak sağlıyor ama false positive riski var. 6 haftalık döngüyü koruyun, erken winner ilan etmeyin.

## Creative Iteration Döngüsü: 6 Hafta x 4 Dönem

Bir çeyrekte 4 iteration yapabilirsiniz:

| Hafta | Aktivite | Output |
|-------|----------|--------|
| 1-6 | İlk test (icon) | Winner icon |
| 7-12 | İkinci test (screenshot) | Winner screenshot set |
| 13-18 | Üçüncü test (video) | Winner video preview |
| 19-24 | Final kombine test | Optimized CPP |

Her döngüde winner'ı default yapıp bir sonraki asset'e geçiyorsunuz. 24 hafta sonunda %32 IPM artışı kümülatif oluyor — tek seferde değil, her iteration %8-10 artış.

Bu döngüyü kesintisiz tutmak için creative production pipeline kurmalısınız: test başladığında bir sonraki asset set'i hazır olmalı. 6 hafta beklerken boş durmayın — paralel üretim yapın.

### A/B/C Test Riski

3 varyantlı test cazip görünüyor ama trafik split'i problematik: her varyant %33 alıyor, statistical significance'a ulaşmak 9 haftaya çıkıyor. Bunun yerine şunu yapın:

1. İlk turda A vs B (6 hafta)
2. Winner'ı al, C ile karşılaştır (6 hafta)
3. Final winner'ı default yap

Toplam 12 hafta ama her döngü valid — tek seferde 3 varyant yerine iki aşamalı elimination.

## Tier-1 vs Emerging Market Creative Farklılaşması

ABD'de çalışan creative Brezilya'da %18 daha düşük IPM veriyor — color psychology ve cultural reference farklı. Geo-specific CPP oluşturmalısınız:

- **Tier-1 (US, UK, DE):** Minimalist design, clear value prop, "no ads" messaging
- **Tier-2 (BR, MX, TR):** Vibrant color, social proof (download count), competitive angle

Apple CPP'de geo targeting yok ama campaign level'da deep link yönlendiriyorsunuz. Google Play Experiments'te geo filter var — daha kolay split.

Emerging market'te test süresi daha uzun: lower traffic volume, 8-10 hafta gerekiyor. Tier-1'de validate ettikten sonra emerging'e geçin — paralel test yapmayın, resource dağıtır.

## Statistical Significance Çıkmazı

%95 confidence her zaman doğru threshold değil. Eğer günlük 50.000 impression alıyorsanız %90 confidence 4 haftada ulaşılıyor, %95 için 6 hafta beklemeniz gereksiz risk. Şu tablo ile threshold seçin:

| Daily Impressions | Confidence Level | Weeks Needed |
|-------------------|------------------|--------------|
| 5.000 | %90 | 8 |
| 10.000 | %90 | 6 |
| 50.000 | %90 | 4 |
| 10.000 | %95 | 9 |
| 50.000 | %95 | 6 |

Higher traffic varsa lower confidence yeterli — sample size zaten büyük, margin of error düşük. Bayesian approach kullanıyorsanız prior distribution'ı historical IPM datasından alın, test süresi %30 azalır.

Creative testing sürekli döngü — bir kez optimize edip bırakmıyorsunuz. Her çeyrekte en az bir iteration, her iteration net attribution ile ölçülmüş IPM artışı. 6 haftalık framework bu döngüyü sürdürülebilir kılıyor — 12 hafta beklerseniz momentum kaybediyorsunuz, 4 haftada sonuç alırsanız false positive ile karar veriyorsunuz. Statistical rigor ile hız arasındaki denge burada.