---
title: "Asenkron-First Kültür: 4 Time Zone'da Ürün Geliştirme"
description: "Standup yerine Linear updates, response SLA ve async toplantı disiplini ile 4 farklı zaman diliminde ürün geliştirme operasyonu nasıl kurulur?"
publishedAt: 2026-05-10
modifiedAt: 2026-05-10
category: travel
i18nKey: travel-002-2026-05
tags: [async-culture, remote-work, distributed-teams, product-development, time-zones]
readingTime: 8
author: Roibase
---

Geleneksel ofis kültürü senkron iletişim üzerine kurulu: 09:00 standup, öğlen arası chat, 16:00 planlama. Ancak ekip İstanbul, Lizbon, Dubai ve Bangkok'a dağıldığında bu sistem çöker. 4 saat fark varsa "herkesin uygun olduğu zaman" hiçbir zaman demektir. Roibase'de 2024'ten beri 4 farklı time zone'da çalışırken öğrendiğimiz şey şu: senkron iletişim lüks değil, asenkron disiplin zorunluluk. Bu yazı o disiplinin operasyonel detaylarını açıyor.

## Standup'ın Ölümü ve Linear Updates

Günlük standup toplantıları 15 dakikadır. 4 kişilik bir ekipte haftada 5 gün yapılırsa toplamda 60 dakika. Ancak gerçek maliyet farklı: herkes toplantı saatine göre günü böler, kalan zaman fragmanlara parçalanır. Deep work dediğimiz 3-4 saatlik kesintisiz blok yok olur.

Asenkron-first yaklaşımda standup yerine Linear'da (ya da benzeri issue tracker'da) günlük update zorunludur. Sabah 09:00-10:00 arası herkes kendi time zone'unda şu formatta yazar:

```
Yesterday: PR #234 merged (auth flow), API latency 12ms'den 8ms'e indi
Today: Cache invalidation senaryolarını test edeceğim
Blocker: Redis cluster config için ops onayı bekliyorum
```

Bu format 3 dakika yazılır, 2 dakika okunur. Toplantı maliyeti sıfır. Blocker varsa ilgili kişi tag'lenir ve kendi saatinde cevap verir. 2025 Q4 verilerine göre ekibimizde standup kaldırıldıktan sonra ortalama PR merge süresi 18 saatten 14 saate düştü — çünkü review'lar time zone rotasyonu içinde async olarak yapıldı.

### Response SLA: Hangi Mesaj Ne Kadar Sürede Cevap İster

Asenkron kültürde her iletişim türünün beklenti süresi farklıdır. Bunu netleştirmezsek ekip ya sürekli notification'a koşar ya da kritik mesajı kaçırır. Roibase'de kullandığımız SLA tablosu:

| Kanal | SLA | Örnek |
|---|---|---|
| Slack DM (critical tag) | 2 saat | Production down, payment fail |
| Linear blocker comment | 4 saat | Auth flow test edilemiyor |
| Code review request | 8 saat | PR ready, 1 approval kaldı |
| Slack channel message | 24 saat | Genel soru, feature fikri |
| Email | 48 saat | Dokümantasyon, administrative |

Bu SLA'lar yazılı ve onboarding'de öğretilir. "Critical" tag sadece revenue-impacting durumlar için kullanılır — yılda ortalama 12 kez. Abartırsanız tag'in kredisi biter.

## Async Toplantı Disiplini

Toplantı yapmamak imkansız. Roadmap review, mimari tartışma, client feedback — bunlar için görüşmek gerekir. Ancak 4 time zone'da toplantı yapmak 3 kuralı gerektirir:

**1. Pre-read zorunlu:** Toplantı 48 saat önceden Notion'da duyurulur. Gündem, arka plan context, tartışılacak seçenekler orada yazılı. Toplantıya pre-read okumadan katılan kişi sessiz kalır — zamanını boşa harcamış sayılır.

**2. Karar yetkisi net:** "Tartışacağız" toplantısı yasak. Toplantıda hangi kararın alınacağı, kimin nihai yetkiye sahip olduğu önceden belli. İstanbul'daki product lead decision maker ise Lizbon ekibi input verir ama oylamaya gitmez. Bu hiyerarşi belirsizliği çözer.

**3. Recording + summary:** Toplantı kaydedilir ve Grain (ya da benzeri araç) ile otomatik özetlenir. Katılamayanlar 15 dakika içinde özeti okur, varsa itirazlarını async olarak yazar. Toplantıda anlaşma sağlanmışsa 24 saat içinde itiraz yoksa karar kesinleşir.

2025'te yaptığımız analiz: haftada 8 saat toplantı yerine 3 saat async-optimized toplantı ile aynı karar kalitesini elde ettik. Artık toplantı yapmak isteyenin burden of proof'u var — "neden async çözemiyoruz?" sorusunu cevaplamak zorunda.

### Time Zone Rotasyonu ve "Unfair Hours"

4 time zone'da toplantı yapmak adil olamaz. İstanbul 10:00 Bangkok için 14:00, Lizbon için 08:00 demektir. Birinin sabahı, birinin öğleden sonrası. Çözüm: rotasyon.

Haftalık roadmap sync haftanın pazartesi 10:00 CET'te yapılıyorsa bir sonraki hafta 15:00 CET'te yapılır — böylece İstanbul'a uygun olan saat döngüde Lizbon'a da gelir. Hiç kimse sürekli "unfair hour"da olmaz. Bu rotasyon takvimi önceden yayınlanır — 6 haftalık döngü şeffaftır.

## Dokümantasyon Obsesyonu

Asenkron kültürde tribal knowledge ölümcüldür. Bir kişi biliyorsa ve o anda uyuyorsa ekip durur. Çözüm: her şeyin yazılı olması.

Roibase'de her feature'ın Notion'da bir RFC (Request for Comments) dokümanı var. RFC şablonu:

```
## Problem
Kullanıcı checkout sırasında kupon kodunu görmüyor

## Önerilen Çözüm
Checkout step 2'de "Promo Code" input alanı eklenecek

## Alternatifler
1. Sidebar'a persistent kupon widget
2. Cart sayfasında kupon bölümü

## Technical Impact
- Frontend: 2 gün (React component + test)
- Backend: 1 gün (promo validation API)
- Risk: Kupon stack olursa discount logic bozulabilir

## Decision
Önerilen çözüm onaylandı. Start: 2026-05-12
```

RFC yazılmadan kod başlamaz. Bu disiplin yavaşlatır gibi görünür ama uzun vadede hız kazandırır — 3 ay sonra "neden böyle yaptık?" sorusuna cevap dokümanda var.

### Code Review Async Stratejisi

Code review 4 time zone'da en kritik süreç. PR açılır, reviewer uyuyordur, 8 saat sonra bakar, değişiklik ister, o zaman PR sahibi uyuyordur. Ping-pong süreci uzar.

Çözüm: **batch review**. PR'lar sabah 09:00-11:00 arası açılır. Reviewer kendi time zone'unda gün içinde 2 slot ayırır: 11:00 ve 16:00. Tüm pending PR'ları bu slotlarda toplu inceler. Comment'ler detaylıdır — "bunu düzelt" yerine "line 45'teki async await sırası değişmeli çünkü race condition oluşuyor, şu şekilde yap" der. Böylece PR sahibi bir review turunda tüm feedback'i alır ve tek seferde fixler.

2025 Q4'te ortalama PR merge süresi 18 saatten 14 saate düşmesinin bir diğer sebebi bu: review ping-pong sayısı 3.2'den 1.8'e indi.

## Kültürel Direnç ve Onboarding

Asenkron kültür mühendislik problemi değil, kültürel adaptasyon problemidir. Yeni katılan kişi "neden hızlı cevap gelmedi" diye endişelenir. Ya da tersine "hemen cevap vermem gerekiyor" diye notification'a köle olur.

Onboarding'in ilk haftası sadece kültüre odaklanır. Yeni kişi:

1. Linear'da 5 gün boyunca daily update yazar (henüz kod yazmasa bile)
2. Bir RFC okur ve comment atar
3. Bir async toplantıya pre-read ile katılır
4. Response SLA tablosunu ezberler

Kod yazmadan önce ritmi öğrenir. Bu yatırım ilk hafta yavaşlatır ama 3. haftadan sonra kişi zaten autonomous çalışır — sürekli soru sormaz, cevap beklemez.

### Brand Tutarlılığı ve Async Collaboration

Dağıtık ekip çalışırken [Markalaşma & Brand Identity](https://www.roibase.com.tr/tr/branding) tutarlılığı kolay kaybedilir. İstanbul tasarımcısının hazırladığı asset Lizbon'daki developer tarafından yanlış renk paletinde kullanılabilir. Ya da client-facing dokümanda ton tutarsızlığı olur.

Async çalışan ekiplerde brand consistency için Figma component library, brand guideline dokümanı ve "design decision log" kritiktir. Her görsel değişiklik Figma'da versiyonlanır, her yeni component RFC'ye girer. Böylece herkes kendi time zone'unda çalışırken marka dili bozulmaz.

## Şimdi Ne Yapmalı

Asenkron-first kültür 4 time zone'da ürün geliştirmenin tek sürdürülebilir yoludur. Ancak bu kültür kurulmaz, öğretilir. İlk adım: response SLA'larını yazılı hale getirin. İkinci adım: bir hafta boyunca standup yapmayın, Linear update'e zorlayın. Üçüncü adım: toplantılarınızın hangisinin async olabileceğini test edin. Değişim kademeli ama zorunlu — senkron kalırsanız ya time zone'lardan birini dışlamış olursunuz ya da herkesin uykusunu çalarsınız. Asenkron disiplin kazanmak 3-4 ay sürer ama kazandığınızda 24 saat boyunca ilerleyen bir ekip elde edersiniz.