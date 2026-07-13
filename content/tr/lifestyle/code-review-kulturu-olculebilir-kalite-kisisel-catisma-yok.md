---
title: "Code Review Kültürü: Ölçülebilir Kalite, Kişisel Çatışma Yok"
description: "Time-to-review, comment density, PR size kuralları ile code review sürecini kişisel yoruma kapatıp ölçülebilir disipline bağlamak."
publishedAt: 2026-07-13
modifiedAt: 2026-07-13
category: lifestyle
i18nKey: lifestyle-003-2026-07
tags: [code-review, async-workflow, developer-experience, team-culture, engineering-discipline]
readingTime: 8
author: Roibase
---

Code review, çoğu ekipte "senior developer'ın yorumu" ile başlayıp "PR sahibinin ego kırıklığı" ile biten bir süreç. Bu yapı ölçeklenmiyor. 12 kişilik ekipte kim neyin sorumlusu belli değil, merge süresi 3 gün oluyor, "bu neden red yedi" tartışması Slack'te 40 mesaj sürüyor. Soruna yakından bakarsan kök neden aynı: review kuralları kişisel tercihe, kalite kriteri ise "ben beğendim/beğenmedim" eksenine oturmuş. Roibase'de 8+ yıldır uygulanan disiplin basit: review'ı sayısal eşiklere bağla, kişisel yoruma kapatma alanı daralt, async akışı zorla. 2026'da artık "code review kültürü" başlığında konuşulacak şey "kültür" değil — ölçülebilir metrikler ve kurallar.

## Time-to-Review: Async Workflow'un Omurgası

Time-to-review, bir PR'ın açılışı ile ilk review yorumunun bırakılması arasındaki süre. Bu sayı 4 saatten uzunsa async workflow çöküyor. Ekip üyesi PR açtı, 6 saat sonra hâlâ kimse bakmadı, o arada başka işe geçti — bağlam anahtarlama maliyeti arttı. Roibase ekibinde time-to-review hedefi 2 saat. Bu hedefi tutturmak için 3 kural var: (1) Slack'te PR bildirimi otomatik, channel'da pin'leniyor; (2) Her developer günde 2 kez "review window" açıyor (öğleden önce 11:00, öğleden sonra 16:00); (3) PR boyutu 400 satırı geçemez — geçerse otomatik olarak "too large" etiketi ile geri dönüyor.

Bu sistemi kurarken en büyük direnç "ben o saatte başka işle meşgulüm" tepkisi. Haklı. Çözüm: review window'u takvimde bloklarsan, o 30 dakika senin "review zamanın" oluyor, başka iş orada planlanmıyor. Developer experience açısından da kazançlı: PR sahibi öngörülebilir bir timeline içinde feedback alıyor, yarım gün "acaba biri bakacak mı" endişesi ile beklemek yerine yeni PR'a geçebiliyor.

Örnek senaryo: Frontend developer yeni bir checkout flow bileşeni yazdı, PR'ı 10:30'da açtı. 11:00 review window'unda backend lead baktı, API entegrasyonunda eksik error handling olduğunu işaretledi. 11:20'de PR sahibi fix'i yaptı, 16:00 review window'unda ikinci bakış yapıldı, merge edildi. Toplam süre: 5.5 saat, ama aslında 2 review window (1 saat) + 2 fix window (20 dakika). Geri kalanı paralel iş zamanı — bağlam anahtarlama yok.

## Comment Density: Kaliteyi Ölçülebilir Kılmak

Comment density, bir PR'daki toplam yorum sayısının değiştirilen satır sayısına oranı. İdeal aralık: her 50 satır için 1-2 yorum. 50 satırda 6 yorum varsa ya kod gerçekten kötü, ya da reviewer nitpicking yapıyor. 200 satırda 0 yorum varsa ya kod mükemmel (olası değil), ya da reviewer bakmadı.

Roibase ekibinde comment density 0.02-0.04 aralığında tutuluyor (50 satırda 1-2 yorum). Bu metrik haftalık sprint retrospective'de takip ediliyor. Eğer bir developer'ın comment density'si sürekli 0.06'nın üstündeyse iki olasılık var: (1) PR'lar kalitesiz geliyor, o zaman pre-commit hook'ları güçlendirilmeli; (2) Reviewer gereksiz detaya giriyor, o zaman review guide'da "actionable" tanımı hatırlatılmalı.

Actionable yorum kriteri: Yorumda "neden" ve "nasıl düzeltilir" olmalı. "Bu kötü olmuş" actionable değil, "Bu fonksiyon O(n²) — line 47'deki loop'u Map'e çevir, O(n) olsun" actionable. Roibase'in GitHub Actions workflow'u her PR'a otomatik comment density raporu ekliyor. 0.06'yı aşarsa "High comment density detected — consider splitting PR or clarifying review focus" uyarısı düşüyor.

Örnek: 250 satırlık bir PR'da 12 yorum var (density: 0.048). Rapor "within range but trending high" diyor. Sprint retro'da bakılınca 12 yorumun 5'i "naming convention" ile ilgili — eslint rule'u eksikmiş. Sonraki sprint'te bu rule devreye girdi, density 0.03'e düştü.

## PR Size: Küçük PR, Hızlı Merge

PR boyutu, review sürecinin en önemli değişkeni. 400 satırı geçen bir PR'ı doğru review etmek imkânsız. Reviewer ya "kabaca baktım, ok" diyor ya da 2 saat ayırıp her satırı okumaya çalışıyor — ikisi de verimsiz. Roibase kuralı: PR boyutu 400 satırı (diff line sayısı, boş satır ve yorum dahil) aşamaz. Eğer feature daha büyükse feature branch'de küçük PR'lara bölünüyor, her biri ayrı merge ediliyor.

Bu kural iki şeyi zorluyor: (1) Developer önceden task'ı parçalamayı düşünmeli — "checkout flow" yerine "checkout validation logic" + "checkout UI components" + "checkout API integration" gibi; (2) Feature branch stratejisi gerekli — main branch'e her PR direkt gitmeyecek, staging/feature branch üstünden merge zinciri oluşuyor.

Örnek: Yeni bir ödeme gateway entegrasyonu var. Developer baştan 3 PR planladı: (1) Gateway API client (250 satır), (2) Internal transaction service katmanı (300 satır), (3) Frontend checkout widget (200 satır). Her PR ayrı ayrı review edildi, toplam merge süresi 18 saat. Eğer tek PR'da gönderilseydi 750 satır olacaktı — review süresi muhtemelen 48 saat+, üstüne çatışma riski yüksek.

PR boyutu eşiği otomatik kontrol ediliyor. GitHub Actions workflow'u her PR'da `git diff --stat` çıktısını parse ediyor, 400 satır üstünde "pr-too-large" etiketi ekliyor ve merge'i engelliyor. Developer'a "Split this PR into smaller units" mesajı düşüyor.

## Kişisel Çatışmayı Kuralla Kapatmak

Code review'da en büyük kültürel sorun, "kişisel eleştiri" algısı. Developer PR'ını "benim yazdığım kod" olarak görünce review yorumunu "bana saldırı" olarak okuyabiliyor. Bu psikolojiyi kırmak için review kurallarını kişiselleştirmeye kapatmak gerekiyor. Roibase'de 3 yöntem uygulanıyor: (1) Review yorumu her zaman kod satırı üstünde — genel yorum yasak; (2) Yorum kategorisi etiketlenmeli: `[blocker]`, `[nit]`, `[question]`; (3) Reviewer kim olursa olsun aynı checklist'i kullanıyor — kişisel "bana göre" tercihi yok.

Blocker yorumu: Merge edilemez, düzeltilmesi zorunlu (örn. security açığı, performance regression, test coverage düşüşü). Nit yorumu: Merge edilebilir, ama düzeltilmesi tercih edilen (örn. naming convention, comment eksikliği). Question yorumu: Developer'a bağlam sorusu — neden böyle yapıldı, alternatif düşünüldü mü.

Bu sistemde "ben beğenmedim" ifadesi niteliksiz. Ya blocker nedeni var (sayısal: test coverage %80'in altı, response time 200ms'den yavaş), ya nit nedeni var (stil guide'a aykırı), ya da question — ama "bu yaklaşım yanlış" gibi subjektif yorum checklist'te yok.

Örnek: Bir developer API endpoint'te caching yapmış, reviewer `[question] Why memcache instead of Redis? Redis supports TTL per key.` diye sordu. Developer cevap verdi: "This endpoint has <10 req/sec, memcache sufficient. Redis would add infra cost." Reviewer `[nit] Add comment explaining cache choice for future ref` diye kapattı. Kişisel tartışma olmadı, bağlam netleşti.

## Async Review, Senkron Approval

Review süreci async, ama final approval senkron olmalı — yoksa "bu PR merge edildi mi edilmedi mi" belirsizliği oluyor. Roibase workflow'u: (1) İlk review async, yorumlar GitHub'da; (2) Developer fix'leri yapıp "ready for re-review" etiketi ekliyor; (3) Re-review 2 saat içinde, bu sefer approval veya blocker comment; (4) Approval'dan sonra 15 dakika içinde merge — gecikirse bağlam kaybolur.

Bu akışta sync noktası tek: approval sonrası merge. Roibase ekibinde approval'ı CI/CD pipeline tetikliyor — Slack'te "PR #123 merged, deployment started" bildirimi düşüyor, ekip aynı anda görüyor. Developer o sırada başka işle meşgulse bile deployment'ı takip edebiliyor, rollback gerekirse hızlı müdahale ediliyor.

Deployment sonrası 24 saat "author on-call" kuralı var. PR sahibi, merge sonrası ilk 24 saatte production issue'su olursa ilk müdahale ediyor — bu da developer'ı "merge edip unutma" mantığından çıkarıyor, kod kalitesine daha dikkatli yaklaşmasını sağlıyor.

## Roibase'de Review Metriklerinin İzlenmesi

Roibase'in 8 yıllık operasyonunda review disiplini [markalaşma & brand identity](https://www.roibase.com.tr/tr/branding) kadar önemli hale geldi — ekip içi iletişim kalitesi dışarıya da yansıyor. Her sprint sonunda 4 metrik takip ediliyor: (1) Ortalama time-to-review (hedef: <2 saat); (2) Ortalama comment density (hedef: 0.02-0.04); (3) PR boyutu dağılımı (hedef: %90'ı <400 satır); (4) Merge-to-deploy süresi (hedef: <30 dakika). Bu rakamlar Notion dashboard'unda görünür, retrospective'de tartışılır.

Metrikler "şaming" için değil, sistem tasarımını optimize etmek için kullanılıyor. Örneğin time-to-review 3 saate çıkmışsa soru: "Review window'lar yeterli mi, yoksa PR bildirimi Slack'te gözden mi kaçıyor?" Comment density yükselmişse soru: "Linter rule'ları eksik mi, yoksa reviewer guide güncel değil mi?"

Bu yaklaşımda developer'a "senin kodun kötü" denmiyor, sisteme "otomasyonu nerede eksik" diye bakılıyor. Sonuç: developer experience iyileşiyor, çatışma olmuyor, merge hızı düşmüyor.

---

Code review kültürü, kurallarını sayısallaştırdığın anda kişisel çatışma alanından çıkar. Time-to-review, comment density, PR size eşikleri operasyonel disipline dönüşür. Ekip büyüdükçe "senior'ın kişisel tercihi" değil, "sistemin ölçülebilir kriteri" konuşulur. Roibase'in 8 yıllık deneyimi gösteriyor ki: async workflow ölçeklenebilir ancak metrik takibi varsa. Yoksa "kültür" lafta kalır, ekip 12 kişiyi geçtiğinde review süreci kaosa döner.