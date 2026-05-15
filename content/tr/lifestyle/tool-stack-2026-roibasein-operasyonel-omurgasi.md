---
title: "Tool Stack 2026: Roibase'in Operasyonel Omurgası"
description: "Linear, Notion, Slack, Figma, Granola — 12 kişilik ekipte async-first workflow'un anatomisi. Entegrasyon pattern'leri, bağlam anahtarlama maliyeti, ölçülebilir verimlilik."
publishedAt: 2026-05-15
modifiedAt: 2026-05-15
category: lifestyle
i18nKey: lifestyle-004-2026-05
tags: [tool-stack, async-workflow, team-operations, productivity-engineering, remote-work]
readingTime: 8
author: Roibase
---

2026'da verimlilik araçlarını seçmek basit değil — her tool "collaboration hub" olduğunu iddia ediyor. Roibase'de 8 yıldır şunu öğrendik: Tool'u seçmek kolay, entegrasyon pattern'ini kurmak zor. Ekip 12 kişi, 3 saat zaman dilimi farkıyla çalışıyor, async-first disiplinimiz var. Bu yazı o disiplinin omurgasını açıyor: hangi tool ne işe yarıyor, nasıl entegre ediliyor, nerede bağlam anahtarlama maliyeti başlıyor.

## Linear: Tek Kaynak Sistem Değil, Karar Akış Yönetimi

Linear'ı issue tracker olarak görmek yanlış. Biz onu "karar akış yönetimi" için kullanıyoruz. Her sprint cycle başında PM + lead developer birlikte roadmap board'u önceliklendiriyor. Linear'ın güçlü yanı önceliklendirme değil — status değişikliklerini Slack'e webhook ile bildirmesi. Bu sayede kimse Linear'ı manuel açıp "neler oluyor" diye sormuyor.

Kritik pattern: Linear issue'su açıldığında otomatik Notion'da "Research" template'i oluşturuluyor (Zapier üzerinden). Bu sayede PM önce Notion'da bağlam yazıyor (pazar verisi, kullanıcı geri bildirimi, teknik gereklilik), sonra Linear'a "implementation ready" etiketiyle gönderiliyor. Bu ayrım sayesinde "henüz çözüm tasarlanmamış" issue'lar Linear'ı kirletmiyor.

Velocity metriği: Son 6 sprint ortalama 28 story point kapatıyoruz (12 kişilik ekip için). Bu sayı stabil — tool değil, disiplin getirdi. Her sprint sonunda retrospektif Notion'da kalıyor, Linear issue'ları kapanıyor. Geçmiş sprint'leri Linear'da aramak yerine Notion'da arama yapıyoruz — daha yapılandırılmış.

### Bağlam Anahtarlama Maliyeti

Linear'ın bildirim agresifliği yüksek. Her status değişikliğinde Slack'e ping atıyor, bu da dikkat ekonomisini bozuyor. Çözüm: Slack'te `#dev-silent` kanalı — sadece loglama, mention yok. Gerçek bildirim `#dev-standup` kanalında, sadece "ready for review" ve "blocked" durumlarında.

Bu sayede developer sabah 09:00'da `#dev-standup` kanalını açıyor, gün boyunca Linear'ı açmıyor. Code review hazırsa Slack'ten görüyor, diğer noise'u görmüyor. Sonuç: Ortalama review response time 3 saatten 45 dakikaya düştü (Slack analytics, Ocak 2026 verisi).

## Notion: Bilgi Mimarisi Değil, Karar Tarihçesi

Notion'ı wiki olarak kullanmak klasik hata. Biz onu "karar tarihçesi" için kullanıyoruz. Her proje Notion'da başlıyor — problem statement, müşteri bağlamı, teknik tradeoff, rejected alternatifler. Proje bittiğinde Linear issue'su kapanıyor ama Notion'daki o sayfa kalıyor.

Pattern: Notion'da "Projects 2026" database'i var, her satır bir proje. Status property Linear ile senkronize (Zapier webhook). Proje "done" olunca otomatik "Archive 2026" database'ine taşınıyor. Böylece aktif Notion workspace'i kirlenmiyor, ama geçmiş kararlar aranabilir kalıyor.

Roibase'de markalama disiplini de bu tool stack'e bağlı — [markalaşma & brand identity](https://www.roibase.com.tr/tr/branding) çalışmalarında brand guideline'lar Notion'da yaşıyor, Figma'ya link veriyor. Designer Figma'da mockup yapıyor, ama brand ton of voice Notion'da tanımlı. Bu sayede designer "bu yazı tonu doğru mu" diye PM'e sormak yerine Notion'daki "Voice & Tone" sayfasını açıyor.

### Arama ve Bilgi Erişimi

Notion'ın arama motoru zayıf — 500+ sayfa olunca semantik arama yapmıyor. Çözüm: Her Notion page'e manuel tag ekliyoruz (client-name, project-type, team-owner). Bu sayede filter ile daraltıp sonra arama yapıyoruz. Ortalama bilgi erişim süresi 2 dakikadan 30 saniyeye düştü (kendi internal ölçüm, Mart 2026).

## Slack: Async-First Enforcer

Slack'i real-time chat olarak kullanmak disiplinsizlik. Biz onu "async-first enforcer" olarak kurduk. Kuralımız basit: Slack mesajına 4 saat içinde cevap verilmesi beklenmiyor — urgent durum yoksa. Urgent durum varsa `@channel` mention kullanılıyor, o zaman herkes 30 dakika içinde görüyor.

Bu disiplini zorlamak için Slack'te custom status kullanıyoruz: "Deep work 🎧" statüsü varsa kimse mention atmıyor. Statü 2 saat süreyle set ediliyor (Slack Workflow Builder ile otomatik). Bu sayede designer Figma'da 2 saat kesintisiz çalışabiliyor.

Kritik pattern: Slack thread'leri Linear issue'ya gönderiliyor (Zapier). Thread'de karar alındıysa PM "Decision: ..." ile başlayan mesaj yazıyor, otomatik Linear'a comment olarak ekleniyor. Bu sayede Slack'teki karar Linear'ı güncelliyor, ama developer Slack'i açmak zorunda kalmıyor.

### Notification Disiplini

Slack bildirimlerini kill etmek değil, segmente etmek önemli. `@here` ve `@channel` mention'lar haftada 3 defadan fazla kullanılırsa PM'e Slackbot uyarı gönderiyor (custom Slack app, internal). Bu sayede "urgent" kelimesi deflate olmuyor — gerçekten urgent olanlar dikkat çekiyor.

Sonuç: Ortalama Slack mesaj sayısı 120/gün'den 60/gün'e düştü (son 6 ay). Async response time 4 saatten 2 saate düştü — çünkü noise azalınca gerçek mesajlar görülüyor.

## Figma: Design Handoff Değil, Tasarım Dokümantasyonu

Figma'yı mockup tool'u olarak görmek eksik. Biz onu "tasarım dokümantasyonu" için kullanıyoruz. Her design Figma'da başlıyor, ama developer'a gitmeden önce Figma comment thread'inde PM + designer + lead developer review yapıyor. Bu sayede design handoff anında "bu implementable mı" tartışması bitmiş oluyor.

Pattern: Figma file Notion'daki proje sayfasına embed ediliyor. Developer Linear'dan Notion'a gelip Figma preview'ını görüyor, implementation detaylarını Figma comment'lerinde buluyor. Bu sayede "bu spacing kaç px?" diye Slack'te sormak yerine Figma inspect mode açıp ölçüyor.

Figma'nın dev mode'u güçlü ama overuse riski var. Biz onu sadece "final design" aşamasında açıyoruz — iterasyon aşamasında kullanmıyoruz. Çünkü dev mode açıkken designer sürekli "dev'e hazır mı" diye düşünüyor, iteration hızı düşüyor.

### Component Library Disiplini

Figma'da component library kurduk ama maintain etmek zor. Çözüm: Her sprint'te 1 gün "component cleanup" zamanı var. Designer o gün sadece Figma component'lerini refactor ediyor, yeni design yapmıyor. Bu sayede component library entropy'ye girmemiş kalıyor.

Sonuç: Component reuse oranı %40'tan %75'e çıktı (Figma analytics, Nisan 2026). Design-to-dev handoff süresi 2 günden 4 saate düştü — çünkü developer component'leri tanıyor, custom implementation yapmıyor.

## Granola: Meeting Intelligence Değil, Async Memo Generator

Granola'yı 2025 sonunda ekledik. Tool basit: Meeting'i kaydediyor, otomatik transcript + AI-generated summary oluşturuyor. Ama biz onu "async memo generator" olarak kullanıyoruz. Toplantıdan sonra Granola summary'sini Notion'a yapıştırıyoruz, manuel edit edip ekip için memo haline getiriyoruz.

Kritik pattern: Meeting'e katılmayan ekip üyesi Granola memo'sunu okuyor (5 dakika), meeting'e 30 dakika harcamıyor. Bu sayede 12 kişilik ekipte toplantı sayısını haftada 8'den 3'e düşürdük. Async memo okuma süresi kişi başı haftada 20 dakika — yani 8×30=240 dakika toplantı yerine 20 dakika okuma.

Granola'nın AI summary'si %80 doğru — %20'sini manuel düzeltiyoruz. Ama o %20 edit bile toplantı tekrarından daha hızlı. Meeting owner toplantıdan sonra 10 dakika edit yapıyor, memo hazır.

### Privacy ve Güven

Granola meeting kayıtlarını Notion'a embed etmiyoruz — sadece transcript + summary var. Çünkü video kaydı güven sorunu yaratıyor ("her lafım kayıt altında" hissi). Transcript'i anonim hale getiriyoruz (isim yerine "PM", "Designer" yazıyoruz), bu sayade ekip rahat konuşuyor.

Sonuç: Meeting quality arttı — kimse "toplantı kayda geçiyor, dikkatli konuşayım" diye stres yaşamıyor. Granola sadece karar akışını dokümante ediyor.

## Entegrasyon Pattern'lerinin Ortak Özellikleri

Bu 5 tool'un entegrasyon stratejisinde ortak pattern var:

1. **Unidirectional data flow:** Linear → Notion → Slack → Figma yönünde veri akıyor, ters yönde akış yok. Bu sayede "single source of truth" Linear kalıyor, diğerleri downstream.

2. **Webhook > polling:** Entegrasyonlar Zapier webhook ile yapılıyor, scheduled job ile değil. Bu sayede real-time senkronizasyon oluyor ama server load düşük.

3. **Notification segmentation:** Her tool'un bildirimleri farklı Slack kanalına gidiyor. `#linear-log`, `#notion-updates`, `#figma-reviews` kanalları var. Bu sayede ekip üyesi sadece kendi işine yarayacak kanalı takip ediyor.

4. **Manual override always available:** Otomasyon her zaman manuel override edilebilir. Örneğin Linear → Notion sync başarısız olursa PM manuel Notion page açıp Linear issue'ya link veriyor. Otomasyon fail ettiğinde iş durmuyor.

Bu pattern'ler sayısal sonuç verdi: Ekip başına aylık tool maliyeti $180 (12 kişi × $15 ortalama). Buna karşılık operasyonel verimlilik %35 arttı (delivery cycle time 3 haftadan 2 haftaya düştü, Q1 2026 verisi). Tool stack değil, entegrasyon disiplini fark yarattı.

Roibase'de tool stack her 18 ayda bir review ediliyor — yeni tool eklenmesi için mevcut workflow'a net katkı kanıtlanmalı. 2026 sonunda Loom ve Miro'yu test edeceğiz, ama onay kriteri şu: "Bu tool olmadan hangi operasyonel darboğaz çözülemiyor?" Cevap yoksa tool eklenmez.