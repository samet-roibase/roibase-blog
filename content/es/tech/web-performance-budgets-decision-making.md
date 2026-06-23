---
title: "Web Performance Budgets: Vincularlos al Mecanismo de Decisión"
description: "Integrar Lighthouse CI, RUM y alarmas de regresión de rendimiento. La metodología detrás de reducir TBT de 2190 ms a 200 ms."
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: tech
i18nKey: tech-004-2026-06
tags: [web-performance, lighthouse-ci, rum, core-web-vitals, performance-budget]
readingTime: 8
author: Roibase
---

En 2026, el rendimiento web ya no es "hacer que las páginas se carguen rápido", sino una disciplina de ingeniería donde se toman decisiones de forma continua. Despliegas un sitio de comercio electrónico, la puntuación de Lighthouse cae de 92 a 68, la tasa de conversión baja de 3,2 % a 2,7 % — pero nadie se da cuenta porque el monitoring se limita a "¿está el servidor caído?". Vincular el presupuesto de rendimiento al mecanismo de decisión significa capturar regresiones antes del despliegue, evaluar cada commit según umbrales de LCP/TBT/CLS e inyectar datos de RUM en tu pipeline de atribución. En este artículo mostraremos cómo integrar Lighthouse CI, monitoreo sintético, RUM y arquitectura de alarmas en un sistema coherente.

## Qué es un Performance Budget y Por Qué Debe Medirlo un Sistema, No una Persona

Un presupuesto de rendimiento define límites de recursos por página: tamaño máximo de bundle JavaScript (p. ej. 200 KB gzip), TBT máximo (Total Blocking Time, 200 ms), LCP máximo (Largest Contentful Paint, 2,5 segundos). Estos números no son arbitrarios — los umbrales Core Web Vitals de Google definen bandas de "bueno", pero necesitas derivar límites más estrictos a partir de datos de tu propio funnel de conversión.

El escenario clásico "Lighthouse 95 en desarrollo, 72 en producción" ocurre porque: las pruebas sintéticas se ejecutan en condiciones de laboratorio (4G rápido, caché vacía, una sola carga de página), mientras que RUM captura al usuario real con su 3G, caché llena y rutas de navegación variadas. Ambas métricas son normales pero deben monitorearse. Lighthouse CI atrapa regresiones de tamaño de bundle en cada PR; RUM dice "el 22 % de usuarios móviles tienen LCP por encima de 4 segundos" — es realidad de producción. Si defines el presupuesto solo como "superar la puntuación de 75", puedes agregar 100 KB al bundle, subirla de 74 a 76 — la página se hace más pesada pero el score es verde. Por eso debes mantener presupuestos duales: *basados en métricas* (LCP, TBT, CLS) *y basados en recursos* (JS, CSS, tamaño de imágenes).

Otro punto: para hacer cumplir el presupuesto, la revisión humana es insuficiente. "Revisamos el rendimiento en code review" no escala a 20 PRs por día. El sistema debe medir, el sistema debe fallar, los humanos solo investigan el porqué.

## Lighthouse CI: Gating de Rendimiento por Commit

Lighthouse CI ejecuta automáticamente la auditoría de Lighthouse en cada commit o PR y reporta resultados en GitHub o a un dashboard interno. Así se integra en tu pipeline de CI:

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

En tu config `.lighthouserc.json` defines los presupuestos:

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

Con esta configuración, si un PR agrega 50 KB de JS extra y el TBT supera 200 ms, CI falla y el merge se bloquea. En Roibase, usando este enfoque con clientes que transitaban a [Headless Commerce](https://www.roibase.com.tr/es/headless), redujimos el TBT promedio de 2190 ms a 200 ms — porque cada adición de librería se probaba contra el presupuesto.

### Limitaciones de Lighthouse CI y Decisiones Arquitectónicas

Lighthouse CI realiza pruebas sintéticas: ancho de banda fijo (Moto G4, emulación slow 4G), throttle de CPU (desaceleración de 4x), una sola página. El usuario real está en un dispositivo diferente, sigue rutas distintas (página de producto → carrito → checkout), ve variantes de pruebas A/B. Por eso coloca Lighthouse CI como una *barra mínima* — si pasa, se puede desplegar, pero pasar no significa 100 puntos en producción. Para medir la realidad de producción necesitas RUM.

## RUM (Monitoreo de Usuarios Reales): Convirtiendo la Realidad de Producción en Datos de Decisión

RUM recopila métricas de usuarios reales: Navigation Timing API, PerformanceObserver, CrUX (Chrome User Experience Report). Un vendor que lo proporciona (Speedcurve, Sentry Performance, Cloudflare Web Analytics) o tu propio stack de logging (librería web-vitals + BigQuery).

Una integración mínima de `web-vitals`:

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

Subes estos datos a BigQuery y luego los fusionas con datos de atribución de marketing usando dbt:

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

Esta tabla te muestra "cuando LCP está por debajo de 2,5 segundos, CVR es 3,4 %; por encima, es 2,1 %". Cuando reportas esto al CMO, el pedido vago "optimicemos el rendimiento" se convierte en concreto: "si bajamos LCP a menos de 2,5 segundos, generaríamos $18K de ingresos adicionales al mes".

## Vincular Alarmas de Regresión a Integración Slack/PagerDuty

Una vez que recopiles datos de RUM, necesitas detectar regresiones automáticamente. Por ejemplo, si tu promedio de los últimos 7 días es LCP de 2,2 segundos pero hoy sube a 3,1, es una regresión — por despliegue o problema de CDN. Esta alarma debe dispararse automáticamente, no mediante control manual de dashboard.

### Alertas Basadas en Métricas con DataDog

DataDog parsea automáticamente las métricas de RUM y ejecuta detección de anomalías. Una definición de monitor:

```json
{
  "name": "LCP Regression - Desktop",
  "type": "metric alert",
  "query": "avg(last_1h):avg:rum.largest_contentful_paint{device:desktop} > 2500",
  "message": "LCP desktop ha superado 2500ms en la última 1 hora. Último despliegue: {{deploy.id}}. @slack-perf-alerts @pagerduty",
  "tags": ["service:ecommerce", "env:production"],
  "thresholds": {
    "critical": 2500,
    "warning": 2200
  }
}
```

Cuando esta alarma se dispara, cae en el canal Slack, abre un incident en PagerDuty y despierta al desarrollador on-call. Si el mensaje tiene el ID del despliegue (viene de un tag del pipeline de CI), encuentras la regresión en 30 segundos.

### Dirigir Fallos de Threshold de Lighthouse CI como Alarmas También

Algunos equipos no dejan el fallo de Lighthouse CI solo como un bloqueo de PR, sino que también envían una notificación a Slack:

```yaml
# .github/workflows/lighthouse-ci.yml (paso adicional)
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

Así el ingeniero abre un PR y recibe tanto un tick rojo en CI como una notificación de Slack — la atención se captura instantáneamente.

## Integrar Presupuestos a tu Sistema de Feature Flags

Algunas características son inherentemente pesadas: widget de chat en vivo (80 KB JS), motor de personalización (150 KB + costo de runtime), reproductor de video (200 KB). En lugar de desplegarlas para todos, prueba el presupuesto de rendimiento en un segmento que no lo exceda (p. ej. desktop + conexión rápida) y abre de forma gradual.

En LaunchDarkly o tu propio sistema de feature flags, puedes definir reglas:

```javascript
// featureFlags.js
import { getConnectionSpeed } from './utils';

export function shouldEnableChatWidget(user, vitals) {
  const is4G = getConnectionSpeed() === '4g';
  const goodLCP = vitals.lcp < 2000;
  
  return is4G && goodLCP && user.tier === 'premium';
}
```

Con este enfoque, la decisión de "agreguemos un widget de chat" no conlleva riesgo de "LCP se incrementa 300 ms para todos" — se abre solo en segmentos que cumplen condiciones, se recopilan datos de RUM, se mide el impacto en CVR, y luego haces rollout completo o lo retiras. Al compartir esta decisión de trade-off con marketing y product, lo demuestras numéricamente: "El widget de chat incrementa CVR 0,4 % pero LCP sube a 2,8 segundos — impacto neto de ingresos +$8K pero experiencia degradada. ¿Cómo procedemos?"

## Hacer Cumplir el Presupuesto de Rendimiento en Headless Commerce

La arquitectura headless commerce (p. ej. Shopify Hydrogen, Next.js + Shopify API) generalmente es más rápida que Liquid porque tienes control del JavaScript del lado del cliente — puedes hacer hidratación selectiva. Pero con control viene riesgo de regresión — una actualización de paquete npm puede agregar 70 KB al bundle.

En Roibase, bajo [Shopify Partner Services](https://www.roibase.com.tr/es/shopify), aplicamos este flujo en transiciones headless:

1. **Establecer línea base:** Recopila datos de RUM en tu tema Liquid actual (30 días). Registra valores medianos de LCP, TBT, CLS.
2. **Gate del prototipo headless con Lighthouse CI:** Cada commit debe cumplir con el presupuesto en `.lighthouserc.json`. El primer despliegue debe ser 20 % mejor que la línea base.
3. **Comparación de RUM en producción:** En los primeros 7 días, ejecuta una prueba A/B enviando el 10 % del tráfico a la nueva versión headless, compara métricas de RUM.
4. **Establecer alarmas de regresión:** Después de migrar, fija monitores de DataDog: LCP < 2,5 segundos, TBT < 200 ms.
5. **Revisión trimestral:** Cada trimestre, audita tamaño de bundle, limpia dependencias sin usar.

Con un cliente de comercio electrónico, este proceso resultó en: Liquid LCP 4,1 segundos → Hydrogen LCP 1,8 segundos, CVR de 2,3 % a 3,1 % (+35 %). Pero 6 meses después, con nuevas características, LCP subió a 2,9 segundos, CVR bajó a 2,9 % — porque el enforcement de presupuesto se relajó. Cuando reaplicamos el presupuesto, en 2 semanas bajó a 2,1 segundos.

## Trade-off: Velocidad vs