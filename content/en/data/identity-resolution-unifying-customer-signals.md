---
title: "Identity Resolution: From 6 Signals to a Single Customer Identity"
description: "Engineering customer identity unification using hash matching, probabilistic linking, and household clustering. BigQuery + CDP implementation guide."
publishedAt: 2026-06-16
modifiedAt: 2026-06-16
category: data
i18nKey: data-003-2026-06
tags: [identity-resolution, customer-data-platform, hash-matching, probabilistic-linking, first-party-data]
readingTime: 8
author: Roibase
---

Cookie lifespan has collapsed from an average of 28 days to 7. A user starts in a mobile app, completes a purchase on desktop web, re-engages from an email campaign — every touchpoint generates a different identifier. 40% of marketing data becomes orphan events: no user ID, no session ID, no conversion attribution. Identity resolution is the engineering discipline that stitches these fragments together. Not guesswork, but hash matching. Not intuition, but probabilistic graphs. Not assumption, but household clustering.

## Deterministic Matching: Hash-Based Unification

Deterministic matching works when you **know with certainty** that two datapoints share the same identifier. An email SHA-256 hash, a phone number hash, a CRM ID. If your BigQuery event table has `user_id` but web analytics has `ga_client_id`, you cannot JOIN them directly — you first need to find a bridge event where both were recorded and build a mapping table.

```sql
-- Deterministic identity stitching example
CREATE OR REPLACE TABLE `project.dataset.identity_graph` AS
WITH email_hashes AS (
  SELECT DISTINCT
    user_pseudo_id,
    TO_HEX(SHA256(LOWER(TRIM(user_properties.email.value)))) AS email_hash
  FROM `project.dataset.events_*`
  WHERE user_properties.email.value IS NOT NULL
),
crm_map AS (
  SELECT
    crm_id,
    TO_HEX(SHA256(LOWER(TRIM(email)))) AS email_hash
  FROM `project.crm.customers`
)
SELECT
  e.user_pseudo_id,
  c.crm_id,
  e.email_hash
FROM email_hashes e
INNER JOIN crm_map c
  ON e.email_hash = c.email_hash;
```

This query links the `user_pseudo_id` from Firebase Analytics to the `crm_id` from your CRM **via exact match** on the email hash. The email hash serves as the anchor identifier. Critical detail: `LOWER(TRIM())` — if a user entered "Ali@X.com" but your CRM stores "ali@x.com", the hash match will fail. Normalization is the first step of any identity pipeline.

Deterministic matching has 100% precision but low recall — it only finds records where both systems possess the same identifier. A user who exited without submitting their email never enters this graph.

### Hash Collision and Privacy

SHA-256 collision probability is theoretically 2^-256 — effectively zero in practice. However, GDPR Article 32 does not equate hashing with anonymization; a hash alone is not sufficient. Email hash + IP + timestamp can lead to user re-identification. Hash tables must therefore be protected with encryption-at-rest and column-level access controls.

## Probabilistic Linking: Graph-Based Probability Matching

When deterministic joins fail, probabilistic matching takes over. You attempt to link two records with different identifiers using **behavioral similarity**, **device fingerprint**, and **timezone + user-agent** as weak signals. A machine learning model is not needed — a weighted scoring + threshold system is sufficient.

| Signal | Weight | Example |
|--------|--------|---------|
| Same IP (within 24 hours) | 0.3 | 192.168.1.10 |
| Same User-Agent | 0.2 | Chrome 120 / Mac |
| Same geographic location | 0.15 | Istanbul, Kadıköy |
| Same campaign click | 0.25 | utm_campaign=spring_sale |
| Same product view sequence | 0.1 | product_123 → product_456 |

If the total score ≥ 0.7, the two sessions are **likely** the same person. Adjust this threshold based on your dataset — e-commerce may tolerate 0.65, fintech requires 0.85.

```sql
-- Probabilistic scoring example
WITH sessions AS (
  SELECT
    session_id,
    user_pseudo_id,
    device.operating_system,
    device.web_info.browser,
    geo.city,
    traffic_source.medium,
    ARRAY_AGG(ecommerce.items.item_id ORDER BY event_timestamp) AS item_sequence
  FROM `project.dataset.events_*`
  WHERE event_name = 'page_view'
  GROUP BY 1,2,3,4,5,6
)
SELECT
  a.session_id AS session_a,
  b.session_id AS session_b,
  (CASE WHEN a.operating_system = b.operating_system THEN 0.2 ELSE 0 END +
   CASE WHEN a.browser = b.browser THEN 0.2 ELSE 0 END +
   CASE WHEN a.city = b.city THEN 0.15 ELSE 0 END +
   CASE WHEN a.medium = b.medium THEN 0.25 ELSE 0 END +
   CASE WHEN a.item_sequence = b.item_sequence THEN 0.2 ELSE 0 END
  ) AS match_score
FROM sessions a
CROSS JOIN sessions b
WHERE a.session_id < b.session_id  -- self-join optimization
  AND a.user_pseudo_id != b.user_pseudo_id
HAVING match_score >= 0.7;
```

This query compares **all session pairs** — N² complexity. With 1M sessions, you face 500 billion comparisons. In production, partitioning is required: timestamp windows (7 days), geographic filters (same city), device type filtering (mobile-to-mobile only).

Probabilistic links carry false positive rates of 5–15%. Downstream activation — CDP segment push, email campaigns — must flag these IDs as "potential duplicate" and handle them accordingly.

## Household Identity: Same Device, Different Users

A tablet or Smart TV is used by multiple people. Deterministic or probabilistic matching here collapses distinct family members into a single ID — leading to incorrect personalization. Household identity resolution distinguishes these scenarios.

**Session-level fingerprinting:** Users logging in at different times on the same device show distinct browsing patterns. The user searching for children's clothing at 8:00 AM differs from the one browsing electronics at 11:00 PM.

**Behavioral clustering:** Apply K-means or hierarchical clustering to sessions. If cluster centroids differ, you create separate "virtual users" under the same device_id.

```sql
-- Feature extraction for household clustering
CREATE OR REPLACE TABLE `project.dataset.household_features` AS
SELECT
  device_id,
  EXTRACT(HOUR FROM TIMESTAMP_MICROS(event_timestamp)) AS hour_of_day,
  COUNT(DISTINCT CASE WHEN event_name = 'purchase' THEN ecommerce.transaction_id END) AS purchase_count,
  APPROX_TOP_COUNT(ecommerce.items.item_category, 3) AS top_categories,
  AVG(ecommerce.purchase_revenue_in_usd) AS avg_basket_value
FROM `project.dataset.events_*`
WHERE device_id IS NOT NULL
GROUP BY device_id, hour_of_day;
```

After clustering, each device_id generates virtual IDs like `household_user_1`, `household_user_2`. These do not sync to your CRM — they exist only in analytics and personalization layers.

Household resolution precision is low — 30% error margins are normal. This is why it's rarely used outside e-commerce (particularly not in SaaS or fintech).

## Identity Graph Architecture and Maintenance

All matching results consolidate into a single **identity graph** table. This table holds all known aliases for each user: email hash, CRM ID, ga_client_id, Firebase ID, advertising ID.

| canonical_id | identifier_type | identifier_value | match_method | confidence | updated_at |
|--------------|-----------------|------------------|--------------|------------|------------|
| user_0001 | email_hash | a1b2c3... | deterministic | 1.0 | 2026-06-15 |
| user_0001 | ga_client_id | GA1.2.123 | deterministic | 1.0 | 2026-06-14 |
| user_0001 | firebase_id | xyz789 | probabilistic | 0.75 | 2026-06-16 |
| user_0002 | crm_id | CRM-456 | deterministic | 1.0 | 2026-06-10 |

The graph is updated incrementally — each day, new events are scanned and new matches are added. Old links weaken via confidence decay: a probabilistic link from 90 days ago drops from 0.75 to 0.50.

If you model your graph as a **directed acyclic graph (DAG)**, you can detect loops. A cycle like User A → User B → User C → User A signals a data error requiring manual review.

## CDP Integration and Activation Pipeline

The identity graph alone is incomplete — it feeds into a CDP. A CDP architecture following [CDP & Retention Engineering](https://www.roibase.com.tr/en/retention-engineering-cdp) takes the canonical_id from the graph, merges all touchpoints under that ID, and passes it to the segment engine.

Activation proceeds as follows:

1. **Segment definition:** "3+ sessions in last 30 days, added to cart but no purchase" → defined as a BigQuery view.
2. **Identity resolution:** The view looks up the canonical_id for each user_pseudo_id.
3. **Channel sync:** All email hashes under that canonical_id push to Meta CAPI; phone hashes push to Google Customer Match.
4. **Attribution:** When a conversion event arrives, the canonical_id traces all touchpoints via the graph.

Without a CDP, identity resolution remains incomplete — the graph only answers "who matches with whom," not "what action should I take on this user."

## Privacy Compliance and Consent Propagation

Identity resolution justifies itself under GDPR Article 6(1)(f) — "legitimate interest" — but if a user has not given explicit consent, identifiers derived from this graph cannot fuel remarketing campaigns. Integration with a Consent Management Platform (CMP) is mandatory.

Each canonical_id maintains consent status: `{ analytics: true, marketing: false, personalization: true }`. Identifiers derived from the graph inherit this flag — if User A's email_hash has `marketing: false`, then User B's ga_client_id (linked to User A probabilistically) also cannot enter marketing segments.

Under TCF 2.2, vendor consent propagation becomes more complex: if a user consented to Meta but not Google, graph sync becomes selective. This architecture is part of the [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/en/firstparty) process — consent signals are injected into the event pipeline at the start, and graph update jobs read these signals.

---

Identity resolution is not simply a technical JOIN operation — it is the critical layer connecting marketing data to decision-making. Solving exact matches via hash matching, weak signals via probabilistic scoring, and shared devices via household clustering demands engineering discipline. Keeping the graph current, aligning it with consent propagation, and feeding it to a CDP activation pipeline comprise the production side of this discipline. In a cookieless era, customer identity is not guessed — it is constructed from six disparate signals unified into one.