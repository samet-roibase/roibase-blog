---
title: "Apple Search Ads: Kampanya Mimarisini Funnel Olarak Kurmak"
description: "Discovery, competitor, brand ve broad match modlarını funnel mantığıyla bütçelendirmek. ASA kampanya yapısını LTV ile entegre etmek."
publishedAt: 2026-06-03
modifiedAt: 2026-06-03
category: gaming
i18nKey: gaming-005-2026-06
tags: [apple-search-ads, asa-funnel, mobile-acquisition, match-type-strategy, gaming-ua]
readingTime: 8
author: Roibase
---

Apple Search Ads'i keyword bazlı PPC aracı gibi kullanmak 2021'de bitti. 2026'da ASA bir funnel operasyonu. Discovery'den brand'e uzanan kampanya katmanları, LTV tahminleriyle bütçelenir ve install sayısı değil, D7 ROAS ile optimize edilir. Çoğu ekip hâlâ tek kampanyada broad match kullanıp "scale olmuyoruz" diye yakınıyor. Sorun bütçe değil, mimari tasarım.

## Discovery Kampanyası: Soğuk Trafik Havuzunu Taramak

Discovery kampanyası, App Store'da uygulamanızı hiç duymamış kullanıcıların arama davranışını okumak için kurulur. Broad match ile 200-500 generic keyword seçilir, günlük bütçe düşük tutulur (tier-1'de 50-100 dolar), ama search impression share %100'e yaklaştırılır. Hedef install hacmi değil, Search Match verisi toplamak.

Kampanyayı kurduktan 72 saat sonra Search Match raporu analiz edilir. Hangi sorgularda impression aldınız, hangi kelimeler install getirdi, hangileri spam? Bu veri ASO stratejisini doğrular veya çürütür. Örneğin metadata'da "puzzle" vurgusu varken Search Match "idle game" sorgularında yüksek TTR gösteriyorsa, ASO ile UA arasında uyumsuzluk var.

Discovery katmanında CPT (cost per tap) %35-%50 daha düşüktür çünkü rekabet bilinmeyen anahtar kelimelerde seyrektir. Ama conversion rate (tap-to-install) zayıftır. Bu normal. Discovery'nin görevi funnel beslemek, install hacmi yapmak değil. Haftalık 200-300 install yeterli, %15'i negatif keyword listesine alınır, geri kalanı competitor ve brand katmanlarına sızar.

### Discovery Bütçe Kuralı

Discovery kampanyasının günlük bütçesi toplam ASA bütçenizin %10-15'ini geçmemeli. Örnek: aylık 30.000 dolar ASA spendinde discovery'ye 100 dolar/gün ayrılır. Bütçe sabittir, CPA hedefi yoktur, manual bid kullanılır (genelde 0.30-0.50 dolar tier-1'de). 14 gün sonra Search Match'ten çıkan yüksek performanslı kelimeler exact match olarak competitor kampanyasına taşınır.

## Competitor Kampanyası: Rakip Markası İçin Rekabete Girmek

Competitor katmanı, rakip oyunların marka isimlerini exact match ile hedefler. "Candy Crush", "Clash of Clans", "Subway Surfers" gibi brand termleri bu katmanda çalışır. Strateji agresif değil, oportunistik olmalı. Rakip kendi marka termi için max bid kullanıyorsa, sizin oranız %60-70'te kalır, ilk sıra hedeflenmez.

Competitor kampanyalarının CPT'si discovery'den %80 daha yüksektir ama TTR %12-18'e çıkar (discovery'de %3-5). Install dönüşüm oranı da iyi değildir çünkü kullanıcı başka oyunu arıyordu. D1 retention %25-30 civarında kalır, organik installerinizde %45-50 iken. Ama bazı senaryolarda toplam LTV havuzunu genişletir.

Competitor katmanının KPI'ı "incremental ROAS"tır. Rakip kelimeyi pause ettiğinizde toplam install sayınız %10 düşüyor mu? Düşüyorsa kampanya incrementality sağlıyor. Düşmüyorsa, aynı kullanıcı zaten discovery veya brand kampanyanızdan geliyordu, kannibalizasyon var. 14 günlük incrementality testi zorunlu.

| Match Type | CPT (tier-1) | TTR | D7 ROAS Hedefi | Bütçe Payı |
|---|---|---|---|---|
| Discovery (broad) | $0.40 | %3-5 | Test modu | %10 |
| Competitor (exact) | $1.20 | %12-18 | %80+ | %25 |
| Brand (exact) | $0.60 | %25-35 | %200+ | %50 |
| Generic (broad) | $0.70 | %6-9 | %120+ | %15 |

## Brand Kampanyası: Kendi Markanızı Korumak

Brand kampanyası, kendi oyununuzun adını arayan kullanıcıları rakiplere kaptırmamak için kurulur. "Roibase Puzzle", "Roibase Game", "Roibase RPG" gibi kelimeler exact match ile hedeflenir. Bu katmanda max bid kullanılır çünkü organik sıralama bile rakip reklama yenik düşebilir.

Brand kampanyalarının CPT'si en düşüktür (tier-1'de 0.40-0.80 dolar). TTR %25-35, install CR %60-70, D7 retention %50+. Bu kullanıcı zaten oyununuzu biliyor, indirecekti. Sorulması gereken: "Bu kullanıcı brand kampanyası olmasaydı organik indirmeyi tamamlar mıydı?" Yanıt genelde "evet"tir ama rakip aynı kelimede reklam veriyorsa, kampanya zorunlu olur.

Brand katmanının bütçesi toplam ASA spendinin %40-50'sini oluşturur. Bu büyük gözükür ama aslında savunma pozisyonu. Rakip sizin brand terminizi hedeflediğinde, siz de onunkileri hedeflersiniz — MAD (mutually assured destruction) dengesi. 2026'da tier-1'de hemen her oyun brand savunması yapıyor, yapmayan ise %10-15 organik install kaybediyor.

### Brand Kampanya Pause Testi

Kendi brand terminizi rakip hedeflemiyorsa, kampanyayı 7 gün pause edin. Organik install sayısı düşüyor mu? Düşmüyorsa, brand kampanyası UA bütçenizi şişiriyor ama incremental değer yaratmıyor. Düşüyorsa (genelde %8-12 düşüş görülür), kampanyayı aktif tutun ama CPA cap koyun (organik kullanıcı LTV'sinin %15'i üst sınır).

## Broad Match Modu: Keşif Değil, Scale Aracı

Broad match, discovery ile karıştırılmamalı. Discovery broad match kullanır ama low bid + low budget ile çalışır. Broad match scale kampanyası ise yüksek bid + yüksek budget ile generic terimlerde impression share kazanmak için kurulur. "puzzle game", "idle rpg", "strategy mobile" gibi kategori terimleri bu modda çalışır.

Broad match kampanyalarının riski "alakasız sorgu"dur. "puzzle" kelimesinde reklam veriyorsunuz ama Search Match "puzzle solver app", "puzzle table" gibi non-gaming sorgularda da gösteriyor. Negatif keyword listesi 200+ kelime olmalı. İlk 7 gün manuel kontrol zorunlu — Search Match'te günlük review.

Broad match'in bütçesi toplam ASA spendinin %15-20'sini geçmemeli. Örnek: aylık 30.000 dolar bütçede 5.000 dolar broad match'e ayrılır. CPA hedefi exact match kampanyalarından %20-30 daha yüksek tutulur çünkü funnel üstünde çalışıyor. D7 ROAS hedefi %100-120. Altına düşerse pause değil, bid düşürülür — kampanya veri toplamaya devam eder.

## Bütçe Akışı: Funnel Aşamasından Aşamaya Kaymak

Sağlıklı ASA mimarisi, kullanıcıyı discovery'den brand'e taşır. Discovery'de ilk kez maruz kalan kullanıcı, 48-72 saat içinde App Store'da oyununuzun adını aratıyorsa, bu defa brand kampanyanız onu yakalıyor. Bu akışı ölçmek için Apple'ın "Custom Product Page" attribution verisi kullanılır — hangi kampanyada first touch, hangi kampanyada install?

Bütçe dağılımı şöyle kurgulanır: Discovery sabit kalır (günlük 100 dolar), competitor ve broad match haftalık CPA performansına göre %10-20 artırılır veya azaltılır, brand kampanyası ise "always on" modda maksimum budget ile çalışır. Toplam spend, D7 ROAS hedefinin altına düştüğünde önce competitor kapatılır, sonra broad match pause edilir, discovery ve brand devam eder.

Örnek akış: Mayıs ayında discovery kampanyasından 250 install geldi, bunların %12'si (30 kullanıcı) 72 saat içinde brand terimi arattı ve brand kampanyasından install oldu. Bu 30 kullanıcının LTV ortalaması discovery doğrudan install grubundan %40 daha yüksek çıktı. Bu veri, discovery kampanyasının sadece doğrudan install değil, indirect brand lift etkisi yarattığını kanıtlar.

### Funnel Attribution Tablosu

```
Campaign         | Spend    | Installs | Direct LTV | Assisted Installs | Blended LTV
----------------|----------|----------|------------|-------------------|-------------
Discovery       | $3,000   | 250      | $4.20      | 30 (brand)        | $5.80
Competitor      | $7,500   | 420      | $6.10      | 15 (brand)        | $6.50
Brand           | $15,000  | 1,200    | $12.40     | —                 | $12.40
Broad Match     | $4,500   | 310      | $5.30      | 22 (brand)        | $6.00
```

## Campaign Budget Optimization: Apple'ın Yeni Algoritması

2025'ten itibaren Apple Search Ads, "Campaign Budget Optimization" (CBO) özelliğini test ediyor. Google App campaigns'teki portfolio bid stratejisine benziyor: tek bütçe, birden fazla kampanya, makine öğrenmesi en iyi performans gösteren kampanyaya otomatik kayar. CBO'yu gaming UA'da kullanmak riskli. Algoritma D7 ROAS hedefini dikkate almıyor, sadece install hacmini maksimize ediyor.

CBO'yu açarsanız, brand kampanyası bütçenin %70-80'ini çeker çünkü CPA en düşük orada. Discovery ve competitor aç kalır. Sonuç: install sayınız düşmez ama funnel üstü beslenme durur, 3 hafta sonra brand kampanyasının install hacmi de düşmeye başlar. CBO'yu ancak şu koşullarda kullanın: brand + broad match gibi benzer CPA'lı kampanyaları birleştiriyorsanız.

## Hangi Katman Performans Göstermeyince Kapatılır?

Kapatma kararı CPA'ya değil, incrementality'ye bağlı. Competitor kampanyası CPA hedefinin %30 üstünde ama pause ettiğinizde toplam install %8 düşüyorsa, kampanya incremental demektir — devam eder, bid optimize edilir. Broad match kampanyası CPA hedefine uygun ama pause ettiğinizde install sayısı değişmiyorsa, kampanya kannibalizasyon yapıyordur — kapatılır.

Discovery kampanyası asla pause edilmez. Bütçesi düşürülebilir ama sıfırlanmaz. Çünkü discovery'nin görevi anında ROAS değil, ASO hipotezlerini test etmek ve Search Match veri havuzunu beslemek. Brand kampanyası da asla pause edilmez. Rakip brand terminizi hedefliyorsa, siz de savunma pozisyonunda kalırsınız.

ASA funnel mimarisini [App Store Optimization](https://www.roibase.com.tr/tr/aso) stratejisiyle entegre etmezseniz, kampanya performansınız 3-4 hafta içinde plato yapar. Metadata'da vurgulanan keyword'ler ile ASA kampanyalarında hedeflenen terimler tutarlı olmalı. Discovery kampanyasında beklenmedik yüksek TTR veren bir kelime varsa, bu kelimeyi ASO metadata'ya eklemek install CR'ı %10-15 artırır.