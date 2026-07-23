---
title: "Server-Side Conversions: Meta CAPI'yi Sıfırdan Doğru Kurmak"
description: "iOS privacy değişiklikleri sonrası Meta CAPI ve sGTM mimarisini doğru kurmak için event match quality, deduplication ve signal stratejileri."
publishedAt: 2026-07-23
modifiedAt: 2026-07-23
category: marketing
i18nKey: marketing-001-2026-07
tags: [meta-capi, server-side-gtm, conversion-api, event-match-quality, attribution]
readingTime: 8
author: Roibase
---

iOS 14.5'ten beri Meta'nın pixel'ı veri kaybediyor. ATT opt-in oranları %25 civarında sabitlendi, browser tracking kısıtlamaları genişledi, cookie lifetime'lar kısaldı. Sonuç: Pixel'dan gelen conversion sinyali haftada %40-60 eksik. Meta'nın algoritması körleşiyor, ROAS optimizasyonu bozuluyor. Server-side Conversions API (CAPI) artık opsiyonel değil — doğru kurulduğunda signal kaybını %80'e kadar telafi ediyor.

## Meta CAPI'nin Çalıştığı Nokta

Meta CAPI pixel'ın alternatifi değil — tamamlayıcısı. Pixel browser üzerinden client-side data gönderir, CAPI sunucundan server-side. İkisi paralel çalışır, Meta tarafında deduplicate edilir. Deduplication için her event'e aynı `event_id` verilmesi gerekiyor — pixel ve CAPI'den gelen aynı conversion'ı Meta tek bir sinyal olarak işler.

CAPI'nin kazandırdığı 3 kritik avantaj var: (1) Browser tracking kısıtlamalarından bağımsız çalışır — iOS ATT, ITP, cookie block hepsi bypass edilir. (2) Server tarafında sahip olduğunuz first-party data eklenebilir — CRM'den gelen email hash, telefon, adres gibi PII bilgileri event'e eklenir, event match quality (EMQ) yükselir. (3) Conversion penceresi uzatılabilir — pixel 7 günle sınırlı, CAPI ile 28 güne kadar conversion'ı yakalarsınız.

EMQ Meta'nın bir event'i doğru kullanıcıya ilişkilendirme başarısını ölçer. 0-10 skalasında, 6 altı zayıf, 7-8 iyi, 9+ mükemmel. EMQ düşükse Meta attribution yapamıyor, o conversion sinyal olarak kullanılamıyor. Yükseltmek için birden fazla identifier göndermeniz lazım: email (SHA-256 hash), telefon (E.164 format hash), user agent, IP, fbc/fbp cookie, external_id (CRM ID). Aynı event'e 4-5 farklı identifier eklediğinizde EMQ 9'a yaklaşıyor.

## Server-Side GTM (sGTM) ile Altyapı Mimarisi

CAPI'yi manuel backend'den göndermek mümkün ama scalable değil — her event için ayrı HTTP request, deduplication manuel yönetilir, hata handling karmaşıklaşır. sGTM bu stack'i standardize ediyor. Google Tag Manager'ın server container'ı — client tarafından gelen event'leri yakalayıp transformation yapıp Meta CAPI'ye, GA4'e, TikTok Events API'ye paralel gönderir.

Mimari şöyle: (1) Client-side GTM tarayıcıda olay yakalar (`dataLayer.push`). (2) Client container event'i sGTM endpoint'ine POST eder. (3) sGTM container event'i alır, enrichment yapar (server-side cookie okur, CRM'den data çeker), deduplicate için `event_id` ekler. (4) Meta CAPI tag event'i Meta'ya HTTP POST olarak gönderir. (5) Aynı event aynı `event_id` ile pixel'dan da gelirse Meta tek sinyal sayar.

sGTM'i kendi domain'inizde host etmelisiniz — `gtm.yourdomain.com` gibi. Meta'nın algoritması event URL'ini okur, first-party domain görürse event_score yükselir (3rd-party script blockerlar bypass edilir, cookie lifetime uzar). Cloud Run, App Engine ya da GCP tarafından managed sGTM container kullanabilirsiniz. Aylık maliyet trafiğe göre $50-500 arası.

### Deduplication Mantığı

Deduplication için `event_id` oluşturma stratejisi kritik. Rastgele UUID kullanmayın — aynı event client ve server'dan geldiğinde aynı ID olmalı. Best practice: `{user_id}_{event_name}_{timestamp_rounded_to_minute}` gibi deterministik bir hash. Örnek: kullanıcı ID 12345, event `Purchase`, timestamp 2026-07-23 14:32:18 ise `event_id = hash(12345_Purchase_202607231432)`.

Bu sayede aynı kullanıcının aynı dakikada tetiklediği Purchase event'i hem pixel hem CAPI'den geldiğinde Meta aynı ID'yi görür, tek sayar. Timestamp minute'a yuvarlanmazsa milisaniye farkı yüzünden dedup bozulur.

## Event Match Quality'yi 9'a Çıkarmak

EMQ düşük kalıyorsa attribution bozuk demektir. Meta Events Manager'da her event için EMQ skoru görünür. 6 altındaysa acil müdahale gerek. Yükseltme stratejisi:

1. **Email hash ekleyin:** Kullanıcı login olduysa email adresini SHA-256 ile hashleyip `user_data.em` parametresine ekleyin. Meta bu hash'i kendi user database'i ile eşleştirir.
2. **Telefon hash ekleyin:** `user_data.ph` parametresi — E.164 formatında (+90 prefix ile), SHA-256 hash.
3. **Client IP ve User Agent:** CAPI event'ine `user_data.client_ip_address` ve `user_data.client_user_agent` ekleyin. sGTM bu değerleri client request'inden otomatik çekebilir.
4. **fbc ve fbp cookie:** Meta'nın click ID'si (fbc) ve browser ID'si (fbp) cookie'lerini okuyup gönderin. sGTM bu cookie'leri first-party domain sayesinde okuyabilir.
5. **external_id:** CRM'deki kullanıcı ID'sini `user_data.external_id` olarak gönderin. Meta bu ID'yi cross-device graph'inde kullanır.

Örnek event payload (sGTM'den Meta CAPI'ye gönderilen):

```json
{
  "event_name": "Purchase",
  "event_time": 1721741538,
  "event_id": "abc123_Purchase_202607231432",
  "event_source_url": "https://shop.yourdomain.com/checkout",
  "user_data": {
    "em": "7d8c8fbb1f3e6e0f3...",
    "ph": "9b6e2f1a3d5e8c...",
    "client_ip_address": "185.42.12.34",
    "client_user_agent": "Mozilla/5.0...",
    "fbc": "fb.1.1625012345678.AbCdEfGhIj",
    "fbp": "fb.1.1625012345678.1234567890",
    "external_id": "CRM-12345"
  },
  "custom_data": {
    "currency": "USD",
    "value": 99.99
  }
}
```

Bu payload 6 farklı identifier içeriyor — EMQ 9'a yaklaşır. Meta bu sinyalle conversion'ı doğru kullanıcıya ilişkilendirebilir, kampanya optimizasyonu bozulmaz.

## Signal Stratejisi ve Incrementality

CAPI kurulduktan sonra Meta Events Manager'da "Event Match Quality" ve "Events Received" grafiğini izleyin. Pixel+CAPI event sayısı artmalı (deduplicate edilmiş toplam), EMQ ortalaması 7+ olmalı. İlk 2 hafta attribution window'u uzadığı için görünen conversion sayısı %20-30 artabilir — bu "inflated" değil, kayıp olan sinyalin geri gelmesi.

Gerçek lift'i ölçmek için geo-holdout test yapın. Bazı coğrafyalarda sadece pixel, bazılarında pixel+CAPI çalıştırın, ROAS farkını ölçün. Meta'nın Conversion Lift çalışması da bu mantıkla çalışır ama manuel kontrol daha güvenilir.

CAPI'nin ROI'si genelde 3-6 ay içinde net görünür. iOS kullanıcı oranı yüksek segmentlerde (ABD, Batı Avrupa) daha hızlı kazanç sağlar. Android-ağırlıklı pazarlarda signal kaybı düşük olduğu için CAPI kazancı daha az ama gene de EMQ yükselmesi algoritma performansını artırır.

## Teknik Tuzaklar ve Çözümler

**Tuzak 1:** sGTM'i 3rd-party domain'de host etmek (`gtm-abc123.appspot.com` gibi). Meta bu domain'i tanımaz, event_score düşer, cookie lifetime kısa kalır. **Çözüm:** Kendi domain'inizde CNAME ile sGTM'i point edin (`gtm.yourdomain.com`).

**Tuzak 2:** `event_id` üretmeden event göndermek. Meta dedup yapamaz, aynı conversion 2 kere sayılır, ROAS şişer (sahte optimizasyon). **Çözüm:** Her event için deterministik ID üretin.

**Tuzak 3:** PII bilgileri hash'lemeden göndermek. Meta raw email kabul etmez, event reddedilir. **Çözüm:** SHA-256 hash + lowercase normalize (email'i `trim().toLowerCase()` yapıp hashleyin).

**Tuzak 4:** `event_source_url` parametresini göndermemek. Meta event'in nereden geldiğini bilemez, domain verification'dan geçemez. **Çözüm:** Her event'e `event_source_url` ekleyin, checkout sayfası URL'si olmalı.

**Tuzak 5:** Timestamp'i gelecek zaman olarak göndermek. Meta event'i reddeder. **Çözüm:** Unix epoch formatında (saniye cinsinden), server time kullanın (`Math.floor(Date.now() / 1000)`).

Bu tuzakları aşmak için sGTM'de Preview Mode kullanın — Meta'ya gitmeden önce payload'u görürsünüz, hata varsa düzeltirsiniz.

## Sonraki Adım: Multi-Platform Stack

CAPI'yi doğru kurduktan sonra aynı mimariyi TikTok Events API, Snapchat CAPI, Google Ads Enhanced Conversions'a yaygınlaştırın. sGTM tek bir event'i paralel şekilde tüm platformlara gönderir — aynı `event_id` her yerde dedup için kullanılır, cross-platform attribution tutarlı kalır.

Meta CAPI + sGTM stack'i artık [performans pazarlaması](https://www.roibase.com.tr/tr/ppc) altyapısının temeli. Signal kaybını telafi ediyor, EMQ'yu yükseltiyor, algoritma optimizasyonunu geri getiriyor. iOS privacy duvarını aşmanın tek engineering yolu bu.