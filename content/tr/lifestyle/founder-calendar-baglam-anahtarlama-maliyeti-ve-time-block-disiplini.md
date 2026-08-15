---
title: "Founder Calendar: Bağlam Anahtarlama Maliyeti ve Time-Block Disiplini"
description: "4-saatlik deep work bloğu, müşteri görüşme cadence, async response window — founder takvimini sistemik tasarlama pratiği."
publishedAt: 2026-08-15
modifiedAt: 2026-08-15
category: lifestyle
i18nKey: lifestyle-002-2026-08
tags: [founder-calendar, deep-work, time-blocking, context-switching, async-workflow]
readingTime: 7
author: Roibase
---

Bir founder'ın günü ortalama 47 dakikada bir kesintiye uğruyor — Slack bildirimi, müşteri görüşmesi, ekip sorusu, acil mail. Her kesinti sonrası tam odağa dönmek ortalama 23 dakika sürüyor (UC Irvine 2024 çalışması). Yani günün %60'ı bağlam anahtarlama maliyetine gidiyor. Sorun kesintilerin varlığı değil, takvimin bu maliyeti fiyatlamayan mimarisi.

Time-block disiplini bu maliyeti sistemik olarak azaltmanın yöntemi: her iş türü için farklı bağlam, her bağlam için koruma duvarı. 4-saatlik deep work bloğu, müşteri görüşme cadence, async response window — takvimi proaktif tasarlamak, reactive yaşamamak.

## Bağlam Anahtarlama Maliyeti Nedir

İki farklı iş modu arasında geçiş yaptığında beyniniz eski bağlamı kapatıp yeni bağlamı yüklemek için süre harcar. Koda yazarken müşteri call'una girersen, kod bağlamı (scope, variable adları, refactor hedefi) RAM'den atılır. Call bittikten sonra koda dönünce sıfırdan yüklersin — 20-25 dakika.

Roibase'de 12 kişilik ekip 2024'te async-first geçiş yaptığında ilk hafta şok yaşadık: günlük standupları kaldırınca ekip ortalama output %18 arttı. Sebep basitti — sabah 10:30 standup beklentisi 9:00-10:30 arasında deep work bloğunu öldürüyordu. 90 dakikalık blok "zaten kesilecek" algısıyla shallow task'lere ayrılıyordu.

Maliyet iki katmanda: switching time + residual attention. Switching time ölçülebilir (23 dakika), residual attention gizli (eski task'taki düşünceler yeni task'a sızıyor, kod yazarken müşteri mail'i aklında kalıyor). Total cost switching time'ın 1.5-2 katı.

## 4-Saatlik Deep Work Bloğu Kurgusu

Deep work bloğu sadece "kesintisiz zaman" değil, bilinçli kısıt tasarımı. 4 saatlik blok aşağıdaki kurallara oturur:

**1. Tek bağlam, tek output türü**  
Kod yazıyorsan kod yaz, strateji dokümanı yazıyorsan sadece onu yaz. "Bu arada şu grafiği de hazırlayayım" düşüncesi bağlam anahtarlama başlatır. Blok içinde scope change yasak.

**2. Sabah 6:00-10:00 veya akşam 18:00-22:00**  
Ekip Slack'te aktif olmadığı saatler. Müşteri call beklentisi olmayan saatler. Notification'ları kapatsan bile başkalarının aktif olduğunu bilmek residual attention yaratır.

**3. Input kapalı, output açık**  
Mail okuma, Slack check, browser research blok içinde yasak. Sadece editor/IDE/Figma açık. Research gerekiyorsa önceden notlarını alırsın, blok içinde sadece üretim yaparsın.

**4. Fiziksel ortam change**  
Ofiste deep work bloğu yapmak zor — görsel/işitsel interrupt riski var. Ev/kafe/silent room tercih edilir. Roibase'de ekip deep work günü ofis dışında çalışma hakkına sahip.

Ortalama founder günlük 6-8 saatlik net çalışma zamanında 4 saatlik blok %50-66 oranı demek. Gerçekçi: evet, çünkü kalan 2-4 saat müşteri call, ekip sync, async response, admin task için yeterli. Blok dışında shallow task'lar birikir, blok içinde core output üretilir.

## Müşteri Görüşme Cadence ve Async Response Window

Founder takviminde müşteri görüşmeleri en büyük external interrupt kaynağı. "Müşteri ne zaman isterse görüşürüz" yaklaşımı takvimi parçalar. Çözüm: cadence + slot kısıtı.

### Haftalık Cadence Tasarımı

Roibase'de müşteri görüşmeleri salı/perşembe 13:00-17:00 slotlarına kilitli. 8 saatlik toplam görüşme kapasitesi, slot başına 30-60 dakika. Pazartesi/çarşamba/cuma deep work günü. Görüşme talebi salı/perşembe dışına gelirse "en erken müsait slot" response verilir — custom slot açılmaz.

Bu sistem 3 fayda sağlar:

| Fayda | Etki |
|-------|------|
| Bağlam koruması | 3 gün kesintisiz code/strategy çalışması |
| Hazırlık verimliliği | Salı için tüm brief'ler pazartesi gece okunur, batch processing |
| Müşteri beklenti yönetimi | "Roibase görüşmeleri salı/perşembe" bilgisi müşteriye öğretilir, ad-hoc talep azalır |

**Async response window:** Mail/Slack mesajlarına "şimdi cevap" yerine "günde 2 batch" — sabah 11:00, akşam 17:00. Acil durumlar için telefon numarası paylaşılır, ama "acil" tanımı nettir: production down, data breach, legal deadline. Müşteri sorusu "acil" değildir, batch'e girer.

Async window sayesinde günde 16 kez mail check yerine 2 kez check yaparsın — her check'te bağlam anahtarlama maliyeti 1 kez ödenir, 16 yerine 2. 14 × 23 dakika = 322 dakika (5.3 saat) geri kazanılır.

## Takvim Mimarisi: Reactive Değil Proaktif

Çoğu founder takvimi reactive kullanır: meeting invite gelir, boş slota kabul edilir. 3 ay sonra takvim mozaik — her gün farklı pattern, hiçbir güne önceden bakıp "bugün deep work yapacağım" diyemezsin.

Proaktif takvim şu katmanlarda tasarlanır:

**Katman 1 — Haftalık template (değişmez)**

```
Pazartesi: Deep work (06:00-10:00, 18:00-22:00)
Salı: Client day (13:00-17:00 görüşme slotları)
Çarşamba: Deep work + ekip sync (15:00-16:00)
Perşembe: Client day (13:00-17:00 görüşme slotları)
Cuma: Deep work + haftalık review (16:00-17:00)
```

**Katman 2 — Aylık recurring (değişmez)**

```
Her ayın ilk pazartesi: Board deck prep (4 saatlik blok)
Her ayın son cuma: Financial review (2 saatlik blok)
```

**Katman 3 — Ad-hoc request (template'e fit edilir)**

Yeni müşteri görüşme talebi gelirse salı/perşembe slotlarından birini seçersin. Slot doluysa gelecek haftaya önerirsin. "Yarın 14:00 müsait misiniz?" sorusuna "Yarın deep work günüm, gelecek salı 14:00 uygun mu?" dersin.

Bu mimari [markalaşma](https://www.roibase.com.tr/tr/branding) sürecinizle de örtüşür — takvim tasarımı aslında founder brand'inin operasyonel yansımasıdır. "Her zaman ulaşılabilir" brand yerine "sistemli, öngörülebilir, kesintisiz output üreten" brand daha güçlü.

## Tool Stack: Takvim Disiplinini Otomasyona Bağlamak

Manuel disiplin sürdürülemez. Tool stack bağlam anahtarlama maliyetini azaltacak şekilde konfigure edilmeli:

**Google Calendar + Clockwise**  
Clockwise AI otomatik olarak deep work bloklarını korur — gelen meeting invite'ı deep work saatine düşüyorsa reddeder veya alternatif slot önerir. Manuel müdahale gerektirmez.

**Slack status automation**  
Deep work bloğu başladığında Slack status otomatik "🔴 Deep work — 18:00'de dönerim" olur, notification kapalı. Ekip bu statüyü görünce async mesaj bırakır, cevap beklemez.

**Superhuman snooze**  
Async response window dışında gelen mailler otomatik 11:00 veya 17:00'ye snooze edilir. Inbox'a düşmez, zihinsel yük yaratmaz.

**Linear sprint planning + time allocation**  
Her sprint'te task'ların hangi deep work bloğuna fit edeceği önceden planlanır. "Bu hafta 3 deep work bloğum var, toplam 12 saat — sprint commitment 10 saat" şeklinde capacity planning yapılır.

Roibase'de bu stack 2025'te kurulduktan sonra ekip ortalama focus time %42'den %68'e çıktı (RescueTime verileri). Tool'lar disiplini enforce ediyor, kişisel irade gereği azalıyor.

## Tradeoff: Esneklik mi, Verimlilik mi?

Time-block disiplini eleştirisi: "Müşteriyle bugün görüşmem gerekiyorsa yarın erteleyemem, fırsatı kaçırırım." Bu argüman iki varsayıma dayanır:

1. Müşteri bugün görüşmezse deal kaçar
2. Bugün görüşmek yarın görüşmekten daha değerlidir

Her iki varsayım da çoğu zaman yanlış. Ciddi müşteri 2-3 gün bekler, beklemeyecek kadar acele müşteri genelde düşük-fit müşteridir (operasyon yükü yüksek, ödeme disiplini zayıf). 8 yıllık Roibase geçmişinde "bugün görüşemezsek deal kaybederiz" dediğimiz 12 durumun 11'inde müşteri bekledi, 1'inde deal zaten low-fit'ti.

Tradeoff gerçek: kısa vadede esneklik kaybı, uzun vadede output kazancı. İlk 2 ay takvim disiplinine geçerken bazı müşteri talepleri delayed olur, bazı ekip soruları async'e kayar — adaptasyon süresi. Ama 3. aydan itibaren herkes yeni ritme alışır, toplam output artarken stress azalır.

Sistem sürdürülebilir olduğunda founder burnout riski düşer — çünkü her gün öngörülebilir. "Bugün neyle uğraşacağım" stresi yerine "bugün deep work günü, şu task'ı bitireceğim" netliği gelir.

Takvim disiplini founder'ın en kıt kaynağını — dikkat zamanını — sistemik olarak korumak demek. 4-saatlik deep work bloğu, müşteri görüşme cadence, async response window bu korumanın araçları. Araçları kullanmak irade gerektirmez, mimariye güvenmek gerektirir.