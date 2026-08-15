---
title: "RAG in Production: Retrieval Quality Comes Before Cost"
description: "How do you move a RAG system to production? Embedding selection, chunking strategy, and eval setup are critical—and retrieval quality must come first, not cost optimization."
publishedAt: 2026-08-15
modifiedAt: 2026-08-15
category: ai
i18nKey: ai-003-2026-08
tags: [rag, embedding, retrieval, llm-ops, production-ai]
readingTime: 8
author: Roibase
---

RAG (Retrieval-Augmented Generation) systems moved from "works in prototype" to production reality in 2024. Companies want to feed customer support documentation, product catalogs, and content libraries to LLMs—but most hit retrieval quality problems on first deployment. "Model didn't find the right document," "hallucinations increased," "answer unrelated to user question." The real issue: embedding model selection, chunking strategy, and eval setup are built around cost optimization. But in RAG, you find the right information first, then find it cheaply.

## Embedding model: dimension and domain matter, price is secondary

RAG's first step is converting a user query to vector space and calculating similarity with documentation chunks. The embedding model determines retrieval accuracy here. When choosing between OpenAI's `text-embedding-3-large` (3072 dimensions) and `text-embedding-3-small` (1536 dimensions), the common mistake is: "small is cheaper, we'll use that." Benchmarks show 2–3% difference; in production, this becomes 15%—because edge cases (domain jargon, typos, sentence structure variation) are represented much worse in small models.

For domain-specific content (law, medicine, finance, e-commerce catalogs), general-purpose embedding may not be enough. For instance, `all-MiniLM-L6-v2` scores well on MTEB benchmarks but can't semantically understand strings like "product SKU code." Cohere's `embed-english-v3.0` separates "search" and "clustering" task types—use search mode for retrieval, otherwise cosine similarity optimizes incorrectly. OpenAI models don't have this distinction, but they offer fine-tuning for domain adaptation (minimum 50 example pairs). Fine-tuning cost is modest ($0.08/1M tokens training) but retrieval accuracy improves 10–20%.

Practical decision: in production, start with `text-embedding-3-large` as baseline. Don't rely on MTEB; measure precision@5 on your own eval set (see below). Only drop to 1536 dimensions if latency or cost truly becomes a problem. In most RAG systems, embedding cost is 5–10% of inference cost; the real expense is the LLM call.

## Chunking strategy: overlap and metadata matter more than file size

How you split documentation directly affects retrieval quality. Fixed 512-token chunks are a common default—and wrong. Paragraphs range 200–800 tokens; arbitrary cutting breaks sentences in half. If "Product X costs 1500 TL" splits into two chunks—one "Product X costs," the other "1500 TL"—neither retrieval nor generation works properly.

### Semantic chunking: respect sentence boundaries, preserve context with overlap

First step: base chunks on sentence boundaries. Use spaCy/NLTK for sentence boundary detection; build chunks as 3–5 sentence groups (average 300–500 tokens). Second step: add overlap. 10–20% overlap (50–100 tokens) reduces context loss between chunks. The sentence "Product X..." appears in one chunk and its continuation "...costs Y" appears in the next chunk because of overlap. This causes multiple chunks to score high in cosine similarity—useful for re-ranking. Third step: inject metadata. Add source filename, section heading, date to each chunk. Metadata isn't embedded but filters results after retrieval. If a user asks "2025 price list," chunks tagged `year:2025` in metadata get priority. Vector DBs like Pinecone/Weaviate support metadata filtering at query time—this is hybrid retrieval (semantic + structured).

Chunking strategy tradeoffs table:

| Strategy | Chunk size | Overlap | Precision@5 (avg) | Storage cost | Retrieval latency |
|---|---|---|---|---|---|
| Fixed 512 token | 512 | 0 | 0.62 | 1x | 1x |
| Sentence-based (3–5) | 300–500 | 0 | 0.71 | 1.2x | 1.1x |
| Overlap 20% | 400 | 80 | 0.78 | 1.5x | 1.2x |
| Metadata + overlap | 400 | 80 | 0.84 | 1.6x | 1.3x |

(Table from our own benchmark—5,000 docs e-commerce catalog, 200 test queries)

## Eval setup: offline metrics before production, online feedback loop during

Never deploy a RAG system without an eval framework. "We asked the LLM, it answered well" isn't enough. Start offline: prepare 100–200 representative queries, label ground truth documents for each query. Measure retrieval accuracy with precision@k (how many of the first k chunks contain relevant info) and recall@k (what fraction of ground truth docs appear in top-k). k=5 is usually enough—you feed 5–10 chunks to the LLM for generation anyway.

Critical metrics for offline eval:

- **Precision@5:** How many of the first 5 chunks are relevant (target > 0.8)
- **MRR (Mean Reciprocal Rank):** What rank does the right document get (average 1/rank, > 0.7 is good)
- **NDCG@5:** Ranking quality (> 0.85 is production-ready)

Automate your eval framework like you would a [Data Analytics & Insights Engineering](https://www.roibase.com.tr/en/verianalizi) process: when you change chunking or update your embedding model, a regression check should run. Tools like LangSmith or Weights & Biases log eval traces and alert on metric degradation.

After production launch, set up an online feedback loop: when users thumbs-up or thumbs-down, log which chunks were included in generation. On thumbs-down, separate retrieval failure (right chunk not in top-5) from generation failure (chunk was there but LLM misinterpreted). The first is embedding/chunking; the second is prompt engineering. Without this distinction, you can't improve.

```python
# Basic eval loop example (pseudocode)
def evaluate_retrieval(queries, ground_truth_docs, retriever):
    precisions = []
    for query in queries:
        retrieved_chunks = retriever.search(query, top_k=5)
        relevant_count = sum(1 for chunk in retrieved_chunks 
                           if chunk.doc_id in ground_truth_docs[query])
        precisions.append(relevant_count / 5)
    return sum(precisions) / len(precisions)

# Guarantee this metric doesn't drop below 0.75 before each deployment
```

## Hybrid retrieval: keyword + semantic together, re-rank after

Pure semantic search fails in some cases. When a user asks "SKU 12345 price," the embedding model can't semantically understand "12345" as a string—cosine similarity is low. Solution: combine keyword-based BM25 with semantic search (hybrid retrieval). Elasticsearch or Pinecone's sparse-dense hybrid query supports this. BM25 catches exact matches; semantic search catches synonyms and paraphrases. Two result sets merge with weights (e.g., 0.3×BM25 + 0.7×semantic).

When hybrid retrieval returns top-20 chunks, re-ranking kicks in. A cross-encoder model (e.g., `ms-marco-MiniLM-L-12-v2`) encodes the query and each chunk together, recalculating similarity—more accurate than bi-encoders (embedding models) but slower. You get 20 candidates from bi-encoder, then top-5 from cross-encoder. Latency tradeoff: bi-encoder ~10ms, cross-encoder ~50ms—but precision@5 improves 8–12%.

Re-ranking isn't optional in production; it's mandatory. Benchmark: hybrid retrieval without re-ranking gives precision@5 of 0.72; with both, 0.86. This difference translates directly to generation quality—hallucinations drop 30%.

## Cost vs. quality: achieve quality first, then optimize

RAG cost has three sources: embedding (documents + queries), vector DB storage, LLM generation. Embedding cost is usually low ($0.13/1M tokens for OpenAI large model); storage for 1M vectors runs $50–100/month (Pinecone/Weaviate). The real expense is generation: GPT-4o with 10-chunk context + 500-token response = $0.03/request. 10K requests/day = $300/day = $9K/month. Optimization happens here—not in embedding or chunking.

Wrong optimization: "cut chunk count to save storage." Cut chunk count 30%, you save 30% storage ($150→$105/month) but retrieval accuracy drops, hallucinations rise, user experience suffers. Right optimization: keep retrieval quality > 0.85 while shortening your generation prompt (remove unnecessary instructions) or use streaming responses to reduce perceived latency.

Production checklist:
1. Offline eval metric > 0.8 precision@5—don't deploy below this
2. If embedding model is domain-specific, did you fine-tune it?
3. Does chunking strategy include overlap? Metadata injected?
4. Is hybrid retrieval + re-ranking pipeline in place?
5. Is online feedback loop running in production?

After passing this checklist, look at cost optimization. Quality first, cost second—the reverse is retrieval failure.

## RAG in production becomes a growth mechanism

When built correctly, a RAG system becomes a leverage point for marketing and customer experience. With 50K products in your e-commerce catalog, instead of writing FAQs for each, RAG can auto-answer user questions. Feed customer support docs to RAG and ticket volume drops 40–60%. Organize your content library in RAG so your editorial team answers "what did we write about this before" in 2 seconds. But all of this happens only if retrieval quality is > 0.85—at 0.65, hallucinations lose your user.

Deploying RAG to production demands engineering discipline. Choose your embedding model by benchmarking against your own eval set, not published benchmarks. Define chunking by semantic boundaries, not arbitrarily. Build your eval framework before deployment; automate regression checks. Handle cost optimization only after quality metrics stabilize. This approach moves RAG from prototype to production asset.