---
title: "Production'da RAG: Retrieval Kalitesi Cost'tan Önce Gelir"
description: "Embedding modeli, chunking stratejisi ve eval setup'ı yanlış seçersen RAG sistemi ya pahalı olur ya yavaş, ya da her ikisi. Production'da neye dikkat etmeli?"
publishedAt: 2026-05-11
modifiedAt: 2026-05-11
category: ai
i18nKey: ai-003-2026-05
tags: [rag, embedding, chunking, llm-eval, retrieval-quality]
readingTime: 8
author: Roibase
---

RAG sistemleri 2024'ten beri production'da yaygınlaşıyor. Şirketler kendi doküman corpusunu LLM'e beslemek için embedding + vector DB stack'i kuruyor. Ancak çoğu pilot projede aynı sorunla karşılaşıyor: retrieval kalitesi düşük, cevaplar tutarsız, maliyet kontrol dışı. Sorun genellikle embedding modeli seçimi, chunking stratejisi ve eval setup'ının hızlıca geçiştirilmesidir. Bu yazıda RAG pipeline'ını production'a taşımadan önce hangi kararların dönüşü olmadığını gösteriyoruz.

## Embedding Modeli: Boyut Değil, Domain Alignment

Embedding modeli seçerken ilk refleks "en yüksek MTEB skoru hangisi" sorusu. Ancak benchmark sıralaması production performansını garanti etmez. Önemli olan modelin senin doküman tipine ve sorgu patternine ne kadar uyumlu olduğu.

OpenAI `text-embedding-3-large` (3072 dim) ile Cohere `embed-v3` (1024 dim) arasında karşılaştırma yaptığımızda: Cohere, pazarlama dokümanlarında (blog, case study, landing page) daha tutarlı recall@10 verdi, çünkü training setinde business content ağırlıklı. OpenAI'nin daha büyük boyutu genel benchmarklarda iyi performans gösterse de domain-spesifik sorguların dağılımı farklı.

Başka bir örnek: `bge-large-en-v1.5` (1024 dim, self-hosted) legal dokümanlar için yeterli. Ancak multi-lingual corpus'ta `multilingual-e5-large` (1024 dim) açık ara önde çıkıyor. Model boyutu her zaman kalite sinyali değil — training datanın domaininle örtüşmesi daha kritik.

**Seçim kriterleri:**
1. MTEB skoru değil, kendi eval setinde recall@5 / MRR metriği
2. Latency (self-hosted vs API) — 512 doküman için batch embedding süresi
3. Cost per 1M token — OpenAI 3-large $0.13, Cohere v3 $0.10, self-hosted $0 ama infra var

Eğer doküman setinde domain spesifik jargon varsa (ilaç, finans, legal), fine-tuned bir embedding modeli veya sentence transformer'ları kendi verinde fine-tune etmek retrieval kalitesini %15-20 artırıyor. Bu [veri analizi & içgörü mühendisliği](https://www.roibase.com.tr/tr/verianalizi) kapsamına giriyor — training pipeline'ı kurup veri kalitesini gözlemlemek gerekiyor.

## Chunking Stratejisi: Sabit Boyut Çalışmaz

Çoğu RAG implementasyonunda chunking "512 token overlapping window" varsayılanıyla başlar. Bu markdown blog'lar için kabul edilebilir ama mixed-format corpus'ta (PDF, HTML, JSON) hemen bozuluyor.

Sabit boyut chunking'in sorunları:
- Başlık parçalanır, semantic bütünlük kaybeder
- Tablo, kod bloğu ortadan bölünür
- Overlap stratejisi overlapping context'i duplicate eder, retrieval gürültüsü artar

Alternatif: **semantic chunking**. Cümle sınırlarını, başlık hiyerarşisini koruyarak chunklara ayırmak. `langchain`'in `RecursiveCharacterTextSplitter` yerine `MarkdownTextSplitter` veya custom parser kullanmak. PDF'lerde `pdfplumber` ile tablo + metin ayrımı yapıp farklı chunk stratejileri uygulamak.

Bir e-ticaret firması için RAG stack'i kurarken ürün dokümanlarını 3 farklı chunk türüne ayırdık:
- **Title + short description:** 128 token, retrieval için lightweight
- **Technical specs + table:** 256 token, structured data
- **Long-form content (blog, guide):** 512 token, semantic split

Her chunk tipine farklı metadata (chunk_type, source_page) ekledik. Retrieval sırasında query type'a göre chunk_type filtresi uyguladık. Örneğin "ürün karşılaştırması" sorguları sadece `technical_specs` chunk'larına bakıyor. Bu precision@3'ü %18 artırdı.

### Overlap Strategy: Ne Kadar Yeterli?

Overlap genellikle 10-20% olarak öneriliyor ama bu arbitrer. Test sonucu: 50 token overlap, 512 token chunk'larda semantic continuity'yi koruyor. 100 token overlap, retrieval latency'yi %12 artırıyor ama kalite kazancı yok. Sweet spot domain'e göre değişiyor — kendi eval setinle test et.

## Eval Setup: Üretime Geçmeden Önce Kurulmalı

RAG sistemlerinin çoğu production'a "görsel olarak iyi görünüyor" testinde geçiyor. Ancak retrieval kalitesini ölçecek yapılandırılmış eval setup'ı yoksa ilk 1000 sorguda sistem güvenilir olmayacak.

**Minimal eval pipeline:**

```python
# eval_set.json — golden dataset
[
  {
    "query": "GDPR uyumlu user consent nasıl alınır?",
    "expected_docs": ["doc_42", "doc_89"],
    "expected_answer_contains": ["çerez bildirimi", "açık rıza"]
  },
  ...
]

# eval metrikler
def evaluate_retrieval(query, retrieved_docs, expected_docs):
    recall_at_k = len(set(retrieved_docs[:5]) & set(expected_docs)) / len(expected_docs)
    mrr = 1 / (retrieved_docs.index(expected_docs[0]) + 1) if expected_docs[0] in retrieved_docs else 0
    return {"recall@5": recall_at_k, "mrr": mrr}

def evaluate_generation(generated_answer, expected_contains):
    # LLM-as-judge: Claude'a "bu cevap beklenen içeriği kapsıyor mu?" diye sor
    prompt = f"Expected: {expected_contains}\nGenerated: {generated_answer}\nScore 0-1:"
    score = claude_api(prompt)
    return float(score)
```

**Eval frequency:** Her embedding model değişikliği, chunk strategy tweak'i sonrası. CI/CD'de otomatik koşulmalı. Eğer recall@5 < 0.7 ise deploy bloklansın.

Gerçek senaryoda: bir müşteri için 200 soruluk eval set hazırladık. Her commit'te eval pipeline otomatik koştu. Bir chunking değişikliği recall@5'i 0.68'den 0.81'e çıkardı ama latency p95'i 340ms'den 520ms'ye çıktı. Cost/latency tradeoff'unu dashboarda görünce chunking stratejisini geri aldık ve başka yol denemedik. Eval olmadan bu tradeoff görünmezdi.

## Hybrid Search: Sparse + Dense Retrieval

Sadece vector similarity'ye dayanmak edge case'lerde başarısız oluyor. Örneğin exact keyword match gereken sorular (ürün kodu, API endpoint adı) vector search'te düşük skor alabiliyor. Bu durumda **hybrid search** devreye giriyor: BM25 (sparse) + embedding (dense) skorlarını combine et.

```python
# Hybrid retrieval example
bm25_results = bm25_index.search(query, top_k=20)
vector_results = vector_db.search(query_embedding, top_k=20)

# RRF (Reciprocal Rank Fusion)
def rrf_score(rank, k=60):
    return 1 / (k + rank)

combined_scores = {}
for rank, doc in enumerate(bm25_results):
    combined_scores[doc.id] = combined_scores.get(doc.id, 0) + rrf_score(rank)
for rank, doc in enumerate(vector_results):
    combined_scores[doc.id] = combined_scores.get(doc.id, 0) + rrf_score(rank)

final_results = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)[:5]
```

Test sonucu: hybrid search, technical query'lerde recall@5'i %22 artırdı. Ancak latency iki kat arttı çünkü iki ayrı index'e istek atıyorsun. Bu tradeoff kabul edilebilirse (örneğin internal tool, 500ms altı yeterli) hybrid search production'da işe yarıyor.

## Reranking: İkinci Aşama Filtreleme

İlk retrieval aşaması (BM25 + vector) 20-50 doküman getiriyor. Ancak bunların hepsi LLM context'ine girmeyecek (cost + token limit). **Reranker modeli** devreye giriyor: query ile her dokümanın relevance skorunu yeniden hesaplayıp top-5'i seçiyor.

Cohere `rerank-english-v2.0` veya `bge-reranker-large` gibi modeller kullanılıyor. Reranker, cross-encoder mimarisinde — query + dokümanı birlikte encode ediyor, bu yüzden embedding'den daha pahalı ama daha doğru.

Benchmark: 50 doküman üzerinde reranking uyguladığımızda:
- Recall@5: 0.73 → 0.89
- Latency: +180ms (kabul edilebilir)
- Cost: retrieval başına +$0.002 (Cohere API)

Eğer budget kısıtlıysa self-hosted reranker kullanabilirsin ama GPU inference gerekiyor. Bu noktada infra cost vs API cost hesabı yapılmalı.

## Context Window Optimization: Daha Az Doküman, Daha İyi Cevap

LLM'e 20 doküman göndermek her zaman daha iyi cevap üretmez. Uzun context, modelin "lost in the middle" problemine yol açıyor — ortadaki bilgiyi atlıyor. Test sonucu: GPT-4 Turbo'ya 5 doküman göndermek, 15 doküman göndermekten daha iyi cevap üretiyor (BLEU score %11 fark).

**Optimization strateji:**
1. Reranker ile top-5'i seç
2. Her dokümanın relevance score'u < 0.6 ise eleme
3. Geriye kalan 3-5 dokümanı LLM context'ine gönder

Bu approach hem token cost'u düşürüyor (input token 70% azalıyor) hem de cevap kalitesini artırıyor. Production'da cost/latency/quality üçgeninde sweet spot bulman gerekiyor — eval pipeline bunu görünür kılıyor.

## Production Monitoring: Retrieval Drift

Retrieval kalitesi zamanla düşebilir — yeni dokümanlar eklendikçe, query distribution değiştikçe. **Retrieval drift** izlemek için dashboard kurulmalı:

| Metrik | Hedef | Alarm Eşiği |
|---|---|---|
| Recall@5 (weekly eval) | > 0.75 | < 0.70 |
| P95 latency | < 400ms | > 600ms |
| Zero-result queries (%) | < 5% | > 10% |
| Average relevance score | > 0.65 | < 0.55 |

Eğer recall drift görürsen:
1. Eval set'i güncelle (yeni query pattern'leri ekle)
2. Embedding modelini fine-tune et veya değiştir
3. Chunking stratejisini gözden geçir

Bu monitoring [first-party veri & ölçüm mimarisi](https://www.roibase.com.tr/tr/firstparty) kapsamına giriyor — RAG sistemi de bir data pipeline, gözlemlenebilir olmalı.

## Cost vs Quality Tradeoff: Pragmatik Seçimler

Production RAG'de her karar cost/quality/latency tradeoff'u içeriyor. Bazı pragmatik seçimler:

- **Embedding model:** OpenAI 3-large yerine Cohere v3 kullan → %30 cost azalması, %2 quality kaybı (kabul edilebilir)
- **Reranking:** Her query'de rerank yerine sadece ambiguous query'lerde rerank → latency %40 azalması
- **Hybrid search:** BM25 + vector yerine sadece vector (eğer exact match önemli değilse) → latency %50 azalması
- **Context window:** 10 doküman yerine 5 doküman → token cost %60 azalması, quality %8 artması

Bu tradeoff'ları görmek için eval pipeline zorunlu. Yoksa "embedding modelini değiştirdim, daha ucuz oldu" dersin ama retrieval kalitesinin %15 düştüğünü fark etmezsin.

RAG sistemini production'a taşımadan önce embedding modeli, chunking stratejisi ve eval setup'ını ciddiye al. Cost optimizasyonu ikinci aşamada — önce retrieval kalitesini stabil tut, sonra maliyeti düşür. Aksi halde sistemin güvenilirliği kullanıcıya yansır ve adoption düşer.