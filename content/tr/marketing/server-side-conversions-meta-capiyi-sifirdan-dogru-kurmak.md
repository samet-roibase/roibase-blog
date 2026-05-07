---
title: "Server-Side Conversions: Meta CAPI'yi Sıfırdan Doğru Kurmak"
description: "sGTM + Conversion API mimarisi, event match quality, deduplication stratejileri ve first-party data pipeline'ını iOS 17 sonrası attribution için kurma kılavuzu."
publishedAt: 2026-05-07
modifiedAt: 2026-05-07
category: marketing
i18nKey: marketing-001-2026-05
tags: [conversion-api, server-side-gtm, attribution, meta-ads, first-party-data]
readingTime: 8
author: Roibase
---

iOS 14.5'ten bu yana browser-based pixel'in ölçüm gücü %40-60 düştü. Meta'nın 2025 Q4 verilerine göre CAPI kullanmayan advertiser'ların ortalama Event Match Quality skoru 3.8/10'un altında. Bu da demek oluyor ki algoritmanın optimize edebileceği sinyal sayısı yetersiz. Cookie-less dünyanın ilk fazını browser-side tracker'lar kaybetti. İkinci faz — server-side mimarinin doğru kurulduğu veya üstünkörü atıldığı faz — şu an devam ediyor. Meta Conversion API'yi sGTM üzerinden düzgün kurmak artık opsiyonel değil, performans pazarlamasının altyapı seviyesinde zorunlu.

## Pixel ve CAPI arasındaki fark neden kritik

Meta Pixel browser'da çalışır. Kullanıcının rızasına bağlıdır, bot traffic'i filtreleyemez, network latency'den etkilenir. CAPI ise sunucudan direkt Meta'ya HTTP POST gönderir. İki farkı var: timing ve veri kalitesi. Pixel `PageView` event'ini kullanıcı sayfayı yükleyince atar; CAPI aynı eventi checkout tamamlandıktan sonra backend'den gönderebilir. Bu zaman farkı deduplication'ın temelini oluşturur — iki kaynaktan gelen aynı eventi Meta'nın birleştirmesi gerekiyor. İkinci fark: CAPI'de user identifier'ları sen kontrol edersin. `em` (email hash), `ph` (telefon hash), `fbc` (Facebook click ID), `fbp` (browser ID) parametrelerini doğru hash'leyip göndermezsen Event Match Quality düşer. Düşük EMQ demek algoritmanın hangi kullanıcının hangi eventi tetiklediğini %100 anlamadığı demek. Bu da bid optimization'ı köreltiyor. Meta'nın 2024 whitepaper'ında CAPI+Pixel birlikte kullanıldığında ROAS'ta ortalama %13 artış gözlemlendi (n=4200 advertiser, 60 gün window). Fakat bu iyileşme sadece deduplication doğru kurulduğunda gerçekleşiyor.

Pixel'i kapatıp sadece CAPI'ye geçmek de hata. Çünkü browser pixel `ViewContent`, `AddToCart` gibi ara event'leri real-time toplar; CAPI genelde sadece `Purchase` için kullanılır. Orta yolu bulmak gerekiyor: pixel'i lightweight tutup, kritik conversion'ları CAPI ile duplicate göndermek. Burada deduplication parametreleri devreye girer. Meta'nın sistemi `event_id` ve `event_time` kombinasyonuna bakarak aynı olayı iki kez saymaktan kaçınır. Ama bu parametreleri hem pixel hem CAPI'ye tam olarak aynı şekilde vermezsen dedup çalışmaz. Çoğu implementasyon burada patlar: frontend'de `event_id` UUID ile üretilir, backend'de başka bir ID ile gönderilir. Sonuç: iki ayrı event olarak algılanır, ROAS raporlarında şişme başlar.

## sGTM altyapısını kurma adımları

Server-side Google Tag Manager olmadan CAPI kurulumu yapılabilir — doğrudan backend'den Meta'ya POST atabilirsin. Ama bu yaklaşım scaling'de sorun çıkarır. Birden fazla destination (Google Ads Enhanced Conversions, TikTok Events API, Snapchat CAPI) eklediğinde her biri için ayrı endpoint yazmak gerekir. sGTM bir abstraction layer sağlar: tek bir server container tüm tagging ihtiyacını karşılar. Google Cloud Run veya App Engine üzerinde host edilir. Client-side GTM container'dan gelen HTTP request'leri yakalar, server-side tag'leri tetikler, ardından Meta, Google, TikTok'a paralel POST gönderir.

Kurulum akışı şöyle:

1. **Cloud Run instance oluştur:** `gcloud run deploy gtm-server --image=gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable --platform=managed --region=europe-west1`. Bu komut Google'ın resmi sGTM image'ını deploy eder.
2. **Tagging Server URL'i al:** Deploy tamamlanınca `https://gtm-server-xxxxx-ew.a.run.app` gibi bir URL alırsın. Bu URL'i client-side GTM'de `serverContainerUrl` parametresine yazacaksın.
3. **Client-side GTM'de GA4 tag'ini değiştir:** Normalde GA4 eventi doğrudan Google'a gider. Transport URL olarak sGTM URL'ini set edersen GA4 verileri önce senin sunucuna, oradan Google'a gider. Bu aynı zamanda IP anonymization ve user-agent normalization'ı sunucuda yapma imkanı verir.
4. **sGTM container'ında Meta CAPI tag'i ekle:** "Meta Conversions API" template'ini kullan. `Pixel ID` ve `Access Token` gir. Access Token'ı Events Manager > Settings > Conversions API'den alırsın. Burada test event'i göndererek bağlantıyı doğrulayabilirsin.

sGTM'nin bir avantajı: aynı request içinde hem GA4 hem CAPI'ye event gönderilebilir. Client-side bir `dataLayer.push` ile tetiklenen trigger, server-side iki farklı tag'i tetikler. Bu sayede backend'de iki ayrı API call yazmana gerek kalmaz. Fakat burada da dikkat edilmesi gereken nokta var: GA4'ten gelen `client_id` ile Meta'nın istediği `fbp` aynı değil. Bu yüzden sGTM container'ında bir transformation variable oluşturman gerekir — `fbp` cookie'sini alıp CAPI tag'ine map etmen lazım. Bu mapping için [first-party veri mimarisi](https://www.roibase.com.tr/tr/ppc) gerekiyor; yoksa identifier'lar senkronize olmaz, EMQ düşer.

## Event Match Quality'yi yükseltmek

EMQ Meta'nın "bu eventi hangi kullanıcıya atayabilirim" sorusuna verdiği güven skoru. Maksimum 10. 8'in üstü mükemmel, 6'nın altı sorunlu. EMQ'yu yükselten şey doğru identifier kombinasyonu. Meta'nın dökümanına göre öncelik sırası: `em` (email) > `ph` (telefon) > `external_id` (CRM ID) > `fbc` > `fbp`. Email ve telefonu SHA-256 ile hash'leyip küçük harfe çevir, boşluk bırakma. Örnek:

```javascript
// Yanlış hash
const email = " John@Example.com ";
const hash = sha256(email); // Boşluklar ve büyük harf sorun

// Doğru hash
const email = "john@example.com";
const hash = sha256(email); // SHA-256: a665a...
```

CAPI request'inde `user_data` objesi şu şekilde olmalı:

```json
{
  "em": ["a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3"],
  "ph": ["sha256_telefon_hash"],
  "fbc": "fb.1.1554763741205.AbCdEfGhIjKlMnOpQrStUvWxYz",
  "fbp": "fb.1.1558571054389.1098115397",
  "client_ip_address": "93.184.216.34",
  "client_user_agent": "Mozilla/5.0..."
}
```

IP ve user agent'ı sGTM otomatik alır ama bazı hosting ortamlarında (Cloudflare proxy) `X-Forwarded-For` header'ını parse etmen gerekebilir. `fbc` parametresi Facebook click ID — kullanıcı bir Meta ad'ine tıkladığında URL'de `fbclid=...` eklenir. Bu değeri cookie'ye yazıp CAPI'ye gönderirsen attribution loop kapanır. Çoğu implementasyon `fbc`'yi atlar, sonuç olarak Meta hangi ad'in conversion'ı tetiklediğini bilemez. EMQ 4.2'de kalır.

## Deduplication stratejisi

Aynı `Purchase` eventi hem pixel hem CAPI'den geldiğinde Meta'nın bunu tek event olarak sayması için `event_id` aynı olmalı. Genelde UUID v4 kullanılır. Ancak UUID frontend'de üretilirse backend'e taşınması gerekir. Çözüm: checkout'ta hidden input olarak event_id'yi form'a eklemek veya localStorage'a yazmak. Backend order tamamlandığında aynı ID'yi alıp CAPI request'ine koyar. Zaman farkı 48 saat içinde olmalı (Meta'nın dedup window'u). Eğer event_time farkı 48 saati aşarsa iki ayrı event sayılır.

Örnek akış:

1. Kullanıcı "Satın Al" butonuna basar → pixel `InitiateCheckout` atar (event_id: `evt_12345`, event_time: 1683820800)
2. Backend ödeme onaylanır → CAPI `Purchase` gönderir (event_id: `evt_12345`, event_time: 1683820802)
3. Meta iki eventi görür, event_id eşleşir, zaman farkı 2 saniye → tek event olarak işler.

Bu kurulum olmadan pixel'in attığı `Purchase` ile CAPI'nin attığı `Purchase` çift sayılır. ROAS hesabında conversion değeri 2x şişer. Kampanya dashboard'unda "100 conversion" görürsün ama gerçek sayı 50'dir. Bunu fark etmezsen budget allocation yanlış gider.

Bazı durumlarda pixel eventi tamamen kaybolur (ad blocker, consent yok). Bu durumda CAPI tek başına çalışır. Dedup yoksa sorun yok. Ama pixel eventi gecikmeyle gelirse (örneğin kullanıcı offline'dan tekrar online oldu, browser queue'daki eventi 10 dakika sonra attı) ve event_id yanlışsa Meta bunu yeni bir event sayar. Bu edge case'i handle etmek için server-side event_time'ı backend'deki order timestamp'ine sabitlemek önerilir — kullanıcının browser saatiyle değil.

## Incrementality ve CAPI'nin test edilmesi

CAPI kurulumu tamamlandığında "EMQ 8.5, dedup çalışıyor" raporu yeterli değil. Asıl soru: CAPI olmadan da bu conversion'lar gerçekleşir miydi? Bunu ölçmek için geo-based holdout test veya conversion lift study gerekir. Meta'nın kendi Conversion Lift aracı var ama minimum spend threshold yüksek ($30k+). Alternatif: basit bir A/B test. Trafik yarısında CAPI aktif, yarısında pasif. 14 gün sonra incremental ROAS'a bakarsın. Eğer CAPI grubu %15 daha iyi performans gösteriyorsa altyapı değerini kanıtlamış olursun.

Bir diğer metrik: attribution window'lara bakmak. CAPI ile 7-day click attribution'ın güvenilirliği artar çünkü post-click event'ler backend'den gelir, bot değil gerçek kullanıcı. Pixel'de bot traffic %8-12 arasında. CAPI'de server IP whitelist'i yaparak bu oran %1'in altına düşer. Bu da demek oluyor ki kampanya optimization'ı daha temiz sinyalle çalışıyor. Test sonuçlarına göre bazı advertiser'lar pixel'i tamamen kapattı, sadece CAPI ile devam ediyor (özellikle B2B lead gen'de). Ama bu strateji ecommerce için riskli çünkü `ViewContent` ve `AddToCart` sinyalleri kayboluyor. Bu da dynamic retargeting audience'larını zayıflatır.

## İleri seviye: custom event ve offline conversion

Meta CAPI sadece standart event'lerle sınırlı değil. Custom event tanımlayıp backend'den gönderebilirsin. Örneğin `SubscriptionRenewal` veya `TrialStarted`. Bu event'leri custom conversion olarak tanımlayıp campaign optimization objective'ine set edebilirsin. Özellikle SaaS modellerinde LTV'yi optimize etmek için uzun-dönem event'leri (90-day retention, upsell) CAPI ile gönderip bid stratejisine dahil etmek mümkün. Google Ads'in offline conversion import'una benzer mantık.

Offline conversion senaryosu: kullanıcı online lead form doldurdu, satış ekibi 5 gün sonra telefonda deal kapattı. Bu deal'i CRM'den export edip CAPI'ye `Purchase` olarak göndermek gerekiyor. Bu durumda `event_time` geçmiş tarihli olacak. Meta 62 güne kadar retroaktif event'i kabul eder. Ama bu event'in attribution algoritmasına etkisi sınırlı çünkü kampanya optimize edilirken real-time sinyallere bakılır. Yine de raporlama doğruluğu için gerekli. CRM-CAPI entegrasyonunu Zapier veya n8n ile otomatikleştirebilirsin; her yeni "Closed Won" deal için CAPI POST tetiklersin.

## Yaygın hatalar ve çözümleri

**1. `fbc` parametresi eksik:** Kullanıcı Meta ad'ine tıklayıp siteye geldiğinde URL'de `fbclid` var. Bu değeri cookie'ye yazmazsan CAPI'ye gönderemezsin. Çözüm: GTM'de bir cookie variable oluştur, ismini `_fbc` koy, 90 gün süreyle sakla. CAPI tag'inde bu variable'ı `fbc` parametresine map et.

**2. Email hash yanlış:** Boşluk veya büyük harf kalırsa hash eşleşmez. Tüm string'leri `trim().toLowerCase()` yap, ardından SHA-256 uygula.

**3. Test mode'dan canlıya geçilmemiş:** Events Manager'da "Test Events" sekmesinde event'ler görünür ama gerçek trafik gönderilmez. `test_event_code` parametresini kaldır, production token kullan.

**4. Server container log'larına bakmamak:** sGTM Cloud Run log'larında CAPI response'ları görünür. 200 OK dışında bir şey görüyorsan (401, 400) token veya payload hatalı demektir.

**5. Pixel ve CAPI arasında veri tipi uyumsuzluğu:** Pixel `value` parametresini float gönderirken CAPI integer gönderiyor. Meta para birimini yuvarlayabilir. Çözüm: her iki tarafta da `value: parseFloat(orderTotal).toFixed(2)` kullan.

Son bir nokta: CAPI kurulumu bir kez yapılıp unutulacak bir şey değil. iOS güncellemeleri, Meta API version değişiklikleri, yeni identifier türlerinin eklenmesi (örneğin `anon_id` 2025'te beta'ya açıldı) düzenli bakım gerektiriyor. Aylık EMQ trendini takip et, 8'in altına düşerse identifier mapping'i gözden geçir. Deduplication rate'i de önemli: idealde %95+ olmalı (yani pixel+CAPI event'lerinin %95'i başarıyla dedupe ediliyor). Bu metriği Meta Events Manager'da göremezsin, kendi log pipeline'ını kurman gerekir — sGTM'den giden request ID'lerini BigQuery'ye yazıp karşılaştırabilirsin.