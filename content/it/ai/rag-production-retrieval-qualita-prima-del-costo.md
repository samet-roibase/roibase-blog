---
title: "RAG in Produzione: la Qualità del Retrieval Prima del Costo"
description: "Scelta del modello di embedding, strategia di chunking e setup di valutazione — come gestire i trade-off performance/costo nei sistemi RAG in produzione."
publishedAt: 2026-07-27
modifiedAt: 2026-07-27
category: ai
i18nKey: ai-003-2026-07
tags: [rag, retrieval, embedding, chunking, llm-eval]
readingTime: 9
author: Roibase
---

Quando i sistemi RAG entrano in produzione, il problema più frequente è questo: se la qualità del retrieval è bassa, per quanto potente sia l'LLM, la risposta è spazzatura. Il modello `text-embedding-3-large` di OpenAI costa 0,00013 dollari per token, quello `embed-english-v3.0` di Cohere 0,0001 dollari — una differenza del 30%, ma se state recuperando chunk sbagliati il risultato è identico: hallucination. Se riducete il costo dell'embedding al ribasso della qualità del retrieval, il costo dell'LLM downstream aumenta del 200% (re-ranking, padding del prompt, retry). Questo articolo mostra come prioritizzare la scelta dell'embedding, il chunking e lo setup di valutazione in una pipeline RAG in produzione.

## Scelta del Modello di Embedding: Matrice Latency × Recall

Quando selezionate un modello di embedding, due metriche sono critiche: recall@k del retrieval (l'informazione corretta si trova nei primi k chunk) e latency p99. La differenza tra Ada v2 e text-embedding-3-small non è solo il prezzo — è la granularità semantica. Se il vostro dominio è ristretto e la terminologia pesante (ad esempio diritto, finanza), un fine-tune di Sentence-BERT (768 dimensioni) produce recall migliore del modello 1536 dimensioni di OpenAI.

I numeri che vediamo in produzione: con `text-embedding-3-large` ottenete un punteggio di retrieval MTEB di 64,6, ma nel vostro eval set specifico del dominio (ad esempio documentazione prodotto e-commerce) scende a 58,2. Abbiamo testato il modello `embed-multilingual-v3.0` di Cohere su contenuti in italiano e il recall@5 è risultato del 12% più alto — perché Cohere ha usato più corpus non-inglese nel training multilingue. Non esiste una sola metrica: con batch size 128 la latency di embedding è 230ms, con una singola richiesta è 45ms. Se fate ricerca in real-time la latency è prioritaria, se fate indexing offline è prioritario il recall.

In pratica testiamo così: prendete il vostro eval set (100-200 domande + ground truth chunk), indexate con 3 modelli, calcolate recall@1/3/5 e MRR (mean reciprocal rank) per ogni modello. Dopo aver scelto il modello vincente, decidete se fare fine-tuning — se recall@5 è sotto il 75%, il ROI del fine-tuning è positivo. Gli [studi di analisi dati](https://www.roibase.com.tr/it/verianalizi) di Roibase includono l'infrastruttura di metriche necessaria per costruire questa pipeline di valutazione.

## Strategia di Chunking: Fixed vs Semantic vs Recursive

La dimensione del chunk è l'iperparametro più critico nel RAG. La differenza tra un chunk di 512 token e uno di 2048 token è questa: chunk più piccoli forniscono retrieval più specifico ma perdono contesto, chunk più grandi conservano il contesto ma aggiungono rumore. Inoltre, anche il tasso di overlap del chunk (ad esempio 10%) influisce sulla precision del retrieval.

Il chunking a dimensione fissa (taglia ogni 512 token) è il metodo più semplice ma quando taglia a metà di un paragrafo si perde l'integrità semantica. Lo `RecursiveCharacterTextSplitter` di Langchain funziona così: prima divide per `\n\n` (paragrafo), se non entra divide per `\n` (linea), se non entra divide per punto. Questo metodo fornisce recall@3 del 18% migliore perché i confini dei chunk seguono la struttura naturale del testo.

Il semantic chunking va un passo oltre: create i chunk guardando la similarità di embedding. Ad esempio, quando in un documento cambia l'argomento (cosine similarity scende sotto 0,6) iniziate un nuovo chunk. Lo `SemanticSplitterNodeParser` di LlamaIndex usa questo metodo. In produzione il trade-off che vediamo: il semantic chunking aumenta il tempo di indexing del 40% (ogni frase viene embeddata) ma aumenta la qualità del retrieval del 9%.

### Overlap del Chunk: Quanto Basta?

Il tasso di overlap solitamente si mantiene tra il 10-20%. Un chunk di 512 token con 50 token di overlap significa che una frase può apparire in due chunk. All'aumentare dell'overlap aumenta la dimensione dell'index (costo di storage) ma in edge case aumenta la qualità del retrieval. Nei nostri test il 15% di overlap è il punto ottimale: più di tanto fornisce diminishing return.

La strategia di overlap è importante anche: sliding window (ogni chunk scorre di 50 token) oppure paragraph-aware overlap (l'overlap solo all'inizio del paragrafo)? L'overlap paragraph-aware crea il 7% in meno di dimensione dell'index mantenendo la stessa qualità di retrieval.

## Setup di Valutazione: le Metriche Offline Devono Rappresentare la Produzione

La trappola più grande nella valutazione RAG è questa: le metriche offline sembrano buone ma in produzione avete un'esplosione di hallucination. La ragione è che il vostro eval set non rappresenta la distribuzione delle query in produzione. La nostra raccomandazione: prendete 200 query casuali dai log di produzione e marcate manualmente i chunk ground truth. Questo lavoro di 4 ore vi orienta correttamente per i prossimi 6 mesi.

Le metriche che devono essere misurate:

| Metrica | Definizione | Target |
|---|---|---|
| Recall@k | L'informazione corretta si trova nei primi k chunk | >80% (k=5) |
| MRR | Posizione media del chunk corretto | >0,7 |
| Context precision | Quanta frazione dei chunk recuperati è rilevante | >60% |
| Answer relevancy | La risposta dell'LLM è pertinente alla domanda (LLM-as-judge) | >85% |
| Faithfulness | La risposta dell'LLM è generata solo dal context | >90% |

Per misurare context precision e faithfulness usiamo LLM-as-judge: chiedete a GPT-4o-mini "Questo chunk è pertinente alla domanda?", ricevete un punteggio 0-1. Questo metodo mostra il 89% di correlazione con la valutazione umana (nel nostro eval interno) e costa 1/50 della valutazione umana.

In produzione dovete fare valutazione continua: ogni 1000 query prendete casualmente 10 query e fatele passare dalla pipeline di valutazione, se la recall scende ricevete un alert. Questo setup si configura facilmente con Prometheus + Grafana — metriche di latency del retrieval, conteggio chunk, utilizzo token LLM possono essere monitorati nello stesso dashboard.

## Hybrid Search: Combinazione di Retrieval Denso + Sparso

Il retrieval puramente denso (solo similarità di embedding) a volte perde exact term match. Ad esempio, quando l'utente chiede "fatturato Q3 2025" il chunk "terzo trimestre 2025 ricavi" è semanticamente vicino ma non ha il termine esatto — il retrieval sparso come BM25 funziona meglio in questo caso. L'hybrid search combina i due metodi: il retrieval denso recupera i top-50 chunk, il retrieval sparso recupera i top-50 chunk, i due risultati si fondono con RRF (reciprocal rank fusion).

Database vettoriali come Weaviate e Qdrant supportano nativamente l'hybrid search. Nei nostri test l'hybrid search fornisce il 6% di recall@10 migliore rispetto al retrieval denso puro ma la latency aumenta del 18% (due query di index separate). In produzione potete attivare/disattivare l'hybrid search in base alla complessità della query: se la query è più corta di 3 parole solo retrieval sparso, se è più lunga di 10 parole solo retrieval denso, nel mezzo hybrid.

Il parametro alpha (peso denso vs sparso) varia a seconda del dominio: nell'e-commerce il retrieval sparso è più importante (codice prodotto, SKU), nella documentazione tecnica il retrieval denso è più importante (similarità concettuale). Il nostro alpha predefinito è 0,7 (prevalenza denso) ma deve essere ottimizzato attraverso test A/B.

## Re-Ranking: Aumento della Precision Dopo il Retrieval

Il retrieval iniziale recupera 50 chunk, ma passare tutti come context all'LLM è costoso e aggiunge rumore. Un modello di re-ranking (come `rerank-english-v3.0` di Cohere) ri-assegna un punteggio a questi 50 chunk in base alla query, seleziona i 5-10 più rilevanti. Il compito del re-ranker è diverso: il modello di embedding misura la similarità semantica generale, il re-ranker misura la rilevanza query-chunk.

In produzione il re-ranking fornisce il 15% di context precision migliore ma aggiunge 80ms di latency. Il trade-off è questo: se il costo dell'LLM downstream è alto (usate GPT-4) il ROI del re-ranking è positivo, se usate GPT-4o-mini il costo della latency pesa di più. Nel nostro setup le query critiche (SLA <500ms) saltano il re-ranking, le query analitiche (dashboard, rapporto) usano il re-ranking.

La scelta del re-ranker è importante: il modello di Cohere è basato su cross-encoder, latency alta ma accuracy buona. Il re-ranker di Jina AI è basato su bi-encoder, latency bassa ma accuracy del 4% inferiore. In produzione dovete testare entrambi e decidere in base al trade-off latency/accuracy.

## Cost Profiling: l'Economia dei Token Inizia dall'Embedding

La distribuzione del costo nella pipeline RAG è così (caso di produzione medio):

- Embedding: 8%
- Vector search: 2% (compute)
- Re-ranking: 5%
- LLM inference: 85%

Il costo dell'embedding sembra piccolo ma viene calcolato su volumi grandi durante l'indexing. 1M documenti, media 1000 token/documento, OpenAI `text-embedding-3-large` con 1B token = 130 dollari. Se fate re-indexing mensile (non incrementale, re-indexing completo) il costo annuale dell'embedding è 1560 dollari. Se passate a Cohere è 1200 dollari. Risparmi del 23%.

Ma il costo vero è questo: se la qualità del retrieval è bassa l'LLM retry, padding del context, correzione dell'hallucination — questo significa aumento token del 200%. 1M query/mese, media 2000 token/query, GPT-4o 10 dollari/1M token = 20K dollari/mese. Se la qualità del retrieval cala del 10% il tasso di retry aumenta del 15%, il costo sale a 23K dollari. State cercando di risparmiare 30 dollari sull'embedding mentre perdete 3K dollari downstream.

Ecco perché quando dite "RAG in produzione" la prima domanda deve essere: ho uno setup di valutazione del retrieval? Se la risposta è no, la scelta del modello di embedding è prematura. L'[architettura dei dati first-party](https://www.roibase.com.tr/it/firstparty) include la costruzione dell'infrastruttura di log che alimenta questa pipeline di valutazione — le query di produzione, i risultati del retrieval, le risposte dell'LLM devono essere salvate in modo strutturato affinché possano essere analizzate in seguito.

## Incremental Indexing: Come Reagire ai Dati che Cambiano

In produzione il set di documenti non è statico — ogni giorno vengono aggiunti nuovi articoli di blog, pagine di prodotto, documentazione. Il re-indexing completo è costoso e richiede downtime. Il metodo di incremental indexing è questo: embeddate solo i documenti che cambiano, aggiungeteli al vector DB. Qdrant e Pinecone supportano nativamente l'insert incrementale.

La difficoltà è questa: quando un documento cambia, aggiornate solo quel chunk o l'intero documento? Se i confini dei chunk cambiano (nuovo paragrafo aggiunto, dimensione chunk cambiata) dovete ricalcolare tutti i chunk del documento. La nostra strategia: tracciamo la versione del documento (hash), se la versione cambia eliminiamo tutti i chunk e li riaggiungiamo. Questo metodo fa un 3% di re-indexing in più ma garantisce la consistency.

La strategia di cancellazione è importante: se non eliminate i chunk vecchi dal vector DB l'index si sporca, la relevance scende. Ma aggiungere un TTL a ogni chunk è anche un overhead. La nostra soluzione: aggiungiamo `doc_id` e `version` ai metadati di ogni chunk, quando il documento si aggiorna facciamo una bulk delete dei chunk della vecchia versione con `doc_id + version`. Questo metodo in Qdrant richiede 200ms, in Pinecone 450ms (per 10K chunk).

Portare un sistema RAG in produzione è criticamente dipendente dalla misurazione preventiva della qualità del retrieval e dal suo monitoraggio continuo. La scelta del modello di embedding, la strategia di chunking, lo setup di valutazione — non sono indipendenti, influenzano l'intera pipeline. L'ottimizzazione del costo non inizia dall'embedding, inizia dalla precision del retrieval. Un sistema che non può recuperare il chunk giusto la prima volta costa esponenzialmente di più downstream.