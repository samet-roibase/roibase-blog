---
title: "Tool Stack 2026: Roibase Ekibinin Günlük Operasyonu"
description: "Linear, Notion, Slack, Figma, Granola — entegrasyon pattern'leri ve async-first ekip operasyonunun gerçek sayıları. 8 yıllık ekip liderliğinden sistemik çıkarımlar."
publishedAt: 2026-08-08
modifiedAt: 2026-08-08
category: lifestyle
i18nKey: lifestyle-004-2026-08
tags: [tool-stack, async-first, linear, notion, ekip-operasyonu]
readingTime: 8
author: Roibase
---

2026'da verimlilik yazılımı pazarı 94 milyar dolara ulaştı — ama çoğu ekip hâlâ tool'ları "kurulmuş haliyle" kullanıyor. Roibase'de son 8 yılda şunu öğrendik: Tool seçimi değil, entegrasyon pattern'i operasyonu değiştirir. Linear sprint velocity'miz 2.8'den 4.1'e çıktı — çünkü tool stack'i ekip disiplinine göre yeniden tasarladık. Bu yazıda günlük operasyonumuzu şekillendiren 5 tool ve bunların birbirine nasıl kilitlendiğini göstereceğiz.

## Linear: Task Management Değil, Karar Kaydı

Linear'ı sadece iş takibi için kullanmıyoruz — her issue, bir karar noktasının belgesi. Şubat 2025'te cycle time ortalaması 4.2 gündü. Temmuz 2026'da 2.7 güne düştü. Sebep: issue template'lerini "ne yapılacak" yerine "neden yapılıyor" odaklı yeniden tasarlamak.

Her Linear issue şu meta verileri taşır: `impact` (low/medium/high), `confidence` (0-100%), `effort` (XS-XL). Bu üçlü, roadmap önceliklendirmesini subjektif tahmin yerine ölçülebilir matrise bağlar. Önemli olan: bu veriyi issue açarken doldurmak — sonradan eklenen meta veri %80 güvenilirlik kaybeder.

Linear'ın API'si üzerinden haftalık otomasyonumuz var: Her cuma saat 17:00'de `notion-automation` botu, o haftanın completed issue'larını Notion'daki "Weekly Digest" sayfasına pushlar. Format: başlık, kapatılma süresi, assign edilen kişi, impact skoru. Bu sayede sprint retrospective'i veri üzerinden başlar — "Bu hafta ne yaptık?" yerine "Hangi issue'larda cycle time beklentinin üstündeydi?" sorusunu sorabiliyoruz.

### Async Standup Disiplini

Linear issue yorumları bizim async standup mekanizmamız. Günlük toplantı yok — yerine her ekip üyesi kendi issue'suna saat 10:00-11:00 arası güncelleme düşüyor. Template: "Yesterday: X done, Today: Y planned, Blocker: Z or none". Bu disiplin sayesinde bağlam anahtarlama maliyeti %40 düştü (RescueTime verisine göre). Deep work blokları kesintisiz — Slack notification'ları sadece mention'da açık.

## Notion: Single Source of Truth, Ama Disiplinli

Notion workspace'imizde 230+ sayfa var — ama gereksiz yere. Her sayfa için "owner" atanıyor, her 3 ayda bir audit ediliyor. "Orphan pages" (6 ay boyunca açılmamış) otomatik arşivleniyor. Bu disiplin olmazsa Notion çöplüğe döner.

En kritik Notion kullanım senaryosu: client briefing. Yeni proje geldiğinde `projects/client-slug/brief.md` sayfası açılıyor. İçerik: hedef, timeline, success metric, assumption log. Bu sayfa Linear'a bağlanıyor (property olarak). Issue açarken "Brief link" mecburi field — böylece her task'ın "neden var olduğu" bir tıkta görünür.

Notion'ın database feature'ını iş takibi için kullanmıyoruz — Linear zaten var. Notion sadece "uzun-soluklu bağlam" için. Örneğin: bir client'ın 12 aylık [markalaşma stratejisi](https://www.roibase.com.tr/tr/branding) Notion'da yaşar, ama her sprint'teki deliverable Linear'da. Notion "neden", Linear "ne".

## Slack: Entegrasyon Hub, Asenkron Konuşma

Slack'i realtime chat olarak kullanmıyoruz — asenkron mesajlaşma + entegrasyon hub olarak. Channel kültürümüz: `#linear-updates`, `#figma-comments`, `#github-activity`, `#analytics-alerts`. Bu channel'lar otomatik feed — insan konuşması yok. Thread disiplini: mesaj thread'e düşülür, main channel'da notification flood olmaz.

Slack App integration'ları sayısal hedef üzerinden kurulu:
- **Linear bot:** Her issue close'unda `#linear-updates` channel'ına push. Formatı custom — sadece high-impact issue'lar mention trigger'lar.
- **Figma webhook:** Designer bir component'i publish edince `#figma-comments` channel'ına düşer. Frontend dev oradan context alır.
- **GitHub Actions:** PR merge olduğunda `#github-activity` channel'ına hangi Linear issue'nun kapatıldığını yazar.

Bu sayede Slack, ekip üyelerinin "ne oluyor" sorusunu cevaplayan pasif dashboard. Aktif soru sormak için DM yerine thread açılıyor — böylece bağlam sonradan araştırılabilir.

### Response Time SLA

Slack mesajlarına "hemen cevap verme" baskısı yok. SLA: mention'lı mesajlar 4 saat içinde, mention'sız thread'ler 24 saat içinde cevap. Bu disiplin RescueTime'a yansıdı: ortalama Slack session süresi 12 dakikadan 6 dakikaya düştü. Deep work korunuyor.

## Figma: Tasarım Değil, Konsensüs Dokümantasyonu

Figma'yı sadece UI tasarımı için kullanmıyoruz — karar konsensüsü için. Örnek: bir client brief'i Notion'da yazıldıktan sonra, wireframe Figma'da çiziliyor. Figma file'ı Linear issue'ya bağlanıyor. Developer implement ederken "bu neden böyle tasarlanmış?" sorusu Figma comment'lerinde.

Figma branch feature'ı hayat kurtarıyor: Her major değişiklik branch'te test ediliyor, main file kirlenmiyor. Developer implement ederken "son onaylı versiyon" her zaman main branch. Bu disiplin sayesinde "yanlış versiyonu kod yaptım" hatası ortadan kalktı.

Figma plugin'lerimiz: `A11y - Color Contrast Checker`, `Stark`. Her tasarım publish edilmeden önce accessibility audit'i mecburi. Color contrast ratio 4.5:1'in altı approve edilmiyor. Bu disiplin sayesinde production'daki WCAG compliance %100.

## Granola: Meeting Note Otomasyonu

Granola 2025'in ikinci yarısında ekip stack'ine girdi. Kullanım senaryosu: client call'lar ve internal sync meeting'ler. Granola, meeting'i transcribe ediyor, sonra GPT-4 ile özetliyor. Çıktı direkt Notion'a push ediliyor — `meetings/YYYY-MM-DD-client-name` formatında.

Önemli olan: Granola'nın çıktısını ham kullanmıyoruz. Meeting sonrası 10 dakika içinde owner (genelde meeting lead) Notion sayfasını editliyor: summary tutulur, action item'lar Linear issue'ya convert edilir, irrelevant kısım siliniyor. Bu editlenmemiş transcript Notion'da kalırsa garbage data oluşuyor — arama sonuçları kirlenmiş oluyor.

Granola'nın ROI'si: Meeting note alma yükü %70 azaldı. Önceden her call sonrası 15-20 dakika manuel note temizliği yapılıyordu. Şimdi transcription otomatik, temizleme süresi 5-7 dakika. Yıllık 120+ client call olduğunda bu 30+ saat tasarruf demek.

## Entegrasyon Pattern'leri

Tool stack'in gücü, bireysel tool'ların değil, entegrasyon katmanının tasarımında. Bizim pattern'lerimiz:

**Linear → Notion flow:** Her Linear cycle sonunda completed issue'lar Notion'daki sprint digest'e pushlanır. Manuel değil, Zapier automation. Tetikleyici: Linear cycle close. Format: markdown tablo — issue title, owner, cycle time, impact.

**Figma → Linear flow:** Figma file'ında "Ready for Dev" tag'i eklenince, otomatik Linear issue açılır. Issue body'de Figma file link + son comment'ler embed. Bu sayede developer context loss yaşamıyor.

**Slack → Linear flow:** `#requests` channel'ında belirli emoji reaction (`:fire:`) eklenince, o mesaj otomatik Linear issue'ya dönüşür. Issue title mesajın ilk satırı, body thread'in tamamı. Bu sayede ad-hoc request'ler kaybolmuyor.

**GitHub → Notion flow:** PR merge olduğunda, ilgili Linear issue'nun Notion brief sayfasına "Completed" tag'i ekleniyor. Bu sayede client brief sayfası canlı kalıyor — "bu feature tamamlandı mı?" sorusu Notion'dan cevap bulur.

## Sistem Başarısızlığı ve Kurtarma

2025 Aralık'ta Slack outage yaşandı — 6 saat boyunca mesajlaşma yok. Ekip operasyonu durdu mu? Hayır. Çünkü asıl iş takibi Linear'da, dokümantasyon Notion'da. Slack sadece notification layer. Outage'da ekip Linear comment'lere geçti, akış sürdü.

Bu deneyimden çıkarım: Tool stack tasarımında single point of failure olmamalı. Her tool'un yedeği yok ama her tool'un sorumluluğu dar. Slack giderse Linear yorumlar kullanılır, Linear giderse Notion database'i manuel task yönetimi olur. Bu esneklik sayesinde tool dependency riski düşük.

---

Tool stack operasyonu bir kere kurulup unutulan sistem değil — her çeyrekte audit edilen, her yeni tool eklenmeden önce "entegrasyon maliyeti vs fayda" hesabı yapılan disiplin. Roibase'in 2026 stack'i bu disiplinle şekillendi. Sizin ekibiniz için doğru stack başka olabilir — ama entegrasyon pattern'lerini sabitlemeden tool eklemenin maliyeti hep yüksek olacak. Tool'u değiştirmek kolay, sistemi değiştirmek zor.