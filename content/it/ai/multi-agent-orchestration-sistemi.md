---
title: "Multi-Agent Orchestration: Da una singola chiamata LLM ai sistemi"
description: "Agent SDK, tool use e topologie parallele/seriali per trasformare gli LLM in sistemi production — tradeoff di latency, costo e affidabilità."
publishedAt: 2026-05-23
modifiedAt: 2026-05-23
category: ai
i18nKey: ai-008-2026-05
tags: [multi-agent, llm-orchestration, tool-use, agent-sdk, ai-engineering]
readingTime: 9
author: Roibase
---

Nel 2024, dire "assistente AI" significava un singolo ciclo prompt-response. Nel 2026, in production si vede qualcosa di diverso: mesh di agent paralleli, pipeline di orchestrazione seriali, agent collegati a sistemi esterni tramite tool use. Costruire un sistema di agent che si scambiano segnali al posto di una singola chiamata LLM riscrive l'equilibrio tra affidabilità e costi/latenza. L'orchestrazione multi-agent è il livello architetturale che trasforma l'LLM in una componente dell'infrastruttura production.

## Agent SDK e il Livello Tool Use

I framework di agent — LangGraph, Autogen, CrewAI — autorizzano l'LLM a "chiamare funzioni". Il tool use è il processo in cui il modello trasforma il proprio output in una chiamata di funzione conforme a uno schema JSON, e l'interprete esegue quella funzione inserendo il risultato di nuovo nel prompt. OpenAI function calling, l'API tool use di Anthropic Claude, la dichiarazione di funzioni di Google Gemini seguono lo stesso principio: l'LLM non può eseguire codice deterministico ma può dire quale funzione chiamare con quali parametri.

Gli SDK gestiscono questo ciclo: arriva una query utente, il modello dice "chiama l'API del meteo con city=Istanbul", l'orchestrator invoca l'API, aggiunge la risposta al prompt, il modello produce l'output finale. Questi 3 turnaround = 3× latency. In production, una catena di tool call può arrivare a 5-7 step, ognuno aggiunge 200-800ms, quindi il tempo di risposta totale è 1-5 secondi. In multi-agent l'obiettivo è spezzare questa latency tramite parallelizzazione e caching.

Esempio di definizione tool:

```python
tools = [
    {
        "name": "query_analytics",
        "description": "Estrai la metrica specificata da BigQuery",
        "parameters": {
            "metric": "string (revenue|sessions|conversions)",
            "date_range": "string (7d|30d|90d)"
        }
    }
]
```

Se il modello decide di usare questo tool, l'orchestrator invoca il client BigQuery, aggiunge il risultato al prompt, il modello fa la sintesi finale. La potenza del tool use: l'LLM può interrogare il mondo esterno senza rinunciare al determinismo.

## Topologie di Agent Parallele e Seriali

Un singolo agent = elaborazione seriale. Multi-agent = mix di parallelismo e seriale. Due pattern fondamentali: **scatter-gather** e **pipeline**.

**Scatter-gather:** L'orchestrator principale divide il compito in 3 sub-agent, ognuno lavora contemporaneamente con un tool diverso, i risultati si uniscono nell'agent centrale. Esempio: "Analizza le performance della campagna dell'ultimo mese" → agent_1 va all'API Google Ads, agent_2 all'API Meta Ads, agent_3 a BigQuery, tutti in parallelo. L'orchestrator riceve 3 response, le sintetizza, fornisce il report finale. Latency: max(agent_1, agent_2, agent_3) + latency di sintesi. Se fosse seriale sarebbe agent_1 + agent_2 + agent_3 + sintesi. Invece di 3×800ms diventa 800ms + 300ms = 1.1s.

**Pipeline:** L'output di agent_A è l'input di agent_B. Esempio: (1) query planner agent scrive SQL → (2) execution agent esegue SQL → (3) visualization agent genera la spec del grafico. Ogni fase dipende da quella precedente. La latenza è seriale ma **ogni agent è specializzato** — il query planner può essere un modello piccolo (GPT-4o-mini, 50ms), non richiede logica di esecuzione, l'agent di visualizzazione può usare Gemini Flash. Un grande modello unico vs 3 modelli piccoli = più economico + più veloce (in certi casi).

In Roibase utilizziamo l'orchestrazione multi-agent nei pipeline di attribuzione nel nostro servizio [First-Party Veri & Misurazione](https://www.roibase.com.tr/it/firstparty): un agent parsa l'evento grezzo, un agent lo lega alla sessione, un agent mappa i ricavi, l'agent finale calcola l'attribuzione cross-channel. Topologia pipeline = step deterministici, ognuno con il suo set di tool specializzato.

### Tradeoff Parallelo vs Seriale

| Topologia | Latency | Costo | Caso d'uso |
|----------|---------|-------|-----------|
| Parallelo (scatter-gather) | Basso (max tempo operazione) | Alto (N agent × chiamata LLM) | Query indipendenti (pull dati multi-source) |
| Seriale (pipeline) | Alto (tempo totale) | Medio (ogni agent può usare modello piccolo) | Operazione dipendente (parse → enrich → analyze) |
| Ibrido (parallelo → merge → seriale) | Medio | Medio-Alto | Compito complesso (raccolta dati parallela, risultato in pipeline) |

In production aggiungiamo un limite di concorrenza a scatter-gather per evitare rate limit (ad es: max 5 chiamate LLM parallele). Nel pipeline seriale usiamo cache intermedia — se l'output di agent_A rimane valido per 10 minuti, quando arriva la stessa query agent_B inizia direttamente dall'output in cache anziché rieseguire.

## La Responsabilità dell'Orchestrator: Routing e Error Handling

L'orchestrator non si limita a innescare gli agent, **decide quale agent prende quale compito**. In LangGraph si chiama "supervisor agent": categorizza la query in ingresso e fa il routing. Logica di esempio:

```python
def route_query(user_query: str) -> str:
    # Router basato su LLM (modello piccolo, veloce)
    classification = llm.classify(user_query, categories=["data_query", "content_gen", "code_review"])
    
    if classification == "data_query":
        return "analytics_agent"
    elif classification == "content_gen":
        return "writer_agent"
    else:
        return "code_agent"
```

L'agent router usa normalmente un modello veloce e economico come GPT-4o-mini o Claude Haiku. Aggiunge 50-100ms di overhead ma evita di usare un modello grande inutilmente. Se l'utente dice "riassumi le performance della campagna" va all'analytics_agent (tool use BigQuery), se dice "scrivi un articolo di blog" va al writer_agent (web search tool + LLM di scrittura).

**L'error handling è critico nel multi-agent.** Con un singolo agent se l'LLM allucinazione fai un retry. Nel multi-agent, se agent_2 lavora con l'output errato di agent_1 si ha un failure a cascata. L'orchestrator deve validare l'output di ogni agent:

```python
def validate_agent_output(output: dict, schema: dict) -> bool:
    # Validazione JSON schema
    if not matches_schema(output, schema):
        raise AgentOutputError("Output agent non conforme allo schema")
    
    # Controllo semantico (opzionale, costoso)
    if confidence_score(output) < 0.7:
        return False  # retry o fallback
    
    return True
```

Se agent_1 fallisce, l'orchestrator segue una catena di fallback: prima un retry (1×), poi un agent alternativo (modello più grande), infine human-in-the-loop. Senza questa logica in production il multi-agent non è affidabile.

## Latency e Costo: Scenari di Benchmark

Scenario di test: "Analizza il trend di ricavi degli ultimi 30 giorni, riassumi le performance della campagna, scrivi un email riassuntivo per il CEO" — 3 compiti indipendenti.

**Singolo agent (GPT-4, seriale):**
- Query BigQuery → 800ms (LLM + API)
- Query piattaforme pubblicitarie → 900ms
- Genera email → 600ms
- **Totale:** 2300ms
- **Costo:** 3 turni × $0.03/1K token = ~$0.09 (mix input/output standard)

**Multi-agent (scatter-gather + pipeline):**
- Agent_1, 2, 3 parallelo (BigQuery, ads, email prep) → max 900ms
- Orchestrator merge + sintesi → 400ms
- **Totale:** 1300ms
- **Costo:** 3 agent × $0.02 (modello piccolo) + sintesi $0.03 = ~$0.09 (uguale ma riducibile con ottimizzazione modello)

**Guadagno:** 43% di riduzione latency. Costo uguale ma con ottimizzazione modello (agent_1 → Gemini Flash, agent_2 → Claude Haiku, orchestrator → GPT-4o-mini) scende a $0.05.

**Però:** Multi-agent parallelo = consumo parallelo di rate limit. Se il tier OpenAI è 500 RPM, 10 agent paralleli = puoi servire 50 utenti in 5 minuti. Un singolo agent potrebbe servire 500 utenti. In production questo tradeoff si gestisce con queue + cache.

## Osservabilità e Debug

Nel sistema multi-agent rispondere a "dov'è andata male?" è difficile. Strumenti come LangSmith, Helicone, Arize Phoenix visualizzano la trace dell'agent: quale agent ha chiamato quale tool quando, con quale prompt, cosa ha restituito, dove ha fatto retry. Esempio di trace:

```
orchestrator → classify_query (50ms, GPT-4o-mini) → "data_query"
→ analytics_agent → query_bigquery (800ms, tool_call) → success
→ writer_agent → generate_summary (600ms, GPT-4) → success
→ orchestrator → merge_results (200ms) → final_output
```

Ogni step registra token count, latency, costo. In production senza questa telemetria il multi-agent è impossibile da debuggare. Se la tool call di agent A va in timeout lo vedi nella trace, aggiungi logica di retry.

Un'altra metrica: **agent utilization**. Se hai definito 5 agent ma l'80% delle query utente va verso un singolo agent, la logica di routing è rotta. Misuriamo l'accuracy di classificazione dell'orchestrator — creiamo un dataset etichettato da user feedback e fine-tuniamo l'agent router (o passiamo da few-shot prompt a un classifier leggero).

## Limiti del Multi-Agent

Il multi-agent non risolve tutto. C'è un **overhead di coordinamento**: passaggio messaggi tra agent, logica di orchestrazione, error handling — tutto aggiunge latency. Una query semplice che in singolo agent finisce in 1 secondo, nel multi-agent potrebbe volerci 1.5 secondi (orchestrator + routing + merge). La complessità architettonica aumenta — la codebase è più grande, i test sono più difficili, il deployment è più delicato.

Le situazioni dove il multi-agent ha senso:
- **Parallelizzazione necessaria:** Se devi tirare dati da 5 API diverse lo scatter-gather conviene
- **Modelli specializzati sono ottimali:** Query planning con modello piccolo, code generation con modello grande — la topologia pipeline riduce il costo
- **Compito long-running:** Agent_1 avvia il lavoro, agent_2 lo monitora in async, agent_3 lo termina, orchestrator notifica — architettura event-driven invece di sync LLM call

Per query brevi, frequenti e semplici un singolo agent + caching è migliore. Il multi-agent crea valore quando il compito complesso si decompone e si ottimizza.

---

L'orchestrazione multi-agent trasforma l'LLM da stateless function call a sistema stateful, osservabile e scalabile. La topologia parallela spezza la latency, la pipeline riduce il costo, l'orchestrator fornisce affidabilità. In production inizia con scatter-gather, monitora rate limit e costo, passa a pipeline se necessario. Registra la trace dell'agent, stratifica l'error handling, testa la logica di routing. Il multi-agent è il punto di transizione dall'LLM engineering all'infrastruttura LLM.