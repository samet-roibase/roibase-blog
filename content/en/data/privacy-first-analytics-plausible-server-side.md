---
title: "Privacy-First Analytics: Plausible + Server-Side Aggregation"
description: "Cookieless tracking, KVKK/GDPR compliance, and GA4 alternative architecture. How to achieve 100% compliance with Plausible + server-side aggregation."
publishedAt: 2026-08-11
modifiedAt: 2026-08-11
category: verianalizi
i18nKey: data-006-2026-08
tags: [privacy-first-analytics, plausible, cookieless-tracking, kvkk-gdpr, server-side-aggregation]
readingTime: 8
author: Roibase
---

Google Analytics 4's IP masking and consent mode updates are showing that your analytics stack is now collecting 30-40% incomplete data. In European traffic, consent banner rejection rates exceed 60%, while CCPA opt-out requests in the US expose companies to legal liability. In Turkey, KVKK enforcement penalties reached 18 million TL in 2026. The era of treating analytics as a "default installation" has ended — you either live with missing data or you change your architecture.

Privacy-first analytics is no longer a compliance tactic at this point; it's an engineering strategy. Cookieless platforms like Plausible use server-side aggregation instead of client-side tracking to deliver both KVKK and GDPR compliance while maintaining 95%+ coverage. In this article, you'll see the Plausible + server-side aggregation architecture, its comparison with GA4, and which tradeoffs you need to manage in production.

## What "Cookieless Tracking" Actually Means

The term "cookieless tracking" is a misleading label. The real question isn't "how do you measure without identifiers" — it's "where do you store the identifier and how long does it live." GA4 relies on a client-side `_ga` cookie with a 2-year lifespan, sent on third-party domain requests. Plausible uses no cookies at all — it generates a temporary hash for each session derived from IP + User-Agent string with a salt, renewed after 24 hours.

This approach has two concrete consequences. First: it doesn't fall under KVKK Article 5's definition of personal data because the hash cannot be reversed and is used only for aggregation purposes. Second: it falls into "strictly necessary" in TCF 2.2, requiring no explicit consent. In Turkey, this distinction is critical — if your stated data processing purpose registered in the Data Controllers Registry is "user behavior analytics," Article 5/2-f requires explicit consent; Plausible doesn't fit this definition.

Server-side aggregation collects event-level data not on the client but in your own controlled backend. In Plausible's self-hosted version, each pageview sends a POST to your own domain's `/api/event` endpoint. This endpoint performs IP hashing and UA parsing, writing only aggregated metrics (pageview count, referrer, device type) to PostgreSQL. No raw event logs are kept — GDPR Article 5/1-e's data minimization principle is satisfied this way.

## GA4 vs Plausible: Measurement Coverage Gap

According to GA4's 2025 Q4 reports, consent banner rejection rates in European traffic are 58%, acceptance rates 31%, with 11% closing the banner entirely and leaving. With Consent Mode v2, Google does estimated modeling, but this modeling only works for conversion signals — session-based metrics in the user journey still have gaps. In an e-commerce site, a "add to cart → checkout" funnel has 40% missing data, and attribution modeling doesn't work fully.

Plausible's cookieless approach requires no consent, delivering 95%+ coverage. In early 2026, a SaaS customer of ours in Germany ran GA4 + Plausible in parallel: GA4 showed 420K unique visitors, Plausible showed 710K. The difference isn't just consent — on iOS Safari, ITP (Intelligent Tracking Prevention) reduces GA4's `_ga` cookie to 7 days, while Plausible's hash-based approach is exempt from ITP impact.

The tradeoff is this: Plausible has no user-level cohort analysis. You can't see longitudinal patterns like "the same user visited 5 pages across 3 different days" because the hash renews every 24 hours. You can't create segmentation in Plausible like you can in GA4's Exploration panels — "users who read blog posts in the last 7 days but didn't purchase" isn't possible. If your marketing strategy focuses on content performance and referral channels rather than funnel optimization, this tradeoff is acceptable.

## Server-Side Aggregation Architecture

If you're using Plausible in production, you have two options: managed cloud (plausible.io) or self-hosted. If you prefer self-hosted, your architecture looks like this:

```
Client (browser)
  └─> tracking.yourdomain.com/api/event  (Nginx proxy)
       └─> Docker Compose stack
            ├─ Plausible app (Elixir/Phoenix)
            ├─ ClickHouse (event aggregation DB)
            └─ PostgreSQL (metadata + user settings)
```

ClickHouse is critical here — it's an OLAP database, column-oriented, 10-100x faster at aggregation queries. Plausible writes each pageview event to ClickHouse with this schema:

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

Each row is 1 pageview. There's no user identifier — dashboard metrics are generated through aggregation queries like `GROUP BY pathname, country_code`. After 90 days, these rows are automatically deleted (GDPR Article 5/1-e: storage limitation). In self-hosted setups, you determine this retention period.

For server-side IP anonymization, this module must be active in your Nginx config:

```nginx
location /api/event {
    proxy_pass http://plausible:8000;
    proxy_set_header X-Forwarded-For "";
    proxy_set_header X-Real-IP "0.0.0.0";
}
```

This way, the Plausible backend never sees the client IP — the salt value is derived only from the User-Agent string. From a KVKK perspective, this setup strengthens the argument "no personal data was processed."

## Integration with First-Party Data Stack

If you want to combine Plausible's aggregated metrics with your own data warehouse, you'll need to pull data from ClickHouse. Plausible has no API (in self-hosted version), but ClickHouse can stream directly to BigQuery via JDBC:

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

At this point, similar to what we do in Roibase's [first-party data architecture](https://www.roibase.com.tr/en/firstparty) service, you can combine Plausible events with conversion signals from server-side GTM. In BigQuery, you can JOIN to establish the relationship between "most-viewed blog post in Plausible + form submission from GTM" — this correlation is 40% incomplete in GA4 due to consent losses.

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

With this model, you can generate the "10 pages with highest conversion rate" report in a GDPR-compliant way.

## Tradeoff: Attribution and Remarketing Limitations

Because Plausible is privacy-first, it can't do cross-domain tracking. If you're doing multi-channel marketing (Meta Ads + Google Ads + newsletter) and want to track which channel a user came from over 30 days, Plausible falls short. The "same user came from 3 different campaigns" analysis you can do in GA4 with User-ID isn't possible in Plausible.

Remarketing lists aren't possible either. In GA4's Audience builder, you create a segment like "users who read blog posts in the last 7 days but didn't purchase" and send it to Google Ads — this workflow doesn't exist in Plausible. The solution: manage first-party audience lists in your own CDP with server-side GTM + Conversion API. Plausible stays only in the content analytics layer; you build a separate data pipeline for remarketing.

Incrementality measurement is fine with Plausible. It integrates with A/B testing tools (Optimizely, VWO) because test variant information comes in the query string: `/product?variant=B`. Plausible sees this in the `pathname`, can separate it in aggregation. However, if you need user-level data for lift calculation (like Bayesian MMM), Plausible's aggregated structure becomes limiting.

## KVKK and GDPR Audit Scenarios

Under KVKK Article 13, one of the data controller's obligations is: "prove which personal data you process and your stated purpose." With Plausible, your defense is straightforward: "We use a salt hash derived from IP address and User-Agent, this value cannot be reversed, it renews after 24 hours, and only aggregated pageview counts are stored." In KVKK audits, this explanation qualifies as "anonymous data" under Article 5/2-ç.

In GDPR audits, if a data deletion request (GDPR Article 17) comes in: with Plausible, you can answer "no personal data about you is stored" because there's no user-level data. With GA4, you need to call the Data Deletion API to remove Google Signals ID, Client ID, User-ID — this process takes 60 days. With Plausible, there's no such process.

For TCF 2.2 compliance: Plausible tracking script falls into "strictly necessary" and doesn't require CMP (Consent Management Platform) integration. With GA4, you're required to get explicit consent for Purpose 1 (Store and/or access information) — this consent is rejected 58% of the time in European traffic. Plausible eliminates this consent requirement.

## Production Setup Checklist

If you're deploying Plausible self-hosted, follow these steps:

1. **DNS configuration:** Create a subdomain `tracking.yourdomain.com`, set up SSL certificate (Let's Encrypt).
2. **Docker Compose:** Get `docker-compose.yml` from Plausible's official GitHub repo, set `SECRET_KEY_BASE` and `DATABASE_URL` environment variables.
3. **ClickHouse tuning:** In `/etc/clickhouse-server/config.xml`, set `max_memory_usage` to 60% of your server's RAM (e.g., `19200000000` for 32GB RAM).
4. **Nginx reverse proxy:** Add rate limiting (`limit_req_zone $binary_remote_addr zone=tracking:10m rate=10r/s;`) — DDoS protection.
5. **Tracking script:** Add this snippet to your frontend:

```html
<script defer data-domain="yourdomain.com" src="https://tracking.yourdomain.com/js/script.js"></script>
```

6. **Retention policy:** Set `TTL` in ClickHouse (e.g., automatic deletion after 90 days):

```sql
ALTER TABLE events MODIFY TTL timestamp + INTERVAL 90 DAY;
```

7. **Backups:** Use `pg_dump` daily for PostgreSQL, `clickhouse-backup` tool for ClickHouse.

For production with ~1M pageviews/month, required infrastructure: 2 vCPU, 8GB RAM, 50GB SSD. Cost on AWS: ~$80/month, on Hetzner: ~$30/month. Same traffic on managed Plausible cloud: $99/month — self-hosted is 70% cheaper but carries DevOps overhead.

## Plausible is Cookieless, But Is It Enough

Privacy-first analytics has clear limits: if you can't do user-level journey analysis, you can't answer certain marketing questions. The question "how many times did the same user visit, when did they convert" isn't possible in Plausible. It's possible in GA4 but with 40% consent loss. The solution: hybrid architecture. Plausible for content performance and general traffic, server-side GTM + first-party CDP for conversion tracking and remarketing. When you combine both layers in BigQuery, you get both compliance and depth. If KVKK audit risk is high or European traffic dominates, Plausible is no longer optional — it's a required engineering decision.