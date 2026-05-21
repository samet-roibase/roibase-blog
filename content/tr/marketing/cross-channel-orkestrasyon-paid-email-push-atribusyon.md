---
title: "Cross-Channel Orkestrasyon: Paid + Email + Push Atribüsyon"
description: "Identity graph, lifecycle event mapping ve hold-out gruplarla kanallararası atribüsyon mimarisini nasıl kurarsınız? Server-side sinyaller, CDP entegrasyonu ve incrementality ölçümü."
publishedAt: 2026-05-21
modifiedAt: 2026-05-21
category: marketing
i18nKey: marketing-007-2026-05
tags: [cross-channel-attribution, identity-graph, lifecycle-marketing, incrementality, cdp]
readingTime: 8
author: Roibase
---

Kullanıcı bir reklama tıklıyor, iki gün sonra email açıyor, üç gün sonra push notification'dan satın alıyor. Hangi kanal kazandı? Geleneksel last-click model email'i ödüllendiriyor, paid media bütçeyi kesiliyor, lifecycle ekibi kampanya etkisini gösteremiyor. 2026'da her kanal kendi dashboard'unda kendine kazanmış gözüküyor ama bütçe komitesinde kimse diğerine güvenmiyor. Cross-channel orkestrasyon bu sorunu çözmek için değil — zaten çözülmüyor — ama en azından nerede kaynak israf edildiğini göstermek için var.

## Identity Graph: Kullanıcıyı Kanallararası Takip Etmek

Identity graph kullanıcının cihazlarını, email adresini, customer_id'sini, cookie ID'sini tek bir profilde birleştiren veri yapısıdır. Paid media pixel'i `gcl_id` döndürür, email sistemi `email_id` tutar, mobile SDK `device_id` gönderir — bunları merge etmezseniz aynı kullanıcı üç farklı kişi gibi görünür ve attribution kırılır.

Klasik yaklaşım: Her kanal kendi conversion event'ini kendi platform'una bildirir, Google Ads'da 100 dönüşüm, Klaviyo'da 80, Braze'de 50 gösterir — toplam 230 ama gerçek unique buyer 95. CDP veya warehouse'da identity resolution çalıştırmadan bu sayıları reconcile edemezsiniz. Segment, mParticle, Rudderstack gibi araçlar `user_id` üzerinden deterministic merge yapar, cookie + fingerprint üzerinden probabilistic stitch ekler. En basit hali: server-side GTM'den BigQuery'ye raw event akışı, dbt ile SQL-based identity collapse.

Örnek akış: Kullanıcı Meta reklamından siteye gelir → `fbclid` + `_fbc` cookie kaydedilir → sGTM Firebase Analytics'e `user_pseudo_id` gönderir → kullanıcı checkout'ta email verir → warehouse'da `email` ile `_fbc` birleştirilir → sonraki push event geldiğinde aynı `profile_id` altına yazılır. Bu noktada paid, email, push üç farklı satırda değil, tek bir user timeline'ında duruyor.

### Deterministic vs Probabilistic Merge

Deterministic: Kullanıcı login olmuş, `customer_id` var — match %100 kesin. Email, telefon, hesap numarası gibi PII'lar kesin bağlantı kurar. Probabilistic: IP adresi + user-agent + timezone + canvas fingerprint'ten çıkarım yapıyor — %80-90 doğruluk, GDPR'da riskli. Production'da ikisini harmanlamak gerekiyor: Login sonrası deterministic, anonymous session'da probabilistic fallback. mParticle'ın ID sync log'una bakarsanız merge rate'lerin kanal bazında değiştiğini görürsünüz — web %92, mobile app %96, email %78 (çünkü email'de device bilgisi yok).

## Lifecycle Event Mapping: Hangi Touch Hangi Fazda?

Cross-channel orkestrasyon "hangi kanal kazandı?" sorusundan "hangi touch hangi lifecycle aşamasını tetikledi?" sorusuna geçmek demektir. Awareness, consideration, purchase, retention — klasik funnel terimlerini kullanıyorum ama burada funnel linear değil, her kullanıcı farklı sırayla geziyor.

Event mapping şu mantıkla çalışır: Her touch'a lifecycle stage ve intent signal atayın. Paid media genelde awareness + acquisition, email retention + winback, push re-engagement + cart abandonment. Bir kullanıcı üç hafta içinde 8 touch alıyorsa (2 paid impression, 1 email open, 3 push, 2 organic visit) hangi touch conversion'a en yakın? Position-based attribution %40 first, %40 last, %20 middle verir — ama bu hâlâ heuristic. Gerçek etki incrementality test'le ölçülür.

Örnek senaryo: E-ticaret sitesi, 30 gün içinde dönüşüm yapan kullanıcıların median 4.2 touch aldığını görüyor (Google Analytics 4 path exploration report). İlk touch %68 paid (Google Ads + Meta), son touch %52 email. Orta touch'lar çoğunlukla push veya organic. Şirket email'e tam kredi verirse paid bütçeyi keser, tam tersi olursa lifecycle ekibi devre dışı kalır. Çözüm: Data-driven attribution model — GA4 veya warehouse SQL'de Shapley value hesabı, her touch'un marjinal katkısını ölçer. BigQuery'de `ml.ATTRIBUTION` fonksiyonu kullanarak path verisi üzerinde regression çalıştırabilirsiniz, her channel'ın conversion probability'ye katkısını görürsünüz.

### Multi-Touch Attribution Algoritması

GA4'ün DDA modeli conversion path'lerini train eder, her touch için coefficient hesaplar. Basitleştirilmiş versiyonu: Her path'i binary feature vektörüne dönüştürün (paid=1, email=0, push=1, ...), target conversion=1/0, logistic regression fit edin. Coefficient'ler her channel'ın independent etkisini verir. Production'da bu model haftada bir retrain edilmeli çünkü kampanya mix değişince touch dağılımı kayıyor.

Alternatif: Markov chain model — her kanal pair için transition probability hesaplar, "paid'dan email'e geçiş %18 conversion artırıyor" gibi. Python'da `markov_model` kütüphanesi var, path DataFrame'i alır, removal effect matrix döndürür. Markov, DDA'dan daha robust ama compute maliyeti yüksek (100k+ path'te GPU gerekir).

## Hold-Out Gruplar: Gerçek Lift'i Ölçmek

Attribution model ne kadar sofistike olursa olsun correlation gösterir, causality göstermez. Bir kullanıcı zaten alacakken email mi son dokunuş oldu, yoksa email olmasa da alacak mıydı? Bunu ölçmenin tek yolu hold-out grup — rastgele %10 kullanıcıya kampanya gösterme, conversion rate farkına bak.

Facebook Conversion Lift, Google Ads Brand Lift benzer mantıkla çalışır: Test grubu exposed, control grubu withheld. Fark incrementality'dir. Cross-channel orkestrasyon bağlamında hold-out'u CDP seviyesinde yapmanız gerekiyor çünkü bir kullanıcıya hem paid hem email hem push gidiyorsa control grubu her kanaldan çıkmalı. Braze'de `control_group` tag'i, Segment'te `suppress` trait ile bunu kurabilirsiniz.

Örnek setup: 100k kullanıcılık segment'ten %5'ini (5k) random sample ile control'e al, 14 gün boyunca hiçbir pazarlama kampanyası gönderme. Test grubuna normal paid + email + push akışı devam etsin. 14. günde purchase rate'e bak: Test grubu %3.2, control %2.8 → incrementality %0.4 → lift %14.3. Bu %0.4 puan gerçek kampanya etkisi, geri kalan %2.8 organik baseline'dır. Şimdi channel mix'i değiştir: Paid'ı kes, sadece email + push gönder, lift düşüyor mu? Bu şekilde her channel'ın marjinal katkısını izole edebilirsiniz.

Hold-out'un istatistiksel gücü sample size'a bağlı. %5 control %95 güven aralığı için yeterli ama incrementality çok küçükse (<%0.2) noise'da kaybolur. Bayesian A/B test'te prior belief ekleyerek daha erken karar alabilirsiniz — Python'da `pymc` kütüphanesi posterior distribution gösterir, lift'in %10'dan büyük olma olasılığını verir.

## CDP Entegrasyonu: Single Source of Truth

Cross-channel atribüsyon ancak tüm event'ler tek noktadan geçerse çalışır. Segment, mParticle, Rudderstack gibi CDP'ler client + server event'leri toplar, identity graph'ı günceller, downstream'e (warehouse, paid platform, lifecycle tool) dağıtır. Bu mimari olmadan her ekip kendi verisine bakar, reconcile imkansızdır.

Roibase'in [dijital pazarlama](https://www.roibase.com.tr/tr/dijitalpazarlama) çalışmalarında signal mimarisi CDP + sGTM + warehouse triangle'ı üzerine kuruludur. Client-side'da Segment SDK, server-side'da sGTM, tüm raw event BigQuery'ye yazılır. dbt ile identity stitching + sessionization, son tablo GA4 + paid platform'lara sync edilir. Bu stack'te hold-out grubu Segment trait olarak işaretlenir, downstream tüm destinasyonlara `suppress=true` gider — böylece paid, email, push hepsi aynı kullanıcıyı control olarak görür.

Alternatif: Warehouse-native CDP — Hightouch, Census gibi araçlar BigQuery'den okur, destination'lara reverse-ETL yapar. dbt'de identity graph kendiniz yazarsınız, maliyeti düşer ama complexity artar. Hangisi uygun? Ekip 5 kişiden azsa managed CDP, 10+ kişiyse warehouse-native. Orta skala için hybrid: Segment tracking, dbt transform, Hightouch sync.

## Kanal Bütçe Optimizasyonu: MMM ile Portfolio Yaklaşımı

Cross-channel attribution son adımda bütçe kararı üretmelidir. Hangi kanala ne kadar pay verelim? Multi-touch model her touch'a kredi dağıtır ama bütçe lineer artırınca return lineer artmaz — diminishing returns var. Marketing Mix Modeling (MMM) bunu ölçer.

MMM regresyon tabanlıdır: Haftalık paid spend + email send count + push count bağımsız değişken, revenue bağımlı değişken. Fit edince her channel'ın elasticity'sini görürsünüz: Paid spend %10 artarsa revenue %3 artar, email send %10 artarsa %1.2 artar — paid'ın ROI marjında daha yüksek. Ama paid zaten saturation'daysa (spend ikiye katladık, revenue %5 arttı) artık email'e kaymalısınız.

Python'da `pymc-marketing` kütüphanesi MMM için Bayesian model içerir, saturation + adstock effect'i modelleyebilirsiniz. Adstock: Bugün harcanan bütçenin gelecek haftalara yayılan etkisi — TV reklamı 4 hafta kalıcılık yaratır, paid search aynı gün etkilidir. Cross-channel bağlamda adstock her kanal için farklı decay rate gerektirir. BigQuery'de haftalık aggregated tablo oluşturup MMM'e feed edersiniz, output her channel için optimal spend range verir.

### Incrementality + MMM Uyumu

Hold-out test kısa dönem (2 hafta) incrementality'yi ölçer, MMM uzun dönem (52 hafta) trend'i yakalar. İkisini kombine etmek ideal: Hold-out'tan gelen lift coefficient MMM'de prior olarak kullanılır, model daha hızlı converge eder. Örnek: Email hold-out lift %8 bulmuş, MMM'de email coefficient prior ~ Normal(0.08, 0.02) olarak set edilir — model bu aralıkta arama yapar, posterior daha dar çıkar.

## Ölçüm Pratiği: Dashboard ve Alerting

Teorik model hazır, production'da nasıl izlersiniz? Looker Studio veya Tableau'da cross-channel dashboard: Üstte total revenue + ROAS, altta channel breakdown (paid, email, push), ortada overlap Venn diagram (kaç kullanıcı 2+ kanal gördü). Her hafta hold-out test sonucu güncellensin, lift trend chart'a işlensin. Alert: Lift %5'in altına düşerse Slack notification.

Örnek dashboard yapısı:
- **Üst panel:** Total spend, total revenue, blended ROAS
- **Orta panel:** Channel-level ROAS (last-click, DDA, Shapley), overlap matrix
- **Alt panel:** Hold-out test summary (test vs control conversion rate, lift, p-value)
- **Sağ panel:** MMM optimal spend recommendation, current vs optimal gap

BigQuery Scheduled Query her hafta yeni path verisini çeker, dbt model identity merge + DDA coefficient update yapar, Looker Data Studio otomatik refresh. Alert logic: `IF(lift < 0.05 OR p_value > 0.1) THEN send_slack('Incrementality düştü')`. Bu akış manuel reconcile ihtiyacını sıfırlar, ekip dashboard'a bakıp bütçe kararı alır.

---

Cross-channel orkestrasyon pazarlamanın "hangisi kazandı?" tartışmasını bitirmez ama en azından tartışmayı veri zeminine çeker. Identity graph kullanıcıyı birleştirir, lifecycle mapping her touch'u bağlamsallaştırır, hold-out grup causality gösterir, CDP entegrasyonu single source of truth kurar, MMM bütçeyi optimize eder. Bu beş parça aynı anda çalışmazsa sistem partial kalır — attribution model sofistike olsa da bütçe komitesi gene last-click'e güvenir. Production'da çalışan bir cross-channel stack kurmak 3-6 ay alır: İlk ay identity graph, ikinci ay hold-out altyapısı, üçüncü ay MMM model training. Ama bir kez kurduktan sonra her kanal kendi dashboard'unda kendine yalan söylemek yerine ortak bir gerçekliğe bakar — bu bile büyük kazançtır.