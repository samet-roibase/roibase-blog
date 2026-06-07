---
title: "Privacy-First Analytics: Plausible + Sunucu Tarafı Aggregation"
description: "Cookieless ölçüm mimarisi: Plausible Analytics ile KVKK/GDPR uyumlu tracking, server-side aggregation ve GA4'e pratik alternatif."
publishedAt: 2026-06-07
modifiedAt: 2026-06-07
category: data
i18nKey: data-006-2026-06
tags: [privacy-first-analytics, cookieless-tracking, plausible, gdpr-uyum, server-side-aggregation]
readingTime: 8
author: Roibase
---

Google Analytics 4 bir şeyleri çözmedi. Consent Management Platform'lar yığındaki her aracın sıkıştırılmış haliyken, birçok kuruluş hâlâ %40-60 arası veri kaybıyla uğraşıyor. Avrupa'da Consent Mode v2 zorunluluğu, Türkiye'de KVKK denetimlerinin artması ve Apple'ın ITP 2.0 sonrası cookie ömrü kısıtlamaları birleşince ortaya tek soru çıkıyor: "Hiç cookie kullanmasak olmaz mı?" Plausible Analytics bu soruyu "evet" ile yanıtlayan, server-side aggregation ile derinleştirilebilecek bir açık kaynak alternatif. Bu yazıda Plausible'ın cookieless mimarisini, KVKK/GDPR uyumunu ve GA4'ten farklı olarak neyi takas ettiğini somut mimariye indirerek açıklıyoruz.

## Plausible Neden Cookieless Olabilir

Plausible kullanıcıyı tanımlamaz, oturumu takip etmez, yine de trafik kaynak dağılımını, sayfa performansını ve dönüşüm hunisini görebilir. Bunun mümkün olmasının nedeni ölçüm birimleri arasındaki öncelik kaydırması. GA4 event > user > session hiyerarşisinde işler; Plausible pageview > referrer > goal hiyerarşisinde çalışır. Bir ziyaretçi site.com/urun sayfasına X referrer'dan geldiğinde Plausible şu bilgiyi yazar: `{timestamp, url, referrer, device_type, country}`. Bu beş alan için hiçbir cookie, fingerprinting veya localStorage'a gerek yok. IP adresi günlük dönen bir hash ile anonimleştirilir—bu sayede aynı kullanıcının 24 saat içindeki ikinci ziyareti "bounce değil" olarak işaretlenebilir ama kalıcı kimlik saklanmaz.

Klasik analytics araçları "unique user" sorusuna cevap vermek için persistent identifier kurar. Plausible bu soruyu sormaz. Bunun yerine "bugün /pricing sayfasına 340 kişi geldi, %12'si formu doldurdu" der. Eğer pazarlama optimizasyonu landing page varyantı, kanal dağılımı ve funnel conversion'a odaklandıysa—ki SaaS, e-ticaret ve lead-gen sitelerinin %80'i için bu yeterli—cookieless model hiçbir şey kaybettirmez. GA4'ün User Explorer paneline gerek kalmaz çünkü User Explorer GDPR açısından zaten riskli bir arayüzdür.

Pratik örnekle: Bir B2B SaaS şirketi demo formu conversion rate'ini ölçmek istiyor. Plausible'da `pageview:/demo` event'ini goal olarak tanımlarsınız, ardından Plausible'ın Funnel özelliği ile `/pricing → /demo → /tesekkurler` akışını izlersiniz. Bu akış 7 günde 1200 başlangıç, 480 form, 89 teşekkür sayfası gösteriyorsa conversion %7.4. GA4'te aynı ölçümü yapmak için User ID, Client ID ve Session ID kontrolü yapmanız, Consent Mode'da modeled conversion okumaya hazır olmanız gerekir. Plausible'da bu değerler doğrudan ekrandadır.

## KVKK ve GDPR Perspektifinden Uyum Farkı

KVKK madde 5/2(e) "anonim hale getirilmiş kişisel veri" ifadesini kullanır; veri, "hiçbir şekilde kimliği belirli veya belirlenebilir gerçek kişiyle ilişkilendirilemez" hale gelirse kişisel veri sayılmaz. Plausible'ın IP hash'leme mantığı bu tanımı karşılar: IP adresi günlük rotating salt ile SHA-256'dan geçer, hash saklanmaz, sadece o gün içindeki duplicate ziyaret tespiti için bellekte tutulur. GDPR CJEU kararı (C-582/14 Breyer davası) IP adresini "kişisel veri" saydığı için salt kullanmayan hash bile yeterli değildir—Plausible rotating salt + deletion politikası ile bu riski ortadan kaldırır.

GA4 modelinde ise Consent Mode v2 altında bile modeled data kullanıcı davranışını "tahmin eder"—bu tahmin sürecinde aggregate signal pool'u yaratılır ama GDPR'ın "otomatik karar alma" maddesine (GDPR 22) değebilir. KVKK henüz bu konuda netleşmiş içtihat yok ama Kişisel Verileri Koruma Kurulu'nun 2023/891 sayılı kararı analitik cookie'leri "performans amaçlı kişisel veri işleme" kategorisine sokmuş, açık rıza şartını getirmiştir. Plausible kullandığınızda işleme faaliyeti "kişisel veri" kapsamına girmediği için VERBİS kaydı, açık rıza banner'ı veya Aydınlatma Metni'nde detaylı cookie listesi tutma zorunluluğu ortadan kalkar. Uygulamada bazı hukuk büroları yine de "ihtiyaten" banner koymayı önerir ama teknik açıdan gereklilik yoktur.

Compliance maliyeti de bu noktada keskin değişir. Orta ölçekli bir e-ticaret sitesi GA4 + GTM + OneTrust stack'i için yıllık €12,000-18,000 lisans öder (360 hariç). Plausible Business planı €99/ay, yıllık €1,188—%90 maliyet düşüşü. Şirket ayrıca Cookie Policy dokümanını 4 sayfa yerine 1 paragraf yapabilir, çünkü "üçüncü taraf cookie yok" ifadesi yeterli hale gelir. KVKK denetiminde sunulacak log dosyası da yalın kalır: Plausible event log'u sadece aggregated metrics içerir, GA4 raw event stream'i gibi user_id, client_id, session_id alanları yok.

### Consent Banner'sız Ölçümün Sınırları

Cookieless = consent-free değildir—yanlış anlaşılmasın. Plausible IP adresini işlediği için teknik olarak hâlâ veri işler, sadece bu veri "kişisel" kapsamına düşmez. GDPR recital 26 "anonim veri GDPR kapsamı dışı" der ama bazı veri koruma otoriteleri (örneğin Almanya BfDI) IP hash'i bile "teknik olarak reversibl" kabul edebilir. Türkiye'de KVKK henüz bu detayda içtihat oluşturmadı ama Avrupa'da faaliyet gösteren şirketler EDPB guidance'a uymak zorunda. Pratikte Plausible kullanan şirketler ya (1) hiç banner koymaz ve "anonim veri" gerekçesiyle KVKK/GDPR kapsamı dışı kalır, ya da (2) ihtiyaten "analytics için anonim ölçüm yapıyoruz" ifadesini privacy policy'e ekler. İkinci seçenek hukuki risk açısından daha güvenli.

## Server-Side Aggregation ile Derinleştirme

Plausible'ın dashboard'u sayfa bazlı metrik gösterir ama çoğu pazarlama ekibi şu soruyu sorar: "Hangi kampanya 50+ sayfa görüntüleme yapan kullanıcıları getiriyor?" Bu user-level segmentasyon Plausible'ın yerel özelliği değil ama server-side aggregation ile eklenebilir. Mimari şöyle işler: Plausible Events API her pageview'ı JSON olarak sunar, bu stream'i BigQuery'ye çeker, dbt model ile session oluşturur, ardından BI aracında (Looker, Metabase) cross-session analiz yaparsınız.

Örnek dbt model (simplified):

```sql
WITH raw_events AS (
  SELECT
    timestamp,
    page_url,
    referrer,
    country,
    device,
    -- IP hash 24 saatlik window'da session proxy olarak kullanılabilir
    farm_fingerprint(concat(ip_hash, date(timestamp))) AS session_id
  FROM {{ source('plausible','events') }}
)
SELECT
  session_id,
  min(timestamp) AS session_start,
  count(*) AS pageviews,
  countif(page_url like '%/checkout%') AS checkout_views,
  any_value(referrer) AS entry_referrer
FROM raw_events
GROUP BY session_id
```

Bu model ile "5+ pageview yapan sessionların %30'u organic search'ten geldi" gibi insight üretebilirsiniz—bu Plausible UI'da yok ama BigQuery'de var. Kritik nokta: Session ID hâlâ kalıcı değil, sadece 24 saatlik hash. GDPR açısından session reconstruction yapıyorsunuz ama user identity reconstruction yapmıyorsunuz. Bu farkı korumak için `farm_fingerprint(concat(ip_hash, date(timestamp)))` kullanıyoruz—tarih değişince hash de değişir, cross-day tracking mümkün değil.

Roibase'in [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) çalışması bu tür hybrid pipeline'ları kurar: Frontend'de Plausible cookieless, backend'de sGTM + Conversion API ile server-side conversion sinyali, ortada BigQuery ile session-level aggregation. Bu stack ile hem KVKK uyumlu kalır hem de GA4'ün User Explorer özelliğine ihtiyaç duymadan funnel optimization yapabilirsiniz.

## GA4 ile Karşılaştırma: Neyi Kazanır, Neyi Kaybedersiniz

GA4'ün güçlü yanları: cross-device tracking (User ID), predictive metrics (purchase probability), Google Ads entegrasyonu, modeled conversion. Plausible bunların hiçbirini yapmaz. Tradeoff açık: GA4 "bu kullanıcı kim, ne yapacak" sorusuna cevap verir, Plausible "bu sayfa/kampanya nasıl performans gösteriyor" sorusuna cevap verir. E-ticaret için hangisi kritik? Eğer lifetime value cohort'ları ve retention analysis yapıyorsanız GA4 gerekli. Eğer öncelik landing page A/B test kazananını bulmak, PPC kanallarının ROI'sını karşılaştırmak ve funnel drop-off noktalarını tespit etmekse Plausible yeterli.

Somut senaryo: 50,000 monthly visitor'lı bir DTC marka. GA4 consent rate %45 (Avrupa trafiği), Plausible %100 (consent gerektirmez). GA4'te görünen 22,500 user, Plausible'da 50,000 pageview. GA4 modeled conversion ile boşluğu kapatmaya çalışır ama model uncertainty var. Plausible raw pageview sayar, model belirsizliği yok. Pazarlama kararı kanal bütçesi dağıtımıysa (organic %30, paid social %25, direct %20...) Plausible'ın verisi daha güvenilir—çünkü sampling yok, consent bias yok. GA4'ün user-level segmentasyonu ise (örneğin "3+ ürün sepete ekleyen ama checkout yapmayan kullanıcılar") Plausible'da native değil, yukarıda gösterdiğimiz BigQuery aggregation ile manuel kurulmalı.

Maliyet farkı da önemli: GA4 ücretsiz, ama 360 limitlerine yaklaşınca (event volume, data retention) $150,000/yıl fiyatlandırma başlar. Plausible Business plan $99/ay ile 10M pageview/ay kaldırır. Küçük-orta ölçek için Plausible ekonomik, büyük ölçek için (50M+ event/ay) Plausible self-hosted çözümü gerekir—bu da infrastructure maliyeti getirir.

Entegrasyon ekosistemi GA4 lehine: BigQuery export, Looker Studio, Google Ads, Firebase, Search Console native bağlantı. Plausible'ın entegrasyonu Events API üzerinden custom kurulum gerektirir. Örneğin Plausible → BigQuery akışı için Airbyte connector veya Cloud Function yazmak gerekir. GA4 → BigQuery tıkla-çalıştır. Bu fark teknik kapasite gerektiren bir kompromis.

## Hangi Şirketler İçin Privacy-First Model Mantıklı

Üç profil öne çıkıyor. Birincisi: B2B SaaS, kurumsal yazılım, danışmanlık—zaten anonymous traffic ağırlıklı, user ID gerektirmez, funnel basit. İkincisi: Avrupa'da yoğun operasyon yapan DTC markalar—GDPR cezası riski yüksek, consent rate düşük, cookieless zorunluluk. Üçüncüsü: içerik yayıncıları—pageview ve referrer yeterli, zaten user-level profiling yapmıyorlar.

Tersine, e-ticaret oyuncuları için karar daha karmaşık. Amazon, Trendyol gibi marketplace'ler mutlaka user-level tracking yapmalı çünkü recommendation engine, cart abandonment recovery ve dynamic pricing user history'ye bağlı. Bu şirketler Plausible'ı GA4 yerine değil GA4 yanında kullanabilir—public-facing sayfalar (blog, yardım merkezi) için Plausible, checkout funnel için GA4. Hybrid model yaygınlaşıyor: Marketing site cookieless, product app cookied. Teknik olarak subdomain separation ile yapılabilir (www.site.com Plausible, app.site.com GA4).

Startup'lar için önerimiz: MVP aşamasında Plausible ile başla, seed funding sonrası GA4 ekle. İlk 6 ay zaten user cohort analizi yapmayacaksınız, kanal ROI ve landing page performance yeterli. Series A sonrası retention, LTV ve predictive modeling devreye girer, o zaman GA4 stack kurulur. Bu yaklaşım hem compliance riskini azaltır hem de analytics karmaşıklığını kademeli getirir.

---

Privacy-first analytics cookieless dünyada "ne kaybediyoruz" sorusundan "ne kazanıyoruz" sorusuna evriliyor. Plausible + server-side aggregation mimarisi şu üç değeri garanti eder: KVKK/GDPR uyumu, %100 veri coverage (consent bias yok), düşük maliyet. Karşılığında user-level profiling ve predictive metrics'ten vazgeçiyorsunuz. Eğer pazarlama stratejiniz kanal optimizasyonu, funnel iyileştirme ve sayfa performansına odaklıysa—ki çoğu şirket için bu yeterli—cookieless model sadece uyum aracı değil, aynı zamanda veri kalitesi aracıdır. Şimdi yapılması gereken şey: mevcut GA4 raporlarınızı açın, hangi metrikleri gerçekten kullandığınızı listeleyin, bunların %80'i pageview/referrer/goal bazlıysa Plausible pilot'u başlatın.