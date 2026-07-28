---
title: "iOS 17 Sonrası Ad Attribution Stack'i"
description: "ATT, SKAdNetwork 4 ve modeled conversions ile mobil performance marketing'in yeni mimarisi. Post-lookback maturity döneminde ölçüm nasıl kurulur?"
publishedAt: 2026-07-28
modifiedAt: 2026-07-28
category: marketing
i18nKey: marketing-003-2026-07
tags: [ios-attribution, skadnetwork, att, mobile-performance, modeled-conversions]
readingTime: 7
author: Roibase
---

iOS 14.5'ten bu yana üç yıl geçti. ATT (App Tracking Transparency) artık "yeni gelişme" değil — olgunlaşmış bir gerçeklik. 2026 ortasında performans ekiplerinin çoğu hâlâ eski attribution stack'ine özlem duyuyor ama geri dönüş yok. iOS 17 ile birlikte SKAdNetwork 4.0 fully adopted, Meta ve Google modeled conversions'ı production-grade stability'ye getirdi, TikTok kendi probabilistic pipeline'ını açtı. Sorun artık "veri yok mu" değil — "hangi sinyale güveniyoruz ve bu sinyaller nasıl birleşiyor" sorusu.

Bu yazıda iOS 17 sonrası mobil ad attribution'ın teknik katmanlarını, SKAdNetwork 4.0'ın gerçek kullanım sınırlarını, modeled conversions'ın içini ve bu üç veri akışını birleştiren post-lookback mimarisini açıyoruz. Amaç: 2026'da iOS kullanıcısına reklam gösterirken hangi sinyale ne kadar ağırlık vereceğini bilmek.

## ATT Sonrası Sinyal Katmanları

iOS 17 ortamında üç farklı sinyal tipi var: deterministic (SKAdNetwork), probabilistic (modeled conversions) ve first-party (server-side events). Her biri farklı latency, granularity ve güven seviyesinde.

SKAdNetwork 4.0 coarse-grained conversion value (0-63 arası) veriyor ama 24-48 saat gecikmeyle. Timer'lar üç aşamalı: ilk 0-2 gün, sonra 3-7 gün, son olarak 8-35 gün. Kampanya optimizasyonu için ilk iki pencere kritik çünkü bid adjustment'lar gerçek zamanlıya yakın olmalı. Ancak SKAd verisi aggregated — user-level breakout yok, sadece campaign ID bazında volume gelir.

Modeled conversions ise platform'un (Meta, Google, TikTok) kendi machine learning modeliyle tahmin ettiği dönüşümler. iOS kullanıcısı ATT'yi reddettiğinde deterministik sinyal yok ama platform user behavior pattern'ini (engagement rate, past install cohorts, device type) kullanarak olasılıksal bir estimate veriyor. Meta 2024'te %30 modeled, %70 observed karışımıyla başladı; 2026'da bazı kampanyalarda oran %50-50'ye kadar çıkabiliyor. Google UAC (Universal App Campaigns) benzer mekanizma ama conversion window daha kısa tutuyor (7 gün).

First-party server-side event stream ise uygulama içi activity'yi doğrudan MMP (Mobile Measurement Partner) veya CDP'ye göndermek demek. Bu sinyal user-level ama attribution yok — hangi ad'den geldiğini bilmiyorsun, sadece cohort behavior tracking için kullanılır. Örneğin D7 retention'ı ölçmek mümkün ama bunu hangi kampanyaya atfetmek sıkıntılı.

## SKAdNetwork 4.0'ın Gerçek Sınırları

SKAdNetwork 4.0 birçokiyileştirme getirdi: hierarchical source identifier (4-tier campaign structure), multiple conversion windows, web-to-app attribution desteği. Ancak production'da iki büyük engel var: postback delay ve conversion value encoding karmaşıklığı.

Postback delay ortalama 24-72 saat. İlk pencere (0-2 gün) için timer biraz daha hızlı ama yine de real-time optimization imkansız. Bid strategy'ler genellikle T-2 verisine bakarak çalışıyor, yani iki gün önceki cohort'un performansına göre bugünkü bid'i ayarlıyorsun. Bu da trend değişikliklerine geç tepki demek.

Conversion value schema tasarlamak ise ayrı bir mühendislik problemi. 0-63 arası integer'a revenue, event type, user quality gibi çok boyutlu veriyi sıkıştırmak gerekiyor. En yaygın pattern: ilk 32 değer event-based (install, registration, first purchase), son 32 değer revenue bucket'larına map edilir. Ancak bu encoding brand'e özel olmalı — generic schema çalışmaz. Örneğin gaming uygulaması için D1 retention critical ise 0-15 aralığı retention signal'ine, 16-31 IAP event'lerine, 32-63 LTV bucket'larına ayrılabilir.

SKAdNetwork crowd anonymity threshold da production'da sorun çıkarabiliyor. Apple, privacy korumak için çok düşük volume'lü campaign combination'ları suppress ediyor. Yani test kampanyasında günlük 50 install varsa SKAd postback gelmeyebilir. Bu da yeni campaign test etmeyi zorlaştırır — ya volume'ü hızlıca scale etmen ya da daha geniş targeting kullanman gerekir.

## Modeled Conversions Nasıl Çalışır

Meta'nın modeled conversions sistemi statistical attribution model üzerinde çalışır. Kullanıcı ATT opt-out yaptığında Meta IDFA alamıyor ama şu sinyalleri kullanabiliyor: ad engagement (impression, click), device type, network quality, kampanya targeting overlap. Bu feature'lar bir Bayesian regression model'ine giriyor ve "bu kullanıcı dönüşüm yaptı mı" sorusuna olasılıksal cevap veriyor.

Model'in confidence interval'ı genellikle %80-95 arasında — yani her tahmin %5-20 hata payıyla geliyor. Meta Ads Manager'da "Estimated conversions" etiketi altında gösterilir. Campaign budget optimization (CBO) bu modeled signal'i de kullanıyor ama ağırlığı observed conversions'dan daha düşük tutuyor.

Google UAC ise conversion modeling'i daha agresif kullanıyor. Android tarafında Google Play Instant ile deterministic sinyal alınabiliyor ama iOS tarafında tamamen model-based. Google'ın avantajı: Firebase Analytics entegrasyonu varsa in-app event stream'i daha zengin, bu da model accuracy'sini artırıyor. Ancak yine de lookback window kısıtlı — Google 7 günlük pencerede modelleme yapıyor, Meta 28 güne kadar çıkabiliyor.

TikTok 2025 sonunda kendi probabilistic attribution pipeline'ını beta'dan çıkardı. TikTok Pixel + SKAdNetwork hybrid yaklaşımı kullanıyor. Kullanıcı TikTok içinde uzun süre kalıyorsa (yüksek engagement) ve sonra app store link'ine tıklıyorsa bu pattern modele güçlü sinyal olarak giriyor. TikTok'un dezavantajı: ağı Meta/Google kadar geniş değil, bu yüzden cross-platform behavior pattern'i eksik kalabiliyor.

## Post-Lookback Maturity Mimarisi

Post-lookback maturity döneminde (yani SKAdNetwork postback'leri tamamlandıktan sonra) gerçek performans değerlendirmesi yapılır. Burada üç veri akışını birleştirmek gerekiyor: SKAdNetwork observed, platform modeled ve MMP first-party.

Mimari şöyle çalışır: SKAdNetwork postback'leri MMP'ye düşer (Adjust, AppsFlyer, Kochava), aynı anda platform modeled conversions API'den çekilir, first-party in-app events ise CDP veya data warehouse'a (BigQuery, Snowflake) akar. Bu üç stream'i birleştirmek için ortak key: campaign ID + install cohort date.

Birleştirme logic'inde şu sorular çözülmeli: Modeled conversion ile SKAd postback overlap ediyor mu? Aynı install'ı iki kez mi sayıyorsun? Deduplication için MMP'ler genellikle SKAd'i ground truth kabul eder, modeled conversion'ı SKAd volume'ünün üstüne ek tahmin olarak ekler. Örneğin SKAd 100 install, Meta modeled 40 install diyorsa toplam 140 değil — 100 confirmed + 40 probabilistic olarak raporlanır.

LTV (Lifetime Value) hesabı ise tamamen first-party stream'den gelir. SKAdNetwork LTV vermiyor, modeled conversions da revenue'yu tahmin etmiyor. Bu yüzden cohort-based LTV analysis için MMP veya CDP'deki raw event stream şart. Tipik akış: install cohort'unu SKAd'den al, o cohort'un D7/D30/D90 revenue'sini first-party'den hesapla, sonra campaign-level ROAS hesabında SKAd install count × cohort LTV kullan.

Bu mimariyi kurmak için [Performans Pazarlaması (PPC)](https://www.roibase.com.tr/tr/ppc) stack'inde data pipeline engineering gerekiyor. Sadece dashboard değil — ETL (Extract, Transform, Load) süreci, deduplication logic ve model confidence threshold ayarları kritik.

## Incrementality ve Holdout Test Yapısı

Modeled conversions güven problemi yaratır: gerçekten bu kullanıcı dönüştü mü yoksa model mi uydurdu? Bu soruyu cevaplamak için incrementality measurement şart. En clean yöntem: geo-based holdout test.

Geo-holdout test şöyle çalışır: belirli coğrafyalarda (eyalet, şehir, DMA bazında) kampanyayı kapat, o bölgedeki organic install rate ile kampanya açık bölgelerdeki rate'i karşılaştır. Fark = incremental lift. Ancak iOS attribution'da geo test yapmak zor çünkü SKAdNetwork geo breakdown vermiyor. Bu yüzden test MMP tarafında kurulmalı — install IP'sinden geo inference yapılır ama %100 accurate değil.

Alternatif: time-based holdout. Haftanın belirli günlerinde kampanyayı durdur, o günlerdeki install volume düşüşünü ölç. Bu yöntem basit ama seasonality bias yaratabilir (örneğin Pazar günü zaten organic install yüksekse kampanya etkisi underestimate edilir).

Meta kendi Conversion Lift test tool'unu sunuyor. Kullanıcıları test/control grubuna ayırıyor, test grubuna ad gösteriyor, control grubuna göstermiyor (PSA veya charity ad gösterir). Sonra her iki gruptaki dönüşüm oranını karşılaştırıyor. Bu test SKAdNetwork'ten bağımsız çalışıyor çünkü Meta kendi user graph'ını kullanıyor. Ancak minimum 200K impression gerekiyor, yani küçük kampanyalar için mümkün değil.

Incrementality test sonuçları modeled conversions'ın confidence interval'ını kalibre etmek için kullanılabilir. Örneğin lift test %60 incremental gösteriyorsa ama modeled conversions %80 dönüşüm iddia ediyorsa model overestimate ediyor demektir — o zaman model weight'ini düşür.

## Kampanya Optimizasyonunda Hangi Sinyale Güvenmeli

2026 ortasında kampanya optimization için hybrid sinyal yaklaşımı şart. Sadece SKAdNetwork'e güvenmek gecikme yaratır, sadece modeled conversions'a güvenmek güven kaybı yaratır.

Önerilen strateji: ilk 48 saat modeled conversions ağırlıklı optimizasyon yap (çünkü SKAd gecikiyor), sonra SKAd postback geldiğinde modeli recalibrate et. Örneğin Meta CBO kampanyasında ilk iki gün modeled signal'e göre ad set'ler arası budget shift edilir, 3. günden itibaren SKAd verisi gelince observed conversions oranı artar.

Bid strategy için: ROAS-based bidding yerine tROAS (target ROAS) + volume cap hybrid kullan. iOS kullanıcısında deterministik ROAS hesaplamak zor olduğu için sabit bir tROAS target belirle (örneğin 3.0), ama aynı anda günlük install volume floor koy (minimum 500 install/gün gibi). Bu sayede hem karlılık hem de scale korunur.

Creative testing de sinyal problem yaratır. A/B test için yeterli volume olmayabilir (SKAd crowd anonymity threshold yüzünden). Bu durumda sequential test yap: önce creative A'yı 3 gün çalıştır, sonra B'yi 3 gün çalıştır, SKAd postback'leri geldiğinde karşılaştır. Bu yöntem tam clean değil (external factor bias var) ama iOS kısıtları altında en pragmatik seçenek.

## Kapanış

iOS 17 sonrası attribution stack deterministik değil — probabilistic, delayed ve multi-layered. SKAdNetwork 4.0 temel sinyal verir ama latency var, modeled conversions hız kazandırır ama güven sorunu yaratır, first-party stream LTV hesabı sağlar ama attribution yapmaz. Üç akışı birleştirmek ve her birinin güven aralığını anlamak artık performance marketing'in core competency'si. Stack'i doğru kurmayan ekipler ya underinvest yapar (modeled signal'e güvenmez, opportunity kaçırır) ya da overinvest yapar (model overestimate'i fark etmez, CAC patlar). 2026'da kazanan: sinyal karmaşıklığını engineering disiplinine bağlayan ekip.