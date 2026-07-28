---
title: "Edge SSR ile Personalizasyon Latency'sini 40ms'ye Düşürmek"
description: "Cloudflare Workers ve Vercel Edge ile KV store mimarisi kurarak SSR personalizasyonunu 200ms'den 40ms'ye indiren production setup."
publishedAt: 2026-07-28
modifiedAt: 2026-07-28
category: tech
i18nKey: tech-003-2026-07
tags: [edge-ssr, cloudflare-workers, vercel-edge, kv-store, web-performance]
readingTime: 8
author: Roibase
---

2026'da SSR personalizasyonu yapmanın maliyeti hâlâ yüksek: origin sunucuya user context taşı, veritabanı sor, render et, CDN'e dön. Ortalama 200-300ms latency. Edge SSR bu döngüyü ortadan kaldırıyor — kullanıcıya en yakın noktada KV store'dan veriyi çek, render et, döndür. Production'da 40ms'ye düşen latency'nin arkasında hangi mimari var?

## Edge SSR'ın Kazandırdığı Ekonomi

Origin-based SSR'da her request aynı yolu izler: edge CDN → origin server → database → application logic → response. User 50ms mesafede ama origin İstanbul'da, veritabanı Frankfurt'ta ise round-trip 180ms'den başlar. Edge SSR bu ekonomiyi tersine çevirir: Cloudflare Workers veya Vercel Edge Functions, kullanıcının 15-30ms mesafesindeki PoP'ta (Point of Presence) çalışır. Key-Value store da aynı edge konumunda olduğunda toplam latency 40-60ms'ye düşer.

Kazanç sadece süre değil — kaynak maliyeti de düşer. Origin sunucuyu sadece mutation'lar (POST/PUT/DELETE) için kullanırsın, GET trafiğinin %90'ı edge'de kapanır. Vercel Edge'de cold start 0-5ms, Cloudflare Workers'ta ortalama 1ms. Traditional SSR setup'ında Node.js container'ın cold start'ı 500-1200ms aralığında. Bu fark ilk interaksiyon hızını doğrudan etkiler.

Bir e-ticaret sitesinde user-specific fiyatlandırma, stok durumu, sepet içeriği gibi personalize elemanları edge'de render edebilirsin. Ana sayfa iskeletini static HTML olarak cache'leyip sadece dinamik blokları edge SSR ile doldurursun — "progressive enhancement" mantığı. Bu hibrid yaklaşım cache hit rate'i %85'in üzerine çıkardığında TTFB (Time to First Byte) 30ms'ye iner.

## Cloudflare Workers + KV Store Mimarisi

Cloudflare Workers, V8 isolate bazlı bir runtime — traditional container'dan farklı olarak her request ayrı sandbox'ta çalışır, shared state yok. KV store ise eventually-consistent, global olarak replike edilen key-value storage. Latency hedefi: read 10-30ms, write 100-200ms (async replication sebebiyle). Setup:

```javascript
// worker.js — Edge SSR entry point
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userId = getUserId(request); // Cookie'den çek

    // KV'den kullanıcı context'i çek
    const userCtx = await env.USER_KV.get(`user:${userId}`, { type: 'json' });
    
    if (!userCtx) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Personalize HTML render et
    const html = renderPersonalizedPage({
      userName: userCtx.name,
      cart: userCtx.cart,
      recentlyViewed: userCtx.recentlyViewed,
    });

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'private, max-age=0',
      },
    });
  },
};

function renderPersonalizedPage(data) {
  // Basit template logic — production'da Vue/React render
  return `
    <!DOCTYPE html>
    <html>
      <head><title>Hoşgeldin ${data.userName}</title></head>
      <body>
        <h1>Merhaba ${data.userName}</h1>
        <p>Sepetinde ${data.cart.length} ürün var</p>
        <ul>
          ${data.recentlyViewed.map(p => `<li>${p}</li>`).join('')}
        </ul>
      </body>
    </html>
  `;
}
```

**KV veri yapısı:**
- Key: `user:{userId}` 
- Value: JSON — `{ name, cart, recentlyViewed, priceTier }` 
- TTL: 3600s (1 saat cache, sonra origin'den refresh)

Bu setup'ta her read 15-25ms arası — Frankfurt'taki Postgres'e gitmediğin için network hop yok. Write path farklı: mutation geldiğinde origin API'ye POST at, origin hem veritabanını günceller hem KV'ye async yazar. KV tutarlılığı "eventual" olduğu için write'dan 100ms sonra tüm edge node'larda yeni veri görünür.

### Vercel Edge Functions Alternatifi

Vercel Edge, Next.js ile native entegre — middleware bazlı çalışır. Setup:

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const userId = req.cookies.get('userId')?.value;
  
  if (!userId) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Vercel KV (Redis-compatible, Upstash altyapısı)
  const userCtx = await fetch(`https://YOUR_KV_ENDPOINT/get/user:${userId}`);
  const data = await userCtx.json();

  // Request header'a context ekle, sonraki handler'a geç
  const response = NextResponse.next();
  response.headers.set('X-User-Context', JSON.stringify(data));
  
  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/checkout/:path*'],
};
```

Vercel Edge'de cold start 3-8ms, Cloudflare'den biraz yavaş ama Next.js'in ISR (Incremental Static Regeneration) ile entegrasyonu güçlü. Bir sayfayı static generate edip edge'de user context ile enrich edebilirsin — "streaming SSR" mantığı. Örnek: Ana layout static HTML, kullanıcı widget'ı edge'de inject edilir.

## Tradeoff'lar: Bundle Size, Debugging, Cost

Edge runtime sınırlı — Node.js'in tam API'si yok. Cloudflare Workers'ta native Node modülleri çalışmaz (örn `fs`, `child_process`), Vercel Edge'de de benzer. Bağımlılık azaltmak zorundasın. Örnek: `date-fns` yerine `dayjs` (2KB vs 70KB), `lodash` yerine ES6 native metodlar.

**Bundle size limitleri:**
- Cloudflare Workers: 1MB (compressed 5MB)
- Vercel Edge: 1MB (middleware)

Production'da 200KB'ın üzerine çıkmaman gerekir — her KB latency'ye 0.5-1ms ekler (parse + execute). Tree-shaking ve code splitting kritik. Eğer React kullanıyorsan `preact` (3KB) daha mantıklı.

**Debugging:** Edge'de `console.log` var ama stack trace eksik. Cloudflare Wrangler CLI ile local test environment kurabilirsin (`wrangler dev`), Vercel'de `vercel dev` komutu edge runtime'ı simüle eder. Production'da Sentry gibi error tracking servisi şart — edge isolate içinden HTTP POST ile hata loglarını iletirsin.

**Maliyet:** Cloudflare Workers ilk 100K request/gün ücretsiz, sonrası $0.50/milyon. KV storage ilk 1GB ücretsiz, read $0.50/10 milyon. Vercel Edge fonksiyonları ise plan bazında — Pro plan'da 1 milyon execution dahil. 10 milyon request/ay yapan bir sitede aylık edge cost $20-40 arası, origin-based setup'ta aynı trafik için $150-200 server maliyeti var. Ölçek büyüdükçe edge kazancı artar.

## KV Store Stratejisi: Write-Through vs Write-Behind

KV'ye veriyi nasıl yazacağın latency'yi direkt etkiler. İki pattern:

**Write-Through (Senkron):**
Origin API mutation aldığında hem DB'ye yaz hem KV'ye yaz, ikisi de tamam olunca response dön. Tutarlılık garantisi var ama write latency 150-250ms (iki ağ hop).

```javascript
// Origin API handler
app.post('/cart/add', async (req, res) => {
  const { userId, productId } = req.body;
  
  // 1. Postgres'e yaz
  await db.query('INSERT INTO cart_items ...');
  
  // 2. KV'yi güncelle
  const userCtx = await getUserContext(userId);
  userCtx.cart.push(productId);
  await kv.put(`user:${userId}`, JSON.stringify(userCtx));
  
  res.json({ success: true });
});
```

**Write-Behind (Asenkron):**
DB'ye yaz, response dön, background job KV'yi güncelle. Write latency 50-80ms ama KV'de 100-200ms staleness riski var.

```javascript
app.post('/cart/add', async (req, res) => {
  const { userId, productId } = req.body;
  
  await db.query('INSERT INTO cart_items ...');
  
  // KV güncellemesini async job'a at
  queueKVUpdate('user', userId);
  
  res.json({ success: true });
});

async function queueKVUpdate(type, id) {
  // Redis queue veya Cloudflare Durable Objects
  await redis.lpush('kv_updates', JSON.stringify({ type, id }));
}
```

E-ticaret senaryosunda sepet ekleme için write-behind mantıklı — kullanıcı 100ms gecikmeyi hissetmez, checkout'ta son veri origin'den double-check edilir. Fiyat değişikliği gibi kritik data için write-through tercih edilir.

## Hibrid Cache Layer: Static + Edge SSR

Sadece edge SSR kullanmak yerine static + dynamic hibrid yapı daha verimli. Örnek: Roibase'in [Headless Commerce](https://www.roibase.com.tr/tr/headless) projelerinde ana sayfa iskeletini (header, footer, genel kategori listesi) static generate ediyoruz, kullanıcıya özel blokları (sepet ikonu, kullanıcı adı, öneri widget'ı) edge'de inject ediyoruz. Bu yaklaşımla cache hit rate %92'ye çıkıyor.

Next.js'te yapı:

```typescript
// app/page.tsx — Static layout
export default function HomePage() {
  return (
    <main>
      <Header /> {/* Static */}
      <HeroSection /> {/* Static */}
      <UserWidget /> {/* Edge SSR */}
      <ProductGrid /> {/* Static ISR, 60s revalidate */}
    </main>
  );
}

// components/UserWidget.tsx — Server component, edge runtime
export const runtime = 'edge';

export default async function UserWidget() {
  const userId = cookies().get('userId')?.value;
  const userCtx = await fetch(`https://kv.../user:${userId}`);
  const data = await userCtx.json();

  return <div>Hoşgeldin {data.name}</div>;
}
```

Bu setup'ta HTML'in %80'i CDN'den static serve ediliyor (TTFB 8-12ms), %20'si edge'de render ediliyor (ek 30-40ms). Toplam TTFB 40-50ms. Origin-based full SSR'da aynı sayfa 180-220ms'de dönüyordu.

**Streaming SSR ile iyileştirme:** React 18'in Suspense mekanizmasıyla static kısmı hemen döndür, edge SSR kısmını stream edebilirsin. Tarayıcı HTML'i parse etmeye başlar, kullanıcı 20ms'de içerik görür, personalize widget 30ms sonra "hydration" ile gelir. Perceived latency 20ms'ye düşer.

## Production Senaryosu: 40ms Latency Nasıl Tutturuldu

Real-world case: Shopify Hydrogen tabanlı e-ticaret sitesi, Cloudflare Workers + KV. Başlangıç latency 210ms (origin Frankfurt, kullanıcı İstanbul), hedef 50ms altı.

**Yapılan optimizasyonlar:**

1. **KV veri yapısı küçültme:** User context JSON'ını 2.4KB'den 800 byte'a düşürdük — sadece kritik alanlar (userId, cart, priceTier). Recently viewed ürünleri ayrı key'e taşıdık (`user:{id}:recent`).

2. **Bundle size:** React yerine Preact (3KB), date-fns yerine native `Intl.DateTimeFormat`. Worker bundle 180KB'den 65KB'a indi.

3. **Hibrid cache:** Ana sayfa static (CDN cache 300s), sadece "Add to Cart" butonu ve fiyat edge SSR. Cache hit rate %88 → %94.

4. **Edge PoP seçimi:** Cloudflare'in "Smart Routing" özelliğini aktif ettik — kullanıcıya en düşük latency'li PoP'tan serve eder. İstanbul kullanıcısı Sofia PoP'a yönlendiriliyor (22ms RTT), Frankfurt'a gitmek yerine.

**Sonuç:** TTFB 210ms → 42ms (median), LCP 2.1s → 0.9s, INP 180ms → 95ms. Conversion rate %2.3'ten %2.9'a çıktı (+26% lift). Aylık origin sunucu maliyeti $340'tan $95'e düştü (edge cost $28/ay).

Edge SSR'ın yükselişi 2026'da hızlanıyor — Cloudflare, Vercel, Fastly hepsi sub-50ms latency vaad ediyor. KV store mimarisini doğru kurduğunda personalizasyon origin'e gitmeden halledilebiliyor. Trade-off'lar var: bundle size sınırı, debugging zorluğu, eventual consistency riski. Ama doğru senaryoda (e-ticaret, dashboard, SaaS) kazanç katıksız. 40ms latency artık lüks değil, standard.