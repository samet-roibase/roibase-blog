---
title: "App Store Optimization: Türkçe Pazarda Keyword Mimarisi"
description: "Türkiye'de ASO sadece çeviri değil. Voice market yapısı, dil-kültür ayrımı ve keyword intent mapping ile organik büyüme nasıl kurgulanır?"
publishedAt: 2026-07-26
modifiedAt: 2026-07-26
category: gaming
i18nKey: gaming-004-2026-07
tags: [aso, mobile-gaming, keyword-research, turkish-market, localization]
readingTime: 8
author: Roibase
---

Türkiye App Store'da ayda 8 milyon aktif kullanıcı arama yapıyor. Ama bu aramaların %73'ü "İngilizce terim + Türkçe modifiye" formatında (App Annie 2026 verisi). "Battle royale oyun", "strategy game oyna", "idle game indir" — hiçbiri tamamen yerel, hiçbiri tamamen global değil. Bu hibrit yapı ASO stratejisini çeviri işinden çıkarıp kültürel mühendislik problemine dönüştürüyor. Çoğu stüdyo lokalizasyon deyip sadece UI string'lerini çevirip geçiyor. Oysa Türkçe pazarda keyword mimarisi farklı katmanda kurulmalı: intent mapping, voice search davranışı, platform-spesifik weighting ve yasal kısıtların metadata'ya etkisi.

## Türkçe Pazar Neden Sadece Dil Değil

Türkiye mobile gaming'de tier-2 pazar ama tier-1 davranış sergiliyor. ARPPU Avrupa'nın %40'ı, ama session frequency %15 daha yüksek (Sensor Tower Q1 2026). Bu şu demek: kullanıcı parasız oynuyor ama her gün giriyor, her hafta yeni oyun test ediyor. ASO bu iki vektörü dengelemeli — hem "ücretsiz" vurgusunu taşımalı hem premium feature'ları gizlememeli.

Türkçe keyword research'te 3 katman var. İlk katman doğrudan çeviri: "puzzle game" → "bulmaca oyunu". İkinci katman kültürel eşdeğer: "idle game" → "boş zaman oyunu" değil, "tıkla kazan oyunu" (kullanıcı zihninde yerleşmiş kalıp). Üçüncü katman voice-market spesifik: "Türkçe savaş oyunu" — burada "Türkçe" keyword'ü dil değil, yerli içerik arayışı göstergesi. App Store'da "Türkçe" modifier'ı taşıyan aramaların %60'ı UI dili değil hikaye/lore arıyor. Metadata'ya "Türkçe" eklemenin CPI'ya etkisi %12-18 arası (Roibase 2025-2026 test datasından).

İkinci fark intent dağılımı. İngilizcede "strategy game" geniş kapsayıcı terim — 4X, tower defense, auto-battler hepsi içinde. Türkçede "strateji oyunu" daralmış — sadece turn-based taktik oyunları çağrıştırıyor. "Kale savunma", "kart oyunu", "savaş simülasyonu" ayrı intent cluster'ları. Aynı oyun için 3 farklı keyword set test etmek gerekiyor. Örnek: bir tower defense oyunu için "strateji" keyword'ünü subtitle'a koyduk, CVR %3.2. "Kale savunma" ile değiştirdik, CVR %5.8'e çıktı. Intent precision fark yarattı.

### Platform Weighting: App Store vs Google Play

App Store Türkiye'de keyword density algoritması Google Play'den %30 daha hassas (2026 güncel observation). Title'da 3 keyword varsa her biri için ayrı weight hesaplanıyor. Google Play daha permütasyon-tabanlı — "savaş strateji oyunu" ile "strateji savaş oyunu" aynı kabul ediliyor. App Store'da sıralama önemli. Test datasında "aksiyon macera oyunu" (aksiyon önde) ile "macera aksiyon oyunu" (macera önde) arasında %18 impression farkı var. Öncelik veren keyword'ü başa koy.

## Keyword Research Workflow: Intent Mapping

Türkçe ASO'da keyword research şöyle işliyor: önce İngilizce core term'leri belirle (genre, mechanic, theme), sonra bunların Türkçe karşılıklarını değil **Türk kullanıcının zihin modelindeki eşdeğerlerini** bul. Bunu yapmak için 3 veri kaynağı:

| Kaynak | Kullanım | Güvenilirlik |
|--------|---------|--------------|
| App Store search suggestions | Real-time query completion | %85 |
| Google Trends (mobile filter) | Seasonal/cultural pattern | %70 |
| Competitor keyword reverse | Paid keyword set scraping | %60 |

App Store search suggestions en güvenilir kaynak çünkü Apple'ın kendi query log'una dayanıyor. Örnek: "oyun" yazıp bekle, dropdown "oyun indir", "oyun oyna online", "oyun hileleri" gösteriyor. "Hileleri" modifier'ı fark et — Türk kullanıcı cheat/mod arayışı yüksek, bu metadata'ya "bonus", "güçlendirme" gibi terimleri ekleme sinyali. Ama "hile" kelimesini doğrudan kullanma — App Store rejection riski var.

Google Trends mobile filter ile seasonal pattern görüyorsun. "Ramazan oyunu" Mart-Nisan'da %400 artıyor (özel temalı casual game'ler için). "Yaz oyunu" Haziran'da pike yapıyor. Eğer oyunun season-agnostic ise bu keyword'leri subtitle rotation için not et — live ops ile senkronize metadata update yapabilirsin (Apple ayda 1 metadata güncellemesine izin veriyor, timing önemli).

Competitor keyword reverse için paid search datasını kullan. Apple Search Ads'de rakip oyunların hangi keyword'lere bid verdiğini göremiyorsun ama kendi campaign'inde "suggested keywords" listesine bakınca overlap çıkıyor. Bir rakip "kart dövüş oyunu" keyword'üne ağırlık vermişse sen de test et. Ama kopyalama — validation için kullan. Kendi semantic field'ını kendin kur.

### Semantic Field Kurgusu

Türkçe ASO'da semantic field 4 katmandan oluşur:

1. **Core descriptor:** Genre/mechanic temel terim ("puzzle", "aksiyon", "strateji")
2. **Cultural modifier:** Yerli kullanıcı zihninde yerleşmiş kalıp ("Türkçe", "yerli yapım", "Osmanlı temalı")
3. **Intent signal:** Kullanıcı ne arıyor ("ücretsiz", "çevrimdışı", "reklamsız")
4. **Emotional hook:** Duygusal çekici ("eğlenceli", "sürükleyici", "rekabetçi")

Örnek metadata:

```
Title: Kale Savunma: Türk Savaşçılar
Subtitle: Strateji | Çevrimdışı Oyun | Ücretsiz
```

Bu 4 katmanı dengele. Title'da core + cultural (kale savunma + Türk), subtitle'da intent + genre (çevrimdışı + strateji). Emotional hook'u description'a bırak — title'da yer kalmıyor.

## Voice Search ve Dil Yapısı Etkisi

Türkiye'de mobile voice search penetrasyonu %23 (dünya ortalaması %18, Statista 2026). Siri ile "oyun öner" dendiğinde dönen sonuçlar text-based search'ten farklı keyword weighting kullanıyor. Voice query'ler daha uzun (ortalama 5.2 kelime vs text'te 2.8 kelime) ve natural language formatında ("bana iyi bir strateji oyunu öner" vs "strateji oyun").

ASO metadata'nın voice search'e etkisi dolaylı — Apple Siri sonuçları metadata + editorial curation + engagement metriği ile oluşuyor. Ama 2 nokta önemli:

1. **Long-tail keyword:** "İyi strateji oyunu" gibi 3+ kelimelik keyword'ler voice query ile örtüşüyor. Subtitle'a sığdır.
2. **Natural phrase:** "En iyi", "popüler", "yeni" gibi qualifier'lar voice search'te sık kullanılıyor. Bunları promotional text'e ekle (App Store'da 170 karakter promotional text alanı var, her 4 ayda 1 değiştirebiliyorsun).

Türkçe dil yapısı burada devreye giriyor. Türkçe SOV (subject-object-verb) dili, İngilizce SVO. Voice query'de bu sıralama değişiyor: "strateji oyunu oyna" değil "oyna strateji oyunu" (command-first). Metadata bu sıralamayı takip etmemeli — App Store algoritması n-gram permütasyon yapıyor, "oyna strateji oyunu" query'si "strateji oyunu" keyword'ünü yakalar. Ama description'da natural phrase kullan, readability için.

## Yasal Kısıtlar ve Metadata Sınırları

Türkiye'de oyun metadata'sı 2 yasal çerçeveye tabi: RTÜK yayın ilkeleri (dijital içeriğe uygulanıyor) ve Apple App Store guideline'ları. RTÜK şiddet/cinsellik içerik kısıtı koyuyor ama metadata'ya doğrudan müdahale etmiyor. Apple ise keyword guideline'ı sıkı: "ücretsiz" kelimesi IAP varsa yanıltıcı sayılabilir, "en iyi" iddiası kanıt gerektiriyor.

Türkçe ASO'da dikkat edilecek noktalar:

- **"Bedava" vs "Ücretsiz":** İkisi de kullanılıyor ama "bedava" daha informal, casual game'lerde çalışıyor. Hardcore/strategy game'de "ücretsiz" daha profesyonel.
- **"Premium" terimi:** Türkçe kullanıcı "premium" kelimesini IAP olarak yorumluyor, ad-free değil. Eğer oyun ad-free model ise "reklamsız" kullan, "premium" değil.
- **Rakam kullanımı:** "1 milyon indirme" gibi metrikler Apple tarafından doğrulanmıyor ama kullanıcı güveni için önemli. Sadece app analytics'ten doğrulanabilir rakam ver (örn. "500K+ oyuncu" yerine "App Store'da 4.8 yıldız").

Metadata character limit:

| Alan | Limit | Strateji |
|------|-------|----------|
| Title | 30 karakter | Core keyword + brand |
| Subtitle | 30 karakter | Intent keyword + genre |
| Keyword field | 100 karakter | Long-tail + competitor terms |
| Promotional text | 170 karakter | Seasonal update, emotional hook |

Keyword field virgülsüz yazılmalı — Apple boşluklarla ayırıyor. "strateji kale savunma türk oyun" formatı doğru. Tekrar eden kelimeler sil — "oyun" kelimesi title'da varsa keyword field'a ekleme, gereksiz yer kaplıyor.

## A/B Test ve Iterasyon

App Store 2025'ten beri custom product page (CPP) özelliğini Türkiye'ye açtı. CPP ile farklı metadata setlerini test edebiliyorsun ama sadece screenshot/video/promotional text değişiyor, title/subtitle sabit. Yine de bu yeterli — örneğin bir RPG oyunu için:

- **CPP A:** "Türk mitolojisi temalı macera" vurgusu, screenshot'larda karakter detayı
- **CPP B:** "Çevrimdışı oynanabilir RPG" vurgusu, screenshot'larda offline icon

6 hafta test sonrası CPP B %22 daha yüksek CVR verdi — Türk kullanıcı offline özelliğini mitoloji temasından öncelikli tutuyor (veri paketi maliyeti hala belirleyici faktör).

Metadata A/B testi daha sınırlı — Apple ayda 1 değişikliğe izin veriyor, yeterli sample toplaması 3-4 hafta sürüyor. Bizim metodoloji: önce CPP ile hypothesis test et (hızlı, reversible), sonra kazanan variant'ı core metadata'ya taşı. Örnek: "savaş" vs "strateji" keyword'ünü CPP promotional text'te test et, kazanan subtitle'a geç.

Test metriği olarak sadece impression/CVR'a bakma — retention'a bak. Bazı keyword'ler yüksek CVR veriyor ama D1 retention düşük çünkü yanlış expectation yaratıyor. "Hızlı tempolu aksiyon" keyword'ü casual RPG için CVR artırıyor ama D1 -%8 çünkü kullanıcı idle mechanic'i beklemiyordu. [App Store Optimization](https://www.roibase.com.tr/tr/aso) sürecinde retention coherence'ı metadata'nın uzun vadeli ROI'sini belirliyor.

## Kategori Seçimi ve Cross-Promotion Etkisi

App Store Türkiye'de "Oyunlar" kategorisinde 23 alt kategori var. Oyunun primary category'si değiştirilemez (yayın sonrası) ama secondary category ayda 1 değiştirilebilir. Bu stratejik araç — örneğin bir tower defense oyunu primary "Strateji", secondary "Aksiyon" kategorisinde olabilir. Secondary'yi mevsimsel değiştir: yaz aylarında "Macera", kış aylarında "Strateji" — kullanıcı davranışı mevsime göre değişiyor (Türkiye'de yaz aylarında casual game tercihi %18 artıyor).

Kategori seçimi keyword weight'i etkiliyor. "Strateji" kategorisindeki bir oyun için "strateji" keyword'ü fazla competitive — herkes kullanıyor. Bunun yerine sub-niche keyword kullan: "turn-based strateji", "hex grid savaş". Kategori zaten genel intent'i belirliyor, metadata spesifik olmalı.

Cross-promotion metadata'ya dolaylı etki ediyor. Eğer oyunun aynı developer'dan birden fazla oyunu varsa Apple "Geliştirici Sayfası"nda bundle gösteriyor. Kullanıcı bir oyunun sayfasından diğerine geçiyor. Burada metadata consistency önemli — tüm oyunlarda aynı tonal language kullan ("Türkçe", "ücretsiz" gibi core descriptor'lar ortak olmalı). Ama keyword kannibalizasyonuna dikkat: iki oyun aynı keyword'e optimize olursa birbirinin impression'ını yiyorlar. Biri "kale savunma", diğeri "tower defense" kullansın — farklı intent'leri yakala.

## Çıkarım: Metadata Mühendisliği

Türkçe pazarda ASO lokalizasyondan öte metadata mühendisliği. Intent mapping ile başla — kullanıcı ne arıyor, neden arıyor, hangi context'te arıyor. Semantic field'ı kültürel modifier ile zenginleştir ama yasal/platform sınırlarını bil. Voice search için long-tail keyword ekle ama natural phrase readability'yi koru. A/B test ile hypothesis doğrula, CPP hızlı iterasyon için kullan, core metadata'yı retention coherence ile optimize et. Kategori seçimi ve cross-promotion ile ecosystem-level strateji kur. Türkiye tier-2 pazar ama tier-1 complexity taşıyor — metadata'yı buna göre kurgula.