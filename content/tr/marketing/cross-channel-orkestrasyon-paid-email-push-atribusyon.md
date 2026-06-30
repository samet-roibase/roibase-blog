---
title: "Cross-Channel Orkestrasyon: Paid + Email + Push Atribüsyon"
description: "Identity graph, lifecycle event mapping ve hold-out gruplarla çok kanallı pazarlama atribüsyonunu nasıl kurarsınız? Somut mimari ve test yöntemi."
publishedAt: 2026-06-30
modifiedAt: 2026-06-30
category: marketing
i18nKey: marketing-007-2026-06
tags: [cross-channel-attribution, identity-graph, lifecycle-marketing, incrementality-testing, marketing-orchestration]
readingTime: 8
author: Roibase
---

Paid media kullanıcıyı siteye getiriyor, email lifecycle'da tutmaya çalışıyor, push notification yeniden harekete geçiriyor — ama hangi kanal gerçekten dönüşümü tetikledi? Platform-based atribüsyon her kanalın kendine dönüşüm yazması için teşvik oluşturur, gerçek incrementality ölçülemez. Bu, bütçenin hangi kanala gittiğini rastgele yapıyor. Cross-channel orkestrasyon, kullanıcı kimliğini merkezi bir identity graph'te birleştirip, lifecycle event'leri paylaşılan bir orchestrator'dan tetikleyerek bu karmaşayı çözer — ve hold-out gruplarla her kanalın gerçek katkısını ölçer.

## Identity Graph Neden Atribüsyonun Çekirdeği

Multi-touch attribution modellerinin çoğu aynı tuzağa düşer: kullanıcının kim olduğunu bilmeden touchpoint sırasını yazmaya çalışır. Bir ziyaretçi Google Ads'ten gelir, email ile tekrar döner, push notification'a tıklayarak satın alır — ama bunların aynı kişi olduğunu kanıtlayamıyorsanız, her kanal kendi başına "last-click" yazabilir.

Identity graph bu problemi çözer: tüm kanallarda aynı kullanıcıya ait sinyalleri (cookie, device ID, email hash, customer ID) tek bir profil altında birleştirir. Bu, ilk temastan satın almaya kadar olan tüm yolculuğun tek bir zaman çizelgesinde görünmesini sağlar. Ancak çoğu identity graph vendor'ı yalnızca match-rate'i optimize eder — oysa orkestrasyon için gereken şey, bu graph'in gerçek zamanlı event stream'le entegre olması ve lifecycle tetikleyicileri yönlendirebilmesidir.

Örnek senaryo: Kullanıcı Meta Ads'ten email kaydı yaptı, 3 gün sonra email tetiklendi, 7. gün push notification gönderildi, sonraki gün Google Ads retarget ile satın aldı. Identity graph bu sırayı kaydeder, ama orkestrasyon katmanı olmadan her kanal bağımsız karar alır: email segmentation, push schedule, retargeting audience farklı sistemlerde kurgulanır. Bu, aynı kullanıcıya 24 saat içinde 4 kez mesaj atılması veya lifecycle event'inin geç tetiklenmesi anlamına gelir.

### Graph'i Orchestrator'a Bağlama Mimarisi

Identity resolution layer (Segment, mParticle, RudderStack veya custom CDP) event stream'i dinler. Her event bir `user_id` veya `anonymous_id` taşır — sistem bunu graph'te resolve eder, tüm bilinen identifier'ları döner. Bu profil bilgisi orchestration engine'e (Braze, Iterable, Airship veya custom event-driven pipeline) gider. Orchestrator, lifecycle state machine'e göre hangi kanalın hangi mesajı atacağını karar verir — ama bu kararı paylaşılan bir event log'a yazar, böylece downstream atribüsyon modelleri tüm touchpoint'leri görür.

Kritik nokta: orchestrator'ın kanalları "silo" olarak görmemesi. Email service provider (ESP), push vendor, paid media platform ayrı sistemler olabilir, ama orchestrator onlara "send" komutu verirken, aynı `journey_id` ve `event_timestamp` context'ini taşımalı. Bu, downstream'de multi-touch attribution modelinin (linear, time-decay, Shapley value) her teması doğru sıralayabilmesi için zorunlu.

## Lifecycle Event Mapping: Kanalları Paylaşılan Zaman Çizelgesinde Senkronize Etmek

Lifecycle marketing geleneksel olarak email merkezli kurulur: "Hoş geldin serisi", "abandon cart", "winback". Ancak bu akışlar diğer kanallara izole edildiğinde, paid media retarget stratejisi ile충돌lar yaratır. Bir kullanıcı 2. günde email ile teklif alıyorsa, aynı anda Google Ads remarketing listesine düşüp aynı teklifi görmesi bütçe çakışmasıdır.

Paylaşılan lifecycle event map bu充돌leri önler. Her lifecycle state (onboarding, engaged, at-risk, churned) merkezi bir state machine'de tanımlanır ve her state transition bir event tetikler. Bu event tüm kanallara gider — ama her kanal "nasıl mesaj atacağına" kendi context'inde karar verir. Email HTML gönderir, push notification badge counter artırır, paid media audience segmentine ekler.

Örnek state transition:

```
USER_STATE_CHANGE
  user_id: abc123
  from_state: onboarding
  to_state: engaged
  trigger: completed_purchase
  timestamp: 2026-06-28T14:22:00Z
  attributes:
    total_spend: 89.00
    category: electronics
```

Bu event orchestrator tarafından yayınlanır. Email sistemi "engaged" state'ine geçişi görür, cross-sell kampanyası başlatır. Push sistemi "electronics" ilgi alanını profile kaydeder, yeni ürün lansman bildirimi kuyruğuna sokar. Paid media platformu (Google Ads Customer Match) "engaged" audience segment'ini günceller, high-intent kampanyasına dahil eder.

Kritik avantaj: Her kanal aynı state transition'ı aynı timestamp'te görür. Atribüsyon modelinde "email mi ilk tetikledi, yoksa paid media audience sync mi?" sorusu ortadan kalkar — çünkü her ikisi de `completed_purchase` event'ini izler, ikisi de aynı `journey_id` context'ini taşır.

### State Machine'i Conflict-Free Tutmak

Lifecycle state birden fazla kanal tarafından güncellenebilirse충돌 riski artar. Örneğin, email sistemi "at-risk" etiketini hemen yazmaya çalışırken, push notification "engaged" okur. Bunu önlemek için state transition authority tek bir serviste olmalı — genellikle orchestrator katmanında. Kanallar state'i okur ama doğrudan yazmaz; sadece event tetikler (örn. "email_clicked"), orchestrator bu eventi alır ve state transition kurallarına göre güncelleyip broadcast eder.

Bu yaklaşım [Dijital Pazarlama](https://www.roibase.com.tr/tr/dijitalpazarlama) altyapısında merkezi orchestrator ile signal coordination kurmanın temelini oluşturur — her kanal bağımsız execution yaparken, lifecycle logic tek bir noktada senkronize kalır.

## Hold-Out Grup ile Kanalların Gerçek Incrementality'sini Ölçmek

Cross-channel orchestration kuruldu, atribüsyon touch log'ları paylaşıldı — ama hâlâ "bu kanallar olmasa da aynı kullanıcı dönüşüm yapar mıydı?" sorusuna cevap yok. Paid + email + push kombinasyonunun toplam etkisi, her birinin ayrı ayrı toplamından farklıdır (synergy veya cannibalization olabilir). Bunu ölçmenin tek yolu: randomize hold-out grupları.

Hold-out test, kullanıcıların bir kısmını (genellikle %10-20) sistemden rastgele çıkarır: bu grup hiçbir email, push, retarget almaz. Kontrol grubu tüm kanalları normal alır. Test süresi minimum 2-4 hafta (lifecycle tam bir döngüyü tamamlamalı). Sonuçta, hold-out grubunun dönüşüm oranı ile kontrol grubunun farkı, orchestration'ın gerçek incremental lift'idir.

Örnek senaryo: 10,000 kullanıcı randomize ediliyor. %80 kontrol (8,000), %20 hold-out (2,000). 30 gün sonra:
- Kontrol grubu: 320 dönüşüm (%4.0 CVR)
- Hold-out grubu: 60 dönüşüm (%3.0 CVR)
- Incremental lift: +1.0pp, yani +33% relatif artış

Bu, orchestration'ın gerçekten işe yaradığını kanıtlar. Ancak bu testi kanal-bazında ayırmak daha derinlemştirir: "email hold-out", "push hold-out", "paid hold-out" gruplarını çapraz karşılaştırarak her kanalın izole katkısını da görebilirsiniz (factorial design).

### Hold-Out Grubunu Orchestrator'a Bağlama

Hold-out assignment identity graph'te saklanmalı ve her kanal execution'ında kontrol edilmeli. Kullanıcı email tetikleyicisine düştüğünde, orchestrator "bu kullanıcı hold-out mu?" diye sorgulamalı — evet ise, event log'a `suppressed_by_holdout` flag'i yazmalı. Aynı kontrol push ve paid audience sync'inde de çalışmalı.

Kritik hata: Hold-out grubunu sadece email'de tutup, paid media'da tutmamak. Bu durumda test geçersiz olur — çünkü hold-out grubu yine de retarget görür, dolayısıyla "kanal yok" senaryosu gerçekleşmez. Orchestrator katmanında merkezi hold-out kuralı bu consistency'yi garanti eder.

## Atribüsyon Modelini Multi-Touch Akışına Fit Etmek

Identity graph ve lifecycle orchestrator kurdunuz, hold-out ile incrementality ölçtünüz — şimdi touchpoint'leri nasıl kredilendireceğinizi belirleme zamanı. Geleneksel "last-click" her kanalın kendi dashboard'unda çalıştığı için충돌 yaratır. Cross-channel stack'te, tüm touchpoint'ler tek bir event log'da olduğu için, multi-touch attribution (MTA) modeli doğrudan uygulanabilir.

En yaygın modeller:
- **Linear:** Her touchpoint eşit kredi alır (basit, ama erken touchpoint'leri fazla ödüllendirir)
- **Time-decay:** Dönüşüme yakın touchpoint'ler daha fazla kredi (funnel ortasındaki lifecycle event'leri undervalue edebilir)
- **Position-based (U-shape):** İlk ve son touchpoint %40'ar, geri kalan %20 ortaya dağılır (klasik ama arbitrer)
- **Data-driven (Shapley value):** Her touchpoint'in marjinal katkısını hesaplar (en doğru, ama computational cost yüksek)

Roibase projelerinde, Shapley yaklaşımını hold-out testleriyle birleştiriyoruz: hold-out lift'i toplam incremental value olarak alıp, Shapley kredisi buna göre normalize ediyoruz. Bu, her kanalın "gerçek bütçe katkısını" somut rakamla göstermesini sağlar.

### Attribution Window ve Lifecycle Çakışması

Multi-touch modelinde attribution window kritiktir. Email'in 7 günlük, paid media'nın 1 günlük window'u varsa, aynı kullanıcıyı farklı kurallarla kredilendirirsiniz — bu karmaşayı arttırır. Orchestrator'da tüm kanallar için merkezi attribution window tanımlayın (örn. 14 gün), lifecycle state transition'ları da bu window içinde tutun. Böylece "at-risk" state'ten "engaged" geçişinin tetiklediği email, aynı window'da paid retarget ile çakışırsa, model her ikisini de görür.

## Orkestrasyon Stack'ini Production'a Taşırken Dikkat Edilecekler

Cross-channel orchestration teoride düzgün çalışır, pratikte ise latency, data freshness ve vendor API limitleri sorun çıkarır. Birkaç pragmatik nokta:

**Identity resolution latency:** Kullanıcı Google Ads'ten gelir, email hash resolve edilene kadar 200ms geçer — bu sürede push notification tetikleyicisi "unknown user" olarak işler. Bu, email ve push'un aynı kullanıcıya ait olduğunu bilmeden mesaj atması demektir. Çözüm: orchestrator katmanında "delayed execution queue" — event hemen orchestrator'a gider, ama kanal execution 1-2 saniye buffer ile yapılır, bu sürede identity resolution tamamlanır.

**Event log volume:** Yüksek trafikli sitede her pageview, click, state transition event'i log'a yazılır — bu saniyede binlerce event demek. Orchestrator bunu real-time işleyemezse, stream processing (Kafka, Flink) gerekir. Ancak hold-out decision gibi kritik işlemlerin hemen yapılması gerektiği için, orchestrator logic'ini stateless tutup, identity check'i cache'lenmiş graph'te yapmak şart.

**Vendor API rate limits:** Email provider (SendGrid, Postmark), push vendor (OneSignal), paid platform (Google Ads Customer Match) hepsinin upload limiti var. Orchestrator event'i hemen broadcast eder ama her kanal execution'ı batch'leyip async yapar. Bu, lifecycle event'inin tetiklenmesiyle mesajın gitmesi arasında 5-10 dakika fark olabileceği anlamına gelir — bu kabul edilebilir, çünkü orchestrator log'da touchpoint timestamp'i event zamanına göre yazılır, execution zamanına göre değil.

**A/B test ile orchestration充돌ü:** Lifecycle orchestration kuruluyken aynı zamanda email template A/B testi yapılıyorsa, orchestrator "hangi variant gönderildi?" bilgisini event log'a yazmalı. Yoksa atribüsyon modeli "email touchpoint" görür ama hangi creative'in çalıştığını bilmez, bu da creative optimization'ı boşa çıkarır. Bu nedenle orchestrator, kanal execution'ına `variant_id` context'i eklemeli.

Cross-channel orchestration, paid + email + push'u tek bir senkronize sistem haline getirir — ama bu, her kanalın özerkliğini almaz. Aksine, her kanal kendi execution logic'ini korur, sadece "ne zaman ve kime" kararını paylaşılan orchestrator'dan alır. Bu yapı, hold-out testleri ve multi-touch attribution ile birleştiğinde, her kanalın gerçek incrementality'sini ölçmenizi ve bütçeyi kanıt-bazlı şekilde dağıtmanızı sağlar.