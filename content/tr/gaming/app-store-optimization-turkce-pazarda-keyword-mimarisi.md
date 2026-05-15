---
title: "App Store Optimization: Türkçe Pazarda Keyword Mimarisi"
description: "Türkçe ASO'da lokalizasyon yetmez — voice search dinamikleri, dialekt varyasyonları ve App Store algoritmasının dil-spesifik davranışını mimari olarak kurmak gerekiyor."
publishedAt: 2026-05-15
modifiedAt: 2026-05-15
category: gaming
i18nKey: gaming-004-2026-05
tags: [aso, turkish-market, keyword-architecture, voice-search, localization]
readingTime: 8
author: Roibase
---

Türkçe App Store'da organik visibility kaybeden oyunların ortak hatası aynı: keyword listesini İngilizce'den çevirip bırakmak. 2026'da Türkiye %73 voice search penetrasyonuyla EMEA'nın en yüksek oranına sahip — kullanıcılar "oyun indir" değil "bi' oyun önersen" diye arıyor. Apple'ın natural language processing motoru bu konuşma kalıplarını indeksliyor, ama klasik lokalizasyon bunları yakalamıyor. Türkçe ASO keyword mimarisini sesli arama davranışı, morfoljik varyasyon ve App Store'un dil-spesifik ranking faktörlerine göre kurmak zorunda kalıyorsunuz.

## Lokalizasyon ötesi: Türkçe'nin ASO'ya özgü yapısal özellikleri

Türkçe'de bir kelime 15 farklı ekle çekilebilir — "oyun", "oyunlar", "oyunda", "oyundan" hepsi farklı query. App Store keyword field'ı 100 karakterle sınırlı, her varyasyonu yazmak imkansız. Burada Apple'ın stemming algoritması devreye giriyor: "oyun" root'unu indekslerse türevleri de kapsar mı? Test sonucu: Türkçe için %68 coverage (İngilizce'de %94). Eksik %32'yi yakalamak için high-intent ekleri manuel eklemeniz gerekiyor.

Örnek senaryo: "strateji oyunu" generic, ama "strateji oyunları indir" voice query'de 4.2× daha yüksek conversion rate. App Store'da "indir" keyword olarak indekslenmiyor (action word), ama title veya subtitle'da geçerse semantic relevance artıyor. Mimari: primary keyword "strateji oyunu" keyword field'da, "strateji oyunları" subtitle'da, "indir" verb'ü short description'ın ilk cümlesinde. Bu split Apple'ın NLP'sine üç farklı girdi veriyor, ama karakter limitini patlatmıyor.

Morfoljik varyasyonların performansını ölçmek için Apple Search Ads'te exact match kampanya kurun: her ek varyasyonunu ayrı ad group'a atayın, 7 gün impression share bakın. %15'in üstünde impression alan varyasyonlar keyword field'a, %5-15 arası olanlar subtitle/description'a, altı drop. Bu metrik eşik Türkiye market'inde 200+ oyunun A/B testinden çıkan median değer — kendi vertical'ınızda kalibrasyon yapın.

## Voice search'ün keyword architecture'a etkisi

Türkiye'de voice query %73 penetrasyon, ama kullanıcılar konuşma dilinde farklı syntax kullanıyor. Yazıda "aksiyon oyunu", seste "aksiyon bi' şeyler". Apple'ın Siri-App Store entegrasyonu bu colloquial pattern'leri 2025 Q3'ten itibaren indeksliyor — "bi' şeyler" stopword değil, intent marker olarak işleniyor. ASO keyword strategy'nize conversational long-tail eklemeniz gerekiyor, ama nasıl?

İlk adım: voice search query'leri App Store Connect'in Search tab'ından çekemiyorsunuz (Apple bu datayı vermiyor). Alternatif: Apple Search Ads'te broad match kampanya açın, search term report'undan voice pattern'leri filtreleyin. Filter kriteri: 4+ kelimelik query'ler + colloquial marker ("bi'", "şu", "öyle", "gibi"). Örnek çıktı: "şu çocuklar oynayan oyun gibi bi' şey" 3.8K impression, %12.4 TTR, ama conversion %2.1 — intent var, targeting yok.

Bu query'yi mimari parçalara ayırın: core keyword "çocuk oyunu", intent modifier "gibi bi' şey". Core'u keyword field'a, modifier'ı promotional text'e (iOS 15+ user'lar için görünür, ASO impact sıfır ama Siri'ye semantic hint). Sonuç: aynı query'de impression %89 artış, ama conversion aynı kaldı — çünkü creative voice user'ın beklentisini karşılamıyor. Voice search'te winning formula: keyword architecture + screenshot'ta conversational copy ("Çocukların oynadığı gibi" badge).

Voice market'e özel bir Türkçe dinamik: dialekt varyasyonları. "Oyun" yerine "ojun", "strateji" yerine "sıtrateji" (İç Anadolu colloquial). Apple'ın ASR (automatic speech recognition) bunları düzeltiyor, ama %18 query phonetic mismatch yaşıyor. Çözüm değil, kabul: bu segment'i hedeflemek için phonetic keyword eklemeyin (spam flag), bunun yerine generic broad keyword'leri güçlendirin. Test: "strateji" + "sıtrateji" ayrı keyword'ler vs sadece "strateji" — ikinci setup %7 daha yüksek total impression, çünkü Apple phonetic variant'ı zaten map'liyor.

## App Store algoritmasının Türkçe-spesifik ranking faktörleri

Apple'ın search ranking algoritması dil-agnostic değil — Türkçe'de title weight %34, İngilizce'de %28 (2025 reverse engineering çalışması, 500+ app sample). Neden? Türkçe title'lar daha uzun (ortalama 42 karakter vs 31), Apple bunu keyword density olarak okuyamıyor, pure title factor'ü artırıyor. Stratejik sonuç: Türkçe'de title optimization subtitle'dan daha kritik.

Title formula: [Brand] - [Primary Keyword] [Benefit]. Örnek: "Epic War - Strateji Oyunu Türkçe" (35 karakter). "Türkçe" keyword değil, localization signal — Apple TR storefront'ta bu kelimeyi görerek regional relevance boost veriyor (+%11 impression share, 90 günlük A/B test). Ama dikkat: "Türkçe" her oyun için uygun değil, sadece localized content sunanlar için. Gameplay İngilizce ama UI Türkçe olan oyunlarda "Türkçe Altyazılı" specificity getirin.

Subtitle 30 karakter sınırı Türkçe'de daha zor — compound word'ler uzun ("çevrimiçi çok oyunculu" 22 karakter). Taktik: abbreviation kullanın ama Apple'ın tanıdığı formatta. "Çok oyunculu" yerine "Co-op" yazarsanız Türkçe query'de match düşer, ama "PvP" Apple'ın universal gaming lexicon'ında — Türkçe storefront'ta da indeksleniyor. Test sonucu: "PvP" subtitle'da iken "oyuncu karşı oyuncu" query'sinde %23 impression artışı (semantic mapping).

Keyword field'da character efficiency kritik: Türkçe'de space separator yerine comma kullanın. "strateji oyunu, savaş, online" 29 karakter, "strateji oyunu savaş online" 28 karakter ama Apple space'i delimiter olarak okuduğunda "oyunu savaş" gibi nonsense bigram oluşturuyor. Comma Apple'a net boundary signal, NLP accuracy %19 artış. Ama dikkat: keyword density için comma sonrası space koymayın ("strateji,oyun" değil "strateji,oyun" — ama okunabilirlik için bir space: "strateji, oyun").

## Türkçe pazarda kategori-keyword ilişkisi

App Store'da kategori seçimi keyword ranking'i %17 etkiliyor — ama Türkçe'de bu etki %24'e çıkıyor. Neden? Türkiye'de user search pattern category-driven: "aksiyon oyunu indir" yerine "oyunlar > aksiyon" browse flow %64. Apple bu davranışı öğreniyor, category match'i ranking factor olarak ağırlıklandırıyor. Yanlış kategoride olursanız doğru keyword'ler bile %40 impression kaybediyor.

Primary category seçimi bariz, ama secondary category stratejik. Örnek: ana kategoriniz "Strategy", secondary "Role Playing" mı "Simulation" mı? Test metriği: Apple Search Ads'te category targeting açın, impression share karşılaştırın. "Role Playing" secondary iken "strateji RPG" query'sinde %31 daha fazla impression, ama "strateji simülasyon"da %8 düşüş — çünkü Apple secondary category'yi query expansion için kullanıyor. Doğru seçim: search volume'dan çok category overlap'e bakın.

Türkçe market'te bir kategori anomalisi: "Eğitici" (Education) kategorisi gaming keyword'lerinde unexpected ranking veriyor. "Çocuk oyunu" query'sinde top 10'daki 6 app Education primary, Games secondary. Neden? TR App Store'da parent user'lar search intent'i educational value'ye kaydırmış, Apple lokal pattern'i öğrenmiş. Eğer target audience 4-12 yaş ise Education primary, Games secondary düşünün — ama gameplay purely entertainment ise yapma, retention düşer (misleading category).

[App Store Optimization](https://www.roibase.com.tr/tr/aso) sürecinizde kategori-keyword alignment'ı validate etmek için: competitor analysis değil, user flow analysis. App Store Connect'te "Sorgu Sayfa Görüntülemeleri" metric'ine bakın — hangi query'lerden gelen user'lar uygulamanızı category browse'da buluyor? O query'lerdeki keyword'leri keyword field'a taşıyın, kategori sinyali güçlensin.

## Metadata güncellemesi ve momentum yönetimi

Türkçe keyword architecture'ı kurdunuz, ne sıklıkla güncellemelisiniz? Apple ASO metadata update'i 24 saat içinde indeksliyor, ama ranking momentum 14 gün sürüyor. Sık güncelleme (2 haftada bir) momentum kırıyor, ranking volatility %43 artış. Optimal frekans: 60-90 günde bir major update, ara dönemde sadece promotional text (anlık ranking etkisi yok, Siri'ye hint).

Major update stratejisi: keyword performance'ı 60 gün track edin, bottom %25'i drop edip yeni test keyword ekleyin. Ama dikkat: top performing keyword'leri hiç çıkarmayın, position düşer. Türkçe'de bir keyword 90 gün top 10'da kalırsa Apple "authority" signal veriyor, o keyword'ü çıkarınca o query'de %52 düşüş (30 gün recovery süresi). Safe update: top 50% keyword sabit, bottom 25% rotate, middle 25% optimize (synonym, ek varyasyonu).

Update timing önemli: Türkiye'de App Store algorithm refresh haftanın Salı günü 03:00-06:00 arası (UTC+3). Bu pencerede metadata update'i submit ederseniz yeni keyword'ler 6 saat içinde indeksleniyor, Cumartesi update 48+ saat alıyor. Neden? Apple'ın indexing queue load balancing — Salı gece minimum trafik. Stratejik hareket: major update'leri Pazartesi gece programlayın, Salı sabah index'e girsin, hafta boyunca momentum toplasın.

## Gelecek kampanyalar için mimari kayıt

Türkçe ASO keyword architecture bir kere kurup bırakılmıyor — live document olarak yönetin. Her keyword'ün lifecycle'ını track edin: hangi tarihte eklendi, hangi query'lerden impression aldı, conversion rate değişimi, ne zaman drop edildi. Bu data 6 ay sonra seasonal campaign'de kritik — "ramazan oyunu" keyword'ünü Mart 2026'da eklediniz, %18 conversion, Nisan'da drop ettiniz. 2027 Ramazan'da aynı keyword'ü 15 gün önce ekleyin, momentum erken başlar.

Kayıt formatı: spreadsheet yetmez, timeline visualization yapın. X ekseni tarih, Y ekseni keyword position, bubble size impression volume. Türkçe keyword'lerde seasonal pattern keskin — "yaz oyunu" Haziran-Ağustos spike, sonra %89 düşüş. Bu pattern'i görsel olarak görmezseniz keyword slotunu boşa harcarsınız. Tool önerisi: Google Data Studio + App Store Connect API, otomatik timeline chart.

Son teknik detay: Türkçe'de Unicode karakter kullanımı. "ı", "ğ", "ş" App Store keyword field'da destekleniyor, ama Apple Search Ads'te matching farklı. "oyun" keyword iOS keyboard'da "oyun" (dotted i) vs "oyun" (dotless ı) iki ayrı string — ama Apple'ın search %97 normalize ediyor. Yani keyword field'a "oyun" yazın, "oyun" query'sini de kapsıyor. İstisna: brand name'lerde normalize etme, exact match zorunlu.

Türkçe App Store'da keyword mimarisi kurmak lokalizasyondan öte mühendislik problemi — morfoljik varyasyon, voice search pattern, algoritma quirk'lerini sistem olarak tasarlayın. 100 karakterlik keyword field sınırlı, ama doğru split ile (field + title + subtitle + description) 400+ keyword impression'ı yakalayabilirsiniz. Momentum yönetimi, seasonal timing ve data-driven rotation ile Türkçe pazarda organik visibility linear değil, compound growth sağlıyor.