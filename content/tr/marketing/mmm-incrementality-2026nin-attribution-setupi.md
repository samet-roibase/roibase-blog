---
title: "MMM + Incrementality: 2026'nın Attribution Setup'ı"
description: "Robyn, Meta Lift, geo experiments — hangisini ne zaman kullanmalı? Post-cookie dönemde doğru ölçüm mimarisi nasıl kurulur?"
publishedAt: 2026-05-14
modifiedAt: 2026-05-14
category: marketing
i18nKey: marketing-004-2026-05
tags: [mmm, incrementality, attribution, robyn, meta-lift]
readingTime: 8
author: Roibase
---

Last-click attribution öldü, browser signali güvenilmez, conversion API bile gürültülü — 2026'da performans pazarlaması ölçümü tamamen farklı bir zemine oturdu. Marketing Mix Modeling (MMM) artık sadece CPG markalarının yıllık bütçe planlamasında kullandığı ağır bir araç değil; haftalık karar mekanizmasına entegre edilen, incrementality testleriyle sürekli kalibre edilen dinamik bir sistem. Meta'nın Robyn'i açık kaynak oldu, Google kendi MMM stack'ini BigQuery ML'e taşıdı, Snapchat geo-experiment API'sini production'a aldı. Soru artık "MMM mi, incrementality mi?" değil — "hangi katmanda hangisini, nasıl birlikte kullanıyorum?"

## MMM Neden Şimdi Masaya Geldi

Cookie yok, ATT opt-in %25'te, Privacy Sandbox hâlâ belirsiz — platform raporlaması 2024'ten bu yana %40-60 arasında hata payıyla çalışıyor (Forrester 2025). Bu ortamda son tıklama modeli veya data-driven attribution Google Analytics'ten alınan sayılarla karar vermek, kör nokta üzerinde hız yapmak gibi. MMM bu senaryoda tek makro ölçüm çerçevesi: tüm kanalları toplam spend ve sonuç üzerinden regresyon modeliyle değerlendirir, cookie'ye ihtiyaç duymaz, zaman serisi üzerinden sebep-sonuç ilişkisini çıkarır.

2026'da MMM'in yeniliği şu: artık yıllık değil haftalık güncellenen, otomatik pipeline'a oturan, sGTM ve CDP'den gelen first-party sinyali kullanabilen bir yapı. Meta'nın Robyn kütüphanesi bunu mümkün kılıyor: açık kaynak, R/Python, haftalık refresh, Bayesian ridge regression, adstock ve saturation curve'leri otomatik hyperparameter tuning ile fit ediyor. Yani artık "model kurulumu 6 ay" dönemi bitti — 2 haftalık sprint'te production'a giriyor.

Örnek senaryo: 15 kanallı bir DTC markası Robyn'i BigQuery'ye bağladı. Haftalık spend, impression, revenue verisini `bq load` ile pipe etti. Model 3 haftalık geçmiş veriye bakıp her kanal için ROAS curve, adstock (reklam etkisinin gecikmesi) ve saturation (artan spend'in azalan getirisi) tahmin etti. Sonuç: TikTok'un ROAS'ı tahmin edilenden %18 düşük çıktı — çünkü son tıklama attribution TikTok'u fazla kredilendiriyordu. Google Search ise tam tersi: gerçek katkısı %22 daha yüksekti.

## Incrementality Test Nerede Devreye Giriyor

MMM makro bakar — tüm kanalların toplam etkisini zaman serisi regresyonuyla çıkarır. Ama şu soruya cevap veremez: "Bu hafta Meta'ya 10.000$ daha fazla verseydim ne olurdu?" İşte burada incrementality test devreye girer: gerçek bir deney kurar, kontrol grubu tutar, kaldırımı (lift) ölçer.

Meta'nın Conversion Lift testi bunu platforma entegre etti: kullanıcıları rastgele holdout grubuna ayır, holdout'a reklam gösterme, sonunda iki grubun dönüşüm farkını ölç. 2026'da bu yöntem artık sadece Meta'da değil — Google Ads'te Geo Experiments (coğrafya bazlı kontrol grubu), TikTok'ta Brand Lift API, Snapchat'te Snap Lift Studio var. Hepsi aynı prensibi kullanıyor: rastgeleştirme ve kontrollü maruz bırakma.

Fark şu: MMM "geçmişte ne oldu" sorusuna cevap verir, incrementality "gelecekte ne olur" sorusuna. MMM gözlemsel veri üzerinden korelasyon çıkarır, incrementality nedensel ilişkiyi test eder. İdeal setup ikisini birleştirmek: MMM ile makro trend + ROI benchmark'ını al, incrementality ile kanal-spesifik taktikleri doğrula.

### Hangi Testi Ne Zaman Kullanmalı

| Yöntem | Ne Zaman | Süre | Maliyet | Kesinlik |
|--------|----------|------|---------|----------|
| **MMM (Robyn)** | Yıllık/çeyreklik planlama, kanal mix optimizasyonu | 2-4 hafta setup, haftalık refresh | Düşük (açık kaynak) | Orta (korelasyon) |
| **Meta Conversion Lift** | Kampanya-seviye taktik karar, yeni kreatif A/B | 2-4 hafta test | Orta (spend holdout) | Yüksek (RCT) |
| **Google Geo Experiments** | Coğrafya-bazlı spend değişikliği | 3-6 hafta | Orta | Yüksek (quasi-RCT) |
| **Ghost Ads (Snapchat/TikTok)** | Platform ROI doğrulama | 2-3 hafta | Düşük | Orta-yüksek |

**Gerçek örnek:** Bir fintech uygulaması App Store'da %15 organik büyüme görüyor. Apple Search Ads'i kapatıp organik etkiyi ölçmek için geo-experiment kuruyor: ABD'yi 10 DMA'ya böl, 5'inde ASA'yı tamamen kes. 21 gün sonra kontrol grubunda install 12% daha fazla ama holdout grubunda organik install sadece %2 artmış — yani ASA'nın %10 incrementality'si var. Bu veriyle ASA bütçesini %30 artırıp ROAS'ı 2.1'den 2.8'e çıkarıyorlar.

## Robyn ile Pratik MMM Pipeline Kurmak

Robyn açık kaynak, MIT lisanslı, Meta'nın kendi MMM altyapısından türetilmiş. 2026 sürümü (v3.11) artık Python native destekli (R wrapper değil), BigQuery connector built-in, hyperparameter tuning Optuna ile otomatik.

Basit setup adımları:

1. **Veri hazırlama:** Haftalık granülaritede tablo — `date`, `channel`, `spend`, `impressions`, `revenue`. BigQuery'de `marketing_data.weekly_agg` tablosu.
2. **Robyn install:** `pip install pyrobyn` (Python 3.10+)
3. **Config yazma:** YAML dosyası — adstock tipi (geometric vs. Weibull), saturation curve (Hill), hyperparameter range.
4. **Model train:** `robyn.train()` — Nevergrad optimizer 2000 iterasyon, en iyi fit Pareto frontier'dan seç.
5. **Output:** Her kanal için ROAS curve, decomposition chart (haftaya göre katkı payı), budget allocator (optimal spend dağıtımı).

```python
from pyrobyn import Robyn

# BigQuery'den veri çek
data = client.query("""
  SELECT date, channel, spend, revenue
  FROM `project.marketing_data.weekly_agg`
  WHERE date BETWEEN '2025-01-01' AND '2026-05-14'
""").to_dataframe()

# Model kur
model = Robyn(
    data=data,
    dep_var='revenue',
    paid_media_spends=['spend'],
    adstock='geometric',
    saturation='hill',
    hyperparameters='auto'  # Optuna tuning
)

# Train (2 saat, 8 core)
model.train(iterations=2000, trials=5)

# En iyi modeli seç (Pareto NRMSE + convergence)
best = model.select_model('pareto_front', rank=1)

# Budget reallocation
allocator = best.budget_allocator(
    total_budget=500000,  # Aylık toplam
    scenario='max_response'
)
print(allocator.optimal_allocation)
```

Çıktı: Meta spend'i %12 azalt, Google Search %18 artır, TikTok sabit tut — bu dağıtımla predicted revenue %9 artacak. Bu tahmini doğrulamak için 4 haftalık incrementality testi kur.

## İki Yöntemi Birleştiren Karar Döngüsü

MMM ve incrementality test birbirini besleyen iki katman. MMM "neyi test etmeli" sorusunu yanıtlar, test "MMM tahminini doğrular veya yalanlı". 2026'da başarılı kurumlar şu döngüyü işletiyor:

**1. Makro planlama (Çeyreklik):** Robyn MMM'i çalıştır, her kanal için ROAS curve + saturation noktasını çıkar. Hangi kanalda margin var?

**2. Hipotez üretme (Aylık):** MMM "Google Display ROAS 1.2, saturation %70" diyorsa, bütçe artırma hipotezi kur.

**3. Test tasarımı (2 haftalık sprint):** Google Ads'te geo-experiment veya Meta Lift testi. Holdout %20, kontrol grubunda spend %0, test grubunda +%50.

**4. Test sonucu (3-4 hafta):** Gerçek incrementality 1.8 çıktı — MMM tahmininden yüksek. Model kalibre et.

**5. Model güncelleme:** Yeni test sonucunu MMM'e prior olarak ekle (Bayesian update). Sonraki iterasyonda model daha doğru tahmin yapacak.

Bu döngü [dijital pazarlama](https://www.roibase.com.tr/tr/dijitalpazarlama) stratejisinin merkezine oturmalı — planlamadan execution'a kadar her katmanda veri akışı kopmamalı.

**Gerçek vaka:** Bir seyahat platformu 2025 Q4'te Robyn ile TikTok'un ROAS'ını 0.9 olarak tahmin etti. Platform raporu 1.3 gösteriyordu. 6 haftalık Conversion Lift testi kurdular: gerçek incrementality 0.85 çıktı. Platform 53% hata yapıyordu (last-click bias). TikTok bütçesini %40 kestiler, Google Search'e kaydırdılar — toplam ROAS 1.8'den 2.3'e çıktı.

## Post-Cookie Dünyada Attribution Mimarisinin Temeli

2026'da attribution artık "hangi kanala kredi ver" sorusu değil — "hangi sinyali nasıl birleştir" sorusu. Cookie ölünce tek kaynak kalmadı, onun yerine parçalı veri noktaları var: sGTM'den gelen first-party event, platform Conversion API'den gelen server-side sinyal, CRM'den gelen offline dönüşüm. Bunları birleştiren katman CDP + data warehouse — BigQuery, Snowflake, Redshift.

Modern stack şöyle:

```
Web/App → sGTM → BigQuery
              ↓
           dbt transform
              ↓
      Robyn MMM + Lift Test
              ↓
       Looker Dashboard
```

Bu pipeline'da Robyn sadece bir node. Ama kritik node — çünkü makro trendi gösteriyor, test yönünü belirliyor. Test sonuçları tekrar BigQuery'ye yazılıyor, bir sonraki MMM iterasyonunda prior olarak kullanılıyor.

**Teknik not:** Robyn'in BigQuery entegrasyonu `google-cloud-bigquery` Python SDK üzerinden çalışıyor. `bq load` komutuyla haftalık veriyi `marketing_data.robyn_input` tablosuna yükle, model çıktısını `robyn_output` tablosuna yaz. Looker Studio doğrudan bu tabloyu okusun — böylece CMO dashboard'unda gerçek zamanlı ROAS curve ve budget allocation önerisi görünsün.

## Sık Yapılan Hatalar ve Karşı Argümanlar

**"MMM veri bilimci gerektirir, biz yapamayız."**
Robyn açık kaynak, dokümantasyonu net, Colab notebook'ları hazır. Orta seviye Python bilen bir growth analyst 2 hafta dokümantasyona bakıp production'a alır. 2026'da "data science" bahanesi geçmiyor.

**"Incrementality testi pahalı, holdout kaybı var."**
Holdout %10-20 tutarsan, 3 haftalık test %1.5-3 revenue kaybı demek. Ama yanlış kanala devam edersen yıllık %20-30 kayıp. Test ROI'si 10x üstü.

**"Platform raporlaması yeterli."**
Meta dashboard'u last-click + view-through 1-day atfediyor. Organik etkiyi, cross-channel sinerjisini, gecikmeli dönüşümü görmüyor. Platform raporu taktiksel sinyal, MMM stratejik gerçek.

**"Her hafta model train etmek gereksiz."**
Sezonalite, promosyon, ekonomik şok — hepsi ROAS'ı etkiliyor. Haftalık refresh ile 2 hafta içinde trend değişikliğini yakalarsın. Aylık refresh 6-8 hafta gecikmeli karar demek.

---

2026'da attribution sorunu çözüldü mü? Hayır — ama araç kutusu tamamen değişti. Cookie gitti, onun yerine MMM + incrementality + first-party data stack geldi. Robyn gibi açık kaynak araçlar büyük markayla küçük startup'ı aynı seviyeye getirdi. Geo-experiment ve Conversion Lift testleri platform içine gömüldü, artık ayrı bir veri bilimci ekibi kurmaya gerek yok. Soru "hangi yöntem" değil — "hangi katmanda hangi yöntemi, nasıl entegre edip döngüye sokuyorum?" Cevap veren kazanıyor.