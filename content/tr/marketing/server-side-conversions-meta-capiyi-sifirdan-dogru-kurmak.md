---
title: "Server-Side Conversions: Meta CAPI'yi Sıfırdan Doğru Kurmak"
description: "iOS 17 ve cookie kısıtlamaları sonrası Meta CAPI + sGTM mimarisi nasıl kurulur? Deduplication, event match quality ve attribution altyapısı."
publishedAt: 2026-05-28
modifiedAt: 2026-05-28
category: marketing
i18nKey: marketing-001-2026-05
tags: [meta-capi, server-side-gtm, conversion-api, event-match-quality, attribution]
readingTime: 8
author: Roibase
---

iOS 17.4'te App Tracking Transparency (ATT) kabul oranı %12'ye düştü. Third-party cookie desteği Chrome'da 2025 Q3'te sonlandı. Meta Ads Manager'daki "Event Source" sütununda pixel contribution %40'a geriledi. Bu sayılar browser-based ölçümün artık yeterli olmadığını göstermiyor — ölçümün tamamen yeni bir mimari gerektirdiğini gösteriyor. Server-side conversion tracking bu noktada opsiyonel değil, zorunlu. Meta Conversions API (CAPI) ile server-side Google Tag Manager (sGTM) kombinasyonu, signal kaybını minimum seviyeye indiren tek altyapı.

## Browser-Based Ölçümün Artık İşlemediği Yerler

Meta pixel'i client-side JavaScript ile çalışır. Kullanıcı sayfada pixel kodu yüklenmeden önce çıkarsa event kaybolur. Safari Intelligent Tracking Prevention (ITP) cookie ömrünü 7 güne düşürür. Ad blocker kullanımı %42 seviyesinde. Bu koşullarda pixel'in gördüğü conversion sayısı gerçeğin %60-70'i. Geri kalan %30-40 "phantom conversion" — gerçekleşti ama Meta'ya rapor edilmedi.

Attribution window da daraldı. Pixel 1-day click, 7-day view ile çalışır. Ancak ITP nedeniyle 24 saat içinde dahi cookie silinebilir. Uzun satış döngüsü olan sektörlerde (B2B SaaS, finans, eğitim) conversion'ın %80'i 7+ gün sonra gelir. Pixel bu conversion'ları göremez. Kampanya ROAS'ı 1.2 gibi görünür, gerçekte 2.8'dir. Budget shift yanlış kanala gider.

Cross-device senaryolar da çöker. Kullanıcı mobilde reklamı görür, masaüstünde satın alır. Pixel farklı cookie domain'leri okuduğu için iki ayrı kullanıcı sayar. CAPI server'dan gönderildiği için kullanıcı hash'ini (email SHA-256, telefon SHA-256) taşır. İki device aynı kişi olarak eşleşir.

## CAPI + sGTM Altyapısının Çalışma Prensibi

Server-side conversion tracking iki katmandan oluşur: veri toplama katmanı (sGTM container) ve API iletim katmanı (CAPI endpoint). sGTM, Google Cloud Run üzerinde deploy edilen bir container'dır. Client-side GTM'den gelen event'leri alır, zenginleştirir, CAPI'ye POST eder. Meta server'ı veriyi alır, deduplication yapar, attribution modeline aktarır.

Veri akışı şu sırada ilerler:

1. Client-side GTM `purchase` event'i tetikler (dataLayer push)
2. Event sGTM container URL'ine HTTP POST olarak gönderilir
3. sGTM içindeki "Meta Conversions API" tag event parametrelerini okur
4. Server IP, user-agent, event_time, external_id (hash'lenmiş email) ekler
5. CAPI endpoint'e POST eder: `https://graph.facebook.com/v19.0/{pixel_id}/events`
6. Meta deduplication algoritması pixel + server event'lerini birleştirir
7. Attribution window içindeyse kampanyaya conversion atanır

sGTM'nin kritik avantajı: client-side event ile server-side event aynı event_id'yi taşır. Meta bu ID'yi görünce iki event'i çakıştırır (deduplication). Eğer pixel event gelirse ve 5 dakika içinde aynı event_id ile server event gelirse, Meta tek conversion sayar. Bu şekilde double counting önlenir.

### Event Match Quality Skoru Nasıl Artar

Meta'nın Event Match Quality (EMQ) skoru 0-10 arası ölçülür. Skor, gönderilen event parametrelerinin attribution için ne kadar kullanılabilir olduğunu gösterir. Pixel genelde 2.5-4.5 skor verir. CAPI ile 7.5-9.5'e çıkar. Skorun yükselmesi kampanya learning phase'ini hızlandırır ve CPA'yı %15-30 düşürür.

EMQ skorunu artıran parametreler:

| Parametre | Pixel sağlar mı? | Server sağlar mı? | Ağırlık |
|---|---|---|---|
| `external_id` (hash email) | ❌ | ✅ | Yüksek |
| `client_user_agent` (tam) | ✅ (limited) | ✅ (full) | Orta |
| `client_ip_address` | ❌ (proxy) | ✅ (gerçek) | Yüksek |
| `fbc` (click ID) | ✅ | ✅ | Yüksek |
| `fbp` (browser ID) | ✅ | ✅ (forwarded) | Orta |
| `event_source_url` | ✅ | ✅ | Düşük |

Pixel'in gönderemediği en kritik parametre `external_id`. GDPR/KVKK uyumlu bir consent management sistemi (CMP) ile kullanıcıdan email izni alındıktan sonra, backend bu email'i SHA-256 ile hash'leyip sGTM'ye gönderir. Meta bu hash'i kendi user graph'ine match eder. Match oranı %60-80 civarında (email doğruluğuna bağlı). Match olan kullanıcılar için attribution güvenilirliği %95'e çıkar.

## Mimari Kurulum: sGTM Container Deploy ve CAPI Konfigürasyonu

sGTM container'ı Google Cloud Run üzerinde çalıştırmak için önce GTM hesabında "Server" container tipi oluşturulur. Container ID (GTM-XXXXXX) alındıktan sonra Cloud Run'da deploy:

```bash
gcloud run deploy sgtm-roibase \
  --image=gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable \
  --platform=managed \
  --region=europe-west1 \
  --set-env-vars=CONTAINER_CONFIG={container_id} \
  --allow-unauthenticated \
  --min-instances=1 \
  --max-instances=10 \
  --cpu=1 \
  --memory=512Mi
```

`--min-instances=1` kritik: cold start'ı önler. İlk event 300ms yerine 50ms'de işlenir. Container deploy olduktan sonra GTM'de custom domain ayarlanır: `sgtm.roibase.com.tr`. Cloudflare DNS'te CNAME eklenir, SSL sertifikası otomatik yenilenir.

Client-side GTM'de "Google Tag: GA4" ayarlarında "Send to server container" seçeneği açılır, container URL yazılır. Artık her GA4 event otomatik olarak sGTM'ye de gider. sGTM içinde "Meta Conversions API" tag'i eklenir:

- **Pixel ID:** Meta Ads Manager'dan alınan 15 haneli ID
- **Access Token:** Events Manager > Settings > Generate Access Token (system user olarak)
- **Event Name:** GA4'ten gelen `event_name` parametresi (`purchase`, `add_to_cart`, vb.)
- **Event ID:** Client-side ile aynı ID (deduplication için)
- **Test Event Code:** Canlıya geçmeden önce test event'leri Meta'nın test dashboard'unda görülür

Access token'ın expiration süresi yoktur (system user token kullanılırsa). Token sızdırılırsa anında revoke edilebilir. Token sGTM container'da environment variable olarak saklanır, kod içine hardcode edilmez.

### Deduplication Stratejisi ve Event ID Yönetimi

Deduplication, pixel ve server event'lerinin çakışmasını önler. Meta'nın algoritması şu mantıkla çalışır: aynı `event_id` ve aynı `event_name` 5 dakika içinde gelirse, sadece EMQ skoru yüksek olanı sayar. Genelde server event tercih edilir (skor daha yüksek). Ancak pixel event 1 saniye önce geldiyse ve server event 6 dakika sonra geldiyse, iki event de ayrı ayrı sayılır.

Client-side event_id üretimi şu şekilde yapılır:

```javascript
// dataLayer push öncesi
const eventId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
window.dataLayer.push({
  event: 'purchase',
  transaction_id: '12345',
  value: 99.99,
  currency: 'TRY',
  event_id: eventId // server'a da aynı ID gönderilecek
});
```

sGTM tarafında bu `event_id` parametresi CAPI payload'ına eklenir:

```json
{
  "data": [{
    "event_name": "Purchase",
    "event_time": 1748448000,
    "event_id": "1748448000abc123",
    "event_source_url": "https://www.roibase.com.tr/checkout",
    "user_data": {
      "external_id": ["7d8a..."], 
      "client_ip_address": "85.34.x.x",
      "client_user_agent": "Mozilla/5.0..."
    },
    "custom_data": {
      "currency": "TRY",
      "value": 99.99
    }
  }],
  "test_event_code": "TEST12345"
}
```

Test event code canlıya geçince kaldırılır. Canlı ortamda gelen event'ler Meta Events Manager > Data Sources > {pixel_id} > Events altında 10 saniye içinde görülür. EMQ skoru da aynı sayfada real-time güncellenir.

## Attribution Window ve Incrementality Testi

CAPI ile attribution window genişler. Pixel 7-day click / 1-day view ile sınırlıyken, CAPI 28-day click / 1-day view destekler. Ancak iOS kullanıcıları için SKAdNetwork attribution window'u 0-day (ATT reddedilmişse) veya 3-day (ATT kabul edilmişse) olur. CAPI bu sınırı aşamaz — iOS kısıtlaması platform seviyesinde.

Attribution güvenilirliğini test etmek için geo-based holdout test yapılır. Türkiye'de 10 şehir seçilir: 5'inde CAPI aktif, 5'inde sadece pixel aktif. 4 hafta sonra iki grup arasındaki conversion farkı ölçülür. CAPI grubunda conversion sayısı %22-35 daha yüksek görünür (çünkü signal kaybı az). Bu fark "incrementality" değildir — sadece ölçüm farkıdır. Gerçek incrementality için Meta Conversion Lift testi yapılır: kampanya tamamen kapatılıp organic conversion'a bakılır.

[Performans Pazarlaması (PPC)](https://www.roibase.com.tr/tr/ppc) stratejileri CAPI altyapısı üzerine kurulur. Bidding algoritması server-side conversion'ları görünce campaign budget optimization (CBO) daha hızlı öğrenir. Learning phase 5-7 günden 2-3 güne düşer.

## Yaygın Hatalar ve Güvenlik Katmanı

En sık yapılan hata: client-side event_id ile server-side event_id'nin eşleşmemesi. Bu durumda Meta iki ayrı conversion sayar, ROAS şişer. İkinci hata: `external_id` parametresine plain-text email göndermek. GDPR ihlalidir ve Meta event'i reddeder. Hash algoritması SHA-256 olmalı, email lowercase ve trimmed olmalı:

```python
import hashlib
email = "user@example.com"
hashed = hashlib.sha256(email.strip().lower().encode()).hexdigest()
# 7d8a3c2e1f... gibi 64 karakterlik hash
```

Güvenlik katmanı: sGTM container IP'si Meta'da whitelisting yapılır. Sadece belirli IP'lerden gelen event'ler kabul edilir. Access token rotate süresi 90 gün. Token sızdığında Events Manager'dan anında revoke edilir, yeni token 30 saniyede üretilir.

Pixel fallback senaryosu: sGTM downtime'da olursa (Cloud Run region fail, DNS sorun), client-side pixel direkt Meta'ya event gönderir. Bu dual-send stratejisi %99.95 uptime garantisi verir. Ancak bu durumda deduplication çalışmaz — iki event ayrı ayrı sayılır. Monitoring: sGTM container logları Stackdriver'a akar, critical error'da Slack webhook tetiklenir.

Meta CAPI + sGTM mimarisi 2026'da performans pazarlamasının backbone'u. iOS privacy update'leri devam ettikçe browser-based tracking daha da daraldı. Şirketler bu geçişi "trend" olarak değil, "platform requirement" olarak görmeldi. EMQ skoru 7+ olmayan kampanyalar öğrenme fazında takılıyor, CPA %40+ yüksek çıkıyor. Mimariyi doğru kurmak engineering disiplini gerektirir — copy-paste tutorial'lar yetmiyor. Server-side altyapı first-party veri stratejisiyle birleştiğinde attribution güvenilirliği %95'e çıkıyor. Şimdi sıra test event'lerini canlı trafiğe geçirip EMQ skorunu izlemekte.