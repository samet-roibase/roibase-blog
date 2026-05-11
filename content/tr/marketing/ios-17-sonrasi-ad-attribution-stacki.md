---
title: "iOS 17 Sonrası Ad Attribution Stack'i"
description: "ATT, SKAdNetwork 4 ve modeled conversions ile birlikte iOS reklam ölçümü tamamen yeniden kuruldu. İşte 2026'da çalışan stack."
publishedAt: 2026-05-11
modifiedAt: 2026-05-11
category: marketing
i18nKey: marketing-003-2026-05
tags: [ios-attribution, skadnetwork, att, modeled-conversions, mobile-measurement]
readingTime: 8
author: Roibase
---

iOS 14 ile başlayan attribution kırılganlığı 2026'da olgunluk noktasına ulaştı. ATT (App Tracking Transparency) opt-in oranları %25'in altında kaldı, SKAdNetwork 4 ile conversion value artık 128 bit'e çıktı, Meta ve Google modeled conversions'ı default hale getirdi. Oyun eskisi gibi değil: deterministic attribution öldü, probabilistic + post-lookback maturity dönemi başladı. iOS'ta reklam yatırımı yapan herkes yeni stack'i doğru kurmazsa bütçe karadeliğe gidiyor.

## ATT Sonrası Gerçeklik: %25 Opt-In ile Yaşamak

iOS 17 kullanıcı tabanında ATT opt-in oranı global ortalaması %23-27 arasında sabitleşti (Singular, Q1 2026 verisi). Bu demek oluyor ki kullanıcıların %75'i IDFA paylaşmıyor. Eski IDFA-based attribution'a bağımlı kampanyalar artık sadece azınlık segmenti görüyor, geri kalanı "modeled" olarak işaretleniyor.

Modeled conversions ne demek? Meta ve Google, ATT'den reddedenler için machine learning ile kullanıcı davranışını regress edip dönüşüm olasılığı atıyor. Bu yöntem aggregate — kişi bazlı değil, cohort bazlı. ROAS hesabı artık %70-80 modeled'dan geliyor. Eğer kampanya optimizasyonunu hâlâ "deterministic ROAS" üzerinden yapıyorsan verinin çoğunu es geçiyorsun.

Yeni gerçeklik basit: iOS'ta zaten %100 hassasiyet yok. Kabul edip stack'i buna göre kur. Deterministic sinyal azınlığı karar için yeterli değil — modeled'ın nasıl üretildiğini anlamak, güvenilirliğini kontrol etmek ve incrementality testleriyle doğrulamak zorundasın.

## SKAdNetwork 4: 128-Bit Conversion Value ve Hierarchical Source ID

SKAdNetwork 4 (iOS 16.1+ default, iOS 17'de mature) Apple'ın sunduğu tek "official" aggregate attribution yöntemi. Temel mekanizma: kullanıcı reklama tıklıyor, uygulama yüklenip ilk açılıştan sonra conversion value kaydediliyor, 24-72 saat postback window'u kapandığında Apple aggregated sinyal gönderiyor. Hiçbir IDFA, hiçbir device identifier yok.

Yenilik ne? Conversion value artık 128 bit — daha fazla detay kodlayabiliyorsun. Örnek encoding stratejisi: ilk 6 bit install source (Meta, Google, TikTok, organic), sonraki 7 bit olay tipi (first purchase, tutorial complete, level 3), son 115 bit revenue bucketing + cohort segment. Bu encoding'i sen kuruyorsun, her uygulama kendi ihtiyacına göre tasarlıyor.

Hierarchical Source ID de geldi: tek campaign ID yerine artık 4 katmanlı hiyerarşi kullanabiliyorsun (campaign → ad set → creative → keyword). Bu multi-touch modelleme için kritik — önceki SKAdNetwork'te sadece campaign-level data vardı, şimdi creative-level performans ayrıştırılabiliyor. Ancak detay arttıkça noise da artıyor: Apple privacy threshold nedeniyle düşük volümlü segmentlerde postback atmıyor. Stratejik trade-off: çok granüler olmak mı yoksa daha fazla postback almak mı?

### Conversion Value Tasarımı

| Bit Aralığı | Kullanım | Örnek Encoding |
|---|---|---|
| 0-5 (6 bit) | Install source | 0=organic, 1=Meta, 2=Google, 3=TikTok |
| 6-12 (7 bit) | Event type | 0=install, 1=registration, 2=first_purchase, 3=D7_retention |
| 13-127 (115 bit) | Revenue bucket + segment | LTV prediction + geo + device tier |

Bu encoding'i MMP'ler (Adjust, AppsFlyer) SDK'ya gömer. Ama encoding mantığını sen belirlemen gerekiyor — MMP default encoding'i sığ kalıyor.

## Modeled Conversions: Meta CAPI + Google Enhanced ile Nasıl Artırılır

Modeled conversions'ın kalitesi, platforma gönderilen first-party signal miktarıyla doğru orantılı. Meta CAPI (Conversions API) ve Google Enhanced Conversions burada devreye giriyor. iOS'ta IDFA yoksa bile sunucu tarafından gönderilen email hash, phone hash, user_data parametreleri platformun modelleme doğruluğunu artırıyor.

Meta CAPI ile iOS'ta %15-20 ROAS iyileşme rapor edildi (Meta Business Partner verileri, 2025 Q4). Neden? Çünkü pixel'e ulaşmayan dönüşümler sunucu tarafından tamamlanıyor ve Meta bu sinyali kullanıcı cohortlarıyla match edip modelleme yapıyor. Anahtar: CAPI'ye gönderilen event_id pixel ile aynı olmalı (deduplication), user_data parametreleri SHA-256 hash ile normalize edilmiş olmalı, event_time sunucu timestamp'i ile uyumlu olmalı.

Google Enhanced Conversions da benzer — ama mekanizma farklı. Google Ads'te enhanced conversions açıksa, GTM server container'dan gönderilen dönüşümlere user_data eklenebiliyor. Google bu veriyi kendi logged-in user graph'ı ile cross-reference edip modelleme yapıyor. Dikkat: enhanced conversions sadece web'de değil, app'lerde de çalışıyor — ancak app'te server-side kurmak daha kompleks. Firebase SDK + Cloud Functions üzerinden [first-party veri mimarisi](https://www.roibase.com.tr/tr/ppc) gerekiyor.

## Post-Lookback Maturity: 7-Day Attribution Window Artık Yeterli Değil

iOS stack'inde lookback window genelde 1-7 gün. SKAdNetwork'te 24-72 saat, Meta'da iOS attribution 7 gün, Google Ads'te configurable ama default 7 gün. Problem şu: kullanıcı davranışı 7 günde bitmiyor — özellikle subscription, e-ticaret gibi yüksek consideration cycle'ı olan kategorilerde first purchase 14-30 gün arasında gerçekleşebiliyor.

Post-lookback maturity ne demek? Kısa window'dan sonra gerçekleşen dönüşümleri retrospektif olarak hesaba katmak. Örnek: kullanıcı 3. günde reklama tıkladı, 12. günde satın aldı — bu conversion Meta'nın 7-day window'una yakalanmadı ama gerçek. Eğer cohort bazlı LTV analizi yapıyorsan bu conversion'ı manuel olarak campaign'e attribution etmen gerekiyor.

Yöntem: install cohort'unu takip et, D7 → D14 → D30 revenue artışını ölç, delta'yı campaign'lere yeniden dağıt. Bu manuel süreç ama BI + data warehouse ile otomasyon kurulabilir. BigQuery'de `FIRST_VALUE()` window function ile install_date'e göre campaign match yapabilirsin, sonra LTV increment'i campaign'lere weighted attribution ile dağıtırsın. Roibase'in [performans pazarlaması](https://www.roibase.com.tr/tr/ppc) altyapısında bu pipeline default.

## Incrementality Testing: Modeled Data'ya Güvenebilir miyiz?

Modeled conversions ne kadar doğru? Test etmeden bilemezsin. Incrementality testing — yani holdout/geo-based experiment — artık iOS kampanyalarında zorunlu. Meta Conversion Lift, Google Campaign Experiments, TikTok Split Testing aynı amaca hizmet ediyor: kampanyayı açık/kapalı tuttuğun gruplarda dönüşüm farkını ölçüyorsun, gerçek lift'i görüyorsun.

Örnek: %10 kullanıcıyı holdout grubuna alıyorsun (kampanya görmüyor), %90 treatment (kampanya görüyor). 30 gün sonra treatment grubunun conversion rate'i %5, holdout'un %3.5 — demek ki gerçek lift %1.5 (absolut). Eğer platform ROAS'ı 3.0 gösteriyorsa ama incrementality test 1.2 diyorsa, modeled data overestimate ediyor. Bu gap'i adjustment factor olarak kampanya ROAS'ına uygulaman gerekiyor.

Geo-based test daha robust ama daha yavaş. iOS kullanıcı yoğunluğuna göre ülkeleri/eyaletleri ikiye bölüyorsun, birinde kampanya açık birinde kapalı. 4-8 hafta sonra conversion farkına bakıyorsun. Meta'nın Conversion Lift tool'u bunu otomatize ediyor, Google Ads'te manuel kurman gerekiyor (campaign draft + experiment).

## iOS Stack'inin 2026 Mimarisi

Modern iOS attribution stack'i şöyle görünüyor:

1. **SKAdNetwork 4 integration** — MMP üzerinden conversion value encoding + hierarchical source ID
2. **Meta CAPI + Google Enhanced** — sunucu tarafı event gönderimi, user_data enrichment
3. **Modeled conversions okuma** — platform dashboard'larında "modeled" flag'ine dikkat et, aggregate ROAS hesapla
4. **Cohort-based LTV tracking** — BigQuery/Snowflake'te install cohort → revenue match, post-lookback attribution
5. **Incrementality testing** — her quarter en az 1 holdout experiment, lift factor hesapla
6. **Creative testing velocity** — SKAdNetwork creative-level granularity ile hızlı iterasyon

Bu stack'i kurmak 6-8 hafta alıyor: MMP onboarding, server-side CAPI/Enhanced setup, data warehouse pipeline, BI dashboard. Ancak kurulduktan sonra iOS ROAS'ı %20-30 daha güvenilir hale geliyor — çünkü artık modeled data'yı doğru okuyorsun, incrementality ile doğruluyorsun, post-lookback ile tam LTV'yi görüyorsun.

iOS 17 sonrası attribution karanlık değil — sadece farklı. Deterministic sinyal azaldı ama probabilistic + aggregate yöntemler olgunlaştı. Stack'i doğru kurduğunda hâlâ ölçülebilir, optimize edilebilir kampanyalar yapabilirsin. Anahtar: modeled data'yı kabullenmek, incrementality'ye yatırım yapmak ve cohort-based analizi disipline etmek. 2026'da iOS'ta büyümek isteyen herkes bu üçlüye hakim olmalı.