---
title: "Tool Stack 2026: Roibase'de Toplantısız Hafta Nasıl Çalışıyor"
description: "Linear, Notion, Slack, Figma, Granola — 8 yıldır test edilen entegrasyon pattern'leri ve async-first ekip operasyonunun somut kriterleri."
publishedAt: 2026-06-10
modifiedAt: 2026-06-10
category: lifestyle
i18nKey: lifestyle-004-2026-06
tags: [tool-stack, async-first, linear, notion, workflow-design]
readingTime: 8
author: Roibase
---

2026'da Roibase ekibi haftada ortalama 2 saat toplantı yapıyor — geri kalanı Linear sprint'leri, Notion dokümanları ve Slack thread'leri üzerinden senkronize oluyor. Bu sayı 2019'da 18 saatti. Değişen tool değil, tool'ları birbirine bağlama pattern'i. Linear'da açılan bir task, Slack'te otomatik thread açıyor, Notion'daki spec dokümanına link veriyor, Figma'daki tasarım frameine anchor oluyor. Bu yazı o entegrasyon sistematiğinin mühendislik tarafını açıyor — hangi tool'u neden seçtik, hangi otomasyon kuralını neden koyduk, hangi metrikleri takip ediyoruz.

## Linear: Task değil, Bağlam Taşıyıcısı

Linear'ı issue tracker olarak kullanmıyoruz — her kart bir mini-spec. Task açılırken zorunlu alanlar: hedef metrik (CTR +5%, TTI <2s), ilgili Notion dokümanı, Figma frame linki. Kart açılır açılmaz Slack'te otomatik thread oluşuyor (Zapier entegrasyonu), ekip async tartışmaya geçiyor. Bu pattern'in çıkarımı: Linear'da "quick task" diye bir kavram yok — her kart en az 2 harici bağlam taşıyor.

Sprint velocity'yi izliyoruz ama farklı katmanda: **tamamlanan task sayısı değil, ortalama task cycle time** (açılıştan kapanışa geçen saat). 2025'te bu 38 saat, 2026'da 29 saate düştü. Sebep: spec netliği — Linear kartında hedef metrik yazılıysa, code review'da tartışma 60% azalıyor (kendi verilerimiz).

### Linear + Notion Entegrasyon Pattern'i

Her Linear kartının `Related Resources` alanına Notion dokümanı link verme kuralı var — bu kural ekip başından beri manuel enforce ediliyor (automated enforcement yapmıyoruz çünkü bağlamı ekip belirlemeli, bot değil). Notion dokümanı genelde 3 bölüm: problem tanımı, önerilen çözüm, kabul kriterleri. Linear kartı Notion'dan türetilebilir ama tersi asla olmuyor — spec önce yazılır, task sonra açılır.

Bu disiplin sayesinde code review süresi 2024'te ortalama 4.2 saatten 2.7 saate düştü. Review'da "bu neden böyle?" sorusu yok — cevap zaten Notion'da.

## Slack: Thread-First, Kanal Değil

Slack'i kanal bazlı değil, thread bazlı kullanıyoruz. Genel kanalda mesaj atmak yasak — her mesaj ya bir Linear task thread'inde ya da Notion doküman bağlantılı bir thread'de başlıyor. Bu pattern'in nedeni: aramayı yapılandırmak. Slack'te "X özelliği nasıl çalışıyor" diye ararsan, Linear task ID'si otomatik çıkıyor çünkü Zapier thread'i oluştururken task ID'yi Slack mesaj metnine embed ediyor.

Async response time hedefimiz: 4 saat (çalışma saatleri içinde). Bunu nasıl ölçüyoruz? Slack Analytics API'den çektiğimiz median thread response time — 2025 Q4'te 3.2 saat, 2026 Q1'de 2.9 saat. Bu metriği sprint retrospective'de paylaşıyoruz ama bireysel takip etmiyoruz — kültürel baskı değil, sistemik düşünce.

## Figma: Design Token'lar Linear'a Bağlı

Figma'yı sadece tasarım aracı olarak kullanmıyoruz — design token'lar direkt Linear task'larına bağlı. Figma'da bir button component'i değişirse, o component'i kullanan tüm Linear kartları otomatik etiketleniyor (Figma API + Zapier). Ekip hangi task'ların etkilendiğini 10 dakika içinde görüyor.

Bu entegrasyon 2024'te şirket içi hackathon'da üretildi. Önce "over-engineering" dedik, sonra brand refresh döneminde tüm button state'lerini 3 gün içinde güncellediğimizi fark ettik — eski sistemde bu 2 hafta sürüyordu. Design-code sync problemi [markalaşma](<https://www.roibase.com.tr/tr/branding>) projelerde en büyük darboğaz — bu entegrasyon onu %70 azalttı.

### Design Token Versionlama

Figma'da design token'lar Git gibi versiyon kontrolünde değil ama Linear'daki task'lar token değişikliğini timestamp ile kaydediyor. Bir task "Button CTA rengi #FF5733'ten #E84C3D'ye geçti" diye not düşüyor, bu log Notion'daki design changelog'a otomatik ekleniyor. Böylece "3 ay önce bu renk neydi?" sorusu 30 saniyede yanıtlanıyor.

## Granola: Meeting'leri Bağlama Yapıştıracağı Yapan Araç

Haftada 2 saat toplantı yapıyoruz dedik — bunların yarısı client call, yarısı sprint planning. Her toplantı sonrası Granola otomatik transkript + action item çıkarıyor. Action item'lar Linear kartına dönüşüyor (manuel ama template var), transkript Notion'a embed ediliyor. Bu sayede toplantıya katılmayan ekip üyesi 10 dakikada tüm bağlamı yakalıyor — meeting notes yazmaya zaman harcamıyoruz.

Granola'nın kritik özelliği: action item'ları otomatik categorize ediyor (design, dev, marketing). Linear'da kart açarken doğru label'ı otomatik öneriyor. Bu küçük detay, client call sonrası task assignment süresini 15 dakikadan 3 dakikaya indirdi.

## Notion: Tek Kaynak, Çok Katman

Notion'ı wiki olarak değil, state machine olarak kullanıyoruz. Her doküman 3 state'ten birinde: Draft (yazılıyor), Review (Linear task bağlantılı, async tartışma sürüyor), Canonical (kaynak doküman, değişmez). State değişimi manuel ama kural net: Review'dan Canonical'a geçmek için en az 2 ekip üyesinin "onay" reaction'ı gerekli (Slack thread'inde).

Canonical dokümanlar değişmez — değişiklik gerekirse yeni versiyon açılır, eski doküman "Archived" etiketiyle saklanır. Bu disiplin sayesinde "bu karar neden alındı?" sorusuna cevap her zaman mevcut — archive'a bakılıyor, o dönemin Linear task'larına bakılıyor, Slack thread'i tekrar okunuyor.

### Database View'ları ve Otomatik Tagging

Notion'da 4 ana database var: Specs, Decisions, Experiments, Changelogs. Her database Linear ve Slack ile otomatik tag ediliyor (Zapier + Notion API). Bir Spec dokümanı oluşturulunca, Notion otomatik "related tasks" alanını Linear API'den çekiyor — hangi kartlar bu spec'i referans ediyor? Bu query her sabah 9'da çalışıyor, doküman güncel kalıyor.

## Entegrasyon Pattern'lerinin 3 Temel Kuralı

8 yıldır deneme yanılma ile öğrendiğimiz pattern: her tool tek bir "source of truth" alanına sahip, diğer tool'lar ona bağlanıyor.

- **Linear:** Task state ve timeline'ın source'u. Notion spec yazabilir ama task state'i sadece Linear değiştirir.
- **Notion:** Spec ve karar dokümanlarının source'u. Linear task Notion'a link verir ama Notion dokümanı Linear kartını güncellemez.
- **Slack:** Async tartışmanın source'u. Thread'ler otomatik açılır ama thread içeriği Notion'a manuel migrate edilir (otomatik sync yok çünkü signal/noise oranı bozuluyor).

İkinci kural: her otomasyon geri alınabilir olmalı. Zapier workflow'ları manual trigger'a da açık — ekip isterse "Linear task açıldığında Slack thread açma" kuralını bir sprint boyunca kapatabilir (örneğin yoğun geliştirme dönemlerinde noise azaltmak için). Otomasyon kültürel disiplini desteklemeli, zorla dayatmamalı.

Üçüncü kural: metrik takibi ekip seviyesinde, bireysel değil. Slack response time, Linear cycle time, Notion doküman approval süresi — hepsi sprint retrospective'de paylaşılıyor ama hiçbiri bireysel performance review'da kullanılmıyor. Amaç sistem optimizasyonu, bireysel rekabet değil.

## Neden Bu Tool'lar, Diğerleri Değil

Linear yerine Jira kullanmadık çünkü Jira spec yazımını teşvik etmiyor — task hızlı açılıyor, bağlam sonra ekleniyor. Linear aksine: task açarken description zorunlu, boş bırakılamıyor. Bu küçük UX farkı, kültürel fark yaratıyor.

Notion yerine Confluence kullanmadık çünkę Confluence enterprise versioning'e odaklı — küçük ekipler için fazla complex. Notion database view'ları esnek, Linear ve Slack entegrasyonları lightweight.

Slack yerine Discord kullanmadık çünkü Discord thread yapısı oyunlaştırılmış, Slack thread'leri iş bağlamında daha net. Slack arama API'si Linear task ID'leriyle native çalışıyor.

Figma yerine Adobe XD kullanmadık çünkü Figma API'si açık, Zapier ile entegre ediliyor. XD'nin API'si kısıtlı.

Granola yerine Otter.ai kullanmadık çünkü Granola action item extraction'ı native — Otter transkript üretiyor ama action item'ları manuel çıkarman gerekiyor.

Roibase'de tool stack değişmez değil — 2024'te Loom yerine Tella'ya geçtik (daha hızlı upload, Linear embed desteği var). 2025'te Zapier yerine Make.com'u denedik ama geri döndük (Zapier hata logları daha okunabilir). Tool seçimi sabit değil ama entegrasyon pattern'i sabit: her tool tek bir "source of truth" alanına sahip, diğerleri ona bağlanıyor.