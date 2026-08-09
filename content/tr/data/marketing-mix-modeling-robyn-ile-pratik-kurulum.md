---
title: "Marketing Mix Modeling: Robyn ile Pratik Kurulum"
description: "Meta'nın açık kaynak MMM aracı Robyn ile saturasyon eğrisi, adstock decay ve holdout validation süreçlerini production ortamına taşıyın."
publishedAt: 2026-08-09
modifiedAt: 2026-08-09
category: data
i18nKey: data-005-2026-08
tags: [marketing-mix-modeling, robyn, adstock, attribution, data-science]
readingTime: 8
author: Roibase
---

Marketing Mix Modeling (MMM) 2020'lerin sonunda cookie tabanlı attribution'ın çöküşüyle geri döndü. Ama akademik makalelerden production ortamına geçmek bambaşka bir seviye. Meta'nın 2021'de açık kaynak yaptığı Robyn, bu geçişi mühendislik disiplinine bağlıyor: saturasyon eğrileri, adstock decay ve holdout validation gibi istatistiksel kavramları R script'inden operasyonel pipeline'a taşımak için somut araçlar sunuyor. Bu yazıda Robyn'in çekirdeğini oluşturan üç mekanizmayı — reklam etkisinin zaman içinde azalışı, harcama-getiri ilişkisinin doymaya varışı ve modelin öngörü gücünü test eden holdout süreci — production setup içinde nasıl kuracağınızı gösteriyoruz.

## Adstock Decay: Reklam Etkisinin Zamana Yayılması

TV spot'u yayınlandığı gün satış yaratmaz, hafta boyunca etki eder. Arama reklamı tıklandığı saniyede dönüşebilir ama brand recall 3 gün sonra da conversion tetikler. Adstock terimi bu zaman gecikmesini matematiksel olarak modelleyen yapıdır. Robyn'de iki adstock tipi var: geometric ve Weibull. Geometric basit üstel azalış; her gün önceki günün etkisi `theta` parametresiyle çarpılır. Weibull ise daha esnek — etkinin yükseliş ve düşüş eğrisini bağımsız kontrol eder.

Pratik setup'ta adstock parametrelerini kanal türüne göre ayarlarsınız. Paid search genelde `theta=0.3` (hızlı decay), TV `theta=0.7` (uzun kuyruk), display `theta=0.5` civarı. Bu değerler keyfi değil — geçmiş dönem holdout setinde hiperparametre aramasıyla bulunur. Robyn'in `robyn_inputs()` fonksiyonunda `adstock` argümanını kanallar bazında set edersiniz:

```r
InputCollect <- robyn_inputs(
  dt_input = dt_simulated_weekly,
  adstock = "geometric",
  adstock_params = list(
    tv_s = c(0.3, 0.8),
    search_clicks_p = c(0.0, 0.3),
    facebook_i = c(0.0, 0.5)
  )
)
```

Burada `c(min, max)` aralığı belirtiyorsunuz; Nevergrad optimizasyon algoritması bu aralıkta en iyi `theta` değerini tarar. Geometric yerine Weibull kullanıyorsanız shape ve scale parametreleri de eklenir. Weibull'un avantajı display gibi "geç pik" yapan kanallarda daha iyi fit vermesi — etkinin ilk 2 gün düşük, 3-5. günler arasında zirveye çıkması.

Adstock'u yanlış kurarsanız model kanalların katkısını yanlış dağıtır. Örneğin TV'yi geometric `theta=0.1` ile modellerseniz sadece yayın günü etki atanır, hafta boyu gelen organik trafiği kaçırırsınız. Tersine paid search'e `theta=0.9` verirseniz 1 hafta önceki tıklamaya bugünkü satış atanır — mantıksız. Bu yüzden adstock setup'ı kanal karakteristiğine göre yapılandırılmalı, domain bilgisiyle sınırlandırılmalıdır.

## Saturasyon Eğrisi: Harcama-Getiri İlişkisinin Doymaya Varışı

Doğrusal regresyon her TL harcamanın aynı getiriyi sağladığını varsayar. Gerçekte ilk 10 bin TL'de ROAS 8 olur, 100 bin TL'de 3'e düşer, 1 milyon TL'de 1'in altına iner — marjinal getiri azalan eğri. Saturasyon bu eğriyi modelleyen transformasyondur. Robyn'de en yaygın kullanılan saturation tipi Hill equation (Michaelis-Menten):

```
y = Vmax * (x^S) / (K^S + x^S)
```

Burada `Vmax` maksimum etki, `K` yarı saturasyona ulaşılan harcama düzeyi (inflection point), `S` eğrinin dikliliği (shape). `K` düşükse kanal hızlı doyar, yüksekse geç doyar. `S>1` olduğunda eğri S-curve şekli alır — başlangıç yavaş, orta hızlı, son yavaş.

Robyn'de Hill parametrelerini de kanal bazında tanımlarsınız:

```r
hyperparameters <- list(
  tv_s_alphas = c(0.5, 3),
  tv_s_gammas = c(0.3, 1),
  search_clicks_p_alphas = c(0.5, 3),
  search_clicks_p_gammas = c(0.3, 1)
)
```

`alphas` Hill'in `S` parametresine, `gammas` `K` parametresine karşılık gelir (Robyn notasyonu). Optimizasyon bu aralıklarda en iyi fit'i arar. Ama blind aramaya bırakmayın — eğer TV bütçenizin %80'ini zaten harcıyorsanız saturasyon %90+ olmalı, yoksa model gerçekdışı marjinal ROAS üretir.

Saturasyon setup'ı budget allocation stratejisini doğrudan etkiler. Model saturation eğrisini doğru çizdiyse her kanalın marjinal ROAS'ını hesaplayıp bütçe re-allocate edebilirsiniz. Robyn'in `robyn_allocator()` fonksiyonu bunu yapar — total budget sabitken hangi kanaldan alıp hangi kanala vermek satışı maksimize eder? Ama bu öneri ancak saturasyon parametreleri doğruysa geçerli. Yanlış `K` değeri milyonlarca TL'lik yanlış karar demek.

## Holdout Validation: Modelin Öngörü Gücünü Test Etmek

MMM'nin en büyük riski overfitting — model tarihsel veriyi ezberler, gelecek tahmini yapmaz. Bunu engellemek için zaman serisi holdout validation gerekir. Robyn setup'ında son 4-8 haftalık veriyi holdout set olarak ayırırsınız, model geri kalan veriyle eğitilir, holdout döneminde tahmin yapar. NRMSE (Normalized Root Mean Square Error) ve MAPE (Mean Absolute Percentage Error) düşükse model genelleme yapıyor demektir.

```r
InputCollect <- robyn_inputs(
  dt_input = dt_simulated_weekly,
  window_start = "2022-01-01",
  window_end = "2023-10-31",
  rollingWindowStartWhich = 1,
  rollingWindowEndWhich = 52,
  rollingWindowLength = 4
)
```

`rollingWindowLength = 4` son 4 haftayı holdout yapar. Model bu 4 haftayı görmeden train olur, ardından tahmin üretir. Robyn çıktısında her model için holdout NRMSE gösterilir — %10 altı iyi, %20 üstü şüpheli. Ama tek metrikle karar vermeyin; holdout döneminde anomali var mı (kampanya, tatil) kontrol edin. Örneğin Black Friday haftası holdout'taysa model underestimate yapar, çünkü normal demand pattern'inde böyle spike yok.

Holdout sonrası modeli re-train etmek yaygın pratik — tüm veriyle final model fit edersiniz ama hiperparametreleri holdout sonuçlarına göre seçersiniz. Bu "train-validate-finalize" döngüsü. Robyn'de `robyn_refresh()` ile bunu yaparsınız:

```r
Robyn1 <- robyn_run(InputCollect = InputCollect, plot_folder = OutputCollect$plot_folder)
OutputCollect <- robyn_outputs(Robyn1, select_model = "1_100_3")
RobynRefresh <- robyn_refresh(Robyn1, dt_input = dt_simulated_weekly, refresh_steps = 4)
```

`refresh_steps = 4` son 4 haftalık yeni veriyle modeli günceller ama saturasyon/adstock parametrelerini sabit tutar (kalibrasyon korunur). Bu production'da sürekli koşan pipeline'ın temelidir — her hafta yeni satır ekler, model re-fit edilir, dashboard güncellenir.

## Robyn Pipeline'ını Production'a Taşımak

Robyn R script'i değil, üretim data pipeline'ına entegre edilmesi gereken araçtır. Tipik mimari: BigQuery'de pazarlama harcama tablosu + GA4 dönüşüm tablosu + CRM revenue tablosu → dbt ile haftalık agregat tablo → Cloud Composer (Airflow) DAG'inde Robyn R script trigger → sonuç JSON Looker Studio'da dashboard. Bu stack [first-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) içinde koşar.

İlk adım veri şemasını standartlaştırmak. Robyn `dt_input` beklediği tablo: `DATE` (haftalık), `revenue`, `tv_spend`, `search_spend`, `facebook_impressions` gibi sütunlar. Her kanal ayrı sütun olmalı; organic/paid ayrımı yoksa model attribution yapamaz. Eksik hafta varsa impute edilmeli (sıfır veya interpolasyon), outlier'lar flaglenmeli. dbt model örneği:

```sql
with base as (
  select
    date_trunc(event_date, week) as week_start,
    sum(case when source = 'google/cpc' then cost else 0 end) as search_spend,
    sum(case when source = 'facebook' then cost else 0 end) as facebook_spend,
    count(distinct case when event_name = 'purchase' then user_pseudo_id end) as conversions
  from `project.analytics_123456789.events_*`
  where _table_suffix between '20220101' and '20231231'
  group by 1
)
select * from base
order by week_start
```

Bu tablo BigQuery'den CSV export edilip Robyn script'ine feed edilir veya R `bigrquery` paketi ile doğrudan çekilir. İkincisi tercih edilir — data freshness garantisi.

Airflow DAG'inde Robyn adımı:

```python
from airflow.operators.bash import BashOperator

run_robyn = BashOperator(
    task_id='run_robyn_mmm',
    bash_command='Rscript /path/to/robyn_model.R ',
    dag=dag
)
```

Script içinde `robyn_save()` ile model objesini RDS formatında kaydedip GCS'e atarsınız. Sonraki haftalar `robyn_refresh()` ile yüklersiniz. Böylece her hafta sıfırdan eğitim yerine incremental update olur — hesaplama süresi 2 saatten 15 dakikaya düşer.

Holdout metrikleri JSON çıktısında saklanır, BigQuery'ye yazılır, Looker Studio'da trend grafiği olur. NRMSE'de ani sıçrama varsa (örn. %8'den %18'e) alert fırlatılır — model bozulmuş, re-kalibre edilmeli. Bu monitoring olmadan MMM silent failure yapar; yanlış budget allocation 3 ay fark edilmez.

## Model Çıktısını Karar Mekanizmasına Bağlamak

Robyn'in output'u kanal contribution pie chart'ı değil, marjinal ROAS tablosudur. Her kanalın son 1 TL harcamasının getirisi. Bunu kullanarak budget optimizer koşarsınız: eğer TV'nin marjinal ROAS'ı 2, search'ünki 5 ise search'e shift yapılmalı. Ama bu mekanik optimizasyon brand stratejisiyle충돌 할 수 있다 — TV brand awareness için koşuyorsa short-term ROAS'ına bakmak yanıltır.

Bu yüzden MMM sonuçları isolated karar verme aracı değil, [veri analizi](https://www.roibase.com.tr/tr/verianalizi) katmanında diğer sinyallerle sentezlenmelidir: brand lift study, incrementality test, customer lifetime value. Robyn contribution %30 diyor ama geo-lift test %15 buluyorsa ikisini reconcile etmek gerekir — model varsayımlarında hata var demektir (örn. adstock decay çok yüksek set edilmiş).

Production'da MMM haftalık refresh olur ama budget kararları aylık veya çeyreklik alınır. Yani model her hafta koşar, metrikler trende girersiniz ama 4 haftalık ortalamasına bakarsınız. Tek haftaya göre milyonluk shift yapmak volatiliteye sebep olur. Holdout validation da 4 hafta olduğu için budget review cycle'ı holdout window'la align olmalı.

Son olarak, MMM incremental attribution'un yerini almaz — tamamlar. Last-click GA4 datası short-term taktikler için, MMM long-term strateji için. İkisini farklı dashboard'larda gösterip C-level'a sunduğunuzda "hangi doğru?" sorusu gelir. Cevap: her ikisi de kendi context'inde doğru; GA4 user journey'i gösterir, MMM aggregate incrementality'yi. Budget kararı için ikisinin ağırlıklı ortalaması alınır (örn. %60 MMM, %40 GA4). Bu blend formülünü şirket kültürü ve data maturity seviyesine göre ayarlarsınız.

---

Marketing Mix Modeling artık akademik egzersiz değil, production data pipeline'ının modüler bir parçası. Robyn bu geçişi mümkün kılıyor çünkü adstock, saturasyon ve holdout gibi istatistiksel kavramları parametrize edilebilir, versiyonlanabilir, otomatize edilebilir bileşenlere dönüştürüyor. Ancak Robyn script'ini bir kere koşup PDF rapor almak yeterli değil — haftalık refresh, holdout monitoring ve budget allocator döngüsü kurulmalı. Bunu BigQuery + dbt + Airflow stack'inde yapmak ideal; böylece MMM çıktıları real-time decision engine'e beslenir, kanal performance değişince allocation otomatik adjust olur. Şimdi elinizde Robyn var; sıradaki adım onu isolated notebook'tan operasyonel pipeline'a taşımak.