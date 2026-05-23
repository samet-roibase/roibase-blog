---
title: "Multi-Agent-Orchestrierung: Von einzelnen LLM-Aufrufen zu Systemen"
description: "Agent-SDKs, Tool Use und parallele/serielle Topologien verwandeln LLMs in Production-Systeme — Latenz-, Cost- und Zuverlässigkeits-Tradeoffs."
publishedAt: 2026-05-23
modifiedAt: 2026-05-23
category: ai
i18nKey: ai-008-2026-05
tags: [multi-agent, llm-orchestrierung, tool-use, agent-sdk, ai-engineering]
readingTime: 9
author: Roibase
---

2024 bedeutete „KI-Assistent" noch: ein Prompt-Response-Zyklus. 2026 in Production ist anders: parallele Agent-Meshes, serielle Orchestrierungs-Pipelines, Agenten mit Tool Use an externe Systeme gebunden. Statt einzelner LLM-Aufrufe ein System von Agenten, die sich gegenseitig Signale schicken — das schreibt das Gleichgewicht zwischen Zuverlässigkeit und Cost/Latenz neu. Multi-Agent-Orchestrierung ist die Architektur-Schicht, die das LLM vom Funktionsaufruf zum Production-Infrastructure-Element macht.

## Agent-SDKs und Tool-Use-Schicht

Agent-Frameworks — LangGraph, Autogen, CrewAI — geben dem LLM die Berechtigung: „Du kannst Funktionen aufrufen." Tool Use bedeutet: Das Modell transformiert seine eigene Ausgabe in einen Function Call (JSON-Schema-konform), und der Interpreter führt diese Funktion aus und fügt das Ergebnis zurück ins Prompt ein. OpenAIs Function Calling, Anthropic Claude's Tool-Use API, Google Geminis Function Declaration folgen demselben Prinzip: LLMs können keinen deterministischen Code ausführen, aber sie können sagen, welche Funktion mit welchen Parametern aufgerufen werden soll.

SDKs managen diesen Loop: Nutzer-Query kommt an, Modell sagt „rufe Wetter-API mit city=Berlin auf", Orchestrator ruft API auf, fügt Antwort ins Prompt ein, Modell produziert finale Ausgabe. Diese 3 Roundtrips = 3× Latenz. In Production kann eine Tool-Call-Kette 5–7 Schritte lang sein, jeder addiert 200–800ms, zusammen 1–5 Sekunden Response Time. In Multi-Agent geht es darum, diese Latenz durch Parallelisierung und Caching zu brechen.

Beispiel einer Tool-Definition:

```python
tools = [
    {
        "name": "query_analytics",
        "description": "Metrik aus BigQuery abrufen",
        "parameters": {
            "metric": "string (revenue|sessions|conversions)",
            "date_range": "string (7d|30d|90d)"
        }
    }
]
```

Entscheidet sich das Modell für dieses Tool, ruft der Orchestrator den BigQuery-Client auf, fügt das Ergebnis ins Prompt ein, das Modell synthetisiert die finale Antwort. Die Kraft von Tool Use: LLMs können die externe Welt abfragen, ohne auf Determinismus zu verzichten.

## Parallele und serielle Agent-Topologien

Ein Agent = serieller Prozess. Multi-Agent = Mischung aus parallel + seriell. Zwei grundlegende Muster: **Scatter-Gather** und **Pipeline**.

**Scatter-Gather:** Der zentrale Orchestrator teilt die Aufgabe auf 3 Sub-Agenten auf, jeder arbeitet gleichzeitig mit einem anderen Tool. Beispiel: „Analysiere die Kampagnen-Performance des letzten Monats" → agent_1 zur Google-Ads-API, agent_2 zur Meta-Ads-API, agent_3 zu BigQuery, alle parallel. Der Orchestrator sammelt 3 Responses, synthetisiert, liefert finalen Report. Latenz: max(agent_1, agent_2, agent_3) + Synthese-Latenz. Seriell wäre es agent_1 + agent_2 + agent_3 + Synthese. Statt 3×800ms = 2400ms sind es 800ms + 300ms = 1100ms.

**Pipeline:** Output von Agent_A ist Input für Agent_B. Beispiel: (1) Query-Planer-Agent schreibt SQL → (2) Ausführungs-Agent führt SQL aus → (3) Visualisierungs-Agent erzeugt Graph-Spec. Jeder Schritt ist Abhängigkeit des nächsten. Latenz ist seriell, aber **jeder Agent ist spezialisiert** — Query-Planer kann ein kleines Modell sein (GPT-4o-mini, 50ms), erfordert keine Execution-Logik, Visualisierungs-Agent kann Gemini Flash verwenden. 3 kleine Modelle statt 1 großes = billiger + schneller (manchmal).

Bei Roibases [First-Party-Daten & Messung-Architektur](https://www.roibase.com.tr/de/firstparty) nutzen wir Multi-Agent-Orchestrierung in Attribution-Pipelines: ein Agent parsed Raw Events, ein Agent bindet sie an Sessions, ein Agent mapped Revenue, finaler Agent berechnet Cross-Channel-Attribution. Pipeline-Topologie = deterministische Schritte, jeder mit eigenem Tool-Set.

### Paralleles vs. serielles Tradeoff

| Topologie | Latenz | Cost | Einsatzfall |
|-----------|--------|------|-------------|
| Parallel (Scatter-Gather) | Niedrig (max-Prozess) | Hoch (N Agent × LLM-Aufruf) | Unabhängige Abfragen (Multi-Source-Datenzug) |
| Seriell (Pipeline) | Hoch (Gesamtdauer) | Mittel (jeder Agent könnte kleines Modell sein) | Abhängige Verarbeitung (Parse → Enrichment → Analyse) |
| Hybrid (Parallel → Merge → Seriell) | Mittel | Mittel-Hoch | Komplexe Aufgabe (Datenbeschaffung parallel, Ergebnis-Pipeline) |

In Production legen wir Concurrency-Limits für Scatter-Gather fest, um Rate Limits zu vermeiden (z.B. max 5 parallele LLM-Aufrufe). Bei seriellen Pipelines nutzen wir Intermediate-Cache — wenn Agent_As Output 10 Minuten gültig ist, startet Agent_B bei derselben Query direkt vom gecachten Output.

## Aufgaben des Orchestrators: Routing und Error Handling

Der Orchestrator tetigt Agent nicht nur, sondern **entscheidet, welcher Agent welche Aufgabe übernimmt**. In LangGraph heißt das „Supervisor Agent": kategorisiert eingehende Query und routet. Beispiel-Logik:

```python
def route_query(user_query: str) -> str:
    # LLM-basiertes Routing (kleines Modell, schnell)
    classification = llm.classify(user_query, categories=["data_query", "content_gen", "code_review"])
    
    if classification == "data_query":
        return "analytics_agent"
    elif classification == "content_gen":
        return "writer_agent"
    else:
        return "code_agent"
```

Der Router-Agent nutzt üblicherweise ein schnelles, billiges Modell wie GPT-4o-mini oder Claude Haiku. Es addiert 50–100ms Overhead, aber verhindert unnötige große Modelle. Sagt der Nutzer „Fasse Kampagnen-Performance zusammen", geht es zum analytics_agent (BigQuery Tool Use), sagt er „Schreibe Blogartikel", zum writer_agent (Web-Search-Tool + Writing-LLM).

**Error Handling ist in Multi-Agent kritisch.** Mit einzelnem Agent: LLM halluziniert → Retry. Mit Multi-Agent: agent_2 arbeitet mit fehlerhafter Output von agent_1 → Cascade Failure. Der Orchestrator muss jede Agent-Ausgabe validieren:

```python
def validate_agent_output(output: dict, schema: dict) -> bool:
    # JSON-Schema-Validierung
    if not matches_schema(output, schema):
        raise AgentOutputError("Agent-Ausgabe entspricht nicht dem Schema")
    
    # Semantische Prüfung (optional, teuer)
    if confidence_score(output) < 0.7:
        return False  # retry oder Fallback
    
    return True
```

Schlägt agent_1 fehl, geht der Orchestrator zur Fallback-Chain: erst Retry (1×), dann alternativer Agent (größeres Modell), dann Human-in-the-Loop. Ohne diese Logik ist Multi-Agent unreliabel.

## Latenz und Cost: Benchmark-Szenarien

Test-Szenario: „Analysiere Umsatz-Trend der letzten 30 Tage, fasse Kampagnen-Performance zusammen, schreibe Übersichts-Email für CEO" — 3 unabhängige Aufgaben.

**Single Agent (GPT-4, seriell):**
- BigQuery abfragen → 800ms (LLM + API)
- Ad Platforms abfragen → 900ms
- Email generieren → 600ms
- **Gesamt:** 2300ms
- **Cost:** 3 Durchläufe × $0.03/1K Token = ~$0.09 (Standard-Input/Output-Mix)

**Multi-Agent (Scatter-Gather + Pipeline):**
- Agent_1, 2, 3 parallel (BigQuery, Ads, Email-Vorbereitung) → max 900ms
- Orchestrator Merge + Synthese → 400ms
- **Gesamt:** 1300ms
- **Cost:** 3 Agent × $0.02 (kleines Modell) + Synthese $0.03 = ~$0.09 (gleich, aber mit Modell-Optimierung auf $0.05 reduzierbar)

**Gewinn:** 43% Latenz-Reduktion. Cost gleich, aber mit Modell-Optimierung (agent_1 → Gemini Flash, agent_2 → Claude Haiku, Orchestrator → GPT-4o-mini) auf $0.05 reduzierbar.

**Aber:** Parallele Agenten = parallele Rate-Limit-Auslastung. Wenn OpenAI-Tier 500 RPM erlaubt, bedeuten 10 parallele Agenten 50 User in 5 Minuten. Einzelner Agent hätte 500 User in 5 Minuten bedient. In Production managen wir diesen Tradeoff mit Queue + Cache.

## Beobachtbarkeit und Debugging

In Multi-Agent-Systemen ist die Antwort auf „Wo ist es schief gelaufen?" schwer. Tools wie LangSmith, Helicone, Arize Phoenix visualisieren Agent-Trace: welcher Agent wann welches Tool aufgerufen hat, mit welchem Prompt, was zurückgekommen ist, wo Retries stattgefunden haben. Beispiel-Trace:

```
orchestrator → classify_query (50ms, GPT-4o-mini) → "data_query"
→ analytics_agent → query_bigquery (800ms, tool_call) → success
→ writer_agent → generate_summary (600ms, GPT-4) → success
→ orchestrator → merge_results (200ms) → final_output
```

Bei jedem Schritt werden Token-Count, Latenz und Cost geloggt. Ohne dieses Telemetry in Production ist Multi-Agent nicht debugbar. Wenn Agent As Tool Call timeoutet, sieht man es im Trace, fügt Retry-Logik ein.

Eine weitere Metrik: **Agent-Auslastung**. Wenn du 5 Agenten definiert hast, aber 80% der User-Queries an einen Agent gehen, ist die Routing-Logik fehlerhaft. Wir messen die Classification-Accuracy des Orchestrators — mit User-Feedback schaffen wir ein gelabeltes Dataset und Fine-Tune den Router-Agent (Few-Shot-Prompt statt Lightweight-Classifier).

## Limits von Multi-Agent

Multi-Agent löst nicht jedes Problem. Es gibt **Coordination Overhead**: Nachrichtenfluss zwischen Agenten, Orchestrierungs-Logik, Error Handling — alles addiert Latenz. Eine einfache Query, die Single-Agent in 1 Sekunde beendet, könnte Multi-Agent 1,5 Sekunden kosten (Orchestrator + Routing + Merge). Architektur-Komplexität wächst — Codebasis wird größer, Testen schwerer, Deployment heikler.

Multi-Agent macht Sinn bei:
- **Paralleler Datenzug erforderlich:** 5 verschiedene APIs-Abfragen → Scatter-Gather spart Zeit
- **Spezialisierte Modelle optimal:** Kleine für Query-Planung, große für Code-Generation — Pipeline senkt Cost
- **Long-Running-Task:** Agent_1 startet Arbeit, agent_2 überwacht async, agent_3 beendet, Orchestrator notifiziert — Event-Driven statt Sync-Call

Bei kurzen, häufigen, einfachen Queries schlägt Single-Agent + Caching Multi-Agent. Multi-Agent schafft Wert durch Decomposition und Optimierung komplexer Aufgaben.

---

Multi-Agent-Orchestrierung transformiert LLMs von stateless Funktionsaufrufen zu stateful, beobachtbaren, skalierbaren Systemen. Parallele Topologie bricht Latenz, Pipeline senkt Cost, Orchestrator bringt Zuverlässigkeit. In Production: starte mit Scatter-Gather, überwache Rate Limits und Cost, wechsle bei Bedarf zur Pipeline. Logge Agent-Traces, schichte Error Handling, teste Routing-Logik. Multi-Agent ist der Übergangspunkt von LLM-Engineering zu LLM-Infrastructure.