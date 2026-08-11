---
title: "Server-Side Conversions: Meta CAPI'yi Sıfırdan Doğru Kurmak"
description: "sGTM + Conversion API mimarisi, deduplication mantığı ve event match quality optimizasyonu — iOS 17 sonrası attribution için kanıt-odaklı kurulum."
publishedAt: 2026-08-11
modifiedAt: 2026-08-11
category: marketing
i18nKey: marketing-001-2026-08
tags: [conversion-api, server-side-gtm, meta-ads, attribution, first-party-data]
readingTime: 8
author: Roibase
---

iOS 14.5'ten bu yana browser tabanlı pixel'lar güvenilir sinyal üretmiyor. Meta Pixel'in event loss oranı %30'u geçtiğinde kampanya algoritması kör çalışır. Conversion API bu yüzden isteğe bağlı değil — server-side event akışı olmadan modern paid media çalışmaz. Sorun kurulumun karmaşık olması: sGTM, deduplication, event match quality ve parametre mapping hepsi birlikte doğru oturmalı. Aksi takdirde duplicate event'ler algoritma performansını bozar veya eksik sinyal nedeniyle optimizasyon çöker.

## Conversion API Neden Pixel'dan Farklı

Meta Pixel browser'da çalışır. Safari ITP, Firefox ETP ve consent banner reddi event'leri engeller. iOS Safari'de 7 günlük cookie limiti attribution window'u kısıtlar. 2025 Google analizi %27 browser'ın third-party cookie'yi varsayılan olarak reddettiğini gösteriyor (Statcounter verisi). Pixel tek başına artık %100 event kapsamı sağlamıyor.

Conversion API sunucudan HTTP POST ile event gönderir. Browser limiti yok. User consent'i event gönderimini teknik olarak engellemez (GDPR uyumunu sen garanti edersin — bu teknik doküman). Server-side event'ler deduplication ID ile pixel event'leriyle birleştirilir. Meta algoritması aynı conversion'ı iki kez saymaz ama sinyal kalitesini artırır. Event match quality (EMQ) skoru bu fusion'dan gelir — yüksek EMQ better targeting, daha düşük CPA demektir.

Server-side kurulum ayrıca first-party data kontrolü sunar. Pixel'dan farklı olarak `user_data` nesnesine ek parametreler ekleyebilirsin: `external_id`, `client_user_agent`, `fbc` (click ID), `fbp` (browser ID). Bu zenginleştirilmiş sinyal attribution confidence'ı artırır. Meta dokümantasyonuna göre EMQ skoru 6/10'un üzerine çıktığında kampanya performansı %15-25 iyileşir.

### Event Match Quality Skoru Hesaplanması

Meta'nın event match quality skoru şu parametrelere bakıyor:

| Parametre | Ağırlık | Format |
|---|---|---|
| `em` (email) | Yüksek | SHA-256 hash, lowercase trim |
| `ph` (phone) | Yüksek | E.164 format (+90... gibi) |
| `fn`, `ln` | Orta | SHA-256 hash |
| `client_ip_address` | Orta | IPv4/IPv6 raw |
| `client_user_agent` | Orta | Raw string |
| `fbc`, `fbp` | Yüksek | Click/browser ID |
| `external_id` | Kritik | User CRM ID |

Tüm parametreleri gönderiyorsan EMQ 8-10 arası çıkar. Sadece `em` + `client_ip_address` gönderiyorsan 4-6 arası kalırsın. iOS kullanıcılarında `client_ip_address` proxied olabilir — bu durumda `external_id` ve `fbc` kritik.

## sGTM Üzerinden CAPI Kurulumu

Server-side Google Tag Manager (sGTM) Conversion API için en yaygın mimari. Alternatif olarak doğrudan backend integration mümkün ama sGTM şu avantajları sunar: web client'tan event toplama, deduplication ID yönetimi, birden fazla platform için tek endpoint (Meta, Google, TikTok).

Kurulum adımları:

1. **sGTM container'ı cloud'da ayağa kaldır.** Google Cloud Run veya App Engine recommended. Taobao App Engine gibi shared hosting kullanma — latency yüksek olur.
2. **Client-side GTM'den `dataLayer.push` ile event gönder.** Örnek:

```javascript
dataLayer.push({
  'event': 'purchase',
  'ecommerce': {
    'transaction_id': 'T12345',
    'value': 99.90,
    'currency': 'TRY'
  },
  'user_data': {
    'email_address': 'user@example.com',
    'phone_number': '+905551234567',
    'address': {
      'city': 'Istanbul',
      'country': 'TR'
    }
  }
});
```

3. **sGTM'de Meta Conversion API tag'i kur.** Event Name Mapping: `purchase` → `Purchase`, `add_to_cart` → `AddToCart`. Her event için `event_id` parametresini client-side ile senkronize et — bu deduplication için zorunlu.

4. **`event_id` generation mantığını client-side GTM'de yap.** Benzersiz ID üret (timestamp + random string). Hem pixel'a hem sGTM'e aynı ID'yi gönder:

```javascript
const eventId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);

// Pixel event
fbq('track', 'Purchase', {value: 99.90, currency: 'TRY'}, {eventID: eventId});

// sGTM event
dataLayer.push({
  'event': 'purchase',
  'event_id': eventId,
  ...
});
```

5. **sGTM tag'inde `event_id`'yi CAPI'ye map et.** Meta tag template'inde "Deduplication Event ID" field'ına `{{Event ID}}` variable'ını gir.

Doğru kurulumda Meta Events Manager'da aynı event iki kez görünmez. "Matched Events" sütununda pixel + server event fusion'ı görürsün. EMQ skoru yüksek olursa "Good" veya "Great" badge alırsın.

## Deduplication Mantığı ve Edge Case'ler

Deduplication `event_id` + `event_time` eşleşmesiyle çalışır. Meta 48 saat içinde aynı `event_id` ile gelen event'leri deduplicate eder. Sorun şu senaryolarda ortaya çıkar:

- **Client-side event geç ulaşırsa:** Kullanıcı checkout'tan çıkıp 2 gün sonra döndüğünde browser event'i geç tetiklenebilir. Bu durumda server event zaten gönderilmiş, pixel event'i deduplicate edilemez. Çözüm: `event_time` parametresini transaction timestamp'iyle senkronize et.
- **Offline conversion:** Telefon satışı gibi offline kanalda server event'i manuel göndermen gerekir. `event_time`'ı actual transaction zamanına set et, `event_id`'yi CRM'den çek.
- **Multiple server instance:** Microservice mimarisinde birden fazla backend instance aynı transaction'ı işlerse duplicate event gönderebilir. Çözüm: `event_id`'yi transaction ID'den türet (deterministik hash), idempotency key olarak kullan.

Meta dokümantasyonu event'lerin %95'inin 5 dakika içinde ulaşmasını bekler. 1 saati geçen event'ler attribution window'dan düşebilir. Server event latency'si critical — GCP Cloud Run'da median latency 200ms altında olmalı.

## User Data Parametrelerini Zenginleştirme

CAPI'nin gücü `user_data` nesnesindeki detaydan gelir. Minimum kurulum sadece `em` + `client_ip_address` gönderir ama EMQ skoru düşük kalır. Optimal setup:

| Parametre | Kaynak | Normalizasyon |
|---|---|---|
| `em` | Form input / CRM | Lowercase, trim, SHA-256 |
| `ph` | Checkout form | E.164 format, SHA-256 |
| `fn`, `ln` | Billing form | Lowercase, trim, SHA-256 |
| `ct`, `st`, `zp`, `country` | Address data | Lowercase, no space |
| `external_id` | CRM user ID | Plain text veya hash |
| `client_ip_address` | Request header | Raw IPv4/IPv6 |
| `client_user_agent` | Request header | Raw string |
| `fbc` | URL param `fbclid` | Raw string |
| `fbp` | Cookie `_fbp` | Raw string |

`external_id` özellikle önemli: CRM'deki unique user ID'yi gönderirsen Meta cross-device attribution yapabiliyor. Aynı kullanıcı mobile'dan click edip desktop'tan purchase yaparsa `external_id` sayesinde match ediliyor.

Hash fonksiyonunu doğru kullan:

```javascript
// ❌ Yanlış
const emailHash = btoa(email); // Base64 encoding değil

// ✅ Doğru
const emailHash = sha256(email.trim().toLowerCase());
```

Meta'nın Advanced Matching özelliği pixel tarafında otomatik normalizasyon yapar ama server-side event'lerde SEN normalizasyonu garanti etmelisin.

## Test ve Doğrulama

Meta Events Manager'da "Test Events" tool'u var. sGTM'den test event gönderirken `test_event_code` parametresini ekle:

```javascript
// sGTM tag settings
Test Event Code: TEST12345
```

Events Manager'da test event'leri real-time görürsün. EMQ skoru, matched parameters ve deduplication status burada kontrol edilir.

Production'a geçmeden önce kontrol listesi:

- [ ] En az 1 purchase event pixel + server'dan deduplicated şekilde ulaşıyor mu?
- [ ] EMQ skoru 7/10'un üzerinde mi?
- [ ] `event_time` client timestamp ile 5 saniye içinde mi?
- [ ] PII hash'leri doğru formatta mı? (Meta'nın hash tool'u ile cross-check yap)
- [ ] sGTM latency 500ms altında mı? (Cloud Monitoring'den kontrol et)

CAPI kurulumunu [performans pazarlaması](https://www.roibase.com.tr/tr/ppc) stratejisiyle birleştirmezsen sinyal kalitesi yüksek olsa da kampanya optimize olmaz. Bidding strategy, creative test setup ve audience segmentation ayrı bir mimari gerektirir — CAPI sadece attribution foundation'ı sağlar.

## Conversion Lift ve Attribution Window

Server-side event'ler attribution window'u uzatmıyor ama sinyal kaybını azaltıyor. Meta'nın default attribution window 7-day click / 1-day view. iOS kullanıcılarında pixel'ın 7 günlük sinyal verme olasılığı düşük — browser cookie silinir. Server event ise conversion'ı her durumda yakalar.

Incrementality test ile CAPI'nin lift'ini ölç. Holdout group'ta sadece pixel kullan, test group'ta pixel + CAPI çalıştır. 4 haftalık test peryodunda conversion rate delta %15-25 çıkıyorsa CAPI çalışıyor demektir. Conversion lift olmadan EMQ skoru tek başına anlam ifade etmez — yüksek EMQ ama düşük lift varsa başka bir sorununuz var (creative, offer, audience fit).

Meta'nın Aggregated Event Measurement (AEM) iOS'ta 8 conversion event limiti koyar. CAPI bu limiti kaldırmaz ama pixel event loss'unu telafi eder. iOS kullanıcı oranın %40'ın üzerindeyse CAPI critical.

Server-side event stack'i doğru kurulduğunda kampanya algoritması güvenilir sinyal alır. EMQ skoru 8/10'un üzerine çıktığında CPA %20-30 düşer (Roibase internal case study, e-commerce vertical, 2025 Q4). Kurulum karmaşık görünse de modern paid media'da opsiyonel değil — zorunlu altyapı.