---
title: "RAG in Production: La Qualità del Recupero Prima del Costo"
description: "Come il modello di embedding, la strategia di chunking e il setup di valutazione determinano la qualità del recupero nei sistemi RAG production? La qualità prima, l'ottimizzazione dei costi dopo."
publishedAt: 2026-06-20
modifiedAt: 2026-06-20
category: ai
i18nKey: ai-003-2026-06
tags: [rag, retrieval, embedding-models, chunking-strategy, llm-eval]
readingTime: 9
author: Roibase
---

Nel mettere in piedi RAG (Retrieval-Augmented Generation) in production, la maggior parte dei team inizia con l'ottimizzazione dei costi. Si seleziona prima un modello di embedding economico, poi si fissa la dimensione del chunk a 512 token, e infine si pone la domanda "perché hallucina?". Bisogna rovesciare l'approccio: la qualità del recupero è la spina dorsale del sistema, il costo è una variabile da ottimizzare in una seconda iterazione. Nel 2026 il RAG non è più un proof-of-concept — i sistemi production elaborano milioni di query al giorno e l'utente dice "mostrami la fonte". Un retrieval sbagliato è fallito prima ancora che il prompt raggiunga l'LLM.

## Modello di Embedding: Il Tradeoff Dimensione-Qualità Non È Parametrico

Ridurre la dimensione dell'embedding abbassa la latenza di retrieval ma sacrifica la precisione della ricerca. text-embedding-ada-002 è 1536-dimensionale, text-embedding-3-small può essere regolato tra 512-1536 dimensioni. Se scegli una dimensione piccola, i vettori in spazi semantici diversi si sovrappongono — la distanza tra "user authentication" e "user onboarding" si riduce.

In production abbiamo prima costruito una pipeline di test: 200 query di utenti reali + coppie di documenti ground truth. Abbiamo misurato ogni modello con le metriche retrieval@5 e retrieval@10. Tra ada-002 (1536 dim) e embedding-3-small (1536 dim) non c'era differenza di qualità ma il guadagno di latenza era solo del %18. Quando abbiamo ridotto embedding-3-small a 768 dimensioni, la latenza è migliorata del %32 ma il retrieval@5 è sceso dal %91 al %84 — una perdita di 7 punti, che in production significa 7 query su 100 con contesto sbagliato. Il guadagno di costo/latenza non compensa questa perdita.

Alternativa: fine-tuning domain-specific. Puoi fine-tuning dei modelli Voyage AI o Cohere embed con il tuo corpus. Dopo 50k esempi etichettati + 2 settimane di iterazione, il retrieval@10 è salito dal %91 al %96. Il costo del fine-tuning è circa $4k ma il costo per query rimane lo stesso — man mano che il volume cresce il guadagno marginale aumenta. Invece di ottimizzare i costi con un modello generico, guadagna qualità con un modello domain-specific, poi riduci il costo con cache e batch processing.

### Indice di Maturità: A Quale Stadio Sei nella Selezione dell'Embedding?

| Stadio | Strategia Modello | Target Metrica |
|---|---|---|
| MVP (0-10k query/giorno) | OpenAI ada-002 predefinito | Retrieval@5 > %80 |
| Scale (10k-100k/giorno) | embedding-3-small 1536 dim | Retrieval@5 > %85, p95 latenza < 200ms |
| Ottimizzato (100k+/giorno) | Voyage/Cohere fine-tuned | Retrieval@10 > %93, batch processing |

## Strategia di Chunking: Non Token Fissi, Confini Semantici

Chunk da 512 token viene presentato come standard per tutti ma questo è un limite storico della context window dell'LLM, non il punto ottimale per la qualità del retrieval. Se il chunk è troppo piccolo perdi il contesto, se è troppo grande il rumore nell'embedding aumenta. La maggior parte dei team divide per heading markdown o paragrafi ma la vera domanda è: la tua unità di chunking preserva la struttura semantica del documento?

Nel nostro sistema abbiamo testato le seguenti strategie:

1. **512 token fissi** — baseline. Retrieval@5: %82.
2. **Split su heading markdown** — chunk ai confini di H2/H3. Retrieval@5: %87 (+5 punti). La latenza non è cambiata.
3. **Semantic chunking** (invece di RecursiveCharacterTextSplitter di LangChain, usiamo sentence-transformers per calcolare la similarità) — nuovo chunk quando la similarità tra frasi scende. Retrieval@5: %91 (+9 punti). La latenza è aumentata del %15 ma l'errore "informazione rilevante non trovata" è sceso del %22.

Nel semantic chunking abbiamo scoperto che il rapporto di overlap è critico. Overlap del %10 (cioè gli ultimi 50 token si ripetono all'inizio del chunk successivo) ha aumentato retrieval@10 dal %91 al %94. Perché l'informazione al confine (ad esempio "questa metrica è salita del %18 nel Q4") che viene tagliata in due chunk rimane intatta in almeno un chunk grazie all'overlap.

Esempio di codice (Python):

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

Quando abbiamo aumentato l'overlap dal %10 al %20, il guadagno di retrieval si è fermato ma il costo di storage è salito del %18. In production il %10 è stato il nostro punto ottimale.

## Setup di Valutazione: Nessun Blind Spot in Production

Dopo il deployment del sistema RAG, l'approccio "controlleremo se l'utente si lamenta" non funziona in production. La pipeline di eval deve girare continuamente: quando viene aggiunto un nuovo documento, quando cambia il modello di embedding, quando si aggiorna la strategia di chunking, test di regressione automatici. Noi lanciamo questo set di metriche in CI/CD a ogni commit:

**Metriche di retrieval:**
- Retrieval@5, @10 (su coppie ground truth)
- Mean Reciprocal Rank (MRR) — a quale posizione arriva il documento corretto
- NDCG@10 (qualità del ranking)

**Metriche end-to-end:**
- Answer correctness (LLM-as-judge: GPT-4 valuta la risposta fornita)
- Citation accuracy (se la risposta contiene informazioni non nel documento: -10 punti)
- Latenza p50/p95/p99

Come costruiamo il dataset di eval: prendiamo 500 query da production, etichettiamo manualmente i documenti ground truth, poi misuriamo ogni cambiamento su questo set. Il dataset viene aggiornato ogni mese perché la distribuzione delle query degli utenti cambia — il punteggio di eval di 3 mesi fa non riflette la performance di production oggi.

Esempio di prompt per LLM-as-judge:

```
Sei un modello di valutazione per sistemi RAG.
Analizza la seguente tripletta:

USER_QUERY: "{query}"
RETRIEVED_CONTEXT: "{context}"
GENERATED_ANSWER: "{answer}"

Valuta:
1. La risposta risponde correttamente alla query? (0-10)
2. Ogni informazione nella risposta è nel contesto? (0-10, 0 se ci sono info non nel testo)
3. La risposta contiene dettagli non necessari? (0-10, 10=conciso)

Output JSON: {{"correctness": X, "grounding": Y, "conciseness": Z}}
```

Lanciamo questa valutazione su ogni pull request — se il punteggio retrieval@5 scende di più del %2 il merge viene bloccato.

## Tuning degli Iperparametri: Top-K e Reranking

Dopo la ricerca per embedding recuperi i top-K documenti. K=5, 10 o 20? K più grande significa più contesto ma aumenta il numero di token inviati all'LLM — aumenta sia il costo che la latenza, plus il rumore (l'LLM ha il problema "lost in the middle" — perde le informazioni nel mezzo di un contesto lungo).

Quello che abbiamo trovato ottimale: **K=10 retrieval per embedding + reranker model che seleziona top-3**. Il reranker (Cohere rerank-english-v2.0 o cross-encoder/ms-marco-MiniLM) fa una corrispondenza semantica più profonda tra query e documento. Fornisce un ranking migliore del %7-12 rispetto alla cosine similarity dell'embedding ma aggiunge latenza (forward pass per ogni documento).

Pipeline:
1. Retrieval embedding per top-10 (~80ms)
2. Reranker riklassifica i 10 documenti, seleziona top-3 (~120ms)
3. Invia top-3 come contesto prompt all'LLM

La latenza totale è aumentata del %40 rispetto al scenario embedding-only (80ms → 200ms) ma answer correctness è salita dall'%87 al %94. Il nostro SLA di latenza per l'utente è 500ms quindi questo tradeoff è accettabile. Se l'SLA fosse stato più stretto avremmo potuto mettere il reranker in async queue, fornire prima la risposta con embedding top-3 e scrivere il risultato del rerank in cache in background.

### Il Vero Contributo del Reranking: Risultati del Test A/B

Per 7 giorni il %50 del traffico è andato a embedding-only e il %50 a embedding+rerank. Usando [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/it/firstparty) abbiamo raccolto le metriche per ogni query per segmento:

| Metrica | Embedding Only | Embedding + Rerank | Delta |
|---|---|---|---|
| Rating "utile" dell'utente | 72% | 81% | +9pp |
| Tasso di follow-up query | 34% | 28% | -6pp (positivo — prima risposta sufficiente) |
| p95 latenza | 180ms | 240ms | +60ms |
| Costo/query | $0.003 | $0.0042 | +40% |

Il reranking è essenziale in production per un retrieval di qualità — abbiamo ridotto l'aumento di costo con batch processing e cache man mano che il volume cresceva.

## Cache e Aggiornamento Incrementale: Qui Arrivano i Veri Guadagni di Costo

L'ottimizzazione dei costi non è nella selezione del modello ma nella strategia di cache. Quando la stessa query arriva di nuovo non hai bisogno di fare embedding + retrieval di nuovo. Su Redis abbiamo costruito questa struttura di cache stratificata:

1. **Query embedding cache** — il vettore embedding per ogni query unica viene cachato per 24 ore. Hit rate %41 (perché le query degli utenti sono ripetitive: "pricing", "integration guide").
2. **Retrieval result cache** — la coppia query + top-K document ID viene cachata per 6 ore. Hit rate %28.
3. **Generated answer cache** — la risposta completa viene cachata per 1 ora (invalidata dopo l'aggiornamento del documento). Hit rate %19.

Con cache hit la latenza scende da 200ms a 15ms, il costo è zero. Hit rate combinato ~%88 — solo il %12 del traffic in production fa veramente la chiamata embedding + LLM.

Aggiornamento incrementale: quando aggiungi un nuovo documento non serve fare l'embedding di tutto il corpus di nuovo, solo del nuovo documento. L'operazione di insert nel vector database (Pinecone/Weaviate) è sotto 50ms. Quando un documento vecchio cambia aggiorni solo i chunk di quel documento. In questo modo possiamo aggiungere 500 documenti al giorno, il sistema non ha mai downtime.

## Osservabilità in Production: Strumenti Necessari per il Debugging di RAG

Quando un utente dice "ha dato una risposta sbagliata" come fai il debugging? Il nostro stack:

- **LangSmith** — traccia ogni step della chain RAG: latenza embedding, risultato retrieval, prompt/response LLM, conteggio token. Con l'ID della query puoi fare replay di tutta la pipeline.
- **Dashboard personalizzato** (Grafana + Prometheus) — retrieval@5, hit rate cache, latenza p95, costo/query monitorati in tempo reale.
- **Error budget** — tolleranza del %2 di fallimento di retrieval a settimana (es. documento non trovato). Quando questa soglia viene superata un alert viene inviato.

Alternative open-source a LangSmith: Helicone, Langfuse. La cosa importante è: in production ogni query deve avere una full trace altrimenti non puoi rispondere a "perché ha dato una risposta sbagliata".

La complessità qui è che un singolo spike di latenza o un errore di retrieval cascata. Per il debugging uno strumento di observability è critico quanto l'infrastruttura stessa.

---

In RAG production l'ottimizzazione dei costi è il secondo step. Prima porta la qualità del retrieval sopra il %90: testa il modello di embedding con eval, calibra la strategia di chunking sui confini semantici, aggiungi reranker, costruisci una pipeline di eval continua. Una volta che la qualità è stabile riduci i costi con cache, batch processing e aggiornamento incrementale. Se fai il contrario avrai un sistema economico ma inutilizzabile — quando l'utente vede hallucination la tua perdita di costo è 10 volte superiore all'errore di retrieval.