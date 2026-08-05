---
title: "Bayesian Price Optimization in Mobile F2P"
description: "Optimize IAP price tiers with Bayesian testing: posterior estimation, segment-based pricing, and revenue lift calculation methodology."
publishedAt: 2026-08-05
modifiedAt: 2026-08-05
category: gaming
i18nKey: gaming-002-2026-08
tags: [f2p-monetization, bayesian-testing, iap-optimization, price-ladder, mobile-gaming]
readingTime: 8
author: Roibase
---

IAP price optimization in mobile F2P games is often reduced to A/B testing: compare two prices, pick the higher revenue winner. This approach worked in 2018 because UA costs were low and sample size wasn't an issue. In 2026, the landscape is different: post-iOS 14.5 cohort tracking is fragmented, Apple Search Ads CPIs have risen %340, and test durations have stretched from 8 weeks to 14 weeks. Bayesian methodology provides two advantages under these conditions: posterior distributions enable earlier decision-making, and segmentation strengthens the model through prior knowledge. Price elasticity in game economies isn't constant—it varies across whale/dolphin/minnow segments, and capturing this difference is beyond frequentist A/B's capability.

## The Economic Logic of Bayesian Tests

In mobile F2P, the cost of a price test isn't just development time—it's opportunity cost. If you're testing $4.99 versus $6.99 and waiting 14 weeks to reach statistical significance, the revenue you forfeit while finding the right price *is* the test cost itself. The Bayesian approach updates the posterior probability distribution daily: conversion rate isn't exactly 2.3%, but rather 1.8–2.9% with 95% credibility. As this interval narrows, the decision becomes clearer and you can stop the test early.

In frequentist A/B testing, you calculate minimum sample size for p-value <0.05, then wait until you hit that threshold. Mobile gaming cohorts, however, fluctuate daily: a feature launch drives DAU +40%, summer seasonality drops it −25%. The Bayesian model interprets this variance as prior updating, not adhering to a fixed sample plan.

Practical example: in a game with 10,000 DAU, you test a $9.99 starter pack price. Frequentist math requires 42,000 users over 6 weeks to detect +5% revenue lift. A Bayesian model shows by week 3 that posterior mean ARPPU is $11.2 (control: $10.8), with a 95% credible interval that doesn't overlap—decision made, test closed. You've recaptured 3 weeks of forgone revenue.

### Prior Selection and Segmentation

In Bayesian tests, prior distribution choice isn't subjective—it's shaped by historical data. If you tested 8 price points between $4.99–$9.99 on a similar game last year, that data yields a beta distribution prior. The prior may be weak (high variance), but it outperforms an uninformed uniform prior because you know whale conversion rates don't drop below 0.5%.

Segmentation strengthens the prior: new users get an uninformative prior; 30+ day retention users get a tight prior. Hierarchical Bayesian models estimate segment-level and global-level parameters simultaneously—each segment uses its own data while sharing the global trend. This prevents overfitting in small segments.

## IAP Price Ladder Architecture

F2P price ladders aren't flat; they're distributed on a logarithmic scale: $0.99, $2.99, $4.99, $9.99, $19.99, $49.99, $99.99. These jumps have psychological roots (charm pricing) but stronger economic justification: each rung captures a different willingness-to-pay segment. In Bayesian optimization, each tier has its own posterior and they interact—raising $4.99 may decrease $2.99 conversions (downgrade) while raising $9.99 (upgrade).

Ladder testing isn't optimizing a single price; it's optimizing the entire staircase. A multi-armed bandit algorithm treats each price point as a separate arm, using Thompson Sampling to draw from the current posterior and select the highest expected revenue option. The first 2 weeks explore all arms equally; from week 3 onward, as posterior confidence grows, exploitation dominates.

Example scenario: 7-tier ladder, 21-day test. First 7 days: each price gets 14% traffic (uniform). From day 8: the price with highest posterior mean × conversion rate draws traffic. By day 21: $4.99 takes 40% traffic, $9.99 takes 25%, others split 5–10%. The final decision keeps both $4.99 and $9.99 because neither cannibalizes the other—both drive positive marginal revenue.

### Segment-Based Pricing

The same price doesn't work across whale/dolphin/minnow segments because price elasticity differs. Whales (top 1% spenders) buying a $99.99 package see conversion drop only 3% if price rises 20%—inelastic. Minnows (first week, <$0.99 spend) show 18% drop on a 10% price increase—elastic. The Bayesian model encodes this elasticity in segment-level priors.

Segmentation uses: install age (D1/D7/D30), total lifetime spend, time since last IAP, session frequency, level progression. These features generate a latent segment prior—a hierarchical model estimates segment membership itself. New users get assigned to a segment within 24 hours based on behavioral signals, and pricing adapts accordingly.

Roibase's [App Store Optimization](/tr/aso) work uses similar segmentation: creative test results vary by user segment; the same creative yields 8% IPM on iOS 16+ but 3% on iOS 15. When ASO merges with IAP optimization, funnel integrity follows—showing the right price to the right user requires first attracting the right user.

## Posterior Estimation and Decision Mechanisms

The Bayesian test decision metric is posterior probability of superiority: P(treatment > control | data). When this exceeds 95%, treatment wins. The difference from frequentist p-value: p-value measures data extremity under a null; posterior probability directly answers "what's the probability treatment is better?"

For posterior calculation, conjugate priors yield analytical solutions (beta-binomial); otherwise, MCMC simulation runs. Mobile gaming tests often mix: beta priors for conversion, lognormal for revenue. PyMC3 or Stan complete 10,000 MCMC iterations in ~30 seconds, with daily posterior updates as new data flows in.

The decision threshold can be 90% instead of 95%—aggressive growth phases tolerate 90%, mature games demand 95%. Lower thresholds raise false positive risk but cut test duration. Expected value of information (EVI) calculates the optimal threshold: the cost of running the test one more week versus the cost of a wrong decision.

### Multi-Variant Bayesian Test Structure

IAP price tests typically include 3+ variants: control ($4.99), treatment A ($5.99), treatment B ($6.99). Frequentist A/B suffers multiple comparison bias; Bonferroni correction multiplies sample size. Bayesian: each variant has its own posterior, pairwise comparisons happen simultaneously. Rather than picking the highest posterior mean, you maximize expected revenue—each variant's win probability × expected revenue.

Thompson Sampling strategy: each day, sample once from each variant's posterior, send traffic to the highest sample. This auto-balances explore/exploit—when posterior uncertainty is high (early days), traffic stays distributed; as winning variants emerge, traffic concentrates.

Code snippet (PyMC3 with a simple beta-binomial model):

```python
import pymc3 as pm

with pm.Model() as iap_model:
    # Prior: uniform beta
    p_control = pm.Beta('p_control', alpha=1, beta=1)
    p_treatment = pm.Beta('p_treatment', alpha=1, beta=1)
    
    # Likelihood
    obs_control = pm.Binomial('obs_control', n=n_control, p=p_control, observed=conversions_control)
    obs_treatment = pm.Binomial('obs_treatment', n=n_treatment, p=p_treatment, observed=conversions_treatment)
    
    # Posterior sampling
    trace = pm.sample(10000, return_inferencedata=False)
    
    # Probability of superiority
    prob_superiority = (trace['p_treatment'] > trace['p_control']).mean()
```

This model optimizes conversion rate. For revenue optimization, add a lognormal prior and compute joint posterior on p × revenue_mean.

## Segment Migration and Long-Term Impact

Price optimization isn't a one-time test; it's continuous. Users migrate between segments: today's minnow becomes a dolphin in 30 days. A static prior doesn't capture this. Solution: dynamic prior updates—every 30 days, the posterior merges with new data to become the new prior.

Long-term impact uses Bayesian survival analysis on cohort retention curves. If a price change drops D7 retention 2% but lifts LTV from $12 to $14, that's net positive. Survival models use Weibull distributions to estimate shape and scale parameters; posterior predictive checks forecast 90-day LTV.

Retention impact testing normally takes 6–8 weeks (waiting for D30 signals). Bayesian methods predict D30 from D7 data using historical D7→D30 transition rates as prior. By week 3, you get early signals: if posterior mean D30 retention is 18% with a 95% credible interval [16%, 20%], continue; if it's [14%, 16%], the price is damaging retention—stop and revert.

## Game Economics and Platform Dynamics

iOS and Android users respond differently to the same ladder. iOS users average 23% higher ARPPU; the same $4.99 price sees 3.2% iOS conversion vs. 2.1% Android. The Bayesian model treats platform as a hierarchical factor—each platform gets its own segment prior while sharing the global trend.

Apple's App Store pricing tier system (Tier 1 = $0.99, Tier 5 = $4.99, etc.) constrains price flexibility. Between tiers, you grid-search rather than test—finding the highest posterior expected revenue among Tiers 3/4/5. Google Play allows arbitrary pricing but shows higher conversion volatility; Android tests use 30% wider prior variance.

Currency fluctuation also affects posteriors: when TRY prices are ₺49.99 and the dollar moves from ₺25 to ₺35, real price drops from $2 to $1.43. The model uses currency-adjusted revenue, calculating posteriors in USD. For emerging markets, PPP-adjusted pricing gets separate priors—the same game might be $4.99 in the US and R$9.90 in Brazil (~$1.80 PPP equivalent).

Within the [Premium Publisher Program](/tr/premiumyayinci), UA campaigns also feed price test results: higher LTV segments see increased CPM bids, low-conversion segments see bids cut. When Bayesian IAP optimization merges with UA bidding, portfolio-level ROI becomes tractable—one model output answers which user segment gets which price at what maximum CPI.

---

Mobile F2P price optimization can no longer reduce to "which price wins?" Segment-based elasticity, platform differences, retention impact, currency risk—all enter the model. Bayesian methodology fits this complexity into a prior/posterior framework and enables early decisions. However, building a Bayesian test is more complex than frequentist A/B: data pipelines, MCMC infrastructure, and prior tuning are required. The ROI math is straightforward: if you run 2+ price tests monthly and each closes in 2 weeks instead of 4, the time saved pays for itself. Building the model takes 1 sprint; maintenance is 2 hours of analytics per week—net positive trade-off.