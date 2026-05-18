---
title: "Hiring for Async-First: Pratik Filtre ve Mülakat Yapısı"
description: "Trial week, yazılı değerlendirme ve senkron ön-yargısını silme — uzaktan ekip kurmanın ölçülebilir işe alım tasarımı."
publishedAt: 2026-05-18
modifiedAt: 2026-05-18
category: lifestyle
i18nKey: lifestyle-005-2026-05
tags: [async-first, remote-hiring, trial-week, written-assessment, team-culture]
readingTime: 7
author: Roibase
---

Async-first ekip kurmak istiyorsan işe alım sürecini de async tasarlamalısın. "Hızlı karar vermek için 3 turda kapatalım" yaklaşımı senkron kültürün kalıntısı — sonuçta kalabalık Zoom call'unda iyi konuşan ama yazıya dökemeyeni işe alıyorsun. Roibase 2018'den beri İstanbul dışından developer, analist, stratejist işe alıyor. Sürecimiz: yazılı değerlendirme, trial week, karar kriterleri dokümanda. Bu yazıda async-first işe alımın mekanik tasarımını parçalarına ayırıyoruz.

## Senkron mülakat ön-yargısını tespit et

Klasik mülakat formatı senkron iletişimi ödüllendiriyor. Hızlı cevap veren, karizma gösteren, göz teması kuran profil yüksek değerlendirme alıyor. Ama async ekipte bu beceriler kritik değil. Linear issue'suna detaylı analiz yazmak, 3 saat sonra kontekst kaybetmeden yanıt vermek, belirsizliği dokümana çevirmek asıl yetkinlik.

Roibase'de 2020'de bir deney yaptık: iki developer profil aldık. Birincisi video call'da mükemmel açıklama yaptı, ikincisi sözel olarak duraklamalar gösterdi ama yazılı değerlendirmede çözüm tasarımını 2 sayfalık dokümanda net sundurdu. İkincisini işe aldık. 8 ay sonra Linear issue çözüm hızı %34 yüksek çıktı — beklentiyi karşıladı.

İşe alımda senkron elemana izin verirsen ekipte senkron bağımlılık kurarsın. Async-first ekip için filtre mekanizması da async olmalı.

## Yazılı değerlendirme: karar verme tarzını göster

Async hiring'in ilk somut adımı: özgeçmiş yerine yazılı değerlendirme. Adaya 2-3 soru sor, 48 saat süre ver, 400-600 kelime bekle. Soru örnekleri: "Son projende bağımlılık çakışması yaşadın mı? Çözüm sürecini yaz." veya "Ekipte fikir çatışmasını nasıl çözersin? Gerçek senaryo üzerinden yaz."

**Değerlendirme kriterleri:**
- Yapı: giriş, analiz, sonuç bölümleri net mi?
- Detay: somut sayı, tool ismi, zaman dilimi vermiş mi?
- Bağlam: başkasının okuyup anlaması mümkün mü?
- Ton: savunmacı değil, açıklayıcı mı?

Bu aşamada %60 eleme yapıyoruz. Yazıyı 3 gün geçiktiren, tek paragraflık yanıt gönderen veya jargonla kaçan profiller eleniyor. Async-first kültürde yazı disiplini ön koşul — trial week'e geçmeden önce bunu test etmek maliyeti düşürüyor.

### Yanıt zamanı: dikkat değil, önceliklendirme

48 saat içinde yanıt vermek async çalışmayı simüle ediyor. Aday belki fulltime işte, belki farklı time zone'da. Önemli olan hızlı değil, sistematik yanıt. 24 saatte yarım cevap gönderen yerine 40 saatte detaylı analiz sunanı tercih ediyoruz.

## Trial week: ödeme karşılığı gerçek iş

Trial week async ekip kurmanın en kritik filtresi. Aday 5 gündür ekibin kullandığı tool'lara erişiyor: Linear, Notion, Figma, GitHub. Ona gerçek bir task veriyorsun — proje simülasyonu değil, şu anki backlog'dan priority:low olan bir issue. Sonunda ödeme yapıyorsun: günlük rate × 5 gün.

**Trial week kriterleri:**
- Issue çözüm kalitesi (%40 ağırlık)
- Linear comment'lerde bağlam paylaşımı (%30)
- Takılınca nasıl sordu — async doc mu, Slack panic mi? (%20)
- Time-to-first-response: ilk commit ne zaman geldi? (%10)

2023'te bir data analist adayı trial week'te dashboard tasarladı. BigQuery query'sini Notion'a dokümante etti, varsayımlarını açıkladı, eksik veriyi erken söyledi. İlk commit 18 saat sonra geldi (beklenti 24 saat). İşe aldık. 6 ay sonra proje setup maliyeti %40 düşük — çünkü dokümantasyon disiplini ilk günden vardı.

Trial week ödemesiz yapıldığında hem etik sorun hem de yanlış filtre oluyor. Ödeme karşılığı task verince adayın zaman yönetimi gerçekçi şekilde test edilir.

## Senkron call: karar değil, kültür tanıtımı

Async-first hiring'de senkron görüşme yapma yasağı yok — ama **karar verme amacı yok**. 30 dakikalık video call'u şuna kullanıyoruz: ekip kültürünü tanıt, async beklentileri netleştir, adayın soru sormaya devam etmesini sağla.

Call'da sorduğumuz tek şey: "Trial week'te hangi kısım belirsiz kaldı?" Cevap üzerinden async iletişim stilini test ediyoruz. Eğer "neden böyle yaptım" diyorsa yerine "şu noktada kontekst eksikti, dokümanda göremedim" diyorsa, async ekip uyumu yüksek demektir.

Bazı adaylar Zoom call beklentisiyle geliyor — o sırada async çalışma felsefesini aktarma fırsatı. "Burada kod review 3 saatte dönebilir, aciliyet yoksa 24 saat. Bu sana uyar mı?" sorusu net bir kriter. Uymayanları erken elemek zaman kazandırıyor.

## Karar: dokümanda puanlama, toplantısız onay

Trial week bittiğinde karar süreci de async. Ekipten her kişi Linear issue'sundan puanlama yapıyor: criteria 1-5 skalasında. Notion'da karar dokümanı: puan tablosu, ekip comment'leri, nihai öneri. Hiring lead dokümanı kapatıyor, Slack'te onay istiyor. 48 saat içinde itiraz yoksa hire.

**Örnek puanlama tablosu:**

| Kriter | Ağırlık | Puan (1-5) | Açıklama |
|--------|---------|------------|----------|
| Issue çözüm | 40% | 4 | Kod temiz, test coverage düşük |
| Async iletişim | 30% | 5 | Linear comment'ler detaylı |
| Bağlam paylaşımı | 20% | 4 | Bir commit message eksik |
| Time response | 10% | 5 | İlk PR 16 saatte geldi |

Bu tablo sync call'a gerek bırakmıyor. "Hissettiğim" değil, "dokümanda gördüğüm" kriterleri kullanıyor. Karar 2 gün içinde kapanıyor — senkron toplantısız.

## İtiraz mekanizması: dokümanda şeffaflık

Hire kararı Notion'da açık (candidate anonimleştirilmiş). Ekipten biri itiraz ederse "counter-argument" bölümünü dolduruyor: hangi kriterde farklı değerlendirme, hangi veri noktasına dayanıyor. Hiring lead 24 saat içinde yanıtlıyor. İtiraz %15 oran civarında — çoğu zaman yeni veri noktası konuşmayı değiştiriyor.

Bu mekanizma async kültürü pekiştiriyor. Ekip dokümana güveniyor, karar şeffaf. Founder veya lead'in "ben hallederim" tarzı kısa-cut kapatılıyor. Roibase gibi butik ajanslar büyürken bu disiplin [markalaşma](https://www.roibase.com.tr/tr/branding) sürecine de yansıyor — "ekibimiz böyle çalışır" mesajı dışarıya taşınıyor.

## Async hiring maliyeti: zaman kazandırır

İlk bakışta async hiring daha yavaş görünüyor — trial week 5 gün, yazılı değerlendirme 2 gün. Ama yanlış işe alımın maliyeti 3-6 ay. Async filtre erken aşamada uyumsuz profilleri eliyor. Sync mülakatta iyi görünen ama async kültüre uymayan birisini işe alıp 2. ayda sorun yaşamak daha pahalı.

Roibase'de son 3 yılda async hiring ile 12 kişi işe aldık. İlk 6 ayda ayrılma oranı %8 — sektör ortalaması %25. Sebep: trial week gerçek iş simülasyonu, filtre erken yapılıyor. Zaman kazanmak için senkronu zorlamak kısa vadede cazip — uzun vadede ekip kültürünü bozuyor.

Async-first ekip kurmak istiyorsan işe alım süreci async olmalı. Trial week, yazılı değerlendirme ve dokümanda karar: bunlar mekanik adımlar. Sync call yapılabilir ama karar orada verilmez. Async hiring disiplini ekibin ilk gününden itibaren beklentiyi net kuruyor.