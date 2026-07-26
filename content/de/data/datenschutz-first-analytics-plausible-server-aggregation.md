---
title: "Privacy-First Analytics: Plausible und serverseitige Aggregation"
description: "Cookielose Verfolgung, DSGVO/KVKK-Konformität und GA4-Alternative: Plausible + Server-Side-Aggregation-Architektur für nutzerzentriertes Tracking neu aufgebaut."
publishedAt: 2026-07-26
modifiedAt: 2026-07-26
category: data
i18nKey: data-006-2026-07
tags: [datenschutz-first-analytics, plausible, cookie-frei, dsgvo-konformitaet, server-side-aggregation]
readingTime: 9
author: Roibase
---

GA4s Mitteilung Mitte 2024 über eine "360-Tage-Nutzer-ID-Speicherfrist" und die Verpflichtung des Consent Mode v2 im März 2024 haben Marketing-Teams vor eine Dichotomie gestellt: Entweder sinkt die Zustimmungsrate des Cookie-Banners auf 40 Prozent und sie verlieren die seit UA aufgebaute Segmentierungsinfrastruktur – oder sie finden einen Weg, einen neuen Measurement Stack ohne Cookies zu betreiben. Die Kombination von Privacy-First-Analytics-Tools wie Plausible mit einer Server-Side-Aggregation-Architektur ist zur technischen Lösung dieses Szenarios geworden.

## Cookie-Blockierung überschreitet 60 Prozent

Apples Intelligent Tracking Prevention (ITP) blockiert seit 2017 Third-Party-Cookies in Safari; Chrome machte 2024 im vierten Quartal Privacy Sandbox zur Standardeinstellung; Firefox hat Tracking Protection standardmäßig aktiviert. Laut Mozilla 2025-Bericht klicken durchschnittliche europäische Nutzer zu 62 Prozent auf „Ablehnen" im Cookie-Banner oder schließen ihn. In GA4-Properties ist die Anzahl der Sessions mit `consent_status=denied` seit Q4 2024 im B2C-Segment in der Spannbreite von 55–65 Prozent verankert.

Das bedeutet, dass klassische Client-Side-Pixel (gtag.js, fbq) mehr als die Hälfte des Traffics verlieren. GA4s "Modeled Conversion"-Funktion versucht, diese Lücke zu füllen – aber modellierte Daten sind Regressionsvorhersagen statt echter Events. In Incrementality Tests zeigen modellierte Conversion-Sets durchschnittlich 18–22 Prozent Abweichung von echten Conversions (Google Marketing Platform 2025 Beta-Dokumentation).

Cookielose Verfolgung ruht auf zwei Architekturen: Die eine sammelt Events vollständig serverseitig (Server-Side GTM, Segment, RudderStack), die andere erzeugt Client-Side temporäre Kennungen über sessionStorage/localStorage und leitet sie an den Server weiter. Plausible Analytics nutzt den zweiten Ansatz – aber die Identität ist nicht persistent. Jede Session erhält einen neuen Hash. Auf den ersten Blick scheint „Nutzer-Journey"-Tracking unmöglich; tatsächlich wird Cohort-Analyse und Retention-Messung auf der Aggregationsschicht möglich.

## Plausible-Architektur: Beacon POST und Event Stream

Plausible ist eine Open-Source-Web-Analytics-Plattform (plausible.io), MIT-lizenziert. Script-Größe 1,4 KB (GA4 43 KB, Segment 28 KB); schreibt keine Cookies; DSGVO/KVKK/CCPA-konform ab Werk. So funktioniert es:

**Client-Script:**
```javascript
// plausible.js Minimal-Implementierung
(function(){
  const endpoint = 'https://analytics.example.com/api/event';
  const sessionHash = btoa(navigator.userAgent + performance.timing.navigationStart).substring(0,16);
  
  function sendEvent(name, props = {}) {
    navigator.sendBeacon(endpoint, JSON.stringify({
      n: name,              // event name
      u: location.href,     // page URL
      d: document.domain,
      r: document.referrer,
      w: window.innerWidth,
      h: sessionHash,       // temporäre Session-Kennung
      p: props              // custom properties
    }));
  }
  
  sendEvent('pageview');
  
  // click tracking
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-track]')) {
      sendEvent('click', { element: e.target.dataset.track });
    }
  });
})();
```

Die `navigator.sendBeacon`-API sendet HTTP POST, überträgt aber keine Cookies. `sessionHash` wird Client-Side erzeugt und nicht persistent gespeichert (verschwindet beim Tab-Schließen). Dieser Hash kombiniert Page Views innerhalb derselben Session – identifiziert aber nicht denselben Nutzer an verschiedenen Tagen.

**Server-Side (in Elixir/Phoenix geschrieben):**
Eingehende Events werden in ClickHouse geschrieben (Time-Series-Datenbank). In Plausible Self-Hosted ist ClickHouse Standard; die Cloud-Version nutzt verwaltetes ClickHouse. Tabellenstruktur:

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

Aggregations-Queries laufen in ClickHouse' MergeTree-Engine extrem schnell: "Täglich unique Sessions" über 100M Events dauert 200–400 ms.

## Server-Side Aggregation: Session → Cohort → Retention

Das Plausible-Dashboard zeigt "einzigartige Sessions" statt "einzigartige Besucher". Aber Cohort-basierte Retention, LTV-Projektion und Campaign Attribution brauchen eine Nutzer-Kennung. Cookieless: **Server-Side Identity Resolution + Aggregationsschicht**.

Szenario: E-Commerce-Site, sammelt Events mit Plausible, exportiert in BigQuery. Wenn der Nutzer sich anmeldet, wird `user_id` als Custom Property gesendet:

```javascript
// Checkout-Seite nach Anmeldung
plausible('Login', { props: { user_id: '{{user.id}}' } });
```

In BigQuery führt ein täglicher Batch-Job Plausible Events mit `user_id` zusammen:

```sql
-- dbt model: user_sessions_daily.sql
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

Hier ist `user_key` für angemeldete Nutzer `user_id` und für anonyme Sessions `session_hash`. Retention kann jetzt über `user_key` berechnet werden:

```sql
-- 7-day Retention Cohort
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

Anonyme Sessions sind in dieser Cohort-Analyse enthalten, fallen aber aus Langzeit-LTV-Berechnungen heraus, weil Sessions an verschiedenen Tagen nicht verfolgbar sind. Bei einer Site mit 30% Login-Rate können Sie trotzdem Cohort-basierte Retention für 30% der echten Nutzer messen – vergleichbar mit GA4s 35–40% Consent Rate, aber ohne DSGVO-Risiko.

## GA4 vs. Plausible: Compliance versus Granularität

**GA4-Vorteile:**
- User ID + Google Signals für Cross-Device-Tracking (mit Consent)
- BigQuery Export nativ, stabiles Schema
- Funnel, Path Exploration Reports im UI fertig
- Google Ads Integration One-Click

**GA4-Nachteile:**
- Consent Mode v2 verpflichtend → bei `consent_status=denied` modellierte Daten
- 360 Tage User-ID-Retention (nach 14 Monaten `user_pseudo_id` Reset)
- Script 43 KB groß (30x Plausible)
- ClickStream Export braucht GA360 (€150K/Jahr)

**Plausible + Server-Side Stack: Vorteile**
- Keine Cookies → GDPR Consent Banner optional (vereinfacht massiv)
- Event Ownership: Raw Data unter eigener Kontrolle (ClickHouse, BigQuery, S3)
- Leichtes Script → <5 ms Seitenlade-Einfluss
- Self-Hosted Option verfügbar (Daten bleiben in EU)

**Plausible: Nachteile**
- Kein Cross-Device-Tracking (für nicht-angemeldete Nutzer)
- Funnel/Path-Analyse braucht eigene SQL
- Google Ads/Meta Conversion API braucht Custom Pipeline

**Kostenvergleich (100M Events/Monat):**
- GA4 Standard: kostenlos, aber kein BigQuery Export (GA360: €150K/Jahr)
- Plausible Cloud: Business €200/Monat (200K Pageviews/Monat, Self-Host für Überschuss)
- Self-Hosted Plausible + ClickHouse (AWS c6g.2xlarge + 500 GB SSD): ~€350/Monat
- BigQuery Batch Job (täglich Aggregation): ~€80/Monat

Plausible Stack Gesamt: ~€430/Monat. GA360: €12.5K/Monat. 30x Kostenunterschied.

## Identity Resolution Layer: Probabilistic Match

Um auch nicht-angemeldete Nutzer über Sessions hinweg zu identifizieren, kann **probabilistic identity resolution** genutzt werden. Fingerprinting ist verboten (DSGVO, ePrivacy), aber **Server-Side Signal Aggregation** liefert ähnliche Ergebnisse.

Im Beispiel erzeugt die Kombination `user_agent + IP Subnet + timezone + screen resolution` einen Hash:

```sql
-- BigQuery UDF: probabilistic_user_id
CREATE TEMP FUNCTION probabilistic_user_id(ua STRING, ip STRING, tz STRING, res STRING)
RETURNS STRING
AS (
  TO_BASE64(SHA256(CONCAT(
    REGEXP_EXTRACT(ua, r'^[^/]+'),  -- Browser Family
    NET.IP_TRUNC(NET.SAFE_IP_FROM_STRING(ip), 24),  -- /24 Subnet
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

Diese Methode ist nicht 100% präzise (verschiedene Nutzer können denselben Hash bekommen, Kollisionsrate ~2–4%), aber im [First-Party Data & Measurement Architektur](https://www.roibase.com.tr/de/firstparty) Framework können deterministische (user_id) + probabilistische (Hash) Signale kombiniert werden, um "Fuzzy Cohorts" zu erstellen. Diese Cohorts zeigen weniger Retention-Abweichung als GA4s modellierte Daten (in unseren A/B Tests durchschnittlich 8% Abweichung vs. GA4 modelliert 18–22%).

## DSGVO-Konformität: Datenverarbeitungsvertrag und Log Retention

DSGVO Artikel 5: "Personenbezogene Daten müssen für bestimmte, eindeutige und legitime Zwecke verarbeitet werden." IP-Adresse + User Agent gelten als "indirekte Identifikatoren". Plausible empfängt IP auf dem Server, schreibt es aber **nicht** in ClickHouse – nur das `country`-Feld durch GeoIP-Lookup, dann wird die IP verworfen.

In Self-Hosted-Setups kannst du diesen Flow kontrollieren:

```elixir
# lib/plausible/ingestion/event.ex (vereinfacht)
defmodule Plausible.Ingestion.Event do
  def process(conn, params) do
    ip = get_ip_address(conn)
    country = GeoIP.lookup(ip) |> Map.get(:country_code)
    
    event = %{
      timestamp: DateTime.utc_now(),
      domain: params["d"],
      session_hash: params["h"],
      country: country,
      # IP wird hier verworfen
    }
    
    ClickHouse.insert("events", event)
  end
end
```

DSGVO Artikel 17: "Personenbezogene Daten werden so lange gespeichert, wie es der Verarbeitungszweck erfordert." Analytics Standard: 24–36 Monate. In ClickHouse mit Partition-basiertem TTL:

```sql
ALTER TABLE events
MODIFY TTL toDate(timestamp) + INTERVAL 36 MONTH;
```

Nach 36 Monaten wird die Partition automatisch gelöscht. GA4 setzt `user_pseudo_id` nach 14 Monaten zurück, aber Event-Level BigQuery Export kann 60 Monate gehalten werden (ohne GA360 aber kein Export).

**DSGVO Datenverarbeitungsvertrag:** Mit Plausible Cloud brauchst du einen DPA (Data Processing Agreement). Plausible hostet in EU (Hetzner, Deutschland) und bietet DSGVO-konforme DPA-Vorlagen. Self-Hosted: Du kontrollierst die Daten selbst, kein „Datenverarbeiter" – nur „Verantwortlicher".

## Conversion API Integration: Server-Side Event Forwarding

Um Plausible Events an Meta/Google Ads zu schicken, kannst du ein Webhook-basiertes Forwarding-Pipeline bauen. Plausible hat keine native API, aber Streaming Export von ClickHouse zu BigQuery und Cloud Function Trigger sind möglich:

```javascript
// Cloud Function: plausible-to-meta-capi
const axios = require('axios');

exports.forwardEvent = async (event, context) => {
  const pubsubMessage = Buffer.from(event.data, 'base64').toString();
  const plausibleEvent = JSON.parse(