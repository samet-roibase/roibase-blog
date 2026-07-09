---
title: "Production'da RAG: Retrieval Kalitesi Cost'tan Önce Gelir"
description: "Embedding modeli, chunking stratejisi ve eval kurulumu: Production RAG sistemlerinde retrieval kalitesini cost optimizasyonundan önce ele almak zorunda kalma nedenleriniz."
publishedAt: 2026-07-09
modifiedAt: 2026-07-09
category: ai
i18nKey: ai-003-2026-07
tags: [rag, retrieval, embedding, chunking, llm-eval]
readingTime: 8
author: Roibase
---

RAG sistemlerini production'a alırken ilk soru genellikle "embedding modeli hangisi, çünkü token cost" oluyor. Yanlış soru. Doğru soru: "retrieval precision 0.85'in altına düşerse kullanıcı sorgusu hangi oranda hallucination'a dönüşüyor?" RAG'in cost yapısı batch inference gibi değil — kötü retrieval, downstream'de exponential token waste ve kullanıcı güven kaybı yaratır. Embedding model seçimi, chunking ve eval setup'ını bu bağlamda ele almak gerekiyor.

## Embedding modeli: Latent space kalitesi cost/token metriğinin üstünde

Embedding modelini seçerken bakılacak metrik sıralaması: retrieval precision → semantic drift → latency → cost/token. OpenAI `text-embedding-3-large` 3072 dimension, Cohere `embed-v3` 1024, Voyage AI `voyage-2` 1536 — bu sayılar latent space'in granülaritesini belirliyor. Ama gerçek fark benchmark'larda değil, domain-specific query'lerdeki davranışta. E-ticaret platformunda "siyah deri ceket M beden" sorgusunda `text-embedding-3-large` %12 daha fazla false positive üretiyordu, çünkü "deri" kelimesini materyalden çok stil olarak encode ediyordu. Voyage AI'ın domain fine-tuning opsiyonu bu noktada devreye girer — 5000 query-document pair ile 2 haftalık fine-tune, baseline'a göre precision'ı %18 artırdı.

Cost hesabı şöyle: `text-embedding-3-large` 1M token $0.13, Cohere $0.10. Ama precision düşükse LLM'e yanlış context gidiyor — GPT-4o 10K token $0.30, yanlış retrieval nedeniyle 3K fazla token = $0.09 ekstra per query. 100K query/ay'da bu $9K waste. Embedding'de $30 tasarruf etmek için downstream'de $9K kaybetmek irrational. Latency da benzer: Cohere 45ms, Voyage 62ms — ama Voyage retrieval kalitesi sayesinde rerank ihtiyacını %40 düşürüyor, toplam pipeline latency 180ms'den 140ms'ye iniyor.

Semantic drift tracking için eval set'e temporal query eklenmeli. Aynı user query'yi 3 ay arayla çalıştır, retrieved document set'i karşılaştır. %15'in üzerinde drift varsa embedding model production'da concept drift'e maruz demektir — retrain veya model switch gerekir. Bu tracking olmadan embedding seçimi blind karar olur.

## Chunking stratejisi: Fixed-size yanılgısı ve overlap tradeoff'u

En yaygın hata: 512 token fixed-size chunks + 50 token overlap. Bu naive yaklaşım semantic boundary'leri ignore eder. Markdown heading, code block, tablo gibi yapısal elemanları ortadan böler, retrieval'da context loss yaratır. Alternatif: semantic chunking — sentence embeddings'i kullanarak semantic similarity threshold (örn. cosine 0.75) ile dinamik chunk sınırları belirlemek. LangChain'in `SemanticChunker`'ı bunu yapıyor ama latency overhead %30 — pipeline latency için kritikse recursive character splitting + heading-aware parsing hibrit yaklaşımı daha pragmatik.

Overlap'in tradeoff'u: 0 overlap = chunk boundary'de information loss, 50% overlap = index size 1.5x + query latency %25 artış. Sweet spot domain'e göre değişir. Teknik dokümantasyon için %25 overlap (128 token @ 512 chunk), conversational data için %10 (50 token). Test: eval set'te "chunk boundary query" alt seti oluştur — cevabı iki chunk arasında kalan sorular. Bu sorularda overlap artışı retrieval precision'ı nasıl etkiliyor? Bizim testlerde %25 overlap, boundary query'lerde precision'ı 0.68'den 0.81'e çıkardı. %50'ye çıkınca 0.83'e geldi ama latency cezası karşılığı %2'lik kazanç justifiable değildi.

Chunk size seçimi de binary değil. 256 token chunks daha granular retrieval, 1024 token chunks daha fazla context per chunk. Ama LLM context window dolduğunda 1024 token chunks 4 chunk = 4K token, 256 token chunks 16 chunk = 4K token — aynı context, ama 256'lık chunking 4x daha fazla semantic option sunuyor. Trade-off: embedding cost 4x, ama retrieval diversity artıyor. Production'da hybrid yaklaşım: FAQ/short-form için 256, long-form article'lar için 768. Bu [veri analizi mimarisi](https://www.roibase.com.tr/tr/verianalizi) kurulumunda log-based chunking performansı track etmeyi gerektirir — hangi chunk size hangi query type'da daha iyi perform ediyor?

### Chunk metadata: JSON field injection

Her chunk'a metadata inject etmek retrieval filter'lama için kritik. `{category, created_at, author, content_type}` gibi alanlar vector search'e ek olarak metadata filter sağlar. Örnek: "2025'teki Python tutorialları" query'si hem semantic match hem `created_at > 2025-01-01` filter. Bu hybrid approach retrieval precision'ı %22 artırdı. Pinecone, Weaviate, Qdrant hepsi metadata filtering destekler ama query syntax farklı — abstraction layer olarak LlamaIndex kullanmak esneklik sağlar.

## Eval setup: Offline metrikler production hallucination'ı predict edemez

RAG eval için offline metrikler: retrieval precision, recall, MRR (mean reciprocal rank), NDCG. Bunlar gerekli ama yeterli değil. Production'da asıl sorun: retrieved context doğru ama LLM yine hallucinate ediyor. Bunun için end-to-end eval gerekir — retrieved chunks + LLM response + ground truth answer karşılaştırması. Ragas framework bunu yapıyor: faithfulness, answer relevance, context precision gibi LLM-as-judge metrikleri. GPT-4o'yu judge olarak kullanıp batch eval çalıştırıyoruz — 1000 query eval set, 24 saatte tamamlanıyor.

Eval set composition: %60 real user queries (production log'dan), %20 edge case (deliberately ambiguous), %20 adversarial (eski bilgi, deprecated docs). Real user query'ler production distribution'ını yansıtır. Edge case'ler model'in uncertainty handling'ini test eder. Adversarial set ise temporal drift'i simulate eder — 2023 tarihli dokümana dayanan 2026 query'si, answer'da "güncel değil" uyarısı olmalı.

Continuous eval için her sprint'te (2 hafta) yeni 200 query eval set'e ekleniyor. Production log'dan random sample + edge case curation. Bu set üzerinde model/chunking/retrieval config değişikliklerini A/B test ediyoruz. %5'in üzerinde precision drop = rollback. Eval pipeline AWS Step Functions üzerinde — embedding, retrieval, LLM inference, scoring, Slack alert. Total runtime 45 dakika, cost $12 per eval run. Bunu yapmadan production'a RAG değişikliği push etmek blind deployment'tır.

## Reranking ve query expansion: Retrieval pipeline'ın ihmal edilen katmanları

Vector search tek başına yeterli değil. Top-K retrieval (örn. K=20) yaptıktan sonra reranking modeli (Cohere Rerank, bge-reranker) ile semantic relevance'a göre sıralama, son K=5'i LLM'e vermek retrieval precision'ı %30 artırıyor. Reranking latency overhead'i 80ms ama LLM'e yanlış context gitmediği için toplam pipeline güvenilirliği artıyor. Cost: Cohere Rerank $1/1K query — bu 100K query/ay'da $100, ama downstream LLM waste'i $9K'dan $3K'ya indirdi.

Query expansion: Kullanıcı query'si "RAG nasıl kurulur" basit ama semantic space'te "retrieval-augmented generation implementation" da match etmeli. HyDE (hypothetical document embedding) yaklaşımı: LLM'e "bu query'ye ideal cevabı yaz", cevabı embed et, o embedding'le ara. Bu implicit query expansion sağlar. Production'da %15 precision gain gördük ama latency +120ms. Trade-off: latency kritikse classical query expansion (synonym injection) 40ms'de benzer gain sağlar.

## Production monitoring: Retrieval kalitesi observable olmadan optimize edilemez

RAG system'de monitör edilmesi gereken metrikler: retrieval latency p50/p95/p99, embedding cache hit rate, retrieved chunk relevance score distribution, LLM faithfulness score (LLM-as-judge ile hesaplanan), user feedback (thumbs up/down). Bunları Datadog custom metrics olarak push ediyoruz. Retrieval latency p95 200ms'yi geçerse alert — çünkü total user-facing latency 500ms SLA'sı var, retrieval 200ms'nin üstüne çıkarsa LLM inference ile birlikte SLA breach oluyor.

Retrieved chunk relevance score: Her retrieval'da top-5 chunk'ın cosine similarity skorlarını log'la. Distribution shift varsa (örn. ortalama skor 0.78'den 0.65'e düşerse) bu embedding model drift veya corpus quality issue'su sinyalidir. Bunu [first-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) içinde track etmek, retrieval kalitesini proactive yönetme imkânı verir.

## Cost gerçekten önemli olunca ne yapmalı?

Retrieval kalitesi sabitlenip artık cost optimize edilecekse: (1) Embedding cache — aynı query tekrar gelirse cache'ten dön, 6 saat TTL. Hit rate %40 oldu, embedding cost %40 düştü. (2) Quantized embeddings — float32 yerine int8, index size %75 düştü, retrieval precision loss %2 — acceptable. (3) Hybrid search — sparse (BM25) + dense (vector), sparse %70 daha ucuz, kolay query'ler için sparse yeterli. Query classifier ile routing, %30 query sparse'a, %70 vector'e — cost %20 düştü.

Bu cost optimizasyonları ancak retrieval quality baseline'ı stabilize olduktan sonra yapılmalı. Aksi halde blind cost cutting, downstream LLM waste'i artırır ve net cost artar. RAG economics: embedding $500/ay, retrieval infra $1200/ay, LLM inference $8000/ay. Embedding'de $100 kesmek için retrieval kalitesini düşürüp LLM waste'i $2000 artırmak irrational. Ama retrieval kalitesi %90 precision'da sabitken embedding'i quantize edip $125 kesmek ve LLM waste'i $50 artırmak rational.

Production RAG sistemleri pazarlama automation, müşteri destek, içerik üretimi gibi alanlarda kritik hale geliyor. Ama bunların hepsi retrieval kalitesi üzerine kurulu — kötü retrieval, AI output'unun güvenilirliğini sıfıra indirir. Embedding model, chunking, eval ve monitoring setup'ını doğru yapmadan cost'a odaklanmak temelsiz optimize etmeye çalışmaktır. Şimdi yapılacak: Mevcut RAG pipeline'ınızda retrieval precision metric'i varsa ölçün, yoksa ekleyin. Sonra cost'a bakın.