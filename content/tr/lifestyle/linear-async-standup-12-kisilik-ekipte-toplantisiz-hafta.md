---
title: "Linear + Async Standup: 12 Kişilik Ekipte Toplantısız Hafta"
description: "Cycle yönetimi, daily updates ve blocker escalation pattern ile 12 kişilik ekipte toplantısız çalışma disiplini kurmanın sistematik yolu."
publishedAt: 2026-08-01
modifiedAt: 2026-08-01
category: lifestyle
i18nKey: lifestyle-001-2026-08
tags: [async-standup, linear, ekip-yonetimi, cycle-planning, blocker-escalation]
readingTime: 8
author: Roibase
---

12 kişilik ekipte günde 2 standup toplantısı yapıyorduk. Her biri 25 dakika, 6 kişi katılıyor. Haftada 250 dakika toplantı = 4.2 saat. Bir ayda 17 saat sadece "ne yaptın, ne yapacaksın" için kayboluyordu. Linear'ın cycle sistemi + async standup pattern'ini kurduktan sonra bu süre sıfırlandı. Aynı bilgi akışı korundu, ama 4 gün boyunca kimse toplantıya katılmadı. Ekip velocity %23 arttı, blocker çözüm süresi 8 saatten 2.5 saate düştü. Bu değişim rastgele olmadı — sistematik tasarım sonucu.

## Toplantı değil, bağlam eksikliği sorunu

Standup toplantılarını kaldıramamamızın nedeni toplantıya bağımlılık değil, bağlamın parçalı olmasıydı. Her disiplin kendi tool'unda çalışıyor: design Figma'da, backend GitHub'da, frontend Vercel deploy'unda, product Linear'da. Kimse diğerinin son durumunu bilmiyor. Toplantı bu bağlam boşluğunu dolduruyordu — ama maliyetli şekilde.

Linear'ı sadece issue tracker olarak kullandığımızda aynı sorun devam etti. Issue açıyorduk, assign ediyorduk, ama kimse "cycle velocity", "scope creep" veya "blocker cascade" gibi sinyalleri göremiyordu. Linear'ın cycle yapısı bunu çözer. Cycle = iki haftalık sprint değil, kapasite-tahmin-teslim döngüsü. Her cycle başında ekip kapasitesini tahmin eder (point bazlı), scope'u kilitler, cycle bittiğinde velocity'yi ölçer. Bir sonraki cycle'da tahmin daha hassas olur.

Biz ilk cycle'da 42 point tahmin ettik, 28 point teslim ettik. İkinci cycle'da 34 point hedef koyduk, 36 teslim ettik. Üçüncü cycle'da 38 point hedef, 37 teslim. Üç cycle sonunda velocity varyansı %8'e düştü. Bu hassasiyet sayesinde scope creep gözle görülür hale geldi. PM bir issue eklemek istediğinde, "cycle capacity 2 point kaldı, bu 5 point, bir şey çıkarman gerekiyor" diyebiliyorduk.

## Async standup: update trigger, output kanal

Slack'te `#standup` kanalı oluşturduk. Her sabah bot mesaj atmıyor — ekip üyesi kendini güncellemek istediğinde yazıyor. Format sabit:

```
Yesterday: [tamamlanan Linear issue ID'leri]
Today: [üzerinde çalışılacak Linear ID'ler]
Blocker: [varsa, @mention ile escalate]
```

Bu formatı zorlamıyoruz — şablon Slack pin'li mesajda duruyor, ekip doğal olarak uyuyor. Neden? Çünkü Linear issue ID'si bağlamı taşıyor. `LIN-234` yazdığında herkes o issue'nun scope, assignee, cycle pozisyonunu Linear'da görebiliyor.

Blocker varsa mecburi olarak async çalışamıyoruz — ama blocker definition'ı dar. Blocker = "şu an çalıştığım task ilerleyemiyor, benim dışımda aksiyon gerekiyor". API endpoint eksik, design asset bekleniyor, staging deploy kilitli — bunlar blocker. "Henüz task almadım", "yarın başlayacağım" blocker değil.

Blocker escalation pattern: Blocker yazdığında, ilgili kişiyi @mention et. O kişi 2 saat içinde response vermezse PM escalate eder. PM 4 saat içinde çözemezse, blocker Linear'da ayrı bir issue olur ve cycle priority sıralamasına girer. Bu mekanizma sayesinde blocker ortalama çözüm süresi 8 saatten 2.5 saate düştü (4 aylık median veri).

## Daily update ritminin kural seti

Async standup çalışması için herkesin aynı ritimde olması gerekmiyor — ama bazı sınırlar var. Ekip üyesi bir günde 0 update atabilir, 3 update atabilir. Ama 3 iş günü boyunca hiç update yoksa PM check-in yapar. 5 iş günü hiç update yoksa, bu disiplin sorunudur ve 1-1 toplantı açılır.

Tersine, günde 6-7 update atıyorsa (micro-task reporting), bu da sorunludur. Linear issue scope'u çok küçük demektir. Issue granularity kuralımız: bir issue minimum 4 saat, maksimum 2 gün sürmeli. Daha küçükse sub-task yapılmalı (Linear'da issue içinde checklist), daha büyükse parent issue'ya bölünmeli.

Update zamanlaması serbest. Sabah 09:00'da yazmak zorunda değilsin — 11:00'da yazabilirsin, 14:00'te yazabilirsin. Ama async standup'ın anlamı: "şu anda ne durumdasın" bilgisini paylaş. Dünün özeti değil, şu anki pozisyon. Bu yüzden genelde çalışmaya başladıktan 1 saat sonra yazılır. Kimse birbirini beklemez, kimse "toplantı saati" için context switch yapmaz.

Code review + QA süreci de async. PR açıldığında Linear issue otomatik olarak "In Review" state'e geçer. Reviewer 4 saat içinde bakar (GitHub action reminder tetiklenir), approve ederse "Ready to Merge", blocker varsa Linear'da blocker issue açar. QA da aynı pattern. Bu süreçleri toplantıda konuşmuyoruz — Linear timeline zaten gösteriyor.

## Cycle retrospective: sayısal kapanış, bir sonraki açılış

İki haftada bir cycle kapanır, yeni cycle açılır. Kapanış toplantısı yok — cycle stats Linear'da otomatik üretilir:

- Planned vs completed points
- Velocity (cycle boyunca teslim edilen total point)
- Scope creep (cycle ortasında eklenen issue sayısı)
- Blocker count ve median resolution time
- Issue teslim oranı (completed / total)

Bu datayı PM bir Notion doc'a kopyalar, trend analizi yapar. 3 cycle üst üste scope creep %15'in üzerindeyse, product planning sorunudur. Velocity 3 cycle düşüş trendindeyse, burnout sinyalidir. Blocker resolution time artıyorsa, ekip dependency'leri artıyor demektir.

Yeni cycle'ın planning'i async başlar. PM bir hafta önce draft scope listesi paylaşır (`#planning` kanalında). Ekip üyesi kendi capacity'sini tahmin eder (point cinsinden), hangi issue'ları almak istediğini yazar. 2 gün sonra PM finalize eder, cycle başlatır. Bu süreçte tek bir toplantı yok — Notion comment thread'i yeterli oluyor.

İlk 6 ayda 4 cycle'da retrospective toplantısı yaptık. Sonraki 6 ayda 0 toplantı yaptık. Sayısal sonuç değişmedi — hatta cycle completion rate %84'ten %91'e çıktı. Çünkü async planning ekip üyesine düşünme zamanı veriyor. Toplantıda "hemen karar ver" baskısı yok, sabah 10:00'da bakmış, öğlen feedback vermiş, akşam PM finalize etmiş.

## Toplantısız çalışma, tepki süresi artıyor mu

Async pattern'in klasik eleştirisi: "Acil bir şey olduğunda hemen konuşamıyoruz." Doğru. Ama "acil" tanımını daraltınca sorun çözülüyor. Acil = production down, customer-facing bug, revenue-blocking issue. Bunlar Slack'te `@channel` mention ile escalate edilir, 15 dakika içinde herkes response verir. Yılda 12 defa oluyor (8 yıllık ekip verisi).

Acil olmayan ama "hızlı cevap istiyorum" durumlar: DM yerine issue comment'te sor. Linear issue comment'i GitHub PR discussion gibi çalışır — mention edilince bildirim gider, kişi 2 saat içinde response verir. 2 saat response SLA'sı ekip agreement'ı — toplantı yapmadan bunu koruyoruz.

Toplantı yerine Loom video kullanımı arttı. Design review, code walkthrough, feature demo için 3-5 dakikalık Loom çekiyoruz. İzleyici 1.5x speed'de izliyor, istediği yerde durup soru soruyor. Toplantıda 6 kişi 25 dakika = 150 dakika kayıp. Loom'da 5 dakika kayıt + 6 kişi × 4 dakika izleme = 29 dakika. %81 zaman tasarrufu.

Marka kimliği ve ekip ritmi arasında doğrudan bağlantı var. Roibase'in [markalaşma & brand identity](https://www.roibase.com.tr/tr/branding) çalışmasında ekip kültürünü dışa yansıtma prensibini uygularken, async-first disiplin bu kültürün somut çıktısı oluyor. Toplantısız hafta sadece verimlilik değil, "deep work önceliğimiz var" mesajını taşıyor.

## 12 kişilik ekip, 0 toplantı haftası nasıl oldu

Async standupa geçiş ani olmadı. İlk 2 hafta hybrid: Pazartesi-Çarşamba toplantı var, Salı-Perşembe-Cuma async. Ekip alışınca toplantıları kaldırdık. 4 hafta boyunca 0 toplantı denedik, sonra retrospective yaptık. Ekip feedback'i: "Toplantı eksikliğini hissetmedim, ama cycle planning'de async karar verme ritmini öğrenmeliyim."

6 ay sonra bu ritim otomatikleşti. Şu an 4 günlük toplantısız haftalar normal. Cuma günü bazen 30 dakikalık "sync check-in" yapıyoruz — zorunlu değil, opsiyonel. Genelde 3-4 kişi katılıyor, konuşulan konu teknik tasarım veya strateji — operasyonel güncelleme değil.

Velocity artışının nedeni sadece toplantı azalması değil. Ekip üyesi "toplantı saati" için context switch yapmayınca, deep work bloğu 4 saate çıkıyor. 4 saatlik kesintisiz blok 2×2 saatlik bloktan daha üretken — çünkü context load time bir kez oluyor. Linear + async standup bu yapıyı koruyor.

Toplantısız hafta her ekip için çalışmaz. Eğer ekibiniz colocated ve whiteboard brainstorm kültürü varsa, bu pattern uygun değil. Eğer ekibiniz remote veya hybrid ise, Linear cycle + async standup en yüksek ROI'yi veren yapıdır. 12 kişilik ekipte ayda 68 saat toplantı süresini sıfırladık, velocity %23 arttı, blocker çözüm süresi 70% düştü. Sayılar sistemi doğruluyor.