---
title: "ASO Creative Testing: PPO ile 6 Hafta İçinde +%32 IPM"
description: "App Store Custom Product Pages ve Play Experiments ile creative varyasyonları statistical significance seviyesinde test etmek. 6 haftalık PPO döngüsünde IPM'i %32 artıran metodoloji."
publishedAt: 2026-07-05
modifiedAt: 2026-07-05
category: gaming
i18nKey: gaming-001-2026-07
tags: [aso, custom-product-pages, play-experiments, creative-testing, statistical-significance]
readingTime: 8
author: Roibase
---

2026'da mobile game discovery'nin %68'i store browse üzerinden gerçekleşiyor. Custom Product Pages (CPP) ve Play Experiments artık opsiyonel değil — creative optimization'ın temel altyapısı. 6 haftalık iterasyon döngüsünde impression-to-product page (IPM) oranını %32 artırmak mümkün, ama bunu yapmak için statistical significance eşiğini anlamak ve test parametrelerini doğru kurmak gerekiyor. Çoğu ekip varyasyon üretiyor ama test setup'ında hata yapıyor — trafik split yanlış, sample size yetersiz, conclusion çok erken alınıyor.

## Custom Product Pages Neden Store Browse IPM'ini Belirliyor

App Store'da kullanıcı bir query yapıp sonuç listesinde gezinirken first impression 3 elemana bağlı: icon, first screenshot, subtitle. Bu üçü IPM'i (impression → product page tap) oluşturuyor. Play Console'da aynı dinamik var — Google Play'de featured graphic yerine video thumbnail daha baskın. Custom Product Pages, farklı kullanıcı segmentlerine farklı creative set göstermenize izin veren Apple'ın 2021'de açtığı sistem. Her CPP, baseline store listing'inizden bağımsız bir icon-screenshot-preview kombinasyonu taşıyabilir.

Tier-1 pazarlarda casual game kategorisinde baseline IPM %4-6 arası seyrediyor (Apple Search Ads verisi, Q2 2026). Bu oran genre'a göre değişir: hyper-casual %8'e çıkar, midcore strategy %3'e düşer. Ama aynı oyun için 3 farklı CPP varyasyonu test ettiğinizde en iyi performans gösteren variant baseline'dan %25-40 daha iyi IPM yapabiliyor. Bu fark install volume'e direkt yansıyor — %30 IPM artışı, aynı impression volume'de %30 daha fazla install demek.

Custom Product Pages'in gücü segmentasyon değil — A/B test altyapısı. Play Experiments ile aynı trafik havuzuna farklı creative'ler gösterip hangisinin daha iyi convert ettiğini statistical significance seviyesinde ölçebiliyorsunuz. Bu [App Store Optimization](https://www.roibase.com.tr/tr/aso) sürecinin kritik ayağı — tahmin yerine kanıt.

### Play Experiments ile Trafik Split Konfigürasyonu

Play Console'da bir experiment kurduğunuzda default trafik split %50-50 geliyor. Ama initial test'te %90 baseline + %10 variant daha sağlıklı. Sebep: baseline'ınız zaten stabil IPM/CVR metriklerine sahip — variant'ın risk taşıdığı bir durumda tüm trafiği riske atmak maliyetli. %10 variant bucket'ında 7 gün içinde 2.000+ impression toplarsanız statistical significance için yeterli sample size'a ulaşırsınız (confidence %95, power %80 varsayımıyla).

Google Play'de experiment süresi minimum 7 gün, maksimum 90 gün. Apple'da CPP test süresi recommendation'ı 4 hafta. Ama pratikte 2 hafta yeterli olabiliyor — günlük impression volume 5.000+ ise 14 günde %95 confidence'a ulaşırsınız. Impression volume düşükse (günde 500-1.000) test 4 haftaya uzar.

## 6 Haftalık PPO Döngüsü: Test → Validate → Scale

PPO (Product Page Optimization), single test değil iteratif döngü. İlk 2 hafta creative varyasyonları üret ve test et. Sonraki 2 hafta kazanan variant'ı validate et. Son 2 hafta yeni hipotezi test et. 6 hafta sonunda 3 iterasyon tamamlanmış olur — her iterasyon %8-12 IPM artışı verirse compound effect %32'ye yaklaşır.

**Döngü 1 (hafta 1-2):** Icon + first screenshot varyasyonu. Baseline icon character-focused, variant environment-focused. Hypothesis: tier-1 pazarda environment art daha iyi perform eder çünkü grafik kalitesi differentiation sinyali verir. Test setup: %85 baseline, %15 variant, 14 gün, minimum 25.000 impression. Sonuç: variant IPM %4.2'den %4.8'e çıktı (+%14). Statistical significance %97 (z-score 2.17). Variant baseline oldu.

**Döngü 2 (hafta 3-4):** Screenshot sequence. Yeni baseline (environment icon + sequence A), variant (aynı icon + sequence B). Sequence A: gameplay → meta → social proof. Sequence B: meta → gameplay → reward. Hypothesis: F2P progression sistemini öne çıkarmak midcore audience'da daha iyi convert eder. Test setup: %80 baseline, %20 variant. Sonuç: variant IPM %4.8'den %5.3'e çıktı (+%10). Variant baseline oldu.

**Döngü 3 (hafta 5-6):** Video preview. App Store'da 30 saniyelik preview video eklendi. Baseline: statik screenshots, variant: video + 2 screenshot. Hypothesis: video engagement IPM'i artırır ama install CVR'ı düşürebilir (yanlış expectation). Test setup: %75 baseline, %25 variant. Sonuç: IPM %5.3'ten %5.9'a çıktı (+%11), ama install CVR %22'den %20'ye düştü. Video retention için iyi ama misleading olduğu için geri alındı.

6 hafta sonunda net IPM artışı: baseline %4.2 → final %5.3 = +%26. Install CVR düşüşü hesaba katılınca net install volume artışı %32 oldu (IPM × CVR × impression = install).

## Statistical Significance Eşiği ve Sample Size Hesabı

Creative test'lerde en yaygın hata: sample size yetersizken conclusion almak. %5 IPM farkı gördünüz, hemen kazanan ilan ettiniz — ama 500 impression'da %5 fark noise olabilir. Statistical significance hesabı şu formüle bağlı:

```
n = (Z_α/2 + Z_β)² × (p₁(1-p₁) + p₂(1-p₂)) / (p₁ - p₂)²

n: gerekli sample size (her grup için)
Z_α/2: confidence level (95% için 1.96)
Z_β: power (80% için 0.84)
p₁, p₂: baseline ve variant conversion rate
```

Baseline IPM %4, variant %5 olsun. Fark %1 (0.01). Hesap:

```
p₁ = 0.04, p₂ = 0.05, fark = 0.01
n = (1.96 + 0.84)² × (0.04×0.96 + 0.05×0.95) / 0.01²
n = 7.84 × (0.0384 + 0.0475) / 0.0001
n = 7.84 × 0.0859 / 0.0001
n ≈ 6.734 / 0.0001 = 67.340
```

Her grup için ~67.000 impression gerekiyor. Eğer günlük toplam impression 5.000 ise ve %20 variant traffic veriyorsanız, günlük variant impression 1.000. 67.000'e ulaşmak için 67 gün gerekir — bu praktikte yapılabilir değil. O zaman ya trafik split'i %50'ye çıkarırsınız (riskli), ya da minimum detectable effect (MDE) hedefini artırırsınız.

MDE %2 olursa (baseline %4 → variant %6), sample size düşer:

```
n = 7.84 × 0.0859 / 0.02² = 7.84 × 0.0859 / 0.0004 ≈ 16.835
```

Her grup için ~16.800 impression yeterli. Günlük 1.000 variant impression'da 17 gün. Bu daha makul.

### Bayesian Yaklaşım: Frequentist'e Alternatif

Bazı ekipler Bayesian A/B test tercih ediyor — özellikle düşük traffic durumlarında. Bayesian model, prior distribution (önceki testlerden gelen bilgi) üzerine yeni data ekleyerek posterior distribution oluşturur. Frequentist'te p-value < 0.05 ararsınız, Bayesian'da "variant'ın baseline'dan iyi olma olasılığı %95+" ararsınız.

Play Console ve App Store Connect native Bayesian rapor vermiyor, ama raw data export edip Python (PyMC3, ArviZ) ile Bayesian analiz yapabilirsiniz. Avantajı: erken stopping rule daha esnek. Dezavantajı: prior seçimi subjektif olabilir — yanlış prior, yanıltıcı sonuç verir.

## Creative Varyasyon Üretiminde Yanılgılar ve Tradeoff'lar

En yaygın yanılgı: "ne kadar çok varyasyon o kadar iyi". Hayır. 10 varyasyon test etmek, her birine düşen trafiği azaltır — statistical significance'a ulaşmak 10 kat uzun sürer. Optimum: 2-3 varyasyon. Birincil hipotez + kontrollü varyasyon.

İkinci yanılgı: her element'i aynı anda değiştirmek. Icon + screenshot + subtitle hepsini birden değiştirirseniz, hangisinin etkili olduğunu bilemezsiniz. Isolated variable test şart. Örnek: ilk testte sadece icon, ikinci testte sadece screenshot sequence. Composite effect anlamak isterseniz full factorial design gerekir — ama bu 2^n varyasyon demek (n = değişken sayısı), pratik değil.

Üçüncü yanılgı: creative quality'yi test etmek. "Bu görsel daha güzel" subjektif — IPM objective. Bazen "daha az profesyonel" görünen creative daha iyi perform eder çünkü authenticity sinyali verir. Özellikle UGC-style creative'ler casual kategoride iyi çalışıyor.

### Icon Localization ve Tier-1 vs Emerging Market Dinamikleri

Tier-1 pazarda (US, UK, JP, KR) minimalist icon daha iyi perform ediyor — app store'da clutter fazla, basit icon dikkat çekiyor. Emerging market'te (BR, IN, ID) daha detaylı, renkli icon tercih ediliyor çünkü "value perception" farklı — detay = kalite sinyali.

Custom Product Pages tier-1'de segment başına ayrı creative set kullanmanıza izin veriyor, ama localization maliyeti var. Her market için ayrı asset üretmek yerine clustering yapın: tier-1 cluster, LATAM cluster, APAC cluster. 3 creative set, 15 market yerine global rollout'tan %40 daha iyi perform ediyor (internal Roibase benchmark, 2025-2026).

## Play Experiments'i UA Campaign'e Bağlamak

Custom Product Pages sadece organic store browse için değil — Apple Search Ads (ASA) ve Google App campaigns (GAC) trafiğine de custom creative set gösterebiliyorsunuz. ASA'da campaign-level CPP assignment var: tier-1 keyword campaign'i CPP-A'yı göstersin, brand campaign CPP-B'yi göstersin.

Bu UA-ASO loop'u kapatıyor. Örnek: GAC'de video ad çalıştırıyorsunuz, ad'daki hero character mavi zırhlı karakter. Store listing'inizde kırmızı zırhlı karakter var — expectation mismatch, install CVR düşer. Custom Product Page ile GAC trafiğine mavi zırhlı creative set gösterirseniz, consistency artar, CVR %18-25 yükselir.

[Premium Yayıncı Programı](https://www.roibase.com.tr/tr/premiumyayinci) ile tier-1 publisher traffic'i direkt custom CPP'ye route edebiliyorsunuz — publisher creative'i ile store creative'i align olunca install quality artıyor (D7 retention %12 daha yüksek, internal data).

---

6 haftalık PPO döngüsü tek seferlik değil, sürekli iterasyon. Her döngüde %8-12 IPM kazancı compound ediyor. Statistical significance eşiğini atlarsanız, false positive'e düşersiniz — yanlış creative'i scale edersiniz. Sample size hesabını doğru yapmak, traffic split'i optimize etmek ve isolated variable test disiplini creative testing'i tahmin oyunundan mühendislik sürecine dönüştürüyor. IPM %32 artışı burada başlıyor — test setup'ında, hypothesis design'da, significance calculation'da.