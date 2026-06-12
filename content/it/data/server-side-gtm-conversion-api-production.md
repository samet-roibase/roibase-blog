---
title: "Server-Side GTM e Conversion API: Da Zero a Production"
description: "Deploy su Cloud Run/Workers, container template, strategie di deduplicazione. Guida tecnica per portare il server-side measurement in produzione."
publishedAt: 2026-06-12
modifiedAt: 2026-06-12
category: data
i18nKey: data-001-2026-06
tags: [server-side-gtm, conversion-api, cloud-run, event-deduplication, privacy-measurement]
readingTime: 9
author: Roibase
---

L'eliminazione dei cookie, l'irrigidimento dell'ITP, il Consent Mode obbligatorio — la misurazione basata sul browser dal 2024 in poi subisce una perdita di segnali del 30-40%. I tag lato client non offrono più "visibilità completa". Il server-side measurement è l'unico approccio ingegneristico per recuperare questi segnali persi. Google Tag Manager Server Container (sGTM) e Meta Conversion API sono i due componenti fondamentali di questa architettura. Ma non è semplice come "deployare e sperare": hosting del container, deduplicazione degli eventi, gestione dei timeout, arricchimento parametrico dei dati — ogni fase richiede decisioni tecniche precise. Questo articolo affronta il trasferimento di sGTM su Cloud Run o Cloudflare Workers, l'integrazione con CAPI, la logica di deduplicazione e la checklist di produzione.

## Host del Container Server-Side GTM: Cloud Run vs Workers vs App Engine

Il container di sGTM può girare su Google Cloud, ma il **deploy manuale è obbligatorio**. Se usi App Engine Automatic Scaling, i cold start durano 2-3 secondi; in caso di picchi di traffico c'è un rischio di drop di evento del 15-20%. Cloud Run è preferibile: minimo 1 istanza "sempre attiva", concorrenza 80-100, timeout della richiesta 10 secondi. Google mette a disposizione il template di Dockerfile in un repo pubblico — `gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable`. Quando fai il deploy di questa immagine al tuo progetto, sono obbligatorie 3 variabili d'ambiente:

```bash
CONTAINER_CONFIG=<GTM server container ID>
PREVIEW_SERVER_URL=https://<preview-domain>
RUN_AS_HTTPS_SERVER=true
```

Esempio di comando per Cloud Run:

```bash
gcloud run deploy sgtm-prod \
  --image=gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable \
  --platform=managed \
  --region=europe-west1 \
  --set-env-vars=CONTAINER_CONFIG=GTM-XXXXXX,RUN_AS_HTTPS_SERVER=true \
  --min-instances=1 \
  --max-instances=10 \
  --concurrency=80 \
  --timeout=10s \
  --memory=512Mi
```

**Alternativa Cloudflare Workers:** Se la latenza edge globale è una priorità, puoi usare Workers. Portare la logica del container di GTM al runtime di Workers è necessario (non è nativo). Il vantaggio: response time sotto i 50ms; lo svantaggio: l'ecosistema dei template di tag è limitato — dovrai scrivere JavaScript personalizzato.

**Costo di hosting:** Su Cloud Run, circa 1M di richieste al mese costa $40-60 (1 istanza sempre accesa + autoscale incluso). App Engine Flex costa $150-200. Workers costano $5 base + $0,50/milione di richieste — molto più economico, ma senza supporto nativo di sGTM, richiede tempo di sviluppo extra.

### Dominio personalizzato e certificato SSL

Il dominio di default di sGTM `*.run.app` **è considerato di terze parti** — Safari ITP elimina i cookie da questo dominio in 7 giorni. Per questo motivo, un **subdomain first-party** come `analytics.tuosito.com` è obbligatorio. Setup di Cloud Load Balancer + certificato SSL gestito:

1. Aggiungi un **NEG (Network Endpoint Group)** al servizio Cloud Run
2. Crea un HTTPS Load Balancer, collega il NEG al backend
3. Ottieni un certificato SSL gestito da Google per `analytics.tuosito.com` (può richiedere 48 ore)
4. Nel DNS, punta il record A al IP del Load Balancer

Questa configurazione è obbligatoria a livello di produzione. In ambiente di test puoi usare il dominio `run.app`, ma non vedrai gli scenari legati all'ITP.

## Integrazione Meta Conversion API: Strategia di Deduplicazione degli Eventi

Meta CAPI consente l'invio dell'evento pixel lato server tramite sGTM. Però il **Meta Pixel lato client** sta già inviando lo stesso evento — se viene contato due volte, l'attribution si rompe. Il metodo ufficiale di deduplicazione di Meta: aggiungi il parametro **`event_id`** a ogni evento, invia lo stesso ID sia da client che da server. Meta unisce i duplicati entro 48 ore.

Quando configuri il tag CAPI in sGTM:

- **Event Name:** `PageView`, `Purchase`, `AddToCart` (eventi standard di Meta)
- **Event ID:** Usa l'hash di `fbp` cookie da client-side + timestamp
- **User Data:** `em` (email con hash), `ph` (phone con hash), `client_ip_address`, `client_user_agent` — sGTM può estrarre questi parametri automaticamente dall'HTTP header

Esempio di generazione di Event ID (lato client):

```javascript
const eventId = CryptoJS.SHA256(
  fbp + '_' + eventName + '_' + Date.now()
).toString();

fbq('track', 'Purchase', {
  value: 99.00,
  currency: 'USD'
}, {
  eventID: eventId
});
```

Dal lato di sGTM, passa lo stesso `eventId` al tag CAPI. Meta deduplica gli eventi con lo stesso ID entro **48 ore**. Gli eventi tardivi ricevuti dopo questo periodo possono essere contati come duplicati.

**Protocollo di test:** In Meta Events Manager, vai alla scheda **Test Events**. Quando invii sia l'evento client che server, dovresti vedere il messaggio "Deduplication Active", e una sola conversione sotto lo stesso event_id.

### Arricchimento dei dati utente: IP e User-Agent

La potenza di Meta CAPI dipende dalla **ricchezza dei parametri di user data**. Il Pixel lato client raccoglie questi parametri automaticamente dal browser; lato server devi inviarli manualmente. Usa la variabile **HTTP Request Headers** di sGTM:

- `client_ip_address` → `{{Client IP Address}}` (variabile built-in di sGTM)
- `client_user_agent` → `{{User Agent}}` (variabile built-in)

Senza questi parametri, l'evento CAPI fornisce un match rate del 40-60% più basso (secondo i dati interni di Meta). Se aggiungi email con hash (`em`) e phone con hash (`ph`), il match rate sale all'80%. L'hash va fatto con SHA-256, con minuscole + trim:

```python
import hashlib

email_hash = hashlib.sha256('user@example.com'.strip().lower().encode()).hexdigest()
```

## Google Ads Enhanced Conversions: Hash SHA-256 e Matching di gclid

Google Ads Enhanced Conversions richiede l'invio di **user data con hash** tramite sGTM. La logica è simile a Meta CAPI: hash SHA-256 di PII come email, phone, indirizzo, poi aggiungili al tag di conversion. Google abbina questo dato al `gclid` e collega la conversione offline.

Nel tag **Google Ads Conversion Tracking** in sGTM:

- Attiva l'opzione **Enhanced Conversions**
- Nella sezione **User Data**, aggiungi le variabili `{{Email Hash}}`, `{{Phone Hash}}`
- Passa il parametro **gclid** da client-side (dalla query string dell'URL o da un cookie)

La funzione di hash in JavaScript:

```javascript
async function hashSHA256(value) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

Lato client, passa questo hash via `dataLayer.push()`, sGTM lo cattura come variabile e lo invia al tag di Google Ads. **Critico:** L'hash va fatto lato client (privacy — il testo in chiaro non deve andare al server) OPPURE se lo fai in sGTM, disabilita la registrazione.

**Connessione con Consent Mode v2:** Se `ad_user_data` e `ad_personalization` non sono stati consentiti, anche Enhanced Conversions non funzionerà. Devi inviare i segnali di consenso a sGTM tramite l'evento `consent` nel dataLayer.

## Deduplicazione degli eventi: Invio parallelo lato client + server

In alcuni scenari, sia il tag lato client che quello lato server vengono attivati — per esempio, su Safari il tag lato client funziona, MA l'ITP elimina il cookie in 7 giorni, e nel frattempo il lato server continua a funzionare. C'è un rischio di evento duplicato. Soluzione: usare un **unique event_id** (Meta) o **transaction_id** (Google Analytics 4).

Deduplicazione in GA4:

```javascript
gtag('event', 'purchase', {
  transaction_id: 'ORDER_12345', // univoco per ordine
  value: 99.00,
  currency: 'USD'
});
```

Se invii lo stesso `transaction_id` sia dal gtag.js lato client che da sGTM, il backend di GA4 pulisce il duplicato (finestra di 48 ore).

**Gestione dei timeout:** I tag di sGTM hanno un'impostazione **timeout** (predefinita 2000ms). Se la risposta di CAPI impiega 3-4 secondi, il tag va in timeout e l'evento non viene inviato. In produzione, alza il timeout a 5000ms e monitora. Il timeout della richiesta di Cloud Run (10s) deve essere coerente con il timeout del tag di sGTM.

## Checklist di produzione: Monitoring, logging, debug

Prima di portare sGTM in produzione:

1. **Preview Mode:** Apri Preview nel GTM web, collegati all'URL del container di sGTM, debug gli eventi client nella console
2. **Test tag firing:** Per ogni tag (CAPI, Google Ads, GA4), valida con **Tag Assistant**
3. **Segnali di consenso:** Testa i segnali di Consent Mode v2 — verifica quali tag non si attivano quando `ad_storage=denied`
4. **Log export:** Flussi Cloud Run log a **Cloud Logging**, filtro: `resource.type="cloud_run_revision"`, visualizza i payload degli eventi
5. **Alerting errori:** In Cloud Monitoring, crea un alert: `http_response_code >= 500`, soglia 10/min

**Strumenti di debug:**

- **sGTM Debug Mode:** Apri l'URL di preview del container nel browser, aggiungi `gtm_debug=x` nella query string
- **Network Tab:** Nel DevTools del browser, ispeziona le richieste `/gtm.js` e `/r/collect`
- **Meta Event Test:** Events Manager → Test Events, visualizza gli eventi dell'ultima ora

**Problema comune:** L'indirizzo IP del client non arriva a sGTM — controlla che Cloud Load Balancer stia passando l'header `X-Forwarded-For`, attiva l'opzione **Preserve Client IP**.

## Architettura dei dati: Connessione sGTM + BigQuery + dbt

Puoi streamare gli eventi di sGTM direttamente a BigQuery — tramite **Firestore** o **Pub/Sub**. L'export di GA4 a BigQuery è un batch giornaliero; con sGTM è possibile uno stream real-time. Questa strategia è importante nel contesto dell'[architettura first-party di misurazione](https://www.roibase.com.tr/it/firstparty): dati di evento grezzo → modelli dbt → semantic layer → dashboard.

Flusso di esempio:

1. Tag di sGTM → invia l'evento JSON al topic di Pub/Sub
2. Job di Dataflow (o Cloud Function) → legge da Pub/Sub e scrive a BigQuery
3. Modello dbt → unisce gli eventi per `user_id`, applica la logica di sessione
4. Looker/Metabase → dashboard basate sulle view di dbt

Questa architettura è critica anche per la **identity resolution**: puoi unire gli identifier da sGTM come `client_id`, `fbp`, `gclid` in BigQuery e creare un singolo `user_id`. Esempio di modello dbt incrementale:

```sql
{{ config(materialized='incremental', unique_key='event_id') }}

SELECT
  event_id,
  user_id,
  client_id,
  event_timestamp,
  event_name,
  event_params
FROM {{ source('sgtm_events', 'raw_events') }}
{% if is_incremental() %}
WHERE event_timestamp > (SELECT MAX(event_timestamp) FROM {{ this }})
{% endif %}
```

Questa configurazione supporta anche il **modello di attribution**: puoi JOIN gli eventi di sGTM a BigQuery tramite `gclid` e `fbclid` e calcolare l'attribution multi-touch.

---

La misurazione lato server non è più un'ottimizzazione opzionale, è un'infrastruttura obbligatoria in un mondo privacy-first. Deploy su Cloud Run, deduplicazione di CAPI, hash Enhanced Conversions, stream a BigQuery — ogni passaggio richiede una decisione tecnica. Inizia in ambiente di test con il dominio `run.app`, prima di andare in produzione configura un dominio personalizzato + SSL, valida i segnali di consenso, attiva il monitoring. sGTM da solo non è la soluzione — deve lavorare in parallelo con i tag lato client, la logica di deduplicazione deve essere solida. Se vuoi salvare l'attribution, la migrazione al server-side measurement è inevitabile, ma il percorso da zero a produzione richiede 4-6 settimane di lavoro di ingegneria.