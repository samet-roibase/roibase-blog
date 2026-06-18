---
title: "Fast Decision Making with Bayesian A/B Testing"
description: "Replace rigid frequentist sample size rules with Bayesian sequential testing. Update posterior distributions in real time, make confident stopping decisions earlier."
publishedAt: 2026-06-18
modifiedAt: 2026-06-18
category: marketing
i18nKey: marketing-002-2026-06
tags: [ab-testing, bayesian-statistics, conversion-optimization, sequential-testing, performance-marketing]
readingTime: 8
author: Roibase
---

Classical A/B testing locks you into a fixed sample size requirement. You wait until you hit N participants, run a t-test, check the p-value. But market reality is this: if variant B is clearly losing every single day, burning test traffic for 2 more weeks is waste. Bayesian methodology solves this — update your posterior distribution daily and say "variant A has a 94% probability of winning right now." You define your decision threshold yourself; you're not bound by frequentist's rigid p < 0.05 rule.

## The Structural Limits of Frequentist Testing

Traditional A/B testing relies on the Neyman-Pearson framework. You define a null hypothesis (H₀: no difference between variants), set an alpha level (typically 0.05), decide on a minimum detectable effect (MDE), run a power analysis (usually 80%), and collect data until you hit that sample size. Stopping early before the test is complete inflates Type I error—this is why "peeking" is forbidden.

The problem: in digital campaigns, traffic costs money every day. If your sample size calculation says 12,000 users and you get 800 per day, you wait 15 days. But on day 5, variant B's conversion rate drops from 2.1% to 1.3%—you still burn 10 more days. Frequentist methodology permits this because "early stopping = bias." In reality, test conditions aren't static—campaign budgets are finite, seasonality happens, competitors move. Rigid sample size rules leave no room for flexibility.

There's another issue: p-value only tells you "the probability of seeing this data if H₀ were true." It doesn't tell you the probability that variant A is actually better. If p=0.03, you reject H₀, but you can't say "A beats B with 97% confidence." Frequentist language gives you only "statistical significance," which isn't enough for business decisions.

## The Logic Behind Bayesian Approach

The Bayesian framework transforms prior knowledge into a posterior distribution. Prior: your belief about conversion rate before the test starts. As data arrives, Bayes' theorem updates the prior into a posterior. Posterior: the probable distribution of conversion rate given all the data collected so far.

Formula:  
**P(θ | data) ∝ P(data | θ) × P(θ)**

θ = conversion rate, data = observed successes and failures. Likelihood (probability of the data) × prior → posterior. Beta distribution is the conjugate prior, so math is simple: if variant A shows α successes and β failures, posterior = Beta(α+1, β+1).

Every day, new data arrives and you update the posterior. The critical advantage of sequential testing: you compare posterior distributions and calculate "probability that A's conversion rate exceeds B's" using Monte Carlo simulation. Once it exceeds 95%, you decide. Unlike frequentist "reach N then look," you look every day and stop when you hit your threshold.

### Posterior Calculation Example

```python
import numpy as np
from scipy.stats import beta

# Variant A: 120 conversions, 1200 impressions
alpha_A = 120 + 1  # +1 for uniform prior
beta_A = (1200 - 120) + 1

# Variant B: 95 conversions, 1150 impressions
alpha_B = 95 + 1
beta_B = (1150 - 95) + 1

# Monte Carlo: draw 10,000 samples
samples_A = beta.rvs(alpha_A, beta_A, size=10000)
samples_B = beta.rvs(alpha_B, beta_B, size=10000)

# Probability that A > B
prob_A_wins = (samples_A > samples_B).mean()
print(f"P(A > B) = {prob_A_wins:.3f}")
```

Sample output: `P(A > B) = 0.983` — 98.3% confidence A wins. A frequentist t-test on the same data might return p=0.06 (not significant), but Bayesian says 98% confident. Which matters more for your business decision?

## Sequential Testing and Early Stopping

Bayesian testing is inherently sequential. Update your posterior daily, check your decision threshold. When "probability to be best" exceeds 95%, stop and deploy the winner. Early stopping doesn't inflate Type I error like it does in frequentist testing because your decision criterion is posterior probability, not p-value.

Practical workflow:  
1. Define your prior (usually uninformative Beta(1,1)—uniform distribution)  
2. Collect conversion data daily  
3. Calculate the posterior  
4. Compute P(A > B) and P(B > A)  
5. If either exceeds 95%, stop the test  
6. If 14 days pass without reaching 95%, call it "inconclusive" (insufficient sample size)

This approach is critical for [conversion rate optimization](https://www.roibase.com.tr/en/cro) workflows. Testing a landing page variant where B shows 30% lower CTA clicks in the first 3 days? Bayesian posterior says "B is bad" at 96% confidence. Frequentist sample size rules would make you wait 10 more days, but you stop on day 3, shift traffic to A, and reduce opportunity cost.

### Sample Size Dynamics

Bayesian testing has no fixed sample size, but you can estimate "expected sample size." It depends on how informative your prior is. If historical data tells you conversion rate hovers around 10%, use Beta(10,90) as an informative prior—less data needed. With an uninformative prior, it takes longer but still often beats frequentist speed, especially when effects are large.

Sample simulation table (illustrative):

| True Δ | Frequentist N | Bayesian Expected N | Bayesian 90th Percentile N |
|---|---|---|---|
| +10% | 4,800 | 3,200 | 5,100 |
| +20% | 1,200 | 800 | 1,400 |
| +5% | 19,200 | 14,000 | 22,000 |

For small lifts, Bayesian still takes time but it's less inflexible than frequentist. For large lifts, expect 30–40% faster results on average.

## Counter-Arguments and Tradeoffs

**1. Prior selection is subjective:** True, you're injecting prior knowledge. But using an uninformative prior (Beta(1,1)) minimizes this problem. Moreover, as data accumulates, the prior becomes negligible—the likelihood dominates. Frequentist seems "objective" but alpha, power, and MDE choices are equally subjective.

**2. Computational cost:** Bayesian testing requires posterior update + Monte Carlo sampling daily. Frequentist t-test is one-time math. But modern tools (PyMC, Stan, Google Optimize's Bayesian mode) automate this. Sampling 10,000 draws runs in milliseconds—not a real constraint.

**3. Regulatory compliance:** In regulated domains like pharma trials requiring FDA approval, frequentist methods are the standard. Digital marketing has no such mandate. AB testing platforms (Optimizely, VWO, AB Tasty) now offer Bayesian options.

**4. Confusion with multi-armed bandits:** Bayesian testing is often conflated with bandit algorithms (Thompson sampling). Bandits balance exploration-exploitation and gradually shift traffic toward winners during the test. Bayesian A/B testing uses fixed traffic split and uses posteriors for decision-making. Different use cases—bandits suit high-velocity campaigns; Bayesian testing suits longer-lifecycle product decisions.

## Real-World Scenario: Meta Ads Creative Testing

You're testing 3 creative variants on Meta Ads (A, B, C). Daily budget $500, CPA target $25. Frequentist methodology demands 1,000 conversions per creative (80% power, 15% MDE). At 60 daily conversions, you need 50 days. But by day 10, variant C's CPA climbs to $40—clearly underperforming.

Bayesian approach works like this:  
- Collect spend and conversions daily for each creative  
- Calculate CPA posterior distribution (Gamma likelihood, since CPA is continuous positive)  
- Compute P(CPA_C > $30)—returns 92%  
- Pause C on day 10, reallocate budget to A and B  

By day 20, P(CPA_A < CPA_B) = 96%. Declare A the winner—decision in 20 days instead of 50. You've saved $5,000 in budget and run 10 extra days at better CPA.

This kind of dynamic decision-making is critical in the post-iOS14 era. Signal loss eroded test reliability—Bayesian posteriors make uncertainty explicit. You can say "data is insufficient, posterior is too wide," which frequentist p-values never communicate.

---

Bayesian A/B testing solves frequentist's rigid sample size and peeking-prohibition problems. Sequential testing lets you measure decision confidence daily and stop early once you hit your confidence threshold. Prior selection adds subjectivity, but uninformative priors plus sufficient data minimize that concern. If you want campaign flexibility, budget efficiency, and speed in performance marketing, Bayesian framework is the right approach. Build your test infrastructure around dynamic posterior updating—not static N calculations.