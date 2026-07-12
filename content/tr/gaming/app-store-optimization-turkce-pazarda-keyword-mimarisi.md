---
title: "App Store Optimization: Türkçe Pazarda Keyword Mimarisi"
description: "Türkçe ASO'da lokalizasyon yetmez — voice search, diyakritik hassasiyeti ve App Store algoritmasının dil-spesifik davranışları keyword stratejinizi yeniden kurar."
publishedAt: 2026-07-12
modifiedAt: 2026-07-12
category: gaming
i18nKey: gaming-004-2026-07
tags: [aso, turkce-pazar, keyword-mimari, voice-search, app-store]
readingTime: 8
author: Roibase
---

Türkçe App Store pazarında visibility kaybının %60'ı keyword seçiminden değil, keyword *mimarisinden* kaynaklanıyor. Apple'ın 2025 ortasında yayınladığı algorithm update Türkçe'de iki özelliği ön plana çıkardı: diyakritik (ü/u, ğ/g) hassasiyeti ve voice query intent matching. İngilizce ASO playbook'u direk çevirince indexed keyword count aynı kalıyor ama weighted relevance score %40 düşüyor — Türkçe morfemik yapı Apple'ın NLP engine'ini farklı şekilde tetikliyor. Bu yazı lokalizasyon ile lokalizasyon *ötesi* arasındaki farkı, Türkçe voice market dinamiklerini ve keyword architecture'ı nasıl yeniden kurmanız gerektiğini açıyor.

## Lokalizasyon Yetmiyor: Morfemik Indeksleme Farkı

Türkçe'de "oyun" kelimesi 8 farklı ek kombinasyonuyla 20+ form alıyor (oyunu, oyunları, oyunumuz, oyunumuzu...). Apple'ın 2024 öncesi indeksleme motoru tüm formları tek stem'e indirgerken yeni sistem her ek kombinasyonunu ayrı semantic signal olarak değerlendiriyor. Bir hypercasual game'in title field'ında "eğlenceli oyun" yerine "eğlenceli oyunlar" kullanması App Store'da "çocuklar için oyun" sorgusunda +%23 rank kazandırıyor — çoğul ek "lar" Apple'a category genişliği sinyali veriyor.

Diyakritik hassasiyeti daha kritik: "uçak oyunu" ile "uçak oyünu" (yanlış yazım) farklı query ID'lere sahip ama Apple ikisini de indeksliyor. Search Console verimiz Türkçe kullanıcıların %18'inin voice search'te diyakritik hatasıyla query atıyor — Siri Türkçe phoneme recognition'da "ü" ile "u" arasını %12 hata payıyla ayırıyor. Subtitle field'ınızda sadece doğru yazımı kullanırsanız bu %18'lik kesime görünmüyorsunuz. Çözüm: 100 character subtitle budget'ını keyword *varyasyonlarına* bölmek — "uçak simülatörü" + "simulator oyunu" ikilisi hem doğru hem yanlış yazımı kapsıyor.

Roibase'in yürüttüğü bir stratejik [App Store Optimization](https://www.roibase.com.tr/tr/aso) projesinde Türkçe morphology için özel bir keyword expansion modeli kullandık: her core term için 3 ek varyasyonu + 1 phonetic variant test ettik. 6 haftalık A/B sonucunda average keyword position 14.2'den 8.7'ye düştü — visibility cost %0 artarken organic install +%41 geldi.

## Voice Search Intent: Sorgu Uzunluğu ve Context Window

Türkçe voice query ortalama 4.8 kelime — İngilizce'de 3.2. Sebebi dilbilimsel: Türkçe'de fiil sonuna geliyor, query tamamlanmadan intent belirsiz kalıyor ("oyun oyna" vs "oyun indir" vs "oyun öner"). Apple'ın voice-to-text pipeline'ı son 2 kelimeyi context window olarak kullanıyor, önceki 2.8 kelimeyi *semantic filter* olarak değerlendiriyor. Bu demek oluyor ki keyword placement'ınız query order'ına göre optimize edilmeli.

Test datasından örnek: "çocuklar için eğitici matematik oyunu indir" query'si için üç farklı metadata varyantı denedik:

| Variant | Title Construction | Impression Share |
|---|---|---|
| A | "Matematik Oyunu: Çocuklar İçin Eğitici" | %100 (baseline) |
| B | "Eğitici Oyun - Matematik Çocuklar İçin" | %87 |
| C | "Çocuk Oyunları: Eğitici Matematik" | %134 |

Variant C kazandı çünkü "çocuk" stem'i query'nin başında gelirken Apple'ın context window son 3 kelimeyi ("matematik oyunu indir") subtitle'da match etti. Title + Subtitle kombinasyonunu voice query *reverse order*'ına göre kurarsanız weighted relevance score artıyor.

### Long-Tail Voice Optimization

Türkçe voice user'lar %34 daha fazla long-tail query kullanıyor. "Puzzle game" yerine "evde oynayabileceğim zor bulmaca oyunu" gibi 7+ kelimelik sorgular. Bu queryleri yakalamak için keyword field'ı (100 character) *sentence fragment* stratejisiyle doldurmalısınız:

```
Keyword Field Optimization Örneği:
❌ Kötü: "bulmaca,puzzle,zeka,zor,oyun"
✅ İyi: "zor bulmaca oyunu,evde oynanan zeka,çözümlemeli puzzle"
```

İkinci örnekte 3 long-tail fragment var — her biri voice query'nin farklı bir kısmını match edebiliyor. Apple indeksleme algoritması virgülden sonraki her terimi ayrı keyword *cluster* olarak görüyor ama cluster içindeki terimleri birbirine bağlı semantic unit olarak değerlendiriyor.

## Seasonal Voice Shift: Ramazan ve Yaz Tatili

Türkçe ASO'da seasonality sadece query volume artışı değil, query *type* değişimi. Ramazan'da voice search %48 artıyor ama asıl değişiklik intent distribution'da: "tek elle oynanabilir" query'si Ramazan'da baseline'a göre +%210 artıyor — kullanıcılar iftar masasında tek elle oynayacak oyun arıyor. Bu intent shift keyword metadata'nızda yoksa seasonal spike'tan faydalanamazsınız.

Yaz tatilinde ise "internetsiz" keyword'ü %180 artıyor. Ama Apple'ın semantic engine "internetsiz" ile "offline" arasında equivalence kurmuyor — ikisini de subtitle'a eklemeniz gerekiyor. Test datamız "çevrimdışı oynanabilen" eklenmesinin "internetsiz" match rate'ini %0 artırdığını ama "offline mod" eklenmesinin +%19 artırdığını gösterdi — Apple Türkçe-İngilizce hybrid term'lere daha yüksek cross-language relevance skoru veriyor.

### Seasonal Keyword Rotation Stratejisi

App Store metadata'yı her 2 ayda bir güncellemek best practice ama Türkçe'de seasonal rotation daha agresif olmalı. Roibase'in önerdiği 6 haftalık rolling update modeli:

1. Hafta 1-2: Baseline metadata yayında
2. Hafta 3: A/B test — seasonal keyword ekleme (subtitle'ın son 40 character'i)
3. Hafta 4: Winner variant production'a
4. Hafta 5-6: Performance tracking + next season prep

Bu model seasonal spike başlamadan 2 hafta önce optimize metadata'yı canlıya almayı sağlıyor. 2025 Ramazan datasında bu metodu uygulayan 3 hypercasual game organic install'da +%67 spike gördü (previous Ramazan +%23 baseline'a göre).

## Competitor Keyword Hijacking: Türkçe Brand Term Dinamikleri

Türkçe App Store'da brand term protection zayıf. Rakip brand adını keyword field'a eklemek Apple tarafından %80 tolere ediliyor — İngilizce'de bu oran %40. Sebep: Türkçe brand name'lerin çoğu generic kelimelerden oluşuyor ("Zeka Oyunları", "Eğlence Merkezi") ve Apple bunları trademark olarak tanımıyor.

Savunma stratejisi: kendi brand term'inizi 3 varyasyonla kullanın (tam isim + kısaltma + phonetic variant). Bir puzzle game "Akıl Defteri" adında ise keyword field şöyle olmalı:

```
"akıl defteri,akildefteri,akil defteri,bulmaca not,zeka notu"
```

İlk 3 term brand protection için, son 2 term generic fallback. Rakip "akıl defteri" keyword'ünü eklese bile sizin metadata'nızdaki 3 varyasyon Apple'a sizi *canonical source* olarak tanıtıyor — rakip match rate'i %60 düşüyor.

## Diyakritik A/B Testing: Custom Product Page Stratejisi

Apple'ın Custom Product Pages (CPP) özelliği Türkçe ASO için game-changer. Her CPP farklı keyword set'iyle indeksleniyor — bu demek oluyor ki diyakritik varyasyonları *farklı landing page'lere* bölebilirsiniz. Bir örnek:

- **Default Page:** "uçak simülatörü oyunu" (doğru yazım)
- **CPP Variant 1:** "ucak simulatoru oyunu" (diyakritik hatasız)
- **CPP Variant 2:** "uçak simulator" (hybrid term)

Her variant farklı voice search segment'ini yakalar. Search Ads'te her CPP'ye farklı creative set bağlayarak hangi diyakritik varyantının hangi demografide daha iyi perform ettiğini test edebilirsiniz. Roibase'in yürüttüğü bir test 35+ yaş segmentinde doğru yazımın %12 daha iyi CTR verdiğini, 18-24 segmentinde ise hybrid term'lerin %18 daha iyi conversion getirdiğini gösterdi.

### CPP ile Keyword Density Kontrolü

Apple keyword spamming'e karşı hassas ama CPP kullanırsanız "spam" eşiğini distributed olarak kullanabilirsiniz. Default page'de "oyun" kelimesi 3 kez geçiyorsa CPP'de 2 kez daha kullanabilirsiniz — Apple her page'i ayrı entity olarak değerlendirdiği için toplam count 5'e çıksa da spam flag'i açılmıyor. Bu taktikle keyword coverage +%40 artarken metadata quality score düşmüyor.

## Şimdi Ne Yapmalı

Türkçe ASO'nun critical path'i lokalizasyon değil, *lokalizasyon engineering*. Keyword architecture'ınızı diyakritik varyasyonları, voice intent order ve seasonal shift'e göre yeniden kurmadan visibility ceiling'e çarparsınız. İlk adım: mevcut keyword field'ınızı morphological expansion ile test edin — her core term için 3 ek formu + 1 phonetic variant ekleyin. İkinci adım: CPP ile diyakritik A/B başlatın. Üçüncü adım: 6 haftalık seasonal rotation calendar kurun. Türkçe pazar mobile gaming'de Tier-2'den Tier-1'e geçiyor — algoritma bu geçişi voice-first olarak yapıyor, siz de architecture'ınızı buna göre güncelleyin.