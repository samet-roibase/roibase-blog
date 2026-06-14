---
title: "dbt + BigQuery: Modern Stack de Datos para Marketing"
description: "Desde el mapeo de fuentes hasta la semantic layer: cómo convertir datos de marketing en decisiones. Modelado con dbt, definiciones de KPI y arquitectura de pipeline en producción."
publishedAt: 2026-06-14
modifiedAt: 2026-06-14
category: data
i18nKey: data-002-2026-06
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 8
author: Roibase
---

Los equipos de marketing en 2026 no luchan contra los datos; toman decisiones basadas en datos. GA4, Meta Ads, Google Ads, CRM, CDP, server-side GTM — cada uno deja caer información en tablas separadas. El equipo está armando spreadsheets manualmente, los números cambian cada semana, nadie confía en nada. Este caos desaparece con un stack de datos moderno: BigQuery como fuente, capa de transformación con dbt, semantic layer como red de indicadores. Versionas el código en repositorio, cada cambio se prueba, las métricas vienen de una única fuente de verdad. Este artículo muestra cómo dbt + BigQuery convierte el pipeline de datos de marketing en algo production-grade.

## Mapeo de fuentes: Estandarizar rutas de datos crudos

La primera tarea de dbt es mapear fuentes — ajustar datos crudos de sistemas diferentes al mismo esquema. En BigQuery, la tabla `analytics_123456.events_*` viene de GA4, `facebook_ads.ads_insights` de la API de Meta, `crm.transactions` de Shopify. Cada una tiene formato de timestamp diferente, identificador de usuario distinto, columna de moneda propia. En el archivo `sources.yml` de dbt defines estas tablas crudas:

```yaml
version: 2
sources:
  - name: ga4
    database: analytics_123456
    tables:
      - name: events_
        identifier: "events_*"
        loaded_at_field: event_timestamp
  - name: meta_ads
    database: facebook_ads
    schema: public
    tables:
      - name: ads_insights
        loaded_at_field: date_start
```

Esta definición le dice a dbt "estas tablas vienen de upstream, yo no las toco pero pruebo su frescura". El comando `dbt source freshness` verifica cuándo llegó el último dato — si la API de Meta se retrasa, genera alertas. Sin mapeo de fuentes, cada modelo escribe directo `SELECT * FROM analytics_123456.events_20260614`, y cuando el nombre de tabla cambia, 40 modelos se rompen. Con mapping, la referencia es `{{ source('ga4', 'events_') }}`, el cambio se propaga desde un único punto.

GA4 usa event_timestamp en microsegundos Unix, Meta Ads usa date_start en string ISO, CRM usa created_at en datetime UTC — cada formato diferente. En el mapeo de fuentes, extraes una columna timestamp estándar: `TIMESTAMP_MICROS(event_timestamp) AS event_time` en GA4, `PARSE_TIMESTAMP('%Y-%m-%d', date_start) AS event_time` en Meta. Esta normalización proporciona entrada limpia a los modelos downstream.

## Capa de modelado: Staging, intermediate, mart

La potencia de dbt está en el modelado en capas — staging, intermediate, mart. Los modelos de staging extraen 1:1 de la fuente, solo hacen renombrado y casting de tipos. `stg_ga4_events.sql`:

```sql
SELECT
  TIMESTAMP_MICROS(event_timestamp) AS event_time,
  user_pseudo_id AS anonymous_id,
  event_name,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'session_id') AS session_id,
  geo.country,
  device.category AS device_category
FROM {{ source('ga4', 'events_') }}
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY))
  AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
```

El staging proporciona datos limpios pero sin lógica de negocio. Los modelos intermediate agregan lógica de negocio: sesionización, atribución, pasos de funnel. En `int_sessions.sql` agrupas eventos de GA4 por sesión:

```sql
WITH session_events AS (
  SELECT
    session_id,
    MIN(event_time) AS session_start,
    MAX(event_time) AS session_end,
    COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN event_time END) AS pageviews,
    MAX(CASE WHEN event_name = 'purchase' THEN 1 ELSE 0 END) AS converted
  FROM {{ ref('stg_ga4_events') }}
  GROUP BY session_id
)
SELECT
  *,
  TIMESTAMP_DIFF(session_end, session_start, SECOND) AS duration_seconds
FROM session_events
```

Los modelos mart son la capa final de consumo — BI tool, Looker, dashboards internos miran aquí. `fct_marketing_performance.sql` une todos los canales, calcula spend + revenue + ROAS. Cada modelo mart se enfoca en una entidad de negocio única: `dim_customers`, `fct_orders`, `fct_sessions`. La convención de nombres es crítica — `dim_` para dimensión (cliente, producto), `fct_` para hecho (transacción, evento), `rpt_` para reporte agregado.

## Semantic layer: Definiciones de KPI como código

La semantic layer lleva definiciones de métricas dentro de dbt — qué es "revenue", cómo se calcula "CAC" ya no está en spreadsheet sino en YAML. Con dbt v1.6+ defines el árbol de indicadores en `metrics.yml`:

```yaml
version: 2
metrics:
  - name: revenue
    label: Revenue
    model: ref('fct_orders')
    calculation_method: sum
    expression: order_amount
    timestamp: order_date
    time_grains: [day, week, month, quarter]
    dimensions:
      - channel
      - country
      - device_category

  - name: cac
    label: Customer Acquisition Cost
    calculation_method: derived
    expression: "{{ metric('ad_spend') }} / {{ metric('new_customers') }}"
    timestamp: acquisition_date
    time_grains: [month, quarter]
```

Con la semantic layer, no es la herramienta BI quien calcula CAC, lo hace dbt. Cuando Looker pide "dame CAC", dbt devuelve SQL compilado, une la tabla de spend y la tabla de nuevos clientes, divide. La definición es código, por lo que el historial de git registra "quién cambió el cálculo de CAC, y por qué". La fórmula en spreadsheet no se pierde, hay control de versiones.

En proyectos de Roibase, la semantic layer se construye como parte de [análisis de datos e ingeniería de insights](https://www.roibase.com.tr/es/verianalizi) — no solo definición de métrica, sino mapeo de árbol de KPI, jerarquía de dimensiones, estandarización de granularidad. Por ejemplo: la métrica "revenue" es la suma de `fct_orders.order_amount`, pero "recognized_revenue" filtra la misma tabla por timestamp `recognized_at` (modelo de suscripción SaaS). Una tabla, dos métricas, lógica de negocio diferente.

## Exposures: Hacer visibles las dependencias downstream

Exposure es la respuesta de dbt a la pregunta "quién usa este modelo". Si un dashboard de Looker mira la tabla `fct_marketing_performance`, lo defines en `exposures.yml`:

```yaml
version: 2
exposures:
  - name: marketing_dashboard
    type: dashboard
    maturity: high
    owner:
      name: Growth Team
      email: growth@company.com
    depends_on:
      - ref('fct_marketing_performance')
      - ref('dim_customers')
    description: "Dashboard de marketing ejecutivo — actualización diaria, ventana móvil 90 días"
    url: https://looker.company.com/dashboards/123
```

Sin definición de exposure, cuando cambias `fct_marketing_performance`, no sabes qué dashboard se rompe. Después de `dbt run`, Looker muestra métricas cero, pasas 2 horas debuggeando. Con exposure, el comando `dbt compile --select +exposure:marketing_dashboard` muestra todos los modelos upstream, haces análisis de impacto antes del cambio.

Exposure no es solo para herramientas BI — también para reverse ETL (Hightouch, Census). Si sincronizas la tabla `customers` a Meta CAPI:

```yaml
exposures:
  - name: meta_capi_sync
    type: application
    maturity: high
    depends_on:
      - ref('dim_customers')
    description: "Meta Conversion API — eventos de cliente incrementales, retraso 5 minutos"
```

Esta definición advierte "si cambias el esquema de dim_customers, rompes el schema de evento que va a Meta". En producción, evita la cadena: actualizar modelo → error de sincronización CAPI → pérdida de datos de atribución.

## Pipeline en producción: Builds incrementales y cobertura de pruebas

En producción, dbt no hace refresh completo cada día — usa modelos incrementales. `fct_orders.sql` solo reprocesa los últimos 3 días:

```sql
{{ config(
    materialized='incremental',
    unique_key='order_id',
    partition_by={'field': 'order_date', 'data_type': 'date'},
    cluster_by=['customer_id', 'channel']
) }}

SELECT
  order_id,
  customer_id,
  order_date,
  order_amount,
  channel
FROM {{ ref('stg_shopify_orders') }}

{% if is_incremental() %}
WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 DAY)
{% endif %}
```

El build incremental reduce el costo de BigQuery 90% — en lugar de escanear 2TB, escanea 50GB. Partition + cluster mejoran performance: una query `WHERE customer_id = 'X'` va solo al cluster relevante, sin full scan.

La cobertura de pruebas es crítica. En `schema.yml` defines pruebas para cada modelo:

```yaml
models:
  - name: fct_orders
    columns:
      - name: order_id
        tests:
          - unique
          - not_null
      - name: order_amount
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"
      - name: order_date
        tests:
          - dbt_utils.recency:
              datepart: day
              interval: 7
```

El comando `dbt test` ejecuta estas condiciones en BigQuery como assertions — si order_amount es negativo, el build falla. En producción, cada commit corre en CI/CD: `dbt run --select state:modified+ → dbt test --select state:modified+`. Ejecuta el modelo modificado + dependencias downstream, prueba todo, solo permite merge si no hay problemas.

## Orchestración: Airflow, Prefect, dbt Cloud

dbt no es orquestador por sí mismo — se programa con Airflow o Prefect. Un DAG de Airflow ejemplo:

```python
from airflow.providers.google.cloud.operators.bigquery import BigQueryInsertJobOperator
from airflow.operators.bash import BashOperator

dbt_run = BashOperator(
    task_id='dbt_run',
    bash_command='cd /opt/dbt && dbt run --profiles-dir .',
    dag=dag
)

dbt_test = BashOperator(
    task_id='dbt_test',
    bash_command='cd /opt/dbt && dbt test',
    dag=dag
)

dbt_run >> dbt_test
```

dbt Cloud es la alternativa — orquestación manejada, Web IDE, alertas Slack. Pero la mayoría de empresas elige Airflow porque hay más tareas además de dbt: pull de API upstream, reverse ETL downstream, tablas snapshot.

La estrategia de horario está vinculada a la frescura de datos. Los eventos de GA4 tienen retraso de 24 horas (processing_date ≠ event_date), la API Insights de Meta no es real-time. Los modelos de staging se gatillan según la frescura de la fuente — cuando GA4 entrega una nueva partición, `stg_ga4_events` se actualiza, la cadena intermediate → mart se propaga. Un operador sensor de Airflow verifica que BigQuery tenga la partición:

```python
wait_for_ga4 = BigQueryTableExistenceSensor(
    task_id='wait_for_ga4_partition',
    project_id='analytics_123456',
    dataset_id='events_',
    table_id=f"events_{yesterday.strftime('%Y%m%d')}",
    poke_interval=300
)
```

Cuando la partición está lista, la cadena dbt comienza. Este patrón resuelve el problema de datos con retraso — en lugar de detener el pipeline por demora de API, espera.

## Trade-offs: Qué dbt no resuelve

dbt es motor de transformación, no data loader. ¿Quién extrae datos a BigQuery? Fivetran, Airbyte, script Python personalizado. dbt asume en `sources.yml` que los datos crudos ya están ahí. Patrón ELT: Extract-Load-Transform. La diferencia con ETL es que Transform ocurre dentro del warehouse. dbt es esa capa T, EL es otra cadena de herramientas.

dbt no soporta streaming en tiempo real. Kafka → inserción streaming de BigQuery → cadena de modelo incremental de dbt agrega latencia de minutos. Si necesitas latencia sub-segundo (detección de fraude, pricing dinámico), dbt no es suficiente — necesitas procesador de streams: Flink, Spark Structured Streaming, Materialize.

El soporte de modelo Python en dbt (v1.3+) es limitado. Puedes hacer manipulación de dataframe Pandas pero no entrenas modelos ML pesados en dbt. El patrón común es: feature engineering en dbt, entrenamiento de modelo en Vertex AI, inferencia en BigQuery ML. Un modelo Python de dbt es así:

```python
def model(dbt, session):
    df = dbt.ref('stg_orders').to_pandas()
    df['log_amount'] = np.log1p(df['order_amount'])
    return df
```

Solo genera features — no ajustas scikit-learn. BigQuery compute es caro, el overhead de runtime Python es alto. Transformaciones complejas son más rápidas en SQL.

## Ahora qué hacer

Si tus datos de marketing aún están en spreadsheets con fusión manual, el primer paso es establecer flujo de datos crudos a BigQuery. Exporta GA4, conecta APIs de Meta/Google Ads (Fivetran/Supermetrics), webhook de CRM → inserción streaming BigQuery. Cuando los datos crudos están listos, abres repositorio dbt: modelos de staging hacen mapeo de fuentes, intermediate hace sesionización/atribución, mart genera KPI final. Las primeras 2 semanas necesitas solo tabla `fct_sessions` y `fct_orders` — los dashboards apuntan aquí, las métricas se estabilizan. Semantic layer llega en semana 3, mapping de exposures en semana 4. En 6 semanas, el pipeline en producción corre git-controlled, test-covered, optimizado