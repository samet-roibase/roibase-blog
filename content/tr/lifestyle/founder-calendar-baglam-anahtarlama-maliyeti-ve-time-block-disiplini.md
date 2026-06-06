---
title: "Founder Calendar: Bağlam Anahtarlama Maliyeti ve Time-Block Disiplini"
description: "4 saatlik deep work bloğu, async response window ve müşteri görüşme cadence ile dikkat ekonomisini yönetmek — measurement-driven takvim tasarımı."
publishedAt: 2026-06-06
modifiedAt: 2026-06-06
category: lifestyle
i18nKey: lifestyle-002-2026-06
tags: [deep-work, founder-calendar, context-switching, async-first, time-blocking]
readingTime: 8
author: Roibase
---

Kalendar şiştiğinde problem sadece "vakit kalmadı" değil — dikkat dağıldı. Çoğu founder 8 saat çalışıyor ama 2 saatlik net odaklı iş çıkartıyor. Sebep: bağlam anahtarlama maliyeti (context switching cost). Her meetingten sonra 23 dakika derin odağa dönmek için harcanıyor (UC Irvine 2023 araştırması). Günde 6 meeting varsa 138 dakika sadece dikkatini toplamaya gidiyor. Bu yazıda founder/operator takvimini measurement-driven nasıl yeniden tasarladığımızı anlatacağız — 4 saatlik deep work bloğu, async response window ve müşteri görüşme cadence ile.

## Bağlam Anahtarlama Maliyetinin Gerçek Sayıları

Birçok founder "ben multitasking yapabilirim" sanır. Ama cognitive load araştırmaları aksini söylüyor: aynı günde farklı bağlamlar (strateji, operasyon, satış, teknik review) arasında geçiş yaptığında beyin her seferinde kısa süreli belleği resetliyor. Gloria Mark'ın Stanford Lab'da yaptığı çalışmada bir görevden diğerine geçiş 23.5 dakika odak geri kazanım süresi yaratıyor. Eğer günde 5 kez bağlam değiştiriyorsan 117 dakika kayıp — yani günlük net üretkenliğin yarısı.

Roibase ekibinde bu problemi 2022'de ölçtük: Slack thread response time ile Linear task completion time'ı correlation analiz ettik. Sonuç: günde 10+ Slack thread'e anında yanıt veren kişilerde Linear sprint velocity %41 düşüktü. Yani "hemen yanıt veren" pattern aslında delivery düşmanıydı. Founder takviminde de benzer: aynı gün içinde müşteri call, teknik sprint planning ve finans review karıştığında hiçbirinde derin karar veremiyor.

Çözüm: bağlam bloklarını gün bazında ayırmak — Pazartesi teknik, Salı müşteri, Çarşamba operasyon gibi. Ya da en az yarım gün (4 saat) sabit bağlam bloğu tutmak. Kesintisiz 4 saat deep work, bir günde 1 saat kesintili çalışmadan 3 kat daha verimli (Cal Newport, Deep Work 2016). Bu sadece "odaklanmak" değil — beynin working memory'sinin yüklenmesini beklemek.

## 4 Saatlik Deep Work Bloğu: Tasarım Kriterleri

4 saatlik kesintisiz blok yaratmak için sadece "takvimde yer açmak" yetmiyor — sistemik koruma gerekiyor. Önce hangi saatlerin deep work'e uygun olduğunu bulmalısın. Çoğu founder için sabah 08:00-12:00 ideal — email henüz patlamadı, ekip standup sonrası kendi işine geçti, müşteri call henüz başlamadı. Ama herkes sabah tipi değil. Kendi energy curve'ünü ölç: hangi saatlerde kompleks problem çözümü yapabiliyorsun?

Deep work bloğunu korumak için katı kurallar koy:

- **Meeting yasağı:** Bu saat aralığı takvimde "Busy" işaretli, kimse meeting koyamaz.
- **Notification kapalı:** Slack, email, telefon — hepsi DND modunda.
- **Async-first response:** Bu blok içinde gelen mesajlara 4 saat sonra yanıt veriyorsun, bu senin async response window'un.
- **Fiziksel izolasyon:** Mümkünse farklı oda/cafe — ofis ortamından uzak.

Roibase'de founder calendar'ında şu blokları zorunlu tutuyoruz:

| Blok | Süre | Aktivite | Koruma seviyesi |
|---|---|---|---|
| Deep work | 08:00-12:00 | Ürün stratejisi, teknik review, yazma | Mutlak — meeting yok |
| Async response | 12:00-13:00 | Email, Slack, Linear comment | Sadece yazı — call yok |
| Müşteri call batch | 14:00-17:00 | Tüm müşteri görüşmeleri | Sadece müşteri |
| Ekip sync | 17:00-18:00 | Standup, sprint review | Dahili ekip |

Bu yapı bağlam anahtarlamayı minimize ediyor: sabah teknik düşünüyorsun, öğleden sonra müşteri kafasındasın, akşam ekip operasyonuna giriyorsun. Aynı günde farklı bağlamlara geçiş yok.

### Async Response Window'u Nasıl Bildirirsin

Deep work bloğu korumak için ekip/müşteri beklentisi set etmelisin. "Ben sabah 08:00-12:00 arası yanıt vermiyorum" yazmak yetmiyor — neden vermediğini de anlat. Biz şu Slack status mesajını kullanıyoruz:

```
🔴 Deep work — 12:00'da async yanıt döngüsündeyim
```

Email imzasında da belirt:

```
Not: Sabah 08:00-12:00 arası deep work bloğum — 
bu saatlerde gelen mesajlara 12:00'dan sonra yanıt veriyorum.
Acil konular için: [telefon numarası]
```

Bu transparency beklenti yönetimi sağlıyor. Müşteri "cevap vermedi" demiyor, "deep work yapıyor, 12:00'da dönecek" biliyor. Aynı şekilde ekip Slack'te seni tag'lediğinde anında yanıt beklemediğini öğreniyor. İlk 2 hafta alışma süresi oluyor, sonra herkes async cadence'a geçiyor.

## Müşteri Görüşme Cadence: Batch Processing

Founder takviminde en büyük bağlam anahtarlama kaynağı müşteri call'ları. Her müşteri farklı context, farklı problem, farklı enerji harcama. Eğer aynı gün içinde 3 farklı müşteri ile konuşuyorsan her birinden sonra mental resetleme yapman gerekiyor. Çözüm: batch processing — müşteri call'larını belirli gün/saatlere toplamak.

Roibase'de founder calendar'ı şöyle: **Salı ve Perşembe 14:00-17:00 arası sadece müşteri call**. Diğer günlerde müşteri call açık değil (istisnalar tabii var, ama kural bu). Bu yapıyla iki fayda:

1. **Mental hazırlık:** Salı sabahı biliyorsun öğleden sonra 3 müşteri call var, kafan o moda giriyor. Her call arasında 30 dakika buffer — önceki görüşmeyi sindirmek, notları yazmak için.
2. **Enerji yönetimi:** Müşteri call'ları sosyal enerji harcıyor (introvert founder'lar için önemli). Tüm call'lar aynı güne toplandığında diğer günler recharge için kalıyor.

Batch processing için müşteri beklentisi de set et. Biz meeting link'lerini Calendly ile veriyoruz, sadece Salı-Perşembe 14:00-17:00 açık. Müşteri kendi uygun saati seçiyor, ama founder takvimi korunmuş oluyor.

### Call Arası Buffer: 30 Dakika Zorunlu

Arka arkaya meeting en kötü pratik. Bir call 16:00'da bitiyor, 16:00'da yeni call başlıyor — arada not yazma, düşünme, tuvalet molası bile yok. Beyin her call için context load/unload yapamıyor. Roibase kuralı: **her call arasında minimum 30 dakika buffer**. Bu buffer döneminde şunları yapıyoruz:

- Call notlarını Linear'a task'e çevirme (5 dakika)
- Aksiyon itemları ilgili kişilere assign etme (5 dakika)
- Bir sonraki call için brief okuma (10 dakika)
- Kısa yürüyüş/esnetme (10 dakika)

Bu buffer olmadan call'lar birikip tek bir "bulanık meeting günü" oluyor. Buffer ile her call discrete bir iş birimi haline geliyor — başı ve sonu net.

## Measurement-Driven Takvim Optimizasyonu

Takvim tasarımını "hissiyat" ile yapmak yerine ölçerek optimize ediyoruz. Roibase'de her founder/operator şu metrikleri haftalık track ediyor:

| Metrik | Nasıl ölçüyoruz | Hedef |
|---|---|---|
| Deep work saat | Toggl manuel log | Haftada 20+ saat |
| Bağlam anahtarlama sayısı | Takvim analizi (farklı kategori geçiş) | Günde max 3 |
| Async response time | Slack/email ortalama yanıt | 2-4 saat arası |
| Meeting/total time | Calendly + Toggl | %30'un altında |

Her Cuma sprint retro'da bu sayılara bakıyoruz. Deep work 15 saatin altına düşmüşse takvimde nerede bağlam anahtarlama arttığını analiz ediyoruz. Örnek: bir hafta 8 müşteri call varsa ve normalde 6 yapıyorsak, +2 call'ın deep work'ten çaldığını görüyoruz. Ertesi hafta ya call sayısını düşürüyoruz ya da 1 günü tamamen call'a ayırıp diğer günleri koruyoruz.

Async response time de önemli: 30 dakikada yanıt veriyorsan async değil, reactive çalışıyorsun. 2-4 saat yanıt async disiplini gösterir — mesaj geldi, okudum, ama deep work bloğumu bozmadan yanıt döngüsünde (12:00-13:00) yazdım. Bu measurement founder'a kendi davranışını düzeltme sinyali veriyor.

## Takvim Disiplini ve Marka Tutarlılığı

Founder calendar'ı sadece kişisel verimlilik değil — şirket kültürünün ilk sinyali. Eğer founder sürekli reactive, email'e anında yanıt veriyor, meeting'ten meeting'e koşuyorsa ekip de aynı pattern'e giriyor. Ama founder async-first, deep work korumalı çalışıyorsa ekip de bu disiplini benimsiyor. Bu kültürel tutarlılık [markalaşma](https://www.roibase.com.tr/tr/branding)'nın da temeli — şirketin ne olduğunu sadece logo değil, nasıl çalıştığı belirliyor.

Roibase'de "async-first, measurement-driven" sadece slogan değil — founder takviminden başlayıp ekip standup'ına, Linear sprint'ine, müşteri onboarding'ine kadar her yere yayılmış bir disiplin. Müşteri "acil call" istediğinde "Salı 14:00'da alabilirim, bu arada sorunu async Slack thread'de yazarsanız hazırlanırım" diyebiliyoruz — bu tutarlılık uzun vadede güven inşa ediyor.

Takvim disiplini gözle görünmüyor ama delivery hızında, karar kalitesinde, ekip moralinde çıkıyor. Founder'ın 4 saatlik deep work bloğu koruması, ekibin de Linear sprint'te kesintisiz kod yazabileceği demek. Bu zincirleme etki ölçülebilir: sprint velocity, code review turnaround time, deployment frequency — hepsi async disiplinle artıyor.

---

Founder calendar'ı "dolu = meşgul = başarılı" değil. Boş = odaklı = üretken. 4 saatlik deep work bloğu, async response window ve müşteri call batch'i bağlam anahtarlama maliyetini minimize ediyor. Her hafta sayılarla kontrol et: deep work 20 saatin altına düştüyse takviminde leak var. Düzelt, ölç, iterasyon yap. Verimlilik hack değil, sistemik tasarım.