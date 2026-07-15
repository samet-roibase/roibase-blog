---
title: "Apple Search Ads: Kampanya Mimarisini Funnel Olarak Kurmak"
description: "Discovery, competitor, brand ve broad match kampanyalarını funnel mimarisine göre kurup bütçe akışını optimize etmek için yapısal rehber."
publishedAt: 2026-07-15
modifiedAt: 2026-07-15
category: gaming
i18nKey: gaming-005-2026-07
tags: [apple-search-ads, aso, mobile-growth, funnel-architecture, campaign-structure]
readingTime: 8
author: Roibase
---

Apple Search Ads'i ayrı ayrı kampanya tipleri olarak yönetmek yerine birbirine bağlı bir funnel mimarisi olarak kurmak, performans oyununun kurallarını değiştirir. Discovery, competitor, brand ve broad match modları tek başına düşünüldüğünde bütçe dağılımı keyfi kalır — ama bunları funnel katmanları olarak organize ettiğinizde her kampanya tipi bir üstüne sinyal besler, bir altından nitelik alır. 2026 ortası itibariyle mobil oyun büyütme ekiplerinin çoğu hâlâ kampanyaları izole yönetiyor ve bu yüzden CPT'lerinde %30-40 verimlilik kaybediyor. Bu yazı kampanya mimarisini funnel logic ile nasıl kuracağınızı, bütçe akışını hangi sinyallere göre yönlendireceğinizi ve ASO ile entegrasyonun neden kritik olduğunu anlatıyor.

## Funnel Mantığı: Her Kampanya Tipi Farklı Katmanda Durur

Apple Search Ads'de dört temel kampanya tipi var: discovery (Search tab), competitor (rakip marka sorguları), brand (kendi marka sorguları) ve broad match (geniş kategori terimleri). Bunları birbirinden kopuk görmek yerine şöyle düşünün: discovery en üstte, bilinirliği olmayan kullanıcıyı yakalıyor. Broad match ortada, intent sinyali var ama rekabet yüksek. Competitor daha dar, rakibin markasını arayan nitelikli kullanıcı. Brand en altta, zaten sizi biliyor. Bu hiyerarşiyi tersine çevirirseniz bütçe dağılımı bozulur — mesela brand kampanyaya %60 atarsanız satış yaparsınız ama kullanıcı havuzunu büyütmezsiniz. Tam tersi, discovery'ye %70 verirseniz CPT düşük ama retention çöker çünkü soğuk trafik dönüşüm hunisini yormadan içeri giriyor.

Funnel mantığında her katman bir öncekine sinyal gönderir. Discovery'den gelen kullanıcı retention D7'de %12'nin üstüne çıkıyorsa onun segment profilini broad match'e negative keyword listesi olarak yazarsınız — böylece broad daha dar hedefler. Competitor kampanyada IPM (install per mille) %8'in altındaysa o rakibin kullanıcı profili sizinkiyle örtüşmüyor demektir, kampanyayı durdurun. Brand kampanya CPA'sı aniden %40 artarsa bu ASO rank'inizin düştüğünü gösterir, sorun kampanya değil metadata — önce [App Store Optimization](https://www.roibase.com.tr/tr/aso) düzeltilmeli. Kampanyaları izole yönetince bu sinyaller kaybolur.

Bütçe akışını da aynı mantıkla kurarsınız. Discovery başlangıçta %40-50 alır çünkü kullanıcı havuzunu dolduruyor. 3-4 hafta sonra retention profili oturduğunda broad match'e %30 verip discovery'yi %30'a çekersiniz. Brand her zaman %15-20'de sabit kalır çünkü markayı zaten bilenler ucuz gelir ama hacmi sınırlıdır. Competitor opsiyoneldir — tier-1 pazarda (ABD, UK) %10-15 ayırabilirsiniz, emerging market'te (LATAM, SEA) gereksizdir çünkü marka bilinci düşük.

## Discovery Kampanya: Soğuk Trafik Deneyinin Laboratuvarı

Discovery kampanyalar Search tab'de çıkar. Kullanıcı oyun açar, alt bölümde "Bunları da beğenebilirsin" önerileri gelir. Intent sinyali zayıf — kullanıcı sizin oyunun kategorisini bile aramıyor olabilir. O yüzden burada hedef install hacmi değil, kullanıcı segmenti profili çıkarmaktır. Discovery'yi A/B test arenası olarak kullanırsınız: 4-5 farklı creative set koyun (custom product page ile), her birini 1 hafta 5000 impression'a maruz bırakın, IPM + D1 retention cross-check yapın. IPM %4'ün altı doğrudan reddedilir. IPM %6-8 arasıysa ama D1 retention %35'in altındaysa creative yanıltıcı — kapanış sahnesini değiştirin.

Discovery'nin bütçe mantığı şudur: ilk 2 haftada agresif harcayın (%50 toplam bütçe), veriler oturmaya başladığında %30'a çekin. Ama hiç kesmeyin çünkü soğuk trafik testini durdurunca broad match ve competitor için segment girdisi üretemezsiniz. 2026'da Apple Search Ads'in makine öğrenmesi 72 saat içinde stabilize oluyor, yani 3 gün sonra CPA'nız platoya ulaşır. Eğer 5. günde hâlâ volatilite varsa hedefleme çok geniş demektir — yaş/cinsiyet/coğrafya filtresi ekleyin.

Discovery'de keyword kullanmazsınız, Apple otomatik eşleşir. Ama negative keyword listesi koyabilirsiniz — özellikle rakip oyun türlerine ait terimleri (örn. sizinki match-3 ise "battle royale" negative yapın). Bir tuzak: Apple kategori bazlı öneri de yapar. Eğer oyununuz "Casual" kategorisinde yayınlanmışsa ama asıl mekanizması "Puzzle"a yakınsa, metadata'da kategoriyi yanlış seçmişsiniz demektir. Bu durumda kampanya değil ASO metadata düzeltilir — kategori değişimi + subtitle optimizasyonu. Discovery kampanya performansı düşükse ilk yapılacak ASO audit'tir, bütçe artışı değil.

## Competitor ve Broad Match: Nitelik Filtresi ve Bütçe Dinamikleri

Competitor kampanyalar sadece tier-1 pazarda mantıklıdır. Türkiye, Brezilya, Endonezya gibi pazarlarda marka bilinci düşük olduğu için kullanıcı rakip isim aramaz, genel kategori terimi arar. ABD'de "Candy Crush" diye arayan 1 milyon kullanıcı var, Türkiye'de 50 bin — bu yüzden competitor kampanyaya bütçe ayırmak Türkiye'de ROI negatif çıkar. Eğer tier-1'desiniz, competitor kampanyayı dar tutun: sadece doğrudan rekabette olduğunuz 3-5 oyunu hedefleyin. Her keyword için TTR (tap-through rate) minimum %5 olmalı, altında kalırsa creative'iniz rakibin kullanıcısını çekemiyor demektir — icon + screenshot set değiştirin.

Competitor kampanyada bid stratejisi agresiftir: maksimum CPA'nızın %120'sine kadar çıkabilirsiniz çünkü rakibin kullanıcısı niteliklidir, sizinle benzer oyun oynamış demektir. Ama 2 hafta sonra LTV/D30 ölçün — eğer rakipten gelen kullanıcı retention'da %15 düşükse bu segment sizin oyun mekaniğinizle uyuşmuyor, kampanyayı kapatın. Yaygın hata: rakip büyükse onun kullanıcısı da bizde çalışır demek. Hayır — "PUBG Mobile" kullanıcısı "Among Us" kullanıcısından tamamen farklıdır, aynı "battle royale" kategorisinde olsalar bile.

Broad match kampanyalar kategori terimleri içindir: "puzzle game", "strategy rpg", "idle game". Burada keyword exact/broad kontrol edilebilir. Başlangıçta broad açın, 1 hafta sonra search terms raporunu indirin, alakasız terimleri negative yapın. Örnek: sizin oyununuz "merge" mekaniğine dayanıyor, ama broad match "match-3" sorgularını da getiriyorsa "match-3" negative ekleyin. Broad match'in bütçesi %25-35 arasında olmalı — daha fazla verirseniz discovery'den gelen segment verisini kullanmadan dağıtmış olursunuz, daha azsa yeterli hacim yakalayamazsınız.

## Brand Kampanya: Savunma ve ASO Sağlık Göstergesi

Brand kampanya kendi oyun adınızı hedefler. "Ama zaten birinci sıradayız, para vermeye gerek var mı?" sorusu yanlış sorudur. Apple organik sıralamada birinci olsanız bile Search Ads'de rakipler sizin markanızı hedefleyebilir — yani "Sizin Oyun" diye aratıldığında rakip çıkar. Brand kampanya o trafik sizde kalsın diye korunur. Ayrıca CPA en düşük burada çıkar (genelde discovery'nin 1/5'i), bu yüzden bütçenin %15-20'sini koymanın ROI'si pozitiftir.

Brand kampanyanın ikinci işlevi ASO sağlık göstergesi olmasıdır. Eğer brand CPA'nız aniden artıyorsa (örn. 2 haftada %30 yükseldi), bu organik rank'inizin düştüğü anlamına gelir. Çünkü organik sıralama düşünce daha az görünürlük olur, kullanıcı Search Ads'deki brand kampanyanızı daha fazla tıklar, Apple daha fazla ücret keser. Bu durumda sorunu kampanya optimizasyonu ile çözemezsiniz — ASO metadata (keyword density, subtitle, IAP naming) ve rating/review yönetimi ile düzeltirsiniz. Brand kampanyayı "erken uyarı sistemi" olarak kullanırsınız.

Brand keyword'e bid agresif olmalı: maksimum CPA'nızın %150'si. Çünkü rakip de sizin markanızı hedefliyorsa bid savaşı olur, kaybederseniz trafik kaybolur. Bazı ekipler "zaten organik geleceğim" diyerek brand kampanyaya düşük bid verir — bu strateji sadece rekabet yoksa işler. Tier-1 pazarda rekabet her zaman vardır, bu yüzden brand kampanya passif değil aktif savunmadır.

## Bütçe Akışı Senaryosu: 4 Haftalık Pilot

Diyelim 30 gün boyunca $15000 bütçeniz var, yeni bir idle RPG oyunu launch ediyorsunuz, ABD pazarı. İlk hafta: discovery %50 ($1875), broad %25 ($937), brand %20 ($750), competitor %5 ($187). Competitor düşük çünkü henüz segment profili yok. İlk 7 gün discovery'den 2500 install gelir, bunun D1 retention'ını ölçersiniz — %32 çıktı. D7 ölçmek için 1 hafta bekliyorsunuz.

14. günde D7 retention %18 geldi (idle RPG için kabul edilebilir). Discovery'den gelen kullanıcıların %60'ı 25-34 yaş erkek, %30'u 18-24 kadın. Bu profili broad match kampanyaya yaş/cinsiyet filtresi olarak eklersiniz. Bütçeyi şu şekilde revize edersiniz: discovery %35, broad %35, brand %20, competitor %10. Çünkü artık segment profili var, broad match daha nitelikli çalışacak.

21. günde competitor kampanyadan 150 install geldi, ama D1 retention %22 — discovery'den %10 düşük. Bu segment oyununuzla uyuşmuyor. Competitor'ı kapatırsınız, %10'luk bütçeyi broad match'e eklersiniz. Son hafta: discovery %30, broad %45, brand %25. Bu dağılım artık sabit kalır çünkü funnel dengeye oturmuştur. 30 günün sonunda toplam 7200 install, blended CPA $2.08, D30 retention %9.5 — tier-1 idle RPG için iyi bir baseline.

## Ölçüm ve İterasyon: Hangi Sinyallere Bakarsınız

Kampanya mimarisini kurduktan sonra ölçüm 3 katmanda yapılır: kampanya seviyesi (CPA, IPM, TTR), funnel seviyesi (D1/D7/D30 retention), ekonomik seviye (LTV/CAC). Her kampanya tipinin kendi kriterleri var. Discovery için IPM ve D1 retention yeterli, LTV beklemezsiniz çünkü soğuk trafik. Broad match için D7 retention kritik — %15'in altı kabul edilemez. Competitor için TTR öncelikli — %5'in altıysa creative zayıf. Brand için CPA artışı ASO alarm verir.

Haftalık iterasyon döngüsü şöyle olur: Pazartesi sabah kampanya metriklerini çek (Apple Search Ads Console), retention verilerini MMP'den al (Adjust, AppsFlyer), LTV projeksiyonunu BI dashboard'dan oku. Cuma gününe kadar şu kararları ver: hangi creative set kapatılacak, hangi keyword negative olacak, hangi kampanya bütçesi artacak. İki haftada bir daha büyük strateji değişikliği yaparsınız: funnel bütçe dağılımı, yeni pazar testi, ASO metadata güncellemesi.

Bir tuzak: Apple Search Ads makine öğrenmesi sizi sürekli "bütçe artır" diye uyarır. Bu uyarıyı her gördüğünüzde artırmayın. Önce mevcut bütçenin tamamını harcıyor musunuz kontrol edin — %80'in altındaysa zaten yeterli impression alamıyorsunuz demektir, sorun hedefleme. %95'in üstündeyse ve CPA hedef dahilindeyse artırın, ama maksimum %20 — ani artışlar makine öğrenmesini bozar.

## ASO ile Entegrasyon: Kampanya Metadata'yı Besler

Apple Search Ads kampanyaları ASO'dan bağımsız yönetilemez. Çünkü kampanyanın gösterdiği metadata (icon, screenshot, subtitle, promotional text) doğrudan App Store sayfanızdan gelir. Eğer discovery kampanyada IPM düşükse ama competitor'da yüksekse bu icon'unuzun generic göründüğü anlamına gelir — çünkü rakip markası aratanlar zaten intent yüksek, icon çekici olmasa da tıklar. Ama soğuk trafik (discovery) icon'a bakar, ilgi çekmezse scroll eder.

Custom product pages (CPP) buraya girer. Apple artık her kampanyaya farklı CPP atayabilmenize izin veriyor. Discovery için daha bold, animasyonlu screenshot set kullanırsınız. Brand için daha minimal, logo-forward tasarım. Competitor için rakiple karşılaştırma yapan screenshot (mümkünse guidelines dahilinde). Bu ayrımı yapmadan tek metadata ile tüm kampanyaları koşarsanız conversion huni optimize edilemez. [App Store Optimization](https://www.roibase.com.tr/tr/aso) sürecinde CPP stratejisini kampanya mimarisi ile paralel kurmalısınız.

ASO metadata her 4-6 haftada bir revize edilir — keyword density Apple'ın algoritması değiştikçe güncellenir, rating/review yönetimi churn sinyallerini önler, IAP naming'de fiyat testi yapılır. Bu değişiklikler doğrudan kampanya performansını etkiler. Örneğin subtitle'da "merge" kelimesini "build" ile değiştirdiniz, 1 hafta sonra broad match kampanyada "build game" sorgusu artmaya başlar — o keyword'ü manuel eklemelisiniz. ASO ve Search Ads aynı ekip tarafından, aynı sprint döngüsünde yönetilmelidir.

## Sonuç: Mimari Tek Seferlik Kurulum Değil, Dinamik Sistem

Kampanya mimarisini funnel olarak kurmak bir defada bitmez. İlk 30 gün pilot, sonraki 60 gün stabilizasyon, ondan sonra sürekli iterasyondur. Bütçe akışı her ay %10-15 değişir çünkü oyunun live ops takvimi (event, season, IAP sale) kampanya dinamiklerini etkiler. Discovery agresif olduğunuzda broad match 2 hafta sonra performansı artırır, çünkü kullanıcı havuzu dolmuştur. Brand kampanya CPA'sı yükseldiğinde ASO düzeltilir, kampanya bütçesi artırılmaz.

Bu yapıyı kurmadan önce sorulması gereken sorular: segment profili net mi, retention baseline'ınız var mı, ASO metadata test edilebilir durumda mı, MMP entegrasyonu sağlıklı mı. Bu dört bileşen yoksa kampanya mimarisi hayal kırıklığı yaratır. Varsa funnel mantığı ile bütçe verimliliğiniz ilk 90 günde %30-40 artar, çünkü her kampanya tipi doğru katmanda, doğru sinyalle çalışıyor demektir. Şimdi mevcut kampanya dağılımınıza bakın — funnel olarak kurulu değilse bu ay başlatacağınız pilot senaryo yukarıdaki 4 haftalık modeli takip etmeli.