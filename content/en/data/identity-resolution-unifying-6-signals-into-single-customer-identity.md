---
title: "Identity Resolution: From 6 Signals to Single Customer Identity"
description: "Hash matching, probabilistic linking, and household clustering to unify fragmented touchpoints into one customer identity. Production identity graph architecture essentials."
publishedAt: 2026-07-03
modifiedAt: 2026-07-03
category: data
i18nKey: data-003-2026-07
tags: [identity-resolution, data-engineering, cdp, first-party-data, customer-identity]
readingTime: 8
author: Roibase
---

Cookies are gone, login rates hover at 8%, each device carries a different ID, every channel records another signal. The average e-commerce customer leaves 6 distinct touchpoints across their purchase journey—yet platforms record them as 6 different people. Marketing data's biggest problem: one person's digital identity fragmented into 6 pieces. Identity resolution is the engineering discipline that reassembles these fragments through hash matching, probabilistic linking, and household clustering. Building a production identity graph isn't just technical; it's balancing privacy + performance + accuracy.

## What Identity Resolution Is and Why It's Critical Now

Identity resolution merges signal fragments from different sources—email hash, device ID, browser fingerprint, IP address, session cookie—under a single customer profile. By 2026, with Google Chrome phasing out third-party cookies entirely, Safari's ITP 2.3 cutting storage to 7 days, and iOS 14.5 leaving IDFA opt-in rates around 15%, cross-device tracking can no longer rely on platform-dependent technology. It's now a deterministic + probabilistic data engineering problem.

Roibase's Q4 2025 analysis of Shopify Plus clients showed the same user generates an average of 3.2 anonymous IDs across mobile web, desktop, and app. When that customer reaches checkout and enters their email, the "merge" finally happens. But if you can't link the 4-5 pre-checkout touchpoints to the same person, your attribution model breaks—last click wins, the real journey disappears. Identity resolution is therefore the infrastructure layer of modern marketing measurement. By combining deterministic (email, phone: exact match) + probabilistic (IP + user-agent + timezone: confidence scoring) methods, you target 85%+ match accuracy.

Moving this discipline to production requires a 3-layer architecture: signal collection (raw event stream), identity stitching (graph engine), profile unification (CDP layer). Each layer balances privacy compliance (TCF 2.2, KVKK consent) and performance (real-time vs. batch resolution tradeoff).

## Hash Matching: The Core of Deterministic Identity

Hash matching is the most reliable identity resolution method: you SHA256-hash the user's email or phone number from incoming data, then match those hashes against hashes in other systems. Accuracy approaches 100% because collision risk is negligible—same hash = same email. But three critical conditions apply: (1) you must have collected the user's PII (form submission, login), (2) consent is required (GDPR 6(1)(a) or legitimate interest), (3) hash standards must be consistent across systems (lowercase + trim + UTF-8 encoding).

In Roibase's [CDP & retention engineering](https://www.roibase.com.tr/en/retention-engineering-cdp) projects, we deploy this pipeline:

```sql
-- Email hash standardization in BigQuery
CREATE OR REPLACE FUNCTION `project.dataset.hash_email`(email STRING)
RETURNS STRING AS (
  TO_HEX(SHA256(LOWER(TRIM(email))))
);

-- Event table enrichment with email hash
SELECT
  event_timestamp,
  user_pseudo_id,
  `project.dataset.hash_email`(user_properties.email) AS email_hash,
  device.category,
  traffic_source.medium
FROM `analytics_123456789.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260601' AND '20260630'
  AND user_properties.email IS NOT NULL;
```

Write this hash to your CDP (Segment, mParticle) and events from different devices merge under the same `email_hash`. Example scenario: a user subscribes to your newsletter on Monday desktop (you collect email), browses anonymously Wednesday mobile, logs in Thursday desktop and purchases. Without email hash, you'd see 3 user_ids; with hash matching, 1 profile, 3 sessions, clear journey.

**Tradeoff:** Hash matching only works on authenticated users. E-commerce sites average 8-12% login rates, so 88-92% of traffic remains anonymous. Probabilistic methods handle that segment.

## Probabilistic Linking: Statistically Matching Signals

Probabilistic identity resolution calculates a "likely same person" confidence score from combinations of signals. You combine IP address + user-agent + timezone + session behavior patterns and accept a match above ~80% confidence threshold. Accuracy doesn't rival deterministic matching (false positive rate: 5-10%) but covers anonymous traffic.

Algorithm logic: each signal carries a weight. A stable IP (home/office network) = +0.3, a rare user-agent + timezone combo = +0.25, session behavior matching a previous profile at 90% similarity = +0.4. Score >0.8 and you link two sessions to the same identity node. This doesn't run real-time—batch jobs recalculate the graph once or twice daily.

Roibase's probabilistic pipeline in gaming vertical works like this:

```sql
-- Fingerprint generation (simplified)
WITH fingerprints AS (
  SELECT
    user_pseudo_id,
    event_date,
    NET.IP_TO_STRING(NET.SAFE_IP_FROM_STRING(user_first_touch_timestamp)) AS ip_prefix,
    device.operating_system,
    device.browser,
    geo.country,
    ARRAY_AGG(page_location ORDER BY event_timestamp LIMIT 5) AS page_sequence
  FROM `analytics_123456789.events_*`
  WHERE _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  GROUP BY 1,2,3,4,5,6
)
SELECT
  a.user_pseudo_id AS user_a,
  b.user_pseudo_id AS user_b,
  -- Jaccard similarity on page sequence
  (SELECT COUNT(*) FROM UNNEST(a.page_sequence) AS p WHERE p IN UNNEST(b.page_sequence)) 
    / (ARRAY_LENGTH(a.page_sequence) + ARRAY_LENGTH(b.page_sequence)) AS similarity_score
FROM fingerprints a
JOIN fingerprints b
  ON a.ip_prefix = b.ip_prefix
  AND a.operating_system = b.operating_system
  AND a.user_pseudo_id != b.user_pseudo_id
WHERE similarity_score > 0.75;
```

This query finds users with the same IP + OS combo and page sequence 75%+ similar, then writes the score to a graph database (Neo4j or BigQuery graph tables) as edge weight.

**Risk:** Shared IPs (cafes, offices) and generic user-agents (iPhone 15 + Safari) spike false positives. That's why household-level resolution sits in a separate layer.

## Household Identity: Distinguishing Different People on Same Network

Household clustering solves the problem of different individuals sharing an IP/device network. A home Wi-Fi serves mom, dad, and kids—probabilistic matching could merge them into one profile. You prevent this by examining behavioral divergence signals: product category preference, session timing (10 AM vs. 11 PM), scroll speed, keyboard typing patterns (biometric, but sensitive under GDPR).

Roibase's household model in telecom looks like this:

1. **IP-level clustering:** Group all sessions from the same IP under one "household node."
2. **Behavioral segmentation:** Convert each session to a feature vector (product_category, avg_session_duration, bounce_rate, hour_of_day).
3. **K-means clustering:** Create 2-3 clusters within household—each cluster is a "sub-identity."
4. **Validation:** When email hash arrives, confirm or re-distribute the sub-identity.

Example table structure:

| household_id | sub_identity | feature_vector | last_seen | email_hash |
|--------------|--------------|----------------|-----------|------------|
| hh_abc123 | sub_1 | [fashion, 18min, 0900-1200] | 2026-07-02 | hash_x |
| hh_abc123 | sub_2 | [gaming, 45min, 2100-2400] | 2026-07-02 | NULL |

This keeps two household members in separate profiles. When email hash arrives (say, the child logs in), `sub_2` solidifies; `sub_1` remains probabilistic.

**Tradeoff:** Clustering compute is expensive—reprocessing all households daily is heavy lifting. We run the batch job overnight, taking 4-6 hours. Profiles update T+1, not real-time.

## Production Identity Graph Architecture

Combining all three methods, production architecture spans these layers:

**1. Event ingestion layer (sGTM):** Server-side Google Tag Manager captures raw event stream—GA4, Segment, Klaviyo, server-side Conversion API. Each event carries `user_pseudo_id` + `session_id` + `client_id`. Email/phone gets hashed and appended.

**2. Identity stitching engine (BigQuery + dbt):** Daily batch job runs:
- Deterministic matching (email_hash overlaps)
- Probabilistic scoring (IP + UA + behavior similarity)
- Household clustering (K-means or DBSCAN)

Output: `identity_graph` table (nodes = unique identities, edges = confidence scores).

**3. Profile unification (CDP):** Each graph node gets a unified profile—all touchpoints, attributes, segments merged. This profile syncs to activation platforms (Klaviyo, Braze).

**4. Real-time lookup:** New event arrives, query the graph. If match exists, append to existing profile; if not, open new node (merged tomorrow by batch).

For Roibase's Shopify Plus stack, this architecture costs ~$800/month on GCP (BigQuery + Cloud Functions + sGTM container). At 50M events/month, batch runtime is 4-5 hours. ROI: attribution accuracy jumps 18%, CAC calculation stabilizes 22% (because you now properly separate 3 sessions from one user).

## Privacy, Consent, and KVKK Compliance

Identity resolution sits on GDPR 6(1)(f) "legitimate interest" or 6(1)(a) "explicit consent." Turkey's KVKK mandates explicit consent—you must obtain user affirmation that "we will link your personal data across devices and sessions." A Consent Management Platform (CMP) handles this: TCF 2.2 standards cover purpose 2 (device identification) and purpose 7 (cross-device linking).

Hashing is GDPR "pseudonymization," not full anonymization—GDPR 4(5) classifies it as personal data. Hash tables require encryption at rest + access controls. Roibase uses customer-managed encryption keys (CMEK) on BigQuery datasets; access controlled via IAM policy + VPC Service Controls.

**Retention policy:** Per KVKK article 7, delete identity graphs when processing purpose ends. E-commerce typically retains for 2 years—24 months post-purchase, profiles get an inactive flag; 30 days later without return, profile deletes (right to erasure).

## What to Do Now

Building identity resolution from scratch is an 8-12 week data engineering project. Without a CDP, start with [first-party data architecture](https://www.roibase.com.tr/en/firstparty)—server-side event collection, BigQuery warehouse, dbt pipelines. Layer identity stitching on top. Have existing stack? Pilot probabilistic matching on 1-2 segments (high-value users), measure accuracy and false positive rate, calibrate confidence threshold. Before production launch, align consent flow and retention policy with legal. Identity resolution is the foundation for all downstream layers (attribution, segmentation, LTV modeling)—if this floor is weak, everything above is built on sand.