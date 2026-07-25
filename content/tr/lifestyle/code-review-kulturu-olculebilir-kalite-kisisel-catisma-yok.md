---
title: "Code Review Kültürü: Ölçülebilir Kalite, Kişisel Çatışma Yok"
description: "Time-to-review, comment density, PR size kuralları ile code review'u duygusal tartışmadan çıkarıp sistematik kalite kontrol sürecine dönüştürmek"
publishedAt: 2026-07-25
modifiedAt: 2026-07-25
category: lifestyle
i18nKey: lifestyle-003-2026-07
tags: [code-review, engineering-culture, pr-metrics, team-workflow, developer-experience]
readingTime: 8
author: Roibase
---

Code review'da "bence daha iyi olur" tartışması yerine sayısal kriter koymak, ekip içi sürtüşmeyi bitirmenin ilk adımı. Review süresi 4 saatten uzun sürdüğünde PR bloğa girer, 300 satırdan büyük PR'lar 72% daha az dikkatle okunur, comment density 5/100 satırdan yüksekse ya kod gerçekten sorunlu ya da review standartları net değil. Roibase'de 8 yıldır butik ekiplerle çalışırken gördük ki, code review'u kişisel beceri tartışmasından çıkarıp operasyonel metriğe bağlayınca hem kalite çıkıyor hem de founder/tech lead zamanı kurtulmuş oluyor.

## Time-to-Review: 4 Saat Eşiği

Bir PR açıldıktan sonra ilk yorumun gelme süresi (time-to-first-review) ekip hızının öncü göstergesi. GitHub'ın 2024 Engineering Productivity raporuna göre 4 saati geçen ilk review gecikmeleri, PR'ın merge edilme süresini ortalama 2.3 katına çıkarıyor. Sebep basit: geç gelen yorum context switch'i tetikliyor, PR sahibi başka iş açmış oluyor, geri dönüş yine gecikiyor, döngü uzuyor.

Roibase'in kendi workflow'unda kuralımız net: PR açıldıktan sonra 4 saat içinde en az bir ekip üyesi bakmalı. "Bakmak" demek mutlaka approve/reject değil — "ilk geçiş yapılmış, büyük blocker var mı" kontrolü. Bu ilk temas bağlam kopmasını önlüyor. Slack'te PR bildirimini görmezden gelmek ya da "sonra bakarım" alışkanlığı, 4 saat eşiğini geçtiğinde asıl maliyet oluşturuyor.

Bu kuralı zorunlu tutmak için Linear'da automation kurduk: PR 4 saat içinde `reviewed` etiketini almazsa otomatik Slack reminder. Bu uyarı 3 kez tetiklendiyse (yani sürekli geciken reviewer varsa) sprint retrospective'de metrik olarak çıkıyor. Burada kişisel suçlama değil, iş yükü dağılımı tartışması başlıyor. Bazı dönemlerde bir kişiye çok PR düşmüş olabilir, o zaman reviewer rotasyonunu değiştiriyoruz. Yani time-to-review sayısallaştırınca sorunu kişiden ayırıp sistem hatasına bağlayabiliyorsun.

Ek bir yan kural: Eğer PR "draft" olarak açıldıysa 4 saat kuralı işlemiyor. Draft PR demek "henüz context tam değil, ön bakış yapabilirsiniz" anlamında. Bu durumda PR sahibi hazır olduğunda "ready for review" işaretliyor, oradan itibaren 4 saat başlıyor. Bu küçük detay, erken feedback almayı teşvik ediyor ama aciliyet baskısı yaratmıyor.

## Comment Density ve PR Boyutu: 300 Satır Üst Sınır

Bir PR'da 100 satır değişiklik başına kaç yorum düşüyor? Bu oran (comment density) hem code kalitesinin hem de review standartının göstergesi. Çok düşük oran (örn. 1/100) ya review detaylı yapılmamış ya da kod gerçekten mükemmel yazılmış anlamına gelir — ikinci durum nadir. Çok yüksek oran (10/100'den fazla) ise ya kodun yapısal sorunu var ya da ekip arasında stil anlaşmazlığı çözülmemiş.

Roibase'de hedef 3-5 yorum / 100 satır. Bu aralık deneysel: 200 satırlık bir PR'da 6-10 yorum bekliyoruz. Yorumların türü de önemli — "bu isimlendirme daha iyi olabilir" gibi subjektif öneriler değil, "bu function 3 kez çağrılıyor, util'e taşıyalım" gibi refactor önerileri ya da "bu edge case'de null dönüyor, test ekle" gibi hata yakalama yorumları. Subjektif stil yorumlarını azaltmak için ESLint + Prettier otomasyonu kurduk, bu sayede comment density teknik konulara odaklanmış oluyor.

PR boyutu kuralı kritik: **300 satır üst sınır** (test dosyaları hariç). 300'den büyük PR'lar otomatik `too-large` etiketi alıyor ve "split required" uyarısı düşüyor. Neden 300? Google'ın Code Review Best Practices dokümanına göre 200-400 satır arası reviewerın dikkatini dağıtmadan tek seferde okuyabileceği maksimum miktar. 500 satırdan sonra yorumların %60'ı sadece ilk 200 satırda toplanıyor, gerisi geçiştiriliyor.

Bu kuralı sertleştirdikten sonra (yaklaşık 18 ay önce) PR merge süremiz ortalama 36 saatten 22 saate düştü. Sebep: Küçük PR'lar hem daha hızlı review ediliyor hem de conflict riski azalıyor. Büyük refactor'lar için incremental PR stratejisi kullanıyoruz: ilk PR altyapı değişikliği, ikinci PR business logic, üçüncü PR UI update gibi. Her biri 250 satır civarı oluyor, toplam 3 PR ama merge hızı çok daha yüksek.

## Async Review Döngüsü ve Notification Disiplini

Code review'u senkron yapmaya çalışmak (yani PR sahibi ile reviewerın aynı anda online olmasını beklemek) modern ekiplerde imkansız. Async-first workflow zorunlu, ama async'in kendi disiplini var: notification yönetimi ve response-time beklentisi.

Roibase'de PR notification'ları sadece Slack'te flow ediyor, email'e düşmüyor (dikkat dağılması önlemi). Slack'te özel bir `#pr-queue` kanalı var, GitHub webhook'u her yeni PR'ı ve her yorum değişikliğini oraya atıyor. Bu kanalda thread kullanımı zorunlu — PR altındaki tartışmalar GitHub'da, Slack'teki thread sadece "bu PR'a bakabilir misin @mention" türü koordinasyon için.

Async döngüde beklenti şöyle tanımlı:
- **İlk review:** 4 saat (yukarıda anlattık)
- **Author response:** Yorumlara cevap vermek için 6 saat (eğer yorumlar blocker değilse)
- **Re-review:** Değişiklikler sonrası ikinci bakış için 4 saat
- **Approve/merge:** Son onay için 2 saat

Bu beklentiler Linear'da "PR lifecycle" board'unda görsel olarak takip ediliyor. Her PR bir card, kolonlar "Waiting First Review", "Author Updating", "Waiting Re-Review", "Approved", "Merged". Eğer bir PR 24 saatten uzun "Waiting" kolonunda kalıyorsa otomatik escalation — sprint lead'e bildirim gidiyor.

Notification disiplini derken kastettiğimiz şu: Review sırasında yorum yazarken topluca commit ediyoruz, her satıra ayrı yorum atmıyoruz (yoksa PR sahibine 15 bildirim gidiyor, dikkat dağılıyor). GitHub'ın "Start a review" özelliğini kullanıyoruz, tüm yorumları toplayıp tek seferde "Submit review" yapıyoruz. Bu küçük alışkanlık notification gürültüsünü %70 azalttı.

Bir diğer kural: Eğer yorum thread'i 3 turdan fazla gidip geliyorsa (yani author cevap verdi, reviewer tekrar yorum yaptı, author yine cevap verdi), o noktada 15 dakikalık senkron call zorunlu. Çünkü 3 turdan sonra async tartışma verimli olmuyor, bağlam kayıpları oluşuyor. Bu kuralı koyduktan sonra uzun thread tartışmaları %40 azaldı — ekip bildi ki 3. turda zaten call'a geçeceğiz, o yüzden ilk yorumları daha net yazmaya başladılar.

## Otomatik Check'ler ve Manual Review Dengesi

Code review'da otomasyon ile insan kararının dengesini kurmak kritik. CI/CD pipeline'ında 8 otomatik check çalışıyor: lint, format, unit test, integration test, security scan, bundle size, lighthouse performance, accessibility audit. Bu check'ler pass etmeden PR merge edilemiyor (branch protection rule).

Otomasyonun amacı, "bu kod style guide'a uygun mu, test coverage %80'in üstünde mi" gibi mekanik soruları insan reviewer'dan çıkarmak. Manuel reviewerın odaklanması gereken sorular: mimari karar doğru mu, bu değişiklik başka modülleri etkiler mi, edge case'ler düşünülmüş mü, isimlendirme domain'i yansıtıyor mu, bu kod 6 ay sonra başkası okuyunca anlaşılır mı?

Burada bir tradeoff var: Çok fazla otomasyon eklerseniz (örn. "her function 10 satırdan uzun olamaz" gibi katı kural) yaratıcı çözümleri kısıtlarsınız. Çok az otomasyon olursa reviewer mekanik işlere boğulur. Bizim dengemiz: **Objektif ölçülebilir kriterler otomasyon, subjektif/contextual kararlar insan**. Örneğin "bu değişken adı daha iyi olur mu" otomasyona uygun değil, ama "bu değişken hiç kullanılmamış" otomasyona uygun (ESLint no-unused-vars).

Otomasyon fail ettiğinde PR merge edilemiyor, ama eğer otomasyonun hata yaptığını düşünüyorsanız (false positive) override mekanizması var: İki senior developer approve ederse otomasyon bypass edilebiliyor. Bu durumun her örneği sprint retrospective'de tartışılıyor — eğer sık oluyorsa otomasyon kuralını revise ediyoruz.

## Kişisel Çatışmadan Kaçınma: Ownership ve Blameless Culture

Code review'da en büyük risk, yorumun kişisel eleştiri gibi algılanması. "Bu kod kötü yazılmış" yerine "Bu function 3 farklı sorumluluk taşıyor, single responsibility principle'a aykırı" demek, konuyu teknik seviyede tutuyor. Ama sadece dil değiştirmek yetmiyor, ekip kültürü ve ownership modeli de buna destek vermeli.

Roibase'de [markalaşma ve ekip kimliği](https://www.roibase.com.tr/tr/branding) konusunda çalışırken öğrendiğimiz şey şu: Blameless culture sadece "kimseyi suçlamayalım" demek değil, hataları sistem problemi olarak ele almak demek. Code review'da da aynı mantık: Eğer bir bug merge edilmişse "kim approve etti" sorusu değil "neden test coverage bunu yakalamadı, hangi senaryoyu gözden kaçırdık" sorusu öncelikli.

Ownership kuralımız şu: Her PR'ın bir "owner"ı var (açan kişi), ama reviewerlar da o kodun kalitesinden eşit sorumlu. Yani approve eden kişi, o kodun production'da çalışmasını guarantee ediyor. Bu yüzden review yaparken "hızlıca approve edeyim geçsin" kültürü yok — her reviewer bilir ki approve sonrası production'da sorun çıkarsa kendisi de o incident'ın sahibi sayılacak.

Bunu desteklemek için Linear'da "PR owner" ve "PR reviewers" alan var, incident açıldığında otomatik olarak her ikisi de mention ediliyor. Bu sayede sorumluluk paylaşımı somutlaşıyor. Ek olarak, her sprint sonunda "merged PR'ların bug rate"ini ölçüyoruz (1 sprint içinde merge edilen PR'lardan kaçı bug'a yol açtı). Bu metrik ekip ortalamasını gösteriyor, bireysel performans metriği değil — yani "şu kişi çok bug üretiyor" raporu çıkmıyor, "bu sprintte test coverage düşüktü" analizi çıkıyor.

## Kapatırken: Metrik Takibi ve Iterasyon

Code review kültürünü ölçülebilir hale getirmenin özü, subjektif tartışmaları sayısal kriterlere bağlamak. Yukarıda anlattığımız time-to-review, comment density, PR size kuralları sadece başlangıç — her ekip kendi contextine göre bu metrikleri ayarlayacak. Bizim için 300 satır ve 4 saat kuralı çalışıyor çünkü 12 kişilik ekibiz ve çoğu PR full-stack değişiklik içeriyor. Eğer çok büyük bir ekipte frontend/backend ayrımı keskinse farklı eşikler gerekebilir.

Kritik nokta: Bu metrikleri takip etmek için tooling yatırımı yapmalısınız. Linear + GitHub + Slack entegrasyonu, otomatik reminder'lar, dashboard'da PR lifecycle görünürlüğü olmadan bu kuralları enforce etmek çok zor. Tooling olmadan ekip manuel takip yapmaya çalışır, 2 hafta sonra bırakır. Yatırım diyorum çünkü bu automation'ları kurmak 2 hafta developer zamanı aldı, ama geri dönüşü 6 ayda kendini gösterdi — PR merge süresi %40 düştü, post-merge bug rate %25 azaldı.

Son bir not: Bu sistemin işlemesi için founder/tech lead'in kendisi de kurallara uyması şart. Eğer liderlik PR'larını "acil" diyerek kuralları bypass ederse, ekip de taklit eder. Bizim kuralımız: CEO açtığı PR bile 4 saat bekliyor, 300 satır sınırına uyuyor. Bu disiplin olmadan hiçbir metrik tutmaz.