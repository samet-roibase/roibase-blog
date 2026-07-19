---
title: "Identity Resolution: Von 6 Signalen zur einheitlichen Kundenidentität"
description: "Hash-Matching, probabilistische Verknüpfung und Household Identity – wie Sie fragmentierte Touchpoints in ein einziges Kundenprofil zusammenführen. Server-Side-Pipeline und praktisches Schema."
publishedAt: 2026-07-19
modifiedAt: 2026-07-19
category: data
i18nKey: data-003-2026-07
tags: [identity-resolution, hash-matching, probabilistic-linking, cdp, first-party-data]
readingTime: 9
author: Roibase
---

Ein Nutzer klickt auf eine Kampagne vom Smartphone, fügt das Produkt auf dem Desktop zum Warenkorb hinzu, kauft im Geschäft ein. Diese drei Signale bedeuten drei verschiedene Identitäten: `device_id`, `cookie_hash`, `email_hash`. Identity Resolution ist die Data-Pipeline, die diese Bruchstücke in ein einheitliches Kundenprofil zusammensetzt. Im Post-Cookie-Zeitalter — Consent Mode v2, iOS ATT, CCPA — ist eine Identity-Architektur auf Basis von serverseitigen First-Party-Daten nicht mehr eine Empfehlung, sondern eine Notwendigkeit.

## Warum es 6 verschiedene Identitätssignale gibt

Der moderne Marketing-Stack erfasst Identitätssignale in sechs Ebenen: **Browser-Cookie**, **Geräte-ID** (IDFA/GAID), **authentifizierter Hash** (Email SHA-256), **Kunden-ID** (CRM/CDP intern), **IP+User-Agent-Fingerprint**, **Household Graph**. Jedes kommt in einer anderen Phase des Lebenszyklus zum Einsatz.

Das Browser-Cookie wird beim ersten Touchpoint gesetzt; die Geräte-ID kommt in der mobilen App zum Einsatz; der authentifizierte Hash wird generiert, wenn eine Email oder Telefonnummer erfasst wird; die Kunden-ID entsteht nach dem Checkout; der Fingerprint wird für probabilistische Matching-Prozesse ohne Consent verwendet; der Household Graph gruppiert Geräte, die vom selben Router aus verbunden sind. Das Problem: Diese sechs Signale lagern in verschiedenen Tabellen, mit unterschiedlichen TTL-Werten (Cookie 90 Tage, IDFA unbegrenzt, Email-Hash bis zur Kundenlöschung). Ohne Resolution zählt jeder Kanal separate Nutzer — in Ihrem Marketing-Mix-Modell entsteht Doppelzählung, in Incrementality-Tests überschätzen Sie den Effekt, bei Retention-Cohorts sieht die Retention künstlich niedrig aus.

Die Resolution-Logik basiert auf zwei Methoden: **Deterministisches Matching (Hash-Matching)** und **probabilistische Verknüpfung (Graph Linking)**. Deterministisch: Der SHA-256-Hash einer Email verknüpft ein Browser-Event mit einer Backend-Transaktion — 100% Sicherheit. Probabilistisch: Wenn die gleiche IP+User-Agent innerhalb von 24 Stunden in zwei verschiedenen Events erscheint, ist die Wahrscheinlichkeit, dass es derselbe Nutzer ist, etwa 73% (Beispiel-Schwellwert). Ohne Resolution ist die Zahl eindeutiger Nutzer um 40-80% überzeichnet (abhängig von Kategorie und Geräte-Mix).

## Hash-Matching: Email und Telefon in Identity-Keys umwandeln

Hash-Matching ist das Rückgrat der serverseitigen Identity Resolution. Wenn der Nutzer eine Email oder Telefonnummer angibt, erzeugt entweder Client-Side oder sGTM einen SHA-256-Hash, dieser wird in die `identity_map`-Tabelle geschrieben. Bei allen nachfolgenden anonymen Events können Sie dann per Cookie oder Geräte-ID den Hash abrufen.

Ein einfaches `identity_map`-Schema:

```sql
CREATE TABLE identity_map (
  canonical_id STRING NOT NULL,      -- UUID, interne ID
  signal_type STRING NOT NULL,       -- 'email_sha256', 'phone_sha256', 'device_id', 'cookie'
  signal_value STRING NOT NULL,      -- Hash oder ID
  first_seen TIMESTAMP,
  last_seen TIMESTAMP,
  PRIMARY KEY (signal_type, signal_value)
);
```

Wenn ein Nutzer `user@example.com` in das Registrierungsformular eingibt, hasht sGTM diese Email mit SHA-256 und führt einen `INSERT` durch: `('uuid-123', 'email_sha256', 'abc123...', NOW(), NOW())`. Falls in derselben Session das Cookie `_ga=GA1.1.xyz` vorhanden ist, folgt eine zweite Zeile: `('uuid-123', 'cookie', 'GA1.1.xyz', NOW(), NOW())`. Damit sind zwei Signale unter `canonical_id = uuid-123` zusammengefasst.

In der nächsten Session kommt der Nutzer nur mit `_ga=GA1.1.xyz`, ohne Email-Eingabe. Ein Lookup in BigQuery:

```sql
SELECT canonical_id
FROM identity_map
WHERE signal_type = 'cookie' AND signal_value = 'GA1.1.xyz'
LIMIT 1;
```

Rückgabe: `uuid-123`. Sie binden das Event an diese ID — derselbe Nutzer wird erkannt, ohne dass ein Email-Hash verwendet wurde. Die Genauigkeit von Hash-Matching liegt bei 100%, da Hash-Kollisionen kryptographisch unmöglich sind. Es gibt aber ein Coverage-Problem: Wenn der Nutzer keine Email angegeben hat, existiert kein Hash, dann wechseln Sie zum probabilistischen Verfahren.

### Collision-Risiko und Salt

Das SHA-256-Collision-Risiko ist theoretisch: 1 in 2^128 Versuchen. In der Praxis ist das eigentliche Problem jedoch, dass **dieselbe Email an mehrere `canonical_id`s gebunden sein kann** (manueller Fehler, alte Migration-Artefakte). Deshalb nutzen Sie einen `UNIQUE INDEX (signal_type, signal_value)`. Die Verwendung von Salt (Email + geheime Zeichenkette, dann Hash) erhöht das Collision-Risiko nicht, bietet aber in der [First-Party-Daten-Architektur](https://www.roibase.com.tr/de/firstparty) eine zusätzliche Privacy-Schicht — bei Salt-Rotation werden alte Hashes ungültig, was für GDPR „Right to be Forgotten" nützlich ist.

## Probabilistische Verknüpfung: IP, User-Agent und Device Graph

Wenn der Nutzer im Incognito-Modus surft, gibt es kein deterministisches Signal. In diesem Fall nutzen Sie einen **probabilistischen Graph**: IP + User-Agent + Zeitstempel-Nähe generiert einen „vermutlich derselbe Nutzer"-Score. Beispiel: Zwei Events von derselben IP mit demselben User-Agent im Abstand von 15 Minuten — wahrscheinlich zu 85% derselbe Nutzer.

Einfache probabilistische Merge-Logik:

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

Diese Abfrage gruppiert Events nach IP+UA-Hash innerhalb von 24 Stunden. Die Cluster-ID verwenden Sie als temporäre `canonical_id`, ergänzt um einen Confidence-Score: `event_count > 3 AND time_span < 1 HOUR → confidence=0.9`.

**Household Graph:** Wenn von derselben IP verschiedene User-Agents (Laptop, Tablet, Smartphone) kommen, ist es wahrscheinlich das gleiche Zuhause. Hier erstellen Sie eine `household_id` und ordnen die einzelne `canonical_id` darunter ein. Beispiel Amazon Prime Household: 1 Abonnement, 6 Profile — Identity Resolution aggregiert auf Household-Ebene.

### False-Positive-Rate

Beim probabilistischen Linking besteht ein False-Positive-Risiko. Die gleiche IP+User-Agent kann von zwei verschiedenen Nutzern kommen (Büro-WLAN, Bibliothek). Ist der Schwellwert zu locker (%50 Confidence), sehen Sie 15-25% False Positives. Best Practice der Industrie: Confidence-Schwellwert ≥75%, Time Window 1 Stunde, mindestens 2 Event-Matches. Anbieter wie LiveRamp nutzen Graph-Datenbanken (Neo4j) und kombinieren 30+ Signale mit Behauptungen von %95+ Genauigkeit — doch in einer eigenen First-Party-Pipeline reichen 2-3 Signale mit %80 Genauigkeit aus.

## Server-Side-Pipeline: sGTM + BigQuery + dbt

Die Identity Resolution läuft in der Production in folgendem Datenfluss:

1. **sGTM-Event-Erfassung:** Client-Side GTM sendet Event an sGTM, sGTM hasht Email falls vorhanden mit SHA-256, schreibt Raw Event in BigQuery (`events_raw`).
2. **dbt-Staging-Modell:** Die `stg_events`-Tabelle erzeugt bereinigte Events aus `events_raw`, spaltet Spalten `signal_type` und `signal_value` auf.
3. **dbt-Identity-Map-Merge:** Wenn ein neuer Hash auftaucht, wird ein `MERGE` in `identity_map` ausgeführt (Upsert-Logik).
4. **dbt-Canonical-ID-Anreicherung:** Jedes Event wird mit `identity_map` verknüpft, `canonical_id` wird per Lookup aufgelöst.
5. **dbt-Aggregation:** Metriken auf User-Ebene (`user_ltv`, `session_count`) werden nach `canonical_id` aggregiert.

Beispiel-dbt-Modell-Auszug (`models/staging/stg_events.sql`):

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

Das Incremental Model läuft stündlich und verarbeitet den letzten Batch. Die Identity-Merge-Logik liegt in einem separaten Modell (`models/core/fct_identity_resolved.sql`):

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

Diese Join-Logik führt das deterministischen Hash-Matching durch. Für das probabilistische Verfahren fügen Sie ein separates Modell `fct_probabilistic_clusters` hinzu.

## Consent und Datenschutz: GDPR und CCPA-Konformität

Identity Resolution unterliegt GDPR Artikel 6 (lawful basis) und CCPA „do not sell"-Regeln. Der Email-Hash wird als **personenbezogenes Datum** eingestuft (CJEU-Entscheidung 2019), deshalb brauchen Sie Consent oder ein berechtigtes Interesse.

Unter Consent Mode v2: Wenn der Nutzer `analytics_storage=denied` setzt, dürfen Sie keinen Email-Hash sammeln. In diesem Fall nutzen Sie nur IP+UA-Fingerprint (im Rahmen „berechtigtes Interesse" — doch die CJEU-Auslegung ist umstritten). Best Practice: Kolonne `consent_status` in `identity_map` hinzufügen und den Hash nur aus `analytics_storage=granted`-Events schreiben.

Für GDPR „right to delete" benötigen Sie eine Lösch-Logik auf Basis `canonical_id`:

```sql
DELETE FROM identity_map WHERE canonical_id = 'uuid-123';
DELETE FROM events WHERE canonical_id = 'uuid-123';
```

Für Cascade-Löschung nutzen Sie Foreign-Key-Constraints (BigQuery unterstützt diese nicht nativ, aber Postgres/Snowflake schon). Alternativ: Soft Delete (`deleted_at TIMESTAMP`) und später Batch-Purge.

### TCF 2.2 Vendor-Mapping

Unter IAB TCF 2.2 fällt Identity Resolution unter „Purpose 1 — Store and/or access information on a device". Hat der Nutzer Ihren Vendor in der Liste nicht genehmigt, darf keine Cross-Device-Verknüpfung stattfinden. In Roibase-Projekten parsen wir die TCF-String in BigQuery und schreiben den Parse-Ergebnis in eine Kolonne `vendor_consent`, dann filtern wir beim Identity-Merge:

```sql
WHERE vendor_consent LIKE '%vendor_id=123%'
```

Diese Logik verhindert, dass Sie ohne Consent Identity-Graph aufbauen — ein Gleichgewicht zwischen Compliance und Datenqualität.

## CDP-Integration: Segment, mParticle, Rudderstack

Moderne CDPs bieten ihre eigenen Identity-Graphen an, aber oft sind diese eine Black Box. Mit einer eigenen Pipeline kontrollieren Sie die Graph-Logik — besonders bei [CDP & Retention Engineering](https://www.roibase.com.tr/de/retention-engineering-cdp) kritisch. Segment's `identify()`-Aufruf mergt `userId` und `anonymousId`, aber welches Signal hat Priorität? In Ihrer eigenen Resolution-Logik setzen Sie eine klare Prioritätsreihenfolge:

1. `customer_id` (CRM) → am zuverlässigsten
2. `email_sha256` → deterministisch
3. `device_id` → Cross-Session, aber nicht Cross-Device
4. `cookie` → kürzeste TTL
5. `fingerprint` → probabilistischer Fallback

Diese Prioritätsreihenfolge kodieren Sie in dbt mit einer `COALESCE()`-Kette. An das CDP senden Sie nur die finale `canonical_id` und `confidence_score`, die