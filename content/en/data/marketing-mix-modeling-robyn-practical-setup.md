---
title: "Marketing Mix Modeling: Practical Setup with Robyn"
description: "Deploy Meta's open-source MMM library Robyn on BigQuery to model saturation curves, adstock decay, and holdout validation for accurate channel ROI attribution."
publishedAt: 2026-05-17
modifiedAt: 2026-05-17
category: data
i18nKey: data-005-2026-05
tags: [marketing-mix-modeling, robyn, meta, adstock, saturation-curve]
readingTime: 8
author: Roibase
---

Attribution window has collapsed to 7 days, cookie consent rejection exceeds 40%, and multi-touch cross-channel contribution has become unmeasurable. In 2026, the performance marketer's single reliable tool is aggregate econometric modeling — Marketing Mix Modeling. Meta's Robyn library, open-sourced in 2021, made this process production-ready for the first time. How to interpret saturation curves, what adstock decay means, at what intervals holdout validation operates — this post walks through deploying Robyn on BigQuery data stack to answer these questions.

## What Robyn Is, and What It Isn't

Robyn is an R library released open-source by Facebook Marketing Science. Its purpose: to regress weekly or daily channel spend plus external macro variables (holidays, seasonality, price) against sales metrics. Output: each channel's ROAS, saturation level, lag effect (adstock), and optimal budget allocation.

What it isn't: it is not last-click attribution, doesn't track user-level conversion paths. Uses no personal data, awaits no cookie signals. It employs aggregate time series regression with non-linear transformations tuned via Nevergrad hyperparameter optimization — scanning complex saturation functions rather than fitting Ridge or Lasso.

Standard MMM processes model ~36 data points monthly. Robyn works at daily granularity — minimum 104 weeks (2 years) recommended. Below 52 weeks, variance stays high and confidence intervals unreliable.

## Saturation Curve: S-Curve and Hill Function

At Robyn's core sit two saturation transformations: Adbudg (S-curve) and Hill. Both encode the assumption of diminishing marginal returns. Every additional 1,000 units spent on a channel won't yield the same response as the first 1,000.

**Hill transformation formula:**
```
y = K * (x^alpha) / (S^alpha + x^alpha)
```
- K: maximum response (asymptote)
- S: half-saturation point (spend reaches 50% of K response)
- alpha: curve steepness (alpha > 1 = S-curve, alpha < 1 = concave)

Robyn optimizes alpha and S for each channel via Nevergrad. Tests 10,000+ combinations, selects the best fit using lowest NRMSE (normalized root mean squared error).

**Practical interpretation:**
- If Google Ads returns S = 50,000 units, weekly spend at 50,000 reaches half your response potential.
- If alpha = 2.5, the curve is steeply S-shaped: below 50,000 units returns are low, above it they plateau slowly.
- Budget optimizer uses these curves to answer "raise Google from 50,000 to 60,000 or Facebook from 30,000 to 40,000?" — answering via marginal response comparison.

Real-world patterns: search budgets typically concave (alpha < 1, limited demand), display/video convex (alpha > 1, unlimited inventory but finite attention).

## Adstock Decay: Modeling Lagged Effects

Marketing spend impacts sales same-day but effects can linger weeks. TV drives brand recall for 3 weeks after air date; paid social peaks within 7 days. Adstock mathematically encodes this carryover and decay.

Robyn offers two adstock transformations:
1. **Geometric adstock:** exponential decay. Theta parameter (0–1). Theta = 0.5 means last week's effect carries 50% into this week.
2. **Weibull adstock:** more flexible — peak delay plus long tail. Parameters: shape (k) and scale (lambda). Preferred for TV-like channels with delayed peak effects.

**Geometric adstock formula:**
```
adstocked_t = spend_t + theta * adstocked_(t-1)
```

Robyn optimizes theta (or k, lambda) per channel via grid search. User specifies theta range in hyperparameters.json (e.g., 0–0.7), model finds best theta.

**What you configure:**

```r
hyperparameters <- list(
  google_ads_S = c(0.3, 3),      # adstock theta range
  google_ads_alphas = c(0.5, 3), # saturation alpha range
  facebook_ads_S = c(0.1, 2),
  facebook_ads_alphas = c(1, 5)
)
```

Result: Google Ads theta = 0.4, Facebook = 0.2 means Google effect persists longer. Budget planner accounts for this — one-quarter of Google spend still works 2 weeks out; Facebook's effect ends in 1 week.

### Code Block: Simple Adstock Transformation (R)

```r
apply_geometric_adstock <- function(spend, theta) {
  adstocked <- numeric(length(spend))
  adstocked[1] <- spend[1]
  for (t in 2:length(spend)) {
    adstocked[t] <- spend[t] + theta * adstocked[t - 1]
  }
  return(adstocked)
}

# Example: Google Ads spend
google_spend <- c(10000, 15000, 12000, 8000, 20000)
theta_google <- 0.5
adstocked_google <- apply_geometric_adstock(google_spend, theta_google)
print(adstocked_google)
# [1] 10000.0 20000.0 22000.0 19000.0 29500.0
```

Inside Robyn, this logic runs C++-optimized, but the principle is identical.

## Holdout Validation: Model Reliability Test

Robyn risks overfitting while improving model fit. 10 channels + 5 macro variables + saturation and adstock parameters per channel → 30+ degrees of freedom. On 104 data points, that's excessive freedom.

Robyn uses holdout validation: excludes final N weeks from training, model learns from past data, predicts on holdout period, compares to actual values via MAPE (mean absolute percentage error).

**Holdout definition in Robyn:**

```r
InputCollect <- robyn_inputs(
  dt_input = df_marketing,
  dep_var = "revenue",
  paid_media_spends = c("google_ads", "facebook_ads", "tiktok_ads"),
  window_start = "2024-01-01",
  window_end = "2026-04-30",
  adstock = "geometric",
  prophet_vars = c("trend", "season", "holiday"),
  prophet_country = "US"
)

# Holdout: final 8 weeks
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  ts_validation = TRUE,
  ts_holdout = 8  # final 8 weeks as test set
)
```

**Result interpretation:**
- NRMSE train < 0.10, NRMSE holdout < 0.15 → model reliable.
- NRMSE train = 0.05, holdout = 0.30 → overfit; narrow hyperparameter range.
- Decomp.RSSD (response sum of squared differences): what fraction of revenue's variance channels explain. 0.6+ good, 0.8+ excellent.

Robyn runs 5 trials simultaneously (Nevergrad's different random seeds), 2000 iterations per trial, surfaces top 10 models on Pareto frontier. User selects one model based on business constraints (e.g., "Google ROAS must stay above 3").

## Robyn on BigQuery: Pipeline Architecture

Robyn runs in R but sources data from BigQuery. Typical stack:

1. **BigQuery data warehouse:** daily spend table (spend_daily), conversion table (conversions_daily), macro variables (holidays, weather, competitor pricing).
2. **dbt transformation:** join and aggregate. Convert to weekly rows, create channel spend columns.
3. **R script (Cloud Run or Vertex AI):** fetch from BigQuery via bigrquery, feed to Robyn, write model output back to BigQuery.
4. **Looker Studio dashboard:** visualize model output — channel ROAS, optimal budget split, saturation charts.

**dbt model example (marketing_mix_weekly.sql):**

```sql
WITH spend_agg AS (
  SELECT
    DATE_TRUNC(spend_date, WEEK) AS week_start,
    SUM(CASE WHEN channel = 'google_ads' THEN spend ELSE 0 END) AS google_ads_spend,
    SUM(CASE WHEN channel = 'facebook_ads' THEN spend ELSE 0 END) AS facebook_ads_spend,
    SUM(CASE WHEN channel = 'tiktok_ads' THEN spend ELSE 0 END) AS tiktok_ads_spend
  FROM `project.dataset.spend_daily`
  WHERE spend_date BETWEEN '2024-01-01' AND '2026-04-30'
  GROUP BY 1
),
revenue_agg AS (
  SELECT
    DATE_TRUNC(conversion_date, WEEK) AS week_start,
    SUM(revenue) AS total_revenue
  FROM `project.dataset.conversions_daily`
  WHERE conversion_date BETWEEN '2024-01-01' AND '2026-04-30'
  GROUP BY 1
)
SELECT
  s.week_start,
  s.google_ads_spend,
  s.facebook_ads_spend,
  s.tiktok_ads_spend,
  r.total_revenue
FROM spend_agg s
LEFT JOIN revenue_agg r USING (week_start)
ORDER BY week_start
```

This table is materialized in BigQuery; Robyn's R script fetches it via `bigrquery::bq_table_download()`. Model output (weekly channel contribution) writes back to BigQuery — BI tools read from there.

## Budget Optimizer: Pareto-Optimal Allocation

After model fit, Robyn runs a second module: budget allocator. Inputs: total budget (e.g., 500,000 units/week), channel spend constraints (e.g., Google minimum 50,000). Output: optimal allocation maximizing ROAS.

Algorithm: takes derivative of each channel's saturation curve (marginal ROAS), shifts spend until marginal ROAS equalizes across channels. This is Lagrange multiplier optimization.

**Sample output table:**

| Channel | Current Spend | Optimal Spend | Delta | Current ROAS | Optimal ROAS |
|---|---|---|---|---|---|
| Google Ads | 200,000 | 180,000 | -20,000 | 4.2 | 4.5 |
| Facebook Ads | 150,000 | 200,000 | +50,000 | 3.8 | 4.1 |
| TikTok Ads | 100,000 | 120,000 | +20,000 | 3.5 | 3.9 |
| Display | 50,000 | 0 | -50,000 | 1.2 | — |

Interpretation: Display channel returns 1.2 ROAS even well below saturation — eliminate it. Google already at saturation threshold; trim 20,000 to boost ROAS. Facebook remains on curve's linear slope; increased budget is efficient.

This table reaches CFO; Robyn's SQL output appears in Looker visualization. Decision-making becomes data-driven — "increase Facebook by 50,000 this month" is now model output, not intuition.

---

Deploying Robyn requires 2 years of weekly granular data, R environment, BigQuery connection, and 4–6 hours of hyperparameter tuning. Once production, refresh monthly (add 4 new weeks, slide holdout window). Saturation curve and adstock parameters drift over time — holidays lower Facebook theta, Black Friday lifts Google Ads alpha. Robyn doesn't auto-capture this, but higher retrain frequency does. When [first-party data architecture](https://www.roibase.com.tr/en/firstparty) is solid on BigQuery, Robyn sits atop it, operationalizing aggregate MMM. In the cookieless era, econometric models replace attribution as necessity — Robyn is the first open-source tool making that shift production-viable.