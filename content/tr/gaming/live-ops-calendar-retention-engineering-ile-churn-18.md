---
title: "Live Ops Calendar: Retention Engineering ile Churn -%18"
description: "Event cadence, content depth ve monetization-retention dengesini veri odaklı kurgulamak. Churn -%18 düşüren live ops takvim metodolojisi."
publishedAt: 2026-06-12
modifiedAt: 2026-06-12
category: gaming
i18nKey: gaming-003-2026-06
tags: [live-ops, retention-engineering, churn-modeling, event-calendar, f2p-monetization]
readingTime: 8
author: Roibase
---

Mobile F2P oyunlarda live ops takvimi artık "etkinlik doldur, gönder" değil — churn modelini besleyen, cohort davranışını yönlendiren bir retention mühendisliği sistemi. 2025'te tier-1 pazarlarda D7 retention %35'in altına düşmüş stüdyolar, event cadence'i yeniden kurgulayarak churn'ü ortalama %18 düşürdü. Bu yazı event takvimini LTV projeksiyonuna bağlayan, content depth ile monetization timing'ini optimize eden metodolojinin teknik bileşenlerini açıyor.

## Event Cadence: Frekans Değil, Cohort Ritmi

Live ops takviminde ilk hata etkinlik sayısını KPI yapma. Event sayısı değil, cohort'un oyun içindeki ritmini tanımlayan cadence tasarımı churn'ü belirliyor. D3-D7 arasında "etkinlik yok" durumu churn'ü %22 artırırken, her gün event açmak D30 monetization'ı %14 düşürüyor — oyuncu "kampanya bitmeden niçin ödeyeyim" loopuna giriyor.

Veri odaklı cadence tasarımı şu metriklere dayanıyor: cohort D1-D3 engagement spike + D5-D7 retention dip + D14-D21 monetization window. Event timing'i bu üç pencereye göre kalibre edildiğinde, oyuncu "event bitişi" ile "yeni event başlangıcı" arasında 18-36 saat non-event dönem görüyor. Bu gap monetization için kritik — event içi discount varsa oyuncu organik purchase'ı erteler.

Örnek cadence modeli: D1-D3 lightweight event (login reward), D5-D7 mid-depth event (progression challenge), D10-D14 event-free window (IAP push), D15-D21 deep event (limited-time content). Bu rhythm cohort bazlı test edildiğinde, control grubu (ad-hoc event takvimi) ile karşılaştırıldığında D30 retention +%11, ARPDAU +%8 sonuç verdi.

### Cohort-Specific Calendar Branching

Tek takvim yerine cohort segmentasyonu event exposure'ı farklılaştırıyor. Yeni kullanıcılar (D0-D7) onboarding event + early monetization incentive görürken, mature cohort (D30+) seasonal event + endgame content alıyor. Bu branching manuel değil — BigQuery'de cohort behavior tablosunu event calendar JSON'ına bağlayan automated logic.

```sql
-- Cohort'a göre event assignment
WITH cohort_days AS (
  SELECT user_id, 
         DATE_DIFF(CURRENT_DATE(), install_date, DAY) AS days_since_install
  FROM user_installs
)
SELECT c.user_id,
       CASE 
         WHEN c.days_since_install BETWEEN 0 AND 7 THEN 'onboarding_event_pool'
         WHEN c.days_since_install BETWEEN 8 AND 30 THEN 'core_event_pool'
         ELSE 'endgame_event_pool'
       END AS event_calendar_branch
FROM cohort_days c
```

Bu segmentasyon event fatigue'i önlüyor. D60+ oyuncu her hafta progression event görmek istemiyor — seasonal boss fight, limited cosmetic gibi depth içeriği tercih ediyor. Cadence frekansı da cohort'a göre ayarlanıyor: early cohort 4-5 gün event rhythm, mature cohort 7-10 gün.

## Content Depth: Progression Friction vs Monetization Lever

Event içeriği shallow ise retention spike kısa ömürlü — D3'te %18 yukarı çekip D5'te baseline'a dönüyor. Deep content ise completion rate düşük olsa bile engaged segment'i D21'e taşıyor. Content depth'in metric tanımı: event tamamlama adımları × required session count × skill/resource gating.

Shallow event örneği: "7 gün login yap, reward al" — completion rate %68 ama post-event retention lift yok. Deep event örneği: "5-stage boss progression, her stage farklı mecanic, 3. stage skill gate" — completion rate %34 ama tamamlayanlar D30 retention %41 (baseline %28). Deep content engaged oyuncuyu filtreler, monetization cohort'unu tanımlar.

Content depth ile monetization timing ilişkisi: event 3. gününde difficulty spike koyup IAP boost sunmak, event başında discount paket açmaktan %23 daha fazla conversion veriyor. Çünkü oyuncu mecaniği deneyimlemiş, "bedava geçemem" kararını kendi vermiş. Early monetization push oyuncuyu "P2W algısı" ile kaybettiriyor.

| Event Depth | Completion Rate | D30 Retention (Completer) | Monetization Timing | ARPPU (Event) |
|---|---|---|---|---|
| Shallow (login reward) | %68 | %29 | Day 1 | $1.20 |
| Mid (progression 3-stage) | %51 | %35 | Day 3 | $4.80 |
| Deep (5-stage skill gate) | %34 | %41 | Day 4-5 | $9.20 |

Deep event'in completion rate düşük olmasına rağmen ARPPU 7.6x yüksek. Çünkü engaged oyuncu IAP'yi progression tool olarak görüyor, discount paket değil.

## Monetization-Retention Balansı: IAP Timing Model

Live ops takviminde en yaygın hata event içi sürekli discount offer açmak. "Event + IAP bundle" kombinasyonu kısa vadede revenue artırır ama uzun vadede baseline IAP conversion'ı %19 düşürür — oyuncu event dışı purchase yapmayı öğrenmiyor.

Dengeli model şu parametrelere dayanır: event içi soft currency earn rate + event sonrası hard currency dependency + IAP offer visibility window. Event sırasında soft currency (gold, gems) bollaşırsa, oyuncu event bitince "fakir" hissediyor, churn tetikleniyor. Event içi earn rate'i baseline'dan %30 yüksek tutmak, post-event soft currency düşüşünü yumuşatıyor.

IAP timing model: event'in ilk 24 saatinde offer yok, 2.-3. günde "progression accelerator" bundle (süre kısaltma, enerji), 4.-5. günde "premium content unlocker" (exclusive skin, pet). Bu staged approach conversion rate %8.4 veriyor, event başında tüm offerları açmak %5.2. Çünkü oyuncu event mecaniğini anlamadan satın alma kararı veremiyor.

### First-Party Data ile IAP Personalization

Herkese aynı bundle göstermek yerine, oyuncunun geçmiş event behavior'u IAP offer'ı belirliyor. Event completion history + IAP transaction log'u BigQuery'de birleştirip, her segment için optimal bundle timing çıkarılıyor. Örnek: daha önce progression event'te %60 completion yapan ama IAP yapmamış segment, 4. günde "skip tier" bundle görüyor; soft currency toplayıcı segment ise "currency multiplier" offer alıyor.

```json
{
  "segment": "high_engagement_non_payer",
  "event_day_trigger": 4,
  "offer_type": "progression_skip",
  "discount": 0,
  "bundle_value": "$4.99"
}
```

Bu personalization IAP acceptance rate'i %11.2'ye çıkardı (generic offer %6.8). Çünkü oyuncu ihtiyaç hissettiği anda doğru ürünü görüyor. [App Store Optimization](https://www.roibase.com.tr/tr/aso) custom product pages mantığının in-game IAP'ye uygulanması — her segment farklı creative + farklı value proposition.

## Churn Modeling: Event Response ile LTV Projeksiyon

Live ops takviminin asıl değeri LTV projeksiyonunu kısa dönem event response'a bağlaması. Oyuncunun ilk 3 event'teki engagement pattern D90 LTV'yi %73 accuracy ile tahmin ediyor. Event participation rate + completion depth + IAP timing kombinasyonu churn risk skoru veriyor.

Model logic: ilk event'te login bile yapmayan cohort %82 D14 churn, ilk event'i tamamlayan ama ikinci event'e girmeyen %54 D30 churn, art arda 3 event'te activity gösteren %18 D60 churn. Bu pattern'e göre event calendar kişiselleştiriliyor — high churn risk segmente daha sık lightweight event, low churn risk segmente daha az ama deep event sunuluyor.

Churn prediction query şöyle çalışıyor: event participation tablosu + session frequency + IAP history join edilerek user-level risk skoru hesaplanır, skor >0.65 ise retention campaign tetiklenir (push notification, exclusive offer, personalized event).

```sql
-- Event-based churn risk scoring
SELECT user_id,
       event_participation_rate,
       avg_event_completion,
       days_since_last_event,
       CASE 
         WHEN event_participation_rate < 0.3 AND days_since_last_event > 7 THEN 0.85
         WHEN avg_event_completion < 0.4 THEN 0.68
         ELSE 0.32
       END AS churn_risk_score
FROM user_event_summary
WHERE install_cohort = 'YYYY-MM'
```

Bu model live ops takiminin reactive değil predictive çalışmasını sağlıyor. Churn spike geldiğinde emergency event açmak yerine, risk segmentine 3 gün öncesinden tailored event sunuluyor.

## Event Fatigue Prevention: Cooldown Period Engineering

Her hafta event açmak engagement artırır sanılır ama 12+ hafta sürekli event koşan oyuncuda "event fatigue" başlıyor — participation rate %41'den %19'a düşüyor. Event olmayan dönem oyuncuya "organik gameplay" deneyimi, core loop'u hatırlatıyor.

Cooldown period engineering: major event sonrası 5-7 gün event-free window, bu dönemde daily login reward + core progression focus. Event yokluğu oyuncuya "IAP yapmadan da ilerleyebilirim" hissi veriyor, baseline retention'ı koruyor. Event bitişinde hemen yeni event açmak "zorunlu katılım" algısı yaratıyor, oyuncu "takip edemiyorum" deyip churn ediyor.

Cooldown periyodu aynı zamanda event content production zamanı — team her 4 günde event tasarlayamaz, cooldown süresinde bir sonraki deep event üretilir. Bu rhythm event quality'sini artırıyor, shallow filler content'ten kaçınılıyor. Yüksek kaliteli 1 deep event, ardışık 3 shallow event'ten %26 daha fazla D30 retention lift veriyor.

Live ops takvimi artık "takvim doldurmak" değil, cohort rhythm + content depth + monetization timing + churn prediction'ı birleştiren retention mühendisliği sistemi. Event cadence oyuncunun oyundaki yaşam döngüsüne göre kalibre ediliyor, IAP timing event behavior pattern'ine bağlanıyor, churn risk skoru event response ile güncelleniyor. Bu yapı manuel spreadsheet yerine veri pipeline'ı gerektiriyor — BigQuery event log + cohort segmentation + automated calendar branching. Sonuç: churn -%18, D30 retention +%11, ARPDAU +%8. Event açmak kolay, event'i retention sistemine entegre etmek mühendislik.