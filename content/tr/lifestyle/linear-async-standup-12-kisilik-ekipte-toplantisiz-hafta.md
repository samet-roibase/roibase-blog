---
title: "Linear + Async Standup: 12 Kişilik Ekipte Toplantısız Hafta"
description: "Cycle yönetimi, daily updates ve blocker escalation pattern ile ekip koordinasyonunu senkron toplantılardan kurtarma disiplini."
publishedAt: 2026-05-08
modifiedAt: 2026-05-08
category: lifestyle
i18nKey: lifestyle-001-2026-05
tags: [async-first, linear, ekip-yonetimi, cycle-planning, blocker-escalation]
readingTime: 8
author: Roibase
---

Ekip büyüdükçe toplantı sayısı katlanarak artar. 3 kişilik bir takımda haftada 2 standup makul görünür; 12 kişiye ulaştığında herkesin takvimi mor renkli bloklarla dolar ve kimse 2 saatlik kesintisiz çalışma penceresi bulamaz. Çözüm büyümeyi durdurmak değil, ekip koordinasyonunu async yapıya taşımaktır. Roibase'de 2023 sonundan beri 12 kişilik ürün ekibini — engineering, design, product — toplantısız haftalarda yönetiyoruz. Araç Linear, metot cycle-based planning + async daily update disiplini.

## Cycle Planlaması: İki Haftalık Bloklar, Net Kapsam

Linear'daki cycle yapısı sprint'e benzer ama fark kritik: her cycle bir delivery kapsamı tanımlar ve issue scope dışına çıkmaz. 2 haftalık döngüler kullanıyoruz. Cycle başlamadan 3 gün önce product lead tüm issue'ları refine eder, priority label'ı (P0/P1/P2) ve estimate (point bazlı değil, S/M/L sizing) atar. P0 = blocker, cycle bitmeden teslim edilmeli; P1 = hedef, P2 = nice-to-have ama cycle içinde zamanımız olursa.

Planning meeting yok. Cycle açılışı asenkron: Slack'te dedicated #cycle-kickoff kanalına cycle başlığı, scope özeti ve hedef delivery tarihini yazıyoruz. Ekip 24 saat içinde tüm issue'ları okur, Linear'da assign eder (self-assign disiplini), belirsiz kalan teknik detayları comment thread'de sorar. Product lead günde 1 kere Linear'ı tarar, cevap verir, scope conflict varsa yeniden önceliklendirir. Bu süreç toplam 2-3 saatlik zaman alır ama hiçbir 12 kişilik meeting yok.

Scope değişikliği cycle ortasında yapılabilir mi? Evet ama Linear'da issue status'ü manuel olarak "Backlog" → "Todo" çekildikten sonra. Otomatik scope creep yok. Bu disiplin sayesinde cycle başı hedef 18 issue, bitiş 19 issue olurken 14'ü P0/P1 tamamlanmış — velocity %78. Toplantıya 12 saat harcamadan.

## Daily Update: Status Report Değil, Progress Signal

Async ekipte daily standup yerine her gün 09:00-10:00 arası herkes kendi Linear profile'ında "What I shipped yesterday / What I'm doing today / Blockers" formatında comment yazar. Ama biz bunu daha da basitleştirdik: Linear'da issue'ya direkt progress comment atıyoruz. Örneğin "Checkout flow — API integration %60 complete, test yazıyorum, blocker yok" veya "Design system — Figma component tamamlandı, dev handoff'a hazır".

Bu sistem status report değil, progress signal. Okuyan kişi durumu öğrenmiyor, sinyali alıyor: yeşil = ilerleme var, kırmızı = blocker var. Blocker varsa comment'in ilk satırına 🔴 emoji + "BLOCKER:" prefix koyuyoruz. Product lead ve tech lead bu emoji'yi 30 dakikada bir Linear'da aratıyor (saved search), varsa 1 saat içinde müdahale ediyor.

Async daily update'in kritik avantajı: herkes kendi bağlamında yazıyor. Developer sabah 09:00'da değil, öğleden önce kod yazarken context switch yapmadan issue'ya not düşüyor. Designer akşam 18:00'de Figma'yı kapatırken progress yazıyor. Ortalama completion time (issue açılışından kapanışa) 3.2 güne düştü — senkron standup döneminde 4.8 gündü. Sebep: blocker escalation pattern hızlandı.

### Blocker Escalation: 4 Saatlik Eşik

Blocker detection için katı kural: bir issue 4 saat boyunca progress göstermiyorsa, sahibi otomatik olarak Linear'da blocker label ekler ve ilgili kişiyi mention eder. Örneğin backend developer API response bekliyorsa → frontend lead'i mention eder, frontend lead 2 saat içinde cevap verir veya async thread açar. Bu süreç Slack'e taşınmaz, tüm iletişim Linear issue thread'inde kalır — context kaybolmaz.

4 saat eşiği arbitrary değil: Roibase'in 2024 Q1 verisi, blocker'ın 4 saatte escalate edilmemesi durumunda ortalama 1.3 günlük gecikme yaratıyor. 4 saatte escalate edilirse gecikme 0.4 güne düşüyor. Bu disciplini korumak için Linear webhook + custom script: issue 4 saat boyunca status change görmezse otomatik Slack DM gidiyor sahibine ("Issue X statik — blocker var mı?"). Manuel takip yok, otomasyon disiplini zorlıyor.

## Toplantısızlık İstisnası: Haftalık Design Critique

Tamamen async sistem mümkün mü? Hayır. Bir istisna var: haftalık design critique. 12 kişilik ekipten sadece designer'lar + product lead katılır (5-6 kişi), 45 dakika, Figma screen share. Senkron toplantı neden gerekli? Tasarım iterasyonu async yapılabilir ama tasarım kararı kolektif yargı gerektirir — "bu buton mı yoksa link mi olsun" sorusunu Linear comment'te tartışmak 3 gün sürer, canlı tartışmak 8 dakika. Kritik fark: tasarım critique'de decision maker tek kişi (product lead), consensus aranmıyor, input toplanıyor.

Bu toplantıda bile async disiplin var: toplantı öncesi tüm design mockup'ları Figma'ya yüklenir, Linear issue linkine eklenir, katılımcılar 1 gün önce bakar, comment bırakır. Toplantıda sadece conflict çözülür veya critical decision alınır. Ortalama 45 dakikalık meeting'de 12-15 tasarım kararı alınır, hepsi Linear issue'ya kaydedilir. Toplantı bittikten 2 saat sonra designer decision'ları Figma'ya uygular, dev handoff başlar.

## Async Kültür: Sayısal Feedback Loop

Async disiplinin kendini koruması için metrik gerekiyor. Roibase'de her cycle sonunda Linear'dan çekilen metrikler:

| Metrik | Hedef | Gerçek (Q1 2026) |
|--------|-------|------------------|
| Cycle velocity (P0+P1 completion rate) | >75% | 78% |
| Average issue age (açılıştan kapanışa) | <4 gün | 3.2 gün |
| Blocker escalation time (blocker label → resolve) | <6 saat | 4.7 saat |
| Context switch count (1 günde kaç issue'ya dokunuldu) | <3 | 2.4 |

Context switch metriği kritik: async çalışmanın amacı deep work, ama 1 kişi günde 6 issue'ya dokunuyorsa async da olsa parçalanmış çalışma var. 2.4 ortalama sağlıklı — sabah 1 issue, öğleden sonra 1 issue, akşam review.

Bu metrikler haftalık Slack #metrics kanalına otomatik post ediliyor (Linear API + Zapier), ekip herkes kendi performansını kıyaslıyor. Feedback loop sayısal olunca async disiplin kültüre dönüşüyor. Yeni işe giren developer 2. haftada "neden Linear comment yazmıyorsun?" sorusunu peer'ından duyuyor — manager'dan değil. Bu kültürel baskı, toplantısızlığın garantisi.

## Founder Perspective: Zaman Değil, Bağlam Ekonomisi

Async ekip yönetiminin ROI'si saat cinsinden hesaplanmaz. 12 kişilik ekip haftada 2 toplantı yapmazsa 24 saat kazandık diye düşünmek yanıltıcı. Asıl kazanç: bağlam anahtarlama maliyetini sıfırlamak. Senkron standup'ta herkes aynı anda context switch yapar, toplantı sonrası 15-20 dakika eski context'e dönmek için harcanır. Async update'te herkes kendi akışında yazdığı için context loss yok.

Roibase'in [brand identity](https://www.roibase.com.tr/tr/branding) çalışmalarında da bu disiplini kullanıyoruz: müşteri feedback'i Linear'da issue olarak açılır, designer async cevap verir, revizyon iterasyonu toplantısız döner. Müşteri meeting sayısı %60 azaldı, delivery hızı arttı. Çünkü tasarımcı sabah 10:00'da toplantıya girip flow'dan çıkmak yerine, öğleden sonra 3 saatlik design session'ını koruyabiliyor.

Async disiplinin kritik tradeoff'u: spontane karar alma yavaşlar. Acil bir architectural decision gerekirse, Linear comment thread 4 saat sürer, Zoom 15 dakika. Bu kabul edilebilir — çünkü her karar acil değil. Haftada 1-2 acil karar için senkron meeting yapmak, haftada 10 rutin toplantı yapmaktan daha verimli.

Linear + async standup disiplini operational overhead azaltmaz, kaydırır: meeting organize etmek yerine Linear hygiene (issue tagging, priority update, blocker flagging) yapmak gerekiyor. Ama bu iş tek kişinin (product lead) 30 dakikalık daily rutin'i, 12 kişinin 1 saatlik meeting'i değil. Sistem scale ediyor. 18 kişiye çıksak aynı pattern çalışır — toplantı sayısı değil, issue volume artar.