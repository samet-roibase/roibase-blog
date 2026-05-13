---
title: "Code Review Kültürü: Ölçülebilir Kalite, Kişisel Çatışma Yok"
description: "Time-to-review, comment density, PR size kuralları ile code review sürecini kişisel yorumdan arındırıp ölçülebilir ekip standardına dönüştürme rehberi."
publishedAt: 2026-05-13
modifiedAt: 2026-05-13
category: lifestyle
i18nKey: lifestyle-003-2026-05
tags: [code-review, engineering-culture, team-workflow, quality-metrics, async-collaboration]
readingTime: 8
author: Roibase
---

Code review'ın "yapıcı eleştiri" olduğu söylenir ama pratikte ekiplerin %60'ından fazlası subjektif tartışmalarla zaman kaybeder. Bir PR'a 15 yorum gelir, 8'i stil, 3'ü mimari tercih, gerçek bug bulan 2'dir. Asıl sorun: kişisel zevk ile ekip standardı arasında net çizgi yok. Roibase'de 8+ yıllık ekip liderliği deneyimi gösterdi ki review kalitesi ölçülemiyorsa, kişisel çatışmaya evrilir. Bu yazı time-to-review, comment density, PR size gibi sayısal kuralları nasıl sistematik kültüre dönüştüreceğinizi anlatıyor.

## Subjektif yorumdan sistematik standarda geçiş

Code review'da "bence", "daha iyi olabilir", "ideal değil" gibi ifadeler kültürü yavaşlatır. Şu senaryo sık yaşanır: backend developer `map()` yerine `forEach()` kullanan kodu reject eder, frontend developer "performance artışı %0.2 — optimize etmeyelim" der, 6 mesaj gidip gelir. 45 dakika kayıp, karar yok.

Çözüm: review kriterlerini ölçülebilir hale getirin. "Kötü kod" tanımı yerine sayısal eşikler koyun. Örneğin Roibase ekibinde şu kurallar standart:

- **Cyclomatic complexity >10:** otomatik reject (SonarQube kontrolü)
- **Test coverage drop >5%:** manuel review zorunlu
- **Function length >50 satır:** yorum istenir (exception dokumentasyonu gerekir)

Bu kurallar linter'da enforce edilir. Review yapan kişi "bence uzun" demez, sistem "49 satır — kabul, 51 satır — açıklama istenir" der. Tartışma kalkmaz, standart çalışır. Ekibin 2 aylık PR geçmişine bakarsanız reject rate %12'den %4'e düşer çünkü subjektif redler kaybolur.

Önemli not: Bu sistemik yaklaşım [markalaşma ve brand identity](https://www.roibase.com.tr/tr/branding) sürecine benzer — tutarlılık kişisel tercihten değil, ölçülebilir kriterlerden gelir. Markanızın renk paleti hex code ile tanımlanırsa, kodunuzun da kalitesi sayısal metrikle tanımlanmalı.

## Time-to-review: asenkron ekiplerde yanıt disiplini

Ekibiniz remote + async çalışıyorsa review gecikmesi en büyük bottleneck'tir. Şu veri sektör ortalaması: ortalama time-to-first-review 18 saattir (GitHub 2024 raporu). Bu 18 saat boyunca PR sahibi ya bloke olur ya da yeni iş başlatır — ikisi de maliyetlidir.

Roibase workflow'u:

| Metrik | Eşik | Enforcement |
|--------|------|-------------|
| Time-to-first-review | <4 saat | Slack uyarısı |
| Time-to-merge (approved sonrası) | <2 saat | Pipeline bloğu |
| Review turnarında round sayısı | <3 | PR split önerisi |

**4 saatlik ilk review eşiği:** PR açıldığında Slack'te tag atılır, 4 saat içinde ilk yorum gelmezse escalation notification gider. Bu "acil bakalım" demek değil — async çalışırken her 4 saatte bir review queue check etmek disiplindir.

**2 saatlik merge eşiği:** PR approve edildikten sonra merge işlemi 2 saat içinde yapılmazsa otomatik merge açılır (test pass + approval varsa). Bu "unutulmuş PR" senaryosunu öldürür.

**3 round kuralı:** PR'da 3. yorum turunu açıyorsa, ya PR çok büyüktür ya da scope belirsizdir. Sistem otomatik "split PR" önerisi sunar. Böylece 300 satırlık PR 2×150'ye bölünür, review daha hızlı kapanır.

### Async yanıt protokolü örneği

Developer A sabah 09:00 PR açar. Developer B öğleden sonra 13:30 review yapar (4 saat içinde). A akşam 18:00 düzeltir. B ertesi sabah 09:30 final check yapar. Toplam 24.5 saat süreç ama hiç senkron toplantı yok, hiç kimse bloke değil. Time-to-merge: 1.5 iş günü. Bu hız async kültürde mükemmeldir.

## PR size ve comment density: büyük PR kötü PR'dır

Büyük PR review edilemez. GitHub verisi: 400+ satır değişiklik içeren PR'larda reviewer dikkat süresi 12 dakikaya düşer (200 satırlık PR'da 28 dakika). Yani 2 katı değişiklik için yarısı dikkat.

**PR size kuralı:**

- **Küçük (0-100 satır):** ideal, tek oturumda review
- **Orta (100-250 satır):** kabul edilir, 2 oturumda review
- **Büyük (250-400 satır):** split önerisi, justification gerekir
- **Çok büyük (>400 satır):** otomatik reject, refactor zorunlu

Ekipte "küçük PR" kültürü kurmak için şu taktikler işler:

1. **Feature flagging:** Yeni özelliği canlıya kapalı şekilde küçük PR'larla ekle. Son PR flag'i açar.
2. **Stacked PRs:** PR1 merge olmadan PR2 açılabilir, ancak PR2 base branch'i PR1'dir. Linear dependency, hepsi küçük parçalar.
3. **Draft PR:** Henüz bitmedi ama mimari görüş istiyorsan draft aç. Review'dan sayılmaz, informal feedback.

**Comment density:** PR başına ortalama 2-4 yorum ideal. 0 yorum: ya trivial değişiklik ya da reviewer bakmamış. 8+ yorum: scope kaymış veya standart belirsiz.

## Ölçülebilir kalite metrikleri: review dashboard

Review kültürü veriyle yönetilir. Roibase'de şu metrikler haftalık dashboard'da:

- **Median time-to-review:** ekip ortalaması, kişisel outlier'lar görünür
- **Approval rate first round:** ilk review'da approve oranı (hedef >60%)
- **Comment type breakdown:** nit-pick (%20 altı), bug (%30+), mimari tartışma (%50 civarı)
- **Blocked PR count:** 24 saat+ bekleyen PR sayısı (hedef 0)

Bu dashboard'u Linear/Jira üzerinden değil, GitHub API + custom script ile çekin. Örnek:

```python
# Basitleştirilmiş örnek — production'da GitHub GraphQL API kullan
def calculate_review_metrics(repo, start_date):
    prs = repo.get_pulls(state='closed', sort='updated', direction='desc')
    
    metrics = {
        'time_to_first_review': [],
        'time_to_merge': [],
        'comment_density': []
    }
    
    for pr in prs:
        reviews = pr.get_reviews()
        if reviews.totalCount > 0:
            first_review = reviews[0].submitted_at
            time_diff = (first_review - pr.created_at).total_seconds() / 3600
            metrics['time_to_first_review'].append(time_diff)
        
        if pr.merged:
            merge_time = (pr.merged_at - pr.created_at).total_seconds() / 3600
            metrics['time_to_merge'].append(merge_time)
        
        metrics['comment_density'].append(pr.comments)
    
    return {
        'median_time_to_review': median(metrics['time_to_first_review']),
        'median_time_to_merge': median(metrics['time_to_merge']),
        'avg_comment_density': mean(metrics['comment_density'])
    }
```

Dashboard 2 haftada bir retrospective'de açılır. "Bu sprint median time-to-review 5.2 saat, hedef 4 saat — nerede takıldık?" sorusu kişisel değil, sistematik tartışma açar.

## Kültür kuralı olarak otomasyonun sınırları

Linter ve CI her şeyi halledemez. Mimari kararlar, tradeoff tartışmaları, domain logic review hâlâ insana bağlıdır. Ancak şunu garantileyin: otomasyon "basit hataları" önceden yakalasın, insan zamanı "karmaşık düşünceye" kalsın.

**Otomasyona verilmesi gerekenler:**
- Format check (Prettier, ESLint)
- Type safety (TypeScript strict mode)
- Test coverage (Jest threshold)
- Security scan (Snyk, Dependabot)

**İnsana bırakılması gerekenler:**
- API tasarımı tutarlılığı
- Performans tradeoff kararları
- Kullanıcı akışı impact analizi
- Teknik borç kabul/red

Ekipte "linter pass etti ama architecture review fail etti" durumu normaldir. Ama "linter fail etti ve PR açıldı" durumu sistem hatasıdır — pre-commit hook eksiktir.

## Review yorumlarında ton ve dil protokolü

Ölçülebilir kural olsa bile insanlar yorum yazar. Yorum tonunun standardı da olmalı. Roibase'de şu şablon kullanılır:

**Constructive comment şablonu:**

```
[Category] Observation
Reasoning: ...
Suggestion: ... (optional)
Priority: blocking / non-blocking
```

Örnek:

```
[Performance] Array.find() called in loop (lines 45-52)
Reasoning: O(n²) complexity, 1000+ item array'de 300ms delay
Suggestion: Convert to Map lookup before loop
Priority: blocking
```

Bu format "senin kodun kötü" yerine "bu kod şu senaryoda yavaş" der. Kişiselleştirme yok, odak davranış.

**Non-blocking comment:** "Bu çalışır ama gelecekte Y senaryosunda Z sorunu yaşanabilir." Merge'i engellemez, teknik borç kaydına girer.

**Blocking comment:** "Security issue — user input sanitize edilmemiş." Merge edilemez, düzeltme zorunlu.

Priority tag yoksa default non-blocking kabul edilir. Böylece "bu PR'ı geçirmeyelim mi?" tartışması kalkar — blocking tag varsa geçmez, yoksa geçer.

## Kapanış: kişisel çatışmadan kurtulmak için sayısal çerçeve

Code review kültürü "iyi niyet" üzerine kurulamaz. İyi niyetli ekipler bile subjektif tartışmaya düşer çünkü standart belirsizdir. Çözüm: time-to-review, comment density, PR size gibi metrikleri tanımlayın, otomasyonla enforce edin, dashboard ile takip edin. Bu disiplin sayesinde developer zaman kaybetmez, reviewer keyfi karar vermez, ekip velocity artar. 8+ yıllık ekip liderliği gösterdi ki ölçülemeyen kalite gelişmez — ölçün, optimize edin, tekrarlayın.