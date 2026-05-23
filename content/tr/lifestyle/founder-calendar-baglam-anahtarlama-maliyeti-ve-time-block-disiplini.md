---
title: "Founder Calendar: Bağlam Anahtarlama Maliyeti ve Time-Block Disiplini"
description: "4 saatlik deep work bloğu nasıl korunur? Müşteri görüşme cadence'ı nasıl optimize edilir? Async response window neden kritik? Ölçülebilir zaman yönetimi."
publishedAt: 2026-05-23
modifiedAt: 2026-05-23
category: lifestyle
i18nKey: lifestyle-002-2026-05
tags: [deep-work, founder-calendar, time-blocking, async-communication, context-switching]
readingTime: 8
author: Roibase
---

Founder takvimi parçalanmış bir savaş alanına dönüşür. Bir müşteri görüşmesi, ardından 20 dakika Slack, sonra 30 dakika analitik, akabinde bir design review. Her geçiş 23 dakika bağlam yükleme maliyeti getirir. Bir günde 8 geçiş yaparsanız, 184 dakika — 3 saat — sadece beynin state'ini değiştirmek için harcanır. Bu matematik "meşgul olmak" ile "üretken olmak" arasındaki farkı açıklıyor.

Roibase'te 8 yıldır uygulanan takvim disiplini: 4 saatlik deep work bloğu korumak, müşteri görüşmeleri için sabit cadence kurmak, async response window tanımlamak. Bu yazı üç prensip etrafında kurulu: bağlam anahtarlama maliyetini ölçmek, time-block'ları yapısal koruma altına almak, iletişim kanallarını senkron/async olarak sınıflandırmak.

## Bağlam Anahtarlama Maliyeti: 23 Dakikalık Gerçek

Bir deep work bloğundan çıkıp müşteri callına geçişte zihinsel state değişir. Cal Newport'un "Deep Work" kitabında belirtildiği gibi, tam konsantrasyona dönüş ortalama 23 dakika sürer. Bu sayı Gloria Mark'ın UC Irvine araştırmasından geliyor — knowledge worker'ların dikkat kayması sonrası yeniden odaklanma süresi.

Founder takviminde günde 6-8 geçiş normalleşirse, gün sonunda 2-3 saat sadece bağlam değiştirmeye harcanmış olur. Strateji kağıdı yazmak, finansal model kurmak, ürün roadmap'ı çizmek gibi yüksek bilişsel yük gerektiren işler bu geçişlerin arasına sıkışırsa tamamlanamaz. 

Roibase'te uyguladığımız kural: sabah 09:00-13:00 arası "maker schedule" — hiçbir toplantı, Slack bildirimi kapalı, sadece kod yazmak / strateji yazmak / tasarım çıkarmak için. Öğleden sonra 14:00-18:00 "manager schedule" — müşteri görüşmeleri, internal review'lar, operational karar toplantıları. Bu yapı, günlük bağlam geçişini 2'ye düşürüyor: maker → manager. Sonuç: 46 dakika yerine 23 dakika kayıp.

## 4 Saatlik Deep Work Bloğu: Yapısal Koruma

Deep work bloğunun korunması için takvim mimarisini değiştirmek gerekir. "Acil olmayan ama önemli" işler için zaman bırakılmazsa, acil olanlar tüm günü yer. Eisenhower matrisinde Quadrant 2 işleri — strateji, öğrenme, sistem kurma — ancak korunan zaman bloklarında yapılabilir.

Roibase'in calendar rule set'i:

| Kural | Açıklama |
|---|---|
| 4-saat blok | 09:00-13:00 asla böl. Minimum 3 saat korunmalı. |
| 15 dakika buffer | Her toplantı arasında. State temizleme, not yazma. |
| 2 günde 1 client day | Tüm müşteri görüşmeleri Salı/Perşembe. Pazartesi/Çarşamba/Cuma maker. |
| Async-first internal | Slack'te acil olmayan sorular 24 saat response window kabul edilir. |

Blok koruma pratikte şöyle işler: Eğer bir müşteri "Pazartesi sabah 10:00 uygun mu?" diye sorarsa, alternatif öneriyoruz: "Salı 14:00 veya Perşembe 15:00". Açıklama yapmıyoruz — "meşgulüm" diyerek bırakıyoruz. Şeffaf olmak "neden meşgulsün?" tartışması açar, o da mental yük. Koruma, yönlendirme yoluyla pasif yapılır.

### Küçük Disiplin: Calendar Event Renk Sınıflandırması

Takvimde her event'i renklendirerek görsel feedback loop'u kurmak, haftalık review'da pattern görmek için kritik:

- **Mavi:** Deep work (kod, yazı, tasarım)
- **Yeşil:** Müşteri görüşmesi
- **Sarı:** Internal review/planning
- **Kırmızı:** Acil operasyonel sorun (ex-post renklendirilir)

Hafta sonu takvime bakıp "4 kırmızı block var" görürsen, kriz yönetimi modu demektir — sistematik sorun araştır. "2 gün boyunca hiç mavi yok" görürsen, o hafta output alamazsın. Bu renk sistemi, zaman kullanımını görsel ölçüm altına alır.

## Müşteri Görüşme Cadence: Toplu Batch İşleme

Her müşteriye 1-2 saatlik slot vermek yerine, haftalık 2 gün müşteri günü tanımlayıp tüm görüşmeleri toplamak, bağlam geçişini azaltır. Bu "batching" prensibi, e-posta managementında işe yaradığı gibi takvimde de işe yarar.

Roibase'te müşteri görüşme format'ı:

| Tip | Süre | Cadence |
|---|---|---|
| Discovery call | 30 dk | İlk görüşme, tek seferlik |
| Kick-off | 60 dk | Proje başlangıcı |
| Monthly review | 45 dk | Haftalık değil, aylık — veri olgunlaşması için |
| Ad-hoc acil | 15 dk | Reactive, nadiren |

Kick-off sonrası müşterilerle haftalık toplantı yapmıyoruz. Asana üzerinden async update + aylık review call. Bunun nedeni: haftalık veri setinde görünen pattern'ler genellikle gürültü. Attribution penceresi 7-14 gün olduğunda, 7. günde karar vermek erken. Aylık cadence, veriyi olgunlaştırır, müşteri de hazırlıklı gelir.

Toplu batch yapmanın yan etkisi: "akışkan gün" yerine "müşteri günü" konsepti. Salı sabah 09:00'dan 18:00'e kadar 6 müşteri görüşmesi varsa, o gün maker work yok. Bu kabul edilebilir, çünkü Pazartesi/Çarşamba/Cuma korunmuş. Hibrit gün — 2 saat maker, 2 saat meeting — her ikisini de zayıflatır.

## Async Response Window: Hız Yanılgısı

Slack mesajına 2 dakikada cevap vermek hızlı olmak değil, kontrol edilemez olmaktır. Async communication'ın avantajı sadece "istediğin zaman cevap ver" değil — "cevabı düşünüp yapılandırarak ver" fırsatıdır. 

Roibase'te async response window tanımlaması:

- **Slack DM:** 24 saat içinde cevap — acil değilse
- **Slack mention:** 12 saat içinde cevap
- **E-posta:** 48 saat içinde cevap
- **Linear comment:** Ticket assign edilmişse 24 saat

Bu window'lar ekip anlaşması — herkes biliyor ki sabah 11:00'de Slack'te mention atınca, cevap 23:00'e kadar gelebilir. Bu belirsizliği kaldırıyor. "Cevap gelmediyse mesajı görmemiştir" varsayımı ortadan kalkıyor.

Acil durumlar için telefon hattı ayrı tutuluyor. "Acil" tanımı: production down, security breach, yasal deadline. Müşteri feedback'i, yeni özellik fikri, pazarlama kampanyası performansı acil değil. Bu ayrım net yapılmazsa, her şey acil hale gelir.

### Async-First Kültürün [Markalaşma & Brand Identity](https://www.roibase.com.tr/tr/branding) ile İlişkisi

Async-first disiplini sadece operasyonel değil, brand positioning'in bir parçası. Roibase'in müşterilere verdiği "tahmin yerine test, iletişim yerine entegrasyon" vaadi, iç kültürde de uygulanıyor. Async communication, email ping-pong yerine structured update, Slack'te "hızlı düşündüm ama yanlış dedim" yerine "24 saat bekledim, doğru dedim" demek.

Bu disiplin, ajansın "mühendislik disiplinli" brand tonunu destekliyor. Müşteri "hemen cevap vermiyorsunuz" derse, açıklamayı yazılı yapıyoruz: "24 saat response window, çünkü veri kontrol edip cevap veriyoruz. Anında cevap spekülatif olurdu." Bu dürüstlük, brand equity yaratıyor.

## Takvim Tasarımı: Default "No" ile Başlamak

Yeni bir toplantı talebi geldiğinde default cevap "hayır" değil, "alternatif öner" olmalı. "Hayır" agresif, "uygun zaman neresi?" pasif-agresif. "Salı 14:00 ya da Perşembe 15:00 size uyar mı?" proaktif yönlendirme.

Takvim tasarımında 3 katman var:

1. **Core work time:** 09:00-13:00, hiç dokunulmaz
2. **Collaborative time:** 14:00-18:00, toplantılara açık
3. **Overflow time:** 18:00-20:00, kendi seçtiğin ekstra iş için (optional)

Bu katmanlama, "meşgul" tanımını netleştiriyor. Birisi "saat 10:00 müsait misin?" dediğinde, "core work time'da müsait değilim, 14:00 sonrası önerebilirim" diyorsun. Açıklama gerekmez, sistem kendini açıklıyor.

Default "no" kültürü, founder takviminde scarcity prensibi kuruyor. Herkes bilir ki founder'a ulaşmak 24 saatlik async ya da collaborative time slot gerektirir. Bu, ekip içinde "founder'a sormadan önce iki kere düşün" disiplini yaratır — soru daha yapılandırılır, talep daha netleşir.

## Haftalık Review: Time Audit ile Retrospektif

Hafta sonu 30 dakika calendar review yapmak, bir sonraki haftanın tasarımını düzeltir. Google Calendar'ın "Time Insights" özelliği ya da Clockwise gibi tool'lar, haftalık dağılımı gösterir:

- Toplantı saatleri / total saat
- Deep work block'ların gerçek süresi (calendar'da 4 saat var, ama 2 saat Slack'e gittiyse farkedilir)
- Bağlam geçiş sayısı (event sayısı)

Roibase'te haftalık hedefler:

- **Minimum 12 saat deep work** (haftada 3 gün × 4 saat)
- **Maksimum 10 toplantı** (2 gün × 5 toplantı)
- **Maksimum 3 reactive block** (kırmızı renkli event)

Bu hedeflerin altında kalırsa, bir sonraki hafta daha agresif bloklama yapılır. Üstünde kalırsa, format değişir — belki 4 saatlik blok yerine 3 saat yeterli, o zaman 1 saat collaborative time'a açılır. Veri olmadan düzeltme yapamazsın — bu yüzden time audit disiplini kritik.

Founder calendar'ı optimize etmek, hız yarışı değil, bağlam koruması yarışıdır. 23 dakikalık geçiş maliyetini kabul etmek, 4 saatlik bloğu yapısal korumak, async window tanımlamak, haftalık audit yapmak — bunlar sistematik disiplin. "Verimli olmak" değil, "verimliliği ölçmek ve düzeltmek" hedef. Takvim tasarımı, günlük operasyonel kararlara yansır — hangi soruya yanıt verirsin, hangi toplantıya katılırsın, hangi müşteri talebini kabul edersin. Bu disiplin, 8 yıldır Roibase'in ekip liderliği kültürünün temeli.