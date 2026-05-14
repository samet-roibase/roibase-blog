---
title: "Budget di Performance Web: Collegare alla Meccanica Decisionale"
description: "Convertire le metriche di velocità in obiettivi aziendali misurabili con Lighthouse CI, RUM e alarm di regressione—architettura pratica e esempi di codice."
publishedAt: 2026-05-14
modifiedAt: 2026-05-14
category: tech
i18nKey: tech-004-2026-05
tags: [web-performance, lighthouse-ci, rum, performance-budget, devops]
readingTime: 9
author: Roibase
---

Il costo del rallentamento dei siti web è ormai una grandezza calcolabile. Lo studio di Amazon del 2006 ha dimostrato che ogni 100ms di latenza causava un calo dell'1% nelle vendite—un tasso ancora più accentuato nei siti di e-commerce. I team di sviluppo che lavorano senza un budget di performance scoprono la regressione di velocità solo dopo il deployment, quando l'impatto commerciale è già avvenuto. Questo articolo mostra come collegare le metriche di velocità alla meccanica decisionale usando Lighthouse CI e Real User Monitoring (RUM)—con esempi di codice concreti.

## Dal Budget di Performance alla Decisione Aziendale

Un budget di performance è un limite numerico: "LCP non può superare 2,5 secondi", "First Input Delay (FID) deve stare sotto i 100ms", "il bundle JavaScript totale non deve superare 350KB". Però questi parametri restano un'aspirazione sulla documentazione se non vengono testati automaticamente nella pipeline CI. Lighthouse CI è lo strato di tooling che testa questi limiti a ogni commit, bloccando il deployment o generando allarmi quando vengono superati.

Un semplice workflow di Lighthouse CI con GitHub Actions:

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

Questa pipeline esegue una scansione dell'ambiente di staging a ogni PR, misurando i Core Web Vitals. Con la configurazione `assert` è possibile impostare limiti rigidi:

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

Se LCP supera 2,5 secondi, il merge viene bloccato. Questo approccio può sembrare rallentare la velocità di sviluppo nel breve termine, ma abbiamo rilevato una riduzione dell'80% delle regressioni di performance in production (dati misurati da Roibase nel progetto Shopify Hydrogen). Il bug viene catturato prima che raggiunga production—il costo di correzione è 10 volte inferiore.

Lighthouse CI misura in un ambiente di laboratorio (singola istanza Chrome). Non cattura la varietà di dispositivi, le condizioni di rete dei veri utenti. Qui entra in gioco RUM.

## Misurare l'Esperienza dell'Utente Reale con RUM

Real User Monitoring raccoglie le metriche di ogni utente tramite JavaScript che gira nel browser. La libreria Web Vitals semplifica il processo:

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

Questo codice invia i Core Web Vitals al backend a ogni caricamento pagina. Il backend (ad esempio Cloudflare Workers) può scrivere questi dati in BigQuery:

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

In BigQuery, questi dati possono essere interrogati:

```sql
SELECT
  metric,
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS p75,
  COUNT(*) AS sample_count
FROM web_vitals.raw_metrics
WHERE timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY))
GROUP BY metric;
```

Il P75 (75° percentile) è il benchmark ufficiale dei Core Web Vitals—Google assegna i punteggi in base a questo percentile. Questa query restituisce dati reali di production, non l'ambiente di laboratorio di Lighthouse CI.

### Trade-off tra RUM e Lighthouse CI

Lighthouse CI è deterministico, ripetibile—scansionando lo stesso codice otterrai lo stesso risultato. RUM è rumoroso—il 5% degli utenti usa connessioni 3G, il 10% dispositivi Android vecchi, queste metriche mostrano dispersione. Ma RUM mostra il mondo reale, CI mostra il laboratorio. Usarli insieme è critico: CI blocca la regressione, RUM misura l'impatto commerciale.

Ad esempio, LCP potrebbe essere 2,1 secondi in Lighthouse CI, ma P75 in production RUM potrebbe essere 3,2 secondi—perché il 30% degli utenti reali usa reti mobili, il laboratorio ha fiber. Questa discrepanza è particolarmente evidente nei progetti [Headless Commerce](https://www.roibase.com.tr/it/headless): il rendering edge mostra 1,8 secondi di LCP nel laboratorio, ma in production con cache miss del CDN può raggiungere 4 secondi.

## Allarme di Regressione: Quale Metrica a Quale Soglia

Per rilevare la regressione di performance serve una metrica di baseline. Il baseline potrebbe essere la media del P75 degli ultimi 7 giorni:

```sql
-- BigQuery scheduled query: eseguita ogni giorno, aggiorna la tabella di allarme
CREATE OR REPLACE TABLE web_vitals.baseline AS
SELECT
  metric,
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS baseline_p75
FROM web_vitals.raw_metrics
WHERE timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY))
GROUP BY metric;
```

Poi, elaborando il flusso in tempo reale, generare allarmi se la deviazione supera il 10%:

```javascript
// Cloudflare Durable Objects: handler di allarme con stato
export class PerfAlarmState {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const { metric, currentP75 } = await request.json();
    const baseline = await this.env.BQ.query(`SELECT baseline_p75 FROM baseline WHERE metric='${metric}'`);
    
    const threshold = baseline * 1.10; // 10% regressione
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

Questa architettura genera allarmi in tempo reale—la regressione può essere rilevata 5 minuti dopo il deployment. La decisione di rollback può essere presa istantaneamente. Scenario di esempio: un'ottimizzazione del bundle JavaScript riduce il LCP di 200ms nel laboratorio, ma aumenta il TBT (Total Blocking Time) di 400ms in production perché il costo di parsing è aumentato. L'allarme RUM cattura la regressione di TBT in 8 minuti, il deployment viene ritirato—solo il 2% degli utenti è stato esposto, il 98% non ha visto il nuovo codice. Senza l'allarme, tutti gli utenti avrebbero avuto un'esperienza lenta per 2 ore.

## Collegare il Budget al Revenue: Attribution

Per collegare la metrica di performance al revenue, occorrono test A/B o analisi per coorte. Un approccio semplice: segmentare gli utenti per velocità di LCP.

```sql
-- BigQuery: conversion rate per velocità LCP
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

Output di esempio:
- **fast (LCP < 2s):** 15.240 session, 1.829 conversioni → **12,0% CR**, €87 AOV
- **moderate (2-3s):** 8.910 session, 934 conversioni → **10,5% CR**, €83 AOV
- **slow (>3s):** 3.200 session, 256 conversioni → **8,0% CR**, €78 AOV

Questi dati mostrano che ridurre LCP da 3s a 2s aumenterebbe il conversion rate dall'8% al 12%—un differenziale di 4 punti. Per un sito con 10.000 visitatori mensili, questo significa 400 conversioni extra. Con AOV di €80, il ricavo aggiuntivo mensile è €32.000. Quando comunichi questo numero nella riunione del budget di performance, il meccanismo decisionale cambia—l'ottimizzazione di LCP sale in cima al backlog.

### Rendere il Budget Dinamico

Un budget statico come "LCP < 2,5s" potrebbe non essere adatto a tutte le pagine. Una pagina di listing di prodotti e una pagina di checkout hanno criticità diverse. Un ritardo di 100ms al checkout è perdita diretta di revenue, nel listing è meno critico. Differenziare il budget per tipo di pagina:

```json
// lighthouserc.json — assert differenti per tipo di pagina
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

Al checkout, superare 2 secondi di LCP blocca il merge (`error`), nella homepage superare 2,5 secondi genera solo un avviso (`warn`). Puoi applicare questa granularità anche in RUM—soglie di allarme diverse per tipo di pagina.

## Integrare la Pipeline CI nel Workflow Aziendale

Usare Lighthouse CI solo come strumento di test, piuttosto che fargli scrivere commenti sui PR, aumenta la visibilità nel team:

```yaml
# .github/workflows/lighthouse-comment.yml
- name: Comment PR with Lighthouse results
  uses: treosh/lighthouse-ci-action@v9
  with:
    uploadArtifacts: true
    temporaryPublicStorage: true
    runs: 3 # eseguire 3 volte, fare la media
```

Questa action aggiunge un commento al PR come questo:

```
Lighthouse CI Report

| Metric | Before | After | Diff |
|--------|--------|-------|------|
| LCP    | 2,8s   | 2,1s  | -700ms ✅ |
| TBT    | 420ms  | 310ms | -110ms ✅ |
| CLS    | 0,08   | 0,12  | +0,04 ⚠️ |
```

CLS (Cumulative Layout Shift) è peggiorato—il team lo nota subito, può correggere prima del deployment. Chiudere questo feedback loop è essenziale per costruire una cultura di performance.

Trasferire i dati RUM in un dashboard è altrettanto critico. La combinazione Grafana + BigQuery è semplice:

```sql
-- Panel di Grafana: trend di LCP nelle ultime 24 ore
SELECT
  TIMESTAMP_SECONDS(DIV(timestamp, 1000)) AS time,
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS p75_lcp
FROM web_vitals.raw_metrics
WHERE metric = 'LCP'
  AND timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR))
GROUP BY time
ORDER BY time;
```

Nel dashboard, aggiungere annotazioni di deployment per vedere quale release ha avuto quale impatto. Ad esempio, un cambio di lazy loading per le immagini riduce il LCP del 18%—se mostri l'ID del deployment come