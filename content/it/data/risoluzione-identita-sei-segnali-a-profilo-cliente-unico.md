---
title: "Risoluzione dell'identità: da sei segnali a un profilo cliente unico"
description: "Hash matching, probabilistic linking e household identity: come unificare touchpoint dispersi in un profilo cliente coeso. Pipeline server-side e schema pratico."
publishedAt: 2026-07-19
modifiedAt: 2026-07-19
category: data
i18nKey: data-003-2026-07
tags: [identity-resolution, hash-matching, probabilistic-linking, cdp, first-party-data]
readingTime: 9
author: Roibase
---

Un utente clicca sulla campagna dallo smartphone, aggiunge il prodotto al carrello dal desktop, completa l'acquisto in negozio. Tre segnali, tre identità distinte: `device_id`, `cookie_hash`, `email_hash`. La risoluzione dell'identità è la pipeline dati che unifica questi frammenti in un profilo cliente coeso. Nell'era post-cookie — Consent Mode v2, iOS ATT, CCPA — l'architettura di risoluzione delle identità basata su dati first-party server-side non è più una raccomandazione, ma un imperativo.

## Perché sei segnali distinti

Lo stack di marketing moderno raccoglie segnali di identità su sei livelli: **browser cookie**, **device ID** (IDFA/GAID), **authenticated hash** (email SHA-256), **customer ID** (interno CRM/CDP), **IP+user-agent fingerprint**, **household graph**. Ognuno entra in gioco in momenti diversi del ciclo di vita.

Il browser cookie si attiva al primo touchpoint; il device ID sull'app mobile; l'authenticated hash quando si raccoglie email o numero di telefono; il customer ID dopo il checkout; il fingerprint per il matching probabilistico senza consenso; l'household graph raggruppa i dispositivi connessi dallo stesso router. Il problema: questi sei segnali vivono in tabelle separate, con TTL diversi (cookie 90 giorni, IDFA perpetuo, email hash fino all'eliminazione del cliente). Senza risoluzione, ogni canale conta l'utente separatamente — il marketing mix model doppia il conteggio, i test di incrementalità sovrastimano, le coorti di retention mostrano retenzione artificialmente bassa.

La logica di risoluzione poggia su due metodi: **deterministico (hash matching)** e **probabilistico (graph linking)**. Deterministico: l'hash SHA-256 dell'email unisce un evento browser con una transazione backend — certezza al 100%. Probabilistico: se lo stesso IP+user-agent appare in due eventi entro 24 ore, la probabilità che sia lo stesso utente è 73% (ad esempio di soglia). Senza risoluzione, il conteggio degli utenti unici si gonfia del 40-80% (a seconda del mix di categoria e dispositivi).

## Hash matching: convertire email e telefono in chiave identitaria

L'hash matching è la spina dorsale della risoluzione dell'identità server-side. Nel momento in cui l'utente fornisce email o telefono, il client-side o sGTM genera uno hash SHA-256, che viene scritto nella tabella `identity_map`. In tutti gli eventi anonimi successivi, cercate il cookie o device ID per recuperare l'hash.

Schema semplice di `identity_map`:

```sql
CREATE TABLE identity_map (
  canonical_id STRING NOT NULL,      -- UUID, ID interno
  signal_type STRING NOT NULL,       -- 'email_sha256', 'phone_sha256', 'device_id', 'cookie'
  signal_value STRING NOT NULL,      -- hash o ID
  first_seen TIMESTAMP,
  last_seen TIMESTAMP,
  PRIMARY KEY (signal_type, signal_value)
);
```

Quando un utente digita `user@example.com` in un form di registrazione, sGTM lo trasforma in hash SHA-256 e fa un `INSERT`: `('uuid-123', 'email_sha256', 'abc123...', NOW(), NOW())`. Se nella stessa sessione esiste il cookie `_ga=GA1.1.xyz`, aggiungete una seconda riga: `('uuid-123', 'cookie', 'GA1.1.xyz', NOW(), NOW())`. Così due segnali converge sotto `canonical_id = uuid-123`.

Nella sessione successiva, l'utente torna con solo `_ga=GA1.1.xyz`, senza inserire l'email. Fate una query su BigQuery:

```sql
SELECT canonical_id
FROM identity_map
WHERE signal_type = 'cookie' AND signal_value = 'GA1.1.xyz'
LIMIT 1;
```

Ritorno: `uuid-123`. Assegnate l'evento a questo ID — lo stesso utente è identificato anche senza l'hash email. La precisione dell'hash matching è del 100% perché una collisione crittografica è teoricamente impossibile. Però c'è il problema della copertura: se l'utente non fornisce l'email, non c'è hash, allora passate al probabilistico.

### Rischio di collisione e salt

Il rischio di collisione SHA-256 è teorico: 1 su 2^128 tentativi. Ma in produzione il vero problema è che **lo stesso email potrebbe essere legato a canonical_id diversi** (errore manuale, residui da migrazione precedente). Per questo aggiungete `UNIQUE INDEX (signal_type, signal_value)`. L'uso del salt (email + stringa segreta, poi hash) non aumenta il rischio di collisione, ma nella [progettazione dell'architettura first-party](https://www.roibase.com.tr/it/firstparty) aggiunge uno strato di privacy — ruotando il salt, i vecchi hash diventano invalidi, utile per il "right to be forgotten" GDPR.

## Probabilistic linking: IP, user-agent e device graph

Se l'utente naviga in modalità anonima, non ci sono segnali deterministici. Qui entrate in gioco con **probabilistic graph**: IP + user-agent + prossimità temporale per produrre un punteggio di "probabilmente è lo stesso utente". Esempio: stesso IP, stesso user-agent, a distanza di 15 minuti, due eventi — probabilità 85% che sia lo stesso utente.

Logica semplice di probabilistic merge:

```sql
WITH anon_events AS (
  SELECT
    event_id,
    ip_address,
    user_agent,
    event_timestamp,
    FARM_FINGERPRINT(CONCAT(ip_address, user_agent)) AS fingerprint
  FROM events
  WHERE canonical_id IS NULL
),
clusters AS (
  SELECT
    fingerprint,
    MIN(event_timestamp) AS first_event,
    MAX(event_timestamp) AS last_event,
    COUNT(*) AS event_count
  FROM anon_events
  GROUP BY fingerprint
  HAVING TIMESTAMP_DIFF(MAX(event_timestamp), MIN(event_timestamp), HOUR) < 24
)
SELECT
  a.event_id,
  c.fingerprint AS probable_cluster_id
FROM anon_events a
JOIN clusters c ON a.fingerprint = c.fingerprint;
```

Questa query raggruppa gli eventi per hash IP+UA entro 24 ore. Potete usare il cluster ID come `canonical_id` temporaneo, ma aggiungete un confidence score: `event_count > 3 AND time_span < 1 HOUR → confidence=0.9`.

**Household graph:** Se da uno stesso IP arrivano user-agent diversi (laptop, tablet, telefono), è probabilmente la stessa abitazione. Qui create un `household_id` e lo inserite sotto il `canonical_id` individuale. Ad esempio, una sottoscrizione Amazon Prime: 1 abbonamento, 6 profili — la risoluzione dell'identità aggrega a livello household.

### False positive

Nel probabilistic linking il rischio di falsi positivi è reale. Lo stesso IP+user-agent può provenire da due utenti diversi (WiFi ufficio, biblioteca). Se la soglia è troppo bassa (50% confidence), vedrete il 15-25% di falsi positivi. Best practice del settore: soglia di confidenza > 75%, finestra temporale di 1 ora, minimo 2 event match. Vendor come LiveRamp usano database a grafo (Neo4j) e combinano 30+ segnali asserendo > 95% di accuratezza — ma nel vostro pipeline first-party, 2-3 segnali vi danno l'80% di accuratezza, che è sufficiente.

## Pipeline server-side: sGTM + BigQuery + dbt

La risoluzione dell'identità in produzione segue questo flusso:

1. **Ingestion sGTM:** L'evento client-side GTM va a sGTM, sGTM aggiunge l'hash SHA-256 se c'è email, scrive l'evento raw in BigQuery (`events_raw`).
2. **Staging model dbt:** La tabella `stg_events` produce eventi ripuliti da `events_raw`, le colonne `signal_type` e `signal_value` vengono parsed.
3. **Merge identity_map dbt:** Quando appare un nuovo hash, si fa un `MERGE` in `identity_map` (logica upsert).
4. **Arricchimento canonical_id dbt:** Ogni evento viene joinato con `identity_map`, lookup di `canonical_id`.
5. **Aggregazione dbt:** Le metriche a livello utente (`user_ltv`, `session_count`) vengono aggregate per `canonical_id`.

Frammento di modello dbt di esempio (`models/staging/stg_events.sql`):

```sql
{{ config(materialized='incremental') }}

WITH events_with_signals AS (
  SELECT
    event_id,
    event_timestamp,
    COALESCE(user_properties.email_sha256, NULL) AS email_hash,
    COALESCE(user_properties.ga_client_id, NULL) AS cookie_id,
    event_params
  FROM {{ source('bigquery', 'events_raw') }}
  {% if is_incremental() %}
  WHERE event_timestamp > (SELECT MAX(event_timestamp) FROM {{ this }})
  {% endif %}
)
SELECT * FROM events_with_signals;
```

Il modello incrementale gira ogni ora e elabora l'ultimo batch. La logica di merge dell'identità sta in un modello separato (`models/core/fct_identity_resolved.sql`):

```sql
SELECT
  e.event_id,
  COALESCE(im_email.canonical_id, im_cookie.canonical_id) AS canonical_id,
  e.event_timestamp
FROM {{ ref('stg_events') }} e
LEFT JOIN {{ ref('identity_map') }} im_email
  ON e.email_hash IS NOT NULL
  AND im_email.signal_type = 'email_sha256'
  AND im_email.signal_value = e.email_hash
LEFT JOIN {{ ref('identity_map') }} im_cookie
  ON e.cookie_id IS NOT NULL
  AND im_cookie.signal_type = 'cookie'
  AND im_cookie.signal_value = e.cookie_id;
```

Questa logica di join esegue il hash matching deterministico. Per il probabilistico, aggiungete un modello separato `fct_probabilistic_clusters`.

## Consenso e privacy: conformità GDPR, CCPA

La risoluzione dell'identità è soggetta all'Articolo 6 GDPR (base legale) e alle norme CCPA "do not sell". L'hash email è considerato **personal data** (sentenza CJEU 2019), per cui occorre consenso o interest legittimo.

Sotto Consent Mode v2, se l'utente imposta analytics_storage=denied, non potete raccogliere l'hash email. In questo caso potete usare solo fingerprint IP+UA (base di interest legittimo — ma l'interpretazione CJEU è controversa). Best practice: aggiungete la colonna `consent_status` in `identity_map` e scrivete l'hash solo da eventi con `analytics_storage=granted`.

Per il "right to delete" CCPA, serviva logica di cancellazione per `canonical_id`:

```sql
DELETE FROM identity_map WHERE canonical_id = 'uuid-123';
DELETE FROM events WHERE canonical_id = 'uuid-123';
```

Per cancellazione a cascata usate foreign key constraint (BigQuery non lo supporta nativamente, ma Postgres/Snowflake sì). Alternativa: soft delete (`deleted_at TIMESTAMP`) e purge batch successiva.

### Mapping vendor TCF 2.2

Sotto IAB TCF 2.2, la risoluzione dell'identità rientra in "Purpose 1 — Store and/or access information on a device". Se l'utente non ha approvato il vostro vendor nella vendor list, non potete fare linking cross-device. Nei progetti Roibase, parsed la stringa TCF in BigQuery e scriviamo `vendor_consent`, poi applichiamo il filtro durante il merge dell'identità:

```sql
WHERE vendor_consent LIKE '%vendor_id=123%'
```

Questa logica impedisce di costruire il grafo dell'identità senza consenso — equilibrio tra compliance e qualità dei dati.

## Integrazione CDP: Segment, mParticle, Rudderstack

I CDP moderni espongono i loro graph dell'identità, ma spesso come scatola nera. Costruendo la vostra pipeline, controllate la logica del graph — specialmente critico nel progetto [CDP & Retention Engineering](https://www.roibase.com.tr/it/retention-engineering-cdp). La chiamata `identify()` di Segment unisce `userId` e `anonymousId`, ma quale segnale ha priorità? Nel vostro resolution logic la sequenza di priorità è trasparente:

1. `customer_id` (CRM) → più affidabile
2. `email_sha256` → deterministico
3. `device_id` → cross-session ma non cross-device
4. `cookie` → TTL più breve
5. `fingerprint` → fallback probabilistico

Codificate questa priorità in dbt con una catena `COALESCE()`. Al CDP inviate solo il `canonical_id` finale e il `confidence_score`, la logica di merge resta vostre.

La risoluzione dell'identità è lo strato fondamentale dello stack dati di marketing moderno. L'hash matching offre certezza deterministica, il probabilistic linking copertura, l'household graph segmentazione a livello familiare. Quando una pipeline server-side unifica questi sei segnali in conformità alle normative su consenso e privacy, l'accuratezza dell'utente unico sale del 40%, le coorti di retention perdono il bias, i test di incrementalità diventano affidabili. Costruendo la vostra logica di risoluzione con BigQuery + dbt + sGTM, gestite il grafo come volete senza dipendere dalla scatola nera di un vendor.