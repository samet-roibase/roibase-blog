---
title: "Multi-Agent Orchestration: Da Singola Chiamata LLM ai Sistemi in Produzione"
description: "SDK per agent, topologie parallele/seriali: come costruire sistemi multi-agent production-grade con LangGraph, CrewAI, AutoGen."
publishedAt: 2026-07-20
modifiedAt: 2026-07-20
category: ai
i18nKey: ai-008-2026-07
tags: [multi-agent, llm-orchestration, langgraph, crewai, agent-topology]
readingTime: 9
author: Roibase
---

Nel 2023 gli LLM potevano "invocare strumenti". Nel 2024 il concetto di "agent" è decollato. Nel 2025 tutti hanno costruito il proprio agent. Nel 2026 la domanda è cambiata: un singolo agent non basta, ma 5 agent devo eseguirli in parallelo o in sequenza? Quale dovrebbe usare quale strumento? Dove dovrebbe risiedere la logica di coordinamento? L'orchestrazione multi-agent rappresenta il primo serio problema di ingegneria nel passaggio dalle applicazioni LLM ai sistemi in produzione.

## Da Singolo Agent alla Topologia: Perché l'Orchestrazione?

Un singolo agent — ad esempio Claude Sonnet 3.5 + 5 strumenti — risolve molti scenari di utilizzo. Ma quando affronti questi casi, riscontri limitazioni:

**Necessità di esecuzione parallela:** Stai analizzando una campagna di marketing. Contemporaneamente: estrai i dati da Google Ads API, calcola i trend storici in BigQuery, recupera i dati di conversione da Shopify. Un singolo agent esegue questi compiti in sequenza — totale 12 secondi. Con 3 agent in parallelo, termina in 4,5 secondi. Se la latenza è critica, l'orchestrazione è obbligatoria.

**Necessità di specializzazione:** Un agent scriva SQL, un altro pulisca i dati, un terzo generi codice di visualizzazione. Assegni a ogni agent un prompt di sistema diverso, un modello diverso (Sonnet per SQL, Opus per codice), un contesto di retrieval diverso. Se chiedi a un singolo agent "conosci sia SQL che design visuale", il context window si gonfia e le performance crollano.

**Livelli di sicurezza:** Un agent ripulisca il prompt in ingresso, uno esegua la logica aziendale, uno validi l'output. Questa struttura "assembly line" è critica in produzione: riduce il rischio di parametri errati nel tool use. L'orchestrazione è obbligatoria.

Nei progetti di [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/it/verianalizi) di Roibase, la struttura parallela multi-agent ha ridotto i tempi di query BigQuery del 60% — perché 3 sorgenti dati diverse possono essere interrogate simultaneamente.

## SDK per Agent: LangGraph, CrewAI, AutoGen

**LangGraph (ecosistema LangChain):** Definisci gli agent come nodi in una struttura grafica diretta. Ogni nodo mantiene uno "stato", i bordi determinano la logica di transizione. Il routing condizionale è possibile: se l'agent A dice "dati incompleti", vai all'agent B, se completi, vai a C.

```python
from langgraph.graph import StateGraph

workflow = StateGraph(AgentState)
workflow.add_node("researcher", research_agent)
workflow.add_node("writer", writer_agent)
workflow.add_conditional_edges(
    "researcher",
    lambda state: "complete" if state.data_ready else "retry"
)
workflow.set_entry_point("researcher")
```

**Vantaggi:** Gestione dello stato robusta. Il tracing distribuito è semplice — ogni nodo ha log separati. **Svantaggi:** La sintassi è complessa, le catene di callback rendono il debugging difficile.

**CrewAI:** Orchestrazione basata su ruoli. Assegni a ogni agent un "ruolo" (ricercatore, analista, scrittore), un elenco di "compiti". Il framework esegue automaticamente in sequenza o fa fork in parallelo.

```python
from crewai import Crew, Agent, Task

researcher = Agent(role='Data Researcher', tools=[bigquery_tool])
analyst = Agent(role='Analyst', tools=[pandas_tool])

crew = Crew(agents=[researcher, analyst], process="sequential")
result = crew.kickoff()
```

**Vantaggi:** Boilerplate minimo, prototipazione veloce. **Svantaggi:** Flessibilità limitata — per routing personalizzato devi modificare il codice.

**AutoGen (Microsoft):** Multi-agent conversazionale. Gli agent "conversano" tra loro, un agent invia un messaggio a un altro, questi risponde. In questo pattern, l'orchestrazione è implicita — il flusso di messaggi determina la topologia.

```python
from autogen import AssistantAgent, UserProxyAgent

assistant = AssistantAgent("assistant", llm_config={...})
user_proxy = UserProxyAgent("user", code_execution_config={...})

user_proxy.initiate_chat(assistant, message="Analyze Q1 data")
```

**Vantaggi:** Naturale per scenari human-in-the-loop. **Svantaggi:** I flussi non sono deterministici — è incerto quando l'agent A risponderà all'agent B.

## Topologia Seriale vs Parallela: Matrice di Trade-off

| Architettura | Latenza | Costo | Complessità | Caso d'Uso |
|--------------|---------|-------|-------------|-----------|
| **Seriale (Sequential)** | Alta (N×t) | Bassa (1 LLM per volta) | Bassa | Pipeline deterministiche (dati → analisi → rapporto) |
| **Parallela (Fork-Join)** | Bassa (max(t₁, t₂, t₃)) | Alta (N agent simultanei) | Media | Compiti indipendenti (interroga 3 API contemporaneamente) |
| **Condizionale (DAG)** | Variabile | Media | Alta | Flusso dinamico (se dati mancanti → X, altrimenti → Y) |
| **Conversazionale** | Indeterminata | Media | Alta | Human-in-the-loop o negoziazione |

**Decisione in produzione:** Se l'operazione non è nel critical path (ad esempio, generazione di rapporto offline), scegli topologia seriale — debugging facile, costo basso. Se hai SLA di latenza (ad esempio, dashboard in tempo reale), fai fork in parallelo — ma implementa da zero la logica di retry, altrimenti quando 1 agent timeout, gli altri 3 aspettano.

## Coordinamento del Tool Use: Prevenire Conflitti

Nel sistema multi-agent, il bug più frequente: 2 agent chiamano lo stesso strumento contemporaneamente con parametri diversi, uno corrompe lo stato dell'altro.

**Esempio:** L'agent A crea `temp_table_x` in BigQuery, l'agent B contemporaneamente tenta di leggerla — errore di dato assente. Questa "race condition" si risolve nel livello di orchestrazione:

**1. Resource locking:** Quando l'agent A comincia a usare uno strumento, l'orchestrator lo blocca agli altri agent. In LangGraph si fa con `shared_state`.

```python
if not state.lock_acquired("bigquery"):
    return {"status": "waiting"}
state.acquire_lock("bigquery")
result = bigquery_tool.run()
state.release_lock("bigquery")
```

**2. Isolamento dello spazio dei nomi:** Assegna a ogni agent uno spazio di lavoro separato. L'agent A usa `workspace_a/temp_table`, l'agent B `workspace_b/temp_table`. In CrewAI si fa con il prefisso `agent_id`.

**3. Progettazione idempotente degli strumenti:** Scrivi gli strumenti idempotenti da zero — se chiamati 2 volte con gli stessi parametri, niente conflitti. Ad esempio, usa `upsert` oppure `create_or_replace` anziché `insert`.

## Osservabilità: Come Tracciare l'Esecuzione Multi-Agent

In produzione con 5 agent in esecuzione, uno ha un errore, quale? Strumenti come LangSmith, Helicone, Arize raccolgono tracce a livello di agent, ma è necessaria l'instrumentazione manuale.

**Metriche critiche:**
- **Agent latency per step:** Quanto ha impiegato ogni agent? Nel fork parallelo, `max(latency)` identifica il collo di bottiglia.
- **Tool call success rate:** Quante volte ogni agent ha chiamato quale strumento, quante volte con successo? Sotto il 95% è un segnale di allarme.
- **Retry count:** Quante volte un agent ha fatto retry? Conteggio alto significa prompt errato o specifica dello strumento sbagliata.
- **State transition diagram:** Per LangGraph, da quale nodo a quale è avvenuta la transizione, quante volte? I loop infiniti si vedono qui.

```python
# Integrazione con LangSmith
from langsmith import Client

client = Client()
with client.trace(run_name="multi_agent_pipeline") as run:
    for agent in agents:
        with run.create_child(name=agent.name):
            agent.run()
```

## Gestione della Finestra di Contesto: Memoria Condivisa vs Isolata

Nel sistema multi-agent, la risorsa più critica è la finestra di contesto. Con 5 agent, condividono gli stessi 128K token, oppure ogni agente ne ha 128K separati?

**Memoria condivisa (LangGraph per impostazione predefinita):** Tutti gli agent leggono e scrivono nello stesso oggetto stato. Vantaggio: i risultati dell'agent A passano automaticamente all'agent B. Svantaggio: inquinamento del contesto — i dati non rilevanti per l'agent C gonfiamo la finestra.

**Memoria isolata + message passing:** Ogni agent mantiene il proprio stato, passa solo i dati necessari tramite messaggio. CrewAI segue questo pattern. Vantaggio: efficienza dei token elevata. Svantaggio: serializzazione manuale dei dati.

**Ibrida (consigliata):** Nello stato condiviso tieni solo metadati (quale agent ha fatto cosa, quando ha finito), scrivi i dati reali su disco/DB, passa agli agent un riferimento. Ad esempio, salva il risultato di BigQuery su GCS, dai agli agent il path `gs://bucket/result.parquet`.

## Gestione degli Errori: Cosa Accade Quando un Agent Cade?

In topologia seriale: l'agent 2 cade, pipeline si interrompe — semplice. In parallelo: l'agent B cade, ma gli agent A e C continuano — alla fine crei un rapporto con dati incompleti. Nel livello di orchestrazione è necessaria la logica "partial success".

**Strategie:**

1. **Fail-fast (seriale):** Il primo errore ferma l'intera pipeline. Se la latenza non importa, preferibile.
2. **Best-effort (parallela):** Esegui il maggior numero possibile di agent, crea output anche con dati mancanti — ma nel metadata aggiungi il flag "incomplete".
3. **Retry con fallback:** L'agent A ha tentato 3 volte senza successo, interroga l'agent A_backup (modello diverso oppure prompt diverso).

```python
# Retry in LangGraph
workflow.add_node("agent_a", agent_a, retry_policy={"max_attempts": 3})
workflow.add_edge("agent_a", "agent_a_backup", condition="failed")
```

## Checklist Produzione: Prima di Mettere in Produzione il Sistema Multi-Agent

- **Calcola il budget di token:** 5 agent × 10K token input × 2K output × prezzo API = costo per run. 1000 run al giorno = costo mensile?
- **Definisci SLA di latenza:** Quale agent deve impiegare quanto tempo? Se la latenza P95 supera 10 secondi, serve topologia parallela.
- **Piano di rollback:** Cambiare il prompt di un agent può rompere l'intera pipeline. Versionamento + deployment canary sono obbligatori.
- **Punto human-in-the-loop:** Per decisioni critiche (ad esempio, regolazione del budget), mostra l'output finale all'utente e richiedi approvazione.
- **Audit log:** Ogni step di ogni agent — quale strumento è stato invocato, con quali parametri, che cosa ha restituito — scritto come JSON su S3. Necessario per compliance.

L'orchestrazione multi-agent è la "lezione di sistemi" dell'ingegneria LLM. Dai una singola chiamata di modello in uno scenario iniziale, e in produzione richiedi topologia, gestione dello stato, logica di retry, osservabilità. LangGraph, CrewAI, AutoGen sono solo scheletri — il lavoro vero è decidere come disporre e parallelizzare gli agent per il tuo caso d'uso. Prendi il prototipo, misura la latenza, simula il costo, quindi scegli la topologia. Non mettere in produzione senza test — nei sistemi multi-agent tra "funziona" e "production-ready" ci sono 10 livelli.