---
title: "Linear + Async Standup: 12 Kişilik Ekipte Toplantısız Hafta"
description: "Cycle yönetimi, günlük async updates ve blocker escalation pattern ile 12 kişilik ekipte senkron toplantı sayısını sıfıra indirmenin operasyonel tasarımı."
publishedAt: 2026-06-27
modifiedAt: 2026-06-27
category: lifestyle
i18nKey: lifestyle-001-2026-06
tags: [async-first, linear, ekip-yonetimi, verimlilik, cycle-planning]
readingTime: 8
author: Roibase
---

2026'da senkron toplantı miktarı ile organizasyonun olgunluğu ters orantılı. 12 kişilik bir ekipte haftada 8 saat toplantı normal sayılıyor, 15 saat standart. Roibase'de bu rakam 0-2 saat arasında. Sihir değil — Linear, async standup disiplini ve blocker escalation pattern. Bu yazı operasyonel tasarımı satır satır açıyor.

## Cycle Planlaması: İki Haftada Tek Toplantı

Linear'ın cycle yapısı sprint değil, delivery window. Roibase'de 14 günlük cycle başlamadan önce tek bir senkron toplantı yapıyoruz: cycle planning. 60 dakika, tüm ekip. Toplantıda sadece önceliklendirme ve scope netleştirme var. Tahmin yok — scope net olunca timeline de net oluyor.

Planning öncesi herkes Notion'da issue'ları okumuş durumda. Toplantıda yeni bilgi sunumu yapılmıyor. Sadece "Bu cycle'a bu 8 issue girer, şu 3'ü çıkar" kararı veriliyor. Karar sonrası Linear'da issue'lara milestone atanıyor, label'lar güncelleniyor. Bu 60 dakika dışında cycle boyunca hiçbir proje toplantısı yok.

Cycle bittiğinde retrospektif toplantısı da yapmıyoruz. Tamamlanan issue sayısı, blocker sayısı, cycle velocity Linear'da zaten görünüyor. Retrospektif yapılacaksa async Slack thread'inde yapılıyor — herkes kendi zamanında yazıyor, CEO dahil. Senkron olana mecburiyet yok.

### Delivery Velocity ve Cycle Süresi

12 kişilik ekipte ortalama cycle velocity 24-28 issue. Issue büyüklüğü S/M/L label'ıyla işaretli. Velocity düşerse bir sonraki cycle'da scope azaltılıyor, toplantı eklenmesi değil. Toplantı eklemek kısa vadede hız yanılsaması yaratır, uzun vadede bağlam anahtarlama maliyeti artırır.

## Async Standup: Daily Update Disiplini

Her sabah saat 09:30'da Slack'te otomasyon bot tetikleniyor. Ekip üyelerine 3 soru soruluyor:

```
1. Dün ne tamamladın? (Linear issue ID)
2. Bugün ne üzerinde çalışıyorsun? (Linear issue ID)
3. Blocker var mı? (varsa ID + kişi tag)
```

Yanıt süresi maksimum 10:30. Geç kalanlar dashboard'da kırmızı görünüyor. Bu disiplin iş saatinin başlangıcını netleştiriyor — remote ekipte saat 09:30 herkesin online olduğu anlamına geliyor.

Standup yanıtları async yazılıyor, okunması da async. PM sabah 11:00'de tüm yanıtları tarayıp blocker'ları önceliklendiriyor. Kimse kimseyi beklemek zorunda değil. Daily standup toplantısında 6 kişi 15 dakika bekler, bu 90 insan-dakika kayıp. Async'te herkes 2 dakikada yazıyor, 5 dakikada okuyor — toplam 7 insan-dakika. **13x verimlilik farkı.**

Standup yanıtı Linear issue ID içermeli. "Bug düzelttim" değil, "LIN-342 düzelttim" yazılıyor. Bu sayede PM Slack'ten doğrudan Linear'a gidip issue durumunu görebiliyor. Context switching yok.

## Blocker Escalation Pattern

Blocker async standup'ta bildirildiğinde PM ya da lead developer 30 dakika içinde yanıt veriyor. Yanıt 3 türden biri:

| Durum | Aksiyon | Timeline |
|---|---|---|
| Hızlı fix | Lead developer çözer | 2 saat |
| Scope değişimi | PM cycle scope'u revize eder | 4 saat |
| Ekip dışı bağımlılık | CEO/CTO'ya escalate | 8 saat |

Blocker 8 saatten uzun sürerse senkron toplantı açılabilir. Ama bu yılda 2-3 kere oluyor. Çoğu blocker async çözülüyor. Senkron toplantı exception, kural değil.

Blocker escalation pattern Linear'da automation rule olarak kurulu. Issue'ya `blocker` label'ı eklendiğinde otomatik olarak PM ve lead developer'a notify ediliyor. Notify Slack'te, yanıt da Slack'te. Linear yorumu Slack thread'ine sync ediliyor. İki tool arasında context copying yok.

### Blocker Metriği

Cycle başına ortalama blocker sayısı: 3-4. Bu normaldir. Blocker varsa sorun yok, çözüm süresi önemli. Ortalama blocker çözüm süresi 4 saat. 8 saati geçen blocker sayısı yılda 6-8. Bu rakamlar Linear dashboard'da canlı. Toplantı yapıp metrik paylaşmaya gerek yok — herkes kendi dashboard'ında görüyor.

## Async-First Kültürün Maliyeti

Async-first operasyon bedava değil. İlk 3 ayda ekip alışana kadar verimlilik %15-20 düşüyor. Async disiplin öğreniliyor — yazılı iletişim, Linear issue description standartları, blocker bildirme formatı. Eğitim süreci var.

İkinci maliyet psychological safety eksikliği riski. Senkron toplantıda yüz yüze bakarak "Sorun var mı?" diye sormak async'te daha zor. Ekip üyesi blocker bildirmekten çekinebilir. Bunu önlemek için her cycle sonunda 1-on-1 yapıyoruz — bu senkron, 30 dakika. Yılda 26 cycle × 30 dakika = 13 saat. Hâlâ haftada 8 saat toplantıdan çok düşük.

Üçüncü maliyet tool dependency. Linear veya Slack çökerse operasyon duruyor. Ama bu risk geleneksel ekipte de var — mail sunucusu çökse aynı etki. Async-first ekip single point of failure yaratmıyor, zaten var olan riski görünür kılıyor.

## Liderlik Rolü: Yazılı İletişim Standardı

CEO veya founder async ekipte farklı rol üstleniyor. Senkron toplantıda karar verme yetkisi konuşma hızıyla birleşir, en hızlı konuşan kazanır. Async'te en net yazan kazanır. Bu adil değil demek kolay ama operasyon açısından daha verimli. Yazılı karar tartışılabilir, arşivlenebilir, referans edilebilir.

Roibase'de founder her cycle planning'de tek sayfa yazılı brief hazırlıyor. Brief öncelik sıralaması, tradeoff açıklaması, blocker beklentisi içeriyor. Ekip bu brief'i okuyup Linear issue'ları önceliklendiriyor. Toplantıda "Bu neden önemli?" sorusu sorulmuyor çünkü cevap zaten yazılı. [Markalaşma & Brand Identity](https://www.roibase.com.tr/tr/branding) sürecinde de aynı disiplin geçerli — brand tone of voice yazılı şekilde tanımlanıyor, ekip async okuyor, senkron tartışma gerekmiyor.

Liderlik async-first kültürde daha görünür. Senkron toplantıda kötü karar 5 dakikada unutulur. Slack thread'indeki kötü karar kalıcı. Bu accountability artırıyor.

## Şimdi Ne Yapmalı

Ekibini async-first'e geçirmek istiyorsan önce tool stack'i kur: Linear, Slack, async standup bot. İlk ay hybrid çalış — haftada 2 toplantı devam ettir, async disiplini paralel başlat. İkinci ayda toplantı sayısını yarıya indir. Üçüncü ayda sadece cycle planning kalır.

Async disiplinin ilk 3 ayı zor. Ekip direniyor çünkü senkron toplantı güvenlik hissi veriyor. Ama metrik izlersen async'in kazandırdığı zamanı göreceksin. 12 kişilik ekipte haftada 8 saat toplantı = yılda 4992 insan-saat kayıp. Async'le bu rakam 1500'e iniyor. 3500 saat pure execution kazancı. Bunu görmezden gelemezsin.