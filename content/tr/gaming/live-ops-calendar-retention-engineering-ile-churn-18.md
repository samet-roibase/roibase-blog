---
title: "Live Ops Calendar: Retention Engineering ile Churn -%18"
description: "Event cadence, content depth ve monetization-retention dengesini mühendislik disipliniyle kurmak: cohort-bazlı planlama, dinamik difficulty ve IAP timing stratejisi."
publishedAt: 2026-08-07
modifiedAt: 2026-08-07
category: gaming
i18nKey: gaming-003-2026-08
tags: [live-ops, retention-engineering, mobile-gaming, churn-reduction, f2p-monetization]
readingTime: 8
author: Roibase
---

Mobile F2P oyunların %70'i ilk 30 günde kullanıcısını kaybediyor. Churn bu kadar yüksek olunca live ops ekipleri sürekli yangın söndürme modunda çalışıyor: her hafta yeni event, yeni bundle, yeni içerik. Fakat bu reactive yaklaşım retention sorununu çözmüyor, aksine event fatigue yaratıyor. Oyuncular event'leri tamamlayamayınca terk ediyor, tamamlayanlar da sonraki event'e kadar churn ediyor. Live ops calendar'ı retention engineering disiplinine bağlamak bu döngüyü kırmak demek: event cadence, content depth ve monetization-retention dengesini cohort davranışı üzerinden kurmak.

## Event Cadence: Zamanlama Matematiksel Bir Sorudur

Klasik yaklaşım: her hafta event yayınla, engagement yüksek tut. Veri bunu desteklemiyor. Sensor Tower'ın 2025 analizine göre top-grossing oyunların %62'si fixed-cadence yerine cohort-responsive event takvimi kullanıyor. Fixed-cadence mantığı şu: her Cuma event başlat, 7 gün sürsün, ardışık devam et. Sorun: D3 oyuncu ile D45 oyuncu aynı event'e aynı anda maruz kalıyor. D3'e göre zorluk seviyesi düşükse D45 sıkılıyor, D45'e göre ayarlıysa D3 frustrate oluyor. Her iki durumda da churn artıyor.

Cohort-responsive yaklaşım event'i segmente göre trigger ediyor. Örnek: D7'ye ulaşan oyuncular için "Week 1 Boss Challenge" aktive oluyor, D30'dakiler için "Veteran League Season 2". Aynı takvim günü olsa bile her oyuncu kendi journey'sine uygun event görüyor. Bu yapı event fatigue'u azaltıyor çünkü oyuncu her zaman kendisine uygun zorlukta içerikle karşılaşıyor. Supercell'in Clash Royale verisine göre bu model churn'ü %18 düşürüyor (2024 GDC sunumu).

Event cadence'i kurarken cohort bazlı 3 parametre hesaplanmalı: event tetikleme koşulu (D7/D14/D30 progression gate), event süresi (completion rate hedefine göre 3-7 gün), event arası gap (next event trigger için minimum bekleme süresi). Gap süresi kritik: çok kısa gap burnout yaratır, çok uzun gap retention düşürür. Optimum gap content consumption rate ile bağlantılı: ortalama oyuncu event içeriğinin %80'ini tamamladıktan 24-48 saat sonra yeni event tetiklenmeli.

### Tetikleme Koşulu Tablosu

| Cohort | Event Tetikleme | Zorluk | Süre | Gap |
|--------|----------------|--------|------|-----|
| D3-D7 | Tutorial completion + level 10 | Beginner | 3 gün | 48 saat |
| D8-D14 | First IAP veya 5 login | Intermediate | 5 gün | 3 gün |
| D15-D30 | Clan join veya 10k resource | Advanced | 7 gün | 5 gün |
| D30+ | Season progression 50%+ | Expert | 7 gün | Dynamic (completion bazlı) |

## Content Depth: Event Uzunluğu Değil Katman Sayısıdır

Event süresi uzatmak retention artırmıyor, aksine tamamlama oranını düşürüyor. 7 günlük event'te ortalama %23 completion rate (Adjust 2025 benchmark), 14 günlük event'te %11. Event'i uzatmak yerine depth katmanları eklemek gerekiyor: base layer (herkesin tamamlayabileceği), stretch layer (skilled oyuncular için), whale layer (monetization odaklı). Bu yapı event'i 7 gün tutup her segment için value proposition sağlıyor.

Base layer tamamlama oranı %75-80 hedeflenmeli. Çoğu oyuncu bu katmanı 3-4 günde bitirmeli. Stretch layer completion %30-40, whale layer %5-10. Her katman bağımsız reward pool'una sahip olmalı: base layer f2p-friendly (soft currency, booster), stretch layer progression-critical (hard currency, exclusive skin), whale layer direct monetization (IAP discount bundle, exclusive character).

Difficulty progression matematiksel formüle bağlanmalı: her level zorluğu bir öncekine göre %8-12 artmalı (çok düşük increase sıkıcı, çok yüksek frustrating). King'in Candy Crush verisine göre optimal increase %10, bu oran player skill curve ile eşleşiyor. Dynamically scaling difficulty kullanıyorsan (oyuncu performansına göre adjust), difficulty ceiling koymalısın: max zorluk progression gate'e denk gelmeli, yoksa f2p oyuncular event'i tamamlayamaz.

Content depth'i planlarken meta-progression'ı unutma: event sırasında kazanılan kaynak/item core game progression'ına nasıl besliyor? Event içi resource'un core economy'ye impact'i hesaplanmalı. Eğer event reward'ı core game'de 2 haftalık progression'ı 1 güne indiriyorsa economy kırılıyor, f2p player 2 hafta hiçbir şey yapamaz hale geliyor. Event reward core progression'ın max %15'ini sağlamalı (GameRefinery 2024 F2P economy raporu).

## Monetization-Retention Dengesi: IAP Timing Churn Tetikçisidir

Event sırasında IAP push'lamak doğal görünüyor ama timing yanlışsa churn artırıyor. Oyuncu event'in ilk 24 saatinde frustrasyonla karşılaşmışsa ve hemen IAP offer'ı görürse "pay-to-win" algısı oluşuyor, %34'ü oyunu siliyor (Deconstructor of Fun 2025 anketi). IAP timing event progression milestone'larına bağlanmalı: ilk IAP offer oyuncunun base layer'ı tamamlamasından sonra gelsin, ikinci offer stretch layer'a entry yapınca. Bu yaklaşım IAP'yi "zorunluluk" değil "accelerator" olarak konumlandırıyor.

IAP bundle composition da retention'a etki ediyor. Pure hard currency bundle (1000 gem $9.99) düşük conversion'a sahip (%1.2 ortalama), mixed bundle (500 gem + exclusive skin + 3-day boost) %3.8 conversion. Mixed bundle perceived value yüksek ama core economy'yi bozmayan miktar sunuyor. Bunun için bundle içindeki soft/hard currency oranı event reward'ı ile overlap etmemeli: event 200 gem reward veriyorsa bundle 500+ gem olmalı, yoksa oyuncu "event reward beklerim" diyor.

Event-specific IAP'nin lifecycle'ı tanımlanmalı: event başlangıcında "starter pack" (düşük fiyat, high perceived value), event ortasında "progression booster" (time-gated, difficulty spike'ta), event bitişinden 6 saat önce "last chance offer" (FOMO bazlı, conversion %4.2). Last chance offer'da discount stack etme: base price'ın %50'si + event completion bonus. Bu timing stratejisi ile Rovio Angry Birds 2'de ARPDAU %11 arttı (2024 earnings call).

Retention engineering açısından en kritik metrik: IAP sonrası D7 retention. Eğer IAP yapan oyuncunun D7 retention'ı yapmayandan düşükse bundle içeriği core progression'ı kırıyor demektir. Healthy ratio: paying user D7 retention, non-paying'e göre minimum %10 yüksek olmalı. Düşükse bundle'daki resource miktarını azalt, exclusive content oranını artır.

## Cohort-Bazlı Event Planlama: Retention Model ile Takvim Kurmak

Live ops calendar'ı manuel değil model-driven kurmak gerekiyor. İlk adım: cohort retention curve'ünü çıkar. D1, D3, D7, D14, D30 retention noktalarını işaretle, en büyük drop-off nerede oluyor? Genelde D3 ve D7 arası en kritik churn window. Event takvimini bu window'lara müdahale edecek şekilde yerleştir: D3'te hafif engagement event (günlük login bonus artışı), D7'de orta zorluk progression event (boss challenge), D14'te social event (clan war).

Event type seçimi cohort davranışına göre yapılmalı. Early cohort (D3-D7) için single-player PvE event (düşük skill floor), mid cohort (D8-D14) için competitive PvE (leaderboard, ama direct PvP değil), late cohort (D15+) için PvP event (clan vs clan). Bu progression oyuncuyu yavaş yavaş competitive content'e hazırlıyor, direct PvP'ye D3'te atmıyorsun. Vainglory'nin 2023 verisi: D7 öncesi PvP'ye maruz kalan oyuncuların %41'i churn ediyor, D14 sonrası PvP başlatanların %18'i.

Event overlap stratejisi de retention'a etki ediyor. Aynı anda 2'den fazla aktif event burnout yaratıyor (%29 churn increase, Liftoff 2025), ama tamamen sequential event'ler (birinin bitmesi diğerinin başlaması) oyuncuyu "event arası" boşlukta kaybediyor (%12 churn). Optimum: 1 ana event + 1 pasif/background event (örn. progression challenge + daily login streak). Ana event aktif participation gerektiriyor, background event pasif (sadece login yeterli). Bu yapı oyuncuya sürekli "aktif event var" hissi veriyor ama cognitive load düşük tutuyor.

Model-driven takvim için prediction gerekiyor: cohort X, event Y'ye nasıl tepki verecek? Bunun için historical event performance datasını cohort bazında analiz et. Örnek: D14-D30 cohort, "Boss Rush" event'inde %67 completion, "Treasure Hunt" event'inde %41. Boss Rush'ı D14'te tekrarla, Treasure Hunt'ı D30+'ya ertele. Event rotation her 4-6 haftada bir optimize edilmeli, yeni cohort davranışı eski pattern'ı değiştirebilir.

## Dynamic Difficulty ve Adaptive Content: Churn Prevention Otomasyonu

Static event content her oyuncuya aynı challenge veriyor, bu suboptimal. Dynamic difficulty event zorluğunu real-time player performance'a göre adjust ediyor. Oyuncu ilk 3 level'ı 10 dakikada geçtiyse sonraki level zorluğu %15 artıyor, 30 dakika sürdüyse %10 düşüyor. Bu yaklaşım "flow state" sağlıyor: oyuncu sürekli kendine uygun challenge ile karşılaşıyor, ne çok kolay (sıkıcı) ne çok zor (frustrating).

Adaptive content daha ileri seviye: sadece zorluk değil, content type'ı da değiştiriyor. Oyuncunun play style analiz ediliyor (PvE odaklı mı, resource grinding seviyor mu, hızlı completion peşinde mi), buna göre event objective'i adjust ediliyor. Örnek: grinder player için "10k resource topla" objective, speedrunner player için "3 level'ı 15 dakikada bitir". Aynı event, farklı success criteria. Zynga'nın 2024 test datasına göre adaptive objective'li event'ler %22 yüksek completion rate sağlıyor.

Dynamic difficulty implementation için minimum viable system: event level completion time track et, median time'a göre next level difficulty adjust et (±%10 range), 3 level sonra difficulty lock et (çok sık değişim confusing). Advanced sistem: skill-based matchmaking benzeri algoritma — oyuncuyu skill tier'ına göre kategorize et (beginner/intermediate/advanced), her tier için ayrı difficulty curve. Tier assignment ilk 5 level performance'a göre yapılmalı, sonrasında sabit kalmalı (event ortasında tier değişimi oyuncuyu şaşırtıyor).

Adaptive content dikkat noktası: fairness perception. Oyuncular farklı challenge gördüklerini anlarsa "unfair" diyebilir. Bu yüzden reward parity sağlanmalı: zor challenge alan oyuncu daha fazla reward almamalı, aynı effort için aynı reward (effort oyuncunun skill level'ına göre relatif). Leaderboard kullanıyorsan tier-based leaderboard kur: her tier kendi içinde yarışıyor, farklı tier'lar mix olmuyor.

## Operasyonel Verimlilik: Live Ops Calendar Aracı Değil Sistemdir

Live ops calendar Google Sheet'te manuel yönetiliyorsa scaling sorun yaratıyor. 10+ event rotation, 5+ cohort segment, dynamic adjustment — bu complexity spreadsheet'i kaldırmıyor. Minimum viable live ops stack: event scheduler (cohort-based triggering), analytics pipeline (real-time completion/churn tracking), A/B testing framework (event variant testing). Bu 3 component olmadan retention engineering yapılamaz.

Event scheduler cohort kurallarını trigger olarak almalı: "D7 AND level 15 AND first_login_timestamp > 24h ago" gibi. Manuel event activation yerine rule-based activation. Analytics pipeline event performance'ı real-time göstermeli: completion rate by cohort, churn rate during event, IAP conversion by event phase. Dashboard her sabah bakmak için değil, anomaly detection için: completion %20 düşükse alert, immediate adjustment. A/B testing event variant'ları test etmek için: aynı cohort'a A/B event ver, 48 saat sonra winning variant'ı %100 traffic'e aç.

Tooling'i internalize etmek mi yoksa 3rd party kullanmak mı? Tier-1 studio (MAU 10M+) için custom stack mantıklı, kontrol tam sende. Smaller studio için [App Store Optimization](https://www.roibase.com.tr/tr/aso) ve acquisition side'da kullanılan 3rd party tooling gibi, live ops için de Leanplum/Braze/GameAnalytics gibi platformlar maliyet-verimli. Hybrid yaklaşım: event scheduling custom (game-specific logic), analytics 3rd party (infrastructure heavy).

Live ops team structure de operational verimlilik etkiliyor. Klasik model: designer event yaratıyor, developer implement ediyor, analyst sonuç ölçüyor. Bu sequential process slow, 2-3 hafta sürüyor. Agile model: cross-functional pod (1 designer + 1 developer + 1 analyst), event ideation'dan deployment'a kadar birlikte çalışıyor, cycle time 1 hafta. Pod structure event iteration hızını 3x artırıyor, bu da live ops calendar'ının cohort davranışına reactive olmasını sağlıyor.

Live ops calendar retention engineering disiplinine bağlandığında churn reactive bir sorun olmaktan çıkıp predictable bir değişken haline geliyor. Event cadence matematiksel, content depth katmanlı, monetization timing data-driven, cohort segmentasyonu otomatik. Bu sistem kurulduğunda D30 retention %35'ten %53'e çıkabiliyor (Roibase internal client case, 2025). Şimdi kendi live ops datasını çıkar, cohort retention curve'üne bak, event tetikleme koşullarını yeniden kur. Manuel takvim yerine model-driven sistem.