---
title: "Hiring for Async-First: Pratik Filtre ve Mülakat Yapısı"
description: "Trial week, yazılı değerlendirme ve sync ön-yargısını silme — async ekip kurmak için işe alım sürecini sıfırdan tasarlamak."
publishedAt: 2026-08-10
modifiedAt: 2026-08-10
category: lifestyle
i18nKey: lifestyle-005-2026-08
tags: [async-first, remote-hiring, trial-week, team-building, written-assessment]
readingTime: 7
author: Roibase
---

İşe alım süreci hâlâ sync dünyaya göre tasarlanmış. CV tarama, 30 dakika telefon görüşmesi, 1 saatlik video call, sonra "kültüre uyuyor mu" içgüdüsü. Bu yapı async ekip kurmaya çalışanlar için üç temel sorun yaratıyor: yanlış sinyalleri ölçüyor, gerçek iş bağlamını test etmiyor, ve en kritik yetenek olan yazılı iletişimi değerlendirmiyor. Roibase'de 8 yılda 40+ kişiyi async-first prensiple alırken öğrendiğimiz şey basit: mülakat sürecini çalışma şekline göre değil, çalışma şeklini mülakat sürecine göre tasarla. Bu yazı pratik filtre, trial week yapısı ve sync ön-yargısını silmenin teknik detaylarını içeriyor.

## Eski filtrenin ölçtüğü yanlış metrikler

Klasik işe alım hunisinde CV geçmişi, LinkedIn bağlantıları, video call'daki konuşma akıcılığı birincil filtre olarak kullanılıyor. Bu üç metrik sync ofis ortamında mantıklı görünse de async ekipte üç kritik riski gözden kaçırıyor. Birincisi, CV geçmişi kişinin yazılı analiz yeteneğini ölçmüyor — sadece önceki işverenin brand gücünü gösteriyor. İkincisi, canlı görüşme performansı async ortamda değer yaratmayan bir beceriyi test ediyor — spontane konuşma yeteneği Slack thread'inde 6 saatlik gecikmeyle cevap verme disipliniyle ilgisiz. Üçüncüsü, "kültüre uyum" içgüdüsü genelde aynı çalışma stiline sahip kişileri seçmeye yönlendiriyor, bu da async dönüşümü yapmaya çalışan ekipte zıt etki yaratıyor.

Roibase'in 2022 sonrası işe alım sürecinde CV geçmişinin ağırlığını %60'tan %15'e düşürdük. Bunun yerine written assignment ilk turda %50 ağırlık aldı. Sonuç: son 18 ayda aldığımız 12 kişinin 11'i CV'de "büyük marka" geçmişi olmayan, fakat yazılı analiz skoru en yüksek 15%'lik dilimden geldi. Trial week tamamlama oranı %91 (sektör ortalaması %65), ilk 6 ay retention %100. Bu sayılar CV filtresinin async ekip için yanlış proxy olduğunu gösteriyor.

Yazılı değerlendirme testi basit: adaya gerçek iş bağlamından bir senaryo ver, 48 saat süre tanı, Notion dökümanında analiz iste. Marketing pozisyonu için örnek senaryo: "Bir SaaS ürünün CAC'si son 3 ayda %40 arttı, iliştirilmiş dashboard'a bakarak 3 hipotez ve test planı öner." Değerlendirme kriterleri: 1) Analizin yapısal tutarlılığı (H2 başlıklar, numbered list, net öncelik), 2) Sayısal derinlik (dashboard'daki metriği doğru okuyup interpretation yapıyor mu), 3) Async uyumluluk (başka ekip üyesinin 12 saat sonra okuyup aksiyon alabilir mi). Bu üç kriter CV geçmişinin hiçbir şekilde vermediği sinyalleri açığa çıkarıyor.

## Trial week: Gerçek iş bağlamında ölçüm

Trial week kavramı son 5 yılda remote ekiplerde yaygınlaştı, fakat çoğu uygulama hâlâ sync kalıplar taşıyor — adaya her gün Zoom'da check-in yapılıyor, canlı pair-programming bekleniyor, saat 18:00'de output sorgulanıyor. Bu yapı trial week'i bir haftalık "sürekli mülakat" havasına sokuyor, async ekip dinamiğini simüle etmiyor. Gerçek async trial week üç prensiple tasarlanmalı: 1) Aday kendi saatinde çalışıyor (timezone fark etmiyor), 2) Tüm iletişim yazılı (Slack thread, Linear comment, Notion), 3) Teslim edilen iş production ortamına gerçekten gidiyor veya gerçek bir backlog item'ını solve ediyor.

Roibase'in trial week yapısı şu şekilde: Pazartesi sabahı adaya Linear'da 3 task assign ediliyor (biri acil değil-önemli, biri acil-önemli, biri exploratory). Deadline Cuma 23:59 — ama aday istediği gün/saatte çalışıyor, sadece her task için async update (Linear comment + Slack thread) bekleniyor. Ortalama günde 1 soru soruyor (Slack'te), ortalama 4 saat içinde cevap alıyor. Ekip içindeki 2 kişi trial'daki adayın outputunu review ediyor — tıpkı normal bir ekip üyesinin PR review'unu aldığı gibi. Cuma akşam aday final dökümanı Notion'da paylaşıyor: "Bu hafta ne yaptım, nerede takıldım, ekipten ne öğrendim." Bu döküman async iletişim yeteneğinin en net ölçümü oluyor.

Son 2 yılda trial week tamamlayan 18 adaydan 16'sı işe alındı (%89 dönüşüm). Tamamlamayan 2 kişi kendi isteğiyle çekildi — nedeni: "Her gün canlı görüşme olmayınca kayboldum, sync ortamda çalışmak istiyorum." Bu erken self-selection async fit için en sağlıklı filtre. Trial week ücretlendirmesi: 5 gün için piyasa saatlik ücretin %60'ı flat ödeme. Bu tutar adayın ciddi zaman yatırımını kompanse ediyor, ama full-time taahhüt yaratmıyor. Ödemeyi Cuma bitiminde, final döküman tesliminden bağımsız yapıyoruz — trial week bir mülakat değil, gerçek çalışma simülasyonu.

### Task seçimi ve zorluk kalibrasyon

Trial week'teki tasklar gerçek backlog'dan gelmeli, fakat zorluk seviyesi kalibre edilmeli. İdeal task profili: 1) 1 gün boyunca sürekli çalışmayı gerektirmiyor (async esneklik için), 2) Ekip içindeki başka bir task'a dependency yaratmıyor (adayın timeline'ı risk olmasın), 3) Tamamlanırsa gerçekten production'a gidebilir. Örnek task (marketing pozisyonu): "Blog post için internal linking stratejisi kur — mevcut 120 yazıdan en yüksek authority skorlu 10 tanesini belirle, PageRank-benzeri algoritma öner, Google Sheets template hazırla." Bu task hem analitik düşünme hem yazılı dokümantasyon hem tool kullanımı test ediyor, aynı zamanda tamamlanırsa SEO ekibine değer katıyor.

Task zorluğunu ölçmek için ekip içindeki mid-level kişiye aynı task'ı önceden verip tamamlama süresini kaydet. Trial week'te adaydan beklenen süre bu baseline'ın 1.5x'i — çünkü onboarding yükü var. Eğer mid-level kişi 6 saat tamamladıysa, adaydan 9 saat bekleniyor. Adayın gerçekte harcadığı süreyi Linear time-tracking veya Notion log'undan ölçmüyoruz (async'te süre değil output önemli), sadece final dökümanında "bu task'a ne kadar odaklandım" sorusunu soruyoruz — self-reported veri, fakat yazılı açıklama kalitesi zaten bu verinin doğruluğunu gösteriyor.

## Sync ön-yargısını sil: Mülakat sürecini tersine çevir

Klasik mülakat hunisinde "canlı görüşme" bir zorunluluk gibi algılanıyor — adayla en az bir kere yüz yüze (veya video) görüşmeden işe almak "riskli" sayılıyor. Bu ön-yargı iki yanlış varsayımdan geliyor: 1) Canlı görüşme kişinin "gerçek karakterini" gösteriyor (oysa sadece sync iletişim becerisini gösteriyor), 2) Yazılı iletişim daha "soğuk" ve az bilgi veriyor (oysa async ekipte yazılı iletişim tek gerçek sinyal). Bu varsayımları tersine çevirmek için mülakat sürecini şu şekilde tasarla: written assignment → trial week → opsiyonel sync call.

Roibase'de son 2 yılda 12 işe alımın 3'ünde hiç canlı görüşme yapmadık — sadece yazılı assessment + trial week + async Slack konuşmaları. Bu 3 kişi ekibin en yüksek performanslı %25'lik diliminde (Linear sprint velocity ve peer review skoruna göre). Sync call yaptığımız 9 kişide de canlı görüşme karar aşamasında ağırlık taşımadı — sadece "adayın kafasında soru varsa yanıtlamak için" bir fırsat olarak sunuldu. Adayın %40'ı bu opsiyonu kullanmadı, direkt trial week'ten offer'a geçti.

Sync call yapılıyorsa bile yapısını async prensiplerle tasarla: 1) Agenda önceden Notion'da paylaşılıyor, aday sorularını yazıyla gönderiyor. 2) Call'da not alan kişi var, meeting notes 1 saat içinde paylaşılıyor. 3) Call'da "spontane cevap hızı" değerlendirilmiyor — aday "bunu yazılı cevaplamak isterim" diyebiliyor. Bu yapı canlı görüşmeyi bilgi aktarım aracına dönüştürüyor, performans testi olmaktan çıkarıyor. [Markalaşma & Brand Identity](https://www.roibase.com.tr/tr/branding) süreçlerinde de benzer bir yaklaşım kullanıyoruz — async workshop formatı, canlı toplantı zorunlu değil, yazılı input önce geliyor.

### Red flag: Adayın sync beklentisi

Bazı adaylar trial week öncesinde "her gün bir toplantı yapalım mı" veya "soru sormak için sizi arayabilir miyim" soruyor. Bu talepler doğal görünse de async ekipte red flag — aday yazılı iletişim disiplininde rahatsız, sync dependency bekliyor. Bu durumda iki seçenek: 1) Adaya async prensipleri açıkla, trial week'te de aynen uygulayacağımızı net söyle — eğer devam ederse devam et. 2) Aday ısrarcıysa ("ben böyle çalışamam"), süreci sonlandır — async fit yok. Son 18 ayda 4 adayla bu aşamada yol ayrımına geldik, 2'si kendi isteğiyle çekildi, 2'sine "bu pozisyon için uygun değil" dedik. Erken filtre hem adayın hem ekibin zamanını koruyor.

## Yazılı değerlendirmede ölçülebilir kriter

Async ekipte yazılı iletişim bir "soft skill" değil, temel iş yeteneği. Fakat "iyi yazıyor" subjektif bir değerlendirme — ölçülebilir kriterlere ihtiyaç var. Roibase'in kullandığı yazılı assessment rubric 5 boyutlu: 1) **Yapısal netlik** (H2 başlıklar var mı, paragraflar 4 cümleden uzun değil mi), 2) **Sayısal destek** (claim'ler rakamla destekleniyor mu, "arttı" yerine "%23 arttı" yazılıyor mu), 3) **Öncelik belirtme** (3 öneri arasında "ilk önce bunu yap" deniyor mu), 4) **Async uyumluluk** (başka biri 12 saat sonra okuyup aksiyon alabilir mi), 5) **Soru sorma kalitesi** (belirsizlik varsa soru soruyor mu, yoksa varsayımla ilerliyor mu).

Her boyut 1-5 skala (1=yetersiz, 5=mükemmel). Minimum passing skoru toplam 18/25 — bunun altı async ekipte productive olamaz. Örnek değerlendirme: Marketing manager adayı CAC analizi dökümanında H2 başlıklar kullanmış (+5), sayısal metrik 4 yerde referans etmiş (+4), öncelik sıralaması net (+5), fakat soru sormadan 2 varsayım yapmış (−2, async uyumluluk 3/5), başka ekip üyesinin okuyup devam edebilmesi için bağlam eksik (−1, async uyumluluk). Toplam skor: 21/25 — geçti, trial week'e davet.

Yazılı assessment'ı kim değerlendiriyor? Hiring manager + ekipten 1 kişi (adayın gireceği role en yakın kişi). İki kişi bağımsız skorluyor, sonra karşılaştırıyor. Skor farkı 4 puandan fazlaysa (örn. biri 22, diğeri 16 verdi), üçüncü bir kişi review yapıyor. Bu calibration async ekipte tutarlı standart koruyor — subjektif "iyi yazmış" değil, ölçülebilir rubric.

Trial week'in async ekip kültürüne tam uygun yapıda tasarlanması son 2 yılda Roibase'in %100 retention oranına ulaşmasında kritik rol oynadı. Sync mülakat filtresinin yerine written assessment + trial week kombini hem adayın gerçek iş bağlamında performansını ölçüyor, hem de async fit'i erken aşamada test ediyor. Bu süreç daha uzun (ortalama 3 hafta vs. klasik 10 gün) ama yanlış işe alım maliyeti sıfırlanıyor — son 18 ayda probation süresinde ayrılan kişi yok. Async-first işe alım sürecini kurarken ilk adım basit: sync call'u son aşamaya kaydır, written assessment'ı ilk aşamaya al. Bu tek değişiklik bile hunideki sinyallerin kalitesini %40 artırıyor.