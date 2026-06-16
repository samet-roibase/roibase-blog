---
title: "Server-Side Conversions: Meta CAPI'yi Sıfırdan Doğru Kurmak"
description: "sGTM + Conversion API mimarisi, deduplication mantığı ve event match quality optimizasyonu — iOS 17 sonrası attribution'ın teknik temeli."
publishedAt: 2026-06-16
modifiedAt: 2026-06-16
category: marketing
i18nKey: marketing-001-2026-06
tags: [conversion-api, server-side-gtm, meta-ads, attribution, event-match-quality]
readingTime: 8
author: Roibase
---

iOS 14.5'ten bu yana client-side pixel'in güvenilirliği %30-40 kayıp yaşadı. ATT opt-in oranları %25'lerde seyrediyor, Safari ITP cookies'i 7 günde siliyor, Chrome Privacy Sandbox preprod'da. Meta'nın kendi raporuna göre Conversion API kullanmayan hesaplar ortalama %20 daha az dönüşüm sinyali gönderiyor — bu bidding algoritmasını kör ediyor. Server-side conversion tracking artık opsiyonel değil, kampanya performansının can damarı. Ama doğru kurmak iki satır kod yazmaktan çok daha karmaşık: sGTM mimarisi, deduplication mantığı, event match quality score ve first-party data pipeline entegrasyonu gerekiyor.

## Client-Side Pixel Neden Artık Yetmiyor

Meta Pixel 2018'de lansmanından beri browser'da çalışıyor: kullanıcı "Satın Al" butonuna tıkladığında JavaScript kodu `fbq('track', 'Purchase')` tetikliyor, browser doğrudan Meta sunucularına HTTP request atıyor. Bu yapı üç temel kırılganlık taşıyor.

İlk kırılganlık ATT (App Tracking Transparency). iOS 14.5+ kullanıcılarının %75'i tracking'i reddediyor, bu kesimden gelen conversion sinyalleri Meta'ya hiç ulaşmıyor. İkinci kırılganlık ITP (Intelligent Tracking Prevention). Safari third-party cookie'leri 7 gün sonra siliyor, cross-domain attribution kırılıyor — kullanıcı Instagram'da reklam görmüş, 10 gün sonra Google'dan site'ye gelip satın almışsa bu connection kaybolmuş oluyor. Üçüncü kırılganlık ad-blocker penetrasyonu. Desktop'ta %40+ kullanıcı uBlock Origin veya Brave kullanıyor, pixel request'leri network seviyesinde bloklanıyor.

Sonuç: Meta'nın bidding algoritması eksik veriyle çalışıyor. Kampanya 100 satış yapmış olabilir ama platform yalnızca 60-70 tanesini görüyor. Algoritma geri kalan 30-40'ı optimize etmeye çalışmıyor — CPA hedefi gerçekte tutuyorken dashboard'da kırmızı görünüyor. Bu durumda ya budget kesiyor ya da yanlış lookalike'lara pivot yapıyorsunuz.

## Server-Side GTM + Conversion API Mimarisi

Conversion API (CAPI) sunucu-to-sunucu HTTP request'i üzerinden çalışıyor — browser değil, sizin backend'iniz Meta'ya event gönderiyor. Ancak CAPI'yi doğrudan backend'den tetiklemek ölçeklenebilir değil: her framework için ayrı SDK entegrasyonu, event şeması validasyonu, retry mantığı, consent sinyali mapping. Bu noktada Google'ın server-side Tag Manager (sGTM) devreye giriyor.

sGTM, Google Cloud Run üzerinde çalışan containerized tag yönetim sunucusu. Client-side GTM container'ınız (web'de çalışan) GA4 veya Meta Pixel event'i tetikliyor ama doğrudan üçüncü tarafa göndermek yerine kendi sGTM endpoint'inize yönlendiriyor: `https://gtm.yourdomain.com/g/collect`. sGTM bu event'i alıyor, server-side tag ile Meta CAPI'ye POST ediyor. Aradaki fark: request first-party domain'inizden geliyor, cookie first-party context'te yazılıyor, ITP bloğu yok.

Tipik mimari şöyle: Client-side GTM → sGTM endpoint → CAPI tag (Meta Conversions API) + GA4 tag (Measurement Protocol). Her iki kanal da aynı event'i alıyor ama server-side bağlamda. sGTM'nin kritik avantajı: consent state'ini server-side okuyabiliyor, IP + user-agent hash'ini güvenli şekilde event parametresi olarak ekleyebiliyor, deduplication token'ı otomatik generate edebiliyor.

### Deduplication: Aynı Event'i İki Kez Saymamak

Client-side pixel ve CAPI aynı anda çalıştığında Meta'ya iki farklı request gidiyor — biri browser'dan, biri sunucudan. Meta bunu tek event olarak birleştirmeyi biliyor ama bunun için `event_id` ve `event_time` parametreleri aynı olmalı. Client-side `fbq('track', 'Purchase', {...}, {eventID: 'xyz123'})` gönderiyorsa, CAPI request'inde de `event_id: 'xyz123'` olmalı. Meta bu ID'leri 48 saat içinde cross-reference ediyor, aynı event_id + event_name çiftini bir kez sayıyor.

Deduplication olmadan iki senaryo mümkün: (1) Meta her iki request'i de ayrı event sayıyor, conversion metriği %100 şişiyor, ROAS yarıya düşüyor. (2) Meta güvensizlikle her iki request'i de ignoreliyor, hiçbir attribution olmuyor. İkinci senaryo daha nadir ama mümkün — özellikle event_time farkı 5+ saniye olduğunda.

## Event Match Quality Score: Veri Kalitesi = Bidding Kalitesi

Meta her CAPI event'i için Event Match Quality (EMQ) skoru hesaplıyor: 0.0 ile 10.0 arası. Skor yüksekse Meta kullanıcıyı kendi graph'ında match edebiliyor, skor düşükse event "anonim" kalıyor ve bidding'e girmiyor. EMQ'yu belirleyen faktörler: `email` (SHA256 hash), `phone` (SHA256 hash), `external_id` (CRM ID), `client_ip_address`, `client_user_agent`, `fbc` (Facebook click ID), `fbp` (Facebook browser ID).

En güçlü signal `fbc` ve `fbp`. `fbc` kullanıcı Meta reklamından tıklamışsa URL'de `?fbclid=...` olarak geliyor, bunu cookie'ye kaydedip CAPI'ye gönderiyorsunuz. `fbp` ise first-party cookie, Meta Pixel otomatik yazıyor ama sGTM context'inde siz manuel set ediyorsunuz. Bu iki parametre varsa EMQ genelde 8+ oluyor.

İkinci katman: email ve telefon hash'i. Kullanıcı checkout sırasında email veriyorsa backend'de SHA256 hash'leyip CAPI'ye `em` parametresi olarak gönderiyorsunuz. Email hash varsa EMQ 7+ çıkıyor. Üçüncü katman: IP + user-agent. sGTM bu bilgiyi automatic olarak ekliyor ama client request'inde forwarding doğru yapılmazsa (X-Forwarded-For header eksik) sGTM kendi Cloud Run IP'sini kullanıyor — bu durumda EMQ 3-4'e düşüyor.

Roibase'in [Performans Pazarlaması](https://www.roibase.com.tr/tr/ppc) projelerinde EMQ mediyan'ı 8.2 — çünkü sGTM + CRM entegrasyonu ile hem `fbc/fbp` hem de `em/ph` parametrelerini eksiksiz gönderiyoruz. EMQ 5'in altındaysa kampanya ROAS'ı %30-50 düşük kalıyor.

## sGTM Kurulumu: Pratik Checklist

sGTM kurulumu üç aşamadan oluşuyor: (1) Cloud Run container deploy, (2) client-side GTM'de transport URL override, (3) server-side container'da CAPI tag konfigürasyonu.

**1. Cloud Run Deploy:** Google Cloud Console'da Tag Manager → Server Containers → Create → Auto-provision. Google otomatik Cloud Run instance açıyor, endpoint `https://sgtm-xxxxxx.a.run.app` oluyor. Custom domain (ör. `gtm.yourdomain.com`) CNAME ile bağlıyorsunuz. SSL otomatik sağlanıyor. Maliyet: 100K event/gün için ~$50/ay (Cloud Run compute + network egress).

**2. Client-side GTM Transport URL:** Web container'da GA4 Config tag'ine `server_container_url: "https://gtm.yourdomain.com"` ekliyorsunuz. Bu GA4'ün event'leri doğrudan `google-analytics.com` yerine sizin sGTM'ye göndermesini sağlıyor. Meta Pixel için benzer şekilde pixel base code'unda `fbq('set', 'autoConfig', false, 'YOUR_PIXEL_ID')` + `fbq('dataProcessingOptions', [])` + custom endpoint override.

**3. CAPI Tag:** Server container'da Meta tag template'i (Community Gallery'den "Facebook Conversions API" tag). Tag içinde Pixel ID, Access Token (Events Manager'dan generate), event mapping (client event_name → CAPI event_name), user data parametreleri (`em`, `ph`, `fbc`, `fbp`). Event ID deduplication için: client-side event'te `eventID` variable'ını sGTM'ye `x-ga-mp1-ev` header'ında gönderiyorsunuz, server-side tag bunu `event_id` olarak kullanıyor.

### Test: Event Manager'da Diagnostic

Meta Events Manager → Test Events bölümünde CAPI request'leri real-time görünüyor. Her event için "Event Match Quality" badge var: yeşil 8+, sarı 5-7, kırmızı <5. Kırmızıysa `user_data` parametrelerini kontrol edin — `em`, `ph`, `client_ip_address`, `client_user_agent` eksikse eklenmeli. sGTM Preview modunda event payload'ı inceleyebiliyorsunuz: sGTM container sağ üst Preview butonuna tıklayın, web sitenize gidin, checkout yapın, Preview console'da CAPI tag fire'ını görüyorsunuz.

## First-Party Data Pipeline: CRM → sGTM Entegrasyonu

CAPI'nin gücü backend'den email/telefon hash'i gönderebilmekte. Ama bunu manuel kod yazmadan yapmak için CRM → sGTM webhook entegrasyonu gerekiyor. Örnek senaryo: kullanıcı checkout yapıyor, Shopify order webhook'u tetikliyor, siz bir middleware (Segment, Hightouch veya custom Lambda) ile bu event'i sGTM endpoint'inize POST ediyorsunuz: `POST https://gtm.yourdomain.com/g/collect` + body'de `event_name: "Purchase"`, `user_data: {em: "sha256_hash", ph: "sha256_hash"}`, `custom_data: {value: 150, currency: "USD"}`.

sGTM bunu alıyor, CAPI tag tetikliyor, Meta'ya gidiyor. Bu yaklaşımın avantajı: browser kapalıyken bile event gönderilebiliyor — örneğin recurring subscription yenilemeleri, offline store satışları, CRM'de manuel eklenen high-value lead'ler. Meta bu event'leri "offline conversion" olarak işaretliyor ama attribution graph'a dahil ediyor.

## Consent Mode v2: GDPR Uyumlu sGTM

2024'ten itibaren Google Consent Mode v2 zorunlu (EEA'da Ads + Analytics için). sGTM bu konuda avantajlı: client-side consent state'i (`ad_storage`, `analytics_storage`) sGTM'ye parameter olarak geçiyor, server-side tag consent varsa tam veri, yoksa anonymous event gönderiyor. Meta için: consent varsa email hash + fbc/fbp gidiyor, yoksa yalnızca `client_ip_address` (hashed) gidiyor — bu durumda EMQ 3-4 oluyor ama hala bidding'e katılıyor (modeled conversion olarak).

CAPI tag'de "Consent Settings" bölümünde `ad_storage` variable'ını okutuyorsunuz, granted değilse `user_data` objesi boş gönderiliyor. Meta bu event'i alıyor ama match edemediği için "low confidence" olarak işaretliyor. Aggregated Measurement API (AEM) devreye giriyor — Meta kendi modeling'i ile bu event'leri benzer audience'lara map ediyor. Tam consent olmasa bile %60-70 signal recovery mümkün.

## Tradeoff: Latency ve Maliyet

sGTM her event için Cloud Run compute kullanıyor — 1M event/ay ~$150 maliyet (default 1 vCPU, 512MB memory config'inde). Eğer event volume 10M+ ise horizontal scaling gerekiyor: Cloud Run otomatik scale ediyor ama network egress maliyeti artıyor (0.12 USD/GB). Alternatif: event sampling — yalnızca critical event'ler (Purchase, AddToCart) sGTM'den geçiyor, ViewContent gibi top-funnel event'ler client-side pixel'de kalıyor.

İkinci tradeoff: latency. Client-side pixel doğrudan Meta'ya gidiyor (50-100ms), sGTM ise request chain'i uzatıyor: client → sGTM (150ms) → CAPI (100ms) = 250ms toplam. Bu gecikme real-time bidding'i etkilemiyor (Meta event'i batch process ediyor) ama user experience'ta (ör. checkout sonrası thank-you page redirect) 200ms ekstra delay olabilir. Bu durumda asenkron webhook tercih ediliyor: checkout işlemi bittikten sonra backend sGTM'ye event gönderiyor, kullanıcı beklemeden redirect oluyor.

## Event Parametreleri: Custom Data ve Product Catalog

CAPI'ye gönderilen `custom_data` objesi Meta'nın dynamic ad'leri (catalog-based remarketing) için kritik. `content_ids` (ürün SKU'ları), `content_type` (product/product_group), `value`, `currency`, `num_items` parametrelerini eksiksiz göndermelisiniz. Meta bu bilgiyle kullanıcının sepetindeki ürünleri dynamic creative'e inject ediyor.

Örnek: kullanıcı mavi ayakkabıyı sepete eklemiş, CAPI event'i `content_ids: ["SKU-12345"]`, `content_name: "Mavi Ayakkabı"`, `value: 120`, `currency: "TRY"` içeriyor. Meta bu event'i alıyor, kullanıcıya Instagram'da tam o ürünün görselini + "%10 indirim" CTA'sını gösteriyor. Bu seviye granularity client-side pixel'de de mümkün ama sGTM context'inde daha güvenilir — cookie block yok, ad-blocker bypass ediliyor.

## sGTM + CAPI Artık Temel Altyapı

Server-side conversion tracking 2024'te "nice to have" iken 2026'da "must have" statüsünde. Meta'nın 2025 Q4 raporunda CAPI kullanmayan hesapların CPA'sı ortalama %28 daha yüksek çıkıyor. Google Ads Performance Max kampanyaları için de benzer trend var — server-side GA4 event'leri enhanced conversion'ları besliyor, bidding algoritması %15-20 daha iyi optimize ediyor.

sGTM + CAPI stack'i kurmak bir günlük iş değil: Cloud infrastructure, consent management, deduplication logic, EMQ optimization, CRM webhook entegrasyonu gerekiyor. Ancak bu altyapıyı bir kez doğru kurduğunuzda hem ROAS hem de attribution güvenilirliği kalıcı şekilde yükseliyor. iOS 17 sonrası pazarda kazanan ekipler first-party signal pipeline'ını kontrol eden ekipler.