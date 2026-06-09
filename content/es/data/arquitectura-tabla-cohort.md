---
title: "Arquitectura de Tabla Cohort: Escalado de Análisis de Retención en Production"
description: "Diseño de arquitectura que procesa 100M+ eventos diarios en tablas cohort en 5 segundos usando materialized views, particionamiento y optimización de costos de query."
publishedAt: 2026-06-09
modifiedAt: 2026-06-09
category: data
i18nKey: data-007-2026-06
tags: [cohort-analysis, bigquery, materialized-views, query-optimization, retention-engineering]
readingTime: 8
author: Roibase
---

Cuando trasladas métricas de retención a un dashboard en tiempo real, el primer impacto llega en el costo de la query. Una consulta cohort básica —"¿cuántos usuarios registrados el 1 de enero seguían activos el día 7?"— escrita de forma ingenua escanea 200GB de datos, tarda 18 segundos y genera un costo de $4. Para un equipo que accede al dashboard 500 veces al día, este cálculo suma $60.000 mensuales. El problema no está en tu capacidad analítica, sino en la arquitectura de las tablas. El análisis de cohort en production requiere almacenar snapshots de cohort, no datos de eventos sin procesar.

## Naive Cohort Query: Por Qué No Escala

Una consulta cohort clásica une tres tablas: `users`, `events` y `cohort_definitions`. Cada query escanea la tabla `events` completa sin filtro de partición. Con 100M eventos diarios, este enfoque es insostenible.

```sql
-- ❌ Anti-pattern: Escanea todos los events cada vez
SELECT 
  DATE_TRUNC(u.created_at, DAY) AS cohort_date,
  DATE_DIFF(e.event_date, u.created_at, DAY) AS day_n,
  COUNT(DISTINCT u.user_id) AS retained_users
FROM users u
JOIN events e ON u.user_id = e.user_id
WHERE u.created_at >= '2026-01-01'
  AND e.event_name = 'session_start'
GROUP BY 1, 2
ORDER BY 1, 2;
```

Esta consulta escanea 480GB para 6 meses de datos. En BigQuery, con utilización de slots, tarda 12 segundos y se factura como $2.40 (on-demand pricing: $5/TB). Si multiplicas el mismo cohort por 20 métricas diferentes (revenue, session count, conversion rate), el costo sube a $48. Si el dashboard se refresca 100 veces al día, el costo mensual alcanza $144.000. Para adaptar esto a production a escala, hay dos estrategias: **materialización incremental** y **snapshots pre-agregados de cohort**.

### Materialización Incremental: Pipeline Event-to-Cohort con dbt

En lugar de calcular cohorts cada vez, actualiza tablas cohort acumuladas con batches diarios. La estrategia `incremental` de dbt permite agregar los eventos del nuevo día a la tabla cohort existente.

```sql
-- models/cohort_retention_daily.sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'cohort_date', 'data_type': 'date'},
    cluster_by=['day_n', 'metric_name'],
    unique_key='cohort_date || day_n || metric_name'
  )
}}

WITH new_events AS (
  SELECT 
    u.user_id,
    DATE_TRUNC(u.created_at, DAY) AS cohort_date,
    DATE_DIFF(e.event_date, u.created_at, DAY) AS day_n,
    e.event_name,
    e.revenue_usd
  FROM {{ ref('events') }} e
  JOIN {{ ref('users') }} u ON e.user_id = u.user_id
  {% if is_incremental() %}
  WHERE e.event_date = CURRENT_DATE() - 1  -- Solo datos de ayer
  {% endif %}
)
SELECT
  cohort_date,
  day_n,
  'active_users' AS metric_name,
  COUNT(DISTINCT user_id) AS metric_value
FROM new_events
WHERE event_name = 'session_start'
GROUP BY 1, 2, 3

UNION ALL

SELECT
  cohort_date,
  day_n,
  'revenue_per_cohort' AS metric_name,
  SUM(revenue_usd) AS metric_value
FROM new_events
GROUP BY 1, 2, 3;
```

En la primera ejecución (full refresh), se procesa todo el histórico. Cada día posterior, solo se agregan 1 día de nuevos eventos. Un día de 100M eventos escanea 3.2GB (gracias a partition + cluster), la query tarda 4 segundos y cuesta $0.016. Costo mensual incremental total: $0.48 — una millonésima parte del método ingenuo.

## Materialized Views: Capa de Cache Automática de BigQuery

El modelo incremental se actualiza por lotes (una vez al día). Para un dashboard en tiempo real que requiera datos de la última hora, entra en juego la característica **materialized view** de BigQuery. Una materialized view almacena físicamente el resultado de una query base y se refresca automáticamente cuando la tabla fuente cambia.

```sql
CREATE MATERIALIZED VIEW `project.dataset.cohort_retention_mv`
PARTITION BY cohort_date
CLUSTER BY day_n, metric_name
AS
SELECT
  DATE_TRUNC(u.created_at, DAY) AS cohort_date,
  DATE_DIFF(e.event_date, u.created_at, DAY) AS day_n,
  'active_users' AS metric_name,
  COUNT(DISTINCT u.user_id) AS metric_value
FROM `project.dataset.events` e
JOIN `project.dataset.users` u ON e.user_id = u.user_id
WHERE e.event_date >= CURRENT_DATE() - 90  -- Solo ventana de 90 días
  AND e.event_name = 'session_start'
GROUP BY 1, 2, 3;
```

Al consultar una materialized view, BigQuery primero devuelve el resultado cacheado. Cuando la tabla base cambia (se agregan nuevos eventos), se calcula el delta en segundo plano. La query del dashboard ahora tarda 0.2 segundos, y el costo es $0 (cache hit). Sin embargo, ten en cuenta que la propia materialized view genera un costo de almacenamiento (BigQuery storage: $0.02/GB/mes), y una tabla cohort de 90 días de 12GB suma $0.24 mensuales en overhead.

**Tabla de compensaciones:**

| Método | Duración Primera Query | Duración Query Dashboard | Costo Compute Mensual | Costo Storage Mensual |
|--------|------------------------|--------------------------|------------------------|------------------------|
| Naive JOIN | 12s | 12s | $144.000 | $0 |
| dbt Incremental | 4s (primer batch) | 2s (lectura snapshot) | $0.48 | $0.18 (tabla snapshot) |
| Materialized View | 8s (primer build) | 0.2s (cache hit) | $0 (refresh automático) | $0.24 |

En production, la combinación de ambas es ideal: **modelo incremental dbt** actualiza cohorts históricos con batch diario, mientras que **materialized view** mantiene los últimos 7 días en tiempo real.

## Particionamiento y Clustering: Reducir Costo de Query en 97%

Sin particionar y clusterizar tablas cohort, BigQuery escanea toda la tabla en cada query. En una tabla cohort de 1TB (2 años de datos), una sola consulta "mostrar cohort de enero 2026" escanea 1TB, facturando $5. Con partition + cluster, la misma query escanea 8GB, pagando $0.04.

**Estrategia de particionamiento:** particiona por `cohort_date` con granularidad diaria. Cuando BigQuery ve un filtro de partición en la query, escanea solo las particiones relevantes.

```sql
CREATE OR REPLACE TABLE `project.dataset.cohort_retention`
PARTITION BY cohort_date
CLUSTER BY day_n, metric_name
AS
SELECT * FROM `project.dataset.cohort_retention_temp`;
```

**Clustering:** dentro de cada partición, designa los campos filtrados frecuentemente (ej. `day_n`, `metric_name`) como clusters. BigQuery aplica block-level pruning. Una query "mostrar retención day_7 + métrica active_users" escanea solo los bloques relevantes.

Ejemplo concreto: 365 particiones (diarias), cada una de 3GB. Sin clustering, un filtro "day_7" escanea 365 particiones × 3GB = 1TB. Con clustering, solo se leen los bloques `day_n=7`, totalizando 12GB. Diferencia de costo: $5 → $0.06.

**Anti-pattern:** no clusterices por `user_id`. El análisis cohort es agregación a nivel cohort, no a nivel usuario. Ordenar por `user_id` no ayuda al query planner y reduce la eficiencia de cache.

## Resolución de Identidad para Precisión de Cohort

La precisión del análisis cohort depende de la precisión de `user_id`. Cuando una sesión basada en cookies + una sesión post-login pertenecen al mismo usuario, un JOIN ingenuo crea dos registros cohort distintos. Resolvemos este problema con [First-Party Data & Arquitectura de Medición](https://www.roibase.com.tr/es/firstparty): construimos un identity graph entre `client_id` anónimo y `user_id` autenticado.

```sql
-- Tabla de resolución de identidad
CREATE TABLE `project.dataset.identity_graph` (
  canonical_user_id STRING,
  client_id STRING,
  user_id STRING,
  merged_at TIMESTAMP
)
PARTITION BY DATE(merged_at)
CLUSTER BY canonical_user_id;

-- Uní con query cohort
WITH resolved_users AS (
  SELECT 
    COALESCE(ig.canonical_user_id, e.user_id) AS user_id,
    e.event_date,
    e.event_name
  FROM events e
  LEFT JOIN identity_graph ig 
    ON e.client_id = ig.client_id OR e.user_id = ig.user_id
)
SELECT 
  DATE_TRUNC(u.created_at, DAY) AS cohort_date,
  DATE_DIFF(r.event_date, u.created_at, DAY) AS day_n,
  COUNT(DISTINCT r.user_id) AS retained_users
FROM resolved_users r
JOIN users u ON r.user_id = u.user_id
GROUP BY 1, 2;
```

Sin resolución de identidad, los cohorts se inflan 12-18% (un usuario se registra con dos IDs distintos). Este error distorsiona métricas de retención: el denominador (tamaño del cohort) crece pero el numerador (actividad en day_n) permanece igual, haciendo parecer la retención más baja.

## Monitoreo de Costo de Query: Monitoreo de Production con INFORMATION_SCHEMA

Después de construir la arquitectura cohort, debes optimizar continuamente el costo de queries. La tabla `INFORMATION_SCHEMA.JOBS` de BigQuery muestra cuántos bytes escanea cada query, utilización de slots y costo total.

```sql
SELECT
  user_email,
  query,
  total_bytes_processed / POW(10, 12) AS tb_processed,
  (total_bytes_processed / POW(10, 12)) * 5 AS cost_usd,
  total_slot_ms / 1000 / 60 AS slot_minutes
FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
  AND statement_type = 'SELECT'
  AND query LIKE '%cohort_retention%'
ORDER BY total_bytes_processed DESC
LIMIT 20;
```

Esta query lista las queries a tablas cohort de los últimos 7 días ordenadas por costo. Si un panel de dashboard se gatilla 500 veces diarias y escanea 80GB cada vez (indica falta de filtro de partición), genera $200 de costo diario. Agregar un filtro `WHERE cohort_date >= CURRENT_DATE() - 30` en la query del panel reduce el costo a $6.

**Checklist de production:**
- [ ] ¿Todas las tablas cohort están particionadas por `cohort_date`?
- [ ] ¿`day_n` y `metric_name` están clusterizados?
- [ ] ¿El job incremental de dbt se ejecuta diariamente?
- [ ] ¿La materialized view está limitada a ventana de 90 días?
- [ ] ¿Las queries del dashboard tienen filtro `WHERE cohort_date >= ...`?
- [ ] ¿Se recopila reporte de costo semanal con `INFORMATION_SCHEMA`?

Cuando la arquitectura cohort está correctamente implementada, el análisis de retención en dashboard alcanza madurez production: 100M eventos diarios, 5 segundos de tiempo de query, $10 de costo mensual de compute. Pero esta arquitectura requiere resolución de identidad first-party, estandarización de esquema de eventos y disciplina en pipeline dbt — por eso retention engineering es una plataforma, no SQL de una sola vez.