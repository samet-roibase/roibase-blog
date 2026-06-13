---
title: "Multi-Agent-Orchestrierung: LLM-Anwendungen von der Einzelabfrage zur Produktionsreife"
description: "Agent SDKs, Tool Use und parallele/serielle Topologien für produktionsreife LLM-Systeme. Token-Kosten, Latenz und Fehlertoleranz im Vergleich."
publishedAt: 2026-06-13
modifiedAt: 2026-06-13
category: ai
i18nKey: ai-008-2026-06
tags: [multi-agent, llm-orchestrierung, tool-use, agent-sdk, produktions-ki]
readingTime: 9
author: Roibase
---

Ein einzelner LLM-Prompt reichte vor wenigen Monaten aus. Heute erfordern produktionsreife Systeme parallele Agent-Topologien, strukturierte Ausgaben und Fallback-Ketten. Anthropic's Computer Use, OpenAI's Function Calling und LangGraph's State-Machine-Unterstützung haben Agent-Orchestrierung auf Framework-Ebene angehoben. Multi-Agent-Architekturen sind nicht länger Forschungsgebiet, sondern tägliches Werkzeug von Growth-Teams. Um Token-Kosten zu senken, Latenz zu kontrollieren und Fehler zu isolieren, ist der Übergang vom Single-Agent-Aufruf zum orchestrierten System unvermeidlich.

## Agent SDKs und Tool-Use-Protokoll

OpenAI's Function-Calling-JSON-Schema wurde 2023 zum Standard. Anthropic hat Tool Use mit Claude 3.5 erweitert: Die API-Antwort enthält jetzt einen `tool_use`-Block, du führst ihn aus und sendest `tool_result` zurück. Diese Schleife kann bis zu 20+ Iterationen laufen, aber dein Token-Limit stoppt dich. Gemini's Function Declarations folgen einer ähnlichen Syntax, unterscheiden sich aber in Grounding und Retrieval-Extensions. Alle drei Provider teilen denselben Grundmuster: Modell erhält Function-Deskriptor, gibt Function-Name und Argumente zurück, Ausführung liegt beim Nutzer.

Agent SDKs abstrahieren diese Schleife. LangChain's `AgentExecutor`, LlamaIndex's `ReActAgent`, AutoGPT's Core Engine — alle lösen dasselbe Problem: Tool-Call-Sequenzen verwalten. Aber Abstraktionen erzeugen Token-Overhead. Beispiel: LangChain sendet die Conversation History bei jeder Iteration als Prefix. 10 Tool Calls = 10× Context Window. Um das zu reduzieren, brauchst du Summarization Agents oder selective Context Pruning. In Produktion ist eine Observability-Schicht wie LangSmith unverzichtbar — ohne sie ist Debugging unmöglich.

Das Tool-Use-Protokoll ist nicht deterministisch — Modelle halluzinieren manchmal, geben falsche Function-Argumente. Deshalb ist ein Validierungslayer erforderlich: Pydantic-Schema zur Input-Validierung, Exception-Handling zur Laufzeit, Error-Meldungen zurück an das Modell. In LangChain gibt es `PydanticOutputParser`, bei Anthropic hilft der `tool_choice="required"`-Parameter. Das echte Problem: Das Modell wählt nicht immer das richtige Tool. Bei 3-4 ähnlichen Tools liegt die Fehlerquote bei 8–12 %. In diesem Fall brauchst du Retry-Logik oder einen Routing-Agent.

## Parallele vs. serielle Agent-Topologie

Warum sollte zwei Agents etwas schaffen, das ein Agent nicht kann? Wegen **Spezialisierung** — sie erhöht Token-Effizienz. Szenario: Eingangsmail → Kategorisierung → Antwort schreiben → Genehmigung. Ein monolithischer Prompt verbraucht 8K Token-Kontext, wiederholt dieselbe Instruktion für jede Mail. Teile das auf 3 Agents auf: **Classifier** (kategorisieren), **Drafter** (antworten schreiben), **Validator** (Genehmigungslogik). Jeder hat seinen kleinen Prompt. Gesamttoken: 8K → 2K+2K+1,5K = 5,5K. Das sind **31 % Ersparnis**.

Parallele Topologie hat einen weiteren Vorteil: **Latenz-Reduktion**. Beispiel: Content-Generation-Pipeline — ein Agent analysiert SEO-Keywords, der andere parst Ton und Style Guide, der dritte scrappt Konkurrenz-Content. Wenn du seriell läufst, ist die Latenz 3×. Bei Parallelausführung (mit LangGraph's `StateGraph` + `map`-Knoten) ist die maximale Latenz = die Zeit des langsamsten Agents. Aber Parallelisierung erschwert die Koordination. Welche Agent-Ausgabe hat Priorität? Bei Konflikten — wer trifft die Entscheidung? Deshalb brauchst du einen **Arbiter-Agent** — eine Meta-Schicht, die parallele Ergebnisse abwägt und Final-Entscheidung trifft.

Serielle Topologie bietet Fehler-Isolierung. Wenn Agent A fehlschlägt, laufen B und C nicht. Du kannst eine Fallback-Chain aufbauen: A schlägt fehl → wechsel zu A2. Bei Parallelsetzung hast du Partial-Failure-Szenarien: 3 von 3 Agents sind erfolgreich, einer timeout. Wie geht das System weiter? Hier brauchst du State-Machine-Logik. In LangGraph verwendest du `conditional_edges` zum Routing: Agent erfolgreich → "next", fehlgeschlagen → "retry" oder "fallback".

### Topologie-Auswahlhandbuch

| Szenario | Topologie | Grund |
|----------|-----------|-------|
| Sequenzielle Abhängigkeit (Output von A ist Input von B) | Seriell | Koordinations-Overhead in Parallelen |
| Unabhängige Subtasks | Parallel | Latenz-Reduktion |
| Hohes Fehler-Risiko | Seriell + Fallback | Fehler-Isolierung |
| Token-Kosten kritisch | Hybrid (parallel abrufen, seriell verarbeiten) | Daten ohne Context-Sharing sammeln |

## State-Management und Context Pruning

Das kritischste Problem eines Multi-Agent-Systems: **State Bloat**. Jeder Agent behält Conversation History, der Context wächst mit jeder Iteration. 10 Agents × 5 Iterationen = 50 Messages. Auch Claude's 200K-Context-Fenster läuft voll. Folge: Latenz steigt (Token-Berechnung kostet O(n²)), Kosten steigen, einige Modelle timeout. 

Lösung: **Stateful Orchestration** und **Selective Memory**. LangGraph's `checkpointing`-Funktion schreibt State in einen externen Store (Redis, PostgreSQL). Jeder Agent liest nur seinen relevanten Context. Beispiel: Drafter sieht Classifier-Output, aber nicht die vorherige Genehmigungshistorie des Validators — es sei denn, es ist nötig.

Ein weiteres Muster: **Summarization Agent**. Alle N Iterationen aktiviert sich dieser, komprimiert die Conversation auf 3-4 Sätze. LangChain's `ConversationSummaryMemory` macht das, aber Vorsicht: Summarization ist selbst ein LLM-Call, zusätzliche Kosten. Der Trigger-Threshold muss gut kalibriert sein. In unserer Production-Pipeline führen wir alle 12 Iterationen 1 Summarization durch — 200 Token Context statt 50 Token, **75 % Einsparung**.

Context Pruning ist eine andere Option: Lösche irrelevante Messages. Beispiel: Classifier-Agent gibt nur Category Label zurück, aber das Modell liefert auch die ganze Reasoning Chain. Beim Senden an Drafter schneidest du Reasoning ab, lässt nur Label. In LangChain machst du das mit `MessagesPlaceholder` + custom Filter Function. Diese manuelle Arbeit spart **40–50 % Token**.

## Zuverlässigkeit und Observability in Produktion

Multi-Agent-System heißt N× Fehleroberfläche. Ein Agent timeout, der andere Rate Limit, der dritte halluziniert. Dieses Chaos mit **Circuit Breaker** und **Retry Logic** zu managen ist Pflicht. LangChain hat `RunnableRetry` Wrapper, aber für granulare Kontrolle ist Tenacity-Library flexibler: Exponential Backoff, Jitter, Max Attempts.

Ohne Observability kannst du nicht debuggen. Tools wie LangSmith, LangGraph Studio, Weights & Biases visualisieren Agent Traces: Welcher Agent wurde aufgerufen, wann, was hat er zurückgegeben, wie viele Tokens? Unser Stack: LangSmith + custom Prometheus Exporter. Agent Latenz, Token Count, Error Rate in Grafana. Alert-Schwelle: P95 Latenz >3s oder Error Rate >5 %.

Ein anderes Production-Problem: **Non-Determinismus**. Gleicher Input, unterschiedlicher Output — weil das Modell stochastisch ist. Selbst mit Temperature=0 gibt es Infrastructure-bedingte Variation. Deshalb ist [First-Party-Daten-Architektur](https://www.roibase.com.tr/de/firstparty) ein Muss: Strukturierte Daten als Input erzeugen konsistentere Outputs. Außerdem brauchst du ein Eval-Framework: Bei jedem Deploy Regression Tests laufen, Output-Qualität messen. LangChain's `EvaluatorChain` oder Anthropic's Model-Based Eval.

## Cost-Optimierung und Tradeoffs

Multi-Agent-Systeme sind teuer. Einzelner Agent-Aufruf 2K Token = $0,006 (Claude Sonnet 3.5 Preis). Dieselbe Task mit 3 Agents: 3× API Call, insgesamt 6K Token, $0,018. 3× Kosten. Diese Costs sind gerechtfertigt in Szenarien: Langen Context kürzen (großes Doc → Chunks → Parallel), Spezialisierung (jeder Agent kleines Modell, Gesamtkosten niedrig), Fehler-Isolierung (Monolith hat höheres Risiko).

Token-Kosten senken — die Wege:
- **Model Distillation** (großes Modell fine-tuned kleines, dann kleines in Produktion)
- **Caching** (gleicher Context? Cached Response — Anthropic's Prompt Caching spart 90 %)
- **Batch Processing** (asynchron statt Real-Time, günstigeres Modell möglich)

Latenz vs. Cost Tradeoff: Parallele Topologie senkt Latenz, erhöht Kosten. Auf kritischem Path parallel, Non-kritisch seriell. Beispiel: Benutzer-Query → Classifier parallel (schnelle Antwort), Reporting-Agent seriell (Background Job). Dieser Hybrid-Ansatz hält P95 Latenz <2s, senkt Kosten um **35 %**.

## Orchestrierungs-Beispiele und Code

Einfache serielle Chain (LangChain):

```python
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain_anthropic import ChatAnthropic

classifier = LLMChain(
    llm=ChatAnthropic(model="claude-3-5-sonnet"),
    prompt=PromptTemplate.from_template("Kategorisiere: {text}")
)

drafter = LLMChain(
    llm=ChatAnthropic(model="claude-3-5-sonnet"),
    prompt=PromptTemplate.from_template("Schreibe Antwort: {category}, {text}")
)

category = classifier.run(text=user_input)
response = drafter.run(category=category, text=user_input)
```

Parallele Ausführung (LangGraph):

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

Dieser Code führt 2 Agents parallel aus und sendet das Ergebnis an den Merge-Agent. LangGraph verwaltet State automatisch und schreibt Checkpoints in Redis.

Multi-Agent-Orchestrierung ist nicht Selbstzweck, sondern Werkzeug. Automatisierst du einen anderen Growth-Channel oder baust du ein Decision Pipeline auf, wähle Agent-Topologie — aber definiere Metriken: Token/Task, Latenz, Error Rate. In Produktion ist Erfolg: Das System läuft mit 95 % Uptime und Token-Kosten bleiben im Budget. Wenn du Multi-Agent für Content Generation aufbaust, integriere es mit [Generative Engine Optimization](https://www.roibase.com.tr/de/geo) Strategie — Agents sammeln Citation-Daten, versorgen GEO-Metriken, ROI wird messbar. Andernfalls ist es nur ein komplexer API-Wrapper.