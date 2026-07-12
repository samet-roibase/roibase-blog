---
title: "Presupuestos de Rendimiento Web: Vinculando Métricas a la Toma de Decisiones"
description: "Convierte el rendimiento web en KPIs medibles con Lighthouse CI, RUM y alertas de regresión. Vincula los datos a las decisiones empresariales."
publishedAt: 2026-07-12
modifiedAt: 2026-07-12
category: tech
i18nKey: tech-004-2026-07
tags: [web-performance, lighthouse-ci, rum, core-web-vitals, devops]
readingTime: 9
author: Roibase
---

El rendimiento web no es "que sea bueno", es un número que impacta las decisiones. En 2026, la métrica INP (que reemplazó a FID) determina que si no se mantiene bajo 200ms, la conversión mobile cae entre 15-20% (Google Chrome UX Report 2025 cohort). Para mantener ese nivel no basta intuición: necesitas control automático en tu pipeline CI. Lighthouse CI, RUM y un sistema de alarmas de regresión son esenciales. ¿Qué umbrales asignas a cada métrica? ¿Dónde se ancla cada dato en tu arquitectura de decisiones? Este artículo te muestra cómo vincular presupuestos de rendimiento a métricas reales con números concretos.

## Qué es un Presupuesto de Rendimiento y Cómo lo Amarras al Plan de Sprint

Un presupuesto de rendimiento define los límites máximos para el tiempo de carga, tamaño del bundle y métricas de runtime de una página. El bundle total no superará 250KB, FCP no tardará más de 1.2s, INP no excederá 200ms — estos son tus límites. Se definen al inicio del sprint y se convierten en criterios de merge para PRs. Si una feature nueva rompe estos límites, tienes que refactorizar el código, posponer la feature o actualizar el presupuesto (aceptando la pérdida de conversión que eso implica).

Para fijar presupuestos, utilizas tres fuentes: (1) los umbrales de Core Web Vitals de Google (LCP <2.5s, INP <200ms, CLS <0.1), (2) benchmark del p75 de RUM (si el 75% de tu tráfico está por debajo de ese nivel, es "bueno"), (3) reportes de correlación de conversión (si LCP sube 100ms, la conversión baja 2%, entonces mover de 2.5s a 3s significa perder 10%). El presupuesto no es un número único, sino desglosado por métrica:

| Métrica | Umbral | Fuente |
|---------|--------|--------|
| LCP | <2.5s | CWV oficial |
| INP | <200ms | CWV 2024+ |
| CLS | <0.1 | CWV oficial |
| Total JS | <300KB gzip | HTTP Archive p75 |
| FCP | <1.8s | RUM interno |

Escribes esta tabla en un archivo `performance.config.json`. Lighthouse CI lo lee, y si algún PR viola estos umbrales, rechaza el merge.

## Lighthouse CI: Tu Guardián de Rendimiento en Cada PR

Lighthouse CI es una herramienta de Google (código abierto) que ejecuta auditorías de Lighthouse en cada PR y compara los resultados contra tu presupuesto. Se integra con GitHub Actions, GitLab CI, CircleCI. El flujo es: (1) abres un PR, (2) CI ejecuta el build, (3) `lhci autorun` visita tu página en el entorno de prueba, (4) compara los scores de Lighthouse contra los umbrales en `performance.config.json`, (5) si hay violaciones, el PR falla y no se puede mergear.

Ejemplo de configuración (`.lighthouserc.json`):

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

Si LCP supera 2.5s, el PR se rechaza. Si el total de bytes pasa 300KB, genera una advertencia (no bloquea el merge, pero aparece en logs). Se ejecutan 3 auditorías y se promedian, porque una sola puede tener varianza por la red. La limitación de Lighthouse CI es que corre en un servidor local, no simula la CDN de producción. Los resultados son "peor caso posible", pero en producción suele ir mejor — aun así, no debes saltarte estos umbrales.

### Lighthouse CI + Vercel Preview: Testing en Ambiente Real

En plataformas como Vercel o Netlify, cada PR genera una URL de preview automáticamente. Si conectas Lighthouse CI a esa URL, estás testeando en un ambiente quasi-producción. Ejemplo con GitHub Actions:

```yaml
- name: Run Lighthouse CI
  env:
    LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_TOKEN }}
  run: |
    npm install -g @lhci/cli
    lhci autorun --collect.url=${{ steps.vercel.outputs.preview-url }}
```

`steps.vercel.outputs.preview-url` viene de la action de Vercel. Ahora puedes testear caché CDN, SSR en edge, optimización de imágenes. Si el presupuesto se viola, Lighthouse CI comenta en tu PR y puedes notificar al equipo via Slack (con webhooks).

## RUM: Calibrando tu Presupuesto con Datos Reales de Usuarios

Lighthouse CI es testing sintético — entorno controlado, siempre las mismas condiciones de red. RUM (Real User Monitoring) captura datos de usuarios reales. La diferencia es crítica: Lighthouse simula 3G throttled, RUM muestra mezcla de 4G, 5G, fibra; Lighthouse testea caché frío, RUM captura usuarios que repiten. Si calibras presupuestos solo con Lighthouse, pierdes la experiencia real.

Para recopilar RUM, usa la librería Web Vitals de Google (oficial). Cada carga de página mide Core Web Vitals y envía datos a tu endpoint. Implementación:

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

Tu backend escribe en BigQuery (mejor que GA4, que muestrea). En BigQuery, calculas el p75:

```sql
SELECT
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS p75_lcp
FROM metrics
WHERE name = 'LCP' AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY);
```

Si sale 2.8s y tu presupuesto es 2.5s, tienes dos opciones: sube el presupuesto a 2.8s (aceptando la pérdida de conversión) u optimiza el código. El p75 es importante porque Google también lo usa para Core Web Vitals scores — si el p75 está bien, los señales de Google también.

### RUM + Segmentación: Presupuestos Diferentes por Dispositivo y Región

No todos los usuarios son iguales. Mobile LCP es ~40% más alto que desktop (Chrome UX Report 2025). Tráfico de India es ~60% más lento que de EEUU. Segmenta tu RUM y diferencia presupuestos:

| Segmento | Presupuesto LCP | Presupuesto INP |
|----------|-----------------|-----------------|
| Desktop | 2.2s | 180ms |
| Mobile | 3.0s | 220ms |
| India | 3.5s | 250ms |

Para esto, añade `deviceType` y `country` (vía GeoIP) a tus beacons de RUM. En BigQuery, haces `GROUP BY device, country`. Lighthouse CI no soporta multi-config directo, pero puedes crear workflows separados (`lhci-mobile.json`, `lhci-desktop.json`).

## Alarmas de Regresión: El Rendimiento Cae, Slack Grita

Presupuestos definidos, CI monitoreando PRs, RUM recopilando datos — pero ¿y si en producción el rendimiento cae? Después de un deploy, LCP sube de 2.3s a 2.9s. No quieres enterarte 3 horas después; necesitas alarma en 5 minutos. Para eso, tienes un job que analiza RUM cada 5 minutos y compara contra baseline.

Lógica pseudo-código:

```javascript
// Job que corre cada 5 minutos
async function checkRegression() {
  const current = await query('SELECT AVG(value) FROM metrics WHERE name="LCP" AND timestamp > NOW() - INTERVAL 5 MINUTE');
  const baseline = await query('SELECT AVG(value) FROM metrics WHERE name="LCP" AND timestamp BETWEEN NOW() - INTERVAL 1 DAY AND NOW() - INTERVAL 1 HOUR');
  
  if (current > baseline * 1.15) { // +15% es regresión
    await sendSlack({
      text: `🚨 Regresión de LCP: ${current}ms (baseline ${baseline}ms)`,
      channel: '#performance-alerts'
    });
  }
}
```

El baseline es de hace 1 hora (antes del deploy probable). Umbral de +15% es empírico — +10% dispara demasiadas falsas alarmas, +25% es demasiado tarde. Puedes integrar PagerDuty u Opsgenie para on-call. Cuando salta la alarma, el equipo decide: ¿rollback o hotfix?

### Root Cause: Lighthouse Diff

Saltó alarma de regresión, ¿por qué subió LCP? Lighthouse CI solo te dice si violas umbral, no te da causa. Para eso usas `lhci compare`, que compara dos auditorías:

```bash
lhci compare --base=build-1234 --head=build-1235 --preset=lighthouse:all
```

Output: "unused-javascript aumentó 45KB", "server-response-time +120ms". Ahora sabes qué buscar. Con bundle analyzer (webpack-bundle-analyzer, Next.js `analyze`) encuentras de dónde vino ese JS. Con server logs encuentras por qué tardó 120ms más.

## Vinculando Rendimiento a Conversión: Attribution

Presupuestos son números técnicos, pero para decisiones empresariales necesitas convertirlos a impacto en conversión. "Si LCP sube de 2.5s a 3s, conversión baja 4%." Este número sale de A/B test o análisis de cohortes.

**A/B test:** 50% del tráfico ve la versión lenta (Lighthouse + 500ms artificial), 50% la versión normal. Se comparan tasas de conversión.

**Análisis de cohortes:** Segmentas usuarios por LCP (RUM), comparas conversión:

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

Tabla resultante:

| LCP Bucket | Conversion Rate |
|------------|-----------------|
| fast | 4.2% |
| medium | 3.6% |
| slow | 2.9% |

Reducir LCP de 3s a 2.5s sube conversión de 3.6% a 4.2%, +16.7% lift. Con 100K visitas/mes, son +1670 conversiones. Si AOV es $50, es +$83K revenue/mes. Así presentas el caso al CFO — el sprint de optimización de rendimiento vale la pena.

### Violación de Presupuesto: Análisis de Tradeoff

Nueva feature llega, suma 50KB al bundle, viola el presupuesto. Opciones: (1) refactorizar (code splitting, lazy load), (2) subir presupuesto (y aceptar pérdida de conversión), (3) posponer feature.

Decisión basada en números: 50KB extra = +200ms LCP (por Lighthouse trace). +200ms = -2% conversión (por RUM correlation). Si la feature agrega 5% de lift en conversión, ganancia neta es 3%. Si suma 1%, pierdes 1% — pospón.

Herramienta interna: "performance cost estimator". Input: delta de bundle. Output: delta LCP estimado + impacto de conversión. Modelo simple: cada 10KB = +30ms LCP, cada 100ms LCP = -0.8% conversión (valores de tu RUM). Lo presentas a PM, el roadmap se prioriza por ROI.

## Headless Commerce: Presupuesto Vinculado a Velocidad de Producto

En e-commerce, rendimiento = ingresos. Arquitecturas [headless](https://www.roibase.com.tr/es/headless) (Shopify Hydrogen, Remix, Next.js) te dan control del frontend pero la latencia de API backend también cuenta. Storefront API de Shopify tarda ~150ms en responder, eso entra en tu presupuesto: LCP = TTFB (150ms) + FCP (800ms) + delta LCP (600ms) = 1550ms. Presupuesto 2500ms = 950ms de margen.

Fuentes de regresión en headless: (1) GraphQL queries más complejas (+50ms), (2) más componentes SSR (+100ms hydration), (3) scripts de terceros (+200ms). Lighthouse CI no distingue estas causas; necesitas Server-Timing headers. Next.js middleware:

```javascript
export function middleware(req) {
  const start = Date.now();
  const res = NextResponse.next();
  res.headers.set('Server-Timing', `api;dur=${Date.now() - start}`);
  return res;
}
```

En DevTools verás Server-Timing. Lo mandas al beacon RUM y monitoreas regresiones por componente.

---

Vincular presupuestos de rendimiento web a toma de decisiones requiere tres capas: (1) Lighthouse CI en CI/CD para control de umbrales, (2) RUM con datos reales para calibrar presupuestos y segmentar por device/región, (3) alarmas de regresión + atribución a conversión para impacto empresarial. Los presupuestos no son números fijos — se diferencian por segmento. Cuando