---
title: "Server-Side GTM ve Conversion API: Sıfırdan Production'a"
description: "Cloud Run/Workers üzerinde server-side tagging altyapısını kurmak, container template'lerini deploy etmek ve deduplication stratejilerini uygulamak."
publishedAt: 2026-08-16
modifiedAt: 2026-08-16
category: data
i18nKey: data-001-2026-08
tags: [server-side-gtm, conversion-api, cloud-run, deduplication, privacy-sandbox]
readingTime: 8
author: Roibase
---

Cookie'ler yok oluyor, tarayıcı kısıtlamaları sıkılaşıyor, consent rate %40'lara düşüyor — client-side ölçüm tek başına yeterli değil artık. Meta'nın Conversion API ve Google'ın Enhanced Conversions gibi server-side sinyaller, 2024'ten itibaren performans pazarlamasının vazgeçilmez katmanı haline geldi. Ancak "server-side tagging kuralım" demek ile production-ready, fault-tolerant, deduplication mantığı oturtulmuş bir altyapı çalıştırmak arasında kritik farklar var. Bu yazıda Google Tag Manager Server-Side (sGTM) container'ını Cloud Run veya Cloudflare Workers üzerinde sıfırdan deploy etmenin teknik detaylarını, conversion event'lerini platform API'lerine güvenli şekilde iletmenin yollarını ve client-server hybrid senaryolarda event deduplication stratejilerini ele alacağız.

## Server-Side Tagging Neden Kritik Hale Geldi

Client-side JavaScript tagları 2015-2020 arasında performans pazarlamasının omurgasıydı — Google Ads, Meta Pixel, TikTok Pixel hepsi kullanıcının tarayıcısında çalışıyordu. Ancak Safari'nin ITP, Firefox'un ETP, Chrome'un Privacy Sandbox adımları bu model için üç büyük engel getirdi: (1) third-party cookie yaşam süresi 7 gün veya daha kısaya düştü, (2) tarayıcı fingerprinting engellenmeye başladı, (3) consent banner reddi durumunda tag hiç çalışmıyor. Sonuç: aynı kullanıcı 3 farklı oturumda 3 farklı `fbp` cookie alıyor, attribution kopuyor, ROAS raporları %30-40 düşük çıkıyor.

Server-side tagging bu sorunu kullanıcı sinyallerini backend'de toparlayıp platform API'lerine doğrudan göndererek çözüyor. Şu avantajları sağlıyor: (1) tarayıcı kısıtlamalarından bağımsız event akışı, (2) first-party cookie yaşam süresi kontrolü (Set-Cookie header backend'den gelir), (3) hassas PII verisi (email, telefon) tarayıcıya hiç gitmeden hash'lenip API'ye iletilebilir, (4) batch processing ile sunucu kaynaklarını optimize etmek mümkün. Google'ın 2023 raporuna göre sGTM + Enhanced Conversions kullanan advertiser'lar client-only kuruluma kıyasla ortalama %18 daha yüksek conversion sayısı görüyor.

Ancak bu altyapıyı kurmak yeni bir mühendislik yükü demek. Google'ın App Engine tabanlı "otomatik" sGTM kurulumu ayda $50-200 maliyete patlarken scaling esnekliği sınırlı kalıyor. Cloud Run veya Cloudflare Workers gibi modern serverless platformlarda custom deploy yapmak hem maliyet hem kontrol açısından daha iyi — ancak Dockerfile, health check, secret management, load balancer config gibi detaylar göz korkutucu. İşte bu yazıda o detayları adım adım açacağız.

## Cloud Run Üzerinde sGTM Container Deploy Etmek

Google Tag Manager Server-Side container'ı aslında bir Node.js uygulaması — Google Cloud'un resmi `gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable` imajını temel alıp environment variable'larla yapılandırılıyor. Cloud Run üzerinde deploy için şu adımları takip etmelisin:

**1. GCP projesinde gerekli API'leri aktive et:**
```bash
gcloud services enable run.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com
```

**2. GTM web arayüzünden Server container oluştur, Container ID'yi (`GTM-XXXXXX`) not et.**

**3. Cloud Run service deploy et:**
```bash
gcloud run deploy sgtm-production \
  --image=gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable \
  --platform=managed \
  --region=europe-west1 \
  --allow-unauthenticated \
  --set-env-vars="CONTAINER_CONFIG=<GTM_CONTAINER_ID>" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=10 \
  --port=8080
```

**Açıklama:**
- `--allow-unauthenticated`: public endpoint (tag'ler buraya POST atacak)
- `--min-instances=1`: cold start'ı engeller — ilk event'te 3sn gecikme istemiyorsan
- `--max-instances=10`: traffic spike'ında otomatik scale (Black Friday hazırlığı)
- `--memory=512Mi`: ortalama 500 event/sn için yeterli (profiling yaparak ayarla)

**4. Custom domain bağla:**
```bash
gcloud run domain-mappings create \
  --service=sgtm-production \
  --domain=sgtm.yourdomain.com \
  --region=europe-west1
```

DNS'de `CNAME` kaydı ekle (`sgtm.yourdomain.com` → `ghs.googlehosted.com`). SSL sertifikası Cloud Run tarafından otomatik provision edilir (Let's Encrypt).

**5. Health check ve monitoring:**
Cloud Run built-in health check yok — ancak GTM container `/healthz` endpoint'i expose ediyor. Cloud Monitoring'de uptime check kur:
```bash
gcloud monitoring uptime-checks create http sgtm-health \
  --display-name="sGTM Health Check" \
  --resource-type=uptime-url \
  --host=sgtm.yourdomain.com \
  --path=/healthz \
  --period=60
```

Dikkat: GTM container default timeout 60sn — ağır tag transformation'lar varsa `--timeout=120` ile artır. Ancak genellikle sorun tag logic'inde, timeout artırmak makyaj yapmaktır — profiling yap, hangi tag yavaş çalışıyor bul.

## Conversion API Entegrasyonu ve Event Deduplication

Server-side container'ı deploy ettikten sonra sıra platform API'lerine event göndermekte. Meta Conversion API için GTM'de "Facebook Conversions API" tag template'ini kullanabilirsin (Community Template Gallery'de), ancak production senaryosunda custom transformation tercih edilir — çünkü PII hashing, consent sinyali, deduplication logic tam kontrole ihtiyaç duyar.

**Meta Conversion API için gerekli parametreler:**

| Parametre | Kaynak | Açıklama |
|-----------|--------|----------|
| `event_name` | DataLayer | `purchase`, `add_to_cart` vb. |
| `event_time` | Server timestamp | Unix epoch (saniye) |
| `event_id` | Client + Server | Deduplication key |
| `user_data.em` | Form input | SHA256 hash email |
| `user_data.ph` | Form input | SHA256 hash telefon (E.164 format) |
| `user_data.client_ip_address` | Request header | `X-Forwarded-For` |
| `user_data.client_user_agent` | Request header | UA string |
| `user_data.fbc` | Cookie (first-party) | Facebook click ID |
| `user_data.fbp` | Cookie (first-party) | Facebook browser ID |

**Deduplication stratejisi:**
Client-side ve server-side event'lerin ikisi de platforma gidiyorsa Meta bunları unique `event_id` ile deduplicate ediyor. Ancak `event_id` generation logic kritik:

```javascript
// Client-side (gtag.js veya Meta Pixel)
const eventId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
gtag('event', 'purchase', {
  transaction_id: orderId,
  value: 129.99,
  currency: 'USD',
  event_id: eventId  // Bu ID server'a da gönderilmeli
});

// DataLayer'a da ekle (sGTM okuyacak)
dataLayer.push({
  event: 'purchase',
  event_id: eventId,
  transaction_id: orderId,
  value: 129.99,
  user_email: sha256(email)  // Client'ta hash'le, raw gönderme
});
```

Server-side GTM tag'inde aynı `event_id`'yi kullan:
```javascript
// sGTM Custom JavaScript Variable
function() {
  return data.event_id || generateFallbackId();
}
```

**Önemli:** `event_id` üretiminde timezone dikkat — server UTC'de, client local timezone'da timestamp alıyorsa collision riski var. Best practice: client'ta `Date.now()` + random suffix kullan, server aynı ID'yi okusun.

**Batch processing:** Meta Conversion API saniyede 1000 event sınırı var — burst traffic'te rate limit almazsın çünkü Cloud Run auto-scale ediyor, ancak API quota patlar. Çözüm: sGTM'de "batch" transformation yaz — 10 event'i tek HTTP POST'a bundle et. Google'ın `sendHttpRequest` fonksiyonu bunu destekliyor:

```javascript
const events = getAllEvents();  // DataLayer'dan topla
const batches = chunk(events, 10);
batches.forEach(batch => {
  sendHttpRequest('https://graph.facebook.com/v18.0/<PIXEL_ID>/events', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({data: batch, access_token: pixelToken})
  });
});
```

## Cloudflare Workers Alternatifi ve Edge Location Avantajı

Cloud Run global deploy değil — `europe-west1` seçtiysen Asya'dan gelen request 200ms round-trip görür. Eğer global audience varsa Cloudflare Workers daha iyi seçenek — 300+ edge location, request otomatik en yakın POP'a route edilir, median latency <50ms.

**Workers deploy (Wrangler CLI):**
```bash
npm install -g wrangler
wrangler init sgtm-worker
```

`wrangler.toml`:
```toml
name = "sgtm-worker"
main = "src/index.js"
compatibility_date = "2024-01-01"

[vars]
GTM_CONTAINER_ID = "GTM-XXXXXX"

[[routes]]
pattern = "sgtm.yourdomain.com/*"
zone_name = "yourdomain.com"
```

**Worker script (simplified):**
```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/healthz') return new Response('OK', {status: 200});

    // GTM container logic buraya — Google'ın container image'ını Workers'a port etmek mümkün değil,
    // ancak tag logic'ini manuel re-implement edebilirsin (Meta CAPI, GA4 MP vb.)
    const body = await request.json();
    const eventId = body.event_id;
    const hashedEmail = body.user_data?.em;

    // Meta Conversion API call
    const response = await fetch(`https://graph.facebook.com/v18.0/${env.PIXEL_ID}/events`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        data: [{
          event_name: body.event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          user_data: {em: hashedEmail, client_ip_address: request.headers.get('CF-Connecting-IP')},
          action_source: 'website'
        }],
        access_token: env.CAPI_TOKEN
      })
    });

    return new Response(JSON.stringify({status: 'ok'}), {status: 200});
  }
};
```

**Trade-off:** Workers'da GTM'in visual tag editor'ü yok — tag logic'ini kod olarak yazman gerekiyor. Ancak şu avantajları var: (1) cold start sıfır (V8 isolate, container yok), (2) global latency <50ms, (3) maliyet çok düşük (ilk 100K request/gün bedava), (4) edge'de PII hash'leme yapabilirsin (veri hiç origin'e gitmiyor).

## Identity Resolution ve First-Party Cookie Yönetimi

Server-side tagging'in en büyük kazanımlarından biri first-party cookie kontrolü. Client-side JavaScript `document.cookie` ile cookie set edince tarayıcı `SameSite=Lax` kısıtlaması getiriyor, cross-site tracking engelleniyor. Ancak server-side `Set-Cookie` header'ı ile `SameSite=None; Secure` veya `SameSite=Lax` ayarını sen belirleyebilirsin.

**Cloud Run'da cookie set etme:**
```javascript
// sGTM Custom Tag (HTTP Response manipulation)
const setCookieHeader = require('setCookie');
setCookieHeader('_fbc', clickId, {
  domain: '.yourdomain.com',  // Subdomain share
  path: '/',
  'max-age': 7776000,  // 90 gün
  secure: true,
  httpOnly: false,  // JS okuyabilsin (client-side tag ile sync için)
  sameSite: 'Lax'
});
```

**Deduplication için identity stitching:**
Kullanıcı ilk ziyarette anonim, ikinci ziyarette login oluyor — iki farklı `user_id` mı yoksa aynı kişi mi? [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) kapsamında identity graph kurman gerekiyor. sGTM bunu desteklemek için `User-ID` parametresini hem anonim cookie'den hem login state'inden okuyabilir:

```javascript
// sGTM Variable: Unified User ID
function() {
  const loginUserId = data.user_id;  // DataLayer'dan (login sonrası)
  const anonCookie = getCookieValues('_ga')[0]?.split('.').slice(-2).join('.');  // GA client ID
  return loginUserId || anonCookie;
}
```

Bu ID'yi BigQuery'ye event ile birlikte gönder — dbt modelinde `user_id` merge logic'i kurarsın (örneğin `sessions` tablosunda `canonical_user_id` kolonu).

## Hata Yönetimi ve Observability

Production'da sGTM container'ının %99.9 uptime vermesi beklenir — çünkü her downtime kayıp conversion demek. Cloud Run'da retry logic ve dead letter queue kurmak kritik:

**1. Tag failure handling:**
GTM'de her tag için "Tag Firing Options → Fire a tag based on..." kısmında exception handling ekle. Örneğin Meta CAPI timeout'a düşerse GA4 Measurement Protocol tag'i çalışmaya devam etsin.

**2. Cloud Logging entegrasyonu:**
```javascript
// sGTM Custom Tag (Log to Cloud Logging)
const logToCloudLogging = require('logToConsole');
logToCloudLogging('ERROR', 'Meta CAPI failed', {error: response.body, event_id: eventId});
```

Cloud Console'da log-based metric kur — "Meta CAPI 4xx rate >5%" ise alert tetikle.

**3. Fallback endpoint:**
Primary sGTM container fail olursa backup container'a fallback yap — DNS'de weighted routing ile %10 traffic'i backup'a yönlendir, test ortamında sürekli canlı tut.

**4. Event replay:**
BigQuery'ye raw event'leri sink'le (Cloud Logging → BigQuery export). CAPI 500 hatası aldığında BigQuery'den event'i oku, retry et. dbt model örneği:

```sql
-- models/failed_events.sql
SELECT
  event_id,
  event_name,
  user_data,
  timestamp
FROM {{ source('logs', 'sgtm_errors') }}
WHERE status_code >= 500
  AND retry_count < 3
  AND timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
```

Bu tabloyu her 15 dakikada oku, Cloud Function tetikle, retry POST at.

## Consent Mode v2 ve Privacy Compliance

Server-side tagging "cookie bypass" değil — GDPR/KVKK uyumluluğu yine geçerli. Google Consent Mode v2 (Mart 2024'ten zorunlu) ile consent sinyalini hem client hem server'a taşıman gerekiyor.

**Client-side consent:**
```javascript
gtag('consent', 'update', {
  ad_storage: 'denied',
  analytics_storage: 'granted',
  ad_user_data: 'denied',
  ad_personalization: 'denied'
});
```

**Server-side'da consent check:**
```javascript
// sGTM Variable: Consent State
function() {
  const consentState = data.consent_state;  // DataLayer'dan
  if (consentState?.ad_storage === 'denied') {
    return null;  // Meta CAPI tag'ini fire etme
  }
  return consentState;
}
```

Dikkat: Consent Mode v2'de `ad_user_data` denied ise hashed email göndermek yasak — Google bunu Advanced Conversion için zorunlu kıldı ama Meta henüz enforce etmiyor, ancak GDPR açısından risk var. Consent granted olana kadar PII hash'leme.

## Maliyet Optimizasyonu ve Scaling Stratejisi

Cloud Run'da maliyet şu faktörlerden oluşur: (1) CPU time (milisaniye bazında), (2) memory allocation, (3) request count, (4) egress bandwidth. Tipik e-commerce sitesi (50K ziyaretçi/gün, 5K conversion/gün) için aylık $20-40 arası. Ancak Black Friday'de 10x traffic spike gelirse auto-scale maliyet patlatabilir.

**Optimization taktikleri:**

| Taktik | Etki | Detay |
|--------|------|-------|
| Min instance = 0 | -%30 maliyet | Gece 02:00-06:00 arası sıfır instance, cold start kabul edilebilir |
| Memory 256Mi | -%20 CPU | Basit tag logic için 512Mi gereksiz |
| Regional deploy | -%15 egress | Traffic %80 EU'dan geliyorsa `us-central1` yerine `europe-west1` |
| Batch processing | -%40 request count | 10 event → 1 API call |
| CloudFlare CDN | -%50 egress | Static asset'leri (GTM JS) CDN'den serve et |

**Benchmark:** 1M event/ay için Cloud Run ~$25, Cloudflare Workers ~$5 (ancak Workers'da tag logic custom kod gerektirir, development cost artırır).

---

Server-side tagging 2026'da artık "nice to have" değil, "must have" — özellikle iOS traffic'in %60'ını aştığı sektörlerde (e-commerce, fintech, travel). Cloud Run veya Workers üzerinde production-ready altyapı kurmak ilk bakışta karmaşık görünse de yukarıdaki adımları takip edersen 2 haftada canlıya alabilirsin. Kritik noktalar: deduplication logic'ini client-server arasında senkronize tut, consent signal'ı her katmana taşı, error handling ve retry mekanizması kur. Bir sonraki adım bu raw event'leri BigQuery'de birleştirip semantic layer oluşturmak — o noktada [veri analizi mühendisliği](https://www.roibase.com.tr/tr/verianalizi) kapsamında KPI tree ve attribution model kurarsın. Şimdi container'ını deploy et, ilk Meta CAPI event'ini gönder ve browser console'da deduplication'ı test et — aynı `event_id` ile client ve server event'i Meta Events Manager'da tek satır olarak görünmeli.