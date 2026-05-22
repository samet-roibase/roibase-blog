---
title: "ASO Creative Testing: PPO ile 6 Hafta İçinde +%32 IPM"
description: "Custom Product Pages ve Play Experiments ile iOS/Android mağaza görselleriizi test edin. İstatistiksel anlamlılık, lift hesaplama, creative iteration metodolojisi."
publishedAt: 2026-05-22
modifiedAt: 2026-05-22
category: gaming
i18nKey: gaming-001-2026-05
tags: [aso, creative-testing, custom-product-pages, play-experiments, mobile-growth]
readingTime: 8
author: Roibase
---

Mobile game growth'un en sık ihmal edilen alanı mağaza görselleri. Çoğu stüdyo icon + screenshot'ları bir kere yükleyip unutuyor. Oysa Apple Custom Product Pages (CPP) ve Google Play Experiments (PPE) ile A/B test etmediğiniz her hafta install per impression (IPM) potansiyelini masaya bırakıyorsunuz. 2025'ten bu yana tier-1 pazarlarda CPP kullanan oyunlar ortalama +%22 IPM lift görüyor. Ama test yöntemi yanlışsa rakam anlamsız. Bu yazı yöntem kısmını konuşuyor.

## Custom Product Pages Nedir ve Neden Şimdi

Apple 2021'de CPP özelliğini açtı, Google Play 2022'de tam deneysel kontrol kazandırıcı şekilde güncelledi. Öncesi "tek görsel seti + ufak testler" dönemiydi. Şimdi her kampanya segmentine farklı bir creative set sunabiliyorsunuz: UA creative'inde anime stil kullanıyorsanız mağazada da anime, savaş mekaniğine odaklanıyorsanız screenshot'lar combat.

Fark basit: **mesaj tutarlılığı**. Kullanıcı TikTok'ta hero character görüp tıklıyor, App Store'da farming mechanic screenshot'ı görürse dönüşüm düşüyor. CPP bu tutarsızlığı kapatıyor. Ama asıl güç test döngüsünde: 3 farklı visual direction'ı canlıya alıp 2 hafta sonra data-driven seçim yapıyorsunuz.

Teknik detay: CPP'ler default ürün sayfanızdan bağımsız, 35 versiyona kadar oluşturabiliyorsunuz (Apple limit). Google'da eksperiment quota dinamik ama pratikte 10-12 aktif deney yeterli. Her biri farklı campaign ID ile eşleşiyor — SKAdNetwork (SKAN) veya Firebase attribution ile ölçüm yapıyorsunuz.

## Play Experiments ve iOS Equivalent: Test Mimarisi

Google Play Experiments kendi içinde conversion funnel testi yapmanıza izin veriyor: kullanıcı mağazaya geldiğinde %50 kontrol, %50 variant gösterebiliyorsunuz. Apple'da bu özellik olmadığından CPP'yi campaign-level routing ile kullanıyorsunuz. Yani test split, mağaza değil mediation seviyesinde oluyor.

Tipik test yapısı:

**Google (store-level split):**
- Baseline (mevcut görsel set)
- Variant A (yeni screenshot order)
- Variant B (farklı hero character)

Trafik otomatik dağılıyor, Play Console 14 günde statistical significance raporu veriyor.

**Apple (campaign-level split):**
- Campaign 1 → Default product page
- Campaign 2 → CPP Variant A
- Campaign 3 → CPP Variant B

Apple Search Ads'te veya paid social'da split manuel. Her campaign için install + IPM datasını SKAN postback'lerinden çekiyorsunuz. Significance'ı kendi hesaplıyorsunuz (Apple test UI'ı yok).

Çoğu stüdyo burada hata yapıyor: yeterli sample toplanmadan karar veriyor. 500 install ile "variant kazandı" deyip iteration'ı durduruyor. Gerçekte statistical power %60 bile değil. Minimum 2000 impression/variant + %95 confidence interval şart.

## Statistical Significance ve Lift Hesaplama

Play Console significance raporu veriyor ama arkasındaki matematik basit: **proportion z-test**. İki grup arasındaki conversion rate farkının rastlantı olup olmadığını test ediyor.

Formül:

```
z = (p1 - p2) / sqrt(p * (1-p) * (1/n1 + 1/n2))
p = (x1 + x2) / (n1 + n2)
```

- `p1`, `p2`: variant ve kontrol conversion rate
- `n1`, `n2`: impression sayısı
- `x1`, `x2`: install sayısı

Z-score > 1.96 ise %95 confidence'ta anlamlı fark var diyorsunuz.

**Örnek:**
- Kontrol: 10.000 impression, 800 install → %8.0 CVR
- Variant: 10.000 impression, 1120 install → %11.2 CVR
- Lift: +40% (relative), +3.2pp (absolute)
- Z-score: 8.4 → p < 0.001 (kesinlikle anlamlı)

Ama dikkat: sample size küçükse lift yüksek olsa bile significance düşük. 500 impression ile %15 lift görüp sevinmeyin — %95 CI bandı -5% ile +35% arası olabilir.

**Minimum sample hesabı** (power analysis):
Baseline CVR %8, MDE (minimum detectable effect) %20 lift için (yani %9.6 CVR) ve %80 power hedefiyle grup başına ~4500 impression gerek. Altında karar vermeyin.

### Bayesian vs Frequentist

Play Console frequentist yaklaşım kullanıyor. Alternatif Bayesian A/B test: sürekli posterior güncelleme, "variant %87 olasılıkla daha iyi" çıktısı. Küçük sample'da Bayesian erken karar vermenize yardımcı olabilir, ama production'da genelde frequentist daha güvenli. Çünkü regret minimization değil type-I error kontrolü öncelik.

## Creative Iteration Metodolojisi: İlk Testten Scale'e

Çoğu stüdyo CPP'yi şöyle kullanıyor: pazarlama ekibi 3 görsel hazırlıyor, canlıya alıyor, 1 hafta sonra bakıyor, "ortadaki daha iyi" deyip geçiyor. Yanlış.

Doğru iteration döngüsü:

1. **Hypothesis formation (Hafta 0):**
   - UA creative'lerinizin top-performer'ını alın. Hangi angle ITR yüksek? (karakter vs mekanik vs reward)
   - O angle'ı store visual'a taşıyacak 2-3 variant tasarlayın. Control = mevcut görsel.

2. **Test launch (Hafta 1-2):**
   - CPP'leri campaign-level routing ile canlıya alın. Her variant'a eşit trafik verin (manual bid adjustment veya creative rotation).
   - Günlük impression + install datasını çekin. Erken kazananı ilan etmeyin.

3. **Significance check (Hafta 3):**
   - Her variant için z-test çalıştırın. Eğer hiçbiri significance'a ulaşmadıysa sample artırın (trafik +%50) veya 1 hafta daha bekleyin.
   - Eğer 1 variant p < 0.05 ve lift >%15 ise iteration'a geçin.

4. **Winner iteration (Hafta 4-5):**
   - Kazanan variant'ı baseline yapın. Yeni 2 variant oluşturun: biri radikal değişiklik (farklı color scheme), biri incrementel (screenshot order tweak).
   - 2. round test başlatın.

5. **Scale (Hafta 6+):**
   - 2. round'dan da kazanan çıkarsa, o variant'ı tüm kampanyalara uygulayın. Eski control'ü arşivleyin.
   - 3 ay sonra tekrar test yapın — meta değişir, creative decay olur.

Bu döngüyü 6 haftada çevirirseniz yılda 8 test dönüşü yaparsınız. Her biri %10-15 lift getirirse compound: (1.1)^8 = 2.14x → +%114 IPM improvement yıl sonunda. Pratikte %30-50 arasında görüyoruz (çünkü her test kazanmıyor).

## Multivariate Testing ve Segmentation

Yukarıdaki yöntem iki-grup A/B. İleri seviye: **multivariate testing** (MVT). Aynı anda 3+ element'i test ediyorsunuz: icon, ilk screenshot, video önizleme. Ama kombinasyon sayısı patlar (3 icon × 4 screenshot × 2 video = 24 variant). Sample requirement 24x artar.

Çözüm: **factorial design**. Her element'in ana etkisini ayrı ayrı ölçüyorsunuz. Ama interaction effect'leri görmezden geliyorsunuz (örn. icon A + screenshot B combinasyonu özel bir sinerji yaratıyorsa bu gözükmeyor). Tradeoff: hız vs derinlik.

Alternatif: **sequential testing**. Önce icon, sonra screenshot, sonra video. Her adımda kazananı bulup bir sonraki element'e geçiyorsunuz. Toplam süre daha uzun (12-18 hafta) ama her karar sağlam temelde.

**Segmentation:** CPP'leri audience segmentine göre de ayırabiliyorsuniz. Örnek: iOS 17+ kullanıcılara modern UI, iOS 15- kullanıcılara klasik visual. Ya da geo-based: ABD'de superhero theme, MENA'da fantasy. Bu durumda segment başına ayrı test gerekir — toplam sample ihtiyacı katlanır. Mantıklı segmentation kriteri: LTV farkı >%30 olan gruplar.

## Roibase ile ASO Test Altyapısı

Roibase'in [App Store Optimization](/tr/aso) hizmeti CPP/PPE test altyapısını kuruyor: SKAdNetwork conversion value mapping, Firebase/Adjust entegrasyonu, custom dashboard ile real-time significance tracking. Ayrıca [Premium Yayıncı Programı](/tr/premiumyayinci) ile UA creative'lerin mağaza creative'le mesaj tutarlılığını kontrol ediyoruz — TikTok SparkAds creative'i ile CPP görseli aynı visual language konuşmalı.

Tipik engagement: ilk 2 hafta baseline ölçümü, 3-6. hafta ilk test döngüsü, 7-12. hafta iteration + scale. 3 ay sonunda %20-35 IPM lift görüyoruz (tier-1 casual/hyper-casual segmentinde). Midcore/strategy oyunlarda lift daha düşük (%10-15) çünkü decision cycle uzun, screenshot detayı kritik.

## Kapanış: Creative Testing = Continuous Process

ASO creative testing bir kampanya değil, süreç. Bir kere test edip kazananı 6 ay kullanırsanız creative decay yüzünden lift'in yarısını kaybedersiniz. 3 ayda bir refresh gerekiyor. Meta değişiyor, rakipler yeni stil deniyor, Apple/Google editorial trendleri evrim geçiriyor.

Şimdi yapmanız gereken: mevcut mağaza görsellerinizi analiz edin. UA creative'lerin top-performer angle'ı ile screenshot mesajı uyuşuyor mu? Değilse ilk CPP variant'ınızı o angle'dan tasarlayın. 2 hafta sonra minimum 5000 impression toplayın. Z-test çalıştırın. Eğer lift %15 üstü + p < 0.05 ise iteration'a geçin. 6 hafta sonra bakın — IPM'de +%20-30 lift göreceksiniz.