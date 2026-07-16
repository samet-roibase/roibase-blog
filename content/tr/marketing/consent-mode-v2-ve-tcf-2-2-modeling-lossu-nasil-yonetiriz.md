---
title: "Consent Mode v2 ve TCF 2.2: Modeling Loss'u Nasıl Yönetiriz"
description: "GDPR uyumlu ölçüm kaybını minimize etmek için Google'ın consent modeling altyapısını ve TCF 2.2 entegrasyonunu gerçek senaryolarla açıklıyoruz."
publishedAt: 2026-07-16
modifiedAt: 2026-07-16
category: marketing
i18nKey: marketing-006-2026-07
tags: [consent-mode, tcf, gdpr, conversion-modeling, gtm]
readingTime: 8
author: Roibase
---

Google Consent Mode v2 ve IAB TCF 2.2 artık zorunlu. Mart 2024'ten bu yana, EEA + İngiltere trafiğinde Consent Mode olmadan Google Ads remarketing ve audience targeting işlemiyor. Ama yasal uyumu sağladığınızda yeni sorunla karşılaşıyorsunuz: kullanıcıların %40-70'i analytics cookie'sini reddediyor, conversion loss %15-35 arasına çıkıyor. Google'ın consent modeling altyapısı bu kaybı kapatmaya çalışıyor — ama ancak doğru kurulduğunda. Bu yazıda modeling loss'u minimize etmek için implementasyon katmanlarını, TCF entegrasyonunu ve veri kalitesi checklistini gerçek senaryolarla açıklıyoruz.

## Consent Mode v2 Nedir ve Neden Modeling Kaçınılmaz

Google Consent Mode, kullanıcı consent durumunu (granted/denied) platform API'lerine sinyal olarak ileten bir protokol. v2'de iki yeni parametre eklendi: `ad_user_data` (personalization için veri toplanabilir mi) ve `ad_personalization` (remarketing audience'a eklenebilir mi). Bu ikisi olmadan EEA trafiği Google Ads'te persona hedeflemesine giremez.

Consent Mode'un klasik problemi şu: kullanıcı analytics cookie'sini reddederse, Google Analytics conversion event'ini kaydedemiyor. Bu durumda Google Ads kampanyanızın dönüşüm verisi eksik kalıyor — bidding algoritması kör kalıyor. Consent modeling burada devreye giriyor: Google, consent vermeyen kullanıcıların davranışını consent veren benzer cohort'lardan tahmin ederek dönüşüm sayısını modellemeye çalışıyor.

Modeling'in çalışabilmesi için iki kritik girdiye ihtiyacı var: (1) yeterli consent granted veri (günlük en az 100 conversion, ideal 1000+), (2) consent status'ün doğru pinge edilmesi (`gtag('consent', 'update', {...})`). Bu ikisi eksikse modeling "insufficient data" moduna düşüyor ve loss kapanmıyor.

### Modeling Loss'u Etkileyen Faktörler

Google'ın 2024 Q4 documentation'ına göre consent modeling, consent denial oranı %50 civarında olan hesaplarda ortalama %70 recovery sağlıyor. Yani %50 consent loss varsa, modeling bunu %15'e indirebiliyor. Ama bu oran şu değişkenlere bağlı:

- **Consent granted trafik hacmi:** Günlük 100'ün altındaysa model zayıf.
- **CMP implementasyonu:** IAB TCF v2.2 uyumlu CMP (OneTrust, Cookiebot, Usercentrics) doğru purpose + vendor mapping'i yapıyorsa signal kalitesi yükseliyor.
- **Server-side GTM kullanımı:** sGTM ile consent durumu backend'de de kontrol edilebilir, bu first-party context eklediği için modeling girdisini güçlendirir.
- **Conversion type çeşitliliği:** E-ticaret checkout + add-to-cart + pageview birlikte izleniyorsa, model daha geniş funnel'dan öğreniyor.

Modeling zayıf kaldığında, Google Ads bidding stratejisi (Target ROAS, Max Conversions) underperform ediyor çünkü gerçek dönüşüm sinyali eksik. Bunu telafi etmek için offline conversion import veya CAPI (Conversions API) ile backend-to-Google entegrasyonu gerekiyor.

## TCF 2.2 Entegrasyonu: Purpose Mapping ve Vendor List

IAB Transparency and Consent Framework (TCF) 2.2, kullanıcı consent'ini 10 purpose (amaç) kategorisine ayırıyor. Google Ads'in çalışabilmesi için en az Purpose 1 (store/access info) ve Purpose 2 (personalization) gerekli. TCF consent string'i CMP tarafından üretilip `__tcfapi` callback'iyle okunuyor ve GTM tag'ında Consent Mode'a çevriliyor.

Pratikte şöyle çalışıyor: kullanıcı CMP banner'ında "Kabul Et" dediğinde, CMP `tcData.purpose.consents` objesinde `{1: true, 2: true, ...}` set ediyor. Bu obje GTM Custom JavaScript variable'ında okunup şu şekilde map ediliyor:

```javascript
var tcData = window.__tcfapi || {};
var purposes = tcData.purpose.consents;

if (purposes[1] && purposes[2]) {
  gtag('consent', 'update', {
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted'
  });
} else {
  gtag('consent', 'update', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });
}
```

Bu mapping'i yaparken dikkat edilmesi gereken üç nokta var:

1. **Vendor list kontrolü:** Google (vendor ID 755) TCF vendor listesinde varsa ve kullanıcı bunu approve etmişse sinyal verilebilir. Yoksa `ad_storage: 'denied'` kalmalı.
2. **Legitimate interest modeli:** Purpose 2-7-9-10 "legitimate interest" (meşru menfaat) ile de çalışabilir. Türkiye'de bu yasal açıdan riskli — KVKK bu modeli tam tanımıyor.
3. **Consent renewal periyodu:** TCF 2.2'de consent 13 ayda bir yenilenmeli. CMP'nizin otomatik refresh mekanizması yoksa, consent tarih geçince `denied`'a düşmeli.

### CMP Seçimi ve QA Checklist

CMP seçerken TCF 2.2 certification belgesi zorunlu. OneTrust ve Cookiebot sertifikalı, ama config'de custom purpose ekleyip IAB standardını bozabilirsiniz. QA checklist'i:

| Adım | Kontrol Noktası |
|---|---|
| 1 | CMP load sırası: GTM container'dan önce mi? (race condition yok mu?) |
| 2 | `__tcfapi('getTCData', 2, callback)` cevap veriyor mu? |
| 3 | Purpose 1, 2, 7, 9, 10 mapping'i doğru mu? |
| 4 | Vendor 755 (Google) approved mı? |
| 5 | Consent update sonrası GTM Data Layer'a `consent_update` eventi düşüyor mu? |
| 6 | GA4 event'leri `ad_storage: denied` durumunda ping atıyor mu? (consent denied ping zorunlu) |

Adım 6 kritik: consent denied durumunda bile `gtag('event', ...)` ping'i atılmalı, sadece cookie set edilmemeli. Bu ping'ler Google'ın modeling'ine girdi sağlıyor.

## Server-Side GTM ile Hybrid Consent Mimarisi

Consent Mode v2'de sinyal kalitesini artırmanın en etkili yolu, server-side GTM (sGTM) üzerinden "hybrid consent" mimarisi kurmak. Bu modelde:

1. **Client-side:** Kullanıcı consent durumu CMP'den okunup `gtag('consent', 'update', ...)` ile Google'a gönderiliyor.
2. **Server-side:** sGTM container'ına gelen HTTP request'te consent header'ı kontrol ediliyor. Eğer consent granted ise, backend'den gelen server-side event (örn. checkout completion) doğrudan Google Ads Conversion endpoint'ine POST ediliyor.

Bu yaklaşımın avantajı, iOS ATT reddi veya ad blocker kullanan kullanıcılar için bile server-side conversion sinyali gönderilebilmesi. Çünkü server-side event, kullanıcının tarayıcı cookie'sinden bağımsız — backend order ID'sine bağlı. Google bunu `gclid` (Google Click ID) ile match ediyor.

Örnek senaryo: kullanıcı ad blocker kullanıyor, client-side GTM hiç yüklenmedi. Ama checkout'ta backend'iniz sGTM'ye HTTP POST atıyor:

```json
{
  "event_name": "purchase",
  "client_id": "hashed_user_id",
  "gclid": "abc123",
  "value": 250.00,
  "currency": "TRY",
  "consent_ad_storage": "denied"
}
```

sGTM bu event'i Google Ads'e iletirken, `consent_ad_storage: denied` olduğu için cookie set etmiyor ama conversion modellemesine girdi veriyor. Bunu yapmak için sGTM'de Google Ads Conversion Linker tag'ı + server-side Client ID mapping gerekli.

### sGTM Implementasyon Adımları

1. **sGTM container kurun:** Google Cloud Run veya Cloudflare Workers'a deploy edin.
2. **Backend'den event POST edin:** Checkout completion event'ini order ID + gclid + consent flag ile gönderin.
3. **sGTM'de Google Ads tag kurun:** Conversion ID + Conversion Label girin, "User-Provided Data" sekmesinde `client_id` mapping yapın.
4. **Consent enforcement ekleyin:** sGTM Custom Template ile consent check yapın — eğer `ad_user_data: denied` ise, IP maskeleme + user_id hashing zorunlu.

Bu mimaride dikkat edilmesi gereken nokta: GDPR uyumu için backend'den gönderdiğiniz `client_id` SHA-256 hash olmalı. Raw email veya user ID göndermek veri transferi ihlali sayılır.

## Modeling Loss'u Raporlamak ve Optimize Etmek

Google Ads arayüzünde "Conversions > Measurement" sekmesinde "Modeled conversions" kolonu var. Bu kolon, consent denied kullanıcılar için modellenen dönüşüm sayısını gösteriyor. Şöyle okumalısınız:

- **Observed conversions:** Consent granted kullanıcılardan gelen gerçek dönüşüm.
- **Modeled conversions:** Consent denied kullanıcılar için tahmin edilen dönüşüm.
- **Total conversions:** Observed + Modeled toplamı.

Modeling loss'u hesaplamak için basit formül: `(1 - (Modeled / (Toplam Traffic × Consent Denial Rate))) × 100`. Örneğin:

- Toplam trafik: 10,000 click
- Consent denial rate: %50 (5,000 kişi consent denied)
- Observed conversions: 150
- Modeled conversions: 60

Beklenen dönüşüm (consent olmasaydı): `150 × 2 = 300` (çünkü %50'si consent denied). Gerçekte toplamda 210 conversion var (150 + 60). Loss: `(1 - (210 / 300)) × 100 = %30`.

### Modeling'i İyileştirme Taktikleri

Modeling performansını artırmak için şu noktaları optimize edin:

1. **Consent granted trafik hacmini artırın:** CMP banner'ında "Kabul Et" butonunu daha görünür yapın. Ama bu dark pattern sayılabilir — sadece layout iyileştirmesi yapın, kullanıcıyı kandırmayın.
2. **Funnel event'lerini ekleyin:** Sadece purchase değil, add-to-cart, begin_checkout gibi ara event'leri de Google Ads'e gönderin. Model daha geniş intent sinyali yakalar.
3. **Offline conversion import:** Backend'den gerçek order data'sını Google Ads'e import edin. Bu modeling'i bypass eder ama API limit var (günlük 2,000 conversion/hesap).
4. **Enhanced conversions:** Email/phone hash'lerini conversion event'iyle gönderin. Bu first-party match sağladığı için modeling'in doğruluğunu artırır.

Not: Enhanced conversions GDPR açısından gri bölge. Kullanıcı consent vermişse email hash göndermek yasal, ama consent denied ise bu veriyi hash bile olsa göndermek ihlal. Bu yüzden enhanced conversions'ı sadece `ad_user_data: granted` durumunda tetiklemelisiniz.

## Gerçek Dünya Tradeoff'ları: Compliance vs. Performance

Son olarak, consent stratejisinde üç farklı yaklaşımın tradeoff'larını görelim:

| Yaklaşım | Consent Denial Rate | Modeling Recovery | ROAS Impact | GDPR Risk |
|---|---|---|---|---|
| **Strict (pre-checked yok)** | %60-70 | %60-70 | -%25 ROAS | Düşük |
| **Balanced (legitimate interest)** | %40-50 | %70-80 | -%15 ROAS | Orta (Türkiye'de belirsiz) |
| **Aggressive (pre-checked)** | %20-30 | %80-90 | -%5 ROAS | Yüksek (GDPR ihlali) |

Roibase'in tavsiyesi: **Balanced yaklaşım + sGTM.** CMP'de legitimate interest kullanıp Purpose 2-7-9-10'u aktif tutun, ama pre-checked yapma. Server-side GTM ile backend conversion sinyalini Google'a iletin. Bu şekilde consent denial %40-50'de kalır, modeling loss %15 civarında tutulabilir ve [performans pazarlaması](https://www.roibase.com.tr/tr/ppc) kampanyalarınızın bidding gücü korunur.

Consent Mode implementasyonunuz varsa ama modeling çalışmıyorsa, yukarıdaki checklist'i tekrar geçin. Çoğu zaman sorun CMP'nin GTM'den önce yüklenmemesi veya `ad_user_data` parametresinin eksik olmasıdır. Bu tespit için Google Tag Assistant ve sGTM preview mode'u kullanın — consent ping'lerinin gerçek zamanlı akışını görün.