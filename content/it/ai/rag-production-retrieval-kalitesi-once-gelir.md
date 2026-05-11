---
title: "RAG in Produzione: La Qualità del Retrieval Viene Prima del Costo"
description: "Se scegli male il modello di embedding, la strategia di chunking e la valutazione, il tuo sistema RAG sarà costoso, lento o entrambi. Cosa tenere in considerazione in produzione?"
publishedAt: 2026-05-11
modifiedAt: 2026-05-11
category: ai
i18nKey: ai-003-2026-05
tags: [rag, embedding, chunking, llm-eval, retrieval-quality]
readingTime: 9
author: Roibase
---

I sistemi RAG si sono diffusi in produzione a partire dal 2024. Le aziende costruiscono stack di embedding + vector database per alimentare i propri LLM con corpus di documenti interni. Tuttavia, la maggior parte dei progetti pilota si scontra con lo stesso problema: la qualità del retrieval è bassa, le risposte sono incoerenti, i costi sono fuori controllo. Il problema risiede solitamente nella scelta affrettata del modello di embedding, nella strategia di chunking e nella configurazione della valutazione. In questo articolo mostriamo quali decisioni non sono reversibili prima di portare la pipeline RAG in produzione.

## Modello di Embedding: L'Allineamento al Dominio, Non le Dimensioni

Il primo istinto nella scelta del modello di embedding è "quale ha lo score MTEB più alto". Ma il ranking nei benchmark non garantisce le prestazioni in produzione. Ciò che conta davvero è quanto il modello si allinea al tuo tipo di documento e ai pattern delle query.

Quando abbiamo confrontato `text-embedding-3-large` di OpenAI (3072 dim) con `embed-v3` di Cohere (1024 dim): Cohere ha fornito un recall@10 più coerente su documenti di marketing (blog, case study, landing page), perché il suo training set enfatizza i contenuti aziendali. Anche se le dimensioni maggiori di OpenAI mostrano buone prestazioni nei benchmark generali, la distribuzione delle query specifiche del dominio è diversa.

Un altro esempio: `bge-large-en-v1.5` (1024 dim, self-hosted) è sufficiente per documenti legali. Tuttavia, su un corpus multilingue, `multilingual-e5-large` (1024 dim) si distingue chiaramente. La dimensione del modello non è sempre un segnale di qualità — l'allineamento dei dati di training con il tuo dominio è più critico.

**Criteri di selezione:**
1. Non il punteggio MTEB, ma la metrica recall@5 / MRR su un tuo eval set
2. Latency (API vs self-hosted) — tempo di batch embedding per 512 documenti
3. Costo per 1M token — OpenAI 3-large $0.13, Cohere v3 $0.10, self-hosted $0 (ma infra costa)

Se il tuo corpus contiene gergo specifico del dominio (farmaceutico, finanza, legale), fine-tuning di un modello di embedding o l'uso di sentence transformer fine-tunati sui tuoi dati aumenta la qualità del retrieval del 15-20%. Questo rientra nell'ambito dell'[analisi dei dati e dell'ingegneria degli insights](https://www.roibase.com.tr/it/verianalizi) — devi costruire una pipeline di training e monitorare la qualità dei dati.

## Strategia di Chunking: Una Dimensione Fissa Non Funziona

La maggior parte delle implementazioni RAG inizia con il default di chunking "512 token overlapping window". Questo è accettabile per blog in markdown, ma crolla immediatamente su corpus misti (PDF, HTML, JSON).

I problemi del chunking a dimensione fissa:
- I titoli vengono frammentati, perdendo coesione semantica
- Tabelle e blocchi di codice vengono divisi a metà
- La strategia di overlap duplica il contesto sovrapposto, aumentando il rumore nel retrieval

Alternativa: **semantic chunking**. Dividere il contenuto in chunk preservando i limiti delle frasi e la gerarchia dei titoli. Usare `MarkdownTextSplitter` di langchain o parser personalizzati, invece del default `RecursiveCharacterTextSplitter`. Su PDF, usare `pdfplumber` per separare tabelle da testo e applicare strategie di chunking diverse a ciascuno.

Per uno stack RAG di un'azienda di e-commerce, abbiamo diviso i documenti di prodotto in 3 tipi di chunk:
- **Titolo + breve descrizione:** 128 token, leggero per il retrieval
- **Specifiche tecniche + tabella:** 256 token, dati strutturati
- **Contenuto long-form (blog, guida):** 512 token, split semantico

Abbiamo aggiunto metadati diversi a ogni tipo di chunk (chunk_type, source_page). Durante il retrieval, abbiamo applicato filtri chunk_type in base al tipo di query. Ad esempio, le query "confronto prodotti" cercavano solo nei chunk `technical_specs`. Ciò ha aumentato la precision@3 del 18%.

### Strategia di Overlap: Quanto è Sufficiente?

L'overlap è solitamente consigliato tra il 10-20%, ma è arbitrario. Dai test: 50 token di overlap su chunk di 512 token preserva la continuità semantica. 100 token di overlap aumenta la latency del retrieval del 12% senza guadagno di qualità. Il sweet spot varia in base al dominio — testalo sul tuo eval set.

## Configurazione della Valutazione: Deve Essere Impostata Prima di Andare in Produzione

La maggior parte dei sistemi RAG passa in produzione al test "sembra visivamente buono". Ma senza una configurazione di valutazione strutturata e misurata, il sistema non sarà affidabile nei primi 1.000 query.

**Pipeline di valutazione minima:**

```python
# eval_set.json — golden dataset
[
  {
    "query": "Come raccogliere il consenso dell'utente in conformità al GDPR?",
    "expected_docs": ["doc_42", "doc_89"],
    "expected_answer_contains": ["avviso cookie", "consenso esplicito"]
  },
  ...
]

# metriche di valutazione
def evaluate_retrieval(query, retrieved_docs, expected_docs):
    recall_at_k = len(set(retrieved_docs[:5]) & set(expected_docs)) / len(expected_docs)
    mrr = 1 / (retrieved_docs.index(expected_docs[0]) + 1) if expected_docs[0] in retrieved_docs else 0
    return {"recall@5": recall_at_k, "mrr": mrr}

def evaluate_generation(generated_answer, expected_contains):
    # LLM-as-judge: chiedi a Claude "questa risposta copre il contenuto atteso?"
    prompt = f"Expected: {expected_contains}\nGenerated: {generated_answer}\nScore 0-1:"
    score = claude_api(prompt)
    return float(score)
```

**Frequenza di valutazione:** Dopo ogni cambio di modello di embedding, ogni tweak della strategia di chunking. Deve essere eseguita automaticamente in CI/CD. Se recall@5 < 0.7, il deploy deve essere bloccato.

In uno scenario reale: abbiamo preparato un eval set di 200 query per un cliente. Ogni commit eseguiva automaticamente la pipeline di valutazione. Un cambio di chunking ha aumentato recall@5 da 0.68 a 0.81, ma ha aumentato il p95 della latency da 340ms a 520ms. Quando abbiamo visto il tradeoff costo/latency nel dashboard, abbiamo ripristinato il chunking e tentato un approccio diverso. Senza valutazione, questo tradeoff sarebbe rimasto invisibile.

## Hybrid Search: Retrieval Sparse + Dense

Affidarsi esclusivamente alla somiglianza vettoriale fallisce in edge case. Ad esempio, le query che richiedono una corrispondenza esatta di parole chiave (codice prodotto, nome endpoint API) potrebbero ricevere punteggi bassi nella ricerca vettoriale. In questo caso entra in gioco l'**hybrid search**: combina i punteggi BM25 (sparse) + embedding (dense).

```python
# Esempio di retrieval ibrido
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

Risultati dei test: hybrid search ha aumentato recall@5 del 22% su query tecniche. Tuttavia, la latency è raddoppiata perché stai inviando richieste a due indici separati. Se questo tradeoff è accettabile (ad esempio, uno strumento interno, 500ms è sufficiente), hybrid search funziona bene in produzione.

## Reranking: Filtro di Secondo Stadio

La prima fase di retrieval (BM25 + vector) restituisce 20-50 documenti. Ma non tutti entreranno nel context dell'LLM (costo + limite di token). Entra in gioco il **modello di reranking**: ricalcola il punteggio di rilevanza tra la query e ogni documento, selezionando i top-5.

Vengono usati modelli come Cohere `rerank-english-v2.0` o `bge-reranker-large`. Il reranker usa un'architettura cross-encoder — codifica query + documento insieme, quindi è più costoso dell'embedding ma più accurato.

Benchmark: applicando il reranking su 50 documenti:
- Recall@5: 0.73 → 0.89
- Latency: +180ms (accettabile)
- Costo: +$0.002 per retrieval (API Cohere)

Se il budget è limitato, puoi usare un reranker self-hosted, ma richiede GPU inference. A questo punto, devi fare un calcolo tra costo infra vs costo API.

## Ottimizzazione della Context Window: Meno Documenti, Risposte Migliori

Inviare 20 documenti all'LLM non produce sempre risposte migliori. Un context lungo porta il modello al problema "lost in the middle" — ignora le informazioni nel mezzo. Dai test: inviare 5 documenti a GPT-4 Turbo produce risposte migliori rispetto a 15 documenti (differenza BLEU score dell'11%).

**Strategia di ottimizzazione:**
1. Selezionare i top-5 con il reranker
2. Eliminare ogni documento con punteggio di rilevanza < 0.6
3. Inviare i 3-5 documenti rimanenti al context dell'LLM

Questo approccio riduce sia il costo dei token (input token cala del 70%) che migliora la qualità della risposta. In produzione, devi trovare il sweet spot nel triangolo costo/latency/qualità — la pipeline di valutazione lo rende visibile.

## Monitoraggio in Produzione: Retrieval Drift

La qualità del retrieval può peggiorare nel tempo — quando nuovi documenti vengono aggiunti, quando la distribuzione delle query cambia. Per monitorare il **retrieval drift**, devi costruire un dashboard:

| Metrica | Target | Soglia di Allarme |
|---|---|---|
| Recall@5 (eval settimanale) | > 0.75 | < 0.70 |
| Latency P95 | < 400ms | > 600ms |
| Query zero-result (%) | < 5% | > 10% |
| Punteggio di rilevanza medio | > 0.65 | < 0.55 |

Se vedi un drift nel recall:
1. Aggiorna l'eval set (aggiungi nuovi pattern di query)
2. Fine-tuna il modello di embedding o cambialo
3. Rivedi la strategia di chunking

Questo monitoraggio rientra nell'ambito dei [dati first-party e dell'architettura di misurazione](https://www.roibase.com.tr/it/firstparty) — un sistema RAG è anche una data pipeline e deve essere osservabile.

## Tradeoff Costo vs Qualità: Scelte Pragmatiche

In un RAG production, ogni decisione comporta un tradeoff costo/qualità/latency. Alcune scelte pragmatiche:

- **Modello di embedding:** Usa Cohere v3 invece di OpenAI 3-large → riduzione costi del 30%, perdita di qualità del 2% (accettabile)
- **Reranking:** Non farlo per ogni query, ma solo per query ambigue → riduzione latency del 40%
- **Hybrid search:** Solo vector invece di BM25 + vector (se exact match non è critico) → riduzione latency del 50%
- **Context window:** 5 documenti invece di 10 → riduzione token cost del 60%, miglioramento qualità dell'8%

Per vedere questi tradeoff, la pipeline di valutazione è essenziale. Altrimenti dirai "ho cambiato il modello di embedding, ora è più economico" senza accorgerti che il retrieval è calato del 15%.

Portare un sistema RAG in produzione richiede di prendere seriamente il modello di embedding, la strategia di chunking e la configurazione della valutazione. L'ottimizzazione dei costi viene dopo — prima stabilizza la qualità del retrieval, poi riduci i costi. Altrimenti l'affidabilità del sistema si ripercuote sugli utenti e l'adozione scende.