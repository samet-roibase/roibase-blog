---
title: "MMM + Incrementality: 2026'nın Attribution Setup'ı"
description: "Robyn, Meta Lift, geo experiments — hangisini ne zaman kullanacaksın? Cookie sonrası attribution için pratik decision tree."
publishedAt: 2026-06-04
modifiedAt: 2026-06-04
category: marketing
i18nKey: marketing-004-2026-06
tags: [mmm, incrementality, attribution, robyn, geo-test]
readingTime: 8
author: Roibase
---

Cookie tracking %80 silindi, Multi-Touch Attribution (MTA) artık güvenilir değil, platform dashboardları birbirini tutmuyor. 2026'da pazarlamacılar "katkı" ölçümünü iki farklı yöntemle birleştiriyor: Marketing Mix Modeling (MMM) ile incrementality testleri. Sorun şu: hangisini ne zaman kullanacağını bilen az. Bu yazı Robyn (Meta'nın açık kaynak MMM kütüphanesi), Meta Lift API ve geo-based holdout testlerini aynı setup içinde nereye koyacağını gösteriyor.

## Last-touch attribution öldü — ama yerine ne koyacağız?

Google Analytics 4 "data-driven attribution" diyor, Meta "modeled conversions" diyor, TikTok kendi sayısını veriyor. Üçü de farklı rakam. 2025'te 100 dolar harcayan bir e-ticaret markası GA4'te 8 conversion görürken Meta'da 12, TikTok'ta 6 görebiliyor. Hangi kanal gerçekten işe yarıyor? Last-touch modeli cevap veremiyor çünkü kullanıcı birden fazla touchpoint'ten geçiyor ve her platform kendi kendine kredi veriyor.

Marketing Mix Modeling bu sorunu farklı açıdan çözer: kanalları bağımsız değişken olarak alır, satış veya revenue'yu bağımlı değişken yapar, regresyon ile her kanalın marginal katkısını hesaplar. Incrementality testleri ise daha direkt: bir grubu bir kanala maruz bırakırsın, diğer grubu bırakmazsın, farkı ölçersin. İkisi de son dokunuş illüzyonunu kırar ama kullanım senaryoları çakışmıyor.

Fark şurada: MMM makro (uzun dönem, tüm kanallar), incrementality mikro (kısa dönem, spesifik kanal veya kampanya). İkisini birleştiren setup 2026'da standart hale geldi.

## MMM: Robyn ile haftalık regresyon setup'ı

Meta'nın Robyn kütüphanesi Facebook Marketing Science ekibinin açık kaynaklı MMM framework'ü. R ile çalışır, Bayesian ridge regression kullanır, adstock (gecikmeli etki) ve saturation (azalan verim) eğrilerini otomatik fit eder. Haftalık granülaritede TV, display, paid social, SEO, email gibi kanalların her birinin satışa katkısını yüzde olarak verir.

**Robyn setup'ının 4 bileşeni:**

1. **Veri toplama:** En az 1,5 yıl haftalık veri. Her satır bir hafta. Sütunlar: her kanal için harcama, impression veya click; bağımsız değişkenler (fiyat, stok, sezonalite); bağımlı değişken (revenue, order, conversion). Boşluk olursa model çalışmaz.
2. **Hyperparameter tuning:** Robyn her kanal için adstock decay (α) ve saturation shape (γ) parametrelerini arar. 2000+ model kombinasyonu çalıştırıp Pareto frontier'dan en iyi 5-10 modeli önerir. Bu aşama 10-30 dakika sürer (64 core'da).
3. **Model seçimi:** En düşük NRMSE (Normalized Root Mean Squared Error) + en yüksek decomp.rssd (çözümleme kararlılığı) kombinasyonuna sahip modeli alırsın. Bu modelin output'u: her kanalın toplam satışa katkı yüzdesi, ROI tahmini, optimal spend dağılımı.
4. **Budget allocation:** Robyn "budget allocator" fonksiyonu ile toplam bütçeyi yeniden dağıtır — her kanalın marjinal ROI'sini eşitleyecek şekilde. Bu output'u kullanarak next quarter planını yaparsın.

**Robyn ne zaman kullanılır:**
- Kanallararası bütçe dağıtımı kararları (örn. Q3 planı)
- Yeni kanal ekleme/çıkarma simülasyonu
- Uzun dönem trend analizi (6 ay+)

**Robyn ne zaman KULLANILMAZ:**
- Kampanya içi optimize etmek için (2 haftadan kısa dönemler)
- Platform-spesifik creative test kararı (çünkü MMM creative farkını göremez)
- Real-time bidding feedback (çünkü haftalık gecikme var)

Roibase'in [Dijital Pazarlama](https://www.roibase.com.tr/tr/dijitalpazarlama) hizmeti içinde Robyn modelini kuruyoruz: GA4, server-side GTM, Meta CAPI ve BigQuery'yi birbirine bağlayıp haftalık ETL pipeline kuruyoruz, model çıktısını Data Studio'da görselleştiriyoruz.

## Incrementality testleri: Meta Lift ve geo-based holdout

MMM "ne kadar" sorusunu yanıtlar, incrementality "gerçekten işe yarıyor mu" sorusunu yanıtlar. İki farklı soru. Meta'da 100 bin TL harcayıp 120 conversion alıyorsan bu "iyi" mi? MMM sana "Meta bütçenin %15'ini alıyor, toplam satışın %12'sini getiriyor" der. Ama bu conversion'ların kaçı zaten alışveriş yapacaktı (organic)? Bunun için incrementality testi gerekir.

### Meta Conversion Lift

Meta Lift API, Facebook ve Instagram reklamlarının **gerçek etkisini** ölçer. Nasıl? Kampanyayı küçük bir holdout grubuna göstermez, diğer gruba gösterir, 7-14 gün sonra farkı ölçer. Fark = incremental conversions.

**Setup:**
- Kampanya başlamadan önce Lift study açılır (Ads Manager > Measure & Report > Conversion Lift)
- Holdout oranı %5-10 olur (çok küçük = gürültü, çok büyük = impression kaybı)
- Test süresi en az 7 gün (kısa = istatistiksel güç düşük)
- Sonuç: incremental conversions, incremental CPA, confidence interval

**Örnek sonuç yorumu:**
Control group: 1000 kişi, 40 conversion
Test group: 9000 kişi, 450 conversion
Incremental conversion = (450/9000 - 40/1000) × 9000 = 90 conversion
Lift = 90 / (450 - 90) = %25

Yani kampanyanın gördüğü 450 conversion'ın sadece 90'ı gerçekten reklamdan gelmiş. Diğerleri zaten alacaktı. Incremental CPA = (harcama) / 90. Bu sayı MTA'dan %30-60 daha yüksek çıkar — çünkü gerçek.

**Meta Lift ne zaman kullanılır:**
- Yeni kampanya veya kreatiflerin A/B testi
- Platform kararı (Meta vs. Google vs. TikTok hangisi daha incremental?)
- Retargeting'in gerçek katkısını ölçmek (sık sorun: retargeting her zaman düşük CPA verir ama %80'i zaten alırdı)

**Dezavantajı:**
- Sadece Meta'da çalışır (Google'da benzeri Display & Video 360'ta var ama sınırlı)
- Holdout grubu yaratınca impression kaybedersin (kısa vadede revenue düşer)
- Test süresi en az 1 hafta — günlük karar vermeye uygun değil

### Geo-based experiments (coğrafi holdout)

Google, TikTok, TV gibi Meta dışı kanallar için geo-based test yaparsın: bazı şehirlerde kampanya açarsın, bazı şehirlerde açmazsın, satış farkına bakarsın. Bu yöntem akademik olarak en temiz incrementality ölçümü çünkü kullanıcı seviyesinde manipülasyon yok.

**Setup örneği:**
- 30 şehir seç (nüfus, ekonomik seviye benzer)
- 15'inde Google Ads kampanyasını aç, 15'inde kapalı tut (randomize et)
- 4 hafta bekle
- Google Analytics 4'te şehir bazlı conversion'ları karşılaştır

**Analiz:**
- Treated cities: ortalama 120 conversion/şehir
- Control cities: ortalama 95 conversion/şehir
- Incremental lift: (120 - 95) / 95 = %26.3

Bu %26.3 lift'i tüm ülkeye genellersin. Google Ads harcaması 200 bin TL ise incremental revenue'yu hesaplayıp incremental ROAS'ı bulursun.

**Geo test ne zaman kullanılır:**
- Multi-channel setup'ında her kanalın net katkısını ölçmek
- TV, OOH, podcast gibi dijital olmayan kanalların etkisini görmek
- Platform dashboard'larının sayılarına güvenmiyorsan

**Dezavantajı:**
- Şehir sayısı az olursa istatistiksel güç düşük (minimum 20 şehir)
- Coğrafi heterojenite varsa sonuç yanıltıcı (örn. İstanbul vs. Şanlıurfa aynı sepete konmaz)
- Uzun sürer (4-8 hafta)

## Decision tree: hangi yöntemi ne zaman kullanacaksın?

Üç yöntemi aynı setup'ta şöyle organize ediyoruz:

| Senaryo | Yöntem | Frekans | Çıktı |
|---------|--------|---------|-------|
| Quarterly budget allocation | Robyn MMM | 3 ayda 1 | Kanal bazlı ROI, optimal spend |
| Yeni kampanya testi (Meta/Instagram) | Meta Lift | Her büyük kampanya | Incremental CPA |
| Cross-channel incrementality | Geo-based holdout | 6 ayda 1 | Kanal bazlı gerçek lift |
| Creative refresh kararı | Meta Lift + CRO analizi | Ayda 1 | Hangi creative incremental |
| Real-time bidding | Platform API (ROAS feedback) | Günlük | Tactic seviyesi optimizasyon |

**Pratik akış:**
1. **Haftalık:** Platform dashboard'larını izle (MTA benzeri ama güvenme)
2. **Aylık:** Meta Lift ile büyük kampanyaları test et
3. **Quarterly:** Robyn ile tüm kanalların uzun dönem katkısını modelleyip bütçeyi yeniden dağıt
4. **Yılda 2 kez:** Geo-based test ile her kanalın gerçek lift'ini doğrula

Bu 3 katmanlı setup sayesinde hem kısa dönem taktiği (hangi creative çalışıyor) hem uzun dönem strateji (hangi kanala ne kadar bütçe) kararlarını data ile verirsin.

## Yaygın yanılgılar ve tradeoff'lar

**Yanılgı 1:** "MMM yaparsan incrementality testi gereksiz"
Hayır. MMM korelasyonu gösterir, nedenselliği varsayar. Incrementality testi nedenselliği ölçer. İkisi birbirini tamamlar. Örnek: MMM diyor ki "Instagram %15 katkı veriyor", ama Lift testi gösteriyor ki bunun %40'ı organik olurdu. O zaman gerçek katkı %9.

**Yanılgı 2:** "Incrementality testi her kampanyada yapılır"
Hayır. Holdout grubu yaratmak impression kaybıdır. Sadece büyük kararlar için test açarsın (yeni kanal, yeni creative direction, retargeting stratejisi). Küçük optimizasyonlar için A/B test yeterli.

**Yanılgı 3:** "Robyn bir kere kurulur, sonra otomatik çalışır"
Hayır. Model her çeyrekte yeniden eğitilir. Yeni kanal eklersen, fiyat değişirse, sezonalite farklılaşırsa model güncellenmeli. Robyn setup'ı sürekli bakım gerektirir.

**Tradeoff 1: Hız vs. kesinlik**
MMM 1,5 yıl veri ister, sonuç 1 hafta gecikmeli. Geo test 4-8 hafta sürer. Hızlı karar vermek istiyorsan platform dashboard'una güvenmek zorundasın ama %30-50 hata payı kabul edersin.

**Tradeoff 2: Granularite vs. sample size**
Geo test şehir bazlı yapılırsa sample size küçük, güven aralığı geniş. İlçe bazlı yapılırsa heterojenite artar. Haftalık MMM günlük kararlara cevap veremez. Her yöntemin çözünürlük sınırı var.

## 2026'da attribution stack nasıl kurulur?

Teknik setup şu bileşenlerden oluşur:

1. **Server-side GTM + first-party cookie:** GA4 ve Meta CAPI'ye temiz sinyal gönder (iOS ATT bypass değil, consent-based veri zenginleştirme)
2. **BigQuery data warehouse:** Tüm platform verilerini tek yerde topla (GA4, Meta Ads API, Google Ads API, TikTok Ads API, CRM)
3. **dbt transformation:** Haftalık agrega tabloları oluştur (her satır = 1 hafta, her sütun = 1 kanal harcama + 1 outcome)
4. **Robyn pipeline:** R script'i Cloud Run'da haftada bir çalıştır, model çıktısını BigQuery'ye yaz
5. **Looker Studio dashboard:** MMM çıktısı + platform MTA sayıları + incrementality test sonuçları yan yana
6. **Slack alert:** Model NRMSE %10'un üstüne çıkarsa veri anomalisi uyarısı

Bu stack'i kurmak 4-6 hafta sürer. Sonrasında haftalık bakım 2-3 saat. ROI: bütçe dağıtımı %15-25 daha verimli olur (Robyn kendi benchmark'ında %18 iyileşme rapor ediyor).

## Şimdi ne yapmalısın?

Eğer hala last-touch attribution ile karar veriyorsan 2026'da yarışamazsın. İlk adım: BigQuery'ye platform verilerini akıt, 1,5 yıllık haftalık tablo oluştur. İkinci adım: Robyn'i kur, ilk modeli eğit. Üçüncü adım: bir sonraki büyük kampanyada Meta Lift study aç. Dördüncü adım: 6 ay sonra geo-based test ile cross-channel lift'i doğrula. Bu 4 adım senin attribution stack'ini MTA yanılsamasından incrementality temeline taşır.