---
title: "Edge SSR ile Personalizasyon Latency'sini 40ms'ye Düşürmek"
description: "Cloudflare Workers ve Vercel Edge ile KV store mimarisini kullanarak sunucu taraflı personalizasyon gecikme süresini 40 milisaniyenin altına indirmek mümkün."
publishedAt: 2026-05-12
modifiedAt: 2026-05-12
category: tech
i18nKey: tech-003-2026-05
tags: [edge-computing, ssr, personalization, cloudflare-workers, vercel-edge]
readingTime: 8
author: Roibase
---

Geleneksel origin server'larla yapılan sunucu taraflı render, ortalama 200-400ms latency demek. Bir CDN edge'de HTML cache'lersen bu süre 20-50ms'ye düşer ama personalizasyon kaybolur. Edge SSR bu tradeoff'u kırıyor: hem kişiselleştirme hem 40ms altı response. Bunu Cloudflare Workers ve Vercel Edge gibi edge runtime'lar + distributed KV store ile yapıyorsun. Artık "cache mi, personalization mi" sorusunu sormuyorsun — ikisini de alıyorsun.

## Edge SSR neden şimdi kritik

2025'ten itibaren Chrome'un INP metriği Core Web Vitals'a girdi. 200ms üstü server response INP'yi tek başına kırmaya yetiyor. Origin'e giden her request 150-300ms ekliyor çünkü fiziksel mesafe + cold start var. Edge runtime bu engeli kaldırıyor: kod kullanıcıya en yakın POP'ta (Point of Presence) çalışıyor, data aynı bölgedeki KV store'dan 5-15ms'de geliyor.

Bu sadece hız değil. Personalizasyon için artık origin'e istek atmana gerek yok. User segment, tercih, sepet durumu gibi datayı edge KV'de tutuyorsun. Request geldiğinde edge function bu datayı çekip HTML'i anında render ediyor. Origin server sadece write işlemleri ve ağır computation için kullanılıyor.

Shopify gibi platformlarla çalışırken bu mimari özellikle önemli. Liquid template'ler origin'de render olur, her sayfa için 300-600ms sürer. Edge SSR ile HTML composable yapıyorsun: ürün kartını bir edge function render ediyor, sepet bilgisini başka bir function inject ediyor. Toplam latency 40ms altına iniyor. Detaylı entegrasyon yapısı için [Headless Commerce](https://www.roibase.com.tr/tr/headless) mimarisine bakabilirsin.

## Cloudflare Workers + KV: mimari çekirdek

Cloudflare Workers V8 isolate bazlı çalışır. Her request için yeni container spin-up etmez, JavaScript isolate açar. Bunun maliyeti 0.5-2ms. Worker kodu şu şekilde:

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userId = request.headers.get('CF-Connecting-IP') || 'anonymous';
    
    // KV'den user segment çek
    const segment = await env.USER_SEGMENTS.get(userId);
    
    // Segment'e göre product list render et
    const products = segment === 'premium' 
      ? await fetchPremiumProducts() 
      : await fetchStandardProducts();
    
    const html = renderHTML(products, segment);
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
};
```

Cloudflare KV 300+ POP'ta replicate ediyor. Read latency global ortalama 12ms. Write eventual consistency ile 60 saniyede yayılıyor. Bu yüzden KV'ye sadece nadir değişen data yazıyorsun: user preferences, segment mappings, feature flags. Ürün fiyatı gibi sık değişen datayı origin API'den çekip edge'de cache'liyorsun (Cache API ile 60 saniye TTL).

### Vercel Edge vs Cloudflare Workers

Vercel Edge Functions aynı V8 isolate modelini kullanır ama ağı farklı. Cloudflare 300+ POP, Vercel ~15 regional edge location. Latency karşılaştırması (Avrupa kullanıcı, ABD origin):

| Runtime | Cold Start | KV Read | Total TTFB |
|---------|-----------|---------|------------|
| Origin SSR | 150ms | N/A | 380ms |
| Vercel Edge | 8ms | 22ms | 45ms |
| Cloudflare Workers | 1ms | 11ms | 28ms |

Vercel'in avantajı Next.js ekosistemiyle deep integration. `middleware.ts` dosyasında edge function yazıp production'a push ediyorsun, orchestration Vercel'de. Cloudflare'de Wrangler CLI + manuel KV binding yapman gerekiyor. Tradeoff: daha fazla kontrol vs daha hızlı onboarding.

## KV store mimarisi: write pattern ve revalidation

Edge KV'nin eventual consistency'si bir constraint. User bir butona tıkladı, preference değişti — bu değişiklik 60 saniye içinde tüm edge'lere yayılır. Bu süre zarfında farklı POP'lar farklı değer okuyabilir. Çözüm: write'tan sonra origin'e redirect et veya client-side optimistic update yap.

Örnek flow:

1. User "Dark Mode" toggle'ına basar
2. Client POST `/api/preferences` endpoint'ine gönderir (origin)
3. Origin KV'ye `user:123:theme = dark` yazar
4. Origin immediate cache invalidation için Cloudflare API'yi çağırır:

```javascript
// Origin'de
await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiToken}` },
  body: JSON.stringify({ files: [`https://example.com/user/${userId}`] })
});
```

5. Edge function bir sonraki request'te KV'den yeni değeri okur
6. Client-side JavaScript 200ms sonra soft reload yapar

Bu pattern write throughput'u sınırlar (KV write rate limit: 1000/saniye per account) ama read throughput sınırsız. Dolayısıyla mimari read-heavy workload'lara optimize. User action'ları nadir (dakikada 1-2), sayfa görüntüleme sık (saniyede 100+).

### Cache layering stratejisi

KV tek cache layer değil. Full stack:

```
Browser Cache (service worker)
  ↓
CDN Edge Cache (Cache API, 60s TTL)
  ↓
Edge KV (eventual, minutes)
  ↓
Origin Database
```

Static asset (CSS, JS) en üstte, user-specific data en altta. HTML'in kendisi middle layer'da: edge function KV + Cache API'yi combine ederek render ediyor. Pseudocode:

```javascript
const cacheKey = `html:${url}:${segment}`;
let html = await caches.default.match(cacheKey);

if (!html) {
  const userData = await KV.get(userId);
  html = renderTemplate(userData);
  await caches.default.put(cacheKey, html, { expirationTtl: 60 });
}

return html;
```

Bu yapı 95th percentile TTFB'yi 40ms altında tutuyor çünkü çoğu request Cache API'den servis ediliyor (5-8ms). KV hit oranı %98+, origin fallback %2 altı.

## Personalization scope ve bundle size tradeoff'u

Edge function 1MB bundle size limitine sahip (Cloudflare). Heavy React component render edemezsin. İki strateji:

**1. Minimal templating:** Handlebars veya custom string interpolation kullan. Sadece değişken inject et:

```javascript
const template = `<div class="product-card">
  <h3>{{name}}</h3>
  <span class="price {{priceClass}}">{{price}}</span>
</div>`;

function render(product, segment) {
  return template
    .replace('{{name}}', product.name)
    .replace('{{price}}', segment === 'premium' ? product.premiumPrice : product.price)
    .replace('{{priceClass}}', segment === 'premium' ? 'gold' : 'standard');
}
```

Bundle size: 2KB. Render time: 0.3ms.

**2. Partial hydration:** Edge'de skeleton HTML render et, client-side React island'ları hydrate et. Edge function:

```javascript
export default async function(request) {
  const products = await fetchProducts();
  return `
    <div id="product-list" data-products='${JSON.stringify(products)}'>
      ${products.map(p => `<div class="skeleton"></div>`).join('')}
    </div>
    <script type="module" src="/hydrate.js"></script>
  `;
}
```

Client-side `hydrate.js` (10KB):

```javascript
import { h, render } from 'preact';
const data = JSON.parse(document.getElementById('product-list').dataset.products);
render(<ProductList products={data} />, document.getElementById('product-list'));
```

Bu pattern ile edge SSR latency düşük kalır (40ms), interaktivite client-side gelir (FCP + 150ms). Tradeoff: INP artabilir (JavaScript parse time). Monitoring gerekiyor.

## Real user monitoring ve alerting

Edge latency'i RUM olmadan optimize edemezsin. Cloudflare Analytics her request için server-timing header ekler:

```
Server-Timing: cf-edge;dur=12, cf-kv;dur=8, cf-render;dur=18
```

Bunu client-side PerformanceObserver ile topla:

```javascript
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'navigation') {
      const ttfb = entry.responseStart - entry.requestStart;
      fetch('/analytics', { 
        method: 'POST', 
        body: JSON.stringify({ ttfb, url: entry.name }) 
      });
    }
  }
}).observe({ entryTypes: ['navigation'] });
```

Target metrikler:

- p50 TTFB < 30ms
- p95 TTFB < 60ms
- p99 TTFB < 100ms
- Edge error rate < 0.1%

60ms'yi aşan request'lerde Cloudflare trace ID'yi logla, Wrangler tail ile debug et. Çoğu zaman sebep KV timeout veya origin fallback.

## Production deployment checklist

Edge SSR production'a almadan önce:

1. **Rate limiting:** KV write'ı throttle et (user başına saniyede 1 write)
2. **Fallback chain:** KV timeout olursa (>50ms) origin'e fallback, origin timeout olursa static HTML dön
3. **Feature flag:** Edge personalization'ı kademeli aç (%10 → %50 → %100 traffic)
4. **Cost monitoring:** Cloudflare Workers 100K request/gün free, sonrası $0.50/million. KV read sınırsız free, write $0.50/million.
5. **Security:** User ID hash'le, KV key'de PII tutma, rate limit bypass için bot detection ekle

Cost projeksiyonu: 1M günlük ziyaret, %30 personalize request = 300K edge invocation/gün = $0.15/gün = $4.50/ay. Origin SSR alternatifi: 2 vCPU instance $50/ay. Savings: %91.

Edge SSR mimarisi bir kere kurulunca incremental cost sıfır. Yeni personalization rule eklemek sadece KV'ye yeni key yazmak demek. Yeni segment oluşturmak edge function'da bir if bloğu eklemek. Ölçeklenme doğrusal değil logaritmik — 10M request/gün aynı 40ms latency'de servis ediliyor. Bu nedenle büyüme stratejisinde edge-first düşünmek temel avantaj sağlıyor.