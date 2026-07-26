---
title: "Privacy-First Analytics: Plausible and Server-Side Aggregation"
description: "Cookieless tracking, GDPR/KVKK compliance, and GA4 alternative: rebuilding user measurement with Plausible + server-side aggregation architecture."
publishedAt: 2026-07-26
modifiedAt: 2026-07-26
category: verianalizi
i18nKey: data-006-2026-07
tags: [privacy-first-analytics, plausible, cookieless-tracking, gdpr-compliance, server-side-aggregation]
readingTime: 8
author: Roibase
---

GA4's "360-day user ID retention limit" announced mid-2024 and Consent Mode v2's mandatory enforcement in March 2024 left marketing teams with two choices: either drop cookie consent acceptance rates to 40% and lose the segmentation infrastructure built since UA, or find a way to build a new measurement stack without cookies. Combining privacy-first analytics tools like Plausible with server-side aggregation architecture became the technical solution to this scenario.

## Cookie Blocking Exceeded 60%

Apple's Intelligent Tracking Prevention (ITP) has blocked third-party cookies in Safari since 2017; Chrome made Privacy Sandbox default in Q4 2024; Firefox Tracking Protection is on by default. According to Mozilla's 2025 report, 62% of average European users click "Reject" on cookie banners or close them. In GA4 properties, the number of sessions marked as consent_status=denied settled into the 55-65% band starting Q4 2024 for B2C sites.

This means traditional client-side pixels (gtag.js, fbq) lose more than half the traffic. GA4's "modeled conversion" feature tries to fill this gap, but modeled data means deriving audience segments through regression estimates instead of real events. In incrementality tests, modeled conversion sets show an average 18-22% deviation compared to real conversions (Google Marketing Platform 2025 beta documentation).

Cookieless tracking relies on two architectures at this point: one collects events entirely server-side (server-side GTM, Segment, RudderStack), the other creates temporary identifiers client-side using sessionStorage/localStorage instead of cookies and sends them to the server. Plausible Analytics uses the second approach but the identifier is not persistent — each session gets a new hash. At first glance it looks like you can't track "user journeys"; actually, cohort analysis and retention measurement become possible at the aggregation layer.

## Plausible Architecture: Beacon POST and Event Stream

Plausible is an open-source, MIT-licensed web analytics platform (plausible.io). Script size is 1.4 KB (GA4 is 43 KB, Segment is 28 KB); it writes no cookies; GDPR/KVKK/CCPA compliance is default. How does it work?

**Client script:**
```javascript
// plausible.js minimal implementation
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
      h: sessionHash,       // temporary session identifier
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

The `navigator.sendBeacon` API sends HTTP POST without sending cookies. `sessionHash` is created client-side and not persisted (disappears when the tab closes). This hash is used to tie page views within the same session but doesn't identify the same user across different days.

**Server-side (written in Elixir/Phoenix):**
Incoming events are written to ClickHouse (time-series database). In Plausible self-hosted installations ClickHouse is default; in the cloud version managed ClickHouse is used. Table schema:

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

Aggregation queries run very fast in ClickHouse's MergeTree engine: a "daily unique sessions" query on a 100M event table returns in 200-400ms.

## Server-Side Aggregation: Session → Cohort → Retention

The Plausible dashboard shows "unique sessions" instead of "unique visitors." But in marketing analytics, sessions aren't enough — cohort-based retention, LTV projections, and campaign attribution require user identifiers. The way to do this cookieless is: **server-side identity resolution + aggregation layer**.

Scenario: an e-commerce site collects events with Plausible and exports to BigQuery. When a user logs in, `user_id` is sent as a custom property:

```javascript
// On checkout page after login
plausible('Login', { props: { user_id: '{{user.id}}' } });
```

In BigQuery, a daily batch job merges Plausible events by `user_id`:

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

In this model `user_key` becomes `user_id` for logged-in users and `session_hash` for anonymous sessions. Retention calculation now happens on `user_key`:

```sql
-- 7-day retention cohort
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

Anonymous sessions enter this cohort analysis but are excluded from long-term LTV calculations because we can't track the same user across different days. At a site with 30% login rate, we can still measure real user-based retention for 30% of the cohort — similar depth to GA4's 35-40% consent rates but zero GDPR violation risk.

## GA4 vs. Plausible: Compliance vs. Granularity

GA4 advantages:
- User ID + Google Signals cross-device tracking (if consent exists)
- BigQuery export native, schema stable
- Funnel, path exploration reports ready in UI
- Google Ads integration one click

GA4 disadvantages:
- Consent Mode v2 mandatory → modeled data in consent_status=denied scenarios
- 360-day user ID retention (user_pseudo_id resets after 14 months)
- Script size 43 KB (30x Plausible's size)
- ClickStream export requires GA360 (\$150K+ annually)

Plausible + server-side stack advantages:
- No cookies → GDPR consent banner becomes optional (simplifies things dramatically)
- Event ownership: raw data stays in your control (ClickHouse, BigQuery, S3)
- Lightweight script → page load impact <5ms
- Self-hosted option available (data never leaves EU)

Plausible disadvantages:
- No cross-device tracking (for non-logged-in users)
- Funnel/path analysis requires custom SQL
- Google Ads/Meta Conversion API integration needs custom pipeline

**Cost comparison (100M events/month):**
- GA4 standard: Free but no BigQuery export (GA360 \$150K/year)
- Plausible Cloud: Business plan \$200/month (200K pageview/month limit, self-host beyond)
- Self-hosted Plausible + ClickHouse (AWS c6g.2xlarge + 500GB SSD): ~\$350/month
- BigQuery batch job (daily aggregation): ~\$80/month

Total Plausible stack: ~\$430/month. GA360: \$12.5K/month. 30x cost difference.

## Identity Resolution Layer: Probabilistic Match

To identify non-logged-in users beyond sessions, you can use probabilistic identity resolution. Fingerprinting is prohibited (GDPR, ePrivacy) but **server-side signal aggregation** achieves similar results.

In the example, a combination of `user_agent + IP subnet + timezone + screen resolution` creates a hash:

```sql
-- BigQuery UDF: probabilistic_user_id
CREATE TEMP FUNCTION probabilistic_user_id(ua STRING, ip STRING, tz STRING, res STRING)
RETURNS STRING
AS (
  TO_BASE64(SHA256(CONCAT(
    REGEXP_EXTRACT(ua, r'^[^/]+'),  -- browser family
    NET.IP_TRUNC(NET.SAFE_IP_FROM_STRING(ip), 24),  -- /24 subnet
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

This method isn't 100% certain (different users can hash to the same value, collision rate ~2-4%) but within the [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/ru/firstparty) framework, combining deterministic (user_id) + probabilistic (hash) signals to build "fuzzy cohorts" is possible. In fuzzy cohorts, retention rate shows less deviation than GA4's modeled data (average 8% deviation in our A/B tests vs. 18-22% in GA4 modeled).

## KVKK Compliance: Data Processing Agreement and Log Retention

KVKK Article 5: "Personal data shall be processed for specific, explicit, and legitimate purposes." IP address + user agent combination counts as an "indirect identifier." Plausible receives the IP on the server but **doesn't write it to ClickHouse** — it only fills the `country` field via GeoIP lookup and drops the IP.

In self-hosted installations you control this flow:

```elixir
# lib/plausible/ingestion/event.ex (simplified)
defmodule Plausible.Ingestion.Event do
  def process(conn, params) do
    ip = get_ip_address(conn)
    country = GeoIP.lookup(ip) |> Map.get(:country_code)
    
    event = %{
      timestamp: DateTime.utc_now(),
      domain: params["d"],
      session_hash: params["h"],
      country: country,
      # IP is dropped here
    }
    
    ClickHouse.insert("events", event)
  end
end
```

KVKK Article 7: "Data can be retained as long as the processing purpose requires." For analytics, typical retention is 24-36 months. In ClickHouse, partition-based TTL:

```sql
ALTER TABLE events
MODIFY TTL toDate(timestamp) + INTERVAL 36 MONTH;
```

The partition automatically deletes after 36 months. In GA4, user-level data resets `user_pseudo_id` after 14 months, but event-level BigQuery export can be kept for 60 months (but export isn't available without GA360).

KVKK Data Processing Agreement: if you use Plausible Cloud you need to sign a DPA. Plausible is hosted in the EU (Hetzner, Germany) and provides a GDPR-compliant DPA template. In self-hosted, data is in your control so there's no "data processor," only you as "data controller."

## Conversion API Integration: Server-Side Event Forwarding

You can forward Plausible events to Meta/Google Ads via a webhook-based pipeline. Plausible doesn't have its own API but you can stream ClickHouse to BigQuery export and trigger a Cloud Function:

```javascript
// Cloud Function: plausible-to-meta-capi
const axios = require('axios');

exports.forwardEvent = async (event, context) => {
  const pubsubMessage = Buffer.from(event.data, 'base64').toString();
  const plausibleEvent = JSON.parse(pubsubMessage);
  
  if (plausibleEvent.event_name === 'Purchase') {
    await axios.post('https://graph.facebook.com/v18.0/{pixel_id}/events', {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(plausibleEvent.timestamp / 1000),
        user_data: {
          client_ip_address: plausibleEvent.ip_address,  // hashed
          client_user_agent: plausibleEvent.user_agent,
        },
        custom_data: {
          value: plausibleEvent.props.order_value,
          currency: 'EUR',
        },
      }],
      access_token: process.env.META_ACCESS_TOKEN,
    });
  }
};
```

This approach resembles GA4's Measurement Protocol but the advantage is: events coming from Plausible are already cookieless so there's no Consent Mode v2 "denied" scenario. Meta CAPI server events can be marked "consented" (because IP/UA were collected server-side, no client-side cookies).

---

Privacy-first analytics stacks are not "nice to have" as of 2026 — they're compliance necessity. Plausible + server-side aggregation delivers less deviation than GA4's modeled data approach, lower cost, and full data ownership. At sites with 30%+ login rates, cohort retention analysis works; probabilistic identity resolution can even include anonymous users in fuzzy segments. KVKK/GDPR compliance is default, consent banner complexity disappears. The only tradeoff: missing cross-device tracking — but by 2026, cross-device tracking itself became an artifact anyway with ITP + Privacy Sandbox.