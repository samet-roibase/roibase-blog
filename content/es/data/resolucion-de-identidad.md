---
title: "Identity Resolution: De 6 Señales a una Identidad Única del Cliente"
description: "Hash matching, linking probabilístico y household identity para unificar señales dispersas de clientes en una sola identidad. Ingeniería con BigQuery + CDP."
publishedAt: 2026-06-16
modifiedAt: 2026-06-16
category: data
i18nKey: data-003-2026-06
tags: [identity-resolution, customer-data-platform, hash-matching, probabilistic-linking, first-party-data]
readingTime: 8
author: Roibase
---

La vida útil de las cookies cayó de 28 días promedio a 7 días. Un usuario comienza en una app móvil, realiza el pago en web de escritorio, regresa desde una campaña de email — cada punto de contacto genera un identifier diferente. El 40% de los datos de marketing quedan como eventos huérfanos: sin user_id, sin session_id, sin atribución de conversión. Identity resolution es la operación de ingeniería que ensambla estas piezas con disciplina: hash matching en lugar de conjeturas, gráfos probabilísticos en lugar de razonamientos, clustering de hogares en lugar de suposiciones.

## Matching Determinístico: Unificación Basada en Hash

El matching determinístico funciona cuando **sabes con certeza** que dos puntos de datos comparten el mismo identifier. Hash SHA-256 del email, hash del número telefónico, ID de CRM. Si en tu tabla de eventos de BigQuery tienes `user_id` pero en Google Analytics tienes `ga_client_id`, no puedes hacer JOIN directo — primero necesitas encontrar un evento de puente donde ambos estén registrados y crear una tabla de mapeo.

```sql
-- Ejemplo de stitching de identidad determinístico
CREATE OR REPLACE TABLE `project.dataset.identity_graph` AS
WITH email_hashes AS (
  SELECT DISTINCT
    user_pseudo_id,
    TO_HEX(SHA256(LOWER(TRIM(user_properties.email.value)))) AS email_hash
  FROM `project.dataset.events_*`
  WHERE user_properties.email.value IS NOT NULL
),
crm_map AS (
  SELECT
    crm_id,
    TO_HEX(SHA256(LOWER(TRIM(email)))) AS email_hash
  FROM `project.crm.customers`
)
SELECT
  e.user_pseudo_id,
  c.crm_id,
  e.email_hash
FROM email_hashes e
INNER JOIN crm_map c
  ON e.email_hash = c.email_hash;
```

Esta query conecta el `user_pseudo_id` que viene de Firebase Analytics con el `crm_id` del CRM mediante **matching exacto** sobre hash de email. El hash del email actúa como identifier ancla. Detalle crítico: `LOWER(TRIM())` — si el usuario escribió "Ali@X.com" pero en CRM está "ali@x.com", el hash se rompe. Por eso la normalización es el primer paso del pipeline.

El matching determinístico tiene precisión del 100%, pero recall bajo — solo encuentra registros donde ambos sistemas comparten el mismo identifier. Si un usuario salió del web sin proporcionar email, no entra en este gráfo.

### Colisión de Hash y Privacidad

La probabilidad de colisión SHA-256 es teóricamente 2^-256 — en uso práctico, cero. Sin embargo, GDPR Artículo 32 no equipara hash con "pseudonimización"; un hash por sí solo no es anonimización. La combinación de hash de email + IP + timestamp permite re-identificar al usuario. Por eso las tablas de hash deben protegerse con encryption-at-rest + control de acceso a nivel de columna.

## Linking Probabilístico: Matching Basado en Gráfos

Cuando el join determinístico falla, entra en juego el matching probabilístico. Conectas dos registros con diferentes identifier mediante **similitud de comportamiento**, **device fingerprint**, **timezone + user-agent** y otras weak signals. No es un modelo de machine learning — un sistema de puntuación ponderada + threshold es suficiente.

| Signal | Peso | Ejemplo |
|--------|------|---------|
| Misma IP (dentro de 24 horas) | 0.3 | 192.168.1.10 |
| Mismo User-Agent | 0.2 | Chrome 120 / Mac |
| Misma ubicación geográfica | 0.15 | Estambul, Kadıköy |
| Mismo clic de campaña | 0.25 | utm_campaign=spring_sale |
| Misma secuencia de visualización de producto | 0.1 | producto_123 → producto_456 |

Si la puntuación total ≥ 0.7, dos sesiones **probablemente** pertenecen a la misma persona. Este threshold se ajusta según el dataset — en e-commerce 0.65 puede ser suficiente, en fintech necesitas 0.85.

```sql
-- Ejemplo de scoring probabilístico
WITH sessions AS (
  SELECT
    session_id,
    user_pseudo_id,
    device.operating_system,
    device.web_info.browser,
    geo.city,
    traffic_source.medium,
    ARRAY_AGG(ecommerce.items.item_id ORDER BY event_timestamp) AS item_sequence
  FROM `project.dataset.events_*`
  WHERE event_name = 'page_view'
  GROUP BY 1,2,3,4,5,6
)
SELECT
  a.session_id AS session_a,
  b.session_id AS session_b,
  (CASE WHEN a.operating_system = b.operating_system THEN 0.2 ELSE 0 END +
   CASE WHEN a.browser = b.browser THEN 0.2 ELSE 0 END +
   CASE WHEN a.city = b.city THEN 0.15 ELSE 0 END +
   CASE WHEN a.medium = b.medium THEN 0.25 ELSE 0 END +
   CASE WHEN a.item_sequence = b.item_sequence THEN 0.2 ELSE 0 END
  ) AS match_score
FROM sessions a
CROSS JOIN sessions b
WHERE a.session_id < b.session_id  -- optimización de self-join
  AND a.user_pseudo_id != b.user_pseudo_id
HAVING match_score >= 0.7;
```

Esta query compara **todos los pares de sesiones** — complejidad N². Si tienes 1M sesiones, son 500 mil millones de comparaciones. En producción necesitas particionamiento: ventana de timestamp (7 días), filtro geográfico (misma ciudad), tipo de dispositivo (mobile-mobile).

El false positive del linking probabilístico es 5-15%. Por eso en activación downstream (push de CDP, campañas de email) debes marcar estos ID's con un flag "potential_duplicate".

## Household Identity: Mismo Dispositivo, Usuarios Diferentes

Una tablet o Smart TV se usa entre varios miembros de la familia. El matching determinístico o probabilístico colapsa aquí — crea un único ID para perfiles diferentes dentro del hogar, lo que causa personalization incorrecta. Household identity resolution intenta distinguir estos escenarios.

**Session-level fingerprint:** Usuarios que se loguean a diferentes horas en el mismo dispositivo tienen patrones de navegación distintos. Un usuario que busca ropa a las 08:00 es diferente de quien busca electrónica a las 23:00.

**Behavioral clustering:** K-means o clustering jerárquico agrupa sesiones. Si los centroides son distintos, creas un "virtual user" separado bajo el mismo device_id.

```sql
-- Extracción de features para clustering de hogares
CREATE OR REPLACE TABLE `project.dataset.household_features` AS
SELECT
  device_id,
  EXTRACT(HOUR FROM TIMESTAMP_MICROS(event_timestamp)) AS hour_of_day,
  COUNT(DISTINCT CASE WHEN event_name = 'purchase' THEN ecommerce.transaction_id END) AS purchase_count,
  APPROX_TOP_COUNT(ecommerce.items.item_category, 3) AS top_categories,
  AVG(ecommerce.purchase_revenue_in_usd) AS avg_basket_value
FROM `project.dataset.events_*`
WHERE device_id IS NOT NULL
GROUP BY device_id, hour_of_day;
```

Tras el clustering, cada device_id genera virtual ID's como `household_user_1`, `household_user_2`. Estos ID's no se sincronizan con CRM — solo se usan en analytics y personalization layer.

La sensibilidad de household resolution es baja — 30% de error es normal. Por eso fuera de e-commerce (especialmente SaaS, fintech) no se aplica.

## Estructura del Identity Graph y Mantenimiento

Todos los resultados de matching se consolidan en una única tabla de **identity graph**. Esta tabla mantiene, para cada user_id, todos los alias conocidos: email hash, ID de CRM, ga_client_id, Firebase ID, advertising ID.

| canonical_id | identifier_type | identifier_value | match_method | confidence | updated_at |
|--------------|-----------------|------------------|--------------|------------|------------|
| user_0001 | email_hash | a1b2c3... | deterministic | 1.0 | 2026-06-15 |
| user_0001 | ga_client_id | GA1.2.123 | deterministic | 1.0 | 2026-06-14 |
| user_0001 | firebase_id | xyz789 | probabilistic | 0.75 | 2026-06-16 |
| user_0002 | crm_id | CRM-456 | deterministic | 1.0 | 2026-06-10 |

El graph se actualiza incrementalmente — cada día se escanean nuevos eventos y se añaden nuevos matches. Los links antiguos decaen en confianza: un link probabilístico de 90 días reduce su confidence de 0.75 a 0.50.

Si modeleas el graph como un **directed acyclic graph (DAG)**, puedes detectar loops. Un ciclo User A → User B → User C → User A es síntoma de error en datos — requiere revisión manual.

## Integración con CDP y Pipeline de Activación

El identity graph no funciona solo — se alimenta a un CDP. La arquitectura de [CDP & Retention Engineering](https://www.roibase.com.tr/es/retention-engineering-cdp) toma el canonical_id del graph, consolida todos los touch points bajo este ID y lo envía al segmentation engine.

El proceso de activación funciona así:

1. **Segment definition:** "3+ sesiones en últimos 30 días, con agregación al carrito pero sin compra" → se define como BigQuery view.
2. **Identity resolution:** La view busca canonical_id para cada user_pseudo_id.
3. **Channel sync:** Todos los email hashes bajo canonical_id se envían a Meta CAPI; los phone hashes a Google Customer Match.
4. **Attribution:** Cuando llega un conversion event, se rastrea con canonical_id a través del graph para trazar todos los touch points.

Sin CDP, identity resolution queda incompleta — el graph solo dice "quién coincide con quién", no "qué acción tomar con este usuario".

## Conformidad de Privacidad y Propagación de Consentimiento

Identity resolution se justifica bajo GDPR Artículo 6(1)(f) "interés legítimo" — pero si el usuario no ha dado consentimiento explícito, los ID derivados de este graph no pueden usarse para remarketing. La integración con Consent Management Platform (CMP) es obligatoria.

Cada canonical_id mantiene estado de consentimiento: `{ analytics: true, marketing: false, personalization: true }`. Los identifier derivados del graph heredan este flag — es decir, si el email_hash de User A tiene marketing=false, el ga_client_id de User A derivado del link probabilístico tampoco entra en segmentos de marketing.

Bajo TCF 2.2, la propagación de vendor consent es más compleja: usuarios con consentimiento para Meta pero no para Google requieren sync selectivo del graph. Esta arquitectura es parte del proceso de [First-Party Data & Arquitectura de Medición](https://www.roibase.com.tr/es/firstparty) — las señales de consentimiento se inyectan al inicio del pipeline de eventos, y los jobs de actualización del graph las procesan.

---

Identity resolution no es solo una operación JOIN técnica — es la capa crítica que conecta datos de marketing con mecanismos de decisión. Resolver matching exacto con hash, weak signals con scoring probabilístico, compartición de dispositivos con clustering de hogares requiere precisión en ingeniería. Mantener el graph actualizado, alinearlo con propagación de consentimiento, alimentarlo al pipeline de activación de CDP es la cara de producción de esta disciplina. En la era sin cookies, la identidad del cliente no se adivina — se construye a partir de seis identifier diferentes unificados.