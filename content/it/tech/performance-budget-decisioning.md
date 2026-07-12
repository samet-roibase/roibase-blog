---
title: "Performance Budget: Collegare le Metriche alle Decisioni"
description: "Lighthouse CI, RUM e alarm di regressione trasformano la performance web in KPI misurabili. Decidi con i numeri, non con le ipotesi."
publishedAt: 2026-07-12
modifiedAt: 2026-07-12
category: tech
i18nKey: tech-004-2026-07
tags: [web-performance, lighthouse-ci, rum, core-web-vitals, devops]
readingTime: 9
author: Roibase
---

La performance web non è "dovrebbe essere buona"—è un numero che influenza le decisioni. Nel 2026, INP (Interaction to Next Paint) che ha sostituito FID, se non rimane sotto i 200ms, il conversion rate mobile cala del 15-20% (Google Chrome UX Report 2025). Per mantenere questo livello servono controlli automatici nella pipeline CI, non previsioni. Quando configurate Lighthouse CI, RUM e sistemi di allarme di regressione, quali soglie posizionate dove? Quale metrica governa quale decisione? Questo articolo illustra l'architettura concreta per collegare il performance budget dal test al processo decisionale, con numeri reali.

## Che Cos'è un Performance Budget e Come Si Lega al Piano Sprint

Un performance budget è il limite massimo per il tempo di caricamento di una pagina, la dimensione del bundle e le metriche di runtime. Il bundle totale non supererà 250KB, FCP non uscirà da 1.2s, INP non supererà 200ms—questi sono i vincoli. Si definiscono all'inizio dello sprint, diventano criteri per il merge dei PR. Se una nuova feature sfonda questi limiti, o refactorizzate il codice, o rinviate la feature, oppure aggiornate il budget (accettando però la perdita di conversioni).

Per definire il budget usate tre fonti: (1) le soglie Core Web Vitals di Google (LCP <2.5s, INP <200ms, CLS <0.1), (2) il benchmark p75 dai dati RUM (se il 75% del vostro traffico sta sotto quel livello, è "buono"), (3) il rapporto di correlazione con le conversioni (se LCP aumenta di 100ms il tasso di conversione cala del 2%, allora spostare la soglia da 2.5s a 3s significa perdere il 10%). Il budget non è un numero solo, si divide per metrica:

| Metrica | Soglia | Fonte |
|---------|--------|-------|
| LCP | <2.5s | CWV ufficiale |
| INP | <200ms | CWV 2024+ |
| CLS | <0.1 | CWV ufficiale |
| Total JS | <300KB gzip | HTTP Archive p75 |
| FCP | <1.8s | RUM interno |

Scrivete questa tabella in un file `performance.config.json`, Lighthouse CI lo legge, un violazione della soglia nei PR fallisce il merge.

## Lighthouse CI: Il Criterio di Merge per la Performance

Lighthouse CI esegue l'audit Lighthouse su ogni PR e riporta i risultati nel log della CI (è uno strumento open source di Google). Si integra con GitHub Actions, GitLab CI, CircleCI. Flusso di base: (1) aprite un PR, (2) la CI compila, (3) il comando `lhci autorun` visita la pagina nell'ambiente di test, (4) confronta i punteggi Lighthouse con il budget in performance.config.json, (5) se viola una soglia il PR fallisce e il merge è bloccato.

Configurazione di esempio (`.lighthouserc.json`):

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/", "http://localhost:3000/product/sample"],
      "numberOfRuns": 3
    },
    "assert": {
      "preset": "lighthouse:no-pwa",
      "assertions": {
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "interactive": ["error", {"maxNumericValue": 3500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "total-byte-weight": ["warn", {"maxNumericValue": 307200}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

Questa config fa fallire il PR se LCP >2.5s, avverte se il totale byte supera i 300KB (ma consente comunque il merge). Si eseguono 3 run perché una singola run ha variance di rete alta. Il compromesso di Lighthouse CI: gira sul server dev locale, non può simulare il CDN di production. I risultati si considerano "worst case", in produzione di solito performano meglio ma le soglie vanno comunque rispettate.

### Lighthouse CI + Vercel Preview: Test Realistico di Staging

Sulle piattaforme Vercel/Netlify un URL di preview PR viene generato automaticamente. Se collegate Lighthouse CI a questo URL testate in un ambiente simile a production. Esempio con GitHub Actions:

```yaml
- name: Run Lighthouse CI
  env:
    LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_TOKEN }}
  run: |
    npm install -g @lhci/cli
    lhci autorun --collect.url=${{ steps.vercel.outputs.preview-url }}
```

`steps.vercel.outputs.preview-url` viene dall'action Vercel. Con questo setup testate il caching CDN, l'SSR edge, l'ottimizzazione delle immagini. Se viola una soglia il PR riceve un commento, la squadra riceve notifiche (aggiungendo webhook Slack).

## RUM: Calibrare il Budget dai Dati dei Veri Utenti

Lighthouse CI è test sintetico—ambiente controllato, sempre le stesse condizioni di rete. RUM (Real User Monitoring) raccoglie metriche dai veri visitatori. La differenza è critica: Lighthouse simula 3G throttled, RUM vede il mix 4G/5G/fiber; Lighthouse testa cache fredda, RUM cattura l'effetto cache dei repeat visitor. Se calibrate il budget solo su Lighthouse perdete l'esperienza reale dell'utente.

Come raccoglitore RUM usate Web Vitals (la libreria ufficiale di Google). Su ogni caricamento misura le metriche CWV e invia i dati a un endpoint beacon. Implementazione di esempio:

```javascript
import {onCLS, onINP, onLCP} from 'web-vitals';

function sendToAnalytics(metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    rating: metric.rating
  });
  navigator.sendBeacon('/analytics', body);
}

onCLS(sendToAnalytics);
onINP(sendToAnalytics);
onLCP(sendToAnalytics);
```

L'endpoint backend `/analytics` scrive i dati in BigQuery (se preferite dati first-party invece di Google Analytics 4, GA4 fa sampling). In BigQuery calcolate il p75:

```sql
SELECT
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS p75_lcp
FROM metrics
WHERE name = 'LCP' AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY);
```

Se risulta 2.8s e il vostro budget è 2.5s, il budget è sotto la realtà del traffico—o lo alzate a 2.8s oppure ottimizzate il codice. Si usa p75 perché significa che il 75% degli utenti sta sotto quel livello, e Google calcola i punteggi CWV sul p75.

### RUM + Segmentazione: Budget per Dispositivo e Regione

Non gestite tutto il traffico con un budget solo. LCP mobile è il 40% più alto di desktop (Chrome UX Report 2025), il traffico dall'India è il 60% più lento di quello dagli USA. Segmentate i dati RUM e differentiate il budget:

| Segmento | Budget LCP | Budget INP |
|----------|------------|------------|
| Desktop | 2.2s | 180ms |
| Mobile | 3.0s | 220ms |
| India | 3.5s | 250ms |

Per farlo aggiungete campi al beacon RUM come `deviceType` e `country` (lookup GeoIP nel backend), poi analizzate in BigQuery con `GROUP BY device`. Lighthouse CI non supporta config multi-target nativamente, ma potete creare workflow separati (`lhci-mobile.json` + `lhci-desktop.json`).

## Allarmi di Regressione: La Performance Crolla, Slack Riceve una Notifica

Budget definito, CI controlla, RUM raccoglie—ma cosa succede se in produzione la performance regredisce? Dopo un deploy nuovo LCP salta da 2.3s a 2.9s, e lo scoprite fra 3 ore invece che in 5 minuti? Servite un job che analizza i dati RUM ogni 5 minuti (Cloudflare Workers Cron, AWS Lambda EventBridge, GCP Cloud Scheduler).

Logica di allarme di esempio (pseudo-code):

```javascript
// Worker che gira ogni 5min
async function checkRegression() {
  const current = await query('SELECT AVG(value) FROM metrics WHERE name="LCP" AND timestamp > NOW() - INTERVAL 5 MINUTE');
  const baseline = await query('SELECT AVG(value) FROM metrics WHERE name="LCP" AND timestamp BETWEEN NOW() - INTERVAL 1 DAY AND NOW() - INTERVAL 1 HOUR');
  
  if (current > baseline * 1.15) { // +15%
    await sendSlack({
      text: `🚨 LCP regression: ${current}ms (baseline ${baseline}ms)`,
      channel: '#performance-alerts'
    });
  }
}
```

Il baseline va 1 ora indietro perché il deploy potrebbe essere stato allora. La soglia del 15% si calibra—10% è troppo sensibile (falsi positivi), 25% è troppo tardi. Potete integrare con PagerDuty o Opsgenie per on-call. Quando arriva l'allarme il team decide se rollback o hotfix.

### Root Cause Regression: Lighthouse Diff

Allarme ricevuto, LCP è scoppiato—perché? Lighthouse CI fa solo il controllo della soglia, non dà l'analisi della causa. Con Lighthouse Diff vedete le differenze di audit fra due build. Il comando `lhci compare` prende due report Lighthouse e calcola i delta:

```bash
lhci compare --base=build-1234 --head=build-1235 --preset=lighthouse:all
```

Output: "unused-javascript increased by 45KB", "server-response-time +120ms". Questi numeri restringono la causa. Con bundle analyzer (webpack-bundle-analyzer, Next.js analyze) trovate da dove vengono i 45KB, il trace log del server vi mostra dove vanno i 120ms di delay.

## Legare Performance a Conversione: Attribution Model

I budget sono numeri tecnici, ma per collegarli alle decisioni vanno convertiti in metriche di business. Servite un rapporto tipo "se LCP passa da 2.5s a 3s, il tasso di conversione cala del 4%". Si produce con A/B test o analisi di coorti. A/B test: il 50% del traffico riceve una build rallentata (Lighthouse aggiunge 500ms), confrontate le conversioni. Analisi di coorti: nei dati RUM confrontate il tasso di conversione degli utenti con LCP <2s vs LCP >3s.

Con Google Analytics 4 + BigQuery export, la query di correlazione:

```sql
SELECT
  CASE 
    WHEN lcp < 2000 THEN 'fast'
    WHEN lcp BETWEEN 2000 AND 4000 THEN 'medium'
    ELSE 'slow'
  END AS lcp_bucket,
  COUNT(DISTINCT user_pseudo_id) AS users,
  COUNTIF(event_name = 'purchase') / COUNT(DISTINCT session_id) AS conversion_rate
FROM analytics_events
LEFT JOIN rum_metrics ON analytics_events.session_id = rum_metrics.session_id
GROUP BY lcp_bucket;
```

La tabella risultante:

| LCP Bucket | Tasso di Conversione |
|------------|---------------------|
| fast | 4.2% |
| medium | 3.6% |
| slow | 2.9% |

Con questi numeri calcolate il ROI del budget: abbassare LCP da 3s a 2.5s alza il conversion rate da 3.6% a 4.2%, un lift del 16.7%. Con 100K visitatori al mese +1670 conversioni, AOV $50 = +$83K di revenue. Questo rapporto non va al CTO, va al CFO—qui si decide la priorità dello sprint di ottimizzazione performance.

### Violazione del Budget: La Decisione del Tradeoff

Uno sprint, una nuova feature arriva e il bundle cresce di 50KB, il budget scoppia. Che fate? Tre opzioni: (1) refactorizzate la feature (code-split, lazy load), (2) alzate il budget e accettate la perdita di conversioni, (3) rinviate la feature. La decisione è numerata: 50KB di extra causano +200ms di LCP (da Lighthouse trace), +200ms causa -2% di conversione (da RUM correlation), se la feature porta +5% di lift il guadagno netto è +3%—andate avanti. Se il lift è +1%, perdete il 1%—rinviate.

Per fare questo calcolo costruite uno "performance cost estimator" (tool interno). Input: delta bundle size, output: delta LCP stimato + impatto su conversione. Modello: regressione semplice, ogni 10KB +30ms LCP, ogni 100ms LCP -%0.8 conversione (ricavato dai vostri dati RUM). Il tool si mostra al PM, la roadmap feature si prioritizza di conseguenza.

## Headless Commerce: Il Budget di Performance Lega il Prezzo alla Velocità

In e-commerce la performance = revenue. Con architettura [headless commerce](https://www.roibase.com.tr/it/headless) (Shopify Hydrogen, Remix, Next.js) controllate il bundle del frontend ma la latenza dell'API backend conta pure nel budget. L'API Storefront Shopify restituisce in media 150ms, lo aggiungete al budget: LCP = TTFB (150ms) + FCP (800ms) + LCP delta (600ms) = 1550ms. Se il budget è 2500ms avete 950ms di margine.

In headless la fonte di regressione è generalmente: (1) la complessità della query GraphQL aumenta (profondità +2 level = +50ms), (2) il numero di componenti SSR cresce (20 component = +100ms di hydration), (3) script di terze parti si aggiungono (tag analytics = +200ms). Lighthouse CI non distingue questi tre, serve il RUM trace log. Aggiungete l'header `Server-Timing` nel middleware Next.js per breakdown della latenza API:

```javascript
export function middleware(req) {
  const start = Date.now();
  const res = NextResponse.next();
  res.headers.set('Server-Timing', `api;dur=${Date.now() - start}`);
  return res;
}
```

Appare in Chrome DevTools Network tab, lo aggiungete al beacon RUM, configurate l'allarme di re