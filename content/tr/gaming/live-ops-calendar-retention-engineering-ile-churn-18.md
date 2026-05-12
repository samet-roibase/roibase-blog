---
title: "Live Ops Calendar: Retention Engineering ile Churn -%18"
description: "Event cadence, content depth, monetization-retention balansını data-driven optimize etmek — mobile F2P'de cohort analizi, burn-out modellemesi ve live ops mimarisi."
publishedAt: 2026-05-12
modifiedAt: 2026-05-12
category: gaming
i18nKey: gaming-003-2026-05
tags: [live-ops, retention-engineering, churn-modeling, mobile-gaming, f2p-monetization]
readingTime: 8
author: Roibase
---

Mobile F2P stüdyoları live ops'u content takvimi gibi yönetir — pazartesi event başlar, cuma biter, yeni hafta yeni event. Sonuç: D30 retention %12'de takılır, oyuncu burn-out yaşar, yeni event'e katılım her seferde %5-8 düşer. Retention engineering yaklaşımı şunu sorar: hangi event cadence, hangi depth ve hangi monetization ağırlığı combinasyonu cohort bazında churn'ü minimize eder? 2025 H2'de bu modeli uygulayan bir casual puzzle oyunu churn'ü 6 ayda %18 düşürdü, D7-D30 cohort lifetime value'sunu %24 artırdı. Live ops artık calendar değil, sistem mühendisliği.

## Event Cadence: Frekans Değil, Ritim

Live ops frekansının doğrudan churn ile ilişkisi yok — haftalık 3 event de oyuncu kaybedebilir, aylık 1 event de. Asıl soru: oyuncunun cognitive load kapasitesi ile event complexity dengesi nerede? Retention engineering yaklaşımı şu parametreleri ölçer: event overlap ratio (aynı anda kaç event açık), content unlock velocity (oyuncunun event task'ını tamamlama süresi), monetization pressure score (event'in ARPPU target'ına ulaşmak için gereken ortalama harcama). Örnek: bir mid-core RPG stüdyosu 4 paralel event çalıştırıyordu, overlap ratio 1.8 (oyuncular ortalama 1.8 event'e giriş yapabiliyordu). Cohort analizi gösterdi: ratio 1.8'in üstünde D14 retention -%9 drop gösteriyor. Çözüm: event sayısını düşürmediler, progression gating'i optimize ettiler — her event'in unlock koşulunu sofistike ettiler, overlap ratio'yu 1.3'e çektiler. D14 retention +%11, churn -%13.

Event cadence'ı takvim değil, oyuncu capacity modeli ile tasarla. Hangi segment hangi frekansta burn-out yaşıyor? Whale segment için yüksek cadence cazip olabilir (content consumption rate yüksek), casual segment için overload. Segment bazında event visibility control yap — aynı event'i farklı segmentlere farklı zaman pencerelerinde aç, cohort retention delta'larını karşılaştır. Bir casual puzzle stüdyosu bunu test etti: haftalık event'i whale segment için 5 gün, casual için 7 gün açık tuttu. Casual cohort'un D7 retention'ı %8 arttı (event completion pressure azaldı), whale cohort'un ARPPU'su %6 düştü ama LTV/churn ratio iyileşti (oyuncu oyunda daha uzun kaldı). Trade-off: kısa vadeli monetization kaybı, uzun vadeli retention kazancı.

### Content Unlock Velocity: Task Completion Süresinin Churn Korelasyonu

Event task'larını tamamlama süresinin oyuncu lifetime'a doğrudan etkisi var — çok hızlı tamamlama: oyuncu bekleme moduna girer, churn riski artar. Çok yavaş: frustration, bırakma. Optimum velocity nerede? Bir casual puzzle oyunu event progression datası ile churn modellemesi yaptı: 72 saat event window'unda 48 saat içinde tamamlayan cohort'un D30 retention'ı %34, 24 saat içinde tamamlayanların %28, 60+ saat sürenler %19. Optimum nokta: event window'nun %60-70'i içinde completion. Bu bilgiyi kullanarak task difficulty algoritmasını optimize ettiler — oyuncunun geçmiş session pattern'ına göre task count ve XP requirement'ı dinamik ayarladılar. Sonuç: ortalama completion süresi 52 saate indi, D30 retention +%9.

## Content Depth: Shallow Event Spam vs. Deep Milestone Design

Live ops'da "daha fazla content = daha fazla retention" yanılgısı yaygın — her hafta yeni event, yeni tema, yeni asset. Retention engineering yaklaşımı şunu sorar: oyuncu event'e ne kadar cognitive investment yapıyor? Shallow event: 10 dakika bakıp geçiyor, hiçbir progress memory oluşmuyor. Deep event: 3-5 session boyunca progress tracking yapıyor, milestone'ları hatırlıyor, bıraktığı yerden devam etme motivasyonu oluşuyor. Bir mid-core strategy oyunu bunu test etti: shallow event (3 günlük, 5 task, tek tier reward) vs. deep event (7 günlük, 15 task, 3 tier milestone, ara ödüller). Deep event cohort'unun D7 retention'ı %17 daha yüksek çıktı. Neden? Oyuncu event'e sunk cost investment yaptı — "3 milestone tamamladım, bırakırsam boşa gider" psikolojisi.

Content depth'i artırmanın maliyeti yüksek — daha fazla asset, daha karmaşık balancing, daha uzun QA. Trade-off: event sayısını düşür, depth'i artır. Bir casual puzzle stüdyosu ayda 8 shallow event yerine 4 deep event'e geçti. Production cost %12 düştü (asset reuse arttı), D30 retention %14 yükseldi. Deep event nasıl tasarlanır? Milestone-based progression: her milestone oyuncuya intermediate reward + visibility (leaderboard, badge). Progress tracking UI: oyuncu nerede olduğunu her an görmeli. Social proof: arkadaşlarının hangi milestone'da olduğunu görmek retention artırır (FOMO). Bir RPG stüdyosu guild-based milestone event yaptı: guild üyeleri collective task pool'a katkı yapıyor, her tier unlock ortak reward veriyor. Guild cohort'un D30 retention'ı solo event'e göre %22 daha yüksek çıktı.

### Milestone Pacing: Front-Load vs. Back-Load Reward Distribution

Event reward distribution'ı retention'ı direkt etkiler — front-load (ilk milestone'lar cömert, sonrakiler zayıf) vs. back-load (son milestone'larda premium reward yığılması). Bir casual puzzle oyunu A/B test yaptı: front-load cohort'un D7 retention'ı %4 daha yüksek (erken dopamine hit, oyuncuya güven veriyor), back-load cohort'un ARPPU'su %9 daha yüksek (son milestone için IAP baskısı). Trade-off: retention vs. monetization. Çözüm: segment-based distribution. Whale segment için back-load (zaten retention riski düşük, monetization optimize et), casual segment için front-load (retention kritik). Bir mid-core RPG bunu uyguladı: whale'lere son milestone'da exclusive skin, casual'lara 2. milestone'da premium currency burst. Net sonuç: blended D30 retention +%11, ARPPU -%3 (kabul edilebilir, LTV/churn ratio iyileşti).

## Monetization-Retention Balansı: ARPPU Target'ı Churn Tahmini ile Sınırla

Live ops event'lerde monetization pressure (oyuncuya "harcama yoksa tamamlayamazsın" mesajı veren tasarım) retention'ı öldürür. Klasik hata: event'i IAP funnel gibi tasarlamak — her milestone için paywall, completion için mandatory purchase. Sonuç: non-paying oyuncu frustrate olur, bırakır. Retention engineering yaklaşımı: monetization pressure score = (IAP-dependent task count / total task count) × (average spend to complete / average session revenue). Score 0.3'ün üstünde churn %12-15 artar. Bir casual puzzle stüdyosu bunu ölçtü: event'lerinin ortalama pressure score'u 0.48 çıktı, D14 retention %19. Event tasarımını revize ettiler: IAP-dependent task'ları opsiyonel yaptılar (core progression IAP-free, bonus tier IAP-gated). Score 0.22'ye düştü, D14 retention +%13.

Monetization-retention balansının doğru modeli: oyuncuya "harcamasan da tamamlarsın ama harcama hızlandırır" yolu aç. Örnek: event 7 günlük, oyuncu organic grinding ile 6.5 günde tamamlayabilir. IAP ile 4 günde tamamlar, 2.5 gün ekstra time-limited bonus event'e girebilir. Bu model non-payer retention'ı koruyor (IAP baskısı yok), payer'a value prop veriyor (time efficiency). Bir mid-core RPG bunu test etti: IAP-free completion rate %62'den %71'e çıktı, IAP conversion rate %8'den %6'ya düştü AMA IAP kullanan oyuncuların average transaction count +%19 arttı (event'e tekrar giriş motivasyonu). Net ARPPU -%2, D30 LTV +%17.

Whale segment için özel event tier tasarla — core event herkese açık, whale-only tier high-stakes reward + competitive leaderboard. Bu model casual oyuncuyu overwhelm etmez, whale'i engage eder. Bir strategy oyunu bunu uyguladı: standart event 3 tier, whale tier (top %5 spender) 2 extra tier + exclusive cosmetic. Whale cohort'un event participation rate %88'den %94'e çıktı, casual cohort etkilenmedi. Whale tier'dan gelen revenue total event revenue'nun %41'i oldu.

## Churn Modeling: Event Impact Tahmini ile Cadence Optimizasyonu

Live ops calendar'ını churn tahmin modeli ile optimize et. Model: oyuncunun geçmiş event participation history, session frequency, monetization pattern → next event'e katılma probability + event completion probability + post-event churn risk. Bir casual puzzle oyunu bunu kurdu: event başlamadan 2 gün önce her oyuncu için participation probability hesaplıyor, %30'un altındaki oyunculara pre-event notification + teaser reward gönderiyor. Participation rate %58'den %67'ye çıktı. Event completion sonrası churn risk modeli: oyuncu event'i erken (48 saat içinde) tamamladıysa ve sonraki 24 saatte session açmadıysa → yüksek churn riski. Bu segmente post-event "cooldown" content öneriyor (düşük complexity, düşük pressure). Bir RPG stüdyosu bunu test etti: post-event churn %14'ten %9'a düştü.

Churn modeling'i event design döngüsüne entegre et. Yeni event tasarlarken: expected participation rate, expected completion rate, expected post-event churn rate simüle et. Model %20+ churn riski gösteriyorsa event difficulty veya monetization pressure'ı düşür. Bir casual puzzle stüdyosu bunu production pipeline'ına ekledi: her event pre-launch churn simulation'dan geçiyor, threshold aşarsa design iteration. İlk 6 ayda 8 event revize edildi, ortalama D30 churn -%18.

### Burn-Out Detection: Session Pattern Anomaly ile Erken Uyarı

Oyuncu burn-out event participation düşmeden önce session pattern'ında görülür — session frequency artar ama session length düşer (oyuncu task'ı tamamlamak için giriyor, eğlenmiyor). Bir mid-core RPG bunu ölçtü: burn-out cohort'un session length 18 dakikadan 11 dakikaya düşüyor, frequency 1.2'den 1.8'e çıkıyor (oyuncu zoraki giriyor). Bu pattern görülünce event cadence'ı oyuncu bazında otomatik ayarlıyorlar — 3 gün event break, düşük pressure content gösteriyorlar. Burn-out cohort'un D14 retention'ı %16'dan %28'e çıktı.

## Roibase [App Store Optimization](https://www.roibase.com.tr/tr/aso) yaklaşımı ile live ops stratejisini birleştir — event'lerin custom product page creative'lerinde vurgulanması, event participation rate ile organic install cohort retention'ının karşılaştırılması. Event döneminde CPP A/B test'i: "yeni event" vurgusu yapan creative vs. generic gameplay creative. Event-focused creative'den gelen cohort'un D7 participation rate %23 daha yüksek çıkabilir. Bu data event calendar timing'ini optimize eder — yüksek impact event'leri acquisition campaign'leri ile senkronize et.

---

Live ops calendar retention engineering ile tasarlandığında event sayısı değil, cohort lifetime value optimize edilir. Event cadence, content depth, monetization pressure score, churn modeling ve burn-out detection data layer'ı oluşturur — takvim değil, adaptive sistem. Casual puzzle oyununun 6 aylık sonucu: event sayısı 24'ten 18'e düştü, D30 retention %24'ten %42'ye çıktı, churn -%18, LTV +%31. Soru: senin live ops calendar'ın cohort LTV'sini optimize ediyor mu, yoksa sadece content slot'larını dolduruyor mu?