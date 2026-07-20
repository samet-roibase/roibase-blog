---
title: "Multi-Agent Orchestration: From Single LLM Call to Production Systems"
description: "Agent SDKs to parallel/serial topologies: How to build production-grade multi-agent systems using LangGraph, CrewAI, and AutoGen."
publishedAt: 2026-07-20
modifiedAt: 2026-07-20
category: ai
i18nKey: ai-008-2026-07
tags: [multi-agent, llm-orchestration, langgraph, crewai, agent-topology]
readingTime: 8
author: Roibase
---

In 2023, LLMs could "call tools." In 2024, "agent" became the buzzword. In 2025, everyone built their own. In 2026, the question shifted: one agent isn't enough—should I run five agents in parallel or series? Which agent handles which tool? Where does coordination logic live? Multi-agent orchestration is the first serious engineering problem in the journey from "Hello World" LLM apps to production systems.

## From Single Agent to Topology: Why Orchestration Matters

A single agent—say, Claude Sonnet 3.5 plus five tools—solves many use cases. But when these scenarios arrive, you hit a wall:

**Parallel execution becomes necessary:** You're analyzing a marketing campaign. Simultaneously, fetch data from Google Ads API, calculate historical trends in BigQuery, pull conversion metrics from Shopify. A single agent runs these sequentially—total 12 seconds. Three agents in parallel finish in 4.5 seconds. If latency is critical, orchestration is mandatory.

**Specialization requirement:** One agent writes SQL, another cleans data, a third generates visualization code. Each gets a different system prompt, different model (Sonnet for SQL, Opus for code), different retrieval context. Ask one agent to "do both SQL and visual design" and context window balloons, performance tanks.

**Security layers:** One agent sanitizes external prompts, another executes business logic, a third validates output. This "assembly line" structure is non-negotiable in production: tool-use parameter errors drop when orchestration validates each step.

In Roibase's [Data Analytics & Insight Engineering](https://www.roibase.com.tr/en/verianalizi) projects, we cut BigQuery query times by 60% with parallel agent structure—three data sources queried simultaneously.

## Agent SDKs: LangGraph, CrewAI, AutoGen

**LangGraph (LangChain ecosystem):** Agents become nodes in a directed graph. Each node holds a "state"; edges define transition logic. Conditional routing is possible: if agent A says "data missing," route to agent B; if complete, route to C.

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

**Strengths:** State management is robust. Distributed tracing is straightforward—each node logs separately. **Drawback:** Syntax is complex; callback chains make debugging harder.

**CrewAI:** Role-based orchestration. Assign each agent a "role" (researcher, analyst, writer) and a "task" list. The framework automatically runs them sequentially or forks in parallel.

```python
from crewai import Crew, Agent, Task

researcher = Agent(role='Data Researcher', tools=[bigquery_tool])
analyst = Agent(role='Analyst', tools=[pandas_tool])

crew = Crew(agents=[researcher, analyst], process="sequential")
result = crew.kickoff()
```

**Strengths:** Minimal boilerplate, fast prototyping. **Drawback:** Low flexibility—custom routing requires code changes.

**AutoGen (Microsoft):** Conversational multi-agent. Agents "talk" to each other; one sends a message, the other responds. In this pattern, orchestration is implicit—message flow defines topology.

```python
from autogen import AssistantAgent, UserProxyAgent

assistant = AssistantAgent("assistant", llm_config={...})
user_proxy = UserProxyAgent("user", code_execution_config={...})

user_proxy.initiate_chat(assistant, message="Analyze Q1 data")
```

**Strengths:** Natural for human-in-the-loop scenarios. **Drawback:** Non-deterministic flows—unclear when agent A will respond to agent B.

## Parallel vs Serial Topology: The Tradeoff Matrix

| Architecture | Latency | Cost | Complexity | Use Case |
|--------------|---------|------|-----------|----------|
| **Serial (Sequential)** | High (N×t) | Low (one LLM call per step) | Low | Deterministic pipelines (data → analysis → report) |
| **Parallel (Fork-Join)** | Low (max(t₁, t₂, t₃)) | High (N agents simultaneously) | Medium | Independent tasks (fetch 3 APIs at once) |
| **Conditional (DAG)** | Variable | Medium | High | Dynamic flow (if data missing, try X; if complete, do Y) |
| **Conversational** | Uncertain | Medium | High | Human-in-the-loop or negotiation |

**Production decision:** If the operation isn't on the critical path (offline report generation), choose serial topology—debugging is easy, cost is low. If you have latency SLAs (real-time dashboard), fork in parallel—but build retry logic upfront; otherwise, one timeout delays all three.

## Tool Use Coordination: Preventing Conflicts

The most common bug in multi-agent systems: two agents call the same tool simultaneously with different parameters, corrupting each other's state.

**Example:** Agent A creates `temp_table_x` in BigQuery; agent B tries to read `temp_table_x` at the same time—data not found error. Solve this at the orchestration layer:

**1. Resource locking:** When agent A starts using a tool, the orchestrator locks it for other agents. In LangGraph, use `shared_state`.

```python
if not state.lock_acquired("bigquery"):
    return {"status": "waiting"}
state.acquire_lock("bigquery")
result = bigquery_tool.run()
state.release_lock("bigquery")
```

**2. Namespace isolation:** Give each agent its own workspace. Agent A uses `workspace_a/temp_table`, agent B uses `workspace_b/temp_table`. In CrewAI, add `agent_id` prefix.

**3. Idempotent tool design:** Build tools to be idempotent from the start—calling twice with the same parameters doesn't cause conflict. Use `create_or_replace` instead of `upsert`.

## Observability: How to Trace Agent Execution

In production, five agents run—one fails. Which one? Tools like LangSmith, Helicone, and Arize collect agent-level traces, but manual instrumentation is required.

**Critical metrics:**
- **Agent latency per step:** How long did each agent take? In parallel fork, `max(latency)` shows the bottleneck.
- **Tool call success rate:** How many times did each agent call each tool? How many succeeded? Below 95% is a red flag.
- **Retry count:** How many times did an agent retry? High retry suggests bad prompts or incorrect tool specs.
- **State transition diagram:** In LangGraph, which nodes transitioned to which, and how often? Infinite loops show here.

```python
# LangSmith integration
from langsmith import Client

client = Client()
with client.trace(run_name="multi_agent_pipeline") as run:
    for agent in agents:
        with run.create_child(name=agent.name):
            agent.run()
```

## Context Window Management: Shared Memory vs Isolated

The bottleneck in multi-agent systems is context window. Do five agents share the same 128K tokens, or does each get its own 128K?

**Shared memory (LangGraph default):** All agents read/write the same state object. Advantage: agent A's findings auto-pass to agent B. Disadvantage: context pollution—irrelevant data bloats the window.

**Isolated memory + message passing:** Each agent owns its state; only necessary data passes as messages. CrewAI uses this pattern. Advantage: high token efficiency. Disadvantage: manual data serialization.

**Hybrid (recommended):** Keep metadata in shared state (which agent did what, when), store actual data on disk/database, pass references to agents. For example, write BigQuery results to GCS and pass `gs://bucket/result.parquet` paths instead of raw data.

## Error Handling: What Happens When an Agent Fails?

In serial topology, agent 2 fails and the pipeline stops—simple. In parallel, agent B fails but agents A and C keep running—you end up generating a report with missing data. Orchestration requires "partial success" logic.

**Strategies:**

1. **Fail-fast (serial):** First error halts the entire pipeline. Choose this if latency is irrelevant.
2. **Best-effort (parallel):** Run as many agents as possible; generate output even with missing data—but flag it as "incomplete" in metadata.
3. **Retry with fallback:** Agent A fails after 3 attempts; ask agent A_backup (different model or prompt) instead.

```python
# LangGraph retry
workflow.add_node("agent_a", agent_a, retry_policy={"max_attempts": 3})
workflow.add_edge("agent_a", "agent_a_backup", condition="failed")
```

## Production Checklist: Before Deploying Multi-Agent System

- **Calculate token budget:** 5 agents × 10K token input × 2K output × API cost = per-run cost. 1000 runs/day = month-end bill?
- **Define latency SLA:** How long can each agent run? If P95 latency exceeds 10 seconds, parallel topology is required.
- **Plan rollback:** Changing one agent's prompt can break the entire pipeline. Version control + canary deployment are mandatory.
- **Human-in-the-loop checkpoint:** On critical decisions (e.g., budget adjustments), show the final agent output to a human for approval.
- **Audit log:** Every step of every agent—which tool was called, what parameters, what returned—log to S3 as JSON. Compliance demands it.

Multi-agent orchestration is the "systems course" of LLM engineering. What begins as a single model call evolves in production into topology design, state management, retry logic, and observability. LangGraph, CrewAI, and AutoGen are scaffolding—the real work is deciding how to sequence and parallelize agents for *your* use case. Prototype, measure latency, simulate costs, pick topology. Never ship without testing—in multi-agent systems, "works" and "production-ready" are separated by ten layers.