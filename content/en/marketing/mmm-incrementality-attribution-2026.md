---
title: "MMM + Incrementality: Your 2026 Attribution Stack"
description: "Robyn, Meta Lift, and geo experiments — which method works when? A technical guide to rebuilding attribution in the post-cookie era."
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: marketing
i18nKey: marketing-004-2026-06
tags: [mmm, incrementality, attribution, robyn, meta-lift]
readingTime: 8
author: Roibase
---

Last-click attribution died in 2023, multi-touch in 2024. By 2026, marketing measurement has split into two poles: Marketing Mix Modeling (MMM) at the macro level, incrementality testing at the micro level. Server-side conversion APIs bridge the gap between them. This guide explains which method works in which situation, which output feeds which decision — not abstract "attribution philosophy," but a stack you can actually build and run.

## Marketing Mix Modeling now runs weekly

MMM used to mean "annual executive presentation" in 2015. By 2026, open tools like Meta's Robyn and Bayesian frameworks can run every week, updating channel contribution continuously. Here's how it works: you model historical spend, impressions, conversions, and external factors (seasonality, holidays, competitive index) through time-series regression, extracting each channel's marginal ROAS. Add 100K to which channel to get one extra purchase — MMM answers that.

Setup isn't simple, but the technical requirements are transparent: at least 52 weeks of daily data (ideally 104 weeks), attributable spend lines per channel, conversion counts (revenue is better). Robyn runs on Python and R, pulls data from BigQuery or Snowflake, calculates posterior distribution via Prophet or Stan. Output is channel contribution graph, saturation curve, response curve — which channel suffers from budget saturation, which is already at diminishing returns.

Robyn's 2026 version adds geo-level granularity: split Turkey into 7 regions and you get separate saturation thresholds for each. Istanbul may hit Meta Ads saturation at 35% while Anatolia sits at 10% — seeing that gap changes your budget shift decision. But caveat: MMM doesn't prove causality, it shows correlation. "Spend on Google Ads rose, so sales rose" isn't the same as "Google Ads caused those sales." That's where incrementality steps in.

## Meta Lift solved incrementality within the platform

Meta's Conversion Lift test is a true randomized controlled trial (RCT). It splits your audience in two: shows ads to the test group, withholds them from control. The conversion difference between groups is that campaign's **net contribution**. By 2026, this system drilled down from campaign level to creative level — three different videos in the same campaign each get separate incrementality scores.

Technical setup: in Ads Manager, pick "Create Lift Test" instead of "Create A/B Test." Minimum 200K reach and 2-week duration required (Meta enforces this). Keep the control group between 10-20% — below that, statistical power drops; above that, revenue loss grows. When the test ends, Meta gives you: "Test group: 1,000 conversions, control group: 700 → 30% incremental lift, confidence interval 18%-42%."

That number ties directly to budget. If the campaign spent 100K and showed 30% lift, then 30K in spend actually drove incremental sales — the other 70K would have happened organically or via other channels anyway. From there you calculate marginal cost per incremental conversion (mCPIC): 100K / 300 = 333 per incremental unit. Compare this to MMM's output: "Meta's last 1K in spend drove 2.8 purchases" — the two should validate each other. 15-20% gap is normal (methodological difference), but 50%+ gap means you have a data problem.

Meta Lift's constraint: it only works within Meta's ecosystem; it can't measure cross-channel effects. When Google Ads + Meta run together, is there synergistic lift? That's what geo experiments measure.

## Geo experiments look at cross-channel synergy

Google's Geo Experiments framework works like this: divide Turkey into 10 regions, increase spend 20% in 5 of them (or kill it entirely), leave 5 as-is. Four weeks later, compare the sales lift between groups — if there's a difference and it's statistically significant (p<0.05), the spend change caused it. Different from Meta Lift: it doesn't separate by channel, it looks at total effect by region.

In practice: Campaign Manager 360 or Google Ads has "Experiments" > "Geo experiment" (by 2026 GA4 can trigger it too). Define regions by postal code, province, or DMA (NUTS2 regions in Turkey). Minimum 6 weeks of baseline data, test runs at least 3 weeks (ideally 6 — to damp seasonal noise). Google's Bayesian engine updates posteriors daily; when done, it says: "20% spend increase drove 8.5% sales lift (CI: 4.2%-12.8%)."

This method is especially powerful for testing cross-channel strategy. Example: "Do Google + Meta together deliver 15% more sales than separately?" Put both channels at full throttle in group A, reduce Google by 50% in group B. If the sales gap is under 10%, there's no synergy — reallocate budget. Geo experiment's downside: expensive setup (6 weeks baseline + 6 weeks test = 3 months), results only meaningful if you test big moves. Trying to measure a 5% budget tweak vanishes in noise.

## Which method when — decision tree

Three questions narrow your choice:

1. **What's the decision scope?** Annual budget allocation → MMM. Campaign-specific creative comparison → Meta Lift. Cross-channel synergy test → Geo experiment.

2. **Is the data foundation ready?** MMM requires 52+ weeks of clean spend + conversion. Lift needs 200K+ reach and 2 weeks. Geo needs 6 weeks baseline plus geographic segmentation.

3. **How fast must the decision happen?** Weekly optimization → keep Meta Lift running. Quarterly strategy → refresh MMM monthly. One or two big pivots per year → Geo experiment.

Here's the table:

| Method | Output | Timeline | Min. data | Best for |
|---|---|---|---|---|
| MMM (Robyn) | Channel contribution, saturation | 52+ weeks | Daily spend + conversion | Budget allocation strategy |
| Meta Lift | Incremental conversion per campaign/creative | 2-4 weeks | 200K reach | Creative testing, campaign pruning |
| Geo Experiment | Cross-channel synergy, regional lift | 6-12 weeks | 6 weeks baseline + region data | Channel synergy test, regional expansion |

These three aren't alternatives; they're complementary. MMM says "which channel is worth how much," Lift says "did this campaign actually add value," Geo says "are two channels better together." Teams running all three base [performance marketing](https://www.roibase.com.tr/en/ppc) strategy on experiment, not guess.

## Building the stack in practice

Translating theory into practice requires these layers:

**Data collection:** Send conversion signals from server-side GTM to Google Ads, Meta CAPI, and BigQuery in parallel. If you rely on client-side cookies, you lose 30-40% of signals (iOS 17, Firefox, Brave). Roibase's [digital marketing](https://www.roibase.com.tr/en/dijitalpazarlama) infrastructure combines sGTM + first-party data layer — this is where MMM gets the granular spend data it needs.

**Model pipeline:** Feed Robyn from BigQuery. Use dbt to model spend + conversion at daily grain. Run a Python script weekly (Cloud Functions or Airflow), pull output to Looker Studio. Kick off Lift tests manually in Meta Ads Manager, but pull results via API (Marketing API `insights` endpoint returns lift metrics), write to BigQuery, join with Robyn output.

**Geo experiment:** Google Ads API's `experiments` resource supports programmatic setup. When the test ends, fetch results with `experiment_id`, write to BigQuery, compare to MMM outputs. Seeing all three in one dashboard is invaluable: "MMM says Meta is 22% of contribution, Lift test shows 28% incremental, Geo test shows 12-34% regional variance" — those three numbers together clarify strategy.

**Decision loop:** Refresh MMM quarterly, run 1-2 Lift tests monthly, run Geo experiment once every 6 months. For small teams this pace may be ambitious — start with MMM (two weeks to build if you have clean data), then make Meta Lift routine (default on every campaign), reserve Geo for major pivots only.

By 2026, attribution isn't one tool; it's orchestration of three. Each answers a different question, together they make decisions possible in a post-cookie world. Test over guess, causality over correlation, experiment result over dashboard — that's the foundation growth sits on.