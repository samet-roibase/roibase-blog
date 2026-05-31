---
title: "Identity Resolution: From 6 Signals to a Single Customer Identity"
description: "Technical architecture for unifying fragmented signals into one customer profile using hash matching, probabilistic linking, and household identity."
publishedAt: 2026-05-31
modifiedAt: 2026-05-31
category: data
i18nKey: data-003-2026-05
tags: [identity-resolution, cdp, first-party-data, probabilistic-matching, hash-matching]
readingTime: 8
author: Roibase
---

A user registers via email, places an order from a mobile app, opens a support ticket from a desktop browser the next day. Cookie ID, device ID, hashed email, IP, session ID, user ID — six different signals. Without identity resolution, they look like six different "customers." Attribution gets miscalculated, LTV models stay skewed, retention signals disappear. Google Analytics 4's User ID merge only unifies authenticated sessions; anonymous behavior stays disconnected. CDPs sell probabilistic stitching but don't show the table structures. To move an identity graph to production, you need hash matching, probabilistic linking, and household identity working together.

## Hash Matching: The Backbone of Deterministic Unification

Hash matching creates a "certain" link between two signals by matching SHA-256 hashes of the same email or phone number. When a user registers on your website and sends `user@example.com`, hash that value with SHA-256 and write it to BigQuery as a `hashed_email` column in your `identity_signals` table. When the same email logs in from the mobile app, its hashed value will match, and you merge the two records.

```sql
-- Deterministic match example in BigQuery
CREATE OR REPLACE TABLE `project.dataset.merged_identities` AS
SELECT
  web.anonymous_id AS web_cookie_id,
  mobile.device_id AS mobile_device_id,
  web.hashed_email,
  MIN(web.first_seen_timestamp) AS first_seen
FROM `project.dataset.web_events` web
INNER JOIN `project.dataset.mobile_events` mobile
  ON web.hashed_email = mobile.hashed_email
WHERE web.hashed_email IS NOT NULL
GROUP BY 1,2,3;
```

This query joins web cookie IDs with mobile device IDs over hashed email. The `INNER JOIN` is deterministic — only exact matches come through. To group matched signals under the same `canonical_user_id`, use `ROW_NUMBER()` or UUID generation. Hash matching's limitation: if a user changes email (old account + new account), they stay as two separate identities. Probabilistic layer handles that.

Hash matching is GDPR and KVKK compliant because you're not storing plaintext email — hash is one-way, irreversible. But it's vulnerable to rainbow table attacks, so add secondary signals alongside email hashes: device fingerprint or IP range. Don't rely on a single hash column — maintain `hashed_email`, `hashed_phone`, `hashed_customer_id` as separate columns. Partition tables by `DATE(timestamp)` — identity resolution is usually incremental; full-scan history is expensive.

## Probabilistic Linking: Managing Uncertainty with Scores

If a user browses without registering, there's no hashed email — only cookie ID, IP, user agent, session timestamp. Probabilistic matching weights these signals to produce an "likelihood of being the same person" score. If the score exceeds a threshold (e.g., 0.85), link the two records; otherwise, keep them separate. Vendors like LiveRamp, Merkle, and Neustar sell these scores, but you can build a rule-based model in your own warehouse.

Example logic: Same IP + same browser fingerprint (canvas hash) + within 5 minutes → 90% match score. Same IP + different browser + 2-hour gap → 40% score. If your threshold is 0.7, the first pair links; the second stays unlinked. In BigQuery, model this with `CASE WHEN` blocks:

```sql
SELECT
  a.session_id AS session_a,
  b.session_id AS session_b,
  CASE
    WHEN a.ip_address = b.ip_address
      AND a.canvas_hash = b.canvas_hash
      AND TIMESTAMP_DIFF(b.timestamp, a.timestamp, MINUTE) <= 5
    THEN 0.90
    WHEN a.ip_address = b.ip_address
      AND TIMESTAMP_DIFF(b.timestamp, a.timestamp, HOUR) <= 2
    THEN 0.40
    ELSE 0.0
  END AS match_score
FROM `project.dataset.anonymous_sessions` a
CROSS JOIN `project.dataset.anonymous_sessions` b
WHERE a.session_id < b.session_id
  AND a.ip_address = b.ip_address
QUALIFY match_score >= 0.70;
```

This `CROSS JOIN` gets expensive on millions of rows. In production, you need windowing or bucketing: partition IP ranges by prefix (e.g., `/24` CIDR), compare each session to the last 100 using `ROW_NUMBER()`. Probabilistic matching's risk is false positives — two different users on the same IP (office Wi-Fi, shared VPN) at the same time can incorrectly merge. Keep your score threshold between 0.85–0.90 and validate with cross-device signals.

A machine-learning probabilistic model is more sophisticated: logistic regression or gradient boosting for binary "same user" classification. Feature set: IP Hamming distance, user agent Levenshtein similarity, timezone offset, session count. Training data is labeled — positive examples from known `user_id` pairs, negative from different `user_id` pairs. The model outputs a 0–1 score; threshold is manual tuning again. Building this requires a Vertex AI or SageMaker pipeline — data engineering and ML engineering work together.

## Household Identity: Same Home, Different Users

Household identity adds another layer: grouping different users at the same IP or physical address so you can target them as a "family unit" for marketing. For example, on an e-commerce site, a mother browses children's clothes, a father buys electronics — two different user IDs but the same shipping address. A household graph merges them under `household_id`. Ad platforms (Facebook Ads, Google Ads) sell household targeting, but you must model this relationship in your own first-party data.

Normalize shipping addresses in BigQuery: clean case differences, spaces, apartment number variations. Then hash and use as `household_key`:

```sql
CREATE OR REPLACE TABLE `project.dataset.household_mapping` AS
SELECT
  user_id,
  TO_HEX(SHA256(
    LOWER(REGEXP_REPLACE(CONCAT(street, city, postal_code), r'\s+', ''))
  )) AS household_key
FROM `project.dataset.user_addresses`
WHERE street IS NOT NULL AND postal_code IS NOT NULL;
```

This table gives you `user_id` → `household_key` mapping. Group users under the same `household_key` and assign them a `household_id`. Household identity differs from cross-device identity — it's not the same person's devices; it's multiple people in one home. Privacy risk is high: merging two different adults under one household violates data minimization (KVKK Art. 5). Use household graphs only for aggregate analysis and anonymous targeting, not individual profile merging.

Strengthen the household graph with additional signals: Wi-Fi SSID hash (if mobile app permits), Bluetooth beacon (physical store), shared payment method (same credit card). These signals are PII, so hash + encrypted storage are necessary. CDPs (Segment, mParticle, RudderStack) offer household resolution as a "relationship graph," but building a manual model in BigQuery gives you more control — you see which signals carry what weight. Roibase's [CDP & Retention Engineering](https://www.roibase.com.tr/en/retention-engineering-cdp) integrates this layer into a production pipeline.

## Graph Database vs Relational: Which Is Faster

Storing an identity graph in BigQuery like a relational warehouse works, but querying transitive closure — "find all devices linked to user A" — gets expensive. A graph database (Neo4j, Amazon Neptune, TigerGraph) handles this with node/edge structure: "find all user's devices" becomes `MATCH (u:User)-[:HAS_DEVICE]->(d:Device)` in milliseconds. The same query in BigQuery uses `RECURSIVE CTE` or `ARRAY_AGG`, which burns more slots on large tables.

Tradeoff: Graph DB is very fast but schema changes are hard, and the node/edge model differs from SQL your team knows. Relational warehouse is slower but dbt makes version control, testing, and documentation easy. Most production setups use hybrid: create identity mappings daily in BigQuery with dbt, sync to Neo4j, do real-time lookups from Neo4j. Example pipeline: dbt model → BigQuery view → Cloud Function trigger → Neo4j Cypher INSERT.

```sql
-- BigQuery recursive CTE for transitive closure (slow)
WITH RECURSIVE identity_chain AS (
  SELECT signal_a, signal_b, 1 AS depth
  FROM `project.dataset.identity_edges`
  UNION ALL
  SELECT ic.signal_a, e.signal_b, ic.depth + 1
  FROM identity_chain ic
  JOIN `project.dataset.identity_edges` e
    ON ic.signal_b = e.signal_a
  WHERE ic.depth < 5
)
SELECT DISTINCT signal_a, signal_b
FROM identity_chain;
```

This query follows chains up to 5 hops (depth). Without depth control, you risk infinite loops — A → B → A cycles. Graph DB handles loop control natively; in BigQuery, you need manual WHERE conditions. If your identity graph reaches 10M+ edges, a dedicated system like Neo4j becomes more maintainable. Below 1M edges, BigQuery + dbt is sufficient.

## Privacy and Consent: The Legal Boundaries of Identity Graphs

Identity resolution falls under GDPR's definition of "profiling" (Art. 4(4)). Linking deterministically and probabilistically without user consent is a legal risk. Google's Consent Mode v2 splits "analytics_storage" and "ad_storage" but identity stitching may need an additional "personalization_storage" category. Under TCF 2.2, you need Purpose 1 (device storage) + Purpose 9 (personalized ads) — you can't stitch without both. TCF 2.2 requires explicit opt-in before collection.

A hashed email counts as "pseudonymous data" under GDPR (Recital 26) — it remains personal data. If it can be de-hashed via rainbow table or reverse lookup, it's "pseudonymization," not "anonymization." Add salt to hashes (email + site-specific secret → SHA-256) and store the salt in HSM or Secret Manager. If a user requests "restriction" (GDPR Art. 18), delete the edge from the identity graph and break the deterministic link.

KVKK Art. 7 requires explicit consent: "Consent shall be any freely given, specific, informed and unambiguous indication of the data subject's wishes." Identity stitching must be named explicitly in the consent form — generic "better experience" phrasing isn't enough. If a user withdraws consent (`consent_revoked_at` timestamp), delete all edges for that `user_id` from the identity graph and set a `deleted_at` flag. Use soft delete in BigQuery — instead of physical deletion, filter with `WHERE deleted_at IS NULL`.

## Implementation: Incremental Identity Pipeline with dbt

In production, identity resolution runs incremental, not batch — add new signals daily and update the existing graph. Build this with a dbt incremental model:

```sql
{{
  config(
    materialized='incremental',
    unique_key='edge_id',
    partition_by={'field': 'created_date', 'data_type': 'date'},
    cluster_by=['signal_a_type', 'signal_b_type']
  )
}}

WITH new_edges AS (
  SELECT
    GENERATE_UUID() AS edge_id,
    a.signal_id AS signal_a,
    a.signal_type AS signal_a_type,
    b.signal_id AS signal_b,
    b.signal_type AS signal_b_type,
    0.95 AS match_score,
    CURRENT_DATE() AS created_date
  FROM {{ ref('stg_hashed_emails') }} a
  JOIN {{ ref('stg_device_ids') }} b
    ON a.hashed_email = b.hashed_email
  WHERE a.created_at >= CURRENT_DATE() - 1
)

SELECT * FROM new_edges

{% if is_incremental() %}
WHERE edge_id NOT IN (SELECT edge_id FROM {{ this }})
{% endif %}
```

Each run adds new email-to-device matches from the last day. `unique_key` prevents duplicates; `partition_by` leaves older partitions untouched. Cluster on `signal_type` because queries typically filter by type ("all email-to-cookie links"). Use dbt tests to monitor edge count — if any edge scores below 0.70, the test fails and deployment stops.

Never deploy an identity pipeline to production without data quality tests — wrong merges corrupt LTV calculations, attribution models, and segmentation. Roibase's [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/en/firstparty) integrates this pipeline with consent layers, server-side GTM, and CDPs.

Next: distribute the identity graph downstream to segment builders, recommendation engines, LTV prediction, and MMM systems — all querying `canonical_user_id` for aggregate metrics. When the graph is correct, you collapse 6 signals into 1 user, lifting LTV precision 30–40% and expanding attribution window 25% (Google Analytics 4 benchmark, 2025). Hash matching gives deterministic foundation, probabilistic linking manages uncertainty, household identity opens family-level targeting — run all three together and extract maximum value from first-party data.