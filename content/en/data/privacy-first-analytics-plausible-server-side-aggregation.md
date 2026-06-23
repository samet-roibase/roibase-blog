---
title: "Privacy-First Analytics: Plausible + Server-Side Aggregation"
description: "Cookieless tracking, GDPR/KVKK compliance, GA4 comparison. How to build a privacy-focused measurement infrastructure with server-side aggregation architecture."
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: verianalizi
i18nKey: data-006-2026-06
tags: [privacy-first, plausible, server-side-tracking, gdpr, cookieless]
readingTime: 8
author: Roibase
---

By 2026, it's confirmed: Google Analytics 4 in its default configuration does not abandon browser fingerprinting, client-side cookie setting, or IP logging. The EU Data Protection Board's January 2026 guidance classified GA4 as "unusable without explicit consent." Turkey's KVKK's December 2024 amendments to Article 12—effective end-2025—point the same direction: cookie-based analytics requires prior authorization. While performance marketing leans on aggressive attribution stacks, moving the site analytics layer to privacy-first architecture is now operational necessity, not optional. Plausible + server-side aggregation addresses two critical questions: how to measure without cookies, and how to build a compliance-safe server-side pipeline.

## Plausible's Architectural Difference: Aggregated Counters, Not Event Streams

Plausible runs a sub-1 KB JavaScript snippet on the browser—no cookies, no localStorage, no IP logging. When a pageview occurs, a single `POST /api/event` call fires. The raw event reaching the Elixir backend is **aggregated immediately into PostgreSQL** counters—each event increments a unique pageview counter; session identification replaces a session ID with a daily-salted visitor signature hash (IP + User-Agent → HMAC-SHA256 → 24-hour TTL). The visitor recognition logic is deterministic but irreversible: requests from the same device on the same day map to the same visitor hash; when the salt rotates the next day, the link breaks. This approach stays outside KVKK's definition of "identifiable natural person"—even if you knew the hash, you couldn't reverse it to the IP.

GA4's approach differs: GA4 persists a client-side `_ga` cookie for 2 years, writes each hit to an event stream, and in BigQuery export, `user_pseudo_id` = cookie value. Even with Consent Mode v2 active, the cookie is written; data is redacted. In Plausible, the IP never reaches PostgreSQL in raw form—the Elixir process hashes it, then discards the raw IP from memory. This architecture respects GDPR's "purpose limitation" principle: collected data serves only to count site traffic, not to enable retargeting or cross-site tracking.

### Aggregated Counter Structure

Metrics visible on the Plausible dashboard (pageviews, visitors, bounce rate, session duration) don't live in an `events` table. The table schema is:

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

On each incoming event, an `INCREMENT` query executes: if that day, page, and metric combination exists, `+1`; otherwise, `INSERT`. The real-time dashboard reads these counters. Raw event streams are never stored—fully aligning with GDPR's "data minimization" principle: you retain only the data your operation requires.

## Server-Side Proxy: Route Client-to-Plausible Traffic Through Your Own Domain

Plausible's SaaS endpoint is `plausible.io/api/event`. The browser POSTs there. Ad blockers may list `plausible.io`, dropping events. Solution: proxy Plausible events through your own domain via a reverse proxy. Nginx config:

```nginx
location /stats/api/event {
  proxy_pass https://plausible.io/api/event;
  proxy_set_header Host plausible.io;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header X-Forwarded-Proto $scheme;
  
  # IP anonymization — mask final octet
  set $anonymized_ip $remote_addr;
  if ($remote_addr ~* ^(\d+\.\d+\.\d+)\.\d+$) {
    set $anonymized_ip $1.0;
  }
  proxy_set_header X-Forwarded-For $anonymized_ip;
}
```

Frontend script changes:

```html
<script defer data-domain="yourdomain.com" 
  src="/stats/js/script.js"></script>
```

`/stats/js/script.js` is also proxied through Nginx. Event traffic now flows to `yourdomain.com/stats/api/event`, then relayed to the Plausible SaaS backend. Ad blocker bypass cuts ~15–20% measurement loss to near-zero (Plausible's 2025 report). Crucially: the reverse proxy anonymizes the IP before forwarding—the request reaching Plausible's backend carries the final octet as `0`.

### Self-Hosted Plausible: Full Control

Running Plausible on your own server ensures event data never leaves your infrastructure. Docker Compose setup:

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

In the self-hosted setup, Plausible transitioned from PostgreSQL to ClickHouse (v2.0+). Event aggregation speed gained 10x: at 1M events/day, query latency stays under 50 ms. In this architecture, IP hashing and salt rotation are fully under your control—you can write into your KVKK report: "event data never leaves our servers."

## GA4 Comparison: Trade-off Table

| Criterion | Plausible | GA4 |
|---|---|---|
| **Cookie usage** | None | `_ga`, `_ga_*` (2-year persistence) |
| **IP logging** | Hash + 24-hour TTL | Redacted (Consent Mode v2), but BigQuery export contains `user_pseudo_id` = cookie ID |
| **Consent requirement (GDPR)** | No (legitimate interest sufficient) | Yes (explicit opt-in) |
| **Attribution capability** | None—only referrer + UTM | Cross-domain, conversion paths, data-driven attribution |
| **Custom event tracking** | Manual API call (goal events) | Automatic + measurement plan |
| **Cost (10M hits/month)** | Self-hosted: server cost (~$50/mo), SaaS: $19/mo (Business plan) | Free, but BigQuery export incurs GCP costs (~$5/TB per query) |
| **Data ownership** | You (self-hosted) / EU servers (SaaS) | Google (US servers) |

Plausible provides **no attribution**—you can't trace a conversion to its source campaign, only observe "this page had X views, Y unique visitors." If you're running marketing mix modeling or incrementality tests, aggregated traffic changes suffice: correlate traffic variance with sales. But you can't analyze user-level journeys, build cohorts, or examine funnel drop-off. GA4's power lies there—BigQuery export lets you join on `user_pseudo_id` to construct multi-touch attribution.

The trade-off: compliance risk drops to zero, but you lose granular insight. Solution: hybrid stack. Site analytics via Plausible (cookieless), conversion tracking via [first-party data architecture](https://www.roibase.com.tr/en/firstparty) (server-side sGTM + Conversion API). Plausible shows you general traffic trends; decision-critical metrics (ROAS, LTV, CAC) come from the server-side pipeline.

## Server-Side Aggregation Pipeline: Plausible + dbt + BigQuery

In self-hosted Plausible, you have direct access to the ClickHouse database. To replicate event counters to BigQuery for joining with marketing data:

1. **ClickHouse → BigQuery CDC:** Airbyte connector syncs `plausible.events` to BigQuery daily (incremental). ClickHouse already holds aggregated counters; raw events don't exist.
2. **dbt model:** Build `fct_pageviews` in BigQuery:

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

In this model, `visitor_hash` never reaches BigQuery—the ClickHouse aggregate delivers `unique_visitors` as a count. No individual user tracking exists in the data warehouse. Joining with the marketing spend table shows correlations: "we spent $X on this campaign, got Y visitors." For incrementality tests, you can't do cookie-based randomization, so you use geo-level splits (turn campaigns on/off by region) or time-based holdouts.

### Real-Time Dashboard: Aggregated Metrics

Plausible's dashboard displays real-time counters (pageviews in the last 30 minutes). To build a similar BigQuery dashboard, use Looker Studio + BigQuery Materialized View:

```sql
CREATE MATERIALIZED VIEW analytics.mv_realtime_traffic
AS
SELECT
  FORMAT_TIMESTAMP('%Y-%m-%d %H:%M', timestamp, 'Europe/Istanbul') AS time_bucket,
  pathname,
  COUNT(*) AS hits,
  APPROX_COUNT_DISTINCT(visitor_hash) AS visitors
FROM plausible.events
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 MINUTE)
GROUP BY 1, 2
```

The materialized view refreshes every 5 minutes (BigQuery MV ceiling). In Looker Studio, create a line chart: X-axis = `time_bucket`, Y-axis = `hits`. Again, no user-level data—purely aggregated counters.

## Compliance Documentation: KVKK Data Processing Agreement

With Plausible SaaS, you sign a DPA. Plausible's 2026 template covers:

- **Data category:** "Aggregated website traffic metrics (pageview count, referrer count, device type distribution)." Contains no individual identifiers.
- **Processing purpose:** "Website performance analysis and traffic source attribution." Not retargeting, profiling, or automated decision-making.
- **Sub-processors:** ClickHouse Cloud (EU servers), Hetzner (Germany).
- **Retention:** 2 years (for dashboard display), then automatic deletion.
- **Data subject rights:** Aggregated data can't be tied to individuals, so deletion/correction requests don't apply. The DPA explicitly states: "Due to aggregation at ingestion, data subject requests cannot be fulfilled on a per-individual basis."

For your KVKK compliance report, leveraging Plausible's architecture is a plus: tell the authority, "We don't retain user data, only aggregated counters." With GA4, this argument fails—BigQuery exports contain `user_pseudo_id`, which qualifies as "personal data."

In self-hosted mode, you needn't sign a DPA—you're the controller. But KVKK Article 10 requires "technical and administrative safeguards": database encryption (PostgreSQL TDE), access logs (pg_audit), automated backups + point-in-time recovery. Plausible's Docker setup doesn't default to these—you add them yourself.

## Plausible's Limitations: When It Falls Short

Plausible **doesn't do funnel analysis**. You can't visualize step-by-step drop-off: product page → cart → checkout. You can send custom events ("Add to Cart" goal) and see counts, but no sequential flow. For CRO, you'd need additional tools: Hotjar (session replay, but uses cookies) or server-side funnel tracking (aggregate event sequences in sGTM, write to BigQuery).

Plausible **doesn't calculate cohort retention**. You can't answer "of users arriving Jan 1, what % returned on day 7?"—visitor hash changes daily, so user continuity isn't tracked. Retention requires first-party identity: a login event or hashed email. Sending this to Plausible violates GDPR (explicit consent needed), so you build a separate retention layer in your CDP pipeline.

Plausible **has no A/B test reporting**. You can send test variants as custom properties and segment pageviews, but no statistical significance calculation. For Bayesian A/B tests, use Statsig, Optimizely, or compute p-values in-house with Python's `scipy.stats`.

Summary: Plausible suffices for traffic monitoring; conversion optimization and retention engineering demand more. Hybrid stack is mandatory: cookieless general analytics via Plausible, critical business metrics via server-side consented tracking.

---

Privacy-first analytics is both compliance mandate and competitive edge. Saying "we don't use cookies" isn't enough—you must technically prove your architecture is truly cookieless. Plausible + server-side aggregation provides that proof: counting daily visitors via deterministic hash, saving no event stream, never logging IPs. You trade GA4's granular attribution for zero KVKK risk. When you build a server-side pipeline for critical metrics (sGTM + Conversion API + BigQuery), Plausible becomes a complementary layer—your "site health" dashboard. Separating these two tiers is the standard 2026 architecture, both for compliance and operational efficiency.