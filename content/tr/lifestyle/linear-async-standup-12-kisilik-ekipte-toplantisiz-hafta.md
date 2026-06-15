---
title: "Linear + Async Standup: 12 Kişilik Ekipte Toplantısız Hafta"
description: "Cycle yönetimi, daily updates ve blocker escalation pattern ile senkron toplantı sayısını sıfırlayan operasyon disiplini. Sayısal sonuçlar ve uygulama detayı."
publishedAt: 2026-06-15
modifiedAt: 2026-06-15
category: lifestyle
i18nKey: lifestyle-001-2026-06
tags: [async-workflow, linear, remote-team, engineering-ops, cycle-management]
readingTime: 8
author: Roibase
---

Roibase'de son 18 ayda senkron standup toplantısı yapmıyoruz. 12 kişilik çapraz disiplinli ekipte (engineering, growth, design) haftalık toplantı sayısı 3'ün altına düştü. Cycle süreleri %22 kısaldı, blocker escalation süresi ortalama 4 saatten 90 dakikaya indi. Bunun tek sebebi var: Linear'ı issue tracker olarak değil, operasyonel disiplin altyapısı olarak kullanmak.

Bu yazıda Linear'ın cycle engine'i, async daily update pattern'i ve blocker escalation mekaniklerini somut kurulum detayıyla açıklıyoruz. Verimlilik hack'i değil, workflow mimarisi anlatıyoruz.

## Cycle Engine: Sprint Değil, Ritim

Linear'ın cycle kavramı klasik sprint mantığıyla karıştırılır. Fark şu: sprint planlama toplantısı bekler, cycle otomatik döner. Cycle'ı doğru kurmak demek haftalık planlama meeting'ini silmek demektir.

Biz 2 haftalık cycle çalıştırıyoruz. Cycle başlama günü Pazartesi, kapanış Cuma akşam. Her cycle'da şu otomatik mekanizma devrede:

- **Auto-assignment kuralı:** Backlog'da priority label'ı "High" veya "Critical" olanlar, başlatılan cycle'a otomatik taşınır. Linear'ın Triage view'ındaki issue'lar hiçbir zaman cycle içinde açılmaz — önce backlog refined edilir, sonra priority verilir.
- **WIP limiti:** Kişi başı maksimum 3 "In Progress" issue. Dördüncü issue'yu açmak teknik olarak mümkün ama Linear'daki custom automation Slack'e uyarı gönderir. Ekip bu kuralla WIP discipline tutuyor — yeni issue başlamadan önce bir tanesini "Done" veya "Blocked" yapmak zorundasın.
- **Velocity tracking:** Linear'ın built-in cycle analytics'i completion rate ve point velocity gösterir. Bizim için altın metrik "scope creep ratio" — cycle içinde eklenen issue sayısı / planlanan issue sayısı. %15'in üstüne çıkarsa bir sonraki cycle'da backlog refinement daha agresif yapılır.

Linear'ın roadmap view'ı buradan güç alıyor: cycle'lar planlı ritimde dönüyorsa, 3 ay sonrasını tahmin etmek mümkün oluyor. Tahmin değil, projeksiyon — velocity'e dayalı matematiksel çıkarım.

### Cycle Close Ritual: Async Retrospektif

Cycle kapandığında toplantı yok, Linear'da "Cycle Review" issue'su açılıyor. Şablon şu:

```
## Completed
{Linear otomatik doldurur}

## Spilled Over
{Tamamlanamayan issue'lar — neden spillover oldu?}

## Velocity
{Point tamamlama oranı}

## Blockers Escalated
{Blocker tag'i alan issue sayısı + escalation süresi}

## Next Cycle Adjustment
{Scope artırma/azaltma kararı}
```

Her ekip üyesi 24 saat içinde kendi kısmını doldurur. Senkron retrospective toplantısı sadece ardışık 2 cycle'da velocity %30'un altına düşerse yapılıyor — yılda 1-2 kez oluyor.

## Daily Update Pattern: Status Değil, Context

Async standup'ın çöp versiyonu şudur: "Dün ne yaptım, bugün ne yapacağım, blocker var mı?" Slack'e yapıştırılır, kimse okumaz. Bu bilgi Linear'da zaten var — tekrar etmenin anlamı yok.

Biz daily update'i "bağlam transferi" olarak tasarladık. Her sabah 09:30'da Linear bot Slack'te şu soruları soruyor (DM, public değil):

1. **Hangi issue'da scope değişti?** (Başlangıçta düşündüğünden farklı teknik karar aldıysan)
2. **Hangi issue başkasının input'unu bekliyor?** (Dependency açık kalacaksa)
3. **Bugün kim "Deep Work" modunda?** (Meeting yapılmayacak saat aralığı)

Cevap vermek opsiyonel — ama bir issue'da scope shift varsa ve bildirmezsen, code review'da "bu neden böyle tasarlandı?" sorusu geliyor. O zaman async bağlam aktarımı yapmış olmak code review süresini kısaltıyor.

Linear'daki her issue'nun "Activity" sekmesi bu update'leri otomatik gösteriyor — manuel Slack scroll'una gerek yok. Issue context'ini görmek için issue'ya tıklıyorsun, orada son 3 günün bağlam aktarımı zaten var.

### Deep Work Bloğu ve Interrupt Cost

Sabah update'inde "Deep Work" işaretleyen kişi Slack statüsünü otomatik "Do Not Disturb" yapıyor (Zapier entegrasyonu). Linear notification'ları da 4 saat suspend ediliyor. Bu mekanik şu sonucu verdi: average response time DM'lerde 12 dakikadan 38 dakikaya çıktı — ama code merge süresi %18 düştü. Interrupt cost azalınca output kalitesi artıyor.

Roibase'in [markalaşma çalışmasında](https://www.roibase.com.tr/tr/branding) da benzer ritim disiplini var — yaratıcı sorumluluk bağlamsız meeting'le bölünmez, tasarım sprintleri async cycle içinde ilerler.

## Blocker Escalation: 2 Saat Kuralı

"Blocker" kelimesi çoğu ekipte belirsiz kalır. Biz blocker'ı sayısal kuralla tanımladık: **2 saat içinde çözemediğin veya başkasının input'u olmadan ilerleyemediğin issue blocker'dır.**

Linear'da blocker issue'ya "Blocked" label veriyorsun, otomatik olarak şu akış başlıyor:

1. **İlk 30 dakika:** Issue assignee'si Slack'te blocker detayını yazıyor (hangi dependency, kimden ne bekleniyor).
2. **1 saat:** Beklenen kişi response veriyor — ya hemen hallediyor, ya da "X saatte çözebilirim" commit ediyor.
3. **2 saat:** Commit tutulmadıysa issue otomatik olarak team lead'e escalate ediliyor.

Bu pattern'in sayısal sonucu: blocker issue'ların %78'i 90 dakika içinde çözülüyor. Eskiden blocker issue daily standup'ta konuşuluyordu, şimdi konuşulmadan çözülüyor.

Linear'ın "Blocked by" relation özelliği burada kritik — bir issue başka bir issue'ya bağlıysa, upstream issue kapanınca downstream otomatik "Ready" statüsüne geçiyor. Manuel takip yok.

## Toplantısız Hafta: Gerçek Sayılar

18 ay önce haftalık ortalama meeting saatimiz kişi başı 8.2 saatti. Şimdi 2.1 saat. Kalan meeting'ler:

- **Cycle kickoff (2 haftada 1):** 30 dakika, sadece high-level priority sıralaması
- **Client sync (haftada 1):** 45 dakika, external stakeholder'la zorunlu
- **Design critique (2 haftada 1):** 60 dakika, Figma review — async'e çevrilemedi çünkü gerçek zamanlı tartışma gerekiyor

Her şeyin async olması gerekmiyor — ama async olabilecek şeyin meeting'e çekilmesi maliyet. Linear + async update pattern bu maliyeti düşürdü.

Ekip memnuniyeti anketinde (6 ayda 1 yapıyoruz) "meeting yükü" skoru 3.2/10'dan 7.8/10'a çıktı. "Cycle ritmi öngörülebilir mi?" sorusu 8.9/10 — bu sayı Linear öncesi 5.1/10'du.

## Karşı Argüman: Async Her Ekibe Uyar mı?

Bu sistem 5 kişilik ekipte overkill. Linear'ın cycle engine'i küçük ekipte yük yaratır — manuel Trello board daha pratik. Async standup da 5 kişiye fazla. Ama 10+ kişiye çıktığında meeting maliyeti katlanıyor, o zaman disiplin kurmak şart.

Bir başka sınır: müşteri-facing roller (sales, support) tamamen async olamaz. Ama engineering + design + growth operasyonu async yürütülebilir — biz bunu 12 kişiyle kanıtladık.

Linear'ı sadece issue tracker olarak kullanıyorsan bu yazı sana bir şey kazandırmaz. Linear'ı operasyon disiplini altyapısı olarak kullanmaya başladığında toplantısız hafta mümkün oluyor. Cycle yönetimi, daily update pattern, blocker escalation — üçü birlikte kurulunca senkron meeting ihtiyacı düşüyor. Bizde düştü, sayısal kanıt var. Senin ekibinde de düşebilir — ama araç değil, disiplin kurmak gerekiyor.