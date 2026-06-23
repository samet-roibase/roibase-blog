---

title: "Web Performance Budget'ы: Связь с Механизмом Принятия Решений"
description: "Интеграция Lighthouse CI, RUM и алармов регрессии производительности. Методология снижения TBT с 2190 мс до 200 мс."
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: tech
i18nKey: tech-004-2026-06
tags: [веб-производительность, lighthouse-ci, rum, core-web-vitals, performance-budget]
readingTime: 9
author: Roibase

---

В 2026 году веб-производительность — это уже не просто "сделать страницу быстрой", а постоянный инженерный процесс с принятием обоснованных решений. Вы развёртываете интернет-магазин, оценка Lighthouse падает с 92 до 68, коэффициент конверсии снижается с 3,2% до 2,7% — но никто это не замечает, потому что мониторинг ограничивается проверкой "сервер упал?". Привязка performance budget к механизму принятия решений означает: поймать регрессию до развёртывания, оценить каждый коммит по порогам LCP/TBT/CLS и подать данные RUM в pipeline атрибуции. В этой статье мы покажем, как интегрировать Lighthouse CI, синтетический мониторинг, RUM и систему алармов в единую архитектуру.

## Что Такое Performance Budget и Почему его Должна Контролировать Система, а не Человек

Performance budget — это числовые пороги на ресурсы и метрики производительности на странице: максимальный размер JavaScript-бандла (например, 200 КБ gzip), максимальный TBT (Total Blocking Time, 200 мс), максимальный LCP (Largest Contentful Paint, 2,5 сек). Эти цифры не произвольны — пороги Core Web Vitals от Google определяют полосу "хорошо", но вам нужно вывести более острые лимиты из данных о конверсии вашего сектора.

Классический сценарий "Lighthouse 95 в dev-среде, 72 в production" возникает по этим причинам: синтетический тест работает в лабораторных условиях (быстрая сеть, пустой кеш, одна загрузка страницы), а RUM измеряет реального пользователя на 3G с полным кешем и разными типами навигации. Разница нормальна, но обе метрики нужно отслеживать. Lighthouse CI ловит регрессии размера бандла в каждом PR, RUM показывает production-реальность вроде "у 22% мобильных пользователей LCP превышает 4 секунды". Если budget определён только как "score выше 75", вы можете добавить 100 КБ в бандл, увеличить оценку с 74 до 76 — страница утяжелится, но score зелёный. Поэтому budget должен быть двойным: *метрика-базированный* (LCP, TBT, CLS) и *ресурс-базированный* (JS, CSS, размер изображений в МБ).

Ещё один момент: для enforcing budget'а недостаточно ручного код-ревью. "Проверим performance при ревью" не масштабируется при 20 PR/день. Система должна измерять, система должна fail'ить, люди должны только понимать причину.

## Lighthouse CI: Performance Gating Для Каждого Коммита

Lighthouse CI автоматически запускает Lighthouse-аудит на каждом коммите или PR и отправляет результаты в GitHub или внутренний dashboard. Интеграция в CI-pipeline:

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

В конфиге `.lighthouserc.json` вы определяете budget'ы:

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

При такой настройке, если PR добавляет 50 КБ лишнего JavaScript и TBT превысит 200 мс, CI упадёт и merge заблокируется. В проектах Roibase на [Headless Architecture](https://www.roibase.com.tr/ru/headless) этим подходом мы сократили среднее TBT с 2190 мс до 200 мс — каждая библиотека тестировалась против budget перед добавлением.

### Ограничения Lighthouse CI и Структурные Решения

Lighthouse CI выполняет синтетический тест: фиксированная пропускная способность (Moto G4, slow 4G), фиксированное замедление CPU (4x), одна страница. Реальный пользователь находится на другом устройстве, проходит разные сценарии (товар → корзина → оформление), видит варианты A/B-тестов. Поэтому рассматривайте Lighthouse CI как *минимальный порог* — если pass, развёртывание возможно, но pass не означает идеальное production-состояние. RUM нужен для измерения production-реальности.

## RUM (Real User Monitoring): Превращение Production-Реальности в Данные Для Решений

RUM собирает метрики от реальных пользователей: Navigation Timing API, PerformanceObserver, CrUX. Сборку выполняет vendor (Speedcurve, Sentry Performance, Cloudflare Web Analytics) или собственный stack (библиотека web-vitals + BigQuery).

Минимальная интеграция `web-vitals`:

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

Загрузите эти данные в BigQuery, затем объедините их с данными атрибуции маркетинга через dbt:

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

Эта таблица покажет вам конкретику вроде "при LCP ≤ 2,5 сек CVR 3,4%, при LCP > 2,5 сек CVR 2,1%". Когда вы рапортируете это CMO, абстрактный запрос "давайте оптимизируем производительность" превращается в конкретику: "если LCP ≤ 2,5 сек, +18K$ ежемесячного дохода".

## Регрессионные Alarmy в Slack/PagerDuty: Автоматическое Обнаружение

После сбора RUM-данных настройте автоматическое обнаружение регрессии. Если 7-дневное среднее LCP было 2,2 сек, а сегодня поднялось до 3,1 сек — это регрессия развёртывания или проблема CDN. Ловить это через ручной мониторинг неправильно — нужна автоматическая триггеризация.

### Metric-Based Alerting с DataDog

DataDog автоматически парсит RUM-метрики и выполняет anomaly detection. Пример конфигурации монитора:

```json
{
  "name": "LCP Regression - Desktop",
  "type": "metric alert",
  "query": "avg(last_1h):avg:rum.largest_contentful_paint{device:desktop} > 2500",
  "message": "LCP desktop за последний час превысил 2500 мс. Последнее развёртывание: {{deploy.id}}. @slack-perf-alerts @pagerduty",
  "tags": ["service:ecommerce", "env:production"],
  "thresholds": {
    "critical": 2500,
    "warning": 2200
  }
}
```

Когда аларм срабатывает, уведомление падает в Slack, incident открывается в PagerDuty, on-call разработчик получает уведомление. ID развёртывания в сообщении (поступает из CI-pipeline) позволит за 30 секунд найти проблемный коммит.

### Forwarding Lighthouse CI Threshold Failure as Alarm

Некоторые команды отправляют fail Lighthouse CI не только как блок PR, но и как Slack-уведомление:

```yaml
# .github/workflows/lighthouse-ci.yml (дополнительный step)
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

Так разработчик увидит красный флаг в CI *и* получит Slack-сообщение одновременно — внимание привлечётся незамедлительно.

## Привязка Budget'ов к Системе Feature Flags

Некоторые feature'ы наследственно тяжёлые: live chat (80 КБ JS), персонализация (150 КБ + runtime), видеоплеер (200 КБ). Вместо раскатывания всем пользователям, вы можете тестировать на сегменте с запасом по performance-budget (например, desktop + быстрое соединение), постепенно расширять.

В LaunchDarkly или собственной системе flag'ов определите правила:

```javascript
// featureFlags.js
import { getConnectionSpeed } from './utils';

export function shouldEnableChatWidget(user, vitals) {
  const is4G = getConnectionSpeed() === '4g';
  const goodLCP = vitals.lcp < 2000;
  
  return is4G && goodLCP && user.tier === 'premium';
}
```

Решение "добавим chat widget" не несёт риск "LCP всех пользователей вырастет на 300 мс" — открывается только для сегмента, собираются RUM-данные, измеряется CVR-влияние, потом full rollout или откат. При обсуждении с маркетингом и product вы привносите числа: "Chat widget повышает CVR на 0,4%, но LCP переходит на 2,8 сек — нетто +8K$/месяц доход, но UX падает. Как идти дальше?"

## Performance Budget на Headless Commerce

Headless commerce (Shopify Hydrogen, Next.js + Shopify API) обычно быстрее Liquid-тема, потому что JS-контроль в ваших руках, возможна selective hydration. Но контроль на вас — регрессия тоже на вас. Обновление npm-пакета может добавить 70 КБ в бандл.

В рамках [Headless Services](https://www.roibase.com.tr/ru/headless) Roibase мы применяем этот workflow при миграции:

1. **Baseline:** Соберите RUM-данные текущего Liquid-тема (30 дней). Запишите медиану LCP, TBT, CLS.
2. **Headless Prototype с Lighthouse CI:** Каждый коммит должен соответствовать `.lighthouserc.json`. Первое развёртывание должно быть на 20% лучше baseline.
3. **A/B на Production:**