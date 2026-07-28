---
title: "Arquitectura de Tabla Cohorte: Escalado del Análisis de Retención en Producción"
description: "Aprende a escalar tablas de análisis de cohorte en producción usando materialized views, particionamiento y optimización de costos de consultas."
publishedAt: 2026-07-28
modifiedAt: 2026-07-28
category: data
i18nKey: data-007-2026-07
tags: [analisis-cohorte, bigquery, materialized-views, data-engineering, retention]
readingTime: 8
author: Roibase
---

Toda organización que realiza análisis de retención termina en el mismo punto: las consultas de cohorte en producción tardan 30 segundos o la factura de BigQuery se acerca a los $8.000 mensuales. Esa consulta que funcionaba perfecto con 100K usuarios en testing (`GROUP BY user_id, cohort_week`) se colapsa cuando se enfrenta a 50M usuarios y 2 años de logs de eventos. La solución no es simple — no se trata solo de añadir índices o activar caché, sino rediseñar la arquitectura de tablas desde cero para una carga de trabajo de retención.

## Por Qué el Análisis de Cohorte Requiere una Arquitectura Diferente

Una tabla de logs de eventos clásica se construye sobre `user_id`, `event_time`, `event_name`. Cada consulta de cohorte escanea miles de millones de filas históricamente, agrupando usuarios por su fecha de primer evento. En BigQuery, la consulta se ve así:

```sql
WITH cohorts AS (
  SELECT user_id, DATE_TRUNC(MIN(event_time), WEEK) AS cohort_week
  FROM events
  GROUP BY user_id
),
retention AS (
  SELECT 
    c.cohort_week,
    DATE_DIFF(DATE_TRUNC(e.event_time, WEEK), c.cohort_week, WEEK) AS weeks_since_cohort,
    COUNT(DISTINCT e.user_id) AS active_users
  FROM cohorts c
  JOIN events e ON c.user_id = e.user_id
  GROUP BY 1, 2
)
SELECT * FROM retention ORDER BY 1, 2;
```

Cada ejecución de esta consulta lee la tabla completa de `events`. 500M filas × 16 bytes promedio = 8 GB de escaneo. En BigQuery, 1 TB de escaneo cuesta $6.25, entonces 1.000 consultas = $50. Si el dashboard se actualiza cada 5 minutos, son 8.640 consultas al mes = $432 solo para el widget de cohorte. Añade 10 analistas más al equipo, bots de Slack disparan queries, y el costo se dispara.

El problema real ni siquiera es el costo — es la latencia. Un JOIN con 500M filas tarda 15-30 segundos. El usuario cambia un filtro en el dashboard y espera 20 segundos por nuevos datos de cohorte. El análisis de retención no puede ser iterativo con esa demora.

### Materialized View es un Primer Paso, Pero Insuficiente

Una materialized view de BigQuery precomputa la consulta de cohorte:

```sql
CREATE MATERIALIZED VIEW cohort_retention AS
SELECT 
  cohort_week,
  weeks_since_cohort,
  active_users
FROM retention; -- resultado del CTE anterior
```

Ahora el dashboard lee la tabla `cohort_retention`, no `events`. El escaneo es 8 GB en lugar de 80 MB. La latencia es 800 ms en lugar de 20 segundos. Pero hay dos limitaciones:

1. **Costo de actualización:** Cada refresh de la materialized view ejecuta la consulta base nuevamente. Es decir, otro escaneo de 8 GB. Si actualizas la view cada hora, 24 × 8 GB = 192 GB/día = 5,8 TB al mes. El costo no bajó, solo la latencia.
2. **Falta de flexibilidad:** La materialized view es estática. El usuario añade un filtro "retención de cohorte Android", la view necesita recalcularse. No puedes prefiltrarlo porque modificar la consulta requiere recrear la view.

Por eso la arquitectura de cohorte debe ser de tres capas: logs de eventos sin procesar → tabla de asignación de cohorte → tabla de retención agregada.

## Separar la Tabla de Asignación de Cohorte

El primer paso: crear una tabla separada que asigne cada usuario a su cohorte. Esta tabla contiene solo `user_id` y `cohort_week`, derivada del log de eventos pero calculada una vez al día:

```sql
CREATE OR REPLACE TABLE cohort_assignments
PARTITION BY cohort_week
CLUSTER BY user_id
AS
SELECT 
  user_id,
  DATE_TRUNC(MIN(event_time), WEEK) AS cohort_week,
  MIN(event_time) AS first_seen_at
FROM events
WHERE event_time >= '2024-01-01'
GROUP BY user_id;
```

Esta tabla:
- **Particionada por cohort_week:** BigQuery crea bloques de archivo separados para cada semana. Un filtro como `WHERE cohort_week = '2026-01-05'` lee solo 1 partición.
- **Agrupada por user_id:** Dentro de cada partición, el almacenamiento se ordena por user_id. Los JOINs se aceleran.
- **Tamaño:** 50M usuarios × 3 columnas × 16 bytes = ~2,4 GB. Si el log de eventos es 500 GB, la tabla de cohorte es 200× más pequeña.

Ahora la consulta de retención usa esta tabla:

```sql
SELECT 
  c.cohort_week,
  DATE_DIFF(DATE_TRUNC(e.event_time, WEEK), c.cohort_week, WEEK) AS weeks_since,
  COUNT(DISTINCT e.user_id) AS active_users
FROM cohort_assignments c
JOIN events e ON c.user_id = e.user_id
WHERE c.cohort_week >= '2026-01-01'
GROUP BY 1, 2;
```

Con partition pruning en `cohort_assignments`, si lees 4 semanas de datos, el escaneo es 200 MB. El JOIN todavía escanea la tabla completa de `events`, pero comienza en un estado filtrado — no hay usuarios innecesarios.

### Actualización Incremental

La tabla `cohort_assignments` se actualiza diariamente, pero no se recalcula desde cero cada vez. Usa un modelo incremental de dbt:

```sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'cohort_week', 'data_type': 'date'},
    cluster_by=['user_id']
  )
}}

SELECT 
  user_id,
  DATE_TRUNC(MIN(event_time), WEEK) AS cohort_week,
  MIN(event_time) AS first_seen_at
FROM {{ ref('events') }}
{% if is_incremental() %}
  WHERE event_time > (SELECT MAX(first_seen_at) FROM {{ this }})
{% endif %}
GROUP BY user_id
```

Este modelo procesa todos los datos en la primera ejecución, después solo añade usuarios nuevos. El escaneo es 500 GB inicialmente, luego 2 GB diarios.

## Tabla de Retención Agregada: Precomputar Métricas a Nivel Semanal

La tabla de asignación de cohorte aceleró la consulta de retención, pero el dashboard aún ejecuta un JOIN contra `events` cada solicitud. Un paso más: precomputa las métricas de retención semanalmente y guárdalas en una tabla separada.

```sql
CREATE TABLE cohort_retention_weekly
PARTITION BY cohort_week
CLUSTER BY weeks_since_cohort
AS
SELECT 
  c.cohort_week,
  DATE_DIFF(DATE_TRUNC(e.event_time, WEEK), c.cohort_week, WEEK) AS weeks_since_cohort,
  COUNT(DISTINCT e.user_id) AS active_users,
  COUNT(*) AS total_events,
  APPROX_QUANTILES(session_duration, 100)[OFFSET(50)] AS median_session_duration
FROM cohort_assignments c
JOIN events e ON c.user_id = e.user_id
GROUP BY 1, 2;
```

Esta tabla:
- **Tamaño:** 52 semanas × 52 weeks_since × 3 métricas = ~8.100 filas (para datos de 1 año). Nivel de kilobytes.
- **Escaneo:** El dashboard lee `cohort_retention_weekly`, sin leer `events`. Escaneo < 1 MB.
- **Latencia:** BigQuery lee 1 MB de datos en 80 ms. El dashboard ahora es sub-segundo.

El tradeoff: la tabla debe actualizarse una vez al día. Si los datos no actualizado no son aceptables, actualiza cada hora (schedule dbt `0 * * * *`). El costo de actualización: JOIN de cohort_assignments contra events, ~10 GB de escaneo. 24 veces al día = 240 GB, ~7.2 TB al mes. Comparación: si el dashboard ejecutara 1.000 consultas de cohorte sin tablas preaagregadas, sería 8 TB de escaneo. Así que la tabla agregada reduce el escaneo del dashboard en ~10%, pero la latencia baja de 20 segundos a 80 ms.

### Estrategia de Particionamiento: cohort_week vs event_week

¿Particionar la tabla de retención de cohorte por `cohort_week` o por `event_week`? Hay dos enfoques:

**Particionar por cohort_week:**
- Caso de uso: "¿Cuál es la curva de retención de la cohorte 2026-W03?"
- Pruning: `WHERE cohort_week = '2026-01-13'` → se lee 1 partición
- Dificultad: Si el dashboard pregunta "¿cuál es la retención total de las últimas 4 semanas?", se leen 4 particiones. Pero como la mayoría del análisis de retención es cohort-céntrico, es óptimo.

**Particionar por event_week:**
- Caso de uso: "¿Qué cohortes fueron activas esta semana?"
- Pruning: `WHERE event_week = '2026-07-21'` → se lee 1 partición
- Dificultad: Si añades un filtro de cohorte, el pruning no funciona, se leen todas las particiones.

Roibase en proyectos de [análisis de datos](https://www.roibase.com.tr/es/verianalizi) particiona la tabla de retención por cohort_week, porque el 80% de las consultas de retención siguen el formato "cohorte X en la semana N".

## Optimización de Costos de Consulta: Clustering y BI Engine

El particionamiento hace pruning de arriba a abajo (qué bloques de archivo leer), el clustering ordena de izquierda a derecha (qué filas dentro del bloque leer). Ambos juntos minimizan el escaneo.

```sql
CREATE TABLE cohort_retention_weekly
PARTITION BY cohort_week
CLUSTER BY weeks_since_cohort, platform, country;
```

Si la consulta es `WHERE weeks_since_cohort = 4 AND platform = 'iOS'`:
1. Partition pruning → solo particiones de cohort_week relevantes
2. Clustering → dentro de la partición, primero filas con `weeks_since_cohort = 4`, luego filas con `platform = 'iOS'`

BigQuery acepta máximo 4 columnas de clustering. El orden importa: pon la columna más filtrada primero.

**BI Engine:** La capa de caché en memoria de BigQuery. Si reservas 100 GB de BI Engine, las tablas usadas frecuentemente se mantienen en RAM. Si la tabla `cohort_retention_weekly` es 50 MB, cabe completamente en BI Engine, el escaneo es 0 (cache hit). Costo: 100 GB × $100/mes. Beneficio: ~10 TB de escaneo ahorrado = $62.50. ROI positivo.

### Funciones de Aproximación: Métricas que No Necesitan Exactitud Total

En el cálculo de retención de cohorte, algunas métricas deben ser exactas (`COUNT(DISTINCT user_id)`), otras pueden ser aproximadas (duración mediana de sesión, percentil).

Funciones aproximadas de BigQuery:
- `APPROX_COUNT_DISTINCT(user_id)` → margen de error del 2%, 10× más rápido
- `APPROX_QUANTILES(value, 100)[OFFSET(50)]` → mediana, margen del 1%
- `APPROX_TOP_COUNT(event_name, 10)` → top 10 eventos, aproximado

Ejemplo: para 50M usuarios, `COUNT(DISTINCT ...)` exacto tarda 8 segundos, `APPROX_COUNT_DISTINCT` tarda 800 ms. Usa aproximación para filtros en tiempo real del dashboard, exactitud para reportes finales.

## Estrategia de Actualización Incremental: event_time vs processing_time

Mientras que la tabla de cohorte se actualiza una vez al día, ¿qué eventos debe procesar? Hay dos timestamps:

1. **event_time:** Cuándo el usuario ejecutó realmente el evento (lado del cliente)
2. **_PARTITIONTIME:** Cuándo BigQuery guardó el evento (lado del servidor)

Si la actualización incremental usa `event_time`:
```sql
WHERE event_time > (SELECT MAX(event_time) FROM cohort_assignments)
```
**Problema:** Eventos que llegan tarde. El usuario está offline 3 días, el evento se carga en batch después. Si `event_time` es de 3 días atrás, la consulta incremental lo pierde.

Si la actualización incremental usa `_PARTITIONTIME`:
```sql
WHERE _PARTITIONTIME > CURRENT_DATE() - 7
```
**Ventaja:** Reprocesa los últimos 7 días cada vez, captura eventos que llegan tarde.
**Costo:** 7 días de datos de eventos = ~14 GB de escaneo diario (en lugar de 2 GB).

Tradeoff: si eventos atrasados son < 1%, usa `event_time` (escaneo bajo). Si en apps móviles son ~5%, usa `_PARTITIONTIME` con lookback de 3 días.

## Segmentación de Cohorte: Filtros Dinámicos vs Dimensiones Estáticas

El usuario añade un filtro en el dashboard: "retención de cohorte iOS". Dos métodos:

**Método 1: Filtro en tiempo de consulta**
```sql
SELECT cohort_week, weeks_since, active_users
FROM cohort_retention_weekly
WHERE user_id IN (SELECT user_id FROM users WHERE platform = 'iOS');
```
**Problema:** La subconsulta escanea la tabla `users` cada vez. 50M usuarios = 1 GB de escaneo. 100 refreshes del dashboard = 100 GB.

**Método 2: Precomputar dimensiones**
```sql
CREATE TABLE cohort_retention_weekly
AS
SELECT 
  c.cohort_week,
  weeks_since_cohort,
  u.platform,
  u.country,
  COUNT(DISTINCT e.user_id) AS active_users
FROM cohort_assignments c
JOIN events e ON c.user_id = e.user_id
JOIN users u ON e.user_id = u.user_id
GROUP BY 1, 2, 