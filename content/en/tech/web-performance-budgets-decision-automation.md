---
title: "Web Performance Budgets: Connecting to Your Decision Pipeline"
description: "Integrate Lighthouse CI, RUM, and perf regression alarms into CI/CD to stop slowdowns at deploy time — real-world scenarios with code."
publishedAt: 2026-07-30
modifiedAt: 2026-07-30
category: tech
i18nKey: tech-004-2026-07
tags: [web-performance, lighthouse-ci, rum, performance-budget, core-web-vitals]
readingTime: 7
author: Roibase
---

Discovering a performance regression after it hits production is like discovering exchange rates after the trade closes. According to Google's 2026 Commerce Signals report, every extra 100ms of LCP drives a 3.5% bounce increase. Just as we catch bugs in the pre-deployment phase, we need to catch slowdowns in the CI/CD pipeline itself. This post shows how to integrate Lighthouse CI, RUM, synthetic monitoring, and performance budgets—and how to stop a deploy cold—with real code and numbers.

## What Is a Performance Budget, and Why It Belongs in CI/CD

A performance budget is the ceiling on how much a page can spend on resources. Example: "Homepage LCP < 2s, Total Blocking Time < 200ms, JS bundle < 400KB." It works like an SLA: if any number is exceeded, the build fails and deploy is blocked.

The old way—running Lighthouse manually after each sprint and reviewing the report—meant catching regressions two weeks late. Modern teams embed the budget in CI. Every pull request runs Lighthouse CI on a headless Chromium instance, measures performance metrics, and compares against the budget. If the budget breaks, the GitHub Action fails and the PR won't merge.

Consider this scenario: a product recommendation widget is added to a Shopify Hydrogen storefront, and the bundle balloons from 340KB to 510KB. The CI pipeline catches it instantly and turns the PR red. The widget stays blocked until it's optimized with lazy-loading. In the old flow, 510KB ships to production—that's an extra 4s of blocking time on 3G mobile—and two days of lost revenue are gone.

We'll use `lighthouse-ci` to enforce performance budgets. Lighthouse CI takes a deployment preview URL, renders it in Chromium, measures Core Web Vitals and custom metrics, and compares them to your budget file.

```json
// lighthouserc.json
{
  "ci": {
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2000 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "speed-index": ["error", { "maxNumericValue": 3000 }],
        "resource-summary:script:size": ["error", { "maxNumericValue": 400000 }]
      }
    },
    "collect": {
      "numberOfRuns": 3,
      "url": ["https://preview-{PR_NUMBER}.vercel.app"],
      "settings": {
        "throttling": {
          "rttMs": 150,
          "throughputKbps": 1638.4,
          "cpuSlowdownMultiplier": 4
        }
      }
    }
  }
}
```

`numberOfRuns: 3` reduces variability—the median is used. `throttling` simulates mobile 3G conditions, which represents the worst-case real user scenario.

## Automating Lighthouse CI with GitHub Actions

To run Lighthouse in the CI pipeline, we pair Vercel preview deployments with GitHub Actions. Each PR creates an automatic preview URL that Lighthouse CI scans. Results post as a GitHub PR comment. If the budget breaks, CI fails.

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - name: Wait for Vercel Preview
        uses: patrickedqvist/wait-for-vercel-preview@v1.3.1
        id: vercel_preview
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          max_timeout: 300
      - name: Run Lighthouse CI
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_TOKEN }}
        run: |
          npm install -g @lhci/cli
          lhci autorun --collect.url=${{ steps.vercel_preview.outputs.url }}
      - name: Comment PR
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: ${{ steps.vercel_preview.outputs.url }}
          uploadArtifacts: true
          temporaryPublicStorage: true
```

The `wait-for-vercel-preview` step is critical: if Lighthouse runs before the deployment finishes, it sees a 404. With `max_timeout: 300`, we wait up to 5 minutes. Once deployment is ready, Lighthouse starts.

The result comments on the PR like this:

```
Lighthouse CI Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Performance: 92/100 (+2)
❌ LCP: 2.3s (budget: 2.0s) — FAILED
✅ TBT: 180ms (budget: 200ms)
✅ CLS: 0.08 (budget: 0.1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

LCP at 2.3s broke the budget, so CI failed. The PR can't merge. The dev sees the hero image wasn't lazy-loaded, fixes it with `loading="eager"`, CI re-runs, and LCP drops to 1.9s—merge is green.

This approach is critical for [Headless Commerce](https://www.roibase.com.tr/en/headless) projects. Hydrogen or Next.js Commerce storefronts add new components daily. A single unwrapped `await fetch()` blocks the main thread. Lighthouse CI catches it via bundle size and TBT.

## Tracking Real Numbers in Production with Real User Monitoring

Lighthouse CI runs synthetic monitoring in a lab. Real users have different devices, networks, and cache states. That's why RUM (Real User Monitoring) is essential. RUM collects actual metric streams from your live site.

Use the Web Vitals library to send RUM to your backend:

```typescript
// analytics/web-vitals.ts
import { onCLS, onFID, onLCP, onTTFB, onINP } from 'web-vitals';

function sendToAnalytics(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: Date.now()
  });

  // Beacon API — sends even if page closes
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', body);
  } else {
    fetch('/api/vitals', { method: 'POST', body, keepalive: true });
  }
}

onCLS(sendToAnalytics);
onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

Your backend `/api/vitals` endpoint writes this metric to BigQuery or Cloudflare Analytics. A daily aggregate report looks like:

| Date       | LCP p75 | INP p75 | CLS p75 | Page Views |
|------------|---------|---------|---------|------------|
| 2026-07-28 | 1.8s    | 140ms   | 0.06    | 12,400     |
| 2026-07-29 | 2.1s    | 180ms   | 0.09    | 13,100     |
| 2026-07-30 | 3.2s    | 320ms   | 0.14    | 11,800     |

A deploy happened on the 29th. LCP jumped from 2.1s to 3.2s, INP from 180ms to 320ms. Bounce rate climbed 4.2%. RUM showed this in production within 2 hours—but Lighthouse CI had measured under 2.0s in the lab because real users were on slower devices.

The rollback decision was made based on RUM numbers. The deployment was reverted, and LCP dropped back to 1.9s.

### RUM Alarm Pipeline

Just showing RUM metrics on a dashboard isn't enough. You need a Slack alarm when regression hits. Set up a scheduled query on BigQuery:

```sql
-- BigQuery scheduled query (hourly)
WITH current_hour AS (
  SELECT
    APPROX_QUANTILES(lcp_value, 100)[OFFSET(75)] AS lcp_p75,
    APPROX_QUANTILES(inp_value, 100)[OFFSET(75)] AS inp_p75
  FROM `project.dataset.web_vitals`
  WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
),
baseline AS (
  SELECT
    APPROX_QUANTILES(lcp_value, 100)[OFFSET(75)] AS lcp_p75_baseline
  FROM `project.dataset.web_vitals`
  WHERE timestamp BETWEEN TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 8 HOUR)
    AND TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR)
)
SELECT
  c.lcp_p75,
  b.lcp_p75_baseline,
  (c.lcp_p75 - b.lcp_p75_baseline) / b.lcp_p75_baseline * 100 AS lcp_regression_pct
FROM current_hour c, baseline b
WHERE (c.lcp_p75 - b.lcp_p75_baseline) / b.lcp_p75_baseline > 0.15
```

This query checks whether LCP p75 has degraded more than 15% from baseline. If it has, a Cloud Function is triggered and sends a Slack alert:

```
⚠️ Performance Regression Detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LCP p75: 3.2s (+68% vs 6h baseline)
Baseline: 1.9s
URL: /product/xyz
Deploy: #4521 (30 min ago)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Tradeoff: Synthetic vs RUM—Where Each Measurement Belongs

Lighthouse CI and RUM complement each other. You don't choose one or the other—you run both in parallel.

**Lighthouse CI (synthetic):**
- **Strength:** Controlled environment, reproducible, runs on every commit
- **Weakness:** Doesn't see real device variance or cached asset behavior
- **Use case:** CI pipeline regression prevention—"Will this PR risk slowdowns if merged?"

**RUM (real user):**
- **Strength:** Actual user data, captures edge cases (e.g., "iPhone 11 Safari hits 5s LCP")
- **Weakness:** Noisy data with many outliers, provides no pre-deployment signal
- **Use case:** Live monitoring—"Did the new deployment harm performance?"

A mature system uses both. Lighthouse CI blocks deploys that break budget. If it passes, RUM validates the real impact in 2 hours. If RUM shows regression, rollback.

Example: A new variant selector component is added to a Shopify storefront. Lighthouse CI reports 380ms TBT (budget: 200ms). The PR is rejected. The dev code-splits the component and adds lazy-loading. Lighthouse CI now shows 150ms TBT, so it merges. Four hours after going live, RUM shows INP p75 climbed from 120ms to 145ms—acceptable (budget: 200ms). The deployment stays.

## Wiring Regression Alarms into the Deployment Pipeline

If a RUM alarm fires independently of deployment, context is lost. You get "LCP degraded" but don't know which deploy caused it. So we inject deployment metadata into every RUM event.

Vercel and Netlify expose `VERCEL_GIT_COMMIT_SHA` as an environment variable. Inject it into the frontend so every RUM event carries it:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      deploymentId: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
      deploymentTime: Date.now()
    }
  }
});

// analytics/web-vitals.ts
function sendToAnalytics(metric: Metric) {
  const config = useRuntimeConfig();
  const body = JSON.stringify({
    ...metric,
    deploymentId: config.public.deploymentId,
    deploymentTime: config.public.deploymentTime
  });
  navigator.sendBeacon('/api/vitals', body);
}
```

Query BigQuery to correlate:

```sql
SELECT
  deployment_id,
  FROM_UNIXTIME(deployment_time / 1000) AS deployed_at,
  APPROX_QUANTILES(lcp_value, 100)[OFFSET(75)] AS lcp_p75,
  COUNT(*) AS sample_size
FROM `project.dataset.web_vitals`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
GROUP BY deployment_id, deployment_time
ORDER BY deployed_at DESC
```

Result:

| deployment_id | deployed_at         | lcp_p75 | sample_size |
|---------------|---------------------|---------|-------------|
| a3f2b19       | 2026-07-30 14:22:00 | 3.1s    | 2,340       |
| c8d4e21       | 2026-07-30 09:15:00 | 1.9s    | 4,120       |

After the 14:22 deployment, LCP jumped from 1.9s to 3.1s. Look up that commit SHA on GitHub, inspect the code. The issue: the hero image's `srcset` attribute was removed, so the browser fetches a 3MB image for 4K desktop. Rollback is triggered, and LCP drops back to 1.9s.

## Closing: Treat Performance Budget as an SLA—Test Before Shipping

Treat your performance budget like an SLA you've promised your customers. If you say "LCP under 2s," you must prove in your CI/CD pipeline that every deploy honors it. Lighthouse CI provides the number pre-deploy; RUM validates it post-deploy. Without both layers working together, regressions are either caught too late or missed entirely. As Google's ranking algorithm weights Core Web Vitals more heavily in 2026, a performance regression becomes an SEO regression. Set the budget, tie it to CI, configure alarms, and deploy.