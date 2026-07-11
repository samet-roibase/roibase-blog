---
title: "MMM + Incrementality: 2026'nın Attribution Setup'ı"
description: "Robyn, Meta Lift ve geo experiments: cookie sonrası pazarlama ölçümünde hangisi ne zaman kullanılır, test setup'ları ve karar ağacı."
publishedAt: 2026-07-11
modifiedAt: 2026-07-11
category: marketing
i18nKey: marketing-004-2026-07
tags: [mmm, incrementality, attribution, robyn, meta-lift]
readingTime: 8
author: Roibase
---

Cookie sonrası pazarlama ölçümü "attribution" kelimesinin anlamını değiştirdi. 2026'da artık hangi kullanıcının hangi reklamı gördüğünü track etmek yerine, hangi kanalın gerçek satış artışını tetiklediğini izole etmek zorundasınız. Marketing Mix Modeling (MMM) ve incrementality testleri bu yeni oyunun temel araçları — ama ikisi de aynı soruyu farklı zaman dilimlerinde, farklı güven seviyelerinde yanıtlıyor. Meta'nın Robyn'i, Conversion Lift testleri ve geo-based experiments arasında seçim yapmak campaign timing'inize, bütçe esnekliğinize ve data maturity'nize bağlı.

## MMM: Geçmişi Okuyup Geleceği Tahmin Etmek

Marketing Mix Modeling bir regression ailesi. Geçmiş 2-3 yılın harcama, impression, makroekonomik faktör ve satış verisini alıp her kanalın toplam satışa katkısını izole eder. Robyn gibi açık kaynak frameworkler Bayesian optimization'ı bu işin üzerine koyarak modelin hiperparametrelerini (adstock, saturation curves) otomatik kalibre ediyor.

Robyn'in çıktısı bir dizi "response curve": her kanal için harcama artışının marjinal ROAS'ını gösterir. Örneğin Meta'ya 100.000 TL daha verdiğinizde 3.2 ROAS beklersiniz, ama Google Search'e aynı parayı verirseniz 4.1 — bu tür kararları almak için MMM'in kütükleşmiş verisi gerekiyor. 2026'da Robyn v4.1, Prophet-based seasonality decomposition ve holiday effect'leri otomatik parse ediyor; manuel calendar event dummy'leri artık deprecated.

MMM'in zayıflığı gecikme: model kurulumu 4-6 hafta sürüyor, çünkü en az 100-120 haftalık veri (2+ yıl) isteniyor. Yeni bir kanal açtıysanız (örneğin TikTok) ilk 12 haftanın datası insanely noisy; MMM ona güvenilir katsayı atamıyor. Bu durumda kısa dönem incrementality testi devreye giriyor.

## Meta Conversion Lift: Hızlı, Dar, Pahalı

Meta Conversion Lift (eski Lift Studies) randomized controlled trial formatında çalışır: kullanıcıları test (ad gören) ve control (PSA gören) gruplarına böler, dönüşüm farkını hesaplar. 2-4 hafta içinde sonuç alırsınız — bu MMM'in aksine real-time decision için elverişli.

Lift test'in şartı minimum 200.000 kullanıcı reach ve kampanyanın normal budget'ının %5-10'unu control group'a "harcamış" saymanız. Pratikte bu 50.000-100.000 TL arası impression waste demek, çünkü control grubuna PSA gösteriyorsunuz ama onların dönüşümlerini conversion event'e eklemiyorsunuz. Meta bu parayı geri vermiyor — test maliyeti olarak kabul etmeniz lazım.

2026'da Meta, Conversion Lift'i server-side event'lerle entegre etti: CAPI üzerinden gönderilen `Purchase` event'leri artık lift hesaplamasında direkt kullanılabiliyor. iOS 17+ kullanıcılarında bile güvenilir sonuç alınıyor çünkü test/control assignment server-side ID'lere bağlı. Ama tek kısıtlama: Lift yalnızca Meta platformunu ölçüyor — cross-channel halo effect'i görmüyorsunuz. Eğer Instagram kampanyanız organik Google Search trafiğini artırıyorsa, Lift bunu miss ediyor.

## Geo Experiments: Cross-Channel Halo'yu Yakalamak

Geo-based incrementality testleri şehir/bölge bazında treatment vs. control karşılaştırması yapar. Örneğin İstanbul ve Ankara'da Meta harcamasını %30 artırırsınız, İzmir ve Bursa'da sabit tutarsınız. 4-6 hafta sonra toplam satışlardaki delta'ya bakarsınız — bu yöntem kanallar arası spillover'ı da yakalar.

Google'ın GeoX tool'u bunu otomatikleştiriyor: synthetic control method ile her test geo için bir "counterfactual" satış eğrisi kuruyor. Pratikte İstanbul'un satışını, İstanbul'a benzer demografik/sezonluk özellikler gösteren 5-6 başka şehrin ağırlıklı ortalamasıyla tahmin ediyor. Treatment sonrası gerçek satış ile bu tahmin arasındaki fark incrementality.

Geo test'in avantajı: tüm online ve offline satış kanallarını kapsıyor. Dezavantajı: coğrafi spillover riski (İstanbul'daki reklam Kocaeli'nde de etkiliyor) ve market size farklılıkları. En az 10-12 geo cluster'ı olan brandler için çalışıyor; daha küçük operasyonlar için power yok.

2026'da GeoX, Google Cloud BigQuery'ye native entegre — GA4 + ürün datanızı BigQuery'den çekip direkt test pipeline'ına sokabiliyorsunuz. Kurulum 2 hafta, test süresi 4-6 hafta, toplam 6-8 haftalık cycle time.

## Hangisi Ne Zaman

Aşağıdaki decision tree'yi uygulayın:

| Durum | Araç | Neden |
|---|---|---|
| 2+ yıl veriniz var, stratejik bütçe dağılımı yapacaksınız | Robyn (MMM) | Uzun dönem response curves + saturation tespiti |
| Yeni bir creative format test ediyorsunuz (örn. Reels vs. Feed) | Meta Conversion Lift | Hızlı, format-spesifik, 2-4 hafta |
| Cross-channel halo effect şüpheniz var (örn. YouTube + Search sinerji) | Geo experiment | Kanallar arası spillover'ı yakalar |
| Hiçbir şey yok, sıfırdan başlıyorsunuz | Önce Lift, sonra MMM | İlk 6 ay lift ile tactically optimize, sonra MMM ile strategic |

Robyn için minimum kurulum: Python/R environment, 120+ hafta harcama + sales datası, Prophet'in çalıştığı bir node (2-4 core yeterli). Output weekly olarak refresh edilebilir ama model rebuild ayda 1 kez yapılmalı.

Meta Lift için minimum: Business Manager'da aktif kampanya, 200k+ haftalık reach, conversion event'i CAPI ile gönderiliyor olmalı. Lift approval 3-5 iş günü sürüyor, Meta'nın internal review'ı geçmesi lazım.

GeoX için minimum: 10+ geo cluster, BigQuery entegrasyonu, GA4 + transaction data. Google bu tool'u 2025 Q4'te public beta'ya açtı, 2026'da tam production.

## Robyn'in Pratik Pitfall'ları

Robyn kurulumu yapınca ilk karşılaşacağınız sorun hyperparameter tuning. Framework default olarak 100.000 model kombinasyonunu deniyor — bu 8-core makineyde 6-8 saat sürüyor. Production'da bunu haftada 1 kez çalıştırıyorsanız compute cost tolerable, ama günlük refresh isterseniz distributed Spark cluster gerekiyor.

İkinci pitfall: adstock effect'in window'u. Robyn default 13 hafta adstock penceresi kullanıyor — yani bir haftaki harcamanın satışa etkisi 13 hafta boyunca decay ediyor. Ama fast fashion brand'lerinde ürün lifecycle 4-6 hafta; 13 haftalık adstock saçmalık. Bu parametreyi category'nize göre manuel override etmeniz lazım, yoksa model TV reklamı gibi long-tail kanalları overestimate ediyor.

Üçüncü pitfall: seasonality. Prophet otomatik Fourier decomposition yapıyor ama Türkiye'de Ramazan, Kurban ve Black Friday gibi floating holiday'ler var. Bunları `holidays` dataframe'ine manuel eklemelisiniz. 2026'da Robyn v4.1, iCal formatında holiday import'u destekliyor — Google Calendar'dan direkt çekebilirsiniz.

## Hangi Karar İçin Hangi Confidence

MMM'in output'u probabilistic — her kanal için bir mean coefficient ve %95 confidence interval. Örneğin Meta'nın ROAS'ı 3.2 ± 0.7 diyorsa, gerçek değer 2.5 ile 3.9 arasında %95 ihtimalle. Bu range dar değilse (örneğin ±1.2) o kanalın katsayısı unstable demektir, daha fazla data toplamalısınız.

Lift test'in confidence'ı sabit: Meta %90 confidence threshold kullanıyor. Eğer test sonucu "statistically significant değil" diyorsa, ya sample size küçük ya da gerçekten hiç lift yok. Pratikte 200k reach'te %10'luk lift yakalayabilirsiniz, ama %5'in altındaki lift'i detect etmek için 500k+ reach gerekiyor.

Geo experiment'in confidence'ı synthetic control'ün fit quality'sine bağlı: pre-treatment dönemde gerçek satış ile synthetic control arasındaki MAPE (mean absolute percentage error) %5'in altındaysa güvenilir, %10'un üzerindeyse geo cluster'larınızı revize edin.

## Son Not: Karar Ağacını Workflow'a Gömmek

2026'da başarılı [performans pazarlama](https://www.roibase.com.tr/tr/ppc) ekipleri MMM + incrementality'yi aynı decision pipeline'da kullanıyor: Robyn her ayın ilk haftası çalışıyor, quarterly budget allocation'ı güncelliyor. Lift testleri yeni creative/format launch'larında koşuluyor, 2-4 haftada tactical pivot kararı veriliyor. Geo experiments yılda 2-3 kez, major channel mix değişikliklerinde (örneğin TikTok budget'ini %50 artırmadan önce) validation için kullanılıyor.

Bu setup'ı kurmak için data pipeline'ınızda şu üç flow'un ayrı ayrı çalışıyor olması lazım: (1) daily transaction + spend data BigQuery'ye akıyor, (2) Robyn haftalık refresh için bu data'yı consume ediyor, (3) Lift ve GeoX sonuçları BI dashboard'a manuel import ediliyor. Hepsi aynı looker dashboard'da toplanıp CMO'ya sunuluyor — "geçen ay Meta ROAS 3.4'tü (MMM), yeni Reels format 12% lift verdi (Lift), TikTok geo test başarısız (GeoX)" şeklinde consolidated insight.