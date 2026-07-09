---
title: "iOS 17 Sonrası Ad Attribution Stack'i"
description: "ATT, SKAdNetwork 4, modeled conversions: iOS 17 sonrası mobil attribution mimarisi nasıl değişti, hangi sinyal kaynakları güvenilir, incrementality testi neden zorunlu?"
publishedAt: 2026-07-09
modifiedAt: 2026-07-09
category: marketing
i18nKey: marketing-003-2026-07
tags: [ios-attribution, skadnetwork, att, mobile-measurement, incrementality]
readingTime: 7
author: Roibase
---

iOS 14.5'ten beri mobil attribution hayatta kalma mücadelesi veriyor. iOS 17 ve 2026'nın ortasında geldiğimiz nokta: deterministik sinyaller %15-20 bandında, modeled conversions çoğunluk, SKAdNetwork 4 olgunlaştı ama standart değil, her platform kendi tahminine güveniyor. CMO'lar "hangi kanala ne kadar bütçe vereceğim" sorusunu hâlâ yanıtlayamıyor çünkü attribution stack parçalı ve çelişkili. Bu yazıda iOS 17 sonrası mobil ölçüm mimarisini, sinyal kaynaklarının güvenilirlik hiyerarşisini ve incrementality testinin neden ölçümden önemli hale geldiğini açıklıyoruz.

## Deterministik sinyaller artık çoğunluk değil

iOS 14.5'te ATT (App Tracking Transparency) geldiğinde IDFA opt-in oranları %5-15'e düştü. iOS 17'de bu band %15-20'ye çıktı ama hâlâ azınlık. Deterministik attribution — aynı kullanıcının tıkladığı ad ile uygulamada gerçekleştirdiği eventi birebir eşleştirme — artık sample data seviyesinde. Bu demografiyi segment olarak kullanabilirsiniz ama aggregate performansı oradan extrapolate edemezsiniz çünkü opt-in kullanıcılar privacy-conscious ve ad-resistant segmentten farklı davranıyor.

Kalan %80-85 için üç sinyal kaynağı var: SKAdNetwork (Apple'ın privacy-preserving framework'ü), probabilistic matching (fingerprinting artıkları) ve platform modeling (Meta/Google'ın makine öğrenmesi tahminleri). Hiçbiri deterministik değil. SKAdNetwork postback'leri event'leri aggregate ediyor, 24-144 saat gecikmeyle geliyor, conversion value encoding sınırlı (0-63 arası 6-bit integer). Probabilistic matching Apple tarafından yasaklı, yakalanan firma App Store'dan atılma riski taşıyor. Geriye kalan modeling — Meta Aggregated Event Measurement (AEM), Google Privacy Sandbox'ın noise injection mekanizmaları — ama bu tahminler cross-platform reconcile edilemiyor.

Sonuç: attribution stack'iniz artık deterministik değil probabilistik, ve bunu kabul etmek zorunda.

## SKAdNetwork 4: olgunlaştı ama standart hâlâ değil

SKAdNetwork 2023'te versiyon 4'e geçti. Başlıca yenilikler: postback'ler artık 3 aşamalı (0-2 gün, 3-7 gün, 8-35 gün), web-to-app attribution desteği geldi (SKAdNetwork-destekleyen web view'lardan uygulama indirmeleri izlenebiliyor), hierarchical source identifier ile reklam kaynağını 4 katmanda tanımlayabiliyorsunuz (campaign / ad group / creative). Conversion value encryption scheme değişmedi ama Apple postback'lerde crowd anonymity threshold'u (minimum kullanıcı sayısı) ekleyerek privacy korumasını güçlendirdi — düşük trafikli kampanyalarda postback hiç gelmiyor.

2026 ortası itibarıyla adoption oranı %60 civarı. Meta ve Google SKAdNetwork 4'ü destekliyor ama Unity Ads, ironSource, AppLovin gibi oyuncu ağları hâlâ versiyonlar arası geçişte. Bu da demek oluyor ki aynı kampanyayı farklı DSP'ler farklı SKAdNetwork versiyonlarıyla ölçüyor, dashboardlarda reconcile edilemeyen satırlar oluşuyor.

Ek sorun: SKAdNetwork postback'leri yalnızca son tıklanan adı kredilendiriyor (last-click attribution). View-through, assisted touch point yok. Çok kanallı bir kullanıcı yolculuğunda en son dokunuşu yapan network tüm conversion value'yu alıyor, ortadaki katkılar görünmez.

### Conversion value mapping örneği

```
Postback 0 (0-2 gün):
- conversion_value = 1 → install
- conversion_value = 2 → first open + onboarding tamamlandı

Postback 1 (3-7 gün):
- conversion_value = 10-20 → ilk 7 gün içinde yapılan in-app purchase tutarını 10 USD bant aralıklarına encode et

Postback 2 (8-35 gün):
- conversion_value = 30-40 → 35 güne kadar LTV tahminini 50 USD bantlarla kodla
```

6-bit limitasyonu yüzünden revenue'yu doğrudan gönderemiyorsunuz, encoding scheme'i siz belirlersiniz ve bu scheme kampanyalar arası değişebiliyor. Sonuç: apples-to-apples karşılaştırma için harici bir mapping layer gerekiyor.

## Modeled conversions: tahmin değil çoğunluk sinyali

Meta'nın Aggregated Event Measurement (AEM) ve Google'ın Privacy Sandbox modelleri artık mobil attribution stack'inin merkezi. Bu modeller IDFA'sız kullanıcıların davranışlarını makine öğrenmesiyle tahmin ediyor: kullanıcı kampanyayı gördü, uygulamayı indirdi ama deterministik link kurulamıyor — model benzer kampanya-kohort-demografik özelliklere sahip kullanıcıların geçmiş davranışlarından istatistiksel olarak tahmin ediyor.

Meta'nın 2025 raporuna göre iOS install conversion'larının %70'i modeled. Google Ads'te bu oran %60-65. Yani dashboard'unuzda gördüğünüz ROAS sayısının çoğunluğu tahmin. Bu tahminler gerçekliğe ne kadar yakın? Meta kendi validasyon testlerinde %85-90 doğruluk iddia ediyor (incrementality holdout testleriyle karşılaştırarak). Ama bu doğruluk aggregate seviyede — campaign düzeyinde bir incrementality testi yaparsanız modeled ROAS ile gerçek lift arasında ±%30 sapma görebilirsiniz.

İkinci sorun: modeled conversions platform-spesifik. Meta'nın modeli Google'ınkiyle konuşmuyor. Aynı kullanıcı her iki platformda farklı modellenmişse cross-platform deduplication imkansız. MMM (Marketing Mix Modeling) veya geo-holdout testleri olmadan hangi platformun hangi oranda katkı yaptığını bilmeniz mümkün değil.

Üçüncü sorun: model güncelleme ritimleri. Meta modelini haftada bir güncelliyorsa siz kampanyanızı durdurduğunuzda modelin öğrenmesi 7-14 gün gecikmeyle yansır. Bu da "kampanyayı durduralım, etkisini görelim" testlerini zora sokuyor çünkü model inertia yaşıyor.

## Incrementality testi artık ölçüm değil karar mekanizması

Modeled conversion'ların %70 pay tuttuğu bir dünyada dashboard rakamlarına güvenemiyorsunuz. Çözüm: incrementality testing — kampanyanın sebep olduğu gerçek artışı ölçen kontrollü deneyler. En yaygın iki yöntem: geo-holdout ve audience holdout.

**Geo-holdout:** Belirli coğrafyalarda kampanyayı kapatıyorsunuz, install veya revenue farkını ölçüyorsunuz. Örneğin iOS Meta kampanyanızı 10 eyalette durduruyorsunuz, diğer 40'ta devam ediyor, 14 gün sonra kapalı coğrafyalarda install rate'in ne kadar düştüğünü görüyorsunuz. Bu düşüş kampanyanın gerçek causal etkisi. Geo-holdout'un avantajı: hiçbir user-level veri gerektirmez, ATT'den bağımsız. Dezavantajı: kontrol ve treatment grupları arasındaki makroekonomik farklılıklar (yerel tatiller, rekabet yoğunluğu) sonucu bozabilir.

**Audience holdout:** PSA (Public Service Announcement) kampanyası veya ghost bid mekanizmaları kullanarak rastgele bir kullanıcı grubunu reklam görmekten çıkarıyorsunuz, diğer grupla karşılaştırıyorsunuz. Meta bunu Conversion Lift testleri, Google Brand Lift testleri olarak sunuyor. Holdout grubunu %5-10 tutarsanız istatistiksel güç için minimum 100.000 kişilik sample gerekiyor — yani küçük kampanyalarda çalışmaz.

İki yöntem de 14-28 gün sürüyor, bu da iterasyon hızını yavaşlatıyor. Ama iOS 17 sonrası attribution stack'inde modeled ROAS'a güvenmeden bütçe dağıtımı yapmanın başka yolu yok. [Performans Pazarlaması](https://www.roibase.com.tr/tr/ppc) çalışmalarında incrementality testlerini kampanya launch'ından önce değil, her quarter'da tekrarlayarak modelin drift'ini takip ediyoruz.

## Privacy Sandbox ve web-to-app attribution

iOS 17 Safari'nin ITP (Intelligent Tracking Prevention) kuralları daha sıkı. Web view içinden app store'a yönlendirilen kullanıcılar artık SKAdNetwork 4'ün web-to-app flow'una giriyor ama burada conversion window 24 saatle sınırlı. Yani kullanıcı web sitesinde bir kampanya gördü, 48 saat sonra uygulamayı indirdiyse bu attribution kayboluyor.

Google Privacy Sandbox'ın Topics API'si ve FLEDGE (First Locally-Executed Decision over Groups Experiment) web tarafında iOS Safari'ye alternatif sunuyor ama henüz mobil uygulama içi attribution için standart değil. 2026'da Apple'ın kendi Topics benzeri bir API yayınlayacağı söylentileri dolaşıyor ama resmi açıklama yok.

Önemli detay: web-to-app attribution zincirleri cookieless olsa bile SKAdNetwork postback'leri kampanyayı doğru kredilendiremiyor çünkü web tarafındaki click ID'sini app store redirection'ında taşıyamıyorsunuz. Apple bunun için StoreKit 2 içinde bir "web attribution token" mekanizması test ediyor ama production'da değil.

## Post-lookback maturity: 35 gün yeterli mi?

SKAdNetwork'ün en uzun postback window'u 35 gün. Ama oyun, finans ve abonelik uygulamalarında gerçek LTV 90-180 günde ortaya çıkıyor. 35. günde cohort bazlı LTV tahminini conversion value'ya encode ediyorsunuz ama bu tahmin erken churn veya late monetization'ı yakalayamıyor.

Çözüm: MMP'lerin (Mobile Measurement Partner — Adjust, AppsFlyer, Singular) post-attribution modeling katmanları. Bu araçlar SKAdNetwork postback'lerini alıp kendi deterministik data pool'larıyla (opt-in kullanıcılar) eğittikleri bir model üzerinden 90 günlük LTV tahmini yapıyor. Ama bu tahmin de model — ve MMP'nin eğitim datası sizin uygulama davranışınızı tam yansıtmıyorsa tahmin sapıyor.

Alternatif: cohort analizi manuel olarak yapmak. İlk 35 günlük SKAdNetwork datasını alıyorsunuz, aynı kohort'u 90 güne kadar manuel BI dashboard'larında takip ediyorsunuz, sonra geriye dönük olarak kampanya ROAS'ını düzeltiyorsunuz. Bu manuel süreç ama iOS 17 sonrasında "ground truth"a en yakın yöntem.

## Şimdi ne yapmalı

iOS 17 sonrası attribution stack'i dağınık, gecikmeli ve tahmin-ağırlıklı. Dashboard ROAS'larınıza güvenmiyorsanız doğru tepki veriyorsunuz. Şu adımları izleyin: SKAdNetwork 4 conversion value mapping'inizi gözden geçirin, ilk 7-14 günlük event'leri doğru encode ettiğinizden emin olun. Modeled conversion paylarını MMP dashboard'larından çekin, %70'in üstündeyse quarterly incrementality testi zorunlu. Geo-holdout veya audience holdout tercih ederken trafik büyüklüğünüze göre karar verin — günlük 1.000'den az install'da audience holdout istatistiksel anlamlılığa ulaşmaz. Web-to-app flow'unuz varsa 24 saatlik attribution window'u göz önünde bulundurun, retargeting kampanyalarını daha uzun window'lu kanallara kaydırmayı test edin. Son olarak: attribution'u görmezden gelmeyin ama karar mekanizmanızın tek girdisi yapmayın — MMM, cohort LTV analizi ve incrementality testleriyle üçgen oluşturun. iOS 17 sonrası oyun deterministik sinyallerle değil, doğru tahmini doğru kararla eşleştirmekle kazanılıyor.