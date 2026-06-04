---
title: "Performance Budget: Collegare i Numeri al Processo Decisionale"
description: "Come integrare Lighthouse CI, RUM e alert di regressione nei processi aziendali per costruire una cultura del performance gestita dai dati."
publishedAt: 2026-06-04
modifiedAt: 2026-06-04
category: tech
i18nKey: tech-004-2026-06
tags: [web-performance, lighthouse-ci, rum, core-web-vitals, performance-budget]
readingTime: 9
author: Roibase
---

Il 53% dei siti di e-commerce perde utenti quando il caricamento supera i 3 secondi (dato Google 2025). Performance budget — decisioni numeriche come "LCP non può superare 2,5s" — è diventato disciplina obbligatoria per prevenire queste perdite. Ma la maggior parte dei team lascia questi budget nei documenti di proposta. Le regressioni dovrebbero interrompere automaticamente la pipeline di deploy, le dashboard RUM dovrebbero entrare nella sprint review settimanale. Le performance web non sono più "il lavoro del team frontend" — diventano il livello dati che plasma le decisioni di prodotto.

## Cos'è (e Cosa Non È) un Performance Budget

Un performance budget trasforma gli intervalli di rallentamento accettabili in impegni numerici. Invece dell'obiettivo astratto "la pagina deve essere veloce", diventa il contratto vincolante "LCP < 2,5s, FID < 100ms, CLS < 0,1". Una PR che supera il budget non può essere mergiata — la build fallisce in CI.

**Tipologie di budget:**

| Tipo di Metrica | Esempio di Budget | Metodo di Misurazione |
|---|---|---|
| Core Web Vitals | LCP < 2,5s | Lighthouse CI, RUM (CrUX) |
| Timing | TTI < 3,5s, TBT < 200ms | Lighthouse, WebPageTest |
| Resource | Bundle JS < 200KB (gzip), Size totale < 1MB | Webpack Bundle Analyzer |
| Count | Request HTTP < 50, Script terze parti < 5 | Network panel |

Un budget non è uno strumento per "bloccare le performance" — è uno strumento per "mettere il costo delle performance in bilancio". Quando un developer aggiunge una nuova libreria di analytics, calcola "questo ci costa 15KB + 200ms di main thread". Quando un PM richiede un nuovo carousel widget, riceve il feedback "aumenterà il CLS di 0,08, rimangono 0,02 dal budget".

Senza budget, il team lavora sulle performance che "sente". L'intuizione è soggettiva; il budget è oggettivo.

## Costruire la Porta di Regressione con Lighthouse CI

Lighthouse CI esegue automaticamente gli score Lighthouse su ogni commit e fallisce la build se il budget viene superato. Si integra con GitHub Actions, GitLab CI, Jenkins. Il setup richiede 10 minuti — il valore ricavato è una cultura delle performance di 10 anni.

**Esempio di workflow GitHub Actions:**

```yaml
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci && npm run build
      - run: npm install -g @lhci/cli
      - run: lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_TOKEN }}
```

**Definizione del budget `.lighthouserc.json`:**

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/", "http://localhost:3000/product/123"],
      "numberOfRuns": 3
    },
    "assert": {
      "preset": "lighthouse:no-pwa",
      "assertions": {
        "first-contentful-paint": ["error", {"maxNumericValue": 2000}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "total-blocking-time": ["error", {"maxNumericValue": 200}],
        "interactive": ["error", {"maxNumericValue": 3500}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

Questa configurazione calcola la media su 3 run (Lighthouse mostra ±15% varianza in un singolo run), e se LCP supera 2,5s, la PR diventa rossa. Il developer non può mergiarla. L'alert su Slack recita: "PR #432 LCP 2,8s — budget 2,5s — ottimizzate o chiedete un'eccezione al PM."

In Roibase integriamo il costo tecnico delle decisioni di prodotto nell'infrastruttura [Headless Commerce](https://www.roibase.com.tr/it/headless), rendendo visibile il performance footprint di ogni feature. Lighthouse CI trasporta questi numeri al punto di decisione.

## RUM: Portare i Dati degli Utenti Reali alla Linea Decisionale

I dati di laboratorio di Lighthouse — misurazione in ambiente controllato — pongono condizioni ma non mostrano il mondo reale. RUM (Real User Monitoring) raccoglie Web Vitals dal traffico di produzione. Il 10% del tuo segmento con connessioni lente potrebbe avere LCP di 5s. Non lo vedrai in lab.

**Esempio di stack RUM:**

```javascript
// web-vitals library raccoglie tutti i Core Web Vitals
import {onCLS, onFID, onLCP} from 'web-vitals';

function sendToAnalytics({name, value, id}) {
  fetch('/api/vitals', {
    method: 'POST',
    body: JSON.stringify({name, value, id, url: location.href}),
    keepalive: true
  });
}

onCLS(sendToAnalytics);
onFID(sendToAnalytics);
onLCP(sendToAnalytics);
```

L'endpoint backend `/api/vitals` scrive questi dati in BigQuery. Una dashboard settimanale entra nella sprint review:

| Metrica | p50 | p75 | p90 | Budget | Stato |
|---|---|---|---|---|---|
| LCP | 2,1s | 2,8s | 4,2s | 2,5s (p75) | ⚠️ Superato 0,3s |
| FID | 12ms | 45ms | 120ms | 100ms (p75) | ✅ |
| CLS | 0,05 | 0,09 | 0,18 | 0,1 (p75) | ✅ |

Il budget LCP è superato a p75 — il PM decide così: "L'ottimizzazione dello slider della homepage sale in cima allo stack. Non possiamo aggiungere nuove feature finché non riduciamo LCP da 2,8s a 2,3s."

Quando colleghi i dati RUM con la velocity del team, generi metriche di throughput delle performance come "200ms di miglioramento LCP per sprint". Il team misura la velocity non per numero di feature ma per "valore spedito + miglioramento delle performance".

## Sistema di Allarme per Regressioni: Catturare il Degrado delle Performance al Momento

Catturare le regressioni di performance entro 2 ore dal deploy è critico. Esempio: un nuovo tool di A/B test aumenta LCP di 1,2s, il segmento di traffico mostra un calo di conversion del 8%. Un allarme precoce risolve il problema con 1 rollback. Se lo scopri tardi, è 1 settimana di perdita di revenue.

**Regole di allarme (BigQuery + Cloud Monitoring):**

```sql
-- p75 LCP ultimo 1 ora vs media precedenti 24 ore
WITH current AS (
  SELECT APPROX_QUANTILES(lcp, 100)[OFFSET(75)] AS lcp_p75
  FROM vitals_table
  WHERE timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
),
baseline AS (
  SELECT APPROX_QUANTILES(lcp, 100)[OFFSET(75)] AS lcp_p75
  FROM vitals_table
  WHERE timestamp BETWEEN TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 25 HOUR)
    AND TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
)
SELECT 
  c.lcp_p75 AS current_lcp,
  b.lcp_p75 AS baseline_lcp,
  (c.lcp_p75 - b.lcp_p75) / b.lcp_p75 * 100 AS pct_change
FROM current c, baseline b
WHERE (c.lcp_p75 - b.lcp_p75) / b.lcp_p75 > 0.15; -- Allarme su aumento del 15%
```

Questa query viene eseguita ogni 10 minuti da Cloud Scheduler. Se supera la soglia, un messaggio appare nel canale Slack #perf-alerts. Il team on-call inizia l'analisi della causa root entro 30 minuti.

**Scenari comuni di regressione:**

1. **Script terze parti aggiunto:** Il vendor di analytics blocca il main thread per 180ms → TBT supera il budget
2. **Lazy-load delle immagini rotto:** L'immagine candidata LCP viene lazy-loaded → LCP 1,2s → 3,1s
3. **Split del bundle JS fatto male:** CSS critico rimandato → FCP 900ms → 2,4s

Lo scopo del sistema di allarme è l'attribuzione — essere in grado di rispondere in 10 minuti alla domanda "quale deploy ha degradato quale metrica".

## Collegare il Budget al Product Backlog

Invece di rendere il performance budget solo un vincolo per i developer, bisogna farne una decisione di prodotto. Il PM inizia a pensare così: "Questa feature ha un costo di 40KB di JS, rimangono 25KB dal budget — quale feature più vecchia disattiviamo?"

**Template di trade-off:**

```
Feature: Homepage product carousel (8 slot)
Impact sulle Performance:
  - JS: +32KB (gzip)
  - LCP: +180ms (animazione carousel)
  - CLS: +0,04 (shift immagini lazy)

Status Budget PRIMA:
  - JS: 168KB / 200KB (rimane 32KB)
  - LCP: 2,3s / 2,5s (rimane 200ms)
  - CLS: 0,06 / 0,1 (rimane 0,04)

Status Budget DOPO:
  - JS: 200KB / 200KB ⚠️ PIENO
  - LCP: 2,48s / 2,5s ⚠️ 20ms rimane
  - CLS: 0,10 / 0,1 ⚠️ PIENO

Decisione: Approvato (l'A/B test del carousel ha mostrato +3% CTR).
Condizione: Disattivare il vecchio rotator della homepage (-28KB).
```

Il PM compie questo trade-off in modo data-driven: "Vale il guadagno del +3% CTR il costo di 180ms LCP?" La risposta viene dai dati del funnel di conversione. Se vale, approva; se non vale, rimane nel backlog in attesa di "miglioramenti neutral per le performance".

Ogni 2 settimane il team esamina il backlog attraverso un audit di performance: "Quale feature ha il ROI di performance più basso?" Esempio: i vecchi pulsanti di social share occupano 12KB ma sono usati lo 0,2% — disattivarli libera budget.

## Performance Culture: Gestione della Velocità Guidata dai Numeri

Invece di vedere le performance web come una "best practice", bisogna farle diventare un KPI. Quando gli OKR trimestrali del team includono "ridurre p75 LCP da 2,5s a 2,0s", il miglioramento delle performance diventa un'attività tracciata separatamente dalla velocity dei sprint.

I performance budget sono la pietra angolare di questa cultura. Il developer scrive nuovo codice chiedendosi "rimane budget?". Il PM pianifica nuove feature calcolando il "performance footprint". Il CTO esamina nella quarterly review il grafico "variazione media LCP per deploy".

Lighthouse CI sorveglia la porta, RUM dice la verità, il sistema di allarme rileva le deviazioni, i trade-off nel backlog bilanciano il carico. Quando questo ciclo si chiude, la performance web smette di essere "il problema del team tecnico" — diventa una dimensione misurabile del successo del prodotto. Dopo che Google ha reso Web Vitals un fattore di ranking nel 2026, i team che non hanno costruito questo ciclo hanno perso il 40% del traffico organico (benchmark Search Console 2025). Impostare un budget non è più un lusso — è una tattica di sopravvivenza.