---
title: "Бюджеты веб-производительности: связывание с механизмом принятия решений"
description: "Превратите веб-производительность в измеримый KPI с помощью Lighthouse CI, RUM и тревог регрессии. Свяжите решение с числом."
publishedAt: 2026-07-12
modifiedAt: 2026-07-12
category: tech
i18nKey: tech-004-2026-07
tags: [web-performance, lighthouse-ci, rum, core-web-vitals, devops]
readingTime: 9
author: Roibase
---

Веб-производительность — это не "должна быть хорошей", это число, которое влияет на решения. В 2026 году метрика INP, заменившая FID, снижает мобильную конверсию на 15–20% при значении выше 200 мс (Google Chrome UX Report 2025 cohort). Чтобы удерживать этот уровень, нужна не прогнозная оценка, а автоматический контроль в CI pipeline. При настройке Lighthouse CI, RUM и системы тревог регрессии какие пороги куда привязывать, какая метрика влияет на какое решение? В этой статье мы разбираем архитектуру связывания бюджета производительности с механизмом принятия решений на конкретных цифрах.

## Что такое Performance Budget и как его привязать к планированию спринта

Performance budget — это верхний предел времени загрузки страницы, размера bundle'а и метрик runtime. Total bundle не превышает 250 КБ, FCP не дольше 1,2 с, INP не свыше 200 мс — вот это budget. Устанавливается в начале спринта, становится критерием merge PR. Если новый feature пробивает пороги, либо вы рефакторите код, либо откладываете feature, либо обновляете бюджет (но признавая потерю конверсии).

При определении бюджета используются три источника: (1) пороги Core Web Vitals от Google (LCP <2,5 с, INP <200 мс, CLS <0,1), (2) p75 benchmark из RUM данных (если 75% вашего трафика не превышает этот уровень — это "хорошо"), (3) отчет корреляции конверсии (если LCP растет на 100 мс, конверсия падает на 2%, то увеличение порога с 2,5 с на 3 с означает 10% потерю). Budget — это не одно число, а набор метрик:

| Метрика | Порог | Источник |
|---------|-------|----------|
| LCP | <2,5 с | CWV официальный |
| INP | <200 мс | CWV 2024+ |
| CLS | <0,1 | CWV официальный |
| Total JS | <300 КБ gzip | HTTP Archive p75 |
| FCP | <1,8 с | Internal RUM |

Эту таблицу вы записываете в файл `performance.config.json`, Lighthouse CI читает его, при нарушении порога в PR происходит fail.

## Lighthouse CI: Performance как критерий merge в PR

Lighthouse CI — это инструмент, который на каждом PR запускает Lighthouse audit и сравнивает результаты с порогами в CI log (открытая разработка Google). Интегрируется с GitHub Actions, GitLab CI, CircleCI. Базовый процесс: (1) открывается PR, (2) CI собирает build, (3) команда `lhci autorun` посещает страницу в тестовом окружении, (4) сравнивает Lighthouse скоры с бюджетом из performance.config.json, (5) при нарушении PR падает, merge блокируется.

Пример конфигурации (`.lighthouserc.json`):

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

Эта конфигурация падает при LCP >2,5 с, при total byte >300 КБ выдает warning (не блокирует merge, но видно в log). Берутся три запуска, считается среднее, потому что в одном запуске высокая variance сети. Компромисс Lighthouse CI: работает на локальном dev-сервере, не имитирует production CDN. Результаты считаются "worst case scenario", в продакшене будет лучше, но пороги все равно соблюдать.

### Lighthouse CI + Vercel Preview: реальный staging тест

На платформах типа Vercel/Netlify автоматически создается preview URL для PR. Если привязать Lighthouse CI к preview URL, тестируете в production-подобном окружении. Пример GitHub Actions:

```yaml
- name: Run Lighthouse CI
  env:
    LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_TOKEN }}
  run: |
    npm install -g @lhci/cli
    lhci autorun --collect.url=${{ steps.vercel.outputs.preview-url }}
```

`steps.vercel.outputs.preview-url` берется из action Vercel. В этой установке тестируется CDN caching, edge SSR, image optimization. При нарушении порога в PR падает комментарий, команда получает уведомление (если добавить Slack webhook).

## RUM: калибровка бюджета из данных реальных пользователей

Lighthouse CI — это синтетический тест: контролируемое окружение, одинаковые условия сети. RUM (Real User Monitoring) — это метрики от реальных посетителей. Разница критична: Lighthouse имитирует 3G, RUM видит смесь 4G/5G/fiber; Lighthouse тестирует cold cache, RUM учитывает кеширование повторных посетителей. Если настраивать бюджет только по Lighthouse, вы упустите реальный опыт пользователя.

Для сбора RUM используется Web Vitals (официальная библиотека Google). На каждой загрузке страницы измеряет CWV, отправляет на endpoint. Пример реализации:

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

Backend endpoint `/analytics` пишет данные в BigQuery (вместо GA4, если вы предпочитаете first-party данные, так как GA4 делает sampling). В BigQuery считаете p75:

```sql
SELECT
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS p75_lcp
FROM metrics
WHERE name = 'LCP' AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY);
```

Если получилось 2,8 с, а ваш бюджет 2,5 с, значит реальный трафик выше порога — либо повышаете бюджет до 2,8 с, либо оптимизируете код. p75 предпочтителен потому что означает: 75% пользователей ниже этого уровня, Google тоже считает CWV скор по p75.

### RUM + сегментация: разные бюджеты для разных устройств/регионов

Один бюджет для всех — это неправильно. Mobile LCP на 40% выше, чем desktop (Chrome UX Report 2025), трафик из Индии на 60% медленнее, чем из США. Разбив RUM данные по сегментам, дифференцируете бюджет:

| Сегмент | LCP бюджет | INP бюджет |
|---------|------------|------------|
| Desktop | 2,2 с | 180 мс |
| Mobile | 3,0 с | 220 мс |
| Индия | 3,5 с | 250 мс |

Для этого в RUM beacon добавляете `deviceType` и `country` (GeoIP lookup на backend'е), в BigQuery группируете `GROUP BY device`. Lighthouse CI multi-config не поддерживает нативно, но можно создать отдельные workflow'ы (`lhci-mobile.json` + `lhci-desktop.json`).

## Тревоги регрессии: при падении Performance в Slack

Бюджет установлен, CI контролирует, RUM собирает — но что если регрессия произойдет в продакшене? После deploy LCP прыгнул с 2,3 с на 2,9 с, и узнать об этом через 3 часа вместо 5 минут — это плохо. Для этого запускаете job, который анализирует RUM данные каждые 5 минут (Cloudflare Workers Cron, AWS Lambda EventBridge, GCP Cloud Scheduler).

Пример логики тревоги (pseudo-code):

```javascript
// Job, работающий каждые 5 минут
async function checkRegression() {
  const current = await query('SELECT AVG(value) FROM metrics WHERE name="LCP" AND timestamp > NOW() - INTERVAL 5 MINUTE');
  const baseline = await query('SELECT AVG(value) FROM metrics WHERE name="LCP" AND timestamp BETWEEN NOW() - INTERVAL 1 DAY AND NOW() - INTERVAL 1 HOUR');
  
  if (current > baseline * 1.15) { // рост на 15%
    await sendSlack({
      text: `🚨 LCP регрессия: ${current}мс (baseline ${baseline}мс)`,
      channel: '#performance-alerts'
    });
  }
}
```

Baseline берется за час-день до текущего момента (deploy произошел час назад). Порог 15% откалиброван — 10% это слишком чувствительно (false positive), 25% это слишком поздно. Вместо Slack можно интегрировать PagerDuty, Opsgenie. Когда тревога сработает, команда решает: откатить deploy или открыть hotfix.

### Root cause регрессии: Lighthouse Diff

Тревога пришла, LCP упал — почему? Lighthouse CI только проверяет пороги, не дает анализ. С помощью Lighthouse Diff видите разницу между двумя build'ами. Команда `lhci compare`:

```bash
lhci compare --base=build-1234 --head=build-1235 --preset=lighthouse:all
```

Output: "unused-javascript increased by 45 КБ", "server-response-time +120 мс". Эти числа сужают поле поиска. С webpack-bundle-analyzer или Next.js analyze выясняете откуда 45 КБ, из server trace log'а видите источник 120 мс задержки.

## Связь производительности с конверсией: attribution model

Бюджеты — это технические числа, но чтобы связать их с бизнес-решениями, надо перевести в метрику бизнеса. Отчет: "если LCP вырастет с 2,5 с на 3 с, конверсия упадет на 4%" — это нужно получить из A/B теста или когортного анализа. A/B тест: половине трафика отправляете медленный build (симулируете 500 мс задержку из Lighthouse), сравниваете конверсию. Когортный анализ: в RUM данных берете конверсию пользователей с LCP <2 с vs LCP >3 с.

Используя Google Analytics 4 + BigQuery export:

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

Результат таблицы:

| LCP бакет | Конверсия |
|-----------|-----------|
| fast | 4,2% |
| medium | 3,6% |
| slow | 2,9% |

На основе этих цифр считаете ROI бюджета: если снизить LCP с 3 с на 2,5 с, конверсия растет с 3,6% на 4,2%, это +16,7% lift. При 100К посещений в месяц это +1670 конверсий, при AOV $50 это +$83К дохода. Этот отчет отправляете не CTO, а CFO — по нему планируется приоритет sprint'а для performance.

### Нарушение бюджета: принятие трейдофф

В спринте появился новый feature, bundle вырос на 50 КБ, бюджет пробит. Что делать? Три варианта: (1) рефакторить feature (code-split, lazy load), (2) поднять бюджет и принять потерю конверсии, (3) отложить feature. Решение привязано к числам: 50 КБ добавит +200 мс к LCP (по Lighthouse trace), это -2% конверсии (по RUM корреляции). Если feature даст +5% lift, нетто +3% выигрыша — идите в продакшен. Если lift +1%, нетто -1% потеря — отложите.

Для автоматизации такого анализа создаете внутренний tool "performance cost estimator". Input: delta bundle size, output: прогноз LCP delta + impact конверсии. Модель простая: каждые 10 КБ bundle = +30 мс LCP, кажд