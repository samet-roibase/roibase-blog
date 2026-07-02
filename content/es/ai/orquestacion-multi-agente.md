---
title: "Orquestación Multi-Agente: De una Llamada LLM a Sistemas"
description: "Cómo integrar LLMs en procesos empresariales con SDK de agentes, tool use y topologías paralelas/seriales. Trade-offs de producción y arquitecturas de orquestación."
publishedAt: 2026-07-02
modifiedAt: 2026-07-02
category: ai
i18nKey: ai-008-2026-07
tags: [multi-agente, orquestacion-llm, agent-sdk, tool-use, infraestructura-ia]
readingTime: 9
author: Roibase
---

La fase proof-of-concept de hacer una sola llamada a la API de LLM y recibir una respuesta terminó en 2023. En 2026, las empresas que llevan LLMs a producción se enfrentan a lo que llamamos "orquestación de agentes": sistemas con múltiples modelos, cada uno con acceso a diferentes herramientas, que pueden ejecutarse en paralelo o en serie, observables y reproducibles. En este artículo veremos qué decisiones tomar al construir una arquitectura multi-agente, qué prometen realmente los SDK y qué trade-offs tienen las topologías de orquestación.

## Lo que Prometen los SDK de Agentes (y lo que Entregan)

Frameworks como LangChain, CrewAI, Semantic Kernel y LlamaIndex se comercializan como "SDK de agentes". Su promesa común: autoriza al LLM a usar herramientas, establece jerarquías de decisión, gestiona cadenas. ¿Son suficientes estas herramientas en la práctica?

El primer problema: **overhead de abstracción**. Librerías de alto nivel como LangChain facilitan el binding de herramientas, pero complican el debugging. En producción, cuando una llamada a herramienta falla, necesitas decodificar si fue el estado interno de LangChain o la respuesta de la API. Si tienes soporte nativo de herramientas como la API Computer Use de Anthropic, usar el SDK directamente generalmente ofrece mejor visibilidad.

El segundo problema: **versionado**. Los SDK de agentes iteran rápido; los cambios disruptivos aparecen frecuentemente. Por ejemplo, la transición de LangChain 0.1 → 0.2 deprecó algunas estructuras de cadenas. En lugar de esperar parches usando una versión fija en producción, a veces es más mantenible escribir tu propia lógica de tool use, especialmente si tu capa de orquestación tiene lógica empresarial personalizada que no encaja en la estructura opinada del SDK.

El tercer beneficio: **observabilidad integrada**. Complementos como LangSmith y la suite de evaluación de LlamaIndex visualizan la cadena de llamadas. Esto es crítico para debugging en producción — qué agente llamó a qué herramienta, dónde se concentró la latencia, qué token gastó cada prompt. Si escribiste tu propia orquestación, también debes construir esta telemetría. Los SDK ahorran tiempo aquí, pero conllevan riesgo de bloqueo.

## Tool Use: Más Allá del Function Calling

Lo que llamamos tool use es que el LLM produzca salida estructurada para hacer solicitudes a APIs externas. OpenAI function calling, tool use de Anthropic, function calling de Google — todos implementan el mismo principio con formatos de esquema diferentes. La parte interesante es cuando las herramientas son **interdependientes**.

Ejemplo simple: un agente de automatización de campañas de email. Primera herramienta: `list_segments` (obtiene lista de segmentos de CRM). Segunda: `get_segment_stats` (devuelve métricas para un segmento). Tercera: `create_campaign` (crea objeto de campaña). Debes ejecutar estas tres herramientas **en serie** porque la salida de cada una es entrada para la siguiente.

Ejemplo complejo: un agente de análisis de datos. Las herramientas `query_bigquery`, `fetch_gsc_data`, `fetch_ga4_events` pueden ejecutarse **en paralelo** porque son independientes entre sí. La ejecución paralela reduce la latencia de producción, pero el orquestador debe gestionar límites de concurrencia y rate limits. El SDK de Anthropic puede hacer llamadas a herramientas en paralelo, pero el function calling de OpenAI es secuencial (a partir de Q2 2026). En ese caso, escribes el orquestador tú mismo.

Un trade-off crítico en tool use: **determinismo vs. flexibilidad**. Si le dices al LLM "elige una de estas tres herramientas", puede elegir una diferente en cada ejecución. Si codificas la secuencia de herramientas, pierdes flexibilidad pero ganas reproducibilidad. En producción, generalmente es **híbrido**: codifica el camino crítico, deja las decisiones opcionales para el LLM.

### Ejemplo de Cadena de Llamadas de Herramientas

```python
# Cadena de herramientas en serie (cada paso es entrada para el siguiente)
def orchestrate_campaign(prompt: str, client: AnthropicClient):
    # 1. Listar segmentos
    segments = client.tool_use("list_segments", {})
    
    # 2. Stats para cada segmento (lote paralelo)
    stats_calls = [
        client.tool_use("get_segment_stats", {"segment_id": s})
        for s in segments["ids"]
    ]
    stats = asyncio.gather(*stats_calls)
    
    # 3. Campaña para segmento con mayor engagement
    best_segment = max(stats, key=lambda x: x["engagement"])
    campaign = client.tool_use("create_campaign", {
        "segment_id": best_segment["id"],
        "message": prompt
    })
    return campaign
```

En este ejemplo hay una estructura `list_segments` → `get_segment_stats` (paralelo) → `create_campaign` (serie). El LLM solo entra en juego en la generación de mensaje final. Esta es una arquitectura **semi-autónoma** donde el orquestador gestiona la lógica de las llamadas a herramientas.

## Topología de Agentes: Paralela vs. Serie

En sistemas multi-agente, hay dos topologías fundamentales: **paralela** (múltiples agentes se ejecutan simultáneamente, sus salidas se combinan) y **serie** (cada agente produce la entrada del siguiente).

La topología **paralela** generalmente se usa para **especialización**. Ejemplo: un pipeline de generación de contenido. El Agente A escribe el titular, el Agente B genera párrafos de cuerpo, el Agente C optimiza la meta descripción SEO. Los tres reciben el mismo brief como entrada, sus salidas se fusionan. La ventaja: cada agente se especializa en su dominio, los prompts son cortos, el costo de tokens baja (no se comparte ventana de contexto). La desventaja: overhead de coordinación. La lógica de fusión es tu responsabilidad — si las salidas son incompatibles, necesitas reconciliación manual.

La topología **serie** se usa para **refinamiento** o **validación**. El Agente A produce un borrador, el Agente B verifica hechos, el Agente C ajusta el tono. Cada agente toma la salida del anterior. La ventaja: cada etapa mejora la anterior, la estructura de razonamiento lineal es fácil de depurar. La desventaja: latencia — cada agente debe esperar en la secuencia. El tiempo total es N × latencia promedio del agente.

En Roibase, en operaciones de marketing usamos un modelo híbrido: en procesos de **[Optimización de Contenido Generado](https://www.roibase.com.tr/es/geo)**, agentes en paralelo extraen citaciones de diferentes motores de búsqueda (ChatGPT, Perplexity, Gemini), y una cadena de agentes en serie coincide estas citaciones con patrones de mención de marca. La parte paralela acelera la recopilación de datos, la parte serie proporciona profundidad analítica.

### Comparación de Topologías

| Arquitectura | Latencia | Especialización | Debugging | Caso de Uso |
|---|---|---|---|---|
| Paralela | Baja (max de agente) | Alta | Lógica de fusión compleja | Recopilación de datos, análisis multi-fuente |
| Serie | Alta (suma de agentes) | Baja | Traza lineal | Refinamiento, validación, razonamiento multi-paso |
| Híbrida | Media | Alta | Compleja | Pipelines de producción |

## Estado de Orquestación y Reproducibilidad

Cuando construyes un sistema multi-agente, la decisión más crítica es: **¿dónde mantendrás el estado?** Hay tres opciones.

**Orquestación sin estado (Stateless):** Cada agente es independiente; el orquestador mantiene salidas intermedias en memoria. Ventaja: fácil de reproducir, escalado horizontal posible. Desventaja: presión de memoria — en cadenas largas mantienes GBs de historial de conversación.

**Orquestación con estado (Stateful):** Almacenas el estado intermedio en un store externo (Redis, PostgreSQL). Ventaja: bajo uso de memoria, recuperación ante fallos posible. Desventaja: overhead de I/O, se requieren garantías de consistencia.

**Híbrida (Checkpointing):** Persistes el estado en milestones específicos. Por ejemplo, cada 5 llamadas de agentes haces un checkpoint. Si hay un fallo, reanudas desde el último checkpoint. Ventaja: equilibrio entre rendimiento y confiabilidad. Desventaja: implementación compleja.

En producción, un patrón común es escribir el estado de orquestación a un stream de logs. Cada llamada de agente se registra como log estructurado en BigQuery; para reproducir, usas event sourcing. Así puedes analizar retrospectivamente la cadena de atribución — qué salida de agente afectó qué métrica downstream.

## Eval y Observabilidad: Depuración de Orquestación

En un sistema multi-agente, el debugging es difícil porque hay muchos puntos de fallo. ¿Eligió el Agente A la herramienta incorrecta? ¿Parseó mal el Agente B la entrada? ¿La lógica de fusión del orquestador es defectuosa? Se requiere una **stack de observabilidad**.

Las métricas que necesitas:

- **Latencia a nivel de agente** (p50, p95, p99) — ¿qué agente es el cuello de botella?
- **Tasa de éxito de herramientas** — ¿qué llamada a API falla frecuentemente?
- **Uso de tokens por agente** — atribución de costos
- **Puntuación de evaluación** — usa LLM-as-judge para calificar cada salida de agente de 0-1

Para la evaluación, usamos un patrón: **puntuación sin referencia**. Un LLM "supervisor" (ej. GPT-4) evalúa cada salida de agente con puntuaciones de "finalización de tarea" y "alucinación". Estas puntuaciones se almacenan como series de tiempo; se detectan regresiones. Por ejemplo, si la puntuación de alucinación del Agente A sube de 0.1 a 0.3, reviertse la versión del prompt.

Otra técnica que Anthropic recomienda: **Claude como evaluador**. Gracias a su larga ventana de contexto, alimenta toda la cadena de agentes a Claude en un único prompt, pregunta "¿hay errores de lógica en esta cadena?" Este meta-eval se usa en procesos de QA previos a producción.

## Trade-offs de Orquestación y Matriz de Decisión

Al elegir tu arquitectura multi-agente, consideras estos trade-offs:

**1. Complejidad vs. control:** Usar un SDK acelera la implementación pero opacan el debugging. Escribir un orquestador personalizado da control pero aumenta la carga de mantenimiento.

**2. Latencia vs. especialización:** Los agentes paralelos son rápidos pero tienen overhead de coordinación. Los agentes en serie tienen razonamiento más profundo pero son lentos.

**3. Costo vs. calidad:** Cada llamada de agente gasta tokens. Aumentar el número de agentes puede mejorar la calidad pero el costo crece linealmente. En producción, debes encontrar el "minimum viable agent count".

**4. Determinismo vs. adaptabilidad:** Las secuencias de herramientas codificadas son reproducibles pero no manejan edge cases. Dejar que el LLM elija herramientas es adaptativo pero no determinista.

La matriz de decisión que usamos en Roibase:

| Caso de Uso | Topología | SDK | Gestión de Estado |
|---|---|---|---|
| Recopilación de datos | Paralela | LlamaIndex | Sin estado |
| Refinamiento de contenido | Serie | Personalizado | Checkpointing |
| Inferencia en tiempo real | Híbrida | SDK de Anthropic | Cache Redis |
| Procesamiento por lotes | Paralela | LangChain | PostgreSQL |

## Trasladando la Orquestación a Producción

Cuando llevas un sistema multi-agente a producción, presta atención a tres cosas.

**Rate limiting:** Los agentes paralelos pueden exceder el límite de rate de la API. En el orquestador, usa patrón token bucket o semáforo. Si la API de Anthropic tiene límite de 50 req/min, acelera el número de agentes paralelos en consecuencia.

**Estrategia de fallback:** ¿Qué haces si un agente falla? La lógica de reintentos es simple pero añade exponential backoff + jitter. Si un agente no es crítico (ej. generador opcional de meta tags SEO), usa circuit breaker y pasa a modo fail-safe.

**Monitoreo de costos:** Registra el costo de tokens de cada llamada de agente. En producción, rastrea métrica de $/request por agente. Si un agente genera un spike de costos, optimiza el prompt o desactívalo.

La potencia de la orquestación multi-agente no es "hacer más que un único LLM", sino **hacer que los procesos empresariales sean modulares, observables y escalables**. Para mantener estas arquitecturas en producción, debes pensar conjuntamente en topología de herramientas, gestión de estado y pipeline de evaluación. Al construir estos sistemas, la capacidad de **[Análisis de Datos e Ingeniería de Insights](https://www.roibase.com.tr/es/verianalizi)** es crítica para vincular las métricas de orquestación con las métricas empresariales — necesitas medir retrospectivamente qué configuración de agente incrementó qué KPI downstream.