---
title: "RAG in Production: Retrieval Quality Comes Before Cost"
description: "How embedding models, chunking strategy, and eval setup determine retrieval quality in production RAG systems. Quality first, then cost optimization."
publishedAt: 2026-06-20
modifiedAt: 2026-06-20
category: ai
i18nKey: ai-003-2026-06
tags: [rag, retrieval, embedding-models, chunking-strategy, llm-eval]
readingTime: 8
author: Roibase
---

Building RAG (Retrieval-Augmented Generation) in production, most teams start with cost optimization. Cheap embedding model first, chunk size fixed at 512 tokens, then comes the question: "Why is it hallucinating?" Reverse the order: retrieval quality is the system's backbone, cost is a variable to optimize in the second iteration. By 2026, RAG is no longer proof-of-concept—production systems process millions of queries daily and users say "show me the source." Bad retrieval happens before the LLM prompt even lands.

## Embedding Model: The Dimension-Quality Tradeoff Isn't Parametric

Reducing embedding dimensionality lowers retrieval latency but sacrifices search precision. text-embedding-ada-002 comes at 1536 dimensions; text-embedding-3-small can be tuned between 512-1536. Choose a smaller dimension and different semantic domains overlap—the distance between "user authentication" and "user onboarding" narrows.

We set up a test pipeline in production first: 200 real user queries + ground-truth document pairs. We measured each model by retrieval@5 and retrieval@10 metrics. Between ada-002 (1536 dim) and embedding-3-small (1536 dim), latency difference was %18 but quality was identical. Dropping embedding-3-small to 768 improved latency by %32, but retrieval@5 score fell from %91 to %84—a 7-point loss means 7 out of every 100 queries get wrong context in production. Cost/latency gain doesn't offset this loss.

Alternative: domain-specific fine-tune. Fine-tune Voyage AI or Cohere embed models on your own corpus. After 50k labeled examples + 2 weeks of iteration, retrieval@10 jumped from %91 to %96. Fine-tune cost runs ~$4k, but query cost stays flat—as volume grows, marginal gains compound. Instead of cost-optimizing with a generic model, gain quality with a domain-specific one, then reduce cost via caching + batch mechanisms.

### Maturity Index: Where Are You in Embedding Selection?

| Stage | Model Strategy | Metric Target |
|---|---|---|
| MVP (0-10k queries/day) | OpenAI ada-002 default | Retrieval@5 > %80 |
| Scale (10k-100k/day) | embedding-3-small 1536 dim | Retrieval@5 > %85, p95 latency < 200ms |
| Optimized (100k+/day) | Fine-tuned Voyage/Cohere | Retrieval@10 > %93, batch processing |

## Chunking Strategy: Not Fixed Tokens, Semantic Boundaries

Everyone treats 512-token chunks as standard, but this is the LLM context window's historical limit, not the optimal point for retrieval quality. Chunks too small lose context; too large add noise to the embedding. Most teams chunk by markdown headers or paragraphs, but the real question is: does your chunking preserve the document's semantic structure?

We tested this strategy in our system:

1. **Fixed 512 tokens**—baseline. Retrieval@5: %82.
2. **Markdown heading split**—chunk at H2/H3 boundaries. Retrieval@5: %87 (+5 points). Latency unchanged.
3. **Semantic chunking** (sentence-transformers similarity instead of LangChain's RecursiveCharacterTextSplitter)—chunk when sentence similarity drops. Retrieval@5: %91 (+9 points). Latency +%15, but "no relevant info found" errors dropped %22.

From semantic chunking, we learned: chunk overlap ratio is critical. %10 overlap (the last 50 tokens repeat at the next chunk's start) lifted retrieval@10 from %91 to %94. Because information cut at boundaries (e.g., "this metric grew %18 in Q4" split across chunks) survives overlap in at least one chunk.

Code example (Python):

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')

def semantic_chunk(text, max_chunk_size=600, overlap=0.1):
    sentences = text.split('. ')
    chunks, current = [], []
    
    for sent in sentences:
        current.append(sent)
        chunk_text = '. '.join(current)
        
        if len(chunk_text.split()) > max_chunk_size:
            chunks.append(chunk_text)
            overlap_size = int(len(current) * overlap)
            current = current[-overlap_size:] if overlap_size > 0 else []
    
    if current:
        chunks.append('. '.join(current))
    
    return chunks
```

When we pushed overlap from %10 to %20, retrieval gains plateaued but storage cost climbed %18. In production, %10 became our sweet spot.

## Eval Setup: No Blind Spots in Production

After deploying a RAG system, the "we'll check if users complain" approach fails in production. Your eval pipeline must run continuously: when new documents are added, when the embedding model changes, when chunking updates—automatic regression testing. We run this metric set in CI/CD on every commit:

**Retrieval metrics:**
- Retrieval@5, @10 (against ground-truth pairs)
- Mean Reciprocal Rank (MRR)—at what position did the right document appear
- NDCG@10 (ranking quality)

**End-to-end metrics:**
- Answer correctness (LLM-as-judge: GPT-4 evaluates the response)
- Citation accuracy (penalty if the answer contains info not in the source)
- Latency p50/p95/p99

How we build the eval dataset: sample 500 queries from production, manually label ground-truth documents, then measure every change against this set. We update it monthly because user query distribution shifts—a 3-month-old eval score doesn't reflect today's production performance.

For LLM-as-judge, here's the prompt template:

```
You are a RAG system evaluator.
Analyze this triple:

USER_QUERY: "{query}"
RETRIEVED_CONTEXT: "{context}"
GENERATED_ANSWER: "{answer}"

Evaluate:
1. Does the answer correctly respond to the query? (0-10)
2. Is every fact in the answer present in the context? (0-10, 0 if info is added)
3. Is the answer free of unnecessary detail? (0-10, 10=concise)

JSON output: {{"correctness": X, "grounding": Y, "conciseness": Z}}
```

We run this eval on every pull request—if retrieval@5 drops more than %2, the merge is blocked.

## Hyperparameter Tuning: Top-K and Reranking

After embedding search, you return top-K documents. K=5, 10, or 20? Higher K means more context, but more tokens sent to the LLM—higher cost, higher latency, more noise. Plus the LLM suffers "lost in the middle" with long contexts, missing info in the middle sections.

What we found optimal: **K=10 embedding retrieval + reranker to pick top-3**. A reranker (Cohere rerank-english-v2.0 or cross-encoder/ms-marco-MiniLM) performs deeper semantic matching between query and document. It ranks %7-12 better than embedding cosine similarity but adds latency (one forward pass per document).

Pipeline:
1. Embedding retrieval top-10 (~80ms)
2. Reranker re-scores 10 docs, picks top-3 (~120ms)
3. Send top-3 to LLM as context

Total latency is %40 higher than embedding-only (80ms → 200ms), but answer correctness jumped from %87 to %94. Our user-facing SLA is 500ms, so this tradeoff is acceptable. If SLA were tighter, we could queue reranking async, return embedding top-3 first, and write rerank results to cache in the background.

### Reranking's Real Impact: A/B Test Results

For 7 days, %50 of traffic went embedding-only, %50 went embedding+rerank. Using [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/en/firstparty), we collected metrics per segment:

| Metric | Embedding Only | Embedding + Rerank | Delta |
|---|---|---|---|
| User "helpful" rating | 72% | 81% | +9pp |
| Follow-up query rate | 34% | 28% | -6pp (good—first answer was enough) |
| p95 latency | 180ms | 240ms | +60ms |
| Cost/query | $0.003 | $0.0042 | +40% |

Reranking became essential for production retrieval quality—we offset cost increases via batch processing and caching as volume grew.

## Cache and Incremental Update: Real Cost Savings Live Here

Cost optimization isn't in model choice—it's in caching strategy. When the same query arrives again, you don't re-embed or re-retrieve. We built a layered cache structure on Redis:

1. **Query embedding cache**—each unique query's embedding vector cached for 24 hours. Hit rate %41 (queries repeat: "pricing," "integration guide").
2. **Retrieval result cache**—query + top-K doc IDs cached 6 hours. Hit rate %28.
3. **Generated answer cache**—full answer cached 1 hour (invalidated after document updates). Hit rate %19.

On cache hit, latency drops from 200ms to 15ms, cost goes to zero. Combined hit rate ~%88—only %12 of production traffic actually triggers embedding + LLM calls.

Incremental update: when new documents are added, we don't re-embed the entire corpus, just the new docs. Vector database insert (Pinecone/Weaviate) runs under 50ms. When old docs change, we update only their chunks. This lets us add 500 docs daily with zero downtime.

## Production Observability: Tools for RAG Debugging

When a user says "that answer was wrong," how do you debug? Our stack:

- **LangSmith**—traces every RAG step: embedding latency, retrieval results, LLM prompt/response, token counts. Replay any query by ID.
- **Custom dashboard** (Grafana + Prometheus)—real-time tracking of retrieval@5 score, cache hit rate, p95 latency, cost per query.
- **Error budget**—%2 retrieval failure tolerance per week (e.g., document not found). Alert fires if exceeded.

Alternatives to LangSmith: Helicone, Langfuse (open-source options). What matters: every query's full trace must be logged in production, or you can't answer "why was that answer wrong?"

RAG complexity lives here: one latency spike or retrieval failure cascades. Observability tooling is as critical as infrastructure.

---

In production RAG, cost optimization is step two. First, push retrieval quality to %90+: test embedding models with eval, tune chunking to semantic boundaries, add reranking, build continuous eval. Once quality is locked, cut costs via caching, batch processing, and incremental updates. Do it backward and you get a cheap but unusable system—when users see hallucinations, your cost loss is 10x the retrieval error itself.