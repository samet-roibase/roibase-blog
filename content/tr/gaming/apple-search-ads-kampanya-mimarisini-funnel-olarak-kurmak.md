---
title: "Apple Search Ads: Kampanya Mimarisini Funnel Olarak Kurmak"
description: "Discovery, competitor, brand, broad match — bütçe akışını funnel mantığıyla yöneten ASA kampanya mimarisi. Tier-1 piyasalarda install-to-LTV optimizasyonu."
publishedAt: 2026-07-01
modifiedAt: 2026-07-01
category: gaming
i18nKey: gaming-005-2026-07
tags: [apple-search-ads, asa-kampanya-mimarisi, mobile-user-acquisition, funnel-optimization, gaming-growth]
readingTime: 8
author: Roibase
---

Apple Search Ads kampanyalarını tek seviye broad match ile yönetiyorsan bütçenin %40'ını yanlış kullanıcıya harcıyorsundur. 2026'da ASA'nın algoritmik öğrenme kapasitesi arttı ama funnel mantığı yoksa makine sana yanlış sinyalleri öğretiyor. Discovery'de daha ucuz install, brand'de daha yüksek D7 LTV — ama bunları birbirine karıştırırsan her ikisini de kaybedersin. Kampanya mimarisini funnel katmanı olarak kurmak sadece bütçe verimliliği değil, attribution sinyalini doğru beslemek demek.

## Discovery Katmanı: Broad Match ile Keşif Motoru Olarak Çalışmak

Discovery kampanyası ASA'nın geniş ağını kullanarak yeni kullanıcı segmentlerini bulmak için var. Broad match, generic keyword, category term — install hacmi yüksek, IPM düşük ama burada öğrenme sinyali üretiyorsun. Algoritma henüz hangi profil senin oyununa uygun bilmiyor, sen de tahmin yapamıyorsun. Discovery kampanyasının görevi ilk 72 saatte hangi kullanıcıların engagement verdiğini saptamak.

Bütçe dağılımı discovery katmanında toplam ASA harcamasının %25-30'u olmalı. Bunun üzerinde kalırsan CPI düşük görünür ama LTV geri dönmez. Altında kalırsan yeni kullanıcı segmentine ulaşmadan rakiplerin bulduğu kitle içinde dönersin. Örnek: aylık $50K ASA bütçen varsa $12-15K'lık kısım discovery'e ayrılır. Kampanya hedefi CPT (cost-per-tap) değil CPIn (cost-per-install) olmalı çünkü bu katmanda tap kalitesi değil hacmi önemli.

Keyword stratejisi:

- Kategori terimleri (örn. "puzzle game", "strategy rpg")
- Geniş intent sorguları ("free games", "offline games")
- Rakip oyun isimleri (broad match ile ilgili oyunlar da tetiklenir)

Discovery kampanyalarında negative keyword listesi daralttıkça öğrenme alanını daraltırsın. İlk 2 hafta hiç negative eklemeden çalıştır, 3. haftadan sonra D1 retention %15 altında kalan search term'leri engelle.

## Competitor Katmanı: Exact Match ile Rakip Kullanıcısını Çalmak

Competitor kampanyası ASA'nın en yüksek intent trafiğini hedefler. Kullanıcı rakip oyunun ismini yazıyorsa kararlı bir download niyeti var — senin görevin alternatif sunmak. Broad match'te rakip ismine "yakın" aramaları da yakalarsın ama competitor katmanı exact match ile çalışmalı çünkü bütçe kontrolü kritik. Rakip oyunun ismini arayan kullanıcı ya o oyunu indirmek istiyor, ya alternatif arıyor, ya da zaten o oyunu oynuyor ve yeni oyun arıyor.

Bütçe payı %20-25 aralığında. Rakip oyun sayısı arttıkça bu oran artabilir ama her rakibi eşit şekilde hedefleme. Tier-1 rakip (piyasa lideri, seninkine mekanik olarak yakın oyun) ile tier-2 rakip (farklı mekanik, ama aynı kullanıcı profili) aynı CPI'a çalışmaz. Tier-1 rakipler için bid çarpanı %120-150, tier-2 için %80-100 olmalı.

Competitor kampanyalarında creative farkı belirleyici. Kullanıcı rakip oyunu biliyor, senin custom product page'in rakiple karşılaştırma yapmalı — ama açıkça isim geçirmeden. Örnek: rakip oyun turn-based combat kullanıyorsa senin CPP "real-time PvP" öne çıkarmalı. [App Store Optimization](https://www.roibase.com.tr/tr/aso) çalışmasında CPP varyantlarını bu katman için özel olarak hazırlamak IPM'i %18-25 artırıyor.

Negatif sinyal kritik: rakip oyunu daha önce indirip silen kullanıcıyı tekrar o oyunun kelimesiyle yakalamaya çalışma. ASA'da "previous downloader" sinyali yok ama D1 retention %10 altındaysa bu kullanıcı segmenti zaten yanmış demektir.

## Brand Katmanı: Exact Match ile Mevcut Kullanıcıyı Korumak

Brand kampanyası ASA'da savunma hattıdır. Senin oyunun ismini arayan kullanıcı seni zaten biliyor — ama rakiplerin senin brand term'ine reklam veriyor. Brand kampanyası olmazsa rakip reklamı senin oyunun üstünde çıkıyor ve %8-12 arasında kullanıcı kaybı yaşarsın. Bu katman en düşük CPI'yı verir ama trafiği küçük, LTV ise en yüksek çünkü kullanıcı bilinçli gelir.

Bütçe payı %10-15 — küçük ama kesintisiz. Brand kampanyasını pause edersen rakip 48 saat içinde fark eder ve bid'ini artırır. Keyword stratejisi sadece oyun ismi ve varyantları:

| Keyword tipi | Örnek | Match type |
|---|---|---|
| Oyun ismi | "Your Game Name" | Exact |
| Kısaltma | "YGN" | Exact |
| Typo varyantları | "Your Gam Name" | Broad (sadece typo için) |

Brand kampanyasında creative test yapma. Kullanıcı zaten oyunu biliyor, görselde consistency önemli — app icon, oyun logosu, bilinen karakter. CPP varyantı kullanırsan kafası karışır.

Bid stratejisi düşük tutulabilir çünkü Apple brand term'de zaten sana avantaj veriyor. Rakip brand term'ine %150 bid verse bile senin %100 bid'in üstte çıkar. Ama bid'i sıfıra çekme, rakibin organik listeyi itmesini önlemek için minimum $0.50 bid gerekli.

## Broad Match Modu: Farklı Katmanlarda Farklı Kullanım

Broad match ASA'da tek bir ayar değil, her katmanda farklı amaca hizmet eder. Discovery katmanında broad match keşif aracıdır — maksimum reach, minimum negatif. Competitor katmanında broad match risklidir çünkü ilgisiz sorguları tetikler ve bütçeyi dağıtır. Brand katmanında broad match sadece typo varyantları için kullanılır.

Broad match'in öğrenme kapasitesi 2026'da arttı ama hâlâ kontrol mekanizması gerekiyor. ASA algoritması hangi search term'in conversion verdiğini öğrenir ama hangi kullanıcı profilinin D7 LTV verdiğini bilemez. Bu yüzden broad match kampanyaları 14 günlük döngülerle analiz edilmeli:

1. **Gün 1-7:** Hiç negative eklemeden çalıştır, search term raporunu topla
2. **Gün 8-14:** D1 retention <15% olan term'leri negative ekle, bid'leri %10 artır
3. **Gün 15-21:** D7 LTV verisini kontrol et, negatif listeyi güncelle

Broad match kampanyalarında bid çarpanı discovery için %80-90, competitor için %100-120 olmalı. Algoritma "benzer sorguları" bulurken bid sinyalini de kullanıyor, düşük bid öğrenme sürecini uzatır.

## Bütçe Akışını Funnel Mantığıyla Yönetmek

Kampanya katmanlarını kurduktan sonra bütçe akışı funnel olarak çalışmalı. Discovery'den gelen install hacmi yüksek ama LTV belirsiz, competitor'den gelen install orta hacim ama LTV tahmin edilebilir, brand'den gelen install düşük hacim ama yüksek LTV. Bütçe dağılımı sabit değil, haftalık LTV raporuna göre dinamik ayarlanır:

**Hafta 1 (keşif fazı):**
- Discovery %35
- Competitor %25
- Brand %15
- Rezerv %25 (test için beklet)

**Hafta 2-4 (öğrenme fazı):**
- Discovery %30 (negatif liste arttıkça oran düşer)
- Competitor %30 (kazanan rakipler için artır)
- Brand %15
- Rezerv %25

**Hafta 5+ (optimizasyon fazı):**
- Discovery %25
- Competitor %35 (LTV pozitif rakipler için scale et)
- Brand %15
- Rezerv %25 (yeni test veya seasonal push)

Rezerv bütçeyi asla sabit kampanyalara dağıtma. Seasonal event, yeni feature launch, rakip oyunun büyük güncelleme anı gibi fırsatlar için beklet. ASA'da ani bütçe artışı algoritmanın öğrenme sürecini bozar, rezervden yavaş yavaş akıtmak daha verimli.

## Funnel Kampanya Mimarisinin Ölçüm Katmanı

Kampanya katmanlarını kurduktan sonra attribution sinyali bozulmamalı. ASA native olarak SKAdNetwork ile çalışır ama D7 LTV gibi post-install metrikler için MMP entegrasyonu gerekli. AppsFlyer, Adjust, Singular gibi araçlar ASA kampanya ID'sini cohort analizine bağlar. Discovery, competitor, brand her birinin ayrı campaign ID'si olmalı ki LTV verisini katmana göre ayırabilirsin.

Ölçüm altyapısı olmadan funnel mimarisi sadece bütçe dağılımı olur, optimizasyon yapılamaz. Her katmanın kendi başarı metriği var:

| Katman | Birincil metrik | İkincil metrik | Negatif sinyal |
|---|---|---|---|
| Discovery | IPM (install per mille) | D1 retention | CPI >$3 ve D1 <15% |
| Competitor | D7 LTV | CPIn | D7 LTV <$2 |
| Brand | CR (conversion rate) | D30 LTV | CPIn >$1.5 |

Metrikler haftalık değil 14 günlük döngülerle analiz edilmeli çünkü ASA algoritması öğrenme sürecini 10-14 günde tamamlıyor. Günlük optimizasyon yaparsan sinyali bozarsın.

## Kampanya Mimarisini Test Etmek ve Scale Etmek

İlk kurulumda 3 kampanya (discovery, competitor, brand) ile başla. Bütçe $10K altındaysa tek kampanyada çoklu ad group kullan ama bu yapı LTV katmanını bulanıklaştırır. İdeal başlangıç bütçesi aylık $15K — bu seviyede her katmana yeterli hacim düşer ve öğrenme hızlanır.

Scale sürecinde yeni katman eklemek yerine mevcut katmanları derinleştir. Örnek: competitor kampanyasını tier-1 ve tier-2 olarak ayır, discovery kampanyasını coğrafyaya göre böl (tier-1 ülkeler vs emerging market). Her yeni bölünme öğrenme sürecini sıfırlar, bu yüzden scale kararını LTV verisi stabilize olduktan sonra ver.

Test sürecinde A/B kampanyası oluşturma. ASA'da duplicate kampanya algoritmanın kendi reklamınla yarışmasına neden olur. Bunun yerine Creative Set ile CPP varyantlarını test et, kazanan varyantı tüm kampanyalara uygula. [Premium Yayıncı Programı](https://www.roibase.com.tr/tr/premiumyayinci) kapsamında ASA creative test sonuçlarını cross-channel (UAC, Meta) ile birleştirip iterasyon hızını artırabilirsin.

Funnel mimarisi bir kez kurulduktan sonra bakım düşük ama kesintisiz olmalı. Haftalık search term raporu, 14 günlük LTV raporu, aylık cohort analizi — bu döngüyü atlarsan kampanya kendini optimize edemez. ASA algoritması sana sinyal veriyor, sen de ona doğru sinyali geri vermelisin. Discovery'den öğrendiğin profili competitor'a taşı, competitor'den kazandığın LTV'yi brand korumasına yansıt. Kampanya mimarisi statik liste değil, dinamik öğrenme döngüsü olarak çalışmalı.