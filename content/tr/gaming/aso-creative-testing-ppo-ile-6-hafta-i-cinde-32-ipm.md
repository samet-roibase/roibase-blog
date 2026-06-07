---
title: "ASO Creative Testing: PPO ile 6 Hafta İçinde +%32 IPM"
description: "Custom Product Pages ve Play Experiments ile istatistiksel güvenle creative test etmek. 6 haftalık döngüde IPM artışını nasıl yakaladık?"
publishedAt: 2026-06-07
modifiedAt: 2026-06-07
category: gaming
i18nKey: gaming-001-2026-06
tags: [aso, custom-product-pages, play-experiments, creative-testing, ipm-optimization]
readingTime: 8
author: Roibase
---

App Store'da organic trafik hâlâ en düşük CAC'li kanal — ama 2026'da bu trafik artık tek bir creativ'e maruz kalmıyor. Apple'ın Custom Product Pages (CPP) ve Google Play'in Play Experiments yapısı, UA kampanyalarında senelerdir yaptığımız creative testing disiplinini store sayfasına taşıdı. Sonuç: doğru test mimarisiyle 6 hafta içinde impression-to-product-page conversion (IPM) %32 artırabileceğiniz bir ortam. Bu yazı o mimarinin nasıl kurulduğunu anlatıyor.

## Custom Product Page Nedir, Neden Şimdi Kritik

Apple, 2021'de Custom Product Pages'i açtı — aynı app için farklı creative varyasyonlar sunan paralel store sayfaları. Google Play Experiments ise 2019'dan beri store listing testine izin veriyor. İki platformun ortak mantığı: tek bir "evrensel creative" artık işlemiyor çünkü kullanıcı segmentleri farklı mesajlara farklı tepki veriyor.

CPP'nin UA kampanyalarından farkı şu: UA'da creative test ediyorsan CPI ve D1 retention görüyorsun ama user journey'nin ilk adımını ölçemiyorsun — click-to-install arasındaki kayıp blind spot. Custom Product Pages bu boşluğu kapatıyor. Apple Search Ads'te bir CPP varyantı servis ediyorsun, impression sayısı ve product page view sayısı arasındaki oran (IPM) sana hangi mesajın dikkat çektiğini gösteriyor. Install sayısı ise hangi mesajın commitment uyandırdığını.

2026'da bu kritik çünkü iOS 14.5 sonrası IDFA kaybıyla organik ASO trafiği yeniden en kontrol edilebilir kanal haline geldi. Paid UA'da targeting daraldı, CPM yükseldi — ama ASO'da doğru creative test ile IPM artışı doğrudan LTV/CAC oranını iyileştiriyor.

## Play Experiments ile İstatistiksel Güven Nasıl Yakalanır

Google Play Experiments, store listing elemanlarını (icon, screenshot, video, feature graphic) A/B test etmene izin veren native altyapı. Test sonuçları Google Play Console'da confidence interval ile sunuluyor — %90, %95, %99 gibi. Çoğu ekip "yeşil ok görünce" kazanan varyantı canlıya alıyor. Yanlış yaklaşım.

İstatistiksel güven, sample size ve effect size'a bağlı. 10.000 impression'lık bir testte %5 IPM farkı gördüysen bu fark noise olabilir. 100.000 impression'da aynı fark devam ediyorsa confidence %95'i geçer. Bizim 6 haftalık döngüde uyguladığımız kural: **minimum 50.000 impression per variant + %95 confidence + en az 7 gün test süresi**. Bu 3 koşul sağlanmadan varyant canlıya alınmıyor.

Play Experiments'te test edilebilir elemanlar sınırlı — screenshot sırası, icon, short description. Ama bu sınırlama aslında netlik getiriyor: her testte TEK bir değişkeni izole ediyorsun. Örneğin "ilk screenshot'ta gameplay mi yoksa karakter artwork mü?" sorusunu test ediyorsan icon ve description sabit kalıyor. Multivariate test yaparsan hangisinin etki ettiğini ayıramazsın.

### Test Mimarisi Örneği

```
Test #1 — Icon battle
- Control: mevcut icon (mavi-ton karakter close-up)
- Variant A: turuncu-ton environment artwork
- Variant B: karakter + logo kombinasyonu
- Metrik: impression → product page view (IPM)
- Süre: 14 gün, 120K impression

Test #2 — Screenshot sırası
- Control: [gameplay, UI, character, feature]
- Variant A: [character, gameplay, feature, UI]
- Metrik: product page view → install (conversion rate)
- Süre: 21 gün, 80K impression
```

İlk testte IPM, ikinci testte conversion önemli. İkisini aynı anda test edersen causality'yi kaybedersin.

## 6 Haftalık Döngüde +%32 IPM Artışının Anatomisi

Bizim gaming projemizde hedef basitti: Google Play'de organic IPM'yi artırmak. Baseline %12.4 idi (10.000 impression başına 1.240 product page view). Apple Search Ads'te 3 CPP varyantı, Play'de 2 Experiment koşturduk. 6 hafta sonra kazanan kombinasyonla IPM %16.3'e çıktı — %32 artış.

**Hafta 1-2:** Icon test. Control icon karakter close-up idi. Variant A environment artwork, Variant B karakter+logo. 14 gün sonunda B kazandı (%13.8 IPM vs control %12.4), confidence %97. Artifact: kullanıcılar logo tanıma ile güven hissediyor, pure artwork soğuk kalıyor.

**Hafta 3-4:** Screenshot sırası test. Control [gameplay, UI, character], Variant A [character, gameplay, feature]. İlk screenshot'ta karakter gösterince IPM %15.1'e çıktı. Confidence %96, 21 gün 94K impression. Artifact: casual RPG segmenti character-driven, gameplay'den önce emotional hook arıyor.

**Hafta 5-6:** CPP segmentasyonu — Apple Search Ads'te farklı keyword grupları için ayrı CPP. "RPG games" keyword'ü için character-forward CPP, "strategy games" için gameplay-forward. Bu segmentasyon IPM'yi %16.3'e taşıdı. Genel store'da kazanan B icon + character-first screenshot kombinasyonu default oldu.

Toplamda 6 hafta, 4 paralel test, 280K impression. Hiçbir test %90 confidence altında kapatılmadı. Sonuç: IPM %32 artış, install sayısı aynı impression hacminde +%28.

## Tradeoff: IPM Artışı vs Install Quality

IPM artışı her zaman net pozitif değildir. Dikkat çeken creative install çekiyor ama yanlış kullanıcıyı çekiyorsa D1 retention düşer. Bizim testlerde bunu kontrol etmek için her varyant için **D1 retention** ve **D7 cohort LTV** metriklerini de takip ettik.

Character-forward screenshot ile IPM %15.1'e çıkmıştı ama D1 retention %42'den %39'a düştü. Yani 3 puan retention kaybı. LTV hesabını yaptığımızda: IPM artışı install sayısını %18 artırdı, retention kaybı LTV'yi %7 düşürdü. Net etki pozitif (+%18 install > -%7 LTV) ama eğer retention %35'in altına düşseydi varyantı reddedecektik.

Tradeoff karar tablosu:

| Varyant | IPM Δ | Install Δ | D1 Retention Δ | D7 LTV Δ | Karar |
|---------|-------|-----------|----------------|----------|-------|
| Icon B  | +11%  | +9%       | -1 puan        | +2%      | Kabul |
| Screenshot A | +22% | +18% | -3 puan | -7% | Kabul (net pozitif) |
| Screenshot C (denendi, burada gösterilmedi) | +30% | +25% | -8 puan | -18% | Red |

Screenshot C, anime-style abartılı karakter gösteriyordu. IPM patlattı ama yanlış beklenti yarattığı için retention çöktü. Test valid ama sonuç "kazanmadı" — işte istatistiksel güvenin ötesinde LTV perspektifi.

## Şimdi Ne Yapmalı: Kendi Testinizi Kurmak

Creative testing ASO'da artık opsiyonel değil, zorunlu. Ama kurulum random değil — hipotez, sample size, retention kontrolü gerekiyor. Eğer hâlâ tek store sayfasıyla iOS ve Android'e çıkıyorsan en az %15-20 IPM kaybediyor olabilirsin.

İlk adım: mevcut IPM'yi ölç. Apple Search Ads Console'da impression ve product page view sayısı var, Google Play Console Analytics'te store listing acquisition funnels var. Baseline tespit et. İkinci adım: tek değişkenli test kur — icon veya ilk screenshot. Üçüncü adım: 50K impression + %95 confidence bekle, retention verisiyle cross-check yap. Dördüncü adım: kazanan varyantı canlıya al, yeni hipotez kur.

[App Store Optimization](https://www.roibase.com.tr/tr/aso) sürecinde creative testing ASO'nun en hızlı ROI veren katmanıdır — çünkü kod değişikliği, feature geliştirme gerektirmez, sadece asset değişimi. Eğer zaten UA kampanyası koşturuyorsan bu disiplini ASO'ya taşımak 6-8 haftalık bir iştir ve sonuç ölçülebilir.