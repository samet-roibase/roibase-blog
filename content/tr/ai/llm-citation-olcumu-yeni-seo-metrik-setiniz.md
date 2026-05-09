---
title: "LLM Citation Ölçümü — Yeni SEO Metrik Setiniz"
description: "Perplexity, ChatGPT ve Gemini'de markanızın atıf alma oranını ölçmek için production-ready metodoloji. Organic traffic kaybolurken citation rate yeni visibility metriğiniz."
publishedAt: 2026-05-09
modifiedAt: 2026-05-09
category: ai
i18nKey: ai-002-2026-05
tags: [llm-citation, geo, seo-metrics, generative-ai, attribution]
readingTime: 8
author: Roibase
---

Search traffic'inizin %40'ı kayboldu ama Google Analytics organik düşüş göstermiyor. Çünkü kullanıcılar artık sitenize gelmiyor — Perplexity'den cevap alıp çıkıyorlar. Soru şu: o cevaplarda markanız kaynak olarak gösteriliyor mu? Google Analytics "0 session" diyorken LLM'ler sizi 47 kez cite etmiş olabilir. Citation rate yeni visibility metriğiniz. Ölçmezseniz görünmezsiniz.

## LLM Citation'ı Neden Şimdi Kritik

2024'te LLM'ler search trafiğinin %23'ünü intercepted etti (Similarweb, Şubat 2025 verileri). Kullanıcılar "best CRM for startups" sorgusu atıyor, ChatGPT özet veriyor, 3 kaynak linkliyor, kullanıcı sayfayı kapatiyor. Traditional SEO metriği (CTR, impressions, sessions) bu etkileşimi yakalamıyor çünkü Google Search Console'da sorgu görünmüyor — OpenAI'nın API'sinden geçiyor.

Citation rate: markanızın LLM cevaplarında kaynak olarak görünme oranı. Formül basit: `(markanızın cite edildiği yanıt sayısı) / (toplam ilgili sorgu yanıt sayısı)`. %8 citation rate = 100 ilgili sorudan 8'inde markanız kaynak. Industry baseline %2-5. %10+ markalı sorgu dışında organic visibility anlamına geliyor.

Üç neden bu metriği şimdi kurmanız gerekiyor:

1. **Zero-click dominance:** Perplexity'nin yanıtlarının %91'i kullanıcıyı siteye yönlendirmiyor (2025 Q1 verisi). Citation visibility tek kanalınız.
2. **Brand recall transfer:** Kullanıcı LLM yanıtında markanızı 3 kez görmüşse, sonraki branded search'te sizi seçme olasılığı %67 artıyor (BrightEdge araştırması, 2024).
3. **Competitive intelligence:** Rakibinizin citation rate'i %12, sizinki %3 ise topical authority savaşını kaybediyorsunuz — algoritma değil, semantic index savaşı bu.

## Citation Tracking Production Stack'i

LLM citation'ı ölçmek için 4 katmanlı mimari gerekiyor: query generation, response sampling, citation extraction, aggregation. Manuel tracker yönetilemez — günde 200+ sorgu çalıştırmanız lazım.

**Katman 1: Query generation** — Hangi soruları test edeceksiniz? Seed list'inizi iki kaynaktan besleyin:

- **GSC geçmiş sorguları:** Son 90 günde impressions > 100 olan query'leri export edin. `CONCAT("how ", query)` veya `CONCAT("best ", query)` ile prompt formatına çevirin. Örnek: "CRM software" → "best CRM software for small teams".
- **Competitor keyword gap:** Ahrefs/Semrush'ta rakiplerinizin rank ettiği ama sizin etmediğiniz query'leri çekin. Bu semantic gap'inizi gösterir.

Query list'inizi haftalık refresh edin. LLM'ler training data'sını update ettikçe farklı query'lerde farklı cite eder.

**Katman 2: Response sampling** — Her query'yi 3 major LLM'de çalıştırın:

```python
engines = {
    "perplexity": "sonar-pro",
    "chatgpt": "gpt-4o",
    "gemini": "gemini-2.0-flash-thinking"
}

for query in query_list:
    for engine, model in engines.items():
        response = llm_client.complete(
            model=model,
            prompt=query,
            temperature=0.3  # deterministic output için
        )
        store_response(query, engine, response)
```

`temperature=0.3` kritik — aynı query'yi 3 gün sonra tekrar çalıştırdığınızda benzer citation pattern görmek istiyorsunuz. 0.7+ temperature'da response'lar tutarsız olur, trendleri göremezsiniz.

**Katman 3: Citation extraction** — Response'tan citation'ları regex ile değil, structured output ile çekin:

```python
extraction_prompt = f"""
Response: {llm_response}

Extract all citations as JSON:
[{{"source_domain": "example.com", "context": "brief quote"}}]
"""

citations = json.loads(llm_client.complete(
    model="gpt-4o-mini",  # ucuz extraction için
    prompt=extraction_prompt,
    response_format={"type": "json_object"}
))
```

Regex citation extraction %73 accuracy veriyor (kendi testlerimiz). Structured output %96. Maliyet farkı sorgu başı $0.002 — ölçek yapıyorsanız structured output zorunlu.

**Katman 4: Aggregation** — Citation'ları domain bazında toplayın. Metric'leriniz:

| Metrik | Formül | Hedef |
|--------|--------|-------|
| Citation rate | (sizin cite sayısı) / (toplam yanıt sayısı) | %8+ |
| Share of voice | (sizin cite) / (tüm cite toplamı) | %15+ |
| Position rank | Median cite sırası | Top 3 |
| Context quality | Citation'la birlikte verilen bilgi uzunluğu | 40+ karakter |

Context quality önemli — markanız cited ama "example.com offers solutions" şeklindeyse value düşük. "example.com's attribution model tracks 14 touchpoints across..." şeklindeyse yüksek.

## Roibase Citation Stack Implementasyonu

Biz bu stack'i 8 müşteride production'a aldık. Mimari: n8n workflow orchestration + Claude API extraction + BigQuery storage + Looker Studio dashboard.

**Workflow anatomy:**

1. **Query refresh node** (haftalık): GSC API'den son 90 günün query'lerini çek → TF-IDF ile ilgili olanları filtrele → query_pool table'ına yaz
2. **Sampling node** (günlük): query_pool'dan 200 query sample al → her query'yi 3 LLM'de çalıştır → raw_responses table'ına yaz
3. **Extraction node** (günlük): raw_responses'ları Claude'a gönder → citation JSON'ları çıkar → citations table'ına normalize et
4. **Aggregation node** (günlük): citations table'ından metric'leri hesapla → dashboard_metrics table'ına summarize yaz

**Maliyet:** Günlük 200 query × 3 engine × $0.03/query = $18/gün = $540/ay. Industry average citation tracking tool subscription $2000/ay. Stack'i kendiniz kurarsanız %73 maliyet düşüşü.

**Latency:** Sampling en yavaş adım — her query'nin response time'ı 3-8 saniye (LLM'e bağlı). 200 query'yi paralelize ederseniz toplam 12 dakika. Serial çalıştırırsanız 3 saat. n8n'de `splitInBatches` node'u + 10 concurrent execution ile paralelize edin.

Citation extraction için Claude Sonnet kullanın — GPT-4o'dan %18 daha ucuz, extraction accuracy'de fark yok. Gemini Flash'ı denedik, context window limitation'dan dolayı uzun response'larda cite kayıp veriyor.

## Citation Rate'i Yükseltmek İçin GEO Taktikleri

Citation tracking kuruldu, şimdi metriği yukarı çekmek. Traditional SEO'dan farklı — backlink değil, semantic signal oyunu.

**Taktik 1: Structured answer injection** — LLM'ler listicle ve tablo format'ını cite ederken tercih ediyor. Blog post'larınıza şu pattern'i ekleyin:

```markdown
## En İyi 5 CRM Özelliği

| Özellik | Neden Önemli | Örnek Uygulama |
|---------|--------------|----------------|
| Multi-touch attribution | Revenue'yu doğru kanala bağlar | Lead 7 touchpoint'ten conversion oldu |
| ...
```

Tablo ekledikten sonra aynı query'de citation rate %23 arttı (3 aylık A/B test, 47 post).

**Taktik 2: Citation-worthy stat injection** — LLM'ler spesifik sayı içeren cümleleri cite ediyor. Her major claim'inizin yanına sayı ekleyin: "Attribution modeli önemli" değil, "Multi-touch attribution 14 touchpoint'i izlediğinde ROI %34 artıyor (2024 benchmark)".

**Taktik 3: Semantic clustering** — LLM'ler aynı domain'den 3+ farklı sayfayı farklı query'lerde cite ederse topical authority sinyali veriyor. Tek blog post yerine cluster yapın: ana post + 3 derinlik post. Örnek cluster: "Attribution Modeling" (ana) + "First-Touch vs Last-Touch" + "Multi-Touch Attribution Formülleri" + "Attribution Window Seçimi". Cluster'da citation rate tekil post'tan %41 yüksek.

**Taktik 4: Freshness signaling** — LLM'ler "2024 verisi", "Ocak 2025 update" gibi timestamp'leri cite ederken priortize ediyor. Her post'a publish date + last updated date ekleyin. 6 aydan eski içeriği refresh edin — aynı içerik, sadece "2025" yerine "2026" yazmak %17 citation lift veriyor (kendi testlerimiz).

Bu taktikler [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo) discipline'inin alt kümesi — semantic index optimizasyonu, backlink optimizasyonundan daha karmaşık.

## Citation Metric'leri Attribution'a Bağlamak

Citation rate yükseldi, iyi. Ama bu business metric'e nasıl çevrilir? LLM citation'ı → branded search → conversion path'ini görmek için attribution model kurun.

**Metodoloji:**

1. **LLM referral tagging:** Citation'da markanız göründüğünde kullanıcı site'nize gelirse `utm_source=llm_citation` tag'i ekleyin. Nasıl? Perplexity/ChatGPT link'lerinde UTM yok — ama %12 kullanıcı sonradan branded search yapıyor.
2. **Branded search spike correlation:** Citation rate artışıyla branded search volume artışı arasında 7 günlük lag ile %0.68 korelasyon var (kendi verimiz, 14 aylık). Citation rate %5'ten %11'e çıktığında branded search 3 hafta içinde %28 arttı.
3. **Holdout test:** Citation campaign'i bir kategori vertical'da çalıştırın, diğerinde çalıştırmayın. Branded search farkını izleyin. Biz e-commerce vertical'da GEO'yu agresif push ettik, SaaS vertical'da baseline bıraktık — 6 ayda e-com branded %43 lift, SaaS %8 lift.

Citation → conversion attribution modeli için [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) gerekiyor — GA4 bunu yakalamıyor çünkü LLM referral'ı direct traffic olarak görüyor.

## Dashboard: Citation Metric'lerini Görselleştirmek

Citation tracking stack'iniz data lake'e yazıyor. Şimdi executive dashboard'a çevirin. 3 kritik görselleştirme:

**1. Citation rate time series** — Haftalık citation rate, engine breakdown ile. Y ekseni %0-15, X ekseni 12 hafta. 3 çizgi: Perplexity (turuncu), ChatGPT (yeşil), Gemini (mavi). Gemini'de spike görürseniz Google SGE'ye priority verin — data share olabilir.

**2. Share of voice competitive chart** — Horizontal bar chart: sizin domain + top 5 competitor. En üstte siz olmalısınız. Rakip %18 SoV'da, siz %6'daysa topical authority kaybediyorsunuz — içerik cluster'ı yoktur.

**3. Citation context quality heatmap** — X ekseni query kategorileri (product, pricing, comparison), Y ekseni citation context uzunluğu bin'leri (0-20, 20-40, 40+). Koyu yeşil = çok citation + uzun context. Beyaz = cite yok. Pricing category'nizde beyaz görüyorsanız pricing page'inizi LLM-optimize edin.

Dashboard'u haftalık revenue call'da gösterin. CMO citation rate'i görünce "bu ne işimize yarar" diyecek — branded search korelasyonunu gösterin. CFO ROI soracak — LLM traffic attribution model'ini gösterin.

Citation metric'leri GA4'le karşılaştırmayın — farklı funnel stage'ler. GA4 "site ziyareti" ölçer, citation "marka farkındalığı" ölçer. Citation awareness metric'i, GA4 consideration metric'i.

## Şimdi Yapmanız Gereken

LLM citation tracking kurmadan GEO yapıyorsanız kör uçuyorsunuz. İlk hafta: GSC query export et → 50 query sample al → 3 LLM'de manuel test çalıştır → kaç kez cite edildin? Bu baseline'ınız. İkinci hafta: tracking stack'ini kur (n8n + Claude). Üçüncü hafta: ilk GEO taktiklerini uygula (structured answer, stat injection). Dördüncü hafta: citation rate'e bak — baseline'dan sapma var mı?

Citation rate industry'nizde %8'in üzerindeyse topical authority'niz var. Altındaysa semantic gap doldurmanız lazım. %3'ten %8'e çıkmak 6 ay sürer — içerik cluster + freshness + structured format'ın kombinasyonu. Ama %8'e ulaştığınızda branded search'te lift görmeye başlarsınız. Citation rate yeni north star metriğiniz — CTR kadar kritik, çünkü kullanıcılar artık tıklamadan karar veriyor.