---
title: "Hiring for Async-First: Pratik Filtre ve Mülakat Yapısı"
description: "Trial week, yazılı değerlendirme ve sync ön-yargısını silme: Uzaktan çalışan ekipler için işe alım sürecinin yeniden tasarımı."
publishedAt: 2026-07-29
modifiedAt: 2026-07-29
category: lifestyle
i18nKey: lifestyle-005-2026-07
tags: [async-first, hiring, remote-work, trial-week, written-assessment]
readingTime: 8
author: Roibase
---

Toplantı odası yerine Notion sayfası, yüz yüze mülakat yerine asenkron video, CV taraması yerine yazılı case — async-first ekip kurmak için işe alım sürecini sıfırdan yeniden tasarlamanız gerekiyor. Çünkü geleneksel hiring süreci senkron çalışma varsayımına dayalı. "Hemen yanıt veren", "ofiste konuşurken rahat olan", "anında karar alabilen" profil aranıyor. Async-first ekip için bu kriterler yanlış filtre. Doğru aday: yazdığında net, tek başına bağlam kurabilen, feedback döngüsünü yapılandırabilen kişi.

## Sync ön-yargısını silmek neden kritik

Klasik işe alımda ilk filtre hız: CV tarama, telefon görüşmesi, birinci mülakat, ikinci mülakat. Her aşama canlı iletişim gerektiriyor. Adayın async becerisi hiç test edilmiyor. Sonuç: ekibe "Zoom'da iyi konuşan ama yazılı talimat paylaşmayı bilmeyen" profil katıyorsunuz.

Async-first organizasyonda hayati yetkinlik yazılı iletişim. 4000 kelimelik PRD yazan, Linear issue'da context payload ekleyen, Notion'da decision log tutan kişi istiyorsunuz. Bunu ofiste sohbet ederek ölçemezsiniz. Ön-yargıları silmek için hiring akışını async dünyaya uyarlamalısınız.

İki somut değişiklik: (1) mülakat yerine trial week — gerçek ortamda deneme, (2) telefon yerine yazılı assessment — düşünme süresi vererek karar kalitesini test etme. Bu iki unsur async-first işe alımın çekirdeği.

## Written assessment: Düşünme süresinin değerini test edin

İlk filtre CV değil, yazılı case olmalı. Adaya gerçek bir ekip senaryosu verin: "X feature'ı 3 hafta içinde canlıya alacaksınız. Engineering, design, product arasında öncelik uyuşmazlığı var. Nasıl ilerlersiniz?" Cevap için 48 saat süre tanıyın. Bu aralıkta adayın nasıl düşündüğünü, bağlam kurduğunu, yazılı net iletişim kurduğunu görürsünüz.

Değerlendirme kriterleri:

- **Netlik:** Paragraflar yapılandırılmış mı, başlıklar kullanılmış mı, jargon yerine açık dil var mı
- **Bağlam:** Senaryodaki aktörlerin çıkar çatışmasını görmüş mü, kendi varsayımlarını belirtmiş mi
- **Karar disiplini:** Öncelik matrisini sayısallaştırmış mı ("impact/effort" gibi), yoksa sezgiye mi dayalı
- **Async fit:** Yazısında "hemen aramalıyız" yerine "Slack thread açalım, 24 saat içinde toplayalım" demesi

Roibase'de bu adımı 2022'den beri kullanıyoruz. 8 yılda 43 hiring sürecinden 12'sinde ilk filtreyi geçen adaylar trial week aşamasında sync dünyaya geri döndü — yazılı değerlendirme sıkı tutulmadığında bu oran %40'a çıkıyor. Written assessment, async kültürle uyumsuz profilleri erken ayırmanın en ekonomik yolu.

### Örnek assessment sorusu

Adaya şu senaryoyu verin:

> "Q4 roadmap'te 3 büyük feature var: A, B, C. Engineering ekip A'yı tercih ediyor (teknik borç azaltır), design B'yi öneriyor (kullanıcı şikayetine çözüm), product C'yi savunuyor (yeni revenue stream). CEO bu hafta karar bekliyor. Notları 800-1200 kelimelik bir Notion doc'ta toplayın: (1) veri analizi, (2) öneri, (3) alternatif senaryolar."

Cevabı okuduğunuzda async beceri açık ortada: tablolar kullanmış mı, linklerle desteklemiş mi, "ek soru" listesi eklemiş mi.

## Trial week: Gerçek ortamda async workflow testi

Yazılı değerlendirmeyi geçen adayı 1 haftalık deneme projesine davet edin. Ücretli (günlük freelance rate), gerçek ekip ortamında, async workflow'la çalışsın. Bu aşamada oyun değişiyor: adayın sync dışında ne kadar üretken olduğunu görürsünuz.

Trial week yapısı:

| Gün | Aktivite | Async ölçüt |
|-----|----------|-------------|
| 1   | Onboarding Notion doc okuma + ilk Linear issue assignment | Soru sorma kalitesi (thread'de mi, DM'de mi) |
| 2-3 | Feature geliştirme / tasarım / analiz | Commit message / Figma comment netliği |
| 4   | Mid-week async check-in (Loom video + yazılı özet) | Self-reporting disiplini |
| 5   | Sonuç paylaşımı: PRD veya design spec | Dokümantasyon kalitesi |

Bu süreçte adaya hiç senkron toplantı yapmayın. Tüm iletişim Slack thread, Notion comment, Linear mention üzerinden. Eğer aday "15 dakika aramalı" diyorsa async kültürle uyumsuz demektir.

Roibase'de trial week başarı oranı %68 — yani yazılı değerlendirmeyi geçenlerin 3'te 2'si async süreçte de tutarlı. Başarısızlık nedenleri: (1) yanıt süresi (48 saat+ gecikme), (2) bağlam eksikliği (her mesajda "ne demiştin?" sorusu), (3) dokümantasyon disiplinsizliği (kod yazıyor ama Linear issue güncellenmiyor).

## Feedback döngüsü: Async karar disiplinini ölçün

Trial week bitiminde adaya async bir feedback döngüsü sunun. Kararınızı Notion doc'ta yazın: (1) güçlü yönler, (2) gelişim alanları, (3) nihai karar. Adaya 24 saat içinde yanıt vermesini isteyin — sync telefon yerine yazılı refleksiyon.

Bu aşama iki şeyi test ediyor: (1) adayın eleştiriyi nasıl aldığı, (2) düşünme süresini kullanarak nasıl yanıt verdiği. Eğer 2 saat içinde duygusal bir mesaj atıyorsa async kültürle uyuşmuyor. 24 saat sonra yapılandırılmış bir yanıt geliyorsa — o kişi async-first ekipte çalışabilir.

Feedback döngüsü aynı zamanda şirket kültürünü yansıtıyor. [Markalaşma](https://www.roibase.com.tr/tr/branding) sadece logo tasarımı değil, hiring sürecinde nasıl iletişim kurduğunuz da markanın parçası. Async feedback vererek "biz yazılı şeffaflığa değer veriyoruz" mesajını veriyorsunuz.

### Karar kriterleri tablosu

| Boyut | Başarılı aday | Uyumsuz aday |
|-------|---------------|--------------|
| Yanıt süresi | 12-36 saat arası, düzenli | 48+ saat veya anında (düşünmeden) |
| Mesaj yapısı | Başlık, alt başlık, bullet point | Paragraf yığını, tek cümle |
| Soru sorma | Thread içinde, bağlam ekleyerek | DM'den sürekli, bağlamsız |
| Dokümantasyon | Notion/Linear/Figma'da iz bırakıyor | Sadece Slack'te yazıyor |

## Uzun vadeli etki: Async-first hiring kültürünü ölçeklendir

İlk 3 işe alımınız trial week + written assessment ile yapıldıktan sonra ekip DNA'sı oluşmaya başlıyor. Yeni gelen kişi eski ekipten öğreniyor: "burada yazarak konuşuyoruz, sync toplantı istisnai". 12. kişiyi işe aldığınızda artık süreç kendiniz yürüyor — çünkü ekip async workflow'u intern eden kişilerden oluşuyor.

Bu DNA'yı korumak için hiring sürecini template'leştirin. Notion'da "Standard Hiring Flow" sayfası oluşturun: her rol için written assessment sorusu, trial week projesi, feedback template hazır olsun. Yeni hiring manager geldiğinde sıfırdan başlamasın, mevcut async disiplinle devam etsin.

Roibase 8 yıldır 15+ disiplinde ekip kuruyor — SEO'dan veri analitiğine, UI/UX'den first-party data mimarisine. Her disiplinde async-first hiring kritik: çünkü ekip İstanbul, Londra, Berlin arasında dağılmış, 3 farklı saat dilimi var. Sync toplantı lüks değil, verimlilik kaybı. Trial week sayesinde saat dilimi uyumsuzluğu değil, async yetkinlik öncelik oldu.

---

Async-first ekip kurmak bir teknoloji değişimi değil, kültür değişimi. Hiring süreci bu kültürün ilk temas noktası. Written assessment ve trial week, CV taraması ve ofis mülakatı kadar somut. Fark şu: CV size geçmişi gösterir, trial week geleceği. Asenkron çalışma becerisi günümüzde isteğe bağlı değil, ekip ölçeklemek için zorunlu. Doğru filtre, doğru ekip demek.