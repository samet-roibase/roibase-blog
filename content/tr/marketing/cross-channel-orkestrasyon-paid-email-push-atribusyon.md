---
title: "Cross-Channel Orkestrasyon: Paid + Email + Push Atribüsyon"
description: "Identity graph ile kullanıcı yolculuğunu birleştirin. Lifecycle event mapping + hold-out gruplar ile her kanalın gerçek katkısını ölçün."
publishedAt: 2026-07-18
modifiedAt: 2026-07-18
category: marketing
i18nKey: marketing-007-2026-07
tags: [cross-channel-attribution, identity-graph, lifecycle-marketing, incrementality, holdout-test]
readingTime: 8
author: Roibase
---

Pazarlamacılar 2026'da artık kanal-bazlı düşünmüyor. Bir kullanıcı Instagram Story'den gelir, e-posta ile yeniden devreye girer, push notification ile satın alır. Hangi kanal "son tıklama"yı aldıysa ona bütçe gider — bu oyun bitti. Cross-channel orkestrasyon, her kanalın gerçek katkısını ölçmek ve lifecycle event'leri birleştirerek müşteri yolculuğunu tek bir kimlik üzerinden izlemek demektir. Identity graph, hold-out gruplar ve lifecycle event mapping olmadan çok kanallı pazarlama sadece bir maliyet yığını haline gelir.

## Identity Graph Neden Orkestrasyonun Temelidir

Cross-channel atribüsyon yapmak için önce "kim" sorusuna cevap vermek gerekir. Bir kullanıcı anonim olarak siteye gelir, e-posta bültenine kaydolur, mobil uygulamayı indirir, push notification izni verir, Facebook'ta reklama tıklar — bunların hepsini **aynı kişi** olarak bağlamak identity graph'ın işidir. Graph olmadan her kanal ayrı bir kullanıcı gibi görünür, atribüsyon çöker.

Identity graph üç katmanlı çalışır: deterministik (e-posta, telefon, kullanıcı ID), probabilistik (cihaz parmak izi, IP + user-agent kombinasyonları) ve behavioral (gezinme paterni benzerliği). 2026'da GDPR + iOS privacy kısıtları nedeniyle deterministik sinyaller azaldı — ama first-party login, newsletter kayıt, uygulama indirme gibi momentler hâlâ güçlü bağlantı noktası. Bir e-ticaret markası e-posta adresini merkeze alarak web + app + CRM ID'sini birleştirdiğinde graph %78 çözünürlüğe ulaşabiliyor (Segment 2025 benchmark).

Graph'ı yalnızca customer data platform (CDP) değil, warehouse-native kimlik çözümleri (dbt + Hightouch gibi) de kurabilir. Önemli olan lifecycle event'lerin tek bir ID spine üzerinde toplanması. Örneğin: kullanıcı 12 Temmuz'da Meta'dan geldi (`utm_source=facebook`), 14 Temmuz'da e-posta açtı (`event=email_open`), 16 Temmuz'da push notification'a tıkladı (`event=push_click`), 18 Temmuz'da satın aldı (`event=purchase`). Bu zinciri görmek için her event'te aynı `user_id` gerekir — graph işte bunu sağlar.

## Lifecycle Event Mapping ile Yolculuğu Modellemek

Cross-channel orkestrasyon statik segmentlerle değil, **lifecycle event**'leriyle çalışır. Kullanıcı hangi aşamada (awareness, consideration, conversion, retention) ve hangi event'i tetikledi (app_install, cart_abandon, email_open, ad_click) — bunu bilmeden doğru mesajı doğru kanalda vermek imkansız.

Event mapping şöyle kurulur: her kanaldan gelen interaksiyon bir event olarak data warehouse'a yazılır (örneğin BigQuery). Paid media click → `utm_campaign + gclid` ile etiketlenir, e-posta tıklamaları `email_id + user_id` ile, push notification açılışları `push_campaign_id + device_id` ile. Bu event'leri lifecycle stage'e bağlamak için bir state machine tanımlanır: örneğin "consideration" stage'i son 7 gün içinde ürün sayfasını 2+ kez ziyaret etti ama sepete eklemedi koşuluyla aktif olur.

Mapping'in değeri şurada: aynı kullanıcı farklı kanallarda farklı mesaj alır. E-posta ile "sepetinde unuttuğun ürün" hatırlatması gelir, aynı anda Meta'da o ürünün indirim reklamı gösterilir, mobil uygulamada push notification "stoklarda azalma" uyarısı yapar. Bu üç kanal **orchestrated** çalışıyor — yani lifecycle event'e göre koordine ediliyor. Eğer kullanıcı herhangi birinde satın alırsa diğer kanallar otomatik kapanır (frequency capping across channels). 2024'te bu seviyede orkestrasyon kuran markalar e-posta + paid media sinerji lift'i %34 ölçtü (Iterable 2024 study).

### Event Prioritization

Her event eşit değildir. Bazı event'ler dönüşüme 2x daha yakındır: örneğin `cart_add` event'i `product_view`'dan daha yüksek intent sinyali verir. Event prioritization için geriye dönük conversion rate analizi yapın: son 90 günde hangi event'ten sonra satın alma olasılığı ne kadar arttı? BigQuery'de basit bir cohort analizi bu sayıyı verir:

```sql
SELECT
  event_name,
  COUNT(DISTINCT user_id) AS users,
  COUNTIF(converted_within_7d) / COUNT(DISTINCT user_id) AS conversion_rate
FROM events
WHERE event_timestamp >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
GROUP BY event_name
ORDER BY conversion_rate DESC;
```

Bu çıktıya göre event'leri 1-5 arası priority skoru ile etiketleyin. Priority 5 olan event'ler (örneğin `checkout_started`) hem paid retargeting hem e-posta hem push'a girsin, priority 2 olanlar sadece e-posta ile yetinsin.

## Hold-Out Gruplar ile Incrementality Ölçümü

Cross-channel orkestrasyonun en riskli yanı: her kanal "ben dönüştürdüm" der ama gerçekte kullanıcı zaten alacaktı. **Incrementality**, bir kanalın organik olmayan katkısını ölçer — yani o kanal olmasaydı satın alma gerçekleşir miydi? Bunu ölçmek için hold-out grup testi gerekir.

Hold-out test şöyle kurulur: kullanıcı tabanını rastgele %90 exposed + %10 hold-out diye ikiye ayırın. Exposed grup tüm kanallarda mesaj alır (paid + email + push), hold-out hiçbir şey almaz. 14-30 gün sonra iki grubun conversion rate'ini karşılaştırın. Fark = incrementality. Örneğin exposed grup %5.2 dönüşüm yapar, hold-out %4.8 yapar → net lift %0.4 → bu %8.3 incrementality demektir (0.4/4.8).

2026'da hold-out testini sadece paid media'ya değil, **tüm kanallara birden** uygulamak kritik. Bazı markalar sadece Facebook'u hold-out eder ama e-posta ve push açık kalır — bu yanlış bir test. Çünkü Facebook'un katkısını ölçerken e-posta'nın hâlâ devrede olması "net incrementality" göstermez. Doğru yöntem: tüm marketing touch point'lerini kapatmak (true control) veya her kanalı sırayla kapatarak bağımsız lift'lerini ölçmek (sequential holdout).

Hold-out testini her quarter yapın. Çünkü kanalların incrementality'si mevsimsel ve rekabet koşullarına göre değişir. Q4'te paid media incrementality'si düşer (herkes alışveriş yapacak zaten), Q1'de yükselir (soğuk hedef kitleye ulaşmak gerekir).

## Atribüsyon Modeli: Data-Driven + Shapley

Cross-channel orkestrasyonda son tıklama modeli çöp, ilk tıklama modeli çöp, lineer model de çöp. **Data-driven attribution** (DDA) veya **Shapley value** kullanın. DDA Google Analytics 4'te mevcut ama sadece Google Ads + GA4 eventlerini görür — e-posta, push, organic social, affiliate gibi kanalları kapsamaz. Bu yüzden kendi DDA modelinizi warehouse üzerinde kurmak gerekir.

Shapley value oyun teorisinden gelir: her kanalın marjinal katkısını hesaplar. Örneğin bir kullanıcı şu yolculuğu yaptı: Facebook → Email → Push → Satın Alma. Shapley her kanalın tüm permütasyonlardaki katkısını ortalar. Eğer Facebook + Email birlikte %60 conversion rate, yalnız Facebook %30, yalnız Email %35 veriyorsa Shapley Email'e daha fazla kredi atar (çünkü Email olmadan düşüş daha büyük). Python'da `shapley` kütüphanesi veya SQL'de recursive CTE ile hesaplanabilir.

DDA veya Shapley çıktısı her kanalın "weighted credit" skorudur. Bu skoru bütçe dağılımına bağlayın: eğer paid media Shapley credit'i %45 ise toplam pazarlama bütçesinin %45'i paid'e gitsin. Ama dikkat: Shapley geçmişe bakar, gelecek tahmin etmez — incrementality testi ile validate edin. Bazı markalar Shapley %60 kredi verdiği bir kanalı hold-out ettiğinde lift sadece %10 çıkıyor — demek ki kanal "görünür" ama "gerekli" değil.

## Orkestrasyonu Operasyonel Hale Getirmek

Cross-channel orkestrasyon teoride basit, pratikte karmaşık. Identity graph güncelliğini korumak, event mapping'i her yeni kampanyada revize etmek, hold-out testini iş ekibine izah etmek (çünkü "neden bu kullanıcılara reklam göstermiyoruz?" sorusu gelir) operasyonel disiplin ister.

Önce **signal pipeline** kurun: her kanaldan event'ler canlı olarak warehouse'a akmalı (latency < 5 dakika). Batch ETL yeterli değil — çünkü aynı gün içinde bir kullanıcı Facebook'tan gelip e-posta açabilir, bu iki event'i birleştirmek real-time identity resolution gerektirir. Reverse ETL ile warehouse'daki lifecycle segment'lerini Meta, Google, Braze, Iterable gibi platformlara geri yazın.

İkinci adım **campaign taxonomy**: her kampanya `{channel}_{stage}_{audience}_{date}` formatında isimlendirilsin (örneğin `meta_consideration_cart_abandoners_2026_07`). Bu taxonomy olmadan event'leri lifecycle'a bağlamak mümkün değil. Roibase'in [Dijital Pazarlama](https://www.roibase.com.tr/tr/dijitalpazarlama) servisi bu taxonomy + signal pipeline altyapısını kuruyor.

Üçüncü adım **reporting dashboard**: her kanal için son tıklama revenue + Shapley credit + incrementality lift metriklerini yan yana gösterin. Eğer bir kanal son tıklama revenue'de %50 ama Shapley'de %20, incrementality'de %10 ise o kanal overvalued demektir — bütçe kısın veya stratejisini değiştirin.

Cross-channel orkestrasyon bir kez kuruldu mu sürekli evrilir. Her quarter yeni bir lifecycle stage ekleyin (örneğin "churn risk" segment'i), her ay hold-out testini farklı bir kanala uygulayın, her hafta identity graph çözünürlüğünü izleyin. 2026'da pazarlama bu seviyede mühendislik disiplini talep ediyor — yoksa çok kanallı harcama sadece maliyeti çoğaltır, dönüşümü çoğaltmaz.