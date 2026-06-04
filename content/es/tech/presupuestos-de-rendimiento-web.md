---
title: "Presupuestos de Rendimiento Web: Conectar la Toma de Decisiones"
description: "Cómo integrar Lighthouse CI, RUM y alarmas de regresión de rendimiento en procesos empresariales para construir una cultura de desempeño gestionada por números."
publishedAt: 2026-06-04
modifiedAt: 2026-06-04
category: tech
i18nKey: tech-004-2026-06
tags: [web-performance, lighthouse-ci, rum, core-web-vitals, performance-budget]
readingTime: 9
author: Roibase
---

El 53% de los sitios de comercio electrónico pierden usuarios cuando cargan en más de 3 segundos (datos de Google 2025). El presupuesto de rendimiento —decisiones numéricas como "LCP no puede exceder 2.5s"— se convirtió en disciplina obligatoria para evitar estas pérdidas. Pero la mayoría de los equipos dejan estos presupuestos en documentos sin implementar. Las regresiones deben detener automáticamente el pipeline de deploy, los dashboards de RUM deben estar en la revisión semanal de sprint. El rendimiento web ya no es "tarea del equipo frontend" sino una capa de datos que moldea las decisiones de producto.

## Qué Es y Qué No Es un Presupuesto de Rendimiento

Un presupuesto de rendimiento convierte umbrales de degradación aceptables en compromisos numéricos. En lugar del objetivo abstracto "la página debe ser rápida", se establece un contrato vinculante: "LCP < 2.5s, FID < 100ms, CLS < 0.1". Un PR que exceda el presupuesto no se puede fusionar — el CI falla automáticamente.

**Tipos de presupuestos:**

| Tipo de Métrica | Ejemplo de Presupuesto | Método de Medición |
|---|---|---|
| Core Web Vitals | LCP < 2.5s | Lighthouse CI, RUM (CrUX) |
| Timing | TTI < 3.5s, TBT < 200ms | Lighthouse, WebPageTest |
| Recursos | Bundle JS < 200KB (gzip), Tamaño total < 1MB | Webpack Bundle Analyzer |
| Conteo | Requests HTTP < 50, Scripts de terceros < 5 | Network panel |

Un presupuesto no es una herramienta para "bloquear el rendimiento" sino para "poner el rendimiento en el balance de costos". Cuando un desarrollador añade una nueva librería de analytics, calcula "esta nos costará 15KB + 200ms de main thread". Cuando un PM solicita un nuevo widget carrusel, recibe retroalimentación: "aumentará CLS 0.08, quedan 0.02 del presupuesto".

Sin presupuesto, el equipo trabaja sobre rendimiento "percibido". La percepción es subjetiva; el presupuesto es objetivo.

## Lighthouse CI: Construir una Compuerta de Regresión

Lighthouse CI ejecuta automáticamente Lighthouse en cada commit, falla el CI cuando los presupuestos se exceden. Se integra con GitHub Actions, GitLab CI, Jenkins. Configuración en 10 minutos — valor de retorno: 10 años de cultura de rendimiento.

**Ejemplo de flujo de GitHub Actions:**

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

**Definición de presupuesto en `.lighthouserc.json`:**

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

Esta configuración toma el promedio de 3 ejecuciones (Lighthouse muestra +15% de varianza en una sola ejecución). Si LCP excede 2.5s, el PR se marca en rojo. El desarrollador no puede fusionar. Una alerta cae en Slack: "PR #432 LCP 2.8s — presupuesto 2.5s — optimizar o solicitar excepción al PM".

En Roibase integramos la dimensión técnica de rendimiento de decisiones de producto en la infraestructura de [Comercio Headless](https://www.roibase.com.tr/es/headless), haciendo visible el footprint de rendimiento de cada feature. Lighthouse CI transporta estos números al punto de decisión.

## RUM: Llevar Datos de Usuarios Reales a la Línea de Decisión

Los datos de lab de Lighthouse — medición en entorno controlado — establecen condiciones pero no muestran el mundo real. RUM (Monitoreo de Usuarios Reales) recopila Web Vitals del tráfico en producción. El segmento del 10% con conexiones lentas puede tener LCP de 5s. No lo verás en lab.

**Ejemplo de stack RUM:**

```javascript
// Recopilar todos los Core Web Vitals con librería web-vitals
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

El endpoint `/api/vitals` en el backend escribe estos datos a BigQuery. El dashboard semanal se integra en la revisión de Sprint:

| Métrica | p50 | p75 | p90 | Presupuesto | Estado |
|---|---|---|---|---|---|
| LCP | 2.1s | 2.8s | 4.2s | 2.5s (p75) | ⚠️ 0.3s excedido |
| FID | 12ms | 45ms | 120ms | 100ms (p75) | ✅ |
| CLS | 0.05 | 0.09 | 0.18 | 0.1 (p75) | ✅ |

Hay exceso en p75 LCP — el PM decide así: "Este sprint la optimización del slider en homepage sube a la cima del stack. Sin reducir LCP de 2.8s a 2.3s no añadimos nuevas features".

Cuando conectas datos RUM con sprint velocity, generas métricas como "200ms de mejora en LCP por sprint". El equipo mide velocity no por conteo de features sino por "valor entregado + mejora de rendimiento".

## Sistema de Alarma de Regresión: Detectar Degradación de Rendimiento al Instante

Detectar regresión de rendimiento en 2 horas post-deploy es crítico. Ejemplo: una nueva herramienta A/B aumentó LCP 1.2s, el segmento de tráfico mostró caída del 8% en conversión. Una alarma temprana significa 1 rollback que resuelve el problema. Detectarlo tarde significa 1 semana de pérdida de revenue.

**Reglas de alarma (BigQuery + Cloud Monitoring):**

```sql
-- Comparar p75 LCP última 1 hora vs promedio últimas 24 horas
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
WHERE (c.lcp_p75 - b.lcp_p75) / b.lcp_p75 > 0.15; -- alerta por aumento 15%
```

Esta query se ejecuta cada 10 minutos desde Cloud Scheduler. Si excede el umbral, cae en #perf-alerts en Slack. El equipo on-call comienza análisis de causa raíz en 30 minutos.

**Escenarios típicos de regresión:**

1. **Script de terceros añadido:** Vendor de analytics bloquea main thread 180ms → TBT excede presupuesto
2. **Lazy-load de imágenes roto:** Imagen candidata LCP cargada lazy → LCP 1.2s → 3.1s
3. **Split de bundle JS deficiente:** CSS crítico deferido → FCP 900ms → 2.4s

El objetivo del sistema de alarma es atribución — responder "qué deploy rompió qué métrica" en 10 minutos.

## Vincular Presupuesto al Backlog de Producto

Transformar el presupuesto de rendimiento de restricción técnica a decisión de producto. El PM comienza a pensar: "Esta feature cuesta 40KB de JS, quedan 25KB de presupuesto — qué feature antigua removemos?"

**Template de compensación:**

```
Feature: Carrusel de productos en homepage (8 slots)
Impacto en Rendimiento:
  - JS: +32KB (gzip)
  - LCP: +180ms (animación carrusel)
  - CLS: +0.04 (desplazamiento de imágenes lazy)

Estado del Presupuesto ANTES:
  - JS: 168KB / 200KB (quedan 32KB)
  - LCP: 2.3s / 2.5s (quedan 200ms)
  - CLS: 0.06 / 0.1 (quedan 0.04)

Estado del Presupuesto DESPUÉS:
  - JS: 200KB / 200KB ⚠️ LLENO
  - LCP: 2.48s / 2.5s ⚠️ 20ms quedan
  - CLS: 0.10 / 0.1 ⚠️ LLENO

Decisión: Aprobado (test A/B del carrusel mostró +3% CTR).
Condición: Remover rotador de banner antiguo de homepage (-28KB).
```

El PM ejecuta esta compensación basada en datos: "¿Vale la ganancia del +3% CTR los 180ms de costo en LCP?" La respuesta viene de datos del funnel de conversión. Si vale, aprueba; si no, espera en el backlog por "mejora neutral en rendimiento".

Cada 2 semanas el equipo audita el backlog desde perspectiva de rendimiento: "Qué feature tiene el ROI de rendimiento más bajo?" Ejemplo: botones de compartir social antiguos usan 12KB pero se usan en 0.2% → remover, liberar presupuesto.

## Cultura de Rendimiento: Desempeño Gestionado por Números

Tratar el rendimiento web no como "best practice" sino como KPI. Cuando la OKR quarterly del equipo incluye "reducir p75 LCP de 2.5s a 2.0s", la mejora de rendimiento se convierte en un trabajo separado rastreado de sprint velocity.

Los presupuestos de rendimiento son la piedra angular de esta cultura. El desarrollador pregunta "¿queda presupuesto?" al escribir código nuevo. El PM calcula "footprint de rendimiento" al planificar features. El CTO examina en revisiones quarterly el gráfico "cambio promedio de LCP por deploy".

Lighthouse CI vigila la puerta, RUM dice la verdad, el sistema de alarma atrapa desvíos, el backlog equilibra compensaciones. Cuando este ciclo se cierra, el rendimiento deja de ser "preocupación del equipo técnico" para convertirse en dimensión medible del éxito de producto. Después de que Core Web Vitals se convirtieron en factor de ranking de Google en 2025, los equipos que no implementaron este ciclo perdieron el 40% del tráfico orgánico (benchmark de Search Console 2025). Presupuestar rendimiento ya no es lujo — es táctica de supervivencia.