---
title: "Ad Attribution Stack After iOS 17"
description: "ATT, SKAdNetwork 4, and modeled conversions reshape mobile performance marketing. How to architect measurement in the post-lookback maturity phase."
publishedAt: 2026-07-28
modifiedAt: 2026-07-28
category: marketing
i18nKey: marketing-003-2026-07
tags: [ios-attribution, skadnetwork, att, mobile-performance, modeled-conversions]
readingTime: 6
author: Roibase
---

Three years have passed since iOS 14.5. ATT (App Tracking Transparency) is no longer a "new development"—it's mature reality. By mid-2026, most performance teams have stopped mourning the old attribution stack; there's no going back. iOS 17 brought SKAdNetwork 4.0 to full adoption, Meta and Google pushed modeled conversions to production-grade stability, and TikTok opened its own probabilistic pipeline. The question isn't "do we have data"—it's "which signals do we trust and how do they integrate?"

This piece dissects the technical layers of post-iOS 17 mobile attribution, SKAdNetwork 4.0's real-world limits, the mechanics of modeled conversions, and the three-stream architecture that connects them. Goal: by 2026, know which signal carries weight when targeting an iOS user.

## Signal Layers After ATT

iOS 17 presents three distinct signal types: deterministic (SKAdNetwork), probabilistic (modeled conversions), and first-party (server-side events). Each operates at different latency, granularity, and confidence levels.

SKAdNetwork 4.0 delivers coarse-grained conversion value (0–63 integer) but with 24–48 hour delay. Postback timers run in three phases: 0–2 days, then 3–7 days, then 8–35 days. The first two windows matter most for campaign optimization because bid adjustments need near-real-time feedback. However, SKAd data arrives aggregated—no user-level breakout, only campaign-ID-level volume.

Modeled conversions represent the platform's (Meta, Google, TikTok) ML estimate of conversions for opted-out iOS users. When a user rejects ATT, no deterministic signal exists, but the platform applies behavioral pattern matching—engagement rate, cohort history, device fingerprinting—to produce probabilistic estimates. Meta started 2024 at ~30% modeled / 70% observed; by 2026, some campaigns hit 50–50 ratios. Google UAC (Universal App Campaigns) uses similar logic but keeps conversion window tighter (7 days).

First-party server-side events stream application activity directly to MMP (Mobile Measurement Partner) or CDP. This signal exists at user level but carries no attribution—you know the user converted, not which ad drove it. Useful for cohort behavior tracking: D7 retention is measurable, but assigning it to a specific campaign is difficult.

## SKAdNetwork 4.0's Real Limits

SKAdNetwork 4.0 introduced improvements: hierarchical source identifiers (4-tier campaign structure), multiple conversion windows, web-to-app attribution support. Production reality, however, reveals two major bottlenecks: postback delay and conversion value encoding complexity.

Postback delay averages 24–72 hours. The first window (0–2 days) timer runs slightly faster, but real-time optimization remains impossible. Bid strategies typically reference T-2 data—adjusting today's bids based on cohort performance from two days ago. This means delayed response to trend shifts.

Conversion value schema design is its own engineering problem. Compressing revenue, event type, and user quality into a 0–63 integer requires thoughtful encoding. Standard pattern: lower 32 values for events (install, registration, first purchase), upper 32 for revenue buckets. But this schema must be brand-specific—generic mappings fail. A gaming app might allocate 0–15 to D1 retention signals, 16–31 to IAP events, 32–63 to LTV buckets.

SKAdNetwork's crowd anonymity threshold also creates production friction. Apple suppresses low-volume campaign combinations for privacy. If a test campaign runs 50 installs/day, SKAd postback may not arrive. This complicates new campaign testing—either scale volume quickly or broaden targeting.

## How Modeled Conversions Work

Meta's modeled conversions engine runs on statistical attribution. When a user opts out of ATT, Meta loses the IDFA but retains: ad engagement (impression, click), device type, network quality, campaign targeting overlap. These features feed into a Bayesian regression model answering "did this user convert?"

Model confidence intervals typically range 80–95%—each prediction carries 5–20% error margin. Ads Manager labels these "Estimated conversions." Campaign Budget Optimization (CBO) incorporates modeled signals but weights them lower than observed conversions.

Google UAC leans more heavily on conversion modeling. Android can access deterministic signals via Google Play Instant; iOS is fully model-dependent. Google's advantage: Firebase Analytics integration provides richer in-app event streams, improving model accuracy. Yet Google keeps the lookback window tight—7 days vs. Meta's potential 28.

TikTok exited its probabilistic attribution pipeline from beta in late 2025. It runs a hybrid: TikTok Pixel + SKAdNetwork. High in-app engagement plus a store link tap becomes a strong model signal. TikTok's drawback: its network is narrower than Meta or Google, so cross-platform behavior patterns are sparse.

## Post-Lookback Maturity Architecture

Post-lookback maturity (after SKAdNetwork postbacks complete) enables true performance evaluation. This requires merging three data streams: SKAdNetwork observed, platform modeled, and MMP first-party.

The flow: SKAdNetwork postbacks land in MMP (Adjust, AppsFlyer, Kochava), platform modeled conversions are pulled via API simultaneously, and first-party in-app events flow to CDP or data warehouse (BigQuery, Snowflake). Common key to join all three: campaign ID + install cohort date.

Merging logic must resolve: Do modeled and SKAd conversions overlap? Are you double-counting the same install? MMPs typically treat SKAd as ground truth and layer modeled conversions as probabilistic additive. If SKAd says 100 installs and Meta models 40, report 100 confirmed + 40 probabilistic—not 140 total.

LTV calculation flows entirely from first-party streams. SKAdNetwork doesn't provide LTV; modeled conversions don't estimate revenue. Cohort-based LTV analysis requires raw event stream from MMP or CDP. Typical flow: extract install cohort from SKAd, calculate D7/D30/D90 revenue from first-party events for that cohort, use SKAd install count × cohort LTV for campaign-level ROAS.

Building this architecture demands data pipeline engineering in your [Performance Marketing (PPC)](https://www.roibase.com.tr/en/ppc) stack. It's not just dashboards—ETL processes, deduplication logic, and model confidence thresholds are critical.

## Incrementality and Holdout Test Design

Modeled conversions breed doubt: did this user truly convert or did the model hallucinate? Incrementality measurement answers this. The cleanest approach: geo-based holdout tests.

Geo-holdout works like this: pause campaigns in specific geographies (state, city, DMA), compare organic install rate in those regions to open-campaign regions. The difference = incremental lift. iOS attribution complicates geo testing because SKAdNetwork doesn't report geography. Tests must run at MMP level—using IP inference for geo, which is imperfect.

Alternative: time-based holdout. Pause the campaign on certain weekdays, measure install volume drop. Simple but prone to seasonality bias—if Sundays naturally drive high organic install, campaign lift underestimates.

Meta offers its Conversion Lift test tool. It splits users into test/control groups, serves ads to test, runs PSAs or charity creatives to control, then compares conversion rates. This runs independently of SKAdNetwork because Meta uses its own user graph. Caveat: minimum 200K impressions required, ruling out small campaigns.

Incrementality test results calibrate modeled conversions' confidence intervals. If a lift test shows 60% incrementality but modeled conversions claim 80%, the model overestimates—lower its weight.

## Which Signal to Trust in Campaign Optimization

By mid-2026, hybrid signal approach is mandatory. SKAdNetwork alone causes lag; modeled conversions alone erode trust.

Recommended strategy: weight modeled conversions heavily in days 0–2 (SKAd is delayed), recalibrate when SKAd postbacks arrive. Meta CBO shifts budget between ad sets on modeled signal for 48 hours; from day 3, observed conversion share grows.

For bidding: skip pure ROAS optimization; use tROAS (target ROAS) + volume floor hybrid. Deterministic ROAS is hard to calculate on iOS, so set fixed tROAS (e.g., 3.0×) and enforce minimum daily install volume (e.g., 500/day). This protects both margin and scale.

Creative testing faces signal constraints too. A/B tests may lack volume due to SKAd's crowd anonymity threshold. Solution: sequential testing. Run creative A for 3 days, then B for 3 days; compare when SKAd postbacks land. Imperfect (external factor bias exists) but pragmatic under iOS constraints.

## Closing

Post-iOS 17 attribution is probabilistic, delayed, and multi-layered. SKAdNetwork 4.0 provides foundational signals but lags; modeled conversions accelerate but introduce uncertainty; first-party events enable LTV but not attribution. Merging three streams and understanding each one's confidence interval is now core competency in performance marketing. Teams that fail to thread this stack either underinvest (distrust modeled signal, miss opportunity) or overinvest (ignore model bias, CAC explodes). Winners in 2026: teams that anchor signal complexity in engineering discipline.