---
title: "Creative Operations: Bidding Algoritmasına Beslenecek Variation Stratejisi"
description: "Performance Max ve Advantage+ kampanyalarında kreatif test mimarisi: AI'ya doğru sinyali vermek için structured variation yaklaşımı."
publishedAt: 2026-08-01
modifiedAt: 2026-08-01
category: marketing
i18nKey: marketing-005-2026-08
tags: [creative-operations, performance-max, meta-advantage-plus, creative-testing, bidding-optimization]
readingTime: 8
author: Roibase
---

Google Performance Max ve Meta Advantage+ kampanyalarının bidding algoritmaları, kreatif varyasyonları öğrenme materyali olarak kullanır. Ancak çoğu marka "algoritmaya 50 kreatif ver, en iyisini seçsin" mantığıyla hareket eder — sonuç: dağınık sinyal, belirsiz kazanan, yavaş öğrenme. 2026'da AI-driven kampanyalar için asıl sorun budget değil, algoritmanın kullanabileceği **structured signal architecture**.

Bu yazı, kreatif varyasyon stratejisini bidding algoritmasının öğrenme mekanizmasına göre kurgulamanın teknik çerçevesini açıyor. Amacımız creative brainstorming değil — creative operations.

## Bidding Algoritması Kreatifi Nasıl Kullanıyor

Performance Max ve Advantage+ kampanyalarında bidding algoritması her impression'da şu hesabı yapar: "Bu kullanıcıya bu kreatifte gösterirsem dönüşüm olasılığı nedir?" Tahmin modeli, **kreatif ID'sini feature olarak** öğrenir. Ancak kreatif çok benzerse (aynı görsel, farklı headline), algoritmaya ayrı feature olarak değil noise olarak gelir. Çok farklıysa (tamamen farklı konsept), öğrenme segmente bölünür ve her varyasyon az impression alır.

Sorun basit: **kreatif varyasyon stratejisi, algoritmanın öğrenme kapasitesiyle uyumlu değil**.

Meta'nın Advantage+ Shopping kampanyalarında creative fatigue metriği ("frequency vs. conversion rate decay") bunu açıkça gösterir. Bir kreatif 3-5 gün içinde CTR'sini %40-60 kaybedebilir, ancak algoritma yeni varyasyonu test etmek için yeterli impression toplamadan rotasyona geçerse, bidding modeli "hangisi daha iyi" sorusunu yanıtlayamaz. Sonuç: sürekli exploration, düşük exploitation, yüksek CPA.

Google'ın Performance Max asset group yapısı da aynı sorunu yaşıyor. Bir asset group'a 15 görsel, 5 video, 10 headline verirseniz, algoritma kombinasyon sayısını artırır ama her kombinasyonun yeterli impression alması haftalar alır. Google'ın kendi dokümanında "asset group başına 3-5 farklı mesaj konsepti" önerisi bu yüzden — daha fazlası öğrenme hızını düşürür.

## Structured Variation: Dimension Bazlı Test Mimarisi

Kreatif varyasyonu rastgele çoğaltmak yerine, **hangi boyutun (dimension) algoritma için ayrı sinyal olduğunu** belirlemek gerekir. Roibase'in [Performans Pazarlaması (PPC)](https://www.roibase.com.tr/tr/ppc) çalışmalarında uyguladığımız yaklaşım şu:

| Dimension | Algoritma İçin Sinyal Değeri | Test Hızı |
|---|---|---|
| Görsel konsept (farklı ürün, scene) | Yüksek — ayrı feature | Orta (3-7 gün) |
| Headline mesajı (pain point vs. benefit) | Yüksek — semantic farklılık | Hızlı (1-3 gün) |
| CTA button rengi | Düşük — minor UI detay | Çok hızlı (<1 gün) |
| Video uzunluğu (6s vs. 15s) | Orta — format farklılığı | Orta (3-5 gün) |
| Marka logosu varlığı | Düşük — brand recall için önemli ama bidding'e az etki | Yavaş (7+ gün) |

Bu tablo şunu söylüyor: **eğer boyut algoritmanın conversion prediction'ını değiştirmiyorsa, o boyutu varyasyon olarak test etmek bidding performansına katkı vermez**. CTA button rengini 5 versiyonda test etmek yerine, 2 farklı headline mesajı test etmek algoritmanın öğrenmesini hızlandırır.

### İki Aşamalı Test Protokolü

1. **Initial launch (Week 1-2):** Asset group başına maksimum 3 görsel konsept × 2 headline yaklaşımı = 6 kombinasyon. Budget split eşit değil — algoritma kendi dağıtır.
2. **Iteration (Week 3+):** Kazanan konsepti al, onun üzerinde format varyasyonu (video uzunluğu, aspect ratio) test et.

Bu yaklaşım, algoritmanın exploration-exploitation tradeoff'unu optimize eder. İlk 2 haftada "hangi mesaj çalışıyor" sorusunu yanıtlar, sonraki dönemde "o mesajı hangi formatta vermeli" sorusuna geçer.

## Meta Advantage+ için Creative Fatigue Rotation

Meta'nın algoritması, bir kreatifin CTR düşüşünü tespit edince yeni varyasyona geçmek yerine **eski varyasyonu farklı audience segment'ine göstermeyi** dener. Bu durumda kreatif henüz tükenmemiştir — sadece ilk gösterildiği segment'te tükenmiştir. Ancak algoritma yeni varyasyon yoksa bu rotation'ı yapamaz.

Bunu engellemek için **rolling creative refresh** stratejisi kullanıyoruz:

```
Hafta 1: Creative A, B aktif
Hafta 2: Creative B, C aktif (A pause)
Hafta 3: Creative C, D aktif (B pause)
Hafta 4: Creative D, A aktif (C pause, A yeniden canlanır)
```

Bu döngüde her kreatif 1 hafta aktif, 2 hafta pause kalır. Pause sırasında algoritma o kreatifi "unutmaz" ama tekrar aktif olduğunda audience freshness yüksektir. Meta'nın kendi testinde bu yaklaşım, sürekli yeni kreatif eklemekten %18 daha iyi CPA verdi (Meta Blueprint, Q2 2026 case study).

## Google Performance Max için Asset Group Segmentasyonu

Performance Max'te tek asset group'a tüm varyasyonları yığmak yerine, **user intent bazlı segmentasyon** yapıyoruz:

- **Asset Group 1 (High-Intent):** Branded search, retargeting audience. Kreatif: fiyat, stok, hızlı teslimat vurgulu.
- **Asset Group 2 (Cold Audience):** Discovery, YouTube placement. Kreatif: problem-solution storytelling, uzun video.
- **Asset Group 3 (Consideration):** Search genişletme, Gmail. Kreatif: karşılaştırma, özellik detayı.

Her grup kendi içinde 3-4 varyasyon taşır. Algoritma asset group'lar arasında budget optimize eder ama **grup içindeki varyasyonları aynı intent segment'inde test eder** — bu da öğrenme hızını artırır.

Google'ın Insights sayfası, asset group bazında "best performing asset combination" gösterir. Ancak bu metrik yanıltıcı olabilir — eğer bir asset group düşük impression alıyorsa, "en iyi kombinasyon" yeterli test görmemiştir. Bizim kuralımız: bir kombinasyon en az 1000 impression + 30 conversion görmeden "kazanan" ilan edilmez.

## Incrementality Test ile Creative Strategy Validasyonu

Kreatif varyasyon stratejisinin işe yaradığını anlamak için **conversion artışı değil, incremental lift** bakıyoruz. Holdout-based geo test veya conversion lift study (Meta, Google) ile şunu ölçüyoruz: "yeni kreatif stratejisi olmasa da bu dönüşümler olur muydu?"

Örnek senaryo: Bir e-ticaret markası için creative ops değişikliği sonrası ROAS %25 arttı. Ancak geo test gösterdi ki incrementality sadece %8 — geri kalan %17 artış, organik büyüme veya sezonsal taleple açıklanıyor. Bu durumda kreatif stratejisi "çalıştı" ama katkısı sanıldığından düşük.

Incrementality testi kreatif stratejisi için şart — çünkü bidding algoritması **correlation öğrenir, causation değil**. Eğer yeni kreatif ile beraber fiyat indirimi de yaptıysanız, algoritma kreatifte kazandığını söyler ama asıl etken fiyat olabilir.

## Şimdi Ne Yapmalı

Creative operations, "güzel görsel üret" işi değil — bidding algoritmasına doğru sinyali besleyecek test mimarisini kurmak. Performance Max veya Advantage+ kullanıyorsanız, kreatif sayısını değil **kreatif dimension'larının algoritma öğrenmesine katkısını** optimize edin. İlk 2 haftada konsept testini bitirin, sonra format iterasyonuna geçin. Incrementality test olmadan "bu kreatif kazandı" demeyin — çünkü algoritma korelasyonu lift olarak gösterebilir.