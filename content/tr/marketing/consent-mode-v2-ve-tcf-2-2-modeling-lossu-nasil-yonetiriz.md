---
title: "Consent Mode v2 ve TCF 2.2: Modeling Loss'u Nasıl Yönetiriz"
description: "GDPR uyumlu consent architecture'da modeled conversion'ların güvenilirliğini artırmanın mühendislik yöntemi — signal loss olmadan yasal risk azaltma."
publishedAt: 2026-06-09
modifiedAt: 2026-06-09
category: marketing
i18nKey: marketing-006-2026-06
tags: [consent-mode, tcf-22, gdpr, conversion-modeling, signal-loss]
readingTime: 8
author: Roibase
---

Google Consent Mode v2 ve IAB TCF 2.2 zorunluluğu Avrupa trafiği taşıyan her platformu aynı sorunla karşı karşıya bıraktı: consent verilmediğinde cookie siliniyor, tag'ler devre dışı kalıyor, conversion sinyalleri kaybolup modeled conversion'a dönüşüyor. Aynı anda hem yasal risk azaltmak hem de attribution accuracy'yi korumak gerekiyor. Bu tradeoff'u yönetmek için consent architecture'ı mühendislik disipliniyle kurmak zorundasın — çünkü %30-50 oranında consent reddi durumunda modeling loss kontrolden çıkarsa bidding algoritması körleşir, CAC patlar, ROAS çöker.

## Consent Mode v2 Nedir ve Neden Şimdi Kritik

Google Consent Mode v2, Mart 2024'te zorunlu hale geldi (EEA trafiği için). Temel fark: artık `ad_storage` ve `analytics_storage` flag'leri default `denied` başlıyor ve kullanıcı consent verene kadar cookie yazılamıyor. Tag'ler yine ateşleniyor ama pixel-level identifier yerine aggregated ping atıyorlar. Bu modelde Google Ads ve GA4, eksik conversion'ları *machine learning tabanlı modelleme* ile tamamlamaya çalışıyor — yani gerçek conversion'ı görmüyorlar, benzer kullanıcı segmentlerinden istatistiksel tahmin yapıyorlar.

IAB TCF 2.2 (Transparency & Consent Framework) ise consent string'i daha granular hale getirdi. Artık "legitimate interest" temelinde bile cookie yazamıyorsun — kullanıcı açıkça onay vermeli. Bu, eski CMP'lerde "pre-ticked box" gibi karanlık UX desenlerine dayanan consent rate'leri %70-80'lerden %30-40'lara düşürdü.

Modeling loss burada devreye giriyor: eğer consent vermeyen kullanıcılar %50 ise ve onların conversion'larını göremiyorsan, Google Ads tCPA/tROAS bid strategy'si yanlış sinyalle optimize oluyor. Modeled conversion'lar confidence interval'ları geniş ve delayed — bu da budget allocation hataları ve creative test'lerin istatistiksel güvensizliğini artırıyor.

## Signal Loss vs. Modeling Accuracy Tradeoff'u

Consent Mode v2'de iki senaryo var: **basic mode** ve **advanced mode**. Basic mode'da consent verilene kadar tag tamamen susuyor (zero signal). Advanced mode'da tag aggregated ping atıyor ama identifier yok. İkinci senaryo modeling'e olanak tanıyor ama accuracy garantisi yok.

Google'ın kendi documentation'ına göre advanced mode'da modeled conversion accuracy %70-90 arasında — ama bu oran *consent rate ile correlation halinde*. Eğer consent rate %20'nin altındaysa modeling tamamen güvenilmez hale geliyor çünkü training data yetersiz. Bu durumda iki temel stratejiye ihtiyacın var:

**1. Consent rate'i artırmak (signal recovery):**
- CMP UX'ini A/B test et — "reject all" butonu yerine granular toggle kullanmak consent rate'i %8-12 artırıyor.
- "Progressive consent" yaklaşımı: ilk ziyarette sadece essential cookies, checkout'ta advertising consent iste.
- Consent incentive: "Kişiselleştirilmiş deneyim için izin ver" yerine "İndirim kodlarını ilk gören sen ol" gibi somut value proposition.

**2. Server-side signal enrichment:**
- Consent verilmese bile first-party cookie (ör. `_fbc`, `_fbp`) sunucuda saklanabilir — GDPR uyumlu çünkü bu client-side tracking değil, server-side session management.
- Google Ads Enhanced Conversions ve Meta CAPI ile hashed email/telefon gönder — bu consent'tan bağımsız çünkü PII server-side hash'leniyor.
- Bu yöntem modeling'e ek referans noktası sağlıyor, accuracy %10-15 artıyor.

[Performans Pazarlaması](https://www.roibase.com.tr/tr/ppc) stack'inde bu iki stratejiyi paralel yürütmek zorundasın — yoksa bidding algoritması halüsinasyon görüyor.

### First-Party Cookie Mimarisi: GCS Consent State API Entegrasyonu

Google Consent State API (GCS), consent mode flag'lerini client-side yerine server-side yönetmeyi sağlıyor. Mantık şu: kullanıcı consent verdiğinde `gtag('consent', 'update', {...})` yerine server'a POST request atıyorsun, server consent state'i session'da saklıyor ve sonraki request'lerde GTM server container bu state'i okuyup tag'lere inject ediyor.

```javascript
// Client-side (CMP callback)
fetch('/api/consent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ad_storage: 'granted',
    analytics_storage: 'granted',
    tcf_string: 'CPXxyz...'
  })
});

// Server-side GTM container (Variable)
function() {
  const consentState = getRequestHeader('X-Consent-State');
  return consentState ? JSON.parse(consentState) : { ad_storage: 'denied' };
}
```

Bu mimari modeling için kritik çünkü:
- Client-side consent popup'ı bypass edilse bile server'da doğru state tutuyorsun.
- TCF 2.2 string'i vendor-level granularity sağlıyor — Google Ads vendor #755 consent verilmişse `ad_storage: granted` olarak işaretliyorsun.
- Consent withdrawal durumunda cookie'leri server-side siliyorsun (GDPR Article 17 compliance).

## TCF 2.2 ve Vendor-Specific Consent Mapping

IAB TCF 2.2 string'i base64-encoded bir blob — içinde 700+ vendor için purpose ve legitimate interest flag'leri var. Google Consent Mode default olarak bu string'i okuyamıyor — sen manuel parse edip `ad_storage`/`analytics_storage`'a map etmelisin.

Örnek TCF string decode logic:

```javascript
function parseTcfString(tcfString) {
  const decoded = atob(tcfString);
  const vendorConsents = decoded.slice(155, 245); // Vendor consent bitfield
  const googleVendorId = 755;
  const googleConsent = vendorConsents[googleVendorId] === '1';
  
  return {
    ad_storage: googleConsent ? 'granted' : 'denied',
    analytics_storage: googleConsent ? 'granted' : 'denied'
  };
}
```

Bu mapping'i server-side GTM container'da yapmalısın çünkü client-side JS manipüle edilebilir. Ayrıca CMP'nin `__tcfapi()` callback'i asenkron — eğer tag hemen ateşlenirse consent state undefined kalıyor. Server-side'da consent state'i header'dan okuyarak race condition'dan kaçınıyorsun.

IAB'nin official vendor list'i (GVL) 6 ayda bir güncelleniyor — yeni vendor eklendiğinde map logic'ini revize etmelisin. Aksi halde yeni advertising platform'ları (ör. TikTok Ads vendor #8472) consent olmadan tag ateşliyor, GDPR ihlali oluyorsun.

## Modeling Quality'yi Nasıl Ölçersin: Confidence Interval ve Lift Test

Google Ads'te modeled conversion'lar `conversions_value_from_interactions_rate` metriği altında raporlanıyor ama raw number anlamsız. Asıl metric **modeled conversion confidence interval** — bu Google Ads API'de yok, manual hesaplayacaksın.

Confidence interval formülü (Bayesian approximation):

```
CI = modeled_conv ± (1.96 × √(modeled_conv × (1 - consent_rate)))
```

Örnek: 100 modeled conversion, %30 consent rate → CI = 100 ± 16.4. Yani gerçek conversion 84-116 arasında. Bu +/- %16 margin — bidding için yeterince dar ama creative test için çok geniş.

Modeling accuracy'yi doğrulamak için **geo-based holdout test** yapmalısın:
1. %10 trafik bölgesinde (ör. Almanya'nın belirli eyaletleri) consent popup'ı tamamen kaldır (baseline: %100 consent).
2. Kalan %90 trafikte normal consent flow işlesin.
3. 4 hafta sonra conversion rate'leri karşılaştır — eğer holdout grubundaki gerçek conversion ile modeled conversion'ın gap'i %20'den fazlaysa modeling güvenilmez demektir.

Google bu testi kendi tarafında yapıyor ama sana raporlamıyor. Sen kendi infrastructure'ında tekrarlamalısın çünkü modeling quality segment-specific: B2B traffic'te modeling daha kötü çalışıyor (sample size düşük), e-commerce'te daha iyi (high-frequency conversion).

## Consent Incentive + Progressive Consent Stratejisi

Consent rate'i artırmanın en etkili yolu *value exchange* — ama çoğu marka bunu yanlış yapıyor. "Çerezleri kabul edin, deneyiminizi geliştirin" generic mesajı %5 lift sağlıyor. Bunun yerine:

**Tiered consent model:**
- **Tier 1 (essential only):** Site çalışır, checkout yapabilirsin ama kişiselleştirme yok.
- **Tier 2 (+ analytics):** Tercihlerini hatırlıyoruz, sepetini kaydediyoruz.
- **Tier 3 (+ advertising):** Exclusive kampanyalar, erken erişim, %10 indirim.

Bu modelde Tier 3 consent rate %15-25 arası oluyor ama *high-intent user'lar* tercih ediyor — yani conversion probability zaten yüksek olan segment. Modeling için bu ideal çünkü training data quality artıyor.

Progressive consent timing'i de kritik: ilk ziyarette consent popup göstermek bounce rate'i %8 artırıyor. Bunun yerine:
1. İlk 30 saniye sessiz kal (kullanıcı içerikle engage olsun).
2. Scroll depth %50'ye ulaştığında veya add-to-cart event'inde minimal consent banner göster.
3. Checkout'ta granular consent options sun (incentive ile).

Bu strateji consent rate'i %35-45'e çıkarıyor (industry average %28). Test data: 50M+ impression üzerinde A/B test, Roibase client portfolio'sunda 2025-2026 arası.

## Server-Side Conversion API: CAPI + ECv2 Double-Send Pattern

Meta CAPI ve Google Enhanced Conversions v2, consent olmadan bile conversion sinyali göndermeyi sağlıyor — ama doğru mimariyle. Yanlış: client-side JS ile hashed email göndermek (GDPR ihlali, çünkü email browser'da hash'lense bile processing sayılıyor). Doğru: server-side checkout event'inde PII hash'leyip doğrudan API'ye POST etmek.

Double-send pattern:

```
Client-side (consent granted):
  → Google Ads pixel fires → browser cookie → direct attribution

Server-side (always):
  → Checkout event → hash(email, phone) → Meta CAPI + Google ECv2
  → Attribution signal (delayed, %60-70 match rate)
```

Bu pattern'de modeling accuracy artıyor çünkü:
- Client-side consent verilmese bile server-side signal var.
- Match rate (hashed email → user ID) %60-70 ama bu segment *high-intent* — conversion rate 3x yüksek.
- Google Ads ve Meta bidding algoritmaları iki farklı signal kaynağını triangulate ediyor, confidence interval daralıyor.

**Dikkat:** Server-side CAPI event'i `action_source: website` ile gönderirsen Meta bunu client-side event sanıyor ve consent olmadığında reject ediyor. Doğru: `action_source: server_side` + `data_processing_options: ["LDU"]` (Limited Data Use, GDPR-safe mode).

## Son Nokta: Legal + Engineering Intersection

Consent Mode v2 ve TCF 2.2 compliance mühendislik problemi değil, *legal-tech intersection* problemi. DPO (Data Protection Officer) ile GTM developer'ın aynı odada oturması gerekiyor çünkü:
- CMP vendor selection legal karar ama CMP API entegrasyonu mühendislik.
- Consent withdrawal (GDPR Article 17) legal zorunluluk ama cookie deletion logic backend.
- Vendor-specific consent mapping hem IAB spec (teknik döküman) hem DPA guideline (yasal yorumlama) gerektirir.

Modeling loss'u minimize ederken legal risk almamak için şu checklist:
1. CMP'nin IAB TCF 2.2 certified olduğunu doğrula (IAB website'inde vendor listesine bak).
2. Google Consent Mode v2'yi advanced mode'da kullan ama `url_passthrough: true` set etme (GDPR ihlali, click ID query param'da kalıyor).
3. Server-side GTM container'da `X-Consent-State` header'ını her tag'de validate et — default `denied` olmalı.
4. Modeling accuracy'yi quarterly geo-holdout test ile doğrula, %20+ gap varsa bidding strategy'yi manuel override et.

Bu süreç tek seferlik değil — consent regulation her 12-18 ayda güncelleniyor, CMP vendor'ları spec'i farklı yorumluyor, Google/Meta API'leri deprecate oluyor. Roibase'in bu alanda devam eden monitoring ve iteration protokolü var: consent rate + modeling accuracy dashboard'u her hafta review ediliyor, anomaly tespit edildiğinde CMP/GTM logic'i revise ediliyor. Statik bir consent popup kurulumu 6 ay içinde obsolete oluyor — dinamik bir compliance architecture gerekiyor.