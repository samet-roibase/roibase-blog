---
title: "Identity Resolution: Da 6 Segnali a Profilo Cliente Unico"
description: "Architettura tecnica di hash matching, probabilistic linking e household identity per unificare segnali dispersi in un profilo cliente coeso."
publishedAt: 2026-05-31
modifiedAt: 2026-05-31
category: data
i18nKey: data-003-2026-05
tags: [identity-resolution, cdp, first-party-data, probabilistic-matching, hash-matching]
readingTime: 8
author: Roibase
---

Un utente si registra via email, ordina dall'app mobile, il giorno dopo apre una richiesta di supporto dal browser desktop. Cookie ID, device ID, hashed email, IP, session ID, user ID — sei segnali diversi. Senza identity resolution, sembrano sei "clienti" differenti. L'attribuzione pubblicitaria viene calcolata male, il modello LTV resta distorto, il segnale di retention va perso. User ID merge di Google Analytics 4 unisce solo le sessioni autenticate, non il comportamento anonimo. I CDP promettono "probabilistic stitching" ma non mostrano le strutture dati sottostanti. Per portare un identity graph in production, hai bisogno di hash matching, probabilistic linking e household identity che lavorino insieme.

## Hash Matching: L'Omero della Fusione Deterministica

Hash matching crea una connessione "certa" tra due segnali abbinando gli hash SHA-256 dello stesso indirizzo email o numero di telefono. Quando l'utente si registra sul sito web inviando `user@example.com`, hash il valore con SHA-256 e scrivilo nella tabella `identity_signals` di BigQuery come colonna `hashed_email`. Quando lo stesso indirizzo email accede dall'app mobile, l'hash sarà identico e potrai unire i due record.

```sql
-- Esempio di match deterministico in BigQuery
CREATE OR REPLACE TABLE `project.dataset.merged_identities` AS
SELECT
  web.anonymous_id AS web_cookie_id,
  mobile.device_id AS mobile_device_id,
  web.hashed_email,
  MIN(web.first_seen_timestamp) AS first_seen
FROM `project.dataset.web_events` web
INNER JOIN `project.dataset.mobile_events` mobile
  ON web.hashed_email = mobile.hashed_email
WHERE web.hashed_email IS NOT NULL
GROUP BY 1,2,3;
```

La query unisce il cookie ID web con il device ID mobile attraverso l'hashed email. L'`INNER JOIN` è deterministico — arrivano solo i match certi. Per consolidare i segnali abbinati sotto un unico `canonical_user_id`, usa `ROW_NUMBER()` o UUID generation. Il limite dell'hash matching: se l'utente cambia email (vecchio account + nuovo account), rimangono due identity separate. Qui entra in gioco il layer probabilistico.

Hash matching è conforme a GDPR e KVKK perché non memorizzi l'email in chiaro — l'hash è unidirezionale e non reversibile. Tuttavia è vulnerabile agli attacchi di rainbow table, quindi accanto agli hash email aggiungi segnali secondari come device fingerprint o IP range. Una singola colonna hash non è sufficiente — mantieni `hashed_email`, `hashed_phone`, `hashed_customer_id` come colonne separate. Particiona la tabella per `DATE(timestamp)` — l'identity resolution è generalmente incrementale e uno scan full history è costoso.

## Probabilistic Linking: Gestire l'Incertezza con i Punteggi

Se l'utente naviga senza registrarsi, non c'è hashed email — hai cookie ID, IP, user agent, timestamp della sessione. Il matching probabilistico assegna una "probabilità di essere la stessa persona" a questi segnali ponderandoli. Se il punteggio supera una soglia (ad es. 0.85), unisci i due record; se è inferiore, mantienili separati. Vendor come LiveRamp, Merkle e Neustar vendono questi punteggi, ma puoi costruire un modello basato su regole nel tuo data warehouse.

Logica di esempio: stesso IP + stesso fingerprint browser (canvas hash) + sessione entro 5 minuti → punteggio di corrispondenza 90%. Stesso IP + browser diverso + differenza di 2 ore → punteggio 40%. Se la soglia è 0.7, il primo paio si unisce, il secondo no. Puoi modellarlo in BigQuery con blocchi `CASE WHEN`:

```sql
SELECT
  a.session_id AS session_a,
  b.session_id AS session_b,
  CASE
    WHEN a.ip_address = b.ip_address
      AND a.canvas_hash = b.canvas_hash
      AND TIMESTAMP_DIFF(b.timestamp, a.timestamp, MINUTE) <= 5
    THEN 0.90
    WHEN a.ip_address = b.ip_address
      AND TIMESTAMP_DIFF(b.timestamp, a.timestamp, HOUR) <= 2
    THEN 0.40
    ELSE 0.0
  END AS match_score
FROM `project.dataset.anonymous_sessions` a
CROSS JOIN `project.dataset.anonymous_sessions` b
WHERE a.session_id < b.session_id
  AND a.ip_address = b.ip_address
QUALIFY match_score >= 0.70;
```

La query esegue un `CROSS JOIN` — il costo esplode con milioni di righe. In production serve bucketing e window functions: particiona gli IP range per prefisso (ad es. `/24` CIDR), confronta ogni sessione solo con le ultime 100. Il rischio del matching probabilistico è il falso positivo — due utenti diversi dallo stesso IP (Wi-Fi aziendale, VPN condivisa) nello stesso momento potrebbero essere erroneamente uniti. Perciò mantieni la soglia tra 0.85-0.90 e convalida con segnali cross-device.

Un modello probabilistico basato su machine learning è più sofisticato: regressione logistica o gradient boosting per la classificazione binaria "stesso utente". Feature set: distanza Hamming dell'IP, somiglianza Levenshtein dello user agent, offset timezone, conteggio sessioni. I dati di training sono etichettati — esempi positivi dalle coppie di `user_id` noti, esempi negativi da `user_id` diversi. Il modello restituisce un punteggio 0-1, la soglia rimane un tuning manuale. Costruire questo richiede una pipeline Vertex AI o Sagemaker — data engineering + ML engineering lavorano insieme.

## Household Identity: Stesso Tetto, Utenti Diversi

Nel layer di household identity dell'identity resolution: raggruppi gli utenti diversi dallo stesso IP o indirizzo fisico e li tratti come "unità familiare" per il targeting di marketing. Ad esempio, su un sito di e-commerce, la mamma guarda abbigliamento per bambini e il papà compra elettronica — due user ID diversi ma stesso indirizzo di spedizione. Il household graph li unisce sotto un `household_id`. Su piattaforme pubblicitarie (Facebook Ads, Google Ads) questo si chiama household targeting, ma devi modellarlo nei tuoi first-party data.

Normalizza l'indirizzo di spedizione in BigQuery: rimuovi maiuscole/minuscole, spazi, variazioni nel numero dell'appartamento. Poi esegui l'hash e usalo come `household_key`:

```sql
CREATE OR REPLACE TABLE `project.dataset.household_mapping` AS
SELECT
  user_id,
  TO_HEX(SHA256(
    LOWER(REGEXP_REPLACE(CONCAT(street, city, postal_code), r'\s+', ''))
  )) AS household_key
FROM `project.dataset.user_addresses`
WHERE street IS NOT NULL AND postal_code IS NOT NULL;
```

Questa tabella fornisce il mapping `user_id` → `household_key`. Raggruppa gli utenti con lo stesso `household_key` e assegna loro un `household_id`. L'household identity differisce dall'identity cross-device — non sono i dispositivi di una stessa persona, sono le persone della stessa casa. Il rischio privacy è alto: unire due adulti sotto lo stesso household può violare il principio di minimizzazione dei dati (KVKK art. 5). Usa il graph household solo per analisi aggregate e targeting anonimo, non per consolidamento di profili individuali.

Aggiungi segnali al graph household: hash SSID Wi-Fi (se l'app mobile ha il permesso), Bluetooth beacon (nei negozi fisici), metodo di pagamento condiviso (stessa carta di credito). Questi segnali sono PII e richiedono storage hash + crittografato. I sistemi CDP (Segment, mParticle, RudderStack) offrono resolution household come "relationship graph", ma costruendo il modello manualmente in BigQuery ottieni maggior controllo — vedi quale segnale ha quale peso. La ricerca [CDP & Retention Engineering](https://www.roibase.com.tr/it/retention-engineering-cdp) di Roibase integra questo layer nella pipeline di produzione.

## Graph Database vs Relational: Quale è Più Veloce

Puoi mantenere il graph identity in BigQuery come data warehouse relazionale, ma interrogare le catene "A → B → C" (closure transitiva) è costoso. Un graph database (Neo4j, Amazon Neptune, TigerGraph) lo fa in una struttura nodo/arco — la query "trova tutti i dispositivi dell'utente X" con `MATCH (u:User)-[:HAS_DEVICE]->(d:Device)` restituisce in millisecondi. In BigQuery la stessa query richiede `RECURSIVE CTE` o `ARRAY_AGG` e il consumo di slot cresce su tabelle grandi.

Trade-off: il graph database è velocissimo ma lo schema è fragile, il modello nodo/edge è diverso dalla sintassi SQL familiare. Il warehouse relazionale è più lento ma con dbt il version control, i test e la documentazione sono semplici. La maggior parte dei deployment di produzione usa un approccio ibrido: crea la tabella identity mapping con batch giornaliero in BigQuery via dbt, sincronizzala in Neo4j, esegui lookup real-time da Neo4j. Pipeline esempio: modello dbt → view BigQuery → Cloud Function trigger → Neo4j Cypher INSERT.

```sql
-- BigQuery recursive CTE per closure transitiva (lento)
WITH RECURSIVE identity_chain AS (
  SELECT signal_a, signal_b, 1 AS depth
  FROM `project.dataset.identity_edges`
  UNION ALL
  SELECT ic.signal_a, e.signal_b, ic.depth + 1
  FROM identity_chain ic
  JOIN `project.dataset.identity_edges` e
    ON ic.signal_b = e.signal_a
  WHERE ic.depth < 5
)
SELECT DISTINCT signal_a, signal_b
FROM identity_chain;
```

La query traccia catene fino a 5 passi (depth) al massimo. Senza controllo depth c'è rischio di ciclo infinito — se A → B → A esiste un loop. Il graph database gestisce i cicli built-in, BigQuery richiede una WHERE condition manuale. Se il graph identity raggiunge 10M+ edge, un sistema dedicato come Neo4j è più mantenibile. Sotto 1M edge, BigQuery + dbt è sufficiente.

## Privacy e Consenso: I Confini Legali del Graph Identity

L'identity resolution rientra nella definizione di "profiling" secondo GDPR art. 4(4). Senza consenso esplicito dell'utente, linking deterministico + probabilistico è un rischio legale. Consent Mode v2 (Google) separa "analytics_storage" e "ad_storage" ma la stitching identity potrebbe richiedere una categoria "personalization_storage" aggiuntiva. In TCF 2.2, hai bisogno di Purpose 1 (device storage) + Purpose 9 (personalized ads) — senza entrambi, anche l'hash matching è illegittimo.

L'email hashata resta "dati pseudonimici" secondo GDPR (Considerando 26) — rimane dato personale. Se si può ricavare il plaintext tramite rainbow table o reverse lookup, non è "anonimizzazione" ma "pseudonimizzazione". Aggiungi salt agli hash (email + secret site-specific → SHA-256) e conserva il salt in HSM (Hardware Security Module) o Secret Manager. Se l'utente richiede "unlinking" (GDPR art. 18 restriction), elimina l'edge dal graph identity e spezza la connessione deterministica.

KVKK art. 7 richiede "consenso esplicito": "Il consenso relativo al trattamento dei dati personali deve essere specifico, informato e basato sulla libera volontà." L'stitching identity deve essere scritto esplicitamente nel modulo di consenso — frasi generiche come "migliore esperienza" non bastano. Se l'utente revoca il consenso (flag `consent_revoked_at` timestamp), elimina tutti gli edge dal graph per quel `user_id` e contrassegna `deleted_at`. In BigQuery puoi fare soft delete — invece della cancellazione fisica, applica il filtro `WHERE deleted_at IS NULL`.

## Applicazione: Pipeline Identity Incrementale con dbt

In produzione l'identity resolution non è batch una volta, ma incrementale — aggiungi quotidianamente nuovi segnali, aggiorna il graph esistente. Puoi farlo con un modello incrementale dbt:

```sql
{{
  config(
    materialized='incremental',
    unique_key='edge_id',
    partition_by={'field': 'created_date', 'data_type': 'date'},
    cluster_by=['signal_a_type', 'signal_b_type']
  )
}}

WITH new_edges AS (
  SELECT
    GENERATE_UUID() AS edge_id,
    a.signal_id AS signal_a,
    a.signal_type AS signal_a_type,
    b.signal_id AS signal_b,
    b.signal_type AS signal_b_type,
    0.95 AS match_score,
    CURRENT_DATE() AS created_date
  FROM {{ ref('stg_hashed_emails') }} a
  JOIN {{ ref('stg_device_ids') }} b
    ON a.hashed_email = b.hashed_email
  WHERE a.created_at >= CURRENT_DATE() - 1
)

SELECT * FROM new_edges

{% if is_incremental() %}
WHERE edge_id NOT IN (SELECT edge_id FROM {{ this }})
{% endif %}
```

Ad ogni esecuzione il modello aggiunge gli ultimi 1 giorno di nuovi abbinamenti email-device. `unique_key` previene i duplicati, `partition_by` non tocca le partition precedenti. Cluster per `signal_type` perché le query sono generalmente filtrate per tipo — "tutti gli abbinamenti email→cookie". Monitora con test dbt: se esiste un edge con `match_score < 0.70`, il test fallisce e il deploy si arresta.

Una pipeline identity senza data quality test non va in produzione — gli abbinamenti sbagliati corrompono il calcolo LTV, il modello di attribuzione, la segmentazione. La ricerca [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/it/firstparty) di Roibase integra questa pipeline con consent layer, server-side GTM e CDP.

Poi arriva il downstream: segment builder, recommendation engine, LTV prediction, MMM — tutti leggono `canonical_user_id` per aggregare metriche. Se il graph è costruito correttamente, consolidi 6 segnali in 1 utente e guadagni **+30-40% precision su LTV**, **+25% finestra di attribuzione** (benchmark GA4, 2