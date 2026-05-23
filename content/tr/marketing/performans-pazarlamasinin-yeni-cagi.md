---
title: "Performans Pazarlamasının Yeni Çağı"
description: "Cookie sonrası dönemde performans pazarlaması signal mimarisi ve mühendislik disiplinine evrildi. İşte yeni oyunun kuralları."
publishedAt: 2026-05-23
modifiedAt: 2026-05-23
category: marketing
i18nKey: marketing-008-2026-05
tags: [performans-pazarlamasi, signal-mimarisi, attribution, first-party-data, server-side-tracking]
readingTime: 8
author: Roibase
---

Üçüncü taraf cookie'ler gitti, IDFA izinleri %20'ye düştü, Safari ITP tüm tracking script'leri 24 saatte sildi. 2026'da performans pazarlaması artık bir mühendislik disiplini. Hangi kampanyanın ne kadar dönüşüm getirdiğini bilmek için browser'a güvenemiyorsunuz — signal mimarisi kurmak zorundasınız. Bu yazı pazarlama teknolojisini mühendislik çerçevesine nasıl oturtacağınızı gösteriyor.

## Cookie sonrası attribution'ın çalışma prensibi

2023 öncesi performans pazarlaması basitti: client-side tag her şeyi görebiliyordu, platform pixel'leri cross-domain izliyor, attribution otomatik. 2026'da böyle bir dünya yok. Artık signal'lar üç katmanda toplanıyor: browser event, first-party sunucu, platform API. Bu katmanların entegrasyonu yoksa attribution eksik.

Signal kaybını önlemek için Conversion API (CAPI) artık opsiyonel değil — zorunlu. Meta, Google, TikTok hepsi server-side event kabul ediyor. Ama server'a event göndermek yetmiyor — hangi kullanıcının hangi kampanyaya tıkladığını sunucuda tutmak gerekiyor. Bu demektir ki first-party cookie, session store, user ID matching. Cookie'ler gitti ama *kendi* cookie'niz hayatta, ve attribution'ın temel taşı orası.

Server-side GTM (sGTM) bu katmanı kurmak için en yaygın tercih. Cloud Run üzerinde çalıştırabilirsiniz, tüm platform tag'lerini container'a alırsınız, client-side yükü azaltır + ITP'den kurtarırsınız. Ancak dikkat: sGTM tek başına bir çözüm değil, signal'ı *sunucuya nasıl gönderdiğiniz* önemli. dataLayer event'lerini data stream'e dönüştürmek + user_data parametrelerini doğru doldurmak gerekiyor. Bunlar missing olursa platform modelleme yapamıyor, ROAS yanlış görünüyor.

## Deterministic + probabilistic modelleme hibrit yaklaşımı

Eski attribution'da her click trace edilebiliyordu, model deterministikti. Şimdi signal kaybı %40'larda (iOS Safari kullanıcıları, ad-blocker, VPN trafiği). Bu kayıp alanı probabilistic modelleme doldurur. Google Enhanced Conversions, Meta CAPI + browser event enrichment, TikTok Events API — hepsi makine öğrenmesiyle eksik click-conversion path'lerini tahmin ediyor.

Probabilistic model çalışması için 3 input şart:

| Input | Açıklama | Örnek |
|---|---|---|
| First-party identifier | Email hash, phone hash, user_id | SHA-256(`email`) |
| Server event metadata | IP, user_agent, fbc/fbp cookie | `x-forwarded-for` header |
| Conversion value | Gerçek işlem tutarı | `purchase` event `value=149.90` |

Bu üç veriyi platformlara tutarlı göndermezseniz modelleme doğru çalışmaz. Özellikle email hash'i eksik kalırsa Meta CAPI "low-match-quality" uyarısı verir, kampanya optimizasyonu düşer. Bunu çözmek için checkout form'da email'i gönderme (submit) öncesi capture etmek + sunucu tarafında hashlemek gerekiyor. Client-side hash GDPR riski taşır, sunucuda yapın.

Probabilistic'in kör noktası: segment-level doğrulama yapamıyorsunuz. Platform size "bu kampanya 5x ROAS getirdi" diyor, ama hangi kitle, hangi kreatif, hangi coğrafya? Bunu kontrol etmek için geo-holdout test veya matched-market MMM gerekiyor. Incrementality ölçümü olmadan probabilistic ROAS'a %100 güvenmeyin.

## Bidding stratejisi signal kalitesine bağlandı

Eski günlerde kampanya ROAS hedefi yazıyordunuz, platform optimize ediyordu. 2026'da bidding algoritması *signal kalitesine* duyarlı. Google Target ROAS'ta düşük-değerli conversion'lar geliyorsa model yanlış öğreniyor, bütçeyi düşük-intent trafiğe harcıyor. Bu sorunu çözmek için conversion value rule'ları kurmak gerekiyor.

Örnek: bir e-ticaret sitesi hem "add_to_cart" hem "purchase" event'ini Google'a gönderiyor. Add-to-cart conversion olarak sayılıyor, ama değeri düşük. Google algoritması add-to-cart'a optimize oluyor, purchase sayısı artmıyor. Çözüm: add-to-cart'ı primary conversion'dan çıkarmak + secondary olarak tutmak, bidding'i sadece purchase üzerine kurmak. Ayrıca purchase event'ine `value` parametresini doğru göndermek — müşteri 500 TL alışveriş yaptıysa `value: 500`, sabit `value: 1` yazmayın.

Meta'da Advantage+ Shopping Campaigns (ASC) ile benzer durum. ASC tüm katalogu bir kampanyada birleştiriyor, algoritma kreatif + kitle kombinasyonunu otomatik deniyor. Ama bu çalışması için quality signal gerekiyor: her purchase event'inde `content_ids` array'i + `contents` object'i doğru formatlanmalı. Bu veriler eksikse Meta hangi ürünün hangi kitle için optimize edileceğini bilemez, kampanya generic trafik çeker.

Bidding'de bir başka değişiklik: tCPA/tROAS hedefi artık haftalık adjustment ile yönetilemiyor. Platform günlük conversion hacmine göre learning döngüsü kuruyor (Google'da ~50 conversion/hafta), altında kalırsanız "limited by budget" uyarısı gelir, CPA tavan yapar. Yeni bir kampanya açtığınızda ilk 7-10 gün bidding stratejisini Maximize Conversions + manual CPC bid cap ile başlatmak daha sağlıklı. Signal kalitesi kurulduktan sonra Target ROAS'a geçin.

## Cross-channel orchestration ve signal deduplication

Performans pazarlaması artık tek-kanal oyunu değil. Kullanıcı Google'da görseli gördü, Instagram'da inceledi, email'deki indirimi gördü, siteden satın aldı. Bu customer journey'de 3 kanal var, ama conversion sadece 1 kez sayılmalı. Deduplication yapmadan rapor çıkarırsanız platform'lar toplamı 3x gösterir, management CFO'ya yanlış rakam sunar.

Signal deduplication iki noktada çözülür: platform-level ve data warehouse-level. Platform-level için her event'e `event_id` ve `event_time` parametresi gönderin. Meta, Google, TikTok aynı `event_id`'yi 48 saat içinde tekrar görürse duplicate sayar, conversion'ı bir kez işler. Ancak platform'lar birbirini görmez — Google'daki purchase, Meta'daki purchase'ı bilmez. Bu yüzden data warehouse'da merkezi bir attribution tablosu gerekiyor.

BigQuery veya Snowflake üzerinde customer journey tablo şeması:

```sql
CREATE TABLE attribution_log (
  user_id STRING,
  session_id STRING,
  event_timestamp TIMESTAMP,
  channel STRING,  -- google_ads, meta, email, organic
  campaign_id STRING,
  conversion_value FLOAT64,
  is_attributed BOOLEAN
);
```

Bu tabloya tüm channel event'leri akar. Sonra bir dbt model yazarsınız: her `user_id` + `conversion_timestamp` için ilk tıklanan ve son tıklanan kanalı tespit edersiniz (first-touch, last-touch). Bu model'i Looker Studio'ya bağlarsınız, management cross-channel ROAS'ı buradan görür. Platform dashboard'ları internal benchmark için kalır.

Cross-channel orchestration'da ikinci zorluk: remarketing audience senkronizasyonu. Kullanıcı Google Ads'ten gelip sepete ürün attı, ama satın almadı. Bunu Meta'da remarketing audience'e eklemek istersiniz. CDP (Segment, RudderStack, Hightouch) ile bunu otomatize edebilirsiniz: BigQuery'deki `cart_abandonment` segment'ini her gün Meta Custom Audience API'sine push edersiniz. Ancak dikkat: GDPR compliance için kullanıcıyı remarketing'e dahil etmeden önce consent durumunu kontrol edin. `consent_mode` v2 zorunlu — Google ve Meta her event'te ad_storage, analytics_storage consent flag'lerini bekler.

## Lifecycle stage bazında kampanya mimarisi

Funnel öldü, lifecycle stage yaklaşımı geldi. Kullanıcı artık lineer bir yolculuk izlemiyor: awareness → consideration → purchase. Bunun yerine döngüsel hareketler var: bir kez satın aldı, churn oldu, remarketing ile geri geldi, ikinci satın alma yaptı, referral verdi. Bu döngüyü modellemek için lifecycle stage bazında kampanya mimarisine ihtiyacınız var.

Roibase'de [dijital pazarlama](https://www.roibase.com.tr/tr/dijitalpazarlama) çalışmalarında kullandığımız lifecycle framework şöyle:

1. **Acquisition:** Cold traffic, prospecting, lookalike, in-market audience. Hedef: first-time visitor. Metrik: CPM, CTR, CPA.
2. **Activation:** İlk satın alma veya key action (signup, trial başlat). Hedef: conversion. Metrik: conversion rate, CPA.
3. **Retention:** Repeat purchase, subscription renewal. Hedef: LTV artışı. Metrik: repeat rate, churn.
4. **Referral:** Influencer işbirliği, affiliate, word-of-mouth. Hedef: organik growth. Metrik: referral rate, CAC offset.

Her stage için ayrı kampanya grubu açın, bidding hedefi farklı olsun. Acquisition kampanyasında Target CPA, Retention kampanyasında Target ROAS. Bu ayrımı yapmazsanız algoritma hepsini karıştırır, yüksek-LTV müşteri kazanmak yerine tek-seferlik alıcı toplar.

Lifecycle orchestration için automation kurmak gerekiyor. Örneğin: kullanıcı 30 gün satın alma yapmadıysa (churn riski), email + push + Meta remarketing'e otomatik eklensin. Bunu manuel yaparsanız gecikme olur, kullanıcı kaybeder. Hightouch, Census gibi reverse ETL araçları ile BigQuery → platform sync'i 15 dakikada bir çalışabilir. Bu hız kazandırır.

## Test disiplini ve incrementality ölçümü

Performans pazarlamasında test yapmadan optimizasyon yoktur. Ama 2026'da A/B testi platform dashboard'unda yapılmaz — holdout design ve causal inference gerekir. Platform size "yeni kreatif %20 daha iyi ROAS getirdi" diyorsa, bunu gerçekten bilebilmek için external validation şart.

En güvenilir yöntem geo-holdout test: ülkeyi coğrafi bölgelere ayırın (şehir, bölge), bir grupta kampanya çalıştırın, diğer grupta çalıştırmayın. Sonra satış verisini karşılaştırın. Eğer kampanya grubu %15 fazla satış yaptıysa, bu incrementality'dir — gerçek lift. Platform ROAS'ı bunu göstermez, çünkü organik traffic'i attribution'a dahil eder.

Geo-test yapamıyorsanız (düşük hacim, küçük market), matched-market MMM (Marketing Mix Modeling) kullanın. Bayesian regression ile geçmiş veriyi modellersiniz, her channel'ın marginal contribution'ını hesaplarsınız. Google Meridian, Meta Robyn gibi open-source MMM kütüphaneleri var. Ancak bu modelleri kurmak için veri bilimi ekibi veya harici danışmanlık gerekir — tek başınıza yapamazsınız.

Kreatif test için sample size hesabı şart. Meta'da 2 kreatif test edecekseniz, her birine en az 1000 impression + 50 conversion düşmeli ki istatistiksel anlamlı sonuç çıksın. Bunun altında test sonucu gürültüdür. Google Ads'te responsive search ads (RSA) kullanıyorsanız, her asset kombinasyonunun performansını görmek için 3000+ impression bekleyin. Platform erken "learning" diyorsa, test henüz sonuçlanmamıştır.

---

Performans pazarlaması artık pazarlamadan çok mühendislik. Signal mimarisi kurmak, probabilistic modeli kontrol etmek, cross-channel deduplication yapmak, lifecycle stage bazlı kampanya koşmak, incrementality ölçmek — bunlar yazılım altyapısı gerektirir. Platform'lara güvenmek yetmez, kendi attribution katmanınızı inşa etmelisiniz. 2026'da kazanan ekipler pazarlama + veri + mühendislik üçgenini doğru kuran ekipler.