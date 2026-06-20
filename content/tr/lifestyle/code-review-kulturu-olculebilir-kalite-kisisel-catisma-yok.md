---
title: "Code Review Kültürü: Ölçülebilir Kalite, Kişisel Çatışma Yok"
description: "Time-to-review, comment density, PR size kurallarıyla ekip kalitesini sayısal kriter üzerine kurmak — kişisel yargı yerine sistemik disiplin."
publishedAt: 2026-06-20
modifiedAt: 2026-06-20
category: lifestyle
i18nKey: lifestyle-003-2026-06
tags: [code-review, engineering-culture, pr-metrics, team-workflow, async-first]
readingTime: 8
author: Roibase
---

Code review süreçleri genellikle "kalite kontrol" diye başlar, "ego savaşı" diye biter. Ekip büyüdükçe iki tuzak belirginleşir: PR'lar haftalar boyunca bekler ya da her yorum kişisel eleştiri algısına dönüşür. İkisi de aynı köklü sorundan gelir — ölçülebilir olmayan kurallar. Roibase'de 8 yıldır farklı disiplinlerden 15+ kişilik ekiple çalışırken öğrendiğimiz şey basit: review kültürünü sayısal kriterlere oturtmadığınız sürece kişisel yargı kaçınılmaz hale gelir. Time-to-review, comment density, PR size gibi metrikleri sistem haline getirdiğinizde kalite artar, çatışma düşer.

## Review Hızı: Time-to-Review SLA'sı

Her PR'ın bir yaşam döngüsü var. Açıldıktan sonra ilk comment'e kadar geçen süre — time-to-first-review — ekip disiplininin ilk göstergesi. Roibase'de bu süreyi maksimum 4 saat ile sınırladık (çalışma saatleri içinde). Neden 4 saat? Async çalışma modelinde deep work bloklarını korurken geri bildirim döngüsünü hızlandıran tatlı nokta.

Kural şu: PR açıldıktan sonra 4 saat içinde en az bir reviewer bakmalı. Bunu enforcing mekanizması Slack notifikasyonu değil — GitHub Actions workflow'u. PR açıldığında otomatik tag atılır, 4 saat sonra assign edilmiş reviewer'lara Slack mention gider. Bu soft reminder, "unutulan" review'ları eliminate eder.

Time-to-merge metriği daha kritik. PR açılışından main branch'e merge'e kadar geçen süre — örneğin backend değişikliklerinde 24 saati geçmesin kuralı var. Frontend değişiklikler için 48 saat. Neden bu fark? Backend merge'ler genellikle daha az görsel onay gerektirir, feature flag arkasında deploy edilebilir. Frontend'de design QA ve cross-device test aşamaları zaman alır.

### Metrik Dashboard: Linear Integration

Linear ile GitHub'ı entegre edip her PR'ı otomatik olarak Linear ticket'a bağlıyoruz. Ticket'ın status'ü PR lifecycle'ına göre güncelleniyor. Sprint sonunda bakılan sayı: ortalama time-to-merge. Ekip ortalaması 36 saatin üstüne çıkarsa retrospective'de konuşulması gereken bir sorun var demektir — genellikle PR size veya reviewer yükü.

## PR Size: 400 Satır Kuralı

Büyük PR'lar review edilemez. Bu sektördeki en yaygın consensus ama nadiren ölçülebilir kurala dönüştürülür. Roibase standardı: **max 400 satır değişiklik** (addition + deletion toplamı). Bu sayı nereden geldi? 30 dakikalık odaklı review'da bir reviewer'ın mantıklı şekilde context'i kafasında tutabileceği satır sayısı.

Kuralı enforce etmek için GitHub branch protection rule: 400 satırı geçen PR'lara otomatik "needs-split" label atılır, merge yapılamaz. Exception durumlar var — örneğin dependency update'leri, migration script'leri. Bunlar için manual override gerekiyor, ama o bile bir GitHub comment ile justification istiyor.

Büyük refactor'lar nasıl yapılıyor? Stacked PR'lar. İlk PR: interface değişikliği, ikinci PR: implementation, üçüncü PR: old code removal. Her biri 400 satırın altında, her biri bağımsız review edilebilir. Bu approach zaman alır mı? Evet. Merge conflict riski artar mı? Biraz. Ama review quality'si katlanarak iyileşir — çünkü reviewer her değişikliği düşünebilecek zihinsel kapasitede.

```yaml
# GitHub Actions — PR size check
name: PR Size Check
on: pull_request

jobs:
  size_check:
    runs-on: ubuntu-latest
    steps:
      - name: Check PR size
        run: |
          ADDITIONS=$(jq '.pull_request.additions' "$GITHUB_EVENT_PATH")
          DELETIONS=$(jq '.pull_request.deletions' "$GITHUB_EVENT_PATH")
          TOTAL=$((ADDITIONS + DELETIONS))
          if [ $TOTAL -gt 400 ]; then
            echo "PR too large: $TOTAL lines"
            gh pr edit --add-label needs-split
            exit 1
          fi
```

## Comment Density: Nitpick Sınırı

Her comment aynı ağırlıkta değil. "Burası refactor edilebilir" ile "Bu null pointer exception yaratır" arasında kritiklik farkı var. Roibase review template'inde comment kategorileri zorunlu:

| Kategori | Etiket | Örnek |
|---|---|---|
| **Blocker** | `🔴 BLOCKER` | Security açığı, runtime crash |
| **Major** | `🟠 MAJOR` | Performans regresyonu, logic hatası |
| **Minor** | `🟡 MINOR` | Naming convention, test coverage |
| **Nitpick** | `🔵 NITPICK` | Tercih meselesi, subjektif |

Kural: **Nitpick oranı %30'u geçmesin**. Bir PR'da 10 comment varsa 3'ü nitpick olabilir, geri kalanı blocker/major/minor olmalı. Neden? Çünkü nitpick ağırlıklı review'lar author motivasyonunu düşürür, reviewer'ı "gereksiz titiz" algısına iterler.

Comment density metriği: PR başına ortalama comment sayısı. Roibase'de bu sayı 3-5 arası. 10'un üstü comment genellikle PR'ın split edilmesi gerektiğini gösterir. 0 comment ise rubber stamp review sinyali — bu da istenmeyen.

### Template Kullanımı

Her reviewer GitHub PR template'inden başlar:

```markdown
## Review Checklist
- [ ] Code logic doğru mu?
- [ ] Test coverage %80'in üstünde mi?
- [ ] Breaking change var mı? (CHANGELOG güncellendi mi?)
- [ ] Performance impact ölçüldü mü? (benchmarks/)

## Comments
**🔴 BLOCKER:**
-

**🟠 MAJOR:**
-

**🟡 MINOR:**
-

**🔵 NITPICK:**
-
```

Bu template iki işe yarıyor: reviewer'ı kategorize etmeye zorluyor, author ise hangi comment'lerin kritik olduğunu hızlı görüyor.

## Async Review: Sync Meeting Tuzağı

Code review sync meeting'de yapılmamalı. Roibase'de "review call" kavramı yok — tüm review async, GitHub üzerinde. Neden? Çünkü ekip 3 farklı timezone'da çalışıyor, deep work bloklarını korumak kritik.

Async review disiplini şu şekilde işliyor: reviewer PR'ı kendi derin odak saatinde inceler (genellikle sabah 09:00-12:00 arası). Comment'leri yazar, approve ya da request changes yapar. Author notification geldiğinde (kendi takviminde) değişiklikleri yapar, re-request review eder. Bu cycle ortalama 2-3 kez tekrarlanır.

Exception: **review deadlock** — author ve reviewer 3 gidiş-gelişte anlaşamadıysa, o zaman 15 dakikalık sync call açılır. Ama bu yılda 5-6 kez olur, istisna durumda. Roibase'in [markalaşma]( https://www.roibase.com.tr/tr/branding) sürecinde oluşturduğu brand voice da async-first çalışma kültürünü yansıtır — documentation-first, meeting-last.

## Ownership vs. Gatekeeping

Code review'un amacı quality assurance ama yan etkisi gatekeeping olmamalı. Roibase'de her PR minimum 1, maksimum 2 reviewer gerektirir. Neden 2 üst sınır? Çünkü 3+ reviewer approval beklemenin zaman maliyeti code quality kazancını geçiyor.

Reviewer seçimi otomatik değil — author kendi seçer. Kural: en az biri code owner (CODEOWNERS dosyasından), diğeri istenen herkes. Bu approach ownership'i author'da tutar. "Kim approve etmeli?" sorusu author'ın sorumluluğunda, ekip liderinin değil.

CODEOWNERS dosyası şu şekilde:

```
# Backend
/backend/ @backend-team
/api/ @backend-team

# Frontend
/web/ @frontend-team
/mobile/ @mobile-team

# Infrastructure
/terraform/ @devops-team
/.github/ @devops-team
```

Her dosya değişikliği ilgili team'den biri tarafından review edilmek zorunda — ama yine de author kişiyi seçer.

## Retrospective: Review Metrikleri

Her sprint sonunda (2 haftada bir) review metriklerine bakıyoruz. Linear dashboard:

- Ortalama time-to-merge (target: 36 saat)
- PR size distribution (target: %90'ı 400 satır altı)
- Comment density (target: PR başına 3-5)
- Nitpick oranı (target: <%30)
- Review bottleneck (en çok bekleyen reviewer kim?)

Bu sayılar retrospective'de konuşuluyor ama kişisel suçlama yok. Örneğin "Ali'nin review'ları yavaş" yerine "Backend PR'lar ortalama 48 saat bekliyor, reviewer pool'u genişletmeli miyiz?" sorusu soruluyor.

---

Code review kültürünü kişisel yargıdan çıkarıp sistemik disipline taşımak zor değil — ama ölçülebilir kurallar gerekiyor. Time-to-review SLA'sı, 400 satır kuralı, comment kategorileri, async-first yaklaşım — bunlar Roibase'de 8 yıldır ekip büyürken kaliteyi korumamızı sağlayan somut araçlar. Eğer review süreçleriniz hâlâ "sezgisel" ve "duruma göre" çalışıyorsa rakamları koyun, sistemik hale getirin. Kalite artarken çatışma düşecek.