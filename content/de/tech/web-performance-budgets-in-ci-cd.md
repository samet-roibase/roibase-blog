---
title: "Web Performance Budgets: An Entscheidungsmechanismus Integration"
description: "Lighthouse CI, RUM und Performance-Regressions-Alarme in CI/CD-Pipelines integrieren — Verlangsamung beim Deployment stoppen mit echten Szenarien."
publishedAt: 2026-07-30
modifiedAt: 2026-07-30
category: tech
i18nKey: tech-004-2026-07
tags: [web-performance, lighthouse-ci, rum, performance-budget, core-web-vitals]
readingTime: 9
author: Roibase
---

Performance-Regressionen nach dem Go-Live zu entdecken ist wie Wechselkurse nach dem Geschäft zu prüfen: Der Kurs ist bereits gefallen. Laut Googles Commerce-Signale-Report 2026 führt jede zusätzliche 100ms LCP zu 3,5% mehr Bounces. Bugs fangen wir im Deployment ab — genauso müssen wir Verlangsamungen in der CI/CD-Pipeline stoppen. Dieser Beitrag zeigt, wie man Lighthouse CI, RUM, Synthetic Monitoring und Performance Budgets integriert, um Deployments zu blockieren — mit Code und echten Zahlen.

## Was ist ein Performance Budget und warum gehört er in die CI/CD

Ein Performance Budget ist die Obergrenze für Ressourcenverbrauch einer Seite. Beispiel: „Homepage LCP < 2s, Total Blocking Time < 200ms, JS-Bundle < 400KB". Dies funktioniert wie ein SLA: Wenn eine Zahl überschritten wird, schlägt der Build fehl — Deployment ist unmöglich.

Der klassische Ansatz — manueller Lighthouse-Report nach jedem Sprint — würde Regressionen 2 Wochen zu spät zeigen. Im modernen Setup ist das Budget fest in die CI eingebunden. Jeder Pull Request durchläuft Lighthouse CI, die Seite wird in Chromium gerendert, Performance-Metriken gemessen. Budget überschritten? GitHub Action schlägt fehl, Merge ist blockiert.

Echtes Szenario: Bei einem Shopify-Hydrogen-Storefront wird ein neues Product-Recommendation-Widget hinzugefügt. Das JS-Bundle steigt von 340KB auf 510KB. Die CI-Pipeline fängt dies sofort auf, färbt den PR rot. Das Widget wird mit Lazy-Loading optimiert, erst dann ist Deployment möglich. Im alten Workflow wäre dies live gegangen — 510KB Bundle, auf mobil 3G extra 4s Blockierungszeit.

Für das Setup nutzen wir `lighthouse-ci`. Die Tool nimmt eine Preview-URL, rendert in Chromium, misst Core Web Vitals + Custom Metrics und vergleicht mit einem Budget als JSON.

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

`numberOfRuns: 3` reduziert Variabilität — der Median wird verwendet. `throttling` simuliert mobil 3G, das Worst-Case-Szenario des echten Nutzers.

## Lighthouse CI mit GitHub Actions automatisieren

Um Lighthouse in der CI auszuführen, nutzen wir Vercel Preview Deployment + GitHub Actions. Jeder PR triggert automatisch eine Preview-URL, Lighthouse CI scannt diese. Ergebnisse werden als PR-Kommentar hinterlegt. Budget überschritten? CI schlägt fehl.

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

Der `wait-for-vercel-preview` Step ist kritisch: Startet Lighthouse vor Ende des Deployments, gibt es 404. Mit `max_timeout: 300` warten wir 5 Minuten. Danach beginnt Lighthouse.

Der Report sieht im PR so aus:

```
Lighthouse CI Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Performance: 92/100 (+2)
❌ LCP: 2.3s (Budget: 2.0s) — FAILED
✅ TBT: 180ms (Budget: 200ms)
✅ CLS: 0.08 (Budget: 0.1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

LCP ist 2.3s — Merge blockiert. Der Entwickler findet, dass Hero-Image Lazy-Loading fehlt, fügt `loading="eager"` hinzu, Lighthouse läuft erneut, LCP fällt auf 1.9s, Merge ist freigegeben.

Dieser Ansatz ist für [Headless Commerce](https://www.roibase.com.tr/de/headless) Projekte kritisch. Hydrogen oder Next.js Commerce Storefronts bekommen täglich neue Components. Übersicht ein `await fetch()` wird nicht aufgelöst — Main Thread blockiert. Lighthouse CI fängt dies mit Bundle Size + TBT auf.

## Real User Monitoring für echte Zahlen in Production

Lighthouse CI macht Synthetic Monitoring — Lab-Umgebung. Echte Nutzer haben andere Geräte, Netzwerke, Cache-Status. Darum braucht es RUM (Real User Monitoring). RUM sammelt echte Metriken vom Live-Site.

Mit der Web Vitals Bibliothek senden Sie RUM zum eigenen Backend:

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

  // Beacon API — sendet auch wenn Seite schließt
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

Das Backend `/api/vitals` Endpoint speichert die Metriken in BigQuery oder Cloudflare Analytics. Der tägliche Aggregate-Report sieht so aus:

| Datum      | LCP p75 | INP p75 | CLS p75 | Seitenaufrufe |
|------------|---------|---------|---------|---------------|
| 2026-07-28 | 1.8s    | 140ms   | 0.06    | 12.400        |
| 2026-07-29 | 2.1s    | 180ms   | 0.09    | 13.100        |
| 2026-07-30 | 3.2s    | 320ms   | 0.14    | 11.800        |

Deployment am 29. Juli. LCP springt von 2.1s auf 3.2s, INP von 180ms auf 320ms. Bounce Rate +4,2%. RUM zeigt dies innerhalb von 2 Stunden live — während Lighthouse CI im Lab unter 2.0s war, aber echte Nutzer waren auf langsameren Geräten.

Folge: Rollback basierend auf RUM-Daten. LCP fällt zurück auf 1.9s.

### RUM Alarm Pipeline

RUM nur im Dashboard zu zeigen ist unzureichend. Bei Regression muss ein Slack-Alarm kommen. Über Scheduled Query in BigQuery:

```sql
-- BigQuery Scheduled Query (stündlich)
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

Die Query prüft, ob LCP p75 um mehr als 15% versus Baseline schlechter ist. Wenn ja, triggert eine Cloud Function einen Slack Webhook:

```
⚠️ Performance Regression Detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LCP p75: 3.2s (+68% vs 6h Baseline)
Baseline: 1.9s
URL: /product/xyz
Deploy: #4521 (vor 30 Min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Tradeoff: Synthetic vs RUM — Wann welche Zahl nutzen

Lighthouse CI und RUM ergänzen sich — nicht das eine gegen das andere, sondern beide parallel.

**Lighthouse CI (Synthetic):**
- **Vorteil:** Kontrollierte Umgebung, reproduzierbar, bei jedem Commit
- **Nachteil:** Echte Geräte-Varianz nicht sichtbar, Cache-Status schwer zu simulieren
- **Einsatz:** CI-Pipeline zur Regression Prevention — „hat dieser PR Verlangsamungs-Risiko?"

**RUM (Real User):**
- **Vorteil:** Echte Nutzer-Daten, Edge Cases werden erfasst (z.B. „iPhone 11 Safari: LCP 5s")
- **Nachteil:** Noisy Data (Outlier), keine Info vor Deployment
- **Einsatz:** Live Monitoring — „hat das neue Deployment Performance zerstört?"

Ein stabiles System nutzt beide. CI blockiert bei Budget-Überschuss. Deployment geht durch? RUM validiert die echten Zahlen in 2 Stunden. RUM zeigt Regression? Rollback.

Beispiel: Shopify Storefront mit neuem Variant Selector. Lighthouse CI zeigt 380ms TBT (Budget: 200ms). PR wird abgelehnt. Dev macht Code-Split, Lazy-Load. Lighthouse CI: 150ms TBT, Merge freigegeben. 4 Stunden nach Live: RUM zeigt INP p75 120ms → 145ms — akzeptabel (Budget 200ms). Deployment bleibt.

## Regressionsalarme in Deployment Pipeline integrieren

Wenn RUM-Alarm unabhängig läuft, geht Context verloren. „LCP ist schlechter" — aber welches Deployment ist schuld? Deshalb Deployment-Metadaten in RUM-Events einbinden.

Vercel/Netlify hat `VERCEL_GIT_COMMIT_SHA` Environment Variable. Dies in Frontend injizieren:

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

In BigQuery dann:

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

Resultat:

| deployment_id | deployed_at         | lcp_p75 | sample_size |
|---------------|---------------------|---------|-------------|
| a3f2b19       | 2026-07-30 14:22:00 | 3.1s    | 2.340       |
| c8d4e21       | 2026-07-30 09:15:00 | 1.9s    | 4.120       |

Nach Deployment um 14:22 springt LCP von 1.9s auf 3.1s. Mit Commit SHA wird der PR in GitHub gefunden. Code Review: Hero-Image