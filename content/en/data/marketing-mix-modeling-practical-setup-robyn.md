---
title: "Marketing Mix Modeling: Practical Setup with Robyn"
description: "Build attribution models with Meta's Robyn framework using saturation curves, adstock decay, and holdout validation. SQL, R, and production pipeline."
publishedAt: 2026-06-21
modifiedAt: 2026-06-21
category: data
i18nKey: data-005-2026-06
tags: [marketing-mix-modeling, robyn, adstock, attribution, mmm]
readingTime: 8
author: Roibase
---

Cookie deprecation and privacy regulation are shifting attribution from deterministic methods to probabilistic modeling. Marketing Mix Modeling (MMM)—a statistical tool from the 1960s—is back at center stage. Meta's open-source Robyn framework provides the practical implementation: Bayesian inference, saturation curves, and adstock decay bind weekly marketing spend to sales through regression modeling, which you move to production. This article walks through setting up Robyn, fitting models to real data, running hyperparameter grid search, and preventing overfitting with holdout validation.

## What is Robyn and how it differs from classical regression

Robyn is an open-source MMM framework written in R. Meta developed it for its own marketing team in 2020 and released it in 2021. Its differences from classical linear regression are:

**Adstock transformation**: Marketing effect is not instantaneous—a TV ad carries mind share for weeks. Adstock models the contribution of past spending to current sales using exponential decay. Robyn supports geometric and Weibull adstock functions. Geometric is simple: `adstock_t = spend_t + θ × adstock_(t-1)`, where θ is the decay parameter. Weibull is more flexible—you can position peak effect with a lag.

**Saturation (diminishing returns)**: The spend-to-sales relationship is not linear. The first $100K may deliver 80% ROI, while the second $100K delivers 40%. Robyn applies Hill and S-curve saturation functions. The Hill equation is `y = V_max × x^n / (K^n + x^n)`, where K is the half-maximum point and n is the slope. This non-linearity is critical for channel-level budget optimization.

**Hyperparameter tuning**: Adstock decay, saturation K, and n values are unknown—found through grid search. Robyn uses a genetic algorithm (NSGAII) to test thousands of model combinations and selects the best trade-off from the Pareto frontier.

## Data preparation: from SQL to weekly granularity

Robyn works at weekly granularity. You aggregate daily transaction logs into weekly media spend and revenue. Example BigQuery query:

```sql
WITH weekly_revenue AS (
  SELECT
    DATE_TRUNC(order_date, WEEK) AS week_start,
    SUM(revenue) AS revenue
  FROM `project.dataset.orders`
  WHERE order_date >= '2024-01-01'
  GROUP BY 1
),
weekly_spend AS (
  SELECT
    DATE_TRUNC(date, WEEK) AS week_start,
    channel,
    SUM(cost) AS spend
  FROM `project.dataset.marketing_costs`
  WHERE date >= '2024-01-01'
  GROUP BY 1, 2
)
SELECT
  r.week_start,
  r.revenue,
  COALESCE(s_google.spend, 0) AS google_search_spend,
  COALESCE(s_meta.spend, 0) AS meta_paid_social_spend,
  COALESCE(s_tv.spend, 0) AS tv_spend
FROM weekly_revenue r
LEFT JOIN weekly_spend s_google
  ON r.week_start = s_google.week_start AND s_google.channel = 'google_search'
LEFT JOIN weekly_spend s_meta
  ON r.week_start = s_meta.week_start AND s_meta.channel = 'meta'
LEFT JOIN weekly_spend s_tv
  ON r.week_start = s_tv.week_start AND s_tv.channel = 'tv'
ORDER BY 1;
```

This query produces one row per week, one revenue column, and N channel spend columns. Robyn can ingest it as CSV, but pulling directly from BigQuery to R in production is cleaner. With the `bigrquery` package:

```r
library(bigrquery)
library(Robyn)

bq_auth()
df_input <- bq_project_query(
  "project-id",
  "SELECT week_start, revenue, google_search_spend, meta_paid_social_spend, tv_spend FROM `project.dataset.mmm_input`"
) %>% bq_table_download()
```

Minimum data requirement: 104 weeks (2 years). Less data carries overfitting risk. Robyn's Bayesian priors work with 52 weeks, but 104+ weeks better capture seasonality.

## Model setup: robyn_inputs and hyperparameter grid

Robyn creates a config object using the `robyn_inputs()` function:

```r
InputCollect <- robyn_inputs(
  dt_input = df_input,
  date_var = "week_start",
  dep_var = "revenue",
  dep_var_type = "revenue",
  paid_media_spends = c("google_search_spend", "meta_paid_social_spend", "tv_spend"),
  paid_media_vars = c("google_search_spend", "meta_paid_social_spend", "tv_spend"),
  context_vars = c("competitor_index", "seasonality"),
  window_start = "2024-01-01",
  window_end = "2026-06-14",
  adstock = "geometric",
  hyperparameters = list(
    google_search_spend_alphas = c(0.5, 3),
    google_search_spend_gammas = c(0.3, 1),
    google_search_spend_thetas = c(0, 0.3),
    meta_paid_social_spend_alphas = c(0.5, 3),
    meta_paid_social_spend_gammas = c(0.3, 1),
    meta_paid_social_spend_thetas = c(0, 0.5),
    tv_spend_alphas = c(0.5, 3),
    tv_spend_gammas = c(0.3, 1),
    tv_spend_thetas = c(0.1, 0.7)
  )
)
```

**Hyperparameter explanations:**

- **alpha**: The slope parameter (n) of the Hill saturation function. Higher alpha = delayed saturation.
- **gamma**: The Hill K parameter—the half-maximum point. Lower gamma = earlier saturation.
- **theta**: Geometric adstock decay. 0 = effect ends immediately, 0.7 = 70% carries to next week.

You provide min-max ranges for each channel. Robyn runs grid search within those ranges. For TV, the theta upper bound is 0.7—mind share persists. For paid search, 0.3—conversions are short-term.

## Model execution: robyn_run and Pareto optimization

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  cores = 8,
  iterations = 2000,
  trials = 5,
  outputs = FALSE
)
```

`robyn_run()` uses a genetic algorithm to test hyperparameter combinations across 2000 iterations. Each iteration minimizes NRMSE (normalized root mean squared error) and DECOMP.RSSD (decomposition residual sum of squares difference). Five models are selected from the Pareto frontier—trading off fit quality against business logic (for example, TV's ROI should not exceed search's).

The output object contains a `df_allpareto` table—each model's channel-level ROI, ROAS, and CPA values. Row count = iterations × trials. It includes these columns:

| Column | Description |
|--------|-------------|
| `solID` | Model ID |
| `nrmse` | Normalized RMSE—lower is better fit |
| `decomp.rssd` | Decomposition RSSD—lower is more stable channel contributions |
| `mape` | Mean absolute percentage error |
| `rsq_train` | Training R² |
| `google_search_spend_roi` | Google Search ROI (revenue/spend) |
| `meta_paid_social_spend_roi` | Meta ROI |
| `tv_spend_roi` | TV ROI |

Select the best model based on NRMSE + DECOMP.RSSD + business logic. Robyn offers a Shiny dashboard, but programmatic selection in production gives more control:

```r
best_model_id <- OutputModels$allPareto %>%
  filter(nrmse < 0.1, decomp.rssd < 0.05) %>%
  arrange(nrmse) %>%
  slice(1) %>%
  pull(solID)
```

## Holdout validation: preventing overfitting

A model fit to training data may not generalize to unseen data. Robyn uses holdout validation: you hold out the last 8–12 weeks from training and use them as a test set. The model is fit to training data, makes predictions on the test set. If MAPE (mean absolute percentage error) on the test set is under 15%, the model can move to production.

```r
InputCollect_train <- robyn_inputs(
  dt_input = df_input,
  date_var = "week_start",
  dep_var = "revenue",
  window_start = "2024-01-01",
  window_end = "2026-04-12",  # Hold out last 10 weeks
  # ... other parameters same
)

OutputModels_train <- robyn_run(InputCollect_train, iterations = 2000)

# Prediction on holdout set
df_test <- df_input %>% filter(week_start > "2026-04-12")
predictions <- predict(OutputModels_train, newdata = df_test)
mape_test <- mean(abs((df_test$revenue - predictions) / df_test$revenue)) * 100
```

MAPE > 20% signals overfitting. You need to narrow hyperparameter ranges or add context variables (e.g., economic index, weather). Robyn's Bayesian regularization (ridge penalty) reduces overfitting, but holdout validation is the ultimate safeguard.

## Visualizing adstock decay and saturation curves

Robyn's `robyn_outputs()` function plots adstock and saturation curves. In production, you export these as PNGs and embed them in BI dashboards:

```r
robyn_outputs(
  InputCollect = InputCollect,
  OutputModels = OutputModels,
  select_model = best_model_id,
  export = TRUE,
  export_location = "/data/mmm_output/"
)
```

Exported files include:

- `saturate_curves.png`—Spend vs. response for each channel. X-axis is spend, Y-axis is predicted revenue. The curve flattens at saturation.
- `adstock_curves.png`—Decay profile. X-axis is weeks, Y-axis is adstock multiplier. TV shows 6–8 week decay.
- `waterfall.png`—Revenue decomposition: base + seasonality + channel contribution.

With these visuals, you can tell a CMO: "Instead of raising TV spend by 30%, reallocate 20% to search. Total ROI rises 12%."

## Production pipeline: dbt + Robyn + Looker Studio

MMM is not a one-off analysis—weekly refreshes are required. Using Roibase's [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/en/firstparty) approach, the pipeline is:

1. **dbt**: Creates the `mmm_input` table in BigQuery from raw events (using the SQL above). Scheduled dbt Cloud run every Monday at 00:00.
2. **Robyn R script**: Runs in a Cloud Run container. Pulls `mmm_input` with `bigrquery`, calls `robyn_run()`, writes output to BigQuery (`mmm_output` table: `week_start`, `channel`, `roi`, `predicted_revenue`).
3. **Looker Studio**: Feeds channel ROI trends, saturation curves, and budget recommendation dashboard from `mmm_output`.

Package the container with a Dockerfile:

```dockerfile
FROM rocker/tidyverse:4.2.0
RUN R -e "install.packages('Robyn', repos='https://cloud.r-project.org')"
RUN R -e "install.packages('bigrquery')"
COPY run_mmm.R /app/run_mmm.R
CMD ["Rscript", "/app/run_mmm.R"]
```

Trigger every Monday at 06:00 with Cloud Scheduler. Robyn with 2000 iterations takes ~20 minutes on an 8-core machine.

## Budget reallocation: deriving decisions from the Pareto frontier

Robyn's most powerful output is the budget optimizer. The `robyn_allocator()` function reallocates existing budget across channels to maximize total revenue:

```r
AllocatorCollect <- robyn_allocator(
  InputCollect = InputCollect,
  OutputCollect = OutputModels,
  select_model = best_model_id,
  scenario = "max_response",
  channel_constr_low = c(0.7, 0.7, 0.5),  # Google, Meta, TV protected at 70%, 70%, 50%
  channel_constr_up = c(1.5, 1.5, 2),     # Max 150%, 150%, 200%
  expected_spend = 500000,                # Total budget
  expected_spend_days = 90
)
```

Output table:

| Channel | Current Spend | Optimized Spend | Delta | Expected Revenue Lift |
|---------|---------------|-----------------|-------|----------------------|
| Google Search | 200,000 | 180,000 | –10% | –2% |
| Meta Paid Social | 200,000 | 220,000 | +10% | +8% |
| TV | 100,000 | 100,000 | 0% | 0% |

With this table, you can say: "Shift 10% to Meta, total revenue rises 6%." Constraints (0.7–1.5 multipliers) reflect business limits—for example, TV contract locked for 3 months; only digital is flexible.

## Robyn's limits and combining with incrementality tests

MMM is correlation-based, not causation. If TV spend and sales both rise at the same time, Robyn shows positive ROI, but sales might rise for another reason (economic improvement). Incrementality testing—geo-experiment, holdout group—proves causality. Robyn + incrementality: Robyn provides weekly allocation guidance; incrementality tests validate 2–3 times per year.

Another limitation: new channels. You cannot draw a saturation curve for a channel with no historical data (e.g., podcasts). You accumulate data over 8–12 weeks with a test budget, then add it to the model.

A final constraint: granularity. Robyn works weekly—you cannot make daily or hourly decisions. For that, the [Data Analytics & Insight Engineering](https://www.roibase.com.tr/en/verianalizi) domain brings in real-time bidding models (XGBoost, LightGBM).

Marketing Mix Modeling in 2026 is the backbone of attribution. The Robyn framework moves that backbone into a production pipeline: weekly data from BigQuery, hyperparameter tuning via genetic algorithm, overfitting control through holdout validation, and decision-making via budget allocator. Saturation curves and adstock decay bind marketing spend to engineering discipline—prediction over promise, regression over intuition, confidence intervals over claims. Your next step: consolidate 2 years of weekly spend and revenue into BigQuery, deploy the Robyn container to Cloud Run, and present the first Pareto frontier to your CMO.