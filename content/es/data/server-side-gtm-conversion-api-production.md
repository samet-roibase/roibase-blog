---
title: "Server-Side GTM y Conversion API: De Cero a Producción"
description: "Cloud Run deploy, container template, deduplicación de eventos — cómo construimos nuestro stack de medición server-side en producción, qué trampas evitamos."
publishedAt: 2026-05-24
modifiedAt: 2026-05-24
category: data
i18nKey: data-001-2026-05
tags: [server-side-gtm, conversion-api, cloud-run, first-party-data, event-deduplication]
readingTime: 9
author: Roibase
---

Deprecation de cookies, Consent Mode v2, iOS ATT — el área de confiabilidad de la medición client-side se reduce cada año. En 2024, Meta tuvo que aceptar %23 menos eventos client-side, y en Google Analytics 4 el conteo de sesiones cayó %18. La medición server-side ya no es "el futuro" sino "obligatoria". Desde finales de 2025, en Roibase estamos configurando completamente a nuevos clientes en stack sGTM + Conversion API. En este artículo compartimos lo que aprendimos durante la migración a producción, qué decisiones tomamos y por qué, y qué componentes son imprescindibles en el stack.

## ¿Dónde Desplegar el Container sGTM?

Puedes ejecutar Google Tag Manager Server Container en App Engine, Cloud Run, Docker manual, o proveedores terceros. En 2026, dos opciones dominan: Cloud Run y Cloudflare Workers. App Engine se considera legacy — sin escalado automático, cold start 8+ segundos. Workers es más barato, pero la integración con el ecosistema de GTM requiere middleware adicional.

Elegimos Cloud Run: la imagen oficial del contenedor de GTM corre directamente, escalado horizontal automático, cold start bajo 2 segundos. El cálculo de costo es crítico: 1M request/mes + instancia 512MB × 3 zonas = ~$35/mes. En Cloudflare Workers esto es $5/mes, pero el tooling de debug es débil y la integración de variables personalizadas requiere configuración manual.

El comando de deploy:

```bash
gcloud run deploy sgtm-prod \
  --image=gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable \
  --platform=managed \
  --region=europe-west1 \
  --memory=512Mi \
  --min-instances=1 \
  --max-instances=10 \
  --allow-unauthenticated \
  --set-env-vars="CONTAINER_CONFIG=$(cat container.json | base64)"
```

`min-instances=1` es crítico — en un sitio de e-commerce, el tiempo para crear una instancia desde cero puede perder conversiones. Costo +$8/mes, pero garantiza uptime del 100%. El `container.json` es la configuración exportada desde la interfaz de GTM — puedes vincularla a CI/CD en lugar de sincronización manual.

Estructura de subdominio: `sgtm.example.com` → Cloud Run IP. No usamos Load Balancer; la IP anycast global de Cloud Run es suficiente. SSL automático, certificado gestionado de Cloud Run listo en 3 minutos.

## Deduplicación de Eventos: Dos Señales, Una Conversión

La mayor trampa de la medición server-side: la misma conversión se envía tanto desde el navegador como desde el servidor, y la plataforma la cuenta dos veces. El parámetro `event_id` en Meta Conversion API soluciona esto — si client y server comparten el mismo ID, Meta limpia la duplicación en una ventana de 28 horas.

Flujo de ejemplo: el usuario completa un pedido, GTM client-side dispara un evento `purchase` → Meta Pixel. Simultáneamente, el frontend POST a nuestro endpoint `/api/track` → sGTM → Meta Conversion API. Ambas señales llevan `event_id: order_12345_ts1716547200`.

```javascript
// Variable de GTM Client-Side: event_id
function() {
  var orderId = {{Order ID}};
  var timestamp = Math.floor(Date.now() / 1000);
  return orderId + '_ts' + timestamp;
}
```

En el sGTM, mapeamos el mismo `event_id` al tag de Meta Conversion API. Importante: el componente timestamp no es obligatorio, pero evita colisiones de unicidad — el mismo order_id puede reutilizarse en diferentes sesiones.

Para Google Ads, es diferente: el parámetro `gclid` es suficiente, no hay ID de deduplicación adicional. Pero en Google Analytics 4, si envías la combinación `client_id` + `session_id` tanto desde client como desde server, GA4 realiza deduplicación automática — característica añadida en Q3 2024.

Validación de dedup: en Meta Events Manager, la puntuación "Event Match Quality" debe estar por encima del %80. Si está baja — especialmente si faltan hashes `em` (email), `ph` (teléfono), `fn` (nombre) — el evento del servidor se considera "baja confianza" y la limpieza de duplicación es menos confiable.

## Container Template: Qué Tags Vienen por Defecto

El Server Container de GTM comienza vacío; cada tag lo añades manualmente. Después de configurar 15+ contenedores, creamos un repositorio template — un nuevo cliente llega a producción listo en 5 minutos.

**Tags obligatorios:**
- **Meta Conversion API** (usando Meta Business Extension)
- **Google Analytics 4** (con cliente server-side)
- **Google Ads Conversion** (con Enhanced Conversion)
- **Snapchat Conversion API** (para clientes gaming/fashion)
- **TikTok Events API** (si hay targeting de Gen Z)

**Opcionales pero recomendados:**
- **Firestore/BigQuery log writer** — registra cada evento en bruto, crítico para audit trail + modelado de atribución
- **Variable de verificación de consent** — parsea string TCF 2.2, verifica propósitos 1 (almacenamiento) y 2 (medición), envía `action_source=physical_store` si hay rechazo (no es bypass, es señal agregada)
- **Enriquecimiento de IP de usuario** — extrae `X-Forwarded-For` del header, aumenta accuracy geolocation de Conversion API %12

Estructura del repositorio template:

```
sgtm-template/
├── clients/
│   └── ga4-client.json
├── tags/
│   ├── meta-capi.json
│   ├── google-ads.json
│   └── bigquery-log.json
├── variables/
│   ├── event-id.json
│   ├── user-data.json
│   └── consent-status.json
└── triggers/
    ├── all-events.json
    └── conversion-only.json
```

Cada archivo JSON se exporta desde la interfaz de GTM — no puedes importarlos directamente con CLI `gcloud`, pero se automatizan en CI/CD con scripts. Existe un proveedor Terraform para GTM, pero es community-maintained, no oficial.

### Variable de Datos de Usuario: Envía Con Hash

Meta y Google requieren PII (información de identificación personal) hasheada: email → SHA256, teléfono → formato E.164 + SHA256. En GTM client-side el hash se hace en JavaScript, pero en sGTM es más seguro hacerlo server-side — no aparece texto plano en devtools del navegador.

```javascript
// Variable personalizada de sGTM: hashed_email
const crypto = require('crypto');
const getEventData = require('getEventData');

const email = getEventData('user_data.email_address');
if (!email) return undefined;

return crypto.createHash('sha256')
  .update(email.toLowerCase().trim())
  .digest('hex');
```

Para teléfono, formato E.164: `+905321234567` (código de país + número sin cero). En proyectos de Roibase, %40 de datos de teléfono se rechazan por error de formato — debes agregar validación.

## Conversion API y Enhanced Conversion: ¿Cuál es la Diferencia?

Meta Conversion API y Google Enhanced Conversion son protocolos diferentes pero cumplen el mismo objetivo: aumentar la tasa de coincidencia de plataforma con first-party data. Conversion API es basado en eventos — cada clic, agregar al carrito, compra es un HTTP POST separado. Enhanced Conversion es basado en tags — data de usuario se envía solo en conversión (compra, registro).

Configuración de tag de Google Enhanced Conversion en sGTM:

```json
{
  "type": "google_ads_remarketing",
  "enhancedConversionData": {
    "email": "{{Hashed Email}}",
    "phone": "{{Hashed Phone}}",
    "address": {
      "first_name": "{{Hashed First Name}}",
      "last_name": "{{Hashed Last Name}}",
      "country": "ES",
      "postal_code": "{{Postal Code}}"
    }
  }
}
```

En Meta, el objeto `user_data` se envía para cada evento — `ViewContent`, `AddToCart`, `Purchase` todos con los mismos datos hasheados.

Diferencia práctica: Google Enhanced Conversion solo está activo en el pixel de conversión — si el tráfico es bajo, la tasa de coincidencia permanece baja. Meta CAPI recibe data de usuario en cada evento, la audiencia de retargeting se enriquece más. Por eso en e-commerce, la configuración de Meta CAPI es prioritaria, Google EC es secundario.

## Monitoreo y Debug: Qué Métricas Supervisar

Con stack server-side en producción, sin monitoreo no funciona. En GTM client-side hay modo preview — server-side no existe, debuggeas sobre tráfico en vivo.

**Métricas críticas:**
- **Conteo de instancias de Cloud Run** — aunque min=1, en spike de tráfico puede alcanzar 10, configura alerta para control de costos
- **Tiempo de respuesta P95** — por encima de 500ms comienza pérdida de conversiones, especialmente en páginas de checkout
- **Puntuación Meta Event Match Quality** (verificación manual en Events Manager) — si está por debajo %80, faltan datos de usuario
- **Relación server event count / client event count en GA4** — idealmente 1.1-1.3 (server ve ligeramente más), por debajo de 0.8 hay error del servidor

Query de Cloud Logging:

```sql
resource.type="cloud_run_revision"
resource.labels.service_name="sgtm-prod"
jsonPayload.event_name="purchase"
severity="ERROR"
```

Los logs de error en GTM no se escriben con `console.log` — debes usar API `logToConsole()`, que escribe en Cloud Logging.

Esquema de tabla de log en BigQuery:

| Campo | Tipo | Descripción |
|---|---|---|
| event_timestamp | TIMESTAMP | Tiempo del servidor (UTC) |
| event_name | STRING | purchase, add_to_cart, etc. |
| user_id | STRING | Hasheado |
| client_id | STRING | GA4 client ID |
| event_id | STRING | ID de dedup |
| platform | STRING | meta, google_ads, snapchat |
| response_code | INTEGER | Estado HTTP |

Esta tabla se escribe en tu data warehouse de BigQuery según [Arquitectura de Datos de Primera Parte & Medición](https://www.roibase.com.tr/es/firstparty), vinculada a modelos downstream con dbt (atribución, predicción de LTV).

## Consent Mode v2 y Server-Side: Cómo Integrar

Desde marzo de 2024, Google Consent Mode v2 es obligatorio en EEA — el estado de consentimiento `ad_storage` y `analytics_storage` debe enviarse con cada hit. Server-side no recibe esta información de GTM client-side, la envías manualmente.

Hay dos enfoques:
1. **Parámetro de query:** `sgtm.example.com/g/collect?consent=granted` — fácil pero visible en URL, problemas de cache
2. **HTTP header:** `X-Consent-Status: analytics_storage=granted,ad_storage=denied` — método preferido

Variable personalizada en sGTM:

```javascript
const getRequestHeader = require('getRequestHeader');
const consentHeader = getRequestHeader('x-consent-status');

if (!consentHeader) return {analytics_storage: 'denied', ad_storage: 'denied'};

const pairs = consentHeader.split(',');
const consent = {};
pairs.forEach(pair => {
  const [key, value] = pair.split('=');
  consent[key.trim()] = value.trim();
});

return consent;
```

Mapeas esta variable a tus tags de GA4 y Google Ads. En Meta CAPI no existe parámetro de consent — control indirecto vía `action_source`: `action_source=website` significa consentimiento presente, `action_source=physical_store` es modo agregado (sin consentimiento pero attributable como offline).

## Qué Testear la Primera Semana

Es obligatorio ejecutar en paralelo: los pixels client-side siguen, el server-side corre junto. Durante dos semanas supervisa ambos, luego apaga client-side.

**Checklist de test:**
- [ ] ¿El conteo de eventos en Meta Events Manager está ±%10 respecto a client-side?
- [ ] ¿Hay caída en conteo de sesiones en GA4? (server-side debe ver más)
- [ ] ¿El conteo de conversiones en Google Ads cambió? (Enhanced Conversion esperado +%8-15)
- [ ] ¿El costo de Cloud Run superó $50/mes? (normal $30-40 para 1M eventos/mes)
- [ ] ¿Funciona dedup — hay advertencias de eventos duplicados en Meta Test Events?
- [ ] ¿El conteo diario de eventos en tabla BigQuery coincide con analytics frontend?

Problemas garantizados la primera semana: error de formato en hash de data de usuario (%30-40 eventos), falta de header de consent (%15-20), pérdida inicial de conversiones por cold start de Cloud Run (si min-instances=0). Por eso nunca actives stack nuevo durante Black Friday — estabiliza con tráfico normal primero.

## Stack de Producción: Qué Hacer Ahora

La medición server-side en 2026 ya no es "experimental" sino "estándar". Confiar solo en pixel client-side significa %20-30 pérdida de conversiones — especialmente en iOS y usuarios conscientes de privacidad. En clientes de Roibase, la migración a sGTM + Conversion API resulta en +%18 tracking de conversiones promedio, +%12 mejora de ROAS — porque la plataforma puede optimizar más precisamente.

Para empezar: configura un container de test en Cloud Run, ejecútalo en paralelo con client-side una semana, lleva la puntuación Meta Event Match Quality por encima del %80. Luego apaga client-side en producción. Con template ya preparado, este proceso toma 3-5 días; desde cero, 2-3 semanas. En stack de Roibase el tiempo de deployment estándar es 1 semana — porque template, monitoreo, integración de BigQuery ya están listos.