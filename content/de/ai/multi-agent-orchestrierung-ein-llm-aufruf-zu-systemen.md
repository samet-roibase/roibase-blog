---
title: "Multi-Agent-Orchestrierung: Vom Single-LLM-Call zu Produktionssystemen"
description: "Agent-SDKs bis zu parallelen/seriellen Topologien: Production-grade Multi-Agent-Systeme mit LangGraph, CrewAI und AutoGen aufbauen."
publishedAt: 2026-07-20
modifiedAt: 2026-07-20
category: ai
i18nKey: ai-008-2026-07
tags: [multi-agent, llm-orchestration, langgraph, crewai, agent-topology]
readingTime: 9
author: Roibase
---

2023: LLMs konnten "Tools aufrufen". 2024: Das Konzept "Agent" entstand. 2025: Jeder baute seinen eigenen Agenten. 2026: Die Frage hat sich verschärft – ein Agent genügt nicht mehr, aber sollten 5 Agenten parallel oder seriell laufen? Welcher Agent nutzt welches Tool? Wo lebt die Koordinationslogik? Multi-Agent-Orchestrierung ist das erste ernsthafte Engineering-Problem beim Übergang von LLM-Spielplatz zu Produktionssystemen.

## Von Single Agent zur Topologie: Warum Orchestrierung?

Ein einzelner Agent – etwa Claude Sonnet 3.5 mit 5 Tools – löst viele Szenarien. Doch bei diesen Situationen gerätst Du ins Stocken:

**Parallelisierungsbedarf:** Du analysierst eine Marketing-Kampagne. Gleichzeitig: Google Ads API abfragen, Historical Trends in BigQuery berechnen, Conversion-Daten von Shopify holen. Ein Agent macht das sequenziell – insgesamt 12 Sekunden. Drei parallel arbeitende Agenten schaffen es in 4,5 Sekunden. Wenn Latenz kritisch ist, ist Orchestrierung Pflicht.

**Spezialisierungsbedarf:** Ein Agent schreibt SQL, einer räumt Daten auf, einer generiert Visualisierungs-Code. Jedem Agent gibst Du ein anderes System Prompt, ein anderes Modell (SQL: Sonnet, Code: Opus), einen anderen Retrieval-Kontext. Einem Single Agent zu sagen "beherrsche SQL UND visuelles Design" bläht das Context Window auf, Performance sinkt.

**Sicherheitslagen:** Ein Agent bereinigt eingehende Prompts, einer führt die Geschäftslogik aus, einer validiert den Output. Diese "Assembly Line"-Struktur ist in Production unverzichtbar: Multi-Agent-Topologien reduzieren das Risiko fehlerhafter Parameter bei Tool-Nutzung drastisch.

Bei Roibase's [Datenanalyse & Insights-Engineering](https://www.roibase.com.tr/de/verianalizi)-Projekten haben wir BigQuery-Query-Zeiten mit parallelen Agent-Strukturen um 60% gesenkt – weil 3 verschiedene Datenquellen gleichzeitig abgefragt werden können.

## Agent-SDKs: LangGraph, CrewAI, AutoGen

**LangGraph (LangChain-Ökosystem):** Du definierst Agenten als Knoten in einem Directed Graph. Jeder Knoten verwaltet einen "State", Kanten definieren Überganslogik. Conditional Routing ist möglich: Falls Agent A "Daten unvollständig" meldet → Agent B aufrufen, sonst → Agent C.

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

**Stärken:** Robustes State Management. Distributed Tracing ist einfach – jeder Knoten hat separate Logs. **Schwächen:** Syntax ist komplex, Callback-Ketten machen Debugging mühsam.

**CrewAI:** Role-basierte Orchestrierung. Du gibst jedem Agenten eine "Role" (Researcher, Analyst, Writer) und eine Task-Liste. Das Framework führt diese sequenziell aus oder forked parallel.

```python
from crewai import Crew, Agent, Task

researcher = Agent(role='Data Researcher', tools=[bigquery_tool])
analyst = Agent(role='Analyst', tools=[pandas_tool])

crew = Crew(agents=[researcher, analyst], process="sequential")
result = crew.kickoff()
```

**Stärken:** Minimales Boilerplate, schnelle Prototypen. **Schwächen:** Begrenzte Flexibilität – für Custom Routing musst Du Code ändern.

**AutoGen (Microsoft):** Conversational Multi-Agent. Agenten "sprechen" miteinander, senden sich Nachrichten, antworten. In diesem Pattern ist Orchestrierung implizit – der Nachrichtenfluss definiert die Topologie.

```python
from autogen import AssistantAgent, UserProxyAgent

assistant = AssistantAgent("assistant", llm_config={...})
user_proxy = UserProxyAgent("user", code_execution_config={...})

user_proxy.initiate_chat(assistant, message="Analyze Q1 data")
```

**Stärken:** Natürlich für Human-in-the-Loop-Szenarien. **Schwächen:** Akzeptanzflow ist nicht-deterministisch – wann Agent A Agent B antwortet, ist unklar.

## Parallele vs. Serielle Topologie: Trade-off Matrix

| Architektur | Latenz | Kosten | Komplexität | Einsatz |
|--------|---------|---------|------------|----------|
| **Seriell (Sequential)** | Hoch (N×t) | Niedrig (1 LLM pro Durchlauf) | Niedrig | Deterministische Pipelines (Daten → Analyse → Report) |
| **Parallel (Fork-Join)** | Niedrig (max(t₁, t₂, t₃)) | Hoch (N Agenten gleichzeitig) | Mittel | Unabhängige Aufgaben (3 APIs gleichzeitig abfragen) |
| **Conditional (DAG)** | Variabel | Mittel | Hoch | Dynamische Abläufe (Daten fehlend → X, OK → Y) |
| **Conversational** | Unvorhersehbar | Mittel | Hoch | Human-in-the-Loop oder Verhandlungen |

**Production-Entscheidung:** Falls die Verarbeitung nicht im kritischen Pfad liegt (z.B. Offline-Report-Generierung), wähle serielle Topologie – Debugging ist einfacher, Kosten niedrig. Falls es ein Latenz-SLA gibt (z.B. Real-time Dashboard), parallelisiere – aber implementiere Retry-Logik von Anfang an, sonst blockiert ein timeout-Fehler alle 3 Agenten.

## Tool-Use-Koordination: Race Conditions vermeiden

Im Multi-Agent-System ist der häufigste Bug: Zwei Agenten rufen dasselbe Tool mit unterschiedlichen Parametern gleichzeitig auf, einer zerstört den State des anderen.

**Beispiel:** Agent A erstellt `temp_table_x` in BigQuery, Agent B versucht gleichzeitig `temp_table_x` zu lesen – "Tabelle existiert nicht"-Fehler. Dieser Race Condition wird auf der Orchestrierungs-Ebene gelöst:

**1. Resource Locking:** Wenn Agent A ein Tool nutzt, sperrt der Orchestrator das Tool für andere Agenten. In LangGraph mit `shared_state`:

```python
if not state.lock_acquired("bigquery"):
    return {"status": "waiting"}
state.acquire_lock("bigquery")
result = bigquery_tool.run()
state.release_lock("bigquery")
```

**2. Namespace Isolation:** Gib jedem Agenten einen separaten Workspace. Agent A nutzt `workspace_a/temp_table`, Agent B `workspace_b/temp_table`. In CrewAI über `agent_id`-Präfixe.

**3. Idempotente Tool-Design:** Schreib Tools von Anfang an idempotent – zweimal mit denselben Parametern aufgerufen, ohne Konflikt. Nutze `upsert` oder `create_or_replace` statt `insert`.

## Observability: Agent-Traces verstehen

In Production laufen 5 Agenten, einer gibt einen Fehler aus – welcher? Tools wie LangSmith, Helicone, Arize sammeln Agent-Level-Traces, aber manuelle Instrumentierung ist unverzichtlich.

**Kritische Metriken:**
- **Agent Latenz pro Schritt:** Welcher Agent brauchte wie lange? In parallelen Forks zeigt der `max(latency)` den Bottleneck.
- **Tool-Call Success Rate:** Wie oft hat jeder Agent welches Tool aufgerufen? Erfolgsquote unter 95% ist Warnsignal.
- **Retry Count:** Wie oft hat sich ein Agent selbst wiederholt? Häufige Retries deuten auf fehlerhafte Prompts oder falsche Tool-Spezifikationen hin.
- **State Transition Diagram:** Bei LangGraph: Von welchem Knoten zu welchem wurde wie oft gewechselt? Unendliche Schleifen sind hier sichtbar.

```python
# LangSmith Integration
from langsmith import Client

client = Client()
with client.trace(run_name="multi_agent_pipeline") as run:
    for agent in agents:
        with run.create_child(name=agent.name):
            agent.run()
```

## Context Window Management: Shared Memory vs. Isolated

Im Multi-Agent-System ist Context Window die kritischste Ressource. Wenn 5 Agenten existieren – teilen sie sich das gleiche 128K Token-Fenster, oder kriegt jeder 128K?

**Shared Memory (LangGraph-Default):** Alle Agenten lesen und schreiben auf das gleiche State-Objekt. Vorteil: Agent A's Ergebnisse fließen automatisch in Agent B. Nachteil: Context-Verschmutzung – Agent C benötigt Daten gar nicht, aber sie füllen das Fenster.

**Isolated Memory + Message Passing:** Jeder Agent hat seinen eigenen State, teilt nur notwendige Daten als Nachrichten. CrewAI nutzt dieses Pattern. Vorteil: Token-Effizienz ist hoch. Nachteil: Manuelle Serialisierung von Daten nötig.

**Hybrid (empfohlen):** Shared State enthält nur Metadaten (welcher Agent was wann getan hat), echte Daten landen auf Disk/DB, Agenten kriegen nur References. Beispiel: BigQuery-Result nach GCS schreiben, Agent bekommt `gs://bucket/result.parquet`-Pfad.

## Fehlerbehandlung: Was passiert, wenn ein Agent ausfällt?

In serieller Topologie: Agent 2 fällt, Pipeline stoppt – einfach. In paralleler: Agent B fällt, aber A und C laufen weiter – Dein Report entsteht mit unvollständigen Daten. Auf der Orchestrierungs-Ebene brauchst Du "Partial Success"-Logik.

**Strategien:**

1. **Fail-Fast (für Seriell):** Erster Fehler stoppt alles. Wenn Latenz nicht kritisch, nutze das.
2. **Best-Effort (für Parallel):** Starten so viele Agenten wie möglich, generiere Output auch mit unvollständigen Daten – aber markiere den Output mit "incomplete"-Flag.
3. **Retry with Fallback:** Agent A scheitert 3x, Agent A_backup übernimmt (anderes Modell oder anderes Prompt).

```python
# LangGraph Retry
workflow.add_node("agent_a", agent_a, retry_policy={"max_attempts": 3})
workflow.add_edge("agent_a", "agent_a_backup", condition="failed")
```

## Production Checklist: Multi-Agent-System vor Launch

- **Token-Budget berechnen:** 5 Agenten × 10K Token Input × 2K Output × API-Preis = Kosten pro Run. 1000 Runs/Tag = Monatsende wie?
- **Latenz-SLA festlegen:** Wie lange darf jeder Agent maximal dauern? Wenn P95 Latenz >10 Sekunden, brauchst Du Parallelisierung.
- **Rollback-Plan:** Prompt-Update bei einem Agenten bricht die ganze Pipeline. Versionskontrolle + Canary Deployment sind Pflicht.
- **Human-in-the-Loop Punkt:** Bei kritischen Entscheidungen (z.B. Budget-Adjustments) Agenten-Output vor Human zeigen, Freigabe einholen.
- **Audit Log:** Jeder Schritt jedes Agenten – welches Tool mit welchen Parametern, was zurück – als JSON nach S3. Für Compliance unverzichtbar.

Multi-Agent-Orchestrierung ist LLM Engineering's "Systemdesign-Kurs". Du startest mit einem LLM-Aufruf, in Production brauchst Du Topologie, State Management, Retry-Logik, Observability. LangGraph, CrewAI, AutoGen sind Grundgerüste – die eigentliche Arbeit ist, Deine Agenten für den Use Case richtig zu sequenzieren und zu parallelisieren. Prototyp nehmen, Latenz messen, Kosten-Simulation laufen lassen, Topologie wählen. Nie ohne vorherige Tests in Production – zwischen "läuft" und "production-ready" liegen Welten.