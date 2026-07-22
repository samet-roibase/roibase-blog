---
title: "Bayesian Price Optimization in Mobile F2P"
description: "Optimize IAP price ladder tests using posterior estimation and segment-based modeling. Data-driven pricing strategy for mobile games."
publishedAt: 2026-07-22
modifiedAt: 2026-07-22
category: gaming
i18nKey: gaming-002-2026-07
tags: [f2p-monetization, bayesian-optimization, iap-pricing, mobile-gaming, data-driven-pricing]
readingTime: 8
author: Roibase
---

In mobile F2P games, pricing decisions typically rely on guesswork or "common market rates." The $0.99 starter pack, $4.99 mid-tier, $99.99 whale bundle—this price ladder is static across most titles. Yet every game has a different cohort structure, geo mix, and value perception. Bayesian price optimization models these differences through posterior probability distributions, finding the optimal price point for each segment. Instead of a one-off A/B test, building a continuously learning system can improve your IAP conversion rate by 15-40%.

## Why Bayesian approach outperforms A/B testing

Classical A/B testing operates on a fixed hypothesis: compare $4.99 vs $5.99, wait until 95% confidence is reached, pick the winner. This has two problems. First, during the test, traffic is split in half and the worse-performing variant continues to be served to users (opportunity cost). Second, once testing ends, you only get an "A or B" decision—you learn nothing about intermediate values or segment-specific differences.

Bayesian optimization starts with a prior distribution (e.g., "price could be uniform between $3-$7"), then updates the posterior with each conversion event, continuously refining the probability distribution. Through algorithms like Thompson Sampling, traffic dynamically shifts toward the winning variant—maximizing total revenue during the test period. Over a 10-day test, Bayesian approaches generate 8-12% more revenue than classical methods because poor price points receive minimal traffic. Plus, the Bayesian model gives you not just "which price won," but "this price has 87% probability of being optimal"—enabling faster iteration. You can go live at 60% confidence and launch a new test, since the posterior already carries sufficient information.

## Segment-based prior construction for IAP price ladder testing

Not all F2P users are equal. Properly segmenting your spender cohorts strengthens the Bayesian model's prior. Typical segmentation: **minnows** (lifetime spend <$10), **dolphins** ($10-$100), **whales** (>$100). Each segment has different price elasticity—minnows convert on $0.99 packs, whales buy $99.99 bundles indifferent to price.

Build segment-specific priors from historical data. For example, if minnows average 3.2% conversion rate on $0.99-$1.99 IAPs, use a prior mean of $1.49 and sigma $0.50 (normal distribution assumption). For whales, if conversion flattens across $49.99-$149.99, use a uniform prior—modeling the hypothesis that "whales are price-insensitive."

The advantage of segment-based priors: preventing cross-segment learning contamination. Classical A/B testing pools all users, and whales' high conversion on low-price variants can mask minnows' optimal price. Bayesian models maintain separate posteriors per segment, yielding segment-optimal prices like $1.49 for minnows, $79.99 for whales.

### Geo-specific prior adjustment

Purchasing power parity differs dramatically between Tier-1 (US, UK, JP) and emerging markets (BR, TR, IN). $4.99 feels "cheap" in the US but represents mid-upper spending in Turkey. Normalize priors by local ARPU. If US average daily IAP is $0.42 and Turkey's is $0.18, scale the prior mean by that ratio (0.18/0.42 = 43%). This way, the model tests the same relative price ladder per geo, embedding absolute value differences into the prior.

## Posterior estimation and Thompson Sampling implementation

The Bayesian model's runtime engine is posterior estimation. At each IAP impression, you sample from the current posterior distribution (e.g., `np.random.beta(alpha, beta)` for Beta distributions). Show the price corresponding to that sample. If the user converts, increment alpha by 1; if they skip, increment beta by 1—posterior updates.

Thompson Sampling applies this to traffic allocation. For each variant, draw a reward expectation from its posterior, select the highest. Early days see equal traffic across variants (exploration), then traffic shifts to the winner (exploitation). Balance emerges not from epsilon, but from posterior variance—lower-variance (higher-confidence) variants accumulate more traffic.

For practical implementation, use Python `scipy.stats.beta` or `pymc3`. Here's a basic code snippet:

```python
import numpy as np
from scipy.stats import beta

# Prior: alpha=1, beta=1 (uniform)
alpha_a, beta_a = 1, 1  # Variant A ($4.99)
alpha_b, beta_b = 1, 1  # Variant B ($5.99)

def select_variant():
    sample_a = np.random.beta(alpha_a, beta_a)
    sample_b = np.random.beta(alpha_b, beta_b)
    return "A" if sample_a > sample_b else "B"

def update_posterior(variant, converted):
    global alpha_a, beta_a, alpha_b, beta_b
    if variant == "A":
        if converted:
            alpha_a += 1
        else:
            beta_a += 1
    else:
        if converted:
            alpha_b += 1
        else:
            beta_b += 1
```

This simple loop converges the posterior mean to true conversion rate within 2% error after 10,000 impressions (assuming Beta prior holds). In production, use BigQuery + Airflow to update posterior parameters daily, starting new cohorts with current distributions.

## Multi-armed bandit vs full Bayesian model

Bayesian pricing literature presents two main approaches: **multi-armed bandit (MAB)** and **full Bayesian regression**. MAB—Thompson Sampling as described above—treats discrete price points (e.g., 5 price tiers) as arms, maintaining separate posteriors per arm. Advantage: simple implementation, lightweight runtime, real-time decisions. 

Full Bayesian regression models price as a continuous variable, linking conversion probability to price via logistic regression or Gaussian processes. More flexible—e.g., learning non-linear relationships like "conversion rate decays exponentially with price." Drawback: requires BigQuery + Python training, can't make real-time decisions (batch prediction only).

For F2P games, MAB usually suffices because price ladders are already discrete ($0.99, $2.99, $4.99, $9.99). Full Bayesian enters when doing dynamic pricing (different price per user)—though most app store policies prohibit this. Middle ground: segment-level MAB plus full Bayesian within each segment, enabling continuous optimization of whale-tier bundles ($79.99-$149.99) while keeping minnow tiers discrete.

## Revenue uplift and cohort LTV impact

Bayesian optimization's true ROI shows up in cohort LTV. Test week-one conversion lifts 8%, but those users' D30 LTV runs 15-20% higher. Why? Optimal pricing matches the user's value perception—not too low (perceived value drops), not too high (friction spikes). These users show higher second-purchase likelihood.

Example: a mid-core RPG moved from $4.99 starter pack to Bayesian-recommended $3.49 (minnow segment, US geo). Week-one conversion jumped from 22% to 28% (+27% relative). D7 retention held at 42%, but D30 ARPU climbed from $2.18 to $2.51 (+15%). Why? The $3.49 price lowered the "I'll invest in this game" barrier, reducing second-purchase friction. Cohort LTV went from $8.90 to $10.20 (+15%).

Measure this via cohort analysis in BigQuery. Track `user_id`, `install_date`, `first_iap_price`, `d7_revenue`, `d30_revenue`. Flag Bayesian test variants with `experiment_group`, compare LTV curves to control. Significance testing is premature at D7; confidence grows by D30.

## Common misconceptions and tradeoffs

"Bayesian immediately wins" is false. Posterior convergence requires 5,000-10,000 impressions minimum per segment. Low-traffic games (DAU <50k) extend test duration to 4-6 weeks. During this time, your data pipeline (impression logging, conversion tracking, posterior update) must be rock-solid—a single bug corrupts the entire posterior.

Second tradeoff: segment granularity. Too-fine segments (e.g., "L5-10 spend, US, Android, whale") cause sample-size starvation and high-variance posteriors. Rule of thumb: each segment needs ≥200 IAP impressions daily. Below that, merge segments (US+UK+CA becomes single "Tier-1 EN").

Third: price-change psychology. If users saw $4.99 yesterday and $3.99 today, they perceive "discount" and conversion spikes—unsustainably. Keep price range narrow during testing (±20% max); avoid radical swings like $4.99 → $1.99.

## Post-test scale and automation

Bayesian optimization isn't a one-off test; it's continuous learning. After testing, deploy the winning price, but save the posterior distribution to use as prior for new cohorts. Q4 holiday season ARPU spikes 30%—previous quarter's posterior becomes the new prior, enabling fast convergence (warm start vs. cold start).

Automate via Airflow + BigQuery + Firebase Remote Config. Daily, an Airflow DAG reads posterior parameters from BigQuery, writes new price variants to Firebase Remote Config. Client SDK fetches Remote Config, shows the IAP offer. Conversion events log to BigQuery, posterior updates—loop closes. Initial setup takes 2-3 weeks; afterwards, zero-touch operation.

Final step: scaling to multiple games? Build a central "pricing service." Each game submits metadata (genre, geo mix, ARPU); the service recommends priors based on the game's profile. New titles avoid cold start, leveraging transfer learning from similar games' posteriors. Roibase's [App Store Optimization](https://www.roibase.com.tr/en/aso) service combines such cross-app learning pipelines with ASO creative testing—the same Bayesian framework applies to product page variants.

---

Bayesian price optimization is foundational to F2P revenue engineering. With proper segment priors, continuous posterior updates, and Thompson Sampling, you'll lift IAP conversion by 15-40% and visibly increase cohort LTV. A learning system beats one-off A/B tests—each new cohort starts more optimized than the last, creating compounding returns. Start by splitting your current price ladder into 3-5 variants, build priors from historical conversion rates, and watch the posterior converge over the first 10,000 impressions.