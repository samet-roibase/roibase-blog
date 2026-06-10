---
title: "Bayesian Price Optimization in Mobile F2P"
description: "Managing IAP price tests with posterior estimation: segmentation, price ladder A/B, false positive filtering, and posterior confidence intervals."
publishedAt: 2026-06-10
modifiedAt: 2026-06-10
category: gaming
i18nKey: gaming-002-2026-06
tags: [bayesian-optimization, iap-pricing, f2p-monetization, price-testing, posterior-estimation]
readingTime: 8
author: Roibase
---

Mobile F2P games still run IAP price optimization using frequentist A/B logic: two price packages, 14 days, p<0.05 threshold. This approach causes statistical power loss in small segments (VIP users, whales), killing the chance to make early decisions. Bayesian price optimization updates posterior distributions, enabling both faster decision-making and confidence even with small samples. This article explains how to manage IAP price ladder tests using posterior estimation, segmentation boundaries, false positive filtering, and revenue uplift modeling.

## Where Frequentist A/B Breaks Down in IAP Testing

Classic A/B testing requires fixed sample size. Since IAP purchase rates sit at 2–5%, gathering enough conversion volume for a price test takes 3–4 weeks. In whale segments (top %1 spenders), the rate drops further, stretching test duration to 6 weeks. The problem: the game meta shifts, new events launch, seasonal periods end — 6 weeks later, your data is no longer representative.

Frequentist logic also produces binary decisions: winner/loser. But IAP pricing effects aren't monotonic. Moving from $4.99 to $6.99 might drop conversion by 8% while boosting average revenue per paying user (ARPPU) by 22%, yielding +12% net revenue uplift. This tradeoff disappears from frequentist p-values; you'd need post-hoc calculation.

Bayesian approach combines prior belief (e.g., "this segment typically monetizes best at $5–7") with data to generate posterior distribution. It updates posterior from day one, delivering early signals at 500 impressions. You can stop early, cutting test duration in half while using posterior confidence intervals to design risk-aware strategies (aggressive vs. conservative).

## Prior and Likelihood Setup in Price Ladder Testing

A price ladder test looks like: current price $4.99, test variants $5.99, $6.99. You maintain separate posterior distributions for each: `P(θ | data)` — where θ = true conversion rate or expected revenue per user (ERPU).

**Prior selection:**
Beta(α, β) distribution works well for conversion rates. If you have historical data for the segment (e.g., last 90 days: %3.2 conversion, 1200 impressions), convert it to `α = conversions`, `β = non-conversions` in your prior. Without historical data, use uninformative Beta(1,1) — uniform distribution. For whale segments, informative priors are preferred since sample size will be small; priors stabilize posteriors.

**Likelihood:**
Each price variant is a Bernoulli trial. User sees IAP, purchases or doesn't. Observed data: n impressions, k conversions. Posterior update:

```
Posterior = Beta(α + k, β + n - k)
```

This updates daily as new impressions arrive. Example scenario:

| Day | Price | Impressions | Conversions | Posterior |
|-----|-------|-------------|-------------|-----------|
| 1   | $5.99 | 120         | 4           | Beta(5, 117) |
| 3   | $5.99 | 380         | 13          | Beta(14, 368) |
| 7   | $5.99 | 820         | 28          | Beta(29, 793) |

By day 7, posterior mean = 29/(29+793) = %3.53. Credible interval: [%2.4, %4.9] (95% HPD).

## Segmentation and Multi-Armed Bandit Integration

Running price ladder tests on your entire user base is inefficient. Target highest-revenue-potential segments: new whales (first IAP by D7, $20+ spend), returning spenders (2+ purchases in last 14 days), event-triggered spenders (activated by new season pass). Maintaining separate posteriors per segment increases model complexity but gains sample efficiency.

Combining MAB with Bayesian optimization enables dynamic allocation: assign more traffic to the price point with highest posterior mean (exploit), while giving minimum traffic to those with high posterior variance (explore). Thompson Sampling does this automatically by sampling from posteriors and selecting the highest:

```python
def thompson_sampling(posteriors):
    samples = [beta.rvs(p['alpha'], p['beta']) for p in posteriors]
    return np.argmax(samples)
```

This runs at each impression allocation. After 10,000 impressions, the best price point naturally captures most traffic, but others remain alive — if new data arrives, posterior updates and a prior loser can move to first.

## False Positive Filtering and Posterior Confidence Intervals

Bayesian tests have no "statistical significance," only posterior probability: `P(θ_A > θ_B | data)`. If >%95, price A beats price B. But beware: high posterior probability doesn't guarantee operational gains if effect size is tiny.

**Minimum Detectable Effect (MDE) threshold:**
Revenue uplift <5% won't justify implementation cost (app store compliance, new SKU, localization). Decision rule:

```
IF P(uplift > 5%) > 0.95 AND posterior_mean_uplift > 5%:
    DEPLOY
ELSE:
    CONTINUE or STOP
```

This dual filter controls false positives. Say $5.99's posterior mean uplift is +%3.2 but credible interval is [-%1.2, +%7.8] — too early to decide. After 2 more weeks, the interval tightens to [+%2.1, +%5.6] and mean exceeds 5%; now deploy.

**Posterior predictive check:**
Post-deployment, simulate the deployed price's performance against posterior predictive distribution. If observed revenue sits outside (e.g., below the %99th percentile), segment composition has shifted or external factors emerged (new competitor game, Apple pricing policy change). Invalidate that posterior and restart with fresh prior.

## Revenue Uplift Modeling and Operational Decision Tree

An IAP price test's final metric is segment-level ERPU (expected revenue per user) gain, not conversion rate. Model ERPU in Bayesian terms:

```
ERPU = P(conversion) × Price
Posterior ERPU = E[θ] × Price
```

Calculate posterior ERPU for each price point, pick the highest. But tradeoff exists: higher price cuts conversion, lower price cuts ARPPU. To find the optimum, test the entire price ladder simultaneously (3–4 variants) and compare posterior ERPU distributions.

**Operational decision tree:**

1. **Day 3:** Posterior variance still high? Yes → adjust traffic allocation (MAB). No → check for early winner signal.
2. **Day 7:** Is best price point's posterior probability >%90? Yes → soft launch (whale segment %10). No → continue 7 more days.
3. **Day 14:** Is posterior credible interval tight (<%3 range) and uplift >%5? Yes → full deploy. No → test inconclusive, run meta analysis.

This tree resolves tests in median 10 days (vs. 21 frequentist). Even narrow populations like whale segments get decisions by day 14 because informative priors narrow posteriors fast.

Meta analysis: if test inconclusive, micro-segment within the segment (iOS vs. Android, tier-1 vs. tier-2 geo, D7 vs. D30 age). Calculate posterior separately for each, find where signal is strongest, apply segment-specific pricing. This parallels [App Store Optimization](https://www.roibase.com.tr/ru/aso) — each segment sees different creative; here, different price.

## Long-Term Price Calibration via Rolling Posteriors

Bayesian price optimization isn't one-off testing; it's continuous calibration. New cohorts arrive monthly, meta shifts, seasonal events alter posteriors. Apply rolling posterior logic: update posterior weekly using last 60 days of data, fade old prior (exponential decay).

```python
def update_rolling_posterior(current_posterior, new_data, decay=0.95):
    alpha_new = current_posterior['alpha'] * decay + new_data['conversions']
    beta_new = current_posterior['beta'] * decay + new_data['non_conversions']
    return {'alpha': alpha_new, 'beta': beta_new}
```

This system doesn't reset posterior post-price-change; it adds new price data to the old posterior. History isn't lost; current patterns dominate.

Over time, extract price elasticity curve: plot posterior mean ERPU for each price point, fit curve, measure marginal impact per $1 increase. If curve plateaus at $6.99, don't test higher prices — instead, try bundles (2 IAPs together at 15% discount). Test this with Bayesian too, prior bundle conversion = 70% of single IAP (industry heuristic), update with posterior data.

Bayesian price optimization transforms static IAP A/B into a dynamic learning system. Posterior estimation lets you decide early even on small segments while controlling false positives and maximizing revenue uplift. On narrow populations like whales, frequentist fails; Bayesian prior + likelihood solves it. Rolling posteriors auto-update through seasonal swings or meta shifts. Result: halved test duration, better decisions, lower operational cost.