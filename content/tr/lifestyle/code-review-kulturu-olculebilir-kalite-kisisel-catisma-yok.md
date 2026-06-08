---
title: "Code Review Kültürü: Ölçülebilir Kalite, Kişisel Çatışma Yok"
description: "Time-to-review, comment density, PR size metrikleri ile code review'u kişisel çatışma alanından mühendislik disiplinine taşımak."
publishedAt: 2026-06-08
modifiedAt: 2026-06-08
category: lifestyle
i18nKey: lifestyle-003-2026-06
tags: [code-review, engineering-culture, pull-request, team-productivity, metrics]
readingTime: 8
author: Roibase
---

Code review süreci çoğu ekipte kaosa veya tamamen duygusal bir alışverişe dönüşür. "Bu kod kötü" yorumu kişisel eleştiriye, "approved" butonu da kontrol noktasından ibaret kalır. Roibase'de 8 yılda onlarca headless commerce entegrasyonunda, CDN migrasyonunda, veri pipeline kurulumunda şunu gördük: Review sürecini ölçülebilir kriterlerle tasarlamadan ekip kalitesi oluşturulamaz. Time-to-review, comment density, PR size gibi sayısal eşikler koymadan review kültürü kültür değil, kibarlık yarışmasıdır.

## Time-to-Review: İlk Feedback 4 Saat İçinde

Review hızı ekibin momentum'unu doğrudan etkiler. PR açıldıktan sonra ilk comment'e kadar geçen süre 4 saati aşarsa context switch maliyeti yazar tarafta birikmesi başlar. Slack'te "reviewed" bildirimi gelmeden yazar bir sonraki task'a geçer, ertesi gün geri dönünce değişiklik neydi hatırlamak için 15 dakika ısınma gerekir.

Roibase'de time-to-review metriğini GitHub API'den çekip Linear board'a tablo olarak yansıtıyoruz. Sprint sonunda median review time 4 saatin üstündeyse bir sonraki sprint'te reviewer assignment rotasyonunu değiştiriyoruz. Bu sayede kimse "ben review yapamam" gibi bir duruma gelmez, herkesin takviminde review bloğu vardır.

İkinci metrik: merge time — yani PR açılışından main branch'e geçene kadar geçen süre. E-ticaret özelliği PR'ı 48 saatten fazla beklemezse A/B testi planına yapışır. 48 saati aşan PR'larda scope creep oluyor demektir (reviewda özellik değişikliği istenmiş). O zaman ek story açıp mevcut PR'ı kapamak daha sağlıklıdır.

### Alert Sistemi: 24 Saat Geçince Slack Bildirimi

Linear webhook'u üzerinden PR 24 saat açık kalırsa reviewer'a otomatik ping gider. Bu basit otomasyon review disiplinini kitaptan çıkarıp operasyonel yapar. Slack botu kibarca hatırlatır: "PR #342, 28 saattir açık — scope büyük mü yoksa review için zaman blok'u eksik mi?" Bu soru kendiliğinden conversation açar.

## Comment Density: 100 Satır Başına 2-5 Yorum

Fazla yorum veren reviewer detay kontrolü yapar ama yazan tarafı bloke eder. Az yorum veren reviewer göz atıp geçer. Dengeli review her 100 satır değişikliğe 2-5 comment bırakır.

Roibase'de PR dashboard'unda her reviewer için comment density metriği izliyoruz. 10+ comment/100 satır varsa reviewer belki de scope'u anlamadan "bu değişmeli" diyordur. 1 comment/100 satır varsa reviewer rubber stamp oluyor demektir.

Comment density'yi kontrol etmek için PR template'imizde checklist var. "Logic değişikliği var mı?", "Test coverage eksildi mi?", "Environment variable eklendi mi?" gibi 7 madde. Reviewer bu checklist'i geçmeden approve edemez. Böylece yorumlar rastgele duygusal tepki olmaktan çıkar, sistematik kontrol noktası olur.

```markdown
## Reviewer Checklist
- [ ] Logic değişikliği backward compatible mı?
- [ ] Yeni environment variable var mı? .env.example güncellendi mi?
- [ ] Database migration varsa rollback script eklendi mi?
- [ ] Test coverage %80'in altına düştü mü?
- [ ] Bundle size 5 KB üstü arttı mı? (frontend)
- [ ] Breaking API değişikliği varsa changelog yazıldı mı?
- [ ] Yeni external dependency eklediyse lisans uyumlu mu?
```

Bu şablon sayesinde "bu kod kötü" yerine "migration rollback script eksik" gibi actionable comment gelir.

## PR Size Kuralı: +300 / -100 Satır Üstü Split Et

Büyük PR review edilemez. GitHub diff'inde 600 satır değişiklik görürse reviewer göz atar, "LGTM" der, geçer. Roibase'de PR size limiti: **+300 satır ekleme, -100 satır silme**. Bu eşiği aşan PR'da CI bot otomatik comment bırakır: "Bu PR büyük — feature flag ile incremental merge yap veya iki story'ye böl."

Büyük değişiklikleri bölmek için feature flag kullanıyoruz. Örneğin yeni checkout flow'u 8 dosyada 450 satır değişiklik gerektiriyorsa ilk PR'da sadece API layer'ı açarız (100 satır), ikinci PR'da UI component'i (120 satır), üçüncüde integration'ı (150 satır). Her PR kendi başına merge edilebilir, production'da flag kapalı durur. Son PR'da flag'i açınca flow aktif olur.

| PR Tipi | Satır Değişimi | Review Süresi (median) | Merge Sonrası Bug |
|---------|----------------|------------------------|-------------------|
| Micro (<150 satır) | +120 / -30 | 1.8 saat | 2% |
| Normal (<300 satır) | +280 / -90 | 3.5 saat | 5% |
| Büyük (>300 satır) | +450 / -200 | 12 saat | 18% |

Büyük PR'da bug oranı 3 kat yüksek çünkü reviewer detay göremez. Split edince her parça daha az riskli, merge sonrası rollback ihtiyacı da azalır.

## Conflict-Free Feedback: Duruma Değil Kod'a Yorum Yap

"Bu yaklaşım yanlış" yerine "Bu fonksiyon N+1 query üretiyor — eager loading ekle" demek kişisel değil, teknik eleştiridir. Roibase'de review comment'lerinde yasak kelimeler: "yanlış", "saçma", "çirkin", "bu ne". Bunun yerine şablon cümle: **"Bu değişiklik X metriğini nasıl etkiler? Y senaryosunda Z sorunu oluşturabilir."**

Comment ton check'i için GitHub Actions bot kullanıyoruz. Bot her comment'te "yanlış", "kötü", "berbat" gibi kelime varsa reviewer'a otomatik mesaj atar: "Bu comment yapıcı değil — spesifik problem tanımla veya alternative öner." Bu enforced politeness değil, mühendislik disiplinidir.

Bir diğer taktik: approval sonrası follow-up issue açmak. PR'da minor bir improvement fark edilse bile mevcut PR'ı bloke etmek yerine "Post-merge improvement: Cache invalidation logic'i refactor et" issue'su açıp link veriyoruz. Böylece PR hızla merge olur, improvement de backlog'a düşer.

### Pair Review: İki Reviewer, Farklı Lens

Kritik PR'larda (ödeme entegrasyonu, user auth, veri migration) iki reviewer zorunlu. Birinci reviewer logic'e bakar, ikinci reviewer security + performance'a bakar. Bu split review'da her reviewer kendi lens'inden comment bırakır, overlap olmaz. Böylece review süresi iki katına çıkmaz, kalite iki katına çıkar.

## Async Review: Senkron Toplantı Değil, Asenkron Thread

Code review meeting yapmıyoruz. PR thread'i yeterli. Reviewer comment bırakır, yazar 4 saat içinde cevap verir, gerekirse commit atar. Meeting'de "bu neden böyle?" sorusu 5 dakika tartışma gerektirir, async thread'de aynı soru 2 cümle + code snippet ile cevaplanır.

Asenkron review disiplinini kurmak için Slack entegrasyonu kurduk. PR'a comment geldiğinde yazar Slack'te bildirim alır ama toplantı davetiyesi almaz. Yazar kendi context switch noktasında (mevcut task bitince) thread'e geri döner. Bu yöntem özellikle remote ekiplerde (3+ timezone farkı) kritik. Roibase'in Istanbul-Berlin-San Francisco üçgeninde çalışan ekibinde senkron review yapılamaz. Async thread sayesinde Berlin'deki reviewer sabah 9'da comment bırakır, Istanbul'daki yazar öğleden sonra cevap verir, San Francisco'daki backend lead akşam merge eder.

---

Code review'u ölçülebilir kıldığında ekip içinde "senin kod'un kötü" gibi kişisel bir söylem kalmaz. Time-to-review, comment density, PR size metrikleri nötr zemin sağlar. Review quality'nin nasıl ölçüldüğü net olduğunda herkes aynı standardı tutar. [Markalaşma & Brand Identity](https://www.roibase.com.tr/tr/branding) çalışmamızda da benzer ölçülebilir kriterlerle tutarlı ekip çıktısı hedefleriz — code review kültürü de aynı disiplinin teknik ayağıdır. Kuralsız review, kültür değil, rastgele kibarlıktır. Kurallar koyduktan sonra review hızlanır, kalite artar, çatışma biter.