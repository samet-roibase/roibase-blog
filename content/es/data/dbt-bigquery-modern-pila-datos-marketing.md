---
title: "dbt + BigQuery: La pila de datos moderna para marketing"
description: "Source mapping, modeling layer, semantic layer, exposures: una arquitectura de cuatro capas que conecta los datos de marketing con tu mecanismo de decisión."
publishedAt: 2026-07-17
modifiedAt: 2026-07-17
category: verianalizi
i18nKey: data-002-2026-07
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Un reporte de Google Analytics 4 muestra cómo rinde cada canal, Klaviyo registra cuántos emails envió a quién, el dashboard de Meta Ads muestra el CPA — pero ¿pueden esas tres métricas estar lado a lado en la misma consulta SQL? Si no pueden, tu mecanismo de decisión se basa en conjeturas. La promesa de la pila dbt + BigQuery es una sola: modelar los datos de marketing en cuatro capas — desde la source hasta la exposure — convirtiendo la pregunta "qué canal, a qué cliente, generó cuánto valor" en un pipeline SQL reproducible. A medida que la era post-cookie, la atribución multi-touch y la incrementalidad se vuelven obligatorias, esta arquitectura ya no es opcional para una agencia boutique: es imprescindible.

## Source mapping: organizar los conjuntos de datos en grupos de tablas

En BigQuery, cada plataforma crea su propio dataset: `ga4_export`, `facebook_ads`, `klaviyo_events`, `shopify_orders`. Sus esquemas crudos son incompatibles entre sí — GA4 devuelve JSON anidado, Facebook API entrega CSV plano, Klaviyo webhook no aplica normalización. El source mapping es la primera capa: escribir un manifiesto YAML sobre este caos, registrando cada tabla en un bloque `sources` e indicando sus tipos de dato, si están frescos o desactualizados, y con qué frecuencia se cargan.

```yaml
# models/sources/marketing_sources.yml
version: 2

sources:
  - name: ga4_export
    database: roibase-analytics
    schema: analytics_123456789
    tables:
      - name: events_*
        identifier: 'events_*'
        meta:
          contains_pii: true
        freshness:
          warn_after: {count: 25, period: hour}
          error_after: {count: 49, period: hour}

  - name: facebook_ads
    schema: facebook_raw
    tables:
      - name: ads_insights
        loaded_at_field: date_start
        freshness:
          warn_after: {count: 2, period: day}
```

Este manifiesto proporciona a dbt dos cosas: 1) referencias type-safe a tablas crudas usando la macro `source()` en lugar de `ref()`, 2) la capacidad de detectar dónde se detiene el pipeline con el comando `dbt source freshness`. Si un evento de GA4 no se ha actualizado en 49 horas, BigQuery no te avisa — dbt sí.

Durante el source mapping, la anotación de PII es obligatoria: bajo el alcance de KVKK y GDPR, la información sobre qué columna contiene un ID de usuario, email o IP se transporta en el lineage del modelo hacia downstream. Cada tabla que contenga `user_pseudo_id` recibe el tag `meta.contains_pii: true`. Este tag se combina con reglas de enmascaramiento a nivel de field en la semantic layer.

## Modeling layer: fases staging → intermediate → mart

Los modelos staging renombran la source cruda, transforman tipos de dato y descartan columnas innecesarias, proporcionando un esquema estándar a downstream. El trabajo de staging es desempaquetar el array `event_params` de GA4 y convertir campos como `page_location`, `session_id`, `transaction_id` de estructuras anidadas a columnas escalares:

```sql
-- models/staging/ga4/stg_ga4__events.sql
with source as (
    select * from {{ source('ga4_export', 'events_*') }}
    where _table_suffix between format_date('%Y%m%d', date_sub(current_date(), interval 90 day))
                             and format_date('%Y%m%d', current_date())
),

unnested as (
    select
        event_date,
        event_timestamp,
        user_pseudo_id,
        (select value.string_value from unnest(event_params) where key = 'page_location') as page_location,
        (select value.int_value from unnest(event_params) where key = 'ga_session_id') as session_id,
        ecommerce.transaction_id,
        ecommerce.purchase_revenue_in_usd
    from source
    where event_name in ('page_view', 'purchase')
)

select * from unnested
```

Este modelo recibe el prefijo `stg_` — downstream, nadie toca la source, todos extraen de staging. Los modelos staging pueden ser incrementales: cada día procesan solo la nueva partición. El comando `dbt build --select stg_ga4__events` lo ejecuta en 30 segundos; los 90 días de historial no se reprocesa cada vez.

Los modelos intermediate fusionan staging e introducen conceptos analíticos: `int_sessions`, `int_customer_cohorts`, `int_channel_attribution`. Ocultan la lógica de tabla intermedia. Por ejemplo, el cálculo de atribución multi-touch es intermediate:

```sql
-- models/intermediate/marketing/int_channel_attribution.sql
with touchpoints as (
    select
        user_id,
        session_start_timestamp,
        source_medium,
        row_number() over (partition by user_id order by session_start_timestamp) as touch_position,
        count(*) over (partition by user_id) as total_touches
    from {{ ref('stg_sessions') }}
    where user_id is not null
),

attributed as (
    select
        user_id,
        source_medium,
        case
            when touch_position = 1 then 0.4
            when touch_position = total_touches then 0.4
            else 0.2 / (total_touches - 2)
        end as attribution_weight
    from touchpoints
)

select * from attributed
```

Modelo en forma de U — el primer y último contacto reciben 40%, los contactos intermedios reparten el 20% restante. Esta SQL vive en el modelo intermediate; los data scientists modifican el archivo, el dashboard frontend nunca lo toca. Si quieres hacerlo paramétrico, defines `vars.attribution_model: u_shaped` en dbt_project.yml y lo lees con `{{ var('attribution_model') }}`.

Los modelos mart son la capa final: la tabla que tu dashboard, herramienta BI o pipeline de ML consume directamente. Llevan el prefijo `fct_` (fact) o `dim_` (dimension). Ejemplos: `fct_orders`, `dim_customers`, `fct_ad_performance`. Los modelos mart pueden desnormalizarse — el overhead de joins se resuelve en dbt, no en la herramienta BI. En lugar de "desde la tabla de órdenes, haz un join a customer" en Looker, la tabla `fct_orders` ya contiene `customer_lifetime_value`, `customer_cohort` y otras columnas.

## Semantic layer: centralizar definiciones de métricas y lógica de negocio

dbt 1.6+ introduce la semantic layer, que convierte SQL en el concepto de "métrica". Anteriormente, cada dashboard escribía su propia consulta `sum(revenue)` — ahora defines una única métrica `revenue` y todos los dashboards la consumen. La definición de métrica vive en YAML dentro de `metrics/`:

```yaml
# models/metrics/marketing_metrics.yml
version: 2

metrics:
  - name: total_revenue
    label: Ingresos Totales
    model: ref('fct_orders')
    calculation_method: sum
    expression: order_total
    timestamp: order_date
    time_grains: [day, week, month, quarter, year]
    dimensions:
      - channel
      - customer_cohort
      - product_category

  - name: customer_acquisition_cost
    label: Costo de Adquisición de Cliente (CAC)
    calculation_method: derived
    expression: "{{ metric('total_ad_spend') }} / {{ metric('new_customers') }}"
    timestamp: order_date
    time_grains: [month, quarter]
```

Con esta definición, una consulta en Looker como "Muéstrame `total_revenue` por `channel` para el último trimestre" se resuelve automáticamente a través de la API de dbt Semantic Layer. No escribes SQL — invocas la métrica. `customer_acquisition_cost` es una métrica derivada: se calcula a partir de dos métricas distintas. Cuando la fórmula cambia, la editas en un único lugar, sin tener que actualizar 12 dashboards manualmente.

El segundo beneficio de la semantic layer: requiere una [arquitectura de datos first-party](https://www.roibase.com.tr/es/firstparty) porque la definición de métrica se basa en customer IDs. Si el `user_pseudo_id` de GA4 y el `customer_id` de Shopify representan la misma persona, esa resolución de identidad debe estar resuelta en un modelo intermediate. La tabla `dim_unified_customers` fusiona todos los señales y devuelve un `canonical_customer_id`. Es ese ID el que usas como dimensión en la semantic layer. Sin un ID canónico, tu métrica de CAC será incorrecta — el mismo cliente se cuenta dos veces.

## Exposures: puntos de consumo downstream

Exposures es el concepto final de dbt: registrar qué dashboard, qué tarea de Airflow, qué modelo de machine learning consume datos de este pipeline. Se documenta en formato YAML:

```yaml
# models/exposures/marketing_exposures.yml
version: 2

exposures:
  - name: executive_marketing_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: "Dashboard del CMO: ingresos, CAC, LTV por canal"
    depends_on:
      - ref('fct_orders')
      - ref('fct_ad_performance')
      - metric('total_revenue')
      - metric('customer_acquisition_cost')
    owner:
      name: Marketing Operations Team
      email: ops@roibase.com.tr

  - name: klaviyo_segment_sync
    type: application
    maturity: medium
    description: "Sincronización de segmentos BigQuery → Klaviyo vía Hightouch"
    depends_on:
      - ref('dim_unified_customers')
    owner:
      name: CRM Automation
      email: crm@roibase.com.tr
```

Con este manifiesto, cuando ejecutas `dbt docs generate`, las exposures aparecen como nodos finales en la visualización del DAG. Cuando modificas el modelo `fct_orders`, el gráfico de lineage muestra claramente qué dashboard se verá afectado. Una exposure también actúa como regla de alerta: puedes enviar un mensaje a Slack diciendo "el upstream de executive_marketing_dashboard falló".

El campo maturity en exposure también permite rastrear deuda técnica: una exposure con maturity `low` puede haber sido creada para análisis temporales, mientras que `high` maturity son críticas para producción. El comando `dbt list --select exposure:executive_marketing_dashboard+` lista el árbol de dependencias de ese dashboard — útil durante la depreciación de modelos para hacer análisis de impacto.

## Cobertura de pruebas y contrato de calidad de datos

El poder de dbt no es solo la transformación, sino su suite de pruebas. Para cada modelo, defines tests en el archivo `schema.yml`:

```yaml
# models/marts/marketing/fct_orders.yml
version: 2

models:
  - name: fct_orders
    description: "Tabla de hechos de órdenes desnormalizada para consumo BI"
    columns:
      - name: order_id
        description: "Clave primaria"
        tests:
          - unique
          - not_null

      - name: customer_id
        description: "Clave foránea a dim_customers"
        tests:
          - not_null
          - relationships:
              to: ref('dim_customers')
              field: customer_id

      - name: order_total
        description: "Total de la orden en USD"
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"

      - name: order_date
        tests:
          - not_null
          - dbt_utils.accepted_range:
              min_value: "'2020-01-01'"
              max_value: "current_date()"
```

El comando `dbt test` ejecuta estas validaciones. Si aparece alguna anomalía como `order_total < 0`, la construcción falla y Slack recibe una alerta. Este contrato permite que las exposures downstream confíen en los datos — la calidad de datos se asegura en el pipeline, no en la herramienta BI.

Agregar tests personalizados es simple: creas un archivo SQL en la carpeta `tests/`. Ejemplo: "cada cliente debe tener como máximo una suscripción activa":

```sql
-- tests/assert_single_active_subscription.sql
with duplicate_subscriptions as (
    select
        customer_id,
        count(*) as active_count
    from {{ ref('fct_subscriptions') }}
    where status = 'active'
    group by 1
    having count(*) > 1
)

select * from duplicate_subscriptions
```

Si esta consulta devuelve filas, el test falla. Cuando la cobertura de tests supera el 80%, el número de incidentes de datos cae — métrica de Roibase 2023: después del 85% de cobertura, las alertas de dashboard incorrecto bajaron un 60%.

## Orquestación del pipeline e implementación en producción

Si usas dbt Cloud, defines un job programado: cada día a las 04:00 ejecuta el comando `dbt build --select +fct_orders`. Si usas self-hosted, agregas dbt como un `BashOperator` a tu DAG de Airflow. Gracias a la estrategia incremental de dbt, 90 días de datos se procesan en 5 minutos — una reconstrucción completa es innecesaria.

El proceso de CI/CD: cuando abres un Pull Request, GitHub Actions ejecuta `dbt build --select state:modified+` — solo se prueban los modelos que cambiaron y sus dependencias downstream. Al hacer merge, se implementa en el dataset de BigQuery de producción. dbt Slim CI reduce el tiempo de build a 3 minutos en un proyecto con 200 modelos (la construcción completa tomaría 40 minutos).

En producción, el output de `dbt docs generate` se sube como un sitio estático a S3/GCS. Versiones de los archivos markdown — los cambios en el esquema del modelo quedan registrados en git history. Un nuevo miembro del equipo lee en el sitio de dbt docs cómo se calcula cada métrica, evitando el conocimiento tribal.

---

dbt + BigQuery no es la única forma de conectar datos de marketing con tu mecanismo de decisión — pero es la más reproducible, testeable y versionable. El source mapping lleva los datos crudos bajo control, la modeling layer convierte conceptos analíticos en SQL, la semantic layer centraliza las definiciones de métricas, y las exposures hacen visible el consumo downstream. Cuando construyes estas cuatro capas, la pregunta "a cuánto presupuesto asignarle a cada canal" se convierte en el resultado de una consulta SQL — medición, no conjetura.