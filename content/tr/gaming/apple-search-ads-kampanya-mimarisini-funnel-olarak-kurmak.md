---
title: "Apple Search Ads: Kampanya Mimarisini Funnel Olarak Kurmak"
description: "Discovery, competitor, brand, broad match — Apple Search Ads kampanya mimarisini funnel mantığıyla kurup bütçe akışını optimize etmek için mühendislik yaklaşımı."
publishedAt: 2026-07-29
modifiedAt: 2026-07-29
category: gaming
i18nKey: gaming-005-2026-07
tags: [apple-search-ads, asa-funnel, mobile-growth, app-campaigns, aso]
readingTime: 8
author: Roibase
---

Apple Search Ads'te tek bir kampanya tipi üzerinden hareket etmek, kullanıcı yolculuğunun farklı aşamalarını aynı bütçe havuzunda eritiyor. Discovery modundaki kullanıcı ile branded sorgu yapan kullanıcının maliyeti, niyeti, dönüşüm dinamikleri tamamen farklı. Kampanya mimarisini funnel olarak kurmak, her aşamaya ayrı bütçe disiplini getiriyor ve post-install metriklerini (D7 retention, LTV) kampanya tipine göre okuyabilme imkanı sağlıyor. Bu yazıda Apple Search Ads mimarisini discovery, competitor, brand ve broad match katmanlarına ayırıp bütçe akışını nasıl yöneteceğinizi gösteriyoruz.

## Discovery modundaki kullanıcı hangi soruyu soruyor

Discovery kampanyaları Search Ads'in otomatik genişleme mekanizması — Apple'ın algoritması uygulamanızı kategori, kullanıcı davranışı, semantic match üzerinden yüzlerce sorguya maruz bırakıyor. Bu modda kullanıcı spesifik bir uygulama aramıyor, "tower defense game" gibi geniş bir ihtiyaç taşıyor. Impression sayısı yüksek, TTR düşük, CPA nispeten ucuz ama D7 retention %15-20 bandında kalabilir. Discovery'nin işlevi brand awareness değil, potansiyel niyet taşıyan geniş havuzu test etmek.

Kampanya kurulumunda Search Match'i kapatıp tam kontrollü bir discovery havuzu oluşturamazsınız — Apple bunu default olarak açık tutuyor. Stratejiniz discovery trafiğini ayrı bir kampanyaya izole edip bidding stratejisini CPA hedefinden değil impression share hedefinden yönetmek olmalı. Discovery'de %60 impression share ile günde 500 install alıyorsanız ve D7 retention %18 ise bu havuzdan gelen kullanıcıları ilk 7 gün içinde push notification + in-app onboarding sekansıyla sıkılaştırmanız gerekir. Discovery trafiği funnel'ın en üstü — burada kullanıcı acquisition değil, hypothesis testing yapıyorsunuz.

Bütçe disiplini şu şekilde: discovery kampanyasına toplam ASA bütçenizin %25-30'unu ayırın, ancak CPA cap'ini brand kampanyasının 2 katına sabitle. Discovery'den gelen install başına maliyet branded trafikten 2x pahalı olabilir ama LTV düşük olduğu için bu fark kabul edilebilir değil — eğer discovery CPA'nız branded'ın 2.5 katına çıkıyorsa kampanyayı durdurmanız veya bid'i agresif düşürmeniz gerekir.

### Search Match keyword raporunu cohort analizi ile birleştirin

Discovery kampanyasındaki Search Match keyword listesini haftada bir export edin ve her keyword cluster'ının (örn. "strategy game", "idle game") D7 retention ve ARPU metriklerini MMP'nizde (Adjust, AppsFlyer) ayrı ayrı okuyun. Eğer bir cluster %25+ retention veriyorsa o keyword grubunu exact match kampanyasına taşıyın. Apple'ın sunduğu Search Term Report bunun için yeterli granularity sağlamıyor — custom event tracking ile keyword → install → D7 mapping'ini kendiniz yapmalısınız. Bu işlem manuel ama her ay 1-2 saatlik analiz, discovery bütçesinin %40'ını daha verimli kanallara kaydırabilir.

## Competitor kampanyalarında bidding davranışı ve legal risk

Competitor kampanyalarında rakip uygulamaların branded keyword'lerini (örn. "clash of clans", "candy crush") hedefliyorsunuz. Apple bu trafiğe izin veriyor ancak trademark ihlali riski taşıyan creative kullanımını engelliyor. Competitor trafiğin TTR'si %5-8 bandında — rakip arayışı yapan kullanıcı alternatif görünce %5-10 oranında tıklıyor. Burada strateji agresif bid değil, akıllı creative rotation — eğer creative'inizde rakip uygulamanın temel özelliğinin daha iyi versiyonunu vurguluyorsanız (örn. "daha hızlı progression", "no paywall") TTR %12'ye çıkabilir.

Competitor kampanyasını ayrı tutmanın nedeni LTV profilinin farklı olması. Competitor trafiğinden gelen kullanıcı genellikle mevcut oyundan churn etmiş veya alternatif arıyor — bu kullanıcının D30 retention'ı discovery trafiğinden %8-10 daha yüksek olabilir çünkü kategori ilgisi kesin. Ancak ilk 3 günde IAP conversion'ı düşük — kullanıcı karşılaştırma yapıyor. Bütçe allocation: toplam ASA bütçesinin %20-25'i, CPA cap branded kampanyanın 1.5 katı. Eğer competitor CPA branded'dan daha düşük çıkıyorsa rakibinizin brand equity'si sizden düşük demektir — bu durumda competitor bütçesini %35'e çıkarabilirsiniz.

Legal risk yönetimi: Apple trademark policy'sine göre başkasının trademark'ını keyword olarak kullanabilirsiniz ama creative'de marka adını geçiremezsiniz. Eğer rakibiniz Apple'a şikayet ederse kampanya suspend olabilir. Bu riski minimize etmek için competitor kampanyasını 10-15 uygulamalık keyword havuzuna yayın — tek bir rakibe odaklanmak suspend riskini artırır. Her rakip keyword için ayrı ad group açın ve haftada bir Search Term Report'u kontrol edip Apple'ın otomatik olarak eklediği broad match variant'ları negatif keyword'e ekleyin.

## Brand kampanyası: savunma mekanizması olarak CPA arbitrage

Brand kampanyanız kendi uygulama adınızı ve varyasyonlarını (örn. "roibase game", "roi base") hedefliyor. Bu trafikte organik listing zaten ilk sırada ama rakipler sizin branded keyword'ünüze bid verebilir — bu durumda sizin de kendi markanıza bid vermeniz gerekir yoksa rakip ilk sırada çıkar ve install'ınızı çalar. Brand kampanyasının TTR'si %25-40 bandında — kullanıcı sizi arıyor, tıklama kesin. CPA en düşük segment burası, genellikle discovery CPA'nın 1/3'ü kadar.

Bütçe allocation: brand kampanyasına toplam bütçenin %30-35'ini ayırın ancak burada hedef CPA minimize değil, impression share maksimize. Eğer branded keyword'ünüzde impression share %85'in altındaysa rakipleriniz sizin trafiğinizi kesiyordur. Bid'i artırıp %95+ impression share'e ulaşmalısınız. Brand kampanyasında CPA 0.50 dolar bile olsa bu kabul edilebilir çünkü bu kullanıcılar zaten sizi organik olarak bulacaktı — burada ödediğiniz para aslında rakibin sizi bloke etmesini engelleyen sigorta primi.

Brand kampanyasında Search Match'i kapatın. Apple'ın otomatik genişletmesi branded sorguları generic sorguya dönüştürüp CPA'yı artırır. Sadece exact match ve close variant kullanın. Ad group'u tek keyword üzerine kurun: uygulama adı. Diğer tüm generic keyword'leri discovery veya broad match kampanyasına taşıyın. Brand kampanyasının custom product page'i direkt onboarding flow'a odaklı olmalı — bu kullanıcı zaten sizi biliyor, size yaratıcı hikaye anlatmanıza gerek yok.

## Broad match kampanyası: kontrollü genişleme için sandbox

Broad match kampanyası discovery ile brand arasında bir katman — spesifik keyword'leri seçiyorsunuz ama Apple'ın bunları geniş eşleşmeyle (broad match) variant'larına genişletmesine izin veriyorsunuz. Örneğin "tower defense" keyword'ü "best tower defense", "tower defense offline", "td games" gibi varyasyonlara genişler. Bu modun avantajı kontrollü genişleme — discovery gibi tamamen otopilot değil, kendi keyword havuzunuzu belirleyip Apple'a "bunun etrafında ara" diyorsunuz.

Broad match kampanyasını discovery'den ayırmanın nedeni bütçe kontrolü. Discovery'de Apple her yere gidebilir, broad match'te siz sınırları çiziyorsunuz. Bütçe allocation: %15-20. Strateji şu: discovery'den ve competitor'dan iyi perform eden keyword'leri alıp broad match'e taşıyın, 2 hafta test edin. Eğer broad match CPA discovery'den %20+ daha düşükse o keyword'ü exact match'e taşıyın. Broad match bu anlamda bir "staging" katmanı — keyword'lerin tam kontrole geçmeden önce test edildiği alan.

Broad match'te negative keyword disiplini kritik. Apple'ın genişlettiği variant'lar arasında tamamen alakasız sorgular olabilir (örn. "tower defense" → "tower building game"). Haftada bir Search Term Report'u gözden geçirip CTR %1'in altındaki veya CPA hedefin 2 katını aşan keyword'leri negatif listesine ekleyin. Bu işlem manuel ama 15 dakikalık haftalık rutin broad match bütçesinin %30'unu kurtarabilir.

### Funnel akışını sıkılaştırmak için bid multiplier stratejisi

Apple Search Ads'te demographic targeting yok ama device ve location targeting var. Funnel mimarinizdeki her kampanya tipi için ayrı bid multiplier tablosu oluşturun. Örneğin discovery kampanyasında tier-2 geo'larda (Brezilya, Hindistan) bid'i %40 düşürün çünkü bu bölgelerden gelen kullanıcıların LTV'si tier-1'in yarısı. Brand kampanyasında ise tier-2'de bile bid'i tam tutun çünkü sizi arayan kullanıcı zaten kalifiye. Broad match'te iPad kullanıcılarına %20 daha yüksek bid verin — tablet kullanıcılarının session time'ı %35 daha uzun ve IAP conversion %18 daha yüksek (App Annie 2025 verisi).

Kampanya tiplerine göre dayparting uygulayın. Discovery ve broad match kampanyalarını 09:00-23:00 saatleri arasında aktif tutun, gece trafiğini kapatın. Brand kampanyasını 7/24 açık bırakın. Rakipler gece sizin branded keyword'ünüze bid veriyorsa siz de savunmada olmalısınız. [App Store Optimization](https://www.roibase.com.tr/tr/aso) ile metadata'nızı sıkılaştırıp organik ranking'inizi güçlendirirseniz branded kampanyanın maliyeti düşer — ASO burada savunma duvarı görevi görür.

## Bütçe akışını closed-loop attribution ile yönetmek

Funnel mimarisi kurduktan sonra her kampanya tipinin MMP'deki (Mobile Measurement Partner) post-install event'lerini ayrı ayrı okuyun. Discovery'den gelen kullanıcıların D7 retention'ı %18, competitor'dan %26, brand'dan %42 ise bütçe dağılımınız bu metriğe göre revize edilmeli. Basit bir model: toplam bütçenizi LTV/CPA oranına göre dağıtın. Eğer brand kampanyasının LTV/CPA oranı 4.2, discovery'ninki 1.8 ise brand'a 2.3x daha fazla bütçe ayırın.

Ancak LTV hesaplamasını 90 gün beklemeden tahmin edebilmek için D7 retention ve D1 ARPU'yu leading indicator olarak kullanın. Eğer bir kampanya tipinin D7 retention'ı %30'un üstündeyse LTV tahminini 3x yukarı revize edin. Bu hesaplamayı otomatikleştirmek için MMP'nizi BigQuery'ye bağlayıp günlük cohort analizi yapın. Python ile basit bir linear regression modeli 15 satır kod — D1 ve D7 metriklerinden D90 LTV'yi %82 accuracy ile tahmin edebilirsiniz (kendi test verilerimizde).

Kampanya tiplerine göre creative rotation disiplini: discovery ve broad match'te her 10 günde bir creative değiştirin, brand'da aynı creative'i 30 gün kullanın. Discovery'de kullanıcı sizi tanımıyor, creative test etmek mantıklı. Brand'da kullanıcı zaten karar vermiş, creative değişikliği TTR'yi sadece %2-3 etkiler. Competitor kampanyasında ise rakibin son kampanya mekaniğini benchmark alıp kendi creative'inizi ona göre güncelleyin — bu agile bir süreç, haftalık döngü gerektirir.

Apple Search Ads kampanya mimarisini funnel mantığıyla kurmak, her aşamayı izole edip optimize etme imkanı veriyor. Discovery modunda geniş havuzu tara, keyword performansına göre broad match ve exact match'e taşı, competitor trafiğini ayrı bütçe disipliniyle yönet, kendi markanı rakiplere kaptırma. Bütçe akışını post-install metriklerle (D7, LTV) kapatıp her kampanya tipinin ROI'sini gerçek zamanlı oku. Funnel mimarisi kurulmamış bir ASA hesabı, farklı niyet seviyelerindeki kullanıcıları aynı havuzda eriterek bütçeyi düşük LTV segmentlere dağıtır — bu makaledeki yapıyı uygulayarak o kaybı %30-40 azaltabilirsiniz.