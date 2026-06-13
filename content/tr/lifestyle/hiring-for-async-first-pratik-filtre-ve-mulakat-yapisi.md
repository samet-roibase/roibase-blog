---
title: "Hiring for Async-First: Pratik Filtre ve Mülakat Yapısı"
description: "Trial week, yazılı değerlendirme ve sync ön-yargısını silmek için ölçülebilir işe alım süreci. Async çalışma kültürünün işe alım aşamasında nasıl kurulduğunu keşfedin."
publishedAt: 2026-06-13
modifiedAt: 2026-06-13
category: lifestyle
i18nKey: lifestyle-005-2026-06
tags: [async-first, hiring, remote-work, trial-week, team-culture]
readingTime: 8
author: Roibase
---

Async-first çalışma kültürü kurmak, işe alım sürecinde başlar. "Esnek çalışıyoruz" diyip Zoom mülakatıyla başlayan süreç, zaten sync-bias taşır. Aday ilk 30 dakikada senkron performans baskısı hissediyorsa, sonraki altı ayda yazılı iletişime geçemez. Async çalışma kültürünün ölçülebilir temeli vardır: response time, async doc kalitesi, bağımsız karar alma hızı. Bu temeli işe alım aşamasında kurmayan ekipler, sonra "neden her şey toplantıda çözülüyor" diye şikayet eder.

Bu yazı, async-first işe alımı pratik bir süreç haline getiriyor. Trial week, yazılı değerlendirme ve senkron ön-yargısını silen filtre mekanizmaları — sekiz yıllık ekip kurma deneyiminden gelen somut yapı.

## Sync mülakat ön-yargısını kırmak

Geleneksel mülakat formatı, "30 dakikada biri tanı" baskısı yaratır. Aday, hazırladığı cevapları sıralar. Mülakat eden, "vibe check" yapar. Async kültür için en önemli beceri — yazılı düşünme, bağlamı koruma, özerk karar alma — hiç test edilmez. Sonuç: ekip büyüdükçe Slack'te @channel artar, Linear ticket'ları boş kalır.

İlk adımı atmak için mülakat öncesi yazılı değerlendirme gerekir. "Bize neden katılmak istiyorsun?" yerine somut senaryo ver: "Bu ürünün conversion rate'ini %15 artırmak için hangi beş değişikliği test edersin? Her birini nasıl ölçersin?" Google Doc'ta 48 saat süre ver. Minimum 500 kelime, maksimum 1000. Bu formatın iki değeri var: aday zamanını kendi organize eder (async discipline), düşünceyi yapılandırma kalitesini görürsün.

48 saatlik yanıt süresi, aynı zamanda "nasıl çalışıyorsun" bilgisi verir. Deadline'dan 2 saat önce gönderen aday, son dakika kültürü taşır. 24 saat içinde yollayan, hızlı karar alır ama belki revize derinliği yoktur. 36-40 saat aralığında, iyi yapılandırılmış metin gönderen adayda async disiplin zaten var — bu kişi ilk haftadan remote context'e uyum sağlar.

## Trial week yapısı: teoriden pratiğe

Trial week, "ücretli test projesi" olarak tasarlanır. Standart contract: 5 gün, saatlik $50-75 (seniority'e göre), gerçek proje. "Simülasyon" yapma — adayı Linear'a ekle, Notion workspace'ine davet et, Figma comment yetkisi ver. İlk günden gerçek iş akışında çalışsın.

İlk gün: tek senkron onboarding call (30 dakika). Ekip yapısını, tool stack'i, async iletişim kurallarını anlat. "Sabah 9-5 çevrimiçi ol" deme. "Linear ticket'ı 24 saat içinde güncelle, Figma comment'a 12 saat içinde yanıt ver" de. Ölçülebilir beklenti koy.

İkinci-beşinci gün: tamamen async. Adaya küçük ama gerçek bir proje ver. Örnekler: landing page A/B test hipotezi + wireframe, BigQuery query + veri dashboard, content brief + ilk taslak. Proje boyutu: 15-20 saat iş. Trial week = 40 saat değil, 20 saat iş + 20 saat "nasıl çalıştığını" gözlemleme süresi.

Gözlemlediğin metrikler:
- Linear ticket update sıklığı (günde minimum 1)
- Async soru kalitesi (Slack'te "bu nasıl yapılır?" yerine "A ve B yöntemi arasında X kritere göre tercih yaptım, onay için bekliyorum")
- Doc/Figma comment derinliği (tek cümle yorum = düşük, 3-4 paragraf context + alternatif = yüksek)
- Deadline öncesi proaktif güncelleme ("yarın bitecek" yerine "bugün %60 tamamlandı, kalan kısım için ek 6 saat gerekiyor")

Trial week sonunda iki senkron call daha: mid-week check-in (15 dakika, opsiyonel) ve final review (45 dakika). Final review'da proje çıktısını değil, süreç disiplinini konuş. "Neden bu yaklaşımı seçtin?", "Hangi noktada takıldın, nasıl çözdün?" sorularına yazılı düşünme yapısıyla yanıt verebiliyorsa async-ready.

## Yazılı değerlendirme skoru: objektif kriter

Trial week bittiğinde subjektif "beğendim/beğenmedim" değil, ölçülebilir kriter gerek. Roibase'in kullandığı async işe alım skoru dört boyutlu (her biri 1-5 puan):

**1. Async communication clarity (1-5):**
- 1 puan: Her mesajda belirsizlik, follow-up soru gerekiyor
- 3 puan: Net ama minimal context, bazen ek bilgi isteniyor
- 5 puan: Tek mesajda context + soru + önerilen çözüm + alternatif

**2. Autonomous decision making (1-5):**
- 1 puan: Her adımda onay bekliyor
- 3 puan: Büyük kararlar için soruyor, küçük detayları kendi alıyor
- 5 puan: Karar aldı, gerekçeyi doc'ta paylaştı, approval için notification gönderdi

**3. Documentation discipline (1-5):**
- 1 puan: Hiçbir şey yazıya dökülmedi, Slack'te kayboldu
- 3 puan: Linear ticket güncel ama detail eksik
- 5 puan: Notion page, Linear ticket, Figma comment hepsi senkronize ve aranabilir

**4. Time management transparency (1-5):**
- 1 puan: Deadline sessizce kaçtı
- 3 puan: Deadline'dan sonra "yetişmedi" dedi
- 5 puan: 48 saat önceden "risk var, plan B önerisi" yazdı

Toplam skor 16-20 = hire, 12-15 = borderline (ikinci trial week düşünülebilir), 11 altı = no hire. Bu sayısal yapı, "gut feeling" yerine takım içi tartışmayı da yapılandırır. İki kişi farklı skor verdiyse, hangi boyutta ayrıştıklarını görüp somut örneklerle konuşabilirsin.

## Senkron mülakat nerede gerekli?

Async-first, "hiç görüşme yok" demek değil. Senkron mülakatı tamamen silmek, kültür fit'i test etmemek demek. Doğru format: async yazılı değerlendirme geçtikten sonra 1-2 senkron call.

İlk senkron call (30 dakika): culture interview. Soracağın sorular önceden gönderilir (Google Doc'ta). Aday 24 saat önce hazırlanır. Görüşmede bu soruları tekrar etmezsin — yazılı yanıtlarının üzerine derinleşirsin. Örnek: "Doc'ta 'özerk çalışmayı tercih ederim' yazmışsın. Özerk kararın yanlış çıktığı bir durumda nasıl davrandın?" Bu format, hem hazırlık disiplini hem anlık düşünme kalitesini ölçer.

İkinci senkron call (45 dakika): technical/strategic depth. Trial week çıktısı üzerinden tartışma. "Bu tasarımda X alternatifini neden seçmedin?" gibi sorular. Async doc'ta yazdıklarını senkron savunabilmesi önemli — çünkü bazı durumlar (client call, sprint retro) gerçek zamanlı tartışma gerektirir. Async-first ekip, "hiç konuşmadan çalış" değil, "senkronu gereksiz kullanma" demek.

Bu iki call, adayın "spontane düşünme" vs. "yapılandırılmış yazılı düşünme" arasındaki tutarlılığını test eder. Eğer doc'ta derinse ama call'da yüzeysel kalıyorsa, başkasının yardımıyla yazmış olabilir. Tersi durumda (call'da iyi, doc'ta zayıf), async disiplin eksik. İkisi de güçlüyse, hem async hem sync context'te çalışabilir.

## İşe alım sürecini async markalama aracı olarak kullanmak

Async-first işe alım süreci, aynı zamanda employer branding aracıdır. Aday, trial week boyunca ekibin gerçek çalışma tarzını görür. Linear ticket'ların nasıl yazıldığını, Figma comment thread'lerinin ne kadar detaylı olduğunu, Notion doc'larının ne kadar güncel tutulduğunu deneyimler. Bu, "biz remote çalışıyoruz" sloganından bin kat güçlüdür.

Trial week sırasında adayı ekip Slack channel'ına al. Public channel'larda ekibin nasıl tartıştığını, async decision log'larını, Friday win paylaşımlarını görsün. "Satış yapmak" için değil, gerçek kültürü göstermek için. Eğer ekip kültürü async disiplinden yoksunsa, zaten bu aşamada belli olur — o zaman önce kendi kültürünü düzelt, sonra işe al.

İşe alım süreci aynı zamanda [markalaşma](/tr/branding) sürecinin operasyonel uzantısıdır. Ekip nasıl çalışır, nasıl iletişim kurar, nasıl karar alır — bunlar brand identity'nin bir parçası. Async-first hiring, bu identity'yi adaya canlı ortamda göstermenin en net yolu. Süreci iyi tasarlarsan, red ettiğin aday bile LinkedIn'de "harika bir deneyimdi" yazar.

## Kapanış: async kültürü ilk günden kur

Async-first çalışma kültürü, işe alım sürecinde kurulamadıysa sonradan da kurulamaz. "Önce işe alalım, sonra öğretir" yaklaşımı, altı ay boyunca Slack'te @here notification'la boğulmak demek. Trial week, yazılı değerlendirme ve sayısal skor sistemi — bunlar "ek yük" değil, async disiplinin temel taşları. Sync mülakat yaparken "remote kültürümüz var" diyemezsin. Süreç ile kültür arasındaki tutarlılık, ekip ölçeklenirken kaos ile disiplin arasındaki farkı yaratır. Async-first hiring, sadece doğru insanı bulmak değil, ekibin nasıl büyüyeceğini tasarlamaktır.