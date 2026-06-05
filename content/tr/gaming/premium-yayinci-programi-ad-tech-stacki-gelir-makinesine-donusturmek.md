---
title: "Premium Yayıncı Programı: Ad Tech Stack'i Gelir Makinesine Dönüştürmek"
description: "Header bidding, direct sales, subscription ve first-party veri monetizasyonu ile oyun yayıncılarının reklam gelirini %40+ artıran mühendislik yaklaşımı."
publishedAt: 2026-06-05
modifiedAt: 2026-06-05
category: gaming
i18nKey: gaming-006-2026-06
tags: [premium-yayinci, header-bidding, ad-tech, monetization, first-party-data]
readingTime: 8
author: Roibase
---

Mobil oyun yayıncılarının reklam geliri 2025'te %12 büyüdü ama ARPDAU oyunların %68'inde düştü. Paradoks değil — waterfall modelinden header bidding'e geçiş yapmayan yayıncılar programmatic rekabetten dışlandı. Google'ın 3P cookie kaldırma planı ertelense de, iOS ATT sonrası oyun içi reklam envanterinin değeri first-party sinyal kalitesiyle belirleniyor. Ad tech stack'i pasif bir gelir kanalı olarak yönetmek artık mümkün değil — unified auction, direct deal garantileri, subscription hybrid modelleri ve server-side bidding entegrasyonu gerektiren bir mühendislik operasyonuna dönüştü.

## Waterfall'un bittiği nokta: Unified auction mecaniği

Waterfall modelinde demand source'lar sırayla çağrılır — ilk teklif eşik fiyatı geçerse kazanır, altındaysa bir sonraki sıraya geçilir. 2019'da %89 mobil oyun bu modeli kullanıyordu. 2025'te %34'e düştü çünkü waterfall'da demand kayırmacılığı var: network A sıralamasında üstteyse, daha yüksek teklif veren network B'yi göremiyorsun. Header bidding (unified auction) tüm demand source'ları aynı anda çağırıp en yüksek teklifi seçer — eCPM %18-42 arası artış getirdiği test edildi (AppLovin 2024 benchmark data).

Server-side header bidding'de auction oyununun kendi sunucusunda değil, mediation platformunda gerçekleşir. Latency düşer (client-side'da 3-4 waterfall round'u 1200-1800ms iken server-side tek auction 200-400ms), fill rate artar (tüm demand'ler paralel görülür), fraud azalır (client-side manipülasyon riski yok). Prebid Mobile SDK ile server-side auction kurarken dikkat edilmesi gereken: timeout ayarı 1500ms üstü olmalı (düşük bandwidth'li kullanıcılar için), adapter priority kuralları manuel override edilmeli (bazı demand'ler coğrafi latency nedeniyle yanıt gecikmesi yaşayabilir), bid caching açık olmalı (aynı kullanıcı 2. impression'da cached bid görebilir — %8-12 fill rate katkısı).

### Direct sales ile programmatic'i dengelemek

Header bidding programmatic tarafı optimize eder ama premium oyunlarda direct deal'ler hâlâ gelirin %40-60'ını oluşturur. Direct sales'in avantajı: brand safety garantisi, özel format imkânı (playable ad, rewarded survey), fixed CPM (tahmin edilebilir gelir). Dezavantajı: manuel iş yükü, impression garantileri, underfill riski. Roibase'in [Premium Yayıncı Programı](https://www.roibase.com.tr/tr/premiumyayinci)'nda direct + programmatic hibrit modelini şöyle kurarız: direct deal'lere unified auction'da priority floor price vererek hem garantiyi sağlıyoruz hem de direct buyer'ın teklifi düşükse programmatic demand devreye giriyor.

Örnek senaryo: Türkiye tier-1 kullanıcı için direct deal CPM $4 garanti, ama unified auction'da programmatic demand $4.80 teklif veriyor. Eski waterfall'da direct deal'e öncelik verilir, $0.80 kayıp olur. Unified auction'da direct buyer'a "match or release" kuralı konur: $4.80'e match ederse kazanır, etmezse programmatic alır. 2024 Q4 pilot testinde 3 oyunda bu mekanikle direct deal CPM ortalaması %14 arttı çünkü buyer'lar dynamic bidding'e zorlandı.

## First-party veri monetizasyonu: Kullanıcı sinyalini reklam değerine çevirmek

iOS 14.5 sonrası IDFA'nın %75-85 oranında opt-out alması (ATT framework), Android'de Google Play Services ID kullanımının kısıtlanması (Privacy Sandbox 2024), reklam targeting'ini first-party sinyallere kaydırdı. Oyun yayıncıları bu sinyalleri topluyor ama monetize edemiyorlar — çünkü ad network'ler bu veriyi okuyamıyor. Server-side bidding'de ilk parti sinyal Custom Audience segment'i olarak bid request'e eklenir: oyun seviyesi, IAP geçmişi, session frequency, coğrafi konum (IP'den türetilmiş), cihaz RAM/CPU (ad format compatibility için).

```json
{
  "user": {
    "customdata": {
      "game_level": 34,
      "last_iap_days_ago": 12,
      "session_count_7d": 18,
      "device_tier": "high"
    }
  },
  "device": {
    "make": "Apple",
    "model": "iPhone 14 Pro"
  }
}
```

Bu sinyal bid request'te SSP'ye (Supply-Side Platform) iletilir, DSP'ler (Demand-Side Platform) segment fiyatlaması yapar. "IAP yapan ama 12+ gün geçmiş" segment'i rewarded video için %30-50 premium CPM alabilir çünkü re-engagement kampanyaları için değerlidir. Device tier sinyali playable ad için kritik — düşük RAM'li cihazlarda playable servis edilmez, fill rate düşer. 2025'te first-party sinyali zengin oyunların eCPM'i sinyalsiz oyunlara göre %22-38 yüksek (ironSource State of Mobile Gaming 2025).

First-party veri toplama altyapısı: SDK'dan custom event gönderimi (Unity Analytics, Firebase), server-side event pipeline (Segment, mParticle), CDP entegrasyonu (Roibase'in veri mimarisi bu noktada devreye girer), SSP'ye sinyal iletimi (Prebid Server adapter). Dikkat: PII (personally identifiable information) bid request'e girmemeli — GDPR/KVKK ihlali. Hashed user ID, aggregate segment ID kullan.

## Subscription + ad hybrid model: Paywalled IAP ile reklam dengeleme

Free-to-play oyunlarda kullanıcıların %2-5'i IAP yapar, geri kalan %95-98 reklam izler. IAP yapanların %40-60'ı reklamlardan rahatsız oluyor (Player Sentiment Survey 2024, Unity). Çözüm: subscription tier'ı ad-free yapmak — ama subscription fiyatı oyunun reklam gelir beklentisini karşılamalı yoksa kayıp oluşur. 

Hesaplama modeli: Ortalama DAU başına reklam geliri $0.08 (rewarded video + interstitial + banner toplamı), aylık 20 gün aktif kullanıcı $1.60 reklam geliri getirir. Subscription fiyatı minimum $1.99 olmalı ki hem kullanıcı avantaj görsün (reklamsız + ekstra boost), hem yayıncı gelir kaybetmesin. Apple App Store'da subscription %15 komisyon aldığı için net gelir $1.69 — %5.6 artış. Ama burada churn riski var: subscription iptal eden kullanıcı tekrar reklam izleyecek mi? 6 aylık cohort analizi gösteriyor ki subscription trial'dan convert olmayan kullanıcıların %18'i ad frequency'yi "agresif" olarak algılayıp oyunu siliyor.

Hybrid model uygulaması: tier'ları şöyle kur — Free (tüm reklamlar), Premium ($2.99/ay, rewarded optional, interstitial yok), VIP ($5.99/ay, hiç reklam yok + exclusive content). 2024 test: 3 oyunda hybrid model post-install LTV'yi D180'de %31 artırdı çünkü hem IAP hem de ad geliri korundu. Önemli detay: subscription başlangıcında kullanıcıya "reklam izleyerek trial uzatma" seçeneği sunmak (rewarded subscription trial extension) — %12 trial-to-paid conversion artışı sağladı.

## Ad fraud detection: Invalid traffic'i gelir raporundan temizlemek

Mobil oyun reklamlarının %8-15'i invalid traffic (IVT) — bot tıklamaları, SDK spoofing, install farm. Ad network'ler bunu tespit edip para iadesi yapıyor ama tespit süresi 30-90 gün, bu sürede yayıncı sahte gelir görüyor. Server-side ad fraud detection pipeline kurmak kritik: IP reputation check (datacenter IP'leri flagle), device fingerprint anomali tespiti (aynı cihaz ID'si 50+ farklı IP'den geliyorsa suspect), install timing pattern (install sonrası ilk açılış 2 saniyede oluyorsa bot), ad interaction velocity (rewarded video 5 saniyede tamamlanıyorsa skip).

```python
# Basit IVT scoring örneği (pseudocode)
def calculate_ivt_score(event):
    score = 0
    if event.ip in datacenter_ip_list:
        score += 40
    if event.install_to_first_open < 3:  # saniye
        score += 30
    if event.rewarded_video_duration < 8:  # saniye
        score += 20
    if event.device_fingerprint in high_velocity_list:
        score += 10
    return score  # 70+ flagle, 50-69 incelemeye al
```

IVT tespiti sonrası ad network'e dispute açmak gerekiyor — bu manuel süreç. Prebid Server'da IVT flagleme otomatikleşir: bid request'e `regs.ext.ivt_score` eklenir, DSP'ler bunu görerek bid vermez veya düşük teklif verir. 2025'te IVT tespit altyapısı kuran yayıncıların net geliri %9-14 arttı çünkü invalid impression'lar impression cap'e takılmadan elendi, valid kullanıcılar daha fazla premium ad gördü.

## Gerçek zamanlı reporting: Gelir optimizasyonunu günlük karar sürecine bağlamak

Ad tech stack'in çıktısı günlük gelir raporu değil, real-time dashboard olmalı. Mediation platformları 24 saat gecikmeli data veriyor — bu sürede tier-1 kullanıcıda %15 CPM düşüşü olmuş olabilir. Server-side event streaming ile ad impression verisi 5 dakikada dashboard'a düşer: BigQuery + Looker Studio (veya Redash) entegrasyonu, her impression'ın timestamp, ad_unit_id, country, eCPM, fill_rate verisi yazılır. 

Dashboard'da izlenmesi gereken metrikler:
- eCPM trend (hourly) — coğrafya ve format bazında
- Fill rate (%) — demand source bazında
- Latency (ms) — auction timeout oranı
- IVT rate (%) — günlük invalid traffic oranı
- Direct deal pacing — impression delivery vs garanti

Örnek: Türkiye rewarded video eCPM sabah 07:00'de $3.20 iken 14:00'de $2.10'a düştü. Dashboard alerting sistemi Slack'e mesaj attı, mediation ayarında Türkiye için floor price $2.50'ye çekildi, fill rate %8 düştü ama net gelir korundu. Bu müdahale 24 saat gecikmeli raporda görülemezdi.

Real-time reporting altyapısı: ad server'dan webhook ile event streaming (Kafka, Pub/Sub), data warehouse'a yazma (BigQuery partitioned table), scheduled query ile aggregate metrik hesaplama (5 dakikalık interval), dashboard refresh. Dikkat: BigQuery streaming maliyeti yüksek olabilir (slot kullanımı), batch insert tercih edilebilir (1 dakikalık buffer).

## Sonuç: Ad tech stack mühendislik operasyonudur

Premium yayıncı programının çıktısı sadece gelir artışı değil — tahmin edilebilir gelir akışı, fraud'dan arınmış envanter, direct sales ile programmatic dengesinin korunması, first-party veri değerinin realize edilmesi. Waterfall'dan unified auction'a geçiş tek başına %18-42 eCPM artırıyor ama bu geçiş sunucu tarafı bid cache, timeout optimizasyonu, adapter priority yönetimi gerektiriyor. Header bidding kurdun, direct deal'leri entegre etmedin — gelirin %40'ını kaybedersin. First-party sinyal topluyorsun ama bid request'e eklemiyorsun — segment premium'u alamazsın. Subscription tier'ı kurdun ama churn analizi yapmıyorsun — ad revenue düşer. Ad tech stack'i gelir makinesine dönüştürmek bu parçaların orchestration'ını yapmaktır — bu da mühendislik disiplini demektir.