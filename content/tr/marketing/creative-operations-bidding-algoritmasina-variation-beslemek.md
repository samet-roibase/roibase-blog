---
title: "Creative Operations: Bidding Algoritmasına Variation Beslemek"
description: "Performance Max ve Advantage+ için kreatif test mimarisi. Algoritma besleme ritmi, variation taxonomy ve kanal-ötesi kreatif veri altyapısı."
publishedAt: 2026-06-25
modifiedAt: 2026-06-25
category: marketing
i18nKey: marketing-005-2026-06
tags: [creative-operations, performance-max, advantage-plus, creative-testing, bidding-algorithm]
readingTime: 8
author: Roibase
---

Google'ın Performance Max ve Meta'nın Advantage+ kampanyalarının ortak özelliği: kreatif varyasyonları algoritma için yakıt haline getirdiler. 2024 öncesi "bir kampanyaya 5 görsel at, hangisi tutarsa" mantığı öldü. Şimdi soru şu: algoritmanın learning hızını bozmadan ne kadar sık, hangi formatla, hangi variation hierarchy ile besleme yapacaksın? Cevap creative operations disiplininde — kreatif üretimi performans sistemine entegre eden mühendislik katmanında.

## Algoritma Öğrenme Hızı ve Variation Ritmi

Performance Max ve Advantage+ bidding algoritmaları Bayesian modeller üzerine kurulu. Her yeni kreatif eklediğinde model yeniden öğrenmeye başlar. Eğer haftada 20 varyasyon atarsan algoritma dağılımı stabilize edemez, ROAS volatilitesi artar. Creative operations'ın ilk kuralı: "öğrenme bütçesi var mı?" sorusunu sormak.

Google'ın kendi önerileri şöyle: 25-50 dönüşüm görmeden asset-level performans çıkarımı yapmayın. Meta'da bu sayı 15-30 dönüşüm. Demek ki bir variation'ın test edilebilmesi için minimum bütçe × süre × impression volümü gerekli. Küçük hesaplarda (günlük 500$ altı) haftada 3'ten fazla yeni asset eklemek öğrenme döngüsünü kırar.

Roibase'in [Performans Pazarlaması](https://www.roibase.com.tr/tr/ppc) yaklaşımında kreatif cadence'i kampanya bütçesine göre ayarlanır. Günlük 2.000$+ hesaplarda haftalık 5-7 variation testi sürdürülebilir; 500$ altında ise iki haftada 2-3 variation ile iteratif gitmek daha sağlıklı. Ritim belirlendikten sonra ikinci katman: hangi varyasyonları besleyeceğin.

### Test Priority Matrix

Kreatif varyasyonu şu üç eksen üzerinde önceliklenir:

| Eksen | Özellik | Test Maliyeti |
|---|---|---|
| Format | Video vs. statik vs. carousel | Yüksek (algoritma farklı placement'lara dağıtır) |
| Hook | İlk 3 saniye message | Orta (aynı format içinde swap hızlı) |
| CTA | "Hemen Al" vs. "Daha Fazla" | Düşük (footer değişikliği) |

Önce hook testini bitir — çünkü format değişimi algoritma için "yeni kampanya" gibi davranır. Hook stabilize olduktan sonra CTA katmanını test et.

## Variation Taxonomy: Asset Group Hiyerarşisi

Performance Max'te asset group yapısı şöyle: bir kampanya > birden çok asset group > her group içinde asset seti. Mantık: her asset group farklı audience signal + kreatif kombinasyonu için ayrı bidding container. Ama çoğu markanın hatası: grup sayısını fazla tutmak. 5 asset group × 10 kreatif = 50 kombinasyon, öğrenme süresi patlıyor.

Doğru mimari: 2-3 geniş asset group, içlerinde tight variation hierarchy. Örneğin bir e-ticaret markasının yapısı:

**Asset Group 1:** Catalog-driven (feed bazlı dinamik reklam)
- Headline variation: 5 farklı value prop
- Description: 3 farklı CTA stili
- Görsel: feed'den gelen ürün görselleri

**Asset Group 2:** Brand storytelling (statik kreatif)
- Video: 15s, 30s, 60s edit'ler
- Statik: lifestyle + product-only karşılaştırması
- Headline: problem-aware vs. solution-aware split

Bu yapıda algoritma grup içinde öğrenir, gruplar arası rekabet minimum kalır. Taxonomy şablonu:

```
Kampanya
├─ Asset Group: Intent-High (katalog besleme)
│  ├─ Headline Set A (price-focused)
│  ├─ Headline Set B (feature-focused)
│  └─ Image Pool (5 ürün × 2 açı = 10 asset)
└─ Asset Group: Intent-Low (awareness)
   ├─ Video Set (3 duration)
   └─ Static Set (2 hook type)
```

Google'ın recommendation: asset group başına minimum 4 headline, 5 description, 5 image. Ama üst sınır yok — 20 asset verebilirsin. Kritik nokta: yeni asset eklerken mevcut en düşük performanslı 1-2 asset'i çıkar. Yoksa öğrenme sürekli yeniden başlar.

## Signal Enrichment: Kreatif Metadata ve Performans İzleme

Advantage+ ve PMax'in ortak sorunu: creative-level raporlama sığ. Google'da "asset report" var ama kombinasyon bazında CTR/CVR görmek zor. Meta'da breakdown raporları var ama statistically significant sayıya erişmek haftalar alıyor.

Çözüm: UTM + first-party event enrichment. Kreatif ID'yi impression-time'da BigQuery'ye yaz, dönüşüm event'ine join et. Mimari:

```
Ad Impression (sGTM)
  ├─ creative_id
  ├─ asset_group_id
  ├─ campaign_id
  └─ timestamp
      ↓ join
Conversion Event (Firestore/BigQuery)
  ├─ transaction_id
  ├─ revenue
  └─ timestamp
```

Bu veri birleşimi ile "hangi asset hangi demografide daha iyi perform ediyor" analizini platformdan bağımsız yaparsın. Örnek sorgu:

```sql
SELECT
  creative_id,
  COUNT(DISTINCT user_id) AS reach,
  SUM(revenue) AS total_revenue,
  SUM(revenue) / COUNT(DISTINCT click_id) AS revenue_per_click
FROM ad_performance
WHERE campaign_id = 'pmax_q2_2026'
  AND event_date BETWEEN '2026-06-01' AND '2026-06-25'
GROUP BY creative_id
HAVING COUNT(DISTINCT click_id) > 50
ORDER BY revenue_per_click DESC;
```

Bu data layer olmadan "asset X iyi performans gösterdi" diyemezsin — platform UI'ı sadece aggregate metrik verir. Enrichment yapısı kurulduktan sonra üçüncü katman: kreatif versiyonları nasıl iterasyon yapacaksın.

### Incremental Creative Testing

Klasik A/B test mantığı burada işlemez — çünkü algoritma tüm asset'leri aynı anda görür, traffic split sen yapamazsın. Onun yerine **holdout-free incremental test** kullan: yeni variation ekle, 7 gün bekle, regresyon analizi ile lift'i hesapla.

Formül: `Lift = (Revenue_post - Revenue_pre) / Revenue_pre - Organic_Growth_Rate`

Organic growth rate'i hesaplamak için kontrol kampanyası gerekli — yeni kreatif eklenmemiş, aynı bütçe ile devam eden bir segment. Eğer kontrol segmentinde %5 büyüme varken test segmentinde %12 büyüme varsa gerçek lift %7.

Meta'nın Conversion Lift Study aracı bunu otomatik yapar ama minimum 400K impression gerektirir. Küçük hesaplarda manuel incrementality hesabı yapmak zorunda kalırsın.

## Kanal-Ötesi Kreatif Senkronizasyonu

Performance Max Google evreninde (Search, Display, YouTube, Discover, Gmail) dağılır. Advantage+ Meta'da (Feed, Story, Reel, Audience Network) dağılır. Eğer her kanal için ayrı kreatif üretimi yapıyorsan maliyet patlar. Creative ops burada assembly line kurar: bir core asset'ten türevler üretir.

Örnek pipeline:

1. **Master Asset:** 60s product demo video (4K, 16:9)
2. **Türevler:**
   - YouTube → 30s horizontal
   - Reel/Short → 15s vertical (9:16)
   - Display → 6s cinemagraph (1:1)
   - Search text ad → video'dan extract edilen 3 headline

Bu türetme işini manuel yaparsan 1 asset → 4 variation = 8 saat iş. Otomasyon ile (Bannerbear, Cloudinary, Shotstack gibi API'ler) → 10 dakika. Otomasyon stack'i:

- **Video editing:** FFmpeg (CLI) veya Shotstack API
- **Image cropping/resizing:** Cloudinary Transformations
- **Text overlay:** Bannerbear (dinamik template)
- **Asset storage:** S3 + CloudFront (CDN)

Bu pipeline kurulduktan sonra creative ops team bir haftalık iteration'ı şöyle yürütür: Pazartesi master asset üretimi → Salı türev generation → Çarşamba QA + platform upload → Perşembe algoritma besleme → Cuma-Pazartesi performans analizi.

### Cross-Platform Creative Governance

Google ve Meta'ya aynı kreatifi farklı dosya ID'leriyle yüklersin. Ama performans raporlaması için unique identifier gerekli — yoksa "asset_123" Google'da başka, Meta'da başka anlama gelir. Governance için taxonomy:

```
{brand}_{campaign}_{format}_{hook}_{version}
roibase_q2_video_problem_v3
```

Bu naming convention'ı tüm platformlarda kullan (dosya adı, UTM parametresi, internal tracking). Böylece BigQuery'de cross-channel analiz yaparken join key'in olur.

## Creative Ops ve Growth Fonksiyonu Arasındaki Bağ

Creative operations tek başına "kreatif ekibi hızlandırma" değil — growth loop'un bir parçası. Loop şöyle:

1. **Bidding algoritması** → en yüksek ROAS'lı segment'i bulur
2. **Creative ops** → o segment için yeni variation üretir
3. **Attribution stack** → hangi kreatifin gerçekten incremental olduğunu ölçer
4. **Budget allocation** → kazanan kreatife daha fazla spend verir

Bu loop'u döndürmek için creative ops, media buying ve data engineering ekipleri aynı sprint'te çalışmalı. Geleneksel ajans modelinde bu üç ekip ayrı departmanlarda — kreatif 2 hafta sonra gelir, media buyer bekler, data engineer başka projededir. Roibase modelinde aynı pod: kreatif + PPC + data engineer haftalık sync ile iteration yapar.

Sonuç: algoritma öğrenme süresini 40% kısaltırsın (Google'ın 2025 case study'sine göre), kreatif production lead time'ı 3 günden 1 güne iner. Ama bu mimariyi kurmak için önce organizasyonel siloları kırmak gerekiyor — creative ops salt teknoloji değil, growth fonksiyonunun ekip yapısıdır.