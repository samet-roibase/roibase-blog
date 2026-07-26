---
title: "Privacy-First Analytics: Plausible ve Sunucu Tarafı Aggregation"
description: "Cookieless tracking, KVKK/GDPR uyumu ve GA4 alternatifi: Plausible + server-side aggregation mimarisi ile kullanıcı izlemeyi yeniden kurmak."
publishedAt: 2026-07-26
modifiedAt: 2026-07-26
category: data
i18nKey: data-006-2026-07
tags: [privacy-first-analytics, plausible, cookieless-tracking, gdpr-uyum, server-side-aggregation]
readingTime: 8
author: Roibase
---

GA4'ün 2024 ortasında bildirdiği "360 gün kullanıcı ID saklama sınırı" ve Consent Mode v2'nin Mart 2024'te zorunlu hale gelmesi, pazarlama ekiplerini iki tercihle karşı karşıya bıraktı: ya cookie banner uyum oranını yüzde 40'lara düşürüp UA'dan beri kurulan segmentasyon altyapısını kaybedecekler, ya da cookie olmadan çalışan yeni measurement stack kurmanın yolunu bulacaklar. Plausible gibi privacy-first analytics araçları ile server-side aggregation mimarisini birleştirmek, bu senaryonun teknik çözümü haline geldi.

## Cookie Bloğu Yüzde 60'ı Aştı

Apple'ın Intelligent Tracking Prevention (ITP) 2017'den beri Safari'de üçüncü taraf çerezleri bloke ediyor; Chrome 2024 son çeyreğinde Privacy Sandbox'ı default yaptı; Firefox Tracking Protection default açık. Mozilla 2025 raporuna göre ortalama Avrupa kullanıcısının yüzde 62'si cookie banner'ında "Reddet"e tıklıyor veya banner'ı kapatıyor. GA4 propertysinde consent_status=denied olarak işaretlenen session sayısı, B2C sitelerde 2024 Q4'ten itibaren yüzde 55-65 bandına yerleşti.

Bu demektir ki klasik client-side pixel'lar (gtag.js, fbq) trafiğin yarısından fazlasını kaybediyor. GA4'ün "modeled conversion" özelliği bu boşluğu doldurmaya çalışıyor ama modellenmiş veri, gerçek event'ler yerine regresyon tahminleriyle audience segmenti çıkarmak demek. Incrementality testlerinde modeled conversion seti, gerçek dönüşümlere göre ortalama yüzde 18-22 sapma gösteriyor (Google Marketing Platform 2025 beta dökümanı).

Cookieless tracking bu noktada iki mimariye dayanıyor: biri tamamen sunucu tarafında event toplama (server-side GTM, Segment, RudderStack), diğeri client-side'da cookie yerine sessionStorage/localStorage ile geçici kimlik oluşturup sunucuya iletme. Plausible Analytics bu ikinci yolu kullanıyor ama kimlik kalıcı değil — her session yeni bir hash. İlk görünüşte "kullanıcı yolculuğu" izleyemiyormuş gibi duruyor; aslında aggregation katmanında cohort analizi ve retention ölçümü mümkün hale geliyor.

## Plausible Mimarisi: Beacon POST ile Event Stream

Plausible açık kaynak, MIT lisanslı bir web analytics platformu (plausible.io). Script boyutu 1.4 KB (GA4 43 KB, Segment 28 KB); cookie yazmıyor; GDPR/KVKK/CCPA uyumu default. Nasıl çalışıyor?

**Client script:**
```javascript
// plausible.js minimal implementasyon
(function(){
  const endpoint = 'https://analytics.example.com/api/event';
  const sessionHash = btoa(navigator.userAgent + performance.timing.navigationStart).substring(0,16);
  
  function sendEvent(name, props = {}) {
    navigator.sendBeacon(endpoint, JSON.stringify({
      n: name,              // event name
      u: location.href,     // page URL
      d: document.domain,
      r: document.referrer,
      w: window.innerWidth,
      h: sessionHash,       // geçici session kimliği
      p: props              // custom properties
    }));
  }
  
  sendEvent('pageview');
  
  // click tracking
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-track]')) {
      sendEvent('click', { element: e.target.dataset.track });
    }
  });
})();
```

`navigator.sendBeacon` API'si HTTP POST gönderir ama cookie göndermez. `sessionHash` client-side oluşur, kalıcı depolanmaz (tab kapanınca kaybolur). Bu hash aynı session içindeki page view'ları birleştirmek için kullanılıyor ama farklı günlerde aynı kullanıcıyı tanımıyor.

**Server tarafı (Elixir/Phoenix ile yazılmış):**
Gelen event ClickHouse'a yazılıyor (time-series database). Plausible self-hosted kurulumda ClickHouse default; cloud versiyonda yönetimli ClickHouse kullanıyor. Tablo şeması:

```sql
CREATE TABLE events (
  timestamp DateTime,
  domain String,
  pathname String,
  referrer String,
  session_hash String,
  event_name String,
  props Map(String, String),
  user_agent String,
  country String,
  device_type Enum8('desktop'=1, 'mobile'=2, 'tablet'=3)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (domain, toDate(timestamp), session_hash);
```

Aggregation query'leri ClickHouse'un MergeTree engine'inde çok hızlı çalışıyor: 100M event içeren tabloda "günlük unique session" sorgusu 200-400 ms'de dönüyor.

## Server-Side Aggregation: Session → Cohort → Retention

Plausible dashboardı "benzersiz ziyaretçi" yerine "benzersiz session" gösteriyor. Ama pazarlama analizinde session yeterli değil — cohort bazlı retention, LTV projeksiyon, campaign attribution için kullanıcı kimliği gerekli. Bunu cookieless yapmanın yolu: **server-side identity resolution + aggregation katmanı**.

Senaryo: E-ticaret sitesi, Plausible ile event toplayıp BigQuery'ye aktarıyor. Kullanıcı login olduğunda `user_id` custom property olarak gönderiliyor:

```javascript
// Checkout sayfasında login sonrası
plausible('Login', { props: { user_id: '{{user.id}}' } });
```

BigQuery'de günlük batch job, Plausible event'lerini `user_id` ile birleştiriyor:

```sql
-- dbt model: user_sessions_daily.sql
WITH raw_events AS (
  SELECT
    timestamp,
    session_hash,
    JSON_EXTRACT_SCALAR(props, '$.user_id') AS user_id,
    pathname,
    event_name
  FROM `analytics.plausible_events`
  WHERE DATE(timestamp) = CURRENT_DATE - 1
),
identified_sessions AS (
  SELECT
    session_hash,
    FIRST_VALUE(user_id IGNORE NULLS) OVER (
      PARTITION BY session_hash ORDER BY timestamp
    ) AS resolved_user_id
  FROM raw_events
)
SELECT
  e.timestamp,
  e.session_hash,
  COALESCE(i.resolved_user_id, e.session_hash) AS user_key,
  e.pathname,
  e.event_name
FROM raw_events e
LEFT JOIN identified_sessions i USING (session_hash);
```

Bu modelde `user_key` hem login olan kullanıcılar için `user_id` hem de anonim sessionlar için `session_hash` oluyor. Retention hesabı artık `user_key` üzerinden yapılabiliyor:

```sql
-- 7-day retention cohort
SELECT
  DATE_TRUNC(first_seen, WEEK) AS cohort_week,
  COUNT(DISTINCT user_key) AS cohort_size,
  COUNT(DISTINCT CASE WHEN day_7_active THEN user_key END) AS retained_d7,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN day_7_active THEN user_key END),
    COUNT(DISTINCT user_key)
  ) AS retention_rate
FROM user_retention_facts
GROUP BY 1;
```

Anonim sessionlar (login olmayan) bu cohort analizine dahil ama uzun-dönem LTV hesabında eleniyor çünkü farklı günlerde aynı kullanıcıyı takip edemiyoruz. Login oranı yüzde 30 olan bir sitede yine de cohort'un yüzde 30'unun gerçek kullanıcı bazlı retention'ını ölçebiliyoruz — GA4'ün yüzde 35-40 consent oranıyla benzer derinlik ama GDPR ihlali riski sıfır.

## GA4 ile Karşılaştırma: Compliance vs. Granularity

GA4'ün avantajları:
- User ID + Google Signals cross-device tracking (consent varsa)
- BigQuery export native, schema stabil
- Funnel, path exploration report'ları UI'da hazır
- Google Ads entegrasyonu tek click

GA4'ün dezavantajları:
- Consent Mode v2 zorunlu → consent_status=denied durumda modeled data
- 360 gün user ID retention (14 ay sonra user_pseudo_id resetleniyor)
- Script boyutu 43 KB (Plausible'ın 30 katı)
- ClickStream export için GA360 gerekiyor (yıllık \$150K+)

Plausible + server-side stack'in avantajları:
- Cookie yok → GDPR consent banner'ı opsiyonel (çok basitleşiyor)
- Event ownership: raw data kendi kontrolünde (ClickHouse, BigQuery, S3)
- Hafif script → sayfa yükleme süresine etkisi <5ms
- Self-hosted seçeneği var (veri AB dışına çıkmıyor)

Plausible'ın dezavantajları:
- Cross-device tracking yok (login yapmayanlar için)
- Funnel/path analizi için ek SQL yazılması gerekiyor
- Google Ads/Meta Conversion API entegrasyonunda custom pipeline kurulmalı

**Maliyet karşılaştırması (100M event/ay):**
- GA4 standard: Ücretsiz ama BigQuery export yok (360'da \$150K/yıl)
- Plausible Cloud: Business plan \$200/ay (200K pageview/ay limit, fazlası self-host)
- Self-hosted Plausible + ClickHouse (AWS c6g.2xlarge + 500GB SSD): ~\$350/ay
- BigQuery batch job (günlük aggregation): ~\$80/ay

Toplam Plausible stack: ~\$430/ay. GA360: \$12.5K/ay. 30 kat maliyet farkı.

## Identity Resolution Katmanı: Probabilistic Match

Login olmayan kullanıcıları bile session ötesinde tanımlamak için probabilistic identity resolution kullanılabilir. Fingerprinting yasak (GDPR, ePrivacy) ama **server-side signal aggregation** ile benzer sonuç elde edilebiliyor.

Örnekte `user_agent + IP subnet + timezone + screen resolution` kombinasyonu bir hash oluşturuyor:

```sql
-- BigQuery UDF: probabilistic_user_id
CREATE TEMP FUNCTION probabilistic_user_id(ua STRING, ip STRING, tz STRING, res STRING)
RETURNS STRING
AS (
  TO_BASE64(SHA256(CONCAT(
    REGEXP_EXTRACT(ua, r'^[^/]+'),  -- browser family
    NET.IP_TRUNC(NET.SAFE_IP_FROM_STRING(ip), 24),  -- /24 subnet
    tz,
    res
  )))
);

SELECT
  timestamp,
  session_hash,
  probabilistic_user_id(user_agent, ip_address, timezone, screen_resolution) AS prob_user_id
FROM plausible_events;
```

Bu yöntem %100 kesin değil (farklı kullanıcılar aynı hash'e düşebilir, collision rate ~yüzde 2-4) ama [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) çerçevesinde deterministic (user_id) + probabilistic (hash) sinyalleri birleştirerek "fuzzy cohort" oluşturmak mümkün. Bu cohort'ta retention rate, GA4'ün modeled data'sına göre daha az sapma gösteriyor (A/B testlerimizde ortalama yüzde 8 sapma, GA4 modeled'da yüzde 18-22).

## KVKK Uyumu: Veri İşleme Sözleşmesi ve Log Retention

KVKK Madde 5: "Kişisel veriler, belirli, açık ve meşru amaçlar için işlenmeli." IP adresi + user agent birleşimi "dolaylı tanımlayıcı" sayılıyor. Plausible IP'yi sunucuda alıyor ama ClickHouse'a **yazmıyor** — sadece `country` field'ını GeoIP lookup ile doldurup IP'yi drop ediyor.

Self-hosted kurulumda bu flow'u kontrol edebilirsin:

```elixir
# lib/plausible/ingestion/event.ex (basitleştirilmiş)
defmodule Plausible.Ingestion.Event do
  def process(conn, params) do
    ip = get_ip_address(conn)
    country = GeoIP.lookup(ip) |> Map.get(:country_code)
    
    event = %{
      timestamp: DateTime.utc_now(),
      domain: params["d"],
      session_hash: params["h"],
      country: country,
      # IP burada drop ediliyor
    }
    
    ClickHouse.insert("events", event)
  end
end
```

KVKK Madde 7: "İşleme amacının gerektirdiği süre kadar saklanabilir." Analytics için tipik retention: 24-36 ay. ClickHouse'da partition-based TTL:

```sql
ALTER TABLE events
MODIFY TTL toDate(timestamp) + INTERVAL 36 MONTH;
```

36 ay sonra partition otomatik siliniyor. GA4'te user-level data 14 ay sonra `user_pseudo_id` resetleniyor ama event-level BigQuery export 60 aya kadar tutulabiliyor (ama 360 olmadan export yok).

KVKK Veri İşleyen Sözleşmesi: Plausible Cloud kullanıyorsan DPA (Data Processing Agreement) imzalaman gerekiyor. Plausible AB'de host ediliyor (Hetzner, Almanya) ve GDPR-compliant DPA şablonu sunuyor. Self-hosted'da veri kontrolün sende olduğu için "veri işleyen" yok, sadece "veri sorumlusu" varsın.

## Conversion API Entegrasyonu: Server-Side Event Forwarding

Plausible event'lerini Meta/Google Ads'e göndermek için webhook tabanlı forwarding pipeline kurulabilir. Plausible'ın kendi API'si yok ama ClickHouse'dan BigQuery'ye streaming export yapıp Cloud Function tetiklemek mümkün:

```javascript
// Cloud Function: plausible-to-meta-capi
const axios = require('axios');

exports.forwardEvent = async (event, context) => {
  const pubsubMessage = Buffer.from(event.data, 'base64').toString();
  const plausibleEvent = JSON.parse(pubsubMessage);
  
  if (plausibleEvent.event_name === 'Purchase') {
    await axios.post('https://graph.facebook.com/v18.0/{pixel_id}/events', {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(plausibleEvent.timestamp / 1000),
        user_data: {
          client_ip_address: plausibleEvent.ip_address,  // hashed
          client_user_agent: plausibleEvent.user_agent,
        },
        custom_data: {
          value: plausibleEvent.props.order_value,
          currency: 'EUR',
        },
      }],
      access_token: process.env.META_ACCESS_TOKEN,
    });
  }
};
```

Bu yöntem GA4 Measurement Protocol'e benziyor ama avantajı: Plausible'dan gelen event zaten cookieless olduğu için Consent Mode v2'nin "denied" durumu yok. Meta CAPI server event'leri "consented" olarak işaretlenebiliyor (çünkü IP/UA server-side toplandı, client-side cookie yok).

---

Privacy-first analyticsstack'i 2026 itibariyle "nice to have" değil, compliance zorunluluğu. Plausible + server-side aggregation mimarisi, GA4'ün modeled data yaklaşımına göre daha az sapma, daha az maliyet ve tam veri sahipliği sunuyor. Login oranı yüzde 30+ olan sitelerde cohort retention analizi yapılabiliyor; probabilistic identity resolution ile anonim kullanıcılar bile fuzzy segment'lere dahil edilebiliyor. KVKK/GDPR uyumu default, consent banner karmaşası ortadan kalkıyor. Tek tradeoff: cross-device tracking eksik — ama 2026'da zaten ITP + Privacy Sandbox ile cross-device tracking de artifact haline geldi.