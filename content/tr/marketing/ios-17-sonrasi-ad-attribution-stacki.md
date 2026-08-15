---
title: "iOS 17 Sonrası Ad Attribution Stack'i"
description: "ATT, SKAdNetwork 4 ve modeled conversions ile iOS'ta dönüşüm ölçümünü yeniden kurmak: post-lookback maturity döneminin pratik mimarisi."
publishedAt: 2026-08-15
modifiedAt: 2026-08-15
category: marketing
i18nKey: marketing-003-2026-08
tags: [ios-attribution, skadnetwork, att, modeled-conversions, mobile-measurement]
readingTime: 8
author: Roibase
---

iOS 14.5'te başlayan ATT (App Tracking Transparency) dönüşümü, 2026'ya geldiğimizde artık "yeni normal" değil — piyasanın operasyon gerçeği. İlk günlerdeki panik bitti, ama attribution stack'i hâlâ birçok ekipte eski varsayımlarla çalışıyor. iOS 17 ile birlikte gelen SKAdNetwork 4.0'ın tam olgunluk dönemi (post-lookback maturity) ve Meta, Google'ın modeled conversions'a göre optimize edilmiş bid algoritmaları artık kalibrasyon gerektiriyor. Bu yazı, iOS'ta dönüşüm ölçümünü 2026 standartlarına göre yeniden kurmanın teknik haritasını veriyor.

## ATT Sonrası Attribution'ın Mimarisi

iOS 14.5 öncesinde IDFA (Identifier for Advertisers) her kullanıcı için deterministik bir ID sağlıyordu. Reklam ağları bu ID'yi gösterim, tıklama, install ve in-app event'leri birbirine bağlamak için kullanıyordu. ATT ile birlikte kullanıcıların %70-80'i tracking'i reddetti (Meta'nın 2025 kamu verisine göre %23 opt-in). IDFA kaybolunca eski MMP (Mobile Measurement Partner) altyapısı çöktü.

Yerine gelen sistem iki katmanlı: **deterministik** (SKAdNetwork ile sınırlı, aggregate, delayed) ve **probabilistic** (modeled conversions ile tahmine dayalı). SKAdNetwork 4.0 ile Apple üç temel değişiklik getirdi: üç aşamalı postback penceresi (0-2 gün, 3-7 gün, 8-35 gün), source identifier ile publisher-level visibility, crowd anonymity threshold'ın düşürülmesi. Bu değişiklikler sayede attribution signal'ı daha granüler hale geldi, ama yine de deterministic data yalnızca aggregate seviyede geliyor — kullanıcı-bazlı değil, cohort-bazlı.

Modeled conversions ise Meta ve Google'ın makine öğrenmesi modeliyle ATT-reddi kullanıcılardan gelen event'leri **tahmin edip** kampanya optimizasyonuna dahil etmesi. Meta'nın AEM (Aggregated Event Measurement) ve Google'ın Consent Mode v2 bu modellerle çalışıyor. Ancak modeled data CAPI (Conversions API) veya Enhanced Conversions gibi first-party signal'ların kalitesine doğrudan bağlı — signal kalitesi düşükse model bias yapar.

## SKAdNetwork 4 ile Çalışmanın Gerçek Maliyeti

SKAdNetwork 4.0'ın getirdiği üç aşamalı postback yapısı teoride iyi — erken sinyali (0-2 gün) kullanarak kampanyayı hızlı optimize edebilirsin. Ama pratikte iki sorun var: **timer randomization** ve **conversion value bit sınırı**.

Timer randomization Apple'ın privacy mekanizması: postback 0-24 saat arasında rastgele gecikmeyle geliyor. Bu da 0-2 günlük pencerede bile sinyali gerçek zamanlı kullanmayı engelliyor. Örneğin bir kullanıcı install sonrası 6 saatte in-app purchase yapsa bile, SKAdNetwork postback'i 48 saat sonra, 18 saatlik random delay ile gelirse, o install'ı trigger eden kampanyaya feedback döngüsü 66 saat sonra kapanıyor. Bu gecikme UA (User Acquisition) kampanyalarının günlük bütçe kararlarını zorlaştırıyor.

Conversion value ise 6 bit (0-63 arası tam sayı). Bu 64 farklı event kombinasyonu demek. Oyun uygulaması için level 1, level 5, level 10, ilk satın alma, ikinci satın alma gibi event'leri encode etmelisin. Bit'leri doğru atamak stratejik karar — yanlış mapping yaparsak bidding sinyali bozuluyor. Örneğin "level 10" event'ini en yüksek value'ya atarsak, ama gerçek LTV kaynağı "7 günde 3+ satın alma" ise, algoritma yanlış cohort'a optimize eder.

### Conversion Value Mapping Örneği

```json
{
  "install": 0,
  "tutorial_complete": 1,
  "level_3": 5,
  "level_10": 15,
  "first_purchase": 25,
  "purchase_3d": 40,
  "purchase_7d": 63
}
```

Bu mapping'de "purchase_7d" en yüksek value (63) çünkü 7 günlük retention + monetizasyon LTV proxy'si. Ancak crowd anonymity threshold (Apple'ın minimum kullanıcı sayısı gerekliliği) nedeniyle bu value droplansa, 40'lık "purchase_3d" fallback oluyor.

## Modeled Conversions ve First-Party Signal Kalitesi

Meta'nın modeled conversions sistemi, ATT-reddi kullanıcılardan gelen event'leri tahmin ederken şu veri kaynaklarını kullanıyor: aggregate SKAdNetwork postback'leri, web-to-app pixel bridge, CAPI ile gönderilen first-party event'ler. Model bu veriyi kullanıcı demografisi, davranış patterni, device fingerprint ile eşleştirip kayıp event'leri impute ediyor.

Ancak modelin doğruluğu [Performans Pazarlaması](https://www.roibase.com.tr/tr/ppc) altyapınızın signal kalitesine bağlı. CAPI entegrasyonunda event match quality (EMQ) skoru %50'nin altındaysa, model noise üretiyor. EMQ düşük olmasının en yaygın nedeni: hash edilmemiş email, eksik `external_id`, `event_source_url` alanının boş olması. Meta'nın 2025 kılavuzuna göre EMQ %75+ hedeflenmeli — bu da email, phone, external_id'nin doğru hash'lenmesi ve client-side + server-side event'lerin deduplicate edilmesi gerektiği anlamına geliyor.

Modeled conversions'ın diğer bir sorunu: **feedback loop delay**. Meta kampanya algoritması model tahminlerine göre optimize ederken, gerçek conversion verisi aggregate SKAdNetwork'ten 2-3 gün gecikmeyle geliyor. Bu lag'de algoritma yanlış cohort'a optimize etmiş olabilir. Örneğin modeled data "Android + kadın kullanıcı" segmentinde yüksek ROAS gösterirken, SKAdNetwork aggregate'te bu segment'in gerçek conversion rate'i düşükse, algoritmanın geri dönüp kendini düzeltmesi 5-7 gün sürer.

## Incrementality ve Multi-Touch Attribution'ın Yeni Rolü

SKAdNetwork ve modeled conversions'ın ikisi de **last-touch** mantığıyla çalışır — install öncesindeki son tıklama kampanyayı kredilendiriyor. Ama gerçek dünyada kullanıcı yolculuğu multi-touch: TikTok'ta video görüyor, Google'da marka araması yapıyor, Meta retargeting'e tıklayıp install ediyor. Last-touch bu yolculuğu görmüyor, hepsini Meta'ya atıyor.

Incrementality testing bunu çözmek için geliyor. Geo-based holdout (belirli coğrafyalarda kampanyayı kapatıp organic baseline'ı ölçme), PSA (Public Service Announcement) placebo campaign, Bayesian MMM (Marketing Mix Modeling) gibi yöntemlerle her kanalın **gerçek katkısını** ölçebilirsin. Örneğin Meta kampanyasını 2 hafta Ankara'da durdurursun, install sayısı %30 düşerse, Meta'nın incremental katkısı %30 demektir. Bu test SKAdNetwork'ün atamadığı upper-funnel katkıyı gösterir.

MMM ise tarihsel spend ve outcome verisini regresyon modeliyle analiz eder. iOS 17 sonrası stack'te MMM'nin rolü arttı çünkü user-level attribution artık eksik. Ancak MMM'yi doğru kurmak teknik — kontrol değişkeni olarak seasonality, macroeconomic index, competitor spend gibi faktörleri modele dahil etmezsen, model sadece korelasyon bulur, causality bulamaz.

## Post-Lookback Maturity Döneminde Operasyon

2026'da iOS attribution stack'inin olgunlaştığını söylerken kastettiğimiz: MMP'ler (Adjust, AppsFlyer, Singular) SKAdNetwork 4'ü tam destekliyor, modeled conversions Meta/Google bidding'e entegre, CAPI + Enhanced Conversions kurulumu standart hale geldi. Ama operasyon seviyesinde hâlâ kritik noktalar var.

İlk olarak: **SKAN + modeled data'nın blend stratejisi**. Bazı ekipler sadece modeled data'ya güveniyor — hızlı, granular. Ama modeled data bias içerebilir. Diğer ekipler sadece SKAdNetwork'e bakıyor — deterministik ama gecikmiş ve aggregate. Doğru yaklaşım ikisini blend etmek: modeled data ile hızlı optimize et, SKAdNetwork aggregate ile haftalık kalibre et. Örneğin modeled ROAS %120 gösteriyorsa ama SKAdNetwork aggregate ROAS %90 ise, modeled data overestimate ediyor demektir — bid stratejisini %15-20 düşür.

İkincisi: **conversion value stratejisinin dinamik güncellemesi**. Oyun mekaniği değişirse (yeni level, yeni IAP fiyatı), conversion value mapping'i güncellemelisin. Bu güncelleme Apple Developer Console'dan yapılıyor ama her değişiklik yeni kampanya için geçerli — mevcut kampanyalar eski mapping ile devam ediyor. Bu da A/B test yaparken kampanya grubu segmentasyonunu zorlaştırıyor.

Üçüncüsü: **privacy threshold'ların takibi**. SKAdNetwork postback'i crowd anonymity threshold'ı aşamazsa, conversion value düşürülüyor veya hiç gelmiyor. Küçük kampanyalarda (günlük <500 install) bu sık yaşanır. Çözüm: küçük kampanyaları aggregate edip tek postback penceresi altında toplamak veya conversion value mapping'i basitleştirip threshold'ı düşürmek.

## Şimdi Ne Yapmalı

iOS 17 sonrası attribution stack'i artık "geçici çözüm" değil — kalıcı mimari. Şu adımları önceliklendir: CAPI/Enhanced Conversions entegrasyonunu EMQ %75+ hedefine göre kalibre et, SKAdNetwork conversion value mapping'ini LTV proxy'lerine göre yeniden tasarla, modeled conversions + aggregate SKAN data'yı blend ederek haftalık bias kontrolü kur, incrementality test (geo-holdout veya PSA) ile multi-touch contribution'ı ölç. Attribution'ı eski deterministik günlere döndüremezsin ama mevcut stack'i doğru kurduğunda, bidding algoritması doğru sinyali alıyor ve kampanya performansı ölçülebilir kalıyor.