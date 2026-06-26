---
title: "Live Ops Calendar: Retention Engineering ile Churn -%18"
description: "Event cadence, content depth ve monetization-retention dengesini veri modelleriyle kurmak. Cohort analizi, Bayesian event testing ve in-game ekonomi entegrasyonu."
publishedAt: 2026-06-26
modifiedAt: 2026-06-26
category: gaming
i18nKey: gaming-003-2026-06
tags: [live-ops, retention-engineering, f2p-monetization, cohort-analysis, churn-modeling]
readingTime: 8
author: Roibase
---

Live ops artık "haftalık bir event at, bakalım ne olacak" yaklaşımıyla yürümüyor. 2025'ten itibaren tier-1 marketlerde retention engineering standart hale geldi: event cadence'ı cohort davranışına göre ayarlama, content depth'i monetization sinyaliyle dengeleme, churn modelini real-time event performansına bağlama. Supercell'den King'e kadar herkes live ops calendar'ını statik takvim yerine dinamik karar mekanizması olarak işletiyor. Türkiye stüdyolarında ise hala "15 günde bir event" gibi sabit ritimler var — bu yaklaşım D7/D30 retention'da gözle görülür verim kaybına yol açıyor.

## Event Cadence: Cohort Davranışına Göre Ritim

Klasik yaklaşımda event calendar haftalık veya aylık döngülerle kurulur. Retention engineering'de ise event frekansını cohort'un engagement sinyaline göre ayarlarsın. Örneğin D3-D7 arasında churn riski yüksek segment için daha sık, kısa süreli eventler (24-48 saat) devreye alınırken, D30+ whales segmenti için daha seyrek ama derin eventler (7-10 gün, multi-layer reward) verilir.

BigQuery + cohort tablosu üzerinde event exposure'ı şöyle modellendirebilir: `cohort_install_date`, `days_since_install`, `event_participation_flag`, `next_session_ts`. Bu yapıyla her event'in bir sonraki session'a etkisini cohort bazında ölçersin. Bir stüdyo bu modeli kurduktan sonra event cadence'ı haftada sabit 2'den, segment bazında 1-4 arasında değişken hale getirdi — D7 retention %46'dan %54'e çıktı. Frekans artışı spam algısı yaratmadı çünkü event tipi de segment davranışına uyarlanmıştı: high-engagement segmente competitive leaderboard, low-engagement segmente solo PvE challenge verildi.

Event overlap da kritik. İki event'in aynı anda yayında olması engagement'ı bölmez, aksine cross-reward sinerji yaratabilir — ama bunu test etmen gerekiyor. Bayesian A/B ile overlap durumunda IAP conversion, session length ve next-day return'ü karşılaştır. Bir idle RPG stüdyosu overlap testinde şunu gördü: collection event + discount event beraber yayında olunca D1 retention %2 düşüyor ama D7 revenue %18 artıyor. Tradeoff netleşince calendar'ı revenue-priority segmente overlap, retention-priority segmente sequential eventler şeklinde ikiye ayırdılar.

## Content Depth: Event Süresini Progression Speed'e Bağla

Event süresini "7 gün olsun, herkes tamamlasın" mantığıyla kurma. Event completion rate, average completion time ve post-event churn'ü cohort segment bazında karşılaştır. Eğer bir segment event'i 2 günde bitirip kalan 5 günde engagement düşüyorsa, bu segmente daha kısa event ver veya event içinde bonus layer ekle.

Progression speed datasını `event_milestone_reached` eventi üzerinden topla: `user_id`, `event_id`, `milestone_index`, `time_to_milestone_seconds`. Bu datayla medyan completion time'ı segment bazında hesapla. Örneğin whale segment event'i ortalama 36 saatte bitiriyorsa, 7 günlük event süresi retention için zararlı — çünkü event bitince content void oluşuyor. Bu segmente 3 günlük event + 2. phase unlock mekaniği veya sonraki event'e early access ver.

Content depth sadece süre değil, reward structure'da da devreye girer. Free-to-play segmente düşük friction, yüksek frequency reward (her 10 dakikada mini loot box); paying segmente yüksek friction, yüksek value reward (3 günde premium currency bundle). Bir match-3 stüdyosu bu ayrımı yaptıktan sonra event içi IAP conversion %11'den %17'ye çıktı — çünkü paying segment artık "event'i hızlı bitirmek için ödeme yap" seçeneğini görüyordu, free segment ise "oyna ve kazan" mesajını alıyordu.

### Event Reward Optimization Tablosu

| Segment | Completion Time (median) | Event Length (optimal) | Reward Type | IAP Conversion |
|---------|---------------------------|------------------------|-------------|----------------|
| F2P, low engagement | >5 gün | 7 gün, front-loaded | Soft currency, cosmetic | %0.4 |
| F2P, high engagement | 2-3 gün | 4 gün + bonus phase | Soft + rare item | %2.1 |
| Low spender | 1.5-2 gün | 3 gün, time-gate unlock | Hard currency discount | %8.3 |
| Whale | <1.5 gün | 2 gün + VIP tier | Exclusive bundle | %21.7 |

Bu tablo gerçek bir strategy game stüdyosundan alınan 6 aylık event datasına dayanıyor. Free segment için event length uzatmak engagement'ı artırmıyor, aksine mid-event churn'ü tetikliyor. Whale segment için kısa event + exclusive reward kombinasyonu hem retention'ı hem revenue'yu koruma altına alıyor.

## Monetization-Retention Dengesi: Bayesian Event Testing

Live ops'ta en büyük risk şu: monetization odaklı event (discount flood, pay-to-win leaderboard) retention'ı eritir; retention odaklı event (sınırsız ücretsiz ödül) revenue'yu düşürür. Bu tradeoff'u hissiyatla çözemezsin — Bayesian event testing yapman gerekiyor.

Test yapısı şöyle: aynı event'in 3 variant'ını (A: monetization-heavy, B: balanced, C: retention-heavy) rastgele segment'lere at. Metric'ler: `D1_retention`, `D7_retention`, `event_revenue`, `post_event_churn` (event bitiminden 3 gün sonra return oranı). Bayesian posterior ile her variant'ın hem retention hem revenue'da "kazanma olasılığını" hesapla. Eğer variant B %68 olasılıkla hem D7 retention'da hem revenue'da üstte geliyorsa, onu default yap.

Bir RPG stüdyosu bu testi şu şekilde yaptı: event A'da IAP bundle agresif push edildi (pop-up, timer, scarcity messaging), event C'de IAP hiç gösterilmedi (sadece grind-based progression). Event B'de IAP opsiyonel tab'da durdu ama event mechanic'i paying user'a advantage vermedi. Sonuç: event A revenue %34 yüksek ama D7 retention %9 düşük; event C retention %6 yüksek ama revenue %41 düşük; event B her iki metrikte de ortada ama posterior probability %72 — çünkü post-event churn event A'da %23, event B'de %14 idi. Stüdyo event B'yi standart yaptı ve 4 aylık dönemde toplam LTV %11 arttı.

## Attribution: Event Etkisini Sessiona Değil Lifecycle'a Bağla

Event başarısını "event süresi içinde revenue" ile ölçme. Asıl etki post-event behavior'da görülür: event bitiminden 7 gün sonra user active mi, IAP yapıyor mu, churn etti mi? Bu attribution için event exposure'ı user lifecycle'a tag'le: `event_exposed_flag`, `event_completion_status`, `days_post_event`.

BigQuery'de şu sorguyu kur:

```sql
WITH event_cohort AS (
  SELECT
    user_id,
    event_id,
    DATE(event_start_ts) AS cohort_date,
    MAX(CASE WHEN milestone_index = final_milestone THEN 1 ELSE 0 END) AS completed_flag
  FROM events.user_event_log
  WHERE event_id = 'winter_festival_2026'
  GROUP BY 1,2,3
),
retention_post_event AS (
  SELECT
    ec.user_id,
    ec.completed_flag,
    COUNTIF(s.session_start_ts BETWEEN DATE_ADD(ec.cohort_date, INTERVAL 8 DAY)
                                   AND DATE_ADD(ec.cohort_date, INTERVAL 14 DAY)) AS d8_d14_sessions,
    SUM(IF(i.iap_ts BETWEEN DATE_ADD(ec.cohort_date, INTERVAL 8 DAY)
                         AND DATE_ADD(ec.cohort_date, INTERVAL 14 DAY), i.revenue_usd, 0)) AS post_event_revenue
  FROM event_cohort ec
  LEFT JOIN analytics.sessions s ON ec.user_id = s.user_id
  LEFT JOIN analytics.iap_events i ON ec.user_id = i.user_id
  GROUP BY 1,2
)
SELECT
  completed_flag,
  AVG(d8_d14_sessions) AS avg_sessions_post_event,
  AVG(post_event_revenue) AS avg_revenue_post_event
FROM retention_post_event
GROUP BY 1;
```

Bu sorgu event completion'ın post-event engagement ve revenue'ya etkisini gösterir. Bir hyper-casual stüdyo bu analizi yaptığında şunu gördü: event'i tamamlayan user'ların D8-D14 session count'u %47 yüksek, ama revenue farkı %3 — bu da event reward'ının monetization incentive'i ezmediğini gösterdi. Sonuç olarak event reward miktarını %20 artırdılar (retention boost) ama IAP bundle'ları event completion'a conditional yapmadılar (revenue protection).

## Calendar Orchestration: Event Sequence ve Cross-Event Synergy

Live ops calendar tek event bazında değil, event sequence bazında düşünülmeli. Bir event'ten hemen sonra başka bir event atarsan retention spike yaratabilirsin ama user fatigue riski var. Sequence test et: event A bitince hemen event B mi, 3 gün ara mı, yoksa event A'nın reward'ı event B'ye taşınıyor mu?

Bir simulation game stüdyosu 3 sequence pattern test etti: (1) back-to-back event (0 gün ara), (2) cooldown event (4 gün ara), (3) bridged event (event A reward'ı event B'de bonus olarak kullanılabilir). Bayesian test sonucu: bridged sequence hem D7 retention'da (%+8) hem event B participation'da (%+14) kazandı. Neden? Çünkü event A'yı tamamlayan user event B'de avantajlı başlıyordu — bu perceived value'yu artırıp churn'ü azalttı.

Cross-event synergy için event type'ları da önemli. Competitive + cooperative event'i arka arkaya atma — user segment overlap düşük. Ama collection + time-limited discount event'i birleştir — collection event'te toplanan kaynağı discount event'te kullanma fırsatı sunarsın. Bir idle RPG stüdyosu bu kombinasyonu kurunca event B'de IAP conversion %19 arttı — çünkü user event A'dan gelen materyali harcamak için discount fırsatını değerlendirdi.

Live ops artık takvim değil karar mekanizması. Event cadence'ı cohort sinyaline, content depth'i progression speed'e, reward structure'ı monetization-retention balance'a bağladığın anda churn düşer, LTV artar. Türkiye stüdyolarının çoğu hala "ayda 2 event yayınla" diyorsa, sen bu modeli kurup tier-1 marketlerde rekabet edebilirsin. Retention engineering live ops için opsiyonel değil, zorunlu. [App Store Optimization](https://www.roibase.com.tr/tr/aso) ile organik acquisition'ı ölçeklendirdikten sonra live ops calendar bu kullanıcıları lifecycle'da tutmanın tek yolu.