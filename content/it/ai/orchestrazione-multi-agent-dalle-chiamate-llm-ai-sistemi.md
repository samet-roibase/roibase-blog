---
title: "Orchestrazione Multi-Agent: Dai Sistemi Singoli alle Topologie Distribuite"
description: "Agent SDK, tool use e topologie parallele/seriali per portare applicazioni LLM in produzione. Tradeoff tra costo token, latenza e isolamento degli errori."
publishedAt: 2026-06-13
modifiedAt: 2026-06-13
category: ai
i18nKey: ai-008-2026-06
tags: [multi-agent, orchestrazione-llm, tool-use, agent-sdk, produzione-ai]
readingTime: 9
author: Roibase
---

Una singola richiesta LLM era sufficiente pochi mesi fa. Oggi i sistemi in produzione richiedono topologie di agent paralleli, output strutturati e catene di fallback. Il tool use di Anthropic, il function calling di OpenAI e il supporto delle state machine di LangGraph hanno portato l'orchestrazione di agent al livello del framework. L'architettura multi-agent non è più solo ricerca, ma strumenti quotidiani per i team di crescita. Ridurre il costo dei token, controllare la latenza e isolare gli errori richiede di passare da una singola chiamata di agent a un sistema orchestrato.

## Agent SDK e Protocollo Tool Use

Il JSON schema di function calling di OpenAI è diventato standard nel 2023. Anthropic ha ampliato il tool use con Claude 3.5: la risposta API restituisce ora un blocco `tool_use`, tu lo esegui e rinvii il risultato come `tool_result`. Questo ciclo può continuare per oltre 20 iterazioni, ma il limite di token ti ferma. La sintassi delle function declarations di Gemini è simile, la differenza è nel grounding e nelle estensioni di retrieval. I tre provider condividono lo stesso pattern: il modello riceve il descrittore della funzione, restituisce il nome della funzione + argomenti, e l'esecuzione è a carico dell'utente.

Gli Agent SDK astraggono questo ciclo. `AgentExecutor` di LangChain, `ReActAgent` di LlamaIndex, il core engine di AutoGPT: tutti risolvono lo stesso problema, gestire la sequenza di tool call. Ma le astrazioni creano overhead di token. Ad esempio, LangChain invia la conversation history come prefisso ad ogni iterazione. 10 tool call = 10× context window. Per ridurre questo problema serve uno summarization agent o un selective context pruning. In produzione, senza un livello di osservabilità come LangSmith, il debug è impossibile.

Il protocollo tool use non è deterministico: il modello a volte allucinava, fornisce argomenti di funzione errati. Ecco perché è obbligatorio uno strato di validazione: valida gli input con lo schema Pydantic, cattura le eccezioni a runtime, restituisci un messaggio di errore al modello. In LangChain c'è `PydanticOutputParser`, in Anthropic il parametro `tool_choice="required"` riduce questo rischio. Ma il vero problema è questo: il modello non sempre seleziona lo strumento corretto. Con 3-4 tool simili, la selezione errata avviene dal'8% al 12% dei casi. In questi casi aggiungi una retry logic o un routing agent.

## Topologie Agent Parallele vs Seriali

Perché un singolo agent non dovrebbe fare ciò che due agent potrebbero? Perché la **specializzazione** migliora l'efficienza dei token. Scenario di esempio: inbox email in arrivo → categorizza → scrivi risposta → approva. Un prompt monolitico utilizza 8K token di contesto, ripete le stesse istruzioni per ogni email. Dividi questo in 3 agent: **classifier** (categorizza), **drafter** (scrivi risposta), **validator** (logica di approvazione). Ognuno ha il suo prompt ridotto. Token totali: 8K → 2K+2K+1.5K = 5.5K. Riduzione del 31%.

La topologia parallela offre un altro vantaggio: **riduzione della latenza**. Esempio: pipeline di content generation — un agent analizza le parole chiave SEO, un altro analizza il tono e la style guide, un terzo scrape il contenuto dei competitor. Se lo esegui in serie, otterrai 3× latenza. Se lo esegui in parallelo (con `StateGraph` di LangGraph + nodo `map`) la latenza massima = il tempo dell'agent più lento. Tuttavia il coordinamento in parallelo diventa più difficile. L'output di quale agent ha priorità? Se c'è conflitto chi decide? Per questo serve un **arbiter agent**, un meta-layer che accetta i risultati paralleli e prende la decisione finale.

La topologia seriale fornisce isolamento degli errori. Se l'Agent A fallisce, B e C non vengono eseguiti. Puoi configurare una catena di fallback: se A fallisce, passa a A2. In parallelo hai scenari di errore parziale: 2 agent su 3 hanno successo, uno scade. Come procede il sistema? In questo caso serve una logica state machine. In LangGraph usi `conditional_edges` per il routing: se l'agent ha successo vai a "next", se fallisce vai a "retry" o "fallback".

### Guida di Selezione della Topologia

| Scenario | Topologia | Motivo |
|----------|-----------|--------|
| Dipendenza sequenziale (l'output di A è l'input di B) | Seriale | Overhead di coordinamento in parallelo |
| Sottotask indipendenti | Parallelo | Riduzione della latenza |
| Alto rischio di errore | Seriale + fallback | Isolamento degli errori |
| Costo token critico | Ibrido (fetch parallelo, process seriale) | Raccolta dati senza condividere contesto |

## State Management e Context Pruning

Il problema più critico dei sistemi multi-agent: **state bloat**. Ogni agent mantiene la conversation history, il contesto della finestra si allarga ad ogni iterazione. 10 agent × 5 iterazioni = 50 messaggi. Anche il context window di 200K di Claude potrebbe riempirsi. Il risultato: latenza crescente (il costo di calcolo dei token è O(n²)), costo crescente, alcuni modelli danno timeout.

La soluzione: **orchestrazione stateful** e **memoria selettiva**. La funzionalità `checkpointing` di LangGraph scrive lo stato in un external store (Redis, PostgreSQL). Ogni agent legge solo il contesto a lui rilevante. Esempio: l'agent drafter vede l'output del classifier, ma non la cronologia approvazioni precedenti del validator, a meno che non sia necessario.

Un altro pattern: **summarization agent**. Entra in gioco ogni N iterazioni, riduce la conversation a 3-4 frasi. `ConversationSummaryMemory` di LangChain fa questo lavoro ma attenzione: il summarization stesso richiede una chiamata LLM, costo aggiuntivo. Per questo il trigger threshold deve essere ben calibrato. Nella nostra pipeline di produzione eseguiamo 1 summarization ogni 12 iterazioni — mantiene 50 token di contesto invece di 200, risparmio del 75%.

Il context pruning è un'altra opzione: cancella i messaggi irrilevanti. Esempio: l'output dell'agent classifier è solo l'etichetta della categoria, ma il modello restituisce anche l'intera catena di reasoning. Quando lo invii al drafter, tagli il reasoning e lasci solo l'etichetta. In LangChain fai questo con `MessagesPlaceholder` + una funzione di filtro personalizzata. È un lavoro manuale, ma riduce i token del 40-50%.

## Affidabilità e Osservabilità in Produzione

Multi-agent significa N× superficie di errori. Un agent scade, un altro raggiunge il rate limit, un terzo allucinea. Per gestire questo caos servono **circuit breaker** e **retry logic**. LangChain ha `RunnableRetry` wrapper, ma se vuoi un controllo granulare la libreria Tenacity è più flessibile: backoff esponenziale, jitter, max attempt.

Senza osservabilità non puoi fare debug. Tool come LangSmith, LangGraph Studio, Weights & Biases visualizzano la traccia dell'agent: quale agent è stato chiamato quando, cosa ha restituito, quanti token ha speso. Nel nostro stack usiamo LangSmith + un custom exporter Prometheus: latenza dell'agent, conteggio dei token, metriche di error rate in Grafana. Threshold di allerta: latenza P95 >3s o error rate >5%.

Un altro problema di produzione: **non-determinismo**. Lo stesso input può produrre output diversi, perché il modello è stocastico. Anche con temperature=0, c'è variazione dipendente dall'infrastruttura del provider. Per questo una [architettura di dati first-party](https://www.roibase.com.tr/it/firstparty) affidabile è obbligatoria: se l'input è strutturato, l'output è più coerente. Inoltre serve un eval framework: esegui regression test ad ogni deploy, misura la qualità dell'output. Puoi usare `EvaluatorChain` di LangChain o il model-based eval di Anthropic.

## Ottimizzazione dei Costi e Tradeoff

Il sistema multi-agent è costoso. Una singola chiamata di agent è 2K token = $0.006 (con i prezzi di Claude Sonnet 3.5). Eseguire lo stesso task con 3 agent: 3× API call, totale 6K token, $0.018. 3× costo. Gli scenari che giustificano questo: accorciare il contesto lungo (doc grande → chunk → process parallelo), specializzazione (ogni agent usa un modello piccolo, totale economico), isolamento degli errori (il monolite ha alto rischio di fallimento).

I modi per ridurre il costo dei token: **model distillation** (il modello grande fine-tune il modello piccolo, poi il modello piccolo va in produzione), **caching** (se lo stesso contesto arriva di nuovo, restituisci la risposta cachata — il prompt caching di Anthropic offre uno sconto del 90%), **batch processing** (elabora in async invece che real-time, preferisci il modello economico).

Il tradeoff latenza vs costo: la topologia parallela riduce la latenza ma aumenta il costo. Puoi fare parallelo nel critical path, seriale nel non-critico. Esempio: query utente → classifier parallelo (risposta veloce), ma reporting agent seriale (background job). Questo approccio ibrido mantiene la latenza P95 <2s riducendo il costo del 35%.

## Esempi di Orchestrazione e Codice

Catena seriale semplice (LangChain):

```python
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain_anthropic import ChatAnthropic

classifier = LLMChain(
    llm=ChatAnthropic(model="claude-3-5-sonnet"),
    prompt=PromptTemplate.from_template("Categorizza: {text}")
)

drafter = LLMChain(
    llm=ChatAnthropic(model="claude-3-5-sonnet"),
    prompt=PromptTemplate.from_template("Scrivi risposta: {category}, {text}")
)

category = classifier.run(text=user_input)
response = drafter.run(category=category, text=user_input)
```

Esecuzione parallela (LangGraph):

```python
from langgraph.graph import StateGraph

def parallel_tasks(state):
    seo_result = seo_agent.invoke(state["content"])
    tone_result = tone_agent.invoke(state["style_guide"])
    return {"seo": seo_result, "tone": tone_result}

workflow = StateGraph()
workflow.add_node("parallel", parallel_tasks)
workflow.add_node("merge", merge_agent)
workflow.set_entry_point("parallel")
workflow.add_edge("parallel", "merge")
app = workflow.compile()
```

Questo codice esegue 2 agent in parallelo e passa il risultato all'agent di merge. LangGraph gestisce automaticamente lo stato, scrive i checkpoint su Redis.

L'orchestrazione multi-agent non è un fine in sé, è uno strumento. Se stai automatizzando un altro canale di crescita o costruendo una decision pipeline, seleziona una topologia di agent, ma definisci chiaramente le metriche: token/task, latenza, error rate. Il successo in produzione si misura con il 95% di uptime del sistema e il costo dei token entro budget. Se costruisci un sistema multi-agent per la content generation, integralo con la strategia di [Generative Engine Optimization](https://www.roibase.com.tr/it/geo) — gli agent raccolgono dati di citazione, alimentano le metriche GEO, il ROI diventa misurabile. Altrimenti è solo un wrapper API complicato.