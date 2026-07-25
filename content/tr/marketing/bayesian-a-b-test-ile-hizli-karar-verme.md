---
title: "Bayesian A/B Test ile Hızlı Karar Verme"
description: "Frequentist testlerin zaman kaybını Bayesian yaklaşımla aşın. Sequential test, posterior probability ve dinamik sample size ile A/B testleri 3x hızlandırın."
publishedAt: 2026-07-25
modifiedAt: 2026-07-25
category: marketing
i18nKey: marketing-002-2026-07
tags: [ab-testing, bayesian-statistics, conversion-optimization, statistical-inference, growth-engineering]
readingTime: 7
author: Roibase
---

Performans pazarlamasında hız kazanmak istiyorsanız A/B testlerinizi yanlış yöntemle yapıyor olabilirsiniz. Klasik frequentist testler sabit sample size ve fixed-horizon mantığıyla çalışır: testi başlattınız, 2-4 hafta bekliyorsunuz, p-value eşiğine ulaşana kadar dokunmuyorsunuz. Bu süreçte winning variant zaten belli olsa bile karar veremiyorsunuz. Bayesian yaklaşım bu kilit noktayı değiştirir: posterior probability ile her an kararı değerlendirebilir, sequential testing yapabilir, sample size'ı dinamik tutabilirsiniz. Google Optimize'ın Bayesian motorunu kapatması bu yöntemi öldürmedi, tersine kendi stack'inize entegre etmenin önünü açtı.

## Frequentist testlerin zaman tuzağı

Klasik A/B test mantığı şu varsayımla çalışır: p-value 0.05'in altına düşene kadar test devam etmeli, intermediate peek (ara kontrol) yaparsanız false positive riski artar. Bu teorik olarak doğru ama pratikte iki sorunu tetikler. Birincisi: testi erken durdurmak istediğinizde statistical guardrail olmadığı için yanlış karar riskiniz var. İkincisi: winning variant erken belli olsa bile sabit sample size tamamlanana kadar beklemek zorundasınız — bu süre ortalama 14-21 gün arası değişir.

Bu yaklaşımın arkasında Neyman-Pearson hipotez test çerçevesi var: null hypothesis reddetme veya kabul etme kararını tek bir threshold (genelde α=0.05) üzerinden veriyorsunuz. Problem şu: bu threshold sabit sample size hesabına bağlı, dolayısıyla test sürecinde dinamik karar vermenize izin vermiyor. Örneğin variant B %18 dönüşüm gösteriyorken kontrol %12'de kalıyorsa ve bu fark 500 kullanıcı sonrasında ortaya çıkmışsa, frequentist framework "daha bekle, planlanan 2000 kullanıcıya ulaşmadın" diyor.

Mobil app testlerinde bu sorun daha da keskinleşir. Daily active user (DAU) 5000 olan bir uygulamada %2 uplift tespit etmek için gereken sample size ~8000 kullanıcı demektir — bu 2 hafta anlamına gelir. Ama winning signal 3. günde zaten ortaya çıkmışsa 11 gün boyunca losing variant'a trafik gönderiyorsunuz. Bu dönemde bıraktığınız para kazanç fırsatıdır (opportunity cost).

## Bayesian yaklaşım: posterior probability ile sürekli güncelleme

Bayesian istatistik farklı bir soru sorar: "Bu varyantın kontrol grubundan iyi olma olasılığı nedir?" Cevap bir p-value değil, posterior probability distribution'dır. Her yeni veri noktasında (her yeni kullanıcıda) prior belief'i güncelleyerek posterior'u yeniden hesaplıyorsunuz. Bu sayede "variant B'nin dönüşüm oranının %95 olasılıkla kontrol grubundan yüksek olduğunu" söyleyebiliyorsunuz — ve bu ifade sequential testing'e izin veriyor.

Matematiksel olarak Bayes teoremi şu formülle çalışır:

```
P(θ|data) = P(data|θ) × P(θ) / P(data)
```

Burada `θ` dönüşüm oranı (conversion rate), `P(θ)` prior (başlangıç inancınız), `P(data|θ)` likelihood (gözlemlenen verinin θ altında olasılığı), `P(θ|data)` ise posterior (güncel inancınız). Örneğin prior olarak Beta(1,1) — yani uniform distribution — kullanıyorsanız, her dönüşüm `α` parametresini +1, her bounce `β` parametresini +1 artırıyor. 100 ziyaretçi, 18 dönüşüm = Beta(19, 83). Bu posterior distribution'ı kontrol grubunun posterior'u ile karşılaştırarak "B > A olma olasılığı" hesaplıyorsunuz.

Chris Stucchio'nun 2015 VWO makalesi bu mantığı production'a taşıyan ilk case study'lerden biriydi: aynı testi Bayesian ile çalıştırdığınızda ortalama %40 daha hızlı sonuç alıyorsunuz çünkü erken durdurma riski kontrol altında. Google'ın internal experimentation framework'ü de 2018'den itibaren Bayesian posterior'ları intermediate metric olarak kullanmaya başladı (public documentation yok ama Kohavi et al. kitabında bahsedilir).

### Sequential testing ve stopping rule

Bayesian yaklaşımın en büyük avantajı sequential testing yapabilmeniz. Frequentist'te ara kontrolde p-value hesaplamak Type I error'ü şişirir (multiple comparison problem). Bayesian'da posterior probability her zaman geçerli bir metric çünkü sürekli güncellenen bir belief state. Bu sayede her gün "posterior probability of B > A" kontrol edebilir, %95'i geçtiğinde testi durdurabilirsiniz.

Stopping rule şöyle işler:

1. Minimum sample size tanımlayın (örn. variant başına 200 kullanıcı — erken noise'u filtrelemek için)
2. Her gün posterior'ları güncelleyin
3. `P(variant_B > control) > 0.95` olduğunda testi durdurun
4. 14 gün sonunda %95'e ulaşmadıysanız "inconclusive" olarak işaretleyin

Bu yaklaşımı [Dönüşüm Oranı Optimizasyonu](https://www.roibase.com.tr/tr/cro) süreçlerimizde kullanıyoruz: test başlangıcında prior belirleme, her gün otomatik posterior güncelleme, stopping rule threshold'u mühendislik ekibiyle birlikte belirleme. Örneğin e-ticaret checkout flow testinde %95 yerine %98 threshold kullanıyoruz çünkü false positive maliyeti yüksek — ödeme sayfası değişikliği transaction volume'ü doğrudan etkiler.

## Dinamik sample size ve expected loss hesabı

Frequentist testlerde sample size hesabı power analysis ile önceden yapılır: minimum detectable effect (MDE), statistical power (%80), significance level (α=0.05) veriyorsunuz, çıkan sayıyı bekliyorsunuz. Bayesian'da sample size dinamik çünkü posterior distribution sizi erken sonuca götürebilir. Ama bu "istediğin zaman dur" anlamına gelmez — expected loss kavramı devreye girer.

Expected loss, yanlış karar vermenin beklenen maliyetidir. Diyelim posterior'a göre variant B'nin %92 olasılıkla kazandığını görüyorsunuz. Ama %8 ihtimalle A daha iyi ve siz B'yi seçerseniz uplift kaybı yaşarsınız. Expected loss bu senaryoyu sayısal hale getirir:

```
E[Loss_B] = ∫ max(0, θ_A - θ_B) × P(θ_A, θ_B | data) dθ
```

Pratik anlamı: "B'yi seçersem ve yanılırsam beklenen kayıp 0.3 puan dönüşüm oranı" gibi bir çıktı alırsınız. Bu değer para birimine çevrilebilir — örneğin günlük 10,000 session, %0.3 loss = 30 eksik dönüşüm = ortalama sipariş değeri ile çarpıp günlük maliyet buluyorsunuz.

Evan Miller'ın "Bayesian A/B Testing Calculator"ı bu hesabı otomatize eder: control ve variant için conversion count + sample size veriyorsunuz, posterior + expected loss + probability of being best varyantını döndürüyor. Bu tool production deploy için yeterli değil ama konsepti anlamak için ideal. Production'da Python `pymc` veya R `rstan` kütüphaneleriyle posterior sampling yapıp Monte Carlo ile expected loss hesaplıyoruz.

### Regret minimization perspektifi

Multi-armed bandit literatüründen gelen bir kavram var: regret. A/B testte regret, optimal variant'ı seçmemekten kaynaklanan toplam kayıptır. Bayesian sequential testing bunu minimize etmeye çalışır çünkü winning signal erken geldiğinde hızla karar verebiliyorsunuz. Frequentist'te regret test süresi boyunca lineer büyür (çünkü losing variant'a trafik göndermeye devam ediyorsunuz), Bayesian'da sublinear — erken durduğunuz için.

Regret hesabı e-ticaret landing page testlerinde kritik. Örneğin Black Friday kampanyasında 48 saatlik test window'unuz var. Frequentist planlama 2000 kullanıcı sample size gerektiriyorsa ve günlük trafik 3000 ise testi tamamlayamayabilirsiniz. Bayesian'da 12 saat sonrasında %97 posterior ile karar verebilirseniz kalan 36 saatte winning variant'ı %100 trafiğe açıp regret'i sıfırlıyorsunuz.

## Uygulama: Python ile Bayesian A/B test pipeline

Teoriden pratiğe geçerken Bayesian testleri nasıl production'a alacağınızı görelim. Aşağıdaki kod parçası BigQuery'den test verisi çeken, posterior hesaplayan ve stopping rule kontrol eden basit bir pipeline:

```python
import numpy as np
from scipy.stats import beta

def calculate_posterior(conversions, trials, prior_alpha=1, prior_beta=1):
    """Beta-Binomial conjugate prior ile posterior hesapla"""
    return beta(prior_alpha + conversions, prior_beta + trials - conversions)

def prob_b_beats_a(posterior_a, posterior_b, samples=100000):
    """Monte Carlo ile P(B > A) hesapla"""
    samples_a = posterior_a.rvs(samples)
    samples_b = posterior_b.rvs(samples)
    return (samples_b > samples_a).mean()

def expected_loss(posterior_a, posterior_b, samples=100000):
    """B'yi seçtiğinde beklenen kayıp"""
    samples_a = posterior_a.rvs(samples)
    samples_b = posterior_b.rvs(samples)
    loss = np.maximum(0, samples_a - samples_b)
    return loss.mean()

# Örnek veri: Control 1000 session / 120 conversion, Variant 1000 / 145
posterior_control = calculate_posterior(120, 1000)
posterior_variant = calculate_posterior(145, 1000)

prob_win = prob_b_beats_a(posterior_control, posterior_variant)
loss_variant = expected_loss(posterior_control, posterior_variant)

print(f"P(Variant > Control): {prob_win:.3f}")
print(f"Expected loss if choose Variant: {loss_variant:.4f}")

# Stopping rule
if prob_win > 0.95 and loss_variant < 0.01:
    print("SHIP VARIANT")
elif prob_win < 0.05:
    print("SHIP CONTROL")
else:
    print("CONTINUE TEST")
```

Bu kodu dbt model içine gömebilir, günlük schedule ile çalıştırabilirsiniz. BigQuery'de test_id, variant, session_count, conversion_count tablosu varsa Python UDF olarak posterior hesaplayıp sonucu yeni tabloya yazıyorsunuz. Looker veya Metabase dashboard'una bağlayınca product team posterior grafiğini real-time görür.

## Trade-off'lar ve ne zaman frequentist kalmalı

Bayesian yaklaşım her durumda üstün değil. Üç senaryo var:

**1. Regulatory compliance gereken testler:** İlaç denemeleri, finans sektörü, sigorta primleme modellerinde frequentist p-value FDA/EMA gibi regülatörler tarafından standart kabul ediliyor. Bayesian posterior kullanırsanız ek dokümantasyon gerekir.

**2. Çok düşük base rate:** Örneğin %0.5 dönüşüm oranı olan bir funnel adımında Bayesian prior seçimi kritik hale gelir. Uninformative prior (Beta(1,1)) ile noise'dan signal ayırmak zorlaşır, informative prior kullanırsanız subjektif bias riski var. Böyle durumlarda frequentist daha "safe" görünür.

**3. Tek seferlik büyük kampanyalar:** Yıllık Black Friday landing page testi gibi tekrarı olmayan, yüksek stake'li kararlar. Bayesian erken durdurma yaparsanız ve yanılırsanız reverted edemezsiniz çünkü kampanya bitmiş olur. Burada muhafazakar frequentist + bonferroni correction tercih edilebilir.

Ama bu istisnalar dışında — özellikle SaaS, e-ticaret, mobil app gibi sürekli iterasyon yapılan ortamlarda — Bayesian'ın velocity kazancı açık. Netflix, Booking.com, Spotify içeride Bayesian kullanıyor (public tech blog'larında bahsediyorlar).

## Karar verme hızını artırmak

Bayesian A/B test sadece istatistik değişikliği değil, karar sürecini yeniden kurmaktır. Posterior probability günlük güncellenen bir metrik haline geldiğinde test pipeline'ınız şuna benzer: Pazartesi testi başlatıyorsunuz, Çarşamba posterior %92'ye ulaşıyor, Perşembe %96 — hemen karar veriyorsunuz. Frequentist framework'te aynı test 2 hafta sürerdi. 10 gün kazanç = 10 gün daha hızlı iterasyon = yılda 20-30 ekstra test.

Bu hız avantajını yakalamak için araç setinizi Bayesian-native kurun: BigQuery + Python UDF + Looker dashboard + Slack alert. Expected loss threshold'unu CFO ile belirleyin (örneğin günlük revenue'nun %0.5'i). Prior seçiminde domain knowledge kullanın ama over-confidence'tan kaçının — çoğu durumda Beta(2,2) yeterli başlangıç. Sequential testing mantığını product roadmap'e entegre edin: sprint başında 3 test başlatıyorsanız Bayesian ile 2 tanesini sprint ortasında kapatıp yeni test başlatabilirsiniz.

Performans pazarlamasında kazanan hızlı hareket edendir. Bayesian yaklaşım size bu hızı statistical rigor'dan ödün vermeden sunar.