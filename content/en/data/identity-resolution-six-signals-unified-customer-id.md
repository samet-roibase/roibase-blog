---
title: "Identity Resolution: Unifying Six Signals Into One Customer Identity"
description: "Hash matching, probabilistic linking, and household identity—connecting fragmented signals and binding marketing data to decision engines."
publishedAt: 2026-08-04
modifiedAt: 2026-08-04
category: data
i18nKey: data-003-2026-08
tags: [identity-resolution, hash-matching, probabilistic-linking, cdp, first-party-data]
readingTime: 8
author: Roibase
---

A user browses the web anonymously, logs into a mobile app, signs up for a newsletter with a different email, pays with a credit card in-store. Each touchpoint is a separate signal—but to optimize your marketing budget, you must stitch them into a single customer identity. In 2026, cookies are gone, device proliferation is surging, and consent rates hover between 40–60 percent. Identity resolution is no longer nice-to-have; it's the load-bearing pillar of your measurement architecture.

## Hash Matching: Converting Email and Phone Into a Data Graph

Hash matching is the method where you hash user PII (email, phone) with SHA-256 and send it to platform graphs (Google PAIR, Meta Advanced Matching, LiveRamp). Raw PII never touches the browser—it's hashed server-side in GTM or a CDP and passed to Measurement Protocol.

Example flow: a user enters `jane.doe@example.com` at checkout. In your server-side container, JavaScript produces `sha256('jane.doe@example.com')` → `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`, which is appended to the Google Analytics 4 `user_id` parameter. Google compares this hash against its own identity graph—if the user has previously signed into Google Ads, a match occurs and enters the cross-device attribution chain.

SHA-256 is one-way, but without salt, it's vulnerable to rainbow tables. In production, use `sha256(email + pepper)` (pepper: a global secret key, stored in environment variables). In Meta Advanced Matching, the hash + country code combination lifts match rates by 12–18 percent (Meta 2025 benchmark). Hash matching's ceiling is consent—under GDPR, if a user hasn't ticked the "I consent" box, you cannot send even the hash.

### Hash Matching BigQuery Pipeline Example

```sql
-- dbt model: hash_user_pii.sql
WITH raw_signups AS (
  SELECT
    user_id,
    LOWER(TRIM(email)) AS email_normalized,
    REGEXP_REPLACE(phone, r'[^\d]', '') AS phone_normalized,
    created_at
  FROM {{ ref('raw_user_signups') }}
)
SELECT
  user_id,
  TO_HEX(SHA256(CONCAT(email_normalized, '{{env_var("HASH_PEPPER")}}'))) AS email_hash,
  TO_HEX(SHA256(CONCAT(phone_normalized, '{{env_var("HASH_PEPPER")}}'))) AS phone_hash,
  created_at
FROM raw_signups
WHERE email_normalized IS NOT NULL
  AND LENGTH(phone_normalized) >= 10
```

This dbt model is parametrized, the pepper is stored in an environment variable, and downstream it's added to sGTM events in the `user_data` object. Without salt, the PII hash is reversible—pepper is mandatory in production.

## Probabilistic Linking: Fingerprint and Behavioral Graph

When deterministic match (email/phone) is absent, probabilistic linking takes over. You cluster users using device fingerprint (User-Agent, IP, screen resolution, timezone), event sequence patterns, and session duration. If confidence scores drop below 60 percent, stop linking—false positives flow directly into your marketing budget.

Example scenario: two different devices (iPhone Safari, MacBook Chrome) log into your e-commerce site from the same IP within 30 minutes, both browse the same product category, and drop at checkout. The probabilistic engine tags these two sessions as "same household user" with 78 percent confidence. If the iPhone user later completes purchase, confidence rises to 95 percent and they're merged in the identity graph.

Solutions like LiveRamp IdentityLink and The Trade Desk Unified ID 2.0 use hybrid probabilistic + deterministic approaches. The UID2 framework combines email hash + bidstream signals to produce a score (UID2 spec 2025). If you're building your own probabilistic pipeline, experiment with DBscan or hierarchical clustering—but in production, interpretability is critical; rule-based scoring beats blackbox ML.

| Signal Type | Match Confidence | Privacy Risk | Use Case |
|---|---|---|---|
| Email hash (SHA-256 + pepper) | 92–98% | Low (consent required) | Cross-device GA4, Meta CAPI |
| Phone hash (SHA-256 + pepper) | 88–94% | Medium (explicit consent needed) | CRM → ad platform sync |
| IP + User-Agent | 55–70% | High (fingerprinting) | Fraud detection, bot filtering |
| Behavioral sequence (event pattern) | 60–80% | Low (anonymized) | Session stitching, journey mapping |

If you run probabilistic linking in the [CDP & Retention Engineering](https://www.roibase.com.tr/en/retention-engineering-cdp) layer, you can house an anonymized identity graph in your data lake—compliance with data protection regulations becomes straightforward.

## Household Identity: Location-Based Identity, Not Device-Based

Grouping all devices in a home (smart TV, tablet, phone, laptop) under a single household ID is critical—especially in FMCG, telecom, and fintech. You're not identifying a single user; you're defining a "household unit" with purchasing power.

Google's PAIR (Publisher Advertiser Identity Reconciliation) protocol supports household graphs—devices on the same Wi-Fi network (IP + location + timezone match) are aggregated into an advertising signal. But PAIR is consent-dependent: if a user hasn't set "ad_storage=granted" in Consent Mode v2, no household ID is created.

Practical example: a family subscribes to Netflix; mom and dad use separate profiles, kids watch cartoons on the TV. An OTT advertising platform (Roku, Samsung Ads) assigns all three profiles a single household ID and caps ad frequency at the household level, not the device level. Even if the same 30-second ad reaches 15 impressions across devices, the household sees it a maximum of 5 times per week.

### Household ID Rule-Based Pipeline Example

```sql
-- dbt model: household_identity_graph.sql
WITH device_sessions AS (
  SELECT
    device_id,
    ip_address,
    timezone,
    CAST(TIMESTAMP_TRUNC(session_start, HOUR) AS STRING) AS session_hour,
    user_agent
  FROM {{ ref('raw_sessions') }}
  WHERE session_start >= CURRENT_DATE() - 7
),
household_candidates AS (
  SELECT
    ip_address,
    timezone,
    session_hour,
    ARRAY_AGG(DISTINCT device_id) AS devices
  FROM device_sessions
  GROUP BY ip_address, timezone, session_hour
  HAVING COUNT(DISTINCT device_id) > 1
)
SELECT
  FARM_FINGERPRINT(CONCAT(ip_address, timezone)) AS household_id,
  devices,
  ARRAY_LENGTH(devices) AS device_count
FROM household_candidates
```

This model groups devices from the same IP + timezone pair within a 1-hour time window. In production, replace `session_hour` with a 4-hour window (higher probability devices in a home are active simultaneously). For fraud protection, filter out households where `device_count` > 10.

## Identity Graph Synchronization: From Data Lake to Ad Platform

You maintain the identity graph from hash matching and probabilistic linking in BigQuery, but Google Ads, Meta, Klaviyo, and other platforms run their own identity systems. Without a sync layer, identity resolution remains dead data.

Orchestration flow: every night at 02:00, an Airflow DAG runs, pulls records updated in the last 7 days from BigQuery's `identity_graph` table, POSTs email hashes to Google Ads Customer Match API and phone hashes to Meta Conversions API. Rate-limit handling is mandatory—Google Customer Match accepts 500K rows daily, Meta CAPI 1M events daily (2025 standard tier).

Google Ads Customer Match requires a minimum of 1,000 matched users (audience threshold). When you upload email hashes, Google compares them against its graph; match rates typically land between 40–70 percent (quality of provided emails matters). Unmatched hashes don't enter the system—this is why data quality in your [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/en/firstparty) layer must be guaranteed upstream.

In Meta Conversions API, beyond hash matching you can also send `fbc` (Facebook Click ID) and `fbp` (Facebook Browser ID) cookies. If a user clicked a Meta ad and landed on your site, the `fbc` parameter is in the URL (`fbclid=`); capture this server-side and include it in your CAPI event—attribution window extends to 28 days and match rates lift 18–25 percent (Meta 2025 internal benchmark).

## Privacy + Compliance: Identity Resolution's Boundaries

If you build identity resolution without GDPR, CCPA, and other privacy law compliance, your data pipeline carries legal risk. The core rule: you cannot hash user data without explicit consent (GDPR Article 6). Integration with a Consent Management Platform (OneTrust, Cookiebot) is non-negotiable.

In Consent Mode v2, if a user sets "ad_storage=denied", you have no permission to send PII to Google or hash it. In your server-side GTM, listen for the `consent` event; do not invoke `sha256()` until consent is granted. The same rule applies to Meta CAPI—set the `data_processing_options` parameter to "LDU" (Limited Data Use) mode.

Under CCPA, when a "Do Not Sell" signal arrives, remove the user from your identity graph and delete their hashed PII from platform APIs. Google Customer Match and Meta Custom Audience both offer deletion APIs—they remove the hash from their systems within 48 hours (CCPA compliance SLA). Maintain a `user_deletion_requests` table in BigQuery; every night, clean your identity graph against it.

## Observability: Debugging Identity Resolution

Once identity graph enters production, the biggest challenge becomes answering "why didn't these two devices merge?" Without monitoring, you cannot debug.

Create an `identity_resolution_log` table in BigQuery that records metadata for every merge operation: which signals were used (email_hash, phone_hash, ip_fingerprint), what was the confidence score, when was it merged, which downstream platform received it. Use dbt tests to control data quality—for example, alert if a single `household_id` contains more than 50 devices (bot traffic or proxy server).

In Google Analytics 4, open the User-ID report and watch the cross-device user count. If your identity resolution pipeline is working, "users (cross-device)" should be 15–30 percent lower than "total users" (true user count is less than device count). If this gap isn't closing, there's a data leak in hash matching or probabilistic linking—check consent events or hash pepper.

---

Build identity resolution not as a one-time project but as a continuously optimized data pipeline. Combine hash matching + probabilistic linking + household identity to stitch fragmented signals, but design compliance into the foundation—otherwise your data lake becomes a liability. First step: create an `identity_graph` table in BigQuery, build your hash pipeline in dbt, sync to Google Ads Customer Match with Airflow. Next step: tighten your confidence score threshold to 70 percent, measure false positive rate, then expand to Meta and Klaviyo. Without identity resolution, 22–35 percent of your marketing spend leaks into misattribution (Forrester 2025)—build the graph now to claw it back.