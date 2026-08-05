---
title: "Code Review Kültürü: Ölçülebilir Kalite, Kişisel Çatışma Yok"
description: "Time-to-review, comment density, PR size — code review'u subjektif tartışmadan çıkarıp sistemik tasarım haline getirmek için metrik tabanlı yaklaşım."
publishedAt: 2026-08-05
modifiedAt: 2026-08-05
category: lifestyle
i18nKey: lifestyle-003-2026-08
tags: [code-review, engineering-culture, pr-metrics, async-workflow, team-velocity]
readingTime: 8
author: Roibase
---

Code review'da en büyük zaman kaybı subjektif tartışmalardan gelir. "Bu comment gereksiz miydi?", "Review çok sert miydi?", "Merge'ü neden geciktirdi?" — bu sorular ekip içinde güven erozyonu yaratır. Roibase'de 8 yıllık ekip liderliği deneyiminde gördük: Code review kültürü ölçülebilir kriterlere bağlanmadığında kişisel çatışmaya, bağlandığında sistemik iyileşmeye dönüşür. Time-to-review, comment density, PR size — bu metrikler review sürecini objektif, tekrarlanabilir ve ekip sağlığına katkı yapan bir disipline çevirir.

## Time-to-Review: Async Workflow'un Kemik Yapısı

İlk review comment'inin PR açıldıktan sonraki kaç saat içinde geldiği async ekibin enerji seviyesini gösterir. Roibase'de hedef: **4 saat**. Bu süre GitHub notification'ın okunması, PR context'inin anlaşılması ve ilk turda en kritik feedback'in verilmesi için realist bir pencere. 4 saati aşarsan blocker ihtimali artar — PR sahibi başka işe geçer, bağlamı kaybeder, merge çakışma riski yükselir.

Time-to-review'u ekip dashboard'unda haftalık ortalama olarak göstermek disiplini görünür kılar. Ortalama 6 saatin üzerindeyse sorun async coordination'da değil, dikkat ekonomisinde. Ekip üyelerinin Slack/Linear/Figma notification yükü fazlaysa PR'ler gözden kaçar. Bu durumda çözüm "daha hızlı ol" değil, notification sistemini yeniden yapılandırmak. Örneğin GitHub PR'leri için dedicated Slack channel + custom bot: Her PR açıldığında tag'le, 3 saatte review yoksa reminder at.

Time-to-review'u düşük tutmak için reviewer count'ı da optimize edilmeli. 1 PR = 2 reviewer kuralı iyi çalışır. 3+ reviewer approval beklemek her review turunu 2x'e katlar, merge sürecini 12+ saate çıkarır. Kritik modüller için (örn. payment logic) 3. reviewer seniorityye göre devreye girebilir ama default değil.

## Comment Density: Kalite İşareti, Miktar Değil

Comment density metriği: **PR satırı başına ortalama comment sayısı**. Roibase'de sağlıklı bant: 200 satırlık PR'de 3-6 comment. 10+ comment varsa ya PR çok büyük ya da tasarım review'dan önce yeterince konuşulmamış. 0-1 comment varsa ya kod mükemmel (nadir) ya da reviewer dikkatsiz (daha olası).

Comment density'yi optimize etmek için review'dan ÖNCE tasarım dokümanı (tech spec) şart. Roibase workflow'u: Yeni feature → Linear issue → notion tech spec → approval → coding → PR. Tech spec'te mimari karar, tradeoff, test stratejisi tartışılır. PR review'u implementation detayına odaklanır. Böylece "neden bu approach?" sorusu PR comment'inde değil, spec review'ünde sorulur — async coordination verimliliği 2x artar.

Comment density'nin düşük olduğu ekiplerde self-review disiplini önemli. PR açmadan önce checklist:
- Lint pass etti mi?
- Test coverage %80+ mi?
- Breaking change varsa migration plan var mı?
- Performans regresyon riski olan satır var mı?

Bu checklist'i GitHub PR template'ine koymak comment yükünü azaltır. Reviewer mekanik hatayla değil, business logic ile ilgilenir.

## PR Size: 200 Satır Eşiği ve Merge Velocity

PR size metriği: **değişen satır sayısı**. Roibase kuralı: Ideal PR = 100-200 satır, maksimum = 400 satır. 400+ satırlık PR'lerde merge süresi üssel artar — reviewer cognitive load'u aşar, dikkat dağılır, bug detection accuracy düşer. 1000+ satırlık PR ise rubber-stamp review'e dönüşür — "approve'layıp geçeyim" refleksi gelir.

PR size'ı düşürmek için feature flagging stratejisi şart. Büyük feature'ı tek PR'de atmak yerine: 1) infrastructure PR (API yolu, DB schema migration), 2) backend logic PR (feature flag arkasında), 3) frontend integration PR, 4) feature flag açma PR. Her PR 150-250 satır, review süresi 2-3 saat, merge velocity 4x hızlanır. Linear'da feature task'ını sub-task'lara bölerken her sub-task = 1 PR mantığıyla planlamak bu disiplini otomatikleştirir.

PR size kuralının istisnası: refactor PR'leri. 500 satırlık rename operation'ı 1 PR'de gitmeli — böl-böl-böl yaklaşımı burada merge conflict yaratır. Ancak refactor PR title'ında `[REFACTOR]` prefix zorunlu, reviewer "logic change var mı?" sorusunu açıkça bilsin.

### PR Size ve CI/CD Süresi

PR size'ın dolaylı etkisi: CI/CD pipeline süresi. 100 satırlık PR'de test suite 3 dakika, 500 satırlık PR'de 12 dakika. Roibase'de merge-ready PR için CI süresi 5 dakika eşiği var. Aşarsa bottleneck signal. Bu durumda ya test parallelization optimize edilir ya da PR daha küçük parçalara bölünür.

## Review Rejection Rate: Sistemik Sorun Göstergesi

Review rejection rate: **merge olmadan close edilen PR yüzdesi**. Sağlıklı bant: %5-10. %20+ rejection rate varsa tasarım alignment sorunu var — develop başlamadan önce tech spec review yetersiz. %0-2 rejection rate ise rubber-stamp işareti — kimse risk almıyor, herkes approve'luyor.

Rejection reason'ları tag'lemek sistemi debug'lanabilir kılar. GitHub PR close comment'inde kategori: `[DESIGN_CHANGE]`, `[SCOPE_CREEP]`, `[DUPLICATE]`, `[SECURITY_RISK]`. Monthly retro'da rejection pattern'leri analiz edilir. Örneğin `[DESIGN_CHANGE]` %60 ise tech spec template'i revize edilir — "performance impact" bölümü eklenebilir.

Rejection metriğini dashboard'a koymak review culture'ı psychological safety'ye bağlar. Ekip rejection'ı başarısızlık değil, erken course-correction olarak görmeye başlar. Roibase [branding](https://www.roibase.com.tr/tr/branding) çalışmalarında da benzer ilke var: Early feedback döngüsü final revizyon maliyetini %70 düşürür.

## Otomatik Review Tooling: Comment Gürültüsünü Azaltmak

Code review'da manuel comment'lerin %40'ı mekanik: "import sıralaması yanlış", "unused variable var", "function 50 satır olmuş". Bu comment'ler GitHub Actions ile otomatikleştirilmeli. Roibase stack'i:
- ESLint + Prettier: Format ve stil kuralları
- SonarQube: Code smell detection, complexity scoring
- Danger.js: PR description boş mu, test coverage düştü mü?
- Custom script: PR size 400+ ise warning comment

Tooling'i CI pipeline'a entegre etmek reviewer'ın dikkatini business logic'e yönlendirir. Manuel review comment density %30 düşer, ortalama review süresi 6 saatten 4 saate iner.

Otomatik tooling'in tuzağı: False positive oranı. %10+ false positive varsa reviewer tool'a güveni kaybeder, warning'leri ignore'lamaya başlar. Roibase kuralı: Yeni tool devreye alınmadan 2 hafta silent mode — comment atmaz, sadece log'lar. Log'lar review edilir, threshold'lar tune edilir, false positive %5'in altına düşünce production'a alınır.

## Async Review Protocol: Notification Disiplini

Async ekiplerde review blocker'ın ana sebebi: Notification zamanlaması. PR sahibi review beklerken reviewer farklı time zone'da uyuyordur. Roibase protokolü: Her PR'de `review-by` timestamp (Linear'dan çekilir). Bu timestamp'e 2 saat kala GitHub bot Slack'te mention atar. Reviewer o 2 saat içinde review yapmadıysa PR sahibi başka reviewer assign edebilir — bekleme blocker'ı kaldırılır.

Notification protocol'ün ikinci ayağı: Review turu kapandığında PR sahibine otomatik bildirim. "3 comment resolved, 1 thread open" — PR sahibi hangisine bakması gerektiğini anında bilir. Thread open ise re-review'u tetiklemez, resolved ise otomatik re-review request atar.

Async review'da en kritik kural: **Comment thread resolution yetkisi PR sahibinde**. Reviewer "bence bu değişmeli" der, PR sahibi değiştirir, thread'i resolve eder. Reviewer tekrar açamaz — tartışma uzarsa senkron toplantı (15 dakika, Linear call) ile çözülür. Bu kural subjektif "son sözü kim söyler?" döngüsünü kırar.

## Metrik Dashboard ve Retrospektif Döngü

Tüm bu metrikler — time-to-review, comment density, PR size, rejection rate — haftalık dashboard'a konmalı. Roibase'de Grafana + GitHub API entegrasyonu kullanılıyor. Her sprint retro'da bu metrikler konuşulur: "Geçen sprint time-to-review 5.2 saat, hedef 4 — bottleneck nerede?" Ekip tartışır, hipotez üretir (örn. "Linear notification spam'i dikkat dağıtıyor"), bir sonraki sprint'te test eder.

Dashboard'u public yapmak (şirket içinde herkes görebilir) ekip dinamiğini pozitif etkiler. Metrik düşük olan ekip "gizlemek" yerine "nasıl iyileştirelim?" sorusunu sorar. Gamification tuzağından kaçınmak için metric'ler individual değil, team-level olmalı. "En hızlı reviewer kim?" leaderboard'u toxic competition yaratır, "takım ortalaması bu hafta 10% düştü" analizi ise kolektif responsibility yaratır.

---

Code review kültürü kişisel tercihe değil, sistemik tasarıma dayanmalı. Time-to-review, comment density, PR size — bu metrikler review sürecini objektif, tekrarlanabilir ve ekip sağlığına katkı yapan bir disipline çevirir. Roibase'de 8 yıldır bu yaklaşım merge velocity'yi korurken bug escape rate'ini düşük tutuyor. Async workflow'un backbone'u burada: Review blocker'ı kaldır, dikkat ekonomisini optimize et, subjektif tartışmayı ölçülebilir kritere dönüştür. Şimdi kendi ekibinizde hangi metriği ilk dashboard'a ekleyeceğinize karar verin — veri toplamadan kültür değişimi başlamaz.