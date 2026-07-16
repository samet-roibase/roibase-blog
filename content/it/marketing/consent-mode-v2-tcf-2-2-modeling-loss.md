---
title: "Consent Mode v2 e TCF 2.2: Come Gestiamo la Perdita di Modellazione"
description: "Implementazione pratica dell'infrastruttura di consent modeling di Google e integrazione TCF 2.2 per minimizzare la perdita di misurazione conforme a GDPR."
publishedAt: 2026-07-16
modifiedAt: 2026-07-16
category: marketing
i18nKey: marketing-006-2026-07
tags: [consent-mode, tcf, gdpr, conversion-modeling, gtm]
readingTime: 8
author: Roibase
---

Google Consent Mode v2 e IAB TCF 2.2 sono ormai obbligatori. Da marzo 2024, il traffico dell'EEA + Regno Unito non funziona senza Consent Mode per il remarketing e il targeting di audience su Google Ads. Ma quando raggiungi la conformità legale, ti trovi di fronte a un nuovo problema: il 40-70% degli utenti rifiuta il cookie di analytics, e la perdita di conversioni sale al 15-35%. L'infrastruttura di consent modeling di Google cerca di colmare questo divario — ma solo se implementata correttamente. In questo articolo spieghiamo i layer di implementazione, l'integrazione TCF e una checklist di qualità dei dati per minimizzare la perdita di modellazione con scenari reali.

## Che cos'è Consent Mode v2 e Perché la Modellazione è Inevitabile

Consent Mode è un protocollo che invia lo stato del consenso dell'utente (granted/denied) come segnale alle API di piattaforma. Nella v2 sono stati aggiunti due nuovi parametri: `ad_user_data` (possiamo raccogliere dati per la personalizzazione?) e `ad_personalization` (possiamo aggiungere l'utente a un audience di remarketing?). Senza questi due, il traffico dell'EEA non può accedere al targeting con persona su Google Ads.

Il problema classico di Consent Mode è il seguente: se l'utente rifiuta il cookie di analytics, Google Analytics non può registrare l'evento di conversione. In questo scenario, la tua campagna su Google Ads rimane senza dati di conversione — l'algoritmo di bidding è accecato. È qui che entra in gioco la consent modeling: Google cerca di stimare il comportamento degli utenti che rifiutano il consenso basandosi su coorti simili che l'hanno concesso, cercando di modellare il numero di conversioni.

Affinché la modellazione funzioni, ha bisogno di due input critici: (1) dati sufficienti con consenso concesso (almeno 100 conversioni al giorno, idealmente 1000+), (2) lo stato del consenso deve essere pingato correttamente (`gtag('consent', 'update', {...})`). Se questi due elementi mancano, la modellazione scende in modalità "insufficient data" e la perdita non viene colmata.

### Fattori che Influenzano la Perdita di Modellazione

Secondo la documentazione Google del Q4 2024, la consent modeling su account con il 50% di rifiuto del consenso fornisce in media un recupero del 70%. Cioè, se hai il 50% di perdita di consenso, la modellazione può ridurla al 15%. Ma questo tasso dipende da queste variabili:

- **Volume di traffico con consenso concesso:** Se è sotto i 100 al giorno, il modello è debole.
- **Implementazione della CMP:** Una CMP conforme allo standard IAB TCF v2.2 (OneTrust, Cookiebot, Usercentrics) con il corretto mapping dei purpose e dei vendor aumenta la qualità del segnale.
- **Utilizzo di GTM lato server:** Con sGTM, lo stato del consenso può essere controllato anche nel backend, aggiungendo contesto first-party e rafforzando l'input di modellazione.
- **Diversità dei tipi di conversione:** E-commerce checkout + add-to-cart + pageview insieme forniscono al modello un funnel più ampio da cui imparare.

Quando la modellazione è debole, la strategia di bidding di Google Ads (Target ROAS, Max Conversions) sottoperforma perché il segnale di conversione reale è incompleto. Per compensare, è necessaria l'importazione di conversioni offline o CAPI (Conversions API) con integrazione backend-to-Google.

## Integrazione TCF 2.2: Purpose Mapping e Vendor List

IAB Transparency and Consent Framework (TCF) 2.2 divide il consenso dell'utente in 10 categorie di purpose (finalità). Per far funzionare Google Ads è necessario almeno il Purpose 1 (archiviazione/accesso alle informazioni) e il Purpose 2 (personalizzazione). La stringa di consenso TCF viene generata dalla CMP e letta tramite il callback `__tcfapi` e convertita in Consent Mode in GTM.

Praticamente funziona così: quando l'utente fa clic su "Accetto" nel banner della CMP, la CMP imposta `tcData.purpose.consents` con `{1: true, 2: true, ...}`. Questo oggetto viene letto in una variabile GTM Custom JavaScript e mappato come segue:

```javascript
var tcData = window.__tcfapi || {};
var purposes = tcData.purpose.consents;

if (purposes[1] && purposes[2]) {
  gtag('consent', 'update', {
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted'
  });
} else {
  gtag('consent', 'update', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });
}
```

Quando si effettua questo mapping, occorre prestare attenzione a tre punti:

1. **Controllo della lista dei vendor:** Se Google (vendor ID 755) è nella lista dei vendor TCF e l'utente l'ha approvato, il segnale può essere inviato. Altrimenti, `ad_storage: 'denied'` deve rimanere.
2. **Modello di interesse legittimo:** I purpose 2-7-9-10 possono funzionare anche con "legitimate interest" (interesse legittimo). In Italia questo è rischiato dal punto di vista legale — il GDPR non definisce completamente questo modello per tutte le finalità.
3. **Periodo di rinnovo del consenso:** Nel TCF 2.2, il consenso deve essere rinnovato ogni 13 mesi. Se la tua CMP non dispone di un meccanismo di refresh automatico, il consenso dovrebbe passare a `denied` quando scade.

### Scelta della CMP e Checklist di QA

Quando scegli una CMP, la certificazione TCF 2.2 è obbligatoria. OneTrust e Cookiebot sono certificate, ma puoi aggiungere purpose custom nella configurazione e violare lo standard IAB. Checklist di QA:

| Passaggio | Punto di Controllo |
|---|---|
| 1 | Ordine di caricamento della CMP: è prima del container GTM? (nessuna race condition?) |
| 2 | `__tcfapi('getTCData', 2, callback)` risponde correttamente? |
| 3 | Il mapping dei purpose 1, 2, 7, 9, 10 è corretto? |
| 4 | Il vendor 755 (Google) è approvato? |
| 5 | Dopo l'aggiornamento del consenso, un evento `consent_update` arriva al Data Layer GTM? |
| 6 | Gli event di GA4 inviano ping anche quando `ad_storage: denied`? (il ping con consenso negato è obbligatorio) |

Il passaggio 6 è critico: anche quando il consenso è negato, il ping `gtag('event', ...)` deve essere inviato — solo il cookie non deve essere impostato. Questi ping forniscono input alla modellazione di Google.

## Architettura di Consenso Ibrida con GTM Lato Server

Il modo più efficace per aumentare la qualità del segnale in Consent Mode v2 è costruire un'architettura di "hybrid consent" tramite server-side GTM (sGTM). In questo modello:

1. **Client-side:** Lo stato del consenso dell'utente viene letto dalla CMP e inviato a Google tramite `gtag('consent', 'update', ...)`.
2. **Server-side:** Nel container sGTM, viene controllato l'header del consenso nella richiesta HTTP in arrivo. Se il consenso è concesso, l'evento lato server proveniente dal backend (ad es. completamento del checkout) viene inviato direttamente all'endpoint di conversione di Google Ads.

Il vantaggio di questo approccio è che anche per gli utenti che rifiutano ATT su iOS o utilizzano ad blocker, può essere inviato un segnale di conversione lato server. Perché l'evento lato server è indipendente dal cookie del browser dell'utente — è legato all'ID ordine del backend. Google lo fa corrispondere con il `gclid` (Google Click ID).

Scenario di esempio: l'utente utilizza un ad blocker, GTM lato client non viene caricato affatto. Ma al checkout, il tuo backend invia una richiesta HTTP POST a sGTM:

```json
{
  "event_name": "purchase",
  "client_id": "hashed_user_id",
  "gclid": "abc123",
  "value": 250.00,
  "currency": "EUR",
  "consent_ad_storage": "denied"
}
```

Quando sGTM invia questo evento a Google Ads, poiché `consent_ad_storage: denied`, non imposta il cookie ma fornisce comunque un input alla modellazione delle conversioni. Per farlo, hai bisogno di un tag Google Ads Conversion Linker lato server + mappatura client ID nel backend di sGTM.

### Passaggi di Implementazione di sGTM

1. **Configura il container sGTM:** Distribuiscilo su Google Cloud Run o Cloudflare Workers.
2. **Invia l'evento dal backend:** Invia l'evento di completamento del checkout con ID ordine + gclid + flag di consenso.
3. **Configura il tag Google Ads in sGTM:** Inserisci ID conversione + etichetta di conversione, nel tab "User-Provided Data" esegui il mapping di `client_id`.
4. **Aggiungi l'applicazione del consenso:** Con un custom template di sGTM, controlla il consenso — se `ad_user_data: denied`, applica l'hashing SHA-256 e la mascheratura IP come obbligatori.

Il punto critico in questa architettura: per conformità GDPR, il `client_id` che invii dal backend deve essere un hash SHA-256. L'invio di email o ID utente raw è considerato una violazione di trasferimento dati.

## Segnalare la Perdita di Modellazione e Ottimizzare

Su Google Ads, nella scheda "Conversions > Measurement" esiste una colonna "Modeled conversions". Questa colonna mostra il numero di conversioni stimate per gli utenti che hanno negato il consenso. Ecco come leggerla:

- **Conversioni osservate:** Dati reali da utenti con consenso concesso.
- **Conversioni modellate:** Conversioni stimate per utenti che hanno negato il consenso.
- **Conversioni totali:** Somma di osservate + modellate.

Per calcolare la perdita di modellazione, usa la formula semplice: `(1 - (Modeled / (Total Traffic × Consent Denial Rate))) × 100`. Per esempio:

- Traffico totale: 10,000 click
- Tasso di rifiuto del consenso: %50 (5,000 persone negano il consenso)
- Conversioni osservate: 150
- Conversioni modellate: 60

Conversioni attese (se avesse avuto il consenso): `150 × 2 = 300` (perché il 50% ha negato il consenso). In realtà hai 210 conversioni totali (150 + 60). Perdita: `(1 - (210 / 300)) × 100 = %30`.

### Tattiche per Migliorare la Modellazione

Per aumentare le prestazioni della modellazione, ottimizza questi punti:

1. **Aumenta il volume di traffico con consenso concesso:** Rendi il pulsante "Accetto" nel banner della CMP più visibile. Ma attenzione — questo non deve essere dark pattern. Limita le modifiche al layout, non ingannare gli utenti.
2. **Aggiungi event del funnel:** Non solo purchase, ma anche add-to-cart, begin_checkout. Il modello cattura segnali di intent più ampi.
3. **Importazione di conversioni offline:** Importa i dati degli ordini reali dal backend in Google Ads. Questo bypassa la modellazione ma ha limiti API (2,000 conversioni/account al giorno).
4. **Enhanced conversions:** Invia gli hash di email/telefono insieme all'evento di conversione. Questo fornisce corrispondenza first-party, aumentando l'accuratezza della modellazione.

Nota: Le enhanced conversions sono una zona grigia dal punto di vista GDPR. Se l'utente ha concesso il consenso, l'invio dell'hash email è legale; se ha negato il consenso, l'invio di questi dati, anche hashati, è una violazione. Quindi dovresti attivare le enhanced conversions solo quando `ad_user_data: granted`.

## Trade-off del Mondo Reale: Conformità vs. Performance

Infine, vediamo i compromessi di tre diversi approcci alla strategia di consenso:

| Approccio | Tasso di Rifiuto del Consenso | Recupero di Modellazione | Impatto ROAS | Rischio GDPR |
|---|---|---|---|---|
| **Rigoroso (nessun pre-check)** | %60-70 | %60-70 | -%25 ROAS | Basso |
| **Bilanciato (interesse legittimo)** | %40-50 | %70-80 | -%15 ROAS | Medio (ambiguo in Italia) |
| **Aggressivo (pre-checked)** | %20-30 | %80-90 | -%5 ROAS | Alto (violazione GDPR) |

La raccomandazione di Roibase: **Approccio bilanciato + sGTM.** Usa l'interesse legittimo nella CMP e mantieni i purpose 2-7-9-10 attivi, ma non pre-selezionarli. Invia il segnale di conversione del backend a Google tramite GTM lato server. In questo modo, il rifiuto del consenso rimane al 40-50%, la perdita di modellazione si mantiene intorno al 15% e la capacità di bidding delle tue campagne di [performance marketing](https://www.roibase.com.tr/it/ppc) è preservata.

Se hai un'implementazione di Consent Mode ma la modellazione non funziona, ripassa la checklist qui sopra. Nella maggior parte dei casi, il problema è che la CMP non si carica prima di GTM o manca il parametro `ad_user_data`. Per diagnosticare, usa Google Tag Assistant e la modalità preview di sGTM — vedrai il flusso dei ping di consenso in tempo reale.