---
title: "Server-Side GTM e Conversion API: Da Zero a Production"
description: "Deploy su Cloud Run, container template, event deduplication — come abbiamo configurato lo stack di misurazione server-side in production, quali trappole abbiamo incontrato."
publishedAt: 2026-05-24
modifiedAt: 2026-05-24
category: data
i18nKey: data-001-2026-05
tags: [server-side-gtm, conversion-api, cloud-run, first-party-data, event-deduplication]
readingTime: 9
author: Roibase
---

Deprecazione dei cookie, Consent Mode v2, iOS ATT — lo spazio affidabile della misurazione client-side si restringe ogni anno. Nel 2024, Meta ha dovuto registrare il 23% di eventi client-side in meno, e in Google Analytics 4 il numero di sessioni è diminuito del 18%. La misurazione server-side non è più "il futuro", è "obbligatoria". Da fine 2025, presso Roibase stiamo configurando nuovi clienti interamente su uno stack sGTM + Conversion API. In questo articolo condividiamo ciò che abbiamo imparato durante la migrazione in production, le decisioni che abbiamo preso e quali componenti devono far parte dello stack.

## Dove Distribuire il Container sGTM

Il Server Container di Google Tag Manager può essere distribuito su App Engine, Cloud Run, Docker manuale, o soluzioni di hosting di terze parti. Nel 2026, due opzioni dominano: Cloud Run e Cloudflare Workers. App Engine è considerato legacy — nessun scaling automatico, cold start oltre 8 secondi. Workers è più economico ma l'integrazione con l'ecosistema GTM richiede middleware aggiuntivo.

Abbiamo scelto Cloud Run: l'immagine container ufficiale di GTM funziona direttamente, scaling orizzontale automatico, cold start sotto 2 secondi. Il calcolo dei costi è importante: 1M richieste/mese + istanza RAM 512MB × 3 zone = circa €30/mese. Con Cloudflare Workers sarebbe €5/mese, ma gli strumenti di debug sono deboli e l'integrazione delle variabili personalizzate richiede configurazione manuale.

Il comando di deploy è il seguente:

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

`min-instances=1` è critico — su un sito di e-commerce, il tempo di spin-up di un'istanza da zero può far perdere una conversione. Il costo aggiuntivo di circa €9/mese garantisce uptime al 100%. `container.json` è la configurazione del container esportata dall'interfaccia web di GTM — invece della sincronizzazione manuale, potete integrarla nel vostro CI/CD.

La struttura dei sottodomini: `sgtm.example.com` → IP Cloud Run. Non usiamo Load Balancer; l'IP anycast globale di Cloud Run è sufficiente. SSL è automatico, il certificato gestito di Cloud Run è pronto in 3 minuti.

## Event Deduplication: Due Segnali, Una Conversione

La più grande trappola della misurazione server-side è questa: la stessa conversione arriva sia dal browser che dal server, e la piattaforma la conta due volte. Il parametro `event_id` nell'API di Conversione di Meta risolve questo problema — se il client e il server condividono lo stesso ID, Meta elimina i duplicati entro una finestra di 28 ore.

Flusso di esempio: l'utente completa un ordine, il browser GTM attiva l'evento `purchase` → Meta Pixel. Contemporaneamente, il frontend invia una POST al nostro endpoint `/api/track` → sGTM → Meta Conversion API. Entrambi i segnali trasportano `event_id: order_12345_ts1716547200`.

```javascript
// Variabile GTM client-side: event_id
function() {
  var orderId = {{Order ID}};
  var timestamp = Math.floor(Date.now() / 1000);
  return orderId + '_ts' + timestamp;
}
```

Nel GTM server-side, mappiamo lo stesso valore di `event_id` al tag Meta Conversion API. Importante: il componente timestamp non è obbligatorio, ma previene collisioni di ID unici — lo stesso order_id potrebbe essere riutilizzato in sessioni diverse.

Per Google Ads è diverso: il parametro `gclid` è sufficiente, non esiste un ID di deduplication aggiuntivo. Ma in Google Analytics 4, se inviate la combinazione `client_id` + `session_id` sia dal client che dal server, GA4 esegue automaticamente la dedup — una funzione aggiunta nel Q3 2024.

Validazione della dedup: in Meta Events Manager, il punteggio "Event Match Quality" deve essere superiore all'80%. Se questo punteggio è basso — soprattutto se mancano gli hash di `em` (email), `ph` (telefono), `fn` (nome) — Meta considera l'evento "bassa confidenza" e l'affidabilità della pulizia dei duplicati diminuisce.

## Container Template: Quali Tag Dovrebbero Essere Predefiniti

Il Server Container di GTM inizia vuoto, ogni tag va aggiunto manualmente. Dopo aver configurato 15+ container, abbiamo creato un repository di template — un nuovo cliente raggiunge la production-readiness in 5 minuti.

**Tag obbligatori:**
- **Meta Conversion API** (usando Meta Business Extension)
- **Google Analytics 4** (con client server-side)
- **Google Ads Conversion** (con Enhanced Conversion)
- **Snapchat Conversion API** (per clienti gaming/fashion)
- **TikTok Events API** (per il targeting della Gen Z)

**Facoltativi ma consigliati:**
- **Writer Firestore/BigQuery** — registra ogni evento in forma grezza, fondamentale per audit trail e modellazione dell'attribuzione
- **Consent check variable** — analizza la stringa TCF 2.2 e controlla l'approvazione per purpose 1 (storage) e purpose 2 (measurement), invia `action_source=physical_store` a Meta se c'è diniego (non è elusione del consenso, è segnale aggregato)
- **User IP enrichment** — estrai `X-Forwarded-For` dall'header della richiesta Cloud Run, migliora l'accuratezza geolocalizzazione dell'API di Conversione del 12%

Struttura di esempio del repository di template:

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

Ogni file JSON viene esportato dall'interfaccia web di GTM — non potete importarlo direttamente con il CLI `gcloud`, ma potete automatizzarlo con script nel CI/CD. Esiste un provider Terraform per GTM, ma è gestito dalla comunità, non ufficiale.

### Variabile User Data: Invio Senza Hash

Meta e Google richiedono che le PII (informazioni di identificazione personale) siano hashate: email → SHA256, telefono → formato E.164 + SHA256. Nel GTM client-side, l'hash avviene in JavaScript, ma nel sGTM è più sicuro farlo lato server — i dati in testo normale non sono visibili negli strumenti di sviluppo del browser.

```javascript
// Variabile personalizzata sGTM: hashed_email
const crypto = require('crypto');
const getEventData = require('getEventData');

const email = getEventData('user_data.email_address');
if (!email) return undefined;

return crypto.createHash('sha256')
  .update(email.toLowerCase().trim())
  .digest('hex');
```

Per il telefono, il formato E.164: `+905321234567` (codice paese + numero senza zero iniziale). Nei progetti Roibase, il 40% dei dati telefonici viene rifiutato a causa di errori di formattazione — dovete aggiungere una validazione.

## Conversion API e Enhanced Conversion: Qual è la Differenza

L'API di Conversione di Meta e Google Enhanced Conversion sono protocolli diversi ma servono lo stesso scopo: aumentare il tasso di corrispondenza della piattaforma con dati first-party. Conversion API è basato su eventi — ogni clic, aggiunta al carrello, acquisto è una POST HTTP separata. Enhanced Conversion è basato su tag — i dati utente vengono inviati solo in fase di conversione (acquisto, registrazione).

Configurazione del tag Google Enhanced Conversion in sGTM:

```json
{
  "type": "google_ads_remarketing",
  "enhancedConversionData": {
    "email": "{{Hashed Email}}",
    "phone": "{{Hashed Phone}}",
    "address": {
      "first_name": "{{Hashed First Name}}",
      "last_name": "{{Hashed Last Name}}",
      "country": "IT",
      "postal_code": "{{Postal Code}}"
    }
  }
}
```

In Meta, l'oggetto `user_data` viene inviato per ogni evento — `ViewContent`, `AddToCart`, `Purchase` ricevono tutti gli stessi dati hashati.

Differenza pratica: Google Enhanced Conversion è attivo solo nel pixel di conversione — se il traffico è limitato, il tasso di corrispondenza rimane basso. Meta CAPI riceve dati utente per ogni evento, rendendo l'audience di retargeting più ricca. Per questa ragione nell'e-commerce, il setup di Meta CAPI è prioritario, Google EC è in secondo piano.

## Monitoraggio e Debug: Quali Metriche Dovremmo Osservare

Uno stack server-side in production, senza monitoraggio, non funziona. Nel GTM client-side c'è la modalità preview — nel server-side no, fate debug sul traffico live.

**Metriche critiche:**
- **Conteggio istanze Cloud Run** — anche se min=1, durante i picchi di traffico il conteggio può salire a 10, impostate allarmi per il controllo dei costi
- **Tempo di risposta P95** — oltre 500ms inizia la perdita di conversioni, soprattutto nella pagina di checkout
- **Punteggio Meta Event Match Quality** (controllo manuale in Events Manager) — sotto l'80% significa dati utente incompleti
- **Rapporto tra conteggio evento GA4 server / client** — ideale 1.1-1.3 (il server dovrebbe vedere leggermente di più, a causa dei blocchi client-side), sotto 0.8 c'è un errore sul server

Query Cloud Logging:

```sql
resource.type="cloud_run_revision"
resource.labels.service_name="sgtm-prod"
jsonPayload.event_name="purchase"
severity="ERROR"
```

I log di errore non vengono scritti in GTM con `console.log` — dovete usare l'API `logToConsole()`, che li scrive in Cloud Logging.

Schema della tabella BigQuery log:

| Campo | Tipo | Descrizione |
|---|---|---|
| event_timestamp | TIMESTAMP | Orario server (UTC) |
| event_name | STRING | purchase, add_to_cart, ecc. |
| user_id | STRING | Hashato |
| client_id | STRING | ID client GA4 |
| event_id | STRING | ID dedup |
| platform | STRING | meta, google_ads, snapchat |
| response_code | INTEGER | Codice di stato HTTP |

Questa tabella, nell'ambito di [Architettura dei Dati First-Party e della Misurazione](https://www.roibase.com.tr/it/firstparty), viene scritta nel data warehouse BigQuery, collegata a modelli downstream (attribuzione, previsione LTV) tramite dbt.

## Consent Mode v2 e Server-Side: Come Integrare

Da marzo 2024, Google Consent Mode v2 è obbligatorio nell'EEA — lo stato del consenso per `ad_storage` e `analytics_storage` deve essere inviato in ogni hit. Nel server-side, questa informazione non proviene da GTM client-side, dovete inviarla manualmente.

Esistono due metodi:
1. **Query parameter:** `sgtm.example.com/g/collect?consent=granted` — facile ma visibile nell'URL, problemi di cache
2. **HTTP header:** `X-Consent-Status: analytics_storage=granted,ad_storage=denied` — metodo preferito

Variabile personalizzata in sGTM:

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

Mappate questa variabile ai tag GA4 e Google Ads. In Meta CAPI non esiste un parametro di consenso — il controllo indiretto avviene con `action_source`: `action_source=website` significa consenso presente, `action_source=physical_store` significa modalità aggregata (nessun consenso ma conteggiabile come offline).

## Cosa Testare nella Prima Settimana

Quando andate in production, esecuzione parallela è indispensabile: i pixel client-side continuano a funzionare, il server-side gira in parallelo. Monitorate entrambi per due settimane, poi disabilitate il client-side.

**Checklist di test:**
- [ ] Il conteggio degli eventi in Meta Events Manager è entro ±10% dal client-side
- [ ] C'è calo nel conteggio delle sessioni GA4 (il server-side dovrebbe vederne di più)
- [ ] Il conteggio delle conversioni in Google Ads è cambiato (ci si aspetta un aumento di +8-15% con Enhanced Conversion)
- [ ] Il costo Cloud Run supera i €50/mese (per 1M eventi/mese, il range normale è €30-40)
- [ ] La dedup funziona — nessun avviso di evento duplicato nei Test Events di Meta
- [ ] Il conteggio degli eventi giornalieri nella tabella BigQuery log corrisponde all'analytics del frontend

Problemi che certamente sorgeranno nella prima settimana: errore di formato nei dati utente hash (30-40% degli eventi), header di consenso mancante (15-20%), perdita di conversioni iniziali a causa di cold start di Cloud Run (se min-instances=0). Per questo, non attivate il nuovo stack durante periodi critici come il Black Friday — stabilizzatelo in un periodo di traffico normale.

## Stack Production: Cosa Fare Ora

La misurazione server-side nel 2026 non è più "sperimentale", è "standard". Fare affidamento su pixel client-side significa perdita di conversioni del