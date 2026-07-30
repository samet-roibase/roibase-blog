---
title: "MMM + Incrementality: 2026'nın Attribution Setup'ı"
description: "Robyn, Meta Lift, geo experiments — hangisi ne zaman kullanılır? Post-cookie çağda pazarlama etki ölçümünün yeni katmanları."
publishedAt: 2026-07-30
modifiedAt: 2026-07-30
category: marketing
i18nKey: marketing-004-2026-07
tags: [mmm, incrementality, attribution, robyn, meta-lift]
readingTime: 8
author: Roibase
---

Cookie sonrası çağda last-click attribution hayalet gibi kayboldu. 2026'da pazarlama ekipleri artık "hangi kanal dönüşümü getirdi" sorusu yerine "hangi kanal olmadan dönüşüm gelmezdi" sorusuna yanıt arıyor. Bu paradigma değişiminin adı: incrementality. Ama incrementality ölçmek tek başına yeterli değil — uzun vadeli marka etkisini göremezsiniz. Burada devreye Marketing Mix Modeling (MMM) giriyor. 2026'nın sağlıklı attribution stack'i iki katmandan oluşuyor: MMM ve incrementality testleri. Meta'nın Robyn'i, Meta Lift, Google'ın geo experiments altyapısı — üçü de farklı soruları yanıtlıyor. Bu yazıda hangi aracın ne zaman kullanılacağını, nasıl birlikte çalıştığını ve setup sırasında düşülen tuzakları göreceksiniz.

## MMM: Uzun Vadeli Etki Haritası

Marketing Mix Modeling regresyon tabanlı bir yöntem — tarihsel harcama, medya exposure ve satış verisini birleştirerek her kanalın satışa katkısını hesaplıyor. Meta'nın açık kaynak Robyn framework'ü 2022'de çıktı ama 2025-2026'da production-ready hale geldi. Robyn adstock (reklam etkisinin zamanla azalması) ve saturation curve'leri (artan harcamanın azalan getirisi) modelleyerek kanallar arası bütçe dağılımını optimize ediyor.

MMM'in güçlü yanı: brand etkiyi yakalıyor. Bir podcast sponsorluğu bu hafta dönüşüm getirmeyebilir ama 6 hafta boyunca organik aramayı artırabilir. Last-click bu katkıyı görmez, MMM görür. Zayıf yanı: granülerlik yok. MMM size "Meta'ya ayda 50.000 TL daha harcayın" der ama "hangi kampanyaya, hangi creative'e harcayın" demez. Ayrıca MMM geçmişe bakar — gerçek zamanlı optimizasyon yapamaz.

Robyn'i doğru kurmak için minimum 2 yıllık haftalık veri gerekiyor (104 satır). Veri setinizde şunlar olmalı: kanal bazında harcama (Google Ads, Meta, TikTok, podcast, TV ayrı ayrı), toplam satış (revenue veya unit), fiyat değişimleri, tatil/sezonluk etkiler. Robyn hyperparameter tuning için Nevergrad kullanıyor — 100.000+ model çalıştırıp en iyi fit'i buluyor. Çıktısı: her kanal için mROAS (marginal ROAS) ve saturation noktası. Örnek: Meta için mROAS 3.2 ama spend 100.000 TL'yi geçince 1.8'e düşüyor. Bu tradeoff production'da [performans pazarlaması](https://www.roibase.com.tr/tr/ppc) bütçe dağılımını yönlendiriyor.

## Incrementality Testing: Kısa Vadeli Nedensellik

MMM korelasyon gösterir, incrementality nedensellik kanıtlar. Incrementality testi basit soru soruyor: Bu kampanyayı kapatırsam ne kaybederim? En yaygın yöntem: geo-based holdout. ABD'de 50 eyaletten 25'ini treatment (kampanya açık), 25'ini control (kampanya kapalı) olarak ayırıp satış farkını ölçüyorsunuz. Google Ads'in GeoX altyapısı bunu otomatikleştiriyor — bir kampanyayı seçip geo split yapıyorsunuz, 2-4 hafta sonra lift raporu geliyor.

Meta'nın Conversion Lift testi ise kullanıcı bazında holdout yapıyor. Meta Ads Manager'dan bir kampanyayı seçip "lift study" açıyorsunuz, Meta trafiğin %10'unu control grubuna ayırıyor (reklam görmüyor), %90'ı treatment. Test bittiğinde Meta size şunu söylüyor: treatment grubundaki dönüşüm oranı %2.3, control %1.9 — lift %21. Bu demek ki kampanyanın gerçek inkremental katkısı %21, geri kalan %79 zaten olacak dönüşümler (organik, remarketing, search).

Incrementality testinin zayıf yanı: pahalı ve yavaş. Geo-test minimum 2 hafta sürüyor, kullanıcı bazlı test 4-6 hafta. Test sırasında kontrol grubuna harcama yapmıyorsunuz — potansiyel kayıp var. Ayrıca her kampanyayı test edemezsiniz, sadece stratejik kanalları (yeni creative formatı, yeni platform, upper-funnel kampanya) test ediyorsunuz. Ama incrementality olmadan MMM sonuçlarını doğrulayamazsınız — MMM "Meta'nın ROAS'ı 4.2" diyebilir ama lift testi "hayır, gerçek lift %18, ROAS 1.6" diyebilir. İkisi birlikte hakikati veriyor.

### Holdout Stratejisi ve Sample Size

Geo-test başarısı sample size hesabında başlıyor. Google GeoX minimum 40 geo (şehir/eyalet) öneriyor — 20 treatment, 20 control. Daha az geo varsa (örneğin sadece İstanbul, Ankara, İzmir) power yetersiz kalıyor, istatistiksel anlamlılık gelmiyor. Meta Lift için minimum gereksinim: günde 50+ dönüşüm. Daha az dönüşümle test çalıştırırsanız confidence interval çok geniş olur — lift %10 ile %40 arasında bir yerde olabilir, karar veremezsiniz.

Test süresini belirlerken seasonality dikkate alın. Cuma-Pazar trafiği Pazartesi-Perşembe'den %30 fazlaysa testi tam haftalarla ayarlayın (2 hafta veya 4 hafta). Bir de spillover etkisi var: treatment geo'daki kullanıcı başka şehre gidip dönüşüm yapabilir. Bu durumda control grubunda noise oluşur, lift gerçek değerden düşük çıkar. Bunu telafi etmek için geo sınırlarını sıkı tutun (eyalet yerine metro area) veya cross-geo hareketliliğin düşük olduğu kategorilerde test yapın (yerel servis, QSR).

## MMM + Incrementality Birlikte Nasıl Çalışır?

İkisini birbirini doğrulayan katmanlar olarak düşünün. MMM uzun vadeli budget allocation veriyor, incrementality testleri bu allocasyon'ı doğruluyor. Akış şöyle:

1. **MMM çalıştır** — 2 yıllık veriyle Robyn modeli kur, kanal bazında mROAS hesapla.
2. **MMM çıktısına göre bütçe ayarla** — örneğin MMM "podcast spend'i 2x'le" diyorsa podcast bütçesini artır.
3. **Kritik kanalda incrementality testi aç** — podcast'i 4 hafta geo-split ile test et.
4. **Lift sonucunu MMM'le karşılaştır** — MMM "podcast ROAS 5.2" dedi, lift testi "gerçek lift %25, ROAS 3.1" dedi → MMM'i kalibre et.
5. **Döngüyü kapat** — yeni lift verisini Robyn'e prior olarak ver, modeli refine et.

Bu döngü 3 ayda bir tekrarlanır. MMM her çeyrekte yeniden çalışır (yeni 13 haftalık veri eklenir), incrementality testleri her ay 1-2 kanala rotasyon yapılır. Sonuç: hem makro seviyede doğru budget mix, hem mikro seviyede nedensel kanıt.

Bir örnek: e-ticaret brand, MMM'e göre Google Search ROAS'ı 8.2 — en karlı kanal. Ama Meta Lift testi açtıklarında görüyorlar ki Search trafiğinin %60'ı zaten brand terimi arıyor, bu kullanıcılar reklamı görmeseler de siteye geleceklerdi. Gerçek inkremental lift %15, ROAS 2.4. Bu bilgiyle Search bütçesini kısıp upper-funnel kanallara (YouTube, podcast) kaydırıyorlar. 2 çeyrek sonra MMM yeniden çalıştırıldığında brand search organik trafiği %18 artmış — podcast'in gecikmeli etkisi modelde görünüyor.

## Hangi Aracı Ne Zaman Kullanmalı?

**Robyn (MMM) kullan:**
- Yeni bir pazara giriyorsun, hangi kanallara yatırım yapacağını bilmiyorsun.
- Birden fazla kanalda (5+) harcaman var ve bütçeyi yeniden dağıtmak istiyorsun.
- Brand kampanyalarının (TV, podcast, influencer) uzun vadeli etkisini ölçmek istiyorsun.
- En az 2 yıllık haftalık satış + harcama verin var.

**Meta Lift kullan:**
- Meta'da yeni bir creative format test ediyorsun (Reels, Advantage+ catalog).
- Upper-funnel kampanya açtın, dönüşüme katkısını kanıtlamak istiyorsun.
- Günde 50+ dönüşüm var, 4-6 hafta test süresini göze alabilirsin.
- Control grubuna harcama yapmamak kabul edilebilir (maliyet toleransı var).

**Google GeoX (geo experiment) kullan:**
- Google Ads'te brand vs. non-brand kampanya split'ini test ediyorsun.
- Birden fazla platformda (Google + Meta + TikTok) aynı anda harcaman var, cross-channel inkrementality görmek istiyorsun.
- Türkiye'de şehir bazında geo split yapabilecek trafiğin var (İstanbul, Ankara, İzmir, Bursa, Antalya ayrı ayrı test edilebilir).

Eğer bütçen kısıtlıysa ve sadece bir araç seçeceksen: **önce incrementality testi yap** (Meta Lift veya GeoX). Çünkü incrementality hemen harekete geçirilebilir insight veriyor — "bu kampanyayı kapat, %30 tasarruf yap" diyebiliyor. MMM daha stratejik ama action almak için ekstra yorum gerekiyor. İdeal dünya: ikisini de çalıştırıp birbirini beslemek.

## Setup Tuzakları ve Kalibrasyon

**MMM tuzakları:**
- **Yetersiz veri:** 52 haftadan az veriyle Robyn çalıştırmayın — model overfit oluyor.
- **Missing variables:** Fiyat promosyonlarını, competitor harcamalarını modele eklemezseniz kanal etkisi şişirilir.
- **Adstock yanlış ayarı:** Her kanal için aynı adstock decay kullanmayın. TV 8 hafta, Meta 2 hafta decay gösterir — Robyn'e prior olarak verin.
- **Saturation ignore:** Robyn default olarak logaritmik saturation curve kullanıyor ama bazı kanallar (brand search) linear olabilir. Model fit'ine bakıp curve type ayarlayın.

**Incrementality tuzakları:**
- **Kısa test süresi:** 1 haftalık lift testi istatistiksel güç vermiyor. Minimum 2 hafta (geo), 4 hafta (user-level).
- **Contamination:** Treatment ve control grupları aynı lokasyonda ise (örneğin İstanbul'da iki ilçe) spillover oluyor. Geo boundaries net olmalı.
- **Seasonality noise:** Black Friday haftasında test açarsanız lift gerçek değerin 2x'i çıkabilir. Normal haftalar seçin.
- **Attribution window yanlış:** Meta Lift default 7-day click, 1-day view kullanıyor. Eğer satış döngünüz uzunsa (B2B, yüksek fiyat) 28-day window açın.

Kalibrasyon için şunu yapın: MMM'in tahmin ettiği kanal ROAS'ını lift testindeki gerçek ROAS ile karşılaştırın. Fark %20'den fazlaysa MMM'deki prior'ları (adstock, saturation) revize edin. Robyn'de `hyperparameter_bounds` argümanında adstock decay için [0.3, 0.8] yerine [0.4, 0.6] vererek arama alanını daraltabilirsiniz. Bu iterasyon 2-3 çeyrek sürüyor ama sonunda MMM ve incrementality uyumlu hale geliyor.

## 2026'da Nereye Gidiyor?

2026 sonu itibariyle incrementality testlerinin %40'ı Bayesian yöntemlere geçiyor. Klasik frekansist A/B test "p < 0.05" diye beklerken, Bayesian test erken durdurmaya izin veriyor — 10 gün sonra posterior probability %95'i geçerse testi durdurabilirsiniz. Meta zaten Bayesian Conversion Lift beta'sını açtı. Google GeoX'te henüz yok ama 2027'de bekleniyor.

MMM tarafında ise Robyn'e kausal inference (Pearl notation, DAG) entegrasyonu geliyor. Şu anda Robyn korelasyon tabanlı — iki kanal arasında confounding varsa (örneğin Meta ve Google aynı hafta artıyor çünkü ikisi de Black Friday'e hazırlanıyor) etkiyi ayırmakta zorlanıyor. Causal MMM (örneğin Econometric + Causal Impact hybrid) bu sorunu çözüyor. 2027'de production-ready olması bekleniyor.

Son bir nokta: incrementality + MMM stack'i sadece paid media için değil, retention ve lifecycle marketing için de kullanılmaya başlandı. Email kampanyalarının inkremental etkisini görmek için Braze + GeoX kombinasyonu deniyor. Push notification'ların lift'ini ölçmek için kullanıcı bazında holdout yapılıyor. Attribution artık sadece acquisition değil, full customer journey kapsıyor. 2026'da bu stack'e sahip olmayan ekipler körlemesine harcıyor — sahip olanlar ise her lirayı mühendislik disipliniyle optimize ediyor.