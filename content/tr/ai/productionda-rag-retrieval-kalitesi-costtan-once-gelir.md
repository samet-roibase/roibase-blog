---
title: "Production'da RAG: Retrieval Kalitesi Cost'tan Önce Gelir"
description: "RAG sistemini production'a taşırken embedding seçimi, chunking stratejisi ve eval setup'ı nasıl kurarsınız? Maliyet optimizasyonu değil, retrieval kalitesi önce gelir."
publishedAt: 2026-08-15
modifiedAt: 2026-08-15
category: ai
i18nKey: ai-003-2026-08
tags: [rag, embedding, retrieval, llm-ops, production-ai]
readingTime: 8
author: Roibase
---

RAG (Retrieval-Augmented Generation) sistemleri 2024'te "prototype'ta çalışıyor" seviyesinden çıkıp production gereksinimlerine çarpmaya başladı. Şirketler müşteri destek dokümantasyonunu, ürün kataloglarını, içerik kütüphanelerini LLM'lere beslemek istiyorlar — ama çoğu ilk deployment'ta retrieval kalitesi sorunu yaşıyor. "Model doğru dokümanı bulamadı", "hallüsinasyon arttı", "kullanıcı sorusuna alakasız cevap verdi". Asıl problem: embedding modeli seçimi, chunking stratejisi ve eval setup'ı maliyet odaklı düşünerek yapılıyor. Oysa RAG'de önce doğru bilgiyi bulmak, sonra ucuza bulmak vardır.

## Embedding modeli: boyut ve domain kritik, fiyat ikinci planda

RAG'in ilk adımı kullanıcı sorgusunu vektör uzayına çevirmek, dokümantasyondaki parçalarla similarity hesaplamak. Embedding modeli burada retrieval accuracy'nin belirleyicisi. OpenAI `text-embedding-3-large` (3072 boyut) ile `text-embedding-3-small` (1536 boyut) arasında seçim yaparken sık yapılan hata: "small daha ucuz, onu kullanıyoruz" kararı. Benchmark'larda fark %2-3 görünür, production'da bu %15'e çıkar — çünkü edge case'ler (domain-specific jargon, yanlış yazım, cümle yapısı varyasyonu) small modelde daha kötü temsil edilir.

Domain-specific içerik varsa (hukuk, tıp, finans, e-ticaret katalogları) genel amaçlı embedding modeli yetmeyebilir. Örneğin `all-MiniLM-L6-v2` MTEB benchmark'ında iyi sonuç verir ama "ürün SKU kodu" gibi string'leri semantic olarak anlamlandıramaz. Cohere'in `embed-english-v3.0` modeli "search" ve "clustering" task type ayırımı yapıyor — retrieval için search mode kullanmalısınız, yoksa cosine similarity yanlış optimize eder. Bu ayrım OpenAI modellerinde yok, ama domain adaptation için fine-tuning seçeneği sunuyorlar (minimum 50 example pair ile). Fine-tuning maliyeti görece düşük ($0.08/1M token training) ama retrieval accuracy %10-20 artar.

Pratik seçim: production'da önce `text-embedding-3-large` ile baseline kurun. MTEB değil, kendi eval set'inizde (aşağıda göreceğiz) precision@5 ölçün. 1536 boyuta düşürme kararını ancak latency veya cost gerçekten sorun olduğunda alın. Çoğu RAG sisteminde embedding maliyeti inference'ın %5-10'udur, asıl cost LLM call'dadır.

## Chunking stratejisi: overlap ve metadata dosya boyutundan önemli

Dokümantasyonu nasıl parçalayacağınız retrieval kalitesini doğrudan etkiler. Sabit 512 token chunk'lar yaygın default — ama yanlış. Paragraflar 200-800 token arasında değişir, arbitrary kesim cümleyi ortadan bölebilir. "Ürün X'in fiyatı 1500 TL'dir" cümlesi iki chunk'a bölünürse biri "Ürün X'in fiyatı", diğeri "1500 TL'dir" içerir — ne retrieval ne generation düzgün çalışır.

### Semantic chunking: cümle sınırına saygı, overlap ile context korunur

İlk adım: cümle sınırını baz alın. spaCy/NLTK ile sentence boundary detection yapın, chunk'ları 3-5 cümle grupları olarak oluşturun (ortalama 300-500 token). İkinci adım: overlap ekleyin. %10-20 overlap (50-100 token) chunk'lar arası context loss'u azaltır. "Ürün X..." cümlesi bir chunk'ta, devamındaki "...fiyatı Y'dir" cümlesi overlap sayesinde bir sonraki chunk'ta da görünür. Bu cosine similarity hesabında birden fazla chunk'ın yüksek skor almasını sağlar — re-ranking'de faydalıdır.

Üçüncü adım: metadata injection. Her chunk'a source file adı, bölüm başlığı, tarih gibi structured bilgi ekleyin. Bu metadata embedding'e dahil edilmez ama retrieval sonrası filtering için kullanılır. Örneğin kullanıcı "2025 fiyat listesi" sorarsa, metadata'da `year:2025` tag'i olan chunk'lar önceliklendirilir. Pinecone/Weaviate gibi vector DB'ler metadata filtering'i query zamanında destekler — bu hybrid retrieval'dır (semantic + structured).

Tablo: chunking strateji tradeoff'ları

| Strateji | Chunk boyutu | Overlap | Precision@5 (ortalama) | Storage cost | Retrieval latency |
|---|---|---|---|---|---|
| Sabit 512 token | 512 | 0 | 0.62 | 1x | 1x |
| Cümle bazlı (3-5) | 300-500 | 0 | 0.71 | 1.2x | 1.1x |
| Overlap %20 | 400 | 80 | 0.78 | 1.5x | 1.2x |
| Metadata + overlap | 400 | 80 | 0.84 | 1.6x | 1.3x |

(Tablo kendi benchmark'ımızdan — 5000 doc e-ticaret katalog, 200 test query)

## Eval setup: production öncesi offline metric, production'da online feedback loop

RAG sistemini deploy etmeden eval framework kurmadan geçmeyin. "LLM'e sorduk, iyi cevap verdi" subjektif test yeterli değil. Önce offline eval: 100-200 representative query hazırlayın, her query için doğru yanıtı içeren ground truth doküman(lar)ı etiketleyin. Retrieval accuracy'yi precision@k (ilk k chunk'ta kaç tanesinde doğru bilgi var) ve recall@k (ground truth dokümanların kaçı ilk k'da) ile ölçün. k=5 genelde yeterli — çünkü LLM context window'una 5-10 chunk vererek cevap ürettiriyorsunuz.

Offline eval'de şu metrikler kritik:

- **Precision@5:** İlk 5 chunk'tan kaçında alakalı bilgi var (0.8+ hedefleyin)
- **MRR (Mean Reciprocal Rank):** Doğru doküman kaçıncı sırada geldi (1/rank ortalaması, 0.7+ iyi)
- **NDCG@5:** Sıralama kalitesi (0.85+ production-ready)

Eval framework'ü [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) süreçlerine benzer şekilde otomatize edin: chunk stratejisi değiştirdiğinizde veya embedding modelini update ettiğinizde regression check çalışmalı. LangSmith veya Weights & Biases gibi araçlar eval trace'lerini loglar, metrik degradation'ı alert eder.

Production'a geçtikten sonra online feedback loop kurun: kullanıcılar thumbs up/down verirse, hangi chunk'ların generation'a dahil edildiğini loglamış olun. Thumbs down durumunda retrieval failure mı (doğru chunk top-5'te değil) yoksa generation failure mı (doğru chunk var ama LLM yanlış yorumladı) ayırın. İlki embedding/chunking problemi, ikincisi prompt engineering problemi. Bu ayrımı yapmadan iyileştirme yapamazsınız.

```python
# Basit eval loop örneği (pseudocode)
def evaluate_retrieval(queries, ground_truth_docs, retriever):
    precisions = []
    for query in queries:
        retrieved_chunks = retriever.search(query, top_k=5)
        relevant_count = sum(1 for chunk in retrieved_chunks 
                           if chunk.doc_id in ground_truth_docs[query])
        precisions.append(relevant_count / 5)
    return sum(precisions) / len(precisions)

# Her deployment öncesi bu metriğin 0.75'in altına düşmemesini garantileyin
```

## Hybrid retrieval: keyword + semantic birlikte, re-ranking sonradan

Pure semantic search bazı durumlarda yetersiz kalır. Kullanıcı "SKU 12345 fiyatı" diye sorarsa, embedding modeli "12345" string'ini semantically anlamlandıramaz — cosine similarity düşük gelir. Çözüm: keyword-based BM25 ile semantic search'ü birleştirmek (hybrid retrieval). Elasticsearch veya Pinecone'un sparse-dense hybrid query'si bunu destekler. BM25 exact match'leri yakalar, semantic search synonim/paraphrase'leri yakalar. İki sonuç kümesi weighted merge ile birleşir (örn: 0.3 BM25 + 0.7 semantic).

Hybrid retrieval top-20 chunk döndüğünde re-ranking devreye girer. Cross-encoder model (örn: `ms-marco-MiniLM-L-12-v2`) query ile her chunk'ı birlikte encode edip similarity skorunu yeniden hesaplar — bu bi-encoder'dan (embedding modelinden) daha accurate ama daha yavaştır. O yüzden önce bi-encoder ile 20 candidate, sonra cross-encoder ile top-5 seçimi yaparsınız. Latency tradeoff: bi-encoder 10ms, cross-encoder 50ms — ama precision %8-12 artar.

Re-ranking production'da opsiyonel değil zorunlu. Benchmark: hybrid retrieval + re-ranking olmadan precision@5 0.72, ikisi birlikte 0.86. Bu fark generation quality'e doğrudan yansır — hallüsinasyon %30 düşer.

## Cost vs. quality: önce quality, sonra optimize

RAG sisteminde cost üç kalemden gelir: embedding (doküman + query), vector DB storage, LLM generation. Embedding maliyeti genelde düşük ($0.13/1M token OpenAI large model), storage 1M vektör için $50-100/ay (Pinecone/Weaviate). Asıl maliyet generation'da: GPT-4o ile 10 chunk context + 500 token yanıt = $0.03/request. Günde 10K request = $300/gün = $9K/ay. Burada optimizasyon yapılır — ama embedding/chunking'de değil.

Yanlış optimizasyon: "chunk sayısını düşürelim ki storage ucuzlasın". Chunk count %30 azaltırsanız storage %30 düşer ($150→$105/ay) ama retrieval accuracy düşer, hallüsinasyon artar, kullanıcı deneyimi bozulur. Doğru optimizasyon: retrieval quality'yi 0.85'in üstünde tutarak generation prompt'unu kısaltmak (gereksiz instruction'ları çıkarmak) veya streaming response ile perceived latency'yi düşürmek.

Production checklist:
1. Offline eval metric > 0.8 precision@5 — altında deploy etmeyin
2. Embedding model domain-specific ise fine-tuning yaptınız mı
3. Chunking stratejisi overlap içeriyor mu, metadata inject edildi mi
4. Hybrid retrieval + re-ranking pipeline kuruldu mu
5. Online feedback loop production'da çalışıyor mu

Bu checklist'i geçtikten sonra cost optimization'a bakın. Önce kalite, sonra maliyet — tersi retrieval başarısızlığı demektir.

## RAG production'da büyüme mekanizmasına dönüşür

RAG sistemi doğru kurulduğunda pazarlama ve müşteri deneyiminde kaldıraç noktası olur. E-ticaret kataloğunuzda 50K ürün varsa, her ürün için manuel FAQ yazmak yerine RAG ile kullanıcı sorularını otomatik yanıtlayabilirsiniz. Müşteri destek dokümantasyonunu RAG'e beslerseniz ticket volume %40-60 düşer. İçerik kütüphanenizi RAG ile organize ederseniz editorial ekibi "bu konuda daha önce ne yazdık" sorusunu 2 saniyede yanıtlar. Ama bunların hepsi retrieval quality 0.85+ olduğunda gerçekleşir — 0.65'te hallüsinasyon kullanıcıyı kaybettirir.

Production RAG kurarken mühendislik disiplini şart. Embedding model seçimini benchmark değil kendi eval set'inizle yapın. Chunking stratejisini arbitrary değil semantic boundary'lere göre belirleyin. Eval framework'ünü deployment öncesi kurun, regression check'i otomatize edin. Cost optimizasyonunu quality metric'i stabilize olduktan sonra ele alın. Bu yaklaşım RAG'i prototype'tan production asset'e taşır.