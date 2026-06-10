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

Mobile F2P games still run IAP price optimization through frequentist A/B logic: two price points, 14 days, wait for p<0.05. This approach loses statistical power in small segments (VIP users, whales), kills the chance to decide early. Bayesian price optimization updates a posterior distribution, enabling both faster decisions and confidence in small samples. This article explains how to manage IAP price ladder tests with posterior estimation, handle segmentation boundaries, filter false positives, and model revenue uplift.

## Where Frequentist A/B Breaks in IAP Testing

Classical A/B testing requires fixed sample size. Because IAP purchase rates land in the 2–5% range, gathering enough conversion volume for a price test takes 3–4 weeks. In the whale segment (top 1% spenders), the rate drops further, pushing test duration to 6 weeks. The problem: the game's meta shifts, new events launch, seasonal windows close — after 6 weeks, your data is no longer representative.

Frequentist logic also produces binary verdicts: won or lost. But IAP price effects aren't monotonic. Raising from $4.99 to $6.99 might drop conversion by 8%, yet average revenue per paying user (ARPPU) rises 22%, netting +12% revenue uplift. That tradeoff vanishes in frequentist p-values; you need post-hoc math to surface it.

Bayesian approach blends prior belief (e.g., "this segment monetizes best in the $5–7 band") with data to produce a posterior distribution. Posterior updates start on day one, yielding interim results at 500 impressions. Because you can stop early, test duration halves; posterior credible intervals let you quantify risk, so you can engineer aggressive or conservative decision rules.

## Prior and Likelihood Setup in Price Ladder Tests

A price ladder test looks like this: current price $4.99, test variants $5.99, $6.99. Maintain a separate posterior distribution for each: `P(θ | data)` — where θ = true conversion rate or expected revenue per user (ERPU).

**Prior selection:**
Beta(α, β) distribution works well for conversion rates. If you have historical data for the segment (e.g., 3.2% conversion over 90 days, 1200 impressions), convert that to `α = conversions`, `β = non-conversions` for the prior. If no history exists, use uninformative Beta(1,1) — uniform. For whale segments, informative priors are standard because sample sizes will be tight; the prior stabilizes the posterior.

**Likelihood:**
Each price variant runs Bernoulli trials. User sees IAP, buys or doesn't. Observed data: n impressions, k conversions. Posterior update:

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

Running a price ladder test on all users at once is wasteful. Target high revenue potential segments: new whales (D7 first IAP, $20+ spend), returning spenders (2+ purchases in last 14 days), event-triggered spenders (season pass release). Maintaining separate posteriors per segment adds model complexity but gains sample efficiency.

Merge multi-armed bandit (MAB) with Bayesian optimization for dynamic allocation: allocate more traffic to price points with highest posterior mean (exploit), but reserve minimum traffic for high-variance posteriors (explore). Thompson Sampling automates this by sampling from each posterior and picking the winner:

```python
def thompson_sampling(posteriors):
    samples = [beta.rvs(p['alpha'], p['beta']) for p in posteriors]
    return np.argmax(samples)
```

This runs at every impression allocation. After 10,000 impressions, the best price point naturally captures most traffic, but losers aren't dead — if posterior shifts, a challenger can emerge.

## False Positive Filtering and Posterior Credible Intervals

Bayesian tests drop "statistical significance"; posterior probability takes its place: `P(θ_A > θ_B | data)`. If that probability >95%, price A beats B. But watch: high posterior probability with tiny effect size yields no operational gain.

**Minimum Detectable Effect (MDE) threshold:**
Sub-5% revenue uplift doesn't justify implementation cost (app store compliance, new SKU, localization). So decision rule becomes:

```
IF P(uplift > 5%) > 0.95 AND posterior_mean_uplift > 5%:
    DEPLOY
ELSE:
    CONTINUE or STOP
```

This dual filter controls false positives. Example: $5.99 has posterior mean uplift +3.2% but credible interval [–1.2%, +7.8%] — too early to call. Collect 2 more weeks; if 95% HPD narrows to [+2.1%, +5.6%] and mean >5%, deploy.

**Posterior predictive check:**
After deployment, simulate the price's real performance via posterior predictive distribution. If observed revenue lands outside the distribution (e.g., below the 99th percentile), segment composition shifted or external factors kicked in (new competitor, Apple pricing change). Invalidate the posterior, restart with fresh prior.

## Revenue Uplift Modeling and Operational Decision Tree

The test's true north is segment-level ERPU, not conversion rate. Model ERPU within Bayesian framework:

```
ERPU = P(conversion) × Price
Posterior ERPU = E[θ] × Price
```

Calculate posterior ERPU for each price point; pick the highest. Tradeoff exists: higher price drops conversion, lower price tanks ARPPU. To find the sweet spot, test the entire ladder (3–4 variants) simultaneously, compare posterior ERPU distributions.

**Operational decision tree:**

1. **Day 3:** Posterior variance still high? Yes → adjust traffic allocation (MAB). No → check for early winner signal.
2. **Day 7:** Best price point's posterior probability >90%? Yes → soft launch (whale segment 10%). No → run 7 more days.
3. **Day 14:** Posterior credible interval narrow (<3% range) and uplift >5%? Yes → full deploy. No → test inconclusive; run meta analysis.

This tree closes tests in ~10 days median (frequentist: 21 days). Even narrow populations like whales reach decisions by day 14 because informative priors shrink posteriors fast.

Meta analysis: if test stalls, micro-segment (iOS vs Android, tier-1 vs tier-2 geo, D7 vs D30 age). Calculate posterior per micro-segment, find where signal is strongest, apply custom price there. This parallels [App Store Optimization](https://www.roibase.com.tr/de/aso) logic: each segment sees different creative; here it sees different price.

## Long-Term Price Calibration via Rolling Posterior

Bayesian optimization isn't a one-off test; it's continuous calibration. Each month brings new cohorts, meta shifts, seasonal events reshape posteriors. Use rolling posterior logic: update posterior every week using last 60 days, fade out old priors (exponential decay).

```python
def update_rolling_posterior(current_posterior, new_data, decay=0.95):
    alpha_new = current_posterior['alpha'] * decay + new_data['conversions']
    beta_new = current_posterior['beta'] * decay + new_data['non_conversions']
    return {'alpha': alpha_new, 'beta': beta_new}
```

Post-deploy, rolling posterior doesn't reset; new price data feeds into the prior. Old knowledge doesn't vanish, but current patterns dominate.

Over time, extract price elasticity curve: plot posterior mean ERPU per price point, fit a curve, read the marginal effect of each $1 increase. If the curve plateaus at $6.99, don't test higher — pivot to bundles (2 IAPs at 15% discount). Test bundles Bayesian too; prior bundle conversion = 70% of single IAP (industry heuristic), update with data.

Bayesian price optimization transforms static A/B testing into dynamic learning. Posterior estimation enables early decisions in narrow segments while controlling false positives and maximizing revenue uplift. In whale and event-triggered cohorts where frequentist breaks, Bayesian prior + likelihood solves it. Rolling posterior auto-tunes to seasonal shifts or meta changes. Result: half the test time, sharper decisions, lower operational cost.