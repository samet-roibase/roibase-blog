---
title: "Hiring for Async-First: Pratik Filtre ve Mülakat Yapısı"
description: "Trial week, written assessment ve sync ön-yargısını silme: uzaktan ekip kurarken adayı gerçek iş disipliniyle test etmenin operasyonel rehberi."
publishedAt: 2026-06-24
modifiedAt: 2026-06-24
category: lifestyle
i18nKey: lifestyle-005-2026-06
tags: [async-first, hiring, remote-work, trial-week, team-building]
readingTime: 8
author: Roibase
---

Async-first ekip kurmak, LinkedIn profilinde "remote-friendly" yazan adayı işe almakla başlamıyor. 2026'da en sık yapılan hata: mülakat sürecini yine senkron toplantılara, "vibe check" oturumlarına ve CV sayfası okumaya dayandırmak. Sonuç: ekip uzaktan çalışıyor ama her gün 4 Zoom toplantısı, her karar için Slack'te anlık yanıt beklentisi, yazılı döküman yerine sözlü talimat. Async ekip kurmak istiyorsan, işe alım sürecini de async disiplinine göre tasarlaman gerekiyor — bu sadece "uygun saatte görüşelim" demek değil, adayın *gerçek async iş yapma kapasitesini* test etmek demek.

## Sync ön-yargısını silmek: ölçülebilir kriter listesi

Async-first hiring'in ilk adımı: hangi yetkinliklerin *gerçekten* senkron etkileşim gerektirdiğini ayırmak. Klasik mülakat süreçleri "bu adam baskı altında düşünebiliyor mu" sorusunu 45 dakikalık video call'da cevaplamaya çalışır. Async ekipte asıl soru şu: bu kişi bağlamı yazıdan okuyup, 4 saat sonra detaylı yanıt verebiliyor mu?

Roibase'de 2023'ten beri kullandığımız filtre matrisi 3 kategoriye ayrılıyor:

**Zorunlu async yetkinlikler:**
- Yazılı brief'i okuyup sorular sormadan ilk output verme
- 24 saat içinde Linear task'e response time (gecikirse açıklama yazma disiplini)
- Figma comment'te 3 paragraf feedback — senkron call talep etmeden

**Hybrid kabul edilebilir:**
- İlk hafta onboarding — 2-3 sync oturum normal
- Stratejik pivot anları — quarterly planning, major feature kickoff
- Kritik bug/incident — Slack'te anlık ping beklenebilir

**Async'te ölçülmez yetkinlikler:**
- Whiteboard brainstorming yeteneği — FigJam async yapılır
- "Ekip enerjisi" — written culture document'te okunur
- Hızlı karar verme — karar email thread'inde 48 saat içinde documented edilir

Aday portföyünü bu matrise göre eleyince, CV'de "remote experience 5 yıl" yazan adayların %60'ının aslında full-time Zoom'da çalıştığını görüyorsun. Bu kişiler async ekipte ilk haftada "neden kimse Slack'te cevap vermiyor" diye frustrasyona giriyor.

İkinci filtre: adayın geçmiş işlerinde *asenkron artifact* üretip üretmediğini sormak. "Bu projede karar sürecinizi nasıl dokümante ettiniz?" sorusuna "haftalık toplantıda tartıştık" yanıtı red flag. "Notion decision log'a 3 seçenek + tradeoff yazdık, 2 gün içinde herkes comment attı" yanıtı green light.

## Written assessment: gerçek iş simülasyonu

Video call mülakat yerine written assessment koymak, sadece "email gönder" demek değil — adayın ekiple async çalışırken karşılaşacağı *tam* bağlamı simulate etmek demek. Biz bunu 2024'te formalize ettik, şimdi tüm pozisyonlar için zorunlu: aday 48 saat içinde Linear task'e benzer bir brief'e yanıt veriyor, Loom video yerine Notion page hazırlıyor, Figma mock-up'a comment atıyor.

**Assessment formatı (örnek: marketing ops role):**

*Brief:* "Client X'in Google Ads ROAS son 4 haftada %18 düştü. Search Console'da 3 core keyword'de impression -22%. Analytics'te bounce rate +9pp. Aşağıdaki dataset'i inceleyip (Google Sheet link) bir haftalık aksiyon planı öner. Format: Notion page, max 800 kelime, en az 1 data visualization."

*Değerlendirme kriterleri:*
- **Bağlam okuma:** Sheet'teki 12 tab'i inceleyip doğru metriğe mi odaklandı? (ağırlık: %25)
- **Yazılı netlik:** Aksiyon planı başka birinin execute edebileceği kadar spesifik mi? (ağırlık: %30)
- **Async takip:** Sorularını Slack'te değil, Notion comment'te mi sordu? Cevap beklerken diğer kısma mı geçti? (ağırlık: %20)
- **Deadline:** 48 saat içinde mi tamamladı? Gecikecekse önceden yazdı mı? (ağırlık: %15)
- **Output formatı:** Notion page'de heading hierarchy, inline chart, bullet list kullanımı (ağırlık: %10)

Bu assessment'ta düşen adayların %40'ı "brief'i okumadan direkt Slack'te 'bu konuda 15dk call yapalım mı?' diye yazan" kategori. Bu kişiler async ekipte ilk haftada blocker olur — her task için sync meeting talep ederler.

Tersine, assessment'ı geçen adaylar ilk Linear task'lerini zaten biliyorlar: Notion'da context okuyup, 6 saat içinde draft PR açıp, Figma comment'te feedback istemişler. Onboarding friction %70 azalıyor.

**Anti-pattern:** Assessment'ı "homework" diye sunup sonra video call'da "anlatın bakalım" demek. Bu yine sync'e geri dönüş. Doğru yol: assessment'ı Linear task gibi treat et, tüm feedback'i Notion comment'te ver, soru-cevap async thread'de yürüsün. Aday nasıl async çalışacaksa, hiring de öyle yürümeli.

## Trial week: süreç değil, gerçek sprint

CV + assessment'tan sonraki adım klasik hiring'de "referans kontrol + final interview". Async-first'te bu adım: **ücretli trial week** — aday 5 gün boyunca gerçek Linear sprint'e katılır, gerçek client brief'ine yanıt verir, gerçek Figma file'da çalışır. Simülasyon değil, production.

Roibase'de trial week şu kurallara göre işliyor:

**Yapı:**
- **Gün 1-2:** Onboarding dokümanlarda — Notion workspace, Linear project, Figma organization. Slack'te #trial-week kanalı açılır (async, 24 saat response time beklenir). İlk task: mevcut sprint'teki bir "good first issue" — complexity low, context medium. Adayın kod/yazı/tasarım output'u real repo'ya gider.
  
- **Gün 3-4:** İkinci task — complexity medium, cross-functional. Örnek: "Client Y için landing page A/B test planla, Figma'da variant yap, Google Optimize setup dokümante et." Bu task'te aday en az 2 ekip üyesiyle async coordinate etmek zorunda (biri design, biri analytics). Coordination kalitesi trial'ın asıl ölçüm noktası.

- **Gün 5:** Retrospective — yine async. Notion page'de "Ne öğrendin? Hangi process unclear'dı? İlk sprint'te neyi değiştirirdin?" soruları. Ekip de aynı formatta feedback veriyor: "Kod quality nasıl? PR description yeterli miydi? Slack response time nasıl?"

**Ödeme:** Trial week minimum $500 (junior role) ile $2000 (senior role) arası flat fee — saat hesabı yok, çünkü async'te saat ölçmek anlamsız. Output'a göre değerlendirme.

**Red flag sinyalleri trial week'te:**
- Her task'ten önce "bu konuda call yapalım" mesajı (3+ defa = auto-reject)
- PR description 2 satır — "fixed bug" (context yok = reject)
- Slack'te "bu urgent mı?" diye sormadan 2 saat içinde cevap bekleme (async disiplin yok)
- Figma comment yerine ekran görüntüsü DM'leme (documentation yok)

**Green flag sinyalleri:**
- İlk task'i tamamladıktan sonra kendi inisiyatifiyle related documentation gap'i fix etme
- Linear task description'a sorduğu soruları kendisi de append edip diğer team member'ların görmesini sağlama
- 24 saat response SLA'yı tutturma ama her mesaja 10 dakikada cevap vermeme (deep work var)

Trial week'in async ekip kurmanın en kritik noktası olmasının nedeni şu: CV'de "self-starter, autonomous" yazan herkes, ilk real task'te ya anlık feedback bekleyip duruyor ya da tek başına context olmadan yanlış yöne gidiyor. Async disiplin = bağlamı dokümandan okuyup + intermediate checkpoint'lerde async güncelleme + deadline'ı tutturma. Bu yetkinlik sadece trial week'te görülüyor.

## Sync mülakat ne zaman gerekli: exception case'ler

Async-first hiring full async demek değil — bazı checkpoint'ler sync yapılmalı. Roibase'de şu 3 durumda video call zorunlu:

**1. Cultural alignment check (1 kere, 30dk):** Trial week sonrası, teknik yetkinlik onaylandıktan sonra. Bu call'da konuşulan: "Ekip conflict'i nasıl resolve ederiz? (yazılı mı yoksa call mı?)", "Deadline slip ettiğinde ne yaparsın?", "Async çalışırken isolation hisseder misin?". Bu sorular yazılı cevaplandırılamaz, çünkü ton + tereddüt önemli. Ama bu call hiring decision'ı belirlemez, sadece final onay.

**2. Senior leadership role (2-3 call):** Director+ pozisyonlar için async assessment + trial week yeterli olmuyor, çünkü stratejik kararlar ve [markalaşma](https://www.roibase.com.tr/tr/branding) gibi high-context alanlar real-time tartışma gerektirir. Bu call'lar da async prep'li: önceden Notion'da senaryo case gönderilir, call'da derinleşilir, sonra yine written summary yapılır.

**3. Co-founder/equity conversation:** Equity split, vesting schedule, exit scenario — bunlar async yazışmayla netleşmez. 2-3 sync oturum şart. Ama yine kural: her call öncesi agenda Notion'da, call sonrası karar Linear task'e documented.

Bu 3 exception dışında her aşama async. Örnek timeline:

| Hafta | Aşama | Format |
|-------|-------|--------|
| 1 | CV + portfolio review | Async (Notion comment) |
| 2 | Written assessment | 48 saat, Notion delivery |
| 3 | Assessment feedback | Async thread, 24 saat turnaround |
| 4 | Trial week | Linear sprint, real task |
| 5 | Retro + culture call | Async retro + 1 video call (30dk) |
| 6 | Offer | Written, Notion'da negotiate edilir |

Toplam sync time: 30 dakika. Klasik hiring: 6-8 saat video call. Fark: async hiring'de aday gerçek işi görmüş, ekip de gerçek output'u test etmiş. Video call'da "baskı altında düşünebilir mi" teatri yerine, Linear history'de "5 gün boyunca nasıl çalıştı" verisi var.

## Async hiring anti-pattern: yaygın hatalar

İlk kez async hiring deneyen ekiplerin düştüğü 4 tuzak:

**1. "Async mülakat" deyip sadece video call'ı Loom video'ya çevirmek:** Aday Loom'da kendini tanıtıyor, sen Loom'da sorular soruyorsun — bu async değil, asenkron senkronluk. Gerçek async: aday Notion page yazıyor, sen Notion comment atıyorsun, aday 12 saat sonra edit yapıyor. Thread format, video monolog değil.

**2. Trial week'i "ücretsiz freelance proje" gibi kullanmak:** Bazı şirketler "1 hafta test et" deyip real client deliverable veriyor, sonra ücret ödemiyor. Bu illegal + unethical. Trial week = mutual evaluation period. Aday da seni test ediyor — process, tool quality, feedback hızı. Ödeme yapmazsan sadece yasal risk değil, aynı zamanda en iyi adayları kaçırıyorsun (iyi adaylar zaten başka offerları olan, ücret almadan trial yapmayacak kişiler).

**3. Assessment'ta "hızlı cevap" beklentisi:** 48 saat deadline verip, 6 saat içinde teslim edeni favoriliyorsun. Bu async'in tersine çalışır — deep work yerine reactive çalışmayı ödüllendiriyorsun. Doğru metric: deadline içinde + quality yüksek. Teslim zamanı farketmez.

**4. Trial week'te sync standuplar yapmak:** "Async ekibiz ama trial week'te her sabah 15dk sync yapalım ki nasıl gittiğini görelim." Hayır. Trial week async pratiği test etme zamanı — aday Linear task update'ini yazıyla veriyor, sen async feedback veriyorsun. Sync standup eklerseniz async disiplini test edemezsiniz.

## Hiring funnel'da async conversion rate: bizim sayılar

Roibase'de 2024-2026 arası async hiring funnel:

- **CV başvuru:** 100 kişi
- **Written assessment davet:** 20 kişi (ilk elenme: CV'de async artifact yok)
- **Assessment tamamlama:** 14 kişi (6 kişi deadline'ı kaçırıyor veya "call yapalım" diyor)
- **Trial week davet:** 8 kişi (assessment quality filtresi)
- **Trial week tamamlama:** 7 kişi (1 kişi ilk 2 günde "bu benim için değil" deyip çıkıyor — mutual decision)
- **Offer:** 3-4 kişi (role'e göre 1-2 hire)

Conversion rate: %3-4. Klasik hiring'dekinden düşük, çünkü async disiplin nadir yetkinlik. Ama hire edilen kişinin ilk 6 ay retention rate: %95 (klasik hiring'de %70). Sebep: hire süreci real iş pratiğini simulate ettiği için, kişi zaten ne yapacağını biliyor. "İş beklendiği gibi değilmiş" surprise'ı yok.

Ayrıca async hiring global talent pool açıyor. 2025'te hire ettiğimiz developer Arjantin'de, designer Polonya'da, marketing ops Tokyo'da. Sync mülakat olsaydı timezone coordination imkansızdı. Async formatı sayesinde aday kendi saatinde assessment yapıyor, trial week'te overlap olmadan çalışabiliyor.

Async-first hiring kurmak, sadece "uzaktan çalışalım" demekten çok daha derin bir disiplin değişimi. Mülakat sürecini Linear sprint gibi, assessment'ı Notion page gibi, trial week'i real production gibi treat ediyorsun. Sonuç: CV'yi değil real output'u, "vibe"ı değil documented contribution'ı, senkron performansı değil async collaboration capacity'yi test ediyorsun. 2026'da remote-first ekip kuracaksan hiring funnel'ını async-first'e çevir — ilk 3 hire sonrası farkı sayılarla göreceksin.