---
title: "Async-First İçin İşe Alım: Pratik Filtreler ve Mülakat Yapısı"
description: "Trial week, yazılı değerlendirme, senkron önyargısını ortadan kaldırma — asenkron ekip kültürü için işe alım sürecini yeniden tasarlamak"
publishedAt: 2026-06-01
modifiedAt: 2026-06-01
category: lifestyle
i18nKey: lifestyle-005-2026-06
tags: [async-first, işe-alım, uzaktan-çalışma, ekip-kültürü, bilgi-işçiliği]
readingTime: 8
author: Roibase
---

Klasik mülakat yapısı senkron iletişime optimize edilmiş: 45 dakikalık Zoom, whiteboard challenge, "hemen cevap ver" baskısı. Async-first ekip kuruyorsan bu süreç yanlış sinyalleri ölçüyor. Hızlı konuşma = kaliteli düşünce değil. Sessiz kalma = bilgisizlik değil. Roibase'de 8 yıldır uzaktan çalışıyoruz, son 3 yılda tamamen async yapıya geçtik — işe alım sürecimiz 4 kez yeniden tasarlandı. Bu yazıda pratik filtreleri, trial week mekanizmasını ve senkron önyargısını nasıl ortadan kaldırdığımızı paylaşıyorum.

## Senkron mülakat neden async ekip için yanıltıcı

Klasik mülakat formatında aday 45 dakikada kendini tanıtmaya çalışır, mülakat ekibi o anki performansa göre karar verir. Bu format, extroverted iletişime ödül verir — ama async ekipte kritik yetenek başka: yazılı bağlam kurma, belirsizlikte özerk karar verme, asenkron feedback döngüsüne uyum.

Roibase'de 2023'te yapılan son 12 işe alımda şu korelasyonu gördük: mülakat skoru yüksek ama ilk 90 günde Linear ticket verimliği düşük olan 3 kişi vardı. Ortak özellik: senkron toplantılarda başarılı, ama Asana/Linear yorumunda bağlam eksik, Slack thread'de 12 saat gecikme. Ters örnekler de var — mülakata çekingen ama yazılı RFC'si (change request) mükemmel olan 2 kişi, 6 ayda ekibin en yüksek code review approval rate'ine sahip oldu.

Bu fark şuradan geliyor: senkron ortamda "hızlı cevap" ödülü var, asenkron ortamda "düşünülmüş cevap" ödülü var. Mülakat formatı birincisini ölçüyor, günlük iş ikincisini gerektiriyor. Bu uyumsuzluğu ortadan kaldırmak için işe alım pipeline'ını asenkron sinyallere göre yeniden tasarladık.

## İlk filtre: CV değil, yazılı değerlendirme

CV ekranı yapıyoruz ama asıl filtremiz ilk aşamada 2 saatlik yazılı değerlendirme. Aday açık uçlu 3 soruya yazılı cevap veriyor — Google Doc'ta, 48 saat içinde, kaynak kullanabilir.

Örnek sorular (ürün müdürü için):
- "Bir özellik piyasaya çıkardınız, ilk hafta benimseme %3'te kaldı. Hangi metriklere bakarsınız, neyi değiştirmeyi test edersiniz? Kararı nasıl dokümante edersiniz?"
- "Asenkron ekipte ürün yol haritası nasıl şekillendirilmeli? Linear milestone, Notion RFC, Slack anketi — hangisi ne amaçla kullanılır?"
- "Mühendislik ekibi 'bu özellik teknik borç yaratır' diyor, kurucu ekip 'gelire direkt etkisi var' diyor. Asenkron ortamda bu çatışmayı nasıl çözersiniz?"

Değerlendirme kriterleri:
- **Yapısal netlik:** Başlıklar, madde işaretleri, bölümler kullanıyor mu?
- **Bağlam kurma:** Varsayımları açık mı yazıyor, belirsizlikleri tanımlıyor mu?
- **Kaynak disiplini:** Kendi deneyimi mi, okuduğu kaynak mı — ayrımı net mi?
- **Özerklik sinyali:** "Sana sormalıyım" yerine "şu 3 senaryoda şöyle karar veririm" diyor mu?

2024'te 47 aday yazılı değerlendirmeye girdi, 12'si geçti. 12'nin 10'u final işe alıma kadar geldi — yani false positive oranı %17. CV filtresinde bu oran %60 civarındaydı. Yazılı değerlendirme, asenkron yeteneği doğrudan ölçüyor.

### Teknik roller için kod challenge yerine RFC review

Developer işe alımında whiteboard challenge yapmıyoruz. Onun yerine gerçek bir RFC (yapısal karar kaydı) veriyoruz, adaya "bu tasarımı değerlendir, alternatif öner, tradeoff'ları yaz" diyoruz. GitHub yorum formatında, markdown, 4 saat süre.

Örnek RFC: "PostgreSQL'den BigQuery'ye ETL pipeline — dbt + Airflow vs Fivetran. Hangisi bizim için uygun?" Aday hem teknik analiz yapıyor, hem de asenkron code review kültürüne uygun yazıyor. Sonuç: ilk 30 günde code review kalitesi %40 daha yüksek çıktı (2025 kohortu).

## Trial week: Gerçek iş, gerçek gözlem

Yazılı değerlendirmeyi geçen adaya ücretli trial week öneriyoruz (brüt maaşın 1/4'ü, 20 saat). Aday bir gerçek proje alıyor — production değil ama production-adjacent. Linear'da ticket, Slack'te channel, Notion'da bağlam dökümanı.

Trial week kuralları:
- **Sadece asenkron:** Zoom yok, Loom video veya yazılı güncelleme
- **Özerk kapsam:** "Bunu yap" değil, "bu problemi çöz, nasıl yapacağın sana kalmış"
- **Gerçek feedback döngüsü:** Ekip üyeleri asenkron yorum yapıyor, aday revize ediyor

Gözlem kriterleri:
1. **İlk 24 saatte soru kalitesi:** Belirsizliği tanımlıyor mu, yoksa "ne yapayım" mı soruyor?
2. **48 saatte ilk commit/draft:** Mükemmellik tuzağına düşmeden iterasyon başlatıyor mu?
3. **72 saatte asenkron feedback'e tepki:** Savunmaya geçiyor mu, yoksa "anladım, şunu değiştiriyorum" mu?
4. **Son gün çıktısı:** Kapsam genişlemesi yapmadan, net sonuç veriyor mu?

Trial week'te %30 aday başarısız oluyor — ama bu erken başarısızlık, 90 günlük deneme dönemindeki başarısızlıktan çok daha ucuz. 2025'te trial week yapan 15 adayın 10'u tam zamanlı geçti, 10'un 9'u 12 ay sonra hala ekipte — retention %90.

## Senkron önyargısını ortadan kaldırmak: Sessiz mülakat

Trial week sonrası final mülakat yapıyoruz ama formatı ters çevirdik: "sessiz mülakat". 30 dakika, aday konuşmuyor — sorularımızı önceden Google Doc'ta gönderiyoruz, aday yazılı cevaplıyor, mülakat sırasında sadece okuyoruz, ek sorularız sorarız.

Bu format 3 şeyi test ediyor:
- **Hazırlık disiplini:** Yazılı cevap hazırlamak, spontane konuşmaktan daha fazla düşünce gerektirir
- **Yoğunlaştırma:** Uzun söylem yerine net öz kurabilme
- **Asenkron empati:** Karşı taraf okuyacak, o yüzden netlik kritik

Örnek soru: "İlk 90 günde neyi başarı sayarsın? Metrikleri yazılı olarak belirt." Cevap "adapte olmak" değil, "Linear'da ilk RFC'mi merge ettirmek, code review döngü süresini 24 saate düşürmek, 3 stakeholder'la asenkron hizalama kurmak" olmalı.

Sessiz mülakat sonrası 15 dakika asenkron soru-cevap yapıyoruz — ama çoğunlukla adayın bize soruları için. Bu formatta 2024'te 8 final mülakat yaptık, 7'si işe alıma döndü, 1 kişi kendi başına vazgeçti (asenkron çalışmaya hazır değilmiş).

## Onboarding'de asenkron disiplin güçlendirme

Işe alım kararı verdikten sonra asenkron çalışma kasını güçlendirmek için ilk 30 günde zorunlu pratikler koyuyoruz:

| Gün | Aktivite | Ölçüm |
|-----|----------|-------|
| 1-7 | Notion handbook'u oku, 10 soru sor (yazılı) | Soru kalitesi (belirsizlik vs bilgi teyidi) |
| 8-14 | İlk Linear ticket: dokümantasyon güncelleme | Commit message netliği, PR açıklaması |
| 15-21 | İlk asenkron RFC yaz (küçük kapsam) | Peer review yorum sayısı, onay süresi |
| 22-30 | Başka ekibin RFC'sine değerlendirme yaz | Yapıcı geri bildirim sinyali |

Bu yapı asenkron kas geliştiriyor — 30. günde kod yazan developer bile "yazılı bağlam" kasını güçlendirmiş oluyor. Roibase'de [markalaşma & marka kimliği](https://www.roibase.com.tr/ru/branding) çalışmalarında da benzer disiplin var: marka sesi, kılavuz, ton-of-voice dökümanı — hepsi asenkron hizalama aracı.

## Karşı argüman: Asenkron işe alım yavaş mı?

Evet, klasik pipeline'dan 2 hafta daha uzun sürüyor. Yazılı değerlendirme 48 saat, trial week 5 gün, sessiz mülakat 1 hafta hazırlık. Ama bu süre, yanlış işe alımdan kaynaklı 6 aylık kayıp zamanın yanında minimal. Roibase'de 2022'de senkron pipeline ile işe alınan 2 kişi, 4. ayda ayrıldı — hatalı işe alımın maliyeti: ~€40K (maaş + ekip bozulmasu). 2024'te asenkron pipeline ile işe alınan 7 kişi, 12. ayda hala ekipte — doğru işe alımın maliyeti: ilk yatırım + artan değer.

Diğer eleştiri: "Hızlı hareket eden startup'ta asenkron işe alım lüks." Yanıt: hızlı hareket = hızlı işe alım değil, doğru işe alım. Asenkron ekip kuruyorsan, senkron pipeline ile filtre etmek mantık hatası — sinyalleri yanlış ölçüyorsun.

## Asenkron işe alımın ikincil etkileri

Bu yapıyı kurunca yan etkiler görürsün:
- **İşveren markası:** Aday havuzu değişiyor — "toplantı yapmadan çalışalım" diyen insanlar geliyor
- **Retention:** İlk 90 günde kültürel uyum %40 daha hızlı (2025 kohortu vs 2022)
- **Referral kalitesi:** Ekip üyeleri benzer asenkron kasına sahip arkadaşlarını öneriyor

Son 12 ayda Roibase'e gelen 23 başvurunun 9'u "asenkron-first işe alım süreci" araması yaparak geldi — pipeline'ın kendisi marka sinyali.

---

Asenkron ekip kurmak işe aldığın insanlarla başlamıyor — işe *alma şeklinle* başlıyor. CV ekranı, 45 dakikalık mülakat, "kültürel uyum" sezgisi — bunlar senkron çağın araçları. Yazılı değerlendirme, trial week, sessiz mülakat — bunlar asenkron çağın filtreleri. Süreç daha uzun ama sinyal kalitesi daha yüksek. 2026'da bilgi işçiliği tamamen asenkron'a kayarken, işe alım da kaymalı.