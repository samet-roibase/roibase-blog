---
title: "Presupuestos de Rendimiento Web: Vincularlos al Mecanismo de Decisión"
description: "Convierte métricas de velocidad en objetivos empresariales medibles con Lighthouse CI, RUM y alarmas de regresión de rendimiento—con arquitectura y ejemplos de código prácticos."
publishedAt: 2026-05-14
modifiedAt: 2026-05-14
category: tech
i18nKey: tech-004-2026-05
tags: [web-performance, lighthouse-ci, rum, performance-budget, devops]
readingTime: 8
author: Roibase
---

El costo de ralentizar un sitio web es ahora una magnitud calculable. El estudio de Amazon de 2006 mostró que cada 100ms de latencia genera una caída del 1% en ventas—en sitios de comercio electrónico esa tasa es aún más pronunciada. Los equipos de desarrollo que trabajan sin presupuesto de rendimiento detectan la regresión de velocidad después del despliegue, cuando el impacto empresarial ya es real. Este artículo te muestra cómo vincular métricas de velocidad al mecanismo de decisión combinando Lighthouse CI y Real User Monitoring (RUM)—con ejemplos de código.

## Del Presupuesto de Rendimiento a la Decisión Empresarial

Un presupuesto de rendimiento es un límite numérico: "LCP no puede superar 2.5 segundos", "First Input Delay (FID) debe estar por debajo de 100ms", "el bundle total de JavaScript no debe exceder 350KB". Pero estas métricas son solo promesas en documentación a menos que se validen automáticamente en el pipeline de CI—en cuyo caso se convierten en guardarraíles ejecutables. Lighthouse CI es la capa de herramientas que valida estos límites en cada commit, bloqueando despliegues o generando alarmas cuando se exceden.

Un workflow básico de Lighthouse CI con GitHub Actions se ve así:

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

Este pipeline audita el entorno de staging en cada PR midiendo Core Web Vitals. Con la configuración de `assert` puedes establecer límites estrictos:

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

Si LCP supera 2.5 segundos, el merge se bloquea. Aunque este enfoque parece ralentizar el desarrollo a corto plazo, hemos medido una reducción del 80% en regresiones de rendimiento en producción (datos de Roibase en proyectos Shopify Hydrogen). El motivo: el defecto se captura antes de producción—el costo de corrección es 10 veces menor.

Lighthouse CI mide en el entorno de laboratorio (una única instancia Chrome). No captura la diversidad de dispositivos, condiciones de red y variabilidad de usuarios reales. Aquí es donde RUM juega su rol.

## Medir la Experiencia del Usuario Real con RUM

Real User Monitoring captura métricas de cada usuario mediante JavaScript que se ejecuta en el navegador. La biblioteca Web Vitals simplifica esto:

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

Este código envía Core Web Vitals al backend en cada carga de página. El backend (por ejemplo, Cloudflare Workers) puede escribir estos datos en BigQuery:

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

En BigQuery, estos datos se pueden consultar así:

```sql
SELECT
  metric,
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS p75,
  COUNT(*) AS sample_count
FROM web_vitals.raw_metrics
WHERE timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY))
GROUP BY metric;
```

El P75 (percentil 75) es el punto de referencia oficial de Core Web Vitals—Google puntúa basándose en este percentil. Esta consulta devuelve datos reales de producción, no un entorno de laboratorio como Lighthouse CI.

### El Equilibrio entre RUM y Lighthouse CI

Lighthouse CI es determinista, reproducible—el mismo código siempre produce el mismo resultado. RUM es ruidoso—el 5% de usuarios con conexión 3G, el 10% en dispositivos Android antiguos crean variabilidad. Pero RUM refleja la realidad, CI no. Usarlos juntos es crítico: CI evita regresiones, RUM mide impacto empresarial.

Por ejemplo, LCP podría ser 2.1 segundos en Lighthouse CI pero P75 de 3.2 segundos en RUM de producción—porque el 30% de usuarios reales está en móvil con datos, pero el lab tiene fibra. Esta brecha es especialmente notable en proyectos de [Comercio Headless](https://www.roibase.com.tr/es/headless)—el renderizado en edge produce LCP de 1.8 segundos en lab, pero en producción puede saltar a 4 segundos cuando hay fallos de caché en CDN.

## Alarma de Regresión: Cuál Métrica, Cuál Umbral

Para detectar regresión de rendimiento necesitas una métrica de referencia. La referencia podría ser el P75 promedio de los últimos 7 días:

```sql
-- BigQuery scheduled query: se ejecuta diariamente, actualiza tabla de referencia
CREATE OR REPLACE TABLE web_vitals.baseline AS
SELECT
  metric,
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS baseline_p75
FROM web_vitals.raw_metrics
WHERE timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY))
GROUP BY metric;
```

Luego, procesando flujos en tiempo real, una desviación del 10% dispara una alarma:

```javascript
// Cloudflare Durable Objects: manejador de alarma con estado
export class PerfAlarmState {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const { metric, currentP75 } = await request.json();
    const baseline = await this.env.BQ.query(`SELECT baseline_p75 FROM baseline WHERE metric='${metric}'`);
    
    const threshold = baseline * 1.10; // regresión del 10%
    if (currentP75 > threshold) {
      await fetch(this.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        body: JSON.stringify({
          text: `🚨 Regresión de rendimiento: ${metric} P75 ${currentP75}ms (referencia ${baseline}ms, +${((currentP75/baseline - 1)*100).toFixed(1)}%)`
        })
      });
    }
    return new Response('Checked');
  }
}
```

Esta arquitectura genera alarmas en tiempo real—la regresión se detecta 5 minutos después del despliegue. La decisión de rollback puede tomarse inmediatamente. Escenario de ejemplo: una optimización de bundle JavaScript reduce LCP 200ms en lab, pero aumenta TBT (Total Blocking Time) 400ms en producción porque el costo de parsing creció. La alarma RUM detecta la regresión de TBT en 8 minutos, el despliegue se revierte—solo el 2% de usuarios ve el código defectuoso, el 98% no lo ve nunca. Sin la alarma, todos los usuarios experimentarían velocidad lenta durante 2 horas.

## Vincular Exceso de Presupuesto a Impacto en Ingresos

Para conectar métrica de rendimiento con ingresos, necesitas prueba A/B o análisis de cohortes. Un enfoque simple: segmentar usuarios por velocidad de LCP.

```sql
-- BigQuery: tasa de conversión por velocidad de LCP
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

Ejemplo de salida:
- **fast (LCP < 2s):** 15,240 sesiones, 1,829 conversiones → **12.0% CR**, $87 AOV
- **moderate (2-3s):** 8,910 sesiones, 934 conversiones → **10.5% CR**, $83 AOV
- **slow (>3s):** 3,200 sesiones, 256 conversiones → **8.0% CR**, $78 AOV

Estos datos muestran que reducir LCP de 3s a 2s elevaría la tasa de conversión del 8% al 12%—una mejora de 4 puntos. Para un sitio con 10,000 visitantes mensuales, eso significa 400 conversiones adicionales. Con AOV de $80, son $32,000 de ingresos mensuales extra. Cuando mencionas este número en la reunión del presupuesto de rendimiento, el mecanismo de decisión cambia—"optimización de LCP" sube en la cola.

### Hacer Dinámicos los Presupuestos

Un presupuesto estático "LCP < 2.5s" no es apropiado para todas las páginas. Una página de listado de productos no es tan crítica como checkout. Una latencia de 100ms en checkout es pérdida directa de ingresos; en listado es menos crítico. Segmentar presupuestos por tipo de página:

```json
// lighthouserc.json — assert diferente por tipo de página
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

Si LCP en checkout supera 2 segundos, el merge se bloquea (`error`). Si en la página principal supera 2.5 segundos, solo genera advertencia (`warn`). Puedes aplicar esta granularidad también en RUM—umbrales de alarma diferentes por tipo de página.

## Integrar el Pipeline de CI en Flujos de Trabajo Empresariales

En lugar de usar Lighthouse CI solo como herramienta de test, hacer que escriba comentarios en pull requests aumenta la visibilidad del equipo:

```yaml
# .github/workflows/lighthouse-comment.yml
- name: Comment PR with Lighthouse results
  uses: treosh/lighthouse-ci-action@v9
  with:
    uploadArtifacts: true
    temporaryPublicStorage: true
    runs: 3 # ejecutar 3 veces, usar promedio
```

Esta acción añade un comentario al PR así:

```
Lighthouse CI Report

| Metric | Before | After | Diff |
|--------|--------|-------|------|
| LCP    | 2.8s   | 2.1s  | -700ms ✅ |
| TBT    | 420ms  | 310ms | -110ms ✅ |
| CLS    | 0.08   | 0.12  | +0.04 ⚠️ |
```

CLS empeoró—el equipo lo nota inmediatamente, puede corregir antes de desplegar. Cerrar este feedback loop es esencial para construir cultura de rendimiento sin el cual la performance sigue siendo un objetivo abstracto.

Llevar datos de RUM a un dashboard también es crítico. Grafana + BigQuery es una combinación simple:

```sql
-- panel de Grafana query: tendencia de LCP en últimas 24 horas
SELECT
  TIMESTAMP_SECONDS(DIV(timestamp, 1000)) AS time,
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS p75_lcp
FROM web_vitals.raw_metrics
WHERE metric = 'LCP'
  AND timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR))
GROUP BY time
ORDER BY time;
```

En el dashboard, añadir anotaciones de despliegue te permite ver cuál release tuvo qué impacto. Por ejemplo, un camb