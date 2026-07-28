---
title: "iOS 17 After Ad Attribution Stack"
description: "ATT, SKAdNetwork 4 and modeled conversions: the new architecture of mobile performance marketing. How to set up measurement in the post-lookback maturity period."
publishedAt: 2026-07-28
modifiedAt: 2026-07-28
category: marketing
i18nKey: marketing-003-2026-07
tags: [ios-attribution, skadnetwork, att, mobile-performance, modeled-conversions]
readingTime: 7
author: Roibase
---

Three years have passed since iOS 14.5. ATT (App Tracking Transparency) is no longer a "new development" — it's a mature reality. By mid-2026, most performance teams still miss the old attribution stack, but there's no going back. With iOS 17, SKAdNetwork 4.0 is fully adopted, Meta and Google have brought modeled conversions to production-grade stability, and TikTok has opened its own probabilistic pipeline. The problem isn't "no data" anymore — it's "which signals do we trust and how do they fit together."

In this article, we break down the technical layers of mobile ad attribution after iOS 17, the real-world constraints of SKAdNetwork 4.0, the mechanics of modeled conversions, and the post-lookback architecture that ties these three data flows together. The goal: know which signal to weight when showing an ad to an iOS user in 2026.

## Signal Layers After ATT

In the iOS 17 environment, three signal types exist: deterministic (SKAdNetwork), probabilistic (modeled conversions), and first-party (server-side events). Each operates at different latency, granularity, and confidence levels.

SKAdNetwork 4.0 delivers coarse-grained conversion values (0-63 range) but with 24-48 hour latency. Timer windows are three-tiered: first 0-2 days, then 3-7 days, finally 8-35 days. The first two windows are critical for campaign optimization because bid adjustments need to be near real-time. But SKAd data is aggregated — no user-level breakout, only campaign ID-level volume.

Modeled conversions come from the platform's (Meta, Google, TikTok) own machine learning model estimating conversions. When an iOS user rejects ATT, there's no deterministic signal, but the platform uses user behavior patterns (engagement rate, past install cohorts, device type) to produce a probabilistic estimate. Meta started 2024 at 30% modeled, 70% observed; by 2026, some campaigns can hit 50-50 ratio. Google UAC works similarly but keeps the conversion window shorter (7 days).

First-party server-side event stream means sending in-app activity directly to an MMP (Mobile Measurement Partner) or CDP. This signal is user-level but has no attribution — you don't know which ad it came from, only cohort behavior tracking. For example, measuring D7 retention is possible but attributing it to a campaign is tricky.

## Real Constraints of SKAdNetwork 4.0

SKAdNetwork 4.0 brought many improvements: hierarchical source identifier (4-tier campaign structure), multiple conversion windows, web-to-app attribution support. But production hits two major bottlenecks: postback delay and conversion value encoding complexity.

Postback delay averages 24-72 hours. The first window (0-2 days) has slightly faster timing but still prevents real-time optimization. Bid strategies usually look at T-2 data, so you adjust today's bid based on yesterday's cohort performance. This means slow response to trend shifts.

Designing conversion value schema is its own engineering problem. Squeezing revenue, event type, user quality into a 0-63 integer requires careful planning. The most common pattern: first 32 values for event-based signals (install, registration, first purchase), last 32 for revenue buckets. But this encoding must be brand-specific — generic schemas don't work. For example, a gaming app where D1 retention is critical might allocate 0-15 for retention signals, 16-31 for IAP events, 32-63 for LTV buckets.

SKAdNetwork's crowd anonymity threshold also causes production friction. Apple suppresses very low-volume campaign combinations to protect privacy. So if a test campaign has 50 installs per day, SKAd postbacks may not arrive. This makes new campaign testing harder — you either need to rapidly scale volume or use broader targeting.

## How Modeled Conversions Work

Meta's modeled conversions system runs on a statistical attribution model. When a user opts out of ATT, Meta can't read the IDFA but can use: ad engagement (impression, click), device type, network quality, campaign targeting overlap. These features feed into a Bayesian regression model that answers "did this user convert" probabilistically.

The model's confidence interval typically ranges 80-95%, so each prediction carries 5-20% error margin. Meta Ads Manager shows this as "Estimated conversions." Campaign Budget Optimization (CBO) uses this modeled signal but weights it lower than observed conversions.

Google UAC applies conversion modeling more aggressively. On Android, Google Play Instant delivers deterministic signals, but iOS relies entirely on models. Google's advantage: if Firebase Analytics is integrated, the in-app event stream is richer, improving model accuracy. But the lookback window is still constrained — Google models over 7 days, Meta can extend to 28.

TikTok exited its probabilistic attribution pipeline from beta in late 2025. It uses a hybrid TikTok Pixel + SKAdNetwork approach. If a user spends long in TikTok (high engagement) and then clicks an app store link, this pattern enters the model as a strong signal. TikTok's limitation: its network is smaller than Meta or Google, so cross-platform behavior patterns are incomplete.

## Post-Lookback Maturity Architecture

During the post-lookback maturity phase (after SKAdNetwork postbacks complete), you conduct true performance evaluation. This requires combining three data flows: SKAdNetwork observed, platform modeled, and MMP first-party.

The architecture works like this: SKAdNetwork postbacks land in the MMP (Adjust, AppsFlyer, Kochava), platform modeled conversions are pulled via API simultaneously, first-party in-app events flow to a CDP or data warehouse (BigQuery, Snowflake). To unite these three streams, you need a common key: campaign ID + install cohort date.

The merge logic must answer: Do modeled conversions overlap with SKAd postbacks? Are you double-counting the same install? For deduplication, MMPs typically treat SKAd as ground truth, adding modeled conversions as supplementary estimates. For example, if SKAd says 100 installs and Meta's model says 40, you report 100 confirmed + 40 probabilistic, not 140 total.

LTV (Lifetime Value) calculation comes entirely from the first-party stream. SKAdNetwork doesn't provide LTV; modeled conversions don't estimate revenue. So for cohort-based LTV analysis, access to the raw event stream in an MMP or CDP is mandatory. The typical flow: take install cohort from SKAd, calculate that cohort's D7/D30/D90 revenue from first-party, then use SKAd install count × cohort LTV for campaign-level ROAS.

Building this architecture requires data pipeline engineering in your [Performance Marketing (PPC)](https://www.roibase.com.tr/ru/ppc) stack. Not just dashboards — ETL (Extract, Transform, Load) process, deduplication logic, and model confidence threshold tuning are critical.

## Incrementality and Holdout Test Design

Modeled conversions create a trust problem: did the user really convert or did the model fabricate it? Incrementality measurement is the answer. The cleanest method: geo-based holdout test.

A geo-holdout test works like this: turn off the campaign in specific geographies (state, city, DMA), compare organic install rate in that region against regions where campaigns run. The difference equals incremental lift. But running geo tests on iOS attribution is hard because SKAdNetwork doesn't provide geo breakdown. The test must be built at the MMP level — geo is inferred from install IP but isn't 100% accurate.

Alternative: time-based holdout. Pause the campaign on specific days of the week, measure install volume drop. This method is simpler but can introduce seasonality bias (if Sunday organic installs are already high, campaign impact gets underestimated).

Meta offers its own Conversion Lift test tool. It segments users into test and control groups, shows ads to test, shows PSA or charity ads to control, then compares conversion rates. This test runs independently of SKAdNetwork because Meta uses its own user graph. But it requires minimum 200K impressions, so small campaigns can't run it.

Use incrementality test results to calibrate modeled conversions' confidence intervals. For example, if a lift test shows 60% incremental but modeled conversions claim 80% conversion, the model is overestimating — lower its weight.

## Which Signal to Trust in Campaign Optimization

By mid-2026, hybrid signal approach is mandatory for campaign optimization. Trusting only SKAdNetwork creates latency, trusting only modeled conversions causes confidence loss.

Recommended strategy: in the first 48 hours, weight modeled conversions heavily (SKAd is delayed), then recalibrate the model once SKAd postbacks arrive. For example, in a Meta CBO campaign, the first two days shift budget between ad sets based on modeled signals; by day 3, when SKAd data arrives, the weight of observed conversions increases.

For bidding: use tROAS (target ROAS) + volume cap hybrid instead of ROAS-based bidding. Calculating deterministic ROAS on iOS users is difficult, so set a fixed tROAS target (say, 3.0x), but also apply a daily install volume floor (minimum 500 installs/day). This protects both profitability and scale.

Creative testing also suffers from signal constraints. You may lack sufficient volume for A/B tests (due to SKAd crowd anonymity threshold). Run sequential tests instead: run creative A for 3 days, then B for 3 days, compare once SKAd postbacks arrive. This method isn't perfectly clean (external factor bias exists) but is the most pragmatic choice under iOS constraints.

## Closing

The post-iOS 17 attribution stack isn't deterministic — it's probabilistic, delayed, and multi-layered. SKAdNetwork 4.0 provides foundational signals but with latency; modeled conversions add speed but introduce trust questions; first-party streams enable LTV calculation but don't attribute. Combining all three and understanding each one's confidence range is now core competency in performance marketing. Teams that don't build this stack right either underinvest (distrust the modeled signal, miss opportunity) or overinvest (ignore model overestimation, blow up CAC). In 2026, the winner is the team that binds signal complexity to engineering discipline.