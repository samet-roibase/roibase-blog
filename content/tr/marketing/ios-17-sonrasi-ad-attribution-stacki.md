---
title: "iOS 17 Sonrası Ad Attribution Stack'i"
description: "ATT, SKAdNetwork 4 ve modeled conversions ile iOS'ta attribution'ı yeniden kurmak: post-lookback maturity dönemi için pratik strateji rehberi."
publishedAt: 2026-06-02
modifiedAt: 2026-06-02
category: marketing
i18nKey: marketing-003-2026-06
tags: [ios-attribution, skadnetwork, att, modeled-conversions, mobile-measurement]
readingTime: 8
author: Roibase
---

Apple'ın iOS 14.5'te App Tracking Transparency'yi devreye almasının üzerinden beş yıl geçti. O günden bu yana mobil performance marketing'in temel varsayımları değişti. Deterministik user-level attribution öldü, probabilistik ve aggregated modeller zorunlu hale geldi. iOS 17 ve SKAdNetwork 4'ün getirdiği yeni conversion value şeması, post-lookback maturity penceresi ve modeled conversions sayesinde oyun yeniden kurgulanıyor. Bu yazıda iOS'ta attribution'ı 2026'da nasıl kurman gerektiğini, hangi sinyalleri hangi sırayla kullanacağını ve MMP + incrementality testlerini nasıl birleştireceğini anlatıyoruz.

## ATT Sonrası Attribution Anatomisi

iOS 14.5'ten önce MMP'ler (Adjust, AppsFlyer, Kochava) cihaz düzeyinde IDFA okuyarak her dönüşümü doğrudan bir kampanyaya bağlayabiliyordu. ATT ile bu mekanizma %95'ten fazla kullanıcı için kapandı (2025 Statista verisi, opt-in oranı %7 seviyesinde). Şu an elimizde üç katman var:

**1. Deterministic (IDFA opt-in kullanıcıları):** İzin veren %7'lik dilim için klasik MMP akışı hâlâ çalışıyor. Click/impression timestamp, install, in-app event — hepsi user-level. Ancak bu segment artık temsil gücü olmayan bir sample.

**2. SKAdNetwork (aggregated postback):** Apple'ın kendi privacy-first çerçevesi. Attribution window 0-72 saat arası; conversion value 6-bit (0-63) encoding ile sınırlı. SKAdNetwork 4'te ikinci ve üçüncü postback eklenmiş durumda (8-35 gün arası lockWindow), bu sayede D7-D30 retention artık ölçülebiliyor.

**3. Modeled conversions:** MMP'lerin makine öğrenmesiyle tahmin ettiği dönüşümler. Aggregate click/impression data + install count + SKAN sinyali birleştirilerek oluşturuluyor. Güvenilirliği deterministic'ten düşük, ama ölçek sağlıyor.

Bu üç katmanı birlikte kullanmak zorundayız. Hiçbiri tek başına yeterli değil: IDFA çok dar, SKAN aggregated ve gecikmeli, modeled ise tahmine dayalı. Stack'i bu üçünü dengeleyen bir mimaride kurmak core competency haline geldi.

## SKAdNetwork 4'ün Getirdikleri

SKAdNetwork 4 (iOS 16.1 ile geldi, iOS 17'de matured) üç büyük yenilik getirdi:

### Conversion Value Hierarchy ve Postback Zinciri

Artık tek bir 6-bit yerine üç postback var: ilk 0-2 gün, ikinci 3-7 gün, üçüncü 8-35 gün. Her postback kendi 6-bit değerini taşıyor. Bu sayede erken IAP sinyalini (install-to-purchase <48h) ikinci postback'te retention sinyalinden (D3-D7 session count) ayırabiliyorsun. Önceden tüm sinyalleri 64 slot'a sıkıştırmak zorundaydık, şimdi 64×3=192 combinasyon var (pratikte 64+64+64 değil, sequential encoding).

**Örnek mapping:**
- **Postback 1 (0-2 gün):** D0 IAP durumu (0=no event, 1-10=revenue bracket, 11-20=specific SKU, 21-63=custom blend)
- **Postback 2 (3-7 gün):** D3-D7 retention tier (0=churn, 1-20=session count band, 21-40=engagement depth)
- **Postback 3 (8-35 gün):** D30 LTV proxy (0-63=cumulative revenue bracket)

Bu yapıyı doğru kurabilmek için conversion value mapping'i her hafta gözden geçirmek zorundasın. Çünkü kullanıcı davranışı değiştikçe en bilgi verici sinyalin hangi slot'a düştüğü değişiyor.

### Source Identifier ve Hierarchical Source ID

SKAdNetwork 4, publisher app'lerin ve alt yayıncı ağların ID'sini dört-tier bir hiyerarşide gösteriyor. Artık sadece "Meta'dan geldi" değil, "Meta → Audience Network → Publisher App X" şeklinde görüyorsun (eğer ad network bunu expose ediyorsa). Bu sayede sub-publisher performansını karşılaştırabiliyorsun.

Pratikte Facebook, TikTok, Google gibi walled garden'lar bu field'ı tam expose etmiyor, ama programmatic ve rewarded video ağlarında kritik fark yaratıyor.

### Web-to-App Attribution Support

iOS 17.4 ile SKAdNetwork web click'lerini de desteklemeye başladı. Eğer bir Safari banner'ından App Store'a gidip install yapılırsa, bu da SKAN postback'ine giriyor. Web + app ortak UA stratejisi çalıştıran markalarda bu sinyali [Performans Pazarlaması (PPC)](https://www.roibase.com.tr/tr/ppc) kampanyalarıyla birleştirip cross-channel incrementality hesabı yapmak mümkün hale geldi.

## Modeled Conversions: Nasıl Çalışır, Ne Zaman Güvenilir

Modeled conversions, MMP'lerin SKAN postback'lerini, aggregate impression/click sayılarını ve install count'u birleştirerek makine öğrenmesi ile probabilistik attribution yaptığı mekanizma. AppsFlyer buna "predictive analytics", Adjust "statistical modeling" diyor — teknik olarak aynı şey: regression + Bayesian inference.

**Güvenilir olma koşulları:**
1. **Yeterli veri hacmi:** En az günde 500+ install, kampanya başına 50+ conversion (SKAN veya IDFA). Altında model overfit eder.
2. **SKAN sinyalinin tutarlılığı:** Conversion value mapping'in stabil olması lazım. Mapping'i her gün değiştirirsen model tarihsel deseni yakalayamaz.
3. **Incrementality testi ile kalibrasyon:** Her Q'da en az bir geo-holdout veya time-based holdout yapman gerekiyor. Modeled sayılar ile gerçek lift'i karşılaştırıp bias correction uyguluyorsun.

**Kötü kullanım örneği:** Yeni bir kampanya başlattın, 3 günde 20 install geldi, MMP "modeled 15 IAP" dedi. Bu tamamen gürültü — sample size yetersiz. En az 2 hafta bekle.

**İyi kullanım örneği:** 30 gün boyunca Meta + TikTok + Google UAC toplamda 50K install getirdi, SKAN'dan 3K conversion postback geldi. MMP bunu 8K'ya modelledi. Aynı dönemde geo-test holdout (Fransa vs Almanya) +12% lift gösterdi. Modeled sayıyı 8K × 1.12 = 8.96K'ya revize ettin. Bu güvenilir.

## Post-Lookback Maturity: 35 Gün Sonrası Sinyal

SKAdNetwork 4'ün üçüncü postback'i 8-35 gün arası olayları taşıyor. 35. günden sonra hiçbir SKAN postback gelmiyor. Ancak gerçek kullanıcı davranışı 35 günde bitmiyor: D60 retention, D90 LTV, yıllık abonelik yenilemesi gibi sinyaller var.

**Çözüm yaklaşımları:**

1. **Cohort-based LTV projection:** İlk 35 günlük SKAN + modeled conversion data ile cohort LTV curve'ü fit ediyorsun (genelde power law veya exponential decay). 90-180 günlük LTV'yi extrapolate ediyorsun. Bu tahmin, ama eğer cohort büyüklüğü yeterliyse variance düşük oluyor.

2. **Cross-channel holdout ve incrementality:** Bir kanalı 2 hafta pause et, organic install ve in-app revenue değişimini ölç. Net incrementality'yi hesapla, post-35-gün sinyalini bu testle backfill et. Bunu quarterly yap.

3. **Server-side event enrichment:** SKAN postback'inde olmayan late-stage olayları (subscription renewal, high-ticket IAP) MMP'ye server-to-server gönder. Bu deterministic değil ama aggregate'te pattern yaratıyor. MMP bu sinyali modele input olarak kullanır.

**Dikkat:** Apple, SKAN dışında server-side user-level sinyal göndermeyi açıkça yasaklamıyor, ama MMP'nin bunu user-level attribution claim'i olarak sunması policy ihlali. Aggregate modeling input olarak kullanmak sorun değil.

## Pratik Stack Kurulum Senaryosu

Diyelim ki bir subscription-based fitness app'iniz var. iOS install base'iniz %60, aylık 100K yeni install hedefliyorsunuz. İşte attribution stack'iniz:

| Katman | Tool | Rolü | Güven aralığı |
|--------|------|------|---------------|
| SKAN Postback | AppsFlyer | İlk 35 gün conversion value + source ID | %95 (Apple verify ediyor) |
| Modeled Conversions | AppsFlyer Predictive | SKAN + aggregate ile probabilistic attribution | %70-80 (geo-test kalibrasyonunda) |
| IDFA Opt-in | AppsFlyer raw data | %7'lik deterministic segment | %100 (ama temsil gücü düşük) |
| Incrementality | GeoLift (Meta) + Custom holdout | Kanal-level lift ölçümü | %90 (istatistiksel, ama expensive) |
| LTV Projection | Internal dbt + BigQuery | Cohort curve fit, 90-180 gün tahmini | %60-70 (model accuracy) |

**Akış:**
1. Her kampanya için SKAdNetwork postback'lerini günlük çek.
2. AppsFlyer'ın modeled conversion'larını al, ama campaign-level CPA hesaplarken %20 güven aralığı bırak.
3. Ayda bir geo-holdout test çalıştır (örneğin İspanya'da Meta pause, Portekiz'de devam et). Net lift'i hesapla.
4. Quarterly, cohort LTV curve'ünü güncelle. İlk 35 günlük SKAN sinyali ile 90 günlük revenue correlation'ını regress et.
5. Budget allocation'ı SKAN + modeled + incrementality'nin weighted average'ı ile yap.

Bu multi-layer yaklaşım pahalı mı? Evet. Ama iOS traffic'in %60'ını temsil ediyorsa ve CAC $30+/user ise, attribution hatasının maliyeti çok daha yüksek.

## Tradeoff'lar ve Karşı Argüman

**"Modeled conversions güvenilmez, neden kullanıyoruz?"**

Çünkü alternatif yok. SKAN aggregated, IDFA %7, hiç sinyal olmaması ise tamamen kör uçuş demek. Modeled conversion'lar imperfect ama calibrated. Holdout testleriyle bias'ı düzeltince %75-80 accuracy elde ediyorsun — bu hiç data'dan çok daha iyi.

**"SKAdNetwork 4 yeterli mi, yoksa 5'i beklemeli miyiz?"**

SKAdNetwork 5 (iOS 18 ile geldi, 2024 yazında announce edildi) daha granular source ID ve daha uzun lookback window vadediyor, ama henüz full adoption yok. Şu an iOS 17 user base'i %70+, iOS 18 %30 civarında. Stack'i SKAdNetwork 4 üzerine kurup 5'in özelliklerini incremental olarak eklemek pragmatik yaklaşım.

**"Incrementality testi her kampanya için mi gerekiyor?"**

Hayır. Incrementality expensive ve slow. Her kanal için quarterly bir test yeterli (Meta Q1, TikTok Q2, Google Q3). Küçük kampanyalar için modeled + SKAN blend'ine güven, büyük budget hareketlerinde test et.

---

iOS attribution artık deterministik değil, probabilistic + aggregated + test-driven bir disiplin. SKAdNetwork 4'ün üç postback yapısını doğru map etmek, modeled conversions'ı holdout testleriyle kalibre etmek ve post-35-gün LTV'yi cohort projection ile tahmin etmek 2026'nın yeni standart operasyonu. Stack'inizi bu üç katman üzerine kurarsanız — SKAN + modeled + incrementality — iOS'ta kör uçmaktan çıkıp data-informed budget allocation yapabilirsiniz.