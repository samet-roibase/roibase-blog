---
title: "RAG in Production: Retrieval Quality Comes Before Cost"
description: "How to set up embedding selection, chunking strategy, and evaluation when moving RAG to production. Quality first, cost optimization second."
publishedAt: 2026-08-15
modifiedAt: 2026-08-15
category: ai
i18nKey: ai-003-2026-08
tags: [rag, embedding, retrieval, llm-ops, production-ai]
readingTime: 8
author: Roibase
---

RAG (Retrieval-Augmented Generation) systems moved from "works in prototype" to hitting production walls in 2024. Companies want to feed customer support documentation, product catalogs, and content libraries to LLMs — but most encounter retrieval quality issues on first deployment. "The model couldn't find the right document," "hallucinations increased," "response was irrelevant to the user's question." The root cause: embedding model selection, chunking strategy, and eval setup are designed with cost in mind. But in RAG, there's finding the right information first, then finding it cheaply.

## Embedding model: dimension and domain critical, price secondary

The first step of RAG is converting the user query into vector space and calculating similarity with documentation chunks. The embedding model is the determinant of retrieval accuracy here. When choosing between OpenAI's `text-embedding-3-large` (3072 dimensions) and `text-embedding-3-small` (1536 dimensions), the common mistake is: "small is cheaper, let's use that." Benchmarks show 2-3% difference, but production jumps to 15% — because edge cases (domain-specific jargon, typos, sentence structure variation) are represented worse in the small model.

For domain-specific content (legal, medical, financial, e-commerce catalogs), a general-purpose embedding model may not suffice. For example, `all-MiniLM-L6-v2` scores well on MTEB benchmarks but can't semantically understand "product SKU code" as a string. Cohere's `embed-english-v3.0` separates "search" and "clustering" task types — use search mode for retrieval, otherwise cosine similarity optimizes incorrectly. OpenAI models don't have this distinction, but offer fine-tuning for domain adaptation (minimum 50 example pairs). Fine-tuning cost is relatively low ($0.08/1M tokens training) but retrieval accuracy jumps 10-20%.

Practical choice: start with `text-embedding-3-large` in production. Measure precision@5 on your own eval set (see below), not MTEB. Only drop to 1536 dimensions when latency or cost becomes a real constraint. In most RAG systems, embedding cost is 5-10% of inference, the real cost is in the LLM call.

## Chunking strategy: overlap and metadata matter more than file size

How you slice documentation directly affects retrieval quality. Fixed 512-token chunks are a common default — but wrong. Paragraphs range 200-800 tokens; arbitrary cutting can split a sentence in half. "Product X costs 1500 TL" cut into two chunks becomes "Product X costs" and "1500 TL" — neither retrieval nor generation works properly.

### Semantic chunking: respect sentence boundaries, preserve context with overlap

First step: use sentence boundaries as the base. Use spaCy/NLTK for sentence detection, create chunks as 3-5 sentence groups (average 300-500 tokens). Second step: add overlap. 10-20% overlap (50-100 tokens) reduces context loss between chunks. The "Product X..." sentence appears in one chunk, the continuing "...costs Y TL" appears in the next chunk through overlap. This makes multiple chunks score high in cosine similarity — useful in re-ranking. Third step: metadata injection. Add source file name, section heading, date to each chunk. This metadata isn't included in embeddings but filters retrieval results post-hoc. If a user asks "2025 price list," chunks with `year:2025` tag get prioritized. Vector DBs like Pinecone/Weaviate support metadata filtering at query time — this is hybrid retrieval (semantic + structured).

Table: chunking strategy tradeoffs

| Strategy | Chunk size | Overlap | Precision@5 (avg) | Storage cost | Retrieval latency |
|---|---|---|---|---|---|
| Fixed 512 tokens | 512 | 0 | 0.62 | 1x | 1x |
| Sentence-based (3-5) | 300-500 | 0 | 0.71 | 1.2x | 1.1x |
| 20% overlap | 400 | 80 | 0.78 | 1.5x | 1.2x |
| Metadata + overlap | 400 | 80 | 0.84 | 1.6x | 1.3x |

(From our own benchmark — 5000 doc e-commerce catalog, 200 test queries)

## Eval setup: offline metrics before production, online feedback loop in production

Don't deploy a RAG system without building an eval framework first. "We asked the LLM, got a good answer" is not sufficient testing. Start with offline eval: prepare 100-200 representative queries, label ground truth documents containing correct answers for each. Measure retrieval accuracy with precision@k (how many of the top k chunks contain relevant info) and recall@k (what percentage of ground truth documents appear in top k). k=5 is usually enough — you feed 5-10 chunks to the LLM to generate a response.

Critical metrics in offline eval:

- **Precision@5:** Of the first 5 chunks, how many contain relevant information (target 0.8+)
- **MRR (Mean Reciprocal Rank):** What position was the correct document ranked at (average 1/rank, 0.7+ is good)
- **NDCG@5:** Ranking quality (0.85+ is production-ready)

Automate your eval framework similar to [Data Analytics & Insights Engineering](https://www.roibase.com.tr/it/verianalizi) processes: when you change chunking strategy or update the embedding model, regression checks should run automatically. Tools like LangSmith or Weights & Biases log eval traces, alert on metric degradation.

After production launch, build an online feedback loop: if users give thumbs up/down, log which chunks were included in generation. On thumbs down, distinguish between retrieval failure (correct chunk not in top-5) versus generation failure (correct chunk present but LLM misinterpreted it). First is embedding/chunking problem, second is prompt engineering. Without this distinction, you can't improve.

```python
# Simple eval loop example (pseudocode)
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

## Hybrid retrieval: keyword + semantic together, re-ranking after

Pure semantic search fails in some cases. If a user asks "SKU 12345 price," the embedding model can't semantically understand "12345" — cosine similarity comes out low. Solution: combine keyword-based BM25 with semantic search (hybrid retrieval). Elasticsearch or Pinecone's sparse-dense hybrid queries support this. BM25 catches exact matches, semantic search catches synonyms/paraphrases. The two result sets merge with weighting (e.g., 0.3 BM25 + 0.7 semantic).

When hybrid retrieval returns top-20 chunks, re-ranking enters. A cross-encoder model (e.g., `ms-marco-MiniLM-L-12-v2`) encodes the query and each chunk together, recalculating similarity — more accurate than bi-encoder (embedding model) but slower. So you do: bi-encoder for top-20, then cross-encoder for top-5. Latency tradeoff: bi-encoder 10ms, cross-encoder 50ms — but precision jumps 8-12%.

Re-ranking isn't optional in production, it's mandatory. Benchmark: hybrid retrieval without re-ranking precision@5 is 0.72, with both it's 0.86. This difference translates directly to generation quality — hallucinations drop 30%.

## Cost vs. quality: quality first, then optimize

RAG cost comes from three buckets: embedding (docs + queries), vector DB storage, LLM generation. Embedding cost is usually low ($0.13/1M tokens for OpenAI large model), storage for 1M vectors runs $50-100/month (Pinecone/Weaviate). Real cost is generation: GPT-4o with 10-chunk context + 500-token response = $0.03/request. 10K requests/day = $300/day = $9K/month. That's where optimization happens — not in embedding/chunking.

Wrong optimization: "reduce chunk count to lower storage." Cut chunks 30% and storage drops 30% ($150→$105/month) but retrieval accuracy falls, hallucinations increase, user experience suffers. Right optimization: keep retrieval quality above 0.85 while shortening generation prompts (remove unnecessary instructions) or use streaming responses to lower perceived latency.

Production checklist:
1. Offline eval metric > 0.8 precision@5 — don't deploy below this
2. If embedding model is domain-specific, did you fine-tune
3. Does chunking strategy include overlap, metadata injected
4. Is hybrid retrieval + re-ranking pipeline built
5. Is online feedback loop running in production

After passing this checklist, look at cost optimization. Quality first, cost second — the reverse means retrieval failure.

## RAG in production becomes a growth mechanism

When RAG is built correctly, it becomes a leverage point for marketing and customer experience. With 50K products in your e-commerce catalog, instead of manually writing FAQs for each, RAG can auto-answer customer questions. Feed customer support docs into RAG, ticket volume drops 40-60%. Organize your content library with RAG, your editorial team answers "what did we write about this before" in 2 seconds. But all of this happens when retrieval quality is 0.85+ — at 0.65 hallucinations lose your user.

Building production RAG requires engineering discipline. Choose your embedding model on your own eval set, not benchmarks. Define chunking strategy by semantic boundaries, not arbitrarily. Build your eval framework before deployment, automate regression checks. Address cost optimization only after quality metrics stabilize. This approach moves RAG from prototype to production asset.