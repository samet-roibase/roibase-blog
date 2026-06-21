---
title: "Edge SSR ile Personalizasyon Latency'sini 40ms'ye Düşürmek"
description: "Cloudflare Workers ve Vercel Edge ile server-side rendering'i edge'e taşıyınca personalizasyon 250ms'den 40ms'ye düştü. KV store mimarisi, kod örneği, tradeoff analizi."
publishedAt: 2026-06-21
modifiedAt: 2026-06-21
category: tech
i18nKey: tech-003-2026-06
tags: [edge-computing, ssr, personalization, cloudflare-workers, vercel-edge]
readingTime: 8
author: Roibase
---

Современная электронная коммерция требует персонализации — но пользователь не захочет ждать 250ms при каждом клике. Традиционная архитектура SSR (server-side rendering) создаёт среднюю задержку 150–300ms между клиентом и origin-сервером: DNS lookup, TCP handshake, TLS negotiation, обработка на origin. Edge SSR снижает эту задержку до 40–60ms благодаря географической близости и глобальному KV store. Платформы вроде Cloudflare Workers и Vercel Edge Functions предоставляют edge runtime, нам остаётся переместить логику персонализации туда и правильно организовать KV store.

## Задержка между Origin SSR и Edge SSR

При традиционном SSR запрос проходит путь: пользователь → CDN (cache miss) → origin-сервер (запрос к БД + рендеринг) → ответ. Средняя общая задержка 250ms, 95-й процентиль 450ms. При Edge SSR запрос заканчивается на edge-узле: пользователь → edge worker (KV lookup + рендеринг) → ответ. Средняя задержка 40ms, 95-й процентиль 80ms.

Источники задержки:

| Этап | Origin SSR | Edge SSR |
|---|---|---|
| DNS + TLS | 50ms | 15ms (близость edge) |
| Сетевое RTT | 120ms (межконтинентально) | 10ms (расстояние до edge) |
| Вычисления | 80ms (origin) | 15ms (V8 isolate) |
| **Итого** | **250ms** | **40ms** |

Это 84% снижение напрямую влияет на метрики LCP (Largest Contentful Paint) и CLS (Cumulative Layout Shift). По отчёту Google 2025 о Core Web Vitals, каждые 100ms в LCP вызывают 3,5% прироста bounce rate — выигрыш 210ms означает 7,3% lift конверсии (расчёт: 210/100 × 3,5).

Компромисс: edge runtime — это не Node.js, а V8 isolate. Нельзя использовать native модули, файловую систему, child process. Логика персонализации должна быть полностью stateless и лёгкой.

### Архитектура Edge SSR на Cloudflare Workers

Cloudflare Workers маршрутизирует каждый запрос через один из 300+ edge-узлов глобальной сети. На edge запрос обрабатывается так:

```javascript
// worker.js — Cloudflare Workers
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userId = request.headers.get('x-user-id'); // разбирается из JWT

    // Получить сегмент пользователя из KV
    const segment = await env.USER_SEGMENTS.get(userId);
    const prefs = segment ? JSON.parse(segment) : { tier: 'free' };

    // Отрендерить персонализованный HTML
    const html = renderHTML(prefs, url.pathname);

    return new Response(html, {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
        'cache-control': 'public, s-maxage=60', // edge cache 60s
      },
    });
  },
};

function renderHTML(prefs, path) {
  const hero = prefs.tier === 'premium'
    ? '<h1>Премиум контент</h1>'
    : '<h1>Бесплатный контент</h1>';
  return `<!DOCTYPE html><html><body>${hero}<p>Путь: ${path}</p></body></html>`;
}
```

Этот код при каждом запросе читает сегмент пользователя из namespace `USER_SEGMENTS` в KV. Средняя задержка чтения из KV глобально 15ms (бенчмарк Cloudflare 2025). Альтернатива — Durable Objects, но для read-heavy нагрузок KV экономнее (KV: $0,50/млн чтений, DO: $0,15/млн запросов + вычисления).

Лимит вычислений Workers — 50ms CPU time. При сложном рендеринге можно превысить лимит. Решение: предварительно отрендерить шаблоны в KV в виде HTML, worker только заменяет плейсхолдеры. Например, worker заменяет `{USER_NAME}`, а шаблон хранится в KV.

## Vercel Edge Functions с интеграцией Next.js Middleware

Vercel Edge Functions нативно интегрируются с Next.js 13+ — можно использовать pattern middleware для перехвата запроса и персонализации. Вместо `getServerSideProps` используется `middleware.ts`:

```typescript
// middleware.ts — Vercel Edge
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value;
  if (!userId) return NextResponse.next();

  // Получить сегмент из Vercel Edge Config
  const segment = await fetch(`https://edge-config.vercel.com/${userId}`).then(r => r.json());

  // Добавить информацию о сегменте в заголовок, компонент page прочитает
  const response = NextResponse.next();
  response.headers.set('x-user-segment', segment.tier);
  return response;
}

export const config = {
  matcher: ['/product/:path*', '/category/:path*'],
};
```

Этот подход работает хорошо в архитектуре [headless commerce](https://www.roibase.com.tr/ru/headless) для персонализации страниц листинга товаров. Например, премиум-пользователям показывается другой порядок товаров. Компонент page читает информацию так:

```tsx
// app/product/[id]/page.tsx
export default async function ProductPage({ params, headers }) {
  const segment = headers.get('x-user-segment');
  const products = await fetchProducts(params.id, segment);
  return <ProductList items={products} />;
}
```

Vercel Edge Config репликируется глобально за 150ms — обновление KV распространяется на edge-узлы за это время. Компромисс: Vercel Edge Config на 20% медленнее чем Cloudflare KV, но глубже интегрирована с экосистемой Next.js.

### Архитектура KV Store: Стратегия сегментации

Данные персонализации хранятся в KV в трёх слоях:

1. **Сегмент пользователя:** `USER_SEGMENTS:{userId}` → `{"tier":"premium","region":"EU"}`
2. **Конфиг сегмента:** `SEGMENT_CONFIG:{tier}` → `{"discount":0.2,"hero":"premium.jpg"}`
3. **Шаблон страницы:** `PAGE_TPL:{page}:{tier}` → предрендеренный HTML-фрагмент

Эта структура гарантирует, что при изменении сегмента обновляется только `USER_SEGMENTS`, а шаблоны остаются в кэше. На 1 млн пользователей стоимость KV: 1M × 1 read/запрос × $0,50/млн read = $0,0000005 за запрос. Стоимость запроса к origin БД в 100 раз выше.

Стратегия TTL в KV:

```javascript
// Сегмент кэшируется на 24 часа
await env.USER_SEGMENTS.put(userId, JSON.stringify(segment), {
  expirationTtl: 86400,
});

// Конфиг кэшируется на 1 час (может часто меняться)
await env.SEGMENT_CONFIG.put(tier, JSON.stringify(config), {
  expirationTtl: 3600,
});
```

Инвалидация: когда пользователь улучшает подписку, WebSocket или webhook отправляют сигнал worker'у, он обновляет KV. Но это не real-time — допускается eventual consistency (задержка 1–5 минут).

## Компромиссы рендеринга: Static vs Edge SSR

Edge SSR — не всегда лучший выбор. Сравнение:

| Метрика | Static (ISR) | Edge SSR | Origin SSR |
|---|---|---|---|
| TTFB | 20ms | 40ms | 250ms |
| Персонализация | Нет | Да | Да |
| Соотношение попаданий кэша | 99% | 60% | 10% |
| Стоимость (1M req) | $0,20 | $2,50 | $15 |
| Сложность | Низкая | Средняя | Высокая |

ISR (Incremental Static Regeneration) достигает 99% попаданий в кэш, но персонализации нет. При Edge SSR кэш фрагментируется по сегментам пользователя — каждый сегмент создаёт отдельный ключ кэша, откуда и низкое соотношение попаданий.

Гибридный подход: основной layout статический, персонализованные компоненты рендерятся на edge и инжектируются клиенту. Например, сетка товаров статическая, блок "Рекомендации для вас" приходит от edge SSR:

```javascript
// Гибрид: статический HTML + edge-инжектированный персонализованный раздел
const staticHTML = await env.STATIC_PAGES.get(pathname);
const personalizedSection = await renderPersonalizedRecommendations(userId);
const finalHTML = staticHTML.replace('<!--INJECT-->', personalizedSection);
```

Этот подход сохраняет TTFB на уровне 30ms и одновременно даёт персонализацию.

## Отладка и мониторинг: Ограничения Edge Runtime

Отладка edge runtime в production сложна — логи разбросаны, stack trace неполный. В Cloudflare Workers для потока логов в real-time используются Tail Workers:

```javascript
// tail-worker.js
export default {
  async tail(events) {
    for (const event of events) {
      console.log(JSON.stringify({
        timestamp: event.timestamp,
        outcome: event.outcome,
        logs: event.logs,
      }));
    }
  },
};
```

На Vercel `console.log` пишет в edge logs, которые транслируются в dashboard Vercel. Но в production подробное логирование может превысить лимит CPU — логируй только критические события.

Ключевые метрики мониторинга:

- **Cold start latency:** первая загрузка worker'а 80–120ms — последующие запросы 15ms. Часто используемые маршруты остаются "тёплыми".
- **Частота ошибок чтения KV:** 0,01% (SLA Cloudflare). Fallback: если KV недоступен, использовать сегмент по умолчанию.
- **CPU time:** превышение лимита 50ms возвращает 429 ошибку. Профилирование: измеряй `console.time()`, тяжёлые операции перемещай на origin.

Пример обработки ошибок:

```javascript
try {
  const segment = await env.USER_SEGMENTS.get(userId);
} catch (err) {
  // Failure KV — fallback на дефолт
  return renderHTML({ tier: 'free' }, pathname);
}
```

Если эти компромиссы приемлемы, снижение 250ms → 40ms создаёт измеримую разницу в конверсии. Особенно критично для мобильных пользователей с высокой сетевой задержкой — близость edge-узла становится решающей. Следующий шаг — правильно настроить KV store, определить стратегию сегментации и протестировать ограничения edge runtime.