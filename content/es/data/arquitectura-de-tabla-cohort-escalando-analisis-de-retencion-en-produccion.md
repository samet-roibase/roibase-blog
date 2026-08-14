---
title: "Arquitectura de Tabla Cohort: Escalando Análisis de Retención en Producción"
description: "Materialized views, estrategia de particiones y optimización de costos de queries para escalar análisis de cohortes de retención en producción, reducir costos y ganar velocidad en decisiones."
publishedAt: 2026-08-14
modifiedAt: 2026-08-14
category: data
i18nKey: data-007-2026-08
tags: [analisis-de-cohortes, bigquery, materialized-views, data-engineering, retencion]
readingTime: 8
author: Roibase
---

El análisis de retención es el centro del mecanismo de decisión en e-commerce y modelos SaaS. Sin embargo, cuando las queries clásicas de cohortes se ejecutan en producción, cada análisis hace un full-scan de tablas de eventos de terabytes, tarda minutos y lleva el costo de queries a cientos de dólares diarios. Cuando el cálculo de cohortes se hace on-demand, el ciclo de decisión se ralentiza, el equipo de analytics se pierde en optimización de queries, los dashboards no se actualizan. La solución: almacenar las tablas de cohortes como un asset de datos pre-computado, particionado e incrementalmente refrescado. En este artículo te mostramos cómo construir materialized views, particiones y estrategias de incremental build en BigQuery, reduciendo el costo de queries en un 90% mientras aceleras el análisis a segundos y conviertes decisiones de retención en casi real-time.

## Por Qué la Query Clásica de Cohortes No Escala

El análisis de cohortes estándar funciona así: agrupa al usuario por fecha de su primer evento, calcula qué porcentaje regresa en días posteriores. La query SQL hace un join doble de la tabla `events` — una vez para encontrar la fecha de cohorte, otra para contar el comportamiento de retención. En BigQuery, en una tabla de eventos de 500 millones de filas, esta query tarda 10-15 segundos y cuesta ~$0.50. La query se repite cada refresh del dashboard, cada iteración del analyst, cada reporte de A/B test.

El problema no es solo el costo, sino la velocidad y flexibilidad. Cuando el equipo de analytics quiere cambiar la definición de cohorte (por ejemplo, probar "primer agregado al carrito" en lugar de "primera compra"), reescribir, testear y validar la query toma horas. Los dashboards quedan obsoletos. Cuando Marketing pregunta "¿cuál fue la retención del cohorte de la semana pasada?", no hay datos en vivo — un analyst ejecuta la query manualmente. Este ciclo ralentiza el proceso de decisión días completos.

Los cálculos de cohortes también requieren una capa de aggregation como un asset de datos. La métrica de retención no es solo "número de usuarios", sino "usuarios activos / tamaño de cohorte". Esta razón debe actualizarse diariamente, la retención de cohortes históricos debe incorporar nuevos días de comportamiento. La query clásica no soporta esta lógica incremental, recalcula todo desde cero cada vez.

## Convertir Cohortes en Tabla con Materialized Views

El primer paso de la solución es fijar la definición de cohorte como una materialized view. En BigQuery, una materialized view almacena el resultado de una query físicamente y hace refresh incremental cuando cambian las tablas base. Sin embargo, para análisis de cohortes una MV estándar no es suficiente porque la definición de cohorte y la ventana de retención son parámetros dinámicos. Por eso construimos una estructura híbrida: tabla de asignación de cohortes + tabla de agregación de eventos de retención.

La primera tabla `cohort_assignments` almacena la fecha en que el usuario entra a su cohorte:

```sql
CREATE TABLE `project.dataset.cohort_assignments`
PARTITION BY DATE(cohort_date)
CLUSTER BY user_id
AS
SELECT
  user_id,
  MIN(DATE(event_timestamp)) AS cohort_date,
  COUNTIF(event_name = 'purchase') AS total_purchases
FROM `project.dataset.events`
WHERE event_name IN ('first_visit', 'purchase', 'signup')
GROUP BY user_id;
```

Esta tabla contiene cada usuario una sola vez, `cohort_date` es la clave de partición. Cuando llega un usuario nuevo, solo se agrega a la partición relevante. El tamaño de la tabla escala con el número de usuarios (no con el número de eventos) — 10 millones de usuarios ocupan ~500 MB.

La segunda tabla `daily_user_activity` almacena si cada usuario estuvo activo cada día como un flag booleano:

```sql
CREATE TABLE `project.dataset.daily_user_activity`
PARTITION BY activity_date
CLUSTER BY user_id
AS
SELECT
  user_id,
  DATE(event_timestamp) AS activity_date,
  TRUE AS is_active
FROM `project.dataset.events`
WHERE event_name IN ('pageview', 'purchase', 'session_start')
GROUP BY user_id, activity_date;
```

La query de retención se construye haciendo join de estas dos tablas:

```sql
SELECT
  c.cohort_date,
  DATE_DIFF(a.activity_date, c.cohort_date, DAY) AS days_since_cohort,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT a.user_id) AS active_users,
  SAFE_DIVIDE(COUNT(DISTINCT a.user_id), COUNT(DISTINCT c.user_id)) AS retention_rate
FROM `project.dataset.cohort_assignments` c
LEFT JOIN `project.dataset.daily_user_activity` a
  ON c.user_id = a.user_id
  AND a.activity_date >= c.cohort_date
WHERE c.cohort_date >= '2026-01-01'
GROUP BY c.cohort_date, days_since_cohort
ORDER BY c.cohort_date, days_since_cohort;
```

Esta query ya no escanea la tabla de eventos de terabytes, solo hace un join pequeño. En BigQuery, para 10 millones de usuarios tarda ~2 segundos y cuesta $0.02 — una reducción de costo del 96%.

## Estrategia de Particiones: Qué Fecha Va a Qué Partición

En tablas de cohortes, la estrategia de particiones es crítica porque hay dos dimensiones de tiempo: fecha de cohorte y fecha de actividad. La tabla `cohort_assignments` se particiona por `cohort_date` porque almacena el primer evento del usuario y la definición de cohorte es fija. Cuando llega un usuario nuevo, solo se agrega a la partición de hoy, las particiones históricas permanecen inmutables.

La tabla `daily_user_activity` se particiona por `activity_date` porque cada día llegan nuevos datos de actividad y los días pasados no cambian. Esta estructura es perfecta para refresh incremental: el job de dbt o Airflow solo escribe la partición de hoy, las particiones históricas no se tocan.

Sin embargo, el análisis de retención requiere un join entre dos fechas: cohort_date y activity_date. Para optimizar el rendimiento del join, usamos cluster keys. En BigQuery, `CLUSTER BY user_id` almacena físicamente las filas con el mismo user_id juntas, el join hace pruning a nivel de bloque y reduce E/S de disco. Sin cluster key, el join tarda ~8 segundos para 10 millones de usuarios; con cluster key baja a ~2 segundos.

El partition pruning también es crucial. El análisis de retención típicamente revisa cohortes de los últimos 90 días. El filtro `WHERE c.cohort_date >= '2026-05-01'` activa partition pruning, BigQuery lee solo las particiones relevantes. Sin partition pruning, el costo de la query en 2 años de datos es ~$0.50; con partition pruning es ~$0.02 — porque los datos escaneados se reducen 24 veces.

Hay un trade-off en la estrategia de particiones: las particiones diarias facilitan el refresh incremental pero demasiadas particiones (1000+) aumentan el overhead de query planning en BigQuery. Por eso los datos de cohortes con más de 2 años deben archivarse o consolidarse en particiones mensuales.

## Refresh Incremental: Calcula Solo los Datos Nuevos

Las tablas de cohortes deben actualizarse diariamente porque llegan usuarios nuevos y el comportamiento de retención de cohortes existentes se actualiza. Sin embargo, hacer un refresh completo — recalcular toda la tabla — es un costo innecesario. La solución: el patrón incremental build.

En dbt, un modelo incremental se define así:

```sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'cohort_date', 'data_type': 'date'},
    cluster_by=['user_id'],
    incremental_strategy='insert_overwrite'
  )
}}

SELECT
  user_id,
  MIN(DATE(event_timestamp)) AS cohort_date,
  COUNTIF(event_name = 'purchase') AS total_purchases
FROM {{ source('raw', 'events') }}
WHERE DATE(event_timestamp) = CURRENT_DATE() - 1
{% if is_incremental() %}
  AND DATE(event_timestamp) > (SELECT MAX(cohort_date) FROM {{ this }})
{% endif %}
GROUP BY user_id
```

Este modelo calcula solo la partición de ayer cada día. La estrategia `insert_overwrite` borra la partición existente y escribe la nueva. En BigQuery, el reemplazo a nivel de partición es atómico, las queries downstream nunca leen datos incompletos.

Para la tabla `daily_user_activity`, la lógica incremental es más simple porque cada día agrega una partición nueva, las particiones históricas nunca cambian:

```sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'activity_date', 'data_type': 'date'},
    cluster_by=['user_id']
  )
}}

SELECT
  user_id,
  DATE(event_timestamp) AS activity_date,
  TRUE AS is_active
FROM {{ source('raw', 'events') }}
WHERE DATE(event_timestamp) = CURRENT_DATE() - 1
{% if is_incremental() %}
  AND DATE(event_timestamp) NOT IN (SELECT DISTINCT activity_date FROM {{ this }})
{% endif %}
GROUP BY user_id, activity_date
```

Con refresh incremental, el tiempo del job diario baja de 5 minutos a 30 segundos. El uso de slots de BigQuery cae 80%, no hay espera en la queue. Cuando el equipo de analytics abre el dashboard a las 9 AM, la retención de ayer ya está lista.

Sin embargo, el incremental build tiene un riesgo: late-arriving data. Si el pipeline de eventos tiene 2-3 horas de retraso, la partición de ayer contiene datos incompletos. Hay dos enfoques para resolver esto: (1) parámetro `lookback_window` en dbt — recalcula los últimos 3 días cada vez; (2) usar metadatos de BigQuery `_PARTITIONTIME` para filtrar por tiempo de inserción de partición. El segundo enfoque es más efectivo porque solo reprocesa eventos que llegaron tarde.

## Optimización de Costo de Queries: Tamaño de Tabla y Patrón de Escaneo

El costo de las tablas de cohortes depende de dos factores: tamaño de tabla (GB) y patrón de escaneo de queries. La tabla `cohort_assignments` para 10 millones de usuarios ocupa ~500 MB; `daily_user_activity` en una ventana de 90 días ocupa ~5 GB. Cuando estas dos tablas se hacen join, BigQuery escanea ~6 GB, el costo es ~$0.03. Si el mismo análisis se hiciera en la tabla de eventos raw, escanearía 500 GB y costaría ~$2.50 — una diferencia de 80x.

Para reducir el costo aún más, usamos una tabla pre-aggregated de resumen de retención de cohortes:

```sql
CREATE TABLE `project.dataset.cohort_retention_summary`
PARTITION BY cohort_date
CLUSTER BY days_since_cohort
AS
SELECT
  c.cohort_date,
  DATE_DIFF(a.activity_date, c.cohort_date, DAY) AS days_since_cohort,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT a.user_id) AS active_users,
  SAFE_DIVIDE(COUNT(DISTINCT a.user_id), COUNT(DISTINCT c.user_id)) AS retention_rate
FROM `project.dataset.cohort_assignments` c
LEFT JOIN `project.dataset.daily_user_activity` a
  ON c.user_id = a.user_id
  AND a.activity_date >= c.cohort_date
GROUP BY c.cohort_date, days_since_cohort;
```

Esta tabla almacena la tasa de retención pre-computada para cada combinación cohorte-día. El tamaño es ~100 MB (10 millones de usuarios × 90 días = 900 millones de filas → después de aggregation ~50,000 filas). El dashboard lee esta tabla, no hace joins, la query tarda <1 segundo y cuesta ~$0.001.

Otra consideración importante en optimización de costo es evitar `SELECT *`. En análisis de cohortes, solo se necesitan `user_id`, `cohort_date`, `activity_date`. Si `daily_user_activity` contiene columnas extras como event_name, session_id, y usas `SELECT *`, se escanean datos innecesarios. BigQuery usa almacenamiento columnar, seleccionar solo las columnas necesarias reduce E/S de disco 40-50%.

La última optimización es usar BigQuery BI Engine. BI Engine cachea en memoria la tabla de resumen de cohortes, las queries del dashboard se devuelven con latencia sub-segundo. Una reserva de BI Engine para una tabla de 100 MB cuesta ~$10/mes, pero el ahorro en costo de queries ejecutando 1000 queries al día es ~$30/mes — ganancia neta.

## Pipeline de Retention Engineering: dbt + Airflow + Alerting

En producción, la arquitectura de cohortes no es solo SQL, requiere orquestación y monitoreo. El pipeline de retención tiene estos componentes:

1. **DAG de Airflow:** Se dispara cada mañana a las 06:00, valida la tabla de eventos a nivel de partición (control de late-arriving data).
2. **Modelos incremental de dbt:** Actualiza `cohort_assignments`, `daily_user_activity`, `cohort_retention_summary` secuencialmente.
3. **Data quality tests:** Los tests de dbt validan constraints como cohort_size > 0, retention_rate BETWEEN 0 AND 1.
4. **Alerting:** Si la tasa de retención Day 1 de hoy está 20% por debajo del promedio de la semana pasada, envía una alerta a Slack.

Para construir este pipeline, se requiere la infraestructura de [CDP & Retention Engineering](https://www.roibase.com.tr/es/retention-engineering-cdp) — desde recolección de eventos hasta definición de cohortes, optimización en BigQuery hasta integración de dashboards end-to-end.

En modelos de dbt, puedes usar macros para hacer parametrizable la definición de cohorte:

```sql
{% macro cohort_definition(event_name) %}
  SELECT user_id, MIN(DATE(event_timestamp)) AS cohort_date
  FROM {{ source('raw