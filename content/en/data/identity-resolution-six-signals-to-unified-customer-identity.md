---
title: "Identity Resolution: Six Signals to Unified Customer Identity"
description: "Modern solution architectures transforming scattered signals into single customer identity through hash matching, probabilistic linking, and household identity."
publishedAt: 2026-05-12
modifiedAt: 2026-05-12
category: data
i18nKey: data-003-2026-05
tags: [identity-resolution, hash-matching, probabilistic-linking, cdp, first-party-data]
readingTime: 8
author: Roibase
---

The average e-commerce customer appears across 6 different devices and 11 touchpoints before deciding to purchase. GA4 records them as 4 different users, your CRM logs 2 separate leads, and your email platform registers 1 subscriber. In a post-cookie world, without stitching these fragments together, attribution becomes impossible, segmentation meaningless, and customer lifetime value incalculable. Identity resolution is the data engineering discipline that unifies these fragments—requiring a 3-layer architecture spanning from deterministic hash matching to probabilistic linking.

## Hash Matching: Deterministic Identity Backbone

Deterministic matching operates on SHA-256 hashes. The email address "user@example.com" becomes hash "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"—if the same hash exists across systems, it's the same person. You add `user_data.email_sha256` to your server-side GTM event payload the moment a user logs in; in BigQuery, this hash unites a web session, CRM lead, and Klaviyo subscriber in a single row.

Two critical considerations: hash salt strategy and collision risk. Hashing directly without salt creates rainbow table vulnerability, but in marketing data pipelines, salt must remain consistent across systems—otherwise the same email generates different hashes. Collision risk with SHA-256 is theoretical—there's no practical collision in a 2^256 space, but lower-entropy fields like phone numbers weaken determinism. This is why email + phone combinations form a stronger identity backbone.

When pulling data from Klaviyo into BigQuery, add a `user_properties.email_sha256` column; in your dbt model, execute `LEFT JOIN web_events USING (email_sha256)`. This merges anonymous web sessions with subscriber profiles into a single row. Snapshot table strategy matters—hash matches should be stored in daily snapshots because when a user changes email, historical matches shouldn't disappear.

## Probabilistic Linking: Fuzzy Logic for Signal Fusion

Deterministic matching falls short on cookieless mobile web. A user logs out without logging in, never provides email, but an IP + user agent + timezone + language combination suggests an 87% probability it's the same person. This is where probabilistic identity graph enters—you Bayesian weight signal combinations.

Six core signal layers exist: device fingerprint (canvas hash, WebGL renderer), network layer (IP subnet, ASN), behavioral pattern (session duration, path sequence), geolocation (GPS lat/long clustering), temporal signal (active hour pattern), and contextual metadata (referrer domain, UTM consistency). Each signal receives a 0–100 confidence score; if weighted sum exceeds 70, you assign a temporary `probabilistic_id`.

In BigQuery, model it like this:

```sql
WITH signal_scores AS (
  SELECT
    session_id,
    device_fingerprint,
    ip_subnet,
    SUM(
      CASE WHEN device_fingerprint_match THEN 40 ELSE 0 END +
      CASE WHEN ip_subnet_match AND hour_diff < 4 THEN 25 ELSE 0 END +
      CASE WHEN behavior_vector_similarity > 0.8 THEN 20 ELSE 0 END
    ) AS total_confidence
  FROM event_stream
  WHERE timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
)
SELECT session_id, device_fingerprint, total_confidence,
  CASE WHEN total_confidence >= 70 
    THEN GENERATE_UUID() 
    ELSE NULL 
  END AS probabilistic_id
FROM signal_scores
```

The trade-off: false positive risk. Shared devices (office computers) or VPN usage can merge different people. Probabilistic IDs must always be validated against deterministic hashes—when a user logs in, a "merge" operation runs on the hash, correcting past probabilistic sessions.

## Household Identity: Device Cluster to Home Unit

The decision unit often isn't the individual—it's the household. Three devices share the same IP: MacBook (woman uses mornings), iPhone (throughout the day), iPad (child in evenings). Merging these as single "individuals" is wrong, but clustering as "household" is critical for segmentation—especially in durable goods (appliances, furniture) where purchase decisions are family-level.

Household graph routes on router/modem MAC address + IP subnet + GPS location. Network fingerprint, not device fingerprint, becomes the base because WiFi routers emit the same gateway MAC across all connected devices. Critical consideration: public WiFi filtering. Grouping 200 devices from a Starbucks IP as one "household" breaks the model. Filter using session count threshold (same IP, 50+ unique devices → blacklist) and dwelling time patterns (same IP, no 2+ hour sessions → retail location/cafe).

Assign household ID in BigQuery like this:

```sql
CREATE OR REPLACE TABLE households AS
WITH network_clusters AS (
  SELECT ip_subnet, router_mac, GPS_lat, GPS_long,
    APPROX_COUNT_DISTINCT(device_id) AS device_count,
    AVG(session_duration_sec) AS avg_session
  FROM sessions
  WHERE DATE(timestamp) > DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY 1,2,3,4
  HAVING device_count BETWEEN 1 AND 8 AND avg_session > 120
)
SELECT *, GENERATE_UUID() AS household_id
FROM network_clusters
```

Household-level lifetime value makes more sense because appliance purchases aren't individual decisions—they're for the home. In [CDP & Retention Engineering](https://www.roibase.com.tr/en/retention-engineering-cdp) architectures, household segments deliver 23% higher ROAS in campaign targeting than individual segments—because instead of messaging one phone number across scattered devices, the household becomes a strategic unit.

## Graph Stitching: Identity Unification Over Time

Identity graph isn't static—today a user is anonymous, tomorrow they provide email, 5 days later they log in, 2 months later they update phone. Every new signal "stitches" past fragments—meaning old probabilistic IDs merge to the new deterministic hash.

Solve this event-driven: every `user_identified` event lands in Pub/Sub, a Cloud Function triggers, a `MERGE` statement runs in BigQuery. When a user logs in, their email hash arrives; all probabilistic IDs from the past 90 days with matching device fingerprint attach to this hash. Backfill reaches as far back as your attribution window—if you run 30-day conversion windows, stitch back 30 days.

```sql
MERGE INTO unified_identity AS target
USING (
  SELECT probabilistic_id, email_sha256, MAX(timestamp) AS last_seen
  FROM identification_events
  WHERE event_name = 'user_login'
  GROUP BY 1,2
) AS source
ON target.probabilistic_id = source.probabilistic_id
WHEN MATCHED THEN UPDATE SET 
  target.email_sha256 = source.email_sha256,
  target.is_deterministic = TRUE,
  target.stitched_at = CURRENT_TIMESTAMP()
```

Stitching carries race condition risk—simultaneous logins from two devices can conflict merge attempts. Resolve using transaction locks or idempotency keys. Idempotency key is typically `device_id + timestamp_truncated_to_second`—two `user_login` events from the same device within the same second count as duplicate, triggering single merge.

## Privacy + Compliance: Hashed PII and Data Minimization

Identity resolution falls into "automated decision making" and "profiling" under GDPR and similar frameworks—meaning it requires explicit consent. Without `analytics_storage=granted` from your Consent Management Platform (OneTrust, Cookiebot), you can't even collect hashes. Under Consent Mode v2, basic consent keeps `user_data` empty; enhanced consent allows hash inclusion.

Hashes aren't PII but are treated as pseudonymization—so GDPR's "right to be forgotten" requires hash deletion too. When a deletion request arrives in BigQuery, run `DELETE` on `email_sha256` rows and propagate downstream to CDP and CRM. Hash mapping tables must be centralized—scattered hashes across systems instead derive from a single source of truth.

Data minimization principles should cap identity graph at 90 days. Probabilistic IDs older than 90 days move to archive; only deterministic hashes stay long-term. This matters for both compliance and storage cost—BigQuery partition pruning on a rolling 90-day window cuts query cost by 60%.

## Production Pipeline Architecture: Hybrid Batch + Streaming

Identity resolution pipelines operate in two layers: streaming (real-time signal collection) and batch (nightly stitching). Streaming runs Pub/Sub → Dataflow → BigQuery write streaming insert, <10 second latency. Batch runs dbt scheduled jobs at 04:00 AM, executing all graph stitching and household clustering.

Streaming only collects signals—hash matching and probabilistic scoring don't run here because streaming-layer complex JOINs are expensive. Events write to Firestore with `event_id` unique constraints preventing duplicates. Batch reads these events, transforms them in BigQuery into dimensional models. dbt macros chain hash generation, score calculation, and graph merge into a single pipeline.

Monitor graph coverage: `identified_users / total_active_users` ratio. Below 40% signals weak deterministic capture—optimize login flow and focus lead forms on email capture. Above 75% is healthy. Define this metric as a dbt test in `data_tests/identity_coverage.sql` and run before every deployment.

Identity resolution is the backbone of modern marketing stacks. The post-cookie world made deterministic hashing the gold standard, but it's insufficient alone—probabilistic linking and household clustering build a 3-layer identity graph. When modeled in BigQuery with dbt, this pipeline becomes consent-aware, privacy-compliant, and production-ready, enabling attribution models, segmentation strategy, and lifetime value forecasts all grounded in a single unified customer view.