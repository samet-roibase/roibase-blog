---
title: "ASO Creative Testing: PPO ile 6 Hafta İçinde +%32 IPM"
description: "Custom Product Pages ve Play Experiments ile install-per-mille artışını ölçeklemek. Statistical significance, sample size, winning variant deployment."
publishedAt: 2026-05-08
modifiedAt: 2026-05-08
category: gaming
i18nKey: gaming-001-2026-05
tags: [aso, creative-testing, custom-product-pages, play-experiments, ipm-optimization]
readingTime: 7
author: Roibase
---

Mobile gaming'de organic traffic'in %70'i store listing'den gelir. Listing'in conversion rate'ini artırmak acquisition cost'u düşürür, paid campaign'lerin ROAS'ını yükseltir. Custom Product Pages (CPP) ve Play Experiments bu optimization'ın mühendislik tarafı — tahmin yerine test, görüş yerine statistical significance. 6 haftalık bir test döngüsünde +%32 install-per-mille (IPM) artışı sağlamak mümkün, ama bunun için creative hypothesis'inizi data architecture'a bağlamanız gerekiyor.

## Custom Product Pages: Store Listing'i Segmente Etmek

Apple App Store'un Custom Product Pages (CPP) özelliği, tek bir app için farklı store page variant'ları sunmanıza izin verir. Her variant farklı icon, screenshot seti, preview video kombinasyonuna sahip olabilir. Google Play'deki karşılığı ise Play Store Listing Experiments — benzer mantık, farklı terminoloji.

CPP'nin gücü segmentasyon'da. Örneğin bir idle RPG geliştiriyorsunuz: casual player'lar için "relax & collect" mesajı taşıyan bir variant, hardcore grinder'lar için "competitive leaderboard" vurgulu bir variant oluşturabilirsiniz. Bu variant'ları Apple Search Ads'te campaign-level'da seçebilir, farklı keyword group'larına farklı landing experience sunabilirsiniz.

Statistical significance burada kritik. Apple, CPP test sonuçlarını 90% confidence interval'de raporlar. Yani "Variant B, %25 daha iyi convert ediyor" derken aslında şunu söyler: "Bu farkın rastlantısal olma olasılığı %10'un altında." Sample size yeterli değilse (genellikle variant başına <1000 impression), sonuç güvenilir olmaz. 6 haftalık test periyodu, Tier-1 market'lerde orta ölçekli bir oyun için bu threshold'u geçmek için gerekli minimum süredir.

### Test Framework: Hypothesis → Variant → Metric

CPP testing'i başarılı kılmak için önce creative hypothesis kurmalısınız. "Daha parlak renkler daha iyi çalışır" hypothesis değildir — bu görüştür. Geçerli hypothesis: "Tier-1 kullanıcılar, character progression'ı vurgulayan screenshot'larda %15+ IPM gösterir, çünkü Search Ads veri setimizde 'level up' keyword'ü %8.3 CTR ile en yüksek performer." Bu hypothesis'e göre 3 variant tasarlarsınız:

1. **Control:** Mevcut default listing
2. **Variant A:** Character progression + loot system odaklı screenshot sıralaması
3. **Variant B:** PvP + leaderboard odaklı screenshot sıralaması

Her variant için separate Apple Search Ads campaign açarsınız (veya Google App Campaigns'te store listing experiment ID'lerini bağlarsınız). 6 hafta boyunca traffic split edersiniz: %40 control, %30 Variant A, %30 Variant B. Bu split, control'ün baseline stability'sini korurken yeni varyantlara yeterli sample size verir.

## Statistical Significance: Sample Size ve Test Süresi

Mobile ASO testing'de en yaygın hata, test'i erken sonlandırmaktır. İlk 1000 impression'da Variant A %18 daha iyi convert ediyorsa, hemen kazanan ilan edilir. Ama bu 1000 impression rastgele bir hafta sonuna, bir seasonal event'e veya belirli bir geo'nun time zone'una denk gelmiş olabilir.

Statistical significance hesaplaması şu formülle başlar:

```
n = (Z^2 * p * (1-p)) / E^2

n = gerekli sample size
Z = confidence level (90% için 1.645)
p = expected conversion rate
E = margin of error (genellikle 0.05)
```

Örneğin mevcut IPM %3.2 ise (p=0.032), %5 hata payı ile 90% confidence için variant başına ~1900 impression gerekir. Günlük 500 organic impression alan bir oyun için bu 4 günlük test demektir. Ama gerçek dünyada traffic dalgalanır: hafta sonu %40 artabilir, feature'lı olduğunuz bir günde spike'lar görürsünüz. Bu nedenle minimum 4 haftalık test süresi önerilir — bu süre içinde en az 2 hafta sonu, 1 ay ortası anomali ve normal günlerin dengesi yakalarız.

Play Experiments'te Google otomatik sample size hesaplaması yapar ve test "statistically significant" olduğunda sizi bilgilendirir. Ama bu threshold, conversion rate improvement'ın büyüklüğüne bağlıdır. %5'lik bir iyileşmeyi detect etmek, %25'lik bir iyileşmeyi detect etmekten çok daha fazla sample ister. 6 haftalık döngü, orta-büyük effect size'lar için (>%15 improvement) güvenli bir aralıktır.

## Winning Variant'ı Deploy Etmek: Iteration ve Rollout

Test sonuçları geldiğinde iki olasılık var: ya belirgin bir kazanan vardır (%90 confidence ile %20+ improvement), ya da sonuçlar inconclusive'dur (varyantlar arasındaki fark margin of error içinde).

Kazanan scenario'da deployment stratejisi şu şekilde olmalı:

| Adım | Zaman | Aksiyon |
|------|-------|---------|
| 1. Validation | 1 hafta | Winning variant'ı %100 traffic'e aç, baseline IPM'i izle |
| 2. Paid sync | 3 gün | Apple Search Ads ve UAC campaign'lerinde yeni variant'ı default listing yap |
| 3. Secondary metrics | 2 hafta | D1 retention, D7 ARPU, churn rate'te regression var mı kontrol et |

Kritik nokta: IPM artışı her zaman net positive değildir. Eğer winning variant, oyunun core loop'unu yanlış tanıtan bir creative axis kullanıyorsa, install quality düşer. Örneğin "puzzle" vurgulu bir listing, casual user'ları çeker ama oyun aslında hardcore idle mekanik içeriyorsa, D1 retention %22'den %18'e düşer. Bu durumda IPM +%32 olsa bile net LTV negatif etki görür.

Bu yüzden deployment sonrası 2 haftalık "secondary metrics monitoring" şarttır. Bu pencerede cohort-based retention analizi yaparsınız: yeni listing'den gelen kullanıcıların D7 retention'ı,eski cohort'lara göre nasıl? ARPU'da anormal düşüş var mı? Churn model'iniz (örneğin Cox proportional hazards) bu yeni cohort için farklı coefficient veriyor mu?

## Iteration Cycle: Creative Backlog ve A/A Test

ASO creative testing tek seferlik bir aktivite değil, sürekli iteration cycle'ıdır. Winning variant deploy edildikten sonra, yeni hypothesis'ler için creative backlog oluşturulur. Bu backlog, üç kaynaktan beslenir:

1. **User research:** App review'lar, support ticket'lar, in-game survey'ler (örneğin "Oyunu neden indirdiniz?" sorusu)
2. **Competitive intelligence:** Kategori liderleri hangi creative angle kullanıyor, hangi message hierarchy'si var
3. **Performance data:** Hangi keyword'ler yüksek CVR veriyor ama düşük impression payı alıyor (expansion fırsatı)

Her 6-8 haftada bir yeni test döngüsü başlatılır. Ama her döngüde A/A test de koşturulmalıdır: iki identik variant karşılaştırılır, sonuçlar arasında fark çıkmaması beklenir. Eğer A/A test'te %10+ sapma görürseniz, traffic split mekanizmanızda veya tracking setup'ınızda sorun var demektir. Bu durumda sonuçlara güvenemezsiniz — önce measurement integrity'yi düzeltmeniz gerekir.

Roibase'in [App Store Optimization](https://www.roibase.com.tr/tr/aso) çalışmalarında CPP testing'i attribution pipeline'a entegre ediyoruz: her variant için ayrı postback URL, cohort-level LTV modeling, churn prediction. Bu sayede "IPM +%32" rakamı, "net LTV +%18" gibi business outcome'a translate ediliyor.

## Tier-1 vs Emerging Market Dynamics

Son olarak, creative testing stratejisi geo-specific olmalıdır. Tier-1 market'lerde (US, UK, JP, KR) kullanıcılar store listing'i detaylı inceler — 5 screenshot'ın tamamına bakar, video preview izler, review score'a önem verir. Bu nedenle creative hierarchy önemlidir: ilk 2 screenshot en kritik message'ı taşımalı, video ilk 3 saniyede hook vermelidir.

Emerging market'lerde (LATAM, SEA, MENA) ise data cost yüksek olduğu için kullanıcılar preview video indirmez, screenshot'ları hızlı swipe eder. Burada icon ve ilk screenshot'ın görsel impact'i daha ağır basar. Ayrıca, bu geoları Tier-1 ile aynı test'e dahil ederseniz, sonuçlar skewed olabilir — çünkü user behavior pattern'leri farklıdır.

Öneri: Her geo cluster için separate test koşturun, ya da test'i sadece Tier-1'de yapıp winning insight'ı (örneğin "progression vurgusu conversion artırıyor") emerging market'lere adapt edin (daha az text, daha bold visual).

---

Creative testing'de başarı, hypothesis discipline'ine ve measurement rigor'ına bağlı. IPM artışı ancak secondary metrics (retention, LTV, churn) ile birlikte değerlendirildiğinde net positive outcome verir. 6 haftalık iteration cycle, bu derinlikte bir analizi mümkün kılan minimum süre. Statistical significance threshold'unu geçemeyen testler tekrarlanmalı, inconclusive sonuçlar discard edilmeli. ASO, growth engineering'in app store versiyonu — tahmin yerine test, görüş yerine coefficient.