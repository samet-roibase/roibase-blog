---
title: "Headless E-Ticaret: Migration Roadmap ve Risk Yönetimi"
description: "Headless migrasyonda SEO korunumu, phased rollout stratejisi ve sepet terk riskini sayılarla yöneten roadmap. ATC abandon analizi dahil."
publishedAt: 2026-06-09
modifiedAt: 2026-06-09
category: tech
i18nKey: tech-006-2026-06
tags: [headless-commerce, migration-strategy, seo-preservation, risk-management, phased-rollout]
readingTime: 8
author: Roibase
---

Headless e-ticaret migrasyonu 2025'in sonunda %38'lik büyüme oranıyla en riskli teknoloji projesi olarak öne çıktı. Ortalama downtime 14 saat, SEO trafiğindeki ortalama kayıp %23, sepet terk oranındaki ani sıçrama %17. Bu rakamlar migrasyonun "hepsini birden" yaklaşımıyla yapıldığında ortaya çıkan sonuçlar. Phased rollout, SEO preservation katmanı ve gerçek zamanlı ATC (Add-to-Cart) abandon analiziyle bu riskleri %80 oranında azaltmak mümkün. Bu yazı migration roadmap'i risk yönetimi katmanıyla birlikte detaylandırıyor.

## Migration Scope: Monolitten Headless'e Geçişin Gerçek Yükü

Headless migrasyonun teknik karmaşıklığı alt kademe yazılımcıların "sadece frontend'i değiştiriyoruz" yorumuyla hafife alınıyor. Gerçekte değişen yalnızca render katmanı değil, tüm data flow mimarisi. Shopify Liquid'den Next.js App Router'a geçiş yalnızca template değişimi değil, 47 farklı API endpoint'ini orchestrate etmek, client-side state management'ı yeniden kurmak, CDN caching stratejisini sıfırdan yazmak anlamına geliyor.

Tipik bir mid-market e-ticaret sitesi için (300+ SKU, 5000+ daily session) migration scope şöyle dağılıyor: %35 frontend refactor (component tree, routing, lazy loading), %30 backend entegrasyon (cart API, checkout flow, payment gateway), %20 data migration (product catalog, customer data, order history), %15 DevOps (CI/CD pipeline, edge deployment, monitoring). Bu oranlar projenin yalnızca kod yazma kısmı. SEO preservation katmanı, A/B test infrastructure, rollback stratejisi bu scope'un dışında kalıyor ve toplam effort'u %40 artırıyor.

Monolitik Shopify Plus sistemden [Headless Commerce](https://www.roibase.com.tr/tr/headless) mimarisine geçişte en büyük tuzak, mevcut sistemin "implicit" olarak çözdüğü problemleri explicit hale getirmek zorunda kalman. Örneğin Liquid'de otomatik oluşan `cart.js` dosyasını headless'te manually orchestrate ediyorsun — session management, inventory locking, price calculation, discount rules. Bu katman eksik kalırsa sepet terk oranı %22'ye çıkıyor (sektör ortalaması %18).

## Phased Rollout Stratejisi: Shadow Mode ve Canary Deployment

"Big bang" deployment — tüm trafiği tek anda headless'e yönlendirme — %34 başarısızlık oranına sahip. Phased rollout bu oranı %6'ya düşürüyor. İlk faz shadow mode: yeni headless frontend'i production'da ayağa kaldırıyorsun ama trafik görmüyor. Backend API call'ları real-time production data'ya yapılıyor ama response user'a dönmüyor. Bunun yerine monolitik sistemin response'unu servis ederken, headless response'unu Datadog'a log'luyorsun. Bu fazda headless sistemin performance karakteristiğini öğreniyorsun: TTFB, LCP, API latency distribution, error rate.

İkinci faz canary deployment: %2 trafiği headless'e yönlendiriyorsun. Bu trafik segmenti rastgele değil, stratejik seçilmiş: yeni kullanıcılar (cookie yok), mobile Safari (Core Web Vitals en kötü burada), non-checkout page'ler (cart update yok). Bu fazda kritik metrikler: session duration (baseline'a göre %15'ten fazla düşüş alarm), bounce rate (özellikle PLP'de), ATC conversion rate. Eğer bu metrikler stabil kalıyorsa trafiği kademeli olarak artırıyorsun: %2 → %10 → %25 → %50 → %100. Her kademe en az 72 saat sürmeli — browser cache invalidation + returning visitor pattern'ını görmek için.

Üçüncü faz feature rollout: checkout flow'u en son migrate ediyorsun. Headless sistemde PLP, PDP, cart page production'da çalışırken, checkout hâlâ monolitik sistemde olabilir. Bu hybrid yaklaşım "checkout abandonment spike" riskini ortadan kaldırıyor. Kullanıcı "Proceed to Checkout" dediğinde backend session data'yı monolitik sisteme transfer ediyor, checkout tamamlandıktan sonra headless'e geri dönüyor. Bu fazda tracking katmanı kritik: checkout başlangıç noktasını BigQuery'ye log'layıp, completion rate'i gerçek zamanlı izliyorsun.

```javascript
// Canary routing logic — Cloudflare Worker örneği
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const canaryPercent = 2; // %2 headless'e
    const userHash = await hashString(request.headers.get('CF-Connecting-IP'));
    const isCanary = (userHash % 100) < canaryPercent;
    
    // Checkout path'leri her zaman monolith'e
    if (url.pathname.startsWith('/checkout')) {
      return fetch('https://monolith.shop.com' + url.pathname);
    }
    
    // Canary segment headless'e, geri kalanı monolith'e
    const origin = isCanary 
      ? 'https://headless.shop.com' 
      : 'https://monolith.shop.com';
    
    const response = await fetch(origin + url.pathname);
    
    // Response header'a deployment flag ekle (debugging için)
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Deployment', isCanary ? 'headless' : 'monolith');
    
    return newResponse;
  }
};

async function hashString(str) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return new Uint8Array(buffer)[0];
}
```

## SEO Preservation: URL Mapping ve Crawl Budget Yönetimi

Headless migrasyonda en büyük SEO riski URL structure değişimi. Shopify'ın otomatik oluşturduğu `/collections/summer-sale` path'ini Next.js App Router'da `/kategori/yaz-indirimi` olarak değiştirirsen, mevcut backlink'lerin değeri sıfırlanıyor. Google 4-6 hafta boyunca eski URL'leri crawl etmeye devam ediyor, 404 görünce page authority düşürüyor. Bu süreçte organik trafik %18-27 arası düşüş gösteriyor.

SEO preservation roadmap üç katmandan oluşuyor. İlk katman URL inventory: production siteden tüm indexlenmiş URL'leri çekiyorsun (Google Search Console API + Screaming Frog). Bu liste yalnızca product/category URL'leri değil, blog post'lar, landing page'ler, dynamic filter URL'leri de içermeli. İkinci katman redirect mapping: her eski URL için yeni URL'i manuel olarak eşleştiriyorsun. Bu işlem automated olamaz — bazı ürünler headless'te birleştirilmiş, bazı kategoriler yeniden organize edilmiş olabilir. Üçüncü katman 301 redirect implementation: redirect rule'larını edge layer'da (Cloudflare Workers, Vercel Edge Middleware) implement ediyorsun, origin server'a ulaşmadan çözülmesi için.

Crawl budget yönetimi kritik. Headless sistemde server-side rendering (SSR) + incremental static regeneration (ISR) kombinasyonu kullanıyorsan, Googlebot ilk crawl'da her page için SSR tetikliyor. Bu da origin server'a büyük load bindiriyor. Çözüm: ISR cache'ini pre-warm etmek. Sitemap'teki tüm URL'leri cron job ile günde 2 kez crawl edip cache'e yazıyorsun. Böylece Googlebot cache'lenmiş HTML'i görüyor, TTFB 40ms'nin altında kalıyor (Google'ın "fast site" eşiği 100ms).

| SEO Metrik | Monolith Baseline | Migration Sırasında (Risk) | Phased + Preservation (Hedef) |
|---|---|---|---|
| Indexed Pages | 2847 | -423 (15 gün içinde) | -12 (geçici, 7 gün içinde geri) |
| Organic Traffic | 100% | 77% (ilk 2 hafta) | 96% (ilk hafta), 102% (4. hafta) |
| Core Web Vitals Pass Rate | 68% | 45% (SSR overhead) | 89% (edge optimization) |
| Crawl Error Rate | 0.8% | 7.2% (404 spike) | 1.1% (kontrollü) |

## ATC Abandon Analysis: Sepet Terk Riskini Gerçek Zamanlı İzlemek

Headless migrasyonun e-ticaret için en kritik riski add-to-cart (ATC) funnel'ında kırılma. Monolitik sistemde "Add to Cart" butonu tıklandığında backend hemen response dönüyor (avg 120ms). Headless'te aynı aksiyon 3 farklı API call gerektiriyor: inventory check, cart update, price calculation. Bu chain'de tek bir endpoint 300ms gecikirse, toplam ATC latency 900ms'ye çıkıyor. Kullanıcı butona tıklıyor, 1 saniye bekliyor, "eklenemedi mi?" diye tekrar tıklıyor — duplicate cart item oluşuyor. Bu UX problemi %11 ATC abandon rate artışına neden oluyor.

ATC abandon analysis roadmap'i real-time event tracking üzerine kurulu. Frontend'te her ATC action'ını Segment/Mixpanel'e event olarak gönderiyorsun: `add_to_cart_initiated`, `add_to_cart_api_success`, `add_to_cart_ui_updated`. Bu event'lerin timestamp'ini karşılaştırıp latency distribution'ı hesaplıyorsun. Hedef: p95 latency 400ms'nin altında. Eğer belirli product ID'lerde p95 spike görüyorsan (örn 1200ms), o ürünün inventory API'sinde bottleneck var demektir.

Migration sırasında A/B test infrastruktur'ünü ATC funnel'ına özel optimize ediyorsun. Control group monolitik sistemde, test group headless'te. Her iki grup için aynı product ID'lerde ATC conversion rate'i ölçüyorsun. Headless'te %3'ten fazla düşüş varsa rollback tetikliyorsun. Bu threshold'u dinamik tutmak kritik — düşük margin ürünlerde (örn elektronik) %1 conversion drop kabul edilemez, yüksek margin'de (örn moda) %5 tolere edilebilir.

```javascript
// ATC abandon tracking — frontend event orchestration
async function handleAddToCart(productId, quantity) {
  const startTime = performance.now();
  
  // Event 1: ATC initiated
  analytics.track('add_to_cart_initiated', {
    product_id: productId,
    quantity: quantity,
    timestamp: Date.now()
  });
  
  try {
    // API call chain
    const [inventory, price] = await Promise.all([
      fetch(`/api/inventory/${productId}`).then(r => r.json()),
      fetch(`/api/price/${productId}`).then(r => r.json())
    ]);
    
    if (!inventory.in_stock) {
      analytics.track('add_to_cart_failed', { reason: 'out_of_stock' });
      return;
    }
    
    const cartResponse = await fetch('/api/cart', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, quantity, price: price.amount })
    });
    
    const endTime = performance.now();
    const latency = endTime - startTime;
    
    // Event 2: ATC success
    analytics.track('add_to_cart_success', {
      product_id: productId,
      latency_ms: latency,
      timestamp: Date.now()
    });
    
    // Latency threshold alarm
    if (latency > 800) {
      fetch('/api/monitoring/alert', {
        method: 'POST',
        body: JSON.stringify({
          alert_type: 'atc_latency_high',
          product_id: productId,
          latency: latency
        })
      });
    }
    
  } catch (error) {
    const endTime = performance.now();
    analytics.track('add_to_cart_error', {
      product_id: productId,
      error_message: error.message,
      latency_ms: endTime - startTime
    });
  }
}
```

## Rollback Stratejisi ve Post-Migration Monitoring

Migration planında rollback stratejisi olmadan production'a çıkmak %41 failure rate demek. Rollback iki katmanda planlanmalı: infrastructure rollback (DNS, CDN config) ve data rollback (cart state, session data). Infrastructure rollback Cloudflare Worker'da origin switching ile 30 saniye içinde yapılabilir. Ama data rollback daha karmaşık — headless sistemde oluşan cart item'ları monolitik sisteme nasıl transfer edeceksin?

Çözüm: dual-write pattern. Migration sırasında her cart update'i hem headless hem monolitik sisteme yazılıyor. Bu data inconsistency riski oluşturur ama rollback'i mümkün kılar. Rollback tetiklendiğinde monolitik sistemin cart data'sı zaten güncel, kullanıcı hiçbir item kaybetmiyor. Dual-write overhead'i %8 latency artışı oluşturuyor ama bu tradeoff kabul edilebilir.

Post-migration monitoring 90 gün sürüyor. İlk 30 gün Core Web Vitals, error rate, conversion rate'i günlük takip ediyorsun. 30-60. günlerde SEO metrikleri (indexed pages, organic traffic, ranking distribution) odaklanıyorsun. 60-90. günlerde retention metrics (repeat purchase rate, customer lifetime value) izliyorsun. Bu fazda headless'in gerçek ROI'si ortaya çıkıyor — LCP 2.1s'den 0.8s'ye düştüğünde mobile conversion rate %19 artıyor, bu da 90. günde net pozitif ROI demek.

Headless migrasyonu "yap-bırak" projesi değil, sürekli optimizasyon döngüsü. İlk deployment'tan sonra edge caching stratejisini refine ediyorsun, API response time'ı optimize ediyorsun, component lazy loading threshold'larını test ediyorsun. Bu optimizasyonlar 6 ay boyunca devam ediyor ve toplam performance kazancının %60'ını oluşturuyor. Migration roadmap'i bu post-launch optimization budget'ini de içermeli — aksi halde headless'e geçtikten sonra "neden hızlanmadı?" sorusuyla karşılaşırsın.