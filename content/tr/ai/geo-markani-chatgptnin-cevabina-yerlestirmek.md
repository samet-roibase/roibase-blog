---
title: "GEO: Markanı ChatGPT'nin Cevabına Yerleştirmek"
description: "AI overviews ve LLM citation'larında görünürlük kazanmak için içerik mimarisi, veri katmanı ve teknik altyapı stratejileri."
publishedAt: 2026-07-23
modifiedAt: 2026-07-23
category: ai
i18nKey: ai-001-2026-07
tags: [geo, llm-optimization, ai-overviews, content-architecture, citation-engineering]
readingTime: 8
author: Roibase
---

Google'ın 2024'te %27 oranında SGE (Search Generative Experience) sonuçları göstermeye başlaması, 2025'te ChatGPT'nin günlük 500 milyon sorguya ulaşması ve Perplexity'nin citation metrikleri yayınlaması yeni bir gerçeği kanıtlıyor: kullanıcılar artık arama motorlarına değil, üretken modellere soruyor. Klasik SEO'nun SERP'te 1. sırada olma mantığı, LLM'lerin citation mekanizmasında "tercih edilen kaynak" olma mantığına kayıyor. Generative Engine Optimization (GEO), bu kaymanın mühendislik disiplini. Bu yazı, markanızı ChatGPT, Claude, Gemini gibi modellerin yanıt akışına nasıl yerleştireceğinizi — teknik altyapı, içerik mimarisi ve ölçüm katmanı perspektifinden — açıklıyor.

## LLM Citation Mekanizması: Embedding Vektörü ve Retrieval Pipeline

GPT-4o, Claude Opus veya Gemini bir soruya yanıt verirken gerçekte şunu yapıyor: kullanıcı girdisini embedding vektörüne çeviriyor, bu vektörü index'lenmiş bilgi havuzunda (web scraping + curated data + API kaynaklarında) benzerlik araması (cosine similarity / HNSW) ile eşleştiriyor, en yüksek skor alan chunk'ları retrieval context'e alıp final yanıtı oluşturuyor. "Citation" dediğimiz şey, o chunk'ın hangi URL'den geldiği. 

Dolayısıyla görünür olmak için iki şey kritik: (1) içeriğiniz embedding uzayında sorgu vektörüne yakın olmalı, (2) chunk'ınız retrieval pipeline'ında yüksek skor almalı. Bu iki hedef için yapmanız gereken: **yapısal netlik**, **dilsel yoğunluk** ve **authoritative sinyaller**.

Örnek: "performance marketing attribution nedir" sorusuna ChatGPT yanıt verirken, yanıtın ilk paragrafında referans gösterdiği site genelde şu özelliklere sahip: (a) başlıkta sorgu kelimeleri var ama generic değil (örn: "Server-Side Attribution: Cookie Sonrası Ölçüm Mimarisi"), (b) içerik structured data ile işaretlenmiş (JSON-LD schema), (c) sayfa hızlı yüklenip LLM crawler tarafından başarıyla parse edilmiş, (d) backlink / domain authority yüksek. Bu dört kriter teknik bir altyapı gerektirir.

## İçerik Mimarisi: Chunk-Friendly Yapı ve Semantic Density

LLM'ler web sayfalarını chunk'lara böler (genelde 512-1024 token). Bir chunk içinde konuyla ilgili tüm bağlam varsa retrieval skoru yükselir. Bu yüzden GEO'da **paragraf başına tek mesaj** prensibi temel. Her H2 altında 150-250 kelimelik bir birim, o başlığın konusunu tam açıklayıp kapatmalı. Uzun, dolanan paragraflar chunk'ı boşa harcatır.

Semantic density: birim token başına kaç tane domain-spesifik entity var. "Pazarlama attribution'ı önemlidir" cümlesi düşük density. "Server-side GTM ile first-party cookie'den gelen dönüşüm sinyalini BigQuery'ye aktarıp incrementality testleriyle doğrulamak, iOS 14.5 sonrası attribution precision'ın temeli" cümlesi yüksek density. LLM'ler ikincisini daha yüksek skorlar çünkü embedding vektörü daha zengin.

### Structured Data: Schema.org ve JSON-LD

Google SGE ve Bing Copilot, schema.org markup'ı olan içeriği %43 daha fazla cite ediyor (BrightEdge, 2025 raporu). JSON-LD ile `Article`, `HowTo`, `FAQPage` gibi schema'ları eklemek, LLM crawler'larının sayfa yapısını anlamasını kolaylaştırır. Ancak schema eklemenin tek başına işe yaraması için içerik gerçekten schema'ya uygun yapıda olmalı — örneğin `HowTo` schema'sı koyup içerikte adımları belirtmiyorsanız crawler uyumsuzluk skorlar.

Minimum uygulama: her blog yazısına `Article` schema ekleyin. `author`, `datePublished`, `headline`, `description` alanlarını doldurun. Bu bilgiler LLM'lerin "kaynak güvenilirliği" heuristiklerinde kullanılır.

## API + First-Party Veri: LLM'lere Doğrudan Besleme

2026'da OpenAI, Anthropic ve Google hepsi brand plugin / API mekanizmaları açtı. Markanız bir API endpoint sunarak (örn: `/brand-context.json`), LLM'lerin sizin hakkınızda yanıt verirken kullanacağı context'i doğrudan kontrol edebilirsiniz. Bu klasik SEO'dan radikal bir kopuş: arama motoru sayfanızı crawl edip index'ler ama siz o index'i değiştiremezsiniz. API modelinde siz "brand memory" blob'unu sunuyorsunuz.

Roibase'in [first-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) çalışması bu noktada kritik hâle geliyor: CDP'den gelen müşteri davranış verisi, API olarak sunulan brand entity verisi, LLM'in o veriyi güvenilir kaynak olarak cite etmesi — hepsi aynı veri hat modeli içinde. Örnek: bir e-ticaret markası, satış hacmi, kategori dağılımı, müşteri segmentleri gibi özet metrikleri `/brand-metrics.json` olarak sunuyor. ChatGPT "X markası hangi kategoride güçlü" sorusunu cevaplarken bu endpoint'ten veri çekip cite ediyor. Attribution tam, güncelleme sizin elinizde.

Teknik uygulama: JSON endpoint, CORS header'ları düzgün ayarlı, her field için schema tanımlı, update timestamp var. OpenAI plugin manifest (`ai-plugin.json`) veya Anthropic MCP (Model Context Protocol) formatında yayınlıyorsunuz. Bu altyapı olmadan LLM'ler 3. parti veri kaynaklarına dayanır, sizin kontrol gücünüz sıfıra yakın.

## Authoritative Signal Engineering: Backlink Değil, Citation Graph

SEO'da backlink sayısı domain authority'nin temel sinyali. GEO'da ise LLM'lerin kullandığı "citation graph" farklı çalışır: bir site kaç kez cite edilmiş (LLM yanıtlarında kaynak gösterilmiş) + o citation'lar ne kadar çeşitli sorgu tiplerinde dağılmış. Aynı soruya 100 kez cite edilmek yerine 10 farklı sorguya 10 kez cite edilmek daha değerli.

Bu yüzden GEO stratejisi **topical breadth** gerektirir. Sadece "performance marketing" üzerine 50 yazı değil, aynı zamanda "attribution modeling", "incrementality testing", "marketing mix modeling", "server-side tracking", "first-party data compliance" gibi komşu konuların da derin içerikleri. LLM'ler farklı sorularda farklı yazılarınızı cite ederse, "bu kaynak bu domaine hâkim" sinyali oluşur.

Ölçüm: LLM citation tracking henüz standartlaşmamış. Roibase'in [veri analizi](https://www.roibase.com.tr/tr/verianalizi) katmanında yaptığımız: ChatGPT API'ye sorgu atıp yanıtta kendi URL'mizi arıyoruz (regex pattern match). Perplexity'nin analytics API'si citation count veriyor. Bing Copilot için "site:roibase.com.tr" ile SGE yanıtlarındaki görünürlüğü manuel tarayıp log'luyoruz. Bu metrikleri haftalık dashboard'a çekip hangi konuların citation kazandığını izliyoruz.

## Tradeoff: İçerik Hızı vs. Derinlik

GEO'da çok hızlı içerik üretmek SEO'daki kadar işe yaramıyor. LLM'ler thin content'i kolayca filtreler çünkü embedding uzayında benzer içerikler kümeleniyor, özgün mesajı olmayan yazı düşük skor alıyor. 10 günde 100 yazı yerine 3 ayda 20 yazı — her biri 1500+ kelime, 5+ H2, somut veri içeren, schema markup'lı — daha etkili.

Ancak bu tradeoff maliyeti artırır. Bir markanın SEO için yaptığı content operasyonu (aylık 50 blog yazısı) GEO'ya geçtiğinde aylık 15 yazıya düşebilir. ROI hesabı: LLM citation'ı organik trafik gibi compound büyüme gösteriyor mu? 2026 verisi: bir citation'ın average click-through'u %12 (SearchGPT analytics), ama bir citation aldığınızda sonraki 30 gün içinde 4-5 related sorguya daha cite ediliyorsunuz (cascading effect). Bu cascade, compound faydayı doğruluyor.

## Şimdi Ne Yapmalı: Teknik Checklist

GEO altyapısını 3 katmanda kurun: (1) içerik mimarisi — her yazıya schema ekle, H2 başına 200-250 kelime, semantic density kontrol et; (2) API katmanı — brand context endpoint aç, plugin manifest yayınla, first-party veriyle besle; (3) ölçüm — LLM citation tracking kurulumu, haftalık dashboard. İlk 90 günde 15-20 derinlikli yazı yayınla, citation graph'ı izle. 6. ayda topical breadth'i genişlet. Klasik SEO'yu bırakma, GEO'yu paralel yürüt — SERP görünürlüğü hâlâ geçerli, ama LLM citation'ı 2027'de trafiğin %30-40'ını oluşturacak (Gartner tahmini). Attribution modelin her iki kanalı da görmeli.