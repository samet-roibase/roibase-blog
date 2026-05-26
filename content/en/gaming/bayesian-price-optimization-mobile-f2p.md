---
title: "Bayesian Price Optimization in Mobile F2P"
description: "Segmented IAP pricing via posterior estimation: probabilistic modeling for conversion, revenue, and LTV balance in F2P monetization testing."
publishedAt: 2026-05-26
modifiedAt: 2026-05-26
category: gaming
i18nKey: gaming-002-2026-05
tags: [f2p-monetization, bayesian-testing, iap-optimization, price-ladder, mobile-gaming]
readingTime: 8
author: Roibase
---

F2P mobile games still price IAP by intuition: copy the $0.99, $4.99, $9.99 ladder, lower price if conversion dips, add "more value" if it rises. Yet the same $4.99 pack might show 2.1% conversion in organic users, 1.4% in UA cohorts, and 8.7% in D30+ whales. Classical A/B testing breaks down here: sample sizes explode, wait times hit 6 weeks, or you're stuck choosing between revenue and conversion without clarity. Bayesian price optimization solves all three simultaneously: posterior distributions capture early signals, segment-level LTV effects are modeled explicitly, and revenue-conversion tradeoffs are managed within a probabilistic framework.

## The Frequentist A/B Testing Bottleneck in IAP Pricing

Standard A/B tests calculate sample size based on baseline conversion and desired relative lift. A 2% baseline, 10% relative lift goal, and 80% power require ~15,000 exposures. For mid-tier IAP, that's 4–6 weeks. As test duration stretches:

- Meta campaign CPIs rise (creative fatigue)
- Organic cohort mix drifts (holiday effects, ASO rank changes)
- Competitor launches new events, demand elasticity breaks

More critically, the revenue-conversion split: moving from $2.99 to $4.99 drops conversion from 2.1% to 1.7% but lifts revenue per mille by 42%. Which metric gets the p-value? Most studios say "we gained revenue" and move on. But D7 LTV modeling reveals the whale segment churns 31% harder under the new price, hurting retention.

Bayesian methods keep conversion and revenue in the same posterior model: prior belief (beta distribution from past tests) + observations (new data) → posterior (updated belief). By day 3, the model says "73% likely $4.99 is better." By day 7, that rises to 89%. By day 10, regret drops below 1% and you stop the test.

## Building a Prior: Historical IAP Data Over Industry Benchmarks

A Bayesian test's quality depends on a well-specified prior. Most tutorials say "use a uniform prior, let the data speak," but if you have 6 months of IAP history in mobile F2P, ignoring that is wasteful. Example prior-building workflow:

**Step 1:** Extract all IAP tier conversion rates from the past 6 months. $0.99–$2.99 conversions cluster between 1.8%–3.2%, median 2.4%. Beta distribution parameters alpha=24, beta=976 reflect this empirically (mean = alpha/(alpha+beta) ≈ 0.024).

**Step 2:** Add segment-level variance. Organic cohorts show 18% higher conversion than UA cohorts historically (alpha=28, beta=972). Whale segment (D30+ payers) has separate priors: ~6.8% conversion yields alpha=68, beta=932.

**Step 3:** Encode price elasticity. Past data shows $1.99 → $2.99 cuts conversion by ~14%. If your new test moves $2.99 → $3.99, bake that slope into the prior:

```python
def price_elasticity_prior(base_price, new_price, base_conversion):
    slope = -0.14 / 1.00  # $1 increase → 14% drop
    delta = new_price - base_price
    expected_drop = slope * delta
    adjusted_conversion = base_conversion * (1 + expected_drop)
    alpha = adjusted_conversion * 1000
    beta = 1000 - alpha
    return alpha, beta
```

This grounds the prior in your game's cohort behavior, not external "industry 2.5%" claims.

## Posterior Estimation and Segmented Price Ladders

Test design: starter pack $2.99 vs $3.99, 7-day run across UA traffic, 50/50 split. Crucially, split by segment:

| Segment | Prior α | Prior β | Target N |
|---------|---------|---------|----------|
| D0–D7 organic | 28 | 972 | 4000 |
| D0–D7 UA | 22 | 978 | 6000 |
| D7+ non-payer | 18 | 982 | 3000 |
| D7+ past buyer | 68 | 932 | 2000 |

Posterior updates separately per segment. By day 3:

**Organic segment:** $2.99 yields 87 conversions / 2100 exposures; $3.99 yields 71 / 2050. Posterior: α₁=28+87=115, β₁=972+2013=2985 vs α₂=28+71=99, β₂=972+1979=2951. Monte Carlo sampling (10,000 draws) gives P($2.99 better) = 78%. Revenue-wise: $2.99 × 87 = $260, $3.99 × 71 = $283. Revenue posteriors (modeled as gamma) give P($3.99 revenue superior) = 61%.

Decision point: if organic segment prioritizes conversion, keep $2.99; if revenue-focused, wait 2 more days. UA segment shows $3.99 clearly winning (83% posterior probability), so terminate that variant early and shift traffic to $3.99.

**Dynamic price ladder per segment:** Once test concludes, your IAP inventory becomes:

- Organic D0–D3: $2.99 starter
- UA D0–D3: $3.99 starter
- D7+ past buyer: $7.99 booster (from separate posterior)
- Whale (D30+, $50+ LTV): $14.99 premium bundle

This approach optimizes four elasticity curves instead of one global price. Combined with [App Store Optimization](https://www.roibase.com.tr/en/aso) custom product pages, IAP personalization deepens: creative value props align with tier.

## Thompson Sampling for Multi-Armed Bandit Extension

Rather than a fixed 7-day test, Thompson sampling dynamically optimizes during the test window. On each impression, sample from each variant's posterior, show the price with highest expected value. Exploration/exploitation balance updates automatically.

Pseudo-code:

```python
def thompson_sampling_price(segment, price_variants):
    posteriors = {p: get_posterior(segment, p) for p in price_variants}
    samples = {p: np.random.beta(post['alpha'], post['beta']) 
               for p, post in posteriors.items()}
    revenue_samples = {p: s * p for p, s in samples.items()}
    return max(revenue_samples, key=revenue_samples.get)
```

This is especially powerful for 3+ variants: classical A/B with three prices requires 3× sample size, while Thompson sampling automatically zeros out weak variants via posterior updates. By day 10, if $2.99's posterior drops to 9%, its allocation shrinks to 5%—no sample waste.

Caveat: if UA supply is finite (say, $5K daily Meta budget), Thompson risks picking conversion-poor variants, inflating CPA and burning budget by noon. Safe implementation: run 50/50 split for 3 days, then enable Thompson once posterior credibility exceeds 80%.

## Revenue vs LTV: Merging Posteriors with Retention Modeling

The final layer: LTV projection. $3.99 shows lower conversion but 8% higher D7 retention—its 90-day LTV might exceed $2.99's. Classical A/B never sees this (LTV finalizes at 90 days), but Bayesian posteriors + survival models catch early signals.

Setup: For each variant, fit a Cox proportional hazards model over the first 7 days:

```python
from lifelines import CoxPHFitter

df['price_variant'] = df['variant'].map({'2.99': 0, '3.99': 1})
cph = CoxPHFitter()
cph.fit(df, duration_col='days_retained', event_col='churned', 
        formula='price_variant + segment + paid_d3')
```

Output: $3.99 has hazard ratio 0.88 (12% lower churn, p=0.03). Blend into posterior:

**LTV posterior:**
- $2.99: E[conversion]=0.024, E[D90 retention]=0.34, ARPDAU=$0.12 → LTV = $2.99 × 0.024 + 90 × 0.34 × 0.12 = $3.74
- $3.99: E[conversion]=0.019, E[D90 retention]=0.38, ARPDAU=$0.15 → LTV = $3.99 × 0.019 + 90 × 0.38 × 0.15 = $5.21

Monte Carlo across 10,000 iterations: P($3.99 LTV superior) = 91%. This posterior credibility is far stronger than revenue-only analysis. Decision: select $3.99, rebalance IAP stack.

## Tradeoff: Model Complexity vs Execution Speed

Bayesian IAP optimization carries three operational costs:

**1. Prior maintenance:** New events, meta shifts, competitor launches shift prior distributions. Re-calibration every 6 months is mandatory. Small studios without data scientists can't sustain this.

**2. Segment granularity:** 8 segments × 3 prices = 24 posteriors to track. Small segments (e.g., whales) have high posterior variance; confidence intervals stay wide. Practical fix: segment whales separately, run classical A/B there, apply Bayesian to others.

**3. Platform fragmentation:** iOS vs Android price sensitivity differs. App Store shows 23% higher $2.99 conversion than Android (per App Annie 2025 data). Maintain separate posteriors per platform or pool them? Separate increases sample fragmentation; pooled introduces platform bias. Solution: hierarchical Bayesian model with platform as random effect.

Still, Bayesian beats waiting 4+ weeks for A/B. Tests terminate in 10 days, revenue impact appears week 2, LTV projection updates by day 30. Frequentist timelines stretch 8–12 weeks.

## Conclusion: Probabilistic Pricing Mindset

Mobile F2P pricing is no longer binary but continuous posterior updating. Instead of solving conversion and revenue with separate p-values, model both probabilistically, minimize regret, shorten test windows, and enable segment-level optimization. Bayesian methods require prior-building discipline but unlock early stopping, LTV integration, and Thompson sampling for dynamic allocation. If your IAP stack exceeds 5 tiers and monthly UA spend surpasses $100K, Bayesian test infrastructure is no longer optional—it's essential.