---
title: "iOS 17 Sonrası Ad Attribution Stack'i"
description: "ATT, SKAdNetwork 4 ve modeled conversions ile iOS pazarlamasında yeni ölçüm mimarisi. Post-lookback dönemi için pratik stack kurulumu."
publishedAt: 2026-06-20
modifiedAt: 2026-06-20
category: marketing
i18nKey: marketing-003-2026-06
tags: [ios-attribution, skadnetwork, att, mobile-marketing, conversion-modeling]
readingTime: 8
author: Roibase
---

iOS 14'te başlayan ATT (App Tracking Transparency) dönüşümü 2026'da olgunlaştı. SKAdNetwork 4, modeled conversions ve post-install attribution pencerelerinin genişlemesiyle birlikte iOS pazarlamasında artık farklı bir teknik stack gerekiyor. 2025 Q4 itibarıyla US kullanıcıların %73'ü ATT prompt'unda "track etme" seçeneğini reddediyor (Flurry Analytics 2025). Bu, eski deterministic attribution modellerinin çöktüğü, ancak yeni probabilistic sistemlerin daha fazla sinyal sunduğu bir dönemi işaret ediyor. Aşağıda iOS 17+ için performans pazarlaması stack'ini teknik katmanda kuruyoruz.

## ATT Sonrası Deterministic Sinyal Yok

App Tracking Transparency kullanıcıya izleme iznini sorduktan sonra opt-out oranı %70'i geçti. Bu, IDFA (Identifier for Advertisers) gibi cihaz-bazlı kimliklerin artık pazarlama kararlarının merkezinde olamayacağı anlamına geliyor. Meta, Google, TikTok gibi platformlar artık user-level veriye erişemediği için kampanya optimizasyonlarını aggregated sinyal üzerinden yürütüyor.

**Deterministic sinyalin yokluğunda ne kalıyor:**
- SKAdNetwork postback'leri (install ve conversion event'leri campaign ID ile eşleşir, ancak user ID yok)
- Server-side dönüşüm sinyalleri (first-party event stream'den)
- Modeled conversions (platform ML modelleri eksik veriyi tahmin eder)

Kritik nokta: Eski LTV cohort analizleri artık deterministik veri yerine probabilistic modelleme ile çalışıyor. Örneğin Meta Ads Manager'da "Estimated Action"lar — bu tahminler %15–25 hata marjı taşıyor (Meta Q1 2025 attribution raporu). Stack kurarken bu belirsizliği fiyatlara dahil etmek gerekiyor.

### Post-Install Lookback Penceresi

SKAdNetwork 4 ile lookback penceresi 24 saatten 35 güne çıktı. Ancak bu süre içinde sadece 3 conversion value update'i gönderebiliyorsun. Her update bir "coarse" veya "fine" granularity ile gelebilir — bu granularity conversion rate'e bağlı. Yüksek dönüşüm varsa fine (64 conversion value), düşükse coarse (low/medium/high sınıflandırması).

**Teknik kural:** İlk 24 saatte conversion sinyali gelirse fine, 3–7. günde gelirse coarse, 8+ günde gelirse timer-based postback. Bu da demek oluyor ki D7 LTV hesabı artık deterministik değil — sadece install'ın %40'ı D7'ye kadar sinyal veriyor (AppsFlyer benchmark 2025).

## SKAdNetwork 4 Conversion Value Şeması

SKAdNetwork'te 64 conversion value var (0–63). Her value bir "event kombinasyonu" kodluyor. Örneğin:
- 0–9: Ilk açılış + onboarding tamamlama
- 10–19: İlk içerik etkileşimi
- 20–29: İlk satın alma (low-value)
- 30–39: İlk satın alma (high-value)
- 40–63: Recurring purchase, abonelik yenileme

Bu şemayı kurarken **priority mapping** yapmalısın — hangi event'in daha yüksek business value'su varsa o değer daha yüksek SKAdNetwork value'ya map edilir. Çünkü SKAdNetwork sadece **en yüksek conversion value**'yu postback olarak gönderir. Yani kullanıcı hem onboarding'i tamamlayıp (value 5) hem satın alma yaparsa (value 25), sadece 25 gönderilir.

**Örnek mapping (gaming app):**

| Event | Business Value | SKAdNetwork Value |
|---|---|---|
| Tutorial complete | $0.10 | 5 |
| Level 3 complete | $0.30 | 10 |
| First IAP ($0.99) | $0.99 | 20 |
| First IAP ($4.99+) | $4.99+ | 30 |
| D7 retention | $2.50 (modeled) | 40 |

Bu şemayı **revenue-weighted** kurmak kritik — yoksa high-frequency low-value event'ler yüksek value'ları bastırır ve platform optimizasyonu yanlış yöne gider.

### Hierarchical Source Identifier

SKAdNetwork 4 ile "hierarchical source ID" geldi — bu campaign → ad group → creative hiyerarşisini 4-digit kod ile encode ediyor. Örneğin `1234` şu anlama gelebilir:
- İlk 2 digit (12): Campaign ID
- 3. digit (3): Ad group
- 4. digit (4): Creative variant

Bu ID'yi doğru kurmak attribution granularity için kritik. Aksi takdirde tüm kampanyalar tek ID ile gelir, creative-level performans görünmez. [Performans Pazarlaması](https://www.roibase.com.tr/tr/ppc) stratejilerinde bu granularity dönüşüm testlerini hızlandırıyor — örneğin A/B creative test'i 7 gün yerine 3 günde sonuç verebiliyor.

## Modeled Conversions: Platform-Side ML

Meta, Google, TikTok artık "modeled conversions" sunuyor — bu, eksik sinyalleri ML ile tahmin eden bir layer. Meta'nın Conversions API ile server-side event gönderdiğinde platform şu verileri kullanır:
- Gönderdiğin event parametreleri (event_name, value, currency)
- IP adresi, user agent, click ID (fbclid, gclid)
- Benzer kullanıcıların geçmiş davranış pattern'leri

Meta bu sinyalleri birleştirip "modeled" bir dönüşüm sayısı üretir. Örneğin 100 gerçek dönüşüm varsa, model 120–130 "estimated" dönüşüm gösterir. Bu tahminler bidding algoritmasına giriyor — yani ROAS hedefi modeled data üzerinden optimize ediliyor.

**Kritik soru:** Modeled data'ya güvenilir mi? Meta'nın kendi A/B test'leri modelin %18–22 doğrulukta olduğunu gösteriyor (Meta Advertiser Help Center 2025). Bu, incremental lift test'leri ile doğrulanmalı. Eğer modeled ROAS 3.5x ama gerçek incrementality 2.1x ise, bütçe kararlarını modeled data'ya göre alırsın ve over-spend yaparsın.

### Server-Side Signal Kalitesi

Modeled conversion kalitesi server-side sinyalin zenginliğine bağlı. Minimum gereksinimler:
- `event_source_url` (landing page URL)
- `client_ip_address` (kullanıcı IP'si)
- `client_user_agent` (tarayıcı bilgisi)
- `fbp` cookie (first-party Meta pixel cookie)
- `fbc` cookie (click ID cookie, fbclid parametresinden)

Bu 5 parametre olmadan modeled conversion kalitesi %40–50 düşer (Meta CAPI documentation). Özellikle `fbp` ve `fbc` cookie'lerini first-party domain'den set etmek kritik — third-party cookie block'u yüzünden bu sinyaller kayboluyorsa attribution tamamen agregaya kayar.

## Post-Lookback Campaign Maturity

iOS kampanyalarında "learning phase" süresi uzadı. Google App Campaigns'de 50 dönüşüme ulaşana kadar kampanya "learning" modunda kalıyor. Ancak SKAdNetwork sinyalleri 24 saat gecikmeyle geldiği için bu 50 dönüşüm 3–5 gün sürebiliyor. Bu süre boyunca CPA %30–40 daha volatil oluyor.

**Operasyonel kural:** İlk 7 gün kampanyayı pause etme — algoritmaya sinyal akışı sağla. 7. günden sonra CPA stabilize olursa scale et, olmazsa creative veya targeting değiştir. Ancak her değişiklik learning phase'i reset eder — bu da 7 gün daha demek.

### Campaign Structure: Consolidation vs. Segmentation

Eski iOS 13 döneminde kampanyaları dar target'lara bölmek mantıklıydı (lookalike %1, %2 ayrı kampanyalar). Şimdi bu yöntem learning phase'i uzatıyor. Bunun yerine **consolidated campaign** tercih ediliyor:
- Tek kampanya, geniş targeting (iOS 15+, tüm ABD)
- Platform kendi modeliyle segment ediyor
- Creative testing kampanya içinde dynamic creative ile

AppsFlyer 2025 benchmark'ına göre consolidated yapı %22 daha düşük CPA getirdi. Ancak bu yapı manuel optimizasyon kontrolünü azaltıyor — tüm güç platformun ML'ine kalıyor.

## Incrementality Test ile Doğrulama

Modeled data ve SKAdNetwork sinyallerinin doğruluğu ancak incrementality test ile anlaşılır. Geo-based holdout test'i yaparak kontrol grubu (reklam yok) ile test grubu (reklam var) arasındaki dönüşüm farkını ölçersin.

**Basit hesaplama:**
```
Incremental Lift = (Test Group CVR - Control Group CVR) / Control Group CVR
```

Örneğin test grubu %3.2 CVR, kontrol grubu %2.1 CVR ise lift %52. Ancak bu lift'in tamamı reklamdan gelmiyorsa (örneğin organik spike varsa) "true incrementality" daha düşük olur. Bu durumda modeled ROAS'ı lift oranıyla düzelt:
```
True ROAS = Reported ROAS × (Incremental Lift / 100)
```

Eğer reported ROAS 4.0x ama lift %40 ise true ROAS 1.6x — bu ciddi bir fark ve bütçe allokasyonunu değiştirir.

## Stack Tasarımı: Katman Katman

iOS 17+ için end-to-end attribution stack'i şu katmanlardan oluşuyor:

**1. SDK + MMP (Mobile Measurement Partner):** AppsFlyer, Adjust, Branch gibi MMP'ler SKAdNetwork postback'lerini topluyor ve kampanya ID ile eşleştiriyor. Bu katman deterministik sinyal sağlar ancak user-level detay yok.

**2. Server-Side Event Stream:** App backend'inden CAPI (Meta), Google Ads API, TikTok Events API'ye server-side event gönder. Bu sinyaller modeled conversion'ı beslir.

**3. BI + Attribution Model:** BigQuery veya Snowflake'te SKAdNetwork + server-side + modeled data'yı birleştir. Burada "blended attribution" modeli kur — örneğin SKAdNetwork'ün %60 ağırlığı, modeled'in %40 ağırlığı.

**4. Incrementality Layer:** Geo-test sonuçlarını BI'a aktar, blended attribution'ı incrementality ile düzelt. Bu katman "ground truth" sağlar.

Her katman ayrı veri kaynağı — bu yüzden stack'in sağlamlığı data pipeline'ın uptime'ına bağlı. SKAdNetwork postback'leri %2–5 kayıp oranı taşır (ağ sorunu, timer hatası vs.), bu kayıpları MMP retry mekanizmasıyla minimize et.

## Şimdi Ne Yapmalı

iOS attribution stack'i artık deterministik veri yerine probabilistic modelleme ile çalışıyor. SKAdNetwork 4 conversion value şemasını revenue-weighted kur, hierarchical source ID ile granularity sağla, server-side sinyal kalitesini maksimize et. Modeled conversions'a güvenirken incrementality test ile doğrula — yoksa over-attribution riski var. Campaign maturity süresi uzadı, bu yüzden ilk 7 günde sabırlı ol ve learning phase'i reset eden değişikliklerden kaçın. Stack'i katman katman kur ve her katmanın veri kaybını izle — çünkü iOS'ta artık tek bir sinyal kaynağı yok, hepsinin aggregation'u gerçeği veriyor.