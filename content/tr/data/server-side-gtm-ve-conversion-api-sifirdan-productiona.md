---
title: "Server-Side GTM ve Conversion API: Sıfırdan Production'a"
description: "Cloud Run ve Workers üzerinde server-side tagging kurulumu, container template, event deduplication ve production monitoring stratejileri."
publishedAt: 2026-05-07
modifiedAt: 2026-05-07
category: data
i18nKey: data-001-2026-05
tags: [server-side-gtm, conversion-api, cloud-run, event-deduplication, privacy-sandbox]
readingTime: 8
author: Roibase
---

Tarayıcı-tabanlı ölçüm öldü. Third-party cookie'ler gitti, ITP 12 saate düştü, Consent Mode v2 zorunlu hale geldi. Meta ve Google'ın doğrudan API endpoint'lerine server-side event göndermeyen markalar artık attribution karanlığında kalıyor. Server-side Google Tag Manager (sGTM) ve Conversion API kurulumu 2026'da opsiyonel değil — production requirement. Bu yazıda Cloud Run üzerinde sıfırdan production-ready bir sGTM container nasıl deploy edilir, event deduplication nasıl kurulur ve hangi metrikler monitoring edilir göstereceğiz.

## Server-Side Tagging Neden Container Gerektirir

Tarayıcıda çalışan klasik GTM JavaScript kütüphanesi yükler ve user agent'tan veri toplar. Server-side GTM tam tersi çalışır: kendi sunucun üzerinde çalışan bir Node.js container, client'tan gelen HTTP POST'ları alır, event'ları zenginleştirir (IP, user-agent parsing, cookie'den gelen first-party ID) ve hedef API'lere (Meta CAPI, Google Ads Conversion, GA4 Measurement Protocol) iletir. Bu mimari 3 temel fayda sağlar: (1) tarayıcı kısıtlamalarını bypass edersin — ITP, adblocker, CORS yok; (2) PII'yi kontrollü şekilde hash'leyip gönderebilirsin — email, telefon server'da SHA-256'lanır, tarayıcıya asla dönmez; (3) tek event'tan çoklu platforma paralel istek atarsın — client'tan tek POST, server'dan 4 farklı endpoint'e fan-out.

Google'ın resmi deployment yolu App Engine veya Cloud Run. App Engine sabit maliyet + auto-scale getirir ama customize edilemez. Cloud Run tercih edilir çünkü minimum instance=1 ile 7/24 latency garantisi verebilirsin ve container image'ini custom Dockerfile ile özelleştirebilirsin (örneğin environment variable'lardan secret çekme, startup script injection). Alternatif Cloudflare Workers deployment'ı var — daha düşük cold-start latency (~5ms vs 200ms) ama Node.js sandbox sınırlamaları nedeniyle bazı GTM tag'leri çalışmaz (özellikle custom template'lerde native module require eden).

Deployment süreci şu adımlardan oluşur: (1) Google Cloud Console'da yeni proje, (2) `gcloud` CLI ile sGTM container image'ını pull et, (3) Cloud Run service oluştur + environment variable'ları set et (`CONTAINER_CONFIG`, `PREVIEW_SERVER_URL`), (4) custom domain bağla (örn. `gtm.roibase.com.tr`) — first-party context için zorunlu, (5) tagging server URL'yi web GTM'e ekle (`serverContainerUrl` parametresi). İlk deploy 15 dakika alır, sonrası CI/CD ile 2 dakikaya düşer.

## Event Deduplication: Client + Server Sinyalini Tek ID'ye Bağlamak

Server-side GTM'in kritik sorunu deduplication. Aynı dönüşüm hem tarayıcıdan (client-side GA4 tag) hem server'dan (server-side GA4 client) giderse platform 2 conversion sayar. Meta CAPI ve Google Ads Conversion için event deduplication ID sistemi zorunlu. Nasıl çalışır: her event'a unique bir `event_id` (veya Meta terminolojisinde `event_name + event_id`) atarsın, hem client hem server aynı ID'yi gönderir, platform 24 saat pencerede ID collision yaparsa duplicate'i drop eder.

Deduplication ID stratejileri:

| Yöntem | Avantaj | Risk |
|--------|---------|------|
| UUID v4 (random) | Collision riski yok | Client-server sync gerektirir (localStorage/cookie) |
| Transaction ID (e-commerce) | Doğal unique | Non-transaction event'lerde (lead, signup) yok |
| Session ID + timestamp | Kolay üretilebilir | Session overlap durumunda çarpışabilir |
| `_ga` client ID + event timestamp | First-party ID'ye dayalı | Clock skew riski (client/server saat farkı) |

Roibase production setup: `SHA-256(_ga + event_name + unix_ms)` — tarayıcıda DataLayer'a push'larken `event_id` field'ını bu hash ile dolduruyoruz, server-side GA4 tag'i aynı field'ı okuyup Measurement Protocol'e gönderiyor. Meta CAPI için ek `event_source_url` ve `action_source=website` parametrelerini server'da inject ediyoruz çünkü client-side Facebook Pixel bu field'ları göndermez ama server-side validation için zorunlu.

```javascript
// DataLayer push örneği (client-side)
window.dataLayer.push({
  event: 'purchase',
  event_id: sha256(_ga + 'purchase' + Date.now()),
  transaction_id: 'ORD-12345',
  value: 299.00,
  currency: 'TRY'
});
```

Server-side container'da custom variable oluşturarak `{{Event ID}}` değişkenini hem GA4 hem CAPI tag'lerine map ediyoruz. GA4 Measurement Protocol `&ep.event_id=` parametresini destekliyor, Meta CAPI'de root-level `event_id` field'ı var. Google Ads Conversion için `gclid` + `conversion_action_id` kombinasyonu deduplication sağlıyor — `gclid` cookie'den okunup server'a POST ediliyor, server tarafında Ads tag'i `gclid` + `conversion_value`'yu birleştirip Conversion Tracking API'ye gönderiyor.

## Container Template ve Custom Client Kurulumu

sGTM container'ı 3 temel bileşenden oluşur: **Client** (gelen HTTP request'i parse eder, event object'e dönüştürür), **Tag** (event'ı dış API'ye gönderir), **Variable** (tag'ler arası data paylaşımı). Google'ın default "GA4" client'ı yeterli değil çünkü sadece `/g/collect` endpoint'ini dinliyor. Biz custom client yazarak hem GA4 hem custom endpoint'leri (`/event`, `/purchase`) aynı container'da handle ediyoruz.

Custom client template örneği:

```javascript
const claimRequest = require('claimRequest');
const getRequestBody = require('getRequestBody');
const JSON = require('JSON');
const logToConsole = require('logToConsole');

claimRequest();

const body = getRequestBody();
const eventData = JSON.parse(body);

// Event object'i normalize et
const normalizedEvent = {
  event_name: eventData.event || 'unknown',
  user_data: {
    client_id: eventData.client_id,
    user_agent: eventData.user_agent,
    ip_override: eventData.ip_address
  },
  event_id: eventData.event_id,
  timestamp_micros: eventData.timestamp * 1000000
};

logToConsole('Normalized event:', normalizedEvent);
runContainer(normalizedEvent, () => {
  returnResponse();
});
```

Bu client `/event` path'ine gelen POST'ları yakalar, JSON body'yi parse eder ve sGTM event model'ine dönüştürür. `runContainer()` çağrısı tag'lerin çalışmasını tetikler — GA4 tag `event_name=purchase` gördüğünde Measurement Protocol'e, Meta CAPI tag `user_data.email` varsa SHA-256 hash'leyip `/events` endpoint'ine gönderir.

Production setup'ta 4 client çalıştırıyoruz: (1) GA4 default client (`/g/collect`), (2) custom JSON client (`/event`), (3) Meta Pixel client (`/tr/` endpoint — Facebook SDK uyumluluğu için), (4) health check client (`/health`) — Cloud Run liveness probe bu endpoint'i ping'leyerek container'ın sağlığını kontrol ediyor. Her client'ın öncelik sırası var (priority number) — aynı path'e iki client claim ederse en yüksek priority kazanır.

Custom template'leri version control altında tutmak kritik. Google Tag Manager'ın web UI'ında yapılan değişiklikler git history'sinde görünmez. Bizim workflow: template'leri `.tpl` dosyası olarak repo'da tut, CI pipeline'da `gtm-template-push` CLI tool'u ile sGTM workspace'e deploy et, staging container'da test et, sonra production'a promote et. Bu sayede rollback 1 git revert'le halloluyor.

## Production Monitoring: Hangi Metrikler Kritik

Server-side GTM deploy ettikten sonra karanlıkta kalmamak için 4 katmanda monitoring gerekiyor: (1) container health (uptime, latency, error rate), (2) event throughput (event/sn, tag success rate), (3) deduplication accuracy (client vs server event count delta), (4) downstream platform validation (Meta Event Quality Score, Google Ads conversion tracking status).

Cloud Run native metrikleri:

- **Request count** — `/event` endpoint'ine gelen POST sayısı, dakikalık breakdown
- **Request latency (p50, p95, p99)** — median 120ms üzeri ise problem var (normal 40-80ms arası)
- **Container instance count** — min=1 set ettiyseniz her zaman 1 olmalı, spike'larda auto-scale
- **Error rate (5xx)** — %0.1 üzeri sürekli hata downstream tag'lerde sorun işareti

sGTM'in kendi Console'unda "Logs" sekmesinde event-level debug log var ama production'da `console.log` her event için I/O yükü getiriyor. Bizim setup: debug logging sadece `?gtm_debug=1` query param'ı varsa aktif, production trafikte kapalı. Kritik error'lar (tag HTTP 4xx/5xx) Google Cloud Logging'e JSON structured log olarak gidiyor, oradan Cloud Monitoring alert policy trigger'lıyor — Meta CAPI'den 3 dakika içinde 10+ "Invalid access token" hatası gelirse Slack'e ping atıyor.

Event throughput monitoring için custom metric oluşturuyoruz: sGTM tag'lerinde `sendHttpGet('https://metrics.roibase.com.tr/increment?metric=capi_event')` çağrısı yapıyoruz, metric service Prometheus formatında counter tutuyor. Bu sayede Grafana dashboard'da real-time event flow görüyoruz — client-side GA4 1000 event/dk gönderiyor ama server-side CAPI sadece 850 event/dk alıyorsa deduplication ID collision veya network drop var demektir.

Downstream platform validation en kritik kısım. Meta Events Manager'da Event Match Quality (EMQ) skoru var — 6.5/10 altı "düşük kalite" demek, hash algoritması yanlış veya PII field'ları eksik anlamına geliyor. Google Ads Conversion Tracking'te "Status: Eligible" olmalı — "Rarely used" veya "Below threshold" görünüyorsa conversion volume yeterli değil (minimum 15 conversion/30 gün). GA4 DebugView'da server-side event'ları `traffic_type=server_side` ile filtrele, `event_count` metric'i client-side ile kıyasla — %20'den fazla fark varsa investigation gerekiyor.

## Identity Resolution ve User Matching Sinyalleri

Server-side ölçümün gücü PII (Personally Identifiable Information) sinyallerini kontrollü şekilde platform'lara iletebilmekte. Meta CAPI 7 farklı user matching parametresi kabul ediyor: `em` (email hash), `ph` (phone hash), `fn` (first name), `ln` (last name), `ct` (city), `st` (state), `zp` (zip), `country`, `external_id` (CRM ID). Bu sinyaller ne kadar çok gönderilirse EMQ skoru o kadar yüksek çıkıyor — tek `em` ile 4.2/10, `em + ph + fn + ln` ile 7.8/10. Google Enhanced Conversions da benzer mantık: `sha256_email_address` ve `sha256_phone_number` Ads Conversion tag'ine eklediğinde attribution accuracy %40 artıyor (Google'ın 2025 beta test verisi).

Roibase'in production identity resolution pipeline: (1) web formunda kullanıcı email/telefon giriyor, (2) client-side JS SHA-256 hash'liyor (plain text tarayıcıda tutulmuyor), (3) hash'lenmiş değer DataLayer'a push'lanıyor, (4) sGTM hash'i alıp Meta CAPI'ye `user_data.em` field'ına, Google'a `user_data.sha256_email_address` olarak gönderiyor. Bu akış KVKK/GDPR uyumlu çünkü plain PII asla server log'larına düşmüyor — SHA-256 one-way hash, geri döndürülemez.

Ek sinyal: `fbp` (Facebook Browser ID) ve `fbc` (Facebook Click ID) cookie'lerini server-side okuyup CAPI'ye gönderiyoruz. `fbp` cookie client-side Pixel tarafından set ediliyor ama ITP nedeniyle 7 gün sonra expire oluyor; biz server-side okuyup 90 gün TTL ile yeniden yazıyoruz (first-party domain'den set edildiği için ITP bypass). `fbc` cookie Facebook reklamdan gelen `fbclid` query param'ını taşıyor — server-side bu ID'yi parse edip CAPI'nin `fbc` field'ına ekleyince Meta attribution'ı 24 saat yerine 28 gün penceresine uzatıyor.

Google'ın `gclid` (Google Click ID) mekanizması benzer çalışıyor. Client-side GTM `gclid`'yi URL'den okuyup `_gcl_aw` cookie'sine yazıyor, expire 90 gün. Server-side bu cookie'yi okuyup Ads Conversion tag'ine `gclid` parametresi olarak ekliyoruz. Google'ın server-side Conversion Tracking API'si `gclid` + `conversion_action_id` kombinasyonunu unique key olarak kullanıyor — aynı `gclid` ile 2 conversion gönderirsen platform deduplication yapıyor. Bizim setup'ta `gclid` cookie yoksa (direct traffic) user'ın `_ga` client ID'sini fallback olarak `gbraid` parametresine map'liyoruz — bu Google Analytics attribution'ını Ads'e bağlıyor.

## Compliance ve Consent Orchestration

Server-side tagging Consent Mode v2 ile entegre çalışmazsa GDPR ihlali riski var. Google'ın kuralı: `ad_storage=denied` consent state'inde sGTM Google Ads Conversion tag'i tetiklenmemeli veya sadece anonymized sinyal göndermeli (IP masking + user ID drop). Meta'nın Limited Data Use (LDU) sistemi benzer: California trafiği için `data_processing_options=['LDU']` parametresi CAPI request'ine eklenince Meta kişiselleştirilmiş reklam için veriyi kullanmıyor.

Bizim consent orchestration stack: (1) OneTrust/Cookiebot banner'ı user'dan consent alıyor, (2) consent state (`ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization`) DataLayer'a push'lanıyor, (3) client-side GTM consent sinyalini cookie'ye yazıyor (`_consent_state`), (4) user `/event` POST'u atarken cookie header'da geliyor, (5) server-side GTM custom variable ile cookie'yi parse ediyor, (6) Meta/Google tag'lerinde conditional trigger: `{{Consent - Ad Storage}} equals "granted"` ise tag ateşleniyor, `denied` ise tag skip ediliyor.

Consent Conversion Modeling (CCM) için ek configuration: Google Ads tag'ine `consent_ad_user_data=true` eklenirse denial durumunda da anonymized sinyal gönderilebiliyor (modeling için gerekli). Meta CCM yoktu 2025'e kadar, 2026'da Advanced Matching v2 ile geldi — `external_id` gönderilirse denial durumunda Meta encrypted ID ile cross-device attribution yapabiliyor. Production'da test setup: trafiğin %10'unu force-deny consent moduna sokup conversion rate delta'sını ölçüyoruz — denial durumunda attribution %35 düşüyor ama CCM ile %18'e çıkıyor.

[First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) kapsamında server-side GTM sadece ölçüm katmanı — altında identity graph, customer data warehouse ve semantic layer olmalı. sGTM BigQuery'ye event stream atıyor, dbt modeli daily partition'lardan user-level aggregation yapıyor, CDP (Customer Data Platform) bu data'yı okuyup segment'leri Meta Custom Audience ve Google Customer Match'e push'luyor. Bu pipeline'ın orchestration'ı Airflow ile — sGTM log export → BigQuery → dbt → CDP → platform sync tüm zincir 15 dakikada tamamlanıyor.

---

Server-side GTM artık "nice to have" değil — cookie-less dünyada attribution kurmanın tek yolu. Cloud Run deploy ile başla, deduplication ID'yi doğru kur, PII sinyallerini hash'leyerek gönder, downstream platform metriklerini monitoring et. İlk hafta event volume'u %100 match etmese de iteratif debugging ile production-ready hale gelir. Şu an client-side ölçümle idare ediyorsan 6 ay içinde attribution karanlığına girersin — server-side migration yol haritasını bu hafta oluştur, infra setup'ını 2 sprint'te tamamla.