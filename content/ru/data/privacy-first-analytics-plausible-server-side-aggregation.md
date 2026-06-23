---
title: "Privacy-First Analytics: Plausible + Server-Side Aggregation"
description: "Cookieless tracking, GDPR/KVKK compliance, GA4 comparison. How to build privacy-focused measurement infrastructure with server-side aggregation architecture."
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: verianalizi
i18nKey: data-006-2026-06
tags: [privacy-first, plausible, server-side-tracking, gdpr, cookieless]
readingTime: 8
author: Roibase
---

By 2026, Google Analytics 4's default setup has solidified its reliance on browser fingerprinting, client-side cookie setting, and IP logging without compromise. The EU Data Protection Board's January 2026 guidance classified GA4 as "unusable without explicit consent"—a category shift with operational weight. Turkey's KVKK, with its December 2025 amendment to Article 12, mandates prior approval for cookie-based analytics. Performance marketing leans on aggressive attribution stacks, but shifting the site analytics layer to privacy-first architecture is now operational necessity, not option. Plausible + server-side aggregation addresses two critical questions: how to measure without cookies, and how to build compliance-safe server infrastructure.

## Plausible's Architectural Difference: Aggregated Counters, Not Event Streams

Plausible runs a sub-1 KB JavaScript snippet on the browser—no cookie, no localStorage, no IP logging. When a pageview occurs, it sends a `POST /api/event` call. The raw event hitting the Elixir backend is **immediately aggregated** in PostgreSQL: each event increments a unique pageview counter; session identification uses a daily salt-based hash of IP + User-Agent (HMAC-SHA256, 24-hour TTL). Recognition logic is deterministic but irreversible—requests from the same device the same day map to the same visitor hash; when the salt rotates the next day, the link breaks. This method stays outside KVKK's "identifiable natural person" definition: even with the hash, you cannot reverse to the original IP.

GA4's approach: the client-side `_ga` cookie persists a 2-year client ID, each hit writes to an event stream, and BigQuery exports show `user_pseudo_id` = cookie value. Even with Consent Mode v2, the cookie is written. Plausible does not store raw IPs in PostgreSQL—the Elixir process hashes the IP, raw IP is cleared from memory. This architecture honors GDPR's "purpose limitation": collected data serves only traffic counting, not retargeting or cross-site tracking.

### Aggregation Counter Structure

Plausible's dashboard metrics (pageview, visitor, bounce rate, session duration) do not live in the `events` table. Table structure:

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

Each incoming event triggers an `INCREMENT` query: if the day, page, and metric combination exists, `+1`; if not, `INSERT`. The real-time dashboard reads these counters. Raw event streams are never stored, satisfying GDPR's "data minimization" principle—your data is proportional to your purpose.

## Server-Side Proxy: Route Client-to-Plausible Traffic Through Your Domain

Plausible's SaaS endpoint is `plausible.io/api/event`. Browsers POST there. Ad blockers add `plausible.io` to their blocklist, causing event loss. Solution: pipe Plausible events through a reverse proxy on your domain. Nginx config:

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

The frontend script changes:

```html
<script defer data-domain="yourdomain.com" 
  src="/stats/js/script.js"></script>
```

`/stats/js/script.js` is also proxied from Nginx. Event traffic now goes to `yourdomain.com/stats/api/event`, then forwarded to Plausible's SaaS backend. Ad blocker bypass eliminates 15–20% of measurement loss (per Plausible's 2025 report). Critically: the reverse proxy anonymizes IP before forwarding—the Plausible backend receives requests with the final octet as `0`.

### Self-Hosted Plausible: Full Control

Running Plausible on your own servers keeps event data off any third-party endpoint. Docker Compose setup:

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

In self-hosted setups, Plausible graduated from PostgreSQL to ClickHouse (v2.0 onward). Event aggregation speed scales 10x: at 1M events/day, query latency stays <50 ms. IP hashing and salt rotation are fully under your control—your KVKK compliance statement can say "event data never leaves our servers."

## GA4 Comparison: The Trade-off Table

| Criterion | Plausible | GA4 |
|---|---|---|
| **Cookie usage** | None | `_ga`, `_ga_*` (2-year TTL) |
| **IP logging** | Hash + 24h TTL | Redacted (Consent Mode v2) but BigQuery export shows `user_pseudo_id` = cookie ID |
| **Consent required (GDPR)** | No (legitimate interest sufficient) | Yes (explicit opt-in) |
| **Attribution capability** | None—referrer + UTM only | Cross-domain, conversion path, data-driven attribution |
| **Custom event tracking** | Manual API call (goal event) | Automatic + measurement plan |
| **Cost (10M hits/month)** | Self-hosted: server cost (~$50/mo); SaaS: $19/mo (Business) | Free but BigQuery export costs GCP (~$5/TB per query) |
| **Data ownership** | You (self-hosted) / EU servers (SaaS) | Google (US servers) |

Plausible offers **no attribution**—you cannot see which campaign sourced a conversion, only that "this page had X views, Y unique visitors." For [first-party data architecture](https://www.roibase.com.tr/ru/firstparty) teams running mix modeling or incrementality tests, aggregated traffic variance suffices. But user-level journeys, cohort analysis, and funnel drop-off are impossible. GA4's strength is there—BigQuery exports let you join on `user_pseudo_id` and build multi-touch attribution.

The trade-off: zero compliance risk for lost granularity. Hybrid solution: site analytics via Plausible (cookieless), conversion tracking via [server-side first-party architecture](https://www.roibase.com.tr/ru/firstparty) (sGTM + Conversion API). Plausible shows traffic trends; decision-level metrics (ROAS, LTV, CAC) come from the server pipeline.

## Server-Side Aggregation Pipeline: Plausible + dbt + BigQuery

In self-hosted Plausible, direct ClickHouse access allows replicating event counters to BigQuery for join with marketing data:

1. **ClickHouse → BigQuery CDC:** Airbyte connector syncs `plausible.events` daily (incremental). ClickHouse already holds aggregated counters, not raw events.
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

`visitor_hash` never reaches BigQuery—only the ClickHouse aggregate count `unique_visitors`. No individual user tracking in the warehouse either. Joining with marketing spend reveals "this landing page cost X dollars, brought Y visitors"—enough for incrementality tests. For control/treatment splits, cookie-based randomization is unavailable; use geo-level splits (campaign on/off by region) or time-based holdouts instead.

### Real-Time Dashboard: Aggregated Metrics

Plausible's dashboard shows real-time counters (last 30 minutes of pageviews). In BigQuery, build similar dashboards with Looker Studio + Materialized Views:

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

Materialize refreshes every 5 minutes (BigQuery MV limit). Looker Studio line chart: X = `time_bucket`, Y = `hits`. Again, no user-level data—aggregated counters only.

## Compliance Documentation: KVKK Data Processing Agreement

For Plausible SaaS, you sign a DPA. Plausible's 2026 template covers:

- **Data category:** "Aggregated website traffic metrics (pageview count, referrer count, device distribution)". No individual identifiers.
- **Processing purpose:** "Website performance analysis and traffic attribution". Not retargeting, profiling, or automated decisions.
- **Sub-processor:** ClickHouse Cloud (EU), Hetzner (Germany).
- **Retention:** 2 years (for dashboard display), then auto-delete.
- **Data subject rights:** Aggregated data cannot link to individuals, so deletion/correction requests are inapplicable. The DPA explicitly states: "Due to aggregation at ingestion, data subject requests cannot be fulfilled on a per-individual basis."

In your KVKK compliance report, Plausible's architecture strengthens your case: "We do not store user data; we maintain aggregated counters only." This argument fails for GA4—BigQuery exports contain `user_pseudo_id`, classified as personal data.

Self-hosted means no DPA signature needed—you are the controller. But KVKK Article 10 mandates "technical and administrative safeguards": database encryption (PostgreSQL TDE), access logs (pg_audit), automated backup + PITR. Default Plausible Docker lacks these—add them yourself.

## Plausible's Limitations: When It Falls Short

Plausible **does not offer funnel analysis**. You cannot see "product page → cart → checkout" drop-off step-by-step. Custom events ("Add to Cart" goal) show counts but not sequential flow. For CRO funnel optimization, use supplementary tools: Hotjar (session replay, but cookie-based) or server-side funnel tracking (aggregate event sequences in sGTM, send to BigQuery).

Plausible **cannot compute cohort retention**. "25% of users acquired on January 1st returned on day 7"—impossible, because visitor hash changes daily; user continuity is untrackable. Retention requires first-party identity: login event or hashed email. Sending this to Plausible violates GDPR (explicit consent required), so build retention in a separate layer—your CDP pipeline.

Plausible **has no A/B test reporting**. Send test variants to Plausible as custom properties and segment pageviews by variant, but statistical significance is absent. For Bayesian A/B tests, use Statsig, Optimizely, or compute p-values server-side (Python `scipy.stats`).

Summary: Plausible suffices for traffic monitoring, not for conversion optimization or retention engineering. Hybrid stack is mandatory: cookieless general analytics (Plausible) + server-side consented tracking for critical business metrics.

---

Privacy-first analytics is both compliance obligation and competitive edge. Saying "we don't use cookies" is incomplete—you must technically prove your architecture is genuinely cookieless. Plausible + server-side aggregation delivers that proof: event streams never logged, no IP recording, daily visitor counting via deterministic hash. You trade GA4's granular attribution for zero KVKK risk. When you build server-side pipelines for critical metrics (sGTM + Conversion API + BigQuery), Plausible becomes a complementary layer—your "general site health" dashboard. Separating these two tiers is the 2026 standard for both compliance and operational efficiency.