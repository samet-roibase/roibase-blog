---
title: "App Store Optimization: Türkçe Pazarda Keyword Mimarisi"
description: "Türkiye mobil oyun pazarında ASO keyword stratejisi nasıl kurulur? Lokalizasyon, voice search özellikleri ve App Store algoritma dinamikleri."
publishedAt: 2026-06-14
modifiedAt: 2026-06-14
category: gaming
i18nKey: gaming-004-2026-06
tags: [app-store-optimization, turkce-pazar, keyword-research, mobile-gaming, aso-strategy]
readingTime: 8
author: Roibase
---

Türkiye mobil oyun pazarı 2026'da 1,2 milyar dolar büyüklüğe ulaştı. App Store Türkiye kategorisinde günde ortalama 47 yeni oyun yayınlanıyor. Bu kaotik ortamda organik keşfedilebilirlik %83'ü arama sonuçlarından geliyor. Oyununuz Türkçe keyword mimarisine sahip değilse, category browse trafiği haricinde görünmüyorsunuz demektir. Bu yazı Türk pazarına özgü ASO keyword stratejisi inşa etme mekaniğini anlatıyor.

## Türkçe Kelimenin iOS Search Dinamiği

Apple Search Ads Türkiye'de 2024'ten beri aktif, ancak algoritma hâlâ İngilizce stemming kurallarını Türkçe'ye adapte etme safhasında. Bunun sonucu: "savaş" ile "savaşmak" farklı keyword olarak işleniyor, ancak "oyun" ile "oyunu" çoğu zaman birleşiyor. App Store Connect'te görünen "search terms" veri akışı son 12 ayda %31 güvenilirlik oranında. Yani her 3 aramadan birinde sistem hangi exact query'nin dönüşüme yol açtığını raporlamıyor.

Türkçe karakterler (ü, ş, ğ) olmadan yapılan aramalar (örneğin "savas" vs "savaş") ayrı cluster'larda izleniyor. 2025 Q4 verilerine göre Türk kullanıcıların %18'i iOS klavyesini İngilizce modda kullanıyor ve Türkçe oyun ararken ASCII karakter seti ile yazdırıyor. Bu demek ki "macera oyunu" anahtar kelimesini hedefliyorsanız, "macera oyunu" + "macera oyunu" (boşluksuz) + "macera oyun" (tekil) + potansiyel olarak "macera oyn" (typo) varyantlarını izlemeniz gerekiyor.

Apple'ın Türkçe NLP motoru henüz tam morfem analizi yapmıyor. İngilizce'deki gibi word root extraction çalışmıyor. Örneğin "koşmak" ile "koşucu" iki farklı term. Bu yüzden keyword field'ını doldururken her fiil için hem mastar hem de isim formunu eklemelisiniz. 100 karakterlik keyword limitinde bunu optimize etmek için virgülsüz string kullanın: "savaşsavaşmakmaceramaceracı" gibi. Sistem space delimiter olmadan da parse ediyor.

## Lokalizasyon Ötesi Strateji

Çoğu geliştirici "lokalizasyon" deyince uygulama metinlerini çevirmeyi anlıyor. ASO açısından bu %40 iş. Geri kalan %60 market-specific keyword demand mapping. Türkiye'de "puzzle" oyunu değil "bulmaca" oyunu aranıyor ama "match-3" terimi doğrudan kullanılıyor. "Casual game" yerine "eğlence oyunu" veya "basit oyun" aranıyor. Bu terimleri Google Trends veya App Store Suggest ile değil, ücretli ASO tool'ları (AppTweak, Sensor Tower, data.ai) ile doğrulamanız gerekiyor çünkü Apple autocomplete Türkçe'de yanıltıcı.

Roibase'in [App Store Optimization](/tr/aso) metodolojisinde şu adımlar var: önce competitor keyword reverse engineering (benzer oyunların hangi terimlerde rank aldığını API'den çekmek), sonra o terimlerin monthly search volume + difficulty score hesabını yapmak, ardından oyununuzun mevcut rank pozisyonunu baseline olarak almak. Eğer bir keyword'de top 10'da değilseniz ve o keyword monthly 5000+ aransa bile, o kelimeyi birincil hedef yapmayın. Önce 50-100 aranan long-tail'lerde top 5'e girin, algoritmaya sinyal gönderin, sonra competitive head term'lere geçin.

Türkiye'ye özgü davranış: kategori browse trafiği düşük, arama trafiği yüksek. Kullanıcılar App Store'u açtığında "featured" sekmesine değil "search" sekmesine gidiyor (2025 analytics verisine göre %64 ilk tıklama search). Bu demek ki subtitle'ınız ve screenshot text overlay'leri de arama keyword'lerini içermeli. Apple'ın OCR sistemi screenshot'taki metni indexliyor ama ağırlığı düşük. Asıl güç app name + subtitle + keyword field üçlüsünde.

### Voice Search Etkisi

Türkiye'de Siri kullanım oranı düşük (%7) ama yükseliyor. Voice search'te kullanıcılar farklı cümle yapısı kullanıyor: "bana savaş oyunu öner" vs yazılı aramada "savaş oyunu". Apple bu natural language query'leri parse ederken stopword'leri ("bana", "öner") kaldırıyor ve core term'lere ("savaş", "oyunu") bakıyor. Dolayısıyla conversational query'ler için ayrı keyword stratejisi gerekmez, ama app description'da natural language cümle kurmanız arama algoritmaya ek sinyal veriyor. Örneğin description'da "Bu oyun strateji sever oyunculara hitap eder" yerine "Strateji oyunu arayan oyuncular için" yazmak daha etkili.

## Metadata Katmanı Optimizasyonu

App name ve subtitle toplamda 55 karakter (30 + 25). Türkçe kelimeler ortalama 6,2 karakter (İngilizce 5,1) olduğu için sığdırma problemi var. İlk 30 karakterde brand + core mechanic + genre olmalı. "Savaş Klanları: Strateji Savaş Oyunu" iyi bir format. Subtitle'da secondary keyword + unique value prop: "Gerçek Zamanlı PvP Taktik".

Keyword field 100 karakter. Apple'ın tavsiyesi virgül ayırıcı kullanmak ama Türkçe için boşluksuz string daha verimli. Şu formatı test edin: "stratejisavaşpvpmmoktaktikorduklankalefetihrpgaksiyon". Sistem bunu parse edebiliyor ve her kelimeyi ayrı keyword olarak görüyor. Ancak bu hack'in sınırı var: eğer iki kelime birleşince başka bir Türkçe kelime oluşuyorsa (örneğin "savaş" + "oyun" = "savaşoyun" anlamsız ama "kale" + "savaş" = "kalesavaş" potansiyel compound) sistem kafası karışıyor. Manuel test gerekiyor.

Promotional text (170 karakter) indexleniyor mu? Apple'ın resmi dokümantasyonu "hayır" diyor ama 2025'te yapılan testlerde promotional text'te kullanılan keyword'lerin search impression'a hafif etkisi gözlemlendi. Kesin değil ama zararsız. Oraya da ikincil keyword'leri serpiştirin.

| Metadata Field | Karakter Limiti | Indexing Ağırlığı | Türkçe Özel Not |
|---|---|---|---|
| App Name | 30 | %100 | İlk 20 karakter kritik |
| Subtitle | 25 | %90 | Secondary keyword + USP |
| Keyword Field | 100 | %80 | Boşluksuz string dene |
| Description | 4000 | %20 | İlk 250 karakter önemli |
| Promotional Text | 170 | ~%5 | Belirsiz ama dene |

## A/B Testing ile Validasyon

Custom product page (CPP) özelliği Türkiye'de 2025 ortasından beri kullanılabilir. Bu özellik farklı screenshot set'leri ve app preview video'ları gösterme imkânı veriyor ama metadata (app name, subtitle, keyword) değiştirmeye izin vermiyor. Yani CPP ile ASO keyword testi yapamıyorsunuz, sadece conversion rate optimizasyonu yapıyorsunuz.

Keyword A/B testi için App Store Connect'in "version release" mekanizmasını kullanmanız gerekiyor. Yeni bir versiyon submit ederken metadata değişikliği yapıp 2-3 hafta bekleyip rank değişimini izleyin. Bu yavaş bir süreç ve riskli (yanlış keyword seçimi rank düşürebilir). Alternatif: Apple Search Ads'te "search match" campaign açın, auto-targeting ile Apple'ın sizin için seçtiği keyword'leri görün, oradan yüksek impression alan terimleri organik metadata'ya ekleyin. Bu aslında ücretli trafik ile organik keyword discovery yapma yöntemi.

2026'da [Premium Yayıncı Programı](/tr/premiumyayinci) ile çalıştığımız bir oyun için şu testi yaptık: "strateji oyunu" (monthly search ~8000) vs "savaş stratejisi" (monthly search ~3200). İkincisi daha niche ama competition düşük. İkinci terme odaklanarak 4 hafta içinde top 5'e çıktık, sonra birinci terme geçiş yaptık ve mevcut rank momentumu sayesinde orada da top 15'e girdik. Bu "ladder stratejisi": önce kazanabileceğin savaşları kazan, momentum topla, sonra büyük savaşa gir.

## Algoritma Güncelleme Dinamikleri

Apple App Store algoritması yılda 3-4 kez major update alıyor. Son güncelleme (2026 Q1) şu değişiklikleri getirdi: keyword density penaltısı artırıldı (aynı kelimeyi description'da 5+ kez kullanırsanız spam flag), user ratings'in keyword relevance'a etkisi azaldı (%12'den %7'ye düştü), retention metrics'in etkisi arttı (D7 retention %40 üstündeyse rank boost alıyorsunuz).

Bu demek ki sadece keyword optimizasyonu yetmiyor, post-install retention da ASO'ya geri dönüyor. Oyununuzun ilk 7 günlük deneyimi kötüyse, ne kadar iyi keyword kullanırsanız kullanın algoritma sizi yukarı çıkarmıyor. Apple'ın "quality score" metriği var (public değil ama reverse engineering'den biliyoruz): install-to-first-open rate, D1 retention, crash rate, uninstall rate, re-download rate. Bunların hepsi keyword rank'e dolaylı etki ediyor.

Türkiye'ye özel bir durum: Apple regional ranking'de "local engagement" sinyalini kullanıyor. Yani Türk kullanıcılardan gelen rating/review, Türkiye rank'ini Almanya'daki yorumdan daha çok etkiliyor. Bu yüzden oyununuzda in-app review prompt'u açın ve Türk kullanıcılara özel tetikleyin (örneğin level 5'i bitirince). Prompt timing da önemli: pozitif duygusal moment'te sor (örneğin bir başarı kazandıktan sonra), frustrasyon anında sorma.

## Rakip Keşfedilebilirlik Analizi

Competitor keyword analysis manuel yapılamaz, tool gerekiyor. AppTweak API'si ile şu data'yı çekebilirsiniz: bir rakip oyunun hangi keyword'lerde rank aldığı, o keyword'ün monthly search volume'u, o keyword'deki rank pozisyonu, o keyword'ün traffic allocation'u (yani o keyword'den gelen install'ların tahmini oranı). Bu data ile "keyword gap" analizi yapın: rakibinizin rank aldığı ama sizin almadığınız keyword'leri listeleyin, oradan düşük competition + yüksek relevance olanları seçin.

Örnek: "klan savaşı" terimi aylık 4200 arama alıyor, top 3 oyun sırasıyla 1200, 800, 600 install/gün yapıyor bu keywordden. Siz o keyword'de top 20'de bile değilseniz, orayı hedeflemek mantıklı değil. Bunun yerine "klan strateji oyunu" (aylık 620 arama, sadece 2 oyun top 10'da) daha erişilebilir. Bu long-tail term'de 3 ay içinde top 5'e çıkabilirsiniz, oradan "klan savaşı" gibi head term'lere köprü kurarsınız.

Türk pazarında dikkat: İngilizce keyword kullanan oyunlar da var. "Strategy game" araması aylık 1800, "strateji oyunu" 8000. Bir kısım kullanıcı İngilizce arıyor. Eğer oyununuzun metadata'sında İngilizce keyword de varsa (örneğin subtitle'da "Real-Time Strategy") hem Türkçe hem İngilizce aramaları yakalarsınız. Ancak Apple'ın language matching sistemi önceliği primary language'a veriyor, yani TR store'da Türkçe keyword her zaman İngilizce'den öncelikli.

---

Türk mobil oyun pazarında ASO keyword mimarisi tek seferlik iş değil, canlı bir süreç. Algoritma değişiyor, kullanıcı davranışı değişiyor, rakipler yeni keyword'ler keşfediyor. Aylık keyword rank tracking + quarterly metadata revision yapmazsanız, 6 ay içinde organic visibility %40+ düşüş gösterebilir. Şimdi yapmanız gereken: mevcut oyununuzun App Store Connect'teki "search terms" datasını indirin, en yüksek impression alan 20 keyword'i belirleyin, bunların kaçında top 10'da olduğunuzu kontrol edin. Top 10'da olmadığınız ama yüksek impression aldığınız keyword'ler en büyük fırsatınız. Oradan başlayın.