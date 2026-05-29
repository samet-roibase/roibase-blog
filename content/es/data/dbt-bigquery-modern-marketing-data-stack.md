---
title: "dbt + BigQuery: Stack moderno de datos de marketing"
description: "Source mapping, modeling layer, semantic layer, exposures: arquitectura production-ready que conecta datos de marketing con mecanismos de decisión."
publishedAt: 2026-05-29
modifiedAt: 2026-05-29
category: data
i18nKey: data-002-2026-05
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Los equipos de marketing siguen diciendo "no sé si la campaña funciona sin mirar el dashboard". El analista escribe SQL nuevo en cada pregunta. El CFO no entiende por qué el CAC varía en cada reporte. El problema no es técnico — tienes pipeline, fuentes conectadas, datos fluyendo. El problema está en la arquitectura: entre tablas raw y dashboard no hay capa de definiciones. La combinación dbt + BigQuery resuelve esto: con source mapping, modeling layer, semantic layer y exposures, estandarizas la lógica de datos, no solo en visuales, sino en la capa de significado.

## Source Mapping: Contrato con datos raw

Los datos llegan a BigQuery desde CRM, GA4, Meta Ads, Klaviyo. Cada fuente trae esquema distinto, convenciones de nombres diferentes, formatos de timestamp inconsistentes. El source mapping de dbt te deja declarar esas fuentes como código, probándolas y monitoreándolas. En `sources.yml` declares cada tabla, defines freshness checks, escribes tests de constraints.

Ejemplo de source:

```yaml
version: 2

sources:
  - name: raw_ga4
    database: analytics_lake
    schema: raw_ga4_events
    tables:
      - name: events
        freshness:
          warn_after: {count: 6, period: hour}
          error_after: {count: 12, period: hour}
        columns:
          - name: event_timestamp
            tests:
              - not_null
          - name: user_pseudo_id
            tests:
              - not_null
```

Este contrato dice: "Si el evento GA4 no llega en 6 horas, avisa; si no llega en 12, detén la pipeline." En production, este test se liga a CI/CD, detectas problemas de fuente al instante. dbt docs genera automáticamente el lineage — ves cuál dashboard depende de cuál source.

Sin source mapping, el analista comienza con `SELECT * FROM analytics_lake.raw_ga4_events.events`. Sin idea de qué significa cada columna, sin tests, sin documentación. Con dbt, referencías la fuente: `{{ source('raw_ga4', 'events') }}`. Si el nombre de tabla cambia, actualizas un lugar y todos los modelos downstream se adaptan.

## Modeling Layer: Staging, Intermediate, Mart

El poder de dbt está en las capas de modelado. Las separas en tres niveles: staging (normaliza formato raw), intermediate (aplica lógica de negocio), mart (tablas de métricas finales).

**Staging layer:** Un modelo por source, 1:1. Solo conversión de tipos, renombramiento de columnas, timestamps a UTC. Sin lógica de negocio.

```sql
-- models/staging/stg_ga4__events.sql
WITH source AS (
    SELECT * FROM {{ source('raw_ga4', 'events') }}
)

SELECT
    TIMESTAMP_MICROS(event_timestamp) AS event_at,
    user_pseudo_id AS user_id,
    event_name,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_url
FROM source
WHERE event_date >= CURRENT_DATE() - 90
```

**Intermediate layer:** Aplica lógica de negocio. Define sesiones, mapea categorías de producto, aplica ventanas de atribución. No va a usuarios finales — solo alimenta modelos downstream.

```sql
-- models/intermediate/int_sessions.sql
WITH events AS (
    SELECT * FROM {{ ref('stg_ga4__events') }}
),

session_windows AS (
    SELECT
        user_id,
        event_at,
        SUM(CASE WHEN TIMESTAMP_DIFF(event_at, LAG(event_at) OVER (PARTITION BY user_id ORDER BY event_at), MINUTE) > 30 THEN 1 ELSE 0 END) 
            OVER (PARTITION BY user_id ORDER BY event_at) AS session_index
    FROM events
)

SELECT
    user_id,
    session_index,
    MIN(event_at) AS session_start_at,
    MAX(event_at) AS session_end_at,
    COUNT(*) AS event_count
FROM session_windows
GROUP BY 1, 2
```

**Mart layer:** Tablas de métricas finales. Va a dashboard, BI tool, Looker. Usa prefijo `fct_` (fact) o `dim_` (dimension).

```sql
-- models/marts/fct_daily_channel_performance.sql
SELECT
    DATE(session_start_at) AS date,
    traffic_source.medium AS channel,
    COUNT(DISTINCT user_id) AS users,
    SUM(revenue) AS revenue,
    SAFE_DIVIDE(SUM(revenue), COUNT(DISTINCT user_id)) AS revenue_per_user
FROM {{ ref('int_sessions') }}
LEFT JOIN {{ ref('int_transactions') }} USING (user_id, session_index)
GROUP BY 1, 2
```

Con esta estructura, el analista usa `fct_daily_channel_performance`, nunca toca staging/intermediate. Si la definición de métrica cambia, actualizas un lugar; todos los dashboards convergen a la misma verdad.

## Semantic Layer: Métrica como código

En BigQuery + dbt, la "semantic layer" se implementa de dos formas: dbt metrics (deprecated en 2023) o dbt semantic models (nuevo enfoque). Un semantic model abstrae la métrica del SQL, la define en YAML. Herramientas como Looker, Tableau, Mode leen esta definición, calculan CAC, LTV, ROAS de forma consistente.

Ejemplo semantic model:

```yaml
# models/marts/semantic_models.yml
semantic_models:
  - name: channel_performance
    model: ref('fct_daily_channel_performance')
    dimensions:
      - name: date
        type: time
        type_params:
          time_granularity: day
      - name: channel
        type: categorical
    measures:
      - name: total_revenue
        agg: sum
        expr: revenue
      - name: total_users
        agg: count_distinct
        expr: user_id

metrics:
  - name: revenue_per_user
    type: derived
    type_params:
      expr: total_revenue / total_users
      metrics:
        - total_revenue
        - total_users
```

Con esta definición, "revenue per user" se calcula igual en todos lados. El analista selecciona "RPU" en Looker, el backend extrae del semantic layer, sin SQL manual. Si cambia la definición (excluye pedidos cancelados), se actualiza en un lugar.

Sin semantic layer, cada dashboard rescribe "revenue / users". Un reporte excluye reembolsos, otro incluye. El CMO ve dos números distintos, pierde confianza. [Estrategia de datos de primera parte y arquitectura de medición](https://www.roibase.com.tr/es/firstparty) requiere esta capa en production — atribución, consentimiento, señales TCF, todos definidos en código.

## Exposures: Rastreo de uso final de datos

Una exposure de dbt responde: "¿a cuál dashboard, pipeline ML u operación va este modelo?" Lo defines en `exposures.yml`:

```yaml
exposures:
  - name: marketing_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: "Dashboard diario de performance por canal para CMO"
    depends_on:
      - ref('fct_daily_channel_performance')
    owner:
      name: Marketing Analytics Team
      email: analytics@company.com
```

Las exposures dan dos cosas: **impact analysis** (¿qué dashboard se rompe si cambio este modelo?) y **stakeholder mapping** (¿quién es dueño del dashboard, a quién escalo?).

En production, funciona así: dbt build → test falla → lineage graph muestra exposures afectadas → notificación automática a Slack → dueño del dashboard se entera antes que usuario. "¿Por qué el dashboard está vacío?" dejaría de ser una pregunta del usuario, sería un alert del sistema.

Sin exposures, data team deploya en silencio, no sabe a quién afecta. Con exposures, cada modelo lleva etiqueta "este dato está vivo en production, no toques sin comunicar".

## Incremental Models y Partitioning: Costo + velocidad

En BigQuery, cada escaneo de tabla es caro. 1 TB procesado = $5; 10 queries diarias = $50; mensual = $1500. Los incremental models de dbt procesan solo filas nuevas, datos históricos quedan inmutables.

```sql
{{ config(
    materialized='incremental',
    unique_key='event_id',
    partition_by={'field': 'event_at', 'data_type': 'timestamp', 'granularity': 'day'},
    cluster_by=['user_id', 'event_name']
) }}

SELECT * FROM {{ ref('stg_ga4__events') }}
WHERE event_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 DAY)

{% if is_incremental() %}
    AND event_at > (SELECT MAX(event_at) FROM {{ this }})
{% endif %}
```

Esta config optimiza: procesa solo últimos 2 días, datos viejos intactos. `partition_by` activa partition pruning en BigQuery, `cluster_by` mejora selectividad de query. En el mismo dataset, reduce costo 90%.

En production, incremental models + dbt snapshot implementan SCD Type 2: rastrean cambios históricos en dimensiones (cambios de segmento de usuario, mapeos de categoría de producto). Cuando el analista pregunta "¿en qué segmento estaba el usuario X hace un mes?", consulta el snapshot y obtiene respuesta versátil en el tiempo.

## Production Pipeline: CI/CD, tests, alerts

El proyecto dbt vive en GitHub. Cada commit dispara CI:

1. **Lint:** `sqlfluff` valida formato SQL
2. **Test:** `dbt test` ejecuta schema tests (not_null, unique, foreign_key) y data tests (revenue > 0, session_duration < 24h)
3. **Build:** `dbt build --select state:modified+` reconstruye solo modelos cambiados
4. **Deploy:** Merge a production actualiza tablas en BigQuery

Si test falla, merge se bloquea. Ejemplo de data test:

```sql
-- tests/assert_no_negative_revenue.sql
SELECT * FROM {{ ref('fct_daily_channel_performance') }}
WHERE revenue < 0
```

Si devuelve 0 filas, pasa; si devuelve 1+, falla. Revenue negativa se detecta como anomalía, pipeline se detiene.

Alertas en production: programa job en dbt Cloud (ej. diario 06:00), envía notificación a Slack en `on-run-end`:

```yaml
on-run-end:
  - "{{ post_to_slack_on_failure() }}"
```

[Análisis de datos e ingeniería de retención](https://www.roibase.com.tr/es/verianalizi) requiere esta pipeline en production — 4-6 semanas: source mapping + staging + intermediate + mart + semantic model + exposure + tests + CI/CD.

## Tradeoff: complejidad vs control

dbt + BigQuery tiene curva de aprendizaje pronunciada. SQL no es suficiente — necesitas templating Jinja, YAML config, Git workflow, CI/CD. En equipos pequeños (1-2 analistas) este overhead puede ser excesivo — vistas BigQuery directas + Looker Studio arrancan más rápido.

Pero a escala (10+ dashboards, 50+ sources, 5+ analistas) sin dbt pierdes control. Cada analista escribe su SQL, definiciones de métricas se contradicen, no hay tests, documentación desaparece. dbt evita deuda técnica en lugar de pagarla después.

Alternativa: semantic layer con Looker LookML. LookML es como dbt (métricas como código) pero vendor lock-in, difícil ligar sources no-BigQuery. dbt es open source, portable — funciona con BigQuery, Snowflake, Redshift.

El stack moderno de marketing comienza con source mapping, escala con semantic layer, se observa con exposures. dbt + BigQuery codifica estas tres capas, pruebas, versionables, reproducibles. Garantizas consistencia de métrica sin mirar dashboards.