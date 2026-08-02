---
title: "dbt + BigQuery: Modern Marketing Data Stack"
description: "Source mapping, modeling layer, semantic layer, exposures — arquitectura que conecta data de marketing a mecanismos de decisión e implementación práctica de dbt."
publishedAt: 2026-08-02
modifiedAt: 2026-08-02
category: verianalizi
i18nKey: data-002-2026-08
tags: [dbt, bigquery, data-stack, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

Los equipos de marketing ya no usan reportes listos de Google Analytics, sino pipelines de datos donde escriben sus propias reglas. En 2026, el modern marketing data stack se compone de tres capas: fuentes raw, modeling layer, semantic layer. Este artículo explica cómo construir estas tres capas con dbt + BigQuery, qué tipo de errores ocurren en cada etapa y cómo mantener una arquitectura sostenible en production.

## Source mapping: Cargar datos a BigQuery no es suficiente

Subiste GA4, Meta Ads, eventos de sGTM a BigQuery — pero es solo el comienzo. Source mapping significa transformar tablas raw en contratos significativos. En dbt, las definiciones de source viven en archivos `.yml`:

```yaml
sources:
  - name: raw_ga4
    database: roibase-prod
    schema: analytics_123456789
    tables:
      - name: events_*
        identifier: events_*
        loaded_at_field: event_timestamp
        freshness:
          warn_after: {count: 12, period: hour}
```

Esta definición logra tres cosas: (1) Data lineage — qué modelo usa qué tabla raw, (2) Freshness check — si el evento más reciente es más antiguo que 12 horas, genera alerta, (3) Contract — si falta la columna `event_timestamp`, el build falla.

**Error más común:** Usar el schema raw tal cual. Escribir SQL sin aplanar el array `event_params` de GA4; cada consulta termina siendo 200+ líneas. La lógica de `unnest` debe vivir en un único lugar en source mapping:

```sql
-- models/staging/stg_ga4_events.sql
with source as (
  select * from {{ source('raw_ga4', 'events_*') }}
),

flattened as (
  select
    event_date,
    event_timestamp,
    user_pseudo_id,
    (select value.string_value from unnest(event_params) where key = 'session_id') as session_id,
    (select value.int_value from unnest(event_params) where key = 'ga_session_number') as session_number
  from source
)

select * from flattened
```

Ahora este modelo se llama downstream como `ref('stg_ga4_events')` — la sintaxis raw event_params está aislada arriba. El freshness check corre cada día; si el schema cambia, el error es automático.

## Modeling layer: Define la métrica una vez, úsala cien veces

Después de staging viene el modeling layer. Aquí se separan intermediate models (business logic) y mart models (aggregation). En marketing data stack, el modelo más crítico es el **join session → transaction**:

```sql
-- models/marts/mrt_session_metrics.sql
with sessions as (
  select * from {{ ref('int_sessions') }}
),

transactions as (
  select * from {{ ref('int_transactions') }}
),

joined as (
  select
    s.session_id,
    s.session_date,
    s.traffic_source,
    s.medium,
    s.campaign,
    t.transaction_id,
    t.revenue,
    t.transaction_timestamp
  from sessions s
  left join transactions t
    on s.session_id = t.session_id
)

select
  session_date,
  traffic_source,
  medium,
  campaign,
  count(distinct session_id) as sessions,
  count(distinct transaction_id) as transactions,
  sum(revenue) as total_revenue,
  safe_divide(count(distinct transaction_id), count(distinct session_id)) as conversion_rate
from joined
group by 1, 2, 3, 4
```

Este modelo corre cada día a las 03:00 (scheduler dbt Cloud), Looker Studio se conecta directamente a esta tabla. Si necesitas cambios, editas el SQL en un único lugar; todos los dashboards se actualizan automáticamente.

**Detalle importante:** Uso de `safe_divide` — si sessions = 0, no genera error de división por cero, devuelve null. En un pipeline production, el exception handling ocurre en este nivel.

### dbt tests: Validación automática de calidad

Al definir métricas en el modeling layer, también escribes tests:

```yaml
# models/marts/schema.yml
models:
  - name: mrt_session_metrics
    columns:
      - name: session_date
        tests:
          - not_null
      - name: sessions
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"
      - name: conversion_rate
        tests:
          - dbt_utils.expression_is_true:
              expression: "<= 1"
```

El comando `dbt test` ejecuta estas reglas. Si conversion_rate > 1 (hay un error en el SQL), el build falla y envía alerta a Slack. En lugar de QA manual, tienes validación automática de datos — el resto del data stack descansa sobre este cimiento.

## Semantic layer: Define la métrica, no la consulta

Con dbt v1.6+, el semantic layer salió de beta. Ahora defines métricas en `.yml`, no en SQL:

```yaml
# models/semantic/metrics.yml
metrics:
  - name: total_revenue
    label: Total Revenue
    model: ref('mrt_session_metrics')
    type: sum
    sql: total_revenue
    timestamp: session_date
    time_grains: [day, week, month]

  - name: roas
    label: Return on Ad Spend
    type: ratio
    numerator: total_revenue
    denominator: total_ad_spend
```

Esta definición se usa en tres lugares: (1) Looker Studio, (2) Slack bot consultando dbt Cloud discovery API por métricas, (3) DAG de Airflow alimentando un pipeline ML downstream.

**Ventaja:** Consumes métricas sin escribir SQL. El analista de marketing ahora escribe "Show me ROAS by campaign, last 7 days" y dbt semantic layer compila la consulta automáticamente. La lógica SQL está en el modeling layer, la definición métrica en semantic layer — completamente separadas, cambios aislados.

**Advertencia:** El semantic layer aún es nuevo — no todos los BI tools lo integran nativamente. En el stack production de Roibase, usamos enfoque híbrido: métricas críticas en semantic layer, análisis custom vía SQL exposures.

### Exposures: Documenta dependencias downstream

Los exposures muestran dónde se consume un modelo de dbt fuera de dbt:

```yaml
# models/exposures.yml
exposures:
  - name: looker_studio_performance_dashboard
    type: dashboard
    url: https://lookerstudio.google.com/...
    depends_on:
      - ref('mrt_session_metrics')
      - ref('mrt_campaign_performance')
    owner:
      name: Marketing Analytics Team
      email: analytics@roibase.com.tr
```

Esta definición se visualiza en dbt docs — qué dashboard depende de qué modelo. Si cambias el schema, con `dbt run --select +mrt_session_metrics+` ves el impacto downstream.

**Caso real:** GA4 cambió el key `page_location` a `page_url` en event_params. Gracias a las exposures, encontramos 3 dashboards y 1 DAG de Airflow afectados; la migración tomó 2 horas. Sin exposures, los dashboards simplemente se hubiesen roto silenciosamente.

## Incremental models: No hagas full refresh de 2TB cada día

En marketing data, las particiones diarias alcanzan escala de terabytes. No puedes hacer full refresh en cada `dbt run` — costo y tiempo en BigQuery son inaceptables. Usas modelos incremental:

```sql
-- models/marts/mrt_user_journey.sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'event_date', 'data_type': 'date'},
    cluster_by=['user_pseudo_id', 'traffic_source'],
    incremental_strategy='insert_overwrite'
  )
}}

select
  event_date,
  user_pseudo_id,
  traffic_source,
  -- ...
from {{ ref('stg_ga4_events') }}

{% if is_incremental() %}
  where event_date >= date_sub(current_date(), interval 3 day)
{% endif %}
```

Esta configuración logra tres cosas: (1) Crea particiones en BigQuery — agrega el día nuevo sin tocar datos antiguos, (2) `cluster_by` mejora performance de consultas, (3) `insert_overwrite` strategy — reescribe los últimos 3 días (para capturar datos que llegan tarde).

**Diferencia de costo:** 365 días, full refresh = 2.5 TB scanned ($12.50), incremental = 3 GB scanned ($0.015). Para un pipeline diario, la diferencia anual es ~$4500 vs ~$5. Por eso los modelos incremental son fundamentales en production.

## Conectar el data stack al mecanismo de decisión

Construiste la infraestructura dbt + BigQuery, pero el valor real está en decisiones de marketing. El flujo típico es semantic layer → bot de Slack → métrica on-demand:

1. Marketing manager escribe en Slack: `/metric roas last_30_days campaign=brand`
2. Slack app llama dbt Cloud semantic layer API
3. La API consulta tabla `mrt_session_metrics`, calcula ROAS
4. Resultado vuelve a Slack: "Campaña brand ROAS: 4.2x"

Para este flujo necesitas semantic layer + middleware Python custom. En production de Roibase, un DAG de Airflow toma daily snapshots del semantic layer; Looker Studio y apps internas consumen estos snapshots — sin problemas de rate limit en API.

**Enfoque alternativo:** Stack híbrido con [Estrategia de Datos First-Party & Medición](https://www.roibase.com.tr/es/firstparty) — dbt semantic layer + Cube.js. Cube.js agrega caching, mejora performance en BI. La elección depende de volumen de datos y patrones de consulta.

## Checklist production: Antes de deployar el stack dbt

dbt funciona en local — antes de enviar a production, valida esto:

- **CI/CD:** dbt Cloud o GitHub Actions ejecuta `dbt build --select state:modified+` en cada commit
- **Freshness monitoring:** Define `warn_after` y `error_after` para fuentes críticas
- **Alerting:** Webhooks dbt Cloud → Slack; el equipo se enterea en 5 minutos si un build falla
- **Documentation:** `dbt docs generate` corre automático, artifacts van a S3/GCS
- **Cost monitoring:** BigQuery slot reservation o alerta on-demand — threshold $500/day para spikes inesperados
- **Backup strategy:** Snapshot tables en production warehouse — si un modelo se actualiza mal, puedes rollback

**Regla crítica:** Cero `dbt run` manual en production. Todo vía scheduler (dbt Cloud, Airflow, Prefect). El run manual rompe data lineage; en error, no hay root cause analysis.

dbt + BigQuery es la columna vertebral del modern marketing data stack — source mapping conectó datos raw a contratos, modeling layer definió métricas en un punto, semantic layer permitió consumirlas sin SQL. En production, incremental models y test coverage hacen el pipeline sostenible. El siguiente nivel: conectar este data a activación real-time — CDP, audience sync, incremental measurement. Pero eso es otra conversación de data stack.