---
title: "Analítica Privacy-First: Plausible + Agregación del Lado del Servidor"
description: "Rastreo sin cookies, cumplimiento RGPD/KVKK, comparación con GA4. Cómo construir una infraestructura de medición orientada a la privacidad con arquitectura de agregación server-side."
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: verianalizi
i18nKey: data-006-2026-06
tags: [privacy-first, plausible, server-side-tracking, rgpd, cookieless]
readingTime: 8
author: Roibase
---

La configuración por defecto de Google Analytics 4 en 2026 confirma que no abandona el fingerprinting del navegador, la escritura de cookies del lado del cliente ni el registro de IP sin consentimiento explícito. La guía de enero de 2026 de la Autoridad Española de Protección de Datos categoriza GA4 como "no utilizable sin consentimiento explícito". La reforma de la KVKK turca que entra en vigor a finales de 2025 establece un requisito similar: el análisis basado en cookies requiere consentimiento previo. Mientras el marketing de rendimiento se apoya en stacks de atribución agresivos, trasladar la capa de análisis del sitio a una arquitectura privacy-first es ahora una obligación operativa. Plausible + agregación server-side resuelve dos preguntas críticas: cómo medir sin cookies y cómo construir un pipeline server-side que sea seguro en cumplimiento normativo.

## La Arquitectura Diferente de Plausible: Agregación de Contadores, No Stream de Eventos

Plausible ejecuta un snippet de JavaScript de menos de 1 KB en el navegador. No escribe cookies, no usa localStorage, no registra direcciones IP. Cuando ocurre una visualización de página, realiza una llamada `POST /api/event`. El evento raw que llega al servicio backend de Elixir se **agrega de inmediato** en PostgreSQL — cada evento incrementa un contador de pageview único, la identificación de sesión se reemplaza con una firma de visitante hasheada mediante salt diario (IP + User-Agent → HMAC-SHA256 → TTL de 24 horas). La lógica de reconocimiento de visitante es determinista pero irreversible: las solicitudes del mismo dispositivo en el mismo día se asignan al mismo hash de visitante, pero al cambiar el salt al día siguiente, el vínculo se rompe. Este enfoque cae fuera de la definición de KVKK de "persona física identificable" — incluso si tuvieras el hash, no podrías volver a la IP.

La diferencia con GA4: GA4 mantiene un `_ga` cookie persistente de 2 años en el cliente, escribe cada hit en un stream de eventos y en BigQuery export, el `user_pseudo_id` es el valor de la cookie. Con Consent Mode v2 activo, envía datos redactados pero sigue escribiendo la cookie. En Plausible, el evento que llega al servidor ni siquiera tiene la IP cruda en PostgreSQL — se hashea dentro del proceso Elixir y la IP cruda se elimina de la memoria. Esta arquitectura respeta el principio RGPD de "limitación de propósito": los datos recopilados solo se pueden usar para contar el tráfico del sitio, no para remarketing o rastreo cross-site.

### Estructura del Contador de Agregación

Las métricas que ves en el dashboard de Plausible (pageview, visitante, tasa de rebote, duración de sesión) no se almacenan en la tabla `events`. La estructura de la tabla es:

```sql
CREATE TABLE stats (
  site_id INT,
  date DATE,
  metric VARCHAR(50),   -- 'pageviews', 'visitors', 'bounce_rate'
  dimension VARCHAR(50),-- 'page', 'source', 'device'
  value BIGINT,
  PRIMARY KEY (site_id, date, metric, dimension)
);
```

En cada evento entrante, se ejecuta una consulta `INCREMENT`: si la combinación de ese día, esa página y esa métrica existe, suma `+1`; si no, ejecuta `INSERT`. El dashboard en tiempo real lee estos contadores. Como no se almacena el stream de eventos raw, se cumple totalmente con la cláusula de "minimización de datos" del RGPD — los datos que mantienes son proporcionales a lo que haces.

## Proxy del Lado del Servidor: Pasar el Tráfico Plausible por tu Dominio

El endpoint SaaS de Plausible es `plausible.io/api/event`. El navegador hace POST a esa URL. Si los bloqueadores de anuncios incluyen `plausible.io` en su lista negra, el evento se pierde. La solución: canalizar el evento de Plausible a través de un proxy inverso en tu propio dominio. Configuración de Nginx:

```nginx
location /stats/api/event {
  proxy_pass https://plausible.io/api/event;
  proxy_set_header Host plausible.io;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header X-Forwarded-Proto $scheme;
  
  # Anonimización de IP — enmascara el último octeto
  set $anonymized_ip $remote_addr;
  if ($remote_addr ~* ^(\d+\.\d+\.\d+)\.\d+$) {
    set $anonymized_ip $1.0;
  }
  proxy_set_header X-Forwarded-For $anonymized_ip;
}
```

El script de frontend cambia:

```html
<script defer data-domain="yourdomain.com" 
  src="/stats/js/script.js"></script>
```

`/stats/js/script.js` también se sirve desde Nginx via proxy. En esta configuración, el tráfico de eventos va a `yourdomain.com/stats/api/event` y desde allí se reenvía al backend de Plausible. El efecto de bypass del bloqueador de anuncios reduce la pérdida de medición del 15-20% (según el reporte de Plausible de 2025). El punto clave: el proxy reverso ya anonimiza la IP antes de pasarla — la solicitud que llega al backend de Plausible tiene el último octeto como `0`.

### Plausible Autohospedado: Control Total

Si ejecutas Plausible en tu propio servidor, los datos de eventos nunca se envían a un endpoint de terceros. Setup con Docker Compose:

```yaml
version: '3.8'
services:
  plausible:
    image: plausible/analytics:v2.0
    ports:
      - "8000:8000"
    environment:
      BASE_URL: https://analytics.yourdomain.com
      SECRET_KEY_BASE: ${SECRET}
      DATABASE_URL: postgres://plausible:password@db/plausible
      CLICKHOUSE_DATABASE_URL: http://clickhouse:8123/plausible
    depends_on:
      - db
      - clickhouse
  
  db:
    image: postgres:14-alpine
    volumes:
      - postgres-data:/var/lib/postgresql/data
  
  clickhouse:
    image: clickhouse/clickhouse-server:23.3-alpine
    volumes:
      - clickhouse-data:/var/lib/clickhouse
```

En la instalación autohospedada, Plausible pasó de PostgreSQL a ClickHouse (desde v2.0). La velocidad de agregación de eventos se multiplicó por 10: con 1M de eventos/día, la latencia de consulta es <50 ms. En esta arquitectura, el hasheo de IP y la rotación de salt están completamente bajo tu control — puedes escribir en tu informe de cumplimiento KVKK "los datos de eventos nunca salen de nuestros servidores".

## Comparación con GA4: Tabla de Trade-offs

| Criterio | Plausible | GA4 |
|---|---|---|
| **Uso de cookies** | Ninguno | `_ga`, `_ga_*` (2 años) |
| **Registro de IP** | Hash + TTL de 24h | Redactado (con Consent Mode v2) pero en BigQuery export, `user_pseudo_id` = cookie ID |
| **Necesidad de consentimiento (RGPD)** | No (interés legítimo suficiente) | Sí (opt-in explícito) |
| **Capacidad de atribución** | Ninguna — solo referrer + UTM | Cross-domain, ruta de conversión, atribución impulsada por datos |
| **Rastreo de eventos personalizado** | Llamada manual a API (evento de objetivo) | Automático + plan de medición |
| **Costo (10M hits/mes)** | Autohospedado: costo de servidor (~$50/mes), SaaS: $19/mes (plan Business) | Gratuito pero BigQuery export requiere costo GCP (aprox. $5/TB de consulta) |
| **Propietario de datos** | Tú (autohospedado) / servidores EU (SaaS) | Google (servidores US) |

Con Plausible, **no hay atribución** — no puedes ver de qué campaña vino una conversión, solo "esta página se vio X veces, Y visitantes únicos llegaron". Si ejecutas modelos de mezcla de marketing o pruebas de incrementalidad, esos datos son suficientes: puedes correlacionar cambios en el tráfico agregado con ventas. Pero no puedes hacer análisis de viaje del usuario, cohort, ni funnel step-by-step. El poder de GA4 está en BigQuery export — uniendo por `user_pseudo_id` puedes construir atribución multi-touch.

El trade-off es claro: al reducir el riesgo de cumplimiento a cero, pierdes granularidad en insight. La solución: stack híbrido. Analytics del sitio con Plausible sin cookies, rastreo de conversiones mediante [arquitectura de datos first-party](https://www.roibase.com.tr/es/firstparty) — sGTM + Conversion API. En Plausible ves las tendencias generales de tráfico; las métricas de decisión (ROAS, LTV, CAC) provienen del pipeline server-side.

## Pipeline de Agregación del Lado del Servidor: Plausible + dbt + BigQuery

Con Plausible autohospedado, tienes acceso directo a la base de datos ClickHouse. Escenario de replicar contadores de eventos a BigQuery para unirlos con datos de marketing:

1. **ClickHouse → BigQuery CDC:** Conector Airbyte con sincronización incremental diaria de la tabla `plausible.events`. ClickHouse ya tiene el contador agregado; no hay evento raw.
2. **Modelo dbt:** En BigQuery se construye la tabla `fct_pageviews`:

```sql
-- models/fct_pageviews.sql
WITH plausible_raw AS (
  SELECT
    toDate(timestamp) AS date,
    domain,
    pathname,
    referrer_source,
    COUNT(*) AS pageviews,
    uniqExact(visitor_hash) AS unique_visitors
  FROM {{ source('plausible', 'events') }}
  WHERE date >= CURRENT_DATE - 30
  GROUP BY 1, 2, 3, 4
),

marketing_spend AS (
  SELECT
    date,
    channel,
    SUM(spend) AS total_spend
  FROM {{ ref('stg_marketing_spend') }}
  GROUP BY 1, 2
)

SELECT
  p.date,
  p.domain,
  p.pathname,
  p.referrer_source,
  p.pageviews,
  p.unique_visitors,
  m.total_spend,
  SAFE_DIVIDE(p.unique_visitors, m.total_spend) AS visitors_per_dollar
FROM plausible_raw p
LEFT JOIN marketing_spend m
  ON p.date = m.date
  AND p.referrer_source = m.channel
```

En este modelo, `visitor_hash` no llega a BigQuery — el agregado de ClickHouse trae `unique_visitors` como un número. Es decir, incluso en el data warehouse no hay rastreo de usuarios individuales. Al unir con la tabla de gasto en marketing, ves "gastamos X dólares en este canal, obtuvimos Y visitantes". Para pruebas de incrementalidad, no puedes hacer randomización basada en cookies — en cambio usas split a nivel geo (campaña on/off por región) u holdout basado en tiempo.

### Dashboard en Tiempo Real: Métricas Agregadas

El dashboard de Plausible muestra contadores en tiempo real (pageviews en los últimos 30 minutos). Para un dashboard similar en BigQuery, usa Looker Studio + Materialized View de BigQuery:

```sql
CREATE MATERIALIZED VIEW analytics.mv_realtime_traffic
AS
SELECT
  FORMAT_TIMESTAMP('%Y-%m-%d %H:%M', timestamp, 'Europe/Madrid') AS time_bucket,
  pathname,
  COUNT(*) AS hits,
  APPROX_COUNT_DISTINCT(visitor_hash) AS visitors
FROM plausible.events
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 MINUTE)
GROUP BY 1, 2
```

La materialización se refresca cada 5 minutos (límite de MV de BigQuery). En Looker Studio, gráfico de líneas: eje X `time_bucket`, eje Y `hits`. Este dashboard también carece de datos a nivel de usuario — solo contadores agregados.

## Documentación de Cumplimiento: Contrato de Procesamiento de Datos KVKK

Si usas Plausible SaaS, firmas un DPA (Data Processing Agreement). El template de Plausible de 2026 incluye:

- **Categoría de datos:** "Agregadas métricas de tráfico del sitio web (conteo de pageviews, conteo de referrers, distribución de tipo de dispositivo)". Sin identificadores individuales.
- **Propósito del procesamiento:** "Análisis de rendimiento del sitio web y atribución de fuente de tráfico". No retargeting, profiling, o toma de decisiones automatizada.
- **Subprocesador:** ClickHouse Cloud (servidores EU), Hetzner (Alemania).
- **Período de retención:** 2 años (para visualización en dashboard), posterior eliminación automática.
- **Derechos del interesado:** Como los datos están agregados e imposibles de vincular a individuos, las solicitudes de eliminación/corrección no aplican. Esto se especifica en el DPA: "Due to aggregation at ingestion, data subject requests cannot be fulfilled on a per-individual basis."

Para tu informe de cumplimiento KVKK, usar esta arquitectura de Plausible es una ventaja: le dices a la autoridad "no almacenamos datos de usuarios, mantenemos contadores agregados". Con GA4, ese argumento no funciona — el export a BigQuery contiene `user_pseudo_id`, lo cual cuenta como "dato personal".

En instalación autohospedada, no firmas un DPA — eres el responsable del tratamiento. Pero según KVKK Artículo 10 debes implementar "medidas técnicas y administrativas": cifrado de base de datos (PostgreSQL TDE), logs de acceso (pg_audit), backup automatizado + PITR. El setup Docker de Plausible no incluye esto por defecto — tienes que añadirlo.

## Limitaciones de Plausible: Cuándo No Es Suficiente

Plausible **no hace análisis de funnel**. No puedes ver "página de producto → carrito → pago" con drop-off paso a paso. Puedes enviar eventos personalizados ("Add to Cart" como evento de objetivo) y ver el recuento, pero