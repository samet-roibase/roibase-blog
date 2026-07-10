---
title: "Privacy-First Analytics: Plausible + Sunucu Tarafı Aggregation"
description: "Cookieless ölçüm mimarisi: Plausible, sunucu tarafı aggregation ve KVKK/GDPR uyumlu tracking. GA4 karşılaştırması ve first-party veri entegrasyonu."
publishedAt: 2026-07-10
modifiedAt: 2026-07-10
category: data
i18nKey: data-006-2026-07
tags: [privacy-first-analytics, cookieless-tracking, plausible, kvkk-gdpr, sunucu-tarafi-olcum]
readingTime: 8
author: Roibase
---

Google Analytics 4'ün consent mode v2 zorunluluğu ve KVKK'nın 2024 ceza rekorları pazarlama ölçümünü yeniden kurguluyor. Avrupa'da web trafiğinin %42'si tracking'i engelliyor (Ghostery 2025 verisi), Türkiye'de bu oran %28'de. Client-side cookie'ye dayalı sistemler artık trafiğin üçte birini kaybediyor. Privacy-first analytics bu noktada teknik ihtiyaç, compliance strateji ve kullanıcı deneyimi arasında denge kuruyor. Plausible gibi cookieless çözümler ile sunucu tarafı aggregation mimarisi bu dengeyi somut veri noktalarında sağlıyor.

## Cookieless Analytics'in Mimari Mantığı

Privacy-first analytics, client-side identifier'a (cookie, device ID) bağımlı olmadan kullanıcı davranışını aggregate ediyor. Plausible, LocalStorage veya cookie yazmadan page view, referrer, UTM parametresi ve event tracking yapıyor. Her hit sunucuya POST request'le gidiyor, sunucu anonymous hash üretiyor (IP + User-Agent + site domain + rotating salt), bu hash 24 saatlik sliding window'da unique visitor sayısını hesaplıyor. Hash persistent değil — her gün sıfırlanıyor, yeniden identification mümkün değil.

GA4'te user identifier cookie'ye yazılıyor (`_ga`, 2 yıl yaşam süresi), cross-domain tracking için `_ga` parametresi URL'e ekleniyor. KVKK ve GDPR kapsamında bu açık consent gerektiriyor — consent banner'ı reddettiğinde tracking durur. Plausible'da consent banner'a gerek yok çünkü kişisel veri işlenmiyor. KVKK Madde 5(2)(a) kapsamında "anonim hale getirilmiş veri" sayılıyor. Türkiye Kişisel Verileri Koruma Kurumu 2025/34 sayılı kararında "IP + UA hash'inin 24 saatte silinmesi" anonim kabul edildi.

Bu mimari tradeoff getiriyor: funnel analysis, cohort retention, cross-device journey mapping — bunlar user-level identifier olmadan çalışmıyor. Plausible goal completion ve source/medium breakdown veriyor ama segment bazlı LTV veya session replay vermiyor. Bu noktada aggregation katmanı devreye giriyor.

## Sunucu Tarafı Aggregation Katmanı

Cookieless tracking'in eksiklerini kapatmak için sunucu tarafında event stream'ini pre-aggregate etmek gerekiyor. Mimari şöyle işliyor: Plausible raw event'i kendi API'sine gönderirken aynı payload'u webhook'la kendi backend'ine de POST ediyorsun. Backend event'i BigQuery'ye yazıyor, dbt modelleri üzerinden günlük aggregation job'ları koşuyor.

Örnek dbt model (event bazlı günlük özet):

```sql
WITH daily_events AS (
  SELECT
    DATE(timestamp) AS event_date,
    page_path,
    referrer_source,
    utm_campaign,
    COUNT(*) AS page_views,
    COUNT(DISTINCT session_hash) AS sessions,
    SUM(CASE WHEN event_name = 'goal_completed' THEN 1 ELSE 0 END) AS conversions
  FROM {{ ref('plausible_raw_events') }}
  WHERE DATE(timestamp) = CURRENT_DATE() - 1
  GROUP BY 1, 2, 3, 4
)
SELECT
  event_date,
  page_path,
  referrer_source,
  utm_campaign,
  page_views,
  sessions,
  conversions,
  SAFE_DIVIDE(conversions, sessions) AS conversion_rate
FROM daily_events
```

Bu model her sabah koşuyor, dünkü trafiği source/medium/campaign bazında özetliyor. Session hash client-side üretilmiş rotating identifier — IP + UA + timestamp sliding window'dan türetiliyor, 1 saatte expire oluyor. Bu hash'i BigQuery'de JOIN yaparak multi-page session'ları birleştiriyorsun ama user'ı persistent identifier'a bağlamıyorsun.

GA4'ün funnel report'una benzer analiz için event sequence'i aggregation tablosunda tutuyorsun:

```sql
SELECT
  session_hash,
  ARRAY_AGG(page_path ORDER BY timestamp) AS page_sequence,
  MIN(timestamp) AS session_start,
  MAX(timestamp) AS session_end
FROM {{ ref('plausible_raw_events') }}
WHERE DATE(timestamp) = CURRENT_DATE() - 1
GROUP BY session_hash
```

Session bitince hash expire oluyor, ertesi gün aynı kullanıcı yeni hash alıyor. Bu yöntem KVKK'ya uygun çünkü "kalıcı tanımlayıcı" yok.

### Server-Side GTM Entegrasyonu

Plausible'ı [first-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) içine entegre etmek için server-side Google Tag Manager (sGTM) üzerinden event routing yapıyorsun. Client-side Plausible script'i event'i doğrudan Plausible sunucusuna gönderirken aynı event'i sGTM container'ına da POST ediyorsun. sGTM tarafında custom tag bu event'i Conversion API'ye, CDP'ye ve BigQuery'ye paralel iletiyor.

sGTM tag config örneği (Plausible event → BigQuery sink):

```javascript
const eventData = getAllEventData();
const BigQuery = require('BigQuery');

BigQuery.insert({
  projectId: 'roibase-analytics',
  datasetId: 'plausible_events',
  tableId: 'raw_events',
  rows: [{
    timestamp: eventData.timestamp,
    page_path: eventData.page_url,
    referrer: eventData.referrer,
    utm_source: eventData.utm_source,
    session_hash: eventData.session_id,
    event_name: eventData.event_name
  }]
});
```

Bu kurulum 3 avantaj sağlıyor: (1) Plausible'ın dashboard'u real-time çalışıyor, (2) BigQuery'de historical veri birikiyor, (3) CDP (Segment, RudderStack) event stream'ini alıp user profile'a eklemiyor çünkü persistent ID yok — sadece aggregate metric'leri kullanıyor.

## GA4 Karşılaştırması: Attribution ve Compliance Tradeoff'ları

GA4 ile Plausible + sGTM mimarisini attribution kabiliyeti, compliance yükü ve operasyonel maliyet açısından karşılaştırmak gerekiyor. Aşağıdaki tablo somut farkları gösteriyor:

| Metrik | GA4 | Plausible + sGTM |
|--------|-----|------------------|
| **User tracking süresi** | 2 yıl (cookie) | 24 saat (hash) |
| **Cross-device attribution** | Evet (Google Signals) | Hayır |
| **Consent banner gerekliliği** | Evet (KVKK/GDPR) | Hayır (anonim) |
| **Data residency kontrolü** | ABD (GCP) | Kendi sunucun |
| **Session stitching** | Otomatik (client ID) | Manuel (event sequence) |
| **Funnel analysis derinliği** | User-level | Session-level |
| **Operasyonel setup süresi** | 2 saat | 8 saat (backend + dbt) |

GA4'ün güçlü yanı user-level attribution: cross-device journey mapping, audience segmentation, remarketing list'i otomatik oluşuyor. Ancak bu güç compliance maliyetiyle geliyor. KVKK Madde 12 kapsamında kullanıcıya "veri işleme amaçları" açıklanmalı, Madde 13'e göre "veri sahibinin hakları" bildirilmeli. Consent banner'ı %65 oranında trafik kaybına yol açıyor (CookieBot 2025 benchmark'ı). Plausible'da bu maliyet yok ama user-level LTV hesaplayamıyorsun — segment bazlı cohort analysis yapman gerekiyor.

Attribution model farkı da kritik: GA4 data-driven attribution kullanıyor (makine öğrenmesiyle touchpoint'lere ağırlık veriyor), Plausible sadece last-click ve first-click seçeneği sunuyor. Multi-touch attribution için BigQuery'deki event sequence'i kendi modelinle işlemen gerekiyor. Örnek MMM (Marketing Mix Modeling) yaklaşımı: günlük aggregate veriyi (spend, impressions, sessions, conversions) regression model'e sok, her kanalın incremental katkısını hesapla. Bu yöntem user-level veri olmadan çalışıyor.

## Operasyonel Kurulum: Plausible Self-Hosted + dbt Pipeline

Privacy-first analytics'i production'a taşımak için Plausible self-hosted instance'ını kendi sunucuna deploy etmen gerekiyor. Plausible Cloud (plausible.io) veriyi kendi sunucusunda tutuyor — data residency kontrolü istiyorsan self-hosted tek seçenek. Docker Compose ile kurulum 30 dakikada bitiyor:

```yaml
version: "3.3"
services:
  plausible:
    image: plausible/analytics:latest
    command: sh -c "sleep 10 && /entrypoint.sh db createdb && /entrypoint.sh db migrate && /entrypoint.sh run"
    depends_on:
      - plausible_db
      - plausible_events_db
    ports:
      - "8000:8000"
    env_file:
      - plausible-conf.env
```

`plausible-conf.env` içinde `DISABLE_AUTH=false` ve `SECRET_KEY_BASE` tanımla. Instance ayağa kalktıktan sonra BigQuery sink için webhook kur. Plausible'ın built-in webhook'u yok — custom middleware yazman gerekiyor. Node.js Express endpoint örneği:

```javascript
app.post('/plausible-webhook', async (req, res) => {
  const event = req.body;
  await bigquery.dataset('plausible_events').table('raw_events').insert([{
    timestamp: new Date(event.timestamp).toISOString(),
    page_path: event.url,
    referrer: event.referrer,
    utm_source: event.utm_source,
    session_hash: generateSessionHash(req.ip, req.headers['user-agent'])
  }]);
  res.sendStatus(200);
});
```

Session hash fonksiyonu IP + User-Agent + günlük salt'tan SHA-256 üretiyor:

```javascript
function generateSessionHash(ip, userAgent) {
  const salt = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return crypto.createHash('sha256').update(ip + userAgent + salt).digest('hex');
}
```

Bu hash her gün sıfırlanıyor — 24 saatlik pencerede unique visitor sayısını doğru hesaplıyor ama persistent tracking yapmıyor.

dbt pipeline'ını Github Actions ile schedule et. Her sabah 06:00'da `dbt run --select +plausible_daily_summary` komutu koşsun, dünkü aggregate'ler hesaplansın. Looker veya Metabase'de dashboard'ları bu aggregate tablolardan besle. Real-time metrik için Plausible'ın kendi dashboard'unu kullan, historical trend için BigQuery+dbt çıktılarını kullan.

## CDP ve Retention Engineering'e Entegrasyon

Privacy-first analytics'i müşteri veri platformuna (CDP) bağlamak paradoksal görünüyor — CDP user profile tutuyor, Plausible anonim veri üretiyor. Çözüm event bazlı entegrasyon: CDP'ye user identifier göndermeden aggregate metric'leri email veya phone hash'ine bağlıyorsun. Örnek: e-posta kampanyasına tıklayan kullanıcı site'ye geliyor, Plausible session hash'i ile event'leri kaydediyor. Kullanıcı form doldurup email verdiğinde backend email'i SHA-256 ile hash'liyor, o session'daki event'leri email hash'ine bağlıyor.

BigQuery'de bu JOIN işlemi şöyle çalışıyor:

```sql
WITH session_events AS (
  SELECT session_hash, page_path, timestamp
  FROM plausible_raw_events
  WHERE DATE(timestamp) = CURRENT_DATE() - 1
),
identified_sessions AS (
  SELECT email_hash, session_hash, form_submit_timestamp
  FROM user_identifications
  WHERE DATE(form_submit_timestamp) = CURRENT_DATE() - 1
)
SELECT
  i.email_hash,
  ARRAY_AGG(STRUCT(e.page_path, e.timestamp) ORDER BY e.timestamp) AS session_journey
FROM identified_sessions i
JOIN session_events e ON i.session_hash = e.session_hash
WHERE e.timestamp <= i.form_submit_timestamp
GROUP BY i.email_hash
```

Bu sorgu form submit'inden önceki session journey'sini email hash'ine bağlıyor. CDP'de (Segment, RudderStack, Insider) bu veri "anonymous → identified" transition olarak saklanıyor. KVKK kapsamında kullanıcı email'ini verdiği anda açık rıza vermiş sayılıyor (form'da KVKK metni varsa), o noktadan sonra email hash'ini persistent identifier olarak kullanabiliyorsun. Form öncesi session anonim kalıyor — user-level tracking değil, "email verenler" segmenti için aggregate funnel analysis yapıyorsun.

Retention engineering için bu yöntem güçlü: CDP'de "site ziyaret etti ama form doldurmadı" segmentini cookieless olarak yakalayamıyorsun. Ancak "form dolduranların site'ye ilk gelişten itibaren yolculuğu" verisini aggregate olarak alıyorsun. Cohort retention hesaplamak için form submit tarihinden itibaren 7/30/90 gün sonra tekrar session hash'i eşleşenleri sayıyorsun. Bu yöntem exact retention rate vermiyor (aynı kullanıcı farklı hash alabilir) ama segment-level trend doğru çıkıyor.

## Cookieless Gelecek: Hangi Metrik'ler Hayatta Kalıyor

Privacy-first analytics'in uzun vadede ölçüm kabiliyetini nasıl sınırladığını somut metrik'lerle görmek gerekiyor. Aşağıdaki tablo hangi KPI'ların cookieless ortamda hesaplanabildiğini, hangilerinin kaybolduğunu listeliyor:

**Hayatta kalan metrikler:**
- **Traffic source/medium:** Referrer header ve UTM parametreleri cookieless çalışıyor
- **Page view ve bounce rate:** Session-level aggregate yeterli
- **Goal completion rate:** Event tracking anonymous olarak çalışıyor
- **Geographic ve device distribution:** IP (hashed) ve User-Agent aggregate veriyor

**Kaybolan metrikler:**
- **User-level LTV:** Persistent identifier yok, cohort-level LTV'ye dönüyor
- **Cross-device attribution:** Aynı kullanıcının mobil + desktop journey'si birleşmiyor
- **Remarketing audience:** User list oluşturamıyorsun (KVKK uyumsuz olur)
- **Session stitching (1 saatten uzun):** Hash expire oluyor, long-tail session parçalanıyor

Marketing mix modeling (MMM) bu ortamda öne çıkıyor: aggregate veriyle (günlük spend, impressions, conversions) regression model kur, her kanalın incremental katkısını hesapla. Incrementality test için holdout grup oluştur (geo-based veya time-based), test grubunun aggregate conversion rate'ini kontrol grubuyla karşılaştır. Bu yöntemler user-level veri olmadan çalışıyor.

Plausible + sunucu tarafı aggregation mimarisi KVKK/GDPR compliance'ını sıfır maliyetle sağlıyor, consent banner kaybını ortadan kaldırıyor ve data residency kontrolünü veriyor. Tradeoff açık: user-level attribution yerine segment-level insight, cross-device journey yerine session-level funnel. Ancak %30 tracking engelleme oranında GA4'ün user-level verisi de zaten eksik — privacy-first mimari dürüst veri sağlıyor. Şimdi yapılacak iş: mevcut GA4 setup'ını audit et, hangi report'ların user-level identifier gerektirdiğini belirle, cookieless alternatifleri BigQuery + dbt ile kur, 30 günlük paralel run ile iki sistemi karşılaştır.