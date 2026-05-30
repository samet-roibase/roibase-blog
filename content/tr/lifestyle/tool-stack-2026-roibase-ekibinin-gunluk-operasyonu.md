---
title: "Tool Stack 2026: Roibase Ekibinin Günlük Operasyonu"
description: "Linear, Notion, Slack, Figma, Granola — 12 kişilik büyüme ekibinde entegrasyon pattern'leri ve ölçülebilir verimlilik disiplini."
publishedAt: 2026-05-30
modifiedAt: 2026-05-30
category: lifestyle
i18nKey: lifestyle-004-2026-05
tags: [tool-stack, async-workflow, linear, notion, team-operations]
readingTime: 7
author: Roibase
---

Tool stack konuşmaları genelde "biz şu uygulamaları kullanıyoruz" kataloguna dönüşür. Ama asıl mesele tek başına araçlar değil — entegrasyon pattern'i, bağlam anahtarlama maliyeti, async-first disiplin. Roibase'de 12 kişilik ekip 2018'den beri remote-first çalışıyor. 2026'da günlük operasyonumuzu şekillendiren 5 araç var: Linear, Notion, Slack, Figma, Granola. Bu yazıda araçları sıralamak yerine entegrasyon katmanını açıyoruz — hangi veri nerede yaşıyor, hangi workflow tetikleyici, hangi notification katmanı kapalı.

## Linear: Sprint Değil, Flow Metrikleri

Linear proje yönetimi aracı olarak satılıyor ama Roibase'de "work-in-progress görünürlük katmanı" olarak çalışıyor. Sprint planlaması yapmıyoruz — cycle/milestone kullanmıyoruz. Bunun yerine her issue'ya **priority (P0/P1/P2)** ve **estimate (1-3-5-8)** veriyoruz. Priority kişinin değil, sistemin kararı: P0 = bugün deploy bloklanıyorsa, P1 = sprint içinde bitmeli, P2 = backlog.

**Flow metrikleri:**
- **Cycle time:** Issue açılışından kapanışa ortalama 2.3 gün (2025 Q4 verisi). 5 günü geçen issue otomatik P0'a terfi ediyor.
- **Work-in-progress limit:** Kişi başı maksimum 3 açık issue. 4. issue alabilmek için 1 tanesini kapatmalı veya başkasına devretmeli.
- **Merge-to-close süresi:** PR merge edildikten sonra Linear issue'nun kapanışına kadar geçen süre — hedef <30 dakika (CI/CD + QA otomasyonu).

Linear'ın Slack entegrasyonu kapalı. Notification bombardımanı yerine **digest sistemi**: Her sabah 09:00'da Slack kanalına günlük özet gönderiliyor (P0 issue sayısı, cycle time ortalaması, WIP dağılımı). Kimse Linear'da mention atamıyor — zaten herkes sabah digest'ı okuyor.

### Linear → Notion Senkronizasyonu

Linear'daki completed issue'lar haftada 1 kez Notion'a arşivleniyor (Zapier workflow). Notion'da "Retrospective Database" var — her tamamlanan issue'nun hangi hizmete bağlı olduğu etiketleniyor. Örneğin `branding` projesi kapsamındaki issue'lar [Markalaşma & Brand Identity](https://www.roibase.com.tr/tr/branding) servisi altında raporlanıyor. Bu veri 3 ayda 1 capacity planning için kullanılıyor: hangi hizmette ne kadar mühendislik zamanı harcanıyor?

## Notion: Source of Truth, Not a Wiki

Notion'u wiki olarak kullanmıyoruz — "decision log" olarak kullanıyoruz. Her stratejik karar (örneğin "X kampanyasında server-side tracking mi, client-side mi?") Notion'da **RFC (Request for Comments)** formatında yazılıyor. RFC şablonu:

```
## Karar
[Tek cümle — ne yapıyoruz]

## Bağlam
[Neden şimdi gerekli]

## Alternatifler
[En az 2 seçenek + tradeoff tablosu]

## Ölçüm
[Kararın doğru olup olmadığını 4 hafta sonra nasıl anlayacağız]

## Sahiplik
[Kimin sorumluluğunda]
```

RFC açıldıktan sonra 48 saat async comment süresi var. Kimse toplantı çağırmıyor — herkes kendi zamanında okuyor, yorum bırakıyor. 48 saat sonra decision owner nihai kararı yazıyor, issue Linear'a taşınıyor.

**Notion içindeki veri katmanları:**
1. **RFC Database** — tüm kararlar
2. **Retrospective Database** — Linear'dan gelen tamamlanmış işler
3. **Client Playbook** — müşteri bazlı operasyon notları (hangi dashboard nerede, hangi API key nerede)
4. **Brand Assets** — Figma link'leri, tone-of-voice dokümanı

Notion'da search çalışmıyor diye şikayet edilir ama biz search yapmıyoruz — her veritabanı filtrelenebilir ve tag'leniyor. Search ihtiyacı genelde "veriyi yanlış yere koymuşsun" anlamına gelir.

## Slack: Async-First, Real-Time-Second

Slack'in notification sistemi ekip genelinde kapalı. Sadece `@channel` ve `@here` açık — ve bunları kullanma kuralı var: P0 incident dışında yasak. Mesajlaşma 3 kanala ayrılmış:

1. **#daily-digest:** Linear/Notion özetleri, CI/CD deploy logları
2. **#async-questions:** Kimsenin hemen cevap vermesini beklemediğin sorular (24 saat içinde cevap yeterli)
3. **#sync-now:** Gerçek zamanlı koordinasyon gerekiyor (örn. production incident, canlı kampanya optimizasyonu)

**Response time beklentileri:**
- `#sync-now` → 15 dakika
- `#async-questions` → 24 saat
- DM → 48 saat (DM culture yok, kanal kullanılıyor)

Slack thread kullanımı zorunlu. Ana kanala reply yazmak yasak — her mesaj thread açıyor. Böylece paralel konuşmalar karışmıyor.

### Slack → Granola Entegrasyonu

Granola meeting note aracı — ama Roibase'de sadece client call'larda kullanılıyor. Internal toplantı yapmıyoruz (haftada 0-1 sync call). Client call sonrası Granola AI transcript'i Slack'e gönderiyor, ekip async okuyor. Action item'lar otomatik Linear issue'ya dönüşüyor (Zapier trigger).

Granola'nın killer feature'ı: transcript'te söylenen sayısal commitment'ları highlight ediyor ("2 hafta içinde A/B test sonuçları", "CTR %15 artmalı"). Bunlar otomatik reminder alıyor — kimse unutmuyor.

## Figma: Design Handoff Değil, Living Spec

Figma sadece tasarım aracı değil — "frontend spec" katmanı. Her UI component Figma'da variant olarak tanımlanmış. Developer Figma'dan kod çıkarmıyor (copy CSS yapmıyoruz) — ama component behaviour'ını oradan okuyor. Örneğin bir button'ın `hover`, `active`, `disabled` state'leri Figma'da frame olarak var. Code'da aynı state logic uygulanıyor.

**Figma → Linear bağlantısı:**
Her Figma file'ında `Linear Issue` plugin var. Tasarım onaylandığında designer direkt Linear issue açıyor, Figma link'ini issue description'a yapıştırıyor. Developer issue'yu aldığında tasarımı zaten biliyor — soru sormadan implement ediyor.

Figma comment'leri Slack'e akmıyor (notification bombardımanı olmasın diye). Bunun yerine haftada 1 "Figma Digest" — açık comment'ler Linear issue'ya dönüştürülüyor.

## Entegrasyon Pattern'i: Veri Nerede Yaşıyor?

Tool stack konuşmaları çoğu zaman "hangi aracı kullanıyorsun" sorusuyla başlar. Ama asıl soru "hangi veri nerede canonical?" olmalı. Roibase'de data ownership şöyle:

| Veri tipi | Source of truth | Senkronize edildiği yer |
|---|---|---|
| Aktif iş (WIP) | Linear | Slack daily digest |
| Tamamlanmış iş (retrospective) | Notion | Linear (archived) |
| Stratejik kararlar | Notion (RFC) | Linear (action items) |
| Client meeting notes | Granola | Slack thread |
| UI spec | Figma | Linear issue description |
| Brand assets | Notion | Figma (embed link) |

Çift source-of-truth yok. Eğer bir veri 2 yerde canonical gibi duruyorsa biri yanlış.

## Notification Disiplini: Ne Zaman Sessiz, Ne Zaman Gürültü

Modern tool stack'in en büyük tehlikesi notification creep. Roibase'de notification stratejisi şöyle:

**Tamamen kapalı:**
- Linear mention'lar (issue comment yerine Slack thread kullanılıyor)
- Figma comment'ler (haftalık digest)
- Notion page update'leri (kimse watch etmiyor)

**Digest olarak:**
- Linear daily summary (sabah 09:00)
- Figma open comment summary (Cuma 17:00)
- CI/CD deploy log (her deploy sonrası Slack'e özet)

**Real-time:**
- `@channel` (sadece P0 incident)
- Granola client call summary (call bitince 5 dakika içinde)
- Production error (Sentry → Slack, ama sadece `#sync-now` kanalına)

Her araç kurulduğunda ilk soru: "Bu notification real-time mı olmalı, yoksa digest'a mı gitmeli?" Default cevap digest.

## Şimdi Ne Yapmalı?

Tool stack konuşmalarında "biz de şunu kullanalım" refleksi yerine "veri nerede canonical olmalı?" sorusunu sor. Roibase'in 2026 stack'i Linear/Notion/Slack/Figma/Granola üzerine kurulu ama bu araçlar değişebilir — önemli olan entegrasyon pattern'i, notification disiplini, async-first kültür. Eğer ekibinde hâlâ "tool X'in bildirimi gelmiyor" diye şikayet varsa sorun tool değil — data ownership belirsiz demektir.