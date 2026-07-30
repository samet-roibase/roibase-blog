---
title: "Presupuestos de Rendimiento Web: Conectarlos al Mecanismo de Decisión"
description: "Integra Lighthouse CI, RUM y alarmas de regresión de rendimiento en tu pipeline CI/CD para detener ralentizaciones en el deployment — casos reales de aplicación."
publishedAt: 2026-07-30
modifiedAt: 2026-07-30
category: tech
i18nKey: tech-004-2026-07
tags: [rendimiento-web, lighthouse-ci, rum, presupuesto-rendimiento, core-web-vitals]
readingTime: 8
author: Roibase
---

Descubrir una regresión de rendimiento después de lanzar a producción es como verificar el tipo de cambio después del cambio: demasiado tarde. Según el informe Commerce Signals de Google 2026, cada 100ms adicional en LCP genera un aumento del 3,5% en la tasa de rebote. Así como atrapamos bugs antes del deployment, necesitamos capturar ralentizaciones en el pipeline CI/CD. Este artículo te mostrará cómo integrar Lighthouse CI, RUM, monitoreo sintético y presupuestos de rendimiento — con código y números reales.

## Qué es un Presupuesto de Rendimiento y Por Qué es Obligatorio en CI/CD

Un presupuesto de rendimiento es el límite máximo de recursos que una página puede consumir en rendimiento. Ejemplo: "Homepage: LCP < 2s, Total Blocking Time < 200ms, bundle JS < 400KB". Funciona como un SLA: si alguno de estos números se supera, el build falla y no llega a producción.

El enfoque clásico — ejecutar un reporte Lighthouse manual al final de cada sprint — detectaría una regresión dos semanas después. En la práctica moderna, el presupuesto está integrado en CI. Cada pull request se ejecuta a través de Lighthouse CI, que renderiza la página en Chromium headless, mide métricas de rendimiento y las compara con el presupuesto. Si lo supera, GitHub Action devuelve error y bloquea el merge.

Caso real: en un storefront Shopify Hydrogen, al agregar un widget de recomendaciones de productos, el tamaño del bundle saltó de 340KB a 510KB. El pipeline CI lo detectó instantáneamente, marcando el PR en rojo. El widget permaneció bloqueado hasta que se optimizó con lazy-loading. Sin esto, habría llegado a producción: 510KB en 3G móvil = 4 segundos adicionales de blocking time — dos días de pérdida hasta el hotfix.

Usaremos `lighthouse-ci` para configurar presupuestos. Lighthouse CI toma una URL de deployment preview, la renderiza en Chromium, mide Core Web Vitals + métricas personalizadas y los compara con un archivo JSON de presupuesto.

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

`numberOfRuns: 3` reduce la variabilidad; toma la mediana. `throttling` simula 3G móvil — el peor escenario del usuario real.

## Automatizar Lighthouse CI con GitHub Actions

Para ejecutar Lighthouse en el pipeline, usamos Vercel preview deployment + GitHub Actions. Cada PR abierto genera una URL preview automática en Vercel; Lighthouse CI rastrea esa URL. Los resultados aparecen como comentario en el PR. Si el presupuesto se supera, CI falla.

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

El paso `wait-for-vercel-preview` es crítico: si Lighthouse ejecuta antes de que Vercel termine, obtiene 404. Con `max_timeout: 300`, esperamos 5 minutos. Una vez completado el deployment, Lighthouse inicia.

El resultado aparece en el PR:

```
Lighthouse CI Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Performance: 92/100 (+2)
❌ LCP: 2.3s (presupuesto: 2.0s) — FAILED
✅ TBT: 180ms (presupuesto: 200ms)
✅ CLS: 0.08 (presupuesto: 0.1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

LCP en 2.3s hace que CI falle. El PR no puede fusionarse. El desarrollador ve que falta lazy-load en la imagen hero, lo corrige con `loading="eager"`, Lighthouse CI ejecuta nuevamente, LCP baja a 1.9s, el merge se desbloquea.

Este enfoque es crítico en proyectos [Headless Commerce](https://www.roibase.com.tr/es/headless). Storefront de Hydrogen o Next.js Commerce agregan componentes constantemente. Si en algún lugar `await fetch()` no se desenvuelve, el main thread se bloquea. Lighthouse CI lo captura con bundle size + TBT.

## Real User Monitoring para Validar Números Reales en Producción

Lighthouse CI hace monitoreo sintético — ejecuta en laboratorio. Los usuarios reales tienen dispositivos, redes y estado de cache diferentes. Por eso necesitas RUM (Real User Monitoring). RUM recopila flujos de métricas reales desde tu sitio en vivo.

Con la librería Web Vitals, puedes enviar RUM a tu backend:

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

  // Beacon API — envía incluso si la página se cierra
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

El backend escribe `/api/vitals` a BigQuery o Cloudflare Analytics. El reporte diario agregado se ve así:

| Fecha      | LCP p75 | INP p75 | CLS p75 | Vistas de Página |
|------------|---------|---------|---------|------------------|
| 2026-07-28 | 1.8s    | 140ms   | 0.06    | 12,400           |
| 2026-07-29 | 2.1s    | 180ms   | 0.09    | 13,100           |
| 2026-07-30 | 3.2s    | 320ms   | 0.14    | 11,800           |

Hubo un deployment el 29 de julio. LCP saltó de 2.1s a 3.2s, INP de 180ms a 320ms. La tasa de rebote subió 4.2%. RUM mostró esto en 2 horas — pero Lighthouse CI en laboratorio estaba bajo 2.0s; usuarios en dispositivos más lentos experimentaban realidad diferente.

Esta métrica llevó a una decisión de rollback. El deployment se revirtió, LCP volvió a 1.9s.

### Pipeline de Alarma RUM

No basta mostrar RUM solo en un dashboard. Necesitas alertas Slack ante regresiones. Puedes configurar una consulta BigQuery programada:

```sql
-- BigQuery scheduled query (cada hora)
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

Esta consulta verifica si LCP p75 se degradó más del 15% respecto al baseline. Si ocurre, una Cloud Function se activa y envía alerta a webhook Slack:

```
⚠️ Performance Regression Detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LCP p75: 3.2s (+68% vs baseline de 6h)
Baseline: 1.9s
URL: /product/xyz
Deploy: #4521 (hace 30 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Tradeoff: Sintético vs RUM — Cuándo Usar Cada Uno

Lighthouse CI y RUM se complementan — no es elegir uno; usa ambos en paralelo.

**Lighthouse CI (sintético):**
- **Ventaja:** Ambiente controlado, repetible, ejecuta en cada commit
- **Desventaja:** No captura variabilidad de dispositivos reales, no simula estado de cache
- **Uso:** En pipeline CI para prevención de regresión — "¿este PR corre riesgo de ralentización?"

**RUM (usuario real):**
- **Ventaja:** Datos de usuarios reales, captura edge cases (ej: "iPhone 11 Safari: LCP 5s")
- **Desventaja:** Datos ruidosos (muchos outliers), no avisa antes del deployment
- **Uso:** Monitoreo en vivo — "¿este nuevo deployment rompió rendimiento?"

Un sistema robusto usa ambos. Si Lighthouse presupuesto falla, deployment se bloquea. Si pasa, RUM valida números reales en 2 horas. Si RUM muestra regresión, haces rollback.

Ejemplo: agregar un nuevo selector de variantes en storefront Shopify. Lighthouse CI mostró 380ms TBT (presupuesto: 200ms). PR rechazado. El dev implementó code-split + lazy-load, Lighthouse mostró 150ms TBT, merge aprobado. 4 horas post-producción, RUM mostró INP p75 subiendo de 120ms a 145ms — aceptable (presupuesto 200ms). Deployment se mantuvo.

## Integrar Alarmas de Regresión en el Pipeline de Deployment

Una alarma RUM desconectada del deployment pierde contexto. Sabes que "LCP empeoró" pero no cuál deployment lo causó. Necesitas inyectar metadata del deployment en cada evento RUM.

Vercel/Netlify tiene variable de entorno `VERCEL_GIT_COMMIT_SHA`. La inyectas en frontend, agregándola a cada evento RUM:

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

En BigQuery, consultas así:

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

Resultado:

| deployment_id | deployed_at         | lcp_p75 | sample_size |
|---------------|---------------------|---------|-------------|
| a3f2b19       | 2026-07-30 14:22:00 | 3.1s    | 2,340       |
| c8d4e21       | 2026-07-30 09:15:00 | 1.9s    | 4,120       |

Deployment de 14:22 causó salto de LCP de 1.9s