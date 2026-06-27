---
title: "Consent Mode v2 ve TCF 2.2: Modeling Loss'u Nasıl Yönetiriz"
description: "GDPR uyum + ölçüm kaybı tradeoff'unu Google Consent Mode v2 ve TCF 2.2 ile yönetme rehberi. Modeling accuracy, signal gap ve pratik çözümler."
publishedAt: 2026-06-27
modifiedAt: 2026-06-27
category: marketing
i18nKey: marketing-006-2026-06
tags: [consent-mode, gdpr, tcf-2-2, attribution, server-side-tracking]
readingTime: 8
author: Roibase
---

2024 Mart'ından itibaren Avrupa Ekonomik Alanı'nda (EEA) trafik gönderen herkes için Google Consent Mode v2 zorunlu hale geldi. TCF 2.2 (Transparency & Consent Framework) ise yasal tarafta IAB Europe'un getirdiği standart. İki sistemin kesişimi bir tradeoff yaratıyor: tam GDPR uyumu sağlarsın, ama %30-50 arası conversion sinyali kaybedersin. Bu kayıp "modeling loss" — yani Google'ın makine öğrenmesiyle tamamlamaya çalıştığı boşluk. Problem: modeling yeterince iyi değilse, bidding algoritman gerçeklikten kopuyor. Bu yazı, consent mekanizmasını doğru kurarak signal gap'i minimize etme yollarını açıyor.

## Consent Mode v2'nin Getirdiği Sinyal Kaybı

Google Consent Mode v2 iki durumu destekliyor: `granted` ve `denied`. Kullanıcı analytics/ad_storage izinlerini reddedince, Google Analytics ve Google Ads tag'leri cookie set etmez. Bunun yerine "cookieless ping" gönderirler — conversion count'a dahil olur ama user-level attribution bilgisi yok. Google bu eksik veriyi modelleyerek tamamlamaya çalışır.

Gerçek dünya örneği: 1000 session'lık bir site, %60 consent reddi görüyorsa (EEA ortalaması), Google sadece 400 session'dan tam sinyal alır. Geriye kalan 600 ping'de `gcs=G100` (denied state) parametresi vardır. Google bu 600 ping'i, 400 granted kullanıcının davranış örüntüsüne göre modelleyerek toplam conversion sayısını tahmin eder. Tahmin mekanizması bayesian inference temelli — yeterli granted veri varsa %90+ accuracy iddia eder.

Problem: eğer granted kullanıcı kitlesi representative değilse (örneğin sadece teknik kullanıcılar kabul ediyor), model yanılıyor. 2025 Search Ads 360 raporları, Almanya'daki bazı retailer'larda modeling error'ın %18'e çıktığını gösterdi. Bu, Smart Bidding'in öğrenme döngüsünde %18 hata demek — CPA hedefi tutmuyor.

### Modeling Accuracy'yi Artıran Faktörler

Google Consent Mode'un accuracy'si üç ana değişkene bağlı:

1. **Granted rate**: %40'ın üzerinde olmalı (Google'ın kendi önerisi). Altında model güvenilmez.
2. **Traffic volume**: Günlük 100+ conversion olmalı. Küçük sitelerde statistical power yok.
3. **Conversion çeşitliliği**: Tek bir conversion type (örneğin sadece purchase) yerine multi-funnel event olmalı (add_to_cart, begin_checkout, purchase) — model ara aşamaları görüp interpolate ediyor.

Örnek: %35 granted rate'li bir e-ticaret sitesi, günlük 50 purchase + 200 add_to_cart görüyorsa, Google modeli purchase sayısını %12 error margin'le tahmin ediyor (Google Analytics 4 Data Quality raporundan). Ama %20 granted + günlük 20 purchase varsa, error %30'a çıkıyor — o noktada bidding güvenilmez.

## TCF 2.2 ve Vendor Consent Stack'i

TCF 2.2, IAB Europe'un gelişen consent string formatı. Google'ın "Additional Consent Mode" (ACM) ile çalışır — yani Google'ın vendor ID'si (755) TCF string'inde olmasa bile, ACM string'inde olabilir. Bu ayrım önemli: sadece TCF 2.2 string'ine güvenirsen, Google tag'lerine consent veremeyen kullanıcılar bile olabilir.

Consent Management Platform (CMP) seçerken dikkat et: Cookiebot, OneTrust, Usercentrics gibi büyük vendor'lar hem TCF 2.2 hem ACM string'lerini destekler. Ama küçük/custom CMP'ler bazen ACM string'i üretmez — Google o kullanıcıyı "denied" sayar.

### CMP Konfigürasyonunda Kritik Hatalar

Sık görülen hata: CMP'nin "legitimate interest" modunu Google tag'leri için açmak. TCF 2.2'de legitimate interest bazı vendor'lar için yasal, ama Google Ads specifically "consent" gerektirir (IAB Purpose 1 + Google-specific consent toggle). Eğer sadece legitimate interest ile tag tetiklersen, Google'ın server'ına `gcs=G110` (ad_storage denied, analytics granted) pinging gider — ad conversion atlanır.

Doğru setup:
- **Purpose 1** (Store and/or access information): Consent + legitimate interest her ikisi de açık
- **Google vendor consent toggle**: Açık (755 + ACM)
- **Custom consent signal**: `gtag('consent', 'update', {ad_storage: 'granted'})` — CMP'nin event listener'ı consent değişince bu kodu tetiklemeli

Kod bloğu örneği (GTM event listener):

```javascript
window.addEventListener('CookiebotOnAccept', function () {
  if (Cookiebot.consent.marketing) {
    gtag('consent', 'update', {
      ad_storage: 'granted',
      analytics_storage: 'granted'
    });
  }
});
```

Bu listener olmadan, CMP kullanıcı kabul etse bile Google tag'leri güncellenmiyor — sinyal kayıp devam ediyor.

## Server-Side GTM ile Signal Gap'i Kapamak

Client-side consent mekanizması cookie'lere bağlı olduğu için, ITP (Safari), ETP (Firefox) ve üçüncü-parti cookie block'ları zaten sinyali %20-30 düşürür. Consent Mode buna ek %30-50 kayıp getirirse, toplam signal loss %50-70'e varabilir.

Çözüm: [Dijital Pazarlama](https://www.roibase.com.tr/tr/dijitalpazarlama) altyapısını server-side tag management ile upgrade etmek. Server-side GTM (sGTM), consent signal'ını server'a iletir, orada Google Analytics 4 Measurement Protocol ve Google Ads Enhanced Conversions API'sine gönderir. Bu yapıda:

1. **Client-side**: Consent durumu kaydedilir, minimal ping (pageview + `gcs` parametresi) server'a atılır.
2. **Server-side**: Consent `granted` ise, server event_data'ya user IP, user-agent, client_id ekleyip Google'a gönderir. Consent `denied` ise, sadece aggregated ping gider.
3. **Avantaj**: Safari/Firefox'un ITP/ETP'si server request'i görmez — first-party domain'den çıkan HTTP call olduğu için block edilmez.

2025 Google Ads case study (retail vertical, Almanya): sGTM + Consent Mode v2 kombinasyonu, pure client-side setup'a göre %18 daha fazla conversion signal yakaladı (granted kullanıcılarda bile, çünkü ITP kaybı ortadan kalktı).

### sGTM + Enhanced Conversions Entegrasyonu

Enhanced Conversions, Google Ads'in SHA-256 hash'li first-party data (email, phone, address) ile conversion match yapma özelliği. Consent Mode v2 ile kombine edilince:

- **Granted user**: Cookie + hashed email gönderilir → %95+ match rate
- **Denied user**: Cookieless ping + hashed email (consent varsa) → %60-70 match rate

Ancak dikkat: email hash'leme için de GDPR consent şart. TCF 2.2'de bu Purpose 2 (Basic ads) altında. Eğer kullanıcı Purpose 2'yi kabul etmemişse, email hash'leme yasak.

Örnek flow tablo:

| Consent Durumu | Cookie Set? | Email Hash? | Match Mekanizması |
|---|---|---|---|
| Granted (Purpose 1+2) | ✓ | ✓ | Cookie + email → %95 match |
| Denied Purpose 1, Granted Purpose 2 | ✗ | ✓ | Email-only → %70 match |
| Denied (tümü) | ✗ | ✗ | IP-based modeling → %40 match |

Email hash olmadan, Google sadece IP + user-agent'a güvenir — match rate %40'a düşer.

## Modeling Loss'u Ölçmek: GA4 Data Quality Raporu

Google Analytics 4'te "Admin > Data Quality" altında "Consent mode impact" widget'ı var. Bu rapor üç metrik gösterir:

1. **Observed conversions**: Granted kullanıcılardan gelen gerçek conversion sayısı
2. **Modeled conversions**: Denied kullanıcılar için tahmin edilen conversion sayısı
3. **Total (observed + modeled)**: Raporlarda gördüğün toplam

Modeling quality kötüyse, "modeled conversions" sayısı toplam conversion'ın %50'sinden fazla olur — bu durumda Google uyarı gösterir: "Modeled traffic high, consider increasing consent rate."

2026 Mayıs verisi (ortalama EEA e-ticaret sitesi): observed %42, modeled %58 dağılımı. Bu sınırda — bir puan daha düşerse, Google Smart Bidding'i "learning" moduna alıyor (bid adjustment durur).

### Modeling Error'ı Holdout Test ile Doğrulamak

Modeling accuracy'yi ölçmek için holdout test yapabilirsin: bir hafta boyunca consent granted user'lardan %10'unu rastgele "denied" gibi işaretle (consent string'i manipüle et, gerçekte consent var ama tag'e `denied` sinyal gönder). Sonra gerçek conversion sayısını Google'ın modellediği sayı ile karşılaştır.

Örnek: 1000 granted user içinden 100'ünü denied'a çevirdin. Gerçekte bu 100 user 15 conversion yaptı. Google modeli 18 conversion tahmin etti → %20 overestimation. Bu, bidding'in agresif olacağı demek (CPA hedefinden %20 yüksek bid verir).

## Consent Rate'i Artırma Taktikleri (Uyum Dahilinde)

Consent rate'i artırmanın iki yolu var: UX optimization ve incentive (ikincisi GDPR gray area).

**UX optimization:**
- **Progressive disclosure**: İlk ziyarette sadece "essential cookies" banner göster, ikinci ziyarette full consent modal aç. İlk ziyaret friction'ını azaltır.
- **Granular toggles**: "Marketing" yerine "Product recommendations" + "Retargeting ads" diye ayır — kullanıcı ilkini kabul edebilir (conversion tracking için yeterli).
- **Banner placement**: Ekranın %30'undan fazlasını kaplatma (GDPR "freely given consent" kuralı — görsel baskı yasaklıyor). Ama tamamen köşe notification'ı da düşük visibility → denge.

2025 Cookiebot A/B test data: banner'ı ekranın altına koyup "Accept all" butonunu mavi (CTA rengi) yapmak, consent rate'i %38'den %44'e çıkardı (n=50,000 user, Almanya).

**Incentive (dikkatli):**
- "Consent verirsen %10 indirim" — GDPR technically yasak (consent freely given olmalı). Ama "newsletter'a kaydol, %10 al" + newsletter'da marketing consent gerekiyor dersen, indirect consent artışı sağlar.
- "Personalized experience için consent ver" — bu kabul edilebilir (çünkü functional açıklama, baskı yok).

## Karşı Argüman: "Modeling Yeterince İyi, Neden Uğraşayım?"

Google'ın söylemi: "Modeling loss artık sorun değil, Smart Bidding modeli hallediyor." 2024 Google Marketing Live'da sunulan veri: consent granted %35 olan bir sitede, modeling sayesinde conversion tracking accuracy %88 (granted-only setup'a göre).

Ancak bu iddia iki varsayıma dayanıyor:
1. **Granted user representative**: Eğer granted kullanıcılar daha genç/teknik/zenginse (ki genelde öyle), model bu bias'ı tüm trafiğe yayıyor.
2. **Traffic volume yeterli**: Günlük 100+ conversion. Küçük siteler için geçerli değil.

Gerçek dünya counter-example: 2025 Q4'te bir SaaS şirketi (Almanya, B2B), %32 consent rate + günlük 40 trial signup görüyordu. Google modeling total signup'ı 68 tahmin etti. Gerçek rakam (CRM'den): 51. %33 overestimation → CPA hedefi %25 aşıldı. Çözüm: sGTM + email hash entegrasyonu ile granted rate'i %45'e çıkardılar (email-based match sayesinde denied user'lar bile kısmen track edildi) — CPA hedefine geri döndü.

Yani: modeling yardımcı oluyor ama her senaryoda yeterli değil. Signal gap'i kapatmak için aktif çaba gerekiyor.

## Şimdi Ne Yapmalı

Consent Mode v2 + TCF 2.2 yapısı artık opsiyonel değil — EEA trafiğin varsa, doğru kurulum yasal zorunluluk. Ama yasal uyum + ölçüm accuracy'si arasında denge kurmak senin elinde. Üç adım:

1. **CMP audit et**: TCF 2.2 + ACM string'lerini doğru üretiyor mu? Consent signal'ı Google tag'lerine iletiliyor mu?
2. **GA4 Data Quality raporunu izle**: Modeled/observed dağılımı %60/%40'ı geçiyorsa, signal gap büyük demek.
3. **Server-side GTM + Enhanced Conversions kur**: ITP/ETP kaybını minimize et, email hash ile match rate'i artır.

Bu üçlü, consent loss'u %50'den %25'e düşürebilir (2026 ortalama retailer verisi). %25 kayıp hala var, ama Smart Bidding'in tolere edebildiği eşik içinde. Modeling accuracy %90'ın üzerinde kalırsa, CPA sapması %5'in altında — o noktada consent + performance dengesini kurmuş oluyorsun.