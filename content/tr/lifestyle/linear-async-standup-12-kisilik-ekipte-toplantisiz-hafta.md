---
title: "Linear + Async Standup: 12 Kişilik Ekipte Toplantısız Hafta"
description: "Cycle yönetimi, daily updates ve blocker escalation ile async-first ekip koordinasyonu. Raporlaşma yok, operasyon var."
publishedAt: 2026-06-03
modifiedAt: 2026-06-03
category: lifestyle
i18nKey: lifestyle-001-2026-06
tags: [async-work, linear, ekip-koordinasyonu, cycle-management, remote-work]
readingTime: 8
author: Roibase
---

Senkron toplantı çağrısı gelen her bildirim, ekip üyesinin 23 dakikalık derinleşme sürecini kesiyor (UC Irvine araştırması, 2023). 12 kişilik bir ekipte günlük standup 40 dakika alıyorsa, haftada 240 dakika × 12 kişi = 2880 dakika (48 saat) kayıp demektir. Async-first çalışma kültürü bu kaybı ortadan kaldırmıyor — yerine ölçülebilir, tracelenebilir bir raporlama sistemine dönüştürüyor. Linear'ın cycle yönetimi ve async daily update disiplini, ekip koordinasyonunu toplantıdan operasyona geçiriyor. Bu yazı, Roibase'in 8 yıllık ekip liderliği deneyiminden çıkan somut workflow'u anlatıyor.

## Cycle Disiplini: Fibonacci Noktalama ve Haftalık Ritim

Linear'da her cycle 1 hafta sürüyor. Sprint değil — cycle. Sprint terim olarak "son gün sprint" algısı yaratıyor, cycle ise ritimsel tekrar anlamına geliyor. Her pazartesi sabahı yeni cycle başlıyor, cuma akşamı cycle review post'u yayınlanıyor. Cycle içinde issue'lar 3 durumdan birinde: Backlog, In Progress, Done.

Fibonacci point sistemi kullanıyoruz: 1, 2, 3, 5, 8. 1 point = 2 saatten az iş, 8 point = 1 günlük iş. 13 point ve üstü issue kabul edilmiyor — parçalanması zorunlu. Bu disiplin, tahmin değil — empirik geçmiş veriye dayanıyor. Linear'ın "Cycle Analytics" paneli, ekibin ortalama velocity'sini gösteriyor (Roibase ekibinde haftada ~42 point tamamlanıyor).

Her cycle başında 3 sütun dolduruyoruz:

| Sütun | İçerik | Sorumlu |
|-------|--------|---------|
| Priority | Müşteri blocker, revenue-impacting bug, deadline'ı olan feature | Product Lead |
| Next Up | Priority tamamlanırsa geçilecek issue'lar | Engineering Lead |
| Icebox | Cycle'a sığmayacak ama önümüzdeki 2 cycle'da ele alınacak | Team |

Priority sütunu cycle ortasında değişmiyor — bu kuralı bozan talep, bir sonraki cycle'a gidiyor. İstisna: P0 bug (production down, payment fail gibi). Bu disiplin, "acil" kelimesinin enflasyonunu önlüyor.

### Async Daily Update: Text-First Raporlama

Slack'te `#daily-updates` kanalı var. Her ekip üyesi, sabah işe başladığında 3 satırlık bir mesaj yazıyor:

```
Yesterday: Implemented Stripe webhook retry logic (LIN-482, 5pt) — merged
Today: Fixing flaky Cypress test on checkout flow (LIN-490, 3pt)
Blocker: Need design approval on new onboarding modal (CC @DesignLead)
```

Bu format sabit — serbest yazı kabul edilmiyor. Linear issue ID zorunlu (LIN-xxx), point estimate zorunlu. "Blocker" satırı yoksa yazma — ekip üyesi engellenmediyse bildirmesine gerek yok.

Daily update 09:00-10:30 arası atılmalı (zaman dilimi farkı varsa yerel sabah). Geç atılırsa hatırlatma botu devreye giriyor (Linear webhook + Slack automation). Bu disiplin, "kim ne yapıyor" sorusunu ortadan kaldırıyor — sorulmadan önce cevap paylaşılmış oluyor.

## Blocker Escalation Pattern: 4 Saatlik Kural

Bir ekip üyesi 4 saatten uzun süre aynı issue'da takılıyorsa — manual müdahale gerekiyor. Linear'da issue'ya `blocked` label'ı ekleniyor, Slack'te ilgili kişi tag ediliyor:

```
LIN-490 blocked — Cypress test environment'ta DB seed edemiyor.
@DevOpsLead: CI pipeline'da seed script çalışmıyor mu?
```

Bu mesaj `#daily-updates` kanalına değil, `#blockers` kanalına atılıyor. Blocker kanalında mesajın altına thread açılıyor, çözüm orada tartışılıyor. Çözüm bulununca Linear issue'da comment yazılıyor: "Blocker çözüldü — seed script .env dosyasını görmüyormuş, Docker Compose'a eklendi."

4 saatlik kural, "solo hero çalışma" kültürünü kırıyor. Roibase ekibinde blocker escalation ortalaması cycle başına 2.3 issue — bu sayı düşükse ekip yeterince risk alınmıyor demektir (kolay işler seçiliyor), yüksekse scope karmaşıklığı arttırılmalı.

### Code Review İçin Async Bekleme Süresi

Pull request (PR) açıldığında, Linear issue'ya otomatik link ekleniyor (GitHub integration). PR açıldıktan sonra ekip üyesi beklemeye geçmiyor — öncelik sırasındaki bir sonraki issue'ya başlıyor. Review SLA: 8 saat içinde en az 1 kişi bakmalı.

Review kuralları:

- PR 400 satırdan uzunsa, parçalanması isteniyor (review kalitesi düşüyor)
- Test coverage %80'in altındaysa auto-reject (CI check)
- Approval 2 kişiden gelmeli (lead + 1 peer)

Review sırasında senkron tartışma YASAK. Reviewer comment yazıyor, author cevap yazıyor — thread kapanana kadar merge edilmiyor. Bu disiplin, "Zoom'da konuşalım mı?" tuzağını ortadan kaldırıyor.

## Friday Cycle Review: Sayısal Retrospective

Her cuma 16:00'da Linear'ın "Cycle Completion Report" çalışıyor. Bu otomasyon, Slack'e şu veriyi atıyor:

```
Cycle 2026-W22 Summary:
Completed: 38 points (target: 42)
Carryover: 2 issues (LIN-495, LIN-501)
Blocker count: 3
Average cycle time: 2.1 days
```

Carryover 2'den fazlaysa, ekip üyesi bir sonraki cycle'da priority sütununda önceliklendirme yapıyor. 3'ten fazla carryover varsa — scope planning hatası var demektir, cycle capacity azaltılmalı.

Cycle review post'u Notion'da yayınlanıyor. Bu post toplantı değil — text-based dokümandır. İçerik:

1. **Completed work:** Her issue'nun kısa özeti (1 cümle)
2. **Learnings:** Teknik debt, tooling iyileştirme fırsatları
3. **Next cycle focus:** Önümüzdeki hafta hangi alanlara ağırlık verileceği

Post yayınlandıktan sonra ekip üyesi comment yapıyor — "LIN-482'de Stripe retry logic'i production'da test edilmeli" gibi. Bu feedback, bir sonraki cycle'ın planning'ine giriyor.

### Carryover Pattern ve Scope Disiplini

Carryover issue'lar 2 nedenden biri için oluyor:

1. **Underestimate:** 5 point tahmin edilen iş 8 point çıktı
2. **External blocker:** Tasarım approval beklemek gibi ekip dışı bağımlılık

İlk durumda, issue'nun point'i retrospective olarak güncelleniyor (Linear'da "Actual Effort" field'ı). Bu veri, gelecek tahminleri kalibre ediyor. İkinci durumda, issue Priority sütununa geçiyor — çünkü blocker çözüldüğünde hızlı kapanması gerekiyor.

Carryover 3 cycle üst üste tekrarlanıyorsa, ekip capacity'si düşük demektir. Roibase'de bu durumda 2 haftalık "cooldown cycle" uyguluyoruz: yeni feature almıyoruz, sadece technical debt temizliyoruz (test flake'leri, deprecated dependency'ler, dokümantasyon boşlukları).

## Toplantısız Hafta: İstisnai Senkron Durumlar

Async-first demek toplantı yok demek değil — zorunlu toplantıları minimize etmek demek. Roibase'de haftada sadece 1 senkron toplantı var: **Bi-weekly Planning** (2 haftada bir, 60 dakika). Bu toplantıda ekip 4 haftalık roadmap'i tartışıyor — Linear'daki "Projects" view'ü üzerinden.

Senkron toplantı gerektirecek durumlar:

- Mimari karar (örn. monolith'ten microservices'e geçiş)
- Müşteri alignment (agency context'inde [Markalaşma & Brand Identity](https://www.roibase.com.tr/tr/branding) çalışması gibi cross-functional projeler)
- Conflict resolution (code review'da consensus sağlanamayan durum)

Bu durumlar cycle başına ortalama 0.4 kere çıkıyor — yani her 2.5 cycle'da bir. Toplantı 30 dakika üst limitle yapılıyor, agenda önceden Notion'da paylaşılıyor, karar notuyla bitiyor.

## Async Disiplini Operasyon Haline Getirmek

Async çalışma kültürü "esnek" değil — sert disiplin gerektirir. Roibase'de bu disiplinin 3 temel ayağı:

1. **Text-first communication:** Slack voice message yok, Loom video yok (istisna: onboarding)
2. **Response SLA:** Blocker mesajına 2 saat içinde cevap, normal mesaja 8 saat içinde
3. **Time zone respect:** Ekip üyesi yerel akşam 19:00'dan sonra mesaj atıyorsa, notification'ı kapatmalı (Slack scheduled send)

Bu yapı çalışıyor çünkü her ekip üyesi kendi derin çalışma saatini koruyabiliyor. Linear'ın "Focus Time" özelliği, ekip üyelerinin calendar'ında 4 saatlik kesintisiz blok yaratıyor — bu süre boyunca notification yok, Slack kapalı, sadece kod yazma veya design iterasyonu.

Async-first ekip koordinasyonu, toplantı sayısını azaltmak değil — kararın kalitesini artırmak için ritim yaratmaktır. Cycle disiplini, daily update disiplini, blocker escalation pattern birleşince, ekip üyeleri "kim ne yapıyor" sorusunu sormadan önce cevabı alıyor. Bu yapı, 12 kişilik ekipte haftada 48 saatlik toplantı süresini 1 saate indiriyor. Kalan 47 saat, deep work'e gidiyor.