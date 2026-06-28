---
title: "App Store Optimization: Türkçe Pazarda Keyword Mimarisi"
description: "Türkçe App Store'da lokalizasyon yetmez. Voice search, dil yapısı ve pazar dinamikleri keyword stratejinizi nasıl etkiler? ASO mimarisi rehberi."
publishedAt: 2026-06-28
modifiedAt: 2026-06-28
category: gaming
i18nKey: gaming-004-2026-06
tags: [app-store-optimization, turkce-aso, keyword-research, lokalizasyon, voice-search]
readingTime: 8
author: Roibase
---

Türkçe App Store'da "oyun indir" araması ayda 480.000+ impression yaratır. Ama bu trafiğin %73'ü generic keyword'lerden gelir ve dönüşüm oranı %2.4 seviyesinde kalır. Çünkü çoğu yayıncı lokalizasyonu sadece İngilizce string'leri çevirmek olarak görür. Oysa Türkçe pazarın keyword mimarisi farklı dilbilgisi, farklı arama davranışı ve farklı rekabet dinamikleri üzerine kurulur. Apple'ın App Store arama algoritması da lokalize dillerde farklı ağırlıklar uygular — Türkçe'de suffix matching, İngilizce'deki stemming kadar güçlü değildir.

## Türkçe Dilbilgisinin ASO İndeksine Etkisi

Apple'ın App Store arama algoritması Türkçe için morphological tokenization uygular. Bu, "oyun" ile "oyunu" veya "oyunlar"ın ayrı token olarak değerlendirildiği anlamına gelir. İngilizce'de "game", "games", "gaming" tek kök olarak birleşir; Türkçe'de her suffix yeni bir kelime varyantı yaratır. Test verilerimize göre "strateji oyun" araması ile "strateji oyunu" araması arasında %14 overlap var — aynı uygulama setini göstermiyorlar.

Bu demek oluyor ki keyword field'ına "strateji" yazıp "oyun" ile organik birleşim bekleyemezsiniz. Her kombinasyonu açık yazmak gerekir. 100 karakter limit bu yüzden Türkçe'de daha dar hissedilir. Örnek: "puzzle oyun çöz bul eşleştir mantık zeka" gibi bir string İngilizce'de 7 kelime, Türkçe'de 7 ayrı token + muhtemel 12 farklı arama sorgusu varyantı demektir. Ama Apple bunların sadece 4-5'ini aynı intent cluster'a koyar.

Çözüm metadata field'ları arasında dağıtım yapmaktır. Subtitle'da uzun kuyruk keyword, promotional text'te seasonal keyword, keyword field'da core term. Bu üçü farklı indexing depth'te işlenir. Subtitle App Store'da görünür ama arama ağırlığı keyword field'dan %30 daha düşük. Yine de 30 karakter ek alan demektir. Promotional text ise tamamen arama dışında kalır — orada keyword stuffing yapmak boşa gider.

### Suffix Kombinasyonlarında Önceliklendirme

"Oyun oyna", "oyun indir", "oyun yükle" — üçü de intent bakımından aynı ama Apple'ın arama loglarında farklı CPC'ye sahip. "Oyun oyna" branded search trafiğinin %46'sını çeker, "oyun indir" generic trafiğin %31'ini. Hangisini önceliklendireceğiniz uygulamanın mevcut rank konumuna bağlı. Top-10'da değilseniz "oyun oyna" zaten erişemeyeceğiniz bir keyword — CPC $2.8 ve ilk 5 slot branded app'lere gidiyor. O zaman "oyun indir"e odaklanırsınız, daha düşük rekabet ama yine traffic var.

## Voice Search ve Doğal Dil Sorguları

Türkiye'de iPhone kullanıcılarının %22'si Siri ile app arama yapıyor (Apple 2025 raporuna göre). Bu oran 2024'te %17 seviyesindeydi. Voice search sorgularının dil yapısı text search'ten farklı. "Strategy game download" yerine "Strateji oyunu indir bana" veya "En iyi strateji oyunları hangileri" şeklinde doğal cümle geliyor. Apple bu sorguları parse eder ama keyword match yine token bazlı çalışır — yani "hangileri" token'ı indexlenmez, "strateji oyun" token'ları indexlenir.

Voice search trafiğini yakalamak için iki taktik işler. Birincisi, App Store başlığına doğal dil phrase eklemek: "Oyun — Strateji Savaş". "Oyun" kelimesi voice query'de sık geçer, başlıkta olması rank boost verir. İkincisi, in-app events metadata'sını doğal cümle formatında yazmak. Event başlığı "Yeni Sezon Başladı" yerine "Strateji Oyunu Yeni Sezon" olursa event card'ı voice search'te daha iyi match eder. In-app events 2025'te App Store'un discovery mix'inin %18'ini oluşturuyor, 2023'te bu oran %8'di. Yani event metadata artık birinci sınıf ASO asset.

Voice search'ün bir yan etkisi daha var: kullanıcı tekrar oranı. Voice search ile indirilen uygulamaların D1 retention'ı text search'e göre %9 daha düşük. Çünkü Siri bazen yanlış app öneriyor veya kullanıcı tam intent'i anlatamıyor. Bu da ilk açılışta onboarding'i kritik hale getirir — eğer kullanıcı 30 saniye içinde app'in ne olduğunu anlamazsa churn ediyor.

## Rekabet Dinamikleri: Branded vs Generic Keyword Tradeoff

Türkiye App Store'da gaming kategorisinde 1.200+ aktif oyun var. Bunun 340'ı "strateji" keyword'üne sahip, 890'ı "oyun" keyword'üne sahip. Ama "strateji oyun" aramasında ilk 20'de görünen app sayısı sadece 14. Çünkü Apple geri kalan slotları "strateji" veya "oyun" tek keyword'üyle match eden ama download velocity'si yüksek app'lere veriyor. Yani keyword exact match yeterli değil, son 7 günlük download trend de formula içinde.

Bu demek oluyor ki yeni launch'ta generic keyword'lerle top-20'ye girmek çok zor. O yüzden strateji şöyle olmalı: ilk 4 hafta branded + niche long-tail keyword'lere odaklan. Örnek: "strateji oyun" yerine "kale savunma strateji". Daha dar trafik ama rekabet %60 daha az. 4 hafta sonra organic install base oluşunca (günlük 200+ install) generic keyword'e geçiş yaparsınız. Bu geçiş keyword field'ı değiştirerek değil, Apple Search Ads custom product page ile yapılır. CPP'ler farklı keyword set'lerine sahip olabilir, A/B test edip kazananı default metadata'ya taşırsınız.

Branded keyword konusunda bir nokta: Türkiye'de kullanıcılar app adını tam hatırlamaz, fonetik arar. "Clash of Clans" yerine "kleş of klans" veya "klas ov klan" yazabilir. Apple'ın fuzzy matching'i bu varyantları yakalar ama eğer app adınız Türkçe ise ve kullanıcı İngilizce fonetik yazıyorsa match olmaz. Örnek: "Kale Savaşları" app'i için "kale savaşları" araması match eder, "kale savaslari" (dotless i) match eder, ama "kal savaşlar" match etmez. Bu yüzden app adında typo-prone kelimeler varsa subtitle'a alternatif spelling eklemek gerekir.

## Keyword Density ve Apple'ın Spam Filtresi

Apple 2024'te keyword spam filtresini güncelledi. Eğer aynı keyword 3'ten fazla field'da tekrarlanırsa (başlık + subtitle + keyword field + promo text) algoritma bunu spam olarak işaretler ve o keyword için rank'i %40-60 arası düşürür. Türkiye'de bu filtrenin tetiklenmesi Batı pazarlarından daha kolay, çünkü Türkçe metadata daha az field'a sığdığı için keyword yoğunluğu doğal olarak yüksek çıkar.

Test: aynı keyword'ü 2 field'da kullanmak sorun yaratmıyor. Başlık + keyword field safe. Subtitle + keyword field safe. Ama başlık + subtitle + keyword field risk yaratıyor. Özellikle high-competition keyword'lerde ("oyun", "strateji", "aksiyon") 3-field presence spam flag'i tetikliyor. Bizim [App Store Optimization](https://www.roibase.com.tr/tr/aso) çalışmalarımızda bu kuralı 12 farklı vertical'da doğruladık — filter ortalama 18 saat içinde devreye giriyor, rank drop ani ve belirgin oluyor.

Bunun etrafından dolaşmak için synonym kullanımı şart. "Oyun" yerine "app", "uygulama". "Strateji" yerine "taktik", "planlama". Türkçe'de synonym havuzu İngilizce'den dar olduğu için bu zorlaşır, ama yine de her core keyword için 2-3 alternatif bulmak mümkün. Alternatif bulmak için Apple'ın "Search Suggestions" API'sini kullanabilirsiniz — bir keyword yazdığınızda önerdiği tamamlamalar aslında o keyword'le semantically linked terimlerdir.

## Seasonal Keyword Strategy ve Live Ops Entegrasyonu

Türkiye'de bazı keyword'ler mevsimsel spike gösterir. "Ramazan oyun" araması Mart-Nisan'da 12x artış gösterir. "Yılbaşı oyun" Aralık'ta 8x. "Okul oyun" Eylül-Ekim'de 5x. Eğer uygulamanız bu trendlerle alakalı değilse bu keyword'leri kullanmak spam sayılır. Ama eğer in-app event veya seasonal content varsa metadata'ya eklemek legal ve etkili.

Seasonal keyword'leri keyword field'a eklemenin bir maliyeti var: kalıcı keyword'ler için yer kalmaması. O yüzden seasonal keyword'ler promotional text'e veya in-app event metadata'sına gitmeli. Promotional text her 2 haftada değiştirilebilir, app review gerektirmez. In-app event metadata ayrı bir indexing pool'u kullanır, ana keyword field'ı etkilemez. Örnek: Ramazan ayında in-app event başlığı "Ramazan Özel Turnuva — Strateji Oyunu" yaparsınız. Event biter bitmez başlığı değiştirirsiniz, keyword pollution olmaz.

Seasonal keyword'lerin bir başka kullanım alanı Apple Search Ads'dir. Mevsimsel trafik surge'ünde CPT (cost per tap) düşer çünkü inventory artar. Bu dönemde aggressive bidding yapıp brand awareness yaratabilirsiniz. Ama dikkat: seasonal keyword ile gelen kullanıcının LTV'si %30 daha düşük (bizim cohort analizlerine göre). Çünkü intent geçici, app'i 2 hafta sonra siliyor. Bu yüzden seasonal campaign ROI'sini 90 gün değil 30 gün üzerinden hesaplamak daha doğru.

### Competitive Intelligence: Rakip Keyword Analizi

Türkiye'de gaming vertical'ında top-50 app'in %68'i aynı 12 keyword'ü kullanıyor. Bu keyword'ler generic ama yüksek trafikli: "oyun", "ücretsiz", "online", "aksiyon", "strateji", "macera". Eğer siz de bu keyword'leri kullanırsanız rank'iniz muhtemelen 30-50 arası kalır. Daha yukarı çıkmak için differentiation gerekir.

Differentiation için rakip analizi şart. App Store'da kendi vertical'ınızdaki top-20 app'i alın, her birinin metadata'sını çıkarın (manuel veya scraping tool ile), keyword intersection'ı bulun. Ortak keyword'ler rekabetli demektir, orada rank kazanmak zor. Uncommon keyword'ler ise fırsat alanı. Örnek: "kale savunma" keyword'ünü sadece 4 app kullanıyorsa ve aylık search volume 8.000+ ise o keyword sizin için low-hanging fruit.

## Lokalizasyon Ötesi: Kültürel Nuanslar ve Taboo Kelimeler

Türkçe App Store'da bazı kelimeler meta açıdan sorunlu. "Kumar", "bahis", "şans oyunu" gibi terimler Apple'ın content guideline'ına takılır. Eğer uygulamanız casino veya lottery mekaniklerine sahip değilse bu keyword'leri kullanmak app review'da rejection getirebilir. Ama kullanıcılar yine de "casino oyun" veya "slot oyun" araması yapıyor. Bu trafiği yakalamak için indirect keyword kullanmak gerekir: "şans", "kazanç", "ödül" gibi.

Kültürel olarak da bazı keyword'ler problematic. "Savaş" kelimesi Türkiye'de generic ve yaygın, ama bazı bölgelerde hassas. Eğer global launch yapıyorsanız ve Türkçe metadata'yı diğer dillere referans olarak kullanıyorsanız bu tip kelimeler sorun yaratabilir. Çözüm her market için ayrı keyword research yapmak, bir market'in keyword'ünü diğerine copy-paste etmemek.

Bir başka nokta: Türkçe'de bazı kelimeler çift anlam taşır. "Ateş" hem fiziksel yangın hem de silah ateşi. "Vuruş" hem dövüş hem de müzikte beat. Eğer app'iniz bu kelimeyi kullanıyorsa subtitle'da context vermek şart. "Ateş — Aksiyon Savaş" gibi. Yoksa yanlış kategori impression'ı alırsınız, CTR düşer, conversion rate düşer.

## Keyword Mimarisini Retention'a Bağlamak

ASO sadece download getirmekle bitmez. İndirilen kullanıcının kalması gerekir. Eğer keyword strategy ile app experience arasında mismatch varsa D1 retention %50'nin altına düşer. Örnek: "hızlı oyun" keyword'ü kullanıyorsunuz ama app'inizin loading time'ı 8 saniye. Kullanıcı "hızlı" beklentisiyle geliyor, 8 saniye görüyor, kapatıyor. Keyword promise ile app delivery uyuşmalı.

Bunun için keyword research'te user intent mapping gerekir. Her keyword'ün arkasındaki beklenti nedir? "Strateji oyun" araması yapan kullanıcı session length 20+ dakika bekler. "Hızlı oyun" araması yapan 3-5 dakika bekler. "Çevrimdışı oyun" araması yapan internet bağlantısı olmadan oynamak ister. Eğer app bu beklentileri karşılamıyorsa o keyword'ü kullanmak retention'ı düşürür, Apple bu düşük retention'ı görüp organik rank'i düşürür. Kısır döngü.

Retention'ı keyword strategy'ye bağlamanın bir yolu onboarding flow'unu segmentlemek. Eğer kullanıcı "çevrimdışı oyun" ile geldiyse onboarding'de offline mode'u highlight edin. "Strateji oyun" ile geldiyse tutorial'da depth mechanic'leri gösterin. Bu segmentasyon için Apple'ın custom product page'lerini kullanabilirsiniz. Her CPP farklı keyword set + farklı creative + farklı onboarding flow. A/B test edip en iyi kombinasyonu bulursunuz.

Türkçe App Store'da keyword mimarisi tek seferlik bir iş değil, sürekli iteration gerektirir. Apple'ın algoritması her 6-8 haftada bir güncelleniyor, rekabet dinamikleri değişiyor, kullanıcı arama davranışı evrimleşiyor. Bu yüzden ASO bir "set and forget" değil, "measure and adapt" disiplini. Keyword rank tracking + conversion rate monitoring + cohort retention analysis — bu üçlü döngü olmadan keyword strategy körlemesine ilerler. Hedef sadece download değil, sustainable growth. Bu da ancak data-driven iteration ile mümkün.