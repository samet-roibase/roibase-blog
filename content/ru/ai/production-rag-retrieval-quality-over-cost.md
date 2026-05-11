---
title: "Production RAG: Retrieval Quality Comes Before Cost"
description: "Wrong embedding model, chunking strategy, and eval setup choice makes RAG either expensive or slow—or both. What to focus on in production?"
publishedAt: 2026-05-11
modifiedAt: 2026-05-11
category: ai
i18nKey: ai-003-2026-05
tags: [rag, embedding, chunking, llm-eval, retrieval-quality]
readingTime: 8
author: Roibase
---

RAG systems have become widespread in production since 2024. Companies are building embedding + vector DB stacks to feed their own document corpus to LLMs. But most pilot projects hit the same wall: retrieval quality is low, answers are inconsistent, costs spiral. The problem usually comes down to hasty decisions on embedding model choice, chunking strategy, and eval setup. This post shows which decisions have no undo button before shipping your RAG pipeline to production.

## Embedding Model: Alignment Over Dimensionality

The first instinct when choosing an embedding model is "which has the highest MTEB score." But benchmark rankings don't guarantee production performance. What matters is how well the model aligns with your document type and query pattern.

When we compared OpenAI's `text-embedding-3-large` (3072 dim) against Cohere's `embed-v3` (1024 dim), Cohere delivered more consistent recall@10 on marketing documents (blogs, case studies, landing pages) because its training set was heavy on business content. OpenAI's larger size scored well on general benchmarks, but the distribution of domain-specific queries was different.

Another example: `bge-large-en-v1.5` (1024 dim, self-hosted) is sufficient for legal documents. But on a multilingual corpus, `multilingual-e5-large` (1024 dim) clearly outperforms. Model size isn't always a quality signal—training data overlap with your domain is more critical.

**Selection criteria:**
1. Not MTEB score—recall@5 / MRR metric on your own eval set
2. Latency (self-hosted vs API)—batch embedding time for 512 documents
3. Cost per 1M tokens—OpenAI 3-large $0.13, Cohere v3 $0.10, self-hosted $0 but infrastructure exists

If your document set has domain-specific jargon (pharma, finance, legal), fine-tuning an embedding model or sentence transformers on your own data lifts retrieval quality by 15–20%. This falls under [data analytics & insight engineering](https://www.roibase.com.tr/ru/verianalizi)—you need a training pipeline and data quality observation.

## Chunking Strategy: Fixed Size Doesn't Scale

Most RAG implementations start with "512 token overlapping window" as default. This barely works for markdown blogs but breaks immediately on mixed-format corpus (PDF, HTML, JSON).

Problems with fixed-size chunking:
- Headers get split, semantic integrity lost
- Tables, code blocks cut in half
- Overlap strategy duplicates overlapping context, retrieval noise increases

Alternative: **semantic chunking**. Split on sentence boundaries and heading hierarchy to preserve semantic units. Use `MarkdownTextSplitter` instead of `langchain`'s `RecursiveCharacterTextSplitter`. Parse PDFs with `pdfplumber` to separate tables from text and apply different strategies to each.

For an e-commerce company's RAG stack, we split product documentation into three chunk types:
- **Title + short description:** 128 tokens, lightweight for retrieval
- **Technical specs + table:** 256 tokens, structured data
- **Long-form content (blog, guide):** 512 tokens, semantic split

We added metadata to each chunk (chunk_type, source_page). During retrieval, we filtered by chunk_type based on query type. For example, "product comparison" queries only looked at `technical_specs` chunks. This lifted precision@3 by 18%.

### Overlap Strategy: How Much Is Enough?

Overlap is usually recommended at 10–20% but that's arbitrary. Our test: 50-token overlap on 512-token chunks preserves semantic continuity. 100-token overlap bumped retrieval latency 12% with no quality gain. The sweet spot varies by domain—test on your eval set.

## Eval Setup: Must Exist Before Production

Most RAG systems pass to production on a "looks good visually" test. But without a structured eval setup to measure retrieval quality, the system won't be trustworthy after the first 1,000 queries.

**Minimal eval pipeline:**

```python
# eval_set.json — golden dataset
[
  {
    "query": "How to collect user consent in GDPR-compliant way?",
    "expected_docs": ["doc_42", "doc_89"],
    "expected_answer_contains": ["cookie notice", "explicit consent"]
  },
  ...
]

# eval metrics
def evaluate_retrieval(query, retrieved_docs, expected_docs):
    recall_at_k = len(set(retrieved_docs[:5]) & set(expected_docs)) / len(expected_docs)
    mrr = 1 / (retrieved_docs.index(expected_docs[0]) + 1) if expected_docs[0] in retrieved_docs else 0
    return {"recall@5": recall_at_k, "mrr": mrr}

def evaluate_generation(generated_answer, expected_contains):
    # LLM-as-judge: ask Claude "does this answer cover the expected content?"
    prompt = f"Expected: {expected_contains}\nGenerated: {generated_answer}\nScore 0-1:"
    score = claude_api(prompt)
    return float(score)
```

**Eval frequency:** After every embedding model change, every chunking strategy tweak. Run automatically in CI/CD. If recall@5 drops below 0.7, block the deploy.

Real scenario: we built a 200-query eval set for a customer. The eval pipeline ran automatically on every commit. One chunking change lifted recall@5 from 0.68 to 0.81 but p95 latency went from 340ms to 520ms. Without eval, this latency-quality tradeoff would have been invisible on the dashboard.

## Hybrid Search: Sparse + Dense Retrieval Combined

Relying only on vector similarity fails on edge cases. For example, queries needing exact keyword matches (product codes, API endpoint names) score low in vector search. This is where **hybrid search** enters: combine BM25 (sparse) + embedding (dense) scores.

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

Test result: hybrid search lifted recall@5 by 22% on technical queries. But latency doubled because you're querying two separate indexes. If this tradeoff is acceptable (e.g., internal tool with <500ms requirement), hybrid search works in production.

## Reranking: Second-Stage Filtering

First retrieval (BM25 + vector) returns 20–50 documents. But not all fit in LLM context (cost + token limit). A **reranker model** steps in: rescores each document by relevance to the query and picks top-5.

Models like Cohere's `rerank-english-v2.0` or `bge-reranker-large` do this. Rerankers use cross-encoder architecture—they encode query + document together, so they're pricier than embeddings but more accurate.

Benchmark: applying reranking over 50 documents:
- Recall@5: 0.73 → 0.89
- Latency: +180ms (acceptable)
- Cost: +$0.002 per retrieval (Cohere API)

If budget is tight, use a self-hosted reranker—but you need GPU inference. At this point, calculate self-hosted infra cost vs API cost.

## Context Window Optimization: Fewer Documents, Better Answers

Sending 20 documents to an LLM doesn't always produce better answers. Long context triggers the "lost in the middle" problem—the model skips information in the middle. Test result: sending GPT-4 Turbo 5 documents produces better answers than 15 documents (11% BLEU score difference).

**Optimization strategy:**
1. Use reranker to pick top-5
2. Drop documents with relevance score < 0.6
3. Send remaining 3–5 documents to LLM context

This cuts input token cost by 70% and improves answer quality. In production, you're balancing the cost/latency/quality triangle—eval pipeline makes this visible.

## Production Monitoring: Retrieval Drift

Retrieval quality can degrade over time—as new documents are added, query distribution shifts. Set up a **retrieval drift** dashboard:

| Metric | Target | Alarm Threshold |
|---|---|---|
| Recall@5 (weekly eval) | > 0.75 | < 0.70 |
| P95 latency | < 400ms | > 600ms |
| Zero-result queries (%) | < 5% | > 10% |
| Average relevance score | > 0.65 | < 0.55 |

If you see recall drift:
1. Update your eval set (add new query patterns)
2. Fine-tune the embedding model or swap it
3. Revisit chunking strategy

This monitoring falls under [first-party data & measurement architecture](https://www.roibase.com.tr/ru/firstparty)—a RAG system is also a data pipeline and must be observable.

## Cost vs Quality Tradeoff: Pragmatic Choices

In production RAG, every decision involves a cost/quality/latency tradeoff. Some pragmatic moves:

- **Embedding model:** Use Cohere v3 instead of OpenAI 3-large → 30% cost savings, 2% quality loss (acceptable)
- **Reranking:** Rerank only ambiguous queries instead of all → 40% latency reduction
- **Hybrid search:** Vector-only instead of BM25 + vector (if exact match isn't critical) → 50% latency reduction
- **Context window:** 5 documents instead of 10 → 60% token cost reduction, 8% quality improvement

To see these tradeoffs, you need an eval pipeline. Otherwise you say "I swapped the embedding model, it's cheaper now" but miss the 15% retrieval quality drop.

Before shipping your RAG system to production, take embedding model, chunking strategy, and eval setup seriously. Cost optimization comes second—first stabilize retrieval quality, then optimize cost. Otherwise, the system's unreliability hits your users and adoption suffers.