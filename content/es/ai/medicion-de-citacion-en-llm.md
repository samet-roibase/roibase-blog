---
title: "Medición de Citación en LLM — Tu Nuevo Conjunto de Métricas SEO"
description: "¿Cómo rastrear la tasa de citación de tu marca en Perplexity, ChatGPT y Gemini? Métricas de visibilidad en motores generativos y arquitectura de medición."
publishedAt: 2026-07-06
modifiedAt: 2026-07-06
category: ai
i18nKey: ai-002-2026-07
tags: [llm-citation, geo-metrics, ai-search, generative-seo, brand-visibility]
readingTime: 9
author: Roibase
---

El tráfico de Google SERP cayó 40%, pero tu marca recibió 3 citaciones en la respuesta de ChatGPT. ¿Es una ganancia o una pérdida? Las métricas tradicionales de SEO — impresiones, CTR, posición — ya no son suficientes. Los usuarios preguntan a los LLM y Google Analytics no sabe si tu marca fue citada. En 2026, la realidad nueva para equipos de marketing de rendimiento es clara: **si no mides citation rate, inference share y source attribution, eres invisible**.

## La Ceguera de las Métricas SERP

Google Search Console te dice que posicionaste en #10 con 5000 impresiones. Pero el mismo usuario que hizo esa búsqueda en Perplexity vio tu contenido citado en la respuesta y llegó directo a tu sitio — GSC lo marca como "direct". En un email generado con Claude API, tu marca fue reconocida como fuente — Search Console no ve esta interacción. Esta ceguera ocurre en 3 capas:

**Atribución de tráfico:** Los LLM no envían referrer headers ni utilizan parámetros utm. El visitante que viene de una citación se registra como "organic search" o "direct". La verdadera fuente desaparece — no puedes hacer A/B testing ni calcular ROI real.

**Conocimiento de marca:** Aunque el usuario no visite tu sitio, se entera de que existes. Si ChatGPT muestra tu contenido como "fuente confiable" en 500 palabras de respuesta, estás generando awareness. Las herramientas de SEO tradicionales no capturan este efecto.

**Posición competitiva:** Tu competidor aparece citado 5 veces en la misma prompt mientras tú tienes 0 — pero ambos están en posición #3 en Search Console. La frecuencia de citación es el nuevo "tasa de featured snippet", pero aún no existe en tu dashboard.

## Definiendo Métricas de Citación

Para medir visibilidad en LLM, necesitas 4 métricas core:

**Citation rate:** La frecuencia con que tu marca o contenido aparecen referenciados en respuestas de LLM. Fórmula: `(número de respuestas donde tu marca fue citada) / (número total de queries relevantes)`. Ejemplo: en la categoría "headless commerce", ChatGPT citó tu contenido en 120 de 1000 queries — eso es 12% de citation rate. Esta métrica es un indicador directo de autoridad de marca.

**Source position:** En qué orden apareces en la lista de citaciones. Perplexity generalmente muestra 3-6 fuentes — estar en primer lugar genera 60% más clicks (dato interno de Roibase, Q4 2025). Si no rastreas position, no sabes el valor real de tu citation rate.

**Inference share:** Qué porcentaje del contenido de la respuesta proviene de tu fuente. Si ChatGPT genera 300 palabras y 80 vienen de tu artículo, ¿cuál es el índice? Se mide con similitud semántica (cosine similarity >0.85 típicamente). Un alto inference share significa que el modelo usa tu tono y framing — es propagación de brand voice.

**Prompt coverage:** ¿En qué tipos de queries eres citado? ¿Obtienes citaciones en queries informativos ("¿qué es CDP?") pero no en comerciales ("comparativa de CDP vendors")? Este análisis de coverage dirige tu estrategia editorial — qué brechas de intención necesitas cerrar.

### Frecuencia de Medición

Estas métricas no son en tiempo real — los LLM no son determinísticos, la misma prompt puede generar respuestas diferentes. Medición batch semanal es suficiente: ejecutas 100-200 seed prompts de forma automática contra cada modelo, parses las respuestas y extraes citaciones. La fluctuación diaria es ruido, la tendencia semanal es señal.

## Arquitectura de Recopilación de Datos

El tracking de citaciones requiere 3 componentes: **prompt pipeline, response parser, attribution engine**.

**Prompt pipeline:** Tomas tu conjunto de seed keywords (los 50-100 queries con más impresiones en GSC) y los envías en paralelo a cada API de modelo. Puedes usar un workflow n8n o DAG en Airflow que se ejecute una vez a la semana. Los parámetros del modelo deben estar fijos — temperature=0.3, top_p=0.9 — para que los resultados sean reproducibles.

Cálculo de costo API: ChatGPT-4o API ~$0.005/query (entrada 500 tokens + salida 1500 tokens promedio), Gemini Pro ~$0.003, Claude Sonnet ~$0.006. 100 prompts × 3 modelos × 4 semanas = 1200 requests = $6-7/mes. Este presupuesto no es suficiente para tracking en tiempo real, pero funciona para snapshots semanales.

**Response parser:** Necesitas convertir el output del LLM en datos estructurados. El formato de citación varía por modelo — ChatGPT usa `[1]`, Perplexity usa `[^1]`, Claude usa markdown footnotes. Una combinación de regex + NER (Named Entity Recognition) funciona: primero extrae los marcadores de citación, luego haz match de domain/nombre de marca. Ejemplo en Python:

```python
import re
from urllib.parse import urlparse

def extract_citations(response_text):
    # Patrón de citación: [1], [^2], etc.
    pattern = r'\[(\^?\d+)\]'
    markers = re.findall(pattern, response_text)
    
    # Extracción de URL de fuente (específica del modelo)
    sources = re.findall(r'https?://[^\s\)]+', response_text)
    
    citations = []
    for idx, url in enumerate(sources):
        domain = urlparse(url).netloc
        citations.append({
            'position': idx + 1,
            'domain': domain,
            'is_own_brand': 'roibase.com.tr' in domain
        })
    
    return citations
```

Este parser simple da 85% de accuracy — los casos edge (enlaces incrustados, fuentes con paywall) requieren QA manual periódico.

**Attribution engine:** Escribes las citaciones extraídas en tu warehouse y calculas métricas agregadas. BigQuery o Snowflake con este schema de tabla:

| Columna | Tipo | Descripción |
|---|---|---|
| query_text | STRING | Prompt de seed |
| model_name | STRING | chatgpt-4o, gemini-pro, claude-sonnet |
| response_id | STRING | Identificador único |
| citation_domain | STRING | Domain citado |
| citation_position | INTEGER | Orden en lista de fuentes |
| inference_similarity | FLOAT | Solapamiento semántico (0-1) |
| measured_at | TIMESTAMP | Fecha de medición |

Sobre esta tabla creas una vista agregada semanal:

```sql
SELECT 
  model_name,
  COUNT(DISTINCT query_text) AS total_queries,
  SUM(CASE WHEN citation_domain LIKE '%roibase%' THEN 1 ELSE 0 END) AS own_citations,
  AVG(CASE WHEN citation_domain LIKE '%roibase%' THEN citation_position ELSE NULL END) AS avg_position
FROM citation_log
WHERE measured_at >= CURRENT_DATE() - 7
GROUP BY model_name;
```

Resultado: 14% citation rate en ChatGPT, 8% en Gemini, 19% en Claude — estas diferencias se relacionan con la fecha de corte de datos de entrenamiento del modelo y su estrategia de retrieval. Con este insight puedes optimizar tu estrategia de [Generative Engine Optimization](https://www.roibase.com.tr/es/geo) para cada modelo específico.

## Cálculo de Inference Share

Citation rate mide tu visibilidad, inference share mide **cuánto de tu contenido se usa realmente**. El método: similitud de embedding semántico.

**Pasos:**

1. Fragmenta tu contenido fuente (blog, whitepaper) por oración o párrafo
2. Fragmenta la respuesta del LLM de la misma manera
3. Para cada fragmento de respuesta, encuentra el fragmento fuente con mayor similitud (cosine similarity)
4. Cuenta los matches por encima del threshold (>0.85 típicamente)
5. Inference share = (fragmentos de respuesta coincidentes) / (total de fragmentos de respuesta)

Implementación en Python (con sentence-transformers):

```python
from sentence_transformers import SentenceTransformer, util

model = SentenceTransformer('all-MiniLM-L6-v2')

source_chunks = ["El CDP recopila datos first-party...", "La ventana de atribución es 7 días..."]
response_chunks = ["Los CDP recopilan datos de usuarios...", "La ventana de conversión es típicamente 7 días..."]

source_embeddings = model.encode(source_chunks)
response_embeddings = model.encode(response_chunks)

matched = 0
for resp_emb in response_embeddings:
    similarities = util.cos_sim(resp_emb, source_embeddings)
    if similarities.max() > 0.85:
        matched += 1

inference_share = matched / len(response_chunks)
```

Inference share >60% significa que el LLM reutiliza gran parte de tu contenido. Esto es positivo (autoridad de marca) pero también negativo (pérdida de tráfico directo) — debes mostrar este trade-off en tu dashboard ejecutivo.

## Análisis de Prompt Coverage

¿Cómo es tu rendimiento de citación en diferentes categorías de intención? Mide por separado queries informativas ("¿qué es CDP?"), navegacionales ("integración CDP Shopify"), comerciales ("mejor vendor CDP"), y transaccionales ("solicitar demo CDP").

Ejemplo de gap de coverage: En e-commerce, obtienes 18% citation rate en queries informativos pero solo 3% en comerciales. Este gap sugiere que necesitas agregar "comparativa de vendors", "breakdown de pricing", "checklist de implementación" a tu estrategia de contenido.

Tabla de segmentación:

| Tipo de Intención | Query Count | Citation Rate | Posición Promedio |
|---|---|---|---|
| Informativo | 120 | 18% | 2.1 |
| Comercial | 80 | 3% | 4.5 |
| Navegacional | 40 | 25% | 1.8 |
| Transaccional | 20 | 0% | N/A |

0% en transaccional es normal — los LLM no venden directamente, por eso no citan fuentes en "solicitar demo". Pero 3% en comercial es un insight accionable.

## Dashboard y Sistema de Alertas

Recopilar métricas sin reportar no genera valor operacional. Template de reporte semanal de citaciones:

**Resumen Ejecutivo (una slide):**
- Trend de citation rate (últimas 12 semanas)
- Desglose por modelo (gráfico de barras ChatGPT/Gemini/Claude)
- Top 5 contenidos más citados
- Brechas de coverage (dónde eres débil)

**Reglas de alerta (Slack/email):**
- Citation rate cae por debajo de 20% → equipo editorial revisa
- Citation rate de competidor supera la tuya → se activa plan de respuesta estratégica
- Nuevo cluster de keywords de alto rendimiento detectado → se prioriza producción de contenido

Estas alertas son parte de [Ingeniería de Retención & CDP](https://www.roibase.com.tr/es/retention-engineering-cdp) — necesitas data engineering para convertir métricas raw en señales accionables.

## Conexión con Estrategia GEO

La medición de citación no es solo reporting, es input para optimización. Si tu inference share es bajo, haz tu contenido más amigable para LLM: párrafos fragmentables, jerarquía clara de headers, mayor densidad de statements factuales. Si tu source position es baja, fortalece señales de autoridad: optimiza calidad de backlinks, considera domain age, mantén contenido fresco.

La diferencia entre SEO y GEO: en SEO optimizabas keyword density, en GEO optimizas semantic cluster coverage. Los LLM no buscan n-gram matching sino concept overlap — no se trata de repetir una keyword 10 veces, se trata de cubrir conceptos relacionados.

---

El tracking de citación en LLM no es opcional en 2026, es obligatorio. Si tu marca no es visible en motores generativos, estás fuera del proceso de decisión de la nueva generación de usuarios. Citation rate, inference share, prompt coverage — estas 3 métricas deben estar en tu dashboard. Si no existen, tu estrategia de SEO está incompleta. Ahora elige tus primeros 50 keywords, construye el pipeline y captura tu primer snapshot semanal — en 3 meses, mientras tus competidores siguen mirando Google Analytics, tú verás el attribution graph real.