---
title: "Multi-Agent-Orchestrierung: Von einzelnen LLM-Aufrufen zu Systemen"
description: "Agent-SDKs, Tool Use und parallele/serielle Topologien: Wie integrieren Sie LLMs in Geschäftsprozesse? Production-Tradeoffs und Orchestrierungs-Architekturen."
publishedAt: 2026-07-02
modifiedAt: 2026-07-02
category: ai
i18nKey: ai-008-2026-07
tags: [multi-agent, llm-orchestrierung, agent-sdk, tool-use, ai-infrastruktur]
readingTime: 9
author: Roibase
---

Die Proof-of-Concept-Phase — einen LLM-API-Aufruf tätigen und eine Antwort erhalten — endete 2023. 2026 befassen sich Unternehmen, die LLMs in die Production bringen, mit dem, was wir "Agent-Orchestrierung" nennen: mehrere Modelle, jedes mit Zugriff auf verschiedene Tools, parallel oder sequenziell ausgeführt, observierbar und wiederspielbar. In diesem Artikel sehen Sie, welche Entscheidungen Sie beim Aufbau einer Multi-Agent-Architektur treffen, welche SDKs versprechen und welche Trade-offs Orchestrierungs-Topologien mit sich bringen.

## Was Agent-SDKs versprechen und liefern

Frameworks wie LangChain, CrewAI, Semantic Kernel und LlamaIndex werden als "Agent-SDKs" vermarktet. Ihr gemeinsames Versprechen: Geben Sie dem LLM die Berechtigung zur Tool-Nutzung, etablieren Sie eine Entscheidungshierarchie, verwalten Sie Chains. Genügen diese Tools in der Praxis?

Das erste Problem: **Abstraktions-Overhead**. High-Level-Bibliotheken wie LangChain vereinfachen Tool-Binding, erschweren aber das Debugging. In der Production müssen Sie, wenn ein Tool-Aufruf fehlschlägt, die Traces parsen, um zu verstehen, ob ein interner LangChain-State oder die API-Response das Problem verursacht hat. Mit nativer Tool-Unterstützung wie Anthropics Computer Use API bietet der direkte SDK-Einsatz oft bessere Sichtbarkeit.

Das zweite Problem: **Versionierung**. Agent-SDKs iterieren schnell, Breaking Changes treten häufig auf. Beispielsweise führte der Übergang von LangChain 0.1 zu 0.2 zu einigen Deprecations in Chain-Strukturen. Statt eine gepinnte Version zu verwenden und auf Patches zu warten, kann es manchmal nachhaltiger sein, die Tool-Use-Logik selbst zu schreiben. Besonders wenn die Orchestrierungs-Schicht eigene Business Logic enthält, vermeiden Sie, sich in die opinionierte Struktur eines SDKs zu zwängen.

Der dritte Vorteil: **Built-in Observability**. Add-ons wie LangSmith oder LlamaIndex' Eval Suite visualisieren Call Chains. Dies ist für Production Debugging kritisch — welcher Agent rief welches Tool auf, wo stieg die Latenz, welcher Prompt verbrauchte welche Token? Wenn Sie Ihre eigene Orchestrierung schreiben, müssen Sie diese Telemetrie selbst aufbauen. SDKs sparen hier Zeit, tragen aber Lock-in-Risiken mit sich.

## Tool Use: Jenseits des Function Calling

Tool Use ist der Prozess, bei dem das LLM strukturierte Ausgaben erzeugt, um externe APIs aufzurufen. OpenAI Function Calling, Anthropic Tool Use, Google Function Calling — alle implementieren dasselbe Prinzip mit unterschiedlichen Schemaformaten. Das Interessante sind Szenarien, in denen Tools **voneinander abhängig** sind.

Einfaches Beispiel: ein E-Mail-Kampagnen-Automatisierungs-Agent. Erstes Tool: `list_segments` (ruft eine Segment-Liste aus dem CRM ab). Zweites Tool: `get_segment_stats` (gibt Metrics für ein Segment zurück). Drittes Tool: `create_campaign` (erstellt ein Campaign-Objekt). Sie müssen diese drei Tools **sequenziell** ausführen, da jede Output die Eingabe der nächsten ist.

Komplexes Beispiel: ein Datenanalytik-Agent. Sie können `query_bigquery`, `fetch_gsc_data` und `fetch_ga4_events` **parallel** ausführen, da sie voneinander unabhängig sind. Parallele Ausführung reduziert Production Latency, aber die Orchestrierungs-Engine muss Concurrency Limits und Rate Limits verwalten. Das Anthropic SDK kann parallele Tool-Aufrufe ausführen, aber OpenAI Function Calling ist sequenziell (Stand Q2 2026). In diesem Fall schreiben Sie die Orchestrierungs-Engine selbst.

Ein kritischer Trade-off in Tool Use ist **Determinismus vs. Flexibilität**. Wenn Sie das LLM instruieren, "wählen Sie eins dieser drei Tools", kann es bei jedem Run eine andere Wahl treffen. Wenn Sie die Tool-Sequenz hardcoden, verlieren Sie Flexibilität, gewinnen aber Reproduzierbarkeit. In der Production ist üblicherweise **hybrid**: Hardcoden Sie den kritischen Pfad, überlassen Sie optionale Entscheidungen dem LLM.

### Beispiel einer Tool-Call-Kette

```python
# Serielle Tool-Kette (jeder Schritt gibt Input für den nächsten)
def orchestrate_campaign(prompt: str, client: AnthropicClient):
    # 1. Liste Segmente auf
    segments = client.tool_use("list_segments", {})
    
    # 2. Stats für jedes Segment (parallele Batch)
    stats_calls = [
        client.tool_use("get_segment_stats", {"segment_id": s})
        for s in segments["ids"]
    ]
    stats = asyncio.gather(*stats_calls)
    
    # 3. Kampagne für Segment mit höchstem Engagement
    best_segment = max(stats, key=lambda x: x["engagement"])
    campaign = client.tool_use("create_campaign", {
        "segment_id": best_segment["id"],
        "message": prompt
    })
    return campaign
```

In diesem Beispiel liegt eine `list_segments` → `get_segment_stats` (parallel) → `create_campaign` (seriell) Struktur vor. Das LLM spielt nur bei der finalen Message-Generierung eine Rolle — dies ist eine **semi-autonome** Architektur. Die Orchestrierungs-Engine verwaltet die Tool-Call-Logik.

## Parallele vs. serielle Agent-Topologie

In Multi-Agent-Systemen gibt es zwei fundamentale Topologien: **parallel** (mehrere Agents laufen gleichzeitig, Outputs werden zusammengeführt) und **seriell** (jeder Agent erzeugt die Eingabe des nächsten).

**Parallele Topologie** wird üblicherweise für **Spezialisierung** genutzt. Beispiel: eine Content-Creation-Pipeline. Agent A schreibt Headlines, Agent B erstellt Body-Absätze, Agent C optimiert SEO-Meta-Beschreibungen. Alle drei erhalten als Input die gleiche Brief, ihre Outputs werden zusammengeführt. Vorteil dieser Struktur: jeder Agent spezialisiert sich auf sein Domain, Prompts sind kürzer, Token-Kosten sinken (Context Window wird nicht geteilt). Nachteil: Koordinations-Overhead. Die Merge-Logik liegt in Ihrer Verantwortung — wenn Outputs nicht kohärent sind, ist manuelle Abstimmung erforderlich.

**Serielle Topologie** wird für **Verfeinerung** oder **Validierung** eingesetzt. Agent A erstellt einen Draft, Agent B führt Fact-Checking durch, Agent C poliert den Ton. Jeder Agent nimmt die Output des vorherigen. Vorteil: jede Stufe verbessert die vorherige, die lineare Reasoning-Struktur ist leicht zu debuggen. Nachteil: Latenz — jeder Agent muss in der Sequenz warten. Die Gesamtdauer ist N × durchschnittliche Agent-Latenz.

Bei Roibase verwenden wir in Marketing Operations ein hybrides Modell: In **[Generative Engine Optimization](https://www.roibase.com.tr/de/geo)** Prozessen sammeln parallele Agents Citations aus verschiedenen Suchmaschinen (ChatGPT, Perplexity, Gemini), eine serielle Agent-Kette gleicht diese Citations mit Brand Mention Patterns ab. Der parallele Teil beschleunigt die Datensammlung, der serielle Teil liefert analytische Tiefe.

### Topologie-Vergleich

| Architektur | Latenz | Spezialisierung | Debugging | Use Case |
|---|---|---|---|---|
| Parallel | Niedrig (max. Agent-Zeit) | Hoch | Merge-Logik komplex | Datenerfassung, Multi-Source-Analyse |
| Seriell | Hoch (Summe Agent-Zeiten) | Niedrig | Linearer Trace | Verfeinerung, Validierung, Multi-Step Reasoning |
| Hybrid | Mittel | Hoch | Komplex | Production Pipelines |

## Orchestrierungs-State und Reproduzierbarkeit

Wenn Sie ein Multi-Agent-System aufbauen, ist die kritischste Entscheidung: **Wo speichern Sie den State?** Es gibt drei Optionen.

**Stateless Orchestration:** Jeder Agent ist unabhängig, Zwischenausgaben werden im Orchestrator-Memory gespeichert. Vorteil: Wiederspielen ist einfach, horizontale Skalierung ist möglich. Nachteil: Memory-Belastung — in langen Chains speichern Sie GigaByte an Conversation History.

**Stateful Orchestration:** Sie speichern Zwischenstates in einem externen Store (Redis, PostgreSQL). Vorteil: niedriger Memory-Verbrauch, Crash Recovery ist möglich. Nachteil: I/O-Overhead, Consistency-Garantien erforderlich.

**Hybrid (Checkpointing):** Sie persistieren State bei bestimmten Meilensteinen. Beispiel: Checkpoint nach jedem 5. Agent-Aufruf. Bei Crash fahren Sie vom letzten Checkpoint fort. Vorteil: Balance zwischen Performance und Zuverlässigkeit. Nachteil: komplexe Implementierung.

In der Production ist ein häufiges Pattern, Orchestrierungs-State in einen Log Stream zu schreiben. Jeder Agent-Aufruf wird als strukturiertes Log in BigQuery gepuffert, Event Sourcing wird für Replay verwendet. So können Sie die Attribution Chain retrospektiv analysieren — welche Agent-Output beeinflusste welche Downstream-Metrik?

## Eval und Observability: Debugging von Orchestrierungen

In Multi-Agent-Systemen ist Debugging schwierig, da es viele Fehlerstellen gibt. Hat Agent A das falsche Tool gewählt, hat Agent B die Eingabe falsch geparst, oder ist die Merge-Logik des Orchestrators fehlerhaft? Ein **Observability Stack** ist obligatorisch.

Die Metriken, die Sie brauchen:
- **Agent-Level Latency** (p50, p95, p99) — welcher Agent ist der Bottleneck?
- **Tool Success Rate** — welche API-Aufrufe schlagen häufig fehl?
- **Token Usage pro Agent** — Cost Attribution
- **Eval Score** — verwenden Sie LLM-as-Judge, um jede Agent-Ausgabe mit 0-1 zu bewerten

Ein Pattern, das wir für Eval nutzen: **reference-free scoring**. Ein "Supervisor" LLM (z.B. GPT-4) bewertet jede Agent-Ausgabe mit Scores für "Task Completion" und "Halluzination". Diese Scores werden zeitlich gespeichert, Regressions werden erkannt. Beispiel: wenn die Halluzinations-Score des Agenten A von 0,1 auf 0,3 steigt, rollback Sie die Prompt-Version.

Eine andere, von Anthropic empfohlene Technik: **Claude als Evaluator**. Dank des großen Context Windows geben Sie Claude die gesamte Agent-Kette in einem Prompt, fragen "gibt es logische Fehler in dieser Kette?" Diese Meta-Evaluation wird im Pre-Production QA verwendet.

## Orchestrierungs Trade-offs und Entscheidungsmatrix

Bei der Wahl einer Multi-Agent-Architektur berücksichtigen Sie diese Trade-offs:

**1. Komplexität vs. Kontrolle:** Die Verwendung eines SDKs beschleunigt die Implementierung, macht aber das Debugging undurchsichtig. Eine custom Orchestrierungs-Engine gibt Ihnen Kontrolle, aber hohe Wartungslast.

**2. Latenz vs. Spezialisierung:** Parallele Agents sind schnell, bringen aber Koordinations-Overhead. Serielle Agents ermöglichen tieferes Reasoning, sind aber langsam.

**3. Kosten vs. Qualität:** Jeder Agent-Aufruf verbraucht Tokens. Die Erhöhung der Agent-Anzahl kann die Qualität verbessern, aber die Kosten wachsen linear. In der Production müssen Sie "Minimum Viable Agent Count" ermitteln.

**4. Determinismus vs. Adaptabilität:** Hardcodierte Tool-Sequenzen sind reproduzierbar, können aber Edge Cases nicht handhaben. Die Überlassung der Tool-Wahl an das LLM ist adaptiv, aber nicht-deterministisch.

Die bei Roibase verwendete Entscheidungsmatrix:

| Use Case | Topologie | SDK | State Management |
|---|---|---|---|
| Datenerfassung | Parallel | LlamaIndex | Stateless |
| Content Refinement | Seriell | Custom | Checkpointing |
| Real-Time Inference | Hybrid | Anthropic SDK | Redis Cache |
| Batch Processing | Parallel | LangChain | PostgreSQL |

## Orchestrierungs-System in Production bringen

Wenn Sie ein Multi-Agent-System in Production bringen, beachten Sie drei Dinge.

**Rate Limiting:** Parallele Agents überlasten API Rate Limits. Verwenden Sie in der Orchestrierungs-Engine Token Bucket oder Semaphore Pattern. Wenn die Anthropic API 50 req/min hat, drosseln Sie die Anzahl paralleler Agents entsprechend.

**Fallback Strategy:** Was tun Sie, wenn ein Agent fehlschlägt? Retry-Logik ist einfach, aber fügen Sie exponential backoff + jitter hinzu. Wenn der Agent nicht kritisch ist (z.B. optionaler SEO Meta Tag Generator), verwenden Sie Circuit Breaker und schalten in Fail-Safe Mode.

**Cost Monitoring:** Loggen Sie die Token-Kosten jedes Agent-Aufrufs. In der Production verfolgen Sie $/request pro Agent. Wenn ein Agent einen Cost Spike verursacht, optimieren Sie den Prompt oder deaktivieren den Agent.

Die Kraft der Multi-Agent-Orchestrierung liegt nicht darin, "mehr als ein einzelnes LLM zu tun", sondern darin, **Geschäftsprozesse modular, observierbar und skalierbar zu machen**. Um Multi-Agent-Orchestrierung in der Production zu unterhalten, müssen Sie Tool-Topologie, State Management und Eval Pipeline zusammen durchdenken. Beim Aufbau dieser Systeme ist **[Datenanal