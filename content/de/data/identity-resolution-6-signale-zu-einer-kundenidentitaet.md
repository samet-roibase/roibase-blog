---
title: "Identity Resolution: 6 Signale zu einer Kundenidentität"
description: "Hash-Matching, probabilistische Verknüpfung und Household Identity – die technische Architektur zur Konsolidierung fragmentierter Signale in einem einzigen Kundenprofil."
publishedAt: 2026-05-31
modifiedAt: 2026-05-31
category: data
i18nKey: data-003-2026-05
tags: [identity-resolution, cdp, first-party-data, probabilistic-matching, hash-matching]
readingTime: 9
author: Roibase
---

Ein Nutzer registriert sich per E-Mail, bestellt über die Mobile App, eröffnet wenige Tage später ein Support-Ticket im Desktop-Browser. Cookie-ID, Device-ID, gehashte E-Mail, IP-Adresse, Session-ID, Benutzer-ID – sechs verschiedene Signale. Ohne Identity Resolution erscheinen diese als sechs unterschiedliche „Kunden". Die Attributionsmessung wird verzerrt, das Lifetime-Value-Modell bleibt ungenau, Retention-Signale gehen verloren. Google Analytics 4's User-ID-Zusammenführung verbindet nur authentifizierte Sessions, nicht anonyme Nutzeraktivität. CDPs werben mit „probabilistic stitching", zeigen aber keine Tabellenstrukturen. Um Identity Graphs produktiv zu nutzen, musst du Hash-Matching, probabilistische Verknüpfung und Household Identity zusammen orchestrieren.

## Hash-Matching: Das Rückgrat der deterministischen Verknüpfung

Hash-Matching verbindet zwei Signale „eindeutig", indem du SHA-256-Hashes derselben E-Mail oder Telefonnummer abgleichst. Wenn ein Nutzer sich auf deiner Website mit `user@example.com` registriert, hashst du diesen Wert mit SHA-256 und speicherst ihn in deiner BigQuery-Tabelle `identity_signals` als Spalte `hashed_email`. Meldet sich derselbe Nutzer später über die Mobile App mit der gleichen E-Mail an, ist der gehashte Wert identisch – die beiden Datensätze lassen sich zusammenführen.

```sql
-- Deterministischer Match in BigQuery
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

Diese Query verbindet Web-Cookie-ID und Mobile-Device-ID über die gehashte E-Mail. Das `INNER JOIN` ist deterministisch – es kommen nur exakte Übereinstimmungen zustande. Um die verbundenen Signale unter einer einzigen `canonical_user_id` zu vereinen, nutze `ROW_NUMBER()` oder UUID-Generierung. Hash-Matching hat seine Grenzen: Wenn ein Nutzer seine E-Mail ändert (alter Account + neuer Account), bleiben sie als separate Identitäten bestehen. An diesem Punkt kommt die probabilistische Schicht ins Spiel.

Hash-Matching ist DSGVO und KVKK-konform, weil du plaintext-E-Mails nicht speicherst – der Hash ist unidirektional und nicht umkehrbar. Es besteht aber eine Rainbow-Table-Anfälligkeit, deshalb solltest du E-Mail-Hashes mit einem zusätzlichen Signal – etwa Device-Fingerprint oder IP-Range – kombinieren. Eine einzelne Hash-Spalte genügt nicht; halte `hashed_email`, `hashed_phone` und `hashed_customer_id` in separaten Spalten vor. Partitioniere die Tabelle nach `DATE(timestamp)`, da die Identity-Auflösung meist inkrementell erfolgt und vollständige historische Scans kostspielig sind.

## Probabilistische Verknüpfung: Unsicherheit durch Scores managen

Wenn sich ein Nutzer ohne Registrierung durch deine Seite bewegt, existiert keine gehashte E-Mail – nur Cookie-ID, IP, User-Agent, Session-Timestamp. Probabilistic Matching gewichtet diese Signale und erzeugt ein „Wahrscheinlichkeits-Score", dass zwei Datensätze zu derselben Person gehören. Ein Score über dem Schwellenwert (z.B. 0,85) führt zu einer Verknüpfung; darunter bleiben sie getrennt. Anbieter wie LiveRamp, Merkle und Neustar verkaufen solche Scores, aber du kannst ein regelbasiertes Modell in deinem Warehouse selbst aufbauen.

Beispiel-Logik: Gleiche IP + gleicher Browser-Fingerprint (Canvas-Hash) + Session-Unterschied unter 5 Minuten → 90 % Match-Score. Gleiche IP + anderer Browser + 2 Stunden Abstand → 40 % Score. Bei einem Schwellenwert von 0,7 werden die ersten zwei verbunden, die zweiten getrennt. In BigQuery modellierst du das mit `CASE WHEN`-Blöcken:

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

Diese Query verwendet `CROSS JOIN` – bei Millionen von Reihen explodiert die Rechenzeit. In der Produktion brauchst du Window Functions oder Bucketing: Partitioniere IP-Ranges nach Prefix (etwa `/24` CIDR), vergleiche jede Session mit den letzten 100. Das Risiko beim probabilistic Matching ist ein False-Positive – wenn zwei verschiedene Nutzer von der gleichen IP (Büro-WLAN, gemeinsames VPN) zur gleichen Zeit zugreifen, können sie fälschlicherweise zusammengeführt werden. Deshalb sollte der Score-Schwellenwert zwischen 0,85 und 0,90 liegen; verifiziere zusätzlich über Cross-Device-Signale.

Ein ML-basiertes probabilistisches Modell ist anspruchsvoller: logistische Regression oder Gradient Boosting für die binäre Klassifikation „gleicher Nutzer". Merkmale sind IP-Hamming-Distanz, User-Agent-Levenshtein-Ähnlichkeit, Timezone-Offset, Session-Count. Trainings-Labels kommen aus bekannten `user_id`-Paaren (positive) und unterschiedlichen `user_id`-Paaren (negative). Das Modell gibt einen Score zwischen 0 und 1 aus, der Schwellenwert wird manuell justiert. Diesen Aufwand zu treiben erfordert – über dbt-Modelle hinaus – Vertex AI oder SageMaker; Data Engineering und ML Engineering müssen zusammenarbeiten.

## Household Identity: Unterschiedliche Nutzer, gleiches Zuhause

Im Identity-Resolution-Layer gibt es eine „Household"-Ebene: Du gruppierst verschiedene Nutzer mit gleicher IP oder gleicher Postadresse als „Haushaltseinheit" für Targeting und Analyse. Ein E-Commerce-Beispiel: Mutter schaut sich Kinderkleidung an, Vater kauft Elektronik – zwei unterschiedliche User-IDs, aber die gleiche Lieferadresse. Das Household-Graph vereint sie unter einer `household_id`. Marketing-Plattformen (Facebook Ads, Google Ads) verkaufen Household Targeting, aber du musst diese Beziehung im First-Party-Graph selbst modellieren.

Normalisiere in BigQuery die Lieferadressen: Großbuchstaben, Leerzeichen, Apartmentnummern bereinigen, dann hashen und als `household_key` nutzen:

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

Diese Tabelle bildet `user_id` auf `household_key` ab. Gruppiere Nutzer unter dem gleichen `household_key` und vergebe eine `household_id`. Household Identity unterscheidet sich von Cross-Device Identity – nicht ein Gerät einer Person, sondern mehrere Personen eines Haushalts. Das Privacy-Risiko ist erhöht: Zwei erwachsene Nutzer unter dem gleichen Household zusammenzuführen könnte gegen KVKK m.5 (Datenminimierung) verstoßen. Nutze das Household-Graph daher nur für Aggregat-Analysen und anonymes Targeting, nicht zur Zusammenführung individueller Profile.

Zusätzliche Signale für die Household-Graph: Wi-Fi SSID-Hash (wenn die App dies ausliest), Bluetooth-Beacon (physische Ladenfrequenzen), gemeinsame Zahlungsmethode (gleiche Kreditkarte). Da diese PII sind, brauchst du Hashing + verschlüsselte Speicherung. CDP-Systeme (Segment, mParticle, RudderStack) bieten Household-Auflösung als „Relationship Graph" an; mit BigQuery-Modellen erhältst du aber mehr Kontrolle – du siehst, wie jedes Signal gewichtet wird. Roibase's [CDP & Retention Engineering](https://www.roibase.com.tr/de/retention-engineering-cdp) integriert diese Ebene in ein produktives Pipeline-Setup.

## Graph Database vs Relational: Welcher Ansatz ist schneller

Ein Identity-Graph in BigQuery (relational) speichern ist möglich, aber „A → B → C" Kettenverknüpfungen (transitive Closure) abzufragen ist kostspielig. Graph-Datenbanken (Neo4j, Amazon Neptune, TigerGraph) lösen das über Node/Edge-Strukturen – die Query „alle Geräte eines Nutzers X finden" läuft mit `MATCH (u:User)-[:HAS_DEVICE]->(d:Device)` in Millisekunden. In BigQuery schreibst du das mit `RECURSIVE CTE` oder `ARRAY_AGG`, aber bei großen Tabellen steigt der Slot-Verbrauch.

Trade-off: Graph DB ist sehr schnell, aber Schema-Änderungen sind schwierig; Node/Edge-Modell ist nicht die SQL-Syntax, die Data Teams kennen. Relational Warehouse ist langsamer, aber dbt ermöglicht Version Control, Tests, Dokumentation. Die meisten Production-Umgebungen nutzen einen Hybrid-Ansatz: Täglich einen Identity-Mapping-Table in BigQuery via dbt bauen, in Neo4j synchronisieren, Real-Time-Lookups von Neo4j abfragen. Beispiel-Pipeline: dbt-Modell → BigQuery-View → Cloud Function Trigger → Neo4j Cypher INSERT.

```sql
-- Transitive Closure in BigQuery mit RECURSIVE CTE (langsamer)
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

Diese Query verfolgt Kettenverbindungen bis zu maximaler Tiefe 5. Ohne Depth-Kontrolle droht eine Endlosschleife – bei zirkulären Kanten (A → B → A). Graph DB handhaben solche Zyklen mit Built-in-Mechanismen; BigQuery braucht eine manuelle `WHERE`-Bedingung. Wenn dein Identity-Graph 10M+ Edges hat, ist eine dedizierte Graph-Engine wie Neo4j wartbarer. Unter 1M Edges ist BigQuery + dbt ausreichend.

## Datenschutz und Consent: Die rechtlichen Grenzen des Identity Graph

Identity Resolution fällt unter DSGVO m.4(4) „Profiling". E-Mails deterministisch + probabilistisch zu verknüpfen ohne Consent ist ein Rechtshazard. Consent Mode v2 (Google) trennt „analytics_storage" und „ad_storage", aber für Identity Stitching könnte eine zusätzliche Kategorie „personalization_storage" nötig sein. Under TCF 2.2 brauchst du Purpose 1 (Device Storage) + Purpose 9 (Personalized Ads) – ohne beides ist sogar Hash-Matching rechtswidrig.

Gehashte E-Mails sind in der DSGVO „Pseudo-Daten" (Recital 26) – bleiben persönliche Daten. Ist ein Reverse-Lookup oder Rainbow-Table möglich, ist es „Pseudonymisierung", nicht „Anonymisierung". Deshalb solltest du Hashes mit einem Salt versehen (E-Mail + Site-Spezifisches Secret → SHA-256) und den Salt in HSM oder Secret Manager lagern. Bei einem Nutzer-„Unlink"-Request (DSGVO m.18 Restriction of Processing) lösche die Edges aus dem Graph und unterbrich die deterministischen Verbindungen.

KVKK m.7 fordert „explicit consent": „Persönliche Datenverarbeitung erfordert explizite, sachgebundene, informierte und freiwillige Zustimmung." Identity Stitching muss explizit im Consent-Formular genannt werden – vage Formulierungen wie „besseres Erlebnis" genügen nicht. Wenn der Nutzer seinen Consent widerruft (`consent_revoked_at` Timestamp), lösche alle Edges dieses `user_id` aus dem Graph und setze `deleted_at`. In BigQuery machst du ein Soft-Delete – statt physisches Löschen ein `WHERE deleted_at IS NULL`-Filter.

## Implementierung: Inkrementelle Identity-Pipeline mit dbt

In der Produktion läuft Identity Resolution nicht als Batch, sondern inkrementell – täglich neue Signale addieren, Graph aktualisieren. Mit dbt incremental models kannst du das bauen:

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
    b.signal_id AS signal