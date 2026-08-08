---
title: "Performans Pazarlamasının Yeni Çağı"
description: "Cookie sonrası dünyada performans pazarlaması artık mühendislik disiplini gerektiriyor. Signal mimarisi, server-side tracking ve test altyapısı olmadan başarı yok."
publishedAt: 2026-08-08
modifiedAt: 2026-08-08
category: marketing
i18nKey: marketing-008-2026-08
tags: [performans-pazarlamasi, server-side-tracking, attribution, signal-mimarisi, post-cookie]
readingTime: 8
author: Roibase
---

Cookie'ler öldü, performans pazarlaması ölmedi. Google'ın 3P cookie deprecation'ı 2024'te geri çekmesine rağmen Safari, Firefox ve düzenleyiciler zaten oyunu değiştirdi. 2026'da %60'tan fazla tarayıcı trafiği 3P cookie'leri zaten blokluyor (Statcounter 2026 verisi). iOS 17'nin Mail Privacy Protection ve App Tracking Transparency kısıtlamaları, Meta'nın %40+ iOS kullanıcı tabanında piksel sinyalini körleştirdi. Eski performans pazarlaması modeli — tarayıcıda oturmuş cookie, kampanyaya son tıklama atfı, otomatik bidding — bu bağlamda çalışmıyor. Yeni çağ mühendislik disiplini gerektiriyor: first-party veri altyapısı, server-side event stream, çok kanallı attribution stack. Bu makalede performans pazarlamasının post-cookie mimarisini, signal toplama stratejilerini ve test altyapısının neden zorunlu olduğunu ele alıyoruz.

## Cookie Sonrası Attribution Stack

Attribution artık tarayıcı cookie'sine güvenmiyor. Google Ads ve Meta API'leri server-side conversion sinyali bekliyor — tarayıcının göndereceği veriyi değil, sunucunun doğruladığı event'i. Meta'nın Conversions API (CAPI) ve Google'ın Enhanced Conversions yapısı bu sinyali toplamak için tasarlandı. Ama çoğu şirket hâlâ piksel + cookie mantığıyla çalışıyor, sonuç: %30-50 conversion loss (Meta internal benchmark, Q1 2026).

Server-side tracking mimarisi şu bileşenlere dayanıyor: tarayıcıda hafif bir event collector (dataLayer push), server tarafında event router (Google Tag Manager Server-Side veya Segment), ve hedef platformlara event relay (Meta CAPI, Google Ads API, GA4 Measurement Protocol). Bu akış [first-party veri mimarisi](https://www.roibase.com.tr/tr/dijitalpazarlama) olmadan kurulamaz — event'in hash'lenmiş kullanıcı ID'si, transaction ID'si ve timestamp'i olmak zorunda. Hash'leme client-side yapılırsa GDPR sorunlu, server-side yapılırsa safe. Attribution window da artık client'ta değil server'da tanımlanıyor: Meta 7 gün click + 1 gün view'i default olarak bekliyor ama sGTM üzerinden 28 günlük window gönderebiliyorsun.

Implementasyon sırası kritik. Önce dataLayer'ı normalize et — her event'in `event_name`, `user_id`, `value`, `currency` parametreleri olsun. Sonra sGTM container'ı kur, event'i relay et, Meta Events Manager'da test et. Eğer %95+ event match rate görüyorsan signal düzgün. %70 altı = hash problemi veya timestamp drift. Test için Meta'nın Event Diagnostics ekranını kullan — real-time event matching görüyorsun.

## Bidding Stratejilerinin Değişimi

Google Performance Max ve Meta Advantage+ kampanyaları algoritmik bidding kullanıyor — CPA veya ROAS hedefi veriyorsun, algoritma creative + audience kombinasyonunu optimize ediyor. Bu model işe yarıyor — ama sadece signal quality yüksekse. 2025 Google Ads benchmark: %90+ conversion tracking coverage'ı olan hesaplarda PMax %18 daha yüksek ROAS veriyor (Google internal, restricted access data).

Sorun şu: algoritmik bidding black box değil, feedback loop. Sen conversion sinyali göndermezsen algoritma öğrenemiyor. Kampanya ilk 50 conversion'a kadar "learning phase"de — bu sürede CPA volatil. Eğer conversion volume düşükse (haftada 15'ten az), algoritma asla stable hale gelmiyor. Çözüm: value-based bidding yerine conversion count bidding kullan veya micro-conversion'ı sinyal olarak ver (add-to-cart, lead form submit).

Creative'in rolü de değişti. Meta'nın 2026 benchmarkı: video creative %22 daha yüksek CTR veriyor ama static image %30 daha düşük CPA'ya dönüşüyor (Meta Ads Benchmarks Q2 2026). Sebep: video trafik çekiyor ama intent kalitesi düşük, image niche audience'ı filtreliyor. Bu yüzden creative testing structured olmalı — her hafta 3 varyasyon test et, kazananı scale et. A/B test değil, sequential testing: bir creative 500 impression alıyor, CTR %1 altıysa durdur, %2 üstüyse devam.

### Budget Allocation ve Cross-Channel Orkestrasyon

Multi-channel budget allocation artık spreadsheet'te değil data pipeline'da yapılıyor. Google Ads + Meta + TikTok'u tek dashboard'da yönetmek için Supermetrics veya custom BigQuery ETL kullanıyorsun. Her kanal için ROAS threshold tanımlıyorsun: Google Shopping min. 4x, Meta prospecting min. 3x, TikTok min. 2.5x. Eşiği geçemeyenin budget'ı ertesi gün %20 düşüyor, geçenin %20 artıyor.

Cross-channel attribution için last-click yerine data-driven model kullan — Google Analytics 4'ün DDA modeli veya custom Markov chain. Bu modeller touchpoint sırasını dikkate alıyor: kullanıcı önce Google'dan gelmiş, ertesi gün Meta remarketing'den dönüş yapmış, son tıklama branded search. Last-click branded search'e 100% atfediyor, ama asıl iş Meta'nın remarketing'i. DDA bu katkıyı %40 Meta, %40 branded, %20 ilk tıklama olarak dağıtıyor.

## Signal Quality ve Test Altyapısı

Signal quality artık kampanya başarısının bottleneck'i. Meta'nın Event Match Quality (EMQ) skoru var — %60 altı kötü, %80 üstü iyi. EMQ düşükse sebepleri şunlar: hash'leme algoritması yanlış (SHA-256 yerine MD5), email adresi normalize edilmemiş (büyük harf/küçük harf), telefon numarası ülke kodu eksik. Bunları düzeltmek için Meta Pixel Helper yerine sGTM'de custom validation logic kur — event gitmeden önce kontrol et.

Test altyapısı da artık kampanya dışında kurulu olmalı. Incrementality test için geo-based holdout kullan: ABD'de 10 eyaleti kampanya dışı tut, diğer 40'ta kampanya yayınla, 4 hafta sonra holdout eyaletlerin organic growth'u ile kampanyalı eyaletlerin growth'unu karşılaştır. Fark = incremental lift. Google'ın Conversion Lift Study'si bunu otomatize ediyor ama sadece display kampanyalarda çalışıyor. Search için custom geo-test gerekiyor.

Creative testing için Bayesian A/B framework kullan — frequentist t-test yerine. Bayesian daha erken karar vermenizi sağlıyor: 200 impression'da %95 güvenle kazanan tespit edilebiliyor. Code: Python'da `scipy.stats.beta` kullan, her creative için prior beta distribution tanımla (alpha=1, beta=1), her impression conversion olursa alpha artır, olmazsa beta artır. İki distribution'ın overlap'i %5 altı = kazanan belli.

```python
from scipy.stats import beta
import numpy as np

# Creative A: 150 impression, 9 conversion
# Creative B: 150 impression, 15 conversion

alpha_A, beta_A = 1 + 9, 1 + (150 - 9)
alpha_B, beta_B = 1 + 15, 1 + (150 - 15)

samples_A = beta.rvs(alpha_A, beta_A, size=10000)
samples_B = beta.rvs(alpha_B, beta_B, size=10000)

prob_B_better = np.mean(samples_B > samples_A)
print(f"B'nin daha iyi olma olasılığı: {prob_B_better:.2%}")
# Output: %87 → henüz %95 değil, test devam
```

## Platform-Spesifik Sinyal Mimarisi

Google Ads Enhanced Conversions ile Meta CAPI farklı sinyal bekliyor. Google email hash + phone hash + address hash istiyor (PII matching için), Meta sadece email hash + external_id yeterli görüyor. Aynı event'i iki platforma göndermek için sGTM'de iki ayrı tag kur — her tag platformun beklediği parametreyi map'lesin.

TikTok Events API da farklı yaklaşımla geliyor: `event_id` parametresi zorunlu (deduplication için), ama Meta'daki gibi `fbp` cookie'si yok, `ttclid` URL parameter'ı kullanıyor. TikTok attribution window 7 gün click-only — view-through yok. Bu yüzden TikTok'ta video view metriği yanıltıcı — conversion'a dönüşmeyen view'ler budget waste.

LinkedIn Conversions API da 2025'te geldi — ama sadece lead gen kampanyalarda çalışıyor, e-commerce'te henüz yok. LinkedIn sinyali email domain'e dayalı (B2B), hash'leme yerine domain matching kullanıyor. Örneğin `john@acme.com` → `acme.com` → LinkedIn'deki Acme çalışanlarıyla eşleşiyor. Bu B2B için güçlü ama privacy riski taşıyor — GDPR'da explicit consent gerekiyor.

### Retention ve Lifecycle Signalleri

Performans pazarlaması artık sadece acquisition değil, retention de kapsıyor. Google Ads'te Customer Match audience'ı için LTV sinyali gönderebiliyorsun — ilk 30 gün LTV $100'ün üstündeki müşterileri "high-value" segment'ine ekleyip remarketing yapıyorsun. Bu sinyal için CRM'den cohort analizi gerekiyor: her cohort'un Day 7, Day 30, Day 90 retention rate'i ne, average LTV ne. Shopify'da bunu Klaviyo ile otomatize edebiliyorsun — Klaviyo segment'i sGTM'ye event olarak gönderiyor, sGTM Google Ads Customer Match API'sine relay ediyor.

Meta'da Lifetime Value Optimization (LVO) bidding var — algoritma ilk conversion'da değil 180 günlük LTV'de optimize ediyor. Ama bu işe yaraması için %70+ müşterinin en az 2 purchase yapması gerekiyor. E-commerce'te bu %30-40 aralığında (Shopify 2025 benchmark), bu yüzden LVO sadece subscription veya repeat-heavy vertical'lerde çalışıyor (kozmetik, supplement, pet food). Tek satışlık ürünlerde (mobilya, elektronik) LVO overspend yapıyor — CPA 2x artıyor ama LTV artmıyor.

## Mühendislik Disiplini Olarak Pazarlama

Performans pazarlaması artık creative + budget kararı değil, veri altyapısı + test framework + signal mimarisi. Kampanya kurmadan önce şu sorular yanıtlanmalı: event schema tanımlı mı, sGTM production'da mı, Meta EMQ %80 üstü mü, test için holdout segment var mı, attribution model hangi touchpoint'leri görüyor. Bu soruların cevabı yoksa kampanya başlatma — signal kaybı budget kaybından daha pahalı.

Şirketler artık growth engineering ekibi kuruyor — pazarlamacı + data engineer + analytics engineer. Pazarlamacı stratejiyi belirliyor, data engineer event pipeline'ı kuruyor, analytics engineer attribution modelini yazıyor. Bu üçlü olmadan post-cookie dünyada scale edemezsin. 2026'da performans pazarlamasında başarılı olan şirketler creative'i değil altyapıyı fark yaratan şirketler.