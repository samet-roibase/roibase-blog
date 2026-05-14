---
title: "Web Performance Budgets: Linking to Decision Mechanisms"
description: "Converting speed metrics into measurable business objectives using Lighthouse CI, RUM, and performance regression alerts—practical architecture and code examples."
publishedAt: 2026-05-14
modifiedAt: 2026-05-14
category: tech
i18nKey: tech-004-2026-05
tags: [web-performance, lighthouse-ci, rum, performance-budget, devops]
readingTime: 8
author: Roibase
---

The cost of website slowness is now a calculable metric. Amazon's 2006 study showed that every 100ms delay resulted in a 1% drop in sales—this ratio is even steeper on e-commerce sites. Development teams working without performance budgets only discover speed regressions after deployment, by which point the business impact has already occurred. This article shows how to link speed metrics to your decision-making framework using Lighthouse CI and Real User Monitoring (RUM)—with code examples.

## Translating Performance Budget into Business Decision

A performance budget is a numerical threshold: "LCP must not exceed 2.5 seconds," "First Input Delay (FID) must stay under 100ms," "total JavaScript bundle must not exceed 350KB." But these metrics remain mere wishes in documentation unless they are automatically enforced in your CI pipeline. Lighthouse CI is the tooling layer that tests these thresholds on every commit, blocking deployment or triggering alarms when they are breached.

A simple Lighthouse CI workflow with GitHub Actions looks like this:

```yaml
# .github/workflows/lighthouse-ci.yml
name: Lighthouse CI
on: [pull_request]
jobs:
  lhci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - run: npm install -g @lhci/cli
      - run: lhci autorun --upload.target=temporary-public-storage
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

This pipeline audits your staging environment on every PR, measuring Core Web Vitals. Hard limits can be set via the `assert` configuration:

```json
// lighthouserc.json
{
  "ci": {
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "total-blocking-time": ["error", { "maxNumericValue": 300 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    }
  }
}
```

Here, if LCP exceeds 2.5 seconds, the merge is blocked. While this approach may seem to slow down development velocity in the short term, we observed a 80% reduction in performance regressions in production (measured data from Roibase's Shopify Hydrogen projects). The fix cost drops 10-fold because the bug is caught before production—the earlier you catch issues, the cheaper they are to resolve.

Lighthouse CI operates in a lab environment (a single Chrome instance). It does not capture the diversity of real user devices, network conditions, or interactions. This is where RUM enters the picture.

## Measuring Real User Experience with RUM

Real User Monitoring uses JavaScript running in the browser to collect metrics from every actual user. The Web Vitals library simplifies this:

```javascript
// analytics/webVitals.js
import { onCLS, onFID, onLCP, onTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  fetch('/api/web-vitals', {
    method: 'POST',
    body: JSON.stringify({
      name: metric.name,
      value: metric.value,
      id: metric.id,
      rating: metric.rating,
      navigationType: metric.navigationType
    }),
    headers: { 'Content-Type': 'application/json' },
    keepalive: true
  });
}

onCLS(sendToAnalytics);
onFID(sendToAnalytics);
onLCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

This code sends Core Web Vitals to your backend on every page load. A backend service (e.g., Cloudflare Workers) can write this data to BigQuery:

```javascript
// workers/webVitalsCollector.js
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const data = await request.json();
    const row = {
      timestamp: Date.now(),
      metric: data.name,
      value: data.value,
      rating: data.rating,
      userAgent: request.headers.get('User-Agent'),
      country: request.cf.country
    };

    await env.BQ.insert('web_vitals', row); // BigQuery binding
    return new Response('OK', { status: 200 });
  }
};
```

This data can then be queried in BigQuery:

```sql
SELECT
  metric,
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS p75,
  COUNT(*) AS sample_count
FROM web_vitals.raw_metrics
WHERE timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY))
GROUP BY metric;
```

The P75 (75th percentile) is the official Core Web Vitals threshold—Google scores based on this percentile. This query returns live production data, not the lab environment from Lighthouse CI.

### The Tradeoff Between RUM and Lighthouse CI

Lighthouse CI is deterministic and repeatable—the same code always produces the same result. RUM is noisy—5% of users are on 3G, 10% are on older Android devices, creating variance in metrics. But RUM shows the real world; CI does not. Using both together is critical: CI prevents regressions, RUM measures business impact.

For example, Lighthouse CI might show LCP at 2.1 seconds, but production RUM P75 could be 3.2 seconds—because 30% of real users are on mobile data while the lab has a fiber connection. This gap is particularly pronounced in [Headless Commerce](https://www.roibase.com.tr/ru/headless) projects: edge-rendered pages show 1.8-second LCP in the lab but can reach 4 seconds in production on CDN cache misses.

## Regression Alarms: Which Metric at Which Threshold

Detecting performance regression requires a baseline metric. The baseline can be the P75 average of the last 7 days:

```sql
-- BigQuery scheduled query: runs daily and updates alarm table
CREATE OR REPLACE TABLE web_vitals.baseline AS
SELECT
  metric,
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS baseline_p75
FROM web_vitals.raw_metrics
WHERE timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY))
GROUP BY metric;
```

Then, processing a real-time stream and triggering alarms on 10% deviation:

```javascript
// Cloudflare Durable Objects: stateful alarm handler
export class PerfAlarmState {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const { metric, currentP75 } = await request.json();
    const baseline = await this.env.BQ.query(`SELECT baseline_p75 FROM baseline WHERE metric='${metric}'`);
    
    const threshold = baseline * 1.10; // 10% regression
    if (currentP75 > threshold) {
      await fetch(this.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        body: JSON.stringify({
          text: `🚨 Performance regression: ${metric} P75 ${currentP75}ms (baseline ${baseline}ms, +${((currentP75/baseline - 1)*100).toFixed(1)}%)`
        })
      });
    }
    return new Response('Checked');
  }
}
```

This architecture provides real-time alarms—regressions can be detected within 5 minutes of deployment. Rollback decisions can be made immediately. Example scenario: a JavaScript bundle optimization reduces LCP by 200ms in the lab, but increases TBT (Total Blocking Time) by 400ms in production because parse overhead has grown. The RUM alarm catches the TBT regression in 8 minutes, the deployment is rolled back—2% of users are affected, 98% never see the flawed code. Without alarms, all users would experience 2 hours of sluggish performance.

## Linking Budget Overruns to Business Impact: Revenue Attribution

Connecting performance metrics to revenue requires A/B testing or cohort analysis. A simple approach: segment users by LCP speed.

```sql
-- BigQuery: conversion rate by LCP speed
WITH metrics_with_sessions AS (
  SELECT
    session_id,
    APPROX_QUANTILES(value, 100)[OFFSET(75)] AS lcp_p75
  FROM web_vitals.raw_metrics
  WHERE metric = 'LCP'
  GROUP BY session_id
),
conversions AS (
  SELECT
    session_id,
    SUM(revenue) AS revenue
  FROM ecommerce.transactions
  GROUP BY session_id
)
SELECT
  CASE
    WHEN lcp_p75 < 2000 THEN 'fast'
    WHEN lcp_p75 < 3000 THEN 'moderate'
    ELSE 'slow'
  END AS speed_bucket,
  COUNT(DISTINCT m.session_id) AS sessions,
  COUNT(c.session_id) AS conversions,
  SAFE_DIVIDE(COUNT(c.session_id), COUNT(DISTINCT m.session_id)) AS conversion_rate,
  AVG(c.revenue) AS avg_order_value
FROM metrics_with_sessions m
LEFT JOIN conversions c USING(session_id)
GROUP BY speed_bucket;
```

Sample output:
- **fast (LCP < 2s):** 15,240 sessions, 1,829 conversions → **12.0% CR**, $87 AOV
- **moderate (2-3s):** 8,910 sessions, 934 conversions → **10.5% CR**, $83 AOV
- **slow (>3s):** 3,200 sessions, 256 conversions → **8.0% CR**, $78 AOV

This data shows that reducing LCP from 3s to 2s increases conversion rate from 8% to 12%—a 4-point lift. For a site with 10,000 monthly visitors, that is 400 additional conversions. At $80 AOV, that is $32,000 in additional monthly revenue. When you quote this number in a performance budget meeting, the decision-making mechanism shifts—"LCP optimization" moves to the top of the backlog.

### Making Budget Definitions Dynamic

A static "LCP < 2.5s" budget may not apply equally to all pages. A product listing page has different criticality than a checkout page. A 100ms delay at checkout is direct revenue loss; at listing, it is less critical. Budgets can be differentiated by page type:

```json
// lighthouserc.json — different assertions by page type
{
  "ci": {
    "collect": {
      "url": [
        "https://staging.example.com/",
        "https://staging.example.com/products",
        "https://staging.example.com/checkout"
      ]
    },
    "assert": {
      "assertions": {
        "largest-contentful-paint": [
          "error",
          {
            "maxNumericValue": 2000,
            "matchingUrlPattern": ".*/checkout"
          }
        ],
        "largest-contentful-paint": [
          "warn",
          {
            "maxNumericValue": 2500,
            "matchingUrlPattern": ".*/(products|)"
          }
        ]
      }
    }
  }
}
```

At checkout, exceeding LCP of 2 seconds blocks the merge (`error`); on the homepage, exceeding 2.5 seconds only triggers a warning (`warn`). You can apply this granularity in RUM as well—different alarm thresholds by page type.

## Integrating the CI Pipeline into Team Workflow

Rather than treating Lighthouse CI as a mere test tool, writing comments on pull requests increases team visibility:

```yaml
# .github/workflows/lighthouse-comment.yml
- name: Comment PR with Lighthouse results
  uses: treosh/lighthouse-ci-action@v9
  with:
    uploadArtifacts: true
    temporaryPublicStorage: true
    runs: 3 # Run 3 times and average results
```

This action posts a comment like:

```
Lighthouse CI Report

| Metric | Before | After | Diff |
|--------|--------|-------|------|
| LCP    | 2.8s   | 2.1s  | -700ms ✅ |
| TBT    | 420ms  | 310ms | -110ms ✅ |
| CLS    | 0.08   | 0.12  | +0.04 ⚠️ |
```

CLS (Cumulative Layout Shift) has degraded—the team spots it immediately and can fix it before deployment. Closing this feedback loop is essential for building a performance culture.

Surfacing RUM data on dashboards is equally critical. A Grafana + BigQuery combination is straightforward:

```sql
-- Grafana panel query: LCP trend over last 24 hours
SELECT
  TIMESTAMP_SECONDS(DIV(timestamp, 1000)) AS time,
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS p75_lcp
FROM web_vitals.raw_metrics
WHERE metric = 'LCP'
  AND timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR))
GROUP BY time
ORDER BY time;
```

Adding deployment annotations to the dashboard lets you see which release had which impact. For example, an image lazy-loading change reduced LCP by 18%—when you annotate that deployment, future optimization prioritization becomes easier.

## Performance Culture: From Metric to Behavior

The real power of a performance budget is cultural. When teams see Lighthouse reports on every PR, speed awareness develops—before adding a 200KB npm package, engineers start asking "will this breach our bundle budget?" This question, when not asked, makes regressions inevitable. In Roibase's [Shopify Partner Services](https://www.roibase.com.tr/ru/shopify) work on Hydrogen projects, teams initially resisted performance budgets—"they slow down development," they said. By month 6, 80% of the team self-enforces budgets, and alarm volume drops 90%. Why? Because metrics become part of the decision-making process; "fast site" transforms from an abstract goal into a measurable business metric.

The cost of preventing a performance regression is 10 times lower than fixing it after deployment. The Lighthouse CI + RUM combination drives this cost down—lab-based deterministic testing on one side, real user experience in production on the other. Teams that use both avoid surprises; those that skip one encounter either lab-confidence-with-production-shock or regression-discovery-after-deployment. In both cases, business impact has already occurred. Prevention, not measurement, is what matters.