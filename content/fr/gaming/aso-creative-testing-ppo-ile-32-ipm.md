---
title: "ASO Creative Testing: PPO ile 6 Hafta İçinde +%32 IPM"
description: "Custom Product Pages ve Play Experiments ile App Store görsellerini test ederek install-per-mille artışını ölçülebilir şekilde optimize etmek."
publishedAt: 2026-08-02
modifiedAt: 2026-08-02
category: gaming
i18nKey: gaming-001-2026-08
tags: [aso, custom-product-pages, play-experiments, creative-testing, mobile-gaming]
readingTime: 8
author: Roibase
---

2026'da App Store'da organik görünürlük kazanmak, keyword optimizasyonundan çok creative performansa bağlı. Apple'ın Custom Product Pages (CPP) ve Google'ın Play Experiments özelliği, görsel varyantları kontrollü şekilde test etme imkânı sunuyor. Bu yazıda 6 haftalık bir ASO creative testing sürecini, PPO (Product Page Optimization) metodolojisini ve +%32 IPM (Install-per-Mille) artışını tetikleyen değişkenleri somut metriklerle açıklıyoruz.

## Custom Product Pages ve Play Experiments: Test Ortamı Kurmak

Custom Product Pages, aynı app için farklı görsel varyasyonları farklı trafik kaynaklarına göstermeni sağlar. Apple Search Ads'ten gelen kullanıcıya bir screenshot seti, organic keyword aramasından gelene başka bir set sunabilirsin. Play Experiments ise Android tarafında benzer mantığı Google Play Console üzerinden yönetir. İkisinin de ortak özelliği: trafik bölünmesi kontrollü, attribution kesin, A/B split istatistiksel anlamlılık hesaplanabilir.

Test ortamını kurarken ilk adım trafik segmentasyonu. Eğer Apple Search Ads'e ayda $50k+ harcıyorsan, CPP varyantını bu kaynağa özel yapılandır — zaten keyword intent netse, görselde gameplay mekaniklerini ön plana çıkarmak conversion'ı artırır. Organic trafik için ise hero karakter odaklı, emosyonel hook'u güçlü bir varyant hazırla. Play Experiments'te default store listing'e karşı tek bir varyant test edebilirsin; trafik otomatik olarak 50-50 bölünür, 7 günlük minimum test süresi zorunlu.

### Hipotez Kurmak ve Metrik Seçmek

Creative test hipotezi şu formatta olmalı: "Screenshot 3'te gameplay yerine meta-progression görseli kullanırsam, D1 retention'da %5+ artış bekliyorum çünkü exit survey'de kullanıcılar 'ne kazanacağımı anlamadım' diyor." Bu örnekte metrik D1 retention değil, IPM (install-per-mille) — yani bin gösterimde kaç install alıyorsun. IPM'yi seçme nedeni: App Store'da conversion funnel'ın ilk basamağı burası, creative'in doğrudan etkisi burada görünür. D1 retention ikinci dalga test için — post-install onboarding'i optimize ettiğin aşama.

## 6 Haftalık Test Takvimi ve Trafik Dağılımı

6 haftalık süreç 3 sprint'e bölünür: 2 hafta baseline data toplama, 2 hafta ilk varyant testi, 2 hafta kazanan varyant üzerinde ikinci dalga mikro-optimizasyon. İlk 2 hafta kontrol grubu olarak mevcut store listing'i kullan — bu periyotta CPP veya Play Experiments aktif değil, sadece organic + paid trafik datasını topluyorsun. Baseline IPM'yi not et; örneğin Apple Search Ads'te 48.2 IPM, organic'te 32.7 IPM.

Hafta 3-4'te CPP varyant 1'i devreye al. Trafik dağılımını Apple Search Ads Console'dan yönet: default listing %50, CPP varyant 1 %50. Screenshot değişikliği: default'ta hero karakter portrait, varyant 1'de hero karakter + PvP arena ortamı. Icon aynı, sadece screenshot sırasını değiştir — 1. screenshot'ı gameplay'e çevir. 2 hafta sonunda trafik 10k+ impression'a ulaştıysa istatistiksel anlamlılık test edilebilir (chi-square test, p < 0.05 hedefi). Varyant 1'de IPM 51.8'e çıktıysa — %7.5 uplift — kazandı demektir.

Hafta 5-6'da kazanan varyantı baseline yap, yeni bir mikro-varyasyon test et: screenshot 2'de UI element'leri kaldır, daha "cinematic" bir frame kullan. Bu iterasyon'da IPM 63.4'e çıktıysa — toplamda +%32 uplift — bunu production'a al. Android tarafında Play Experiments ile paralel test yürütüyorsan, aynı hipotezi farklı asset ile dene (örneğin video yerine static screenshot). Google Play'de video auto-play açıksa, video'nun ilk 3 saniyesi hook olmalı — bu da ayrı bir test döngüsü.

### İstatistiksel Anlamlılık ve Sample Size Hesabı

Bir creative test'i sonlandırmadan önce sample size yeterli mi diye kontrol et. Formula: `n = (Z^2 * p * (1-p)) / E^2`, burada Z = 1.96 (confidence level %95 için), p = baseline conversion rate (IPM'yi yüzdeye çevir: 0.048), E = margin of error (0.02). Bu örnekte n ≈ 4600 impression gerekiyor. Eğer haftalık trafik 2k ise, test 3 hafta sürmelidir. Erken sonlandırma = yanlış kazanan, kaybettiğin fırsat maliyeti yüksek.

Chi-square test sonucu p-value < 0.05 çıkmazsa, uplift %15 olsa bile istatistiksel olarak anlamlı değildir — noise olabilir. Bu durumda testi 1 hafta daha uzat veya trafik arttır. Apple Search Ads budget'ı artırıp impression volume'ü 2x yapabilirsin (CPP'ye has trafik segmenti olduğu için maliyeti kontrol altında).

## Görsel Varyasyon: Hangi Element Ne Kadar Etki Eder

Creative test sırasında değiştirebileceğin element'ler: icon, screenshot sırası, screenshot içeriği, app preview video, promo text (Play Store'da). Her element'in IPM üzerindeki etkisi farklı. Icon değişikliği %30-50 uplift getirebilir ama risk yüksek — yeni icon brand recognition'ı zedeler, mevcut kullanıcı tabanı uygulamayı bulamaz. Screenshot sırası değişikliği düşük riskli, orta etkili (%5-15 uplift). Screenshot içeriği yüksek etkili (%20-40 uplift) ama tasarım maliyeti yüksek.

Oyun türüne göre etkili screenshot temaları: RPG'de character progression + loot showcase, strategy'de resource management + base building, casual puzzle'da level difficulty curve. F2P oyunlarında "gameplay + meta progression" kombinasyonu çoğunlukta kazanır — kullanıcı hem ne oynayacağını hem ne kazanacağını görüyor. Hardcore PvP oyunlarında competitive element'i öne çıkarmak (leaderboard, tournament, rank badge) conversion'ı artırır.

## Attribution ve Post-Install Cohort Analizi

Creative test sadece IPM ile bitmez — install sonrası cohort metriklerini de izlemen lazım. Eğer CPP varyant 1 ile IPM %32 artarken D7 retention %12 düşüyorsa, creative'in vaat ettiği ile oyunun gerçekte sunduğu arasında mismatch var demektir. Bu durumda onboarding'i creative'e uyacak şekilde revize et veya creative'i daha gerçekçi hale getir.

Attribution için Apple Search Ads'te SKAdNetwork postback'lerini doğru konfigüre etmelisin — Conversion Value mapping'i D1/D3/D7 retention'a göre ayarla. Play Store'da ise Google Play Install Referrer API'si ile kampanya source'unu tag'le, Firebase veya Adjust üzerinden cohort'ları segment'le. Creative varyant ID'sini user property olarak ekle, böylece BigQuery'de cohort analizini creative bazında parçalayabilirsin.

### Örnek Cohort Tablosu

| Creative | IPM | D1 Ret. | D7 Ret. | LTV D30 |
|----------|-----|---------|---------|---------|
| Default  | 48.2| 42%     | 18%     | $2.40   |
| Varyant 1| 51.8| 44%     | 19%     | $2.55   |
| Varyant 2| 63.4| 43%     | 17%     | $2.20   |

Varyant 2 IPM'de kazanıyor ama D7 retention düşük — bu kullanıcılar beklentiyle gelip hayal kırıklığına uğruyor. Varyant 1 dengeli — hem IPM hem retention artışı sağlıyor, LTV'yi de pozitif etkiliyor. Production'a Varyant 1 alınmalı.

## Roibase ASO Metodolojisi ve PPO Döngüsü

Roibase'in [App Store Optimization](https://www.roibase.com.tr/fr/aso) hizmeti, creative testing'i attribution model'iyle entegre ederek PPO (Product Page Optimization) döngüsünü kurar. 6 haftalık sprint'lerde keyword research + creative test + post-install cohort analizi döngüsünü işletiyoruz. Mobile F2P oyunlarında bu döngü Tier-1 market'lerde (US, UK, JP) ve emerging market'lerde (TR, BR, IN) farklı parametrelerle çalışır — örneğin TR'de icon'da Türkçe text kullanımı IPM'yi %18 artırabiliyor, ABD'de sıfır etki.

PPO döngüsü şu adımlardan oluşur: (1) GSC + App Store Connect'ten keyword intent analizi, (2) intent'e göre creative hipotezi kurma, (3) CPP/Play Experiments ile A/B split test, (4) istatistiksel anlamlılık kontrolü, (5) kazanan varyantı baseline yapıp bir sonraki element'i test etme. Bu döngü continuous optimization mantığıyla çalışır — test hiçbir zaman bitmez, her zaman bir sonraki %5-10 uplift fırsatı vardır.

---

6 haftalık creative testing süreci, disiplinli hipotez kurma ve istatistiksel kontrol gerektiriyor. IPM artışını install sonrası metriklerle doğrulamadan production'a almamak kritik — aksi halde kısa vadeli kazancın uzun vadede churn'le geri döner. Custom Product Pages ve Play Experiments, mobile gaming'de organik büyüme için en kontrol edilebilir kanallar; bunları düzenli sprint'lerle optimize etmek, acquisition maliyetini düşürürken LTV'yi artırmanın doğrudan yolu.