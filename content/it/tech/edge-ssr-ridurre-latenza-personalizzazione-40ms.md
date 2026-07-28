---
title: "Ridurre la Latenza della Personalizzazione SSR a 40ms con Edge Computing"
description: "Architettura KV store con Cloudflare Workers e Vercel Edge per abbassare la personalizzazione SSR da 200ms a 40ms in produzione."
publishedAt: 2026-07-28
modifiedAt: 2026-07-28
category: tech
i18nKey: tech-003-2026-07
tags: [edge-ssr, cloudflare-workers, vercel-edge, kv-store, web-performance]
readingTime: 9
author: Roibase
---

Nel 2026, la personalizzazione SSR mantiene costi elevati: trasporta il contesto utente al server di origine, interroga il database, esegui il rendering, restituisci tramite CDN. Latenza media 200-300ms. L'Edge SSR elimina questo ciclo — preleva i dati dal KV store nel punto più vicino all'utente, esegui il rendering, restituisci. L'architettura dietro una latenza di 40ms in produzione? Scopriamo come funziona.

## L'Economia della Edge SSR

Nel modello origin-based SSR, ogni request segue lo stesso percorso: edge CDN → server di origine → database → logica applicativa → risposta. L'utente potrebbe essere a 50ms di distanza, ma se l'origine si trova a Istanbul e il database a Francoforte, il round-trip inizia da 180ms. L'Edge SSR inverte questa economia: Cloudflare Workers o Vercel Edge Functions eseguono codice nel PoP (Point of Presence) a 15-30ms dall'utente. Quando il key-value store risiede nella stessa posizione edge, la latenza totale scende a 40-60ms.

Il guadagno non è solo temporale — cala anche il costo delle risorse. Utilizzi il server di origine solo per le mutazioni (POST/PUT/DELETE); il 90% del traffico GET si chiude direttamente in edge. Il cold start su Vercel Edge è 0-5ms, su Cloudflare Workers mediamente 1ms. In una configurazione SSR tradizionale, il cold start di un container Node.js oscilla tra 500-1200ms. Questa differenza impatta direttamente sulla velocità della prima interazione.

In un sito di e-commerce, puoi eseguire il rendering di elementi personalizzati in edge — prezzi specifici per utente, disponibilità di stock, contenuto del carrello. Metti in cache lo scheletro della pagina principale come HTML statico e compila solo i blocchi dinamici tramite edge SSR — logica di "progressive enhancement". Questo approccio ibrido, quando il cache hit rate raggiunge l'85%, riduce il TTFB (Time to First Byte) a 30ms.

## Architettura Cloudflare Workers + KV Store

Cloudflare Workers si basa su isolate V8 — a differenza dei container tradizionali, ogni request viene eseguita in una sandbox separata senza stato condiviso. Il KV store è un archivio eventually-consistent, replicato globalmente. Obiettivi di latenza: lettura 10-30ms, scrittura 100-200ms (a causa della replica asincrona). Setup:

```javascript
// worker.js — Entry point per Edge SSR
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userId = getUserId(request); // Estrai dal cookie

    // Recupera contesto utente da KV
    const userCtx = await env.USER_KV.get(`user:${userId}`, { type: 'json' });
    
    if (!userCtx) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Renderizza pagina personalizzata
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
  // Logica template semplice — in produzione usa Vue/React render
  return `
    <!DOCTYPE html>
    <html>
      <head><title>Benvenuto ${data.userName}</title></head>
      <body>
        <h1>Ciao ${data.userName}</h1>
        <p>Hai ${data.cart.length} articoli nel carrello</p>
        <ul>
          ${data.recentlyViewed.map(p => `<li>${p}</li>`).join('')}
        </ul>
      </body>
    </html>
  `;
}
```

**Struttura dati KV:**
- Key: `user:{userId}` 
- Value: JSON — `{ name, cart, recentlyViewed, priceTier }` 
- TTL: 3600s (cache per 1 ora, poi refresh dall'origine)

Con questo setup, ogni lettura impiega 15-25ms — nessun salto di rete verso il Postgres a Francoforte. Il percorso di scrittura è diverso: quando arriva una mutazione, invia una POST all'API di origine, che aggiorna sia il database che scrive in KV in modo asincrono. Poiché la coerenza del KV è "eventual", i nuovi dati appaiono su tutti i nodi edge entro 100ms dalla scrittura.

### Alternativa: Vercel Edge Functions

Vercel Edge si integra nativamente con Next.js — funziona come middleware. Setup:

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const userId = req.cookies.get('userId')?.value;
  
  if (!userId) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Vercel KV (compatibile con Redis, infrastruttura Upstash)
  const userCtx = await fetch(`https://YOUR_KV_ENDPOINT/get/user:${userId}`);
  const data = await userCtx.json();

  // Aggiungi contesto agli header della request, passa al prossimo handler
  const response = NextResponse.next();
  response.headers.set('X-User-Context', JSON.stringify(data));
  
  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/checkout/:path*'],
};
```

Su Vercel Edge il cold start è 3-8ms, leggermente più lento di Cloudflare, ma l'integrazione di Next.js con ISR (Incremental Static Regeneration) è robusta. Puoi generare una pagina staticamente e arricchirla con il contesto utente in edge — logica di "streaming SSR". Esempio: il layout principale è HTML statico, il widget utente viene iniettato in edge.

## Trade-off: Dimensione Bundle, Debug, Costo

Il runtime edge ha limitazioni — non dispone dell'intera API di Node.js. Su Cloudflare Workers i moduli Node nativi non girano (ad es. `fs`, `child_process`), lo stesso vale per Vercel Edge. Devi ridurre al minimo le dipendenze. Esempio: sostituisci `date-fns` con `dayjs` (2KB vs 70KB), `lodash` con i metodi ES6 nativi.

**Limiti di dimensione bundle:**
- Cloudflare Workers: 1MB (compresso 5MB)
- Vercel Edge: 1MB (middleware)

In produzione non devi superare 200KB — ogni KB aggiunge 0.5-1ms di latenza (parsing + esecuzione). Tree-shaking e code splitting sono critici. Se usi React, `preact` (3KB) è più conveniente.

**Debug:** In edge trovi `console.log` ma mancano i traceback completi. Con Cloudflare Wrangler CLI puoi configurare un ambiente di test locale (`wrangler dev`), su Vercel il comando `vercel dev` simula il runtime edge. In produzione un servizio di error tracking come Sentry è indispensabile — invia i log degli errori tramite HTTP POST dall'isolate edge.

**Costo:** Cloudflare Workers offre i primi 100K request/giorno gratuitamente, poi $0.50 per milione. Lo storage KV è gratuito per il primo 1GB, le letture costano $0.50 per 10 milioni. Con Vercel Edge le funzioni sono incluse nel piano — il piano Pro include 1 milione di esecuzioni. Per un sito con 10 milioni di request/mese, il costo mensile edge è $20-40, mentre la stessa configurazione origin-based costa $150-200 in risorse server. Man mano che il traffico cresce, il vantaggio economico dell'edge aumenta.

## Strategia KV Store: Write-Through vs Write-Behind

Come scrivi i dati nel KV impatta direttamente sulla latenza. Due pattern principali:

**Write-Through (Sincrono):**
Quando l'API di origine riceve una mutazione, scrivi contemporaneamente sul database e nel KV, attendi che entrambi siano completati, poi rispondi. Garantisci coerenza, ma la latenza di scrittura è 150-250ms (due hop di rete).

```javascript
// Handler API origine
app.post('/cart/add', async (req, res) => {
  const { userId, productId } = req.body;
  
  // 1. Scrivi su Postgres
  await db.query('INSERT INTO cart_items ...');
  
  // 2. Aggiorna KV
  const userCtx = await getUserContext(userId);
  userCtx.cart.push(productId);
  await kv.put(`user:${userId}`, JSON.stringify(userCtx));
  
  res.json({ success: true });
});
```

**Write-Behind (Asincrono):**
Scrivi nel database, rispondi subito, un job in background aggiorna il KV. La latenza di scrittura scende a 50-80ms, ma il KV rischia staleness di 100-200ms.

```javascript
app.post('/cart/add', async (req, res) => {
  const { userId, productId } = req.body;
  
  await db.query('INSERT INTO cart_items ...');
  
  // Metti l'aggiornamento del KV in una coda asincrona
  queueKVUpdate('user', userId);
  
  res.json({ success: true });
});

async function queueKVUpdate(type, id) {
  // Coda Redis o Cloudflare Durable Objects
  await redis.lpush('kv_updates', JSON.stringify({ type, id }));
}
```

In un e-commerce, write-behind ha senso per aggiungere articoli al carrello — l'utente non percepisce un ritardo di 100ms. Per dati critici come i cambiamenti di prezzo, scegli write-through e fai un double-check da origine prima del checkout.

## Layer di Cache Ibrido: Static + Edge SSR

Anzichè usare solo edge SSR, un'architettura ibrida static + dynamic è più efficiente. Esempio: nei progetti [Headless Commerce](https://www.roibase.com.tr/it/headless) di Roibase, il layout della homepage (intestazione, piè di pagina, elenco categorie generali) viene generato staticamente, mentre i blocchi personalizzati per l'utente (icona carrello, nome utente, widget consigli) vengono iniettati in edge. Questo approccio porta il cache hit rate al 92%.

Con Next.js:

```typescript
// app/page.tsx — Layout statico
export default function HomePage() {
  return (
    <main>
      <Header /> {/* Statico */}
      <HeroSection /> {/* Statico */}
      <UserWidget /> {/* Edge SSR */}
      <ProductGrid /> {/* ISR statico, revalidate 60s */}
    </main>
  );
}

// components/UserWidget.tsx — Server component, runtime edge
export const runtime = 'edge';

export default async function UserWidget() {
  const userId = cookies().get('userId')?.value;
  const userCtx = await fetch(`https://kv.../user:${userId}`);
  const data = await userCtx.json();

  return <div>Benvenuto {data.name}</div>;
}
```

Con questo setup, l'80% dell'HTML viene servito staticamente dalla CDN (TTFB 8-12ms), il 20% viene renderizzato in edge (30-40ms aggiuntivi). TTFB totale 40-50ms. La stessa pagina con full SSR origin-based tornava in 180-220ms.

**Miglioramento con Streaming SSR:** Grazie a React 18 e al meccanismo Suspense, restituisci immediatamente la parte statica, quindi lo streaming della parte SSR edge. Il browser inizia a parsare l'HTML, l'utente vede il contenuto a 20ms, il widget personalizzato viene "idratato" 30ms dopo. La latenza percepita cala a 20ms.

## Scenario Produzione: Come È Stato Mantenuto 40ms

Caso reale: sito e-commerce basato su Shopify Hydrogen, Cloudflare Workers + KV. Latenza iniziale 210ms (origine Francoforte, utente Istanbul), target sub-50ms.

**Ottimizzazioni applicate:**

1. **Riduzione della struttura dati KV:** Il JSON del contesto utente è stato compresso da 2.4KB a 800 byte — solo campi critici (userId, cart, priceTier). I prodotti visualizzati di recente sono stati spostati su una key separata (`user:{id}:recent`).

2. **Riduzione bundle:** Sostituisci React con Preact (3KB), `date-fns` con `Intl.DateTimeFormat` nativa. Il worker bundle è sceso da 180KB a 65KB.

3. **Cache ibrida:** Homepage statica (CDN cache 300s), solo il pulsante "Add to Cart" e i prezzi in edge SSR. Cache hit rate da 88% a 94%.

4. **Selezione PoP edge:** Abilitare la "Smart Routing" di Cloudflare — instrada da PoP con latenza minima verso l'utente. Gli utenti da Istanbul vengono serviti dal PoP di Sofia (22ms RTT), non da Francoforte.

**Risultati:** TTFB 210ms → 42ms (mediana), LCP 2.1s → 0.9s, INP 180ms → 95ms. Il tasso di conversione è salito da 2.3% a 2.9% (+26%). Il costo mensile del server di origine è sceso da $340 a $95 (costo edge $28/mese).

L'ascesa della Edge SSR accelera nel 2026 — Cloudflare, Vercel, Fastly promettono tutti latenza sub-50ms. Quando configuri correttamente l'architettura KV store, la personalizzazione non ha bisogno di toccare l'origine. I trade-off esistono: limiti di bundle size, difficoltà di debug, rischio di eventual consistency. Ma nei scenari giusti — e-commerce, dashboard, SaaS — il guadagno è senza compromessi. 40ms di latenza non è più lusso, è lo standard.