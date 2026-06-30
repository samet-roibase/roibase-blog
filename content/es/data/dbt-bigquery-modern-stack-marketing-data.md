---
title: "dbt + BigQuery: Modern Marketing Data Stack"
description: "Source mapping, modeling layer, semantic layer, exposures: transformar datos de marketing en mecanismo de decisión con arquitectura production-ready."
publishedAt: 2026-06-30
modifiedAt: 2026-06-30
category: verianalizi
i18nKey: data-002-2026-06
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Los equipos de marketing todavía producen reportes con tablas dinámicas de Excel, los equipos de datos reescriben SQL para cada pregunta nueva, los KPI no concuerdan entre departamentos. En 2026, tolerar este escenario es un error de ingeniería. El modern marketing data stack funciona en tres capas: integración de fuentes raw, capa de transformación, capa semántica. dbt + BigQuery ofrece estas tres capas a nivel production-grade — con control de versiones, cobertura de tests, y tracking de linaje incluidos.

## Source Mapping: Transportar Datos Raw a Zona Segura

Traer datos de marketing a BigQuery parece fácil: herramientas ETL como Fivetran, Stitch, o Airbyte escriben GA4, Meta Ads, Google Ads directamente en el esquema `raw_`. Pero después de 6 meses, cuando el esquema cambia, los modelos downstream explota. Las **definiciones de source** de dbt controlan este riesgo.

```yaml
# models/sources.yml
version: 2

sources:
  - name: ga4
    database: analytics_prod
    schema: raw_ga4
    tables:
      - name: events_*
        freshness:
          warn_after: {count: 6, period: hour}
          error_after: {count: 12, period: hour}
        loaded_at_field: event_timestamp
        columns:
          - name: event_name
            tests:
              - not_null
          - name: user_pseudo_id
            tests:
              - not_null
```

Una definición de source cumple tres funciones: **(1)** alarma en cambios upstream (la métrica `freshness` envía a Slack), **(2)** contrato de esquema (la lista de columns aparece como documentación), **(3)** tracking de linaje (dbt docs muestra cuáles modelos dependen de GA4). Si Fivetran cambia el esquema, recibirás un error al compilar dbt — sin explosiones en producción.

En la fase de source mapping, etiqueta también las señales de identidad: `user_id`, `client_id`, `fbclid`, `gclid`, `email_sha256`. Más adelante en la modeling layer, mapearás estas señales a un único `customer_id`. Perder señales en la tabla raw hace imposible el trabajo downstream.

### Estrategia de Tabla Particionada

La tabla wildcard `events_*` de GA4 es diaria (`events_20260630`). En dbt, define el source con wildcard y agrega filtro con `_TABLE_SUFFIX`:

```sql
-- models/staging/stg_ga4_events.sql
{{
  config(
    materialized='incremental',
    partition_by={'field': 'event_date', 'data_type': 'date'},
    cluster_by=['event_name', 'user_pseudo_id']
  )
}}

select
  parse_date('%Y%m%d', _table_suffix) as event_date,
  event_timestamp,
  event_name,
  user_pseudo_id,
  ...
from {{ source('ga4', 'events_*') }}
where _table_suffix >= format_date('%Y%m%d', date_sub(current_date(), interval 3 day))
{% if is_incremental() %}
  and parse_date('%Y%m%d', _table_suffix) > (select max(event_date) from {{ this }})
{% endif %}
```

Esta configuración escribe la tabla `stg_ga4_events` en BigQuery con particiones diarias, y el clustering en `event_name` + `user_pseudo_id` reduce el costo de query. La materialización incremental reduce el escaneo de 90 días de history a 3 días — reducción de costo de 30×.

## Modeling Layer: Codifica la Lógica de Negocio

La capa staging limpia el raw, la capa intermediate construye la lógica de join, la capa marts responde preguntas de negocio. dbt separa estas tres capas por estructura de carpetas: `staging/`, `intermediate/`, `marts/`.

**Ejemplo de staging** — estandariza columnas de Meta Ads:

```sql
-- models/staging/stg_meta_ads.sql
select
  date_start as report_date,
  campaign_id,
  campaign_name,
  spend as cost_usd,
  impressions,
  clicks,
  actions.value as conversions -- extrae del JSON anidado
from {{ source('meta_ads', 'ads_insights') }}
where date_start >= date_sub(current_date(), interval 90 day)
```

**Ejemplo de intermediate** — unifica todas las fuentes de paid media:

```sql
-- models/intermediate/int_paid_media_unified.sql
with meta as (
  select report_date, campaign_id, 'meta' as source, cost_usd, impressions, clicks, conversions
  from {{ ref('stg_meta_ads') }}
),
google as (
  select report_date, campaign_id, 'google' as source, cost_usd, impressions, clicks, conversions
  from {{ ref('stg_google_ads') }}
)

select * from meta
union all
select * from google
```

**Ejemplo de marts** — dashboard de performance diario:

```sql
-- models/marts/fct_daily_performance.sql
select
  report_date,
  source,
  sum(cost_usd) as total_cost,
  sum(impressions) as total_impressions,
  sum(clicks) as total_clicks,
  sum(conversions) as total_conversions,
  safe_divide(sum(clicks), sum(impressions)) as ctr,
  safe_divide(sum(cost_usd), sum(conversions)) as cpa
from {{ ref('int_paid_media_unified') }}
group by 1, 2
```

La función `ref()` construye el dependency graph de dbt. El comando `dbt run` ejecuta los modelos en orden de dependencia. Si `int_paid_media_unified` cambia, todos los mart tables downstream se reconstruyen automáticamente.

### Test Coverage

En producción, un reporte KPI incorrecto es un error de 6 cifras en e-commerce. Los tests genéricos de dbt agregan contrato a cada modelo:

```yaml
# models/marts/schema.yml
version: 2

models:
  - name: fct_daily_performance
    columns:
      - name: report_date
        tests:
          - not_null
          - unique
      - name: total_cost
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"
      - name: cpa
        tests:
          - dbt_utils.expression_is_true:
              expression: "is null or cpa >= 0"
```

El comando `dbt test` valida estos contratos. En el pipeline de CI/CD, si un test falla, el merge se bloquea — datos incorrectos nunca llegan a producción. En la investigación de [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/es/firstparty) de Roibase, apuntamos a 85% test coverage (métrica: líneas de código × campos críticos).

## Semantic Layer: Define la Métrica en Un Lugar

A finales de 2025, dbt Labs integró "MetricFlow" semantic layer en dbt Cloud. Cuando el equipo de marketing pide "conversion rate", el equipo de data no debe reescribir SQL — la definición de métrica debe existir en un único lugar. El archivo `metrics.yml` de dbt proporciona esta abstracción:

```yaml
# models/metrics.yml
version: 2

metrics:
  - name: conversion_rate
    label: Conversion Rate
    model: ref('fct_daily_performance')
    calculation_method: derived
    expression: "safe_divide(total_conversions, total_clicks)"
    timestamp: report_date
    time_grains: [day, week, month]
    dimensions:
      - source

  - name: cpa
    label: Cost Per Acquisition
    model: ref('fct_daily_performance')
    calculation_method: derived
    expression: "safe_divide(total_cost, total_conversions)"
    timestamp: report_date
    time_grains: [day, week, month]
    dimensions:
      - source
```

La semantic layer cumple dos funciones: **(1)** cuando se selecciona una métrica en la herramienta BI, SQL se genera automáticamente (integración con Looker, Tableau, Power BI), **(2)** cuando la métrica cambia, todos los dashboards permanecen consistentes. Si decides que "el CPA debe incluir costos de shipping", cambias una línea — 40 dashboards se actualizan simultáneamente.

MetricFlow aún está en beta (junio de 2026), pero es utilizable en producción. Alternativa: escribe macros en dbt para funciones de métrica custom:

```sql
-- macros/calculate_cpa.sql
{% macro calculate_cpa(cost_column, conversion_column) %}
  safe_divide({{ cost_column }}, nullif({{ conversion_column }}, 0))
{% endmacro %}
```

Invocas `{{ calculate_cpa('total_cost', 'total_conversions') }}` en todos los mart models — el cambio de métrica se propaga desde un lugar.

## Exposures: Conecta el Modelo al Dashboard BI

El archivo `exposures.yml` de dbt rastrea qué modelo se usa en qué dashboard. Este tracking es operacional — cuando un modelo cambia, sabes cuáles dashboards necesitan prueba:

```yaml
# models/exposures.yml
version: 2

exposures:
  - name: executive_performance_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: "Daily paid media performance for C-level"
    depends_on:
      - ref('fct_daily_performance')
      - ref('fct_campaign_performance')
    owner:
      name: Growth Team
      email: growth@company.com

  - name: weekly_marketing_review
    type: analysis
    maturity: medium
    url: https://docs.google.com/spreadsheets/d/xyz789
    description: "Weekly deep-dive into channel mix"
    depends_on:
      - ref('fct_daily_performance')
    owner:
      name: Marketing Ops
      email: mops@company.com
```

El lineage exposure aparece en el graph: después de `dbt docs generate`, la UI web muestra que al hacer clic en el nodo `fct_daily_performance`, ves cuáles dashboards dependen de él. Antes de hacer un breaking change en el modelo, puedes notificar automáticamente a los propietarios de exposure vía webhook de Slack.

### Production Deployment Pattern

Los jobs de producción en dbt Cloud se ejecutan en este orden:

1. **Source freshness check** — `dbt source freshness` (falla si los datos upstream están retrasados)
2. **Model run** — `dbt run --select tag:daily` (modelos diarios se construyen a las 07:00)
3. **Test execution** — `dbt test` (si hay violación de contrato, rollback)
4. **Documentation update** — `dbt docs generate` (el graph de linaje se actualiza)

Usar un job de dbt en lugar de scheduled query de BigQuery tiene ventajas: control de versiones (cada deployment está ligado a un commit de git), capacidad de rollback (un modelo errado vuelve a su versión anterior en 5 minutos), alertas de Slack (falla de test + advertencia de freshness).

## Tradeoff: ¿ELT o Reverse ETL?

El stack dbt + BigQuery sigue el patrón ELT (extract-load-transform) — los datos raw se traen primero al warehouse, la transformación ocurre en BigQuery. Alternativa: reverse ETL (Hightouch, Census) — datos del warehouse se envían a herramientas SaaS. Se complementan: dbt limpia el warehouse, reverse ETL envía segmentos a Braze/Iterable.

Tradeoff: costo de compute en BigQuery. Un TB de escaneo cuesta $5 — un modelo mart complejo que corre 10 veces al día cuesta $50/día = $1500/mes. Optimización: materialización incremental + partition pruning + clustering. En proyectos de Roibase, el objetivo de costo BigQuery es: $0.02 por monthly active user — 1M MAU = $20K/año (aceptable).

El marketing data stack no es un proyecto de una sola vez — es una arquitectura evolutiva. Una vez que cimentas la base de dbt + BigQuery, puedes agregar capas de MMM (marketing mix modeling), tests de incrementality, y capa de identity resolution. Construir este fundamento a nivel production toma 6-8 semanas, pero ahorra 18 meses downstream — cada pregunta KPI nueva se responde en 2 horas, se elimina la limpieza manual de datos, cambios en modelos de attribution toman 1 hora en lugar de 1 día. Una arquitectura correcta transforma datos de marketing en mecanismo de decisión.