---
title: "Server-Side GTM ve Conversion API: Sıfırdan Production'a"
description: "Cloud Run veya Workers üzerinde server-side GTM container'ı deploy etmek, Conversion API ile deduplication kurmak ve production-ready monitoring tasarlamak için teknik rehber."
publishedAt: 2026-07-14
modifiedAt: 2026-07-14
category: data
i18nKey: data-001-2026-07
tags: [server-side-gtm, conversion-api, cloud-run, deduplication, privacy-sandbox]
readingTime: 8
author: Roibase
---

Cookie tabanlı ölçüm artık isteğe bağlı değil — Safari, Firefox ve 2025'te Chrome'un üçüncü taraf cookie'leri tamamen devre dışı bırakmasıyla birinci taraf veri mimarisi zorunlu hale geldi. Google Analytics 4 ve Meta Conversion API'nin sunduğu server-side event iletimi bu yeni çağın temel yapı taşı. Ancak "server-side GTM kurduk" ile "production'da güvenilir şekilde çalışıyor" arasında ciddi bir mesafe var: container deployment, event deduplication, load balancing, hata yönetimi ve maliyet optimizasyonu. Bu yazıda Cloud Run veya Cloudflare Workers üzerinde sıfırdan production-grade bir server-side GTM kurulumu yapacağız.

## Server-Side GTM Anatomisi: Container, Tagging Server ve İstemci

Server-side Google Tag Manager klasik web GTM'den mimari olarak farklı. İstemci tarafında çalışan JavaScript snippet'ı hafif bir "data layer push" yapar, ancak ağır işlemi — üçüncü taraf API'lere istek göndermek, cookie okumak, enrichment yapmak — backend'deki bir container üstlenir. Bu container Docker imajı olarak dağıtılır; Google Cloud Run, AWS Fargate veya Cloudflare Workers üzerinde çalışır.

Mimari üç katmandan oluşur. İlk katman **web tarayıcısı**: gtag.js veya gtm.js kütüphanesi minimal event payload'unu (client_id, event_name, timestamp) bir HTTP POST ile server'a gönderir. İkinci katman **tagging server**: Cloud Run pod'unda çalışan Node.js tabanlı GTM container'ı bu POST isteğini alır, GTM workspace'indeki tag'leri tetikler (GA4, Meta CAPI, TikTok Events API) ve her birini paralel HTTP istek olarak platform API'lerine iletir. Üçüncü katman **hedef platformlar**: Google Analytics Measurement Protocol, Meta Graph API, vb. Server-side GTM bu katmanlar arasında bir proxy görevi görür ama aynı zamanda zenginleştirme, filtreleme ve deduplication logic'i de içerir.

Klasik GTM'de her tag web sayfasında ayrı JavaScript snippet'ı yükler; 10 tag = 10 external request, sayfa yavaşlar. Server-side'da tarayıcı tek bir isteği kendi altyapınıza atar, geri kalan 10 istek backend'de paralel gider. Kullanıcı deneyimi hızlanır, adblocker bypass edilir, first-party cookie ömrü uzar (SameSite=None sorunları ortadan kalkar). Ancak bu kurulum ek maliyet getirir: her hit için Cloud Run invocation, IP bazlı coğrafi konum servisleri, log storage. Bu tradeoff'u doğru yönetmek production başarısını belirler.

### Cloud Run Deploy: Dockerfile ve Config

Google'ın resmi `gcr.io/cloud-tagging-10302018/gtm-cloud-image` imajını kullanarak container deploy edebilirsiniz. Alternatif olarak kendi Dockerfile'ınızı oluşturup custom middleware ekleyebilirsiniz (örneğin IP blacklist, rate limiting). Minimal Cloud Run deploy:

```bash
gcloud run deploy gtm-server \
  --image=gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable \
  --platform=managed \
  --region=europe-west1 \
  --allow-unauthenticated \
  --set-env-vars="CONTAINER_CONFIG=<base64_config>" \
  --min-instances=1 \
  --max-instances=10 \
  --cpu=1 \
  --memory=512Mi \
  --concurrency=80
```

`CONTAINER_CONFIG` GTM workspace'inizdeki server container'ın export edilmiş JSON'ını base64 encode eder. Bu config içinde hangi tag'lerin hangi trigger'larda tetikleneceği, hangi variable'ların nasıl doldurulacağı tanımlıdır. Production'da bu config'i Cloud Secret Manager'da saklayın — plain text environment variable güvenlik açığıdır.

Cloud Run'un auto-scaling davranışını `--min-instances=1` ile garanti altına alın. `min-instances=0` olursa ilk hit cold start'a maruz kalır (1-3 saniye); bu süre boyunca event kaybı riski vardır. 1 instance her zaman ayakta tutmak aylık ~$10 maliyet demektir ama critical event loss'u önler. `--concurrency=80` tek pod'un 80 paralel isteği kaldırabileceğini söyler; bu sayıyı load test ile kalibre edin (yüksek concurrency bellek tüketir, düşük concurrency gereksiz scaling tetikler).

## Conversion API Entegrasyonu: Meta, TikTok ve Deduplication

Server-side GTM'nin en kritik kullanım senaryosu Meta Conversion API (CAPI) ve TikTok Events API ile browser pixel'larını desteklemektir. İki kanal üzerinden aynı eventi göndererek sinyalin %100'üne ulaşırsınız: pixel iOS ATT rızasına takılırsa server event kurtarır, server-side IP bilgisi eksikse browser user agent tamamlar. Ancak aynı olayı iki kez raporlamak attribution'ı bozar — deduplication şart.

Meta CAPI her event payload'unda `event_id` alanı bekler. Aynı `event_id` + `event_name` kombinasyonunu 48 saat içinde ikinci kez gönderirseniz Meta otomatik dedupe eder. Basit implementation: client-side pixel'da event fire ettiğinizde UUID üretin, hem pixel hem server-side GTM'ye aynı UUID'yi gönderin.

```javascript
// Client-side (web GTM veya gtag.js)
const eventId = crypto.randomUUID(); // browser UUID
fbq('track', 'Purchase', { value: 99.90, currency: 'USD' }, { eventID: eventId });

// Server-side GTM'ye aynı eventId'yi data layer ile gönderin
dataLayer.push({
  event: 'purchase',
  event_id: eventId,
  value: 99.90,
  currency: 'USD'
});
```

Server-side GTM içinde Meta CAPI tag'inde "Event ID" variable'ını `{{event_id}}` olarak map edin. Bu sayede browser ve server event'leri birleşir. Meta dashboard'da "Events Manager > Diagnostics" altında deduplication oranını (Match Quality) izleyebilirsiniz. %80 üzeri match hedef.

TikTok Events API benzer `event_id` logic'i kullanır. Ancak TikTok cookie (`_ttp`) değerini server-side'a taşımanız gerekir — client-side pixel cookie set eder, server-side tag okur. Bu veriyi first-party cookie veya POST body'sinde taşıyın. Cloudflare Workers kullanıyorsanız edge'de cookie parse eden middleware yazıp GTM container'ına inject edebilirsiniz.

### Deduplication Tablosu ve Event Hash Kontrolü

Yüksek trafikli senaryoda aynı kullanıcı hızla iki kez "add to cart" yapabilir — browser ve server event'leri aynı saniyede farklı `event_id` ile gelebilir. Bu durumda external deduplication layer gerekir: BigQuery'de `event_hash` tablosu oluşturun.

```sql
CREATE TABLE analytics.event_dedup (
  event_hash STRING NOT NULL,
  event_time TIMESTAMP NOT NULL,
  user_id STRING,
  event_name STRING
)
PARTITION BY DATE(event_time)
CLUSTER BY event_hash
OPTIONS (
  partition_expiration_days = 7
);
```

Server-side GTM içinde custom variable olarak `SHA256(user_id + event_name + FLOOR(timestamp/60))` hesaplayın. Bu hash aynı kullanıcının aynı olayını 1 dakikalık pencerede gruplar. Tag fire etmeden önce BigQuery'ye `SELECT COUNT(*) WHERE event_hash = {{computed_hash}}` kontrolü yapın. Eğer row varsa tag'i skip edin. Bu pattern [first-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) içinde identity resolution ile birleştiğinde güçlü bir sinyal kalite katmanı oluşturur.

## Load Balancing, Hata Yönetimi ve Retry Stratejisi

Production'da tek Cloud Run instance yeterli değil. Yük dağıtımı için Cloud Load Balancer veya Cloudflare proxy kullanın. Cloud Load Balancer NEG (Network Endpoint Group) ile Cloud Run backend'ini bağlar, SSL termination yapar, DDoS koruması sağlar. Cloudflare Workers KV store ile IP rate limiting yapabilirsiniz — abuse trafiği tagging server'a ulaşmadan kesilir.

Hata yönetimi iki katmanda yapılır. İlk katman **GTM tag düzeyinde**: Meta CAPI tag'i 5xx hata döndüğünde otomatik retry yapsın mı? GTM native retry yoktur ama custom HTML tag içinde `fetch()` ile exponential backoff yazabilirsiniz:

```javascript
async function sendWithRetry(url, payload, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
    if (res.ok) return res;
    if (res.status < 500) break; // 4xx hatada retry yapma
    await new Promise(r => setTimeout(r, 2 ** i * 1000)); // 1s, 2s, 4s
  }
  throw new Error('Max retries exceeded');
}
```

İkinci katman **dead letter queue**: Cloud Run log'larındaki 5xx hataları Pub/Sub topic'ine yönlendirin, background worker pool bu event'leri 24 saat boyunca retry etsin. Bu pattern event loss'u %0.01 seviyesine indirir. Dead letter queue'yu BigQuery'ye yazıp kaybolan event'lerin pattern analizini yapabilirsiniz — örneğin belirli bir coğrafi bölgeden gelen istekler sürekli timeout oluyor olabilir.

### Monitoring: Latency, Error Rate ve Cost per Event

Production-ready kurulum metrics olmadan tamamlanmaz. Üç ana metrik izleyin:

| Metrik | Hedef | Uyarı Eşiği |
|--------|-------|-------------|
| p95 request latency | <500ms | >1000ms |
| Error rate (5xx / total) | <0.1% | >1% |
| Cost per event | <$0.0001 | >$0.001 |

Cloud Run metrics'lerini Cloud Monitoring dashboard'a bağlayın. Latency spike'ı genellikle downstream API (Meta, GA4) yavaşlamasından gelir — bu durumda circuit breaker pattern uygulayın: Meta 10 saniyedir yanıt vermiyorsa o tag'i geçici olarak disable edin. Cost per event hesabı için aylık Cloud Run faturasını toplam hit sayısına bölün. $0.0001 üzeri maliyetse concurrency veya instance boyutunu optimize edin.

Alerting için Slack webhook veya PagerDuty entegrasyonu kurun. Error rate %1'i geçtiğinde otomatik rollback tetikleyin (Cloud Run revision management ile önceki kararlı versiyona dönün). Bu otomasyon production incident'larını 5 dakikaya indirir.

## Identity Resolution ve User ID Forwarding

Server-side GTM'nin en güçlü yanı first-party identity'yi downstream sistemlere taşıyabilmesidir. Web'de oturum açmış kullanıcının `user_id`'sini GA4, Meta CAPI ve CDP'ye aynı anda göndererek cross-device attribution yapabilirsiniz. Ancak KVKK ve GDPR uyumluluğu için kullanıcı rızası olmadan PII (email, telefon) hash'i bile göndermemelisiniz.

GTM server container'ında "Consent Mode v2" trigger'ı kurun: `ad_storage` ve `analytics_storage` consent durumunu check edin. Rıza yoksa sadece anonim `client_id` gönderin, rıza varsa SHA256(email) ve `user_id` ekleyin. Meta CAPI için `em` (hashed email), `ph` (hashed phone), `fn`/`ln` (hashed ad/soyad) alanlarını doldurun. TikTok ve Google Ads benzer advanced matching alanlarını destekler.

Identity resolution logic'ini BigQuery'de merkezi bir `user_identity` tablosunda yönetin. Her server-side hit bu tabloyu query edip eksik sinyalleri tamamlasın (örneğin cookie'den gelen `client_id` bilinen bir `user_id` ile eşleşiyorsa o `user_id`'yi tüm event'lere ekle). Bu pattern CDP mimarisi ile birleştiğinde 360 derece müşteri görüşü sağlar.

## Cloudflare Workers Alternatifi: Edge Deployment

Cloud Run dışında Cloudflare Workers üzerinde de GTM container deploy edebilirsiniz. Workers V8 isolate mimarisinde çalıştığı için cold start yoktur (0ms), ancak CPU limit (10ms CPU time per request) ve bundle size (1MB) kısıtlamaları vardır. GTM resmi imajı Workers'a sığmaz — custom lightweight tagging layer yazmanız gerekir.

Workers avantajları: global edge (300+ lokasyon), built-in DDoS koruması, Cloudflare KV ile sub-millisecond cache. Dezavantajları: GTM GUI'sinden tag yönetimi yok (kod bazlı config), BigQuery entegrasyonu doğrudan yok (Workers → Pub/Sub → BigQuery pipeline gerekir). Workers'ı yüksek RPS (>10k req/s), düşük latency gerektiren senaryolar için tercih edin — örneğin mobil oyun analytics.

## Production Checklist: Deploy Öncesi Kontrol Listesi

Aşağıdaki maddeler eksikse deploy ETMEYİN:

1. **Container config versiyonlanmış mı?** Git'te her workspace değişikliği commit edilmeli.
2. **Deduplication logic test edildi mi?** Aynı event_id'yi 2 kez gönderip dashboard'da tek event göründüğünü doğrulayın.
3. **Dead letter queue kurulu mu?** 5xx hatalar kaybolmamalı.
4. **Cost alarm var mı?** Günlük $X üzeri harcama olursa email alın.
5. **Consent Mode entegre mi?** Rıza yönetimi platform (OneTrust, Cookiebot) ile GTM trigger'ları senkron mu?
6. **SSL/TLS doğru mu?** Custom domain kullanıyorsanız certificate otomatik yenilenmeli (Let's Encrypt veya Cloud CDN managed cert).
7. **Load test yapıldı mı?** k6 veya Locust ile 1000 RPS simüle edip instance scaling davranışını gözlemleyin.

Production'a geçiş kademeli yapılmalı. İlk hafta %10 trafiği server-side'a yönlendirin (Cloud Load Balancer weighted backend ile), geri kalan %90 eski client-side GTM'de kalsın. Metric'leri karşılaştırın: conversion sayısı, revenue attribution, session duration. Anomali yoksa her gün %10 artırın. 10 gün sonra %100 server-side'a geçiş tamamlanır.

Server-side GTM ve Conversion API birlikte kullanıldığında cookie deprecation sonrası dünyanın en güçlü ölçüm stack'ini oluşturur. Ancak bu stack'i production'da kararlı tutmak monitoring, deduplication ve maliyet optimizasyonu gerektirir. Yukarıdaki pattern'ler Roibase'in production sistemlerinde günlük 50M+ event'i işlemekte ve %99.9 uptime sağlamakta. Şimdi kendi container'ınızı deploy edin ve ilk 1000 hit'i izleyin — latency, error rate ve cost per event metriklerini not alın. Bu üç sayı kurulumunuzun kalitesini gösterir.