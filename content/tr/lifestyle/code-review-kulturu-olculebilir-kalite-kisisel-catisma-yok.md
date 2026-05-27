---
title: "Code Review Kültürü: Ölçülebilir Kalite, Kişisel Çatışma Yok"
description: "Time-to-review, comment density, PR size kuralları ile code review sürecini ölçülebilir hale getirin. Kişisel çatışma yerine sistem tasarlayın."
publishedAt: 2026-05-27
modifiedAt: 2026-05-27
category: lifestyle
i18nKey: lifestyle-003-2026-05
tags: [code-review, engineering-culture, pr-metrics, team-workflow, async-collaboration]
readingTime: 7
author: Roibase
---

Code review, yazılım ekiplerinin kalite kontrol mekanizması olduğu kadar kültürel bir stres testi de. İyi tanımlanmamış bir review süreci, yorumların kişiselleşmesine, PR'ların günlerce beklemesine ve ekip içinde pasif-agresif iletişime yol açar. Roibase'de 8+ yıldır çok disiplinli ekiplerde deneyimlediğimiz gerçek: review kültürü, kişisel hassasiyete değil ölçülebilir kurallara dayanmalı. Time-to-review, comment density, PR size gibi metrikler tanımlandığında, süreç kişiliklerden bağımsız işler. Bu yazıda, code review'u sistematik bir mühendislik pratiğine dönüştüren üç temel kuralı ele alacağız.

## Time-to-Review: İlk Yanıt Süresini Sabitle

Review gecikmesi, engineering velocity'nin en gizli yavaşlatıcısı. Bir PR açıldıktan sonra 24 saat içinde ilk yorum gelmezse, yazan kişi bağlam kaybeder ve bir sonraki işe başlar. PR merge edildiğinde ise o bağlamı yeniden kurmak için 15-20 dakika harcanır. 10 kişilik bir ekipte günde 5 PR açılırsa ve ortalama time-to-review 48 saat ise, haftada 50 PR × 20 dakika = 16.6 saat bağlam kaybı demektir.

Roibase'de uyguladığımız kural: **ilk yanıt maksimum 4 saat**. Bu süre, yorumun "LGTM" olması veya detaylı değişiklik istenmesi fark etmez — önemli olan yazarın PR'ının "görüldü" sinyalini alması. GitHub Actions ile otomatik hatırlatıcı kuruyoruz: PR açıldıktan 3 saat sonra atanmış reviewer'a Slack mention gönderiliyor. 4 saati geçen PR'lar, daily standup'ta "blocker" olarak işaretlenir.

Bu kuralın yan etkisi, async çalışma disiplinini zorlamak. Remote ekiplerde zaman dilimi farkı varsa, reviewer atama stratejisi buna göre tasarlanır. Örneğin, UTC+3'teki bir dev'in PR'ı, UTC-5'teki reviewer'a atanmaz — o zonedaki başka bir dev tercih edilir. Time-to-review metriği Linear veya GitHub Insights'ta haftalık takip edilir. Ortalamanın üstünde kalan developer'larla 1-on-1 yapılır; sorun kişisel değil, workload planlaması olabilir.

### Öncelik Etiketleme Sistemi

Her PR'a otomatik `priority` etiketi atanır: `P0` (hotfix, aynı gün merge), `P1` (feature, 4 saat ilk yanıt), `P2` (refactor, 8 saat). Etiket, PR boyutuna ve branch'in `main` veya `staging`'e olan uzaklığına göre hesaplanır. Bu sayede reviewer, hangi PR'a önce bakacağını bilir — subjektif "bana acil gibi geldi" yok.

## Comment Density: Az ve Net Yorum

Review yorumunun kalitesi, sayısıyla ters orantılı. 50 satırlık bir değişikliğe 12 yorum yapılıyorsa, ya PR gerçekten kötü yazılmış ya da reviewer nitpicking yapıyor. İkisi de ekip dinamiğine zarar verir. İlkinde PR daha küçük parçalara bölünmeliydi, ikincisinde yorumlar "blocker" ile "öneri" arasında ayrılmalıydı.

Roibase'de **comment density** kuralı: 100 satır değişiklik başına maksimum 5 yorum. Bunun üstünde yorum yapılacaksa, PR "too large" etiketi alır ve yazar küçük parçalara bölmesi istenir. Yorumlar üç kategoriye ayrılır: `blocker` (merge edilemez), `suggestion` (merge edilir ama gelişir), `question` (anlamak için). GitHub'ın "Request Changes" özelliği sadece blocker durumunda kullanılır — suggestion'lar merge sonrası issue olarak açılabilir.

Bu kuralla birlikte, inline comment yerine "summary comment" yazmayı teşvik ediyoruz. Reviewer, 3-4 küçük yorum yerine tek bir paragraf yazıp genel yaklaşımı tartışır. Örneğin: "Bu endpoint'in validasyonu service katmanında yapılmalı, controller sadece HTTP isteğini parse etmeli. 5 farklı dosyada aynı validasyon tekrar ediyor." Bu yaklaşım, yazarın savunmaya geçmesi yerine konuyu mimari düzeyde düşünmesini sağlar.

## PR Size Kuralları: 200 Satır Üstü Otomatik Ret

Büyük PR'lar, review sürecinin en büyük düşmanı. 500 satırlık bir değişikliği incelemek 40-50 dakika alır ve reviewer, detayları kaçırmak korkusuyla ya yüzeysel bakar ya da çok sert yorum yapar. Her iki durumda da kalite düşer.

Roibase'de uyguladığımız otomasyon: **200 satırı geçen PR'lar otomatik "needs split" etiketi alır ve merge edilemez**. Bu kural, GitHub Actions ile uygulanır. Kod satırı, boşluk ve yorum hariç "logical lines of code" (LLOC) olarak hesaplanır. 200 satır, ortalama 10-12 dakikalık review süresine denk gelir — reviewer'ın konsantrasyonunun dağılmadığı eşik.

İstisnalar var: migration script, generated code, config dosyası gibi mekanik değişiklikler bu kuralın dışında. Bu durumda PR açıklamasında "bulk change - no logic" etiketi konulur ve reviewer sadece yapısal kontrol yapar.

PR boyutunu küçük tutmanın yan etkisi, feature geliştirme stratejisini de değiştirir. Developer'lar, büyük feature'ları "incremental merge" yaklaşımıyla böler: önce data model, sonra service katmanı, ardından API endpoint, en son UI entegrasyonu gibi. Bu sayede her PR bağımsız test edilebilir hale gelir. [Markalaşma & Brand Identity](https://www.roibase.com.tr/tr/branding) çalışmalarında kullandığımız iteratif yaklaşım, yazılım geliştirmeyle paralellik gösterir — büyük değişim, küçük adımlara bölünür.

### CODEOWNERS ile Zorunlu Review

Her modül için GitHub CODEOWNERS dosyasında owner tanımlanır. Backend API değişikliği, en az bir backend engineer'ın approve'unu gerektir. Frontend değişikliği için UI lead'in onayı şart. Bu kural, "herhangi bir ekip üyesinin approve vermesi" pratiğini kaldırır. CODEOWNERS dosyası, repo root'unda tutulan YAML formatında bir mappingdir: `/services/payment -> @payment-team`, `/ui/components -> @frontend-lead`. PR açıldığında otomatik atanır.

## Review Ritual: Async Standuplarda Blocker PR'lar

Code review, günlük standup'ta tartışılacak bir konu değil — standup'lar async yapıldığında zaten müsait değilsin. Ama blocker PR'lar, yani 4 saati geçenler veya "needs split" etiketi alanlar, standup'ın sonunda liste halinde paylaşılır. Bu sayede herkes hangi PR'ların takılı olduğunu bilir ve müsait olan reviewer el kaldırır.

Roibase'de Linear'da açık bir "PR Blockers" board'u var. Buraya düşen PR'lar, aynı gün içinde çözülmezse, o sprintin velocity'sine negatif puan olarak işlenir. Bu metrik, ekip performansını ölçerken kullanılır — bireysel değil, kolektif sorumluluk.

Review sonrası, değişiklik istenen PR'lar "author action" etiketiyle yazara geri döner. Yazar değişikliği yaptıktan sonra "re-review" etiketine döner. Bu döngüyü takip eden otomasyon, Linear ticket'ıyla senkronize çalışır: PR merge edildiğinde ticket otomatik "done" olur.

## Review Kültürünün Ölçülebilir Çıktıları

6 ay boyunca yukarıdaki kuralları uygulayan bir ekipte gözlemlediğimiz sayılar: ortalama time-to-merge 72 saatten 18 saate düştü. PR başına comment sayısı 8'den 3'e indi. "Needs split" etiketi alan PR oranı ilk ayda %40 iken 4. ayda %5'e geriledi — developer'lar küçük PR açmayı içselleştirdi.

Daha önemlisi, ekip içi çatışma sayısı azaldı. Review yorumları, kişisel eleştiri olarak algılanmadı çünkü tüm süreç metrikle tanımlanmıştı. "Senin kodun kötü" yerine "bu PR 250 satır, kural gereği bölelim" demek, savunma mekanizmasını devre dışı bırakır.

Bu disiplin, sadece code review değil, tüm engineering workflow'unda ölçülebilirlik kültürünü yerleştirir. Sprint velocity, cycle time, deployment frequency gibi metrikler de aynı mantıkla izlenir. Roibase'in 15+ disiplinde mühendislik yaklaşımı, yazılım geliştirmede olduğu kadar pazarlama operasyonlarında da benzer sistematik düşünceye dayanır.