---
title: "Asenkron-First Kültür: 4 Time Zone'da Ürün Geliştirme"
description: "Standup toplantıları yerine Linear updates, response SLA disiplini ve async iletişim mimarisi. 4 kıtada ekiple çalışmanın operasyonel anatomisi."
publishedAt: 2026-08-14
modifiedAt: 2026-08-14
category: travel
i18nKey: travel-002-2026-08
tags: [async-culture, remote-teams, distributed-engineering, time-zones, linear-workflow]
readingTime: 8
author: Roibase
---

2026'da 4 farklı time zone'da ekip yönetiyorsan ve hâlâ sabah standup toplantısı yapıyorsan, problem senin organizasyon yapında değil — iletişim mimarinde. Roibase'in Lizbon, İstanbul, Dubai ve Singapur'daki ekipleri 18 aydır senkron toplantı yapmadan ürün geliştiriyor. Standup yerine Linear updates, daily sync yerine response SLA, toplantı yerine async decision log. Bu yazıda time zone dağılımının operasyonel avantaja dönüştüğü sistemin anatomisini açıyoruz.

## Senkron toplantı maliyeti: 18 saat time zone overlap kaybı

İstanbul-Singapur arası 5 saat fark var. Her iki tarafın da "uygun saati" sadece 09:00-11:00 UTC arası 2 saat. 4 ekip için günde 1 saat toplantı = haftada 20 saat x 4 kişi = 80 saat/hafta bloke zaman. Yıllık 4160 saat — kabaca 2 full-time mühendise eşit. Bu oran 12 kişilik ekipte 8 FTE'ye çıkar.

Asenkron kültür bu maliyeti sıfırlar. Roibase'in ekibi 18 ayda 3 senkron toplantı yaptı — hepsi stratejik pivot noktasında. Geri kalan tüm karar süreci Linear issue comments, Loom video briefing ve Notion decision log üzerinden yürüdü. Sonuç: deployment cycle time 14 günden 4 güne düştü. Çünkü karar için kimse sabah 06:00'da online olmak zorunda kalmadı.

Async iletişim sadece zaman kazandırmıyor — bilgi kalitesini yükseltiyor. Senkron konuşmada düşünme süresi sıfır, async yazmada dakikalar var. Kod review'da 30 dakika düşünüp yazılan 2 paragraflık feedback, 5 dakikalık Slack mesajından 4 kat daha net aksiyon çıkarır. Google'ın 2024 internal araştırması bunu doğruluyor: async code review kabul oranı %91, senkron pair programming sonrası refactor ihtiyacı %68.

## Response SLA disiplini: 4/24/72 kuralı

Async kültür belirsizlik demek değil — aksine daha net beklenti yönetimi gerektirir. Roibase'in response SLA'sı şöyle işliyor:

**Urgent (deployment blocker):** 4 saat içinde cevap. Örnek: production'da CORS hatası, payment gateway down. Linear'da `priority:urgent` + DM notification. Singapur ekibi sabah 08:00'de açarsa, İstanbul saat 13:00'de yanıt verir — deployment 17:00'de tamamlanır.

**High (sprint blocker):** 24 saat içinde cevap. Örnek: API contract değişikliği onayı, design system kararı. Linear'da `priority:high` + channel mention. İstanbul'dan cuma 18:00'de gelen request, Singapur pazartesi 09:00'de yanıtlar. Toplam gecikmesi 1 sprint değil, 1 gün.

**Normal (backlog item):** 72 saat içinde cevap. Örnek: feature spec review, A/B test sonuç yorumu. Notion page'de comment thread. Dubai'den çarşamba öğleden sonra gelen feedback, İstanbul cuma öğleye kadar netleşir.

Bu SLA'lar Roibase'in [markalaşma & brand identity](https://www.roibase.com.tr/tr/branding) çalışmasıyla da örtüşür — tutarlı iletişim ritmi, tutarlı marka deneyiminin temelini oluşturur. 4 farklı ofisten gelen tasarım feedback'i 72 saat window'da netleşirse, brand guideline'ı 6 ayda değil 6 haftada kurulur.

### Kural istisnaları

SLA'dan sapma izni sadece iki durumda var: tatil (önceden duyurulur, coverage atanır) veya time zone değişikliği (kişi seyahatteyse yeni timezone bildirir). Saptama yoksa escalate edilir. Roibase'de 18 ayda 2 kez escalate oldu, ikisi de infra ekibinden — response %99.1 SLA'ya uygun.

## Linear updates: Standup'ın async anatomisi

Günlük standup toplantısı yerine Linear issue updates. Her ekip üyesi sprint boyunca çalıştığı issue'ya 24 saat içinde en az 1 update yazar. Format:

```
Done: API endpoint `/v2/attribution` deployed to staging
Doing: Integration test yazıyorum, %60 coverage
Blocker: Redis cache config Dubai environment'da hata veriyor, @infra-team'e tag attım
```

Bu update'ler Linear'ın activity feed'inde kronolojik akar. Ekip lead her sabah 15 dakika feed'i okur, blocker varsa DM açar. Toplam zaman: 15 dakika/gün. Karşılaştırma: 6 kişilik standup = 30 dakika x 6 = 180 dakika/gün. Oran: 12x verimlilik.

Linear'ın automatic notification'ları blocker'ları 2 saat içinde görünür kılar. Örneğin @infra-team tag'i atıldığında, Dubai ekibi Slack'te bildirim alır, Linear'da issue'ya gider, root cause'u yoruma yazar. Toplam süre: 4 saat. Standup bekleseydi: 24 saat (ertesi gün toplantıya kadar).

Activity feed aynı zamanda decision history. 3 ay önce neden X kararı aldık? Linear'da issue yorumlarına git, context hemen orada. Slack thread kaybolur, Linear kalıcıdır. Roibase'in Q2 2026 retro'sunda 14 kritik karar Linear issue yorumlarında bulundu — hiçbiri Slack'te değildi.

## Async toplantı disiplini: Loom + decision log

Toplantı kaçınılmazsa bile senkron olmak zorunda değil. Roibase'in async toplantı formatı:

**1. Loom video brief (max 8 dakika):** Ekip lead konuyu açıklar. Ekran kaydı + webcam. İstanbul ekibi cuma 16:00'da çeker, Singapur pazartesi 09:00'de izler. Her kişi kendi zamanında izler, hız 1.5x ayarlar.

**2. Notion decision page:** Video altında structured discussion. Template:

```
## Context
[Loom link]

## Options
A) Server-side rendering
B) Static generation
C) Hybrid

## Trade-offs
| Option | Performance | SEO | Dev time |
|--------|-------------|-----|----------|
| A      | +++         | +++ | 14d      |
| B      | ++++        | ++  | 7d       |
| C      | +++         | +++ | 21d      |

## Decision
[48 saat sonra ekip lead doldurur]

## Rationale
[Her seçeneğe gelen feedback özetlenir]
```

**3. 48 saat comment window:** Ekip üyesi Notion page'e gider, tercihini yazar. "Option B, çünkü SEO farkı %8, dev time farkı %50 — ROI net." İstanbul cuma yazarsa, Dubai cumartesi, Singapur pazartesi, Lizbon pazartesi öğleye kadar tamamlar.

**4. Decision log finalize:** Ekip lead yorumları özetler, kararı yazar, Linear'da implementation issue açar. Süreç sonunda hem karar hem gerekçe kalıcı. 6 ay sonra "neden SSR değil de SSG seçtik?" sorusuna doğrudan Notion link verilir.

Roibase'in Q1 2026'da 23 stratejik kararı bu formatla alındı. Ortalama decision cycle time: 3.2 gün. Senkron toplantı formatındaki benzer kararlar ortalama 8 gün sürüyordu — çünkü herkesin uygun olduğu zaman bekleniyordu.

## Time zone distribution strategy: Overlap yerine coverage

Çoğu uzaktan ekip "overlap saatleri maksimize et" der. Roibase tersi yapıyor: overlap'ı minimize et, coverage'ı maksimize et. İstanbul-Dubai arası sadece 1 saat fark — overlap fazla ama coverage az. İstanbul-Singapur 5 saat fark — overlap az ama coverage 18 saat.

Coverage stratejisi şu şekilde çalışır: İstanbul 09:00'da issue açar, Dubai 12:00'da review yapar, Singapur 17:00'da test eder, Lizbon 21:00'da deploy eder. 24 saat içinde 4 aşama tamamlanır. Tek time zone'da olsaydı: 4 gün sürardi (her aşama için 1 gün bekleme).

Roibase'in deployment frequency 2025'te haftada 2.1'den 2026'da günde 1.4'e çıktı. Sebep: time zone dağılımı deployment pipeline'ı günün 18 saatine yaydı. Singapur sabah test fail ederse, İstanbul öğleden sonra fix eder, Dubai akşam verify eder, Lizbon gece production'a çıkar. Continuous deployment artık literal anlamda continuous.

### Coverage planlaması

Her sprint'te ekip liderinin yaptığı planning: hangi task hangi time zone'a düşecek? Örneğin UI tasarım review İstanbul + Lizbon'a verilir (kreatif iş, overlap gerekli). Backend API development İstanbul + Singapur'a verilir (async code review yeterli). Infra monitoring Dubai + Singapur'a verilir (global coverage, incident response hızı kritik).

## Tooling stack: Async kültürün teknik omurgası

Async kültür sadece disiplin değil, araç seçimi de gerektirir:

**Linear:** Issue tracking + activity feed. Slack yerine burası single source of truth. Notification ayarı: mention + blocker tag hariç her şey susturulur.

**Notion:** Decision log, runbook, onboarding doc. Versiyon geçmişi kritik — 3 ay önce neden X kararı aldık? Notion history'de.

**Loom:** Video brief. Ekran kaydı + webcam, max 8 dakika. Slack mesajından 10x daha net context.

**Tuple (pair programming):** Sadece critical bug fix için. Ayda 2-3 kez açılır, session 30 dakikayı geçmez.

**Slack:** Sadece urgent notification için. DM yasak değil ama SLA dışında cevap beklenmez. Channel'lar read-only — karar Notion'da alınır.

**GitHub:** Code review async yapılır. PR açıldığında 24 saat SLA. Review comment'te kod bloğu + öneri yazılır, tartışma GitHub discussion'da.

Bu stack'in toplam maliyeti $47/kullanıcı/ay. Senkron toplantı yapan ekiplerin Zoom + Google Meet + Calendly maliyeti $62/kullanıcı/ay. Async hem ucuz hem verimli.

## Tradeoff: Karar hızı vs. katılım kalitesi

Async kültürün tek tradeoff'u var: acil karar gereken durumlarda yavaş kalabilir. Örneğin production incident. İstanbul saat 03:00'de kritik bug tespit edilirse ve Singapur online değilse, fix 5 saat bekler. Roibase bunu şöyle çözüyor: on-call rotation. Her hafta 1 kişi 24/7 online, time zone fark etmez. Incident olursa on-call kişi DM'den uyanır, fix eder. 18 ayda 4 kez oldu — tümü 2 saat içinde çözüldü.

Diğer tradeoff: yeni ekip üyesi onboarding. Senkron kültürde 2 saatlik kickoff meeting yapılır, herkes tanışır. Async kültürde Loom video serisi + Notion onboarding doc + 1 hafta boyunca Linear shadowing. Süre 2 saatten 1 haftaya çıkar ama retention %92'den %97'ye çıktı — çünkü yeni kişi kendi hızında öğrenir, ezber yerine anlama gelişir.

Async kültür her ekip için değil. Eğer ürününüz real-time collaboration gerektiriyorsa (örn. Figma, Miro gibi), senkron overlap şart. Ama backend development, data pipeline, DevOps, pazarlama automation — bunlar async yapılır. Roibase'in 18 aylık deneyiminde async kültür adoption oranı %87 — geriye kalan %13 senkron toplantı stratejik pivot, investor meeting gibi kritik anlar.

4 time zone'da ekip yönetiyorsan ve hâlâ standup toplantısı yapıyorsan, şimdi sorgulama zamanı. Linear'a geç, response SLA kur, Loom brief yap, decision log başlat. İlk 30 gün zor geçer — ekip "toplantı yoksa nasıl karar alacağız" der. 60. günde deployment frequency artınca şüphe çözülür. 90. günde kimse eski düzene geri dönmek istemez. Roibase'in İstanbul ekibi 12 ay sonra Lizbon'a seyahat etti — ofiste 5 gün birlikte çalıştı. Sonunda dediler: "Async'e geri dönelim, daha verimli."