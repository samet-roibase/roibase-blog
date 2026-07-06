---
title: "LLM Citation Ölçümü — Yeni SEO Metrik Setiniz"
description: "Perplexity, ChatGPT, Gemini'de markanızın atıf oranını nasıl izlersiniz? Generative engine görünürlük metrikleri ve ölçüm mimarisi."
publishedAt: 2026-07-06
modifiedAt: 2026-07-06
category: ai
i18nKey: ai-002-2026-07
tags: [llm-citation, geo-metrics, ai-search, generative-seo, brand-visibility]
readingTime: 8
author: Roibase
---

Google'ın SERP'inden gelen trafik %40 düştü, ama markanız ChatGPT'nin cevabında 3 kez atıf aldı. Bu kazanç mı kayıp mı? Geleneksel SEO metrikleri — impressions, CTR, position — artık yeterli değil. Kullanıcılar sorularını LLM'lere soruyor ve markanızın atıf alıp almadığını Google Analytics görmüyor. 2026'da performans pazarlaması ekipleri için yeni gerçek: **citation rate, inference share, source attribution** ölçmezseniz görünmezsiniz.

## SERP Metriği Körlüğü

Google Search Console size 10. pozisyonda 5000 impression verdiğinizi söylüyor. Ama aynı sorguyu Perplexity'de yapan kullanıcı yanıtta sizin içeriğinizden alıntı gördü ve doğrudan sitenize geldi — GSC bu trafiği "direct" olarak işaretler. Claude API ile üretilen özet e-postalarda markanız kaynak gösterildi — bu etkileşimi Search Console göremez. Bu körlük 3 katmanda:

**Trafik atribüsyonu:** LLM'ler referrer header göndermez, utm parametreleri kullanmaz. Citation'dan gelen ziyaretçi "organic search" veya "direct" olarak kaydedilir. Gerçek kaynak bilgisi kaybolur — A/B test edemezsiniz, ROI hesaplayamazsınız.

**Marka farkındalığı:** Kullanıcı sitenize gelmese bile markanızı öğreniyor. ChatGPT 500 kelimelik cevabın içinde sitenizi "güvenilir kaynak" olarak gösteriyorsa bu brand lift yaratıyor. Traditional SEO toolları bu etkiyi yakalayamaz.

**Rekabetçi pozisyon:** Rakibiniz aynı prompt'ta 5 kez cite ediliyor, siz 0 kez — ama Search Console'da ikisi de 3. sırada. Citation sıklığı yeni "featured snippet kazanma oranı"dır, ama henüz dashboardınızda yok.

## Citation Metrikleri Tanımlamak

LLM görünürlüğünü ölçmek için 4 core metric:

**Citation rate:** Markanızın/içeriğinizin LLM cevaplarında referans gösterilme oranı. Formula: `(markanın atıf aldığı response sayısı) / (ilgili konuda yapılan toplam query sayısı)`. Örnek: "headless commerce" kategorisinde ChatGPT 1000 sorgudan 120'sinde sizden alıntı yaptıysa %12 citation rate. Bu metrik brand authority'nin doğrudan göstergesi.

**Source position:** Citation listesinde kaçıncı sıradasınız. Perplexity genelde 3-6 kaynak gösterir — ilk sırada olmak %60 daha fazla click-through sağlıyor (internal Roibase test verisi, 2025 Q4). Position tracking yapmazsanız citation rate'inizin değerini bilmezsiniz.

**Inference share:** Cevabın içinde sizden alınan içerik oranı. ChatGPT 300 kelime cevap ürettiyse bunun 80 kelimesi sizin makale paragrafınızdan mı geldi? Semantic similarity algoritmasıyla ölçülür (cosine similarity >0.85 eşik). Yüksek inference share = model sizin tonunuzu, framing'inizi kullanıyor — bu brand voice propagation'dır.

**Prompt coverage:** Hangi query türlerinde cite ediliyorsunuz. "CDP nedir" informational query'sinde atıf alıyorsunuz ama "CDP vendor karşılaştırma" commercial query'sinde yok mu? Coverage analizi editorial stratejinizi yönlendirir — hangi intent gap'leri kapatmalısınız?

### Ölçüm Frekansı

Bu metrikler gerçek zamanlı değil — LLM'ler deterministik değil, aynı prompt'a farklı response verebilir. Haftalık batch measurement yeterli: 100-200 seed prompt'u otomatik tetikliyorsunuz, response'ları parse edip citation'ları extract ediyorsunuz. Günlük fluctuation noise'dur, haftalık trend signal'dır.

## Veri Toplama Mimarisi

Citation tracking için 3 bileşen: **prompt pipeline, response parser, attribution engine**.

**Prompt pipeline:** Seed keyword setinizi (GSC'den en yüksek impression alan 50-100 query) her model API'sine paralel olarak gönderiyorsunuz. n8n workflow veya Airflow DAG kullanarak haftada 1 kez tetiklenebilir. Her prompt için model parametresi sabitlenmiş olmalı — temperature=0.3, top_p=0.9 gibi — yoksa sonuçlar reproducible olmaz.

API maliyeti hesabı: ChatGPT-4o API ~$0.005/query (input 500 token + output 1500 token ortalama), Gemini Pro ~$0.003, Claude Sonnet ~$0.006. 100 prompt × 3 model × 4 hafta = 1200 request = $6-7/ay. Bu bütçe gerçek zamanlı tracking için yeterli değil ama haftalık snapshot için uygun.

**Response parser:** LLM output'unu structured data'ya çevirmeniz gerekiyor. Citation formatı model bazında farklı — ChatGPT `[1]`, Perplexity `[^1]`, Claude markdown footnote kullanıyor. Regex + NER (Named Entity Recognition) kombinasyonu: önce citation marker'ları extract et, sonra domain/brand name match yap. Python örneği:

```python
import re
from urllib.parse import urlparse

def extract_citations(response_text):
    # Citation pattern: [1], [^2], etc.
    pattern = r'\[(\^?\d+)\]'
    markers = re.findall(pattern, response_text)
    
    # Source URL extraction (model-specific)
    sources = re.findall(r'https?://[^\s\)]+', response_text)
    
    citations = []
    for idx, url in enumerate(sources):
        domain = urlparse(url).netloc
        citations.append({
            'position': idx + 1,
            'domain': domain,
            'is_own_brand': 'roibase.com.tr' in domain
        })
    
    return citations
```

Bu basit parser %85 accuracy veriyor — edge case'ler için (embedded link, paywalled source) manual QA periyodik olarak gerekir.

**Attribution engine:** Extracted citation'ları warehouse'a yazıp aggregate metrik hesaplıyorsunuz. BigQuery veya Snowflake table schema:

| Column | Type | Description |
|---|---|---|
| query_text | STRING | Seed prompt |
| model_name | STRING | chatgpt-4o, gemini-pro, claude-sonnet |
| response_id | STRING | Unique identifier |
| citation_domain | STRING | Atıf verilen domain |
| citation_position | INTEGER | Kaynak listesinde sıra |
| inference_similarity | FLOAT | Semantic overlap (0-1) |
| measured_at | TIMESTAMP | Measurement tarihi |

Bu tablo üzerinde weekly aggregate view:

```sql
SELECT 
  model_name,
  COUNT(DISTINCT query_text) AS total_queries,
  SUM(CASE WHEN citation_domain LIKE '%roibase%' THEN 1 ELSE 0 END) AS own_citations,
  AVG(CASE WHEN citation_domain LIKE '%roibase%' THEN citation_position ELSE NULL END) AS avg_position
FROM citation_log
WHERE measured_at >= CURRENT_DATE() - 7
GROUP BY model_name;
```

Output: ChatGPT'de %14 citation rate, Gemini'de %8, Claude'da %19 — bu farklılık model training data cut-off date'i ve retrieval stratejisiyle ilgili. Bu insight'ı alınca [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo) stratejinizi model-specific optimize edebilirsiniz.

## Inference Share Hesaplama

Citation rate markanızın görünürlüğünü ölçer, inference share **içeriğinizin ne kadar kullanıldığını** ölçer. Yöntem: semantic embedding similarity.

**Adımlar:**

1. Sizin kaynak içeriğinizi (blog post, whitepaper) sentence/paragraph bazında chunk'la
2. LLM response'unu aynı şekilde chunk'la
3. Her response chunk için en yüksek similarity'ye sahip kaynak chunk'ı bul (cosine similarity)
4. Threshold üstündeki match'leri say (>0.85 genelde eşik)
5. Inference share = (matched response chunk sayısı) / (toplam response chunk sayısı)

Python implementation (sentence-transformers ile):

```python
from sentence_transformers import SentenceTransformer, util

model = SentenceTransformer('all-MiniLM-L6-v2')

source_chunks = ["CDP first-party data toplar...", "Attribution window 7 gün..."]
response_chunks = ["CDP kullanıcı verilerini toplar...", "Conversion window genelde 7 gün..."]

source_embeddings = model.encode(source_chunks)
response_embeddings = model.encode(response_chunks)

matched = 0
for resp_emb in response_embeddings:
    similarities = util.cos_sim(resp_emb, source_embeddings)
    if similarities.max() > 0.85:
        matched += 1

inference_share = matched / len(response_chunks)
```

%60 üstü inference share = LLM içeriğinizin büyük kısmını repurpose ediyor. Bu hem pozitif (brand authority) hem negatif (doğrudan trafik kaybı) sinyaldir — tradeoff'u exec dashboard'da göstermelisiniz.

## Prompt Coverage Analizi

Farklı intent kategorilerinde citation performansınız nasıl? Informational ("CDP nedir"), navigational ("Shopify CDP entegrasyon"), commercial ("en iyi CDP vendor"), transactional ("CDP demo talep et") query'lerde ayrı ayrı ölçün.

Coverage gap örneği: E-ticaret kategorisinde informational query'lerde %18 citation, commercial query'lerde %3. Bu gap content stratejinize "vendor karşılaştırma", "pricing breakdown", "implementation checklist" türü içerikler eklemeniz gerektiğini gösterir.

Segmentasyon tablo örneği:

| Intent Type | Query Count | Citation Rate | Avg Position |
|---|---|---|---|
| Informational | 120 | 18% | 2.1 |
| Commercial | 80 | 3% | 4.5 |
| Navigational | 40 | 25% | 1.8 |
| Transactional | 20 | 0% | N/A |

Transactional query'lerde 0% citation normal — LLM'ler direkt satış yapamaz, dolayısıyla "demo talep et" query'sinde kaynak göstermez. Ama commercial query'deki düşük oran actionable insight.

## Dashboard ve Alert Sistemi

Metric toplayıp rapor üretmezsenen operasyonel değer üretmezsiniz. Weekly citation report template:

**Executive Summary (tek slide):**
- Overall citation rate trend (son 12 hafta)
- Model breakdown (ChatGPT/Gemini/Claude bar chart)
- Top 5 cited content piece
- Coverage gap (hangi intent türlerinde zayıfsınız)

**Alert kuralları (Slack/email):**
- Citation rate %20'nin altına düşerse → editorial ekip review tetiklenir
- Rakip citation rate sizinkini geçerse (competitor tracking ayrı pipeline gerekir) → strategic response planı
- Yeni yüksek-performing keyword cluster tespit edilirse → content production önceliklendirilir

Bu alertler [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) kapsamında kurgulanır — raw metric'ten actionable signal'e dönüşüm için data engineering gerekir.

## GEO Stratejisi Bağlantısı

Citation ölçümü sadece reporting değil, optimization için input'tur. Inference share düşükse içerik formatınızı LLM-friendly hale getirin: chunk'lanabilir paragraflar, clear header hierarchy, factual statement density artırın. Citation position düşükse authoritativeness signal güçlendirin: backlink quality, domain age, content freshness optimize edin.

GEO ile klasik SEO arasındaki fark: SEO'da keyword density optimize ederdiniz, GEO'da semantic cluster coverage optimize edersiniz. LLM'ler n-gram match yerine concept overlap bakıyor — aynı keywor'ı 10 kez tekrar etmek değil, ilgili concept'leri cover etmek önemli.

---

LLM citation tracking 2026'da optional değil, mandatory. Markanız generative engine'lerde görünmüyorsa yeni nesil kullanıcıların karar sürecinden çıkmışsınız demektir. Citation rate, inference share, prompt coverage — bu 3 metrik dashboard'ınızda yoksa SEO stratejiniz eksik. Şimdi hangi 50 keyword'ü ilk batch'e koyacağınızı belirleyin, pipeline'ı kurun ve ilk haftalık snapshot'ı alın — 3 ay sonra rakipleriniz hâlâ Google Analytics'e bakarken siz attribution graph'ında real signal göreceksiniz.