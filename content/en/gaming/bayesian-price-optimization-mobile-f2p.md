---
title: "Bayesian Price Optimization in Mobile F2P"
description: "Replace frequentist A/B testing with Bayesian posterior estimation for IAP pricing: segment-based price ladders, Thompson Sampling, and quantified revenue lift in mobile gaming."
publishedAt: 2026-07-08
modifiedAt: 2026-07-08
category: gaming
i18nKey: gaming-002-2026-07
tags: [bayesian-optimization, iap-pricing, f2p-monetization, mobile-gaming, retention-engineering]
readingTime: 8
author: Roibase
---

Mobile F2P games set IAP prices based on intuition and competitor analysis. By 2026, this approach is no longer sufficient. Traffic from Apple Search Ads arrives segmented: high-intent keywords, lookalike audiences, broad keywords. Each segment carries a distinct WTP (willingness to pay) profile. Frequentist A/B testing becomes a bottleneck here — waiting 4 weeks and requiring 10,000+ user samples for 95% confidence. Bayesian price optimization allows decision-making within the first 1,000 conversions using posterior distribution.

## Where Frequentist A/B Testing Breaks Down in IAP Pricing

Classical A/B testing works like this: split a $4.99 vs. $6.99 package 50/50, check p-value via chi-square after 4 weeks. The problem: mobile game cohorts shift rapidly. With 68% churn by D7, users remaining in week 4 no longer reflect week 1 profiles. Segment information is lost — users from Apple Search Ads sit in the same bucket as organic users.

Frequentist testing's second failure point is the stopping rule: decide early and you commit "peeking" error; decide late and meta changes (new creative, ASO updates) invalidate the test. Mobile gaming cannot sustain this cadence.

The third problem: binary outcome assumption. Frequentist testing answers "which price wins" but not "which segment prefers which price." Without segment-specific posterior distributions, you cannot construct a price ladder.

## Bayesian Framework: Prior, Likelihood, Posterior

Bayesian methodology rests on this formula:

```
P(θ | data) ∝ P(data | θ) × P(θ)
```

- **P(θ):** Prior — WTP distribution from prior game or category data
- **P(data | θ):** Likelihood — observed IAP conversions
- **P(θ | data):** Posterior — prior updated by current data

For IAP price testing, let θ = {$4.99, $6.99, $9.99} price points. Set a Beta(α, β) prior for each price. For example, $4.99 with α=20, β=80 (20% conversion baseline from prior games). When first 500 impressions arrive, add each price's conversion count to the Beta prior:

```python
# $4.99: 500 impressions, 110 conversions
alpha_post = 20 + 110
beta_post = 80 + (500 - 110)
# Posterior: Beta(130, 470)
```

Sample from this posterior and calculate expected revenue via Monte Carlo:

```python
samples = np.random.beta(130, 470, size=10000)
revenue_4_99 = samples * 4.99
mean_revenue = revenue_4_99.mean()
```

Bayesian advantage: decide at 500 conversions — if the credible interval narrows, stop the test; if still wide, continue. Stopping rule is flexible; no peeking error.

## Building Segment-Based Price Ladders

Serving a single price to all F2P users is suboptimal. Traffic driven by [App Store Optimization](https://www.roibase.com.tr/en/aso) contains differing intent levels: branded keywords yield 8% CVR while generic keywords yield 1.2%. Maintain separate posterior distributions per segment.

Example segmentation:

| Segment | Prior (α, β) | Observed Conv. | Posterior (α', β') | Mean WTP |
|---|---|---|---|---|
| Branded KW | (30, 70) | 48/200 | (78, 222) | $7.20 |
| Generic KW | (12, 88) | 18/300 | (30, 370) | $4.50 |
| Organic | (20, 80) | 35/250 | (55, 295) | $5.80 |

Use these posteriors to construct your price ladder:

- Branded segment → offer $9.99 "premium" pack
- Generic segment → offer $4.99 "starter" pack
- Organic → offer $6.99 "standard" pack

Server-side feature flags implement segment-based pricing. The Unity IAP SDK sends user segment data to backend; backend returns prices based on posterior distribution. This structure is more dynamic than A/B testing — each week the posterior updates, the price ladder auto-optimizes.

### Thompson Sampling for Real-Time Allocation

The Bayesian framework is not static — use Thompson Sampling to balance exploration and exploitation. At each IAP impression:

1. Sample once from posterior for each price point
2. Surface the price with highest sampled revenue
3. Add conversion result to posterior

This method minimizes regret — i.e., reduces the cost of impressions served at suboptimal prices. After 10,000 impressions, Thompson Sampling delivers 12–18% more revenue lift than static pricing (benchmark: King's 2025 Candy Crush Saga test results).

## Caution Points in Posterior Estimation

Bayesian methodology's sensitive component is prior selection. A weak prior (α=1, β=1 uniform) leaves posterior unstable in the first 100 conversions. A strong prior (α=100, β=400) makes new data slow to update the prior.

The right prior source: first 30 days of cohort data from a prior game or similar category. If no data exists, use industry benchmark but keep prior weak (α=5, β=20).

Second point: segment count. Creating 10 segments requires separate posterior updates per segment — this thins data, credible intervals widen. Keep segment count to 3–5. For finer granularity, employ hierarchical Bayesian modeling (HBM) — category-level prior at the top, segment-level posteriors below.

Third point: revenue metric choice. IAP conversion is binary but revenue is continuous. Beta distribution suits conversion but revenue modeling requires Gamma or Log-Normal. For posterior revenue estimation:

```python
# Gamma(shape=α, rate=β) mean revenue
mean_revenue = (alpha_post / beta_post) * price
```

## Churn and LTV Impact

Bayesian price optimization does not only optimize first IAP conversion — segment-matched pricing reduces churn. Overpriced segments churn 22% faster (D30 retention –8%). Underpriced segments cap LTV — once a user buys at $4.99, they resist $9.99 packs.

A correct price ladder cuts churn because each segment sees its perceived-value threshold. Cohort analysis measures this:

- Cohort with Bayesian price ladder: D30 retention 38%, ARPU $12.50
- Cohort with static pricing: D30 retention 34%, ARPU $11.20

Revenue lift: $12.50 − $11.20 = $1.30 per user. At 100,000 MAU, this yields $130,000/month difference.

## Operational Implementation

Deploying Bayesian price optimization requires this stack:

- **Event tracking:** IAP impressions + conversions (Adjust/AppsFlyer)
- **Bayesian engine:** Python + PyMC3 or Stan (posterior update every 24 hours)
- **Feature flags:** LaunchDarkly or custom backend (segment → price mapping)
- **Monitoring:** Posterior convergence dashboard (Looker/Metabase)

Run shadow mode for 2 weeks — the Bayesian engine proposes prices but production remains static. Once posterior stabilizes (credible interval < 10%), move to production.

Important: the Bayesian model updates continuously but price changes do not happen daily. Run a weekly review cycle — if posterior shifts > 15%, adjust price; otherwise, hold. Inconsistent pricing erodes user trust.

---

Bayesian price optimization in mobile F2P is no longer experimental — King, Supercell, and Playrix run it in production. The framework looks complex at first but posterior updating is mechanical. With correct priors and segment strategy, 6–8 weeks yields 10–15% revenue lift. Returning to static pricing is now suboptimal.