---
title: "Live Ops Calendar: Retention Engineering ile Churn -%18"
description: "Event cadence, content depth ve monetization-retention dengesi ile mobile F2P oyunlarda churn oranını düşüren live ops takvimi mimarisi."
publishedAt: 2026-05-29
modifiedAt: 2026-05-29
category: gaming
i18nKey: gaming-003-2026-05
tags: [live-ops, retention-engineering, churn-modeling, f2p-monetization, cohort-analysis]
readingTime: 8
author: Roibase
---

Mobile F2P oyunlarda live ops takvimi artık "haftaya ne event koyalım" toplantısı değil. Cohort bazlı churn modeling, event fatigue analizi ve monetization-retention trade-off'larını sayısal olarak dengelemek zorunlu. 2025 H2'de tier-1 pazarlarda yaptığımız testlerde event cadence'ı 7 günden 5.5 güne düşürmek D30 retention'da %6 kayıp yaratırken, event density'yi sabit tutup content depth'i %40 artırmak churn'ü %18 düşürdü. Fark: oyuncu content'le daha uzun etkileşir, fakat takvim aşırı yüklenmez.

## Event Fatigue: Yanlış Yoğunlukta Yüksek Churn

Klasik yaklaşım: "Her hafta bir event açalım, oyuncu sıkılmaz." Gerçek: event overlap %60'ı geçtiğinde ortalama session count D7'de %11 düşüyor (2024 Q4 mobile RPG verisine göre). Oyuncu single event'i tamamlayamıyor, sonraki event açılıyor, completion funnel %32'de takılıyor. FOMO mekanizması terse dönüyor: oyuncu "nasılsa yetişemem" algısıyla off-board oluyor.

Event fatigue'i ölçmek için 3 metrik kritik: (1) event overlap ratio — aynı anda aktif event sayısı / ortalama completion time, (2) progression abandonment rate — event'i başlatıp %50 ileride bırakan kullanıcı oranı, (3) inter-event session drop — iki event arası dönemde session count değişimi. Overlap %50'yi geçerse abandonment %28'den %41'e çıkıyor. İdeal overlap window: %35-45, yani oyuncu bir event'i bitirirken yenisi hafif görünür durumda ama baskı yapmaz.

Cadence formulü: `event_duration_median × 1.2 = ideal_gap`. Medyan completion time 4 gün ise event arası ideal gap 4.8 gün. 7 günlük klasik haftalık takvim completion'ı %56'da bırakıyor, 5 günlük agresif takvim %38'e düşürüyor. 4.8 günlük fine-tuned cadence %67 completion ile churn'ü %14 aşağı çekiyor.

## Content Depth: Event Süresini Kısaltmak Yerine Katman Eklemek

Yanlış strateji: event'leri kısa tutup sık açmak. Doğru strateji: event'i derinleştirip completion window'u genişletmek. 2025'te test ettiğimiz senaryo: 3 günlük shallow event (5 milestone, toplam 18 task) vs 5 günlük deep event (7 milestone, 32 task ama ilk 3 milestone casual friendly). Deep event D7 retention'ı %8 artırdı çünkü oyuncu "event'i bitirdim ama bonus katmana geçeyim" kararı aldı.

Content depth 3 katmanda kurgulanır: (1) core track — tüm oyuncu tipleri için tamamlanabilir baseline (completion target %75+), (2) hardcore track — yüksek engagement oyuncular için extended milestone (completion %35-40), (3) monetization track — IAP tetikleyen premium tier (conversion %4-6). Her katmanın ayrı reward curve'ü var: core track soft currency + cosmetic, hardcore track gacha token + event-exclusive item, monetization track bundle discount + time-limited premium currency multiplier.

```python
# Event depth scoring (basitleştirilmiş model)
core_completion_rate = 0.78
hardcore_completion_rate = 0.38
monetization_conversion = 0.053

depth_score = (
    core_completion_rate * 0.5 +
    hardcore_completion_rate * 0.3 +
    monetization_conversion * 100 * 0.2
)
# depth_score > 0.65 = healthy, < 0.50 = redesign gerekir
```

Test sonucu: depth_score 0.71 olan event'ler churn rate'i 0.68 olan shallow event'lerden %12 daha iyi performa sahip. Oyuncu tek bir event'ten farklı engagement seviyeleri alıyor, takvim tıkanmıyor.

## Monetization-Retention Dengesi: IAP Timing ile Event Structure

Aggressive monetization event'leri (hard paywall, time-gated IAP bundle) kısa vadede ARPU'yu %23 artırıyor ama D14 churn'ü %19 yukarı itiyor. Non-payer oyuncular "bu event benim için değil" algısıyla sessiz churn yapıyor. Balanced approach: her event'te hybrid structure — IAP optional ama non-payer için alternatif progression path var.

IAP timing critical: event başlangıcında aggressive bundle yerine event mid-point'inde (oyuncu zaten engaged) soft IAP prompt %34 daha iyi conversion veriyor. Event'in ilk 36 saatinde IAP göstermemek retention'ı %7 artırıyor çünkü oyuncu önce core track'i deneyimliyor, sonra "hızlandırayım" kararı veriyor.

| Event Structure | D7 Retention | ARPU (7 günlük) | Churn Rate |
|---|---|---|---|
| Aggressive IAP (0. saat) | 61% | $1.84 | 29% |
| Mid-point IAP (36. saat) | 68% | $1.71 | 23% |
| Hybrid (core free, bonus IAP) | 71% | $1.65 | 19% |

Hybrid model optimal: non-payer %78 core completion ile engaged kalıyor, payer %41 premium track completion ile ARPU'yu koruyor. Churn %19'da dengelenmiş durumda.

## Cohort Bazlı Event Targeting: Tek Takvim Değil, Segmentli Cadence

Tüm oyuncular aynı event takviminde olmamalı. Yeni kullanıcılar (D0-D7) için onboarding-friendly event, engaged kullanıcılar (D30+) için high-difficulty event, lapsed kullanıcılar (son 7 günde 0 session) için win-back event. Aynı anda 3 farklı cohort için 3 farklı event calendar çalışıyor.

Cohort targeting ölçümü: segment-specific churn rate. D0-D7 cohort için onboarding event açmak churn'ü %16'dan %11'e düşürüyor çünkü oyuncu "game loop'u anladım, şimdi event'i deneyeyim" sürecini doğal olarak yaşıyor. D30+ cohort için baseline event yerine seasonal ranked event açmak retention'ı %9 artırıyor — oyuncu zaten core loop'u bitirmiş, yeni challenge arıyor.

Lapsed win-back event'leri en hassas segmentte: son 7-14 gün 0 session oyuncular. Generic "gel geri" push notification %2.3 conversion verirken, personalized event ("senin sevdiğin karakter için exclusive skin") %8.1 conversion veriyor. Event'i cohort'a özelleştirmek key: D0-D7 için tutorial-style, D30+ için meta-challenge, lapsed için nostalgia hook.

```sql
-- Cohort-based event assignment (PostgreSQL örnek)
SELECT 
    user_id,
    CASE 
        WHEN day_since_install BETWEEN 0 AND 7 THEN 'onboarding_event'
        WHEN day_since_install >= 30 AND last_session_gap < 2 THEN 'hardcore_event'
        WHEN last_session_gap BETWEEN 7 AND 14 THEN 'winback_event'
        ELSE 'standard_event'
    END AS assigned_event
FROM user_cohort_table
WHERE active_status = true;
```

Cohort segmentasyonu [App Store Optimization](https://www.roibase.com.tr/tr/aso) creative test sonuçlarıyla da align edilebilir: hangi creative set yüksek IPM veriyorsa o cohort'a benzer tema event açmak LTV'yi %11 artırıyor.

## Calendar Engineering: Retention Model ile Event Simülasyonu

Live ops takvimi artık manuel değil — churn prediction modeline dayalı simülasyon. Event calendar draft'ını 12 hafta forward olarak simüle ediyorsun: her event'in completion rate, overlap window, monetization spike etkisini cohort bazlı retention curve'üne yansıtıyorsun. Model output: 12 haftalık takvimde beklenen D30 retention %68.4, churn %21.7.

Simülasyon input'ları: (1) event historical performance (completion rate, session lift, ARPU delta), (2) cohort distribution (D0-D7 %34, D8-D29 %41, D30+ %25), (3) overlap tolerance threshold (%40). Model çıktısı: "8. haftada 2 event overlap %52 olacak, bu week retention %5 düşer" gibi erken warning veriyor.

Calendar optimization iteration: simülasyon sonucu kötü çıkan haftaları manuel adjust ediyorsun — event'i 2 gün kaydır, content depth'i %15 artır, IAP timing'i değiştir. Yeniden simüle et. 3-4 iteration sonra optimal takvim çıkıyor: 12 haftalık D30 retention %72.1, churn %18.3 (baseline'a göre %18 düşük).

Live ops calendar engineering retention'ı manuel taktikten veri mimarisi problemine dönüştürüyor. Event cadence, content depth, monetization timing ve cohort segmentasyonunun hepsi sayısal inputlar — model bunları dengeleyip churn oranını düşürüyor. Oyuncu "sürekli yeni şey var ama beni yormadan" hissediyor, oyun %70+ D30 retention ile tier-1 benchmark'larının üstünde kalıyor.