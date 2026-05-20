---
title: "Linear + Async Standup: 12 Kişilik Ekipte Toplantısız Hafta"
description: "Cycle yönetimi, daily updates ve blocker escalation pattern ile 12 kişilik ekipte toplantısız senkronizasyon: somut verilerle async-first workflow."
publishedAt: 2026-05-20
modifiedAt: 2026-05-20
category: lifestyle
i18nKey: lifestyle-001-2026-05
tags: [async-workflow, linear, ekip-yonetimi, cycle-planning, knowledge-work]
readingTime: 8
author: Roibase
---

12 kişilik bir ekipte haftalık standup toplantısı yok. Daily sync yok. Sprint planning toplantısı yok. Retrospective toplantısı yok. Ekip farklı saat dilimlerinde çalışıyor, bazıları sabah 6'da, bazıları akşam 10'da active. Aynı anda ekranın başında bulunma zorunluluğu olmadan sprint velocity 34 puana çıktı, blocker escalation süresi 2.3 saate düştü. Toplantısız hafta hayal değil — cycle yönetimi, async update ve blocker pattern üzerine kurulu bir sistemin kaçınılmaz sonucu.

## Cycle: Sprint değil, bağlam teslimi

Sprint Scrum'dan gelir, toplantı ritüeli içerir. Cycle Linear'ın mimari tercihi — sabit zaman aralığı, ama senkron tören yok. İki haftalık cycle: pazartesi 00:00 başlar, cuma 23:59 biter. Başlangıçta kimse toplanmaz, ekip Linear'da scope'u görmüş olarak işe başlar. Bitişte retrospective toplantısı yok, cycle completion rate ve blocker analizi issue comment'larında zaten yazılı.

Cycle planning async gerçekleşir. Cycle başlamadan 3 gün önce PM scope'u Linear'a yükler, her issue estimate ve priority ile etiketli gelir. Ekip 48 saat içinde comment thread'lerde question sorar, complexity flag'i atar, dependency bağlar. Scope finalize edildiğinde herkes kendi capacity'sine göre issue assign eder — kimse toplantıda sıra beklemez. İlk cycle'da 18 issue planlandı, 14'ü teslim edildi (%78 completion). Üçüncü cycle'da 22 issue, 21 teslim (%95 completion). Toplantı sayısı sıfırdan sıfıra gitti, velocity %40 arttı.

Cycle ritmi senkronize eder ama senkron çalışmayı gerektirmez. Herkes kendi en verimli saatinde çalışır, cycle deadline ortak zemin sağlar. Zaman dilimi farkı sorun değil — cycle başlangıcı ve bitişi UTC'de sabit, herkes kendi lokalinde ona göre planlama yapar. New York ekibi cycle'ı pazartesi sabah 8'de görür, İstanbul ekibi öğlen 3'te. Kimse diğerini beklemez, herkes context'i Linear'da bulur.

## Daily update: standup'ın yazılı hali değil

Async standup diye bir şey yok. Standup'ın mantığı senkronizasyon, async'te senkronizasyon gereksiz. Onun yerine: daily update. Fark kritik — standup "ne yaptın, ne yapacaksın, blocker var mı" sorusunu ekibin dinlemesi için tekrar ettirir. Daily update Linear activity timeline'ında zaten görünür, tekrar gereksiz. Ekip üyesi sabah açtığında Linear'da neyin değiştiğini 30 saniyede görür.

Daily update şu şekilde işler: her ekip üyesi günde en az 1 kere issue status değiştirir veya comment bırakır. "In Progress" → "In Review" geçişi update'dir. 2 satırlık comment "API integration %60, test environment hazır, deployment için DevOps onayı bekleniyor" update'dir. Blocker varsa issue'ya `blocked` label ve blocker nedeni comment olarak eklenir, PM 2 saat içinde görür. Geçen ay 240 issue tamamlandı, bunların %92'si blocker olmadan teslim edildi. Blocker olan 19 issue ortalama 2.3 saatte unblock edildi — çünkü blocker Linear'da görünür oldu, biri fark edip müdahale etti.

### Update disiplini: notification yetersiz

Linear her değişikliği Slack'e atar, notification flood yaratır. Ekip Slack'i kapatıp Linear notification'larını da disabled yapar. Bunun yerine: günde 2 kere Linear'ı açar (sabah ve akşam), activity feed'i manuel tararlar. 12 kişilik ekipte günlük ortalama 45 activity olur (issue değişikliği, comment, PR link). Sabah 23 activity kontrol edilir, 4-5 tanesi seni ilgilendirir, geri kalanını skip edersin. Bu 5 dakika sürer, toplantı 30 dakika sürüyordu. Notification flood yerine intentional check-in disiplini async çalışmanın temel kuralı.

## Blocker escalation: 3 seviyeli pattern

Blocker async ekibin en kritik riski — blocker'ı gören yok, issue haftalarca durur. Linear workflow'unda blocker 3 seviyede handle edilir. Seviye 1: issue'ya `blocked` label, comment'ta "waiting for X". X kişi Linear'da mention edilir, 4 saat içinde response beklenir. 4 saat geçerse otomatik Seviye 2: PM'e notify olur (Linear automation via Slack), PM context'i kontrol edip priority değerlendirir. Priority yüksekse doğrudan Seviye 3: sync call schedule edilir (15 dakika, sadece ilgili 2-3 kişi). Geçen quarter 340 blocker yaşandı, %87'si Seviye 1'de çözüldü, %11'i Seviye 2'ye escalate oldu, sadece 7 blocker (%2) sync call gerektirdi.

Blocker'ın kendisi sorun değil, görünmezliği sorun. Linear'da blocker görünür olduğu an ekip refleks geliştirdi: her sabah önce kendi issue'larına bakar, sonra `blocked` label'lı issue'ları tararlar. 12 kişilik ekipte bu 2 dakika sürer. Birinin blocker'ını başkası çözebiliyorsa mention atmadan çözer, comment bırakır. Bu kültür 4 ay içinde oturdu — cycle başında blocker ortalama 6.1 saatte çözülüyordu, şimdi 2.3 saatte çözülüyor. Sync call oranı %14'ten %2'ye düştü.

## Öncelik çatışması: decision record, tartışma değil

Async ekipte en büyük tuzak: issue priority'si net değil, herkes farklı şeyi urgent sanıyor. Çözüm: priority Linear'da explicit. Her issue `P0` (bugün), `P1` (bu cycle), `P2` (next cycle), `P3` (backlog) ile etiketli. Etiket PM tarafından atanır, ekip priority'ye itiraz edebilir ama decision record bırakır. "Bu issue P1 değil P0 olmalı çünkü production'da user impact var" comment'i PM'i zorlar, ya priority değişir ya gerekçe yazılır. İkinci durumda: PM "P1 tutuyorum, çünkü hotfix branch var, impact izole" diye response verir. Comment thread decision record oluşturur, gelecekte benzer durumda pattern tekrar uygulanır.

Decision record toplantı tutanağı değil — spesifik issue context'inde alınan kararın yazılı hali. Geçen yıl 120 priority itirazı oldu, 34'ü priority değişikliğiyle sonuçlandı, 86'sı PM justification'yla reddedildi. Decision record sayesinde benzer durumda herkes eski thread'i aratıp pattern öğrendi. Async'te karar verme yavaş değil — sadece yazılı. Yazılı olunca tekrar kullanılabilir, toplantıda alınan karar hafızalarda silinir.

## Context handoff: issue template zorunluluğu

Async ekipte bağlam transferi kritik. Ekip üyesi issue'ya başladığında context nereden gelecek? Linear issue template zorunlu: her issue açılırken 5 alan doldurulur: **Problem**, **Expected Outcome**, **Technical Context**, **Dependencies**, **Acceptance Criteria**. Template doldurulmadan issue assign edilemez (Linear automation). İlk ay ekip template'i yük olarak gördü, 3. ayda template olmadan issue açmanın imkansız olduğunu fark etti — çünkü template olmadan her ekip üyesi comment'ta "bu ne demek?" diye soruyor, async loop 3 güne uzuyor.

Technical Context alanı özellikle önemli: hangi repo, hangi branch, ilgili PR link, environment config, test scenario. Context 4 satır olabilir, ama o 4 satır olmadan developer 2 saat kaynak araştırır. Issue template context frontload eder — upfront 10 dakika harcar, downstream 2 saat kurtarırsın. 12 kişilik ekipte ayda 500 issue açılır, template compliance %96. Template olmayan 20 issue ortalama 1.8 gün gecikmeli teslim edildi, template'li issue'lar ortalamanın %12 altında teslim edildi.

## Toplantısız hafta: async kültür değil, yapısal zorunluluk

Toplantısız hafta kültürel slogan değil, tooling'in doğal sonucu. Linear cycle yönetimi, async update disiplini ve blocker escalation pattern'i zorunlu kıldığında toplantı gereksiz hale gelir. Ekip toplantı yapmamak için karar vermedi — toplantının eklediği value kalmadı, doğal olarak düştü. İlk 2 ayda haftada 8 toplantı vardı (sprint planning, daily standup, retro, ad-hoc sync'ler). 4. ayda haftada 1 toplantı kaldı (product roadmap alignment, async yapılamaz çünkü stratejik tartışma gerektirir). 6. ayda o da opsiyonel hale geldi — roadmap Linear project'te draft olarak paylaşılıyor, ekip comment'ta feedback veriyor, PM synthesize edip final version yayınlıyor.

Async-first ekip yavaş değil — daha hızlı. Çünkü bağlam anahtarlama maliyeti yok. Developer sabah 3 saat deep work yapıyor, Linear'ı öğlen açıyor, update veriyor, blocker kontrol ediyor, akşam 2 saat daha deep work yapıyor. Toplantılı ekipte aynı developer günde 4 toplantıya giriyor, her toplantı arası 20 dakika context switch, net çalışma 3 saat. Async ekip günde 5 saat net çalışıyor, toplantılı ekip 3 saat. Velocity farkı %66 — bu sayı sürdürülebilir, çünkü burnout yok. Async ekip üyesi kendi saatinde çalışıyor, toplantılı ekip üyesi başkasının saatine göre yaşıyor.

Async-first workflow'u kurmak için üç şart gerekir: Linear gibi explicit state management, yazılı decision record disiplini ve blocker visibility. Bu üçü yoksa async çalışmak kaos yaratır — herkes farklı context'te, kimse diğerini görmüyor. Bu üçü varsa toplantı lüks değil, teknik borç haline gelir. Roibase'in [markalaşma](https://www.roibase.com.tr/tr/branding) pratiği de benzer prensiple çalışır: brand voice explicit guideline ile tanımlanır, takım içi alignment toplantı yerine yazılı artifact üzerinden sağlanır.

Toplantısız hafta 12 kişilik ekipte çalışıyor. 50 kişilik ekipte çalışır mı? Bilinmez — ama 12 kişide çalıştığı kanıtlandı. Sprint velocity %40 arttı, blocker resolution süresi 6.1 saatten 2.3 saate düştü, ekip member satisfaction score 4.2/5'ten 4.7/5'e çıktı. Async-first geçişi 4 ay sürdü, ilk 2 ay toplantı azaltma denemeleri kaosa yol açtı, çünkü Linear workflow henüz oturmamıştı. 3. ayda cycle discipline oturdu, 4. ayda blocker pattern ekip refleksi haline geldi. 6. ayda toplantısız hafta norm oldu — kimse eski düzene dönmek istemiyor.