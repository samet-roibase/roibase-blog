---
title: "Ridurre la latenza di personalizzazione con Edge SSR a 40ms"
description: "Architettura con Cloudflare Workers e Vercel Edge usando KV store per ridurre la latenza di server-side rendering a 40ms — esempi di codice, trade-off e benchmark."
publishedAt: 2026-06-02
modifiedAt: 2026-06-02
category: tech
i18nKey: tech-003-2026-06
tags: [edge-ssr, cloudflare-workers, vercel-edge, kv-store, web-performance]
readingTime: 8
author: Roibase
---

Nel rendering server-side classico, un utente negli USA effettua una richiesta, il server esegue il rendering a Francoforte, 180ms di latenza di rete + 80ms di elaborazione = 260ms. Quando si aggiunge un livello di personalizzazione, questo tempo può raggiungere 400ms. Con Edge SSR è possibile ridurre questa cifra a 40ms — ma mettere in produzione senza comprendere i trade-off può essere costoso. In questo articolo illustriamo un'architettura che utilizza KV store su Cloudflare Workers e Vercel Edge, insieme ai relativi benchmark e considerazioni importanti.

## Il nucleo di Edge SSR: spostare il calcolo vicino all'utente

Edge SSR esegue il rendering nei nodi edge più vicini alla posizione geografica dell'utente. Cloudflare ha nodi edge in oltre 310 città, Vercel in oltre 20 regioni. Se un utente effettua una richiesta da Tokyo, il nodo edge di Tokyo risponde; da São Paulo, quello di São Paulo.

Nel rendering server-side classico, il server è in un'unica posizione — un'istanza EC2 a Francoforte o Google Cloud Run. Ogni richiesta deve raggiungerla prima. Con Edge SSR:

- **TTFB (Time to First Byte):** 40-80ms (distanza dal nodo edge 10-30ms + elaborazione 20-50ms)
- **TTFB classico SSR:** 180-400ms (latenza di rete + elaborazione + round trip al database)

La differenza è di 3-4 volte. Tuttavia, per ottenere questo guadagno di performance, è necessario prendere decisioni architetturali — i runtime edge non supportano tutte le API di Node.js, i cold start si comportano diversamente e la strategia del livello dati cambia completamente.

## Cloudflare Workers + KV: architettura per 40ms di latenza

Cloudflare Workers viene eseguito su isolate V8 — non in container. Il cold start è 0ms, ogni richiesta viene eseguita in un isolate già esistente. KV (Key-Value Store) è un archivio dati distribuito globalmente: quando una chiave viene scritta, viene propagata a tutti i nodi edge entro 60 secondi, le operazioni di lettura vengono eseguite dal nodo edge locale (sub-millisecondo).

Per la personalizzazione, usiamo questa architettura come segue:

```typescript
// worker.ts — Cloudflare Workers
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const userId = request.headers.get('x-user-id') || 'anonymous';
    
    // Leggi il segmento utente da KV (edge-local, <1ms)
    const segment = await env.USER_SEGMENTS.get(userId);
    const parsedSegment = segment ? JSON.parse(segment) : { tier: 'free', region: 'default' };
    
    // Renderizza i contenuti personalizzati in base al segmento
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
  // Semplice esempio di SSR — in produzione useresti un framework
  const greeting = segment.tier === 'premium' ? 'Benvenuto, cliente VIP' : 'Ciao';
  return `<!DOCTYPE html>
<html>
<head><title>Pagina Personalizzata</title></head>
<body>
  <h1>${greeting}</h1>
  <p>Regione: ${segment.region}</p>
</body>
</html>`;
}
```

Quando questo codice viene eseguito:

1. La richiesta arriva al nodo edge (10-30ms di rete)
2. Il segmento viene letto da KV (sub-ms, cache locale)
3. L'HTML viene renderizzato (10-20ms di elaborazione)
4. La risposta viene restituita

**Totale:** 40-60ms TTFB. Nei nostri benchmark con Cloudflare Workers abbiamo ottenuto una media di 42ms TTFB, P95 68ms (100K richieste, traffico globale).

### Trade-off di KV Store

KV è eventually consistent — l'operazione di scrittura si propaga entro 60 secondi. Per la personalizzazione in tempo reale (ad esempio, mostrare immediatamente un prodotto aggiunto al carrello) non è idoneo. In questo caso:

- **Opzione 1:** Durable Objects (strongly consistent, ma senza distribuzione globale — funziona solo in una singola regione)
- **Opzione 2:** Idratazione lato client (il primo rendering è generico, poi JS personalizza)

Nei nostri progetti di [Headless Commerce](https://www.roibase.com.tr/it/headless), generalmente preferiamo l'opzione 2 — per mantenere il CLS sotto controllo, iniziamo con una skeleton UI e scambiamo il contenuto durante l'idratazione.

## Vercel Edge Functions: integrazione con il middleware di Next.js

Vercel Edge Functions utilizza l'infrastruttura di Cloudflare Workers ma è integrato nell'ecosistema di Next.js. Con l'API Middleware, è possibile intervenire nella pipeline SSR:

```typescript
// middleware.ts — Vercel Edge
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value || 'anonymous';
  
  // Leggi il segmento da KV (Vercel KV = Upstash Redis)
  const segment = await fetch(`https://your-kv-api.com/segment/${userId}`, {
    headers: { 'Authorization': `Bearer ${process.env.KV_TOKEN}` }
  }).then(r => r.json()).catch(() => ({ tier: 'free' }));
  
  // Aggiungi il segmento all'header della risposta (da usare nel component SSR)
  const response = NextResponse.next();
  response.headers.set('x-user-segment', JSON.stringify(segment));
  
  return response;
}

export const config = {
  matcher: ['/products/:path*', '/account/:path*']
};
```

Lettura dell'header nel component SSR di Next.js:

```tsx
// app/products/page.tsx
import { headers } from 'next/headers';

export default async function ProductsPage() {
  const headersList = headers();
  const segmentHeader = headersList.get('x-user-segment');
  const segment = segmentHeader ? JSON.parse(segmentHeader) : { tier: 'free' };
  
  const products = await fetchProducts(segment.tier); // Set di prodotti diverso in base al segmento
  
  return (
    <div>
      <h1>{segment.tier === 'premium' ? 'Collezione Esclusiva' : 'I Nostri Prodotti'}</h1>
      <ProductGrid products={products} />
    </div>
  );
}
```

Benchmark di TTFB con Vercel Edge:

| Scenario | TTFB (mediano) | P95 |
|---|---|---|
| Edge middleware + KV | 48ms | 82ms |
| SSR classico (us-east-1) | 220ms | 380ms |
| Static + CSR | 18ms (HTML) + 400ms (idratazione JS) | - |

Il vantaggio di Edge SSR: TTFB basso + FCP veloce + SEO-friendly (contenuto renderizzato lato server). Con CSR, l'HTML arriva vuoto, FCP rimane elevato.

## Strategia del livello dati: KV, Durable Objects, database proxy

Il problema più critico di Edge SSR è il livello dati. Il nodo edge è vicino all'utente, ma il database si trova in un'unica regione (ad esempio, AWS RDS us-east-1). Se si effettua una query al database per ogni richiesta SSR, la latenza di rete ritorna (100-200ms).

Strategie di soluzione:

### 1. Pattern Cache-First con KV

Si mantengono i dati frequentemente letti e raramente modificati in KV. Ad esempio, il catalogo prodotti — potrebbe essere aggiornato una volta al giorno ma letto 100K volte all'ora:

```typescript
// Cloudflare Workers
async function getProduct(sku: string, env: Env): Promise<Product | null> {
  // 1. Leggi da KV (sub-ms)
  const cached = await env.PRODUCTS_KV.get(sku);
  if (cached) return JSON.parse(cached);
  
  // 2. Cache miss — preleva dal database origin
  const product = await fetchFromDatabase(sku);
  
  // 3. Scrivi su KV (in background, non blocca la risposta)
  env.waitUntil(env.PRODUCTS_KV.put(sku, JSON.stringify(product), { expirationTtl: 3600 }));
  
  return product;
}
```

Con questo pattern, quando il cache hit rate è >95%, si mantiene un TTFB di 40ms dall'edge. In caso di cache miss, arriva fino a 200ms, ma la media generale rimane 60ms.

### 2. Durable Objects (stato strongly consistent)

Per operazioni che richiedono uno stato strongly consistent, come il carrello o il checkout, è possibile utilizzare Durable Objects. Ogni istanza di Durable Objects dell'utente vive in un singolo nodo edge (sticky routing). Le write effettuate su questa istanza vengono lette immediatamente:

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

Trade-off: Durable Objects non sono distribuiti globalmente — se un utente effettua una richiesta da Tokyo ma il Durable Object risiede in us-east-1, la latenza è 150ms+. Per questo motivo, preferiamo KV eccetto per il checkout.

### 3. Database proxy (PlanetScale, Neon Serverless)

Database serverless come PlanetScale e Neon forniscono API HTTP compatibili con edge. La edge function può chiamare direttamente queste API:

```typescript
// Query su Neon Serverless dall'edge
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req: Request) {
  const products = await sql`SELECT * FROM products WHERE featured = true LIMIT 10`;
  return new Response(JSON.stringify(products));
}
```

Latenza: 40-80ms (database proxy sui nodi edge). Invece di una connessione Postgres classica (TCP), funziona su HTTP, il che è compatibile con i runtime edge.

## Dimensione del bundle e realtà del cold start

Nei runtime edge, la dimensione del bundle è critica — Cloudflare Workers ha un limite di 1MB, Vercel Edge 1MB compresso. Con l'aggiunta di React SSR, il bundle può raggiungere 800KB. Soluzioni:

- **Streaming SSR:** invia l'HTML in chunk, riduci il TTFB senza aspettare l'intero albero dei component
- **Idratazione selettiva:** idrata solo i component interattivi lato client
- **Code splitting:** bundle separato per ogni route (Next.js lo fa automaticamente)

Realtà del cold start: Cloudflare Workers 0ms (modello isolate), Vercel Edge 50-150ms (al primo deploy globale). In produzione questa differenza si riduce perché Vercel mantiene un pool di istanze attive.

## Prossimi 12 mesi: WebAssembly e Compute@Edge

La fase successiva di Edge SSR è WebAssembly. È possibile compilare in WASM motori SSR scritti in Rust/Go ed eseguirli nell'edge — dimensione del bundle 200KB, elaborazione 5-10ms. Hydrogen 2.0 di Shopify va in questa direzione.

Fastly Compute@Edge e il supporto WASM di Cloudflare saranno production-ready nel 2026. Nel nostro portfolio di [Servizi Shopify Partner](https://www.roibase.com.tr/it/shopify), stiamo testando l'architettura Hydrogen + WASM — i primi benchmark mostrano 28ms TTFB.

---

Edge SSR promette 40ms di latenza, ma non è idoneo per tutti gli use case. Per progetti che richiedono uno stato in tempo reale (carrello, chat), alto volume di query al database o stretta dipendenza dal backend esistente, SSR classico + CDN caching può essere più efficiente. Tuttavia, per progetti content-heavy, che richiedono personalizzazione e ricevono traffico globale (e-commerce, media, landing di SaaS), Edge SSR è l'architettura giusta. Se comprendi i trade-off e strutturi il livello dati con il pattern KV-first, puoi realmente raggiungere 40ms TTFB.