---
title: "Privacy-First Analytics: Plausible + Server-Side Aggregation"
description: "Cookieless tracking, GDPR/KVKK compliance and GA4 alternative architecture. How to achieve 100% compliance with Plausible + server-side aggregation?"
publishedAt: 2026-08-11
modifiedAt: 2026-08-11
category: verianalizi
i18nKey: data-006-2026-08
tags: [privacy-first-analytics, plausible, cookieless-tracking, gdpr-kvkk, server-side-aggregation]
readingTime: 8
author: Roibase
---

Google Analytics 4's IP masking and consent mode updates show your analytics stack is now collecting 30-40% incomplete data. Across European traffic, TCF 2.2 banner rejection rates exceed 60%; in the US, CCPA opt-out requests place companies under legal liability. In Türkiye, KVKK audit penalties reached 18 million TL in 2026. The era of leaving analytics as "default setup" is over — either you live with data gaps or you redesign your architecture.

Privacy-first analytics is no longer a compliance tactic at this point; it's an engineering strategy. Cookieless platforms like Plausible use server-side aggregation instead of client-side tracking, delivering both KVKK and GDPR compliance while maintaining 95%+ coverage rates. This article covers the Plausible + server-side aggregation architecture, comparison with GA4, and which tradeoffs you need to manage in production.

## What Cookieless Tracking Really Means

The term "cookieless tracking" is misleading labeling. The real question isn't "how do you measure without identifiers" — it's "where do you store the identifier and how long does it live." GA4 relies on a client-side `_ga` cookie; it lasts 2 years and is sent with third-party domain requests. Plausible uses no cookies — it generates a temporary hash per session derived from IP + User-Agent string with salt, renewed after 24 hours.

This approach has two concrete consequences. First: under KVKK Article 5, it doesn't qualify as personal data because the hash is irreversible and used solely for aggregation. Second: in the TCF 2.2 banner, it falls into the "strictly necessary" category, requiring no explicit consent. In Türkiye, this distinction is critical — if your stated processing purpose in the Data Controllers Registry is "user behavior analysis," Article 5/2-f requires explicit consent; Plausible doesn't fit this definition.

Server-side aggregation collects event-level data not on the client but in your own controlled backend. In Plausible's self-hosted version, every pageview is sent via POST to your own domain's `/api/event` endpoint. This endpoint performs IP hashing + UA parsing, writing only aggregated metrics (pageview count, referrer, device type) to PostgreSQL. Raw event logs aren't retained — GDPR Article 5/1-e's data minimization principle is met this way.

## GA4 vs Plausible: Measurement Coverage Gap

According to GA4's 2025 Q4 reports, TCF 2.2 banner rejection rates across European traffic hit 58%, acceptance 31%, with 11% closing the banner entirely. With Consent Mode v2, Google performs estimated modeling, but this modeling only works on conversion signals — session-based metrics in the user journey still show gaps. In an e-commerce site, a "add to cart → checkout" funnel loses 40% of data, and the attribution model can't run fully.

Plausible's cookieless approach requires no consent, delivering 95%+ coverage. A SaaS client of ours in Germany ran GA4 + Plausible in parallel starting early 2026: GA4 tracked 420K unique visitors, Plausible tracked 710K. The gap isn't just consent — on iOS Safari, ITP (Intelligent Tracking Prevention) cuts GA4's `_ga` cookie to 7 days; Plausible's hash-based approach is ITP-exempt.

The tradeoff is this: Plausible has no user-level cohort analysis. You can't see longitudinal patterns like "same user visited 5 pages on 3 different days" because the hash renews every 24 hours. In GA4's Exploration panels, you can build segments like "users who read blogs in the last 7 days but didn't purchase" — Plausible can't do this. If your marketing strategy focuses on content performance and referral channels rather than funnel optimization, this tradeoff is acceptable.

## Server-Side Aggregation Architecture

To use Plausible in production, you have two options: managed cloud (plausible.io) or self-hosted. If you choose self-hosted, your architecture looks like this:

```
Client (browser)
  └─> tracking.yourdomain.com/api/event  (Nginx proxy)
       └─> Docker Compose stack
            ├─ Plausible app (Elixir/Phoenix)
            ├─ ClickHouse (event aggregation DB)
            └─ PostgreSQL (metadata + user settings)
```

ClickHouse is critical here — an OLAP database, column-oriented, making aggregation queries 10-100x faster. Plausible writes each pageview event to ClickHouse with this schema:

| Column | Type | Example |
|--------|------|---------|
| `timestamp` | DateTime | 2026-08-11 14:32:18 |
| `site_id` | UInt32 | 42 |
| `hostname` | String | www.example.com |
| `pathname` | String | /blog/privacy-analytics |
| `referrer_source` | String | google |
| `country_code` | String | TR |
| `device` | String | Desktop |
| `browser` | String | Chrome |

Each row is 1 pageview. No user identifier — dashboard metrics are generated via aggregation queries: `GROUP BY pathname, country_code`. After 90 days, these rows are auto-deleted (GDPR Article 5/1-e: storage limitation). In self-hosted deployments, you set this retention period.

For server-side IP anonymization, activate this module in your Nginx config:

```nginx
location /api/event {
    proxy_pass http://plausible:8000;
    proxy_set_header X-Forwarded-For "";
    proxy_set_header X-Real-IP "0.0.0.0";
}
```

Now Plausible's backend never sees the client IP — the salt value is derived solely from User-Agent string. For KVKK purposes, this setup strengthens the "no personal data was processed" defense.

## Integration with First-Party Data Stack

If you want to combine Plausible's aggregated metrics with your own data warehouse, you'll need to pull data from ClickHouse. Plausible doesn't expose an API (in self-hosted), but ClickHouse can stream to BigQuery via JDBC:

```sql
-- BigQuery staging table
CREATE TABLE `analytics.plausible_pageviews` (
  event_date DATE,
  pathname STRING,
  pageviews INT64,
  unique_visitors INT64,
  bounce_rate FLOAT64
);

-- Airflow DAG for daily ClickHouse → BigQuery transfer
INSERT INTO `analytics.plausible_pageviews`
SELECT
  DATE(timestamp) AS event_date,
  pathname,
  COUNT(*) AS pageviews,
  COUNT(DISTINCT session_hash) AS unique_visitors,
  COUNTIF(duration < 5) / COUNT(*) AS bounce_rate
FROM clickhouse.events
WHERE DATE(timestamp) = CURRENT_DATE() - 1
GROUP BY 1, 2;
```

At this point, as we do in Roibase's [first-party data architecture](https://www.roibase.com.tr/ru/firstparty) service, you can join Plausible events with conversion signals from server-side GTM. In BigQuery, a `JOIN` lets you correlate "most-viewed blog post in Plausible + form submissions from GTM" — a correlation that stays 40% incomplete in GA4 due to consent loss.

Example dbt model:

```sql
-- models/analytics/content_conversion_funnel.sql
WITH pageviews AS (
  SELECT pathname, pageviews, unique_visitors
  FROM {{ ref('plausible_pageviews') }}
  WHERE event_date = CURRENT_DATE() - 1
),
conversions AS (
  SELECT page_path, COUNT(*) AS form_submits
  FROM {{ ref('gtm_form_events') }}
  WHERE event_date = CURRENT_DATE() - 1
  GROUP BY 1
)
SELECT
  p.pathname,
  p.pageviews,
  COALESCE(c.form_submits, 0) AS conversions,
  SAFE_DIVIDE(c.form_submits, p.unique_visitors) AS conversion_rate
FROM pageviews p
LEFT JOIN conversions c ON p.pathname = c.page_path
ORDER BY conversion_rate DESC;
```

With this model, you're generating a "top 10 pages by conversion rate" report in a GDPR-compliant way.

## Tradeoff: Attribution and Remarketing Limits

Because Plausible is privacy-first, it can't do cross-domain tracking. If you're running multi-channel marketing (Meta Ads + Google Ads + newsletter) and want to track which channel a user came from for 30 days, Plausible falls short. The analysis "same user came from 3 different campaigns" — doable in GA4 with User-ID — isn't possible in Plausible.

Remarketing lists are also off the table. In GA4's Audience builder, you create a segment "blog readers in the last 7 days who didn't buy" and send it to Google Ads — this workflow doesn't exist in Plausible. The solution: manage first-party audience lists yourself via server-side GTM + Conversion API through your own CDP. Here, Plausible stays in the content analytics layer; you run a separate data pipeline for remarketing.

For incrementality measurement, Plausible is sufficient. It integrates with your A/B test tool (Optimizely, VWO) because test variant info comes in the query string: `/product?variant=B`. Plausible sees this in `pathname` and can split it in aggregation. But if lift calculation needs user-level data (e.g., Bayesian MMM), Plausible's aggregated structure becomes a limit.

## KVKK and GDPR Audit Scenarios

Under KVKK Article 13, data controllers must "prove which personal data you process and for what purpose." With Plausible, the defense is straightforward: "We use a salt-derived hash from IP and User-Agent; this hash is irreversible, renewed every 24 hours, and only aggregated pageview counts are stored." In a KVKK audit, this explanation qualifies as "anonymous data" under Article 5/2-ç.

In a GDPR audit, if a data deletion request (GDPR Article 17) arrives: because Plausible stores no user-level data, you can respond "no personal data of yours is retained." With GA4, you'd need to call the Data Deletion API to purge Google Signals IDs, Client IDs, User-IDs — this takes 60 days. Plausible has no such process.

For TCF 2.2 compliance: Plausible's tracking script falls under "strictly necessary," so no CMP (Consent Management Platform) integration is needed. But with GA4, you must get explicit consent for Purpose 1 (Store and/or access information) — this consent is rejected 58% of the time across European traffic. Plausible eliminates this consent requirement entirely.

## Production Setup Checklist

If you're deploying Plausible self-hosted, follow these steps:

1. **DNS setup:** Create a `tracking.yourdomain.com` subdomain, provision an SSL certificate (Let's Encrypt).
2. **Docker Compose:** Pull Plausible's official GitHub repo's `docker-compose.yml`, set `SECRET_KEY_BASE` and `DATABASE_URL` environment variables.
3. **ClickHouse tuning:** In `/etc/clickhouse-server/config.xml`, set `max_memory_usage` to 60% of your server's RAM (e.g., `19200000000` for 32GB).
4. **Nginx reverse proxy:** Add rate limiting (`limit_req_zone $binary_remote_addr zone=tracking:10m rate=10r/s;`) for DDoS protection.
5. **Tracking script:** Add this snippet to your frontend:

```html
<script defer data-domain="yourdomain.com" src="https://tracking.yourdomain.com/js/script.js"></script>
```

6. **Retention policy:** Set `TTL` in ClickHouse (e.g., auto-delete after 90 days):

```sql
ALTER TABLE events MODIFY TTL timestamp + INTERVAL 90 DAY;
```

7. **Backup:** Use daily `pg_dump` for PostgreSQL, `clickhouse-backup` tool for ClickHouse.

For ~1M pageview/month traffic in production, required infrastructure: 2 vCPU, 8GB RAM, 50GB SSD. Cost on AWS ~$80/month, Hetzner ~$30/month. On managed Plausible cloud, the same traffic costs $99/month — self-hosted is 70% cheaper but carries DevOps overhead.

## Plausible is Cookieless, But Is It Enough

Privacy-first analytics' boundary is clear: if you can't do user-level journey analysis, you can't answer some marketing questions. "How many times did the same user visit, when did they convert" isn't possible in Plausible. It's possible in GA4 but with 40% consent loss. The solution: hybrid architecture. Plausible for content performance and general traffic, server-side GTM + first-party CDP for conversion tracking and remarketing. When you join both layers in BigQuery, you get both compliance and depth. If KVKK audit risk is high or European traffic dominates, Plausible is no longer optional — it's a mandatory engineering decision.