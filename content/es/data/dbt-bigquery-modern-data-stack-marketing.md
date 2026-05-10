---
title: "dbt + BigQuery: Modern Data Stack para Marketing"
description: "Source mapping, modeling layer, semantic layer, exposures — cuatro capas de arquitectura que conectan datos de marketing con mecanismos de decisión."
publishedAt: 2026-05-10
modifiedAt: 2026-05-10
category: data
i18nKey: data-002-2026-05
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Los equipos de marketing acceden a más datos que nunca, pero las decisiones siguen siendo predictivas. Reportes consolidados en spreadsheets, métricas que varían entre dashboards, tres respuestas diferentes a "¿cuál fue el CAC real?". El problema no es la falta de datos — hay pérdida en el camino desde la fuente hasta el insight. La combinación dbt + BigQuery construye una arquitectura que elimina esa pérdida: recolectas datos brutos con source mapping, los conviertes en lógica empresarial con modeling layer, creas un lenguaje común en toda la organización con semantic layer, y los expones para uso en producción con exposures.

## Source Mapping: Del Dato Bruto a la Fuente Confiable

Source mapping es la primera capa de dbt — la transformación inicial después de ingerir datos de marketing en BigQuery. Events brutos de Google Ads API, Meta Ads, Shopify se estandarizan en la capa staging. Un modelo como `stg_google_ads__campaign_performance` tiene 127 columnas pero usas 12. Source mapping selecciona esas 12, convierte timestamps a UTC, castea campaign_id a string, maneja nulls y crea una tabla limpia.

La definición de sources en dbt se declara en `sources.yml`. Aquí configuras freshness checks — si los datos de Google Ads no llegan en 2 horas, dbt run falla. Es un contrato enforced: aseguras que tu data pipeline sea confiable. En lugar de hacer SELECT directo de la tabla raw, usas la macro `{{ source('google_ads', 'campaign_stats') }}` — el lineage graph de dbt muestra qué tabla raw alimenta qué modelo.

```yaml
sources:
  - name: google_ads
    database: production
    schema: raw_google_ads
    tables:
      - name: campaign_stats
        freshness:
          warn_after: {count: 2, period: hour}
          error_after: {count: 6, period: hour}
        columns:
          - name: campaign_id
            tests:
              - not_null
              - unique
```

## Modeling Layer: Convertir Lógica Empresarial en Código

Después de staging vienen las capas intermediate y mart — donde aplicas lógica empresarial a los datos de marketing. En `int_campaign_attribution` calculas attribution first-touch y last-touch. En `fct_customer_lifetime_value` ejecutas análisis LTV por cohorte. Estos modelos usan materialization incremental de dbt — cada run solo procesa los últimos 3 días, los registros antiguos no se tocan. Con 40 millones de filas en customer_event, la estrategia incremental reduce el tiempo de ejecución a 2 minutos.

La capa mart crea tablas específicas por unidad de negocio: `mart_paid_media__daily_performance`, `mart_crm__email_engagement`, `mart_finance__revenue_attribution`. Se conectan directo a Looker Studio, Tableau, Amplitude — todos extraen la métrica desde la misma fuente. El cálculo de CAC deja de ser debatible porque la fórmula `paid_media_spend / new_customers` está definida en el modelo dbt. Pasa por code review, se prueba, está bajo version control.

```sql
-- models/marts/paid_media/mart_paid_media__daily_performance.sql
{{ config(materialized='incremental', unique_key='date_campaign_id') }}

with campaign_spend as (
  select
    date,
    campaign_id,
    sum(cost_micros) / 1e6 as spend
  from {{ ref('stg_google_ads__campaign_performance') }}
  {% if is_incremental() %}
    where date >= date_sub(current_date(), interval 3 day)
  {% endif %}
  group by 1, 2
),

conversions as (
  select
    date(timestamp) as date,
    campaign_id,
    count(distinct user_id) as conversions
  from {{ ref('stg_ga4__conversions') }}
  {% if is_incremental() %}
    where date(timestamp) >= date_sub(current_date(), interval 3 day)
  {% endif %}
  group by 1, 2
)

select
  c.date,
  c.campaign_id,
  c.spend,
  coalesce(cv.conversions, 0) as conversions,
  safe_divide(c.spend, nullif(cv.conversions, 0)) as cpa
from campaign_spend c
left join conversions cv using (date, campaign_id)
```

## Semantic Layer: Crear un Lenguaje Común

Semantic layer es una capacidad de dbt desde la versión 1.6 — defines métricas como código y cada herramienta las usa. `revenue` no es solo `sum(order_total)`, sino `sum(case when payment_status = 'completed' then order_total end)`. Desaparece la pregunta "¿incluimos devoluciones?" porque la definición está en GitHub. Marketing, finance y product usan la misma métrica `revenue` — solo la cortan por diferentes dimensiones.

En los trabajos de [primera parte de datos y arquitectura de medición](https://www.roibase.com.tr/es/firstparty) de Roibase, semantic layer es un paso obligatorio. Cuando consolidas eventos de clientes desde diferentes touch points, sin definiciones de métricas fijas cada análisis genera resultados distintos. Las métricas definidas en `metrics.yml` de dbt se exponen a herramientas BI vía API — Looker, Hex, Mode consultan semantic layer, todos ven el mismo número en todas partes.

```yaml
# models/metrics/metrics.yml
metrics:
  - name: marketing_qualified_leads
    label: Marketing Qualified Leads
    model: ref('fct_leads')
    calculation_method: count_distinct
    expression: lead_id
    timestamp: created_at
    time_grains: [day, week, month]
    dimensions:
      - utm_source
      - utm_campaign
      - landing_page
    filters:
      - field: lead_status
        operator: '='
        value: "'MQL'"
```

## Exposures: Abrir a Producción

Exposures es la feature de dbt para tracking de dependencias downstream — defines qué dashboard usa qué modelo dbt. Tienes un dashboard "Weekly Campaign Performance" en Looker que consulta `mart_paid_media__daily_performance`. En dbt declaras esta dependencia en `exposures.yml`. Ahora, si haces breaking changes en `mart_paid_media__daily_performance`, dbt te advierte: "Este modelo alimenta 3 dashboards, analiza impacto."

Los exposures aparecen también en la documentación — en dbt docs, cuando haces clic en un modelo ves "Used in 5 dashboards, 2 reverse ETL jobs, 1 ML pipeline". El lineage se extiende hasta la capa BI. Sabes qué dashboard viene de qué SQL. El tiempo de debug baja porque ubicas el dashboard problemático e identificas el modelo source rápidamente.

| Tipo de Exposure | Uso | Método de Tracking |
|---|---|---|
| Dashboard | Looker, Tableau, Metabase | URL + model ref |
| Reverse ETL | Census, Hightouch | Job ID + source table |
| ML Pipeline | Vertex AI, SageMaker | Model name + feature table |
| Herramienta Operacional | Braze, Iterable campañas | Segment ID + dbt model |

## Pipeline Orchestration: El Ciclo de Ejecución de Cada Capa

Orquestas el pipeline con dbt Cloud Scheduler o Airflow. A las 6:00 AM los datos brutos se cargan en BigQuery (Fivetran, Stitch, Airbyte), a las 6:30 arranca dbt run. Staging se ejecuta en 5 minutos, intermediate en 10, marts en 15. A las 7:00 se expone semantic layer, a las 7:15 los dashboards de Looker refrescan. El equipo llega a las 9:00 viendo datos de ayer — sin 3 horas de delay en pipeline.

La suite de tests se ejecuta en cada run: `not_null`, `unique`, `accepted_values`, `relationships`. Si en `stg_google_ads__campaign_performance` el `campaign_id` no es único, dbt run falla. Una alerta cae en Slack. El gate de calidad de datos se enforce a nivel código. Los datos rotos nunca llegan a producción.

```yaml
# dbt_project.yml on-run-end hooks
on-run-end:
  - "{{ log_dbt_results() }}"
  - "{{ send_slack_notification() }}"
  - "{{ update_looker_cache() }}"
```

## Tradeoff: Complejidad vs Governance

El stack dbt + BigQuery introduce complejidad. El equipo de analistas necesita saber SQL — "hagamos un pivot en Excel" ya no alcanza. Git workflow, code review, CI/CD pipeline son conceptos que hay que dominar. En equipos pequeños ese overhead puede ser costoso. Pero el tradeoff es claro: ganas governance. En lugar de fórmulas perdidas en spreadsheets, tienes código bajo version control. La pregunta "¿de dónde viene este número?" se resuelve en 10 segundos con git blame.

El costo de BigQuery es otro tradeoff. Los full table scans son caros — partition y cluster strategy son obligatorios. En modelos incremental de dbt, los configs `partition_by` y `cluster_by` son críticos. Un pipeline que procesa 100 GB mensuales genera ~$50 de costo de slots + $5 storage en BigQuery. Como es servicio managed no hay overhead de infraestructura, pero sin query optimization la factura crece.

Conectar datos de marketing con mecanismos de decisión ya no se resuelve con spreadsheets y BI tools. El stack dbt + BigQuery codifica cada capa desde source hasta exposure. Aseguras que datos brutos sean confiables con source mapping, aplicas lógica empresarial con modeling layer, creas lenguaje común con semantic layer, y expones para consumo en producción con exposures. Code review, tests, version control — el pipeline de datos ahora se gestiona con disciplina de desarrollo de software.