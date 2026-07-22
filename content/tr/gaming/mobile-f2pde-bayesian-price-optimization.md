---
title: "Mobile F2P'de Bayesian Price Optimization"
description: "IAP price ladder testlerini posterior estimation ve segment bazlı modelleme ile optimize edin. Veri-odaklı fiyatlandırma stratejisi."
publishedAt: 2026-07-22
modifiedAt: 2026-07-22
category: gaming
i18nKey: gaming-002-2026-07
tags: [f2p-monetization, bayesian-optimization, iap-pricing, mobile-gaming, data-driven-pricing]
readingTime: 8
author: Roibase
---

Mobile F2P oyunlarda fiyatlandırma kararları genellikle tahmine veya "pazarda yaygın fiyat" referansına dayanır. $0.99 starter pack, $4.99 mid-tier, $99.99 whale bundle — bu fiyat ladder'ı çoğu oyunda sabittir. Oysa her oyunun cohort yapısı, geo mix'i ve value perception'ı farklıdır. Bayesian price optimization, bu farklılığı posterior probability distribution üzerinden modelleyerek her segmentte optimal fiyat noktasını bulmanızı sağlar. Klasik A/B test yerine sürekli öğrenen bir sistem kurmak, IAP conversion rate'inizi %15-40 arası iyileştirebilir.

## Bayesian yaklaşım neden A/B testinden daha iyi

Klasik A/B test sabit hipotez üzerinden çalışır: $4.99 vs $5.99 gibi iki fiyatı karşılaştırır, %95 confidence'a ulaşana kadar bekler, kazananı seçer. Bu yaklaşımın iki sorunu var: birincisi, test süresince trafik yarı yarıya bölünür ve kötü performans gösteren variant kullanıcılara sunulmaya devam eder (opportunity cost). İkincisi, test bittiğinde sadece "A veya B" kararı alırsınız — ara değerler veya segment-spesifik farklılıklar hakkında bilgi edinemezsiniz.

Bayesian optimization ise prior distribution (örneğin "fiyat $3-$7 arasında uniform dağılımlı olabilir") ile başlar, her conversion verisini posterior'a ekler ve probability distribution'ı sürekli günceller. Bu sayede Thompson Sampling gibi algoritmalarla trafik dinamik olarak kazanan varianta kayar — test süresi boyunca toplam revenue maksimize edilir. Örneğin 10 gün süren bir testte Bayesian yaklaşım %8-12 daha fazla revenue üretir, çünkü kötü fiyat noktalarına minimum trafik gönderilir.

Ayrıca Bayesian model size sadece "hangi fiyat kazandı" değil, "bu fiyatın optimal olma olasılığı %87" gibi bir confidence interval verir. Bu bilgi iterasyon hızını artırır: %60 confidence'da bile bir fiyatı canlıya alıp yeni test başlatabilirsiniz, çünkü posterior distribution zaten yeterli bilgi taşır.

## IAP price ladder testinde segment tabanlı prior kurgusu

F2P oyunlarda tüm kullanıcılar aynı değil. Spender segmentlerinizi doğru tanımlamak, Bayesian modelin prior'ını güçlendirir. Tipik segmentasyon: **minnows** (lifetime spend <$10), **dolphins** ($10-$100), **whales** (>$100). Her segmentin fiyat elastikiyeti farklıdır — minnow'lar $0.99'luk pack'e bile conversion verirken, whale'ler $99.99 bundle'ı fiyat görmeden satın alır.

Prior distribution'ı segment bazında kurmak için historical data gerekir. Örneğin minnow segmentinizde $0.99 ile $1.99 arası IAP conversion rate ortalaması %3.2 ise, prior mean olarak $1.49 ve sigma $0.50 kullanabilirsiniz (normal distribution varsayımı altında). Whale segmentinde ise $49.99-$149.99 aralığında conversion rate neredeyse düz kalıyorsa, uniform prior daha uygun olur — yani "whale'ler fiyata duyarsız" hipotezini model kurarken yansıtırsınız.

Segment bazlı prior'ın avantajı, cross-segment öğrenmeyi engellemesidir. Klasik A/B test tüm kullanıcıları tek pool'da karıştırır ve whale'lerin düşük fiyat variant'ında da yüksek conversion vermesi, minnow'ların optimal fiyatını maskeleyebilir. Bayesian model her segmentte ayrı posterior günceller, böylece minnow için $1.49, whale için $79.99 gibi segment-optimal fiyatlar ortaya çıkar.

### Geo-spesifik prior ayarı

Tier-1 (US, UK, JP) ve emerging market (BR, TR, IN) geo'larında purchasing power parity çok farklıdır. US'de $4.99 pack "ucuz" algılanırken TR'de aynı fiyat (₺150 civarı) orta-üst segmenttir. Prior distribution'ı geo bazında normalize etmek için local ARPU verisini kullanın. Örneğin US'de average daily IAP $0.42 ise, TR'de $0.18 ise, prior mean'i bu oranla (0.18/0.42 = %43) scale edin. Bu sayede model her geo'da aynı relative price ladder'ı test eder, absolute değer farkını prior içine gömer.

## Posterior estimation ve Thompson Sampling implementasyonu

Bayesian modelin runtime engine'i posterior estimation'dır. Her IAP impression'ında (offer gösterimi), mevcut posterior distribution üzerinden bir sample çekersiniz (örneğin Beta distribution ise `np.random.beta(alpha, beta)` ile). Bu sample'ın karşılık geldiği fiyatı kullanıcıya gösterirsiniz. Kullanıcı satın alırsa alpha += 1, skip ederse beta += 1 — posterior güncellenir.

Thompson Sampling bu mekanizmayı trafik dağıtımında kullanır. Her variant için posterior'dan bir reward expectation çeker, en yüksek reward'ı seçer. İlk birkaç gün tüm variant'lar eşit traffic alır (exploration), sonra kazanan variant'a trafik kayar (exploitation). Balance epsilon değil, posterior variance ile sağlanır — yani düşük variance'lı (yüksek confidence) variant daha fazla traffic toplar.

Pratik implementasyon için Python `scipy.stats.beta` veya `pymc3` kullanabilirsiniz. Basit bir kod bloğu:

```python
import numpy as np
from scipy.stats import beta

# Prior: alpha=1, beta=1 (uniform)
alpha_a, beta_a = 1, 1  # Variant A ($4.99)
alpha_b, beta_b = 1, 1  # Variant B ($5.99)

def select_variant():
    sample_a = np.random.beta(alpha_a, beta_a)
    sample_b = np.random.beta(alpha_b, beta_b)
    return "A" if sample_a > sample_b else "B"

def update_posterior(variant, converted):
    global alpha_a, beta_a, alpha_b, beta_b
    if variant == "A":
        if converted:
            alpha_a += 1
        else:
            beta_a += 1
    else:
        if converted:
            alpha_b += 1
        else:
            beta_b += 1
```

Bu basit loop 10.000 impression sonunda posterior mean'i gerçek conversion rate'e %2 hata payı ile yakınsar (Beta prior varsayımı doğruysa). Production'da BigQuery + Airflow ile her gün posterior parametreleri güncelleyebilir, yeni cohort'lara güncel distribution ile başlayabilirsiniz.

## Multi-armed bandit vs full Bayesian model

Bayesian price optimization literatüründe iki ana yaklaşım vardır: **multi-armed bandit** (MAB) ve **full Bayesian regression**. MAB yaklaşımı yukarıda anlattığımız Thompson Sampling'dir — discrete fiyat variant'larını (örn. 5 fiyat noktası) arm olarak tanımlar, posterior her arm için ayrı tutulur.장점: implementasyon basit, runtime hafif, real-time decision alınabilir.

Full Bayesian regression ise fiyatı sürekli değişken olarak modeller, conversion probability'i lojistik regresyon veya Gaussian process ile fiyata bağlar. Bu yaklaşım daha esnek — örneğin "fiyat arttıkça conversion rate üstel düşer" gibi non-linear ilişkileri öğrenebilir. Dezavantaj: model training BigQuery + Python stack gerektirir, real-time decision alamazsınız (batch prediction).

F2P oyunlarda MAB genellikle yeterlidir, çünkü price ladder zaten discrete'tir ($0.99, $2.99, $4.99, $9.99 gibi). Full Bayesian model, dynamic pricing (her kullanıcıya farklı fiyat) yapmak istediğinizde devreye girer — ancak bu çoğu app store policy tarafından yasaklanmıştır (price discrimination). Orta yol: segment bazında MAB, her segment içinde full Bayesian regression. Böylece whale segment'ine $79.99-$149.99 arası optimal noktayı sürekli fonksiyon olarak bulabilirsiniz.

## Revenue uplift ve cohort LTV etkisi

Bayesian price optimization'ın asıl ROI'si cohort LTV'de görülür. Testin ilk haftasında conversion rate %8 yükselir, ancak bu kullanıcıların D30 LTV'si %15-20 daha yüksek çıkar. Neden? Çünkü optimal fiyat noktası, kullanıcının value perception'ına tam oturur — ne çok düşük (perceived value drop), ne çok yüksek (friction). Bu kullanıcılar ilk IAP sonrası ikinci paketi de satın alma olasılığı daha yüksektir.

Bir örnek: mid-core RPG oyununda $4.99 starter pack yerine Bayesian model $3.49 önerdi (minnow segment, US geo). İlk hafta conversion rate %22'den %28'e çıktı (+%27 relative). D7 retention değişmedi (%42), ancak D30 ARPU $2.18'den $2.51'e yükseldi (+%15). Neden? $3.49 fiyat, kullanıcının "bu oyuna yatırım yapabilirim" eşiğini düşürdü, second purchase friction azaldı. Toplam cohort LTV $8.90'dan $10.20'ye çıktı (+%15).

Bu etkiyi ölçmek için cohort analizi zorunludur. BigQuery'de `user_id`, `install_date`, `first_iap_price`, `d7_revenue`, `d30_revenue` kolonlarını takip edin. Bayesian test variant'ını `experiment_group` ile flag'leyin, kontrol grubuyla LTV curve'lerini karşılaştırın. İlk 7 gün significance testi erken olur, D30'da confidence artar.

## Yanlış anlaşılmalar ve tradeoff'lar

Bayesian price optimization "hemen kazanır" yanılgısı yaygındır. Gerçekte posterior convergence için minimum 5.000-10.000 impression gerekir (segment başına). Düşük traffic'li oyunlarda (DAU <50k) test süresi 4-6 haftaya uzar. Bu süre boyunca data pipeline (impression logging, conversion tracking, posterior update) stabil çalışmalıdır — tek bir bug tüm posterior'ı bozar.

İkinci tradeoff, segment granülarity'dir. Çok ince segment (örn. "L5-10 arası, US, Android, whale") çekerseniz, her segment'te sample size yetersiz kalır, posterior yüksek variance ile kalır. Pratik kural: segment başına günde en az 200 IAP impression olmalı. Altında kalıyorsanız segmentleri birleştirin (örn. US+UK+CA tek "Tier-1 EN" segment olur).

Üçüncü nokta, price ladder değişikliğinin psikolojik etkisidir. Kullanıcı dün $4.99 gördüyse, bugün $3.99 görmek "indirim" algısı yaratır ve conversion patlar — ama bu sürdürülebilir değildir. Bayesian test sırasında fiyat range'i dar tutun (±%20 max), radikal değişiklik (örn. $4.99 → $1.99) yapmayın.

## Test sonrası scale ve otomasyon

Bayesian price optimization bir kerelik test değil, sürekli öğrenme sistemidir. Test bittiğinde kazanan fiyatı canlıya alırsınız, ancak posterior distribution'ı saklar, yeni cohort'larda prior olarak kullanırsınız. Örneğin Q4 holiday season'da ARPU %30 yükselir — önceki quarter'ın posterior'ı yeni prior olarak başlar, model hızlıca yeni optimuma kayar (cold start yerine warm start).

Otomasyonu Airflow + BigQuery + Firebase Remote Config ile kurabilirsiniz. Her gün Airflow DAG, BigQuery'den posterior parametrelerini okur, Firebase Remote Config'e yeni fiyat variant'larını yazar. Client SDK Remote Config'i fetch eder, IAP offer'ı gösterir. Conversion eventi BigQuery'ye loglanır, posterior update edilir — döngü kapanır. İlk kurulum 2-3 hafta alır, sonrası zero-touch çalışır.

Son adım: Bayesian modeli birden fazla oyuna scale etmek istiyorsanız, merkezi bir "pricing service" kurun. Her oyun metadata (genre, geo mix, ARPU) gönderir, servis oyunun profile'ına göre prior distribution önerir. Bu sayede yeni oyunlar cold start sorunu yaşamaz, benzer oyunların posterior'ından transfer learning yapar. Roibase'in [App Store Optimization](https://www.roibase.com.tr/tr/aso) hizmeti bu tür cross-app öğrenme pipeline'larını ASO creative test'leriyle birleştirir — aynı Bayesian framework product page variant'larında da kullanılabilir.

---

Bayesian price optimization, F2P oyunlarda revenue engineering'in temel taşlarından biridir. Doğru segment prior'ı, sürekli posterior update ve Thompson Sampling ile IAP conversion'ınızı %15-40 artırabilir, cohort LTV'yi görünür şekilde yükseltirsiniz. Klasik A/B test yerine öğrenen bir sistem kurmak, uzun vadede compounding effect yaratır — her yeni cohort bir öncekinden daha optimize başlar. Başlamak için mevcut price ladder'ınızı 3-5 variant'a bölün, historical conversion rate'lerden prior kurun ve ilk 10.000 impression'da posterior'ı izleyin.