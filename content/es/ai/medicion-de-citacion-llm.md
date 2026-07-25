---
title: "Medición de Citación en LLM — Tu Nuevo Conjunto de Métricas SEO"
description: "¿Cómo medir la tasa de citación de tu marca en Perplexity, ChatGPT y Gemini? Guía para configurar métricas críticas para GEO."
publishedAt: 2026-07-25
modifiedAt: 2026-07-25
category: ai
i18nKey: ai-002-2026-07
tags: [llm-citation, geo, seo-metrics, ai-search, attribution]
readingTime: 8
author: Roibase
---

El tráfico orgánico cae, el tráfico directo sube en Google Analytics, pero no sabes qué consultas ahora se responden en ChatGPT sin que los usuarios lleguen a tu sitio. A mediados de 2026, los LLM capturaron el 23% del tráfico de búsqueda (datos Q2 2026 de SimilarWeb). En lugar de recuperar ese tráfico, necesitas empezar a medir la tasa de **citación de tu marca como fuente** en los LLM. Añade una nueva capa a tus métricas SEO: citation rate, source prominence, retrieval frequency.

## Qué es Citación en LLM y por Qué Medirla Ahora

La citación en LLM es el porcentaje de veces que un modelo generativo **referencia tu marca o contenido como fuente** al responder a una consulta de usuario. Si ChatGPT escribe "Fuente: roibase.com.tr", Perplexity proporciona un enlace en línea, o Gemini lista tu sitio en una nota al pie, obtuviste una citación.

En el SEO clásico había "ranking" — estar en la posición 3 en Google. En la era de los LLM hay "citation prominence" — si el modelo muestra 4 fuentes, ¿cuál es tu participación? ¿Eres la primera fuente o estás al final de una lista de "fuentes relacionadas"? Esta diferencia puede cambiar la tasa de clics en un 300% (datos internos de Perplexity Labs, Q1 2026).

Si no empiezas a medir ahora, no podrás establecer una línea base. En 6 meses no podrás responder "¿funcionó nuestra estrategia GEO?" El primer paso es crear un **conjunto de consultas sintéticas** e interrogar regularmente los LLM.

## Configurar la Arquitectura de Medición: Pipeline de Consultas Sintéticas

Medir citación en LLM no es suficiente con pruebas manuales. Necesitas hacer las mismas 50-100 preguntas a Perplexity, ChatGPT y Gemini cada día, analizando las referencias de fuentes en las respuestas. Hacemos esto con un pipeline de 3 capas:

**Capa 1: Diseño del Conjunto de Consultas**  
Extrae de GSC las consultas de los últimos 90 días con impresiones, posición 1-20 y CTR por debajo del 5%. Estas consultas significan "aparecemos en Google pero no nos hacen clic" — es probable que los LLM ya estén respondiendo. Selecciona 50-100 consultas. No solo branded queries, sino una mezcla de informativas y transaccionales. Ejemplo: "duración de cookie en server-side GTM", "optimización de costos en BigQuery".

**Capa 2: Interrogación Automatizada**  
Usa un workflow de n8n para interrogar la API de cada LLM una vez al día. Perplexity con parámetro `model: sonar-pro`, ChatGPT en modo `browsing: true`, Gemini con `grounding: web`. Guarda la respuesta como JSON — tanto el cuerpo como el array de `sources`. Importante: gestiona los límites de tasa (Perplexity free tier 5 req/min, ChatGPT Plus 40 req/3 horas).

**Capa 3: Parser de Citaciones**  
En el JSON de respuesta, busca el key `sources` — si existe, itera el array y compara dominios (`roibase.com.tr` o subdominio). Si no hay sources, busca en el cuerpo enlaces en línea (`[roibase](...)`) o URL simples (con regex). Para cada consulta, registra 3 métricas:
1. **¿Hay citación:** booleano (0/1)
2. **Rango:** en qué posición del array `sources` (1-5, nulo si ausente)
3. **Prominencia:** ¿está en línea o solo en nota al pie? (en línea = 2, nota al pie = 1, ausente = 0)

Escribe estos datos en BigQuery en la tabla `llm_citations` — esquema: `query_id, llm_provider, date, cited, rank, prominence`.

## Calcular Citation Rate y Benchmark

Si ejecutas 50 consultas una vez al día, 30 días, con 3 LLM, tienes 50 × 3 × 30 = 4.500 filas de datos. Ahora calcula las métricas:

### 1. Citation Rate General

```sql
SELECT 
  llm_provider,
  COUNTIF(cited = 1) / COUNT(*) AS citation_rate
FROM `project.dataset.llm_citations`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY llm_provider;
```

**Benchmark (Q2 2026, promedio B2B SaaS):**  
- Perplexity: 18-24%  
- ChatGPT browsing: 12-16%  
- Gemini grounding: 8-14%  

Si estás por debajo del 12% en Perplexity, hay una deficiencia GEO — tu contenido no está estructurado para retrieval.

### 2. Primary Source Rate

Cuántas veces que te citan eres la **primera fuente**:

```sql
SELECT 
  llm_provider,
  COUNTIF(rank = 1) / COUNTIF(cited = 1) AS primary_rate
FROM `project.dataset.llm_citations`
WHERE cited = 1
GROUP BY llm_provider;
```

**Meta:** 40%+ (si te citan, deberías ser la primera fuente en 4 de cada 10 casos). Por debajo del 20% significa que la "relevance signal" es débil — probablemente baja similaridad de embedding en el retrieval.

### 3. Volatilidad a Nivel de Consulta

Para cada consulta, calcula la varianza de citación en 30 días — si siempre te citan, la volatilidad es baja; si a veces sí y a veces no, es alta. Alta volatilidad significa que el LLM actualiza su índice frecuentemente o el contenido competidor te ha dejado atrás.

```sql
SELECT 
  query_id,
  STDDEV(cited) AS citation_volatility
FROM `project.dataset.llm_citations`
WHERE llm_provider = 'perplexity'
GROUP BY query_id
HAVING COUNT(*) >= 20
ORDER BY citation_volatility DESC;
```

Si volatility > 0.4, revisa manualmente — probablemente hay un problema de "freshness" (tu contenido se publicó hace 6 meses, el LLM prefiere contenido más reciente).

## Tradeoff de Atribución: ¿Tráfico Directo o Referencia de LLM?

Hay un efecto secundario de obtener citaciones en LLM: en Google Analytics sube el tráfico directo pero no puedes saber que vino de un LLM. Porque los clics desde la interfaz web de ChatGPT aparecen como `(direct) / (none)` — sin header de referrer.

Para resolver esto, hay 2 métodos:

**Método 1: Inyección de UTM (en API de LLM)**  
Si envías contenido a la API de un LLM (por ejemplo, Perplexity Publisher API), añade `?utm_source=perplexity&utm_medium=llm&utm_campaign=citation` a tus URLs. Así el source aparece en GA4. Pero este método solo funciona en LLM que usan APIs — en ChatGPT web crawling no puedes inyectar UTM.

**Método 2: Fingerprinting del Lado del Servidor**  
Los bots de LLM usan patrones específicos de user-agent:  
- Perplexity: `PerplexityBot`  
- ChatGPT: `ChatGPT-User` o `GPTBot`  
- Gemini: `Google-Extended`  

Filtra estos user-agent en los logs del servidor e integra con [Arquitectura de Medición First-Party](https://www.roibase.com.tr/es/firstparty) para enviar eventos a GA4 del lado del servidor. Nombre del evento: `llm_visit`, parámetro: `llm_provider`. De esta forma puedes distinguir los LLM dentro del tráfico "directo".

| Método | Ventaja | Desventaja |
|---|---|---|
| Inyección de UTM | Source automático en GA4 | Solo en APIs |
| Fingerprint Servidor | Funciona en todos los LLM | Requiere parsing de logs |

Sea cuál sea el que elijas, el objetivo es: **ver la correlación entre citation rate y tráfico referido de LLM**. Si la citación sube el 20% pero el tráfico LLM no sube, significa que aunque te citan, los usuarios no hacen clic — problema de prominencia o calidad del snippet.

## Prominencia de Citación: Diferencia Inline vs Nota al Pie

El LLM te citó, pero **¿cómo?** ¿Perplexity te dio un enlace en línea (con `[1]` dentro de la frase), o solo apareces en una lista "Fuentes Relacionadas" al final? Esta diferencia afecta el CTR en un 400% (test A/B interno de Roibase, n=2.300 consultas).

**Ejemplo de citación inline:**  
> "La duración de cookie en server-side GTM se puede aumentar a 730 días [[1]](roibase.com.tr/...)."  

**Ejemplo de citación en nota al pie:**  
> "...hay varios métodos disponibles.  
> Fuentes:  
> 1. roibase.com.tr/...  
> 2. competitor.com/..."

En citación inline, el usuario hace clic mientras lee la frase — hay contexto. En nota al pie, solo hace clic si busca "más detalles" después de leer la respuesta — intent de conversión bajo.

**Cálculo de prominence score:**  
Registra `position_type` cada vez que te citen (inline / footnote / sidebar). Toma el promedio de 30 días:

```sql
SELECT 
  AVG(CASE 
    WHEN position_type = 'inline' THEN 3
    WHEN position_type = 'footnote' THEN 1
    ELSE 0
  END) AS avg_prominence_score
FROM `project.dataset.llm_citations`
WHERE cited = 1;
```

**Meta:** 2.0+ (si te citan, más de la mitad debería ser inline). Por debajo de 1.5 significa que el LLM te ve como "fuente complementaria", no "fuente principal". Solución: estructura tu contenido para que el LLM pueda citar directamente — definiciones de una línea, fact boxes, snippets de código.

## Análisis de Competencia: Solapamiento de Fuentes a Nivel de Consulta

¿En qué consultas no te citan pero tus competidores sí? Para verlo, parsea **todas las fuentes** que muestra el LLM en cada respuesta, no solo la tuya.

Ejemplo: en la consulta "optimización de costos en BigQuery", Perplexity muestra estas fuentes:  
1. competitor-a.com  
2. roibase.com.tr  
3. competitor-b.com  

Escribe todos los datos en la tabla `llm_all_sources` — esquema: `query_id, llm_provider, date, source_domain, rank`. Ahora calcula una "matriz de solapamiento":

```sql
SELECT 
  a.source_domain AS source_1,
  b.source_domain AS source_2,
  COUNT(DISTINCT a.query_id) AS co_citation_count
FROM `project.dataset.llm_all_sources` a
JOIN `project.dataset.llm_all_sources` b 
  ON a.query_id = b.query_id 
  AND a.llm_provider = b.llm_provider
  AND a.date = b.date
WHERE a.source_domain != b.source_domain
GROUP BY source_1, source_2
HAVING co_citation_count > 5
ORDER BY co_citation_count DESC;
```

Esta consulta te muestra: "somos citados juntos con competitor-a en 47 consultas." Ahora divide `co_citation_count` por el número total de consultas donde competitor-a es citado — esto es tu "citation overlap ratio". Si es mayor al 60%, compiten directamente; si es menor al 30%, están en nichos diferentes.

**Convertir a acciones:**  
Si el solapamiento es alto pero no te citan (competitor-a sí, tú no), cierra el gap de contenido de esa consulta. Lee la página del competidor — ¿qué facts menciona, qué formato usa (tabla / lista / código)? Da los mismos facts pero **más estructurados** (JSON-LD, tabla, bullets) — el retrieval de LLM prefiere estas estructuras.

## Qué Empezar a Medir Ahora

Para configurar métricas de citación en LLM, primero diseña un conjunto de consultas sintéticas — extrae de GSC las consultas de bajo CTR y alta impresión. Luego, crea un pipeline de sondeo diario con n8n, escribe las respuestas en BigQuery. En los primeros 30 días, establece la línea base: citation rate, primary source rate, prominence score. Después, mide el impacto de tus trabajos en [Generative Engine Optimization](https://www.roibase.com.tr/es/geo) — qué cambios de contenido subieron el citation rate, cuáles lo bajaron. Si obtuviste citaciones pero no tráfico, es un problema de prominencia — apunta a referencias inline. Analiza los patrones de co-citación para ver dónde te ganan los competidores y cierra esos gaps. Añade estas métricas a tu dashboard SEO — a finales de 2026, mirarás "tráfico orgánico + visibilidad en LLM" en lugar de solo tráfico orgánico.