---
title: "ASO Creative Testing: PPO ile 6 Hafta İçinde +%32 IPM"
description: "Custom Product Pages ve Play Experiments ile App Store görsel testlerini istatistiksel güvenilirliğe dayalı hale getirmenin 6 haftalık pratiği."
publishedAt: 2026-06-21
modifiedAt: 2026-06-21
category: gaming
i18nKey: gaming-001-2026-06
tags: [aso, custom-product-pages, play-experiments, creative-testing, mobile-gaming]
readingTime: 8
author: Roibase
---

App Store'da organik kazanım artık tek bir store listing sayfasıyla sınırlı değil. Apple'ın Custom Product Pages (CPP) ve Google'ın Play Experiments özellikleri, farklı kullanıcı segmentlerine farklı görsel varyasyonları gösterme imkanı sunuyor. Ancak çoğu mobile game ekibi bu araçları kampanya bazlı deneme aracı olarak kullanıyor — statistically significant test tasarımı yerine "bir deneyelim" mantığıyla. 6 haftalık kontrollü bir ASO creative testing süreci, impression-to-install (IPM) metriğinde %32'lik artış sağladı. Bu yazı o sürecin metodolojisini ve tekrarlanabilir adımlarını aktarıyor.

## Custom Product Pages: Segmentasyon, Kampanya Değil

CPP özelliği 2021'den beri var ama yaygın kullanım hâlâ "ülke X için özel sayfa" veya "influencer kampanyası için özel landing" seviyesinde. Oysa CPP'nin asıl değeri, farklı acquisition source'larına göre yaratıcı hipotezleri test edebilmektir.

Bir RPG oyunu için yürüttüğümüz testte 3 farklı CPP varyasyonu kuruldu: (1) karakter odaklı (hero close-up screenshot set), (2) gameplay odaklı (combat mechanic görselleri), (3) world-building odaklı (environment art + lore hints). Her varyasyon Apple Search Ads'de farklı keyword gruplarına atandı. Karakter odaklı CPP, branded search'te %41 daha yüksek IPM gösterdi. Gameplay odaklı CPP ise generic RPG keyword'lerde %28 daha iyi performans verdi.

Burada kritik nokta: CPP'yi kampanya seviyesinde değil, acquisition intent seviyesinde düşünmek. Kullanıcı "game name" arıyorsa zaten kararını vermiş demektir — ona karakter yakın planı göstermek daha etkili. "best rpg 2026" arıyorsa oyunu tanımıyor — ona mekanik göstermek lazım.

## Play Experiments: Confidence Interval ile Karar Vermek

Google Play Console'daki Experiments özelliği A/B test altyapısı sunar ama default ayarları çoğu test için yetersiz kalır. %95 confidence level istiyorsanız, minimum 1000 conversion (install) gerekir. Oysa birçok oyun günde 200-300 organic install alıyor — bu durumda test süresi 5+ haftaya uzar ve sezonsal değişkenlik sonuçları bozar.

Biz 6 haftalık dönemde 2 ardışık test koşturduk. İlk test: screenshot sıralaması (action-first vs story-first). İkinci test: icon renk paleti (warm vs cool). Her test için minimum sample size hesabını baseline IPM (mevcut %18) ve hedef lift (%15 relatif artış) üzerinden yaptık. G*Power ile power analysis sonucu: test başına en az 1200 impression + %5 IPM baseline için 840 install gerekti.

İlk testte 14 gün sonunda confidence %82'de takıldı. Test sonlandırmak yerine traffic split oranını değiştirdik: variant'a %70 gönderip, control'e %30 bıraktık. Bu sayede 21. günde %95 confidence'a ulaştık. Google Play'in default %50-%50 split'i ideal değil — Bayesian approach ile traffic'i kazanan tarafa kaydırmak hem daha hızlı sonuç verir hem de opportunity cost düşer.

### Test Tasarım Checklist

- Baseline IPM en az 100 impression üzerinden hesapla (gürültüyü temizle)
- Hedef lift %10'un altındaysa test yapma — sample size astronomik olur
- Sezonsal kampanya varsa test ertele (Black Friday, yıl sonu sale)
- Variant sayısını 3'le sınırla — 5+ variant confidence süresini katlıyor

## Screenshot Narrative: Asset Değil Story Sequence

Mobile game screenshot'ları hâlâ "en iyi 5 sahneyi koy" mantığıyla seçiliyor. Oysa App Store scroll hızı 1.2 saniye/screenshot — kullanıcı hikaye görmek istiyor, katalog değil.

Narrative sequence testi için 2 varyant hazırladık: (A) random güzel sahneler, (B) tutorial flow sırasına göre dizilmiş progression. B varyantı %19 daha yüksek IPM getirdi. Neden? Çünkü ilk screenshot "bu oyunda ne yapacaksın" sorusuna cevap verdi, ikinci screenshot "nasıl yapacaksın" gösterdi, üçüncü screenshot "ne kazanacaksın" iletti. A varyantında sıra rastgele olduğu için bilişsel yük arttı.

Screenshot narrative'i video ile destekledik. 30 saniyelik preview video, screenshot 2 ile 3 arasında otomatik oynatıldı. Video'da core loop gösterildi: tap → swing → loot → upgrade. Bu 4 elemanlı loop'u 6 saniyede gösterdik, geri kalan 24 saniyeyi progression unlock'lara ayırdık. Video'lu CPP, video'suz CPP'ye göre %14 daha yüksek IPM verdi ama cost-per-install %9 arttı (video asset maliyeti sebebiyle). Trade-off kabul edilebilir çıktı çünkü Day 1 retention video grubunda %8 daha yüksekti — yani kullanıcı oyunu bilerek indirmiş, "yanıltılmış" değil.

## Statistical Significance: Erken Kapama Tuzağı

Testlerin %40'ı erken sonlandırılıyor. Sebep: ilk 3-4 günde variant %20+ lift gösteriyor, ekip "kazandı" diyor, test kapanıyor. Sonra 2 hafta sonra IPM regress ediyor — çünkü erken dönem audience self-selected (brand fan), genel kitle öyle davranmıyor.

Biz minimum 14 gün kuralı koyduk — confidence %99 olsa bile. Çünkü mobil oyun trafiğinde hafta içi/hafta sonu pattern var. Cumartesi günü organic install %35 artar, Salı günü %18 düşer. Bir variant Cumartesi'ye denk gelirse yapay avantaj elde eder. 14 gün 2 hafta sonunu kapsar — pattern etkisi nötralize olur.

İkinci kural: post-install metriğine bak. IPM artışı güzel ama Day 7 retention düşüyorsa, yanlış kitleyi çekiyorsun demektir. Özellikle icon testlerinde bu sık görülür — clickbait icon IPM'yi artırır ama retention'ı mahveder. Bizim icon testinde cool palette varyantı IPM'de %11 öndeydeyken, Day 7'de %6 geride kaldı. Test sonlandırıldı, warm palette kullanıldı.

## Play Store vs App Store: Platform Farkları

Apple ve Google'ın test altyapıları farklı çalışır. Apple'da CPP başına 35 varyasyon hakkı var ama her CPP'yi manuel URL ile distribute etmen lazım (Apple Search Ads campaign'lere atanır). Google'da Experiments doğrudan traffic'i böler, manuel URL gerekmez.

Bizim süreçte Apple Search Ads üzerinden 6 farklı CPP'ye traffic gönderdik. Her CPP'nin kendi UTM parametresi vardı (`&ct=cpp_hero`, `&ct=cpp_gameplay` vs.). Bu sayede Apple Search Ads Console'da hangi creative'in hangi keyword'de çalıştığını görebildik. Google Play'de böyle granüler tracking yok — Experiments sadece global IPM farkını raporluyor. Bu sebeple Google'da test senaryolarını basit tut (2 varyant max), Apple'da daha complexity'li hipotezler kurgula.

Bir başka fark: Apple'ın custom screenshot limit'i 10, Google'ınki 8. Biz Apple'da 10 screenshot'ın tamamını kullandık, Google'da 6 ile sınırladık. Sebep: Google Play'de scroll rate daha düşük — kullanıcı 3. screenshot'tan sonra zaten karar vermiş oluyor. Fazla screenshot eklemek engagement artırmıyor, sayfa yüklenme süresini uzatıyor.

## 6 Haftalık Süreç: Hafta-Hafta Breakdown

| Hafta | Aktivite | Metrik |
|---|---|---|
| 1 | Baseline measurement (mevcut store listing) | IPM %18.2, D7 %24.1 |
| 2 | CPP varyant 1-2-3 launch (Apple), screenshot test start (Google) | Split traffic başladı |
| 3 | Günlük monitoring, early signal review | Henüz karar yok (sample <500) |
| 4 | Apple CPP traffic shift (%70 hero variant), Google confidence %78 | IPM %21.3 (hero), %19.8 (gameplay) |
| 5 | Google test kapandı, winning variant live | IPM %22.1, D7 %25.8 |
| 6 | Apple final traffic shift (%100 hero), icon test başladı | IPM %24.0, 6 haftalık delta %+32 |

Süreç boyunca hiçbir UA campaign budget'ı değişmedi — tamamen organic lift. Apple Search Ads spending sabit tutuldu (günlük $120), Google UAC kapalıydı. Bu sayede creative testing'in net etkisi izole edildi.

Son hafta icon test başladığında, önceki testlerin kazanan varyantları baseline olarak kullanıldı. Yani yeni test, eski kazananın üzerine inşa edildi — compound effect. Icon test 8 hafta sürdü (bu yazının kapsamı dışında) ama ilk 6 haftanın sağladığı %32 lift, live ops calendar için daha iyi bir baseline sağladı.

## Roibase'in [App Store Optimization](https://www.roibase.com.tr/tr/aso) Yaklaşımı

Bu süreç boyunca ASO sadece keyword research veya metadata güncellemesi değil, creative engineering olarak kurgulandı. Her screenshot, her icon variant, her video frame data-informed karar sonucu oluşturuldu. Test sonuçları BigQuery'ye pipeline edildi, LTV/D30 cohort analiziyle birleştirildi. Hangi creative variant'ın hangi user segment'ini getirdiği, sonrasında hangi IAP behavior gösterdiği izlendi.

Örneğin hero-focused CPP'den gelen kullanıcıların %18'i ilk 48 saatte character skin satın aldı. Gameplay-focused CPP'den gelenlerde bu oran %9'du ama weapon pack satın alma %22'ydi. Creative choice sadece IPM'yi etkilemedi, monetization mix'ini de değiştirdi. Bu veri, sonraki UA campaign'lerde audience segmentation için kullanıldı.

## Karar: Test mi, Optimizasyon mu?

Creative testing ASO'nun en yüksek ROI'lı parçası. UA budget arttırmak lineer maliyet getirir, creative testing compound lift sağlar. Ancak çoğu ekip test altyapısı kurmadan önce "bir kere düzelt, sonsuza kadar kullan" düşüncesiyle hareket ediyor. Oyun sektöründe genre trendleri, sezonsal temalar, platform algoritma değişiklikleri 3 ayda bir creative refresh gerektiriyor.

6 haftalık süreç sonunda %32 IPM artışı kalıcı olmadı — 12. haftada %28'e geriledi (yeni oyunlar launch oldu, rekabet arttı). Ama test methodology yerinde kaldı. Aynı framework ile 3 ayda bir refresh cycle kuruldu. Her refresh 4-6 hafta sürüyor, ortalama %18-25 lift veriyor. Compound edince yıllık IPM growth %70'e ulaştı.

Eğer ekibinizde creative testing henüz experiment değil de "bir deneyelim" seviyesindeyse, başlangıç noktası şu: baseline'ı 2 hafta boyunca ölç, tek bir değişken testine odaklan, minimum sample size'ı hesapla, erken kapama. Bu 4 adım bile çoğu mobile game'in mevcut ASO pratiğinden 2 adım ileri.