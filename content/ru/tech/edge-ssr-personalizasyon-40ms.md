---
title: "Снижение задержки персонализации до 40ms с помощью Edge SSR"
description: "Как мы перенесли server-side rendering на edge с помощью Cloudflare Workers и Vercel Edge, снизив время персонализации до 40ms. Реальная архитектура и примеры кода."
publishedAt: 2026-07-09
modifiedAt: 2026-07-09
category: tech
i18nKey: tech-003-2026-07
tags: [edge-computing, ssr, cloudflare-workers, vercel-edge, kv-store]
readingTime: 8
author: Roibase
---

Противоречие между server-side rendering и персонализацией решено в 2026 году. Когда вы переносите операцию SSR, которая занимает 120–180 мс на origin-сервере, на edge, тот же рендер занимает 30–50 мс. Cloudflare Workers работает в 300+ локациях edge, Vercel Edge — в 90+ локациях, обрабатывая эти вычисления локально. Вам больше не нужно возвращаться на origin для предоставления контента, зависящего от пользователя — с архитектурой KV store вы сохраняете состояние пользователя на edge и выполняете рендер там. В этой статье мы поделимся практической реализацией этой архитектуры, компромиссами и результатами бенчмарков.

## Отличие Edge SSR от классического SSR

При классическом SSR запрос браузера идет на origin-сервер, где Node.js/Deno runtime рендерит HTML и отправляет ответ. Среднее TTFB (Time to First Byte) между Стамбулом и Франкфуртом составляет 60–80 мс, время рендеринга 40–120 мс, итого 100–200 мс. При Edge SSR запрос падает на ближайший узел edge, рендеринг происходит там, TTFB составляет 10–20 мс, рендеринг 20–40 мс, итого 30–60 мс.

Разница — это не только сетевая задержка. Edge runtime работают на базе V8 isolate, поэтому время запуска близко к нулю. На origin-сервере, даже без холодного старта контейнера, есть spawning процесса и прочие операции. На edge isolate уже готов, код выполняется немедленно.

Критическое значение для персонализации — откуда вы берете данные пользователя. На origin вы извлекаете из базы данных или Redis (10–30 мс), на edge из KV store (1–5 мс). KV store — это eventually consistent хранилище с задержкой чтения в несколько миллисекунд и глобальной репликацией. Cloudflare Workers KV или Vercel KV следуют одному паттерну: запись идет на origin (50–100 мс), чтение происходит с edge (1–5 мс). Для сценариев с высоким соотношением чтения к записи в персонализации (предпочтения пользователя, информация о сегменте, история поведения) эта архитектура очень эффективна.

### Сценарий сравнения TTFB

| Архитектура | TTFB | Рендеринг | Чтение KV | Всего |
|---|---|---|---|---|
| Origin SSR (Франкфурт) | 60–80 мс | 40–120 мс | 10–30 мс | 110–230 мс |
| Edge SSR (Cloudflare) | 10–20 мс | 20–40 мс | 1–5 мс | 31–65 мс |
| Edge SSR (Vercel) | 15–25 мс | 25–45 мс | 2–6 мс | 42–76 мс |

Эти цифры — это RUM (Real User Monitoring) данные, измеренные из Стамбула. В лабораторных тестах результаты еще лучше, но в production влияют сетевые помехи, перегрузка compute и другие факторы.

## Архитектура KV Store с Cloudflare Workers

Основные строительные блоки Edge SSR в Cloudflare Workers: Workers runtime (V8 isolate), KV namespace (eventually consistent key-value store), HTMLRewriter (stream-based HTML transform API). Классические фреймворки (Next.js, Nuxt, SvelteKit) не полностью работают в этой среде, потому что зависят от Node.js API. Вместо этого вы используете Remix (с адаптером Cloudflare), Qwik (встроенная поддержка edge) или custom SSR pipeline.

Практический сценарий: сайт электронной коммерции хочет показывать пользователям баннер "Вернуться в корзину" на главной странице с товарами, которые они ранее добавили. При классическом SSR эта информация извлекается из store сессии (Redis/Memcached), внедряется в рендеренный HTML. При Edge SSR та же информация читается из KV:

```javascript
// cloudflare worker
export default {
  async fetch(request, env) {
    const userId = getCookie(request, 'user_id');
    const cartData = await env.CART_KV.get(`cart:${userId}`, { type: 'json' });
    
    const html = await renderApp({
      cartItems: cartData?.items || [],
      showBanner: cartData?.items?.length > 0
    });
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
};
```

Вызов `env.CART_KV.get()` занимает 1–5 мс. Функция `renderApp()` производит HTML-строку (template engine или framework render). Общее время выполнения 25–40 мс. Если бы эта же операция выполнялась на origin, обращение к Redis заняло бы 10–30 мс, total 50–150 мс.

### Стратегия записи в KV

Запись в KV идет на origin, это 50–100 мс. Поэтому во время действия пользователя (добавление в корзину) эта задержка приемлема — это POST-запрос, пользователь ждет. А вот чтение (загрузка состояния корзины при загрузке страницы) должно всегда происходить с edge. Путь записи выглядит так:

```javascript
// POST /cart/add handler (может быть на edge или origin)
async function addToCart(userId, productId) {
  const cart = await env.CART_KV.get(`cart:${userId}`, { type: 'json' }) || { items: [] };
  cart.items.push({ productId, addedAt: Date.now() });
  
  await env.CART_KV.put(`cart:${userId}`, JSON.stringify(cart), {
    expirationTtl: 604800 // 7 дней
  });
  
  return cart;
}
```

Вызов `put()` является eventually consistent — запись возвращается немедленно, но репликация может занять до 60 секунд. То есть пользователь добавил товар, обновил страницу, в течение 60 секунд попал на другой узел edge, может увидеть старую корзину. Это приемлемо для большинства use case; если критично, добавляете pattern fallback на origin (при промахе KV запрашиваете origin).

## Vercel Edge Functions и альтернатива Durable Objects

Vercel Edge Functions также основаны на V8 isolate, это fork Cloudflare Workers. Для KV store используется Vercel KV (Redis-compatible API, но с KV архитектурой на бэкэнде). API немного отличается:

```javascript
// vercel edge function (app/api/render/route.js)
import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request) {
  const userId = request.cookies.get('user_id')?.value;
  const cartData = await kv.get(`cart:${userId}`);
  
  const html = renderToString(<App cartItems={cartData?.items || []} />);
  
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
```

Vercel KV имеет задержку чтения 2–6 мс (немного медленнее Cloudflare KV, но все еще однозначная). Задержка записи аналогична: 50–100 мс. Если вы используете Next.js 13+ с App Router, можете выбрать runtime `edge`, в этом случае весь рендеринг server component выполняется на edge.

У Cloudflare есть одно дополнительное преимущество: Durable Objects. KV является eventually consistent, а Durable Objects обеспечивают strong consistency и single-region координацию. Вы используете Durable Objects для real-time collaboration, seat locking, управления инвентарем. Для персонализации это не требуется, но в [headless commerce архитектуре](https://www.roibase.com.tr/ru/headless) может быть предпочтительно для критичных шагов, таких как flow checkout.

### Edge SSR + Static Hybrid Pattern

Не каждая страница должна рендериться на edge. Страницы с высокой посещаемостью и низкой персонализацией, такие как homepage, могут быть собраны как статические и размещены в CDN. Специфичные для пользователя секции могут быть заполнены fetch на клиенте (подобно ESI). Вы используете Edge SSR только для страниц, таких как cart, account, PDP (product detail page — если показываете историю пользователя).

Пример стратегии Next.js:

```javascript
// next.config.js
module.exports = {
  experimental: {
    runtime: 'experimental-edge' // для определенных маршрутов
  }
};

// app/account/page.js
export const runtime = 'edge';

// app/page.js
// если runtime не указан, используется default Node.js SSR или static
```

Этот hybrid pattern оптимален для Core Web Vitals. Статические страницы имеют LCP 1,5 с, Edge SSR страницы 2,5 с (добавляется время внедрения персонализированного контента в DOM). Но это по-прежнему намного лучше, чем 4–5 с origin SSR.

## Компромиссы и ограничения

Edge runtime — это не полный Node.js. Нет `fs`, `child_process`, нативных модулей. Операции с высокой вычислительной мощностью, такие как шифрование и компрессия, ограничены (лимит CPU time: Cloudflare 50 мс, Vercel 30 с, но на практике нацеливаетесь на 100 мс). Лимит размера бандла: Cloudflare 1 МБ (сжато), Vercel 4 МБ. Крупные фреймворки (полный Next.js runtime) не поместятся; используются lean альтернативы, такие как Remix.

KV store является eventually consistent — немедленное чтение после записи не гарантировано. Если нужна strong consistency (checkout, payment), вернитесь к origin или используйте Durable Objects (это также добавляет задержку, 15–30 мс).

Стоимость: Cloudflare Workers имеет бесплатный план 100K запросов/день, KV 1 ГБ бесплатно. После этого $5/10M запросов, KV $0,50/ГБ. Vercel Edge Functions на плане Hobby 100K invocation/месяц, план Pro unlimited (но fair use). Если у вас production миллион запросов/день, дополнительные затраты составляют $50–200 в месяц. По сравнению с origin SSR стоимость compute низкая (serverless, pay-per-use), но хранилище KV и пропускная способность добавляют затраты.

### Отладка и мониторинг

Локально тестировать edge-среду сложно. `wrangler dev` для Cloudflare, `vercel dev` для Vercel выполняют локальную эмуляцию, но production behavior не идентичен. Логи ошибок потоком идут с edge, не появляются немедленно как `console.log` на origin. RUM-инструменты (Sentry, Datadog) поддерживают edge runtime, но setup отличается.

При бенчмарке учитывайте: в лабораторных тестах (Lighthouse, WebPageTest) разница origin vs edge более выраженная, потому что зафиксирована локация и идеальная сеть. В реальном пользовательском тесте (RUM, Chrome UX Report) дисперсия больше — мобильная сеть, поиск DNS, TLS handshake влияют на результат. В нашем production deployment для origin SSR средний TTFB между Стамбулом и Франкфуртом составил 140 мс, тогда как Cloudflare Edge SSR 42 мс (снижение на 70%). Однако при P95 разница меньше: 220 мс vs 85 мс (снижение на 60%). На edge отсутствует холодный старт, поэтому разница между P95 и median намного меньше.

## Реальное применение: персонализация электронной коммерции

Конкретный сценарий: сайт электронной коммерции в Турции с 500K+ ежедневных сеансов. Персонализируются homepage, категории, PDP (история просмотров, рекомендации, segment-based баннеры). При origin SSR TTFB 120–180 мс, LCP 2,8–4,2 с. После миграции на Cloudflare Workers + KV TTFB 35–55 мс, LCP 1,9–2,6 с.

Изменение архитектуры:
1. Сессия пользователя перемещена в KV (ранее была в Redis)
2. Output recommendation engine кэшируется в KV (TTL 300 с, по сегменту пользователя)
3. HTML шаблон homepage рендерится в Worker (React SSR заменен на custom template, 15 мс vs 60 мс)
4. Critical CSS встроен, подсказки preload font внедрены Worker

С