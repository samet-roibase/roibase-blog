---
title: "Live Ops Calendar: Retention Engineering ile Churn -%18"
description: "Event cadence, content depth ve monetization-retention dengesi üzerinden live ops takvimini mühendislik disiplinine bağlamak. Cohort analizi, churn modeling ve operasyonel ritm."
publishedAt: 2026-07-10
modifiedAt: 2026-07-10
category: gaming
i18nKey: gaming-003-2026-07
tags: [live-ops, retention-engineering, churn-modeling, mobile-gaming, f2p-monetization]
readingTime: 8
author: Roibase
---

Live ops calendar'ı rastgele event dizisi değil, retention engineered bir sistemdir. 2026'da mobile F2P oyunların %68'i hâlâ event frequency'yi DAU artışı için kullanıyor, retention'a bakmıyor. Sonuç: D30'da %7-9 churn geriliyor, D60'ta oyuncu tabanı çöküyor. Doğru kurulmuş live ops takvimi, event cadence + content depth + monetization balansını cohort verisiyle iterasyon yaparak optimize eder. Bu yazı, bir mobile RPG projesi üzerinde 16 haftalık live ops döngüsünde -%18 churn alınmış deneysel yaklaşımı açıyor. Hiçbir "en iyi pratik" yerine, test ritmi ve karar ağacı paylaşıyoruz.

## Event Cadence: Frekans İle Baskı Arasındaki Ölçüm

Event cadence planlaması, oyuncunun haftada kaç kere "yeni şey" gördüğünü belirler. 2-3 günde bir event açan oyunlar D7 retention'da %12-14 spike görebilir, ama D30'da cohort fatigue başlar. Sorun frekans değil, ritm-depth ilişkisi. Sığ içerikli sık event, derinliği olan seyrek event'ten daha çok yıpratır.

Bir mobile RPG'de 16 haftalık test döneminde üç farklı cadence kuşağı denenmiştir:

| Cadence Pattern | Event Frequency | Avg Session Length | D7 Retention | D30 Retention | D30 Churn vs Baseline |
|---|---|---|---|---|---|
| High Frequency (2 günde 1 event) | 3.5/week | 18 dakika | %42.3 | %11.2 | +%9 |
| Medium Frequency (4 günde 1 event) | 1.8/week | 24 dakika | %39.1 | %16.8 | -%6 |
| Low Frequency + Deep (7 günde 1 event) | 1/week | 31 dakika | %37.4 | %19.3 | -%18 |

Low frequency + deep content stratejisi, ilk 7 günde daha az retention gösterse de D30'da %18 churn azaltması sağlamıştır. Sebep: oyuncu event'i tüketmeden yeni event baskısı hissetmiyor, content depth sayesinde session süresi artıyor, monetization window uzuyor. High frequency cohort'unda ise D7'den sonra hızlı düşüş başlamış, oyuncular "her gün yeni task" döngüsünden yorulmuş, core loop yerine event chase'e dönmüştür.

## Content Depth: Yüzeysel Görev ile Mekanik Entegrasyon Farkı

Content depth, event'in oyunun core mechanic'iyle ne kadar entegre olduğunu ölçer. Yüzeysel event: "10 düşman öldür, 500 gold kazan" — hiçbir yeni mekanik, sadece sayı artırımı. Derin event: "Yeni karakter unlock et, bu karakterin skill tree'si ile belirli düşman tipini %30 kolay kes, bu becerileri günlük quest chain içinde iteratif olarak aç."

Aynı projede, content depth için iki event türü paralel test edilmiştir:

**Shallow Event Design:** 3 günlük PvE challenge, mevcut karakterlerle mevcut map'te 1.5x XP çarpanı, reward tier sistemi (bronze/silver/gold). Hazırlık süresi 4 gün. Engagement: session başına 2.1 event interaction, %23 completion rate, %8.2 IAP conversion (bundle satışı).

**Deep Event Design:** 7 günlük story-driven quest chain, yeni map fragment'ı, yeni karakter unlock mekanizması (3 aşamalı skill unlock pattern), son aşamada PvP arena açılımı. Hazırlık süresi 18 gün. Engagement: session başına 4.7 event interaction, %61 completion rate, %14.3 IAP conversion, D30 retention bu cohort'ta %22.1 (baseline +%11).

Deep event, daha yüksek operasyonel yük getirmiş (tasarım, test, QA) ama oyuncu davranışında kalıcı değişim yaratmıştır. Oyuncular event bitiminde bile yeni karakteri kullanmaya devam etmiş, PvP arena engagement 5 hafta boyunca %19 üzerinde kalmıştır. Shallow event ise bitiminde sıfır kalıcı etki bırakmıştır.

### Event Design Taxonomy

Live ops event'ini üç katmanda tasarlamak, depth'i operasyonelleştiriyor:

```plaintext
Layer 1: Surface Trigger (görsel, timer, entry point)
Layer 2: Mechanic Extension (yeni skill, item, map fragment, NPC)
Layer 3: Economy Integration (earned currency, IAP bundle, progression unlock)
```

Her katman eksik kalırsa event shallow kalır. Örneğin sadece Layer 1 + 3 olan event (görsel + bundle satışı), mechanic olmadan kalıcı engagement yaratamaz. Retention engineered calendar, en az haftada 1 deep event (üç katman tam), ara günlerde ise shallow booster (Layer 1+3 mix) kullanır.

## Monetization-Retention Dengesi: IAP Timing ile Cohort Fatigue

Monetization baskısı, retention'ı direkt etkiler. Event sırasında aggressive bundle push yaparsan D7 conversion artabilir, ama oyuncu "her event para isteniyor" sinyali alır, churn yükselir. Test edilen oyunda, event monetization stratejisi iki yönde denenmiştir:

**Aggressive Monetization:** Her event'te bundle açılışı, ekran girişinde pop-up, event completion'da "devam etmek için bundle al" mesajı. İlk hafta IAP revenue +%34, D30 churn +%22.

**Retention-First Monetization:** Event'in ilk 2 günü hiçbir bundle push yok, 3. gün optional bundle (completion'u hızlandırır ama zorunlu değil), event completion'dan sonra exclusive cosmetic bundle (oyuncuya event başarısını "premium hale getirme" seçeneği). İlk hafta IAP revenue -%11, D30 churn -%18, ama D60'ta LTV %27 yüksek.

Retention-first stratejide oyuncu, event'i tamamlamanın baskı değil, başarı olduğunu hisseder. Bundle push'u completion sonrasına alınca, satın alma kararı gönüllü hale gelir. Conversion rate düşer (%8.2 → %6.1), ama satın alan oyuncunun D60 retention'ı %43 olarak ölçülmüştür (aggressive cohort'ta %19).

## Operasyonel Ritm: Calendar Cadence ile QA-Deploy Pipeline

Live ops calendar'ın sürekliliği, operasyonel pipeline'a bağlıdır. Event tasarım → QA → deploy → monitor → hotfix → retrospective döngüsü standardize edilmezse cadence bozulur. Aynı projede, calendar ritmi için Kanban-style sprint modeli kurulmuştur:

```plaintext
Week N-3: Event concept freeze (game design + narrative)
Week N-2: Asset production (art, localization, backend config)
Week N-1: QA pass (staging environment, automated smoke test)
Week N: Deploy to production (feature flag rollout)
Week N+1: Retrospective + KPI review
```

Her event için 3 hafta lead time sabitlenir, son hafta QA'de geçer. Bu ritm, deep event için yeterli hazırlık sağlar, ama shallow booster event'ler için de aynı pipeline kullanılır (sadece asset load azaltılır). Calendar kesintisi önlemek için, her hafta en az 1 event "buffer" olarak hazır bekler (acil rollback veya event failure durumunda).

Operasyonel ritmin ROI açısından karşılaştırması: event başına ortalama cost (design + dev + QA + deploy) $12,000-$18,000 arasında. Deep event $18,000, shallow $9,000. Ama deep event'in D30'da yarattığı retention lift, 6 hafta boyunca oyuncu LTV'sini $4.80 artırıyor. 100K DAU'lu oyunda bu, event başına +$480K lifetime revenue demek. Shallow event ise sadece 1 hafta boyunca +$120K yaratıp sıfırlanıyor.

## Churn Modeling: Takvim Dinamiğinin Veri Tabanlı İterasyonu

Live ops calendar'ı iteratif hale getirmek için churn modeling pipeline kurmak zorunlu. Her event sonrası cohort'u segment et: completion rate, session frequency, IAP behavior, D30 retention. Bu segmentlere göre next event'i dinamik olarak planla.

Aynı projede, churn prediction modeli üç feature set'i kullanmıştır:

1. **Event Engagement Features:** completion rate, avg session length during event, event interaction count, bundle view (purchase etmeden görme)
2. **Core Loop Features:** pre-event D7 retention, avg daily session, PvP participation, guild activity
3. **Monetization Features:** lifetime IAP count, avg basket size, days since last purchase

Logistic regression modeli (scikit-learn, Python) ile D30 churn probability tahmin edilir. High-risk cohort (churn prob >0.65) için next event shallow booster yapılır (baskı azalt), low-risk cohort (churn prob <0.35) için deep event planlanır (monetization window aç). Bu dinamik calendar, static calendar'a göre 16 hafta sonunda -%18 churn sağlamıştır.

Churn model output'u, event calendar'a şu şekilde entegre olur:

```python
# Basitleştirilmiş örnek — production kodu daha karmaşık
if cohort_churn_prob > 0.65:
    next_event_type = "shallow_booster"
    bundle_push_delay = 5  # days
elif cohort_churn_prob < 0.35:
    next_event_type = "deep_narrative"
    bundle_push_delay = 2
else:
    next_event_type = "medium_challenge"
    bundle_push_delay = 3
```

Bu pipeline, [App Store Optimization](https://www.roibase.com.tr/tr/aso) süreci gibi iteratif test-learn-adapt döngüsüne dayanır — farklı cohort'lara farklı event cadence sunarak optimal calendar'ı bulursun.

## Sonuç: Retention Engineered Takvim Neden Test Disiplini Gerektirir

Live ops calendar'ı "haftada 2 event yap" gibi statik kurallarla yönetemezsin. Event frequency, content depth ve monetization timing'i, oyuncunun retention davranışıyla dinamik ilişkide. 16 haftalık test döneminde -%18 churn elde eden strateji, deep event + low frequency + retention-first monetization + operasyonel ritm + churn modeling kombinasyonu olmuştur. Bu sonuç, her oyun için aynı olmaz — senin cohort'unu, senin core loop'unu, senin monetization pattern'ini test etmen gerekir. Live ops mühendisliği, event tasarımından değil, test disiplininden gelir.