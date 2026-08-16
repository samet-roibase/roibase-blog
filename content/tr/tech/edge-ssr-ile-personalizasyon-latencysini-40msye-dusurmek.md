---
title: "Edge SSR ile Personalizasyon Latency'sini 40ms'ye Düşürmek"
description: "Cloudflare Workers ve Vercel Edge ile KV store mimarisini kullanarak server-side rendering latency'sini nasıl 40ms'ye indirdiğimizi kod örnekleriyle açıklıyoruz."
publishedAt: 2026-08-16
modifiedAt: 2026-08-16
category: tech
i18nKey: tech-003-2026-08
tags: [edge-computing, ssr, cloudflare-workers, vercel-edge, web-performance]
readingTime: 8
author: Roibase
---

Geleneksel SSR mimarilerinde personalizasyon latency'si 200-400ms arasında kalıyor. Kullanıcı lokasyonu, tercih verisi ve geçmiş davranışlarına göre sayfa render etmek istediğinizde bu süre 600ms'ye kadar çıkabiliyor. Edge SSR ile bu sayıyı 40ms'ye düşürmek mümkün — ancak mimari doğru kurulmadığında edge ortamının kısıtları (CPU limit, cold start, bellek) performansı yok edebiliyor. Bu yazıda production'da çalışan bir Cloudflare Workers + KV mimarisinin anatomisini açıyoruz: hangi verileri edge'de tutuyoruz, hangi request'leri origin'e yönlendiriyoruz ve 40ms latency'yi garantilemek için hangi tradeoff'ları yapıyoruz.

## Edge SSR'ın Klasik Origin SSR'dan Farkı

Klasik SSR akışında request şöyle ilerler: CDN → origin server → database → render → response. Her hop 20-60ms latency ekler, toplam 250-400ms sürer. Edge SSR bu zinciri kırıyor: request Cloudflare Workers veya Vercel Edge Function gibi edge runtime'a düşüyor, KV store'dan okuma 5-15ms sürüyor, render 10-25ms'de tamamlanıyor. Toplam latency 40-60ms'ye iniyor.

Fark sadece coğrafi yakınlık değil — mimari temelde farklı. Edge runtime'lar V8 isolate teknolojisini kullanıyor, cold start 0-5ms seviyesinde. Node.js container cold start'ı 200-800ms olabilir. KV store distributed key-value yapısı sayesinde database TCP handshake'inin latency overhead'ini ortadan kaldırıyor. Bir örnek: kullanıcı segmentasyonu için Postgres'e query atarsanız 80-120ms sürer (connection + query + parsing), aynı veriyi Cloudflare KV'ye namespace olarak koyarsanız 8-12ms'de okursunuz.

Tradeoff ise şu: edge runtime CPU limit 50ms, memory limit 128MB civarı (platform'a göre değişir). Ağır hesaplama veya büyük JSON parsing yaparsanız limit'i aşarsınız. Bu yüzden edge'de sadece "sıcak yol" render edilir — karmaşık işler origin'e bırakılır.

## KV Store Mimarisinin Anatomisi

KV store'u cache gibi düşünmeyin — distributed global state olarak tasarlayın. Biz şu yapıyı kullanıyoruz: her kullanıcı segmenti (örn "premium-tr", "free-us") bir namespace key'i oluyor, value olarak JSON tutuluyor. Key formatı: `user_segment:{segment_id}:config`. Bu config içinde personalizasyon kuralları var: hangi hero image gösterilecek, fiyat notu ne olacak, CTA metni nasıl değişecek.

```typescript
// Cloudflare Workers örneği
interface UserSegmentConfig {
  heroImage: string;
  ctaText: string;
  priceNote: string;
  featureFlags: string[];
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const segmentId = getCookie(request, 'segment_id') || 'default';
    
    const configKey = `user_segment:${segmentId}:config`;
    const configRaw = await env.KV_NAMESPACE.get(configKey);
    
    if (!configRaw) {
      // Fallback: origin'den al, KV'ye yaz
      const originConfig = await fetchFromOrigin(segmentId);
      await env.KV_NAMESPACE.put(configKey, JSON.stringify(originConfig), {
        expirationTtl: 3600 // 1 saat
      });
      return renderPage(originConfig);
    }
    
    const config: UserSegmentConfig = JSON.parse(configRaw);
    return renderPage(config);
  }
};
```

Bu kodda `renderPage` fonksiyonu edge'de inline HTML string interpolation yapıyor — template engine kullanmıyoruz çünkü bundle size 128MB limit'ine takılabiliyor. Bunun yerine literal string veya hafif bir JSX-to-string transformer kullanıyoruz.

KV TTL stratejisi kritik: 1 saat TTL ile her saatte bir origin'den refresh oluyoruz. Eğer content sık değişiyorsa (örn flash sale) TTL'yi 5 dakikaya düşürebilirsiniz, ama bu origin hit rate'i %15-20 artırır. Bizim senaryoda segment config'i günde 2-3 kez değişiyor, 1 saat ideal denge noktası.

### KV Write Stratejisi: Cache-Aside vs Write-Through

İki strateji var: **cache-aside** (yukarıdaki örnekteki gibi — miss olunca origin'den al, KV'ye yaz) ve **write-through** (origin update olduğunda webhook ile KV'yi invalide et veya doğrudan yaz). Biz cache-aside kullanıyoruz çünkü webhook latency'si %2-3 failure rate ekliyor (network timeout, retry logic). Cache-aside'da ilk request yavaş olur (200ms), sonraki tüm request'ler 40ms'de tamamlanır. Günlük 1M pageview'da ilk request overhead'i ihmal edilebilir.

Write-through kullanacaksanız Cloudflare'in Queue API'si veya Vercel'in Incremental Static Regeneration (ISR) benzeri bir mekanizma kurun — webhook doğrudan KV'ye yazmasın, queue'ya push etsin, worker queue'dan consume edip KV'ye yazsın. Bu retry garantisi ve rate limiting sağlar.

## Vercel Edge vs Cloudflare Workers: Mimari Seçim Kriterleri

İki platform benzer ama önemli farklar var. Cloudflare Workers KV native, global replication otomatik, pricing read-heavy workload için daha ucuz ($0.50/10M read vs Vercel Edge'in Redis benzeri pricing). Vercel Edge middleware Next.js ile daha iyi entegre, TypeScript DX güçlü, ama KV alternatifi olarak Vercel KV (Upstash Redis tabanlı) kullanıyorsunuz — bu da ek latency ekliyor (12-18ms vs Cloudflare KV'nin 5-10ms'si).

Biz [Headless Commerce](https://www.roibase.com.tr/tr/headless) projelerinde Cloudflare Workers tercih ediyoruz çünkü e-commerce trafiği read-heavy (ürün sayfası, kategori sayfası sürekli okunuyor, yazma nadiren oluyor). Vercel Edge'i Next.js App Router projelerinde middleware olarak kullanıyoruz — çünkü API route'lar ve server component'lerle aynı repo'da kalıyor, deployment pipeline tek.

Benchmark: aynı personalizasyon logic'ini her iki platformda koşturduk. Cloudflare Workers P95 latency 42ms, Vercel Edge P95 latency 58ms (Vercel KV overhead'inden dolayı). CPU kullanımı benzer (15-20ms), fark storage read latency'sinden geliyor.

## Cold Start ve Bundle Size Optimizasyonu

Edge runtime'ların cold start'ı düşük ama bundle size büyükse sorun çıkar. Cloudflare Workers 1MB script size limit koyuyor (compressed), Vercel Edge ~1MB bundle kabul ediyor ama büyüdükçe cold start artıyor. Biz şu taktikleri uyguluyoruz:

**1. Dependency tree pruning:** `lodash` yerine `lodash-es` (tree-shakeable), `moment` yerine `date-fns`. Bundle analyzer ile kullanılmayan modülleri temizledik — 340KB → 180KB düştü.

**2. Dynamic import yasağı:** Edge'de dynamic import `import()` cold start'ı 30-50ms artırıyor. Tüm dependency'leri statik import edin, bundler'ın tree-shaking yapmasına izin verin.

**3. Inline kritik code:** Personalizasyon logic 40-50 satırlık ise ayrı modül yerine inline yazın. Module resolution bile 2-3ms ekliyor.

```typescript
// ❌ Kötü: ayrı modül
import { renderHero } from './heroRenderer';

// ✅ İyi: inline
function renderHero(config: UserSegmentConfig): string {
  return `<div class="hero">${config.heroImage}</div>`;
}
```

**4. Wasm kullanımı:** Eğer ağır parsing yapmanız gerekiyorsa (JSON schema validation, markdown parsing) Rust veya Go ile yazıp Wasm'a compile edin. Wasm modülü 50-80KB olur, JavaScript bundle'ından 200-300KB tasarruf edersiniz. Ancak Wasm instantiation 10-15ms ekler — tradeoff yapın.

## Monitoring ve Latency Garantisi

40ms latency hedefini garantilemek için RUM (Real User Monitoring) ve synthetic monitoring kuruyoruz. Cloudflare Workers'ın Analytics API'si P50/P95/P99 latency metriklerini sunar, bunları Grafana'ya push ediyoruz. Alarm threshold: P95 > 60ms ise alert.

```typescript
// Workers Analytics Event örneği
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startTime = Date.now();
    const response = await handleRequest(request, env);
    const duration = Date.now() - startTime;
    
    ctx.waitUntil(
      env.ANALYTICS.writeDataPoint({
        blobs: [request.url],
        doubles: [duration],
        indexes: [request.headers.get('cf-ray') || '']
      })
    );
    
    return response;
  }
};
```

`ctx.waitUntil` asenkron analytics yazımını response latency'sine eklemeden yapıyor — kritik. Eğer `await` kullanırsanız her request'e 5-10ms eklenir.

Synthetic monitoring için Checkly veya Pingdom kullanıyoruz — 5 farklı coğrafi lokasyondan dakikada 1 request atıyor, latency 70ms'yi geçerse Slack alert. Bu sayede edge node degradation'ını 3-5 dakikada yakalıyoruz.

## Origin Fallback ve Graceful Degradation

Edge'de her durumu handle edemezsiniz — KV timeout, CPU limit aşımı, unexpected error olabilir. Bu durumlarda origin'e fallback gerekiyor. Biz şu stratejide karar kıldık: edge error rate %1'i geçerse 10 dakika boyunca tüm trafik origin'e yönlendirilir, sonra tekrar edge'e dönülür.

```typescript
async function handleWithFallback(request: Request, env: Env): Promise<Response> {
  try {
    const edgeResponse = await renderEdge(request, env);
    return edgeResponse;
  } catch (error) {
    // Log to Sentry/Datadog
    console.error('Edge render failed:', error);
    
    // Origin'e proxy
    return fetch(request.url, {
      headers: request.headers,
      cf: { cacheEverything: true }
    });
  }
}
```

Bu fallback mekanizması %99.8 uptime sağlıyor. Edge'de failure olduğunda latency 200-250ms'ye çıkıyor (origin SSR), ama kullanıcı deneyimi korunuyor. Alternatif: edge'de hata olduğunda statik fallback HTML döndürmek — ama bu e-commerce'da kabul edilemez (personalizasyon kaybı = conversion kaybı).

## Gerçek Dünya Sonuçları ve Karşılaştırma

Production'da 6 ay boyunca 12M pageview'da şu sayıları gördük: P50 latency 38ms, P95 latency 54ms, P99 latency 89ms (P99'da origin fallback devreye giriyor). Origin SSR ile karşılaştırıldığında: P50 220ms → 38ms (%83 düşüş), P95 380ms → 54ms (%86 düşüş).

Core Web Vitals etkisi: LCP 2.4s → 1.1s (hero image personalizasyonu edge'de render edildiği için), FCP 1.8s → 0.9s, TBT değişmedi (JavaScript bundle aynı). Conversion rate %2.8 arttı (A/B test, 95% confidence) — latency düşüşü doğrudan business metric'e yansıdı.

Maliyet: Cloudflare Workers + KV ile aylık $180 (10M request, 50M KV read), origin SSR için EC2 instance maliyeti $420 idi. %57 maliyet düşüşü + %86 latency düşüşü elde ettik. ROI hesabı: development effort 120 saat (2 hafta sprint), payback period 2 ay.

Edge SSR mimarisi tek başına magic bullet değil — doğru veri modellemesi, KV stratejisi ve fallback mekanizması olmadan başarısız olur. Ancak bu üç unsuru doğru kurduğunuzda 40ms latency garanti edilebilir bir hedef haline geliyor.