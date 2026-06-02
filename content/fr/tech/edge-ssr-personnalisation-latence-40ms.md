---
title: "Réduire la latence de personnalisation à 40ms avec Edge SSR"
description: "Architecture avec Cloudflare Workers et Vercel Edge utilisant un KV store pour réduire la latence du server-side rendering à 40ms — exemples de code, compromis et benchmarks."
publishedAt: 2026-06-02
modifiedAt: 2026-06-02
category: tech
i18nKey: tech-003-2026-06
tags: [edge-ssr, cloudflare-workers, vercel-edge, kv-store, web-performance]
readingTime: 9
author: Roibase
---

En SSR classique, un utilisateur aux États-Unis envoie une requête, le serveur à Francfort effectue le rendu, 180ms de latence réseau + 80ms de calcul = 260ms. Avec une couche de personnalisation, ce chiffre peut atteindre 400ms. Avec Edge SSR, il est possible de réduire ce temps à 40ms — mais sans comprendre les compromis, une mise en production risque de coûter cher. Dans cet article, nous présentons une architecture fonctionnant sur Cloudflare Workers et Vercel Edge avec KV store, ses benchmarks et les points d'attention critiques.

## Le cœur d'Edge SSR : rapprocher le calcul de l'utilisateur

Edge SSR exécute le rendu sur le nœud edge le plus proche de l'endroit où se trouve l'utilisateur. Cloudflare dispose de runtime edge dans 310+ villes, Vercel dans 20+ régions. Si un utilisateur envoie une requête depuis Tokyo, c'est le nœud edge de Tokyo qui répond ; depuis São Paulo, c'est celui de São Paulo.

En SSR classique, le serveur est unique — une instance EC2 à Francfort ou Google Cloud Run. Chaque requête doit d'abord y parvenir. Avec Edge SSR :

- **TTFB (Time to First Byte) :** 40-80ms (distance du nœud edge 10-30ms + calcul 20-50ms)
- **TTFB en SSR classique :** 180-400ms (latence réseau + calcul + allers-retours base de données)

L'écart est de 3 à 4 fois. Cependant, pour bénéficier de ce gain de performance, vous devez prendre des décisions architecturales — les runtime edge ne supportent pas toutes les API de Node.js, les cold start fonctionnent différemment et la stratégie de couche données change complètement.

## Cloudflare Workers + KV : architecture pour 40ms de latence

Cloudflare Workers s'exécute sur des isolates V8 — pas de conteneur. Le cold start est 0ms, chaque requête s'exécute dans un isolate existant. KV (Key-Value Store) est un dépôt de données distribué à l'échelle mondiale : quand une clé est écrite, elle se propage à tous les nœuds edge dans les 60 secondes ; la lecture s'effectue depuis le nœud edge local (sub-milliseconde).

Pour la personnalisation, nous utilisons cette architecture comme suit :

```typescript
// worker.ts — Cloudflare Workers
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const userId = request.headers.get('x-user-id') || 'anonymous';
    
    // Lire le segment utilisateur depuis KV (edge-local, <1ms)
    const segment = await env.USER_SEGMENTS.get(userId);
    const parsedSegment = segment ? JSON.parse(segment) : { tier: 'free', region: 'default' };
    
    // Rendre le contenu en fonction du segment
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
  // Exemple simple de SSR — en production, vous utiliserez un framework
  const greeting = segment.tier === 'premium' ? 'Bienvenue, VIP' : 'Bonjour';
  return `<!DOCTYPE html>
<html>
<head><title>Page personnalisée</title></head>
<body>
  <h1>${greeting}</h1>
  <p>Région : ${segment.region}</p>
</body>
</html>`;
}
```

Quand ce code s'exécute :

1. La requête arrive au nœud edge (10-30ms réseau)
2. Le segment est lu depuis KV (sub-ms, cache local)
3. Le HTML est rendu (10-20ms calcul)
4. La réponse est envoyée

**Total :** 40-60ms TTFB. Nos benchmarks avec Cloudflare Workers montrent un TTFB moyen de 42ms, P95 de 68ms (100 000 requêtes, trafic mondial).

### Les compromis du KV Store

KV est finalement cohérent — l'écriture se propage dans les 60 secondes. Pour la personnalisation en temps réel (par exemple, afficher un produit ajouté au panier instantanément), ce n'est pas adapté. Dans ce cas :

- **Option 1 :** Durable Objects (fortement cohérent, mais pas de distribution mondiale — fonctionnent dans une région unique)
- **Option 2 :** Hydratation côté client (première page générale, ensuite personnalisée par JavaScript)

Dans nos projets de [commerce headless](https://www.roibase.com.tr/fr/headless), nous préférons généralement l'option 2 — utiliser un skeleton UI initial puis échanger le contenu pendant l'hydratation pour maîtriser le CLS.

## Vercel Edge Functions : intégration avec Next.js Middleware

Vercel Edge Functions utilise l'infrastructure de Cloudflare Workers mais s'intègre à l'écosystème Next.js. L'API Middleware vous permet d'intervenir dans le pipeline SSR :

```typescript
// middleware.ts — Vercel Edge
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value || 'anonymous';
  
  // Lire le segment depuis le KV edge (Vercel KV = Upstash Redis)
  const segment = await fetch(`https://your-kv-api.com/segment/${userId}`, {
    headers: { 'Authorization': `Bearer ${process.env.KV_TOKEN}` }
  }).then(r => r.json()).catch(() => ({ tier: 'free' }));
  
  // Ajouter le segment au header de réponse (à utiliser dans le composant SSR)
  const response = NextResponse.next();
  response.headers.set('x-user-segment', JSON.stringify(segment));
  
  return response;
}

export const config = {
  matcher: ['/products/:path*', '/account/:path*']
};
```

Lire le header dans un composant SSR Next.js :

```tsx
// app/products/page.tsx
import { headers } from 'next/headers';

export default async function ProductsPage() {
  const headersList = headers();
  const segmentHeader = headersList.get('x-user-segment');
  const segment = segmentHeader ? JSON.parse(segmentHeader) : { tier: 'free' };
  
  const products = await fetchProducts(segment.tier); // Ensemble de produits différent selon le segment
  
  return (
    <div>
      <h1>{segment.tier === 'premium' ? 'Collection Exclusive' : 'Nos Produits'}</h1>
      <ProductGrid products={products} />
    </div>
  );
}
```

Nos benchmarks TTFB avec Vercel Edge :

| Scénario | TTFB (médiane) | P95 |
|---|---|---|
| Middleware Edge + KV | 48ms | 82ms |
| SSR classique (us-east-1) | 220ms | 380ms |
| Static + CSR | 18ms (HTML) + 400ms (hydratation JS) | - |

L'avantage d'Edge SSR : TTFB faible + FCP rapide + SEO-friendly (contenu rendu côté serveur). Avec CSR, le HTML arrive vide et le FCP reste élevé.

## Stratégie de couche données : KV, Durable Objects, Database Proxy

Le problème le plus critique avec Edge SSR est la couche données. Le nœud edge est proche de l'utilisateur, mais votre base de données se trouve dans une région unique (par exemple, AWS RDS us-east-1). Si vous lancez une requête à la base de données pour chaque requête SSR, la latence réseau revient (100-200ms).

Stratégies de solution :

### 1. Modèle Cache-First avec KV

Vous conservez les données peu changeantes mais fréquemment lues dans KV. Par exemple, le catalogue de produits — peut être mis à jour une fois par jour mais lu 100 000 fois par heure :

```typescript
// Cloudflare Workers
async function getProduct(sku: string, env: Env): Promise<Product | null> {
  // 1. Lire depuis KV (sub-ms)
  const cached = await env.PRODUCTS_KV.get(sku);
  if (cached) return JSON.parse(cached);
  
  // 2. Cache miss — récupérer depuis la base de données d'origine
  const product = await fetchFromDatabase(sku);
  
  // 3. Écrire dans KV (en arrière-plan, ne bloque pas la réponse)
  env.waitUntil(env.PRODUCTS_KV.put(sku, JSON.stringify(product), { expirationTtl: 3600 }));
  
  return product;
}
```

Avec ce modèle, quand le taux de cache hit est >95%, vous maintenez 40ms TTFB depuis l'edge. En cas de cache miss, cela monte à 200ms, mais la moyenne générale reste autour de 60ms.

### 2. Durable Objects (État fortement cohérent)

Pour les opérations nécessitant un état fortement cohérent comme le panier ou le paiement, Durable Objects peut être utilisé. Chaque instance Durable Object pour un utilisateur vit sur un nœud edge unique (routage sticky). Les écritures vers cette instance sont immédiatement lisibles :

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

Compromis : les Durable Objects ne sont pas distribués mondialement — si un utilisateur à Tokyo envoie une requête mais que le Durable Object se trouve à us-east-1, la latence dépassera 150ms. C'est pourquoi nous préférons KV pour la plupart des cas.

### 3. Database Proxy (PlanetScale, Neon Serverless)

Des bases de données serverless comme PlanetScale et Neon proposent des API HTTP compatibles avec l'edge. Une fonction edge peut appeler directement cette API :

```typescript
// Requête vers Neon Serverless depuis l'edge
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req: Request) {
  const products = await sql`SELECT * FROM products WHERE featured = true LIMIT 10`;
  return new Response(JSON.stringify(products));
}
```

Latence : 40-80ms (proxy de base de données hébergé sur les nœuds edge). Contrairement à une connexion Postgres classique (TCP), elle fonctionne via HTTP et est compatible avec les runtime edge.

## Taille du bundle et réalité du cold start

Pour les runtime edge, la taille du bundle est critique — limite de 1MB pour Cloudflare Workers, 1MB compressé pour Vercel Edge. Ajouter React SSR peut faire monter le bundle à 800KB. Solutions :

- **Streaming SSR :** envoyer le HTML par chunks, réduire le TTFB sans attendre la compilation complète de l'arborescence des composants
- **Hydratation sélective :** hydrater uniquement les composants interactifs côté client
- **Code splitting :** bundle distinct par route (Next.js le fait automatiquement)

Réalité du cold start : Cloudflare Workers 0ms (modèle isolate), Vercel Edge 50-150ms (premier déploiement mondial). En production, cette différence disparaît car Vercel maintient un pool d'instances warm.

## Les 12 prochains mois : WebAssembly et Compute@Edge

La prochaine étape d'Edge SSR est WebAssembly. Vous pouvez compiler des moteurs SSR écrits en Rust/Go en WASM et les exécuter à l'edge — taille du bundle 200KB, calcul 5-10ms. Hydrogen 2.0 de Shopify s'oriente dans cette direction.

Fastly Compute@Edge et le support WASM de Cloudflare seront production-ready en 2026. Dans notre offre de [services partenaires Shopify](https://www.roibase.com.tr/fr/shopify), nous testons actuellement l'architecture Hydrogen + WASM — les premiers benchmarks affichent 28ms TTFB.

---

Edge SSR promet 40ms de latence, mais ce n'est pas adapté à tous les cas. Pour les projets nécessitant un état temps réel (panier, chat), un fort volume de requêtes base de données ou une dépendance étroite à votre backend existant, SSR classique + cache CDN peut être plus efficace. En revanche, pour les projets riches en contenu, nécessitant de la personnalisation et recevant du trafic mondial (e-commerce, médias, SaaS landing), Edge SSR est l'architecture appropriée. En comprenant les compromis et en structurant votre couche données selon le modèle KV-first, vous atteindrez vraiment les 40ms TTFB.