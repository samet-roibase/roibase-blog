---
title: "Server-Side GTM ve Conversion API: Sıfırdan Production'a"
description: "Cloud Run üzerinde sGTM container'ı deploy etmek, Meta CAPI entegrasyonu kurmak ve event deduplication ile ölçüm kalitesini artırmak için pratik rehber."
publishedAt: 2026-07-31
modifiedAt: 2026-07-31
category: data
i18nKey: data-001-2026-07
tags: [server-side-gtm, conversion-api, cloud-run, event-deduplication, measurement]
readingTime: 8
author: Roibase
---

Cookie deprecation takvimi 2024'te üçüncü kez ertelendi. Ama pazarlama ölçümünde asıl kırılma noktası zaten yaşandı: iOS 14.5 ile gelen ATT sonrası Facebook piksel conversion rate'leri %30-40 düştü, Google Analytics'te session stitching patladı, attribution window'ları 7 günden 1 güne daraldı. Server-side measurement artık "gelecek" değil, attribution gapini kapatmanın tek mühendislik çözümü. Bu yazıda server-side Google Tag Manager (sGTM) container'ını Google Cloud Run üzerinde sıfırdan deploy edip Meta Conversion API (CAPI) ile entegre etmeyi, event deduplication kurgulamayı ve production-ready hale getirmeyi adım adım anlatıyoruz.

## Server-Side Ölçümün Anatomisi

Client-side pikseller tarayıcıda çalışır — kullanıcı sayfayı yüklediği anda JavaScript kodu event'i toplar ve platform'a gönderir. Bu süreçte 3 kırılma noktası var: ad blocker'lar (kullanıcıların %40'ında aktif), ITP/ETP benzeri browser koruma mekanizmaları (Safari'de 7 günlük cookie yaşam süresi), consent banner'da reddetme (Avrupa'da %30-50 GDPR ret oranı). Server-side akış bu kırılmaları aşar çünkü event'ler kullanıcının tarayıcısından değil, kendi sunucunuzdan çıkar — consent sinyali ölçülmüş, first-party cookie okunmuş, identity resolution yapılmış, zenginleştirilmiş veri paketleri platform API'lerine HTTPS üzerinden POST edilir.

sGTM bu mimariyi standartlaştırır. Web Container'da tanımladığınız tag'ler (GA4, Meta Pixel) tarayıcıda tetiklenir, ama event'i doğrudan platforma göndermek yerine sGTM endpoint'ine yönlendirir. Server Container bu event'i alır, içinden user_data parametrelerini çıkarır (email, telefon, client IP, user agent), hash'ler, Meta CAPI tag'ine besler. Deduplication için event_id üreterek hem piksel hem CAPI'de aynı event_id gönderilir — Meta backend'i aynı event_id'yi tek conversion olarak sayar, double counting engellenir. Bu kurgu iOS 14.5 sonrası %30-40 düşen Facebook ROAS değerlerini %15-20 seviyesine çıkarabilir (Meta 2023 benchmark verisi).

Server-side'ın ikinci büyük faydası: attribution window'u tarayıcı sınırından kurtarırsınız. Safari'de ITP yüzünden 7 günlük cookie kullanılamıyor — kullanıcı 8. gün dönüp satın alırsa client-side piksel bu conversion'ı ölçemez. Server-side'da first-party cookie (örneğin `_fbc`, `_fbp`) kendi domain'inizde tutulur, 1-2 yıllık yaşam süresine sahiptir. Attribution cookie'den değil, CRM ID'nizi de kullanarak server-side identity resolution yapabilirsiniz. Bu da [first-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) disipliniyle içiçe çalışır — client ID, user ID, email hash'i tek bir profile merge edersiniz.

## Cloud Run Üzerinde sGTM Container Deploy Etmek

Google Cloud Run, sGTM container'ını host etmek için en hızlı yoldur çünkü pre-built container image var, autoscaling built-in, cold start süresi düşük (100-200ms). Alternatif Cloud Run App Engine veya Kubernetes olabilir ama ROI açısından Cloud Run optimal — aylık 100K event için maliyet $10-15 civarında (Cloud Run compute + Firestore state storage).

**Adım 1: GCP projesi ve billing aktif et.** Console'da yeni proje oluştur, billing hesabı bağla. `gcloud init` ile local CLI'ı yapılandır.

**Adım 2: sGTM Server Container oluştur.** Tag Manager UI'da "Server" tipinde yeni container oluştur. Sağ üstten "Manually provision tagging server" seç — bu otomatik App Engine yerine kendi Cloud Run endpoint'inizi kullanmanızı sağlar.

**Adım 3: Cloud Run servisini deploy et.**

```bash
gcloud run deploy sgtm-prod \
  --image=gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable \
  --platform=managed \
  --region=europe-west1 \
  --allow-unauthenticated \
  --set-env-vars=CONTAINER_CONFIG=<server_container_config_string>
```

`CONTAINER_CONFIG` string'i Tag Manager UI'dan kopyalanır (Settings → Container Configuration). `--allow-unauthenticated` flag'i önemli — web client'ların bu endpoint'e erişmesi gerekiyor. `europe-west1` region'u GDPR compliance için Avrupa data residency sağlar.

**Adım 4: Custom domain ayarla.** Cloud Run size `*.run.app` domain verir ama bu third-party olarak görülür, bazı tarayıcılar cookie'yi SameSite=None olarak işler. Kendi domain'inizden subdomain verin (örneğin `gtm.roibase.com.tr`). Cloud Run → Domain Mappings'den DNS kaydını yapılandırın — `CNAME` olarak Cloud Run endpoint'ine yönlendirme + SSL sertifikası otomatik Let's Encrypt ile oluşur.

**Adım 5: Firestore state storage.** sGTM server-side state için Firestore kullanır (örneğin claim edilen client-side cookie'leri saklamak). Firestore'u aynı GCP projesinde aktif edin, `europe-west1` region'unda database oluşturun. Hiçbir ekstra kod gerekmez — sGTM container otomatik bulur.

Deployment sonrası `curl https://gtm.roibase.com.tr/healthz` çağrısı `200 OK` dönmeli. Log'ları `gcloud run logs read sgtm-prod` ile kontrol edin — herhangi bir `CONTAINER_CONFIG` parse hatası varsa burada görünür.

## Meta Conversion API Entegrasyonu ve Deduplication

Server Container'da yeni bir "Facebook Conversion API" tag'i oluşturun (Tag Templates'den seçin veya Community Template Gallery'den "Facebook Conversions API by Stape" kullanın — daha esnek). Tag'in temel konfigürasyonu:

**Event Name Mapping:** Web Container'dan gelen `event_name` parametresini Meta'nın standart event'lerine map edin (purchase → Purchase, page_view → PageView). `event_name` yerine custom event adı gönderebilirsiniz ama Facebook pixel ile dedup için standart event kullanmak daha temiz.

**User Data Parameters:** Meta CAPI zorunlu `em` (email), `ph` (phone), `client_ip_address`, `client_user_agent` gerektirir. sGTM bunları otomatik olarak request header'larından okur. Email/telefonu web client'tan göndermek gerekiyor — örneğin dataLayer'a `user_email` ekleyin:

```javascript
window.dataLayer.push({
  event: 'purchase',
  transaction_id: 'T12345',
  value: 99.90,
  currency: 'USD',
  user_email: 'user@example.com'
});
```

Tag Template'de `user_email` → `em` mapping yapın. sGTM bu email'i SHA256 hash'leyip Meta'ya gönderir (plain text göndermeyin — GDPR/KVKK ihlali).

**Event Deduplication:** Client-side Facebook pixel tag'ine `eventID` parametresi ekleyin. Bu ID'yi server-side'a da gönderin. sGTM CAPI tag'inde aynı `event_id` kullanın. Meta backend'i 48 saat içinde aynı `event_id` + `event_name` kombinasyonunu tek conversion olarak sayar.

Örnek client-side pixel kodu:

```javascript
fbq('track', 'Purchase', {
  value: 99.90,
  currency: 'USD'
}, {
  eventID: 'T12345-1627384912'  // transaction_id + Unix timestamp
});
```

Server-side Tag'de `event_id` parametresini `{{event.event_id}}` olarak map edin (Event Data → event_id field). Bu sayede hem pixel hem CAPI aynı event_id gönderir — double counting %0'a iner.

**Test Etme:** Meta Events Manager → Test Events'e gidin, test event code alın, sGTM tag'ine `test_event_code` parametresi ekleyin. Sayfayı tetikleyin, Events Manager'da event gelip gelmediğini görün. Deduplication için hem pixel hem CAPI event'ini aynı anda tetikleyin — Events Manager'da "Deduplication" sütununda "Deduplicated" yazısı görünmeli.

## Production-Ready Checklist ve Monitoring

Production'a almadan önce 5 kritik noktayı kontrol edin:

**1. Consent Mode v2 entegrasyonu.** GDPR/KVKK uyumluluğu için Google Consent Mode v2 (Mart 2024'ten beri zorunlu). Web Container'da CMP (Consent Management Platform) entegrasyonu yapın, kullanıcı consent durumunu (`ad_storage`, `analytics_storage`) dataLayer'a push edin. sGTM bu consent durumunu okuyup event'i filtreleyebilir — örneğin `ad_storage: denied` ise Meta CAPI tag'ini tetiklemeyin veya sadece aggregated event gönderin (user_data olmadan).

**2. Rate limiting.** Cloud Run default concurrency 80 request/container. Anlık trafik spike'ında (Black Friday gibi) rate limit aşabilir. `--max-instances` değerini 10-20 arası ayarlayın, Cloud Run otomatik scale yapar. Maliyet kontrolü için `--max-instances` sınırı koyun — uncontrolled scale $1000+ fatura üretebilir.

**3. Error logging ve alerting.** sGTM'nin native loglama mekanizması yok — Cloud Run'daki stdout/stderr'a yazılan log'lar Cloud Logging'e gider. Meta CAPI'den gelen HTTP 400/500 hatalarını yakalamak için Custom Tag Template'de `fetch()` response'unu log'layın. Cloud Logging → Log-based Metrics ile "capi_error_rate" metriği oluşturun, Cloud Monitoring'de alert kurun (threshold: 5 error/min üstü).

**4. Latency optimizasyonu.** sGTM'nin response time'ı web sayfası yükleme süresini etkiler. Cloud Run cold start 100-200ms, warm instance 10-20ms. Minimum 1 instance ayakta tutun (`--min-instances=1`) — cold start'tan kaçınırsınız ama idle maliyeti $5-10/ay artar. Alternatif: Cloud Run → CPU allocation "CPU is always allocated" seçin — instance idle olsa bile CPU tüketir, cold start olmaz.

**5. Server-side GA4 + CAPI aynı anda.** GA4'ü de server-side'a taşıyın — GA4 Server-Side tag'i sGTM'de built-in. Aynı event hem GA4 hem CAPI'ye gidebilir. Dikkat: GA4'ün `client_id` + CAPI'nin `fbp` farklı cookie'lerden okunur. Identity resolution için dataLayer'da `user_id` gönderin, hem GA4 hem CAPI'de kullanın — cross-platform attribution consistency sağlar.

Production'da ilk hafta günlük Events Manager kontrol edin: match rate (email/phone match), event count (client vs server ratio), deduplication oranı. Meta benchmark: server-side event'lerin %60-70'i user_data match bulmalı (email hash'lenmiş ise). Match rate %30'un altındaysa user_data kalitesi düşük demektir — email normalization (lowercase + trim) yapın veya telefon numarasını E.164 formatında gönderin.

## Server-Side Ölçümün Stratejik Katmanları

sGTM sadece teknik bir container değil, pazarlama datası mimarisi kararıdır. İlk katman: event enrichment — server-side'da CRM verileriyle zenginleştirme yapabilirsiniz (BigQuery'den customer LTV okuması, product catalog'dan margin bilgisi ekleme). Örneğin purchase event'ine `customer_ltv` parametresi ekleyerek Meta'ya value-based lookalike audience seed'i besleyebilirsiniz.

İkinci katman: multi-platform orchestration. Aynı sGTM container'dan Meta CAPI, Google Ads Enhanced Conversions, TikTok Events API, Snapchat CAPI'ye aynı event gönderilebilir. Her platform farklı user_data matching kuralı kullanır (TikTok phone hash SHA256, Google email SHA256 + trim) — Tag Template'lerinde bu normalization'ı yapılandırın.

Üçüncü katman: incrementality measurement. Server-side event'leri control/treatment split yaparak A/B test edebilirsiniz — örneğin trafik %10'una CAPI event göndermeyip lift ölçümü yaparsınız. Bu tür testler [veri analizi ve içgörü mühendisliği](https://www.roibase.com.tr/tr/verianalizi) disipliniyle birleştirilir — BigQuery'de causal impact modeli kurar, incrementality hesaplarsınız.

sGTM'nin maliyeti cloud compute + state storage toplamıdır. 1M event/ay için Cloud Run $50-70, Firestore $10-15 civarında. Buna karşılık attribution gapini %15-20 kapatması, Meta ROAS'ını iyileştirmesi, iOS kullanıcılarındaki conversion loss'u düşürmesi ROI açısından ilk ayda geri öder. Kurulum süresi 2-4 hafta (test + production rollout dahil), ama deploy ettiğiniz container template'i diğer hesaplara 1 günde klonlanabilir — scalable infrastructure.