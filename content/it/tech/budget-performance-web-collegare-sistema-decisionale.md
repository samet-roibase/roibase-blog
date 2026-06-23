---
title: "Budget di Performance Web: Collegare al Sistema Decisionale"
description: "Integrare Lighthouse CI, RUM e alarm di regressione di performance nel processo decisionale. La metodologia dietro la riduzione di TBT da 2190ms a 200ms."
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: tech
i18nKey: tech-004-2026-06
tags: [web-performance, lighthouse-ci, rum, core-web-vitals, performance-budget]
readingTime: 8
author: Roibase
---

Nel 2026, la performance web non è più "rendere le pagine veloci" — è una disciplina ingegneristica dove le decisioni vengono prese in modo continuo. Pubblicate un e-commerce, il punteggio Lighthouse scende da 92 a 68, il tasso di conversione cala da 3,2% a 2,7% — ma nessuno se ne accorge perché il monitoraggio è limitato a "il server è down?". Collegare il budget di performance al sistema decisionale significa intercettare la regressione prima del deploy, valutare ogni commit rispetto alle soglie LCP/TBT/CLS e alimentare il pipeline di attribuzione con i dati RUM. In questo articolo vi mostreremo come integrare Lighthouse CI, il monitoraggio sintetico, RUM e l'architettura degli allarmi in un sistema coeso.

## Cos'è un Budget di Performance e Perché Deve Essere Misurato da un Sistema, Non da Umani

Un budget di performance definisce limiti di risorse numerici per pagina: massimo JavaScript bundle (es. 200 KB gzip), massimo TBT (Total Blocking Time, 200 ms), massimo LCP (Largest Contentful Paint, 2,5 secondi). Questi numeri non sono arbitrari — le soglie Core Web Vitals di Google definiscono la banda "buona", ma dovete derivare limiti ancora più severi dai dati del vostro funnel di conversione.

Lo scenario classico "Lighthouse 95 in dev, 72 in prod" emerge per questi motivi: il test sintetico avviene in condizioni di laboratorio (fast 4G, cache vuota, single page load), mentre RUM testa il vero utente con la sua 3G, cache piena e i suoi percorsi di navigazione. La differenza è normale ma entrambi devono essere monitorati. Lighthouse CI cattura la regressione di bundle size su ogni PR; RUM mostra la realtà di produzione come "il 22% degli utenti mobili ha LCP sopra 4 secondi". Se definite il budget solo come "superare il punteggio 75", potete aggiungere 100 KB al bundle e aumentare lo score da 74 a 76 — la pagina diventa più pesante ma il punteggio è verde. Per questo motivo dovete mantenere budget *per metrica* (LCP, TBT, CLS) *e* *per risorsa* (JS, CSS, immagini in MB).

Un altro punto fondamentale: enforcement manuale del budget non scala. "Controlliamo la performance durante la code review" non regge con 20 PR al giorno. Deve essere il sistema a misurare, il sistema a fallire, gli umani solo a investigare il perché.

## Lighthouse CI per Performance Gating su Ogni Commit

Lighthouse CI esegue automaticamente gli audit Lighthouse su ogni commit o PR e riporta i risultati su GitHub o dashboard interno. Si integra nel vostro pipeline CI così:

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

Nel file config `.lighthouserc.json` definite i budget:

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

Con questo setup, se una PR aggiunge 50 KB di JS in più e TBT supera 200 ms, il CI fallisce e il merge viene bloccato. In Roibase, nei progetti headless commerce abbiamo usato questo approccio per portare il TBT medio a 200 ms partendo da 2190 ms nei clienti migrati all'architettura [Headless Commerce](https://www.roibase.com.tr/it/headless) — perché ogni aggiunta di libreria veniva testata contro il budget.

### Limitazioni di Lighthouse CI e Decisioni Architetturali

Lighthouse CI esegue test sintetici: banda fissa (Moto G4, emulazione slow 4G), throttle CPU fisso (4x slowdown), una sola pagina. L'utente reale ha dispositivi diversi, segue percorsi differenti (product page → cart → checkout), vede varianti A/B. Per questo motivo posizionate Lighthouse CI come *bar minima* — se passa il deploy è possibile, ma passare non significa 100 punti in produzione. Per misurare la realtà di produzione servono i dati RUM.

## RUM (Real User Monitoring) per Trasformare la Realtà di Produzione in Dati Decisionali

RUM raccoglie metriche dai veri utenti: Navigation Timing API, PerformanceObserver, CrUX (Chrome User Experience Report). Potete usare un vendor (Speedcurve, Sentry Performance, Cloudflare Web Analytics) oppure il vostro stack di logging (libreria web-vitals + BigQuery).

Un'integrazione minimale con `web-vitals`:

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

Caricate questi dati su BigQuery, poi usate dbt per incrociarli con i dati di attribuzione marketing:

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

Questa tabella vi dice "quando LCP è sotto 2,5 secondi CVR è 3,4%, quando è sopra 2,1%" — dati concreti. Quando riportate questo al CMO, la richiesta astratta "ottimizziamo la performance" diventa "se portiamo LCP sotto 2,5 secondi guadagniamo 18K$ mensili di revenue in più".

## Collegare gli Allarmi di Regressione a Slack/PagerDuty

Dopo aver raccolto i dati RUM, dovete rilevare la regressione con allarmi su soglia. Se la vostra media degli ultimi 7 giorni è LCP 2,2 secondi e oggi è 3,1 secondi, è una regressione dovuta al deploy o a un problema CDN. Non potete scoprirlo manualmente osservando il dashboard — deve essere automatico.

### Metrica-Based Alerting con DataDog

DataDog parsa automaticamente le metriche RUM e applica anomaly detection. Una definizione di monitor:

```json
{
  "name": "LCP Regression - Desktop",
  "type": "metric alert",
  "query": "avg(last_1h):avg:rum.largest_contentful_paint{device:desktop} > 2500",
  "message": "LCP desktop ha superato 2500ms nell'ultima ora. Ultimo deploy: {{deploy.id}}. @slack-perf-alerts @pagerduty",
  "tags": ["service:ecommerce", "env:production"],
  "thresholds": {
    "critical": 2500,
    "warning": 2200
  }
}
```

Quando l'allarme si attiva arriva su Slack, apre un incident in PagerDuty e sveglia lo sviluppatore on-call. Se il messaggio include l'ID del deploy (dal tag CI pipeline), trovate la causa della regressione in 30 secondi.

### Inviare i Fallimenti di Threshold da Lighthouse CI come Allarmi

Alcuni team non lasciano il fail di Lighthouse CI solo come block PR, lo mandano anche su Slack:

```yaml
# .github/workflows/lighthouse-ci.yml (step aggiuntivo)
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

Così lo sviluppatore che apre una PR vede sia il check rosso in CI sia la notifica Slack immediatamente — l'attenzione si accende al primo superamento del budget.

## Integrare i Budget nel Sistema Feature Flag

Alcune feature sono intrinsecamente pesanti: chat widget live (80 KB JS), motore di personalizzazione (150 KB + costo runtime), video player (200 KB). Invece di attivarle per tutti gli utenti, potete testarle in un segmento che non supera il budget di performance (es. desktop + connessione veloce) e attivarle gradualmente.

Nel vostro sistema feature flag (LaunchDarkly o proprietario) potete definire regole:

```javascript
// featureFlags.js
import { getConnectionSpeed } from './utils';

export function shouldEnableChatWidget(user, vitals) {
  const is4G = getConnectionSpeed() === '4g';
  const goodLCP = vitals.lcp < 2000;
  
  return is4G && goodLCP && user.tier === 'premium';
}
```

Con questo approccio, la decisione "aggiungiamo il chat widget" non porta il rischio "tutti gli utenti vedono +300 ms di LCP" — si attiva solo nel segmento che lo tollera, raccogliete dati RUM, misurate l'impatto su CVR, poi fate rollout completo o lo ritirate. Quando discutete il trade-off con product e marketing, lo potete mostrare numericamente: "Il chat widget aumenta CVR dello 0,4% ma porta LCP a 2,8 secondi — guadagno netto +8K$ ma UX peggiora. Come procediamo?"

## Enforcing Budget di Performance nel Headless Commerce

L'architettura headless commerce (es. Shopify Hydrogen, Next.js + Shopify API) è generalmente più veloce di un tema Liquid perché il controllo JavaScript è vostro e potete fare hydration selettiva. Ma siccome il controllo è vostro, il rischio di regressione è anche vostro — un aggiornamento npm può aggiungere 70 KB al bundle.

Nel nostro lavoro di [Shopify Partner](https://www.roibase.com.tr/it/shopify) per le migrazioni headless applichiamo questo workflow:

1. **Stabilire la baseline:** Raccogliete dati RUM dal tema Liquid esistente (30 giorni). Annotate i valori mediani di LCP, TBT, CLS.
2. **Gate il prototipo headless con Lighthouse CI:** Ogni commit deve rispettare il budget in `.lighthouserc.json`. Il primo deploy deve essere almeno 20% più veloce della baseline.
3. **Confronto RUM in produzione:** Nei primi 7 giorni fate A/B test vecchia/nuova versione (es. 10% traffic su headless), comparate le metriche RUM.
4. **Configurate gli allarmi di regressione:** Dopo la migrazione, impostate i monitor DataDog per LCP 2,5s e TBT 200ms.
5. **Review trimestrale:** Ogni trimestre audit del bundle size, pulite le dipendenze inutilizzate.

Con un cliente e-commerce abbiamo ottenuto questi risultati: tema Liquid LCP 4,1s → Hydrogen LCP 1,8s, CVR 2,3% → 3,1% (+35%). Ma 6 mesi dopo, con le nuove feature LCP è salito a 2,9s e CVR è sceso a 2,9% — perché l'enforcement del budget era stato allentato. Dopo aver riattivato il budget in 2 settimane siamo tornati a 2,1s.

## Trade-off: Velocità vs Esperienza Ricca

A volte il team di marketing dice "la pagina è veloce ma vuota, aggiungiamo più contenuti". Questo crea un trade-off tra velocità e engagement. La decisione deve essere numerica: "Aggiungere il carousel aumenta LCP di 300 ms, l'engagement del 12%, il CVR non cambia — il trade-off è netto posit