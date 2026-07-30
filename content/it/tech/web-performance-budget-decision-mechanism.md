---
title: "Budget di Performance Web: Collegare il Meccanismo Decisionale"
description: "Integrare Lighthouse CI, RUM e allarmi di regressione di performance nella pipeline CI/CD per bloccare il rallentamento al deployment — scenari di implementazione reali."
publishedAt: 2026-07-30
modifiedAt: 2026-07-30
category: tech
i18nKey: tech-004-2026-07
tags: [web-performance, lighthouse-ci, rum, performance-budget, core-web-vitals]
readingTime: 9
author: Roibase
---

Scoprire una regressione di performance dopo il rilascio in produzione è come scoprire il tasso di cambio dopo il trasferimento: prima e dopo sono completamente diversi. Secondo il Commerce Signals Report di Google del 2026, ogni 100ms di LCP aggiuntivo genera un aumento del 3,5% nel bounce rate. Proprio come catturiamo i bug prima del deployment, dobbiamo catturare il rallentamento nella pipeline CI/CD. In questo articolo mostreremo come integrare Lighthouse CI, RUM, synthetic monitoring e performance budget per bloccare i deployment lenti — con codice e numeri reali.

## Cos'è un Performance Budget e Perché è Obbligatorio in CI/CD

Un performance budget è il limite massimo di risorse che una pagina può consumare per le prestazioni. Esempio: "Homepage LCP < 2s, Total Blocking Time < 200ms, bundle JS < 400KB". Funziona come un SLA: se uno di questi numeri viene superato, la build fallisce e il deployment non avviene.

L'approccio classico — estrarre manualmente un rapporto Lighthouse alla fine di ogni sprint — rilevava le regressioni con 2 settimane di ritardo. Nell'approccio moderno, il budget è integrato in CI. Ogni pull request viene eseguito attraverso Lighthouse CI, che renderizza la pagina con Chromium headless e misura le metriche di performance. Se il budget viene superato, l'azione GitHub fallisce e non puoi fare il merge.

Scenario di esempio: in uno storefront Shopify Hydrogen, quando viene aggiunto un nuovo widget di raccomandazione di prodotto, la dimensione del bundle aumenta da 340KB a 510KB. La pipeline CI lo cattura istantaneamente e segnala il PR in rosso. Il widget rimane bloccato fino a quando non viene ottimizzato con lazy-loading. Nel flusso precedente, questo sarebbe passato in produzione per due giorni — 510KB bundle significa 4s di blocking time aggiuntivo su mobile 3G.

Per impostare il performance budget, useremo `lighthouse-ci`. Lighthouse CI accetta l'URL di preview del deployment, lo renderizza in Chromium, misura le Core Web Vitals e le metriche personalizzate, quindi le confronta con un file JSON del budget.

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

`numberOfRuns: 3` riduce la variabilità — viene utilizzato il valore mediano. `throttling` simula le condizioni 3G mobile — lo scenario peggiore dell'utente reale.

## Automatizzare Lighthouse CI con GitHub Actions

Per eseguire Lighthouse nella pipeline CI, useremo Vercel per il deployment di preview + GitHub Actions. Ogni volta che viene aperto un PR, Vercel crea automaticamente un URL di preview, e Lighthouse CI scansiona quell'URL. I risultati vengono pubblicati come commento sul PR. Se il budget viene superato, CI fallisce.

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

Il passaggio `wait-for-vercel-preview` è critico: se Lighthouse viene eseguito prima che il deployment sia completato, otterrai un 404. Con `max_timeout: 300`, aspettiamo 5 minuti. Una volta che il deployment è completato, Lighthouse inizia.

Il risultato viene pubblicato sul PR così:

```
Lighthouse CI Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Performance: 92/100 (+2)
❌ LCP: 2.3s (budget: 2.0s) — FAILED
✅ TBT: 180ms (budget: 200ms)
✅ CLS: 0.08 (budget: 0.1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Poiché LCP è 2.3s, CI fallisce. Il PR non può essere unito. Lo sviluppatore scopre che l'immagine hero è stata caricata con lazy-loading disabilitato, la corregge con `loading="eager"`, Lighthouse CI viene eseguito di nuovo, LCP scende a 1.9s, il merge viene sbloccato.

Questo approccio è critico nei progetti [Headless Commerce](https://www.roibase.com.tr/it/headless). Gli storefront Hydrogen o Next.js Commerce aggiungono nuovi component ogni giorno. Se da qualche parte un `await fetch()` non viene risolto correttamente, il main thread si blocca. Lighthouse CI lo cattura tramite bundle size e TBT.

## Monitoraggio degli Utenti Reali (RUM) per Tracciare i Numeri Reali in Produzione

Lighthouse CI esegue il monitoring sintetico — funziona in un ambiente controllato. I dispositivi reali degli utenti, la loro rete, lo stato della cache sono completamente diversi. Per questo è necessario RUM (Real User Monitoring). RUM raccoglie il flusso di metriche reali provenienti da utenti live nel sito.

Puoi inviare RUM al tuo backend usando la libreria Web Vitals:

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

  // Beacon API — viene inviato anche se la pagina si chiude
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

L'endpoint backend `/api/vitals` scrive questa metrica in BigQuery o Cloudflare Analytics. Il rapporto aggregato giornaliero assomiglia a questo:

| Data       | LCP p75 | INP p75 | CLS p75 | Visualizzazioni Pagina |
|------------|---------|---------|---------|------------------------|
| 2026-07-28 | 1.8s    | 140ms   | 0.06    | 12.400                 |
| 2026-07-29 | 2.1s    | 180ms   | 0.09    | 13.100                 |
| 2026-07-30 | 3.2s    | 320ms   | 0.14    | 11.800                 |

C'è stato un deployment il 29 luglio. LCP è salito da 2.1s a 3.2s, INP da 180ms a 320ms. Il bounce rate è aumentato del 4,2%. I dati RUM lo hanno mostrato in meno di 2 ore — Lighthouse CI in lab era sotto 2.0s ma gli utenti reali su dispositivi più lenti erano più lenti.

In questo caso, la decisione di rollback è stata presa basandosi sui numeri RUM. Il deployment è stato ripristinato, LCP è tornato a 1.9s.

### Pipeline di Allarme RUM

Mostrare le metriche RUM solo in una dashboard non è sufficiente. È necessario un allarme Slack in caso di regressione. Puoi impostare una query pianificata su BigQuery:

```sql
-- BigQuery scheduled query (ogni ora)
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

Questa query controlla se LCP p75 si è degradato di più del 15% rispetto al baseline. Se così fosse, viene attivata una Cloud Function che invia un allarme al webhook Slack:

```
⚠️ Performance Regression Detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LCP p75: 3.2s (+68% vs baseline 6h)
Baseline: 1.9s
URL: /product/xyz
Deploy: #4521 (30 min ago)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Trade-off: Sintetico vs RUM, Quale Numero Usare Dove

Lighthouse CI e RUM si completano a vicenda — non dovresti sceglierne uno, ma usarli entrambi in parallelo.

**Lighthouse CI (sintetico):**
- **Vantaggio:** Ambiente controllato, ripetibile, viene eseguito ad ogni commit
- **Svantaggio:** Non vede la variabilità del dispositivo reale, non può simulare lo stato della cache
- **Uso:** Nella pipeline CI per la prevenzione delle regressioni — "questo PR rischia di rallentare se unito?"

**RUM (utente reale):**
- **Vantaggio:** Dati utente reale, cattura i casi edge (ad es. "LCP 5s su iPhone 11 Safari")
- **Svantaggio:** Dati rumorosi (molti outlier), non fornisce informazioni prima del deployment
- **Uso:** Monitoraggio live — "il nuovo deployment ha rovinato le prestazioni?"

Un sistema robusto usa entrambi. Se Lighthouse in CI supera il budget, il deployment si blocca. Se il deployment passa, RUM verifica i numeri reali entro 2 ore. Se RUM mostra una regressione, esegui il rollback.

Esempio: in uno storefront Shopify, quando viene aggiunto un nuovo componente selettore variante, Lighthouse CI mostra 380ms TBT (budget: 200ms). Il PR viene rifiutato. Lo sviluppatore suddivide il componente con code-splitting e aggiunge lazy-loading. Lighthouse CI ora mostra 150ms TBT, il merge passa. 4 ore dopo il deployment, i dati RUM mostrano INP p75 da 120ms a 145ms — accettabile (budget 200ms). Il deployment rimane.

## Integrare gli Allarmi di Regressione nella Pipeline di Deployment

Se l'allarme RUM viene eseguito indipendentemente dal deployment, c'è perdita di contesto. Ricevi una notifica "LCP si è degradato" ma non sai quale deployment l'ha causato. Per questo, devi aggiungere i metadati di deployment all'evento RUM.

Nei deployment Vercel o Netlify, esiste la variabile di ambiente `VERCEL_GIT_COMMIT_SHA`. La iniettiamo nel frontend in modo che ogni evento RUM includa l'ID del deployment:

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

In BigQuery, eseguiamo una query come questa:

```sql
SELECT
  deployment_id,
  FROM_UNIXTIME(deployment_time / 1000) AS deployed_at,
  APPROX_QUANTILES(lcp_value, 100)[OFFSET(75)] AS lcp_