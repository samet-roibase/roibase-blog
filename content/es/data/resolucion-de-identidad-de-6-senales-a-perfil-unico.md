---
title: "Resolución de Identidad: De 6 Señales a un Perfil Único de Cliente"
description: "Hash determinístico, probabilistic linking y household identity. Arquitecturas modernas para unificar señales dispersas en un grafo de identidad único."
publishedAt: 2026-05-12
modifiedAt: 2026-05-12
category: data
i18nKey: data-003-2026-05
tags: [identity-resolution, hash-matching, probabilistic-linking, cdp, first-party-data]
readingTime: 9
author: Roibase
---

El cliente promedio de e-commerce te ve desde 6 dispositivos diferentes a través de 11 touchpoints antes de decidirse a comprar. GA4 los registra como 4 usuarios distintos, tu CRM identifica 2 leads separados, tu plataforma de email ve 1 suscriptor. En un mundo post-cookie, sin unificar estos fragmentos la atribución es imposible, la segmentación carece de significado, y no puedes calcular el valor de vida del cliente. La resolución de identidad es la disciplina de data engineering que une estos fragmentos — requiere una arquitectura de 3 capas: desde hash matching determinístico hasta probabilistic linking.

## Hash Matching: La Columna Vertebral Determinística de la Identidad

El emparejamiento determinístico funciona mediante hash SHA-256. El email "user@example.com" → hash "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8" → si el mismo hash existe en cada sistema, es la misma persona. Cuando el usuario inicia sesión, añades el parámetro `user_data.email_sha256` al payload del evento en GTM del lado del servidor. En BigQuery, esa sesión web + lead de CRM + suscriptor de Klaviyo se unen en una sola fila usando ese hash.

Dos puntos críticos: la estrategia de salt y el riesgo de colisión. Si haces hash directo sin salt hay riesgo de ataque con rainbow tables, pero en un pipeline de marketing data el salt debe ser consistente en todos los sistemas, de lo contrario el mismo email genera diferentes hashes. El riesgo de colisión en SHA-256 es teórico — en un espacio de 2^256 no hay colisiones prácticas, pero en campos de baja entropía como números telefónicos el determinismo se debilita. Por eso una combinación email + teléfono forma una columna vertebral más segura.

Cuando extraes datos de Klaviyo hacia BigQuery, añades la columna `user_properties.email_sha256` y en tu modelo dbt ejecutas `LEFT JOIN web_events USING (email_sha256)`. Así la sesión web anónima se une con el perfil del suscriptor en una sola fila. La estrategia snapshot es importante — los emparejamientos hash deben guardarse en snapshots diarios porque si el usuario cambia su email, los emparejamientos históricos no deben perderse.

## Probabilistic Linking: Lógica Difusa para Unir Señales

El emparejamiento determinístico es insuficiente en web móvil sin cookie. El usuario sale sin iniciar sesión, no proporciona email pero la combinación IP + user agent + timezone + language sugiere con 87% de certeza que es la misma persona. Aquí entra en juego el identity graph probabilístico — haces ponderación bayesiana de señales.

Hay seis capas fundamentales de señales: device fingerprint (hash canvas, WebGL renderer), network layer (subnet IP, ASN), behavioral pattern (duración de sesión, secuencia de página), geolocalización (clustering de lat/long GPS), temporal signal (patrón de horario activo) y contextual metadata (dominio referrer, consistencia UTM). Cada señal recibe un confidence score de 0-100, y si la suma ponderada supera 70, asignas un `probabilistic_id` temporal.

En BigQuery lo modelasas así:

```sql
WITH signal_scores AS (
  SELECT
    session_id,
    device_fingerprint,
    ip_subnet,
    SUM(
      CASE WHEN device_fingerprint_match THEN 40 ELSE 0 END +
      CASE WHEN ip_subnet_match AND hour_diff < 4 THEN 25 ELSE 0 END +
      CASE WHEN behavior_vector_similarity > 0.8 THEN 20 ELSE 0 END
    ) AS total_confidence
  FROM event_stream
  WHERE timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
)
SELECT session_id, device_fingerprint, total_confidence,
  CASE WHEN total_confidence >= 70 
    THEN GENERATE_UUID() 
    ELSE NULL 
  END AS probabilistic_id
FROM signal_scores
```

El trade-off de este enfoque es el riesgo de falsos positivos — una computadora compartida (oficina) o uso de VPN puede unir a personas diferentes. Por eso los IDs probabilísticos siempre deben validarse contra el hash determinístico — cuando el usuario inicia sesión, ejecutas una operación "merge" sobre el hash que corrige todas las sesiones probabilísticas anteriores.

## Household Identity: De Clusters de Dispositivos a Unidades de Hogar

La unidad de decisión típicamente no es el individuo, sino el hogar. Desde la misma IP hay 3 dispositivos: MacBook (mujer por las mañanas), iPhone (durante el día), iPad (niño por la noche). Agruparlos como un solo "individuo" es incorrecto, pero agruparlos como una "household" es crítico para segmentación — especialmente en bienes de consumo duradero (electrodomésticos, muebles) donde la decisión de compra es a nivel familiar.

El household graph se construye sobre MAC del router/módem + subnet IP + ubicación GPS. La base es network fingerprint, no device fingerprint, porque el WiFi router genera la misma MAC gateway en todos los dispositivos. El cuidado aquí está en filtrar WiFi público — si agruparas 200 dispositivos desde una IP de Starbucks como un "hogar", el modelo se colapsa. Lo filtras con thresholds de session count (IP con 50+ dispositivos únicos → blacklist) y dwelling time pattern (IP sin sesiones de 2+ horas → café/retail).

En BigQuery asignas el household ID así:

```sql
CREATE OR REPLACE TABLE households AS
WITH network_clusters AS (
  SELECT ip_subnet, router_mac, GPS_lat, GPS_long,
    APPROX_COUNT_DISTINCT(device_id) AS device_count,
    AVG(session_duration_sec) AS avg_session
  FROM sessions
  WHERE DATE(timestamp) > DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY 1,2,3,4
  HAVING device_count BETWEEN 1 AND 8 AND avg_session > 120
)
SELECT *, GENERATE_UUID() AS household_id
FROM network_clusters
```

El lifetime value a nivel household es más significativo porque la compra de un electrodoméstico se hace para el hogar, no para una persona. En una arquitectura [CDP y Retention Engineering](https://www.roibase.com.tr/es/retention-engineering-cdp), los segmentos de household generan 23% más ROAS que segmentos individuales — porque en lugar de enviar mensajes desde un único teléfono a múltiples dispositivos, la estrategia se enfoca en la unidad del hogar.

## Graph Stitching: Unificación de Identidad en el Tiempo

El identity graph no es estático — hoy el usuario es anónimo, mañana proporciona email, en 5 días inicia sesión, en 2 meses actualiza su número de teléfono. Con cada nueva señal, los fragmentos anteriores se "cosen" — es decir, los IDs probabilísticos antiguos se fusionan con el nuevo hash determinístico.

Lo resuelves con una arquitectura event-driven: cada evento `user_identified` se envía a Pub/Sub, se dispara una Cloud Function, y en BigQuery se ejecuta un statement `MERGE`. Por ejemplo: el usuario inicia sesión → llega el hash de email → se fusionan todos los IDs probabilísticos creados en los últimos 90 días con este hash. Esta operación de backfill debe remontarse toda la ventana de atribución — si tu conversion window es de 30 días, debes coser 30 días atrás.

```sql
MERGE INTO unified_identity AS target
USING (
  SELECT probabilistic_id, email_sha256, MAX(timestamp) AS last_seen
  FROM identification_events
  WHERE event_name = 'user_login'
  GROUP BY 1,2
) AS source
ON target.probabilistic_id = source.probabilistic_id
WHEN MATCHED THEN UPDATE SET 
  target.email_sha256 = source.email_sha256,
  target.is_deterministic = TRUE,
  target.stitched_at = CURRENT_TIMESTAMP()
```

El stitching corre riesgo de race conditions — si el mismo usuario inicia sesión simultáneamente desde 2 dispositivos, dos operaciones merge pueden colisionar. Lo resuelves con transaction locks o idempotency keys. La idempotency key es típicamente `device_id + timestamp_truncated_to_second` — dos eventos `user_login` del mismo dispositivo en el mismo segundo se tratan como un duplicado y disparan un único merge.

## Privacy + Compliance: PII Hasheado y Minimización de Datos

La resolución de identidad entra en categorías KVKK y GDPR de "automated decision making" y "profiling" — no puedes hacerla sin consentimiento explícito. Si la Consent Management Platform (OneTrust, Cookiebot) no señala `analytics_storage=granted`, ni siquiera puedes recabar el hash. En Consent Mode v2, con consentimiento básico el parámetro `user_data` permanece vacío; solo después del consentimiento mejorado se incluye el hash.

El hash no se cuenta como PII pero sí como pseudonimización — bajo GDPR, tu "derecho al olvido" aplica también a los hashes. Cuando llega una solicitud de eliminación, debes ejecutar `DELETE` en BigQuery filtrando por `email_sha256` y propagarla a sistemas downstream (CDP, CRM). Por eso tu tabla de mapeo hash debe ser centralizada — no debe estar dispersa en sistemas distribuidos, sino derivarse de una única fuente de verdad.

El principio de minimización de datos debe limitar tu identity graph a 90 días. Los IDs probabilísticos más antiguos de 90 días deben archivarse; solo los hashes determinísticos deben conservarse a largo plazo. Esto es crítico tanto para compliance como para costo — en BigQuery, con partition pruning sobre una ventana rolling de 90 días, el costo de query cae 60%.

## Arquitectura de Pipeline en Producción: Híbrido Batch + Streaming

El pipeline de resolución de identidad funciona en dos capas: streaming layer (recopilación de señales en tiempo real) y batch layer (stitching nocturno). El streaming layer usa Pub/Sub → Dataflow → BigQuery write con inserciones de streaming, con latencia < 10 segundos. El batch layer se dispara con dbt en horario programado, a las 04:00 a.m., ejecutando todo el stitching de grafo y clustering de household.

En la capa streaming solo recopilan señales — no se hace hash matching ni probabilistic scoring porque los JOINs complejos en streaming son costosos. Los eventos se escriben en Firestore con `event_id` como restricción unique para prevenir escrituras duplicadas. La capa batch lee estos eventos y los transforma en BigQuery al modelo dimensional. Las macros dbt encadenan la generación de hash, cálculo de score, y merge de grafo en un único pipeline.

Para monitoreo, la métrica identity coverage es crítica: `identified_users / total_active_users`. Si está por debajo de 40%, falta señal determinística — debes optimizar el login flow y los formularios de lead para capturar email. Por encima de 75% se considera coverage saludable. Esta métrica se define como test en dbt en el archivo `data_tests/identity_coverage.sql` y se ejecuta antes de cada deployment en CI/CD.

La resolución de identidad es la columna vertebral del stack moderno de marketing. El mundo post-cookie hizo que el hash determinístico fuera el estándar de oro, pero por sí solo es insuficiente — necesitas una arquitectura de 3 capas que combine probabilistic linking y household clustering. Cuando este pipeline está modelado en BigQuery con dbt, es aware del consentimiento, cumple normativas y está listo para producción, puedes construir tus modelos de atribución, estrategias de segmentación y proyecciones de lifetime value sobre una única vista unificada de cliente.