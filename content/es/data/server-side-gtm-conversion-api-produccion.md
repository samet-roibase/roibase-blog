---
title: "Server-Side GTM y Conversion API: De Cero a Producción"
description: "Configuración de tagging server-side en Cloud Run y Workers, plantillas de contenedor, deduplicación de eventos y estrategias de monitoreo en producción."
publishedAt: 2026-05-07
modifiedAt: 2026-05-07
category: data
i18nKey: data-001-2026-05
tags: [server-side-gtm, conversion-api, cloud-run, event-deduplication, privacy-sandbox]
readingTime: 9
author: Roibase
---

La medición basada en navegador está muerta. Las cookies de terceros desaparecieron, ITP cayó a 12 horas, Consent Mode v2 es obligatorio. Las marcas que no envían eventos directamente a los endpoints de API de Meta y Google están en la oscuridad de atribución. La configuración de Server-Side Google Tag Manager (sGTM) y Conversion API no es opcional en 2026 — es un requisito de producción. En este artículo mostraremos cómo desplegar un contenedor sGTM production-ready desde cero en Cloud Run, cómo configurar deduplicación de eventos y qué métricas monitorear.

## Por Qué el Tagging Server-Side Requiere un Contenedor

La librería JavaScript clásica de GTM en el navegador carga etiquetas y recopila datos del user agent. El sGTM funciona al revés: un contenedor Node.js ejecutándose en tu servidor recibe POST HTTP desde el cliente, enriquece eventos (IP, análisis de user-agent, ID de first-party desde cookies) y los transmite a APIs de destino (Meta CAPI, Google Ads Conversion, GA4 Measurement Protocol). Esta arquitectura proporciona 3 beneficios clave: (1) eludes restricciones del navegador — no hay ITP, adblockers ni CORS; (2) puedes hashear PII de forma controlada — email, teléfono se hash SHA-256 en el servidor, nunca regresan al navegador; (3) envías un evento a múltiples plataformas en paralelo — un POST del cliente, fan-out a 4 endpoints diferentes desde el servidor.

La ruta oficial de Google para desplegar es App Engine o Cloud Run. App Engine trae costo fijo + auto-scaling, pero no se puede personalizar. Se prefiere Cloud Run porque con minimum instance=1 puedes garantizar latencia 24/7 y personalizar la imagen del contenedor con un Dockerfile custom (por ejemplo, inyectar secrets desde variables de entorno, scripts de inicio). La alternativa es Cloudflare Workers — menor latencia de cold-start (~5ms vs 200ms) pero las limitaciones del sandbox de Node.js impiden que funcionen algunas etiquetas de GTM (especialmente custom templates que requieren módulos nativos).

El proceso de despliegue consta de estos pasos: (1) nuevo proyecto en Google Cloud Console, (2) extraer la imagen del contenedor sGTM con `gcloud` CLI, (3) crear servicio Cloud Run + establecer variables de entorno (`CONTAINER_CONFIG`, `PREVIEW_SERVER_URL`), (4) vincular dominio personalizado (ej. `gtm.roibase.com.tr`) — obligatorio para contexto first-party, (5) añadir la URL del servidor de tagging al GTM web (`serverContainerUrl` parameter). El primer despliegue toma 15 minutos, después se reduce a 2 minutos con CI/CD.

## Deduplicación de Eventos: Vincular Señal de Cliente + Servidor con un ID Único

El problema crítico del sGTM es la deduplicación. Si la misma conversión se envía tanto desde el navegador (etiqueta GA4 client-side) como desde el servidor (cliente GA4 server-side), la plataforma cuenta 2 conversiones. Para Meta CAPI y Google Ads Conversion es obligatorio un sistema de event deduplication ID. Cómo funciona: asignas un `event_id` único a cada evento (o en terminología de Meta `event_name + event_id`), tanto cliente como servidor envían el mismo ID, la plataforma en una ventana de 24 horas deduplica si hay colisión de ID.

Estrategias de Deduplication ID:

| Método | Ventaja | Riesgo |
|--------|---------|--------|
| UUID v4 (aleatorio) | Riesgo de colisión nulo | Requiere sincronización cliente-servidor (localStorage/cookie) |
| ID de transacción (e-commerce) | Único naturalmente | No existe para eventos no-transaccioneles (lead, signup) |
| Session ID + timestamp | Fácil de generar | Puede colisionar en superposición de sesiones |
| `_ga` client ID + event timestamp | Basado en ID first-party | Riesgo de skew de reloj (diferencia horaria cliente/servidor) |

Setup de Roibase en producción: `SHA-256(_ga + event_name + unix_ms)` — cuando haces push al DataLayer en el navegador, rellenas el field `event_id` con este hash, la etiqueta GA4 server-side lee el mismo field y lo envía a Measurement Protocol. Para Meta CAPI inyectamos parámetros adicionales `event_source_url` y `action_source=website` en el servidor porque el Pixel de Facebook client-side no envía estos fields pero son obligatorios para validación server-side.

```javascript
// Ejemplo de push al DataLayer (client-side)
window.dataLayer.push({
  event: 'purchase',
  event_id: sha256(_ga + 'purchase' + Date.now()),
  transaction_id: 'ORD-12345',
  value: 299.00,
  currency: 'TRY'
});
```

En el contenedor server-side creamos variables personalizadas mapeando el `{{Event ID}}` a ambas etiquetas GA4 y CAPI. GA4 Measurement Protocol soporta el parámetro `&ep.event_id=`, Meta CAPI tiene un field `event_id` a nivel raíz. Para Google Ads Conversion la combinación `gclid` + `conversion_action_id` proporciona deduplicación — el `gclid` se lee desde la cookie y se envía al servidor mediante POST, la etiqueta de Ads en el servidor combina `gclid` + `conversion_value` y los envía a la Conversion Tracking API.

## Plantilla de Contenedor y Configuración de Cliente Personalizado

El contenedor sGTM está formado por 3 componentes fundamentales: **Cliente** (parsea solicitud HTTP entrante, la transforma en objeto evento), **Etiqueta** (envía evento a API externa), **Variable** (compartición de datos entre etiquetas). El cliente "GA4" por defecto de Google no es suficiente porque solo escucha el endpoint `/g/collect`. Escribimos un cliente personalizado para manejar tanto GA4 como endpoints personalizados (`/event`, `/purchase`) en el mismo contenedor.

Ejemplo de plantilla de cliente personalizado:

```javascript
const claimRequest = require('claimRequest');
const getRequestBody = require('getRequestBody');
const JSON = require('JSON');
const logToConsole = require('logToConsole');

claimRequest();

const body = getRequestBody();
const eventData = JSON.parse(body);

// Normaliza el objeto evento
const normalizedEvent = {
  event_name: eventData.event || 'unknown',
  user_data: {
    client_id: eventData.client_id,
    user_agent: eventData.user_agent,
    ip_override: eventData.ip_address
  },
  event_id: eventData.event_id,
  timestamp_micros: eventData.timestamp * 1000000
};

logToConsole('Normalized event:', normalizedEvent);
runContainer(normalizedEvent, () => {
  returnResponse();
});
```

Este cliente captura POST que llegan a la ruta `/event`, parsea el body JSON y lo transforma al modelo de evento de sGTM. La llamada a `runContainer()` dispara la ejecución de las etiquetas — cuando la etiqueta GA4 ve `event_name=purchase` envía a Measurement Protocol, cuando la etiqueta Meta CAPI ve `user_data.email` lo hashea SHA-256 y lo envía al endpoint `/events`.

En setup de producción ejecutamos 4 clientes: (1) cliente GA4 por defecto (`/g/collect`), (2) cliente JSON personalizado (`/event`), (3) cliente Meta Pixel (`/tr/` endpoint — para compatibilidad con Facebook SDK), (4) cliente health check (`/health`) — Cloud Run usa este endpoint para ping de liveness probe y verificar la salud del contenedor. Cada cliente tiene un orden de prioridad (priority number) — si dos clientes reclaman el mismo path, gana el de mayor prioridad.

Es crítico mantener las plantillas personalizadas bajo control de versiones. Los cambios realizados en la UI de Google Tag Manager no aparecen en el histórico de git. Nuestro flujo: guarda plantillas como archivos `.tpl` en el repositorio, el pipeline CI usa la herramienta CLI `gtm-template-push` para desplegar en el workspace de sGTM, prueba en contenedor staging, luego promueve a producción. De esta forma el rollback es un git revert.

## Monitoreo en Producción: Qué Métricas Son Críticas

Después de desplegar sGTM, necesitas monitoreo en 4 capas para no quedarte a oscuras: (1) salud del contenedor (uptime, latencia, error rate), (2) throughput de eventos (eventos/seg, success rate de etiquetas), (3) precisión de deduplicación (delta de conteo de eventos cliente vs servidor), (4) validación de plataforma descendente (Meta Event Quality Score, estado de Google Ads conversion tracking).

Métricas nativas de Cloud Run:

- **Request count** — número de POST al endpoint `/event`, desglose por minuto
- **Request latency (p50, p95, p99)** — si la mediana está por encima de 120ms hay un problema (normalmente 40-80ms)
- **Container instance count** — si estableces min=1 siempre debería ser 1, auto-scale en picos
- **Error rate (5xx)** — si es >0.1% hay problemas sostenidos en etiquetas descendentes

En la propia Console de sGTM hay una pestaña "Logs" con debug log a nivel de evento, pero en producción `console.log` en cada evento genera sobrecarga I/O. Nuestro setup: debug logging solo activo con query param `?gtm_debug=1`, desactivado en tráfico de producción. Los errores críticos (HTTP 4xx/5xx desde etiquetas Meta/Google) van como JSON structured log a Google Cloud Logging, desde ahí disparan alert policies — si CAPI devuelve 10+ errores "Invalid access token" en 3 minutos, genera ping a Slack.

Para monitoreo de throughput de eventos creamos métrica personalizada: las etiquetas de sGTM hacen llamadas como `sendHttpGet('https://metrics.roibase.com.tr/increment?metric=capi_event')`, el servicio de métricas mantiene counters en formato Prometheus. Así en el dashboard Grafana vemos flujo de eventos en tiempo real — si GA4 client-side envía 1000 eventos/min pero server-side CAPI solo recibe 850/min, hay colisión de deduplication ID o drop de red.

La validación de plataforma descendente es la parte más crítica. Meta Events Manager tiene Event Match Quality (EMQ) score — si es <6.5/10 significa "baja calidad", indica algoritmo de hash incorrecto o fields de PII faltantes. En Google Ads Conversion Tracking debe decir "Status: Eligible" — si dice "Rarely used" o "Below threshold" el volumen de conversiones no es suficiente (mínimo 15 conversiones/30 días). En GA4 DebugView filtra eventos server-side con `traffic_type=server_side`, compara la métrica `event_count` con client-side — si hay >20% de diferencia necesita investigación.

## Resolución de Identidad y Señales de User Matching

La potencia del ölçüm server-side radica en poder transmitir señales PII (Personally Identifiable Information) de forma controlada a plataformas. Meta CAPI acepta 7 parámetros diferentes de user matching: `em` (email hash), `ph` (phone hash), `fn` (first name), `ln` (last name), `ct` (city), `st` (state), `zp` (zip), `country`, `external_id` (CRM ID). Cuantas más señales envías, más alto el EMQ score — solo con `em` obtienes 4.2/10, con `em + ph + fn + ln` llegas a 7.8/10. Google Enhanced Conversions funciona igual: cuando añades `sha256_email_address` y `sha256_phone_number` a la etiqueta Ads Conversion, la precisión de atribución sube ~40% (datos de beta test de Google 2025).

El pipeline de resolución de identidad de Roibase en producción: (1) el usuario ingresa email/teléfono en formulario web, (2) JS client-side hashea SHA-256 (texto plano nunca se guarda en navegador), (3) valor hasheado se pushea al DataLayer, (4) sGTM toma el hash y lo envía a Meta CAPI como field `user_data.em`, a Google como `user_data.sha256_email_address`. Este flujo es KVKK/GDPR compliant porque PII plano nunca toca server logs — SHA-256 es one-way hash, irreversible.

Señal adicional: leemos cookies `fbp` (Facebook Browser ID) y `fbc` (Facebook Click ID) server-side y las enviamos a CAPI. El Pixel de Facebook client-side establece la cookie `fbp` pero ITP la expira después de 7 días; nosotros la leemos server-side y la reescribimos con TTL 90 días (como se establece desde dominio first-party, elude ITP). La cookie `fbc` lleva el `fbclid` del query param cuando vienes desde anuncio de Facebook — server-side parseamos este ID y lo agregamos al field `fbc` de CAPI, esto extiende la ventana de atribución de Meta de 24 horas a 28 días.

El mecanismo `gclid` (Google Click ID) de Google funciona similar. GTM client-side lee `gclid` de la URL y lo escribe en cookie `_gcl_aw`, con expire 90 días. Server-side leemos esta cookie y la añadimos como parámetro `gclid` a la etiqueta Ads Conversion. La API de Conversion Tracking server-side de Google usa la combinación `gclid` + `conversion_action_id` como clave única — si envías 2 conversiones con el mismo `gclid`, la plataforma deduplica. Nuestro setup: si no hay cookie `gclid` (tráfico directo) mapeamos el client ID `_ga` del usuario al parámetro `gbraid` como fallback — esto vincula atribución de Google Analytics a Ads.

## Compliance y Orquestación de Consentimiento

Si el tagging server-side no se integra con Consent Mode v2, hay riesgo de violación GDPR. La regla de Google: cuando `ad_storage=denied`, la etiqueta Google Ads Conversion en sGTM no debería dispararse o solo enviar señal anonimizada (IP masking + drop de user ID). El sistema Limited Data Use (LDU) de Meta es similar: para tráfico de California, agrega el parámetro `data_processing_options=['LDU']` a la solicitud CAPI para que Meta no use datos para publicidad personalizada.

Nuestro stack de orquestación de consentimiento