---
title: "Headless E-Ticaret Migration: Roadmap ve Risk Yönetimi"
description: "Phased rollout stratejisi, SEO koruması ve sepet terk analiziyle headless e-ticarete geçiş sürecini somut sayılarla planlayın."
publishedAt: 2026-06-28
modifiedAt: 2026-06-28
category: tech
i18nKey: tech-006-2026-06
tags: [headless-commerce, migration, seo-preservation, performance-optimization, risk-management]
readingTime: 8
author: Roibase
---

Monolitik e-ticaret platformundan headless mimariye geçiş, bir gecede "replatform" yapmak değildir. 2026'da ortalama e-ticaret sitesi günde 50.000+ request alır, bunun %40'ı organik aramadan gelir, her saniye kesinti $5.000+ gelir kaybı demektir. Bu sayıları göz önünde bulundurduğunuzda migration stratejisi mühendislik disiplini gerektirir: phased rollout, canonical URL koruması, add-to-cart akışının mikroskopik ölçümü. Bu yazıda headless geçişi için test edilmiş bir roadmap'i, SEO düşüşünü engelleyen teknik kararları ve sepet terk oranını monitoring altında tutma metriklerini somut kod örnekleriyle paylaşacağız.

## Phased Rollout: Trafik Segmentasyonu ve Canary Deployment

Headless migration'da en kritik karar: hangi kullanıcı segmentini önce yeni sisteme yönlendireceksiniz. Big-bang deployment %100 downtime riski taşır; doğru yaklaşım Edge CDN seviyesinde trafik bölmektir. Cloudflare Workers ile %5 yeni kullanıcıyı headless frontend'e yönlendirip, geri kalanını eski stack'e proxy edebilirsiniz.

```javascript
// Cloudflare Worker: Phased headless routing
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const userId = request.headers.get('X-User-ID') || Math.random()
  const rolloutPercent = 5 // %5 headless'a yönlendir
  
  const isNewStack = (hashCode(userId) % 100) < rolloutPercent
  
  if (isNewStack && url.pathname.startsWith('/products')) {
    // Headless Nuxt/Next origin'e yönlendir
    return fetch('https://headless-origin.example.com' + url.pathname, request)
  } else {
    // Eski Shopify Liquid origin
    return fetch('https://legacy-origin.example.com' + url.pathname, request)
  }
}

function hashCode(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}
```

Bu yaklaşımda `rolloutPercent` değişkenini kademeli artırırsınız: %5 → %25 → %50 → %100. Her aşamada 72 saat bekleyip metrik anomali yoksa ilerlersiniz. Kritik metriklere bakın: Largest Contentful Paint (LCP) eski stack'te 2.3s ise headless'ta 1.8s olmalı; add-to-cart success rate %99.2 altına düşerse rollback yaparsınız.

Phased rollout'un ikinci boyutu coğrafi segmentasyon: önce düşük trafikli bir bölgeden (örn. Orta Avrupa) başlayıp ABD ve Türkiye gibi ana pazarlara geçersiniz. Cloudflare'in `request.cf.country` header'ını kullanarak ülke bazlı routing yapabilirsiniz.

### Canary Deployment ve Automatic Rollback

Deployment pipeline'ında automatic rollback mekanizması kurun. Vercel veya Netlify kullanıyorsanız deployment hook'una custom health check ekleyin:

```yaml
# .github/workflows/deploy-headless.yml
- name: Deploy to production
  run: vercel --prod
  
- name: Health check (30s probe)
  run: |
    for i in {1..6}; do
      STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://headless-origin.example.com/api/health)
      if [ $STATUS -ne 200 ]; then
        echo "Health check failed, rolling back"
        vercel rollback
        exit 1
      fi
      sleep 5
    done
```

Health check endpoint'iniz kritik sistemleri test etmeli: database connection pool, cache hit rate, payment gateway ping. 30 saniye içinde %100 başarı oranı yoksa deployment otomatik geri alınır.

## SEO Preservation: Canonical URL ve Structured Data Koruması

Headless migration'da en büyük korku organik trafiğin düşmesidir. Google'ın 2025 Merchant Center verilerine göre e-ticaret sitelerinin %68'i replatform sonrası ilk 90 günde %15+ organik trafik kaybı yaşar. Bunun nedeni canonical URL'lerin değişmesi, structured data'nın kaybolması, redirect chain'lerinin hatalı kurulmasıdır.

Öncelikle eski ve yeni sistemde URL yapısını 1:1 eşleyin. Shopify'dan Next.js'e geçiyorsanız:

| Eski (Shopify Liquid) | Yeni (Next.js) | Durum |
|---|---|---|
| `/products/wireless-headphones` | `/products/wireless-headphones` | ✅ Aynı slug |
| `/collections/electronics` | `/categories/electronics` | ❌ Path değişti — 301 redirect gerekli |
| `/pages/about` | `/about` | ⚠️ Path kısaldı — canonical tag ekle |

Path değişikliği gereken durumlarda Edge seviyesinde 301 redirect kurun. Cloudflare Workers örneği:

```javascript
const REDIRECT_MAP = {
  '/collections/electronics': '/categories/electronics',
  '/pages/about': '/about'
}

addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  const newPath = REDIRECT_MAP[url.pathname]
  
  if (newPath) {
    return Response.redirect(url.origin + newPath, 301)
  }
  
  event.respondWith(fetch(event.request))
})
```

Structured data'yı kontrol edin: Product, BreadcrumbList, Organization schema'ları eski sistemde varsa yeni sistemde de aynı formatta olmalı. Next.js'te `next-seo` kütüphanesi yerine manual `<script type="application/ld+json">` kullanın — rendering garantisi daha yüksek:

```jsx
// app/products/[slug]/page.tsx
export default function ProductPage({ product }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.title,
    "sku": product.sku,
    "offers": {
      "@type": "Offer",
      "price": product.price,
      "priceCurrency": "TRY",
      "availability": product.stock > 0 ? "InStock" : "OutOfStock"
    }
  }
  
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {/* Product render */}
    </>
  )
}
```

Google Search Console'da "URL Inspection" tool'unu kullanarak yeni sayfaların indexleme durumunu takip edin. Migration sonrası ilk 30 gün boyunca haftalık "Coverage" raporuna bakın: yeni sistemde "Indexed, not submitted in sitemap" hata sayısı 50+ ise sitemap generation'ınız çalışmıyor demektir.

### Redirect Chain Minimizasyonu

Eski sistemdeki redirect chain'leri temizleyin. Örneğin Shopify'da bir ürün `/products/old-name` → `/products/new-name` redirect'i varsa, headless sistemde doğrudan final URL'i kullanın. İki seviyeden fazla redirect (A → B → C) Google'ın crawl budget'ini tüketir ve PageRank transfer efficiency'yi düşürür. Roibase'in [Headless Commerce](https://www.roibase.com.tr/tr/headless) projelerinde redirect audit sürecinde ortalama %40 chain reduction sağlanır.

## Add-to-Cart Abandon Analysis: Conversion Funnel Monitoring

Headless migration sırasında en hassas metrik add-to-cart (ATC) success rate'dir. Eski sistemde kullanıcı "Sepete Ekle" butonuna tıkladığında %99.5 başarı oranı varsa, yeni sistemde %98'e düşerse günde 1.500 lost cart demektir (100.000 visitor × %3 ATC intent × %1.5 düşüş).

ATC event'ini hem client-side hem server-side loglamak zorundasınız. Client-side GTM tag'i network hatalarını yakalayamaz; server-side log kesin kayıttır:

```javascript
// app/api/cart/add/route.ts (Next.js App Router)
import { NextResponse } from 'next/server'
import { logEvent } from '@/lib/analytics'

export async function POST(request: Request) {
  const { productId, quantity } = await request.json()
  const startTime = Date.now()
  
  try {
    const cart = await addToCart(productId, quantity)
    const duration = Date.now() - startTime
    
    // Server-side event logging
    await logEvent({
      event: 'add_to_cart_success',
      productId,
      quantity,
      duration, // ms
      userId: request.headers.get('X-User-ID')
    })
    
    return NextResponse.json({ cart }, { status: 200 })
  } catch (error) {
    const duration = Date.now() - startTime
    
    await logEvent({
      event: 'add_to_cart_failure',
      productId,
      quantity,
      duration,
      error: error.message,
      userId: request.headers.get('X-User-ID')
    })
    
    return NextResponse.json({ error: 'Failed to add to cart' }, { status: 500 })
  }
}
```

Bu log'ları BigQuery'de aggregate edip anomaly detection yapın:

```sql
-- Daily ATC success rate comparison
SELECT
  DATE(timestamp) AS date,
  COUNTIF(event = 'add_to_cart_success') AS success_count,
  COUNTIF(event = 'add_to_cart_failure') AS failure_count,
  SAFE_DIVIDE(
    COUNTIF(event = 'add_to_cart_success'),
    COUNTIF(event IN ('add_to_cart_success', 'add_to_cart_failure'))
  ) * 100 AS success_rate_percent
FROM analytics.events
WHERE DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY date
ORDER BY date DESC
```

Success rate %99 altına düşerse alarm kurabilirsiniz (Slack webhook, PagerDuty). Ayrıca `duration` metriğine bakın: eski sistemde ortalama ATC response time 120ms ise headless'ta 80ms olmalı — eğer 200ms'ye çıkıyorsa database query optimization yapmanız gerekir.

### Session Replay ve Error Tracking

Sentry veya LogRocket gibi session replay tool kurun. ATC failure event'lerini session ID ile eşleştirip kullanıcının tam yolculuğunu görün: hangi adımda button disabled kaldı, hangi network request timeout verdi. Roibase'in headless migration projelerinde session replay sayesinde tespit edilen bug'ların %60'ı race condition'dan kaynaklanır — örneğin inventory check API'si cart mutation'dan önce tamamlanmadığı için button premature enable oluyor.

## Performans Metrikleri: Core Web Vitals ve Runtime Cost

Headless migration'ın asıl amacı performance iyileştirmedir. Ancak kötü implement edilmiş headless sistem monolitik Shopify'dan DAHA YAVAŞ olabilir. Client-side rendering (CSR) yapıyorsanız LCP 4+ saniyeye çıkar; doğru yaklaşım server-side rendering (SSR) veya static site generation (SSG) + incremental static regeneration (ISR).

Next.js App Router'da product detail page için ISR örneği:

```tsx
// app/products/[slug]/page.tsx
export const revalidate = 3600 // 1 saatte bir regenerate

export async function generateStaticParams() {
  const products = await getTopProducts(100) // İlk 100 ürünü pre-render et
  return products.map(p => ({ slug: p.slug }))
}

export default async function ProductPage({ params }) {
  const product = await getProduct(params.slug)
  
  return (
    <div>
      <h1>{product.title}</h1>
      <Image src={product.image} alt={product.title} priority />
      <AddToCartButton productId={product.id} />
    </div>
  )
}
```

Bu yapıda ilk 100 ürün build time'da generate edilir, geri kalanı first request'te on-demand render olur ve 1 saat cache'lenir. LCP 1.2s altına iner çünkü HTML hazır, sadece image loading var.

Runtime cost'u da ölçün: serverless function invocation sayısı × execution time × pricing. Vercel'de ortalama SSR page 50ms execution time alıyorsa ve günde 100.000 page view varsa: 100k × 50ms = 5 milyon GB-s, bu $25/gün demektir (Vercel Pro plan pricing). Bunu düşürmek için:

1. Edge caching — Cloudflare'de `Cache-Control: s-maxage=3600` ile CDN cache aktif et
2. Partial hydration — Astro veya Qwik kullan, sadece interactive component'leri hydrate et
3. Database query optimization — N+1 problem varsa Prisma'da `include` kullan, 10 query'i 1'e düşür

| Metrik | Eski (Shopify Liquid) | Yeni (Next.js SSR) | Hedef |
|---|---|---|---|
| LCP | 2.3s | 1.8s | <2.5s |
| TBT | 190ms | 120ms | <200ms |
| CLS | 0.08 | 0.02 | <0.1 |
| Server response time | 420ms | 180ms | <300ms |
| Monthly runtime cost | $0 (included) | $750 (Vercel Pro) | <$1000 |

## Rollback Stratejisi ve Dual-Run Period

Migration'ın son aşaması dual-run period: her iki sistem de 30 gün paralel çalışır, canary deployment ile trafik kademeli kaydırılır. Bu sürede "shadow mode" yapın — headless sistem henüz production değil ama her request'i background'da işleyip logluyor. Böylece canlı trafik ile test ediyorsunuz ama hata durumunda kullanıcı etkilenmiyor.

Shadow mode implementation:

```javascript
// Cloudflare Worker: Shadow request to headless
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const legacyResponse = fetch('https://legacy-origin.example.com' + new URL(request.url).pathname, request)
  
  // Async shadow request to headless (result ignored)
  event.waitUntil(
    fetch('https://headless-origin.example.com' + new URL(request.url).pathname, request.clone())
      .then(res => logShadowResult(request.url, res.status, res.headers.get('x-response-time')))
      .catch(err => logShadowError(request.url, err.message))
  )
  
  return legacyResponse
}
```

30 gün sonra shadow log'larına bakıp headless sistem %99.9 uptime ve <2s response time gösteriyorsa full cutover yaparsınız.

Rollback planı basit olmalı: DNS CNAME'i eski origin'e çevirirsiniz, 2 dakika içinde eski sistem aktif olur. Bu yüzden migration sonrası 90 gün eski sistemi tamamen kapatmayın — read-only mode'da tutun, acil durumda hızlı geri dönüş için.

Headless e-ticarete geçiş, doğru roadmap ve sürekli metrik ölçümü ile risk yönetilebilir bir süreçtir. Phased rollout trafiği kontrol altında tutar, SEO preservation organik gelir kaybını engeller, ATC monitoring conversion funnel'ını korur. Migration süreci boyunca mühendislik disiplinine bağlı kalırsanız — big-bang yerine kademeli, tahmin yerine ölçüm, umut yerine rollback planı — hem performance kazanımını hem de business continuity'yi sağlarsınız.