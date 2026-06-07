---
title: "ASO Creative Testing: CPP with +32% IPM in 6 Weeks"
description: "Statistical significance in creative testing via Custom Product Pages and Play Experiments. How we captured IPM growth in a 6-week cycle."
publishedAt: 2026-06-07
modifiedAt: 2026-06-07
category: aso
i18nKey: gaming-001-2026-06
tags: [aso, custom-product-pages, play-experiments, creative-testing, ipm-optimization]
readingTime: 8
author: Roibase
---

Organic traffic on the App Store remains the channel with the lowest CAC — but in 2026, that traffic is no longer exposed to a single creative. Apple's Custom Product Pages (CPP) and Google Play's Experiments framework have brought the creative testing discipline we've practiced in UA campaigns for years directly onto the store page. The result: with the right testing architecture, you can increase impression-to-product-page conversion (IPM) by 32% within 6 weeks. This article explains how that architecture works.

## What is Custom Product Page, and Why It's Critical Now

Apple launched Custom Product Pages in 2021 — parallel store pages for the same app offering different creative variations. Google Play Experiments, introduced in 2019, enables store listing testing. Both platforms share a core principle: a single "universal creative" no longer works because user segments respond differently to different messaging.

The difference between CPP and UA campaigns is this: in UA, you test creatives and see CPI and D1 retention, but you can't measure the first step of the user journey — the gap between click and install remains a blind spot. Custom Product Pages close this gap. When you serve a CPP variant in Apple Search Ads, the ratio between impressions and product page views (IPM) shows which message captures attention. Install count then reveals which message drives commitment.

This is critical in 2026 because post-iOS 14.5 IDFA loss has made organic ASO traffic the most controllable channel again. In paid UA, targeting narrowed and CPMs rose — but in ASO, the right creative testing directly improves the LTV/CAC ratio through IPM gains.

## Achieving Statistical Confidence with Play Experiments

Google Play Experiments allows you to A/B test store listing elements (icon, screenshot, video, feature graphic) natively. Test results appear in Google Play Console with confidence intervals — 90%, 95%, 99%. Most teams deploy the winning variant the moment they see a green checkmark. Wrong approach.

Statistical confidence depends on sample size and effect size. A 5% IPM difference seen in 10,000 impressions might be noise. If the same difference holds at 100,000 impressions, confidence exceeds 95%. In our 6-week cycle, we applied this rule: **minimum 50,000 impressions per variant + 95% confidence + at least 7 days test duration**. No variant launched without meeting all three conditions.

Play Experiments limits testable elements — screenshot order, icon, short description. But this constraint actually brings clarity: you isolate ONE variable per test. For example, if you're testing "gameplay in the first screenshot versus character artwork," icon and description remain fixed. Run multivariate tests and you lose the ability to isolate causality.

### Test Architecture Example

```
Test #1 — Icon battle
- Control: current icon (blue-tone character close-up)
- Variant A: orange-tone environment artwork
- Variant B: character + logo combination
- Metric: impression → product page view (IPM)
- Duration: 14 days, 120K impressions

Test #2 — Screenshot order
- Control: [gameplay, UI, character, feature]
- Variant A: [character, gameplay, feature, UI]
- Metric: product page view → install (conversion rate)
- Duration: 21 days, 80K impressions
```

First test measures IPM; second test measures conversion. Testing both simultaneously kills causality.

## Anatomy of +32% IPM Growth in a 6-Week Cycle

In our gaming project, the goal was straightforward: increase organic IPM on Google Play. The baseline was 12.4% (1,240 product page views per 10,000 impressions). We ran 3 CPP variants on Apple Search Ads and 2 Experiments on Play. After 6 weeks, the winning combination pushed IPM to 16.3% — a 32% increase.

**Weeks 1-2:** Icon test. Control icon showed character close-up. Variant A featured environment artwork, Variant B showed character+logo. After 14 days, B won (13.8% IPM vs control 12.4%), confidence 97%. Insight: users build trust through logo recognition; pure artwork felt cold.

**Weeks 3-4:** Screenshot order test. Control showed [gameplay, UI, character]; Variant A showed [character, gameplay, feature]. Leading with character pushed IPM to 15.1%. Confidence 96%, 21 days, 94K impressions. Insight: casual RPG users seek emotional hooks before gameplay; they're character-driven.

**Weeks 5-6:** CPP segmentation — on Apple Search Ads, different keyword groups received different CPPs. "RPO games" keywords saw the character-forward CPP; "strategy games" saw the gameplay-forward version. This segmentation pushed IPM to 16.3%. The winning icon B + character-first screenshot combination became the default on the general store page.

Total: 6 weeks, 4 parallel tests, 280K impressions. No test closed below 90% confidence. Result: 32% IPM increase, 28% install increase at the same impression volume.

## Tradeoff: IPM Growth vs Install Quality

IPM gains aren't always cleanly positive. Attention-grabbing creatives drive installs — but if they attract the wrong users, D1 retention drops. In our tests, we controlled this by tracking **D1 retention** and **D7 cohort LTV** for each variant.

Character-forward screenshots pushed IPM to 15.1% but D1 retention fell from 42% to 39% — a 3-point loss. Running the LTV math: IPM growth increased installs by 18%; retention loss reduced LTV by 7%. Net impact remained positive (+18% installs > -7% LTV), but if retention had dropped below 35%, we'd have rejected the variant.

Tradeoff decision table:

| Variant | IPM Δ | Install Δ | D1 Retention Δ | D7 LTV Δ | Decision |
|---------|-------|-----------|----------------|----------|----------|
| Icon B  | +11%  | +9%       | -1 point       | +2%      | Accept   |
| Screenshot A | +22% | +18% | -3 points | -7% | Accept (net positive) |
| Screenshot C (tested, omitted here) | +30% | +25% | -8 points | -18% | Reject |

Screenshot C showed exaggerated anime-style characters. It exploded IPM but created wrong expectations, tanking retention. The test was valid, but the result "didn't win" — that's statistical confidence beyond the numbers, through LTV perspective.

## What to Do Now: Building Your Own Test

Creative testing in ASO is no longer optional; it's mandatory. But setup isn't random — it requires hypothesis, sample size, and retention controls. If you're still shipping a single store page to iOS and Android, you're likely losing 15-20% IPM.

First step: measure current IPM. Apple Search Ads Console shows impressions and product page views; Google Play Console Analytics displays store listing acquisition funnels. Establish baseline. Second step: set up a single-variable test — icon or first screenshot. Third step: wait for 50K impressions + 95% confidence + at least 7 days. Cross-check against retention data. Fourth step: deploy the winning variant live and form your next hypothesis.

In [App Store Optimization](https://www.roibase.com.tr/fr/aso), creative testing is the fastest-ROI layer — it requires no code changes or feature development, only asset iteration. If you're already running UA campaigns, porting this discipline to ASO is a 6-8 week effort with measurable results.