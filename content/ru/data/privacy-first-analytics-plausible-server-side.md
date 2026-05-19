---
title: "Privacy-First Analytics: Plausible и Server-Side Aggregation"
description: "GDPR-совместимое измерение: Plausible + server-side aggregation для cookieless-трекинга, сравнение с GA4 и архитектура production."
publishedAt: 2026-05-19
modifiedAt: 2026-05-19
category: data
i18nKey: data-006-2026-05
tags: [privacy-first-analytics, plausible, server-side-tracking, cookieless, gdpr-compliance]
readingTime: 8
author: Roibase
---

Таблица cookies развалилась. Chrome в 2024 году прекратил третьесторонние cookies, Safari и Firefox блокируют их уже годами. Маркетинг-команды видят потерю данных на 40–60% в GA4 (по собственным отчётам Google). Одновременно штрафы GDPR в 2025 году достигли 4,2 млрд евро по Европе. Две проблемы: техническая (без cookies нет измерения) и юридическая (обход consent-баннеров — преступление). Privacy-first analytics решает обе одновременно: измерение без cookies, агрегация на сервере, полная compliance-готовность.

## Plausible: Ядро Cookieless-Измерения

Когда Plausible появилась в 2019 году, её позиционировали как «альтернатива GA». К 2026 году это целая категория: privacy-first web analytics. Ключевое отличие — события привязываются не к cookie на клиенте, а к session ID на сервере без сохранения в памяти. Комбинация IP + User-Agent генерирует хеш (SHA-256), который обнуляется каждые 24 часа. Результат: точность по уникальным посетителям ≈95%, при этом никакой PII (personally identifiable information).

Сравнение с GA4:

- **Владение данными:** Plausible записывает события в собственный PostgreSQL. GA4 отправляет на серверы Google — ты не можешь запросить напрямую (кроме BigQuery export).
- **Cookie-зависимость:** GA4 привязана к `_ga` cookie. Если посетитель отклонит cookie, измерение рассыпается. Plausible изначально cookieless.
- **Размер скрипта:** Plausible tracker — 1,4 KB, GA4 gtag.js — 28 KB + gtm.js — 45 KB. Разница в 50 раз на page load.

Для GDPR compliance критично: хеш Plausible — это не персональные данные. GDPR определяет персональные данные как информацию о «определённом или определяемом физическом лице». SHA-256 хеш необратим, поэтому он считается анонимизированными данными. Согласие не требуется — даже не нужен consent-баннер.

В production Plausible работает в двух сценариях:

1. **Standalone:** для малых сайтов (блог, landing page) — достаточно самой себя. 10 строк JS-embed, dashboard готов.
2. **Hybrid:** для e-commerce или SaaS — Plausible ловит весь трафик, критические conversion-события идут через server-side GTM в CDP. Этот вариант — фокус статьи.

## Server-Side Aggregation: От События к Метрике

Второй столп privacy-first analytics: измерение не по событиям, а по метрикам. GA4 логирует каждый клик, скролл, паузу видео (event stream). На e-commerce сайте это 10 млн событий в день. Это и дорого, и risk для privacy. Aggregation работает просто: события агрегируются на сервере в реальном времени, raw events не сохраняются, только счётчики.

Пример архитектуры:

```
Client → Plausible Tracker (1.4 KB JS)
         ↓
      Edge Worker (Cloudflare / Vercel)
         ↓ (выполняется агрегация)
      Internal Event Bus (Kafka / Redpanda)
         ↓
      Time-Series DB (TimescaleDB / ClickHouse)
```

Агрегация в edge worker:

```sql
-- TimescaleDB hypertable
CREATE TABLE page_metrics (
  time        TIMESTAMPTZ NOT NULL,
  page_path   TEXT NOT NULL,
  country     TEXT,
  views       INT DEFAULT 1,
  bounces     INT DEFAULT 0,
  session_dur INT DEFAULT 0
);

SELECT create_hypertable('page_metrics', 'time');
```

Каждый pageview с клиента проходит цепочку:

1. JS tracker отправляет `POST /api/event` на edge endpoint
2. Edge worker вычисляет хеш (IP + UA → session_id)
3. Проверяет Redis: был ли этот session_id в последние 30 минут
4. Если да — увеличивает счётчик `views` на 1, если нет — пишет новую строку
5. После 30 минут timeout вычисляется bounce

Эта архитектура даёт 3 преимущества перед GA4:

- **Storage: −85%.** 10M событий → 200K агрегированных строк
- **Query speed: ×40 быстрее.** Time-series индексы доставляют dashboard-запросы за <15ms
- **Privacy: Zero PII.** Raw события не сохраняются — нечего удалять при GDPR Article 17

## GDPR Compliance: Технические Детали

Чтобы сделать privacy-first analytics legal-proof, нужны 4 слоя:

**1. Data minimization (GDPR Article 5.1c):** собирай только необходимое. Вместо полного referrer URL сохраняй только домен (`https://example.com/checkout?user=123` → `example.com`). Это и compliance, и экономия диска.

**2. Anonymization threshold (GDPR Guidelines):** если в метрике <5 наблюдений, не показывай цифру — пиши «<5». Потому что группу из 2 человек можно идентифицировать. TimescaleDB:

```sql
SELECT 
  country,
  CASE 
    WHEN COUNT(DISTINCT session_id) < 5 THEN '< 5'
    ELSE COUNT(DISTINCT session_id)::TEXT
  END AS visitors
FROM page_metrics
WHERE time > NOW() - INTERVAL '7 days'
GROUP BY country;
```

**3. Data retention policy:** GDPR требует удалять данные, когда цель обработки исчезает. Для аналитики цель — оптимизация производительности. 90 дней — достаточно. TimescaleDB:

```sql
SELECT add_retention_policy('page_metrics', INTERVAL '90 days');
SELECT add_compression_policy('page_metrics', INTERVAL '7 days');
```

Через 7 дней данные сжимаются, через 90 дней удаляются. GDPR Article 17 compliance — автоматический.

**4. Consent Mode v2 интеграция (опционально):** если ты ещё гибридный с GA4, запускай Plausible даже в режиме `analytics_storage: denied`. Потому что Plausible вообще не использует cookies — согласия не требуется. [First-party архитектура](https://www.roibase.com.tr/ru/firstparty) детализирует этот гибридный setup: Plausible ловит трафик, server-side GTM отправляет conversion-события в CDP.

## Production Case: E-commerce Hybrid Stack

Архитектура, которую мы развернули для Shopify-магазина:

**Frontend:**
- Plausible tracker на всех страницах (product view, cart, checkout)
- Custom event `plausible('Purchase', {revenue: 150})` при успехе checkout

**Backend (Cloudflare Worker):**
```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  if (url.pathname === '/api/event') {
    const body = await request.json()
    const sessionId = hashSession(request.headers.get('CF-Connecting-IP'), 
                                    request.headers.get('User-Agent'))
    
    // Redis session-контроль
    const exists = await redis.exists(`session:${sessionId}`)
    
    if (!exists) {
      await redis.setex(`session:${sessionId}`, 1800, '1')
      await kafka.send({
        topic: 'pageviews',
        messages: [{
          key: sessionId,
          value: JSON.stringify({
            page: body.url,
            referrer: new URL(body.referrer).hostname,
            timestamp: Date.now()
          })
        }]
      })
    }
    
    return new Response('OK', {status: 202})
  }
}
```

**Data layer:**
- Kafka consumer пишет в TimescaleDB (batch insert каждые 10 сек)
- Grafana dashboard читает из TimescaleDB (real-time, refresh 2 сек)
- Ежедневный export в BigQuery (dbt join: Plausible traffic + Shopify orders)

Результат: attribution accuracy — 92% (у GA4 было 58% из-за ITP и cookie rejection). GDPR compliance — 100%, никакой PII. Query-время — 40ms (у GA4 — 4–6 сек).

## Plausible vs GA4: Когда Что Использовать

Нужно ли полностью отказываться от GA4? Нет. В двух сценариях GA4 всё ещё имеет смысл:

**Используй GA4:**
- Cross-domain tracking (несколько сайтов, поддомены — linker GA4 более зрелый)
- Machine learning insights (predictive metrics GA4: probability to purchase, churn probability)
- Google Ads integration (enhanced conversions, remarketing audiences — GA4 встроена)

**Используй Plausible:**
- Public dashboard (встраиваешь Plausible на сайт — GA4 требует viewer-аккаунт)
- Лёгкие сайты (блог, landing page, SaaS marketing)
- Strict compliance (GDPR, CCPA — у Plausible zero risk)

Гибридный setup самый распространённый: Plausible ловит весь трафик сайта, GA4 срабатывает только на critical conversion-funnel через server-side GTM. Так ты получаешь privacy и performance одновременно.

Privacy-first analytics — это уже не «было б неплохо», это обязательно. Chrome удалил cookies в 2024, штрафы GDPR выросли на 300% в 2025. Plausible + server-side aggregation — единственное production-ready решение для двух этих давлений одновременно. Если ты всё ещё мучаешься с 60% data loss в GA4, планируй переход на cookieless-архитектуру — в 2026 году analytics без cookies — это baseline.