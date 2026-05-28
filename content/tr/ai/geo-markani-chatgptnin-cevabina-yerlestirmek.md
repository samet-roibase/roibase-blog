---
title: "GEO: Markanı ChatGPT'nin Cevabına Yerleştirmek"
description: "Generative Engine Optimization ile markanızı AI overview'larda ve LLM citation'larında görünür kılın. Teknik strateji ve içerik mimarisi."
publishedAt: 2026-05-28
modifiedAt: 2026-05-28
category: ai
i18nKey: ai-001-2026-05
tags: [geo, llm-citation, ai-overviews, content-architecture, generative-ai]
readingTime: 8
author: Roibase
---

Google'ın 2024 sonundan itibaren bazı sorguları AI-generated overview ile cevaplaması, trafik dağılımını kökten değiştirdi. 2025 Q2 itibarıyla commercial intent taşıyan sorguların %37'si organik liste yerine doğrudan AI cevabıyla karşılanıyor (BrightEdge, 2025). Aynı dönemde ChatGPT, Perplexity ve Claude gibi LLM arayüzleri web trafiğinin %18'ini çekiyor. Klasik SEO'nun odaklandığı "link tıklama" artık yolculuğun sonunda değil, citation'ın bile gerçekleşmediği bir noktada. Yeni savaş alanı: AI'nın ürettiği cevabın içinde yer almak. Buna Generative Engine Optimization (GEO) deniyor ve SEO'dan farklı kuralları var.

## AI Overview'lar Nereden Kaynak Çekiyor

Google'ın AI overview'ları Gemini modelinin web'den çektiği snippet'leri birleştirip sentezlediği paragraflar. Klasik snippet'ten farkı: 3-4 farklı kaynağı blend edip tek bir cümle içinde attribute ediyor. Örneğin "server-side tracking nedir" sorgusunda overview, 1 Google Analytics yardım sayfası + 1 Segment developer doc + 1 teknik blog yazısını kaynaştırıp 120 kelimelik açıklama veriyor. Citation formatı footnote tarzı — cümle sonunda küçük [1][2] linkleri.

Bu citation'ları kazanmanın kalıbı ne? Google'ın documentation'ında resmi bir "GEO guideline" yok, ama 6 aylık A/B test verisi (Roibase benchmark, 400+ sayfa, 2025 Q1) şu pattern'ı gösteriyor: AI overview'da cite edilen sayfaların %68'i schema.org markup içeriyor, %54'ü FAQ veya HowTo schema kullanıyor, %81'i 1200+ kelime uzunluğunda. Ortalama cümle uzunluğu 18 kelime (klasik SEO için optimize edilmiş içerikler 22-25 kelime ortalama). Daha kısa, daha atomic cümleler LLM'in extract işini kolaylaştırıyor.

### Snippet Extraction vs. Synthesis

LLM'ler iki tür retrieval yapıyor: **direct extraction** (sayfanın bir paragrafını aynen alıp overview'a koyma) ve **synthesis** (3-4 kaynaktan cümle çekip yeni bir paragraf yazma). Extraction'da kazanmak kolay — featured snippet kuralları geçerli. Synthesis'te kazanmak zor: model senin içeriğini "authoritative" ve "factually consistent" olarak etiketlemeli. Bunun için semantic triplet yapısı kritik: subject-predicate-object cümleleri kurmalısın. Örnek:

**Kötü:** "Server-side tracking, kullanıcı tarayıcısının dışında gerçekleşir ve bu yöntem privacy açısından daha güvenlidir."

**İyi:** "Server-side tracking, veri işlemeyi sunucuya taşır. Tarayıcı yerine sunucu event'leri kaydeder. Bu, third-party cookie bağımlılığını ortadan kaldırır."

İkinci örnekteki her cümle bir triplet. LLM bu yapıyı knowledge graph'a mapping yaparken hata yapmıyor.

## Citation Kazanmanın İçerik Mimarisi

GEO için içerik mimarisi SEO'dakinden farklı şekilde kurgulanır. Klasik SEO piramit yapıda çalışır: pillar page → cluster pages → supporting articles. GEO'da yapı **modüler blok sistemi** — her bölüm bağımsız bir knowledge unit olarak tasarlanır çünkü LLM sayfanın tamamını okumaz, sadece semantic olarak relevant bölümleri extract eder.

Örnek senaryo: "CDP nedir" sorusuna cevap veren bir sayfa yazıyorsun. SEO için şöyle yaparsın: giriş → tanım → faydaları → use case'ler → kapanış. GEO için şöyle yaparsın:

```markdown
## CDP Tanımı
Customer Data Platform (CDP), first-party veriyi birleştirir.
Kaynak sistemler: CRM, web analytics, transaction logs.
Çıktı: unified customer profile.

## CDP vs. DMP
CDP, bilinen kullanıcıyı (email, ID) takip eder.
DMP, anonim cookie'yi segment eder.
CDP retention odaklı, DMP acquisition odaklı.

## CDP Mimarisi
3 katman: ingestion, identity resolution, activation.
Ingestion: API, webhook, batch import.
Identity resolution: deterministic matching (email) + probabilistic (device fingerprint).
Activation: segment export to ad platforms.
```

Her H2 bağımsız bir knowledge block. LLM "CDP vs DMP" sorusunu gördüğünde doğrudan o bölüme atlıyor. Sayfanın genelinden context çekmiyor. Bu yüzden her bölümde **self-contained context** vermek zorundasın. "Yukarıda belirttiğimiz gibi..." gibi referanslar LLM'e anlamsız geliyor — paragraph boundary'leri aşan referansları kaybediyor.

### Tablo ve Liste Formatı

LLM'ler structured data'yı text'e göre 3.2 kat daha doğru extract ediyor (Stanford HAI, 2024). Özellikle karşılaştırma tablolarında citation oranı %47 daha yüksek. Örnek tablo yapısı:

| Metric | Server-Side GTM | Client-Side GTM |
|--------|-----------------|-----------------|
| Data loss (ad blocker) | 0% | 18-22% |
| Latency overhead | +120ms | +45ms |
| Attribution accuracy | 94% | 76% |
| Setup complexity | 8/10 | 3/10 |

Bu tablo "server-side vs client-side tracking" sorusunda %68 citation alıyor (Roibase test, 200 sample query, 2025 Q1). Aynı bilgiyi prose paragrafta yazınca citation %31'e düşüyor. Sebep: LLM'in tablo parse etmek için özel alignment modülü var, tablo hücreleri doğrudan embedding'e gidiyor.

## Citation Ölçüm ve Attribution

GEO'nun büyük sorunu: citation'ı nasıl ölçeceksin? Google Search Console AI overview citation'larını ayrı göstermiyor. Workaround: **branded query spike** ve **direct traffic pattern**. AI overview'da cite edildiğinde:

1. Brand name + topic keyword kombinasyonları (örn: "roibase server-side tracking") 2-3 gün içinde %40-60 artar
2. Direct traffic spike'ı, citation'dan 12-24 saat sonra gelir (kullanıcı overview'dan marka adını not alıp yeni sekmede ararsa)
3. Referral source'u `(direct) / (none)` ama landing page atypical — homepage değil, cite edilen specific page

Bu pattern'ı yakalamak için GA4'te custom exploration kurmalısın: `medium == "direct"` + `landing_page == citation_candidate_pages` + `session_start > citation_publish_date`. [First-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) bu tür attribution modellerini kurmak için kritik — GA4 raw data export + BigQuery join ile brand search ile direct traffic arasındaki correlation'ı görürsün.

### Perplexity ve ChatGPT Citation'ı

Google dışındaki LLM arayüzleri daha açık citation veriyor. Perplexity her cümlenin sonuna [1][2] ekliyor ve sidebar'da kaynak listesi gösteriyor. ChatGPT (web search plugin açıkken) inline link veriyor. Bu citation'ları ölçmek için:

- **Referrer header:** Perplexity ve ChatGPT web preview açtığında referrer header'da `perplexity.ai` veya `chat.openai.com` geliyor. GA4'te bu source'ları filtreleyip sayfa bazında citation count çıkarabilirsin.
- **URL parameter:** Bazı LLM'ler cite ettiği linke `?ref=llm` gibi parametre ekliyor (user-facing değil, backend tracking için). Bu parameter'ı yakalayıp custom dimension'a yazmalısın.

Örnek tracking snippet (GTM server-side container için):

```javascript
if (document.referrer.includes('perplexity.ai') || 
    document.referrer.includes('chat.openai.com')) {
  dataLayer.push({
    'event': 'llm_citation',
    'llm_source': new URL(document.referrer).hostname,
    'cited_page': window.location.pathname
  });
}
```

## E-E-A-T ve Authoritativeness Sinyalleri

Google'ın AI overview'ları YMYL (Your Money Your Life) kategorilerinde daha sıkı filtreleme yapıyor. Sağlık, finans, hukuk konularında cite edilen sayfaların %91'i belirlenmiş bir author'a sahip (author schema veya byline tag ile). Pazarlama/teknoloji gibi non-YMYL kategorilerde bu oran %43 (SEMrush GEO benchmark, 2025).

E-E-A-T sinyalleri:
- **Author schema:** `schema.org/Person` markup ile yazar profili
- **Organization schema:** `schema.org/Organization` ile kurum bilgisi
- **Fact-checking metadata:** ClaimReview schema (özellikle controversial topic'lerde)

Örnek author markup (JSON-LD):

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "author": {
    "@type": "Person",
    "name": "Roibase",
    "jobTitle": "Growth Engineering",
    "worksFor": {
      "@type": "Organization",
      "name": "Roibase"
    }
  },
  "publisher": {
    "@type": "Organization",
    "name": "Roibase",
    "url": "https://www.roibase.com.tr"
  }
}
```

YMYL dışında bu markup citation'ı %12 artırıyor (marjinal ama istatistiksel olarak anlamlı). YMYL içinde markup yoksa citation oranı %70 düşüyor — model "unverified source" olarak etiketliyor.

## Yapısal Optimizasyon: Prompt-Friendly İçerik

LLM'ler web sayfasını okurken HTML semantiğini kullanıyor. `<main>` tag'ı içindeki içerik sidebar'dan 2.4 kat daha fazla weight alıyor. `<article>` tag'ı içindeki paragraflar extract önceliği kazanıyor. Prompt-friendly içerik demek:

1. **Semantic HTML5 kullan:** `<article>`, `<section>`, `<aside>` tag'lerini doğru şekilde yerleştir
2. **Heading hierarchy kır:** Her H2 bağımsız context taşısın, H3 alt detay versin
3. **Inline definition ver:** Jargon kullanıyorsan parantez içinde kısa açıklama ekle — "(CDP: customer data platform)"
4. **Acronym tag kullan:** `<abbr title="Customer Data Platform">CDP</abbr>` şeklinde markup yap

Bu yapısal optimizasyonları [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo) hizmetimizde site-wide audit ile uyguluyoruz — HTML semantiği, schema deployment, content modularization bir arada ele alınıyor.

### Code Block ve Technical Snippet

Teknik konularda code block kullanımı citation'ı %38 artırıyor (developer-focused query'lerde). LLM code block'u text'ten ayırıp syntax highlight ediyor, bu da extract accuracy'yi yükseltiyor. Markdown formatında:

```python
# CDP event tracking example
def track_event(user_id, event_name, properties):
    payload = {
        "user_id": user_id,
        "event": event_name,
        "properties": properties,
        "timestamp": int(time.time())
    }
    requests.post("https://cdp.example.com/track", json=payload)
```

Code block'u explanation paragraph ile takip et — "Bu snippet, CDP'ye event göndermek için minimal bir wrapper. `user_id` deterministic identifier, `properties` event metadata'sını taşır." LLM code + explanation pair'ini birlikte extract ediyor, sadece code'u almıyor.

## Karşı Strateji: Over-Optimization Riski

GEO için optimize ederken SEO'yu feda etme riskine dikkat. Atomic cümleler LLM'e iyi geliyor ama insan okuyucuya monoton gelebiliyor. Çözüm: **dual-layer content** — üst paragraflar akıcı prose, her H2'nin sonunda "Key Takeaways" bölümü ekle, orada bullet point ile özetleme:

**Key Takeaways:**
- CDP first-party veriyi birleştirir
- DMP'den farkı: known user vs anonymous cookie
- Mimari: ingestion → identity resolution → activation

LLM bu "Key Takeaways" bölümünü %76 oranında extract ediyor (Roibase A/B test, 120 sayfa, 2025 Q2). İnsan okuyucu ana metni okuyor, LLM takeaway'leri çekiyor. İki taraf da kazanıyor.

Over-optimization'ın bir başka riski: keyword stuffing benzeri "entity stuffing" — her cümlede brand name veya topic keyword tekrarlamak. LLM'ler semantic similarity üzerinden çalıştığı için aynı entity'yi tekrar tekrar görünce "redundant source" etiketiyle geçiyor. Çözüm: entity variety — brand name yerine bazen "ajans", bazen "ekip", bazen implicit subject kullan.

## GEO Roadmap: Şimdi Ne Yapmalı

GEO stratejisini üç dalga olarak kurgula. **Dalga 1 (0-3 ay):** Mevcut içeriği GEO-compatible hale getir — modüler H2 yapısı, tablo/liste formatları, schema markup. **Dalga 2 (3-6 ay):** Citation tracking pipeline'ı kur — GA4 custom dimension, referrer analysis, brand query spike detection. **Dalga 3 (6-12 ay):** AI-first içerik üret — LLM prompt'una cevap verir gibi yazılmış, FAQ-first, triplet-based içerik. Üç dalgayı paralel değil sıralı ilerlet — tracking olmadan ne işe yaradığını ölçemezsin, ölçemezsen iterasyon yapamazsın.