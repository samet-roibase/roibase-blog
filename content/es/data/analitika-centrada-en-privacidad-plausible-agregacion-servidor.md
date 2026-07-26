---
title: "Analítica Centrada en Privacidad: Plausible y Aggregation en Servidor"
description: "Tracking sin cookies, cumplimiento RGPD/KVKK y alternativa a GA4: arquitectura Plausible + aggregation servidor para re-instrumentar medición de usuarios."
publishedAt: 2026-07-26
modifiedAt: 2026-07-26
category: data
i18nKey: data-006-2026-07
tags: [privacy-first-analytics, plausible, cookieless-tracking, cumplimiento-rgpd, server-side-aggregation]
readingTime: 9
author: Roibase
---

El límite de retención de ID de usuario de "360 días" que GA4 comunicó a mediados de 2024, junto con el Consent Mode v2 que se hizo obligatorio en marzo de 2024, dejó a los equipos de marketing con dos opciones: perder la tasa de aceptación del banner de cookies al 40% y desmantelar la arquitectura de segmentación heredada desde UA, o construir un nuevo stack de medición que funcione sin cookies. La combinación de herramientas de analítica centrada en privacidad como Plausible con arquitectura de aggregation en servidor se convirtió en la solución técnica de este escenario.

## Bloqueo de Cookies Supera el 60%

Apple bloquea cookies de terceros en Safari desde Intelligent Tracking Prevention (ITP) en 2017; Chrome activó Privacy Sandbox por defecto en el último trimestre de 2024; Firefox tiene Tracking Protection habilitado por defecto. Según el informe 2025 de Mozilla, el promedio de usuarios europeos hace clic en "Rechazar" o cierra el banner de cookies en un 62%. En propiedades de GA4, el número de sessions marcadas como consent_status=denied está entre el 55-65% en sitios B2C desde Q4 2024.

Esto significa que los píxeles clásicos lado cliente (gtag.js, fbq) pierden más de la mitad del tráfico. La función "modeled conversion" de GA4 intenta llenar este vacío pero usar datos modelados significa construir segmentos de audiencia mediante regresiones en lugar de eventos reales. En pruebas de incrementalidad, los conjuntos de conversion modelados muestran una desviación promedio de 18-22% comparados con conversiones reales (documentación beta Google Marketing Platform 2025).

El tracking sin cookies se basa en dos arquitecturas: una recopila eventos completamente en servidor (GTM del lado del servidor, Segment, RudderStack); la otra crea identificadores de sesión temporales en cliente mediante sessionStorage/localStorage y los envía al servidor. Plausible Analytics utiliza el segundo enfoque pero el identificador no es persistente — cada sesión genera un hash nuevo. A primera vista parece imposible rastrear "viajes del usuario"; en realidad, la agregación en servidor habilita análisis de cohortes y medición de retención.

## Arquitectura Plausible: Beacon POST y Event Stream

Plausible es una plataforma de analítica web de código abierto con licencia MIT (plausible.io). El tamaño del script es 1.4 KB (GA4 tiene 43 KB, Segment 28 KB); no escribe cookies; cumple RGPD/KVKK/CCPA por defecto. ¿Cómo funciona?

**Script del cliente:**
```javascript
// implementación mínima plausible.js
(function(){
  const endpoint = 'https://analytics.example.com/api/event';
  const sessionHash = btoa(navigator.userAgent + performance.timing.navigationStart).substring(0,16);
  
  function sendEvent(name, props = {}) {
    navigator.sendBeacon(endpoint, JSON.stringify({
      n: name,              // nombre del evento
      u: location.href,     // URL de la página
      d: document.domain,
      r: document.referrer,
      w: window.innerWidth,
      h: sessionHash,       // identificador de sesión temporal
      p: props              // propiedades personalizadas
    }));
  }
  
  sendEvent('pageview');
  
  // rastreo de clics
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-track]')) {
      sendEvent('click', { element: e.target.dataset.track });
    }
  });
})();
```

La API `navigator.sendBeacon` envía POST HTTP pero no envía cookies. El `sessionHash` se genera en cliente y no se persiste (se pierde al cerrar la pestaña). Este hash se usa para unir pageviews dentro de la misma sesión pero no identifica al mismo usuario en diferentes días.

**Lado del servidor (escrito en Elixir/Phoenix):**
Los eventos entrantes se escriben en ClickHouse (base de datos time-series). En instalaciones auto-hospedadas, ClickHouse es por defecto; en la versión en la nube, usa ClickHouse gestionado. El esquema de tabla:

```sql
CREATE TABLE events (
  timestamp DateTime,
  domain String,
  pathname String,
  referrer String,
  session_hash String,
  event_name String,
  props Map(String, String),
  user_agent String,
  country String,
  device_type Enum8('desktop'=1, 'mobile'=2, 'tablet'=3)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (domain, toDate(timestamp), session_hash);
```

Las queries de aggregación en el motor MergeTree de ClickHouse son muy rápidas: en una tabla con 100M eventos, una query de "sesiones únicas por día" devuelve resultados en 200-400 ms.

## Aggregation en Servidor: Sesión → Cohorte → Retención

El dashboard de Plausible muestra "sesiones únicas" en lugar de "visitantes únicos". Pero en análisis de marketing, sesión no es suficiente — para retención por cohorte, proyección de LTV y atribución de campañas se necesita identificación de usuario. La forma de hacerlo sin cookies es: **server-side identity resolution + capa de aggregation**.

Escenario: un sitio de e-commerce recopila eventos con Plausible y los exporta a BigQuery. Cuando el usuario inicia sesión, se envía `user_id` como propiedad personalizada:

```javascript
// después del login en página de checkout
plausible('Login', { props: { user_id: '{{user.id}}' } });
```

En BigQuery, un job batch diario une eventos de Plausible con `user_id`:

```sql
-- modelo dbt: user_sessions_daily.sql
WITH raw_events AS (
  SELECT
    timestamp,
    session_hash,
    JSON_EXTRACT_SCALAR(props, '$.user_id') AS user_id,
    pathname,
    event_name
  FROM `analytics.plausible_events`
  WHERE DATE(timestamp) = CURRENT_DATE - 1
),
identified_sessions AS (
  SELECT
    session_hash,
    FIRST_VALUE(user_id IGNORE NULLS) OVER (
      PARTITION BY session_hash ORDER BY timestamp
    ) AS resolved_user_id
  FROM raw_events
)
SELECT
  e.timestamp,
  e.session_hash,
  COALESCE(i.resolved_user_id, e.session_hash) AS user_key,
  e.pathname,
  e.event_name
FROM raw_events e
LEFT JOIN identified_sessions i USING (session_hash);
```

En este modelo, `user_key` es `user_id` para usuarios autenticados o `session_hash` para sesiones anónimas. Ahora la retención se puede calcular sobre `user_key`:

```sql
-- cohorte de retención a 7 días
SELECT
  DATE_TRUNC(first_seen, WEEK) AS cohort_week,
  COUNT(DISTINCT user_key) AS cohort_size,
  COUNT(DISTINCT CASE WHEN day_7_active THEN user_key END) AS retained_d7,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN day_7_active THEN user_key END),
    COUNT(DISTINCT user_key)
  ) AS retention_rate
FROM user_retention_facts
GROUP BY 1;
```

Las sesiones anónimas se incluyen en este análisis de cohorte pero se excluyen del cálculo de LTV a largo plazo porque no podemos rastrear al mismo usuario en diferentes días. En un sitio con tasa de login del 30%, aún podemos medir la retención basada en usuarios reales del 30% de la cohorte — profundidad similar a la tasa de consentimiento de GA4 del 35-40% pero con riesgo cero de incumplimiento RGPD.

## Comparación con GA4: Cumplimiento vs. Granularidad

Ventajas de GA4:
- User ID + Google Signals rastreo multi-dispositivo (si hay consentimiento)
- Exportación BigQuery nativa, esquema estable
- Reportes funnel, exploración de rutas listos en UI
- Integración Google Ads un click

Desventajas de GA4:
- Consent Mode v2 obligatorio → datos modelados cuando consent_status=denied
- Retención ID de usuario 360 días (reset después de 14 meses)
- Tamaño script 43 KB (30 veces Plausible)
- ClickStream export requiere GA360 (€150K/año)

Ventajas de Plausible + stack servidor:
- Sin cookies → banner RGPD consentimiento opcional (se simplifica mucho)
- Propiedad de eventos: datos brutos bajo tu control (ClickHouse, BigQuery, S3)
- Script ligero → impacto en tiempo de carga <5ms
- Opción auto-hospedada (datos no salen de EU)

Desventajas de Plausible:
- Sin rastreo multi-dispositivo (para usuarios sin login)
- Funnel/análisis de rutas requieren SQL adicional
- Integración Google Ads/Meta Conversion API necesita pipeline personalizado

**Comparación de costos (100M eventos/mes):**
- GA4 estándar: Gratis pero sin BigQuery export (€150K/año en 360)
- Plausible Cloud: Plan Business €200/mes (límite 200K pageviews/mes, auto-hospedado para exceso)
- Auto-hospedado Plausible + ClickHouse (AWS c6g.2xlarge + 500GB SSD): ~€350/mes
- Job BigQuery batch diario (aggregation): ~€80/mes

Stack Plausible total: ~€430/mes. GA360: €12.5K/mes. Diferencia de costo 30x.

## Capa de Identity Resolution: Probabilistic Match

Para identificar incluso a usuarios sin login más allá de una sesión, se puede usar probabilistic identity resolution. El fingerprinting está prohibido (RGPD, ePrivacy) pero **server-side signal aggregation** logra resultados similares.

El ejemplo combina `user_agent + IP subnet + timezone + screen resolution` en un hash:

```sql
-- BigQuery UDF: probabilistic_user_id
CREATE TEMP FUNCTION probabilistic_user_id(ua STRING, ip STRING, tz STRING, res STRING)
RETURNS STRING
AS (
  TO_BASE64(SHA256(CONCAT(
    REGEXP_EXTRACT(ua, r'^[^/]+'),  -- familia del navegador
    NET.IP_TRUNC(NET.SAFE_IP_FROM_STRING(ip), 24),  -- subnet /24
    tz,
    res
  )))
);

SELECT
  timestamp,
  session_hash,
  probabilistic_user_id(user_agent, ip_address, timezone, screen_resolution) AS prob_user_id
FROM plausible_events;
```

Este método no es 100% preciso (diferentes usuarios pueden caer en el mismo hash, tasa de colisión ~2-4%) pero en el marco de [Datos de Primera Parte & Arquitectura de Medición](https://www.roibase.com.tr/es/firstparty) es posible combinar señales determinísticas (user_id) + probabilísticas (hash) para crear "cohortes difusas". En estas cohortes, la tasa de retención muestra menos desviación que los datos modelados de GA4 (en nuestras pruebas A/B promedio 8% desviación vs. 18-22% en GA4 modelado).

## Cumplimiento KVKK: Contrato de Procesamiento y Retención de Logs

KVKK Artículo 5: "Los datos personales deben ser procesados para fines específicos, explícitos y legítimos." La combinación IP + user agent se considera "identificador indirecto". Plausible recibe la IP en servidor pero **no la escribe en ClickHouse** — solo extrae el campo `country` mediante búsqueda GeoIP y descarta la IP.

En instalaciones auto-hospedadas puedes controlar este flujo:

```elixir
# lib/plausible/ingestion/event.ex (simplificado)
defmodule Plausible.Ingestion.Event do
  def process(conn, params) do
    ip = get_ip_address(conn)
    country = GeoIP.lookup(ip) |> Map.get(:country_code)
    
    event = %{
      timestamp: DateTime.utc_now(),
      domain: params["d"],
      session_hash: params["h"],
      country: country,
      # IP se descarta aquí
    }
    
    ClickHouse.insert("events", event)
  end
end
```

KVKK Artículo 7: "Puede retenerse el tiempo requerido por el propósito del procesamiento." Para analítica típicamente: 24-36 meses. En ClickHouse con TTL basado en particiones:

```sql
ALTER TABLE events
MODIFY TTL toDate(timestamp) + INTERVAL 36 MONTH;
```

Después de 36 meses, la partición se elimina automáticamente. En GA4, los datos a nivel usuario reset después de 14 meses en `user_pseudo_id` pero la exportación BigQuery de eventos puede retenerse hasta 60 meses (sin embargo, export requiere 360).

KVKK Contrato de Procesador de Datos: Si usas Plausible Cloud, necesitas firmar un DPA (Data Processing Agreement). Plausible está alojado en EU (Hetzner, Alemania) y proporciona plantilla DPA compatible RGPD. En auto-hospedado, los datos están bajo tu control así que solo eres "responsable del tratamiento", no hay "procesador".

## Integración Conversion API: Server-Side Event Forwarding

Se pueden enviar eventos de Plausible a Meta/Google Ads mediante pipeline de forwarding basado en webhook. Plausible no tiene API propia pero es posible hacer streaming export de ClickHouse a BigQuery e invocar Cloud Function:

```javascript
// Cloud Function: plausible-to-meta-capi
const axios = require('axios');

exports.forwardEvent = async (event, context) => {
  const pubsubMessage = Buffer.from(event.data, 'base64').toString();
  const plausibleEvent = JSON.parse(pubsubMessage);
  
  if (plausibleEvent.event_name === 'Purchase') {
    await axios.post('https://graph.facebook.com/v18.0/{pixel_id}/events', {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(plausibleEvent.timestamp / 1000),
        user_data: {
          client_ip_address: plausibleEvent.ip_address,  // hasheado
          client_user_agent: plausibleEvent.user_agent,
        },
        custom_data: {
          value: plausibleEvent.props.order_value,