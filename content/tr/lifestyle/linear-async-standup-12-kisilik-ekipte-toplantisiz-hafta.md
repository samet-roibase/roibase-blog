---
title: "Linear + Async Standup: 12 Kişilik Ekipte Toplantısız Hafta"
description: "Cycle bazlı sprint yönetimi, async daily updates ve blocker escalation pattern ile toplantı yükünü %80 düşüren operasyon disiplini."
publishedAt: 2026-08-12
modifiedAt: 2026-08-12
category: lifestyle
i18nKey: lifestyle-001-2026-08
tags: [async-workflow, linear, team-operations, deep-work, remote-team]
readingTime: 8
author: Roibase
---

Roibase'de 12 kişilik engineering ve growth ekibi 2024 sonundan beri haftada ortalama 2 saat toplantı yapıyor. Q1 2025'te takım içi toplantı sayısı 4'e düşmüştü. Q2'de 0'a çekme hedefi tutturuldu — iki hafta boyunca hiç toplantı olmadı. Bu sonuç planlama veya onboarding toplantısı yokluğuyla değil, operational disiplinle kuruldu: Linear'daki cycle yönetimi, async daily updates ve blocker escalation pattern.

Ekip boyutu büyüyünce "sadece Slack'te konuşalım" modeli çöker. Context kaybı artar, tekrar sorular gelir, aynı blocker 3 gün farklı kanallarda tartışılır. Biz 8 kişiyi geçince bu duvara çarptık. Çözüm toplantı artırmak değildi — tersine, asenkron yapıları sistemik hale getirmekti. Linear'ı sadece issue tracker değil, operational truth kaynağı olarak kullandık.

## Cycle: Sprint'in Ölçülebilir Versiyonu

Linear'da cycle sprint'in kanban'sız, kriter-odaklı versiyonu. 2 haftalık blocklara çalışıyoruz. Her cycle başında 3 sayı belirleniyor: planned scope (story point), committed scope (ekibin taahhüt ettiği) ve delivered scope (cycle sonunda tamamlanan). Bu sayılar Linear API üzerinden Notion dashboard'a düşüyor — 8 cycle'lık rolling average ile velocity trendi izlenebiliyor.

Her cycle'da issue önceliği manuel değil, label + project ilişkisiyle otomatik sıralanıyor. P0 = blocker, P1 = bu cycle teslim, P2 = backlog. Engineering lead her pazartesi sabahı 15 dakika Linear view'ı tarar. P0 varsa Slack'e mention atmaz, doğrudan issue'ya @mention ile assign eder. Açılmış P0 issue 24 saat içinde çözülmezse otomatik CEO'ya escalate ediliyor (Zapier + Linear webhook). Bu kural 6 ayda 2 kez tetiklendi — her ikisi de infra blocker'dı.

Cycle bazlı çalışma takımın capacity'sini görünür kılar. Q1'de ortalama velocity 52 story point'ti. Q2'de 61'e çıktı — ekip büyümedi, ama iki junior developer'ın ortalama ticket completion time'ı 4.2 günden 2.8 güne düştü. Bunun nedeni daha iyi kod değil, daha net acceptance criteria. Her issue Linear template'e uyuyor: problem, expected outcome, technical context, definition of done. Template'e uymayan issue cycle'a dahil edilmiyor.

## Async Daily Update: Standup'ın Yazılı Hali

Günlük standup'ı kaldırdık ama daily update zorunlu. Her ekip üyesi saat 18:00'e kadar Linear'da 3 satır yazıyor: bugün ne tamamlandı, yarın ne yapılacak, blocker var mı. Bu update manuel değil — Linear automation ile issue status değiştiğinde auto-populate oluyor. Tamamlanan issue'lar "Done today" alanına düşüyor, in-progress olanlar "Tomorrow" alanına geçiyor.

Update formatı standart: issue ID + tek cümle özet. "Bugün GAds attribution bug'ını çözdüm" yerine "LIN-482: Server-side conversion event timestamp mismatch fixed, QA'da test ediliyor." Bu detay operational hafızayı korur. 3 ay sonra birisi "o bug nasıl çözüldü" diye sorarsa Linear history'de bulabiliyor. Slack thread'lerde bulunamaz.

Blocker escalation kuralı basit: Bir issue 2 gün "In Progress" kalırsa otomatik blocker label alıyor. Blocker issue'yu ekip Slack kanalında bot paylaşıyor. 24 saat çözülmezse engineering lead'e assign ediyor. Bu rule 3 ayda 9 kez tetiklendi — 7'si 48 saat içinde resolved, 2'si scope değişikliği nedeniyle cycle'dan çıkarıldı. Bu pattern toplantısız blocker çözüm mekanizması.

### Time-to-Merge ve Code Review Döngüsü

Async update'in en kritik noktası PR (pull request) review disiplini. Roibase'de PR açılma-merge arası ortalama süre 18 saat. Target 24 saat. Her PR Linear issue'ya link. Review request Slack'te değil, GitHub'da @ mention ile yapılıyor. Reviewer 8 saat içinde yanıt vermezse otomatik ikinci reviewer assign ediliyor.

Code review de async. Yorumlar GitHub inline comment olarak düşüyor. Toplantı yok, "sync'leşelim" yok. Review criteria checklist: test coverage >80%, migration plan (varsa), breaking change impact. Bu kriterlere uymayan PR merge edilemiyor — GitHub branch protection rule. 6 ayda 3 PR force-merge edildi, hepsi production hotfix.

## Operational Truth: Linear as Single Source

Linear'ı sadece task manager değil, operational truth kaynağı olarak kullanıyoruz. Ekip içi tüm kararlar Linear comment'lerde belgeleniyor. Slack thread'de tartışma olursa sonuç Linear issue'ya taşınıyor. Bu disiplin knowledge loss'u ortadan kaldırıyor.

Örnek: Q2'de analytics stack değişikliği kararı verildi (GA4'ten Mixpanel'e geçiş). Karar süreci 4 gün sürdü, 12 Slack mesajı + 2 Google Doc tartışması. Sonuç Linear epic'e taşındı: decision rationale, technical approach, rollout timeline. 3 ay sonra yeni bir developer "neden Mixpanel kullanıyoruz" diye sordu. Yanıt Slack'te kaybolmadı, Linear'da 2 tıkla bulundu.

Linear'daki her cycle sonunda retrospective issue açılıyor. Template: what went well, what blocked us, action items. Retrospective async — 3 gün içinde herkes yorum yazıyor. Toplantı yok. Action item'lar yeni cycle'a P1 issue olarak taşınıyor. Bu döngü 8 cycle boyunca tekrarlandı, velocity %17 arttı. Sebep: blocker'lar tespit edilip sistemik çözüldü.

## Bağlam Anahtarlama Maliyeti ve Deep Work

Toplantısız hafta sadece takvim optimizasyonu değil, cognitive load azaltma stratejisi. Her toplantı ortalama 25 dakika bağlam anahtarlama maliyeti taşır (Cal Newport, "Deep Work"). 12 kişilik ekipte haftada 8 toplantı = 200 dakika/kişi kayıp. Biz bu maliyeti sıfırladık.

Async workflow'un tradeoff'u gecikmeli feedback. Slack'te sorduğun soru anında yanıt almayabilir. Ama bu problem değil — design. Ekip Slack yanıt zamanı median 2 saat, max 8 saat. Bu süre yeterli çünkü blocker'lar Linear'da flag'leniyor, kritik konular eskalasyon pattern'ına giriyor. "Acil" denilen şeylerin %90'ı aslında acil değil.

Deep work kuralı: herkes günde 4 saat kesintisiz blok tutuyor. Slack notification bu saatlerde kapalı. Linear'da "Do Not Disturb" modu. Bu blok sabah 9-13 veya öğleden sonra 14-18 olabilir. Ekip calendar'ında görünür. Bu disiplin code quality'yi artırdı — complex refactor'lar deep work bloklarında yapıldı, basit bug fix'ler async slot'larda tamamlandı.

## Toplantı Sıfıra İnmez, Ama Yük Düşer

Ekip hiç toplantı yapmıyor iddiası yalan olur. Şu toplantılar var: bi-weekly cycle planning (45 dakika), quarterly roadmap sync (90 dakika), onboarding 1:1 (yeni üye başına 2 saat). Ama operational toplantı sıfır: daily standup yok, status update yok, "hızlıca sync'leşelim" yok.

Bu sistem her ekibe uygun değil. Eğer ekip kültürü yazılı iletişime yatkın değilse, async disiplin kurmak 6-9 ay alır. Roibase'de bu geçiş 4 ay sürdü. İlk ay update compliance %60'tı. İkinci ay %85'e çıktı. Üçüncü aydan sonra %95+ stabil kaldı. Şimdi yeni üye onboarding'inde async workflow ilk gün öğretiliyor.

Bir diğer unsur tool disiplini. Linear, GitHub, Notion, Slack — hepsi entegre. Ama asıl güç integration değil, constraint. Slack'te operational karar verilmiyor. Linear'da tartışma yapılmıyor. Her tool tek bir truth katmanında duruyor. Bu mimari ekibin bilişsel yükünü düşürür, çünkü "bu bilgi neredeydi" sorusu ortadan kalkar.

---

Toplantısız hafta sihir değil, sistemik disiplin. Linear cycle yönetimi operational truth'u zorunlu kılar. Async daily update blocker'ları görünür yapar. Escalation pattern ekip liderinin müdahalesini otomatikleştirir. Bu 3 katman bir arada çalıştığında toplantı ihtiyacı doğal olarak düşer. Ekip büyürse sistem scaling yapar — biz 12 kişiden 20 kişiye çıkacağız, mekanizma aynı kalacak. Tek fark: cycle velocity target'ı 61'den 95'e çıkacak.