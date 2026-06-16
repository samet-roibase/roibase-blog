---
title: "Identity Resolution: Da Sei Segnali a Un'Identità Cliente Unica"
description: "Hash matching, probabilistic linking e household identity per unificare segnali cliente frammentati in un'identità unica. Ingegneria con BigQuery + CDP."
publishedAt: 2026-06-16
modifiedAt: 2026-06-16
category: data
i18nKey: data-003-2026-06
tags: [identity-resolution, customer-data-platform, hash-matching, probabilistic-linking, first-party-data]
readingTime: 9
author: Roibase
---

La durata dei cookie è calata da una media di 28 giorni a 7 giorni. Un utente inizia su mobile app, paga su web desktop, ritorna da una campagna email — ogni touchpoint genera un identificatore diverso. Il 40% dei dati di marketing rimane come evento orfano: senza user ID, senza session ID, senza attribuzione di conversione. Identity resolution è l'operazione che unisce questi frammenti con disciplina ingegneristica. Non supposizioni, ma hash matching; non intuizioni, ma grafo probabilistico; non ipotesi, ma clustering domestico.

## Deterministic Matching: Unificazione Basata su Hash

Il deterministic match funziona quando **conosci con certezza che due datapoint condividono lo stesso identificatore**. Hash SHA-256 di un'email, hash di un numero di telefono, CRM ID. Se la tabella di eventi in BigQuery contiene `user_id` ma Google Analytics contiene `ga_client_id`, non puoi fare un JOIN diretto — devi prima trovare un evento ponte dove entrambi sono registrati, poi costruire una tabella di mapping.

```sql
-- Esempio di stitching identity deterministica
CREATE OR REPLACE TABLE `project.dataset.identity_graph` AS
WITH email_hashes AS (
  SELECT DISTINCT
    user_pseudo_id,
    TO_HEX(SHA256(LOWER(TRIM(user_properties.email.value)))) AS email_hash
  FROM `project.dataset.events_*`
  WHERE user_properties.email.value IS NOT NULL
),
crm_map AS (
  SELECT
    crm_id,
    TO_HEX(SHA256(LOWER(TRIM(email)))) AS email_hash
  FROM `project.crm.customers`
)
SELECT
  e.user_pseudo_id,
  c.crm_id,
  e.email_hash
FROM email_hashes e
INNER JOIN crm_map c
  ON e.email_hash = c.email_hash;
```

Questa query collega il `user_pseudo_id` proveniente da Firebase Analytics con il `crm_id` nel CRM attraverso **matching esatto** basato su hash email. L'hash email funge da identificatore anchor. Dettaglio critico: `LOWER(TRIM())` — se un utente scrive "Ali@X.com" ma il CRM lo memorizza come "ali@x.com", l'hash match si rompe. Ecco perché la normalizzazione è il primo passo della pipeline.

Il deterministic match ha precision del 100%, ma recall basso — cattura solo i record che hanno lo stesso identificatore in entrambi i sistemi. Un utente che esce dal web senza fornire un'email non entra in questo grafo.

### Hash Collision e Privacy

La probabilità di SHA-256 collision è teoricamente 2^-256 — negligibile in pratica. Tuttavia, GDPR Articolo 32 non equipara la pseudonimizzazione a un semplice hash; l'hash da solo non è anonimizzazione. La combinazione email hash + IP + timestamp consente la re-identificazione. Per questo motivo, le tabelle di hash devono essere protette con encryption-at-rest e column-level access control.

## Probabilistic Linking: Matching Probabilistico Basato su Grafo

Quando il deterministic join fallisce, entra in gioco il probabilistic matching. Unisci due record con identificatori diversi in base a **somiglianza comportamentale**, **device fingerprint**, **timezone + user-agent** e altri segnali deboli. Non è un modello di machine learning — un sistema di scoring ponderato + soglia è sufficiente.

| Segnale | Peso | Esempio |
|---------|------|---------|
| Stesso IP (entro 24 ore) | 0.3 | 192.168.1.10 |
| Stesso User-Agent | 0.2 | Chrome 120 / Mac |
| Stessa posizione geografica | 0.15 | Istanbul, Kadıköy |
| Stesso click da campagna | 0.25 | utm_campaign=spring_sale |
| Stessa sequenza di visualizzazione prodotto | 0.1 | product_123 → product_456 |

Score totale ≥ 0.7 significa che le due session sono **probabilmente** della stessa persona. Questa soglia si regola in base al dataset — in e-commerce 0.65 può bastare, in fintech serve 0.85.

```sql
-- Esempio di scoring probabilistico
WITH sessions AS (
  SELECT
    session_id,
    user_pseudo_id,
    device.operating_system,
    device.web_info.browser,
    geo.city,
    traffic_source.medium,
    ARRAY_AGG(ecommerce.items.item_id ORDER BY event_timestamp) AS item_sequence
  FROM `project.dataset.events_*`
  WHERE event_name = 'page_view'
  GROUP BY 1,2,3,4,5,6
)
SELECT
  a.session_id AS session_a,
  b.session_id AS session_b,
  (CASE WHEN a.operating_system = b.operating_system THEN 0.2 ELSE 0 END +
   CASE WHEN a.browser = b.browser THEN 0.2 ELSE 0 END +
   CASE WHEN a.city = b.city THEN 0.15 ELSE 0 END +
   CASE WHEN a.medium = b.medium THEN 0.25 ELSE 0 END +
   CASE WHEN a.item_sequence = b.item_sequence THEN 0.2 ELSE 0 END
  ) AS match_score
FROM sessions a
CROSS JOIN sessions b
WHERE a.session_id < b.session_id  -- ottimizzazione self-join
  AND a.user_pseudo_id != b.user_pseudo_id
HAVING match_score >= 0.7;
```

Questa query confronta **tutte le coppie di session** — complessità N². Con 1M session, sono 500 miliardi di confronti. In produzione serve partitioning: finestra temporale (7 giorni), filtro geografico (stessa città), tipo device (mobile-mobile).

Il probabilistico ha false positive del 5-15%. Per questo in downstream activation (CDP segment push, campagne email) questi ID devono essere marcati come "potential duplicate".

## Household Identity: Stesso Dispositivo, Utenti Diversi

Un tablet o Smart TV è usato da più persone. Il deterministic e probabilistic matching qui collasserebbe profili diversi nella famiglia in un ID unico — causando personalizzazione sbagliata. L'household identity resolution distingue questi scenari.

**Session-level fingerprint:** Utenti diversi su lo stesso dispositivo, in orari diversi, mostrano pattern di navigazione distinti. Chi cerca abbigliamento bambino alle 08:00 è diverso da chi cerca elettronica alle 23:00.

**Behavioral clustering:** K-means o hierarchical clustering raggruppa le session. Se i centroidi del cluster differiscono, crei due "virtual user" distinti sotto lo stesso device_id.

```sql
-- Feature extraction per clustering domestico
CREATE OR REPLACE TABLE `project.dataset.household_features` AS
SELECT
  device_id,
  EXTRACT(HOUR FROM TIMESTAMP_MICROS(event_timestamp)) AS hour_of_day,
  COUNT(DISTINCT CASE WHEN event_name = 'purchase' THEN ecommerce.transaction_id END) AS purchase_count,
  APPROX_TOP_COUNT(ecommerce.items.item_category, 3) AS top_categories,
  AVG(ecommerce.purchase_revenue_in_usd) AS avg_basket_value
FROM `project.dataset.events_*`
WHERE device_id IS NOT NULL
GROUP BY device_id, hour_of_day;
```

Dopo il clustering, per ogni device_id generi virtual ID come `household_user_1`, `household_user_2`. Questi ID rimangono nell'analytics e personalization layer — non vengono sincronizzati con il CRM.

La sensibilità della household resolution è bassa — il 30% di errore è normale. Per questo motivo non si usa al di fuori dell'e-commerce (specialmente SaaS e fintech).

## Struttura del Grafo Identitario e Mantenimento

Tutti i risultati di matching confluiscono in una **tabella identity graph** unica. Questa tabella contiene, per ogni user_id, tutti gli alias noti: email hash, CRM ID, ga_client_id, Firebase ID, advertising ID.

| canonical_id | identifier_type | identifier_value | match_method | confidence | updated_at |
|--------------|-----------------|------------------|--------------|------------|------------|
| user_0001 | email_hash | a1b2c3... | deterministic | 1.0 | 2026-06-15 |
| user_0001 | ga_client_id | GA1.2.123 | deterministic | 1.0 | 2026-06-14 |
| user_0001 | firebase_id | xyz789 | probabilistic | 0.75 | 2026-06-16 |
| user_0002 | crm_id | CRM-456 | deterministic | 1.0 | 2026-06-10 |

Il grafo si aggiorna incrementalmente — ogni giorno vengono scansionati i nuovi event, si aggiungono nuovi match. I link vecchi si indeboliscono con confidence decay: un link probabilistico di 90 giorni fa scende da confidence 0.75 a 0.50.

Se modelliamo il grafo come **directed acyclic graph (DAG)**, possiamo rilevare cicli. Una sequenza User A → User B → User C → User A è un segnale di errore nei dati — richiede revisione manuale.

## Integrazione CDP e Pipeline di Activation

L'identity graph da solo non è utile — viene alimentato in una CDP. L'architettura della [CDP e Retention Engineering](https://www.roibase.com.tr/it/retention-engineering-cdp) prende il canonical_id dal grafo, unifica tutti i touchpoint sotto questo ID e lo invia al segment engine.

Il processo di activation funziona così:

1. **Segment definition:** "3+ session negli ultimi 30 giorni, item aggiunto al carrello ma nessun acquisto" → viene definito come view di BigQuery.
2. **Identity resolution:** La view esegue un lookup del canonical_id per ogni user_pseudo_id.
3. **Channel sync:** Tutti gli email hash sotto il canonical_id vengono inviati a Meta CAPI, tutti i phone hash a Google Customer Match.
4. **Attribution:** Quando arriva un event di conversione, il canonical_id traccia all'indietro tutti i touchpoint nel grafo.

Senza una CDP, l'identity resolution rimane incompleta — il grafo sa solo "chi è collegato a chi", non "quali azioni intraprendere".

## Compliance Privacy e Propagazione del Consenso

L'identity resolution può essere legittimata con GDPR Articolo 6(1)(f) "legitimate interest" — tuttavia, se l'utente non ha dato consenso esplicito, non puoi usare i dati derivati da questo grafo per il remarketing. L'integrazione con una Consent Management Platform (CMP) è obbligatoria.

Per ogni canonical_id viene conservato lo stato del consenso: `{ analytics: true, marketing: false, personalization: true }`. Gli identificatori derivati dal grafo ereditano questo flag — se User A ha marketing=false, allora il ga_client_id di User B che è collegato a User A probabilisticamente non entra nei segment di marketing.

Sotto TCF 2.2 la propagazione del vendor consent è più complessa: utenti che hanno consentito a Meta ma non a Google richiedono sync selettivo nel grafo. Questa architettura fa parte del processo [First-Party Data & Architettura di Misurazione](https://www.roibase.com.tr/it/firstparty) — i segnali di consenso vengono iniettati nel data pipeline fin dall'inizio, e i job di aggiornamento del grafo li leggono.

---

L'identity resolution non è una semplice operazione di JOIN — è lo strato critico che connette i dati di marketing al motore decisionale. Risolvere gli exact match con hash, i segnali deboli con scoring probabilistico, la condivisione di dispositivi con clustering domestico richiede precisione ingegneristica. Mantenere il grafo aggiornato, allinearlo alla propagazione del consenso, alimentare la pipeline di activation CDP — questa è la parte production della disciplina. Nell'era senza cookie, l'identità del cliente non viene ipotizzata — viene costruita unificando sei identificatori diversi.