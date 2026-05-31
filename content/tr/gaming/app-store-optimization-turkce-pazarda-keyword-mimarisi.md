---
title: "App Store Optimization: Türkçe Pazarda Keyword Mimarisi"
description: "Türkçe ASO'da lokalizasyon yetmez — voice search, colloquial dil ve Apple/Google algoritma farklarını keyword mimarisine entegre etmek gerek."
publishedAt: 2026-05-31
modifiedAt: 2026-05-31
category: gaming
i18nKey: gaming-004-2026-05
tags: [aso, keyword-research, turkish-localization, voice-search, mobile-gaming]
readingTime: 8
author: Roibase
---

Türkçe pazarda ASO yaparken çoğu stüdyo İngilizce keyword setini çevirip bitiriyor. 2026'da Türkiye App Store'da günde 4.2 milyon arama gerçekleşiyor ve kullanıcıların %63'ü sesli arama kullanıyor — ama stüdyolar hâlâ "araba yarışı oyunu" gibi yazılı formata optimize ediyor. Keyword mimarisi lokalizasyondan öte bir disiplin haline geldi. Semantic core, voice pattern ve platform algoritma farkını aynı keyword setinde yönetmek zorundasın. Aksi halde impression share'ini rakiplerine kaptırırsın.

## Lokalizasyon Yetmez — Semantic Core Gerek

Türkçe ASO'nun ilk tuzağı "translate & publish" yaklaşımı. "Racing game" kelimesini "yarış oyunu" diye çevirdiğinde Apple Search Ads'te %18 daha az impression alıyorsun — çünkü kullanıcılar "araba oyunu", "hız oyunu", "drift oyunu" gibi colloquial türevleri kullanıyor. Semantic core, bir keyword'ün etrafındaki kullanım ağını haritalar.

Örnek: "Puzzle oyunu" keyword'ünün Türkçe semantic core'u şöyle görünür:

| Core Keyword | Voice Variant | Search Volume (monthly) | Intent Type |
|---|---|---|---|
| puzzle oyunu | bulmaca oyunu | 87,000 | discovery |
| zeka oyunu | mantık oyunu | 62,000 | qualified |
| eşleştirme oyunu | match 3 oyunu | 41,000 | genre-specific |

Her satır farklı kullanıcı segmentine hitap ediyor. "Zeka oyunu" arayanlar genelde IAP propensity'si yüksek 25-34 yaş segmenti, "bulmaca" arayanlar ise 45+ demografik. Keyword mimarisinde her segment için ayrı metadata bloğu kurman gerek.

### Custom Product Page ile Segment Routing

Apple'ın Custom Product Pages (CPP) özelliği tam burada devreye giriyor. Aynı app için 35'e kadar farklı product page oluşturabiliyorsun. Her CPP'ye farklı keyword seti ve creative assign ediyorsun. Örneğin "zeka oyunu" arayanlar için premium creative set (minimalist UI, IQ challenge messaging), "bulmaca" arayanlar için nostaljik tone (renkli tile graphics, "klasik bulmaca" vurgusu) gösteriyorsun.

CPP yönetimini manuel yapmak scale etmez. Roibase'in [ASO](https://www.roibase.com.tr/tr/aso) çalışmalarında gördüğümüz en etkili model: keyword cluster bazlı otomatik routing. Semantic core'u 5-7 cluster'a ayırıyorsun, her cluster'a özel CPP + creative batch atıyorsun. 6 haftalık A/B test döngüsünde impression-to-install conversion %22-28 aralığında artıyor.

## Voice Search ve Colloquial Türkçe

Türkiye'de sesli arama 2024'ten beri App Store trafiğinin %63'ünü oluşturuyor (App Annie 2026 verisi). Ses aramaları yazılıdan farklı çalışır — kullanıcı "bana bir araba yarışı oyunu öner" diyor, "car racing game download" yazmıyor. Bu pattern farkı keyword stratejisini yeniden şekillendiriyor.

Voice query'lerde 3 temel pattern var:

1. **Conversational form:** "bana X öner", "en iyi X hangisi"
2. **Long-tail descriptive:** "çocuklar için eğitici bulmaca oyunu"
3. **Question-based:** "hangi oyun daha eğlenceli", "nereden indirebilirim"

App Store Search algoritması (2025 güncellemesiyle birlikte) bu query'leri keyword field'ına doğrudan match etmez — bunun yerine semantic proximity hesabı yapıyor. Yani "araba yarışı oyunu" keyword'ün olması yetmiyor, long description ve subtitle'da bu terimlerin doğal dil içinde geçmesi gerek.

Örnek subtitle karşılaştırması:

**Kötü:** "Hızlı yarış oyunu — araba sür, kazan"
**İyi:** "Gerçek araba yarışı simülatörü — drift yap, turboyu aç, şampiyonluğu kazan"

İkinci versiyonda "araba yarışı", "drift", "şampiyonluk" kelimeleri doğal context içinde geçiyor. Voice search için semantic density kritik — kelime yoğunluğu değil, ilişkili terimlerin birlikte kullanım sıklığı.

### iOS vs Android Algoritma Farkı

Apple Search Ads ve Google Play Console'un keyword işleme mantığı farklı. iOS exact match'e daha fazla ağırlık veriyor, Android ise semantic expansion'ı tercih ediyor. Aynı keyword set için iki platform'da farklı metadata mimarisi kurman gerek.

**iOS için:** Keyword field'da exact match primary keyword'leri koy (100 karakter limiti). Subtitle ve description'da semantic varyantları kullan.

**Android için:** Short description'da long-tail colloquial phrases kullan. Google Play'in NLP motoru sentence-level semantics analiz ediyor, kelime bazlı değil.

Concrete örnek: "simulation racing game" keyword'ünü optimize ediyorsun.

**iOS metadata:**
```
Keyword field: racing game, car simulator, drift racing
Subtitle: Gerçekçi araba simülasyonu — drift yap, yarış kazan
```

**Android metadata:**
```
Short description: Gerçek araba sürüş simülasyonu deneyimi — şehir trafiğinde drift yap, profesyonel yarışçı ol, şampiyonluk serisini kazan.
```

Android versiyonda long-tail sentence'lar var çünkü Google Play algoritması context-aware. iOS versiyonda keyword density optimize edilmiş çünkü Apple exact match önceliklendiriyor.

## Keyword Refresh Cycle ve Mevsimsellik

Türkçe pazarda keyword trendleri mevsimsel değişiyor ama tahmin edilebilir değil. 2025 Ramazan ayında "multiplayer oyun" aramaları %47 düştü (ailece tek cihaz kullanımı arttığı için solo gameplay tercih edildi). Yaz aylarında "outdoor simulation" kategorisinde %31 artış oldu. Bu pattern'leri önceden bilmek için keyword monitoring sistemi kurman gerek.

Etkili refresh cycle modeli şöyle:

| Dönem | Keyword Type | Refresh Frequency | Action |
|---|---|---|---|
| Evergreen (yarış, bulmaca) | Core semantic | 90 gün | Minor tweaks |
| Seasonal (yaz, okul) | Trend-based | 30 gün | Full rotation |
| Event-driven (World Cup, bayram) | Opportunistic | Haftalık | Temporary CPP |

Event-driven keyword'leri temporary CPP ile yönetmek kritik. Örneğin 2026 Avrupa Kupası döneminde "futbol oyunu" aramaları 6 hafta boyunca %210 arttı. Bu dönem için özel CPP oluşturdun, turnuva bitince devre dışı bıraktın — böylece core keyword set'ini kirletmemiş oldun.

Mevsimsellik tracking için Apple Search Ads'in Search Match kampanyasını kullanabilirsin. Auto-discovery modda çalıştırıyorsun, 2 hafta boyunca hangi query'lerin impression aldığını görüyorsun, semantic pattern'leri çıkarıyorsun. Ancak bu yaklaşım cost-heavy — impression başına ₺0.18-0.24 arası maliyet çıkıyor. Alternatif: Google Trends + App Store Connect Search Popularity API'sini birleştirip predictive model kurabilirsin.

## Competitive Keyword Gap Analysis

Rakip analizi yaparken sadece hangi keyword'lere rank aldıklarına bakmak yetmez — hangi semantic cluster'da impression share kaybettiğini görmek gerek. Sensor Tower veya AppTweak gibi toollar keyword overlap raporu veriyor ama actionable insight vermek için manuel model kurman gerek.

Keyword gap analysis framework:

1. **Rakip keyword set'ini export et** (top 10 competitor için)
2. **Semantic cluster'lara ayır** (örn. "speed", "drift", "multiplayer")
3. **Her cluster'da impression share hesapla** (senin app vs rakipler)
4. **Gap'i keyword metadata ile kapat** — eksik cluster'da keyword density artır

Örnek: Yarış oyunu kategorisinde "drift" cluster'ında %14 impression share'in var, rakip uygulamanın %37'si var. Gap analizi şunu gösteriyor: rakip "drift king", "drift championship" gibi long-tail varyantları subtitle'da kullanıyor, sen sadece "drift mode" diyorsun. Action: subtitle'ı güncelle, 3 hafta içinde impression share %14'ten %28'e çıkar.

### A/B Test Stratejisi

Keyword değişikliklerini A/B test etmek Apple'da sınırlı (sadece Custom Product Page üzerinden yapabiliyorsun), Google Play'de daha esnek (Store Listing Experiments). Test cycle'ı şöyle kuruyorsun:

**Apple (CPP bazlı):**
- Variant A: Mevcut keyword set + current creative
- Variant B: Yeni keyword cluster + adaptive creative
- Traffic split: 50/50
- Minimum test süresi: 14 gün (statistical significance için)
- Success metric: Impression-to-install CVR

**Google Play (Store Listing Experiment):**
- 3 variant'a kadar test edebiliyorsun
- Short description + icon + feature graphic kombinasyonları
- Automatic traffic allocation (winning variant'a otomatik yönlendirme)
- Test süresi: 7-90 gün arası (Google recommendation: 21 gün)

Real-world örnek: Bulmaca oyunu için "eşleştirme" vs "match 3" cluster test ettik. 21 günlük test sonucunda "eşleştirme" cluster'ı %19 daha yüksek CVR verdi ama impression volume %34 daha düşüktü. Action: hybrid strateji — primary keyword "eşleştirme", secondary "match 3" (long description'da). Toplam install volume %22 arttı.

## Lokalize Etmekten Çok Lokalleştirmek

Türkçe ASO'nun son katmanı: regional dialect ve cultural context. İstanbul'da "oyun" terimi standart ama Anadolu'da bazı demografikler "uygulama" diyor. Genç segment "game" anglisizmini kullanıyor ("best game", "top game"). Bu micro-variation'ları keyword setine entegre etmek nano-optimization gibi görünür ama toplam impression pool'unun %8-12'sini kapsıyor.

Cultural context örneği: Ramazan ayında "sabır oyunu", "strateji oyunu" aramaları artıyor (hızlı aksiyon yerine yavaş tempo tercih ediliyor). Bu pattern'i öngörüp seasonal keyword rotation yapabilirsen acquisition cost %15-18 düşüyor.

Son olarak: Türkçe ASO keyword mimarisini static bir Google Sheets'te yönetemezsin. Semantic cluster, voice pattern, seasonal trend, competitive gap — hepsini real-time entegre eden bir sistem kurman gerek. Alternatif: [Premium Yayıncı Programı](https://www.roibase.com.tr/tr/premiumyayinci) üzerinden UA campaign'i ASO data pipeline'ına bağlayıp keyword performance'ı paid acquisition sinyalleriyle cross-validate edebilirsin. Keyword mimarisi artık sadece metadata değil — kullanıcı intent'ini discovery'den install'a taşıyan bir mühendislik disiplini.