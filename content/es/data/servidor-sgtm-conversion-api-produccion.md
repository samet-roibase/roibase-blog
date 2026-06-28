---
title: "Server-Side GTM y Conversion API: De Cero a Producción"
description: "Guía para construir infraestructura de medición server-side en Cloud Run o Workers. Template de contenedor, lógica de deduplicación y checklist de producción."
publishedAt: 2026-06-28
modifiedAt: 2026-06-28
category: data
i18nKey: data-001-2026-06
tags: [server-side-gtm, conversion-api, cloud-run, container-deduplication, first-party-data]
readingTime: 9
author: Roibase
---

Con la era de las cookies llegando a su fin, si tu infraestructura de medición sigue funcionando en un contenedor web, estás aceptando pérdidas de atribución. Los números de ROAS en Facebook que cayeron entre 30-40% después de iOS 14.5 no son coincidencia — son prueba de que el tagging client-side ya no refleja la realidad. Server-side tagging y Conversion API son el nuevo estándar para transportar estas señales a las plataformas sin las restricciones del navegador. En este artículo construimos desde cero una infraestructura de server-side GTM lista para producción en Google Cloud Run o Cloudflare Workers.

## El Final del Tagging Client-Side, el Comienzo del Server-Side

Google Tag Manager ejecutándose en un contenedor web corre JavaScript en el navegador del visitante. En este escenario cada píxel, cada SDK de plataforma, envía solicitudes desde la IP del cliente. Con Safari ITP 2.0, la vida útil de las cookies de first-party bajó a 7 días; con Consent Mode v2, la tasa de rechazo alcanzó 60%. Cuando el navegador elimina estas cookies, la API de la plataforma pierde la identidad — la señal de conversión queda huérfana, la atribución se colapsa.

Server-side GTM invierte esta lógica. El contenedor web recopila datos mínimos del visitante (nombre del evento, user agent, IP) y los POST a tu propio servidor. El contenedor GTM ejecutándose en tu servidor (imagen Docker) recibe este evento, lo enriquece y lo envía server-to-server a la API de la plataforma. En este flujo la cookie no vive en el navegador sino en tu servidor, su vida útil la defines tú, se evita el ad blocker. Meta Conversion API o el Measurement Protocol de Google Analytics 4 se alimentan directamente desde tu servidor — la pérdida de datos baja de 60% a 10-15%.

Esta diferencia requiere profundidad técnica. La elección del proveedor cloud, la versión del contenedor, la estrategia de deduplicación, el esquema de mapeo de eventos — todo es crítico. Ahora los construimos.

## Configurar Server-Side Container en Google Cloud Run

Google Cloud Run es un runtime de contenedores serverless. Compila imagen desde Dockerfile, escala bajo demanda, baja a cero cuando está inactivo. El método de deployment oficial para server-side GTM no es Cloud Run (se prefieren App Engine o GCE manual) pero Cloud Run ofrece ventaja de costo — para 5-10 millones de eventos mensuales, cuesta ~$10-20 en lugar de $30-50.

El primer paso es abrir un nuevo proyecto en Google Cloud Console. Si tienes `gcloud` CLI instalado, la línea de comandos es más rápida:

```bash
gcloud projects create roibase-sgtm-prod --name="Roibase sGTM Production"
gcloud config set project roibase-sgtm-prod
gcloud services enable run.googleapis.com containerregistry.googleapis.com
```

En Google Tag Manager crea un contenedor de tipo **Servidor**. En Configuración > Configuración de Contenedor anota la **URL del Servidor de Etiquetado** (ej. `https://sgtm.roibase.io`). Este dominio personalizado apuntará al servicio de Cloud Run.

La imagen oficial de Google `gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable` es segura para producción pero sin bloqueo de versión. Nuestro enfoque es escribir nuestro propio Dockerfile fijando la imagen base:

```dockerfile
FROM gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable

ENV CONTAINER_CONFIG="<GTM container ID>"
ENV PREVIEW_SERVER_URL="https://sgtm-preview.roibase.io"

EXPOSE 8080

CMD ["/bin/sh", "-c", "/app/start_server"]
```

Deploy esta imagen a Cloud Run:

```bash
gcloud builds submit --tag gcr.io/roibase-sgtm-prod/sgtm-container
gcloud run deploy sgtm-service \
  --image gcr.io/roibase-sgtm-prod/sgtm-container \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars CONTAINER_CONFIG=GTM-XXXXXX
```

Para agregar un dominio personalizado al servicio de Cloud Run, ve a Cloud Run > Domain Mappings > Add Mapping. En tu proveedor DNS agrega un registro CNAME (`sgtm.roibase.io` → URL de Cloud Run). El certificado SSL se aprovisiona automáticamente (Let's Encrypt).

### Alternativa: Cloudflare Workers

Si prefieres estar fuera del ecosistema de Google, Cloudflare Workers es más flexible. La imagen de contenedor de server-side GTM no corre en Workers pero puedes escribir un proxy de tagging personalizado en Workers. El siguiente script proxy todos los eventos GTM y los envía al Measurement Protocol de GA4:

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  if (url.pathname === '/gtm') {
    const payload = await request.json()
    const measurementId = 'G-XXXXXXXXXX'
    const apiSecret = 'YOUR_API_SECRET'
    
    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: 'POST',
        body: JSON.stringify({
          client_id: payload.client_id,
          events: [{ name: payload.event_name, params: payload.event_params }]
        })
      }
    )
    return new Response('OK', { status: 200 })
  }
  return new Response('Not Found', { status: 404 })
}
```

El runtime de Workers inicia en menos de 50ms, Cloud Run tiene cold start de 2-3 segundos. Pero en Workers no tienes el Visual Tag Builder de GTM — necesitas escribir cada tag de plataforma como código. Cloud Run por ahora es más práctico.

## Deduplicación de Eventos: No Contar Dos Veces la Misma Conversión

Al migrar a tagging server-side, el contenedor web y el servidor trabajan en paralelo. El visitante realiza una compra → el píxel de Facebook client-side se dispara → el contenedor server-side también recibe el evento de purchase → la API de Facebook ve la misma conversión dos veces. El ROAS sube 200%, el optimizer de presupuesto recibe señal falsa.

La solución es deduplicación de eventos. Asigna a cada conversión un `event_id` único, que cliente y servidor envíen el mismo ID. Facebook ignora el segundo evento con el mismo `event_id`. La ventana de deduplicación es 48 horas (por defecto).

En el contenedor web de GTM, agrega el parámetro `event_id` a la configuración del tag de Facebook:

```javascript
fbq('track', 'Purchase', {
  value: 99.99,
  currency: 'TRY'
}, {
  eventID: '{{Transaction ID}}_{{Random Number}}'
});
```

En el contenedor server-side, en el tag de Meta Conversion API, mapea el mismo `event_id` como variable definida por el usuario. GTM no tiene una variable `Event ID` integrada, necesitas crear una manualmente. Elige tipo variable Data Layer, nombre de variable `event_id`, valor por defecto `{{Page Path}}_{{Random Number}}`.

Para Google Analytics 4 la situación es diferente. GA4 ya fusiona eventos client-side y Measurement Protocol (si el `client_id` y `session_id` son iguales). Sin deduplicación adicional, pero la consistencia de `client_id` es obligatoria. En el contenedor web, en la configuración del tag de GA4, selecciona **Enviar datos proporcionados por el usuario**, en el field `client_id` usa la variable GTM `{{GA Client ID}}`. En el contenedor del servidor usa el mismo valor.

Antes de llevar esta lógica a producción, pruébala en Preview mode. En el contenedor server GTM crea una URL de Preview, desde el contenedor web apunta a esa URL. En Chrome DevTools > pestañas Network, inspecciona las solicitudes POST al endpoint `/gtm` — los fields `event_id` y `client_id` deben estar tanto en el payload del cliente como del servidor.

## First-Party Cookie y Session Stitching

La potencia de la medición server-side reside en fijar la identidad del usuario a través de first-party cookies. El contenedor web mantiene `_ga` durante 2 años pero Safari la reduce a 7 días. El contenedor server-side puede establecer su propia cookie (`_sgtm` por ejemplo) usando el header `Set-Cookie` — como coincide el subdominio, evita ITP.

En el contenedor server GTM, bajo la sección **Client**, selecciona el tipo de cliente **Google Analytics: GA4**. Este cliente extrae `client_id` de la solicitud HTTP entrante y lo escribe en la cookie `_ga`. Pero esta cookie se agrega al header de respuesta, no al navegador — para que el navegador la vea, necesitas redireccionamiento GET desde el contenedor web al servidor en lugar de POST (complicado).

Método más simple: agrega `client_id` a DataLayer en el contenedor web, el contenedor del servidor lo recibe y lo almacena en tu propia base de datos. Por ejemplo, tabla `user_sessions` en BigQuery:

```sql
CREATE TABLE analytics.user_sessions (
  client_id STRING,
  session_id STRING,
  first_visit_timestamp TIMESTAMP,
  last_event_timestamp TIMESTAMP,
  device_category STRING,
  geo_country STRING
);
```

Cada evento server-side que llega, MERGE a esta tabla. Si el mismo `client_id` aparece en diferentes sesiones, puedes hacer resolución de identidad — [First-Party Veri & Medición Arquitectura](https://www.roibase.com.tr/es/firstparty) profundiza en el diseño de esquema necesario para este tipo de stitching cross-session.

### User-Agent Client Hints e IP Enrichment

El contenedor server-side obtiene user agent e IP de los headers de solicitud del cliente. Pero con Chrome 110+ el string User-Agent está congelado — la información detallada de navegador/SO ahora está en **User-Agent Client Hints** (UA-CH). En el contenedor del servidor necesitas parsear estos hints.

En el contenedor server GTM, define una variable JavaScript personalizada:

```javascript
function() {
  const headers = getAllEventData().headers || {};
  const uach = {
    brand: headers['sec-ch-ua'],
    mobile: headers['sec-ch-ua-mobile'],
    platform: headers['sec-ch-ua-platform']
  };
  return uach;
}
```

Envía estos datos al field `user_data.client_user_agent` de Meta Conversion API. Para IP enrichment usa la base de datos MaxMind GeoIP2 (móntala en la instancia de Cloud Run). Alternativa: API de geolocalización IP integrada de Google Cloud (de pago).

## Checklist de Producción: Rate Limit, Monitoring, Fallback

Antes de llevar el contenedor server-side a producción, estos controles son obligatorios:

**1. Rate limiting:** Las APIs de plataforma establecen límites máximos de solicitudes por segundo (Meta Conversion API 200 req/s, GA4 Measurement Protocol 1000 req/s). En la configuración del **Client** del contenedor GTM, establece el valor throttle. Limita el número máximo de instancias de Cloud Run (`--max-instances 5`).

**2. Error handling y retry:** Si un tag server-side recibe HTTP 500, implementa lógica de reintentos. GTM no tiene retry integrado — necesitas escribir una plantilla de tag personalizada. Cuando Meta API devuelve 429 (Too Many Requests), aplica backoff exponencial.

**3. Monitoring:** Los logs de Cloud Run van a Stackdriver. Con `gcloud logging read` busca patrones de error. Métricas críticas: latencia de solicitud (p95 < 500ms), tasa de error (< 1%), uso de memoria del contenedor (512MB por defecto, 1GB ideal).

**4. Mecanismo de fallback:** Si el contenedor del servidor cae, el contenedor web sigue enviando píxeles. Pero los eventos solo servidor (conversiones backend) se pierden. Para fallback, escribe eventos a Pub/Sub, reproduce desde la dead-letter queue.

**5. Integración Consent Mode v2:** El contenedor server GTM no puede leer las señales de CMP (corre client-side). En el contenedor web, escribe el estado de consentimiento a DataLayer (`ad_storage: 'denied'`), el contenedor del servidor lo lee y ejecuta tags de plataforma de forma condicional.

Métricas de la primera semana en producción:

| Métrica | Objetivo | Monitoreo |
|---------|----------|-----------|
| Event delivery rate | > 98% | Logs de Cloud Run |
| Deduplication accuracy | < 2% duplicate | Dashboards de plataforma |
| Latency p95 | < 500ms | Cloud Monitoring |
| Cost per 1M events | < $5 | GCP Billing |

## Qué Hacer Ahora

La infraestructura de server-side GTM se configura una vez, se optimiza continuamente. El primer paso es auditar tu contenedor web actual — qué tags deben permanecer client-side (herramientas A/B test), cuáles pueden migrarse al servidor (analytics, conversion tracking). El siguiente paso es validar deduplicación en ambiente de prueba — en producción no se acepta tasa de duplicados > 2%. El deployment en Cloud Run es suficiente al inicio pero si el volumen de eventos supera 50 millones mensuales, un cluster GKE es más eficiente en costos. Server-side measurement ya no es opcional — es infraestructura obligatoria para atribución confiable.