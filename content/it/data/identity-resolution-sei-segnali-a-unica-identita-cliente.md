---
title: "Identity Resolution: 6 Segnali a Unica Identità Cliente"
description: "Hash matching, probabilistic linking e household identity trasformano segnali dispersi in unica identità cliente attraverso architetture moderne di risoluzione dell'identità."
publishedAt: 2026-05-12
modifiedAt: 2026-05-12
category: data
i18nKey: data-003-2026-05
tags: [identity-resolution, hash-matching, probabilistic-linking, cdp, first-party-data]
readingTime: 9
author: Roibase
---

Un cliente medio di e-commerce vi vede da 6 dispositivi diversi su 11 touchpoint prima di decidere di acquistare. GA4 li registra come 4 utenti diversi, CRM come 2 lead diversi, la piattaforma email come 1 subscriber. In un mondo senza cookie questa frammentazione rende l'attribution impossibile, la segmentazione priva di senso, il calcolo del customer lifetime value inaffidabile. Identity resolution è la disciplina di data engineering che unisce questi frammenti — richiede un'architettura a 3 livelli che va dall'hash matching deterministico al probabilistic linking.

## Hash Matching: Colonna Vertebrale Identificativa Deterministica

L'abbinamento deterministico funziona su hash SHA-256. L'indirizzo email "user@example.com" → hash "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8" → se lo stesso hash esiste in ogni sistema, è la stessa persona. Aggiungi il parametro `user_data.email_sha256` al payload dell'evento nel GTM lato server nel momento in cui l'utente effettua il login, e in BigQuery questo hash unisce web session + lead CRM + subscriber Klaviyo in un'unica riga.

Due punti critici: strategia di salt e rischio di collisione. Se calcoli l'hash senza salt, esisti il rischio di attacco rainbow table, ma nella pipeline dati di marketing il salt deve essere coerente in ogni sistema altrimenti la stessa email genera hash diversi. Il rischio di collisione in SHA-256 è teorico — nello spazio 2^256 le collisioni pratiche non esistono, ma in campi a bassa entropia come il numero di telefono il determinismo si indebolisce. Ecco perché la combinazione email + telefono crea un'omatura più solida.

Quando estrai i dati da Klaviyo a BigQuery, aggiungi la colonna `user_properties.email_sha256` e nel modello dbt esegui `LEFT JOIN web_events USING (email_sha256)`. In questo modo una web session anonima e il profilo del subscriber confluiscono in un'unica riga. La strategia della snapshot table è fondamentale — gli abbinamenti hash devono stare in snapshot giornalieri perché quando un utente cambia email, gli abbinamenti passati non vanno persi.

## Probabilistic Linking: Fuzzy Logic per Unire Segnali

L'abbinamento deterministico risulta insufficiente nel web mobile senza cookie. L'utente si disconnette senza fornire email, ma la combinazione IP + user agent + timezone + lingua corrisponde al 87% di probabilità alla stessa persona. Qui entra in gioco il probabilistic identity graph — ponderi i segnali con la probabilità bayesiana.

Ci sono sei strati di segnali fondamentali: device fingerprint (hash canvas, renderer WebGL), network layer (IP subnet, ASN), behavioral pattern (durata sessione, sequenza percorso), geolocalizzazione (clustering lat/long GPS), segnale temporale (pattern ore attive) e metadati contestuali (dominio referrer, coerenza UTM). Ogni segnale riceve un confidence score 0-100, e se il totale ponderato supera 70 assegni un `probabilistic_id` temporaneo.

In BigQuery lo modelli così:

```sql
WITH signal_scores AS (
  SELECT
    session_id,
    device_fingerprint,
    ip_subnet,
    SUM(
      CASE WHEN device_fingerprint_match THEN 40 ELSE 0 END +
      CASE WHEN ip_subnet_match AND hour_diff < 4 THEN 25 ELSE 0 END +
      CASE WHEN behavior_vector_similarity > 0.8 THEN 20 ELSE 0 END
    ) AS total_confidence
  FROM event_stream
  WHERE timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
)
SELECT session_id, device_fingerprint, total_confidence,
  CASE WHEN total_confidence >= 70 
    THEN GENERATE_UUID() 
    ELSE NULL 
  END AS probabilistic_id
FROM signal_scores
```

Il trade-off di questo approccio è il rischio di falsi positivi — il device condiviso (computer ufficio) o l'uso di VPN possono unire persone diverse. Per questo i probabilistic ID devono sempre essere validati con l'hash deterministico — quando l'utente esegue il login, un'operazione di "merge" sull'hash corregge tutte le sessioni probabilistiche precedenti.

## Household Identity: Dall'Insieme di Dispositivi all'Unità Domestica

L'unità decisionale non è l'individuo ma la famiglia. Dallo stesso IP ci sono 3 dispositivi: MacBook (mattina – donna), iPhone (tutto il giorno), iPad (sera – bambino). Unirli in un'unica "persona" è sbagliato ma raggrupparli come "household" è critico per la segmentazione — specialmente per i beni durevoli (elettrodomestici, mobili) dove la decisione di acquisto è familiare.

Il graph household si costruisce su indirizzo MAC del router/modem + subnet IP + ubicazione GPS. Si basa sul network fingerprint, non sul device fingerprint, perché il router WiFi fornisce lo stesso MAC gateway su ogni dispositivo. Qui il filtro pubblico WiFi è critico — se raggruppi 200 dispositivi dallo stesso IP Starbucks come "household" il modello crolla. Lo filti con un session count threshold (stesso IP > 50 device unici → blacklist) e dwelling time pattern (stesso IP senza sessioni >2 ore → retail/caffetteria).

In BigQuery assegni l'household ID così:

```sql
CREATE OR REPLACE TABLE households AS
WITH network_clusters AS (
  SELECT ip_subnet, router_mac, GPS_lat, GPS_long,
    APPROX_COUNT_DISTINCT(device_id) AS device_count,
    AVG(session_duration_sec) AS avg_session
  FROM sessions
  WHERE DATE(timestamp) > DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY 1,2,3,4
  HAVING device_count BETWEEN 1 AND 8 AND avg_session > 120
)
SELECT *, GENERATE_UUID() AS household_id
FROM network_clusters
```

A livello household il lifetime value è più significativo perché l'acquisto di un elettrodomestico non è una decisione individuale ma familiare. [CDP & Retention Engineering](https://www.roibase.com.tr/it/retention-engineering-cdp) mostrano che i segment household generano il 23% di ROAS in più — perché inviare messaggi da un solo numero di telefono a dispositivi diversi è inefficiente rispetto a una strategia di unità domestica coesa.

## Graph Stitching: Unione Identitaria nel Tempo

L'identity graph non è statico — l'utente oggi è anonimo, domani fornisce email, fra 5 giorni fa login, fra 2 mesi aggiorna il numero di telefono. Ogni nuovo segnale fa sì che i frammenti passati "stitch" — i probabilistic ID vecchi si uniscono al nuovo hash deterministico.

Lo risolvi con architettura event-driven: ogni evento `user_identified` cade in Pub/Sub, un Cloud Function si attiva, uno statement MERGE gira in BigQuery. Ad esempio quando l'utente fa login arriva l'email hash, tutti i probabilistic ID degli ultimi 90 giorni con lo stesso device fingerprint si collegano a questo hash. Questo backfill deve retrocedere fino alla finestra di conversione — se hai una finestra di 30 giorni devi stitch all'indietro di 30 giorni.

```sql
MERGE INTO unified_identity AS target
USING (
  SELECT probabilistic_id, email_sha256, MAX(timestamp) AS last_seen
  FROM identification_events
  WHERE event_name = 'user_login'
  GROUP BY 1,2
) AS source
ON target.probabilistic_id = source.probabilistic_id
WHEN MATCHED THEN UPDATE SET 
  target.email_sha256 = source.email_sha256,
  target.is_deterministic = TRUE,
  target.stitched_at = CURRENT_TIMESTAMP()
```

Lo stitching porta il rischio di race condition — se lo stesso utente fa login contemporaneamente da 2 dispositivi due merge concorrenti potrebbero scontrarsi. Lo risolvi con transaction lock o idempotency key. L'idempotency key di solito è `device_id + timestamp_truncato_al_secondo` — due eventi `user_login` della stessa decina di secondi dallo stesso dispositivo vengono conteggiati come un'unica operazione di merge.

## Privacy + Compliance: PII Hasherato e Minimizzazione Dati

Identity resolution rientra nella categoria "automated decision making" e "profiling" secondo KDPO e GDPR — non può avvenire senza consenso esplicito. Se il segnale di `analytics_storage=granted` non arriva dalla Consent Management Platform (OneTrust, Cookiebot) non puoi nemmeno recuperare l'hash. In Consent Mode v2 con solo consenso di base il parametro `user_data` rimane vuoto, dopo il consenso potenziato aggiungi l'hash.

L'hash non è PII ma pseudonimizzazione — significa che secondo GDPR il "diritto all'oblio" richiede l'eliminazione anche degli hash. In BigQuery quando arriva una deletion request esegui uno statement DELETE su `email_sha256` e questa cancellazione deve propagarsi anche ai sistemi downstream (CDP, CRM). Per questo la mappatura hash deve essere centralizzata — hash non deve stare sparso in sistemi distribuiti ma derivare da un'unica source of truth.

Il principio di minimizzazione dati limita il graph d'identità a 90 giorni. I probabilistic ID più vecchi di 90 giorni vanno archiviati, solo gli hash deterministici rimangono a lungo termine. È critico sia per compliance sia per i costi — con partition pruning in BigQuery su una finestra rolling di 90 giorni i costi di query calano del 60%.

## Architettura Pipeline Produttiva: Ibrida Batch + Streaming

Una pipeline di identity resolution funziona su due strati: streaming layer (raccolta segnali real-time) e batch layer (stitching notturno). Lo streaming layer è Pub/Sub → Dataflow → BigQuery con write streaming insert e latenza <10 secondi. Il batch layer è una scheduled dbt run alle 04:00 del mattino, quando tutto il graph stitching e clustering household avviene.

Lo streaming layer raccoglie solo segnali — hash matching e probabilistic scoring non stanno qui perché i JOIN complessi in streaming sono costosi. L'evento va a Firestore con unique constraint `event_id` per prevenire scritture duplicate. Lo strato batch legge questi eventi e li trasforma in modello dimensionale in BigQuery. Le macro dbt incatenano generation hash, score calculation e graph merge in un'unica pipeline.

Per il monitoring la metrica di copertura del graph è critica: `identified_users / total_active_users`. Sotto il 40% significa carenza di segnali deterministici — il flusso di login deve essere ottimizzato, i form di lead gen devono focalizzarsi su email capture. Sopra il 75% è una copertura sana. Questa metrica vive come test dbt in `data_tests/identity_coverage.sql` e corre prima di ogni deployment in CI/CD.

Identity resolution è la colonna vertebrale dello stack di marketing moderno. Il mondo senza cookie ha reso l'hash deterministico lo standard aureo, ma da solo non basta — con probabilistic linking e household clustering costruisci un grafo d'identità a 3 livelli. Quando questa pipeline è modellata in BigQuery con dbt, è consapevole del consenso e conforme alla privacy, allora puoi costruire attribution model, strategie di segmentazione e previsioni di lifetime value su un'unica visione coesa del cliente.