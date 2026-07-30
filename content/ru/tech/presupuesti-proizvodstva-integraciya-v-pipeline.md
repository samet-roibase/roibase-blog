---
title: "Бюджеты производительности: Связывание с механизмом принятия решений"
description: "Интеграция Lighthouse CI, RUM и алармов регрессии производительности в CI/CD pipeline для остановки замедления на этапе развёртывания — реальные сценарии применения."
publishedAt: 2026-07-30
modifiedAt: 2026-07-30
category: tech
i18nKey: tech-004-2026-07
tags: [web-performance, lighthouse-ci, rum, performance-budget, core-web-vitals]
readingTime: 9
author: Roibase
---

Обнаружить регрессию производительности после развёртывания в production — всё равно что проверить курс валюты уже после сделки. По отчёту Google Commerce Signals за 2026 год каждые дополнительные 100 мс LCP приводят к увеличению bounce rate на 3,5 %. Мы ловим баги на этапе развёртывания в CI/CD pipeline точно так же, как мы ловим там регрессии производительности. В этой статье покажем, как интегрировать Lighthouse CI, RUM, synthetic monitoring и performance budget'ы в автоматизированный workflow — с кодом и реальными цифрами.

## Что такое Performance Budget и почему он обязателен в CI/CD

Performance budget — это верхний лимит на объём ресурсов, которые может потребить страница. Пример: «LCP < 2 секунды, Total Blocking Time < 200 мс, JS bundle < 400 КБ». Это работает как SLA: если хотя бы одна метрика превышена, сборка падает, развёртывание блокируется.

Классический подход — запускать Lighthouse вручную в конце спринта и изучать отчёт — обнаруживает регрессию на две недели позже. Современный подход встраивает budget прямо в CI. Каждый pull request проходит через Lighthouse CI: инструмент запускает headless Chromium, рендерит страницу, измеряет метрики производительности. Если budget превышен — GitHub Action выдаёт ошибку, merge блокируется.

Реальный сценарий: в Shopify Hydrogen storefront добавили новый компонент рекомендаций товаров. Размер JS bundle вырос с 340 КБ до 510 КБ. CI pipeline это обнаружил моментально, PR окрасился в красный. Widget перепроектировали с lazy-loading — только тогда bundle вернулся в норму и PR объединили. В старом workflow этот код попал бы в production, 510 КБ bundle означал бы дополнительные 4 секунды блокировки на мобильном 3G — это было бы 48 часов потерянного дохода.

Для установки performance budget используем `lighthouse-ci`. Этот инструмент берёт URL development preview, рендерит его в Chromium, замеряет Core Web Vitals и пользовательские метрики, сравнивает с JSON конфигом бюджета.

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

`numberOfRuns: 3` снижает вариативность результатов за счёт медианы. `throttling` имитирует мобильный 3G — наихудший реальный сценарий конечного пользователя.

## Автоматизация Lighthouse CI через GitHub Actions

Чтобы запустить Lighthouse в CI pipeline, используем Vercel preview deployment + GitHub Actions. При каждом открытии PR Vercel автоматически создаёт preview URL, Lighthouse CI сканирует эту ссылку. Результаты появляются как комментарий в PR. Если budget превышен — CI падает.

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

Шаг `wait-for-vercel-preview` критичен: если Lighthouse запустится до окончания развёртывания, он получит 404. `max_timeout: 300` даёт 5 минут на развёртывание. Когда оно завершится, Lighthouse начинает работать.

Результат в PR выглядит так:

```
Lighthouse CI Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Performance: 92/100 (+2)
❌ LCP: 2.3s (budget: 2.0s) — FAILED
✅ TBT: 180ms (budget: 200ms)
✅ CLS: 0.08 (budget: 0.1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

LCP 2,3 секунды — превышение budget'а на 0,3 с, CI падает. Merge блокируется. Разработчик видит, что hero image был eagerly loaded вместо lazy-load, исправляет, LCP падает до 1,9 с, CI зелёная, merge открывается.

Этот подход критичен для [Headless Commerce](https://www.roibase.com.tr/ru/headless) проектов. Hydrogen или Next.js Commerce магазины добавляют компоненты ежедневно. Если где-то забыть `await fetch()`, основной поток блокируется. Lighthouse CI ловит это через bundle size + TBT.

## Real User Monitoring: отслеживание реальных цифр в production

Lighthouse CI использует synthetic monitoring — работает в лабораторной среде. Реальные пользователи имеют другие устройства, сети, состояние кеша. Для мониторинга production нужен RUM (Real User Monitoring). RUM собирает поток метрик от живых пользователей.

Через библиотеку Web Vitals можно отправлять RUM данные на собственный backend:

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

  // Beacon API гарантирует отправку даже при закрытии страницы
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

Backend endpoint `/api/vitals` записывает метрики в BigQuery или Cloudflare Analytics. Суточный агрегированный отчёт выглядит так:

| Дата       | LCP p75 | INP p75 | CLS p75 | Pageviews |
|------------|---------|---------|---------|-----------|
| 2026-07-28 | 1.8s    | 140ms   | 0.06    | 12,400    |
| 2026-07-29 | 2.1s    | 180ms   | 0.09    | 13,100    |
| 2026-07-30 | 3.2s    | 320ms   | 0.14    | 11,800    |

29 июля было развёртывание. LCP скочил с 2,1 с до 3,2 с, INP с 180 мс до 320 мс. Bounce rate вырос на 4,2 %. RUM уловил это в production за 2 часа — тогда как Lighthouse CI в lab показал LCP < 2 с, но реальные пользователи на более медленных устройствах видели другое.

На основе RUM данных было принято решение откатить развёртывание. LCP вернулся к 1.9 с.

### Pipeline алармов RUM

Только смотреть RUM метрики на dashboard недостаточно. Нужны instant alertы в Slack при регрессии. Можно настроить scheduled query в BigQuery:

```sql
-- BigQuery scheduled query (каждый час)
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

Query проверяет, не деградировал ли LCP p75 более чем на 15 % относительно baseline. При превышении срабатывает Cloud Function, посылающая alert в Slack webhook:

```
⚠️ Performance Regression Detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LCP p75: 3.2s (+68% vs 6h baseline)
Baseline: 1.9s
URL: /product/xyz
Deploy: #4521 (30 min ago)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Trade-off: Synthetic vs RUM — где какие цифры использовать

Lighthouse CI и RUM дополняют друг друга. Не нужно выбирать один из них — нужно использовать оба параллельно.

**Lighthouse CI (synthetic):**
- **Плюсы:** контролируемая среда, повторяемые результаты, запускается при каждом commit
- **Минусы:** не видит вариативность реальных устройств, не может имитировать состояние кеша
- **Применение:** prevention регрессий в CI pipeline — «заблокирует ли этот PR развёртывание?»

**RUM (real user):**
- **Плюсы:** реальные данные пользователей, ловит edge case'ы (например, LCP 5s на старом iPhone в Safari)
- **Минусы:** шумные данные (много outlier'ов), не помогает до развёртывания
- **Применение:** production мониторинг — «деградировала ли производительность после deploy?»

Зрелая система использует оба. Lighthouse CI блокирует merge при регрессии. Если merge прошёл, RUM за 2 часа подтверждает или опровергает lab данные. Если RUM показывает регрессию — rollback.

Пример: в Shopify storefront добавили новый компонент выбора вариантов. Lighthouse CI показал 380 мс TBT (budget 200 мс). PR отклонена. После code-split и lazy-load TBT упал до 150 мс, merge прошёл. В production через 4 часа RUM показал INP p75 120 мс → 145 мс — приемлемо (budget 200 мс). Развёртывание остаётся.

## Интеграция алармов регрессии в deployment pipeline

Если RUM alarm срабатывает независимо от deployment, теряется контекст. Приходит alert «LCP деградировал», но неясно, какое именно развёртывание это вызвало. Нужно привязать metadata deployment'а к каждому RUM event.

У Vercel и Netlify есть environment переменная `VERCEL_GIT_COMMIT_SHA`. Инжектим её в frontend, добавляя к каждому RUM event:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      deploymentId: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
      deployment