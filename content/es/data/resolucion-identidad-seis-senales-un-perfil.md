---
title: "Resolución de Identidad: De 6 Señales a un Perfil de Cliente Único"
description: "Hash matching, vinculación probabilística e identidad de hogar: cómo unificar touchpoints dispersos en un perfil único. Pipeline server-side y esquemas prácticos."
publishedAt: 2026-07-19
modifiedAt: 2026-07-19
category: data
i18nKey: data-003-2026-07
tags: [resolucion-identidad, hash-matching, vinculacion-probabilistica, cdp, first-party-data]
readingTime: 9
author: Roibase
---

Un usuario hace clic en una campaña desde su móvil, añade un producto al carrito en escritorio, compra en la tienda física. Tres señales, tres identidades diferentes: `device_id`, `cookie_hash`, `email_hash`. La resolución de identidad es el pipeline de datos que convierte estos fragmentos en un único perfil de cliente. En la era post-cookie —Consent Mode v2, iOS ATT, CCPA— la arquitectura de resolución de identidad basada en server-side y first-party data ya no es una recomendación, es una obligación.

## Por qué existen 6 señales diferentes

El stack de marketing moderno recopila señales de identidad en seis capas: **browser cookie**, **ID de dispositivo** (IDFA/GAID), **hash autenticado** (email SHA-256), **customer ID** (interno de CRM/CDP), **fingerprint IP+user-agent**, **household graph**. Cada uno se activa en un punto diferente del lifecycle.

La cookie del navegador entra en juego en el primer touchpoint; el ID de dispositivo en aplicaciones móviles; el hash autenticado cuando se recopila email o teléfono; el customer ID después del checkout; el fingerprint para emparejamiento probabilístico sin consentimiento; el household graph para agrupar dispositivos conectados desde el mismo router. El problema: estas seis señales se almacenan en tablas diferentes, con TTL distintos (cookie 90 días, IDFA indefinido, hash de email hasta que el cliente se elimina). Sin resolución, cada canal cuenta usuarios diferentes —en modelos de mix de marketing se produce doble conteo, en tests de incrementalidad hay sobreestimación, en cohortes de retención aparece una retención falsa.

La lógica de resolución se construye con dos métodos: **determinístico (hash matching)** y **probabilístico (graph linking)**. Determinístico: el hash SHA-256 del email vincula un evento de navegador con una transacción backend —100% de certeza. Probabilístico: si ves el mismo IP+user-agent en dos eventos dentro de 24 horas, la probabilidad de que sea el mismo usuario es del 73% (ejemplo de threshold). Sin resolución, el número de usuarios únicos se infla entre 40-80% (según la categoría y mix de dispositivos).

## Hash matching: convertir email y teléfono en claves de identidad

Hash matching es la columna vertebral de la resolución de identidad server-side. Cuando un usuario proporciona email o teléfono, el cliente (o sGTM) genera el hash SHA-256 y lo escribe en la tabla `identity_map`. En los siguientes eventos anónimos, buscan la cookie o ID de dispositivo para acceder al hash.

Esquema simple de `identity_map`:

```sql
CREATE TABLE identity_map (
  canonical_id STRING NOT NULL,      -- UUID, ID interno
  signal_type STRING NOT NULL,       -- 'email_sha256', 'phone_sha256', 'device_id', 'cookie'
  signal_value STRING NOT NULL,      -- hash o ID
  first_seen TIMESTAMP,
  last_seen TIMESTAMP,
  PRIMARY KEY (signal_type, signal_value)
);
```

Cuando un usuario escribe `usuario@ejemplo.com` en un formulario de registro, sGTM realiza hash SHA-256 y ejecuta `INSERT`: `('uuid-123', 'email_sha256', 'abc123...', NOW(), NOW())`. En la misma sesión, si existe la cookie `_ga=GA1.1.xyz`, se crea una segunda fila: `('uuid-123', 'cookie', 'GA1.1.xyz', NOW(), NOW())`. Así, dos señales se unen bajo `canonical_id = uuid-123`.

En la siguiente sesión, el usuario llega solo con `_ga=GA1.1.xyz`, sin email. La búsqueda en BigQuery:

```sql
SELECT canonical_id
FROM identity_map
WHERE signal_type = 'cookie' AND signal_value = 'GA1.1.xyz'
LIMIT 1;
```

Devuelve: `uuid-123`. Vinculan el evento a este ID —el usuario se reconoce sin usar el hash de email. La precisión del hash matching es del 100% porque la colisión criptográfica es imposible. Pero existe un problema de cobertura: si el usuario nunca proporcionó email, no hay hash, entonces recurren al método probabilístico.

### Riesgo de colisión y salt

El riesgo de colisión SHA-256 es teórico: 1 entre 2^128 intentos. Pero en producción, el verdadero problema es que **el mismo email podría estar vinculado a dos `canonical_id` diferentes** (error manual, restos de migración antigua). Por eso añaden `UNIQUE INDEX (signal_type, signal_value)`. El uso de salt (email + string secreto, luego hash) no aumenta el riesgo de colisión pero añade una capa de privacidad en el diseño de [arquitectura de datos first-party](https://www.roibase.com.tr/es/firstparty) —al rotar el salt, los hashes antiguos se invalidan, útil para el derecho al olvido según GDPR.

## Vinculación probabilística: IP, user-agent y device graph

Si el usuario navega anónimo, no hay señal determinística. En este caso, usan un **probabilistic graph**: IP + user-agent + proximidad temporal para generar un score de "probablemente el mismo usuario". Ejemplo: dos eventos desde la misma IP con el mismo user-agent, 15 minutos de diferencia —85% de probabilidad de ser el mismo usuario.

Lógica simple de merge probabilístico:

```sql
WITH anon_events AS (
  SELECT
    event_id,
    ip_address,
    user_agent,
    event_timestamp,
    FARM_FINGERPRINT(CONCAT(ip_address, user_agent)) AS fingerprint
  FROM events
  WHERE canonical_id IS NULL
),
clusters AS (
  SELECT
    fingerprint,
    MIN(event_timestamp) AS first_event,
    MAX(event_timestamp) AS last_event,
    COUNT(*) AS event_count
  FROM anon_events
  GROUP BY fingerprint
  HAVING TIMESTAMP_DIFF(MAX(event_timestamp), MIN(event_timestamp), HOUR) < 24
)
SELECT
  a.event_id,
  c.fingerprint AS probable_cluster_id
FROM anon_events a
JOIN clusters c ON a.fingerprint = c.fingerprint;
```

Esta consulta agrupa eventos por hash de IP+UA dentro de 24 horas. El ID del cluster se usa como `canonical_id` temporal, pero incluyen un score de confianza: `event_count > 3 AND time_span < 1 HOUR → confidence=0.9`.

**Household graph:** Si desde la misma IP llegan diferentes user-agents (laptop, tablet, teléfono), probablemente es el mismo hogar. Aquí crean un `household_id` y lo colocan bajo el `canonical_id` individual. Por ejemplo, suscripción a Amazon Prime: 1 pago, 6 perfiles —la resolución de identidad agrega al nivel de hogar.

### Tasa de falsos positivos

En vinculación probabilística existe riesgo de falsos positivos. La misma IP + user-agent puede provenir de dos usuarios diferentes (WiFi de oficina, biblioteca). Si el threshold es muy permisivo (50% de confianza), verán 15-25% de falsos positivos. La mejor práctica de la industria: threshold de 75%+ confianza, ventana temporal de 1 hora, mínimo 2 eventos coincidentes. Vendedores como LiveRamp usan bases de datos de grafos (Neo4j) y combinan 30+ señales alegando 95%+ de precisión —pero en su propio pipeline first-party con 2-3 señales, 80% de precisión es suficiente.

## Pipeline server-side: sGTM + BigQuery + dbt

La resolución de identidad en producción funciona con este flujo de datos:

1. **Ingestión de eventos sGTM:** El evento de GTM del cliente va a sGTM, que añade el hash SHA-256 si existe email, escribe el evento raw en BigQuery (`events_raw`).
2. **Modelo de staging dbt:** La tabla `stg_events` limpia eventos de `events_raw`, parsea columnas `signal_type` y `signal_value`.
3. **Merge de identity_map dbt:** Cuando aparece un nuevo hash, se ejecuta un `MERGE` en `identity_map` (lógica upsert).
4. **Enriquecimiento canonical_id dbt:** Cada evento se une con `identity_map`, se realiza lookup de `canonical_id`.
5. **Agregación dbt:** Las métricas a nivel de usuario (`user_ltv`, `session_count`) se agregan por `canonical_id`.

Fragmento de modelo dbt (`models/staging/stg_events.sql`):

```sql
{{ config(materialized='incremental') }}

WITH events_with_signals AS (
  SELECT
    event_id,
    event_timestamp,
    COALESCE(user_properties.email_sha256, NULL) AS email_hash,
    COALESCE(user_properties.ga_client_id, NULL) AS cookie_id,
    event_params
  FROM {{ source('bigquery', 'events_raw') }}
  {% if is_incremental() %}
  WHERE event_timestamp > (SELECT MAX(event_timestamp) FROM {{ this }})
  {% endif %}
)
SELECT * FROM events_with_signals;
```

El modelo incremental se ejecuta cada hora, procesa el último batch. La lógica de merge de identidad va en otro modelo (`models/core/fct_identity_resolved.sql`):

```sql
SELECT
  e.event_id,
  COALESCE(im_email.canonical_id, im_cookie.canonical_id) AS canonical_id,
  e.event_timestamp
FROM {{ ref('stg_events') }} e
LEFT JOIN {{ ref('identity_map') }} im_email
  ON e.email_hash IS NOT NULL
  AND im_email.signal_type = 'email_sha256'
  AND im_email.signal_value = e.email_hash
LEFT JOIN {{ ref('identity_map') }} im_cookie
  ON e.cookie_id IS NOT NULL
  AND im_cookie.signal_type = 'cookie'
  AND im_cookie.signal_value = e.cookie_id;
```

Esta lógica de join realiza hash matching determinístico. Para lo probabilístico, añaden un modelo separado `fct_probabilistic_clusters`.

## Consentimiento y privacidad: cumplimiento GDPR y CCPA

La resolución de identidad está sujeta al Artículo 6 (base legal) del GDPR y a las reglas "no vender" de CCPA. El hash de email se considera **datos personales** (decisión CJEU 2019), requiere consentimiento o interés legítimo.

Bajo Consent Mode v2, si el usuario establece analytics_storage=denied, no pueden recopilar el hash de email. Solo pueden usar fingerprint IP+UA (bajo interés legítimo —pero la interpretación CJEU es controvertida). Mejor práctica: añadir columna `consent_status` a `identity_map` y escribir hash solo desde eventos con `analytics_storage=granted`.

Para el derecho al olvido de CCPA, necesitan lógica de eliminación basada en `canonical_id`:

```sql
DELETE FROM identity_map WHERE canonical_id = 'uuid-123';
DELETE FROM events WHERE canonical_id = 'uuid-123';
```

Para eliminación en cascada, usan constraints de clave externa (BigQuery no lo soporta nativamente, pero sí Postgres/Snowflake). Alternativa: soft delete (`deleted_at TIMESTAMP`) y luego purga por lotes.

### Mapeo de vendor TCF 2.2

Bajo TCF 2.2 del IAB, la resolución de identidad cae bajo "Purpose 1 —Store and/or access information on a device". Si el usuario no aprueba el vendor en la lista, no pueden hacer linking cross-device. En proyectos de Roibase, parsean la cadena TCF en BigQuery y escriben `vendor_consent` como columna, luego aplican filtro de consentimiento al merge de identidad:

```sql
WHERE vendor_consent LIKE '%vendor_id=123%'
```

Esta lógica previene que construyan graph de identidad sin consentimiento —equilibrio entre cumplimiento y calidad de datos.

## Integración CDP: Segment, mParticle, Rudderstack

Los CDP modernos ofrecen sus propios grafos de identidad, pero generalmente son una caja negra. Construir el suyo les da control sobre la lógica del grafo —especialmente crítico en proyectos de [CDP & Retention Engineering](https://www.roibase.com.tr/es/retention-engineering-cdp). El `identify()` de Segment fusiona `userId` y `anonymousId`, pero ¿qué señal tiene prioridad? En su lógica de resolución, la secuencia de prioridad es clara:

1. `customer_id` (CRM) → más confiable
2. `email_sha256` → determinístico
3. `device_id` → cross-session pero no cross-device
4. `cookie` → TTL más corto
5. `fingerprint` → fallback probabilístico

Codifican este orden en dbt con una cadena `COALESCE()`. Solo envían al CDP el `canonical_id` final y `confidence_score`, la lógica de merge permanece en sus manos.

La resolución de identidad es la capa fundamental del stack de datos de marketing moderno. Hash matching proporciona certeza determinística, vinculación probabilística proporciona cobertura, household graph abre segmentación familiar. Cuando el pipeline server-side unifica estas seis señales respetando consentimiento y privacidad, la precisión de usuarios únicos mejora un 40%, desaparece la ilusión de retención falsa, los tests de incrementalidad se vuelven confiables. Construir su propia lógica de resolución con BigQuery + dbt + sGTM los libera de las cajas negras de vendors, manteniendo el control del grafo exactamente como necesitan.