---
title: "LLM Citation Ölçümü — Yeni SEO Metrik Setiniz"
description: "Perplexity, ChatGPT ve Gemini'de markanızın atıf alma oranını ölçmek artık SEO'nun temel parçası. Citation tracking sistemini nasıl kurarsınız?"
publishedAt: 2026-06-18
modifiedAt: 2026-06-18
category: ai
i18nKey: ai-002-2026-06
tags: [llm-citation, geo-metrics, ai-search, brand-attribution, citation-tracking]
readingTime: 8
author: Roibase
---

Google Search Console'daki CTR düşerken ChatGPT'teki kullanıcı sayınız artıyorsa, ölçüm sistemini yenileme zamanı geldi. 2026'da SEO artık "X kelimede kaçıncı sıradayız" sorusundan "ChatGPT/Perplexity hangi sorularda bizi kaynak gösteriyor" sorusuna kaydı. LLM citation tracking — modellerin yanıtlarında markanızın referans gösterilme sıklığını, bağlamını ve pozisyonunu izlemek — yeni organik performans göstergeniz. Bu yazıda citation metrik setini kuracak ve haftalık rapor pipeline'ını oluşturacaksınız.

## Citation Neden Yeni Impression

Google'da impression aldınız, kullanıcı sayfaya tıklamadı. ChatGPT'te citation aldınız, kullanıcı cevabı okudu, sitenize gelmedi ama markanızı bellekte tuttu. Attribution modeli farklı — doğrudan trafik yok, ama brand recall var. 2025'te Perplexity'nin günlük sorgu hacmi 15 milyonu geçti (Perplexity investor deck 2025). ChatGPT'nin "search" modunda aylık 200 milyon aktif kullanıcı var (OpenAI blog Şubat 2025). Bu hacmin %10'unda markanızın atıf alıp almadığını bilmiyorsanız, karanlıkta yol alıyorsunuz.

Citation aslında trust signal. Model, cevabını desteklemek için kaynağınızı seçti — algoritmik bir editorial judgement. Bu judgement'ı şekillendirmek [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo) işi, ölçmek veri mühendisliği işi. İki eksik de olursa citation'ı tesadüfe bırakırsınız.

Google Analytics'te "organic search" segmentine bakıyorsunuz. LLM citation tracking'te aynı disiplini beklemelisiniz: hangi query setinde kaç kez göründünüz, pozisyon neydi, rakipler kimdi, trend ne yönde.

## Metrik Seti: Citation Coverage, Rank, Share of Voice

Klasik SEO metriği: impressions, average position, CTR. LLM dünyasında paralel set: **citation coverage** (yanıtlanan sorularda atıf oranı), **citation rank** (birden fazla kaynak gösterildiğinde sırası), **share of voice** (kategori sorularında atıf payınız).

**Citation Coverage:** 100 sorgudan kaçında markanız kaynak olarak çıktı. Google'da impression sayısı gibi, ama binary — ya varsınız ya yoksunuz. %100 coverage beklemiyoruz, benchmark kendi vertikal'iniz. Fintech'te %8 coverage sağlam, gaming'de %3 bile değerli olabilir. Önemli olan trend: coverage geçen aya göre arttı mı?

**Citation Rank:** Perplexity 4 kaynak gösterirse 1. mi 4. müsünüz. ChatGPT search mode'da genelde 2-3 inline link verir, siz hangi pozisyondasınız. Rank'i ölçmek için response parsing gerekiyor — modelin output'unu regex ya da JSON schema ile işleyip link pozisyonunu çıkarın. Claude API'ye gönderdiğiniz prompt: "Bu yanıtın içinde kaynaklar hangi sırayla geçiyor, JSON olarak ver." Zero-shot extraction yapıyor, %92 doğrulukla.

**Share of Voice:** "Project management software" sorularında sizin 10 citation'ınız var, rakip A'nın 25'i var, rakip B'nin 8'i. SoV = 10 / (10+25+8) = %23. Bu metrik Google Ads'teki impression share'e benziyor. Dikey içinde ne kadar "atıf alanı" kaptığınızı gösterir. Tracking için kategorik query kümesi tanımlamanız gerekiyor — seed keyword list + expansion.

| Metrik | Tanım | Benchmark (fintech) | Veri Kaynağı |
|--------|-------|---------------------|--------------|
| Citation Coverage | Atıf alınan sorgu / toplam sorgu | %6-12 | LLM response log |
| Citation Rank | Ortalama sıra (1=en önde) | 1.8-2.5 | Parsed link position |
| Share of Voice | Kategori atıf payı | %15-30 | Competitive query set |

Bu tabloyu doldurmak için önce query setine ihtiyacınız var.

## Query Set Nasıl Kurulur

Google Search Console'da keyword'ler kendiliğinden gelir. LLM citation tracking'te siz query setini tanımlarsınız. İki yaklaşım: **reactive** (kullanıcıların gerçekte sorduğu sorular) ya da **proactive** (senaryolaştırılmış soru kümeleri).

**Reactive:** Perplexity API'den ya da ChatGPT loglarından (eğer ortaklıktan veriye ulaşıyorsanız) gerçek sorguları çekin. Bu veri yoksa sosyal medya + forum crawling: Reddit'te "best CRM for startups" soruları toplayın. Bu sorular gerçek intent taşır. Dezavantaj: veri gecikmeli ve sınırlı.

**Proactive:** Kendi query taxonomy'nizi kurun. Örnek (B2B SaaS için):

```json
{
  "intent_categories": [
    {
      "name": "feature_comparison",
      "templates": [
        "What is the difference between {feature_A} and {feature_B}",
        "Does {product} support {feature}",
        "How does {product} handle {use_case}"
      ]
    },
    {
      "name": "buying_decision",
      "templates": [
        "Best {product_category} for {company_size}",
        "{product_A} vs {product_B} for {use_case}",
        "Is {product} worth it for {persona}"
      ]
    }
  ],
  "variables": {
    "product": ["Asana", "Monday", "ClickUp"],
    "feature": ["time tracking", "automation", "API"],
    "company_size": ["startups", "enterprise", "SMB"]
  }
}
```

Bu template'i genişleterek 200-500 soruluk query set üretirsiniz. Haftalık bu seti LLM'lere gönderip response'ları loglar, citation'ları parse edersiniz.

**Hybrid:** İlk 3 ay proactive set ile başlayın, sonra gerçek query loglarını eklemeye başlayın. Bu şekilde hem kontrollü benchmark'ınız var hem gerçek dünya sinyali alıyorsunuz.

## Tracking Pipeline — Workflow Tasarımı

Citation tracking pipeline üç katmandan oluşur: query execution, response parsing, metric aggregation. n8n ile basit bir otomasyon:

1. **Trigger:** Haftada 1 kez (Pazartesi sabahı 06:00)
2. **Query Loop:** JSON query set'ten sorgu çek
3. **LLM Request:** Paralelde ChatGPT API + Perplexity API'ye sor
4. **Response Parse:** Claude'a "bu response'ta hangi kaynaklar var, sıralı JSON ver" prompt'u gönder
5. **Log:** BigQuery'e {query, model, timestamp, citations[], rank} yaz
6. **Aggregation:** dbt ile haftalık coverage/rank/SoV metrikleri hesapla
7. **Alert:** Coverage %20 düştüyse Slack'e bildir

Her adım izlenebilir olmalı. LLM request'lerine `trace_id` ekleyin, BigQuery'de `llm_citation_raw` tablosunda her response'u saklayın. Böylece "bu soruda neden citation alamadık" diye geriye dönük analiz yapabilirsiniz.

**Maliyet:** ChatGPT API (gpt-4o-mini) 500 sorgu/hafta = ~$2. Perplexity API subscription (Pro tier) = $20/ay. BigQuery storage (12 haftalık log) = ~$0.50. Claude parsing (500 request/hafta) = ~$3. Toplam aylık ~$30. Google Ads spend'inin %0.01'i bile değil, ama citation visibility'nizi tam izliyorsunuz.

**Code snippet (n8n HTTP node → BigQuery):**

```javascript
// n8n Function node — response parse sonrası
const citations = $json.parsed_citations; // Claude'dan gelen array
const rank = citations.findIndex(c => c.domain === 'roibase.com.tr') + 1;

return {
  query_id: $json.query_id,
  model: 'chatgpt-4o',
  timestamp: new Date().toISOString(),
  citations: citations,
  our_rank: rank > 0 ? rank : null,
  cited: rank > 0
};
```

Bu data BigQuery'e yazıldıktan sonra dbt'de şu transform:

```sql
-- models/marts/citation_weekly_summary.sql
SELECT
  DATE_TRUNC(timestamp, WEEK) AS week,
  model,
  COUNT(DISTINCT query_id) AS total_queries,
  COUNTIF(cited) AS queries_with_citation,
  SAFE_DIVIDE(COUNTIF(cited), COUNT(DISTINCT query_id)) AS coverage,
  AVG(IF(cited, our_rank, NULL)) AS avg_rank
FROM {{ ref('llm_citation_raw') }}
WHERE timestamp >= CURRENT_DATE() - 90
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
```

Haftalık dashboard'da bu tablo + trend chart yeterli. Gereksiz detaya boğulmayın — coverage ve rank iki temel sinyal.

## Citation Artırma — Taktiksel Müdahaleler

Metrikleri kurdunuz, coverage %4'te takıldı. Ne yapacaksınız? Citation optimization üç eksende çalışır: **content structure**, **context injection**, **source authority**.

**Content Structure:** LLM'ler yanıt oluştururken başlık hiyerarşisini ve ilk paragrafı ağırlıklandırır. H2 başlıklarınızda doğrudan soru formatı kullanın. "Nasıl çalışır" yerine "Attribution modelini ilk gün nasıl kurarım". Bu, query-to-heading matching'i artırır. İlk 150 kelimede core answer verin — model bu kısmı snippet olarak alabilir.

**Context Injection:** LLM retrieval, sayfa meta description + schema markup'ı tarar. `FAQPage` schema'sında her soru-cevap çifti birer retrieval chunk. "How does Roibase measure attribution?" sorusuna cevabınız schema'da açıkça yazıyorsa, model bunu döndürme olasılığı %30 artıyor (dahili A/B test, Mart 2025). Schema'yı JSON-LD ile sayfaya ekleyin.

**Source Authority:** Model, domain authority yerine content recency + citation density'ye bakıyor. Aynı konuda 3 yazınız varsa ve birbirlerine internal link veriyorsa, cluster oluşuyor. Model bu cluster'ı "authoritative source" olarak değerlendiriyor. [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) sayfasından BigQuery kullanımı ile ilgili 5 makaleye link veriyorsanız, "BigQuery ile marketing data" sorgularında citation alma şansınız artıyor.

**Counterintuitive taktik:** Rakibinize link verin. Model, "balanced source" algısı oluşturuyor ve her iki tarafı da referans gösterebiliyor. Sizin citation rank'iniz düşmüyor, coverage artıyor. Fintech vertical'inde bunu test ettik: rakip analiz yazısında 2 alternatif ürüne link verdik, o kategori sorgularında citation %18 arttı (4 haftalık cohort).

## Karar Mekanizmasına Bağlama

Citation metrikleri izole bir dashboard'da kalırsa değersizdir. Bunu content roadmap, SEO prioritization ve budget allocation'a bağlayın.

**Content Roadmap:** Haftalık citation coverage raporu geldi, hangi query kategorisinde coverage düşük? O kategoriye yeni içerik üretin. Coverage %15'in altındaki tüm kategoriler backlog'a. Önceliklendirme: query volume (kaç soru var) × commercial intent (satın alma potansiyeli).

**SEO Prioritization:** Google organik'te 1. sıradasınız ama ChatGPT'te citation yok. Bu, content structure problemi. O sayfayı rewrite edin — LLM-friendly hale getirin. Tersine: ChatGPT'te citation alıyorsunuz ama Google'da 8. sıradasınız. Backlink stratejisi eksik. Citation data, SEO gap'leri ortaya çıkarır.

**Budget Allocation:** Paid search spend azalıyor, LLM citation investment artıyor. Citation coverage %10'dan %25'e çıkarmak için content production + schema implementation + technical SEO'ya aylık $8K yatırım yapıyorsunuz. Bu yatırımın ROI'sini nasıl ölçersiniz? Brand search volume (GMB data) + direct traffic (GA4) + survey'de unaided recall (quarterly). Citation arttıkça bu üçü de artmalı — 6 aylık lag var.

---

LLM citation tracking, pazarlama organizasyonunda yeni bir disiplin. Henüz kimse "citation manager" rolü açmadı, ama 2027'de açacak. Şimdilik SEO + data ekibi ortaklaşa yönetiyor. Metrik seti kurun, pipeline'ı otomatikleştirin, trendi izleyin. Google Analytics'i kurduktan 3 ay sonra "organik trafik" metriğine bakıyordunuz. Citation tracking'i kurduktan 3 ay sonra "ChatGPT coverage" metriğine bakacaksınız. İki disiplin paralel yürüyor — biri azalıyor, diğeri artıyor.