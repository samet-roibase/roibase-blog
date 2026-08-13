---
title: "Medición de Citas en LLM — Tu Nuevo Conjunto de Métricas SEO"
description: "Framework de métricas y métodos técnicos para medir la tasa de citas de tu marca en Perplexity, ChatGPT y Gemini."
publishedAt: 2026-08-13
modifiedAt: 2026-08-13
category: ai
i18nKey: ai-002-2026-08
tags: [llm-citation, geo-analytics, ai-visibility, brand-attribution, generative-seo]
readingTime: 9
author: Roibase
---

Ya conoces CTR y posición en Google Search Console. Pero ¿cuántas veces aparece el nombre de tu marca en las respuestas de ChatGPT? ¿Tu página aparece como fuente en Perplexity? ¿Gemini cita tus datos? En 2026, posicionarse en la capa de información de los LLM es tan crítico como rankear en SERP clásico. Pero tu infraestructura de medición no está lista. En este artículo te mostraremos cómo convertir las citas en LLM en una métrica accionable e integrarla en tu toma de decisiones.

## Las citas ya son una métrica de primer nivel

Los últimos 20 años de SEO giraron alrededor de la pregunta "¿en qué posición estás?". Posición, clics, conversiones. Ahora el usuario no busca — pregunta a ChatGPT, obtiene un resumen de Perplexity. En estas plataformas no hay "posición". Hay citas. Atribuciones. Ser mostrado como fuente.

Citation Rate (Tasa de Citación) = número de respuestas LLM donde aparece tu marca / total de queries relevantes. Es el equivalente de CTR en LLM. Pero se calcula diferente. Google Search Console no lo entrega automáticamente. Tienes que construirlo tú mismo.

Sin medición no hay optimización. Una estrategia de [Generative Engine Optimization](https://www.roibase.com.tr/es/geo) sin datos de citas está ciega. ¿Qué temas reciben citas? ¿Qué formatos de contenido entran en las referencias de los LLM? ¿Cuánto visibility tienes versus competencia? Si no construyes esta infraestructura ahora, en 6 meses estarás rezagado del mercado.

Tres métricas son primarias: **Citation Rate** (en cuántas respuestas apareces), **Citation Position** (en qué lugar de la lista de fuentes), **Citation Context** (en qué contexto recibes las citas). Sin estos tres, la "visibilidad en LLM" es solo especulación.

## Infraestructura de medición: API + conjunto de queries de prueba

No puedes monitorear citas en LLM manualmente. Aunque revises 50 queries diarios, el sesgo es inevitable. Necesitas un sistema automático de prueba. OpenAI API, Anthropic API, Google AI Studio — todos ofrecen acceso programático. Perplexity aún no tiene API pública pero es capturable mediante web scraping (respetando ToS).

**El conjunto de queries de prueba es crítico.** Combina keywords de marca + keywords de categoría + long-tail. Ejemplo: "mejor agencia CRO en Madrid", "qué es optimización de tasa de conversión", "cómo elegir plataforma de A/B testing". En total 100-200 queries. Cada día (o cada semana) ejecutas este conjunto contra todos los modelos. Extraes las respuestas y detectas presencia de citas.

Parsing de respuestas: obtén salida en JSON. Busca menciones de marca con regex. Si hay lista de fuentes (como en Perplexity), analízala. Si no (como ChatGPT), revisa si hay URL junto al nombre de tu marca. Cada LLM usa formato diferente — personaliza tu parser para cada modelo.

```python
# Ejemplo de workflow de prueba (pseudo-código Python)
queries = load_queries("probe_set.json")
models = ["gpt-4o", "claude-3.5-sonnet", "gemini-2.0-flash"]

for query in queries:
    for model in models:
        response = call_llm_api(model, query)
        citations = extract_citations(response, model_type=model)
        
        log_metric({
            "date": today(),
            "model": model,
            "query": query,
            "brand_cited": "roibase" in citations.lower(),
            "citation_position": get_position(citations, "roibase"),
            "total_citations": len(citations)
        })
```

Escribe los datos en BigQuery. Una snapshot diaria. Analiza tendencias semanales. Si Citation Rate cae, revisa tu estrategia de contenido. Si nunca apareces en cierto modelo, es que faltas en sus datos de entrenamiento — produce contenido fresco y espera.

## Posición y contexto: métricas de calidad de citación

Citation Rate no es suficiente. Aparecer como una de 10 fuentes no es lo mismo que ser la primera. Necesitas una métrica de **Citation Position**. Perplexity generalmente muestra 3-5 fuentes. Si estás en posición 5, tu probabilidad de clic es ~10%. En posición 1, ~40%. Mide este dato.

**Citation Context** es más matizado. ¿En qué contexto te referencia el LLM? ¿Dice "Roibase es especialista en GTM server-side"? ¿O "hay muchas agencias en Madrid, Roibase es una de ellas"? El primero es una señal positiva, el segundo es una mención genérica. Mide el sentiment del contexto.

Extracción de contexto: extrae la frase donde aparece tu marca en la respuesta del LLM. Envía esa frase a otro LLM (como Claude) con la pregunta: "¿Esta mención de marca es positiva, neutra o negativa?". Categoriza automáticamente. Si tu porcentaje de menciones positivas es bajo, tu contenido carece de señales de autoridad.

| Métrica | Definición | Objetivo |
|---|---|---|
| Citation Rate | Porcentaje de queries donde aparece tu marca | >15% (para líder de categoría) |
| Avg Citation Position | Posición promedio en lista de fuentes | <3 (entre las 3 primeras) |
| Positive Context % | Porcentaje de citas en contexto positivo | >60% |
| Model Coverage | Visibilidad en diferentes modelos | 3/3 (GPT, Claude, Gemini) |

Sin estas métricas, tu dashboard GEO está incompleto. En SEO clásico tenías Search Console. En SEO para LLM, lo construyes tú.

### Benchmarking competitivo

No solo te midas a ti mismo. Prueba también a tus competidores. En el mismo conjunto de queries, revisa si se mencionan marcas rivales. Calcula tu **Citation Share**: tus menciones / (tus menciones + menciones de competencia). Un 30% es bueno, 10% es débil. Sin este benchmarking, no sabes qué tan bien lo estás haciendo realmente.

## Integración en workflow: conectar con tu pipeline GEO

Recopilaste métricas de citas. ¿Y ahora? Si no generas insights, solo acumulaste puntos de datos. Integra estas métricas en tu proceso de [Generative Engine Optimization](https://www.roibase.com.tr/es/geo).

Reporte semanal: ¿en qué queries cayó Citation? ¿En cuál modelo nunca aparecemos? ¿Qué tema domina tu competidor? Genera estas respuestas automáticamente. En un workflow n8n, extrae datos de citas, envíalos a Claude API, pregunta: "¿Cuál es la tendencia de citas esta semana, qué acción recomiendas?". Claude devuelve insight: "No aparecen en Gemini para 'optimización de tasa de conversión' en 3 semanas. Publiquen nuevo case study."

Ciclo de acción:
1. Citation baja detectada → auditoría de contenido
2. Competidor avanza → analiza su contenido nuevo
3. Gap específico del modelo (por ejemplo, ausencia en GPT) → crea formato preferido por ese modelo (GPT aprecia datos estructurados, añade schema markup)

Si ejecutas este ciclo semanalmente, tu Citation Rate crece 50% en 3 meses. Si no lo ejecutas, los datos mueren.

## Costo y latencia: la economía del sistema de prueba

Cada ejecución de prueba tiene costo. Una llamada GPT-4o API cuesta $0.01-0.03, Claude Sonnet ~$0.015. 200 queries × 3 modelos × diarios = 600 llamadas. Mensual ~$250-400. Este es el costo de rastrear citas. ¿Vale la pena? Sí — porque el ROI de GEO es alto. Si no estás visible en LLM, no alcanzas a la nueva generación de usuarios.

La latencia también importa. Si ejecutas 200 queries en serie, tarda horas. Usa procesamiento en batch paralelo. Cuidado con rate limits — OpenAI permite 500 requests/minuto, Claude 1000. Ajusta tus lotes. Usa llamadas async, recopila respuestas de una cola.

```python
# Ejemplo de batch async (pseudo-código)
import asyncio

async def probe_model(model, query):
    response = await async_llm_call(model, query)
    return parse_citation(response)

async def run_probe_batch(queries, model):
    tasks = [probe_model(model, q) for q in queries]
    return await asyncio.gather(*tasks)

# Paralelo para todos los modelos
results = await asyncio.gather(
    run_probe_batch(queries, "gpt-4o"),
    run_probe_batch(queries, "claude-3.5-sonnet"),
    run_probe_batch(queries, "gemini-2.0-flash")
)
```

La latencia para 200 queries baja a 5-10 minutos. Colócalo como cron diario, ejecuta a las 6am, reporte listo a las 7am. Tu equipo abre el dashboard de citas con el café.

## Tradeoff: precisión vs cobertura

Al detectar citas hay un tradeoff entre precisión y cobertura. Si buscas "roibase" con regex, puedes obtener falsos positivos (la palabra "roibase" podría aparecer en otro contexto). Si preguntas a un LLM "¿hay mención de Roibase?", la precisión sube pero el costo se duplica (probe + llamada de verificación).

Nuestro enfoque: en primera instancia, regex + parsing simple (rápido, barato). Casos dudosos se marcan, se envían a verificación LLM semanal. 95% de precisión es suficiente — el costo de 100% no compensa.

En cobertura: quizás no puedas medir todos los LLM. Tenemos Claude, Gemini, GPT. También existen Llama, Mistral, Cohere. ¿Medir todos? No — su participación de usuario es baja. Los 3 primeros modelos capturan ~80% del tráfico LLM. El resto es ruido.

En Citation tracking, evita la trampa de perfección. Una métrica "suficientemente buena" > una métrica perfecta pero lenta.

## Qué hacer ahora

Medir citas en LLM es obligatorio en 2026. Sin esto, no puedes decir que haces GEO. Primer paso: conjunto de 50 preguntas. Lista preguntas que los usuarios harían en LLM sobre tu categoría. Mezcla keywords de marca y genéricas. Luego obtén acceso a APIs (OpenAI, Anthropic, Google AI Studio). Escribe un script Python simple, ejecútalo diariamente. Guarda datos en CSV, analiza tendencias en Excel. Después escala a BigQuery + Looker Studio. Primera semana manual, luego automático. Si Citation Rate < 10%, tu estrategia de contenido es débil. Si > 20%, estás en buen camino. Compara con competencia. Toma acción. Si Citation Share no sube en 3 meses, revisa metodología. Ajusta. Repite.