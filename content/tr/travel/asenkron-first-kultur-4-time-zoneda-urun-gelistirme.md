---
title: "Asenkron-First Kültür: 4 Time Zone'da Ürün Geliştirme"
description: "Standup toplantısını Linear updates'e dönüştürmek, response SLA kurmak ve async disiplinle 4 kıtada ürün geliştirmek — operasyonel detaylarla."
publishedAt: 2026-05-22
modifiedAt: 2026-05-22
category: travel
i18nKey: travel-002-2026-05
tags: [remote-work, async-culture, distributed-teams, product-development, time-zones]
readingTime: 8
author: Roibase
---

Sabah 09:00'da İstanbul'da standup başlarken, Buenos Aires'te ekip uyuyor. Lizbon'daki designer son commit'i atıp kapanırken, Singapur'daki backend engineer sprint planlama notunu okuyor. 4 time zone'da çalışan bir ürün ekibi için senkron toplantı yapmak, günde 6 saat ortak pencere bulmak demek — yani hiç üretim yapmamak. Asenkron-first kültür bu yüzden tercih değil, zorunluluk. Standup'ı Linear'a, toplantıları Loom'a, soru-cevabı thread'lere taşıdığınızda geriye sadece üretim kalıyor.

## Standup öldü, Linear updates yaşıyor

Günlük standup toplantısı senkron dünyanın kalıntısı. 15 dakikalık toplantı için 4 kişinin takvimini çakıştırmak, zaten dar olan ortak pencerenin %8'ini yakıyor. Ekip üyeleri "bugün ne yapacağım" sorusuna cevap vermek için birbirini bekliyor — kimse asıl işine başlayamıyor.

Linear updates bu döngüyü kırıyor: her ekip üyesi kendi saatinde çalışmaya başlamadan önce son 24 saatin özetini issue'lara comment olarak yazıyor. "Bugün #432'yi bitiriyorum, yarın #455'e geçiyorum" yerine "Yesterday: #432 shipped to staging. Today: Starting #455 — backend integration tests. Blocker: API rate limit discussion, tagged @backend-lead". Format sabit, bağlam tam, zaman damgası var.

Bu yapının işlemesi için 3 kural gerekiyor: (1) Her gün 09:00 local time'a kadar update yazılır — ekip bu commit'e güvenir. (2) Update içinde tag'lenen kişi 4 saat içinde yanıt verir — thread async ama abandoned değil. (3) Update'te blocker varsa mutlaka etiketle — kimse "ben söylemiştim" diyemez. Bu disiplin 3 hafta sonra içselleşiyor, ekip standup toplantısının neden yapıldığını unutuyor.

Roibase'in uzaktan ekibi bu modeli 2023'ten beri kullanıyor. İlk ay boyunca bazı üyeler "görüşmek daha hızlı olurdu" diyor, sonra fark ediyorlar ki async update'ler sayesinde gün içinde kimse takılmıyor — herkes kendi deep work bloğunda ilerliyor. Update'ler aynı zamanda sprint retrospective için ham veri oluyor: "geçen sprint 47 update'te 12 blocker var, hepsi API ekibine düştü" dediğinde bottleneck görünür hale geliyor.

## Response SLA: async ≠ abandoned

Asenkron çalışma "istediğim zaman cevap veririm" anlamına gelmiyor. SLA (Service Level Agreement) olmadan async kültür, yavaş kültüre dönüşüyor. Bir soru soruyorsun, 18 saat sonra cevap gelmiyor — thread ölü, proje duruyor.

Response SLA şu yapıda kurulur: (1) **Urgent:** 2 saat içinde — production outage, deployment blocker, critical bug. Slack'te `@channel` + Pagerduty ping gidiyor. (2) **High:** 4 saat içinde — blocker issue, sprint içi geçiş sorunu. Linear'da etiketlenmiş kişi mutlaka yanıtlıyor. (3) **Normal:** 24 saat içinde — feature tartışması, tasarım feedback, dokümantasyon review. Herkes kendi saatinde okuyor. (4) **Low:** 72 saat içinde — fikir tartışması, uzun vadeli planlama, brainstorm thread.

Bu SLA'yı takip etmek için ekip içinde "response time dashboard" kuruyoruz: Slack'in API'si üzerinden her kişinin ortalama yanıt süresini çıkartıyorsun, Linear webhook'larıyla issue comment gecikmesini ölçüyorsun. Eğer birinin high-priority thread'de ortalama 6 saatlik gecikme varsa, retrospective'de konuşulacak konu bu oluyor.

SLA'nın işlemesi için iletişim kanallarını kesin çizgiyle ayırmak gerekiyor: Slack sadece urgent ve high — her şey thread içinde. Linear normal ve low — detaylı tartışma, kod referansı, screenshot. Email yok — ekip içi iletişimde email async'in en kötü formu çünkü thread görünürlüğü sıfır. Bu ayrım sayesinde ekip "nerede ne soracağını" biliyor, hiçbir konu kaybolmuyor.

### SLA Exception Handling

SLA'yı kimsenin tutamadığı durumlar var: tatil, hasta, farklı sprint. Bu yüzden her ekip üyesi Slack statüsünde "response capacity" bildiriyor: 🟢 Normal (4h SLA), 🟡 Reduced (8h SLA), 🔴 OOO (backup contact: @username). Eğer biri reduced modundaysa, critical tag onun yerine backup'a düşüyor. Bu mekanizma sayesinde "ben bilmiyordum" senaryosu ortadan kalkıyor.

## Async toplantı disiplini: ne zaman senkron gerekli

Her şeyi async'e çevirmek naif bir yaklaşım. Bazı kararlar gerçek zamanlı tartışma gerektiriyor — özellikle yüksek belirsizlik, çok paydaş, trade-off ağırlıklı durumlar. Async toplantı disiplini, "ne zaman senkron yapalım" sorusuna net cevap veriyor.

**Senkron yapılacak 4 durum:**
1. **Sprint planning** — 2 haftada bir, 90 dakika. Ekip capacity, backlog prioritization, dependency mapping gerçek zamanlı yapılır. Toplantı öncesi herkes grooming issue'larını okumuş, tahmini vermiş — meeting sadece önceliklendirme.
2. **Architecture decision** — büyük mimari değişiklik (örn. monolith'ten microservice'e geçiş), 3+ mühendis input veriyor. Async'te thread 40 mesaja varıyor ama karar çıkmıyor — 60 dakikalık sync call bu döngüyü kırıyor.
3. **Incident postmortem** — production'da kritik olay olduğunda, ekip canlı konuşarak "ne oldu, neden oldu, nasıl önleriz" sorusuna cevap buluyor. Async postmortem genelde suçlama thread'ine dönüşüyor.
4. **Onboarding sync** — yeni ekip üyesi ilk 2 hafta boyunca haftada 2 sync call yapıyor. Async onboarding çalışıyor ama yavaş — yeni kişi soru sormaktan çekiniyor.

Bu 4 durum dışında her toplantı async'e dönüşebilir. "Brainstorm" toplantısı Miro board + Linear thread oluyor. "Design review" Figma comment + Loom video oluyor. "Quarterly planning" Notion doküman + async feedback loop oluyor.

**Async toplantı formatı:**
- **Preparation doc (48 saat önce):** Notion'da toplantı agendası, background, karar verilecek konular yazılı. Herkes önceden okuyor, inline comment bırakıyor.
- **Sync call (60 dakika max):** Sadece belirsiz konular tartışılıyor — herkesin aynı fikirde olduğu maddeler skip.
- **Decision log (2 saat sonra):** Toplantı sonunda kararlar Linear issue olarak açılıyor, owner atanıyor, deadline konuyor. Kayıt edilen call'dan transcript + summary çıkartılıyor.

Bu formatta çalışan bir ekip, aylık toplantı saatini 40'tan 12'ye düşürüyor — geri kalan 28 saat production'a gidiyor.

## Time zone overlap stratejisi: herkes 2 saat ortak

4 time zone'da çalışırken %100 overlap bulmak imkansız. Ama herkesin en az 2 saatlik ortak penceresini kurmak mümkün — ve bu 2 saat "hot zone" oluyor. Roibase ekibinde bu hot zone 14:00-16:00 UTC: İstanbul 17:00, Lizbon 15:00, Buenos Aires 11:00, Singapur 22:00. Bu 2 saat içinde:

- Urgent issue'lar tartışılır (Slack thread, max 15 dakika)
- Architecture sync yapılırsa bu pencereye alınır
- Deployment window buraya denk getirilir — herkes online, rollback gerekirse ekip hazır

Bu hot zone dışında ekip tamamen async çalışıyor — kimse "şimdi müsait misin" diye ping atmıyor. Hot zone'u korumak için ekip içinde "calendar block" kuralı var: 14:00-16:00 UTC arası herkes takvimini boş tutuyor, başka toplantı almıyor. Bu disiplin sayesinde 2 saatlik pencere gerçek acil durumlara ayrılmış oluyor.

Hot zone dışında farklı time zone'ların avantajını kullanmak gerekiyor: İstanbul ekibi gün sonunda code review isteği açıyor, Singapur sabah geldiğinde incelemiş oluyor. Lizbon tasarımı güncelliyor, Buenos Aires ekibi implementation'a başlıyor. Bu "relay race" modeli sayesinde proje 24 saat ilerliyor — tek koşul async communication'un net olması.

## Araç stack'i: Linear, Loom, Notion, Slack SLA

Async kültür araç seçimine bağlı. Yanlış tool seçersen, ekip yine senkron çalışmaya geri dönüyor. Roibase'in stack'i şu temelde:

| Araç | Kullanım | Async Kritik Özellik |
|---|---|---|
| **Linear** | Issue tracking, sprint board | Comment thread + tag + SLA label. Her issue'da "last activity" timestamp var. |
| **Loom** | Video async toplantı | Ekran + yüz kaydı, timestamp comment, 1.5x izleme. Design review, code walkthrough için. |
| **Notion** | Dokümantasyon, decision log | Inline comment, version history, page subscription. Herkes async okuyor, tartışıyor. |
| **Slack** | Urgent + thread iletişim | Thread zorunlu, emoji reaction, reminder bot. Hot zone dışında notification kapalı. |
| **Figma** | Tasarım collaboration | Comment mode, version compare, plugin entegrasyonu. Designer async feedback veriyor. |

Bu stack'in işlemesi için 2 kural var: (1) Her araç tek bir amaca hizmet ediyor — overlap yok. Slack'te issue açılmıyor, Linear'da design tartışması yapılmıyor. (2) Her araçta notification ayarı async disipline göre düzenli: Slack sadece mention + urgent channel, Linear sadece assigned + tagged, Notion sadece subscribed page. Bu sayede ekip "sürekli çevrimiçi" olmadan günde 3 kez checkpoint yaparak tüm context'i yakalıyor.

Araç stack'inin async'e uygunluğunu ölçmek için "context switch count" metriğine bakıyoruz: bir ekip üyesi günde kaç kez farklı araca giriş yapıyor, her girişte kaç dakika harcıyor. Eğer birisi günde 40 kez Slack açıyorsa, async kültür çalışmıyor demektir — notification ayarları yeniden kurgulanıyor.

## Async kültürün markalaşmaya etkisi

Uzaktan ekipte tutarlı [markalaşma](https://www.roibase.com.tr/tr/branding) asenkron disiplinle bağlantılı. Ekip 4 farklı şehirde çalışıyorsa, marka diline, görsel kimliğe, tone of voice'a dair kararlar merkezi dokümantasyonda olmalı — kimse "ben bilmiyordum" diyemeyecek şekilde. Async brand guideline Notion'da yaşar, her güncelleme page subscription ile ekibe bildirilir. Tasarım değişikliği Linear issue olarak açılır, feedback thread'de toplanır, karar sonrası guideline'a eklenir. Bu süreç sayesinde marka tutarlılığı time zone'dan bağımsız işliyor.

Async brand management'ın kritik noktası: değişiklik yapılırken "anında onay" beklenmemesi. Yeni logo varyantı Figma'ya ekleniyor, 48 saatlik async review süreci başlıyor. Ekip inline comment bırakıyor, tasarımcı revize yapıyor, final version guideline'a ekleniyor. Bu döngü senkron toplantıdan 3 kat yavaş ama 10 kat detaylı — çünkü herkes kendi saatinde, kendi bağlamında düşünüp feedback veriyor.

---

Asenkron-first kültür "uzaktan çalışma lüksü" değil, dağıtık ekibin üretim yapabilmesinin tek yolu. Standup'ı Linear'a, toplantıyı Loom'a, hot zone'u 2 saate indirdiğinde geriye sadece üretim kalıyor. Ekip 4 time zone'da olsa da, proje 24 saat ilerliyor — tek koşul async disiplinin net kurgulanması.