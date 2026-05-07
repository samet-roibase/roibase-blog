---
title: "Server-Side GTM e Conversion API: Da Zero a Produzione"
description: "Setup di tagging lato server su Cloud Run e Workers, template container, event deduplication e strategie di monitoring in produzione."
publishedAt: 2026-05-07
modifiedAt: 2026-05-07
category: data
i18nKey: data-001-2026-05
tags: [server-side-gtm, conversion-api, cloud-run, event-deduplication, privacy-sandbox]
readingTime: 9
author: Roibase
---

La misurazione basata su browser è morta. I cookie di terze parti sono spariti, ITP è sceso a 12 ore, Consent Mode v2 è diventato obbligatorio. I brand che non inviano eventi server-side direttamente agli endpoint API di Meta e Google rimangono nel buio dell'attribuzione. Server-side Google Tag Manager (sGTM) e Conversion API non sono più opzionali nel 2026 — sono un requirement di produzione. In questo articolo mostriamo come deployare da zero un container sGTM production-ready su Cloud Run, come configurare la deduplication degli eventi e quali metriche monitorare.

## Perché il Server-Side Tagging Richiede un Container

La classica GTM JavaScript lato browser carica librerie e raccoglie dati dallo user agent. Server-side GTM funziona al contrario: un container Node.js in esecuzione su un server riceve POST HTTP dal client, arricchisce gli eventi (parsing di IP e user-agent, ID first-party dai cookie) e li trasmette agli endpoint API di destinazione (Meta CAPI, Google Ads Conversion, GA4 Measurement Protocol). Questa architettura offre 3 vantaggi fondamentali: (1) bypassi i vincoli del browser — niente ITP, adblocker, CORS; (2) puoi hashare il PII in modo controllato — email, telefono vengono SHA-256 sul server, mai tornano al browser; (3) da un singolo evento client puoi eseguire fan-out parallelo verso 4 piattaforme diverse — un POST dal client diventa 4 richieste verso endpoint distinti.

Il metodo di deployment ufficiale di Google è App Engine o Cloud Run. App Engine offre costo fisso e auto-scaling ma non è customizzabile. Cloud Run è preferito perché con `min_instances=1` garantisci latenza stabile h24 e puoi personalizzare l'immagine container con un Dockerfile custom (ad esempio, estrapolare i secret da variabili d'ambiente, injection di script di startup). Un'alternativa è il deployment su Cloudflare Workers — latenza più bassa dal cold-start (~5ms vs 200ms) ma con limitazioni sandbox di Node.js che impediscono l'esecuzione di alcuni tag GTM (soprattutto nei template custom che richiedono `require` di moduli nativi).

Il processo di deployment consiste di: (1) creare un nuovo progetto in Google Cloud Console, (2) con `gcloud` CLI fare il pull dell'immagine container sGTM, (3) creare il Cloud Run service e settare le variabili d'ambiente (`CONTAINER_CONFIG`, `PREVIEW_SERVER_URL`), (4) collegare un dominio personalizzato (es. `gtm.roibase.com.tr`) — fondamentale per il contesto first-party, (5) aggiungere l'URL del server di tagging al GTM web (`serverContainerUrl` parameter). Il primo deploy richiede 15 minuti, successivamente con CI/CD scendiamo a 2 minuti.

## Event Deduplication: Legare il Segnale Client + Server a un Unico ID

Il problema critico del server-side GTM è la deduplication. Se la stessa conversione arriva sia dal browser (GA4 client-side tag) sia dal server (GA4 server-side client), la piattaforma la conta come 2 conversioni. Per Meta CAPI e Google Ads Conversion è obbligatorio un sistema di event deduplication ID. Come funziona: assegni a ogni evento un `event_id` univoco (o in terminologia Meta `event_name + event_id`), sia client che server inviano lo stesso ID, la piattaforma in una finestra di 24 ore elimina i duplicati in base alle collision di ID.

Strategie di deduplication ID:

| Metodo | Vantaggio | Rischio |
|--------|-----------|---------|
| UUID v4 (random) | Nessun rischio di collision | Richiede sincronizzazione client-server (localStorage/cookie) |
| Transaction ID (e-commerce) | Univoco naturale | Mancante per eventi non-transazionali (lead, signup) |
| Session ID + timestamp | Facile da generare | Possibile overlap in sessioni |
| `_ga` client ID + event timestamp | Basato su first-party ID | Rischio di clock skew (differenza oraria client/server) |

Setup di produzione Roibase: `SHA-256(_ga + event_name + unix_ms)` — quando il browser fa push nel DataLayer, popola il field `event_id` con questo hash, il tag GA4 lato server legge lo stesso field e lo invia al Measurement Protocol. Per Meta CAPI, iniettiamo parametri aggiuntivi `event_source_url` e `action_source=website` lato server perché il Facebook Pixel client-side non invia questi field ma server-side validation li richiede.

```javascript
// Esempio di push nel DataLayer (client-side)
window.dataLayer.push({
  event: 'purchase',
  event_id: sha256(_ga + 'purchase' + Date.now()),
  transaction_id: 'ORD-12345',
  value: 299.00,
  currency: 'TRY'
});
```

Nel container server-side creiamo una variabile personalizzata che mappa `{{Event ID}}` sia al tag GA4 che al tag CAPI. GA4 Measurement Protocol supporta il parametro `&ep.event_id=`, Meta CAPI ha un field root-level `event_id`. Per Google Ads Conversion la deduplication funziona con la combinazione `gclid + conversion_action_id` — il `gclid` viene letto dal cookie e inviato al server, il tag Ads combina `gclid + conversion_value` e lo invia all'API di Conversion Tracking.

## Container Template e Setup Custom Client

Il container sGTM si compone di 3 elementi fondamentali: **Client** (parsa la richiesta HTTP in ingresso, la trasforma in event object), **Tag** (invia l'evento all'API esterna), **Variable** (condivisione dati tra i tag). Il client "GA4" di default di Google non basta perché ascolta solo l'endpoint `/g/collect`. Scriviamo un client personalizzato per gestire sia GA4 che endpoint custom (`/event`, `/purchase`) nello stesso container.

Esempio di template custom client:

```javascript
const claimRequest = require('claimRequest');
const getRequestBody = require('getRequestBody');
const JSON = require('JSON');
const logToConsole = require('logToConsole');

claimRequest();

const body = getRequestBody();
const eventData = JSON.parse(body);

// Normalizza l'event object
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

Questo client intercetta i POST verso il path `/event`, parsa il body JSON e lo trasforma nel modello di event di sGTM. La chiamata `runContainer()` attiva i tag — quando il tag GA4 vede `event_name=purchase`, invia al Measurement Protocol, il tag Meta CAPI vede `user_data.email`, lo hashizza con SHA-256 e lo invia all'endpoint `/events`.

In produzione girano 4 client: (1) GA4 default client (`/g/collect`), (2) custom JSON client (`/event`), (3) Meta Pixel client (`/tr/` endpoint — compatibilità con SDK Facebook), (4) health check client (`/health`) — Cloud Run usa questo endpoint per il liveness probe e monitorare la salute del container. Ogni client ha un numero di priorità — se due client rivendicano lo stesso path, vince quello con priorità più alta.

È critico tenere i template custom sotto version control. Le modifiche nella UI di Google Tag Manager non compaiono nella git history. Workflow: tieni i template come file `.tpl` nel repo, usa `gtm-template-push` CLI tool nella pipeline CI per deployare nel workspace sGTM, testa nel container di staging, poi promovi in produzione. Così un rollback è un singolo `git revert`.

## Production Monitoring: Quali Metriche Sono Critiche

Una volta deployato server-side GTM, per non finire al buio serve monitoraggio su 4 livelli: (1) container health (uptime, latency, error rate), (2) event throughput (event/sec, tag success rate), (3) accuratezza deduplication (delta tra event contati client vs server), (4) validazione piattaforma downstream (Meta Event Quality Score, Google Ads conversion tracking status).

Metriche native di Cloud Run:

- **Request count** — numero di POST verso `/event`, breakdown al minuto
- **Request latency (p50, p95, p99)** — se median > 120ms c'è un problema (normale 40-80ms)
- **Container instance count** — se `min_instances=1`, deve sempre essere 1, auto-scale in caso di spike
- **Error rate (5xx)** — se > 0.1% continuamente, c'è un problema nei tag downstream

Nel Console di sGTM, tab "Logs" ha debug log a livello di evento, ma in produzione `console.log` su ogni evento genera I/O pesante. Setup: debug logging attivo solo con query param `?gtm_debug=1`, disattivato su traffico production. Error critici (tag HTTP 4xx/5xx) finiscono in Google Cloud Logging come structured JSON log, e scattano policy di alert in Cloud Monitoring — se Meta CAPI ritorna 10+ "Invalid access token" in 3 minuti, ping su Slack.

Per monitorare l'event throughput creiamo una metrica custom: nei tag sGTM facciamo `sendHttpGet('https://metrics.roibase.com.tr/increment?metric=capi_event')`, il metric service tiene counter in formato Prometheus. Dashboard Grafana mostra real-time event flow — se client-side GA4 invia 1000 event/min ma server-side CAPI ne riceve solo 850/min, significa collision ID deduplication o drop di rete.

La validazione piattaforma downstream è la parte più critica. Meta Events Manager mostra Event Match Quality (EMQ) score — sotto 6.5/10 è "bassa qualità", significa algoritmo hash sbagliato o PII field mancanti. Google Ads Conversion Tracking deve mostrare "Status: Eligible" — se vedi "Rarely used" o "Below threshold" vuol dire volume conversion insufficiente (minimo 15 conversioni/30 giorni). GA4 DebugView: filtra server-side event con `traffic_type=server_side`, compara metric `event_count` con client-side — se la differenza è > 20%, serve investigation.

## Identity Resolution e Segnali di User Matching

La potenza del server-side ölçüm risiede nella capacità di trasmettere PII (Personally Identifiable Information) alle piattaforme in modo controllato. Meta CAPI accetta 7 parametri di user matching: `em` (email hash), `ph` (phone hash), `fn` (first name), `ln` (last name), `ct` (city), `st` (state), `zp` (zip), `country`, `external_id` (CRM ID). Più segnali invii, più sale l'EMQ score — solo `em` dà 4.2/10, `em + ph + fn + ln` dà 7.8/10. Google Enhanced Conversions funziona ugualmente: aggiungendo `sha256_email_address` e `sha256_phone_number` al tag Ads Conversion, la accuracy di attribuzione sale del ~40% (dato beta test Google 2025).

Pipeline di identity resolution di Roibase in produzione: (1) utente inserisce email/telefono in form web, (2) JS client-side hashizza con SHA-256 (plain text mai nel browser), (3) valore hashizzato viene push nel DataLayer, (4) sGTM prende l'hash e lo invia a Meta CAPI come `user_data.em` field, a Google come `user_data.sha256_email_address`. Questo flusso è GDPR/KVKK compliant perché il plain PII non finisce mai nei log server — SHA-256 è one-way hash, non reversibile.

Segnale aggiuntivo: i cookie `fbp` (Facebook Browser ID) e `fbc` (Facebook Click ID) vengono letti lato server e inviati a CAPI. Il cookie `fbp` è set dal Pixel client-side ma ITP lo fa scadere dopo 7 giorni; noi lo leggiamo lato server e lo riscrviamo con TTL 90 giorni (set da first-party domain quindi bypass ITP). Il cookie `fbc` trasporta il `fbclid` da traffico via ads — server-side facciamo parse di questo ID e lo aggiungiamo al field `fbc` della CAPI, così Meta estende l'attribuzione da 24 ore a 28 giorni.

Il meccanismo `gclid` (Google Click ID) di Google funziona in modo simile. Client-side GTM legge il `gclid` dall'URL e lo scrive nel cookie `_gcl_aw` con expiry 90 giorni. Server-side leggiamo questo cookie e lo aggiungiamo al tag Ads Conversion come parametro `gclid`. L'API server-side Conversion Tracking di Google usa `gclid + conversion_action_id` come chiave univoca — se invii 2 conversioni con lo stesso `gclid`, Google fa deduplication. Setup nostro: se manca il cookie `gclid` (traffico diretto), mappiamo il `_ga` client ID nel parametro `gbraid` come fallback — questo collega l'attribuzione GA4 con Ads.

## Compliance e Consent Orchestration

Server-side tagging integrato male con Consent Mode v2 = rischio violazione GDPR. Regola di Google: se lo stato consent `ad_storage=denied`, il tag sGTM Google Ads Conversion non deve scattare o deve inviare solo segnali anonimizzati (IP masking + drop di user ID). Sistema Limited Data Use (LDU) di Meta è simile: per traffico California, aggiungi parametro `data_processing_options=['LDU']` alla richiesta CAPI in modo che Meta non usi i dati per publicità personalizzata.

Stack di consent orchestration nostro: (1) banner OneTrust/Cookiebot raccoglie consent dall'utente, (2) stato consent (`ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization`) finisce nel DataLayer, (3) client-side GTM scrive lo stato in un cookie (`_consent_state`), (4) quando l'utente fa POST `/event`, il cookie viene spedito negli header, (5) sGTM custom variable parsa il cookie, (6) nei tag Meta/Google aggiungiamo conditional trigger: `{{Consent - Ad Storage}} equals "granted"` → tag scatta, `denied` → tag skip.

Per Consent Conversion Modeling (CCM): aggiungiamo `consent_ad_user_data=true` al tag Google Ads in modo che anche in stato denial