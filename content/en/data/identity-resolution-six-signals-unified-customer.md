---
title: "Identity Resolution: From 6 Signals to a Single Customer Identity"
description: "How to unify fragmented touchpoints into one customer identity using hash matching, probabilistic linking, and household identity. Server-side pipeline and practical schema."
publishedAt: 2026-07-19
modifiedAt: 2026-07-19
category: data
i18nKey: data-003-2026-07
tags: [identity-resolution, hash-matching, probabilistic-linking, cdp, first-party-data]
readingTime: 8
author: Roibase
---

A user clicks a campaign from mobile, adds a product to cart on desktop, purchases in-store. These three signals represent three separate identities: `device_id`, `cookie_hash`, `email_hash`. Identity resolution is the data pipeline that consolidates these fragments into a single customer profile. In the post-cookie era — Consent Mode v2, iOS ATT, CCPA — server-side architecture built on first-party data has shifted from recommendation to requirement.

## Why six different signals exist

The modern marketing stack collects identity signals across six layers: **browser cookie**, **device ID** (IDFA/GAID), **authenticated hash** (email SHA-256), **customer ID** (CRM/CDP internal), **IP+user-agent fingerprint**, **household graph**. Each activates at a different lifecycle stage.

Browser cookie fires at first touchpoint; device ID on mobile app; authenticated hash when email or phone is collected; customer ID post-checkout; fingerprint enables probabilistic matching without consent; household graph groups devices on the same router. The problem: these six signals live in separate tables with different TTLs (cookie 90 days, IDFA indefinite, email hash until customer deletion). Without resolution, each channel counts different users — marketing mix models double-count, incrementality tests overestimate, retention cohorts show false churn.

Resolution logic operates via two methods: **deterministic (hash matching)** and **probabilistic (graph linking)**. Deterministic: an email SHA-256 hash links a browser event to a backend transaction with 100% certainty. Probabilistic: if the same IP+user-agent appears in two events within 24 hours, the match probability is ~73% (at standard threshold). Skip resolution entirely and your unique user count inflates by 40-80% (category and device mix dependent).

## Hash matching: converting email and phone to identity keys

Hash matching is the backbone of server-side identity resolution. The moment a user provides email or phone, client-side or sGTM produces a SHA-256 hash, writing it to `identity_map`. Subsequent anonymous events lookup by cookie or device ID, retrieving the hash.

Simple `identity_map` schema:

```sql
CREATE TABLE identity_map (
  canonical_id STRING NOT NULL,      -- UUID, internal ID
  signal_type STRING NOT NULL,       -- 'email_sha256', 'phone_sha256', 'device_id', 'cookie'
  signal_value STRING NOT NULL,      -- hash or ID
  first_seen TIMESTAMP,
  last_seen TIMESTAMP,
  PRIMARY KEY (signal_type, signal_value)
);
```

When a user enters `user@example.com` in a signup form, sGTM SHA-256 hashes the email and performs an `INSERT`: `('uuid-123', 'email_sha256', 'abc123...', NOW(), NOW())`. If the same session carries cookie `_ga=GA1.1.xyz`, a second row follows: `('uuid-123', 'cookie', 'GA1.1.xyz', NOW(), NOW())`. Now `canonical_id = uuid-123` binds two signals.

Next session: the user arrives with `_ga=GA1.1.xyz` alone, no email. BigQuery lookup:

```sql
SELECT canonical_id
FROM identity_map
WHERE signal_type = 'cookie' AND signal_value = 'GA1.1.xyz'
LIMIT 1;
```

Returns: `uuid-123`. Attribute the event to this ID — same user recognized without the email hash. Hash matching precision is 100% because cryptographic collision is infeasible. The coverage problem remains: if the user never provides email, no hash exists, and you fall back to probabilistic.

### Collision risk and salt

SHA-256 collision risk is theoretical: 1 in 2^128 attempts. Production's real issue: **the same email linked to different canonical_ids** (manual error, legacy migration artifact). This is why you enforce `UNIQUE INDEX (signal_type, signal_value)`. Using salt (email + secret string, then hash) doesn't increase collision risk but adds a privacy layer in [first-party data architecture](https://www.roibase.com.tr/en/firstparty) — rotate the salt and old hashes become invalid, supporting GDPR "right to be forgotten".

## Probabilistic linking: IP, user-agent, and device graph

If a user browses anonymously, deterministic signals don't exist. Deploy **probabilistic graph**: IP + user-agent + timestamp proximity generates a "likely same person" score. Example: same IP, same user-agent, 15-minute gap between two events — 85% probability of the same user.

Simple probabilistic merge logic:

```sql
WITH anon_events AS (
  SELECT
    event_id,
    ip_address,
    user_agent,
    event_timestamp,
    FARM_FINGERPRINT(CONCAT(ip_address, user_agent)) AS fingerprint
  FROM events
  WHERE canonical_id IS NULL
),
clusters AS (
  SELECT
    fingerprint,
    MIN(event_timestamp) AS first_event,
    MAX(event_timestamp) AS last_event,
    COUNT(*) AS event_count
  FROM anon_events
  GROUP BY fingerprint
  HAVING TIMESTAMP_DIFF(MAX(event_timestamp), MIN(event_timestamp), HOUR) < 24
)
SELECT
  a.event_id,
  c.fingerprint AS probable_cluster_id
FROM anon_events a
JOIN clusters c ON a.fingerprint = c.fingerprint;
```

This query groups events by IP+UA hash within a 24-hour window. Use the cluster ID as a provisional `canonical_id`, but add confidence: `event_count > 3 AND time_span < 1 HOUR → confidence=0.9`.

**Household graph:** Different user-agents from the same IP (laptop, tablet, phone) likely share a home. Create a `household_id` and nest individual `canonical_id` beneath it. Example: Amazon Prime household — 1 subscription, 6 profiles — identity resolution aggregates at household level.

### False positive rate

Probabilistic linking carries false-positive risk. The same IP + user-agent can come from two different users (office WiFi, library). Threshold too loose (50% confidence) and you see 15-25% false positives. Industry best practice: 75%+ confidence threshold, 1-hour time window, minimum 2 matching events. Vendors like LiveRamp use graph databases (Neo4j) combining 30+ signals, claiming 95%+ accuracy — but on your own first-party pipeline, 2-3 signals yield 80% accuracy sufficient.

## Server-side pipeline: sGTM + BigQuery + dbt

In production, identity resolution follows this data flow:

1. **sGTM event ingestion:** Client-side GTM event reaches sGTM; if email present, sGTM appends SHA-256 hash; raw event writes to BigQuery (`events_raw`).
2. **dbt staging model:** `stg_events` cleans `events_raw`, parsing `signal_type` and `signal_value` columns.
3. **dbt identity_map merge:** When a new hash appears, `MERGE` executes against `identity_map` (upsert logic).
4. **dbt canonical_id enrichment:** Each event joins `identity_map`; `canonical_id` lookup resolves.
5. **dbt aggregation:** User-level metrics (`user_ltv`, `session_count`) aggregate by `canonical_id`.

Example dbt model snippet (`models/staging/stg_events.sql`):

```sql
{{ config(materialized='incremental') }}

WITH events_with_signals AS (
  SELECT
    event_id,
    event_timestamp,
    COALESCE(user_properties.email_sha256, NULL) AS email_hash,
    COALESCE(user_properties.ga_client_id, NULL) AS cookie_id,
    event_params
  FROM {{ source('bigquery', 'events_raw') }}
  {% if is_incremental() %}
  WHERE event_timestamp > (SELECT MAX(event_timestamp) FROM {{ this }})
  {% endif %}
)
SELECT * FROM events_with_signals;
```

The incremental model runs hourly, processing the latest batch. Identity merge logic lives in a separate model (`models/core/fct_identity_resolved.sql`):

```sql
SELECT
  e.event_id,
  COALESCE(im_email.canonical_id, im_cookie.canonical_id) AS canonical_id,
  e.event_timestamp
FROM {{ ref('stg_events') }} e
LEFT JOIN {{ ref('identity_map') }} im_email
  ON e.email_hash IS NOT NULL
  AND im_email.signal_type = 'email_sha256'
  AND im_email.signal_value = e.email_hash
LEFT JOIN {{ ref('identity_map') }} im_cookie
  ON e.cookie_id IS NOT NULL
  AND im_cookie.signal_type = 'cookie'
  AND im_cookie.signal_value = e.cookie_id;
```

This join logic executes deterministic hash matching. For probabilistic matching, add a separate `fct_probabilistic_clusters` model.

## Consent and privacy: GDPR, CCPA compliance

Identity resolution falls under GDPR Article 6 (lawful basis) and CCPA "do not sell" rules. Email hash qualifies as **personal data** (CJEU 2019 ruling), requiring consent or legitimate interest.

Under Consent Mode v2, if a user sets analytics_storage=denied, you cannot collect the email hash. In this case, rely on IP+UA fingerprint alone (legitimate interest scope — though CJEU interpretation remains contested). Best practice: add a `consent_status` column to `identity_map`, writing hash only from analytics_storage=granted events.

For CCPA "right to delete," implement cascade deletion by `canonical_id`:

```sql
DELETE FROM identity_map WHERE canonical_id = 'uuid-123';
DELETE FROM events WHERE canonical_id = 'uuid-123';
```

Use foreign key constraints for cascade (BigQuery doesn't support them natively; Postgres/Snowflake do). Alternative: soft delete (`deleted_at TIMESTAMP`) followed by batch purge.

### TCF 2.2 vendor mapping

Under IAB TCF 2.2, identity resolution falls under "Purpose 1 — Store and/or access information on a device". If the user hasn't consented to your vendor list, cross-device linking is forbidden. In Roibase projects, we parse the TCF string in BigQuery, writing `vendor_consent` columns, then filter identity merges by consent:

```sql
WHERE vendor_consent LIKE '%vendor_id=123%'
```

This logic prevents identity graph construction without consent — balancing compliance and data quality.

## CDP integration: Segment, mParticle, Rudderstack

Modern CDPs provide their own identity graphs, but typically as black boxes. Building your own pipeline gives you control — especially critical in [CDP & Retention Engineering](https://www.roibase.com.tr/en/retention-engineering-cdp) work. Segment's `identify()` call merges `userId` and `anonymousId`, but which signal takes priority? In your resolution logic, make the priority explicit:

1. `customer_id` (CRM) → most trusted
2. `email_sha256` → deterministic
3. `device_id` → cross-session, not cross-device
4. `cookie` → shortest TTL
5. `fingerprint` → probabilistic fallback

Encode this priority in dbt via a `COALESCE()` chain. Send only the final `canonical_id` and `confidence_score` to the CDP; keep merge logic on your side.

Identity resolution is the foundational layer of modern marketing data architecture. Hash matching delivers deterministic certainty; probabilistic linking ensures coverage; household graph unlocks family-level segmentation. When your server-side pipeline — respecting consent and privacy rules — unifies these six signals, unique user accuracy improves by 40%, retention cohort errors vanish, incrementality tests become reliable. By building resolution logic in BigQuery + dbt + sGTM rather than trusting vendor black boxes, you control the graph entirely.