---
title: "Composable Commerce: MACH Mimarisi Production Realitesi"
description: "BigCommerce, commercetools, Shopify Plus — composable commerce tradeoff'larını production senaryolarında benchmark'larla çözümlüyoruz."
publishedAt: 2026-06-25
modifiedAt: 2026-06-25
category: tech
i18nKey: tech-005-2026-06
tags: [composable-commerce, mach-architecture, headless-commerce, shopify-hydrogen, commercetools]
readingTime: 8
author: Roibase
---

2024'te "composable commerce" artık PowerPoint teriminden production gerçeğine döndü. Stack Overflow Developer Survey 2025'e göre enterprise e-ticaret geliştirmelerinin %43'ü monolith platformdan MACH (Microservices, API-first, Cloud-native, Headless) mimarisine geçiş yaptı. Ancak bu geçişlerde BigCommerce, commercetools, Shopify Plus kararı hala ölçülebilir tradeoff'lara dayalı değil — "headless daha modern" gibi buzzword'lere dayalı. Bu yazıda üç ana vendor'ü production senaryolarında karşılaştırıyoruz: API response time'ları, developer ergonomics, runtime cost, multi-region latency. Kararınızı satış demosundan değil, stack tracinginizden verin.

## MACH Mimarisinin Gerçek Anlamı

MACH kısaltması 2020'de MACH Alliance tarafından tanımlandı ama terimin günlük kullanımı karışık. Pratikte MACH şunu ifade eder: backend commerce logic (fiyat, stok, sipariş) API üzerinden sunulur, frontend tamamen ayrı deploy edilir (Vercel, Netlify, Cloudflare Pages). Bu ayrıştırma sayesinde A/B testi için frontend değişikliğini backend release'ine bağlamazsınız.

Ancak bu mimari fragmantasyon getirir. Monolitik Magento'da `$product->getPrice()` bir fonksiyon çağrısıyken, headless'ta REST veya GraphQL isteği haline gelir. Network latency ekler. Örnek: Shopify Storefront API (GraphQL) ortalama 120ms response time verir (CDN cache miss durumunda, Avrupa'dan North America instance'ına). commercetools API dokumentasyonuna göre P95 latency 180ms (global deployment'ta). Bu sayıları frontend server-side rendering'e (SSR) koyarsanız, her sayfa render'ı 120-180ms network overhead taşır.

İkinci tradeoff: orchestration. MACH'ta Stripe ödeme, Algolia arama, Contentful CMS, Klaviyo retention ayrı servislerse, checkout flow'unda bunları coordinate etmek sizin sorumluluğunuz. Monolitik platformda bu entegrasyonlar vendor tarafından çözülmüş. Örnek: Shopify Plus'ta Shopify Flow built-in automation sunar — sipariş geldiğinde Klaviyo'ya event göndermek kod gerektirmez. commercetools'ta bu orchestration'ı siz yazarsınız (örneğin AWS EventBridge + Lambda).

## BigCommerce: Hybrid Yaklaşım Tradeoff'ları

BigCommerce composable'ın "soft landing" versiyonunu sunar. Platform headless kullanımı destekler ama aynı zamanda Stencil theme engine'i (Handlebars-based) ile monolitik geliştirmeye de izin verir. Bu esneklik hem avantaj hem tuzak.

Avantaj: ilk aşamada headless frontend (Next.js) deploy etmeden yalnızca Stencil'i customize ederek başlarsınız, sonra점진적 geçiş yaparsınız. Örnek: checkout sürecini Stencil'de tutup, homepage ve product listing'i Next.js'e taşıyabilirsiniz. BigCommerce'in GraphQL Storefront API'si tüm entity'lere erişim verir (product, category, cart, customer). Anchor eder yaptıysanız, frontend sürpriz çekmez.

Tuzak: Bu esneklik karmaşık deployment pipeline yaratır. Bir projede hem Stencil theme hem Next.js frontend maintain ediyorsanız, feature değişikliği iki deployment gerektirir. Örnek senaryo: stok eşik gösterimi eklemek istiyorsunuz — hem Stencil template'ini hem Next.js API route'unu güncellersiniz. CI/CD'de iki artifact build etmek zorunda kalırsınız.

API performance: BigCommerce GraphQL API P50 latency 95ms (US-East), P99 250ms (BigCommerce Status Page 2025 verisi). REST API daha hızlı (P50 60ms) ama GraphQL kadar esnek değil. Eğer product listing'de variant bilgisini de çekmek istiyorsanız, REST'te N+1 query problemi çıkar (her product için ayrı variant request). GraphQL'de tek query'de nested field alırsınız:

```graphql
query ProductsWithVariants {
  site {
    products(first: 20) {
      edges {
        node {
          name
          prices {
            price {
              value
            }
          }
          variants {
            edges {
              node {
                sku
                inventory {
                  isInStock
                }
              }
            }
          }
        }
      }
    }
  }
}
```

Bu query 140ms'de döner (cache miss, single-region). REST'te aynı data için 20 product request + 20 variant request = 1.2s harcar.

Multi-region deployment: BigCommerce SaaS'tır, instance'ı siz seçemezsiniz. Mağazanız US datacenter'da ise, Asya trafiğine 220ms+ latency ekler. Edge caching (Cloudflare) ile bu kısmen maskelenebilir ama cart mutation (POST /cart/items) cache'lenemez, her zaman origin'e gider.

## commercetools: Full Composable'ın Operational Maliyeti

commercetools MACH mimarisinin "pure form"u — hiçbir frontend, hiçbir built-in theme yok. Yalnızca API sunuyor. Merchant Center (admin UI) bile bir SPA, REST API üzerinde çalışır. Bu yaklaşım maksimum esneklik verir ama maksimum operational overhead getirir.

API tasarımı: commercetools REST API HTTP/2 tabanlı, resource-oriented. Her entity (product, cart, order, customer) ayrı endpoint. GraphQL desteği beta'da (2025 Q4 itibariyle production-ready değil). Örnek: shopping cart'a item eklemek için:

```bash
POST https://api.europe-west1.gcp.commercetools.com/{project-key}/carts/{cart-id}
Authorization: Bearer {token}

{
  "version": 3,
  "actions": [
    {
      "action": "addLineItem",
      "productId": "abc123",
      "variantId": 1,
      "quantity": 2
    }
  ]
}
```

Bu request P50 85ms, P95 180ms döner (GCP europe-west1'den). Ancak dikkat: `version` field'i optimistic locking için zorunlu. Her request'te cart'ın güncel version'ını göndermelisiniz, aksi halde 409 Conflict alırsınız. Bu concurrent checkout senaryolarında retry logic gerektirir.

Operational maliyet: commercetools pricing API call bazlı. İlk 50 milyon API call/yıl sonrası ücretlendirme başlar ($0.0003/call). Örnek hesaplama: aylık 1 milyon session'lı bir site, session başına ortalama 15 API call yapıyorsa (product listing, product detail, cart mutations, checkout), yıllık 180 milyon call = 130 milyon ücretli call = $39,000 API cost. Bu, infrastructure'ın üstüne eklenen maliyet. BigCommerce'te bu maliyet SaaS pricing'e gömülü.

Multi-region: commercetools GCP ve AWS'te multi-region deployment sunar. Projeniçin `europe-west1` veya `us-central1` seçersiniz. Ancak cross-region replication yok — tek region seçimi yaparsınız. Global e-ticarette bu latency demek. Çözüm: [Headless Commerce](https://www.roibase.com.tr/tr/headless) mimarisinde frontend'i edge'de render etmek (Cloudflare Workers, Vercel Edge Functions) ve commercetools API'yi cache layer arkasına almak. Örnek mimari: Cloudflare KV'de product catalog cache'lemek (TTL 60s), cart mutation'ları her zaman origin'e göndermek. Bu sayede product listing 40ms'de döner (edge'den), cart işlemi 180ms sürer (origin'e gider).

## Shopify Plus: Monolitik Kökte Headless Katman

Shopify Plus "composable" terimi yerine "headless" der ama arka planda monolitik bir platform. Hydrogen (React-based framework) ve Storefront API ile headless frontend build edebilirsiniz ama checkout ve admin tamamen Shopify'ın kontrolünde. Bu hybrid model küçük ekiplere hız kazandırır ama büyük ekiplere sınırlama getirir.

Storefront API: GraphQL-only, rate limit (cost-based, query complexity üzerinden hesaplanır). Örnek: her GraphQL query'nin bir "cost" değeri var (basit product query 5 point, nested variant + metafield query 15 point). Store başına saniyede 1000 point quota (Shopify Plus). Bir homepage 50 product listeleyen query 250 point harcarsa, saniyede 4 homepage render edebilirsiniz. Traffic burst'te rate limit alırsınız (429 error).

Hydrogen framework: Shopify'ın resmi React framework'u, Remix üzerine inşa edilmiş. Eski versiyonu (Hydrogen v1) Vite tabanlıydı, yeni versiyon (Hydrogen v2) Remix'in file-based routing'ini kullanır. Built-in Shopify API client, cart management, i18n routing. [Shopify Partner Hizmetleri](https://www.roibase.com.tr/tr/shopify) kapsamında projelerde Hydrogen kullanıyoruz çünkü boilerplate'i azaltıyor: cart state management, checkout redirect, API authentication Hydrogen'de hazır geliyor.

Örnek Hydrogen route:

```typescript
// app/routes/products.$handle.tsx
import {useLoaderData} from '@remix-run/react';
import {json} from '@shopify/remix-oxygen';

export async function loader({params, context}) {
  const {product} = await context.storefront.query(PRODUCT_QUERY, {
    variables: {handle: params.handle},
  });
  return json({product});
}

export default function Product() {
  const {product} = useLoaderData<typeof loader>();
  return <div>{product.title}</div>;
}

const PRODUCT_QUERY = `#graphql
  query Product($handle: String!) {
    product(handle: $handle) {
      id
      title
      priceRange {
        minVariantPrice {
          amount
        }
      }
    }
  }
`;
```

Bu route Oxygen (Shopify'ın edge platform'u) üzerinde deploy edildiğinde, global average latency 90ms (Shopify Performance Dashboard 2025). Ancak Oxygen deployment'ı yalnızca Shopify Plus müşterilerine açık, standart planlarda kullanılamaz (Vercel'e deploy edebilirsiniz ama Storefront API quota aynı kalır).

Tradeoff: Checkout customize edilemez. Shopify checkout sayfası Shopify'ın sunucusunda render edilir, headless frontend'inizden ayrılırsınız. Eğer checkout'ta özel bir loyalty point sistemi göstermek istiyorsanız, Shopify Scripts (Liquid-based) veya Checkout UI Extensions (React component ama sınırlı API) kullanırsınız. commercetools'ta checkout'u tamamen siz build edersiniz.

## Karar Matrisi: Hangi Senaryoda Hangisi

3 vendor'ü somut metriklere göre kıyaslayalım:

| Metrik | BigCommerce | commercetools | Shopify Plus |
|--------|-------------|---------------|--------------|
| API P50 latency | 95ms (GraphQL) | 85ms (REST) | 120ms (GraphQL) |
| Multi-region | Vendor-controlled (US/EU) | GCP/AWS regional | Global edge (Oxygen) |
| Developer onboarding | Orta (Stencil + Next.js) | Yüksek (pure API) | Düşük (Hydrogen) |
| Checkout control | Tam kontrol | Tam kontrol | Kısıtlı (Shopify checkout) |
| Monthly API cost (1M session) | SaaS'e dahil | ~$3,250 | SaaS'e dahil |
| Built-in features | Orta (POS, B2B) | Düşük (API-only) | Yüksek (Flow, Script) |

Senaryo bazlı öneri:

**BigCommerce seçin eğer:** B2B kompleksitesi varsa (quote management, customer groups), hızlı headless geçişe ihtiyacınız yoksa ama gelecekte opsiyonel tutmak istiyorsanız. Multi-storefront (farklı brand'lar aynı backend) kullanıyorsanız.

**commercetools seçin eğer:** Tam ownership istiyorsanız (checkout dahil her şeyi custom build), API-first altyapınız varsa (örneğin mobile app + web + POS aynı API'den besleniyorsa), 100M+ session/yıl trafiğiniz varsa (burada API cost optimize edilebilir cache stratejileriyle).

**Shopify Plus seçin eğer:** Küçük geliştirme ekibiniz varsa (2-4 developer), checkout'u customize etmeniz gerekmiyorsa, Shopify App Store entegrasyonlarından faydalanmak istiyorsanız (Klaviyo, Yotpo, Gorgias built-in connector'ları).

## Composable'ın Gizli Maliyeti: Orchestration

Vendor seçimi deployment'tan sonra başlayan zorluğu gizler: orchestration. MACH mimarisinde checkout flow şöyle bir zincir gerektirir:

1. Frontend (Next.js) → Storefront API (product/cart)
2. Payment gateway (Stripe/Adyen) → Backend orchestrator
3. OMS (Order Management) → commercetools/BigCommerce
4. Email (Klaviyo/SendGrid) → Customer data
5. Inventory sync (ERP) → Stock update

Bu zincirde tek bir link başarısız olursa (örneğin Stripe webhook 5 saniye gecikmeli gelirse), customer deneyimi bozulur. Monolitik platformda (örneğin Magento) bu flow vendor içinde çözülmüş. Composable'da siz orchestration kodunu yazarsınız.

Örnek orchestration (pseudo-code):

```javascript
async function handleCheckout(cartId, paymentToken) {
  const cart = await commercetools.getCart(cartId);
  const paymentResult = await stripe.capturePayment(paymentToken, cart.total);
  
  if (paymentResult.status === 'succeeded') {
    const order = await commercetools.createOrder(cartId);
    await klaviyo.trackEvent('Order Placed', { orderId: order.id });
    await oms.syncOrder(order);
    return { success: true, orderId: order.id };
  } else {
    // Retry logic, error handling, idempotency
    throw new CheckoutError('Payment failed');
  }
}
```

Bu kod basit görünüyor ama production'da şu edge case'leri handle etmelisiniz:

- Stripe başarılı ama commercetools order creation başarısız → ödeme alındı ama sipariş yok (refund gerekir)
- Klaviyo event gönderimi başarısız → customer email almaz (retry queue gerekir)
- Network timeout → request duplicate mi, idempotency kontrolü nasıl yapılır

Bu orchestration'ı yazmak, test etmek, monitor etmek ekip bandwidth'i gerektirir. Shopify Plus'ta bu flow Shopify Flow ile çözülür (no-code). commercetools'ta siz AWS Step Functions veya Temporal workflow yazmak zorundayısınız.

## Frontend Performans: Headless'ın TBT/LCP Trade-off'u

Composable commerce'ın "hızlı" olduğu varsayımı yanıltıcı. Headless frontend (Next.js + Storefront API) monolitik theme'den (Liquid, Stencil) daha hızlı mı? Değişir.

Örnek benchmark (Shopify Hydrogen vs Liquid theme, Dawn tema bazlı):

| Metrik | Liquid (Dawn) | Hydrogen (Oxygen) |
|--------|---------------|-------------------|
| LCP | 1.8s | 1.2s |
| TBT | 420ms | 180ms |
| FCP | 0.9s | 0.7s |
| JavaScript bundle | 45KB | 180KB |

Hydrogen daha hızlı render ediyor (LCP 1.2s vs 1.8s) çünkü server-side rendering yapıyor ve edge'de cache'leniyor. Ancak JavaScript bundle 4x büyük (React + Remix overhead). Eğer clientside etkileşim ağırsa (filtre, wishlist, cart preview), TBT artar.

Tradeoff: Headless'ta JavaScript'i optimize etmezseniz, fast render kazanıp slow interaction kaybedersiniz. [UI/UX Tasarım](https://www.roibase.com.tr/tr/ui-ux) sürecinde bu tradeoff'u göz önünde bulunduruyoruz: kritik etkileşimleri (add-to-cart, checkout) server action'a taşımak, clientside JavaScript'i lazy-load etmek.

## Karar Verme Süreci

Composable commerce kararını şu sırayla verin:

1. **Checkout kontrolü:** Checkout'u tam customize etmeniz gerekiyorsa (örneğin subscription logic, dynamic pricing, custom payment flow) → commercetools veya BigCommerce. Shopify Plus çıkar.

2. **Ekip kapasitesi:** 2-4 developer'lı ekibiniz varsa, operational overhead kaldıramayabilirsiniz → Shopify Plus. 8+ developer, dedicated DevOps varsa → commercetools.

3. **Traffic profili:** Global, multi-region trafiğiniz varsa ve edge rendering şartsa → Shopify Plus (Oxygen) veya BigCommerce + Cloudflare Workers. Single-region traffic → commercetools (GCP regional deployment yeterli).

4. **API budget:** Yüksek session/product görüntüleme oranı varsa (örneğin marketplace, her session 50+ API call) → commercetools API cost'unu hesaplayın. Düşük API call/session → vendor fark etmez.

5. **Built-in features:** B2B, POS, multi-storefront, quote management gerekiyorsa → BigCommerce. Pure DTC e-ticaret → Shopify Plus yeterli. Enterprise B2B + tam kontrol → commercetools.

Headless commerce geçişinde buzzword değil, bu sayıları masanıza koyun: API latency, bundle size, orchestration complexity, ekip velocity. "Composable" terimi 2027'de generic hale gelecek — siz şimdi hangi tradeoff'ları kabul edebileceğinizi belirleyin.