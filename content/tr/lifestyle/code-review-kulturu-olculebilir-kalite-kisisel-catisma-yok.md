---
title: "Code Review Kültürü: Ölçülebilir Kalite, Kişisel Çatışma Yok"
description: "Time-to-review, comment density, PR size metrikleriyle code review'ü kişisel değerlendirmeden çıkarıp sistem disiplinine dönüştürmek."
publishedAt: 2026-07-01
modifiedAt: 2026-07-01
category: lifestyle
i18nKey: lifestyle-003-2026-07
tags: [code-review, engineering-culture, pr-metrics, async-workflow, team-discipline]
readingTime: 7
author: Roibase
---

Code review'ü "senior developer'ın yorumunu bekleme" ritüeline indirgeyen ekipler kalite kontrolü yapamıyor, sadece zaman kaybediyor. Review süreci ölçülebilir değilse — time-to-review, comment density, PR size takip edilmiyorsa — süreç kişisel beğeniye dayalı bir darboğaz haline gelir. Roibase'de 8 yıldır uyguladığımız sistemde review metriği vardır, kişisel çatışma yoktur: 24 saat içinde approval veya açık soru, 300 satır üstü PR reddedilir, yorum yoğunluğu sprint retrospective'de takip edilir.

## Review Kültürünün Ölçülebilir Temelleri

Code review'ü "senior baksın onaylasın" tutumundan kurtarmanın yolu, süreci ölçülebilir kriterlere bağlamaktır. Time-to-review metriği — PR açıldığı andan ilk yorum veya approval gelene kadar geçen süre — ekip disiplininin en net göstergesidir. Roibase'de bu süre 24 saat ile sınırlıdır: PR açıldı, 24 saat içinde ya review tamamlandı ya da "şu 3 noktayı açıklayabilir misin" sorusu geldi. 48 saat sessizlik kabul edilemez — bu async workflow'un temel kuralıdır.

Comment density — yorum sayısı / değiştirilen satır oranı — review derinliğini gösterir. Çok düşükse (0.01 altı) superficial bakılıyor demektir, çok yüksekse (0.15 üstü) PR muhtemelen çok karmaşık ya da scope'u kötü planlanmış. İdeal oran 0.03-0.08 arasıdır: 300 satırlık PR'da 9-24 yorum. Bu oran sprint sonunda takip edilir, "bu sprint review yoğunluğu düştü" tespiti yapılabilir.

PR size kuralı net: 300 satır üstü değişiklik tek PR'a sığdırılmaz. İstisna: dependency upgrade veya auto-generated migration. Bu kural zorla uygulanır — 350 satırlık PR açılırsa otomatik bot yorumu düşer: "PR size limit aşıldı, split et." Büyük feature 3 PR'a bölünür: backend API + frontend integration + UI polish. Her PR kendi başına review edilebilir, merge edilebilir olmalı — monolithic diff'e hiçbir review sürecinde yer yok.

## Async Review Workflow: Senkron Toplantı Gerektirmez

Senkron review meeting'i — "hadi şimdi 30 dakika PR'a bakalım" — time-boxing yanılgısıdır. Review async yapılır: reviewer kendi deep work bloğunda PR'ı inceler, inline comment bırakır, thread açar. Author da kendi bloğunda yanıtlar. Real-time Slack ping'i yasaktır — "PR'a bakabilir misin hemen" mesajı kabul edilemez.

Review request GitHub'da tag ile yapılır: `/cc @reviewer` veya otomatik CODEOWNERS dosyası ile. Reviewer 24 saat içinde ya approve eder ya da soru sorar. Soru gelirse author 12 saat içinde yanıtlar veya ek commit atar. İkinci tur review 12 saat içinde tamamlanır. Toplam süreç 48 saati geçmez — bu cycle time hedefidir.

Inline comment thread'leri resolve edilir veya "later" tag'iyle issue'ya taşınır. "Sonra konuşuruz" belirsizliği kabul edilemez — ya hemen çözülür ya da issue olarak backlog'a alınır, PR merge edilir. Review blocker'ı net olmalı: security bug, API contract breaking, performance regression. Code style tartışması blocker değildir — linter zaten var, tercihe bağlı detaylar resolve without change ile kapatılabilir.

### Review Bot: Otomatik Kontrol, Manuel Yoğunlaşma

CI pipeline'ında otomatik checkler review yükünü düşürür: linter (ESLint, Prettier), test coverage diff (yeni kod için %80 altı kabul edilemez), bundle size diff (+50KB üstü alarm), security scan (npm audit). Bu checkler pass olmazsa review request bile gönderilemez — kırmızı cross yeşile dönmeden PR draft'tan çıkmaz.

Review blocker otomasyonu: regex ile "TODO" veya "FIXME" commit message'ında geçiyorsa PR reject edilir. API endpoint değişikliği varsa (`@app.route` decorator'unda değişiklik) API dokümantasyon güncellemesi aynı PR'da olmalı — yoksa bot blocker koyar. Bu kurallar manuel review'ü semantik derinliğe odaklar: business logic doğru mu, edge case handling yeterli mi, test senaryosu eksik mi.

## Comment Kategorileri: Nit, Question, Blocker

Her review comment kategorize edilir — reviewer yazarken tag ekler. **[nit]**: tercih meselesi, merge blocker değil ("bu değişken ismi daha açıklayıcı olabilir"). **[question]**: anlayamadım, açıkla ("bu regex pattern'in edge case'i ne?"). **[blocker]**: merge edilemez, düzeltilmeli ("bu null check eksik, production'da crash atar").

Nit yorumlar resolve without change ile kapatılabilir — author "kabul, ama bu PR'da değiştirmeyeceğim, sonraki refactor'da alırım" der, reviewer approve eder. Question yorumlar thread'de yanıtlanır, yeterli açıklama gelirse resolve edilir. Blocker yorumlar mutlaka ek commit gerektirir — blocker unresolved iken PR merge butonuna basılamaz (GitHub branch protection rule ile zorlanır).

Comment density metriği bu kategorileri ayırır: blocker yoğunluğu %20 üstüyse PR scope'u kötü planlanmış demektir, nit yoğunluğu %60 üstüyse review superficial yapılıyor — önce lint config'i düzelt. İdeal dağılım: %15 blocker, %50 question, %35 nit. Sprint retrospective'de bu oranlar tartışılır: "Bu sprint blocker oranı arttı, PR planlama aşaması zayıflamış" tespiti yapılabilir.

## Review Metriklerinin Sprint Retrospective'deki Yeri

Her sprint sonunda review dashboard'u açılır: ortalama time-to-review, PR size dağılımı, comment density histogramı, en çok revise edilen dosyalar, review load dağılımı (kimde kaç PR birikiyor). Bu metrikler subjektif "code quality artıyor mu" tartışmasını somut veriye dönüştürür.

Time-to-review 36 saati geçtiyse — hedef 24 saat — neden analizi yapılır: reviewer load çok mu yüksek, PR'lar iş saati dışı mı açılıyor, context switching mi fazla. Load dengesizliği varsa (bir developer 12 PR review yapmış, diğeri 2) CODEOWNERS rotation'ı değişir. PR'lar iş saati dışı açılıyorsa async workflow sorunlu demektir — PR draft aşamasında takım sync eder, ready hale gelince açar.

Comment density düştüyse — önceki sprint 0.05 iken bu sprint 0.02 — review derinliği azalmış demektir. Bu genellikle yüksek velocity dönemlerinde olur: herkes feature yetiştirmeye odaklanmış, review shallow yapılmış. Retrospective'de "velocity artarken review kalitesi düşmemeli, PR size'ı küçültüp review cycle'ı hızlandırmalıyız" kararı alınır. Metrik olmadan bu tespit yapılamaz — herkes "iyi review yaptık" der, ama veri aksini söyler.

## Çatışma Yoktur, Sistem Vardır

Review'de kişisel çatışma çıkmasının nedeni sistemsizliktir: hangi durum blocker, hangi durum merge edilebilir, kim ne zaman review yapacak belirsizse yorumlar "bana göre yanlış" tartışmasına döner. Sistem netse çatışma olmaz: 24 saat kuralı ihlal edilirse author escalate eder (team lead'e ping atar), 300 satır aşılmışsa bot reject eder, blocker comment unresolved iken merge edilemez. Herkes aynı kuralları oynar, kişisel yorum kalmaz.

Review feedback'i kişiye değil, koda yapılır: "sen her zaman böyle yapıyorsun" yerine "bu dosyada null check pattern'i eksik, diğer handler'larda var". Retrospective'de de kişi adı geçmez: "developer X review yapmıyor" yerine "time-to-review metriği hedefin üstünde, load dağılımını değiştirelim". Metrik objektivite sağlar — herkes dashboard'daki sayıya bakar, tartışma çözülür.

Code review kültürü [markalaşma](/tr/branding) kadar ekip identity'sine bağlıdır: ekip "biz 24 saat içinde review yaparız, 300 satır üstü PR açmayız" dediğinde bu disiplin onboarding'den itibaren yerleşir. Yeni developer ilk PR'ında bu kuralları görür, kültüre uyum sağlar. Sistem subjektif liderliğe bağımlı değildir — lider değişse de metrikler devam eder.

Time-to-review 24 saat, PR size 300 satır, comment density 0.03-0.08 — bu sayılar takımınızda farklı olabilir. Önemli olan sayıların olması, ölçülmesi, sprint retrospective'de tartışılmasıdır. Code review kültürü senior developer'ın subjektif onayı değil, takımın disiplinli sistem tasarımıdır. Sistemsiz review yapıyorsanız kalite kontrolü yapmıyorsunuz, darboğaz yaratıyorsunuz. Şimdi yapılacak şey: son 10 PR'ınızın time-to-review ortalamasını ölçmek ve 48 saatin üstündeyse neden analizi başlatmaktır.