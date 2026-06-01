---
title: "RAG in Production: Retrieval Quality Comes Before Cost"
description: "Without proper embedding models, chunking strategy, and eval setup, your RAG system becomes a hallucination machine. Lessons from production experience."
publishedAt: 2026-06-01
modifiedAt: 2026-06-01
category: ai
i18nKey: ai-003-2026-06
tags: [rag, embedding, retrieval, llm-eval, production-ai]
readingTime: 8
author: Roibase
---

RAG systems face two fates after hitting production: either they shut down within three weeks due to hallucinations, or retrieval quality reaches 90+ F1 and they become business-critical pipelines. The difference lies hidden in embedding selection, chunking strategy, and eval setup. Cost optimization is secondary—if you don't solve retrieving the right document first, cheaper models just produce expensive errors.

## Embedding Model: Alignment Matters More Than Dimension

The reflexive first choice in embedding selection is "larger model always embeds better." text-embedding-3-large (3072 dim) isn't universally superior to text-embedding-3-small (1536 dim). MTEB benchmarks measure against general corpora—if your domain is finance, medical, or e-commerce, those scores mislead.

In production, we observed: a 768-dimensional domain-specific model (sentence-transformers/all-mpnet-base-v2 fine-tuned on domain data) delivered 12% better recall@10 than a 3072-dimensional general model. The reason is straightforward: the embedding space doesn't understand domain jargon. The semantic distance between "Conversion rate optimization" and "CRO" is 0.68 in the general model, but 0.91 in the domain-tuned one.

The dimension tradeoff is clear: 3072 dim indexes at 4.2GB, 768 dim at 1.1GB. Query latency is 47ms and 18ms respectively (FAISS HNSW, m=16). If retrieval recall loss is under 5%, the smaller model wins—both cost and speed. Making this decision without measurement is engineering on speculation.

### Fine-Tuning Decision

Embedding fine-tuning becomes mandatory in two cases: (1) domain vocabulary is highly specific (medical terms, crypto token names), (2) query-document pair distribution is asymmetric (questions short, documents long). OpenAI Embedding API doesn't accept fine-tuning; use sentence-transformers or Cohere embed-v3. Start with 500-1000 labeled pairs—more yields marginal gains.

## Chunking: Semantics Over Size

There's no rule that "chunk size of 512 tokens is good." We tested three strategies: (1) fixed 512 tokens, (2) markdown header-based (cut at H2/H3 boundaries), (3) semantic chunking (LLM reads paragraph context, splits at semantic transitions). Result: markdown-based chunking delivered 18% better NDCG@5 but took 2.3x longer to build indexes.

Fixed chunking's problem is cutting mid-sentence. "If you integrate server-side tracking with first-party data architecture..." gets cut at token 510, and the next chunk starts with "...integrate, attribution accuracy improves"—context lost. The retriever finds this chunk for "attribution" queries but the LLM can't generate a response due to missing context. That's where hallucination begins.

Semantic chunking (not LangChain's RecursiveCharacterTextSplitter, but asking gpt-4o-mini "does this paragraph transition to a new idea?") works better but costs more: chunking a 10K-page knowledge base cost $47 (0.15$/1M input tokens). The tradeoff matters: index building is one-time cost, retrieval quality is continuous value. We chose semantic, but if your document set updates dynamically (weekly), you might revert to fixed chunking.

| Strategy | Avg Chunk Size | NDCG@5 | Build Time (10K docs) | Cost |
|---|---|---|---|---|
| Fixed 512 | 489 tokens | 0.71 | 4 min | $0 |
| Markdown-based | 680 tokens | 0.84 | 9 min | $0 |
| Semantic (LLM) | 520 tokens | 0.81 | 22 min | $47 |

## Overlap Strategy

Adding overlap between chunks improves retrieval recall—but inflates index size 1.4-1.8x. With 50-token overlap, we saw 6% recall gain (recall@10: 0.78 → 0.83). You can activate overlap selectively for long documents (>2000 tokens) and disable for short content—conditional overlap logic.

## Eval Setup: Offline Metric → Online A/B

Building an eval pipeline before going to production is mandatory. "The LLM output looks good" isn't enough—retrieval precision/recall and LLM factuality must be measured separately.

We measure two layers:
1. **Retrieval layer:** Precision@k, Recall@k, NDCG@k, MRR. Ground truth: manually labeled query-document pairs (320 in our case). Ragas library's `context_precision` metric works without an LLM, suits fast iteration.
2. **Generation layer:** Factual consistency (entailment between document and output), hallucination rate (how often LLM goes beyond the document), citation accuracy (LLM's correctness in referencing sources). We use the LLM-as-judge pattern—asking gpt-4o "does this answer ground in the document?"—with 0.89 agreement rate (vs. human eval).

Offline eval runs daily in CI/CD. Testing new chunking, new embedding, new reranker? These metrics must be green before commit. Online A/B test is separate: we route 10% traffic to the new RAG version and monitor user feedback + session metrics (task completion, query reformulation rate). Even if offline NDCG improves by 0.02, online task completion might not change—in that case, we skip deployment.

### LLM-as-Judge Reliability

Don't blindly trust LLM-as-judge. GPT-4o marked itself hallucinating 6% of the time (false positive), missed real hallucinations 4% of the time (false negative). For critical use cases, human-in-the-loop eval is essential: randomly sampling 5% and having humans verify it. The calibration score is computed against this subset. If calibration drops below 0.85, we revise the judge prompt.

## Reranker: The Power of a Second Pass

Initial retrieval fetches 20-50 chunks (recall-focused); reranker narrows to 3-5 (precision-focused). Cohere rerank-v3 delivered 14% precision gain (P@5: 0.68 → 0.78). Cost: $2 per 1M reranked tokens (10x more than embedding), but feeding the LLM 5 chunks instead of 50 reduces both token use and hallucination risk.

Reranker's tradeoff is latency: embedding search takes 18ms, adding rerank brings it to 95ms. An async pipeline tolerates this—while the user sends a query, retrieval + rerank run in the background; when the LLM starts streaming, total time finishes in 400-500ms. Running synchronously degrades user experience.

RAG without reranking assumes "top-k embedding results are correct." This holds only if query-chunk overlap is high lexically. On semantic queries (e.g., "How do I link first-party data architecture with server-side measurement?"), embedding retrieves 4 irrelevant chunks in the top 10. The reranker's cross-attention cleans this noise. Production RAG without reranking is risky—citation accuracy drops 18%.

## Hybrid Search: BM25 + Embedding

Embedding-only retrieval weakens in two scenarios: (1) exact-match searches (brand names, product codes), (2) rare terms (underrepresented in embedding space). BM25 (keyword-based) fills this gap. In Weaviate or Qdrant, hybrid search: 0.7 embedding weight + 0.3 BM25 weight. Recall@10: embedding-only 0.76, hybrid 0.83.

BM25 indexes are 5-8x smaller than embedding indexes (inverted index structure). No latency penalty (runs in parallel). The only cost in hybrid setup is query planning—finding which weight ratio suits which query type, tested via A/B. In our case, general queries use 0.8 embedding weight, those mentioning brands/products use 0.5.

## Monitoring in Production

60% of RAG deployment is monitoring—preventing silent system degradation. Metrics we track:

- **Retrieval coverage:** Query-to-document match rate (target >95%)
- **Avg context relevance:** What percentage of chunks fed to the LLM are truly relevant (target >0.8)
- **Hallucination rate:** How often LLM output ventures beyond documents (target <5%)
- **Latency p95:** 95th percentile query completion time (target <800ms)
- **Cost per query:** Embedding + rerank + LLM (target <$0.02)

These metrics push to Datadog; threshold breaches trigger Slack alerts. If retrieval coverage drops below 92% for two days, there's a gap in the knowledge base—content team gets notified. Rising hallucination rate means LLM prompt or chunk size needs revision. Latency spikes warrant vector database sharding review.

Connecting RAG metrics to business outcomes is critical—does better retrieval quality also lift user satisfaction survey scores, or just inflate technical metrics? Correlation analysis shows the link.

## Cost vs. Quality Balance

Monthly cost for production RAG: 1M queries, avg 3 chunks per retrieval, gpt-4o-mini generation ≈ $420 (embedding $80, rerank $40, LLM $300). Dropping the reranker brings this to $380 but hallucination rate jumps from 5% to 11%—resulting in more support tickets, indirect cost $600+.

The right way to cut cost: (1) caching layer (same query within 24 hours comes from cache, 23% of queries repeat), (2) smaller embedding model (domain-tuned 768 dim), (3) async rerank (skip reranking for non-critical queries). These drop it to $280 with <2% quality loss.

The wrong approach: replacing embedding with keyword search, LLM with rule-based templates. This produces a system you can't call "AI"—retrieval precision drops to 40%. Cost optimization must not sabotage retrieval quality.

---

Shipping RAG to production is more than model selection—it requires eval discipline, monitoring rigor, and iterative refinement. You can trim embedding dimensions and gain latency but if recall suffers, the LLM halluccinates and users lose trust. First, push retrieval quality to 0.85+ F1, then optimize cost. Otherwise, you've built a cheap hallucination machine.