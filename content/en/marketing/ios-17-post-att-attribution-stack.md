---
title: "iOS 17 Post-ATT Attribution Stack"
description: "Rebuilding iOS attribution with SKAdNetwork 4, modeled conversions, and incrementality tests: practical strategy for post-lookback maturity era."
publishedAt: 2026-06-02
modifiedAt: 2026-06-02
category: marketing
i18nKey: marketing-003-2026-06
tags: [ios-attribution, skadnetwork, att, modeled-conversions, mobile-measurement]
readingTime: 8
author: Roibase
---

Five years have passed since Apple deployed App Tracking Transparency in iOS 14.5. Since that moment, the foundational assumptions of mobile performance marketing shifted. Deterministic user-level attribution died; probabilistic and aggregated models became mandatory. iOS 17 and SKAdNetwork 4's new conversion value schema, post-lookback maturity window, and modeled conversions are redrawing the game. This article explains how to structure iOS attribution in 2026, which signals to use in which order, and how to blend MMPs with incrementality testing.

## Attribution Anatomy After ATT

Before iOS 14.5, MMPs (Adjust, AppsFlyer, Kochava) could read IDFA at device level, tying every conversion directly to a campaign. ATT closed this mechanism for >95% of users (2025 Statista: opt-in rate ~7%). Now we have three layers:

**1. Deterministic (IDFA opt-in users):** The ~7% who grant permission still flow through classic MMP pipelines. Click/impression timestamp, install, in-app event — all user-level. But this segment no longer carries representative weight.

**2. SKAdNetwork (aggregated postback):** Apple's privacy-first framework. Attribution window 0–72 hours; conversion value limited to 6-bit encoding (0–63). SKAdNetwork 4 added second and third postbacks (8–35 day lockWindow), making D7–D30 retention measurable.

**3. Modeled conversions:** Machine-learning predictions by MMPs. Combines aggregate click/impression data, install counts, and SKAN signals. Lower fidelity than deterministic, but provides scale.

We must use all three together. None is sufficient alone: IDFA too narrow, SKAN aggregated and delayed, modeled inherently predictive. Architecting a stack that balances all three is now core competency.

## What SKAdNetwork 4 Brings

SKAdNetwork 4 (shipped iOS 16.1, matured by iOS 17) introduces three major features:

### Conversion Value Hierarchy and Postback Chain

No longer a single 6-bit value—now three postbacks: 0–2 days, 3–7 days, 8–35 days. Each carries its own 6-bit value. This lets you separate early IAP (install-to-purchase <48h) in postback one from retention signals (D3–D7 session count) in postback two. Previously, we squeezed all signals into 64 slots; now we have 64+64+64 combinatorial space (sequential encoding).

**Example mapping:**
- **Postback 1 (0–2 days):** D0 IAP status (0=no event, 1–10=revenue bracket, 11–20=specific SKU, 21–63=custom blend)
- **Postback 2 (3–7 days):** D3–D7 retention tier (0=churn, 1–20=session count band, 21–40=engagement depth)
- **Postback 3 (8–35 days):** D30 LTV proxy (0–63=cumulative revenue bracket)

Structuring this correctly requires weekly review of conversion value mapping. As user behavior drifts, the most informative signal's slot assignment shifts.

### Source Identifier and Hierarchical Source ID

SKAdNetwork 4 exposes publisher app and sub-publisher network IDs in four-tier hierarchy. No longer just "came from Meta"—now "Meta → Audience Network → Publisher App X" (if the ad network exposes it). This enables sub-publisher performance comparison.

In practice, walled gardens (Facebook, TikTok, Google) don't fully expose this field, but it creates critical advantage in programmatic and rewarded video networks.

### Web-to-App Attribution Support

iOS 17.4 added SKAdNetwork support for web clicks. Safari banner → App Store → install now flows through SKAN postback. For brands running joint web + app UA strategy, this enables cross-channel incrementality calculation when blended with [performance marketing (PPC)](https://www.roibase.com.tr/en/ppc) campaigns.

## Modeled Conversions: How It Works, When to Trust It

Modeled conversions merge SKAN postbacks, aggregate impression/click counts, and install volume via machine learning for probabilistic attribution. AppsFlyer calls it "predictive analytics," Adjust "statistical modeling"—technically identical: regression + Bayesian inference.

**Trust-enabling conditions:**
1. **Sufficient data volume:** Minimum 500+ installs/day, 50+ conversions per campaign (SKAN or IDFA). Below this, the model overfits.
2. **SKAN signal stability:** Conversion value mapping must stay consistent. Daily remapping prevents the model from capturing historical patterns.
3. **Incrementality calibration:** Run at least one geo-holdout or time-based holdout per quarter. Compare modeled numbers to actual lift, apply bias correction.

**Bad usage example:** New campaign launched, 20 installs in 3 days, MMP says "modeled 15 IAP." Pure noise—sample too small. Wait 2+ weeks.

**Good usage example:** 50K installs over 30 days across Meta + TikTok + Google UAC; SKAN delivered 3K conversion postbacks. MMP modeled it to 8K. Same period, geo-test holdout (France vs Germany) showed +12% lift. You revise modeled to 8K × 1.12 = 8.96K. This is reliable.

## Post-Lookback Maturity: Signal Beyond Day 35

SKAdNetwork 4's third postback covers events in days 8–35. After day 35, no SKAN postback arrives. Yet real user behavior extends beyond day 35: D60 retention, D90 LTV, annual subscription renewals.

**Solution approaches:**

1. **Cohort-based LTV projection:** Fit a cohort LTV curve using first-35-day SKAN + modeled conversion data (typically power law or exponential decay). Extrapolate 90–180-day LTV. This is an estimate, but with sufficient cohort size, variance drops.

2. **Cross-channel holdout and incrementality:** Pause one channel for 2 weeks, measure organic install and in-app revenue change. Calculate net incrementality, backfill post-day-35 signals with this test. Repeat quarterly.

3. **Server-side event enrichment:** Feed late-stage events missing from SKAN postbacks (subscription renewal, high-ticket IAP) to the MMP via server-to-server. Not deterministic, but creates patterns in aggregate. MMP uses this as modeling input.

**Caution:** Apple doesn't explicitly ban server-side user-level signal delivery, but MMPs claiming it as user-level attribution violates policy. Using it as aggregate modeling input is acceptable.

## Practical Stack Setup Scenario

Say you operate a subscription-based fitness app. iOS comprises 60% of your install base; you target 100K new installs/month. Here's your attribution stack:

| Layer | Tool | Role | Trust Range |
|-------|------|------|-------------|
| SKAN Postback | AppsFlyer | First 35-day conversion value + source ID | 95% (Apple-verified) |
| Modeled Conversions | AppsFlyer Predictive | SKAN + aggregate probabilistic attribution | 70–80% (geo-test calibrated) |
| IDFA Opt-in | AppsFlyer raw data | Deterministic 7% segment | 100% (low representativeness) |
| Incrementality | GeoLift (Meta) + custom holdout | Channel-level lift measurement | 90% (statistical, expensive) |
| LTV Projection | Internal dbt + BigQuery | Cohort curve fit, 90–180-day forecast | 60–70% (model accuracy) |

**Flow:**
1. Pull SKAN postbacks daily per campaign.
2. Fetch AppsFlyer modeled conversions, but leave ±20% confidence band in campaign-level CPA calculations.
3. Run geo-holdout monthly (e.g., pause Meta in Spain, continue in Portugal). Calculate net lift.
4. Quarterly: refresh cohort LTV curve. Regress first-35-day SKAN signal against 90-day revenue correlation.
5. Allocate budget as weighted average of SKAN + modeled + incrementality.

Expensive? Yes. But if iOS traffic is 60% of volume and CAC is $30+/user, attribution error cost far exceeds testing cost.

## Tradeoffs and Counter-Arguments

**"Modeled conversions are unreliable—why use them?"**

Because the alternative is nothing. SKAN is aggregated, IDFA is 7%, no signal means flying blind. Modeled conversions are imperfect but calibrated. Once you adjust bias via holdout tests, you get 75–80% accuracy—far better than zero data.

**"Is SKAdNetwork 4 enough, or should we wait for 5?"**

SKAdNetwork 5 (arriving iOS 18, announced mid-2024) promises finer source ID and longer lookback, but adoption is incomplete. iOS 17 user base is ~70%+, iOS 18 ~30%. Build your stack on SKAdNetwork 4 and bolt on version 5 features incrementally—pragmatic approach.

**"Do we need incrementality testing for every campaign?"**

No. Incrementality is expensive and slow. One quarterly test per channel is sufficient (Meta Q1, TikTok Q2, Google Q3). For smaller campaigns, rely on modeled + SKAN blend; test when budget moves large.

---

iOS attribution is no longer deterministic—it's probabilistic, aggregated, and test-driven. Correctly mapping SKAdNetwork 4's three-postback structure, calibrating modeled conversions against holdout tests, and projecting post-day-35 LTV via cohort fit is the 2026 standard operation. Build your stack on these three layers—SKAN, modeled, incrementality—and you'll graduate from blind flying to data-informed budget allocation on iOS.