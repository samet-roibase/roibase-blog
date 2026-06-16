---
title: "Identity Resolution: Von 6 Signalen zu einer einzigen Kundenidentität"
description: "Hash-Matching, probabilistische Verknüpfung und Household Identity vereinen fragmentierte Kundensignale zu einer einzigen ID. BigQuery + CDP in der Praxis."
publishedAt: 2026-06-16
modifiedAt: 2026-06-16
category: data
i18nKey: data-003-2026-06
tags: [identity-resolution, customer-data-platform, hash-matching, probabilistic-linking, first-party-data]
readingTime: 9
author: Roibase
---

Die durchschnittliche Cookie-Lebensdauer ist von 28 auf 7 Tage gesunken. Ein Nutzer startet in der mobilen App, zahlt auf der Desktop-Website, kehrt aus einer E-Mail-Kampagne zurück — jeder Touchpoint erzeugt einen anderen Identifier. 40 % der Marketing-Daten bleiben als verwaiste Events liegen: keine Nutzer-ID, keine Session-ID, keine Conversion-Attribution. Identity Resolution ist die Ingenieurleistung, diese Fragmente mit disziplinierten Methoden zusammenzuführen. Nicht Vermutung, sondern Hash-Matching. Nicht Spekulation, sondern probabilistische Graphen. Nicht Annahmen, sondern Household-Clustering.

## Deterministisches Matching: Hash-basierte Verknüpfung

Deterministisches Matching funktioniert, wenn du **sicher weißt**, dass zwei Datenpunkte denselben Identifier teilen. E-Mail-SHA-256-Hash, Telefonnummern-Hash, CRM-ID. Wenn in der BigQuery-Event-Tabelle `user_id` vorhanden ist, aber in der Web-Analytics `ga_client_id`, kannst du sie nicht direkt JOINen — du musst zunächst ein Bridge-Event finden, in dem beide geschrieben sind, und eine Zuordnungstabelle erstellen.

```sql
-- Deterministisches Identity Stitching Beispiel
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

Diese Abfrage verbindet die `user_pseudo_id` aus Firebase Analytics mit der `crm_id` aus dem CRM über **exakte Matching** auf Basis des E-Mail-Hashes. Der E-Mail-Hash dient als Anker-Identifier. Kritisches Detail: `LOWER(TRIM())` — wenn ein Nutzer "Ali@X.com" eingibt, das CRM aber "ali@x.com" speichert, bricht die Hash-Übereinstimmung zusammen. Daher ist Normalisierung der erste Schritt der Pipeline.

Die Precision des deterministischen Matchings ist 100 %, aber der Recall ist niedrig — es findet nur Datensätze, die in beiden Systemen denselben Identifier haben. Wenn ein Nutzer die Website verlässt, ohne seine E-Mail einzugeben, ist er nicht Teil dieses Graphen.

### Hash-Kollisionen und Datenschutz

Die Wahrscheinlichkeit einer SHA-256-Kollision ist theoretisch 2^-256 — in der praktischen Anwendung null. Allerdings setzt die GDPR Artikel 32 die Pseudonymisierung nicht mit Hashing gleich; ein Hash allein ist keine Anonymisierung. Eine Kombination aus E-Mail-Hash + IP + Zeitstempel kann zur Wiederidentifizierung führen. Daher müssen Hash-Tabellen mit encryption-at-rest und Zugriffskontrolle auf Spaltenebene geschützt werden.

## Probabilistisches Linking: Graph-basierte Wahrscheinlichkeits-Abgleichung

Wenn deterministisches Joining fehlschlägt, übernimmt probabilistisches Matching. Du verbindest zwei Records mit unterschiedlichen Identifiern basierend auf **Verhaltensähnlichkeit**, **Device Fingerprint**, **Zeitzone + User-Agent** und anderen schwachen Signalen. Nicht zwingend ein Machine-Learning-Modell — ein gewichtetes Scoring- + Threshold-System reicht aus.

| Signal | Gewicht | Beispiel |
|--------|---------|----------|
| Gleiche IP (innerhalb 24 Stunden) | 0,3 | 192.168.1.10 |
| Gleicher User-Agent | 0,2 | Chrome 120 / macOS |
| Gleicher geografischer Standort | 0,15 | Istanbul, Kadıköy |
| Gleicher Kampagnen-Klick | 0,25 | utm_campaign=spring_sale |
| Gleiche Produktansicht-Reihenfolge | 0,1 | product_123 → product_456 |

Wenn die Gesamtpunktzahl ≥ 0,7 ist, gehören die beiden Sessions **vermutlich** demselben Nutzer. Dieser Schwellenwert wird anhand des Datensatzes angepasst — bei E-Commerce-Websites kann 0,65 ausreichend sein, bei Fintech 0,85 nötig.

```sql
-- Beispiel für probabilistische Bewertung
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
WHERE a.session_id < b.session_id  -- Self-Join-Optimierung
  AND a.user_pseudo_id != b.user_pseudo_id
HAVING match_score >= 0.7;
```

Diese Abfrage vergleicht **alle Session-Paare** — das ist N²-Komplexität. Bei 1 Million Sessions sind das 500 Milliarden Vergleiche. In Production ist Partitionierung notwendig: Zeitfenster (7 Tage), Geo-Filter (gleiche Stadt), Device-Typ (Mobile-zu-Mobile).

Die False-Positive-Rate probabilistischer Links liegt zwischen 5–15 %. Daher müssen diese IDs bei downstream-Aktivierung (CDP-Segment-Push, E-Mail-Kampagne) mit einem "potential duplicate"-Flag gekennzeichnet werden.

## Household Identity: Ein Gerät, mehrere Nutzer

Tablets oder Smart TVs werden von mehreren Personen genutzt. Deterministisches oder probabilistisches Matching würde hier unterschiedliche Familienmitglieder unter einer einzigen ID zusammenfassen — was zu falscher Personalisierung führt. Household Identity Resolution versucht, diese Szenarien zu unterscheiden.

**Session-Level Fingerprinting:** Wenn sich unterschiedliche Nutzer auf demselben Gerät zu unterschiedlichen Zeiten anmelden, zeigen sie unterschiedliche Browsing-Muster. Der Nutzer, der morgens um 08:00 Uhr Kleidung sucht, unterscheidet sich vom Nutzer, der nachts um 23:00 Uhr Elektronik sucht.

**Behavioral Clustering:** Du nutzt K-Means oder hierarchisches Clustering, um Sessions zu gruppieren. Wenn die Cluster-Schwerpunkte unterschiedlich sind, erstellst du unter derselben `device_id` zwei separate "virtuelle Nutzer".

```sql
-- Feature-Extraktion für Household-Clustering
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

Nach dem Clustering werden für jede `device_id` virtuelle IDs wie `household_user_1`, `household_user_2` generiert. Diese IDs werden nicht zum CRM synchronisiert — sie werden nur in der Analytics- und Personalisierungs-Schicht verwendet.

Die Genauigkeit der Household-Auflösung ist niedrig — 30 % Fehlerquote ist normal. Daher wird sie außerhalb des E-Commerce selten eingesetzt (besonders nicht bei SaaS oder Fintech).

## Identity Graph-Struktur und Aktualisierung

Alle Matching-Ergebnisse werden in einer einzigen **Identity Graph**-Tabelle zusammengefasst. Diese Tabelle enthält für jede user_id alle bekannten Aliases: E-Mail-Hash, CRM-ID, ga_client_id, Firebase-ID, Advertising-ID.

| canonical_id | identifier_type | identifier_value | match_method | confidence | updated_at |
|--------------|-----------------|------------------|--------------|------------|------------|
| user_0001 | email_hash | a1b2c3... | deterministic | 1.0 | 2026-06-15 |
| user_0001 | ga_client_id | GA1.2.123 | deterministic | 1.0 | 2026-06-14 |
| user_0001 | firebase_id | xyz789 | probabilistic | 0.75 | 2026-06-16 |
| user_0002 | crm_id | CRM-456 | deterministic | 1.0 | 2026-06-10 |

Der Graph wird inkrementell aktualisiert — jeden Tag werden neue Events gescannt, neue Matches hinzugefügt. Alte Links schwächen sich durch Confidence Decay ab: Ein probabilistischer Link von vor 90 Tagen sinkt von 0,75 auf 0,50 Confidence.

Wenn du den Graph als **gerichteten azyklischen Graphen (DAG)** modellierst, kannst du Schleifen erkennen. Eine Schleife wie User A → User B → User C → User A ist ein Zeichen für einen Datenfehler — manuelle Überprüfung erforderlich.

## CDP-Integration und Activation Pipeline

Der Identity Graph wird nicht isoliert verwendet — er wird an das CDP gespeist. Die Architektur von [CDP & Retention Engineering](https://www.roibase.com.tr/de/retention-engineering-cdp) nimmt die canonical_id aus dem Graph, führt alle Touchpoints unter dieser ID zusammen und sendet sie an die Segment Engine.

Der Activation-Prozess funktioniert so:

1. **Segment-Definition:** "Mindestens 3 Sessions in den letzten 30 Tagen, zum Warenkorb hinzugefügt, aber nicht gekauft" → als BigQuery View definiert.
2. **Identity Resolution:** Die View führt für jede user_pseudo_id ein Lookup der canonical_id durch.
3. **Channel Sync:** Alle E-Mail-Hashes unter der canonical_id werden in Meta CAPI, Phone-Hashes in Google Customer Match gepusht.
4. **Attribution:** Wenn ein Conversion Event kommt, werden alle Touchpoints über die canonical_id im Graph zurückverfolgt.

Ohne CDP bleibt die Identity Resolution unvollständig — der Graph speichert nur "wer mit wem abgleicht", nicht "welche Aktion sollte ich für diesen Nutzer unternehmen".

## Privacy Compliance und Consent-Vererbung

Identity Resolution kann unter GDPR Artikel 6(1)(f) "berechtigtes Interesse" gerechtfertigt werden — aber wenn der Nutzer keine ausdrückliche Zustimmung erteilt hat, kannst du IDs aus diesem Graph nicht für Remarketing verwenden. Eine Integration mit einer Consent Management Platform (CMP) ist obligatorisch.

Für jede canonical_id wird der Consent-Status gespeichert: `{ analytics: true, marketing: false, personalization: true }`. Die vom Graph abgeleiteten Identifier erben dieses Flag — das heißt, wenn der E-Mail-Hash von User A marketing=false hat, darf die ga_client_id des Users B, der probabilistisch mit User A gelinkt ist, auch nicht in Marketing-Segmente gehen.

Unter TCF 2.2 ist Vendor Consent Propagation komplexer: Nutzer, die Meta zustimmen, aber Google nicht, erfordern selektives Sync aus dem Graph. Diese Architektur ist Teil des [First-Party-Daten- & Messwesen-Design](https://www.roibase.com.tr/de/firstparty) — Consent-Signale werden ganz oben in der Event Pipeline injiziert, und Graph-Update-Jobs lesen diese Signale.

---

Identity Resolution ist nicht nur eine technische JOIN-Operation — es ist die kritische Schicht, die Marketing-Daten mit Entscheidungsmechanismen verbindet. Hash-Matching für sichere Übereinstimmungen, probabilistische Bewertung für schwache Signale, Household-Clustering für Gerätefreigabe zu bewältigen — das erfordert Ingenieur-Handwerk. Den Graph aktuell zu halten, ihn mit Consent-Vererbung abzustimmen, ihn in die CDP-Activation-Pipeline zu speisen — das ist die produktive Seite dieser Disziplin. Im Cookie-losen Zeitalter wird Kundenidentität nicht erraten — sie wird aus sechs verschiedenen Identifiern zusammengesetzt.