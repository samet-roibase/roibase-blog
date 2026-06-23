---
title: "Web Performance Budgets: Linking to Decision Mechanisms"
description: "Integrating Lighthouse CI, RUM, and perf regression alarms into your system. The methodology behind dropping TBT from 2190ms to 200ms."
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: tech
i18nKey: tech-004-2026-06
tags: [web-performance, lighthouse-ci, rum, core-web-vitals, performance-budget]
readingTime: 8
author: Roibase
---

In 2026, web performance is no longer about "making pages fast"—it's an engineering discipline built on continuous decision-making. You deploy an e-commerce site, Lighthouse score drops from 92 to 68, conversion rate falls from 3.2% to 2.7%—but nobody notices because monitoring stops at "is the server down?" Linking performance budgets to your decision mechanism means catching regressions before deploy, evaluating every commit against LCP/TBT/CLS thresholds, and feeding RUM data into your attribution pipeline. This post shows how to transform Lighthouse CI, synthetic monitoring, RUM, and alarm architecture into an integrated system.

## What Is a Performance Budget and Why a System, Not a Human, Should Measure It

A performance budget defines numeric thresholds for resource limits per page: maximum JavaScript bundle size (e.g., 200 KB gzip), maximum TBT (Total Blocking Time, 200 ms), maximum LCP (Largest Contentful Paint, 2.5 seconds). These numbers aren't arbitrary—Google's Core Web Vitals define the "good" band, but you need to derive sharper limits from your own sector's conversion funnel data.

The classic scenario—"Lighthouse 95 in dev, 72 in prod"—stems from this: synthetic tests run in lab conditions (fast 4G, empty cache, single page load), while RUM measures the real user's 3G, full cache, and navigation paths. The gap is normal but both must be monitored. Lighthouse CI catches bundle size regression on every PR; RUM reveals "22% of mobile users hit 4-second LCP" production reality. If you define budget only as "exceed 75 score," you can add 100 KB to the bundle and bump the score from 74 to 76—the page gets heavier but the score turns green. That's why you must enforce budget *metric-based* (LCP, TBT, CLS) *and* *resource-based* (JS, CSS, image MB) in parallel.

Another point: enforcing budget via human review doesn't scale. "We review performance in code review" fails at 20 PRs/day velocity. The system must measure, the system must fail, humans investigate the why.

## Gating Commits with Lighthouse CI

Lighthouse CI runs a Lighthouse audit on every commit or PR, reporting results to GitHub or an internal dashboard. Integrate it into your CI pipeline like this:

```yaml
# .github/workflows/lighthouse-ci.yml
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci && npm run build
      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

Define budgets in `.lighthouserc.json`:

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/"],
      "numberOfRuns": 3
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "total-byte-weight": ["error", { "maxNumericValue": 512000 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "categories:performance": ["error", { "minScore": 0.85 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

With this setup, if a PR adds 50 KB of extra JS and TBT exceeds 200 ms, CI fails and merge blocks. At Roibase, managing projects transitioning to [Headless Commerce](https://www.roibase.com.tr/en/headless) architecture, we used this approach to drop median TBT from 2190 ms to 200 ms—because every library addition was tested against the budget.

### Lighthouse CI Limitations and Structural Decisions

Lighthouse CI runs synthetic tests: fixed bandwidth (Moto G4, slow 4G emulation), fixed CPU throttle (4x slowdown), single page. Real users navigate differently, traverse different paths (product → cart → checkout), see A/B variants. Position Lighthouse CI as the *minimum bar*—if it passes, deployment is safe; but passing doesn't guarantee 100 points in production. Measure true production reality with RUM.

## Converting Production Reality to Decision Data with RUM

RUM (Real User Monitoring) collects metrics from actual users: Navigation Timing API, PerformanceObserver, CrUX (Chrome User Experience Report). Use a vendor (Speedcurve, Sentry Performance, Cloudflare Web Analytics) or your own logging stack (web-vitals library + BigQuery).

A minimal `web-vitals` integration:

```javascript
// app.js
import { onCLS, onFID, onLCP, onTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    navigationType: metric.navigationType,
    page: window.location.pathname,
    deviceType: /mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
  });
  
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', body);
  } else {
    fetch('/api/vitals', { method: 'POST', body, keepalive: true });
  }
}

onCLS(sendToAnalytics);
onFID(sendToAnalytics);
onLCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

Load this data into BigQuery, then join it with marketing attribution data using dbt:

```sql
-- models/performance_impact.sql
WITH vitals AS (
  SELECT
    session_id,
    AVG(CASE WHEN metric_name = 'LCP' THEN value END) AS avg_lcp,
    AVG(CASE WHEN metric_name = 'CLS' THEN value END) AS avg_cls
  FROM {{ ref('raw_vitals') }}
  GROUP BY session_id
),
conversions AS (
  SELECT session_id, revenue, converted
  FROM {{ ref('ga4_sessions') }}
)
SELECT
  CASE
    WHEN v.avg_lcp <= 2500 THEN 'good'
    WHEN v.avg_lcp <= 4000 THEN 'needs_improvement'
    ELSE 'poor'
  END AS lcp_band,
  COUNT(*) AS sessions,
  SUM(c.converted) AS conversions,
  SAFE_DIVIDE(SUM(c.converted), COUNT(*)) AS cvr
FROM vitals v
LEFT JOIN conversions c USING(session_id)
GROUP BY lcp_band;
```

This table shows: "When LCP ≤ 2.5s, CVR is 3.4%; when LCP exceeds that, CVR drops to 2.1%." When you report this to your CMO, the vague "let's optimize performance" becomes concrete: "Bringing LCP under 2.5s nets +$18K monthly revenue."

## Wiring Regression Alarms to Slack/PagerDuty

Once you're collecting RUM data, set up threshold alarms to detect regressions. If your 7-day average LCP was 2.2 seconds and today it spiked to 3.1 seconds, that's a deploy regression or CDN issue. Don't catch this via manual dashboard polling—automate it.

### Metric-Based Alerting with DataDog

DataDog auto-parses RUM metrics and applies anomaly detection. Sample monitor:

```json
{
  "name": "LCP Regression - Desktop",
  "type": "metric alert",
  "query": "avg(last_1h):avg:rum.largest_contentful_paint{device:desktop} > 2500",
  "message": "LCP desktop exceeded 2500ms in last 1h. Last deploy: {{deploy.id}}. @slack-perf-alerts @pagerduty",
  "tags": ["service:ecommerce", "env:production"],
  "thresholds": {
    "critical": 2500,
    "warning": 2200
  }
}
```

This alert drops into Slack, opens a PagerDuty incident, and pages the on-call engineer. With deploy ID in the message (sourced from CI pipeline tags), you pinpoint the regressive commit in 30 seconds.

### Relay Lighthouse CI Threshold Failures as Alarms Too

Some teams don't just block PR merges on Lighthouse CI failures—they also notify Slack:

```yaml
# .github/workflows/lighthouse-ci.yml (additional step)
- name: Notify Slack on Failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "Lighthouse CI FAILED on PR #${{ github.event.pull_request.number }}",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Performance budget exceeded*\nPR: <${{ github.event.pull_request.html_url }}|#${{ github.event.pull_request.number }}>\nBranch: `${{ github.head_ref }}`"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_PERF }}
```

Now when an engineer opens a PR and budget is exceeded, they get both a red CI check *and* a Slack notification—attention grabs immediately.

## Wiring Budgets into Your Feature Flag System

Some features are inherently heavy: live chat widget (80 KB JS), personalization engine (150 KB + runtime), video player (200 KB). Instead of rolling out to all users and blowing the budget, test within a segment (e.g., desktop + fast connection) then gate rollout.

In LaunchDarkly or your custom feature flag system:

```javascript
// featureFlags.js
import { getConnectionSpeed } from './utils';

export function shouldEnableChatWidget(user, vitals) {
  const is4G = getConnectionSpeed() === '4g';
  const goodLCP = vitals.lcp < 2000;
  
  return is4G && goodLCP && user.tier === 'premium';
}
```

This way, "let's add a chat widget" doesn't mean "all users' LCP jumps 300 ms"—it rolls out only to qualifying segments, you collect RUM, measure CVR impact, then decide on full rollout or rollback. When discussing the tradeoff with product and marketing, you show numbers: "Chat widget increases CVR by 0.4% but pushes LCP to 2.8s—net +$8K/month but UX dips. Next steps?"

## Enforcing Performance Budgets in Headless Commerce

Headless commerce (e.g., Shopify Hydrogen, Next.js + Shopify API) typically beats Liquid themes because you control client-side JavaScript and can do selective hydration. But control in your hands means regression risk in your hands too—a single npm package bump could add 70 KB to the bundle.

Within Roibase's [Shopify services](https://www.roibase.com.tr/en/shopify), we apply this workflow for headless migrations:

1. **Establish baseline:** Collect 30 days of RUM data from the existing Liquid theme. Record median LCP, TBT, CLS.
2. **Gate headless prototype with Lighthouse CI:** Every commit must meet `.lighthouserc.json` budget. First deploy must be 20% faster than baseline.
3. **Production RUM comparison:** For the first 7 days, A/B test old vs. new (e.g., 10% traffic to headless), compare RUM metrics.
4. **Set regression alarms:** Post-migration, pin DataDog monitors: LCP ≤ 2.5s, TBT ≤ 200ms.
5. **Quarterly audits:** Every quarter, audit bundle size, prune unused dependencies.

One e-commerce client saw: Liquid LCP 4.1s → Hydrogen LCP 1.8s, CVR 2.3% → 3.1% (+35%). Six months later, new features pushed LCP to 2.9s and CVR back to 2.9%—budget enforcement had lapsed. After re-activating, 2 weeks brought it back to 2.1s.

## The Tradeoff: Speed vs. Rich Experience

Sometimes marketing asks: "The page is fast but sparse—let's add more content." This creates a speed-vs-engagement tradeoff. Use numbers to decide: "Adding a carousel raises LCP 300ms, engagement +12%, CVR unchanged—net positive?"

Framework example:

| Feature | LCP Delta (ms) | Engagement Delta (%) | CVR Delta (%) | Net Revenue Impact |
|---|---|---|---|---|
| Hero carousel | +320 | +12 | 0 | Neutral |
| Product video | +180 | +8 | +0.3 | +$12K/mo |
| Live chat widget | +280 | +4 | +0.4 | +$18K/mo |
| Related products (lazy) | +40 | +6 | +0.2 | +$9K/mo |

Share this table with product and marketing. The decision—"video and chat ship, carousel shelved"—becomes self-evident.

---

Linking performance budgets to your decision mechanism transforms "let's make pages fast" abstraction into "every commit that raises LCP 100ms fails CI, every regression hits Slack in <10min, every feature decision uses CVR and LCP delta data" concreteness. Lighthouse CI, RUM, alarm systems, and feature flag integration are the building blocks. Now: create `.lighthouserc.json`, add it to CI, and set up your first regression alarm. When the first budget fail triggers, you'll realize how late you've been.