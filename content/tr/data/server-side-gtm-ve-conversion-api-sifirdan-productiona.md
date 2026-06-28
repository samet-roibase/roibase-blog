---
title: "Server-Side GTM ve Conversion API: Sıfırdan Production'a"
description: "Cloud Run veya Workers üzerinde server-side measurement altyapısı kurma rehberi. Container template, deduplication mantığı ve production checklist."
publishedAt: 2026-06-28
modifiedAt: 2026-06-28
category: data
i18nKey: data-001-2026-06
tags: [server-side-gtm, conversion-api, cloud-run, container-deduplication, first-party-data]
readingTime: 8
author: Roibase
---

Cookie dönemi biterken measurement altyapınız hâlâ web container'da çalışıyorsa, attribution kayıplarını kabul etmişsiniz demektir. iOS 14.5 sonrası %30-40 oranında düşen Facebook ROAS rakamları tesadüf değil — client-side tagging'in artık gerçeği yansıtamadığının göstergesi. Server-side tagging ve Conversion API, bu sinyalleri browser kısıtlamalarından bağımsız olarak platforma taşıyan yeni standart. Bu yazıda Google Cloud Run veya Cloudflare Workers üzerinde sıfırdan production'a hazır bir server-side GTM altyapısı kuruyoruz.

## Client-Side Tagging'in Bittiği Yer, Server-Side'ın Başladığı Yer

Web container'da çalışan Google Tag Manager, ziyaretçinin tarayıcısında JavaScript çalıştırır. Bu senaryoda her pixel, her platform SDK'sı client IP'den istek gönderir. Safari ITP 2.0 ile first-party cookie ömrü 7 güne düştü, Consent Mode v2 ile reddetme oranı %60'ı buldu. Tarayıcı bu cookie'leri sildiğinde platform API'si kimliği kaybeder — dönüşüm sinyali orphan kalır, attribution çöker.

Server-side GTM bu mantığı tersine çevirir. Web container ziyaretçiden minimum veri toplar (event adı, user agent, IP), bu veriyi kendi sunucunuza POST eder. Sunucunuzda çalışan GTM container (Docker image) bu event'i alır, zenginleştirir ve platform API'sine server-to-server gönderir. Bu akışta cookie browser'da değil sunucuda saklanır, ömrü siz belirlersiniz, ad blocker baypas edilir. Meta Conversion API veya Google Analytics 4'ün Measurement Protocol doğrudan sunucunuzdan beslenir — veri kaybı %60'tan %10-15'e düşer.

Bu fark teknik derinlik gerektiriyor. Cloud provider seçimi, container versiyonu, deduplication stratejisi, event mapping şeması hepsi kritik. Şimdi bunları kuruyoruz.

## Google Cloud Run Üzerinde Server-Side Container Kurmak

Google Cloud Run, serverless container runtime. Dockerfile'dan image build eder, talep geldiğinde scale eder, idle olunca sıfıra iner. Server-side GTM'in resmi deployment yöntemi Cloud Run değil (App Engine veya manual GCE tercih ediliyor) ama Cloud Run maliyet avantajı sağlıyor — ayda 5-10 milyon event için ~$30-50 yerine $10-20 kalıyor.

İlk adım Google Cloud Console'da yeni proje açmak. `gcloud` CLI kuruluysa komut satırı daha hızlı:

```bash
gcloud projects create roibase-sgtm-prod --name="Roibase sGTM Production"
gcloud config set project roibase-sgtm-prod
gcloud services enable run.googleapis.com containerregistry.googleapis.com
```

Google Tag Manager'da **Server** container tipi oluştur. Ayarlar > Container Configuration bölümünden **Tagging Server URL**'yi not al (örn. `https://sgtm.roibase.io`). Bu custom domain Cloud Run service'ine point edecek.

Official Google image `gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable` production için güvenli ama version lock yok. Bizim yaklaşımımız kendi Dockerfile yazıp base image sabitlemek:

```dockerfile
FROM gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable

ENV CONTAINER_CONFIG="<GTM container ID>"
ENV PREVIEW_SERVER_URL="https://sgtm-preview.roibase.io"

EXPOSE 8080

CMD ["/bin/sh", "-c", "/app/start_server"]
```

Bu image'i Cloud Run'a deploy et:

```bash
gcloud builds submit --tag gcr.io/roibase-sgtm-prod/sgtm-container
gcloud run deploy sgtm-service \
  --image gcr.io/roibase-sgtm-prod/sgtm-container \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars CONTAINER_CONFIG=GTM-XXXXXX
```

Cloud Run service'e custom domain eklemek için Cloud Run > Domain Mappings > Add Mapping seç. DNS provider'ında CNAME record ekle (`sgtm.roibase.io` → Cloud Run URL). SSL sertifikası otomatik provision edilir (Let's Encrypt).

### Cloudflare Workers Alternatifi

Google ekosisteminin dışında kalmak istiyorsan Cloudflare Workers daha esnek. GTM Server container Docker image'ı Workers'ta çalışmaz ama Workers'ta custom tagging proxy yazabilirsin. Aşağıdaki script tüm GTM event'lerini proxy'leyip GA4 Measurement Protocol'a iletir:

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  if (url.pathname === '/gtm') {
    const payload = await request.json()
    const measurementId = 'G-XXXXXXXXXX'
    const apiSecret = 'YOUR_API_SECRET'
    
    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: 'POST',
        body: JSON.stringify({
          client_id: payload.client_id,
          events: [{ name: payload.event_name, params: payload.event_params }]
        })
      }
    )
    return new Response('OK', { status: 200 })
  }
  return new Response('Not Found', { status: 404 })
}
```

Workers runtime 50ms altında başlar, Cloud Run'ın cold start'ı 2-3 saniye. Ancak Workers'ta GTM'in Visual Tag Builder yok — her platform tag'ini kod olarak yazman gerekir. Cloud Run şimdilik daha pratik.

## Event Deduplication: Aynı Dönüşümü İki Kere Saymamak

Server-side tagging'e geçtiğinde web ve server container paralel çalışır. Ziyaretçi satın alım yapar → client-side Facebook Pixel tetikler → server-side container da aynı purchase event'ini alır → Facebook API'si aynı dönüşümü iki kere görür. ROAS %200 şişer, budget optimizer yanlış sinyal alır.

Çözüm: event deduplication. Her dönüşüme unique `event_id` ver, client ve server tarafı aynı ID'yi göndersin. Facebook/Meta aynı `event_id`'li ikinci eventi ignore eder. Deduplication window 48 saat (varsayılan).

GTM web container'da Facebook tag konfigürasyonuna `event_id` parametresi ekle:

```javascript
fbq('track', 'Purchase', {
  value: 99.99,
  currency: 'TRY'
}, {
  eventID: '{{Transaction ID}}_{{Random Number}}'
});
```

Server-side container'da Meta Conversion API tag'inde aynı `event_id`'yi user-defined variable olarak map et. GTM'in built-in `Event ID` variable'ı yok, manuel oluşturman gerekiyor. Data Layer variable tipi seç, variable adı `event_id`, default value `{{Page Path}}_{{Random Number}}`.

Google Analytics 4 için durum farklı. GA4 zaten client-side ve Measurement Protocol event'lerini merge ediyor (aynı `client_id` ve `session_id` varsa). Ek deduplication gerekmez ama `client_id`'nin tutarlı olması şart. Web container'da GA4 tag konfigürasyonunda **Send user-provided data** seç, `client_id` field'ına GTM variable olarak `{{GA Client ID}}` ver. Server container'da da aynı değeri kullan.

Bu mantığı production'a almadan önce Preview mode'da test et. GTM server container'ında Preview URL oluştur, web container'dan bu URL'yi hedefle. Chrome DevTools > Network sekmesinde `/gtm` endpoint'ine POST isteklerini incele — `event_id` ve `client_id` field'ları hem client hem server payload'ında olmalı.

## First-Party Cookie ve Session Stitching

Server-side measurement'ın gücü first-party cookie üzerinden user identity sabitlemekte. Web container `_ga` cookie'sini 2 yıl yaşatır ama Safari 7 güne siler. Server-side container kendi cookie'sini (`_sgtm` gibi) `Set-Cookie` header'ı ile ayarlayabilir — subdomain match olduğu için ITP bypass eder.

GTM server container'da **Client** section altında **Google Analytics: GA4** client type seç. Bu client gelen HTTP request'ten `client_id` çıkarır ve `_ga` cookie'sine yazar. Ancak bu cookie browser'a değil response header'ına eklenir — browser'ın görmesi için web container'dan server'a POST yerine GET redirect yapman gerekir (karmaşık).

Daha basit yöntem: web container'da DataLayer'a `client_id` ekle, server container bunu alıp kendi veritabanında sakla. Örneğin BigQuery'de `user_sessions` tablosu:

```sql
CREATE TABLE analytics.user_sessions (
  client_id STRING,
  session_id STRING,
  first_visit_timestamp TIMESTAMP,
  last_event_timestamp TIMESTAMP,
  device_category STRING,
  geo_country STRING
);
```

Her server-side event geldiğinde bu tabloya MERGE et. Aynı `client_id` farklı session'larda görünürse identity resolution yapabilirsin — [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) bu tür cross-session stitching için gerekli schema tasarımını derinleştiriyor.

### User-Agent Client Hints ve IP Enrichment

Server-side container user agent ve IP bilgisini client request header'ından alır. Ancak Chrome 110+ ile User-Agent string frozen — detaylı browser/OS verisi artık **User-Agent Client Hints** (UA-CH) içinde. Server container'da bu hint'leri parse etmen gerekiyor.

GTM server container'da custom JavaScript variable tanımla:

```javascript
function() {
  const headers = getAllEventData().headers || {};
  const uach = {
    brand: headers['sec-ch-ua'],
    mobile: headers['sec-ch-ua-mobile'],
    platform: headers['sec-ch-ua-platform']
  };
  return uach;
}
```

Bu veriyi Meta Conversion API'de `user_data.client_user_agent` field'ına ver. IP enrichment için MaxMind GeoIP2 database kullan (Cloud Run instance'ına mount et). Alternatif: Google Cloud'un built-in IP geolocation API'si (ücretli).

## Production Checklist: Rate Limit, Monitoring, Fallback

Server-side container production'a alınmadan önce aşağıdaki kontroller zorunlu:

**1. Rate limiting:** Platform API'leri saniyede max istek limiti koyar (Meta Conversion API 200 req/s, GA4 Measurement Protocol 1000 req/s). GTM container'da **Client** ayarlarında throttle değerini set et. Cloud Run max instance sayısını sınırla (`--max-instances 5`).

**2. Error handling ve retry:** Server-side tag HTTP 500 alırsa retry logic kur. GTM built-in retry yok — custom tag template yazman gerekir. Meta API 429 (Too Many Requests) döndüğünde exponential backoff uygula.

**3. Monitoring:** Cloud Run logs Stackdriver'a gider. `gcloud logging read` ile error pattern ara. Kritik metric: request latency (p95 < 500ms olmalı), error rate (< 1%), container memory usage (512MB default, 1GB ideal).

**4. Fallback mekanizması:** Server container down olursa web container hâlâ pixel göndermeye devam eder. Ancak server-only event'ler (backend dönüşümler) kaybolur. Fallback için event'leri Pub/Sub'a yaz, dead-letter queue'dan replay et.

**5. Consent Mode v2 entegrasyonu:** GTM server container CMP sinyalini okuyamaz (client-side çalışır). Web container'da consent state'i DataLayer'a yaz (`ad_storage: 'denied'`), server container bunu okuyup platform tag'lerini conditional çalıştır.

Production'da ilk hafta metrics:

| Metrik | Hedef | İzleme |
|--------|-------|--------|
| Event delivery rate | > 98% | Cloud Run logs |
| Deduplication accuracy | < 2% duplicate | Platform dashboards |
| Latency p95 | < 500ms | Cloud Monitoring |
| Cost per 1M events | < $5 | GCP Billing |

## Şimdi Ne Yapmalı

Server-side GTM altyapısı bir kere kurulur, sürekli optimize edilir. İlk adım mevcut web container'ınızı audit etmek — hangi tag'ler client-side kalmak zorunda (A/B test araçları), hangileri server'a taşınabilir (analytics, conversion tracking). Sonraki adım deduplication test ortamında doğrulamak — production'da %2 üstü duplicate oran kabul edilemez. Cloud Run deployment başlangıç için yeterli ama event volümü ayda 50 milyon geçtiğinde GKE cluster daha maliyet-etkin. Server-side measurement artık opsiyonel değil — attribution doğruluğu için zorunlu altyapı.