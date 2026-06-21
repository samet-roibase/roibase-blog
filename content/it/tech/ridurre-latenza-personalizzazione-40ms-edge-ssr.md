---
title: "Ridurre la latenza di personalizzazione a 40ms con Edge SSR"
description: "Con Cloudflare Workers e Vercel Edge, il rendering server-side si sposta in edge, abbattendo la personalizzazione da 250ms a 40ms. Architettura KV store, esempi di codice, analisi dei trade-off."
publishedAt: 2026-06-21
modifiedAt: 2026-06-21
category: tech
i18nKey: tech-003-2026-06
tags: [edge-computing, ssr, personalization, cloudflare-workers, vercel-edge]
readingTime: 9
author: Roibase
---

Nei moderni e-commerce, la personalizzazione è ormai un'aspettativa — ma nessuno vuole attendere 250ms a ogni click. L'architettura SSR tradizionale (server-side rendering) crea una latenza media di 150-300ms tra client e origin server: DNS lookup, TCP handshake, TLS negotiation, elaborazione dell'origin. Edge SSR riduce questo ritardo a 40-60ms sfruttando la prossimità geografica e uno store KV globale. Piattaforme come Cloudflare Workers e Vercel Edge Functions offrono runtime edge — il nostro compito è spostare la logica di personalizzazione lì e strutturare correttamente lo store KV.

## Il divario di latenza tra Origin SSR e Edge SSR

Con SSR tradizionale, la richiesta segue questo percorso: utente → CDN (cache miss) → origin server (query DB + rendering) → risposta. Tempo totale medio: 250ms, 95° percentile 450ms. Con Edge SSR, la richiesta termina nel location edge: utente → edge worker (ricerca KV + rendering) → risposta. Tempo medio: 40ms, 95° percentile 80ms.

Fonti di latenza:

| Fase | Origin SSR | Edge SSR |
|---|---|---|
| DNS + TLS | 50ms | 15ms (prossimità edge) |
| Network RTT | 120ms (intercontinentale) | 10ms (distanza da edge) |
| Compute | 80ms (origin) | 15ms (isolato V8) |
| **Totale** | **250ms** | **40ms** |

Questo è un calo del 84%, che impatta direttamente su LCP (Largest Contentful Paint) e CLS (Cumulative Layout Shift). Secondo il rapporto Google Core Web Vitals 2025, ogni 100ms di riduzione in LCP corrisponde a un aumento del 3,5% di bounce rate — guadagnare 210ms significa un +7,3% di lift conversione (calcolo: 210/100 × 3,5).

Trade-off critico: il runtime edge non è Node.js ma un isolato V8 — niente moduli nativi, filesystem, child process. La logica di personalizzazione deve essere completamente stateless e leggera.

### Architettura Edge SSR con Cloudflare Workers

Cloudflare Workers indirizza ogni richiesta a uno dei 300+ location edge nella rete globale. Nel location edge, la richiesta viene elaborata così:

```javascript
// worker.js — Cloudflare Workers
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userId = request.headers.get('x-user-id'); // estratto da JWT

    // Recupera il segmento utente da KV
    const segment = await env.USER_SEGMENTS.get(userId);
    const prefs = segment ? JSON.parse(segment) : { tier: 'free' };

    // Renderizza HTML personalizzato
    const html = renderHTML(prefs, url.pathname);

    return new Response(html, {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
        'cache-control': 'public, s-maxage=60', // cache edge 60s
      },
    });
  },
};

function renderHTML(prefs, path) {
  const hero = prefs.tier === 'premium'
    ? '<h1>Contenuto Premium</h1>'
    : '<h1>Contenuto Gratuito</h1>';
  return `<!DOCTYPE html><html><body>${hero}<p>Percorso: ${path}</p></body></html>`;
}
```

A ogni richiesta, il codice recupera il segmento da KV nello spazio dei nomi `USER_SEGMENTS`. La latenza di lettura KV è in media 15ms a livello globale (benchmark Cloudflare 2025). Alternative: Durable Objects, ma per carichi di lavoro ad alta lettura KV è più conveniente (KV: $0,50/milione di letture; DO: $0,15/milione di richieste + compute).

Il limite di compute di Workers è 50ms di tempo CPU — rendering complesso può superarlo. Soluzione: pre-renderizza i template come HTML e conservali in KV, il worker sostituisce solo i placeholder. Ad esempio, il worker sostituisce `{USER_NAME}`, il template è conservato in KV.

## Integrazione Middleware Next.js con Vercel Edge Functions

Vercel Edge Functions si integra nativamente con Next.js 13+ — puoi usare il pattern middleware per intercettare le richieste e personalizzarle. Nel runtime edge, usi `middleware.ts` al posto di `getServerSideProps`:

```typescript
// middleware.ts — Vercel Edge
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value;
  if (!userId) return NextResponse.next();

  // Recupera il segmento da Edge Config
  const segment = await fetch(`https://edge-config.vercel.com/${userId}`).then(r => r.json());

  // Aggiungi info del segmento all'header, il component pagina lo legge
  const response = NextResponse.next();
  response.headers.set('x-user-segment', segment.tier);
  return response;
}

export const config = {
  matcher: ['/product/:path*', '/category/:path*'],
};
```

Questo approccio funziona bene in architetture [headless commerce](https://www.roibase.com.tr/it/headless) quando personalizzi pagine di listing prodotti. Ad esempio, mostra un ordinamento diverso ai clienti premium. Il component pagina legge:

```tsx
// app/product/[id]/page.tsx
export default async function ProductPage({ params, headers }) {
  const segment = headers.get('x-user-segment');
  const products = await fetchProducts(params.id, segment);
  return <ProductList items={products} />;
}
```

La replicazione globale di Vercel Edge Config si completa entro 150ms — l'aggiornamento di KV si propaga ai location edge in questo intervallo. Trade-off: leggermente più lenta di Cloudflare KV del 20% ma più integrata nell'ecosistema Next.js.

### Architettura KV Store: strategia di segmentazione

I dati di personalizzazione nel KV si organizzano in 3 livelli:

1. **Segmento utente:** `USER_SEGMENTS:{userId}` → `{"tier":"premium","region":"EU"}`
2. **Configurazione segmento:** `SEGMENT_CONFIG:{tier}` → `{"discount":0.2,"hero":"premium.jpg"}`
3. **Template pagina:** `PAGE_TPL:{page}:{tier}` → frammento HTML pre-renderizzato

Questa struttura significa che quando il segmento cambia, solo `USER_SEGMENTS` si aggiorna — i template rimangono cached. Per 1 milione di utenti, il costo KV è: 1M utenti × 1 lettura/richiesta × $0,50/milione = $0,0000005 per richiesta. Una query DB sull'origin costa 100 volte di più.

Strategia TTL in KV:

```javascript
// Il segmento rimane in cache 24 ore
await env.USER_SEGMENTS.put(userId, JSON.stringify(segment), {
  expirationTtl: 86400,
});

// La config rimane in cache 1 ora (potrebbe cambiare frequentemente)
await env.SEGMENT_CONFIG.put(tier, JSON.stringify(config), {
  expirationTtl: 3600,
});
```

Invalidazione: quando un utente esegue l'upgrade, invia un segnale via WebSocket o webhook al worker e aggiorna il KV. Non è real-time — accetta consistenza eventuale (1-5 minuti di ritardo).

## Trade-off nel rendering: Static vs Edge SSR

Edge SSR non è sempre la soluzione migliore. Confronto:

| Metrica | Static (ISR) | Edge SSR | Origin SSR |
|---|---|---|---|
| TTFB | 20ms | 40ms | 250ms |
| Personalizzazione | Nessuna | Sì | Sì |
| Cache hit ratio | 99% | 60% | 10% |
| Costo (1M req) | $0,20 | $2,50 | $15 |
| Complessità | Bassa | Media | Alta |

ISR raggiunge un cache hit ratio del 99% ma senza personalizzazione. Edge SSR frammenta il cache in base al segmento — ogni segmento è una cache key separata, quindi il hit ratio scende.

Approccio ibrido: il layout principale è static, i componenti personalizzati vengono renderizzati in edge e iniettati client-side. Esempio: la griglia di prodotti è static, "Consigliati per te" arrivano via Edge SSR:

```javascript
// Ibrido: HTML statico + sezione personalizzata iniettata da edge
const staticHTML = await env.STATIC_PAGES.get(pathname);
const personalizedSection = await renderPersonalizedRecommendations(userId);
const finalHTML = staticHTML.replace('<!--INJECT-->', personalizedSection);
```

Questo metodo mantiene TTFB a 30ms e offre comunque personalizzazione.

## Debug e monitoraggio: limiti del runtime edge

Nel runtime edge su production, il debug è difficile — i log sono sparsi, lo stack trace incompleto. Su Cloudflare Workers, usa Tail Workers per creare uno stream di log in real-time:

```javascript
// tail-worker.js
export default {
  async tail(events) {
    for (const event of events) {
      console.log(JSON.stringify({
        timestamp: event.timestamp,
        outcome: event.outcome,
        logs: event.logs,
      }));
    }
  },
};
```

Su Vercel, `console.log` scrive nei log edge, disponibili nel dashboard Vercel in streaming. Attenzione: il logging verboso su production può superare il limite di CPU — registra solo gli eventi critici.

Metriche di monitoraggio:

- **Cold start latency:** la prima carica del Worker è 80-120ms — una richiesta "warm" è 15ms. I route frequenti rimangono warm.
- **KV read failure rate:** 0,01% (SLA Cloudflare). Fallback: se KV non risponde, usa il segmento predefinito.
- **CPU time:** superare il limite di 50ms genera un errore %429. Profiling: misura con `console.time()`, sposta il lavoro pesante all'origin.

Esempio di gestione degli errori:

```javascript
try {
  const segment = await env.USER_SEGMENTS.get(userId);
} catch (err) {
  // Fallback in caso di errore KV
  return renderHTML({ tier: 'free' }, pathname);
}
```

Se Edge SSR accetta questi trade-off, il salto da 250ms a 40ms crea un impatto misurabile sulla conversione. Soprattutto su mobile, dove la latenza di rete è alta, la prossimità all'edge è critica. Il passo successivo: strutturare correttamente lo store KV, definire la strategia di segmentazione e testare i limiti del runtime edge.