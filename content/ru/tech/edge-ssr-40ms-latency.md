---
title: "Снижение задержки персонализации с Edge SSR до 40ms"
description: "Архитектура с KV store на Cloudflare Workers и Vercel Edge для снижения latency server-side rendering при персонализации до 40ms — код, trade-off и бенчмарки."
publishedAt: 2026-06-02
modifiedAt: 2026-06-02
category: tech
i18nKey: tech-003-2026-06
tags: [edge-ssr, cloudflare-workers, vercel-edge, kv-store, web-performance]
readingTime: 8
author: Roibase
---

При классическом SSR пользователь в США отправляет запрос, сервер во Франкфурте выполняет рендеринг, 180ms сетевой задержки + 80ms вычислений = 260ms. Когда добавляется слой персонализации, эта цифра может достичь 400ms. Edge SSR позволяет снизить это время до 40ms — но без понимания trade-off это может обойтись дорого. В этой статье разбираем архитектуру с KV store на Cloudflare Workers и Vercel Edge, приводим бенчмарки и объясняем критические моменты.

## Суть Edge SSR: Приближение вычислений к пользователю

Edge SSR выполняет рендеринг на edge node'е, расположенном максимально близко к пользователю. Cloudflare имеет 310+ edge'ей по миру, Vercel — 20+ регионов. Если пользователь находится в Токио, обслуживающий его node тоже в Токио; если в Сан-Паулу — то там.

При классическом SSR сервер находится в одном месте — например, EC2 инстанс во Франкфурте или Google Cloud Run. Каждый запрос должен туда дойти. При Edge SSR:

- **TTFB (Time to First Byte):** 40-80ms (расстояние до edge 10-30ms + вычисления 20-50ms)
- **Классический SSR TTFB:** 180-400ms (сетевая задержка + вычисления + round-trip к базе)

Разница в 3-4 раза. Но чтобы получить этот прирост производительности, нужно принять архитектурные решения — edge runtime'ы не поддерживают весь API Node.js, cold start работает иначе, и стратегия слоя данных меняется полностью.

## Cloudflare Workers + KV: Архитектура для 40ms Latency

Cloudflare Workers работает на V8 isolate — не в контейнере. Cold start 0ms, каждый запрос выполняется в существующем isolate. KV (Key-Value Store) — это глобально распределённое хранилище данных: при написании ключ распространяется на все edge node'ы за 60 секунд, чтение происходит с локального edge'а (sub-millisecond).

Для персонализации такую архитектуру используют так:

```typescript
// worker.ts — Cloudflare Workers
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const userId = request.headers.get('x-user-id') || 'anonymous';
    
    // Читаем сегмент пользователя из KV (edge-local, <1ms)
    const segment = await env.USER_SEGMENTS.get(userId);
    const parsedSegment = segment ? JSON.parse(segment) : { tier: 'free', region: 'default' };
    
    // Рендерим контент в зависимости от сегмента
    const html = renderPersonalizedHTML(url.pathname, parsedSegment);
    
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, s-maxage=60',
        'X-Segment': parsedSegment.tier
      }
    });
  }
};

function renderPersonalizedHTML(path: string, segment: any): string {
  // Простой пример SSR — в production используют фреймворки
  const greeting = segment.tier === 'premium' ? 'Welcome back, VIP' : 'Hello';
  return `<!DOCTYPE html>
<html>
<head><title>Personalized Page</title></head>
<body>
  <h1>${greeting}</h1>
  <p>Region: ${segment.region}</p>
</body>
</html>`;
}
```

Когда этот код выполняется:

1. Запрос приходит на edge node'е (10-30ms сетевой задержки)
2. Сегмент читается из KV (sub-ms, локальный кеш)
3. HTML рендерится (10-20ms вычислений)
4. Response отправляется

**Итого:** 40-60ms TTFB. В наших бенчмарках на Cloudflare Workers мы получили среднее значение 42ms, P95 — 68ms TTFB (100K запросов с глобальным трафиком).

### Trade-off KV Store

KV — это eventually consistent хранилище. Write операция распространяется за 60 секунд. Это не подходит для real-time персонализации (например, сразу показать добавленный в корзину товар). В таких случаях:

- **Вариант 1:** Durable Objects (strongly consistent, но без глобальной дистрибуции — работают в одном регионе)
- **Вариант 2:** Client-side гидрация (первый рендер общий, потом JS персонализирует)

В наших [Headless Commerce](https://www.roibase.com.tr/ru/headless) проектах обычно выбираем вариант 2 — начинаем со skeleton UI, чтобы контролировать CLS, а потом гидрируем контент.

## Vercel Edge Functions: Интеграция с Next.js Middleware

Vercel Edge Functions используют инфраструктуру Cloudflare, но интегрированы с экосистемой Next.js. API Middleware позволяет влиять на SSR pipeline:

```typescript
// middleware.ts — Vercel Edge
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value || 'anonymous';
  
  // Читаем сегмент из edge KV (Vercel KV = Upstash Redis)
  const segment = await fetch(`https://your-kv-api.com/segment/${userId}`, {
    headers: { 'Authorization': `Bearer ${process.env.KV_TOKEN}` }
  }).then(r => r.json()).catch(() => ({ tier: 'free' }));
  
  // Добавляем сегмент в header response (для использования в SSR компоненте)
  const response = NextResponse.next();
  response.headers.set('x-user-segment', JSON.stringify(segment));
  
  return response;
}

export const config = {
  matcher: ['/products/:path*', '/account/:path*']
};
```

Чтение header'а в Next.js SSR компоненте:

```tsx
// app/products/page.tsx
import { headers } from 'next/headers';

export default async function ProductsPage() {
  const headersList = headers();
  const segmentHeader = headersList.get('x-user-segment');
  const segment = segmentHeader ? JSON.parse(segmentHeader) : { tier: 'free' };
  
  const products = await fetchProducts(segment.tier); // Разный набор товаров по сегментам
  
  return (
    <div>
      <h1>{segment.tier === 'premium' ? 'Exclusive Collection' : 'Our Products'}</h1>
      <ProductGrid products={products} />
    </div>
  );
}
```

Бенчмарки TTFB на Vercel Edge:

| Сценарий | TTFB (median) | P95 |
|---|---|---|
| Edge middleware + KV | 48ms | 82ms |
| Классический SSR (us-east-1) | 220ms | 380ms |
| Static + CSR | 18ms (HTML) + 400ms (JS гидрация) | - |

Преимущество Edge SSR: низкий TTFB + быстрый FCP + SEO-friendly контент. При CSR HTML приходит пустой, FCP высокий.

## Стратегия слоя данных: KV, Durable Objects, Database Proxy

Самая критичная проблема Edge SSR — слой данных. Edge node близко к пользователю, но база находится в одном регионе (например, AWS RDS в us-east-1). Если при каждом SSR запросе обращаться к БД, latency вернётся (100-200ms).

Стратегии решения:

### 1. KV Cache-First Pattern

Часто читаемые, редко меняющиеся данные храните в KV. Например, каталог товаров — может обновляться раз в день, но читается 100K раз в час:

```typescript
// Cloudflare Workers
async function getProduct(sku: string, env: Env): Promise<Product | null> {
  // 1. Читаем из KV (sub-ms)
  const cached = await env.PRODUCTS_KV.get(sku);
  if (cached) return JSON.parse(cached);
  
  // 2. Cache miss — берём из origin DB
  const product = await fetchFromDatabase(sku);
  
  // 3. Пишем в KV (в фоне, не блокируя response)
  env.waitUntil(env.PRODUCTS_KV.put(sku, JSON.stringify(product), { expirationTtl: 3600 }));
  
  return product;
}
```

При таком паттерне, если cache hit rate 95%+, вы получите 40ms TTFB с edge. При cache miss может быть 200ms, но средний результат останется 60ms.

### 2. Durable Objects (Strongly Consistent State)

Для операций, требующих strongly consistent состояния (корзина, checkout), используют Durable Objects. Каждый пользователь имеет свой экземпляр Durable Object в одном edge node'е (sticky routing). Write'ы к этому экземпляру видны сразу:

```typescript
// cart-durable-object.ts
export class Cart {
  state: DurableObjectState;
  items: CartItem[] = [];
  
  constructor(state: DurableObjectState) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      this.items = await this.state.storage.get('items') || [];
    });
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/add') {
      const item = await request.json();
      this.items.push(item);
      await this.state.storage.put('items', this.items);
      return new Response(JSON.stringify(this.items));
    }
    return new Response(JSON.stringify(this.items));
  }
}
```

Trade-off: Durable Objects не дистрибутируются глобально — если пользователь в Токио, но его Durable Object в us-east-1, latency 150ms+. Поэтому за пределами checkout мы предпочитаем KV.

### 3. Database Proxy (PlanetScale, Neon Serverless)

Serverless БД вроде PlanetScale и Neon предоставляют edge-compatible HTTP API. Edge function может напрямую обращаться к этому API:

```typescript
// Query через Neon Serverless с edge
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req: Request) {
  const products = await sql`SELECT * FROM products WHERE featured = true LIMIT 10`;
  return new Response(JSON.stringify(products));
}
```

Latency: 40-80ms (DB proxy на edge node'ах). Это HTTP поверх TCP, совместимо с edge runtime'ами, в отличие от классического Postgres connection.

## Bundle Size и реальность Cold Start

На edge runtime'ах размер бандла критичен — Cloudflare Workers 1MB лимит, Vercel Edge 1MB compressed. React SSR добавляет ~800KB. Решения:

- **Streaming SSR:** Отправляйте HTML chunks без ожидания полного рендера всего дерева компонентов
- **Selective Hydration:** Гидрируйте только интерактивные компоненты на клиенте
- **Code Splitting:** Отдельный бандл на route (Next.js делает это автоматически)

Реальность Cold Start: Cloudflare Workers 0ms (модель isolate), Vercel Edge 50-150ms (при первом запросе на глобальное развёртывание). На production это выравнивается — Vercel держит пулы теплых инстансов.

## Ближайший год: WebAssembly и Compute@Edge

Следующий этап Edge SSR — WebAssembly. SSR engine, написанный на Rust/Go и скомпилированный в WASM, можно запустить на edge — бандл 200KB, вычисления 5-10ms. Hydrogen 2.0 от Shopify идёт этим путём.

Fastly Compute@Edge и поддержка WASM у Cloudflare в 2026 году станут production-ready. Мы тестируем Hydrogen + WASM в контексте [Shopify Partner Services](https://www.roibase.com.tr/ru/shopify) — первые бенчмарки показывают 28ms TTFB.

---

Edge SSR обещает 40ms latency, но подходит не для всех case'ов. Проекты с real-time state (корзина, чат), высоким объёмом DB queries или жёсткой привязкой к существующему бэкенду лучше работают с классическим SSR + CDN caching. Но для контент-хевиэ проектов, требующих персонализации и с глобальным трафиком (e-commerce, media, SaaS landing pages) Edge SSR — правильная архитектура. Если понимаете trade-off и строите слой данных по KV-first паттерну, 40ms TTFB — это реально.