---
title: "Live Ops Calendar: Retention Engineering ile Churn -%18"
description: "Event cadence, content depth ve monetization-retention dengesini Markov cohort modeliyle optimize edip churn'ü düşürmek için veri odaklı live ops stratejisi."
publishedAt: 2026-07-24
modifiedAt: 2026-07-24
category: gaming
i18nKey: gaming-003-2026-07
tags: [live-ops, retention-engineering, churn-optimization, mobile-gaming, f2p-monetization]
readingTime: 8
author: Roibase
---

Mobile F2P oyunlarda live ops'un "sürekli yeni şeyler" üretmek olduğu varsayımı 2026'da artık geçersiz. Çoğu stüdyo event'leri doldurma aracı olarak görüyor — oysa doğru event cadence, content depth ve monetization-retention dengesi Markov cohort modeliyle optimize edildiğinde churn %18 düşüyor. Live ops artık takvim değil, bir retention mühendisliği sistemi.

## Event Cadence'ı Rastgele Bırakmak Pahalı

Çoğu stüdyo haftalık event rotasyonunu "her hafta bir şey olsun" mantığıyla kuruyor. Bu yaklaşımın iki sorunu var: birincisi event sıklığını cohort dinamiklerine göre kalibre etmiyor, ikincisi monetization eventi ile engagement eventi arasındaki dengeyi varsayımla kuruyor.

Markov cohort modelinde her event tipi (seasonal, monetization, progression) bir state olarak tanımlanır. Oyuncunun bir eventten diğerine geçiş olasılığı `P(event_j | event_i, session_gap)` formülüyle hesaplanır. Bu geçiş matrisi, oyuncuların event tükenmesi riskini (event fatigue) ve optimal geri dönüş penceresini gösterir. Örneğin bir stüdyo gacha eventi sonrası 72 saat içinde progression event başlatırsa churn %12 artıyor — çünkü oyuncunun envanteri henüz sindirmemiş. 120 saat boşluk bıraktığında churn -%8'e iniyor.

Event cadence'ı optimize etmek için D1/D3/D7 cohort'larını ayrı modellemek gerekiyor. D1 cohort için event exposure %0 olmalı — onboarding tamamlanmadan event UI açmak retention'ı %22 düşürüyor (Deconstructor of Fun 2025 benchmark). D3 cohort için ilk event mini-progression eventi olmalı (retention +%9), D7+ cohort için monetization eventi açılabilir. Event takvimi tek bir döngü değil, cohort-state matrisi olarak tasarlanmalı.

### Event Fatigue Eşiği Nasıl Bulunur

Event fatigue'i ölçmek için `session_gap / event_duration` oranı kullanılır. Oran 2'nin altına düştüğünde (örn. 3 günlük event, 5 gün sonra yeni event) oyuncunun ARPU'su %14 düşüyor. Optimal oran 3.5-4.5 arasında — yani event bitiminden sonra event süresinin 3.5 katı kadar boşluk bırakmak. Bu boşluğu progression sistemi doldurmalı, yoksa churn artıyor.

## Content Depth: Event Uzunluğu ile Engagement Çelişkisi

Event'lerin uzun olması daha fazla engagement getirmez — ölçülebilir derinlik getirir. 7 günlük bir event 3 günlük event'ten %40 daha uzun değil, oyuncunun günlük taahhüdünü artırıyor. Ancak derinlik doğru kurgulanmazsa event'in son 2 günü engagement %60 düşüyor.

Content depth'i tanımlamak için event'i atomic görevlere bölüp her görevin tamamlanma süresini ölçmek gerekiyor. Örneğin bir battlepass'te 50 tier varsa ve oyuncunun günlük ortalama 4 tier tamamladığı görülüyorsa event minimum 12.5 gün sürmelidir — ancak bu "minimum" değil, "bitme garantisi". Derinlik için %20 buffer eklenmelidir (15 gün). Event 15 günden kısa kurulursa oyuncunun %35'i son 2 günde tier'leri ezber modda tıklayıp değer algısı düşüyor.

Content depth'in ikinci boyutu "branching". Tek linear bir event yerine paralel track'ler açmak (PvE + PvP + crafting) oyuncunun günlük session süresini %18 artırıyor. Ancak track sayısı 4'ü geçerse oyuncu UI'da kaybolup churn %11 artıyor. Optimal content architecture 3 paralel track + 1 ortak final milestone.

| Event Tipi | Track Sayısı | Avg Daily Playtime (dk) | Completion % | Churn D7 |
|---|---|---|---|---|
| Linear (1 track) | 1 | 22 | %48 | %19 |
| Dual track | 2 | 28 | %56 | %14 |
| Triple track | 3 | 34 | %61 | %11 |
| Quad track | 4+ | 29 | %43 | %20 |

Tablo, 2025 Q4'te 8 farklı mid-core oyundan toplanan cohort verisi (kaynak: GameRefinery Retention Toolkit). Triple track'te completion ve retention optimal — quad track UI complexity nedeniyle düşüyor.

## Monetization-Retention Dengesi: IAP Event'inin Maliyeti

Monetization eventi (limited offer, gacha banner, discount bundle) kısa vadede ARPU artırır ama retention üzerinde asimetrik etki yapar. Bir IAP eventi D7 retention'ı %3-5 düşürebilir — çünkü oyuncu purchasing süreci sonrası content tüketimini hızlandırıp erken platoya ulaşıyor.

Bu dengeyi kurmak için event takviminde "monetization window" ile "progression window" oranını 1:2.5 tutmak gerekiyor. Yani ayda 4 hafta varsa 1.5 hafta monetization eventi, 2.5 hafta progression/engagement eventi olmalı. Bu oran bozulduğunda (örn. her hafta monetization eventi) oyuncunun algılanan "pay-to-win pressure" skoru artıyor ve organik retention %16 düşüyor.

Monetization event'ini retention-safe yapmak için iki mekanik kritik: **birincisi**, IAP sonrası hemen yeni content unlock etmemek — oyuncuya satın aldığı varlığı sindirme süresi vermek (72-96 saat boşluk). **İkincisi**, monetization event'inin ödülünü progression event'ine bağlamak. Örneğin gacha banner çekimi sonrası oyuncunun yeni karakteri levellayabilmesi için progression event'teki görevleri tamamlaması gerekiyorsa IAP + engagement birbirine kilitlenmiş oluyor, churn düşüyor.

### Hard Currency Sink Timing

Hard currency (elmas, gem) harcama eventi, oyuncunun envanterindeki currency miktarına göre zamanlanmalı. Oyuncunun currency'si median değerin %120'sini geçtiğinde (yani zengin cohort) harcama eventi açmak ARPU'yu %31 artırıyor. Oyuncunun currency'si median'ın %60'ının altındaysa harcama eventi açmak churn'ü %9 artırıyor — çünkü oyuncu "afford edemiyorum" hissine kapılıyor. Currency distribution histogram'ını haftalık çekmek ve event'leri buna göre zamanlamak monetization-retention dengesinin omurgası.

## Live Ops Calendar'ı SQL ile Kurmak

Live ops takvimini Excel'de tutmak yerine event'leri bir state machine olarak SQL'de modellemek hem cadence'ı hem content depth'i hem de monetization balance'ı otomatik optimize ediyor. Her event bir `event_type`, `duration`, `cooldown_min`, `target_cohort`, `monetization_flag` ile tanımlanır. Bir script her gün cohort dağılımını okuyup bir sonraki event'i seçer.

```sql
WITH cohort_state AS (
  SELECT
    cohort_day,
    COUNT(DISTINCT user_id) AS users,
    AVG(session_count_7d) AS avg_sessions,
    AVG(hard_currency) AS avg_currency
  FROM user_metrics
  WHERE last_session >= CURRENT_DATE - 7
  GROUP BY cohort_day
),
event_candidates AS (
  SELECT
    event_id,
    event_type,
    duration,
    cooldown_min,
    target_cohort_min,
    target_cohort_max,
    monetization_flag,
    COALESCE(last_run_date, '2020-01-01') AS last_run
  FROM live_ops_events
  WHERE
    CURRENT_DATE - COALESCE(last_run_date, '2020-01-01') >= cooldown_min
)
SELECT
  ec.event_id,
  ec.event_type,
  ec.duration,
  SUM(cs.users) AS eligible_users,
  AVG(cs.avg_sessions) AS cohort_engagement,
  AVG(cs.avg_currency) AS cohort_wealth
FROM event_candidates ec
JOIN cohort_state cs
  ON cs.cohort_day BETWEEN ec.target_cohort_min AND ec.target_cohort_max
WHERE
  (ec.monetization_flag = 0 OR cs.avg_currency > 500)
GROUP BY ec.event_id, ec.event_type, ec.duration
ORDER BY cohort_engagement DESC
LIMIT 1;
```

Bu query her gün en uygun eventi seçiyor: cooldown geçmiş, cohort range uygun, monetization event ise oyuncunun currency'si eşik üstünde. Output doğrudan event scheduler'a gidiyor.

## Retention Engineering: Churn Modelini Event Loop'a Bağlamak

Live ops calendar'ı retention engineering sistemi haline getirmek için churn prediction modelini event selection loop'una entegre etmek gerekiyor. Her oyuncu için 7 günlük churn riski hesaplanır (`P(churn_D7)`), riskli cohort'a özel event açılır.

Örneğin bir oyuncunun `P(churn_D7) > 0.35` ise ve son 3 günde session yapmamışsa "win-back event" tetiklenir — bu event lightweight (15 dakika tamamlanabilir), ödülü garantili, monetization yok. Bu tür event'ler churn'ü %18 düşürüyor (başlıktaki rakam buradan geliyor). Churn prediction modeli logistic regression, gradient boosting veya LSTM olabilir — önemli olan model output'unun event trigger condition'ı olarak kullanılması.

Churn modelini event loop'a bağlarken iki metrik izlenmeli: **lift** (event sonrası churn risk düşüşü) ve **CAC-equivalent** (win-back event maliyetini yeni user acquisition maliyetine bölmek). Lift %15'in altındaysa event tasarımı değişmeli, CAC-equivalent 0.3'ün üstündeyse (yani win-back maliyeti UA'nın %30'undan pahalıysa) event kaldırılmalı.

### Event Response Rate Tahmin Modeli

Event açıldığında kaç oyuncunun participate edeceğini tahmin etmek capacity planning için kritik. Basit bir model:

```
participation_rate = base_rate × (1 + reward_multiplier) × (1 - fatigue_penalty)

fatigue_penalty = max(0, (days_since_last_event - optimal_gap) / optimal_gap × 0.15)
```

Örneğin base participation %32, ödül %20 artırılmışsa `reward_multiplier = 0.2`, optimal gap 10 gün ama event 6 gün sonra açılmışsa `fatigue_penalty = (10-6)/10 × 0.15 = 0.06`. Final participation: `0.32 × 1.2 × 0.94 = %36.1`. Bu tahmin event'in server load'ını ve content budget'ini belirliyor.

## Oyun Dışı Büyümeyi Live Ops'a Bağlamak

Live ops sadece in-game bir retention mekanizması değil, aynı zamanda [App Store Optimization](https://www.roibase.com.tr/tr/aso) ve UA stratejisinin parçası. Seasonal event'ler custom product page (CPP) ile test edilerek Apple Search Ads creative'lerinde kullanılabilir. Örneğin Ramazan event'i CPP'de %42 daha yüksek conversion veriyorsa UA budget'inin %30'u bu event penceresine kaydırılmalı.

Event calendar UA takvimiyle senkronize olmalı: büyük bir event 2 hafta öncesinden duyurulup UA kampanyasına "yeni içerik geliyor" messaging'i eklenmeli. Event başladığında install spike retention'a dönüşmezse (D7 retention event öncesine göre +%5 artmıyorsa) event-UA alignment bozuk demektir. Bu durumda event'in onboarding'e entegrasyonu revize edilmeli — yeni kullanıcı event'e 24 saat içinde maruz kalmalı, yoksa UA spend boşa gidiyor.

---

Live ops calendar'ı retention mühendisliği sistemine dönüştürmek için event cadence Markov modeliyle, content depth branching architecture ile, monetization balance cohort wealth distribution ile optimize edilmeli. Churn prediction modeli event trigger olarak kullanılıp SQL-based scheduler'a entegre edildiğinde churn %18 düşüyor. Live ops artık "takvim doldurmak" değil, cohort state'ini sürekli okuyup optimal event'i seçen bir loop. Stüdyo bunu yapmıyorsa LTV ceiling'e çarpıyor.