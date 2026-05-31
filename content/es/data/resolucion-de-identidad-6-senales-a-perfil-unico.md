---
title: "Resolución de Identidad: De 6 Señales a un Perfil de Cliente Único"
description: "Arquitectura técnica de hash matching, probabilistic linking e identity de hogar para unificar señales dispersas en un único perfil de cliente."
publishedAt: 2026-05-31
modifiedAt: 2026-05-31
category: data
i18nKey: data-003-2026-05
tags: [identity-resolution, cdp, first-party-data, probabilistic-matching, hash-matching]
readingTime: 8
author: Roibase
---

Un usuario se registra con email, realiza un pedido desde la app móvil, y otro día abre un ticket de soporte desde el navegador de escritorio. Cookie ID, device ID, email hasheado, IP, session ID, user ID — seis señales distintas. Sin resolución de identidad, parecen seis "clientes" diferentes. La atribución de anuncios se calcula mal, el modelo de LTV queda sesgado, se pierden señales de retención. El User ID merge de Google Analytics 4 solo agrupa sesiones autenticadas, dejando el comportamiento anónimo desconectado. Los CDP ofrecen "stitching probabilístico" pero no muestran la estructura de tablas. Para llevar el identity graph a producción, necesitas combinar hash matching, probabilistic linking e identity de hogar trabajando juntos.

## Hash Matching: La Columna Vertebral de la Unificación Determinística

Hash matching establece un enlace "cien por cien seguro" entre dos señales igualando los hashes SHA-256 de la misma dirección de email o número de teléfono. Cuando un usuario se registra en tu sitio web con `user@example.com`, hashea ese valor con SHA-256 y escríbelo como columna `hashed_email` en tu tabla `identity_signals` de BigQuery. Si el mismo email se usa para iniciar sesión en la app móvil, el hash hasheado será idéntico en ambas partes — une los dos registros.

```sql
-- Ejemplo de match determinístico en BigQuery
CREATE OR REPLACE TABLE `project.dataset.merged_identities` AS
SELECT
  web.anonymous_id AS web_cookie_id,
  mobile.device_id AS mobile_device_id,
  web.hashed_email,
  MIN(web.first_seen_timestamp) AS first_seen
FROM `project.dataset.web_events` web
INNER JOIN `project.dataset.mobile_events` mobile
  ON web.hashed_email = mobile.hashed_email
WHERE web.hashed_email IS NOT NULL
GROUP BY 1,2,3;
```

Esta consulta une el web cookie ID con el mobile device ID mediante email hasheado. El `INNER JOIN` es determinístico — solo llegan las coincidencias exactas. Para agrupar las señales igualadas bajo un mismo `canonical_user_id`, usa `ROW_NUMBER()` o generación de UUID. El límite del hash matching: si el usuario cambia de email (cuenta antigua + cuenta nueva) permanecerá como dos identidades separadas. Aquí entra en juego la capa probabilística.

El hash matching cumple con GDPR y KVKK porque no almacenas email en texto plano — el hash es unidireccional, irreversible. Pero es vulnerable a ataques de tabla arcoíris (rainbow table), por eso debes agregar un segundo factor a los hashes de email: fingerprint del dispositivo o rango de IP. Una sola columna de hash no es suficiente — mantén `hashed_email`, `hashed_phone`, `hashed_customer_id` en columnas separadas. Particiona la tabla por `DATE(timestamp)` — la resolución de identidad generalmente es incremental, un full scan de todo el historial es costoso.

## Probabilistic Linking: Manejar la Incertidumbre con Puntuaciones

Si un usuario navega sin registrarse, no hay email hasheado — tienes cookie ID, IP, user agent, timestamp de sesión. El probabilistic matching pondera estas señales para producir una puntuación de "probabilidad de ser la misma persona". Si esa puntuación supera un umbral (ej. 0.85), enlaza los dos registros; si está por debajo, los mantiene separados. Vendor como LiveRamp, Merkle y Neustar venden estas puntuaciones, pero puedes construir un modelo basado en reglas en tu propio data warehouse.

Lógica de ejemplo: Mismo IP + mismo fingerprint de navegador (canvas hash) + sesión dentro de 5 minutos → 90% puntuación. Mismo IP + navegador diferente + diferencia de 2 horas → 40%. Si el umbral es 0.7, el primer par se une, el segundo no. En BigQuery, modélalo con bloques `CASE WHEN`:

```sql
SELECT
  a.session_id AS session_a,
  b.session_id AS session_b,
  CASE
    WHEN a.ip_address = b.ip_address
      AND a.canvas_hash = b.canvas_hash
      AND TIMESTAMP_DIFF(b.timestamp, a.timestamp, MINUTE) <= 5
    THEN 0.90
    WHEN a.ip_address = b.ip_address
      AND TIMESTAMP_DIFF(b.timestamp, a.timestamp, HOUR) <= 2
    THEN 0.40
    ELSE 0.0
  END AS match_score
FROM `project.dataset.anonymous_sessions` a
CROSS JOIN `project.dataset.anonymous_sessions` b
WHERE a.session_id < b.session_id
  AND a.ip_address = b.ip_address
QUALIFY match_score >= 0.70;
```

Esta consulta hace un `CROSS JOIN` — en millones de filas, el costo explota. En producción necesitas una window function o bucketing: particiona por IP prefix (ej. `/24` CIDR), compara solo las últimas 100 sesiones con `ROW_NUMBER()`. El riesgo del probabilistic matching es el falso positivo — dos usuarios diferentes en la misma IP (Wi-Fi de oficina, VPN compartida) a la misma hora pueden unirse incorrectamente. Por eso mantén el umbral en 0.85-0.90 y valida con señales cross-device.

Un modelo probabilístico basado en machine learning es más sofisticado: regresión logística o gradient boosting para clasificación binaria "mismo usuario". El conjunto de features incluye: distancia Hamming de IP, similitud Levenshtein de user agent, offset de zona horaria, cuenta de sesiones. Los datos etiquetados vienen de pares conocidos de `user_id` (ejemplos positivos) y pares distintos de `user_id` (ejemplos negativos). El modelo produce puntuaciones 0-1, el umbral sigue siendo manual. Para construir este enfoque necesitas una pipeline Vertex AI o Sagemaker, no solo un modelo dbt — data engineering + ML engineering trabajan juntos.

## Household Identity: Mismo Hogar, Usuarios Distintos

En resolución de identidad, la capa de "household" (hogar) agrupa usuarios diferentes en la misma IP o dirección física para dirigirse como "unidad familiar" en marketing. Por ejemplo, en un sitio de e-commerce la madre mira ropa para niños, el padre compra electrónica — dos user IDs diferentes pero mismo domicilio de envío. El household graph los reúne bajo un `household_id`. En plataformas de anuncios (Facebook Ads, Google Ads) venden "household targeting" pero debes modelar esta relación en tus own first-party data.

En BigQuery, normaliza la dirección de envío: elimina variaciones de mayúsculas/minúsculas, espacios, números de apartamento. Luego hasheala y úsala como `household_key`:

```sql
CREATE OR REPLACE TABLE `project.dataset.household_mapping` AS
SELECT
  user_id,
  TO_HEX(SHA256(
    LOWER(REGEXP_REPLACE(CONCAT(street, city, postal_code), r'\s+', ''))
  )) AS household_key
FROM `project.dataset.user_addresses`
WHERE street IS NOT NULL AND postal_code IS NOT NULL;
```

Esta tabla proporciona el mapping `user_id` → `household_key`. Agrupa usuarios bajo el mismo `household_key` para asignarles un `household_id`. La household identity es distinta a la cross-device identity — no son dispositivos de la misma persona, sino personas del mismo hogar. El riesgo de privacidad es alto: agrupar dos usuarios adultos diferentes en el mismo household puede violar el principio de minimización de datos (KVKK art. 5). Por eso usa el household graph solo para análisis agregado y targeting anónimo, nunca para fusionar perfiles individuales.

Agrega señales adicionales al household graph: hash de SSID Wi-Fi (si la app móvil tiene permiso), beacon Bluetooth (tiendas físicas), método de pago compartido (misma tarjeta de crédito). Estas señales son PII, requieren hash + almacenamiento cifrado. Los sistemas CDP (Segment, mParticle, RudderStack) ofrecen la resolución de household como "relationship graph", pero construir un modelo manual en BigQuery te da más control — ves exactamente qué señal lleva qué peso. El trabajo de Roibase en [CDP & Retention Engineering](https://www.roibase.com.tr/es/retention-engineering-cdp) integra esta capa en una pipeline de producción.

## Graph Database vs Relacional: Cuál es Más Rápido

Puedes mantener el identity graph en un data warehouse relacional como BigQuery, pero consultar enlaces encadenados (cierre transitivo) tipo "A → B → C" es caro. Una graph database (Neo4j, Amazon Neptune, TigerGraph) hace este trabajo en estructura nodo/arista — "encuentra todos los dispositivos del usuario X" se ejecuta en milisegundos con `MATCH (u:User)-[:HAS_DEVICE]->(d:Device)`. En BigQuery, la misma consulta con `RECURSIVE CTE` o `ARRAY_AGG` consume más slots en tablas grandes.

Tradeoff: Graph DB es rápido pero cambios de schema son engorrosos, el modelo nodo/arista difiere del SQL que tu equipo conoce. El warehouse relacional es más lento pero versionamiento con dbt, tests y documentación son simples. La mayoría de setups de producción usan un enfoque híbrido: construye la tabla de identity mapping diariamente en BigQuery con dbt, sincroniza a Neo4j, haz lookups en tiempo real desde Neo4j. Ejemplo de pipeline: modelo dbt → vista BigQuery → Cloud Function trigger → inserción Cypher en Neo4j.

```sql
-- BigQuery: cierre transitivo recursivo (lento)
WITH RECURSIVE identity_chain AS (
  SELECT signal_a, signal_b, 1 AS depth
  FROM `project.dataset.identity_edges`
  UNION ALL
  SELECT ic.signal_a, e.signal_b, ic.depth + 1
  FROM identity_chain ic
  JOIN `project.dataset.identity_edges` e
    ON ic.signal_b = e.signal_a
  WHERE ic.depth < 5
)
SELECT DISTINCT signal_a, signal_b
FROM identity_chain;
```

Esta consulta sigue cadenas de máximo 5 pasos (depth). Sin control de profundidad, hay riesgo de bucle infinito — si A → B → A hay un ciclo. Graph DB maneja ciclos automáticamente; en BigQuery necesitas un WHERE manual. Si el identity graph alcanza 10M+ aristas, un sistema dedicado como Neo4j es más mantenible. Bajo 1M aristas, BigQuery + dbt es suficiente.

## Privacidad y Consentimiento: Límites Legales del Identity Graph

La resolución de identidad entra en la definición GDPR de "profiling" (art. 4.4). Sin consentimiento explícito del usuario, hacer hash matching + probabilistic linking es un riesgo legal. Consent Mode v2 (Google) separa "analytics_storage" y "ad_storage" pero la stitching de identidad puede requerir una categoría adicional de "personalization_storage". En TCF 2.2, necesitas Purpose 1 (device storage) + Purpose 9 (personalized ads) — sin ambos, incluso hash matching es ilegal.

El email hasheado es "datos pseudónimos" bajo GDPR (Recital 26) — sigue siendo dato personal. Si se puede revertir a plaintext con una tabla de búsqueda o rainbow table, no es "anonimización" sino "pseudonimización". Por eso agrega salt al hash (email + secret específico del sitio → SHA-256) y guarda el salt en HSM (Hardware Security Module) o Secret Manager. Si un usuario solicita "desvinculación" (GDPR art. 18, restricción), elimina las aristas del identity graph, rompe los enlaces determinísticos.

KVKK art. 7 exige consentimiento explícito: "La aceptación de datos personales debe ser clara, informada y con voluntad libre para un tema específico." La stitching de identidad debe mencionarse por nombre en el formulario de consentimiento — frases genéricas como "mejor experiencia" no son suficientes. Si el usuario retira consentimiento (marca `consent_revoked_at`), elimina todas las aristas desde ese `user_id` del graph y establece un flag `deleted_at`. En BigQuery puedes hacer soft delete — en lugar de eliminar filas, filtra con `WHERE deleted_at IS NULL`.

## Implementación: Pipeline Incremental de Identidad con dbt

En producción, la resolución de identidad debe ser batch incremental, no una única carga — agrega nuevas señales cada día, actualiza el graph existente. Con dbt modelo incremental logras esto:

```sql
{{
  config(
    materialized='incremental',
    unique_key='edge_id',
    partition_by={'field': 'created_date', 'data_type': 'date'},
    cluster_by=['signal_a_type', 'signal_b_type']
  )
}}

WITH new_edges AS (
  SELECT
    GENERATE_UUID() AS edge_id,
    a.signal_id AS signal_a,
    a.signal_type AS signal_a_type,
    b.signal_id AS signal_b,
    b.signal_type AS signal_b_type,
    0.95 AS match_score,
    CURRENT_DATE() AS created_date
  FROM {{ ref('stg_hashed_emails') }} a
  JOIN {{ ref('stg_device_ids') }} b
    ON a.hashed_email = b.hashed_email
  WHERE a.created_at >= CURRENT_DATE() - 1
)

SELECT * FROM new_edges

{% if is_incremental() %}
WHERE edge_id NOT IN (SELECT edge_id FROM {{ this }})
{% endif %}
```

Este modelo agrega diariamente las nuevas coincidencias email-device del último día. El `unique_key` previene duplicados, `partition_by` no toca particiones antiguas. El cluster por `signal_type` acelera — las consultas típicas filtran "todos los enlaces email→cookie". Valida con dbt tests: si hay algún edge con `match_score < 0.70`, el test falla y frena el despliegue.

Una pipeline de identidad sin calidad de datos es peligrosa — unificaciones equivocadas rompen LTV, attribution, segmentación. El trabajo de Roibase en [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/es/firstparty) integra esta pipeline con consent layer, server-side GTM y CDP.

Ahora toca activar el identity graph downstream: segment builder, recommendation engine, LTV prediction, MMM — todos consumen desde `canonical_user_id` para agregar métricas. Con un graph correcto, los 6 señales se reducen a 1 usuario, elevando LTV precision 30-40% (benchmark Google Analytics 4, 2025), y ampliando la ventana de atribución 25% (Google). Hash matching da la base determinística,