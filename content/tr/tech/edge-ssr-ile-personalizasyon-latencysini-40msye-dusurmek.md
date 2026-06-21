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

Modern e-ticaret sitelerinde personalizasyon artık beklenti — ama kullanıcı her tıklamada 250ms beklemek istemiyor. Geleneksel SSR (server-side rendering) mimarisi kullanıcı ile origin server arasında ortalama 150-300ms latency yaratıyor: DNS lookup, TCP handshake, TLS negotiation, origin processing time. Edge SSR bu gecikmeyi coğrafi yakınlık ve global KV store kullanarak 40-60ms'ye indiriyor. Cloudflare Workers ve Vercel Edge Functions gibi platformlar edge runtime sunuyor, bizim işimiz personalizasyon mantığını oraya taşımak ve KV store'u doğru kurmak.

## Edge SSR ile Origin SSR Arasındaki Gecikme Farkı

Geleneksel SSR'de istek şu yolu izliyor: kullanıcı → CDN (cache miss) → origin server (DB query + rendering) → response. Ortalama toplam süre 250ms, %95 percentile 450ms. Edge SSR'de istek edge location'da sonlanıyor: kullanıcı → edge worker (KV lookup + rendering) → response. Ortalama 40ms, %95 percentile 80ms.

Gecikme kaynakları:

| Adım | Origin SSR | Edge SSR |
|---|---|---|
| DNS + TLS | 50ms | 15ms (edge proximity) |
| Network RTT | 120ms (intercontinental) | 10ms (edge'e mesafe) |
| Compute | 80ms (origin) | 15ms (V8 isolate) |
| **Toplam** | **250ms** | **40ms** |

Bu %84 düşüş LCP (Largest Contentful Paint) ve CLS (Cumulative Layout Shift) metriklerini doğrudan etkiliyor. Google'ın 2025 Core Web Vitals raporuna göre LCP'de her 100ms %3.5 bounce rate artışı yaratıyor — 210ms kazanmak %7.3 conversion lift demek (hesaplama: 210/100 × 3.5).

Tradeoff: edge runtime Node.js değil V8 isolate — native modüller, dosya sistemi, child process kullanılamıyor. Personalizasyon mantığı tamamen stateless ve lightweight olmalı.

### Cloudflare Workers ile Edge SSR Mimarisi

Cloudflare Workers her request'i global network'teki 300+ edge location'dan birine yönlendiriyor. İstek edge'de şöyle işleniyor:

```javascript
// worker.js — Cloudflare Workers
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userId = request.headers.get('x-user-id'); // JWT'den parse ediliyor

    // KV'den kullanıcı segmentini çek
    const segment = await env.USER_SEGMENTS.get(userId);
    const prefs = segment ? JSON.parse(segment) : { tier: 'free' };

    // Personalize edilmiş HTML render et
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
    ? '<h1>Premium İçerik</h1>'
    : '<h1>Ücretsiz İçerik</h1>';
  return `<!DOCTYPE html><html><body>${hero}<p>Path: ${path}</p></body></html>`;
}
```

Bu kod her request'te KV'den `USER_SEGMENTS` namespace'inden segment çekiyor. KV read latency global ortalama 15ms (Cloudflare 2025 benchmark). Alternatif olarak Durable Objects kullanılabilir ama read-heavy workload'da KV daha ucuz (KV: $0.50/milyon read, DO: $0.15/milyon request + compute).

Workers'ın compute limiti 50ms CPU time — karmaşık rendering'de aşabilirsin. Çözüm: pre-render şablonları KV'ye HTML olarak yaz, worker sadece string replace yapsın. Örneğin `{USER_NAME}` placeholder'ını worker değiştiriyor, template KV'de saklanıyor.

## Vercel Edge Functions ile Next.js Middleware Entegrasyonu

Vercel Edge Functions Next.js 13+ ile native entegre — middleware pattern'i kullanarak request intercept edip personalize edebilirsin. Edge runtime'da `getServerSideProps` yerine `middleware.ts` kullanıyorsun:

```typescript
// middleware.ts — Vercel Edge
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value;
  if (!userId) return NextResponse.next();

  // Edge KV'den segment çek (Vercel Edge Config)
  const segment = await fetch(`https://edge-config.vercel.com/${userId}`).then(r => r.json());

  // Header'a segment bilgisi ekle, Next.js'te page component okur
  const response = NextResponse.next();
  response.headers.set('x-user-segment', segment.tier);
  return response;
}

export const config = {
  matcher: ['/product/:path*', '/category/:path*'],
};
```

Bu yaklaşım [headless commerce](https://www.roibase.com.tr/tr/headless) mimarisinde product listing sayfalarını personalize ederken işe yarıyor. Örneğin premium kullanıcılara farklı ürün sıralaması gösteriyorsun. Page component şöyle okuyor:

```tsx
// app/product/[id]/page.tsx
export default async function ProductPage({ params, headers }) {
  const segment = headers.get('x-user-segment');
  const products = await fetchProducts(params.id, segment);
  return <ProductList items={products} />;
}
```

Vercel Edge Config global replication 150ms içinde tamamlanıyor — KV güncellemesi edge'lere bu sürede yayılıyor. Tradeoff: Cloudflare KV'den %20 daha yavaş ama Next.js ekosistemiyle daha entegre.

### KV Store Mimarisi: Segmentasyon Stratejisi

Personalizasyon verisi KV'de 3 katmanda saklanıyor:

1. **User segment:** `USER_SEGMENTS:{userId}` → `{"tier":"premium","region":"EU"}`
2. **Segment config:** `SEGMENT_CONFIG:{tier}` → `{"discount":0.2,"hero":"premium.jpg"}`
3. **Page template:** `PAGE_TPL:{page}:{tier}` → pre-rendered HTML fragment

Bu yapı sayesinde segment değiştiğinde sadece `USER_SEGMENTS` güncelleniyor, template'ler cache'lenmiş kalıyor. 1 milyon kullanıcı için KV maliyeti: 1M user × 1 read/request × $0.50/1M read = request başına $0.0000005. Origin DB query maliyeti bunun 100 katı.

KV TTL stratejisi:

```javascript
// Segment 24 saat cache'leniyor
await env.USER_SEGMENTS.put(userId, JSON.stringify(segment), {
  expirationTtl: 86400,
});

// Config 1 saat cache'leniyor (sık değişebilir)
await env.SEGMENT_CONFIG.put(tier, JSON.stringify(config), {
  expirationTtl: 3600,
});
```

Invalidation: kullanıcı upgrade olduğunda WebSocket veya webhook ile worker'a sinyal gönderip KV'yi güncelleyebilirsin. Ama gerçek zamanlı değil — eventual consistency kabul edilmeli (1-5 dakika gecikme).

## Rendering Tradeoff'ları: Static vs Edge SSR

Edge SSR her zaman en iyi çözüm değil. Karşılaştırma:

| Metrik | Static (ISR) | Edge SSR | Origin SSR |
|---|---|---|---|
| TTFB | 20ms | 40ms | 250ms |
| Personalizasyon | Yok | Evet | Evet |
| Cache hit ratio | %99 | %60 | %10 |
| Maliyet (1M req) | $0.20 | $2.50 | $15 |
| Complexity | Düşük | Orta | Yüksek |

ISR (Incremental Static Regeneration) cache hit ratio'su %99'a ulaşıyor ama personalizasyon yok. Edge SSR cache'i user segment'e göre parçalanıyor — her segment ayrı cache key oluşturuyor, bu yüzden hit ratio düşük.

Hibrit yaklaşım: ana layout static, personalize componentler edge'de render edilip client-side inject ediliyor. Örneğin product grid static, "Senin için öneriler" edge SSR ile geliyor:

```javascript
// Hybrid: static HTML + edge-injected personalized section
const staticHTML = await env.STATIC_PAGES.get(pathname);
const personalizedSection = await renderPersonalizedRecommendations(userId);
const finalHTML = staticHTML.replace('<!--INJECT-->', personalizedSection);
```

Bu yaklaşım TTFB'yi 30ms'de tutarken personalizasyon sunuyor.

## Debugging ve Monitoring: Edge Runtime Limitleri

Edge runtime production'da debug etmek zor — loglar dağınık, error stack trace eksik. Cloudflare Workers'da Tail Workers kullanarak real-time log stream oluşturabilirsin:

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

Vercel'de `console.log` output'u edge logs'a düşüyor, Vercel dashboard'da stream ediliyor. Ama production'da verbose logging CPU limit'i aşabiliyor — sadece kritik event'leri logla.

Monitoring metrikleri:

- **Cold start latency:** Worker ilk yüklendiğinde 80-120ms — warm request 15ms. Sık kullanılan route'lar warm kalıyor.
- **KV read failure rate:** %0.01 (Cloudflare SLA). Fallback: KV okunamazsa default segment kullan.
- **CPU time:** 50ms limit aşımı %429 error döndürüyor. Profiling: `console.time()` ile ölç, heavyweight işlemi origin'e taşı.

Örnek hata yönetimi:

```javascript
try {
  const segment = await env.USER_SEGMENTS.get(userId);
} catch (err) {
  // KV failure — fallback to default
  return renderHTML({ tier: 'free' }, pathname);
}
```

Edge SSR'nin bu tradeoff'ları kabul edilebilirse 250ms → 40ms düşüş conversion'da ölçülebilir fark yaratıyor. Özellikle mobil kullanıcılarda network latency yüksek olduğunda edge proximity kritik. Bir sonraki adım KV store'u doğru kurmak, segment stratejisini tanımlamak ve edge runtime limitlerini test etmek.