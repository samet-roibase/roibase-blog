---
title: "iOS 17+ Attribution Stack After ATT"
description: "SKAdNetwork 4, modeled conversions, and post-install lookback windows. Practical measurement architecture for iOS marketing in 2026."
publishedAt: 2026-06-20
modifiedAt: 2026-06-20
category: marketing
i18nKey: marketing-003-2026-06
tags: [ios-attribution, skadnetwork, att, mobile-marketing, conversion-modeling]
readingTime: 8
author: Roibase
---

The ATT (App Tracking Transparency) transformation that began with iOS 14 matured in 2026. With SKAdNetwork 4, modeled conversions, and expanded post-install attribution windows, iOS marketing now requires a fundamentally different technical stack. As of Q4 2025, 73% of US users reject tracking in ATT prompts (Flurry Analytics 2025). This marks an era where deterministic attribution models have collapsed, but probabilistic systems now offer richer signals. Below we architect the iOS 17+ performance marketing stack at the technical layer.

## No Deterministic Signals After ATT

App Tracking Transparency requests pushed opt-out rates past 70%. This means device-level identifiers like IDFA (Identifier for Advertisers) can no longer anchor marketing decisions. Platforms like Meta, Google, and TikTok—now without user-level data access—optimize campaigns on aggregated signals instead.

**What remains without deterministic signals:**
- SKAdNetwork postbacks (install and conversion events matched to campaign ID, but no user ID)
- Server-side conversion signals (from first-party event streams)
- Modeled conversions (platform ML models infer missing data)

Critical point: Legacy LTV cohort analyses now run on probabilistic modeling instead of deterministic data. For example, Meta Ads Manager's "Estimated Actions" carry 15–25% error margins (Meta Q1 2025 attribution report). When building your stack, price this uncertainty into decisions.

### Post-Install Lookback Window

SKAdNetwork 4 extended the lookback window from 24 hours to 35 days. But within this window, you can only send 3 conversion value updates. Each update arrives with either "coarse" or "fine" granularity—granularity depends on conversion rate. High conversion = fine (64 conversion values), low = coarse (low/medium/high buckets).

**Technical rule:** Signals arriving in the first 24 hours come as fine granularity, days 3–7 as coarse, days 8+ as timer-based postbacks. This means D7 LTV is no longer deterministic—only ~40% of installs send signals by day 7 (AppsFlyer benchmark 2025).

## SKAdNetwork 4 Conversion Value Schema

SKAdNetwork offers 64 conversion values (0–63). Each value encodes an "event combination." For example:
- 0–9: First open + onboarding complete
- 10–19: First content engagement
- 20–29: First purchase (low-value)
- 30–39: First purchase (high-value)
- 40–63: Recurring purchase, subscription renewal

When designing this schema, you must apply **priority mapping**—whichever event has higher business value maps to a higher SKAdNetwork value. This matters because SKAdNetwork sends only the **highest conversion value** in the postback. If a user completes onboarding (value 5) and then purchases (value 25), only 25 is sent.

**Example mapping (gaming app):**

| Event | Business Value | SKAdNetwork Value |
|---|---|---|
| Tutorial complete | $0.10 | 5 |
| Level 3 complete | $0.30 | 10 |
| First IAP ($0.99) | $0.99 | 20 |
| First IAP ($4.99+) | $4.99+ | 30 |
| D7 retention | $2.50 (modeled) | 40 |

Designing this schema **revenue-weighted** is critical. Otherwise, high-frequency low-value events suppress higher values and platform optimization misfires.

### Hierarchical Source Identifier

SKAdNetwork 4 introduced "hierarchical source ID"—a 4-digit code encoding campaign → ad group → creative hierarchy. For instance, `1234` might mean:
- First 2 digits (12): Campaign ID
- 3rd digit (3): Ad group
- 4th digit (4): Creative variant

Structuring this ID correctly is essential for attribution granularity. Otherwise, all campaigns collapse into one ID and creative-level performance vanishes. In [performance marketing](https://www.roibase.com.tr/en/ppc) strategies, this granularity accelerates conversion testing—an A/B creative test can yield results in 3 days instead of 7.

## Modeled Conversions: Platform-Side ML

Meta, Google, and TikTok now offer "modeled conversions"—an ML layer that infers missing signals. When you send server-side events via Conversions API, the platform uses:
- Event parameters you send (event_name, value, currency)
- IP address, user agent, click ID (fbclid, gclid)
- Historical behavior patterns from similar users

The platform synthesizes these into an "estimated" conversion count. For instance, 100 real conversions might yield 120–130 "estimated" conversions. These estimates feed the bidding algorithm—so ROAS targets optimize on modeled data.

**Critical question:** Is modeled data reliable? Meta's own A/B tests show the model runs 18–22% accuracy (Meta Advertiser Help Center 2025). This must be validated with incremental lift tests. If modeled ROAS shows 3.5x but true incrementality is 2.1x, you'll budget decisions on modeled data and overspend.

### Server-Side Signal Quality

Modeled conversion quality depends on richness of server-side signals. Minimum requirements:
- `event_source_url` (landing page URL)
- `client_ip_address` (user IP)
- `client_user_agent` (browser info)
- `fbp` cookie (first-party Meta pixel cookie)
- `fbc` cookie (click ID cookie from fbclid parameter)

Without these 5 parameters, modeled conversion quality drops 40–50% (Meta CAPI documentation). Critically, `fbp` and `fbc` must be set from your first-party domain—third-party cookie blocking causes these signals to vanish, pushing attribution entirely to aggregates.

## Post-Lookback Campaign Maturity

iOS campaigns require longer "learning phases." Google App Campaigns stay in learning mode until 50 conversions are reached. But because SKAdNetwork signals arrive with 24-hour delays, reaching 50 conversions takes 3–5 days. During this window, CPA is 30–40% more volatile.

**Operational rule:** Don't pause campaigns in the first 7 days—let algorithms ingest signal flow. After day 7, if CPA stabilizes, scale; if not, change creative or targeting. But each change resets the learning phase—another 7 days.

### Campaign Structure: Consolidation vs. Segmentation

In the iOS 13 era, splitting campaigns into narrow audiences made sense (1% lookalike, 2% lookalike in separate campaigns). Now this extends learning phases. Instead, **consolidated campaigns** are preferred:
- Single campaign, broad targeting (iOS 15+, all US)
- Platform segments with its own model
- Creative testing via dynamic creative within the campaign

AppsFlyer's 2025 benchmark showed consolidated structure delivered 22% lower CPA. But this cedes manual optimization control to platform ML.

## Validation via Incrementality Test

The accuracy of modeled data and SKAdNetwork signals is only revealed through incrementality testing. Run a geo-based holdout test—compare control (no ads) against test (ads) on conversion rates.

**Simple calculation:**
```
Incremental Lift = (Test Group CVR - Control Group CVR) / Control Group CVR
```

If test group hits 3.2% CVR and control hits 2.1% CVR, lift is 52%. But if not all lift comes from ads (e.g., organic spike), "true incrementality" is lower. Adjust modeled ROAS by lift:
```
True ROAS = Reported ROAS × (Incremental Lift / 100)
```

If reported ROAS is 4.0x but lift is 40%, true ROAS is 1.6x—a material difference that reshapes budget allocation.

## Stack Design: Layer by Layer

The end-to-end iOS 17+ attribution stack consists of these layers:

**1. SDK + MMP (Mobile Measurement Partner):** MMPs like AppsFlyer, Adjust, and Branch aggregate SKAdNetwork postbacks and match them to campaign IDs. This layer provides deterministic signals but lacks user-level detail.

**2. Server-Side Event Stream:** Send events from app backend to CAPI (Meta), Google Ads API, TikTok Events API. These signals feed modeled conversions.

**3. BI + Attribution Model:** In BigQuery or Snowflake, combine SKAdNetwork + server-side + modeled data. Build a "blended attribution" model here—e.g., 60% weight to SKAdNetwork, 40% to modeled.

**4. Incrementality Layer:** Feed geo-test results into BI and adjust blended attribution by incrementality. This layer provides "ground truth."

Each layer is a separate data source—stack resilience hinges on pipeline uptime. SKAdNetwork postbacks carry 2–5% loss rates (network issues, timer faults). Minimize losses via MMP retry mechanisms.

## What to Do Now

iOS attribution now runs on probabilistic modeling instead of deterministic data. Engineer your SKAdNetwork 4 conversion value schema with revenue weighting, ensure granularity via hierarchical source IDs, and maximize server-side signal quality. Trust modeled conversions only after validating with incrementality tests—otherwise over-attribution risk is real. Campaign maturity takes longer, so be patient through the first 7 days and avoid changes that reset learning phases. Build your stack layer-by-layer and monitor data loss at each layer—because on iOS, no single signal source owns ground truth anymore. The aggregate of all sources does.