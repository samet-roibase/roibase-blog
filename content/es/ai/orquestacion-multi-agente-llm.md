---
title: "Orquestación Multi-Agente: De Una Llamada LLM a Sistemas"
description: "De SDK de agentes a topologías paralelas/seriales: cómo construir sistemas multi-agente de nivel producción con LangGraph, CrewAI y AutoGen"
publishedAt: 2026-07-20
modifiedAt: 2026-07-20
category: ai
i18nKey: ai-008-2026-07
tags: [multi-agente, orquestacion-llm, langgraph, crewai, topologia-agentes]
readingTime: 8
author: Roibase
---

En 2023, los LLM "podían invocar herramientas". En 2024, surgió el concepto de "agente". En 2025, todos construyeron su propio agente. En 2026, la pregunta cambió: ¿un agente no es suficiente, pero debo ejecutar 5 agentes en paralelo o en serie? ¿Cuál debe usar cada herramienta? ¿Dónde debería vivir la lógica de coordinación? La orquestación multi-agente es el primer problema de ingeniería serio en la transición de aplicaciones LLM desde "Hello World" a sistemas en producción.

## De un Agente a Topología: ¿Por Qué la Orquestación?

Un agente único —por ejemplo, Claude Sonnet 3.5 + 5 herramientas— resuelve muchos escenarios de uso. Pero cuando llegan estas situaciones, te atasca:

**Necesidad de ejecución paralela:** Estás analizando una campaña de marketing. Al mismo tiempo, extrae datos de Google Ads API, calcula tendencias históricas en BigQuery, obtiene datos de conversión de Shopify. Un agente único hace estas tareas secuencialmente —12 segundos totales. Tres agentes en paralelo terminan en 4.5 segundos. Si la latencia es crítica, la orquestación es obligatoria.

**Necesidad de especialización:** Un agente redacta SQL, otro limpia datos, otro genera código de visualización. A cada agente le asignas un *system prompt* diferente, un modelo diferente (Sonnet para SQL, Opus para código), contexto de recuperación diferente. Si le dices a un agente único "domina tanto SQL como diseño visual", la ventana de contexto se hincha y el rendimiento cae.

**Capas de seguridad:** Un agente limpia el *prompt* entrante, otro ejecuta la lógica empresarial, otro valida la salida. Esta estructura de "línea de montaje" es crítica en producción: usar herramientas con mitigación de riesgo por parámetros incorrectos requiere orquestación obligatoria.

En los proyectos de [Análisis de Datos e Ingeniería de Insights](https://www.roibase.com.tr/es/verianalizi) de Roibase, con una estructura de agentes paralelos redujimos tiempos de consulta BigQuery en un 60% —porque tres fuentes de datos diferentes se pueden consultar simultáneamente.

## SDK de Agentes: LangGraph, CrewAI, AutoGen

**LangGraph (ecosistema LangChain):** Defines agentes como nodos en una estructura de grafo dirigido. Cada nodo mantiene un "estado", los bordes determinan la lógica de transición. El enrutamiento condicional es posible: si el agente A dice "falta datos", ve al agente B; si está completo, ve a C.

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

**Ventajas:** La gestión de estado es sólida. El rastreo distribuido es fácil —cada nodo tiene logs separados. **Desventajas:** La sintaxis es compleja, las cadenas de *callbacks* dificultan la depuración.

**CrewAI:** Orquestación basada en roles. Asignas a cada agente un "rol" (investigador, analista, redactor), le das una lista de "tareas". El framework ejecuta automáticamente de forma secuencial o se bifurca en paralelo.

```python
from crewai import Crew, Agent, Task

researcher = Agent(role='Data Researcher', tools=[bigquery_tool])
analyst = Agent(role='Analyst', tools=[pandas_tool])

crew = Crew(agents=[researcher, analyst], process="sequential")
result = crew.kickoff()
```

**Ventajas:** Boilerplate mínimo, prototipado rápido. **Desventajas:** Flexibilidad baja —necesitas cambiar código para enrutamiento personalizado.

**AutoGen (Microsoft):** Multi-agente conversacional. Los agentes se "comunican" entre sí, un agente envía un mensaje a otro, ese responde. En este patrón, la orquestación es implícita —el flujo de mensajes define la topología.

```python
from autogen import AssistantAgent, UserProxyAgent

assistant = AssistantAgent("assistant", llm_config={...})
user_proxy = UserProxyAgent("user", code_execution_config={...})

user_proxy.initiate_chat(assistant, message="Analyze Q1 data")
```

**Ventajas:** Natural en escenarios human-in-the-loop. **Desventajas:** Los flujos no son determinísticos —es incierto cuándo el agente A responderá al agente B.

## Topología Paralela vs Serial: Matriz de Tradeoff

| Arquitectura | Latencia | Costo | Complejidad | Caso de Uso |
|--------------|----------|-------|-------------|------------|
| **Serial (Secuencial)** | Alta (N×t) | Bajo (1 LLM por ejecución) | Bajo | Pipelines determinísticos (datos → análisis → informe) |
| **Paralela (Fork-Join)** | Baja (max(t₁, t₂, t₃)) | Alto (N agentes simultáneamente) | Media | Trabajos independientes (consulta 3 API simultáneamente) |
| **Condicional (DAG)** | Variable | Media | Alta | Flujo dinámico (si faltan datos → X, si completo → Y) |
| **Conversacional** | Incierta | Media | Alta | Human-in-the-loop o negociación |

**Decisión en producción:** Si el procesamiento no está en el *critical path* (por ejemplo, generación de informes fuera de línea), elige topología serial —la depuración es fácil, el costo bajo. Si hay un SLA de latencia (por ejemplo, dashboard en tiempo real), bifurca en paralelo —pero construye la lógica de reintentos desde el inicio; si no, 1 agente con timeout detiene a los 3 restantes.

## Coordinación de Uso de Herramientas: Evitar Conflictos

En sistemas multi-agente, el bug más frecuente: 2 agentes invocan la misma herramienta al mismo tiempo con parámetros diferentes, uno corrompe el estado del otro.

**Ejemplo:** El agente A crea `temp_table_x` en BigQuery, el agente B simultáneamente intenta leer `temp_table_x` —error de datos no encontrados. Esta "condición de carrera" se resuelve en la capa de orquestación:

**1. Bloqueo de recursos:** Cuando el agente A comienza a usar una herramienta, el orquestador bloquea esa herramienta para otros agentes. Con LangGraph se hace con `shared_state`.

```python
if not state.lock_acquired("bigquery"):
    return {"status": "waiting"}
state.acquire_lock("bigquery")
result = bigquery_tool.run()
state.release_lock("bigquery")
```

**2. Aislamiento de espacios de nombres:** Proporciona a cada agente su propio espacio de trabajo. El agente A usa `workspace_a/temp_table`, el agente B usa `workspace_b/temp_table`. En CrewAI se hace con prefijos `agent_id`.

**3. Diseño de herramientas idempotentes:** Diseña herramientas idempotentes desde el inicio —invocarlas 2 veces con los mismos parámetros no causa conflictos. Por ejemplo, usa `upsert` en lugar de `create_or_replace`.

## Observabilidad: Cómo Rastrear Agentes

En producción, 5 agentes se ejecutan, uno falla, ¿cuál? Herramientas como LangSmith, Helicone, Arize recopilan rastreos a nivel de agente, pero la instrumentación manual es obligatoria.

**Métricas críticas:**
- **Latencia de agente por paso:** ¿Cuánto tardó cada agente? En un *fork* paralelo, `max(latencia)` muestra el cuello de botella.
- **Tasa de éxito de llamadas de herramientas:** ¿Cuántas veces cada agente invocó cada herramienta, cuántas tuvieron éxito? Por debajo del 95% es una bandera roja.
- **Contador de reintentos:** ¿Cuántas veces reinició un agente? Reintentos altos indican *prompts* defectuosos o especificaciones de herramientas incorrectas.
- **Diagrama de transición de estado:** Para LangGraph, ¿de qué nodo a cuál se transitó cuántas veces? Los bucles infinitos se ven aquí.

```python
# Integración de LangSmith
from langsmith import Client

client = Client()
with client.trace(run_name="multi_agent_pipeline") as run:
    for agent in agents:
        with run.create_child(name=agent.name):
            agent.run()
```

## Gestión de Ventana de Contexto: Memoria Compartida vs Aislada

En multi-agente, el recurso más crítico es la ventana de contexto. ¿Cinco agentes comparten los mismos 128K tokens, o cada uno tiene su propio 128K?

**Memoria compartida (LangGraph por defecto):** Todos los agentes leen y escriben en el mismo objeto de estado. Ventaja: los hallazgos del agente A pasan automáticamente al agente B. Desventaja: contaminación de contexto —datos que el agente C no necesita hinchan la ventana.

**Memoria aislada + paso de mensajes:** Cada agente mantiene su propio estado, solo pasa datos necesarios como mensajes. CrewAI usa este patrón. Ventaja: eficiencia de tokens alta. Desventaja: serialización manual de datos requerida.

**Híbrido (recomendado):** Mantén solo metadatos en estado compartido (qué hizo cada agente, cuándo terminó), almacena datos reales en disco/DB, pasa a los agentes referencias. Por ejemplo, escribe el resultado de BigQuery en GCS, pasa a los agentes la ruta `gs://bucket/result.parquet`.

## Manejo de Errores: ¿Qué Pasa si Cae un Agente?

En topología serial, si cae el agente 2, el pipeline se detiene —simple. En paralelo, si cae el agente B, A y C continúan —pero terminas con datos incompletos. La lógica de "éxito parcial" es obligatoria en la capa de orquestación.

**Estrategias:**

1. **Fail-fast (serial):** El primer error detiene todo el pipeline. Prefiere esto si la latencia no importa.
2. **Best-effort (paralelo):** Ejecuta todos los agentes posibles, genera salida incluso con datos incompletos —pero marca "incomplete" en metadatos.
3. **Reintentar con fallback:** El agente A falló 3 veces, pregunta al agente A_backup (modelo diferente o *prompt* diferente).

```python
# Reintentos en LangGraph
workflow.add_node("agent_a", agent_a, retry_policy={"max_attempts": 3})
workflow.add_edge("agent_a", "agent_a_backup", condition="failed")
```

## Checklist de Producción: Antes de Lanzar Sistema Multi-Agente

- **Calcula presupuesto de tokens:** 5 agentes × 10K tokens entrada × 2K salida × precio de API = costo por ejecución. 1000 ejecuciones/día = ¿cuánto al final del mes?
- **Define SLA de latencia:** ¿Cuánto debe tardar cada agente? Si P95 de latencia > 10 segundos, se necesita topología paralela.
- **Plan de reversión:** Cambiar el *prompt* de un agente puede romper todo el pipeline. Control de versiones + despliegue canario obligatorio.
- **Punto human-in-the-loop:** En decisiones críticas (por ejemplo, ajuste de presupuesto), muestra la salida del agente final a un humano, requiere aprobación.
- **Auditoría:** Cada paso de cada agente —qué herramienta se invocó, qué parámetros, qué devolvió— escribe como JSON a S3. Compliance lo requiere.

La orquestación multi-agente es la "lección de sistemas" de la ingeniería LLM. Empiezas con una llamada a un modelo único, en producción necesitas topología, gestión de estado, lógica de reintentos, observabilidad. LangGraph, CrewAI, AutoGen son esqueletos —el trabajo real es decidir, según tu caso de uso, cómo serializar y paralelizar agentes. Ahora toma tu prototipo, mide latencia, simula costos, luego elige topología. No lances sin probar —en sistemas multi-agente hay 10 capas entre "funciona" y "listo para producción".