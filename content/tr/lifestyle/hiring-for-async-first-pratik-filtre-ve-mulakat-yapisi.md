---
title: "Hiring for Async-First: Pratik Filtre ve Mülakat Yapısı"
description: "Trial week, written assessment, sync ön-yargısını silme — asenkron ekip kültürü için işe alım sürecini yeniden tasarlamak"
publishedAt: 2026-06-01
modifiedAt: 2026-06-01
category: lifestyle
i18nKey: lifestyle-005-2026-06
tags: [async-first, hiring, remote-work, team-culture, knowledge-work]
readingTime: 8
author: Roibase
---

Klasik mülakat yapısı senkron iletişime optimize edilmiş: 45 dakikalık Zoom, whiteboard challenge, "hemen cevap ver" baskısı. Async-first ekip kuruyorsan bu süreç yanlış sinyalleri ölçüyor. Hızlı konuşma = kaliteli düşünce değil. Sessiz kalma = bilgisizlik değil. Roibase'de 8 yıldır uzaktan çalışıyoruz, son 3 yılda tamamen async yapıya geçtik — işe alım sürecimiz 4 kez yeniden tasarlandı. Bu yazıda pratik filtreleri, trial week mekanizmasını ve sync ön-yargısını nasıl kırdığımızı paylaşıyorum.

## Senkron mülakat neden async ekip için yanıltıcı

Klasik mülakat formatında aday 45 dakikada kendini satmaya çalışır, mülakat ekibi o anki performansa göre karar verir. Bu format extroverted communication'a ödül verir — ama async ekipte kritik yetenek başka: yazılı bağlam kurma, belirsizlikte özerk karar verme, async feedback döngüsüne uyum.

Roibase'de 2023'te yapılan son 12 işe alımda şu korelasyonu gördük: mülakat skoru yüksek ama ilk 90 günde Linear ticket throughput düşük olan 3 kişi vardı. Ortak özellik: senkron toplantılarda parlak, ama asana/linear comment'te bağlam eksik, slack thread'de 12 saat gecikme. Ters örnekler de var — mülakatta çekingen ama yazılı RFC'si (request for comment) mükemmel olan 2 kişi, 6 ayda ekibin en yüksek code review approval rate'ine sahip oldu.

Bu fark şuradan geliyor: senkron ortamda "hızlı cevap" premi var, async ortamda "düşünülmüş cevap" primi var. Mülakat formatı birincisini ölçüyor, günlük iş ikincisini gerektiriyor. Bu uyumsuzluğu kırmak için hiring pipeline'ı async sinyallere göre yeniden tasarladık.

## İlk filtre: CV değil, written assignment

CV ekranı yapıyoruz ama asıl filtremiz ilk aşamada 2 saatlik written assessment. Aday açık uçlu 3 soruya yazılı cevap veriyor — Google Doc'ta, 48 saat içinde, referans kaynak kullanabilir.

Örnek sorular (product manager için):
- "Bir özellik launch'ladınız, ilk hafta adoption %3'te kaldı. Hangi metriklere bakarsınız, neyi değiştirmeyi test edersiniz? Kararı nasıl dokümante edersiniz?"
- "Async ekipte product roadmap nasıl şekillendirilmeli? Linear milestone, Notion RFC, Slack poll — hangisi ne amaçla kullanılır?"
- "Engineering ekibi 'bu özellik teknik borç yaratır' diyor, founding team 'revenue'ye direkt etkisi var' diyor. Async ortamda bu çatışmayı nasıl çözersiniz?"

Değerlendirme kriterleri:
- **Yapısal netlik:** Başlıklar, bullet point, bölümler kullanıyor mu?
- **Bağlam kurma:** Varsayımları açık mı yazıyor, belirsizlikleri tanımlıyor mu?
- **Referans disiplini:** Kendi deneyimi mi, okuduğu kaynak mı — ayrımı net mi?
- **Özerklik sinyali:** "Sana sormalıyım" yerine "şu 3 senaryoda şöyle karar veririm" diyor mu?

2024'te 47 aday written assessment'a girdi, 12'si geçti. 12'nin 10'u final hiring'a kadar geldi — yani false positive oranı %17. CV filtresinde bu oran %60 civarındaydı. Written assessment, async yeteneği doğrudan ölçüyor.

### Teknik roller için code challenge yerine RFC review

Developer hiring'da whiteboard challenge yapmıyoruz. Onun yerine gerçek bir RFC (architectural decision record) veriyoruz, adaya "bu tasarımı review et, alternatif öner, tradeoff'ları yaz" diyoruz. GitHub comment formatında, markdown, 4 saat süre.

Örnek RFC: "PostgreSQL'den BigQuery'ye ETL pipeline — dbt + Airflow vs Fivetran. Hangisi bizim için uygun?" Aday hem teknik analiz yapıyor, hem de async code review kültürüne uygun yazıyor. Sonuç: ilk 30 günde code review kalitesi %40 daha yüksek çıktı (2025 kohortu).

## Trial week: Gerçek iş, gerçek gözlem

Written assessment'ı geçen adaya ücretli trial week öneriyoruz (gross maaşın 1/4'ü, 20 saat). Aday bir gerçek proje alıyor — production değil ama production-adjacent. Linear'da ticket, Slack'te channel, Notion'da context doc.

Trial week kuralları:
- **Async-only:** Zoom yok, loom video veya yazılı update
- **Özerk scope:** "Bunu yap" değil, "bu problemi çöz, nasıl yapacağın sana kalmış"
- **Gerçek feedback döngüsü:** Ekip üyeleri async comment yapıyor, aday revize ediyor

Gözlem kriterleri:
1. **İlk 24 saatte soru kalitesi:** Belirsizliği tanımlıyor mu, yoksa "ne yapayım" mı soruyor?
2. **48 saatte ilk commit/draft:** Mükemmellik tuzağına düşmeden iterasyon başlatıyor mu?
3. **72 saatte async feedback'e tepki:** Defensive mi, yoksa "anladım, şunu değiştiriyorum" mı?
4. **Son gün delivery:** Scope creep yapmadan, net çıktı veriyor mu?

Trial week'te %30 aday fail oluyor — ama bu erken fail, 90 günlük probation fail'inden çok daha ucuz. 2025'te trial week yapan 15 adayın 10'u full-time geçti, 10'un 9'u 12 ay sonra hala ekipte — retention %90.

## Sync ön-yargısını kırmak: Silent interview

Trial week sonrası final mülakat yapıyoruz ama formatı ters çevirdik: "silent interview". 30 dakika, aday konuşmuyor — sorularımızı önceden Google Doc'ta gönderiyoruz, aday yazılı cevaplıyor, mülakat sırasında sadece okuyoruz, follow-up sorarız.

Bu format 3 şeyi test ediyor:
- **Hazırlık disiplini:** Yazılı cevap hazırlamak, spontane konuşmaktan daha fazla düşünce gerektirir
- **Distillation:** Uzun söylem yerine net öz kurabilme
- **Async empati:** Karşı taraf okuyacak, o yüzden netlik kritik

Örnek soru: "İlk 90 günde neyi başarı sayarsın? Metriklerle yaz." Cevap "adapte olmak" değil, "Linear'da ilk RFC'mi merge ettirmek, code review cycle time'ımı 24 saate düşürmek, 3 stakeholder'la async alignment kurmak" olmalı.

Silent interview sonrası 15 dakika sync Q&A yapıyoruz — ama o da çoğunlukla adayın bize soruları için. Bu formatta 2024'te 8 final mülakat yaptık, 7'si hire'a döndü, 1 kişi kendi vazgeçti (async çalışmaya hazır değilmiş).

## Onboarding'de async disiplin pekiştirme

Hire kararı verdikten sonra async çalışma kasını güçlendirmek için ilk 30 günde zorunlu pratikler koyuyoruz:

| Gün | Aktivite | Ölçüm |
|-----|----------|-------|
| 1-7 | Notion handbook'u oku, 10 soru sor (yazılı) | Soru kalitesi (belirsizlik vs bilgi teyidi) |
| 8-14 | İlk Linear ticket: documentation update | Commit message netliği, PR description |
| 15-21 | İlk async RFC yaz (küçük scope) | Peer review comment sayısı, approval time |
| 22-30 | Başka ekibin RFC'sine review yaz | Constructive feedback sinyali |

Bu yapı async kas geliştiriyor — 30. günde kod yazan developer bile "yazılı bağlam" kasını güçlendirmiş oluyor. Roibase'de [markalaşma & brand identity](https://www.roibase.com.tr/tr/branding) çalışmalarında da benzer disiplin var: brand voice, guideline, tone-of-voice doc — hepsi async alignment aracı.

## Karşı argüman: Async hiring yavaş mı?

Evet, klasik pipeline'dan 2 hafta daha uzun sürüyor. Written assessment 48 saat, trial week 5 gün, silent interview 1 hafta hazırlık. Ama bu süre, yanlış hire'dan kaynaklı 6 aylık kayıp zamanın yanında minimal. Roibase'de 2022'de sync pipeline ile hire edilen 2 kişi, 4. ayda ayrıldı — cost of bad hire: ~€40K (maaş + ekip disruption). 2024'te async pipeline ile hire edilen 7 kişi, 12. ayda hala ekipte — cost of good hire: initial investment + compounding value.

Diğer counter-argument: "Hızlı hareket eden startup'ta async hiring lüks." Yanıt: hızlı hareket = hızlı hire değil, doğru hire. Async ekip kuruyorsan, sync pipeline ile filtre etmek mantık hatası — sinyalleri yanlış ölçüyorsun.

## Async hiring'ın ikinci derece etkileri

Bu yapıyı kurunca yan etkiler görürsün:
- **Employer brand:** Aday pool'u değişiyor — "meeting yapmadan çalışalım" diyen insanlar geliyor
- **Retention:** İlk 90 günde kültürel uyum %40 daha hızlı (2025 kohortu vs 2022)
- **Referral quality:** Ekip üyeleri benzer async kasına sahip arkadaşlarını öneriyor

Son 12 ayda Roibase'e gelen 23 başvurunun 9'u "async-first hiring process" araması yaparak geldi — pipeline'ın kendisi marka sinyali.

---

Async ekip kurmak hire ettiğin insanlarla başlamıyor — hire *etme şeklinle* başlıyor. CV ekranı, 45 dakikalık mülakat, "kültürel uyum" sezgisi — bunlar sync çağın araçları. Written assessment, trial week, silent interview — bunlar async çağın filtreleri. Süreç daha uzun ama sinyal kalitesi daha yüksek. 2026'da knowledge work tamamen async'e kayarken, hiring de kaymalı.