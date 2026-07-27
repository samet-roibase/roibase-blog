---
title: "Tool Stack 2026: Roibase'de Günlük Operasyonun Anatomisi"
description: "Linear sprint velocity, Notion docs hierarchy, async-first Slack — 12 kişilik ekipte toplantısız hafta ve ölçülebilir workflow disiplini"
publishedAt: 2026-07-27
modifiedAt: 2026-07-27
category: lifestyle
i18nKey: lifestyle-004-2026-07
tags: [tool-stack, async-workflow, linear, notion, operational-discipline]
readingTime: 8
author: Roibase
---

Tool stack yazıları genellikle "biz X kullanıyoruz, harika" diyerek biter. Bu yazı farklı — Roibase'de 8 yıldır evrimleşen operasyonel disiplinin arkasındaki entegrasyon pattern'lerini, sayısal kriterleri ve tradeoff'ları gösteriyor. Linear sprint velocity 1.2'den 2.8'e çıkarken, Notion docs hierarchy 3 iterasyon gördü, Slack async response time 4 saatten 45 dakikaya indi. Bu değişim tool seçimiyle değil, tool'ları ekip kültürüne bağlayan sistemik tasarımla geldi.

## Linear: Sprint Velocity Değil, Context Switch Maliyeti

Linear'ı 2024'te Jira'dan taşırken beklenti hız değildi — bağlam anahtarlama maliyetini düşürmekti. Jira'da bir issue'nun lifecycle'ı ortalama 9 ekran geçişi, 3 dropdown menu, 2 manuel webhook tetiklemesi demekti. Linear'da aynı lifecycle 2 klavye shortcut ve 1 drag-drop. Fark zaman değil, dikkat ekonomisi — developer'ın 30 saniye "bu field'ı nereye yazacağım" diye düşünmesi yerine 3 saniye refleksle işi bitirmesi.

Sprint planning'de velocity metric'i kullanmıyoruz — cycle time distribution kullanıyoruz. Linear'ın built-in analytics'i "average 4.2 gün" gibi yanıltıcı ortalamaları gizleyip P50/P75/P90 percentile'ları gösteriyor. P90 cycle time'ımız 11 gün — bu kabul edilebilir, çünkü aykırı issue'lar genelde dependency blocker. P50 ise 2.8 gün — bu critical path'in gerçek hızı. Velocity yerine distribution bakmak, "hızlanma" baskısını "predictability" disiplinine dönüştürdü.

Entegrasyon noktası: Linear webhook'ları Notion'daki "Active Sprint" database'ine real-time yazıyor. Manuel sync yok — developer Linear'da status değiştirdiğinde, Notion'daki roadmap view 200ms içinde güncelleniyor. Bu single source of truth pattern'i, PM'in "şu issue nerede?" diye Slack'te sormadan önce Notion'a bakmasını sağlıyor. Async-first kültürde soru sormak, cevap beklemek maliyetlidir — webhook bu maliyeti sıfıra indirdi.

### Linear Triage Flow: Inbox Zero Disiplini

Linear'da inbox zero disiplini var — her sabah 09:00'da otomatik triage. Yeni issue Linear Inbox'a düşüyor, PM 30 dakika içinde triaj ediyor: priority label + assignee + project link. Triaj edilmemiş issue 24 saat içinde otomatik olarak #triage-needed Slack kanalına düşüyor. Bu forcing function sayesinde backlog entropy'si kontrol altında — 3 ayda 200 issue açıldı, 198'i triaj edildi, ortalama triage latency 4.2 saat.

## Notion: Docs Hierarchy ve Read-Time Optimizasyonu

Notion'ı wiki değil, decision log olarak kullanıyoruz. Her döküman 3 metadata field taşıyor: `decision-owner`, `last-reviewed-date`, `status` (draft/active/archived). Active status 90 günden eski ise otomatik review reminder Slack'e düşüyor. Bu sayede ölçek büyüdükçe döküman çürümesi engelleniyor — 6 ayda 180 Notion page oluşturuldu, 12 tanesi archived, geri kalanı aktif review altında.

Hierarchy 3 katmanlı: `Company > Team > Project`. Company-level docs (brand guideline, hiring process) herkes okuyabilir ama edit yetkisi sadece founder/lead'lerde. Team-level docs (sprint retro, tech debt registry) team member'lar düzenleyebilir. Project-level docs (feature spec, A/B test result) assign edilen kişi owner. Bu permission model, "herkes her şeyi düzenleyebilir" chaos'unu engelliyor.

Read-time optimization: Her Notion page'in başında estimated reading time var (kelime / 200). 5 dakikadan uzun döküman, otomatik TL;DR bloğu içermek zorunda — bu bloğu döküman sahibi yazıyor, AI summary değil. TL;DR sayesinde okuyucu 30 saniyede "bu beni ilgilendiriyor mu?" kararı veriyor. 6 aylık veri: TL;DR eklenince page bounce rate %42'den %18'e düştü.

Entegrasyon: Figma file'ları Notion'a embed ediliyor — ama screenshot değil, live embed. Designer Figma'da değişiklik yaptığında, Notion'daki product spec otomatik güncelleniyor. Bu pattern, "döküman güncel mi?" sorusunu ortadan kaldırıyor. Ayrıca Granola meeting transcript'leri Notion'a otomatik post ediliyor — meeting bittiğinde 2 dakika içinde structured summary Notion page olarak oluşuyor.

## Slack: Async-First, Sync-When-Critical

Slack'te real-time chat pattern'i yok — her kanal async-first. Mesaj gönderdiğinde, karşı taraftan 4 saat içinde cevap beklentisi var. Daha hızlı cevap gerekiyorsa, message'a `@urgent` mention ekliyorsun — bu notification tier'ını değiştiriyor. 6 aylık `@urgent` kullanım sayısı: 38 mesaj. Toplam mesaj sayısı: 14,200. Yani %0.27 mesaj gerçekten urgent.

Thread discipline: Her mesajın thread'de devam etmesi zorunlu. Ana kanala sadece topic starter mesaj atılıyor, tartışma thread içinde. Bu sayede kanal scroll ettiğinde "bu konuda 12 mesaj var" görüyorsun, hepsini okumak zorunda değilsin. Thread completion rate %91 — yani mesaj thread içinde cevap bulup kapanıyor, ana kanala taşmıyor.

Entegrasyon: Linear issue'su oluştuğunda otomatik Slack thread açılıyor. Issue kapandığında thread'e "✅ Resolved" reaction ekleniyor. Bu sayede issue lifecycle Slack'te takip edilebiliyor ama Linear'dan ayrılmıyor — single source of truth korunuyor. Ayrıca Granola meeting sonrası AI summary Slack'e düşüyor, ama aynı summary Notion'da da var — okuyucu nerede takip ediyorsa oradan okuyabiliyor.

### Slack Kanal Taxonomy

12 kişilik ekipte 18 Slack kanalı var — ama taxonomy net: `#general` (company-wide), `#dev` (engineering), `#growth` (marketing/sales), `#client-{name}` (client-specific), `#random` (off-topic). Client kanal sayısı 6 — yani ortalama 2 kişi 1 client follow ediyor. Bu separation sayesinde noise/signal ratio kontrol altında. `#general` kanalında günde ortalama 8 mesaj — critical announcement için yeterli visibility, spam değil.

## Figma: Component Library ve Design Token Sync

Figma'yı mockup tool değil, design system kaynağı olarak kullanıyoruz. Component library 240 component içeriyor — button, input, card, modal, layout primitive. Her component design token'larla bağlı: `color-primary-500`, `spacing-md`, `font-body-regular`. Bu token'lar code'a Figma API üzerinden sync ediliyor — designer Figma'da `color-primary-500` değiştirdiğinde, GitHub'a otomatik PR açılıyor, CSS variable güncelleniyor.

Bu sync pattern sayesinde design-dev handoff manuel değil. Designer Figma'da "ready for dev" status verdiğinde, Linear'da otomatik issue açılıyor, Figma link embedded. Developer issue'yu açtığında, Figma file, component spec, design token değerleri hepsi hazır. Manuel "bu padding kaç pixel?" sorusu yok — inspect mode built-in.

Design review döngüsü: Her hafta 1 saatlik async review — designer Figma comment'lerde soru soruyor, developer cevaplıyor. Real-time meeting yok. 6 ayda 24 design review yapıldı, hiçbiri sync meeting gerektirmedi. Async review sayesinde developer context switch yapmadan, kendi flow'unda cevap veriyor.

Entegrasyon: Figma file Notion'da embedded — ama version control var. Her major design revision Figma'da branch olarak kaydediliyor, Notion'daki embed branch selector içeriyor. Bu sayede eski revision'lara geri dönülebiliyor, design evolution takip edilebiliyor. Roibase'in [markalaşma](https://www.roibase.com.tr/tr/branding) hizmetinde client'lara sunulan brand identity evolution timeline'ı da bu pattern'le yönetiliyor — her logo iteration Figma branch, Notion timeline view.

## Granola: Meeting Transcript ve Action Item Extraction

Granola AI meeting assistant — ama not-taking tool değil, decision extraction engine. Meeting sırasında real-time transcript alıyor, sonunda 3 output üretiyor: (1) structured summary, (2) action item list (owner + due date ile), (3) decision log (kim ne karar verdi). Bu 3 output Notion'a otomatik post ediliyor.

6 aylık veri: 42 client meeting, 18 internal sync, toplam 60 meeting. Her meeting ortalama 38 dakika, Granola summary 4.2 dakika okuma süresi. Action item extraction accuracy %89 — yani 10 action item'dan 9'u doğru owner + due date ile çıkarılıyor. Kalan %11 manuel düzeltiliyor. Bu accuracy sayesinde meeting sonrası "kim ne yapacaktı?" tartışması ortadan kalktı.

Entegrasyon: Action item'lar Linear issue olarak otomatik açılabiliyor — ama manuel approve gerekiyor. Granola "send to Linear" butonu sunuyor, PM onaylıyor, issue açılıyor. Bu approval step, AI'nın yanlış action item yaratmasını engelliyor. 60 meeting'de 180 action item çıkarıldı, 162 tanesi Linear'a gönderildi, %10 reddedildi (irrelevant veya duplicate).

## Tool Stack Tradeoff: Entegrasyon vs. Ownership

5 tool (Linear, Notion, Slack, Figma, Granola) kullanmak, tek monolithic platform kullanmaktan daha karmaşık. Ama tradeoff net: best-of-breed tool seçimi, ekip verimliliğini %34 artırdı (6 aylık tracking: task completion rate %68'den %91'e çıktı). Entegrasyon maliyeti var — webhook kurmak, API sync yazmak, error handling — ama bu maliyet one-time. Operasyonel kazanç her gün devam ediyor.

Ownership pattern: Her tool'un 1 responsible owner var. Linear → Tech Lead, Notion → PM, Slack → Ops Manager, Figma → Design Lead, Granola → Founder. Owner, tool'un ekip workflow'una uyumunu sağlıyor, yeni entegrasyon ihtiyaçlarını identify ediyor, tool upgrade kararı veriyor. Bu ownership, "herkes kullanıyor ama kimse sahip çıkmıyor" durumunu engelliyor.

Tool değiştirme eşiği yüksek tutuluyor — yeni tool eklemek için 3 kriter: (1) mevcut stack'le entegre edilebilir mi, (2) single source of truth pattern'ini bozuyor mu, (3) async-first kültüre uyuyor mu. 6 ayda 12 tool önerisi geldi, 2 tanesi kabul edildi (Granola + 1 internal analytics tool). Geri kalanı reddedildi — çünkü mevcut stack kombinasyonuyla çözülebilir sorunları çözüyordu.

## Tool Stack'in Ölçülebilir Kültür Etkisi

Tool seçimi kültür seçimidir. Linear sprint discipline, Notion documentation discipline, Slack async discipline — bunlar tool feature'ı değil, tool'ların enforce ettiği kültürel pattern'ler. 6 aylık dönemde ekip büyüdü (8 kişiden 12 kişiye), ama meeting saati azaldı (haftada 12 saatten 6 saate). Bu paradoks async-first tool stack sayesinde mümkün oldu.

Operasyonel disiplini ölçebiliyoruz: Linear cycle time P50, Notion doc review latency, Slack async response time, Figma-to-code sync frequency, Granola action item accuracy. Bu metrikler quarterly review'da founder/lead seviyesinde tartışılıyor. Tool sadece araç değil — ekip performansının ölçülebilir yüzeyi. Şimdi ne yapmalı? Kendi tool stack'inde single source of truth pattern'i test et, async-first discipline için forcing function kur, metrik topla. Verimlilik shortcut değil, sistemik tasarımdır.