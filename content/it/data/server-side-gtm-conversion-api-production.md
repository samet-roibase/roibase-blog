---
title: "Server-Side GTM e Conversion API: Da Zero a Production"
description: "Guida all'implementazione di infrastruttura server-side measurement su Cloud Run o Workers. Template container, logica di deduplicazione e checklist production."
publishedAt: 2026-06-28
modifiedAt: 2026-06-28
category: data
i18nKey: data-001-2026-06
tags: [server-side-gtm, conversion-api, cloud-run, container-deduplication, first-party-data]
readingTime: 9
author: Roibase
---

Con la fine dell'era dei cookie, se la vostra infrastruttura di misurazione ancora gira in un web container, avete implicitamente accettato la perdita di attribuzione. I cali di ROAS su Facebook del 30-40% dopo iOS 14.5 non sono casuali — sono la prova che il client-side tagging non rispecchia più la realtà. Server-side tagging e Conversion API sono il nuovo standard per trasportare questi segnali sulla piattaforma indipendentemente dalle limitazioni del browser. In questo articolo costruiamo un'infrastruttura server-side GTM pronta per production su Google Cloud Run o Cloudflare Workers, partendo da zero.

## Dove Finisce il Client-Side Tagging, Dove Inizia il Server-Side

Google Tag Manager eseguito su un web container risiede nel browser del visitatore. In questo scenario, ogni pixel, ogni platform SDK invia le richieste dall'IP del client. Con Safari ITP 2.0, la durata dei first-party cookie è scesa a 7 giorni; con Consent Mode v2, i tassi di rifiuto hanno raggiunto il 60%. Quando il browser cancella questi cookie, l'API della piattaforma perde l'identità — il segnale di conversione rimane orfano, l'attribuzione si rompe.

Il server-side GTM inverte questa logica. Il web container raccoglie dati minimi dal visitatore (nome evento, user agent, IP) e li invia con POST al vostro server. Il container GTM che gira su questo server (immagine Docker) riceve l'evento, lo arricchisce e lo invia via server-to-server all'API della piattaforma. In questo flusso il cookie non risiede nel browser ma sul vostro server — la sua durata la decidete voi, gli ad blocker sono bypassati. La Meta Conversion API o il Measurement Protocol di Google Analytics 4 si alimentano direttamente dal vostro server — la perdita di dati scende dal 60% al 10-15%.

Questa differenza richiede profondità tecnica. La scelta del cloud provider, la versione del container, la strategia di deduplicazione, lo schema di mappatura degli eventi — tutto è critico. Costruiamoli insieme.

## Configurare un Server-Side Container su Google Cloud Run

Google Cloud Run è un runtime serverless per container. Crea un'immagine da un Dockerfile, fa scaling su richiesta, scende a zero quando inattivo. Anche se il metodo ufficiale di deployment per server-side GTM non è Cloud Run (preferisce App Engine o GCE manuale), Cloud Run offre vantaggi di costo — per 5-10 milioni di eventi al mese, potete passare da ~$30-50 a ~$10-20 mensili.

Il primo step è creare un nuovo progetto in Google Cloud Console. Se avete `gcloud` CLI installato, il terminale è più rapido:

```bash
gcloud projects create roibase-sgtm-prod --name="Roibase sGTM Production"
gcloud config set project roibase-sgtm-prod
gcloud services enable run.googleapis.com containerregistry.googleapis.com
```

In Google Tag Manager, create un container di tipo **Server**. Andate a Impostazioni > Configurazione Container e annotate l'**URL del server di tagging** (ad es. `https://sgtm.roibase.io`). Questo dominio personalizzato punterà al servizio Cloud Run.

L'immagine ufficiale di Google `gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable` è sicura per production ma senza version lock. Il nostro approccio è scrivere un Dockerfile personalizzato e fissare la versione dell'immagine base:

```dockerfile
FROM gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable

ENV CONTAINER_CONFIG="<GTM container ID>"
ENV PREVIEW_SERVER_URL="https://sgtm-preview.roibase.io"

EXPOSE 8080

CMD ["/bin/sh", "-c", "/app/start_server"]
```

Deployate questa immagine su Cloud Run:

```bash
gcloud builds submit --tag gcr.io/roibase-sgtm-prod/sgtm-container
gcloud run deploy sgtm-service \
  --image gcr.io/roibase-sgtm-prod/sgtm-container \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars CONTAINER_CONFIG=GTM-XXXXXX
```

Per aggiungere un dominio personalizzato al servizio Cloud Run, andate a Cloud Run > Domain Mappings > Add Mapping. Nel provider DNS, aggiungete un record CNAME (`sgtm.roibase.io` → URL di Cloud Run). Il certificato SSL viene fornito automaticamente (Let's Encrypt).

### Alternativa: Cloudflare Workers

Se volete stare fuori dall'ecosistema Google, Cloudflare Workers è più flessibile. L'immagine Docker del container GTM Server non funziona su Workers, ma potete scrivere un proxy di tagging personalizzato su Workers. Lo script seguente fa proxy di tutti gli eventi GTM e li inoltra al Measurement Protocol di GA4:

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

Il runtime di Workers inizia sotto i 50ms, il cold start di Cloud Run è 2-3 secondi. Tuttavia, su Workers non avete il Visual Tag Builder di GTM — dovete scrivere ogni platform tag come codice. Per ora Cloud Run è la scelta più pratica.

## Deduplicazione degli Eventi: Non Contare Due Volte la Stessa Conversione

Quando passate al server-side tagging, il web e il server container girano in parallelo. Un visitatore effettua un acquisto → il Facebook Pixel client-side si attiva → il server container riceve lo stesso evento di purchase → l'API di Facebook vede due volte la stessa conversione. L'ROAS si gonfia al 200%, l'ottimizzatore del budget riceve segnali errati.

La soluzione è la deduplicazione degli eventi. Assegnate a ogni conversione un `event_id` univoco; il lato client e il lato server devono inviare lo stesso ID. Se Facebook/Meta riceve un secondo evento con lo stesso `event_id`, lo ignora. La finestra di deduplicazione è 48 ore (impostazione predefinita).

Nel web container di GTM, aggiungete il parametro `event_id` alla configurazione del tag Facebook:

```javascript
fbq('track', 'Purchase', {
  value: 99.99,
  currency: 'TRY'
}, {
  eventID: '{{Transaction ID}}_{{Random Number}}'
});
```

Nel container server-side, nel tag Meta Conversion API, mappate lo stesso `event_id` come variabile definita dall'utente. GTM non ha una variabile built-in `Event ID`, dovete crearla manualmente. Scegliete il tipo di variabile Data Layer, assegnate il nome `event_id`, impostate il valore predefinito `{{Page Path}}_{{Random Number}}`.

Per Google Analytics 4 la situazione è diversa. GA4 già fonde gli eventi client-side e Measurement Protocol (se hanno lo stesso `client_id` e `session_id`). Non è necessaria deduplicazione aggiuntiva, ma la coerenza del `client_id` è obbligatoria. Nel web container, nella configurazione del tag GA4, selezionate **Send user-provided data**, e nel campo `client_id` assegnate la variabile GTM `{{GA Client ID}}`. Nel server container, usate lo stesso valore.

Prima di portare questa logica a production, testate in Preview mode. Nel container server-side di GTM, create un URL Preview, fate sì che il web container lo targetizzi. In Chrome DevTools > Network, ispezionate le richieste POST all'endpoint `/gtm` — i field `event_id` e `client_id` devono essere presenti sia nel payload client che nel server.

## First-Party Cookie e Session Stitching

La forza della misurazione server-side risiede nel fissare l'identità dell'utente tramite first-party cookie. Il web container mantiene il cookie `_ga` per 2 anni, ma Safari lo riduce a 7 giorni. Il server container può impostare il proprio cookie (`_sgtm` ad esempio) tramite l'header `Set-Cookie` — poiché corrisponde al sottodominio, aggira ITP.

Nel container server-side GTM, selezionate **Client** e scegliete il tipo di client **Google Analytics: GA4**. Questo client estrae il `client_id` dalla richiesta HTTP in ingresso e lo scrive nel cookie `_ga`. Tuttavia, questo cookie viene aggiunto all'header della risposta, non nel browser — per farlo visualizzare al browser, dovreste passare da POST a GET redirect dal web container al server (complicato).

Un approccio più semplice: nel web container, aggiungete il `client_id` al DataLayer; il server container lo riceve e lo salva nel vostro database. Per esempio, una tabella BigQuery `user_sessions`:

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

Ad ogni evento server-side in arrivo, fate MERGE in questa tabella. Se lo stesso `client_id` appare in session diverse, potete effettuare una risoluzione di identità — [Server-Side GTM e Conversion API](https://www.roibase.com.tr/it/dijitalpazarlama) approfondisce l'architettura dello schema necessario per questo tipo di session stitching cross-session.

### User-Agent Client Hints e IP Enrichment

Il server container estrae user agent e IP dalle intestazioni della richiesta client. Tuttavia, a partire da Chrome 110, la stringa User-Agent è congelata — i dati dettagliati di browser/OS si trovano ora negli **User-Agent Client Hints** (UA-CH). Nel server container, dovete parsare questi hint.

Nel container server-side di GTM, definite una variabile JavaScript personalizzata:

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

Assegnate questi dati al field `user_data.client_user_agent` della Meta Conversion API. Per l'IP enrichment, usate il database MaxMind GeoIP2 (montate sull'istanza Cloud Run). Alternativa: l'API di geolocalizzazione IP integrata di Google Cloud (a pagamento).

## Production Checklist: Rate Limit, Monitoring, Fallback

Prima di portare il server container a production, questi controlli sono obbligatori:

**1. Rate limiting:** Le API delle piattaforme impongono limiti di richieste al secondo (Meta Conversion API 200 req/s, GA4 Measurement Protocol 1000 req/s). Nelle impostazioni **Client** del GTM container, impostate il valore di throttle. Limitate il numero massimo di istanze Cloud Run (`--max-instances 5`).

**2. Gestione degli errori e retry:** Se un tag server-side riceve HTTP 500, implementate una logica di retry. GTM non ha retry built-in — dovete scrivere un template di tag personalizzato. Quando la Meta API restituisce 429 (Too Many Requests), applicate exponential backoff.

**3. Monitoring:** I log di Cloud Run vanno a Stackdriver. Con `gcloud logging read` cercate pattern di errore. Metriche critiche: latenza delle richieste (p95 < 500ms), error rate (< 1%), utilizzo della memoria del container (512MB default, 1GB ideale).

**4. Meccanismo di fallback:** Se il server container va down, il web container continua a inviare pixel. Tuttavia, gli eventi solo-server (conversioni backend) vanno persi. Per il fallback, scrivete gli eventi su Pub/Sub, replicate dalla dead-letter queue.

**5. Integrazione di Consent Mode v2:** Il container server-side GTM non può leggere i segnali di CMP (funzionano client-side). Nel web container, scrivete lo stato del consenso nel DataLayer (`ad_storage: 'denied'`), il container server-side lo legge e esegue i tag della piattaforma in modo condizionale.

Metriche della prima settimana in production:

| Metrica | Target | Monitoraggio |
|---------|--------|--------------|
| Event delivery rate | > 98% | Cloud Run logs |
| Deduplication accuracy | < 2% duplicati | Platform dashboards |
| Latency p95 | < 500ms | Cloud Monitoring |
| Costo per 1M eventi | < $5 | GCP Billing |

## Cosa Fare Adesso

L'infrastruttura server-side GTM si implementa una volta, si ottimizza continuamente. Il primo step è fare un audit del vostro web container — quali tag devono restare client-side (strumenti di A/B testing), quali possono migrare al server (analytics, conversion tracking). Lo step successivo è validare la deduplicazione in un ambiente di test — in production un duplicate rate superiore al 2% non è accettabile. Cloud Run è sufficiente all'inizio, ma quando il volume di eventi supera i 50 milioni al mese, un cluster GKE diventa più conveniente. Server-side measurement non è più opzionale — è infrastruttura obbligatoria per l'accuratezza dell'attribuzione.