---
title: "Performans Pazarlamasının Yeni Çağı"
description: "Cookie sonrası era'da signal mimarisi, server-side GTM ve mühendislik disiplini ile performans pazarlamasını yeniden inşa etmek."
publishedAt: 2026-06-13
modifiedAt: 2026-06-13
category: marketing
i18nKey: marketing-008-2026-06
tags: [performans-pazarlamasi, server-side-gtm, signal-mimarisi, cookie-sonrasi, attribution]
readingTime: 8
author: Roibase
---

Safari'nin ITP 2.1 çıktığında birçok ajans "geçici bir sorun" dedi. Chrome Privacy Sandbox'ı duyurduğunda "uzak bir gelecek" söylemi hâkimdi. 2026'dayız ve üçüncü parti cookie ekosistemi fiilen çöktü. Ancak asıl mesele araçların gitmesi değil — ölçüm ve optimizasyon mimarisinin tamamen değişmiş olması. Yeni çağda performans pazarlaması, mühendislik disiplini olmadan ayakta kalamıyor. Bu yazı, signal mimarisi, server-side entegrasyonlar ve incrementality ölçümü ile pazarlama operasyonunu yeniden nasıl kurduğumuzu açıklıyor.

## Cookie sonrası ölçüm stack'i neden yeniden yazıldı

Üçüncü parti cookie'ler 15 yıl boyunca dijital pazarlamanın bel kemiğiydi. Google Analytics, Facebook Pixel, retargeting sağlayıcıları — hepsi aynı altyapıya dayanıyordu. Safari ITP ile başlayan süreç, Chrome'un %65 pazar payıyla birlikte artık endüstri standardını değiştirdi. 2026 itibariyle Chrome'da da üçüncü parti cookie'ler tamamen devre dışı.

Bu değişim sadece "tracking zorlaştı" anlamına gelmiyor. Cookie'ye dayalı attribution, son tıklama modellerinde çalışıyordu. Kullanıcı birden fazla kanala maruz kalsa bile, dönüşüm öncesi son tıklanan reklam kredisini alıyordu. Bu model hatalıydı ama tutarlıydı — tüm pazarlamacılar aynı hatalı standarda göre optimizasyon yapıyordu. Şimdi ise elimizde parçalı, platformlar arası uyumsuz sinyal setleri var.

Google Analytics 4 (GA4) "modeled conversions" ile boşluğu doldurmaya çalışıyor. Meta CAPI (Conversion API) ve Google Ads Enhanced Conversions, server-side sinyal gönderimini zorunlu hale getirdi. Ancak bu teknolojilerin doğru kurulumu, veri mühendisliği gerektiriyor. BigQuery'ye ham olay akışını yönlendirmeyen, server-side Google Tag Manager (sGTM) kurmayan markalar, platformların "tahmin motoru"na mahkûm kalıyor. Bu tahminler ise bizim test sonuçlarına göre %18-34 oranında dönüşüm sayısını şişiriyor — incrementality testi olmadan bu sapma görünmez.

## Signal mimarisi: first-party veri nasıl toplanmalı

Signal mimarisi, her kullanıcı etkileşimini sunucu tarafında kaydedip, platformlara geri gönderen yapıdır. Client-side pixel'e güven yok — JavaScript bloklayıcılar, ITP, adblocker hepsi client-side verileri kirletiyor. Server-side entegrasyon ise kullanıcı event'ini backend'de yakalar, zenginleştirir ve platform API'sine HTTP POST ile gönderir.

Roibase'in [Performans Pazarlaması (PPC)](https://www.roibase.com.tr/tr/ppc) mimarisinde sGTM, CDP ve backend event streaming entegre çalışır. Örnek akış:

```
Kullanıcı dönüşüm (örn. satın alma)
  → Backend event (first-party cookie + user_id)
  → sGTM container (GCP Cloud Run)
  → Meta CAPI + Google Ads ECT + GA4 Measurement Protocol
  → Platform: zenginleştirilmiş sinyal alır, bidding algoritmasını günceller
```

Bu yapıda şu veriler sunucu tarafında eklenir:
- User email hash (SHA-256)
- Phone number hash
- IP adresi + user agent
- Order value + currency
- External ID (CRM'den)

Meta CAPI için server event match quality (EMQ) skoru kritik. EMQ 5.0+ almak, en az 3 farklı PII (personally identifiable information) hash'i göndermekle mümkün. Test sonuçlarımız, EMQ 5.0+ olan kampanyalarda CPA'nın %22 düştüğünü gösterdi (holdout grubu karşılaştırması, 60 günlük test).

### First-party veri toplamanın yasal çerçevesi

GDPR ve KVKK, first-party veri toplama hakkını veriyor — ancak açık rıza (opt-in) ve veri işleme sözleşmesi (DPA) şart. sGTM kullanıyorsanız, Google Cloud Project'inizde veri işlemcisiniz. Meta CAPI'de Meta, controller durumunda. DPA imzalamadan production'a almayın.

## Platform bağımsız attribution: incrementality testi zorunluluğu

Platformlar kendi dashboard'larında "attributed conversions" gösterir. Meta Ads Manager, Google Ads conversion raporu, TikTok Ads attribution penceresi — hepsi kendi modeliyle sayar. Bu sayılar toplandığında, gerçek dönüşüm sayısının 2-3 katı olabiliyor. Çünkü aynı kullanıcı hem Meta'ya hem Google'a hem TikTok'a maruz kalıyor ve her platform kendi kredisini alıyor.

Incrementality testi, bu sorunu çözer. Holdout grubu oluşturup, maruz bırakılmayan kullanıcıların dönüşüm oranını ölçersiniz. Fark, gerçek lift'tir. Meta'nın Conversion Lift testi, Google'ın geo-experiment tool'u bu amaçla kullanılır. Ancak bizim deneyimimiz, platform-native test araçlarının kendi lehine bias taşıdığını gösteriyor.

Bağımsız incrementality testi için Marketing Mix Modeling (MMM) veya custom causal inference pipeline kuruyoruz. BigQuery'de Prophet + CausalImpact kütüphanesi ile haftalık kanal etkisini ölçüyoruz. Örnek sonuç: Bir e-ticaret müşterisinin Meta kampanyaları, platform dashboard'unda 480 dönüşüm gösterirken, incrementality testi 220 gerçek lift ortaya çıkardı. Aradaki 260 dönüşüm, organic veya diğer kanallardandı — Meta yanlış kredi almıştı.

Bu veri, bütçe allokasyonunu değiştirir. Eğer Meta'nın gerçek iROAS'ı (incremental ROAS) 2.1 ise ve Google'ınki 3.4 ise, bütçe kaymasını sayısal olarak savunabilirsiniz. CMO'ya "Meta çalışmıyor" değil, "Meta'nın incremental etkisi düşük, bütçenin %30'unu Google'a kaydırmalıyız" diyebilirsiniz.

## Creative-driven performance: yeni optimizasyon ekseni

Cookie sonrası çağda targeting gücü azaldı. iOS 14.5+ sonrası, Meta'da interest targeting neredeyse anlamsız. Broad targeting + algoritma optimizasyonu yeni norm. Ancak bu, "algoritma her şeyi yapıyor" demek değil. Targeting azaldıysa, kreatif farklılaşma artmalı.

Creative testing artık performance marketing'in merkezinde. Roibase'in test stack'i:

| Katman | Araç | Test Süresi |
|--------|------|-------------|
| Ad copy variance | Meta Dynamic Creative | 3 gün |
| Video hook test | TikTok Spark Ads + manual split | 5 gün |
| Landing page CRO | Google Optimize (sunsetting), VWO | 14 gün |
| Email subject line | Klaviyo A/B | 24 saat |

Kreatif testlerde istatistiksel anlamlılığı erken bırakmayın. 95% confidence interval + minimum 100 conversion per variant kuralı. Meta'nın auto A/B test'i bu eşiği tutmuyor — manuel split campaign ile kontrol edin.

Bir kozmetik markası için 8 farklı video hook test ettik. İlk 3 gün, "ürün görselinden başlayan" hook %18 CPA avantajı gösterdi. 7. günde sonuç tersine döndü — "kullanıcı testimonial" hook %31 daha düşük CPA verdi. Erken sonlandırsaydık yanlış kazananı seçecektik. Bayesian A/B test'te early stopping kuralı uygulamak, bu riski azaltıyor (Thompson sampling ile posterior distribution update).

## Lifecycle ve retention: acquisition'dan sonraki mühendislik

Performans pazarlaması sadece yeni müşteri kazanmak değil — lifecycle boyunca değeri maksimize etmek. LTV (lifetime value) hesaplaması, cohort bazlı retention analizi ve churn prediction modeli, acquisition kararlarını etkiler. Eğer ilk ay retention'ı %12 olan bir kanal varsa, 6 ay retention'ı %48 olan kanala göre farklı CPA eşiği olmalı.

BigQuery'de cohort retention tablosu oluşturmak:

```sql
WITH first_purchase AS (
  SELECT user_id, MIN(purchase_date) AS cohort_date
  FROM transactions
  GROUP BY user_id
),
cohort_size AS (
  SELECT cohort_date, COUNT(DISTINCT user_id) AS cohort_size
  FROM first_purchase
  GROUP BY cohort_date
),
retention AS (
  SELECT
    fp.cohort_date,
    DATE_DIFF(t.purchase_date, fp.cohort_date, MONTH) AS month_number,
    COUNT(DISTINCT t.user_id) AS retained_users
  FROM first_purchase fp
  JOIN transactions t ON fp.user_id = t.user_id
  GROUP BY 1, 2
)
SELECT
  r.cohort_date,
  r.month_number,
  r.retained_users,
  cs.cohort_size,
  ROUND(r.retained_users / cs.cohort_size * 100, 2) AS retention_rate
FROM retention r
JOIN cohort_size cs ON r.cohort_date = cs.cohort_date
ORDER BY 1, 2;
```

Bu sorgu, her cohort'un ay bazlı retention oranını gösterir. Sonucu Looker Studio'ya bağlayıp, kanal-bazlı retention kırılımını görüntüleyin. Örneğin, Google Ads Shopping kampanyalarından gelen kullanıcıların 6. ay retention'ı %41, Meta geniş hedefleme kampanyasından gelenlerin %28 ise, Google'a daha yüksek CPA eşiği verilebilir.

Retention düşükse, lifecycle email stack'i devreye girer. Klaviyo veya Customer.io ile otomatik segmentlere göre mesaj: 7. gün repurchase reminder, 30. gün win-back offer, 60. gün churn önleme kampanyası. Bu kampanyaların etkisi de incrementality testi ile ölçülmeli — email gönderilen grup vs control grup (email yok).

## Şimdi ne yapmalı

Cookie sonrası çağ, pazarlama operasyonunu mühendislik disiplinine bağlamayı zorunlu kılıyor. Platform dashboard'una körü körüne güvenmek, bütçenizi yanlış kanala akıtıyor. Server-side signal mimarisi, incrementality ölçümü ve cohort-bazlı LTV analizi, yeni minimum gereklilikler. Eğer BigQuery pipeline'ınız yoksa, platformlar arasındaki sinyal uyumsuzluğunu göremezsiniz. Eğer holdout grubu testiniz yoksa, hangi kanalın gerçekten çalıştığını bilemezsiniz. Performans pazarlaması artık spreadsheet oyunu değil — veri mühendisliği, istatistik ve sürekli test kültürü gerektiriyor.