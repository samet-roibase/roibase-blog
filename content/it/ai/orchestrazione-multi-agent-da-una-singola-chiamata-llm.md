---
title: "Orchestrazione Multi-Agent: Dai Sistemi in una Singola Chiamata LLM"
description: "Agent SDK, tool use e topologie parallele/seriali: come integrare gli LLM nei processi aziendali in produzione? Trade-off e architetture di orchestrazione."
publishedAt: 2026-07-02
modifiedAt: 2026-07-02
category: ai
i18nKey: ai-008-2026-07
tags: [multi-agent, llm-orchestration, agent-sdk, tool-use, ai-infrastructure]
readingTime: 9
author: Roibase
---

La fase dei proof-of-concept — dove una singola chiamata API a un LLM genera una risposta — si è conclusa nel 2023. Nel 2026, le aziende che portano gli LLM in produzione affrontano ciò che chiamiamo "orchestrazione di agenti": sistemi con più modelli, ognuno con accesso a tool differenti, in grado di operare in parallelo o in serie, osservabili e riproducibili. In questo articolo vedrai quali decisioni archittettoniche devi prendere, cosa promettono gli SDK dedicati e quali trade-off caratterizzano le topologie di orchestrazione.

## Cosa Promettono gli Agent SDK e Cosa Davvero Offrono

Framework come LangChain, CrewAI, Semantic Kernel e LlamaIndex vengono commercializzati come "agent SDK". Tutti condividono una promessa simile: autorizza l'LLM a usare tool, costruisci gerarchie decisionali, gestisci le catene di ragionamento. Ma in realtà, questi strumenti sono sufficienti?

Il primo problema è l'**overhead di astrazione**. Librerie ad alto livello come LangChain semplificano il binding dei tool, ma complicano il debugging. In produzione, quando una chiamata a un tool fallisce, devi capire se è l'internal state di LangChain che ha un problema oppure se è la risposta dell'API stessa. Paragonato a questo, il supporto nativo per tool come l'API Computer Use di Anthropic offre visibilità molto più diretta.

Il secondo problema è il **versioning**. Gli Agent SDK iterano rapidamente e introducono breaking change frequentemente. Ad esempio, il passaggio da LangChain 0.1 a 0.2 ha deprecato alcune strutture di chain. In produzione, sei costretto a usare versioni bloccate e aspettare patch, oppure implementare la logica di tool use direttamente nel codice, il che spesso è più sostenibile nel lungo termine — soprattutto se hai logica di business custom nel livello di orchestrazione.

Un vantaggio reale invece è l'**osservabilità integrata**. Strumenti come LangSmith o le suite di eval di LlamaIndex visualizzano l'intera catena di chiamate. Questo è critico per il debugging in produzione — quale agente ha chiamato quale tool, dove è nascosta la latenza, quanti token ha consumato ogni prompt. Se implementi l'orchestrazione da zero, devi costruire da solo questa telemetria. Gli SDK risparmiano tempo qui, ma introducono lock-in.

## Tool Use: Al di Là del Function Calling

Con "tool use" intendiamo il modo in cui un LLM genera output strutturati per fare richieste ad API esterne. OpenAI function calling, Anthropic tool use, Google function calling — implementano lo stesso principio con schemi leggermente diversi. Dove diventa interessante è quando i tool **hanno dipendenze tra loro**.

Esempio semplice: un agente per l'automazione di campagne email. Primo tool: `list_segments` (recupera l'elenco di segmenti dal CRM). Secondo tool: `get_segment_stats` (restituisce metriche per un segmento). Terzo tool: `create_campaign` (crea l'oggetto campagna). Devi eseguire questi tre tool in **serie** perché l'output di ciascuno alimenta il successivo.

Esempio complesso: un agente di analisi dati. Puoi eseguire `query_bigquery`, `fetch_gsc_data` e `fetch_ga4_events` in **parallelo** perché sono indipendenti tra loro. L'esecuzione parallela riduce la latenza in produzione, ma l'orchestrator deve gestire i limiti di concorrenza e di rate limit. L'SDK di Anthropic può fare chiamate parallele a tool, mentre il function calling di OpenAI è sequenziale (a partire dal Q2 2026). In questo caso, devi scrivere tu l'orchestrator.

Un trade-off critico nel tool use è **determinismo vs. flessibilità**. Se dici all'LLM "scegli uno di questi tre tool", potrebbe scegliere uno diverso a ogni esecuzione. Se hard-codifichi la sequenza di tool, perdi flessibilità ma guadagni riproducibilità. In produzione, il pattern più diffuso è **ibrido**: il percorso critico è hard-coded, le decisioni opzionali le lasci all'LLM.

### Esempio di Catena di Chiamate a Tool

```python
# Catena di tool seriale (ogni step fornisce input al successivo)
def orchestrate_campaign(prompt: str, client: AnthropicClient):
    # 1. Elenca segmenti
    segments = client.tool_use("list_segments", {})
    
    # 2. Recupera statistiche per ogni segmento (parallelo batch)
    stats_calls = [
        client.tool_use("get_segment_stats", {"segment_id": s})
        for s in segments["ids"]
    ]
    stats = asyncio.gather(*stats_calls)
    
    # 3. Crea campagna sul segmento con engagement più alto
    best_segment = max(stats, key=lambda x: x["engagement"])
    campaign = client.tool_use("create_campaign", {
        "segment_id": best_segment["id"],
        "message": prompt
    })
    return campaign
```

In questo esempio la struttura è `list_segments` → `get_segment_stats` (parallelo) → `create_campaign` (seriale). L'LLM interviene principalmente sulla generazione del messaggio finale — si tratta di un'architettura **semi-autonoma** dove la logica orchestrale gestisce le chiamate ai tool.

## Topologie di Agenti: Parallela vs. Seriale

Nei sistemi multi-agente esistono due topologie fondamentali: **parallela** (più agenti operano contemporaneamente, gli output vengono uniti) e **seriale** (ogni agente produce l'input per il successivo).

La topologia **parallela** viene usata solitamente per la **specializzazione**. Esempio: una pipeline di generazione di contenuti. L'agente A scrive il titolo, l'agente B genera i paragrafi del corpo, l'agente C ottimizza la meta descrizione SEO. Tutti e tre ricevono lo stesso brief come input, gli output vengono uniti. Il vantaggio è che ogni agente si specializza nel suo dominio, i prompt sono più brevi, il consumo di token è inferiore (il context window non viene condiviso). Lo svantaggio è l'overhead di coordinamento: la logica di merge è a tuo carico — se gli output sono incoerenti, occorre una riconciliazione manuale.

La topologia **seriale** si usa per il **perfezionamento** o la **validazione**. L'agente A produce una bozza, l'agente B verifica i fatti, l'agente C corregge il tono. Ogni agente riceve l'output del precedente. Il vantaggio è che ogni fase migliora la precedente, il ragionamento lineare è facile da debuggare. Lo svantaggio è la latenza: ogni agente nella sequenza deve aspettare il precedente. Il tempo totale è N × latenza media dell'agente.

In Roibase utilizziamo un modello ibrido nelle operazioni di marketing: nei processi di **[Geo-Ottimizzazione dei Motori Generativi](https://www.roibase.com.tr/it/geo)**, agenti paralleli raccolgono citazioni da diversi motori di ricerca (ChatGPT, Perplexity, Gemini), mentre una catena seriale di agenti matcher queste citazioni con pattern di menzione del brand. La parte parallela accelera la raccolta dati, la parte seriale fornisce profondità nell'analisi.

### Confronto tra Topologie

| Architettura | Latenza | Specializzazione | Debug | Caso d'uso |
|---|---|---|---|---|
| Parallela | Bassa (max tempo agente) | Alta | Logica merge complessa | Raccolta dati, analisi multi-fonte |
| Seriale | Alta (somma tempi agenti) | Bassa | Trace lineare | Perfezionamento, validazione, multi-step reasoning |
| Ibrida | Media | Alta | Complessa | Pipeline in produzione |

## State dell'Orchestrazione e Riproducibilità

Quando costruisci un sistema multi-agente, la decisione critica è: **dove memorizzi lo stato?** Hai tre opzioni.

**Orchestrazione senza stato:** Ogni agente è indipendente, l'orchestrator mantiene gli output intermedi in memoria. Il vantaggio è che il replay è semplice, lo scaling orizzontale è possibile. Lo svantaggio è la pressione sulla memoria — in una catena lunga memorizzerai GB di conversation history.

**Orchestrazione con stato:** Memorizzi lo stato intermedio in un store esterno (Redis, PostgreSQL). Il vantaggio è un uso della memoria inferiore, il recovery da crash è possibile. Lo svantaggio è l'overhead di I/O, occorre garantire la consistenza.

**Ibrida (checkpointing):** Persisti lo stato a certi milestone, ad esempio ogni 5 chiamate di agente. Se c'è un crash, riprendi dall'ultimo checkpoint. Il vantaggio è l'equilibrio tra performance e affidabilità. Lo svantaggio è l'implementazione complessa.

In produzione, uno schema comune è scrivere lo state dell'orchestrazione in un stream di log. Ogni chiamata di agente viene registrata come log strutturato in BigQuery, per il replay si usa l'event sourcing. In questo modo la catena di attribuzione diventa retrospettivamente analizzabile — quale output dell'agente ha influenzato quale metrica downstream?

## Eval e Osservabilità: Debug dell'Orchestrazione

Il debug di un sistema multi-agente è difficile perché i punti di fallimento sono numerosi. L'agente A ha scelto il tool sbagliato? L'agente B ha parsato l'input male? La logica di merge dell'orchestrator è buggy? Uno **stack di osservabilità** è indispensabile.

Le metriche di cui hai bisogno:
- **Latenza a livello di agente** (p50, p95, p99) — quale agente è il bottleneck?
- **Success rate dei tool** — quale API fallisce spesso?
- **Utilizzo di token per agente** — attribuzione dei costi
- **Punteggio di eval** — usa LLM-as-judge per assegnare score 0-1 a ogni output dell'agente

Un pattern per l'eval che usiamo: **scoring senza riferimento**. Un LLM supervisore (ad es. GPT-4) valuta ogni output dell'agente con punteggi di "task completion" e "hallucination". Questi punteggi vengono salvati come time-series, si rilevano regressioni. Se il punteggio di hallucination dell'agente A sale da 0.1 a 0.3, rollback della versione del prompt.

Un'altra tecnica suggerita da Anthropic: **Claude come valutatore**. Grazie al context window lungo, puoi dare l'intera catena di agenti a Claude in un singolo prompt: "C'è un errore logico in questa catena?" La meta-valutazione come questa si usa nel QA pre-produzione.

## Trade-off dell'Orchestrazione e Matrice Decisionale

Quando scegli l'architettura multi-agente, consideri questi trade-off:

**1. Complessità vs. controllo:** Usare un SDK accelera l'implementazione ma oscura il debugging. Scrivere un orchestrator custom ti dà controllo ma aumenta il maintenance.

**2. Latenza vs. specializzazione:** Agenti paralleli sono veloci ma introducono overhead di coordinamento. Agenti seriali fanno ragionamento più profondo ma sono lenti.

**3. Costo vs. qualità:** Ogni chiamata di agente consuma token. Aumentare il numero di agenti può migliorare la qualità ma il costo cresce linearmente. In produzione devi trovare il "minimum viable agent count".

**4. Determinismo vs. adattabilità:** Una sequenza hard-coded di tool è riproducibile ma non gestisce edge case. Affidare la scelta dei tool all'LLM è adattivo ma non deterministico.

La matrice decisionale che usiamo in Roibase:

| Caso d'uso | Topologia | SDK | State Management |
|---|---|---|---|
| Raccolta dati | Parallela | LlamaIndex | Stateless |
| Perfezionamento contenuti | Seriale | Custom | Checkpointing |
| Inference real-time | Ibrida | Anthropic SDK | Redis cache |
| Batch processing | Parallela | LangChain | PostgreSQL |

## Portare l'Orchestrazione in Produzione

Quando porti un sistema multi-agente in produzione, tre cose richiedono attenzione.

**Rate limiting:** Agenti paralleli superano i limiti di rate dell'API. Usa nel tuo orchestrator il pattern token bucket o semaphore. Se l'API di Anthropic ha limite di 50 req/min, throttle il numero di agenti paralleli di conseguenza.

**Fallback strategy:** Cosa fai se un agente fallisce? Il retry logic è semplice ma aggiungi exponential backoff + jitter. Se l'agente non è critico (ad es. un generatore opzionale di meta tag SEO), usa il circuit breaker e passa a una modalità fail-safe.

**Cost monitoring:** Registra il costo in token di ogni chiamata di agente. In produzione monitora la metrica $/request per agente. Se un agente causa uno spike di costo, ottimizza il prompt o disabilita l'agente.

La forza dell'orchestrazione multi-agente non è "fare più di un singolo LLM" — è **rendere i processi aziendali modulari, osservabili e scalabili**. Per sostenere questi sistemi in produzione, devi pensare insieme alla topologia dei tool, alla gestione dello stato e alla pipeline di eval. Costruendo queste architetture, la capacità di **[Analisi Dati & Data Engineering](https://www.roibase.com.tr/it/verianalizi)** è critica per collegare le metriche di orchestrazione alle metriche aziendali — devi misurare retrospettivamente quale configurazione di agente ha aumentato quale KPI downstream.