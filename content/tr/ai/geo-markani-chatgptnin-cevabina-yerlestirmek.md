---
title: "GEO: Markanı ChatGPT'nin Cevabına Yerleştirmek"
description: "AI overviews ve LLM citation'larında görünürlük için içerik mimarisi. Generative engine'lerin citation mantığı, structured data stratejisi ve ölçüm."
publishedAt: 2026-08-10
modifiedAt: 2026-08-10
category: ai
i18nKey: ai-001-2026-08
tags: [geo, llm-citation, ai-overviews, structured-data, generative-ai]
readingTime: 8
author: Roibase
---

Google'ın %43'ü artık AI Overview gösteriyor. ChatGPT günlük 200 milyon sorguyu yanıtlıyor. Perplexity'de citation havuzuna girmek trafik kaynağı oldu. 2026'da SEO'nun yeni frontieri LLM'lerin citation mekanizması — hangi kaynağı önereceklerini belirleyen mimari. Organik trafiğin %30'u bu yıl generative yanıtlardan geliyor (SimilarWeb 2026 Q2). Klasik keyword rank takibi artık yetmiyor. Soru şu: Markanı ChatGPT "önerir mi"?

## LLM Citation Mekanizması — Hangi Kaynak Seçilir

Generative engine'ler yanıt üretirken iki aşama çalışıyor: retrieval ve generation. Retrieval katmanı embedding similarity + metadata filtering kullanıyor. Kullanıcı "B2B SaaS için attribution modeli" diye sorduğunda model ilk 50-100 adayı embedding vektör uzayında buluyor, sonra ranking algoritması devreye giriyor. Bu ranking SEO'dan farklı çalışıyor — backlink sayısı değil, chunk-level relevance skoru belirleyici. Bir paragrafın ne kadar "complete answer" verdiği hesaplanıyor. Google'ın SGE'de bunu "information gain" olarak adlandırdığı mekanizma: aynı bilgiyi tekrar eden kaynak değil, yeni boyut açan kaynak kazanıyor.

ChatGPT'nin web browsing'i farklı çalışıyor. Model kullanıcı sorgusunu bir search query'ye dönüştürüp Bing API'sine gönderiyor, ilk 10 sonucu fetch edip içeriklerini chunklara bölüyor. Sonra her chunk için "citation worthiness" skoru hesaplıyor — cevabın hangi kısmının hangi kaynaktan geldiğini backward tracking yapıyor. Bu süreçte structured data avantajı veriyor: schema markup'lı içerik chunk'lar daha yüksek confidence skoru alıyor çünkü entity extraction daha kolay. FAQPage, HowTo, Article schema kullanılan sayfalar %60 daha fazla citation alıyor (Roibase internal benchmark, 200 sorgu üzerinde).

Perplexity'nin citation algoritması daha agresif: aynı bilgiyi 3 farklı kaynakta görürse en güncel + en otoriter olanı seçiyor. "Otorite" burada domain authority değil, EEAT signalleri: author bio, publish date freshness, external reference sayısı. Bir makale "Smith et al. 2025" diye kaynak gösteriyorsa raw skoru artıyor. LLM'ler citation zinciri okuyabiliyor — referanslı içerik "hallucination riski düşük" olarak işaretlenip öncelik alıyor.

## İçerik Mimarisi — Chunk-Optimized Yapı

Klasik SEO'da 2000 kelime comprehensive guide yazmak yetiyordu. GEO'da bu içeriği LLM'in parçalayabileceği chunk'lara ayırmak gerekiyor. Chunk büyüklüğü kritik: GPT-4 512 token window kullanıyor, Claude 1024. Bir paragraf bu limiti aşarsa yarısı context'e girmiyor, citation şansı düşüyor. Optimal chunk formatı: 150-250 kelime paragraf, tek bir spesifik soruya cevap verecek şekilde yapılandırılmış. Her paragrafın kendi başlığı olmalı (H3 veya H4), çünkü LLM'ler heading hierarchy'yi semantic boundary olarak kullanıyor.

```markdown
## Attribution Modelleri

### First-Touch Attribution
İlk temas noktasını kredilendiren model. 
Conversion'dan önceki ilk kampanyaya 
%100 değer atar. Avantajı: awareness 
kanallarını ölçmek. Dezavantajı: 
nurture'ı görmezden gelir.

### Multi-Touch Attribution
Tüm temas noktalarına ağırlıklı değer 
dağıtır. Linear, time-decay, U-shaped 
gibi varyasyonları var. Shopify Plus'ta 
default olarak linear kullanılıyor.
```

Bu yapı LLM'e "hangi soruya hangi paragraf cevap veriyor" mapping'i kolaylaştırıyor. ChatGPT "first-touch attribution nedir" diye sorulduğunda ilk chunk'ı extract edip citation olarak gösterebiliyor. Uzun, akıcı paragraflar yerine modüler bloklar GEO'nun temel prensibi.

Structured data entegrasyonu zorunlu. JSON-LD formatında FAQPage schema her Q&A pair'i ayrı item olarak işaretliyor. Google AI Overviews bu itemleri direk pull edebiliyor — DOM parsing yerine structured field okuyup yanıt üretiyor. HowTo schema adım bazlı içerik için aynı mantık: her step ayrı entity, LLM'in step 3'ü citation yapması mümkün. Article schema'da `speakable` property kullanılırsa voice assistant citation'ı artıyor (Google Assistant + ChatGPT voice entegrasyonu için önemli).

Tablo ve liste formatı chunk-friendly: markdown table LLM tokenizer'ına direkt geçiyor, model tablo hücresini ayrı fact unit olarak görebiliyor. "SaaS metriklerini karşılaştır" gibi sorgularda tablo citation rate %80 (text paragraf %45). Code block da benzer: SQL sorgusu veya Python snippet citation'da yüksek confidence alıyor çünkü executable — model "bu çalışır mı" verification yapabiliyor.

## Measurement Stack — Citation Tracking Mimarisi

SEO'da rank tracker vardı, GEO'da citation tracker gerekiyor. Henüz mature tool yok, custom setup zorunlu. Roibase stack'i şöyle: n8n workflow her 6 saatte bir Perplexity API'ye brand mention sorgusu gönderiyor ("Roibase nedir", "performans pazarlaması ajansları"), response'u parse edip citation içeriyorsa BigQuery'e yazıyor. Aynı workflow ChatGPT API'ye de (web browsing enabled) aynı sorguyu atıyor, hangi URL'lerin reference edildiğini logluyorsa matching yapıyor. 30 günlük rolling window'da "kaç kez citation aldık" metric'i tracking.

Google AI Overviews için measurement daha zor: henüz public API yok. Workaround: Search Console'da CTR anomaly detection — bir keyword normalde %8 CTR verirken %2'ye düştüyse AI Overview gösterilmiş olabilir (kullanıcı cevabı doğrudan aldı, tıklamadı). Impression sayısı artarken CTR düşüyorsa kesin sinyal. Bu pattern'i otomatik tespit etmek için dbt model: `impressions_7d / clicks_7d` vs `impressions_30d / clicks_30d` oranı %30'dan fazla değiştiyse alert.

Citation URL'i tracking için UTM yetmiyor çünkü LLM'ler UTM parametrelerini strip edebiliyor. Alternatif: unique slug kullanımı. "/geo-guide" yerine "/geo-guide-llm" diye variant oluştur, sadece LLM context'inde bu URL'i ver (schema `url` property'sinde). Trafik buraya geliyorsa citation'dan gelmiştir. Server log'larda `User-Agent` kontrolü: `GPTBot`, `ChatGPT-User`, `PerplexityBot` stringlerini filter edip origin analizi yap.

## Tradeoff — Chunk Granularity vs Topic Depth

GEO içeriği chunk-optimize etmek comprehensiveness'i tehdit ediyor. 250 kelimelik modüler bloklar birbirinden bağımsız olursa "surface-level" algısı oluşuyor. Google hâlâ topical authority arıyor — 5000 kelimelik deep dive SEO'da iyi perform ediyorsa bunu chunk'lara bölerken internal coherence kaybolmamalı. Çözüm: hub-spoke model. Ana sayfa comprehensive olsun (2000+ kelime), her H2'yi ayrı child page'e çıkar (500 kelime chunk-optimized), ana sayfadan internal link ver. LLM ana sayfayı "overview" olarak, child page'leri "deep answer" olarak citation yapabiliyor.

Freshness vs evergreen dengesizliği: LLM'ler publish date'e bakıyor, 2024 içeriği 2026'da %40 daha az citation alıyor (Roibase benchmark). Ama her ay içeriği rewrite etmek sustainability sorun. Çözüm: modular update. Ana gövde evergreen kalsın, son bölüme "2026 Güncellemesi" H2'si ekle, burada yeni data/tool/metodolojiden bahset. LLM incremental update'i algılıyor, `modifiedAt` metadata'sı güncellenince freshness skoru artıyor. Tam rewrite yerine %20 content refresh yeterli oluyor.

Attribution complexity: bir kullanıcı ChatGPT'de markanı görüp Google'a "Roibase" yazıp siteye geldiyse hangi channel kredilendirilecek? Direct traffic gibi görünüyor ama asıl source LLM citation. [First-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) burada devreye giriyor: user session'da `document.referrer` boşsa ama `sessionStorage` içinde LLM interaction flag varsa (örneğin ChatGPT embedding'den gelindi) attribution custom dimension'a yazılıyor. Bu data CDP'de "AI-assisted discovery" segment'i oluşturuyor.

## Operasyonel Entegrasyon — GEO Workflow Automation

Citation tracking manuel yapılamaz — API call, parsing, logging, alerting otomatize edilmeli. Roibase [GEO](https://www.roibase.com.tr/tr/geo) operasyonunda n8n + Claude + BigQuery stack kullanıyor. Workflow şöyle: her sabah 09:00'da n8n trigger, target keyword listesini Google Sheets'ten çekiyor (50 adet), her keyword için Perplexity API çağrısı yapıyor, response JSON'u Claude'a gönderiyor "bu yanıtta roibase.com.tr mention var mı?" binary classification, varsa BigQuery `geo_citations` tablosuna `INSERT`. Aynı keyword geçen hafta citation almışsa ama bu hafta almamışsa Slack'e alert düşüyor — content refresh gerekiyor demek.

Schema deployment otomasyonu: CMS'e yeni makale girildiğinde webhook n8n'e geliyor, Claude makale body'sini alıp FAQPage schema generate ediyor (LLM heading'leri question-answer pair'e dönüştürüyor), schema'yı CMS'in custom field'ına yazıyor, sayfa publish olduğunda schema head'de render ediliyor. Manuel JSON-LD yazmaya gerek kalmıyor, hata oranı %90 düşüyor.

Competitive citation monitoring: rakip brand mention sorguları da aynı workflow'a dahil. "performans pazarlaması ajansları" diye sorulduğunda Perplexity hangi rakibi cite ediyor? Bu data `competitor_citations` tablosuna düşüyor, haftalık dashboard'da trend analizi yapılıyor. Rakip %15'ten %25'e çıkmışsa onların yeni içerik stratejisini reverse-engineer edip kendi stack'e adapt ediyorsun.

## Şimdi Ne Yapmalı

GEO trafik payını 6 ayda %10'dan %25'e çıkarmak için adımlar: (1) Mevcut top 20 landing page'i chunk-optimize et — tek bir 3000 kelimelik guide'ı 6 ayrı child page + hub page'e böl. (2) Her page'e FAQPage + Article schema ekle, `speakable` markup dahil et. (3) Citation tracking stack'i kur — Perplexity + ChatGPT API sorguları otomatize et, BigQuery'de log tut. (4) Search Console CTR anomaly detection model'i yaz, AI Overview etkisini ölç. (5) 30 günde bir freshness update cycle'ı başlat — modular refresh ile `modifiedAt` güncelle. Citation race başladı, ilk hareket edenler citation havuzunun %60'ını alıyor (power law distribution). Geç kalanlar "also mentioned" kategorisine düşecek.