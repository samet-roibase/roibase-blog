---
title: "RAG in Produzione: la Qualità del Retrieval Viene Prima del Costo"
description: "Senza un modello di embedding corretto, una strategia di chunking solida e una configurazione eval robusta, il tuo sistema RAG diventa una macchina di allucinazioni. Lezioni dall'esperienza in produzione."
publishedAt: 2026-06-01
modifiedAt: 2026-06-01
category: ai
i18nKey: ai-003-2026-06
tags: [rag, embedding, retrieval, llm-eval, production-ai]
readingTime: 9
author: Roibase
---

I sistemi RAG in produzione vivono due destini: o vengono spenti entro 3 settimane a causa delle allucinazioni, oppure raggiungono un F1 di retrieval >90 e diventano pipeline mission-critical. La differenza sta nella scelta dell'embedding, nella strategia di chunking e nella configurazione dell'eval. L'ottimizzazione dei costi è una considerazione secondaria — se non risolvi prima il problema di recuperare il documento giusto, un modello economico produce errori costosi.

## Modello di Embedding: non è una Questione di Dimensionalità

Il primo istinto nella scelta dell'embedding è "il modello più grande genera i migliori embedding". text-embedding-3-large (3072 dimensioni) non è sempre superiore a text-embedding-3-small (1536 dimensioni). Il benchmark MTEB misura su corpus generici — se il tuo dominio è finanza, medicina o e-commerce, questi punteggi sono fuorvianti.

In produzione abbiamo visto che un modello domain-specific di 768 dimensioni (sentence-transformers/all-mpnet-base-v2 fine-tunato) ha reso il 12% di recall@10 migliore di un modello generico di 3072 dimensioni. Il motivo è semplice: lo spazio di embedding non conosce la terminologia del dominio. La distanza semantica tra "Conversion rate optimization" e "CRO" è 0.68 nel modello generico, 0.91 nel modello domain-tuned.

La scelta della dimensionalità comporta un trade-off netto: con 3072 dimensioni l'indice occupa 4.2GB, con 768 dimensioni 1.1GB. La latenza della query è rispettivamente di 47ms e 18ms (FAISS HNSW, m=16). Se la perdita di recall è inferiore al 5%, il modello più piccolo vince — sia in termini di costo che di velocità. Decidere senza misurare significa fare ingegneria su supposizioni.

### La Decisione del Fine-Tuning

Il fine-tuning dell'embedding diventa obbligatorio in due situazioni: (1) il vocabolario del dominio è molto specifico (termini medici, nomi di token in cripto), (2) la distribuzione delle coppie query-documento è asimmetrica (domanda breve, documento lungo). L'API di Embedding di OpenAI non accetta fine-tuning — devi usare sentence-transformers o Cohere embed-v3. Inizia con 500-1000 coppie etichettate — maggior volume produce guadagni marginali.

## Chunking: non è una Questione di Dimensione

Non esiste una regola secondo cui "una dimensione di chunk di 512 token è ottimale". Abbiamo testato 3 strategie diverse: (1) chunking fisso di 512 token, (2) chunking basato su intestazioni markdown (taglia ai confini H2/H3), (3) chunking semantico (leggi il contesto del paragrafo con un LLM, dividi nei punti di transizione semantica). Risultato: il chunking basato su markdown ha prodotto un NDCG@5 del 18% migliore, ma ha impiegato 2.3x più tempo per costruire l'indice.

Il problema del chunking fisso è che taglia a metà le frasi. La frase "Se integri il server-side tracking con l'architettura dei dati first-party, l'accuratezza dell'attribution aumenta..." viene divisa al token 510 — il secondo chunk inizia con "...l'accuratezza dell'attribution aumenta" e il contesto è perso. Il retriever trova questo chunk per la query "attribution", ma poiché manca il contesto, l'LLM non può generare una risposta. L'allucinazione inizia da qui.

Il chunking semantico (non il RecursiveCharacterTextSplitter di LangChain, ma un'interrogazione a gpt-4o-mini: "questo paragrafo passa a una nuova idea?") produce risultati migliori ma ha costi elevati: il chunking di una knowledge base di 10K pagine ha costato $47 (0.15$/1M token di input). Trade-off: la costruzione dell'indice è un costo una tantum, la qualità del retrieval genera valore continuo. Abbiamo scelto il chunking semantico, ma se aggiorni il set di documenti dinamicamente (ogni settimana), puoi tornare al chunking fisso.

| Strategia | Dimensione media chunk | NDCG@5 | Tempo build (10K doc) | Costo |
|---|---|---|---|---|
| Fisso 512 | 489 token | 0.71 | 4 min | $0 |
| Basato su markdown | 680 token | 0.84 | 9 min | $0 |
| Semantico (LLM) | 520 token | 0.81 | 22 min | $47 |

## Strategia di Overlap

Aggiungere overlap tra i chunk aumenta il recall del retrieval — ma gonfia la dimensione dell'indice di 1.4-1.8x. Con un overlap di 50 token abbiamo visto un aumento di recall del 6% (recall@10: 0.78 → 0.83). Puoi attivare l'overlap solo per documenti lunghi (>2000 token) e disattivarlo per contenuti brevi — una logica di overlap condizionale.

## Setup dell'Eval: da Metrica Offline a Test A/B Online

Costruire una pipeline di eval prima di mettere RAG in produzione è obbligatorio. "L'output dell'LLM sembra buono" non è sufficiente — la precisione/recall del retrieval e la fattualità dell'LLM devono essere misurate separatamente.

Misuriamo su due livelli:
1. **Livello di retrieval:** Precision@k, Recall@k, NDCG@k, MRR. La ground truth è costituita da coppie query-documento etichettate manualmente (nel nostro caso 320). La metrica `context_precision` di Ragas funziona senza LLM, è adatta a iterazioni veloci.
2. **Livello di generation:** Coerenza fattuale (entailment tra il documento e l'output), tasso di allucinazione (quante volte l'LLM esce dal documento), precisione della citazione (l'LLM cita correttamente le fonti). Per questi usiamo il pattern LLM-as-judge — chiediamo a gpt-4o "questa risposta si basa sul documento?", il tasso di accordo è 0.89 (rispetto all'eval umano).

L'eval offline gira automaticamente una volta al giorno (integrato nella pipeline CI/CD). Se stai testando una nuova strategia di chunking, un nuovo modello di embedding o un nuovo reranker, questi metriche devono essere verdi prima del commit. Il test A/B online è diverso: esponiamo il 10% del traffico alla nuova versione di RAG e monitoriamo il feedback degli utenti + le metriche di sessione (task completion, tasso di riformulazione della query). Se l'NDCG offline aumenta di 0.02 ma il task completion online non cambia, saltiamo il deploy.

### Affidabilità di LLM-as-Judge

Non fidarti ciecamente di LLM-as-judge. GPT-4o si è auto-segnalato come allucinato nel 6% dei casi (falso positivo) e ha mancato il 4% delle vere allucinazioni (falso negativo). La soluzione: per use case critici, human-in-the-loop eval — un campione casuale del 5% viene controllato da un umano, il punteggio di calibrazione dell'LLM-judge viene calcolato su questo subset. Se la calibrazione è <0.85, rivediamo il prompt del judge.

## Reranker: il Potere del Secondo Passaggio

Il primo retrieval restituisce 20-50 chunk (orientato al recall), il reranker li riduce a 3-5 (orientato alla precision). Con Cohere rerank-v3 abbiamo visto un aumento di precision del 14% (P@5: 0.68 → 0.78). Costo: $2 per 1M token di rerank (10x più caro dell'embedding), ma fornire al context window dell'LLM 5 chunk invece di 50 riduce sia il consumo di token che il rischio di allucinazione.

Il trade-off del reranker è la latenza: la ricerca embedding richiede 18ms, aggiungere il rerank porta a 95ms. Una pipeline asincrona rende tollerabile la differenza — quando l'utente invia la query, il retrieval + rerank funzionano in background, e quando l'LLM inizia a fare streaming della risposta il totale rimane tra 400-500ms. Se lo fai in modo sincrono, l'esperienza utente si degrada.

I sistemi RAG senza reranker si basano sull'assunto "i risultati top-k dell'embedding sono corretti". Questo vale solo se c'è un alto overlap lessicale tra la query e il chunk. Nelle query semantiche (esempio: "Come integro la raccolta dati lato server con l'architettura dei dati first-party?"), l'embedding restituisce 4 chunk non pertinenti nei primi 10. Il reranker usa l'attenzione incrociata query-documento e ripulisce questo rumore. In produzione, costruire RAG senza reranker è rischioso — l'accuratezza della citazione scende del 18%.

## Ricerca Ibrida: BM25 + Embedding

Il retrieval basato solo su embedding è debole in due scenari: (1) ricerche di corrispondenza esatta (nome del marchio, codice prodotto), (2) termini rari (parole che compaiono raramente nello spazio di embedding). BM25 (basato su parole chiave) colma questo gap. In Weaviate o Qdrant: ricerca ibrida con peso embedding 0.7 + peso BM25 0.3. Recall@10: embedding-only 0.76, ibrida 0.83.

L'indice BM25 è 5-8x più piccolo dell'indice di embedding (struttura ad indice invertito). Non aggiunge latenza (funziona in parallelo). L'unico costo della configurazione ibrida è la pianificazione della query — quale rapporto di peso è ottimale per quale tipo di query, lo trovi con un test A/B. Nel nostro caso, le query generali usano embedding 0.8, quelle che contengono menzioni di marchio/prodotto usano embedding 0.5.

## Monitoraggio in Produzione

Il 60% del deployment di RAG è il monitoraggio — prevenire il degrado silenzioso del sistema. Le metriche che monitoriamo:

- **Copertura del retrieval:** Percentuale di query per cui troviamo un documento (target >95%)
- **Rilevanza media del contesto:** Quale frazione dei chunk forniti all'LLM è realmente rilevante (target >0.8)
- **Tasso di allucinazione:** Frequenza con cui l'output dell'LLM esce dal documento (target <5%)
- **Latenza p95:** Tempo di completamento del 95% delle query (target <800ms)
- **Costo per query:** Embedding + rerank + LLM (target <$0.02)

Queste metriche vengono inviate a Datadog, gli alert vengono inviati a Slack se i threshold vengono superati. Se la copertura del retrieval scende sotto il 92% per 2 giorni consecutivi significa che c'è un gap nella knowledge base — il team di content viene coinvolto. Se il tasso di allucinazione aumenta, il prompt dell'LLM o la dimensione del chunk viene rivisto. Se la latenza aumenta, esaminiamo lo sharding del database vettoriale.

[Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/it/verianalizi) — collegare le metriche di RAG agli outcome di business è critico. Quando migliora la qualità del retrieval, migliora anche il punteggio di soddisfazione dell'utente nei sondaggi, oppure stiamo semplicemente gonfiando una metrica tecnica? Lo vediamo con l'analisi di correlazione.

## Equilibrio tra Costo e Qualità

Il costo mensile di RAG in produzione: 1M query, media 3 chunk recuperati, generazione con gpt-4o-mini ~$420 (embedding $80, rerank $40, LLM $300). Se rimuovi il reranker scende a $380 ma il tasso di allucinazione sale dal 5% all'11% — questo significa più ticket di supporto, costo indiretto $600+.

Il modo giusto per ridurre i costi: (1) livello di cache (se la stessa query arriva entro 24 ore, rispondi dalla cache, il 23% delle query è ripetuto), (2) modello di embedding più piccolo (768 dimensioni domain-tuned), (3) rerank asincrono (per query non critiche salta il rerank). Così si scende a $280, la perdita di qualità è <2%.

L'approccio sbagliato: sostituire l'embedding con la ricerca per parola chiave, l'LLM con template basati su regole. Questo produce un sistema che non puoi nemmeno chiamare "AI" — il retrieval precision precipita al 40%. L'ottimizzazione dei costi non deve sabotare la qualità del retrieval.

---

Portare RAG in produzione è più della scelta del modello — richiede disciplina in eval, monitoring e iterazione. Puoi ridurre la dimensione dell'embedding e guadagnare in latenza, ma se il recall scende, l'LLM allucinergà e perderai la fiducia dell'utente. Prima raggiungi un F1 di retrieval >0.85, poi guarda i costi. Altrimenti avrai costruito una macchina di allucinazioni economica.