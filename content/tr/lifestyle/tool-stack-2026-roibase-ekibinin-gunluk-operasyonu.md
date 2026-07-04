---
title: "Tool Stack 2026: Roibase Ekibinin Günlük Operasyonu"
description: "Linear, Notion, Slack, Figma, Granola — 12 kişilik ekipte async-first workflow'un altyapısı ve entegrasyon pattern'leri"
publishedAt: 2026-07-04
modifiedAt: 2026-07-04
category: lifestyle
i18nKey: lifestyle-004-2026-07
tags: [tool-stack, async-workflow, linear, notion, team-ops]
readingTime: 8
author: Roibase
---

8 yıldır aynı soruyu alıyoruz: "Nasıl toplantısız çalışıyorsunuz?" Cevap basit — doğru tool stack, yanlış tool'dan 10 kat daha kritik. 2026'da Roibase'in günlük operasyonu 5 temel araç üzerine kurulu: Linear, Notion, Slack, Figma, Granola. Bunlar birbirini bloke etmeden çalışacak şekilde entegre edildi. Verimlilik hack'i değil, sistemik tasarım. Bu yazıda entegrasyon pattern'lerini, karar kriterlerini ve 12 kişilik ekipte nasıl ölçülebilir sonuç aldığımızı açıyoruz.

## Linear: Single Source of Truth, Toplantı Değil

Linear, Roibase'de proje yönetimi değil — karar mekanizması. Her initiative bir issue, her karar bir comment thread. Async-first ekipte "şu konuyu konuşalım" yerine "şu issue'ya context ekle" disiplini var. Sprint planning toplantısı yok — her hafta Pazartesi sabahı sprint otomatik başlar, velocity bazlı backlog sıralaması Linear'ın cycle view'unda zaten hazır.

Linear'ın kritik özelliği: Github, Figma, Slack entegrasyonu native. Bir PR açtığında otomatik issue'ya bağlanır, status "In Progress"a geçer. Figma tasarımına link verdiğinde Linear kartında preview görünür. Slack thread'inden `/linear` komutuyla yeni issue açarsın, hem Slack hem Linear'da izlenir. Bu 3 tool'un birlikte çalışması bağlam anahtarlama maliyetini yüzde 40 düşürdü (2024-2026 time-tracking verisinden).

Velocity takibi otomatik: her sprint sonunda Linear, tamamlanan point'leri, cycle completion rate'i gösterir. Hedefimiz sprint başına 85+ puan — bu rakamın altına düştüğümüzde backlog refinement toplantısı yaparız (tek exception). Linear API'ından çekilen velocity verisi Notion dashboard'a aktarılır, quarterly review'da kullanılır.

### Linear + Slack: Notification Pattern

Slack'te Linear notification'ları yalnızca critical event'lerde gelir: issue assignment, mention, blocker flag. Diğer tüm update'ler Linear native'de okunur — Slack inbox'ı temiz kalır. Linear'daki her issue'nun Slack thread'i yok, tersine: Slack'teki stratejik konuşmalar Linear issue'ya kopyalanır (context preservation). Bu yön fark yaratır — Slack ephemeral, Linear durable.

## Notion: Documentation, Async Standup, OKR Tracking

Notion, Roibase'in hafızası. Linear operasyonel, Notion stratejik. Her initiative'in "why" kısmı Notion'da durur — Linear'da sadece "what" ve "how". Quarterly OKR'lar, client playbook'ları, onboarding dökümanı, tech spec'ler — hepsi Notion database'lerinde.

Async standup Notion'da: her sabah ekip üyeleri dün neler yaptı, bugün neler yapacak, blocker var mı diye 3 satır yazar. Template otomatik, Slack reminder'ı 09:00'da gelir. Cuma akşamı weekly review: herkes haftanın highlight'ını, challenge'ını paylaşır. Toplantı yok, thread'de async tartışma varsa yapılır. Bu format 2024'ten beri koşuyor — participation rate yüzde 92 (12 kişiden ortalama 11'i her gün yazar).

Notion + Linear entegrasyonu: Linear'daki completed issue'lar otomatik Notion sprint report'una düşer. Report template'i şu metrikleri gösterir: cycle completion rate, velocity, blocker count, PR merge time. Client meeting öncesi bu report PDF'e dönüştürülür, manuel copy-paste yok.

## Slack: Async-First, Real-Time Exception

Slack, Roibase'de senkron iletişim değil — async thread hub. Her channel belli bir bağlama ayrılmış: `#engineering`, `#design`, `#client-xyz`. Direct message kullanımı düşük — özel bilgi değilse channel'da paylaşılır (transparency principle). Thread kullanımı zorunlu: tek mesaj bile topic açıyorsa thread başlatılır, yoksa channel timeline kirlenir.

Slack thread'lerinin lifecycle'ı: thread açılır, context eklenir, karar alınır, Linear issue'ya summary kopyalanır, thread archive edilir. Archive edilen thread'ler Notion weekly log'a otomatik eklenir (Zapier entegrasyonu). Böylece Slack geçici, Notion kalıcı olur.

Real-time exception: client emergency, production bug, deadline shift — bunlar Slack'te `@channel` mention alır. Diğer tüm konuşmalar async — 4 saat response time beklentisi var, hemen cevap yok. Bu kural remote ekipte timezone çakışmasını ortadan kaldırır. İstanbul, Londra, New York saatlerinde çalışan ekip üyeleri birbirini bloke etmez.

### Slack + Granola: Meeting Automation

Granola, 2025'te ekibe eklenen tek yeni tool. Toplantı note automation yapıyor — Google Meet'te kaydedilen görüşmeyi transkript eder, action item çıkarır, Linear issue'ya dönüştürür. Client call sonrası manuel note almak yerine Granola output'u Notion client folder'ına düşer. Time saving: call başına 15 dakika, haftada ortalama 8 call = 2 saat.

Granola'nın kritik değeri: mühendislerin toplantıya tam focus etmesi. Note tutarken dikkat dağılır, Granola post-call özetler, ekip daha sonra okuyor. Toplantı kalitesi artıyor, post-call aksiyonlar Linear'a otomatik geçiyor.

## Figma: Design Handoff Otomasyonu

Figma, Roibase design sisteminin tek source'u. Component library burada — brand guide, UI kit, client project prototype'ları. Figma + Linear entegrasyonu: tasarım tamamlandığında Figma file link'i Linear issue'ya eklenir, status "Ready for Dev"e geçer. Developer Figma comment'ine soru yazarsa designer Slack'te değil Figma'da cevaplar (context preservation).

Figma Dev Mode 2025 özelliği sayesinde CSS/Tailwind code snippet otomatik generate ediliyor — developer Figma'dan kopyalayıp koda yapıştırır. Design-dev handoff toplantısı yok, async Figma comment thread'i var. Ortalama handoff süresi 2024'te 3 gün, 2026'da 1 güne düştü (Linear cycle time verisinden).

Figma + Notion entegrasyonu: design spec'ler Notion page'ine embed edilir, version history otomatik sync'lenir. Client approval sürecinde Figma prototype link'i Notion client portal'da durur, client direk üzerinde comment yapar. Email attachment yerine live link — feedback loop hızlanır.

## Entegrasyon Pattern'i: Bağlam Anahtarlama Maliyeti

Tool stack başarısı, toollar arası geçiş maliyetinde ölçülür. Roibase'in pattern'i: her tool belli bir iş için single source of truth. Linear operasyon, Notion strateji, Slack communication, Figma design, Granola meeting. Overlap yok — aynı bilgi iki tool'da durmuyor.

Örnek workflow: client yeni feature istiyor. Granola toplantıyı kaydeder → Linear issue açılır → Figma'da tasarım yapılır → Linear'da link eklenir → Notion'da spec yazılır → GitHub'da PR açılır → Linear otomatik "Done"a geçer → Notion sprint report'una düşer. Bu 7 adım 5 tool kullanır ama hiçbiri manuel copy-paste içermez. Otomasyon coverage yüzde 80 (Zapier + native integration'lar sayesinde).

Bağlam anahtarlama sayısı günlük ortalama 12 (time-tracking data). Benchmark: industry average 25. Fark: tool'lar birbirine entegre, notification gürültüsü filtrelenmiş, async-first disiplin var.

## Tool Seçim Kriteri: Ölçülebilir ROI

Roibase yeni tool eklemeden önce 3 soru sorar: (1) Mevcut tool stack'te bu işi yapan var mı? (2) Entegrasyon maliyeti ne? (3) Ölçülebilir ROI ne? Granola örneği: toplantı note'u Notion'da manuel tutuluyordu, Granola 2 saat/hafta kazandırdı, aylık maliyet 50 dolar — ROI net.

Tool removal kriteri: son 30 günde kullanım yüzde 20'nin altına düşerse review edilir. 2025'te 2 tool kaldırıldı (Miro, Airtable) — Linear + Figma + Notion combo aynı işlevi karşılıyordu. Tool bloat'tan kaçınmak, focus korumak için kritik.

[Markalaşma & Brand Identity](https://www.roibase.com.tr/tr/branding) sürecinde tool stack kararları ekip kültürünü yansıtır. Remote-first, async-first, documentation-first disiplin operasyonel araçlara yansır. Tool seçimi brand extension gibi — nereden çalışıyorsan önemli değil, nasıl çalıştığın önemli.

## Şimdi Ne Yapmalı

Tool stack optimize etmek yılda bir review değil, sürekli disiplin. Roibase'in pattern'i: quarterly tool audit, weekly automation check, daily async discipline. 12 kişilik ekipte toplantısız hafta mümkün çünkü toollar doğru entegre edilmiş, ekip async-first prensiplere uyuyor. Verimlilik shortcut değil, sistemik tasarım. Tool stack'inizi 2026 standartlarına taşımak istiyorsanız ilk soru şu: "Hangi tool single source of truth olacak?" Cevabı netleştirin, overlap'i temizleyin, otomasyonu kurun.