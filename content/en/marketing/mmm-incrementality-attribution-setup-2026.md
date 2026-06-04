---
title: "MMM + Incrementality: Your 2026 Attribution Stack"
description: "Robyn, Meta Lift, geo experiments — which method, when? A practical decision tree for post-cookie attribution."
publishedAt: 2026-06-04
modifiedAt: 2026-06-04
category: ppc
i18nKey: marketing-004-2026-06
tags: [mmm, incrementality, attribution, robyn, geo-test]
readingTime: 8
author: Roibase
---

80% of cookie tracking is gone. Multi-Touch Attribution (MTA) is no longer reliable. Platform dashboards contradict each other. In 2026, marketers measure contribution using two complementary methods: Marketing Mix Modeling (MMM) and incrementality testing. The problem: few know when to use which. This article shows where to place Robyn (Meta's open-source MMM library), Meta Lift API, and geo-based holdout tests in the same setup.

## Last-touch attribution is dead—but what replaces it?

Google Analytics 4 claims "data-driven attribution." Meta says "modeled conversions." TikTok reports its own numbers. All three differ. In 2025, an e-commerce brand spending $100 sees 8 conversions in GA4, 12 in Meta, and 6 in TikTok. Which channel actually works? Last-touch attribution can't answer because users pass through multiple touchpoints and each platform self-credits. 

Marketing Mix Modeling solves this differently: it treats channels as independent variables, sales or revenue as the dependent variable, and uses regression to calculate each channel's marginal contribution. Incrementality tests are more direct: expose one group to a channel, withhold it from another, measure the difference. Both break the last-touch illusion, but their use cases don't overlap.

The difference is scale: MMM is macro (long-term, all channels), incrementality is micro (short-term, specific campaign or channel). By 2026, combining both is standard practice.

## MMM: Weekly regression setup with Robyn

Meta's Robyn library is the Facebook Marketing Science team's open-source MMM framework. It runs in R, uses Bayesian ridge regression, and auto-fits adstock (lagged effect) and saturation (diminishing returns) curves. At weekly granularity, it outputs each channel's (TV, display, paid social, SEO, email) percentage contribution to sales.

**Robyn's 4 setup components:**

1. **Data gathering:** Minimum 1.5 years of weekly data. One row per week. Columns: spend per channel, impressions or clicks; independent variables (price, inventory, seasonality); dependent variable (revenue, orders, conversions). Missing data breaks the model.
2. **Hyperparameter tuning:** Robyn searches adstock decay (α) and saturation shape (γ) for each channel, running 2000+ model combinations and suggesting the best 5–10 from the Pareto frontier. This step takes 10–30 minutes on 64 cores.
3. **Model selection:** Pick the model with lowest NRMSE (Normalized Root Mean Squared Error) plus highest decomp.rssd (decomposition stability). Output: each channel's percentage contribution to total sales, estimated ROI, optimal spend allocation.
4. **Budget allocation:** Robyn's "budget allocator" function redistributes total budget to equalize each channel's marginal ROI. Use this output for next quarter's plan.

**When to use Robyn:**
- Cross-channel budget decisions (e.g., Q3 planning)
- New channel addition/removal simulation
- Long-term trend analysis (6+ months)

**When NOT to use Robyn:**
- In-campaign optimization (periods under 2 weeks)
- Platform-specific creative decisions (MMM can't detect creative differences)
- Real-time bidding feedback (weekly lag)

Roibase integrates Robyn in its [Digital Marketing](https://www.roibase.com.tr/en/dijitalpazarlama) service: we connect GA4, server-side GTM, Meta CAPI, and BigQuery, build a weekly ETL pipeline, and visualize model output in Data Studio.

## Incrementality tests: Meta Lift and geo-based holdout

MMM answers "how much?" Incrementality answers "does it really work?" Two different questions. If you spend $100K on Meta and get 120 conversions, is that "good"? MMM says "Meta captures 15% of budget, drives 12% of sales." But how many of those conversions would have happened anyway (organic)? That's where incrementality testing comes in.

### Meta Conversion Lift

Meta Lift API measures the **true impact** of Facebook and Instagram ads. How? It withholds the campaign from a small holdout group, shows it to others, and measures the difference 7–14 days later. The difference = incremental conversions.

**Setup:**
- Open a Lift study before campaign launch (Ads Manager > Measure & Report > Conversion Lift)
- Holdout rate is 5–10% (too small = noise, too large = impression loss)
- Test runs at least 7 days (shorter = low statistical power)
- Output: incremental conversions, incremental CPA, confidence interval

**Example result interpretation:**
Control group: 1,000 people, 40 conversions
Test group: 9,000 people, 450 conversions
Incremental conversions = (450/9,000 − 40/1,000) × 9,000 = 90
Lift = 90 / (450 − 90) = 25%

So of the 450 conversions the campaign saw, only 90 were truly from the ad. The rest would have happened anyway. Incremental CPA = spend / 90. This number is 30–60% higher than MTA—because it's real.

**When to use Meta Lift:**
- A/B testing new campaigns or creatives
- Platform decisions (Meta vs. Google vs. TikTok—which is more incremental?)
- Measuring retargeting's true contribution (common issue: retargeting always looks cheap but 80% would convert anyway)

**Drawback:**
- Only works on Meta (Google has Display & Video 360, but limited)
- Creating a holdout group causes impression loss (revenue dips short-term)
- Minimum 1-week test period—not suitable for daily decisions

### Geo-based experiments (geographic holdout)

For non-Meta channels (Google, TikTok, TV), run geo tests: activate campaigns in some cities, leave others untouched, measure the sales difference. Academically, this is the cleanest incremental measurement because no user-level manipulation.

**Example setup:**
- Select 30 cities (similar population, economic profile)
- Launch Google Ads campaign in 15, keep 15 as control (randomize)
- Wait 4 weeks
- Compare city-level conversions in Google Analytics 4

**Analysis:**
- Treated cities: average 120 conversions/city
- Control cities: average 95 conversions/city
- Incremental lift: (120 − 95) / 95 = 26.3%

Extrapolate this 26.3% lift nationally. If Google Ads spend is $200K, calculate incremental revenue and incremental ROAS.

**When to use geo tests:**
- Measuring each channel's net contribution in a multi-channel setup
- Assessing non-digital channels (TV, OOH, podcasts)
- You don't trust platform dashboards

**Drawback:**
- Too few cities = low statistical power (minimum 20 cities)
- Geographic heterogeneity skews results (Istanbul ≠ Şanlıurfa)
- Slow (4–8 weeks)

## Decision tree: which method, when?

Organize all three methods in one setup like this:

| Scenario | Method | Frequency | Output |
|----------|--------|-----------|--------|
| Quarterly budget allocation | Robyn MMM | Every 3 months | Channel ROI, optimal spend |
| New campaign test (Meta/Instagram) | Meta Lift | Per major campaign | Incremental CPA |
| Cross-channel incrementality | Geo-based holdout | Every 6 months | Channel-level true lift |
| Creative refresh decision | Meta Lift + CRO analysis | Monthly | Which creative is incremental |
| Real-time bidding | Platform API (ROAS feedback) | Daily | Tactic-level optimization |

**Practical workflow:**
1. **Weekly:** Monitor platform dashboards (MTA-like, but don't trust them)
2. **Monthly:** Test big campaigns with Meta Lift
3. **Quarterly:** Model all channels with Robyn, redistribute budget based on long-term contribution
4. **Twice yearly:** Validate each channel's true lift with geo-based tests

This 3-layer setup lets you drive both short-term tactics (which creative works) and long-term strategy (how much budget per channel) with data.

## Common misconceptions and tradeoffs

**Misconception 1:** "If I do MMM, incrementality testing is unnecessary"
Wrong. MMM shows correlation, assumes causation. Incrementality testing measures causation. They complement each other. Example: MMM says "Instagram contributes 15%," but Lift test reveals 40% of that would happen anyway. True contribution: 9%.

**Misconception 2:** "Run incrementality tests on every campaign"
No. Holdout groups mean lost impressions. Test only on major decisions (new channel, new creative direction, retargeting strategy shift). Small optimizations use A/B tests instead.

**Misconception 3:** "Set up Robyn once, then it runs itself"
No. Retrain the model every quarter. New channels, price changes, or seasonality shifts require model updates. Robyn setup requires ongoing maintenance.

**Tradeoff 1: Speed vs. precision**
MMM requires 1.5 years of data, results lag by 1 week. Geo tests take 4–8 weeks. Want fast decisions? Rely on platform dashboards but accept 30–50% error margins.

**Tradeoff 2: Granularity vs. sample size**
City-level geo tests keep sample size tight and confidence intervals wide. District-level increases heterogeneity. Weekly MMM can't answer daily questions. Every method has resolution limits.

## How to build your attribution stack in 2026

The technical setup consists of:

1. **Server-side GTM + first-party cookies:** Send clean signals to GA4 and Meta CAPI (consent-based data enrichment, not iOS ATT bypass)
2. **BigQuery data warehouse:** Consolidate all platform data in one place (GA4, Meta Ads API, Google Ads API, TikTok Ads API, CRM)
3. **dbt transformations:** Create weekly aggregate tables (one row = one week, each column = one channel spend + one outcome)
4. **Robyn pipeline:** Run R script in Cloud Run weekly, write model output to BigQuery
5. **Looker Studio dashboard:** MMM output + platform MTA numbers + incrementality test results side-by-side
6. **Slack alerts:** Alert on data anomalies if model NRMSE exceeds 10%

Building this stack takes 4–6 weeks. After that, weekly maintenance is 2–3 hours. ROI: budget allocation becomes 15–25% more efficient (Robyn reports 18% improvement in benchmarks).

## What to do now

If you're still making decisions based on last-touch attribution, you won't compete in 2026. First step: stream platform data to BigQuery, build 1.5 years of weekly tables. Second step: set up Robyn, train the first model. Third step: open a Meta Lift study on your next major campaign. Fourth step: in 6 months, run a geo-based test to validate cross-channel lift. These 4 steps move your attribution stack from MTA illusion to incrementality foundation.