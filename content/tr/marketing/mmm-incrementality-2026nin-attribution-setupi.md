---
title: "MMM + Incrementality: 2026'nın Attribution Setup'ı"
description: "Robyn, Meta Lift ve geo experiments — hangi metot ne zaman işe yarar? Post-cookie çağda attribution'ı yeniden inşa etmek için teknik klavuz."
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: marketing
i18nKey: marketing-004-2026-06
tags: [mmm, incrementality, attribution, robyn, meta-lift]
readingTime: 8
author: Roibase
---

Last-click attribution 2023'te öldü, multi-touch attribution 2024'te. 2026'da pazarlama ölçümü iki kutba ayrıldı: makro düzeyde Marketing Mix Modeling (MMM), mikro düzeyde incrementality testleri. Aralarında server-side conversion API'leri köprü kuruyor. Bu yazı hangi yöntemin hangi koşulda işe yaradığını, hangi çıktının hangi kararı beslediğini açıklıyor — soyut "attribution felsefesi" değil, pratikte kurulabilen bir stack.

## Marketing Mix Modeling artık haftalık çalışıyor

MMM 2015'te "yılda bir kez CEO için sunum" anlamına geliyordu. 2026'da Meta'nın Robyn'i gibi açık araçlar, Bayesian modelleri her hafta çalıştırıp kanal contribution'ını güncelleyebiliyor. Yapı şöyle: tarihsel harcama, impression, conversion ve dış faktör (mevsimsellik, tatil, rekabet indeksi) verisini time-series regresyon ile modeller, her kanalın marginal ROAS'ını çıkarır. 100.000 TL'yi hangi kanala ekleyince 1 ek satın alma geliyor — MMM bu soruyu cevaplıyor.

Kurulumu basit değil ama teknik gereksinim şeffaf: en az 52 haftalık günlük veri (tercihan 104 hafta), kanala tahsis edilebilen harcama satırları, dönüşüm sayısı (gelir verilebilirse daha iyi). Robyn Python ve R dilinde çalışır, BigQuery veya Snowflake'ten veriyi çeker, Prophet veya Stan ile posterior dağılımı hesaplar. Çıktı channel contribution grafiği, saturation curve ve response curve — hangi kanal budandan etkilenir, hangisi zaten diminishing returns noktasında.

Robyn'in 2026 sürümü geo-level granularity ekliyor: Türkiye'yi 7 bölgeye böldüğünüzde her bölge için ayrı saturation threshold hesaplanıyor. İstanbul'da Meta Ads %35 saturation'dayken Anadolu'da %10 olabilir — bu farkı görmek budget shift kararını değiştiriyor. Ama dikkat: MMM **causality kanıtlamaz**, korelasyon gösterir. "Google Ads harcaması arttığında satışlar arttı" demek "Google Ads satışa sebep oldu" demekle aynı şey değil. İşte bu boşluğu incrementality kapatıyor.

## Meta Lift incrementality'yi platform içinde çözdü

Meta'nın Conversion Lift testi tam bir randomized controlled trial (RCT). Kullanıcı kitlenizi ikiye böler: test grubuna reklam gösterir, kontrol grubuna göstermez. İki grup arasındaki conversion farkı o kampanyanın **net katkısıdır**. 2026'da bu sistem campaign level'den creative level'a indi — aynı kampanya içinde 3 farklı video için ayrı ayrı incrementality ölçülüyor.

Teknik setup şöyle: Ads Manager'da "Create A/B Test" yerine "Create Lift Test" seçiyorsunuz, minimum 200.000 erişim ve 2 haftalık süre gerekiyor (Meta bunu enforcement ediyor). Kontrol grubunun %10-20 arasında kalması öneriliyor — daha az olursa istatistiksel güç düşüyor, daha fazla olursa gelir kaybı büyüyor. Test bitince Meta size şunu veriyor: "Test grubunda 1000 conversion, kontrol grubunda 700 conversion → %30 incremental lift, confidence interval %18-%42".

Bu rakam doğrudan budget'a bağlanıyor. Kampanya 100.000 TL harcadıysa ve %30 lift gösterdiyse, 30.000 TL'lik harcama gerçekten ek satışa dönüşmüş demektir — kalan 70.000 TL organik veya başka kanalın etkisiyle zaten gelecek satışlara atfedilmiş olabilir. Buradan marginal cost per incremental conversion (mCPIC) hesaplarsınız: 100.000 / 300 = 333 TL. Bu sayıyı MMM'nin output'u olan "Meta'nın son 1000 TL'lik harcaması 2.8 satın alma getirdi" ile karşılaştırırsınız — iki rakam birbirini doğrulamalı, %15-20 fark normal (metodolojik fark), %50+ fark varsa veri sorunusunuz var.

Meta Lift'in kısıtı: sadece Meta ekosisteminde çalışıyor, cross-channel etkiyi ölçemiyor. Google Ads + Meta birlikte çalıştığında sinerjik lift var mı? Bunu geo experiment ölçüyor.

## Geo experiments cross-channel sinerjiye bakıyor

Google'ın Geo Experiments çerçevesi şöyle: Türkiye'yi 10 bölgeye böl, 5 tanesinde harcamayı %20 artır (veya tamamen kapat), 5 tanesinde olduğu gibi bırak. 4 hafta sonra iki grubun satış farkına bak — fark varsa ve istatistiksel olarak anlamlıysa (p<0.05), harcama değişikliği o farkın sebebidir. Bu yapı Meta Lift'ten farklı: kanal ayırt etmiyor, bölge bazlı toplam etkiye bakıyor.

Pratikte şöyle kuruluyor: Campaign Manager 360 veya Google Ads'te "Experiments" > "Geo experiment" seçeneği var (2026'da GA4'ten de tetiklenebiliyor). Bölge tanımlamak için posta kodu, il veya DMA (Türkiye'de NUTS2 bölge) kullanılıyor. Minimum 6 haftalık baseline verisi gerekiyor, test süresi en az 3 hafta (tercihan 6 hafta — mevsimsel noise'u bastırmak için). Google'ın Bayesian inference motoru her gün posterior günceller, test bittiğinde "harcama %20 artışı satışları %8.5 artırdı (CI: %4.2 - %12.8)" gibi çıktı verir.

Bu metot özellikle çapraz kanal stratejilerini test etmek için güçlü. Örneğin: "Google + Meta birlikte çalışınca ayrı ayrıya göre %15 daha fazla satış getiriyor mu?" sorusunu cevaplamak için A grubunda her iki kanalı full throttle çalıştırırsınız, B grubunda Google'ı %50 kısarsınız. Satış farkı %10'dan az çıkarsa sinerji yok demektir, budget'ı yeniden dağıtırsınız. Geo experiment'in dezavantajı: setup maliyetli (6 haftalık baseline + 6 haftalık test = 3 ay), sonuçlar ancak strateji değişikliğine yetecek kadar büyük değişim test edildiğinde anlamlı çıkıyor. %5'lik budget tweak'i ölçmeye çalışırsanız noise içinde kaybolur.

## Hangi metot ne zaman — decision tree

Kararınızı 3 soruyla daraltabilirsiniz:

1. **Karar scope'u nedir?** Yıllık budget dağılımı → MMM. Kampanya-spesifik creative karşılaştırması → Meta Lift. Cross-channel sinerji testi → Geo experiment.

2. **Veri zemin hazır mı?** MMM için 52+ haftalık temiz harcama + conversion verisi şart. Lift için 200K+ erişim ve 2 hafta. Geo için 6 hafta baseline + coğrafi segmentasyon.

3. **Karar hızı ne olmalı?** Haftalık optimize → Meta Lift sürekli açık. Çeyrek bazlı strateji → MMM her ay refresh. Yılda 1-2 büyük pivot → Geo experiment.

Tablo şöyle:

| Metot | Çıktı | Süre | Minimum veri | İdeal kullanım |
|---|---|---|---|---|
| MMM (Robyn) | Kanal contribution, saturation | 52+ hafta | Harcama + conversion (günlük) | Budget allocation stratejisi |
| Meta Lift | Incremental conversion per campaign/creative | 2-4 hafta | 200K erişim | Creative testing, kampanya pruning |
| Geo Experiment | Cross-channel synergy, regional lift | 6-12 hafta | 6 hafta baseline + bölge verisi | Kanal sinerji testi, bölgesel expansion |

Bu üç metot birbirinin alternatifi değil, tamamlayıcısı. MMM "hangi kanal ne kadar değerli" der, Lift "bu kampanya gerçekten değer kattı mı" der, Geo "iki kanal birlikte daha mı iyi" der. Üçünü de işleten ekip, [Performans Pazarlaması](https://www.roibase.com.tr/tr/ppc) stratejisini tahmine değil, deneysel kanıta dayandırır.

## Stack'i pratikte kurmak

Teorik framework'ü pratiğe dökmek için gereken katmanlar:

**Veri toplama:** Server-side GTM ile conversion sinyallerini Google Ads, Meta CAPI ve BigQuery'ye paralel gönderin. Client-side cookie'ye güvenirseniz %30-40 sinyal kaybedersiniz (iOS 17, Firefox, Brave). Roibase'in [Dijital Pazarlama](https://www.roibase.com.tr/tr/dijitalpazarlama) altyapısı sGTM + first-party data layer'ı birleştiriyor — MMM için gerekli granüler harcama verisi buradan geliyor.

**Model pipeline:** Robyn'i BigQuery'den besleyin. dbt ile harcama + conversion verisini günlük grain'de model edin. Python script haftalık çalışsın (Cloud Function veya Airflow), output'u Looker Studio'ya çeksin. Lift testlerini Meta Ads Manager'dan manuel başlatın ama sonuçları API ile çekin (Marketing API `insights` endpoint'i lift metriğini dönüyor), BigQuery'ye yazıp Robyn output'uyla join edin.

**Geo experiment:** Google Ads API `experiments` resource'u ile programatik kurulum mümkün. Test bitince `experiment_id` ile sonuç çekin, yine BigQuery'ye yazıp MMM sonuçlarıyla karşılaştırın. Hepsini tek bir dashboard'da görmek çok değerli: "MMM'ye göre Meta contribution %22, Lift testine göre incremental %28, Geo testine göre regional variance %12-34 arası" — bu 3 rakam birlikte strateji kararını netleştiriyor.

**Karar döngüsü:** Her çeyrekte MMM refresh, her ay 1-2 Lift testi, 6 ayda 1 Geo experiment. Küçük ekipler için bu tempo fazla geliyorsa önce MMM'yi kurun (açık data varsa 2 haftada kurulur), ardından Meta Lift'i rutin yapın (her kampanyaya default ekleyin), Geo'yu sadece büyük pivot öncesi kullanın.

2026'da attribution tek bir araç değil, üç aracın orkestrasyon. Her biri farklı soru cevaplıyor, hepsi birlikte post-cookie gerçeklikte kararı mümkün kılıyor. Tahmin yerine test, korelasyon yerine causality, dashboard yerine experiment sonucu — büyüme bu temele kurulu.