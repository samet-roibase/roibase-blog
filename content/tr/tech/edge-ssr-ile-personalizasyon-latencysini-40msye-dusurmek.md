---
title: "Edge SSR ile Personalizasyon Latency'sini 40ms'ye Düşürmek"
description: "Cloudflare Workers ve Vercel Edge ile server-side rendering'i edge'e taşıyarak personalizasyon süresini nasıl 40ms'ye indirdiğimizi gerçek mimari ve kod örnekleriyle açıklıyoruz."
publishedAt: 2026-07-09
modifiedAt: 2026-07-09
category: tech
i18nKey: tech-003-2026-07
tags: [edge-computing, ssr, cloudflare-workers, vercel-edge, kv-store]
readingTime: 8
author: Roibase
---

Server-side rendering ile personalizasyon arasındaki çelişki 2026'da çözülmüş durumda. Origin server'dan 120-180ms süren SSR işlemini edge'e taşıdığınızda aynı render 30-50ms'ye düşüyor. Cloudflare Workers 300+ edge lokasyonunda, Vercel Edge 90+ lokasyonda bu hesabı yapabiliyor. Kullanıcıya özel içeriği sunmak için origin'e geri dönmeye gerek kalmıyor — KV store mimarisi ile user state'i edge'de tutup render ediyorsunuz. Bu yazıda bu mimarinin pratik implementasyonunu, tradeoff'ları ve benchmark sonuçlarını paylaşacağız.

## Edge SSR'ın Klasik SSR'dan Farkı

Klasik SSR'da browser request'i origin server'a gidiyor, orada Node.js/Deno runtime HTML render ediyor, response dönüyor. Ortalama TTFB (Time to First Byte) İstanbul-Frankfurt arası 60-80ms, render süresi 40-120ms, toplam 100-200ms. Edge SSR'da ise request en yakın edge node'una düşüyor, render orada oluyor, TTFB 10-20ms, render 20-40ms, toplam 30-60ms.

Fark sadece network latency'si değil — edge runtime'lar V8 isolate tabanlı çalıştığı için startup süresi 0'a yakın. Origin'de her request için container cold start yoksa bile, process spawning vs. var. Edge'de isolate zaten hazır, kod hemen execute ediliyor.

Personalizasyon için kritik olan nokta: user data'yı nereden alacağınız. Origin'de database veya Redis'ten çekiyorsunuz (10-30ms), edge'de KV store'dan çekiyorsunuz (1-5ms). KV store eventually consistent, single-digit millisecond read latency, global replication. Cloudflare Workers KV veya Vercel KV — her ikisi de aynı pattern: write origin'e gidiyor (50-100ms), read edge'den geliyor (1-5ms). Read-heavy personalizasyon senaryolarında (kullanıcı tercihleri, segment bilgisi, geçmiş davranış) bu mimari çok etkili.

### TTFB Karşılaştırma Senaryosu

| Mimari | TTFB | Render | KV Read | Toplam |
|---|---|---|---|---|
| Origin SSR (Frankfurt) | 60-80ms | 40-120ms | 10-30ms | 110-230ms |
| Edge SSR (Cloudflare) | 10-20ms | 20-40ms | 1-5ms | 31-65ms |
| Edge SSR (Vercel) | 15-25ms | 25-45ms | 2-6ms | 42-76ms |

Bu sayılar İstanbul'dan ölçülmüş, RUM (Real User Monitoring) verisi. Lab test'te daha da iyi çıkıyor ama production'da network jitter, compute contention gibi faktörler var.

## Cloudflare Workers ile KV Store Mimarisi

Cloudflare Workers'da edge SSR için temel yapı taşları: Workers runtime (V8 isolate), KV namespace (eventually consistent key-value store), HTMLRewriter (stream-based HTML transform API). Klasik framework'ler (Next.js, Nuxt, SvelteKit) bu ortamda tam olarak çalışmıyor çünkü Node.js API'lerine bağımlılar. Bunun yerine Remix (Cloudflare adapter ile), Qwik (native edge support), ya da custom SSR pipeline kullanıyorsunuz.

Pratik senaryo: e-ticaret sitesi, kullanıcı daha önce sepete eklediği ürünleri homepage'de "Sepetinize Dönün" banner'ı ile göstermek istiyor. Klasik SSR'da bu bilgi session store'dan (Redis/Memcached) çekilir, render edilen HTML'e injekte edilir. Edge SSR'da aynı bilgi KV'den çekilir:

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

Bu örnekte `env.CART_KV.get()` çağrısı 1-5ms sürüyor. `renderApp()` fonksiyonu HTML string üretiyor (template engine veya framework render). Toplam execution time 25-40ms. Eğer aynı iş origin'de yapılsaydı Redis roundtrip 10-30ms, total 50-150ms olurdu.

### KV Write Strategy

KV write origin'e gidiyor, bu 50-100ms. Dolayısıyla user action'ı (sepete ekle) sırasında bu latency kabul edilebilir — zaten POST request, user bekliyor. Ama read (sayfa yüklenirken cart state okuma) her zaman edge'den olmalı. Write path'i şöyle:

```javascript
// POST /cart/add handler (origin veya edge olabilir)
async function addToCart(userId, productId) {
  const cart = await env.CART_KV.get(`cart:${userId}`, { type: 'json' }) || { items: [] };
  cart.items.push({ productId, addedAt: Date.now() });
  
  await env.CART_KV.put(`cart:${userId}`, JSON.stringify(cart), {
    expirationTtl: 604800 // 7 gün
  });
  
  return cart;
}
```

`put()` çağrısı eventually consistent — write hemen dönüyor ama replication 60 saniye sürebilir. Yani kullanıcı ürünü ekledi, sayfayı yeniledi, 60 saniye içinde farklı bir edge node'una düşerseeski cart görebilir. Bu çoğu use case için kabul edilebilir; kritikse origin'e fallback pattern eklersiniz (KV miss olursa origin'e sorgu).

## Vercel Edge Functions ve Durable Objects Alternatifi

Vercel Edge Functions da V8 isolate bazlı, Cloudflare Workers'ın bir fork'u. KV store olarak Vercel KV (Redis-compatible API ama arkada KV mimari) kullanıyorsunuz. API biraz farklı:

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

Vercel KV read latency 2-6ms (Cloudflare KV'den biraz yavaş ama hâlâ tek haneli). Write latency benzer: 50-100ms. Next.js 13+ ile App Router kullanıyorsanız `edge` runtime'ı seçebiliyorsunuz, bu durumda tüm server component render'ı edge'de oluyor.

Cloudflare'in bir avantajı daha var: Durable Objects. KV eventually consistent ama Durable Objects strongly consistent, single-region coordination yapıyor. Real-time collaboration, seat locking, inventory gibi durumlar için Durable Object kullanırsınız. Personalizasyon için gereksiz ama [headless commerce mimarisinde](https://www.roibase.com.tr/tr/headless) checkout flow'u gibi kritik noktalarda tercih edilebilir.

### Edge SSR + Static Hybrid Pattern

Her sayfa edge'de render edilmeyebilir. Homepage gibi yüksek trafik, düşük personalizasyon gereken sayfalar static olarak build edilip CDN'de tutulabilir. User-specific section'lar client-side fetch ile doldurulabilir (ESI benzeri). Edge SSR'ı sadece cart, account, PDP (product detail page — user history gösteriyorsa) gibi sayfalar için kullanırsınız.

Örnek Next.js strateji:

```javascript
// next.config.js
module.exports = {
  experimental: {
    runtime: 'experimental-edge' // belirli route'lar için
  }
};

// app/account/page.js
export const runtime = 'edge';

// app/page.js
// runtime belirtilmezse default Node.js SSR veya static
```

Bu hybrid pattern Core Web Vitals için optimal. Static sayfalarda LCP 1.5s, edge SSR sayfalarda 2.5s çıkıyor (personalize content DOM'a injection süresi ekliyor). Ama yine de 4-5s olan origin SSR'dan çok daha iyi.

## Tradeoff'lar ve Sınırlamalar

Edge runtime tam Node.js değil — `fs`, `child_process`, native module yok. Şifreleme, kompresyon gibi CPU-heavy işler sınırlı (CPU time limit var: Cloudflare 50ms, Vercel 30s ama pratikten 100ms hedeflenebilir). Bundle size limiti: Cloudflare 1MB (compressed), Vercel 4MB. Large framework'ler (Next.js full runtime) sığmıyor, Remix gibi lean alternatifler kullanılıyor.

KV store eventually consistent — write sonrası hemen okumak garantili değil. Strong consistency gerekiyorsa (checkout, payment) origin'e dönmelisiniz veya Durable Object kullanmalısınız (bu da latency ekliyor, 15-30ms).

Maliyet: Cloudflare Workers ücretsiz plan 100K request/gün, KV 1GB free. Sonrası $5/10M request, KV $0.50/GB. Vercel Edge Functions Hobby plan 100K invocation/ay, Pro plan unlimited (ama fair use). Production'da milyon request/gün varsa aylık $50-200 arası ek maliyet çıkıyor. Origin SSR ile karşılaştırıldığında compute cost düşük (serverless, pay-per-use) ama KV storage ve bandwidth maliyeti var.

### Debugging ve Monitoring

Edge environment local test etmek zor. Cloudflare `wrangler dev`, Vercel `vercel dev` komutları local emulation yapıyor ama production behavior tam aynı değil. Hata log'ları edge'den stream ediliyor, origin'deki gibi `console.log` hemen görünmüyor. RUM tool'ları (Sentry, Datadog) edge runtime'ı destekliyor ama setup farklı.

Benchmark yaparken dikkat: lab test'te (Lighthouse, WebPageTest) origin vs edge farkı daha belirgin çıkıyor çünkü sabit lokasyon, network ideal. Gerçek user test'inde (RUM, Chrome UX Report) variance daha fazla — mobile network, DNS lookup, TLS handshake gibi faktörler etki ediyor. Bizim production deployment'larında İstanbul-Frankfurt origin SSR ortalama TTFB 140ms iken Cloudflare Edge SSR ortalama 42ms çıktı (70% düşüş). Ancak P95'te fark daha az: 220ms vs 85ms (60% düşüş). Edge'de cold start olmadığı için P95 - median farkı çok küçük.

## Gerçek Dünya Uygulaması: E-Ticaret Personalizasyon

Somut senaryo: Türkiye'de 500K+ günlük session yapan e-ticaret sitesi. Homepage, kategori, PDP personalize ediliyor (son görülen ürünler, öneriler, segment-based banner). Origin SSR'da TTFB 120-180ms, LCP 2.8-4.2s. Cloudflare Workers + KV migration sonrası TTFB 35-55ms, LCP 1.9-2.6s.

Mimari değişiklik:
1. User session KV'ye taşındı (daha önce Redis'teydi)
2. Product recommendation engine'in output'u KV'ye cache'lendi (TTL 300s, user segment bazında)
3. Homepage HTML template Worker'da render edildi (React SSR yerine custom template, 15ms vs 60ms)
4. Critical CSS inline edildi, font preload hint'leri Worker'dan inject edildi

Code complexity arttı — template engine custom, debug zor. Ama performans kazancı çok net: mobile Core Web Vitals %32 yükseldi (Google Search Console verisi), conversion rate %4.2 arttı (same-period comparison). Attribution doğrudan web performance'a bağlanamaz ama timing uyuşuyor.

Bir başka örnek: Headless Shopify sitesi (Hydrogen framework, Remix tabanlı). Shopify Storefront API çağrısı origin'den 80-120ms, edge'den (Cloudflare Workers'a en yakın Shopify POP) 30-50ms. Product listing page 8 ürün gösteriyor, her biri için API çağrısı paralel — origin'de toplam 120ms, edge'de 50ms. Bu sayede PDP yüklenme süresi 3.2s'den 1.8s'ye düştü.

## Karar Mekanizması: Ne Zaman Edge SSR?

Her proje edge SSR'a geçmeli değil. Karar vektörleri:

**Edge SSR tercih edilir:**
- Read-heavy personalizasyon (kullanıcı profili, segment, preference)
- Global user base (latency hassasiyeti yüksek)
- Yüksek trafik (maliyet/performans tradeoff'u olumlu)
- Modern stack tolerance (Node.js API dependency yok)

**Origin SSR kalsın:**
- Write-heavy flow (checkout, order create — strong consistency gerekli)
- Complex backend dependency (database, third-party API, heavy compute)
- Legacy codebase (migration cost yüksek)
- Düşük trafik (edge premium'u justification zor)

Hybrid en gerçekçisi: homepage, listing, PDP edge'de; cart, checkout, account detail origin'de. Bu şekilde personalize deneyim hızlı, kritik transaction güvenli kalıyor. İç mimari olarak edge function origin'e fallback yapabilir — KV miss veya timeout olursa origin SSR devreye girer, kullanıcı deneyimi kırılmaz.

Edge SSR, performans pazarlamasının son halkası değil ama latency'yi kontrol altına aldığınızda optimize etmeniz gereken başka şeyler ortaya çıkıyor: bundle size, hydration cost, CLS. Bu konular UI/UX ve frontend mühendisliğin kesişim noktası — bizim için headless commerce projelerinde bu entegrasyonu kurmak standart flow'un parçası. Edge'e taşımanız rendering süresini düşürüyor ama client-side JavaScript execution hâlâ TBT (Total Blocking Time) ve INP (Interaction to Next Paint) üzerinde belirleyici. Bunu çözmek için island architecture, partial hydration gibi pattern'lere girmek gerekiyor. Bu da başka bir yazının konusu.