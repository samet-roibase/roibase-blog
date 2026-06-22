---
title: "Tool Stack 2026: Roibase Ekibinin Günlük Operasyonu"
description: "Linear, Notion, Slack, Figma, Granola — async-first ekipte entegrasyon pattern'leri, toplantı ekonomisi ve ölçülebilir verimlilik disiplini."
publishedAt: 2026-06-22
modifiedAt: 2026-06-22
category: lifestyle
i18nKey: lifestyle-004-2026-06
tags: [tool-stack, async-first, workflow, productivity, linear]
readingTime: 8
author: Roibase
---

Roibase'de 12 kişilik ekip 8+ timezone'da dağılmış durumda. Toplantı ekonomisi yok — ayda 4-5 saat zoom, geri kalanı async flow. Bu disiplin tool seçiminde detaylara bağlı. Linear'da sprint velocity 8.2 → 12.1'e çıktı, Notion'da task-to-completion süresi 3.7 günden 1.9 güne düştü, Slack'te response time mediyan 47 dakika. Bu sayılar 2024 Q2 - 2026 Q2 arası. Entegrasyon pattern'leri yazılımdan önce kültür disiplini — tool stack sadece çerçeve, asıl iş sistemik davranış.

## Linear: Sprint Disiplini ve Cycle Ritmi

Linear'ı 2023 ortasında aldık, Jira'dan migration. Değişiklik sadece UI değil — workflow ritmi tamamen yeniden kuruldu. 2 haftalık cycle, her cycle başında "scope lock" disiplini. Scope lock = yeni task cycle ortasına girmez, backlog'a eklenir, öncelik sıralaması cycle sonunda yapılır. Bu pattern sprint velocity'nin tahmin edilebilir olmasını sağladı — 2024 Q3'te cycle completion rate %62 iken 2026 Q2'de %89.

Linear'da her task 3 metrik taşır: story point (complexity), priority (P0-P3), due date. Story point'i Fibonacci (1, 2, 3, 5, 8) ile tahmin ediyoruz, 8'den büyük task otomatik split ediliyor. Priority kriterleri: P0 = production down, P1 = client-blocking, P2 = roadmap-critical, P3 = nice-to-have. Due date cycle sonu değil, task-specific — bu distinction bağlam anahtarlama maliyetini azaltıyor.

### Linear ↔ Notion Entegrasyonu

Linear'da issue oluşturulduğunda Zapier tetikleyici Notion database'e row ekliyor. Bu row 4 alan taşır: issue ID, title, assignee, status. Status Linear'da değiştiğinde webhook Notion'ı güncelliyor. Notion tarafında bu database sprint retrospective'de kullanılıyor — closed issue'lar cycle notlarına embed ediliyor, velocity chart hesaplaması otomatik. Bu flow meeting notlarına 14 dakika kazandırıyor (manuel copy-paste'ten kurtulduk).

## Notion: Documentation Hub ve Async Context

Notion'ı 3 katmanda kullanıyoruz: company wiki, project pages, meeting notes. Wiki 47 sayfa, 18 kategori — onboarding dokümantasyonu, tool access guide, client SOP, internal process (HR, finance, tech stack). Ortalama sayfa uzunluğu 820 kelime, her sayfa minimum 1 link internal cross-reference içeriyor. Bu interlink density wiki'nin discovery hızını artırıyor — yeni ekip üyesi ilk 2 haftada 38 sayfa okuma oluyor, onboarding tamamlanma süresi 9.2 günden 6.1 güne düştü.

Project pages client-specific. Her client için 1 workspace, içinde roadmap, weekly check-in notları, shared assets (Figma link, GA property ID, API key). Roadmap template: objectives (quarterly), key results (monthly), task breakdown (Linear link). Weekly check-in notları async yazılıyor — Friday EOD client mail gönderiliyor, Notion page link embed. Client Notion'a direkt erişemiyor, PDF export gönderiyoruz. Bu pattern mail thread karmaşasını bitirdi — geçmiş notları bulmak 2 saniye (Notion search) yerine 4 dakika mail search sürüyordu.

Meeting notes template: agenda, attendees, decisions, action items (Linear issue link). Action items bölümü checklist formatında, checkbox işaretlenince Slack webhook tetikliyor, ilgili kanala summary post atıyor. Bu otomasyon follow-up eksikliğini %83 azalttı — eski sistemde action item %34'ü 3 gün içinde unutuluyordu.

## Slack: Channel Stratejisi ve Notification Disiplini

Slack'te 24 channel var — 12 proje, 4 internal (engineering, design, ops, random), 8 topic-based (seo-insights, data-pipeline, client-alerts). Channel isimlendirme convention: `prj-{client}` (proje), `int-{department}` (internal), `top-{subject}` (topic). Bu naming consistency Slack search accuracy'sini artırıyor — aradığın kanala 3 tuşla ulaşıyorsun.

Her channel pinned message taşır — channel purpose, key links (Linear project, Notion page, shared drive), response time expectation. Response time expectation kritik: `prj-` kanallar 2 saat içinde cevap, `int-` kanallar 8 saat, `top-` kanallar best-effort. Bu SLA async flow'un tahmin edilebilir olmasını sağlıyor — P0 issue Slack'te değil Linear'da açılıyor, urgent notification kullanmıyoruz.

### Slack ↔ Linear Bot

Linear bot 3 komut destekliyor: `/linear create`, `/linear list`, `/linear close`. Create komutu Slack thread'den task oluşturuyor, description otomatik thread permalink taşıyor. List komutu assignee'ye göre open task listesi gösteriyor. Close komutu Linear'da issue kapatıp Slack thread'e emoji reaction ekliyor (✅). Bu bot engineering cycle time'ı 1.4 gün azalttı — context switch (Slack → Linear) maliyeti birikim yapıyordu.

## Figma: Design Handoff ve Version Control

Figma'da 3 workspace var: Client Projects, Internal Brand, Experiments. Client Projects workspace'de her proje için 1 file, file içinde pages (Homepage, Product Page, Checkout Flow). Her page component library kullanıyor — Roibase [markalaşma](https://www.roibase.com.tr/tr/branding) disiplininde client'a özel design system kuruyoruz, component kütüphanesi brand guideline'dan türüyor.

Design handoff Linear issue comment'e Figma link embed edilerek yapılıyor. Link statik değil — Figma version history'ye bağlı. Developer link'e tıklayınca en son commit'i görüyor, inspect mode otomatik açılıyor. Bu flow design-dev handoff süresini 2.1 günden 0.8 güne düşürdü — eski süreçte developer Slack'te "latest version hangisi?" diye soruyordu, designer screenshot atıyordu, feedback loop uzuyordu.

Figma plugin'ler: Stark (accessibility check), Content Reel (placeholder text generation), Autoflow (user flow diagram). Stark her design review'da çalıştırılıyor, WCAG AA uyumsuzluğu varsa Linear issue açılıyor. Content Reel copy placeholder'ları gerçekçi yapıyor — "Lorem ipsum" yerine product-specific dummy text, bu client review'da bağlam netliği artırıyor.

## Granola: Meeting Intelligence ve Async Summary

Granola 2025 Q4'te stack'e eklendi — AI meeting note tool. Zoom call'larını transcript ediyor, summary üretiyor, action item extract ediyor. Eski süreçte meeting notes manuel alınıyordu, 30 dakikalık call 15 dakika not temizliği gerektiriyordu. Granola otomatik summary Notion'a atıyor, action item'lar Linear'a issue olarak açılıyor.

Granola'nın async değeri şurada: timezone farkı yüzünden call'a katılamayanlar 8 dakikalık summary okuyor (60 dakikalık recording yerine). Summary format: key decisions, open questions, next steps. Open questions Slack thread'e post ediliyor, async cevaplar geliyor, next meeting'de resolved olarak işaretleniyor. Bu pattern meeting frequency'sini %40 azalttı — eski sistemde 2 haftada 1 olan sync call 3 haftada 1'e düştü.

### Granola ↔ Notion Pipeline

Granola webhook Zapier'a summary gönderiyor, Zapier Notion API'ye POST request atıyor. Notion'da meeting notes database'e yeni row ekleniyor, row 5 alan taşır: date, attendees (multiselect), summary (rich text), recording link, related project (relation). Summary içinde action item'lar `@{assignee}` mention'la etiketleniyor, mention'lanan kişi Slack DM alıyor. Bu pipeline manuel follow-up ihtiyacını sıfırlıyor — eski sistemde meeting host action item'ları manuel Slack'e yazıyordu, %22'si unutuluyordu.

## Entegrasyon Pattern'leri ve Tradeoff'lar

5 tool entegrasyonu 12 webhook ve 6 Zapier zap üzerinden dönüyor. Webhook failure rate %0.7 (aylık 3-4 hata), Zapier zap execution time median 4.2 saniye. Entegrasyon maliyeti: Zapier Professional plan $240/yıl, Linear Business plan $480/yıl (12 seat), Notion Team plan $192/yıl, Figma Professional $180/seat/yıl (3 designer = $540), Granola Business $360/yıl. Toplam $1812/yıl, kişi başı $151. Bu maliyet async flow'dan gelen zaman tasarrufu ile karşılanıyor — hesaplama: 12 kişi × 2 saat/hafta meeting tasarrufu × $50/saat × 52 hafta = $62,400/yıl.

Tradeoff: entegrasyon kompleksitesi onboarding süresini uzatıyor. Yeni ekip üyesi 5 tool + 12 entegrasyon öğreniyor, ilk hafta documentation okuma 6 saat sürüyor. Alternatif (all-in-one tool, örn. ClickUp) daha hızlı onboarding sağlar ama workflow esnekliği düşük — Linear'ın cycle ritmi, Figma'nın version control'ü, Granola'nın AI summary'si ClickUp'ta yok veya sınırlı.

İkinci tradeoff: vendor lock-in riski. 5 tool 5 farklı vendor, herhangi biri pricing değiştirebilir veya feature kaldırabilir. Mitigation: kritik data Notion'da tutuluyor (export JSON kolay), Linear data SQL export alınıyor (haftada 1 backup), Figma file'lar Git LFS'e mirror ediliyor (version history korunuyor). Bu backup disiplini migration cost'u düşürüyor — gerektiğinde 2 hafta içinde yeni tool'a geçilebilir.

Async-first workflow tool stack'ten önce kültür disiplini gerektirir — notification disiplini, response time SLA, documentation quality. Tool stack bu disiplini ölçülebilir yapar ama yaratmaz. Roibase'de sprint velocity, cycle completion rate, meeting frequency metriklerini quarterly review ediyoruz, trend tersine dönerse workflow kurallarını revize ediyoruz. 2026 Q2'de Linear cycle completion %89, Notion page internal link density 3.2, Slack median response time 47 dakika — bu sayılar async disiplinin sürdürülebilir olduğunu gösteriyor.