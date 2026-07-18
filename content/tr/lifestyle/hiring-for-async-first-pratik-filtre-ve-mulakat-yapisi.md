---
title: "Hiring for Async-First: Pratik Filtre ve Mülakat Yapısı"
description: "Trial week, written assessment ve sync ön-yargısını silme: async-first ekiplerde işe alımın somut yapı taşları ve 7 günlük deneme sürecinin kriterleri."
publishedAt: 2026-07-18
modifiedAt: 2026-07-18
category: lifestyle
i18nKey: lifestyle-005-2026-07
tags: [async-first, remote-hiring, trial-week, written-assessment, team-culture]
readingTime: 8
author: Roibase
---

Async-first ekipler klasik işe alım sürecini kullanamaz. Video görüşmesinde anlık tepki gösteren, whiteboard'da hızlı düşünen, prezantasyon karizması olan aday async ortamda sessiz kalabilir. Tersine, yazılı düşünmeyi seven, derin analiz yapan, senkron baskıyı sevmeyen aday 45 dakikalık call'da eksik değerlenir. 2026'da remote ekipler büyürken bu uyumsuzluk işe alım maliyetini katladı. Çözüm basit: işe alım sürecini async kültürün doğal çalışma temposuna taşımak.

## Senkron Ön-Yargısını Tespit Etmek

Klasik mülakat senaryosu: CV taraması → 30 dakika HR call → 1 saat teknik görüşme → case study → final. Her aşama gerçek zamanlı iletişim bekler. Aday özgeçmişindeki 3 yıllık remote deneyimini söyler ama süreç tamamen video call üzerine kurulu. Bu yapı async uyumu ölçmez, senkron performansı ölçer.

Ön-yargı nedenli: işveren, hızlı yanıt = yüksek katılım varsayımı yapar. Slack'te 5 dakikada cevaplayan aday tercih edilir, 2 saatte düşünülmüş analiz gönderen aday yavaş görülür. Oysa async ekipte değerli olan ikincisidir. Bu bias'ı kırmak için ilk adım: mülakat formatını async doğal tempoya uyarlamak.

Roibase'te 2019'dan beri uyguladığımız kural: ilk temas yazılı, ilk değerlendirme written assessment, ilk geri bildirim asenkron. Video call ancak trial week öncesi kültür uyumu için yapılır. Bu yapı adayın gerçek çalışma stilini gösterir çünkü gözlemlenen davranış sürecin kendisidir, performans gösterisi değil.

### İşe Alım Hunisinde Async Filtreler

İlk filtre CV değil, application form'dur. 3-5 açık uçlu soru: "Son projende async iletişim nasıl çalıştı?", "Zaman dilimi farkıyla nasıl çalıştın?", "Yazılı döküman örnekleri paylaşır mısın?". Yanıtlar 200-400 kelime aralığında beklenir. Bu aşamada 10 adaydan 3'ü elenir çünkü tek cümle cevap verir veya soruyu atlar. Bu async disiplinin ilk testi — yazılı talimatlara uymak.

İkinci filtre: take-home task. Video call yerine 48 saat içinde tamamlanacak gerçek iş senaryosu. Ama kritik nokta: deliverable code/tasarım değil, decision log + documentation'dır. Aday şunu göndermeli: problem analizi, tercih ettiği yaklaşım, reddettikleri alternatifler, timeline breakdown. Örneğin bir frontend görevi için "component yazdım" yetersiz; "X library yerine Y'yi seçtim çünkü bundle size %15 düşüyor, tradeoff olarak type safety kaybı var ama kabul edilebilir" beklenir.

Üçüncü filtre: peer review simulation. Adaya mevcut ekip üyesinin gerçek PR'ı gösterilir (anonymized), review yazması istenir. Async ekipte code review kültürü kritik — tonality, detay seviyesi, constructive feedback yeteneği burada test edilir. Yanıt formatı: GitHub comment thread gibi olmalı, satır satır + genel summary.

## Trial Week: 7 Günlük Gerçek Çalışma Testi

Trial week async işe alımın omurgası. Konsept: aday 7 gün boyunca ekiple çalışır, ücretli (günlük rate üzerinden ödenir), gerçek görev alır. Bu "dönemsel staj" değil, mini-employment — aday ekip Slack'inde, Linear'da, repo'da görünür. Tek fark: permanent değil, mutual evaluation dönemi.

Süreç şöyle: 1. gün onboarding (written runbook + async Q&A), 2-6. gün sprint task'ları (gerçek backlog'dan), 7. gün retrospective (written + optional sync call). Task seçimi kritik: çok kolay = gerçek yeteneği görmezsin, çok zor = haksız değerlendirme olur. İdeal task: 3-4 günde tamamlanabilir, ekip üyesiyle 2-3 async roundtrip gerektirir, merge edilebilir kalitede.

Gözlemlenen davranışlar:
- **Response time distribution:** Adayın mesajlara ne kadar sürede cevap verdiği değil, yanıt kalitesi. 2 saatte düşünülmüş analiz > 10 dakikada yüzeysel onay.
- **Documentation habit:** Kod/tasarım deliverable'ı dışında decision log yazmış mı? PR description dolu mu boş mu?
- **Question quality:** "Bu nasıl çalışır?" yerine "X'i Y şekilde yorumladım, doğru mu?" tarzı soru soruyor mu?
- **Autonomy threshold:** Takıldığında hemen ping mi atıyor yoksa önce kendisi research yapıp sonra spesifik soru mu soruyor?

Trial week sonunda iki taraf da red hakkına sahip. Aday async tempoyu deneyimledi, ekip adayın gerçek çalışma stilini gördü. Bu yapı "kağıt üstünde iyi görünme" riskini siler.

### Ölçülebilir Kriterler

Trial week subjektif değerlendirme değil, sayısal kriter matrisi gerektirir. Roibase'te kullanılan rubric:

| Kriter | Skor (1-5) | Ağırlık |
|--------|-----------|---------|
| Written communication clarity | | 25% |
| Async response quality (hız değil, derinlik) | | 20% |
| Documentation completeness | | 20% |
| Technical execution | | 20% |
| Cultural alignment (values, feedback tone) | | 15% |

Her ekip üyesi bağımsız skorlar, sonra calibration meeting'de (bu senkron olabilir) ortalaması alınır. Threshold: 3.5/5 geçer, 3.0-3.5 arası borderline (extended trial tartışılır), 3.0 altı red.

Kritik: technical execution en düşük ağırlıkta (20%). Çünkü async ekipte eksik teknik beceri sonradan öğretilir ama async disiplini öğretmek zor. Yazılı iletişim kalitesi ve documentation alışkanlığı daha kritik.

## Written Assessment Formatı

Written assessment trial week öncesi yapılır, amacı: adayın async çalışmaya uygunluğunu test etmek. Format: adaya 3-5 soruluk case study gönderilir, 3 gün içinde yanıtlanır (ara verilebilir, zaman dilimi esnek). Sorular scenario-based, açık uçlu, doğru/yanlış cevabı olmayan türden.

Örnek soru (product role için):
> "Ekibiniz 4 farklı zaman diliminde çalışıyor. Bir feature launch yaklaşıyor ama QA'den major bug raporu geldi. Launch'ı ertelemek mi yoksa bug'ı minor olarak kabul edip devam mı etmeli? Kararını nasıl verirsin, kimlerle nasıl align olursun, async ortamda bu süreci nasıl yönetirsin?"

Beklenen yanıt formatı (800-1200 kelime):
1. Problem breakdown (stakeholder'lar, tradeoff'lar)
2. Decision framework (hangi kriterlere göre karar verirsin)
3. Async communication plan (kimlere ne zaman nasıl yazarsın)
4. Documentation output (kararın nasıl dökümente edilir)

Bu assessment'ta değerlendirilen:
- **Structured thinking:** Paragraf düzeni, başlıklar, mantıksal akış var mı?
- **Stakeholder awareness:** Ekip dinamiklerini anlıyor mu, zaman dilimi farkını hesaba katıyor mu?
- **Transparency:** Kendi varsayımlarını açık yazıyor mu ("Burada X'i bilmiyorum, varsayıyorum...") yoksa kesin konuşuyor mu?
- **Action bias:** Analiz mi yapıyor yoksa sonuç vermiyor mu? Async ekipte "karar + implementation plan" beklenir.

Kötü yanıtlar: bullet point listesi (depth yok), tek paragraf (structure yok), senkron meeting önerisi ("bunu call'da konuşalım" — async yerine sync reflex).

## Kültür Uyumu: Sync Call'ın Yeri

Async-first = zero sync değil. Trial week öncesi veya sonrasında 30-45 dakikalık kültür call yapılır. Amaç: technical olmayan alignment — değerler, çalışma felsefesi, beklentiler. Bu call'da sorulacak sorular:
- "Async çalışmanın senin için en zor kısmı ne oldu?" (self-awareness testi)
- "Disagreement nasıl handle edersin, sync vs async'te fark var mı?" (conflict resolution)
- "En iyi remote çalışma deneyimin neydi, neden?" (pattern recognition)

Bu call'da aday da sorar — maaş, kariyer yolu, takım büyüklüğü. Ama kritik: kültürel red flag'ler burada yakalanır. Örneğin aday sürekli "toplantı yapalım" diyor, "hızlı karar" vurgusu yapıyor → async uyumu düşük. Veya "ben yazılı iletişimde iyi değilim" diyor → bu role uygun değil, red.

Roibase'in [markalaşma çalışması](https://www.roibase.com.tr/tr/branding) async-first değerlerini employer brand'e yansıtıyor. Aday zaten website'te "async kültür" başlığını okumuş, trial week sürecini biliyor, bu call surprise olmaz. Kültür uyumu böylece self-selection ile başlar — senkron beklentisi olan aday başvurmaz.

## Onboarding Sürecinde Async Continuity

Aday kabul edildi, ilk 30 gün onboarding. Burada async disiplin devam etmeli çünkü trial week sonrası sync'e dönersen kültürel inkonsistency olur. İlk gün: written runbook (Notion/GitBook), ekip tanışması (Loom video'ları veya profil dokümanları), async Q&A channel (Slack'te dedicated thread).

İlk hafta check-in'leri: daily async standup (ne yaptın, ne yapacaksın, blocker var mı) + weekly 1:1 (opsiyonel sync veya yazılı). Yeni başlayan "sessiz" kalma hakkına sahip — soru sormuyorsa sorun değil, gözlemliyor demektir. Senkron ekiplerde "ilk haftada sessiz kalan = disengaged" varsayımı yapılır ama async'te bu doğal.

30. gün sonunda onboarding retro: yeni başlayan hangi dökümanın eksik olduğunu, hangi sürecin belirsiz kaldığını yazar, bu feedback permanent onboarding runbook'a eklenir. Böylece her yeni başlayan sürekli iyileştirme döngüsüne katkı sağlar.

## Async Hiring'ın Maliyet-Fayda Dengesi

Trial week = 7 gün × günlük rate ödenir, reddedilen aday için sunk cost. Ama alternatif: 3 ay sonra yanlış hire'ı fark edip ayırma maliyeti (severance + yeniden işe alım + ekip moral kaybı) çok daha yüksek. Trial week sunk cost değil, risk mitigation yatırımıdır.

Zaman maliyeti: trial week için ekip 2-3 saat/hafta ayırır (task review, feedback, async soru cevap). Klasik mülakat süreci de 4-5 saat senkron zaman alır ama distributed. Fark: trial week gerçek iş üretir (merge edilebilir kod/tasarım), klasik mülakat üretmez (theoretical case study).

Async hiring funnel conversion oranı düşük: 100 başvuru → 30 written assessment → 10 trial week → 3 hire. Ama kalite yüksek: 3 hire'ın 2.7'si 1+ yıl kalır (Roibase 2022-2025 verisi). Klasik funnel: 100 → 50 telefon → 20 onsite → 5 hire ama 5'in 2'si 6 ay içinde ayrılır.

Async süreç yavaş ama sürdürülebilir. Ekip büyütme hedefi agresifse (3 ayda 10 kişi) çalışmaz çünkü trial week paralelize edilemez. Ama butik ekipler için (yılda 3-5 hire) ideal fit.

Hiring for async-first bir disiplindir, süreç tasarımıdır. Trial week, written assessment ve senkron ön-yargısını kırma kültürü yansıtır — hız yerine derinlik, performans yerine tutarlılık, karizma yerine döküman. Bu yapı şirketin ilk 10 kişisinden 100. kişisine kadar scale eder çünkü temel özelliği kültürel continuity sağlamaktır.