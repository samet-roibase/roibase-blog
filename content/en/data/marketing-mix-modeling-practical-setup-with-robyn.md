---
title: "Marketing Mix Modeling: Practical Setup with Robyn"
description: "Meta's Robyn framework for MMM implementation: saturation curves, adstock decay, holdout validation. R code and BigQuery integration included."
publishedAt: 2026-07-24
modifiedAt: 2026-07-24
category: data
i18nKey: data-005-2026-07
tags: [marketing-mix-modeling, robyn, attribution, data-science, bigquery]
readingTime: 8
author: Roibase
---

Attribution has been breaking down for three years. iOS 14.5, Consent Mode v2, the withdrawal of third-party cookies — all of it leaves the digital marketer facing the same question: which channel actually works? Marketing Mix Modeling (MMM) is the statistical answer that breaks cookie and pixel dependency, working instead with aggregate-level data. Meta's open-source Robyn framework transforms MMM from an academic exercise into a production-ready pipeline. This article provides concrete steps to set up Robyn from scratch, interpret saturation curves, adjust adstock decay parameters, and validate your model with holdout testing.

## What is MMM and why it's critical now

Marketing Mix Modeling explains the relationship between media spend and sales or conversions using regression-based statistics. It doesn't require user-level data — it works with weekly or daily aggregate metrics like total spend, impressions, and sales. The model calculates each channel's marginal contribution (incrementality) and shows which channels are entering saturation.

Classic last-click attribution is pixel-based — it credits the last channel the user clicked. MMM observes all channels in the same time window, isolating correlation. For example, if TV ads show a 3-week lag before driving sales (carryover effect), the model captures this lag through an "adstock" parameter. The saturation curve shows diminishing returns: the first 100,000 TL in spend may drive 50 conversions, while the next 100,000 TL drives only 20.

Robyn packages this mathematical framework as an R package, trained on Meta's own campaign data. It includes Bayesian ridge regression, multi-objective evolutionary algorithm (MOEA) for hyperparameter tuning, and Nevergrad optimization. Setup isn't manual — after data preparation, 50 lines of R code generates your model.

## Data preparation: BigQuery to Robyn

Robyn expects a single CSV or data.frame as input. Each row is a time period (week or day), each column is a channel spend, impression count, or sales metric. It won't tolerate missing data — if empty cells exist, you'll need to impute them. Here's the minimum schema:

| date       | tv_spend | fb_spend | google_spend | revenue | control_var |
|------------|----------|----------|--------------|---------|-------------|
| 2024-01-01 | 50000    | 12000    | 8000         | 120000  | 0.8         |
| 2024-01-08 | 55000    | 13000    | 9000         | 135000  | 0.9         |

To pull this data from BigQuery with weekly aggregation:

```sql
SELECT
  DATE_TRUNC(event_date, WEEK) AS date,
  SUM(IF(channel = 'tv', spend, 0)) AS tv_spend,
  SUM(IF(channel = 'facebook', spend, 0)) AS fb_spend,
  SUM(IF(channel = 'google', spend, 0)) AS google_spend,
  SUM(revenue) AS revenue,
  AVG(seasonality_index) AS control_var
FROM `project.dataset.marketing_events`
WHERE event_date BETWEEN '2022-01-01' AND '2024-12-31'
GROUP BY 1
ORDER BY 1
```

A control variable (trend, seasonality, macroeconomic indicator) isn't mandatory but increases the model's explanatory power. For example, in retail, January is discount month — add a dummy variable. Robyn incorporates these variables into regression as "organic" baseline components.

To load data into R, use the `bigrquery` package:

```r
library(bigrquery)
bq_auth(path = "service-account-key.json")
sql <- "SELECT date, tv_spend, fb_spend, google_spend, revenue FROM ..."
df <- bq_project_query("your-project-id", sql) %>% bq_table_download()
```

Use the `robyn_inputs()` function for schema validation. The date column must be Date class, metrics must be numeric.

## Robyn model configuration: adstock and saturation

Robyn's core lies in the `robyn_inputs()` and `robyn_run()` functions. The first step is defining model inputs:

```r
library(Robyn)

InputCollect <- robyn_inputs(
  dt_input = df,
  date_var = "date",
  dep_var = "revenue",
  dep_var_type = "revenue",
  prophet_vars = c("trend", "season", "holiday"),
  prophet_country = "TR",
  paid_media_spends = c("tv_spend", "fb_spend", "google_spend"),
  paid_media_vars = c("tv_spend", "fb_spend", "google_spend"),
  context_vars = c("control_var"),
  adstock = "geometric",
  window_start = "2022-01-01",
  window_end = "2024-10-31"
)
```

**Choosing adstock type:**
- `geometric`: Most common. Constant decay rate (e.g., 80% remains each week). Suited for TV and display.
- `weibull`: Asymmetric decay — fast drop initially, then slow. Works for video and influencer campaigns.

The geometric adstock formula:

```
transformed_value[t] = spend[t] + theta * transformed_value[t-1]
```

`theta` is the decay rate (0-1 range). Robyn optimizes this automatically, but you can set manual ranges:

```r
hyperparameters <- list(
  tv_spend_alphas = c(0.5, 3),       # saturation curve coefficient
  tv_spend_gammas = c(0.3, 1),       # saturation inflection point
  tv_spend_thetas = c(0, 0.5),       # adstock decay rate
  fb_spend_alphas = c(0.5, 3),
  fb_spend_gammas = c(0.3, 1),
  fb_spend_thetas = c(0, 0.3)
)

InputCollect <- robyn_inputs(
  InputCollect = InputCollect,
  hyperparameters = hyperparameters
)
```

**Saturation parameters:**
- `alpha`: Curve shape. High alpha → late saturation.
- `gamma`: Inflection point — 0.5 means the bend occurs at the midpoint.

Saturation via Hill equation:

```
response = spend^alpha / (gamma^alpha + spend^alpha)
```

Robyn optimizes these parameters using an evolutionary algorithm, generating 2,000 models and selecting the best trade-offs from the Pareto frontier (R² vs NRMSE balance).

## Running the model and interpreting results

To run the Robyn model:

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  cores = 8
)
```

The output is a list — each iteration represents a different hyperparameter set. Robyn automatically selects the best 3 models (Pareto optimal). Results include:

```r
OutputModels$resultHypParam    # parameters for all models
OutputModels$xDecompAgg        # channel-level contribution decomposition
OutputModels$resultCalibration # holdout validation scores
```

**Example decomposition table:**

| channel      | total_spend | total_response | roi   | mean_response |
|--------------|-------------|----------------|-------|---------------|
| tv_spend     | 2400000     | 1800000        | 0.75  | 15000         |
| fb_spend     | 600000      | 720000         | 1.20  | 6000          |
| google_spend | 400000      | 560000         | 1.40  | 4667          |

**ROI interpretation:** Facebook 1.20 — each 1 TL spent generates 1.20 TL return. TV 0.75 — not negative ROI, but 0.75 TL incremental contribution above baseline. Robyn measures incrementality, not last-click credit.

**Saturation detection:** Robyn plots the saturation curve:

```r
robyn_onepagers(InputCollect, OutputModels, select_model = "2_100_3")
```

In the plot, watch where the curve flattens as spend increases. For example, if TV spend beyond 80,000 TL shows 50% lower marginal gains — that's a critical signal for budget optimization.

## Holdout validation and model reliability

For an MMM model to be production-ready, split historical data: training set (e.g., Jan 2022–Oct 2024) + holdout set (Nov–Dec 2024). The model trains on the training set and tests on the holdout. If MAPE (mean absolute percentage error) is under 10%, the model is reliable.

Robyn handles holdout validation automatically:

```r
InputCollect <- robyn_inputs(
  InputCollect = InputCollect,
  window_start = "2022-01-01",
  window_end = "2024-10-31",
  rollingWindowStartWhich = 52,  # last 52 weeks as holdout
  rollingWindowEndWhich = 4
)
```

Results appear in the `resultCalibration` table:

| model_id  | nrmse_train | nrmse_val | decomp.rssd |
|-----------|-------------|-----------|-------------|
| 2_100_3   | 0.08        | 0.12      | 0.05        |

**NRMSE (normalized root mean squared error):** Lower is better. 0.12 is acceptable (anything below 0.15 is production-ready).
**decomp.rssd:** Consistency of decomposition between training and validation. 0.05 → 5% deviation → stable model.

If holdout validation fails, two possibilities: (1) Insufficient data — MMM requires at least 2 years of weekly data. (2) Missing variables — add seasonality, competitor spend, price changes, or other confounding variables.

## Connecting Robyn output to decision-making

Export the decomposition table as CSV and reload into BigQuery:

```r
write.csv(OutputModels$xDecompAgg, "robyn_output.csv")
```

Load into BigQuery:

```sql
LOAD DATA OVERWRITE `project.dataset.mmm_results`
FROM FILES (
  format = 'CSV',
  uris = ['gs://bucket/robyn_output.csv']
);
```

This table connects to your dashboard (Looker, Tableau) or budget optimizer. Use a dbt model to calculate saturation thresholds:

```sql
WITH saturation AS (
  SELECT
    channel,
    total_spend,
    roi,
    total_spend / NULLIF(roi, 0) AS optimal_spend
  FROM `project.dataset.mmm_results`
)
SELECT * FROM saturation WHERE roi > 1.0 ORDER BY roi DESC;
```

This query ranks channels by ROI > 1 — a priority list for budget increases. Robyn also has a budget allocator function:

```r
AllocatorCollect <- robyn_allocator(
  InputCollect = InputCollect,
  OutputCollect = OutputModels,
  select_model = "2_100_3",
  scenario = "max_response",
  channel_constr_low = c(0.7, 0.7, 0.7),
  channel_constr_up = c(1.5, 1.5, 1.5)
)
```

The output recommends new budget allocation per channel. Constraints ensure spend stays between 70–150% of current levels (mitigating operational risk from sudden changes).

Setting up [first-party data and measurement architecture](https://www.roibase.com.tr/en/firstparty) is critical for MMM. Data quality fed into Robyn directly affects model reliability. Server-side event tracking, identity resolution, and Consent Mode integration gaps create bias at the aggregation level.

## Common pitfalls and mitigation

**Multicollinearity:** If two channels always run together (e.g., TV + Facebook always simultaneous), the model can't separate their contributions. Check the Variance Inflation Factor (VIF):

```r
library(car)
vif_model <- lm(revenue ~ tv_spend + fb_spend + google_spend, data = df)
vif(vif_model)
```

VIF > 5 → problem. Solutions: (1) Temporarily pause one channel for a holdout test. (2) Collect longer time series.

**Lag timing uncertainty:** Incorrect adstock parameter (e.g., 4 weeks for TV instead of 1 week) produces misleading results. Validate true decay duration with A/B tests or geo-experiments. Meta's GeoLift package does this.

**Missing seasonality control:** If Prophet components (trend, season, holiday) aren't added to the model, January sales spikes can be wrongly attributed to media (when it's actually holiday promotions). Always enable Prophet:

```r
InputCollect <- robyn_inputs(
  InputCollect = InputCollect,
  prophet_vars = c("trend", "season", "holiday"),
  prophet_country = "TR"
)
```

**Model drift:** As market dynamics shift (new competitors, price changes, platform algorithm updates), the model becomes stale. Refresh quarterly — retrain on the last 2 years of data. Version control models with Robyn's `json_file` parameter:

```r
robyn_write(InputCollect, OutputModels, dir = "./robyn_models/")
```

Git commit each model version for A/B testing reference.

MMM alone isn't sufficient. Validate with incrementality tests (geo-experiments, PSA holdouts). Robyn output is prediction — tested reality is truth. Using both together anchors attribution in engineering discipline.