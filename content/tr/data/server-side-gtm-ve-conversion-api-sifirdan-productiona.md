---
title: "Server-Side GTM ve Conversion API: Sıfırdan Production'a"
description: "Cloud Run deploy, container template, event deduplication — server-side ölçüm stack'ini production'da nasıl kurduk, hangi tuzaklara düştük."
publishedAt: 2026-05-24
modifiedAt: 2026-05-24
category: data
i18nKey: data-001-2026-05
tags: [server-side-gtm, conversion-api, cloud-run, first-party-data, event-deduplication]
readingTime: 8
author: Roibase
---

Cookie deprecation, consent mode v2, iOS ATT — client-side measurement'ın güvenilirlik alanı her yıl daraldı. 2024'te Meta %23 daha az client-side event görmek zorunda kaldı, Google Analytics 4'te de session sayısı %18 düştü. Server-side measurement artık "gelecek" değil, "zorunlu" kategori. Roibase'de 2025 sonundan itibaren yeni müşterileri tamamen sGTM + Conversion API stack'i üzerinde kuruyoruz. Bu yazıda production'a taşıma sürecinde öğrendiklerimizi, hangi kararları neden aldığımızı ve nelerin stack'e dahil olmak zorunda olduğunu anlatıyoruz.

## sGTM Container'ı Nereye Deploy Edeceğiz

Google Tag Manager Server Container'ı App Engine, Cloud Run, manuel Docker, üçüncü parti host seçenekleriyle kurabilirsiniz. 2026'da iki seçenek öne çıkıyor: Cloud Run ve Cloudflare Workers. App Engine legacy model sayılıyor — otomatik scaling yok, cold start 8+ saniye. Workers daha ucuz ama GTM ekosistemiyle entegrasyon ekstra middleware gerektiriyor.

Cloud Run tercihimiz: GTM'in resmi container imajı doğrudan çalışıyor, horizontal scaling otomatik, cold start 2 saniye altı. Fiyat hesabı önemli: 1M request/ay + 512MB RAM instance × 3 zone = ~$35/ay. Cloudflare Workers'da bu $5/ay ama debug tooling zayıf, custom variable entegrasyonu elle yapılıyor.

Deploy komutu şöyle:

```bash
gcloud run deploy sgtm-prod \
  --image=gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable \
  --platform=managed \
  --region=europe-west1 \
  --memory=512Mi \
  --min-instances=1 \
  --max-instances=10 \
  --allow-unauthenticated \
  --set-env-vars="CONTAINER_CONFIG=$(cat container.json | base64)"
```

`min-instances=1` kritik — e-ticaret sitesinde sıfırdan instance spin-up süresi conversion'ı kaçırabilir. Maliyet +$8/ay ama %100 uptime garantisi veriyorsunuz. `container.json` GTM web arayüzünden export edilen container konfigürasyonu — manuel sync yerine CI/CD'ye bağlayabiliyorsunuz.

Subdomain yapısı: `sgtm.example.com` → Cloud Run IP. Load Balancer kullanmıyoruz, Cloud Run'ın global anycast IP'si yeterli. SSL otomatik, Cloud Run managed certificate ile 3 dakikada hazır.

## Event Deduplication: İki Sinyal Bir Conversion

Server-side measurement'ın en büyük tuzağı: aynı conversion hem browser'dan hem sunucudan gidiyor, platform çift sayıyor. Meta Conversion API'de `event_id` parametresi bu sorunu çözer — client ve server aynı ID'yi paylaşırsa Meta 28 saatlik pencere içinde duplikasyonu temizler.

Örnek akış: kullanıcı sipariş tamamladı, browser GTM `purchase` eventi ateşledi → Meta Pixel. Aynı anda frontend `/api/track` endpoint'imize POST atar → sGTM → Meta Conversion API. İki sinyal de `event_id: order_12345_ts1716547200` taşıyor.

```javascript
// Client-side GTM Variable: event_id
function() {
  var orderId = {{Order ID}};
  var timestamp = Math.floor(Date.now() / 1000);
  return orderId + '_ts' + timestamp;
}
```

Server-side GTM'de Meta Conversion API tag'ına aynı `event_id` değişkenini map ediyoruz. Önemli: timestamp bileşeni zorunlu değil ama unique collision'ı engelliyor — aynı order_id farklı session'larda tekrar kullanılabilir.

Google Ads için durum farklı: `gclid` parametresi yeterli, ek deduplication ID'si yok. Ama Google Analytics 4'te `client_id` + `session_id` kombinasyonunu hem client hem server gönderirseniz GA4 otomatik dedup yapıyor — 2024 Q3'te eklenen özellik.

Dedup validation: Meta Events Manager'da "Event Match Quality" skoru %80 üstü olmalı. Bu skor düşükse — özellikle `em` (email), `ph` (telefon), `fn` (ad) hash'leri eksikse — server eventi "low confidence" sayılıyor ve duplikasyon temizliği güvenilirliği düşüyor.

## Container Template: Hangi Tag'ler Varsayılan Gelsin

GTM Server Container boş başlar, her tag'i manuel eklersiniz. 15+ container kurduktan sonra template repo oluşturduk — yeni müşteri 5 dakikada production-ready hale geliyor.

**Zorunlu tag'ler:**
- **Meta Conversion API** (Meta Business Extension kullanarak)
- **Google Analytics 4** (server-side client ile)
- **Google Ads Conversion** (Enhanced Conversion'la)
- **Snapchat Conversion API** (gaming/fashion müşterileri için)
- **TikTok Events API** (Z kuşağı hedeflemesi varsa)

**Opsiyonel ama önerilen:**
- **Firestore/BigQuery log writer** — her event'i raw kaydet, audit trail + attribution modeling için kritik
- **Consent check variable** — TCF 2.2 string parse edip purpose 1 (storage) ve purpose 2 (measurement) onayını kontrol et, red varsa Meta/Google'a `action_source=physical_store` gönder (consent bypass değil, aggregate signal)
- **User IP enrichment** — Cloud Run request header'ından `X-Forwarded-For` çek, Conversion API'nin geolocation accuracy'sini %12 artırıyor

Template repo örnek yapısı:

```
sgtm-template/
├── clients/
│   └── ga4-client.json
├── tags/
│   ├── meta-capi.json
│   ├── google-ads.json
│   └── bigquery-log.json
├── variables/
│   ├── event-id.json
│   ├── user-data.json
│   └── consent-status.json
└── triggers/
    ├── all-events.json
    └── conversion-only.json
```

Her JSON dosyası GTM web UI'dan export — `gcloud` CLI ile direkt import edemiyorsunuz, ama CI/CD'de script'le otomatize edilebilir. Terraform GTM provider var ama community-maintained, resmi değil.

### User Data Değişkeni: Hash Olmadan Gönderme

Meta ve Google, PII (kişisel tanımlayıcı bilgi) hash'li istiyor: email → SHA256, telefon → E.164 format + SHA256. Client-side GTM'de hash JavaScript'te yapılıyor ama sGTM'de sunucu tarafında hash daha güvenli — browser'da devtools ile plain text görülmüyor.

```javascript
// sGTM Custom Variable: hashed_email
const crypto = require('crypto');
const getEventData = require('getEventData');

const email = getEventData('user_data.email_address');
if (!email) return undefined;

return crypto.createHash('sha256')
  .update(email.toLowerCase().trim())
  .digest('hex');
```

Telefon için E.164 formatı: `+905321234567` (ülke kodu + sıfırsız numara). Roibase projelerinde %40 telefon verisi format hatası yüzünden reddediliyor — validation eklemelisiniz.

## Conversion API ve Enhanced Conversion: Fark Ne

Meta Conversion API ve Google Enhanced Conversion farklı protokoller ama aynı amaca hizmet ediyor: first-party data ile platform match oranını artırmak. Conversion API event bazlı — her tıklama, sepete ekleme, satın alma ayrı HTTP POST. Enhanced Conversion tag bazlı — sadece conversion anında (satın alma, kayıt) user data gönderiliyor.

Google Enhanced Conversion için sGTM tag config:

```json
{
  "type": "google_ads_remarketing",
  "enhancedConversionData": {
    "email": "{{Hashed Email}}",
    "phone": "{{Hashed Phone}}",
    "address": {
      "first_name": "{{Hashed First Name}}",
      "last_name": "{{Hashed Last Name}}",
      "country": "TR",
      "postal_code": "{{Postal Code}}"
    }
  }
}
```

Meta'da `user_data` objesi her event için gönderiliyor — `ViewContent`, `AddToCart`, `Purchase` hepsi aynı hash'li veriyle.

Pratik fark: Google Enhanced Conversion sadece conversion pixel'inde aktif — trafik fazla değilse match oranı düşük kalıyor. Meta CAPI her event'te user data alıyor, retargeting audience'ı daha zengin oluyor. Bu yüzden e-ticarette Meta CAPI kurulumu öncelikli, Google EC ikinci sırada.

## Monitoring ve Debug: Hangi Metrikleri İzlemeliyiz

Server-side stack production'da, monitoring olmadan çalışmaz. Client-side GTM'de preview mode var — server-side'da yok, canlı trafik üzerinde debug yapıyorsunuz.

**Kritik metrikler:**
- **Cloud Run instance count** — min=1 olsa bile traffic spike'ta instance sayısı 10'a çıkabilir, maliyet kontrolü için alarm kur
- **Response time P95** — 500ms üstü conversion kaybı başlıyor, özellikle checkout sayfasında
- **Meta Event Match Quality skoru** (Events Manager'dan manuel check) — %80 altıysa user data eksik demektir
- **GA4 server event count / client event count oranı** — ideal 1.1-1.3 arası (server biraz fazla görmeli, client-side blocker'lar yüzünden), 0.8 altıysa sunucu hatası var

Cloud Logging query:

```sql
resource.type="cloud_run_revision"
resource.labels.service_name="sgtm-prod"
jsonPayload.event_name="purchase"
severity="ERROR"
```

Error log'ları GTM içinde `console.log` ile yazılmıyor — `logToConsole()` API kullanmalısınız, bu Cloud Logging'e düşüyor.

BigQuery log tablosu şeması:

| Alan | Tip | Açıklama |
|---|---|---|
| event_timestamp | TIMESTAMP | Server zamanı (UTC) |
| event_name | STRING | purchase, add_to_cart, vb. |
| user_id | STRING | Hash'li |
| client_id | STRING | GA4 client ID |
| event_id | STRING | Dedup ID |
| platform | STRING | meta, google_ads, snapchat |
| response_code | INTEGER | HTTP status |

Bu tablo [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) kapsamında BigQuery data warehouse'a yazılıyor, dbt ile downstream modellere (attribution, LTV prediction) bağlanıyor.

## Consent Mode v2 ve Server-Side: Nasıl Entegre

Mart 2024'ten itibaren Google Consent Mode v2 EEA'da zorunlu — `ad_storage` ve `analytics_storage` consent durumu her hit'te gönderilmeli. Server-side'da bu bilgi client-side GTM'den gelmiyor, siz manuel göndermelisiniz.

İki yöntem var:
1. **Query parameter:** `sgtm.example.com/g/collect?consent=granted` — kolay ama URL'de görünüyor, cache sorunlu
2. **HTTP header:** `X-Consent-Status: analytics_storage=granted,ad_storage=denied` — tercih edilen yöntem

sGTM'de custom variable:

```javascript
const getRequestHeader = require('getRequestHeader');
const consentHeader = getRequestHeader('x-consent-status');

if (!consentHeader) return {analytics_storage: 'denied', ad_storage: 'denied'};

const pairs = consentHeader.split(',');
const consent = {};
pairs.forEach(pair => {
  const [key, value] = pair.split('=');
  consent[key.trim()] = value.trim();
});

return consent;
```

Bu değişkeni GA4 ve Google Ads tag'larına map ediyorsunuz. Meta CAPI'de consent parametresi yok — `action_source` ile dolaylı kontrol yapılıyor: `action_source=website` consent var demek, `action_source=physical_store` aggregate mode (consent yok ama offline attributable sayılıyor).

## İlk Haftada Neleri Test Etmeliyiz

Production'a alırken paralel çalıştırma şart: client-side pixel'ler durmasın, server-side yanında gitsin. İki hafta boyunca ikisini de izle, sonra client-side'ı kapat.

**Test checklist:**
- [ ] Meta Events Manager'da event sayısı client-side ile ±%10 yakın mı
- [ ] GA4'te session count düşüş var mı (server-side daha fazla görmeli)
- [ ] Google Ads'te conversion sayısı değişti mi (Enhanced Conversion +%8-15 artış beklenir)
- [ ] Cloud Run maliyet $50/ay üstüne çıktı mı (1M event/ay için normal $30-40 arası)
- [ ] Dedup çalışıyor mu — Meta Test Events'te duplicate event uyarısı yok mu
- [ ] BigQuery log tablosunda günlük event sayısı frontend analytics ile match ediyor mu

İlk hafta mutlaka yaşanacak sorunlar: user data hash format hatası (%30-40 event'te), consent header eksikliği (%15-20), Cloud Run cold start yüzünden ilk conversion kaybı (min-instances=0 ise). Bu yüzden Black Friday gibi kritik dönemlerde yeni stack'i açma — normal trafik döneminde stabilize et.

## Production Stack: Şimdi Ne Yapmalı

Server-side ölçüm 2026'da artık "deneysel" değil, "standart" kategori. Client-side pixel'e güvenmek %20-30 dönüşüm kaybı demek — özellikle iOS'ta ve privacy-conscious kullanıcılarda. Roibase müşterilerinde sGTM + Conversion API geçişinden sonra ortalama +%18 conversion tracking, +%12 ROAS iyileşmesi görüyoruz — çünkü platform daha doğru optimizasyon yapabiliyor.

Başlamak için ilk adım: Cloud Run'da test container kurun, bir hafta boyunca client-side ile paralel çalıştırın, Meta Event Match Quality skorunu %80 üstüne çıkarın. Sonra production'da client-side'ı kapatın. Container template kullanırsanız bu süreç 3-5 gün, sıfırdan kurarsanız 2-3 hafta sürüyor. Roibase stack'inde standart deployment süresi 1 hafta — çünkü template, monitoring, BigQuery entegrasyonu hazır geliyor.