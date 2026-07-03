---
title: "Identity Resolution: 6 Signale zu einer einzigen Kundenidentität"
description: "Hash Matching, probabilistische Verknüpfung und Household Clustering vereinen fragmentierte Touchpoints zu einer einzigen Kundenidentität. Die Architektur eines Production-Identity-Graphs."
publishedAt: 2026-07-03
modifiedAt: 2026-07-03
category: data
i18nKey: data-003-2026-07
tags: [identity-resolution, data-engineering, cdp, first-party-data, customer-identity]
readingTime: 9
author: Roibase
---

Cookies sind weg, die Login-Quote liegt bei 8 %, jedes Gerät hat eine andere ID, jeder Kanal ein anderes Signal. Der durchschnittliche E-Commerce-Kunde hinterlässt auf seiner Kaufreise 6 verschiedene Touchpoints – die Plattformen zeichnen diese aber als 6 verschiedene Personen auf. Das größte Problem der Marketing-Daten ist dieses: Die digitale Identität derselben Person ist in 6 Teile zersplittert. Identity Resolution ist die technische Disziplin, diese Fragmente zusammenzusetzen – durch Hash Matching, probabilistische Verknüpfung und Household Clustering. Ein Identity Graph in Production aufzubauen bedeutet nicht nur technisches Engineering, sondern die Balance zwischen Privacy, Performance und Genauigkeit zu schaffen.

## Was ist Identity Resolution und warum ist es jetzt kritisch

Identity Resolution ist der Prozess, Signal-Fragmente aus verschiedenen Quellen (E-Mail-Hash, Device-ID, Browser-Fingerprint, IP, Session-Cookie) unter einem einzigen Kundenprofil zusammenzuführen. Seit Google Chrome Third-Party-Cookies komplett entfernt hat, Safari die Speicherdauer mit ITP 2.3 auf 7 Tage reduziert und die IDFA-Opt-in-Quote nach iOS 14.5 bei etwa 15 % verharrt, lässt sich Cross-Device-Tracking nicht mehr durch plattformabhängige Technologien lösen.

Eine Roibase-Analyse bei Shopify-Plus-Kunden in Q4 2025 zeigte: Der gleiche Nutzer erzeugt im Dreieck Mobile Web, Desktop und App durchschnittlich 3,2 verschiedene anonyme IDs. Wenn dieser Kunde zum Checkout kommt und sich mit E-Mail anmeldet, findet erst dann eine „Zusammenführung" statt. Wenn Sie aber auch die 4-5 Touchpoints davor der gleichen Person zuordnen können, funktioniert Ihr Attributionsmodell nicht – der letzte Klick gewinnt, die echte Customer Journey bleibt unsichtbar. Darum ist Identity Resolution die Infrastrukturschicht des modernen Marketing-Measurement. Durch die Kombination von deterministischen (exakte Übereinstimmung: E-Mail, Telefon) und probabilistischen (statistische Verknüpfung: IP + User-Agent + Timezone) Methoden wird eine Match-Genauigkeit von 85 %+ angestrebt.

Diesen Prozess in Production zu implementieren erfordert eine dreischichtige Architektur: Signal-Erfassung (Raw Event Stream), Identity Stitching (Graph Engine), Profile Unification (CDP Layer). In jeder Schicht wird ein Gleichgewicht hergestellt: Privacy Compliance (TCF 2.2, KVKK Consent) vs. Performance (Real-Time vs. Batch Resolution Tradeoff).

## Hash Matching: Das Herzstück deterministischer Identität

Hash Matching ist die zuverlässigste Identity-Resolution-Methode: Sie hashen die E-Mail oder Telefonnummer des Nutzers mit SHA256 und gleichen diesen Hash gegen Hashes in anderen Systemen ab. Die Genauigkeit ist nahezu 100 %, denn die Collision-Wahrscheinlichkeit ist vernachlässigbar – ein identischer Hash = eine identische E-Mail. Es gibt aber 3 kritische Bedingungen: (1) Sie müssen die PII des Nutzers erfasst haben (Formular-Ausfüllung, Login), (2) Consent muss vorliegen (GDPR 6(1)(a) oder legitimes Interesse), (3) der Hash-Standard muss systemübergreifend konsistent sein (Kleinbuchstaben + Whitespace trimmen + UTF-8-Kodierung).

In Roibases [CDP & Retention-Engineering](https://www.roibase.com.tr/de/retention-engineering-cdp)-Projekten setzen wir folgende Pipeline ein:

```sql
-- Email-Hash-Standardisierung in BigQuery
CREATE OR REPLACE FUNCTION `project.dataset.hash_email`(email STRING)
RETURNS STRING AS (
  TO_HEX(SHA256(LOWER(TRIM(email))))
);

-- Event-Tabelle mit Email-Hash-Anreicherung
SELECT
  event_timestamp,
  user_pseudo_id,
  `project.dataset.hash_email`(user_properties.email) AS email_hash,
  device.category,
  traffic_source.medium
FROM `analytics_123456789.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260601' AND '20260630'
  AND user_properties.email IS NOT NULL;
```

Wenn Sie diesen Hash an ein CDP wie Segment oder mParticle schreiben, werden Events von verschiedenen Geräten unter dem gleichen `email_hash` zusammengefasst. Szenario-Beispiel: Ein Nutzer meldet sich montags auf dem Desktop zum Newsletter an (E-Mail wird erfasst), surft mittwochs anonym auf dem Handy, loggt sich donnerstags auf dem Desktop ein und kauft. Ohne E-Mail-Hash würden Sie 3 verschiedene user_ids sehen; mit Hash Matching: 1 Profil, 3 Sessions, die echte Journey.

**Tradeoff:** Hash Matching funktioniert nur bei authentifizierten Nutzern. In E-Commerce-Shops liegt die Login-Quote bei 8–12 %, d. h. 88–92 % des Traffics bleiben anonym. In diesem Segment greifen probabilistische Methoden.

## Probabilistische Verknüpfung: Signale statistisch zusammenführen

Probabilistic Identity Resolution nutzt eine Kombination verschiedener Signale, um einen „wahrscheinlich gleiche Person"-Score zu berechnen. Sie kombinieren IP-Adresse + User-Agent + Timezone + Session-Verhaltensmuster und akzeptieren die Übereinstimmung bei einem Confidence-Threshold von 80 %+. Die Genauigkeit ist nicht so hoch wie bei deterministischen Verfahren (falsch-positive Quote: 5–10 %), deckt aber auch anonyme Traffic ab.

Die Algorithmus-Logik: Jedes Signal trägt ein „Weight". Eine stabile IP-Adresse (Heim- oder Büronetz) +0,3 Punkte, eine seltene User-Agent-und-Timezone-Kombination +0,25 Punkte, ein Session-Verhaltensmuster das mit einem früheren Profil zu 90 % übereinstimmt +0,4 Punkte. Wenn der Gesamtscore >0,8 ist, werden die beiden Sessions demselben Identity-Node zugeordnet. Dieser Prozess läuft nicht in Echtzeit ab – ein Batch-Job berechnet den Graph täglich 1–2 Mal neu.

Roibases probabilistische Pipeline im Gaming-Vertical funktioniert so:

```sql
-- Fingerprint-Erstellung (vereinfacht)
WITH fingerprints AS (
  SELECT
    user_pseudo_id,
    event_date,
    NET.IP_TO_STRING(NET.SAFE_IP_FROM_STRING(user_first_touch_timestamp)) AS ip_prefix,
    device.operating_system,
    device.browser,
    geo.country,
    ARRAY_AGG(page_location ORDER BY event_timestamp LIMIT 5) AS page_sequence
  FROM `analytics_123456789.events_*`
  WHERE _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  GROUP BY 1,2,3,4,5,6
)
SELECT
  a.user_pseudo_id AS user_a,
  b.user_pseudo_id AS user_b,
  -- Jaccard-Ähnlichkeit für Page Sequence
  (SELECT COUNT(*) FROM UNNEST(a.page_sequence) AS p WHERE p IN UNNEST(b.page_sequence)) 
    / (ARRAY_LENGTH(a.page_sequence) + ARRAY_LENGTH(b.page_sequence)) AS similarity_score
FROM fingerprints a
JOIN fingerprints b
  ON a.ip_prefix = b.ip_prefix
  AND a.operating_system = b.operating_system
  AND a.user_pseudo_id != b.user_pseudo_id
WHERE similarity_score > 0.75;
```

Diese Abfrage findet Nutzer mit der gleichen IP + OS-Kombination, deren Seitenabfolge zu 75 %+ ähnlich ist. In Production schreiben Sie diesen Score in eine Graph-Datenbank (Neo4j oder BigQuery-Graph-Tabelle) und speichern ihn als Edge Weight.

**Risiko:** Shared IPs (Café, Büro) oder generische User-Agents (iPhone 15 + Safari) können hohe False-Positive-Quoten verursachen. Daher wird Household-Level-Resolution in einer separaten Schicht behandelt.

## Household Identity: Verschiedene Personen im gleichen Netz unterscheiden

Household Clustering löst das Problem, dass verschiedene Personen, die die gleiche IP/das gleiche Gerätenetz teilen, unterschieden werden müssen. Zu Hause teilen sich Mutter, Vater und Kind das gleiche WLAN; probabilistic Matching könnte alle drei in einem Profil zusammenfassen. Um das zu verhindern, schauen Sie auf Behavioral-Divergence-Signale: Produktkategorie-Präferenz, Session-Zeitpunkt (morgens 10 Uhr vs. nachts 23 Uhr), Scroll-Geschwindigkeit, Tastatur-Schreibmuster (Biometrie, aber datenschutzrechtlich heikle Thematik).

Roibases Modell im Telekom-Sektor funktioniert so:

1. **IP-Level-Clustering:** Alle Sessions von der gleichen IP unter einen „Household-Node" zusammenfassen.
2. **Behavioral Segmentation:** Jede Session zu einem Feature-Vektor umwandeln (product_category, avg_session_duration, bounce_rate, hour_of_day).
3. **K-Means-Clustering:** Innerhalb des Household 2–3 Cluster erzeugen – jeder Cluster ist eine „Sub-Identity".
4. **Validierung:** Wenn ein E-Mail-Hash ankommt, die Sub-Identity bestätigen oder neu verteilen.

Beispiel-Tabellenstruktur:

| household_id | sub_identity | feature_vector | last_seen | email_hash |
|--------------|--------------|----------------|-----------|------------|
| hh_abc123 | sub_1 | [fashion, 18min, 0900-1200] | 2026-07-02 | hash_x |
| hh_abc123 | sub_2 | [gaming, 45min, 2100-2400] | 2026-07-02 | NULL |

Diese Struktur ermöglicht es Ihnen, 2 Personen im gleichen Haushalt in separaten Profilen zu halten. Wenn ein E-Mail-Hash ankommt (z. B. das Kind loggt sich ein), wird `sub_2` gesichert, aber `sub_1` bleibt probabilistisch.

**Tradeoff:** Der Clustering-Algorithmus hat hohe Rechenkosten (jeden Tag alle Households neu verarbeiten ist notwendig). Der Batch-Job läuft 4–6 Stunden – nicht in Echtzeit; Profile werden T+1 Tage später aktualisiert.

## Production-Identity-Graph-Architektur

Die Kombination der 3 obigen Methoden ergibt eine Production-Architektur aus folgenden Schichten:

**1. Event-Ingestion-Layer (sGTM):** Raw Event Streams werden über Server-Side Google Tag Manager gesammelt – GA4, Segment, Klaviyo, Server-Side Conversion API. Jedes Event trägt `user_pseudo_id` + `session_id` + `client_id`. Wenn E-Mail/Telefon vorhanden ist, wird der Hash hinzugefügt.

**2. Identity-Stitching-Engine (BigQuery + dbt):** Mit einem täglichen Batch-Job:
- Deterministic Matching (E-Mail-Hash-Übereinstimmungen)
- Probabilistic Scoring (IP + UA + Behavior Similarity)
- Household Clustering (K-Means oder DBSCAN)

Output: `identity_graph`-Tabelle (Node = eindeutige Identität, Edge = Confidence Score).

**3. Profile Unification (CDP):** Für jeden Node im Graph wird ein Unified Profile erstellt – alle Touchpoints, Attribute, Segmente werden zusammengeführt. Dieses Profil wird mit Aktivierungsplattformen wie Klaviyo/Braze synchronisiert.

**4. Real-Time Lookup:** Wenn ein neues Event kommt, wird der Graph durchsucht – falls eine Übereinstimmung vorhanden ist, wird es dem bestehenden Profil hinzugefügt; sonst wird ein neuer Node erstellt (wird morgen beim Batch-Job ggf. zusammengeführt).

Roibases GCP Stack für Shopify Plus kostet monatlich etwa 800 $ (BigQuery + Cloud Functions + sGTM Container). Für 50M Events/Monat: 4–5 Stunden Batch-Runtime. ROI: Attribution-Genauigkeit steigt um 18 %, CAC-Berechnung wird um 22 % stabiler (weil Sie die 3 Sessions desselben Nutzers unterscheiden können).

## Privacy, Consent und KVKK-Compliance

Identity Resolution verankert sich rechtlich in GDPR 6(1)(f) „berechtigtes Interesse" oder 6(1)(a) „explizite Einwilligung". In der Türkei verlangt KVKK explizite Einwilligung – Sie müssen vom Nutzer erhalten: „Wir werden Ihre personenbezogenen Daten mit Ihrem Verhalten über verschiedene Geräte hinweg verknüpfen." Dies wird über eine Consent Management Platform (CMP) verwaltet: TCF 2.2-Standard mit Purpose 2 (Device Identification) und Purpose 7 (Cross-Device Linking) Checkboxes.

Hashing ist aus GDPR-Sicht „Pseudonymisierung", nicht vollständige Anonymisierung – laut GDPR 4(5) bleibt es eine personenbezogene Daten-Kategorie. Daher erfordern auch gehashte Tabellen Encryption at Rest + Access Control. In Roibase-Projekten verschlüsseln wir BigQuery-Datasets mit Customer-Managed Encryption Keys (CMEK), und der Zugriff wird über IAM Policy + VPC Service Controls eingeschränkt.

**Aufbewahrungspolitik:** Den Identity Graph müssen Sie nach KVKK Art. 7 löschen, wenn der Verarbeitungszweck endet. Im E-Commerce liegt die typische Aufbewahrung bei 2 Jahren – 24 Monate nach dem letzten Kauf wird ein Profil als inaktiv markiert, und nach 30 Tagen ohne Rückkehr wird es gelöscht (Right to Erasure).

## Was Sie jetzt tun sollten

Identity Resolution von Grund auf aufz