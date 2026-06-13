---
title: "Orquestación de Múltiples Agentes: De una Llamada LLM a Sistemas"
description: "SDK de agentes, tool use y topologías paralelas/seriales para llevar aplicaciones LLM a producción. Trade-offs de costo de tokens, latencia y aislamiento de errores."
publishedAt: 2026-06-13
modifiedAt: 2026-06-13
category: ai
i18nKey: ai-008-2026-06
tags: [multi-agent, llm-orchestration, tool-use, agent-sdk, production-ai]
readingTime: 9
author: Roibase
---

Hace unos meses, un único prompt LLM era suficiente. Ahora, los sistemas en producción requieren topologías de agentes paralelos, salida estructurada y cadenas de fallback. El Computer Use de Anthropic, function calling de OpenAI y soporte de state machine de LangGraph han elevado la orquestación de agentes al nivel de framework. La arquitectura multi-agente ya no es solo investigación, sino herramienta diaria de equipos de crecimiento. Reducir el costo de tokens, controlar la latencia y lograr aislamiento de errores hace que la transición de una llamada single-agent a sistemas orquestados sea obligatoria.

## SDK de Agentes y Protocolo de Tool Use

El esquema JSON de function calling de OpenAI se estandarizó en 2023. Anthropic expandió tool use con Claude 3.5: la respuesta de la API ahora devuelve un bloque `tool_use`, tú lo ejecutas y lo devuelves como `tool_result`. Este bucle puede continuar 20+ iteraciones, pero el límite de tokens te detiene. La sintaxis de function declarations de Gemini es similar; la diferencia está en grounding y extensiones de retrieval. Los tres proveedores comparten el mismo patrón: el modelo recibe el descriptor de función, devuelve el nombre de la función + argumentos, la ejecución es responsabilidad del usuario.

Los SDK de agentes abstraen este bucle. `AgentExecutor` de LangChain, `ReActAgent` de LlamaIndex, el engine central de AutoGPT — todos resuelven el mismo problema: gestionar la secuencia de tool calls. Pero las abstracciones generan overhead de tokens. Por ejemplo, LangChain envía el historial de conversación como prefijo en cada iteración. 10 tool calls = 10× context window. Para reducirlo necesitas un agente de summarización o selective context pruning. En producción, sin una capa de observability como LangSmith, el debugging es imposible.

El protocolo de tool use no es determinístico — el modelo a veces alucina, proporciona argumentos de función incorrectos. Por eso una capa de validación es obligatoria: valida la entrada con esquema Pydantic, captura excepciones en runtime, devuelve mensaje de error al modelo. En LangChain, `PydanticOutputParser`; en Anthropic, el parámetro `tool_choice="required"` reduce este riesgo. Pero el verdadero problema es: el modelo no siempre elige la herramienta correcta. Con 3-4 herramientas similares, la mala selección ocurre entre 8-12% de las veces. En ese caso, agregas retry logic o un agente enrutador.

## Topología de Agentes: Paralela vs Serial

¿Por qué dos agentes harían lo que uno no puede? Porque la **especialización** mejora la eficiencia de tokens. Escenario ejemplo: buzón de entrada → categorizar → redactar respuesta → obtener aprobación. Un prompt monolítico usa 8K tokens de contexto, repite la misma instrucción para cada correo. Divídelo en 3 agentes: **classifier** (categoriza), **drafter** (redacta respuesta), **validator** (lógica de aprobación). Cada uno tiene su propio prompt pequeño. Token total: 8K → 2K+2K+1.5K = 5.5K. Reducción de 31%.

La topología paralela ofrece otra ventaja: **reducción de latencia**. Ejemplo: pipeline de generación de contenido — un agente analiza palabras clave SEO, otro parsea guía de tono y estilo, un tercero extrae contenido competidor. Si lo ejecutas en serie, latencia = 3×. Si lo ejecutas en paralelo (con `StateGraph` y nodo `map` de LangGraph), latencia máxima = tiempo del agente más lento. Pero la coordinación se complica. ¿Cuya salida tiene prioridad? ¿Quién decide si hay conflicto? Por eso necesitas un **agente árbitro** — capa meta que toma la decisión final de los resultados paralelos.

La topología serial proporciona aislamiento de errores. Si el agente A falla, B y C no se ejecutan. Puedes construir cadenas de fallback: si A falla, pasar a A2. En paralelo, hay escenarios de partial failure: 2 de 3 agentes tienen éxito, uno timeout. ¿Cómo continúa el sistema? Necesitas lógica de state machine. En LangGraph, usan `conditional_edges` para enrutamiento: si el agente tiene éxito "next", si falla "retry" o "fallback".

### Guía de Selección de Topología

| Escenario | Topología | Razón |
|-----------|-----------|-------|
| Dependencia secuencial (salida de A es entrada de B) | Serial | Overhead de coordinación en paralelo |
| Subtareas independientes | Paralela | Reducción de latencia |
| Alto riesgo de fallo | Serial + fallback | Aislamiento de errores |
| Costo de tokens crítico | Híbrida (fetch paralelo, proceso serial) | Recopilación de datos sin compartir contexto |

## Gestión de Estado y Pruning de Contexto

El problema más crítico de sistemas multi-agente: **context bloat**. Cada agente mantiene el historial de conversación, context window crece en cada iteración. 10 agentes × 5 iteraciones = 50 mensajes. Incluso el context window de 200K de Claude puede saturarse. Resultado: latencia sube (costo computacional de tokens es O(n²)), costo aumenta, algunos modelos timeout.

Solución: **orquestación stateful** y **memoria selectiva**. La característica `checkpointing` de LangGraph escribe estado en almacenamiento externo (Redis, PostgreSQL). Cada agente lee solo el contexto relevante. Ejemplo: el agente drafter ve la salida del classifier, pero no ve el historial previo de aprobaciones del validator — a menos que sea necesario.

Otro patrón: **agente de summarización**. Se activa cada N iteraciones, reduce la conversación a 3-4 oraciones. El `ConversationSummaryMemory` de LangChain hace esto, pero cuidado: la summarización en sí requiere una llamada LLM, costo adicional. Por eso el threshold de trigger debe ajustarse bien. En nuestro pipeline de producción ejecutamos 1 summarización cada 12 iteraciones — mantiene 200 tokens en contexto en lugar de 50, ahorro de 75%.

Pruning de contexto es otra opción: elimina mensajes irrelevantes. Ejemplo: la salida del agente classifier es solo la etiqueta de categoría, pero el modelo devuelve toda la cadena de razonamiento. Al enviar al drafter, cortas el razonamiento y dejas solo la etiqueta. En LangChain, con `MessagesPlaceholder` + función filter personalizada. Es trabajo manual, pero reduce tokens 40-50%.

## Fiabilidad y Observability en Producción

Sistema multi-agente = N× superficie de fallo. Un agente timeout, otro rate limit, un tercero alucina. Gestionar este caos requiere **circuit breaker** y **retry logic** obligatoria. LangChain tiene wrapper `RunnableRetry`, pero si quieres control granular, la librería Tenacity es más flexible: backoff exponencial, jitter, máximo de intentos.

Sin observability no puedes debuguear. LangSmith, LangGraph Studio, Weights & Biases visualizan el trace del agente: qué agente se llamó cuándo, qué devolvió, cuántos tokens gastó. En nuestro stack usamos LangSmith + exporter Prometheus personalizado: mostramos métricas de latencia de agentes, conteo de tokens, tasa de error en Grafana. Umbral de alerta: P95 latencia >3s o tasa de error >5%.

Otro problema de producción: **no-determinismo**. Misma entrada, salida diferente — porque el modelo es estocástico. Incluso con temperature=0, hay variación según la infraestructura del proveedor. Por eso necesitas un pipeline de entrada confiable como la [arquitectura de datos first-party](https://www.roibase.com.tr/es/firstparty): si entra datos estructurados, la salida es más consistente. Además, necesitas framework de evaluación: en cada deploy, ejecuta tests de regresión, mide calidad de salida. Usa `EvaluatorChain` de LangChain o evaluación basada en modelos de Anthropic.

## Optimización de Costo y Trade-offs

Sistema multi-agente es caro. Una llamada single-agent = 2K tokens = $0.006 (con precios de Claude Sonnet 3.5). Misma tarea con 3 agentes: 3× llamadas API, total 6K tokens, $0.018. 3× costo. Los escenarios que justifican esto: acortar contexto largo (doc grande → chunk → proceso paralelo), especialización (cada agente usa modelo pequeño, total barato), aislamiento de errores (riesgo alto de fallo monolítico).

Formas de reducir costo de tokens: **model distillation** (modelo grande fine-tunea modelo pequeño, luego pequeño en producción), **caching** (misma entrada = respuesta en caché — prompt caching de Anthropic da descuento de 90%), **batch processing** (async en lugar de real-time, prefiere modelo barato).

Trade-off latencia vs costo: topología paralela baja latencia pero sube costo. Puedes ejecutar paralela en critical path, serial en non-crítico. Ejemplo: user query → classifier paralelo (respuesta rápida), pero agente de reportes serial (background job). Este enfoque híbrido mantiene latencia P95 <2s mientras reduce costo 35%.

## Ejemplos de Orquestación y Código

Cadena serial simple (LangChain):

```python
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain_anthropic import ChatAnthropic

classifier = LLMChain(
    llm=ChatAnthropic(model="claude-3-5-sonnet"),
    prompt=PromptTemplate.from_template("Categoriza: {text}")
)

drafter = LLMChain(
    llm=ChatAnthropic(model="claude-3-5-sonnet"),
    prompt=PromptTemplate.from_template("Redacta respuesta: {category}, {text}")
)

category = classifier.run(text=user_input)
response = drafter.run(category=category, text=user_input)
```

Ejecución paralela (LangGraph):

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

Este código ejecuta 2 agentes en paralelo, pasa el resultado al agente merge. LangGraph gestiona estado automáticamente, escribe checkpoints en Redis.

Orquestación multi-agente no es fin en sí mismo, es medio. Si automatizas otro canal de crecimiento o construyes pipeline de decisiones, elige topología de agentes, pero aclara métricas: tokens/tarea, latencia, tasa de error. El éxito en producción se mide por uptime de 95% y costo de tokens dentro de presupuesto. Si construyes sistema multi-agente para generación de contenido, integra con estrategia de [Optimización de Motor Generativo](https://www.roibase.com.tr/es/geo) — agentes recopilan datos de citas, alimentan métricas GEO, ROI es medible. Caso contrario, solo es wrapper API complejo.