---
title: "Server-Side GTM ve Conversion API: Sıfırdan Production'a"
description: "Cloud Run/Workers deploy, container template, deduplication stratejileri. Server-side measurement'ı üretime taşımak için teknik yol haritası."
publishedAt: 2026-06-12
modifiedAt: 2026-06-12
category: data
i18nKey: data-001-2026-06
tags: [server-side-gtm, conversion-api, cloud-run, event-deduplication, privacy-measurement]
readingTime: 8
author: Roibase
---

Cookie'lerin silinmesi, ITP'nin katılaşması, consent mode'un zorunlu hale gelmesi — tarayıcı-tabanlı ölçüm 2024'ten beri %30-40 sinyal kaybına uğruyor. Client-side tag'ler artık "tam görüş" vermiyor. Server-side measurement bu kayıp sinyali geri kazanmanın tek mühendislik yolu. Google Tag Manager Server Container (sGTM) ve Meta Conversion API, bu mimarinin iki temel bileşeni. Ancak "deploy et, çalışsın" kadar basit değil: container hosting, event deduplication, timeout yönetimi, parametrik veri zenginleştirme — her adımda teknik karar gerekiyor. Bu yazı sGTM'i Cloud Run veya Cloudflare Workers'a taşıma, CAPI entegrasyonu, deduplication mantığı ve production checklist'ini ele alıyor.

## Server-Side GTM Container Hosting: Cloud Run vs Workers vs App Engine

sGTM container'ını Google Cloud'da çalıştırabilirsin ama **manuel deploy** şart. App Engine Automatic Scaling kullanırsan cold start'lar 2-3 saniye; peak traffic'te %15-20 event drop riski var. Cloud Run tercih ediliyor: minimum 1 instance "always warm", concurrency 80-100, request timeout 10 saniye. Dockerfile template Google tarafından public repo'da sunuluyor — `gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable`. Bu image'ı kendi project'ine deploy ederken 3 environment variable zorunlu:

```bash
CONTAINER_CONFIG=<GTM server container ID>
PREVIEW_SERVER_URL=https://<preview-domain>
RUN_AS_HTTPS_SERVER=true
```

Cloud Run komut örneği:

```bash
gcloud run deploy sgtm-prod \
  --image=gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable \
  --platform=managed \
  --region=europe-west1 \
  --set-env-vars=CONTAINER_CONFIG=GTM-XXXXXX,RUN_AS_HTTPS_SERVER=true \
  --min-instances=1 \
  --max-instances=10 \
  --concurrency=80 \
  --timeout=10s \
  --memory=512Mi
```

**Cloudflare Workers alternatifi:** Eğer global edge latency öncelikliyse Workers kullanılabilir. GTM container logic'ini Workers runtime'a port etmek gerekiyor (native değil). Avantajı: 50ms altı response time, dezavantajı: tag template ekosistemi kısıtlı — custom JavaScript tag yazman gerekebilir.

**Hosting maliyet:** Cloud Run'da ayda 1M request ~$40-60 arası (1 instance always-on + autoscale dahil). App Engine Flex ~$150-200. Workers $5 base + $0.50/million request — çok daha ucuz ama sGTM native desteği yok, ekstra dev zamanı gerektirir.

### Custom Domain ve SSL Sertifikası

sGTM'in default `*.run.app` domain'i **üçüncü parti sayılır** — Safari ITP bu domain'den gelen cookie'leri 7 günde siler. Bu yüzden `analytics.yoursite.com` gibi **first-party subdomain** şart. Cloud Load Balancer + Managed SSL sertifikası kurulumu:

1. Cloud Run service'ine **NEG (Network Endpoint Group)** ekle
2. HTTPS Load Balancer oluştur, backend'e NEG'i bağla
3. Google Managed Certificate ile `analytics.yoursite.com` için SSL al (48 saat sürebilir)
4. DNS'te A record'u LB'nin IP'sine yönlendir

Bu yapı production seviyesinde zorunlu. Test ortamında `run.app` domain'le çalışabilirsin ama ITP senaryolarını göremezsin.

## Meta Conversion API Entegrasyonu: Event Deduplication Stratejisi

Meta CAPI, sGTM üzerinden sunucu-tarafında pixel event'i göndermeyi sağlar. Ancak **client-side Meta Pixel** aynı event'i zaten gönderiyor olabilir — iki kez sayılırsa attribution bozulur. Meta'nın resmi deduplication yöntemi: her event'e **`event_id`** parametre ekle, aynı ID'yi hem client hem server'dan gönder. Meta 48 saat içinde duplicate'leri birleştiriyor.

sGTM'de CAPI tag'i kurarken:

- **Event Name:** `PageView`, `Purchase`, `AddToCart` (Meta standart event'leri)
- **Event ID:** Client-side pixel'den gelen `fbp` cookie + timestamp hash'i kullan
- **User Data:** `em` (hashed email), `ph` (hashed phone), `client_ip_address`, `client_user_agent` — sGTM bu parametreleri HTTP header'dan otomatik çekebilir

Event ID üretimi örneği (client-side):

```javascript
const eventId = CryptoJS.SHA256(
  fbp + '_' + eventName + '_' + Date.now()
).toString();

fbq('track', 'Purchase', {
  value: 99.00,
  currency: 'USD'
}, {
  eventID: eventId
});
```

sGTM tarafında aynı `eventId`'yi CAPI tag'ine geçir. Meta **48 saat** içinde aynı ID'li event'leri tek bir conversion'a indiriyor. Bu pencere dışında gelen geç event'ler duplicate sayılabilir.

**Test protokolü:** Meta Events Manager'da **Test Events** sekmesini kullan. Hem client hem server event'i gönderdiğinde "Deduplication Active" mesajı görmeli, aynı event_id altında 1 conversion görmelisin.

### User Data Zenginleştirme: IP ve User-Agent

Meta CAPI'nin attribution gücü **user data parametrelerinin zenginliğine** bağlı. Client-side pixel bu parametreleri tarayıcıdan otomatik toplar, server-side manuel göndermelisin. sGTM'in **HTTP Request Headers** variable'ını kullan:

- `client_ip_address` → `{{Client IP Address}}` (sGTM built-in variable)
- `client_user_agent` → `{{User Agent}}` (built-in variable)

Bu parametreler olmadan CAPI event'i %40-60 daha düşük match rate veriyor (Meta internal data). Email hash (`em`) ve phone hash (`ph`) ekleyebilirsen match rate %80'e çıkar. Hash'leme SHA-256 ile yapılmalı, lowercase + trim uygulanmalı:

```python
import hashlib

email_hash = hashlib.sha256('user@example.com'.strip().lower().encode()).hexdigest()
```

## Google Ads Enhanced Conversions: SHA-256 Hash ve gclid Eşleştirme

Google Ads Enhanced Conversions, sGTM üzerinden **hashed user data** göndermeyi gerektiriyor. Meta CAPI'ye benzer mantık: email, phone, address gibi PII'yi SHA-256 ile hash'leyip conversion tag'ine ekle. Google bu veriyi `gclid` ile eşleştirip offline conversion'a bağlıyor.

sGTM'de **Google Ads Conversion Tracking** tag'inde:

- **Enhanced Conversions** seçeneğini aktif et
- **User Data** kısmına `{{Email Hash}}`, `{{Phone Hash}}` variable'larını ekle
- **gclid** parametresini client-side'dan geçir (URL query string'den veya cookie'den)

Hash fonksiyonu JavaScript'te şöyle:

```javascript
async function hashSHA256(value) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

Client-side bu hash'i `dataLayer.push()` ile gönder, sGTM variable olarak yakala, Google Ads tag'ine besle. **Kritik:** Hash'leme client-side yapılmalı (privacy — PII sunucuya plain text gitmemeli) VEYA sGTM üzerinde yapıp log'lama kapatılmalı.

**Consent Mode v2 bağlantısı:** `ad_user_data` ve `ad_personalization` consent'i verilmemişse Enhanced Conversions bile çalışmaz. Consent signal'lerini sGTM'e iletmek için `consent` dataLayer event'i göndermelisin.

## Event Deduplication: Client-Side + Server-Side Paralel Gönderim

Bazı senaryolarda hem client-side hem server-side tag tetiklenir — örneğin Safari'de client-side tag çalışır AMA ITP cookie'yi 7 günde siler, o sırada sunucu-tarafı hala çalışıyor olabilir. Duplicate event riski var. Çözüm: **unique event_id** (Meta) veya **transaction_id** (Google Analytics 4) kullanmak.

GA4'te deduplication:

```javascript
gtag('event', 'purchase', {
  transaction_id: 'ORDER_12345', // unique per order
  value: 99.00,
  currency: 'USD'
});
```

Aynı `transaction_id`'yi hem client-side gtag.js hem sGTM üzerinden gönderirsen GA4 backend'de duplicate'i temizler (48 saat pencere).

**Timeout yönetimi:** sGTM tag'lerinde **timeout** ayarı var (default 2000ms). CAPI response'u 3-4 saniye sürerse tag timeout'a uğrar, event gönderilmez. Production'da timeout'u 5000ms'e çıkar, monitoring kur. Cloud Run request timeout (10s) ile sGTM tag timeout'u uyumlu olmalı.

## Production Checklist: Monitoring, Logging, Debugging

sGTM production'a geçmeden:

1. **Preview Mode:** GTM web arayüzünde Preview aç, sGTM container URL'ine bağlan, client event'leri debug konsolu
2. **Tag Firing Test:** Her tag için (CAPI, Google Ads, GA4) **Tag Assistant** ile doğrula
3. **Consent Signal:** Consent Mode v2 signal'lerini test et — `ad_storage=denied` durumunda hangi tag'lerin tetiklenmediğini kontrol et
4. **Log Export:** Cloud Run log'larını **Cloud Logging**'e aktar, filter: `resource.type="cloud_run_revision"`, event payload'ları görüntüle
5. **Error Alerting:** Cloud Monitoring'de alert kur: `http_response_code >= 500`, threshold 10/min

**Debugging araçları:**

- **sGTM Debug Mode:** Container preview URL'sini tarayıcıda aç, `gtm_debug=x` query string ekle
- **Network Tab:** Browser DevTools'da `/gtm.js` ve `/r/collect` request'lerini incele
- **Meta Event Test:** Events Manager → Test Events, son 1 saat içindeki event'leri görüntüle

**Common issue:** Client IP address sGTM'e ulaşmıyor — Cloud Load Balancer `X-Forwarded-For` header'ını kontrol et, **Preserve Client IP** seçeneğini aktif et.

## Veri Mimarisi Bağlantısı: sGTM + BigQuery + dbt

sGTM event'lerini doğrudan BigQuery'ye stream edebilirsin — **Firestore** veya **Pub/Sub** üzerinden. GA4 BigQuery export'u günlük batch, sGTM ile real-time stream mümkün. Bu strateji [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) kapsamında önemli: ham event data → dbt modelleri → semantic layer → dashboard.

Örnek akış:

1. sGTM tag → Cloud Pub/Sub topic'e JSON event gönder
2. Dataflow job (veya Cloud Function) → Pub/Sub'dan BigQuery'ye yaz
3. dbt model → event'leri `user_id` bazında birleştir, session logic uygula
4. Looker/Metabase → dbt view'ları üzerinden dashboard

Bu mimari **identity resolution** için de kritik: sGTM'den gelen `client_id`, `fbp`, `gclid` gibi identifier'ları BigQuery'de merge edip tek `user_id` oluşturabilirsin. dbt incremental model örneği:

```sql
{{ config(materialized='incremental', unique_key='event_id') }}

SELECT
  event_id,
  user_id,
  client_id,
  event_timestamp,
  event_name,
  event_params
FROM {{ source('sgtm_events', 'raw_events') }}
{% if is_incremental() %}
WHERE event_timestamp > (SELECT MAX(event_timestamp) FROM {{ this }})
{% endif %}
```

Bu yapı **attribution model**ini de destekler: sGTM event'lerini BigQuery'de `gclid`, `fbclid` ile JOIN edip multi-touch attribution hesaplayabilirsin.

---

Server-side measurement artık "isteğe bağlı optimizasyon" değil, privacy-first dünyada zorunlu altyapı. Cloud Run deployment, CAPI deduplication, Enhanced Conversions hash'leme, BigQuery stream — her adım teknik karar gerektiriyor. Test ortamında `run.app` domain'le başla, production'a geçmeden custom domain + SSL kur, consent signal'lerini doğrula, monitoring'i aktif et. sGTM tek başına çözüm değil — client-side tag'lerle paralel çalışmalı, deduplication mantığı sağlam olmalı. Attribution'ı kurtarmak istiyorsan sunucu-tarafı ölçüme geçiş kaçınılmaz, ama sıfırdan production'a giden yol 4-6 hafta mühendislik zamanı gerektirir.