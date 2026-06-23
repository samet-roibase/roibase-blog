---
title: "Privacy-First Analytics: Plausible + Server-seitige Aggregation"
description: "Cookie-loses Tracking, DSGVO/KVKK-Konformität, Vergleich mit GA4. Datenschutz-fokussierte Mess-Infrastruktur mit Server-seitiger Aggregationsarchitektur aufbauen."
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: verianalizi
i18nKey: data-006-2026-06
tags: [privacy-first, plausible, server-side-tracking, dsgvo, cookie-los]
readingTime: 9
author: Roibase
---

Google Analytics 4 verzichtet bis 2026 auch in Standardkonfigurationen nicht auf Browser-Fingerprinting, Client-seitige Cookie-Setzung und IP-Protokollierung. Die Anleitung des EU-Datenschutzrats vom Januar 2026 stuft GA4 als „ohne explizite Zustimmung unzulässig" ein. In Deutschland präzisiert die aktuelle DSGVO-Interpretation (LfDI-Positionspapier März 2026): Cookie-basierte Analytics erfordern Opt-In vor Datenerfassung. Performance Marketing setzt auf aggressive Attribution Stacks, aber die Site-Analytics-Schicht auf datenschutzgerichtete Architektur umzustellen ist jetzt operativer Zwang. Plausible + Server-seitige Aggregation beantwortet zwei kritische Fragen: Wie misst man cookie-los, und wie baut man eine Compliance-sichere Server-seitige Pipeline auf.

## Plausibles Architektur: Event-Stream statt aggregierter Counter

Plausible lässt im Browser ein unter 1 KB großes JavaScript-Snippet laufen — keine Cookies, kein localStorage, keine IP-Protokollierung. Ein Seitenaufruf triggert einen `POST /api/event`-Aufruf. Der Raw Event im Elixir-Backend wird **sofort aggregiert**: jeder Event inkrementiert einen Pageview-Counter, die Session-ID wird durch einen täglich wechselnden Salt als HMAC-SHA256-Hash der IP + User-Agent speichert (24-Stunden-TTL). Das Visitor-Erkennungssystem ist deterministisch, aber nicht reversibel: Request vom selben Tag und selben Gerät werden auf denselben Visitor-Hash abgebildet, ab dem nächsten Tag ist die Verbindung unterbrochen. Diese Methode fällt außerhalb von DSGVO's „identifizierbarer natürlicher Person" — selbst wenn Sie den Hash hätten, können Sie nicht auf die IP zurückrechnen.

GA4 im Gegensatz: GA4 speichert mit dem Client-seitige `_ga`-Cookie 2 Jahre lang eine persistente Client-ID, schreibt jeden Hit in einen Event-Stream, und in BigQuery Export sieht `user_pseudo_id` = Cookie-Wert aus. Mit Consent Mode v2 sendet es redacted Data, aber das Cookie wird trotzdem gesetzt. Bei Plausible lautet es bereits im Backend: Der Event-Hit wird im Elixir-Prozess gehasht, die Raw-IP verlässt den Memory. Diese Architektur befolgt DGSVOs „Zweckbindung": Die erfassten Daten dienen nur zur Seitenzählung, nicht zu Retargeting oder Cross-Site-Tracking.

### Aggregations-Counter-Struktur

Die Plausible-Dashboard-Metriken (Pageview, Besucher, Bounce-Rate, Sitzungsdauer) liegen nicht in einer `events`-Tabelle. Stattdessen:

```sql
CREATE TABLE stats (
  site_id INT,
  date DATE,
  metric VARCHAR(50),   -- 'pageviews', 'visitors', 'bounce_rate'
  dimension VARCHAR(50),-- 'page', 'source', 'device'
  value BIGINT,
  PRIMARY KEY (site_id, date, metric, dimension)
);
```

Bei jedem eingehenden Event läuft eine `INCREMENT`-Query: Existiert die Kombination (Tag, Seite, Metrik), dann `+1`, sonst `INSERT`. Das Live-Dashboard liest diese Counter. Da kein Raw-Event-Stream gespeichert wird, erfüllt dies DGSVOs „Datensparsamkeit" exakt — die Daten, die Sie speichern, entsprechen der Aufgabe.

## Server-seitiger Proxy: Client-zu-Plausible-Traffic übers eigene Domain leiten

Plausibles SaaS-Endpoint ist `plausible.io/api/event`. Der Browser POST'et dorthin. Ad-Blocker landen `plausible.io` auf der Blockliste, der Event fällt aus. Lösung: Event-Traffic über einen Reverse Proxy des eigenen Domains laufen lassen. Nginx-Config:

```nginx
location /stats/api/event {
  proxy_pass https://plausible.io/api/event;
  proxy_set_header Host plausible.io;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header X-Forwarded-Proto $scheme;
  
  # IP-Anonymisierung — letztes Oktet maskieren
  set $anonymized_ip $remote_addr;
  if ($remote_addr ~* ^(\d+\.\d+\.\d+)\.\d+$) {
    set $anonymized_ip $1.0;
  }
  proxy_set_header X-Forwarded-For $anonymized_ip;
}
```

Das Frontend-Script ändert sich:

```html
<script defer data-domain="yourdomain.com" 
  src="/stats/js/script.js"></script>
```

`/stats/js/script.js` wird auch über Nginx proxy'd. Event-Traffic geht zu `yourdomain.com/stats/api/event`, wird von dort zu Plausibles SaaS-Backend weitergeleitet. Das Ad-Blocker-Bypass-Effekt bringt %15–20 Messverlust auf null (Plausible 2025-Bericht). Entscheidender Punkt: Der Reverse Proxy anonymisiert die IP schon bei Versand — Das Plausible-Backend sieht nur das letzte Oktet als `0`.

### Self-Hosted Plausible: Vollständige Kontrolle

Plausible auf den eigenen Servern laufen lassen bedeutet, Ereignisdaten verlassen nie den 3rd-Party-Endpoint. Docker-Compose-Setup:

```yaml
version: '3.8'
services:
  plausible:
    image: plausible/analytics:v2.0
    ports:
      - "8000:8000"
    environment:
      BASE_URL: https://analytics.yourdomain.com
      SECRET_KEY_BASE: ${SECRET}
      DATABASE_URL: postgres://plausible:password@db/plausible
      CLICKHOUSE_DATABASE_URL: http://clickhouse:8123/plausible
    depends_on:
      - db
      - clickhouse
  
  db:
    image: postgres:14-alpine
    volumes:
      - postgres-data:/var/lib/postgresql/data
  
  clickhouse:
    image: clickhouse/clickhouse-server:23.3-alpine
    volumes:
      - clickhouse-data:/var/lib/clickhouse
```

Self-Hosted ist ab v2.0 von PostgreSQL auf ClickHouse umgestiegen. Event-Aggregations-Geschwindigkeit ist 10x schneller: Bei 1M Events/Tag ist Query-Latenz <50ms. In dieser Architektur sind IP-Hashing, Salt-Rotation komplett in Ihrer Kontrolle — Im DSGVO-Bericht können Sie schreiben: „Event-Daten verlassen unsere Server nicht."

## Vergleich mit GA4: Trade-off-Tabelle

| Kriterium | Plausible | GA4 |
|---|---|---|
| **Cookie-Nutzung** | Keine | `_ga`, `_ga_*` (2 Jahre) |
| **IP-Protokollierung** | Hash + 24h TTL | Redacted (mit Consent Mode v2), aber BigQuery-Export enthält `user_pseudo_id` = Cookie-ID |
| **Zustimmungserfordernis (DSGVO)** | Nein (legitimes Interesse reicht) | Ja (explizites Opt-in) |
| **Attributions-Fähigkeit** | Keine — nur Referrer + UTM | Cross-Domain, Conversion Path, datengesteuerte Attribution |
| **Custom-Event-Tracking** | Manuelle API-Aufrufe (Goal-Events) | Automatisch + Messplan |
| **Kosten (10M Hit/Monat)** | Self-Hosted: Server (~$50/Mo), SaaS: $19/Mo (Business) | Kostenlos, aber BigQuery Export kostet GCP (~$5/TB Query) |
| **Dateneigentum** | Ihr (Self-Hosted) / EU-Server (SaaS) | Google (US-Server) |

Bei Plausible **gibt es keine Attribution** — Sie sehen nicht, aus welcher Kampagne eine Conversion kam, nur „diese Seite wurde X-mal besucht, Y Unique Visitors". Wenn Sie Zweit-Marketing-Mix-Modeling oder Incrementality-Tests fahren, ist das Datenvolumen ausreichend: Korrelation der aggregierten Traffic-Veränderung mit Sales. User-Level-Journey, Cohort-Analyse, Funnel-Dropoff sind unmöglich. GA4 glänzt darin: BigQuery-Export mit `user_pseudo_id`-Join ermöglicht Multi-Touch-Attribution.

Der Trade-off: Sie reduzieren Compliance-Risiko auf Null und verlieren granulare Insights. Lösung: Hybrid-Stack. Site-Analytics Plausible (cookie-los), Conversion-Tracking über [First-Party-Daten-Architektur](https://www.roibase.com.tr/de/firstparty) — sGTM + Conversion API. Plausible zeigt allgemeine Traffic-Trends, Decision-Metriken (ROAS, LTV, CAC) kommen aus der Server-seitigen Pipeline.

## Server-seitige Aggregations-Pipeline: Plausible + dbt + BigQuery

In einer Self-Hosted-Plausible-Installation haben Sie direkten Zugang zur ClickHouse-Datenbank. Event-Counter in BigQuery replizieren zum Join mit Marketing-Daten:

1. **ClickHouse → BigQuery CDC:** Airbyte-Connector synkt `plausible.events` täglich inkrementell zu BigQuery. ClickHouse speichert bereits aggregierte Counter, keine Raw-Events.
2. **dbt-Modell:** In BigQuery eine `fct_pageviews`-Tabelle bauen:

```sql
-- models/fct_pageviews.sql
WITH plausible_raw AS (
  SELECT
    toDate(timestamp) AS date,
    domain,
    pathname,
    referrer_source,
    COUNT(*) AS pageviews,
    uniqExact(visitor_hash) AS unique_visitors
  FROM {{ source('plausible', 'events') }}
  WHERE date >= CURRENT_DATE - 30
  GROUP BY 1, 2, 3, 4
),

marketing_spend AS (
  SELECT
    date,
    channel,
    SUM(spend) AS total_spend
  FROM {{ ref('stg_marketing_spend') }}
  GROUP BY 1, 2
)

SELECT
  p.date,
  p.domain,
  p.pathname,
  p.referrer_source,
  p.pageviews,
  p.unique_visitors,
  m.total_spend,
  SAFE_DIVIDE(p.unique_visitors, m.total_spend) AS visitors_per_dollar
FROM plausible_raw p
LEFT JOIN marketing_spend m
  ON p.date = m.date
  AND p.referrer_source = m.channel
```

In diesem Modell kommt `visitor_hash` nicht zu BigQuery — ClickHouse-Aggregat `unique_visitors` als reiner Zahlenwert. Im Data Warehouse gibt es also keine individuelle Nutzer-Tracking. Join mit Marketing-Spend ergibt „zu dieser Landing Page $X ausgegeben, Y Besucher gekommen". Für Incrementality-Tests können Sie keine Cookie-basierte Randomisierung machen; stattdessen Geo-Level-Split (Kampagne regional an/aus) oder Time-Based-Holdout.

### Live-Dashboard: Aggregierte Metriken

Plausible-Dashboard zeigt Echtzeit-Counter (letzte 30 Minuten Pageviews). In BigQuery für ähnliche Dashboards: Looker Studio + BigQuery-Materialized-View:

```sql
CREATE MATERIALIZED VIEW analytics.mv_realtime_traffic
AS
SELECT
  FORMAT_TIMESTAMP('%Y-%m-%d %H:%M', timestamp, 'Europe/Berlin') AS time_bucket,
  pathname,
  COUNT(*) AS hits,
  APPROX_COUNT_DISTINCT(visitor_hash) AS visitors
FROM plausible.events
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 MINUTE)
GROUP BY 1, 2
```

View materialisiert alle 5 Minuten (BigQuery-MV-Limit). In Looker Studio Line Chart: X-Achse `time_bucket`, Y-Achse `hits`. Auch dieses Dashboard enthält keine User-Level-Daten — nur Aggregations-Counter.

## Compliance-Dokumentation: DSGVO Datenverarbeitungsvertrag

Bei Plausible-SaaS unterzeichnen Sie eine DPA (Data Processing Agreement). Die Plausible-2026-Template enthält:

- **Datenkategorien:** „Aggregierte Website-Traffic-Metriken (Pageview-Anzahl, Referrer-Anzahl, Gerättyp-Verteilung)". Keine persönlichen Identifizierer.
- **Datenverarbeitungszweck:** „Website-Leistungsanalyse und Traffic-Quellen-Attribution". Kein Retargeting, Profiling, automatisierte Entscheidungsfindung.
- **Unterauftragsverarbeiter:** ClickHouse Cloud (EU-Server), Hetzner (Deutschland).
- **Speicherdauer:** 2 Jahre (Dashboard-Anzeige), danach automatische Löschung.
- **Betroffenenrechte:** Aggregierte Daten lassen sich nicht auf einzelne Personen zurückführen; Lösch-/Korrekturanträge nicht anwendbar. DPA-Clause: „Due to aggregation at ingestion, data subject requests cannot be fulfilled on a per-individual basis."

DSGVO-Compliance-Bericht mit Plausible-Architektur: Sie argumentieren gegenüber der Behörde „Wir speichern keine Nutzerdaten, nur aggregierte Counter." GA4 funktioniert nicht so — BigQuery-Export enthält `user_pseudo_id`, das ist „Personenbezogenes Datum."

Bei Self-Hosted: Sie brauchen keine DPA zu unterzeichnen — Sie sind Data Controller. Aber DSGVO Artikel 10 „Technische und organisatorische Maßnahmen": Database Encryption (PostgreSQL TDE), Access Logging (pg_audit), Automated Backup + PITR. Standard-Plausible-Docker hat das nicht — Sie installieren es selbst.

## Plausibles Grenzen: Wann es nicht ausreicht

Plausible **macht keine Funnel-Analyse**. „Produktseite → Warenkorb → Checkout" Schritt-für-Schritt-Dropoff sehen Sie nicht. Sie können Custom Events senden („Add to Cart" Goal-Event) und dessen Häufigkeit s