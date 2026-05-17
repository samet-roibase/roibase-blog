---
title: "Apple Search Ads: Kampanya Mimarisini Funnel Olarak Kurmak"
description: "Discovery, competitor, brand ve broad match modunu bütçe akışı mantığıyla birleştirerek Apple Search Ads kampanya yapısını funnel mimarisine dönüştürme kılavuzu."
publishedAt: 2026-05-17
modifiedAt: 2026-05-17
category: gaming
i18nKey: gaming-005-2026-05
tags: [apple-search-ads, asa-kampanya-mimarisi, mobile-user-acquisition, aso-strateji, funnel-yapilandirma]
readingTime: 8
author: Roibase
---

Apple Search Ads'i tek kampanya tipiyle yönetmeye çalışmak, tüm kullanıcıları aynı fiyattan almaya çalışmak demek. 2026'da App Store'daki rekabet yoğunluğu bu yaklaşımı ekonomik olarak sürdürülemez hale getirdi. Competitive landscape'te discovery search ve exact brand match'in CPA'sı arasında 4-7x fark var. Bu farkı görmezden gelen kampanya mimarisi, D7 LTV/CAC oranını ilk hafta içinde kırar. Funnel yaklaşımı ise bütçeyi kullanıcı niyet seviyesine göre katmanlara ayırarak her aşamada doğru metrik hedefini optimize eder.

## Discovery Search: Bütçe Akışının Başlangıç Katmanı

Discovery kampanyaları Apple Search Ads'in broad match modunda çalışır ve kullanıcı henüz kategori seviyesinde arama yaparken görünürlük sağlar. "puzzle game", "strategy rpg" gibi generic sorgularda uygulama kategoriye yeterince güçlü sinyal verirse TTR (Tap-Through Rate) %3-5 bandına çıkar. Bu aşamada hedef conversion değil, kaliteli kullanıcı havuzu oluşturmak. Custom product page (CPP) creative testing bu katmanda kritik — aynı kampanya içinde 3 farklı CPP varyantını test edip IPM (Install Per Mille) verisini 2 hafta içinde toplamak gerek. Roibase'in [App Store Optimization](/tr/aso) çalışmaları bu noktada CPP creative stratejisiyle ASA kampanya mimarisini birleştirir.

Discovery kampanyalarında bid stratejisi max CPA değil, target impression share olmalı. Broad match'te impression volume düşük kalırsa kampanya öğrenemez. İlk 7 günde minimum 50K impression hedeflemek, Apple'ın makine öğrenmesi algoritmasının intent pattern'lerini yakalaması için gerekli. Bunun için initial bid'i kategori ortalama CPI'ın %150'sinden başlatıp 3 gün sonra %120'ye düşürmek standart yaklaşım. Budget pacing "accelerated" değil "standard" — ani trafik artışları D1 retention'ı %8-12 düşürüyor.

Discovery'de ölçüm metriği install değil, D1 retention ve initial session length. Bir kullanıcı generic keyword'den gelip ilk oturumda 4+ dakika geçiriyorsa, bu sinyal competitor veya brand aşamasında remarketing için flag'lenir. Apple'ın SKAdNetwork 4.0 conversion value yapısı bu tip granular segmentasyona izin veriyor — low, medium, high intent bucket'ları ilk 24 saatte oturum verisine göre ayrılabilir.

## Competitor Campaigns: Intent Hijacking ve Benchmark Arbitrajı

Competitor kampanyaları rakip oyun isimlerini exact ve broad match kombinasyonuyla hedefler. "clash of clans alternative", "candy crush benzeri" gibi modifier'lı aramalarda kullanıcı zaten active churn signal'i veriyor — mevcut oyundan tatminsiz, alternatif arıyor. Bu segment'in D7 retention'ı organik kullanıcıdan %15-22 daha düşük olabilir ama CPI'ı %40-60 daha ucuz. Arbitraj fırsatı bu gap'te: rakip oyundan churn etmiş kullanıcının LTV'si düşük ama acquisition maliyeti çok daha düşük olduğu için payback period 14-21 güne sıkışıyor.

Competitor kampanyalarında creative strateji agresif olmalı. CPP'de rakip oyunun core mechanic'ini direkt reference eden görseller TTR'ı %8-12'ye çıkarıyor. Ancak Apple'ın editorial review politikası spesifik trademark kullanımını engelliyor — "like [brand]" ifadesi yasak ama "for fans of match-3 games" gibi generic kategori referansı kabul ediliyor. Bu sınırda yaratıcı olmak gerek: rakip oyunun signature color palette'ini, UI pattern'ini, character silhouette'ini kullanarak implicit association yaratmak mümkün.

Competitor segment'inde bid stratejisi dinamik olmalı. Rakip oyun yeni update çıkarıp retention spike yaşadığında o keyword'ün CPI'ı %30-50 artıyor çünkü churn azalıyor. Bu durumda bid'i sabit tutup impression kaybetmek yerine, bid'i %20 artırıp volume'ü korumak daha mantıklı — çünkü rakip update'i 2-3 hafta sonra retention'ı normale döndürüyor ve o zaman tekrar bid düşürülebiliyor. Bu taktik için Apple Search Ads API'dan hourly bid adjustment automation kurmak gerekiyor.

### Competitor Segment Quality Control

Competitor trafiğinde fraud riski yüksek. Install farm'lar rakip keyword'lerde fake install üreterek kampanya budget'ını tüketiyor. Bunu engellemek için:

- İlk 48 saat içinde D0 retention %15'in altına düşen keyword'leri pause et
- Aynı ASA campaign içinde 3+ farklı competitor keyword'den gelen kullanıcıların device fingerprint pattern'ini kontrol et (fraud genelde aynı device farm'dan geliyor)
- SKAdNetwork conversion value'da "tier-3" bucket'a düşen kullanıcıların source keyword distribution'ını haftada 1 analiz et

## Brand Defense: Organic Kannibalizasyon ile CPI Arbitrajı

Brand kampanyaları kendi oyun adını exact match'te korumak için açılır. "Roibase Game", "roibase rpg" gibi aramalarda rakip oyunlar da bid veriyor ve organik impression'ı kanalize ediyorlar. Apple Search Ads'te brand keyword'de bid vermezsen bile organik olarak #1 çıkıyorsun ama impression share %60-70'te kalıyor — gerisi rakiplere gidiyor. Brand kampanya açıp düşük bid ($0.5-1.5) verdiğinde impression share %95+'ya çıkıyor ve CPI $0.2-0.8 seviyesine iniyor çünkü kullanıcı zaten oyunu arıyor, install intent yüksek.

Brand kampanyalarında optimize edilecek metrik CPI değil, organic kannibalizasyon oranı. Eğer brand kampanya açtıktan sonra organic install %20+ düşüyorsa, bu paid impression'ın organik trafiği çaldığı anlamına gelir. Bu durumda iki strateji var: ya brand bid'i %50 düşürüp impression share'i %80'e çekmek (organic'e biraz alan bırakmak), ya da bid'i agresif tutup CPI'ın düşük olmasından yararlanarak D1 retention cohort'unu büyütmek. İkinci yaklaşımda total install sayısı artıyor ve bu da App Store algoritmasına ranking sinyali gönderiyor — organik visibility yükseliyor ve 3-4 hafta sonra organic install hacmi toparlanıyor.

Brand segment'inde creative variation gereksiz. Kullanıcı zaten oyunu tanıyor, CPP A/B test yapmak TTR'ı %1-2'den fazla değiştirmiyor. Bunun yerine App Store screenshot set'ini seasonality'ye göre güncellemek daha etkili: Yılbaşı, Cadılar Bayramı gibi dönemlerde thematic screenshot set'i organic conversion rate'i %6-9 artırıyor.

## Broad Match Expansion: Volume ile Quality Arasında Trade-off

Broad match modu Apple Search Ads'in makine öğrenmesi algoritmasının keyword expansion yapmasına izin verir. Discovery kampanyasında başarılı olan keyword pattern'leri broad match'e alındığında algoritma benzer intent'li yeni sorguları otomatik keşfediyor. Ancak bu genişleme kontrolsüz bırakılırsa "free games", "best new apps" gibi ultra-generic keyword'lere kayıyor ve CPI 3-4x artıyor.

Broad match kampanyalarında negative keyword yönetimi kritik. Her 48 saatte search terms report'u indirip CTR %1'in altında kalan keyword'leri negative list'e eklemek gerek. Ancak negative keyword exact match değil phrase match olarak eklenirse intent pattern'inin tamamı bloke edilir — bu da potansiyel volume kaybına yol açar. Örneğin "free puzzle" keyword'ünü exact negative eklemek doğru ama "free" kelimesini phrase negative eklemek "free to play puzzle" gibi kaliteli sorguları da bloke eder.

Broad match'te bid optimize etmek için cohort-based CPA hedefi kullanmak gerek. İlk 3 gün CPA hedefini D7 LTV'nin %60'ı olarak set et, sonraki 4 gün %50'ye düşür. Bu şekilde algoritma initial learning phase'de yüksek volume yakalarken, optimization phase'de quality'ye focus ediyor. Apple Search Ads API'da custom rule engine ile bu bid adjustment'ı otomatize etmek mümkün — Python script'iyle 6 saatte bir API pull edip cohort retention datasına göre bid update etmek standart practice.

### Broad Match Budget Allocation

Broad match kampanyalarının budget share'i total ASA budget'ın %25-35'ini geçmemeli. Bunun nedeni volume'ün predictable olmaması: Apple algoritması trend'e göre yeni keyword'ler açıyor ve sudden spike yaratıyor. Budget cap olmadan broad match bir günde total daily budget'ın %70'ini tüketebilir. Budget pacing için campaign-level daily cap + portfolio-level budget management kombinasyonu kullanmak gerekiyor.

## Funnel Arkitektürü: Budget Waterfall ve Remarketing Signal

Dört kampanya tipini funnel olarak bağlamak için budget waterfall stratejisi kurmak gerek: Discovery → Competitor → Broad → Brand sıralamasıyla priority set et. Discovery kampanyası ilk kullanıcı havuzunu toplar, bu havuzdan D1 retention %40+ olan kullanıcılar competitor ve broad kampanyalarına signal olarak gider (SKAdNetwork postback ile), brand kampanyası ise sadece remarketing amacıyla son aşamada devreye girer.

Apple Search Ads'in Custom Audience feature'ı bu noktada devreye giriyor: Discovery kampanyasından install edip ilk oturumda 5+ level tamamlayan kullanıcıları audience segment olarak export et, sonra bu segment'i competitor kampanyasında bid modifier olarak kullan (+%30-50 bid). Bu kullanıcılar competitor keyword'lerde tekrar arama yaparsa daha yüksek bid ile yakalanır — çünkü initial signal kaliteyi doğrulamış.

Funnel mimarisini ölçmek için blended CPA metriği yerine marginal CPA kullanmak gerek. Her kampanya tipinin incremental katkısını hesapla: Brand kampanyasını 1 hafta kapat, organic install değişimini ölç, net fark brand kampanyasının incremental contribution'ı. Aynısını competitor, broad, discovery için de yap. Bu test 4 hafta sürer ama sonucunda her kampanya tipinin gerçek ROI'sını görürsün — bazı kampanyalar negative incremental gösteriyorsa (organic'i kanalize ediyorsa) budget'ını kes.

Funnel mimarisinin son aşaması [Premium Yayıncı Programı](/tr/premiumyayinci) ile entegrasyon. Apple Search Ads'ten gelen kullanıcılar D30 retention %25+ gösteriyorsa, bu cohort'u premium yayıncı network'ünde lookalike expansion için kullan. ASA trafiği kaliteli seed audience oluşturur, premium network ise bu profile benzer kullanıcıları programmatic olarak bulur. İki kanal arasında 14 günlük lag ile correlation analizi yapınca ASA quality signal'inin programmatic campaign performance'ını %18-25 artırdığını görüyoruz.

Apple Search Ads kampanya mimarisini funnel olarak kurmak, her intent seviyesine uygun maliyet ve metrik hedefi tanımlamak demek. Discovery bütçenin %20'si, broad %25'i, competitor %30'u, brand %15'i, kalan %10'u test budget olarak allocation yapıldığında blended CPA optimize edilirken volume da korunuyor. 2026'da App Store'da görünür olmak install almaktan daha zor — funnel mimarisi bu görünürlüğü ekonomik olarak sürdürülebilir kılan yapısal çözüm.