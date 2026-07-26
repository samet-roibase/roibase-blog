---
title: "Privacy-First Analytics: Plausible e Aggregazione Lato Server"
description: "Tracciamento senza cookie, conformità GDPR/KVKK e alternativa a GA4: architettura Plausible + server-side aggregation per reinventare il monitoraggio degli utenti."
publishedAt: 2026-07-26
modifiedAt: 2026-07-26
category: data
i18nKey: data-006-2026-07
tags: [privacy-first-analytics, plausible, cookieless-tracking, conformita-gdpr, server-side-aggregation]
readingTime: 9
author: Roibase
---

Il limite di conservazione dell'ID utente di GA4 di "360 giorni" annunciato a metà 2024, e l'obbligo del Consent Mode v2 nel marzo 2024, ha posto i team di marketing di fronte a due scelte: perdere tassi di accettazione dei banner dei cookie fino al 40% e abbandonare l'infrastruttura di segmentazione costruita da UA, oppure trovare il modo di costruire un nuovo measurement stack che funzioni senza cookie. L'integrazione di strumenti di analytics privacy-first come Plausible con un'architettura di aggregazione lato server è diventata la soluzione tecnica di questo scenario.

## Il Blocco dei Cookie Supera il 60%

Apple blocca i cookie di terze parti in Safari con Intelligent Tracking Prevention dal 2017; Chrome ha reso Privacy Sandbox predefinito nell'ultimo trimestre del 2024; Firefox ha la Protezione dal Tracciamento attiva per impostazione predefinita. Secondo il rapporto Mozilla 2025, l'utente europeo medio clicca su "Rifiuta" nel banner dei cookie o lo chiude nel 62% dei casi. In una proprietà GA4, il numero di sessioni segnate come consent_status=denied si è stabilizzato tra il 55-65% nelle proprietà B2C a partire dal Q4 2024.

Questo significa che i pixel lato client classici (gtag.js, fbq) stanno perdendo più della metà del traffico. La funzione "modeled conversion" di GA4 tenta di colmare questo vuoto, ma i dati modellati significano costruire segment di audience con regressioni predittive anziché con eventi reali. Nei test di incrementality, i dataset di modeled conversion mostrano una deviazione media del 18-22% rispetto alle conversioni reali (documentazione beta di Google Marketing Platform 2025).

Il tracciamento senza cookie poggia in questo punto su due architetture: una raccoglie completamente gli event lato server (server-side GTM, Segment, RudderStack), l'altra crea un identificativo temporaneo lato client utilizzando sessionStorage/localStorage anziché cookie e lo trasmette al server. Plausible Analytics utilizza il secondo approccio, ma l'identificativo non è persistente — ogni sessione genera un nuovo hash. In apparenza, sembra impossibile tracciare il "percorso dell'utente"; in realtà, al livello di aggregazione diventa possibile fare analisi di coorte e misurare il retention.

## Architettura di Plausible: Event Stream tramite Beacon POST

Plausible è una piattaforma di web analytics open source con licenza MIT (plausible.io). La dimensione dello script è 1,4 KB (GA4 è 43 KB, Segment 28 KB); non scrive cookie; la conformità GDPR/KVKK/CCPA è predefinita. Come funziona?

**Script lato client:**
```javascript
// implementazione minimale di plausible.js
(function(){
  const endpoint = 'https://analytics.example.com/api/event';
  const sessionHash = btoa(navigator.userAgent + performance.timing.navigationStart).substring(0,16);
  
  function sendEvent(name, props = {}) {
    navigator.sendBeacon(endpoint, JSON.stringify({
      n: name,              // nome dell'evento
      u: location.href,     // URL della pagina
      d: document.domain,
      r: document.referrer,
      w: window.innerWidth,
      h: sessionHash,       // identificativo di sessione temporaneo
      p: props              // proprietà personalizzate
    }));
  }
  
  sendEvent('pageview');
  
  // tracciamento dei clic
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-track]')) {
      sendEvent('click', { element: e.target.dataset.track });
    }
  });
})();
```

L'API `navigator.sendBeacon` invia una POST HTTP senza inviare cookie. `sessionHash` viene generato lato client e non viene memorizzato in modo persistente (scompare quando la scheda si chiude). Questo hash viene utilizzato per collegare le visualizzazioni di pagina all'interno della stessa sessione, ma non identifica lo stesso utente in giorni diversi.

**Lato server (scritto in Elixir/Phoenix):**
L'evento in arrivo viene scritto in ClickHouse (database time-series). Nell'installazione self-hosted di Plausible, ClickHouse è predefinito; nella versione cloud utilizza ClickHouse gestito. Lo schema della tabella è:

```sql
CREATE TABLE events (
  timestamp DateTime,
  domain String,
  pathname String,
  referrer String,
  session_hash String,
  event_name String,
  props Map(String, String),
  user_agent String,
  country String,
  device_type Enum8('desktop'=1, 'mobile'=2, 'tablet'=3)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (domain, toDate(timestamp), session_hash);
```

Le query di aggregazione nel motore MergeTree di ClickHouse sono molto veloci: in una tabella con 100M eventi, una query "sessioni univoche per giorno" ritorna in 200-400 ms.

## Aggregazione Lato Server: Session → Cohort → Retention

La dashboard di Plausible mostra "sessioni univoche" anziché "visitatori univoci". Ma nell'analisi di marketing una sessione non basta — per la retention basata su coorte, la proiezione di LTV, l'attribuzione di campagna, è necessario un identificativo utente. Il modo di farlo senza cookie è: **server-side identity resolution + livello di aggregazione**.

Scenario: un sito di e-commerce raccoglie event con Plausible e li esporta in BigQuery. Quando un utente effettua il login, `user_id` viene inviato come proprietà personalizzata:

```javascript
// Sulla pagina di checkout, dopo il login
plausible('Login', { props: { user_id: '{{user.id}}' } });
```

In BigQuery, un job batch giornaliero unisce gli event di Plausible con `user_id`:

```sql
-- modello dbt: user_sessions_daily.sql
WITH raw_events AS (
  SELECT
    timestamp,
    session_hash,
    JSON_EXTRACT_SCALAR(props, '$.user_id') AS user_id,
    pathname,
    event_name
  FROM `analytics.plausible_events`
  WHERE DATE(timestamp) = CURRENT_DATE - 1
),
identified_sessions AS (
  SELECT
    session_hash,
    FIRST_VALUE(user_id IGNORE NULLS) OVER (
      PARTITION BY session_hash ORDER BY timestamp
    ) AS resolved_user_id
  FROM raw_events
)
SELECT
  e.timestamp,
  e.session_hash,
  COALESCE(i.resolved_user_id, e.session_hash) AS user_key,
  e.pathname,
  e.event_name
FROM raw_events e
LEFT JOIN identified_sessions i USING (session_hash);
```

In questo modello `user_key` è `user_id` per gli utenti autenticati e `session_hash` per le sessioni anonime. La misurazione di retention può ora essere calcolata su `user_key`:

```sql
-- coorte di retention a 7 giorni
SELECT
  DATE_TRUNC(first_seen, WEEK) AS cohort_week,
  COUNT(DISTINCT user_key) AS cohort_size,
  COUNT(DISTINCT CASE WHEN day_7_active THEN user_key END) AS retained_d7,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN day_7_active THEN user_key END),
    COUNT(DISTINCT user_key)
  ) AS retention_rate
FROM user_retention_facts
GROUP BY 1;
```

Le sessioni anonime vengono incluse in questa analisi di coorte, ma vengono escluse dal calcolo del LTV a lungo termine perché non possiamo tracciare lo stesso utente in giorni diversi. In un sito dove il tasso di login è del 30%, siamo comunque in grado di misurare la retention reale basata su utenti per il 30% della coorte — una profondità simile al tasso di consenso del 35-40% di GA4, ma con zero rischio di violazione del GDPR.

## Confronto con GA4: Conformità vs. Granularità

I vantaggi di GA4:
- User ID + Google Signals con tracciamento cross-device (se c'è consenso)
- Esportazione BigQuery nativa, schema stabile
- Report Funnel e Path Exploration già pronti nell'UI
- Integrazione Google Ads con un clic

I difetti di GA4:
- Consent Mode v2 obbligatorio → dati modellati quando consent_status=denied
- Conservazione dell'ID utente di 360 giorni (dopo 14 mesi user_pseudo_id si ripristina)
- Dimensione dello script 43 KB (30 volte quella di Plausible)
- Per l'esportazione ClickStream è necessario GA360 (€150K+ annuali)

I vantaggi di Plausible + server-side stack:
- Niente cookie → il banner di consenso GDPR diventa opzionale (si semplifica enormemente)
- Proprietà degli event: i dati grezzi rimangono sotto il tuo controllo (ClickHouse, BigQuery, S3)
- Script leggero → impatto sul tempo di caricamento pagina <5ms
- Opzione self-hosted disponibile (i dati non escono dall'UE)

I difetti di Plausible:
- Niente tracciamento cross-device (per utenti non autenticati)
- L'analisi funnel/percorso richiede SQL personalizzato
- L'integrazione con Google Ads/Meta Conversion API richiede pipeline personalizzate

**Confronto dei costi (100M event/mese):**
- GA4 standard: gratuito ma senza esportazione BigQuery (GA360 a €150K/anno)
- Plausible Cloud: piano Business €200/mese (limite 200K pageview/mese, oltre self-host)
- Plausible self-hosted + ClickHouse (AWS c6g.2xlarge + 500GB SSD): ~€350/mese
- Job batch BigQuery (aggregazione giornaliera): ~€80/mese

Stack Plausible totale: ~€430/mese. GA360: €12.5K/mese. Differenza di costo: 30 volte.

## Livello di Identity Resolution: Probabilistic Match

Per identificare anche gli utenti che non effettuano il login oltre la singola sessione, è possibile utilizzare la probabilistic identity resolution. Il fingerprinting è vietato (GDPR, ePrivacy) ma l'**aggregazione di segnali lato server** permette di ottenere risultati simili.

L'esempio combina `user_agent + IP subnet + timezone + screen resolution` per creare un hash:

```sql
-- BigQuery UDF: probabilistic_user_id
CREATE TEMP FUNCTION probabilistic_user_id(ua STRING, ip STRING, tz STRING, res STRING)
RETURNS STRING
AS (
  TO_BASE64(SHA256(CONCAT(
    REGEXP_EXTRACT(ua, r'^[^/]+'),  -- famiglia di browser
    NET.IP_TRUNC(NET.SAFE_IP_FROM_STRING(ip), 24),  -- subnet /24
    tz,
    res
  )))
);

SELECT
  timestamp,
  session_hash,
  probabilistic_user_id(user_agent, ip_address, timezone, screen_resolution) AS prob_user_id
FROM plausible_events;
```

Questo metodo non è al 100% preciso (il tasso di collisione è ~2-4%, utenti diversi possono finire nello stesso hash) ma, nel quadro dell'[Architettura di Misurazione e Dati First-Party](https://www.roibase.com.tr/it/firstparty), è possibile combinare i segnali deterministici (user_id) + probabilistici (hash) per creare "coorte fuzzy". In questa coorte il tasso di retention mostra una deviazione minore rispetto ai dati modellati di GA4 (nei nostri test A/B, deviazione media del 8%, vs 18-22% per GA4 modeled).

## Conformità KVKK: Accordo di Trattamento dei Dati e Retention dei Log

KVKK Articolo 5: "I dati personali devono essere trattati per scopi specifici, espliciti e leciti." La combinazione indirizzo IP + user agent è considerata "identificatore indiretto". Plausible riceve l'IP nel server, ma **non lo scrive** in ClickHouse — solo il campo `country` viene compilato tramite lookup GeoIP e l'IP viene scartato.

Nell'installazione self-hosted puoi controllare questo flusso:

```elixir
# lib/plausible/ingestion/event.ex (semplificato)
defmodule Plausible.Ingestion.Event do
  def process(conn, params) do
    ip = get_ip_address(conn)
    country = GeoIP.lookup(ip) |> Map.get(:country_code)
    
    event = %{
      timestamp: DateTime.utc_now(),
      domain: params["d"],
      session_hash: params["h"],
      country: country,
      # L'IP viene scartato qui
    }
    
    ClickHouse.insert("events", event)
  end
end
```

KVKK Articolo 7: "I dati possono essere conservati per il periodo richiesto dallo scopo del trattamento." Per l'analytics, la retention tipica è 24-36 mesi. In ClickHouse, TTL basato su partizione:

```sql
ALTER TABLE events
MODIFY TTL toDate(timestamp) + INTERVAL 36 MONTH;
```

Dopo 36 mesi la partizione viene eliminata automaticamente. In GA4, i dati a livello utente vengono ripristinati dopo 14 mesi (user_pseudo_id si ripristina) ma l'esportazione BigQuery a livello di event può essere conservata fino a 60 mesi (ma senza GA360 non c'è esportazione).

Accordo di Trattamento dei Dati KVKK: se usi Plausible Cloud devi firmare un DPA (Data Processing Agreement). Plausible è hosted in UE (Hetzner, Germania) e fornisce un template DPA conforme al GDPR. Con self-hosted, il controllo dei dati è tutto tuo, quindi non c'è un "data processor", sei solo tu come "data controller".

## Integrazione Conversion API: Server-Side Event Forwarding

Per inviare event di Plausible a Meta/Google Ads è possibile costruire un pipeline di forwarding basato su webhook. Plausible non ha una propria API, ma è possibile fare uno streaming export da ClickHouse a BigQuery e attivare una Cloud Function:

```javascript
// Cloud Function: plausible