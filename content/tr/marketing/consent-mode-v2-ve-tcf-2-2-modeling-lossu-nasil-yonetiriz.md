---
title: "Consent Mode v2 ve TCF 2.2: Modeling Loss'u Nasıl Yönetiriz"
description: "GDPR uyumlu ölçüm ile signal kaybı arasındaki tradeoff'u gerçek senaryolarla anlatan teknik rehber. Consent modeling'in mühendislik gerçeği."
publishedAt: 2026-08-04
modifiedAt: 2026-08-04
category: marketing
i18nKey: marketing-006-2026-08
tags: [consent-mode, tcf, gdpr, attribution, signal-loss]
readingTime: 8
author: Roibase
---

Mart 2024'ten beri Avrupa trafiği taşıyan her marka Consent Mode v2 ile çalışıyor. TCF 2.2 standardı ise 2023 ortasından beri CMP'lerin altına yerleşti. İki yıl geçti — artık "uyum sağladık" demenin ötesinde "modeling loss'u nasıl minimize ediyoruz" sorusu masada. Çünkü GDPR uyumlu bir stack ile %100 signal elde etmek fiziksel olarak imkansız. Kullanıcıların %30-70'i (pazar ve verticale göre değişir) analitik ve reklam cookie'lerini reddettiğinde, platformların conversion modeling'i devreye giriyor. Bu yazı o modeling aşamasında kaybı nasıl sınırlandırabileceğinizi gösteriyor — tatmin edici jenerik cevaplarla değil, server-side altyapı ve signal kalitesi üzerinden.

## Consent Mode v2'nin Modeling Mantığı

Google Consent Mode'un v2 sürümü iki önemli değişiklik getirdi: `ad_user_data` ve `ad_personalization` parametreleri ayrıldı. Artık kullanıcı "analytics evet, remarketing hayır" diyebiliyor. Bu ayrışma Google Ads'e kısmi consent sinyali göndermeye izin veriyor — yani tüm pixel dark olmak yerine "bu kullanıcı ölçüme izin verdi ama reklam kişiselleştirmesine hayır dedi" şeklinde daha granüler bir durum paylaşılıyor.

Consent verilen kullanıcılar için ölçüm normal çalışır. Consent verilmeyen kullanıcılar için Google Ads **conversion modeling** yapar: benzer coğrafya, cihaz, tarayıcı, kampanya sinyaline sahip consent vermiş kullanıcıların conversion davranışını bu gruba **istatistiksel olarak yansıtır**. Bu modelleme %100 doğru değildir — tahmin kalitesi consent oranı, veri hacmi ve signal çeşitliliğine bağlıdır.

Modeling loss burada ortaya çıkar: Consent oranı %40 ise, Google kalan %60'ın davranışını **varsayar**. Bu varsayımın hata payı vardır. Özellikle düşük hacimli kampanyalarda (günlük <50 dönüşüm) model istatistiksel anlamlılık bulamaz ve **observed + modeled** ayrımındaki fark büyür. Google Ads arayüzünde "Modeled conversions" sütunu %15'in üzerindeyse modeling'e güven düşük demektir — bu kampanyaların bid optimizasyonu körelmektedir.

Consent Mode'un **basic** ve **advanced** modu vardır. Basic modda consent yoksa tag ateşlemez — hiç signal gitmez. Advanced modda tag ateşler ama cookieless ping gönderir. Advanced mod **daha fazla modeling input** sağlar çünkü sayfa görüntüleme, etkinlik tetiklemesi gibi sinyaller yine gider (kullanıcı ID'si olmadan). Google'ın önerisi advanced — ancak bu modu kullanırken CMP'nin IAB TCF 2.2 uyumlu olması ve ping'lerin anonimize edilmesi zorunludur. Aksi halde GDPR ihlali riski doğar.

## Server-Side GTM ile Signal Kaybını Sınırlamak

Client-side Google Tag Manager'da consent reddi demek genelde sıfır signal demektir. Server-side GTM ise farklı bir olanak sunar: tarayıcı cookie'leri olmadan bile bazı first-party sinyalleri server'a taşıyabilirsiniz. Consent Mode v2 + sGTM kombinasyonu şu akışı mümkün kılar:

1. Kullanıcı consent vermez.
2. Client-side GTM advanced mode ping atar (anonim).
3. Ping sGTM sunucusuna düşer.
4. sGTM bu ping'i **first-party data** ile zenginleştirir: IP-based city, user-agent, referrer, session start timestamp, landing page.
5. Bu zenginleşmiş ping Google Ads'e **Enhanced Conversions** veya **CAPI (Meta)** ile gönderilir.

Bu akışta kullanıcı kimliği (cookie ID, client ID) yok ama **hashed email** veya **telefon numarası** varsa bunlar gönderilebilir (kullanıcı formu doldurup consent vermişse). Google bu hash'i kendi database'inde eşleştirir ve conversion modeling'e ek input olarak kullanır. Meta CAPI için de aynı mantık geçerli — server-side event'ler client-side olanlardan %20-40 daha fazla match sağlayabiliyor (Facebook 2024 benchmark).

Ancak burada dikkat: sGTM'yi sadece consent sorununa çözüm olarak kurmak yetersizdir. Server-side altyapı **deduplication**, **event stitching** ve **data quality** sorunlarını da beraberinde getirir. Örneğin aynı dönüşüm hem client-side hem server-side gönderilirse duplicate conversion sayılır. Bu yüzden transaction_id alanını doğru kullanmalı, client-side ve server-side tag'leri birbirine bağlayan deduplication key'i tasarlamalısınız.

Bir örnek akış: E-commerce sitesinde kullanıcı sepete ürün ekliyor ama consent vermiyor. Client-side GTM sadece `page_view` (cookieless) gönderiyor. Kullanıcı checkout sayfasına gelip e-posta giriyor. Bu e-posta sGTM'ye gidiyor, hash ediliyor ve Google Ads Enhanced Conversions API'sine POST ediliyor. Google bu hash'i kendi veritabanındaki Google Account hash'leriyle eşleştirmeye çalışıyor. Eşleşirse conversion user'a atanıyor — modeling değil, **gerçek match**. Match oranı %50-70 arası (vertical'e göre). Gerisi yine modeling'e düşüyor ama input daha zengin olduğu için modeling hata payı düşüyor.

## TCF 2.2'nin Attribution Stack'e Etkisi

IAB Europe'un Transparency & Consent Framework 2.2 sürümü, CMP'lerin consent string'ini daha detaylı hale getirdi. TCF 2.2 string'i artık **vendor listesi**, **purpose listesi** ve **legitimate interest** bilgilerini ayrı ayrı tutuyor. Örneğin kullanıcı "Purpose 1: Personalized ads" için consent vermemiş ama "Purpose 7: Measurement" için vermiş olabilir. Bu durumda Google Ads conversion tracking çalışabilir ama remarketing liste oluşturamaz.

TCF 2.2 uyumlu bir CMP kullanmıyorsanız, Consent Mode v2 string'i eksik olur ve Google'ın consent sinyalini doğru yorumlaması mümkün olmaz. Örneğin OneTrust veya Cookiebot'un eski sürümlerinde TCF 2.0 vardı — 2.2'ye güncelleme yapılmadan önce consent string'inin format hatası Google Tag Manager'ın `gtag('consent', 'update', ...)` çağrısını bozabiliyordu. Bu durumda tag'ler ya hiç ateşlemiyor ya da tüm kullanıcıları "consent verdi" olarak sayıyordu — GDPR ihlali.

TCF 2.2'nin bir diğer etkisi **Prebid.js** gibi programmatic ad stack'lerinde. Prebid 8.0+ sürümü TCF 2.2 string'ini okuyup bid request'lere ekliyor. Eğer kullanıcı Purpose 2'ye (Select basic ads) consent vermemişse, Prebid bidder'lara user ID göndermeden anonim bid yapıyor. Bu da CPM'leri %30-50 düşürebiliyor (Index Exchange 2025 verisi). Consent oranı düşük olan publisherlar için bu doğrudan gelir kaybı demek — ancak GDPR'yi bypass etme riski almak da değmez. Çözüm: consent prompt'u **kullanıcı deneyimine entegre etmek** ve consent oranını artırmak. Örneğin "Reklamları kişiselleştirmek için izin ver, daha az ama alakalı reklam gör" gibi value proposition veren CMP tasarımları consent oranını %40'tan %60'a çıkarabiliyor (ConsentManager.net 2024 case study).

TCF 2.2 string'i aynı zamanda **Google Ad Manager** ile de entegre. GAM'de Limited Ads modu TCF string'ine göre açılıp kapanıyor. Eğer kullanıcı Purpose 1+2+3+4'e consent vermemişse, GAM limited ads gösteriyor (contextual targeting, anonim). Bu mod eCPM'yi düşürür ama compliance sağlar. Ancak bazı premium advertiserlar limited ads envanter almak istemiyor — bu da fill rate'i düşürüyor. Burada publisher'ın consent oranını maksimize etmesi kritik hale geliyor.

## Modeling Loss'u Ölçmek ve İzlemek

Consent modeling'in ne kadar loss yarattığını ölçmek için Google Ads'te **"All conversions"** ile **"Conversions"** metriklerini karşılaştırmalısınız. "All conversions" hem observed hem modeled içerir. "Conversions" sadece observed. Eğer `all_conversions / conversions` oranı 1.3'ün üzerindeyse modeling loss yüksek demektir — yani conversion'ların %30'u tahmin.

Bu oranı kampanya bazında izlemek önemli. Örneğin branded search kampanyalarında consent oranı genelde daha yüksektir (kullanıcı zaten ilgili, consent verme olasılığı fazla). Generic search'te ise consent oranı düşük, modeling loss yüksek olabilir. Bu durumda **bid stratejisi farklılaşır**: modeling loss yüksek kampanyalarda target ROAS stratejisi yerine maximize conversions kullanmak daha güvenli olabilir — çünkü ROAS hesabı modeled conversion'lara dayandığında yanlış optimize edilebilir.

Google Analytics 4'te de consent durumunu izlemek mümkünse de GA4'ün modeled conversion raporu yoktur. GA4 sadece consent vermiş kullanıcıları sayar. Bu yüzden **Google Ads ile GA4 arasında conversion mismatch** yaşarsınız. Örneğin Google Ads 100 conversion gösterirken GA4 70 gösterebilir. Bu normal — GA4 cookieless kullanıcıları saymıyor. Ancak bu mismatch'i izlemek yine de önemli: Eğer Google Ads'teki modeled conversion oranı artarken GA4'teki oran sabit kalıyorsa, bu modeling'in abartılı olduğunu gösterebilir.

Bir başka izleme yöntemi **BigQuery export**. Google Ads Data Transfer ile her gün conversion verilerini BigQuery'ye aktarabilirsiniz. Burada `ConversionAction.attribution_model_settings.data_driven_attribution_status` alanı "ELIGIBLE" ise data-driven attribution (DDA) çalışıyor demektir. DDA consent vermiş kullanıcıların yolculuğunu analiz eder ve modeled conversion'ları buna göre dağıtır. Ancak consent oranı %40'ın altına düşerse DDA "NOT_ELIGIBLE" olur ve last-click attribution'a geri döner. Bu durumda üst funnel kampanyaların attribution değeri düşer — CPA'ları yükselir gibi görünür, bütçe kesimi riskiyle karşılaşırsınız.

## Consent Oranını Artırmak için Mühendislik Yaklaşımı

Consent oranını artırmanın pazarlama taktiği değil, mühendislik problemi olduğunu kabul etmek gerekir. CMP prompt'unun tasarımı, yerleşimi, mesajı kadar **teknik performansı** da etkilidir. Örneğin CMP script'i 500ms yükleme gecikimi yarattığında, kullanıcılar sayfayı kapatmadan consent prompt'u görmeyebilir. Bu durumda consent default olarak "deny" sayılır.

Consent prompt'unu **viewport'a girmeden önce** yüklemek (critical CSS ile) consent oranını %10-15 artırabilir. Benzer şekilde prompt'un **mobil-öncelikli** tasarlanması önemli — masaüstünde %60 consent oranı olan bir prompt mobilde %30'a düşebilir çünkü kullanıcı "Reddet" butonuna yanlışlıkla dokunabilir veya prompt tüm ekranı kaplayıp scroll'u engelleyebilir.

Bir diğer teknik: **progressive consent**. İlk ziyarette kullanıcıya sadece "analytics" izni sor, remarketing iznini daha sonra (sepete ekleme veya kayıt formunda) iste. Bu iki aşamalı yaklaşım bazı vertical'lerde consent oranını %40'tan %55'e çıkarabilir (Usercentrics 2025 whitepaper). Ancak bu yaklaşım CMP'nin TCF 2.2 string'ini düzgün güncellemesini gerektirir — yoksa kullanıcı ikinci aşamada consent verdiğinde geçmiş eventlerin sinyali kaybolur.

Consent vermeyen kullanıcılara **value exchange** sunmak da etkilidir: "Reklamlara izin ver, premium içeriğe ücretsiz eriş" gibi. Ancak bu teklif GDPR'nin "freely given consent" ilkesini ihlal edebilir — çünkü kullanıcıya "izin vermezsen içerik yok" baskısı yapıyorsanız consent geçersiz sayılır. Burada ince çizgi var: "İzin verirsen ekstra özellik kazanırsın" yasaldır, "izin vermezsen hiçbir şey göremezsin" değildir.

Son olarak, [Dijital Pazarlama](https://www.roibase.com.tr/tr/dijitalpazarlama) altyapınızı consent mode'a entegre ederken **first-party data pipeline**'ınızı da güçlendirmelisiniz. Örneğin e-posta veya telefon numarasını topladığınız her noktada bu veriyi hash edip server-side tag'lere bağlamak, modeling loss'u azaltmanın en direkt yoludur. Bu sayede kullanıcı cookie vermese bile Enhanced Conversions veya CAPI üzerinden match edilebilir. Match rate yükseldikçe modeling oranı düşer — gerçek attribution artar.

## Consent Çağında Attribution Stratejisi

Consent Mode v2 ve TCF 2.2 dünyasında attribution artık deterministik değil, olasılıksal bir süreçtir. Bunu kabullenmek ve stratejinizi buna göre kurmak gerekir. Örneğin üst funnel kampanyaları (display, video) sadece last-click ROAS ile değerlendirmek artık mantıksızdır — çünkü consent vermeyen kullanıcıların çoğu üst funnel'da bulunur ve conversion'ları alt funnel'a modellenir. Bu durumda **incrementality test** yapmalısınız: belirli bir coğrafyada üst funnel kampanyayı kapatıp alt funnel conversion'larında düşüş olup olmadığını ölçmelisiniz. Düşüş varsa üst funnel etkilidir — modeled ROAS düşük olsa bile.

Bir diğer yaklaşım **media mix modeling (MMM)**. MMM makro düzeyde çalışır — consent mode verisine bağımlı değildir. Haftalık harcama ve gelir verisini regresyon modeline sokarsanız, her kanalın gerçek katkısını (ROAS değil, incremental revenue) bulabilirsiniz. Ancak MMM her hafta değil, ayda bir güncellenir ve küçük kampanyalar için hassasiyeti düşüktür. Bu yüzden MMM'yi micro-conversion izleme ile tamamlamak gerekir.

Consent kaybı ortamında **creative testing** daha kritik hale gelir. Çünkü signal azaldığında platformlar bid optimizasyonunda köreleşir — bu durumda yaratıcı performansı ön plana çıkar. Eğer creative A, creative B'den %30 daha yüksek CTR alıyorsa ve consent oranı %50 ise, platformun modeled conversion farkı yakalama gücü zayıftır. Bu yüzden creative test'leri kendi başına istatistiksel anlamlılıkla yapmalı, platform optimizasyonuna körü körüne güvenmemelisiniz. Bayesian A/B test framework'leri (örneğin VWO veya Optimizely) burada devreye girer — çünkü frequentist test %95 confidence için çok veri ister, consent düşük ortamlarda bu veriyi toplamak uzun sürer.

Son olarak, consent mode ortamında **first-party data stratejisi** pazarlama değil, ürün sorunudur. Kullanıcıları kayıt olmaya, e-posta vermeye, app indirmeye teşvik etmek — bu aksiyonlar pazarlama kampanyası değil, ürün deneyimi tasarımıdır. Örneğin misafir checkout yerine üye checkout'u tercih ettirirseniz, kullanıcının e-postası elde edilir ve consent olmadan bile Enhanced Conversions çalışır. Bu yüzden CMO ile CPO arasında alignment şart — consent loss'u sadece tag manager ile çözemezsiniz, ürün akışını da değiştirmeniz gerekir.

Consent Mode v2 ve TCF 2.2'nin getirdiği modeling loss kaçınılmazdır. Ancak bu loss'u minimize etmek mühendislik disiplini gerektirir: server-side altyapı, first-party data pipeline, CMP performansı, progressive consent tasarımı, incrementality testing. Bu alanlarda yatırım yapmayan markalar önümüzdeki iki yıl içinde attribution körelmesi yaşayacak — bid stratejileri yanlış optimize edilecek, üst funnel bütçeleri kesilecek, büyüme yavaşlayacak. Şimdi yapılması gereken, consent loss'u "yasal zorunluluk" olarak görmek değil, ölçüm mimarisini yeniden kurmak için bir fırsat olarak değerlendirmek.