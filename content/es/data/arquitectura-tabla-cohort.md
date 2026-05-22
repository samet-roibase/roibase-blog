---
title: "Arquitectura de Tabla Cohort: Escalado de Análisis de Retención en Production"
description: "Materialized views, partitioning y query cost optimization para ejecutar cohort analysis sobre millones de usuarios: arquitectura BigQuery production-ready."
publishedAt: 2026-05-22
modifiedAt: 2026-05-22
category: data
i18nKey: data-007-2026-05
tags: [analisis-cohort, bigquery, materialized-views, retention-engineering, query-optimization]
readingTime: 8
author: Roibase
---

El análisis de retención es uno de los métodos más poderosos para entender el comportamiento del usuario. Pero a escala real —millones de eventos diarios, cientos de miles de usuarios— las consultas SQL ingenuas se agotan en 30 segundos o consumen toda la capacidad de slots. La retención sostenible en production requiere optimizar la arquitectura de la tabla según el motor de consultas. En este artículo te mostramos cómo escalar tablas cohort en BigQuery usando materialized views, partitioning e incremental refresh strategies.

## Por qué la Consulta Cohort Ingenua Falla

El análisis cohort clásico funciona así: encuentra la fecha de primera actividad del usuario (cohort_date), calcula todas las actividades posteriores como "Día N" respecto a esa fecha, suma tasas de retención por grupo. El siguiente SQL es lógicamente correcto pero no funciona en production:

```sql
WITH first_event AS (
  SELECT user_id, MIN(DATE(event_timestamp)) AS cohort_date
  FROM `project.dataset.events`
  GROUP BY user_id
),
daily_activity AS (
  SELECT e.user_id, DATE(e.event_timestamp) AS activity_date
  FROM `project.dataset.events` e
  GROUP BY 1,2
)
SELECT 
  f.cohort_date,
  DATE_DIFF(d.activity_date, f.cohort_date, DAY) AS day_n,
  COUNT(DISTINCT d.user_id) AS retained_users
FROM first_event f
JOIN daily_activity d USING(user_id)
GROUP BY 1,2
ORDER BY 1,2;
```

Hay dos grandes problemas aquí: (1) la tabla `events` se escanea completa en cada ejecución —sin partition pruning—, (2) para cada cohort_date se hace join de todas las actividades de todos los usuarios —riesgo de explosión cartesiana. Con 100M eventos, esta consulta procesa 400GB de datos y termina en 2 minutos; pero en refresh diario no es sostenible. La factura de BigQuery crece 10x antes de fin de mes.

## Tabla Base Particionada para Reducir Carga de Filtrado

El primer paso: particionar la tabla `events` por `DATE(event_timestamp)`. Esto garantiza que cuando la consulta incluya `WHERE DATE(event_timestamp) BETWEEN X AND Y`, solo las particiones relevantes se escaneen:

```sql
CREATE TABLE `project.dataset.events`
PARTITION BY DATE(event_timestamp)
CLUSTER BY user_id, event_name
AS SELECT * FROM ...;
```

El clustering en (user_id, event_name) coloca los eventos del mismo usuario en bloques físicamente cercanos —el rendimiento del join mejora 30-50%. Pero esto solo no es suficiente; la lógica de cálculo cohort se repite en cada consulta. Aquí entra la materialized view.

## Materialized View: Tabla Cohort Incremental

Las materialized views de BigQuery almacenan físicamente el resultado de una consulta y se refresca automáticamente cuando cambian los datos base. Para análisis cohort usamos esta estructura:

```sql
CREATE MATERIALIZED VIEW `project.dataset.user_cohorts`
PARTITION BY cohort_date
CLUSTER BY user_id
AS
SELECT 
  user_id,
  MIN(DATE(event_timestamp)) AS cohort_date,
  COUNT(*) AS first_day_events
FROM `project.dataset.events`
GROUP BY user_id;
```

Esta view calcula una sola vez la fecha de primer evento de cada usuario (cohort_date) y la almacena. Cuando llegan eventos nuevos, BigQuery solo procesa el delta —no hay escaneo completo. La partición por cohort_date permite pruning en filtros como `WHERE cohort_date = '2026-05-01'`.

Ahora la consulta de retención se reduce a:

```sql
SELECT 
  c.cohort_date,
  DATE_DIFF(DATE(e.event_timestamp), c.cohort_date, DAY) AS day_n,
  COUNT(DISTINCT e.user_id) AS retained_users
FROM `project.dataset.user_cohorts` c
JOIN `project.dataset.events` e 
  ON c.user_id = e.user_id 
  AND DATE(e.event_timestamp) >= c.cohort_date
WHERE c.cohort_date BETWEEN '2026-05-01' AND '2026-05-15'
GROUP BY 1,2;
```

Esta consulta usa la materialized view en lugar de la tabla base —las filas a escanear se reducen de millones a miles. Pero aún procesa toda la tabla de eventos. El siguiente nivel es pre-agregar la retención.

## Tabla de Retención Pre-Agregada: Capa Final

El análisis cohort típicamente se ve en intervalos fijos —"Día 0, Día 1, Día 7, Día 30"— no hay necesidad de recalcular para cada día. Con dbt implementamos esta lógica:

1. Cada día, extrae cohorts nuevos de la view `user_cohorts`
2. Para cada cohort calcula retención histórica de los últimos 30 días (que no cambia después del día 30)
3. Escribe el resultado en `cohort_retention_summary` de forma **incremental**

Modelo dbt:

```sql
{{
  config(
    materialized='incremental',
    unique_key=['cohort_date','day_n'],
    partition_by={'field':'cohort_date','data_type':'date'},
    cluster_by=['day_n']
  )
}}

WITH cohorts_to_update AS (
  SELECT DISTINCT cohort_date 
  FROM {{ ref('user_cohorts') }}
  WHERE cohort_date >= CURRENT_DATE() - 31
  {% if is_incremental() %}
    AND cohort_date > (SELECT MAX(cohort_date) FROM {{ this }})
  {% endif %}
),
retention_calc AS (
  SELECT 
    c.cohort_date,
    DATE_DIFF(DATE(e.event_timestamp), c.cohort_date, DAY) AS day_n,
    COUNT(DISTINCT e.user_id) AS retained_users,
    MAX(c.first_day_events) AS cohort_size
  FROM {{ ref('user_cohorts') }} c
  JOIN {{ source('raw','events') }} e 
    ON c.user_id = e.user_id
  WHERE c.cohort_date IN (SELECT cohort_date FROM cohorts_to_update)
    AND DATE(e.event_timestamp) >= c.cohort_date
    AND DATE_DIFF(DATE(e.event_timestamp), c.cohort_date, DAY) <= 30
  GROUP BY 1,2
)
SELECT 
  cohort_date,
  day_n,
  retained_users,
  cohort_size,
  SAFE_DIVIDE(retained_users, cohort_size) AS retention_rate
FROM retention_calc;
```

Este modelo actualiza solo los cohorts de los últimos 31 días cada día. Los cohorts más antiguos tienen retención fija —no se recalculan. El uso de slots baja 95%. [CDP & Retention Engineering](https://www.roibase.com.tr/es/retention-engineering-cdp) se conecta directamente a esta tabla —las herramientas BI (Looker, Metabase) devuelven resultados en 100ms.

## Estrategia de Query Cost y Partition Expiration

En BigQuery, el storage es barato ($0.02/GB/mes), el compute es caro ($5/TB de datos procesados). El análisis de retención es retrospectivo, así que las particiones antiguas se escanean frecuentemente. Dos optimizaciones:

1. **Partition expiration:** Elimina automáticamente particiones de más de 90 días en `events` —no hay necesidad de raw events después del cálculo cohort.
2. **Actualiza estadísticas de clustering periódicamente:** `ANALYZE TABLE ... UPDATE STATISTICS` —el query optimizer elige mejor plan de ejecución.

Comparación de costos (100M eventos/día, 1M usuarios):

| Método | Datos procesados/día | Compute mensual |
|---|---|---|
| Consulta ingenua (full scan) | 12TB | $600 |
| Particionado + materialized view | 800GB | $40 |
| Tabla pre-agregada (incremental) | 50GB | $2.5 |

Agregar la capa pre-agregada reduce el compute 240x. Esta diferencia es crítica en production —especialmente si refresh es cada hora.

## Trade-off de Análisis Cohort en Tiempo Real

La estructura de materialized view y pre-agregado introduce latencia: los datos se atrasan 1-5 minutos. Si necesitas retención en tiempo real (por ejemplo, para las primeras 24 horas), usa un enfoque híbrido:

- Últimas 24 horas: streaming insert + real-time query (sin cache)
- Datos más antiguos: tabla pre-agregada

La consulta BI combina ambas fuentes con UNION ALL:

```sql
SELECT * FROM cohort_retention_summary WHERE cohort_date < CURRENT_DATE()
UNION ALL
SELECT * FROM realtime_cohort_view WHERE cohort_date = CURRENT_DATE();
```

Aunque la view en tiempo real es costosa, solo procesa el cohort actual —el impacto en compute total es limitado.

## Segmentación de Cohort y Explosión de Cardinalidad

Dividir análisis de retención por segmentos de usuario (plataforma, país, channel de adquisición) puede dispara problemas de cardinalidad. Por ejemplo, 5 segmentos × 30 días × 365 cohorts = 54.750 filas únicas. En este caso:

1. **Limita segmentos:** Analiza solo los 3-5 más importantes; crea tablas separadas para otros.
2. **Segmentación dinámica:** En lugar de agregar segmento a la tabla pre-agregada, filtra en join-time —mantiene flexibilidad pero aumenta uso de slots.
3. **Tabla rollup:** Crea tabla separada para cohorts semanales (weekly_cohort_retention) —cardinalidad baja 85%.

En el proceso [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/es/verianalizi) de Roibase, integramos estrategia de segmentación con attribution de fuente de adquisición —la retención se vincula directamente con desempeño de canal.

## Monitoreo y Detección de Regresión

Monitorea el pipeline cohort en production con estas métricas:

- **Query slot time:** El uso de slots en refresh diario —un aumento súbito indica explosión de cardinalidad o pérdida de partition pruning.
- **Row count delta:** Filas agregadas en cada refresh —más de lo esperado significa riesgo de eventos duplicados.
- **Retention rate stddev:** Un cambio >10% en retención del Día 1 señala problema de calidad de datos.

Agrega estos checks como tests en dbt:

```yaml
tests:
  - dbt_utils.expression_is_true:
      expression: "retention_rate BETWEEN 0 AND 1"
  - dbt_utils.recency:
      datepart: day
      field: cohort_date
      interval: 1
```

Si falla un test, activa alerta Slack/PagerDuty —sin esperar revisión manual.

La arquitectura de tabla cohort traslada análisis de retención de "consulta ad-hoc" a "data product de production". Refresh incremental con materialized view, partition pruning, optimización de slots con pre-agregado —cada capa reduce costos 10x. Analizar retención sobre millones de usuarios y miles de millones de eventos ahora se resume en query de dashboard en 100ms. Decidir qué patrones de retención monitorear sigue siendo tu trabajo —pero procesar datos a esa velocidad ya no es un problema de ingeniería.