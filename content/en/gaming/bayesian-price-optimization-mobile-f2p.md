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

Mobile F2P games still run IAP price optimization using frequentist A/B logic: two price points, 14 days, p<0.05. This approach fails in small segments (VIP users, early spenders, whales)—statistical power drops, decision-making becomes guesswork. Bayesian price optimization updates posterior distributions, enabling faster decisions in constrained sample sizes while building confidence in small cohorts. This article covers how to manage IAP price ladder tests using posterior estimation, segmentation boundaries, false positive filtering, and revenue uplift modeling.

## Where Frequentist A/B Breaks Down in IAP Testing

Classical A/B testing requires fixed sample sizes. Since IAP conversion rates sit in the 2–5% band, accumulating sufficient purchase volume for a price test takes 3–4 weeks. In whale segments (top 1% spenders), conversion drops further; test duration stretches to 6 weeks. The problem: game meta shifts, new events launch, seasonal windows close—data collected 6 weeks later isn't representative anymore.

Frequentist logic also produces binary decisions: win/lose. But IAP price impact isn't monotonic. Moving from $4.99 to $6.99 might drop conversion 8% while average revenue per paying user (ARPPU) rises 22%, yielding +12% net revenue uplift. This tradeoff doesn't surface in frequentist p-values; you're forced into post-hoc analysis.

Bayesian approaches combine prior belief (e.g., "this segment monetizes best around the $5–7 band") with observed data, generating posterior distributions. Testing begins updating posteriors immediately—at 500 impressions you have interim results. Early stopping cuts test duration in half; posterior confidence intervals let you design aggressive or conservative decision strategies based on measured risk.

## Prior and Likelihood Setup for Price Ladder Tests

Price ladder testing structure: current price $4.99, test variants $5.99, $6.99. Maintain separate posterior distributions for each: `P(θ | data)`—where θ = true conversion rate or expected revenue per user (ERPU).

**Prior selection:**
Beta(α, β) distributions work well for conversion rates. If you have historical data for a segment (e.g., 3.2% conversion over 90 days, 1200 impressions), translate that into `α = conversions`, `β = non-conversions`. Without prior data, use uninformative Beta(1,1)—uniform distribution. For whale segments, informative priors are standard since sample sizes will be small; prior data stabilizes posterior estimates.

**Likelihood:**
Each price variant is a Bernoulli trial. User sees IAP, converts or doesn't. Observed data: n impressions, k conversions. Posterior update:

```
Posterior = Beta(α + k, β + n - k)
```

This formula updates daily as new impressions arrive. Example scenario:

| Day | Price | Impressions | Conversions | Posterior |
|-----|-------|-------------|-------------|-----------|
| 1   | $5.99 | 120         | 4           | Beta(5, 117) |
| 3   | $5.99 | 380         | 13          | Beta(14, 368) |
| 7   | $5.99 | 820         | 28          | Beta(29, 793) |

By day 7, posterior mean = 29/(29+793) = 3.53%. Credible interval: [2.4%, 4.9%] (95% HPD).

## Segmentation and Multi-Armed Bandit Integration

Running price ladder tests across your entire user base is inefficient. Target segments with highest revenue potential: nascent whales (D7 first IAP, $20+ spend), returning spenders (2+ purchases in last 14 days), event-triggered spenders (new season pass triggers). Maintaining separate posteriors per segment increases model complexity but gains sample efficiency.

Combine multi-armed bandit (MAB) with Bayesian optimization for dynamic allocation: allocate more traffic to price points with highest posterior mean (exploit), but allocate minimum traffic to high-variance posterior arms (explore). Thompson Sampling automates this balance by sampling from posteriors and selecting the highest:

```python
def thompson_sampling(posteriors):
    samples = [beta.rvs(p['alpha'], p['beta']) for p in posteriors]
    return np.argmax(samples)
```

This allocation function runs at every impression decision. After 10,000 impressions, the best price point naturally accumulates most traffic, but other variants don't die—if posteriors shift with new data, they can regain volume.

## False Positive Filtering and Posterior Confidence Intervals

Bayesian tests don't rely on "statistical significance"; instead use posterior probability: `P(θ_A > θ_B | data)`. If this probability exceeds 95%, price A outperforms price B. But caution: high posterior probability doesn't guarantee operational gain if effect size is small.

**Minimum Detectable Effect (MDE) threshold:**
Revenue uplift under 5% means implementation costs (app store compliance, new SKU setup, localization) exceed gain. Decision rule should be:

```
IF P(uplift > 5%) > 0.95 AND posterior_mean_uplift > 5%:
    DEPLOY
ELSE:
    CONTINUE or STOP
```

This dual filter controls false positives. Example: $5.99's posterior mean uplift is +3.2% but credible interval spans [−1.2%, +7.8%]—too early to decide. Collect 2 more weeks; interval narrows to [+2.1%, +5.6%] with mean >5%—now deploy.

**Posterior predictive check:**
After deployment, simulate the chosen price's performance using posterior predictive distribution. If observed revenue falls outside this distribution (e.g., below 99th percentile), segment composition shifted or external factors intervened (new competitor game launched, Apple pricing policy changed). Invalidate posterior, restart with new prior.

## Revenue Uplift Modeling and Operational Decision Tree

An IAP price test's true metric isn't conversion—it's segment-level ERPU (expected revenue per user) increase. Model ERPU within Bayesian framework:

```
ERPU = P(conversion) × Price
Posterior ERPU = E[θ] × Price
```

Calculate posterior ERPU per price point, select the highest. But tradeoffs exist: higher price cuts conversion; lower price cuts ARPPU. Find the optimum by testing the entire price ladder simultaneously (3–4 variants), comparing posterior ERPU distributions.

**Operational decision tree:**

1. **Day 3:** Is posterior variance still high? Yes → adjust MAB allocation. No → check for early winner signal.
2. **Day 7:** Does best price point have >90% posterior probability? Yes → soft launch (10% whale segment). No → continue 7 days.
3. **Day 14:** Is posterior credible interval narrow (<3% range) and uplift >5%? Yes → full deploy. No → test inconclusive; run meta-analysis.

This tree reaches median decision by day 10 (vs. 21 for frequentist). Even narrow populations like whales yield decisions by day 14 because informative priors narrow posteriors quickly.

Meta-analysis: if test is inconclusive, micro-segment (iOS vs Android, tier-1 vs tier-2 geo, D7 vs D30 cohort age). Calculate posteriors separately per segment, identify where signal is strongest, apply segment-specific price. This parallels [App Store Optimization](https://www.roibase.com.tr/en/aso) logic: each segment sees different creatives; here each sees different pricing.

## Long-Term Price Calibration via Rolling Posterior

Bayesian price optimization isn't one-off testing—it's continuous calibration. New cohorts arrive monthly, meta shifts, seasonal events alter posteriors. Implement rolling posterior logic: update posterior weekly using last 60 days of data, fade old prior with exponential decay.

```python
def update_rolling_posterior(current_posterior, new_data, decay=0.95):
    alpha_new = current_posterior['alpha'] * decay + new_data['conversions']
    beta_new = current_posterior['beta'] * decay + new_data['non_conversions']
    return {'alpha': alpha_new, 'beta': beta_new}
```

This system doesn't reset posteriors after price changes; it appends new price data to the existing posterior. Past information isn't lost, but current patterns dominate.

Long-term, extract price elasticity curves: plot posterior mean ERPU per price point, fit a curve, observe marginal impact of each $1 increase. If the curve plateaus at $6.99, don't test higher—try bundling instead (2 IAPs together at 15% discount). This strategy also tests Bayesian-style, with prior bundle conversion estimated at 70% of single-IAP rates (industry heuristic), updated via posterior.

Bayesian price optimization transforms static A/B tests into dynamic learning systems. Posterior estimation enables early decisions in tiny segments while controlling false positives and maximizing revenue uplift. For whale segments and event-triggered spenders—populations too narrow for frequentist methods—Bayesian priors and likelihood structures solve the power problem. Rolling posteriors continuously calibrate pricing; seasonal shifts or meta changes automatically flow into updates. Result: test duration halves, decision quality rises, operational costs drop.