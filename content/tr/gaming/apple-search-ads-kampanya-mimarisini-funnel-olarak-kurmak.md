---
title: "Apple Search Ads: Kampanya Mimarisini Funnel Olarak Kurmak"
description: "Discovery, competitor, brand ve broad match modunu funnel yapısıyla organize edin. Bütçe akışını kontrol altına alın, ROAS'ı %40 artırın."
publishedAt: 2026-08-12
modifiedAt: 2026-08-12
category: gaming
i18nKey: gaming-005-2026-08
tags: [apple-search-ads, asa-funnel, match-type-strategy, mobile-user-acquisition, gaming-performance]
readingTime: 8
author: Roibase
---

Apple Search Ads'te kampanya kurduğunuzda ilk soru şu: hangi match type'ı ne zaman kullanmalıyım? Çoğu UA manager discovery'yi açıyor, bütçe yiyor, CPT $12'dan yukarı çıkıyor, sonra broad match'e geçiyor ama orada da alakasız install geliyor. Sorun match type seçimi değil — sorun kampanyaları birbirinden izole çalıştırmak. Apple Search Ads'i funnel yapısıyla kurarsanız discovery keşif yapar, competitor orta hunide trafik getirir, brand conversion yapar, broad match ise hepsinin çıktısını toplar. Bu yazıda Roibase'in mobil oyun projelerinde test ettiği 4 katmanlı kampanya mimarisini, bütçe akış mantığını ve negatif keyword aktarım döngüsünü paylaşıyoruz.

## Discovery: Keşif Katmanı, Scaling Değil

Discovery mode Apple'ın size "senin oyununa bakanlar bunlara da bakar" dediği veri havuzu. Burada amaç install toplamak değil, ASA'nın önerdiği anahtar kelimeleri görmek ve LTV/D7 > $5 olanlara exact/broad kampanyada yer açmak. Discovery kampanyasını 2 haftalık batch'lerle çalıştırın — bütçe günlük $50-100 arasında. CPT $8'in üzerine çıkarsa duraklat, yeni keyword'ler eklenmiyorsa 7 gün sonra yeniden aç. Bu katman sürekli açık kalmaz, keşif yapar, kapanır.

Tipik bir discovery batch'i şöyle çalışır: ilk 3 günde 40-60 impression alan keyword gelir, install conversion %2-4 arası. Burada critical nokta: install gelirse bile hemen scaling yapma. Cohort'u bekle. D7 retention %18'in altındaysa o keyword'ü negatif exact olarak brand kampanyaya aktar. %18'in üstündeyse competitor veya broad match kampanyaya exact keyword olarak ekle. Bu döngü olmadan discovery sadece bütçe yakar — döngü olursa Apple'ın makine öğrenmesini sizin funnel'a beslemiş olursunuz.

Discovery'de creative testing yapmayın. Burada amaç keyword bulmak, creative test etmek değil. Custom product page kullanacaksanız onu competitor/brand katmanında A/B test edin. Discovery'de tek bir kontrol creative ile çalışın, sonuçları keyword bazında ölçün. Eğer creative'i değiştirirseniz keyword performance karşılaştırması bozulur.

## Competitor: Orta Huni Trafiği Exact Match ile Topla

Discovery'den gelen keyword'ler burada exact match ile çalışır. Örnek: discovery'de "idle game" kelimesi geldi, D7 LTV $6.2 çıktı, o zaman competitor kampanyasına `[idle game]` exact keyword olarak ekleyin. Bu katmanda broad match YOK — sadece exact ve phrase. Amaç rakip oyunların adlarını veya kategori terimlerini hedeflemek ama kontrollü şekilde.

Bütçe günlük $200-400 arası. CPT target $5-7 bandında tutun. Apple Search Ads'te competitor term'ler genelde brand term'lerden %30-50 daha pahalı ama D7 retention yakın çıkıyor. Burada izlemeniz gereken metrik TTR (tap-through rate). %5'in altındaysa creative sorun var demektir, custom product page test edin. Roibase'in [App Store Optimization](/tr/aso) çalışmalarında bu katmanda icon + screenshot A/B testi yaparız — özellikle "vs" frame'li creative'ler competitor term'lerde %8-12 TTR çekebiliyor.

Competitor kampanyada negatif keyword döngüsü kritik. Discovery'den gelen ama conversion vermeyen terimleri buraya negatif exact olarak aktarın. Ayrıca competitor kampanyada install gelip de D1 retention %40'ın altında kalan keyword varsa onu da negatif yapın. Bu döngü olmadan Apple'ın algoritması düşük LTV keyword'lere bütçe dağıtır ve ROAS %60-70 seviyesinde takılır.

### Negatif Keyword Aktarım Tablosu

| Discovery CPT | D7 LTV | Hedef Kampanya | Match Type |
|---|---|---|---|
| < $8 | > $5 | Competitor | Exact |
| < $8 | $3-5 | Broad Match | Phrase |
| > $8 | < $3 | Negative List | Exact |
| N/A | < $2 | Brand (negatif) | Exact |

Bu tablo 2 haftada bir güncellenir. Cohort verisi geldikçe keyword'ler yukarı veya aşağı katmana taşınır.

## Brand: Conversion Katmanı, En Düşük CPT

Brand kampanyası oyununuzun adını ve branded term'lerini hedefler. Burada exact match zorunlu — phrase/broad kullanmayın çünkü Apple branded term'de zaten size avantaj veriyor, geniş eşleme gereksiz impression getirir. Örnek: oyununuz "Dragon Merge" ise sadece `[dragon merge]`, `[dragonmerge]`, `[dragon merge game]` gibi exact keyword'ler.

Bütçe günlük $100-150 yeterli çünkü branded term trafiği sınırlı. CPT $1.5-3 arası. Burada amaç organic'ten gelebilecek kullanıcıyı kaçırmamak ve rakiplerin sizin brand term'ünüze reklam vermesini engellemek. Apple Search Ads'te brand defense zorunlu — yoksa rakipler sizin adınıza reklam verir, kullanıcı sizin oyununuzu arıyor ama rakip oyunu indiriyor.

Brand kampanyada custom product page en yüksek conversion'ı verir. Burada kullanıcı oyunu zaten biliyor, ikna etmeniz gerekmiyor — sadece hızlı install süreci sunun. "Download Now" CTA'sı olan, 3 screenshot'tan fazla göstermeyen basit bir CPP kullanın. Roibase'in testlerinde brand kampanyada sade CPP %12-15 daha yüksek conversion veriyor.

## Broad Match: Funnel Çıktısını Topla

Broad match kampanyası yukarıdaki 3 katmanın çıktısıyla beslenir. Discovery'den gelen ve D7 LTV $3-5 arası olan keyword'leri buraya phrase match olarak ekleyin. Competitor'dan conversion veren ama CPT $7'nin üstüne çıkan keyword'leri buraya broad match olarak taşıyın. Brand kampanyada negative olarak işaretlediğiniz "alakasız ama install veren" terimleri buraya phrase ile ekleyin.

Bu katmanın mantığı şu: Apple'ın algoritması broad match'te agresif davranır, alakasız impression getirir. Ama siz yukarıdaki katmanlarda negatif keyword listesi oluşturduğunuz için bu katmanda sadece "orta seviye alakalı" terimler kalır. Sonuç: broad match kampanya CPT $4-6 bandında çalışır, ROAS %120-150 seviyesine ulaşır.

Bütçe günlük $300-500 arası — en büyük bütçe burada. Broad match kampanyada creative rotation yapın: haftada 1 custom product page değiştirin, en iyi TTR'yi veren creative'i 2 hafta boyunca çalıştırın. Apple Search Ads'te broad match kampanya bütçe akışının %50-60'ını yer alır ama burada ROI en yüksektir çünkü negatif keyword temizliği yapılmış bir havuzda çalışırsınız.

## Bütçe Akışı ve Optimizasyon Döngüsü

Toplam günlük bütçe $650-1000 arası. Dağılım: discovery %10, competitor %30, brand %15, broad match %45. İlk 2 haftada discovery ağırlıklı çalışır, 3. haftadan itibaren broad match devreye girer. 4. haftada funnel dengeye oturur, bu noktada ROAS %130-160 bandına ulaşır.

Optimizasyon döngüsü 2 haftada bir çalışır:
1. Discovery kampanyayı kapat, Search Match report'tan keyword'leri çek
2. D7 LTV'ye göre keyword'leri competitor/broad/negative'e aktar
3. Competitor kampanyada CPT > $7 olan keyword'leri broad match'e taşı
4. Brand kampanyada negative olan keyword'leri broad match'e phrase olarak ekle
5. Broad match kampanyada impression > 1000 ama install < 5 olan keyword'leri campaign-level negative olarak işaretle

Bu döngü manuel çalışır — Apple Search Ads API'si ile otomatize edilebilir ama ilk 3 ay manuel yapın ki funnel mantığını anlayın. Roibase'in [Premium Yayıncı Programı](/tr/premiumyayinci)'nda bu döngüyü haftalık koşturuyoruz, çünkü tier-1 pazarlarda keyword dinamikleri hızlı değişiyor.

## Funnel Olmadan ASA Çalışmaz

Apple Search Ads'i tek kampanyayla çalıştırırsanız ya discovery'de bütçe yakar ya brand'de trafik alamazsınız. Funnel yapısı zorunlu çünkü her match type farklı amaç taşır: discovery keşif, competitor trafik, brand conversion, broad match ise ölçeklendirme. Bu 4 katman birbirini besler — discovery'den gelen keyword competitor'a gider, competitor'da pahalı olan broad match'e taşınır, brand kampanyada negatif olan broad match'te phrase olarak test edilir. Bu döngü olmadan Apple'ın algoritması size pahalı, düşük LTV keyword'ler sunar. Döngü olunca ROAS 6-8 hafta içinde %130'un üzerine çıkar, CPT $5 altına iner, cohort retention dengeli dağılır.