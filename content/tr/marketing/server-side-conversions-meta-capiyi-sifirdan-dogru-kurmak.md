---
title: "Server-Side Conversions: Meta CAPI'yi Sıfırdan Doğru Kurmak"
description: "Meta Conversion API'yi server-side GTM ile kurma rehberi. Event match quality, deduplication ve first-party veri mimarisi — iOS 17 sonrası attribution için zorunlu altyapı."
publishedAt: 2026-07-04
modifiedAt: 2026-07-04
category: marketing
i18nKey: marketing-001-2026-07
tags: [meta-capi, server-side-tracking, gtm, first-party-data, attribution]
readingTime: 8
author: Roibase
---

iOS 14.5'ten bu yana browser-side tracking %60-70 veri kaybı yaşıyor. Meta Pixel'in capture ettiği conversion sayısı gerçek satış sayısının yarısı bile olmayabiliyor. Server-side Conversion API bu boşluğu kapatmanın tek yolu — ama yanlış kurulumlar veriyi kirletir, attribution'ı bozan deduplication hataları yaratır ve algoritma öğrenimini bozar. sGTM + CAPI kurulumu artık post-cookie pazarlama için optional değil, zorunlu altyapı.

## Server-Side Tracking Neden Şimdi Kritik

Browser-side pixel'lar üçüncü parti cookie'lere bağımlıydı. ITP (Safari), ETP (Firefox) ve 2024'teki Chrome Privacy Sandbox bu temeli kırdı. ATT (App Tracking Transparency) ile iOS kullanıcılarının %75'i tracking reddediyor. Sonuç: Ads Manager'da görünen conversion sayısı gerçek satış sayısının %40-50 altında kalıyor. Campaign budget optimization bu eksik veriyle yanlış kanala para aktarıyor.

Server-side conversion tracking bu kayıpları geri kazandırır çünkü browser sınırlamalarının dışında çalışır. First-party domain'inden (örn. `track.brandadi.com`) kendi sunucuna istek atarsın, sunucu Meta'ya HTTP POST gönderir. Bu akışta cookie consent, ad blocker, ITP sorunu yok. Meta'nın 2024 raporuna göre CAPI kullanan advertiser'lar ortalama %38 daha fazla conversion sinyali capture ediyor.

Ama "CAPI kur" demek yetmiyor. Event match quality düşükse Meta eventi kullanıcıyla eşleştiremez. Deduplication yoksa aynı satış hem pixel hem CAPI'den iki kez sayılır. Server-side GTM container'ı yanlış yapılandırılırsa request timeout'lar yaşanır. Burada detay fark yaratır.

## sGTM Container Altyapısını Doğru Kurmak

Server-side Google Tag Manager (sGTM) CAPI'nin altyapısı. Browser'dan sunucuna veri gönderen proxy katmanı. Cloud Run (GCP) veya App Engine üzerinde host ediyorsun, custom subdomain ile erişilir hale getiriyorsun.

İlk adım: Cloud Run container deployment. Google'ın resmi `gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable` image'ını kullan. Minimum 2 CPU, 2GB RAM — traffic spike'larda scale etmeye hazır olmalı. Tagging Server URL'ini `https://track.brandadi.com` gibi first-party subdomain'e yönlendir (CNAME kaydıyla). Third-party domain kullanırsan cookie lifetime kısalır, Safari ITP yine kapar.

sGTM container'da **GA4 Client** ve **Meta Conversion API Tag** kur. GA4 Client browser'dan gelen `/g/collect` requestlerini dinler, event payload'unu parse eder. Meta CAPI Tag bu payload'u Meta Pixel Event ID'siyle eşleştirip `https://graph.facebook.com/v21.0/{pixel-id}/events` endpoint'ine gönderir. Bu noktada access token güvenliği kritik — container variable'ına kaydet, repo'ya commit etme.

```javascript
// sGTM Custom Variable — Event Match Quality için user_data zenginleştirme
const eventData = {
  event_name: data.event_name,
  event_time: Math.floor(Date.now() / 1000),
  event_id: data.event_id, // deduplication için zorunlu
  user_data: {
    em: data.user_data.email_address ? hashSHA256(data.user_data.email_address) : undefined,
    ph: data.user_data.phone_number ? hashSHA256(data.user_data.phone_number) : undefined,
    fn: data.user_data.first_name ? hashSHA256(data.user_data.first_name) : undefined,
    ln: data.user_data.last_name ? hashSHA256(data.user_data.last_name) : undefined,
    external_id: data.user_data.external_id, // customer_id (hashed)
    client_ip_address: data.ip_override,
    client_user_agent: data.user_agent,
    fbc: data.user_data.fbc, // _fbc cookie
    fbp: data.user_data.fbp  // _fbp cookie
  },
  custom_data: {
    currency: data.currency,
    value: parseFloat(data.value)
  },
  action_source: 'website'
};
```

Bu hash işlemi sGTM'de SHA-256 template variable'ıyla yapılmalı — client-side hash'lemek GDPR açısından riskli. IP address'i `req.headers['x-forwarded-for']` header'ından otomatik oku, server-side GTM bunu capture edebiliyor.

## Event Match Quality ve Deduplication Mimarisi

Meta Conversion API'nin başarısı Event Match Quality (EMQ) skoruna bağlı. EMQ 0-10 arası bir skor — 7+ iyi, 9+ mükemmel. Düşük EMQ: Meta eventi kullanıcıya eşleştiremez, campaign optimization'a girmiyor.

EMQ'yu artırmak için **en az 4 identifier** gönder:
1. `em` (email, SHA-256 hashed)
2. `external_id` (CRM customer ID, hashed)
3. `fbp` (_fbp cookie — browser'dan al)
4. `client_ip_address` + `client_user_agent`

Email ve `external_id` en güçlü matcher'lar. Eğer checkout flow'unda email capture ediyorsan bu veriyi DataLayer'a push et, sGTM oradan alsın. Örnek GTM DataLayer push (checkout sayfasında):

```javascript
window.dataLayer.push({
  event: 'purchase',
  event_id: 'txn_' + orderId, // unique ID — deduplication için
  user_data: {
    email_address: customerEmail, // plaintext — sGTM hash'leyecek
    phone_number: customerPhone,
    first_name: customerFirstName,
    last_name: customerLastName,
    external_id: customerId
  },
  ecommerce: {
    currency: 'USD',
    value: 149.99,
    transaction_id: orderId
  }
});
```

Deduplication için **event_id** kritik. Browser-side Pixel ile server-side CAPI aynı `event_id` gönderirse Meta ikisini tek event sayar. `event_id` formatı: `{event_name}_{timestamp}_{order_id}` gibi unique olmalı. Eğer aynı purchase event'i hem pixel hem CAPI gönderiyor ama `event_id` farklıysa Meta iki ayrı satış sayar — ROAS %100 şişer.

Meta Event Manager'da Diagnostics > Event Match Quality'de breakdown inceleyebilirsin. Eğer `em` field'i %30 match ediyorsa email capture stratejini gözden geçir. `fbp` %90+ olmalı — düşükse cookie consent banner'ın pixel load'ı engelliyor demektir.

## Conversion Lift Test ile Doğrulama

CAPI kurulumunu test etmeden live'a almak hata. Meta Conversion Lift çalıştır: audience'inin %10'unu holdout grubuna al, onlara CAPI sinyali gönderme. 14 gün sonra holdout grubun conversion rate'ini exposed grubunkiyle karşılaştır. İstatistiksel olarak anlamlı lift yoksa CAPI signal quality'nin sorunu var demektir.

Lift test için minimum 10,000 impression gerekiyor (Meta'nın kılavuzuna göre). Test süresi: en az 2 hafta — daha kısa periyotlar variance yüzünden sonuç vermez. Lift sonucu +%15 civarındaysa CAPI doğru çalışıyor. +%5'in altı gürültü seviyesi — muhtemelen browser-side Pixel zaten yeterli sinyali capture ediyordu.

Eğer lift test negatif çıkarsa olası sebepler:
- Deduplication hatası — aynı event iki kez sayılıyor, algoritma kafası karışıyor
- EMQ düşük — Meta eventi match edemiyor
- sGTM timeout — server response 3 saniyeyi geçiyor, Meta request'i drop ediyor

Timeout sorunu için Cloud Run'da **request concurrency** ayarını 80'e çek, otomatik scaling'i aktif et. Yüksek traffic sitelerinde sGTM container'ı multi-region deploy et (örn. us-central1 + europe-west1).

## Campaign Budget Optimization ve Attribution Window Stratejisi

CAPI kurduktan sonra Meta'nın campaign budget optimization (CBO) algoritması daha temiz veri alır. Önceden iOS kullanıcılarından gelen conversion'lar kayıp olduğu için CBO Android'e ağırlık veriyordu. Server-side signal gelince iOS conversion'ları da görünür hale geliyor — budget dağılımı düzeliyor.

Attribution window ayarını gözden geçir. Meta varsayılan 7-day click, 1-day view kullanıyor. Eğer satış döngün uzunsa (örneğin B2B, 30+ gün) attribution window'u genişlet: 28-day click. Ama dikkat — geniş window last-touch bias yaratır, üst funnel kanalların katkısını maskeleyebilir. Incrementality testi yaparak her kanalın gerçek lift'ini ölç.

First-party veri altyapısı CAPI'yi beslemek için kritik. Eğer customer data platform (CDP) veya CRM entegrasyonun yoksa CAPI'nin potansiyelinin %50'sini kullanıyorsun demektir. [Performans pazarlaması](https://www.roibase.com.tr/tr/ppc) stack'ini bu veri mimarisine göre kurmazsan signal quality duvarına çarparsın.

## BigQuery ile Conversion Verification Pipeline'ı

CAPI'den gönderilen event sayısı ile Meta Ads Manager'da görünen conversion sayısı arasında %5-10 fark normal (processing delay + validation). %20+ fark varsa sorun var demektir. Bunu doğrulamak için BigQuery'de verification pipeline kur.

sGTM container log'larını BigQuery'ye stream et (Cloud Logging sink ile). Meta CAPI response code'larını parse et — 200 OK ise event delivered, 400 ise validation error. Örnek BigQuery sorgusu:

```sql
SELECT
  DATE(timestamp) AS event_date,
  event_name,
  COUNT(*) AS sent_count,
  COUNTIF(response_code = 200) AS delivered_count,
  COUNTIF(response_code >= 400) AS error_count,
  ROUND(SAFE_DIVIDE(COUNTIF(response_code = 200), COUNT(*)) * 100, 2) AS delivery_rate
FROM `project.dataset.sgtm_logs`
WHERE event_name IN ('Purchase', 'AddToCart', 'InitiateCheckout')
  AND DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY event_date, event_name
ORDER BY event_date DESC;
```

Delivery rate %95'in altındaysa Meta API hatası veya sGTM timeout var. Error_count detayına bak — sık görülen hatalar:
- `(#100) Invalid parameter` — user_data field'i eksik veya format yanlış
- `(#190) Application rate limit` — dakikada 100+ event gönderiyorsun, batch request kullan
- `(#2) Invalid access token` — token expire olmuş

Batch request kullanımı traffic yükü azaltır. 50 event'i tek HTTP POST'a paketleyebilirsin (Meta CAPI limit 1000 event/request). sGTM'de custom tag template'i ile batch queue kur.

## Uzun Dönem Strateji: Modeled Conversions ve Privacy-Safe Attribution

Meta modeled conversions (makine öğrenmesiyle tahmin edilen conversion'lar) CAPI signal quality'sine doğrudan bağlı. Yüksek EMQ = daha doğru modelleme. 2025 itibarıyla Meta reported conversion'ların %30-40'ı modeled (Meta Earnings Q4 2024). Bu oran artacak — çünkü browser signal azalıyor.

Privacy-safe attribution için Aggregated Event Measurement (AEM) kullan. iOS 14.5+ cihazlarda SKAdNetwork sınırlı veri veriyor (24 saat delay, 64 conversion value bucket). AEM, server-side signal ile iOS conversion'larını aggregate düzeyde raporluyor — kullanıcı-bazlı değil, cohort-bazlı. CAPI bu aggregate signal'i besliyor.

Uzun dönem için first-party data strategy zorunlu. Email capture rate'ini artır (örn. checkout'ta %80+ email alıyorsan CAPI EMQ'su %40 yükselir). Customer lifetime value (LTV) prediction modeli kur — yüksek LTV segmentine Meta'da value-based lookalike audience oluştur. Bu strateji [dönüşüm oranı optimizasyonu](https://www.roibase.com.tr/tr/cro) süreçleriyle birleştiğinde compound etkisi %60+ revenue artışı yaratabilir.

Server-side Conversion API kurmak artık "nice-to-have" değil. iOS privacy enforcement, Chrome cookie deprecation ve platform-bazlı attribution kısıtlamaları browser-side tracking'i kullanılamaz hale getirdi. sGTM + CAPI mimarisi doğru kurulduğunda — yüksek EMQ, temiz deduplication, BigQuery verification pipeline ile — post-cookie pazarlama stack'inin omurgası oluyor. Test et, ölç, incrementality doğrula. Veri mimarisini mühendislik disipliniyle kur.