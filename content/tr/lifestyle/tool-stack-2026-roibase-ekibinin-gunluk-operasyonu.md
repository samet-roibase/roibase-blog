---
title: "Tool Stack 2026: Roibase Ekibinin Günlük Operasyonu"
description: "Linear, Notion, Slack, Figma, Granola — entegrasyon pattern'leri ve async-first ekip disiplinini nasıl kurduğumuzu gösteriyoruz."
publishedAt: 2026-07-15
modifiedAt: 2026-07-15
category: lifestyle
i18nKey: lifestyle-004-2026-07
tags: [tool-stack, async-workflow, linear, notion, team-operations]
readingTime: 8
author: Roibase
---

2026'da tool stack seçimi artık sadece "hangi uygulamayı kullanıyorsun" sorusu değil. Asıl soru: bu araçları nasıl entegre ettiğin, bağlam anahtarlama maliyetini nasıl düşürdüğün, async-first disiplini nasıl kurduğun. Roibase'de 12 kişilik multidisipliner ekip — pazarlama, data, headless commerce, brand stratejisi — tek bir operasyonel stack üzerinde çalışıyor. Bu yazıda kullandığımız 5 çekirdek aracı ve entegrasyon pattern'lerini paylaşıyoruz. Sayısal kriter: günde ortalama 2.3 saat toplantı, async response time 4 saat altında, sprint velocity %87 öngörülebilirlik.

## Linear: Backlog Değil, Sprint Disiplini

Linear'ı 2024'ten beri kullanıyoruz. Jira'dan geçiş nedeni: hız ve konsensüs zorlaması. Linear'da her issue zorunlu olarak bir cycle'a (sprint) bağlı — backlog şişirmesi yapamıyorsun. Bizde cycle 2 hafta, Pazartesi başlıyor. Her cycle başında velocity hedefi: takım başına 40-45 story point. Bu rakam son 6 cycle'ın ortalamasına göre belirleniyor — tahmin değil, ölçüm.

Linear'ın en güçlü özelliği project-issue hiyerarşisi. Biz bunu şöyle kullanıyoruz: her client kampanya bir project, altında epics (örn. "Q3 brand refresh"), epic altında tasks. Task'lar Slack'e otomatik düşüyor — `/linear create` komutuyla doğrudan Slack thread'inden issue açabiliyorsun. Bu sayede "şu konuşmayı Linear'a taşıyalım" fraksiyonu yok. Konuşma thread'i Linear issue'ya link oluyor, bağlam kaybolmuyor.

Bir diğer kural: issue assignee her zaman tek kişi. "Birlikte yapacağız" durumunda parent issue açıyoruz, altında 2 sub-task. Bu accountability belirsizliğini kesiyor. Sprint retrospective'de velocity tutturma oranı %87 — son 12 cycle ortalaması. Bu oran Linear'ın due date + estimate enforcement'ı sayesinde stabil kalıyor.

## Notion: Tek Kayıt, Çift Amaç

Notion bizde iki katmanda çalışıyor: documentation ve decision log. Documentation klasik — onboarding, SOP, runbook. Ama decision log daha kritik. Her strategic karar (tool değişimi, client onboarding süreci revizesi, yeni hire JD) Notion'da bir page olarak açılıyor. Template: context, options (tablo), decision, rationale. Bu sayede 6 ay sonra "neden şu aracı seçmiştik" diye geriye bakabiliyorsun.

Notion-Linear entegrasyonu henüz native değil, biz Zapier ile bağladık. Linear'da bir epic tamamlandığında Notion'da ilgili project page'e otomatik "completed" tag düşüyor. Bu minor ama önemli — çünkü PM'ler Linear'da yaşıyor, stakeholder'lar Notion'da yaşıyor. İki tarafın da güncel kalması gerekiyor.

Notion'ın en zayıf noktası: search. 400+ page birikince arama sonucu kalitesi düşüyor. Biz bunun için tagging disiplini koyduk: her page'e minimum 3 tag (team, project type, status). Arama yerine filter kullanıyoruz — bu sayede search engine'in halüsinasyon problemi azalıyor.

### Knowledge Base vs. Chat Memory

Notion'ı team chat'e (Slack) bağlamıyoruz. Chat ephemeral, Notion persistent. Chat'te karar alındıysa, biri manuel olarak Notion'a taşıyor. Bu friction kasıtlı — her şeyin Notion'a düşmesini istemiyoruz. Sadece reusable bilgi Notion'a giriyor. Slack thread retention 90 gün — bu süre sonra silinmeyen thread'ler otomatik archive. Bu kural sayede Notion gerçekten "tek kayıt" oluyor.

## Slack: Async-First, Meeting-Last

Slack'te channel sayısı 42. Kural: her client bir channel, her internal function bir channel (örn. #data-ops, #brand-strategy). Private channel yok — transparency default. Sadece HR konuları DM'de. Bu sayede onboarding hızı yüksek — yeni hire ilk gün tüm context'i channel history'den okuyor.

Async-first kültürü Slack thread disipliniyle sağlanıyor. Kural: her mesaj ya thread'de cevap alıyor ya da reaction. Eğer mesaj 2 saat içinde reaction almadıysa, "bu konuya kimse sahip çıkmıyor" sinyali. Thread'de cevap verme süresi ortalaması 4.2 saat (son 30 gün). Bu sync toplantı ihtiyacını kesiyor.

Slack-Linear entegrasyonu iki yönlü: Slack'te `/linear` ile issue açıyorsun, Linear'da issue update olunca Slack'e notification düşüyor. Bu sayede PM'ler Linear'da yaşıyor, developer'lar Slack'te yaşıyor — ikisi de güncel. Notification gürültüsü sorunu var mı? Var. Biz bunu şöyle çözdük: her kullanıcı kendi mention keyword'ünü belirliyor (örn. "@john-urgent"), sadece o keyword'de push notification geliyor. Geri kalan notification'lar async okunan "Updates" channel'ına düşüyor.

## Figma: Design Handoff, Şikayet Yok

Figma bizde sadece UI/UX için değil, brand asset management için de kullanılıyor. Her client'ın bir Figma workspace'i var — logo variants, color palette, typography system, slide template hepsi orada. Developer handoff Figma'nın inspect mode'uyla oluyor — "bu mavi hangi hex kodu" tartışması yok.

Figma-Notion entegrasyonu manuel. Design finalize olunca Figma link'i Notion project page'e embed ediyoruz. Bu sayede stakeholder Notion'dan çıkmadan design'ı görüyor. Figma comment feature'ını kullanmıyoruz — çünkü comment Figma'da kalıyor, Slack'e düşmüyor. Tüm feedback Slack thread'inde toplanıyor, sonra designer Figma'ya taşıyor.

Figma'nın version control'ü güçlü ama naming convention senin sorumluluğunda. Bizde kural: her major revision "v1.0", "v2.0" diye isimlendirilmeli. Minor iteration'lar "v1.1", "v1.2". Bu sayede client'a "v2.3'ü onayladınız" diyebiliyorsun — hangi dosya belirsizliği yok.

## Granola: Meeting'i Async Artifact'a Dönüştürmek

Granola 2025 sonunda ekledik. AI meeting note tool — ama bizim kullanım case'i farklı. Granola sadece transcript değil, action item extraction yapıyor. Meeting bitince Granola otomatik Linear issue açıyor, assignee belirliyor. Bu sayede "toplantıda konuşulan şey Linear'a girdi mi" fraksiyonu yok.

Granola'nın en iyi özelliği: meeting summary'yi Slack'e webhook ile gönderiyor. Meeting'e katılmayan team member 5 dakika sonra #meeting-notes channel'ında özeti okuyor. Bu async transparency sağlıyor — FOMO (fear of missing out) azalıyor, gereksiz meeting katılımı azalıyor.

Granola henüz Notion entegrasyonu yok. Biz bunu manuel yapıyoruz: kritik client meeting'lerin Granola summary'si Notion decision log'a kopyalanıyor. Bu friction kasıtlı — her meeting'i Notion'a taşımak istemiyoruz. Sadece strategic kararlar Notion'a giriyor.

## Entegrasyon Pattern'leri: Friction Yerleştirmek

Tool stack'in başarısı sadece hangi aracı seçtiğinde değil, hangi noktaya friction yerleştirdiğinde. Bizde 3 kasıtlı friction var:

1. **Slack → Notion:** Otomatik değil. Chat'teki karar manuel taşınıyor. Bu sayede Notion'da noise yok.
2. **Figma → Linear:** Comment entegrasyonu yok. Feedback Slack'te toplanıyor. Bu sayede feedback tek yerde.
3. **Granola → Notion:** Otomatik değil. Kritik meeting'ler manuel taşınıyor. Bu sayede Notion decision log kaliteli.

Bu friction'lar "her şey otomatik olsun" mantığına ters ama amaçlı. Çünkü otomasyonun maliyeti: hangi bilginin nerede olduğunu kaybetmek. Biz friction yerleştirerek bilgi hiyerarşisi kuruyoruz: Slack ephemeral, Linear sprint-scope, Notion strategic.

## Sayısal Sonuç: Operasyonel Verimlilik

2026 Q2 verisi:
- Günlük ortalama toplantı süresi: 2.3 saat (2024 Q2: 4.1 saat)
- Async response time: 4.2 saat (hedef 4 saat altı)
- Sprint velocity öngörülebilirlik: %87 (son 12 cycle)
- Linear issue açılıştan kapanışa median süre: 3.8 gün
- Notion page sayısı: 412 (aktif), search yerine filter kullanım %78

Bu rakamlar tool seçimiyle değil, entegrasyon disipliniyle geliyor. Eğer Linear, Notion, Slack ayrı siloların "en iyi tool'u" olarak yaşasaydı, bağlam anahtarlama maliyeti bugünkünün 2 katı olurdu. Biz entegrasyon pattern'lerini — özellikle friction noktalarını — bilinçli tasarlayarak operasyonel hızı koruyoruz.

Tool stack sadece yazılım listesi değil. Ekip disiplini, naming convention, async kültürü, accountability kuralları — hepsi bir arada. [Markalaşma & Brand Identity](https://www.roibase.com.tr/tr/branding) çalışmamızda olduğu gibi, operasyonel kimlik de tutarlı bir pattern gerektirir. Araçlar değişir, pattern kalır.