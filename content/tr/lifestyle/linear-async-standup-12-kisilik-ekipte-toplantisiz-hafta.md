---
title: "Linear + Async Standup: 12 Kişilik Ekipte Toplantısız Hafta"
description: "Cycle-based sprint yönetimi, daily async updates ve blocker escalation pattern ile senkron toplantıları elimine etmek. 12 kişilik ekipte deneyimler."
publishedAt: 2026-07-20
modifiedAt: 2026-07-20
category: lifestyle
i18nKey: lifestyle-001-2026-07
tags: [linear, async-first, remote-work, sprint-management, team-culture]
readingTime: 8
author: Roibase
---

Roibase'de son 18 aydır tek bir daily standup toplantısı yapmıyoruz. 12 kişilik ekip, 3 kıtada, 5 saat zaman farkıyla çalışıyor. Linear cycle'lar, async status update'ler ve escalation protocol'ü ile haftalık sprint velocity'miz %23 arttı. Senkron toplantı yükü haftada 8 saatten 45 dakikaya düştü.

Bu yazıda Roibase'in operasyonel gerçekliğinde denediğimiz async-first ekip yapısını paylaşacağım. Linear'ın cycle yönetimi, daily update disiplini ve blocker escalation pattern'i nasıl çalışıyor, nerede tıkanıyor, hangi ekip büyüklüğünde sınıra dayanıyor — sayısal sonuçlarla.

## Cycle-Based Sprint: Linear'ın Haftalık Ritmi

Linear'da cycle kavramı klasik sprint'ten farklı. Cycle bir takvim birimi değil, commitment window'u. Roibase'de cycle uzunluğu: **5 iş günü, başlangıç Pazartesi, kapanış Cuma 17:00 İstanbul saati**. Cycle içinde "scope creep" yok — yeni issue girer ama cycle commit'ine eklenmez, backlog'a gider.

Cycle başlangıcında ekip üyeleri kendi issue'larını cycle'a assign ediyor. Lider atama yapmıyor. Bu self-commitment modeli ilk 3 cycle'da kaotikti. 4. cycle'dan itibaren ekip tahmin hatasını %40'tan %12'ye düşürdü. Neden? Her cycle sonunda retrospective verisi Linear'da durdurulmuyor, bir sonraki cycle planning'e taşınıyor. Ekip kendi hız ölçütünü kalibre ediyor.

### Cycle Planning: 30 Dakika, Async

Planning toplantısı yok. Cycle başlamadan 24 saat önce Linear'da "Next Cycle" view açılır, tüm backlog öncelik sırasına göre sıralanır. Ekip üyeleri şu formatta yorum bırakıyor:

```
@leader: Bu cycle'a X, Y, Z alıyorum (tahmini 18 story point)
Blocker risk: Y, backend API dependency var
Hedef velocity: 16-20 SP (geçen cycle 19 SP tamamladım)
```

Leader 24 saat içinde yorum thread'lerini okuyor, dependency çakışması varsa tag ediyor. Cycle başladığında herkesin commit'i netleşmiş oluyor.

## Daily Update Disiplini: Loom + Linear Comment

Klasik standup'ın sorunu: ekip üyesi bilgiyi ekstrakte etmeden önce context switch yapıyor, senkron oturmaya hazırlanıyor. Async standup'ta context switch yok, update kendi deep work akışında.

Roibase daily update formatı:

```markdown
**Daily Update — {Tarih}**
✅ Tamamlanan: [Issue #123] API auth middleware
🚧 Devam eden: [Issue #124] Redis cache layer (50% done)
🚫 Blocker: External API rate limit, {owner} ile konuşacağım
⏰ Bugün hedef: [Issue #125] başlangıç + unit test
```

Update zamanı: **saat fark etmez, ama her gün 1 kez**. İstanbul ekibi 10:00'da yazıyor, Londra ekibi 14:00'da, San Francisco ekibi 18:00'da (kendi sabahı). Update mecra: Linear issue comment (Slack'te kaybolmasın diye).

İlk 2 ayda ekip update'i "yazmayı unutuyordu". Çözüm: Linear automation — eğer 24 saat içinde ekip üyesi hiçbir issue'ya comment atmadıysa, Slack DM gidiyor. "Update yok, blocker var mı?" 3. aydan itibaren update complience %94'e çıktı.

### Loom Video: Uzun Bağlam Gerektiğinde

Eğer update'in yazılı anlatımı 3 paragrafı geçiyorsa, Loom video çekilir (max 3 dakika). Video Linear issue'ya embed edilir, transcript otomatik oluşur. Örnek: frontend refactor gibi mimari karar gerektiren durumlarda ekip üyesi ekranı göstererek kod gezintisi yapıyor.

Loom usage istatistiği: Roibase'de haftada ortalama 2-3 video, cycle başına 10-12 video. Video izlenme oranı %87 (yani ekip gerçekten izliyor, görmezden gelmiyor).

## Blocker Escalation: 4 Saat Kuralı

Async çalışmanın en büyük riski: blocker geç fark edilir, ekip üyesi 2 gün bekler. Roibase'de **4 saat kuralı** var. Ekip üyesi bir blocker'a takıldıysa:

1. **0. saat:** Issue'ya "🚫 Blocker" label ekle, comment'te detay yaz
2. **1. saat:** Dependency owner'ını tag et (örn. @backend-lead)
3. **4. saat:** Eğer cevap gelmezse, ekip liderine escalate et
4. **8. saat:** Eğer hala çözülmezse, senkron 15 dakika call planlanır

4 saat içinde blocker resolve oranı: %78. 8 saat içinde %96. Yani ekibin %96'sı async çözüyor, sadece %4'ü call'a düşüyor.

Escalation kanal: Linear issue comment yeterli, Slack DM gerek yok (çünkü herkes Linear notification'ı aktif tutuyor — bu kültürel disiplin). İlk 1 ayda ekip Slack'te soruyor, Linear'da kayıt olmuyor. 2. ayda "Slack'te soru sorma, Linear'da yaz" kuralı getirildi. Enforcement tool: Slack bot — eğer Slack thread'inde blocker keyword'ü varsa, bot "Bu soruyu Linear'a taşıyın" diyor.

## Retrospective: Sayısal Metrik, Anonim Değil

Her cycle sonunda retrospective verisi Linear dashboard'a dökülür:

| Metrik | Cycle-12 | Cycle-13 | Delta |
|--------|----------|----------|-------|
| Planlanan SP | 92 | 96 | +4 |
| Tamamlanan SP | 87 | 91 | +4 |
| Velocity accuracy | 94.6% | 94.8% | +0.2% |
| Blocker count | 8 | 5 | -3 |
| Avg blocker resolve (saat) | 5.2 | 3.8 | -1.4 |
| Senkron call (dakika) | 60 | 45 | -15 |

Retrospective toplantısı yok. Ekip üyeleri Linear'da "Retro" view'e yorum bırakıyor, 3 soru:

1. **Neyi tekrarlamalıyız?** (Örn. "API mock service çok hızlandırdı")
2. **Neyi değiştirmeliyiz?** (Örn. "Design handoff geç geldi, cycle ortasında değişiklik oldu")
3. **Hangi bağımlılık riskli?** (Örn. "External API vendor'ı 2. cycle'da da rate limit attı")

Leader yorumları toplayıp bir sonraki cycle planning'de önceliklendiriyor. Retro verisi anonim değil — ekip üyesi kendi adıyla yazıyor. İlk 2 cycle'da ekip çekinerek yazdı, 3. cycle'dan itibaren açık geri bildirim normalleşti. Neden? Çünkü geri bildirim kişiye değil sisteme dönük — "Sen yavaşsın" değil, "Bu bağımlılık tasarımı yavaşlatıyor".

### Cycle Kapatma: Hard Stop

Cycle Cuma 17:00'da kapanır. Tamamlanmayan issue otomatik bir sonraki cycle'a taşınır, **ama commit'ten çıkar**. Yani ekip üyesi "Biraz daha uzatayım" yapamaz. Bu hard stop disiplini ilk 2 cycle'da ekibi zorlasa da, 3. cycle'dan itibaren ekip tahmin doğruluğunu artırdı.

Hard stop'un psikolojik etkisi: ekip üyesi cycle sonunu görünce önceliklendirme kararı alıyor. "Şu feature yarım kalacak, onu teslim edip diğerine başlamak yerine, şu critical bug'ı kapatayım" gibi. Bu karar yetki devri — lider müdahale etmiyor.

## Asenkron Kültür: Ekip Büyüklüğü Sınırı

Roibase'de 12 kişilik ekip async çalışıyor. Bu sayı tesadüf değil — **Dunbar sayısının alt bandı** (150 kişi sosyal ilişki, 50 kişi güven çemberi, 15 kişi operasyonel senkronizasyon). 12 kişide herkes birbirinin context'ini biliyor, issue dependency manuel takip edilebiliyor.

15 kişinin üstüne çıkınca async tıkanır. Neden? Dependency grafiği karmaşıklaşıyor, blocker escalation path belirsizleşiyor. Bu durumda ekip alt takımlara (squad) bölünmeli, her squad kendi cycle'ını yönetmeli.

Roibase'de squad yapısı yok (henüz), ama 16 kişiye çıkarsak ilk aksiyon: **frontend/backend/ops** olarak 3 squad kurmak, her squad'ın kendi Linear team'i olacak. Cross-squad dependency ise "integration cycle" (2 haftada 1) ile senkronize edilecek.

## Async-First'ün Karanlık Yönü

Async çalışma her sorunu çözmüyor. İlk 3 ay ekip morale'i düştü. Neden? **Sosyal bağlılık eksikliği**. Herkes kendi ekranında çalışıyor, sohbet yok, espri yok. Çözüm: **haftada 1 kez 30 dakika "sosyal call"** — iş konuşulmaz, ekip üyeleri ne yaptığını paylaşır (hobiler, hafta sonu planları).

İkinci tıkanma: **junior ekip üyesi async'te kaybolur**. Junior'ın blocker'ı belirsiz olduğunda escalate edemiyor, "ben mi yanlış yapıyorum" diye suskun kalıyor. Çözüm: **junior'lara özel pair programming slot'u** — haftada 2x45 dakika, senior ile senkron code review. Bu slot async değil, senkron — çünkü junior'ın öğrenme hızı senkron feedback ile kat kat artıyor.

Üçüncü risk: **creative brainstorming async'te zor**. Yeni ürün feature'ı tasarlarken, Figma üzerinde async yorum yeterli değil. Ekip birbirini kesemiyor, fikir akışı yavaş. Çözüm: **stratejik konularda senkron workshop** — ayda 1 kez, 90 dakika, tüm ekip. Workshop sonucu Linear'a dökülerek async takip edilir.

## Roibase'de Dış İletişim: Async Zor

Müşteri toplantısı, pitch sunumu, user interview — bunlar async yapılamıyor (henüz). Roibase'de müşteri facing ekip (sales, account management) hala senkron çalışıyor. Ancak bu ekibin içdöngüsü async: müşteri call'undan sonra Linear'da debrief issue açılır, ekip async yorum bırakır, bir sonraki call'da action item'lar hazır olur.

Dış dünya henüz async kültüre hazır değil. Müşteri "hemen görüşelim" diyor, e-posta'ya 3 saat cevap gelmezse "neden cevap yok?" soruyor. Bu async/sync geçiş yönetimi Roibase'in en zor operasyonel noktası. Çözüm: **response time SLA** — müşteriye "24 saat içinde cevap veriyoruz" net iletiliyor. Bu beklenti yönetimi [markalaşma ve brand identity](https://www.roibase.com.tr/tr/branding) çalışmasının bir parçası: async kültürünü dışarıya net bir marka vaadi olarak konumlandırmak.

## Async Dönüşümü: İlk 90 Gün Yol Haritası

Eğer ekibiniz hala daily standup yapıyorsa ve async geçiş istiyorsanız:

**Gün 1-30:** Linear kurulumu, cycle tanımı, ekip onboarding. Henüz senkron standup'ı kesmeyin, ikisini paralel yürütün. Ekip Linear'a alışsın.

**Gün 31-60:** Daily async update başlatın, ama standup'ı azaltın (haftada 3 güne düşürün). Blocker escalation protocol'ünü test edin. Ekip update complience'ını ölçün, %80'in altındaysa Slack reminder ekleyin.

**Gün 61-90:** Standup'ı tamamen kesin. İlk 2 hafta ekip "toplantı yok, garip hissettim" diyecek — bu normal. 4. haftada ekip velocity artışını görecek, o zaman geri dönüş istemeyecek.

90 günlük dönüşüm sırasında en kritik metrik: **blocker resolve time**. Eğer 8 saatin üstüne çıkıyorsa, async tıkanıyor demektir, escalation path'i revize edin.

Roibase'in async geçişi 5 ay sürdü (hedef 90 gün, ama ilk 2 ay kültürel direnç yüzünden yavaş ilerledi). 6. ayda ekip velocity %23 arttı, en önemlisi: **deep work saati** haftada 12 saatten 28 saate çıktı. Ekip üyeleri "toplantı yok, kod yazıyorum" diye rapor etti.

Async-first ekip yapısı, senkron toplantının "zorunlu" olduğu varsayımını kırıyor. Linear'ın cycle mekanizması, daily update disiplini ve blocker escalation protocol'ü ile 12 kişilik ekip haftalık sprint'i toplantısız yürütüyor. Operasyonel veriye göre: velocity arttı, context switch azaldı, ekip deep work'e odaklandı. Ancak async her sorunu çözmüyor — sosyal bağlılık, junior mentorship ve creative brainstorming hala senkron slot gerektiriyor. Ekip büyüklüğü 15'i geçerse squad yapısına geçiş şart. Async kültür dış dünyaya net iletilmezse müşteri beklentisi yönetilemez. Linear + async standup bir araç değil, operasyonel disiplin. Disiplin yerleşmezse tool'u değiştirmek sorunu çözmüyor.