---
title: "Orquestación Multi-Agente: De una Llamada LLM a Sistemas de Producción"
description: "Agent SDK, tool use y topologías paralelo/serie: transformar LLMs en infraestructura de producción con trade-offs latencia, costo y confiabilidad."
publishedAt: 2026-05-23
modifiedAt: 2026-05-23
category: ai
i18nKey: ai-008-2026-05
tags: [multi-agente, orquestracion-llm, tool-use, agent-sdk, ingenieria-ia]
readingTime: 8
author: Roibase
---

En 2024, decir "asistente IA" significaba un único ciclo prompt-response. En 2026, en producción es diferente: mallas de agentes paralelos, pipelines de orquestación serie, agentes conectados a sistemas externos mediante tool use. Construir un sistema de agentes que se envían señales entre sí en lugar de llamadas LLM únicas está reescribiendo el equilibrio entre confiabilidad y trade-offs costo/latencia. La orquestación multi-agente es la capa arquitectónica que transforma el LLM en una pieza de infraestructura de producción.

## SDKs de Agentes y Capa de Tool Use

Los frameworks de agentes — LangGraph, Autogen, CrewAI — dan al LLM la capacidad de "llamar funciones". Tool use es cuando el modelo transforma su propia salida en una llamada de función conforme a un JSON schema, e un intérprete ejecuta esa función y devuelve el resultado al prompt. OpenAI function calling, Anthropic Claude tool use API, Google Gemini function declaration se basan en el mismo principio: el LLM no puede ejecutar código determinista, pero puede indicar qué función llamar con qué parámetros.

Los SDKs manejan este ciclo: llega la consulta del usuario, el modelo dice "ve a la API del clima con city=Istanbul", el orquestador invoca la API, suma la respuesta al prompt, el modelo genera la salida final. Esos 3 viajes redondos = 3× latencia. En producción, una cadena de tool calls puede alcanzar 5-7 pasos; si cada uno suma 200-800ms, el tiempo de respuesta total es 1-5 segundos. En multi-agente, el objetivo es romper esa latencia mediante paralelización y caché.

Ejemplo de definición de tool:

```python
tools = [
    {
        "name": "query_analytics",
        "description": "Extrae métrica especificada de BigQuery",
        "parameters": {
            "metric": "string (revenue|sessions|conversions)",
            "date_range": "string (7d|30d|90d)"
        }
    }
]
```

Cuando el modelo decide usar este tool, el orquestador invoca el cliente de BigQuery, suma el resultado al prompt, el modelo sintetiza el resultado final. El poder del tool use es que el LLM puede interrogar al mundo exterior sin sacrificar determinismo.

## Topologías de Agentes Paralelos y en Serie

Un agente = procesamiento serie. Multi-agente = mezcla de paralelo + serie. Dos patrones fundamentales: **scatter-gather** y **pipeline**.

**Scatter-gather:** El orquestador principal divide la tarea en 3 sub-agentes; cada uno trabaja simultáneamente con una herramienta diferente. Ejemplo: "Analiza el rendimiento de campaña del mes pasado" → agent_1 a Google Ads API, agent_2 a Meta Ads API, agent_3 a BigQuery, todo en paralelo. El orquestador recibe 3 respuestas, las sintetiza, entrega el reporte final. Latencia: max(agent_1, agent_2, agent_3) + síntesis. Si fuera serie: agent_1 + agent_2 + agent_3 + síntesis. En lugar de 3×800ms, obtienes 800ms + 300ms = 1.1s.

**Pipeline:** La salida de agent_A es la entrada de agent_B. Ejemplo: (1) agente planificador escribe SQL → (2) agente ejecutor ejecuta SQL → (3) agente visualización genera spec de gráfico. Cada paso depende del anterior. La latencia es serie, pero **cada agente es especializado** — el planificador de queries puede ser un modelo pequeño (GPT-4o-mini, 50ms), no requiere lógica de ejecución; el agente de visualización puede usar Gemini Flash. Tres modelos pequeños en lugar de uno grande = más barato + más rápido (en algunos casos).

En Roibase, nuestra arquitectura de [Medición y Datos First-Party](https://www.roibase.com.tr/es/firstparty) usa orquestación multi-agente en pipelines de atribución: un agente parsea eventos raw, otro vincula a sesión, otro mapea ingresos, el agente final calcula atribución cross-channel. Topología pipeline = pasos deterministas, cada uno con su propio conjunto de herramientas.

### Trade-off Paralelo vs Serie

| Topología | Latencia | Costo | Caso de Uso |
|----------|----------|-------|-----------|
| Paralelo (scatter-gather) | Baja (tiempo máximo) | Alta (N agentes × llamada LLM) | Consultas independientes (multi-fuente) |
| Serie (pipeline) | Alta (tiempo total) | Media (cada agente puede ser modelo pequeño) | Procesamiento dependiente (parse → enrich → analiza) |
| Híbrida (paralelo → merge → serie) | Media | Media-Alta | Tarea compleja (recolecta datos paralelo, resultado en pipeline) |

En producción, scatter-gather añade límite de concurrencia para no chocar contra rate limits (ej: máx 5 llamadas LLM paralelas). En pipeline serie, usamos caché intermedia — si la salida de agent_A es válida 10 minutos y la misma consulta llega, agent_B comienza directamente desde output caché.

## Responsabilidades del Orquestador: Routing y Manejo de Errores

El orquestador no solo activa agentes, **decide qué agente maneja qué tarea**. En LangGraph se llama "agente supervisor": categoriza la consulta entrante y hace routing. Lógica de ejemplo:

```python
def route_query(user_query: str) -> str:
    # Router basado en LLM (modelo pequeño, rápido)
    classification = llm.classify(user_query, categories=["data_query", "content_gen", "code_review"])
    
    if classification == "data_query":
        return "analytics_agent"
    elif classification == "content_gen":
        return "writer_agent"
    else:
        return "code_agent"
```

El agente router generalmente usa GPT-4o-mini o Claude Haiku — modelo rápido y barato. Suma un overhead de 50-100ms pero evita usar un modelo grande innecesariamente. Si el usuario dice "resume el rendimiento de campaña", va a analytics_agent (usa BigQuery); si dice "escribe un artículo de blog", va a writer_agent (búsqueda web + LLM de escritura).

**El manejo de errores es crítico en multi-agente.** Si agent_1 alucinaba en un solo agente, reintentabas. En multi-agente, si agent_2 trabaja con salida errónea de agent_1, fallo en cascada. El orquestador debe validar la salida de cada agente:

```python
def validate_agent_output(output: dict, schema: dict) -> bool:
    # Validación de JSON schema
    if not matches_schema(output, schema):
        raise AgentOutputError("Salida de agente no cumple schema")
    
    # Validación semántica (opcional, costosa)
    if confidence_score(output) < 0.7:
        return False  # reintentar o fallback
    
    return True
```

Si agent_1 falla, el orquestador recorre cadena de fallback: primero reintentar (1×), luego agente alternativo (modelo más grande), finalmente human-in-the-loop. Sin esta lógica, multi-agente no es confiable en producción.

## Latencia y Costo: Escenarios de Benchmark

Escenario de prueba: "Analiza la tendencia de ingresos de los últimos 30 días, resume rendimiento de campaña, escribe resumen para CEO" — 3 tareas independientes.

**Agente único (GPT-4, serie):**
- Consulta BigQuery → 800ms (LLM + API)
- Consulta plataformas publicitarias → 900ms
- Generar email → 600ms
- **Total:** 2300ms
- **Costo:** 3 turnos × $0.03/1K tokens = ~$0.09 (mix input/output asumido)

**Multi-agente (scatter-gather + pipeline):**
- Agent_1, 2, 3 paralelo (BigQuery, ads, prep email) → máx 900ms
- Orquestador merge + síntesis → 400ms
- **Total:** 1300ms
- **Costo:** 3 agentes × $0.02 (modelo pequeño) + síntesis $0.03 = ~$0.09 (igual, pero optimizable)

**Ganancia:** 43% reducción de latencia. Costo igual, pero con selección de modelos (agent_1 → Gemini Flash, agent_2 → Claude Haiku, orquestador → GPT-4o-mini) baja a $0.05.

**Pero:** Agentes paralelos = consumo paralelo de rate limits. Si OpenAI tier es 500 RPM, 10 agentes paralelos = 50 usuarios servidos en 5 minutos. Un agente solo = 500 usuarios. En producción, gestionamos este trade-off con queue + caché.

## Observabilidad y Debug

En sistemas multi-agente, responder "¿dónde salió mal?" es difícil. Herramientas como LangSmith, Helicone, Arize Phoenix visualizan el trace del agente: cuándo cada agente llamó qué herramienta, con qué prompt, qué devolvió, dónde reintentó. Ejemplo de trace:

```
orchestrator → classify_query (50ms, GPT-4o-mini) → "data_query"
→ analytics_agent → query_bigquery (800ms, tool_call) → success
→ writer_agent → generate_summary (600ms, GPT-4) → success
→ orchestrator → merge_results (200ms) → final_output
```

Cada paso registra tokens, latencia, costo. Sin esta telemetría, multi-agente es indebugable en producción. Si el tool call de agent A caduca en timeout, lo ves en el trace; añades retry logic.

Otra métrica: **utilización del agente**. Si definiste 5 agentes pero 80% de consultas van a uno solo, la lógica de routing falla. Medimos classification accuracy del orquestador — construimos dataset etiquetado con feedback de usuario, fine-tuneamos el agente router (o implementamos lightweight classifier en lugar de few-shot prompt).

## Limitaciones de Multi-Agente

Multi-agente no resuelve todo problema. **Hay overhead de coordinación**: paso de mensajes entre agentes, lógica de orquestación, manejo de errores — todo suma latencia. Una consulta simple que un agente único completa en 1 segundo puede tomar 1.5 segundos en multi-agente (orquestador + routing + merge). La complejidad arquitectónica aumenta — base de código más grande, testing difícil, deployment más frágil.

Casos donde multi-agente tiene sentido:
- **Pull de datos paralelo requerido:** Extraer de 5 APIs diferentes — scatter-gather ahorra tiempo
- **Modelos especializados óptimos:** Planificación de queries con modelo pequeño, generación de código con modelo grande — pipeline topology reduce costo
- **Tarea larga:** Agent_1 inicia trabajo, agent_2 monitorea async, agent_3 finaliza, orquestador notifica — arquitectura event-driven en lugar de llamada LLM síncrona

En consultas cortas, frecuentes y simples, un agente único + caché es mejor. Multi-agente crea valor cuando decomponem una tarea compleja y la optimizamos.

---

La orquestación multi-agente transforma el LLM de una llamada función sin estado a un sistema con estado, observable y escalable. La topología paralela rompe latencia, la topología pipeline reduce costo, el orquestador garantiza confiabilidad. En producción: comienza con scatter-gather, monitorea rate limits y costo, transiciona a pipeline según sea necesario. Registra traces de agente, implementa manejo de errores en capas, testea routing logic. Multi-agente es el punto de transición de ingeniería LLM a infraestructura LLM.