---
title: "Bayesian A/B Test ile Hızlı Karar Verme"
description: "Frequentist testlerin sample size tuzağını aşın. Bayesian yaklaşım, sequential monitoring ve erken durdurma ile test süreçlerini 40-60% kısaltır."
publishedAt: 2026-05-30
modifiedAt: 2026-05-30
category: marketing
i18nKey: marketing-002-2026-05
tags: [ab-testing, bayesian-statistics, experimentation, conversion-optimization, statistical-inference]
readingTime: 8
author: Roibase
---

Performans pazarlamasında A/B test, hipotez yerine kanıta dayalı karar vermenin omurgası. Ama çoğu ekip hâlâ frequentist istatistiğin sabit sample size dogmasına takılı kalıyor: "Hesaplanan sayıya ulaşana kadar bakma, erken baktın mı bias yaratırsın." Bu yaklaşım, test süreçlerini gereksiz yere 3-4 haftaya uzatıyor. Bayesian A/B test, posterior probability ile sequential monitoring'e izin verir. Veriyi günlük okur, öncül bilgiyle birleştirir, belirli bir güven eşiğine (örn. 95% probability of being best) ulaştığında testi sonlandırırsın. Sonuç: aynı istatistiksel güvenirlikte, 40-60% daha kısa sürede karar vermek.

## Frequentist Yaklaşımın Yapısal Limitleri

Frequentist A/B test, p-value ve confidence interval üzerine kuruludur. Null hipotez anlamlılığını test edersin — "varyant A ile B arasında fark yok" varsayımını reddetmeye çalışırsın. Bu yaklaşımın temel sorunları:

**Sabit sample size zorunluluğu.** Power analizi yaparsın: baseline conversion rate 2%, minimum detectable effect (MDE) %10 relative lift, alpha 0.05, power 0.80 girersin. Hesaplanan sample size'a (örn. varyant başına 15.000 görüntülenme) ulaşana kadar test sürdürmek zorundasın. Erken baktığında ve durdurmaya karar verdiyse, multiple comparison problem devreye girer — false positive oranı alpha değerini (0.05) aşar. Pratikte: 2. günde %25 lift görüyorsun ama 3 hafta daha bekliyorsun çünkü "veri yeterli değil."

**Posterior uncertainty'yi ifade edememe.** P-value sana "bu kadar veya daha ekstrem bir sonucu null hipotez altında görme olasılığı" söyler. Ama asıl istediğin şey: "Varyant B'nin gerçekten daha iyi olma olasılığı nedir?" sorusuna yanıt. Frequentist framework bu soruya direkt yanıt vermez — p < 0.05 sadece null'u reddetme eşiğidir, B'nin üstünlüğünü olasılık olarak ifade etmez.

**Binary karar mekanizması.** P-value 0.049 ise "anlamlı", 0.051 ise "anlamsız" dichotomy'si. Gerçek dünyada belirsizlik bu kadar keskin değildir. 0.06'lık bir p-value'yu "marjinal kanıt var ama test uzatılmalı" şeklinde yorumlayamazsın — ya reddet ya kabul.

Bu yapısal limitler, özellikle [Dönüşüm Oranı Optimizasyonu](https://www.roibase.com.tr/ru/cro) süreçlerinde test velocity'sini düşürür. Haftada 1 test kapasitesi yerine 2-3 hipotez iterasyonu döndürebilecekken, sample size kuralına takılı kalıyorsun.

## Bayesian Test: Posterior Probability ve Sequential Monitoring

Bayesian yaklaşım, parametreyi (conversion rate) sabit bir sayı yerine olasılık dağılımı olarak ele alır. Prior belief (öncül bilgi) + observed data → posterior distribution (güncellenmiş inanç). Matematiksel detay:

**Prior distribution:** Baseline conversion rate'ine dair öncül inancın. Eğer hiçbir bilgin yoksa uniform prior (Beta(1,1)) kullanırsın — tüm değerlere eşit olasılık. Eğer geçmiş testlerden "conversion rate genelde 1.5-2.5% arası" biliyorsan, informative prior (Beta(15, 985)) tanımlarsın.

**Likelihood:** Gözlemlediğin veri — 1000 görüntülenme, 25 conversion gibi.

**Posterior:** Bayes teoremi ile güncellenen dağılım. Beta-binomial conjugate pair kullanılırsa posterior analitik olarak çözülür: `Beta(alpha + conversions, beta + non_conversions)`.

**Decision rule:** Varyant A ve B'nin posterior dağılımlarını Monte Carlo simülasyon ile sample'larsın (örn. 100.000 iterasyon). Her iterasyonda B'nin A'dan yüksek çıkma oranını sayarsın. Bu oran "B'nin kazanma olasılığı" (P(B > A)). Eğer bu olasılık %95'i geçerse, testi durdurur ve B'yi seçersin.

**Sequential monitoring:** Bayesian framework, her gün posterior'u yeniden hesaplamanıza izin verir. Frequentist'teki "peeking" problemi yok — posterior güncelleme Bayesian inference'ın doğal parçası. Her sabah dashboard'u açtığında güncel P(B > A) değerini görürsün: %65 → %78 → %89 → %94 → %96. %95 eşiğini geçtiğinde testi sonlandırırsın.

Pratikte: baseline 2% conversion rate, %10 relative lift (yani 2.2%) hedefi, %95 güven eşiği. Frequentist test 15.000 varyant başı sample istiyor (toplam 21 gün). Bayesian test 9-12 günde aynı eşiği yakalayabiliyor — çünkü prior bilgi sayesinde daha az veri ile posterior sharp hale geliyor.

### Örnek Simülasyon Kodu (Python)

```python
import numpy as np
from scipy.stats import beta

# Prior: Beta(1, 1) — uniform
alpha_a, beta_a = 1, 1
alpha_b, beta_b = 1, 1

# Observed data (5. gün)
views_a, conv_a = 5000, 95
views_b, conv_b = 5000, 112

# Posterior
post_a = beta(alpha_a + conv_a, beta_a + views_a - conv_a)
post_b = beta(alpha_b + conv_b, beta_b + views_b - conv_b)

# Monte Carlo: P(B > A)
samples_a = post_a.rvs(100000)
samples_b = post_b.rvs(100000)
prob_b_wins = (samples_b > samples_a).mean()

print(f"P(B > A) = {prob_b_wins:.3f}")
# Output örn.: P(B > A) = 0.923 → henüz %95 altı, teste devam
```

## Sample Size Dinamiği ve Erken Durdurma Kriteri

Bayesian test'in hız avantajı, dinamik sample size'dan gelir. Sabit N hedefi yerine, stopping rule'u posterior confidence'a bağlarsın. İki yaygın kriter:

**Probability threshold:** P(B > A) ≥ 0.95 ise dur. Bu, "B'nin gerçekten daha iyi olma olasılığı %95" anlamına gelir. Bazı ekipler %99 kullanır (daha konservatif), bazıları %90 (daha agresif — test velocity için).

**Expected loss:** B'yi seçtiğinde, eğer gerçekte A daha iyiyse kaybın ne olur? Expected loss = E[max(0, A - B)]. Eğer bu kayıp kabul edilebilir düzeyde düşükse (örn. < 0.0001 absolute conversion rate farkı), testi sonlandırırsın. Bu metrik, "yanlış karar vermenin bedeli" perspektifiyle risk yönetimi sağlar.

**Minimum sample floor:** Tamamen erken durdurmanın önüne geçmek için "minimum 3000 sample topla, ondan sonra Bayesian stopping rule'a bak" kuralı koyarsın. Bu, prior'ın aşırı dominant olmasını önler.

Örnek senaryo: E-ticaret checkout CTA renk testi (yeşil vs. turuncu). Baseline 3.2% conversion. 1. hafta 8000 view, P(turuncu > yeşil) = %87. 2. hafta 16.000 view, P = %94. 3. haftanın 2. günü (toplam 18.500 view), P = %96. Frequentist rule 25.000 view isterdi (toplam 18 gün), sen 10. günde durdurdun. Test süresini %44 kısalttın.

Tradeoff: Erken durdurma, bazı durumlarda "şans eseri iyi başlayan ama regrese eden" varyantı seçme riskini artırabilir. Bunu azaltmak için: (1) minimum sample floor koy, (2) effect size küçükse (örn. %5 relative lift) threshold'u %99'a çıkar, (3) posterior'un standart sapmasını izle — eğer hâlâ geniş ise (yüksek uncertainty), daha fazla veri topla.

## Prior Seçimi ve Bilgi Kümülasyonu

Bayesian test'in gücü, prior bilgiyi formalize etmekten gelir. Ama yanlış prior seçimi bias yaratabilir. İki ekstrem:

**Non-informative prior (Beta(1,1)):** Hiçbir öncül bilgi yok varsayımı. Her test tabula rasa başlar. Avantaj: tarafsız. Dezavantaj: posterior'ı sharp hale getirmek için daha fazla veri gerekir — frequentist'e yakın sample size.

**Informative prior (Beta(α, β)):** Geçmiş testlerden, sektör benchmarklarından veya baseline'dan bilgi taşırsın. Örnek: "CTA button testlerinde conversion rate genelde 2-4% arası, ortalama 2.8%" diyorsan, Beta(28, 972) prior tanımlarsın (ortalama 2.8%, variance uygun).

Informative prior kullanımı, test süresini kısaltır çünkü prior + yeni veri daha hızlı convergence sağlar. Ama risk: prior yanlışsa (örn. eski bir vertical'dan kopyaladın, yeni segment farklı), posterior bias'lı olur. İki koruma:

**Prior sensitivity analizi:** Testi farklı prior'larla (zayıf, orta, güçlü informative) çalıştırıp sonuçların değişip değişmediğini test et. Eğer sonuç prior'a aşırı duyarlıysa (örn. weak prior ile %60, strong prior ile %98 kazanma olasılığı), o testi uzat — veri henüz prior'ı override edemiyor.

**Hierarchical prior:** Eğer birden fazla segment test ediyorsan (mobile vs. desktop, ülke bazlı), hierarchical Bayesian model kullan. Her segment kendi conversion rate'ine sahip, ama global prior population mean'den shrink edilir. Bu, segment-level over-fitting'i azaltır.

Pratik öneri: İlk 5-10 test non-informative prior ile koş, sonuçları topla, ortalama ve variance'ı hesapla, sonraki testlerde bunu informative prior olarak kullan. Bu "meta-learning" yaklaşımı, kümülatif test bilgisini hafızaya alır.

## Organizasyonel Entegrasyon ve Karar Protokolü

Bayesian A/B test'i ekip kültürüne entegre etmek teknik değil organizasyonel bir mesele. Frequentist'e alışmış bir ekibe "artık her gün bakabilirsiniz" dediğinde ilk tepki karışık olur: "P-value nerede?" İki adım:

**Eğitim + onboarding:** P(B > A) metriğinin ne anlama geldiğini açıkla. "95% olasılıkla B daha iyi" cümlesini rahatça kurabilirler. Frequentist'teki "p < 0.05 yani null reddedildi" indirection yerine direkt karar dili. İlk 2-3 test paralel koştur — hem frequentist hem Bayesian analiz yap, karşılaştır. Ekip farkı görünce adoption artar.

**Decision threshold standardizasyonu:** Hangi olasılık eşiğinde testi durduruyorsun? %95 mi %99 mu? Bu, risk toleransına bağlı. Yüksek traffic + düşük risk kararlar (örn. email subject line) → %90 yeterli. Düşük traffic + yüksek maliyet kararlar (örn. pricing page redesign) → %99 kullan. Bu threshold'ları test playbook'a yaz.

**Post-test monitoring:** Testi durdurdun, B'yi kazanan ilan ettin. Ama B'yi full rollout yaptıktan 2 hafta sonra conversion rate düştü — regression to mean veya external factor (kampanya, mevsimsellik). Bayesian test bu riski azaltır ama tamamen önlemez. Çözüm: rollout sonrası 1 hafta monitoring, eğer posterior mean %10'dan fazla düşerse rollback trigger'la.

**Tooling:** Google Optimize Bayesian modu sunuyor ama sınırlı. VWO, Optimizely kısmen destekliyor. Custom stack istiyorsan: Python (PyMC3, ArviZ) + BigQuery + Looker dashboard. Her sabah Airflow job posterior'ları günceller, Looker'da P(B > A) metriği gösterilir. Eşik aşıldığında Slack alert.

---

Bayesian A/B test, test velocity artırır ama istatistiksel disiplin gerektirir. Sample size zorunluluğunu sequential monitoring ile aşarsın, ama prior seçimi ve stopping rule'u dikkatli tanımlamalısın. Organizasyonuna Bayesian adoption'ı kademeli yap — ilk 10 test non-informative prior ile paralel koş, ekip güvendiğinde informative prior + erken durdurma modeline geç. Son