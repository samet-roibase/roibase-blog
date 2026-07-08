---
title: "Linear + Async Standup: 12 Kişilik Ekipte Toplantısız Hafta"
description: "Cycle yönetimi, günlük update disiplini ve blocker escalation pattern ile 12 kişilik ekipte senkron toplantı sıfıra düştü. İşte uygulama detayları."
publishedAt: 2026-07-08
modifiedAt: 2026-07-08
category: lifestyle
i18nKey: lifestyle-001-2026-07
tags: [linear, async-standup, cycle-management, team-workflow, remote-team]
readingTime: 8
author: Roibase
---

Roibase'de ekip 12 kişiye ulaştığında her sabah düzenlenen 15 dakikalık standup toplantısı haftada 180 dakika ekip zamanı demekti. Bağlam anahtarlama maliyetini eklediğinizde gerçek kayıp 300+ dakika. 2023 Q4'te async model geçtik: Linear cycle pattern + günlük yazılı update. İki çeyrek sonra haftalık toplantı sayısı 5'ten 0'a düştü. Velocity %23 arttı, blocker resolution time 18 saatten 4 saate indi. Bu makale o geçişin teknik detaylarını veriyor.

## Linear Cycle Pattern: İki Haftalık Ritim Mühendisliği

Linear'ın cycle yapısı sprint sisteminin hafif versiyonu değil — atomik iş birimini yeniden tanımlıyor. Roibase'de her cycle 10 iş günü: Pazartesi açılış, ikinci Cuma kapanış. Cycle scope'u commit aşamasında donuyor, değişiklik yok. Bu katı çerçeve planlama kaygısını yok ediyor.

Cycle başında "Initiative" seviyesinde 3-5 ana hedef belirliyoruz. Her initiative Linear'da parent issue olarak açılıyor, altında 8-12 atomik task. Task tanımı INVEST kurallarına uyuyor: Independent, Negotiable, Valuable, Estimable, Small, Testable. Bir task 1 günde bitmiyorsa parçalanıyor. Bu granularite günlük update'leri anlamlı kılıyor — "UI tasarımı devam ediyor" yerine "checkout flow'da ödeme metodu selector tamamlandı" diyebiliyorsun.

Cycle closure kriteri: Parent issue'nun %85'i done state'te. Kalan %15 otomatik sonraki cycle'a taşınıyor. Bu tolerans buffer'ı overcommitment'ı önlüyor. 2025 H2 verisi: 11 cycle içinde 9'unda %92+ completion rate. Linear analytics'te "cycle burn-down" grafiği günlük izleniyor — trend kötüyse mid-cycle scope adjustment yapabiliyorsun.

## Async Update Protokolü: Slack Thread + Linear Comment Disiplini

Günlük update formatı standarttı: Her sabah 10:00'a kadar Slack'te `#daily-updates` kanalına thread açılıyor. Herkes kendi satırını ekliyor. Format:

```
Yesterday: [Linear #1234] Payment gateway integration — %80 done
Today: [Linear #1234] Error handling + test coverage
Blocker: Stripe webhook test mode'da 403 veriyor
```

Linear issue numarası zorunlu. Kopyala yapıştır yok — update Linear issue'nun kendisinde de comment olarak paylaşılıyor. Bu dual-write disiplini issue history'yi self-contained yapıyor. Üç ay sonra bir task'a bakıyorsun, ne olduğunu thread'e dönmeden anlıyorsun.

Blocker tanımı kritik: Başka bir ekip üyesinin input'u olmadan ilerleyemiyorsan blocker. Teknik soru varsa blocker değil — documentation veya async soru kanalına gidiyor. Blocker bildirimi 4 saat içinde assignee değişikliği veya pair session tetikliyor. 2025 Q4 verisi: 47 blocker case, ortalama resolution 3.8 saat. Eski modelde (standup'ta dile getir, daha sonra konuş) 18 saatti.

Update disiplininin sosyal maliyet yükü yok — kimse "günaydın" yazıp küçük talk yapmıyor. Thread saat 10:00'da otomatik kapanıyor (Slack workflow). 10:00'dan sonra update varsa DM üzerinden PM'e gidiyor, kural ihlali olarak loglaniyor. 6 ayda 3 ihlal = performans review item.

## Blocker Escalation Pattern: 30 Dakika — 4 Saat — 24 Saat Threshold

Blocker'ı 30 dakika içinde kendin çözemezsen Slack thread'e yazıyorsun. 4 saat içinde cevap gelmezse Linear issue'ya `urgent` label ekleniyor ve PM'e mention atılıyor. PM blocker owner'la direkt konuşuyor — asla "bir toplantı ayarlayalım" demiyor. 24 saat içinde çözülmezse cycle scope'tan çıkarılıyor, otomatik backlog'a gidiyor.

Escalation pattern ölçülebilir. Linear automation ile tracking: Her `urgent` label ekleme event'i BigQuery'e düşüyor. Weekly report'ta team-level resolution time var. Ekip ortalaması 4 saatin üstüne çıkarsa retrospective item açılıyor. Bu mekanizma sosyal baskıyı elimine ediyor — "blocker bildirmekten çekindim" senaryosu olmuyor, çünkü bildirmemek sistem tarafından cezalandırılıyor (cycle slip = herkesin metriğine yansıyor).

Retrospective kendisi de async. Cycle kapandıktan sonra 48 saat boyunca Linear'da `retro-{cycle-number}` issue'su açık tutuluyor. Herkes comment ekliyor. Thread 48 saat sonra PM tarafından özetleniyor, action item'lar yeni cycle scope'a ekleniyor. 2024-2025 boyunca 24 cycle retrospective'i — hiçbiri senkron toplantı gerektirmedi.

## Tool Integration: Linear ↔ Figma ↔ GitHub ↔ Slack

Async model tool integration olmadan çalışmıyor. Roibase setup'ı:

- **Linear ↔ GitHub:** PR description'a `Fixes LIN-1234` yazıldığında otomatik issue state değişiyor. Review approval gelince issue `in-review` state'e geçiyor. Merge sonrası otomatik `done`.
- **Linear ↔ Figma:** Design issue'larında Figma dosya URL'si mandatory field. Figma comment thread Linear activity'ye webhook ile yansıyor.
- **Linear ↔ Slack:** Her issue state değişikliği `#dev-activity` kanalına gönderiliyor. Ama notification yok — kanal sadece log amaçlı, kimse follow etmiyor.

Tool entegrasyonu "kim ne yapıyor" sorusunu ortadan kaldırıyor. Linear board ekranı gerçek zamanlı proje state'i. Roibase'deki ekip liderleri sabah kahvesinde Linear board'u açıyor, 2 dakikada hangi cycle item'ın risk altında olduğunu görüyor. Standuplar "durum update" için yapılıyordu — artık durum zaten görünür.

Senkron iletişim tamamen yok mu? Hayır. Haftada 1 kez "office hours" var: Herkes 2 saatlik slot açıyor, pair programming veya tasarım tartışması için rezerve edilebilir. Ama zorunlu değil. 2026 H1 verisi: 12 kişilik ekipte ortalama haftada 4.2 pair session. Kişi başı 20 dakika. Bu bile eski modeldeki toplantı yükünün %15'i.

## Async-First Kültürün Recruitment Etkisi

Linear + async model recruitment filtresine dönüştü. Roibase'de işe alım sürecinde "take-home task" var — candidate Linear board'a eklenip 3 gün süre veriliyor. Task: 5 alt issue'su olan bir parent issue'yu tamamla, günlük update ver, bir blocker simüle et ve escalation yap. Candidate'in yazılı iletişim kalitesi, issue tanımlama granularitesi ve zaman yönetimi bu aşamada görünüyor.

Son 18 ayda 8 kişi işe alındı. Hepsi async model test aşamasından geçti. 2 candidate process'te elendi — günlük update disiplini tutturamadı. Bu filtreleme kötü bir şey değil: Roibase gibi [markalaşma](https://www.roibase.com.tr/tr/branding) değerlerini açıkça paylaşan ekiplerde kültürel uyum operasyonel başarının %60'ını oluşturuyor. Async-first model ekip sesini netleştiriyor, belirsiz beklentileri ortadan kaldırıyor.

Async kültür retention'ı da etkiliyor. Çalışma saati esnekliği gerçek: Ekip üyeleri sabah 06:00 veya akşam 22:00 çalışabiliyor, günlük update disiplini tutturuldukça sorun yok. Roibase'deki ortalama tenure 3.4 yıl — Türkiye tech ekipleri ortalaması 1.8 yıl. Async model bunda doğrudan rol oynuyor.

## Cycle Metrics: Neyi Ölçüyorsun, Ona Dönüşürsün

Linear board sadece task tracker değil — ekip performansının dashboarding arayüzü. Roibase'de cycle sonunda 4 metrik review ediliyor:

1. **Completion rate:** Done state issue sayısı / toplam issue. Hedef %85+.
2. **Cycle variance:** Planlanan scope'tan çıkarılan issue sayısı. Hedef <3.
3. **Blocker count & resolution time:** Urgent label sayısı + ortalama çözüm süresi. Hedef <5 blocker, <4 saat.
4. **Update compliance:** 10:00 deadline'ını kaçıran update sayısı. Hedef 0.

Bu metrikler ekip retrospective'ine gidiyor. Bireysel performans değerlendirmesi için kullanılmıyor — amaç sistem tasarımını optimize etmek. Örneğin 2025 Q3'te blocker resolution time 6 saate çıktı. Root cause: PM pair session slotlarını azaltmıştı. Düzeltme: PM office hours haftada 3 saate çıkarıldı, resolution time 3.5 saate düştü.

Metrik yönlü kültür ekip güvenini artırıyor. "Neden toplantısız çalışıyoruz?" sorusu sayılarla cevap buluyor: Velocity artışı, blocker hızı, completion consistency. Async model subjektif bir tercih değil, ölçülebilir operasyonel avantaj.

---

Roibase'de async model bugün norm. Yeni ekip üyesi onboarding'de ilk gün Linear cycle pattern'ini öğreniyor, üçüncü gün kendi daily update'ini yazıyor. Altıncı ayda retrospective thread'inde "eski ekipte günde 3 saat toplantıdaydım" yazanlar oluyor. Linear + async standup başlangıçta araç seçimi gibi görünüyor — sonra ekip disiplininin omurgası oluyor. 12 kişilik ekip toplantısız hafta sürdürüyorsa, ölçek büyüdükçe model daha da kritik hale geliyor.