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

Mobile F2P price optimization is often reduced to A/B testing: compare two prices, pick the higher revenue. This worked in 2018 when UA cost was low and sample size wasn't a constraint. In 2026, the landscape is different: iOS 14.5 broke cohort tracking, Apple Search Ads CPI increased 340%, test windows stretched from 8 to 14 weeks. Bayesian methodology provides two advantages under these conditions: posterior distributions enable early decision-making, and segmentation strengthens the model through prior knowledge. Price elasticity in game economy isn't constant—whale/dolphin/minnow segments respond differently, and capturing this variation is beyond frequentist A/B's capability.

## Economic Logic of Bayesian Tests

In mobile F2P, test cost isn't just development time—it's opportunity cost. If you're testing $4.99 versus $6.99 and waiting 14 weeks, the revenue you forfeit while finding the right price *is* the test cost itself. Bayesian approach updates the posterior probability distribution daily—conversion rate isn't 2.3%, it's 1.8%–2.9% within 95% credible interval. As this interval narrows, decisions become clearer and you can stop tests early.

Frequentist A/B requires calculating minimum sample size for p-value <0.05 and waiting until you hit that number. But in mobile gaming, cohort size fluctuates daily: a feature launch spikes DAU +40%, summer seasonality drops it −25%. Bayesian model reads this volatility as prior updating, not fixed sample size planning.

Practical example: in a 10,000 DAU game, you test a $9.99 starter pack. Frequentist math requires 42,000 users to detect 5% revenue lift in 6 weeks. Bayesian model shows posterior mean $11.2 ARPPU by week 3 versus control $10.8—95% CI doesn't overlap. Decision made, test closed. Three weeks of lost revenue recovered.

### Prior Selection and Segmentation

Prior distribution in Bayesian tests isn't arbitrary—it's shaped by historical data. If you tested 8 price points between $4.99–$9.99 last year in a similar game, you extract a beta distribution prior from that data. The prior may be weak (high variance) but better than an uninformative uniform prior because you know whale conversion doesn't drop below 0.5%.

Segmentation strengthens prior: uninformative prior for new users, tight prior for 30+ day retention users. Hierarchical Bayesian model estimates segment-level and global-level parameters simultaneously—each segment uses its own data while sharing the global trend. This prevents overfitting in small segments.

## IAP Price Ladder Architecture

F2P price ladders aren't flat—they're distributed on logarithmic scale: $0.99, $2.99, $4.99, $9.99, $19.99, $49.99, $99.99. These jumps have psychological reasons (charm pricing) but stronger economic logic: each tier captures a different willingness-to-pay segment. In Bayesian optimization, each tier has its own posterior and they interact—raise $4.99 and $2.99 conversions may drop (downgrade), while $9.99 rises (upgrade).

Ladder testing optimizes the entire staircase, not one price. Multi-armed bandit algorithm treats each price point as a separate arm, using Thompson Sampling to draw from current posterior and select highest expected revenue. First 2 weeks all arms explore equally, week 3+ exploitation increases as posterior confidence grows.

Example scenario: 7-tier ladder, 21-day test. Days 1–7 each price gets 14% traffic (uniform). Day 8 onwards, highest posterior mean × conversion rate captures traffic. By day 21, $4.99 gets 40% traffic, $9.99 gets 25%, others 5–10%. Final decision keeps both $4.99 and $9.99 because both deliver positive marginal revenue without cannibalizing each other.

### Segment-Based Pricing

One price doesn't work across whale/dolphin/minnow segments because price elasticity differs. Whale users (top 1% spenders) show −3% conversion from +20% price increase—inelastic. Minnow users (first $0.99 buyers in week 1) show −18% drop from +10% increase—elastic. Bayesian model encodes this elasticity in segment-level priors.

Segmentation features: days since install (D1/D7/D30), total spend, time since last IAP, session frequency, level progression. These features build latent segment prior—hierarchical model estimates segment membership too. New users get segment prediction from first 24h behavior, price shown accordingly.

Roibase's [App Store Optimization](/en/aso) work uses similar segmentation: creative test results vary by user segment; same creative delivers 8% IPM on iOS 16+ but 3% on iOS 15. When ASO integrates with IAP optimization, funnel integrity is achieved—showing right price to right user requires first attracting right user.

## Posterior Estimation and Decision Mechanism

In Bayesian tests, decision metric is posterior probability of superiority: $P(\text{treatment} > \text{control} | \text{data})$. When this exceeds 95%, treatment wins. Unlike frequentist p-value which measures data extremity under null hypothesis, posterior probability directly answers: "What's the probability treatment is better?"

Posterior calculation uses conjugate priors for analytical solutions (beta-binomial), or MCMC (Markov Chain Monte Carlo) simulation otherwise. Mobile gaming tests often combine binomial conversion + lognormal revenue, requiring hybrid approach—beta prior for conversion, lognormal for revenue. PyMC3 or Stan runs 10,000 MCMC iterations in 30 seconds, refreshing posterior with daily data.

Decision threshold can be 90% instead of 95%—aggressive growth uses 90%, mature games use 95%. Lower threshold increases false positive risk but shortens test window. Expected value of information (EVI) calculates optimal threshold: cost of running test 1 more week versus cost of wrong decision gets trade-offed.

### Multi-Variant Bayesian Test Structure

IAP price tests typically include 3+ variants: control ($4.99), treatment A ($5.99), treatment B ($6.99). Frequentist A/B faces multiple comparison problem—Bonferroni correction multiplies sample size. Bayesian approach gives each variant its own posterior; pairwise comparisons happen simultaneously. Rather than picking highest posterior mean, maximize expected revenue: variant win probability × expected revenue product.

Thompson Sampling strategy: each day sample once from each variant's posterior, send traffic to highest sample. This automatically balances explore/exploit—high posterior uncertainty (early days) yields near-uniform traffic split, later focuses on winning variant.

Code snippet (PyMC3 simple beta-binomial):

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

This model optimizes conversion rate. Revenue optimization adds lognormal prior and computes joint posterior of `p × revenue_mean`.

## Segment Migration and Long-Term Impact

Price optimization isn't one-time—it's continuous. Users change segments: today's minnow becomes dolphin in 30 days. Bayesian model doesn't capture this because it uses static prior. Solution: dynamic prior update—every 30 days posterior merges with new data to become new prior.

Long-term impact measured via cohort retention curve with Bayesian survival analysis. If price change drops D7 retention 2% but lifts LTV $12→$14, net positive. Survival model uses Weibull distribution, estimates shape and scale, posterior predictive check yields 90-day LTV forecast.

Retention impact testing takes 6–8 weeks to observe D30 signals. Bayesian approach predicts D30 from D7—using prior of past cohorts' D7→D30 transition rate. This gives early signals by week 3: if posterior mean D30 retention is 18% with 95% CI [16%, 20%], test continues; if CI is [14%, 16%], price damaged retention, reverse immediately.

## Game Economy and Platform Dynamics

iOS and Android users respond differently to the same price ladder. iOS users average 23% higher ARPPU; same $4.99 converts at 3.2% on iOS, 2.1% on Android. Bayesian model adds platform as hierarchical factor—each platform has its own segment prior but shares global trend.

Apple's App Store tier system (Tier 1 = $0.99, Tier 5 = $4.99...) constrains pricing flexibility. Between tiers, grid search finds highest posterior expected revenue rather than testing. Google Play allows arbitrary pricing but shows higher conversion volatility—Android tests use 30% wider prior variance. Currency fluctuation also affects posterior: when Turkish Lira shifts from ₺25 to ₺35 per USD, price ₺49.99 drops from $2 to $1.43 in real terms. Model uses currency-adjusted revenue, posteriors computed in USD baseline.

Emerging markets need PPP-adjusted priors—same game might be $4.99 in US, R$9.90 in Brazil (PPP-equivalent ~$1.80). [Premium Publisher Program](/en/premiumyayinci) UA campaigns feed price test results back: higher-LTV segments get boosted CPM bids, lower-conversion segments see reduced bids. When Bayesian IAP model integrates with UA bidding, portfolio-level ROI optimization becomes possible—single model output answers: which user segment gets which price at which CPI cap.

---

Mobile F2P price optimization can't be reduced to "which price wins." Segment elasticity, platform differences, retention impact, currency risk all feed the model. Bayesian methodology fits this complexity into prior/posterior framework and enables early decision-making. But Bayesian testing is more complex than frequentist A/B—requires data pipeline, MCMC infrastructure, prior tuning. ROI is straightforward: running 2+ price tests monthly, shrinking each from 4 weeks to 2 weeks pays for itself. Build once (1 sprint), maintain weekly (2 hours analytics)—net positive trade-off.