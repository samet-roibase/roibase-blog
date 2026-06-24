---
title: "Bayesian Price Optimization in Mobile F2P"
description: "Optimize IAP price tests with posterior estimation. Segmentation, test duration, conversion trade-offs — a production-ready framework to boost F2P revenue."
publishedAt: 2026-06-24
modifiedAt: 2026-06-24
category: gaming
i18nKey: gaming-002-2026-06
tags: [f2p-monetization, bayesian-optimization, iap-testing, mobile-gaming, pricing-strategy]
readingTime: 8
author: Roibase
---

Mobile F2P pricing optimization still runs on A/B test logic: two price points, 7-14 days, declare a winner. But when conversion climbs from 2.8% to 3.1%, did you actually gain—or just miss the whale segment and tank overall LTV? Frequentist A/B tests tell you "which variant won" but not "which price for which user segment at which moment." Bayesian price optimization fills that gap. By updating your IAP ladder over posterior distributions, you optimize both conversion *and* segment-specific revenue simultaneously.

## Why Frequentist A/B Testing Falls Short in F2P

Classical A/B testing rests on two assumptions: (1) user behavior is stable across the test window, (2) the winning variant is optimal for all segments. In F2P, both fail. User behavior shifts at 72 hours, day 7, and day 30—the same price performs differently across retention cohorts. Take this example: a $4.99 starter pack converts at 3.5%, the $9.99 variant at 2.8%—classic A/B declares $4.99 the winner. Yet 30-day LTV analysis reveals the $9.99 variant generates 42% higher lifetime spend in the whale segment (top 5% spenders). Frequentist testing misses this dynamic because it doesn't estimate posteriors by segment.

The second problem: fixed test duration. You run for 14 days, then decide—but you may not reach statistical power by day 14. Bayesian posteriors update continuously; you stop early once sufficient confidence emerges, or extend if results remain ambiguous. This matters in F2P because live ops calendars won't wait two weeks. New events arrive, pricing context shifts, your test result becomes stale.

Third: binary decision logic. Frequentist testing says "A won," but in F2P there is no winner—the right price exists at the right segment at the right moment. Bayesian optimization delivers an optimal price *range* per segment via posterior estimation, feeding a dynamic pricing engine.

## Bayesian Price Ladder Testing: Iterative Optimization via Posterior Estimation

Bayesian price optimization operates across three layers: prior distribution (historical test data + domain knowledge), likelihood function (live conversion data), posterior distribution (their product—your updated belief). For IAP pricing:

**Prior setup:** You have conversion and revenue distributions from prior price tests. Say your $4.99 IAP prior is Beta(120, 3800)—120 conversions, 3800 impressions. This is your game's baseline. Adding $6.99 to the test, you ground the prior in domain knowledge: a 40% price increase typically drives 25–35% conversion dip (elasticity −0.6 to −0.9). Your $6.99 prior becomes Beta(80, 3840).

**Likelihood updates:** The test launches; new conversion data flows daily. Bayesian updating refreshes the posterior each day. By day 3, the $6.99 variant shows 45 conversions, 1200 impressions—likelihood is Beta(45, 1155). Posterior = prior × likelihood = Beta(125, 4995). You get a current conversion rate estimate: 125/(125+4995) ≈ 2.44%. Crucially, this is not a point estimate but a distribution—the 95% credible interval is [2.1%, 2.8%]. Translation: conversion lies between 2.1–2.8% with 95% probability.

**Thompson Sampling for dynamic allocation:** Classical A/B splits traffic 50/50. Bayesian optimization uses Thompson Sampling: each impression, sample from the posterior distribution, display whichever variant maximizes expected revenue. As the test progresses, better-performing variants receive more traffic—but never 100% until the posterior is tight enough. F2P benefit: whale segments are small but high-value; early cutoff loses them.

Code example (Python + PyMC):

```python
import pymc as pm
import numpy as np

# Prior: $4.99 IAP conversion
prior_alpha_499 = 120
prior_beta_499 = 3800

# $6.99 variant—new test
conversions_699 = 45
impressions_699 = 1200

with pm.Model() as price_test:
    # Posterior update
    conv_rate_699 = pm.Beta('conv_rate_699', 
                             alpha=prior_alpha_499*0.7 + conversions_699,
                             beta=prior_beta_499*1.0 + (impressions_699 - conversions_699))
    
    # Expected revenue (IAP price × conversion)
    expected_revenue = conv_rate_699 * 6.99
    
    # Sampling
    trace = pm.sample(2000, return_inferencedata=True)

# 95% credible interval
print(pm.summary(trace, var_names=['conv_rate_699']))
```

This approach tells you: "By day 3, $6.99 conversion is 2.1–2.8%, expected revenue per user $0.17." As the test progresses, that interval narrows.

## Segment-Specific Price Ladders: Whale, Dolphin, Minnow Optimization

All F2P users don't respond identically to price. Without segment-specific posterior estimation, you optimize average conversion but miss segment-level revenue. Three core segments:

**Whales (top 5% spenders):** LTV $200+, 8+ IAP purchases, D30 retention 85%+. Price sensitivity is low—a 15% conversion dip at $9.99 is offset by 60% higher lifetime spend. Posterior estimation answers: "Is $9.99 optimal for whales, or does $14.99 yield higher LTV?" Track whale-cohort conversion separately; the posterior refines for this segment alone. Example: overall conversion at $9.99 is 2.8%, but whales convert at 6.2%—test a higher price point for them.

**Dolphins (mid 25% spenders):** LTV $20–50, 2–4 IAP purchases, D30 retention 50–70%. Medium price sensitivity. Bayesian testing typically finds the optimal range: $4.99–$6.99, and identifies which maximizes expected revenue. The posterior may be bimodal—some dolphins spike like whales (weekend), others trend toward minnow behavior. Segmentation refinement is needed.

**Minnows (remaining 70%):** LTV <$10, mostly non-payers. High price sensitivity—even $2.99 vs. $4.99 shifts conversion 40%. Bayesian testing usually shows: the lowest price point ($0.99–$1.99) maximizes conversion but total revenue is minimal. Strategy: use $0.99 "impulse buy" to onboard minnows, then funnel them to the $4.99 ladder.

For segment-specific posteriors, use hierarchical Bayesian models:

```python
with pm.Model() as hierarchical_price:
    # Global conversion prior
    global_alpha = pm.Gamma('global_alpha', alpha=2, beta=0.1)
    global_beta = pm.Gamma('global_beta', alpha=2, beta=0.1)
    
    # Segment-specific conversion
    conv_whale = pm.Beta('conv_whale', alpha=global_alpha, beta=global_beta)
    conv_dolphin = pm.Beta('conv_dolphin', alpha=global_alpha, beta=global_beta)
    conv_minnow = pm.Beta('conv_minnow', alpha=global_alpha, beta=global_beta)
    
    # Likelihood (segment data)
    whale_obs = pm.Binomial('whale_obs', n=200, p=conv_whale, observed=12)
    dolphin_obs = pm.Binomial('dolphin_obs', n=800, p=conv_dolphin, observed=24)
    minnow_obs = pm.Binomial('minnow_obs', n=3000, p=conv_minnow, observed=60)
    
    trace = pm.sample(3000)
```

This model ties whale, dolphin, and minnow conversions through a global prior—even with small sample sizes, estimates remain reasonable.

## Test Duration and Stopping Rules: Decision-Making via Posterior Probability

Classical A/B fixes test duration upfront (14 days, minimum 1000 conversions). Bayesian optimization builds stopping rules into posterior probability: "Does variant A have >95% probability of outperforming B?" This dynamic stopping accelerates wins and reduces false-positive risk.

**Stopping rule example:** $4.99 vs. $6.99 IAP test. Posterior updates daily. By day 5, calculate posterior probability:

```python
# Posterior samples
samples_499 = trace.posterior['conv_rate_499'].values.flatten()
samples_699 = trace.posterior['conv_rate_699'].values.flatten()

# Revenue comparison (price × conversion)
revenue_499 = samples_499 * 4.99
revenue_699 = samples_699 * 6.99

# Probability $6.99 is better
prob_699_better = (revenue_699 > revenue_499).mean()
print(f"P($6.99 > $4.99) = {prob_699_better:.2%}")
```

Day 5: P($6.99 > $4.99) = 73%—too early. Day 9: 94%—still below the 95% threshold. Day 12: 96%—stop the test, deploy $6.99. This saves 2–5 days versus frequentist.

**Minimum test window:** Even if Bayesian stops early, run at least 7 days in F2P. First-week retention spikes, weekend spender behavior, and event effects must be observed. Stopping before day 7 biases the posterior.

**Regret minimization:** With Thompson Sampling, suboptimal variants receive some traffic (exploration). Regret = optimal revenue − actual revenue. Bayesian minimizes regret because posterior tightening shifts traffic toward the leader. Over 14 days: first 5 days average 30% regret, last 5 days 5% regret—overall 15%. Classical A/B maintains 50% splits indefinitely, averaging 25–30% regret.

## Production Deployment: Dynamic Pricing Engine and Posterior Refinement

Test ends, $6.99 wins—but you're not done. Bayesian price optimization's real power lies in continuous posterior refinement post-launch. The test result isn't a static price; it's input to a dynamic pricing engine.

**Dynamic pricing engine architecture:** Each user session, estimate segment (LTV prediction, retention cohort, spending velocity). Sample optimal price point from the segment's posterior distribution. Example: new user, D1 retention at 80%, no prior IAP—minnow prior dominates, $0.99–$1.99 range is sampled. Same user at D7 with 2 IAPs and $8 spend—dolphin posterior strengthens, shift to $4.99–$6.99 range.

**Posterior refinement:** In production, every conversion updates the posterior. After 30 days, the $6.99 IAP accrues 1200 additional conversions—prior Beta(125, 4995), new posterior Beta(1325, 46995). The credible interval tightens: [2.7%, 2.9%]. Now you have 95% confidence in $6.99. But markets shift. A competitor launches a $4.99 campaign, conversions dip—posterior widens again, triggering a new test.

**Multi-armed bandit integration:** If your IAP ladder has multiple SKUs (starter $4.99, mega $19.99, ultimate $49.99), Thompson Sampling becomes the production bandit algorithm. Each impression, sample posterior for every SKU, display the one with maximum expected revenue. Combined with [App Store Optimization](https://www.roibase.com.tr/en/aso) efforts, this creates a potent monetization engine: ASO funnels traffic to the right segment, Bayesian pricing serves that segment the optimal IAP.

**Monitoring and alerts:** If posterior variance spikes suddenly (credible interval widens 50% in 3 days), that's an anomaly signal—platform bug, competitor move, or seasonal shift. Ground alerts in posterior variance:

```python
# Monitor posterior variance
variance_699 = trace.posterior['conv_rate_699'].var()
if variance_699 > threshold:
    trigger_alert("Price test variance spike — investigate")
```

Mobile F2P pricing is no longer "test once, deploy forever." With Bayesian posterior estimation, it becomes a continuously refined, segment-aware, dynamic system. If your IAP ladder is tested via frequentist logic, you're leaving whale segment revenue on the table. Bayesian frameworks compress test cycles, enable segment-level optimization, and build production engines that keep learning. Stuck at 3% conversion? The answer isn't the price—it's *who sees what price, when, and in which context*. The posterior distribution answers that question.